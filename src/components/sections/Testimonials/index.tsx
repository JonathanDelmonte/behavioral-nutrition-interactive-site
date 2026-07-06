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
 *   - SNAKE FINALE: past the rail's end the review wall dissolves in three
 *     overlapping acts — the right column rises out as a solid block, the
 *     middle pours downward, the left sweeps up, their starts offset by a
 *     beat so mid-phase all three fly at once — framed by a short hold on
 *     both ends. Short, eased, scroll-scrubbed, reversible. EVERY layout
 *     releases the pin MID-FLIGHT (SNAKE_PIN_*, ~half the timeline): the
 *     whole second half of the animation rides the stage's exit, so the
 *     next section arrives while the cards are still visibly flying
 *     (client: the page must be rolling DURING the animation — "do meio
 *     pro final" — and an emptied green window must never be held on
 *     screen). The lone "avaliações" eyebrow fades out alongside. The
 *     timeline also cuts right after the last VISIBLE column's act
 *     (off-screen columns compress their flight into it).
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
// There are deliberately MORE reviews than the masked wall shows at once —
// that hidden overflow is what the scroll-driven snake phase reveals.
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
  {
    name: "André G.",
    handle: "@andregui",
    text: "Perdi 14kg sem abrir mão do churrasco de domingo. É outra relação com a comida.",
  },
  {
    name: "Beatriz M.",
    text: "O acompanhamento mais humano que já tive.",
  },
  {
    name: "Paula D.",
    text: "Cheguei desconfiada, achando que seria só mais uma dieta impressa. Saí com um processo que coube na minha rotina de plantões.",
  },
  {
    name: "Fernanda C.",
    handle: "@fernandac",
    text: "Sempre achei que fosse falta de força de vontade. Era falta de olhar pra causa certa.",
  },
  {
    name: "Marcos P.",
    text: "Parei de descontar o estresse do trabalho na comida. Minha família notou antes de mim.",
  },
  {
    name: "Vinícius R.",
    text: "Três meses e o efeito sanfona parou de fazer sentido.",
  },
];

/** Number of wall columns (reference look: 3 columns, 5 cards each — taller
 *  than the masked window on purpose; the snake phase reveals the rest). The
 *  horizontal rail's scroll distance is derived from the row's LAYOUT width,
 *  so a wider wall simply extends the rail — no scrolljack changes needed. */
const WALL_COLS = 3;
/** Round-robin into columns so the varied card heights stagger across the
 *  wall (a tall review never piles up in one column). */
const REVIEW_COLUMNS = Array.from({ length: WALL_COLS }, (_, c) =>
  REVIEWS.filter((_, i) => i % WALL_COLS === c),
);

/** Per-card float rhythm: each review drifts on its OWN gentle cycle (layered
 *  ON TOP of the rail pan and the snake's column slide). The phases are
 *  COLUMN-FIRST by design: cards in the same column start nearly together
 *  (small per-row offset) so vertical neighbours drift as a loose group
 *  instead of scissoring into each other's gap, while whole columns sit far
 *  apart in phase so the wall never waves in unison. Slightly different
 *  durations let the phases slide apart slowly — alive, never mechanical.
 *  (Delay = -(col·2.7s + row·1.15s + jitter), assembled in <Note/>.) */
const FLOAT_DURS = [8.4, 9.2, 8.8, 9.6, 8.1, 9.0, 8.6, 9.4, 8.2];
const FLOAT_JITTER = [0, 0.35, 0.6, 0.2, 0.5, 0.1, 0.45, 0.25, 0.55];

