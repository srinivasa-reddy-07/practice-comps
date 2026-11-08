import { gsap } from "gsap";
import { LOOK, TIMING, DUST } from "../config.js";

export function createState() {
  return {
    // hero star + letter
    starZ: 10,
    starScale: 1,
    starRotY: 0,
    starRotX: 0,
    starRotZ: 0,
    starVis: 1,
    glow: 0,
    glowScale: 0.3,
    keyX: -3.5,
    mScale: 1,
    mRotY: 0,
    mTilt: -0.5,
    mVis: 1,
    reveal: 0,
    mFly: 0,
    starFlood: 0,
    starSpin: 0,
    // particles (portrait)
    appear: 0,
    burst: 0,
    drift: 0,
    regroup: 0,
    assemble: 0,
    streamT: 0,
    spinT: 0,
    upright: 0,
    tilt: 1.5,
    shimmer: 0,
    glint: 0,
    sweepX: -5,
    colorMix: 0,
    lumMix: 0,
    sizeMul: 1,
    // floor stars
    dustAlpha: 0,
    dustRise: 0, // 0 -> 1 linear over the whole dust phase; it STAYS at 1 afterwards so the stars stay put
    // camera + post
    dolly: 0.35,
    orbit: 0.05,
    bloom: LOOK.bloom.base,
  };
}

