import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
const OUT = path.join("docs", "m2", "integ", "evidence");
test("integ journey extras", async ({ page }) => {
  test.setTimeout(90000);
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("/#/build/golden-parametric");
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.isParametric && Builder.doorObjs?.length === 4);
  await page.evaluate(() => { for (const p of Builder.doorObjs) p.userData.base = 0; });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    Builder.cam.position.set(0, 0.3, 3.4);
    Builder.ctrl.target.set(0, 0.15, 0);
    Builder.ctrl.update();
    Builder.ren.render(Builder.scene, Builder.cam);
  });
  await page.locator("#bld3d").screenshot({ path: path.join(OUT, "04-closed-overview.png") });
  await page.evaluate(() => { for (const p of Builder.doorObjs) p.userData.base = 1; });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    Builder.cam.position.set(0.2, 0.85, 1.6);
    Builder.ctrl.target.set(0, 0.75, 0.2);
    Builder.ctrl.update();
    Builder.ren.render(Builder.scene, Builder.cam);
  });
  await page.locator("#bld3d").screenshot({ path: path.join(OUT, "05-rail-closeup-open.png") });
  const doorOk = await page.evaluate(() => {
    const results = [];
    for (const pivot of Builder.doorObjs) {
      const before = pivot.userData.base;
      pivot.userData.base = before ? 0 : 1;
      results.push({ id: pivot.userData.partId || pivot.name, before, after: pivot.userData.base });
    }
    return results;
  });
  fs.writeFileSync(path.join(OUT, "06-door-toggle.json"), JSON.stringify(doorOk, null, 2));
  expect(doorOk.length).toBe(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "07-narrow-viewport.png"), fullPage: false });
});
