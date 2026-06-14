"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import styles from "./Method.module.css";
import { CycleIcon, LensIcon, SproutIcon } from "./icons";

interface Principle {
  num: string;
  side: "right" | "left";
  /** Vertical anchor (% of the path height) — matches its dot on the thread. */
  top: string;
  /** Draw-progress (0–1) at which this node's dot is reached on the thread. */
  at: number;
  Icon: (props: { className?: string }) => ReactNode;
  title: ReactNode;
  body: string;
}

const PRINCIPLES: Principle[] = [
  {
    num: "01",
    side: "right",
    top: "18.5%",
    at: 0.2,
    Icon: LensIcon,
    title: (
      <>
        Investigação, <em>não restrição</em>
      </>
    ),
    body: "A gente começa pelos seus gatilhos e pela sua história com a comida. A causa, não o sintoma.",
  },
  {
    num: "02",
    side: "left",
    top: "50%",
    at: 0.5,
    Icon: CycleIcon,
    title: (
      <>
        Comportamento, <em>não cardápio</em>
      </>
    ),
    body: "O trabalho é na sua relação com o comer, não em mais uma lista de proibições.",
  },
  {
    num: "03",
    side: "right",
    top: "81.5%",
    at: 0.8,
    Icon: SproutIcon,
    title: (
      <>
        No seu tempo, <em>pra durar</em>
      </>
    ),
    body: "Passos pequenos e sustentáveis, que ficam de pé quando a motivação vai embora.",
  },
];

const DOTS = [
  { cx: 560, cy: 200, at: 0.2 },
  { cx: 440, cy: 540, at: 0.5 },
  { cx: 560, cy: 880, at: 0.8 },
];

const SAMPLES = 240;
const WIND = {
  radius: 120, // px around the cursor that bends sprigs
  maxLean: 12, // deg
  follow: 0.12, // lerp per frame
};

const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Sprig {
  /** CSS left/top on the .path container. */
  left: string;
  top: string;
  /** Position as fractions, for the wind math. */
  fx: number | null; // fraction of width (desktop) — null = fixed px (mobile)
  px: number; // fixed left px (mobile spine)
  fy: number;
  width: number;
  at: number; // draw progress at which it sprouts
  delay: number;
  kind: 0 | 1;
  tone: string;
}

const TONES = ["#A8B89A", "#2E6B47", "#C9A35F"];

function buildSprigs(
  mobile: boolean,
  pts: { x: number; y: number }[] | null,
): Sprig[] {
  const n = mobile ? 10 : 18;
  return Array.from({ length: n }, (_, i) => {
    const t = 0.05 + (i / (n - 1)) * 0.9 + (prand(i, 31) - 0.5) * 0.035;
    const tone = TONES[prand(i, 32) > 0.86 ? 2 : prand(i, 33) > 0.5 ? 1 : 0];
    const base: Omit<Sprig, "left" | "top" | "fx" | "px" | "fy"> = {
      width: 15 + prand(i, 34) * 11,
      at: Math.max(0.02, Math.min(0.97, t)),
      delay: prand(i, 35) * 0.18,
      kind: prand(i, 36) > 0.5 ? 1 : 0,
      tone,
    };
    if (mobile || !pts) {
      const fy = 0.06 + (i / (n - 1)) * 0.86 + (prand(i, 31) - 0.5) * 0.03;
      return { ...base, left: "25px", top: `${(fy * 100).toFixed(2)}%`, fx: null, px: 25, fy };
    }
    const pt = pts[Math.round(base.at * (SAMPLES - 1))];
    const fx = pt.x / 1000;
    const fy = pt.y / 1080;
    return {
      ...base,
      left: `${(fx * 100).toFixed(2)}%`,
      top: `${(fy * 100).toFixed(2)}%`,
      fx,
      px: 0,
      fy,
    };
  });
}

/** Tiny thin-line growth glyphs (same idiom as the principle icons). */
function SprigGlyph({ kind, tone }: { kind: 0 | 1; tone: string }) {
  return (
    <svg viewBox="0 0 24 26" stroke={tone} aria-hidden="true">
      {kind === 0 ? (
        <g className={styles.sgrow}>
          <path d="M12 26 C12 18 10 14 7 9" />
          <path d="M12 26 C12 17 13 12 16 6" />
          <path d="M12 26 C12 20 15 17 18 14" />
        </g>
      ) : (
        <g className={styles.sgrow}>
          <path d="M12 26 V10" />
          <path d="M12 17 C8.6 16.2 7 13.2 7 10.4 C10 10.9 12 13.2 12 17 Z" />
          <path d="M12 14 C14.8 13.2 16.4 10.8 16.4 8.2 C13.7 8.8 12 11 12 14 Z" />
        </g>
      )}
    </svg>
  );
}

