"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./VideoLightbox.module.css";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import {
  createRawPlayer,
  YT_PLAYER_STATE,
  type RawPlayerHandle,
} from "./youtube";

/**
 * The fullscreen video viewer, shared site-wide through a context so the two
 * places that need it stay in sync:
 *
 *   - the Testimonials tiles OPEN it (a muted background loop you click to watch)
 *   - the global Header reads `active` to morph its hamburger into an X and route
 *     a click to `close` (the requested "menu icon becomes an X to close it")
 *
 * On open the page behind darkens + blurs and the video grows to fill the
 * screen (a 9:16 short, centered). YouTube's own chrome is hidden (`controls:0`,
 * the iframe is pointer-events:none); the controls you see are the site's own —
 * play/pause, mute, and a seek bar — driven through the raw postMessage
 * controller in youtube.ts, which also preserves the basic ability to scrub
 * time. Calm scale+fade transitions, no Framer/GSAP (house rule).
 */

export interface LightboxVideo {
  /** YouTube video id (the bit after /shorts/ or watch?v=). */
  id: string;
  /** Optional caption shown under the player. */
  title?: string;
}

interface VideoLightboxContextValue {
  active: LightboxVideo | null;
  open: (video: LightboxVideo) => void;
  close: () => void;
}

const VideoLightboxContext = createContext<VideoLightboxContextValue | null>(
  null,
);

export function useVideoLightbox(): VideoLightboxContextValue {
  const ctx = useContext(VideoLightboxContext);
  if (!ctx) {
    throw new Error("useVideoLightbox must be used within a VideoLightboxProvider");
  }
  return ctx;
}

export function VideoLightboxProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<LightboxVideo | null>(null);
  const open = useCallback((video: LightboxVideo) => setActive(video), []);
  const close = useCallback(() => setActive(null), []);

  return (
    <VideoLightboxContext.Provider value={{ active, open, close }}>
      {children}
      <VideoLightbox active={active} onClose={close} />
    </VideoLightboxContext.Provider>
  );
}

/** mm:ss for the scrub readouts (guards NaN before the player reports). */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** ms the close fade runs — keeps the player mounted through the exit so the
 *  video doesn't vanish before the backdrop has faded (kept in sync with CSS). */
const EXIT_MS = 420;

/** If nothing has PLAYED this long after mounting a player, assume the boot is
 *  dead (broken handshake, slow embed): rebuild it once, then show the error
 *  state — never an infinite spinner. */
const BOOT_TIMEOUT_MS = 8000;

/** Keyboard scroll keys suppressed while the viewer is open — the page behind
 *  is no longer overflow-locked (see the keydown effect below), and these keys
 *  target the root scroller when focus sits on <body>. Interactive targets are
 *  exempt so Space/arrows still drive the viewer's own buttons and sliders. */
