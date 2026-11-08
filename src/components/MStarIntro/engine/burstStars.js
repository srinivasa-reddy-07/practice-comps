// import * as THREE from 'three';
// import { mulberry32 } from './rng.js';
// import { createStarGeometry, sampleMPoints } from './geometry.js';
// import { LOOK } from '../config.js';

// /**
//  * Tuning knobs. Every size / distance is a multiple of the portrait's half-height (bounds.halfH),
//  * so the effect scales with the portrait and with whatever camera framing you already have.
//  */
// export const BURST = {
//   count: 150,        // big stars thrown out of the letters
//   risers: 90,       // big stars flooding in from below the frame
//   sizeMin: 0.028,    // star radius range (x halfH)
//   sizeMax: 0.07,
//   bigChance: 0.06,   // fraction of "hero" stars that are much bigger (the close-to-camera ones in the video)
//   bigScale: 1.9,
//   riserSize: 0.75,   // risers are a bit smaller than the burst stars
//   spreadX: 1.65,     // burst stars land evenly over this half-width (x halfH) ...
//   spreadY: 1.05,     // ... and this half-height. Slightly past the frame so the edges are not bare.
//   creep: 0.07,       // total extra outward drift over the whole life, so the cloud never freezes
//   exitMin: 0.15,     // flood progress (0..1) at which the first burst star leaves the top ...
//   exitMax: 0.97,     // ... and the last one. The cloud thins out evenly between the two.
//   depth: 0.9,        // z spread of the cloud (x halfH): gives the near/far size variety
//   turns: [2, 3],     // full rotations each star makes (around Z only) between the blast and leaving the screen
//   tilt: 0.38,        // fixed hero-style tilt (radians) so the facets catch the light; NOT animated
//   tiltJitter: 0.12,  // small per-star variation of that tilt
//   emissive: 0.22,    // faint self-light so stars never go black while tumbling edge-on
//   envIntensity: 0.85 // brighter than the hero star's 0.42, the burst stars in the video are very white
// };

// /** The "solid" chrome star material, shared by the burst stars and the floor stars so they match. */
// export function createSolidStarMaterial(envMap, { emissive = BURST.emissive, envIntensity = BURST.envIntensity } = {}) {
//   return new THREE.MeshPhysicalMaterial({
//     color: 0xc4ccd8,
//     metalness: 1,
//     roughness: 0.16,
//     clearcoat: 0.25,
//     clearcoatRoughness: 0.25,
//     emissive: 0x9fb3d1,
//     emissiveIntensity: emissive,
//     envMap,
//     envMapIntensity: envIntensity
//   });
// }

// const smooth = (a, b, x) => {
//   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
//   return t * t * (3 - 2 * t);
// };
// const clamp01 = (x) => Math.min(1, Math.max(0, x));
// const FLOOD_POW = 1.9; // upward acceleration of the burst stars: they launch slowly and are fastest at the end (1 = constant speed)
// const RISER_POW = 1.35; // same for the stars rising from below

// /**
//  * Scene 3 + 4: the letter bursts into big chrome stars that spread evenly over the screen, tumble,
//  * then flood upward and out of the top (while the portrait build is already starting underneath).
//  *
//  *  starBurst 0 -> 1   stars fly out of the letter (fast, decelerating) to an even spread over the frame
//  *  starFlood 0 -> 1   every star accelerates upward and leaves through the top; a second wave rises from below
//  *  starSpin  0 -> 1    drives the in-plane (Z) rotation over the stars' whole life, so everything is a pure
//  *                     function of timeline state (scrubbing works)
//  */
// export class BurstStars {
//   constructor(bounds, envMap, seed = LOOK.seed) {
//     const rand = mulberry32(seed ^ 0x7f4a7c15);
//     const H = bounds.halfH;
//     const NB = BURST.count;
//     const NR = BURST.risers;
//     const N = NB + NR;
//     this.H = H;
//     this.NB = NB;
//     this.N = N;

//     this.p0 = new Float32Array(N * 3);    // burst: spawn point inside the letter | riser: start point below the frame
//     this.off = new Float32Array(N * 3);   // burst: offset from spawn to its landing spot | riser: unused
//     this.rise = new Float32Array(N);      // vertical travel during the flood
//     this.delay = new Float32Array(N);     // 0..1 stagger inside the flood
//     this.radius = new Float32Array(N);
//     this.turns = new Float32Array(N);     // signed full rotations around Z over the star's life
//     this.rotZ0 = new Float32Array(N);     // starting angle around Z
//     this.tilt = new Float32Array(N * 2);  // fixed tilt about X and Y

