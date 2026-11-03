import * as THREE from "three";
import { createStarGeometry } from "./geometry.js";
import {
  MB_LAYOUT,
  createLedMGeometry,
  createLedBGeometry,
  createNotchStarGeometry,
  createLedMaterials,
} from "./ledM.js";

// The "MB" word is ~5.75 units wide vs 3 for the old lone M, so shrink to fit.
// Tweak this if the word looks too big/small in frame.
const WORD_FIT = 0.55;
import { glowVertex, glowFragment } from "./shaders.js";
import { LOOK } from "../config.js";

/** Chrome star (scene 1), LED dot-matrix M with stars (scene 2) and the light they live in. */
export class HeroObjects {
  // renderer is optional, only used to get max anisotropy for the dot textures
  constructor(envMap, renderer) {
    const chrome = (rough) =>
      new THREE.MeshPhysicalMaterial({
        color: 0xc4ccd8,
        metalness: 1,
        roughness: rough,
        clearcoat: 0.25,
        clearcoatRoughness: 0.25,
        envMap,
        envMapIntensity: 0.42,
      });

    // --- scene 1: chrome star ---
    this.starGeo = createStarGeometry({
      outer: LOOK.starRadius,
      inner: LOOK.starRadius * 0.42,
      height: LOOK.starRadius * 0.34,
    });
    this.starMat = chrome(0.16);
    this.star = new THREE.Mesh(this.starGeo, this.starMat);

    // --- scene 2: LED dot-matrix M with star cut-outs + notch star ---
    const { materials, textures } = createLedMaterials({
      envMap,
      renderer,
      cellSize: 0.06,
    });
    this.mMats = materials; // [front/back LED, sides chrome]
    this.ledTextures = textures; // { glow, normal }

    const s = LOOK.mScale * WORD_FIT;
    const depth = LOOK.mDepth;
    this.mGeo = createLedMGeometry({ scale: s, depth, x: MB_LAYOUT.mx });
    this.bGeo = createLedBGeometry({ scale: s, depth, x: MB_LAYOUT.bx });
    this.mStarGeo = createNotchStarGeometry({
      scale: s,
      depth,
      cx: MB_LAYOUT.mCenter,
    });

    this.m = new THREE.Group(); // the whole "MB" word
    this.m.add(new THREE.Mesh(this.mGeo, this.mMats));
    this.m.add(new THREE.Mesh(this.bGeo, this.mMats));
    this.m.add(new THREE.Mesh(this.mStarGeo, this.mMats));

    // --- glow sprite ---
    this.glowUniforms = { uIntensity: { value: 0 }, uScale: { value: 0.3 } };
    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: this.glowUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.glowGeo = new THREE.PlaneGeometry(9, 9);
    this.glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    this.glow.position.z = -0.4;
    this.glow.renderOrder = 1;

    // key (white, sweeps), cool-blue rim, soft fill
    this.key = new THREE.DirectionalLight(0xfff6ec, 1.0);
    this.rim = new THREE.DirectionalLight(0x7fb0ff, 1.3);
    this.rim.position.set(4, -1, 3);
    this.fill = new THREE.AmbientLight(0x101826, 0.35);

    this.group = new THREE.Group();
    this.group.add(this.star, this.m, this.glow, this.key, this.rim, this.fill);
  }

  update(S) {
    this.star.visible = S.starVis > 0.5 && S.starScale > 0.002;
    this.star.position.set(0, 0, S.starZ);
    this.star.scale.setScalar(Math.max(S.starScale, 0.0001));
    this.star.rotation.set(0.38, S.starRotY, S.starRotZ, "YXZ");

    this.m.visible = S.mVis > 0.5;
    this.m.scale.setScalar(Math.max(S.mScale, 0.0001));
    this.m.rotation.set(0, S.mRotY, 0);

    // optional: LED "scan" shimmer, uncomment if you want it
    // this.ledTextures.glow.offset.y += 0.0004;

    this.glowUniforms.uIntensity.value = S.glow;
    this.glowUniforms.uScale.value = S.glowScale;
    this.key.position.set(S.keyX, 2.4, 3.6);
  }

  dispose() {
    [
      this.starGeo,
      this.mGeo,
      this.bGeo,
      this.mStarGeo,
      this.glowGeo,
      this.starMat,
      this.glowMat,
      ...this.mMats,
      this.ledTextures.glow,
      this.ledTextures.normal,
    ].forEach((d) => d.dispose());
  }
}