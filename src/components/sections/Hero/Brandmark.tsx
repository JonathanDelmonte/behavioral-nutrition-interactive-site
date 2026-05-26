import styles from "./Hero.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Logo + scripted name + role lockup. Anchored top-left of the hero. */
export function Brandmark() {
  return (
    <a
      className={styles.brandmark}
      href="#"
      aria-label="Juliana Delmonte · Nutrição Comportamental"
    >
      <img src={`${BASE_PATH}/images/hero/logo.png`} alt="" />
      <span className={styles.lockup}>
        <span className={styles.name}>Juliana Delmonte</span>
        <span className={styles.role}>Nutrição Comportamental</span>
      </span>
    </a>
  );
}

export default Brandmark;
