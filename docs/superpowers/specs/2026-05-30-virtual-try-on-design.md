# Virtual Try-On (VTO) — Design Spec

> Status: APPROVED 2026-05-30. Brainstorming output (superpowers). Class A feature.
> Next: `/superpowers:writing-plans` → work-stream implementation plan.
> Source research: 6-angle workflow (competitor landscape, MediaPipe web, RN/Expo CV,
> fit-perfectly math, asset pipeline, DPDPA privacy) — captured in this session.

## Problem & goal

Customer-facing **CaratLane-style virtual try-on**: a customer points their camera at
themselves and sees a piece of jewellery rendered on their body. The hard requirement is
that **it fits perfectly** — correct anchor, **true-to-size** scale, natural tilt, believable
occlusion — not a floating sticker. Surfaces: customer-web (primary) and customer-mobile.
Value: conversion ("see it on me") + a strong demo differentiator for the demo-first GTM.

## Framing constraints

1. **No paid external SaaS** (agency rule). Research confirmed **every purpose-built jewellery
   VTO SDK is paid** (Mirrar — the vendor behind CaratLane — Banuba, Perfect Corp/YouCam,
   Camweara; DeepAR free tier watermarks + caps and breaks white-label). The only free,
   production-viable foundation is **Google MediaPipe Tasks Vision (Apache-2.0)**, on-device.
2. **Privacy / DPDPA 2023**: a live face feed is identifiable personal data. Compliant design =
   **on-device, ephemeral, no upload, no biometric template, just-in-time consent**. MediaPipe
   on-device is both the free *and* the privacy-superior choice. (Final DPDP Rules notified
   2025-11-13; core obligations effective 2027-05-13 — design to that standard now.)

## Why this is mostly a *data* problem, not a CV problem

Landmark detection is solved by MediaPipe. "Fits perfectly" needs two things the codebase
lacks today:

- **Metric scale** (px→mm) from an in-frame reference: face = inter-pupillary distance
  (IPD ≈ 63 mm, via iris landmarks); hand = finger-segment / wrist width. Computed live.
- **The product's real dimensions in mm** (earring drop, hoop diameter, pendant height, chain
  length, ring inner diameter, band width, bangle inner diameter). **Weight is NOT a usable
  proxy** — weight→volume is defined but volume→shape is not (a 5 g chain and a 5 g ring have
  unrelated sizes), so weight yields only a coarse size band, never true-to-size.
- **An overlay-ready asset**: a transparent-PNG cutout + a known anchor point. Today's product
  images are plain photos with no cutout/anchor variant.

Adding these two data inputs is the core engineering work; the rest is rendering + tuning.

## Architecture

**Stack (all free / OSS, on-device):**
- Landmarks: `@mediapipe/tasks-vision` (Apache-2.0). `FaceLandmarker` (478 pts;
  `refineLandmarks:true` for iris→IPD scale; `outputFacialTransformationMatrixes:true` for 4×4
  head pose) for earrings + necklace/pendant. `HandLandmarker` (21 pts; documented index map)
  for rings (pts 13↔14) + bangles/bracelets (wrist 0 + MCPs 5,17). Self-host WASM + `.task`
  (privacy, offline-after-first-load, version pinning; GPU/WebGL delegate + CPU fallback;
  `runningMode:'VIDEO'`).
- Render: `react-three-fiber`/`three.js` (MIT) driven by landmarks + the 4×4 matrix, with a
  Canvas-2D fallback for low-end devices.
- **Overlay style: 2D transparent-PNG billboards**, not 3D models — 3D forces a model per SKU
  (~30-120 min each); 2D is ~<2 min/SKU and batchable to thousands. Reserve 3D for a few hero
  pieces only, post-v1.
- **Detector economy**: only the detector for the current category runs (Face *or* Hand, never
  both) — running both ~doubles cost and drops mid-range phones below real-time.

**Platform v1: WEB-FIRST** (mirrors CaratLane's own web-SPA; MediaPipe JS is the most mature
path). Mobile follows via a `react-native-webview` reusing the web build first (lowest
friction), upgrading to native `react-native-vision-camera v5` + `react-native-mediapipe`
behind the existing Expo dev client only if FPS demands it.

**Categories v1: all four** — earrings + necklace/pendant (face) AND rings + bangles/bracelets
(hand). Sequence: face items first (most stable, highest wow), then hand items. Hand items lean
on the existing `size-guide.tsx` mm tables for true-to-size + a fit check.

