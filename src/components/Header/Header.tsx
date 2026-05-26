import styles from "./Header.module.css";
import { Brandmark } from "@/components/sections/Hero/Brandmark";

/** Sections the nav anchors to. The first one is treated as the current page
 *  for now — once we add scroll-spy or real routes, swap `active` for state. */
const NAV = [
  { label: "Manifesto",   href: "#manifesto" },
  { label: "Método",      href: "#metodo" },
  { label: "Para quem é", href: "#para-quem" },
  { label: "Sobre Ju",    href: "#sobre" },
  { label: "Contato",     href: "#contato" },
] as const;

/**
 * Persistent top header — sticky at viewport top.
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  [logo]  Juliana Delmonte    MANIFESTO  MÉTODO  …  [ AGENDAR → ]  │
 *   │          NUTRIÇÃO COMP.                                            │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Sections below it subtract var(--header-h) from their first-fold height
 * (see Hero.module.css). Because this sits in document flow at the top
 * and sticks, leaves in the Hero render below it naturally — the Hero's
 * own overflow:hidden then crops their tops against the header's bottom
 * edge, exactly the "header is the new ceiling" effect.
 */
export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Brandmark compact />

        <nav className={styles.nav} aria-label="Navegação principal">
          {NAV.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.link} ${i === 0 ? styles.active : ""}`.trim()}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a href="#agendar" className={styles.cta}>
          Agendar
          <span className={styles.arrow} aria-hidden="true">→</span>
        </a>
      </div>
    </header>
  );
}

export default Header;
