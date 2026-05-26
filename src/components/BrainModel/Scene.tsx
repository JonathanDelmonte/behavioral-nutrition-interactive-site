"use client";

import { Environment } from "@react-three/drei";
import { Lighting } from "./Lighting";
import { BrainGroup } from "./BrainGroup";
import { CameraTarget } from "./Debug";

interface SceneProps {
  scale: number | [number, number, number];
  position: [number, number, number];
}

/**
 * Inner scene contents (everything 3D inside the Canvas).
 * Camera lives on the Canvas itself so it does not get rescaled with the model.
 *
 * No ground plane / ContactShadows on purpose: the brand image should read as a
 * 3D object floating against a clean white page, not "viewed inside a 3D editor".
 */
export function Scene({ scale, position }: SceneProps) {
  return (
    <>
      <Lighting />
      {/* HDRI environment — gives subtle, photo-realistic reflections on the
          fruit and brain surfaces. `background={false}` keeps the page white. */}
      <Environment preset="studio" background={false} environmentIntensity={0.35} />
      <CameraTarget tx={0} ty={0} tz={0} />
      <group scale={scale} position={position}>
        <BrainGroup />
      </group>
    </>
  );
}
