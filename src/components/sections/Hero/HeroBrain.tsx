"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import styles from "./Hero.module.css";

// Three.js is heavy and DOM-dependent — load on the client only.
const BrainModel = dynamic(
  () => import("@/components/BrainModel").then((m) => m.BrainModel),
  { ssr: false },
);

/* `scale` has to compensate for canvas size: a smaller canvas with a larger
   scale renders the same perceived brain as a larger canvas with a smaller
   scale. On mobile the canvas matches the wrap (337px @ 90vw), so we keep the
   original scale. On desktop the canvas bleeds ~110px past the wrap on every
   side (see .canvasFrame in Hero.module.css), so the canvas is ~960px even
   though the wrap is still 740px — we trim the scale to land on the same
   visible brain size. */
const SCALE_DESKTOP = 1.55;
const SCALE_MOBILE  = 1.85;
const DESKTOP_BREAKPOINT = 760;

/**
 * Mount point for the 3D brain inside the hero composition.
 * Layout footprint = .brainWrap (740px desktop / 90vw mobile).
 * Render canvas    = .canvasFrame (bleeds past wrap on desktop so the
 *                    brain's animations have empty page space to swing
 *                    into instead of clipping at the raster edge).
 */
export function HeroBrain() {
  // Pick the right scale on the first paint based on the live viewport,
  // then keep it in sync if the user resizes across the breakpoint.
  // BrainModel is client-only (ssr: false), so `window` is always defined here.
  const [scale, setScale] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth > DESKTOP_BREAKPOINT
      ? SCALE_DESKTOP
      : SCALE_MOBILE,
  );

  useEffect(() => {
    const update = () => {
      setScale(window.innerWidth > DESKTOP_BREAKPOINT ? SCALE_DESKTOP : SCALE_MOBILE);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className={styles.brainWrap} aria-hidden="true">
      <div className={styles.canvasFrame}>
        <BrainModel scale={scale} />
      </div>
    </div>
  );
}

export default HeroBrain;
