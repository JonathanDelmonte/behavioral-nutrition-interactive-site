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
 *   - the vine arch and Juliana drift with a single-smoother depth parallax —
 *     the near portrait leads the far arch on both pointer move and scroll;
 *   - gold dust motes drift on a 2D canvas, nudged by the pointer;
 *   - leaves let go of the arch on a steady, gentle cadence and tumble down,
 *     scattered across its full width by random non-adjacent hops — a slow,
 *     continuous trickle, never a downpour and never the same side twice.
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
  slots: 10, // pool of leaf objects — headroom so a release is never dropped
  lanes: 7, // x columns of the arch; successive leaves hop ≥2 lanes apart
  releaseMin: 2.4, // s — one global release valve; tighter range = no long gaps
  releaseMax: 4.0,
  firstAt: 0.6, // first leaf drops shortly after the section scrolls in
  fall: 46, // px/s base fall speed — a gentle drift, not a near-frozen hang
  sway: 30, // px horizontal sway amplitude
  size: 7, // base half-length in px
  bandMin: 0.06, // leaves use almost the arch's full width (was 0.15..0.85)
  bandMax: 0.94,
};

/* One-shot "shake the bush" burst — fired on click, drawn on its OWN canvas
   layered IN FRONT of the arch + portrait (the ambient leaves above stay
   behind them, untouched). A generous handful of leaves let go ALONG the
   silhouette's contour (see ARCH) in quick succession and tumble down with a
   little gravity, hugging the shape, then the array drains itself empty. */
const BURST = {
  countMin: 16, // leaves per click — "muitas", como sacudir um galho
  countMax: 26,
  cap: 120, // hard ceiling across rapid clicks (perf guard)
  gravity: 130, // px/s² — they pick up a little speed as they fall
  vy0Min: 24, // px/s — initial downward speed
  vy0Max: 56,
  vyMax: 165, // px/s — terminal fall speed
  scatter: 14, // px/s — gentle drift off the edge (small: leaves stay near it)
  noise: 6, // px/s — tiny random horizontal jitter on top
  drag: 1.1, // /s — that sideways drift eases out
  delayMax: 0.36, // s — they detach in quick succession, not all at once
  sizeMin: 0.8, // ×LEAVES.size half-length
  sizeMax: 1.7,
  alphaMin: 0.42, // a touch stronger than ambient — they read in front
  alphaMax: 0.72,
  spinMin: 0.7, // rad/s rocking
  spinMax: 1.9,
};

/* The vine arch's outline in figure-normalized coords (0..1 across the figure
   box): a domed top sitting on two near-vertical sides. Burst leaves are born
   ALONG this contour so they peel off the silhouette's EDGE — never appearing
   out of nowhere in the middle of it. Approximate; nudge to trace the art. */
const ARCH = {
  cx: 0.5, // horizontal centre of the arch
  halfW: 0.46, // half-width → sides sit at u ≈ 0.04 and 0.96
  domeTopV: 0.015, // the crown, just below the figure's top edge
  shoulderV: 0.34, // where the dome rounds into the vertical sides
  baseV: 0.9, // how far down the sides the leaves still let go
  band: 0.05, // soft inward thickness so it's an edge, not a hairline
  domeShare: 0.5, // share of leaves released from the crown vs the two sides
};

/* Depth parallax for the arch + portrait. ONE smoother (the rAF lerp below) —
   the CSS carries no transform transition, so motion stays glued to the input
   instead of rubber-banding. Both layers travel the SAME direction; the near
   portrait simply moves more than the far arch, which reads as depth (moving
   them opposite would just shear two flat planes). "vivo mas calmo": small px. */
const PARALLAX = {
  smooth: 5.5, // /s — exponential follow of the pointer toward its target
  vinesPointer: { x: 5, y: 3 }, // far arch — a small, anchored drift
  portraitPointer: { x: 13, y: 8 }, // near portrait — leads the arch
  vinesScroll: 7, // px — arch's vertical drift across the whole scroll pass
  portraitScroll: 16, // px — portrait drifts more → it leads on scroll too
};

