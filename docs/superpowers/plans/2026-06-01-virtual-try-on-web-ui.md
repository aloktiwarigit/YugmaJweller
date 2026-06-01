# Virtual Try-On — Web UI Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the customer-facing web try-on UI in `apps/customer-web`: a fullscreen camera modal where a customer sees earrings/necklaces (face) or rings/bangles (hand) rendered true-to-size on their live camera feed, using the math and API from Plan 1.

**Architecture:** A `TryOnButton` client component on the product detail page lazy-loads a fullscreen `TryOnModal`. The modal presents a DPDPA-aligned consent sheet before requesting camera permission, then initialises MediaPipe `FaceLandmarker` (EAR/NECK) or `HandLandmarker` (FINGER/WRIST). A Canvas 2D overlay renders the jewellery transparent-PNG using landmark geometry from `@goldsmith/try-on-core`. All inference is on-device; no camera frame leaves the browser.

**Tech Stack:** Next.js 14 App Router, `@mediapipe/tasks-vision ^0.10.14` (Apache-2.0, self-hosted WASM + model), `@goldsmith/try-on-core` (Plan 1 — already built), Canvas 2D API, `@testing-library/react` + Vitest.

**Architecture deviations from spec (documented):**
- *Main-thread MediaPipe (not Web Worker)*: Web Worker + WASM in Next.js 14 requires `asyncWebAssembly` + OffscreenCanvas (partial browser support) + comlink message-passing — over-engineered for v1. MediaPipe's own web demos run on the main thread in a `requestAnimationFrame` loop; this is the proven path. Worker upgrade is Plan 3 if FPS profiling demands it.
- *Canvas 2D only (no react-three-fiber)*: WS-D explicitly defines "Canvas 2D overlay renderer." Three.js/r3f is the post-v1 upgrade path for 3D hero-piece rendering per the spec.

**Plan 1 foundations used (do NOT re-implement):**
`@goldsmith/try-on-core` — `OneEuroFilter`, `normPerMmFace`, `normPerMmHand`, `anchorFor`, `FACE_INDEX`, `HAND_INDEX`, `resolveAssetWidthNorm`, `decomposePose`, `mirrorXIfNeeded`, `resolveEarSide`, `RING_DIAMETER_MM`, `BANGLE_DIAMETER_MM`, types `Landmark`/`Vec2`/`BodyPart`/`DimensionsMm`/`FitResult`.
`GET /api/v1/catalog/products/:id/try-on` → `CatalogTryOnResponse` (from `@goldsmith/customer-shared`).

**Conventions verified against current codebase:**
- `@goldsmith/customer-shared` is already in `apps/customer-web/package.json` ✓
- `@goldsmith/try-on-core` is NOT yet in customer-web — Task 1 adds it
- `@mediapipe/tasks-vision` NOT in customer-web — Task 1 adds it
- Permissions-Policy at `next.config.mjs:103` is `camera=()` — **BLOCKS camera entirely** — Task 1 fixes this
- CSP `script-src` has `'unsafe-eval'` in dev only; production needs `'wasm-unsafe-eval'` for MediaPipe WASM — Task 1 adds it
- No existing Web Worker pattern in customer-web — fresh
- Tests go in `apps/customer-web/test/*.test.tsx` (jsdom) or `*.test.ts` (node) per `vitest.config.ts`
- Test globals (`describe`, `it`, `expect`, `vi`) are auto-injected (`globals: true` in vitest config)
- Modal pattern from `MobileBrowseDrawer.tsx`: `role="dialog"`, `aria-modal`, Esc-dismiss, body-overflow lock
- Client components use `useTenant()` from `@/app/TenantContext` to get `tenant.shopId`

---

## File Structure

**Create:**
- `apps/customer-web/scripts/copy-mediapipe-wasm.mjs` — copies WASM glue from node_modules to `public/mediapipe/wasm/`
- `apps/customer-web/scripts/download-mediapipe-models.mjs` — downloads `.task` model files from Google Storage to `public/mediapipe/`
- `apps/customer-web/components/try-on/ConsentSheet.tsx` — DPDPA-aligned Hindi+English consent gate (WS-G)
- `apps/customer-web/components/try-on/TryOnModal.tsx` — fullscreen camera modal: consent → camera → loading → active/denied states (WS-F)
- `apps/customer-web/components/try-on/TryOnCanvas.tsx` — video element, canvas overlay, rAF loop, detector routing (WS-F)
- `apps/customer-web/components/try-on/TryOnButton.tsx` — PDP CTA; lazy-loads modal (WS-F)
- `apps/customer-web/components/try-on/useFaceDetector.ts` — FaceLandmarker lifecycle hook (WS-D)
- `apps/customer-web/components/try-on/useHandDetector.ts` — HandLandmarker lifecycle hook (WS-E)
- `apps/customer-web/components/try-on/face-renderer.ts` — Canvas 2D earring + necklace renderer (WS-D)
- `apps/customer-web/components/try-on/hand-renderer.ts` — Canvas 2D ring + bangle renderer (WS-E)
- `apps/customer-web/test/try-on-api.test.ts`
- `apps/customer-web/test/try-on-consent-sheet.test.tsx`
- `apps/customer-web/test/try-on-modal.test.tsx`
- `apps/customer-web/test/try-on-canvas.test.tsx`
- `apps/customer-web/test/try-on-button.test.tsx`
- `apps/customer-web/test/face-renderer.test.ts`
- `apps/customer-web/test/hand-renderer.test.ts`
- `ops/semgrep/no-try-on-egress.yaml` — blocks raw `fetch` calls inside `try-on/` components
- `ops/semgrep/tests/no-try-on-egress-test.tsx` — Semgrep test fixture

**Modify:**
- `apps/customer-web/package.json` — add `@mediapipe/tasks-vision`, `@goldsmith/try-on-core`; add `"setup:mediapipe"` script
- `apps/customer-web/next.config.mjs` — fix `camera=()` → `camera=(self)`, add `'wasm-unsafe-eval'` to CSP, add `asyncWebAssembly` webpack experiment, add `@goldsmith/try-on-core` to `transpilePackages`
- `apps/customer-web/lib/api.ts` — add `fetchTryOnData(productId, shopId)` + export `CatalogTryOnResponse`
- `apps/customer-web/app/products/[id]/page.tsx` — add `<TryOnButton>` in CTAs section (after WishlistButton, lines 236–247)

---

## WS-F: Entry Point + Modal Shell

### Task 1: Package config + next.config.mjs security hardening + WASM setup scripts

**Files:**
- Modify: `apps/customer-web/package.json`
- Modify: `apps/customer-web/next.config.mjs`
- Create: `apps/customer-web/scripts/copy-mediapipe-wasm.mjs`
- Create: `apps/customer-web/scripts/download-mediapipe-models.mjs`

- [ ] **Step 1: Update package.json**

In `apps/customer-web/package.json`, add two entries to `"dependencies"`:

```json
"@goldsmith/try-on-core": "workspace:*",
"@mediapipe/tasks-vision": "^0.10.14",
```

And add a `"setup:mediapipe"` script alongside the existing scripts:

```json
"setup:mediapipe": "node scripts/copy-mediapipe-wasm.mjs && node scripts/download-mediapipe-models.mjs",
```

Run `pnpm install` to link the workspace dep and install the MediaPipe package.

- [ ] **Step 2: Write the WASM copy script**

Create `apps/customer-web/scripts/copy-mediapipe-wasm.mjs`:

```js
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
```

- [ ] **Step 3: Write the model download script**

Create `apps/customer-web/scripts/download-mediapipe-models.mjs`:

```js
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
```

- [ ] **Step 4: Fix next.config.mjs — Permissions-Policy, CSP, WASM, transpilePackages**

Open `apps/customer-web/next.config.mjs`. Make four edits:

**Edit 1** — Fix Permissions-Policy (line 103). Change `camera=()` to `camera=(self)`:

```js
// BEFORE
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
// AFTER
{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=()' },
```

