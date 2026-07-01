"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
} from "@react-three/postprocessing";
import { Suspense, useEffect, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { BrainStateProvider, type BrainIntensity } from "./BrainContext";
import { Scene } from "./Scene";
import { ErrorBoundary, LoaderCube } from "./Debug";
import { CAMERA, type BrainPlacement } from "./constants";

export interface BrainModelProps {
  /** Uniform scale (number) or per-axis scale ([x,y,z]). Default: 1. */
  scale?: number | [number, number, number];
  /** World-space position of the model's center. Default: [0,0,0]. */
  position?: [number, number, number];
  /**
   * Intensity multipliers for each animation channel (0..1+).
   *   - idle: idle float + per-fruit micro-wobble + follow lag
   *   - magnetism: mouse-driven group tilt
   *   - hover: per-fruit lift on cursor contact
   * All default to 1.
   */
  intensity?: Partial<BrainIntensity>;
  /**
   * Live scroll-travel progress (0 = resting at the first stage slot, rising as
   * the brain travels between sections). Passed as a ref so per-scroll-frame
   * updates don't re-render the R3F tree — BrainGroup reads `.current` inside
   * useFrame to drive the descent spin (and, later, fruit exodus). Optional:
   * when absent the brain just does its idle/hover/click animations.
   */
  progressRef?: { current: number };
  /**
   * Live world-space placement (position + uniform scale) for the model. When
   * provided, it OVERRIDES the static `scale`/`position` props each frame —
   * letting a host render the brain anywhere inside a larger canvas (e.g. a
   * full-viewport stage) while keeping the model itself page-agnostic. Passed
   * as a ref so per-scroll-frame updates don't re-render the R3F tree.
   */
  placementRef?: { current: BrainPlacement | null };
  /** Optional CSS class for the wrapping <div>. Defaults to filling its parent. */
  className?: string;
  /**
   * Render gate. While false the Canvas frameloop is fully paused ("never") —
   * no scene render, no composer passes, no useFrame work. The host flips this
   * off when the brain is far outside the viewport (deep page sections), where
   * a full-viewport render every frame was pure waste. Defaults to true.
   */
  active?: boolean;
}

const DEFAULT_INTENSITY: BrainIntensity = { idle: 1, magnetism: 1, hover: 1 };

/**
 * Progressive quality tiers for weak GPUs (older phones, budget laptops).
 * Tier 0 is the exact previous fixed configuration — strong devices never leave
 * it and render pixel-identical to before. When PerformanceMonitor reports a
 * sustained low frame rate the tier ratchets DOWN (never back up, so it can't
 * oscillate), cutting the two dominant fill-rate costs: device-pixel ratio
 * (pixel count scales with its square) and the composer's MSAA buffer.
 * `dprCap` is applied as dpr=[1, cap], so a dpr-1 desktop is never upscaled.
 */
const QUALITY_TIERS: { dprCap: number; multisampling: number }[] = [
  { dprCap: 2, multisampling: 8 },
  { dprCap: 1.5, multisampling: 2 },
  { dprCap: 1, multisampling: 0 },
];

/**
 * Mounts the fps watchdog only after the scene has settled: it lives inside
 * the <Suspense> (assets loaded) and further arms itself a few seconds later,
 * so the shader-compile / first-paint jank of a NORMAL load never counts as
 * "this device is slow" and degrades a perfectly capable machine.
 */
function AdaptiveQuality({ onDecline }: { onDecline: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), 3000);
    return () => clearTimeout(id);
  }, []);
  if (!armed) return null;
  return <PerformanceMonitor onDecline={onDecline} />;
}

/**
 * Fires `brain:ready` once — and sets a window flag for late listeners. Because
 * it lives INSIDE the <Suspense> below (next to <Scene/>, which suspends on both
 * the GLB and the HDRI), it only mounts after the brain is fully loaded and
 * about to paint. The boot preloader waits for this so it never reveals the Hero
 * with an empty hole where the brain should be.
 */
function ReadySignal() {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      (window as unknown as { __brainReady?: boolean }).__brainReady = true;
      window.dispatchEvent(new Event("brain:ready"));
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

/**
 * Fully self-contained 3D brain. Pass scale/position/intensity from the caller —
 * no assumptions about page layout, header, or background color are made here.
 */
export function BrainModel({
  scale = 1,
  position = [0, 0, 0],
  intensity,
  progressRef,
  placementRef,
  className,
  active = true,
}: BrainModelProps) {
  const merged: BrainIntensity = { ...DEFAULT_INTENSITY, ...intensity };
  const [tier, setTier] = useState(0);
  const quality = QUALITY_TIERS[tier];

  return (
    <div className={className ?? "w-full h-full"}>
      <Canvas
        shadows
        frameloop={active ? "always" : "never"}
        dpr={[1, quality.dprCap]}
        camera={{
          position: CAMERA.position,
          fov: CAMERA.fov,
          near: CAMERA.near,
          far: CAMERA.far,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          outputColorSpace: SRGBColorSpace,
        }}
        style={{
          width: "100%",
          height: "100%",
          // On touch devices, dragging a finger over the brain should drive the
          // hover field — the same way moving a mouse does on desktop. Browsers
          // default `touch-action: auto`, which lets the OS hijack the gesture
          // for scroll/zoom before R3F sees it. Disabling that hands every
          // pointermove to the canvas, so the finger acts as a "hovering cursor"
          // for as long as it's down. `user-select: none` keeps text/image
          // selection from triggering on long drags.
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <BrainStateProvider intensity={merged}>
          <ErrorBoundary>
            <Suspense fallback={<LoaderCube />}>
              <ReadySignal />
              <AdaptiveQuality
                onDecline={() =>
                  setTier((t) => Math.min(QUALITY_TIERS.length - 1, t + 1))
                }
              />
              <Scene
                scale={scale}
                position={position}
                progressRef={progressRef}
                placementRef={placementRef}
              />
              <EffectComposer multisampling={quality.multisampling}>
                <HueSaturation hue={0} saturation={0.4} />
                <BrightnessContrast brightness={0.04} contrast={0.2} />
                <Bloom
                  intensity={0.28}
                  luminanceThreshold={0.85}
                  luminanceSmoothing={0.4}
                  mipmapBlur
                />
              </EffectComposer>
            </Suspense>
          </ErrorBoundary>
        </BrainStateProvider>
      </Canvas>
    </div>
  );
}

export default BrainModel;
