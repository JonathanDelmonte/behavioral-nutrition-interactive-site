/**
 * Raw postMessage controller for YouTube embeds.
 *
 * This used to wrap the official IFrame API (`YT.Player`), but that wrapper
 * has an unfixable race: it sends its `listening` handshake to the iframe
 * ONCE, and if the embed's inner script isn't up yet (slow network/CPU), the
 * player never starts reporting events — while the URL's `autoplay=1` plays
 * it anyway. Symptom in the wild: audio running behind a spinner frozen at
 * 0:00/0:00, intermittently. The wrapper offers no way to retry the
 * handshake, so we speak the same wire protocol ourselves (as lite-youtube &
 * co. do) and OWN the handshake: `listening` is re-sent every 250ms until the
 * iframe answers. No `iframe_api` script download either — one less external
 * dependency and failure mode.
 *
 * Wire contract (stable for a decade; it's what www-widgetapi itself speaks):
 *   page → iframe  {event:"listening", id, channel:"widget"}     — subscribe
 *   page → iframe  {event:"command", func, args, id, channel:"widget"}
 *   iframe → page  {event:"onReady" | "onStateChange" | "onError" |
 *                   "infoDelivery" (info: currentTime/duration/playerState/
 *                   muted/volume/…), id}
 * All payloads are JSON strings; the embed URL needs `enablejsapi=1`,
 * `origin=<page origin>` and a unique `widgetid`.
 */

/** Player states (mirrors YT.PlayerState). */
export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** The merged, latest-known player readouts (grown from infoDelivery). */
export interface RawPlayerInfo {
  currentTime?: number;
  duration?: number;
  playerState?: number;
  muted?: boolean;
  volume?: number;
}

export interface RawPlayerOptions {
  /** The iframe is appended INSIDE this element (not replaced, unlike
   *  YT.Player) — style it via `host iframe` selectors. */
  host: HTMLElement;
  videoId: string;
  /** Extra embed URL params (autoplay, mute, controls…). enablejsapi/origin/
   *  widgetid are always set here. */
  playerVars?: Record<string, string | number>;
  /** Título acessível do <iframe> (a11y/SEO — iframe sem title é flag em
   *  qualquer auditoria). Cai num genérico quando o chamador não nomeia. */
  title?: string;
  /** Every readout delivery, already merged (state changes also flow through
   *  onState below). Arrives ~4×/s while playing, quiet while paused. */
  onInfo?: (info: RawPlayerInfo) => void;
  /** De-duplicated playerState transitions, whether they arrived as a
   *  discrete onStateChange or embedded in an infoDelivery. */
  onState?: (state: number) => void;
  onReady?: () => void;
  onError?: (code: number) => void;
}

export interface RawPlayerHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  /** Latest merged readouts — the component's source of truth. */
  readonly info: RawPlayerInfo;
  /** True once the iframe has answered the handshake. */
  readonly connected: boolean;
  destroy(): void;
}

/* Embed "privacy-enhanced": mesma API postMessage do www.youtube.com, mas sem
   cookies de rastreamento antes do play (LGPD). O preconnect no layout.tsx
   aponta para este mesmo host — manter os dois em sincronia. */
const EMBED_ORIGIN = "https://www.youtube-nocookie.com";
/** Handshake cadence/cap: retry fast (the whole point), stop caring after the
 *  callers' own watchdogs would have given up anyway. */
const LISTEN_EVERY_MS = 250;
const LISTEN_MAX_TRIES = 48; // ~12s

let nextWidgetId = 1;

export function createRawPlayer(opts: RawPlayerOptions): RawPlayerHandle {
  const { host, videoId, playerVars, title, onInfo, onState, onReady, onError } =
    opts;
  const id = nextWidgetId++;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(playerVars ?? {})) {
    params.set(k, String(v));
  }
  params.set("enablejsapi", "1");
  params.set("origin", window.location.origin);
  params.set("widgetid", String(id));

  const iframe = document.createElement("iframe");
  iframe.src = `${EMBED_ORIGIN}/embed/${encodeURIComponent(videoId)}?${params}`;
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.title = title || "Vídeo do YouTube";
  host.appendChild(iframe);

  const info: RawPlayerInfo = {};
  let connected = false;
  let destroyed = false;
  let lastState: number | undefined;
  let listenTries = 0;

  const post = (payload: Record<string, unknown>) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ ...payload, id, channel: "widget" }),
        EMBED_ORIGIN,
      );
    } catch {
      /* iframe mid-teardown */
    }
  };
  const command = (func: string, args: unknown[] = []) =>
    post({ event: "command", func, args });

  const sendListening = () => post({ event: "listening" });

  // THE fix: keep knocking until the embed answers. The official wrapper
  // knocks once on iframe load and can lose the race forever.
  const knocker = window.setInterval(() => {
    if (connected || destroyed || ++listenTries > LISTEN_MAX_TRIES) {
      window.clearInterval(knocker);
      return;
    }
    sendListening();
  }, LISTEN_EVERY_MS);
  iframe.addEventListener("load", sendListening);

  const takeState = (s: unknown) => {
    if (typeof s !== "number" || s === lastState) return;
    lastState = s;
    info.playerState = s;
    onState?.(s);
  };

  const onMessage = (e: MessageEvent) => {
    if (
      e.origin !== EMBED_ORIGIN ||
      e.source !== iframe.contentWindow ||
      typeof e.data !== "string"
    ) {
      return;
    }
    let d: { event?: string; info?: unknown } | null = null;
    try {
      d = JSON.parse(e.data);
    } catch {
      return;
    }
    if (!d?.event) return;

    if (!connected) {
      connected = true;
      // Mirror the official wrapper's subscriptions — belt and braces; most
      // embeds start streaming from `listening` alone.
      command("addEventListener", ["onReady"]);
      command("addEventListener", ["onStateChange"]);
      command("addEventListener", ["onError"]);
    }

    switch (d.event) {
      case "onReady":
        onReady?.();
        break;
      case "onStateChange":
        takeState(d.info);
        break;
      case "onError":
        if (typeof d.info === "number") onError?.(d.info);
        break;
      case "infoDelivery": {
        const delta = d.info as RawPlayerInfo | null;
        if (!delta || typeof delta !== "object") break;
        if (typeof delta.currentTime === "number")
          info.currentTime = delta.currentTime;
        if (typeof delta.duration === "number" && delta.duration > 0)
          info.duration = delta.duration;
        if (typeof delta.muted === "boolean") info.muted = delta.muted;
        if (typeof delta.volume === "number") info.volume = delta.volume;
        takeState(delta.playerState);
        onInfo?.(info);
        break;
      }
    }
  };
  window.addEventListener("message", onMessage);

  return {
    play: () => command("playVideo"),
    pause: () => command("pauseVideo"),
    seekTo: (seconds: number) => command("seekTo", [seconds, true]),
    mute: () => command("mute"),
    unMute: () => command("unMute"),
    setVolume: (volume: number) => command("setVolume", [volume]),
    get info() {
      return info;
    },
    get connected() {
      return connected;
    },
    destroy: () => {
      destroyed = true;
      window.clearInterval(knocker);
      window.removeEventListener("message", onMessage);
      iframe.remove();
    },
  };
}
