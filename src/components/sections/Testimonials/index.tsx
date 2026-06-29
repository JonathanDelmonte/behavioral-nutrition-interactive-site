"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Testimonials.module.css";
import { useVideoLightbox } from "@/components/video/VideoLightbox";
import {
  loadYouTubeIframeAPI,
  YT_PLAYER_STATE,
  type YTPlayer,
} from "@/components/video/youtube";
import {
  usePolaroidLightbox,
  type Polaroid,
} from "@/components/polaroid/PolaroidLightbox";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const VINE_DIVIDER = `${BASE_PATH}/images/hero/vine-divider.webp`;
const VINE_DIVIDER_TILES = Array.from({ length: 6 }, (_, i) => i);

/**
 * Section 5 — Depoimentos ("profundidade no trilho", com zoom cinematográfico).
 *
 * The essence is unchanged: a horizontal scrolljack (the page's vertical
 * scroll pans the row sideways inside the pinned stage), two client cases —
 * two overlapping prints + one video each — separated only by breathing room
 * and a serif pull-quote, closing on the written reviews. What's new is how
 * the pieces LIVE on the rail:
 *
 *   - CENTER FOCUS: the piece nearest the viewport's center comes into focus
 *     (scales up, its dim veil lifts) while neighbours soften — the site's
 *     focus motif, horizontal. The video gets the cinematic dose: it grows
 *     from 0.78× to ~1.20× as its chapter reaches center stage.
 *   - DEPTH PARALLAX: every piece carries a depth factor and slides at its
 *     own speed, so the rail reads as layers, not a flat strip.
 *   - VELOCITY TILT: scroll speed leans the prints like paper dragged across
 *     a table; a spring settles them upright when the scroll rests.
 *   - Ghost script names behind each case, paper-note reviews that straighten
 *     on hover, a breathing play ring.
 *
 * All per-piece choreography happens in the SAME rAF as the rail (one
 * getBoundingClientRect for the track; piece geometry is cached untranslated
 * offsets), writing only compositor-friendly transforms + a `--f` focus var.
 * Mobile (≤760px) and reduced-motion keep the native horizontal scroll-snap
 * fallback with the choreography off. Placeholders remain for the client's
 * real, consented photos/videos. NO Framer/GSAP.
 */

type Review = { name: string; handle?: string; text: string };

// Placeholder reviews — the client swaps ALL of these for real, consented
// ones. Lengths VARY on purpose (some one-liners, some longer) so the wall
// staggers like a real review board instead of a tidy grid. Only SOME carry an
// Instagram handle (the others preferred not to share one) — rendered as a
// soft, gradient-tinted @ that sinks into the green instead of shouting.
const REVIEWS: Review[] = [
  {
    name: "Rafael L.",
    text: "Acolhimento de verdade. Senti escuta desde o início.",
  },
  {
    name: "Renata S.",
    handle: "@renatas",
    text: "Entendi o que sabotava minhas tentativas. Recomendo demais.",
  },
  {
    name: "Eduardo M.",
    text: "Resultado que dura, porque a cabeça mudou junto.",
  },
  {
    name: "Lucas T.",
    handle: "@lucast",
    text: "Parei de brigar comigo a cada refeição.",
  },
  {
    name: "Carolina V.",
    handle: "@carolinav",
    text: "Eu já tinha tentado de tudo: contagem de calorias, jejum, aqueles aplicativos. Foi a primeira vez que alguém olhou a minha história antes do prato. Mudou tudo.",
  },
  {
    name: "Camila R.",
    handle: "@camilar",
    text: "A culpa foi embora antes mesmo do peso. E o peso veio depois.",
  },
  {
    name: "Tatiane S.",
    text: "Saí de cada consulta mais leve, mesmo nos dias difíceis. Hoje eu como sem aquele peso da culpa o tempo todo na cabeça.",
  },
  {
    name: "Júlia A.",
    text: "Pela primeira vez não larguei na segunda semana.",
  },
  {
    name: "Priscila N.",
    text: "Não é mágica, é entender o porquê. E quando você entende, não tem mais como voltar atrás.",
  },
];

