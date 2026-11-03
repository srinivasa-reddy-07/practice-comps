// import * as THREE from 'three';
// import { mulberry32 } from './rng.js';
// import { sampleMPoints } from './geometry.js';
// import { particleVertex, particleFragment } from './shaders.js';
// import { LOOK } from '../config.js';

// /**
//  * One draw call: an InstancedBufferGeometry of camera-facing quads whose fragment shader carves a faceted,
//  * chrome-shaded 5-pointed star. Per-instance attributes hold start / burst / stream / target data;
//  * the vertex shader derives every frame from timeline uniforms (no CPU per-particle work at runtime).
//  */
// export class ParticleSystem {
//   constructor(portrait, seed = LOOK.seed) {
//     const N = portrait.count;
//     const rand = mulberry32(seed ^ 0x5bd1e995);

//     const aStart = sampleMPoints(N, rand, { scale: LOOK.mScale, depth: LOOK.mDepth });
//     const aBurst = new Float32Array(N * 3);
//     const aSpin = new Float32Array(N * 4);
//     const aRand = new Float32Array(N * 4);
//     const aColor = new Float32Array(N * 4);

//     for (let i = 0; i < N; i++) {
//       // explosion vector: mostly radial from the letter, plus a random shell; speed is heavy-tailed
//       const sx = aStart[i * 3], sy = aStart[i * 3 + 1];
//       const rl = Math.hypot(sx, sy) + 1e-4;
//       let rx = rand() * 2 - 1, ry = rand() * 2 - 1, rz = rand() * 2 - 1;
//       const rn = Math.hypot(rx, ry, rz) + 1e-4;
//       let dx = (sx / rl) * 0.55 + (rx / rn) * 0.9, dy = (sy / rl) * 0.55 + (ry / rn) * 0.9, dz = (rz / rn) * 0.9 + 0.1;
//       const dn = Math.hypot(dx, dy, dz) + 1e-4;
//       const speed = 0.9 + Math.pow(rand(), 1.3) * 3.6;
//       aBurst[i * 3] = (dx / dn) * speed * 1.4;
//       aBurst[i * 3 + 1] = (dy / dn) * speed * 1.0;
//       aBurst[i * 3 + 2] = (dz / dn) * speed * 1.1;

//       aSpin[i * 4] = (rand() - 0.5) * 2 * 2.4;
//       aSpin[i * 4 + 1] = 0.8 + rand() * 1.8;
//       aSpin[i * 4 + 2] = 0.8 + rand() * 1.8;
//       aSpin[i * 4 + 3] = (rand() - 0.5) * Math.PI * 2;

//       aRand[i * 4] = rand();
//       aRand[i * 4 + 1] = rand();
//       aRand[i * 4 + 2] = rand();
//       aRand[i * 4 + 3] = rand();

//       aColor[i * 4] = portrait.chroma[i * 3];
//       aColor[i * 4 + 1] = portrait.chroma[i * 3 + 1];
//       aColor[i * 4 + 2] = portrait.chroma[i * 3 + 2];
//       aColor[i * 4 + 3] = portrait.lum[i];
//     }

//     const base = new THREE.PlaneGeometry(2, 2);
//     const geo = new THREE.InstancedBufferGeometry();
//     geo.index = base.index;
//     geo.setAttribute('position', base.getAttribute('position'));
//     geo.instanceCount = N;
//     const add = (name, arr, size) => geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
//     add('aStart', aStart, 3);
//     add('aBurst', aBurst, 3);
//     add('aTarget', portrait.targets, 3);
//     add('aStream', portrait.stream, 4);
//     add('aMisc', portrait.misc, 4);
//     add('aSpin', aSpin, 4);
//     add('aRand', aRand, 4);
//     add('aColor', aColor, 4);

//     this.uniforms = {
//       uTime: { value: 0 }, uAppear: { value: 0 }, uBurst: { value: 0 }, uDrift: { value: 0 },
//       uRegroup: { value: 0 }, uAssemble: { value: 0 }, uStreamT: { value: 0 }, uSpinT: { value: 0 },
//       uUpright: { value: 0 }, uTilt: { value: 1.5 }, uShimmer: { value: 0 }, uSizeMul: { value: 1 },
//       uGlint: { value: 0 }, uSweepX: { value: -5 }, uColorMix: { value: 0 }, uLumMix: { value: 0 },
//     };
//     this.material = new THREE.ShaderMaterial({
//       vertexShader: particleVertex,
//       fragmentShader: particleFragment,
//       uniforms: this.uniforms,
//       transparent: true,
//       depthWrite: false,
//       depthTest: true,
//     });
//     this.mesh = new THREE.Mesh(geo, this.material);
//     this.mesh.frustumCulled = false; // positions are computed on the GPU
//     this.mesh.renderOrder = 2;
//     this.geometry = geo;
//     this._base = base;
//   }

//   update(S, time) {
//     const u = this.uniforms;
//     u.uTime.value = time;
//     u.uAppear.value = S.appear; u.uBurst.value = S.burst; u.uDrift.value = S.drift;
//     u.uRegroup.value = S.regroup; u.uAssemble.value = S.assemble; u.uStreamT.value = S.streamT;
//     u.uSpinT.value = S.spinT; u.uUpright.value = S.upright; u.uTilt.value = S.tilt;
//     u.uShimmer.value = S.shimmer; u.uGlint.value = S.glint; u.uSweepX.value = S.sweepX;
//     u.uColorMix.value = S.colorMix; u.uLumMix.value = S.lumMix;
//   }

