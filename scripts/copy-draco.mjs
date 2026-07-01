// Copies the Draco decoder out of the installed three package into
// public/draco/, so the GLB decodes from OUR origin instead of the gstatic
// CDN (which cost a third-party DNS+TLS handshake on the critical path of the
// brain's first paint, and couldn't be streamed by the boot primer). Re-run
// after a three upgrade so the decoder stays version-matched:
//
//   node scripts/copy-draco.mjs
//
// draco_decoder.js is the asm.js fallback DRACOLoader only fetches when the
// browser lacks WebAssembly — shipped for completeness, never downloaded on a
// modern browser.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "node_modules/three/examples/jsm/libs/draco/gltf");
const OUT = path.join(root, "public/draco");

const FILES = ["draco_wasm_wrapper.js", "draco_decoder.wasm", "draco_decoder.js"];

await fs.mkdir(OUT, { recursive: true });
for (const file of FILES) {
  await fs.copyFile(path.join(SRC, file), path.join(OUT, file));
  const { size } = await fs.stat(path.join(OUT, file));
  console.log(`${file}  ${(size / 1024).toFixed(0)} KB`);
}
