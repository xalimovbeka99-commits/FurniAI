// F05 WebGL failure: no context, context creation throws, context lost mid-session.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { axe, expect, getState, openState, repoRoot, sha256, test, viewer, waitStatus } from "./common.mjs";

const CUBE = sha256(readFileSync(join(repoRoot(), "tests/fixtures/scenario/textured-cube.glb")));

test.describe("F05 WebGL failure", () => {
  for (const [mode, code, text] of [
    ["none", "WEBGL_UNAVAILABLE", /WebGL is disabled or unsupported/],
    ["throw", "WEBGL_UNAVAILABLE", /WebGL is disabled or unsupported/],
    ["lost", "WEBGL_CONTEXT_LOST", /graphics context was lost/],
  ]) {
    test(`F05-N webgl=${mode} -> ${code}: honest alert, and the VALID file can still be downloaded (actual bytes)`, async ({ page }) => {
      await openState(page, `webgl&webgl=${mode}`);
      await page.waitForFunction((c) => window.__host.events.some((e) => e === `error:${c}`), code, { timeout: 20_000 });
      await page.waitForFunction(() => window.__host.handle.getState().actions && window.__host.handle.getState().actions.download, null, { timeout: 20_000 }).catch(() => {});
      const v = viewer(page);
      await expect(v.getByRole("alert")).toHaveText(text);
      const dl = v.getByRole("button", { name: "Download file" });
      await expect(dl).toBeVisible();
      const [d] = await Promise.all([page.waitForEvent("download"), dl.click()]);
      expect(d.suggestedFilename()).toMatch(/\.glb$/);
      expect(sha256(readFileSync(await d.path()))).toBe(CUBE);
      const s = await getState(page);
      expect(s.error.code).toBe(code);
      if (mode === "lost") await expect(v.getByRole("button", { name: "Try again" })).toBeVisible();
      await axe(page, `webgl ${mode}`);
    });
  }
});
