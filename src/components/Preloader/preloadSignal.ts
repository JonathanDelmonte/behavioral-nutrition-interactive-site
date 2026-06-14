/**
 * Tiny client-side handshake between the boot preloader and anything that must
 * wait for it (currently <ScrollRestoration/>).
 *
 * The preloader locks scrolling while it loads the heavy first-screen assets,
 * so any scroll restoration has to be deferred until AFTER it releases —
 * otherwise the re-assert would be clamped to 0 by the scroll lock and the page
 * would always land at the top. The preloader calls `markAppReady()` once it
 * unlocks; consumers register with `whenAppReady()`.
 *
 * It's a module singleton (shared across the client bundle). If no preloader is
 * ever mounted, nothing calls `markAppReady()` — so consumers should treat this
 * as "wait, then run", and the preloader is responsible for always firing it.
 */

let ready = false;
const waiters: Array<() => void> = [];

/** Called by the preloader the moment it lifts the scroll lock. Idempotent. */
export function markAppReady(): void {
  if (ready) return;
  ready = true;
  // Copy then clear so a callback that re-registers can't loop forever.
  const pending = waiters.splice(0, waiters.length);
  pending.forEach((cb) => {
    try {
      cb();
    } catch {
      /* a misbehaving waiter shouldn't block the others */
    }
  });
}

/** Run `cb` once the preloader has handed off (or immediately if it already has). */
export function whenAppReady(cb: () => void): void {
  if (ready) cb();
  else waiters.push(cb);
}
