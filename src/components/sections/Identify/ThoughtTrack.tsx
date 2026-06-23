"use client";

import { useEffect, useRef, useState } from "react";
import { CTAButton } from "@/components/ui/CTAButton";
import { IdentifyBrainSlot } from "./IdentifyBrainSlot";
import { IdentifyQuestions } from "./IdentifyQuestions";
import styles from "./Identify.module.css";

/** The five validated thoughts (see memory: reference_identify_section). */
const THOUGHTS = [
  {
    roman: "I",
    text: "Hoje eu como. Segunda-feira eu começo de novo.",
    echo: "toda véspera é a última",
  },
  {
    roman: "II",
    text: "Eu mereço esse chocolate. Mas depois eu vou me odiar.",
    echo: "cada prazer cobra um preço",
  },
  {
    roman: "III",
    text: "Olha o tanto que eu comi. Que vergonha de mim.",
    echo: "o pior crítico mora dentro",
  },
  {
    roman: "IV",
    text: "Eu falhei de novo. Não tenho força de vontade nenhuma.",
    echo: "e se o problema nunca tivesse sido esse?",
  },
  {
    roman: "V",
    text: "Por que comigo tem que ser tão difícil?",
    echo: "spoiler: não tem",
  },
] as const;

/* Progress mapping inside the (untouchable) 400vh track.

   The brain's travel/exodus is timed against the page height ABOVE the track
   and lands exactly when the stage pins (p = 0) — so the track height must
   NOT change. What changed is only WHEN each thought happens inside it:

   - 0 → SETTLE: the brain rests alone, no bubble (the landing gets a beat);
   - SETTLE → 1: five EQUAL buckets, one per thought — no more first/last
     thoughts hogging extra dwell;
   - ≥ FINAL (phones only): the closing line + CTA form in place of the
     bubble — the same dramaturgy as desktop's post-track footer. */
const SETTLE = 0.08;
const FINAL_ON = 0.94;
const FINAL_OFF = 0.91; // hysteresis so the swap never flickers

export function ThoughtTrack() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // active: -1 = landing beat (no bubble); prev drives the leaving animation.
  const [pair, setPair] = useState({ active: 0, prev: -2 });
  // Arms the enhanced styles (flora growth, etc.) once JS is live; stays
  // false under prefers-reduced-motion so the CSS defaults (everything
  // visible, fully grown) hold.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setArmed(true);

    let raf: number | null = null;
    let lastIdx = -2; // sentinel: no think-pulse on the very first sync

    // Publish half the (phone-only) headline height as --mid-rise so the CSS can
    // lift the brain+bubble block to the stage's true center once the headline
    // dissolves. Measured (not hardcoded) so it's exact however the title wraps
    // at a given width; on desktop the headline is display:none → 0, a no-op.
    const intro = stage.querySelector<HTMLElement>(`.${styles.stageIntro}`);
    const measure = () => {
      const h = intro ? intro.offsetHeight : 0;
      stage.style.setProperty("--mid-rise", `${(h / 2).toFixed(1)}px`);
    };

    const update = () => {
      raf = null;
      const rect = track.getBoundingClientRect();
      const dist = track.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const p = dist > 0 ? Math.max(0, Math.min(1, scrolled / dist)) : 0;
      track.style.setProperty("--tp", p.toFixed(4));

      // Landing beat, then five equal buckets.
      const idx =
        p < SETTLE
          ? -1
          : Math.min(
              THOUGHTS.length - 1,
              Math.floor(((p - SETTLE) / (1 - SETTLE)) * THOUGHTS.length),
            );

      if (idx !== lastIdx) {
        const prev = lastIdx;
        lastIdx = idx;
        setPair({ active: idx, prev });
        // The brain "thinks" each arriving bubble — a soft pulse through the
        // same channel the click uses (see ThinkPulse in BrainModel/Scene).
        if (idx >= 0 && prev !== -2 && !reduce) {
          window.dispatchEvent(
            new CustomEvent("brain:think", { detail: { strength: 0.5 } }),
          );
        }
      }

      // Phones: the closing line + CTA replace the bubble at the end.
      if (p >= FINAL_ON) {
        if (!stage.dataset.final) stage.dataset.final = "1";
      } else if (p < FINAL_OFF && stage.dataset.final) {
        delete stage.dataset.final;
      }
    };

    const onScroll = () => {
      if (raf === null) raf = requestAnimationFrame(update);
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    // Re-measure once webfonts land — the title's line count (and so its height)
    // can shift when the serif swaps in.
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const { active, prev } = pair;
  const labelIdx = Math.max(0, active);

  return (
    <div className={styles.track} ref={trackRef} data-brain-track="">
      <div className={styles.stage} ref={stageRef}>
        {/* Handwritten question marks murmuring across the whole stage —
            sprout, rise, dissolve, re-roll (self-contained component). */}
        <IdentifyQuestions />

        {/* PHONE-ONLY (toggled in CSS): act 1 — the section headline overlays
            the pinned view and dissolves (via --tp) as the brain settles. On
            desktop this is display:none and the real .intro shows in flow. */}
        <div className={styles.stageIntro}>
          <div className={styles.eyebrow}>você se identifica?</div>
          <h2 className={styles.title}>
            Você reconhece <em>esses pensamentos?</em>
          </h2>
          <p className={styles.sub}>
            Cada um deles já passou pela mente de muita gente. Talvez
            agora esteja passando pela sua.
          </p>
        </div>

        {/* Brain + cycling thought bubble — side by side on desktop, stacked
            (brain above, bubble below) on phones. */}
        <div className={styles.stageMid}>
          {/* Slot for the 3D brain; thinkKey re-fires the halo ring whenever a
              new thought arrives. */}
          <IdentifyBrainSlot thinkKey={armed ? active : -1} />

          <div
            className={styles.bubbles}
            data-bubbles=""
            data-none={active < 0 ? "" : undefined}
          >
            {/* Thought "tail" — remounted per thought (key) so the three blobs
                pop brain→bubble before each new bubble inflates. */}
            <div
              className={styles.thoughtTail}
              key={active}
              aria-hidden="true"
            >
              <span className={styles.tailDot} />
              <span className={styles.tailDot} />
              <span className={styles.tailDot} />
            </div>

            {THOUGHTS.map((t, i) => (
              <article
                key={t.roman}
                className={[
                  styles.bubble,
                  i === active ? styles.active : "",
                  i === prev && prev >= 0 ? styles.leaving : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-i={i}
              >
                <div
                  className={styles.bubbleShape}
                  data-bubbleshape=""
                  data-active={i === active ? "" : undefined}
                >
                  <span className={styles.idx}>{t.roman} de V</span>
                  <blockquote className={styles.quote}>{t.text}</blockquote>
                  <span className={styles.echo}>{t.echo}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* PHONE-ONLY (toggled in CSS): the finale — forms in place of the
            bubble once the five thoughts are done (.stage[data-final]). */}
        <div className={styles.stageFooter}>
          <p className={styles.pull}>
            Você <em>não precisa passar por isso só</em>.
            <br />
            Vamos conversar.
          </p>
          <CTAButton className={styles.lightCta}>
            Quero conversar com a Ju
          </CTAButton>
        </div>

        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressLabel}>
            {THOUGHTS[labelIdx].roman} / V
          </span>
          <span className={styles.progressBar}>
            {THOUGHTS.map((t, i) => (
              <span
                key={t.roman}
                className={`${styles.pd} ${i <= active ? styles.pdOn : ""}`.trim()}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ThoughtTrack;
