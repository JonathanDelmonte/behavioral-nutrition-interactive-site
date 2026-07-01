/**
 * Boot-time asset primer — the SINGLE download path for the heavy 3D assets
 * (GLB, HDRI, draco decoder — see PRIME_ASSETS in BrainModel/constants.ts).
 *
 * Why it exists: the loading screen used to `fetch` the model/HDRI for its
 * progress bar while, in parallel, the three.js loaders fetched the SAME
 * files again — ~3 MB downloaded twice, saturating the connection exactly
 * when everything else (fonts, hero art, JS chunks) was trying to come down.
 * Now this module streams each asset once (with byte progress for the bar)
 * and keeps the bytes; the 3D side seeds THREE.Cache from them (see
 * BrainModel/primeGate.ts), so GLTFLoader/RGBELoader/DRACOLoader all get
 * instant cache hits and never touch the network.
 *
 * Deliberately imports NOTHING from three: it must live in the main bundle so
 * the downloads start at hydration, well before the ~1 MB three.js chunk has
 * even finished parsing. Module state is a singleton shared across webpack
 * chunks, which is what lets the preloader (main bundle) and the 3D scenes
 * (async chunk) coordinate through plain imports.
 */

import { PRIME_ASSETS } from "@/components/BrainModel/constants";

export interface PrimedAsset {
  url: string;
  /** Mirrors the FileLoader responseType of whichever loader will consume it. */
  type: "arraybuffer" | "text";
  data: ArrayBuffer | string;
}

export interface PrimerProgress {
  /** Bytes received so far, across all assets. */
  loaded: number;
  /** Sum of content-lengths (grows as response headers arrive; 0 = unknown). */
  total: number;
  /** Completed files / total files — fallback signal when totals are unknown. */
  fraction: number;
  /** True once every asset has either landed or conclusively failed. */
  settled: boolean;
}

const state: PrimerProgress = { loaded: 0, total: 0, fraction: 0, settled: false };
const results = new Map<string, PrimedAsset>();
const listeners = new Set<(p: PrimerProgress) => void>();

let started = false;
let resolveDone: (() => void) | null = null;
const donePromise = new Promise<void>((resolve) => {
  resolveDone = resolve;
});

function emit() {
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch {
      /* one bad listener shouldn't stall the others */
    }
  });
}

/**
 * Kick off the downloads. Idempotent — the preloader calls it at mount, and
 * the 3D prime gate calls it defensively in case a future host mounts a scene
 * without the preloader. A failed fetch is simply not stored: the real loader
 * falls back to its own network request for that file, exactly as before.
 */
export function startAssetPrimer(): Promise<void> {
  if (started || typeof window === "undefined") return donePromise;
  started = true;

  const loaded = new Array<number>(PRIME_ASSETS.length).fill(0);
  const totals = new Array<number>(PRIME_ASSETS.length).fill(0);
  let completed = 0;

  const report = () => {
    state.loaded = loaded.reduce((a, b) => a + b, 0);
    state.total = totals.reduce((a, b) => a + b, 0);
    state.fraction = completed / PRIME_ASSETS.length;
    emit();
  };

  Promise.all(
    PRIME_ASSETS.map(async ({ url, type }, i) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} for ${url}`);
        totals[i] = Number(res.headers.get("content-length")) || 0;
        const chunks: Uint8Array[] = [];
        if (res.body) {
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded[i] += value.length;
            report();
          }
        }
        loaded[i] = Math.max(loaded[i], totals[i]);
        const size = chunks.reduce((a, c) => a + c.length, 0);
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
          bytes.set(c, offset);
          offset += c.length;
        }
        results.set(url, {
          url,
          type,
          data: type === "text" ? new TextDecoder().decode(bytes) : bytes.buffer,
        });
      } catch {
        /* offline/404 — the consuming loader will retry over the network */
      } finally {
        completed += 1;
        report();
      }
    }),
  ).then(() => {
    state.settled = true;
    emit();
    resolveDone?.();
  });

  return donePromise;
}

/** Subscribe to progress (fires immediately with the current snapshot). */
export function onPrimerProgress(cb: (p: PrimerProgress) => void): () => void {
  listeners.add(cb);
  cb(state);
  return () => listeners.delete(cb);
}

export function primerSettled(): boolean {
  return state.settled;
}

/** Resolves when every asset has landed or failed (never rejects). */
export function primerDone(): Promise<void> {
  return donePromise;
}

/** The successfully primed assets (failed fetches are simply absent). */
export function primedAssets(): PrimedAsset[] {
  return Array.from(results.values());
}
