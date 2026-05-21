// NEXT_PUBLIC_BASE_PATH is empty on local dev / Vercel / normal builds, and
// set to "/<repo>" only when we're building for GitHub Pages — this keeps the
// GLB URL valid in every hosting scenario.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const MODEL_PATH = `${BASE_PATH}/models/v7_sweetspot.glb`;
export const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/";

export const BRAIN_PART_NAMES = [
  "Brain_Part_02",
  "Brain_Part_04",
  "Brain_Part_05",
  "Brain_Part_06",
] as const;

export const SEED_NAME = "sementeverde_01";

export const FRUIT_NAMES: string[] = [
  ...Array.from({ length: 8 }, (_, i) => `banana_${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 12 }, (_, i) => `blueberry_${String(i + 1).padStart(2, "0")}`),
  "kiwi_01",
  "kiwi_02",
  "laranja_01",
  "laranja_02",
  "laranja_03",
  ...Array.from({ length: 11 }, (_, i) => `morango_${String(i + 1).padStart(2, "0")}`),
];

export const ANIMATION = {
  // All amplitudes below are expressed in NORMALIZED world units (brain ~2 units wide).
  // BrainGroup divides them by `normScale` when applying, since the animated groups
  // live inside the normalize chain.
  idle: {
    amplitude: 0.025,
    frequency: 0.25,
  },
  microWobble: {
    amplitude: 0.006,
    frequency: 0.45,
  },
  followLag: {
    lambda: 5.5,
  },
  magnetism: {
    maxRotationX: 0.09,
    maxRotationZ: 0.125,
    lambda: 3,
  },
  hover: {
    /** Distance the fruit travels outward from the brain center on full hover. */
    liftHeight: 0.4,
    /** Damping for the rise (toward 1). Lower = slower, more weight. */
    riseLambda: 2.5,
    /** Damping for the fall (toward 0). Used both while the cursor is inside
     *  the aura and after — the difference between "active hover" and "idle
     *  settle" is now driven by the global hoverIntensity instead of two
     *  separate fall rates. */
    fallLambda: 2.8,
    /** Standard deviation of the Gaussian influence cone (normalized world units).
     *  Smaller = more focused — central fruit dominates, distant ones barely react. */
    coneSigma: 0.38,
    /** Damping lambda for the global hover-intensity scalar. When the cursor
     *  leaves the aura, intensity decays from 1→0 with this lambda — the same
     *  Gaussian field stays, but its strength fades smoothly, so fruits ease
     *  back to rest using the same animation curve as during active hover. */
    intensityLambda: 1.4,
  },
  /** Reaction of the WHOLE brain (not the individual fruits) to a click.
   *  The brain is floating in space — a click should make it wobble briefly,
   *  then settle back into its idle float. Like a buoy poked with a finger. */
  impact: {
    /** Peak linear push, in the direction AWAY from the click. */
    displacement: 0.085,
    /** Peak tilt in radians (~5.7°) — lean toward the click. */
    rotation: 0.1,
    /** Peak uniform scale pulse — brain "breath" at the impact moment. */
    scalePulse: 0.04,
    /** Time scale: rise to peak target value. The spring physics below then
     *  decides how the brain actually chases that target — with momentum,
     *  slight overshoot, and natural settle. */
    peakTime: 0.22,
    /** Spring stiffness — how strongly the brain pulls back toward the target.
     *  Higher = quicker reaction; together with `damping` it defines the
     *  oscillation period (~2π/√k seconds with critical damping). */
    stiffness: 70,
    /** Spring damping — resistance to velocity. Tuned slightly below critical
     *  (2·√stiffness ≈ 16.7) so the brain shows a soft, barely-perceptible
     *  overshoot. No cartoonish bouncing — just a hint of mass. */
    damping: 14,
  },
  pulse: {
    /** Peak lift at the epicenter for the click ripple. */
    amplitude: 0.34,
    /** Radial speed of the wave (normalized world units per second). Higher =
     *  fruit under the cursor reacts more immediately; lower = visible delay. */
    speed: 5.0,
    /** Time from wavefront arrival to peak lift on a single fruit (seconds). */
    peakTime: 0.14,
    /** Max distance a ripple reaches before spatial decay zeros out. */
    maxRadius: 1.6,
    /** Total click animation duration. Clicks during this window AT THE SAME
     *  SPOT (within cooldownDistance) are ignored. With single ripple + gamma
     *  tail of ~1.6s, lifetime of 1.6s lets the next click come right when
     *  the previous animation visually finishes. */
    lifetime: 1.6,
    /** Single clean ripple per click — one rise+fall per fruit when the wave
     *  passes. Amplitude is dialed up to compensate for not having a second wave. */
    ripples: [
      { offset: 0, amp: 1.0 },
    ],
    /** New clicks landing closer than this distance to an active pulse (world
     *  units, normalized) are rejected so they don't overlap visually. Below
     *  this radius the new and old waves would share too many fruits and
     *  visually look like a reset; outside it they're clearly distinct ripples. */
    cooldownDistance: 0.35,
  },
} as const;