//     // spawn points use the same sampler as the old particle explosion, so stars leave from the exact letter shape
//     const start = sampleMPoints(NB, rand, { scale: LOOK.mScale, depth: LOOK.mDepth });

//     // landing spots: a jittered grid over the whole frame, cells shuffled => even coverage, no clumps, no bare patches
//     const X = BURST.spreadX * H;
//     const Y = BURST.spreadY * H;
//     const cols = Math.max(1, Math.round(Math.sqrt(NB * (X / Y))));
//     const rows = Math.ceil(NB / cols);
//     const cells = Array.from({ length: cols * rows }, (_, k) => k);
//     for (let k = cells.length - 1; k > 0; k--) {
//       const j = Math.floor(rand() * (k + 1));
//       [cells[k], cells[j]] = [cells[j], cells[k]];
//     }

//     const sign = () => (rand() < 0.5 ? -1 : 1);

//     for (let i = 0; i < N; i++) {
//       const isBurst = i < NB;

//       if (isBurst) {
//         const sx = start[i * 3], sy = start[i * 3 + 1], sz = start[i * 3 + 2];
//         this.p0[i * 3] = sx; this.p0[i * 3 + 1] = sy; this.p0[i * 3 + 2] = sz;

//         const c = cells[i];
//         const tx = (((c % cols) + 0.15 + 0.7 * rand()) / cols * 2 - 1) * X;
//         const ty = ((Math.floor(c / cols) + 0.15 + 0.7 * rand()) / rows * 2 - 1) * Y;
//         const tz = (rand() - 0.35) * BURST.depth * H;
//         this.off[i * 3] = tx - sx;
//         this.off[i * 3 + 1] = ty - sy;
//         this.off[i * 3 + 2] = tz - sz;

//         // flood: every star gets its own exit time, spread evenly over the flood, so the cloud thins out
//         // one star at a time (like the video) instead of emptying all at once. The star's travel is solved
//         // so that it crosses the top of the frame exactly at that moment.
//         const exit = BURST.exitMin + (BURST.exitMax - BURST.exitMin) * rand();  // flood progress when it leaves
//         const delay = exit * 0.55 * rand();                                    // when it starts moving
//         const tExit = Math.max(0.2, (exit - delay) / Math.max(1 - delay, 1e-3));
//         this.delay[i] = delay;
//         this.rise[i] = Math.max(0.5 * H, 1.2 * H - ty) / Math.pow(tExit, FLOOD_POW);

//         const big = rand() < BURST.bigChance ? BURST.bigScale : 1;
//         this.radius[i] = (BURST.sizeMin + rand() * (BURST.sizeMax - BURST.sizeMin)) * H * big;
//       } else {
//         // riser: starts well below the frame, evenly spread across the width, rises through the whole screen
//         const j = i - NB;
//         const x0 = (((j + rand()) / NR) * 2 - 1) * 1.7 * H;
//         const y0 = -(1.7 + rand() * 1.0) * H;
//         const z0 = (rand() - 0.5) * 1.2 * H;
//         this.p0[i * 3] = x0; this.p0[i * 3 + 1] = y0; this.p0[i * 3 + 2] = z0;
//         // same idea as the burst stars: each riser crosses the top of the frame at its own moment
//         const exit = 0.4 + 0.57 * rand();
//         const delay = exit * 0.6 * rand();
//         const tExit = Math.max(0.2, (exit - delay) / Math.max(1 - delay, 1e-3));
//         this.delay[i] = delay;
//         this.rise[i] = (1.2 * H - y0) / Math.pow(tExit, RISER_POW);
//         this.radius[i] = (BURST.sizeMin + rand() * (BURST.sizeMax - BURST.sizeMin)) * H * BURST.riserSize;
//       }

//       // flat in-plane spin only: 2-3 full turns, random direction, random starting angle
//       this.turns[i] = sign() * (BURST.turns[0] + rand() * (BURST.turns[1] - BURST.turns[0]));
//       this.rotZ0[i] = rand() * Math.PI * 2;
//       this.tilt[i * 2] = BURST.tilt + (rand() - 0.5) * 2 * BURST.tiltJitter;
//       this.tilt[i * 2 + 1] = (rand() - 0.5) * 2 * BURST.tiltJitter;
//     }

//     // same star proportions as the hero star and the floor stars
//     this.geometry = createStarGeometry({ outer: 1, inner: 0.42, height: 0.34 });
//     this.material = createSolidStarMaterial(envMap);

