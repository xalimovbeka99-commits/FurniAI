"use client";

/**
 * LocalEnvironment — replaces drei's <Environment preset="apartment" />.
 *
 * That preset fetches lebombo_1k.hdr from a remote CDN
 * (raw.githack.com/pmndrs/drei-assets) via React Suspense; a rejected fetch
 * throws past Suspense into the nearest error boundary, and /builder has
 * none above this point, so Next.js showed its fatal page-load error and
 * the whole configurator disappeared — not just the reflections.
 *
 * three.js ships RoomEnvironment (three/examples/jsm/environments) as a
 * small procedural Scene: no file to fetch, no promise to reject, so there
 * is nothing here for a blocked/offline network to break. PMREMGenerator
 * converts it into the same kind of environment map preset="apartment"
 * would have produced, for the same soft interior reflections.
 */
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function LocalEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const pmrem = useMemo(() => new PMREMGenerator(gl), [gl]);
  const envTexture = useMemo(
    () => pmrem.fromScene(new RoomEnvironment(), 0.04).texture,
    [pmrem]
  );

  useEffect(() => {
    // scene is a mutable three.js Object3D from useThree, not React state —
    // this is the same direct-mutation pattern drei's own <Environment> uses.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = envTexture;
    return () => {
      if (scene.environment === envTexture) scene.environment = null;
      envTexture.dispose();
      pmrem.dispose();
    };
  }, [scene, envTexture, pmrem]);

  return null;
}
