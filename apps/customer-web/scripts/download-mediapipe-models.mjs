// Downloads MediaPipe .task model files to public/mediapipe/.
// Models are NOT bundled with the npm package — they're hosted by Google.
// Downloading them once lets us serve them locally (privacy + offline).
// Face model ~3.5 MB; hand model ~5.9 MB. Idempotent: skips existing files.
import { createWriteStream, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get as httpsGet } from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DST = resolve(__dirname, '../public/mediapipe');
mkdirSync(DST, { recursive: true });

const MODELS = [
  {
    name: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    name: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    function doGet(u) {
      httpsGet(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doGet(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    }
    doGet(url);
  });
}

for (const model of MODELS) {
  const dest = resolve(DST, model.name);
  if (existsSync(dest) && statSync(dest).size > 1024) {
    console.log(`[download-mediapipe] ${model.name} already exists — skipping`);
    continue;
  }
  console.log(`[download-mediapipe] downloading ${model.name}...`);
  await download(model.url, dest);
  console.log(`[download-mediapipe] saved ${model.name}`);
}
console.log('[download-mediapipe] done');
