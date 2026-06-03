"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/** Viewport-coordinate rectangle the brain canvas should render into. */
export interface BrainFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BrainSlot {
  id: string;
  /** Document order (top-to-bottom). Lower = appears earlier in scroll. */
  order: number;
  ref: RefObject<HTMLElement | null>;
  /** Maps the spacer's DOMRect into the canvas render frame. Lets each
   *  section add its own bleed / push-to-viewport-edge policy. */
  computeFrame: (rect: DOMRect) => BrainFrame;
  /** Document scrollY at which the brain is considered fully "arrived" at this
   *  slot. <BrainStage /> derives the hero→section travel progress by comparing
   *  the live scroll position against consecutive slots' arrival points.
   *  Receives the slot element so the owner can measure its own layout
   *  (e.g. account for a sticky stage). Defaults to 0 (top of page). */
  arrivalScroll?: (el: HTMLElement) => number;
}

interface BrainStageState {
  slots: ReadonlyMap<string, BrainSlot>;
  register: (slot: BrainSlot) => void;
  unregister: (id: string) => void;
}

const BrainStageContext = createContext<BrainStageState | null>(null);

/**
 * Provider for the page-global brain canvas.
 *
 * Each section that wants the brain to land in its area registers a "slot" via
 * useBrainSlot — the slot points at a DOM spacer (an empty div sized like the
 * section's intended brain footprint) and supplies a computeFrame fn that maps
 * the spacer's viewport rect into the canvas's actual render frame (with
 * whatever bleed the section needs for off-wrap animations).
 *
 * <BrainStage /> reads the registered slots and positions the single fixed
 * canvas accordingly, interpolating between consecutive slots as the user
 * scrolls so the brain physically travels between sections.
 */
export function BrainStageProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Map<string, BrainSlot>>(() => new Map());

  const register = useCallback((slot: BrainSlot) => {
    setSlots((prev) => {
      const next = new Map(prev);
      next.set(slot.id, slot);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setSlots((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<BrainStageState>(
    () => ({ slots, register, unregister }),
    [slots, register, unregister],
  );

  return (
    <BrainStageContext.Provider value={value}>
      {children}
    </BrainStageContext.Provider>
  );
}

export function useBrainStage(): BrainStageState {
  const ctx = useContext(BrainStageContext);
  if (!ctx) {
    throw new Error("useBrainStage must be used inside <BrainStageProvider>");
  }
  return ctx;
}

/** Default frame = the spacer's own rect (no bleed). */
const identityFrame = (rect: DOMRect): BrainFrame => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

export interface BrainSlotOptions {
  /** Document order (top-to-bottom). Lower = earlier in scroll. */
  order: number;
  /** Maps the spacer rect → canvas render frame (default: identity). */
  computeFrame?: (rect: DOMRect) => BrainFrame;
  /** See BrainSlot.arrivalScroll (default: () => 0). */
  arrivalScroll?: (el: HTMLElement) => number;
  /** When false, the slot is NOT registered — the brain ignores it. Used to
   *  opt a section out of the travel (e.g. prefers-reduced-motion), leaving the
   *  brain resting on the previous slot. Default true. */
  enabled?: boolean;
}

/**
 * Register a brain slot from any section. Returns a ref to attach to the DOM
 * spacer — the BrainStage will position the canvas to cover the frame computed
 * from that spacer's rect.
 *
 * The callbacks are captured in refs so callers may pass inline functions
 * without forcing re-registration on every render.
 */
export function useBrainSlot<T extends HTMLElement>(
  id: string,
  options: BrainSlotOptions,
): RefObject<T> {
  const { order, computeFrame = identityFrame, arrivalScroll, enabled = true } = options;

  // useRef<T>(null) (not <T | null>) so the returned ref is RefObject<T>, which
  // is what a DOM `ref` prop expects — React's own `useRef<T>(initialValue: T |
  // null): RefObject<T>` overload. Typing it <T | null> yields RefObject<T |
  // null>, which @types/react 18.3 rejects when assigned to `ref={…}`.
  const ref = useRef<T>(null);
  const computeFrameRef = useRef(computeFrame);
  computeFrameRef.current = computeFrame;
  const arrivalScrollRef = useRef(arrivalScroll);
  arrivalScrollRef.current = arrivalScroll;

  const { register, unregister } = useBrainStage();

  useEffect(() => {
    if (!enabled) return;
    register({
      id,
      order,
      ref: ref as RefObject<HTMLElement | null>,
      computeFrame: (rect) => computeFrameRef.current(rect),
      arrivalScroll: (el) => arrivalScrollRef.current?.(el) ?? 0,
    });
    return () => unregister(id);
  }, [id, order, enabled, register, unregister]);

  return ref;
}
