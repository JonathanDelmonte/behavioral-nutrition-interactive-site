"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject } from "react";
import { MathUtils, type Object3D } from "three";

interface UseMouseMagnetismOptions {
  /** Pitch amplitude (radians) — applied when mouse moves vertically. */
  maxRotationX?: number;
  /** Roll amplitude (radians) — applied when mouse moves horizontally. */
  maxRotationZ?: number;
  lambda?: number;
  intensity?: number;
  enabled?: boolean;
  /** When set, the target tilt is zero unless this ref is currently true.
   *  Use to gate the effect to a hover collider so the brain only tilts when
   *  the cursor is actually over it. */
  isActive?: { readonly current: boolean };
}

/**
 * "Plank-on-a-spring" tilt: the model leans toward the cursor as if pressed
 * at its edge. Uses pitch (rotation.x) and roll (rotation.z) only — no yaw.
 */
export function useMouseMagnetism(
  ref: RefObject<Object3D>,
  {
    maxRotationX = 0.045,
    maxRotationZ = 0.06,
    lambda = 6,
    intensity = 1,
    enabled = true,
    isActive,
  }: UseMouseMagnetismOptions = {},
) {
  useFrame(({ mouse }, dt) => {
    if (!enabled || !ref.current) return;
    const active = isActive?.current ?? true;
    const targetX = active ? mouse.y * maxRotationX * intensity : 0;
    const targetZ = active ? -mouse.x * maxRotationZ * intensity : 0;
    ref.current.rotation.x = MathUtils.damp(
      ref.current.rotation.x,
      targetX,
      lambda,
      dt,
    );
    ref.current.rotation.z = MathUtils.damp(
      ref.current.rotation.z,
      targetZ,
      lambda,
      dt,
    );
  });
}
