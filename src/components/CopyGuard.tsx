"use client";

import { useEffect } from "react";

/** Bloqueia clique direito, cópia/recorte e arrastar imagens em todo o site.
 *  O CSS em globals.css já trava a seleção de texto (incl. o long-press do
 *  iOS); isto cobre o que o CSS sozinho não pega: o menu de contexto do
 *  botão direito, Ctrl/Cmd+C, e o drag de <img> pro desktop/outra aba. */
export function CopyGuard() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();

    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", block);

    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", block);
    };
  }, []);

  return null;
}
