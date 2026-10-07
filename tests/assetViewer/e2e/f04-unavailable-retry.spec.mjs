// F04 unavailable asset (404 / 410 / expired 403 / blocked CORS) and the user-started retry.
import { axe, EXPECTED, expect, getState, openState, test, viewer, waitStatus } from "./common.mjs";

test.describe("F04 unavailable asset", () => {
  test.use({ allowConsole: { patterns: [EXPECTED.http4xx, EXPECTED.cors] } });

  for (const [http, reason, msg] of [
    ["404", "gone", "This model's link no longer works: the file wasn't found or has been removed."],
    ["410", "gone", "This model's link no longer works: the file wasn't found or has been removed."],
    ["403", "denied", "This model's link has expired or isn't allowed from this page."],
  ]) {
    test(`F04-N ${http} -> FETCH_FAILED (${reason}) with an honest message, no Download, no pointless Try again`, async ({ page }) => {
      await openState(page, `unavailable&http=${http}`);
      await waitStatus(page, "error");
      const v = viewer(page);
      await expect(v.getByRole("alert")).toHaveText(msg);
      await expect(v.getByRole("button", { name: "Download file" })).toBeHidden();
      await expect(v.getByRole("button", { name: "Try again" })).toBeHidden();
      const s = await getState(page);
      expect(s.error).toMatchObject({ code: "FETCH_FAILED", reason, status: Number(http) });
      await axe(page, `unavailable ${http}`);
    });
  }

  test("F04-E1 blocked cross-origin fetch: focusable Try again; exactly one request per user click (no silent retry)", async ({ page }) => {
    const hits = [];
    page.on("request", (r) => r.url().includes("/__simcdn/blocked.glb") && hits.push(r.url()));
    await openState(page, "unavailable&http=cors");
    await waitStatus(page, "error");
    const v = viewer(page);
    await expect(v.getByRole("alert")).toContainText(/couldn't be downloaded|connection/i);
    await page.waitForTimeout(1500); // longer than the 1 s 429 pause: nothing may fire on its own
    expect(hits).toHaveLength(1);
    const retry = v.getByRole("button", { name: "Try again" });
    await retry.focus();
    await expect(retry).toBeFocused();
    expect(await retry.evaluate((b) => getComputedStyle(b).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__host.events.filter((e) => e.startsWith("error")).length >= 2);
    expect(hits).toHaveLength(2);
    expect((await getState(page)).error.code).toBe("FETCH_FAILED");
    await axe(page, "unavailable cors");
  });
});
