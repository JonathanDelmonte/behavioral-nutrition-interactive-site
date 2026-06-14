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
        <p className={styles.lead}>
          Nutrição comportamental para sair do ciclo de recomeçar toda
          segunda-feira.
        </p>
        <CTAButton>Agendar consulta</CTAButton>
      </div>
    </>
  );
}

export default HeroContent;
