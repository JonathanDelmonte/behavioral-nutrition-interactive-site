/**
 * Suspense gate between the boot asset primer and the three.js loaders.
 *
 * Called at the TOP of any component that (directly or via children) loads
 * the shared GLB / HDRI / draco decoder — the brain's <Scene> and the
 * Contact section's fruit field. While the primer is still streaming, it
 * throws the primer promise (suspending the whole subtree, so no loader can
 * start a competing network request); once settled, it seeds THREE.Cache
 * with the primed bytes exactly once. From then on every FileLoader hit —
 * GLTFLoader, RGBELoader, DRACOLoader's wrapper+wasm — resolves from memory.
 *
 * Lives in the three-heavy async chunk on purpose (it imports three's Cache);
 * the primer itself stays three-free in the main bundle so downloads start
 * at hydration. Failed primes simply aren't seeded: the loader falls back to
 * its own fetch, which is the pre-primer behavior.
 */

import { Cache } from "three";
import {
  primedAssets,
  primerDone,
  primerSettled,
  startAssetPrimer,
} from "@/lib/assetPrimer";

let seeded = false;

export function usePrimeGate(): void {
  if (!primerSettled()) {
    // Defensive: normally the preloader started it long ago at hydration.
    startAssetPrimer();
    throw primerDone();
  }
  if (!seeded) {
    seeded = true;
    Cache.enabled = true;
    for (const asset of primedAssets()) Cache.add(asset.url, asset.data);
  }
}
