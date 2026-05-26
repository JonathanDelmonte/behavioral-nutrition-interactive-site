"use client";

/**
 * Three-point studio lighting tuned to match a high-contrast premium product
 * photo (think editorial fruit-on-brain reference): a strong, slightly warm
 * key, restrained fill so shadows stay sculpted, a clear silhouette rim, and
 * a focused spotlight as a hero key. Ambient is intentionally low so highlights
 * pop against deeper valleys.
 */
export function Lighting() {
  return (
    <>
      {/* Ambient base — a touch higher so the shadow side still shows
          the fruits' colors clearly, like in editorial product shots. */}
      <ambientLight intensity={0.42} />

      {/* Key light — dominant, warm, above-front-left. */}
      <directionalLight
        position={[-3, 4, 3]}
        intensity={2.4}
        color="#fff0c5"
      />

      {/* Fill — small, neutral, just enough to read the shadow side. */}
      <directionalLight
        position={[3, -0.8, 2]}
        intensity={0.5}
        color="#ffffff"
      />

      {/* Rim — behind the subject, sells the silhouette glow. */}
      <directionalLight
        position={[0, 1.8, -4]}
        intensity={0.9}
        color="#ffffff"
      />

      {/* Subtle top accent for the dome highlight on the brain. */}
      <directionalLight
        position={[0, 5, 0]}
        intensity={0.4}
        color="#ffffff"
      />

      {/* Focused stage spotlight — aimed at the middle-right area of the
          brain (where the small kiwi + orange sit, slightly below center).
          Camera is at +X looking at the origin, so the screen's "right" is
          roughly +Z in world space. Light comes from above and that same
          side so the cone wraps the target visibly. */}
      <spotLight
        position={[1, 5, 5]}
        angle={0.28}
        penumbra={0.6}
        intensity={5}
        decay={1.5}
        distance={14}
        color="#fff0c0"
      >
        <object3D attach="target" position={[0.1, -0.05, 0.55]} />
      </spotLight>
    </>
  );
}
