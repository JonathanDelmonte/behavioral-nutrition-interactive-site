import localFont from "next/font/local";

/**
 * Self-hosted webfonts via `next/font/local`.
 *
 * Why this file (and not a plain @font-face CSS):
 *   next/font automatically rewrites font URLs to respect the build's
 *   `basePath` / `assetPrefix`. Hand-written `url("/fonts/...")` in raw CSS
 *   does NOT — which broke production on GitHub Pages (where the app is
 *   served from `/behavioral-nutrition-interactive-site/`), making every
 *   .woff2 404 and the page fall back to the system serif.
 *
 * Charset:
 *   Only the `latin` subset is shipped — it covers U+0000-00FF which already
 *   includes every accented glyph PT-BR uses (á, é, í, ó, ú, â, ê, ô, ã, õ, ç).
 *   Cyrillic / vietnamese / latin-ext subsets are not loaded.
 *
 * Each export sets a `variable` (CSS custom property) — applied to <html> in
 * `layout.tsx` — so all of our component CSS can keep using `var(--font-*)`.
 */

export const fontSans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../../public/fonts/montserrat-300-latin.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/montserrat-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/montserrat-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/montserrat-600-latin.woff2", weight: "600", style: "normal" },
  ],
});

export const fontSerif = localFont({
  variable: "--font-serif",
  display: "swap",
  src: [
    { path: "../../public/fonts/playfair-display-400-latin.woff2",        weight: "400", style: "normal" },
    { path: "../../public/fonts/playfair-display-500-latin.woff2",        weight: "500", style: "normal" },
    { path: "../../public/fonts/playfair-display-600-latin.woff2",        weight: "600", style: "normal" },
    { path: "../../public/fonts/playfair-display-700-latin.woff2",        weight: "700", style: "normal" },
    { path: "../../public/fonts/playfair-display-400-italic-latin.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/playfair-display-500-italic-latin.woff2", weight: "500", style: "italic" },
    { path: "../../public/fonts/playfair-display-600-italic-latin.woff2", weight: "600", style: "italic" },
    { path: "../../public/fonts/playfair-display-700-italic-latin.woff2", weight: "700", style: "italic" },
  ],
});

// Pinyon Script — a 19th-century-style copperplate / engraver's script with
// ornate capitals (looped J, swashed D). Used by the brandmark only; if a
// future design wants a different feel, swap the .woff2 here (Allura, Great
// Vibes, Tangerine, and Italianno all live in the same family of formal
// scripts and would slot in identically).
export const fontScript = localFont({
  variable: "--font-script",
  display: "swap",
  src: "../../public/fonts/pinyon-script-400-latin.woff2",
});
