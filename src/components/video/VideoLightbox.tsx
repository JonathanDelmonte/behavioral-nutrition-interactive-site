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
import { loadYouTubeIframeAPI, YT_PLAYER_STATE, type YTPlayer } from "./youtube";

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
 * play/pause, mute, and a seek bar — driven through the IFrame API, which also
 * preserves the basic ability to scrub time. Calm scale+fade transitions, no
 * Framer/GSAP (house rule).
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
  const playerRef = useRef<YTPlayer | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  // `started` flips on the FIRST PLAYING event — the cover (spinner) stays up
  // until then so YouTube's loading/black frame never shows.
  const [started, setStarted] = useState(false);
  const scrubbingRef = useRef(false);

  const isOpen = active !== null;

  // Mount immediately when opening; hold through the exit fade when closing.
  useEffect(() => {
    if (active) {
      setRendered(active);
      return;
    }
    // Closing: silence right away, then drop the player once faded out.
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* player may be tearing down */
    }
    const t = window.setTimeout(() => setRendered(null), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  // Create / tear down the API player for the rendered video.
  useEffect(() => {
    const video = rendered;
    if (!video) return;

    let cancelled = false;
    setPlaying(false);
    setStarted(false);
    setDuration(0);
    setCurrent(0);
    setMuted(false);
    setVolume(100);

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        // YT.Player REPLACES the host element with the iframe, so feed it a
        // throwaway child we can freely recreate on each open.
        hostRef.current.innerHTML = "";
        const mount = document.createElement("div");
        hostRef.current.appendChild(mount);

        playerRef.current = new YT.Player(mount, {
          videoId: video.id,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            // Start MUTED so autoplay always succeeds (no infinite spinner if a
            // browser blocks unmuted autoplay); onReady unmutes right after —
            // the open was a user gesture, so sound is allowed. This also means
            // there's never audio before the first frame ("black + sound" bug).
            mute: 1,
            controls: 0, // hide YouTube's chrome — the site draws its own
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            fs: 0,
            disablekb: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              setDuration(e.target.getDuration());
              e.target.playVideo();
              // Bring sound in (still within the click's activation window).
              e.target.unMute();
              e.target.setVolume(100);
              setMuted(false);
              setVolume(100);
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const s = e.target.getPlayerState();
              setPlaying(s === YT_PLAYER_STATE.PLAYING);
              if (s === YT_PLAYER_STATE.PLAYING) {
                setStarted(true);
                const d = e.target.getDuration();
                if (d) setDuration(d);
              }
            },
          },
        });
      })
      .catch(() => {
        /* offline / blocked — overlay stays, controls inert */
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [rendered]);

  // Poll the clock for the seek bar while a video is loaded (rAF is paused on
  // hidden tabs, so a timer is the reliable choice; cheap at 4 Hz).
  useEffect(() => {
    if (!rendered) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || scrubbingRef.current) return;
      try {
        setCurrent(p.getCurrentTime());
        if (!duration) {
          const d = p.getDuration();
          if (d) setDuration(d);
        }
      } catch {
        /* not ready */
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [rendered, duration]);

  // Esc closes; lock the page scroll behind the overlay (the same html-overflow
  // lock the index menu uses — <html> is this page's scroll container).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const { documentElement } = document;
    const prevOverflow = documentElement.style.overflow;
    documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      documentElement.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [playing]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) {
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
  }, [volume]);

  const onVolume = useCallback((value: number) => {
    setVolume(value);
    const p = playerRef.current;
    if (!p) return;
    try {
      p.setVolume(value);
      if (value === 0) {
        p.mute();
        setMuted(true);
      } else if (p.isMuted()) {
        p.unMute();
        setMuted(false);
      }
    } catch {
      /* not ready */
    }
  }, []);

  const onSeek = useCallback((value: number) => {
    setCurrent(value);
    try {
      playerRef.current?.seekTo(value, true);
    } catch {
      /* not ready */
    }
  }, []);

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  // The slider sits at 0 while muted; the icon reads muted when silent either way.
  const displayVolume = muted ? 0 : volume;
  const showMutedIcon = muted || volume === 0;

  return (
    <div
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
              black-frame-with-audio flash. Fades out once PLAYING. */}
          <div
            className={`${styles.cover} ${started ? styles.coverHidden : ""}`.trim()}
            aria-hidden="true"
          >
            <span className={styles.loading} />
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
