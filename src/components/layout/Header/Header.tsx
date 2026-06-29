"use client";

import { useState } from "react";
import styles from "./Header.module.css";
import { Brandmark } from "@/components/brand/Brandmark";
import { IndexOverlay } from "./IndexOverlay";
import { useVideoLightbox } from "@/components/video/VideoLightbox";
import { usePolaroidLightbox } from "@/components/polaroid/PolaroidLightbox";

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
  // A fullscreen viewer (a playing video OR an expanded polaroid pile) "borrows"
  // the hamburger: it shows the X and a click closes that viewer (taking priority
  // over the section menu). While one is open the header goes transparent so only
  // the X floats over the darkened film.
  const { active: video, close: closeVideo } = useVideoLightbox();
  const { active: pile, close: closePile } = usePolaroidLightbox();
  const overlayOpen = video !== null || pile !== null;
  const showClose = open || overlayOpen;

  const handleClick = () => {
    if (video) {
      closeVideo();
      return;
    }
    if (pile) {
      closePile();
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <header
        className={`${styles.header} ${overlayOpen ? styles.videoMode : ""}`.trim()}
      >
        <div className={styles.inner}>
          <span className={styles.brandWrap}>
            <Brandmark compact />
          </span>

          <button
            type="button"
            className={`${styles.menuButton} ${showClose ? styles.isOpen : ""}`.trim()}
            onClick={handleClick}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={
              video
                ? "Fechar vídeo"
                : pile
                  ? "Fechar"
                  : open
                    ? "Fechar menu"
                    : "Abrir menu de seções"
            }
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
