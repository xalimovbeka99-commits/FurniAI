/**
 * GPU-resource disposal for a loaded model subtree. Every geometry,
 * material, and texture in EVERY material slot (including ShaderMaterial
 * uniforms) is disposed exactly once; skeleton bone textures and decoded
 * ImageBitmaps are released too.
 */
function texturesOfMaterial(material, out) {
  for (const key of Object.keys(material)) {
    const v = material[key];
    if (v && v.isTexture) out.add(v);
  }
  if (material.uniforms) {
    for (const u of Object.values(material.uniforms)) {
      const v = u && u.value;
      if (v && v.isTexture) out.add(v);
      else if (Array.isArray(v)) v.forEach((t) => t && t.isTexture && out.add(t));
    }
  }
}

export function collectResources(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  if (!root) return { geometries, materials, textures, skeletons };
  root.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === "function") geometries.add(obj.geometry);
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      if (!m) continue;
      materials.add(m);
      texturesOfMaterial(m, textures);
    }
    if (obj.skeleton) skeletons.add(obj.skeleton);
  });
  return { geometries, materials, textures, skeletons };
}

function releaseImage(texture) {
  const img = (texture.source && texture.source.data) || texture.image;
  // ImageBitmap (GLTFLoader's ImageBitmapLoader path) holds decoded memory until close().
  if (img && typeof img.close === "function" && img.tagName === undefined) {
    try {
      img.close();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Detaches `root` from its parent and disposes everything under it. */
export function disposeObject3D(root) {
  const counts = { geometries: 0, materials: 0, textures: 0, skeletons: 0, imageBitmaps: 0 };
  if (!root) return counts;
  if (root.parent && typeof root.parent.remove === "function") root.parent.remove(root);
  const { geometries, materials, textures, skeletons } = collectResources(root);
  for (const g of geometries) {
    g.dispose();
    counts.geometries++;
  }
  for (const t of textures) {
    t.dispose();
    counts.textures++;
    if (releaseImage(t)) counts.imageBitmaps++;
  }
  for (const m of materials) {
    if (typeof m.dispose === "function") m.dispose();
    counts.materials++;
  }
  for (const s of skeletons) {
    if (typeof s.dispose === "function") s.dispose();
    counts.skeletons++;
  }
  return counts;
}
