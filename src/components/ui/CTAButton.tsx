import type { AnchorHTMLAttributes, ReactNode } from "react";
import styles from "./CTAButton.module.css";

type Props = {
  /** Anchor target (href). */
  href: string;
  /** Button label. */
  children: ReactNode;
  /** Optional extra class names. */
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;

/**
 * Rounded green pill anchor with a small circular arrow.
 * Used in the hero section and reusable for other CTAs across the site.
 */
export function CTAButton({ href, children, className, ...rest }: Props) {
  return (
    <a className={`${styles.cta} ${className ?? ""}`.trim()} href={href} {...rest}>
      {children}
      <span className={styles.arrow} aria-hidden="true">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 8h11" />
          <path d="M9 4l4 4-4 4" />
        </svg>
      </span>
    </a>
  );
}

export default CTAButton;
