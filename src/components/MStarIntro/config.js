// // Everything tweakable lives here. Times are in seconds on the master GSAP timeline.
// export const DEFAULT_ASSETS = {
//   colorSrc: '/assets/mstar/maddy_color.jpg', // primary reference (reconstruction + hue)
//   monoSrc: '/assets/mstar/maddy_mono.png',   // silhouette + luminance reference
// };

// // Seconds for each part of the intro. Edit these; everything else follows.
// export const TIMING = {
//   star: 4.0,     // star flies in and collapses into light
//   letter: 3.0,   // metallic M appears and holds
//   explode: 2.9,  // M bursts into stars
//   fade: 1.9,     // explosion fades out, floor stars appear
//   build: 9.0,    // stars climb and form the portrait
//   hold: 2.0,     // final camera drift after the portrait is done
// };

// export const DURATION =
//   TIMING.star + TIMING.letter + TIMING.explode + TIMING.fade + 0.1 + TIMING.build + TIMING.hold; // 15 s now

// export const LOOK = {
//   fov: 30,
//   baseDistance: 9.5,       // camera distance that frames the portrait with ~7% margin at 1.43:1
//   aspect: 1.43,            // native cinema-screen aspect
//   starRadius: 1.75,
//   mScale: 1.2,             // size of the 3D "M"
//   mDepth: 0.5,
//   particleCount: 8200,
//   seed: 1337,
//   colorMix: 0.3,           // how much of the colour photograph's hue tints the silver stars (0 = pure silver)
//   bloom: { base: 0.12, radius: 0.4, threshold: 0.95 },
//   exposure: 1.0,
// };



// Everything tweakable lives here. Times are in seconds on the master GSAP timeline.
export const DEFAULT_ASSETS = {
  colorSrc: '/assets/mstar/maddy_color.jpg', // primary reference (reconstruction + hue)
  monoSrc: '/assets/mstar/maddy_mono.png',   // silhouette + luminance reference
};

// Seconds for each part of the intro. Edit these; everything else follows.
export const TIMING = {
  star: 4.0,     // star flies in and collapses into light
  letter: 3.0,   // metallic M appears and holds
  explode: 2.9,  // M bursts into stars
  fade: 1.9,     // explosion fades out, floor stars appear
  build: 7.0,    // stars climb and form the portrait
  hold: 4.0,     // final hold (was 2.0). The floor dust appears and rises during this phase.
};

export const DURATION =
  TIMING.star + TIMING.letter + TIMING.explode + TIMING.fade + 0.1 + TIMING.build + TIMING.hold;

export const LOOK = {
  fov: 30,
  baseDistance: 9.5,       // camera distance that frames the portrait with ~7% margin at 1.43:1
  aspect: 1.43,            // native cinema-screen aspect
  starRadius: 1.75,
  mScale: 1.2,             // size of the 3D "M"
  mDepth: 0.5,
  particleCount: 8200,
  seed: 1337,
  colorMix: 0.3,           // how much of the colour photograph's hue tints the silver stars (0 = pure silver)
  bloom: { base: 0.12, radius: 0.4, threshold: 0.95 },
  exposure: 1.0,
};

// Floor dust: the sparse stars that appear along the floor when the hold phase starts and drift upward.
export const DUST = {
  count: 50,          // 100-150 is the sweet spot
  floorLevel: 0.93,    // floor height, fraction of portrait half-height below centre (matches the sampler)
  floorThickness: 0.2, // vertical thickness of the bed, in portrait half-heights
  floorHalfWidth: 1.7, // half-width of the bed, in portrait half-heights (spread across the whole floor)
  floorDepth: 1.6,     // z spread of the bed
  riseMin: 0.6,        // how far a star travels up, world units (min)
  riseMax: 2.3,        // ... (max)
  maxDelay: 0.55,      // 0..1 share of the rise phase over which stars start moving (staggers them)
  sizeMin: LOOK.starRadius * 0.06, // star radius = 6% of the hero star (~0.105)
  sizeMax: LOOK.starRadius * 0.10, // up to 10% of the hero star (~0.175)
  sway: 0.035,         // sideways wobble while rising
  fadeIn: 0.6,         // seconds for the stars to pop in on the floor
};