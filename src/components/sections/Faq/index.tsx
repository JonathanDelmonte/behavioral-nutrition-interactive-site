"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CTAButton } from "@/components/ui/CTAButton";
import styles from "./Faq.module.css";

/**
 * Section 7 — "Dúvidas": the objection-breaking FAQ staged as a conversation.
 *
 * Instead of the default accordion, the visitor "sends" a doubt by tapping a
 * paper chip from the tray: the question slides in as a sent bubble, Ju's
 * typing indicator pulses for a moment, and the answer surfaces with the
 * rise + unblur entrance the dive established. Answered exchanges collapse
 * into a compact stack (question + gold check) and reopen instantly.
 *
 * Progressive enhancement (same pattern as Journey): without JS the default
 * CSS shows the whole conversation expanded as a static log; `.enhanced`
 * turns on the chat behavior. Reduced motion skips the typing pause and all
 * entrances. NO Framer/GSAP — React state + CSS transitions only.
 */

interface Faq {
  q: string;
  a: ReactNode;
  /** The price answer carries the WhatsApp CTA inside its bubble. */
  cta?: boolean;
}

/* Draft copy for the client to fine-tune (the price answer is their exact
   wording). The convênio answer especially is a guess at their policy. */
const FAQS: Faq[] = [
  {
    q: "Vou ter que cortar carboidrato?",
    a: (
      <p>
        Não. Aqui nenhum alimento entra em lista proibida: nem o pão, nem o
        chocolate. A gente trabalha o <em>como</em> e o <em>porquê</em> do
        comer, e aí nada precisa ser cortado à força.
      </p>
    ),
  },
  {
    q: "Quanto tempo leva pra ver resultado?",
    a: (
      <p>
        As primeiras mudanças aparecem já nas primeiras semanas, e começam no
        jeito de comer: menos culpa, menos exagero, mais constância. O corpo
        vem junto, no seu ritmo. E o que vem assim, <em>fica</em>.
      </p>
    ),
  },
  {
    q: "Atende online?",
    a: (
      <p>
        Sim! As consultas por vídeo têm o mesmo cuidado das presenciais e
        funcionam de qualquer lugar. Você só precisa de um cantinho tranquilo.
      </p>
    ),
  },
  {
    q: "Aceita convênio?",
    a: (
      <p>
        O atendimento é particular, mas você recebe o recibo pra pedir
        reembolso ao seu plano de saúde, se ele tiver essa cobertura.
      </p>
    ),
  },
  {
    q: "E se eu não conseguir seguir o plano?",
    a: (
      <p>
        Então a gente ajusta <em>o plano</em>, não você. É exatamente pra isso
        que existem os retornos: entender o que travou e refazer a rota com você.
        Aqui, sair da linha não é fracasso. É informação.
      </p>
    ),
  },
  {
    q: "Já tentei de tudo. Por que agora seria diferente?",
    a: (
      <p>
        Porque dessa vez ninguém vai te entregar só mais um cardápio. A gente
        vai olhar pra causa, o que acontece <em>antes do prato</em>. Quando a
        cabeça muda junto, o resultado para de ir embora.
      </p>
    ),
  },
  {
    q: "Quanto custa?",
    a: (
      <p>
        Os investimentos variam conforme o plano de acompanhamento. Entre em
        contato pelo WhatsApp e te apresento as opções.
      </p>
    ),
    cta: true,
  },
];

const PRICE_INDEX = FAQS.length - 1;

/** Stable, slightly irregular tilts so the chips read as paper, not UI. */
const TILTS = [-2.2, 1.6, -1.2, 2.4, -1.8, 1.2, -2.6];

function Avatar() {
  return (
    <span className={styles.avatar} aria-hidden="true">
      J
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={styles.check} aria-hidden="true">
      <path pathLength={1} d="M2 8.2l3.4 3.4L13 3.4" />
    </svg>
  );
}

