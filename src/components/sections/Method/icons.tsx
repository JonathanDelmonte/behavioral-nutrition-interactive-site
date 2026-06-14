import type { SVGProps } from "react";

/**
 * Hand-drawn thin-line glyphs for the three principles (stroke = currentColor).
 *
 * Deliberately a tiny custom set instead of an icon library: a generic
 * Phosphor/Lucide trio would read as templated ("AI default"), while these few
 * strokes sit closer to the site's botanical, crafted feel. Three simple,
 * geometric marks — the one case the design-taste skill allows hand-rolled SVG.
 */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** 01 — Investigation: a magnifier (look at the cause, not the symptom). */
export function LensIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...stroke} {...props}>
      <circle cx="13.5" cy="13.5" r="8" pathLength={1} />
      <line x1="19.5" y1="19.5" x2="27" y2="27" pathLength={1} />
    </svg>
  );
}

/** 02 — Behavior: a habit loop (the pattern, not the menu). */
export function CycleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...stroke} {...props}>
      <path d="M25 16a9 9 0 1 1-2.4-6.1" pathLength={1} />
      <polyline points="22.9 4.6 22.9 10 17.5 10" pathLength={1} />
      <circle cx="16" cy="16" r="2.1" pathLength={1} />
    </svg>
  );
}

/** 03 — Lasting: a sprout (echoes the green seed kept on the brand's brain). */
export function SproutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...stroke} {...props}>
      <path d="M16 27v-9" pathLength={1} />
      <path d="M16 18.5c0-4-3.1-6.6-7-6.6 0 4 3 6.6 7 6.6z" pathLength={1} />
      <path d="M16 20.5c0-3.4 2.8-5.7 6.1-5.7 0 3.4-2.7 5.7-6.1 5.7z" pathLength={1} />
    </svg>
  );
}
