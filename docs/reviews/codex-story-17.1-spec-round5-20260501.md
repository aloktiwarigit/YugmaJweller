OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019de679-76f0-7371-906a-fa111dce147b
--------
user
commit 9fad1eb
2026-05-02T02:16:59.565793Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git show --stat --oneline --decorate --no-renames 9fad1eb'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git show --stat --oneline --decorate --no-renames 9fad1eb' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git show --stat --oneline --decorate --no-renames 9fad1eb'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Alok\Business Projects\Goldsmith
 succeeded in 412ms:
?? docs/reviews/codex-story-17.1-spec-20260501.md
?? docs/reviews/codex-story-17.1-spec-round2-20260501.md
?? docs/reviews/codex-story-17.1-spec-round3-20260501.md
?? docs/reviews/codex-story-17.1-spec-round4-20260501.md
?? docs/reviews/codex-story-17.1-spec-round5-20260501.md
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied

2026-05-02T02:17:06.522574Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command Get-Location in C:\Alok\Business Projects\Goldsmith
 succeeded in 442ms:

Path                               
----                               
C:\Alok\Business Projects\Goldsmith


Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline 9fad1eb' in C:\Alok\Business Projects\Goldsmith
 succeeded in 415ms:
9fad1eb docs(story-17.1): codex round 4 — widen URL builder for thumb/blur surfaces
 .../2026-05-01-story-17.1-image-pipeline-design.md | 37 +++++++++++++++-------
 1 file changed, 26 insertions(+), 11 deletions(-)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --no-ext-diff --unified=80 --no-renames 9fad1eb' in C:\Alok\Business Projects\Goldsmith
 succeeded in 420ms:
