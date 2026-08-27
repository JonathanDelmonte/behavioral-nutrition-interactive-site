"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CTAButton } from "@/components/ui/CTAButton";
import { FruitGlyph, PlanGlyph, ReturnsGlyph, TeaGlyph } from "./icons";
import styles from "./Journey.module.css";

/**
 * Section 6 — "Atendimento": the journey in four steps, told as a depth dive.
 *
 * Any viewport with motion allowed (desktop AND touch): a 460vh track pins a
 * CSS-3D stage. The four steps are planes parked at increasing depths; a rAF
 * loop converts scroll progress into the camera's translateZ, so each step
 * surfaces from a pale blur, takes focus, and glides past. On desktop the mouse
 * tilts the camera a couple of degrees (real parallax via preserve-3d) — touch
 * simply never fires the tilt, so the dive plays straight from scroll. A
 * clickable rail jumps between steps, and the final step swells the stage into
 * deep brand green where the CTA lives. prefers-reduced-motion / no-JS get a
 * stacked vertical column instead (the default CSS), so the dive is purely
 * progressive enhancement. NO Framer/GSAP — same rAF + IO patterns as the
 * other sections.
 *
 * Depth math: a plane's apparent distance is d = z − cam. The camera ends on
 * the last step at DWELL (94%) of the track, leaving a settle zone so the CTA
 * rests before the pin releases — and vertical scroll simply resumes below.
 */

const DWELL = 0.94;
const CAM_END = 2920;

interface Step {
  z: number;
  ox: string;
  oy: string;
  nx: string;
  ny: string;
  label: string;
  Glyph: (props: { className?: string }) => ReactNode;
  title: ReactNode;
  body: string;
}

const STEPS: Step[] = [
  {
    z: 220,
    ox: "-8vw",
    oy: "-1vh",
    nx: "13vw",
    ny: "-6vh",
    label: "primeira consulta",
    Glyph: TeaGlyph,
    title: (
      <>
        A <em>primeira</em> consulta
      </>
    ),
    body: "A gente se senta e eu escuto: sua história, sua rotina, sua relação com a comida. É daqui que tudo parte.",
  },
  {
    z: 1120,
    ox: "8vw",
    oy: "2vh",
    nx: "-15vw",
    ny: "-5vh",
    label: "seu plano",
    Glyph: PlanGlyph,
    title: (
      <>
        Um plano <em>com a sua cara</em>
      </>
    ),
    body: "Nada de cardápio de gaveta: montamos em conjunto um caminho que cabe nos seus horários, nos seus gostos e na sua vida real.",
  },
  {
    z: 2020,
    ox: "-7vw",
    oy: "-2vh",
    nx: "14vw",
    ny: "5vh",
    label: "retornos",
    Glyph: ReturnsGlyph,
    title: (
      <>
        Retornos que <em>ajustam o caminho</em>
      </>
    ),
    body: "A cada encontro a gente afina o que funcionou e destrava o que travou. Você tem acompanhamento em cada passo.",
  },
  {
    z: 2920,
    ox: "0vw",
    oy: "0vh",
    nx: "-13vw",
    ny: "-6vh",
    label: "o resultado",
    Glyph: FruitGlyph,
    title: (
      <>
        O resultado <em>que fica</em>
      </>
    ),
    body: "Uma relação leve com a comida, um corpo que acompanha. E nenhuma segunda-feira pra recomeçar.",
  },
];

/** Decorative layers at intermediate depths so the dive has a world. */
const ATMOS: { kind: "fog" | "sprig" | "motes"; z: number; ox: string; oy: string; flip?: boolean }[] = [
  { kind: "fog", z: 420, ox: "22vw", oy: "-14vh" },
  { kind: "sprig", z: 620, ox: "-26vw", oy: "8vh" },
  { kind: "motes", z: 1060, ox: "-18vw", oy: "-6vh" },
  { kind: "fog", z: 1560, ox: "-24vw", oy: "12vh" },
  { kind: "sprig", z: 1900, ox: "24vw", oy: "6vh", flip: true },
  { kind: "fog", z: 2440, ox: "18vw", oy: "-12vh" },
  { kind: "motes", z: 2700, ox: "24vw", oy: "16vh" },
];

/** Thin-line botanical sprig (same idiom as the step glyphs). */
function Sprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 80"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M32 78C30 56 28 34 34 6" />
      <path d="M33.5 18c-7-1-11-5.5-12-12 7 1 11 5.5 12 12z" />
      <path d="M33 34c7-1 11-5.5 12-12-7 1-11 5.5-12 12z" />
      <path d="M32.5 52c-7-1-11-5.5-12-12 7 1 11 5.5 12 12z" />
    </svg>
  );
}