/** Deterministic pseudo-random (no Math.random — stable across renders). */
const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstCanvasRef = useRef<HTMLCanvasElement>(null);
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
    const portrait = portraitRef.current;
    if (!section || !canvas) return;
    // Phone breakpoint (matches the CSS @media): on phones the parallax is
    // dropped and the click only counts on Juliana's portrait, not the foliage.
    const phone = window.matchMedia("(max-width: 860px)");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Front layer for the click burst (separate canvas → it sits over the arch
    // while the ambient leaves stay behind it). Optional: absence just disables
    // the burst, never the ambient layer.
    const burstCanvas = burstCanvasRef.current;
    const burstCtx = burstCanvas?.getContext("2d") ?? null;

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
    // Burst leaves are a dynamic list (grows on click, drains as they fall).
    // Shares drawLeaf's shape; carries its own velocity + detach delay.
    type BurstLeaf = {
      x: number; y: number; vx: number; vy: number; delay: number;
      phase: number; spin: number; size: number; alpha: number; moss: boolean;
    };
    let motes: Mote[] = [];
    const leaves: Leaf[] = Array.from({ length: LEAVES.slots }, () => ({
      active: false,
      x: 0, y: 0, phase: 0, spin: 0, speed: 0, size: 0, alpha: 0, moss: false,
    }));
    const burstLeaves: BurstLeaf[] = [];
    let leafSeed = 0;
    let lastLane = 0; // last lane used; next leaf hops a random ≥2-lane jump
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
      if (burstCanvas && burstCtx) {
        burstCanvas.width = Math.round(W * dpr);
        burstCanvas.height = Math.round(H * dpr);
        burstCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
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

    // x,y ∈ [-1,1] from the pointer (eased); s ∈ [-1,1] from scroll progress.
    // Same-direction offsets, portrait magnitude > arch magnitude → depth.
    const setParallax = (x: number, y: number, s: number) => {
      const vx = -x * PARALLAX.vinesPointer.x;
      const vy = -y * PARALLAX.vinesPointer.y - s * PARALLAX.vinesScroll;
      const px = -x * PARALLAX.portraitPointer.x;
      const py = -y * PARALLAX.portraitPointer.y - s * PARALLAX.portraitScroll;
      section.style.setProperty("--about-vines-x", `${vx.toFixed(2)}px`);
      section.style.setProperty("--about-vines-y", `${vy.toFixed(2)}px`);
      section.style.setProperty("--about-portrait-x", `${px.toFixed(2)}px`);
      section.style.setProperty("--about-portrait-y", `${py.toFixed(2)}px`);
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
      // Random non-adjacent hop across lanes (circular): the next leaf jumps
      // 2..lanes-2 columns from the last one, so it never lands on the same
      // spot or one beside it — scattered and balanced, but with no fixed
      // sweep pattern the eye can latch onto.
      const laneW = (LEAVES.bandMax - LEAVES.bandMin) / LEAVES.lanes;
      const hop = 2 + Math.floor(prand(leafSeed, 20) * (LEAVES.lanes - 3));
      lastLane = (lastLane + hop) % LEAVES.lanes;
      const lane = lastLane;
      const center = LEAVES.bandMin + (lane + 0.5) * laneW;
      const jitter = (prand(leafSeed, 21) - 0.5) * laneW * 0.8;
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

    // Shared leaf shape — drawn to whichever canvas (dust = ambient,
    // burstCtx = the click burst in front). Only reads x/y/phase/spin/size/
    // alpha/moss, so both leaf kinds qualify.
    type DrawableLeaf = {
      x: number; y: number; phase: number; spin: number;
      size: number; alpha: number; moss: boolean;
    };
    const drawLeaf = (
      c: CanvasRenderingContext2D,
      leaf: DrawableLeaf,
      t: number,
    ) => {
      const rock = Math.sin(t * leaf.spin + leaf.phase) * 0.7;
      c.save();
      c.translate(leaf.x + Math.sin(t * 0.7 + leaf.phase) * LEAVES.sway, leaf.y);
      c.rotate(rock);
      c.globalAlpha = leaf.alpha;
      c.fillStyle = leaf.moss ? "#2E6B47" : "#7e9272";
      const s = leaf.size;
      c.beginPath();
      c.moveTo(0, -s);
      c.quadraticCurveTo(s * 0.9, 0, 0, s);
      c.quadraticCurveTo(-s * 0.9, 0, 0, -s);
      c.fill();
      c.restore();
      c.globalAlpha = 1;
    };

    /** A random point on the arch's contour (figure-normalized u,v), pulled a
        touch inward by a soft band so the edge isn't a hairline. Returns the
        outward sign too (−1 left, +1 right, ~0 crown) for the drift kick. */
    const archPoint = () => {
      const inset = Math.random() * ARCH.band; // toward the interior
      if (Math.random() < ARCH.domeShare) {
        // Top dome: a ∈ [0,π] sweeps left shoulder → crown → right shoulder.
        const a = Math.random() * Math.PI;
        const rx = ARCH.halfW - inset;
        const ry = Math.max(0, ARCH.shoulderV - ARCH.domeTopV - inset);
        const u = ARCH.cx - rx * Math.cos(a);
        return { u, v: ARCH.shoulderV - ry * Math.sin(a), out: (u - ARCH.cx) };
      }
      // One of the two vertical sides, somewhere between shoulder and base.
      const right = Math.random() < 0.5;
      const edge = right ? ARCH.cx + ARCH.halfW : ARCH.cx - ARCH.halfW;
      const u = right ? edge - inset : edge + inset;
      const v = ARCH.shoulderV + Math.random() * (ARCH.baseV - ARCH.shoulderV);
      return { u, v, out: right ? 1 : -1 };
    };

    /** Click → a handful of leaves let go along the contour and tumble down.
        Math.random (not prand): each shake should differ, and this only ever
        runs from a user gesture, so there's no hydration stability to keep. */
    const spawnBurst = () => {
      const fr = figure?.getBoundingClientRect();
      if (!fr || burstLeaves.length > BURST.cap) return;
      const sr = section.getBoundingClientRect();
      const fx = fr.left - sr.left;
      const fy = fr.top - sr.top;
      const fw = fr.width;
      const fh = fr.height;
      const count =
        BURST.countMin +
        Math.floor(Math.random() * (BURST.countMax - BURST.countMin + 1));
      for (let i = 0; i < count; i++) {
        const p = archPoint();
        burstLeaves.push({
          x: fx + fw * p.u,
          y: fy + fh * p.v,
          // a gentle drift off the edge (outward), plus a touch of noise —
          // kept small so leaves stay hugging the silhouette, not flying away.
          vx:
            p.out * BURST.scatter * (0.4 + Math.random() * 0.6) +
            (Math.random() - 0.5) * 2 * BURST.noise,
          vy: BURST.vy0Min + Math.random() * (BURST.vy0Max - BURST.vy0Min),
          delay: Math.random() * BURST.delayMax,
          phase: Math.random() * Math.PI * 2,
          spin: BURST.spinMin + Math.random() * (BURST.spinMax - BURST.spinMin),
          size:
            LEAVES.size *
            (BURST.sizeMin + Math.random() * (BURST.sizeMax - BURST.sizeMin)),
          alpha:
            BURST.alphaMin + Math.random() * (BURST.alphaMax - BURST.alphaMin),
          moss: Math.random() > 0.5,
        });
      }
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
      if (burstCtx) burstCtx.clearRect(0, 0, W, H);

      // Parallax: desktop only. On phones the arch + portrait stay anchored
      // (the offsets default to 0 in CSS), so just keep them pinned at zero.
      if (phone.matches) {
        setParallax(0, 0, 0);
      } else {
        const parallaxEase = 1 - Math.exp(-dt * PARALLAX.smooth);
        parallaxX += (targetParallaxX - parallaxX) * parallaxEase;
        parallaxY += (targetParallaxY - parallaxY) * parallaxEase;
        // Scroll progress straight from the live rect (canvas spans the
        // section): -1 entering from the bottom, 0 centered, +1 leaving the
        // top. No easing — the rect already tracks the real scroll smoothly.
        const vh = window.innerHeight || 1;
        const center = rect.top + rect.height / 2;
        const scrollProg = Math.max(
          -1,
          Math.min(1, (vh / 2 - center) / ((vh + rect.height) / 2)),
        );
        setParallax(parallaxX, parallaxY, scrollProg);
      }

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
        drawLeaf(ctx, leaf, t);
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

      // Click burst — front canvas. Each leaf waits out its detach delay, then
      // falls with a little gravity while its sideways kick eases off. Iterated
      // back-to-front so spent leaves can splice out without skipping any.
      if (burstCtx) {
        for (let i = burstLeaves.length - 1; i >= 0; i--) {
          const b = burstLeaves[i];
          if (b.delay > 0) {
            b.delay -= dt;
            continue; // still attached — not drawn yet
          }
          b.vy = Math.min(b.vy + BURST.gravity * dt, BURST.vyMax);
          b.y += b.vy * dt;
          b.x += b.vx * dt;
          b.vx *= Math.max(0, 1 - BURST.drag * dt);
          if (b.y > H + 20) {
            burstLeaves.splice(i, 1);
            continue;
          }
          drawLeaf(burstCtx, b, t);
        }
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
    // Click the bush → an elegant little nudge + leaves shake loose. The nudge
    // is a one-shot CSS animation (class re-armed each press with a reflow);
    // animationend strips the class so it can replay. On phones the click only
    // counts on Juliana's portrait — taps on the foliage are ignored.
    const playNudge = () => {
      if (!figure) return;
      figure.classList.remove(styles.nudge);
      void figure.offsetWidth; // restart the animation on rapid re-taps
      figure.classList.add(styles.nudge);
    };
    const onNudgeEnd = (ev: AnimationEvent) => {
      if (ev.target === figure) figure?.classList.remove(styles.nudge);
    };
    const onShake = (ev: PointerEvent) => {
      if (phone.matches) {
        const target = ev.target as Node | null;
        if (!portrait || !target || !portrait.contains(target)) return;
      }
      playNudge();
      spawnBurst();
    };
    figure?.addEventListener("pointerdown", onShake);
    figure?.addEventListener("animationend", onNudgeEnd);
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
          setParallax(0, 0, 0);
          // Drop any in-flight burst so it doesn't freeze mid-air off-screen.
          burstLeaves.length = 0;
          burstCtx?.clearRect(0, 0, W, H);
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
      figure?.removeEventListener("pointerdown", onShake);
      figure?.removeEventListener("animationend", onNudgeEnd);
      cancelAnimationFrame(raf);
      setParallax(0, 0, 0);
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
        <>
          <canvas className={styles.dust} ref={canvasRef} aria-hidden="true" />
          <canvas
            className={styles.burst}
            ref={burstCanvasRef}
            aria-hidden="true"
          />
        </>
      )}
      <div className={styles.inner}>
        <span className={styles.kicker}>a pessoa por trás do método</span>
        <h2 className={styles.heading} id="about-title">
          Oi, eu sou
          <span className={styles.headingTail}>
            a <em>Juliana.</em>
          </span>
        </h2>
        <div className={styles.prose}>
          <div className={styles.figure} ref={figureRef}>
            {/* lazy: this spread is sections below the fold, and its two
                heaviest files (~1.4 MB) used to download during boot, competing
                with the brain's assets. The preloader warms them right after
                the reveal, so by scroll-time they come straight from cache. */}
            <img
              className={styles.vines}
              src={VINES}
              alt=""
              aria-hidden="true"
              /* Dimensões intrínsecas — só o aspect ratio p/ reserva de layout
                 (CLS 0); o tamanho final continua 100% do CSS. */
              width={1024}
              height={1536}
              draggable={false}
              loading="lazy"
              decoding="async"
            />
            <div className={styles.portrait} ref={portraitRef}>
              <img
                src={PORTRAIT}
                alt="Juliana Delmonte, nutricionista, sorrindo"
                width={1023}
                height={1538}
                draggable={false}
                loading="lazy"
                decoding="async"
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
            {/* &nbsp; antes de cada ·: o separador gruda na palavra anterior,
                então numa quebra ele fecha a linha em vez de abrir a seguinte
                (a linha quebra em duas no celular e no desktop). */}
            CRN-9 38277&nbsp;· Pós em Nutrição Comportamental&nbsp;· Neuroterapeuta
          </p>
        </div>
      </div>
    </section>
  );
}

export default AboutSection;
