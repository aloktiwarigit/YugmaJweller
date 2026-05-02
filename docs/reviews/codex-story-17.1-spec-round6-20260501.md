OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019de67e-2e60-7530-bb66-d80dedf6de5f
--------
user
commit 90c410e
2026-05-02T02:22:12.161539Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git rev-parse 90c410e; git rev-parse 90c410e''^'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git rev-parse 90c410e; git rev-parse 90c410e''^' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git rev-parse 90c410e; git rev-parse 90c410e''^'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Alok\Business Projects\Goldsmith
 succeeded in 455ms:
?? docs/reviews/codex-story-17.1-spec-20260501.md
?? docs/reviews/codex-story-17.1-spec-round2-20260501.md
?? docs/reviews/codex-story-17.1-spec-round3-20260501.md
?? docs/reviews/codex-story-17.1-spec-round4-20260501.md
?? docs/reviews/codex-story-17.1-spec-round5-20260501.md
?? docs/reviews/codex-story-17.1-spec-round6-20260501.md
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied

2026-05-02T02:22:19.270003Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command Get-Location in C:\Alok\Business Projects\Goldsmith
 succeeded in 435ms:

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
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline --decorate --no-renames 90c410e' in C:\Alok\Business Projects\Goldsmith
 succeeded in 415ms:
90c410e (HEAD -> main) docs(story-17.1): codex round 5 — server pre-computes all public URLs
 .../2026-05-01-story-17.1-image-pipeline-design.md | 27 ++++++++++++++++++----
 1 file changed, 22 insertions(+), 5 deletions(-)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --no-ext-diff --unified=80 --no-color 90c410e' in C:\Alok\Business Projects\Goldsmith
 succeeded in 417ms:
commit 90c410e55e4e763d2e31783ebab1b2315ee38139
Author: Alok Tiwari <aloktiwari49@gmail.com>
Date:   Fri May 1 22:21:54 2026 -0400

    docs(story-17.1): codex round 5 — server pre-computes all public URLs
    
    Round-4 patch told the customer-mobile gallery to call
    imagekitUrl(storage_key, ...) on the client, but the public
    PublicImageRow DTO never exposed storage_key. The instruction was
    uncompilable.
    
    Fixed by widening PublicImageRow to carry server-pre-built URLs
    instead of exposing the internal storage_key:
    - srcset: pre-built "url 320w, url 640w, url 1024w, url 1920w" string
    - default_url: single w-1024 URL (LCP / non-srcset fallback)
    - placeholder_url: w-200, blur-30 LQIP
    
    storage_key stays shopkeeper-only (returned only on the authenticated
    upload response). All public surfaces consume server-built URLs that
    already carry mb-0.25 via the imagekitUrl() builder, preserving the
    "every customer-facing URL has the byte cap" invariant without ever
    shipping the URL builder to the client.
    
    Updated customer-web and customer-mobile sections to consume the
    richer DTO directly. Client never composes ImageKit URLs.
    
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index 7896863..c2a3e1a 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -290,306 +290,323 @@ EXIF strip (the bytes that get persisted):
 
  6. malware = await scanPort.scan(cleaned, sniffed.mime)            // stub returns {clean:true} in MVP
     if !malware.clean                                              → audit REJECTED + throw 400 SCAN_FAILED
 
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
           // product_images.product_id alone is INSUFFICIENT — PostgreSQL FK
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
 - A storage-upload failure short-circuits — no DB row, clean caller error.
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
 
 All queries run inside `withTenantTx`; tenant context (`app.current_shop_id`) is injected by interceptor before the service call. RLS is the floor; service-level `WHERE shop_id = $caller` is the second layer per the no-cross-tenant rule. The `lockProductForTenant` SELECT is the third — explicit tenant-scoped existence check that does NOT bypass RLS-style logic the way a bare FK constraint does.
 
 ### Public catalog endpoint (read path)
 
 ```
 GET /api/v1/catalog/products/:productId/images
     Public (no auth). Tenant resolved by request domain (existing pattern).
-    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
+    Response: { images: PublicImageRow[] }
 ```
 
