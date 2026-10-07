// F07 download the ACTUAL bytes and format; hidden where no valid asset exists; rev 2 job states
// via the SIMULATED fixture-backed /api/creative (fresh resolve on every click, no auto-retry).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { axe, BOX, EXPECTED, expect, getState, openState, repoRoot, sha256, test, viewer, waitStatus } from "./common.mjs";

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
    test("F07-N2 403 from /api/creative -> FORBIDDEN: no Try again (re-auth won't fix it), no Download, one request", async ({ page }) => {
      const start = (await rev2Log(page)).calls.asset;
      await openState(page, "forbidden");
      await waitStatus(page, "error");
      const v = viewer(page);
      await expect(v.getByRole("alert")).toContainText("Signing in again won't change that.");
      await expect(v.getByRole("button", { name: "Try again" })).toBeHidden();
      await expect(v.getByRole("button", { name: "Download file" })).toBeHidden();
      await page.waitForTimeout(1200);
      expect((await rev2Log(page)).calls.asset).toBe(start + 1);
      await axe(page, "forbidden");
    });
  });
});
