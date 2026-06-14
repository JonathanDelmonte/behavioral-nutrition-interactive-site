import type { AnchorHTMLAttributes, ReactNode } from "react";
import { WHATSAPP_HREF } from "@/lib/contact";
import { WhatsAppGlyph } from "./WhatsAppGlyph";
import styles from "./CTAButton.module.css";

type Props = {
  /** Anchor target (href). */
  href?: string;
  /** Button label. */
  children: ReactNode;
  /** Optional extra class names. */
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;

/**
 * Rounded green pill anchor with a small circular WhatsApp icon.
 * Used in the hero section and reusable for other CTAs across the site —
 * every instance points at the contact step, so the WhatsApp glyph signals
 * the channel. The glyph inherits `currentColor`, so it stays white on the
 * green pill and green on the inverted light pills.
 */
export function CTAButton({
  href = WHATSAPP_HREF,
  children,
  className,
  target,
  rel,
  ...rest
}: Props) {
  const opensExternally = href.startsWith("http");

  return (
    <a
      className={`${styles.cta} ${className ?? ""}`.trim()}
      href={href}
      target={target ?? (opensExternally ? "_blank" : undefined)}
      rel={rel ?? (opensExternally ? "noopener noreferrer" : undefined)}
      {...rest}
    >
      {children}
      <span className={styles.arrow} aria-hidden="true">
        <WhatsAppGlyph />
      </span>
    </a>
  );
}

export default CTAButton;
