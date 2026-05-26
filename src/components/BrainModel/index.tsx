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
  className,
}: BrainModelProps) {
  const merged: BrainIntensity = { ...DEFAULT_INTENSITY, ...intensity };

  return (
    <div className={className ?? "w-full h-full"}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [8.0, 0.8, 1.2], fov: 32, near: 0.1, far: 100 }}
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
              <Scene scale={scale} position={position} />
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