**Edit 2** — Add `'wasm-unsafe-eval'` to CSP `script-src`. The current line is:
```js
`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://www.gstatic.com https://apis.google.com`,
```
Change to:
```js
`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} 'wasm-unsafe-eval' https://www.gstatic.com https://apis.google.com`,
```
`'wasm-unsafe-eval'` is the minimal production-safe directive for WASM execution; it does not permit inline JS eval.

**Edit 3** — Add `@goldsmith/try-on-core` to `transpilePackages`. The current array is:
```js
transpilePackages: [
  '@goldsmith/ui-tokens',
  '@goldsmith/auth-client',
  '@goldsmith/ui-web',
  '@goldsmith/customer-shared',
],
```
Add the new entry:
```js
transpilePackages: [
  '@goldsmith/ui-tokens',
  '@goldsmith/auth-client',
  '@goldsmith/ui-web',
  '@goldsmith/customer-shared',
  '@goldsmith/try-on-core',
],
```

**Edit 4** — Add a `webpack` function to the `nextConfig` object (just before `poweredByHeader`):

```js
webpack(config) {
  // Required for @mediapipe/tasks-vision WASM loading in Next.js
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
    layers: true,
  };
  return config;
},
```

- [ ] **Step 5: Run the WASM setup**

```
cd apps/customer-web && node scripts/copy-mediapipe-wasm.mjs && node scripts/download-mediapipe-models.mjs
```

Expected: `public/mediapipe/wasm/` has the 4 WASM files; `public/mediapipe/` has `face_landmarker.task` and `hand_landmarker.task`.

- [ ] **Step 6: Typecheck**

```
pnpm --filter @goldsmith/customer-web typecheck
```

Expected: PASS (no errors from the new deps or config changes).

- [ ] **Step 7: Add public/mediapipe/ to .gitignore (large binary files)**

In `apps/customer-web/.gitignore` (or root `.gitignore`), add:

```
# MediaPipe self-hosted WASM/model files — regenerate via pnpm setup:mediapipe
apps/customer-web/public/mediapipe/
```

- [ ] **Step 8: Commit**

```
git add apps/customer-web/package.json apps/customer-web/next.config.mjs apps/customer-web/scripts/copy-mediapipe-wasm.mjs apps/customer-web/scripts/download-mediapipe-models.mjs
git commit -m "feat(customer-web): add mediapipe + try-on-core deps; fix camera Permissions-Policy; wasm-unsafe-eval CSP"
```

---

### Task 2: WS-F — `fetchTryOnData` API helper + test

**Files:**
- Modify: `apps/customer-web/lib/api.ts`
- Create: `apps/customer-web/test/try-on-api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/customer-web/test/try-on-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SHOP_ID = '00000000-0000-4000-8000-000000000001';
const PROD_ID = '11111111-1111-4000-8000-000000000001';

const mockTryOnData = {
  productId: PROD_ID,
  bodyPart: 'EAR',
  assetUrl: 'https://ik.imagekit.io/test/cutout.png',
  anchorX: 0.5,
  anchorY: 0.0,
  lengthMm: 24.5,
  widthMm: null,
  diameterMm: null,
  metal: 'GOLD',
  purity: '22K',
  netWeightG: '4.5000',
  trueToSize: true,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('fetchTryOnData', () => {
  it('returns CatalogTryOnResponse on 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockTryOnData), { status: 200 }),
    );
    const { fetchTryOnData } = await import('../lib/api');
    const result = await fetchTryOnData(PROD_ID, SHOP_ID);
    expect(result).toMatchObject({ productId: PROD_ID, bodyPart: 'EAR' });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining(`/products/${PROD_ID}/try-on`),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Tenant-Id': SHOP_ID }) }),
    );
  });

  it('returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
    const { fetchTryOnData } = await import('../lib/api');
    const result = await fetchTryOnData(PROD_ID, SHOP_ID);
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'));
    const { fetchTryOnData } = await import('../lib/api');
    const result = await fetchTryOnData(PROD_ID, SHOP_ID);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- try-on-api
```

Expected: FAIL — `fetchTryOnData` is not exported from `../lib/api`.

- [ ] **Step 3: Add fetchTryOnData to lib/api.ts**

In `apps/customer-web/lib/api.ts`:

Add to the import re-exports at the top of the file:

```typescript
export type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
```

Add to the imports block:

```typescript
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
```

Add the function (place it after `fetchProductImages`, following the established fetch pattern):

```typescript
export async function fetchTryOnData(
  productId: string,
  shopId: string,
): Promise<CatalogTryOnResponse | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/catalog/products/${productId}/try-on`,
      {
        headers: { 'X-Tenant-Id': shopId },
        next: { revalidate: 60 },
        ...withTimeout(),
      },
    );
    if (!res.ok) return null;
    return res.json() as Promise<CatalogTryOnResponse>;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- try-on-api
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```
git add apps/customer-web/lib/api.ts apps/customer-web/test/try-on-api.test.ts
git commit -m "feat(customer-web): fetchTryOnData API helper + tests"
```

---

## WS-G: Privacy Consent

### Task 3: ConsentSheet component (DPDPA-aligned, Hindi+English)

**Files:**
- Create: `apps/customer-web/components/try-on/ConsentSheet.tsx`
- Create: `apps/customer-web/test/try-on-consent-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/customer-web/test/try-on-consent-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConsentSheet } from '../components/try-on/ConsentSheet';

