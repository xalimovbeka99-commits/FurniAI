// F02 orbit / zoom / fit / reset: buttons, keyboard, touch orbit + pinch, resize and orientation change.
import { axe, expect, getView, noHorizontalOverflow, openState, test, viewer, waitStatus } from "./common.mjs";

async function centreOf(page) {
  const b = await viewer(page).getByRole("img", { name: "Interactive 3D preview" }).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}

test.describe("F02 orbit, zoom, fit, reset", () => {
  test("F02-H1 on-screen controls rotate, zoom, reset and fit", async ({ page }) => {
    await openState(page, "textured");
    await waitStatus(page, "ready");
    const g = viewer(page).getByRole("group", { name: "3D view controls" });
    const v0 = await getView(page);
    await g.getByRole("button", { name: "Rotate left" }).click();
    const v1 = await getView(page);
    expect(Math.abs(v1.azimuth - v0.azimuth)).toBeGreaterThan(0.2);
    await g.getByRole("button", { name: "Zoom in" }).click();
    const v2 = await getView(page);
    expect(v2.distance).toBeLessThan(v1.distance);
    await g.getByRole("button", { name: "Reset view" }).click();
    const v3 = await getView(page);
    expect(v3.azimuth).toBeCloseTo(v0.azimuth, 3);
    expect(v3.zoomRatio).toBeCloseTo(v0.zoomRatio, 3);
    await g.getByRole("button", { name: "Zoom out" }).click();
    await g.getByRole("button", { name: "Fit to view" }).click();
    expect((await getView(page)).zoomRatio).toBeCloseTo(1, 2);
    await axe(page, "controls");
  });

  test("F02-E1 keyboard only: Tab reaches the canvas and every control with a visible focus ring; arrows and +/- work", async ({ page }) => {
    await openState(page, "textured");
    await waitStatus(page, "ready");
    const canvas = viewer(page).getByRole("img", { name: "Interactive 3D preview" });
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await canvas.evaluate((c) => document.activeElement === c);
    }
    expect(reached).toBe(true);
    const ring = await canvas.evaluate((c) => getComputedStyle(c).outlineStyle);
    expect(ring).not.toBe("none");
    const v0 = await getView(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("+");
    const v1 = await getView(page);
    expect(v1.azimuth).not.toBeCloseTo(v0.azimuth, 2);
    expect(v1.distance).toBeLessThan(v0.distance);
    await page.keyboard.press("0");
    expect((await getView(page)).zoomRatio).toBeCloseTo(v0.zoomRatio, 2);
    // every view control and the download button are reachable by Tab, each with a visible ring
    const names = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        return { name: a.getAttribute("aria-label") || a.textContent, ring: getComputedStyle(a).outlineStyle, inViewer: Boolean(a.closest("[data-asset-viewer]")) };
      });
      if (!info.inViewer) break;
      expect(info.ring, info.name).not.toBe("none");
      names.push(info.name);
    }
    expect(names).toEqual(expect.arrayContaining(["Rotate left", "Rotate right", "Zoom in", "Zoom out", "Reset view", "Fit to view"]));
  });

  test("F02-E2 resize / orientation change re-fits and keeps the zoom ratio; no overflow", async ({ page }) => {
    await openState(page, "loaded");
    await waitStatus(page, "ready");
    await viewer(page).getByRole("group", { name: "3D view controls" }).getByRole("button", { name: "Zoom out" }).click();
    const before = await getView(page);
    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.height, height: vp.width }); // rotate
    await page.waitForFunction((fit) => window.__host.handle.getView().fitDistance !== fit, before.fitDistance, { timeout: 5000 });
    const after = await getView(page);
    expect(after.zoomRatio).toBeCloseTo(before.zoomRatio, 2);
    expect(after.azimuth).toBeCloseTo(before.azimuth, 2);
    await noHorizontalOverflow(page);
    await page.setViewportSize(vp);
    await page.waitForFunction((fit) => Math.abs(window.__host.handle.getView().fitDistance - fit) < 1e-6, before.fitDistance, { timeout: 5000 });
    expect((await getView(page)).zoomRatio).toBeCloseTo(before.zoomRatio, 2);
  });

  test("F02-E3 touch: one-finger drag orbits, two-finger pinch zooms", async ({ page, browserName }, info) => {
    test.skip(info.project.name !== "mobile-390", "touch is exercised on the 390 px touch project");
    test.skip(browserName !== "chromium", "CDP touch");
    await openState(page, "textured");
    await waitStatus(page, "ready");
    const cdp = await page.context().newCDPSession(page);
    const { x, y } = await centreOf(page);
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([px, py], id) => ({ x: px, y: py, id })) });
    const v0 = await getView(page);
    await touch("touchStart", [[x, y]]);
    for (let i = 1; i <= 8; i++) await touch("touchMove", [[x + i * 12, y]]);
    await touch("touchEnd", []);
    await page.waitForTimeout(150);
    const v1 = await getView(page);
    expect(Math.abs(v1.azimuth - v0.azimuth)).toBeGreaterThan(0.1);
    // pinch out = zoom in
    await touch("touchStart", [[x - 20, y], [x + 20, y]]);
    for (let i = 1; i <= 8; i++) await touch("touchMove", [[x - 20 - i * 10, y], [x + 20 + i * 10, y]]);
    await touch("touchEnd", []);
    await page.waitForTimeout(150);
    const v2 = await getView(page);
    expect(v2.distance).toBeLessThan(v1.distance * 0.95);
  });
});