/**
 * The principles as a germinating path.
 *
 * One continuous IO-gated rAF drives EVERYTHING from a single clock (--draw):
 * the thread reveal (stroke-dashoffset), the seed glow riding the tip
 * (getPointAtLength lookup), each node's birth when the tip reaches its dot
 * (data-in via dataset — survives re-renders), the planting ring, and the
 * sprigs left growing behind the tip. Sprigs lean away from the cursor
 * (--lean, spring-lerped). Default CSS (no .enhanced) = no-JS /
 * reduced-motion: path drawn, everything visible. NO Framer/GSAP.
 */
export function Principles() {
  const ref = useRef<HTMLDivElement>(null);
  const threadRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGGElement>(null);
  const ptsRef = useRef<{ x: number; y: number }[] | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, has: false });

  const [layout, setLayout] = useState<{
    mobile: boolean;
    sprigs: Sprig[];
  } | null>(null);

  /* Measure the thread + build the sprig field (client-only geometry). */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mql = window.matchMedia("(max-width: 760px)");
    const compute = () => {
      const mobile = mql.matches;
      let pts: { x: number; y: number }[] | null = null;
      const thread = threadRef.current;
      if (!mobile && thread) {
        const L = thread.getTotalLength();
        pts = Array.from({ length: SAMPLES }, (_, i) =>
          thread.getPointAtLength((i / (SAMPLES - 1)) * L),
        ).map((p) => ({ x: p.x, y: p.y }));
      }
      ptsRef.current = pts;
      setLayout({ mobile, sprigs: buildSprigs(mobile, pts) });
    };
    compute();
    mql.addEventListener("change", compute);
    return () => mql.removeEventListener("change", compute);
  }, []);

  /* The single clock: draw progress, seed tip, births, growth, wind. */
  useEffect(() => {
    if (!layout) return;
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;

    const nodeEls = Array.from(
      el.querySelectorAll<HTMLElement>(`.${styles.node}`),
    );
    const ringEls = Array.from(
      el.querySelectorAll<SVGCircleElement>(`.${styles.ring}`),
    );
    const sprigEls = Array.from(
      el.querySelectorAll<HTMLElement>(`.${styles.sprig}`),
    );
    const leans = new Float32Array(sprigEls.length);

    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.has = true;
    };

    let raf = 0;
    let running = false;

    const frame = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // The tip rides a FOCUS LINE at 62% of the viewport: drawing only
      // starts once the path top reaches it, and the seed then descends WITH
      // the user, always mid-screen — never at the bottom edge.
      const p =
        rect.height > 0
          ? Math.max(0, Math.min(1, (vh * 0.62 - rect.top) / rect.height))
          : 0;
      el.style.setProperty("--draw", p.toFixed(4));

      // the seed rides the tip (desktop winding thread only)
      const tip = tipRef.current;
      const pts = ptsRef.current;
      if (tip && pts) {
        const pt = pts[Math.round(p * (SAMPLES - 1))];
        tip.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        tip.style.opacity = p > 0.004 ? "1" : "0";
      }

      // births + planting rings, keyed to the tip — REVERSIBLE: scrolling
      // back up, the seed re-passes a dot and its node fades back into the
      // path (small hysteresis so the boundary never flickers)
      const HYST = 0.015;
      for (let i = 0; i < PRINCIPLES.length; i++) {
        const at = PRINCIPLES[i].at;
        const nodeEl = nodeEls[i];
        if (!nodeEl) continue;
        if (p >= at) {
          if (!nodeEl.dataset.in) {
            nodeEl.dataset.in = "1";
            ringEls[i]?.setAttribute("data-lit", "");
          }
        } else if (p < at - HYST && nodeEl.dataset.in) {
          delete nodeEl.dataset.in;
          ringEls[i]?.removeAttribute("data-lit"); // re-plants on return
        }
      }

      // sprigs sprout behind the tip… and retract when the line un-draws
      for (let i = 0; i < sprigEls.length; i++) {
        const s = layout.sprigs[i];
        if (!s) continue;
        if (p >= s.at) {
          if (!sprigEls[i].dataset.grown) sprigEls[i].dataset.grown = "1";
        } else if (p < s.at - 0.01 && sprigEls[i].dataset.grown) {
          delete sprigEls[i].dataset.grown;
        }
      }

      // …and lean away from the cursor (desktop, fine pointers)
      if (fine && pointerRef.current.has) {
        const mx = pointerRef.current.x - rect.left;
        const my = pointerRef.current.y - rect.top;
        for (let i = 0; i < sprigEls.length; i++) {
          const s = layout.sprigs[i];
          if (!s || !sprigEls[i].dataset.grown) continue;
          const sx = s.fx !== null ? s.fx * rect.width : s.px;
          const sy = s.fy * rect.height;
          const dx = sx - mx;
          const dy = sy - my;
          const d = Math.hypot(dx, dy);
          const target =
            d < WIND.radius
              ? (dx >= 0 ? 1 : -1) * (1 - d / WIND.radius) * WIND.maxLean
              : 0;
          const next = leans[i] + (target - leans[i]) * WIND.follow;
          if (Math.abs(next - leans[i]) > 0.01 || Math.abs(next) > 0.01) {
            leans[i] = next;
            sprigEls[i].style.setProperty("--lean", `${next.toFixed(2)}deg`);
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !running) {
          running = true;
          window.addEventListener("pointermove", onMove, { passive: true });
          raf = requestAnimationFrame(frame);
        } else if (!e.isIntersecting && running) {
          running = false;
          window.removeEventListener("pointermove", onMove);
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "15% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [layout]);

  return (
    <div
      className={`${styles.path} ${layout ? styles.enhanced : ""}`}
      ref={ref}
      data-method-path
    >
      {/* Desktop: a gently winding thread (in-flow — sets the container height). */}
      <svg
        className={styles.threadD}
        viewBox="0 0 1000 1080"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          className={styles.thread}
          ref={threadRef}
          pathLength={1}
          d="M500 30 C500 110 560 130 560 200 C560 320 440 360 440 540 C440 700 560 740 560 880 C560 975 500 1010 500 1078"
        />
        {DOTS.map((d) => (
          <g key={d.at}>
            <circle
              className={styles.dot}
              style={{ "--at": d.at } as CSSProperties}
              cx={d.cx}
              cy={d.cy}
              r="6.5"
            />
            <circle className={styles.ring} cx={d.cx} cy={d.cy} r="7" />
          </g>
        ))}
        <g className={styles.tip} ref={tipRef} transform="translate(500 30)">
          <circle className={styles.tipHalo2} r="19" />
          <circle className={styles.tipHalo} r="10" />
          <circle className={styles.tipCore} r="3.4" />
        </g>
      </svg>

      {/* Mobile: a straight left spine + a DOM seed riding --draw. */}
      <svg
        className={styles.threadM}
        viewBox="0 0 20 1000"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path className={styles.thread} pathLength={1} d="M10 0 V1000" />
      </svg>
      {layout?.mobile && <div className={styles.tipM} aria-hidden="true" />}

      {/* Growth left behind by the seed. */}
      {layout && (
        <div className={styles.sprigs} aria-hidden="true">
          {layout.sprigs.map((s, i) => (
            <span
              key={i}
              className={styles.sprig}
              style={
                {
                  left: s.left,
                  top: s.top,
                  width: `${s.width}px`,
                  "--d": `${s.delay.toFixed(2)}s`,
                } as CSSProperties
              }
            >
              <SprigGlyph kind={s.kind} tone={s.tone} />
            </span>
          ))}
        </div>
      )}

      {PRINCIPLES.map(({ num, side, top, Icon, title, body }) => (
        <div
          key={num}
          className={`${styles.node} ${styles[side]}`}
          style={{ top }}
        >
          <span className={styles.pnum} aria-hidden="true">
            {num}
          </span>
          <span className={styles.picon} aria-hidden="true">
            <Icon />
          </span>
          <h3 className={styles.ptitle}>{title}</h3>
          <p className={styles.pbody}>{body}</p>
        </div>
      ))}
    </div>
  );
}

export default Principles;
