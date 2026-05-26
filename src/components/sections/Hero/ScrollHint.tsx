import styles from "./Hero.module.css";

/** Fixed-position "scroll · discover" hint at the viewport bottom. */
export function ScrollHint() {
  return <div className={styles.scrollHint}>role · descubra</div>;
}

export default ScrollHint;
