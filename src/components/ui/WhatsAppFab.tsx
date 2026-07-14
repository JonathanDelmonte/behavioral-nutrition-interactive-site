"use client";

import { useEffect, useRef, useState } from "react";
import { WHATSAPP_HREF } from "@/lib/contact";
import { WhatsAppGlyph } from "./WhatsAppGlyph";
import styles from "./WhatsAppFab.module.css";

/**
 * Mobile-only floating WhatsApp shortcut, pinned to the bottom-right corner.
 *
 * Exists because on the phone the hero CTA scrolls away and the next in-flow
 * WhatsApp button only reappears at the closing section — this keeps the
 * conversation one thumb-reach away for the whole journey. Desktop keeps the
 * in-flow CTAs only (the media queries in the module enable it exclusively on
 * the mobile branches), so this renders nothing visible there.
 *
 * Visible in the MIDDLE of the journey only: hidden while the first fold is on
 * screen (the hero already carries its own WhatsApp CTA — two in the same fold
 * would compete) and hidden again once the footer enters the viewport (the
 * finale has the big WhatsApp pill and the footer its own contact links — the
 * shortcut would be a third, floating over them). Same IntersectionObserver
 * grammar as the section reveals: a 100svh sentinel parked at the top of the
 * document gates the top edge, the <footer> element itself gates the bottom.
 * Without JS the shortcut simply never shows — it duplicates CTAs that exist
 * in-flow, so no content is lost.
 *
 * Structure is two layers on purpose (site convention, see the keyframes
 * gotcha in globals/tokens comments): the <a> carries the INTERACTIVE
 * transforms (entrance transition, press feedback), while the inner .disc
 * carries the AMBIENT idle-float animation with literal keyframe values —
 * nesting them is what lets both run without fighting over `transform`.
 */
export function WhatsAppFab() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pastHero, setPastHero] = useState(false);
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const heroIO = new IntersectionObserver(([entry]) => {
      setPastHero(!entry.isIntersecting);
    });
    heroIO.observe(sentinel);

    // The footer is server-rendered markup that exists before hydration runs
    // this effect, so a one-time query is reliable. NOT querySelector("footer"):
    // the Identify section embeds its own (display: none in most states) —
    // the SITE footer is the document's last one by construction.
    const footers = document.querySelectorAll("footer");
    const footer = footers[footers.length - 1];
    let footerIO: IntersectionObserver | null = null;
    if (footer) {
      footerIO = new IntersectionObserver(([entry]) =>
        setAtFooter(entry.isIntersecting),
      );
      footerIO.observe(footer);
    }

    return () => {
      heroIO.disconnect();
      footerIO?.disconnect();
    };
  }, []);

  const shown = pastHero && !atFooter;

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <a
        className={`${styles.fab} ${shown ? styles.shown : ""}`.trim()}
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Conversar no WhatsApp"
      >
        <span className={styles.disc}>
          <WhatsAppGlyph className={styles.glyph} />
        </span>
      </a>
    </>
  );
}

export default WhatsAppFab;
