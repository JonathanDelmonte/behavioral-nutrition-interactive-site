import styles from "./Hero.module.css";
import { Botanical } from "./Botanical";
import { Rails } from "./Rails";
import { HeroContent } from "./HeroContent";
import { HeroBrain } from "./HeroBrain";
import { ScrollHint } from "./ScrollHint";

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
      <section className={styles.hero}>
        <Botanical />
        <Rails />

        <div className={styles.stage}>
          <HeroContent />
          <HeroBrain />
        </div>
      </section>

      <ScrollHint />
    </>
  );
}

export default Hero;
