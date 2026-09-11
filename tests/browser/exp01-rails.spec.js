import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.join("docs", "m2", "exp01");

test.describe("EXP-01 hanging-rail preview evidence", () => {
  test("rails present, survive material change, screenshots", async ({ page }) => {
    test.setTimeout(90000);
    fs.mkdirSync(OUT, { recursive: true });

    await page.goto("/#/build/golden-parametric");
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.waitForFunction(
      () => typeof Builder !== "undefined" && Builder.isParametric && Builder.parts && Builder.parts.length > 0
    );
    await page.waitForFunction(
      () => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4
    );

    // Open all doors for interior view
    await page.evaluate(() => {
      for (const pivot of Builder.doorObjs || []) {
        pivot.userData.base = 1;
      }
    });
    await page.waitForTimeout(800);

    const before = await page.evaluate(() => {
      const rails = [];
      Builder.parts[0].traverse((c) => {
        if (c.isMesh && (c.userData?.isPreviewMesh || String(c.name || "").startsWith("preview_RAIL"))) {
          rails.push({
            name: c.name,
            tubeType: c.userData.tubeType,
            tubeTypeResolved: c.userData.tubeTypeResolved,
            assumed: c.userData.assumed,
            finishIntent: c.userData.finishIntent,
            color: c.material?.color?.getHex?.() ?? null,
            structuralCount: Builder.parts[0].userData?.structuralPartCount,
            previewCount: Builder.parts[0].userData?.previewPartCount,
          });
        }
      });
      return { rails, parametricMat: Builder.parametricMat || null };
    });

    fs.writeFileSync(path.join(OUT, "browser-rail-state-before.json"), JSON.stringify(before, null, 2));
    expect(before.rails.length).toBe(2);
    expect(before.rails[0].structuralCount).toBe(19);
    expect(before.rails[0].previewCount).toBe(2);
    expect(before.rails.every((r) => r.tubeType === "OVAL_TUBE_15X30")).toBe(true);
    expect(before.rails.every((r) => r.assumed?.minorDiamMm === 15)).toBe(true);

    // Front-ish camera
    await page.evaluate(() => {
      if (Builder.cam && Builder.ctrl) {
        Builder.cam.position.set(0, 0.4, 3.2);
        Builder.ctrl.target.set(0, 0.2, 0);
        Builder.ctrl.update();
        Builder.ren.render(Builder.scene, Builder.cam);
      }
    });
    await page.waitForTimeout(200);
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "rails-front-open.png") });

    // Perspective
    await page.evaluate(() => {
      if (Builder.cam && Builder.ctrl) {
        Builder.cam.position.set(2.4, 1.2, 2.8);
        Builder.ctrl.target.set(0, 0.3, 0);
        Builder.ctrl.update();
        Builder.ren.render(Builder.scene, Builder.cam);
      }
    });
    await page.waitForTimeout(200);
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "rails-perspective-open.png") });

    // Material swatch change
    const swatches = page.locator(".b-sw");
    const swCount = await swatches.count();
    let afterMat = before;
    if (swCount >= 2) {
      await swatches.nth(1).click();
      await page.waitForTimeout(400);
      afterMat = await page.evaluate(() => {
        const rails = [];
        Builder.parts[0].traverse((c) => {
          if (c.isMesh && c.userData?.isPreviewMesh) {
            rails.push({
              name: c.name,
              color: c.material?.color?.getHex?.() ?? null,
              finishIntent: c.userData.finishIntent,
            });
          }
        });
        return { rails, parametricMat: Builder.parametricMat || null };
      });
      fs.writeFileSync(path.join(OUT, "browser-rail-state-after-material.json"), JSON.stringify(afterMat, null, 2));
      // Rails keep chrome color
      expect(afterMat.rails.length).toBe(2);
      expect(afterMat.rails[0].color).toBe(before.rails[0].color);
      expect(afterMat.rails[1].color).toBe(before.rails[1].color);
      await page.locator("#bld3d").screenshot({ path: path.join(OUT, "rails-after-material.png") });
    }

    // Undo if button exists
    const undo = page.locator("#btnUndoEdit");
    if (await undo.count()) {
      const enabled = await undo.isEnabled().catch(() => false);
      if (enabled) {
        await undo.click();
        await page.waitForTimeout(400);
        const afterUndo = await page.evaluate(() => {
          const rails = [];
          Builder.parts[0].traverse((c) => {
            if (c.isMesh && c.userData?.isPreviewMesh) {
              rails.push({ name: c.name, color: c.material?.color?.getHex?.() ?? null });
            }
          });
          return { rails, parametricMat: Builder.parametricMat || null };
        });
        fs.writeFileSync(path.join(OUT, "browser-rail-state-after-undo.json"), JSON.stringify(afterUndo, null, 2));
        expect(afterUndo.rails.length).toBe(2);
        await page.locator("#bld3d").screenshot({ path: path.join(OUT, "rails-after-undo.png") });
      } else {
        fs.writeFileSync(
          path.join(OUT, "browser-undo-note.txt"),
          "btnUndoEdit present but disabled (no AI revision stack). Rail material independence verified via swatch colors instead."
        );
      }
    }
  });
});
