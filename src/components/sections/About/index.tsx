"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./About.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PORTRAIT = `${BASE_PATH}/images/about/juliana.webp`;
const VINES = `${BASE_PATH}/images/about/vines.webp`;
const POND = `${BASE_PATH}/images/about/pond.webp`;

/**
 * Section 4 — "Conheça a Ju": an editorial garden spread.
 *
 * Composition (static in the page flow — no scroll choreography):
 *   - the whole section sits over a soft ink-wash POND illustration (.bg,
 *     client-supplied art, opacity-lowered so the page tone shows through);
 *   - an arch of VINES stands behind the portrait; the figure floats right
 *     and the bio text wraps around a conservative CSS shape that protects
 *     the arch's leafy contour;
 *   - the display heading layers BEHIND the arch (heading z1, figure z2) —
 *     the staggered "a Ju." tucks its gold tail into the foliage;
 *   - Juliana stands inside the arch in full color (no filter games), her
 *     lower crop dissolving into the leaves via mask fade.
 *
 * Ambient life ("vivo mas calmo", all gated by .enhanced + IO visibility):
 *   - the vines breathe: a barely-there CSS sway (reduced-motion: none);
 *   - the vine arch and Juliana separate gently with pointer parallax;
 *   - gold dust motes drift on a 2D canvas, nudged by the pointer;
 *   - leaves let go of the arch on a steady, even cadence and tumble down,
 *     spread across its full width — never more than a few alive at once.
 *
 * Progressive enhancement: default render (no-JS / prefers-reduced-motion)
 * is the complete static spread. Same rAF + IO patterns as every other
 * section. NO Framer/GSAP.
 */

const DUST = {
  density: 1 / 28000, // particles per CSS px² of section area
  max: 60,
  drift: 9, // px/s upward drift
  wobble: 12, // px horizontal sway amplitude
  force: 240, // px/s² pointer repulsion at zero distance
  forceRadius: 130,
  settle: 1.4, // /s — how fast displacement relaxes back
};

const LEAVES = {
  slots: 6, // pool of leaf objects — only ~3-4 are ever alive at once
  lanes: 5, // successive leaves round-robin across these x columns of the arch
  releaseMin: 3.6, // s — one global, evenly-spaced release valve (not per-slot)
  releaseMax: 6.4,
  firstAt: 0.6, // first leaf drops shortly after the section scrolls in
  fall: 46, // px/s base fall speed — a gentle drift, not a near-frozen hang
  sway: 30, // px horizontal sway amplitude
  size: 7, // base half-length in px
  bandMin: 0.06, // leaves use almost the arch's full width (was 0.15..0.85)
  bandMax: 0.94,
};

