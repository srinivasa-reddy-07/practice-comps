// // All particle motion is an analytic function of timeline-driven uniforms => fully deterministic, seekable, GPU-only.

// export const particleVertex = /* glsl */ `
// attribute vec3 aStart;    // position on the M
// attribute vec3 aBurst;    // explosion displacement (velocity * duration)
// attribute vec3 aTarget;   // position in the portrait sculpture
// attribute vec4 aStream;   // laneX, yMin, yMax, yOffset
// attribute vec4 aMisc;     // laneSpeed, laneZ, assembleDelay, portraitRadius
// attribute vec4 aSpin;     // spinSpeed, tiltFreqX, tiltFreqY, phase
// attribute vec4 aRand;     // regroupDelay, freeSize, glintPhase, random
// attribute vec4 aColor;    // hue ratio rgb, luminance

// uniform float uTime, uAppear, uBurst, uDrift, uRegroup, uAssemble, uStreamT, uSpinT;
// uniform float uUpright, uTilt, uShimmer, uSizeMul, uGlint, uSweepX, uColorMix;

// varying vec2 vUv;
// varying vec3 vRX, vRY, vRZ, vTint;
// varying float vLum, vPa, vStream, vBand, vGlint, vAlpha;

// float easeIO(float t){ t = clamp(t, 0., 1.); return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) * .5; }

// void main(){
//   // 1 — explosion: fast, then decelerating (cubic-out and beyond)
//   float b = 1. - pow(1. - clamp(uBurst, 0., 1.), 3.4);
//   vec3 pBurst = aStart + aBurst * (b + 0.10 * uDrift);

//   // 2 — vertical streams
//   float pr = easeIO((uRegroup - aRand.x * 0.45) / 0.55);
//   float yR = max(aStream.z - aStream.y, 0.02);
//   float yy = aStream.y + mod(aStream.w + uStreamT * aMisc.x, yR);
//   vec3 pStream = vec3(aStream.x + sin(yy * 5. + aRand.w * 6.2831) * 0.006, yy, aMisc.y);
//   float sw1 = sin(pr * 3.14159) * 0.55 * (aRand.w - .5);
//   vec3 p = mix(pBurst, pStream, pr) + vec3(cos(aRand.z * 40.), sin(aRand.z * 40.), 0.) * sw1;

//   // 3 — portrait reconstruction (top-down, staggered)
//   float pa = easeIO((uAssemble - aMisc.z) / 0.45);
//   float sw2 = sin(pa * 3.14159) * 0.3;
//   p = mix(p, aTarget, pa) + vec3(cos(aRand.z * 31.), sin(aRand.z * 31.), aRand.w - .5) * sw2 * (aRand.y - .35);

//   // 4 — shimmer
//   p += vec3(sin(uTime * 1.7 + aRand.z * 40.), cos(uTime * 1.3 + aRand.z * 31.), sin(uTime * .9 + aRand.z * 17.)) * 0.0045 * uShimmer * pa;

//   // size
//   float freeSize = (0.014 + aRand.y * aRand.y * 0.03) * mix(1., 0.5, b);
//   float sz = mix(freeSize, aMisc.w * 1.15, pr);
//   sz = mix(sz, aMisc.w, pa) * uSizeMul;
//   float ap = clamp(uAppear, 0., 1.);
//   sz *= ap;

//   // orientation: tumble -> in-plane spin that decelerates -> upright
//   float th = aSpin.w * (1. - .8 * uUpright) + aSpin.x * uSpinT * (1. - uUpright);
//   float tx = uTilt * sin(uTime * aSpin.y + aSpin.w * 3.1);
//   float ty = uTilt * cos(uTime * aSpin.z + aSpin.w * 5.3);
//   float cz = cos(th), sz_ = sin(th), cx = cos(tx), sx = sin(tx), cy = cos(ty), sy = sin(ty);
//   mat3 Rz = mat3(cz, sz_, 0., -sz_, cz, 0., 0., 0., 1.);
//   mat3 Ry = mat3(cy, 0., -sy, 0., 1., 0., sy, 0., cy);
//   mat3 Rx = mat3(1., 0., 0., 0., cx, sx, 0., -sx, cx);
//   mat3 R = Rx * Ry * Rz;

