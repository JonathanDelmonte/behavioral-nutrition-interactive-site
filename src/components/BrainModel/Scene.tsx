"use client";

import { Environment } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import { Group } from "three";
import { Lighting } from "./Lighting";
import { BrainGroup } from "./BrainGroup";
import { CameraTarget } from "./Debug";
import type { BrainPlacement } from "./constants";

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
  return (
    <>
      <Lighting />
      {/* HDRI environment — gives subtle, photo-realistic reflections on the
          fruit and brain surfaces. `background={false}` keeps the page white.

          Served from /public (NOT drei's `preset="studio"`): the preset fetches
          this same HDR from an external CDN (raw.githack.com/pmndrs/drei-assets)
          at runtime, and a single network/CDN hiccup throws "Could not load …hdr:
          Failed to fetch", which crashes the entire 3D tree and the brain
          vanishes. The byte-identical file lives in public/hdri/, so it's served
          by Next.js with the rest of the app — no third-party dependency, works
          offline, and can't fail to fetch. */}
      <Environment
        files="/hdri/studio_small_03_1k.hdr"
        background={false}
        environmentIntensity={0.35}
      />
      <CameraTarget tx={0} ty={0} tz={0} />
      <PlacementGroup scale={scale} position={position} placementRef={placementRef}>
        <BrainGroup progressRef={progressRef} />
      </PlacementGroup>
    </>
  );
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
  scale,
  position,
  placementRef,
  children,
}: {
  scale: number | [number, number, number];
  position: [number, number, number];
  placementRef?: { current: BrainPlacement | null };
  children: ReactNode;
}) {
  const ref = useRef<Group>(null!);

  useFrame(() => {
    const g = ref.current;
    if (!g || !placementRef) return;
    const p = placementRef.current;
    if (!p) return;
    g.position.set(p.position[0], p.position[1], p.position[2]);
    g.scale.setScalar(p.scale);
  });

  return (
    <group ref={ref} scale={scale} position={position}>
      {children}
    </group>
  );
}
