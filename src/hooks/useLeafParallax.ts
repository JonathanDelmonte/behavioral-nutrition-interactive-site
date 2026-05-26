"use client";

import { useEffect } from "react";

/**
 * Subtle parallax for decorative elements.
 * Each target reads its own `--pf` (parallax factor) custom property
 * and receives `--px` / `--py` translations each animation frame.
 *
 * @param selector CSS selector for the elements to animate.
 *                 Defaults to `[data-leaf]` so any opt-in element participates.
 */
export function useLeafParallax(selector: string = "[data-leaf]") {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(selector);
    if (!targets.length) return;

    let mx = 0, my = 0, sy = 0;
    let tx = 0, ty = 0, tsy = 0;
    let frameId = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onMouseMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth  - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => {
      sy = window.scrollY;
    };

    const frame = () => {
      tx  = lerp(tx,  mx, 0.06);
      ty  = lerp(ty,  my, 0.06);
      tsy = lerp(tsy, sy, 0.10);

      targets.forEach((el) => {
        const pf = parseFloat(getComputedStyle(el).getPropertyValue("--pf")) || 0;
        const px = (tx * pf).toFixed(2);
        const py = (ty * pf * 0.7 - tsy * pf * 0.015).toFixed(2);
        el.style.setProperty("--px", `${px}px`);
        el.style.setProperty("--py", `${py}px`);
      });

      frameId = requestAnimationFrame(frame);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll",    onScroll,    { passive: true });
    frameId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll",    onScroll);
      cancelAnimationFrame(frameId);
    };
  }, [selector]);
}
