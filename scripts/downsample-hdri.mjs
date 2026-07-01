// One-off (re-runnable) HDRI downsampler. The brain's studio environment map
// shipped as a 1k (1024×512) RGBE .hdr weighing 1.7 MB — the single heaviest
// asset on the page. Three.js runs every equirect through PMREMGenerator,
// which prefilters it down to a small cube map, and this particular HDRI is
// nothing but large soft boxes (low-frequency light), so a 512×256 version
// lights the scene identically for a fraction of the bytes.
//
//   node scripts/downsample-hdri.mjs
//
// Reads the original from art-source/hdri/ (kept out of public/ so the deploy
// doesn't ship both), box-filters it 2× in linear float space, re-encodes
// RGBE with new-style RLE, and VERIFIES the output by re-parsing it and
// comparing pixels against the downsampled floats before writing succeeds.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { FloatType } from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "art-source/hdri/studio_small_03_1k.hdr");
const OUT = path.join(root, "public/hdri/studio_small_03_512.hdr");

// ---------- decode (three's own parser, so we match the runtime exactly) ----
const srcBytes = await fs.readFile(SRC);
const loader = new RGBELoader();
loader.type = FloatType;
const parsed = loader.parse(
  srcBytes.buffer.slice(srcBytes.byteOffset, srcBytes.byteOffset + srcBytes.byteLength),
);
const { width: W, height: H } = parsed;
const src = parsed.data; // Float32Array, RGBA per pixel, linear
console.log(`source: ${W}×${H}, ${(srcBytes.length / 1024).toFixed(0)} KB`);

// ---------- 2× box filter in linear space ----------------------------------
const w = W / 2;
const h = H / 2;
const dst = new Float32Array(w * h * 3);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      const a = src[((2 * y) * W + 2 * x) * 4 + c];
      const b = src[((2 * y) * W + 2 * x + 1) * 4 + c];
      const d = src[((2 * y + 1) * W + 2 * x) * 4 + c];
      const e = src[((2 * y + 1) * W + 2 * x + 1) * 4 + c];
      dst[(y * w + x) * 3 + c] = (a + b + d + e) / 4;
    }
  }
}

// ---------- RGBE encode with new-style RLE ----------------------------------
function float2rgbe(r, g, b, out, o) {
  const max = Math.max(r, g, b);
  if (!(max > 1e-32)) {
    out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
    return;
  }
  let e = Math.floor(Math.log2(max)) + 1;
  let scale = 2 ** (8 - e);
  // Float rounding right at a power of two can push a mantissa to 256.
  if (Math.floor(max * scale) > 255) {
    e += 1;
    scale /= 2;
  }
  out[o] = Math.floor(r * scale);
  out[o + 1] = Math.floor(g * scale);
  out[o + 2] = Math.floor(b * scale);
  out[o + 3] = e + 128;
}

/** New-style RLE for one channel of one scanline: runs of ≥4 become
 *  [128+len, byte]; everything else literal packets [len, ...bytes]. */
function rleEncode(bytes, out) {
  const n = bytes.length;
  let i = 0;
  while (i < n) {
    let runLen = 1;
    while (i + runLen < n && bytes[i + runLen] === bytes[i] && runLen < 127) {
      runLen++;
    }
    if (runLen >= 4) {
      out.push(128 + runLen, bytes[i]);
      i += runLen;
    } else {
      let j = i;
      while (j < n && j - i < 128) {
        if (
          j + 3 < n &&
          bytes[j] === bytes[j + 1] &&
          bytes[j] === bytes[j + 2] &&
          bytes[j] === bytes[j + 3]
        ) {
          break;
        }
        j++;
      }
      out.push(j - i);
      for (let k = i; k < j; k++) out.push(bytes[k]);
      i = j;
    }
  }
}

const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`;
const body = [];
const frame = new Uint8Array(w * h * 4); // full RGBE frame, kept for the check
const channel = new Uint8Array(w);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 3;
    float2rgbe(dst[p], dst[p + 1], dst[p + 2], frame, (y * w + x) * 4);
  }
  body.push(2, 2, (w >> 8) & 0xff, w & 0xff);
  for (let c = 0; c < 4; c++) {
    for (let x = 0; x < w; x++) channel[x] = frame[(y * w + x) * 4 + c];
    rleEncode(channel, body);
  }
}
const outBytes = Buffer.concat([Buffer.from(header, "ascii"), Buffer.from(body)]);

// ---------- verify -----------------------------------------------------------
// Framing/RLE correctness: three's parse of the file must reproduce EXACTLY
// the floats implied by our raw RGBE frame (same decode formula three uses —
// mantissa/255 · 2^(e−128)). Any header or RLE bug would corrupt whole
// scanlines, not shave decimals, so the tolerance is float-epsilon tight.
// (Comparing against the pre-quantization floats instead would only measure
// RGBE's inherent shared-exponent rounding, which the 1k original had too.)
const reparsed = new RGBELoader();
reparsed.type = FloatType;
const check = reparsed.parse(outBytes.buffer.slice(0, outBytes.length));
if (check.width !== w || check.height !== h) {
  throw new Error(`roundtrip size mismatch: ${check.width}×${check.height}`);
}
let worst = 0;
for (let i = 0; i < w * h; i++) {
  const scale = 2 ** (frame[i * 4 + 3] - 128) / 255;
  for (let c = 0; c < 3; c++) {
    const want = frame[i * 4 + c] * scale;
    const got = check.data[i * 4 + c];
    const err = Math.abs(got - want) / Math.max(Math.abs(want), 1e-9);
    if (err > worst) worst = err;
  }
}
if (worst > 1e-5) {
  throw new Error(`RLE roundtrip mismatch: ${(worst * 100).toFixed(4)}%`);
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, outBytes);
console.log(
  `wrote ${path.relative(root, OUT)}: ${w}×${h}, ${(outBytes.length / 1024).toFixed(0)} KB ` +
    `(RLE roundtrip exact to ${(worst * 100).toExponential(1)}%)`,
);
