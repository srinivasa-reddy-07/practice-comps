// Everything tweakable lives here. Times are in seconds on the master GSAP timeline.
export const DEFAULT_ASSETS = {
  colorSrc: "/assets/mstar/maddy_color.jpg", // primary reference (reconstruction + hue)
  monoSrc: "/assets/mstar/maddy_mono.png", // silhouette + luminance reference
};

// export const TIMING = {
//   star: 1.75,
//   letter: 3.5,
//   explode: 2.9,
//   fade: 1.9,
//   build: 9.0,
//   burstTime: 1.5,
//   hold: 3,   // now ONLY the length of the dust rise + final camera drift (not idle time)
//   tail: 0.5,   // NEW: how long the finished image sits after the dust finishes. Lower = tighter ending.
// };

// export const DURATION =
//   TIMING.star + TIMING.letter + TIMING.explode + TIMING.fade + 0.1 + TIMING.build + TIMING.tail; // CHANGED: hold -> tail

export const TIMING = {
  star: 2.25, // was 1.75  (+0.5) star arrival, slightly slower dive
  letter: 4.25, // was 3.5   (+0.75) MB reveal + key sweep gets room to breathe
  explode: 3.5, // was 2.9   (+0.6) burst + camera pull-back
  fade: 2.4, // was 1.9   (+0.5) stars flood up / regroup phase
  build: 10.5, // was 9.0   (+1.5) portrait assembly, the longest stretch
  burstTime: 1.5,
  hold: 3, // unchanged: dust rise + final drift
  tail: 0.5,
};

// Matches the real end of the timeline (formedAt + hold).
// buildAt = star+letter+explode+fade+1.1, formedAt = buildAt - 4 + build
export const DURATION =
  TIMING.star +
  TIMING.letter +
  TIMING.explode +
  TIMING.fade +
  1.1 -
  4 +
  TIMING.build +
  TIMING.hold; // = 23.0

export const LOOK = {
  fov: 30,
  baseDistance: 9.5, // camera distance that frames the portrait with ~7% margin at 1.43:1
  aspect: 1.43, // native cinema-screen aspect
  starRadius: 1.75,
  mScale: 1.2, // size of the 3D "M"
  mDepth: 0.5,
  particleCount: 8200,
  seed: 1337,
  colorMix: 0.5, // how much of the colour photograph's hue tints the silver stars (0 = pure silver)
  bloom: { base: 0.12, radius: 0.4, threshold: 0.95 },
  exposure: 1.0,
};

// Values measured from final_effect.mp4 (screen ~408px tall, stars 3-6px wide, ~150 on screen at the end).
export const DUST = {
  count: 120, // stars on the floor at the end (video shows roughly 150)
  floorLevel: 0.93, // unchanged
  floorThickness: 0.12, // thinner bed: stars spawn right on the floor line
  floorHalfWidth: 2.1, // video: stars spread ~83% of the screen width, wider than before (was 1.7)
  floorDepth: 1.6,

  // timing (seconds, measured from the dust start)
  startAfterFormed: -1, // negative = starts BEFORE the portrait finishes forming (as in the video)
  spawnTime: 0, // new stars keep appearing for this long, so the count builds up
  riseTimeMin: 1, // each star's own climb duration
  riseTimeMax: 3,

  // where they end up (world units above their spawn spot)
  riseMin: 0,
  riseMax: 1.4, // highest stars, units above the floor in the video
  risePow: 1.7, // >1 = most stars stay low, a few go high

  // size: much smaller than before (was 0.105 - 0.175)
  sizeMin: LOOK.starRadius * 0.047, // ~0.03
  sizeMax: LOOK.starRadius * 0.065, // ~0.06

  sway: 0.02, // wobble while climbing only
  // optional: popTime (0.18), easePow (2.2), spinMin (0.05), spinMax (0.14), tilt, tiltJitter
};
// removed (no longer used): riseTime, maxDelay, fadeIn
