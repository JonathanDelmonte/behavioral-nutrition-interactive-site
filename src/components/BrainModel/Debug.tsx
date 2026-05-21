"use client";

import { useThree } from "@react-three/fiber";
import { Component, useEffect, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Swallows render-time errors in the 3D subtree so the rest of the page survives. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[BrainModel ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

/** Suspense fallback while the GLB resolves — invisible placeholder; the brain is the only thing that should be visible. */
export function LoaderCube() {
  return null;
}

/** Points the default camera at the given target (R3F does not auto-lookAt when only
 *  the `camera` prop's position is set on <Canvas>). */
export function CameraTarget({
  tx = 0,
  ty = 0,
  tz = 0,
}: {
  tx?: number;
  ty?: number;
  tz?: number;
}) {
  const state = useThree();
  useEffect(() => {
    state.camera.lookAt(tx, ty, tz);
    state.camera.updateProjectionMatrix();
    if (process.env.NODE_ENV !== "production") {
      (window as typeof window & { __R3F?: unknown }).__R3F = state;
    }
  }, [state, tx, ty, tz]);
  return null;
}
