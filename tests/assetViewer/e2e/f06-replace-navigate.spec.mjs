// F06 replace a model, then leave the page: everything is released, nothing renders afterwards.
import { axe, expect, getState, openState, test, viewer, waitStatus } from "./common.mjs";

/** Counts WebGL draw calls on the page (wraps both context prototypes before any script runs). */
async function instrument(page) {
  await page.addInitScript(() => {
    window.__draws = 0;
    for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!P) continue;
      for (const k of ["drawElements", "drawArrays"]) {
        const f = P.prototype[k];
        P.prototype[k] = function (...a) {
          window.__draws++;
          return f.apply(this, a);
        };
      }
    }
  });
}

test.describe("F06 replace and navigate", () => {
  test("F06-H1 replace: the second model is shown, the first one's GPU memory is released", async ({ page }) => {
    await openState(page, "replace");
    await page.waitForFunction(() => window.__host.events.filter((e) => e === "ready").length >= 2, null, { timeout: 20_000 });
    const s = await getState(page);
    expect(s.model.proportions.ratioLabel).toContain("0.50 : 1.00 : 0.30"); // the SYNTHETIC box replaced the cube
    const mem = await page.evaluate(() => {
      const d = window.__host.handle._debug();
      return { ...d.renderer.info.memory };
    });
    // the box has no texture; the cube's texture is gone (env map PMREM texture may remain: 0 or 1)
    expect(mem.textures).toBeLessThanOrEqual(1);
    expect(mem.geometries).toBeLessThanOrEqual(2);
    await expect(viewer(page).getByRole("note").filter({ hasText: "Demonstration asset" })).toBeVisible();
    await axe(page, "after replace");
  });

  test("F06-H2 host dispose (navigation): canvas and overlay removed, context lost, no further draws; dispose is idempotent", async ({ page }) => {
    await instrument(page);
    await openState(page, "textured");
    await waitStatus(page, "ready");
    await page.getByRole("button", { name: "Leave page (dispose viewer)" }).click();
    await expect(viewer(page)).toHaveCount(0);
    const after = await page.evaluate(() => window.__draws);
    // poke it: these must all be no-ops now
    await page.evaluate(() => {
      const h = window.__host.handle;
      h.dispose();
      h.fitToView();
      h.orbit(0.5, 0);
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__draws)).toBe(after);
    expect((await getState(page)).status).toBe("disposed");
    expect(await page.locator("canvas").count()).toBe(0);
  });

  test("F06-E1 back/forward navigation mid-load (pagehide) disposes; the page comes back clean", async ({ page }) => {
    await openState(page, "loading");
    await expect(viewer(page).getByRole("status")).toContainText(/Loading model/);
    await page.goto("/docs/m3/asset-viewer/demo/host.html?state=loaded");
    await waitStatus(page, "ready");
    await page.goBack();
    await expect(page.getByText("SIMULATED, demonstration asset, not a Scenario result")).toBeVisible();
    await expect(viewer(page)).toHaveCount(1);
  });

  test("F06-E2 host removes the viewer's node without dispose: rendering stops", async ({ page }) => {
    await instrument(page);
    await openState(page, "textured");
    await waitStatus(page, "ready");
    await page.evaluate(() => document.querySelector("#viewer").replaceChildren());
    const n = await page.evaluate(() => window.__draws);
    await page.evaluate(() => {
      window.__host.handle.orbit(0.4, 0);
      window.__host.handle.fitToView();
    });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__draws)).toBe(n);
    await page.evaluate(() => window.__host.handle.dispose());
  });
});
