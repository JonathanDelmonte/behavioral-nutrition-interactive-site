"use client";

import { Environment } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { Group, Vector2, Vector3 } from "three";
import { Lighting } from "./Lighting";
import { BrainGroup, rayUnitSphereHit } from "./BrainGroup";
import { CameraTarget } from "./Debug";
import { useBrainState } from "./BrainContext";
import { usePrimeGate } from "./primeGate";
import { ANIMATION, HDRI_PATH, type BrainPlacement } from "./constants";

interface SceneProps {
  scale: number | [number, number, number];
  position: [number, number, number];
  /** Live scroll-travel progress ref (see BrainModelProps.progressRef). */
  progressRef?: { current: number };
  /** Live world-space placement ref (see BrainModelProps.placementRef). */
  placementRef?: { current: BrainPlacement | null };
}

/**
 * Inner scene contents (everything 3D inside the Canvas).
 * Camera lives on the Canvas itself so it does not get rescaled with the model.
 *
 * No ground plane / ContactShadows on purpose: the brand image should read as a
 * 3D object floating against a clean white page, not "viewed inside a 3D editor".
 */
export function Scene({ scale, position, progressRef, placementRef }: SceneProps) {
  // Suspend until the boot primer has seeded THREE.Cache with the GLB/HDRI/
  // draco bytes — rendering any earlier would let the loaders below race the
  // primer and re-download the same megabytes (see primeGate.ts).
  usePrimeGate();
  // Shared with MobileTap so a phone tap raycasts against the brain composition
  // ONLY (not lights / camera target).
  const brainGroupRef = useRef<Group>(null!);
  return (
    <>
      <Lighting />
      {/* HDRI environment — gives subtle, photo-realistic reflections on the
          fruit and brain surfaces. `background={false}` keeps the page white.

          Served from /public via HDRI_PATH (NOT drei's `preset="studio"`): the
          preset fetches this same HDR from an external CDN at runtime, and a
          single network/CDN hiccup throws "Failed to fetch", which crashes the
          entire 3D tree and the brain vanishes. HDRI_PATH carries the GitHub
          Pages BASE_PATH prefix (see constants.ts) so it resolves both on local
          dev (served from root) and on Pages (served under /<repo>/). */}
      <Environment
        files={HDRI_PATH}
        background={false}
        environmentIntensity={0.35}
      />
      <CameraTarget tx={0} ty={0} tz={0} />
      <PlacementGroup
        groupRef={brainGroupRef}
        scale={scale}
        position={position}
        placementRef={placementRef}
      >
        <BrainGroup progressRef={progressRef} />
      </PlacementGroup>
      <MobileTap targetRef={brainGroupRef} />
      <ThinkPulse />
    </>
  );
}

/**
 * Section-agnostic "the brain just thought" reaction.
 *
 * Listens for the `brain:think` window CustomEvent (fired by the Identify
 * section whenever the active thought bubble changes) and pushes a SOFT pulse
 * into the same pulse channel the click/tap uses — the impact spring in
 * BrainGroup does the rest. `detail.strength` scales the amplitude (default
 * 0.5 ≈ half a click). Purely additive: no travel / exodus / placement code
 * is touched, and with no event fired the brain behaves exactly as before.
 */
