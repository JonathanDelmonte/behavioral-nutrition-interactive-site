"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group, type Material, MathUtils, Vector3 } from "three";
import { ANIMATION } from "./constants";
import { useBrainState } from "./BrainContext";
import type { NodeRender } from "./BrainGroup";

interface FruitProps {
  render: NodeRender;
  /** Deterministic per-fruit hash (0..2π). Used as jitter seed so fruits
   *  desynchronize subtly during the hover-fall phase. */
  phase: number;
  /** Index of this fruit among all fruits — used to stagger the exodus so
   *  fruit leave in a wave instead of all at once. */
  index: number;
  /** Total fruit count — normalizes the stagger window. */
  total: number;
}

/**
 * Each fruit reacts to the cursor's intersection point on the brain with a
 * Gaussian-falloff lift: the closest fruit gets the full lift, neighbors get
 * proportionally less, and far-away fruits don't move at all. The lift direction
 * is the fruit's own outward radial (pre-computed against the brain's bbox center).
 *
 * Net effect: cursor acts like a soft vacuum cleaner — a cone of influence with
 * the peak directly under the cursor and a smooth skirt around it.
 */
export function Fruit({ render, index, total }: FruitProps) {
  const groupRef = useRef<Group>(null!);
  const {
    intensity,
    normScale,
    brainWorldScale,
    hoverPoint,
    hoverIntensity,
    pulses,
    exodus,
  } = useBrainState();

  const [bx, by, bz] = render.worldPosition;
  const [dx, dy, dz] = render.outDirection;

  // Smoothed influence (0..1) for this fruit's hover. Damped each frame.
  const progress = useRef(0);

  // Re-used scratch vector so we don't allocate per frame.
  const tmp = useMemo(() => new Vector3(), []);

  // Flatten this fruit's materials once so the exodus fade can drive their
  // opacity directly. Each fruit's materials are independent clones (the
  // clearcoat override in BrainGroup clones per node), so mutating them here is
  // safe and won't bleed into other fruits.
  const materials = useMemo(() => {
    const out: Material[] = [];
    for (const m of render.meshes) {
      if (Array.isArray(m.material)) out.push(...m.material);
      else out.push(m.material);
    }
    return out;
  }, [render]);

  // Enable transparency up front (so the exodus fade doesn't trigger a shader
  // recompile mid-scroll) and restore full opacity on unmount.
  useEffect(() => {
    for (const m of materials) m.transparent = true;
    return () => {
      for (const m of materials) {
        m.opacity = 1;
        m.transparent = false;
      }
    };
  }, [materials]);

  // This fruit's exodus window: it starts leaving at `start` (staggered by
  // index) and is fully gone `duration` later, both expressed in travel-progress.
  const start = total > 1 ? (index / (total - 1)) * ANIMATION.exodus.stagger : 0;

  useFrame((_state, dt) => {
    const g = groupRef.current;
    if (!g || !g.parent) return;

    const inv = 1 / (normScale.current || 1);

    // All distance-based animation constants (coneSigma, maxRadius, speed)
    // are authored in NORMALIZED units (brain ~2 wide → radius 1). The
    // distances we measure below are in WORLD units, scaled by the host's
    // <BrainModel scale={…}> prop. Multiplying the constants by the brain's
    // effective world scale keeps the cone-around-the-cursor consistent at
    // any scale — at scale 1 the multiplier is 1 and behavior is unchanged.
    const bws = brainWorldScale.current || 1;

    // Base world position (without the live lift offset), used for both the
    // hover field and the click ripple distance calculations.
    tmp.set(bx, by, bz).applyMatrix4(g.parent.matrixWorld);

    // --- Hover field (Gaussian cone around the LAST known cursor point) ----
    // Same Gaussian no matter where the cursor is — even after it leaves the
    // aura. What changes is `hoverIntensity` (global scalar 0..1) which
    // smoothly fades the strength of the entire field. So fruits' rise and
    // fall both follow the same continuous curve.
    const distHover = tmp.distanceTo(hoverPoint.current);
    const SIGMA = ANIMATION.hover.coneSigma * bws;
    const baseTarget =
      distHover < SIGMA * 3
        ? Math.exp((-distHover * distHover) / (2 * SIGMA * SIGMA))
        : 0;
    const target = baseTarget * hoverIntensity.current;

    // Single damp lambda — asymmetric only at the per-fruit level (rise faster
    // than fall) for that lingering "weight" feel on the way down.
    const lambda =
      target > progress.current
        ? ANIMATION.hover.riseLambda
        : ANIMATION.hover.fallLambda;
    progress.current = MathUtils.damp(progress.current, target, lambda, dt);

    const p = progress.current;
    const eased = p * p * (3 - 2 * p);
    const hoverLift = eased * ANIMATION.hover.liftHeight;

    // --- Click ripples (sum of active pulses, each with internal sub-ripples) -
    // Multiple distant clicks can coexist in the array. For each active pulse,
    // this fruit experiences up to 2 concentric sub-ripples — same origin,
    // staggered offsets, diminishing amplitudes. Each sub-ripple is a clean
    // monotonic bump (rise + fall) when its wavefront arrives.
    let pulseLift = 0;
    if (pulses.current.length > 0) {
      const now = performance.now() / 1000;
      // speed (world units / sec) and maxRadius (world units) scale with the
      // brain's world size — peakTime is a pure duration and stays as-is.
      const speed = ANIMATION.pulse.speed * bws;
      const peakTime = ANIMATION.pulse.peakTime;
      const maxRadius = ANIMATION.pulse.maxRadius * bws;
      const amplitude = ANIMATION.pulse.amplitude;

      for (const pulse of pulses.current) {
        const elapsed = now - pulse.startTime;
        if (elapsed < 0 || elapsed > ANIMATION.pulse.lifetime) continue;
        const dist = tmp.distanceTo(pulse.origin);
        if (dist >= maxRadius) continue;

        // Cubic spatial falloff — epicenter dominates, mid quickly fades.
        const s = 1 - dist / maxRadius;
        const spatial = s * s * s;

        for (const ripple of ANIMATION.pulse.ripples) {
          const localT = elapsed - ripple.offset - dist / speed;
          if (localT < 0) continue;
          const r = localT / peakTime;
          if (r > 8) continue;
          const temporal = r * Math.exp(1 - r);
          if (temporal < 0.005) continue;
          pulseLift += temporal * spatial * amplitude * ripple.amp;
        }
      }
    }

    // --- Scroll exodus: fly outward + fade as the brain descends ----------
    // Rescale raw travel progress onto [0, completeBy] so the whole exodus
    // finishes before the brain settles (margin for arrival rounding). Then a
    // per-fruit staggered, eased window drives each fruit outward + fade.
    const e = Math.min(1, exodus.current / ANIMATION.exodus.completeBy);
    let exodusLift = 0;
    if (e > start) {
      const local = Math.min(1, (e - start) / ANIMATION.exodus.duration);
      const eased = local * local;
      const op = 1 - eased;
      for (const m of materials) if (m.opacity !== op) m.opacity = op;
      // Normal fly-out distance PLUS a "banish" term that accelerates the fruit
      // FAR off-canvas as it fades past the halfway point. This guarantees the
      // faint tail of the fade — and any fruit left stalled near the end of its
      // exodus (e.g. if travel progress freezes just short of 1) — ends up WELL
      // outside the viewport instead of lingering as a small dot near the brain.
      // It is ~0 while the fruit is still clearly visible (opacity ≥ 0.5) and
      // ramps up hard as opacity → 0, so the visible part of the fly-out reads
      // the same as before.
      const fade = Math.max(0, (0.5 - op) / 0.5);
      exodusLift =
        eased * ANIMATION.exodus.distance +
        fade * fade * (ANIMATION.exodus.distance * 120);
    } else {
      for (const m of materials) if (m.opacity !== 1) m.opacity = 1;
    }

    // Hover + pulse lifts are authored in normalized units (× intensity), and
    // so is the exodus distance; sum them, then convert to pre-normalize units.
    const lift = ((hoverLift + pulseLift) * intensity.hover + exodusLift) * inv;

    g.position.set(bx + dx * lift, by + dy * lift, bz + dz * lift);
  });

  return (
    <group
      ref={groupRef}
      position={render.worldPosition}
      quaternion={render.worldQuaternion}
      scale={render.worldScale}
    >
      {render.meshes.map((m, i) => (
        <mesh
          key={i}
          geometry={m.geometry}
          material={m.material}
          position={m.position}
          quaternion={m.quaternion}
          scale={m.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
