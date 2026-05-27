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

// Montserrat (Julieta Ulanovsky, OFL) — geometric sans serif. After a
// detour through DM Sans, we returned to Montserrat for its more
// elegant, editorial silhouette. To dodge the "AI-default" feel that
// stock Montserrat at weight 300/400 carries, the CSS below uses 500
// (medium) as the new "regular" anywhere small text appears (lead,
// role, rail, scroll hint, CTAs). Headlines stay on Playfair Display.
//
// Shipping the VARIABLE font (single .woff2 covers weights 100-900)
// keeps the download to one ~38 KB file regardless of how many weights
// we touch.
export const fontSans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: "../../public/fonts/montserrat-variable-latin.woff2",
  weight: "100 900",
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

// Allura — calligraphic script with visible thin/thick stroke contrast
// (closest free analog to the paid Angeletta the user referenced). Elegant
// italic, looped J, swashed D. Used by the brandmark only. Same-idiom
// alternatives if a future design wants a different feel: Great Vibes
// (rounder, wedding-script), Yellowtail (uniform brush, retro), Tangerine,
// Petit Formal Script.
export const fontScript = localFont({
  variable: "--font-script",
  display: "swap",
  src: "../../public/fonts/allura-400-latin.woff2",
});