describe('ConsentSheet', () => {
  it('renders consent copy in Hindi', () => {
    render(<ConsentSheet onAgree={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/कैमरा अनुमति/i)).toBeInTheDocument();
    expect(screen.getByText(/डिवाइस पर/i)).toBeInTheDocument();
  });

  it('calls onAgree when agree button is clicked', () => {
    const onAgree = vi.fn();
    render(<ConsentSheet onAgree={onAgree} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /सहमत/i }));
    expect(onAgree).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConsentSheet onAgree={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /रद्द/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('has role=dialog and aria-modal', () => {
    render(<ConsentSheet onAgree={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- try-on-consent-sheet
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ConsentSheet**

Create `apps/customer-web/components/try-on/ConsentSheet.tsx`:

```tsx
'use client';

interface ConsentSheetProps {
  onAgree: () => void;
  onCancel: () => void;
}

export function ConsentSheet({ onAgree, onCancel }: ConsentSheetProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="कैमरा अनुमति सहमति"
      className="flex flex-col items-center justify-center h-full p-8 bg-black"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 flex flex-col gap-5">
        {/* Icon */}
        <div className="flex justify-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-3xl"
            aria-hidden="true"
          >
            💍
          </span>
        </div>

        {/* Hindi-first heading */}
        <div className="text-center">
          <h2 className="font-heading text-xl text-white">ट्राय करके देखें</h2>
          <p className="font-ui text-xs text-white/50 mt-0.5">Try On — Virtual Jewellery</p>
        </div>

        {/* Consent body */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-sm text-white/80 text-center">
            आभूषण पहनकर देखने के लिए हम आपका कैमरा उपयोग करेंगे।
          </p>

          {/* Privacy assurances */}
          <ul className="flex flex-col gap-1.5 mt-1" aria-label="गोपनीयता जानकारी">
            {[
              { hi: 'पूरी तरह डिवाइस पर', en: 'Fully on-device' },
              { hi: 'कोई वीडियो सर्वर पर नहीं जाता', en: 'No video sent to any server' },
              { hi: 'कोई फ़ोटो सेव नहीं होती', en: 'No photo stored' },
            ].map(({ hi, en }) => (
              <li key={hi} className="flex items-start gap-2">
                <span className="text-primary mt-0.5" aria-hidden="true">✓</span>
                <span className="font-body text-sm text-white/80">
                  {hi}
                  <span className="block text-xs text-white/40">{en}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-1">
          <button
            type="button"
            onClick={onAgree}
            className="w-full rounded-lg bg-primary px-4 py-3 font-ui text-sm text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
            aria-label="सहमत हूं — कैमरा खोलें"
          >
            सहमत हूं — कैमरा खोलें
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-white/20 px-4 py-3 font-ui text-sm text-white/70 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/50 transition-colors"
            aria-label="रद्द करें"
          >
            रद्द करें
          </button>
        </div>

        {/* Legal note */}
        <p className="font-body text-xs text-white/30 text-center">
          DPDPA 2023 अनुपालन अनुसार। केवल इस सत्र के लिए।
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- try-on-consent-sheet
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```
git add apps/customer-web/components/try-on/ConsentSheet.tsx apps/customer-web/test/try-on-consent-sheet.test.tsx
git commit -m "feat(try-on): ConsentSheet — DPDPA-aligned Hindi+English consent gate"
```

---

## WS-D: Face Try-On

### Task 4: WS-D — `useFaceDetector` hook

**Files:**
- Create: `apps/customer-web/components/try-on/useFaceDetector.ts`
- Create: `apps/customer-web/test/use-face-detector.test.ts`

The hook lazy-initialises `FaceLandmarker` from self-hosted WASM, returns a `detect` function, and cleans up on unmount. MediaPipe is imported dynamically (`await import(...)`) so it doesn't inflate the initial JS bundle — the detector only loads when the modal is open.

- [ ] **Step 1: Write the failing test**

Create `apps/customer-web/test/use-face-detector.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock @mediapipe/tasks-vision at the module level.
const mockFaceLandmarker = {
  detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [], facialTransformationMatrixes: [] }),
  close: vi.fn(),
};

vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue(mockFaceLandmarker),
  },
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFaceLandmarker.close.mockClear();
  mockFaceLandmarker.detectForVideo.mockClear();
});

describe('useFaceDetector', () => {
  it('starts not ready', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: false }));
    expect(result.current.ready).toBe(false);
  });

  it('becomes ready when enabled=true', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('calls close on cleanup', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result, unmount } = renderHook(() => useFaceDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    unmount();
    expect(mockFaceLandmarker.close).toHaveBeenCalled();
  });

  it('detect() returns null before ready', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: false }));
    const fakeVideo = {} as HTMLVideoElement;
    expect(result.current.detect(fakeVideo, 0)).toBeNull();
  });

  it('detect() delegates to FaceLandmarker.detectForVideo when ready', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const fakeVideo = {} as HTMLVideoElement;
    act(() => { result.current.detect(fakeVideo, 16); });
    expect(mockFaceLandmarker.detectForVideo).toHaveBeenCalledWith(fakeVideo, 16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- use-face-detector
```

Expected: FAIL — `useFaceDetector` module not found.

- [ ] **Step 3: Implement useFaceDetector**

Create `apps/customer-web/components/try-on/useFaceDetector.ts`:

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export interface UseFaceDetectorOptions {
  enabled: boolean;
}

export interface UseFaceDetectorResult {
  ready: boolean;
  detect: (video: HTMLVideoElement, timestamp: number) => FaceLandmarkerResult | null;
}

// Self-hosted paths — populated by scripts/copy-mediapipe-wasm.mjs and
// scripts/download-mediapipe-models.mjs before build.
const WASM_BASE_URL = '/mediapipe/wasm';
const FACE_MODEL_URL = '/mediapipe/face_landmarker.task';

export function useFaceDetector({ enabled }: UseFaceDetectorOptions): UseFaceDetectorResult {
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      if (cancelled) return;
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      if (cancelled) return;
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        refineLandmarks: true,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
      });
      if (cancelled) { landmarker.close(); return; }
      detectorRef.current = landmarker;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
      setReady(false);
    };
  }, [enabled]);

  const detect = (video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult | null => {
    if (!detectorRef.current) return null;
    try {
      return detectorRef.current.detectForVideo(video, timestamp);
    } catch {
      return null;
    }
  };

  return { ready, detect };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- use-face-detector
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```
git add apps/customer-web/components/try-on/useFaceDetector.ts apps/customer-web/test/use-face-detector.test.ts
git commit -m "feat(try-on): useFaceDetector — FaceLandmarker lifecycle with lazy WASM init"
```

---

### Task 5: WS-D — Face overlay renderer

**Files:**
- Create: `apps/customer-web/components/try-on/face-renderer.ts`
- Create: `apps/customer-web/test/face-renderer.test.ts`

Renders earrings (EAR) and necklaces (NECK) over the Canvas 2D context. Mirroring note: the container div in TryOnCanvas applies `transform: scaleX(-1)` so the user sees a natural selfie-camera view. MediaPipe processes the **raw** (unmirrored) frame, so all x-coordinates are flipped before drawing: `drawX = (1 - lm.x) * canvas.width`. `mirrorXIfNeeded(x, true)` from `@goldsmith/try-on-core` handles this.

- [ ] **Step 1: Write the failing test**

Create `apps/customer-web/test/face-renderer.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// Build a landmark array of length 478; fill with (0.5, 0.5, 0).
function faceLandmarks(overrides: Record<number, [number, number]>) {
  const arr = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) {
    arr[Number(i)] = { x, y, z: 0 };
  }
  return arr;
}

function makeResult(lm: ReturnType<typeof faceLandmarks>): FaceLandmarkerResult {
  return {
    faceLandmarks: [lm],
    facialTransformationMatrixes: [
      { data: Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) },
    ],
    faceBlendshapes: [],
  } as unknown as FaceLandmarkerResult;
}