/** Deterministic pseudo-random (no Math.random — stable across renders). */
const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, has: false });

  const [enhanced, setEnhanced] = useState(false);
  const [inView, setInView] = useState(false);

  /* Opt into the ambient layer only when motion is welcome. */
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEnhanced(true);
    }
  }, []);

  /* Entrance reveal (once, on scroll-in). State, not classList — a re-render
     must not clobber the class. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !enhanced) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enhanced]);

  /* Gold dust + the occasional falling leaf — one canvas, one rAF, running
     only while the section is on screen. */
  useEffect(() => {
    if (!enhanced) return;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const figure = figureRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Mote = {
      bx: number; by: number;
      ox: number; oy: number; vox: number; voy: number;
      r: number; alpha: number; wPhase: number; wFreq: number;
      tPhase: number; tFreq: number; gold: boolean;
    };
    type Leaf = {
      active: boolean;
      x: number; y: number; phase: number; spin: number; speed: number;
      size: number; alpha: number; moss: boolean;
    };
    let motes: Mote[] = [];
    const leaves: Leaf[] = Array.from({ length: LEAVES.slots }, () => ({
      active: false,
      x: 0, y: 0, phase: 0, spin: 0, speed: 0, size: 0, alpha: 0, moss: false,
    }));
    let leafSeed = 0;
    let laneCursor = 0; // walks the lanes so x stays balanced left↔right
    let nextReleaseAt = Infinity; // armed when the section scrolls into view
    let W = 0;
    let H = 0;
    let parallaxX = 0;
    let parallaxY = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;

    const seed = () => {
      const rect = section.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(DUST.max, Math.round(W * H * DUST.density));
      motes = Array.from({ length: n }, (_, i) => ({
        bx: prand(i, 1) * W,
        by: prand(i, 2) * H,
        ox: 0, oy: 0, vox: 0, voy: 0,
        r: 0.8 + prand(i, 3) * 1.7,
        alpha: 0.12 + prand(i, 4) * 0.3,
        wPhase: prand(i, 5) * Math.PI * 2,
        wFreq: 0.25 + prand(i, 6) * 0.2,
        tPhase: prand(i, 7) * Math.PI * 2,
        tFreq: (Math.PI * 2) / (3.2 + prand(i, 8) * 2.4),
        gold: prand(i, 9) > 0.25,
      }));
    };
    seed();
    const ro = new ResizeObserver(seed);
    ro.observe(section);

    const setParallax = (x: number, y: number) => {
      section.style.setProperty("--about-vines-x", `${(-x * 7).toFixed(2)}px`);
      section.style.setProperty("--about-vines-y", `${(-y * 4).toFixed(2)}px`);
      section.style.setProperty("--about-portrait-x", `${(x * 13).toFixed(2)}px`);
      section.style.setProperty("--about-portrait-y", `${(y * 8).toFixed(2)}px`);
    };
    const resetParallax = () => {
      targetParallaxX = 0;
      targetParallaxY = 0;
      pointerRef.current.has = false;
    };

    /** A leaf lets go of the arch and starts its drift down the canvas. */
    const releaseLeaf = (leaf: Leaf) => {
      leafSeed++;
      const fr = figure?.getBoundingClientRect();
      const sr = section.getBoundingClientRect();
      const fx = fr ? fr.left - sr.left : W * 0.7;
      const fw = fr ? fr.width : W * 0.3;
      // Round-robin across lanes so successive leaves step evenly across the
      // arch's width — left↔right stays balanced even with only a few alive.
      const laneW = (LEAVES.bandMax - LEAVES.bandMin) / LEAVES.lanes;
      const lane = laneCursor++ % LEAVES.lanes;
      const center = LEAVES.bandMin + (lane + 0.5) * laneW;
      const jitter = (prand(leafSeed, 21) - 0.5) * laneW * 0.7;
      leaf.active = true;
      leaf.x = fx + fw * (center + jitter);
      leaf.y = fr ? fr.top - sr.top + 30 + prand(leafSeed, 22) * 120 : 0;
      leaf.phase = prand(leafSeed, 23) * Math.PI * 2;
      leaf.spin = 0.6 + prand(leafSeed, 24) * 0.9; // rad/s rocking
      leaf.speed = LEAVES.fall * (0.8 + prand(leafSeed, 25) * 0.5);
      leaf.size = LEAVES.size * (0.8 + prand(leafSeed, 26) * 0.6);
      leaf.alpha = 0.32 + prand(leafSeed, 27) * 0.2;
      leaf.moss = prand(leafSeed, 28) > 0.5;
    };

    const drawLeaf = (leaf: Leaf, t: number) => {
      const rock = Math.sin(t * leaf.spin + leaf.phase) * 0.7;
      ctx.save();
      ctx.translate(leaf.x + Math.sin(t * 0.7 + leaf.phase) * LEAVES.sway, leaf.y);
      ctx.rotate(rock);
      ctx.globalAlpha = leaf.alpha;
      ctx.fillStyle = leaf.moss ? "#2E6B47" : "#7e9272";
      const s = leaf.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.9, 0, 0, s);
      ctx.quadraticCurveTo(-s * 0.9, 0, 0, -s);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let running = false;
    let last = 0;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const rect = canvas.getBoundingClientRect();
      const p = pointerRef.current;
      const px = p.x - rect.left;
      const py = p.y - rect.top;
      const t = now / 1000;
      ctx.clearRect(0, 0, W, H);

      const parallaxEase = 1 - Math.exp(-dt * 5.5);
      parallaxX += (targetParallaxX - parallaxX) * parallaxEase;
      parallaxY += (targetParallaxY - parallaxY) * parallaxEase;
      setParallax(parallaxX, parallaxY);

      for (const m of motes) {
        m.by -= DUST.drift * dt;
        if (m.by < -8) {
          m.by = H + 8;
          m.bx = prand(Math.round(m.bx + t), 11) * W;
        }
        const sway = Math.sin(t * m.wFreq + m.wPhase) * DUST.wobble;
        let x = m.bx + sway + m.ox;
        let y = m.by + m.oy;
        if (p.has) {
          const dx = x - px;
          const dy = y - py;
          const d = Math.hypot(dx, dy);
          if (d < DUST.forceRadius && d > 0.5) {
            const f = DUST.force * (1 - d / DUST.forceRadius);
            m.vox += (dx / d) * f * dt;
            m.voy += (dy / d) * f * dt;
          }
        }
        m.ox += m.vox * dt;
        m.oy += m.voy * dt;
        const k = Math.max(0, 1 - DUST.settle * dt);
        m.vox *= k;
        m.voy *= k;
        m.ox *= k;
        m.oy *= k;
        x = m.bx + sway + m.ox;
        y = m.by + m.oy;
        const tw = 0.65 + 0.35 * Math.sin(t * m.tFreq + m.tPhase);
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = m.gold
          ? `rgba(184, 146, 74, ${(m.alpha * tw).toFixed(3)})`
          : `rgba(46, 107, 71, ${(m.alpha * 0.8 * tw).toFixed(3)})`;
        ctx.fill();
      }

      // Drift the live leaves; recycle the ones that reach the bottom.
      for (const leaf of leaves) {
        if (!leaf.active) continue;
        leaf.y += leaf.speed * dt;
        if (leaf.y > H + 16) {
          leaf.active = false;
          continue;
        }
        drawLeaf(leaf, t);
      }
      // One global, evenly-spaced release valve: a steady trickle in time (no
      // per-slot bursts, no long gaps), independent of how fast each leaf drifts.
      if (t >= nextReleaseAt) {
        const free = leaves.find((l) => !l.active);
        if (free) releaseLeaf(free);
        nextReleaseAt =
          t + LEAVES.releaseMin +
          prand(++leafSeed, 29) * (LEAVES.releaseMax - LEAVES.releaseMin);
      }

      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.has = true;
      const rect = section.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetParallaxX = Math.max(-1, Math.min(1, nx));
      targetParallaxY = Math.max(-1, Math.min(1, ny));
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !running) {
          running = true;
          last = performance.now();
          nextReleaseAt = last / 1000 + LEAVES.firstAt;
          section.addEventListener("pointermove", onMove, { passive: true });
          section.addEventListener("pointerleave", resetParallax);
          raf = requestAnimationFrame(frame);
        } else if (!e.isIntersecting && running) {
          running = false;
          section.removeEventListener("pointermove", onMove);
          section.removeEventListener("pointerleave", resetParallax);
          cancelAnimationFrame(raf);
          parallaxX = 0;
          parallaxY = 0;
          resetParallax();
          setParallax(0, 0);
        }
      },
      { rootMargin: "8% 0px" },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      ro.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", resetParallax);
      cancelAnimationFrame(raf);
      setParallax(0, 0);
    };
  }, [enhanced]);

  const sectionClass = [
    styles.about,
    enhanced ? styles.enhanced : "",
    inView ? styles.in : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={sectionClass}
      id="sobre"
      aria-labelledby="about-title"
      ref={sectionRef}
    >
      <div
        className={styles.bg}
        style={{ backgroundImage: `url("${POND}")` }}
        aria-hidden="true"
      />
      {enhanced && (
        <canvas className={styles.dust} ref={canvasRef} aria-hidden="true" />
      )}
      <div className={styles.inner}>
        <span className={styles.kicker}>a pessoa por trás do método</span>
        <h2 className={styles.heading} id="about-title">
          Oi, eu sou
          <span className={styles.headingTail}>
            a <em>Ju.</em>
          </span>
        </h2>
        <div className={styles.prose}>
          <div className={styles.figure} ref={figureRef}>
            <img
              className={styles.vines}
              src={VINES}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <div className={styles.portrait}>
              <img
                src={PORTRAIT}
                alt="Juliana Delmonte, nutricionista, sorrindo"
                draggable={false}
              />
            </div>
          </div>
          <p>
            Ao longo dos anos de consultório, vi um padrão se repetir em
            pessoas com histórias muito diferentes: a comida virando cobrança,
            culpa e sensação de fracasso. O problema nunca foi falta de força
            de vontade. Era a forma de olhar.
          </p>
          <p>
            Foi por isso que escolhi a <em>nutrição comportamental</em>. Em vez
            de entregar mais uma dieta, eu te ajudo a entender o que acontece
            antes do prato: os gatilhos, a história, a sua relação com o
            comer. É aí que a mudança finalmente passa a durar.
          </p>
          <p>
            Mais do que um cardápio, eu ofereço companhia nesse caminho. No seu
            tempo, sem culpa.
          </p>
          <p className={styles.creds}>
            CRN-0 00000 · Pós em Nutrição Comportamental · [especialização]
          </p>
        </div>
      </div>
    </section>
  );
}

export default AboutSection;