function ThinkPulse() {
  const { pulses, brainWorldScale } = useBrainState();

  useEffect(() => {
    const dir = new Vector3();
    const onThink = (e: Event) => {
      const strength =
        (e as CustomEvent<{ strength?: number }>).detail?.strength ?? 0.5;
      const now = performance.now() / 1000;
      const active = pulses.current.filter(
        (p) => now - p.startTime < ANIMATION.pulse.lifetime,
      );
      // Scrubbing the thought track fast fires several think events per
      // second, and their stacked pulses made the brain jitter erratically.
      // One soft pulse reads as "thinking" — drop new arrivals while any
      // pulse is still this fresh, so rapid up-and-down scrolling produces a
      // calm rhythm instead of a compound shudder.
      if (active.some((p) => now - p.startTime < 0.35)) {
        pulses.current = active;
        return;
      }
      // Origin on the up-right of the brain's surface — where the thought
      // tail leaves toward the bubble — so the recoil reads as "emitting".
      dir
        .set(0.55, 0.8, 0.25)
        .normalize()
        .multiplyScalar(brainWorldScale.current);
      active.push({ origin: dir.clone(), startTime: now, strength });
      pulses.current = active;
    };
    window.addEventListener("brain:think", onThink);
    return () => window.removeEventListener("brain:think", onThink);
  }, [pulses, brainWorldScale]);

  return null;
}

/**
 * Phone tap → click pulse.
 *
 * On phones the page-global canvas is forced pointer-events:none (see
 * BrainStage.module.css) so a finger-drag scrolls the page instead of being
 * captured by the brain — which also means R3F's own pointer events never fire
 * there. To keep the tap interaction, we listen for the DOM `click` (a tap, NOT
 * a drag — a drag scrolls and never emits `click`) on the window, raycast at the
 * tap point against the brain group, and on a hit push the SAME pulse the
 * desktop mouse-click does. Gated to phone widths so desktop — where the canvas
 * keeps pointer-events and R3F's onClick already fires — never double-pulses.
 */
function MobileTap({ targetRef }: { targetRef: MutableRefObject<Group> }) {
  const { camera, raycaster, gl } = useThree();
  const { pulses, brainWorldScale, brainWorldPos } = useBrainState();

  useEffect(() => {
    const canvasEl = gl.domElement;
    const ndc = new Vector2();
    const origin = new Vector3();

    const onClick = (e: MouseEvent) => {
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      const target = targetRef.current;
      if (!target) return;
      const rect = canvasEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      // Must land on the brain composition (not empty page / CTA).
      if (raycaster.intersectObject(target, true).length === 0) return;

      // Origin = the tap ray projected onto the brain's world surface sphere,
      // centered on the brain's LIVE world position (brainWorldPos) — the exact
      // same projection the hover uses, so the fruit ripple fires too. (The brain
      // is placed off the world origin on phones; a raw mesh hit point or an
      // origin-centered sphere lands too far from the fruit and only the brain
      // reacts.)
      rayUnitSphereHit(
        raycaster.ray,
        origin,
        brainWorldScale.current,
        brainWorldPos.current,
      );

      const now = performance.now() / 1000;
      const active = pulses.current.filter(
        (p) => now - p.startTime < ANIMATION.pulse.lifetime,
      );
      active.push({ origin: origin.clone(), startTime: now });
      pulses.current = active;
    };

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [camera, raycaster, gl, pulses, brainWorldScale, brainWorldPos, targetRef]);

  return null;
}

/**
 * Positions + scales the whole brain composition.
 *
 * With a `placementRef` (the page-global BrainStage on desktop) it reads a live
 * world-space transform every frame, so the brain can sit anywhere inside a
 * full-viewport canvas — that's what gives the fruit-exodus the whole screen to
 * fly across and fade, instead of clipping at a small raster edge. Without one
 * it just applies the static scale/position props (standalone, page-agnostic).
 */
function PlacementGroup({
  groupRef,
  scale,
  position,
  placementRef,
  children,
}: {
  groupRef: MutableRefObject<Group>;
  scale: number | [number, number, number];
  position: [number, number, number];
  placementRef?: { current: BrainPlacement | null };
  children: ReactNode;
}) {
  useFrame(() => {
    const g = groupRef.current;
    if (!g || !placementRef) return;
    const p = placementRef.current;
    if (!p) return;
    g.position.set(p.position[0], p.position[1], p.position[2]);
    g.scale.setScalar(p.scale);
  });

  return (
    <group ref={groupRef} scale={scale} position={position}>
      {children}
    </group>
  );
}