export function FaqSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | null>(null);
  const [answered, setAnswered] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [phase, setPhase] = useState<"typing" | "open">("open");

  // Enhanced gate + intro reveal (same grammar as Journey).
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    section.classList.add(styles.enhanced);

    const revealEls = Array.from(section.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.in);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    revealEls.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  /** Send a question (from the tray) or reopen one (from the answered stack). */
  const ask = (i: number) => {
    if (i === current) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const wasAnswered = answered.includes(i);
    setAnswered((prev) => {
      let next = prev.filter((n) => n !== i);
      // The exchange that was open moves into the answered stack.
      if (current !== null && current !== i && !next.includes(current)) {
        next = [...next, current];
      }
      return next;
    });
    setCurrent(i);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (wasAnswered || reduce) {
      // Reopening is instant; reduced motion skips the staged typing too.
      setPhase("open");
      return;
    }
    setPhase("typing");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPhase("open");
    }, 950);
  };

  // Keep the new bubbles in view and hand focus to the fresh answer.
  useEffect(() => {
    if (current === null) return;
    const el = document.getElementById(`faq-qa-${current}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      if (phase === "open") {
        el.querySelector<HTMLElement>("[data-answer]")?.focus({ preventScroll: true });
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [current, phase]);

  const allAsked = answered.length + (current !== null ? 1 : 0) === FAQS.length;
  const remaining = FAQS.map((_, i) => i).filter((i) => !answered.includes(i) && i !== current);

  return (
    <section className={styles.faq} id="duvidas" aria-labelledby="faq-title" ref={sectionRef}>
      <div className={styles.inner}>
        <header className={styles.intro}>
          <h2 className={styles.title} id="faq-title" data-reveal>
            Pode <em>perguntar</em>.
          </h2>
          <p className={styles.sub} data-reveal>
            Essas são as dúvidas que mais escuto de quem está começando. Toca
            numa ficha e eu te respondo aqui mesmo.
          </p>
          <div className={styles.aside} data-reveal>
            <span className={styles.rule} aria-hidden="true" />
            <p className={styles.note}>
              “Algumas dúvidas aparecem antes do primeiro passo.”
            </p>
            <span className={styles.sig}>
              Juliana.
            </span>
          </div>
        </header>

        <div className={styles.stage} data-reveal>
          <div className={styles.log}>
            <div className={`${styles.received} ${styles.welcome}`}>
              <Avatar />
              <div className={styles.rBubble}>
                <p>
                  Oi! Eu sou a Juliana. Separei aqui o que mais me perguntam antes
                  de começar. Escolhe uma dúvida que eu te respondo:
                </p>
              </div>
            </div>

            <div aria-live="polite" className={styles.thread}>
              {FAQS.map((f, i) => {
                const isCur = current === i;
                const isAns = answered.includes(i);
                const state = isCur
                  ? `${styles.cur} ${phase === "open" ? styles.open : ""}`
                  : isAns
                    ? styles.ans
                    : "";
                const order = isCur ? answered.length : answered.indexOf(i);
                return (
                  <div
                    key={i}
                    id={`faq-qa-${i}`}
                    className={`${styles.qa} ${state}`.trim()}
                    style={{ order } as CSSProperties}
                  >
                    <button
                      type="button"
                      className={styles.miniRow}
                      onClick={() => ask(i)}
                      tabIndex={isAns ? 0 : -1}
                      aria-hidden={!isAns}
                      aria-label={`Reabrir resposta: ${f.q}`}
                    >
                      <span className={styles.miniQ}>{f.q}</span>
                      <CheckIcon />
                    </button>

                    <div className={styles.qaBody}>
                      <div className={styles.qaBodyInner}>
                        <p className={styles.qSent}>{f.q}</p>

                        {isCur && phase === "typing" && (
                          <div className={styles.typing} aria-hidden="true">
                            <Avatar />
                            <span className={styles.tBubble}>
                              <span className={styles.tDot} />
                              <span className={styles.tDot} />
                              <span className={styles.tDot} />
                            </span>
                          </div>
                        )}

                        <div className={styles.answer} data-answer tabIndex={-1}>
                          <Avatar />
                          <div className={styles.rBubble}>
                            {f.a}
                            {f.cta && (
                              <div className={styles.bubbleCta}>
                                <CTAButton>Chamar no WhatsApp</CTAButton>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {allAsked && phase === "open" && (
              <div className={styles.closing}>
                <div className={styles.received}>
                  <Avatar />
                  <div className={styles.rBubble}>
                    <p>Não achou a sua dúvida? Me chama que a gente conversa.</p>
                    {current !== PRICE_INDEX && (
                      <div className={styles.bubbleCta}>
                        <CTAButton>Quero conversar</CTAButton>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {remaining.length > 0 && (
            <div className={styles.tray} role="group" aria-label="Dúvidas frequentes">
              {remaining.map((i, k) => (
                <button
                  key={i}
                  type="button"
                  className={styles.chip}
                  style={{ "--tilt": `${TILTS[i % TILTS.length]}deg`, "--d": k } as CSSProperties}
                  onClick={() => ask(i)}
                  aria-label={`Perguntar: ${FAQS[i].q}`}
                >
                  {FAQS[i].q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default FaqSection;
