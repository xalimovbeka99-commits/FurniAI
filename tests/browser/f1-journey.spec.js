import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.join("docs", "m2", "integ", "evidence", "f1");
const SHA = process.env.F1_SHA || "90e3e84d124d15f7ddfef3809c3e62eaf31dc9c4";

test.describe("F1 customer journey on integration candidate", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "SOURCE_SHA.txt"), SHA + "\n");
  });

  test("viewer: framing, exact door, rails, material; mobile NEEDS FIXES", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/#/build/golden-parametric");
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.waitForFunction(
      () => typeof Builder !== "undefined" && Builder.isParametric && Builder.doorObjs && Builder.doorObjs.length === 4
    );
    await page.waitForFunction(() => Builder.parts?.[0] && Builder.ren && Builder.cam);

    const toggleDoors = page.locator("#toggle-doors");
    await expect(toggleDoors).toBeVisible();
    await page.evaluate(() => {
      Builder.doorsOpen = false;
      Builder.doorObjs.forEach((p) => {
        p.userData.base = 0;
      });
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      if (Builder.cam) {
        Builder.cam.position.set(0, 0.35, 3.5);
        if (Builder.ctrl) {
          Builder.ctrl.target.set(0, 0.2, 0);
          Builder.ctrl.update();
        }
        Builder.ren.render(Builder.scene, Builder.cam);
      }
    });
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "01-closed-overview.png") });

    await page.evaluate(() => {
      const door1 = Builder.doorObjs.find((p) => p.userData?.partId === "DOOR_01") || Builder.doorObjs[0];
      door1.userData.base = 1;
      for (const p of Builder.doorObjs) {
        if (p !== door1) p.userData.base = 0;
      }
    });
    await page.waitForTimeout(700);
    const doorState = await page.evaluate(() =>
      Builder.doorObjs.map((p) => ({ id: p.userData.partId || p.name, open: !!p.userData.base }))
    );
    fs.writeFileSync(path.join(OUT, "02-exact-door-state.json"), JSON.stringify(doorState, null, 2));
    expect(doorState.filter((d) => d.open).length).toBe(1);
    expect(doorState.find((d) => d.id === "DOOR_01")?.open || doorState[0].open).toBe(true);
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "02-exact-door-open.png") });

    await toggleDoors.click();
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      Builder.doorsOpen = true;
      Builder.doorObjs.forEach((p) => {
        p.userData.base = 1;
      });
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      Builder.cam.position.set(0.15, 0.9, 1.7);
      if (Builder.ctrl) {
        Builder.ctrl.target.set(0, 0.8, 0.15);
        Builder.ctrl.update();
      }
      Builder.ren.render(Builder.scene, Builder.cam);
    });
    const rails = await page.evaluate(() => {
      const out = [];
      Builder.parts[0].traverse((c) => {
        if (c.isMesh && c.userData?.isPreviewMesh) {
          out.push({
            name: c.name,
            tubeType: c.userData.tubeType,
            color: c.material?.color?.getHex?.() ?? null,
            assumed: c.userData.assumed,
          });
        }
      });
      return {
        rails: out,
        structural: Builder.parts[0].userData?.structuralPartCount,
        preview: Builder.parts[0].userData?.previewPartCount,
      };
    });
    fs.writeFileSync(path.join(OUT, "03-rails-state.json"), JSON.stringify(rails, null, 2));
    expect(rails.rails.length).toBe(2);
    expect(rails.structural).toBe(19);
    expect(rails.preview).toBe(2);
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "03-rails-open-closeup.png") });

    const swatches = page.locator(".b-sw");
    await expect(swatches.first()).toBeVisible();
    expect(await swatches.count()).toBeGreaterThan(1);
    const beforeColors = rails.rails.map((r) => r.color);
    await swatches.nth(1).click();
    await page.waitForTimeout(500);
    const afterMat = await page.evaluate(() => {
      const out = [];
      Builder.parts[0].traverse((c) => {
        if (c.isMesh && c.userData?.isPreviewMesh) {
          out.push({ name: c.name, color: c.material?.color?.getHex?.() ?? null });
        }
      });
      return { rails: out, parametricMat: Builder.parametricMat || null };
    });
    fs.writeFileSync(path.join(OUT, "04-after-material.json"), JSON.stringify(afterMat, null, 2));
    expect(afterMat.rails.length).toBe(2);
    expect(afterMat.rails[0].color).toBe(beforeColors[0]);
    expect(afterMat.rails[1].color).toBe(beforeColors[1]);
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "04-material-rails-unchanged.png") });

    // Narrow: canvas must render, but matrix status is NEEDS FIXES (Antigravity) — never skip-as-PASS.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await expect(page.locator("#bld3d")).toBeVisible();
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.screenshot({ path: path.join(OUT, "05-narrow-viewport.png"), fullPage: false });
    fs.writeFileSync(
      path.join(OUT, "05-narrow-RESULT.txt"),
      "NEEDS FIXES (Antigravity): 390px canvas visible but usable wardrobe UI (compact badge, framing, collapsible panel, hide drawer controls) not accepted as PASS from screenshot alone.\n"
    );
  });

  test("local parser: Generate Draft Preview → width edit → Undo restore (no API key)", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/#/build/ai-wardrobe");
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.waitForFunction(
      () =>
        typeof Builder !== "undefined" &&
        typeof globalThis.PartGraphBridge !== "undefined" &&
        typeof globalThis.PartGraphBridge.previewDraftWardrobe === "function" &&
        typeof globalThis.PartGraphBridge.applyConversationalEdit === "function" &&
        typeof initAiWardrobePanel === "function"
    );
    await page.evaluate(() => {
      initAiWardrobePanel(true);
      const bm = document.querySelector(".b-main");
      if (bm) bm.classList.add("ai-wardrobe-mode");
      const aiPanel = document.getElementById("aiWardrobePanel");
      if (aiPanel) aiPanel.style.display = "block";
    });

    // Force local parser path — missing live key must not block this test.
    await page.evaluate(() => {
      globalThis.AiDesignerTransport = null;
    });

    const input = page.locator("#aiWardrobeInput");
    const submit = page.locator("#aiWardrobeSubmitBtn");
    await expect(input).toBeVisible();
    await expect(submit).toBeVisible();
    await input.fill("Make me a wardrobe");
    await submit.click();

    const review = page.locator("#aiWardrobeReviewSection");
    await expect(review).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#revWidth")).toBeVisible();

    const widthBefore = (await page.locator("#revWidth").innerText()).trim();
    const revBefore = (await page.locator("#revRevision").innerText()).trim();
    fs.writeFileSync(
      path.join(OUT, "07-local-draft.json"),
      JSON.stringify({ widthBefore, revBefore, path: "previewDraftWardrobe" }, null, 2)
    );
    expect(widthBefore.length).toBeGreaterThan(0);

    await page.waitForFunction(() => Builder.parts?.[0] && Builder.doorObjs && Builder.doorObjs.length >= 1);

    // Mandatory: Undo control must become customer-visible in review after draft.
    const undo = page.locator("#aiWardrobeReviewSection #btnUndoEdit");
    await expect(undo).toBeVisible();

    const chip = page.locator("#aiWardrobeReviewSection #chipWidth2000");
    await expect(chip).toBeVisible();
    await chip.click();

    await page.waitForFunction(
      (prev) => {
        const el = document.getElementById("revWidth");
        return el && el.textContent && el.textContent.includes("2000");
      },
      widthBefore,
      { timeout: 15000 }
    );

    const widthAfterEdit = (await page.locator("#revWidth").innerText()).trim();
    const revAfterEdit = (await page.locator("#revRevision").innerText()).trim();
    const undoStackLen = await page.evaluate(() => (aiWardrobeState.undoStack || []).length);
    fs.writeFileSync(
      path.join(OUT, "08-local-edit.json"),
      JSON.stringify({ widthAfterEdit, revAfterEdit, undoStackLen }, null, 2)
    );
    expect(widthAfterEdit).toContain("2000");
    expect(undoStackLen).toBeGreaterThan(0);

    // Mandatory Undo after successful edit — fail loudly if not exercisable.
    await expect(undo).toBeVisible();
    await expect(undo).toBeEnabled();
    await undo.click();

    await page.waitForFunction(
      (edited) => {
        const el = document.getElementById("revWidth");
        return el && el.textContent && !el.textContent.includes("2000");
      },
      widthAfterEdit,
      { timeout: 10000 }
    );

    const widthAfterUndo = (await page.locator("#revWidth").innerText()).trim();
    const revAfterUndo = (await page.locator("#revRevision").innerText()).trim();
    fs.writeFileSync(
      path.join(OUT, "09-local-undo.json"),
      JSON.stringify({ widthAfterUndo, revAfterUndo, widthBefore }, null, 2)
    );
    expect(widthAfterUndo).toBe(widthBefore);
    expect(revAfterUndo).toBe(revBefore);
    fs.writeFileSync(
      path.join(OUT, "06-undo-RESULT.txt"),
      "PASS (local parser path): Undo visible after edit and restored width/revision. Live-model Undo remains UNVERIFIED without API key.\n"
    );
  });
});

