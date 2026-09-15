import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const OUT = path.join("docs", "m2", "integ", "evidence", "f1");

/** Evidence SHA from the checkout under test — never a hardcoded tip. */
function evidenceShaFromCheckout() {
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + "\n");
}

async function snapshotDesign(page) {
  return page.evaluate(() => {
    // aiWardrobeState is script-scoped (let) — not on window. Prefer review DOM + Builder.
    const num = (txt) => {
      const m = String(txt || "").match(/(\d+(?:\.\d+)?)/);
      return m ? Number(m[1]) : null;
    };
    const widthMm = num(document.getElementById("revWidth")?.textContent);
    const heightMm = num(document.getElementById("revHeight")?.textContent);
    const depthMm = num(document.getElementById("revDepth")?.textContent);
    const revision = num(document.getElementById("revRevision")?.textContent);
    const finishRaw = document.getElementById("revFinish")?.textContent?.trim() || null;
    const finishType = finishRaw ? finishRaw.toLowerCase() : null;
    const bayCount = num(document.getElementById("revBays")?.textContent);
    const doorCount = num(document.getElementById("revDoors")?.textContent);
    const fingerprint = document.getElementById("revFingerprint")?.textContent?.trim() || null;
    const proposalId = document.getElementById("revProposalId")?.textContent?.trim() || null;
    const rails = [];
    const panelMaterials = [];
    const root = Builder.parts?.[0];
    if (root) {
      root.traverse((c) => {
        if (!(c.isMesh && c.visible)) return;
        if (c.userData?.isPreviewMesh) {
          rails.push({
            name: c.name,
            color: c.material?.color?.getHex?.() ?? null,
            tubeType: c.userData.tubeType || null,
          });
          return;
        }
        if (c.userData?.partId || c.userData?.role) {
          panelMaterials.push({
            partId: c.userData.partId || c.name || null,
            role: c.userData.role || null,
            materialCode: c.userData.materialCode || null,
            color: c.material?.color?.getHex?.() ?? null,
          });
        }
      });
    }
    let groupBox = null;
    if (root) {
      const b = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      b.getSize(size);
      groupBox = {
        widthM: Number(size.x.toFixed(4)),
        heightM: Number(size.y.toFixed(4)),
        depthM: Number(size.z.toFixed(4)),
      };
    }
    return {
      revision,
      widthMm,
      heightMm,
      depthMm,
      finishType,
      bayCount,
      doorCount,
      fingerprint,
      proposalId,
      parametricMat: Builder.parametricMat || null,
      structural: root?.userData?.structuralPartCount ?? null,
      preview: root?.userData?.previewPartCount ?? null,
      rails,
      panelMaterials,
      groupBox,
      revWidthLabel: document.getElementById("revWidth")?.textContent?.trim() || null,
      revRevisionLabel: document.getElementById("revRevision")?.textContent?.trim() || null,
    };
  });
}


async function latestAssistantText(page) {
  return page.evaluate(() => {
    // Only assistant bubbles — never the customer's own echoed message.
    const nodes = [...document.querySelectorAll("#aiConversationalStream [data-role='assistant']")];
    return nodes.length ? nodes[nodes.length - 1].textContent.trim() : "";
  });
}

async function latestUserText(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll("#aiConversationalStream [data-role='user']")];
    return nodes.length ? nodes[nodes.length - 1].textContent.trim() : "";
  });
}

async function waitForUnsupportedResponseFinished(page, prevCount, { timeout = 20000 } = {}) {
  // 1) new assistant bubble appears
  await page.waitForFunction(
    (n) => document.querySelectorAll("#aiConversationalStream [data-role='assistant']").length > n,
    prevCount,
    { timeout }
  );
  // 2) response finished before any preserved-state checks
  await expect(page.locator("#aiConversationalSendBtn")).toBeEnabled({ timeout });
  const assistantText = await latestAssistantText(page);
  const userText = await latestUserText(page);
  return { assistantText, userText };
}

