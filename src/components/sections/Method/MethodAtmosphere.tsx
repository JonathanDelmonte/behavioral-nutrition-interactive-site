"use client";

import { useEffect, useRef } from "react";
import styles from "./Method.module.css";

/**
 * The sticky sky Section 3 scrolls over, now the section's single CLOCK plus
 * its night life:
 *
 * - One IO-gated rAF computes `p` from the section's position and writes
 *   `--dawn` (0 → 1.45). 1.0 = the S2/S3 boundary reaches the viewport top;
 *   the light mask (see Method.module.css) only floods the sky top past
 *   ~1.05, so the boundary never shows a green-vs-light seam. Threshold
 *   classes are added one-way: `.struck` (the headline's strike draws) at
 *   0.78, `.daylit` (the gold phrase catches first sun) at 1.25.
 * - FIREFLIES wander the night band on a canvas: deterministic drift, gentle
 *   pointer repulsion, and each goes out at its own dawn threshold (scroll
 *   back up and they return — pure functions of `p`). The LAST one, instead
 *   of dying, flies down and LANDS where the principles' path begins; its
 *   glow holds there until the path's own seed tip takes over (`--draw` > 0
 *   on `[data-method-path]`).
 *
 * prefers-reduced-motion: no `.enh`, no canvas, CSS defaults show the full
 * morning. NO Framer/GSAP.
 */

const DAWN_MAX = 1.45;
const STRIKE_AT = 0.78;
const DAYLIT_AT = 1.25;

