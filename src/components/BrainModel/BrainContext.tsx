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
  const hoverPoint = useRef(new Vector3(0, 9999, 0));
  const isHoveringBrain = useRef(false);
  const hoverIntensity = useRef(0);
  const pulses = useRef<Pulse[]>([]);
  const value = useMemo<BrainStateValue>(
    () => ({
      coreOffsetY,
      intensity,
      normScale,
      hoverPoint,
      isHoveringBrain,
      hoverIntensity,
      pulses,
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