//   vUv = position.xy;
//   vRX = R[0]; vRY = R[1]; vRZ = R[2];
//   vTint = mix(vec3(1.), aColor.rgb, uColorMix);
//   vLum = aColor.w;
//   vPa = pa;
//   vStream = pr * (1. - pa);
//   vBand = exp(-pow((p.x - uSweepX) / 0.75, 2.));
//   vGlint = smoothstep(.985, 1., sin(uTime * (.5 + aRand.w * 1.5) + aRand.z * 60.)) * uGlint * (.4 + .6 * pa);
//   vAlpha = ap;

//   vec3 world = p + R * vec3(position.xy * sz, 0.);
//   gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.);
// }
// `;

// export const particleFragment = /* glsl */ `
// varying vec2 vUv;
// varying vec3 vRX, vRY, vRZ, vTint;
// varying float vLum, vPa, vStream, vBand, vGlint, vAlpha;
// uniform float uLumMix;

// vec3 env(vec3 r){
//   float h = r.y * .5 + .5;
//   vec3 c = mix(vec3(.025, .03, .05), vec3(.5, .58, .74), smoothstep(.15, 1., h));
//   c += vec3(1.) * smoothstep(.78, .95, r.y) * 1.1;                                   // top softbox
//   c += vec3(.62, .8, 1.) * pow(max(r.x, 0.), 5.) * .95;                             // cool strip, right
//   c += vec3(1., .97, .92) * pow(max(-.7 * r.x + .7 * r.y, 0.), 9.) * 1.5;           // warm-white key, upper left
//   c += vec3(.35, .5, .8) * smoothstep(.5, 1., -r.y) * .25;                           // floor bounce
//   return c;
// }

// void main(){
//   vec2 p = vUv;
//   float r = length(p);
//   float a = atan(p.x, p.y);                       // 0 at the top tip, clockwise
//   const float seg = 1.2566371;                    // 72deg
//   float fa = mod(a, seg);
//   float m = min(fa, seg - fa);                    // angle to nearest tip
//   vec2 q = r * vec2(cos(m), sin(m));
//   const vec2 V = vec2(.3236, .2351);              // inner vertex (inner radius .4)
//   vec2 e = V - vec2(1., 0.);
//   float dist = (e.x * q.y - e.y * (q.x - 1.)) / length(e);   // >0 inside the star
//   float aa = fwidth(dist) + 1e-4;
//   float alpha = smoothstep(-aa, aa, dist);
//   if (alpha < .01 || vAlpha < .001) discard;

//   // 10 flat facets, same construction as the hero star
//   bool first = fa < seg * .5;
//   float tip = first ? a - fa : a - fa + seg;
//   float sgn = first ? 1. : -1.;
//   vec2 rad = vec2(sin(tip), cos(tip));
//   vec2 tng = sgn * vec2(cos(tip), -sin(tip));
//   vec2 nxy = .328 * rad + .944 * tng;
//   vec3 nl = normalize(vec3(nxy * .95, .62));
//   vec3 N = normalize(vRX * nl.x + vRY * nl.y + vRZ * nl.z);
//   if (N.z < 0.) N = -N;

//   vec3 R = vec3(0., 0., -1.) + 2. * N.z * N;      // reflect view ray
//   vec3 col = env(R) * vec3(.86, .9, .97);

//   vec3 L1 = normalize(vec3(-.45, .65, .62));
//   vec3 L2 = normalize(vec3(.75, .1, .5));
//   float s1 = pow(max(dot(N, normalize(L1 + vec3(0., 0., 1.))), 0.), 36.);
//   float s2 = pow(max(dot(N, normalize(L2 + vec3(0., 0., 1.))), 0.), 22.);
//   col += s1 * vec3(1., .98, .95) * 1.2 + s2 * vec3(.45, .65, 1.) * .8;
//   col *= .45 + .55 * max(dot(N, L1), 0.) + .15;

//   col *= vTint * mix(1., .62, vPa);               // portrait stars sit lower in the exposure range so detail survives
//   float lumF = .09 + 1.05 * pow(vLum, .95);
//   col *= mix(1., lumF, uLumMix * vPa);
//   col *= 1. + .45 * vStream;
//   col += vec3(.7, .82, 1.) * vBand * (.18 + .5 * s1 + .25 * s2) * vPa;
//   col += vec3(1., .96, .9) * vGlint * 1.5;