const FLY = {
  count: 10,
  countSmall: 6,
  repelRadius: 150,
  repel: 200, // px/s² at zero distance
  settle: 1.1, // /s
  dieFrom: 0.5, // dawn range over which the swarm goes out
  dieTo: 1.0,
  dieSpan: 0.07,
  landFrom: 0.98, // the last firefly's glide to the path start
  landTo: 1.16,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const fract = (x: number) => x - Math.floor(x);
// Low-discrepancy step: fract(i * GOLDEN) spreads evenly for ANY count, so the
// vertical scatter and die-order don't depend on N being coprime with anything.
const GOLDEN = 0.6180339887;
const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Fly = {
  ax: number; ay: number; // anchor, as fractions of the sky
  w: number[]; ph: number[]; // wander freqs (rad/s) + phases
  ox: number; oy: number; vox: number; voy: number; // pointer displacement
  gFreq: number; gPhase: number; // glow pulse
  dieAt: number; // dawn at which it goes out (Infinity = the lander)
};

export function MethodAtmosphere() {
  const skyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sky = skyRef.current;
    const canvas = canvasRef.current;
    const section = sky?.closest("section");
    if (!sky || !canvas || !section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sec = section as HTMLElement;
    sec.classList.add(styles.enh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* Soft glow sprite, drawn once (shadowBlur per-fly would be slow). */
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const sctx = sprite.getContext("2d");
    if (sctx) {
      const g = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(238, 208, 148, 0.85)");
      g.addColorStop(0.35, "rgba(201, 163, 95, 0.28)");
      g.addColorStop(1, "rgba(201, 163, 95, 0)");
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 64, 64);
    }

    const small =
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 761;
    const N = small ? FLY.countSmall : FLY.count;
    const flies: Fly[] = Array.from({ length: N }, (_, i) => ({
      // STRATIFIED across the full width — one jittered firefly per column — so
      // the left band is always populated, not just the right; y rides a
      // golden-ratio sequence so several sit high while others stay low.
      ax: 0.06 + ((i + prand(i, 1)) / N) * 0.88,
      ay: 0.05 + fract(0.5 + i * GOLDEN + prand(i, 2) * 0.06) * 0.57,
      w: [0.13, 0.21, 0.17, 0.27].map((b, k) => b + prand(i, 3 + k) * 0.12),
      ph: [0, 1, 2, 3].map((k) => prand(i, 7 + k) * Math.PI * 2),
      ox: 0, oy: 0, vox: 0, voy: 0,
      gFreq: (Math.PI * 2) / (1.7 + prand(i, 11) * 1.6),
      gPhase: prand(i, 12) * Math.PI * 2,
      // die-order scattered (not a left-to-right wipe, since ax is index-ordered)
      // yet still evenly spread across the dawn window.
      dieAt:
        i === N - 1
          ? Infinity // the lander
          : FLY.dieFrom + fract(i * GOLDEN + 0.5) * (FLY.dieTo - FLY.dieFrom),
    }));

    let W = 0;
    let H = 0;
    const size = () => {
      const r = sky.getBoundingClientRect();
      W = r.width;
      H = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(sky);

    const pointer = { x: 0, y: 0, has: false };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.has = true;
    };

    let pathEl: HTMLElement | null = null;
    let struck = false;
    let daylit = false;
    let raf = 0;
    let running = false;
    let last = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const rect = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      const p =
        vh > 0 ? Math.max(0, Math.min(DAWN_MAX, (vh - rect.top) / vh)) : 0;
      sec.style.setProperty("--dawn", p.toFixed(4));
      if (!struck && p >= STRIKE_AT) {
        struck = true;
        sec.classList.add(styles.struck);
      }
      if (!daylit && p >= DAYLIT_AT) {
        daylit = true;
        sec.classList.add(styles.daylit);
      }

      const skyRect = sky.getBoundingClientRect();
      ctx.clearRect(0, 0, W, H);

      if (!pathEl) {
        pathEl = document.querySelector<HTMLElement>("[data-method-path]");
      }
      const drawVar = pathEl
        ? parseFloat(pathEl.style.getPropertyValue("--draw")) || 0
        : 0;

      for (let i = 0; i < flies.length; i++) {
        const f = flies[i];
        const lander = f.dieAt === Infinity;

        // presence: normals fade out at their own dawn; the lander persists
        // until the path's seed tip takes over.
        let alpha = 1;
        if (!lander) {
          alpha = p < f.dieAt ? 1 : Math.max(0, 1 - (p - f.dieAt) / FLY.dieSpan);
          if (alpha <= 0) continue;
        } else if (drawVar > 0.02) {
          continue; // the path's seed tip has taken over (even mid-glide)
        }

        // wander around the anchor
        let x =
          f.ax * W +
          Math.sin(t * f.w[0] + f.ph[0]) * 56 +
          Math.sin(t * f.w[1] + f.ph[1]) * 22;
        let y =
          f.ay * H +
          Math.cos(t * f.w[2] + f.ph[2]) * 34 +
          Math.sin(t * f.w[3] + f.ph[3]) * 14;

        // gentle pointer shyness
        if (pointer.has) {
          const dx = x - (pointer.x - skyRect.left);
          const dy = y - (pointer.y - skyRect.top);
          const d = Math.hypot(dx, dy);
          if (d < FLY.repelRadius && d > 0.5) {
            const fo = FLY.repel * (1 - d / FLY.repelRadius);
            f.vox += (dx / d) * fo * dt;
            f.voy += (dy / d) * fo * dt;
          }
        }
        f.ox += f.vox * dt;
        f.oy += f.voy * dt;
        const k = Math.max(0, 1 - FLY.settle * dt);
        f.vox *= k;
        f.voy *= k;
        f.ox *= k;
        f.oy *= k;
        x += f.ox;
        y += f.oy;

        // the lander glides to the path start as day breaks
        if (lander && p > FLY.landFrom && pathEl) {
          const pr = pathEl.getBoundingClientRect();
          const mobilePath = getComputedStyle(pathEl).paddingLeft === "46px";
          const tx = mobilePath
            ? pr.left + 25 - skyRect.left
            : pr.left + pr.width * 0.5 - skyRect.left;
          const ty = pr.top + (mobilePath ? 0 : pr.height * (30 / 1080)) - skyRect.top;
          const u = easeInOut(
            Math.min(1, (p - FLY.landFrom) / (FLY.landTo - FLY.landFrom)),
          );
          x = lerp(x, tx, u);
          y = lerp(y, ty, u);
        }

        const pulse = 0.55 + 0.45 * Math.sin(t * f.gFreq + f.gPhase);
        const a = alpha * (0.45 + 0.55 * pulse);
        const s = 40 + pulse * 10;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        ctx.globalAlpha = Math.min(1, a + 0.15);
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + pulse * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = "#fff6dd";
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !running) {
          running = true;
          last = performance.now();
          window.addEventListener("pointermove", onMove, { passive: true });
          raf = requestAnimationFrame(frame);
        } else if (!e.isIntersecting && running) {
          running = false;
          window.removeEventListener("pointermove", onMove);
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "10% 0px" },
    );
    io.observe(sec);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.sky} ref={skyRef} aria-hidden="true">
      <div className={styles.dark} />
      <div className={styles.light} />
      <div className={styles.grain} />
      <canvas className={styles.fireflies} ref={canvasRef} />
    </div>
  );
}

export default MethodAtmosphere;