//     this.mesh = new THREE.InstancedMesh(this.geometry, this.material, N);
//     this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
//     this.mesh.frustumCulled = false;
//     this.mesh.visible = false;
//     this.mesh.renderOrder = 2;
//     this._d = new THREE.Object3D();
//     this._d.rotation.order = 'YXZ';
//   }

//   update(S, _time) {
//     const b = S.starBurst;
//     const f = S.starFlood;
//     const on = b > 0 && f < 1;
//     this.mesh.visible = on;
//     if (!on) return;

//     const d = this._d;
//     // explosion: exponential ease-out => most of the distance is covered in the first ~third of the burst
//     const eOut = (1 - Math.pow(2, -10 * b)) / (1 - Math.pow(2, -10));
//     const reach = eOut + BURST.creep * S.starSpin;  // ...then a very slow drift so the cloud never freezes
//     const grow = smooth(0, 0.06, b);                // stars pop out of the letter instead of appearing full size
//     const spin = S.starSpin;

//     for (let i = 0; i < this.N; i++) {
//       const isBurst = i < this.NB;
//       const delay = this.delay[i];
//       const t = clamp01((f - delay) / Math.max(1 - delay, 1e-3));

//       let x = this.p0[i * 3], y = this.p0[i * 3 + 1], z = this.p0[i * 3 + 2];
//       let size;

//       if (isBurst) {
//         x += this.off[i * 3] * reach;
//         y += this.off[i * 3 + 1] * reach;
//         z += this.off[i * 3 + 2] * reach;
//         y += this.rise[i] * Math.pow(t, FLOOD_POW); // accelerates upward: "going up fast"
//         size = this.radius[i] * grow;
//       } else {
//         // risers only exist during the flood, below the frame until then
//         size = f > 0 ? this.radius[i] : 0;
//         y += this.rise[i] * Math.pow(t, RISER_POW);
//         x += Math.sin(spin * 4 + i) * 0.03 * this.H;
//       }

//       d.position.set(x, y, z);
//       // order is YXZ, so Z is applied first: the star turns like a wheel in its own plane, then the fixed tilt
//       d.rotation.set(
//         this.tilt[i * 2],
//         this.tilt[i * 2 + 1],
//         this.rotZ0[i] + this.turns[i] * Math.PI * 2 * spin
//       );
//       d.scale.setScalar(Math.max(size, 1e-5));
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
import { LOOK } from '../config.js';

/**
 * Tuning knobs. Every size / distance is a multiple of the portrait's half-height (bounds.halfH),
 * so the effect scales with the portrait and with whatever camera framing you already have.
 */
export const BURST = {
  count: 300,        // big stars in the flood
  sizeMin: 0.028,    // star radius range (x halfH)
  sizeMax: 0.07,
  bigChance: 0.06,   // fraction of "hero" stars that are much bigger
  bigScale: 1.9,
  spreadX: 1.7,      // stars are spread evenly over this half-width (x halfH)
  depth: 1.2,        // z spread (x halfH): gives the near/far size variety
  startMin: 1.7,     // how far below the frame a star waits (x halfH), min ...
  startMax: 2.7,     // ... and max
  exitMin: 0.12,     // flood progress (0..1) at which the first star leaves through the top ...
  exitMax: 0.97,     // ... and the last one. The screen thins out evenly between the two.
  windowMin: 0.45,   // share of the flood a star spends travelling from below the frame to the top.
  windowMax: 0.70,   // Smaller = faster stars, fewer on screen at once. Larger = slower, a fuller screen.
  pow: 1.6,          // upward acceleration: they launch slowly and are fastest at the end (1 = constant speed)
  turns: [2, 3],     // full rotations each star makes (around Z only) during the flood
  tilt: 0.38,        // fixed hero-style tilt (radians) so the facets catch the light; NOT animated
  tiltJitter: 0.12,  // small per-star variation of that tilt
  emissive: 0.22,    // faint self-light so stars never go dark
  envIntensity: 0.85 // brighter than the hero star's 0.42, the stars in the video are very white
};

