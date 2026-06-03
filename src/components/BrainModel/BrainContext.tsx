"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { Vector3 } from "three";

export interface BrainIntensity {
  idle: number;
  magnetism: number;
  hover: number;
}

interface BrainStateValue {
  coreOffsetY: { current: number };
  intensity: BrainIntensity;
  /** Scale factor used to normalize the GLB to a ~2-unit cube. Animation
   *  amplitudes in `constants.ts` are authored in normalized units; consumers
   *  inside the normalize chain divide by this to compensate. */
  normScale: { current: number };
  /** Effective world-space uniform scale of the brain (everything above the
   *  normalize chain — e.g. the `scale` prop the host passes to BrainModel).
   *  Driven by BrainGroup each frame from the outer group's worldMatrix.
   *  Hover / pulse math reads this to keep the cursor-driven Gaussian field
   *  consistent regardless of how the host scales the model: when the brain
   *  is bigger in world units, SIGMA and the collider sphere both scale up
   *  by the same factor so the cone-around-the-cursor preserves its angular
   *  reach. Defaults to 1 so behavior at scale=1 is unchanged. */
  brainWorldScale: { current: number };
  /** Last known cursor intersection on the brain (world coords). Updated
   *  continuously by the hover collider while the cursor is over it. */
  hoverPoint: { current: Vector3 };
  /** Whether the cursor is currently over the brain's hover collider. */
  isHoveringBrain: { current: boolean };
  /** Global scalar 0..1 multiplied into every fruit's hover target. Smoothly
   *  damps toward 1 while the cursor is inside the aura and back toward 0
   *  when it leaves — unifies the rise and fall under one continuous curve. */
  hoverIntensity: { current: number };
  /** Active click ripples. Multiple clicks coexist — old ones are pruned by
   *  the click handler when they exceed their useful lifetime. */
  pulses: { current: Pulse[] };
  /** Scroll-travel "exodus" progress, 0..1. Published by BrainGroup from the
   *  host's progressRef. Each Fruit reads it to fly radially outward and fade
   *  as the brain descends into Section 2, leaving the bare "clean" brain the
   *  reference shows. 0 = all fruit in place; 1 = all fruit gone. */
  exodus: { current: number };
}

export interface Pulse {
  origin: Vector3;
  /** performance.now() / 1000 when the click happened. The per-fruit math
   *  derives all internal ripple timings from this single timestamp. */
  startTime: number;
}

const BrainContext = createContext<BrainStateValue | null>(null);

export function BrainStateProvider({
  children,
  intensity,
}: {
  children: ReactNode;
  intensity: BrainIntensity;
}) {
  const coreOffsetY = useRef(0);
  const normScale = useRef(1);
  const brainWorldScale = useRef(1);
  const hoverPoint = useRef(new Vector3(0, 9999, 0));
  const isHoveringBrain = useRef(false);
  const hoverIntensity = useRef(0);
  const pulses = useRef<Pulse[]>([]);
  const exodus = useRef(0);
  const value = useMemo<BrainStateValue>(
    () => ({
      coreOffsetY,
      intensity,
      normScale,
      brainWorldScale,
      hoverPoint,
      isHoveringBrain,
      hoverIntensity,
      pulses,
      exodus,
    }),
    [intensity],
  );
  return <BrainContext.Provider value={value}>{children}</BrainContext.Provider>;
}

export function useBrainState(): BrainStateValue {
  const ctx = useContext(BrainContext);
  if (!ctx) {
    throw new Error("useBrainState must be used inside <BrainStateProvider>");
  }
  return ctx;
}