describe('renderFaceOverlay', () => {
  it('calls ctx.drawImage for EAR body part when asset is loaded', () => {
    const { renderFaceOverlay, makeFaceSmooths } = require('../components/try-on/face-renderer');

    const ctx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      font: '',
      fillStyle: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;

    const assetImg = {
      naturalWidth: 100,
      naturalHeight: 150,
      complete: true,
    } as HTMLImageElement;

    const tryOnData = {
      productId: 'p1',
      bodyPart: 'EAR' as const,
      assetUrl: 'https://example.com/earring.png',
      anchorX: 0.5,
      anchorY: 0.0,
      lengthMm: 20,
      widthMm: null,
      diameterMm: null,
      metal: 'GOLD',
      purity: '22K',
      netWeightG: '4.5000',
      trueToSize: true,
    };

    const lm = faceLandmarks({
      10: [0.5, 0.1],   // foreheadTop
      152: [0.5, 0.9],  // chin
      234: [0.35, 0.5], // leftEar
      454: [0.65, 0.5], // rightEar
      468: [0.6, 0.5],  // rightIris
      473: [0.4, 0.5],  // leftIris
    });

    renderFaceOverlay({
      ctx,
      canvas,
      result: makeResult(lm),
      tryOnData,
      assetImg,
      smooths: makeFaceSmooths(),
      timestamp: 16,
    });

    // Both earrings should be drawn (zero yaw → neither hidden)
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it('does not draw when no face detected', () => {
    const { renderFaceOverlay, makeFaceSmooths } = require('../components/try-on/face-renderer');

    const ctx = { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn() } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 100, naturalHeight: 150 } as HTMLImageElement;
    const tryOnData = { productId: 'p1', bodyPart: 'EAR' as const, assetUrl: 'https://x.com/e.png', anchorX: 0.5, anchorY: 0, lengthMm: 20, widthMm: null, diameterMm: null, metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true };

    renderFaceOverlay({
      ctx,
      canvas,
      result: { faceLandmarks: [], facialTransformationMatrixes: [] } as unknown as FaceLandmarkerResult,
      tryOnData,
      assetImg,
      smooths: makeFaceSmooths(),
      timestamp: 16,
    });

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- face-renderer
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement face-renderer**

Create `apps/customer-web/components/try-on/face-renderer.ts`:

```typescript
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import {
  OneEuroFilter,
  normPerMmFace,
  anchorFor,
  resolveAssetWidthNorm,
  decomposePose,
  mirrorXIfNeeded,
  DEFAULT_IPD_MM,
} from '@goldsmith/try-on-core';

// MediaPipe refined face-mesh iris centre indices (478-landmark model).
const IRIS_LEFT = 473;
const IRIS_RIGHT = 468;

// Yaw angle beyond which the far-side earring is hidden (deg→rad).
const YAW_HIDE_RAD = (45 * Math.PI) / 180;

export interface FaceSmooths {
  leftX: OneEuroFilter;
  leftY: OneEuroFilter;
  rightX: OneEuroFilter;
  rightY: OneEuroFilter;
  neckX: OneEuroFilter;
  neckY: OneEuroFilter;
  width: OneEuroFilter;
}

export function makeFaceSmooths(): FaceSmooths {
  const o = { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };
  return {
    leftX: new OneEuroFilter(o), leftY: new OneEuroFilter(o),
    rightX: new OneEuroFilter(o), rightY: new OneEuroFilter(o),
    neckX: new OneEuroFilter(o), neckY: new OneEuroFilter(o),
    width: new OneEuroFilter(o),
  };
}

export interface RenderFaceParams {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  result: FaceLandmarkerResult;
  tryOnData: CatalogTryOnResponse;
  assetImg: HTMLImageElement;
  smooths: FaceSmooths;
  timestamp: number;
}

export function renderFaceOverlay({
  ctx, canvas, result, tryOnData, assetImg, smooths, timestamp,
}: RenderFaceParams): void {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks || landmarks.length < 478) return;

  const t = timestamp / 1000; // seconds for OneEuroFilter

  // Scale: IPD from iris landmarks
  const normPerMm = normPerMmFace(landmarks[IRIS_LEFT], landmarks[IRIS_RIGHT], DEFAULT_IPD_MM);

  // Asset width in normalised units, using real mm dimension when present
  const { widthNorm, trueToSize } = resolveAssetWidthNorm(
    {
      dimensions: {
        lengthMm: tryOnData.lengthMm ?? undefined,
        widthMm: tryOnData.widthMm ?? undefined,
        diameterMm: tryOnData.diameterMm ?? undefined,
      },
      metal: tryOnData.metal,
      purity: tryOnData.purity,
      netWeightG: Number(tryOnData.netWeightG),
    },
    normPerMm,
    tryOnData.bodyPart,
  );

  const smoothedWidth = smooths.width.filter(widthNorm, t);
  const assetWidthPx = smoothedWidth * canvas.width;
  const assetHeightPx =
    assetImg.naturalHeight > 0
      ? assetWidthPx * (assetImg.naturalHeight / assetImg.naturalWidth)
      : assetWidthPx;

  // Pose from facial transformation matrix (column-major 16 floats)
  let rollRad = 0;
  let yawRad = 0;
  const matrices = result.facialTransformationMatrixes;
  if (matrices && matrices.length > 0 && matrices[0]?.data) {
    const pose = decomposePose(Array.from(matrices[0].data));
    rollRad = pose.rollRad;
    yawRad = pose.yawRad;
  }

  if (tryOnData.bodyPart === 'EAR') {
    // Container is CSS scaleX(-1) so the user sees a mirrored view.
    // MediaPipe sees the raw frame; flip x with mirrorXIfNeeded before drawing.
    // User's left ear = camera's right = FACE_INDEX.rightEar (454) in raw frame.
    // User's right ear = camera's left = FACE_INDEX.leftEar (234) in raw frame.

    // User's left earring — hidden when face turns too far right (yaw > threshold)
    const hideLeft = yawRad > YAW_HIDE_RAD;
    if (!hideLeft) {
      const raw = anchorFor('EAR', landmarks, { side: 'right' });
      const ax = smooths.leftX.filter(mirrorXIfNeeded(raw.x, true), t) * canvas.width;
      const ay = smooths.leftY.filter(raw.y, t) * canvas.height;
      drawJewellery(ctx, assetImg, ax, ay, assetWidthPx, assetHeightPx, tryOnData, rollRad);
    }

    // User's right earring — hidden when face turns too far left (yaw < -threshold)
    const hideRight = yawRad < -YAW_HIDE_RAD;
    if (!hideRight) {
      const raw = anchorFor('EAR', landmarks, { side: 'left' });
      const ax = smooths.rightX.filter(mirrorXIfNeeded(raw.x, true), t) * canvas.width;
      const ay = smooths.rightY.filter(raw.y, t) * canvas.height;
      drawJewellery(ctx, assetImg, ax, ay, assetWidthPx, assetHeightPx, tryOnData, rollRad);
    }
  } else if (tryOnData.bodyPart === 'NECK') {
    const raw = anchorFor('NECK', landmarks, {});
    const ax = smooths.neckX.filter(mirrorXIfNeeded(raw.x, true), t) * canvas.width;
    const ay = smooths.neckY.filter(raw.y, t) * canvas.height;
    // Necklace hangs gravity-down — no rotation with head roll
    drawJewellery(ctx, assetImg, ax, ay, assetWidthPx, assetHeightPx, tryOnData, 0);
  }

  if (!trueToSize) drawApproxBadge(ctx, canvas);
}

function drawJewellery(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  anchorPxX: number,
  anchorPxY: number,
  widthPx: number,
  heightPx: number,
  tryOnData: CatalogTryOnResponse,
  rotRad: number,
): void {
  ctx.save();
  ctx.translate(anchorPxX, anchorPxY);
  ctx.rotate(rotRad);
  ctx.drawImage(
    img,
    -tryOnData.anchorX * widthPx,
    -tryOnData.anchorY * heightPx,
    widthPx,
    heightPx,
  );
  ctx.restore();
}

function drawApproxBadge(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const label = 'अनुमानित आकार';
  const padding = 8;
  const w = 150;
  ctx.fillRect(padding, canvas.height - 32, w, 22);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, padding + 6, canvas.height - 16);
  ctx.restore();
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- face-renderer
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```
git add apps/customer-web/components/try-on/face-renderer.ts apps/customer-web/test/face-renderer.test.ts
git commit -m "feat(try-on): Canvas 2D face overlay renderer — earring + necklace placement"
```

---

## WS-E: Hand Try-On

### Task 6: WS-E — `useHandDetector` hook

**Files:**
- Create: `apps/customer-web/components/try-on/useHandDetector.ts`
- Create: `apps/customer-web/test/use-hand-detector.test.ts`

Mirrors `useFaceDetector` exactly — same lifecycle pattern, different MediaPipe class (`HandLandmarker`).

- [ ] **Step 1: Write the failing test**

Create `apps/customer-web/test/use-hand-detector.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockHandLandmarker = {
  detectForVideo: vi.fn().mockReturnValue({ landmarks: [], worldLandmarks: [], handedness: [] }),
  close: vi.fn(),
};

vi.mock('@mediapipe/tasks-vision', () => ({
  HandLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue(mockHandLandmarker),
  },
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => { vi.clearAllMocks(); });

describe('useHandDetector', () => {
  it('starts not ready', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result } = renderHook(() => useHandDetector({ enabled: false }));
    expect(result.current.ready).toBe(false);
  });

  it('becomes ready when enabled=true', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result } = renderHook(() => useHandDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('calls close on unmount', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result, unmount } = renderHook(() => useHandDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    unmount();
    expect(mockHandLandmarker.close).toHaveBeenCalled();
  });

  it('detect() delegates to HandLandmarker.detectForVideo when ready', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result } = renderHook(() => useHandDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const fakeVideo = {} as HTMLVideoElement;
    act(() => { result.current.detect(fakeVideo, 16); });
    expect(mockHandLandmarker.detectForVideo).toHaveBeenCalledWith(fakeVideo, 16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- use-hand-detector
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useHandDetector**

Create `apps/customer-web/components/try-on/useHandDetector.ts`:

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export interface UseHandDetectorOptions {
  enabled: boolean;
}

export interface UseHandDetectorResult {
  ready: boolean;
  detect: (video: HTMLVideoElement, timestamp: number) => HandLandmarkerResult | null;
}

const WASM_BASE_URL = '/mediapipe/wasm';
const HAND_MODEL_URL = '/mediapipe/hand_landmarker.task';

export function useHandDetector({ enabled }: UseHandDetectorOptions): UseHandDetectorResult {
  const detectorRef = useRef<HandLandmarker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      if (cancelled) return;
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      if (cancelled) return;
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
      if (cancelled) { landmarker.close(); return; }
      detectorRef.current = landmarker;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
      setReady(false);
    };
  }, [enabled]);

  const detect = (video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
    if (!detectorRef.current) return null;
    try {
      return detectorRef.current.detectForVideo(video, timestamp);
    } catch {
      return null;
    }
  };

  return { ready, detect };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- use-hand-detector
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```
git add apps/customer-web/components/try-on/useHandDetector.ts apps/customer-web/test/use-hand-detector.test.ts
git commit -m "feat(try-on): useHandDetector — HandLandmarker lifecycle"
```

---

### Task 7: WS-E — Hand overlay renderer

**Files:**
- Create: `apps/customer-web/components/try-on/hand-renderer.ts`
- Create: `apps/customer-web/test/hand-renderer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/customer-web/test/hand-renderer.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';

function handLandmarks(overrides: Record<number, [number, number]>) {
  const arr = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) arr[Number(i)] = { x, y, z: 0 };
  return arr;
}

function makeHandResult(lm: ReturnType<typeof handLandmarks>): HandLandmarkerResult {
  return { landmarks: [lm], worldLandmarks: [], handedness: [{ categories: [{ categoryName: 'Right', score: 0.9, index: 0, displayName: 'Right' }] }] } as unknown as HandLandmarkerResult;
}

describe('renderHandOverlay', () => {
  it('draws the ring asset for FINGER body part', () => {
    const { renderHandOverlay, makeHandSmooths } = require('../components/try-on/hand-renderer');

    const ctx = {
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
      rotate: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(),
      fillText: vi.fn(), font: '', fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 80, naturalHeight: 40 } as HTMLImageElement;
    const tryOnData = {
      productId: 'p1', bodyPart: 'FINGER' as const,
      assetUrl: 'https://x.com/ring.png', anchorX: 0.5, anchorY: 0.5,
      lengthMm: null, widthMm: null, diameterMm: 16,
      metal: 'GOLD', purity: '22K', netWeightG: '3.0', trueToSize: true,
    };

    const lm = handLandmarks({
      0: [0.5, 0.8], 5: [0.4, 0.4], 9: [0.5, 0.35],
      13: [0.48, 0.5], 14: [0.47, 0.4], 17: [0.6, 0.45],
    });

    renderHandOverlay({ ctx, canvas, result: makeHandResult(lm), tryOnData, assetImg, smooths: makeHandSmooths(), timestamp: 16 });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('does not draw when no hand detected', () => {
    const { renderHandOverlay, makeHandSmooths } = require('../components/try-on/hand-renderer');
    const ctx = { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn() } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 80, naturalHeight: 40 } as HTMLImageElement;
    const tryOnData = { productId: 'p1', bodyPart: 'FINGER' as const, assetUrl: 'https://x.com/ring.png', anchorX: 0.5, anchorY: 0.5, lengthMm: null, widthMm: null, diameterMm: 16, metal: 'GOLD', purity: '22K', netWeightG: '3.0', trueToSize: true };

    renderHandOverlay({ ctx, canvas, result: { landmarks: [], worldLandmarks: [], handedness: [] } as unknown as HandLandmarkerResult, tryOnData, assetImg, smooths: makeHandSmooths(), timestamp: 16 });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- hand-renderer
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement hand-renderer**

Create `apps/customer-web/components/try-on/hand-renderer.ts`:

```typescript
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import {
  OneEuroFilter,
  normPerMmHand,
  anchorFor,
  resolveAssetWidthNorm,
  mirrorXIfNeeded,
  HAND_INDEX,
} from '@goldsmith/try-on-core';

// Ring-finger proximal segment (MCP→PIP) assumed length in mm.
const RING_SEGMENT_MM = 20;
// Metacarpal span (index MCP to pinky MCP) assumed in mm.
const METACARPAL_MM = 70;

export interface HandSmooths {
  x: OneEuroFilter;
  y: OneEuroFilter;
  width: OneEuroFilter;
  rotation: OneEuroFilter;
}

export function makeHandSmooths(): HandSmooths {
  const o = { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };
  return {
    x: new OneEuroFilter(o),
    y: new OneEuroFilter(o),
    width: new OneEuroFilter(o),
    rotation: new OneEuroFilter(o),
  };
}

export interface RenderHandParams {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  result: HandLandmarkerResult;
  tryOnData: CatalogTryOnResponse;
  assetImg: HTMLImageElement;
  smooths: HandSmooths;
  timestamp: number;
}

export function renderHandOverlay({
  ctx, canvas, result, tryOnData, assetImg, smooths, timestamp,
}: RenderHandParams): void {
  const landmarks = result.landmarks[0];
  if (!landmarks || landmarks.length < 21) return;

  const t = timestamp / 1000;

  if (tryOnData.bodyPart === 'FINGER') {
    const mcp = landmarks[HAND_INDEX.ringMcp]; // index 13
    const pip = landmarks[HAND_INDEX.ringPip]; // index 14

    // Scale from ring-finger MCP→PIP segment length vs known ~20mm
    const normPerMm = normPerMmHand(mcp, pip, RING_SEGMENT_MM);
    const { widthNorm, trueToSize } = resolveAssetWidthNorm(
      {
        dimensions: {
          diameterMm: tryOnData.diameterMm ?? undefined,
          widthMm: tryOnData.widthMm ?? undefined,
          lengthMm: tryOnData.lengthMm ?? undefined,
        },
        metal: tryOnData.metal,
        purity: tryOnData.purity,
        netWeightG: Number(tryOnData.netWeightG),
      },
      normPerMm,
      'FINGER',
    );

    const anchorRaw = anchorFor('FINGER', landmarks, {});
    // Ring band rotation = perpendicular to finger axis
    const fingerRotRaw = Math.atan2(pip.y - mcp.y, pip.x - mcp.x);
    const rotRad = fingerRotRaw + Math.PI / 2;

    const sw = smooths.width.filter(widthNorm, t);
    const ax = smooths.x.filter(mirrorXIfNeeded(anchorRaw.x, true), t) * canvas.width;
    const ay = smooths.y.filter(anchorRaw.y, t) * canvas.height;
    const sr = smooths.rotation.filter(rotRad, t);
    const assetWidthPx = sw * canvas.width;
    const assetHeightPx =
      assetImg.naturalHeight > 0
        ? assetWidthPx * (assetImg.naturalHeight / assetImg.naturalWidth)
        : assetWidthPx;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(sr);
    ctx.drawImage(
      assetImg,
      -tryOnData.anchorX * assetWidthPx,
      -tryOnData.anchorY * assetHeightPx,
      assetWidthPx,
      assetHeightPx,
    );
    ctx.restore();

    if (!trueToSize) drawApproxBadge(ctx, canvas);

  } else if (tryOnData.bodyPart === 'WRIST') {
    // Scale from metacarpal span (index MCP 5 to pinky MCP 17) vs known ~70mm
    const normPerMm = normPerMmHand(landmarks[5], landmarks[17], METACARPAL_MM);
    const { widthNorm, trueToSize } = resolveAssetWidthNorm(
      {
        dimensions: {
          diameterMm: tryOnData.diameterMm ?? undefined,
          widthMm: tryOnData.widthMm ?? undefined,
          lengthMm: tryOnData.lengthMm ?? undefined,
        },
        metal: tryOnData.metal,
        purity: tryOnData.purity,
        netWeightG: Number(tryOnData.netWeightG),
      },
      normPerMm,
      'WRIST',
    );

    const anchorRaw = anchorFor('WRIST', landmarks, {});
    // Bangle orientation = perpendicular to wrist→mid-MCP vector
    const midMcp = landmarks[9];
    const wristRotRaw = Math.atan2(midMcp.y - anchorRaw.y, midMcp.x - anchorRaw.x);
    const rotRad = wristRotRaw + Math.PI / 2;

    const sw = smooths.width.filter(widthNorm, t);
    const ax = smooths.x.filter(mirrorXIfNeeded(anchorRaw.x, true), t) * canvas.width;
    const ay = smooths.y.filter(anchorRaw.y, t) * canvas.height;
    const sr = smooths.rotation.filter(rotRad, t);
    const assetWidthPx = sw * canvas.width;
    const assetHeightPx =
      assetImg.naturalHeight > 0
        ? assetWidthPx * (assetImg.naturalHeight / assetImg.naturalWidth)
        : assetWidthPx;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(sr);
    ctx.drawImage(
      assetImg,
      -tryOnData.anchorX * assetWidthPx,
      -tryOnData.anchorY * assetHeightPx,
      assetWidthPx,
      assetHeightPx,
    );
    ctx.restore();

    if (!trueToSize) drawApproxBadge(ctx, canvas);
  }
}

function drawApproxBadge(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(8, canvas.height - 32, 150, 22);
  ctx.fillStyle = '#fff';
  ctx.fillText('अनुमानित आकार', 14, canvas.height - 16);
  ctx.restore();
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- hand-renderer
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```
git add apps/customer-web/components/try-on/hand-renderer.ts apps/customer-web/test/hand-renderer.test.ts
git commit -m "feat(try-on): Canvas 2D hand overlay renderer — ring + bangle placement"
```

---

### Task 8: WS-F — `TryOnCanvas` (rAF loop, video + canvas elements)

**Files:**
- Create: `apps/customer-web/components/try-on/TryOnCanvas.tsx`
- Create: `apps/customer-web/test/try-on-canvas.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/customer-web/test/try-on-canvas.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Stub MediaPipe hooks — we test only the canvas wiring, not the detectors
vi.mock('../components/try-on/useFaceDetector', () => ({
  useFaceDetector: () => ({ ready: false, detect: vi.fn() }),
}));
vi.mock('../components/try-on/useHandDetector', () => ({
  useHandDetector: () => ({ ready: false, detect: vi.fn() }),
}));

// Stub renderers
vi.mock('../components/try-on/face-renderer', () => ({
  makeFaceSmooths: () => ({}),
  renderFaceOverlay: vi.fn(),
}));
vi.mock('../components/try-on/hand-renderer', () => ({
  makeHandSmooths: () => ({}),
  renderHandOverlay: vi.fn(),
}));

const STREAM = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

const EAR_DATA = {
  productId: 'p1', bodyPart: 'EAR' as const,
  assetUrl: 'https://x.com/e.png', anchorX: 0.5, anchorY: 0,
  lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

describe('TryOnCanvas', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders a video and canvas element', async () => {
    const { TryOnCanvas } = await import('../components/try-on/TryOnCanvas');
    const { container } = render(
      <TryOnCanvas stream={STREAM} tryOnData={EAR_DATA} onDetectorReady={vi.fn()} />,
    );
    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('calls onDetectorReady when the face detector becomes ready', async () => {
    // Override hook to be ready
    const readyMock = vi.fn();
    vi.doMock('../components/try-on/useFaceDetector', () => ({
      useFaceDetector: () => ({ ready: true, detect: vi.fn() }),
    }));
    const { TryOnCanvas } = await import('../components/try-on/TryOnCanvas');
    render(<TryOnCanvas stream={STREAM} tryOnData={EAR_DATA} onDetectorReady={readyMock} />);
    expect(readyMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- try-on-canvas
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TryOnCanvas**

Create `apps/customer-web/components/try-on/TryOnCanvas.tsx`:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import { useFaceDetector } from './useFaceDetector';
import { useHandDetector } from './useHandDetector';
import { renderFaceOverlay, makeFaceSmooths, type FaceSmooths } from './face-renderer';
import { renderHandOverlay, makeHandSmooths, type HandSmooths } from './hand-renderer';

interface TryOnCanvasProps {
  stream: MediaStream;
  tryOnData: CatalogTryOnResponse;
  onDetectorReady: () => void;
}

export function TryOnCanvas({ stream, tryOnData, onDetectorReady }: TryOnCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const faceSmooths = useRef<FaceSmooths>(makeFaceSmooths());
  const handSmooths = useRef<HandSmooths>(makeHandSmooths());

  const isFace = tryOnData.bodyPart === 'EAR' || tryOnData.bodyPart === 'NECK';
  const isHand = tryOnData.bodyPart === 'FINGER' || tryOnData.bodyPart === 'WRIST';

  const { ready: faceReady, detect: detectFace } = useFaceDetector({ enabled: isFace });
  const { ready: handReady, detect: detectHand } = useHandDetector({ enabled: isHand });

  const detectorReady = isFace ? faceReady : handReady;

  // Connect the camera stream to the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play();
  }, [stream]);

  // Load the transparent-PNG cutout asset
  useEffect(() => {
    if (!tryOnData.assetUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { assetImgRef.current = img; };
    img.src = tryOnData.assetUrl;
  }, [tryOnData.assetUrl]);

  // Notify parent when detector is ready (triggers transition from 'loading' → 'active')
  useEffect(() => {
    if (detectorReady) onDetectorReady();
  }, [detectorReady, onDetectorReady]);

  // requestAnimationFrame loop — runs only after the detector is ready
  useEffect(() => {
    if (!detectorReady) return;
    let running = true;

    function loop(timestamp: number) {
      if (!running) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (video && canvas && ctx && video.readyState >= 2) {
        // Keep canvas pixel dimensions in sync with the video resolution
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const assetImg = assetImgRef.current;

        if (assetImg) {
          if (isFace) {
            const result = detectFace(video, timestamp);
            if (result && result.faceLandmarks.length > 0) {
              renderFaceOverlay({
                ctx, canvas, result, tryOnData,
                assetImg, smooths: faceSmooths.current, timestamp,
              });
            }
          } else if (isHand) {
            const result = detectHand(video, timestamp);
            if (result && result.landmarks.length > 0) {
              renderHandOverlay({
                ctx, canvas, result, tryOnData,
                assetImg, smooths: handSmooths.current, timestamp,
              });
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [detectorReady, isFace, isHand, tryOnData, detectFace, detectHand]);

  return (
    // scaleX(-1): mirror the whole view so it feels like a selfie camera.
    // MediaPipe processes the raw (unmirrored) feed; renderers flip x via mirrorXIfNeeded.
    <div className="relative w-full h-full" style={{ transform: 'scaleX(-1)' }}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- try-on-canvas
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```
git add apps/customer-web/components/try-on/TryOnCanvas.tsx apps/customer-web/test/try-on-canvas.test.tsx
git commit -m "feat(try-on): TryOnCanvas — rAF loop with face/hand detector routing"
```

---

### Task 9: WS-F — `TryOnModal` + `TryOnButton` + PDP integration

**Files:**
- Create: `apps/customer-web/components/try-on/TryOnModal.tsx`
- Create: `apps/customer-web/components/try-on/TryOnButton.tsx`
- Modify: `apps/customer-web/app/products/[id]/page.tsx`
- Create: `apps/customer-web/test/try-on-modal.test.tsx`
- Create: `apps/customer-web/test/try-on-button.test.tsx`

- [ ] **Step 1: Write the failing TryOnModal test**

Create `apps/customer-web/test/try-on-modal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Stub heavy sub-components
vi.mock('../components/try-on/ConsentSheet', () => ({
  ConsentSheet: ({ onAgree, onCancel }: { onAgree: () => void; onCancel: () => void }) => (
    <div data-testid="consent-sheet">
      <button onClick={onAgree}>सहमत हूं</button>
      <button onClick={onCancel}>रद्द करें</button>
    </div>
  ),
}));

vi.mock('../components/try-on/TryOnCanvas', () => ({
  TryOnCanvas: ({ onDetectorReady }: { onDetectorReady: () => void }) => {
    onDetectorReady();
    return <div data-testid="try-on-canvas" />;
  },
}));

// Stub getUserMedia: denied by default
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
});

const TRY_ON_DATA = {
  productId: 'p1', bodyPart: 'EAR' as const,
  assetUrl: 'https://x.com/e.png', anchorX: 0.5, anchorY: 0,
  lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockGetUserMedia.mockRejectedValue(new Error('denied'));
});

describe('TryOnModal', () => {
  it('shows consent sheet on first open', async () => {
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    expect(screen.getByTestId('consent-sheet')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows denied state when camera permission refused', async () => {
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('सहमत हूं'));
    await waitFor(() => {
      expect(screen.getByText(/कैमरा अनुमति नहीं मिली/)).toBeInTheDocument();
    });
  });

  it('shows canvas after camera granted and detector ready', async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    mockGetUserMedia.mockResolvedValueOnce(fakeStream);
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('सहमत हूं'));
    await waitFor(() => {
      expect(screen.getByTestId('try-on-canvas')).toBeInTheDocument();
    });
  });

  it('has role=dialog and aria-modal', async () => {
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- try-on-modal
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TryOnModal**

Create `apps/customer-web/components/try-on/TryOnModal.tsx`:

```tsx
'use client';
import { useState, useCallback, useEffect } from 'react';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import { ConsentSheet } from './ConsentSheet';
import { TryOnCanvas } from './TryOnCanvas';

type ModalState = 'consent' | 'requesting' | 'loading' | 'active' | 'denied';

interface TryOnModalProps {
  tryOnData: CatalogTryOnResponse;
  onClose: () => void;
}

export function TryOnModal({ tryOnData, onClose }: TryOnModalProps) {
  const [modalState, setModalState] = useState<ModalState>(() =>
    // Skip consent screen if user already agreed this browser session
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tryon-consent') === '1'
      ? 'requesting'
      : 'consent',
  );
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Esc key closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent background scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Stop camera tracks when the modal unmounts
  useEffect(() => {
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [stream]);

  const requestCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(s);
      setModalState('loading');
    } catch {
      setModalState('denied');
    }
  }, []);

  // If consent was already given this session, request camera on mount
  useEffect(() => {
    if (modalState === 'requesting') void requestCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConsent = useCallback(() => {
    sessionStorage.setItem('tryon-consent', '1');
    void requestCamera();
  }, [requestCamera]);

  const handleDetectorReady = useCallback(() => {
    setModalState('active');
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="आभूषण ट्राय करें"
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 pointer-events-none">
        <span className="font-ui text-sm text-white/70 select-none">✦ ट्राय करके देखें</span>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-xl leading-none hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white transition-colors"
          aria-label="बंद करें"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {modalState === 'consent' && (
          <ConsentSheet onAgree={handleConsent} onCancel={onClose} />
        )}

        {modalState === 'requesting' && (
          <div className="flex h-full items-center justify-center">
            <p className="font-ui text-sm text-white/70" role="status">
              कैमरा खोल रहे हैं…
            </p>
          </div>
        )}

        {(modalState === 'loading' || modalState === 'active') && stream && (
          <>
            <TryOnCanvas
              stream={stream}
              tryOnData={tryOnData}
              onDetectorReady={handleDetectorReady}
            />
            {modalState === 'loading' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60">
                <div
                  className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin"
                  aria-hidden="true"
                />
                <p className="font-ui text-sm text-white/70 mt-3" role="status">
                  तैयार हो रहे हैं…
                </p>
              </div>
            )}
          </>
        )}

        {modalState === 'denied' && (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
            <span className="text-4xl" aria-hidden="true">📷</span>
            <p className="font-body text-sm text-white/80 text-center">
              कैमरा अनुमति नहीं मिली। ब्राउज़र सेटिंग्स में कैमरा अनुमति दें और फिर से प्रयास करें।
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary px-6 py-3 font-ui text-sm text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
            >
              वापस जाएं
            </button>
          </div>
        )}
      </div>

      {/* Size indicator (bottom of screen, visible during active) */}
      {modalState === 'active' && !tryOnData.trueToSize && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <span className="rounded-pill bg-black/60 px-3 py-1 font-ui text-xs text-white/80">
            अनुमानित आकार — Approximate size
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run TryOnModal test to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- try-on-modal
```

Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing TryOnButton test**

Create `apps/customer-web/test/try-on-button.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../app/TenantContext', () => ({
  useTenant: () => ({
    shopId: '00000000-0000-4000-8000-000000000001',
    appName: 'Test',
    primaryColor: '#B8860B',
    logoUrl: null,
    defaultLanguage: 'hi',
  }),
}));

const mockFetchTryOnData = vi.fn();
vi.mock('../lib/api', async () => {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...real, fetchTryOnData: mockFetchTryOnData };
});

vi.mock('../components/try-on/TryOnModal', () => ({
  TryOnModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="try-on-modal">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

const MOCK_DATA = {
  productId: 'p1', bodyPart: 'EAR', assetUrl: 'https://x.com/e.png',
  anchorX: 0.5, anchorY: 0, lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('TryOnButton', () => {
  it('renders the try-on button', async () => {
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    expect(screen.getByRole('button', { name: /ट्राय/i })).toBeInTheDocument();
  });

  it('opens the modal when try-on data is available', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(MOCK_DATA);
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /ट्राय/i }));
    await waitFor(() => {
      expect(screen.getByTestId('try-on-modal')).toBeInTheDocument();
    });
  });

  it('shows unavailable message when no try-on data', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(null);
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /ट्राय/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('closes the modal when onClose is called', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(MOCK_DATA);
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /ट्राय/i }));
    await waitFor(() => screen.getByTestId('try-on-modal'));
    fireEvent.click(screen.getByText('close'));
    await waitFor(() => {
      expect(screen.queryByTestId('try-on-modal')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```
pnpm --filter @goldsmith/customer-web test -- try-on-button
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement TryOnButton**

Create `apps/customer-web/components/try-on/TryOnButton.tsx`:

```tsx
'use client';
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { fetchTryOnData } from '@/lib/api';
import type { CatalogTryOnResponse } from '@/lib/api';
import { useTenant } from '@/app/TenantContext';

// Lazy-load TryOnModal — it pulls in @mediapipe/tasks-vision (heavy dep).
// `ssr: false` prevents Next.js from running MediaPipe on the server.
const TryOnModal = dynamic(
  () => import('./TryOnModal').then((m) => m.TryOnModal),
  { ssr: false },
);

interface TryOnButtonProps {
  productId: string;
}

type BtnState = 'idle' | 'loading' | 'open' | 'unavailable';

export function TryOnButton({ productId }: TryOnButtonProps) {
  const tenant = useTenant();
  const shopId = tenant?.shopId ?? '';
  const [btnState, setBtnState] = useState<BtnState>('idle');
  const [tryOnData, setTryOnData] = useState<CatalogTryOnResponse | null>(null);

  const handleClick = useCallback(async () => {
    if (btnState === 'loading' || btnState === 'open') return;
    setBtnState('loading');
    const data = await fetchTryOnData(productId, shopId);
    if (!data || !data.assetUrl) {
      setBtnState('unavailable');
      return;
    }
    setTryOnData(data);
    setBtnState('open');
  }, [productId, shopId, btnState]);

  const handleClose = useCallback(() => {
    setBtnState('idle');
    setTryOnData(null);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={btnState === 'loading'}
        className="w-full rounded-md bg-primary border border-primary px-6 py-3 font-ui text-white text-center hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary transition-colors disabled:opacity-60"
        aria-label="ट्राय करके देखें — आभूषण पहनकर देखें"
      >
        {btnState === 'loading' ? 'लोड हो रहा है…' : '✦ ट्राय करके देखें'}
      </button>

      {btnState === 'unavailable' && (
        <p
          role="alert"
          className="mt-1 text-center font-ui text-xs text-inkMute"
        >
          इस उत्पाद के लिए ट्राय-ऑन उपलब्ध नहीं है
        </p>
      )}

      {btnState === 'open' && tryOnData && (
        <TryOnModal tryOnData={tryOnData} onClose={handleClose} />
      )}
    </>
  );
}
```

- [ ] **Step 8: Wire TryOnButton into the product detail page**

In `apps/customer-web/app/products/[id]/page.tsx`:

Add the import at the top of the file (alongside other component imports):

```typescript
import { TryOnButton } from '@/components/try-on/TryOnButton';
```

Locate the Primary CTAs block at lines 236–247 (the `<div className="flex flex-col gap-3 border-t...">`). Add `<TryOnButton>` **above** the WishlistButton so it is visually prominent:

```tsx
{/* Primary CTAs */}
{!isUnavailable && (
  <div className="flex flex-col gap-3 border-t border-borderSubtle pt-4">
    {/* Virtual try-on — prominent CTA */}
    <TryOnButton productId={product.id} />

    <WishlistButton productId={product.id} productName={displayPurity} />
    <a
      href={`/try-at-home?product=${product.id}`}
      className="w-full rounded-md border border-primary bg-primary/5 px-6 py-3 font-ui text-primary text-center hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
      aria-label={`${displayPurity} — घर पर कोशिश करने की जानकारी`}
    >
      घर पर ट्राय करें
    </a>
  </div>
)}
```

- [ ] **Step 9: Run the TryOnButton test + full test suite**

```
pnpm --filter @goldsmith/customer-web test -- try-on-button
pnpm --filter @goldsmith/customer-web typecheck
```

Expected: TryOnButton PASS (4 tests); typecheck PASS.

- [ ] **Step 10: Commit**

```
git add apps/customer-web/components/try-on/TryOnModal.tsx apps/customer-web/components/try-on/TryOnButton.tsx apps/customer-web/app/products/[id]/page.tsx apps/customer-web/test/try-on-modal.test.tsx apps/customer-web/test/try-on-button.test.tsx
git commit -m "feat(try-on): TryOnModal + TryOnButton + PDP integration — fullscreen camera try-on"
```

---

## WS-H: Gate

### Task 10: Semgrep no-egress rule + full CI gate

**Files:**
- Create: `ops/semgrep/no-try-on-egress.yaml`
- Create: `ops/semgrep/tests/no-try-on-egress-test.tsx`

This rule enforces the DPDPA invariant: no direct `fetch` calls in the `try-on/` component directory. All API calls go through `lib/api.ts`. This prevents a camera frame from accidentally being uploaded via a raw `fetch` inside a try-on component.

- [ ] **Step 1: Write the Semgrep rule**

Create `ops/semgrep/no-try-on-egress.yaml`:

```yaml
rules:
  - id: goldsmith.no-try-on-direct-network
    languages: [typescript, javascript]
    severity: ERROR
    message: |
      Direct network calls (fetch, XMLHttpRequest, WebSocket) are not allowed in
      try-on components. All API calls must go through lib/api.ts. This enforces
      the DPDPA invariant that no camera frame or landmark data leaves the device.
    pattern-either:
      - pattern: fetch(...)
      - pattern: new XMLHttpRequest()
      - pattern: new WebSocket(...)
    paths:
      include:
        - "apps/customer-web/components/try-on/**"
      exclude:
        - "**/*.spec.ts"
        - "**/*.spec.tsx"
        - "**/*.test.ts"
        - "**/*.test.tsx"
```

- [ ] **Step 2: Write the Semgrep test fixture**

Create `ops/semgrep/tests/no-try-on-egress-test.tsx`:

```tsx
// ruleid: goldsmith.no-try-on-direct-network
fetch('/api/v1/some-endpoint');

// ruleid: goldsmith.no-try-on-direct-network
new XMLHttpRequest();

// ruleid: goldsmith.no-try-on-direct-network
new WebSocket('wss://example.com');

// ok: allowed via lib/api.ts (not a direct call — this test file is excluded)
// The above patterns must trigger in component files but not in test files.
```

- [ ] **Step 3: Verify the Semgrep rule passes on current codebase**

```
pnpm semgrep
```

Expected: no new violations (the try-on components we wrote use no raw `fetch`).

- [ ] **Step 4: Run the full pre-push gate**

```
pnpm typecheck
pnpm lint
pnpm test:ci
```

Expected: all green — typecheck + lint + unit + integration + tenant-isolation + semgrep + docs:validate.

If `test:ci` fails on a specific test, investigate and fix before proceeding. The most likely failures are:
- Missing `@goldsmith/try-on-core` in `packages/customer-web/tsconfig.json` path aliases — check `transpilePackages` is set (done in Task 1).
- MediaPipe import errors in test environment — all MediaPipe imports are in the `useFaceDetector`/`useHandDetector` hooks which are mocked in tests.

- [ ] **Step 5: Regenerate agent-context docs**

```
pnpm docs:context
pnpm docs:validate
```

Expected: regenerates cleanly, validates without errors.

- [ ] **Step 6: Commit**

```
git add ops/semgrep/no-try-on-egress.yaml ops/semgrep/tests/no-try-on-egress-test.tsx docs/agent-context
git commit -m "feat(try-on): semgrep no-try-on-egress rule; regenerate agent-context"
```

---

## Self-Review (completed by plan author)

**1. Spec coverage — WS-D, WS-E, WS-F, WS-G, WS-H:**

| Spec item | Task covering it |
|---|---|
| WS-D FaceLandmarker, Canvas 2D overlay | Tasks 4–5 |
| WS-D earring + necklace, yaw threshold, approximate-size badge | Task 5 |
| WS-E HandLandmarker, ring + bangle | Tasks 6–7 |
| WS-F TryOnButton on PDP, modal shell | Task 9 |
| WS-F lazy-loaded WASM bundle | Task 9 (`next/dynamic ssr:false`) |
| WS-F camera → loading → active states | Task 9 |
| WS-G DPDPA consent, Hindi+English, just-in-time, session-persistent | Task 3 |
| WS-G camera-denial fallback | Task 9 |
| WS-G no camera frame sent to server | Task 10 (semgrep rule) |
| WS-H full gate (typecheck+lint+test:ci) | Task 10 |
| Privacy: Permissions-Policy camera=(self) | Task 1 |
| Privacy: WASM CSP wasm-unsafe-eval | Task 1 |
| WCAG AA: role=dialog, aria-modal, Esc-dismiss | Tasks 3, 9 |
| White-label theming | CSS vars via Tailwind (`bg-primary`, `text-primary`) |
| Self-hosted WASM (no CDN) | Task 1 |
| OneEuroFilter smoothing per anchor | Tasks 5 + 7 (`makeFaceSmooths`, `makeHandSmooths`) |

**Scheduling gap (not silent):** The shopkeeper admin UI for entering mm dimensions + nudging the anchor (`apps/shopkeeper/app/inventory/{new,[id]/edit,[id]/images}.tsx`) is WS-A UI work deferred to Plan 3. It is required before products will have real mm dimensions and true-to-size rendering — without it, all products render in the approximate-size fallback path. Plan 3 must include this as the first work stream.

**2. Placeholder scan:** No TBD/TODO/"handle later" patterns. Every code step is complete. The download script references known-stable Google Storage URLs for MediaPipe models; if Google rotates these, update the URL in `scripts/download-mediapipe-models.mjs` and re-run.

**3. Type consistency:**

- `CatalogTryOnResponse.bodyPart: 'EAR' | 'NECK' | 'FINGER' | 'WRIST'` — used consistently across `face-renderer.ts` (`'EAR'`, `'NECK'` branches), `hand-renderer.ts` (`'FINGER'`, `'WRIST'` branches), `TryOnCanvas.tsx` (`isFace`/`isHand` checks), and `TryOnButton.tsx` (pass-through).
- `FaceSmooths` type exported from `face-renderer.ts` and consumed in `TryOnCanvas.tsx` via `useRef<FaceSmooths>`.
- `HandSmooths` type exported from `hand-renderer.ts` and consumed in `TryOnCanvas.tsx`.
- `RenderFaceParams.canvas` is `HTMLCanvasElement` (not `CanvasRenderingContext2D`) — consistent across declaration and call sites in `TryOnCanvas`.
- `makeFaceSmooths()` / `makeHandSmooths()` called once in `useRef(makeX())` — refs stable across renders.
- `useFaceDetector` / `useHandDetector` return `{ ready: boolean; detect: (video, ts) => Result | null }` — both interfaces match the call sites in `TryOnCanvas`.
- `fetchTryOnData` added to `lib/api.ts` using the same `API_URL` + `withTimeout()` + `X-Tenant-Id` pattern as all other catalog fetches.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-virtual-try-on-web-ui.md`.

**Before running any task:** execute `pnpm setup:mediapipe` (from `apps/customer-web`) once to copy WASM glue and download model files to `public/mediapipe/`. This must complete before Task 5 or Task 6 will pass the WASM load path in real browser smoke.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Use `/superpowers:subagent-driven-development`.

2. **Inline Execution** — execute tasks sequentially in this session via `/superpowers:executing-plans` with checkpoints.

**After Plan 2 lands, Plan 3 covers:**
- Shopkeeper admin UI for mm dimensions + anchor nudge (WS-A UI — required for true-to-size to work for real products)
- Mobile try-on via React Native WebView reuse (WS-F mobile)
- Runtime smoke: browser earring/necklace/ring/bangle tracking + devtools network-egress check (zero camera frames out)
- Privacy policy section + app-store privacy labels (WS-G)
