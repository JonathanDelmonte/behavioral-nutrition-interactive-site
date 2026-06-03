"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { CAMERA, type BrainPlacement } from "@/components/BrainModel/constants";
import { useBrainStage, type BrainFrame } from "./BrainStageContext";
import styles from "./BrainStage.module.css";

// Three.js is heavy and DOM-dependent — load on the client only. Lives at the
// page level now, so it's mounted once for the whole site rather than per
// section.
const BrainModel = dynamic(
  () => import("@/components/BrainModel").then((m) => m.BrainModel),
  { ssr: false },
);

const SCALE_DESKTOP = 1.55;

/** While the brain travels between sections it is lifted from its resting
 *  z-index (1, behind the section copy) to this value, so the descending brain
 *  AND the fruit flying outward pass OVER the section text instead of behind
 *  it. Must stay comfortably above all section copy (Hero/Identify top out at
 *  z 10) yet below the global header (z 250) and index overlay (z 200), which
 *  should always occlude the brain. Back at the Hero rest the lift is removed
 *  so the headline / CTA keep painting over the brain (defensive layering that
 *  protects the CTA when a short viewport crowds the copy against the brain). */
const TRAVEL_Z = 20;

/** Smooth ease-in-out so the brain accelerates away from one slot and eases
 *  into the next instead of tracking the scroll bar linearly. */
const easeInOut = (t: number) => t * t * (3 - 2 * t);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpFrame(a: BrainFrame, b: BrainFrame, t: number): BrainFrame {
  return {
    left: lerp(a.left, b.left, t),
    top: lerp(a.top, b.top, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t),
  };
}

/**
 * Page-global, fixed-positioned mount for the 3D brain.
 *
 * Reads the registered slots from <BrainStageProvider> and works out where the
 * brain should appear by interpolating between consecutive slots as the user
 * scrolls. With one slot it just tracks that slot (the original Hero behavior);
 * with two (Hero → Identify) the brain physically travels between them.
 *
 * Crucially, the RENDER CANVAS is decoupled from that target rect: on desktop it
 * fills the whole viewport, and the brain is placed *in world space* (via a
 * mirror of the R3F camera) so it lands exactly on the target while the fruit
 * fly-out has the entire screen to cross and fade — no clipping at a small
 * raster edge. On mobile the canvas stays sized to the frame (no travel there,
 * and a full-screen fixed canvas would swallow touch-scroll via touch-action).
 */
