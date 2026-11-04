import { gsap } from "gsap";
import { DURATION, LOOK, TIMING, DUST } from "../config.js";

export function createState() {
  return {
    // hero star + letter
    starZ: 12,
    starScale: 1,
    starRotY: 0,
    starRotX: 0,
    starRotZ: 0,
    starVis: 1,
    glow: 0,
    glowScale: 0.3,
    keyX: -3.5,
    mScale: 1, // the MB no longer scales in
    mRotY: 0, // ...or turns in
    mTilt: -0.5, // MB starts tipped up (radians, negative = face tipped up), levels out to 0 as it powers on
    mVis: 1, // it is there from the first frame (unpowered)
    reveal: 0, // LED power-on 0 -> 1, spreads from the centre of the word
    // particles
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
    // floor dust (hold phase)
    dustAlpha: 0,
    dustRise: 0,
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
  const s = T.star / 2; // stretch factors relative to the original 2 s scenes
  const l = T.letter / 2;
  const e = T.explode / 2;

  const letterAt = T.star;
  const explodeAt = letterAt + T.letter;
  const fadeAt = explodeAt + T.explode;
  const buildAt = fadeAt + T.fade + 0.1;
  const holdAt = buildAt + T.build;

  // ---------- SCENE 1 — star arrival ----------
  // The star only spins around X and Y. Z roll is locked at 0.
  tl.set(S, { starRotX: 0, starRotY: 0, starRotZ: 0, starScale: 0.2 }, 0);

  // one continuous move from far away to the centre
  ft(S, { starZ: 10 }, { starZ: 0.2 }, 2 * s, 0, "power2.in");

  // spin around X 
  ft(S, { starRotX: 0 }, { starRotX: Math.PI * 0.75 }, 2 * s, 0, "power1.out");

  // scale stays constant, then shrinks into a point at the very end
  ft(
    S,
    { starScale: 0.2 },
    { starScale: 0.015 },
    0.5 * s,
    1.5 * s,
    "power3.in",
  );

  // bloom build only, no glow ramp, so the LED word stays dark until the star is gone
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
  ft(S, { reveal: 0 }, { reveal: 1 }, 4, letterAt - 1, "power2.inOut");
  ft(
    S,
    { keyX: -3.5 },
    { keyX: 3.5 },
    1.8 * l,
    letterAt + 0.15 * l,
    "sine.inOut",
  ); // light sweeps across the chrome
  ft(
    S,
    { dolly: 0.35, orbit: 0.05 },
    { dolly: -0.45, orbit: 0 },
    2.0 * l,
    letterAt,
    "sine.inOut",
  );

  // The MB starts tipped upwards. As the light spreads across it, it slowly rotates back to face the
  // screen head-on, on the same timing and easing as the power-on so the two feel like one motion.
  ft(S, { mTilt: -0.5 }, { mTilt: 0 }, 2.1, letterAt, "power2.inOut");

  // ---------- SCENE 3 — explosion ----------
  tl.set(S, { appear: 1 }, explodeAt - 0.02);
  tl.set(S, { mVis: 0 }, explodeAt);
  ft(S, { glow: 0.07 }, { glow: 0 }, 1.0, explodeAt, "power2.out");
  ft(S, { bloom: 0.28 }, { bloom: 0.5 }, 0.12, explodeAt, "power2.out");
  ft(
    S,
    { bloom: 0.5 },
    { bloom: LOOK.bloom.base },
    1.6,
    explodeAt + 0.12,
    "power2.out",
  );
  ft(S, { burst: 0 }, { burst: 1 }, T.explode, explodeAt);
  ft(S, { drift: 0 }, { drift: 1 }, 5.0, explodeAt);
  ft(S, { spinT: 0 }, { spinT: 16 }, 7.0, explodeAt, "power2.out");
  ft(S, { tilt: 1.5 }, { tilt: 0.95 }, 2.0 * e, explodeAt, "sine.out");
  ft(S, { dolly: -0.45 }, { dolly: 0.7 }, 2.5 * e, explodeAt, "power3.out");

  // ---------- SCENE 4 — explosion fades, floor stars appear ----------
  ft(S, { regroup: 0 }, { regroup: 1 }, T.fade, fadeAt);
  ft(
    S,
    { dolly: 0.7, orbit: 0 },
    { dolly: 0.28, orbit: 0.07 },
    2.5,
    explodeAt + 2.5 * e,
    "sine.inOut",
  );

  // ---------- SCENE 5 — stars climb and form the portrait ----------
  ft(S, { assemble: 0 }, { assemble: 1 }, T.build, buildAt - 0.8);
  ft(
    S,
    { upright: 0 },
    { upright: 1 },
    T.build * 0.875,
    buildAt + T.build * 0.125,
    "power2.inOut",
  );
  ft(S, { tilt: 0.95 }, { tilt: 0.16 }, T.build, buildAt);
  ft(
    S,
    { lumMix: 0 },
    { lumMix: 1 },
    T.build * 0.875,
    buildAt + T.build * 0.1,
    "sine.inOut",
  );
  ft(
    S,
    { colorMix: 0 },
    { colorMix: LOOK.colorMix },
    T.build * 0.85,
    buildAt + T.build * 0.25,
    "sine.inOut",
  );
  ft(
    S,
    { dolly: 0.28, orbit: 0.07 },
    { dolly: 0, orbit: -0.05 },
    T.build,
    buildAt,
    "sine.inOut",
  );

  // ---------- SCENE 6 — final hold + floor dust ----------
  ft(
    S,
    { dolly: 0, orbit: -0.05 },
    { dolly: -0.12, orbit: 0 },
    T.hold,
    holdAt,
    "sine.inOut",
  );

  // The moment the hold starts: small stars appear scattered over the whole floor, then drift up gradually.
  ft(S, { dustAlpha: 0 }, { dustAlpha: 1 }, DUST.fadeIn, holdAt, "power1.out");
  ft(S, { dustRise: 0 }, { dustRise: 1 }, T.hold, holdAt, "sine.inOut");

  tl.to({}, { duration: 0 }, DURATION);

  return tl;
}
