"use client";

import { useState } from "react";
import styles from "./Header.module.css";
import { Brandmark } from "@/components/brand/Brandmark";
import { IndexOverlay } from "./IndexOverlay";

/**
 * Persistent top header — sticky at viewport top.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  [logo] Juliana Delmonte                              ≡       │
 *   │         NUTRIÇÃO COMP.                                         │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Two-zone layout: brandmark on the left, hamburger menu trigger on
 * the right. The AGENDAR CTA used to live in the header but now sits
 * in the final "Vamos conversar" section — keeping the header light
 * and giving the brandmark + menu room to breathe at the edges.
 *
 * Padding matches the Hero's outer padding (.hero in Hero.module.css)
 * so both edges line up exactly.
 */
export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Brandmark compact />

          <button
            type="button"
            className={`${styles.menuButton} ${open ? styles.isOpen : ""}`.trim()}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu de seções"}
          >
            {/* Three SVG <line>s that morph between a hamburger (closed)
                and an X (open). Each line has its own class so we can
                target it from CSS:
                  - .line1 (top) rotates +45° + slides to vertical center
                  - .middle fades out
                  - .line3 (bottom) rotates -45° + slides to vertical center
                vector-effect="non-scaling-stroke" guarantees 2 px stroke
                width on every line regardless of DPI / zoom. Square 24×24
                viewBox gives the rotated X room to render without
                overflowing the SVG bounds. */}
            <svg
              className={styles.menuIcon}
              width="30"
              height="20"
              viewBox="0 0 30 20"
              aria-hidden="true"
            >
              <line
                className={styles.line1}
                x1="0"  y1="1"
                x2="30" y2="1"
                stroke="currentColor"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <line
                className={styles.middle}
                x1="0"  y1="10"
                x2="30" y2="10"
                stroke="currentColor"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <line
                className={styles.line3}
                x1="0"  y1="19"
                x2="30" y2="19"
                stroke="currentColor"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </button>
        </div>
      </header>

      <IndexOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default Header;
