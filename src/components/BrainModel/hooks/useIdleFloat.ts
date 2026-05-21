"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject } from "react";
import { type Object3D } from "three";

interface UseIdleFloatOptions {
  amplitude?: number;
  frequency?: number;
  phase?: number;
  baseY?: number;
  enabled?: boolean;
  onUpdate?: (offsetY: number) => void;
}

export function useIdleFloat(
  ref: RefObject<Object3D>,
  {
    amplitude = 0.04,
    frequency = 0.3,
    phase = 0,
    baseY = 0,
    enabled = true,
    onUpdate,
  }: UseIdleFloatOptions = {},
) {
  useFrame(({ clock }) => {
    if (!enabled || !ref.current) return;
    const t = clock.elapsedTime;
    const offset = Math.sin(t * frequency * Math.PI * 2 + phase) * amplitude;
    ref.current.position.y = baseY + offset;
    onUpdate?.(offset);
  });
}