/** Number of wall columns (reference look: 3 columns, 3 cards each). The
 *  horizontal rail's scroll distance is derived from row.scrollWidth, so a
 *  wider wall simply extends the rail — no scrolljack changes needed. */
const WALL_COLS = 3;
/** Round-robin into columns so the varied card heights stagger across the
 *  wall (a tall review never piles up in one column). */
const REVIEW_COLUMNS = Array.from({ length: WALL_COLS }, (_, c) =>
  REVIEWS.filter((_, i) => i % WALL_COLS === c),
);

/** The pile of prints behind each case — a "bolo de polaroide" the visitor
 *  flips through. These are real, consented evolution shots; dates are invented
 *  test values, ordered oldest→newest so the pile reads as a timeline (the prints
 *  are dealt to the back, so index 0 sits on top first). `posY` biases the cover
 *  crop vertically (smaller = higher) so each subject's face stays in frame as
 *  the portrait source crops to the squarish polaroid window. (`Polaroid` is
 *  shared with the expand lightbox.) */
const POLAROIDS_MARIANA: Polaroid[] = [
  { src: `${BASE_PATH}/images/testimonials/mariana-1.webp`, date: "Mariana • 14 mar 2020", posY: "26%" },
  { src: `${BASE_PATH}/images/testimonials/mariana-2.webp`, date: "Mariana • 09 set 2023", posY: "16%" },
  { src: `${BASE_PATH}/images/testimonials/mariana-3.webp`, date: "Mariana • 21 jun 2026", posY: "20%" },
];
const POLAROIDS_CAUE: Polaroid[] = [
  { src: `${BASE_PATH}/images/testimonials/caue-1.webp`, date: "Cauê • 11 mar 2019", posY: "22%" },
  { src: `${BASE_PATH}/images/testimonials/caue-2.webp`, date: "Cauê • 06 out 2020", posY: "14%" },
  { src: `${BASE_PATH}/images/testimonials/caue-3.webp`, date: "Cauê • 18 jul 2025", posY: "12%" },
];

/** The two main cases. `videoId` is the YouTube id (the bit after /shorts/ or
 *  watch?v=) — PLACEHOLDER example shorts for now; the client swaps these for
 *  their own unlisted recordings (kept on YouTube so they don't weigh on the
 *  site). `length` is a decorative chip the client edits to match (the lightbox
 *  always shows the real, API-reported duration). */
const CASES = [
  {
    name: "Mariana",
    photos: POLAROIDS_MARIANA,
    videoId: "1Du0oZkN-q8",
    length: "0:32",
  },
  {
    name: "Cauê",
    photos: POLAROIDS_CAUE,
    videoId: "lDngyg-F6rA",
    length: "0:46",
  },
];

/** ms the fly-to-back animation runs — kept in sync with the CSS keyframe so the
 *  pile re-locks (and accepts the next click) exactly as the card lands. */
const FLY_MS = 760;

/** After this long with no interaction, the pile eases back to the first print
 *  (so an abandoned carousel resets itself to the start). */
const IDLE_RESET_MS = 30000;

function AvatarGlyph() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={styles.avatar}>
      <circle cx="24" cy="18" r="8" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9 41c1.5-8.5 8-13 15-13s13.5 4.5 15 13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A pile of prints ("bolo de polaroide"): one in focus, the rest peeking just
 *  a sliver behind. Click the pile (or the side arrow) and the top print lifts
 *  and arcs to the back while the next eases forward — the choreography lives in
 *  CSS (transitions + one keyframe); React only swaps which index is on top.
 *
 *  The pieces' OUTER transform (rail focus/parallax/lean) is owned by the JS
 *  loop on .piece, so everything interactive here sits on inner elements the
 *  loop never touches. */