//   dispose() {
//     this.geometry.dispose();
//     this._base.dispose();
//     this.material.dispose();
//   }
// }


import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { sampleMPoints } from './geometry.js';
import { particleVertex, particleFragment } from './shaders.js';
import { LOOK } from '../config.js';

/**
 * ORIGINAL version (my earlier mesh2 / update2 additions are removed).
 * One draw call: an InstancedBufferGeometry of camera-facing quads whose fragment shader carves a faceted,
 * chrome-shaded 5-pointed star. Per-instance attributes hold start / burst / stream / target data;
 * the vertex shader derives every frame from timeline uniforms (no CPU per-particle work at runtime).
 */
export class ParticleSystem {
  constructor(portrait, seed = LOOK.seed) {
    const N = portrait.count;
    const rand = mulberry32(seed ^ 0x5bd1e995);

    const aStart = sampleMPoints(N, rand, { scale: LOOK.mScale, depth: LOOK.mDepth });
    const aBurst = new Float32Array(N * 3);
    const aSpin = new Float32Array(N * 4);
    const aRand = new Float32Array(N * 4);
    const aColor = new Float32Array(N * 4);

    for (let i = 0; i < N; i++) {
      // explosion vector: mostly radial from the letter, plus a random shell; speed is heavy-tailed
      const sx = aStart[i * 3], sy = aStart[i * 3 + 1];
      const rl = Math.hypot(sx, sy) + 1e-4;
      let rx = rand() * 2 - 1, ry = rand() * 2 - 1, rz = rand() * 2 - 1;
      const rn = Math.hypot(rx, ry, rz) + 1e-4;
      let dx = (sx / rl) * 0.55 + (rx / rn) * 0.9, dy = (sy / rl) * 0.55 + (ry / rn) * 0.9, dz = (rz / rn) * 0.9 + 0.1;
      const dn = Math.hypot(dx, dy, dz) + 1e-4;
      const speed = 0.9 + Math.pow(rand(), 1.3) * 3.6;
      aBurst[i * 3] = (dx / dn) * speed * 1.4;
      aBurst[i * 3 + 1] = (dy / dn) * speed * 1.0;
      aBurst[i * 3 + 2] = (dz / dn) * speed * 1.1;

      aSpin[i * 4] = (rand() - 0.5) * 2 * 2.4;
      aSpin[i * 4 + 1] = 0.8 + rand() * 1.8;
      aSpin[i * 4 + 2] = 0.8 + rand() * 1.8;
      aSpin[i * 4 + 3] = (rand() - 0.5) * Math.PI * 2;

      aRand[i * 4] = rand();
      aRand[i * 4 + 1] = rand();
      aRand[i * 4 + 2] = rand();
      aRand[i * 4 + 3] = rand();

      aColor[i * 4] = portrait.chroma[i * 3];
      aColor[i * 4 + 1] = portrait.chroma[i * 3 + 1];
      aColor[i * 4 + 2] = portrait.chroma[i * 3 + 2];
      aColor[i * 4 + 3] = portrait.lum[i];
    }

    const base = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.instanceCount = N;
    const add = (name, arr, size) => geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
    add('aStart', aStart, 3);
    add('aBurst', aBurst, 3);
    add('aTarget', portrait.targets, 3);
    add('aStream', portrait.stream, 4);
    add('aMisc', portrait.misc, 4);
    add('aSpin', aSpin, 4);
    add('aRand', aRand, 4);
    add('aColor', aColor, 4);

    this.uniforms = {
      uTime: { value: 0 }, uAppear: { value: 0 }, uBurst: { value: 0 }, uDrift: { value: 0 },
      uRegroup: { value: 0 }, uAssemble: { value: 0 }, uStreamT: { value: 0 }, uSpinT: { value: 0 },
      uUpright: { value: 0 }, uTilt: { value: 1.5 }, uShimmer: { value: 0 }, uSizeMul: { value: 1 },
      uGlint: { value: 0 }, uSweepX: { value: -5 }, uColorMix: { value: 0 }, uLumMix: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false; // positions are computed on the GPU
    this.mesh.renderOrder = 2;
    this.geometry = geo;
    this._base = base;
  }

  update(S, time) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uAppear.value = S.appear; u.uBurst.value = S.burst; u.uDrift.value = S.drift;
    u.uRegroup.value = S.regroup; u.uAssemble.value = S.assemble; u.uStreamT.value = S.streamT;
    u.uSpinT.value = S.spinT; u.uUpright.value = S.upright; u.uTilt.value = S.tilt;
    u.uShimmer.value = S.shimmer; u.uGlint.value = S.glint; u.uSweepX.value = S.sweepX;
    u.uColorMix.value = S.colorMix; u.uLumMix.value = S.lumMix;
  }

  dispose() {
    this.geometry.dispose();
    this._base.dispose();
    this.material.dispose();
  }
}