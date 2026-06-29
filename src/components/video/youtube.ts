/**
 * Tiny loader + typings for the YouTube IFrame Player API.
 *
 * We deliberately don't pull in @types/youtube — only the slice of the API the
 * lightbox needs is declared here. The script is fetched once (a module-level
 * promise dedupes concurrent callers and survives Fast Refresh via the early
 * `window.YT` check), then `new YT.Player(...)` drives playback so the lightbox
 * can wear the site's OWN controls (play/pause, mute, a seek bar) instead of
 * YouTube's chrome — `controls: 0` hides theirs, the API keeps the function.
 */

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

interface YTPlayerOptions {
  videoId?: string;
  width?: number | string;
  height?: number | string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTPlayerEvent) => void;
    onError?: (event: YTPlayerEvent) => void;
  };
}

interface YTPlayerConstructor {
  new (host: HTMLElement | string, options: YTPlayerOptions): YTPlayer;
}

interface YTNamespace {
  Player: YTPlayerConstructor;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Player states the lightbox cares about (mirrors YT.PlayerState). */
export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

let apiPromise: Promise<YTNamespace> | null = null;

/** Resolve once `window.YT.Player` is callable; injects the script on first use. */
export function loadYouTubeIframeAPI(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API needs a browser"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve) => {
    // Chain onto any pre-existing handler instead of clobbering it.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as YTNamespace);
    };

    // Already injected (e.g. module state reset by Fast Refresh) — just wait.
    if (!document.querySelector("script[data-yt-iframe-api]")) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.dataset.ytIframeApi = "true";
      document.head.appendChild(tag);
    }
  });

  return apiPromise;
}
