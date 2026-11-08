// import * as THREE from 'three';
// import { mulberry32 } from './rng.js';
// import { createStarGeometry } from './geometry.js';
// import { createSolidStarMaterial } from './burstStars.js';
// import { DUST, LOOK } from '../config.js';

// const smooth = (a, b, x) => {
//   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
//   return t * t * (3 - 2 * t);
// };

// // How the floor stars look and move. Optional keys on DUST override these, so you can tune from config.js.
// const FLOOR = {
//   emissive: DUST.emissive ?? 0.3,         // self-light: higher = more solid / brighter white
//   envIntensity: DUST.envIntensity ?? 0.95, // chrome reflection strength (the burst stars use 0.85)
//   easePow: DUST.easePow ?? 2.2,           // 1 = constant speed; higher = faster launch and a softer, slower finish
// };

// /**
//  * Floor stars: the SAME solid chrome 3D star as the burst stars, small. They appear along the floor once the
//  * portrait is formed and rise: a quick launch that slows down toward the end (like the video).
//  *
//  * NOTE: the timeline tween for `dustRise` must be linear ("none"); the easing lives here, per star.
//  */
// export class FloorStars {
//   constructor(bounds, envMap, seed = LOOK.seed) {
//     const N = DUST.count;
//     const rand = mulberry32(seed ^ 0x9e3779b1);
//     const halfH = bounds.halfH;
//     const hw = halfH * DUST.floorHalfWidth;
//     const baseY = -halfH * DUST.floorLevel;
//     const thick = halfH * DUST.floorThickness;

//     // per-star data, kept on the CPU
//     this.N = N;
//     this.base = new Float32Array(N * 3); // resting spot on the floor
//     this.param = new Float32Array(N * 4); // delay, rise height, radius, phase
//     this.rot = new Float32Array(N * 2); // fixed yaw / roll
//     for (let i = 0; i < N; i++) {
//       const x = (((i + rand()) / N) * 2 - 1) * hw; // stratified across the full floor width
//       this.base[i * 3] = x;
//       this.base[i * 3 + 1] = baseY - thick * Math.pow(rand(), 1.5) + 0.06 * Math.sin(x * 1.1 + 1.0);
//       this.base[i * 3 + 2] = (rand() - 0.5) * DUST.floorDepth;
//       this.param[i * 4] = rand() * DUST.maxDelay;
//       this.param[i * 4 + 1] = DUST.riseMin + Math.pow(rand(), 1.4) * (DUST.riseMax - DUST.riseMin);
//       this.param[i * 4 + 2] = DUST.sizeMin + rand() * (DUST.sizeMax - DUST.sizeMin);
//       this.param[i * 4 + 3] = rand();
//       this.rot[i * 2] = (rand() - 0.5) * 1.0;
//       this.rot[i * 2 + 1] = (rand() - 0.5) * 0.8;
//     }

//     // same shape proportions as the hero star and the burst stars, scaled per instance
//     this.geometry = createStarGeometry({ outer: 1, inner: 0.42, height: 0.34 });
//     // same solid material as the burst stars
//     this.material = createSolidStarMaterial(envMap, { emissive: FLOOR.emissive, envIntensity: FLOOR.envIntensity });

//     this.mesh = new THREE.InstancedMesh(this.geometry, this.material, N);
//     this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
//     this.mesh.frustumCulled = false;
//     this.mesh.visible = false;
//     this._d = new THREE.Object3D();
//     this._d.rotation.order = 'YXZ';
//   }

//   update(S, time) {
//     const visible = S.dustAlpha > 0.001;
//     this.mesh.visible = visible;
//     if (!visible) return;

//     const d = this._d;
//     const appear = smooth(0, 1, S.dustAlpha); // pop in on the floor
//     for (let i = 0; i < this.N; i++) {
//       const delay = this.param[i * 4];
//       const rise = this.param[i * 4 + 1];
//       const radius = this.param[i * 4 + 2];
//       const phase = this.param[i * 4 + 3];

//       // ease-out: fast launch, then it slows down toward the end of its climb
//       const t = Math.min(1, Math.max(0, (S.dustRise - delay) / Math.max(1 - delay, 1e-3)));
//       const e = 1 - Math.pow(1 - t, FLOOR.easePow);

