// Copies MediaPipe WASM glue files from node_modules to public/mediapipe/wasm/.
// Run via: node scripts/copy-mediapipe-wasm.mjs
// Self-hosting the WASM provides: offline capability, version pinning,
// no third-party CDN dependency, privacy (no third-party DNS lookup).
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../node_modules/@mediapipe/tasks-vision/wasm');
const DST = resolve(__dirname, '../public/mediapipe/wasm');

if (!existsSync(SRC)) {
  console.warn('[copy-mediapipe] node_modules/@mediapipe/tasks-vision/wasm not found — run pnpm install first');
  process.exit(0);
}

mkdirSync(DST, { recursive: true });

const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

let copied = 0;
for (const f of FILES) {
  const src = resolve(SRC, f);
  const dst = resolve(DST, f);
  if (existsSync(src)) {
    copyFileSync(src, dst);
    console.log(`[copy-mediapipe] copied ${f}`);
    copied += 1;
  } else {
    console.warn(`[copy-mediapipe] not found: ${f} (skipping)`);
  }
}
console.log(`[copy-mediapipe] done — ${copied}/${FILES.length} files`);
