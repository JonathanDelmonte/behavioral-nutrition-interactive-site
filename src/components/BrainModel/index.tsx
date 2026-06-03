"use client";

import { Canvas } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
} from "@react-three/postprocessing";
import { Suspense } from "react";
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
}

const DEFAULT_INTENSITY: BrainIntensity = { idle: 1, magnetism: 1, hover: 1 };

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
}: BrainModelProps) {
  const merged: BrainIntensity = { ...DEFAULT_INTENSITY, ...intensity };

  return (
    <div className={className ?? "w-full h-full"}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: CAMERA.position,
          fov: CAMERA.fov,
          near: CAMERA.near,
          far: CAMERA.far,
        }}
        gl={{
          antialias: true,
          alpha: true,
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
              <Scene
                scale={scale}
                position={position}
                progressRef={progressRef}
                placementRef={placementRef}
              />
              <EffectComposer>
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
