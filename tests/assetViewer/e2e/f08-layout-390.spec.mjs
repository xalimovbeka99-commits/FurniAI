// F08 (review round 5, QE layout probe): at 390 px the demo pages have 0 horizontal overflow
// and every interactive control, in the viewer overlay and in the demo/host page, is at least
// 44 x 44 CSS px. Also checked at 1440. SYNTHETIC/MOCKED and SIMULATED states only.
import { EXPECTED, expect, noElementOverflow, noHorizontalOverflow, openState, tapTargets, test, viewer, waitStatus } from "./common.mjs";

const HOST_STATES = [
  // [query, status to wait for, viewer controls expected visible]
  ["loaded", "ready", ["Rotate left", "Rotate right", "Zoom in", "Zoom out", "Reset view", "Fit to view", "Download file"]],
  ["forbidden", "error", []],
  ["unavailable&http=cors", "error", ["Try again"]],
  ["webgl&webgl=none", "error", ["Download file"]],
];

test.describe("F08 layout: no horizontal overflow, 44 px tap targets", () => {
  test.use({ allowConsole: { patterns: [EXPECTED.http4xx, EXPECTED.cors] } });

  for (const [q, status, controls] of HOST_STATES) {
    test(`F08-L1 host page ?state=${q}: 0 overflow; viewer + host controls >= 44x44`, async ({ page }) => {
      await openState(page, q);
      await waitStatus(page, status);
      const v = viewer(page);
      for (const name of controls) await expect(v.getByRole("button", { name, exact: true })).toBeVisible();
      await noHorizontalOverflow(page);
      await noElementOverflow(page);
      const r = await tapTargets(page);
      expect(r.inViewer).toBeGreaterThanOrEqual(controls.length);
      expect(r.count).toBeGreaterThan(r.inViewer); // the host page's own buttons and state links were measured too
    });
  }

  for (const [path, label, readyText] of [
    ["/docs/m3/asset-viewer/demo/?three=r166", "viewer demo (index.html)", "Textured chair"],
    ["/docs/m3/asset-viewer/demo/creative.html?three=r166", "creative demo (creative.html)", "Succeeded GLB"],
  ]) {
    test(`F08-L2 ${label}: 0 overflow; every demo + viewer control >= 44x44`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("button", { name: readyText, exact: true })).toBeVisible();
      await expect(viewer(page)).toBeVisible();
      await page.waitForTimeout(1500); // initial load settles
      await noHorizontalOverflow(page);
      await noElementOverflow(page);
      const box = await viewer(page).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(300); // the viewer is not squeezed into a sliver at 390
      const r = await tapTargets(page);
      expect(r.count).toBeGreaterThanOrEqual(12);
    });
  }
});
