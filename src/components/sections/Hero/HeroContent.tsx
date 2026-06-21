import styles from "./Hero.module.css";
import { CTAButton } from "@/components/ui/CTAButton";

/**
 * Centered hero copy: eyebrow, headline, big italic display, lead + CTA.
 * Pure server component — animations are CSS-only (no JS).
 */
export function HeroContent() {
  return (
    <>
      <div className={styles.eyebrow}>início</div>

      <h1 className={styles.headline}>O problema nunca foi</h1>

      <div className={styles.display}>
        <span className={styles.line}>a sua força</span>
        <span className={styles.line}>
          de vontade<span className={styles.dot}>.</span>
        </span>
      </div>

      <div className={styles.row}>
        {/* Hard line break locks the wrap after "ciclo" — identical to the
            natural break on the author's window, but now immune to font-metric
            rounding when the caption shrinks on short viewports (an em-ratio box
            alone tips "de" up a line right at the boundary). The em max-width on
            .lead keeps the box wide enough that line 1 never wraps internally at
            any font size. */}
        <p className={styles.lead}>
          Nutrição comportamental para sair do ciclo<br />de recomeçar toda
          segunda-feira.
        </p>
        <CTAButton className={styles.heroCta}>Agendar consulta</CTAButton>
      </div>
    </>
  );
}

export default HeroContent;
