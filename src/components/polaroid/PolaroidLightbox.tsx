"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./PolaroidLightbox.module.css";

/**
 * Fullscreen viewer for a case's pile of prints — the "expand" twin of the
 * VideoLightbox, sharing the same grammar so the site feels of a piece:
 *
 *   - the Testimonials expand buttons OPEN it (the print they expanded sits in
 *     focus; the rest peek behind like a real polaroid pile)
 *   - the global Header reads `active` to morph its hamburger into an X that
 *     closes it (same as the video)
 *
 * On open the page darkens + blurs and the pile grows in. A traced "evolution
 * path" (a line with one dot per print) sits below: it fills toward the current
 * print as the visitor clicks forward, personifying the progress. Click the pile
 * to advance (the top print arcs to the back, the next eases forward — the rail's
 * own motif); click a dot to jump. Calm scale+fade only, no Framer/GSAP.
 */

export type Polaroid = { src: string; date: string; posY?: string };

export interface LightboxPile {
  name: string;
  photos: Polaroid[];
  /** Index in focus on open — the print the visitor expanded. */
  start: number;
}

interface PolaroidLightboxContextValue {
  active: LightboxPile | null;
  open: (pile: LightboxPile) => void;
  close: () => void;
}

const PolaroidLightboxContext =
  createContext<PolaroidLightboxContextValue | null>(null);

export function usePolaroidLightbox(): PolaroidLightboxContextValue {
  const ctx = useContext(PolaroidLightboxContext);
  if (!ctx) {
    throw new Error(
      "usePolaroidLightbox must be used within a PolaroidLightboxProvider",
    );
  }
  return ctx;
}

export function PolaroidLightboxProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<LightboxPile | null>(null);
  const open = useCallback((pile: LightboxPile) => setActive(pile), []);
  const close = useCallback(() => setActive(null), []);

  return (
    <PolaroidLightboxContext.Provider value={{ active, open, close }}>
      {children}
      <PolaroidLightbox active={active} onClose={close} />
    </PolaroidLightboxContext.Provider>
  );
}

/** ms the close fade runs — keep the pile mounted through the exit (kept in sync
 *  with the CSS backdrop transition). */
const EXIT_MS = 420;
/** ms the fly-to-back runs — matches the CSS keyframe so the pile re-locks
 *  exactly as the print lands. */
const FLY_MS = 760;

function PolaroidLightbox({
  active,
  onClose,
}: {
  active: LightboxPile | null;
  onClose: () => void;
}) {
  // `rendered` lags `active` on close so the pile survives the exit fade.
  const [rendered, setRendered] = useState<LightboxPile | null>(null);
  const [index, setIndex] = useState(0);
  const [flying, setFlying] = useState<number | null>(null);
  const flyTimer = useRef<number | null>(null);
  const isOpen = active !== null;

  const photos = rendered?.photos ?? [];
  const n = photos.length;

  // Mount on open (focused on the expanded print); hold through the exit fade.
  useEffect(() => {
    if (active) {
      setRendered(active);
      setIndex(active.start);
      setFlying(null);
      return;
    }
    const t = window.setTimeout(() => setRendered(null), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  useEffect(
    () => () => {
      if (flyTimer.current !== null) window.clearTimeout(flyTimer.current);
    },
    [],
  );

  const advance = useCallback(() => {
    if (n < 2 || flying !== null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setIndex((i) => (i + 1) % n);
      return;
    }
    setFlying(index); // the print leaving the top is the one that flies
    setIndex((i) => (i + 1) % n);
    flyTimer.current = window.setTimeout(() => setFlying(null), FLY_MS);
  }, [n, flying, index]);

  // Jumping (a dot click) just reshuffles — it can go backwards, so no flight.
  const jump = useCallback(
    (target: number) => {
      if (flying !== null) return;
      setIndex(target);
    },
    [flying],
  );

  // Keep the latest handler reachable from the (stable) keydown listener.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Esc closes; ←/→ step; lock the page scroll behind the overlay.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advanceRef.current();
      else if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    const { documentElement } = document;
    const prevOverflow = documentElement.style.overflow;
    documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      documentElement.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, n]);

  return (
    <div
      className={`${styles.overlay} ${isOpen ? styles.open : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={rendered ? `Evolução de ${rendered.name}` : "Fotos"}
      aria-hidden={!isOpen}
      onClick={onClose}
    >
      <div className={styles.stage} onClick={(e) => e.stopPropagation()}>
        {rendered && <span className={styles.eyebrow}>{rendered.name}</span>}

        <button
          type="button"
          className={styles.pile}
          onClick={advance}
          aria-label="Próxima foto"
        >
          {photos.map((p, i) => {
            const depth = (i - index + n) % n;
            return (
              <figure
                key={i}
                className={`${styles.card} ${
                  flying === i ? styles.flying : ""
                }`.trim()}
                style={
                  {
                    ["--d"]: depth,
                    ["--posy"]: p.posY ?? "26%",
                    zIndex: n - depth,
                  } as React.CSSProperties
                }
                aria-hidden={depth !== 0}
              >
                <span className={styles.cardPhoto}>
                  <img
                    src={p.src}
                    alt={depth === 0 ? p.date : ""}
                    draggable={false}
                  />
                </span>
                <figcaption className={styles.printCaption}>{p.date}</figcaption>
                <span className={styles.cardVeil} aria-hidden="true" />
              </figure>
            );
          })}
        </button>

        {/* The evolution path — a line traced toward the current print, one dot
            per print (click a dot to jump). */}
        <div className={styles.progress}>
          <div className={styles.track}>
            <span
              className={styles.fill}
              style={{ ["--p"]: n > 1 ? index / (n - 1) : 0 } as React.CSSProperties}
              aria-hidden="true"
            />
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.dot} ${i <= index ? styles.dotOn : ""} ${
                  i === index ? styles.dotCurrent : ""
                }`.trim()}
                style={
                  { ["--i"]: n > 1 ? i / (n - 1) : 0 } as React.CSSProperties
                }
                onClick={() => jump(i)}
                aria-label={`Foto ${i + 1} de ${n}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PolaroidLightboxProvider;