### Shared fit-engine — new pure-TS package `packages/try-on-core` (framework-agnostic, TDD)
Consumed by both web and mobile renderers:
- `mmPerPixel(landmarks)` — face: IPD via iris (default 63 mm; optional user-PD / ATM-card
  85.6 mm calibration to cut the ±15% monocular error). Hand: finger-segment (≈8-10 mm) / wrist
  width.
- `anchorFor(bodyPart, landmarks)` — face mesh has **no earlobe/neck vertex**: earlobe =
  extrapolated below ear-region jaw pts (L ~132/234, R ~361/454) as a fraction of face height;
  necklace = projected below chin (152) to sternal notch and **hangs gravity-down** (screen-space
  down, independent of head roll); ring = midpoint of hand 13↔14 along that vector; bangle =
  wrist 0 + outer MCPs for width/orientation. **Indices are community-mapped — confirm with an
  on-face/-hand debug overlay before hardcoding.**
- `sizePx(dimensionsMm, mmPerPixel)` — true-to-size; explicit weight→volume fallback **flagged
  "approximate"** when dimensions absent.
- `poseTransform(matrix)` — decompose 4×4 (column-major; `matrixAutoUpdate=false` for three.js)
  → roll/pitch/yaw; head-yaw fades/hides the far-side earring.
- One-Euro filter (Casiez) on position + scale + rotation per anchor (kills jitter without lag;
  tune `min_cutoff` then `beta` on real device FPS).
- `occlusionMask(bodyPart, landmarks)` — depth-only canonical occluder mesh (cheap) or MediaPipe
  segmentation (edge-flicker). Occlusion is the #1 realism lever — without it everything reads
  as a sticker.
- **Handedness/mirror correction** — front cameras mirror; flip L/R so items land on the right side.
- Reference metric tables ported from `size-guide.tsx` (ring diameters mm 1-20, bangle inner
  diameters mm, chain lengths) — double as fit-check + fallback priors.

### Data additions (one new migration, tenant-scoped + RLS)
- `products`: optional `try_on_length_mm`, `try_on_width_mm`, `try_on_diameter_mm`
  (`DECIMAL(8,2)`; compliance-neutral, not money/weight).
- New `product_try_on_assets`: `product_id`, `body_part` (EAR/NECK/FINGER/WRIST),
  `asset_storage_key` (transparent PNG), `anchor_x`/`anchor_y` (normalized 0-1), `enabled`.
  Keeps try-on data off the hot `product_images` path.

### Asset pipeline (free, self-hosted)
On image upload, a background job runs **`rembg` (MIT)** — `isnet-general-use` default,
**BiRefNet (MIT)** for thin-chain/filigree — to produce the cutout. **NOT** ImageKit AI
bg-removal (paid add-on), remove.bg/Cloudinary, or **briaai RMBG weights (non-commercial)**.
Weights pre-baked into the worker image. Cutout stored on existing Azure Blob, served as an
ordinary asset via `ImageKitTransformUrlBuilder` (standard transforms only — free). **Anchor**:
auto-propose from alpha bounding box (top-centre earrings/pendants, centroid rings), shopkeeper
nudges once. **Dimensions**: senior-friendly Hindi UI — category presets→mm (stud S/M/L, bangle
2.4/2.6/2.8″, ring size) + one big mm numeric input with a diagram; optional coin/ATM-card
reference-photo to auto-derive scale. House rule: keep gemstones **opaque** in cutouts. Expect
manual touch-up (Photopea/GIMP) for hero SKUs where reflective gold/thin chains defeat matting.

### Privacy / consent (DPDPA-aligned)
All inference client-side; **no camera frame stored or transmitted**; landmarks transient,
discarded each frame; **no face embedding/template; no age/gender/skin-tone inference** (avoids
profiling + child-data risk, DPDPA S.9). Just-in-time Hindi+English consent sheet (purpose +
on-device + no-save/no-upload, explicit Agree/Cancel) **before** the OS camera prompt; graceful
denial → static gallery + size guide. **No capture/save in v1**; future "save your look" stays
on-device (OS gallery/share sheet) with separate consent. Store only the **consent event**
(never face data). Add privacy-policy section + accurate app-store privacy labels. Enforce
"nothing leaves device" with a Semgrep/lint rule on the try-on module + a QA network-egress check.

## Work streams (detail belongs in the writing-plans output)

- **WS-A — Data & asset model**: migration (mm cols + `product_try_on_assets`, RLS); extend
  shopkeeper `inventory/new.tsx` + `[id]/edit.tsx` (Hindi dimensions form, presets→mm, body-part
  selector); extend `inventory/[id]/images.tsx` (auto-proposed-anchor click). Reuse REST +
  idempotency-key patterns.
