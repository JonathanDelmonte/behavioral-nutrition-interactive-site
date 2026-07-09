"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Focus management for the site's modal overlays (ÍNDICE, video viewer,
 * polaroid pile viewer). `role="dialog" aria-modal="true"` tells SCREEN
 * READERS to ignore the page behind, but the KEYBOARD doesn't obey aria —
 * without this, Tab kept wandering into the veiled page. The hook does the
 * three things the ARIA dialog pattern asks for:
 *
 *   1. On open, move focus INTO the dialog (the container itself, via
 *      tabIndex={-1} — announces the dialog's aria-label without favoring
 *      any control).
 *   2. Trap Tab / Shift+Tab in a cycle of the dialog's focusable elements
 *      PLUS the header's morphing X: all three overlays borrow the header
 *      hamburger as their close affordance (it sits OUTSIDE the dialog
 *      subtree, above the veil), so a strict subtree trap would make the
 *      only visible close control unreachable by keyboard. The header
 *      button is marked with data-overlay-close and cycles FIRST — open,
 *      press Tab, you're on "Fechar".
 *   3. On close, hand focus back to whatever had it before the dialog
 *      opened (the hamburger, or the tile that launched the viewer).
 *
 * `preventScroll` on every focus call so none of this ever fights the page's
 * own scroll choreography (the índice glide, the scrolljacked rail).
 * Esc handling stays with each overlay — it was already there.
 */

/** Anything natively tabbable. [tabindex="-1"] is excluded on purpose — the
 *  dialog container itself carries it, and it must not join the Tab cycle. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useDialogFocus<T extends HTMLElement>(
  active: boolean,
): RefObject<T> {
  // useRef<T>(null) (não <T | null>) → RefObject<T>, o que o prop `ref` do
  // DOM espera no @types/react 18.3 (mesma nota em BrainStageContext).
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const dialog = ref.current;
    if (!dialog) return;

    const previous = document.activeElement as HTMLElement | null;
    dialog.focus({ preventScroll: true });

    const focusables = (): HTMLElement[] => {
      const inDialog = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        // getClientRects (não offsetParent): os overlays são position:fixed,
        // onde offsetParent é null mesmo com o elemento visível.
      ).filter((el) => el.getClientRects().length > 0);
      const closeBtn = document.querySelector<HTMLElement>(
        "header [data-overlay-close]",
      );
      return closeBtn && closeBtn.getClientRects().length > 0
        ? [closeBtn, ...inDialog]
        : inDialog;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const idx = items.indexOf(document.activeElement as HTMLElement);
      // Fora da lista (ex.: foco ainda no container) → Tab entra no primeiro
      // item, Shift+Tab no último — nunca escapa para a página velada.
      const next = e.shiftKey
        ? items[idx <= 0 ? items.length - 1 : idx - 1]
        : items[idx === -1 || idx === items.length - 1 ? 0 : idx + 1];
      e.preventDefault();
      next.focus({ preventScroll: true });
    };

    // Captura: intercepta o Tab antes de qualquer outro listener; as demais
    // teclas (Esc, setas, as SCROLL_KEYS dos overlays) passam intocadas.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Devolve o foco a quem o tinha antes de abrir (hambúrguer ou o tile
      // que lançou o viewer) — se ainda estiver montado.
      if (previous && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
}

export default useDialogFocus;
