"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, MouseEvent } from "react";
import styles from "./IndexOverlay.module.css";

/** Ease-in-out cubic — slow lift-off, brisk middle, decelerating arrival.
 *  The same "calm but alive" arc the rest of the site uses for travel. */
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Glide the page to an absolute scroll position over `duration` ms.
 *
 * <html> is this page's scroll container, so window.scrollTo drives it
 * directly each frame (no native `behavior:"smooth"`, whose duration the
 * browser owns and tends to drag out across this long page). The user can
 * wrest control back at any moment — a wheel / touch / key aborts the glide
 * so we never fight their input. Returns a cancel fn so a new navigation (or
 * unmount) can stop a glide already in flight.
 */
function glideScrollTo(dest: number, duration: number, onArrive: () => void) {
  const start = window.scrollY;
  const delta = dest - start;
  let raf = 0;
  let startTime = 0;

  const stop = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };

  const step = (now: number) => {
    if (!startTime) startTime = now;
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, start + delta * easeInOutCubic(t));
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else {
      stop();
      onArrive();
    }
  };

  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  raf = requestAnimationFrame(step);

  return stop;
}

/** All 8 site sections, in scroll order. The hash references match anchor
 *  ids that the section components will declare as they're added. */
const SECTIONS = [
  { num: "01", label: "Início",              href: "#inicio" },
  { num: "02", label: "Você se identifica?", href: "#para-quem" },
  { num: "03", label: "Como funciona",       href: "#como-funciona" },
  { num: "04", label: "Sobre Ju",            href: "#sobre" },
  { num: "05", label: "Depoimentos",         href: "#depoimentos" },
  { num: "06", label: "Atendimento",         href: "#atendimento" },
  { num: "07", label: "Dúvidas",             href: "#duvidas" },
  { num: "08", label: "Vamos conversar",     href: "#contato" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen "table of contents" overlay. Triggered by the header's
 * ÍNDICE button, opens as a luxe magazine sumário: each section gets
 * an italic-serif gold numeral and a sans-caps label, items stagger
 * into place after the backdrop fades in.
 *
 * Closes on:
 *   - clicking any section link (which then scrolls to that section)
 *   - clicking the × button top-right
 *   - pressing Escape
 *   - clicking the backdrop (outside the content column)
 */
export function IndexOverlay({ open, onClose }: Props) {
  // Close on Escape — global listener active only while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock background scroll while the overlay is open so the page behind
  // doesn't jump or scroll-spy under the user's finger. <html> is this page's
  // scroll container (not <body>), so the lock has to land there — setting
  // overflow:hidden on <body> leaves the document scrollable. The scrollbar
  // disappears with the lock, but `scrollbar-gutter: stable` on <html>
  // (globals.css) keeps its gutter reserved, so the page width stays put and
  // the full-bleed sticky header doesn't slide sideways while the menu opens.
  useEffect(() => {
    if (!open) return;

    const { documentElement } = document;
    const prevOverflow = documentElement.style.overflow;

    documentElement.style.overflow = "hidden";

    return () => {
      documentElement.style.overflow = prevOverflow;
    };
  }, [open]);

  // Holds the cancel fn of an in-flight glide so a second tap (or unmount)
  // can abort it cleanly instead of two glides fighting over the scroll.
  const cancelGlide = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelGlide.current?.(), []);

  // Clicking a section: dissolve the overlay and glide the page to the
  // section instead of the browser's hard hash-jump. The CSS opacity fade on
  // the overlay (0.25s) lifts the veil while the page is still gliding, so the
  // travel reads as a smooth reveal rather than a dry cut.
  const handleNavigate = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.getElementById(href.slice(1));
    // Can't resolve the anchor → let the browser do its default thing.
    if (!target) {
      onClose();
      return;
    }
    e.preventDefault();

    // Start the overlay fading out, then release the scroll lock the open
    // effect put on <html>. The effect's own cleanup unlocks on the next
    // commit too, but doing it here first removes the one-frame race where
    // overflow:hidden would swallow our programmatic scroll.
    onClose();
    document.documentElement.style.overflow = "";
    cancelGlide.current?.();

    // Land the section just below the sticky header (its real, resolved
    // height — not the raw clamp() token), clamped so #inicio rests at the top.
    const headerH = document.querySelector("header")?.offsetHeight ?? 0;
    const dest = Math.max(
      0,
      window.scrollY + target.getBoundingClientRect().top - headerH,
    );
    const arrive = () => history.replaceState(null, "", href);

    // Reduced motion → land instantly, no glide.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, dest);
      arrive();
      return;
    }

    const distance = Math.abs(dest - window.scrollY);
    if (distance < 4) {
      arrive();
      return;
    }

    // Distance-aware duration: short hops stay perceptible, and even a
    // top-to-bottom jump stays brisk (capped ~0.7s) so it never drags.
    const duration = Math.min(700, Math.max(420, distance * 0.45));
    cancelGlide.current = glideScrollTo(dest, duration, arrive);
  };

  return (
    <div
      className={`${styles.overlay} ${open ? styles.open : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label="Índice das seções"
      aria-hidden={!open}
      onClick={onClose}
    >
      {/* No close button inside the overlay — the hamburger button in
          the header morphs into an X while the overlay is open and
          serves as the close affordance, keeping interaction anchored
          to a single, predictable spot. Esc and backdrop click also
          close (handled below + by the parent setOpen toggle). */}

      {/* Inner column — stops click-through so clicking around the items
          doesn't close the overlay; only the outer backdrop does. */}
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <span className={styles.eyebrow}>Índice</span>

        <ol className={styles.list}>
          {SECTIONS.map((s, i) => (
            <li
              key={s.num}
              className={styles.item}
              style={{ "--i": i } as CSSProperties}
            >
              <a
                href={s.href}
                className={styles.link}
                onClick={(e) => handleNavigate(e, s.href)}
              >
                <span className={styles.num} aria-hidden="true">
                  {s.num}
                </span>
                <span className={styles.label}>{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default IndexOverlay;
