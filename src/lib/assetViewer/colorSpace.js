/**
 * Colour-management helpers that work across three.js generations by
 * FEATURE DETECTION (no version pinning, no import of three):
 *   - r152+  : texture.colorSpace / renderer.outputColorSpace ("srgb")
 *   - r128.. : texture.encoding   / renderer.outputEncoding (THREE.sRGBEncoding)
 *
 * Only colour-data slots are sRGB. Normal/roughness/metalness/AO/etc. stay
 * linear and are never touched.
 */
export const SRGB_TEXTURE_SLOTS = /* @__PURE__ */ Object.freeze(["map", "emissiveMap", "sheenColorMap", "specularColorMap"]);

export function threeRevision(three) {
  const r = parseInt(String((three && three.REVISION) || "0"), 10);
  return Number.isFinite(r) ? r : 0;
}

export function colorManagementMode(three, texture) {
  if (texture ? "colorSpace" in texture : three && three.SRGBColorSpace !== undefined) return "colorSpace";
  if (three && three.sRGBEncoding !== undefined) return "encoding";
  return "none";
}

/** Marks a colour texture as sRGB. Returns true when it changed something. */
export function markTextureSRGB(three, texture) {
  if (!texture || !texture.isTexture) return false;
  let changed = false;
  if ("colorSpace" in texture) {
    const target = (three && three.SRGBColorSpace) || "srgb";
    if (texture.colorSpace !== target) {
      texture.colorSpace = target;
      changed = true;
    }
  } else if (three && three.sRGBEncoding !== undefined) {
    if (texture.encoding !== three.sRGBEncoding) {
      texture.encoding = three.sRGBEncoding;
      changed = true;
    }
  }
  if (changed && texture.image) texture.needsUpdate = true;
  return changed;
}

export function isTextureSRGB(three, texture) {
  if (!texture) return false;
  if ("colorSpace" in texture) return texture.colorSpace === ((three && three.SRGBColorSpace) || "srgb");
  return three && three.sRGBEncoding !== undefined && texture.encoding === three.sRGBEncoding;
}

/** Walks a loaded model and makes every colour slot sRGB (idempotent). */
export function enforceColorTexturesSRGB(three, root) {
  const seen = new Set();
  let total = 0;
  let srgb = 0;
  root.traverse((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      for (const slot of SRGB_TEXTURE_SLOTS) {
        const t = m[slot];
        if (!t || !t.isTexture || seen.has(t)) continue;
        seen.add(t);
        markTextureSRGB(three, t);
        total++;
        if (isTextureSRGB(three, t)) srgb++;
      }
    }
  });
  return { colorTextures: total, colorTexturesSRGB: srgb };
}

export function configureRendererOutput(three, renderer) {
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = three.SRGBColorSpace || "srgb";
  } else if (three.sRGBEncoding !== undefined) {
    renderer.outputEncoding = three.sRGBEncoding;
  }
  if (three.ACESFilmicToneMapping !== undefined) {
    renderer.toneMapping = three.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
}

/**
 * r155+ dropped "legacy" light units; the same visual result then needs
 * intensities multiplied by PI. r128..r154 (legacy by default) use 1.
 */
export function lightIntensityScale(three, renderer) {
  if (renderer && renderer.useLegacyLights === false) return Math.PI;
  if (renderer && renderer.useLegacyLights === true) return 1;
  return threeRevision(three) >= 155 ? Math.PI : 1;
}
