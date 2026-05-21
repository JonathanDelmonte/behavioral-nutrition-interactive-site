"use client";

import { useCallback, useRef } from "react";
import { type ThreeEvent } from "@react-three/fiber";

interface UseHoverLiftReturn {
  /** Live target (1 when hovered, 0 when not). Update progress externally via damp. */
  hoverTarget: { current: number };
  /** Smoothed progress 0..1 — written/read inside useFrame. */
  hoverProgress: { current: number };
  /** Whether the cursor is currently over the fruit (for sustained-state effects). */
  isHovered: { current: boolean };
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

export function useHoverLift(): UseHoverLiftReturn {
  const hoverTarget = useRef(0);
  const hoverProgress = useRef(0);
  const isHovered = useRef(false);

  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoverTarget.current = 1;
    isHovered.current = true;
  }, []);

  const onPointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoverTarget.current = 0;
    isHovered.current = false;
  }, []);

  return { hoverTarget, hoverProgress, isHovered, onPointerOver, onPointerOut };
}
