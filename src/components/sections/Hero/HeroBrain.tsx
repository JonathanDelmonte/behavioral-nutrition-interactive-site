"use client";

import { useCallback } from "react";
import styles from "./Hero.module.css";
import { useBrainSlot, type BrainFrame } from "@/components/BrainStage";

/**
 * Hero's 3D-brain slot.
 *
 * Since Phase 2, the actual <BrainModel /> canvas no longer lives here — it's
 * mounted page-globally by <BrainStage /> so it can travel into the next
 * section as the user scrolls. This component is now just a DOM "spacer":
 * an empty div with the SAME footprint .brainWrap had before, registered as
 * a slot so <BrainStage /> can position its fixed canvas exactly over it.
 *
 * The wrap's footprint (740 px desktop / 90 vw mobile) defines layout flow;
 * the computeFrame below adds the same horizontal-to-viewport-edge + vertical
 * bleed the old .canvasFrame had, so off-wrap animations (hover lift, click
 * impact) still have screen space to swing into.
 */
const VERTICAL_BLEED_DESKTOP_PX = 110;
const MOBILE_BREAKPOINT = 760;

export function HeroBrain() {
  /* Map the spacer's rect to the actual canvas frame: bleed to viewport edges
     horizontally (gives hover/pulse overshoots the real screen edge as their
     limit) plus a fixed vertical bleed on desktop for impact-spring overshoot.
     Mobile uses the wrap's height verbatim since the brain renders smaller and
     the impact spring doesn't reach the wrap edges there. */
  const computeFrame = useCallback((rect: DOMRect): BrainFrame => {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const verticalBleed = isMobile ? 0 : VERTICAL_BLEED_DESKTOP_PX;
    return {
      left: 0,
      top: rect.top - verticalBleed,
      width: window.innerWidth,
      height: rect.height + verticalBleed * 2,
    };
  }, []);

  const spacerRef = useBrainSlot<HTMLDivElement>("hero", {
    order: 0,
    computeFrame,
    // The Hero sits at the very top, so the brain "rests" here at scroll 0.
    arrivalScroll: () => 0,
  });

  return <div ref={spacerRef} className={styles.brainWrap} aria-hidden="true" />;
}

export default HeroBrain;
