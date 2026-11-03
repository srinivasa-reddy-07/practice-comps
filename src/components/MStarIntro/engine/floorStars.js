// import * as THREE from 'three';
// import { mulberry32 } from './rng.js';
// import { DUST, LOOK } from '../config.js';

// const vertex = /* glsl */ `
//   attribute vec3 aBase;    // resting spot on the floor bed
//   attribute vec4 aParam;   // x: start delay (0..1), y: rise height, z: size, w: phase
//   uniform float uRise;     // 0..1, driven by GSAP
//   uniform float uAlpha;    // 0..1, fade in on the floor
//   uniform float uTime;
//   uniform float uSway;
//   varying vec2 vUv;
//   varying float vFade;
//   void main() {
//     float t = clamp((uRise - aParam.x) / max(1.0 - aParam.x, 1e-3), 0.0, 1.0);
//     // gentle ease: almost linear, softened at both ends (gradual rise, no sudden acceleration)
//     float e = mix(t, t * t * (3.0 - 2.0 * t), 0.45);
//     vec3 p = aBase;
//     p.y += aParam.y * e;
//     p.x += sin(uTime * (0.8 + aParam.w) + aParam.w * 40.0) * uSway * (0.4 + e);
//     p.z += cos(uTime * 0.6 + aParam.w * 20.0) * uSway * 0.5;
//     vec4 mv = modelViewMatrix * vec4(p, 1.0);
//     mv.xy += position.xy * aParam.z;
//     gl_Position = projectionMatrix * mv;
//     vUv = position.xy;
//     float twinkle = 0.75 + 0.25 * sin(uTime * (2.0 + aParam.w * 3.0) + aParam.w * 60.0);
//     vFade = uAlpha * twinkle * (1.0 - smoothstep(0.7, 1.0, t));
//   }
// `;

// const fragment = /* glsl */ `
//   uniform float uIntensity;
//   varying vec2 vUv;
//   varying float vFade;
//   void main() {
//     float d = length(vUv);
//     float core = pow(clamp(1.0 - d, 0.0, 1.0), 2.5);
//     float cross = max(
//       exp(-abs(vUv.x) * 16.0) * exp(-abs(vUv.y) * 3.0),
//       exp(-abs(vUv.y) * 16.0) * exp(-abs(vUv.x) * 3.0)
//     ) * 0.45;
//     float a = (core + cross) * vFade * uIntensity;
//     if (a < 0.003) discard;
//     gl_FragColor = vec4(vec3(0.86, 0.91, 1.0) * a, a);
//   }
// `;

// /** Sparse floor stars that appear along the bottom and drift up. Independent of the main particle shader. */
// export class FloorStars {
//   constructor(bounds, seed = LOOK.seed) {
//     const N = DUST.count;
//     const rand = mulberry32(seed ^ 0x9e3779b1);
//     const halfH = bounds.halfH;
//     const hw = halfH * DUST.floorHalfWidth;
//     const baseY = -halfH * DUST.floorLevel;
//     const thick = halfH * DUST.floorThickness;

//     const aBase = new Float32Array(N * 3);
//     const aParam = new Float32Array(N * 4);
//     for (let i = 0; i < N; i++) {
//       // stratified across the full width so the bed reads as evenly scattered, not clumped
//       const x = ((i + rand()) / N * 2 - 1) * hw;
//       aBase[i * 3] = x;
//       aBase[i * 3 + 1] = baseY - thick * Math.pow(rand(), 1.5) + 0.06 * Math.sin(x * 1.1 + 1.0);
//       aBase[i * 3 + 2] = (rand() - 0.5) * DUST.floorDepth;
//       aParam[i * 4] = rand() * DUST.maxDelay;
//       aParam[i * 4 + 1] = DUST.riseMin + Math.pow(rand(), 1.4) * (DUST.riseMax - DUST.riseMin);
//       aParam[i * 4 + 2] = DUST.sizeMin + rand() * (DUST.sizeMax - DUST.sizeMin);
//       aParam[i * 4 + 3] = rand();
//     }

//     const base = new THREE.PlaneGeometry(2, 2);
//     const geo = new THREE.InstancedBufferGeometry();
//     geo.index = base.index;
//     geo.setAttribute('position', base.getAttribute('position'));
//     geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(aBase, 3));
//     geo.setAttribute('aParam', new THREE.InstancedBufferAttribute(aParam, 4));
//     geo.instanceCount = N;