-Customer-web `ProductGallery` consumes this. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
+
+```typescript
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;          // null → caller renders auto-fallback "<product> – तस्वीर <n>"
+  width: number;                    // post-rotation
+  height: number;
+  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
+                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
+  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
+  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
+};
+```
+
+`storage_key` is intentionally NOT in the public DTO — it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+
+Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
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
 
 Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision §1). Width is caller-controlled (different surfaces need different widths — `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
 
 ```typescript
 imagekitUrl(key: string, opts: {
   width: number;             // > 0; any positive integer the caller needs
   blur?: number;             // 1-100; emits `bl-${n}` for low-quality image placeholders
 }): string
 // →  `https://ik.imagekit.io/${id}/${key}?tr=w-${width}[,bl-${blur}],q-auto,f-auto,mb-0.25`
 //
 // Contract:
 //   * Every returned URL MUST contain `q-auto`, `f-auto`, and `mb-0.25`.
 //   * `bl-` is only present when `blur` is supplied (used by the mobile
 //     blur-placeholder, never on the persisted `public_url` field).
 //   * No code path constructs ImageKit URLs by hand — all callers go
 //     through this builder. A unit test asserts the three required
 //     substrings appear in every output, regardless of options.
 ```
 
 **Caller-side width vocabulary** (documented for implementer reference; not enforced by the type system because future surfaces may add their own widths):
 
 | Surface | Width | Blur | Use |
 |---|---|---|---|
 | Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | — | Public PDP gallery |
 | Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
 | Shopkeeper image manager card | 200 | — | Internal thumbnail in the upload UI |
 | `public_url` on upload response | 1024 | — | Single representative URL returned by API; client renders srcset itself |
 
 Adding a new surface that needs a new width is fine — just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
 
 ### `StorageModule` — wire selection
 
 `STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).
 
 ---
 
 ## Mobile — shopkeeper image manager
 
 ### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)
 
 Reachable from product edit screen via "तस्वीरें (n/10)" button.
 
 Layout:
 - Header: "उत्पाद की तस्वीरें" + "+ जोड़ें" button (top-right).
 - `DraggableFlatList` of image cards (`react-native-draggable-flatlist`).
 - Each card: thumbnail (200×200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
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
-- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
+- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
+- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap → expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
-- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.
+- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
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
 | Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` → contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` → contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 → contains `mb-0.25` (universal byte-cap invariant) |
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
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:22:43.887698Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' -Pattern 'storage_key|ImageRow|public_url|ProductImagesController|GET|list' -Context 2,2 | Select-Object -First 200 | Format-List"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' -Pattern 'storage_key|ImageRow|public_url|ProductImagesController|GET|list' -Context 2,2 | Select-Object -First 200 | Format-List" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' -Pattern 'storage_key|ImageRow|public_url|ProductImagesController|GET|list' -Context 2,2 | Select-Object -First 200 | Format-List"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"storage_key\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 417ms:
149:  storage_key          TEXT        NOT NULL,
208:       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
333:10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
373:`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
388:`storage_key` is intentionally NOT in the public DTO — it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
490:- Each card: thumbnail (200×200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:22:52.641670Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180<=i<=220 or 360<=i<=395 or 480<=i<=500 or 530<=i<=560:
        print(f'{i}: {line}')
PY"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180<=i<=220 or 360<=i<=395 or 480<=i<=500 or 530<=i<=560:
        print(f'{i}: {line}')
PY" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180<=i<=220 or 360<=i<=395 or 480<=i<=500 or 530<=i<=560:
        print(f'{i}: {line}')
PY"` rejected: blocked by policy
2026-05-02T02:22:56.660321Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'); lines=p.read_text(encoding='utf-8').splitlines(); [print(f'{i}: {line}') for i,line in enumerate(lines,1) if 180<=i<=220 or 360<=i<=395 or 480<=i<=500 or 530<=i<=560]\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'); lines=p.read_text(encoding='utf-8').splitlines(); [print(f'{i}: {line}') for i,line in enumerate(lines,1) if 180<=i<=220 or 360<=i<=395 or 480<=i<=500 or 530<=i<=560]\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md'); lines=p.read_text(encoding='utf-8').splitlines(); [print(f'{i}: {line}') for i,line in enumerate(lines,1) if 180<=i<=220 or 360<=i<=395 or 480<=i<=500 or 530<=i<=560]\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Path 'docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md' -TotalCount 220 | Select-Object -Last 45" in C:\Alok\Business Projects\Goldsmith
 succeeded in 547ms:
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO app_user;
```

**Legacy code retired in the same PR:**
- `apps/api/src/modules/inventory/inventory.service.ts` ƒ?" delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
- `apps/api/src/modules/inventory/inventory.controller.ts` ƒ?" delete `getImageUploadUrl` handler (line 148).
- `apps/api/src/modules/inventory/inventory.repository.ts` ƒ?" delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
- `apps/api/src/modules/inventory/inventory.service.test.ts` ƒ?" delete the `describe('getImageUploadUrl')` block (lines 103ƒ?"130).

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
       Headers: Content-Length ƒ% 5 MB
       Optional field: "alt_text" (string, ƒ% 200 chars)
       Guards: FirebaseJwtGuard ƒ+' TenantInterceptor ƒ+' @Roles('shop_admin', 'shop_manager')
       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
       Errors:
         400 INVALID_MIME       ƒ?" magic-byte sniff failed
         400 IMAGE_TOO_LARGE_AFTER_COMPRESSION ƒ?" sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
         400 INVALID_DIMENSIONS ƒ?" width or height outside [200, 8000]
         409 IMAGE_LIMIT_REACHED ƒ?" 10 already exist on this product
         413 PAYLOAD_TOO_LARGE  ƒ?" body > 5 MB

DELETE /api/v1/products/:productId/images/:imageId
       Guards: same
       Response: 204 No Content; 404 if not found within tenant

PATCH  /api/v1/products/:productId/images/order
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Path 'docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md' -TotalCount 250 | Select-Object -Last 35" in C:\Alok\Business Projects\Goldsmith
 succeeded in 464ms:
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
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n \".\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\" | findstr /r \""'^18[0-9]: ''^19[0-9]: ''^20[0-9]: ''^21[0-9]: ''^22[0-9]: ''^23[0-9]: ''^24[0-9]: ''^37[0-9]: ''^38[0-9]: ''^49[0-9]: ''^54[0-9]: ''^55[0-9]:"' in C:\Alok\Business Projects\Goldsmith
 succeeded in 512ms:
180:- `apps/api/src/modules/inventory/inventory.service.ts` ??? delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
181:- `apps/api/src/modules/inventory/inventory.controller.ts` ??? delete `getImageUploadUrl` handler (line 148).
182:- `apps/api/src/modules/inventory/inventory.repository.ts` ??? delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
183:- `apps/api/src/modules/inventory/inventory.service.test.ts` ??? delete the `describe('getImageUploadUrl')` block (lines 103???130).
185:The new `ProductImagesController` / `ProductImagesService` / `ProductImagesRepository` (defined below) replace this path entirely. No callers of the legacy methods remain in the repo (`countImages` is kept and reused; only the upload-url + insert-record-only path is removed).
187:**Drizzle schema update** (`packages/db/src/schema/product-images.ts`):
188:- Drop `variant` field.
189:- Add `alt_text`, `mime_type`, `byte_size`, `width`, `height`, `exif_stripped_at`, `uploaded_by_user_id`, `scan_status`, `updated_at`.
191:**Audit enum update** (`packages/audit/src/audit-actions.ts`): add
192:- `PRODUCT_IMAGE_UPLOADED`
193:- `PRODUCT_IMAGE_REJECTED` (covers MIME / oversize / scan-rejection)
194:- `PRODUCT_IMAGE_DELETED`
195:- `PRODUCT_IMAGE_REORDERED`
197:---
199:## API
201:### Endpoints
203:```
204:POST   /api/v1/products/:productId/images          (multipart/form-data; field "file")
205:       Headers: Content-Length ??? 5 MB
206:       Optional field: "alt_text" (string, ??? 200 chars)
207:       Guards: FirebaseJwtGuard ??? TenantInterceptor ??? @Roles('shop_admin', 'shop_manager')
208:       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
209:       Errors:
210:         400 INVALID_MIME       ??? magic-byte sniff failed
211:         400 IMAGE_TOO_LARGE_AFTER_COMPRESSION ??? sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
212:         400 INVALID_DIMENSIONS ??? width or height outside [200, 8000]
213:         409 IMAGE_LIMIT_REACHED ??? 10 already exist on this product
214:         413 PAYLOAD_TOO_LARGE  ??? body > 5 MB
216:DELETE /api/v1/products/:productId/images/:imageId
217:       Guards: same
218:       Response: 204 No Content; 404 if not found within tenant
220:PATCH  /api/v1/products/:productId/images/order
221:       Body: { orderedIds: string[] }  (must contain every image of the product, no extras)
222:       Guards: same
223:       Response: 200 { images: ImageRow[] }
224:       Errors: 400 ORDER_LIST_MISMATCH (set inequality); 404 if any id not found in tenant
226:PATCH  /api/v1/products/:productId/images/:imageId
227:       Body: { alt_text: string | null }   (only alt-text editable post-upload)
228:       Guards: same
229:       Response: 200 { image: ImageRow }
230:```
232:### `ProductImagesService`
234:```typescript
235:class ProductImagesService {
236:  async upload(input: {
237:    shopId: string;
238:    productId: string;
239:    userId: string;
240:    file: { buffer: Buffer; mimeType: string; size: number };
241:    altText?: string | null;
242:  }): Promise<ImageRow>;
244:  async delete(shopId: string, productId: string, imageId: string): Promise<void>;
246:  async reorder(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
248:  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow>;
370:    Response: { images: PublicImageRow[] }
371:```
373:`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
375:```typescript
376:type PublicImageRow = {
377:  id: string;
378:  alt_text: string | null;          // null ??? caller renders auto-fallback "<product> ??? ?????????????????? <n>"
379:  width: number;                    // post-rotation
380:  height: number;
381:  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
382:                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
383:  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
384:  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
385:};
386:```
388:`storage_key` is intentionally NOT in the public DTO ??? it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
490:- Each card: thumbnail (200??200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) ?? drag handle (right) ?? alt-text input (one line) ?? "???????????????" button (red, ??? 48 dp).
491:- Tap "+ ??????????????????" ??? `expo-image-picker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: false, quality: 0.95 })`.
492:- Selected image ??? POST as multipart/form-data with `Authorization: Bearer <firebase>`.
493:- Upload progress: indeterminate spinner overlay; on success, append to list; on error, Hindi toast keyed by error code.
495:**i18n** ??? `packages/i18n/locales/hi-IN/inventory.json`:
496:```json
497:"images_title": "?????????????????? ?????? ????????????????????????",
498:"images_add": "?????????????????? ??????????????????",
499:"images_count": "{{n}}/10",
540:| Unit: MIME sniff | `product-images.service.spec.ts` | PHP-renamed-jpg ??? throws `BadRequestException` with code `INVALID_MIME` + audit emitted |
541:| Unit: SVG rejection | same | SVG buffer ??? throws even though magic-bytes match |
542:| Unit: oversized after compression | same | Synthetic high-detail source where the **1920 w** sharp probe at `quality:80, effort:6` exceeds 250 KB ??? throws `BadRequestException` with code `IMAGE_TOO_LARGE_AFTER_COMPRESSION` + audit emitted; corresponding healthy-source case (probe ??? 250 KB) accepts |
543:| Unit: dimension guard | same | 100??100 ??? throws; 9000??9000 ??? throws |
544:| Unit: EXIF strip | same | A JPEG buffer with embedded EXIF (GPS + camera make) processed by `sharp(buf).rotate().toBuffer()` produces output with NO EXIF block (verified via `exifr.parse(out)` returning `null`); visual orientation is preserved (test source has orientation=6 / 90?? rotation) |
545:| Unit: dimensions after rotation | same | A 4000??3000 source with EXIF orientation=6 (rotate 90?? clockwise) ??? after `sharp(buf).rotate().toBuffer()`, the cleaned buffer's metadata reports 3000??4000; the row inserted into `product_images` has `width=3000, height=4000`, NOT the source 4000??3000 |
546:| Unit: upload happy path | same | Inserts row, calls storage `uploadBuffer` once with cleaned buffer + mime, audit `PRODUCT_IMAGE_UPLOADED` |
547:| Unit: image cap | same | 11th upload ??? throws `IMAGE_LIMIT_REACHED`; cap is enforced inside the tx after `FOR UPDATE` lock |
548:| Concurrency: cap under race | `product-images.concurrency.spec.ts` | Two concurrent uploads on a product with 9 images ??? exactly one inserts (count=10), the other throws `IMAGE_LIMIT_REACHED`; verified by spawning two awaiting `Promise.allSettled` calls against a real test DB with the lock pattern |
549:| Security: cross-tenant product attach | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B `productId` ??? 404 `NOT_FOUND` (NOT a 500 from FK violation, NOT a successful insert); blob best-effort deleted afterward; no row in `product_images` |
550:| Unit: reorder | same | `setSortOrders` called with full ordered array; mismatch ??? throws `ORDER_LIST_MISMATCH` |
551:| Unit: delete | same | Repo delete + storage `deleteBlob` called + audit |
552:| Integration: upload ??? list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
553:| Integration: tenant isolation | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B productId ??? 404 |
554:| Integration: RLS at SQL layer | `product-images.rls.spec.ts` | Direct SQL with shop_id=A cannot SELECT shop_id=B images |
555:| Integration: stub storage round-trip | `stub-storage.integration.spec.ts` | uploadBuffer ??? downloadBuffer returns same bytes |
556:| Integration: Azure adapter mocks | `azure-blob.adapter.spec.ts` | `@azure/storage-blob` mocked; SAS URL contains `sp=cw`, `se=` ??? 1h ahead, `sr=b` |
557:| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` ??? contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` ??? contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 ??? contains `mb-0.25` (universal byte-cap invariant) |
558:| Performance: PDP gallery render | `product-gallery.perf.spec.ts` | First image load < 500 ms p95 against ImageKit cached path (with mocked CDN) |
559:| Performance: upload latency | `upload.perf.spec.ts` | Median upload + probe + EXIF strip + DB write < 2 s for a 4 MB JPEG |
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 90c410e''^ 90c410e --no-color --unified=5 -- docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' in C:\Alok\Business Projects\Goldsmith
 succeeded in 439ms:
diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index 7896863..c2a3e1a 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -365,14 +365,31 @@ All queries run inside `withTenantTx`; tenant context (`app.current_shop_id`) is
 ### Public catalog endpoint (read path)
 
 ```
 GET /api/v1/catalog/products/:productId/images
     Public (no auth). Tenant resolved by request domain (existing pattern).
-    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
+    Response: { images: PublicImageRow[] }
 ```
 
-Customer-web `ProductGallery` consumes this. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
+
+```typescript
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;          // null → caller renders auto-fallback "<product> – तस्वीर <n>"
+  width: number;                    // post-rotation
+  height: number;
+  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
+                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
+  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
+  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
+};
+```
+
+`storage_key` is intentionally NOT in the public DTO — it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+
+Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
 ---
 
 ## Storage adapter — extension
 
@@ -499,22 +516,22 @@ Props: `{ images: PublicImageRow[]; productName: string }`.
 Layout:
 - 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
 - ≤ 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
 - Click hero → opens lightbox (`<dialog>`, ESC closes).
 - ←→ arrow keys cycle on desktop. Visible focus ring on the hero on focus.
-- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
+- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
+- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap → expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
-- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.
+- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
 ---
 
 ## Tests
 
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show 90c410e''^:docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md | findstr /n /c:"Customer-web" /c:"srcset" /c:"imagekitUrl" /c:"PublicImageRow"' in C:\Alok\Business Projects\Goldsmith
 succeeded in 754ms:
11:**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest ??? Azure Storage SSE per ADR-0015 supersession), NFR-S3 (tenant-scoped image isolation), NFR-C7 (data residency ??? Azure Central / South India per ADR-0015), NFR-A4 (alt text), NFR-P9 (image p95 < 500 ms thumbnails), NFR-SE-2 (Lighthouse SEO ??? 90)
37:- Customer `<ResponsiveImage>` renders `srcset` of ImageKit URLs with `tr=w-{320|640|1024|1920},q-auto,f-auto,mb-0.25`.
289:    // customer-facing srcset and aspect-ratio CSS need.
333:10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
370:    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
373:Customer-web `ProductGallery` consumes this. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
429:Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision ??1). Width is caller-controlled (different surfaces need different widths ??? `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
432:imagekitUrl(key: string, opts: {
451:| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | ??? | Public PDP gallery |
454:| `public_url` on upload response | 1024 | ??? | Single representative URL returned by API; client renders srcset itself |
473:- Each card: thumbnail (200??200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) ?? drag handle (right) ?? alt-text input (one line) ?? "???????????????" button (red, ??? 48 dp).
497:Props: `{ images: PublicImageRow[]; productName: string }`.
504:- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
515:- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.
540:| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` ??? contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` ??? contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 ??? contains `mb-0.25` (universal byte-cap invariant) |
559:| **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) ?? `ResponsiveImage` atom in `packages/ui-web` ?? `apps/customer-mobile/src/components/products/ProductGallery.tsx` ?? public catalog `GET /catalog/products/:id/images` ?? empty-state fallback to `GoldTexturePlaceholder` |
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Name' in C:\Alok\Business Projects\Goldsmith
 succeeded in 539ms:
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
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Name apps' in C:\Alok\Business Projects\Goldsmith
 succeeded in 571ms:
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
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Name apps\\customer-web" in C:\Alok\Business Projects\Goldsmith
 succeeded in 541ms:
.next
.turbo
app
components
content
lib
node_modules
.env.example
middleware.ts
next-env.d.ts
next.config.mjs
package.json
postcss.config.js
tailwind.config.ts
tsconfig.json
tsconfig.tsbuildinfo
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -Filter '*.tsx' apps\\customer-web\\app | Select-Object -First 20 -ExpandProperty FullName" in C:\Alok\Business Projects\Goldsmith
 succeeded in 569ms:
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\error.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\layout.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\not-found.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\admin\layout.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\admin\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\admin\login\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\admin\_components\ImpersonateButton.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\admin\_components\TenantTable.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\contact\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\loyalty\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\products\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\products\[id]\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\rate-lock\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\return-policy\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\size-guide\[category]\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\try-at-home\page.tsx
C:\Alok\Business Projects\Goldsmith\apps\customer-web\app\wishlist\page.tsx
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"type ImageRow\" /c:\"ImageRow\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 463ms:
223:       Response: 200 { images: ImageRow[] }
229:       Response: 200 { image: ImageRow }
242:  }): Promise<ImageRow>;
246:  async reorder(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
248:  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow>;
250:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
353:  async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow>;
356:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
358:  async setSortOrders(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
359:  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow | null>;
370:    Response: { images: PublicImageRow[] }
373:`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
376:type PublicImageRow = {
390:Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
514:Props: `{ images: PublicImageRow[]; productName: string }`.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Path 'docs\\reviews\\codex-story-17.1-spec-round6-20260501.md' -TotalCount 200" in C:\Alok\Business Projects\Goldsmith
 succeeded in 453ms:
OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019de67e-2e60-7530-bb66-d80dedf6de5f
--------
user
commit 90c410e
2026-05-02T02:22:12.161539Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git rev-parse 90c410e; git rev-parse 90c410e''^'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git rev-parse 90c410e; git rev-parse 90c410e''^' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short; git rev-parse --show-toplevel; git rev-parse 90c410e; git rev-parse 90c410e''^'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Alok\Business Projects\Goldsmith
 succeeded in 455ms:
?? docs/reviews/codex-story-17.1-spec-20260501.md
?? docs/reviews/codex-story-17.1-spec-round2-20260501.md
?? docs/reviews/codex-story-17.1-spec-round3-20260501.md
?? docs/reviews/codex-story-17.1-spec-round4-20260501.md
?? docs/reviews/codex-story-17.1-spec-round5-20260501.md
?? docs/reviews/codex-story-17.1-spec-round6-20260501.md
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied

2026-05-02T02:22:19.270003Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --show-toplevel'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command Get-Location in C:\Alok\Business Projects\Goldsmith
 succeeded in 435ms:

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
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline --decorate --no-renames 90c410e' in C:\Alok\Business Projects\Goldsmith
 succeeded in 415ms:
90c410e (HEAD -> main) docs(story-17.1): codex round 5 Г?" server pre-computes all public URLs
 .../2026-05-01-story-17.1-image-pipeline-design.md | 27 ++++++++++++++++++----
 1 file changed, 22 insertions(+), 5 deletions(-)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --no-ext-diff --unified=80 --no-color 90c410e' in C:\Alok\Business Projects\Goldsmith
 succeeded in 417ms:
commit 90c410e55e4e763d2e31783ebab1b2315ee38139
Author: Alok Tiwari <aloktiwari49@gmail.com>
Date:   Fri May 1 22:21:54 2026 -0400

    docs(story-17.1): codex round 5 Г?" server pre-computes all public URLs
    
    Round-4 patch told the customer-mobile gallery to call
    imagekitUrl(storage_key, ...) on the client, but the public
    PublicImageRow DTO never exposed storage_key. The instruction was
    uncompilable.
    
    Fixed by widening PublicImageRow to carry server-pre-built URLs
    instead of exposing the internal storage_key:
    - srcset: pre-built "url 320w, url 640w, url 1024w, url 1920w" string
    - default_url: single w-1024 URL (LCP / non-srcset fallback)
    - placeholder_url: w-200, blur-30 LQIP
    
    storage_key stays shopkeeper-only (returned only on the authenticated
    upload response). All public surfaces consume server-built URLs that
    already carry mb-0.25 via the imagekitUrl() builder, preserving the
    "every customer-facing URL has the byte cap" invariant without ever
    shipping the URL builder to the client.
    
    Updated customer-web and customer-mobile sections to consume the
    richer DTO directly. Client never composes ImageKit URLs.
    
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index 7896863..c2a3e1a 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -290,306 +290,323 @@ EXIF strip (the bytes that get persisted):
 
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
-    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
+    Response: { images: PublicImageRow[] }
 ```
 
-Customer-web `ProductGallery` consumes this. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
+
+```typescript
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;          // null Г+' caller renders auto-fallback "<product> Г?" ЕЕ,ЕЭ?ЕцЕЭ?Е° <n>"
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Path 'docs\\reviews\\codex-story-17.1-spec-round6-20260501.md' -Tail 120" in C:\Alok\Business Projects\Goldsmith
 succeeded in 469ms:
    - default_url: single w-1024 URL (LCP / non-srcset fallback)
    - placeholder_url: w-200, blur-30 LQIP
    
    storage_key stays shopkeeper-only (returned only on the authenticated
    upload response). All public surfaces consume server-built URLs that
    already carry mb-0.25 via the imagekitUrl() builder, preserving the
    "every customer-facing URL has the byte cap" invariant without ever
    shipping the URL builder to the client.
    
    Updated customer-web and customer-mobile sections to consume the
    richer DTO directly. Client never composes ImageKit URLs.
    
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index 7896863..c2a3e1a 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -290,306 +290,323 @@ EXIF strip (the bytes that get persisted):
 
  6. malware = await scanPort.scan(cleaned, sniffed.mime)            // stub returns {clean:true} in MVP
     if !malware.clean                                              D"+' audit REJECTED + throw 400 SCAN_FAILED
 
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
           // product_images.product_id alone is INSUFFICIENT D"?" PostgreSQL FK
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
 - A storage-upload failure short-circuits D"?" no DB row, clean caller error.
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
 
 All queries run inside `withTenantTx`; tenant context (`app.current_shop_id`) is injected by interceptor before the service call. RLS is the floor; service-level `WHERE shop_id = $caller` is the second layer per the no-cross-tenant rule. The `lockProductForTenant` SELECT is the third D"?" explicit tenant-scoped existence check that does NOT bypass RLS-style logic the way a bare FK constraint does.
 
 ### Public catalog endpoint (read path)
 
 ```
 GET /api/v1/catalog/products/:productId/images
     Public (no auth). Tenant resolved by request domain (existing pattern).
-    Response: { images: PublicImageRow[] }  -- includes public_url + alt_text + width/height
+    Response: { images: PublicImageRow[] }
 ```
 
-Customer-web `ProductGallery` consumes this. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
+
+```typescript
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;          // null D"+' caller renders auto-fallback "<product> D"?" DD,DD-?D„+DD-?DAų <n>"
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Path 'docs\\reviews\\codex-story-17.1-spec-round6-20260501.md' -Tail 120" in C:\Alok\Business Projects\Goldsmith
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:24:42.976109Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
2026-05-02T02:24:46.389503Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"[P\" /c:\"overall_correctness\" \"docs\\reviews\\codex-story-17.1-spec*.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 445ms:
docs\reviews\codex-story-17.1-spec-20260501.md:4627:- [P1] Make migration safe for existing image rows — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
docs\reviews\codex-story-17.1-spec-20260501.md:4630:- [P1] Validate product ownership before storing bytes — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
docs\reviews\codex-story-17.1-spec-20260501.md:4642:- [P2] Use a valid Sharp WebP quality option — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
docs\reviews\codex-story-17.1-spec-20260501.md:4645:- [P2] Use an existing shop role in the guard — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
docs\reviews\codex-story-17.1-spec-20260501.md:4653:- [P1] Make migration safe for existing image rows — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
docs\reviews\codex-story-17.1-spec-20260501.md:4656:- [P1] Validate product ownership before storing bytes — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
docs\reviews\codex-story-17.1-spec-20260501.md:4668:- [P2] Use a valid Sharp WebP quality option — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
docs\reviews\codex-story-17.1-spec-20260501.md:4671:- [P2] Use an existing shop role in the guard — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4110:- [P1] Move product_images cleanup out of the SQL migration — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4113:- [P2] Validate the actual ImageKit bytes — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4116:- [P2] Store dimensions after EXIF rotation — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4123:- [P1] Move product_images cleanup out of the SQL migration — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4126:- [P2] Validate the actual ImageKit bytes — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4129:- [P2] Store dimensions after EXIF rotation — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1564:- [P1] Move product_images cleanup out of the SQL migration ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1567:- [P2] Validate the actual ImageKit bytes ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1570:- [P2] Store dimensions after EXIF rotation ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1577:- [P1] Move product_images cleanup out of the SQL migration ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1580:- [P2] Validate the actual ImageKit bytes ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1583:- [P2] Store dimensions after EXIF rotation ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2163:- [P2] Include the byte cap in the URL builder contract — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2166:- [P2] Remove the stale DELETE cleanup path — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2169:- [P3] Align oversize docs and tests with the 1920w probe — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2177:- [P2] Include the byte cap in the URL builder contract — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2180:- [P2] Remove the stale DELETE cleanup path — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2183:- [P3] Align oversize docs and tests with the 1920w probe — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1006:  docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1013:  docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap - 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1020:  docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1027:  docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1034:  docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap - 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1041:  docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2418:- [P2] Allow documented thumbnail transform variants — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2426:- [P2] Allow documented thumbnail transform variants — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1736:- [P2] Don't build mobile URLs from an absent public field — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1744:- [P2] Don't build mobile URLs from an absent public field — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
docs\reviews\codex-story-17.1-spec-round6-20260501.md:1297:2026-05-02T02:24:42.976109Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
docs\reviews\codex-story-17.1-spec-round6-20260501.md:1299:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\"" in C:\Alok\Business Projects\Goldsmith
docs\reviews\codex-story-17.1-spec-round6-20260501.md:1301:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
docs\reviews\codex-story-17.1-spec-round6-20260501.md:1302:2026-05-02T02:24:46.389503Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
docs\reviews\codex-story-17.1-spec-round6-20260501.md:1304:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }' in C:\Alok\Business Projects\Goldsmith
docs\reviews\codex-story-17.1-spec-round6-20260501.md:1306:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
docs\reviews\codex-story-17.1-spec-round6-20260501.md:1308:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"[P\" /c:\"overall_correctness\" \"docs\\reviews\\codex-story-17.1-spec*.md\"" in C:\Alok\Business Projects\Goldsmith
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Path 'docs\\reviews\\codex-story-17.1-spec-round5-20260501.md' -Tail 80" in C:\Alok\Business Projects\Goldsmith
 succeeded in 441ms:
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

- [P2] Don't build mobile URLs from an absent public field ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
  For the customer-mobile gallery, `Props: same` means it receives `PublicImageRow[]`, and the public catalog endpoint only exposes `public_url`, `alt_text`, and dimensions, not `storage_key`. In that scenario this new instruction to call `imagekitUrl(storage_key, ...)` cannot compile or run unless the public DTO is widened or the API returns the needed variant URLs, so implementers will be forced to bypass the builder or ship a broken gallery.
2026-05-02T02:20:34.381464Z ERROR codex_core::session: failed to record rollout items: thread 019de679-771f-70a1-b580-0671f2a707ff not found
2026-05-02T02:20:34.451925Z ERROR codex_core::session: failed to record rollout items: thread 019de679-76f0-7371-906a-fa111dce147b not found
The updated spec now directs the customer-mobile surface to use a field that its documented public API response does not provide. That would leave implementers without the inputs needed to construct the mandated ImageKit URLs.

Review comment:

- [P2] Don't build mobile URLs from an absent public field ƒ?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
  For the customer-mobile gallery, `Props: same` means it receives `PublicImageRow[]`, and the public catalog endpoint only exposes `public_url`, `alt_text`, and dimensions, not `storage_key`. In that scenario this new instruction to call `imagekitUrl(storage_key, ...)` cannot compile or run unless the public DTO is widened or the API returns the needed variant URLs, so implementers will be forced to bypass the builder or ship a broken gallery.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'findstr /n /c:"default_url" /c:"placeholder_url" /c:"srcset" /c:"storage_key` is intentionally" /c:"preload" "docs'"\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 413ms:
11:**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest — Azure Storage SSE per ADR-0015 supersession), NFR-S3 (tenant-scoped image isolation), NFR-C7 (data residency — Azure Central / South India per ADR-0015), NFR-A4 (alt text), NFR-P9 (image p95 < 500 ms thumbnails), NFR-SE-2 (Lighthouse SEO ≥ 90)
37:- Customer `<ResponsiveImage>` renders `srcset` of ImageKit URLs with `tr=w-{320|640|1024|1920},q-auto,f-auto,mb-0.25`.
289:    // customer-facing srcset and aspect-ratio CSS need.
333:10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
381:  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
383:  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
384:  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
446:Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision §1). Width is caller-controlled (different surfaces need different widths — `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
468:| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | — | Public PDP gallery |
471:| `public_url` on upload response | 1024 | — | Single representative URL returned by API; client renders srcset itself |
521:- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
522:- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
532:- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
557:| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` → contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` → contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 → contains `mb-0.25` (universal byte-cap invariant) |
576:| **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) · `ResponsiveImage` atom in `packages/ui-web` · `apps/customer-mobile/src/components/products/ProductGallery.tsx` · public catalog `GET /catalog/products/:id/images` · empty-state fallback to `GoldTexturePlaceholder` |
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"storage_key\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 385ms:
149:  storage_key          TEXT        NOT NULL,
208:       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
333:10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
373:`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
388:`storage_key` is intentionally NOT in the public DTO — it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
490:- Each card: thumbnail (200×200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
The spec update fixes the missing public mobile URLs, but it introduces contract gaps around authenticated shopkeeper image rendering, responsive preloading, and the renamed public URL field. These should be corrected before implementers rely on the design.

Full review comments:

- [P2] Keep storage_key available to authenticated image reads — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
  For authenticated shopkeeper flows, opening a product that already has images or reloading after a reorder still requires either `storage_key` or a prebuilt thumbnail URL, because the documented card renderer calls `imagekitUrl(storage_key, { width: 200 })`. If `storage_key` is literally returned only on the upload response, persisted images cannot render thumbnails after reload.

- [P2] Preload the responsive candidate, not the fallback URL — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
  On viewports/DPRs where `image.srcset` selects 320, 640, or 1920 instead of the w-1024 `default_url`, this preload fetches a URL the `<img>` may not use, causing a duplicate request or no useful LCP preload. The preload should include `imagesrcset`/`imagesizes` matching the image `sizes`, or otherwise target the same candidate the browser will select.

- [P3] Align public GET expectations with default_url — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
  Implementing this DTO means the public catalog GET no longer returns `public_url`, but the test matrix still says the upload→list integration expects `GET returns inserted row with public_url`. Please update that contract/test to expect `default_url` or explicitly document `public_url` as an alias.
2026-05-02T02:26:39.455755Z ERROR codex_core::session: failed to record rollout items: thread 019de67e-2e88-7c93-9f08-9cf8ec2865a1 not found
2026-05-02T02:26:39.508218Z ERROR codex_core::session: failed to record rollout items: thread 019de67e-2e60-7530-bb66-d80dedf6de5f not found
The spec update fixes the missing public mobile URLs, but it introduces contract gaps around authenticated shopkeeper image rendering, responsive preloading, and the renamed public URL field. These should be corrected before implementers rely on the design.

Full review comments:

- [P2] Keep storage_key available to authenticated image reads — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
  For authenticated shopkeeper flows, opening a product that already has images or reloading after a reorder still requires either `storage_key` or a prebuilt thumbnail URL, because the documented card renderer calls `imagekitUrl(storage_key, { width: 200 })`. If `storage_key` is literally returned only on the upload response, persisted images cannot render thumbnails after reload.

- [P2] Preload the responsive candidate, not the fallback URL — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
  On viewports/DPRs where `image.srcset` selects 320, 640, or 1920 instead of the w-1024 `default_url`, this preload fetches a URL the `<img>` may not use, causing a duplicate request or no useful LCP preload. The preload should include `imagesrcset`/`imagesizes` matching the image `sizes`, or otherwise target the same candidate the browser will select.

- [P3] Align public GET expectations with default_url — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
  Implementing this DTO means the public catalog GET no longer returns `public_url`, but the test matrix still says the upload→list integration expects `GET returns inserted row with public_url`. Please update that contract/test to expect `default_url` or explicitly document `public_url` as an alias.
