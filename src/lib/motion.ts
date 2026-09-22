/**
 * Site-wide motion policy — the SINGLE source of truth for whether the page is
 * allowed to move.
 *
 * Why this module exists
 * ----------------------
 * Every section used to read `matchMedia("(prefers-reduced-motion: reduce)")`
 * on its own, and every stylesheet gated its enhanced layout behind
 * `@media (prefers-reduced-motion: no-preference)`. That made the OS setting a
 * master kill-switch — and on a machine with it enabled (Windows: Ease of
 * Access › Display › "Show animations in Windows" OFF; macOS: Accessibility ›
 * Display › Reduce motion) the site didn't degrade gracefully, it degraded into
 * something that reads as BROKEN:
 *
 *   - the brain never leaves the Hero (its Identify slot isn't registered), so
 *     the page-global canvas keeps a stale frame painted over whatever section
 *     you jump to from the ÍNDICE overlay;
 *   - Journey's 3D dive falls back to the stacked column, so the steps pile up
 *     on top of each other with no camera travel;
 *   - every section entrance, the testimonials pin and the Method growth sit
 *     still, because the reveal classes never get their transitions.
 *
 * The fallbacks were each reasonable in isolation. Together they add up to a
 * different site, and that is not what a visitor who merely turned off window
 * animations is asking for.
 *
 * The policy
 * ----------
 * Flip RESPECT_OS_REDUCED_MOTION to choose:
 *
 *   false (current)  the OS preference is IGNORED. Everyone gets the site as
 *                    designed. <html data-motion="full">.
 *   true             the OS preference is honored. <html data-motion="calm">,
 *                    which re-arms every `html[data-motion="calm"]` block in
 *                    the stylesheets, and every JS gate below reports reduced.
 *
 * Both paths are kept wired on purpose: the calm branch is still in the CSS
 * (re-gated from the media query onto the attribute), so flipping the constant
 * restores the accessible fallback in one edit instead of a rewrite.
 *
 * Every caller — JS and CSS — must go through here. Reading the raw media
 * query anywhere else re-creates the split-brain this module exists to remove.
 */

/** The OS-level media query. Only this module should name it. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Attribute mirrored onto <html> so plain CSS can join the decision the same
 *  way `data-gpu-tier` does (see BrainModel/index.tsx). */
export const MOTION_ATTR = "data-motion";

/**
 * Whether the site honors the operating system's reduced-motion preference.
 *
 * Kept false: this is a single-page site whose structure IS its motion (the
 * traveling brain, the dive, the pinned testimonials), and its animation
 * vocabulary is already deliberately calm — slow fades, short travels, no
 * strobing, no parallax spin. Honoring the flag here didn't produce a quieter
 * site, it produced a broken-looking one.
 */
export const RESPECT_OS_REDUCED_MOTION = false;

/**
 * The effective answer for every motion gate on the site.
 *
 * SSR-safe (returns false without a window), and short-circuits before
 * touching matchMedia when the policy is to ignore the preference — so the
 * call sites don't need to care which mode is active.
 */
export function prefersReducedMotion(): boolean {
  if (!RESPECT_OS_REDUCED_MOTION) return false;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Subscribe to the effective policy, for the handful of call sites that react
 * to it live (the brain's Identify slot, Journey's dive gate, Contact's fruit
 * field) rather than reading it once on mount.
 *
 * Calls back immediately with the current value, then on every change, and
 * returns an unsubscribe. When the policy ignores the OS there is nothing to
 * listen to, so it fires once and hands back a no-op teardown.
 */
export function watchReducedMotion(
  onChange: (reduced: boolean) => void,
): () => void {
  onChange(prefersReducedMotion());

  if (
    !RESPECT_OS_REDUCED_MOTION ||
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  const sync = () => onChange(prefersReducedMotion());
  mq.addEventListener("change", sync);
  return () => mq.removeEventListener("change", sync);
}

/**
 * Inline <script> that stamps <html data-motion> BEFORE first paint, so the
 * `html[data-motion="calm"]` rules in the stylesheets are already decided when
 * the first frame lands (no flash of the wrong mode).
 *
 * Under the current policy the attribute always resolves to "full" and no CSS
 * depends on it, so this is inert — it exists so that flipping
 * RESPECT_OS_REDUCED_MOTION actually carries to the stylesheets instead of
 * only to the JS half. The try/catch keeps a browser without matchMedia (or
 * with dataset locked down) from throwing before the page renders.
 */
export const MOTION_BOOT_SCRIPT =
  `try{document.documentElement.setAttribute("${MOTION_ATTR}",` +
  `(${String(RESPECT_OS_REDUCED_MOTION)}&&window.matchMedia&&` +
  `window.matchMedia("${REDUCED_MOTION_QUERY}").matches)?"calm":"full")}catch(e){}`;