//   gl_FragColor = vec4(col, alpha * vAlpha);
// }
// `;

// export const glowVertex = /* glsl */ `
// varying vec2 vUv;
// void main(){ vUv = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
// `;

// // Soft cool-white light + blue haze (the light the star collapses into, and the haze the M sits in).
// export const glowFragment = /* glsl */ `
// varying vec2 vUv;
// uniform float uIntensity, uScale;
// void main(){
//   float r = length(vUv) / max(uScale, .001);
//   float core = exp(-r * r * 22.) * 1.7;
//   float mid  = exp(-r * 3.2) * .38;
//   float haze = exp(-r * r * 1.6) * .16;
//   float g = (core + mid + haze) * uIntensity;
//   gl_FragColor = vec4(vec3(.74, .87, 1.) * g, 1.);
// }
// `;


// All particle motion is an analytic function of timeline-driven uniforms => fully deterministic, seekable, GPU-only.
//
// Sequence: M explodes -> the explosion fades out and ~100-150 stars appear along the bottom of the screen
//           -> a small share of the stars (~5%) rise from the bottom with a trail beneath them, while all the other
//              stars grow in gradually right where they belong in the portrait, until the full count is reached.
//              A few floor stars stay behind.
//           No twinkle, glint or sweep.

export const particleVertex = /* glsl */ `
attribute vec3 aStart;    // position on the M
attribute vec3 aBurst;    // explosion displacement (velocity * duration)
attribute vec3 aTarget;   // final position (portrait sculpture, or the star's own floor spot for floor-only stars)
attribute vec4 aStream;   // resting spot on the floor: x, y, z, swayPhase
attribute vec4 aMisc;     // swayFreq, mode (0 in place / 1 bed riser / 2 riser), riseDelay, portraitRadius
attribute vec4 aSpin;     // spinSpeed, tiltFreqX, tiltFreqY, phase
attribute vec4 aRand;     // regroupDelay, freeSize, glintPhase, random
attribute vec4 aColor;    // hue ratio rgb, luminance

uniform float uTime, uAppear, uBurst, uDrift, uRegroup, uAssemble, uStreamT, uSpinT;
uniform float uUpright, uTilt, uSizeMul, uColorMix;

varying vec2 vUv, vTrail;
varying vec3 vRX, vRY, vRZ, vTint;
varying float vLum, vPa, vStream, vAlpha;

const float PITCH = 2.6;     // spacing of the stars inside a trail, in star diameters (keep in sync with the fragment shader)
const float TRAIL_LEN = 1.0; // overall trail length multiplier

float easeIO(float t){ t = clamp(t, 0., 1.); return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) * .5; }

void main(){
  // 1 — explosion: fast, then decelerating (cubic-out and beyond)
  float b = 1. - pow(1. - clamp(uBurst, 0., 1.), 3.4);
  vec3 pBurst = aStart + aBurst * (b + 0.10 * uDrift);

  float rawPa = clamp((uAssemble - aMisc.z) / 0.45, 0., 1.);
  float pa = easeIO(rawPa);                                // rise progress (staggered per star)
  float pr = easeIO((uRegroup - aRand.x * 0.45) / 0.55);  // how far the explosion has faded away
  // aMisc.y: 0 = appears in place, 1 = starts on the floor and rises first, 2 = spawns on the floor and rises
  float rises = step(.5, aMisc.y);
  float bed = step(.5, aMisc.y) * step(aMisc.y, 1.5);

  // 2 — no falling: the explosion simply fades out. A handful of "bed" stars fade in on the floor instead;
  //     everyone else stays invisible until the moment they appear.
  float sway = 0.025 * (1. - pa);
  vec3 pFloor = aStream.xyz + vec3(sin(uTime * aMisc.x + aStream.w * 6.2831853) * sway,
                                   cos(uTime * aMisc.x * .8 + aStream.w * 4.) * sway * .6, 0.);
  float onFloor = max(bed * step(.5, pr), max(step(.999, pr), step(.0001, rawPa)));
  vec3 pStart = rises > .5 ? mix(pBurst, pFloor, onFloor) : mix(pBurst, aTarget, step(.0001, rawPa));

  // visibility: risers pop in at the floor; the other stars grow gradually right where they belong in the image
  float visPre = bed > .5 ? abs(2. * pr - 1.) : 1. - pr;   // burst star shrinks away, bed star grows in
  float spawn = rises > .5 ? mix(smoothstep(0., .1, rawPa), 1., bed) : smoothstep(0., .35, rawPa);
  float vis = rawPa > 0. ? spawn : visPre;

  // 3 — only the risers travel: they climb from the floor into their place (bottom of the image first)
  float rise = 1. - pow(1. - pa, 2.2);                    // launches fast, settles softly
  vec3 p = mix(pStart, aTarget, vec3(pa, rise, pa));      // y leads, x follows => a gentle swoop
  float sw2 = sin(pa * 3.14159) * 0.3;
  p += vec3(cos(aRand.z * 31.), sin(aRand.z * 31.), aRand.w - .5) * sw2 * (aRand.y - .35) * 0.5 * rises;

  // size
  float freeSize = (0.014 + aRand.y * aRand.y * 0.03) * mix(1., 0.5, b);
  float sz = mix(freeSize, mix(aMisc.w * 1.15, aMisc.w, pa), onFloor) * vis * uSizeMul;
  float ap = clamp(uAppear, 0., 1.);
  sz *= ap;

  // trail below a rising star; gone once it has settled
  float sTrail = sin(pa * 3.14159) * rises;
  float dirT = -1.;
  float lenW = sTrail * (0.45 + 1.0 * aRand.w) * TRAIL_LEN;                  // trail length in world units
  float nTr = 1. + min(lenW / (PITCH * max(sz, 0.004)), 40.);                // stars in the trail (float)
  float kUp = clamp(sTrail * 4., 0., 1.);                                    // trailing stars are upright

  // orientation: tumble -> in-plane spin that decelerates -> upright
  float th = aSpin.w * (1. - .8 * uUpright) + aSpin.x * uSpinT * (1. - uUpright);
  float tx = uTilt * sin(uTime * aSpin.y + aSpin.w * 3.1);
  float ty = uTilt * cos(uTime * aSpin.z + aSpin.w * 5.3);
  float cz = cos(th), sz_ = sin(th), cx = cos(tx), sx = sin(tx), cy = cos(ty), sy = sin(ty);
  mat3 Rz = mat3(cz, sz_, 0., -sz_, cz, 0., 0., 0., 1.);
  mat3 Ry = mat3(cy, 0., -sy, 0., 1., 0., sy, 0., cy);
  mat3 Rx = mat3(1., 0., 0., 0., cx, sx, 0., -sx, cx);
  mat3 R0 = Rx * Ry * Rz;
  mat3 R = mat3(mix(R0[0], vec3(1., 0., 0.), kUp), mix(R0[1], vec3(0., 1., 0.), kUp), mix(R0[2], vec3(0., 0., 1.), kUp));

  float Ey = 1. + (nTr - 1.) * PITCH;   // quad half-height in star units (extends both ways; the fragment keeps one side)
  vUv = vec2(position.x, position.y * Ey);
  vTrail = vec2(nTr, dirT);
  vRX = R[0]; vRY = R[1]; vRZ = R[2];
  vTint = mix(vec3(1.), aColor.rgb, uColorMix);
  vLum = aColor.w;
  vPa = pa;
  vStream = sTrail;
  vAlpha = ap;

  vec3 world = p + R * vec3(position.x * sz, position.y * Ey * sz, 0.);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.);
}
`;

