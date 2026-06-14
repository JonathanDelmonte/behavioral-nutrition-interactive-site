"use client";

import { useEffect, useRef, useState } from "react";
import { MODEL_PATH, HDRI_PATH } from "@/components/BrainModel/constants";
import { markAppReady } from "./preloadSignal";
import styles from "./SitePreloader.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const LOGO_SRC = `${BASE_PATH}/images/hero/logo.webp`;

/**
 * The heavy first-screen assets the loading screen waits on (the client's pick):
 * the 3D brain mesh, its HDRI lighting, the logo, and the Hero→Identify vine
 * seam. Everything below the fold (the About photos/video, etc.) is intentionally
 * NOT here — it streams in as the visitor scrolls, so it never lengthens the boot.
 */
const ASSETS = [
  MODEL_PATH,
  HDRI_PATH,
  LOGO_SRC,
  `${BASE_PATH}/images/hero/vine-divider.webp`,
];

const MIN_VISIBLE_MS = 600; // don't flash when assets are already cached
const GRACE_AFTER_BYTES = 1200; // reveal even if brain:ready somehow never fires
const HARD_CAP_MS = 9000; // never trap the visitor, even on a failed asset

/**
 * Streams `urls`, reporting overall 0..1 progress by bytes — falling back to a
 * per-file fraction when a server omits Content-Length. A failed fetch counts as
 * complete so one bad asset can't stall the bar; the brain:ready / cap gates
 * still protect the actual reveal.
 */
async function loadWithProgress(urls: string[], onProgress: (p: number) => void) {
  const loaded = new Array(urls.length).fill(0);
  const totals = new Array(urls.length).fill(0);
  let completed = 0;

  const report = () => {
    const grand = totals.reduce((a, b) => a + b, 0);
    const sum = loaded.reduce((a, b) => a + b, 0);
    onProgress(grand > 0 ? Math.min(1, sum / grand) : completed / urls.length);
  };

  await Promise.all(
    urls.map(async (url, i) => {
      try {
        const res = await fetch(url);
        totals[i] = Number(res.headers.get("content-length")) || 0;
        if (res.body) {
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            loaded[i] += value.length;
            report();
          }
        }
        loaded[i] = Math.max(loaded[i], totals[i]);
      } catch {
        /* network/404 — the brain:ready / cap gates handle the real readiness */
      } finally {
        completed += 1;
        report();
      }
    }),
  );
  onProgress(1);
}

export function SitePreloader() {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(true);

  // The scroll lock is a server-rendered <style>, so it applies from first paint
  // (before hydration). It lifts the instant we start leaving, so the saved
  // scroll position can be re-asserted onto the unlocked page.
  const locked = mounted && !leaving;

  // Readiness gate plumbing (refs so the shared `finish` always reads fresh).
  const doneRef = useRef(false);
  const bytesDoneRef = useRef(false);
  const brainReadyRef = useRef(false);
  const minElapsedRef = useRef(false);
  const graceStartedRef = useRef(false);
  const graceElapsedRef = useRef(false);

  useEffect(() => {
    let graceTimer: number | undefined;

    const finish = () => {
      if (doneRef.current) return;
      if (!minElapsedRef.current || !bytesDoneRef.current) return;
      // Bytes are down; wait for the brain to actually paint (brain:ready) or a
      // short grace, so the Hero never reveals with a hole where the brain goes.
      if (!brainReadyRef.current && !graceElapsedRef.current) {
        if (!graceStartedRef.current) {
          graceStartedRef.current = true;
          graceTimer = window.setTimeout(() => {
            graceElapsedRef.current = true;
            finish();
          }, GRACE_AFTER_BYTES);
        }
        return;
      }
      doneRef.current = true;
      setLeaving(true);
    };

    const onBrainReady = () => {
      brainReadyRef.current = true;
      finish();
    };
    if ((window as unknown as { __brainReady?: boolean }).__brainReady) {
      brainReadyRef.current = true;
    }
    window.addEventListener("brain:ready", onBrainReady);

    const minTimer = window.setTimeout(() => {
      minElapsedRef.current = true;
      finish();
    }, MIN_VISIBLE_MS);

    const capTimer = window.setTimeout(() => {
      minElapsedRef.current = true;
      bytesDoneRef.current = true;
      brainReadyRef.current = true;
      finish();
    }, HARD_CAP_MS);

    loadWithProgress(ASSETS, setProgress).then(() => {
      bytesDoneRef.current = true;
      finish();
    });

    return () => {
      window.removeEventListener("brain:ready", onBrainReady);
      window.clearTimeout(minTimer);
      window.clearTimeout(capTimer);
      if (graceTimer != null) window.clearTimeout(graceTimer);
    };
  }, []);

  // Starting to leave: this render has dropped the scroll lock. Once it commits,
  // hand off so ScrollRestoration re-asserts the saved position. A fallback timer
  // unmounts even if the opacity transitionend somehow doesn't fire.
  useEffect(() => {
    if (!leaving) return;
    const raf = requestAnimationFrame(() => markAppReady());
    const fallback = window.setTimeout(() => setMounted(false), 900);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [leaving]);

  if (!mounted) return null;

  return (
    <>
      {locked && <style>{"html,body{overflow:hidden!important;}"}</style>}
      <div
        className={styles.overlay}
        data-leaving={leaving ? "true" : "false"}
        role="status"
        aria-live="polite"
        aria-label="Carregando o site"
        onTransitionEnd={(e) => {
          if (e.propertyName === "opacity" && leaving) setMounted(false);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logo} src={LOGO_SRC} alt="" aria-hidden="true" />
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </>
  );
}

export default SitePreloader;
