"use client";

import { useEffect, useRef, useState } from "react";
import { CTAButton } from "@/components/ui/CTAButton";
import { IdentifyBrainSlot } from "./IdentifyBrainSlot";
import styles from "./Identify.module.css";

/** The five validated thoughts (see memory: reference_identify_section). */
const THOUGHTS = [
  {
    roman: "i",
    text: "Hoje eu como. Segunda-feira eu começo de novo.",
    echo: "toda véspera é a última",
  },
  {
    roman: "ii",
    text: "Eu mereço esse chocolate. Mas depois eu vou me odiar.",
    echo: "cada prazer cobra um preço",
  },
  {
    roman: "iii",
    text: "Olha o tanto que eu comi. Que vergonha de mim.",
    echo: "o pior crítico mora dentro",
  },
  {
    roman: "iv",
    text: "Eu sou fraca. Não tenho força de vontade nenhuma.",
    echo: "e se o problema nunca tivesse sido esse?",
  },
  {
    roman: "v",
    text: "Por que comigo tem que ser tão difícil?",
    echo: "spoiler: não tem",
  },
] as const;

/**
 * The 600vh scroll track whose sticky stage holds the (page-global) brain on
 * the left and the cycling thoughts on the right. As the user scrolls through
 * the track, the active thought advances through the five buckets — same
 * mapping as the client's mockup: a small dead zone at the very start, then the
 * remaining range split evenly across the thoughts.
 *
 * On mobile the stage isn't sticky and all bubbles are shown stacked (CSS),
 * so the active index is harmless there.
 */
export function ThoughtTrack() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf: number | null = null;

    const update = () => {
      raf = null;
      const rect = track.getBoundingClientRect();
      const dist = track.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const p = dist > 0 ? Math.max(0, Math.min(1, scrolled / dist)) : 0;
      // 5% dead zone so the first thought lingers as the stage settles, then
      // split the rest evenly across the thoughts.
      const adj = Math.max(0, (p - 0.05) / 0.95);
      const idx = Math.min(THOUGHTS.length - 1, Math.floor(adj * THOUGHTS.length));
      setActive((prev) => (prev === idx ? prev : idx));
    };

    const onScroll = () => {
      if (raf === null) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={styles.track} ref={trackRef} data-brain-track="">
      <div className={styles.stage}>
        {/* PHONE-ONLY (toggled in CSS): the section headline pulled INTO the
            pinned view, above the brain+bubble. On desktop this is display:none
            and the real .intro (in ./index.tsx) shows in normal flow; on phone
            the real .intro/.footer are hidden and these in-stage copies fill the
            otherwise-empty top/bottom so headline → brain+bubble → CTA stack
            evenly within one screen. Keep this copy in sync with ./index.tsx. */}
        <div className={styles.stageIntro}>
          <div className={styles.eyebrow}>você se identifica?</div>
          <h2 className={styles.title}>
            Você reconhece <em>esses pensamentos?</em>
          </h2>
          <p className={styles.sub}>
            Cada um deles já passou pela mente de milhares de mulheres. Talvez
            agora esteja passando pela sua.
          </p>
        </div>

        {/* Brain (left) + cycling thought bubble (right) — the two-column row
            that's the only visible stage child on desktop (centered vertically),
            and the middle band of the stacked phone layout. */}
        <div className={styles.stageMid}>
          {/* Slot for the 3D brain — registers with the BrainStage so the
              page-global canvas travels here from the Hero on scroll. */}
          <IdentifyBrainSlot />

          <div className={styles.bubbles}>
            {/* Thought "tail": three small glassy blobs trailing up from the
                bubble toward the brain, same material + float as the main bubble. */}
            <div className={styles.thoughtTail} aria-hidden="true">
              <span className={styles.tailDot} />
              <span className={styles.tailDot} />
              <span className={styles.tailDot} />
            </div>

            {THOUGHTS.map((t, i) => (
              <article
                key={t.roman}
                className={`${styles.bubble} ${i === active ? styles.active : ""}`.trim()}
                data-i={i}
              >
                <div className={styles.bubbleShape}>
                  <span className={styles.idx}>{t.roman} de v</span>
                  <blockquote className={styles.quote}>{t.text}</blockquote>
                  <span className={styles.echo}>{t.echo}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* PHONE-ONLY (toggled in CSS): the closing line + CTA pulled into the
            pinned view, below the brain+bubble. Desktop shows the real .footer. */}
        <div className={styles.stageFooter}>
          <p className={styles.pull}>
            Você <em>não está sozinha</em>.
            <br />
            Vamos conversar.
          </p>
          <CTAButton href="#contato" className={styles.lightCta}>
            Quero conversar com a Ju
          </CTAButton>
        </div>

        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressLabel}>{THOUGHTS[active].roman} / v</span>
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