export function buildTimeline(S, { onComplete } = {}) {
  const tl = gsap.timeline({
    paused: true,
    defaults: { immediateRender: false },
    onComplete,
  });
  const ft = (target, from, to, dur, at, ease = "none") =>
    tl.fromTo(target, from, { ...to, duration: dur, ease }, at);

  const T = TIMING;
  const s = T.star / 2;
  const l = T.letter / 2;
  const e = T.explode / 2;

  const letterAt = T.star;
  const explodeAt = letterAt + T.letter;
  const fadeAt = explodeAt + T.explode;
  const buildAt = fadeAt + T.fade + 0.1 + 1;

  const ASSEMBLE_LEAD = 4;
  const formedAt = buildAt - ASSEMBLE_LEAD + T.build;

  const flyTime = T.flyTime ?? 0.2;
  const flyEnd = explodeAt + flyTime;
  const assembleAt = buildAt - 0.8;
  const floodOverlap = T.floodOverlap ?? 1.25;
  const floodAt = flyEnd - 0.05;
  const floodEnd = assembleAt + floodOverlap + 0.25;
  const floodDur = floodEnd - floodAt + 1;

  // ---------- SCENE 1 — star arrival ----------
  tl.set(S, { starRotX: 0, starRotY: 0, starRotZ: 0, starScale: 0.2 }, 0);

  ft(S, { starZ: 10 }, { starZ: 0.2 }, 2 * s, 0, "power2.in");
  ft(S, { starRotX: 0 }, { starRotX: Math.PI * 0.75 }, 2 * s, 0, "power1.out");
  ft(
    S,
    { starScale: 0.2 },
    { starScale: 0.015 },
    0.5 * s,
    1.5 * s,
    "power3.in",
  );
  ft(
    S,
    { bloom: LOOK.bloom.base },
    { bloom: 0.45 },
    0.5 * s,
    1.5 * s,
    "power2.in",
  );
  tl.set(S, { starVis: 0 }, letterAt);

  // ---------- SCENE 2 — the star feeds power into the MB ----------
  ft(
    S,
    { glow: 1.0, glowScale: 0.34 },
    { glow: 0.07, glowScale: 0.5 },
    0.9 * l,
    letterAt,
    "power2.out",
  );
  ft(S, { bloom: 0.45 }, { bloom: 0.28 }, 1.2 * l, letterAt, "power2.out");
  ft(S, { reveal: 0 }, { reveal: 1 }, 4, letterAt - 1.25, "power2.inOut");
  ft(
    S,
    { keyX: -3.5 },
    { keyX: 3.5 },
    1.8 * l,
    letterAt + 0.15 * l,
    "sine.inOut",
  );
  ft(
    S,
    { dolly: 0.35, orbit: 0.05 },
    { dolly: -0.45, orbit: 0 },
    2.0 * l,
    letterAt,
    "sine.inOut",
  );
  ft(S, { mTilt: -0.5 }, { mTilt: 0 }, 2.1, letterAt, "power2.inOut");

  // ---------- SCENE 3 — the MB comes AT the camera and out through the screen ----------
  ft(S, { mFly: 0 }, { mFly: 1 }, flyTime, explodeAt, "power1.in");
  tl.set(S, { mVis: 0 }, flyEnd);
  ft(S, { glow: 0.07 }, { glow: 0.5 }, flyTime, explodeAt, "power2.in");
  ft(S, { glow: 0.5 }, { glow: 0 }, 0.9, flyEnd, "power2.out");
  ft(S, { bloom: 0.28 }, { bloom: 0.85 }, flyTime, explodeAt, "power2.in");
  ft(S, { bloom: 0.85 }, { bloom: LOOK.bloom.base }, 1.4, flyEnd, "power2.out");
  ft(S, { starSpin: 0 }, { starSpin: 1 }, floodDur, floodAt);

  ft(S, { burst: 0 }, { burst: 1 }, T.explode, explodeAt);
  // ft(S, { drift: 0 }, { drift: 1 }, 5.0, explodeAt);
  // ft(S, { spinT: 0 }, { spinT: 16 }, 7.0, explodeAt, "power2.out");

  ft(S, { drift: 0 }, { drift: 1 }, 5.5, explodeAt); // was 5.0
  ft(S, { spinT: 0 }, { spinT: 16 }, 8.0, explodeAt, "power2.out"); // was 7.0
  ft(S, { tilt: 1.5 }, { tilt: 0.95 }, 2.0 * e, explodeAt, "sine.out");
  ft(
    S,
    { dolly: -0.45 },
    { dolly: 0.7 },
    2.5 * e - flyTime,
    flyEnd,
    "power3.out",
  );

  // ---------- SCENE 4 — the big stars flood up and off the top of the screen ----------
  ft(S, { starFlood: 0 }, { starFlood: 1 }, floodDur, floodAt);
  const regroupDur = Math.max(0.3, T.fade - 0.9);
  ft(S, { regroup: 0 }, { regroup: 1 }, regroupDur, buildAt - 0.9 - regroupDur);

  const camStart = explodeAt + 2.5 * e;
  ft(
    S,
    { dolly: 0.7, orbit: 0 },
    { dolly: 0, orbit: 0 },
    buildAt - camStart,
    camStart,
    "sine.inOut",
  );

  // ---------- SCENE 5 — stars climb and form the portrait ----------
  const SYNC = 5;

  ft(
    S,
    { appear: 0 },
    { appear: 1 },
    0.7,
    buildAt - ASSEMBLE_LEAD,
    "power1.out",
  );
  ft(S, { assemble: 0 }, { assemble: 1 }, T.build, buildAt - ASSEMBLE_LEAD);

  ft(
    S,
    { upright: 0 },
    { upright: 1 },
    T.build * 0.875,
    buildAt - SYNC + T.build * 0.125,
    "power2.inOut",
  );
  ft(
    S,
    { lumMix: 0 },
    { lumMix: 1 },
    T.build * 0.875,
    buildAt - SYNC + T.build * 0.1,
    "sine.inOut",
  );
  ft(
    S,
    { colorMix: 0 },
    { colorMix: LOOK.colorMix },
    T.build * 0.75,
    buildAt - SYNC + T.build * 0.25,
    "sine.inOut",
  );

  const tiltStart = explodeAt + 2.0 * e;
  ft(
    S,
    { tilt: 0.95 },
    { tilt: 0.16 },
    buildAt - tiltStart,
    tiltStart,
    "sine.inOut",
  );

  // ---------- SCENE 6 — floor stars (matched to final_effect.mp4) ----------
  const dustStart = DUST.startAfterFormed ?? -3.4;
  const dustWindow = DUST.spawnTime + DUST.riseTimeMax; // same formula as FloorStars
  const dustAt = Math.max(0, formedAt + dustStart);
  const endAt = Math.max(
    formedAt + T.hold,
    dustAt + dustWindow + (T.tail ?? 0.5),
  );

  tl.set(S, { dustAlpha: 1 }, dustAt); // kept for any other code that reads it
  ft(S, { dustRise: 0 }, { dustRise: 1 }, dustWindow, dustAt, "none");

  tl.to({}, { duration: 0 }, endAt);

  return tl;
}