//       const sway = DUST.sway * (0.4 + e);
//       d.position.set(
//         this.base[i * 3] + Math.sin(time * (0.8 + phase) + phase * 40) * sway,
//         this.base[i * 3 + 1] + rise * e,
//         this.base[i * 3 + 2] + Math.cos(time * 0.6 + phase * 20) * DUST.sway * 0.5,
//       );
//       // hero-style tilt, plus a slow gentle turn so the facets catch the light (no flicker)
//       d.rotation.set(0.38, this.rot[i * 2] + Math.sin(time * 0.5 + phase * 6.28) * 0.45, this.rot[i * 2 + 1]);
//       d.scale.setScalar(Math.max(radius * appear * (1 - smooth(0.8, 1, t)), 1e-5));
//       d.updateMatrix();
//       this.mesh.setMatrixAt(i, d.matrix);
//     }
//     this.mesh.instanceMatrix.needsUpdate = true;
//   }

//   dispose() {
//     this.geometry.dispose();
//     this.material.dispose();
//     this.mesh.dispose();
//   }
// }

import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { createStarGeometry } from './geometry.js';
import { createSolidStarMaterial } from './burstStars.js';
import { DUST, LOOK } from '../config.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Look + motion of the floor stars. Every key can be overridden from DUST in config.js.
const FLOOR = {
  emissive: DUST.emissive ?? 0.3,
  envIntensity: DUST.envIntensity ?? 0.95,
  easePow: DUST.easePow ?? 2.2,        // fast launch, soft landing
  spinMin: DUST.spinMin ?? 0.05,       // slow in-plane (Z) spin, rad/s
  spinMax: DUST.spinMax ?? 0.14,
  tilt: DUST.tilt ?? 0.38,             // fixed tilt so facets catch the light
  tiltJitter: DUST.tiltJitter ?? 0.1,
  popTime: DUST.popTime ?? 0.18,       // seconds for a star to pop in at the floor when it spawns
  float: DUST.float ?? 0.045,          // size (world units) of the gentle bobbing every star keeps after it lands
  floatSpeed: DUST.floatSpeed ?? 0.5,  // how fast that bobbing is (radians/s, ~ 8-20 s per cycle)
  arc: DUST.arc ?? 0.35,               // sideways drift picked up during the climb, so paths curve instead of going straight up
};

// Total length of the dust phase in seconds: last possible spawn + the slowest rise.
// timeline.js uses the SAME formula, so the two always agree.
export const dustWindow = () => DUST.spawnTime + DUST.riseTimeMax;

/**
 * Floor stars, matched to the reference video:
 *  - they spawn one by one across the whole floor over DUST.spawnTime seconds (the count builds up),
 *  - each one launches up from the floor, decelerates, and then STAYS exactly where it stopped,
 *  - once a star has spawned it never shrinks, fades or drifts. It only turns very slowly around Z.
 *
 * The timeline tween for `dustRise` must be linear ("none") and run 0 -> 1 over dustWindow() seconds.
 */
