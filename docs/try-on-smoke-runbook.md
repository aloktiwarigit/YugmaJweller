# Virtual Try-On — Runtime Smoke Runbook

> Class A runtime floor for the try-on feature. NOT runnable headless (needs a
> live stack, a real cutout asset, a camera, and an Android device). Run this on
> a workstation with Docker/Postgres+Redis and a connected device/emulator.
> Status 2026-06-02: NOT YET EXECUTED — environment lacked Redis, rembg, a
> device, and a psql client.

## Prerequisites

1. **Stack up:** Postgres + Redis + API (`:3001`) + customer-web (`:3000`).
   - `QUEUE_WORKERS_ENABLED=true` so the cutout worker runs.
   - `BG_REMOVAL_ADAPTER=rembg` with the `rembg` CLI + `isnet-general-use` /
     `birefnet-general` weights on PATH (else cutouts never become `ready`).
   - `STORAGE_ADAPTER=azure-imagekit` (or a stub that returns a real PNG URL).
2. **MediaPipe assets:** in `apps/customer-web`, run `pnpm setup:mediapipe` once
   (copies WASM glue + downloads the `.task` models to `public/mediapipe/`).
3. **Seed:** `pnpm seed:storefront-demo` (products + images). Then, per category,
   set try-on data so a real overlay exists:
   - In the shopkeeper app: open a product → set body part + mm (EAR/NECK→length,
     FINGER/WRIST→diameter) → upload an image → wait for the cutout worker to
     flip the asset to `status='ready'` → open the **Try-On setup (anchor)**
     screen → nudge + enable.
   - Verify the row: `SELECT product_id, body_part, status, enabled,
     asset_storage_key FROM product_try_on_assets;` — need one EAR, one NECK,
     one FINGER, one WRIST that are `ready` + `enabled`.

## Browser smoke (customer-web) — all four categories

For each of the 4 seeded products, open `http://localhost:3000/products/<id>`:
1. Tap **✦ ट्राय करके देखें** → consent sheet (Hindi) → Agree → camera prompt.
2. On the live feed verify:
   - **EAR**: earrings anchor at both lobes, scale with face distance, far-side
     earring hides past ~45° yaw.
   - **NECK**: pendant hangs gravity-down below the chin (independent of head roll).
   - **FINGER**: ring sits on the ring finger, rotates with the finger axis.
   - **WRIST**: bangle sits at the wrist, scales true-to-size.
   - No "अनुमानित आकार" (approximate-size) badge on products that have real mm.
3. Record pass/fail per category + a screenshot each.

### Headless variant (CI-able, partial)
If no human/camera, drive Chromium with a fake camera and assert the pipeline,
not realism:
```
chromium --use-fake-ui-for-media-stream \
  --use-fake-device-for-media-stream \
  --use-file-for-fake-video-capture=face.mjpeg   # a face/hand clip per category
```
Then via Playwright: open the PDP, click the CTA, accept consent, wait for the
canvas, and assert (a) no console errors, (b) the detector reports ≥1 landmark
set, (c) `ctx.drawImage` fires (instrument the renderer in a test build).

## Privacy egress check (DPDPA invariant) — MANDATORY

With DevTools → Network (or a proxy) open during an active session, confirm
**zero** outbound requests carry camera frames/landmarks. Only expected traffic:
same-origin `/mediapipe/*` (WASM + `.task`), the cutout PNG (ImageKit), and
`GET /api/v1/catalog/products/:id/try-on`. Capture the request list.
(Static guard already in place: semgrep `goldsmith.no-try-on-direct-network`
blocks raw fetch/XHR/WebSocket in `components/try-on/**`.)

## Device smoke (customer-mobile WebView)

1. `EXPO_PUBLIC_WEB_BASE_URL` must be a **secure context**: an HTTPS host, or
   `adb reverse tcp:3000 tcp:3000` + `http://localhost:3000` (localhost is
   secure; `http://10.0.2.2:3000` will NOT grant `getUserMedia`).
2. Build/run customer-mobile from a short path (`C:\g` / `C:\gs`, see
   `docs/windows-android-dev.md`).
3. On a PDP tap **✦ ट्राय करके देखें**: native asks camera permission once → the
   WebView loads `/products/[id]/try-on-wv?shop=<slug>` → in-page consent → after
   Agree the overlay tracks on the live camera. Close → returns to the PDP
   (postMessage `{type:'tryon-close'}` → `router.back()`).
4. Confirm the WebView only ever loads the configured `webBaseUrl` origin
   (origin-lock); a redirect elsewhere must be rejected.

## Lighthouse / axe (PDP with CTA)
```
npx lighthouse http://localhost:3000/products/<id> \
  --only-categories=performance,accessibility,best-practices \
  --quiet --chrome-flags="--headless"
```
Run the project axe check on `/products/[id]`. Accessibility ≥ existing baseline;
no new violations from the CTA.

## Sign-off
Record per-category browser result, the egress capture, the device result, and
Lighthouse/axe scores in the PR before marking the Class A runtime floor met.
