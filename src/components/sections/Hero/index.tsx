import styles from "./Hero.module.css";
import { Botanical } from "./Botanical";
import { Rails } from "./Rails";
import { HeroContent } from "./HeroContent";
import { HeroBrain } from "./HeroBrain";
import { ScrollHint } from "./ScrollHint";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const VINE_DIVIDER = `${BASE_PATH}/images/hero/vine-divider.webp`;
const VINE_DIVIDER_TILES = Array.from({ length: 6 }, (_, i) => i);

/**
 * Hero — first viewport of the site (sits directly below the global Header).
 *
 *   ┌───────────────────────────────────────────┐
 *   │  ◁ rail-left            rail-right ▷       │  <-- vertical chrome
 *   │                                            │
 *   │       — um manifesto —                     │
 *   │        O problema nunca foi                │  <-- HeroContent
 *   │           a sua força                      │
 *   │          de vontade.                       │
 *   │                                            │
 *   │     [ lead text ]  [ AGENDAR → ]           │  <-- row (above brain)
 *   │                                            │
 *   │           ┌──────────┐                     │
 *   │           │   3D     │                     │  <-- HeroBrain
 *   │           │  brain   │                     │
 *   │           └──────────┘                     │
 *   │                                            │
 *   │         leaves drift in background         │  <-- Botanical (parallax)
 *   └───────────────────────────────────────────┘
 *               role · descubra                       <-- ScrollHint (fixed)
 *
 * The brandmark used to live at the top-left of this section; it now lives
 * in the persistent <Header /> rendered by the root layout. The Hero's
 * own .botanical layer keeps overflow:hidden, so any leaf parts that would
 * extend above the section get cropped — which lines up exactly with the
 * header's bottom edge and produces the "header hides the leaf stems"
 * effect the design calls for.
 */
export function Hero() {
  return (
    <>
      <section id="inicio" className={styles.hero}>
        <Botanical />
        <Rails />

        <div className={styles.stage}>
          <HeroContent />
          <HeroBrain />
        </div>

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
                /* Dimensões intrínsecas: o CSS continua mandando no tamanho
                   final; os atributos só dão o aspect ratio ao browser antes
                   do download (reserva de layout — CLS 0). */
                width={1536}
                height={372}
                draggable={false}
              />
            ))}
          </div>
        </div>
      </section>

      <ScrollHint />
    </>
  );
}

export default Hero;
