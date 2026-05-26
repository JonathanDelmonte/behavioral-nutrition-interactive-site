import styles from "./Hero.module.css";

/** Vertical side text — hidden below 760px. Decorative only. */
export function Rails() {
  return (
    <>
      <div className={`${styles.rail} ${styles.railLeft}`}>Mente · Corpo · Comida</div>
      <div className={`${styles.rail} ${styles.railRight}`}>A fome começa na mente</div>
    </>
  );
}

export default Rails;
