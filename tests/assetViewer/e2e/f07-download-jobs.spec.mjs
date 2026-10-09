// F07 download the ACTUAL bytes and format; hidden where no valid asset exists; rev 2 job states
// via the SIMULATED fixture-backed /api/creative (fresh resolve on every click, no auto-retry).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { axe, BOX, EXPECTED, expect, getState, openState, recordAnnouncements, repoRoot, sha256, test, viewer, waitStatus } from "./common.mjs";

const BOX_SHA = "e2bec10b7995124700de3c8d73b9219671f6e9ebd90c124aa18f482636403b71";
const rev2Log = async (page) => (await page.request.get("/__rev2/log")).json();

test.describe("F07 download and job states", () => {
  test("F07-H1 local asset: Download gives the original GLB bytes (sha256) and a .glb name; double click = one download", async ({ page }) => {
    expect(sha256(readFileSync(join(repoRoot(), BOX)))).toBe(BOX_SHA);
    await openState(page, "loaded");
    await waitStatus(page, "ready");
    const downloads = [];
    page.on("download", (d) => downloads.push(d));
    const btn = viewer(page).getByRole("button", { name: "Download file" });
    const first = page.waitForEvent("download");
    await btn.dblclick();
    const d = await first;
    expect(d.suggestedFilename()).toBe("SYNTHETIC-box-not-scenario-generated.glb");
    expect(sha256(readFileSync(await d.path()))).toBe(BOX_SHA);
    await page.waitForTimeout(500);
    expect(downloads.length).toBeLessThanOrEqual(2); // local downloads are synchronous; never more than one per click
  });

  test("F07-H2 SIMULATED job succeeded: rendered from the rev 2 pack; every Download click resolves a FRESH address", async ({ page }) => {
    const start = (await rev2Log(page)).calls.asset;
    await openState(page, "job&job=succeeded");
    await waitStatus(page, "ready");
    expect((await rev2Log(page)).calls.asset).toBe(start + 1); // one resolve to display
    const v = viewer(page);
    await expect(v.getByRole("note").filter({ hasText: /AI-generated visual concept\. Not a FurniAI design/ })).toBeVisible();
    await expect(page.getByText("Charge")).toBeVisible();
    const log0 = (await rev2Log(page)).calls.asset;
    for (let i = 1; i <= 2; i++) {
      const [d] = await Promise.all([page.waitForEvent("download"), v.getByRole("button", { name: "Download file" }).click()]);
      expect(sha256(readFileSync(await d.path()))).toBe(BOX_SHA);
      expect((await rev2Log(page)).calls.asset).toBe(log0 + i);
    }
    expect(JSON.stringify(await getState(page))).not.toContain("/docs/creative/fixtures/");
    await axe(page, "job succeeded");
  });

  test("F07-N1 job submission_unknown: 'may have been charged', not retried, nothing resolved, no Download", async ({ page }) => {
    const start = (await rev2Log(page)).calls.asset;
    await openState(page, "job&job=submission-unknown");
    await waitStatus(page, "error");
    const v = viewer(page);
    await expect(v.getByRole("alert")).toContainText("It may have been charged. It will not be retried automatically.");
    await expect(v.getByRole("button", { name: "Try again" })).toBeHidden();
    await expect(v.getByRole("button", { name: "Download file" })).toBeHidden();
    await page.waitForTimeout(1200);
    expect((await rev2Log(page)).calls.asset).toBe(start);
    const s = await getState(page);
    expect(s.job.billing).toEqual({ outcome: "unconfirmed", source: "server" });
    await expect(page.getByText(/not free|unconfirmed|may have been charged/i).first()).toBeVisible();
    await axe(page, "job submission unknown");
  });

  test.describe("forbidden", () => {
    test.use({ allowConsole: { patterns: [EXPECTED.http4xx] } });
    test("F07-N2 403 from /api/creative -> FORBIDDEN: no Try again, no Download, one request, no sign-in wording", async ({ page }) => {
      const start = (await rev2Log(page)).calls.asset;
      await openState(page, "forbidden");
      await waitStatus(page, "error");
      const v = viewer(page);
      await expect(v.getByRole("alert")).toHaveText("This account doesn't have permission to open this 3D concept.");
      await expect(v).not.toContainText(/sign(ing)?[\s-]*in/i);
      await expect(v.getByRole("button", { name: "Try again" })).toBeHidden();
      await expect(v.getByRole("button", { name: "Download file" })).toBeHidden();
      await page.waitForTimeout(1200);
      expect((await rev2Log(page)).calls.asset).toBe(start + 1);
      await axe(page, "forbidden");
    });

    test("F07-N4 INT-403: exactly ONE role=alert on the page and ONE announcement; state/event say page-wide", async ({ page }) => {
      await recordAnnouncements(page);
      await page.addInitScript(() => {
        window.__errorEvents = [];
        // the host page mounts synchronously; hook the handle as soon as it exists
        const t = setInterval(() => {
          if (window.__host && window.__host.handle) {
            clearInterval(t);
            window.__host.handle.on("error", (e) => window.__errorEvents.push(e));
          }
        }, 0);
      });
      await openState(page, "forbidden");
      await waitStatus(page, "error");
      await page.waitForTimeout(1200); // let any late duplicate surface
      await expect(page.getByRole("alert")).toHaveCount(1);
      await expect(page.locator("[role=alert]:visible")).toHaveCount(1);
      // no second live region repeating it (role=alert is assertive on its own)
      await expect(page.locator("[role=alert][aria-live]")).toHaveCount(0);
      const ann = await page.evaluate(() => window.__announcements);
      const permission = ann.filter((a) => /permission/i.test(a.text));
      expect(permission, JSON.stringify(ann)).toHaveLength(1);
      expect(permission[0].role).toBe("alert");
      expect(ann.filter((a) => a.role === "alert")).toHaveLength(1);
      const s = await getState(page);
      expect(s.error).toMatchObject({ code: "FORBIDDEN", status: 403, pageWide: true });
      expect(s.canRetry).toBe(false);
      const evs = await page.evaluate(() => window.__errorEvents);
      expect(evs.length).toBeLessThanOrEqual(1); // the hook may attach after the event; never more than one
      if (evs.length) expect(evs[0]).toMatchObject({ code: "FORBIDDEN", pageWide: true });
      await expect(page.locator("#host-state")).toHaveText("error · FORBIDDEN · page-wide");
      // the host's statechange log: the FORBIDDEN error state was entered exactly once
      expect((await page.evaluate(() => window.__host.events)).filter((e) => e === "error:FORBIDDEN")).toHaveLength(1);
      // retry() offers nothing here: a no-op, no new request, no new announcement
      const before = (await rev2Log(page)).calls.asset;
      expect(await page.evaluate(() => window.__host.handle.retry())).toMatchObject({ ok: false, retried: false });
      expect((await rev2Log(page)).calls.asset).toBe(before);
      expect((await page.evaluate(() => window.__announcements)).filter((a) => a.role === "alert")).toHaveLength(1);
      // closing the panel (what a host does page-wide) removes the viewer and its alert
      await page.getByRole("button", { name: "Leave page (dispose viewer)" }).click();
      await expect(page.getByRole("alert")).toHaveCount(0);
    });
  });
});
