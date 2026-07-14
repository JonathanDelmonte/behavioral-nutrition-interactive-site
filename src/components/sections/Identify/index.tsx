import { CTAButton } from "@/components/ui/CTAButton";
import { ThoughtTrack } from "./ThoughtTrack";
import styles from "./Identify.module.css";

/**
 * Section 2 — "Você se identifica?"
 *
 * Editorial dark-green stretch that follows the Hero. The page-global
 * <BrainStage /> canvas travels from the Hero footprint into this section's
 * brain slot on scroll, shedding its fruit and spinning to its clean face. Five
 * thoughts ("i de v" through "v de v") then cycle as the user scrolls the 600vh
 * <ThoughtTrack />. Mobile (≤760px) falls back to a stacked list.
 */
export function IdentifySection() {
  return (
    <section
      className={styles.identify}
      id="para-quem"
      aria-labelledby="identify-title"
    >
      <div className={styles.intro}>
        <div className={styles.eyebrow}>você se identifica?</div>
        <h2 className={styles.title} id="identify-title">
          Você reconhece <em>esses pensamentos?</em>
        </h2>
        <p className={styles.sub}>
          Cada um deles já passou pela mente de muita gente. Talvez agora
          esteja passando pela sua.
        </p>
        <div className={styles.scrollDive}>continue rolando</div>
      </div>

      <ThoughtTrack />

      <footer className={styles.footer}>
        <p className={styles.pull}>
          Você <em>não precisa passar por isso só</em>.
          <br />
          Vamos conversar.
        </p>
        <CTAButton className={styles.lightCta}>
          Quero conversar
        </CTAButton>
      </footer>
    </section>
  );
}

export default IdentifySection;
