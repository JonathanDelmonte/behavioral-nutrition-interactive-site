"use client";

/**
 * Three-point studio lighting calibrated for a white background.
 * Premium look — bright enough to read clearly, restrained enough to keep
 * sculpted shadows and color richness. A focused SpotLight acts as a soft
 * "stage spotlight" on the brain itself (the light source isn't rendered,
 * only its effect on the model).
 */
export function Lighting() {
  return (
    <>
      {/* Ambient base. */}
      <ambientLight intensity={0.5} />

      {/* Key light: above-front-left, slightly warm. */}
      <directionalLight
        position={[-3, 4, 3]}
        intensity={1.7}
        color="#fff2dd"
      />

      {/* Fill: opposite of key, neutral. */}
      <directionalLight
        position={[3, -1, 2]}
        intensity={0.75}
        color="#ffffff"
      />

      {/* Rim: behind subject — silhouette glow. */}
      <directionalLight
        position={[0, 1.5, -4]}
        intensity={0.9}
        color="#ffffff"
      />

      {/* Subtle top accent for dome gradient. */}
      <directionalLight
        position={[0, 5, 0]}
        intensity={0.5}
        color="#ffffff"
      />

      {/* Focused spotlight on the brain — invisible cone, only the lit effect
          shows on the model. Slightly warm to feel like a stage / showcase light. */}
      <spotLight
        position={[1.5, 4, 2.5]}
        angle={0.5}
        penumbra={0.75}
        intensity={2.2}
        decay={1.5}
        distance={12}
        color="#fff4e0"
      />
    </>
  );
}
