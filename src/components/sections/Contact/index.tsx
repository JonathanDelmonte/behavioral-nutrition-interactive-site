"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { WhatsAppGlyph } from "@/components/ui/WhatsAppGlyph";
import { WHATSAPP_HREF } from "@/lib/contact";
import type { FieldPointer } from "./FruitField";
import styles from "./Contact.module.css";

/**
 * Section 8 — "Vamos conversar": the final CTA over a zero-gravity fruit
 * field.
 *
 * The fruits that flew off the brain during Section 2's exodus are found
 * again here, floating free behind the closing question — every one of the
 * GLB's 36 fruits, drifting and tumbling in zero gravity, shoved aside when
 * the pointer sweeps through them (FruitField.tsx). Reuse over duplication:
 * the field loads the same GLB + HDRI the brain already cached, in an
 * isolated per-section <Canvas> that can't affect the BrainStage choreography.
 *
 * The pointer reaches the field through a ref written here (the canvas is
 * pointer-events:none so it can never swallow clicks); the same listener
 * drives the WhatsApp pill's magnetic hover. The canvas frameloop only runs
 * while the section is on screen. Fallbacks: no-JS = copy on the green stage;
 * prefers-reduced-motion = a still scatter. The section doubles as the site
 * footer. NO Framer/GSAP outside R3F.
 */

// Three.js is heavy and DOM-dependent — client-only, like BrainModel.
const FruitField = dynamic(() => import("./FruitField"), { ssr: false });

const MAX_TILT = 12; // degrees of lean reached at the corners
const TILT_REACH = 64; // px of magnetic "pull" beyond the pill's edge
const TILT_EASE = 0.1; // per-frame approach — low = slow, gradual in & out

export function ContactSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLAnchorElement>(null);
  const pointerRef = useRef<FieldPointer>({
    nx: 0,
    ny: 0,
    at: -1e9,
    cx: 0,
    cy: 0,
    clickAt: -1e9,
  });
  const [active, setActive] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const btn = btnRef.current;
    if (!section || !stage || !btn) return;

    section.classList.add(styles.enhanced);

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mqReduce.matches);
    const onMq = () => setReduce(mqReduce.matches);
    mqReduce.addEventListener("change", onMq);

    // Reveal-on-scroll (site grammar).
    const revealEls = Array.from(section.querySelectorAll<HTMLElement>("[data-reveal]"));
    const revealIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.in);
            revealIO.unobserve(e.target);
          }
        });
      },
      { threshold: 0.25 },
    );
    revealEls.forEach((el) => revealIO.observe(el));

    // One pointer listener feeds both the fruit field (via ref, in stage-
    // normalized -1..1 coords) and the button's magnetic hover.
    const writePointer = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const p = pointerRef.current;
      p.nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      p.ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      p.at = performance.now();
    };

    // ---- Magnetic 3D tilt --------------------------------------------------
    // The pill leans toward whatever corner the cursor is near. The pointer
    // only sets a TARGET angle; a rAF loop eases the live angle toward it, so
    // the lean rolls in gradually as the cursor approaches and unwinds just as
    // gradually after it leaves — never a snap, in either direction.
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    let rx = 0,
      ry = 0,
      targetRX = 0,
      targetRY = 0;
    let tiltRaf: number | null = null;

    const aimTilt = (e: PointerEvent) => {
      const b = btn.getBoundingClientRect();
      const halfW = b.width / 2;
      const halfH = b.height / 2;
      const dx = e.clientX - (b.left + halfW);
      const dy = e.clientY - (b.top + halfH);
      if (Math.abs(dx) <= halfW + TILT_REACH && Math.abs(dy) <= halfH + TILT_REACH) {
        const nx = clamp(dx / (halfW + TILT_REACH), -1, 1);
        const ny = clamp(dy / (halfH + TILT_REACH), -1, 1);
        // Nearest corner rises toward the cursor (a magnet pulling it up).
        targetRX = ny * MAX_TILT;
        targetRY = -nx * MAX_TILT;
      } else {
        targetRX = 0;
        targetRY = 0;
      }
    };

    const tiltFrame = () => {
      rx += (targetRX - rx) * TILT_EASE;
      ry += (targetRY - ry) * TILT_EASE;
      if (Math.abs(rx) < 0.01 && Math.abs(ry) < 0.01 && targetRX === 0 && targetRY === 0) {
        rx = 0;
        ry = 0;
      }
      btn.style.transform = `perspective(720px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
      tiltRaf = requestAnimationFrame(tiltFrame);
    };
    const startTilt = () => {
      if (tiltRaf === null) tiltRaf = requestAnimationFrame(tiltFrame);
    };
    const stopTilt = () => {
      if (tiltRaf !== null) {
        cancelAnimationFrame(tiltRaf);
        tiltRaf = null;
      }
      rx = ry = targetRX = targetRY = 0;
      btn.style.transform = "";
    };

    const onMove = (e: PointerEvent) => {
      writePointer(e);
      aimTilt(e);
    };
    // Cursor leaving the stage entirely: let the lean unwind back to flat.
    const onLeave = () => {
      targetRX = 0;
      targetRY = 0;
    };

    // Click/tap fires the pressure ring from a SNAPSHOT of the press point
    // (the ring keeps expanding from there even if the hand moves on).
    const onDown = (e: PointerEvent) => {
      writePointer(e);
      const p = pointerRef.current;
      p.cx = p.nx;
      p.cy = p.ny;
      p.clickAt = performance.now();
    };

    const runIO = new IntersectionObserver(
      ([e]) => {
        setActive(e.isIntersecting);
        if (e.isIntersecting && !mqReduce.matches) {
          stage.addEventListener("pointermove", onMove, { passive: true });
          stage.addEventListener("pointerleave", onLeave, { passive: true });
          stage.addEventListener("pointerdown", onDown, { passive: true });
          startTilt();
        } else {
          stage.removeEventListener("pointermove", onMove);
          stage.removeEventListener("pointerleave", onLeave);
          stage.removeEventListener("pointerdown", onDown);
          stopTilt();
        }
      },
      { rootMargin: "10% 0px" },
    );
    runIO.observe(stage);

    return () => {
      mqReduce.removeEventListener("change", onMq);
      revealIO.disconnect();
      runIO.disconnect();
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointerdown", onDown);
      stopTilt();
    };
  }, []);

  return (
    <section
      className={styles.contact}
      id="contato"
      aria-labelledby="contact-title"
      ref={sectionRef}
    >
      <div className={styles.stage} ref={stageRef}>
        {/* Zero-gravity fruit field (behind everything, never hit-testable). */}
        <div className={styles.field} aria-hidden="true">
          <FruitField active={active} reduce={reduce} pointer={pointerRef} />
        </div>
        {/* Soft dark pool behind the copy so the headline stays sovereign. */}
        <div className={styles.vignette} aria-hidden="true" />

        <div className={styles.center}>
          <h2 className={styles.title} id="contact-title" data-reveal>
            Sua relação com a comida <em>pode ser diferente</em>.
          </h2>
          <p className={styles.ask} data-reveal>
            Vamos conversar?
          </p>
          <div className={styles.ctaWrap} data-reveal>
            <a
              className={styles.waBtn}
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              ref={btnRef}
            >
              <WhatsAppGlyph className={styles.waIcon} />
              Chamar no WhatsApp
            </a>
          </div>
          <p className={styles.micro} data-reveal>
            Sem compromisso. Quem responde sou eu mesma.
          </p>
        </div>

      </div>
    </section>
  );
}

export default ContactSection;