commit 9fad1ebe7492352020bec99d4bfbd6df5f0dc4e4
Author: Alok Tiwari <aloktiwari49@gmail.com>
Date:   Fri May 1 22:16:46 2026 -0400

    docs(story-17.1): codex round 4 — widen URL builder for thumb/blur surfaces
    
    Round-3 over-tightening: I narrowed `imagekitUrl()` to a literal-union
    `width: 320|640|1024|1920` to enforce srcset discipline, but other
    sections of the same spec already require `w-200` (shopkeeper card
    thumb) and `w-200,bl-30` (mobile LQIP placeholder). Implementers
    following the narrowed contract would have to bypass the builder to
    emit those — which would silently bypass the mandatory `mb-0.25` byte
    cap.
    
    Widened the contract: `width: number` (any positive int), optional
    `blur?: number` (1-100). The non-negotiables (`q-auto`, `f-auto`,
    `mb-0.25`) are now documented as builder invariants rather than
    literal-union constraints. Added a "caller-side width vocabulary"
    table so implementers know which widths each surface uses without
    needing the type system to enforce it.
    
    Updated the Mobile and Shopkeeper sections to reference the builder
    explicitly rather than raw transform strings, so there's no ambiguity
    about whether those surfaces are exempt from `mb-0.25`. They are not.
    
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index 0a3e2ab..7896863 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -349,257 +349,272 @@ class ProductImagesRepository {
   // SQL. Each step is implemented as a small helper on this repo:
   async lockProductForTenant(tx: Tx, shopId: string, productId: string): Promise<{ id: string } | null>;
   async countImagesInTx(tx: Tx, productId: string): Promise<number>;
   async nextSortOrderInTx(tx: Tx, productId: string): Promise<number>;          // returns 0 if empty
   async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow>;
 
   // Read + mutating endpoints used outside the upload flow:
   async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
   async deleteImage(shopId: string, productId: string, imageId: string): Promise<{ storageKey: string } | null>;
   async setSortOrders(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
   async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow | null>;
 }
 ```
 
 All queries run inside `withTenantTx`; tenant context (`app.current_shop_id`) is injected by interceptor before the service call. RLS is the floor; service-level `WHERE shop_id = $caller` is the second layer per the no-cross-tenant rule. The `lockProductForTenant` SELECT is the third — explicit tenant-scoped existence check that does NOT bypass RLS-style logic the way a bare FK constraint does.
 
 ### Public catalog endpoint (read path)
 
 ```
 GET /api/v1/catalog/products/:productId/images
     Public (no auth). Tenant resolved by request domain (existing pattern).
     Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
 ```
 
 Customer-web `ProductGallery` consumes this. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
 ---
 
 ## Storage adapter — extension
 
 ### `@goldsmith/integrations-storage` additions
 
 **`storage.port.ts`** — extend with one new method needed for bytes-flow:
 ```typescript
 export interface StoragePort {
   // existing
   getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
   getPublicUrl(key: string): Promise<string>;
   downloadBuffer(key: string): Promise<Buffer>;
   uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void>;
   getPresignedReadUrl(key: string): Promise<string>;
   // new
   deleteBlob(key: string): Promise<void>;
 }
 ```
 
 **`MalwareScanPort`** — new file `malware-scan.port.ts`:
 ```typescript
 export interface MalwareScanPort {
   scan(buffer: Buffer, mimeType: string): Promise<{ clean: boolean; reason?: string }>;
 }
 export const MALWARE_SCAN_PORT = 'MALWARE_SCAN_PORT';
 ```
 
 ### `StubStorageAdapter` — fill the dev/CI path
 
 Currently throws on real I/O. Implement against local disk:
 - `uploadBuffer`: writes to `${process.env.STUB_STORAGE_DIR ?? './tmp/storage'}/${key}`, creates parent dirs.
 - `downloadBuffer`: reads same path.
 - `deleteBlob`: best-effort `fs.unlink`.
 - `getPublicUrl`: returns `http://localhost:${PORT}/dev-storage/${key}` (a dev-only Express middleware on the API serves files from STUB_STORAGE_DIR — bound to `127.0.0.1` only, never deployed).
 - `getPresignedUploadUrl` / `getPresignedReadUrl`: identical stub URLs (since STUB doesn't enforce TTL).
 
 ### `AzureBlobStorageAdapter` — real implementation
 
 Constructor reads:
 - `AZURE_STORAGE_ACCOUNT` (e.g., `goldsmithprod`)
 - `AZURE_STORAGE_ACCOUNT_KEY` (Key Vault — for SAS signing)
 - `AZURE_STORAGE_CONTAINER` (e.g., `product-images`)
 
 Methods:
 - `uploadBuffer(key, data, mime)`: `BlobServiceClient.getContainerClient(container).getBlockBlobClient(key).uploadData(data, { blobHTTPHeaders: { blobContentType: mime } })`.
 - `getPresignedUploadUrl(key, mime)`: builds SAS with `sr=b`, `sp=cw` (create+write), `se=now+1h`, `Content-Type` enforced.
 - `getPresignedReadUrl(key)`: builds SAS with `sp=r`, `se=now+1h`. **Used only for the dev-storage fallback path; production reads use `getPublicUrl`.**
 - `getPublicUrl(key)`: returns `https://ik.imagekit.io/${IMAGEKIT_ID}/${key}` — ImageKit Web Folder is configured to fetch from `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/`. Originals stay private in Azure; only ImageKit's authorized fetcher reads them.
 - `deleteBlob(key)`: `blockBlobClient.delete()` with leniency for 404 (already deleted).
 - `downloadBuffer(key)`: `blockBlobClient.downloadToBuffer()` (used only by reconciliation jobs, not request path).
 
 ### `ImageKitTransformUrlBuilder`
 
-Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-` byte-cap parameter is mandatory in every URL** because it is the binding NFR-IMG-1 enforcement (per Design Decision §1). The builder signature makes width the only configurable knob; quality, format, and byte cap are always present:
+Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision §1). Width is caller-controlled (different surfaces need different widths — `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
 
 ```typescript
-imagekitUrl(key: string, opts: { width: 320 | 640 | 1024 | 1920 }): string
-// → `https://ik.imagekit.io/${id}/${key}?tr=w-${width},q-auto,f-auto,mb-0.25`
+imagekitUrl(key: string, opts: {
+  width: number;             // > 0; any positive integer the caller needs
+  blur?: number;             // 1-100; emits `bl-${n}` for low-quality image placeholders
+}): string
+// →  `https://ik.imagekit.io/${id}/${key}?tr=w-${width}[,bl-${blur}],q-auto,f-auto,mb-0.25`
 //
-// Contract: every returned URL MUST contain `mb-0.25`. There is no path
-// to opt out — omitting it would silently break NFR-IMG-1 on customer
-// surfaces. A unit test asserts the substring is present in every output
-// (see Tests § "Integration: ImageKit URL builder").
+// Contract:
+//   * Every returned URL MUST contain `q-auto`, `f-auto`, and `mb-0.25`.
+//   * `bl-` is only present when `blur` is supplied (used by the mobile
+//     blur-placeholder, never on the persisted `public_url` field).
+//   * No code path constructs ImageKit URLs by hand — all callers go
+//     through this builder. A unit test asserts the three required
+//     substrings appear in every output, regardless of options.
 ```
 
-The 4 srcset widths (320 / 640 / 1024 / 1920) are the only valid `width` inputs; the type narrows them to a literal union to prevent off-list values from generating uncached, off-budget variants. Service code (and customer-side `<ResponsiveImage>`) must use only the union members.
+**Caller-side width vocabulary** (documented for implementer reference; not enforced by the type system because future surfaces may add their own widths):
+
+| Surface | Width | Blur | Use |
+|---|---|---|---|
+| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | — | Public PDP gallery |
+| Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
+| Shopkeeper image manager card | 200 | — | Internal thumbnail in the upload UI |
+| `public_url` on upload response | 1024 | — | Single representative URL returned by API; client renders srcset itself |
+
+Adding a new surface that needs a new width is fine — just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
 
 ### `StorageModule` — wire selection
 
 `STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).
 
 ---
 
 ## Mobile — shopkeeper image manager
 
 ### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)
 
 Reachable from product edit screen via "तस्वीरें (n/10)" button.
 
 Layout:
 - Header: "उत्पाद की तस्वीरें" + "+ जोड़ें" button (top-right).
 - `DraggableFlatList` of image cards (`react-native-draggable-flatlist`).
-- Each card: thumbnail (200×200, ImageKit `w-200`) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
+- Each card: thumbnail (200×200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
 - Tap "+ जोड़ें" → `expo-image-picker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: false, quality: 0.95 })`.
 - Selected image → POST as multipart/form-data with `Authorization: Bearer <firebase>`.
 - Upload progress: indeterminate spinner overlay; on success, append to list; on error, Hindi toast keyed by error code.
 
 **i18n** — `packages/i18n/locales/hi-IN/inventory.json`:
 ```json
 "images_title": "उत्पाद की तस्वीरें",
 "images_add": "तस्वीर जोड़ें",
 "images_count": "{{n}}/10",
 "images_alt_placeholder": "वैकल्पिक: तस्वीर का विवरण",
 "images_delete_confirm": "क्या आप वाकई इस तस्वीर को हटाना चाहते हैं?",
 "images_delete_yes": "हाँ, हटाएं",
 "images_delete_no": "रद्द करें",
 "images_err_invalid_mime": "केवल JPEG / PNG / WebP / HEIC तस्वीरें स्वीकार की जाती हैं",
 "images_err_too_large": "इस तस्वीर की गुणवत्ता बहुत बड़ी है — कृपया कम रिज़ॉल्यूशन की कोशिश करें",
 "images_err_invalid_dimensions": "तस्वीर का आकार 200×200 से 8000×8000 के बीच होना चाहिए",
 "images_err_payload": "तस्वीर का आकार 5 MB से अधिक है",
 "images_err_limit": "एक उत्पाद की अधिकतम 10 तस्वीरें",
 "images_err_generic": "तस्वीर अपलोड नहीं हो सकी। दोबारा कोशिश करें।"
 ```
 
 ### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)
 
 Props: `{ images: PublicImageRow[]; productName: string }`.
 
 Layout:
 - 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
 - ≤ 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
 - Click hero → opens lightbox (`<dialog>`, ESC closes).
 - ←→ arrow keys cycle on desktop. Visible focus ring on the hero on focus.
 - Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
 - `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap → expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
-- Each frame uses `expo-image` with `placeholder` → ImageKit `w-200,bl-30` (blur-30 placeholder served by ImageKit) → full image (`w-1024`).
+- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.
 
 ---
 
 ## Tests
 
 | Test | File | What it asserts |
 |------|------|-----------------|
 | Unit: MIME sniff | `product-images.service.spec.ts` | PHP-renamed-jpg → throws `BadRequestException` with code `INVALID_MIME` + audit emitted |
 | Unit: SVG rejection | same | SVG buffer → throws even though magic-bytes match |
 | Unit: oversized after compression | same | Synthetic high-detail source where the **1920 w** sharp probe at `quality:80, effort:6` exceeds 250 KB → throws `BadRequestException` with code `IMAGE_TOO_LARGE_AFTER_COMPRESSION` + audit emitted; corresponding healthy-source case (probe ≤ 250 KB) accepts |
 | Unit: dimension guard | same | 100×100 → throws; 9000×9000 → throws |
 | Unit: EXIF strip | same | A JPEG buffer with embedded EXIF (GPS + camera make) processed by `sharp(buf).rotate().toBuffer()` produces output with NO EXIF block (verified via `exifr.parse(out)` returning `null`); visual orientation is preserved (test source has orientation=6 / 90° rotation) |
 | Unit: dimensions after rotation | same | A 4000×3000 source with EXIF orientation=6 (rotate 90° clockwise) → after `sharp(buf).rotate().toBuffer()`, the cleaned buffer's metadata reports 3000×4000; the row inserted into `product_images` has `width=3000, height=4000`, NOT the source 4000×3000 |
 | Unit: upload happy path | same | Inserts row, calls storage `uploadBuffer` once with cleaned buffer + mime, audit `PRODUCT_IMAGE_UPLOADED` |
 | Unit: image cap | same | 11th upload → throws `IMAGE_LIMIT_REACHED`; cap is enforced inside the tx after `FOR UPDATE` lock |
 | Concurrency: cap under race | `product-images.concurrency.spec.ts` | Two concurrent uploads on a product with 9 images → exactly one inserts (count=10), the other throws `IMAGE_LIMIT_REACHED`; verified by spawning two awaiting `Promise.allSettled` calls against a real test DB with the lock pattern |
 | Security: cross-tenant product attach | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B `productId` → 404 `NOT_FOUND` (NOT a 500 from FK violation, NOT a successful insert); blob best-effort deleted afterward; no row in `product_images` |
 | Unit: reorder | same | `setSortOrders` called with full ordered array; mismatch → throws `ORDER_LIST_MISMATCH` |
 | Unit: delete | same | Repo delete + storage `deleteBlob` called + audit |
 | Integration: upload → list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
 | Integration: tenant isolation | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B productId → 404 |
 | Integration: RLS at SQL layer | `product-images.rls.spec.ts` | Direct SQL with shop_id=A cannot SELECT shop_id=B images |
 | Integration: stub storage round-trip | `stub-storage.integration.spec.ts` | uploadBuffer → downloadBuffer returns same bytes |
 | Integration: Azure adapter mocks | `azure-blob.adapter.spec.ts` | `@azure/storage-blob` mocked; SAS URL contains `sp=cw`, `se=` ≤ 1h ahead, `sr=b` |
-| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | `imagekitUrl(key, {width:640})` produces `tr=w-640,q-auto,f-auto,mb-0.25` query (the `mb-0.25` is the binding 250 KB enforcement, not optional) |
+| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` → contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` → contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 → contains `mb-0.25` (universal byte-cap invariant) |
 | Performance: PDP gallery render | `product-gallery.perf.spec.ts` | First image load < 500 ms p95 against ImageKit cached path (with mocked CDN) |
 | Performance: upload latency | `upload.perf.spec.ts` | Median upload + probe + EXIF strip + DB write < 2 s for a 4 MB JPEG |
 | Security: payload size | `payload-size.security.spec.ts` | 6 MB body → 413 before any sharp invocation |
 | Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
 | a11y: gallery | `product-gallery.a11y.spec.ts` | axe-core on customer-web ProductGallery → 0 violations; alt-text fallback verified |
 
 Coverage target: ≥ 80 % on `product-images.service.ts` and adapters.
 
 ---
 
 ## Work streams
 
 | Stream | Responsibility |
 |--------|----------------|
 | **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
 | **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
 | **WS-C Security** | RLS test on `product_images` (cross-tenant SELECT denied) · tenant-isolation integration test · payload-size + malicious-MIME security tests · `/security-review` gate |
 | **WS-D Mobile (shopkeeper)** | `apps/shopkeeper/app/inventory/[id]/images.tsx` · `expo-image-picker` integration · `react-native-draggable-flatlist` reorder · upload progress UI · Hindi i18n · 48 dp touch targets |
 | **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) · `ResponsiveImage` atom in `packages/ui-web` · `apps/customer-mobile/src/components/products/ProductGallery.tsx` · public catalog `GET /catalog/products/:id/images` · empty-state fallback to `GoldTexturePlaceholder` |
 | **WS-F Gate** | `codex review --base main` · `/security-review` (Class A — both run in parallel per CLAUDE.md ceremony) · `.codex-review-passed` · `.security-review-passed` · runtime smoke (shopkeeper Android upload + customer-web PDP render) |
 
 **Order:** WS-A blocks everything. WS-B blocks WS-C / WS-D / WS-E. WS-C / WS-D / WS-E are parallel after WS-B. WS-F runs last.
 
 ---
 
 ## Smoke test protocol
 
 Run on real device (Moto G + Chrome desktop) after CI green.
 
 1. Boot API in `STORAGE_ADAPTER=stub` mode against a seeded shop with one product (no images).
 2. Boot shopkeeper mobile (Metro fresh, `--clear`).
 3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
 4. Upload a real 4 MP JPEG from gallery → expect spinner → success → image card rendered.
 5. Upload PHP-renamed-as-jpg → expect Hindi error toast "केवल JPEG / PNG / WebP / HEIC तस्वीरें स्वीकार की जाती हैं".
 6. Upload a 6 MB image → expect "तस्वीर का आकार 5 MB से अधिक है" toast.
 7. Upload 10 images → 11th attempt → expect "एक उत्पाद की अधिकतम 10 तस्वीरें" toast.
 8. Reorder via drag handle → reload screen → confirm new order persists.
 9. Edit alt-text on one image → reload → confirm persisted; clear it → reload → confirm fallback string renders.
 10. Delete an image → confirm modal → confirm row removed and gallery count decrements.
 11. Boot customer-web (`apps/customer-web` running against same DB).
 12. Open `/products/<id>` of the seeded product → expect real image gallery (hero + thumbs) replacing `GoldTexturePlaceholder`.
 13. Click hero → lightbox opens → ←→ keys cycle → ESC closes.
 14. DevTools Network: confirm hero image URL contains `tr=w-1024,q-auto,f-auto,mb-0.25` and the response Content-Length ≤ 250 000 bytes (the `mb-0.25` parameter is what enforces this on ImageKit; verify the parameter is in the URL AND the response body honours it).
 15. Lighthouse audit on PDP → SEO ≥ 90, accessibility ≥ 95.
 16. axe-core CLI on `/products/<id>` → zero violations.
 
 Production smoke (post-SOW Azure provisioning): repeat steps 1–14 with `STORAGE_ADAPTER=azure-imagekit` against a real Azure container + ImageKit Web Folder. Recorded as runbook checklist; not blocking for this story's merge.
 
 ---
 
 ## Out of scope
 
 - Bulk re-encode of legacy placeholders (separate data migration, no rows exist today).
 - AI auto-cropping / smart thumbnails.
 - Watermarking.
 - 360° turntable capture (Story 18.6 reserves the data shape via `is_360_frame BOOLEAN`; capture pipeline is Phase 3+).
 - Cart, online checkout, payments.
 - Customer-side image upload (UGC reviews are FR99 territory; out of this story).
 - ClamAV / Defender for Storage actual integration (port + stub only; real adapter post-SOW).
 
 ---
 
 ## Residual risks recorded in runbook
 
 1. **Azure adapter unverified against real Azure** until SOW provisions infrastructure. Adapter unit tests use `@azure/storage-blob` mocks; integration with real Azure SAS semantics is a post-SOW manual smoke.
 2. **MIME-sniff is sole AV layer in MVP.** Threat model documents this. Real malware scan is a one-adapter-swap upgrade once budget exists.
 3. **Orphan blob possibility** if Azure write succeeds but DB insert fails (network blip between steps 10 and 11 of `upload()` flow). Reconciliation job is a Phase 3+ story; impact is pennies of wasted storage, not data loss.
 4. **ImageKit cold-cache penalty** on first request to a new variant width. Acceptable for MVP traffic; warm cache holds the p95 < 500 ms target.
 5. **Stub storage local-disk** is dev-only and bound to `127.0.0.1`; never deployed. Threat model records the assumption.
 6. **ImageKit Web Folder configuration is an ops-time prerequisite,** not story code. The runbook gains a checklist entry: "Provision ImageKit account; create Web Folder pointing to `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/` with read-only SAS credentials in ImageKit dashboard." This must be done before the production env-var flip from `stub` to `azure-imagekit`. Recorded here so the post-SOW deployment session does not skip it.
 
 ---
 
 ## References
 
 - `_bmad-output/planning-artifacts/epics-E17-E18.md` Story 17.1 (acceptance criteria source-of-truth)
 - `docs/customer-storefront-gap-analysis-2026-05-01.md` §T1.1, §12.2, §12.6
 - `docs/prd-addendum-customer-storefront.md` FR90 / NFR-IMG-1 / NFR-SE-2
 - ADR-0007 (storage), ADR-0008 (multi-tenant isolation), ADR-0015 (Azure + Firebase, supersedes pre-Azure NFR-S2 / NFR-C7 wording)
 - `feedback_startup_economics_first.md` (defer Azure spend until SOW)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:17:23.086662Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' -Pattern 'PublicImageRow|storage_key|public_url|ImageRow|imagekitUrl' -Context 3,3"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' -Pattern 'PublicImageRow|storage_key|public_url|ImageRow|imagekitUrl' -Context 3,3" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' -Pattern 'PublicImageRow|storage_key|public_url|ImageRow|imagekitUrl' -Context 3,3"` rejected: blocked by policy
2026-05-02T02:17:26.133953Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git grep -n "PublicImageRow" -- docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git grep -n "PublicImageRow" -- docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git grep -n "PublicImageRow" -- docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | Select-Object -First 450" in C:\Alok\Business Projects\Goldsmith
 succeeded in 469ms:
# Story 17.1 Г?" Product Image Pipeline Design

**Date:** 2026-05-01
**Class:** A (multi-tenant storage, encrypted-at-rest assets, RLS-protected metadata, signed-URL upload, EXIF-stripping pipeline)
**Wave:** 7A Г?" foundation; blocks 17.10 / 18.1 / 18.5 / 18.6 / 18.10
**Worktree:** `C:/gs17a-img/`
**Branch:** `feat/story-17.1-image-pipeline`
**Migration reserved:** 0057
**Source artefacts:** `_bmad-output/planning-artifacts/epics-E17-E18.md` Story 17.1 A· `docs/customer-storefront-gap-analysis-2026-05-01.md` AT1.1 A· `docs/prd-addendum-customer-storefront.md` FR90/NFR-IMG-1
**FRs implemented:** FR90 (multi-image PDP Г?" completion); foundation for FR127 / FR135
**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest Г?" Azure Storage SSE per ADR-0015 supersession), NFR-S3 (tenant-scoped image isolation), NFR-C7 (data residency Г?" Azure Central / South India per ADR-0015), NFR-A4 (alt text), NFR-P9 (image p95 < 500 ms thumbnails), NFR-SE-2 (Lighthouse SEO Г%Э 90)

---

## What we're building

A shopkeeper can upload, reorder, edit alt-text, and delete real product photographs against a product. The customer storefront (web + mobile) replaces the `GoldTexturePlaceholder` stub with a real multi-image gallery driven by ImageKit-transformed CDN URLs.

The pipeline must:
- Refuse non-image uploads via magic-byte sniffing.
- Strip EXIF (GPS, device fingerprint) before persistence.
- Reject pathological sources that cannot compress under 250 KB at the smallest variant.
- Persist metadata in `product_images` under tenant RLS.
- Mint short-lived Azure SAS upload URLs and unsigned ImageKit transform URLs for read.
- Ship dual-mode: STUB adapter for dev/CI (no Azure spend), AZURE+IMAGEKIT adapter for production (ready when SOW signs).

---

## Design decisions

### 1. Lazy variant generation via ImageKit transforms (one blob per source)

The story AC says "ImageKit transcodes the source into 4 variants (320w / 640w / 1024w / 1920w) all under 250 KB each." We satisfy this with on-demand transforms, not eager pre-transcode:

- One Azure Blob per uploaded source image.
- One `product_images` row per source (no per-variant rows).
- Customer `<ResponsiveImage>` renders `srcset` of ImageKit URLs with `tr=w-{320|640|1024|1920},q-auto,f-auto,mb-0.25`.
- ImageKit serves WebP / AVIF (`f-auto`) and adaptive quality (`q-auto`).
- The `mb-0.25` transform parameter caps each variant at 0.25 MB (250 KB) on the **CDN side** Г?" ImageKit iteratively reduces quality until the response body fits. This is the binding NFR-IMG-1 enforcement, independent of the upload-time sharp probe (the probe is only a fast pre-reject for pathological sources; ImageKit's `mb-` is what the customer actually receives).
- First request to a new variant width has a 1Г?"2 s cold-cache penalty; cache warms on first viewer. For an anchor MVP with low traffic per width, the warmed-up p95 Г% 500 ms target is comfortable.

**Plan caveat:** ImageKit's `mb-` transformation is supported on the Free + Standard plans (verified during Phase 2 plan-session against ImageKit's current docs as part of WS-A); if a future plan-tier change ever drops `mb-` support, we fall back to per-width fixed quality bands (`q-{tier-specific}` chosen against typical jewellery photos). Recorded as a residual risk.

**Rejected:** eager pre-transcode (4A- storage cost, second BullMQ worker, duplicates work the CDN already does). Hybrid (pre-bake LCP only) was considered and rejected as YAGNI. **Sharp-probe-only enforcement** (without ImageKit `mb-`) was Codex round-1 wording Г?" round-2 review correctly noted that sharp's WebP encoder Г%  ImageKit's `q-auto` encoder, so the probe cannot guarantee the CDN output fits 250 KB; the `mb-` parameter closes that gap on ImageKit's side.

### 2. Server-routed upload with synchronous validation

Browser POSTs `multipart/form-data` to the API. The API:
1. Enforces 5 MB body cap at NestJS interceptor (HTTP 413 + Hindi error if exceeded).
2. MIME-sniffs via `file-type` magic-byte detection. Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`. SVG is rejected outright (script-injection risk).
3. Probes the **largest** variant (`1920w`) via `sharp` re-encoding to WebP at `quality: 80, effort: 6` to check if it fits Г% 250 KB. If 1920w fits, the smaller widths (320w/640w/1024w) under ImageKit `q-auto,f-auto` are guaranteed to. If not Г+' HTTP 400 + Hindi error + `IMAGE_TOO_LARGE_AFTER_COMPRESSION` audit row.
4. Strips EXIF using sharp's **default** behaviour after `.rotate()`: `sharp(buf).rotate().toBuffer()`. Per sharp v0.31+ docs, the default behaviour (no `withMetadata()` call) strips ALL metadata including EXIF, ICC, and GPS. `.rotate()` applies the source EXIF orientation and then drops the orientation tag, so visual orientation is preserved while metadata is gone.
5. Writes the cleaned buffer to Azure (or stub-disk) **before** the DB transaction.
6. Inside a DB transaction with `SELECT ... FOR UPDATE` on `products` row: verifies tenant ownership (FK alone is insufficient Г?" PostgreSQL FK checks bypass RLS), enforces the 10-image cap atomically, computes next sort order, inserts the row, emits the audit event.

**Rejected:** direct-to-Azure SAS upload (eventual error model conflicts with the AC's synchronous 400 wording; would require pending/rejected state machine in the table). ImageKit-direct upload (loses control of EXIF strip + audit point + Azure data-residency). Probing only the smallest 320w variant (false positive Г?" high-detail jewellery sources can pass 320w but exceed 250KB at 1920w under ImageKit q-auto, violating NFR-IMG-1 silently).

### 3. MIME sniff + port-stub for malware scan; no AV in MVP

The AC's named threat Г?" PHP webshell renamed `.jpg` Г?" is fully addressed by magic-byte mismatch (PHP source is ASCII; doesn't satisfy any image magic-byte signature). Beyond that, the realistic threat surface for shopkeeper-authenticated image uploads is:

- Webshell-as-image Г?" defeated because ImageKit-transformed bytes are what's served, not the original.
- Polyglot (image + JS) Г?" defeated by `Content-Type: image/*` enforcement on egress + browser image-tag isolation.
- libvips CVEs Г?" defeated by MIME + width / height / byte caps before `sharp` runs.
- Steganography Г?" not a malware vector for our threat model.

Story ships:
- `MalwareScanPort` interface in `@goldsmith/integrations-storage` with a single method `scan(buf: Buffer, mime: string): Promise<{ clean: boolean; reason?: string }>`.
- `StubMalwareScanAdapter` that returns `{ clean: true }` unconditionally. Wired by default.
- `scan_status` column defaults to `'clean'` in MVP.
- Threat model + runbook explicitly record "MIME sniff is sole AV layer in MVP; ClamAV / Defender deferred to SOW funding." A future Class A story can swap the stub for `ClamAVAdapter` without schema migration.

**Rejected:** synchronous ClamAV (blows the Г% $20/mo Container Apps consumption tier; 200Г?"1000 ms latency per upload). Async BullMQ scan (worker + state machine for negligible MVP threat reduction).

### 4. Real Azure + ImageKit adapter shipped behind feature flag

`STORAGE_ADAPTER` env var controls runtime adapter selection:
- `stub` (default for dev / CI) Г+' `StubStorageAdapter`. Writes to `tmp/storage/` on local disk; serves blobs via dev-only `/dev-storage/:key` route. **Never** wired in production.
- `azure-imagekit` (production) Г+' `AzureBlobStorageAdapter` for SAS upload + private blob storage; `ImageKitTransformUrlBuilder` for read URLs (URL-builder only, not ImageKit's auth API Г?" public-by-construction transform URLs need no signing token).

When SOW signs and Azure is provisioned, flip one env var. Zero code change. Adapter code is unit-tested against `@azure/storage-blob` mocks; real-Azure smoke is a post-SOW manual verification step (recorded as a residual risk in the runbook).

**Rejected:** stub-only ship with adapter as a separate post-SOW story. Risk: integration assumptions never verified; adapter contract diverges from real Azure SAS semantics; expensive bug to find later.

### 5. Schema extends `product_images` (migration 0057)

Migration 0014 already created the table with `shop_id` + RLS + `ON DELETE CASCADE` from products. Migration 0057:

- **DROPs** unused `variant` column (zero callers, zero data Г?" confirmed via grep).
- **ADDs** 9 columns + 1 index (see AMigration below).

### 6. Hard delete with confirm, drag-handle reorder

- Delete: shopkeeper opens the image in the manager, taps "Е1ЕYЕ_Е?Е,", confirms in a Hindi modal. Single SQL DELETE within tenant-tx. The Azure blob is also deleted (`DELETE_BLOB` job Г?" best-effort; blob orphans don't break correctness, only waste pennies).
- Reorder: `react-native-draggable-flatlist` (mobile shopkeeper). Drag emits `PATCH /products/:id/images/order` with the full ordered ID array; service does an atomic UPDATE of `sort_order` for all rows in tenant-tx.
- No soft delete. An image is not a compliance artefact; FK cascade on product delete already covers cleanup.

### 7. Cap of 10 images per product

Hard reject the 11th upload with HTTP 409 + Hindi error "Е?Е Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? Е.ЕЕиЕЕЕr 10 ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е,". Cap enforced in service via `inventory.repository.countImages()` (already implemented in 3.5 work).

### 8. 404 (not 403) on cross-tenant API access Г?" deliberate AC deviation

The Story 17.1 AC says: *"a customer of Tenant-B has the URL of a Rajesh-shop image Г+' the image loads (signed URLs are public-by-construction, intentional) BUT the API endpoints to list/modify/delete images return 403 (RLS blocks cross-tenant via API)."*

We deviate from "403" to **404** for the API endpoints, matching the established tenant-isolation pattern across Story 1.5 (staff revocation), Story 6.1 (customer CRM), and the project rule "tenant-mismatch row not found = 404, no existence disclosure." Specifically:

- Strict 403 implementation would require an explicit cross-tenant detection query (extra round-trip).
- For images, public ImageKit URLs already disclose existence; "404 vs 403" semantic difference is moot for confidentiality.
- 404-uniform reduces controller branching and matches every other tenant-scoped endpoint in the codebase.

If Codex flags this, the Phase-2 implementer can revisit Г?" the AC's "403" phrasing was almost certainly descriptive ("the API blocks it") not prescriptive ("with HTTP code 403"). Recorded here so the deviation is explicit and reviewable.

### 9. Alt text is nullable with auto-generated fallback

- Column `alt_text TEXT NULL`.
- Render fallback when NULL: `<product_name> Г?" ЕЕ,ЕЭ?ЕцЕЭ?Е° <sort_order + 1>`.
- Shopkeeper can override per image via a single text input on the upload screen.
- Auto-fallback is not persisted (computed at render).

---

## Migration 0057

**File:** `packages/db/src/migrations/0057_product_images_pipeline.sql`

**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:

1. No FKs into `product_images` exist (`grep -r 'REFERENCES product_images' packages/db` returns zero matches).
2. `product_images` has zero production data (anchor SOW unsigned; only stub rows from manual dev tests via the legacy `getImageUploadUrl` fire-and-forget path).
3. The legacy upload path code is deleted in the same PR (see "Legacy code retired" below), so no new stub rows can appear after this migration.

```sql
-- 0057_product_images_pipeline.sql
-- Story 17.1 Г?" recreate product_images for the real upload pipeline.
--
-- DDL-only (migrator role compatible). No DML inside .sql migrations
-- per docs/db-workflow.md.

-- Drop the original 0014 table (zero production data; no FK dependencies).
-- CASCADE removes the policy + grants + index implicitly.
DROP TABLE product_images CASCADE;

-- Recreate with the full Story-17.1 schema.
CREATE TABLE product_images (
  shop_id              UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_key          TEXT        NOT NULL,
  alt_text             TEXT,                                                            -- nullable; fallback computed at render
  mime_type            TEXT        NOT NULL,
  byte_size            BIGINT      NOT NULL,
  width                INTEGER     NOT NULL,
  height               INTEGER     NOT NULL,
  exif_stripped_at     TIMESTAMPTZ NOT NULL,
  uploaded_by_user_id  UUID        NOT NULL REFERENCES shop_users(id),
  scan_status          TEXT        NOT NULL DEFAULT 'clean'
    CHECK (scan_status IN ('pending', 'clean', 'rejected')),
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX product_images_shop_id_idx       ON product_images (shop_id);
CREATE INDEX product_images_product_id_idx    ON product_images (product_id);
CREATE INDEX product_images_product_sort_idx  ON product_images (product_id, sort_order);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_product_images_tenant_isolation ON product_images;
CREATE POLICY rls_product_images_tenant_isolation ON product_images
  FOR ALL
  USING       (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK  (shop_id = current_setting('app.current_shop_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO app_user;
```

**Legacy code retired in the same PR:**
- `apps/api/src/modules/inventory/inventory.service.ts` Г?" delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
- `apps/api/src/modules/inventory/inventory.controller.ts` Г?" delete `getImageUploadUrl` handler (line 148).
- `apps/api/src/modules/inventory/inventory.repository.ts` Г?" delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
- `apps/api/src/modules/inventory/inventory.service.test.ts` Г?" delete the `describe('getImageUploadUrl')` block (lines 103Г?"130).

The new `ProductImagesController` / `ProductImagesService` / `ProductImagesRepository` (defined below) replace this path entirely. No callers of the legacy methods remain in the repo (`countImages` is kept and reused; only the upload-url + insert-record-only path is removed).

**Drizzle schema update** (`packages/db/src/schema/product-images.ts`):
- Drop `variant` field.
- Add `alt_text`, `mime_type`, `byte_size`, `width`, `height`, `exif_stripped_at`, `uploaded_by_user_id`, `scan_status`, `updated_at`.

**Audit enum update** (`packages/audit/src/audit-actions.ts`): add
- `PRODUCT_IMAGE_UPLOADED`
- `PRODUCT_IMAGE_REJECTED` (covers MIME / oversize / scan-rejection)
- `PRODUCT_IMAGE_DELETED`
- `PRODUCT_IMAGE_REORDERED`

---

## API

### Endpoints

```
POST   /api/v1/products/:productId/images          (multipart/form-data; field "file")
       Headers: Content-Length Г% 5 MB
       Optional field: "alt_text" (string, Г% 200 chars)
       Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
       Errors:
         400 INVALID_MIME       Г?" magic-byte sniff failed
         400 IMAGE_TOO_LARGE_AFTER_COMPRESSION Г?" sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
         400 INVALID_DIMENSIONS Г?" width or height outside [200, 8000]
         409 IMAGE_LIMIT_REACHED Г?" 10 already exist on this product
         413 PAYLOAD_TOO_LARGE  Г?" body > 5 MB

DELETE /api/v1/products/:productId/images/:imageId
       Guards: same
       Response: 204 No Content; 404 if not found within tenant

PATCH  /api/v1/products/:productId/images/order
       Body: { orderedIds: string[] }  (must contain every image of the product, no extras)
       Guards: same
       Response: 200 { images: ImageRow[] }
       Errors: 400 ORDER_LIST_MISMATCH (set inequality); 404 if any id not found in tenant

PATCH  /api/v1/products/:productId/images/:imageId
       Body: { alt_text: string | null }   (only alt-text editable post-upload)
       Guards: same
       Response: 200 { image: ImageRow }
```

### `ProductImagesService`

```typescript
class ProductImagesService {
  async upload(input: {
    shopId: string;
    productId: string;
    userId: string;
    file: { buffer: Buffer; mimeType: string; size: number };
    altText?: string | null;
  }): Promise<ImageRow>;

  async delete(shopId: string, productId: string, imageId: string): Promise<void>;

  async reorder(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;

  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow>;

  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
}
```

**`upload()` flow:**

```
Pre-flight (no DB tx, fast-fail to caller):
 1. validate: file.size Г% 5 MB                                    Г+' throw 413 PAYLOAD_TOO_LARGE
 2. sniffed = await fileType.fromBuffer(file.buffer)
    if sniffed.mime Г^% ALLOW_LIST                                  Г+' audit REJECTED + throw 400 INVALID_MIME
    (ALLOW_LIST = image/jpeg, image/png, image/webp, image/heic Г?" SVG explicitly excluded)
 3. meta = await sharp(file.buffer).metadata()
    if meta.width < 200 || meta.height < 200                      Г+' throw 400 INVALID_DIMENSIONS
    if meta.width > 8000 || meta.height > 8000                    Г+' throw 400 INVALID_DIMENSIONS

Variant byte-cap probe (worst-case width = 1920w):
 4. probe = await sharp(file.buffer)
              .rotate()                                             // apply EXIF orientation, then drop tag
              .resize({ width: 1920, withoutEnlargement: true })
              .toFormat('webp', { quality: 80, effort: 6 })
              .toBuffer()
    if probe.byteLength > 250_000                                 Г+' audit REJECTED + throw 400 IMAGE_TOO_LARGE_AFTER_COMPRESSION
    (rationale: if 1920w fits Г%250 KB at q-80/effort-6, the smaller widths
     320w/640w/1024w under ImageKit's q-auto definitely will. ImageKit's
     q-auto uses similar heuristics; sharp probe at q-80 is a conservative
     proxy. Documented assumption; verified during smoke testing.)

EXIF strip (the bytes that get persisted):
 5. cleaned = await sharp(file.buffer).rotate().toBuffer()
    // .rotate() applies EXIF orientation tag, then sharp's default toBuffer()
    // strips ALL metadata (EXIF, ICC, GPS) Г?" verified per sharp v0.31+ docs:
    // "default behaviour, when withMetadata() is not called, strips all metadata"

 5b. cleanedMeta = await sharp(cleaned).metadata()
    // Re-read width/height AFTER rotate, because sources with EXIF orientation
    // 5/6/7/8 (90A° / 270A°) physically swap pixel dimensions during .rotate().
    // step-3 meta.width/height reflect the source orientation; the persisted
    // bytes have cleanedMeta.width/height. Storing the latter is what the
    // customer-facing srcset and aspect-ratio CSS need.

 6. malware = await scanPort.scan(cleaned, sniffed.mime)            // stub returns {clean:true} in MVP
    if !malware.clean                                              Г+' audit REJECTED + throw 400 SCAN_FAILED

Storage upload (BEFORE DB tx; orphan on tx failure is acceptable):
 7. storageKey = `tenant/${shopId}/products/${productId}/${uuid()}.${extFromMime(sniffed.mime)}`
 8. await storagePort.uploadBuffer(storageKey, cleaned, sniffed.mime)

DB transaction with pessimistic product-row lock (serializes uploads per product):
 9. await withTenantTx(async (tx) => {
     a. owned = await tx.query(
          `SELECT id FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
          [productId, shopId]
        )
        if owned.rowCount === 0:
          // Cross-tenant attempt OR product doesn't exist. FK on
          // product_images.product_id alone is INSUFFICIENT Г?" PostgreSQL FK
          // checks bypass RLS, so without this explicit tenant-scoped lookup
          // an attacker with a tenant-A token could attach an image row to
          // tenant-B's product_id. The FOR UPDATE lock also serializes
          // concurrent uploads against the cap.
          throw 404 NOT_FOUND  (after best-effort blob delete)

     b. count = await tx.query(`SELECT COUNT(*) FROM product_images WHERE product_id = $1`, [productId])
        if count >= 10:
          throw 409 IMAGE_LIMIT_REACHED  (after best-effort blob delete)

     c. nextSort = await tx.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
          [productId]
        )

     d. row = await tx.query(`INSERT INTO product_images (...) VALUES (...) RETURNING ...`, {
          shopId, productId, storageKey, mimeType: sniffed.mime, byteSize: cleaned.length,
          width: cleanedMeta.width, height: cleanedMeta.height,        // post-rotation dimensions
          sortOrder: nextSort,
          altText, uploadedByUserId: userId, exifStrippedAt: NOW(), scanStatus: 'clean',
        })

     e. await audit.emit(tx, PRODUCT_IMAGE_UPLOADED, { imageId: row.id, byteSize: cleaned.length })
     return row
   })

10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
```

**Transaction boundary clarification:** storage upload (step 8) runs **before** the DB transaction (step 9) so that:
- A storage-upload failure short-circuits Г?" no DB row, clean caller error.
- If the DB tx rolls back (cross-tenant 404, cap 409), the orphan blob is deleted on a best-effort basis in the catch handler; if the delete fails, reconciliation sweep (Phase 3+ runbook task) cleans it up. Impact: pennies of wasted storage; never a row-without-blob.
- The pessimistic `SELECT ... FOR UPDATE` on `products` row inside the tx serializes concurrent uploads for the same product, making the 10-cap inviolable under any concurrency.

### `ProductImagesRepository`

```typescript
class ProductImagesRepository {
  // The upload flow uses raw tx queries (lockProductForUpdate + countImagesInTx +
  // nextSortOrderInTx + insertInTx) so that a single tenant-tx contains the whole
  // critical section: tenant ownership check, cap enforcement, sort_order
  // computation, insert, audit. See ProductImagesService.upload() for the exact
  // SQL. Each step is implemented as a small helper on this repo:
  async lockProductForTenant(tx: Tx, shopId: string, productId: string): Promise<{ id: string } | null>;
  async countImagesInTx(tx: Tx, productId: string): Promise<number>;
  async nextSortOrderInTx(tx: Tx, productId: string): Promise<number>;          // returns 0 if empty
  async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow>;

  // Read + mutating endpoints used outside the upload flow:
  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
  async deleteImage(shopId: string, productId: string, imageId: string): Promise<{ storageKey: string } | null>;
  async setSortOrders(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow | null>;
}
```

All queries run inside `withTenantTx`; tenant context (`app.current_shop_id`) is injected by interceptor before the service call. RLS is the floor; service-level `WHERE shop_id = $caller` is the second layer per the no-cross-tenant rule. The `lockProductForTenant` SELECT is the third Г?" explicit tenant-scoped existence check that does NOT bypass RLS-style logic the way a bare FK constraint does.

### Public catalog endpoint (read path)

```
GET /api/v1/catalog/products/:productId/images
    Public (no auth). Tenant resolved by request domain (existing pattern).
    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
```

Customer-web `ProductGallery` consumes this. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.

---

## Storage adapter Г?" extension

### `@goldsmith/integrations-storage` additions

**`storage.port.ts`** Г?" extend with one new method needed for bytes-flow:
```typescript
export interface StoragePort {
  // existing
  getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
  getPublicUrl(key: string): Promise<string>;
  downloadBuffer(key: string): Promise<Buffer>;
  uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void>;
  getPresignedReadUrl(key: string): Promise<string>;
  // new
  deleteBlob(key: string): Promise<void>;
}
```

**`MalwareScanPort`** Г?" new file `malware-scan.port.ts`:
```typescript
export interface MalwareScanPort {
  scan(buffer: Buffer, mimeType: string): Promise<{ clean: boolean; reason?: string }>;
}
export const MALWARE_SCAN_PORT = 'MALWARE_SCAN_PORT';
```

### `StubStorageAdapter` Г?" fill the dev/CI path

Currently throws on real I/O. Implement against local disk:
- `uploadBuffer`: writes to `${process.env.STUB_STORAGE_DIR ?? './tmp/storage'}/${key}`, creates parent dirs.
- `downloadBuffer`: reads same path.
- `deleteBlob`: best-effort `fs.unlink`.
- `getPublicUrl`: returns `http://localhost:${PORT}/dev-storage/${key}` (a dev-only Express middleware on the API serves files from STUB_STORAGE_DIR Г?" bound to `127.0.0.1` only, never deployed).
- `getPresignedUploadUrl` / `getPresignedReadUrl`: identical stub URLs (since STUB doesn't enforce TTL).

### `AzureBlobStorageAdapter` Г?" real implementation

Constructor reads:
- `AZURE_STORAGE_ACCOUNT` (e.g., `goldsmithprod`)
- `AZURE_STORAGE_ACCOUNT_KEY` (Key Vault Г?" for SAS signing)
- `AZURE_STORAGE_CONTAINER` (e.g., `product-images`)

Methods:
- `uploadBuffer(key, data, mime)`: `BlobServiceClient.getContainerClient(container).getBlockBlobClient(key).uploadData(data, { blobHTTPHeaders: { blobContentType: mime } })`.
- `getPresignedUploadUrl(key, mime)`: builds SAS with `sr=b`, `sp=cw` (create+write), `se=now+1h`, `Content-Type` enforced.
- `getPresignedReadUrl(key)`: builds SAS with `sp=r`, `se=now+1h`. **Used only for the dev-storage fallback path; production reads use `getPublicUrl`.**
- `getPublicUrl(key)`: returns `https://ik.imagekit.io/${IMAGEKIT_ID}/${key}` Г?" ImageKit Web Folder is configured to fetch from `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/`. Originals stay private in Azure; only ImageKit's authorized fetcher reads them.
- `deleteBlob(key)`: `blockBlobClient.delete()` with leniency for 404 (already deleted).
- `downloadBuffer(key)`: `blockBlobClient.downloadToBuffer()` (used only by reconciliation jobs, not request path).

### `ImageKitTransformUrlBuilder`

Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision A1). Width is caller-controlled (different surfaces need different widths Г?" `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.

```typescript
imagekitUrl(key: string, opts: {
  width: number;             // > 0; any positive integer the caller needs
  blur?: number;             // 1-100; emits `bl-${n}` for low-quality image placeholders
}): string
// Г+'  `https://ik.imagekit.io/${id}/${key}?tr=w-${width}[,bl-${blur}],q-auto,f-auto,mb-0.25`
//
// Contract:
//   * Every returned URL MUST contain `q-auto`, `f-auto`, and `mb-0.25`.
//   * `bl-` is only present when `blur` is supplied (used by the mobile
//     blur-placeholder, never on the persisted `public_url` field).
//   * No code path constructs ImageKit URLs by hand Г?" all callers go
//     through this builder. A unit test asserts the three required
//     substrings appear in every output, regardless of options.
```

**Caller-side width vocabulary** (documented for implementer reference; not enforced by the type system because future surfaces may add their own widths):

| Surface | Width | Blur | Use |
|---|---|---|---|
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | Select-Object -Skip 450 -First 220" in C:\Alok\Business Projects\Goldsmith
 succeeded in 496ms:
| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | Г?" | Public PDP gallery |
| Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
| Shopkeeper image manager card | 200 | Г?" | Internal thumbnail in the upload UI |
| `public_url` on upload response | 1024 | Г?" | Single representative URL returned by API; client renders srcset itself |

Adding a new surface that needs a new width is fine Г?" just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).

### `StorageModule` Г?" wire selection

`STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).

---

## Mobile Г?" shopkeeper image manager

### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)

Reachable from product edit screen via "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (n/10)" button.

Layout:
- Header: "Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е," + "+ ЕoЕЭ<ЕнЕмЕЭ╪Е," button (top-right).
- `DraggableFlatList` of image cards (`react-native-draggable-flatlist`).
- Each card: thumbnail (200A-200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) A· drag handle (right) A· alt-text input (one line) A· "Е1ЕYЕ_Е?Е," button (red, Г%Э 48 dp).
- Tap "+ ЕoЕЭ<ЕнЕмЕЭ╪Е," Г+' `expo-image-picker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: false, quality: 0.95 })`.
- Selected image Г+' POST as multipart/form-data with `Authorization: Bearer <firebase>`.
- Upload progress: indeterminate spinner overlay; on success, append to list; on error, Hindi toast keyed by error code.

**i18n** Г?" `packages/i18n/locales/hi-IN/inventory.json`:
```json
"images_title": "Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е,",
"images_add": "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕoЕЭ<ЕнЕмЕЭ╪Е,",
"images_count": "{{n}}/10",
"images_alt_placeholder": "ЕцЕЭ^ЕЕ¤ЕЭ?ЕжЕиЕ: ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ ЕцЕиЕцЕ°ЕЬ",
"images_delete_confirm": "ЕЕЭ?Е_Е_ Е+Еж ЕцЕ_ЕЕ^ Е╪Е, ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕЭ< Е1ЕYЕ_Е"Е_ ЕsЕ_Е1ЕЕЭ╪ Е1ЕЭ^Е,?",
"images_delete_yes": "Е1Е_Е?, Е1ЕYЕ_Е?Е,",
"images_delete_no": "Е°Е▌ЕЭ?Е▌ ЕЕ°ЕЭ╪Е,",
"images_err_invalid_mime": "ЕЕЭ╪ЕцЕ¤ JPEG / PNG / WebP / HEIC ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, Е,ЕЭ?ЕцЕЭ?ЕЕ_Е° ЕЕЭ? ЕoЕ_ЕЕЭ? Е1ЕЭ^Е,",
"images_err_too_large": "Е╪Е, ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕЭ? Е-ЕЭ?ЕЬЕцЕЕЭ?ЕЕ_ ЕкЕ1ЕЭ?Е ЕкЕнЕмЕЭ? Е1ЕЭ^ Г?" ЕЕЭЯЕжЕ_Е_ ЕЕr Е°ЕиЕoЕмЕЭ%Е¤ЕЭ?Е_ЕЭ,ЕЕ" ЕЕЭ? ЕЕЭ<ЕЕиЕ ЕЕ°ЕЭ╪Е,",
"images_err_invalid_dimensions": "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ Е+ЕЕ_Е° 200A-200 Е,ЕЭ╪ 8000A-8000 ЕЕЭ╪ ЕкЕЭ?Еs Е1ЕЭ<Е"Е_ ЕsЕ_Е1ЕиЕ?",
"images_err_payload": "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ Е+ЕЕ_Е° 5 MB Е,ЕЭ╪ Е.ЕЕиЕ Е1ЕЭ^",
"images_err_limit": "Е?Е Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? Е.ЕЕиЕЕЕr 10 ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е,",
"images_err_generic": "ЕЕ,ЕЭ?ЕцЕЭ?Е° Е.ЕжЕ¤ЕЭ<Ен Е"Е1ЕЭ?Е, Е1ЕЭ< Е,ЕЕЭ?ЕЭ Е▌ЕЭ<ЕкЕ_Е°Е_ ЕЕЭ<ЕЕиЕ ЕЕ°ЕЭ╪Е,ЕЭ"
```

### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)

Props: `{ images: PublicImageRow[]; productName: string }`.

Layout:
- 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
- Г% 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
- Click hero Г+' opens lightbox (`<dialog>`, ESC closes).
- Г+?Г+' arrow keys cycle on desktop. Visible focus ring on the hero on focus.
- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
- Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.

### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)

Props: same.

Layout:
- Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
- Tap Г+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.

---

## Tests

| Test | File | What it asserts |
|------|------|-----------------|
| Unit: MIME sniff | `product-images.service.spec.ts` | PHP-renamed-jpg Г+' throws `BadRequestException` with code `INVALID_MIME` + audit emitted |
| Unit: SVG rejection | same | SVG buffer Г+' throws even though magic-bytes match |
| Unit: oversized after compression | same | Synthetic high-detail source where the **1920 w** sharp probe at `quality:80, effort:6` exceeds 250 KB Г+' throws `BadRequestException` with code `IMAGE_TOO_LARGE_AFTER_COMPRESSION` + audit emitted; corresponding healthy-source case (probe Г% 250 KB) accepts |
| Unit: dimension guard | same | 100A-100 Г+' throws; 9000A-9000 Г+' throws |
| Unit: EXIF strip | same | A JPEG buffer with embedded EXIF (GPS + camera make) processed by `sharp(buf).rotate().toBuffer()` produces output with NO EXIF block (verified via `exifr.parse(out)` returning `null`); visual orientation is preserved (test source has orientation=6 / 90A° rotation) |
| Unit: dimensions after rotation | same | A 4000A-3000 source with EXIF orientation=6 (rotate 90A° clockwise) Г+' after `sharp(buf).rotate().toBuffer()`, the cleaned buffer's metadata reports 3000A-4000; the row inserted into `product_images` has `width=3000, height=4000`, NOT the source 4000A-3000 |
| Unit: upload happy path | same | Inserts row, calls storage `uploadBuffer` once with cleaned buffer + mime, audit `PRODUCT_IMAGE_UPLOADED` |
| Unit: image cap | same | 11th upload Г+' throws `IMAGE_LIMIT_REACHED`; cap is enforced inside the tx after `FOR UPDATE` lock |
| Concurrency: cap under race | `product-images.concurrency.spec.ts` | Two concurrent uploads on a product with 9 images Г+' exactly one inserts (count=10), the other throws `IMAGE_LIMIT_REACHED`; verified by spawning two awaiting `Promise.allSettled` calls against a real test DB with the lock pattern |
| Security: cross-tenant product attach | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B `productId` Г+' 404 `NOT_FOUND` (NOT a 500 from FK violation, NOT a successful insert); blob best-effort deleted afterward; no row in `product_images` |
| Unit: reorder | same | `setSortOrders` called with full ordered array; mismatch Г+' throws `ORDER_LIST_MISMATCH` |
| Unit: delete | same | Repo delete + storage `deleteBlob` called + audit |
| Integration: upload Г+' list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
| Integration: tenant isolation | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B productId Г+' 404 |
| Integration: RLS at SQL layer | `product-images.rls.spec.ts` | Direct SQL with shop_id=A cannot SELECT shop_id=B images |
| Integration: stub storage round-trip | `stub-storage.integration.spec.ts` | uploadBuffer Г+' downloadBuffer returns same bytes |
| Integration: Azure adapter mocks | `azure-blob.adapter.spec.ts` | `@azure/storage-blob` mocked; SAS URL contains `sp=cw`, `se=` Г% 1h ahead, `sr=b` |
| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` Г+' contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` Г+' contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 Г+' contains `mb-0.25` (universal byte-cap invariant) |
| Performance: PDP gallery render | `product-gallery.perf.spec.ts` | First image load < 500 ms p95 against ImageKit cached path (with mocked CDN) |
| Performance: upload latency | `upload.perf.spec.ts` | Median upload + probe + EXIF strip + DB write < 2 s for a 4 MB JPEG |
| Security: payload size | `payload-size.security.spec.ts` | 6 MB body Г+' 413 before any sharp invocation |
| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
| a11y: gallery | `product-gallery.a11y.spec.ts` | axe-core on customer-web ProductGallery Г+' 0 violations; alt-text fallback verified |

Coverage target: Г%Э 80 % on `product-images.service.ts` and adapters.

---

## Work streams

| Stream | Responsibility |
|--------|----------------|
| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
| **WS-C Security** | RLS test on `product_images` (cross-tenant SELECT denied) A· tenant-isolation integration test A· payload-size + malicious-MIME security tests A· `/security-review` gate |
| **WS-D Mobile (shopkeeper)** | `apps/shopkeeper/app/inventory/[id]/images.tsx` A· `expo-image-picker` integration A· `react-native-draggable-flatlist` reorder A· upload progress UI A· Hindi i18n A· 48 dp touch targets |
| **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) A· `ResponsiveImage` atom in `packages/ui-web` A· `apps/customer-mobile/src/components/products/ProductGallery.tsx` A· public catalog `GET /catalog/products/:id/images` A· empty-state fallback to `GoldTexturePlaceholder` |
| **WS-F Gate** | `codex review --base main` A· `/security-review` (Class A Г?" both run in parallel per CLAUDE.md ceremony) A· `.codex-review-passed` A· `.security-review-passed` A· runtime smoke (shopkeeper Android upload + customer-web PDP render) |

**Order:** WS-A blocks everything. WS-B blocks WS-C / WS-D / WS-E. WS-C / WS-D / WS-E are parallel after WS-B. WS-F runs last.

---

## Smoke test protocol

Run on real device (Moto G + Chrome desktop) after CI green.

1. Boot API in `STORAGE_ADAPTER=stub` mode against a seeded shop with one product (no images).
2. Boot shopkeeper mobile (Metro fresh, `--clear`).
3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
4. Upload a real 4 MP JPEG from gallery Г+' expect spinner Г+' success Г+' image card rendered.
5. Upload PHP-renamed-as-jpg Г+' expect Hindi error toast "ЕЕЭ╪ЕцЕ¤ JPEG / PNG / WebP / HEIC ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, Е,ЕЭ?ЕцЕЭ?ЕЕ_Е° ЕЕЭ? ЕoЕ_ЕЕЭ? Е1ЕЭ^Е,".
6. Upload a 6 MB image Г+' expect "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ Е+ЕЕ_Е° 5 MB Е,ЕЭ╪ Е.ЕЕиЕ Е1ЕЭ^" toast.
7. Upload 10 images Г+' 11th attempt Г+' expect "Е?Е Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? Е.ЕЕиЕЕЕr 10 ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е," toast.
8. Reorder via drag handle Г+' reload screen Г+' confirm new order persists.
9. Edit alt-text on one image Г+' reload Г+' confirm persisted; clear it Г+' reload Г+' confirm fallback string renders.
10. Delete an image Г+' confirm modal Г+' confirm row removed and gallery count decrements.
11. Boot customer-web (`apps/customer-web` running against same DB).
12. Open `/products/<id>` of the seeded product Г+' expect real image gallery (hero + thumbs) replacing `GoldTexturePlaceholder`.
13. Click hero Г+' lightbox opens Г+' Г+?Г+' keys cycle Г+' ESC closes.
14. DevTools Network: confirm hero image URL contains `tr=w-1024,q-auto,f-auto,mb-0.25` and the response Content-Length Г% 250 000 bytes (the `mb-0.25` parameter is what enforces this on ImageKit; verify the parameter is in the URL AND the response body honours it).
15. Lighthouse audit on PDP Г+' SEO Г%Э 90, accessibility Г%Э 95.
16. axe-core CLI on `/products/<id>` Г+' zero violations.

Production smoke (post-SOW Azure provisioning): repeat steps 1Г?"14 with `STORAGE_ADAPTER=azure-imagekit` against a real Azure container + ImageKit Web Folder. Recorded as runbook checklist; not blocking for this story's merge.

---

## Out of scope

- Bulk re-encode of legacy placeholders (separate data migration, no rows exist today).
- AI auto-cropping / smart thumbnails.
- Watermarking.
- 360A° turntable capture (Story 18.6 reserves the data shape via `is_360_frame BOOLEAN`; capture pipeline is Phase 3+).
- Cart, online checkout, payments.
- Customer-side image upload (UGC reviews are FR99 territory; out of this story).
- ClamAV / Defender for Storage actual integration (port + stub only; real adapter post-SOW).

---

## Residual risks recorded in runbook

1. **Azure adapter unverified against real Azure** until SOW provisions infrastructure. Adapter unit tests use `@azure/storage-blob` mocks; integration with real Azure SAS semantics is a post-SOW manual smoke.
2. **MIME-sniff is sole AV layer in MVP.** Threat model documents this. Real malware scan is a one-adapter-swap upgrade once budget exists.
3. **Orphan blob possibility** if Azure write succeeds but DB insert fails (network blip between steps 10 and 11 of `upload()` flow). Reconciliation job is a Phase 3+ story; impact is pennies of wasted storage, not data loss.
4. **ImageKit cold-cache penalty** on first request to a new variant width. Acceptable for MVP traffic; warm cache holds the p95 < 500 ms target.
5. **Stub storage local-disk** is dev-only and bound to `127.0.0.1`; never deployed. Threat model records the assumption.
6. **ImageKit Web Folder configuration is an ops-time prerequisite,** not story code. The runbook gains a checklist entry: "Provision ImageKit account; create Web Folder pointing to `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/` with read-only SAS credentials in ImageKit dashboard." This must be done before the production env-var flip from `stub` to `azure-imagekit`. Recorded here so the post-SOW deployment session does not skip it.

---

## References

- `_bmad-output/planning-artifacts/epics-E17-E18.md` Story 17.1 (acceptance criteria source-of-truth)
- `docs/customer-storefront-gap-analysis-2026-05-01.md` AT1.1, A12.2, A12.6
- `docs/prd-addendum-customer-storefront.md` FR90 / NFR-IMG-1 / NFR-SE-2
- ADR-0007 (storage), ADR-0008 (multi-tenant isolation), ADR-0015 (Azure + Firebase, supersedes pre-Azure NFR-S2 / NFR-C7 wording)
- `feedback_startup_economics_first.md` (defer Azure spend until SOW)
- `feedback_fresh_session_prompt_ceremony.md` (Class A plan + exec are separate fresh sessions)
- `feedback_codex_worktree_clm.md` (Codex CLM blocker workaround for Windows worktrees)
- `memory/project_phase1_storefront_complete.md` (Phase 1 deliverables on main HEAD 669ee90)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show 9fad1eb''^:docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md | Select-Object -Skip 420 -First 120' in C:\Alok\Business Projects\Goldsmith
 succeeded in 496ms:
- `getPresignedUploadUrl(key, mime)`: builds SAS with `sr=b`, `sp=cw` (create+write), `se=now+1h`, `Content-Type` enforced.
- `getPresignedReadUrl(key)`: builds SAS with `sp=r`, `se=now+1h`. **Used only for the dev-storage fallback path; production reads use `getPublicUrl`.**
- `getPublicUrl(key)`: returns `https://ik.imagekit.io/${IMAGEKIT_ID}/${key}` — ImageKit Web Folder is configured to fetch from `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/`. Originals stay private in Azure; only ImageKit's authorized fetcher reads them.
- `deleteBlob(key)`: `blockBlobClient.delete()` with leniency for 404 (already deleted).
- `downloadBuffer(key)`: `blockBlobClient.downloadToBuffer()` (used only by reconciliation jobs, not request path).

### `ImageKitTransformUrlBuilder`

Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-` byte-cap parameter is mandatory in every URL** because it is the binding NFR-IMG-1 enforcement (per Design Decision §1). The builder signature makes width the only configurable knob; quality, format, and byte cap are always present:

```typescript
imagekitUrl(key: string, opts: { width: 320 | 640 | 1024 | 1920 }): string
// → `https://ik.imagekit.io/${id}/${key}?tr=w-${width},q-auto,f-auto,mb-0.25`
//
// Contract: every returned URL MUST contain `mb-0.25`. There is no path
// to opt out — omitting it would silently break NFR-IMG-1 on customer
// surfaces. A unit test asserts the substring is present in every output
// (see Tests § "Integration: ImageKit URL builder").
```

The 4 srcset widths (320 / 640 / 1024 / 1920) are the only valid `width` inputs; the type narrows them to a literal union to prevent off-list values from generating uncached, off-budget variants. Service code (and customer-side `<ResponsiveImage>`) must use only the union members.

### `StorageModule` — wire selection

`STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).

---

## Mobile — shopkeeper image manager

### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)

Reachable from product edit screen via "तस्वीरें (n/10)" button.

Layout:
- Header: "उत्पाद की तस्वीरें" + "+ जोड़ें" button (top-right).
- `DraggableFlatList` of image cards (`react-native-draggable-flatlist`).
- Each card: thumbnail (200×200, ImageKit `w-200`) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
- Tap "+ जोड़ें" → `expo-image-picker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: false, quality: 0.95 })`.
- Selected image → POST as multipart/form-data with `Authorization: Bearer <firebase>`.
- Upload progress: indeterminate spinner overlay; on success, append to list; on error, Hindi toast keyed by error code.

**i18n** — `packages/i18n/locales/hi-IN/inventory.json`:
```json
"images_title": "उत्पाद की तस्वीरें",
"images_add": "तस्वीर जोड़ें",
"images_count": "{{n}}/10",
"images_alt_placeholder": "वैकल्पिक: तस्वीर का विवरण",
"images_delete_confirm": "क्या आप वाकई इस तस्वीर को हटाना चाहते हैं?",
"images_delete_yes": "हाँ, हटाएं",
"images_delete_no": "रद्द करें",
"images_err_invalid_mime": "केवल JPEG / PNG / WebP / HEIC तस्वीरें स्वीकार की जाती हैं",
"images_err_too_large": "इस तस्वीर की गुणवत्ता बहुत बड़ी है — कृपया कम रिज़ॉल्यूशन की कोशिश करें",
"images_err_invalid_dimensions": "तस्वीर का आकार 200×200 से 8000×8000 के बीच होना चाहिए",
"images_err_payload": "तस्वीर का आकार 5 MB से अधिक है",
"images_err_limit": "एक उत्पाद की अधिकतम 10 तस्वीरें",
"images_err_generic": "तस्वीर अपलोड नहीं हो सकी। दोबारा कोशिश करें।"
```

### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)

Props: `{ images: PublicImageRow[]; productName: string }`.

Layout:
- 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
- ≤ 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
- Click hero → opens lightbox (`<dialog>`, ESC closes).
- ←→ arrow keys cycle on desktop. Visible focus ring on the hero on focus.
- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
- Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.

### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)

Props: same.

Layout:
- Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
- Tap → expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
- Each frame uses `expo-image` with `placeholder` → ImageKit `w-200,bl-30` (blur-30 placeholder served by ImageKit) → full image (`w-1024`).

---

## Tests

| Test | File | What it asserts |
|------|------|-----------------|
| Unit: MIME sniff | `product-images.service.spec.ts` | PHP-renamed-jpg → throws `BadRequestException` with code `INVALID_MIME` + audit emitted |
| Unit: SVG rejection | same | SVG buffer → throws even though magic-bytes match |
| Unit: oversized after compression | same | Synthetic high-detail source where the **1920 w** sharp probe at `quality:80, effort:6` exceeds 250 KB → throws `BadRequestException` with code `IMAGE_TOO_LARGE_AFTER_COMPRESSION` + audit emitted; corresponding healthy-source case (probe ≤ 250 KB) accepts |
| Unit: dimension guard | same | 100×100 → throws; 9000×9000 → throws |
| Unit: EXIF strip | same | A JPEG buffer with embedded EXIF (GPS + camera make) processed by `sharp(buf).rotate().toBuffer()` produces output with NO EXIF block (verified via `exifr.parse(out)` returning `null`); visual orientation is preserved (test source has orientation=6 / 90° rotation) |
| Unit: dimensions after rotation | same | A 4000×3000 source with EXIF orientation=6 (rotate 90° clockwise) → after `sharp(buf).rotate().toBuffer()`, the cleaned buffer's metadata reports 3000×4000; the row inserted into `product_images` has `width=3000, height=4000`, NOT the source 4000×3000 |
| Unit: upload happy path | same | Inserts row, calls storage `uploadBuffer` once with cleaned buffer + mime, audit `PRODUCT_IMAGE_UPLOADED` |
| Unit: image cap | same | 11th upload → throws `IMAGE_LIMIT_REACHED`; cap is enforced inside the tx after `FOR UPDATE` lock |
| Concurrency: cap under race | `product-images.concurrency.spec.ts` | Two concurrent uploads on a product with 9 images → exactly one inserts (count=10), the other throws `IMAGE_LIMIT_REACHED`; verified by spawning two awaiting `Promise.allSettled` calls against a real test DB with the lock pattern |
| Security: cross-tenant product attach | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B `productId` → 404 `NOT_FOUND` (NOT a 500 from FK violation, NOT a successful insert); blob best-effort deleted afterward; no row in `product_images` |
| Unit: reorder | same | `setSortOrders` called with full ordered array; mismatch → throws `ORDER_LIST_MISMATCH` |
| Unit: delete | same | Repo delete + storage `deleteBlob` called + audit |
| Integration: upload → list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
| Integration: tenant isolation | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B productId → 404 |
| Integration: RLS at SQL layer | `product-images.rls.spec.ts` | Direct SQL with shop_id=A cannot SELECT shop_id=B images |
| Integration: stub storage round-trip | `stub-storage.integration.spec.ts` | uploadBuffer → downloadBuffer returns same bytes |
| Integration: Azure adapter mocks | `azure-blob.adapter.spec.ts` | `@azure/storage-blob` mocked; SAS URL contains `sp=cw`, `se=` ≤ 1h ahead, `sr=b` |
| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | `imagekitUrl(key, {width:640})` produces `tr=w-640,q-auto,f-auto,mb-0.25` query (the `mb-0.25` is the binding 250 KB enforcement, not optional) |
| Performance: PDP gallery render | `product-gallery.perf.spec.ts` | First image load < 500 ms p95 against ImageKit cached path (with mocked CDN) |
| Performance: upload latency | `upload.perf.spec.ts` | Median upload + probe + EXIF strip + DB write < 2 s for a 4 MB JPEG |
| Security: payload size | `payload-size.security.spec.ts` | 6 MB body → 413 before any sharp invocation |
| Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
| a11y: gallery | `product-gallery.a11y.spec.ts` | axe-core on customer-web ProductGallery → 0 violations; alt-text fallback verified |

Coverage target: ≥ 80 % on `product-images.service.ts` and adapters.

---

## Work streams

| Stream | Responsibility |
|--------|----------------|
| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:17:56.834912Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { "'$i++; if($i -ge 485 -and $i -le 505){ '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { "'$i++; if($i -ge 485 -and $i -le 505){ '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { "'$i++; if($i -ge 485 -and $i -le 505){ '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
2026-05-02T02:18:04.453800Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'); lines=p.read_text(encoding='utf-8').splitlines();
for i in range(485,506): print(f'{i:4}: {lines[i-1]}')\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'); lines=p.read_text(encoding='utf-8').splitlines();
for i in range(485,506): print(f'{i:4}: {lines[i-1]}')\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'); lines=p.read_text(encoding='utf-8').splitlines();
for i in range(485,506): print(f'{i:4}: {lines[i-1]}')\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"Each frame uses\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 434ms:
515:- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"width: number\" /c:\"Adding a new surface\" /c:\"thumbnail (200\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 402ms:
433:  width: number;             // > 0; any positive integer the caller needs
456:Adding a new surface that needs a new width is fine — just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
473:- Each card: thumbnail (200×200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"Response: { images: PublicImageRow\" /c:\"Props: same\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 437ms:
370:    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
510:Props: same.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Name' in C:\Alok\Business Projects\Goldsmith
 succeeded in 446ms:
.claude
.github
.remember
.secrets
.serena
.turbo
.worktrees
apps
docs
node_modules
ops
packages
scripts
_bmad
_bmad-output
.bmad-readiness-passed
.claude-review-passed
.codex-review-passed
.editorconfig
.eslintrc.cjs
.firebaserc
.gitignore
.node-version
.npmrc
.pnpmfile.cjs
.prettierignore
.prettierrc
.security-review-passed
CLAUDE.md
firebase.json
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
tsconfig.json
turbo.json
vitest.config.ts
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Name packages' in C:\Alok\Business Projects\Goldsmith
 succeeded in 421ms:
audit
auth-client
cache
compliance
crypto-envelope
db
i18n
integrations
money
observability
queue
secrets
shared
sync
tenant-config
tenant-context
testing
ui-mobile
ui-tokens
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -Filter package.json packages\\integrations | Select-Object -ExpandProperty FullName" in C:\Alok\Business Projects\Goldsmith
 succeeded in 477ms:
C:\Alok\Business Projects\Goldsmith\packages\integrations\payments\package.json
C:\Alok\Business Projects\Goldsmith\packages\integrations\rates\package.json
C:\Alok\Business Projects\Goldsmith\packages\integrations\search\package.json
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\package.json
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content packages\\integrations\\storage\\package.json" in C:\Alok\Business Projects\Goldsmith
 succeeded in 436ms:
{
  "name": "@goldsmith/integrations-storage",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "reflect-metadata": "^0.2.0"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "typescript": "^5.4.0"
  }
}
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"@goldsmith/integrations-storage\" apps\\shopkeeper\\*.ts apps\\shopkeeper\\*.tsx apps\\customer-mobile\\*.ts apps\\customer-mobile\\*.tsx apps\\customer-web\\*.ts apps\\customer-web\\*.tsx" in C:\Alok\Business Projects\Goldsmith
2026-05-02T02:19:25.017229Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 2.9 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\otlp-proto-exporter-base\build\esnext\platform\browser\OTLPProtoExporterBrowserBase.d.ts
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\resources\build\esnext\detectors\platform\node\machine-id\getMachineId-unsupported.d.ts
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\sdk-metrics\build\esnext\aggregator\exponential-histogram\mapping\ExponentMapping.d.ts
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\sdk-metrics\build\esnext\aggregator\exponential-histogram\mapping\LogarithmMapping.d.ts

 exited 1 in 2915ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\otlp-proto-exporter-base\build\esnext\platform\browser\OTLPProtoExporterBrowserBase.d.ts
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\resources\build\esnext\detectors\platform\node\machine-id\getMachineId-unsupported.d.ts
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\sdk-metrics\build\esnext\aggregator\exponential-histogram\mapping\ExponentMapping.d.ts
FINDSTR: Cannot open apps\shopkeeper\node_modules\@goldsmith\sync\node_modules\@goldsmith\db\node_modules\@goldsmith\observability\node_modules\@opentelemetry\sdk-metrics\build\esnext\aggregator\exponential-histogram\mapping\LogarithmMapping.d.ts

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Name apps' in C:\Alok\Business Projects\Goldsmith
 succeeded in 418ms:
api
customer-mobile
customer-web
shopkeeper
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content apps\\shopkeeper\\package.json; Get-Content apps\\customer-mobile\\package.json" in C:\Alok\Business Projects\Goldsmith
 succeeded in 434ms:
{
  "name": "@goldsmith/shopkeeper",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo start --dev-client --android",
    "ios": "expo start --dev-client --ios",
    "export": "expo export --platform web --output-dir dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@expo/metro-runtime": "~3.2.3",
    "@expo/vector-icons": "~14.0.0",
    "@goldsmith/auth-client": "workspace:*",
    "@goldsmith/compliance": "workspace:*",
    "@goldsmith/i18n": "workspace:*",
    "@goldsmith/shared": "workspace:*",
    "@goldsmith/sync": "workspace:*",
    "@goldsmith/ui-mobile": "workspace:*",
    "@goldsmith/ui-tokens": "workspace:*",
    "@nozbe/watermelondb": "^0.27.1",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@react-native-community/netinfo": "^11.3.1",
    "@react-native-firebase/app": "^21.0.0",
    "@react-native-firebase/auth": "^21.0.0",
    "@react-navigation/native": "^7.2.2",
    "@react-navigation/native-stack": "^7.14.12",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.7.0",
    "expo": "~51.0.0",
    "expo-constants": "~16.0.0",
    "expo-dev-client": "~4.0.0",
    "expo-document-picker": "~11.7.0",
    "expo-font": "~12.0.0",
    "expo-haptics": "~13.0.1",
    "expo-print": "~13.0.0",
    "expo-router": "~3.5.0",
    "expo-splash-screen": "~0.27.0",
    "expo-status-bar": "~1.12.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-native": "0.74.0",
    "react-native-safe-area-context": "4.10.0",
    "react-native-screens": "3.31.0",
    "react-native-svg": "^15.2.0",
    "react-native-web": "~0.19.0",
    "uuid": "^9.0.0",
    "zustand": "^4.5.0",
    "posthog-react-native": "^3.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@testing-library/react": "^14.3.1",
    "@types/react": "~18.2.79",
    "@types/uuid": "^9.0.0",
    "axe-core": "^4.9.0",
    "axios-mock-adapter": "^1.22.0",
    "jsdom": "^24.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
{
  "name": "@goldsmith/customer-mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo start --dev-client --android",
    "ios": "expo start --dev-client --ios",
    "export": "expo export --platform web --output-dir dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@expo/metro-runtime": "~3.2.3",
    "@expo/vector-icons": "~14.0.0",
    "@goldsmith/auth-client": "workspace:*",
    "@goldsmith/i18n": "workspace:*",
    "@goldsmith/shared": "workspace:*",
    "@goldsmith/ui-mobile": "workspace:*",
    "@goldsmith/ui-tokens": "workspace:*",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@react-native-firebase/app": "^21.0.0",
    "@react-native-firebase/auth": "^21.0.0",
    "@react-navigation/native": "^7.2.2",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.7.0",
    "expo": "~51.0.0",
    "expo-camera": "~15.0.0",
    "expo-constants": "~16.0.0",
    "expo-dev-client": "~4.0.0",
    "expo-font": "~12.0.0",
    "expo-haptics": "~13.0.1",
    "expo-router": "~3.5.0",
    "expo-secure-store": "~13.0.2",
    "expo-splash-screen": "~0.27.0",
    "expo-status-bar": "~1.12.0",
    "nativewind": "^4.0.36",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-native": "0.74.0",
    "react-native-reanimated": "~3.10.1",
    "react-native-safe-area-context": "4.10.0",
    "react-native-screens": "3.31.0",
    "react-native-svg": "^15.2.0",
    "react-native-web": "~0.19.0",
    "tailwindcss": "^3.4.4",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@testing-library/react": "^14.3.1",
    "@types/node": "^20.11.0",
    "@types/react": "~18.2.79",
    "axios-mock-adapter": "^1.22.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages\\integrations\\storage\\src | Select-Object -ExpandProperty FullName" in C:\Alok\Business Projects\Goldsmith
 succeeded in 451ms:
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\src\adapters
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\src\index.ts
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\src\storage.module.ts
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\src\storage.port.ts
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\src\adapters\azure-blob.adapter.ts
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\src\adapters\imagekit.adapter.ts
C:\Alok\Business Projects\Goldsmith\packages\integrations\storage\src\adapters\stub.adapter.ts
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content packages\\integrations\\storage\\src\\index.ts; Get-Content packages\\integrations\\storage\\src\\storage.module.ts" in C:\Alok\Business Projects\Goldsmith
 succeeded in 435ms:
export type { StoragePort } from './storage.port';
export { StubStorageAdapter } from './adapters/stub.adapter';
export { AzureBlobAdapter } from './adapters/azure-blob.adapter';
export { ImageKitAdapter } from './adapters/imagekit.adapter';
export { StorageModule } from './storage.module';
export const STORAGE_PORT = 'STORAGE_PORT';
import { Module } from '@nestjs/common';
import type { StoragePort } from './storage.port';
import { StubStorageAdapter } from './adapters/stub.adapter';
import { AzureBlobAdapter } from './adapters/azure-blob.adapter';
import { ImageKitAdapter } from './adapters/imagekit.adapter';

export const STORAGE_PORT = 'STORAGE_PORT';

@Module({
  providers: [
    {
      provide: STORAGE_PORT,
      useFactory: (): StoragePort => {
        const adapter = process.env['STORAGE_ADAPTER'] ?? 'stub';
        switch (adapter) {
          case 'azure': return new AzureBlobAdapter();
          case 'imagekit': return new ImageKitAdapter();
          default: return new StubStorageAdapter();
        }
      },
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content packages\\integrations\\storage\\src\\adapters\\azure-blob.adapter.ts; Get-Content packages\\integrations\\storage\\src\\adapters\\stub.adapter.ts; Get-Content packages\\integrations\\storage\\src\\adapters\\imagekit.adapter.ts" in C:\Alok\Business Projects\Goldsmith
 succeeded in 439ms:
import type { StoragePort } from '../storage.port';

export class AzureBlobAdapter implements StoragePort {
  private readonly cdnBase: string;

  constructor() {
    this.cdnBase = process.env['IMAGEKIT_CDN_BASE'] ?? 'https://ik.imagekit.io/goldsmith';
  }

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    // TODO: generate real Azure Blob SAS URL via BlobServiceClient
    return `https://stub-storage.local/${key}?sas=AZURE_STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `${this.cdnBase}/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    // TODO: implement via BlobServiceClient when AZURE_STORAGE_CONNECTION_STRING is set
    throw new Error(`azure-blob.downloadBuffer: not implemented for key ${key}`);
  }

  async uploadBuffer(key: string, _data: Buffer, _contentType: string): Promise<void> {
    // TODO: implement via BlobServiceClient when AZURE_STORAGE_CONNECTION_STRING is set
    throw new Error(`azure-blob.uploadBuffer: not implemented for key ${key}`);
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    // TODO: generate real Azure Blob SAS read URL via BlobServiceClient
    return `https://stub-storage.local/${key}?sas=AZURE_READ_STUB`;
  }
}
import type { StoragePort } from '../storage.port';

export class StubStorageAdapter implements StoragePort {
  private readonly blobs = new Map<string, Buffer>();

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    return `https://stub-storage.local/${key}?sas=STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `https://stub-storage.local/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const buf = this.blobs.get(key);
    if (!buf) throw new Error(`stub.storage: key not found: ${key}`);
    return buf;
  }

  async uploadBuffer(key: string, data: Buffer, _contentType: string): Promise<void> {
    this.blobs.set(key, data);
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    return `https://stub-storage.local/${key}?sas=READ_STUB`;
  }
}
import type { StoragePort } from '../storage.port';

export class ImageKitAdapter implements StoragePort {
  private readonly base: string;

  constructor() {
    this.base = process.env['IMAGEKIT_CDN_BASE'] ?? 'https://ik.imagekit.io/goldsmith';
  }

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    // TODO: generate real ImageKit upload URL when credentials are set
    return `${this.base}/${key}?upload=STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `${this.base}/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    // TODO: implement via ImageKit download API
    throw new Error(`imagekit.downloadBuffer: not implemented for key ${key}`);
  }

  async uploadBuffer(key: string, _data: Buffer, _contentType: string): Promise<void> {
    // TODO: implement via ImageKit upload API
    throw new Error(`imagekit.uploadBuffer: not implemented for key ${key}`);
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    return `${this.base}/${key}`;
  }
}
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show 9fad1eb''^:docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md | findstr /n /c:"return { ...row" /c:"public_url"' in C:\Alok\Business Projects\Goldsmith
 succeeded in 475ms:
208:       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
333:10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
370:    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
520:| Integration: upload ??? list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
The updated spec now directs the customer-mobile surface to use a field that its documented public API response does not provide. That would leave implementers without the inputs needed to construct the mandated ImageKit URLs.

Review comment:

- [P2] Don't build mobile URLs from an absent public field — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
  For the customer-mobile gallery, `Props: same` means it receives `PublicImageRow[]`, and the public catalog endpoint only exposes `public_url`, `alt_text`, and dimensions, not `storage_key`. In that scenario this new instruction to call `imagekitUrl(storage_key, ...)` cannot compile or run unless the public DTO is widened or the API returns the needed variant URLs, so implementers will be forced to bypass the builder or ship a broken gallery.
2026-05-02T02:20:34.381464Z ERROR codex_core::session: failed to record rollout items: thread 019de679-771f-70a1-b580-0671f2a707ff not found
2026-05-02T02:20:34.451925Z ERROR codex_core::session: failed to record rollout items: thread 019de679-76f0-7371-906a-fa111dce147b not found
The updated spec now directs the customer-mobile surface to use a field that its documented public API response does not provide. That would leave implementers without the inputs needed to construct the mandated ImageKit URLs.

Review comment:

- [P2] Don't build mobile URLs from an absent public field — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
  For the customer-mobile gallery, `Props: same` means it receives `PublicImageRow[]`, and the public catalog endpoint only exposes `public_url`, `alt_text`, and dimensions, not `storage_key`. In that scenario this new instruction to call `imagekitUrl(storage_key, ...)` cannot compile or run unless the public DTO is widened or the API returns the needed variant URLs, so implementers will be forced to bypass the builder or ship a broken gallery.
