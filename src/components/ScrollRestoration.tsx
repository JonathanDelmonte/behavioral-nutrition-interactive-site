"use client";

import { useEffect } from "react";
import { whenAppReady } from "./Preloader/preloadSignal";

/**
 * Reliable, per-URL scroll restoration for reloads.
 *
 * This landing page is a tall scroll experience: the brain descends and the
 * fruit fly off as you scroll into the Identify track. The browser's NATIVE
 * restoration (racing with React hydration / the App Router's scroll handling)
 * was intermittently landing the scroll SHORT of where the user actually was on
 * reload — so the brain came back caught mid-descent with the fruit frozen
 * mid-flight, scattered around it (the "fruit voltaram" bug). The progress was
 * faithfully reflecting a wrong scroll position; no progress/arrival tweak could
 * fix that, because the scroll itself was wrong.
 *
 * So we take restoration over ourselves: persist the scroll offset per pathname
 * and re-assert it across the first frames after load (beating any late reflow
 * or framework scroll-reset). Reloading deep in the section now returns you
 * exactly there — brain parked, fruit gone.
 */
export function ScrollRestoration() {
  useEffect(() => {
    const KEY = `brain:scrollY:${window.location.pathname}`;

    const prev = history.scrollRestoration;
    try {
      // Opt out of the browser's (racy) native restoration; we drive it.
      history.scrollRestoration = "manual";
    } catch {
      /* very old browsers: keep native restoration */
    }

    const saved = Number.parseInt(sessionStorage.getItem(KEY) ?? "", 10);
    // `restoring` stays true only while we're actively re-asserting the saved
    // offset right after load; it flips off on the first real user input (or
    // after the re-assert window) so we never fight the user's own scrolling.
    let restoring = Number.isFinite(saved) && saved > 0;

    if (restoring) {
      // Wait for the boot preloader to lift its scroll lock before re-asserting:
      // while the loading screen is up the page is pinned at the top, so any
      // restore now would just be clamped to 0. Once it hands off we re-assert
      // onto the unlocked, settled page — so a reload deep in the page still
      // returns you exactly there, after the loading screen, not at the top.
      whenAppReady(() => {
        let frame = 0;
        const reassert = () => {
          if (!restoring) return;
          window.scrollTo(0, saved);
          // ~12 frames covers hydration + a late font/image reflow; a router
          // scroll-reset to the top is overridden on the very next frame.
          if (++frame < 12) requestAnimationFrame(reassert);
          else restoring = false;
        };
        reassert();
        // The load event can land after our rAF window — re-assert once more.
        window.addEventListener("load", () => window.scrollTo(0, saved), {
          once: true,
        });
        // Real user input means "they're driving now" — stop forcing the restore.
        const release = () => {
          restoring = false;
        };
        window.addEventListener("wheel", release, { passive: true, once: true });
        window.addEventListener("touchmove", release, { passive: true, once: true });
        window.addEventListener("keydown", release, { once: true });
      });
    }

    // Persist the live scroll offset (one write per frame at most), but not
    // while we're still re-asserting the restore (so we don't clobber the
    // target with an in-flight intermediate value).
    let raf: number | null = null;
    const onScroll = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (restoring) return;
        try {
          sessionStorage.setItem(KEY, String(Math.round(window.scrollY)));
        } catch {
          /* sessionStorage unavailable (private mode quota) — ignore */
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
      try {
        history.scrollRestoration = prev;
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}

export default ScrollRestoration;
