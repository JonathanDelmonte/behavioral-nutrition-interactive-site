import styles from "./Hero.module.css";
import { Brandmark } from "./Brandmark";
import { Botanical } from "./Botanical";
import { Rails } from "./Rails";
import { HeroContent } from "./HeroContent";
import { HeroBrain } from "./HeroBrain";
import { ScrollHint } from "./ScrollHint";

/**
 * Hero — first viewport of the site.
 *
 *   ┌───────────────────────────────────────────┐
 *   │  Brandmark (logo + name)                   │  <-- top
 *   │                                            │
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
 */
export function Hero() {
  return (
    <>
      <section className={styles.hero}>
        <header className={styles.top}>
          <Brandmark />
        </header>

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
