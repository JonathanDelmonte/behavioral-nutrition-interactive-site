import styles from "./Brandmark.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Props = {
  /** Smaller variant used inside the persistent <Header />. Defaults to the
   *  full-size lockup that used to live at the top-left of the hero. */
  compact?: boolean;
};

/** Logo + scripted name + role lockup. Used in the global Header (compact)
 *  and reusable as a standalone decorative mark wherever needed. */
export function Brandmark({ compact = false }: Props) {
  return (
    <a
      className={`${styles.brandmark} ${compact ? styles.brandmarkCompact : ""}`.trim()}
      href="#"
      aria-label="Juliana Delmonte · Nutrição Comportamental"
    >
      <img src={`${BASE_PATH}/images/hero/logo.webp`} alt="" />
      <span className={styles.lockup}>
        <span className={styles.name}>Juliana Delmonte</span>
        <span className={styles.role}>Nutrição Comportamental</span>
      </span>
    </a>
  );
}

export default Brandmark;