/** The snake phase (phase 2 of the pin): the three columns exit as SOLID
 *  BLOCKS through the masked horizon — the right rises, the middle pours
 *  down, the left sweeps up — with overlapping, slightly offset starts (the
 *  right leads, the others join moments later; mid-phase all three fly at
 *  once). Each block is eased as one and carries only a whisper of internal
 *  shear (SNAKE_STAG) plus a per-block lean, so it reads solid — never the
 *  elastic, gappy cascade the client vetoed. The phase opens and closes on
 *  a HOLD (the finished wall gets a beat before it starts dissolving; the
 *  emptied window a beat before the unpin), and nothing moves after the
 *  last block clears — the cross-column "guest" cards are GONE: their lone
 *  late flights read as glitches, not as a serpent's thread (client-vetoed
 *  twice). Scroll-scrubbed — rewinds on the way back up. */
const SNAKE_LEN = 2.4; // timeline length = wall-window height × this (clamped)
/** Share of the snake timeline that stays PINNED; the remainder plays over
 *  the stage's exit. Released MID-FLIGHT on purpose (client, twice): the
 *  page must already be rolling while the cards are still visibly flying —
 *  "não é no início, é mais do meio pro final" — so the whole second half
 *  of the animation crosses the next section's arrival and no stretch of
 *  scroll ever shows a held green window. Waiting for the window to empty
 *  (first pass: 0.68/0.8) read as "the scroll only happens after the
 *  animation" — vetoed. Measured at release: desktop still shows ~6 of its
 *  12 window cards mid-flight; phones ~3–4 of 8. */
const SNAKE_PIN_PHONE = 0.58;
const SNAKE_PIN_DESKTOP = 0.52;
const SNAKE_ACT_R: [number, number] = [0.1, 0.62]; // right block (up)
const SNAKE_ACT_M: [number, number] = [0.18, 0.72]; // middle block (down)
const SNAKE_ACT_L: [number, number] = [0.28, 0.97]; // left block (up)
const SNAKE_STAG = 0.05; // whisper of per-card shear inside a block
const SNAKE_PAD = 32; // hidden margin past the window edges
/** Per-column flight lean, degrees at full exit — the block tilts as ONE
 *  (per-card alternating tilt read cartoonish on a solid block). */
const SNAKE_LEAN = [0.5, -0.45, 0.55];

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

  // Lazy-mount the loop the first time the SECTION nears the viewport
  // vertically, then stop observing — once it's playing it just keeps going.
  // Observing the tile itself fired far too late: the tile sits viewports away
  // HORIZONTALLY inside the scrolljacked rail, so it only intersected once the
  // visitor had already panned next to it — and then sat through the player's
  // multi-second cold boot. Keying off the section (with a generous vertical
  // margin) starts that boot while the visitor is still a section or two
  // above, so the loop is already playing when the rail reaches it. Skip
  // entirely for reduced-motion (the poster stays as a still; the click still
  // opens the lightbox).
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
      { rootMargin: "175% 0px" },
    );
    io.observe(el.closest("section") ?? el);
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

