import { MethodAtmosphere } from "./MethodAtmosphere";
import { Principles } from "./Principles";
import styles from "./Method.module.css";

/**
 * Section 3 — "A Virada" (the turn / emerging into light).
 *
 * An animated dawn sky (MethodAtmosphere) is a sticky background; the content —
 * the contrast headline, then the principles traced on a line — scrolls OVER it
 * continuously. The dawn completes as Section 3 fills the screen. No brain slot
 * is registered, so the page-global brain rests (drifts up and away).
 */
export function MethodSection() {
  return (
    <section
      className={styles.method}
      id="como-funciona"
      aria-labelledby="method-title"
    >
      <MethodAtmosphere />
      <div className={styles.content}>
        <div className={styles.headline}>
          <h2 className={styles.title} id="method-title">
            Em vez de <span className={styles.muted}>mais uma dieta</span>, a gente
            investiga{" "}
            <em className={styles.turn}>por que as anteriores não duraram.</em>
          </h2>
          <p className={styles.sub}>
            Não é sobre força de vontade. É sobre o que acontece antes do prato.
          </p>
        </div>
        <Principles />
      </div>
    </section>
  );
}

export default MethodSection;