//     this.uniforms = {
//       uRise: { value: 0 }, uAlpha: { value: 0 }, uTime: { value: 0 },
//       uSway: { value: DUST.sway }, uIntensity: { value: DUST.intensity },
//     };
//     this.material = new THREE.ShaderMaterial({
//       vertexShader: vertex,
//       fragmentShader: fragment,
//       uniforms: this.uniforms,
//       transparent: true,
//       depthWrite: false,
//       depthTest: false,
//       blending: THREE.AdditiveBlending,
//     });
//     this.mesh = new THREE.Mesh(geo, this.material);
//     this.mesh.frustumCulled = false;
//     this.mesh.renderOrder = 3;
//     this.mesh.visible = false;
//     this.geometry = geo;
//     this._base = base;
//   }

//   update(S, time) {
//     this.mesh.visible = S.dustAlpha > 0.001;
//     this.uniforms.uTime.value = time;
//     this.uniforms.uAlpha.value = S.dustAlpha;
//     this.uniforms.uRise.value = S.dustRise;
//   }

//   dispose() {
//     this.geometry.dispose();
//     this._base.dispose();
//     this.material.dispose();
//   }
// }



import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { createStarGeometry } from './geometry.js';
import { DUST, LOOK } from '../config.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Floor stars: the SAME chrome 3D star as the hero star (same geometry shape, same silver material),
 * just small. No glow, no twinkle, no additive blending: plain lit silver stars that appear on the floor
 * and drift upward.
 */
export class FloorStars {
  constructor(bounds, envMap, seed = LOOK.seed) {
    const N = DUST.count;
    const rand = mulberry32(seed ^ 0x9e3779b1);
    const halfH = bounds.halfH;
    const hw = halfH * DUST.floorHalfWidth;
    const baseY = -halfH * DUST.floorLevel;
    const thick = halfH * DUST.floorThickness;

    // per-star data, kept on the CPU (140 matrices per frame is trivial)
    this.N = N;
    this.base = new Float32Array(N * 3); // resting spot on the floor
    this.param = new Float32Array(N * 4); // delay, rise height, radius, phase
    this.rot = new Float32Array(N * 2); // fixed yaw / roll
    for (let i = 0; i < N; i++) {
      const x = (((i + rand()) / N) * 2 - 1) * hw; // stratified across the full floor width
      this.base[i * 3] = x;
      this.base[i * 3 + 1] = baseY - thick * Math.pow(rand(), 1.5) + 0.06 * Math.sin(x * 1.1 + 1.0);
      this.base[i * 3 + 2] = (rand() - 0.5) * DUST.floorDepth;
      this.param[i * 4] = rand() * DUST.maxDelay;
      this.param[i * 4 + 1] = DUST.riseMin + Math.pow(rand(), 1.4) * (DUST.riseMax - DUST.riseMin);
      this.param[i * 4 + 2] = DUST.sizeMin + rand() * (DUST.sizeMax - DUST.sizeMin);
      this.param[i * 4 + 3] = rand();
      this.rot[i * 2] = (rand() - 0.5) * 1.0;
      this.rot[i * 2 + 1] = (rand() - 0.5) * 0.8;
    }

    // same shape proportions as the hero star (outer 1, inner 0.42, height 0.34), scaled per instance
    this.geometry = createStarGeometry({ outer: 1, inner: 0.42, height: 0.34 });
    // same silver material as the hero star
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xc4ccd8,
      metalness: 1,
      roughness: 0.16,
      clearcoat: 0.25,
      clearcoatRoughness: 0.25,
      envMap,
      envMapIntensity: 0.42,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this._d = new THREE.Object3D();
    this._d.rotation.order = 'YXZ';
  }

  update(S, time) {
    const visible = S.dustAlpha > 0.001;
    this.mesh.visible = visible;
    if (!visible) return;

    const d = this._d;
    const appear = smooth(0, 1, S.dustAlpha); // pop in on the floor
    for (let i = 0; i < this.N; i++) {
      const delay = this.param[i * 4];
      const rise = this.param[i * 4 + 1];
      const radius = this.param[i * 4 + 2];
      const phase = this.param[i * 4 + 3];

      // same gentle ease as before: nearly linear, softened at both ends
      const t = Math.min(1, Math.max(0, (S.dustRise - delay) / Math.max(1 - delay, 1e-3)));
      const e = t + (t * t * (3 - 2 * t) - t) * 0.45;

      const sway = DUST.sway * (0.4 + e);
      d.position.set(
        this.base[i * 3] + Math.sin(time * (0.8 + phase) + phase * 40) * sway,
        this.base[i * 3 + 1] + rise * e,
        this.base[i * 3 + 2] + Math.cos(time * 0.6 + phase * 20) * DUST.sway * 0.5,
      );
      // hero-style tilt, plus a slow gentle turn so the facets catch the light (no flicker)
      d.rotation.set(0.38, this.rot[i * 2] + Math.sin(time * 0.5 + phase * 6.28) * 0.45, this.rot[i * 2 + 1]);
      d.scale.setScalar(Math.max(radius * appear * (1 - smooth(0.8, 1, t)), 1e-5));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}