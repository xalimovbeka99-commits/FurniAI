import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const ARTIFACTS_DIR = path.join(process.cwd(), "docs", "artifacts", "customer-workflow");
const BRAIN_DIR = "C:/Users/xalim/.gemini/antigravity/brain/aa668b8a-afc9-445c-922a-5e668174f73a";

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
try {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
} catch (_) {}

async function captureScreenshot(page, filename) {
  const target = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  try {
    fs.copyFileSync(target, path.join(BRAIN_DIR, filename));
  } catch (_) {}
}

test.describe("Customer Controls UI: Real Page Reload & Reopen Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test("Actual reload / fresh-browser save and reopen driven purely through customer DOM controls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // In-memory server mock following Claude's /api/designs definitive contract
    let persistedDesignId = "cust_ui_design_442";
    const serverRevisions = new Map();

    await page.route("**/api/designs**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (method === "POST" && url.endsWith("/api/designs")) {
        const body = JSON.parse(route.request().postData() || "{}");
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            designId: persistedDesignId,
            name: body.name || "Master Bedroom Wardrobe",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            latestRevision: null,
          }),
        });
      }
      if (method === "POST" && url.includes("/revisions")) {
        const body = JSON.parse(route.request().postData() || "{}");
        serverRevisions.set(body.revision, body);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            designId: persistedDesignId,
            revision: body.revision,
            fingerprint: body.fingerprint,
            validationStatus: "ACCEPTED",
            createdAt: new Date().toISOString(),
          }),
        });
      }
      if (method === "GET" && url.includes("/revisions/")) {
        const revNum = Number(url.split("/").pop());
        const stored = serverRevisions.get(revNum);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            designId: persistedDesignId,
            revision: revNum,
            fingerprint: stored?.fingerprint,
            furniSpec: stored?.furniSpec,
            partGraph: stored?.partGraph,
            origins: stored?.origins,
            validationStatus: "ACCEPTED",
            createdAt: new Date().toISOString(),
          }),
        });
      }
      if (method === "GET" && url.includes("/api/designs/")) {
        const latestRev = Math.max(...Array.from(serverRevisions.keys()), 1);
        const stored = serverRevisions.get(latestRev);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            design: { designId: persistedDesignId, name: "Master Bedroom Wardrobe" },
            latestRevision: stored ? { revision: latestRev, fingerprint: stored.fingerprint, specId: stored.furniSpec?.specId, validationStatus: "ACCEPTED" } : null,
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, designs: [] }) });
    });

    // Provide auth token through test harness injection
    await page.addInitScript(() => {
      window.__TEST_ACCESS_TOKEN__ = "test-customer-bearer-token";
    });

    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    // 1. Enter natural description through DOM input
    const inputArea = page.locator("#aiWardrobeInput");
    await inputArea.fill("Wardrobe 1800mm wide, 2400mm high, 600mm deep, oak finish");
    await page.locator("#aiWardrobeSubmitBtn").click();

    // 2. Wait for draft review table
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible();
    await expect(page.locator("#aiSaveStatusText")).toContainText("Draft (unsaved)");

    // 3. Customer clicks #bSave button in the DOM UI
    // Handle dialog prompt for design name & success alert
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err));
    page.on("dialog", async (dialog) => {
      console.log("PAGE DIALOG:", dialog.type(), dialog.message());
      if (dialog.type() === "prompt") {
        await dialog.accept("Master Bedroom Wardrobe");
      } else {
        await dialog.accept();
      }
    });

    const saveBtn = page.locator("#bSave");
    await saveBtn.click();

    // 4. Verify save badge transitions to Saved (Rev 1) in DOM
    const badgeText = page.locator("#aiSaveStatusText");
    await expect(badgeText).toContainText("Saved (Rev 1)");

    const savedDesignId = await page.evaluate(() => window.aiWardrobeState.durableDesignId);
    expect(savedDesignId).toBe(persistedDesignId);

    await captureScreenshot(page, "ctrl-01-saved-via-button.png");

    // 5. ACTUAL FULL BROWSER RELOAD
    await page.reload();
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    // Verify initial clean state after reload (clean slate, no design loaded in memory)
    const afterReloadState = await page.evaluate(() => ({
      hasPartGraph: Boolean(window.aiWardrobeState?.partGraph),
      specId: window.aiWardrobeState?.specId,
    }));
    expect(afterReloadState.hasPartGraph).toBe(false);

    // 6. Customer clicks #bReopenApi button in the DOM UI to reopen by design ID
    page.removeAllListeners("dialog");
    let promptStep = 0;
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") {
        if (promptStep === 0) {
          promptStep++;
          await dialog.accept(savedDesignId); // designId prompt
        } else {
          await dialog.accept(""); // revision prompt (blank = latest)
        }
      } else {
        await dialog.accept();
      }
    });

    const reopenBtn = page.locator("#bReopenApi");
    await reopenBtn.click();

    // 7. Verify design is restored in the editor purely from customer reopen action
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible();
    await expect(page.locator("#revWidth")).toHaveText("1800 mm");
    await expect(page.locator("#revHeight")).toHaveText("2400 mm");
    await expect(page.locator("#revDepth")).toHaveText("600 mm");
    await expect(page.locator("#revRevision")).toHaveText("1");
    await expect(badgeText).toContainText("Saved (Rev 1)");

    // Verify 3D canvas has 19 panels restored
    const reopened3d = await page.evaluate(() => {
      const pg = getActivePartGraph();
      return {
        partCount: pg?.parts?.length || 0,
        widthDmm: pg?.summary?.envelope?.widthDmm,
      };
    });
    expect(reopened3d.partCount).toBe(19);
    expect(reopened3d.widthDmm).toBe(18000);

    await captureScreenshot(page, "ctrl-02-reopened-after-reload.png");
  });
});
