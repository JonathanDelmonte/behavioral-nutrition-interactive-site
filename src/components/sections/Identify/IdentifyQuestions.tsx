"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Identify.module.css";

/**
 * Floating hand-drawn question marks — the doubts themselves, murmuring across
 * the WHOLE pinned stage while the thoughts cycle.
 *
 * Each mark is an elegant calligraphic "?" set in Allura (the brand's script
 * face — handwritten but refined) in tone-on-tone relief. The field is a GRID
 * of zones — one mark per cell — so coverage is guaranteed even (top, middle,
 * sides) and marks never clump in one corner. Within its cell each mark
 * jitters its position/size/tilt/timing every cycle, so the field still reads
 * as organic and random.
 *
 * Lifecycle is pure CSS (sprout → slow rise → dissolve, keyframe `qLife`); on
 * animationend JS re-rolls the mark inside its cell and replays — a fixed node
 * pool, zero allocation per cycle. Whole field pauses off-screen (IO). No-JS /
 * reduced-motion: nothing renders (pure ambience, nothing lost).
 */

const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Grid of zones sized to the viewport, so every region always holds a mark.
   Phones (≤760, the mobile layout) get a DENSER grid of tiny marks — salt
   scattered over the dark green — while desktop stays exactly as approved. */
function gridFor(w: number, h: number): { cols: number; rows: number } {
  if (w <= 760) return { cols: 3, rows: 6 };
  // Short desktop viewports (≤1100px tall — e.g. 1920×1080) get a DENSER grid of
  // smaller marks, so the field reads as finer "grain" instead of a few big marks
  // that look oversized when the section is height-compressed. Tall windows (the
  // author's ~1300px design height) keep the approved sparser grid, untouched.
  // It's denser than desktop but NOT as dense/tiny as the phone field above.
  const short = h <= 1100;
  if (w < 1040) return short ? { cols: 4, rows: 4 } : { cols: 3, rows: 3 };
  return short ? { cols: 5, rows: 4 } : { cols: 4, rows: 3 };
}

