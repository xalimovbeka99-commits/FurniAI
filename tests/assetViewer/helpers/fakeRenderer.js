/**
 * WebGL-free stand-in for THREE.WebGLRenderer that reproduces how the real
 * renderer maintains `info.memory`: a geometry/texture is counted when it is
 * first used by render(), and un-counted only when its own "dispose" event
 * fires (exactly what WebGLGeometries / WebGLTextures listen to). So
 * `info.memory.geometries === 0` after clear()/replace genuinely proves the
 * viewer called dispose() on everything it had shown.
 */
const TEXTURE_KEYS_SKIP = new Set(["uuid", "name", "type", "userData"]);

export function createFakeRenderer(doc, { revision = 166 } = {}) {
  const geometries = new Set();
  const textures = new Set();
  const info = { memory: { geometries: 0, textures: 0 }, render: { frames: 0 } };
  const track = (set, res, key) => {
    if (set.has(res)) return;
    set.add(res);
    info.memory[key] = set.size;
    const onDispose = () => {
      res.removeEventListener("dispose", onDispose);
      set.delete(res);
      info.memory[key] = set.size;
    };
    res.addEventListener("dispose", onDispose);
  };
  const renderer = {
    domElement: doc.createElement("canvas"),
    info,
    calls: { dispose: 0, forceContextLoss: 0, setSize: [] },
    toneMapping: 0,
    toneMappingExposure: 1,
    setPixelRatio() {},
    setSize(w, h) {
      this.calls.setSize.push([w, h]);
    },
    getContext() {
      return {};
    },
    render(scene) {
      info.render.frames++;
      scene.traverseVisible((o) => {
        if (o.geometry) track(geometries, o.geometry, "geometries");
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          for (const k of Object.keys(m)) {
            if (TEXTURE_KEYS_SKIP.has(k)) continue;
            const v = m[k];
            if (v && v.isTexture) track(textures, v, "textures");
          }
        }
      });
      if (scene.environment && scene.environment.isTexture) track(textures, scene.environment, "textures");
    },
    dispose() {
      this.calls.dispose++;
    },
    forceContextLoss() {
      this.calls.forceContextLoss++;
    },
  };
  if (revision >= 152) renderer.outputColorSpace = "srgb-linear";
  else renderer.outputEncoding = 3000;
  return renderer;
}

/** OrbitControls stand-in (real OrbitControls needs real pointer events). */
export function createFakeOrbitControlsClass(THREE) {
  return class FakeOrbitControls {
    static instances = [];
    constructor(camera, domElement) {
      this.object = camera;
      this.domElement = domElement;
      this.target = new THREE.Vector3();
      this.enableDamping = false;
      this.minDistance = 0;
      this.maxDistance = Infinity;
      this.listeners = {};
      this.disposed = 0;
      this.updates = 0;
      FakeOrbitControls.instances.push(this);
    }
    addEventListener(t, fn) {
      (this.listeners[t] ||= new Set()).add(fn);
    }
    removeEventListener(t, fn) {
      this.listeners[t] && this.listeners[t].delete(fn);
    }
    update() {
      this.updates++;
      this.object.lookAt(this.target);
      return false;
    }
    dispose() {
      this.disposed++;
    }
    /** test helper: orbit the camera around target by azimuth radians */
    orbit(azimuth) {
      const offset = this.object.position.clone().sub(this.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuth);
      this.object.position.copy(this.target).add(offset);
    }
    dolly(factor) {
      const offset = this.object.position.clone().sub(this.target).multiplyScalar(factor);
      this.object.position.copy(this.target).add(offset);
    }
  };
}
