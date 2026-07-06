"use client";

import { useGLTF } from "@react-three/drei";
import { useLoader, useThree } from "@react-three/fiber";
import { Component, Fragment, useEffect, type ReactNode } from "react";
import { RGBELoader } from "three-stdlib";
import { HDRI_PATH, MODEL_PATH } from "./constants";

interface State {
  error: Error | null;
  attempt: number;
}

/** Errors here are usually TRANSIENT (a flaky mobile network failing a loader
 *  fetch, a GPU hiccup) — retry this many times, with exponential backoff,
 *  before giving up for good. */
const MAX_RETRIES = 3;

/**
 * Catches render-time errors in the 3D subtree so the rest of the page
 * survives — and RETRIES instead of blanking the brain forever. The old
 * boundary rendered null permanently, so one dropped fetch on a spotty
 * connection meant "the brain never appears until a manual reload". Each
 * retry drops the loaders' cached rejections (so they genuinely re-fetch)
 * and remounts the whole subtree under a fresh key.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, attempt: 0 };
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[BrainModel ErrorBoundary]", error, info?.componentStack);
    if (this.state.attempt >= MAX_RETRIES) return;
    const delay = 1000 * 2 ** this.state.attempt;
    this.retryTimer = setTimeout(() => {
      try {
        // useLoader caches rejections by (loader, url) — without clearing,
        // the remount would replay the cached failure instantly instead of
        // hitting the network again.
        useGLTF.clear(MODEL_PATH);
        useLoader.clear(RGBELoader, HDRI_PATH);
      } catch {
        /* best-effort: an unexpected cache shape must not kill the retry */
      }
      this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
    }, delay);
  }

  componentWillUnmount() {
    clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.error) return null;
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
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