function Note({ review, col, row }: { review: Review; col: number; row: number }) {
  // Column-first phase design (see FLOAT_DURS): near-phase within a column,
  // far apart across columns, a dash of jitter so nothing reads as a grid.
  const seed = col + row * WALL_COLS;
  const delay = -(
    col * 2.7 +
    row * 1.15 +
    FLOAT_JITTER[seed % FLOAT_JITTER.length]
  );
  return (
    // The slot is the snake acts' handle on this card (JS-owned transform);
    // the float wrapper and the interactive card nest inside untouched.
    <div className={styles.noteSlot} data-wall-card>
      <div
        className={`${styles.noteFloat} ${(col + row) % 2 ? styles.floatB : ""}`.trim()}
        style={
          {
            ["--float-delay"]: `${delay.toFixed(2)}s`,
            ["--float-dur"]: `${FLOAT_DURS[seed % FLOAT_DURS.length]}s`,
          } as React.CSSProperties
        }
      >
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
      </div>
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
      /** Focus-zoom span (peak scale = base + span). Smaller = gentler swell;
       *  the review wall opts down so it doesn't balloon on phones. */
      scaleSpan: number;
      video: boolean;
      last: string;
      lastF: number;
    }

    /** One review card during the snake acts (its slot is JS-transformed). */
    interface WallCard {
      node: HTMLElement;
      col: number;
      /** Shear rank within its block (0 = leads by a whisper). */
      order: number;
      /** Cards in its column (the shear's denominator). */
      count: number;
      /** Exit travel (px) — the whole COLUMN's, so the block stays solid. */
      travel: number;
      /** Flight lean, degrees at full exit (shared by the whole block). */
      tilt: number;
      /** This column's act window, already fitted to snakeCut (see measure). */
      act: [number, number];
      last: string;
    }

    let dist = 0;
    /** Scroll length of the snake in px. Desktop: EXTRA pinned scroll past
     *  the rail's end (the track is taller by this much). Phones (overlap
     *  mode): a share of the stage's exit — no extra track height at all. */
    let snakeDist = 0;
    /** Where the act timeline ends (1 on desktop). Phones park a window
     *  NARROWER than the wall: acts past the last VISIBLE column's end played
     *  to an empty stage — a whole viewport of dead green scroll before the
     *  unpin. measure() cuts the timeline just past that last visible act,
     *  so the phase is over the beat after the window empties. */
    let snakeCut = 1;
    /** Share of the timeline that stays pinned (SNAKE_PIN_*, per layout —
     *  set in measure). The pin must not outlive the show: the page rolls
     *  again as the animation reaches its end, never holding an emptied
     *  window. The track only extends by this share; the acts are driven by
     *  the RAW track offset (-rect.top keeps growing through the unpinned
     *  exit), so the flight's tail plays over the next section's arrival.
     *  Scrubbed both ways. */
    let pinFrac = 1;
    /** The "avaliações" eyebrow — it bows out with the last flight (see
     *  update) instead of sitting alone over the emptied window. */
    let eyebrow: { node: HTMLElement; last: string } | null = null;
    let raf: number | null = null;
    let pieces: Piece[] = [];
    let wallCards: WallCard[] = [];
    let lastTx = 0;
    let vel = 0;

    /** Cinematic ease for the snake's per-card flights (soft in and out). */
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
      wallCards.forEach((c) => {
        c.node.style.transform = "";
        c.last = "";
      });
      if (eyebrow) {
        eyebrow.node.style.opacity = "";
        eyebrow.node.style.transform = "";
        eyebrow.last = "";
      }
    };

    const update = () => {
      if (!isJacked() || dist <= 0) return;
      const rect = track.getBoundingClientRect();
      const max = track.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, Math.min(max, -rect.top));
      // Phase 1 — the lateral pan: scroll maps 1:1 onto rail travel until the
      // wall has fully panned in. The track is taller than that travel by
      // snakeDist (see measure), so past this point the stage stays pinned
      // with the rail parked — the page "locks" visually while phase 2 runs.
      const tx = -Math.min(scrolled, dist);
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
          // base keeps the prior 0.94→1.02 default (span 0.08); a piece can dial
          // its span down via data-scale so its swell stays gentle (review wall).
          const scale = 1 - pc.scaleSpan * 0.75 + f * pc.scaleSpan;
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

      // Phase 2 — the serpent's three overlapping ACTS (right up, middle
      // down, left up): each column a SOLID block eased through the masked
      // horizon, starts offset by a beat, the whole thing framed by a hold
      // on both ends. Scroll-scrubbed — it rewinds on the way back up.
      if (wallCards.length > 0 && snakeDist > 0) {
        // p runs 0→snakeCut across the phase: the act table is authored for
        // the full desktop timeline (cut = 1); a narrower parked window ends
        // it early (see measure). Driven by the RAW track offset — it keeps
        // growing while the unpinned stage exits (the pin covers only
        // pinFrac of the phase), so the flight's tail plays over the page's
        // own motion instead of over a frozen screen.
        const phase = Math.max(0, Math.min(1, (-rect.top - dist) / snakeDist));
        const p = phase * snakeCut;
        // The lone "avaliações" label bows out with the last flight — fully
        // gone a breath BEFORE the pin releases, so it never sits alone
        // over the emptied window (client). Eased, scrubbed, reversible.
        if (eyebrow) {
          const f = easeInOut(
            Math.max(0, Math.min(1, (phase - (pinFrac - 0.22)) / 0.2)),
          );
          const key = f.toFixed(3);
          if (key !== eyebrow.last) {
            eyebrow.node.style.opacity = f === 0 ? "" : (1 - f).toFixed(3);
            eyebrow.node.style.transform =
              f === 0 ? "" : `translate3d(0,${(-12 * f).toFixed(1)}px,0)`;
            eyebrow.last = key;
          }
        }
        const span = 1 - SNAKE_STAG;
        for (const c of wallCards) {
          const act = c.act;
          const a = Math.max(
            0,
            Math.min(1, (p - act[0]) / (act[1] - act[0])),
          );
          const start = (c.order / Math.max(1, c.count - 1)) * SNAKE_STAG;
          const e = easeInOut(Math.max(0, Math.min(1, (a - start) / span)));
          const dy = (c.col === 1 ? c.travel : -c.travel) * e;
          const rot = c.tilt * e;
          const t = `translate3d(0,${dy.toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg)`;
          if (t !== c.last) {
            c.node.style.transform = t;
            c.last = t;
          }
        }
      }
    };

    const measure = () => {
      if (!isJacked()) {
        track.style.height = "";
        row.style.transform = "";
        clearPieces();
        dist = 0;
        snakeDist = 0;
        snakeCut = 1;
        pinFrac = 1;
        return;
      }
      // A stale scrollLeft survives mode switches (the reduced-motion fallback
      // scrolls the stage natively; overflow:hidden does NOT reset it) and
      // would offset the rail on top of the translate — the "resize to phone
      // and back breaks the rail" bug. Always rail from a clean origin.
      stage.scrollLeft = 0;
      // dist must come from LAYOUT, not row.scrollWidth: scrollable overflow
      // tracks the pieces' TRANSFORMED bounds, and at measure time (page top)
      // the far pieces carry a large positive parallax shift — the wall alone
      // sat ~100px right of its box, so the rail over-panned past its own end
      // and parked on a dead green band (a third of a phone's screen).
      // offsetLeft chains ignore transforms; sum the real right edge instead.
      let edge = 0;
      for (const child of Array.from(row.children) as HTMLElement[]) {
        edge = Math.max(edge, leftInRow(child) + child.offsetWidth);
      }
      edge += parseFloat(getComputedStyle(row).paddingRight) || 0;
      dist = Math.max(0, Math.round(edge - stage.clientWidth));

      // Wall geometry for the snake acts: each card's slot (position within
      // the masked window + cascade order), the column x offsets for the
      // guest hops, and the phase length — a fixed multiple of the window
      // height (short and punchy), NOT the content's full length.
      const wallWin = row.querySelector<HTMLElement>("[data-wall]");
      const colNodes = Array.from(
        row.querySelectorAll<HTMLElement>("[data-wall-col]"),
      );
      if (wallWin && colNodes.length === WALL_COLS) {
        const winH = wallWin.clientHeight;
        // The acts, indexed by column (left, middle, right). Which of them
        // can the PARKED window actually show? On phones the wall is wider
        // than the screen — the left column (sometimes most of the middle)
        // sits wholly off-screen at tx = -dist, so its act played to nobody
        // while the pin held an empty stage. Close the timeline just past
        // the last visible act (same closing beat as desktop's 0.97→1).
        const acts: [number, number][] = [SNAKE_ACT_L, SNAKE_ACT_M, SNAKE_ACT_R];
        let lastVisible = 0;
        colNodes.forEach((colNode, ci) => {
          const x = leftInRow(colNode) - dist;
          if (x < stage.clientWidth - 12 && x + colNode.offsetWidth > 12) {
            lastVisible = Math.max(lastVisible, acts[ci][1]);
          }
        });
        snakeCut = Math.min(1, (lastVisible || 1) + 0.03);
        wallCards = [];
        colNodes.forEach((colNode, ci) => {
          const slots = Array.from(
            colNode.querySelectorAll<HTMLElement>("[data-wall-card]"),
          );
          // An off-screen column still has to FINISH inside the cut timeline
          // (compressed, faster — nobody sees it), or its half-exited cards
          // would freeze peeking back into the wall's masked edge.
          const base = acts[ci];
          const act: [number, number] =
            base[1] > snakeCut
              ? [Math.min(base[0], snakeCut - 0.2), snakeCut]
              : base;
          // The BLOCK's travel: rising columns clear their full content past
          // the window's top; the descending middle clears the window's
          // height past its bottom. Shared by every card, so the column
          // flies as one solid piece. A rising column starts BELOW the box's
          // top by its offset inside the wall (the mobile wall pads its top
          // 48px for the horizon fade) — without that term the block parked
          // its last card's tail inside the masked window. offsetTop chains
          // ignore transforms, so the difference is stable mid-flight too.
          const colTop = colNode.offsetTop - wallWin.offsetTop;
          const travel =
            ci === 1
              ? winH + SNAKE_PAD
              : colTop + colNode.offsetHeight + SNAKE_PAD;
          slots.forEach((node, r) => {
            wallCards.push({
              node,
              col: ci,
              // The whisper of shear leads from the exit edge: top card
              // first on rising columns, bottom card first on the
              // descending middle — the leader eases away from, never
              // into, its neighbour.
              order: ci === 1 ? slots.length - 1 - r : r,
              count: slots.length,
              travel,
              tilt: SNAKE_LEAN[ci],
              act,
              last: "",
            });
          });
        });
        // ONE timeline length for every width (scaled by the cut so each
        // act keeps its px-per-beat — it ends sooner, never idles). Layouts
        // differ only in how much of it stays PINNED (track height below).
        pinFrac = window.matchMedia("(max-width: 760px)").matches
          ? SNAKE_PIN_PHONE
          : SNAKE_PIN_DESKTOP;
        snakeDist = Math.round(
          Math.min(Math.max(winH * SNAKE_LEN, 850), 1750) * snakeCut,
        );
        const eyeNode = row.querySelector<HTMLElement>("[data-wall-eyebrow]");
        eyebrow = eyeNode ? { node: eyeNode, last: eyebrow?.last ?? "" } : null;
      } else {
        wallCards = [];
        snakeDist = 0;
        snakeCut = 1;
        pinFrac = 1;
        eyebrow = null;
      }
      // The pin covers only pinFrac of the timeline (per layout): the page
      // frees right as the flight enters its tail, so the next section is
      // already arriving while the last cards slip out — and an emptied
      // window is never held on screen.
      track.style.height = `${
        dist + Math.round(snakeDist * pinFrac) + window.innerHeight
      }px`;

      pieces = Array.from(row.querySelectorAll<HTMLElement>("[data-piece]")).map(
        (node) => ({
          node,
          left: leftInRow(node),
          width: node.offsetWidth,
          depth: parseFloat(node.dataset.depth ?? "1"),
          tilt: parseFloat(node.dataset.tilt ?? "1"),
          scaleSpan: parseFloat(node.dataset.scale ?? "0.08"),
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
    // Column heights shift as fonts land, but the row's own box doesn't (the
    // wall is height-capped) — watch the columns too or travel goes stale.
    row
      .querySelectorAll<HTMLElement>("[data-wall-col]")
      .forEach((node) => ro.observe(node));
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
              loading="lazy"
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
              data-scale="0.03"
            >
              <span className={styles.notesEyebrow} data-wall-eyebrow>
                avaliações
              </span>
              <div className={styles.notesWall} data-wall>
                {REVIEW_COLUMNS.map((col, ci) => (
                  <div className={styles.notesCol} data-wall-col key={ci}>
                    {col.map((r, i) => (
                      <Note key={i} review={r} col={ci} row={i} />
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