export function IdentifyQuestions() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<{ cols: number; rows: number } | null>(null);

  /* Decide the grid on mount + on real width changes (motion-gated). */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const apply = () => {
      const next = gridFor(window.innerWidth, window.innerHeight);
      setGrid((prev) =>
        prev && prev.cols === next.cols && prev.rows === next.rows
          ? prev
          : next,
      );
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  /* Wire the lifecycle once the grid (and thus the spans) exist. */
  useEffect(() => {
    const field = fieldRef.current;
    if (!field || !grid) return;
    field.classList.add(styles.qOn);

    const marks = Array.from(field.children) as HTMLElement[];
    const { cols, rows } = grid;
    const cw = 100 / cols;
    const ch = 100 / rows;
    // Phones get tiny, salt-like marks; desktop keeps the approved larger size.
    const phone = window.matchMedia("(max-width: 760px)").matches;
    const track = field.closest("[data-brain-track]");
    let seed = Math.floor(performance.now() % 997);

    // Exclusion zone: the thought bubble. Marks must never sit BEHIND the
    // translucent blob (it would muddy the text), only around it. We read the
    // active bubble's live rect (relative to the field) and treat it as an
    // ellipse with a small margin; a point inside is rejected.
    const bubbleEllipse = () => {
      const bubble =
        track?.querySelector("[data-bubbleshape][data-active]") ||
        track?.querySelector("[data-bubbleshape]");
      if (!bubble) return null;
      const fr = field.getBoundingClientRect();
      const br = bubble.getBoundingClientRect();
      if (br.width < 4 || br.height < 4) return null;
      const m = 14; // px breathing room around the blob
      return {
        fw: fr.width,
        fh: fr.height,
        cx: br.left + br.width / 2 - fr.left,
        cy: br.top + br.height / 2 - fr.top,
        rx: br.width / 2 + m,
        ry: br.height / 2 + m,
      };
    };
    const insideBubble = (
      px: number,
      py: number,
      z: ReturnType<typeof bubbleEllipse>,
    ) => {
      if (!z) return false;
      const dx = px - z.cx;
      const dy = py - z.cy;
      return (dx * dx) / (z.rx * z.rx) + (dy * dy) / (z.ry * z.ry) < 1;
    };

    const place = (el: HTMLElement, idx: number, first: boolean) => {
      seed++;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      // jitter WITHIN the cell (margins keep neighbours from colliding) —
      // guarantees one mark per zone => even full-screen coverage, always.
      // Re-roll a few times to dodge the bubble; if the whole cell is behind
      // it, the mark stays invisible this cycle (no "?" over the text).
      const z = bubbleEllipse();
      let x = 0;
      let y = 0;
      let blocked = true;
      for (let a = 0; a < 6; a++) {
        x = (col + 0.1 + prand(seed + a * 131, 1) * 0.8) * cw;
        y = (row + 0.1 + prand(seed + a * 131, 2) * 0.8) * ch;
        if (z && insideBubble((x / 100) * z.fw, (y / 100) * z.fh, z)) continue;
        blocked = false;
        break;
      }
      // px font-size (Italianno's glyph sits small in its em, so the visible
      // "?" is smaller than this). Phones: tiny + wide variation = grains of
      // salt scattered over the green. Desktop: the approved larger range, but
      // eased DOWN on short viewports by a height factor (1 on the author's tall
      // window, ~0.55 at 1920×1080) so the marks shrink with the section into a
      // finer grain — never as tiny as the phone field, per the brief.
      const hf = Math.max(0.55, Math.min(1, (window.innerHeight - 900) / 330));
      const size = phone
        ? 16 + prand(seed, 3) * 34
        : (52 + prand(seed, 3) * 86) * hf;
      const dur = 8 + prand(seed, 4) * 6; // s on screen
      const tilt = -12 + prand(seed, 5) * 24; // deg
      // peak opacity (subtle) — 0 hides a mark whose cell is fully behind the bubble
      const peak = blocked ? 0 : 0.14 + prand(seed, 6) * 0.16;
      const rise = 34 + prand(seed, 7) * 46; // px of upward drift
      el.style.left = `${x.toFixed(2)}%`;
      el.style.top = `${y.toFixed(2)}%`;
      el.style.fontSize = `${size.toFixed(0)}px`;
      el.style.rotate = `${tilt.toFixed(1)}deg`;
      el.style.setProperty("--qo", peak.toFixed(3));
      el.style.setProperty("--qrise", `${rise.toFixed(0)}px`);
      el.style.setProperty("--qd", `${dur.toFixed(2)}s`);
      // First round staggers across time so they don't all bloom together.
      el.style.setProperty(
        "--qdelay",
        first ? `${(prand(seed, 8) * 6).toFixed(2)}s` : "0s",
      );
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    };

    const handlers = marks.map((el, idx) => {
      const onEnd = () => place(el, idx, false);
      el.addEventListener("animationend", onEnd);
      place(el, idx, true);
      return onEnd;
    });

    // Continuous guard: marks DRIFT upward through their life, so one placed
    // just below the bubble can rise behind it. Each frame (only while the
    // section is on screen) we hide any mark whose glyph would touch the active
    // bubble — so nothing is ever read through the blob.
    //
    // Two subtleties this handles:
    //  - the blob's center is read from the STABLE .bubbles container and its
    //    size from the bubbleShape's offsetWidth/Height — both ignore the
    //    bubbleForm scale/translate, so the zone is full-size even during the
    //    ~1s a new thought is inflating (getBoundingClientRect would shrink it);
    //  - the ellipse is expanded by the mark's own half-size, so a big glyph
    //    whose CENTER is just outside still counts as overlapping.
    let raf = 0;
    let running = false;
    const guard = () => {
      const container = track?.querySelector("[data-bubbles]") as HTMLElement | null;
      const shape = container?.querySelector(
        "[data-bubbleshape][data-active]",
      ) as HTMLElement | null;
      if (container && shape && shape.offsetWidth > 4) {
        const cr = container.getBoundingClientRect();
        const cx = cr.left + cr.width / 2;
        const cy = cr.top + cr.height / 2;
        const rx = shape.offsetWidth / 2 + 6;
        const ry = shape.offsetHeight / 2 + 6;
        for (const el of marks) {
          const r = el.getBoundingClientRect();
          const dx = r.left + r.width / 2 - cx;
          const dy = r.top + r.height / 2 - cy;
          // expand the no-go ellipse by the glyph's (visible) half-extent
          const ex = rx + r.width * 0.4;
          const ey = ry + r.height * 0.4;
          // hide via VISIBILITY, not opacity: the qLife animation drives
          // opacity, and a running animation overrides inline opacity — so
          // setting opacity here would be silently ignored. visibility isn't
          // animated, so it reliably wins.
          el.style.visibility =
            (dx * dx) / (ex * ex) + (dy * dy) / (ey * ey) < 1 ? "hidden" : "";
        }
      } else {
        for (const el of marks) el.style.visibility = "";
      }
      raf = requestAnimationFrame(guard);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        field.classList.toggle(styles.qPaused, !e.isIntersecting);
        if (e.isIntersecting && !running) {
          running = true;
          raf = requestAnimationFrame(guard);
        } else if (!e.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "10% 0px" },
    );
    io.observe(field);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      marks.forEach((el, i) =>
        el.removeEventListener("animationend", handlers[i]),
      );
    };
  }, [grid]);

  const count = grid ? grid.cols * grid.rows : 0;

  return (
    <div className={styles.qfield} ref={fieldRef} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.qmark}>
          ?
        </span>
      ))}
    </div>
  );
}

export default IdentifyQuestions;