export function BrainStage() {
  const { slots } = useBrainStage();
  const [frame, setFrame] = useState<BrainFrame | null>(null);
  // Travel progress, 0 at the first slot rising toward N-1 across segments.
  // Kept in a ref (not state) so the per-scroll-frame updates that drive the
  // brain's rotation/fruit-exodus don't re-render the React tree inside the
  // Canvas — BrainGroup reads it imperatively in its useFrame loop.
  const progressRef = useRef(0);
  // Live world-space placement, written from the target frame here and read
  // inside the R3F tree (PlacementGroup) — also a ref to avoid re-renders.
  const placementRef = useRef<BrainPlacement | null>(null);
  const [scale, setScale] = useState<number>(() => pickScale());
  const [oversize, setOversize] = useState<boolean>(() => pickOversize());
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const lastInteractive = useRef(true);

  // Mutable mirrors of state for the scroll loop, whose effect closes over
  // [sortedSlots] only (so it isn't torn down/rebuilt on every resize tick).
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const oversizeRef = useRef(oversize);
  oversizeRef.current = oversize;

  // Off-canvas mirror of the R3F camera. Lets us map a viewport-pixel target
  // rect into a world position+scale WITHOUT coupling <BrainModel/> to the page
  // — the model only ever receives an abstract world transform. Both this and
  // the live Canvas camera read CAMERA from BrainModel/constants, so they can't
  // drift apart.
  const mirrorCam = useMemo(() => {
    const cam = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
    cam.position.set(CAMERA.position[0], CAMERA.position[1], CAMERA.position[2]);
    cam.lookAt(CAMERA.target[0], CAMERA.target[1], CAMERA.target[2]);
    cam.updateMatrixWorld();
    return cam;
  }, []);
  /** Distance from the camera to its look-at target (the brain's resting depth
   *  in the old, frame-sized canvas). Used to preserve apparent size. */
  const d0 = useMemo(
    () =>
      new Vector3(...CAMERA.position).distanceTo(new Vector3(...CAMERA.target)),
    [],
  );
  const tmpV = useMemo(() => new Vector3(), []);

  const sortedSlots = useMemo(
    () => Array.from(slots.values()).sort((a, b) => a.order - b.order),
    [slots],
  );

  useEffect(() => {
    if (sortedSlots.length === 0) {
      setFrame(null);
      return;
    }

    // Map a target screen rect → world placement using the mirror camera, so a
    // full-viewport canvas renders the brain at the SAME on-screen position and
    // size it had when the canvas was sized exactly to the frame.
    const writePlacement = (f: BrainFrame) => {
      const rect = canvasWrapRef.current?.getBoundingClientRect();
      const cw = rect?.width || window.innerWidth;
      const ch = rect?.height || window.innerHeight;
      if (cw <= 0 || ch <= 0) return;

      if (mirrorCam.aspect !== cw / ch) {
        mirrorCam.aspect = cw / ch;
        mirrorCam.updateProjectionMatrix();
      }

      const cx = f.left + f.width / 2;
      const cy = f.top + f.height / 2;
      const ndcX = (cx / cw) * 2 - 1;
      const ndcY = -((cy / ch) * 2 - 1);

      // NDC depth of the world target, so the unprojected point sits on the
      // target's view plane and projects back exactly to (cx, cy).
      const oz = tmpV.set(...CAMERA.target).project(mirrorCam).z;
      tmpV.set(ndcX, ndcY, oz).unproject(mirrorCam);

      // Apparent size is proportional to (worldScale / distance) × canvasHeight.
      // Old: canvas height = f.height, brain at depth d0. New: height = ch, the
      // brain sits at depth d1 — so this scale keeps the projected size identical
      // (the d1 term cancels out, leaving size = old size, for any on-screen
      // position).
      const d1 = mirrorCam.position.distanceTo(tmpV);
      const s = scaleRef.current * (f.height / ch) * (d1 / d0);

      placementRef.current = { position: [tmpV.x, tmpV.y, tmpV.z], scale: s };
    };

    // Last frame pushed to React state. The continuous rAF loop below recomputes
    // every animation frame, but the ground glow only needs a re-render when the
    // brain footprint actually MOVES — so setFrame is gated on a real change and
    // a brain resting at a slot costs zero React renders.
    let lastFrame: BrainFrame | null = null;
    const frameMoved = (f: BrainFrame) =>
      !lastFrame ||
      Math.abs(f.left - lastFrame.left) > 0.5 ||
      Math.abs(f.top - lastFrame.top) > 0.5 ||
      Math.abs(f.width - lastFrame.width) > 0.5 ||
      Math.abs(f.height - lastFrame.height) > 0.5;

    const update = () => {
      // Live viewport frame for every mounted slot.
      const frames = sortedSlots.map((s) => {
        const el = s.ref.current;
        return el ? s.computeFrame(el.getBoundingClientRect()) : null;
      });

      let nextFrame: BrainFrame | null;

      // Single slot (or only one mounted): just track it.
      const mountedCount = frames.filter(Boolean).length;
      if (sortedSlots.length === 1 || mountedCount < 2) {
        nextFrame = frames.find(Boolean) ?? null;
        progressRef.current = 0;
      } else {
        // Build arrival scrolls for each slot (cached read of the slot element).
        const arrivals = sortedSlots.map((s) => {
          const el = s.ref.current;
          return el && s.arrivalScroll ? s.arrivalScroll(el) : 0;
        });

        const scrollY = window.scrollY;

        // Find the segment [i, i+1] the current scroll falls into.
        let seg = 0;
        while (seg < sortedSlots.length - 2 && scrollY >= arrivals[seg + 1]) {
          seg += 1;
        }

        const startScroll = arrivals[seg];
        const endScroll = arrivals[seg + 1];
        const span = endScroll - startScroll;
        const raw = span > 0 ? (scrollY - startScroll) / span : 0;
        const clamped = Math.max(0, Math.min(1, raw));
        const eased = easeInOut(clamped);

        const fromFrame = frames[seg];
        const toFrame = frames[seg + 1];
        nextFrame =
          fromFrame && toFrame ? lerpFrame(fromFrame, toFrame, eased) : null;
        // Raw (un-eased) progress drives rotation/exodus so those animations
        // have their own easing curves independent of the position easing.
        progressRef.current = seg + clamped;
      }

      if (!nextFrame) return;

      // Desktop only: drive a world placement so the canvas can be full-viewport.
      if (oversizeRef.current) writePlacement(nextFrame);

      // The brain rests in the Hero only while progress ≈ 0. Crossing that
      // threshold flips two things together:
      //   1. pointer-events — dropped while traveling so the full-viewport
      //      canvas never intercepts clicks meant for the sections below it.
      //   2. z-index — lifted (TRAVEL_Z) so the descending brain and the fruit
      //      flying outward pass OVER the section copy instead of behind it;
      //      reset at rest so the Hero headline/CTA keep painting over it.
      const interactive = progressRef.current < 0.04;
      if (lastInteractive.current !== interactive) {
        lastInteractive.current = interactive;
        if (canvasWrapRef.current) {
          canvasWrapRef.current.style.pointerEvents = interactive
            ? "auto"
            : "none";
        }
        if (stageRef.current) {
          stageRef.current.style.zIndex = interactive ? "" : String(TRAVEL_Z);
        }
      }

      if (frameMoved(nextFrame)) {
        lastFrame = nextFrame;
        setFrame(nextFrame);
      }
    };

    // Drive progress from a CONTINUOUS animation-frame loop rather than from
    // scroll / resize / ResizeObserver listeners.
    //
    // Travel progress is a LAYOUT measurement (the slot's document position, via
    // arrivalScroll). During load that measurement is a moving target: web fonts
    // swap and images decode (reflowing everything above the slot), and on reload
    // the browser restores the scroll position in a race with React mount and
    // scroll-anchoring. An event-driven model only re-measures when some event
    // happens to fire — so whenever the LAST event landed on a half-settled
    // layout, progress froze at a stale value. Because the fruit "exodus" is
    // driven by that progress, the fruit then locked mid-flight, scattered around
    // the already-parked brain. It was intermittent precisely because it hinged
    // on load timing (a font swap or scroll restore landing before vs. after the
    // final scroll event).
    //
    // Recomputing every frame removes the staleness entirely: progress always
    // reflects the CURRENT layout and scroll, so it self-corrects within one
    // frame of any reflow or scroll restoration, no matter when they land. The
    // page already runs a frame loop (the brain idle-floats every frame) and the
    // work here is just a couple of getBoundingClientRect reads, so the cost is
    // negligible. The React re-render (setFrame, which repositions the ground
    // glow) stays gated to real movement, so a brain resting at a slot triggers
    // no renders.
    let rafId = requestAnimationFrame(function loop() {
      update();
      rafId = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [sortedSlots, mirrorCam, d0, tmpV]);

  // Keep the brain's R3F scale prop + the canvas oversize mode in sync with the
  // viewport breakpoint.
  useEffect(() => {
    const update = () => {
      setScale(pickScale());
      setOversize(pickOversize());
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!frame) return null;

  // Ground glow under the brain — its own frame-sized box, so it stays anchored
  // to the brain footprint even when the stage (canvas) is full-viewport.
  const shadowStyle: CSSProperties = {
    left: frame.left,
    top: frame.top,
    width: frame.width,
    height: frame.height,
  };

  // Desktop: full-viewport canvas. Mobile: canvas tracks the frame, as before.
  const stageStyle: CSSProperties = oversize
    ? { left: 0, top: 0, width: "100vw", height: "100vh" }
    : {
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      };

  return (
    <>
      <div aria-hidden="true" className={styles.shadowBox} style={shadowStyle}>
        <span className={styles.shadow} aria-hidden="true" />
      </div>
      <div
        ref={stageRef}
        aria-hidden="true"
        className={styles.stage}
        style={stageStyle}
      >
        <div ref={canvasWrapRef} className={styles.canvas}>
          <BrainModel
            scale={scale}
            progressRef={progressRef}
            placementRef={oversize ? placementRef : undefined}
          />
        </div>
      </div>
    </>
  );
}

// One scale at every width. Phone and desktop now BOTH use the full-viewport
// "oversize" canvas + world-placement (pickOversize below), which sizes the
// brain precisely onto whatever slot it's traveling to — so the phone's much
// smaller Identify slot automatically yields a much smaller brain, with no
// clipping. (The old, larger SCALE_MOBILE only existed for the frame-sized
// mobile canvas, which we no longer use.)
function pickScale(): number {
  return SCALE_DESKTOP;
}

// Full-viewport canvas everywhere. Originally desktop-only because a fixed
// full-screen canvas was thought to swallow touch-scroll — but the R3F canvas
// keeps touch-action:auto, so vertical scrolling passes straight through, and
// using it on phone too lets the brain travel + size to each slot exactly like
// desktop (the whole point of making mobile match).
function pickOversize(): boolean {
  return true;
}