export const particleFragment = /* glsl */ `
varying vec2 vUv, vTrail;
varying vec3 vRX, vRY, vRZ, vTint;
varying float vLum, vPa, vStream, vAlpha;
uniform float uLumMix;

const float PITCH = 2.6;

vec3 env(vec3 r){
  float h = r.y * .5 + .5;
  vec3 c = mix(vec3(.025, .03, .05), vec3(.5, .58, .74), smoothstep(.15, 1., h));
  c += vec3(1.) * smoothstep(.78, .95, r.y) * 1.1;                                   // top softbox
  c += vec3(.62, .8, 1.) * pow(max(r.x, 0.), 5.) * .95;                             // cool strip, right
  c += vec3(1., .97, .92) * pow(max(-.7 * r.x + .7 * r.y, 0.), 9.) * 1.5;           // warm-white key, upper left
  c += vec3(.35, .5, .8) * smoothstep(.5, 1., -r.y) * .25;                           // floor bounce
  return c;
}

void main(){
  // --- trail: repeat the star along the trail axis, fading toward the tail, plus a thin connecting line ---
  vec2 p = vUv;
  float tileFade = 1.;
  float lineA = 0.;
  if (vTrail.x > 1.0001) {
    float yy = vUv.y * vTrail.y;                         // >0 behind the star
    float j = floor((yy + PITCH * .5) / PITCH);          // tile index, 0 = the star itself
    tileFade = (j >= 0.) ? clamp(vTrail.x - j, 0., 1.) * (1. - .85 * j / vTrail.x) : 0.;
    p = vec2(vUv.x, vUv.y - j * PITCH * vTrail.y);
    float tail = (vTrail.x - 1.) * PITCH + 1.;
    lineA = smoothstep(.09, .0, abs(vUv.x)) * step(-1., yy) * step(yy, tail) * (1. - yy / (tail + 1.)) * .5;
  }

  float r = length(p);
  float a = atan(p.x, p.y);                       // 0 at the top tip, clockwise
  const float seg = 1.2566371;                    // 72deg
  float fa = mod(a, seg);
  float m = min(fa, seg - fa);                    // angle to nearest tip
  vec2 q = r * vec2(cos(m), sin(m));
  const vec2 V = vec2(.3236, .2351);              // inner vertex (inner radius .4)
  vec2 e = V - vec2(1., 0.);
  float dist = (e.x * q.y - e.y * (q.x - 1.)) / length(e);   // >0 inside the star
  float aa = max(fwidth(vUv.x), fwidth(vUv.y)) * .8 + 1e-4;
  float aS = smoothstep(-aa, aa, dist) * tileFade;
  float alpha = max(aS, lineA);
  if (alpha < .01 || vAlpha < .001) discard;

  // 10 flat facets, same construction as the hero star
  bool first = fa < seg * .5;
  float tip = first ? a - fa : a - fa + seg;
  float sgn = first ? 1. : -1.;
  vec2 rad = vec2(sin(tip), cos(tip));
  vec2 tng = sgn * vec2(cos(tip), -sin(tip));
  vec2 nxy = .328 * rad + .944 * tng;
  vec3 nl = normalize(vec3(nxy * .95, .62));
  vec3 N = normalize(vRX * nl.x + vRY * nl.y + vRZ * nl.z);
  if (N.z < 0.) N = -N;

  vec3 R = vec3(0., 0., -1.) + 2. * N.z * N;      // reflect view ray
  vec3 col = env(R) * vec3(.86, .9, .97);

  vec3 L1 = normalize(vec3(-.45, .65, .62));
  vec3 L2 = normalize(vec3(.75, .1, .5));
  float s1 = pow(max(dot(N, normalize(L1 + vec3(0., 0., 1.))), 0.), 36.);
  float s2 = pow(max(dot(N, normalize(L2 + vec3(0., 0., 1.))), 0.), 22.);
  col += s1 * vec3(1., .98, .95) * 1.2 + s2 * vec3(.45, .65, 1.) * .8;
  col *= .45 + .55 * max(dot(N, L1), 0.) + .15;

  col *= vTint * mix(1., .62, vPa);               // portrait stars sit lower in the exposure range so detail survives
  float lumF = .09 + 1.05 * pow(vLum, .95);
  col *= mix(1., lumF, uLumMix * vPa);
  col *= 1. + .45 * vStream;

  // the connecting line is plain cool white
  col = mix(vec3(.72, .84, 1.) * 1.05 * vTint, col, step(lineA, aS));

  gl_FragColor = vec4(col, alpha * vAlpha);
}
`;

export const glowVertex = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;

// Soft cool-white light + blue haze (the light the star collapses into, and the haze the M sits in).
export const glowFragment = /* glsl */ `
varying vec2 vUv;
uniform float uIntensity, uScale;
void main(){
  float r = length(vUv) / max(uScale, .001);
  float core = exp(-r * r * 22.) * 1.7;
  float mid  = exp(-r * 3.2) * .38;
  float haze = exp(-r * r * 1.6) * .16;
  float g = (core + mid + haze) * uIntensity;
  gl_FragColor = vec4(vec3(.74, .87, 1.) * g, 1.);
}
`;