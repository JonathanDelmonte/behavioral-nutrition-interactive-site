"use client";

import { PerformanceMonitor, Preload } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
} from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
 *
 * The floor stays SHARP on purpose (1.5× dpr, MSAA still on): the earlier
 * floor of dpr 1 / MSAA 0 read as visibly blurry + jagged on phones. Even so
 * this floor is ~7× lighter than tier 0 in raw buffer bandwidth (dpr² ×
 * samples), and the tier is also mirrored onto <html data-gpu-tier> (effect
 * inside BrainModel) so CSS can shed the page's OTHER big GPU cost —
 * Identify's backdrop-blur bubbles, re-blurred every frame over this very
 * canvas — which buys back far more than the extra sharpness spends.
 */
const QUALITY_TIERS: { dprCap: number; multisampling: number }[] = [
  { dprCap: 2, multisampling: 8 },
  { dprCap: 1.75, multisampling: 4 },
  { dprCap: 1.5, multisampling: 2 },
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
 * Fires `brain:ready` once — and sets a window flag for late listeners. It
 * lives INSIDE the <Suspense> below (next to <Scene/>), so it can only run
 * after the GLB + HDRI are decoded; <Preload all/> (same boundary) has then
 * already force-compiled every shader and uploaded every texture during the
 * same commit. The event itself waits one further frame: it dispatches only
 * AFTER the first real render has been presented. The old signal fired when
 * the brain was merely "about to start rendering" — and on weak GPUs the
 * first-render compile stall sat exactly in that gap, so the boot preloader
 * revealed the Hero while the canvas was still blank (the "invisible brain").
 *
 * If the frameloop is paused (`active=false`: a reload restored the scroll
 * deep into the page, brain far off-screen) no frame will ever render — fire
 * immediately instead, since there is nothing visible to wait for and the
 * preloader must not be held hostage.
 */
function ReadySignal() {
  const frameloop = useThree((s) => s.frameloop);
  const fired = useRef(false);

  const fire = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    (window as unknown as { __brainReady?: boolean }).__brainReady = true;
    window.dispatchEvent(new Event("brain:ready"));
  }, []);

  useFrame(() => {
    // Registered DURING a frame R3F is about to render, so the callback lands
    // on the NEXT animation frame — after this first frame was presented.
    if (!fired.current) requestAnimationFrame(fire);
  });

  useEffect(() => {
    if (frameloop === "never") fire();
  }, [frameloop, fire]);

  return null;
}

/**
 * Fully self-contained 3D brain. Pass scale/position/intensity from the caller —
 * no assumptions about page layout, header, or background color are made here.
 */
/** How long to wait for the browser's own `webglcontextrestored` before
 *  rebuilding the context ourselves, and how many rebuilds to attempt. */
const CONTEXT_RESTORE_WAIT_MS = 3000;
const MAX_CONTEXT_REBUILDS = 3;

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

  // WebGL context-loss belt. three.js preventDefault()s `webglcontextlost`,
  // which asks the browser to restore the context — and when the restore
  // arrives, three rebuilds its GL state and the loader-cached geometry/
  // textures re-upload transparently. But memory-pressured mobile browsers
  // sometimes never fire the restore, which left a permanently blank canvas
  // ("the brain vanished until a manual reload"). If no restore lands within
  // CONTEXT_RESTORE_WAIT_MS, bump the <Canvas> key for a brand-new context —
  // everything rebuilds from the in-memory caches, nothing re-downloads.
  const [glEpoch, setGlEpoch] = useState(0);
  const ctxRebuilds = useRef(0);
  const ctxLossTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(ctxLossTimer.current), []);
  const watchContextLoss = useCallback((canvasEl: HTMLCanvasElement) => {
    canvasEl.addEventListener("webglcontextlost", () => {
      if (ctxRebuilds.current >= MAX_CONTEXT_REBUILDS) return;
      window.clearTimeout(ctxLossTimer.current);
      ctxLossTimer.current = window.setTimeout(() => {
        ctxRebuilds.current += 1;
        setGlEpoch((e) => e + 1);
      }, CONTEXT_RESTORE_WAIT_MS);
    });
    canvasEl.addEventListener("webglcontextrestored", () => {
      window.clearTimeout(ctxLossTimer.current);
    });
  }, []);

  // Soft reveal: the wrap starts transparent and fades in once the brain has
  // actually painted (brain:ready). Normally that completes while the boot
  // overlay still covers the page, so nothing visibly changes — but when the
  // brain is LATE (the preloader's hard cap fired on a dying network, or an
  // error retry finally succeeded), it eases into the already-revealed Hero
  // instead of popping in fully formed between two frames.
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    if ((window as unknown as { __brainReady?: boolean }).__brainReady) {
      setPainted(true);
      return;
    }
    const onReady = () => setPainted(true);
    window.addEventListener("brain:ready", onReady);
    return () => window.removeEventListener("brain:ready", onReady);
  }, []);

  // Mirror the tier onto <html data-gpu-tier="…"> so plain CSS joins the
  // degradation (see Identify.module.css: at the lowest tier the glassy
  // bubbles drop their backdrop blurs and blur() swap animations, which are
  // re-rasterized every frame over this canvas and dominate the section's
  // GPU cost on weak devices).
  useEffect(() => {
    document.documentElement.dataset.gpuTier = String(tier);
  }, [tier]);

  return (
    <div
      className={className ?? "w-full h-full"}
      style={{ opacity: painted ? 1 : 0, transition: "opacity 0.45s ease" }}
    >
      <Canvas
        key={glEpoch}
        shadows
        frameloop={active ? "always" : "never"}
        onCreated={({ gl }) => watchContextLoss(gl.domElement)}
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
              {/* Force-compile every shader + upload every texture in the
                  same commit the Suspense resolves (still under the boot
                  overlay), so the first visible frame doesn't stall on the
                  compile — that stall is what used to reveal a brainless
                  Hero on weak GPUs. */}
              <Preload all />
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