export class FloorStars {
  constructor(bounds, envMap, seed = LOOK.seed) {
    const N = DUST.count;
    const rand = mulberry32(seed ^ 0x9e3779b1);
    const halfH = bounds.halfH;
    const hw = halfH * DUST.floorHalfWidth;
    const baseY = -halfH * DUST.floorLevel;
    const thick = halfH * DUST.floorThickness;

    this.N = N;
    this.window = dustWindow();
    this.base = new Float32Array(N * 3);   // spawn spot on the floor
    this.param = new Float32Array(N * 4);  // spawn time (s), rise height, radius, phase
    this.tau = new Float32Array(N);        // glide time constant: bigger = longer, softer slowdown
    this.arcX = new Float32Array(N);       // sideways drift distance during the climb
    this.fl = new Float32Array(N * 4);     // float: two speeds + two phases
    this.spin = new Float32Array(N);
    this.rotZ0 = new Float32Array(N);
    this.tiltY = new Float32Array(N);
    this.tiltX = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const x = (((i + rand()) / N) * 2 - 1) * hw; // stratified across the whole floor width
      this.base[i * 3] = x;
      this.base[i * 3 + 1] = baseY - thick * Math.pow(rand(), 1.5) + 0.06 * Math.sin(x * 1.1 + 1.0);
      this.base[i * 3 + 2] = (rand() - 0.5) * DUST.floorDepth;

      this.param[i * 4] = rand() * DUST.spawnTime; // staggered spawn: the field fills up over time
      // most stars stay low, a few climb high (median ~30% of max, like the video)
      this.param[i * 4 + 1] = DUST.riseMin + Math.pow(rand(), DUST.risePow) * (DUST.riseMax - DUST.riseMin);
      this.param[i * 4 + 2] = DUST.sizeMin + rand() * (DUST.sizeMax - DUST.sizeMin);
      this.param[i * 4 + 3] = rand();
      // riseTimeMin/Max now mean "time to be ~97% of the way up". tau = that / 3.5, and the star
      // keeps creeping closer forever (exponential), it never hits a hard stop.
      this.tau[i] = (DUST.riseTimeMin + rand() * (DUST.riseTimeMax - DUST.riseTimeMin)) / 3.5;
      this.arcX[i] = (rand() - 0.5) * 2 * FLOOR.arc;
      this.fl[i * 4] = FLOOR.floatSpeed * (0.6 + rand() * 0.8);
      this.fl[i * 4 + 1] = FLOOR.floatSpeed * (0.6 + rand() * 0.8);
      this.fl[i * 4 + 2] = rand() * Math.PI * 2;
      this.fl[i * 4 + 3] = rand() * Math.PI * 2;

      this.spin[i] = (rand() < 0.5 ? -1 : 1) * (FLOOR.spinMin + rand() * (FLOOR.spinMax - FLOOR.spinMin));
      this.rotZ0[i] = rand() * Math.PI * 2;
      this.tiltX[i] = FLOOR.tilt + (rand() - 0.5) * 2 * FLOOR.tiltJitter;
      this.tiltY[i] = (rand() - 0.5) * 2 * FLOOR.tiltJitter;
    }

    this.geometry = createStarGeometry({ outer: 1, inner: 0.42, height: 0.34 });
    this.material = createSolidStarMaterial(envMap, { emissive: FLOOR.emissive, envIntensity: FLOOR.envIntensity });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this._d = new THREE.Object3D();
    this._d.rotation.order = 'YXZ';
  }

  update(S, time) {
    // Visible from the first spawn onward. dustRise stays at 1 after the tween ends, so the stars
    // stay on screen exactly as they landed (no global fade, no global shrink).
    const visible = S.dustRise > 0.0001;
    this.mesh.visible = visible;
    if (!visible) return;

    const d = this._d;
    const now = S.dustRise * this.window; // seconds since the dust phase started

    for (let i = 0; i < this.N; i++) {
      const spawn = this.param[i * 4];
      const rise = this.param[i * 4 + 1];
      const radius = this.param[i * 4 + 2];
      const phase = this.param[i * 4 + 3];
      const age = now - spawn;

      if (age <= 0) {
        // not born yet
        d.position.set(this.base[i * 3], this.base[i * 3 + 1], this.base[i * 3 + 2]);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(1e-5);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        continue;
      }

      // Exponential glide: very fast launch, then it keeps slowing smoothly with no hard stop
      // (this is what removes the "stuck with gum" look).
      const g = 1 - Math.exp(-age / this.tau[i]);

      // gentle float that fades in as the climb finishes and never stops: stars stay alive, not frozen
      const fa = FLOOR.float * smooth(0.0, 2.0, age);
      const fx = Math.sin(time * this.fl[i * 4] + this.fl[i * 4 + 2]) * fa;
      const fy = Math.sin(time * this.fl[i * 4 + 1] + this.fl[i * 4 + 3]) * fa * 0.8;
      const fz = Math.cos(time * this.fl[i * 4] * 0.7 + this.fl[i * 4 + 3]) * fa * 0.5;

      d.position.set(
        this.base[i * 3] + this.arcX[i] * g + fx,
        this.base[i * 3 + 1] + rise * g + fy,
        this.base[i * 3 + 2] + fz,
      );
      // fixed tilt, very slow turn in its own plane
      d.rotation.set(this.tiltX[i], this.tiltY[i], this.rotZ0[i] + this.spin[i] * time);
      // pops in once at spawn, then keeps its full size
      d.scale.setScalar(Math.max(radius * smooth(0, FLOOR.popTime, age), 1e-5));
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