const SCROLL_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function VideoLightbox({
  active,
  onClose,
}: {
  active: LightboxVideo | null;
  onClose: () => void;
}) {
  // `rendered` lags `active` on close so the player survives the exit fade.
  const [rendered, setRendered] = useState<LightboxVideo | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RawPlayerHandle | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  // `started` flips once the video is truly rendering frames — the cover
  // (spinner) stays up until then so YouTube's loading/black frame never
  // shows. Ref mirror lets timers/intervals read it without re-arming.
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  // The boot self-heal: bumping `attempt` rebuilds the player once; a second
  // dead boot flips `failed` and the cover trades its spinner for an error
  // message (plus an escape hatch straight to YouTube).
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const scrubbingRef = useRef(false);

  const markStarted = useCallback(() => {
    startedRef.current = true;
    setStarted(true);
    setFailed(false);
  }, []);

  const isOpen = active !== null;

  // Focus management (ver useDialogFocus): foco entra no dialog ao abrir, Tab
  // cicla entre os controles do player + o X do header, e ao fechar o foco
  // volta ao tile que abriu o vídeo.
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);

  // Mount immediately when opening; hold through the exit fade when closing.
  useEffect(() => {
    if (active) {
      setRendered(active);
      setAttempt(0); // fresh open → fresh retry budget
      return;
    }
    // Closing: silence right away, then drop the player once faded out.
    playerRef.current?.pause();
    const t = window.setTimeout(() => setRendered(null), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  // Create / tear down the player for the rendered video (re-run by the
  // `attempt` bump — the one-shot self-heal for a boot that never plays).
  // createRawPlayer OWNS the listening handshake and retries it until the
  // embed answers, so the old intermittent "audio behind a spinner frozen at
  // 0:00" boot (the official wrapper's lost, unretried handshake) can't wedge
  // anymore. Every readout arrives through its callbacks — no polling.
  useEffect(() => {
    const video = rendered;
    const host = hostRef.current;
    if (!video || !host) return;

    let cancelled = false;
    let muteCheck: number | null = null;
    setPlaying(false);
    startedRef.current = false;
    setStarted(false);
    setFailed(false);
    setDuration(0);
    setCurrent(0);
    setMuted(false);
    setVolume(100);

    host.innerHTML = "";
    const player = createRawPlayer({
      host,
      videoId: video.id,
      title: video.title ? `Vídeo: ${video.title}` : "Vídeo de depoimento",
      playerVars: {
        autoplay: 1,
        // Start MUTED so autoplay always succeeds (no wedge if a browser
        // blocks unmuted autoplay); onReady unmutes right after — the open
        // was a user gesture, so sound is allowed. This also means there's
        // never audio before the first frame ("black + sound" bug).
        mute: 1,
        controls: 0, // hide YouTube's chrome — the site draws its own
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        fs: 0,
        disablekb: 1,
        iv_load_policy: 3,
      },
      onReady: () => {
        if (cancelled) return;
        player.play();
        // Bring sound in (still within the click's activation window).
        player.unMute();
        player.setVolume(100);
        setMuted(false);
        setVolume(100);
        // iOS can silently refuse that programmatic unmute (readiness may
        // land outside the tap's activation window). Read the REAL state
        // back a beat later so the mute button tells the truth — one actual
        // tap on it then brings the sound in.
        muteCheck = window.setTimeout(() => {
          if (!cancelled && typeof player.info.muted === "boolean") {
            setMuted(player.info.muted);
          }
        }, 600);
      },
      onState: (s) => {
        if (cancelled) return;
        setPlaying(s === YT_PLAYER_STATE.PLAYING);
        if (s === YT_PLAYER_STATE.PLAYING) {
          markStarted();
          if (player.info.duration) setDuration(player.info.duration);
        }
        // Park ENDED back at a paused first frame: with controls:0 the ended
        // player paints YouTube's related-videos grid, dead to clicks here
        // (the iframe is pointer-events:none) — it read as a broken screen.
        // Replay is one tap on play.
        if (s === YT_PLAYER_STATE.ENDED) {
          player.seekTo(0);
          player.pause();
          setCurrent(0);
        }
      },
      onInfo: (info) => {
        if (cancelled) return;
        // An advancing clock proves frames are decoding even if a discrete
        // PLAYING transition were ever dropped — the cover can't wedge.
        if (!startedRef.current && (info.currentTime ?? 0) > 0.05) {
          markStarted();
          setPlaying(info.playerState === YT_PLAYER_STATE.PLAYING);
        }
        if (info.duration) setDuration(info.duration);
        if (!scrubbingRef.current && typeof info.currentTime === "number") {
          setCurrent(info.currentTime);
        }
      },
      // Unembeddable / removed / region-locked video: say so instead of
      // spinning forever (the rebuild below can't heal these — the second
      // boot just errors straight back here).
      onError: () => {
        if (!cancelled && !startedRef.current) setFailed(true);
      },
    });
    playerRef.current = player;

    // Boot watchdog: no first frame after BOOT_TIMEOUT_MS → rebuild the player
    // once (same grammar as the brain's retrying boundary); if the rebuild is
    // also dead, trade the spinner for the error state.
    const watchdog = window.setTimeout(() => {
      if (cancelled || startedRef.current) return;
      if (attempt === 0) setAttempt(1);
      else setFailed(true);
    }, BOOT_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      if (muteCheck !== null) window.clearTimeout(muteCheck);
      playerRef.current = null;
      player.destroy();
    };
  }, [rendered, attempt, markStarted]);

  // Esc closes; scroll keys are suppressed. The page behind is NOT
  // overflow-locked anymore: toggling overflow on the ROOT scroller
  // invalidates layout/layerization for the entire 20k-px document on every
  // open AND close — the same tab-freezing cost the index menu already
  // migrated away from (see IndexOverlay.tsx). Wheel/touch are contained by
  // the overlay itself (overflow-y:auto + overscroll-behavior:contain in the
  // CSS); only keyboard scrolling, which targets the root scroller when focus
  // sits on <body>, needs suppressing here.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (
        SCROLL_KEYS.has(e.key) &&
        !(e.target as HTMLElement | null)?.closest(
          "a, button, input, textarea, select",
        )
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Act on the player's REAL reported state, not the React mirror — if a
  // state message were ever dropped the mirror lies, and the button would
  // keep "playing" a video that's already running instead of pausing it.
  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.info.playerState === YT_PLAYER_STATE.PLAYING) p.pause();
    else p.play();
  }, []);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute();
      // unmuting at 0 is silent — bring it back up so the slider has a value
      if (volume === 0) {
        p.setVolume(80);
        setVolume(80);
      }
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  }, [muted, volume]);

  const onVolume = useCallback((value: number) => {
    setVolume(value);
    const p = playerRef.current;
    if (!p) return;
    p.setVolume(value);
    if (value === 0) {
      p.mute();
      setMuted(true);
    } else {
      p.unMute(); // no-op when already unmuted
      setMuted(false);
    }
  }, []);

  const onSeek = useCallback((value: number) => {
    setCurrent(value);
    playerRef.current?.seekTo(value);
  }, []);

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  // The slider sits at 0 while muted; the icon reads muted when silent either way.
  const displayVolume = muted ? 0 : volume;
  const showMutedIcon = muted || volume === 0;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={`${styles.overlay} ${isOpen ? styles.open : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={rendered?.title ? `Vídeo: ${rendered.title}` : "Vídeo"}
      aria-hidden={!isOpen}
      onClick={onClose}
    >
      <div
        className={styles.stage}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.frame}>
          {/* The API replaces this host with the iframe. pointer-events are
              off so the video can't catch YouTube's hover chrome — every
              interaction goes through the site's controls below. */}
          <div className={styles.player} ref={hostRef} />
          {/* Click anywhere on the video (above the control strip) to
              play/pause, like a native player. */}
          <button
            type="button"
            className={styles.tapToggle}
            onClick={togglePlay}
            aria-label={playing ? "Pausar" : "Reproduzir"}
          />
          {/* Dark cover + spinner until the first frame actually plays — no
              black-frame-with-audio flash. Fades out once PLAYING. If the boot
              died (watchdog/onError), the spinner gives way to a plain error
              line with an escape hatch straight to YouTube. */}
          <div
            className={`${styles.cover} ${started ? styles.coverHidden : ""}`.trim()}
            aria-hidden={!failed}
          >
            {failed ? (
              <span className={styles.loadError}>
                <span>Não foi possível carregar o vídeo.</span>
                <a
                  href={`https://www.youtube.com/watch?v=${rendered?.id ?? ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Assistir no YouTube
                </a>
              </span>
            ) : (
              <span className={styles.loading} />
            )}
          </div>
        </div>

        {rendered?.title && (
          <p className={styles.caption}>{rendered.title}</p>
        )}

        <div className={styles.controls}>
          {/* Top row: the seek bar with elapsed / total time. */}
          <div className={styles.seekRow}>
            <span className={styles.time}>{formatTime(current)}</span>
            <div className={styles.scrub}>
              <span
                className={styles.scrubFill}
                style={{ transform: `scaleX(${progress})` }}
                aria-hidden="true"
              />
              <input
                type="range"
                className={styles.scrubInput}
                min={0}
                max={duration || 0}
                step={0.1}
                value={current}
                onChange={(e) => onSeek(Number(e.target.value))}
                onPointerDown={() => {
                  scrubbingRef.current = true;
                }}
                onPointerUp={() => {
                  scrubbingRef.current = false;
                }}
                aria-label="Linha do tempo do vídeo"
              />
            </div>
            <span className={styles.time}>{formatTime(duration)}</span>
          </div>

          {/* Bottom row: play/pause, mute, and a real volume slider. */}
          <div className={styles.btnRow}>
            <button
              type="button"
              className={`${styles.ctrlBtn} ${styles.ctrlBtnLg}`}
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5-11-6.5z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={toggleMute}
              aria-label={showMutedIcon ? "Ativar som" : "Desativar som"}
            >
              {showMutedIcon ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" />
                  <path d="M16 9l5 6M21 9l-5 6" className={styles.stroke} />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" />
                  <path
                    d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
                    className={styles.stroke}
                  />
                </svg>
              )}
            </button>

            <div className={styles.volume}>
              <span
                className={styles.volumeFill}
                style={{ transform: `scaleX(${displayVolume / 100})` }}
                aria-hidden="true"
              />
              <input
                type="range"
                className={styles.volumeInput}
                min={0}
                max={100}
                step={1}
                value={displayVolume}
                onChange={(e) => onVolume(Number(e.target.value))}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoLightboxProvider;