/** The "solid" chrome star material, shared by the flood stars and the floor stars so they match. */
export function createSolidStarMaterial(envMap, { emissive = BURST.emissive, envIntensity = BURST.envIntensity } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xc4ccd8,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 0.25,
    clearcoatRoughness: 0.25,
    emissive: 0x9fb3d1,
    emissiveIntensity: emissive,
    envMap,
    envMapIntensity: envIntensity
  });
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * The big-star flood. The MB has just flown out through the camera; now big chrome stars rise from below the
 * frame, spread evenly over the screen, spinning flat (Z axis), and leave through the top, while the portrait
 * build is already starting underneath.
 *
 *  starFlood 0 -> 1   the whole flood
 *  starSpin  0 -> 1   drives the Z rotation over the stars' whole life
 * Both are pure functions of timeline state, so scrubbing / seeking works like the rest of the timeline.
 *
 * (Class name kept as BurstStars so the engine wiring doesn't change.)
 */
export class BurstStars {
  constructor(bounds, envMap, seed = LOOK.seed) {
    const rand = mulberry32(seed ^ 0x7f4a7c15);
    const H = bounds.halfH;
    const N = BURST.count;
    this.H = H;
    this.N = N;

    this.p0 = new Float32Array(N * 3);    // start point below the frame
    this.rise = new Float32Array(N);      // vertical travel (solved so each star crosses the top at its exit time)
    this.delay = new Float32Array(N);     // 0..1 when it starts moving
    this.radius = new Float32Array(N);
    this.turns = new Float32Array(N);     // signed full rotations around Z over the flood
    this.rotZ0 = new Float32Array(N);     // starting angle around Z
    this.tilt = new Float32Array(N * 2);  // fixed tilt about X and Y

    const sign = () => (rand() < 0.5 ? -1 : 1);
    // x is stratified across the full width, then each star gets an independent random timing,
    // so at any moment the stars on screen are spread evenly left to right
    for (let i = 0; i < N; i++) {
      const x0 = (((i + rand()) / N) * 2 - 1) * BURST.spreadX * H;
      const y0 = -(BURST.startMin + rand() * (BURST.startMax - BURST.startMin)) * H;
      const z0 = (rand() - 0.5) * BURST.depth * H;
      this.p0[i * 3] = x0; this.p0[i * 3 + 1] = y0; this.p0[i * 3 + 2] = z0;

      // each star crosses the top of the frame at its own moment, spread evenly over the flood
      const exit = BURST.exitMin + (BURST.exitMax - BURST.exitMin) * rand();
      const win = BURST.windowMin + (BURST.windowMax - BURST.windowMin) * rand();
      const delay = Math.max(0, exit - win);
      const tExit = Math.max(0.2, (exit - delay) / Math.max(1 - delay, 1e-3));
      this.delay[i] = delay;
      this.rise[i] = (1.2 * H - y0) / Math.pow(tExit, BURST.pow);

      const big = rand() < BURST.bigChance ? BURST.bigScale : 1;
      this.radius[i] = (BURST.sizeMin + rand() * (BURST.sizeMax - BURST.sizeMin)) * H * big;

      this.turns[i] = sign() * (BURST.turns[0] + rand() * (BURST.turns[1] - BURST.turns[0]));
      this.rotZ0[i] = rand() * Math.PI * 2;
      this.tilt[i * 2] = BURST.tilt + (rand() - 0.5) * 2 * BURST.tiltJitter;
      this.tilt[i * 2 + 1] = (rand() - 0.5) * 2 * BURST.tiltJitter;
    }

    // same star proportions as the hero star and the floor stars
    this.geometry = createStarGeometry({ outer: 1, inner: 0.42, height: 0.34 });
    this.material = createSolidStarMaterial(envMap);

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    this._d = new THREE.Object3D();
    this._d.rotation.order = 'YXZ';
  }

  update(S, _time) {
    const f = S.starFlood;
    const on = f > 0 && f < 1;
    this.mesh.visible = on;
    if (!on) return;

    const d = this._d;
    const spin = S.starSpin;

    for (let i = 0; i < this.N; i++) {
      const delay = this.delay[i];
      const t = clamp01((f - delay) / Math.max(1 - delay, 1e-3));

      d.position.set(
        this.p0[i * 3] + Math.sin(spin * 4 + i) * 0.03 * this.H,   // slight sideways sway
        this.p0[i * 3 + 1] + this.rise[i] * Math.pow(t, BURST.pow), // accelerating climb
        this.p0[i * 3 + 2]
      );
      // order is YXZ, so Z is applied first: the star turns like a wheel in its own plane, then the fixed tilt
      d.rotation.set(
        this.tilt[i * 2],
        this.tilt[i * 2 + 1],
        this.rotZ0[i] + this.turns[i] * Math.PI * 2 * spin
      );
      d.scale.setScalar(this.radius[i]);
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