export function JourneySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const jackedRef = useRef(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    const tilt = tiltRef.current;
    const world = worldRef.current;
    if (!section || !track || !stage || !tilt || !world) return;

    // Gates the dive layout + entrance states; without JS the default stacked
    // CSS simply renders everything visible.
    section.classList.add(styles.enhanced);

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // The dive runs at every width now — touch included; only reduced-motion
    // (or no-JS) falls back to the stacked column.
    const isJacked = () => !mqReduce.matches;

    // Stacked-mode entrances (also primes glyph drawing on mobile).
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
      { threshold: 0.2 },
    );
    revealEls.forEach((el) => revealIO.observe(el));

    type Item = {
      node: HTMLElement;
      z: number;
      step: number;
      op: number;
      blur: number;
      vis: boolean;
      focus: boolean;
    };
    const items: Item[] = Array.from(track.querySelectorAll<HTMLElement>("[data-z]")).map(
      (node) => ({
        node,
        z: parseFloat(node.dataset.z ?? "0"),
        step: node.dataset.step ? parseInt(node.dataset.step, 10) : -1,
        op: -1,
        blur: -1,
        vis: true,
        focus: false,
      }),
    );

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    let raf: number | null = null;
    let running = false;
    let jacked = isJacked();
    jackedRef.current = jacked;
    let mx = 0,
      my = 0,
      tx = 0,
      ty = 0;
    let lastDrench = -1,
      lastHint = -1,
      lastActive = -1,
      deepOn = false;

    const resetItem = (it: Item) => {
      it.node.style.visibility = "";
      it.node.style.removeProperty("--op");
      it.node.style.removeProperty("--blur");
      if (it.step >= 0) it.node.classList.remove(styles.focus);
      it.op = it.blur = -1;
      it.vis = true;
      it.focus = false;
    };

    /** Leaving dive mode (resize down / reduced motion): wipe inline state. */
    const clearDive = () => {
      world.style.transform = "";
      tilt.style.transform = "";
      stage.style.removeProperty("--hintOp");
      section.style.removeProperty("--drench");
      section.classList.remove(styles.deep);
      deepOn = false;
      items.forEach(resetItem);
      lastDrench = lastHint = -1;
    };

    const onMove = (e: MouseEvent) => {
      mx = clamp01(e.clientX / window.innerWidth) * 2 - 1;
      my = clamp01(e.clientY / window.innerHeight) * 2 - 1;
    };

    const frame = () => {
      raf = running ? requestAnimationFrame(frame) : null;
      if (!jacked) return;

      const rect = track.getBoundingClientRect();
      const dist = rect.height - window.innerHeight;
      const p = dist > 0 ? clamp01(-rect.top / dist) : 0;
      const cam = Math.min(p / DWELL, 1) * CAM_END;

      // Camera dolly + the mouse's gentle tilt (real parallax via preserve-3d).
      // Once the dive reaches the final step (deep), the tilt eases flat and
      // stops tracking the mouse: the CTA lives on this very plane, and a world
      // that keeps re-tilting under the cursor re-projects the pill's hit box
      // every frame — so its hover flickers on/off and the button judders.
      // A flat, still world here ⇒ rock-stable hover on the CTA.
      const tiltSettled = p > 0.835;
      tx = lerp(tx, tiltSettled ? 0 : mx, 0.06);
      ty = lerp(ty, tiltSettled ? 0 : my, 0.06);
      world.style.transform = `translateZ(${cam.toFixed(1)}px)`;
      tilt.style.transform = `rotateX(${(-ty * 1.7).toFixed(2)}deg) rotateY(${(tx * 2.3).toFixed(2)}deg)`;

      let nearest = 0;
      let nearestD = Infinity;
      for (const it of items) {
        const d = it.z - cam;
        // Far: surfaces out of the mist. Near: fades while flying past.
        const opFar = clamp01(1 - (d - 300) / 900);
        const opNear = d >= -90 ? 1 : clamp01(1 + (d + 90) / 330);
        const op = Math.round(opFar * opNear * 100) / 100;
        // Blur is quantized to 0.5px steps so the filter only re-rasterizes
        // when the value actually changes.
        const blurRaw =
          d > 160 ? Math.min(9, (d - 160) / 120) : d < -90 ? Math.min(14, -(d + 90) / 26) : 0;
        const blur = Math.round(blurRaw * 2) / 2;
        const vis = op > 0.015 && d > -430;

        if (op !== it.op) {
          it.node.style.setProperty("--op", String(op));
          it.op = op;
        }
        if (blur !== it.blur) {
          it.node.style.setProperty("--blur", String(blur));
          it.blur = blur;
        }
        if (vis !== it.vis) {
          it.node.style.visibility = vis ? "visible" : "hidden";
          it.vis = vis;
        }

        if (it.step >= 0) {
          const focus = Math.abs(d) < 260;
          if (focus !== it.focus) {
            it.node.classList.toggle(styles.focus, focus);
            it.focus = focus;
          }
          if (Math.abs(d) < nearestD) {
            nearestD = Math.abs(d);
            nearest = it.step;
          }
        }
      }

      if (nearest !== lastActive) {
        lastActive = nearest;
        setActive(nearest);
      }

      // The deep-green swell under the final step (smoothstep, late in the
      // track — steps 1–3 have already flown past when it begins).
      const tRaw = clamp01((p - 0.78) / 0.16);
      const drench = Math.round(tRaw * tRaw * (3 - 2 * tRaw) * 100) / 100;
      if (drench !== lastDrench) {
        section.style.setProperty("--drench", String(drench));
        lastDrench = drench;
      }
      const deep = p > 0.835;
      if (deep !== deepOn) {
        section.classList.toggle(styles.deep, deep);
        deepOn = deep;
      }

      const hint = Math.round(clamp01(1 - p * 14) * 100) / 100;
      if (hint !== lastHint) {
        stage.style.setProperty("--hintOp", String(hint));
        lastHint = hint;
      }
    };

    // The loop (and the mousemove listener) only run while the section is
    // anywhere near the viewport — same economy as About's parallax.
    const runIO = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !running) {
          running = true;
          window.addEventListener("mousemove", onMove, { passive: true });
          if (raf === null) raf = requestAnimationFrame(frame);
        } else if (!e.isIntersecting && running) {
          running = false;
          window.removeEventListener("mousemove", onMove);
          if (raf !== null) {
            cancelAnimationFrame(raf);
            raf = null;
          }
        }
      },
      { rootMargin: "12% 0px" },
    );
    runIO.observe(track);

    const onModeChange = () => {
      const j = isJacked();
      if (j === jacked) return;
      jacked = j;
      jackedRef.current = j;
      if (!j) clearDive();
    };
    window.addEventListener("resize", onModeChange);
    mqReduce.addEventListener("change", onModeChange);

    return () => {
      revealIO.disconnect();
      runIO.disconnect();
      window.removeEventListener("resize", onModeChange);
      mqReduce.removeEventListener("change", onModeChange);
      window.removeEventListener("mousemove", onMove);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  /** Rail click: scroll the page to the point of the track that focuses step i. */
  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    if (!jackedRef.current) {
      track.querySelectorAll<HTMLElement>("[data-step]")[i]?.scrollIntoView({
        behavior,
        block: "center",
      });
      return;
    }
    const rect = track.getBoundingClientRect();
    const dist = rect.height - window.innerHeight;
    const top = window.scrollY + rect.top + ((DWELL * STEPS[i].z) / CAM_END) * dist + 2;
    window.scrollTo({ top, behavior });
  };

  return (
    <section
      className={styles.journey}
      id="atendimento"
      aria-labelledby="journey-title"
      ref={sectionRef}
    >
      <div className={styles.intro}>
        <h2 className={styles.title} id="journey-title" data-reveal>
          E na prática, <em>como funciona?</em>
        </h2>
        <p className={styles.sub} data-reveal>
          Quatro passos para compreender seus hábitos, seus comportamentos, sua relação com a comida e cuidar de você.
        </p>
      </div>

      <div className={styles.diveTrack} ref={trackRef}>
        <div className={styles.stage} ref={stageRef}>
          <div className={styles.drench} aria-hidden="true" />

          <div className={styles.tilt} ref={tiltRef}>
            <div className={styles.world} ref={worldRef}>
              {ATMOS.map((a, i) => (
                <div
                  key={i}
                  className={`${styles.atmo} ${styles[a.kind]}${a.flip ? ` ${styles.sprigFlip}` : ""}`}
                  data-z={a.z}
                  style={{ "--z": `${a.z}`, "--ox": a.ox, "--oy": a.oy } as CSSProperties}
                  aria-hidden="true"
                >
                  {a.kind === "sprig" && <Sprig />}
                  {a.kind === "motes" && (
                    <>
                      <span className={styles.mote} />
                      <span className={styles.mote} />
                      <span className={styles.mote} />
                    </>
                  )}
                </div>
              ))}

              {STEPS.map((s, i) => (
                <div
                  key={i}
                  className={styles.plane}
                  data-z={s.z}
                  data-step={i}
                  data-reveal
                  style={
                    {
                      "--z": `${s.z}`,
                      "--ox": s.ox,
                      "--oy": s.oy,
                      "--nx": s.nx,
                      "--ny": s.ny,
                    } as CSSProperties
                  }
                >
                  <span className={styles.num} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className={styles.card}>
                    <s.Glyph className={styles.glyph} />
                    <span className={styles.accent} aria-hidden="true" />
                    <h3 className={styles.stepTitle}>{s.title}</h3>
                    <p className={styles.stepBody}>{s.body}</p>
                    {i === STEPS.length - 1 && (
                      <div className={styles.ctaRow}>
                        <CTAButton className={styles.journeyCta}>
                          Quero começar
                        </CTAButton>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.rail} role="group" aria-label="Passos do atendimento">
            {STEPS.map((s, i) => (
              <button
                key={i}
                type="button"
                className={styles.railBtn}
                aria-current={active === i ? "true" : undefined}
                aria-label={`Ir ao passo ${i + 1}: ${s.label}`}
                onClick={() => goTo(i)}
              >
                <span className={styles.railLabel} aria-hidden="true">
                  {s.label}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.hint} aria-hidden="true">
            continue rolando
            <svg
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.hintArrow}
            >
              <path d="M2 4.5l4 4 4-4" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

export default JourneySection;
