"use client";

import styles from "./Hero.module.css";
import { useLeafParallax } from "@/hooks/useLeafParallax";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Positioned leaf in the decorative layer. Position class is one of l1..l6. */
type LeafSlot = "l1" | "l2" | "l3" | "l4" | "l5" | "l6";

const LEAVES: Array<{ slot: LeafSlot; file: string }> = [
  { slot: "l1", file: "leaf-1.svg" },
  { slot: "l2", file: "leaf-2.svg" },
  { slot: "l3", file: "leaf-2.svg" }, // intentional reuse — mirrored placement
  { slot: "l4", file: "leaf-3.svg" },
  { slot: "l5", file: "leaf-4.svg" },
  { slot: "l6", file: "leaf-1.svg" }, // intentional reuse — small accent
];

/**
 * Decorative botanical backdrop. Six leaves layered at the corners and mid-edges,
 * cropped by overflow:hidden. The parallax hook reads each leaf's --pf and writes
 * --px/--py on every frame so they drift in response to mouse + scroll.
 */
export function Botanical() {
  useLeafParallax();

  return (
    <div className={styles.botanical} aria-hidden="true">
      {LEAVES.map(({ slot, file }, i) => (
        <img
          key={`${slot}-${i}`}
          data-leaf
          className={`${styles.leaf} ${styles[slot]}`}
          src={`${BASE_PATH}/images/hero/${file}`}
          alt=""
        />
      ))}
    </div>
  );
}

export default Botanical;
