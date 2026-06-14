"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";
import styles from "./IndexOverlay.module.css";

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
  // doesn't jump or scroll-spy under the user's finger. Desktop browsers
  // remove the scrollbar when overflow is hidden, so compensate that gutter
  // to keep the page width stable while the menu fades in.
  useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

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
              <a href={s.href} className={styles.link} onClick={onClose}>
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
