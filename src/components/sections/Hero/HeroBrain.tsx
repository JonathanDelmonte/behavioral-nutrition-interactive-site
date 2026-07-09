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
/* The brain's resting footprint at full size — mirrors min(740px, ...) on
   .brainWrap in Hero.module.css. Used to keep the vertical bleed proportional
   to the (possibly shrunk) spacer height. */
const BASE_WRAP_PX = 740;

/* Mirrors the landscape-phone band in Hero.module.css, where the hero turns
   side-by-side and the spacer sits in the RIGHT column. The default frames
   below center the brain on the viewport (full-width frame), which would park
   it over the copy there — this branch tracks the spacer's own box instead
   (Identify's slot idiom), with a proportional bleed for the hover/impact
   overshoot. Cached: computeFrame runs every animation frame. */
const landscapeShortMq = () => {
  if (typeof window === "undefined") return null;
  return window.matchMedia("(orientation: landscape) and (max-height: 520px)");
};
let landscapeShortCache: MediaQueryList | null = null;

export function HeroBrain() {
  /* Map the spacer's rect to the actual canvas frame: bleed to viewport edges
     horizontally (gives hover/pulse overshoots the real screen edge as their
     limit) plus a fixed vertical bleed on desktop for impact-spring overshoot.
     Mobile uses the wrap's height verbatim since the brain renders smaller and
     the impact spring doesn't reach the wrap edges there. */
  const computeFrame = useCallback((rect: DOMRect): BrainFrame => {
    landscapeShortCache ??= landscapeShortMq();
    if (landscapeShortCache?.matches) {
      const bleed = rect.height * 0.18;
      return {
        left: rect.left - bleed,
        top: rect.top - bleed,
        width: rect.width + bleed * 2,
        height: rect.height + bleed * 2,
      };
    }
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    /* Scale the bleed with the spacer height so the brain's apparent size stays
       proportional to .brainWrap's CSS height. On short viewports the height
       cap (60svh) shrinks rect.height; a FIXED bleed would dampen that (the
       constant 220px of total bleed makes a smaller box shrink less than 1:1),
       leaving the brain stubbornly large. Tying the bleed to rect.height makes
       the brain shrink exactly in step with the spacer. At full height
       (rect.height = 740) this is the original 110px, so tall screens are
       unchanged. Center is unaffected — the bleed is symmetric. */
    const verticalBleed = isMobile
      ? 0
      : VERTICAL_BLEED_DESKTOP_PX * (rect.height / BASE_WRAP_PX);
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
