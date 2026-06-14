import type { SVGProps } from "react";

/**
 * Thin-line glyphs for the four steps of the journey (stroke = currentColor).
 * Same crafted idiom as Method/icons.tsx — a tiny custom set, not an icon
 * library. Every path carries pathLength={1} so the CSS can draw each stroke
 * with a stagger when its step comes into focus.
 */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Passo 1 — a primeira conversa: a cup of tea, still steaming. */
export function TeaGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...stroke} {...props}>
      <path pathLength={1} d="M8.5 14.5h11v3.6a5.5 5.5 0 0 1-11 0z" />
      <path pathLength={1} d="M19.5 15.6h1.5a2.4 2.4 0 0 1 0 4.8h-1.8" />
      <path pathLength={1} d="M9.5 26h9" />
      <path pathLength={1} d="M12.6 11.2c-.9-1.2.9-2 0-3.2" />
      <path pathLength={1} d="M16.6 11.2c-.9-1.2.9-2 0-3.2" />
    </svg>
  );
}

/** Passo 2 — o plano: a sheet with a leaf growing on it. */
export function PlanGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...stroke} {...props}>
      <path pathLength={1} d="M9 4.5h9.5L23 9v18.5H9z" />
      <path pathLength={1} d="M18.5 4.5V9H23" />
      <path pathLength={1} d="M12.5 13.5h7" />
      <path pathLength={1} d="M16 23.5c0-3-2.3-5-5.2-5 0 3 2.2 5 5.2 5z" />
      <path pathLength={1} d="M16 23.5c1.6-1.2 2.7-2.7 3.2-4.5" />
    </svg>
  );
}

/** Passo 3 — retornos: a rising path through visit-dots, arrow at the end. */
export function ReturnsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...stroke} {...props}>
      <path pathLength={1} d="M5.5 25.5c4.6-.8 5.6-4.6 8.1-6.8 2.4-2.1 4.8-2.4 6.7-4.6 1.6-1.8 2.3-3.9 2.5-6" />
      <path pathLength={1} d="M19.7 8.6l3.1-2.5 1.2 3.8" />
      <circle pathLength={1} cx="11.6" cy="20.4" r="1.6" />
      <circle pathLength={1} cx="17.9" cy="15" r="1.6" />
    </svg>
  );
}

/** Passo 4 — o resultado: a ripe fruit (echoes the fruit kept on the brain). */
export function FruitGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...stroke} {...props}>
      <path
        pathLength={1}
        d="M16 12.8c4.3 0 6.9 3.1 6.9 7 0 4.3-3 7.7-6.9 7.7s-6.9-3.4-6.9-7.7c0-3.9 2.6-7 6.9-7z"
      />
      <path pathLength={1} d="M16 12.8c0-2 .8-3.4 2.4-4.4" />
      <path pathLength={1} d="M18.4 8.4c1.7-1.9 4.2-2.4 6.2-1.5-.6 2.1-2.7 3.5-6.2 2.7" />
      <path pathLength={1} d="M8.6 6.5v3.4M6.9 8.2h3.4" />
    </svg>
  );
}
