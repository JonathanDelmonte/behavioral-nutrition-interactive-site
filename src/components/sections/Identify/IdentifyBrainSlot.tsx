"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrainSlot, type BrainFrame } from "@/components/BrainStage";
import styles from "./Identify.module.css";

/**
 * The left-column landing spot for the traveling 3D brain in Section 2.
 *
 * Registers itself as the "identify" brain slot (order 1) so <BrainStage />
 * eases the page-global canvas from the Hero into this footprint as the user
 * scrolls. The decorative rings (.brainSlot ::before/::after) stay as a halo
 * the brain settles inside.
 */

/* Canvas bleed around the slot so fruit fly-out (Etapa 5) and the brain's idle
   float have room before clipping at the raster edge. Expressed as a fraction
   of the slot height; ~0.22 lands the brain at roughly the slot size with a
   comfortable margin. */
const BLEED_RATIO = 0.22;

function readHeaderHeight(): number {
  // Measure the rendered header. --header-h is now a clamp() expression, so
  // reading the raw custom-property value and parseFloat-ing it yields NaN
  // (custom properties aren't math-evaluated) — the header element's own box is
  // the reliable source of its current (height-responsive) thickness.
  const header = document.querySelector("header");
  if (header) {
    const h = header.getBoundingClientRect().height;
    if (h > 0) return h;
  }
  // Fallbacks: a plain px token (parseFloat works) then a sane default.
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 100;
}

/** Document Y of an element using the offsetTop chain. Unlike
 *  getBoundingClientRect, offsetTop reports the element's LAYOUT position and is
 *  unaffected by position:sticky — so this stays correct no matter where the
 *  page is currently scrolled (important: browsers restore scroll on reload). */
function layoutDocTop(el: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y;
}

export function IdentifyBrainSlot({ thinkKey = -1 }: { thinkKey?: number }) {
  // The travel runs on phone AND desktop now (the Identify stage is sticky and
  // 2-column at every width — see Identify.module.css). The ONLY opt-out is
  // prefers-reduced-motion: with reduced motion the brain just rests in the Hero
  // and this section shows its decorative rings + stacked thoughts.
  const [travelEnabled, setTravelEnabled] = useState(false);

  useEffect(() => {
    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setTravelEnabled(!reducedMq.matches);

    sync();
    reducedMq.addEventListener("change", sync);

    return () => {
      reducedMq.removeEventListener("change", sync);
    };
  }, []);

  const computeFrame = useCallback((rect: DOMRect): BrainFrame => {
    const bleed = rect.height * BLEED_RATIO;
    return {
      left: rect.left - bleed,
      top: rect.top - bleed,
      width: rect.width + bleed * 2,
      height: rect.height + bleed * 2,
    };
  }, []);

  // Scroll offset at which the brain "arrives" parked in this slot — i.e. the
  // scrollY at which the sticky .stage pins, so the brain lands exactly as the
  // section reaches its resting position. BrainStage divides scrollY by this to
  // get travel progress (which also drives the fruit exodus).
  //
  // Measured from the .TRACK, not the slot. The .stage pins (and the brain
  // parks) when scrollY reaches the track's document top minus the header — and
  // the track is position:relative, so it NEVER sticky-shifts: trackRect.top +
  // scrollY is the track's true, stable document Y in every scroll/pin state.
  //
  // Why the track and not the slot's own offsetTop chain (the previous approach):
  // the slot lives INSIDE the sticky .stage, so its offsetTop routes through an
  // element whose offset reflects the pinned shift — and, crucially, the cycling
  // thought bubbles (ThoughtTrack) derive THEIR position from this same .track.
  // Reading the brain's arrival from the slot while the bubbles read the track
  // meant two different references that could disagree on reload (a deep thought
  // showing while the brain's progress read as not-yet-arrived, freezing the
  // fruit mid-exodus). Sharing the track reference keeps the brain's progress and
  // the bubbles in lock-step. Computed LIVE every frame, so it self-heals after
  // any reflow (fonts, images) no matter the load timing.
  const arrivalScroll = useCallback((el: HTMLElement): number => {
    const headerH = readHeaderHeight();
    const track = el.closest("[data-brain-track]") as HTMLElement | null;
    if (track) {
      const rect = track.getBoundingClientRect();
      return Math.max(0, rect.top + window.scrollY - headerH);
    }
    // Fallback (track not found): the slot's own layout position, less its rest
    // offset inside the centered sticky stage. Sticky-fragile, hence last resort.
    const docTop = layoutDocTop(el);
    const stageH = window.innerHeight - headerH;
    const restViewportTop = headerH + (stageH - el.offsetHeight) / 2;
    return Math.max(0, docTop - restViewportTop);
  }, []);

  const ref = useBrainSlot<HTMLDivElement>("identify", {
    order: 1,
    computeFrame,
    arrivalScroll,
    enabled: travelEnabled,
  });

  return (
    <div ref={ref} className={styles.brainSlot} aria-hidden="true">
      {/* Halo ring that pulses once per arriving thought (remounted via key).
          Decorative child only — BrainStage measures this div's rect, which a
          child cannot change. */}
      {thinkKey >= 0 && <span key={thinkKey} className={styles.thinkRing} />}
    </div>
  );
}

export default IdentifyBrainSlot;
