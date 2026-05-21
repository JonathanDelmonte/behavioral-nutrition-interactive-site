"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, MathUtils, Vector3 } from "three";
import { ANIMATION } from "./constants";
import { useBrainState } from "./BrainContext";
import type { NodeRender } from "./BrainGroup";

interface FruitProps {
  render: NodeRender;
  /** Deterministic per-fruit hash (0..2π). Used as jitter seed so fruits
   *  desynchronize subtly during the hover-fall phase. */
  phase: number;
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
export function Fruit({ render }: FruitProps) {
  const groupRef = useRef<Group>(null!);
  const {
    intensity,
    normScale,
    hoverPoint,
    hoverIntensity,
    pulses,
  } = useBrainState();

  const [bx, by, bz] = render.worldPosition;
  const [dx, dy, dz] = render.outDirection;

  // Smoothed influence (0..1) for this fruit's hover. Damped each frame.
  const progress = useRef(0);

  // Re-used scratch vector so we don't allocate per frame.
  const tmp = useMemo(() => new Vector3(), []);

  useFrame((_state, dt) => {
    const g = groupRef.current;
    if (!g || !g.parent) return;

    const inv = 1 / (normScale.current || 1);

    // Base world position (without the live lift offset), used for both the
    // hover field and the click ripple distance calculations.
    tmp.set(bx, by, bz).applyMatrix4(g.parent.matrixWorld);

    // --- Hover field (Gaussian cone around the LAST known cursor point) ----
    // Same Gaussian no matter where the cursor is — even after it leaves the
    // aura. What changes is `hoverIntensity` (global scalar 0..1) which
    // smoothly fades the strength of the entire field. So fruits' rise and
    // fall both follow the same continuous curve.
    const distHover = tmp.distanceTo(hoverPoint.current);
    const SIGMA = ANIMATION.hover.coneSigma;
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
      const speed = ANIMATION.pulse.speed;
      const peakTime = ANIMATION.pulse.peakTime;
      const maxRadius = ANIMATION.pulse.maxRadius;
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

    const lift = (hoverLift + pulseLift) * inv * intensity.hover;

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