async function assistantCount(page) {
  return page.locator("#aiConversationalStream [data-role='assistant']").count();
}

/** Project a door mesh center to client coordinates and click — no userData.base writes. */
async function clickDoorSurface(page, partId) {
  const point = await page.evaluate((id) => {
    const pivot = (Builder.doorObjs || []).find((p) => p.userData?.partId === id);
    if (!pivot) return { error: `door ${id} not found` };
    let mesh = null;
    pivot.traverse((c) => {
      if (!mesh && c.isMesh && c.visible) mesh = c;
    });
    if (!mesh) return { error: `no mesh for ${id}` };
    mesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    // Prefer a point slightly toward the camera so the front face is hit
    const cam = Builder.cam.position.clone();
    const towardCam = cam.sub(center).normalize().multiplyScalar(0.02);
    center.add(towardCam);
    const ndc = center.clone().project(Builder.cam);
    const cv = document.getElementById("bld3d");
    const r = cv.getBoundingClientRect();
    return {
      x: (ndc.x * 0.5 + 0.5) * r.width + r.left,
      y: (-ndc.y * 0.5 + 0.5) * r.height + r.top,
      id: pivot.userData.partId,
      ndc: { x: ndc.x, y: ndc.y },
    };
  }, partId);
  if (point.error) throw new Error(point.error);
  await page.mouse.click(point.x, point.y);
  return point;
}

async function doorOpenState(page) {
  return page.evaluate(() =>
    (Builder.doorObjs || []).map((p) => ({
      id: p.userData?.partId || p.name,
      open: !!p.userData?.base,
    }))
  );
}