function PolaroidStack({ name, photos }: { name: string; photos: Polaroid[] }) {
  const [active, setActive] = useState(0);
  // Index of the print currently flying to the back (null = pile at rest). It
  // doubles as the "busy" guard so clicks mid-flight are ignored.
  const [flying, setFlying] = useState<number | null>(null);
  const flyTimer = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const { open: openExpand } = usePolaroidLightbox();
  const n = photos.length;

  useEffect(
    () => () => {
      if (flyTimer.current !== null) window.clearTimeout(flyTimer.current);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    },
    [],
  );

  // Each interaction (re)arms a countdown; when it lapses, the pile eases back to
  // the first print. Cleared/restarted on every advance so it only fires once the
  // visitor truly stops flipping.
  const armIdleReset = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setActive(0), IDLE_RESET_MS);
  };

  const advance = () => {
    if (flying !== null) return; // mid-animation — ignore
    armIdleReset();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setActive((a) => (a + 1) % n); // no flight: just swap the top print
      return;
    }
    setFlying(active); // the current top print is the one that flies
    setActive((a) => (a + 1) % n);
    flyTimer.current = window.setTimeout(() => setFlying(null), FLY_MS);
  };

  return (
    <div
      className={`${styles.piece} ${styles.carousel}`}
      data-piece
      data-depth="0.96"
      data-tilt="0.7"
    >
      <button
        type="button"
        className={styles.stack}
        onClick={advance}
        aria-label={`Evolução de ${name} — ver a próxima foto`}
      >
        {photos.map((p, i) => {
          // 0 = on top (in focus), 1 = next, … wrapping round the pile.
          const depth = (i - active + n) % n;
          return (
            <figure
              key={i}
              className={`${styles.card} ${flying === i ? styles.flying : ""}`.trim()}
              style={
                {
                  ["--d"]: depth,
                  ["--posy"]: p.posY ?? "26%",
                  zIndex: n - depth,
                } as React.CSSProperties
              }
              aria-hidden={depth !== 0}
            >
              <span className={styles.cardPhoto}>
                <img
                  src={p.src}
                  alt={depth === 0 ? `${name}, ${p.date}` : ""}
                  draggable={false}
                  loading="lazy"
                />
              </span>
              <figcaption className={styles.printCaption}>{p.date}</figcaption>
              <span className={styles.cardVeil} aria-hidden="true" />
            </figure>
          );
        })}
        <span className={styles.stackDim} aria-hidden="true" />
      </button>

      {/* Pure pointer affordances beside the pile — the pile itself already
          carries the action for keyboard/SR users, so these stay out of the tab
          order. They also fill the room beside the rail: arrow (next) up top,
          the position dots lower, then an expand control (not wired yet). */}
      <div className={styles.stackNav} aria-hidden="true">
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navArrow}`}
          onClick={advance}
          tabIndex={-1}
          aria-label="Próxima foto"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span className={styles.navDots}>
          {photos.map((_, i) => (
            <span
              key={i}
              className={`${styles.navDot} ${i === active ? styles.navDotOn : ""}`.trim()}
            />
          ))}
        </span>
        <button
          type="button"
          className={styles.navBtn}
          tabIndex={-1}
          aria-label="Expandir"
          onClick={() => openExpand({ name, photos, start: active })}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** The video — the chapter's protagonist; grows as it reaches center stage.
 *
 *  At rest it plays a clean muted loop. It's driven by the IFrame API (NOT a
 *  plain `loop=1&playlist=` embed) on purpose: the playlist param is what makes
 *  YouTube paint its prev/next buttons, so we loop manually instead (seamless
 *  pre-seek before the end, so the end-screen never shows). A poster covers the
 *  player until it's truly PLAYING, hiding YouTube's unstarted overlay. Click it
 *  and the shared lightbox takes over. The loop only mounts once the tile nears
 *  the viewport (never under reduced-motion), and pauses while offscreen or
 *  while the lightbox is open. */
function VideoTile({
  name,
  videoId,
  length,
}: {
  name: string;
  videoId: string;
  length: string;
}) {
  const { open } = useVideoLightbox();
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [mounted, setMounted] = useState(false);
  // One-way: the poster covers the player until the stream is decoding, then
  // fades out for good. The loop is NEVER paused (per request: it keeps running
  // when it scrolls off and back, instead of reloading), so the poster never
  // needs to come back.
  const [revealed, setRevealed] = useState(false);

  // Lazy-mount the loop the first time the tile nears the viewport, then stop
  // observing — once it's playing it just keeps going. Skip entirely for
  // reduced-motion (the poster stays as a still; the click still opens the
  // lightbox).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Build the API player once mounted.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    let revealTimer: number | null = null;
    setRevealed(false);

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        const mount = document.createElement("div");
        hostRef.current.appendChild(mount);

        playerRef.current = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: 1, // muted loop — required for autoplay
            controls: 0,
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
              e.target.mute();
              e.target.playVideo();
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const s = e.target.getPlayerState();
              // Reveal a beat AFTER playback is actually decoding (the very first
              // live frame can still flash the seam), then drop the poster for
              // good — the loop never pauses, so it never needs to come back.
              if (s === YT_PLAYER_STATE.PLAYING && revealTimer === null) {
                revealTimer = window.setTimeout(() => {
                  if (!cancelled) setRevealed(true);
                }, 450);
              }
              // Manual loop fallback (the pre-seek below usually beats it).
              if (s === YT_PLAYER_STATE.ENDED) {
                e.target.seekTo(0, true);
                e.target.playVideo();
              }
            },
          },
        });
      })
      .catch(() => {
        /* offline / blocked — the poster stays put */
      });

    return () => {
      cancelled = true;
      if (revealTimer !== null) window.clearTimeout(revealTimer);
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [mounted, videoId]);

  // Seamless loop: jump back to the start just before the end so YouTube's
  // end-screen (related videos / replay) never gets a chance to paint.
  useEffect(() => {
    if (!mounted) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const d = p.getDuration();
        if (d > 0 && p.getCurrentTime() >= d - 0.4) p.seekTo(0, true);
      } catch {
        /* not ready */
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [mounted]);

  return (
    <div
      ref={rootRef}
      className={`${styles.piece} ${styles.video}`}
      data-piece
      data-depth="1.07"
      data-kind="video"
      data-tilt="0.32"
    >
      <span className={styles.media} aria-hidden="true">
        {mounted && (
          <span className={styles.frameCover}>
            <span className={styles.ytHost} ref={hostRef} />
          </span>
        )}
      </span>
      {/* Poster over the player until it's actually rendering frames — hides
          YouTube's unstarted/loading overlay. Fades out once PLAYING. */}
      <span
        className={`${styles.poster} ${revealed ? styles.posterHidden : ""}`.trim()}
        aria-hidden="true"
      />
      <span className={styles.play} aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 7.5v9l8-4.5-8-4.5z" fill="currentColor" />
        </svg>
      </span>
      <span className={styles.videoName} aria-hidden="true">
        <em>a história de {name}</em>
      </span>
      <span className={styles.videoLen} aria-hidden="true">
        {length}
      </span>
      <span className={styles.dim} aria-hidden="true" />
      {/* Transparent hit layer over the whole tile — clicking opens the
          lightbox. The keyboard/SR-accessible action lives here. */}
      <button
        type="button"
        className={styles.videoOpen}
        onClick={() => open({ id: videoId, title: `a história de ${name}` })}
        aria-label={`Assistir ao depoimento — a história de ${name}`}
      />
    </div>
  );
}

/** Serif pull-quote — the subtle separation between chapters. */
function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className={`${styles.piece} ${styles.quote}`}
      data-piece
      data-depth="0.9"
      data-tilt="0.3"
    >
      <span className={styles.quoteMark} aria-hidden="true">
        “
      </span>
      <p>{children}</p>
    </blockquote>
  );
}

function Note({ review }: { review: Review }) {
  return (
    <div className={styles.note}>
      <span className={styles.noteHead}>
        <span className={styles.noteAvatar} aria-hidden="true">
          <AvatarGlyph />
        </span>
        <span className={styles.noteByline}>
          <span className={styles.noteName}>{review.name}</span>
          {review.handle ? (
            <span className={styles.noteHandle}>{review.handle}</span>
          ) : null}
        </span>
      </span>
      <p className={styles.noteText}>{review.text}</p>
    </div>
  );
}

export function TestimonialsSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const row = rowRef.current;
    if (!track || !stage || !row) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The scrolljack runs at EVERY width (per client request, phones included:
    // you scroll DOWN, the rail moves sideways). Only reduced-motion falls
    // back to a native horizontal scroll.
    const isJacked = () => !reduce;

    interface Piece {
      node: HTMLElement;
      /** Untranslated left within the row (transform-independent). */
      left: number;
      width: number;
      depth: number;
      tilt: number;
      video: boolean;
      last: string;
      lastF: number;
    }

    let dist = 0;
    let raf: number | null = null;
    let pieces: Piece[] = [];
    let lastTx = 0;
    let vel = 0;

    /** Untranslated offset of a node relative to the row (offsetLeft chains
     *  ignore transforms, so this is stable however far the rail has panned). */
    const leftInRow = (node: HTMLElement) => {
      let l = 0;
      let el: HTMLElement | null = node;
      while (el && el !== row) {
        l += el.offsetLeft;
        el = el.offsetParent as HTMLElement | null;
      }
      return l;
    };

    const clearPieces = () => {
      pieces.forEach((pc) => {
        pc.node.style.transform = "";
        pc.node.style.removeProperty("--f");
      });
    };

    const update = () => {
      if (!isJacked() || dist <= 0) return;
      const rect = track.getBoundingClientRect();
      const max = track.offsetHeight - window.innerHeight;
      const p = max > 0 ? Math.max(0, Math.min(1, -rect.top / max)) : 0;
      const tx = -p * dist;
      row.style.transform = `translate3d(${tx.toFixed(2)}px,0,0)`;

      // Velocity → the paper lean (springs back as vel decays).
      vel += (tx - lastTx - vel) * 0.18;
      lastTx = tx;
      const lean = Math.max(-5, Math.min(5, vel * 0.05));

      const vw = window.innerWidth;
      for (const pc of pieces) {
        const center = pc.left + pc.width / 2 + tx;
        const c = (center - vw / 2) / (vw / 2);
        // Smooth focus bell: 1 at center, 0 at the window's edge. The video
        // gets a WIDER bell so its cinematic growth accompanies the scroll
        // for most of its chapter instead of popping near the middle.
        const a = Math.min(1, Math.abs(c) / (pc.video ? 1.45 : 1));
        const f = (Math.cos(a * Math.PI) + 1) / 2;

        const par = (1 - pc.depth) * 260 * c;
        // Video zoom eased further (0.42→0.26 span, peak ~1.20×→~1.10×) and its
        // base raised (0.78→0.84) so it neither balloons at center nor shrinks
        // away off-center. Paired with the smaller, viewport-relative box in CSS,
        // the video reads calm instead of crowding the stage. Prints keep their
        // gentle 0.94→1.02 swell.
        // The video tile must NOT be sub-pixel transformed: scaling/rotating a
        // cross-origin YouTube iframe resamples its compositing layer and leaves
        // a faint seam (the "thin line") across it — worst on a static frame.
        // So the video gets an INTEGER-pixel parallax only (no zoom, no lean),
        // which renders pixel-clean. Its focus still reads through the dim veil +
        // breathing play ring (both opacity-driven by --f). Every other piece
        // keeps the full choreography.
        let t: string;
        if (pc.video) {
          t = `translate3d(${Math.round(par)}px,0,0)`;
        } else {
          const scale = 0.94 + f * 0.08;
          const rot = lean * pc.tilt;
          t = `translate3d(${par.toFixed(1)}px,0,0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        }
        if (t !== pc.last) {
          pc.node.style.transform = t;
          pc.last = t;
        }
        const fr = Math.round(f * 50) / 50;
        if (fr !== pc.lastF) {
          pc.node.style.setProperty("--f", String(fr));
          pc.lastF = fr;
        }
      }
    };

    const measure = () => {
      if (!isJacked()) {
        track.style.height = "";
        row.style.transform = "";
        clearPieces();
        dist = 0;
        return;
      }
      // A stale scrollLeft survives mode switches (the reduced-motion fallback
      // scrolls the stage natively; overflow:hidden does NOT reset it) and
      // would offset the rail on top of the translate — the "resize to phone
      // and back breaks the rail" bug. Always rail from a clean origin.
      stage.scrollLeft = 0;
      dist = Math.max(0, row.scrollWidth - stage.clientWidth);
      track.style.height = `${dist + window.innerHeight}px`;

      pieces = Array.from(row.querySelectorAll<HTMLElement>("[data-piece]")).map(
        (node) => ({
          node,
          left: leftInRow(node),
          width: node.offsetWidth,
          depth: parseFloat(node.dataset.depth ?? "1"),
          tilt: parseFloat(node.dataset.tilt ?? "1"),
          video: node.dataset.kind === "video",
          last: "",
          lastF: -1,
        }),
      );
      update();
    };

    // Scheduling ONE rAF per scroll event froze the velocity lean at its last
    // value the instant the scroll stopped — the pieces (the video most of all)
    // stayed visibly tilted ("torto"). Instead self-sustain the loop until the
    // lean has decayed to ~0, so they spring fully upright at rest as the
    // comment above promises. The pan itself is unchanged (tx tracks scroll).
    const tick = () => {
      raf = null;
      update();
      if (isJacked() && dist > 0 && Math.abs(vel) > 0.04) {
        raf = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (raf === null) raf = requestAnimationFrame(tick);
    };

    measure();
    requestAnimationFrame(measure);
    const t1 = window.setTimeout(measure, 300);
    const t2 = window.setTimeout(measure, 1000);
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section
      className={styles.testimonials}
      id="depoimentos"
      aria-labelledby="testi-title"
    >
      <div className={styles.vineDivider} aria-hidden="true">
        <div className={styles.vineTrack}>
          {VINE_DIVIDER_TILES.map((tile) => (
            <img
              key={tile}
              className={`${styles.vineTile} ${
                tile % 2 === 1 ? styles.vineTileFlip : ""
              }`.trim()}
              src={VINE_DIVIDER}
              alt=""
              draggable={false}
            />
          ))}
        </div>
      </div>
      <div className={styles.track} ref={trackRef}>
        <div className={styles.stage} ref={stageRef}>
          <div className={styles.row} ref={rowRef}>
            <div className={styles.intro}>
              <span className={styles.eyebrow}>histórias de verdade</span>
              <h2 className={styles.introTitle} id="testi-title">
                A virada, na <em>voz de quem viveu</em>.
              </h2>
              <p className={styles.introSub}>
                Pessoas que chegaram no limite das tentativas e encontraram
                outro caminho.
              </p>
              <span className={styles.scrollHint}>
                role para o lado
                <svg
                  viewBox="0 0 22 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={styles.hintArrow}
                >
                  <path d="M1 6h19" />
                  <path d="M15 1.5 20.5 6 15 10.5" />
                </svg>
              </span>
            </div>

            <PolaroidStack name={CASES[0].name} photos={CASES[0].photos} />
            <VideoTile
              name={CASES[0].name}
              videoId={CASES[0].videoId}
              length={CASES[0].length}
            />

            <Quote>Segunda-feira deixou de ser recomeço.</Quote>

            <PolaroidStack name={CASES[1].name} photos={CASES[1].photos} />
            <VideoTile
              name={CASES[1].name}
              videoId={CASES[1].videoId}
              length={CASES[1].length}
            />

            <Quote>O que mudou primeiro foi a cabeça.</Quote>

            <div
              className={`${styles.piece} ${styles.notesPanel}`}
              data-piece
              data-depth="0.97"
              data-tilt="0.6"
            >
              <span className={styles.notesEyebrow}>avaliações</span>
              <div className={styles.notesWall}>
                {REVIEW_COLUMNS.map((col, ci) => (
                  <div className={styles.notesCol} key={ci}>
                    {col.map((r, i) => (
                      <Note key={i} review={r} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
