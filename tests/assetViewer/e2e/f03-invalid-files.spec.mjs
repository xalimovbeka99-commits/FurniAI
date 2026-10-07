// F03 invalid files: honest, specific messages; no Retry, no Download, nothing rendered.
import { axe, EXPECTED, expect, getState, noHorizontalOverflow, openState, test, viewer, waitStatus } from "./common.mjs";

const CASES = [
  ["bad-magic", "PARSE_FAILED", "This file isn't a valid 3D model file."],
  ["html-as", "PARSE_FAILED", "The link returned a web page instead of a 3D model file."],
  ["truncated", "PARSE_FAILED", "The model file is incomplete. It may have been cut off while downloading."],
  ["no-mesh", "EMPTY_SCENE", "The model file opened, but it doesn't contain anything to show."],
];

test.describe("F03 invalid files", () => {
  // truncated.glb still declares a texture whose bytes are cut off; GLTFLoader logs that before failing.
  test.use({ allowConsole: { patterns: [EXPECTED.gltfTexture] } });
  for (const [file, code, message] of CASES) {
    test(`F03-N ${file}.glb -> ${code}: role=alert with "${message}", no Try again, no Download`, async ({ page }) => {
      await openState(page, `invalid&file=${file}`);
      await waitStatus(page, "error");
      const v = viewer(page);
      await expect(v.getByRole("alert")).toHaveText(message);
      await expect(v.getByRole("button", { name: "Try again" })).toBeHidden();
      await expect(v.getByRole("button", { name: "Download file" })).toBeHidden();
      await expect(v.getByRole("group", { name: "3D view controls" })).toBeHidden();
      const s = await getState(page);
      expect(s.error.code).toBe(code);
      expect(s.model).toBeNull();
      await noHorizontalOverflow(page);
      await axe(page, `invalid ${file}`);
    });
  }
});