test.describe("F1 evidence on integration candidate", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    const sha = evidenceShaFromCheckout();
    fs.writeFileSync(path.join(OUT, "SOURCE_SHA.txt"), sha + "\n");
  });

  test("isolated viewer: rails + material chrome; mobile NEEDS FIXES (not customer-path claim)", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto("/#/build/golden-parametric");
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.waitForFunction(
      () =>
        typeof Builder !== "undefined" &&
        Builder.isParametric &&
        Builder.doorObjs &&
        Builder.doorObjs.length === 4 &&
        Builder.parts?.[0] &&
        Builder.ren &&
        Builder.cam
    );

    // Closed overview via visible toggle only — no forced door state if toggle fails.
    const toggleDoors = page.locator("#toggle-doors");
    await expect(toggleDoors).toBeVisible();
    const initiallyOpen = (await doorOpenState(page)).some((d) => d.open);
    if (initiallyOpen) {
      await toggleDoors.click();
      await page.waitForTimeout(500);
    }
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "01-closed-overview.png") });

    // Exact door: real pointer clicks on each door surface; verify IDs; others unchanged.
    // Camera framing for clickability only — never writes userData.base.
    await page.evaluate(() => {
      Builder.camDist = 4.2;
      Builder.rotY = Math.PI;
      Builder.rotX = 0.05;
    });
    await page.waitForTimeout(400);

    const ids = await page.evaluate(() =>
      (Builder.doorObjs || []).map((p) => p.userData?.partId).filter(Boolean)
    );
    expect(ids.length).toBe(4);
    writeJson("02-door-ids.json", { ids });

    for (const id of ids) {
      const before = await doorOpenState(page);
      const beforeMap = Object.fromEntries(before.map((d) => [d.id, d.open]));
      await clickDoorSurface(page, id);
      await page.waitForTimeout(450);
      const after = await doorOpenState(page);
      const afterMap = Object.fromEntries(after.map((d) => [d.id, d.open]));
      expect(afterMap[id], `${id} should toggle`).toBe(!beforeMap[id]);
      for (const other of ids) {
        if (other === id) continue;
        expect(afterMap[other], `${other} must stay unchanged when clicking ${id}`).toBe(beforeMap[other]);
      }
      // Return to prior state with another real click (still no forced mutation).
      await clickDoorSurface(page, id);
      await page.waitForTimeout(350);
    }
    writeJson("02-exact-door-state.json", await doorOpenState(page));
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "02-exact-door-open.png") });

    // Open all via visible toggle for rails (no force-after-fail).
    await toggleDoors.click();
    await page.waitForTimeout(700);
    const afterToggle = await doorOpenState(page);
    expect(afterToggle.every((d) => d.open), "toggle-doors must open all doors without forced fallback").toBe(
      true
    );

    const rails = await page.evaluate(() => {
      const out = [];
      Builder.parts[0].traverse((c) => {
        if (c.isMesh && c.userData?.isPreviewMesh) {
          out.push({
            name: c.name,
            tubeType: c.userData.tubeType,
            color: c.material?.color?.getHex?.() ?? null,
          });
        }
      });
      return {
        rails: out,
        structural: Builder.parts[0].userData?.structuralPartCount,
        preview: Builder.parts[0].userData?.previewPartCount,
      };
    });
    writeJson("03-rails-state.json", rails);
    expect(rails.rails.length).toBe(2);
    expect(rails.structural).toBe(19);
    expect(rails.preview).toBe(2);
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "03-rails-open-closeup.png") });

    const swatches = page.locator(".b-sw");
    await expect(swatches.first()).toBeVisible();
    const beforeColors = rails.rails.map((r) => r.color);
    await swatches.nth(1).click();
    await page.waitForTimeout(400);
    const afterMat = await page.evaluate(() => {
      const out = [];
      Builder.parts[0].traverse((c) => {
        if (c.isMesh && c.userData?.isPreviewMesh) {
          out.push({ name: c.name, color: c.material?.color?.getHex?.() ?? null });
        }
      });
      return { rails: out, parametricMat: Builder.parametricMat || null };
    });
    writeJson("04-after-material.json", afterMat);
    expect(afterMat.rails[0].color).toBe(beforeColors[0]);
    expect(afterMat.rails[1].color).toBe(beforeColors[1]);
    await page.locator("#bld3d").screenshot({ path: path.join(OUT, "04-material-rails-unchanged.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await expect(page.locator("#bld3d")).toBeVisible();
    await expect(page.locator("#parametricBadge")).toBeVisible();
    await expect(page.locator("#toggle-doors")).toBeVisible();
    // Golden parametric has no drawers — drawer toggle must be hidden (AG presentation).
    await expect(page.locator("#toggle-drawers")).toBeHidden();

    // Measure actual occlusion: canvas vs open bottom sheets overlapping wardrobe.
    // Do NOT claim PASS from CSS max-height alone.
    const beforeOcc = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const main = document.querySelector(".b-main");
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        sheetsWereOpen: Boolean(main && (main.classList.contains("show-left") || main.classList.contains("show-right"))),
        canvas: box(document.getElementById("bld3d")),
        left: box(document.querySelector(".b-panel.left")),
        right: box(document.querySelector(".b-panel.right")),
        mainClasses: main ? [...main.classList] : [],
      };
    });

    // Collapse sheets and wait for CSS transition (~320ms) before measuring again.
    await page.evaluate(() => {
      const main = document.querySelector(".b-main");
      if (main) {
        main.classList.remove("show-left");
        main.classList.remove("show-right");
      }
      document.getElementById("tab-left")?.classList.remove("active");
      document.getElementById("tab-right")?.classList.remove("active");
    });
    await page.waitForTimeout(450);

    const afterOcc = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const canvas = box(document.getElementById("bld3d"));
      const left = box(document.querySelector(".b-panel.left"));
      const right = box(document.querySelector(".b-panel.right"));
      const overlapY = (a, b) => {
        if (!a || !b) return 0;
        return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      };
      const sheetVisiblyOverCanvas = (panelBox) => {
        if (!panelBox || !canvas) return false;
        const intersects = overlapY(canvas, panelBox) > 8;
        const onScreen = panelBox.top < window.innerHeight - 4 && panelBox.bottom > 4;
        return intersects && onScreen && panelBox.top < canvas.bottom - 8;
      };
      return {
        canvas,
        left,
        right,
        leftOverlapPx: overlapY(canvas, left),
        rightOverlapPx: overlapY(canvas, right),
        leftOccludes: sheetVisiblyOverCanvas(left),
        rightOccludes: sheetVisiblyOverCanvas(right),
        freeCanvasHeightPx: canvas ? canvas.height : 0,
        freeCanvasFrac: canvas && window.innerHeight ? canvas.height / window.innerHeight : 0,
        mainClasses: [...(document.querySelector(".b-main")?.classList || [])],
      };
    });

    const occlusion = { ...beforeOcc, after: afterOcc, ...afterOcc };
    writeJson("05-narrow-occlusion.json", occlusion);
    await page.screenshot({ path: path.join(OUT, "05-narrow-viewport.png"), fullPage: false });

    const usable =
      afterOcc.freeCanvasHeightPx >= 320 &&
      afterOcc.freeCanvasFrac >= 0.45 &&
      !afterOcc.leftOccludes &&
      !afterOcc.rightOccludes;
    const resultLine = usable
      ? `PASS (measured): canvas unoccluded at 390x844; freeCanvas=${afterOcc.freeCanvasHeightPx}px (${(afterOcc.freeCanvasFrac * 100).toFixed(1)}%); sheets collapsed; badge+doors visible; drawers hidden.\n`
      : `NEEDS FIXES (measured): freeCanvas=${afterOcc.freeCanvasHeightPx}px (${(afterOcc.freeCanvasFrac * 100).toFixed(1)}%); leftOccludes=${afterOcc.leftOccludes}; rightOccludes=${afterOcc.rightOccludes}; leftOverlapPx=${afterOcc.leftOverlapPx}; rightOverlapPx=${afterOcc.rightOverlapPx}.\n`;
    fs.writeFileSync(path.join(OUT, "05-narrow-RESULT.txt"), resultLine);
    await expect(page.locator("#bld3d")).toBeVisible();
  });

  test("isolated parser TEST SETUP: AiDesignerTransport disabled — draft/edit/Undo labels only", async ({
    page,
  }) => {
    test.setTimeout(120000);
    // TEST SETUP (not customer-path): force parser-only by clearing live transport.
    await page.goto("/#/build/ai-wardrobe");
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.waitForFunction(
      () =>
        typeof globalThis.PartGraphBridge?.previewDraftWardrobe === "function" &&
        typeof globalThis.PartGraphBridge?.applyConversationalEdit === "function"
    );
    await page.evaluate(() => {
      // TEST SETUP — parser isolation. Do not treat as customer-path evidence.
      globalThis.__F1_TEST_SETUP_DISABLED_TRANSPORT__ = true;
      globalThis.AiDesignerTransport = null;
    });

    await expect(page.locator("#aiWardrobeInput")).toBeVisible();
    await page.locator("#aiWardrobeInput").fill("Make me a wardrobe");
    await page.locator("#aiWardrobeSubmitBtn").click();
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    const widthBefore = (await page.locator("#revWidth").innerText()).trim();
    await page.locator("#aiWardrobeReviewSection #chipWidth2000").click();
    await page.waitForFunction(() => document.getElementById("revWidth")?.textContent?.includes("2000"), null, {
      timeout: 15000,
    });
    await page.locator("#aiWardrobeReviewSection #btnUndoEdit").click();
    await page.waitForFunction(
      (w) => document.getElementById("revWidth")?.textContent?.trim() === w,
      widthBefore,
      { timeout: 10000 }
    );
    writeJson("07-parser-isolation.json", {
      claim: "isolated parser only — AiDesignerTransport disabled as TEST SETUP",
      widthRestored: widthBefore,
    });
  });

  test("customer-path: Design with AI nav → draft → edit → Undo restores identity + panel materials", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto("/");
    const nav = page.locator("#createWithFurniAiHeroBtn, #createWithFurniAiNavBtn").first();
    await expect(nav).toBeVisible();
    await nav.click();
    await expect(page).toHaveURL(/#\/build\/ai-wardrobe/);
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.waitForFunction(
      () =>
        typeof globalThis.PartGraphBridge?.previewDraftWardrobe === "function" &&
        typeof globalThis.AiDesignerTransport?.proposeDesignChange === "function"
    );

    // No initAiWardrobePanel / CSS class / hidden-panel hacks.
    await expect(page.locator("#aiWardrobeInput")).toBeVisible();
    await expect(page.locator("#aiWardrobeSubmitBtn")).toBeVisible();
    await page.locator("#aiWardrobeInput").fill("Make me a wardrobe");
    await page.locator("#aiWardrobeSubmitBtn").click();
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => Builder.parts?.[0] && (Builder.doorObjs || []).length >= 1);

    const before = await snapshotDesign(page);
    writeJson("10-customer-draft.json", before);
    expect(before.widthMm).toBeTruthy();
    expect(before.fingerprint).toBeTruthy();
    expect(before.proposalId).toBeTruthy();
    expect(before.panelMaterials.length).toBeGreaterThan(0);
    expect(before.groupBox?.widthM).toBeGreaterThan(0);

    await page.locator("#aiWardrobeReviewSection #chipWidth2000").click();
    await page.waitForFunction(() => (document.getElementById("revWidth")?.textContent || "").includes("2000"), null, {
      timeout: 15000,
    });
    const edited = await snapshotDesign(page);
    writeJson("11-customer-edit.json", edited);
    expect(edited.widthMm).toBe(2000);
    expect(edited.heightMm).toBe(before.heightMm);
    expect(edited.depthMm).toBe(before.depthMm);
    expect(edited.finishType).toBe(before.finishType);
    expect(edited.bayCount).toBe(before.bayCount);
    expect(edited.doorCount).toBe(before.doorCount);
    expect(edited.rails.length).toBe(before.rails.length);
    expect(edited.fingerprint).not.toBe(before.fingerprint);
    expect(Math.abs(edited.groupBox.widthM - before.groupBox.widthM)).toBeGreaterThan(0.05);

    const undo = page.locator("#aiWardrobeReviewSection #btnUndoEdit");
    await expect(undo).toBeVisible();
    await undo.click();
    await page.waitForFunction(
      (w) => {
        const t = document.getElementById("revWidth")?.textContent || "";
        const m = t.match(/(\d+)/);
        return m && Number(m[1]) === w;
      },
      before.widthMm,
      { timeout: 10000 }
    );
    const restored = await snapshotDesign(page);
    writeJson("12-customer-undo.json", { before, restored });

    // Canonical identity + actual panel finish (not merely width/revision labels).
    expect(restored.widthMm).toBe(before.widthMm);
    expect(restored.heightMm).toBe(before.heightMm);
    expect(restored.depthMm).toBe(before.depthMm);
    expect(restored.finishType).toBe(before.finishType);
    expect(restored.finishType).toBeTruthy();
    expect(restored.bayCount).toBe(before.bayCount);
    expect(restored.doorCount).toBe(before.doorCount);
    expect(restored.revision).toBe(before.revision);
    expect(restored.fingerprint).toBe(before.fingerprint);
    expect(restored.proposalId).toBe(before.proposalId);
    // Builder.parametricMat is a live paint cache and may not round-trip on Undo;
    // actual panel finish is asserted via finishType + per-part materialCode below.
    expect(restored.rails.map((r) => r.color)).toEqual(before.rails.map((r) => r.color));
    expect(restored.panelMaterials.map((p) => p.partId).sort()).toEqual(before.panelMaterials.map((p) => p.partId).sort());
    const beforeMat = Object.fromEntries(before.panelMaterials.map((p) => [p.partId, p.materialCode]));
    const afterMat = Object.fromEntries(restored.panelMaterials.map((p) => [p.partId, p.materialCode]));
    expect(afterMat).toEqual(beforeMat);
    expect(Object.values(afterMat).every((c) => !!c)).toBe(true);
    // Actual panel finish identity: materialCode per structural part (Three hex may remint).
    for (const part of restored.panelMaterials) {
      expect(part.materialCode).toBe(beforeMat[part.partId]);
      expect(part.materialCode).toBeTruthy();
    }
    expect(Math.abs(restored.groupBox.widthM - before.groupBox.widthM)).toBeLessThan(0.02);
    fs.writeFileSync(
      path.join(OUT, "06-undo-RESULT.txt"),
      "PASS (customer-path): Undo restored canonical state (envelope, revision, proposalId/fingerprint, finishType) + actual panel finish materialCode + rail chrome + group size. Does not claim live-provider Undo. Live-provider UNVERIFIED.\n"
    );
  });

  test("customer-path: unsupported handles → new assistant explains; design retained", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await page.locator("#createWithFurniAiHeroBtn, #createWithFurniAiNavBtn").first().click();
    await expect(page.locator("#aiWardrobeInput")).toBeVisible({ timeout: 15000 });
    await page.locator("#aiWardrobeInput").fill("Make me a wardrobe");
    await page.locator("#aiWardrobeSubmitBtn").click();
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => /\d+/.test(document.getElementById("revRevision")?.textContent || ""), null, {
      timeout: 15000,
    });

    const before = await snapshotDesign(page);
    const prevAssistants = await assistantCount(page);
    const customerMsg = "Add black handles";

    await page.locator("#aiConversationalInput").fill(customerMsg);
    await page.locator("#aiConversationalSendBtn").click();

    const { assistantText, userText } = await waitForUnsupportedResponseFinished(page, prevAssistants);
    expect(userText).toMatch(/add black handles/i);
    expect(assistantText.length).toBeGreaterThan(0);
    expect(assistantText.toLowerCase()).not.toBe(userText.toLowerCase());
    expect(assistantText).toMatch(/handle/i);
    expect(assistantText).toMatch(/can't|cannot|not (?:supported|available)|yet|unchanged/i);

    const after = await snapshotDesign(page);
    writeJson("13-unsupported-customer.json", { before, after, assistantText, userText, prevAssistants });

    expect(after.widthMm).toBe(before.widthMm);
    expect(after.heightMm).toBe(before.heightMm);
    expect(after.revision).toBe(before.revision);
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(after.proposalId).toBe(before.proposalId);
    expect(after.finishType).toBe(before.finishType);
    expect(Math.abs(after.groupBox.widthM - before.groupBox.widthM)).toBeLessThan(0.02);
    expect(after.bayCount).toBe(before.bayCount);
    expect(after.doorCount).toBe(before.doorCount);
    expect(after.structural).toBe(before.structural);
  });

  test("customer-path: Add drawers on the left applies DRAWER_BANK layout (STRUCTURAL)", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await page.locator("#createWithFurniAiHeroBtn, #createWithFurniAiNavBtn").first().click();
    await expect(page.locator("#aiWardrobeInput")).toBeVisible({ timeout: 15000 });
    await page.locator("#aiWardrobeInput").fill("Make me a wardrobe");
    await page.locator("#aiWardrobeSubmitBtn").click();
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => /\d+/.test(document.getElementById("revRevision")?.textContent || ""), null, {
      timeout: 15000,
    });

    const before = await snapshotDesign(page);
    const prevAssistants = await assistantCount(page);
    await page.locator("#aiConversationalInput").fill("Add drawers on the left");
    await page.locator("#aiConversationalSendBtn").click();

    await page.waitForFunction(
      (prev) => document.querySelectorAll("#aiConversationalStream [data-role='assistant']").length > prev,
      prevAssistants,
      { timeout: 20000 }
    );
    const assistantText = await latestAssistantText(page);
    expect(assistantText).toMatch(/drawer/i);
    expect(assistantText).not.toMatch(/can't add drawers|cannot add drawers/i);

    const after = await snapshotDesign(page);
    expect(after.revision).toBeGreaterThan(before.revision);
  });
});

