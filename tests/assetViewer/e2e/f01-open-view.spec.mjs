// F01 open and view a generated (here: SYNTHETIC) model in the host page.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { axe, expect, noHorizontalOverflow, openState, repoRoot, sha256, test, viewer, waitStatus, getState } from "./common.mjs";

test.describe("F01 open and view a model", () => {
  test("F01-H1 contract fixture loads read-only: demonstration label, Visual concept, relative scale only (no mm)", async ({ page }) => {
    const before = sha256(readFileSync(join(repoRoot(), "docs/creative/fixtures/SYNTHETIC-box-not-scenario-generated.glb")));
    expect(before).toBe("e2bec10b7995124700de3c8d73b9219671f6e9ebd90c124aa18f482636403b71");
    await openState(page, "loaded");
    await waitStatus(page, "ready");
    const v = viewer(page);
    await expect(v.getByRole("note").filter({ hasText: "Demonstration asset, synthetic fixture, not a generated result" })).toBeVisible();
    await expect(v.getByText("Visual concept", { exact: true })).toBeVisible();
    await expect(v.getByText("Relative scale, not measured · W:H:D 0.50 : 1.00 : 0.30")).toBeVisible();
    await expect(v.getByRole("img", { name: "Interactive 3D preview" })).toBeVisible();
    const text = await v.innerText();
    expect(text).not.toMatch(/\d\s?mm\b|millimet|manufactur|editable panel/i);
    const s = await getState(page);
    expect(s.model.meshCount).toBe(1);
    expect(s.model.proportions.ratioLabel).toContain("0.50 : 1.00 : 0.30");
    expect(sha256(readFileSync(join(repoRoot(), "docs/creative/fixtures/SYNTHETIC-box-not-scenario-generated.glb")))).toBe(before);
    await noHorizontalOverflow(page);
    await axe(page, "loaded");
  });

  test("F01-H2 embedded PNG texture is decoded and applied (r128 global three)", async ({ page }) => {
    await openState(page, "textured");
    await waitStatus(page, "ready");
    const s = await getState(page);
    expect(s.model.textures).toEqual({ declared: 1, loaded: 1 });
    expect(s.model.warnings).toEqual([]);
    expect(s.capabilities.threeRevision).toBe(128);
    await expect(viewer(page).getByText("Some textures in this file couldn't be loaded")).toBeHidden();
    // the canvas really shows the checker texture: two clearly different texel colours in the centre band
    // (a WebGL canvas without preserveDrawingBuffer cannot be read back, so read a screenshot of it)
    const png = (await viewer(page).getByRole("img", { name: "Interactive 3D preview" }).screenshot()).toString("base64");
    const colours = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const g = document.createElement("canvas");
      g.width = img.width;
      g.height = img.height;
      const ctx = g.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const set = new Set();
      const d = ctx.getImageData(0, Math.floor(img.height / 2), img.width, 1).data;
      for (let i = 0; i < d.length; i += 4) set.add(`${d[i] >> 5},${d[i + 1] >> 5},${d[i + 2] >> 5}`);
      return set.size;
    }, png);
    expect(colours).toBeGreaterThan(3);
    await axe(page, "textured");
  });

  test("F01-E1 missing texture: model still shown, honest note, download still offered", async ({ page }) => {
    await openState(page, "texture-missing");
    await waitStatus(page, "ready");
    const v = viewer(page);
    await expect(v.getByRole("note").filter({ hasText: "Some textures in this file couldn't be loaded, so the model is shown without them." })).toBeVisible();
    await expect(v.getByRole("button", { name: "Download file" })).toBeVisible();
    expect((await getState(page)).model.textures).toEqual({ declared: 1, loaded: 0 });
    await axe(page, "texture-missing");
  });

  test("F01-E2 loading (slow network): role=status progress, no download, no controls", async ({ page }) => {
    await openState(page, "loading");
    const status = viewer(page).getByRole("status");
    await expect(status).toContainText(/Loading model…/);
    await expect(viewer(page).getByRole("button", { name: "Download file" })).toBeHidden();
    await expect(viewer(page).getByRole("group", { name: "3D view controls" })).toBeHidden();
    await noHorizontalOverflow(page);
    await axe(page, "loading");
  });

  test("F01-E3 idle: nothing loaded, no download offered", async ({ page }) => {
    await openState(page, "idle");
    await expect(viewer(page).getByRole("button", { name: "Download file" })).toBeHidden();
    expect((await getState(page)).status).toBe("idle");
    await axe(page, "idle");
  });
});
