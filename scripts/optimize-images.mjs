// One-off (re-runnable) image optimizer. Reads the source art from art-source/
// (NOT shipped — kept out of public/ so the originals never bloat the deploy)
// and writes optimized WebP into public/, right-sizing anything served far
// larger than it's shown. To re-optimize or add an image: drop the original in
// art-source/images/..., add it to JOBS below, and run:
//
//   node scripts/optimize-images.mjs        (or: npm run optimize:images)
//
// Per-image policy:
//   - juliana (hero highlight photo) → LOSSLESS WebP, native resolution. No
//     pixel loss at all, per the client's call for the headline portrait.
//   - logo (line-art mark) → LOSSLESS WebP, resized to 360px (it's shown at
//     ≤104px, so this is still 3×+ retina) — big byte win, zero visible loss.
//   - vines / vine-divider / pond → quality-90/85 WebP (visually lossless).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "art-source"); // originals — NOT deployed
const OUT = path.join(root, "public"); // optimized webp — shipped

const JOBS = [
  { in: "images/about/juliana.png", out: "images/about/juliana.webp", lossless: true },
  { in: "images/about/vines.png", out: "images/about/vines.webp", quality: 90 },
  { in: "images/hero/vine-divider.png", out: "images/hero/vine-divider.webp", quality: 90 },
  { in: "images/hero/logo.png", out: "images/hero/logo.webp", lossless: true, resizeWidth: 360 },
  { in: "images/about/pond.jpg", out: "images/about/pond.webp", quality: 85 },
];

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

let totalBefore = 0;
let totalAfter = 0;

for (const job of JOBS) {
  const inPath = path.join(SRC, job.in);
  const outPath = path.join(OUT, job.out);
  const before = (await fs.stat(inPath)).size;

  let img = sharp(inPath);
  const meta = await img.metadata();
  if (job.resizeWidth && meta.width && meta.width > job.resizeWidth) {
    img = img.resize({ width: job.resizeWidth, withoutEnlargement: true });
  }
  const opts = job.lossless
    ? { lossless: true, effort: 6 }
    : { quality: job.quality, effort: 6 };
  await img.webp(opts).toFile(outPath);

  const after = (await fs.stat(outPath)).size;
  totalBefore += before;
  totalAfter += after;
  const pct = (100 * (1 - after / before)).toFixed(0);
  const tag = job.lossless ? "lossless" : `q${job.quality}`;
  const resized = job.resizeWidth ? ` resized→${job.resizeWidth}w` : "";
  console.log(`${job.in}\n  ${kb(before)} → ${kb(after)}  (${pct}% smaller)  [${tag}]${resized}`);
}

console.log(
  `\nTOTAL  ${kb(totalBefore)} → ${kb(totalAfter)}  (${(100 * (1 - totalAfter / totalBefore)).toFixed(0)}% smaller)`,
);