- **WS-B — Fit-engine core** (`packages/try-on-core`, pure TS, TDD): scaling, anchoring (4 body
  parts), pose, One-Euro smoothing, occlusion, mirror correction, metric tables. Golden landmark
  fixtures; spec known-issues map 1:1 to test assertions (per `feedback_spec_lessons_need_plan_assertions`).
- **WS-C — Catalog API & asset worker**: `packages/integrations/bg-removal/` rembg adapter +
  `StubBgRemovalAdapter` throwing `BgRemovalUnavailableError`, wired into the image-upload/BullMQ
  path; `GET /catalog/products/:id/try-on` (cutout URL + mm dims + anchor + body-part,
  tenant-isolated, via `ImageKitTransformUrlBuilder`); contract + tenant-isolation tests.
- **WS-D — Web try-on (FACE: earrings + necklace/pendant)**: client route
  `/products/[id]/try-on` — FaceLandmarker, r3f overlay + Canvas-2D fallback, consent gate,
  white-label theming, WCAG AA, no-camera fallback, lazy-loaded. CTA at `page.tsx:235-247`.
  **Demo milestone.**
- **WS-E — Web try-on (HAND: rings + bangles/bracelets)**: add HandLandmarker path to the same
  route (detector chosen by `body_part`); ring (13↔14) + bangle (wrist 0) placement with
  size-guide mm fit-check.
- **WS-F — Mobile try-on**: screen from `browse/[id].tsx` CTAs; WebView reusing the web build
  first, native vision-camera documented as the FPS upgrade. Reuse `HuidScanModal` permission
  pattern; build Android from short path `C:\g`/`C:\gs`.
- **WS-G — Privacy, gates & polish**: consent copy + privacy-policy + app-store labels; verify
  zero camera-frame egress; Lighthouse/axe; runtime smoke (browser + device, every category);
  Class A review gate; `pnpm test:ci`.

## Critical files
- New: `packages/db/src/migrations/<next>_try_on_assets.sql`; `packages/try-on-core/**`;
  `apps/customer-web/app/products/[id]/try-on/**` + `components/try-on/**`;
  `apps/customer-mobile/app/browse/[id]/try-on.tsx`; `packages/integrations/bg-removal/**`.
- Modify: `packages/db/src/schema/products.ts`, `product-images.ts` (or new schema file);
  `apps/api/src/modules/catalog/catalog.controller.ts` + `catalog.service.ts`;
  `packages/customer-shared/src/catalog-types.ts`; `apps/customer-web/app/products/[id]/page.tsx`;
  `apps/customer-mobile/app/browse/[id].tsx`; shopkeeper `inventory/{new,[id]/edit,[id]/images}.tsx`.
- Reuse: `imagekit-url-builder.ts`; `size-guide.tsx` metric tables; `HuidScanModal` camera
  pattern; `@goldsmith/audit` `auditLog(pool,…)` (per `feedback_audit_pattern_pool_not_tx`).

## Verification
- TDD on `try-on-core` (scaling, anchoring, smoothing, weight-fallback flag). `pnpm test:unit`.
- API contract + **tenant-isolation** test on `GET …/try-on`. `pnpm test:integration` + `test:tenant-isolation`.
- Runtime smoke (non-negotiable): web + device — an earring/pendant/ring/bangle **anchors and
  scales true-to-size** and tracks movement.
- Privacy assertion: **no outbound request carries camera frames** (devtools/proxy).
- Lighthouse + axe on the web route; visual review against the agency design bar.
- `pnpm typecheck && pnpm lint && pnpm test:ci`; Class A gate (`/security-review`; Codex when available).

## Decisions (confirmed with owner 2026-05-30)
1. Platform → **Web-first**; mobile via WebView fast-follow (WS-F).
2. Categories → **All four** (face then hand within v1).
3. Fit accuracy → **Full true-to-size pipeline** (mm dims + rembg cutout + anchor + size-guide check).
4. Build depth → **Production feature, Class A**, demo milestone at end of WS-D.

## Risks
- 2D billboards degrade past ~30-40° head yaw — feather/limit overlay at large angles; 3D only for hero pieces.
- Mobile RN-MediaPipe bridge is community-maintained/version-fragile — WebView is the safety net.
- Thin chains/prongs/reflective gold are hardest to matte — manual cutout touch-up for hero SKUs.
- First release won't match CaratLane's years-tuned polish — set expectation; iterate.
