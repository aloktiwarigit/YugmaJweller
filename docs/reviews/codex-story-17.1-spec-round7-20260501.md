OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019de683-d9e1-72a3-9f62-001ec28a7fe5
--------
user
commit 794d99e
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline --decorate --no-renames 794d99e' in C:\Alok\Business Projects\Goldsmith
 succeeded in 507ms:
794d99e (HEAD -> main) docs(story-17.1): codex round 6 — split shopkeeper/public DTOs + responsive preload
 .../2026-05-01-story-17.1-image-pipeline-design.md | 56 +++++++++++++++++++---
 1 file changed, 49 insertions(+), 7 deletions(-)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --no-ext-diff --unified=80 --no-renames 794d99e -- "*.md"' in C:\Alok\Business Projects\Goldsmith
 succeeded in 488ms:
commit 794d99ea92caa4507d0bdd7870c0ffcf5fdc442e
Author: Alok Tiwari <aloktiwari49@gmail.com>
Date:   Fri May 1 22:28:06 2026 -0400

    docs(story-17.1): codex round 6 — split shopkeeper/public DTOs + responsive preload
    
    Round-5 patch hid storage_key from the public DTO (correct) but my
    wording said "storage_key returned only on the upload response" — too
    narrow. The shopkeeper image manager re-renders thumbnails after every
    reload (calling imagekitUrl(storage_key, { width: 200 })), so it needs
    storage_key on every authenticated read, not just the upload response.
    
    Made the two DTOs explicit:
    - ImageRow (authenticated shopkeeper) — includes storage_key + scan_status
      + uploaded_by + timestamps. Returned by POST upload, GET list, PATCH
      reorder, PATCH alt-text. Shopkeeper UI builds thumbnail URLs via the
      builder against the row's storage_key.
    - PublicImageRow (anonymous catalog) — server-pre-built srcset +
      default_url + placeholder_url; no storage_key. Server maps ImageRow
      → PublicImageRow at the catalog endpoint boundary.
    
    Round-5 also said "first image preload uses href={default_url}" but on
    mobile viewports the browser picks 320w/640w from the srcset, so the
    1024w preload was wasted. Fixed: preload now emits imagesrcset +
    imagesizes matching the <img srcset> + sizes so the browser preloads
    the SAME candidate it'll pick.
    
    Cleaned up stale "public_url" references in the upload response shape
    (now returns full ImageRow), the upload flow's step-10 return, and the
    caller-side width vocabulary table.
    
    Updated test rows to assert: (a) authenticated GET returns ImageRow
    with storage_key, (b) anonymous catalog GET returns PublicImageRow
    with all three URL fields and NO storage_key.
    
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index c2a3e1a..36a3bf6 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -128,505 +128,547 @@ If Codex flags this, the Phase-2 implementer can revisit — the AC's "403" phra
 
 1. No FKs into `product_images` exist (`grep -r 'REFERENCES product_images' packages/db` returns zero matches).
 2. `product_images` has zero production data (anchor SOW unsigned; only stub rows from manual dev tests via the legacy `getImageUploadUrl` fire-and-forget path).
 3. The legacy upload path code is deleted in the same PR (see "Legacy code retired" below), so no new stub rows can appear after this migration.
 
 ```sql
 -- 0057_product_images_pipeline.sql
 -- Story 17.1 — recreate product_images for the real upload pipeline.
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
 - `apps/api/src/modules/inventory/inventory.service.ts` — delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
 - `apps/api/src/modules/inventory/inventory.controller.ts` — delete `getImageUploadUrl` handler (line 148).
 - `apps/api/src/modules/inventory/inventory.repository.ts` — delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
 - `apps/api/src/modules/inventory/inventory.service.test.ts` — delete the `describe('getImageUploadUrl')` block (lines 103–130).
 
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
        Headers: Content-Length ≤ 5 MB
        Optional field: "alt_text" (string, ≤ 200 chars)
        Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
-       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
+       Response 201: ImageRow  (full shape — see "Authenticated shopkeeper response" type below; shopkeeper UI renders thumbnails by calling imagekitUrl(row.storage_key, { width: 200 }))
        Errors:
          400 INVALID_MIME       — magic-byte sniff failed
          400 IMAGE_TOO_LARGE_AFTER_COMPRESSION — sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
          400 INVALID_DIMENSIONS — width or height outside [200, 8000]
          409 IMAGE_LIMIT_REACHED — 10 already exist on this product
          413 PAYLOAD_TOO_LARGE  — body > 5 MB
 
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
  1. validate: file.size ≤ 5 MB                                    → throw 413 PAYLOAD_TOO_LARGE
  2. sniffed = await fileType.fromBuffer(file.buffer)
     if sniffed.mime ∉ ALLOW_LIST                                  → audit REJECTED + throw 400 INVALID_MIME
     (ALLOW_LIST = image/jpeg, image/png, image/webp, image/heic — SVG explicitly excluded)
  3. meta = await sharp(file.buffer).metadata()
     if meta.width < 200 || meta.height < 200                      → throw 400 INVALID_DIMENSIONS
     if meta.width > 8000 || meta.height > 8000                    → throw 400 INVALID_DIMENSIONS
 
 Variant byte-cap probe (worst-case width = 1920w):
  4. probe = await sharp(file.buffer)
               .rotate()                                             // apply EXIF orientation, then drop tag
               .resize({ width: 1920, withoutEnlargement: true })
               .toFormat('webp', { quality: 80, effort: 6 })
               .toBuffer()
     if probe.byteLength > 250_000                                 → audit REJECTED + throw 400 IMAGE_TOO_LARGE_AFTER_COMPRESSION
     (rationale: if 1920w fits ≤250 KB at q-80/effort-6, the smaller widths
      320w/640w/1024w under ImageKit's q-auto definitely will. ImageKit's
      q-auto uses similar heuristics; sharp probe at q-80 is a conservative
      proxy. Documented assumption; verified during smoke testing.)
 
 EXIF strip (the bytes that get persisted):
  5. cleaned = await sharp(file.buffer).rotate().toBuffer()
     // .rotate() applies EXIF orientation tag, then sharp's default toBuffer()
     // strips ALL metadata (EXIF, ICC, GPS) — verified per sharp v0.31+ docs:
     // "default behaviour, when withMetadata() is not called, strips all metadata"
 
  5b. cleanedMeta = await sharp(cleaned).metadata()
     // Re-read width/height AFTER rotate, because sources with EXIF orientation
     // 5/6/7/8 (90° / 270°) physically swap pixel dimensions during .rotate().
     // step-3 meta.width/height reflect the source orientation; the persisted
     // bytes have cleanedMeta.width/height. Storing the latter is what the
     // customer-facing srcset and aspect-ratio CSS need.
 
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
 
-10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
+10. return row  // ImageRow including storage_key — shopkeeper UI builds its own thumbnail URLs via imagekitUrl()
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
     Response: { images: PublicImageRow[] }
 ```
 
 `PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
 
 ```typescript
 type PublicImageRow = {
   id: string;
   alt_text: string | null;          // null → caller renders auto-fallback "<product> – तस्वीर <n>"
   width: number;                    // post-rotation
   height: number;
   srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
                                     // every URL carries q-auto, f-auto, mb-0.25 via the builder
   default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
   placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
 };
 ```
 
-`storage_key` is intentionally NOT in the public DTO — it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+`storage_key` is intentionally **NOT in the public DTO** — `PublicImageRow` is anonymous-anyone consumable, so the internal blob path is hidden behind server-built URLs.
 
-Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+**Authenticated shopkeeper endpoints, however, return `storage_key` and the full row** because the shopkeeper image manager (the mobile screen that lists, reorders, and deletes images) needs to construct thumbnail URLs via `imagekitUrl(row.storage_key, { width: 200 })` for every image — including images persisted on prior visits. The two DTO shapes are explicitly different:
+
+```typescript
+// Authenticated shopkeeper response (GET /api/v1/products/:productId/images,
+// POST upload, PATCH reorder, PATCH alt-text)
+type ImageRow = {
+  id: string;
+  shop_id: string;
+  product_id: string;
+  storage_key: string;            // exposed: shopkeeper owns the data
+  alt_text: string | null;
+  mime_type: string;
+  byte_size: number;
+  width: number;
+  height: number;
+  exif_stripped_at: string;       // ISO timestamp
+  uploaded_by_user_id: string;
+  scan_status: 'pending' | 'clean' | 'rejected';
+  sort_order: number;
+  created_at: string;
+  updated_at: string;
+};
+
+// Anonymous public response (GET /api/v1/catalog/products/:productId/images)
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;
+  width: number;
+  height: number;
+  srcset: string;                 // server-pre-built; no storage_key exposed
+  default_url: string;
+  placeholder_url: string;
+};
+```
+
+The public catalog endpoint maps `ImageRow` → `PublicImageRow` server-side, calling `imagekitUrl(row.storage_key, { width: N })` for every needed variant. All public surfaces consume `PublicImageRow[]` directly, preserving the "every customer-facing URL has `mb-0.25`" invariant — the client never composes ImageKit URLs.
+
+Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
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
-| `public_url` on upload response | 1024 | — | Single representative URL returned by API; client renders srcset itself |
+| `PublicImageRow.default_url` (server-built) | 1024 | — | Public catalog response field; non-srcset fallback / LCP preload `href` |
+| `PublicImageRow.placeholder_url` (server-built) | 200 | 30 | Public catalog response field; LQIP for `<img>` decoration / `expo-image` placeholder |
+| `PublicImageRow.srcset` (server-built) | 320 / 640 / 1024 / 1920 | — | Pre-built srcset string for customer `<img srcset>` |
 
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
 - Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
+- `loading="lazy"` on all but the first image; the first image's responsive preload is emitted via `next/head` as
+  `<link rel="preload" as="image" fetchpriority="high" href={image.default_url} imagesrcset={image.srcset} imagesizes={sizes}>`
+  so the browser preloads the SAME candidate it picks from the `<img srcset>` (otherwise on a 320w mobile viewport the browser would fetch w-320 from the `<img>` while preload wasted bytes on w-1024). `href` is the non-srcset fallback for browsers that ignore `imagesrcset`.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap → expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
 - Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
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
-| Integration: upload → list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
+| Integration: upload → list (shopkeeper) | `product-images.integration.spec.ts` | Authenticated POST then authenticated GET `/products/:id/images` → returns `ImageRow[]` with `storage_key`, all timestamps, `scan_status`, etc. |
+| Integration: upload → public catalog | `product-images.public-catalog.spec.ts` | Authenticated POST then anonymous GET `/catalog/products/:id/images` → returns `PublicImageRow[]` with `srcset`, `default_url`, `placeholder_url` (all containing `mb-0.25`); `storage_key` field is absent from response JSON |
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
 
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:28:34.814002Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content -Path '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { '{0,4}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 180 -First 220'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content -Path '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { '{0,4}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 180 -First 220' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content -Path '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { '{0,4}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 180 -First 220'` rejected: blocked by policy
2026-05-02T02:28:39.823650Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180 < i <= 400:
        print(f'{i:4}: {line}')
PY"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180 < i <= 400:
        print(f'{i:4}: {line}')
PY" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180 < i <= 400:
        print(f'{i:4}: {line}')
PY"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n \".*\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 432ms:
1:# Story 17.1 — Product Image Pipeline Design
2:
3:**Date:** 2026-05-01
4:**Class:** A (multi-tenant storage, encrypted-at-rest assets, RLS-protected metadata, signed-URL upload, EXIF-stripping pipeline)
5:**Wave:** 7A — foundation; blocks 17.10 / 18.1 / 18.5 / 18.6 / 18.10
6:**Worktree:** `C:/gs17a-img/`
7:**Branch:** `feat/story-17.1-image-pipeline`
8:**Migration reserved:** 0057
9:**Source artefacts:** `_bmad-output/planning-artifacts/epics-E17-E18.md` Story 17.1 · `docs/customer-storefront-gap-analysis-2026-05-01.md` §T1.1 · `docs/prd-addendum-customer-storefront.md` FR90/NFR-IMG-1
10:**FRs implemented:** FR90 (multi-image PDP — completion); foundation for FR127 / FR135
11:**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest — Azure Storage SSE per ADR-0015 supersession), NFR-S3 (tenant-scoped image isolation), NFR-C7 (data residency — Azure Central / South India per ADR-0015), NFR-A4 (alt text), NFR-P9 (image p95 < 500 ms thumbnails), NFR-SE-2 (Lighthouse SEO ≥ 90)
12:
13:---
14:
15:## What we're building
16:
17:A shopkeeper can upload, reorder, edit alt-text, and delete real product photographs against a product. The customer storefront (web + mobile) replaces the `GoldTexturePlaceholder` stub with a real multi-image gallery driven by ImageKit-transformed CDN URLs.
18:
19:The pipeline must:
20:- Refuse non-image uploads via magic-byte sniffing.
21:- Strip EXIF (GPS, device fingerprint) before persistence.
22:- Reject pathological sources that cannot compress under 250 KB at the smallest variant.
23:- Persist metadata in `product_images` under tenant RLS.
24:- Mint short-lived Azure SAS upload URLs and unsigned ImageKit transform URLs for read.
25:- Ship dual-mode: STUB adapter for dev/CI (no Azure spend), AZURE+IMAGEKIT adapter for production (ready when SOW signs).
26:
27:---
28:
29:## Design decisions
30:
31:### 1. Lazy variant generation via ImageKit transforms (one blob per source)
32:
33:The story AC says "ImageKit transcodes the source into 4 variants (320w / 640w / 1024w / 1920w) all under 250 KB each." We satisfy this with on-demand transforms, not eager pre-transcode:
34:
35:- One Azure Blob per uploaded source image.
36:- One `product_images` row per source (no per-variant rows).
37:- Customer `<ResponsiveImage>` renders `srcset` of ImageKit URLs with `tr=w-{320|640|1024|1920},q-auto,f-auto,mb-0.25`.
38:- ImageKit serves WebP / AVIF (`f-auto`) and adaptive quality (`q-auto`).
39:- The `mb-0.25` transform parameter caps each variant at 0.25 MB (250 KB) on the **CDN side** — ImageKit iteratively reduces quality until the response body fits. This is the binding NFR-IMG-1 enforcement, independent of the upload-time sharp probe (the probe is only a fast pre-reject for pathological sources; ImageKit's `mb-` is what the customer actually receives).
40:- First request to a new variant width has a 1–2 s cold-cache penalty; cache warms on first viewer. For an anchor MVP with low traffic per width, the warmed-up p95 ≤ 500 ms target is comfortable.
41:
42:**Plan caveat:** ImageKit's `mb-` transformation is supported on the Free + Standard plans (verified during Phase 2 plan-session against ImageKit's current docs as part of WS-A); if a future plan-tier change ever drops `mb-` support, we fall back to per-width fixed quality bands (`q-{tier-specific}` chosen against typical jewellery photos). Recorded as a residual risk.
43:
44:**Rejected:** eager pre-transcode (4× storage cost, second BullMQ worker, duplicates work the CDN already does). Hybrid (pre-bake LCP only) was considered and rejected as YAGNI. **Sharp-probe-only enforcement** (without ImageKit `mb-`) was Codex round-1 wording — round-2 review correctly noted that sharp's WebP encoder ≠ ImageKit's `q-auto` encoder, so the probe cannot guarantee the CDN output fits 250 KB; the `mb-` parameter closes that gap on ImageKit's side.
45:
46:### 2. Server-routed upload with synchronous validation
47:
48:Browser POSTs `multipart/form-data` to the API. The API:
49:1. Enforces 5 MB body cap at NestJS interceptor (HTTP 413 + Hindi error if exceeded).
50:2. MIME-sniffs via `file-type` magic-byte detection. Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`. SVG is rejected outright (script-injection risk).
51:3. Probes the **largest** variant (`1920w`) via `sharp` re-encoding to WebP at `quality: 80, effort: 6` to check if it fits ≤ 250 KB. If 1920w fits, the smaller widths (320w/640w/1024w) under ImageKit `q-auto,f-auto` are guaranteed to. If not → HTTP 400 + Hindi error + `IMAGE_TOO_LARGE_AFTER_COMPRESSION` audit row.
52:4. Strips EXIF using sharp's **default** behaviour after `.rotate()`: `sharp(buf).rotate().toBuffer()`. Per sharp v0.31+ docs, the default behaviour (no `withMetadata()` call) strips ALL metadata including EXIF, ICC, and GPS. `.rotate()` applies the source EXIF orientation and then drops the orientation tag, so visual orientation is preserved while metadata is gone.
53:5. Writes the cleaned buffer to Azure (or stub-disk) **before** the DB transaction.
54:6. Inside a DB transaction with `SELECT ... FOR UPDATE` on `products` row: verifies tenant ownership (FK alone is insufficient — PostgreSQL FK checks bypass RLS), enforces the 10-image cap atomically, computes next sort order, inserts the row, emits the audit event.
55:
56:**Rejected:** direct-to-Azure SAS upload (eventual error model conflicts with the AC's synchronous 400 wording; would require pending/rejected state machine in the table). ImageKit-direct upload (loses control of EXIF strip + audit point + Azure data-residency). Probing only the smallest 320w variant (false positive — high-detail jewellery sources can pass 320w but exceed 250KB at 1920w under ImageKit q-auto, violating NFR-IMG-1 silently).
57:
58:### 3. MIME sniff + port-stub for malware scan; no AV in MVP
59:
60:The AC's named threat — PHP webshell renamed `.jpg` — is fully addressed by magic-byte mismatch (PHP source is ASCII; doesn't satisfy any image magic-byte signature). Beyond that, the realistic threat surface for shopkeeper-authenticated image uploads is:
61:
62:- Webshell-as-image — defeated because ImageKit-transformed bytes are what's served, not the original.
63:- Polyglot (image + JS) — defeated by `Content-Type: image/*` enforcement on egress + browser image-tag isolation.
64:- libvips CVEs — defeated by MIME + width / height / byte caps before `sharp` runs.
65:- Steganography — not a malware vector for our threat model.
66:
67:Story ships:
68:- `MalwareScanPort` interface in `@goldsmith/integrations-storage` with a single method `scan(buf: Buffer, mime: string): Promise<{ clean: boolean; reason?: string }>`.
69:- `StubMalwareScanAdapter` that returns `{ clean: true }` unconditionally. Wired by default.
70:- `scan_status` column defaults to `'clean'` in MVP.
71:- Threat model + runbook explicitly record "MIME sniff is sole AV layer in MVP; ClamAV / Defender deferred to SOW funding." A future Class A story can swap the stub for `ClamAVAdapter` without schema migration.
72:
73:**Rejected:** synchronous ClamAV (blows the ≤ $20/mo Container Apps consumption tier; 200–1000 ms latency per upload). Async BullMQ scan (worker + state machine for negligible MVP threat reduction).
74:
75:### 4. Real Azure + ImageKit adapter shipped behind feature flag
76:
77:`STORAGE_ADAPTER` env var controls runtime adapter selection:
78:- `stub` (default for dev / CI) → `StubStorageAdapter`. Writes to `tmp/storage/` on local disk; serves blobs via dev-only `/dev-storage/:key` route. **Never** wired in production.
79:- `azure-imagekit` (production) → `AzureBlobStorageAdapter` for SAS upload + private blob storage; `ImageKitTransformUrlBuilder` for read URLs (URL-builder only, not ImageKit's auth API — public-by-construction transform URLs need no signing token).
80:
81:When SOW signs and Azure is provisioned, flip one env var. Zero code change. Adapter code is unit-tested against `@azure/storage-blob` mocks; real-Azure smoke is a post-SOW manual verification step (recorded as a residual risk in the runbook).
82:
83:**Rejected:** stub-only ship with adapter as a separate post-SOW story. Risk: integration assumptions never verified; adapter contract diverges from real Azure SAS semantics; expensive bug to find later.
84:
85:### 5. Schema extends `product_images` (migration 0057)
86:
87:Migration 0014 already created the table with `shop_id` + RLS + `ON DELETE CASCADE` from products. Migration 0057:
88:
89:- **DROPs** unused `variant` column (zero callers, zero data — confirmed via grep).
90:- **ADDs** 9 columns + 1 index (see §Migration below).
91:
92:### 6. Hard delete with confirm, drag-handle reorder
93:
94:- Delete: shopkeeper opens the image in the manager, taps "हटाएं", confirms in a Hindi modal. Single SQL DELETE within tenant-tx. The Azure blob is also deleted (`DELETE_BLOB` job — best-effort; blob orphans don't break correctness, only waste pennies).
95:- Reorder: `react-native-draggable-flatlist` (mobile shopkeeper). Drag emits `PATCH /products/:id/images/order` with the full ordered ID array; service does an atomic UPDATE of `sort_order` for all rows in tenant-tx.
96:- No soft delete. An image is not a compliance artefact; FK cascade on product delete already covers cleanup.
97:
98:### 7. Cap of 10 images per product
99:
100:Hard reject the 11th upload with HTTP 409 + Hindi error "एक उत्पाद की अधिकतम 10 तस्वीरें". Cap enforced in service via `inventory.repository.countImages()` (already implemented in 3.5 work).
101:
102:### 8. 404 (not 403) on cross-tenant API access — deliberate AC deviation
103:
104:The Story 17.1 AC says: *"a customer of Tenant-B has the URL of a Rajesh-shop image → the image loads (signed URLs are public-by-construction, intentional) BUT the API endpoints to list/modify/delete images return 403 (RLS blocks cross-tenant via API)."*
105:
106:We deviate from "403" to **404** for the API endpoints, matching the established tenant-isolation pattern across Story 1.5 (staff revocation), Story 6.1 (customer CRM), and the project rule "tenant-mismatch row not found = 404, no existence disclosure." Specifically:
107:
108:- Strict 403 implementation would require an explicit cross-tenant detection query (extra round-trip).
109:- For images, public ImageKit URLs already disclose existence; "404 vs 403" semantic difference is moot for confidentiality.
110:- 404-uniform reduces controller branching and matches every other tenant-scoped endpoint in the codebase.
111:
112:If Codex flags this, the Phase-2 implementer can revisit — the AC's "403" phrasing was almost certainly descriptive ("the API blocks it") not prescriptive ("with HTTP code 403"). Recorded here so the deviation is explicit and reviewable.
113:
114:### 9. Alt text is nullable with auto-generated fallback
115:
116:- Column `alt_text TEXT NULL`.
117:- Render fallback when NULL: `<product_name> – तस्वीर <sort_order + 1>`.
118:- Shopkeeper can override per image via a single text input on the upload screen.
119:- Auto-fallback is not persisted (computed at render).
120:
121:---
122:
123:## Migration 0057
124:
125:**File:** `packages/db/src/migrations/0057_product_images_pipeline.sql`
126:
127:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
128:
129:1. No FKs into `product_images` exist (`grep -r 'REFERENCES product_images' packages/db` returns zero matches).
130:2. `product_images` has zero production data (anchor SOW unsigned; only stub rows from manual dev tests via the legacy `getImageUploadUrl` fire-and-forget path).
131:3. The legacy upload path code is deleted in the same PR (see "Legacy code retired" below), so no new stub rows can appear after this migration.
132:
133:```sql
134:-- 0057_product_images_pipeline.sql
135:-- Story 17.1 — recreate product_images for the real upload pipeline.
136:--
137:-- DDL-only (migrator role compatible). No DML inside .sql migrations
138:-- per docs/db-workflow.md.
139:
140:-- Drop the original 0014 table (zero production data; no FK dependencies).
141:-- CASCADE removes the policy + grants + index implicitly.
142:DROP TABLE product_images CASCADE;
143:
144:-- Recreate with the full Story-17.1 schema.
145:CREATE TABLE product_images (
146:  shop_id              UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
147:  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
148:  product_id           UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
149:  storage_key          TEXT        NOT NULL,
150:  alt_text             TEXT,                                                            -- nullable; fallback computed at render
151:  mime_type            TEXT        NOT NULL,
152:  byte_size            BIGINT      NOT NULL,
153:  width                INTEGER     NOT NULL,
154:  height               INTEGER     NOT NULL,
155:  exif_stripped_at     TIMESTAMPTZ NOT NULL,
156:  uploaded_by_user_id  UUID        NOT NULL REFERENCES shop_users(id),
157:  scan_status          TEXT        NOT NULL DEFAULT 'clean'
158:    CHECK (scan_status IN ('pending', 'clean', 'rejected')),
159:  sort_order           INTEGER     NOT NULL DEFAULT 0,
160:  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
161:  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
162:);
163:
164:CREATE INDEX product_images_shop_id_idx       ON product_images (shop_id);
165:CREATE INDEX product_images_product_id_idx    ON product_images (product_id);
166:CREATE INDEX product_images_product_sort_idx  ON product_images (product_id, sort_order);
167:
168:ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
169:ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
170:DROP POLICY IF EXISTS rls_product_images_tenant_isolation ON product_images;
171:CREATE POLICY rls_product_images_tenant_isolation ON product_images
172:  FOR ALL
173:  USING       (shop_id = current_setting('app.current_shop_id', true)::uuid)
174:  WITH CHECK  (shop_id = current_setting('app.current_shop_id', true)::uuid);
175:
176:GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO app_user;
177:```
178:
179:**Legacy code retired in the same PR:**
180:- `apps/api/src/modules/inventory/inventory.service.ts` — delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
181:- `apps/api/src/modules/inventory/inventory.controller.ts` — delete `getImageUploadUrl` handler (line 148).
182:- `apps/api/src/modules/inventory/inventory.repository.ts` — delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
183:- `apps/api/src/modules/inventory/inventory.service.test.ts` — delete the `describe('getImageUploadUrl')` block (lines 103–130).
184:
185:The new `ProductImagesController` / `ProductImagesService` / `ProductImagesRepository` (defined below) replace this path entirely. No callers of the legacy methods remain in the repo (`countImages` is kept and reused; only the upload-url + insert-record-only path is removed).
186:
187:**Drizzle schema update** (`packages/db/src/schema/product-images.ts`):
188:- Drop `variant` field.
189:- Add `alt_text`, `mime_type`, `byte_size`, `width`, `height`, `exif_stripped_at`, `uploaded_by_user_id`, `scan_status`, `updated_at`.
190:
191:**Audit enum update** (`packages/audit/src/audit-actions.ts`): add
192:- `PRODUCT_IMAGE_UPLOADED`
193:- `PRODUCT_IMAGE_REJECTED` (covers MIME / oversize / scan-rejection)
194:- `PRODUCT_IMAGE_DELETED`
195:- `PRODUCT_IMAGE_REORDERED`
196:
197:---
198:
199:## API
200:
201:### Endpoints
202:
203:```
204:POST   /api/v1/products/:productId/images          (multipart/form-data; field "file")
205:       Headers: Content-Length ≤ 5 MB
206:       Optional field: "alt_text" (string, ≤ 200 chars)
207:       Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
208:       Response 201: ImageRow  (full shape — see "Authenticated shopkeeper response" type below; shopkeeper UI renders thumbnails by calling imagekitUrl(row.storage_key, { width: 200 }))
209:       Errors:
210:         400 INVALID_MIME       — magic-byte sniff failed
211:         400 IMAGE_TOO_LARGE_AFTER_COMPRESSION — sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
212:         400 INVALID_DIMENSIONS — width or height outside [200, 8000]
213:         409 IMAGE_LIMIT_REACHED — 10 already exist on this product
214:         413 PAYLOAD_TOO_LARGE  — body > 5 MB
215:
216:DELETE /api/v1/products/:productId/images/:imageId
217:       Guards: same
218:       Response: 204 No Content; 404 if not found within tenant
219:
220:PATCH  /api/v1/products/:productId/images/order
221:       Body: { orderedIds: string[] }  (must contain every image of the product, no extras)
222:       Guards: same
223:       Response: 200 { images: ImageRow[] }
224:       Errors: 400 ORDER_LIST_MISMATCH (set inequality); 404 if any id not found in tenant
225:
226:PATCH  /api/v1/products/:productId/images/:imageId
227:       Body: { alt_text: string | null }   (only alt-text editable post-upload)
228:       Guards: same
229:       Response: 200 { image: ImageRow }
230:```
231:
232:### `ProductImagesService`
233:
234:```typescript
235:class ProductImagesService {
236:  async upload(input: {
237:    shopId: string;
238:    productId: string;
239:    userId: string;
240:    file: { buffer: Buffer; mimeType: string; size: number };
241:    altText?: string | null;
242:  }): Promise<ImageRow>;
243:
244:  async delete(shopId: string, productId: string, imageId: string): Promise<void>;
245:
246:  async reorder(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
247:
248:  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow>;
249:
250:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
251:}
252:```
253:
254:**`upload()` flow:**
255:
256:```
257:Pre-flight (no DB tx, fast-fail to caller):
258: 1. validate: file.size ≤ 5 MB                                    → throw 413 PAYLOAD_TOO_LARGE
259: 2. sniffed = await fileType.fromBuffer(file.buffer)
260:    if sniffed.mime ∉ ALLOW_LIST                                  → audit REJECTED + throw 400 INVALID_MIME
261:    (ALLOW_LIST = image/jpeg, image/png, image/webp, image/heic — SVG explicitly excluded)
262: 3. meta = await sharp(file.buffer).metadata()
263:    if meta.width < 200 || meta.height < 200                      → throw 400 INVALID_DIMENSIONS
264:    if meta.width > 8000 || meta.height > 8000                    → throw 400 INVALID_DIMENSIONS
265:
266:Variant byte-cap probe (worst-case width = 1920w):
267: 4. probe = await sharp(file.buffer)
268:              .rotate()                                             // apply EXIF orientation, then drop tag
269:              .resize({ width: 1920, withoutEnlargement: true })
270:              .toFormat('webp', { quality: 80, effort: 6 })
271:              .toBuffer()
272:    if probe.byteLength > 250_000                                 → audit REJECTED + throw 400 IMAGE_TOO_LARGE_AFTER_COMPRESSION
273:    (rationale: if 1920w fits ≤250 KB at q-80/effort-6, the smaller widths
274:     320w/640w/1024w under ImageKit's q-auto definitely will. ImageKit's
275:     q-auto uses similar heuristics; sharp probe at q-80 is a conservative
276:     proxy. Documented assumption; verified during smoke testing.)
277:
278:EXIF strip (the bytes that get persisted):
279: 5. cleaned = await sharp(file.buffer).rotate().toBuffer()
280:    // .rotate() applies EXIF orientation tag, then sharp's default toBuffer()
281:    // strips ALL metadata (EXIF, ICC, GPS) — verified per sharp v0.31+ docs:
282:    // "default behaviour, when withMetadata() is not called, strips all metadata"
283:
284: 5b. cleanedMeta = await sharp(cleaned).metadata()
285:    // Re-read width/height AFTER rotate, because sources with EXIF orientation
286:    // 5/6/7/8 (90° / 270°) physically swap pixel dimensions during .rotate().
287:    // step-3 meta.width/height reflect the source orientation; the persisted
288:    // bytes have cleanedMeta.width/height. Storing the latter is what the
289:    // customer-facing srcset and aspect-ratio CSS need.
290:
291: 6. malware = await scanPort.scan(cleaned, sniffed.mime)            // stub returns {clean:true} in MVP
292:    if !malware.clean                                              → audit REJECTED + throw 400 SCAN_FAILED
293:
294:Storage upload (BEFORE DB tx; orphan on tx failure is acceptable):
295: 7. storageKey = `tenant/${shopId}/products/${productId}/${uuid()}.${extFromMime(sniffed.mime)}`
296: 8. await storagePort.uploadBuffer(storageKey, cleaned, sniffed.mime)
297:
298:DB transaction with pessimistic product-row lock (serializes uploads per product):
299: 9. await withTenantTx(async (tx) => {
300:     a. owned = await tx.query(
301:          `SELECT id FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
302:          [productId, shopId]
303:        )
304:        if owned.rowCount === 0:
305:          // Cross-tenant attempt OR product doesn't exist. FK on
306:          // product_images.product_id alone is INSUFFICIENT — PostgreSQL FK
307:          // checks bypass RLS, so without this explicit tenant-scoped lookup
308:          // an attacker with a tenant-A token could attach an image row to
309:          // tenant-B's product_id. The FOR UPDATE lock also serializes
310:          // concurrent uploads against the cap.
311:          throw 404 NOT_FOUND  (after best-effort blob delete)
312:
313:     b. count = await tx.query(`SELECT COUNT(*) FROM product_images WHERE product_id = $1`, [productId])
314:        if count >= 10:
315:          throw 409 IMAGE_LIMIT_REACHED  (after best-effort blob delete)
316:
317:     c. nextSort = await tx.query(
318:          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
319:          [productId]
320:        )
321:
322:     d. row = await tx.query(`INSERT INTO product_images (...) VALUES (...) RETURNING ...`, {
323:          shopId, productId, storageKey, mimeType: sniffed.mime, byteSize: cleaned.length,
324:          width: cleanedMeta.width, height: cleanedMeta.height,        // post-rotation dimensions
325:          sortOrder: nextSort,
326:          altText, uploadedByUserId: userId, exifStrippedAt: NOW(), scanStatus: 'clean',
327:        })
328:
329:     e. await audit.emit(tx, PRODUCT_IMAGE_UPLOADED, { imageId: row.id, byteSize: cleaned.length })
330:     return row
331:   })
332:
333:10. return row  // ImageRow including storage_key — shopkeeper UI builds its own thumbnail URLs via imagekitUrl()
334:```
335:
336:**Transaction boundary clarification:** storage upload (step 8) runs **before** the DB transaction (step 9) so that:
337:- A storage-upload failure short-circuits — no DB row, clean caller error.
338:- If the DB tx rolls back (cross-tenant 404, cap 409), the orphan blob is deleted on a best-effort basis in the catch handler; if the delete fails, reconciliation sweep (Phase 3+ runbook task) cleans it up. Impact: pennies of wasted storage; never a row-without-blob.
339:- The pessimistic `SELECT ... FOR UPDATE` on `products` row inside the tx serializes concurrent uploads for the same product, making the 10-cap inviolable under any concurrency.
340:
341:### `ProductImagesRepository`
342:
343:```typescript
344:class ProductImagesRepository {
345:  // The upload flow uses raw tx queries (lockProductForUpdate + countImagesInTx +
346:  // nextSortOrderInTx + insertInTx) so that a single tenant-tx contains the whole
347:  // critical section: tenant ownership check, cap enforcement, sort_order
348:  // computation, insert, audit. See ProductImagesService.upload() for the exact
349:  // SQL. Each step is implemented as a small helper on this repo:
350:  async lockProductForTenant(tx: Tx, shopId: string, productId: string): Promise<{ id: string } | null>;
351:  async countImagesInTx(tx: Tx, productId: string): Promise<number>;
352:  async nextSortOrderInTx(tx: Tx, productId: string): Promise<number>;          // returns 0 if empty
353:  async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow>;
354:
355:  // Read + mutating endpoints used outside the upload flow:
356:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
357:  async deleteImage(shopId: string, productId: string, imageId: string): Promise<{ storageKey: string } | null>;
358:  async setSortOrders(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
359:  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow | null>;
360:}
361:```
362:
363:All queries run inside `withTenantTx`; tenant context (`app.current_shop_id`) is injected by interceptor before the service call. RLS is the floor; service-level `WHERE shop_id = $caller` is the second layer per the no-cross-tenant rule. The `lockProductForTenant` SELECT is the third — explicit tenant-scoped existence check that does NOT bypass RLS-style logic the way a bare FK constraint does.
364:
365:### Public catalog endpoint (read path)
366:
367:```
368:GET /api/v1/catalog/products/:productId/images
369:    Public (no auth). Tenant resolved by request domain (existing pattern).
370:    Response: { images: PublicImageRow[] }
371:```
372:
373:`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
374:
375:```typescript
376:type PublicImageRow = {
377:  id: string;
378:  alt_text: string | null;          // null → caller renders auto-fallback "<product> – तस्वीर <n>"
379:  width: number;                    // post-rotation
380:  height: number;
381:  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
382:                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
383:  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
384:  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
385:};
386:```
387:
388:`storage_key` is intentionally **NOT in the public DTO** — `PublicImageRow` is anonymous-anyone consumable, so the internal blob path is hidden behind server-built URLs.
389:
390:**Authenticated shopkeeper endpoints, however, return `storage_key` and the full row** because the shopkeeper image manager (the mobile screen that lists, reorders, and deletes images) needs to construct thumbnail URLs via `imagekitUrl(row.storage_key, { width: 200 })` for every image — including images persisted on prior visits. The two DTO shapes are explicitly different:
391:
392:```typescript
393:// Authenticated shopkeeper response (GET /api/v1/products/:productId/images,
394:// POST upload, PATCH reorder, PATCH alt-text)
395:type ImageRow = {
396:  id: string;
397:  shop_id: string;
398:  product_id: string;
399:  storage_key: string;            // exposed: shopkeeper owns the data
400:  alt_text: string | null;
401:  mime_type: string;
402:  byte_size: number;
403:  width: number;
404:  height: number;
405:  exif_stripped_at: string;       // ISO timestamp
406:  uploaded_by_user_id: string;
407:  scan_status: 'pending' | 'clean' | 'rejected';
408:  sort_order: number;
409:  created_at: string;
410:  updated_at: string;
411:};
412:
413:// Anonymous public response (GET /api/v1/catalog/products/:productId/images)
414:type PublicImageRow = {
415:  id: string;
416:  alt_text: string | null;
417:  width: number;
418:  height: number;
419:  srcset: string;                 // server-pre-built; no storage_key exposed
420:  default_url: string;
421:  placeholder_url: string;
422:};
423:```
424:
425:The public catalog endpoint maps `ImageRow` → `PublicImageRow` server-side, calling `imagekitUrl(row.storage_key, { width: N })` for every needed variant. All public surfaces consume `PublicImageRow[]` directly, preserving the "every customer-facing URL has `mb-0.25`" invariant — the client never composes ImageKit URLs.
426:
427:Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
428:
429:---
430:
431:## Storage adapter — extension
432:
433:### `@goldsmith/integrations-storage` additions
434:
435:**`storage.port.ts`** — extend with one new method needed for bytes-flow:
436:```typescript
437:export interface StoragePort {
438:  // existing
439:  getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
440:  getPublicUrl(key: string): Promise<string>;
441:  downloadBuffer(key: string): Promise<Buffer>;
442:  uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void>;
443:  getPresignedReadUrl(key: string): Promise<string>;
444:  // new
445:  deleteBlob(key: string): Promise<void>;
446:}
447:```
448:
449:**`MalwareScanPort`** — new file `malware-scan.port.ts`:
450:```typescript
451:export interface MalwareScanPort {
452:  scan(buffer: Buffer, mimeType: string): Promise<{ clean: boolean; reason?: string }>;
453:}
454:export const MALWARE_SCAN_PORT = 'MALWARE_SCAN_PORT';
455:```
456:
457:### `StubStorageAdapter` — fill the dev/CI path
458:
459:Currently throws on real I/O. Implement against local disk:
460:- `uploadBuffer`: writes to `${process.env.STUB_STORAGE_DIR ?? './tmp/storage'}/${key}`, creates parent dirs.
461:- `downloadBuffer`: reads same path.
462:- `deleteBlob`: best-effort `fs.unlink`.
463:- `getPublicUrl`: returns `http://localhost:${PORT}/dev-storage/${key}` (a dev-only Express middleware on the API serves files from STUB_STORAGE_DIR — bound to `127.0.0.1` only, never deployed).
464:- `getPresignedUploadUrl` / `getPresignedReadUrl`: identical stub URLs (since STUB doesn't enforce TTL).
465:
466:### `AzureBlobStorageAdapter` — real implementation
467:
468:Constructor reads:
469:- `AZURE_STORAGE_ACCOUNT` (e.g., `goldsmithprod`)
470:- `AZURE_STORAGE_ACCOUNT_KEY` (Key Vault — for SAS signing)
471:- `AZURE_STORAGE_CONTAINER` (e.g., `product-images`)
472:
473:Methods:
474:- `uploadBuffer(key, data, mime)`: `BlobServiceClient.getContainerClient(container).getBlockBlobClient(key).uploadData(data, { blobHTTPHeaders: { blobContentType: mime } })`.
475:- `getPresignedUploadUrl(key, mime)`: builds SAS with `sr=b`, `sp=cw` (create+write), `se=now+1h`, `Content-Type` enforced.
476:- `getPresignedReadUrl(key)`: builds SAS with `sp=r`, `se=now+1h`. **Used only for the dev-storage fallback path; production reads use `getPublicUrl`.**
477:- `getPublicUrl(key)`: returns `https://ik.imagekit.io/${IMAGEKIT_ID}/${key}` — ImageKit Web Folder is configured to fetch from `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/`. Originals stay private in Azure; only ImageKit's authorized fetcher reads them.
478:- `deleteBlob(key)`: `blockBlobClient.delete()` with leniency for 404 (already deleted).
479:- `downloadBuffer(key)`: `blockBlobClient.downloadToBuffer()` (used only by reconciliation jobs, not request path).
480:
481:### `ImageKitTransformUrlBuilder`
482:
483:Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision §1). Width is caller-controlled (different surfaces need different widths — `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
484:
485:```typescript
486:imagekitUrl(key: string, opts: {
487:  width: number;             // > 0; any positive integer the caller needs
488:  blur?: number;             // 1-100; emits `bl-${n}` for low-quality image placeholders
489:}): string
490:// →  `https://ik.imagekit.io/${id}/${key}?tr=w-${width}[,bl-${blur}],q-auto,f-auto,mb-0.25`
491://
492:// Contract:
493://   * Every returned URL MUST contain `q-auto`, `f-auto`, and `mb-0.25`.
494://   * `bl-` is only present when `blur` is supplied (used by the mobile
495://     blur-placeholder, never on the persisted `public_url` field).
496://   * No code path constructs ImageKit URLs by hand — all callers go
497://     through this builder. A unit test asserts the three required
498://     substrings appear in every output, regardless of options.
499:```
500:
501:**Caller-side width vocabulary** (documented for implementer reference; not enforced by the type system because future surfaces may add their own widths):
502:
503:| Surface | Width | Blur | Use |
504:|---|---|---|---|
505:| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | — | Public PDP gallery |
506:| Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
507:| Shopkeeper image manager card | 200 | — | Internal thumbnail in the upload UI |
508:| `PublicImageRow.default_url` (server-built) | 1024 | — | Public catalog response field; non-srcset fallback / LCP preload `href` |
509:| `PublicImageRow.placeholder_url` (server-built) | 200 | 30 | Public catalog response field; LQIP for `<img>` decoration / `expo-image` placeholder |
510:| `PublicImageRow.srcset` (server-built) | 320 / 640 / 1024 / 1920 | — | Pre-built srcset string for customer `<img srcset>` |
511:
512:Adding a new surface that needs a new width is fine — just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
513:
514:### `StorageModule` — wire selection
515:
516:`STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).
517:
518:---
519:
520:## Mobile — shopkeeper image manager
521:
522:### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)
523:
524:Reachable from product edit screen via "तस्वीरें (n/10)" button.
525:
526:Layout:
527:- Header: "उत्पाद की तस्वीरें" + "+ जोड़ें" button (top-right).
528:- `DraggableFlatList` of image cards (`react-native-draggable-flatlist`).
529:- Each card: thumbnail (200×200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) · drag handle (right) · alt-text input (one line) · "हटाएं" button (red, ≥ 48 dp).
530:- Tap "+ जोड़ें" → `expo-image-picker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: false, quality: 0.95 })`.
531:- Selected image → POST as multipart/form-data with `Authorization: Bearer <firebase>`.
532:- Upload progress: indeterminate spinner overlay; on success, append to list; on error, Hindi toast keyed by error code.
533:
534:**i18n** — `packages/i18n/locales/hi-IN/inventory.json`:
535:```json
536:"images_title": "उत्पाद की तस्वीरें",
537:"images_add": "तस्वीर जोड़ें",
538:"images_count": "{{n}}/10",
539:"images_alt_placeholder": "वैकल्पिक: तस्वीर का विवरण",
540:"images_delete_confirm": "क्या आप वाकई इस तस्वीर को हटाना चाहते हैं?",
541:"images_delete_yes": "हाँ, हटाएं",
542:"images_delete_no": "रद्द करें",
543:"images_err_invalid_mime": "केवल JPEG / PNG / WebP / HEIC तस्वीरें स्वीकार की जाती हैं",
544:"images_err_too_large": "इस तस्वीर की गुणवत्ता बहुत बड़ी है — कृपया कम रिज़ॉल्यूशन की कोशिश करें",
545:"images_err_invalid_dimensions": "तस्वीर का आकार 200×200 से 8000×8000 के बीच होना चाहिए",
546:"images_err_payload": "तस्वीर का आकार 5 MB से अधिक है",
547:"images_err_limit": "एक उत्पाद की अधिकतम 10 तस्वीरें",
548:"images_err_generic": "तस्वीर अपलोड नहीं हो सकी। दोबारा कोशिश करें।"
549:```
550:
551:### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)
552:
553:Props: `{ images: PublicImageRow[]; productName: string }`.
554:
555:Layout:
556:- 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
557:- ≤ 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
558:- Click hero → opens lightbox (`<dialog>`, ESC closes).
559:- ←→ arrow keys cycle on desktop. Visible focus ring on the hero on focus.
560:- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
561:- `loading="lazy"` on all but the first image; the first image's responsive preload is emitted via `next/head` as
562:  `<link rel="preload" as="image" fetchpriority="high" href={image.default_url} imagesrcset={image.srcset} imagesizes={sizes}>`
563:  so the browser preloads the SAME candidate it picks from the `<img srcset>` (otherwise on a 320w mobile viewport the browser would fetch w-320 from the `<img>` while preload wasted bytes on w-1024). `href` is the non-srcset fallback for browsers that ignore `imagesrcset`.
564:- Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
565:
566:### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
567:
568:Props: same.
569:
570:Layout:
571:- Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
572:- Tap → expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
573:- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
574:
575:---
576:
577:## Tests
578:
579:| Test | File | What it asserts |
580:|------|------|-----------------|
581:| Unit: MIME sniff | `product-images.service.spec.ts` | PHP-renamed-jpg → throws `BadRequestException` with code `INVALID_MIME` + audit emitted |
582:| Unit: SVG rejection | same | SVG buffer → throws even though magic-bytes match |
583:| Unit: oversized after compression | same | Synthetic high-detail source where the **1920 w** sharp probe at `quality:80, effort:6` exceeds 250 KB → throws `BadRequestException` with code `IMAGE_TOO_LARGE_AFTER_COMPRESSION` + audit emitted; corresponding healthy-source case (probe ≤ 250 KB) accepts |
584:| Unit: dimension guard | same | 100×100 → throws; 9000×9000 → throws |
585:| Unit: EXIF strip | same | A JPEG buffer with embedded EXIF (GPS + camera make) processed by `sharp(buf).rotate().toBuffer()` produces output with NO EXIF block (verified via `exifr.parse(out)` returning `null`); visual orientation is preserved (test source has orientation=6 / 90° rotation) |
586:| Unit: dimensions after rotation | same | A 4000×3000 source with EXIF orientation=6 (rotate 90° clockwise) → after `sharp(buf).rotate().toBuffer()`, the cleaned buffer's metadata reports 3000×4000; the row inserted into `product_images` has `width=3000, height=4000`, NOT the source 4000×3000 |
587:| Unit: upload happy path | same | Inserts row, calls storage `uploadBuffer` once with cleaned buffer + mime, audit `PRODUCT_IMAGE_UPLOADED` |
588:| Unit: image cap | same | 11th upload → throws `IMAGE_LIMIT_REACHED`; cap is enforced inside the tx after `FOR UPDATE` lock |
589:| Concurrency: cap under race | `product-images.concurrency.spec.ts` | Two concurrent uploads on a product with 9 images → exactly one inserts (count=10), the other throws `IMAGE_LIMIT_REACHED`; verified by spawning two awaiting `Promise.allSettled` calls against a real test DB with the lock pattern |
590:| Security: cross-tenant product attach | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B `productId` → 404 `NOT_FOUND` (NOT a 500 from FK violation, NOT a successful insert); blob best-effort deleted afterward; no row in `product_images` |
591:| Unit: reorder | same | `setSortOrders` called with full ordered array; mismatch → throws `ORDER_LIST_MISMATCH` |
592:| Unit: delete | same | Repo delete + storage `deleteBlob` called + audit |
593:| Integration: upload → list (shopkeeper) | `product-images.integration.spec.ts` | Authenticated POST then authenticated GET `/products/:id/images` → returns `ImageRow[]` with `storage_key`, all timestamps, `scan_status`, etc. |
594:| Integration: upload → public catalog | `product-images.public-catalog.spec.ts` | Authenticated POST then anonymous GET `/catalog/products/:id/images` → returns `PublicImageRow[]` with `srcset`, `default_url`, `placeholder_url` (all containing `mb-0.25`); `storage_key` field is absent from response JSON |
595:| Integration: tenant isolation | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B productId → 404 |
596:| Integration: RLS at SQL layer | `product-images.rls.spec.ts` | Direct SQL with shop_id=A cannot SELECT shop_id=B images |
597:| Integration: stub storage round-trip | `stub-storage.integration.spec.ts` | uploadBuffer → downloadBuffer returns same bytes |
598:| Integration: Azure adapter mocks | `azure-blob.adapter.spec.ts` | `@azure/storage-blob` mocked; SAS URL contains `sp=cw`, `se=` ≤ 1h ahead, `sr=b` |
599:| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` → contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` → contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 → contains `mb-0.25` (universal byte-cap invariant) |
600:| Performance: PDP gallery render | `product-gallery.perf.spec.ts` | First image load < 500 ms p95 against ImageKit cached path (with mocked CDN) |
601:| Performance: upload latency | `upload.perf.spec.ts` | Median upload + probe + EXIF strip + DB write < 2 s for a 4 MB JPEG |
602:| Security: payload size | `payload-size.security.spec.ts` | 6 MB body → 413 before any sharp invocation |
603:| Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
604:| a11y: gallery | `product-gallery.a11y.spec.ts` | axe-core on customer-web ProductGallery → 0 violations; alt-text fallback verified |
605:
606:Coverage target: ≥ 80 % on `product-images.service.ts` and adapters.
607:
608:---
609:
610:## Work streams
611:
612:| Stream | Responsibility |
613:|--------|----------------|
614:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
615:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
616:| **WS-C Security** | RLS test on `product_images` (cross-tenant SELECT denied) · tenant-isolation integration test · payload-size + malicious-MIME security tests · `/security-review` gate |
617:| **WS-D Mobile (shopkeeper)** | `apps/shopkeeper/app/inventory/[id]/images.tsx` · `expo-image-picker` integration · `react-native-draggable-flatlist` reorder · upload progress UI · Hindi i18n · 48 dp touch targets |
618:| **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) · `ResponsiveImage` atom in `packages/ui-web` · `apps/customer-mobile/src/components/products/ProductGallery.tsx` · public catalog `GET /catalog/products/:id/images` · empty-state fallback to `GoldTexturePlaceholder` |
619:| **WS-F Gate** | `codex review --base main` · `/security-review` (Class A — both run in parallel per CLAUDE.md ceremony) · `.codex-review-passed` · `.security-review-passed` · runtime smoke (shopkeeper Android upload + customer-web PDP render) |
620:
621:**Order:** WS-A blocks everything. WS-B blocks WS-C / WS-D / WS-E. WS-C / WS-D / WS-E are parallel after WS-B. WS-F runs last.
622:
623:---
624:
625:## Smoke test protocol
626:
627:Run on real device (Moto G + Chrome desktop) after CI green.
628:
629:1. Boot API in `STORAGE_ADAPTER=stub` mode against a seeded shop with one product (no images).
630:2. Boot shopkeeper mobile (Metro fresh, `--clear`).
631:3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
632:4. Upload a real 4 MP JPEG from gallery → expect spinner → success → image card rendered.
633:5. Upload PHP-renamed-as-jpg → expect Hindi error toast "केवल JPEG / PNG / WebP / HEIC तस्वीरें स्वीकार की जाती हैं".
634:6. Upload a 6 MB image → expect "तस्वीर का आकार 5 MB से अधिक है" toast.
635:7. Upload 10 images → 11th attempt → expect "एक उत्पाद की अधिकतम 10 तस्वीरें" toast.
636:8. Reorder via drag handle → reload screen → confirm new order persists.
637:9. Edit alt-text on one image → reload → confirm persisted; clear it → reload → confirm fallback string renders.
638:10. Delete an image → confirm modal → confirm row removed and gallery count decrements.
639:11. Boot customer-web (`apps/customer-web` running against same DB).
640:12. Open `/products/<id>` of the seeded product → expect real image gallery (hero + thumbs) replacing `GoldTexturePlaceholder`.
641:13. Click hero → lightbox opens → ←→ keys cycle → ESC closes.
642:14. DevTools Network: confirm hero image URL contains `tr=w-1024,q-auto,f-auto,mb-0.25` and the response Content-Length ≤ 250 000 bytes (the `mb-0.25` parameter is what enforces this on ImageKit; verify the parameter is in the URL AND the response body honours it).
643:15. Lighthouse audit on PDP → SEO ≥ 90, accessibility ≥ 95.
644:16. axe-core CLI on `/products/<id>` → zero violations.
645:
646:Production smoke (post-SOW Azure provisioning): repeat steps 1–14 with `STORAGE_ADAPTER=azure-imagekit` against a real Azure container + ImageKit Web Folder. Recorded as runbook checklist; not blocking for this story's merge.
647:
648:---
649:
650:## Out of scope
651:
652:- Bulk re-encode of legacy placeholders (separate data migration, no rows exist today).
653:- AI auto-cropping / smart thumbnails.
654:- Watermarking.
655:- 360° turntable capture (Story 18.6 reserves the data shape via `is_360_frame BOOLEAN`; capture pipeline is Phase 3+).
656:- Cart, online checkout, payments.
657:- Customer-side image upload (UGC reviews are FR99 territory; out of this story).
658:- ClamAV / Defender for Storage actual integration (port + stub only; real adapter post-SOW).
659:
660:---
661:
662:## Residual risks recorded in runbook
663:
664:1. **Azure adapter unverified against real Azure** until SOW provisions infrastructure. Adapter unit tests use `@azure/storage-blob` mocks; integration with real Azure SAS semantics is a post-SOW manual smoke.
665:2. **MIME-sniff is sole AV layer in MVP.** Threat model documents this. Real malware scan is a one-adapter-swap upgrade once budget exists.
666:3. **Orphan blob possibility** if Azure write succeeds but DB insert fails (network blip between steps 10 and 11 of `upload()` flow). Reconciliation job is a Phase 3+ story; impact is pennies of wasted storage, not data loss.
667:4. **ImageKit cold-cache penalty** on first request to a new variant width. Acceptable for MVP traffic; warm cache holds the p95 < 500 ms target.
668:5. **Stub storage local-disk** is dev-only and bound to `127.0.0.1`; never deployed. Threat model records the assumption.
669:6. **ImageKit Web Folder configuration is an ops-time prerequisite,** not story code. The runbook gains a checklist entry: "Provision ImageKit account; create Web Folder pointing to `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/` with read-only SAS credentials in ImageKit dashboard." This must be done before the production env-var flip from `stub` to `azure-imagekit`. Recorded here so the post-SOW deployment session does not skip it.
670:
671:---
672:
673:## References
674:
675:- `_bmad-output/planning-artifacts/epics-E17-E18.md` Story 17.1 (acceptance criteria source-of-truth)
676:- `docs/customer-storefront-gap-analysis-2026-05-01.md` §T1.1, §12.2, §12.6
677:- `docs/prd-addendum-customer-storefront.md` FR90 / NFR-IMG-1 / NFR-SE-2
678:- ADR-0007 (storage), ADR-0008 (multi-tenant isolation), ADR-0015 (Azure + Firebase, supersedes pre-Azure NFR-S2 / NFR-C7 wording)
679:- `feedback_startup_economics_first.md` (defer Azure spend until SOW)
680:- `feedback_fresh_session_prompt_ceremony.md` (Class A plan + exec are separate fresh sessions)
681:- `feedback_codex_worktree_clm.md` (Codex CLM blocker workaround for Windows worktrees)
682:- `memory/project_phase1_storefront_complete.md` (Phase 1 deliverables on main HEAD 669ee90)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:28:49.054767Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\" | Select-Object -Index (300..430)"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\" | Select-Object -Index (300..430)" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\" | Select-Object -Index (300..430)"` rejected: blocked by policy
2026-05-02T02:28:52.759207Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; lines=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md').read_text(encoding='utf-8').splitlines(); [print(f'{i+1}: {lines[i]}') for i in range(300,431)]\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; lines=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md').read_text(encoding='utf-8').splitlines(); [print(f'{i+1}: {lines[i]}') for i in range(300,431)]\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; lines=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md').read_text(encoding='utf-8').splitlines(); [print(f'{i+1}: {lines[i]}') for i in range(300,431)]\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --no-ext-diff --unified=12 --no-renames --format= -- docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' in C:\Alok\Business Projects\Goldsmith
 succeeded in 450ms:
diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index c2a3e1a..36a3bf6 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -196,25 +196,25 @@ The new `ProductImagesController` / `ProductImagesService` / `ProductImagesRepos
 
 ---
 
 ## API
 
 ### Endpoints
 
 ```
 POST   /api/v1/products/:productId/images          (multipart/form-data; field "file")
        Headers: Content-Length ≤ 5 MB
        Optional field: "alt_text" (string, ≤ 200 chars)
        Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
-       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
+       Response 201: ImageRow  (full shape — see "Authenticated shopkeeper response" type below; shopkeeper UI renders thumbnails by calling imagekitUrl(row.storage_key, { width: 200 }))
        Errors:
          400 INVALID_MIME       — magic-byte sniff failed
          400 IMAGE_TOO_LARGE_AFTER_COMPRESSION — sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
          400 INVALID_DIMENSIONS — width or height outside [200, 8000]
          409 IMAGE_LIMIT_REACHED — 10 already exist on this product
          413 PAYLOAD_TOO_LARGE  — body > 5 MB
 
 DELETE /api/v1/products/:productId/images/:imageId
        Guards: same
        Response: 204 No Content; 404 if not found within tenant
 
 PATCH  /api/v1/products/:productId/images/order
@@ -321,25 +321,25 @@ DB transaction with pessimistic product-row lock (serializes uploads per product
 
      d. row = await tx.query(`INSERT INTO product_images (...) VALUES (...) RETURNING ...`, {
           shopId, productId, storageKey, mimeType: sniffed.mime, byteSize: cleaned.length,
           width: cleanedMeta.width, height: cleanedMeta.height,        // post-rotation dimensions
           sortOrder: nextSort,
           altText, uploadedByUserId: userId, exifStrippedAt: NOW(), scanStatus: 'clean',
         })
 
      e. await audit.emit(tx, PRODUCT_IMAGE_UPLOADED, { imageId: row.id, byteSize: cleaned.length })
      return row
    })
 
-10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
+10. return row  // ImageRow including storage_key — shopkeeper UI builds its own thumbnail URLs via imagekitUrl()
 ```
 
 **Transaction boundary clarification:** storage upload (step 8) runs **before** the DB transaction (step 9) so that:
 - A storage-upload failure short-circuits — no DB row, clean caller error.
 - If the DB tx rolls back (cross-tenant 404, cap 409), the orphan blob is deleted on a best-effort basis in the catch handler; if the delete fails, reconciliation sweep (Phase 3+ runbook task) cleans it up. Impact: pennies of wasted storage; never a row-without-blob.
 - The pessimistic `SELECT ... FOR UPDATE` on `products` row inside the tx serializes concurrent uploads for the same product, making the 10-cap inviolable under any concurrency.
 
 ### `ProductImagesRepository`
 
 ```typescript
 class ProductImagesRepository {
   // The upload flow uses raw tx queries (lockProductForUpdate + countImagesInTx +
@@ -376,27 +376,64 @@ GET /api/v1/catalog/products/:productId/images
 type PublicImageRow = {
   id: string;
   alt_text: string | null;          // null → caller renders auto-fallback "<product> – तस्वीर <n>"
   width: number;                    // post-rotation
   height: number;
   srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
                                     // every URL carries q-auto, f-auto, mb-0.25 via the builder
   default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
   placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
 };
 ```
 
-`storage_key` is intentionally NOT in the public DTO — it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+`storage_key` is intentionally **NOT in the public DTO** — `PublicImageRow` is anonymous-anyone consumable, so the internal blob path is hidden behind server-built URLs.
 
-Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+**Authenticated shopkeeper endpoints, however, return `storage_key` and the full row** because the shopkeeper image manager (the mobile screen that lists, reorders, and deletes images) needs to construct thumbnail URLs via `imagekitUrl(row.storage_key, { width: 200 })` for every image — including images persisted on prior visits. The two DTO shapes are explicitly different:
+
+```typescript
+// Authenticated shopkeeper response (GET /api/v1/products/:productId/images,
+// POST upload, PATCH reorder, PATCH alt-text)
+type ImageRow = {
+  id: string;
+  shop_id: string;
+  product_id: string;
+  storage_key: string;            // exposed: shopkeeper owns the data
+  alt_text: string | null;
+  mime_type: string;
+  byte_size: number;
+  width: number;
+  height: number;
+  exif_stripped_at: string;       // ISO timestamp
+  uploaded_by_user_id: string;
+  scan_status: 'pending' | 'clean' | 'rejected';
+  sort_order: number;
+  created_at: string;
+  updated_at: string;
+};
+
+// Anonymous public response (GET /api/v1/catalog/products/:productId/images)
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;
+  width: number;
+  height: number;
+  srcset: string;                 // server-pre-built; no storage_key exposed
+  default_url: string;
+  placeholder_url: string;
+};
+```
+
+The public catalog endpoint maps `ImageRow` → `PublicImageRow` server-side, calling `imagekitUrl(row.storage_key, { width: N })` for every needed variant. All public surfaces consume `PublicImageRow[]` directly, preserving the "every customer-facing URL has `mb-0.25`" invariant — the client never composes ImageKit URLs.
+
+Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
 ---
 
 ## Storage adapter — extension
 
 ### `@goldsmith/integrations-storage` additions
 
 **`storage.port.ts`** — extend with one new method needed for bytes-flow:
 ```typescript
 export interface StoragePort {
   // existing
   getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
@@ -459,25 +496,27 @@ imagekitUrl(key: string, opts: {
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
-| `public_url` on upload response | 1024 | — | Single representative URL returned by API; client renders srcset itself |
+| `PublicImageRow.default_url` (server-built) | 1024 | — | Public catalog response field; non-srcset fallback / LCP preload `href` |
+| `PublicImageRow.placeholder_url` (server-built) | 200 | 30 | Public catalog response field; LQIP for `<img>` decoration / `expo-image` placeholder |
+| `PublicImageRow.srcset` (server-built) | 320 / 640 / 1024 / 1920 | — | Pre-built srcset string for customer `<img srcset>` |
 
 Adding a new surface that needs a new width is fine — just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
 
 ### `StorageModule` — wire selection
 
 `STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).
 
 ---
 
 ## Mobile — shopkeeper image manager
 
 ### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)
@@ -510,25 +549,27 @@ Layout:
 ```
 
 ### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)
 
 Props: `{ images: PublicImageRow[]; productName: string }`.
 
 Layout:
 - 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
 - ≤ 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
 - Click hero → opens lightbox (`<dialog>`, ESC closes).
 - ←→ arrow keys cycle on desktop. Visible focus ring on the hero on focus.
 - Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
+- `loading="lazy"` on all but the first image; the first image's responsive preload is emitted via `next/head` as
+  `<link rel="preload" as="image" fetchpriority="high" href={image.default_url} imagesrcset={image.srcset} imagesizes={sizes}>`
+  so the browser preloads the SAME candidate it picks from the `<img srcset>` (otherwise on a 320w mobile viewport the browser would fetch w-320 from the `<img>` while preload wasted bytes on w-1024). `href` is the non-srcset fallback for browsers that ignore `imagesrcset`.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap → expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
 - Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
 ---
@@ -540,25 +581,26 @@ Layout:
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
-| Integration: upload → list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
+| Integration: upload → list (shopkeeper) | `product-images.integration.spec.ts` | Authenticated POST then authenticated GET `/products/:id/images` → returns `ImageRow[]` with `storage_key`, all timestamps, `scan_status`, etc. |
+| Integration: upload → public catalog | `product-images.public-catalog.spec.ts` | Authenticated POST then anonymous GET `/catalog/products/:id/images` → returns `PublicImageRow[]` with `srcset`, `default_url`, `placeholder_url` (all containing `mb-0.25`); `storage_key` field is absent from response JSON |
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
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Alok\Business Projects\Goldsmith
 succeeded in 439ms:
?? docs/reviews/codex-story-17.1-spec-20260501.md
?? docs/reviews/codex-story-17.1-spec-round2-20260501.md
?? docs/reviews/codex-story-17.1-spec-round3-20260501.md
?? docs/reviews/codex-story-17.1-spec-round4-20260501.md
?? docs/reviews/codex-story-17.1-spec-round5-20260501.md
?? docs/reviews/codex-story-17.1-spec-round6-20260501.md
?? docs/reviews/codex-story-17.1-spec-round7-20260501.md
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command dir in C:\Alok\Business Projects\Goldsmith
 succeeded in 468ms:


    Directory: C:\Alok\Business Projects\Goldsmith


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----         4/30/2026  10:36 PM                .claude                                                              
d-----         4/18/2026  12:43 PM                .github                                                              
d-----         4/30/2026   3:40 PM                .remember                                                            
d-----         4/19/2026   7:36 AM                .secrets                                                             
d-----          5/1/2026   8:21 AM                .serena                                                              
d-----         4/18/2026   6:36 AM                .turbo                                                               
d-----         4/29/2026   2:12 PM                .worktrees                                                           
d-----          5/1/2026   7:13 AM                apps                                                                 
d-----          5/1/2026   8:40 PM                docs                                                                 
d-----          5/1/2026   5:43 PM                node_modules                                                         
d-----         4/18/2026  12:43 PM                ops                                                                  
d-----         4/24/2026   3:30 PM                packages                                                             
d-----         4/20/2026   9:30 PM                scripts                                                              
d-----         4/15/2026   9:44 PM                _bmad                                                                
d-----         4/24/2026   2:56 PM                _bmad-output                                                         
-a----         4/29/2026   5:16 PM           5855 .bmad-readiness-passed                                               
-a----         4/29/2026  12:27 AM             59 .claude-review-passed                                                
-a----          5/1/2026   8:41 PM            496 .codex-review-passed                                                 
-a----         4/18/2026  12:43 PM            196 .editorconfig                                                        
-a----          5/1/2026   4:24 PM           8052 .eslintrc.cjs                                                        
-a----         4/18/2026  11:53 PM             61 .firebaserc                                                          
-a----          5/1/2026   9:31 PM           1203 .gitignore                                                           
-a----         4/18/2026  12:43 PM              9 .node-version                                                        
-a----         4/24/2026  11:57 AM            560 .npmrc                                                               
-a----         4/19/2026   6:46 AM            556 .pnpmfile.cjs                                                        
-a----         4/18/2026  12:43 PM             42 .prettierignore                                                      
-a----         4/18/2026  12:43 PM            113 .prettierrc                                                          
-a----          5/1/2026   8:41 PM            772 .security-review-passed                                              
-a----         4/24/2026  11:57 AM          21641 CLAUDE.md                                                            
-a----         4/18/2026  11:53 PM            116 firebase.json                                                        
-a----         4/24/2026  11:57 AM           1384 package.json                                                         
-a----          5/1/2026   5:43 PM         756126 pnpm-lock.yaml                                                       
-a----         4/23/2026   8:38 PM            126 pnpm-workspace.yaml                                                  
-a----         4/24/2026  11:57 AM            618 tsconfig.base.json                                                   
-a----         4/18/2026  12:43 PM             82 tsconfig.json                                                        
-a----          5/1/2026   7:13 AM            735 turbo.json                                                           
-a----         4/18/2026  12:43 PM            357 vitest.config.ts                                                     


Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "shop_id|shopId" apps/api/src/modules -g "*.ts" -n --max-count 5' in C:\Alok\Business Projects\Goldsmith
 succeeded in 465ms:
apps/api/src/modules\wishlist\wishlist.service.spec.ts:31:  vi.mocked(tenantContext.requireCurrent).mockReturnValue({ shopId: SHOP_ID } as never);
apps/api/src/modules\wishlist\wishlist.service.spec.ts:52:        id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID,
apps/api/src/modules\wishlist\wishlist.service.spec.ts:58:      expect(mockRepo.add).toHaveBeenCalledWith({ shopId: SHOP_ID, customerId: CUSTOMER_ID, productId: PRODUCT_ID });
apps/api/src/modules\wishlist\wishlist.service.spec.ts:80:        shopId: SHOP_ID, customerId: CUSTOMER_ID, productId: PRODUCT_ID,
apps/api/src/modules\wishlist\wishlist.service.spec.ts:108:      mockRepo.add.mockResolvedValueOnce({ id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID, product_id: PRODUCT_ID, created_at: new Date() });
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:80:       WHERE customer_id = $1 AND shop_id = $2
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:84:      [dto.customerId, ctx.shopId],
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:96:      `SELECT rate_lock_days FROM shop_settings WHERE shop_id = $1`,
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:97:      [ctx.shopId],
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:102:    // The FK on customer_id only proves the customer exists, not that it belongs to ctx.shopId.
apps/api/src/modules\custom-orders\custom-orders.service.ts:44:  shopId:                  string;
apps/api/src/modules\custom-orders\custom-orders.service.ts:69:    shopId:                r.shop_id,
apps/api/src/modules\custom-orders\custom-orders.service.ts:108:      shopId:                ctx.shopId,
apps/api/src/modules\custom-orders\custom-orders.service.ts:122:    trackEvent(ctx.shopId, 'custom_order.created');
apps/api/src/modules\custom-orders\custom-orders.service.ts:172:      notes: { shopId: ctx.shopId, customOrderId: orderId, type: 'custom_order_deposit' },
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.controller.ts:98:    const shopIdHint    = notes['shopId']     ?? '';
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.controller.ts:105:      await this.svc.handleWebhookPayment(bookingId, razorpayPaymentId, shopIdHint);
apps/api/src/modules\catalog\catalog.service.ts:16:  shopId:          string;
apps/api/src/modules\catalog\catalog.service.ts:58:  shopId:      string;
apps/api/src/modules\catalog\catalog.service.ts:154:      shopId:          row.id,
apps/api/src/modules\catalog\catalog.service.ts:163:    const { shopId, categoryId, search, metal, page, limit } = params;
apps/api/src/modules\catalog\catalog.service.ts:168:    const queryParams: unknown[] = [shopId];
apps/api/src/modules\catalog\catalog.controller.spec.ts:34:  shopId: 'shop-uuid-1', primaryColor: '#B58A3C', logoUrl: null,
apps/api/src/modules\wishlist\wishlist.repository.ts:6:  shop_id:    string;
apps/api/src/modules\wishlist\wishlist.repository.ts:27:  async add(params: { shopId: string; customerId: string; productId: string }): Promise<WishlistRow> {
apps/api/src/modules\wishlist\wishlist.repository.ts:29:      `INSERT INTO wishlists (shop_id, customer_id, product_id)
apps/api/src/modules\wishlist\wishlist.repository.ts:31:       ON CONFLICT (shop_id, customer_id, product_id) DO NOTHING
apps/api/src/modules\wishlist\wishlist.repository.ts:33:      [params.shopId, params.customerId, params.productId],
apps/api/src/modules\wishlist\wishlist.service.ts:26:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\wishlist\wishlist.service.ts:30:      `SELECT id FROM products WHERE id = $1 AND shop_id = $2`,
apps/api/src/modules\wishlist\wishlist.service.ts:31:      [params.productId, shopId],
apps/api/src/modules\wishlist\wishlist.service.ts:35:    await this.repo.add({ shopId, customerId: params.customerId, productId: params.productId });
apps/api/src/modules\wishlist\wishlist.service.ts:40:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:21:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:36:        id, shopId: SHOP, sku: `SKU-${id.slice(0, 4)}`,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:61:        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:66:        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:73:          id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:13:  shopId: string;
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:75:        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:92:    params.push(a.shopId);
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:100:        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:102:        ['tenant.updated', a.platformUserId, a.shopId, JSON.stringify(a.patch)],
apps/api/src/modules\custom-orders\custom-orders.repository.ts:7:  shop_id:                 string;
apps/api/src/modules\custom-orders\custom-orders.repository.ts:24:  shop_id:         string;
apps/api/src/modules\custom-orders\custom-orders.repository.ts:32:  id, shop_id, customer_id, description, design_reference_url,
apps/api/src/modules\custom-orders\custom-orders.repository.ts:39:  id, custom_order_id, shop_id, title, note, photo_url, created_at
apps/api/src/modules\custom-orders\custom-orders.repository.ts:47:    shopId: string;
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:12:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:13:    current: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:169:        if (sql.includes('SELECT id, shop_id, status')) {
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:170:          return { rows: [{ id: BOOKING, shop_id: SHOP, status: 'PENDING_PAYMENT' }] };
apps/api/src/modules\webhooks\razorpay.controller.ts:22:  // shopId is NOT trusted from the webhook payload — it is resolved from the
apps/api/src/modules\webhooks\razorpay.controller.ts:25:  shopIdHint: string;
apps/api/src/modules\webhooks\razorpay.controller.ts:78:      // notes.shopId was set by OUR server at initiateUpiPayment time and is
apps/api/src/modules\webhooks\razorpay.controller.ts:81:      // validates the found row's shop_id matches before any DML.
apps/api/src/modules\webhooks\razorpay.controller.ts:83:      const shopIdHint = notes['shopId'] ?? '';
apps/api/src/modules\platform-admin\services\tenant-management.service.spec.ts:95:      shopId: SHOP_ID,
apps/api/src/modules\platform-admin\services\tenant-management.service.spec.ts:108:    await svc.updateShop({ shopId: SHOP_ID, platformUserId: ADMIN_UID, patch: {} });
apps/api/src/modules\catalog\catalog.service.spec.ts:38:      shopId:          'shop-1',
apps/api/src/modules\catalog\catalog.service.spec.ts:54:    expect(result.shopId).toBe('shop-1');
apps/api/src/modules\catalog\catalog.service.spec.ts:94:    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
apps/api/src/modules\catalog\catalog.service.spec.ts:111:    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
apps/api/src/modules\catalog\catalog.service.spec.ts:125:    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:34:  shopId:       string;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:47:    shopId:      r.shop_id,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:104:      shopId:     ctx.shopId,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:128:      await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:177:      await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
apps/api/src/modules\auth\auth.controller.spec.ts:32:  shopId: SHOP_ID,
apps/api/src/modules\auth\auth.controller.spec.ts:55:      .mockResolvedValueOnce(undefined) // SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.controller.spec.ts:210:      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
apps/api/src/modules\auth\auth.controller.spec.ts:267:      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
apps/api/src/modules\auth\auth.controller.spec.ts:333:      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
apps/api/src/modules\pricing\pricing.service.ts:72:  return `rates:override:${ctx.shopId}:${purity}`;
apps/api/src/modules\pricing\pricing.service.ts:371:           (shop_id, purity, override_paise, reason, set_by_user_id, valid_until)
apps/api/src/modules\pricing\pricing.service.ts:373:        [ctx.shopId, dto.purity, paise, dto.reason, ctx.userId, validUntil],
apps/api/src/modules\pricing\pricing.service.ts:377:           (shop_id, actor_user_id, action, subject_type, subject_id, before, after)
apps/api/src/modules\pricing\pricing.service.ts:380:          ctx.shopId,
apps/api/src/modules\analytics\analytics.service.ts:8:  shopId: string;
apps/api/src/modules\analytics\analytics.service.ts:27:    if (!UUID_RE.test(params.shopId) || !UUID_RE.test(params.productId) || !UUID_RE.test(params.sessionId)) {
apps/api/src/modules\analytics\analytics.service.ts:34:    await this.withShopTx(params.shopId, async (tx) => {
apps/api/src/modules\analytics\analytics.service.ts:36:      // Prevents cross-tenant pollution where caller supplies their shop_id but a
apps/api/src/modules\analytics\analytics.service.ts:40:        `SELECT id FROM products WHERE id = $1 AND shop_id = $2 LIMIT 1`,
apps/api/src/modules\catalog\catalog.controller.ts:87:    @Headers('x-tenant-id') shopId: string,
apps/api/src/modules\catalog\catalog.controller.ts:94:    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
apps/api/src/modules\catalog\catalog.controller.ts:96:      shopId,
apps/api/src/modules\catalog\catalog.controller.ts:115:    @Headers('x-tenant-id') shopId: string,
apps/api/src/modules\catalog\catalog.controller.ts:117:    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
apps/api/src/modules\platform-admin\services\subscription.service.ts:9:  shopId: string;
apps/api/src/modules\platform-admin\services\subscription.service.ts:19:  shopId: string;
apps/api/src/modules\platform-admin\services\subscription.service.ts:62:        `INSERT INTO platform_subscriptions (shop_id, plan, status, mrr_paise, billing_cycle_start)
apps/api/src/modules\platform-admin\services\subscription.service.ts:64:         ON CONFLICT (shop_id) DO UPDATE
apps/api/src/modules\platform-admin\services\subscription.service.ts:71:        [a.shopId, a.plan, a.status ?? null, a.mrrPaise, a.billingCycleStart ?? null],
apps/api/src/modules\custom-orders\custom-orders.controller.ts:225:    const shopIdHint    = notes['shopId'] ?? '';
apps/api/src/modules\custom-orders\custom-orders.controller.ts:232:      await this.svc.handleRazorpayWebhook(customOrderId, razorpayPaymentId, shopIdHint);
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:17:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:42:      return { id, shopId: SHOP, sku: p.sku, metal: p.metal, purity: p.purity, status: p.status } as any;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:64:    shop_id:      SHOP,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:162:        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:177:      shop_id:      SHOP,
apps/api/src/modules\analytics\analytics.service.spec.ts:31://   3. SET LOCAL shop_id
apps/api/src/modules\analytics\analytics.service.spec.ts:32://   4. ownership SELECT (products WHERE id=$1 AND shop_id=$2)
apps/api/src/modules\analytics\analytics.service.spec.ts:45:   .mockResolvedValueOnce(undefined)                                          // SET LOCAL shop_id
apps/api/src/modules\analytics\analytics.service.spec.ts:59:   .mockResolvedValueOnce(undefined)              // SET LOCAL shop_id
apps/api/src/modules\analytics\analytics.service.spec.ts:72:   .mockResolvedValueOnce(undefined)   // SET LOCAL shop_id
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:30:      shopId: 'shop-1',
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:37:    expect(client.query.mock.calls[1]![0]).toMatch(/ON CONFLICT \(shop_id\) DO UPDATE/);
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:51:          shop_id: 'shop-1',
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:72:      svc.upsertSubscription({ shopId: 's', plan: 'platinum' as never, mrrPaise: 0, platformUserId: 'p' }),
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:79:      svc.upsertSubscription({ shopId: 's', plan: 'growth', mrrPaise: -1, platformUserId: 'p' }),
apps/api/src/modules\pricing\pricing.service.spec.ts:109:  shopId: 'shop-uuid-1',
apps/api/src/modules\pricing\pricing.service.spec.ts:262:        `rates:override:${fakeOwnerCtx.shopId}:GOLD_18K`,
apps/api/src/modules\pricing\pricing.service.spec.ts:458:        if (key === `rates:override:${fakeOwnerCtx.shopId}:GOLD_22K`) {
apps/api/src/modules\analytics\analytics.controller.ts:27:    const shopId = ctx.shopId;
apps/api/src/modules\analytics\analytics.controller.ts:30:      this.svc.getProductViewSummary({ shopId, productId, days: 30 }),
apps/api/src/modules\analytics\analytics.controller.ts:31:      this.svc.getProductViewSummary({ shopId, productId, days: 90 }),
apps/api/src/modules\analytics\analytics.controller.ts:32:      this.svc.getProductViewSummary({ shopId, productId, days: 365 }),
apps/api/src/modules\auth\permissions.repository.ts:11:  async getPermissions(shopId: string, role: ShopUserRole): Promise<Record<string, boolean>> {
apps/api/src/modules\auth\permissions.repository.ts:15:      // Set GUC so RLS policy on role_permissions can filter on current_setting('app.current_shop_id').
apps/api/src/modules\auth\permissions.repository.ts:16:      await c.query(`SET app.current_shop_id = '${shopId}'`);
apps/api/src/modules\auth\permissions.repository.ts:18:        `SELECT permission_key, is_enabled FROM role_permissions WHERE shop_id = $1 AND role = $2`,
apps/api/src/modules\auth\permissions.repository.ts:19:        [shopId, role],
apps/api/src/modules\billing\billing-5.10-5.12.spec.ts:8:    requireCurrent: () => ({ shopId: 'shop-1', authenticated: true, userId: 'user-1' }),
apps/api/src/modules\billing\billing-5.10-5.12.spec.ts:139:  it('uploads to tenants/<shopId>/invoices/<id>.html', async () => {
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:6:  shop_id:      string;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:21:    shopId:     string;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:27:      `INSERT INTO try_at_home_bookings (shop_id, customer_id, product_ids, notes)
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:30:      [params.shopId, params.customerId, params.productIds, params.notes ?? null],
apps/api/src/modules\auth\auth.service.spec.ts:37:  // auditLog → withTenantTx: BEGIN, SET LOCAL ROLE, SET LOCAL current_shop_id, INSERT, COMMIT, POISON release
apps/api/src/modules\auth\auth.service.spec.ts:44:      .mockResolvedValueOnce(undefined)                                           // SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.service.spec.ts:113:    expect(call.shopId).toBe(SHOP_ID);
apps/api/src/modules\auth\auth.service.spec.ts:258:        .mockResolvedValueOnce(undefined)   // SET LOCAL current_shop_id
apps/api/src/modules\auth\auth.service.spec.ts:261:        .mockResolvedValueOnce(undefined),  // finally: SET app.current_shop_id poison
apps/api/src/modules\auth\permissions.repository.spec.ts:7:const ctx: UnauthenticatedTenantContext = { shopId: 'shop-1', tenant: fakeTenant, authenticated: false };
apps/api/src/modules\auth\permissions.repository.spec.ts:14:        .mockResolvedValueOnce(undefined)         // SET app.current_shop_id (GUC for RLS)
apps/api/src/modules\billing\billing.repository.ts:8:  shop_id:             string;
apps/api/src/modules\billing\billing.repository.ts:48:  shop_id:               string;
apps/api/src/modules\billing\billing.repository.ts:128:  id, shop_id, invoice_number, invoice_type,
apps/api/src/modules\billing\billing.repository.ts:142:  id, shop_id, invoice_id, product_id, description, hsn_code, huid,
apps/api/src/modules\billing\billing.repository.ts:154:   * UNIQUE(shop_id, idempotency_key) raises 23505 → translated to
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:79:      shopId: SHOP_ID,
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:95:  it('export forwards shopId + platformUid', async () => {
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:102:      { shopId: SHOP_ID, plan: 'growth', mrrPaise: 100, status: 'active' },
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:106:      shopId: SHOP_ID, plan: 'growth', mrrPaise: 100, platformUserId: PLATFORM_UID,
apps/api/src/modules\auth\auth.revoke.security.spec.ts:7: *    The repo query includes AND shop_id=$callerShopId so cross-tenant UUIDs are invisible.
apps/api/src/modules\auth\auth.revoke.security.spec.ts:23:    // repo.revokeStaff returns null because WHERE id=$1 AND shop_id=$2 finds 0 rows
apps/api/src/modules\platform-admin\impersonation-token.ts:13:  target_shop_id: string;
apps/api/src/modules\platform-admin\impersonation-token.ts:31:    { sub: a.platformUserId, target_shop_id: a.targetShopId, iss: ISSUER },
apps/api/src/modules\platform-admin\impersonation-token.ts:49:  if (!decoded.jti || !decoded.sub || !decoded['target_shop_id'] || !decoded.exp || !decoded.iat) {
apps/api/src/modules\platform-admin\impersonation-token.ts:55:    target_shop_id: decoded['target_shop_id'] as string,
apps/api/src/modules\crm\occasions.service.ts:9:  shop_id: string;
apps/api/src/modules\crm\occasions.service.ts:112:        `INSERT INTO customer_occasions (shop_id, customer_id, occasion_type, label, month_day, next_occurrence, reminder_days)
apps/api/src/modules\crm\occasions.service.ts:113:         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6)
apps/api/src/modules\auth\guards\policy.guard.ts:33:    let perms = await this.permissionsCache.getPermissions(tc.shopId, tc.role);
apps/api/src/modules\auth\guards\policy.guard.ts:35:      perms = await this.permissionsRepo.getPermissions(tc.shopId, tc.role);
apps/api/src/modules\auth\guards\policy.guard.ts:36:      await this.permissionsCache.setPermissions(tc.shopId, tc.role, perms);
apps/api/src/modules\settings\settings.try-at-home.spec.ts:53:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\settings\settings.try-at-home.spec.ts:105:  it('invalidates feature-flags cache with correct shopId', async () => {
apps/api/src/modules\settings\settings.try-at-home.spec.ts:154:  it('uses shopId from tenantContext — not a hardcoded value', async () => {
apps/api/src/modules\settings\settings.try-at-home.spec.ts:157:      shopId: SHOP_A, userId: 'user-a', role: 'shop_admin', authenticated: true,
apps/api/src/modules\auth\auth.repository.ts:7:  shopId: string;
apps/api/src/modules\auth\auth.repository.ts:23:        shop_id: string; user_id: string; role: ShopUserRole;
apps/api/src/modules\auth\auth.repository.ts:28:      return { shopId: r.shop_id, userId: r.user_id, role: r.role, status: r.status, firebaseUid: r.firebase_uid };
apps/api/src/modules\auth\auth.repository.ts:31:      await c.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
apps/api/src/modules\auth\auth.repository.ts:46:  async linkFirebaseUid(args: { shopId: string; userId: string; firebaseUid: string; tenant: Tenant }): Promise<{ linked: boolean }> {
apps/api/src/modules\platform-admin\services\impersonation.service.ts:73:           (platform_user_id, target_shop_id, expires_at, reason, ip_address, user_agent)
apps/api/src/modules\platform-admin\services\impersonation.service.ts:80:        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, ip_address, user_agent, metadata)
apps/api/src/modules\platform-admin\services\impersonation.service.ts:105:      const upd = await c.query<{ target_shop_id: string }>(
apps/api/src/modules\platform-admin\services\impersonation.service.ts:109:          RETURNING target_shop_id`,
apps/api/src/modules\platform-admin\services\impersonation.service.ts:115:      // Include target_shop_id so tenant-scoped audit queries pair this `impersonation.ended`
apps/api/src/modules\platform-admin\impersonation-token.spec.ts:19:    expect(claims.target_shop_id).toBe('22222222-2222-2222-2222-222222222222');
apps/api/src/modules\platform-admin\impersonation-token.spec.ts:51:      { sub: 'p', target_shop_id: '22222222-2222-2222-2222-222222222222', iss: 'attacker' },
apps/api/src/modules\auth\guards\policy.guard.spec.ts:20:const shopId = 'shop-uuid-1';
apps/api/src/modules\auth\guards\policy.guard.spec.ts:27:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\guards\policy.guard.spec.ts:50:      authenticated: true, shopId, role: 'shop_admin', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\guards\policy.guard.spec.ts:63:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\guards\policy.guard.spec.ts:80:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\auth.controller.ts:105:    return this.svc.invite(auth.shopId, dto, auth.userId);
apps/api/src/modules\auth\auth.controller.ts:118:    return this.authRepo.listUsers(auth.shopId);
apps/api/src/modules\auth\auth.controller.ts:128:    return this.permissionsRepo.getPermissions(auth.shopId, role as import('@goldsmith/tenant-context').ShopUserRole);
apps/api/src/modules\auth\auth.controller.ts:142:    const shopId = auth.shopId;
apps/api/src/modules\auth\auth.controller.ts:143:    await this.permissionsRepo.upsertPermission(shopId, role as import('@goldsmith/tenant-context').ShopUserRole, dto.permission_key, dto.is_enabled);
apps/api/src/modules\auth\auth.service.ts:71:    const tenant = await this.loadTenantById(row.shopId);
apps/api/src/modules\auth\auth.service.ts:74:      const { linked } = await this.repo.linkFirebaseUid({ shopId: row.shopId, userId: row.userId, firebaseUid: args.uid, tenant });
apps/api/src/modules\auth\auth.service.ts:93:    //    after our initial read, we must not restore stale shop_id/role claims.
apps/api/src/modules\auth\auth.service.ts:94:    const statusCheck = await this.repo.getStatusById(row.shopId, row.userId);
apps/api/src/modules\auth\auth.service.ts:99:    // 7. Set Firebase custom claims so subsequent ID tokens carry shop_id + role + goldsmith_uid (DB UUID).
apps/api/src/modules\settings\settings.service.ts:53:    const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\settings.service.ts:54:    this.tenantLookup.invalidate(shopId);
apps/api/src/modules\settings\settings.service.ts:107:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\settings\settings.service.ts:111:      subjectId: shopId,
apps/api/src/modules\settings\settings.service.ts:191:      subjectId: tc.shopId,
apps/api/src/modules\auth\auth.repository.invite.spec.ts:7:const ctx = { shopId: 'shop-1', tenant: fakeTenant, authenticated: false } as const;
apps/api/src/modules\auth\auth.repository.invite.spec.ts:11:    // withTenantTx sequence: BEGIN → SET LOCAL ROLE app_user → SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.repository.invite.spec.ts:12:    //   → conflict SELECT (1 row) → COMMIT → SET app.current_shop_id=POISON → release
apps/api/src/modules\auth\auth.repository.invite.spec.ts:17:        .mockResolvedValueOnce(undefined)                                      // SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.repository.invite.spec.ts:20:        .mockResolvedValueOnce(undefined),                                     // SET app.current_shop_id=POISON (finally)
apps/api/src/modules\crm\occasions.service.spec.ts:24:  return { authenticated: true as const, shopId: SHOP, userId: USER, role: 'shop_admin' };
apps/api/src/modules\crm\occasions.service.spec.ts:34:    shop_id: SHOP,
apps/api/src/modules\crm\occasions.service.spec.ts:267:    expect(sql).toMatch(/current_setting\('app\.current_shop_id'\)/);
apps/api/src/modules\billing\billing.controller.ts:154:      { userId: ctx.userId, role: ctx.role, shopId: ctx.shopId },
apps/api/src/modules\billing\billing.controller.ts:174:      { userId: ctx.userId, role: ctx.role, shopId: ctx.shopId },
apps/api/src/modules\billing\billing.controller.ts:221:    return this.estimates.listEstimates(ctx.shopId, limit, offset);
apps/api/src/modules\billing\billing.controller.ts:232:    return this.estimates.getEstimate(id, ctx.shopId);
apps/api/src/modules\auth\firebase-jwt.strategy.ts:17:  shop_id?: string;
apps/api/src/modules\auth\firebase-jwt.strategy.ts:67:      shop_id: decoded['shop_id'] as string | undefined,
apps/api/src/modules\auth\firebase-jwt.strategy.ts:124:      shop_id: impClaims.target_shop_id,
apps/api/src/modules\pricing\pricing.controller.spec.ts:37:  shopId: 'shop-1',
apps/api/src/modules\pricing\pricing.controller.spec.ts:43:  shopId: 'shop-1',
apps/api/src/modules\settings\settings.service.test.ts:15:  shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
apps/api/src/modules\billing\invoice-pdf.service.ts:186:    const key = `tenants/${ctx.shopId}/invoices/${invoiceId}.html`;
apps/api/src/modules\billing\invoice-pdf.service.ts:197:        [ctx.shopId],
apps/api/src/modules\crm\notes.service.ts:9:  shop_id: string;
apps/api/src/modules\crm\notes.service.ts:45:        `INSERT INTO customer_notes (shop_id, customer_id, body, author_user_id)
apps/api/src/modules\crm\notes.service.ts:46:         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3)
apps/api/src/modules\billing\void.service.ts:27:  shop_id:              string;
apps/api/src/modules\billing\void.service.ts:39:  shopId:               string;
apps/api/src/modules\billing\void.service.ts:52:    shopId:            cn.shop_id,
apps/api/src/modules\billing\void.service.ts:64:  id, shop_id, invoice_number, invoice_type,
apps/api/src/modules\billing\void.service.ts:81:    ctx: { userId: string; role: string; shopId: string },
apps/api/src/modules\billing\gstr-export.service.ts:193:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\billing\gstr-export.service.ts:205:         WHERE shop_id = $1
apps/api/src/modules\billing\gstr-export.service.ts:210:        [shopId, month],
apps/api/src/modules\billing\invoice-number.ts:9: * Readable, sortable, unique-per-tenant. UNIQUE(shop_id, invoice_number)
apps/api/src/modules\billing\invoice-number.ts:14:    throw new Error(`generateInvoiceNumber: invalid shopId "${shopUuid}"`);
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:46:    expect(decoded.target_shop_id).toBe(SHOP_ID);
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:87:  it('end: marks session ended_at and audits impersonation.ended with target_shop_id', async () => {
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:90:      .mockResolvedValueOnce({ rowCount: 1, rows: [{ target_shop_id: SHOP_ID }] }) // UPDATE RETURNING
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:100:    expect(updateCall[0]).toMatch(/RETURNING target_shop_id/);
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:103:    // Audit row carries target_shop_id so tenant-scoped queries pair start ↔ end
apps/api/src/modules\billing\payment.service.spec.ts:17:  return { authenticated: true, shopId: SHOP, userId: USER, role };
apps/api/src/modules\billing\payment.service.spec.ts:305:    // Tenant A shopId = SHOP — ctx is scoped to SHOP via RLS.
apps/api/src/modules\settings\settings.service.loyalty.test.ts:69:  shopId: SHOP_ID, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
apps/api/src/modules\billing\payment.service.ts:49:    (shop_id, customer_id, customer_phone, aggregate_date, aggregate_month, cash_total_paise, invoice_count)
apps/api/src/modules\billing\payment.service.ts:51:    current_setting('app.current_shop_id', true)::uuid,
apps/api/src/modules\billing\payment.service.ts:68:  WHERE shop_id         = current_setting('app.current_shop_id', true)::uuid
apps/api/src/modules\billing\payment.service.ts:84:  shopId:          string;
apps/api/src/modules\billing\payment.service.ts:100:  shopId: string;
apps/api/src/modules\crm\notes.service.spec.ts:25:  return { authenticated: true as const, shopId: SHOP, userId, role: 'shop_admin' };
apps/api/src/modules\crm\notes.service.spec.ts:35:    shop_id: SHOP,
apps/api/src/modules\crm\notes.service.spec.ts:79:    expect(sql).toContain("current_setting('app.current_shop_id')");
apps/api/src/modules\crm\notes.service.spec.ts:218:    // SQL must reference current_setting (not a hardcoded shop_id binding)
apps/api/src/modules\crm\notes.service.spec.ts:220:    expect(sql).toMatch(/current_setting\('app\.current_shop_id'\)/);
apps/api/src/modules\platform-admin\dto\index.ts:22:  shopId: z.string().uuid(),
apps/api/src/modules\billing\estimate.service.ts:40:  shopId:                 string;
apps/api/src/modules\billing\estimate.service.ts:56:  shop_id:                  string;
apps/api/src/modules\billing\estimate.service.ts:73:    shopId:               row.shop_id,
apps/api/src/modules\billing\estimate.service.ts:102:           (shop_id, customer_id, line_items, gold_rate_paise_per_gram,
apps/api/src/modules\billing\estimate.service.ts:104:         VALUES (current_setting('app.current_shop_id')::uuid,
apps/api/src/modules\billing\billing.service.ts:96:    shopId:            invoice.shop_id,
apps/api/src/modules\billing\billing.service.ts:237:      const cached = await this.redis.get(idemKey(ctx.shopId, idempotencyKey));
apps/api/src/modules\billing\billing.service.ts:243:          this.redis.del(idemKey(ctx.shopId, idempotencyKey)).catch(() => undefined);
apps/api/src/modules\billing\billing.service.ts:256:      this.cacheResponse(ctx.shopId, idempotencyKey, resp); // re-warm Redis
apps/api/src/modules\billing\billing.service.ts:342:    // shop_id filter on the platform pool, in addition to RLS on the tenant pool).
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:12:  authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin',
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:63:const CTX = { authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin' };
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:120:      if (sql.includes('SELECT id, invoice_id, shop_id')) return Promise.resolve({ rows: [{ id: 'pay_001', invoice_id: 'inv_001', shop_id: 'shop_001' }] });
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:156:      if (sql.includes('SELECT id, invoice_id, shop_id')) return Promise.resolve({ rows: [{ id: 'pay_001', invoice_id: 'inv_001', shop_id: 'shop_001' }] });
apps/api/src/modules\settings\blob-storage.service.ts:35:    const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\blob-storage.service.ts:36:    const blobPath = `tenants/${shopId}/logo/${randomUUID()}.webp`;
apps/api/src/modules\billing\story-5.6-pmla-block-ctr.spec.ts:111:  it('getCtrReport SQL is scoped by RLS (no explicit shop_id WHERE needed)', () => {
apps/api/src/modules\billing\story-5.6-pmla-block-ctr.spec.ts:112:    // pmla_aggregates has RLS: USING (shop_id = current_setting('app.current_shop_id')::uuid)
apps/api/src/modules\platform-admin\services\data-export.service.ts:39:  async exportTenant(shopId: string, platformUserId: string): Promise<TenantExport> {
apps/api/src/modules\platform-admin\services\data-export.service.ts:42:      // shop_id. Returning customer PII is the explicit purpose (DPDPA portability).
apps/api/src/modules\platform-admin\services\data-export.service.ts:53:        [shopId],
apps/api/src/modules\platform-admin\services\data-export.service.ts:58:        `SELECT id, shop_id, phone, name, email,
apps/api/src/modules\platform-admin\services\data-export.service.ts:63:           FROM customers WHERE shop_id = $1`,
apps/api/src/modules\settings\settings.repository.ts:28:      const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\settings.repository.ts:33:        [shopId],
apps/api/src/modules\settings\settings.repository.ts:42:      const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\settings.repository.ts:49:        params.push(shopId);
apps/api/src/modules\settings\settings.repository.ts:64:        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
apps/api/src/modules\billing\void.service.spec.ts:21:    shop_id: SHOP,
apps/api/src/modules\billing\void.service.spec.ts:76:      svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
apps/api/src/modules\billing\void.service.spec.ts:83:      svc.voidInvoice({ userId: MGR, role: 'shop_staff', shopId: SHOP }, 'inv-1', { reason: 'test' }),
apps/api/src/modules\billing\void.service.spec.ts:90:      await svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' });
apps/api/src/modules\billing\void.service.spec.ts:100:      svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
apps/api/src/modules\crm\crm.repository.ts:6:  id: string; shop_id: string; phone: string; name: string; email: string | null;
apps/api/src/modules\crm\crm.repository.ts:35:        `INSERT INTO customers (shop_id, phone, name, email, address_line1, address_line2, city, state, pincode, dob_year, pan_ciphertext, pan_key_id, notes, viewing_consent, created_by_user_id)
apps/api/src/modules\crm\crm.repository.ts:36:         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
apps/api/src/modules\crm\crm.repository.ts:51:      const dataQ = await tx.query<CustomerRow>(`SELECT * FROM customers WHERE shop_id = current_setting('app.current_shop_id')::uuid AND deleted_at IS NULL ${dataFilter} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, dataParams);
apps/api/src/modules\crm\crm.repository.ts:52:      const countQ = await tx.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM customers WHERE shop_id = current_setting('app.current_shop_id')::uuid AND deleted_at IS NULL ${countFilter}`, countParams);
apps/api/src/modules\billing\urd.service.ts:23:  shop_id:               string;
apps/api/src/modules\billing\urd.service.ts:42:  id: string; shopId: string; customerId: string | null; customerName: string;
apps/api/src/modules\billing\urd.service.ts:51:    id: r.id, shopId: r.shop_id, customerId: r.customer_id, customerName: r.customer_name,
apps/api/src/modules\billing\urd.service.ts:61:const URD_COLS = `id, shop_id, customer_id, customer_name, customer_phone, metal_type, purity, weight_g,
apps/api/src/modules\billing\urd.service.ts:70:    ctx: { userId: string; shopId: string },
apps/api/src/modules\billing\estimate.service.spec.ts:13:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\estimate.service.spec.ts:14:    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\estimate.service.spec.ts:34:    shop_id:                  SHOP,
apps/api/src/modules\billing\estimate.service.spec.ts:77:      expect(result.shopId).toBe(SHOP);
apps/api/src/modules\billing\estimate.service.spec.ts:97:    it('returns estimate for matching shopId', async () => {
apps/api/src/modules\crm\history.service.spec.ts:13:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\history.service.spec.ts:18:    id: CUSTOMER_ID, shop_id: SHOP, phone: '+919876543210', name: 'Test Customer',
apps/api/src/modules\settings\blob-storage.service.test.ts:8:const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_ID, tenant: tenantA, authenticated: false };
apps/api/src/modules\billing\billing.service.spec.ts:14:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.spec.ts:60:      shop_id: SHOP,
apps/api/src/modules\billing\billing.service.spec.ts:87:        id: 'inv-1', shop_id: SHOP,
apps/api/src/modules\billing\billing.service.spec.ts:122:        id: `item-${i}`, shop_id: SHOP, invoice_id: 'inv-1',
apps/api/src/modules\billing\billing.service.spec.ts:174:      shopId: SHOP,
apps/api/src/modules\crm\crm-search.service.ts:25:      return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\crm\crm-search.service.ts:28:      const result = await this.searchPort.searchCustomers(ctx.shopId, query);
apps/api/src/modules\crm\crm-search.service.ts:30:        `search: source=meilisearch shopId=${ctx.shopId} q="${query.q}" hits=${result.hits.length}`,
apps/api/src/modules\crm\crm-search.service.ts:37:        return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\crm\crm-search.service.ts:43:        return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\crm\consent.service.spec.ts:12:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\consent.service.spec.ts:22:    shop_id: SHOP,
apps/api/src/modules\settings\settings.repository.test.ts:10:const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
apps/api/src/modules\settings\settings.repository.test.ts:284:              sql.includes('SET LOCAL') || sql.includes('SET app.') || sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\settings\settings.repository.test.ts:310:              sql.includes('SET LOCAL') || sql.includes('SET app.') || sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\settings\settings.repository.test.ts:386:              sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\settings\settings.repository.test.ts:409:              sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\platform-admin\services\data-export.service.spec.ts:22:  it('exports a single tenant scope with shop_id filter on every query', async () => {
apps/api/src/modules\platform-admin\services\data-export.service.spec.ts:41:    // Every data query filtered by shop_id (indexes shifted by 1 for BEGIN only)
apps/api/src/modules\crm\crm-search.service.test.ts:11:function makeAuthCtx(shopId = SHOP_A): TenantContext {
apps/api/src/modules\crm\crm-search.service.test.ts:13:    shopId,
apps/api/src/modules\crm\crm-search.service.test.ts:88:  it('calls adapter with correct shopId (tenant isolation)', async () => {
apps/api/src/modules\crm\crm-search.service.test.ts:126:      shopId: SHOP_A,
apps/api/src/modules\crm\crm-search.service.test.ts:138:  it('Postgres fallback: first WHERE param is shopId (tenant isolation)', async () => {
apps/api/src/modules\loyalty\loyalty.service.ts:63:  // Reads only ctx.shopId — works with both authenticated (HTTP) and worker-built
apps/api/src/modules\loyalty\loyalty.service.ts:73:      const aggregate = await this.repo.lockOrCreateAggregate(tx, ctx.shopId, params.customerId);
apps/api/src/modules\loyalty\loyalty.service.ts:83:      await this.repo.insertTransaction(tx, ctx.shopId, {
apps/api/src/modules\loyalty\loyalty.service.ts:94:      await this.repo.updateAggregate(tx, ctx.shopId, {
apps/api/src/modules\loyalty\loyalty.service.ts:118:    const exists = await this.repo.customerExists(ctx.shopId, customerId);
apps/api/src/modules\billing\compliance-reports.service.ts:59:         WHERE id = current_setting('app.current_shop_id', true)::uuid`,
apps/api/src/modules\billing\compliance-reports.service.ts:189:         WHERE id = current_setting('app.current_shop_id', true)::uuid`,
apps/api/src/modules\billing\compliance-reports.service.ts:199:           AND shop_id = current_setting('app.current_shop_id', true)::uuid`,
apps/api/src/modules\billing\compliance-reports.service.ts:214:        shopId:                    shop.id,
apps/api/src/modules\crm\consent.repository.ts:7:  shop_id: string;
apps/api/src/modules\crm\consent.repository.ts:40:           AND shop_id = current_setting('app.current_shop_id')::uuid`,
apps/api/src/modules\crm\consent.repository.ts:52:      const shop = `current_setting('app.current_shop_id')::uuid`;
apps/api/src/modules\crm\consent.repository.ts:56:         WHERE customer_id = $1 AND shop_id = ${shop}
apps/api/src/modules\crm\consent.repository.ts:65:      // Insert-or-update on (shop_id, customer_id) — preserves consent_version.
apps/api/src/modules\crm\family.service.ts:46:      this.repo.customerBelongsToShop(ctx.shopId, dto.customerId),
apps/api/src/modules\crm\family.service.ts:47:      this.repo.customerBelongsToShop(ctx.shopId, dto.relatedCustomerId),
apps/api/src/modules\crm\family.service.ts:81:    const ok = await this.repo.customerBelongsToShop(ctx.shopId, customerId);
apps/api/src/modules\crm\family.service.ts:98:    const ok = await this.repo.customerBelongsToShop(ctx.shopId, customerId);
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:13:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:65:  it('enqueues a delayed BullMQ job with shopId/customerId/hardDeleteAt', async () => {
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:73:      shopId: SHOP,
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:138:    return { authenticated: false as const, shopId: SHOP, tenant: { id: SHOP, slug: 'x', display_name: 'x', status: 'ACTIVE' } };
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:168:        { customerId: CUSTOMER, shopId: SHOP },
apps/api/src/modules\reviews\reviews.service.ts:37:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\reviews\reviews.service.ts:41:      `SELECT id FROM products WHERE id = $1 AND shop_id = $2`,
apps/api/src/modules\reviews\reviews.service.ts:42:      [dto.productId, shopId],
apps/api/src/modules\reviews\reviews.service.ts:47:      shopId,
apps/api/src/modules\reviews\reviews.service.ts:66:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\settings\settings.policies-notif.spec.ts:57:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\crm\crm.service.ts:48:      const keyArn = await this.getShopKekArn(ctx.shopId);
apps/api/src/modules\crm\crm.service.ts:68:    void this.searchSvc.indexCustomer(ctx.shopId, {
apps/api/src/modules\crm\crm.service.ts:72:    trackEvent(ctx.shopId, 'customer.created');
apps/api/src/modules\crm\crm.service.ts:94:      const keyArn = await this.getShopKekArn(ctx.shopId);
apps/api/src/modules\crm\crm.service.ts:108:    void this.searchSvc.indexCustomer(ctx.shopId, {
apps/api/src/modules\crm\dpdpa-deletion.service.ts:18:  shopId:       string;
apps/api/src/modules\crm\dpdpa-deletion.service.ts:50:    void this.searchSvc.removeFromIndex(ctx.shopId, customerId).catch(() => undefined);
apps/api/src/modules\crm\dpdpa-deletion.service.ts:71:      { shopId: ctx.shopId, customerId, hardDeleteAt: hardDeleteAt.toISOString() },
apps/api/src/modules\crm\dpdpa-deletion.service.ts:74:        jobId: `hard-delete:${ctx.shopId}:${customerId}`,
apps/api/src/modules\crm\dpdpa-deletion.service.ts:96:        `SELECT id, name FROM customers WHERE id = $1 AND shop_id = current_setting('app.current_shop_id')::uuid`,
apps/api/src/modules\crm\family.service.spec.ts:14:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\family.service.spec.ts:24:    shop_id: SHOP,
apps/api/src/modules\crm\family.service.spec.ts:121:    const repo = fakeRepo({ customerBelongsToShop: vi.fn(async (_shopId: string, customerId: string) => customerId !== CUSTOMER_B) });
apps/api/src/modules\loyalty\loyalty.service.spec.ts:16:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\loyalty\loyalty.service.spec.ts:40:    shop_id: SHOP,
apps/api/src/modules\loyalty\loyalty.service.spec.ts:53:    lockOrCreateAggregate: vi.fn(async (_tx, _shopId, _customerId) => fakeAggregate()),
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:12:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:13:    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:90:            id: INV_ID, shop_id: SHOP, invoice_number: 'INV-001',
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:108:            id: `item-${i}`, shop_id: SHOP, invoice_id: INV_ID,
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:139:        id, shop_id: SHOP, metal: 'GOLD', purity: 'GOLD_22K',
apps/api/src/modules\crm\family.repository.ts:7:  shop_id: string;
apps/api/src/modules\crm\family.repository.ts:39:      const shop = `current_setting('app.current_shop_id')::uuid`;
apps/api/src/modules\crm\family.repository.ts:41:        `INSERT INTO family_members (shop_id, customer_id, related_customer_id, relationship, created_by_user_id)
apps/api/src/modules\crm\family.repository.ts:46:        `INSERT INTO family_members (shop_id, customer_id, related_customer_id, relationship, created_by_user_id)
apps/api/src/modules\crm\family.repository.ts:58:         WHERE shop_id = current_setting('app.current_shop_id')::uuid
apps/api/src/modules\reviews\reviews.service.spec.ts:29:  vi.mocked(tenantContext.requireCurrent).mockReturnValue({ shopId: SHOP_ID } as never);
apps/api/src/modules\reviews\reviews.service.spec.ts:50:        id: 'rev-1', shop_id: SHOP_ID, product_id: PRODUCT_ID,
apps/api/src/modules\reviews\reviews.service.spec.ts:64:        shopId:     SHOP_ID,
apps/api/src/modules\reviews\reviews.service.spec.ts:88:        { id: 'r1', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: CUSTOMER_ID,
apps/api/src/modules\reviews\reviews.service.spec.ts:91:        { id: 'r2', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: 'other',
apps/api/src/modules\crm\balance.service.ts:8:  shopId:     string;
apps/api/src/modules\crm\balance.service.ts:24:  shop_id:           string;
apps/api/src/modules\crm\balance.service.ts:39:    await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
apps/api/src/modules\crm\balance.service.ts:69:        `SELECT id, shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at
apps/api/src/modules\crm\balance.service.ts:127:           (shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at)
apps/api/src/modules\platform-admin\platform-admin.controller.ts:93:      shopId: id,
apps/api/src/modules\crm\crm.service.spec.ts:12:  tenantContext: { requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }) },
apps/api/src/modules\crm\crm.service.spec.ts:22:  return { id: CUSTOMER_ID, shop_id: SHOP, phone: '+919876543210', name: 'Test Customer', email: null, address_line1: null, address_line2: null, city: null, state: null, pincode: null, dob_year: null, pan_ciphertext: null, pan_key_id: null, notes: null, viewing_consent: false, created_by_user_id: USER, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'), ...overrides };
apps/api/src/modules\crm\crm.service.spec.ts:37:function authCtx(role = 'shop_admin') { return { authenticated: true as const, shopId: SHOP, userId: USER, role } as any; }
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:12:  shopId:     string;
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:15:const TENANT_SQL = `current_setting('app.current_shop_id')::uuid`;
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:42:   *   3. Scrubs PII columns + replaces the phone with a SHA-256(shop_id || ':' || phone)
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:57:         WHERE id = $1 AND shop_id = ${TENANT_SQL}
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:74:           AND shop_id = ${TENANT_SQL}
apps/api/src/modules\reviews\reviews.repository.ts:6:  shop_id:      string;
apps/api/src/modules\reviews\reviews.repository.ts:20:    shopId:      string;
apps/api/src/modules\reviews\reviews.repository.ts:27:      `INSERT INTO product_reviews (shop_id, product_id, customer_id, rating, review_text)
apps/api/src/modules\reviews\reviews.repository.ts:29:       ON CONFLICT (shop_id, customer_id, product_id)
apps/api/src/modules\reviews\reviews.repository.ts:33:      [params.shopId, params.productId, params.customerId, params.rating, params.reviewText ?? null],
apps/api/src/modules\crm\balance.service.spec.ts:14:    shopId: SHOP,
apps/api/src/modules\crm\balance.service.spec.ts:68:    // params: [shopId, customerId, outstanding, advance]
apps/api/src/modules\crm\balance.service.spec.ts:139:    await svc.handleInvoiceEvent({ shopId: SHOP, customerId: CUSTOMER_ID, invoiceId: 'inv-1' });
apps/api/src/modules\crm\balance.service.spec.ts:143:      expect.objectContaining({ shopId: SHOP }),
apps/api/src/modules\crm\balance.service.spec.ts:153:    await svc.handleInvoiceEvent({ shopId: SHOP, customerId: null, invoiceId: 'inv-1' });
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:11:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:12:    current: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:52:          shop_id: SHOP,
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:78:          id: `item-${i}`, shop_id: SHOP, invoice_id: INVOICE_ID,
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:113:      id, shop_id: SHOP, metal: 'GOLD', purity: 'GOLD_22K',
apps/api/src/modules\loyalty\loyalty.repository.ts:7:  shop_id: string;
apps/api/src/modules\loyalty\loyalty.repository.ts:18:  shop_id: string;
apps/api/src/modules\loyalty\loyalty.repository.ts:62:    shopId: string,
apps/api/src/modules\loyalty\loyalty.repository.ts:66:    // Using the unique (shop_id, customer_id) constraint added in 0037.
apps/api/src/modules\loyalty\loyalty.repository.ts:68:      `INSERT INTO customer_loyalty (shop_id, customer_id, points_balance, lifetime_points)
apps/api/src/modules\inventory\barcode.integration.test.ts:12:const makeProduct = (id: string, shopId: string, sku: string) => ({
apps/api/src/modules\inventory\barcode.integration.test.ts:14:  shop_id: shopId,
apps/api/src/modules\inventory\barcode.integration.test.ts:48:    shopId: SHOP_A, userId: 'user-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\barcode.service.ts:19:    barcodeValue: buildBarcodeValue(row.shop_id, row.id),
apps/api/src/modules\inventory\barcode.service.ts:36:    if (!row || row.shop_id !== ctx.shopId) {
apps/api/src/modules\inventory\barcode.service.ts:55:      if (!row || row.shop_id !== ctx.shopId) {
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:14:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:15:    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:35:    shopId:               SHOP,
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:72:    shop_id:              SHOP,
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:206:      id: 'cached-inv', shopId: SHOP, invoiceNumber: 'GS-CACHED',
apps/api/src/modules\loyalty\loyalty.controller.spec.ts:12:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\loyalty\loyalty.event-listener.ts:11:  shopId:         string;
apps/api/src/modules\loyalty\loyalty.event-listener.ts:19:  shopId:         string;
apps/api/src/modules\loyalty\loyalty.event-listener.ts:54:        shopId:         event.shopId,
apps/api/src/modules\loyalty\loyalty.event-listener.ts:65:    trackEvent(event.shopId, 'loyalty.accrued', { points: event.goldValuePaise });
apps/api/src/modules\loyalty\loyalty.event-listener.ts:67:      `loyalty accrual enqueued: invoiceId=${event.invoiceId} customerId=${event.customerId} shopId=${event.shopId}`,
apps/api/src/modules\customer\customer-auth.guard.ts:17:  shopId:     string;
apps/api/src/modules\customer\customer-auth.guard.ts:36:    const shopId = req.headers['x-tenant-id'] as string | undefined;
apps/api/src/modules\customer\customer-auth.guard.ts:40:    if (!shopId) throw new UnauthorizedException({ code: 'customer.tenant_id_missing' });
apps/api/src/modules\customer\customer-auth.guard.ts:52:      req.customerCtx = { customerId: DEV_MOCK_CUSTOMER_ID, shopId };
apps/api/src/modules\customer\customer-auth.guard.ts:69:      `SELECT id FROM customers WHERE phone_e164 = $1 AND shop_id = $2 AND deleted_at IS NULL LIMIT 1`,
apps/api/src/modules\customer\customer.controller.ts:61:    const { customerId, shopId } = getCustomerCtx(req);
apps/api/src/modules\customer\customer.controller.ts:62:    const ctx = await this.buildSyntheticCtx(shopId, customerId);
apps/api/src/modules\customer\customer.controller.ts:78:    const { customerId, shopId } = getCustomerCtx(req);
apps/api/src/modules\customer\customer.controller.ts:83:    const ctx = await this.buildSyntheticCtx(shopId, customerId);
apps/api/src/modules\customer\customer.controller.ts:97:    const { customerId, shopId } = getCustomerCtx(req);
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:14:  shopId: SHOP_ID, tenant, authenticated: true,
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:84:        shopId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', // different tenant
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:93:    it('enqueues job when meta found and shopId matches', async () => {
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:95:        shopId: SHOP_ID,
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:107:      const meta = JSON.stringify({ shopId: SHOP_ID, storageKey: 'upload/test.csv', idempotencyKey: 'idem-1' });
apps/api/src/modules\customer\customer.controller.spec.ts:38:    customerCtx: { customerId: DEV_CUSTOMER_ID, shopId: SHOP_ID },
apps/api/src/modules\customer\customer.controller.spec.ts:113:        id: 'tah1', shopId: SHOP_ID, customerId: DEV_CUSTOMER_ID,
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:14:  shopId: SHOP_ID, tenant, authenticated: true,
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:104:          expect.objectContaining({ sku: 'RING-001', metal: 'GOLD', shopId: SHOP_ID }),
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:201:    it('tags every createMany row with context shopId', async () => {
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:208:      const [rows] = (repoMock.createMany as ReturnType<typeof vi.fn>).mock.calls[0] as [Array<{ shopId: string }>];
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:209:      expect(rows.every((r) => r.shopId === SHOP_ID)).toBe(true);
apps/api/src/modules\inventory\inventory.bulk-import.processor.ts:138:        shopId: ctx.shopId,
apps/api/src/modules\inventory\inventory.bulk-import.processor.ts:169:      const errKey = `tenants/${ctx.shopId}/bulk-import/${data.jobId}/errors.csv`;
apps/api/src/modules\inventory\barcode.service.test.ts:12:  shop_id: SHOP_ID,
apps/api/src/modules\inventory\barcode.service.test.ts:42:    shopId: SHOP_ID, userId: 'user-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\barcode.service.test.ts:65:      repoMock.getProduct.mockResolvedValue({ ...productRow, shop_id: OTHER_SHOP_ID });
apps/api/src/modules\inventory\barcode.service.test.ts:95:      const otherTenantRow = { ...productRow, shop_id: OTHER_SHOP_ID };
apps/api/src/modules\reports\reports.service.spec.ts:9:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: 'user-1' }),
apps/api/src/modules\reports\reports.service.spec.ts:10:    current: () => ({ shopId: SHOP }),
apps/api/src/modules\inventory\inventory.search.service.test.ts:12:    shopId: SHOP_ID,
apps/api/src/modules\inventory\inventory.search.service.test.ts:137:    it('Postgres fallback includes shop_id as first WHERE clause (tenant isolation)', async () => {
apps/api/src/modules\inventory\inventory.search.service.test.ts:149:      // First param must be shopId
apps/api/src/modules\inventory\inventory.search.service.test.ts:151:      // SQL must reference p.shop_id = $1
apps/api/src/modules\inventory\inventory.search.service.test.ts:152:      expect(sql).toContain('p.shop_id = $1');
apps/api/src/modules\inventory\inventory.repository.test.ts:9:const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
apps/api/src/modules\inventory\inventory.repository.test.ts:13:  shop_id: SHOP_A,
apps/api/src/modules\inventory\inventory.repository.test.ts:57:          shopId: SHOP_A,
apps/api/src/modules\inventory\inventory.repository.test.ts:65:      expect(result.shop_id).toBe(SHOP_A);
apps/api/src/modules\inventory\inventory.repository.test.ts:116:        shopId: SHOP_A,
apps/api/src/modules\inventory\inventory.service.test.ts:11:  shop_id: SHOP_ID,
apps/api/src/modules\inventory\inventory.service.test.ts:57:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.service.test.ts:60:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.service.test.ts:66:    it('calls repo.createProduct with shopId and createdByUserId from context', async () => {
apps/api/src/modules\inventory\inventory.service.test.ts:73:        expect.objectContaining({ shopId: SHOP_ID, createdByUserId: USER_ID }),
apps/api/src/modules\inventory\inventory.repository.ts:10:  shop_id: string;
apps/api/src/modules\inventory\inventory.repository.ts:32:  shopId: string;
apps/api/src/modules\inventory\inventory.repository.ts:53:  shop_id: string;
apps/api/src/modules\inventory\inventory.repository.ts:74:  id, shop_id, category_id, sku, metal, purity,
apps/api/src/modules\inventory\inventory.repository.ts:91:           (shop_id, category_id, sku, metal, purity,
apps/api/src/modules\inventory\inventory.search.service.ts:20:      return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\inventory\inventory.search.service.ts:23:      const result = await this.searchPort.search(ctx.shopId, query);
apps/api/src/modules\inventory\inventory.search.service.ts:25:        `search: source=meilisearch shopId=${ctx.shopId} q="${query.q}" hits=${result.hits.length}`,
apps/api/src/modules\inventory\inventory.search.service.ts:33:        return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\inventory\inventory.search.service.ts:39:  private async postgresSearch(shopId: string, query: SearchQuery): Promise<SearchResult> {
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:34:    const { shopId } = ctx;
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:44:         WHERE shop_id = $1`,
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:45:        [shopId],
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:68:         WHERE shop_id = $1
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:72:        [shopId, threshold],
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:12:  shopId: SHOP_ID,
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:77:    // Verify the dead-stock query was called with the shop_id
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:147:  it('tenant isolation: dead-stock query uses shop_id = shopId from ctx', async () => {
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:153:    // First query (threshold): shop_id param
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:155:    // Second query (dead stock): first param is shop_id
apps/api/src/modules\inventory\inventory.valuation.service.test.ts:9:  shopId: SHOP_ID, userId: 'u1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.service.ts:20:    shopId: row.shop_id,
apps/api/src/modules\inventory\inventory.service.ts:61:      shopId: ctx.shopId,
apps/api/src/modules\inventory\inventory.service.ts:103:    id: string; shop_id: string; metal: string; purity: string;
apps/api/src/modules\inventory\inventory.service.ts:200:    trackEvent(ctx.shopId, 'product.published');
apps/api/src/modules\inventory\inventory.service.ts:231:    const key = `tenants/${ctx.shopId}/products/${productId}/${randomUUID()}.${ext}`;
apps/api/src/modules\inventory\stock-movement.repository.ts:10:  shop_id: string;
apps/api/src/modules\inventory\stock-movement.repository.ts:17:  shop_id: string;
apps/api/src/modules\inventory\stock-movement.repository.ts:43:  id, shop_id, product_id, type, reason, quantity_delta,
apps/api/src/modules\inventory\stock-movement.repository.ts:69:        `SELECT id, shop_id, quantity, status FROM products WHERE id = $1`,
apps/api/src/modules\inventory\stock-movement.repository.ts:93:        `SELECT id, shop_id, quantity, status FROM products WHERE id = $1 FOR UPDATE`,
apps/api/src/modules\inventory\stock-movement.service.spec.ts:13:  shopId: SHOP_ID,
apps/api/src/modules\inventory\stock-movement.service.spec.ts:22:      initial ? { id: PRODUCT_ID, shop_id: SHOP_ID, quantity: initial.quantity, status: initial.status } : null,
apps/api/src/modules\inventory\stock-movement.service.spec.ts:26:      shop_id: SHOP_ID,
apps/api/src/modules\inventory\stock-movement.service.ts:28:    shopId: row.shop_id,
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:15:  shopId: string;
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:32:    const storageKey = `tenants/${ctx.shopId}/bulk-import/${jobId}/input.csv`;
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:35:    const meta: BulkImportMeta = { shopId: ctx.shopId, storageKey, idempotencyKey };
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:50:    if (meta.shopId !== ctx.shopId) throw new NotFoundException({ code: 'inventory.bulk_import_job_not_found' });
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:66:      after: { jobId, storageKey: meta.storageKey, shopId: ctx.shopId },
apps/api/src/modules\inventory\publish.integration.test.ts:12:  shop_id: SHOP_A,
apps/api/src/modules\inventory\publish.integration.test.ts:58:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\publish.integration.test.ts:61:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\publish.integration.test.ts:84:      shopId: SHOP_B, userId: 'user-b', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.valuation.service.ts:55:    const cacheKey = `valuation:${ctx.shopId}`;
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'dir packages' in C:\Alok\Business Projects\Goldsmith
 succeeded in 475ms:


    Directory: C:\Alok\Business Projects\Goldsmith\packages


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----         4/19/2026   1:47 PM                audit                                                                
d-----          5/1/2026   5:42 PM                auth-client                                                          
d-----         4/19/2026   1:43 PM                cache                                                                
d-----         4/26/2026  11:33 AM                compliance                                                           
d-----         4/19/2026   1:47 PM                crypto-envelope                                                      
d-----         4/26/2026  11:33 AM                db                                                                   
d-----         4/19/2026   1:46 PM                i18n                                                                 
d-----         4/26/2026   1:54 PM                integrations                                                         
d-----         4/26/2026  11:33 AM                money                                                                
d-----         4/29/2026   5:17 PM                observability                                                        
d-----         4/25/2026   1:15 AM                queue                                                                
d-----         4/26/2026  11:33 AM                secrets                                                              
d-----         4/19/2026   1:10 PM                shared                                                               
d-----         4/24/2026   9:51 PM                sync                                                                 
d-----         4/19/2026   1:29 PM                tenant-config                                                        
d-----         4/26/2026  11:33 AM                tenant-context                                                       
d-----         4/24/2026   2:52 PM                testing                                                              
d-----         4/25/2026   3:46 PM                ui-mobile                                                            
d-----         4/19/2026  12:14 PM                ui-tokens                                                            


Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "integrations-storage|StoragePort|imagekitUrl" -n' in C:\Alok\Business Projects\Goldsmith
2026-05-02T02:29:31.637776Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.4 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 exited 1 in 393ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:30:12.266137Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node -e \"const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server'); console.log(renderToStaticMarkup(React.createElement('link',{rel:'preload',as:'image',fetchpriority:'high',href:'a',imagesrcset:'b 320w',imagesizes:'100vw'})));\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node -e \"const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server'); console.log(renderToStaticMarkup(React.createElement('link',{rel:'preload',as:'image',fetchpriority:'high',href:'a',imagesrcset:'b 320w',imagesizes:'100vw'})));\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node -e \"const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server'); console.log(renderToStaticMarkup(React.createElement('link',{rel:'preload',as:'image',fetchpriority:'high',href:'a',imagesrcset:'b 320w',imagesizes:'100vw'})));\""` rejected: blocked by policy
2026-05-02T02:30:15.675738Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'node --version'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'node --version' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'node --version'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "type \"docs\\reviews\\codex-story-17.1-spec-round6-20260501.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 543ms:
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
+  width: number;                    // post-rotation
+  height: number;
+  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
+                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
+  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
+  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
+};
+```
+
+`storage_key` is intentionally NOT in the public DTO Г?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+
+Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
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
-- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
+- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
+- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap Г+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
-- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.
+- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
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
388:`storage_key` is intentionally NOT in the public DTO Г?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
490:- Each card: thumbnail (200A-200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) A· drag handle (right) A· alt-text input (one line) A· "Е1ЕYЕ_Е?Е," button (red, Г%Э 48 dp).
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
- `apps/api/src/modules/inventory/inventory.service.ts` Т'?" delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
- `apps/api/src/modules/inventory/inventory.controller.ts` Т'?" delete `getImageUploadUrl` handler (line 148).
- `apps/api/src/modules/inventory/inventory.repository.ts` Т'?" delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
- `apps/api/src/modules/inventory/inventory.service.test.ts` Т'?" delete the `describe('getImageUploadUrl')` block (lines 103Т'?"130).

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
       Headers: Content-Length Т'% 5 MB
       Optional field: "alt_text" (string, Т'% 200 chars)
       Guards: FirebaseJwtGuard Т'+' TenantInterceptor Т'+' @Roles('shop_admin', 'shop_manager')
       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
       Errors:
         400 INVALID_MIME       Т'?" magic-byte sniff failed
         400 IMAGE_TOO_LARGE_AFTER_COMPRESSION Т'?" sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
         400 INVALID_DIMENSIONS Т'?" width or height outside [200, 8000]
         409 IMAGE_LIMIT_REACHED Т'?" 10 already exist on this product
         413 PAYLOAD_TOO_LARGE  Т'?" body > 5 MB

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
+  alt_text: string | null;          // null Г+' caller renders auto-fallback "<product> Г?" ЕЕ,ЕЭ?ЕцЕЭ?Е° <n>"
+  width: number;                    // post-rotation
+  height: number;
+  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
+                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
+  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
+  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
+};
+```
+
+`storage_key` is intentionally NOT in the public DTO Г?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+
+Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
 ---
 
 ## Storage adapter Г?" extension
 
@@ -499,22 +516,22 @@ Props: `{ images: PublicImageRow[]; productName: string }`.
 Layout:
 - 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
 - Г% 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
 - Click hero Г+' opens lightbox (`<dialog>`, ESC closes).
 - Г+?Г+' arrow keys cycle on desktop. Visible focus ring on the hero on focus.
-- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
+- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
+- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap Г+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
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
90c410e (HEAD -> main) docs(story-17.1): codex round 5 D"?" server pre-computes all public URLs
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

    docs(story-17.1): codex round 5 D"?" server pre-computes all public URLs
    
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
+  alt_text: string | null;          // null D"+' caller renders auto-fallback "<product> D"?" DD,DD-?Dе+DD-?DA° <n>"
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
+  alt_text: string | null;          // null D"+' caller renders auto-fallback "<product> D"?" DD,DD-?DГ?z+DD-?DAП3 <n>"
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
docs\reviews\codex-story-17.1-spec-20260501.md:4627:- [P1] Make migration safe for existing image rows Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
docs\reviews\codex-story-17.1-spec-20260501.md:4630:- [P1] Validate product ownership before storing bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
docs\reviews\codex-story-17.1-spec-20260501.md:4642:- [P2] Use a valid Sharp WebP quality option Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
docs\reviews\codex-story-17.1-spec-20260501.md:4645:- [P2] Use an existing shop role in the guard Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
docs\reviews\codex-story-17.1-spec-20260501.md:4653:- [P1] Make migration safe for existing image rows Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
docs\reviews\codex-story-17.1-spec-20260501.md:4656:- [P1] Validate product ownership before storing bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
docs\reviews\codex-story-17.1-spec-20260501.md:4668:- [P2] Use a valid Sharp WebP quality option Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
docs\reviews\codex-story-17.1-spec-20260501.md:4671:- [P2] Use an existing shop role in the guard Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4110:- [P1] Move product_images cleanup out of the SQL migration Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4113:- [P2] Validate the actual ImageKit bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4116:- [P2] Store dimensions after EXIF rotation Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4123:- [P1] Move product_images cleanup out of the SQL migration Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4126:- [P2] Validate the actual ImageKit bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4129:- [P2] Store dimensions after EXIF rotation Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1564:- [P1] Move product_images cleanup out of the SQL migration Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1567:- [P2] Validate the actual ImageKit bytes Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1570:- [P2] Store dimensions after EXIF rotation Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1577:- [P1] Move product_images cleanup out of the SQL migration Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1580:- [P2] Validate the actual ImageKit bytes Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1583:- [P2] Store dimensions after EXIF rotation Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2163:- [P2] Include the byte cap in the URL builder contract Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2166:- [P2] Remove the stale DELETE cleanup path Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2169:- [P3] Align oversize docs and tests with the 1920w probe Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2177:- [P2] Include the byte cap in the URL builder contract Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2180:- [P2] Remove the stale DELETE cleanup path Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2183:- [P3] Align oversize docs and tests with the 1920w probe Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1006:  docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1013:  docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap - 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1020:  docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1027:  docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1034:  docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap - 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1041:  docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2418:- [P2] Allow documented thumbnail transform variants Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2426:- [P2] Allow documented thumbnail transform variants Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1736:- [P2] Don't build mobile URLs from an absent public field Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1744:- [P2] Don't build mobile URLs from an absent public field Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
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

- [P2] Don't build mobile URLs from an absent public field Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
  For the customer-mobile gallery, `Props: same` means it receives `PublicImageRow[]`, and the public catalog endpoint only exposes `public_url`, `alt_text`, and dimensions, not `storage_key`. In that scenario this new instruction to call `imagekitUrl(storage_key, ...)` cannot compile or run unless the public DTO is widened or the API returns the needed variant URLs, so implementers will be forced to bypass the builder or ship a broken gallery.
2026-05-02T02:20:34.381464Z ERROR codex_core::session: failed to record rollout items: thread 019de679-771f-70a1-b580-0671f2a707ff not found
2026-05-02T02:20:34.451925Z ERROR codex_core::session: failed to record rollout items: thread 019de679-76f0-7371-906a-fa111dce147b not found
The updated spec now directs the customer-mobile surface to use a field that its documented public API response does not provide. That would leave implementers without the inputs needed to construct the mandated ImageKit URLs.

Review comment:

- [P2] Don't build mobile URLs from an absent public field Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
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
11:**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest Г?" Azure Storage SSE per ADR-0015 supersession), NFR-S3 (tenant-scoped image isolation), NFR-C7 (data residency Г?" Azure Central / South India per ADR-0015), NFR-A4 (alt text), NFR-P9 (image p95 < 500 ms thumbnails), NFR-SE-2 (Lighthouse SEO Г%Э 90)
37:- Customer `<ResponsiveImage>` renders `srcset` of ImageKit URLs with `tr=w-{320|640|1024|1920},q-auto,f-auto,mb-0.25`.
289:    // customer-facing srcset and aspect-ratio CSS need.
333:10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
381:  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
383:  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
384:  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
446:Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision A1). Width is caller-controlled (different surfaces need different widths Г?" `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
468:| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | Г?" | Public PDP gallery |
471:| `public_url` on upload response | 1024 | Г?" | Single representative URL returned by API; client renders srcset itself |
521:- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
522:- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
532:- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
557:| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` Г+' contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` Г+' contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 Г+' contains `mb-0.25` (universal byte-cap invariant) |
576:| **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) A· `ResponsiveImage` atom in `packages/ui-web` A· `apps/customer-mobile/src/components/products/ProductGallery.tsx` A· public catalog `GET /catalog/products/:id/images` A· empty-state fallback to `GoldTexturePlaceholder` |
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
388:`storage_key` is intentionally NOT in the public DTO Г?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
490:- Each card: thumbnail (200A-200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) A· drag handle (right) A· alt-text input (one line) A· "Е1ЕYЕ_Е?Е," button (red, Г%Э 48 dp).
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
The spec update fixes the missing public mobile URLs, but it introduces contract gaps around authenticated shopkeeper image rendering, responsive preloading, and the renamed public URL field. These should be corrected before implementers rely on the design.

Full review comments:

- [P2] Keep storage_key available to authenticated image reads Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
  For authenticated shopkeeper flows, opening a product that already has images or reloading after a reorder still requires either `storage_key` or a prebuilt thumbnail URL, because the documented card renderer calls `imagekitUrl(storage_key, { width: 200 })`. If `storage_key` is literally returned only on the upload response, persisted images cannot render thumbnails after reload.

- [P2] Preload the responsive candidate, not the fallback URL Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
  On viewports/DPRs where `image.srcset` selects 320, 640, or 1920 instead of the w-1024 `default_url`, this preload fetches a URL the `<img>` may not use, causing a duplicate request or no useful LCP preload. The preload should include `imagesrcset`/`imagesizes` matching the image `sizes`, or otherwise target the same candidate the browser will select.

- [P3] Align public GET expectations with default_url Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
  Implementing this DTO means the public catalog GET no longer returns `public_url`, but the test matrix still says the uploadГ+'list integration expects `GET returns inserted row with public_url`. Please update that contract/test to expect `default_url` or explicitly document `public_url` as an alias.
2026-05-02T02:26:39.455755Z ERROR codex_core::session: failed to record rollout items: thread 019de67e-2e88-7c93-9f08-9cf8ec2865a1 not found
2026-05-02T02:26:39.508218Z ERROR codex_core::session: failed to record rollout items: thread 019de67e-2e60-7530-bb66-d80dedf6de5f not found
The spec update fixes the missing public mobile URLs, but it introduces contract gaps around authenticated shopkeeper image rendering, responsive preloading, and the renamed public URL field. These should be corrected before implementers rely on the design.

Full review comments:

- [P2] Keep storage_key available to authenticated image reads Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
  For authenticated shopkeeper flows, opening a product that already has images or reloading after a reorder still requires either `storage_key` or a prebuilt thumbnail URL, because the documented card renderer calls `imagekitUrl(storage_key, { width: 200 })`. If `storage_key` is literally returned only on the upload response, persisted images cannot render thumbnails after reload.

- [P2] Preload the responsive candidate, not the fallback URL Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
  On viewports/DPRs where `image.srcset` selects 320, 640, or 1920 instead of the w-1024 `default_url`, this preload fetches a URL the `<img>` may not use, causing a duplicate request or no useful LCP preload. The preload should include `imagesrcset`/`imagesizes` matching the image `sizes`, or otherwise target the same candidate the browser will select.

- [P3] Align public GET expectations with default_url Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
  Implementing this DTO means the public catalog GET no longer returns `public_url`, but the test matrix still says the uploadГ+'list integration expects `GET returns inserted row with public_url`. Please update that contract/test to expect `default_url` or explicitly document `public_url` as an alias.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "type \"docs\\reviews\\codex-story-17.1-spec-round7-20260501.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 623ms:
OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019de683-d9e1-72a3-9f62-001ec28a7fe5
--------
user
commit 794d99e
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline --decorate --no-renames 794d99e' in C:\Alok\Business Projects\Goldsmith
 succeeded in 507ms:
794d99e (HEAD -> main) docs(story-17.1): codex round 6 Г?" split shopkeeper/public DTOs + responsive preload
 .../2026-05-01-story-17.1-image-pipeline-design.md | 56 +++++++++++++++++++---
 1 file changed, 49 insertions(+), 7 deletions(-)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --no-ext-diff --unified=80 --no-renames 794d99e -- "*.md"' in C:\Alok\Business Projects\Goldsmith
 succeeded in 488ms:
commit 794d99ea92caa4507d0bdd7870c0ffcf5fdc442e
Author: Alok Tiwari <aloktiwari49@gmail.com>
Date:   Fri May 1 22:28:06 2026 -0400

    docs(story-17.1): codex round 6 Г?" split shopkeeper/public DTOs + responsive preload
    
    Round-5 patch hid storage_key from the public DTO (correct) but my
    wording said "storage_key returned only on the upload response" Г?" too
    narrow. The shopkeeper image manager re-renders thumbnails after every
    reload (calling imagekitUrl(storage_key, { width: 200 })), so it needs
    storage_key on every authenticated read, not just the upload response.
    
    Made the two DTOs explicit:
    - ImageRow (authenticated shopkeeper) Г?" includes storage_key + scan_status
      + uploaded_by + timestamps. Returned by POST upload, GET list, PATCH
      reorder, PATCH alt-text. Shopkeeper UI builds thumbnail URLs via the
      builder against the row's storage_key.
    - PublicImageRow (anonymous catalog) Г?" server-pre-built srcset +
      default_url + placeholder_url; no storage_key. Server maps ImageRow
      Г+' PublicImageRow at the catalog endpoint boundary.
    
    Round-5 also said "first image preload uses href={default_url}" but on
    mobile viewports the browser picks 320w/640w from the srcset, so the
    1024w preload was wasted. Fixed: preload now emits imagesrcset +
    imagesizes matching the <img srcset> + sizes so the browser preloads
    the SAME candidate it'll pick.
    
    Cleaned up stale "public_url" references in the upload response shape
    (now returns full ImageRow), the upload flow's step-10 return, and the
    caller-side width vocabulary table.
    
    Updated test rows to assert: (a) authenticated GET returns ImageRow
    with storage_key, (b) anonymous catalog GET returns PublicImageRow
    with all three URL fields and NO storage_key.
    
    Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index c2a3e1a..36a3bf6 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -128,505 +128,547 @@ If Codex flags this, the Phase-2 implementer can revisit Г?" the AC's "403" phra
 
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
-       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
+       Response 201: ImageRow  (full shape Г?" see "Authenticated shopkeeper response" type below; shopkeeper UI renders thumbnails by calling imagekitUrl(row.storage_key, { width: 200 }))
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
 
-10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
+10. return row  // ImageRow including storage_key Г?" shopkeeper UI builds its own thumbnail URLs via imagekitUrl()
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
     Response: { images: PublicImageRow[] }
 ```
 
 `PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
 
 ```typescript
 type PublicImageRow = {
   id: string;
   alt_text: string | null;          // null Г+' caller renders auto-fallback "<product> Г?" ЕЕ,ЕЭ?ЕцЕЭ?Е° <n>"
   width: number;                    // post-rotation
   height: number;
   srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
                                     // every URL carries q-auto, f-auto, mb-0.25 via the builder
   default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
   placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
 };
 ```
 
-`storage_key` is intentionally NOT in the public DTO Г?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+`storage_key` is intentionally **NOT in the public DTO** Г?" `PublicImageRow` is anonymous-anyone consumable, so the internal blob path is hidden behind server-built URLs.
 
-Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+**Authenticated shopkeeper endpoints, however, return `storage_key` and the full row** because the shopkeeper image manager (the mobile screen that lists, reorders, and deletes images) needs to construct thumbnail URLs via `imagekitUrl(row.storage_key, { width: 200 })` for every image Г?" including images persisted on prior visits. The two DTO shapes are explicitly different:
+
+```typescript
+// Authenticated shopkeeper response (GET /api/v1/products/:productId/images,
+// POST upload, PATCH reorder, PATCH alt-text)
+type ImageRow = {
+  id: string;
+  shop_id: string;
+  product_id: string;
+  storage_key: string;            // exposed: shopkeeper owns the data
+  alt_text: string | null;
+  mime_type: string;
+  byte_size: number;
+  width: number;
+  height: number;
+  exif_stripped_at: string;       // ISO timestamp
+  uploaded_by_user_id: string;
+  scan_status: 'pending' | 'clean' | 'rejected';
+  sort_order: number;
+  created_at: string;
+  updated_at: string;
+};
+
+// Anonymous public response (GET /api/v1/catalog/products/:productId/images)
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;
+  width: number;
+  height: number;
+  srcset: string;                 // server-pre-built; no storage_key exposed
+  default_url: string;
+  placeholder_url: string;
+};
+```
+
+The public catalog endpoint maps `ImageRow` Г+' `PublicImageRow` server-side, calling `imagekitUrl(row.storage_key, { width: N })` for every needed variant. All public surfaces consume `PublicImageRow[]` directly, preserving the "every customer-facing URL has `mb-0.25`" invariant Г?" the client never composes ImageKit URLs.
+
+Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
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
 | Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | Г?" | Public PDP gallery |
 | Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
 | Shopkeeper image manager card | 200 | Г?" | Internal thumbnail in the upload UI |
-| `public_url` on upload response | 1024 | Г?" | Single representative URL returned by API; client renders srcset itself |
+| `PublicImageRow.default_url` (server-built) | 1024 | Г?" | Public catalog response field; non-srcset fallback / LCP preload `href` |
+| `PublicImageRow.placeholder_url` (server-built) | 200 | 30 | Public catalog response field; LQIP for `<img>` decoration / `expo-image` placeholder |
+| `PublicImageRow.srcset` (server-built) | 320 / 640 / 1024 / 1920 | Г?" | Pre-built srcset string for customer `<img srcset>` |
 
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
 - Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
+- `loading="lazy"` on all but the first image; the first image's responsive preload is emitted via `next/head` as
+  `<link rel="preload" as="image" fetchpriority="high" href={image.default_url} imagesrcset={image.srcset} imagesizes={sizes}>`
+  so the browser preloads the SAME candidate it picks from the `<img srcset>` (otherwise on a 320w mobile viewport the browser would fetch w-320 from the `<img>` while preload wasted bytes on w-1024). `href` is the non-srcset fallback for browsers that ignore `imagesrcset`.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap Г+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
 - Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
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
-| Integration: upload Г+' list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
+| Integration: upload Г+' list (shopkeeper) | `product-images.integration.spec.ts` | Authenticated POST then authenticated GET `/products/:id/images` Г+' returns `ImageRow[]` with `storage_key`, all timestamps, `scan_status`, etc. |
+| Integration: upload Г+' public catalog | `product-images.public-catalog.spec.ts` | Authenticated POST then anonymous GET `/catalog/products/:id/images` Г+' returns `PublicImageRow[]` with `srcset`, `default_url`, `placeholder_url` (all containing `mb-0.25`); `storage_key` field is absent from response JSON |
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
 
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:28:34.814002Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content -Path '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { '{0,4}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 180 -First 220'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content -Path '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { '{0,4}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 180 -First 220' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content -Path '"'docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' | ForEach-Object { '{0,4}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 180 -First 220'` rejected: blocked by policy
2026-05-02T02:28:39.823650Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180 < i <= 400:
        print(f'{i:4}: {line}')
PY"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180 < i <= 400:
        print(f'{i:4}: {line}')
PY" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python - <<'PY'
from pathlib import Path
p=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if 180 < i <= 400:
        print(f'{i:4}: {line}')
PY"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n \".*\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 432ms:
1:# Story 17.1 Г?" Product Image Pipeline Design
2:
3:**Date:** 2026-05-01
4:**Class:** A (multi-tenant storage, encrypted-at-rest assets, RLS-protected metadata, signed-URL upload, EXIF-stripping pipeline)
5:**Wave:** 7A Г?" foundation; blocks 17.10 / 18.1 / 18.5 / 18.6 / 18.10
6:**Worktree:** `C:/gs17a-img/`
7:**Branch:** `feat/story-17.1-image-pipeline`
8:**Migration reserved:** 0057
9:**Source artefacts:** `_bmad-output/planning-artifacts/epics-E17-E18.md` Story 17.1 A· `docs/customer-storefront-gap-analysis-2026-05-01.md` AT1.1 A· `docs/prd-addendum-customer-storefront.md` FR90/NFR-IMG-1
10:**FRs implemented:** FR90 (multi-image PDP Г?" completion); foundation for FR127 / FR135
11:**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest Г?" Azure Storage SSE per ADR-0015 supersession), NFR-S3 (tenant-scoped image isolation), NFR-C7 (data residency Г?" Azure Central / South India per ADR-0015), NFR-A4 (alt text), NFR-P9 (image p95 < 500 ms thumbnails), NFR-SE-2 (Lighthouse SEO Г%Э 90)
12:
13:---
14:
15:## What we're building
16:
17:A shopkeeper can upload, reorder, edit alt-text, and delete real product photographs against a product. The customer storefront (web + mobile) replaces the `GoldTexturePlaceholder` stub with a real multi-image gallery driven by ImageKit-transformed CDN URLs.
18:
19:The pipeline must:
20:- Refuse non-image uploads via magic-byte sniffing.
21:- Strip EXIF (GPS, device fingerprint) before persistence.
22:- Reject pathological sources that cannot compress under 250 KB at the smallest variant.
23:- Persist metadata in `product_images` under tenant RLS.
24:- Mint short-lived Azure SAS upload URLs and unsigned ImageKit transform URLs for read.
25:- Ship dual-mode: STUB adapter for dev/CI (no Azure spend), AZURE+IMAGEKIT adapter for production (ready when SOW signs).
26:
27:---
28:
29:## Design decisions
30:
31:### 1. Lazy variant generation via ImageKit transforms (one blob per source)
32:
33:The story AC says "ImageKit transcodes the source into 4 variants (320w / 640w / 1024w / 1920w) all under 250 KB each." We satisfy this with on-demand transforms, not eager pre-transcode:
34:
35:- One Azure Blob per uploaded source image.
36:- One `product_images` row per source (no per-variant rows).
37:- Customer `<ResponsiveImage>` renders `srcset` of ImageKit URLs with `tr=w-{320|640|1024|1920},q-auto,f-auto,mb-0.25`.
38:- ImageKit serves WebP / AVIF (`f-auto`) and adaptive quality (`q-auto`).
39:- The `mb-0.25` transform parameter caps each variant at 0.25 MB (250 KB) on the **CDN side** Г?" ImageKit iteratively reduces quality until the response body fits. This is the binding NFR-IMG-1 enforcement, independent of the upload-time sharp probe (the probe is only a fast pre-reject for pathological sources; ImageKit's `mb-` is what the customer actually receives).
40:- First request to a new variant width has a 1Г?"2 s cold-cache penalty; cache warms on first viewer. For an anchor MVP with low traffic per width, the warmed-up p95 Г% 500 ms target is comfortable.
41:
42:**Plan caveat:** ImageKit's `mb-` transformation is supported on the Free + Standard plans (verified during Phase 2 plan-session against ImageKit's current docs as part of WS-A); if a future plan-tier change ever drops `mb-` support, we fall back to per-width fixed quality bands (`q-{tier-specific}` chosen against typical jewellery photos). Recorded as a residual risk.
43:
44:**Rejected:** eager pre-transcode (4A- storage cost, second BullMQ worker, duplicates work the CDN already does). Hybrid (pre-bake LCP only) was considered and rejected as YAGNI. **Sharp-probe-only enforcement** (without ImageKit `mb-`) was Codex round-1 wording Г?" round-2 review correctly noted that sharp's WebP encoder Г%  ImageKit's `q-auto` encoder, so the probe cannot guarantee the CDN output fits 250 KB; the `mb-` parameter closes that gap on ImageKit's side.
45:
46:### 2. Server-routed upload with synchronous validation
47:
48:Browser POSTs `multipart/form-data` to the API. The API:
49:1. Enforces 5 MB body cap at NestJS interceptor (HTTP 413 + Hindi error if exceeded).
50:2. MIME-sniffs via `file-type` magic-byte detection. Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`. SVG is rejected outright (script-injection risk).
51:3. Probes the **largest** variant (`1920w`) via `sharp` re-encoding to WebP at `quality: 80, effort: 6` to check if it fits Г% 250 KB. If 1920w fits, the smaller widths (320w/640w/1024w) under ImageKit `q-auto,f-auto` are guaranteed to. If not Г+' HTTP 400 + Hindi error + `IMAGE_TOO_LARGE_AFTER_COMPRESSION` audit row.
52:4. Strips EXIF using sharp's **default** behaviour after `.rotate()`: `sharp(buf).rotate().toBuffer()`. Per sharp v0.31+ docs, the default behaviour (no `withMetadata()` call) strips ALL metadata including EXIF, ICC, and GPS. `.rotate()` applies the source EXIF orientation and then drops the orientation tag, so visual orientation is preserved while metadata is gone.
53:5. Writes the cleaned buffer to Azure (or stub-disk) **before** the DB transaction.
54:6. Inside a DB transaction with `SELECT ... FOR UPDATE` on `products` row: verifies tenant ownership (FK alone is insufficient Г?" PostgreSQL FK checks bypass RLS), enforces the 10-image cap atomically, computes next sort order, inserts the row, emits the audit event.
55:
56:**Rejected:** direct-to-Azure SAS upload (eventual error model conflicts with the AC's synchronous 400 wording; would require pending/rejected state machine in the table). ImageKit-direct upload (loses control of EXIF strip + audit point + Azure data-residency). Probing only the smallest 320w variant (false positive Г?" high-detail jewellery sources can pass 320w but exceed 250KB at 1920w under ImageKit q-auto, violating NFR-IMG-1 silently).
57:
58:### 3. MIME sniff + port-stub for malware scan; no AV in MVP
59:
60:The AC's named threat Г?" PHP webshell renamed `.jpg` Г?" is fully addressed by magic-byte mismatch (PHP source is ASCII; doesn't satisfy any image magic-byte signature). Beyond that, the realistic threat surface for shopkeeper-authenticated image uploads is:
61:
62:- Webshell-as-image Г?" defeated because ImageKit-transformed bytes are what's served, not the original.
63:- Polyglot (image + JS) Г?" defeated by `Content-Type: image/*` enforcement on egress + browser image-tag isolation.
64:- libvips CVEs Г?" defeated by MIME + width / height / byte caps before `sharp` runs.
65:- Steganography Г?" not a malware vector for our threat model.
66:
67:Story ships:
68:- `MalwareScanPort` interface in `@goldsmith/integrations-storage` with a single method `scan(buf: Buffer, mime: string): Promise<{ clean: boolean; reason?: string }>`.
69:- `StubMalwareScanAdapter` that returns `{ clean: true }` unconditionally. Wired by default.
70:- `scan_status` column defaults to `'clean'` in MVP.
71:- Threat model + runbook explicitly record "MIME sniff is sole AV layer in MVP; ClamAV / Defender deferred to SOW funding." A future Class A story can swap the stub for `ClamAVAdapter` without schema migration.
72:
73:**Rejected:** synchronous ClamAV (blows the Г% $20/mo Container Apps consumption tier; 200Г?"1000 ms latency per upload). Async BullMQ scan (worker + state machine for negligible MVP threat reduction).
74:
75:### 4. Real Azure + ImageKit adapter shipped behind feature flag
76:
77:`STORAGE_ADAPTER` env var controls runtime adapter selection:
78:- `stub` (default for dev / CI) Г+' `StubStorageAdapter`. Writes to `tmp/storage/` on local disk; serves blobs via dev-only `/dev-storage/:key` route. **Never** wired in production.
79:- `azure-imagekit` (production) Г+' `AzureBlobStorageAdapter` for SAS upload + private blob storage; `ImageKitTransformUrlBuilder` for read URLs (URL-builder only, not ImageKit's auth API Г?" public-by-construction transform URLs need no signing token).
80:
81:When SOW signs and Azure is provisioned, flip one env var. Zero code change. Adapter code is unit-tested against `@azure/storage-blob` mocks; real-Azure smoke is a post-SOW manual verification step (recorded as a residual risk in the runbook).
82:
83:**Rejected:** stub-only ship with adapter as a separate post-SOW story. Risk: integration assumptions never verified; adapter contract diverges from real Azure SAS semantics; expensive bug to find later.
84:
85:### 5. Schema extends `product_images` (migration 0057)
86:
87:Migration 0014 already created the table with `shop_id` + RLS + `ON DELETE CASCADE` from products. Migration 0057:
88:
89:- **DROPs** unused `variant` column (zero callers, zero data Г?" confirmed via grep).
90:- **ADDs** 9 columns + 1 index (see AMigration below).
91:
92:### 6. Hard delete with confirm, drag-handle reorder
93:
94:- Delete: shopkeeper opens the image in the manager, taps "Е1ЕYЕ_Е?Е,", confirms in a Hindi modal. Single SQL DELETE within tenant-tx. The Azure blob is also deleted (`DELETE_BLOB` job Г?" best-effort; blob orphans don't break correctness, only waste pennies).
95:- Reorder: `react-native-draggable-flatlist` (mobile shopkeeper). Drag emits `PATCH /products/:id/images/order` with the full ordered ID array; service does an atomic UPDATE of `sort_order` for all rows in tenant-tx.
96:- No soft delete. An image is not a compliance artefact; FK cascade on product delete already covers cleanup.
97:
98:### 7. Cap of 10 images per product
99:
100:Hard reject the 11th upload with HTTP 409 + Hindi error "Е?Е Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? Е.ЕЕиЕЕЕr 10 ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е,". Cap enforced in service via `inventory.repository.countImages()` (already implemented in 3.5 work).
101:
102:### 8. 404 (not 403) on cross-tenant API access Г?" deliberate AC deviation
103:
104:The Story 17.1 AC says: *"a customer of Tenant-B has the URL of a Rajesh-shop image Г+' the image loads (signed URLs are public-by-construction, intentional) BUT the API endpoints to list/modify/delete images return 403 (RLS blocks cross-tenant via API)."*
105:
106:We deviate from "403" to **404** for the API endpoints, matching the established tenant-isolation pattern across Story 1.5 (staff revocation), Story 6.1 (customer CRM), and the project rule "tenant-mismatch row not found = 404, no existence disclosure." Specifically:
107:
108:- Strict 403 implementation would require an explicit cross-tenant detection query (extra round-trip).
109:- For images, public ImageKit URLs already disclose existence; "404 vs 403" semantic difference is moot for confidentiality.
110:- 404-uniform reduces controller branching and matches every other tenant-scoped endpoint in the codebase.
111:
112:If Codex flags this, the Phase-2 implementer can revisit Г?" the AC's "403" phrasing was almost certainly descriptive ("the API blocks it") not prescriptive ("with HTTP code 403"). Recorded here so the deviation is explicit and reviewable.
113:
114:### 9. Alt text is nullable with auto-generated fallback
115:
116:- Column `alt_text TEXT NULL`.
117:- Render fallback when NULL: `<product_name> Г?" ЕЕ,ЕЭ?ЕцЕЭ?Е° <sort_order + 1>`.
118:- Shopkeeper can override per image via a single text input on the upload screen.
119:- Auto-fallback is not persisted (computed at render).
120:
121:---
122:
123:## Migration 0057
124:
125:**File:** `packages/db/src/migrations/0057_product_images_pipeline.sql`
126:
127:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
128:
129:1. No FKs into `product_images` exist (`grep -r 'REFERENCES product_images' packages/db` returns zero matches).
130:2. `product_images` has zero production data (anchor SOW unsigned; only stub rows from manual dev tests via the legacy `getImageUploadUrl` fire-and-forget path).
131:3. The legacy upload path code is deleted in the same PR (see "Legacy code retired" below), so no new stub rows can appear after this migration.
132:
133:```sql
134:-- 0057_product_images_pipeline.sql
135:-- Story 17.1 Г?" recreate product_images for the real upload pipeline.
136:--
137:-- DDL-only (migrator role compatible). No DML inside .sql migrations
138:-- per docs/db-workflow.md.
139:
140:-- Drop the original 0014 table (zero production data; no FK dependencies).
141:-- CASCADE removes the policy + grants + index implicitly.
142:DROP TABLE product_images CASCADE;
143:
144:-- Recreate with the full Story-17.1 schema.
145:CREATE TABLE product_images (
146:  shop_id              UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
147:  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
148:  product_id           UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
149:  storage_key          TEXT        NOT NULL,
150:  alt_text             TEXT,                                                            -- nullable; fallback computed at render
151:  mime_type            TEXT        NOT NULL,
152:  byte_size            BIGINT      NOT NULL,
153:  width                INTEGER     NOT NULL,
154:  height               INTEGER     NOT NULL,
155:  exif_stripped_at     TIMESTAMPTZ NOT NULL,
156:  uploaded_by_user_id  UUID        NOT NULL REFERENCES shop_users(id),
157:  scan_status          TEXT        NOT NULL DEFAULT 'clean'
158:    CHECK (scan_status IN ('pending', 'clean', 'rejected')),
159:  sort_order           INTEGER     NOT NULL DEFAULT 0,
160:  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
161:  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
162:);
163:
164:CREATE INDEX product_images_shop_id_idx       ON product_images (shop_id);
165:CREATE INDEX product_images_product_id_idx    ON product_images (product_id);
166:CREATE INDEX product_images_product_sort_idx  ON product_images (product_id, sort_order);
167:
168:ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
169:ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
170:DROP POLICY IF EXISTS rls_product_images_tenant_isolation ON product_images;
171:CREATE POLICY rls_product_images_tenant_isolation ON product_images
172:  FOR ALL
173:  USING       (shop_id = current_setting('app.current_shop_id', true)::uuid)
174:  WITH CHECK  (shop_id = current_setting('app.current_shop_id', true)::uuid);
175:
176:GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO app_user;
177:```
178:
179:**Legacy code retired in the same PR:**
180:- `apps/api/src/modules/inventory/inventory.service.ts` Г?" delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
181:- `apps/api/src/modules/inventory/inventory.controller.ts` Г?" delete `getImageUploadUrl` handler (line 148).
182:- `apps/api/src/modules/inventory/inventory.repository.ts` Г?" delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
183:- `apps/api/src/modules/inventory/inventory.service.test.ts` Г?" delete the `describe('getImageUploadUrl')` block (lines 103Г?"130).
184:
185:The new `ProductImagesController` / `ProductImagesService` / `ProductImagesRepository` (defined below) replace this path entirely. No callers of the legacy methods remain in the repo (`countImages` is kept and reused; only the upload-url + insert-record-only path is removed).
186:
187:**Drizzle schema update** (`packages/db/src/schema/product-images.ts`):
188:- Drop `variant` field.
189:- Add `alt_text`, `mime_type`, `byte_size`, `width`, `height`, `exif_stripped_at`, `uploaded_by_user_id`, `scan_status`, `updated_at`.
190:
191:**Audit enum update** (`packages/audit/src/audit-actions.ts`): add
192:- `PRODUCT_IMAGE_UPLOADED`
193:- `PRODUCT_IMAGE_REJECTED` (covers MIME / oversize / scan-rejection)
194:- `PRODUCT_IMAGE_DELETED`
195:- `PRODUCT_IMAGE_REORDERED`
196:
197:---
198:
199:## API
200:
201:### Endpoints
202:
203:```
204:POST   /api/v1/products/:productId/images          (multipart/form-data; field "file")
205:       Headers: Content-Length Г% 5 MB
206:       Optional field: "alt_text" (string, Г% 200 chars)
207:       Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
208:       Response 201: ImageRow  (full shape Г?" see "Authenticated shopkeeper response" type below; shopkeeper UI renders thumbnails by calling imagekitUrl(row.storage_key, { width: 200 }))
209:       Errors:
210:         400 INVALID_MIME       Г?" magic-byte sniff failed
211:         400 IMAGE_TOO_LARGE_AFTER_COMPRESSION Г?" sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
212:         400 INVALID_DIMENSIONS Г?" width or height outside [200, 8000]
213:         409 IMAGE_LIMIT_REACHED Г?" 10 already exist on this product
214:         413 PAYLOAD_TOO_LARGE  Г?" body > 5 MB
215:
216:DELETE /api/v1/products/:productId/images/:imageId
217:       Guards: same
218:       Response: 204 No Content; 404 if not found within tenant
219:
220:PATCH  /api/v1/products/:productId/images/order
221:       Body: { orderedIds: string[] }  (must contain every image of the product, no extras)
222:       Guards: same
223:       Response: 200 { images: ImageRow[] }
224:       Errors: 400 ORDER_LIST_MISMATCH (set inequality); 404 if any id not found in tenant
225:
226:PATCH  /api/v1/products/:productId/images/:imageId
227:       Body: { alt_text: string | null }   (only alt-text editable post-upload)
228:       Guards: same
229:       Response: 200 { image: ImageRow }
230:```
231:
232:### `ProductImagesService`
233:
234:```typescript
235:class ProductImagesService {
236:  async upload(input: {
237:    shopId: string;
238:    productId: string;
239:    userId: string;
240:    file: { buffer: Buffer; mimeType: string; size: number };
241:    altText?: string | null;
242:  }): Promise<ImageRow>;
243:
244:  async delete(shopId: string, productId: string, imageId: string): Promise<void>;
245:
246:  async reorder(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
247:
248:  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow>;
249:
250:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
251:}
252:```
253:
254:**`upload()` flow:**
255:
256:```
257:Pre-flight (no DB tx, fast-fail to caller):
258: 1. validate: file.size Г% 5 MB                                    Г+' throw 413 PAYLOAD_TOO_LARGE
259: 2. sniffed = await fileType.fromBuffer(file.buffer)
260:    if sniffed.mime Г^% ALLOW_LIST                                  Г+' audit REJECTED + throw 400 INVALID_MIME
261:    (ALLOW_LIST = image/jpeg, image/png, image/webp, image/heic Г?" SVG explicitly excluded)
262: 3. meta = await sharp(file.buffer).metadata()
263:    if meta.width < 200 || meta.height < 200                      Г+' throw 400 INVALID_DIMENSIONS
264:    if meta.width > 8000 || meta.height > 8000                    Г+' throw 400 INVALID_DIMENSIONS
265:
266:Variant byte-cap probe (worst-case width = 1920w):
267: 4. probe = await sharp(file.buffer)
268:              .rotate()                                             // apply EXIF orientation, then drop tag
269:              .resize({ width: 1920, withoutEnlargement: true })
270:              .toFormat('webp', { quality: 80, effort: 6 })
271:              .toBuffer()
272:    if probe.byteLength > 250_000                                 Г+' audit REJECTED + throw 400 IMAGE_TOO_LARGE_AFTER_COMPRESSION
273:    (rationale: if 1920w fits Г%250 KB at q-80/effort-6, the smaller widths
274:     320w/640w/1024w under ImageKit's q-auto definitely will. ImageKit's
275:     q-auto uses similar heuristics; sharp probe at q-80 is a conservative
276:     proxy. Documented assumption; verified during smoke testing.)
277:
278:EXIF strip (the bytes that get persisted):
279: 5. cleaned = await sharp(file.buffer).rotate().toBuffer()
280:    // .rotate() applies EXIF orientation tag, then sharp's default toBuffer()
281:    // strips ALL metadata (EXIF, ICC, GPS) Г?" verified per sharp v0.31+ docs:
282:    // "default behaviour, when withMetadata() is not called, strips all metadata"
283:
284: 5b. cleanedMeta = await sharp(cleaned).metadata()
285:    // Re-read width/height AFTER rotate, because sources with EXIF orientation
286:    // 5/6/7/8 (90A° / 270A°) physically swap pixel dimensions during .rotate().
287:    // step-3 meta.width/height reflect the source orientation; the persisted
288:    // bytes have cleanedMeta.width/height. Storing the latter is what the
289:    // customer-facing srcset and aspect-ratio CSS need.
290:
291: 6. malware = await scanPort.scan(cleaned, sniffed.mime)            // stub returns {clean:true} in MVP
292:    if !malware.clean                                              Г+' audit REJECTED + throw 400 SCAN_FAILED
293:
294:Storage upload (BEFORE DB tx; orphan on tx failure is acceptable):
295: 7. storageKey = `tenant/${shopId}/products/${productId}/${uuid()}.${extFromMime(sniffed.mime)}`
296: 8. await storagePort.uploadBuffer(storageKey, cleaned, sniffed.mime)
297:
298:DB transaction with pessimistic product-row lock (serializes uploads per product):
299: 9. await withTenantTx(async (tx) => {
300:     a. owned = await tx.query(
301:          `SELECT id FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
302:          [productId, shopId]
303:        )
304:        if owned.rowCount === 0:
305:          // Cross-tenant attempt OR product doesn't exist. FK on
306:          // product_images.product_id alone is INSUFFICIENT Г?" PostgreSQL FK
307:          // checks bypass RLS, so without this explicit tenant-scoped lookup
308:          // an attacker with a tenant-A token could attach an image row to
309:          // tenant-B's product_id. The FOR UPDATE lock also serializes
310:          // concurrent uploads against the cap.
311:          throw 404 NOT_FOUND  (after best-effort blob delete)
312:
313:     b. count = await tx.query(`SELECT COUNT(*) FROM product_images WHERE product_id = $1`, [productId])
314:        if count >= 10:
315:          throw 409 IMAGE_LIMIT_REACHED  (after best-effort blob delete)
316:
317:     c. nextSort = await tx.query(
318:          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
319:          [productId]
320:        )
321:
322:     d. row = await tx.query(`INSERT INTO product_images (...) VALUES (...) RETURNING ...`, {
323:          shopId, productId, storageKey, mimeType: sniffed.mime, byteSize: cleaned.length,
324:          width: cleanedMeta.width, height: cleanedMeta.height,        // post-rotation dimensions
325:          sortOrder: nextSort,
326:          altText, uploadedByUserId: userId, exifStrippedAt: NOW(), scanStatus: 'clean',
327:        })
328:
329:     e. await audit.emit(tx, PRODUCT_IMAGE_UPLOADED, { imageId: row.id, byteSize: cleaned.length })
330:     return row
331:   })
332:
333:10. return row  // ImageRow including storage_key Г?" shopkeeper UI builds its own thumbnail URLs via imagekitUrl()
334:```
335:
336:**Transaction boundary clarification:** storage upload (step 8) runs **before** the DB transaction (step 9) so that:
337:- A storage-upload failure short-circuits Г?" no DB row, clean caller error.
338:- If the DB tx rolls back (cross-tenant 404, cap 409), the orphan blob is deleted on a best-effort basis in the catch handler; if the delete fails, reconciliation sweep (Phase 3+ runbook task) cleans it up. Impact: pennies of wasted storage; never a row-without-blob.
339:- The pessimistic `SELECT ... FOR UPDATE` on `products` row inside the tx serializes concurrent uploads for the same product, making the 10-cap inviolable under any concurrency.
340:
341:### `ProductImagesRepository`
342:
343:```typescript
344:class ProductImagesRepository {
345:  // The upload flow uses raw tx queries (lockProductForUpdate + countImagesInTx +
346:  // nextSortOrderInTx + insertInTx) so that a single tenant-tx contains the whole
347:  // critical section: tenant ownership check, cap enforcement, sort_order
348:  // computation, insert, audit. See ProductImagesService.upload() for the exact
349:  // SQL. Each step is implemented as a small helper on this repo:
350:  async lockProductForTenant(tx: Tx, shopId: string, productId: string): Promise<{ id: string } | null>;
351:  async countImagesInTx(tx: Tx, productId: string): Promise<number>;
352:  async nextSortOrderInTx(tx: Tx, productId: string): Promise<number>;          // returns 0 if empty
353:  async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow>;
354:
355:  // Read + mutating endpoints used outside the upload flow:
356:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
357:  async deleteImage(shopId: string, productId: string, imageId: string): Promise<{ storageKey: string } | null>;
358:  async setSortOrders(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
359:  async setAltText(shopId: string, productId: string, imageId: string, altText: string | null): Promise<ImageRow | null>;
360:}
361:```
362:
363:All queries run inside `withTenantTx`; tenant context (`app.current_shop_id`) is injected by interceptor before the service call. RLS is the floor; service-level `WHERE shop_id = $caller` is the second layer per the no-cross-tenant rule. The `lockProductForTenant` SELECT is the third Г?" explicit tenant-scoped existence check that does NOT bypass RLS-style logic the way a bare FK constraint does.
364:
365:### Public catalog endpoint (read path)
366:
367:```
368:GET /api/v1/catalog/products/:productId/images
369:    Public (no auth). Tenant resolved by request domain (existing pattern).
370:    Response: { images: PublicImageRow[] }
371:```
372:
373:`PublicImageRow` shape (server pre-computes every URL via `imagekitUrl()` so the client never sees `storage_key` and never builds ImageKit URLs by hand):
374:
375:```typescript
376:type PublicImageRow = {
377:  id: string;
378:  alt_text: string | null;          // null Г+' caller renders auto-fallback "<product> Г?" ЕЕ,ЕЭ?ЕцЕЭ?Е° <n>"
379:  width: number;                    // post-rotation
380:  height: number;
381:  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
382:                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
383:  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
384:  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
385:};
386:```
387:
388:`storage_key` is intentionally **NOT in the public DTO** Г?" `PublicImageRow` is anonymous-anyone consumable, so the internal blob path is hidden behind server-built URLs.
389:
390:**Authenticated shopkeeper endpoints, however, return `storage_key` and the full row** because the shopkeeper image manager (the mobile screen that lists, reorders, and deletes images) needs to construct thumbnail URLs via `imagekitUrl(row.storage_key, { width: 200 })` for every image Г?" including images persisted on prior visits. The two DTO shapes are explicitly different:
391:
392:```typescript
393:// Authenticated shopkeeper response (GET /api/v1/products/:productId/images,
394:// POST upload, PATCH reorder, PATCH alt-text)
395:type ImageRow = {
396:  id: string;
397:  shop_id: string;
398:  product_id: string;
399:  storage_key: string;            // exposed: shopkeeper owns the data
400:  alt_text: string | null;
401:  mime_type: string;
402:  byte_size: number;
403:  width: number;
404:  height: number;
405:  exif_stripped_at: string;       // ISO timestamp
406:  uploaded_by_user_id: string;
407:  scan_status: 'pending' | 'clean' | 'rejected';
408:  sort_order: number;
409:  created_at: string;
410:  updated_at: string;
411:};
412:
413:// Anonymous public response (GET /api/v1/catalog/products/:productId/images)
414:type PublicImageRow = {
415:  id: string;
416:  alt_text: string | null;
417:  width: number;
418:  height: number;
419:  srcset: string;                 // server-pre-built; no storage_key exposed
420:  default_url: string;
421:  placeholder_url: string;
422:};
423:```
424:
425:The public catalog endpoint maps `ImageRow` Г+' `PublicImageRow` server-side, calling `imagekitUrl(row.storage_key, { width: N })` for every needed variant. All public surfaces consume `PublicImageRow[]` directly, preserving the "every customer-facing URL has `mb-0.25`" invariant Г?" the client never composes ImageKit URLs.
426:
427:Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
428:
429:---
430:
431:## Storage adapter Г?" extension
432:
433:### `@goldsmith/integrations-storage` additions
434:
435:**`storage.port.ts`** Г?" extend with one new method needed for bytes-flow:
436:```typescript
437:export interface StoragePort {
438:  // existing
439:  getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
440:  getPublicUrl(key: string): Promise<string>;
441:  downloadBuffer(key: string): Promise<Buffer>;
442:  uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void>;
443:  getPresignedReadUrl(key: string): Promise<string>;
444:  // new
445:  deleteBlob(key: string): Promise<void>;
446:}
447:```
448:
449:**`MalwareScanPort`** Г?" new file `malware-scan.port.ts`:
450:```typescript
451:export interface MalwareScanPort {
452:  scan(buffer: Buffer, mimeType: string): Promise<{ clean: boolean; reason?: string }>;
453:}
454:export const MALWARE_SCAN_PORT = 'MALWARE_SCAN_PORT';
455:```
456:
457:### `StubStorageAdapter` Г?" fill the dev/CI path
458:
459:Currently throws on real I/O. Implement against local disk:
460:- `uploadBuffer`: writes to `${process.env.STUB_STORAGE_DIR ?? './tmp/storage'}/${key}`, creates parent dirs.
461:- `downloadBuffer`: reads same path.
462:- `deleteBlob`: best-effort `fs.unlink`.
463:- `getPublicUrl`: returns `http://localhost:${PORT}/dev-storage/${key}` (a dev-only Express middleware on the API serves files from STUB_STORAGE_DIR Г?" bound to `127.0.0.1` only, never deployed).
464:- `getPresignedUploadUrl` / `getPresignedReadUrl`: identical stub URLs (since STUB doesn't enforce TTL).
465:
466:### `AzureBlobStorageAdapter` Г?" real implementation
467:
468:Constructor reads:
469:- `AZURE_STORAGE_ACCOUNT` (e.g., `goldsmithprod`)
470:- `AZURE_STORAGE_ACCOUNT_KEY` (Key Vault Г?" for SAS signing)
471:- `AZURE_STORAGE_CONTAINER` (e.g., `product-images`)
472:
473:Methods:
474:- `uploadBuffer(key, data, mime)`: `BlobServiceClient.getContainerClient(container).getBlockBlobClient(key).uploadData(data, { blobHTTPHeaders: { blobContentType: mime } })`.
475:- `getPresignedUploadUrl(key, mime)`: builds SAS with `sr=b`, `sp=cw` (create+write), `se=now+1h`, `Content-Type` enforced.
476:- `getPresignedReadUrl(key)`: builds SAS with `sp=r`, `se=now+1h`. **Used only for the dev-storage fallback path; production reads use `getPublicUrl`.**
477:- `getPublicUrl(key)`: returns `https://ik.imagekit.io/${IMAGEKIT_ID}/${key}` Г?" ImageKit Web Folder is configured to fetch from `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/`. Originals stay private in Azure; only ImageKit's authorized fetcher reads them.
478:- `deleteBlob(key)`: `blockBlobClient.delete()` with leniency for 404 (already deleted).
479:- `downloadBuffer(key)`: `blockBlobClient.downloadToBuffer()` (used only by reconciliation jobs, not request path).
480:
481:### `ImageKitTransformUrlBuilder`
482:
483:Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision A1). Width is caller-controlled (different surfaces need different widths Г?" `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
484:
485:```typescript
486:imagekitUrl(key: string, opts: {
487:  width: number;             // > 0; any positive integer the caller needs
488:  blur?: number;             // 1-100; emits `bl-${n}` for low-quality image placeholders
489:}): string
490:// Г+'  `https://ik.imagekit.io/${id}/${key}?tr=w-${width}[,bl-${blur}],q-auto,f-auto,mb-0.25`
491://
492:// Contract:
493://   * Every returned URL MUST contain `q-auto`, `f-auto`, and `mb-0.25`.
494://   * `bl-` is only present when `blur` is supplied (used by the mobile
495://     blur-placeholder, never on the persisted `public_url` field).
496://   * No code path constructs ImageKit URLs by hand Г?" all callers go
497://     through this builder. A unit test asserts the three required
498://     substrings appear in every output, regardless of options.
499:```
500:
501:**Caller-side width vocabulary** (documented for implementer reference; not enforced by the type system because future surfaces may add their own widths):
502:
503:| Surface | Width | Blur | Use |
504:|---|---|---|---|
505:| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | Г?" | Public PDP gallery |
506:| Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
507:| Shopkeeper image manager card | 200 | Г?" | Internal thumbnail in the upload UI |
508:| `PublicImageRow.default_url` (server-built) | 1024 | Г?" | Public catalog response field; non-srcset fallback / LCP preload `href` |
509:| `PublicImageRow.placeholder_url` (server-built) | 200 | 30 | Public catalog response field; LQIP for `<img>` decoration / `expo-image` placeholder |
510:| `PublicImageRow.srcset` (server-built) | 320 / 640 / 1024 / 1920 | Г?" | Pre-built srcset string for customer `<img srcset>` |
511:
512:Adding a new surface that needs a new width is fine Г?" just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
513:
514:### `StorageModule` Г?" wire selection
515:
516:`STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).
517:
518:---
519:
520:## Mobile Г?" shopkeeper image manager
521:
522:### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)
523:
524:Reachable from product edit screen via "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (n/10)" button.
525:
526:Layout:
527:- Header: "Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е," + "+ ЕoЕЭ<ЕнЕмЕЭ╪Е," button (top-right).
528:- `DraggableFlatList` of image cards (`react-native-draggable-flatlist`).
529:- Each card: thumbnail (200A-200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) A· drag handle (right) A· alt-text input (one line) A· "Е1ЕYЕ_Е?Е," button (red, Г%Э 48 dp).
530:- Tap "+ ЕoЕЭ<ЕнЕмЕЭ╪Е," Г+' `expo-image-picker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: false, quality: 0.95 })`.
531:- Selected image Г+' POST as multipart/form-data with `Authorization: Bearer <firebase>`.
532:- Upload progress: indeterminate spinner overlay; on success, append to list; on error, Hindi toast keyed by error code.
533:
534:**i18n** Г?" `packages/i18n/locales/hi-IN/inventory.json`:
535:```json
536:"images_title": "Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е,",
537:"images_add": "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕoЕЭ<ЕнЕмЕЭ╪Е,",
538:"images_count": "{{n}}/10",
539:"images_alt_placeholder": "ЕцЕЭ^ЕЕ¤ЕЭ?ЕжЕиЕ: ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ ЕцЕиЕцЕ°ЕЬ",
540:"images_delete_confirm": "ЕЕЭ?Е_Е_ Е+Еж ЕцЕ_ЕЕ^ Е╪Е, ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕЭ< Е1ЕYЕ_Е"Е_ ЕsЕ_Е1ЕЕЭ╪ Е1ЕЭ^Е,?",
541:"images_delete_yes": "Е1Е_Е?, Е1ЕYЕ_Е?Е,",
542:"images_delete_no": "Е°Е▌ЕЭ?Е▌ ЕЕ°ЕЭ╪Е,",
543:"images_err_invalid_mime": "ЕЕЭ╪ЕцЕ¤ JPEG / PNG / WebP / HEIC ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, Е,ЕЭ?ЕцЕЭ?ЕЕ_Е° ЕЕЭ? ЕoЕ_ЕЕЭ? Е1ЕЭ^Е,",
544:"images_err_too_large": "Е╪Е, ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕЭ? Е-ЕЭ?ЕЬЕцЕЕЭ?ЕЕ_ ЕкЕ1ЕЭ?Е ЕкЕнЕмЕЭ? Е1ЕЭ^ Г?" ЕЕЭЯЕжЕ_Е_ ЕЕr Е°ЕиЕoЕмЕЭ%Е¤ЕЭ?Е_ЕЭ,ЕЕ" ЕЕЭ? ЕЕЭ<ЕЕиЕ ЕЕ°ЕЭ╪Е,",
545:"images_err_invalid_dimensions": "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ Е+ЕЕ_Е° 200A-200 Е,ЕЭ╪ 8000A-8000 ЕЕЭ╪ ЕкЕЭ?Еs Е1ЕЭ<Е"Е_ ЕsЕ_Е1ЕиЕ?",
546:"images_err_payload": "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ Е+ЕЕ_Е° 5 MB Е,ЕЭ╪ Е.ЕЕиЕ Е1ЕЭ^",
547:"images_err_limit": "Е?Е Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? Е.ЕЕиЕЕЕr 10 ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е,",
548:"images_err_generic": "ЕЕ,ЕЭ?ЕцЕЭ?Е° Е.ЕжЕ¤ЕЭ<Ен Е"Е1ЕЭ?Е, Е1ЕЭ< Е,ЕЕЭ?ЕЭ Е▌ЕЭ<ЕкЕ_Е°Е_ ЕЕЭ<ЕЕиЕ ЕЕ°ЕЭ╪Е,ЕЭ"
549:```
550:
551:### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)
552:
553:Props: `{ images: PublicImageRow[]; productName: string }`.
554:
555:Layout:
556:- 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
557:- Г% 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
558:- Click hero Г+' opens lightbox (`<dialog>`, ESC closes).
559:- Г+?Г+' arrow keys cycle on desktop. Visible focus ring on the hero on focus.
560:- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
561:- `loading="lazy"` on all but the first image; the first image's responsive preload is emitted via `next/head` as
562:  `<link rel="preload" as="image" fetchpriority="high" href={image.default_url} imagesrcset={image.srcset} imagesizes={sizes}>`
563:  so the browser preloads the SAME candidate it picks from the `<img srcset>` (otherwise on a 320w mobile viewport the browser would fetch w-320 from the `<img>` while preload wasted bytes on w-1024). `href` is the non-srcset fallback for browsers that ignore `imagesrcset`.
564:- Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
565:
566:### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
567:
568:Props: same.
569:
570:Layout:
571:- Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
572:- Tap Г+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
573:- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
574:
575:---
576:
577:## Tests
578:
579:| Test | File | What it asserts |
580:|------|------|-----------------|
581:| Unit: MIME sniff | `product-images.service.spec.ts` | PHP-renamed-jpg Г+' throws `BadRequestException` with code `INVALID_MIME` + audit emitted |
582:| Unit: SVG rejection | same | SVG buffer Г+' throws even though magic-bytes match |
583:| Unit: oversized after compression | same | Synthetic high-detail source where the **1920 w** sharp probe at `quality:80, effort:6` exceeds 250 KB Г+' throws `BadRequestException` with code `IMAGE_TOO_LARGE_AFTER_COMPRESSION` + audit emitted; corresponding healthy-source case (probe Г% 250 KB) accepts |
584:| Unit: dimension guard | same | 100A-100 Г+' throws; 9000A-9000 Г+' throws |
585:| Unit: EXIF strip | same | A JPEG buffer with embedded EXIF (GPS + camera make) processed by `sharp(buf).rotate().toBuffer()` produces output with NO EXIF block (verified via `exifr.parse(out)` returning `null`); visual orientation is preserved (test source has orientation=6 / 90A° rotation) |
586:| Unit: dimensions after rotation | same | A 4000A-3000 source with EXIF orientation=6 (rotate 90A° clockwise) Г+' after `sharp(buf).rotate().toBuffer()`, the cleaned buffer's metadata reports 3000A-4000; the row inserted into `product_images` has `width=3000, height=4000`, NOT the source 4000A-3000 |
587:| Unit: upload happy path | same | Inserts row, calls storage `uploadBuffer` once with cleaned buffer + mime, audit `PRODUCT_IMAGE_UPLOADED` |
588:| Unit: image cap | same | 11th upload Г+' throws `IMAGE_LIMIT_REACHED`; cap is enforced inside the tx after `FOR UPDATE` lock |
589:| Concurrency: cap under race | `product-images.concurrency.spec.ts` | Two concurrent uploads on a product with 9 images Г+' exactly one inserts (count=10), the other throws `IMAGE_LIMIT_REACHED`; verified by spawning two awaiting `Promise.allSettled` calls against a real test DB with the lock pattern |
590:| Security: cross-tenant product attach | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B `productId` Г+' 404 `NOT_FOUND` (NOT a 500 from FK violation, NOT a successful insert); blob best-effort deleted afterward; no row in `product_images` |
591:| Unit: reorder | same | `setSortOrders` called with full ordered array; mismatch Г+' throws `ORDER_LIST_MISMATCH` |
592:| Unit: delete | same | Repo delete + storage `deleteBlob` called + audit |
593:| Integration: upload Г+' list (shopkeeper) | `product-images.integration.spec.ts` | Authenticated POST then authenticated GET `/products/:id/images` Г+' returns `ImageRow[]` with `storage_key`, all timestamps, `scan_status`, etc. |
594:| Integration: upload Г+' public catalog | `product-images.public-catalog.spec.ts` | Authenticated POST then anonymous GET `/catalog/products/:id/images` Г+' returns `PublicImageRow[]` with `srcset`, `default_url`, `placeholder_url` (all containing `mb-0.25`); `storage_key` field is absent from response JSON |
595:| Integration: tenant isolation | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B productId Г+' 404 |
596:| Integration: RLS at SQL layer | `product-images.rls.spec.ts` | Direct SQL with shop_id=A cannot SELECT shop_id=B images |
597:| Integration: stub storage round-trip | `stub-storage.integration.spec.ts` | uploadBuffer Г+' downloadBuffer returns same bytes |
598:| Integration: Azure adapter mocks | `azure-blob.adapter.spec.ts` | `@azure/storage-blob` mocked; SAS URL contains `sp=cw`, `se=` Г% 1h ahead, `sr=b` |
599:| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` Г+' contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` Г+' contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 Г+' contains `mb-0.25` (universal byte-cap invariant) |
600:| Performance: PDP gallery render | `product-gallery.perf.spec.ts` | First image load < 500 ms p95 against ImageKit cached path (with mocked CDN) |
601:| Performance: upload latency | `upload.perf.spec.ts` | Median upload + probe + EXIF strip + DB write < 2 s for a 4 MB JPEG |
602:| Security: payload size | `payload-size.security.spec.ts` | 6 MB body Г+' 413 before any sharp invocation |
603:| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
604:| a11y: gallery | `product-gallery.a11y.spec.ts` | axe-core on customer-web ProductGallery Г+' 0 violations; alt-text fallback verified |
605:
606:Coverage target: Г%Э 80 % on `product-images.service.ts` and adapters.
607:
608:---
609:
610:## Work streams
611:
612:| Stream | Responsibility |
613:|--------|----------------|
614:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
615:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
616:| **WS-C Security** | RLS test on `product_images` (cross-tenant SELECT denied) A· tenant-isolation integration test A· payload-size + malicious-MIME security tests A· `/security-review` gate |
617:| **WS-D Mobile (shopkeeper)** | `apps/shopkeeper/app/inventory/[id]/images.tsx` A· `expo-image-picker` integration A· `react-native-draggable-flatlist` reorder A· upload progress UI A· Hindi i18n A· 48 dp touch targets |
618:| **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) A· `ResponsiveImage` atom in `packages/ui-web` A· `apps/customer-mobile/src/components/products/ProductGallery.tsx` A· public catalog `GET /catalog/products/:id/images` A· empty-state fallback to `GoldTexturePlaceholder` |
619:| **WS-F Gate** | `codex review --base main` A· `/security-review` (Class A Г?" both run in parallel per CLAUDE.md ceremony) A· `.codex-review-passed` A· `.security-review-passed` A· runtime smoke (shopkeeper Android upload + customer-web PDP render) |
620:
621:**Order:** WS-A blocks everything. WS-B blocks WS-C / WS-D / WS-E. WS-C / WS-D / WS-E are parallel after WS-B. WS-F runs last.
622:
623:---
624:
625:## Smoke test protocol
626:
627:Run on real device (Moto G + Chrome desktop) after CI green.
628:
629:1. Boot API in `STORAGE_ADAPTER=stub` mode against a seeded shop with one product (no images).
630:2. Boot shopkeeper mobile (Metro fresh, `--clear`).
631:3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
632:4. Upload a real 4 MP JPEG from gallery Г+' expect spinner Г+' success Г+' image card rendered.
633:5. Upload PHP-renamed-as-jpg Г+' expect Hindi error toast "ЕЕЭ╪ЕцЕ¤ JPEG / PNG / WebP / HEIC ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, Е,ЕЭ?ЕцЕЭ?ЕЕ_Е° ЕЕЭ? ЕoЕ_ЕЕЭ? Е1ЕЭ^Е,".
634:6. Upload a 6 MB image Г+' expect "ЕЕ,ЕЭ?ЕцЕЭ?Е° ЕЕ_ Е+ЕЕ_Е° 5 MB Е,ЕЭ╪ Е.ЕЕиЕ Е1ЕЭ^" toast.
635:7. Upload 10 images Г+' 11th attempt Г+' expect "Е?Е Е%ЕЕЭ?ЕжЕ_Е▌ ЕЕЭ? Е.ЕЕиЕЕЕr 10 ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е," toast.
636:8. Reorder via drag handle Г+' reload screen Г+' confirm new order persists.
637:9. Edit alt-text on one image Г+' reload Г+' confirm persisted; clear it Г+' reload Г+' confirm fallback string renders.
638:10. Delete an image Г+' confirm modal Г+' confirm row removed and gallery count decrements.
639:11. Boot customer-web (`apps/customer-web` running against same DB).
640:12. Open `/products/<id>` of the seeded product Г+' expect real image gallery (hero + thumbs) replacing `GoldTexturePlaceholder`.
641:13. Click hero Г+' lightbox opens Г+' Г+?Г+' keys cycle Г+' ESC closes.
642:14. DevTools Network: confirm hero image URL contains `tr=w-1024,q-auto,f-auto,mb-0.25` and the response Content-Length Г% 250 000 bytes (the `mb-0.25` parameter is what enforces this on ImageKit; verify the parameter is in the URL AND the response body honours it).
643:15. Lighthouse audit on PDP Г+' SEO Г%Э 90, accessibility Г%Э 95.
644:16. axe-core CLI on `/products/<id>` Г+' zero violations.
645:
646:Production smoke (post-SOW Azure provisioning): repeat steps 1Г?"14 with `STORAGE_ADAPTER=azure-imagekit` against a real Azure container + ImageKit Web Folder. Recorded as runbook checklist; not blocking for this story's merge.
647:
648:---
649:
650:## Out of scope
651:
652:- Bulk re-encode of legacy placeholders (separate data migration, no rows exist today).
653:- AI auto-cropping / smart thumbnails.
654:- Watermarking.
655:- 360A° turntable capture (Story 18.6 reserves the data shape via `is_360_frame BOOLEAN`; capture pipeline is Phase 3+).
656:- Cart, online checkout, payments.
657:- Customer-side image upload (UGC reviews are FR99 territory; out of this story).
658:- ClamAV / Defender for Storage actual integration (port + stub only; real adapter post-SOW).
659:
660:---
661:
662:## Residual risks recorded in runbook
663:
664:1. **Azure adapter unverified against real Azure** until SOW provisions infrastructure. Adapter unit tests use `@azure/storage-blob` mocks; integration with real Azure SAS semantics is a post-SOW manual smoke.
665:2. **MIME-sniff is sole AV layer in MVP.** Threat model documents this. Real malware scan is a one-adapter-swap upgrade once budget exists.
666:3. **Orphan blob possibility** if Azure write succeeds but DB insert fails (network blip between steps 10 and 11 of `upload()` flow). Reconciliation job is a Phase 3+ story; impact is pennies of wasted storage, not data loss.
667:4. **ImageKit cold-cache penalty** on first request to a new variant width. Acceptable for MVP traffic; warm cache holds the p95 < 500 ms target.
668:5. **Stub storage local-disk** is dev-only and bound to `127.0.0.1`; never deployed. Threat model records the assumption.
669:6. **ImageKit Web Folder configuration is an ops-time prerequisite,** not story code. The runbook gains a checklist entry: "Provision ImageKit account; create Web Folder pointing to `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/` with read-only SAS credentials in ImageKit dashboard." This must be done before the production env-var flip from `stub` to `azure-imagekit`. Recorded here so the post-SOW deployment session does not skip it.
670:
671:---
672:
673:## References
674:
675:- `_bmad-output/planning-artifacts/epics-E17-E18.md` Story 17.1 (acceptance criteria source-of-truth)
676:- `docs/customer-storefront-gap-analysis-2026-05-01.md` AT1.1, A12.2, A12.6
677:- `docs/prd-addendum-customer-storefront.md` FR90 / NFR-IMG-1 / NFR-SE-2
678:- ADR-0007 (storage), ADR-0008 (multi-tenant isolation), ADR-0015 (Azure + Firebase, supersedes pre-Azure NFR-S2 / NFR-C7 wording)
679:- `feedback_startup_economics_first.md` (defer Azure spend until SOW)
680:- `feedback_fresh_session_prompt_ceremony.md` (Class A plan + exec are separate fresh sessions)
681:- `feedback_codex_worktree_clm.md` (Codex CLM blocker workaround for Windows worktrees)
682:- `memory/project_phase1_storefront_complete.md` (Phase 1 deliverables on main HEAD 669ee90)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:28:49.054767Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\" | Select-Object -Index (300..430)"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\" | Select-Object -Index (300..430)" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\" | Select-Object -Index (300..430)"` rejected: blocked by policy
2026-05-02T02:28:52.759207Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; lines=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md').read_text(encoding='utf-8').splitlines(); [print(f'{i+1}: {lines[i]}') for i in range(300,431)]\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; lines=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md').read_text(encoding='utf-8').splitlines(); [print(f'{i+1}: {lines[i]}') for i in range(300,431)]\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "python -c \"from pathlib import Path; lines=Path('docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md').read_text(encoding='utf-8').splitlines(); [print(f'{i+1}: {lines[i]}') for i in range(300,431)]\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --no-ext-diff --unified=12 --no-renames --format= -- docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md' in C:\Alok\Business Projects\Goldsmith
 succeeded in 450ms:
diff --git a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
index c2a3e1a..36a3bf6 100644
--- a/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
+++ b/docs/superpowers/specs/2026-05-01-story-17.1-image-pipeline-design.md
@@ -196,25 +196,25 @@ The new `ProductImagesController` / `ProductImagesService` / `ProductImagesRepos
 
 ---
 
 ## API
 
 ### Endpoints
 
 ```
 POST   /api/v1/products/:productId/images          (multipart/form-data; field "file")
        Headers: Content-Length Г% 5 MB
        Optional field: "alt_text" (string, Г% 200 chars)
        Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
-       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
+       Response 201: ImageRow  (full shape Г?" see "Authenticated shopkeeper response" type below; shopkeeper UI renders thumbnails by calling imagekitUrl(row.storage_key, { width: 200 }))
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
@@ -321,25 +321,25 @@ DB transaction with pessimistic product-row lock (serializes uploads per product
 
      d. row = await tx.query(`INSERT INTO product_images (...) VALUES (...) RETURNING ...`, {
           shopId, productId, storageKey, mimeType: sniffed.mime, byteSize: cleaned.length,
           width: cleanedMeta.width, height: cleanedMeta.height,        // post-rotation dimensions
           sortOrder: nextSort,
           altText, uploadedByUserId: userId, exifStrippedAt: NOW(), scanStatus: 'clean',
         })
 
      e. await audit.emit(tx, PRODUCT_IMAGE_UPLOADED, { imageId: row.id, byteSize: cleaned.length })
      return row
    })
 
-10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
+10. return row  // ImageRow including storage_key Г?" shopkeeper UI builds its own thumbnail URLs via imagekitUrl()
 ```
 
 **Transaction boundary clarification:** storage upload (step 8) runs **before** the DB transaction (step 9) so that:
 - A storage-upload failure short-circuits Г?" no DB row, clean caller error.
 - If the DB tx rolls back (cross-tenant 404, cap 409), the orphan blob is deleted on a best-effort basis in the catch handler; if the delete fails, reconciliation sweep (Phase 3+ runbook task) cleans it up. Impact: pennies of wasted storage; never a row-without-blob.
 - The pessimistic `SELECT ... FOR UPDATE` on `products` row inside the tx serializes concurrent uploads for the same product, making the 10-cap inviolable under any concurrency.
 
 ### `ProductImagesRepository`
 
 ```typescript
 class ProductImagesRepository {
   // The upload flow uses raw tx queries (lockProductForUpdate + countImagesInTx +
@@ -376,27 +376,64 @@ GET /api/v1/catalog/products/:productId/images
 type PublicImageRow = {
   id: string;
   alt_text: string | null;          // null Г+' caller renders auto-fallback "<product> Г?" ЕЕ,ЕЭ?ЕцЕЭ?Е° <n>"
   width: number;                    // post-rotation
   height: number;
   srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
                                     // every URL carries q-auto, f-auto, mb-0.25 via the builder
   default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
   placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
 };
 ```
 
-`storage_key` is intentionally NOT in the public DTO Г?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+`storage_key` is intentionally **NOT in the public DTO** Г?" `PublicImageRow` is anonymous-anyone consumable, so the internal blob path is hidden behind server-built URLs.
 
-Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
+**Authenticated shopkeeper endpoints, however, return `storage_key` and the full row** because the shopkeeper image manager (the mobile screen that lists, reorders, and deletes images) needs to construct thumbnail URLs via `imagekitUrl(row.storage_key, { width: 200 })` for every image Г?" including images persisted on prior visits. The two DTO shapes are explicitly different:
+
+```typescript
+// Authenticated shopkeeper response (GET /api/v1/products/:productId/images,
+// POST upload, PATCH reorder, PATCH alt-text)
+type ImageRow = {
+  id: string;
+  shop_id: string;
+  product_id: string;
+  storage_key: string;            // exposed: shopkeeper owns the data
+  alt_text: string | null;
+  mime_type: string;
+  byte_size: number;
+  width: number;
+  height: number;
+  exif_stripped_at: string;       // ISO timestamp
+  uploaded_by_user_id: string;
+  scan_status: 'pending' | 'clean' | 'rejected';
+  sort_order: number;
+  created_at: string;
+  updated_at: string;
+};
+
+// Anonymous public response (GET /api/v1/catalog/products/:productId/images)
+type PublicImageRow = {
+  id: string;
+  alt_text: string | null;
+  width: number;
+  height: number;
+  srcset: string;                 // server-pre-built; no storage_key exposed
+  default_url: string;
+  placeholder_url: string;
+};
+```
+
+The public catalog endpoint maps `ImageRow` Г+' `PublicImageRow` server-side, calling `imagekitUrl(row.storage_key, { width: N })` for every needed variant. All public surfaces consume `PublicImageRow[]` directly, preserving the "every customer-facing URL has `mb-0.25`" invariant Г?" the client never composes ImageKit URLs.
+
+Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
 ---
 
 ## Storage adapter Г?" extension
 
 ### `@goldsmith/integrations-storage` additions
 
 **`storage.port.ts`** Г?" extend with one new method needed for bytes-flow:
 ```typescript
 export interface StoragePort {
   // existing
   getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
@@ -459,25 +496,27 @@ imagekitUrl(key: string, opts: {
 //   * No code path constructs ImageKit URLs by hand Г?" all callers go
 //     through this builder. A unit test asserts the three required
 //     substrings appear in every output, regardless of options.
 ```
 
 **Caller-side width vocabulary** (documented for implementer reference; not enforced by the type system because future surfaces may add their own widths):
 
 | Surface | Width | Blur | Use |
 |---|---|---|---|
 | Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | Г?" | Public PDP gallery |
 | Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
 | Shopkeeper image manager card | 200 | Г?" | Internal thumbnail in the upload UI |
-| `public_url` on upload response | 1024 | Г?" | Single representative URL returned by API; client renders srcset itself |
+| `PublicImageRow.default_url` (server-built) | 1024 | Г?" | Public catalog response field; non-srcset fallback / LCP preload `href` |
+| `PublicImageRow.placeholder_url` (server-built) | 200 | 30 | Public catalog response field; LQIP for `<img>` decoration / `expo-image` placeholder |
+| `PublicImageRow.srcset` (server-built) | 320 / 640 / 1024 / 1920 | Г?" | Pre-built srcset string for customer `<img srcset>` |
 
 Adding a new surface that needs a new width is fine Г?" just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
 
 ### `StorageModule` Г?" wire selection
 
 `STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).
 
 ---
 
 ## Mobile Г?" shopkeeper image manager
 
 ### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)
@@ -510,25 +549,27 @@ Layout:
 ```
 
 ### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)
 
 Props: `{ images: PublicImageRow[]; productName: string }`.
 
 Layout:
 - 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
 - Г% 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
 - Click hero Г+' opens lightbox (`<dialog>`, ESC closes).
 - Г+?Г+' arrow keys cycle on desktop. Visible focus ring on the hero on focus.
 - Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
+- `loading="lazy"` on all but the first image; the first image's responsive preload is emitted via `next/head` as
+  `<link rel="preload" as="image" fetchpriority="high" href={image.default_url} imagesrcset={image.srcset} imagesizes={sizes}>`
+  so the browser preloads the SAME candidate it picks from the `<img srcset>` (otherwise on a 320w mobile viewport the browser would fetch w-320 from the `<img>` while preload wasted bytes on w-1024). `href` is the non-srcset fallback for browsers that ignore `imagesrcset`.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap Г+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
 - Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
 ---
@@ -540,25 +581,26 @@ Layout:
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
-| Integration: upload Г+' list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
+| Integration: upload Г+' list (shopkeeper) | `product-images.integration.spec.ts` | Authenticated POST then authenticated GET `/products/:id/images` Г+' returns `ImageRow[]` with `storage_key`, all timestamps, `scan_status`, etc. |
+| Integration: upload Г+' public catalog | `product-images.public-catalog.spec.ts` | Authenticated POST then anonymous GET `/catalog/products/:id/images` Г+' returns `PublicImageRow[]` with `srcset`, `default_url`, `placeholder_url` (all containing `mb-0.25`); `storage_key` field is absent from response JSON |
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
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Alok\Business Projects\Goldsmith
 succeeded in 439ms:
?? docs/reviews/codex-story-17.1-spec-20260501.md
?? docs/reviews/codex-story-17.1-spec-round2-20260501.md
?? docs/reviews/codex-story-17.1-spec-round3-20260501.md
?? docs/reviews/codex-story-17.1-spec-round4-20260501.md
?? docs/reviews/codex-story-17.1-spec-round5-20260501.md
?? docs/reviews/codex-story-17.1-spec-round6-20260501.md
?? docs/reviews/codex-story-17.1-spec-round7-20260501.md
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command dir in C:\Alok\Business Projects\Goldsmith
 succeeded in 468ms:


    Directory: C:\Alok\Business Projects\Goldsmith


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----         4/30/2026  10:36 PM                .claude                                                              
d-----         4/18/2026  12:43 PM                .github                                                              
d-----         4/30/2026   3:40 PM                .remember                                                            
d-----         4/19/2026   7:36 AM                .secrets                                                             
d-----          5/1/2026   8:21 AM                .serena                                                              
d-----         4/18/2026   6:36 AM                .turbo                                                               
d-----         4/29/2026   2:12 PM                .worktrees                                                           
d-----          5/1/2026   7:13 AM                apps                                                                 
d-----          5/1/2026   8:40 PM                docs                                                                 
d-----          5/1/2026   5:43 PM                node_modules                                                         
d-----         4/18/2026  12:43 PM                ops                                                                  
d-----         4/24/2026   3:30 PM                packages                                                             
d-----         4/20/2026   9:30 PM                scripts                                                              
d-----         4/15/2026   9:44 PM                _bmad                                                                
d-----         4/24/2026   2:56 PM                _bmad-output                                                         
-a----         4/29/2026   5:16 PM           5855 .bmad-readiness-passed                                               
-a----         4/29/2026  12:27 AM             59 .claude-review-passed                                                
-a----          5/1/2026   8:41 PM            496 .codex-review-passed                                                 
-a----         4/18/2026  12:43 PM            196 .editorconfig                                                        
-a----          5/1/2026   4:24 PM           8052 .eslintrc.cjs                                                        
-a----         4/18/2026  11:53 PM             61 .firebaserc                                                          
-a----          5/1/2026   9:31 PM           1203 .gitignore                                                           
-a----         4/18/2026  12:43 PM              9 .node-version                                                        
-a----         4/24/2026  11:57 AM            560 .npmrc                                                               
-a----         4/19/2026   6:46 AM            556 .pnpmfile.cjs                                                        
-a----         4/18/2026  12:43 PM             42 .prettierignore                                                      
-a----         4/18/2026  12:43 PM            113 .prettierrc                                                          
-a----          5/1/2026   8:41 PM            772 .security-review-passed                                              
-a----         4/24/2026  11:57 AM          21641 CLAUDE.md                                                            
-a----         4/18/2026  11:53 PM            116 firebase.json                                                        
-a----         4/24/2026  11:57 AM           1384 package.json                                                         
-a----          5/1/2026   5:43 PM         756126 pnpm-lock.yaml                                                       
-a----         4/23/2026   8:38 PM            126 pnpm-workspace.yaml                                                  
-a----         4/24/2026  11:57 AM            618 tsconfig.base.json                                                   
-a----         4/18/2026  12:43 PM             82 tsconfig.json                                                        
-a----          5/1/2026   7:13 AM            735 turbo.json                                                           
-a----         4/18/2026  12:43 PM            357 vitest.config.ts                                                     


Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "shop_id|shopId" apps/api/src/modules -g "*.ts" -n --max-count 5' in C:\Alok\Business Projects\Goldsmith
 succeeded in 465ms:
apps/api/src/modules\wishlist\wishlist.service.spec.ts:31:  vi.mocked(tenantContext.requireCurrent).mockReturnValue({ shopId: SHOP_ID } as never);
apps/api/src/modules\wishlist\wishlist.service.spec.ts:52:        id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID,
apps/api/src/modules\wishlist\wishlist.service.spec.ts:58:      expect(mockRepo.add).toHaveBeenCalledWith({ shopId: SHOP_ID, customerId: CUSTOMER_ID, productId: PRODUCT_ID });
apps/api/src/modules\wishlist\wishlist.service.spec.ts:80:        shopId: SHOP_ID, customerId: CUSTOMER_ID, productId: PRODUCT_ID,
apps/api/src/modules\wishlist\wishlist.service.spec.ts:108:      mockRepo.add.mockResolvedValueOnce({ id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID, product_id: PRODUCT_ID, created_at: new Date() });
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:80:       WHERE customer_id = $1 AND shop_id = $2
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:84:      [dto.customerId, ctx.shopId],
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:96:      `SELECT rate_lock_days FROM shop_settings WHERE shop_id = $1`,
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:97:      [ctx.shopId],
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.ts:102:    // The FK on customer_id only proves the customer exists, not that it belongs to ctx.shopId.
apps/api/src/modules\custom-orders\custom-orders.service.ts:44:  shopId:                  string;
apps/api/src/modules\custom-orders\custom-orders.service.ts:69:    shopId:                r.shop_id,
apps/api/src/modules\custom-orders\custom-orders.service.ts:108:      shopId:                ctx.shopId,
apps/api/src/modules\custom-orders\custom-orders.service.ts:122:    trackEvent(ctx.shopId, 'custom_order.created');
apps/api/src/modules\custom-orders\custom-orders.service.ts:172:      notes: { shopId: ctx.shopId, customOrderId: orderId, type: 'custom_order_deposit' },
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.controller.ts:98:    const shopIdHint    = notes['shopId']     ?? '';
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.controller.ts:105:      await this.svc.handleWebhookPayment(bookingId, razorpayPaymentId, shopIdHint);
apps/api/src/modules\catalog\catalog.service.ts:16:  shopId:          string;
apps/api/src/modules\catalog\catalog.service.ts:58:  shopId:      string;
apps/api/src/modules\catalog\catalog.service.ts:154:      shopId:          row.id,
apps/api/src/modules\catalog\catalog.service.ts:163:    const { shopId, categoryId, search, metal, page, limit } = params;
apps/api/src/modules\catalog\catalog.service.ts:168:    const queryParams: unknown[] = [shopId];
apps/api/src/modules\catalog\catalog.controller.spec.ts:34:  shopId: 'shop-uuid-1', primaryColor: '#B58A3C', logoUrl: null,
apps/api/src/modules\wishlist\wishlist.repository.ts:6:  shop_id:    string;
apps/api/src/modules\wishlist\wishlist.repository.ts:27:  async add(params: { shopId: string; customerId: string; productId: string }): Promise<WishlistRow> {
apps/api/src/modules\wishlist\wishlist.repository.ts:29:      `INSERT INTO wishlists (shop_id, customer_id, product_id)
apps/api/src/modules\wishlist\wishlist.repository.ts:31:       ON CONFLICT (shop_id, customer_id, product_id) DO NOTHING
apps/api/src/modules\wishlist\wishlist.repository.ts:33:      [params.shopId, params.customerId, params.productId],
apps/api/src/modules\wishlist\wishlist.service.ts:26:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\wishlist\wishlist.service.ts:30:      `SELECT id FROM products WHERE id = $1 AND shop_id = $2`,
apps/api/src/modules\wishlist\wishlist.service.ts:31:      [params.productId, shopId],
apps/api/src/modules\wishlist\wishlist.service.ts:35:    await this.repo.add({ shopId, customerId: params.customerId, productId: params.productId });
apps/api/src/modules\wishlist\wishlist.service.ts:40:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:21:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:36:        id, shopId: SHOP, sku: `SKU-${id.slice(0, 4)}`,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:61:        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:66:        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:73:          id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:13:  shopId: string;
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:75:        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:92:    params.push(a.shopId);
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:100:        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
apps/api/src/modules\platform-admin\services\tenant-management.service.ts:102:        ['tenant.updated', a.platformUserId, a.shopId, JSON.stringify(a.patch)],
apps/api/src/modules\custom-orders\custom-orders.repository.ts:7:  shop_id:                 string;
apps/api/src/modules\custom-orders\custom-orders.repository.ts:24:  shop_id:         string;
apps/api/src/modules\custom-orders\custom-orders.repository.ts:32:  id, shop_id, customer_id, description, design_reference_url,
apps/api/src/modules\custom-orders\custom-orders.repository.ts:39:  id, custom_order_id, shop_id, title, note, photo_url, created_at
apps/api/src/modules\custom-orders\custom-orders.repository.ts:47:    shopId: string;
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:12:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:13:    current: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:169:        if (sql.includes('SELECT id, shop_id, status')) {
apps/api/src/modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:170:          return { rows: [{ id: BOOKING, shop_id: SHOP, status: 'PENDING_PAYMENT' }] };
apps/api/src/modules\webhooks\razorpay.controller.ts:22:  // shopId is NOT trusted from the webhook payload Г?" it is resolved from the
apps/api/src/modules\webhooks\razorpay.controller.ts:25:  shopIdHint: string;
apps/api/src/modules\webhooks\razorpay.controller.ts:78:      // notes.shopId was set by OUR server at initiateUpiPayment time and is
apps/api/src/modules\webhooks\razorpay.controller.ts:81:      // validates the found row's shop_id matches before any DML.
apps/api/src/modules\webhooks\razorpay.controller.ts:83:      const shopIdHint = notes['shopId'] ?? '';
apps/api/src/modules\platform-admin\services\tenant-management.service.spec.ts:95:      shopId: SHOP_ID,
apps/api/src/modules\platform-admin\services\tenant-management.service.spec.ts:108:    await svc.updateShop({ shopId: SHOP_ID, platformUserId: ADMIN_UID, patch: {} });
apps/api/src/modules\catalog\catalog.service.spec.ts:38:      shopId:          'shop-1',
apps/api/src/modules\catalog\catalog.service.spec.ts:54:    expect(result.shopId).toBe('shop-1');
apps/api/src/modules\catalog\catalog.service.spec.ts:94:    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
apps/api/src/modules\catalog\catalog.service.spec.ts:111:    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
apps/api/src/modules\catalog\catalog.service.spec.ts:125:    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:34:  shopId:       string;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:47:    shopId:      r.shop_id,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:104:      shopId:     ctx.shopId,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:128:      await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.ts:177:      await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
apps/api/src/modules\auth\auth.controller.spec.ts:32:  shopId: SHOP_ID,
apps/api/src/modules\auth\auth.controller.spec.ts:55:      .mockResolvedValueOnce(undefined) // SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.controller.spec.ts:210:      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
apps/api/src/modules\auth\auth.controller.spec.ts:267:      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
apps/api/src/modules\auth\auth.controller.spec.ts:333:      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
apps/api/src/modules\pricing\pricing.service.ts:72:  return `rates:override:${ctx.shopId}:${purity}`;
apps/api/src/modules\pricing\pricing.service.ts:371:           (shop_id, purity, override_paise, reason, set_by_user_id, valid_until)
apps/api/src/modules\pricing\pricing.service.ts:373:        [ctx.shopId, dto.purity, paise, dto.reason, ctx.userId, validUntil],
apps/api/src/modules\pricing\pricing.service.ts:377:           (shop_id, actor_user_id, action, subject_type, subject_id, before, after)
apps/api/src/modules\pricing\pricing.service.ts:380:          ctx.shopId,
apps/api/src/modules\analytics\analytics.service.ts:8:  shopId: string;
apps/api/src/modules\analytics\analytics.service.ts:27:    if (!UUID_RE.test(params.shopId) || !UUID_RE.test(params.productId) || !UUID_RE.test(params.sessionId)) {
apps/api/src/modules\analytics\analytics.service.ts:34:    await this.withShopTx(params.shopId, async (tx) => {
apps/api/src/modules\analytics\analytics.service.ts:36:      // Prevents cross-tenant pollution where caller supplies their shop_id but a
apps/api/src/modules\analytics\analytics.service.ts:40:        `SELECT id FROM products WHERE id = $1 AND shop_id = $2 LIMIT 1`,
apps/api/src/modules\catalog\catalog.controller.ts:87:    @Headers('x-tenant-id') shopId: string,
apps/api/src/modules\catalog\catalog.controller.ts:94:    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
apps/api/src/modules\catalog\catalog.controller.ts:96:      shopId,
apps/api/src/modules\catalog\catalog.controller.ts:115:    @Headers('x-tenant-id') shopId: string,
apps/api/src/modules\catalog\catalog.controller.ts:117:    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
apps/api/src/modules\platform-admin\services\subscription.service.ts:9:  shopId: string;
apps/api/src/modules\platform-admin\services\subscription.service.ts:19:  shopId: string;
apps/api/src/modules\platform-admin\services\subscription.service.ts:62:        `INSERT INTO platform_subscriptions (shop_id, plan, status, mrr_paise, billing_cycle_start)
apps/api/src/modules\platform-admin\services\subscription.service.ts:64:         ON CONFLICT (shop_id) DO UPDATE
apps/api/src/modules\platform-admin\services\subscription.service.ts:71:        [a.shopId, a.plan, a.status ?? null, a.mrrPaise, a.billingCycleStart ?? null],
apps/api/src/modules\custom-orders\custom-orders.controller.ts:225:    const shopIdHint    = notes['shopId'] ?? '';
apps/api/src/modules\custom-orders\custom-orders.controller.ts:232:      await this.svc.handleRazorpayWebhook(customOrderId, razorpayPaymentId, shopIdHint);
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:17:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:42:      return { id, shopId: SHOP, sku: p.sku, metal: p.metal, purity: p.purity, status: p.status } as any;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:64:    shop_id:      SHOP,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:162:        id: BOOKING_ID, shop_id: SHOP, customer_id: CUSTOMER,
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:177:      shop_id:      SHOP,
apps/api/src/modules\analytics\analytics.service.spec.ts:31://   3. SET LOCAL shop_id
apps/api/src/modules\analytics\analytics.service.spec.ts:32://   4. ownership SELECT (products WHERE id=$1 AND shop_id=$2)
apps/api/src/modules\analytics\analytics.service.spec.ts:45:   .mockResolvedValueOnce(undefined)                                          // SET LOCAL shop_id
apps/api/src/modules\analytics\analytics.service.spec.ts:59:   .mockResolvedValueOnce(undefined)              // SET LOCAL shop_id
apps/api/src/modules\analytics\analytics.service.spec.ts:72:   .mockResolvedValueOnce(undefined)   // SET LOCAL shop_id
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:30:      shopId: 'shop-1',
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:37:    expect(client.query.mock.calls[1]![0]).toMatch(/ON CONFLICT \(shop_id\) DO UPDATE/);
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:51:          shop_id: 'shop-1',
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:72:      svc.upsertSubscription({ shopId: 's', plan: 'platinum' as never, mrrPaise: 0, platformUserId: 'p' }),
apps/api/src/modules\platform-admin\services\subscription.service.spec.ts:79:      svc.upsertSubscription({ shopId: 's', plan: 'growth', mrrPaise: -1, platformUserId: 'p' }),
apps/api/src/modules\pricing\pricing.service.spec.ts:109:  shopId: 'shop-uuid-1',
apps/api/src/modules\pricing\pricing.service.spec.ts:262:        `rates:override:${fakeOwnerCtx.shopId}:GOLD_18K`,
apps/api/src/modules\pricing\pricing.service.spec.ts:458:        if (key === `rates:override:${fakeOwnerCtx.shopId}:GOLD_22K`) {
apps/api/src/modules\analytics\analytics.controller.ts:27:    const shopId = ctx.shopId;
apps/api/src/modules\analytics\analytics.controller.ts:30:      this.svc.getProductViewSummary({ shopId, productId, days: 30 }),
apps/api/src/modules\analytics\analytics.controller.ts:31:      this.svc.getProductViewSummary({ shopId, productId, days: 90 }),
apps/api/src/modules\analytics\analytics.controller.ts:32:      this.svc.getProductViewSummary({ shopId, productId, days: 365 }),
apps/api/src/modules\auth\permissions.repository.ts:11:  async getPermissions(shopId: string, role: ShopUserRole): Promise<Record<string, boolean>> {
apps/api/src/modules\auth\permissions.repository.ts:15:      // Set GUC so RLS policy on role_permissions can filter on current_setting('app.current_shop_id').
apps/api/src/modules\auth\permissions.repository.ts:16:      await c.query(`SET app.current_shop_id = '${shopId}'`);
apps/api/src/modules\auth\permissions.repository.ts:18:        `SELECT permission_key, is_enabled FROM role_permissions WHERE shop_id = $1 AND role = $2`,
apps/api/src/modules\auth\permissions.repository.ts:19:        [shopId, role],
apps/api/src/modules\billing\billing-5.10-5.12.spec.ts:8:    requireCurrent: () => ({ shopId: 'shop-1', authenticated: true, userId: 'user-1' }),
apps/api/src/modules\billing\billing-5.10-5.12.spec.ts:139:  it('uploads to tenants/<shopId>/invoices/<id>.html', async () => {
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:6:  shop_id:      string;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:21:    shopId:     string;
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:27:      `INSERT INTO try_at_home_bookings (shop_id, customer_id, product_ids, notes)
apps/api/src/modules\try-at-home-bookings\try-at-home-bookings.repository.ts:30:      [params.shopId, params.customerId, params.productIds, params.notes ?? null],
apps/api/src/modules\auth\auth.service.spec.ts:37:  // auditLog Г+' withTenantTx: BEGIN, SET LOCAL ROLE, SET LOCAL current_shop_id, INSERT, COMMIT, POISON release
apps/api/src/modules\auth\auth.service.spec.ts:44:      .mockResolvedValueOnce(undefined)                                           // SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.service.spec.ts:113:    expect(call.shopId).toBe(SHOP_ID);
apps/api/src/modules\auth\auth.service.spec.ts:258:        .mockResolvedValueOnce(undefined)   // SET LOCAL current_shop_id
apps/api/src/modules\auth\auth.service.spec.ts:261:        .mockResolvedValueOnce(undefined),  // finally: SET app.current_shop_id poison
apps/api/src/modules\auth\permissions.repository.spec.ts:7:const ctx: UnauthenticatedTenantContext = { shopId: 'shop-1', tenant: fakeTenant, authenticated: false };
apps/api/src/modules\auth\permissions.repository.spec.ts:14:        .mockResolvedValueOnce(undefined)         // SET app.current_shop_id (GUC for RLS)
apps/api/src/modules\billing\billing.repository.ts:8:  shop_id:             string;
apps/api/src/modules\billing\billing.repository.ts:48:  shop_id:               string;
apps/api/src/modules\billing\billing.repository.ts:128:  id, shop_id, invoice_number, invoice_type,
apps/api/src/modules\billing\billing.repository.ts:142:  id, shop_id, invoice_id, product_id, description, hsn_code, huid,
apps/api/src/modules\billing\billing.repository.ts:154:   * UNIQUE(shop_id, idempotency_key) raises 23505 Г+' translated to
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:79:      shopId: SHOP_ID,
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:95:  it('export forwards shopId + platformUid', async () => {
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:102:      { shopId: SHOP_ID, plan: 'growth', mrrPaise: 100, status: 'active' },
apps/api/src/modules\platform-admin\platform-admin.controller.spec.ts:106:      shopId: SHOP_ID, plan: 'growth', mrrPaise: 100, platformUserId: PLATFORM_UID,
apps/api/src/modules\auth\auth.revoke.security.spec.ts:7: *    The repo query includes AND shop_id=$callerShopId so cross-tenant UUIDs are invisible.
apps/api/src/modules\auth\auth.revoke.security.spec.ts:23:    // repo.revokeStaff returns null because WHERE id=$1 AND shop_id=$2 finds 0 rows
apps/api/src/modules\platform-admin\impersonation-token.ts:13:  target_shop_id: string;
apps/api/src/modules\platform-admin\impersonation-token.ts:31:    { sub: a.platformUserId, target_shop_id: a.targetShopId, iss: ISSUER },
apps/api/src/modules\platform-admin\impersonation-token.ts:49:  if (!decoded.jti || !decoded.sub || !decoded['target_shop_id'] || !decoded.exp || !decoded.iat) {
apps/api/src/modules\platform-admin\impersonation-token.ts:55:    target_shop_id: decoded['target_shop_id'] as string,
apps/api/src/modules\crm\occasions.service.ts:9:  shop_id: string;
apps/api/src/modules\crm\occasions.service.ts:112:        `INSERT INTO customer_occasions (shop_id, customer_id, occasion_type, label, month_day, next_occurrence, reminder_days)
apps/api/src/modules\crm\occasions.service.ts:113:         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6)
apps/api/src/modules\auth\guards\policy.guard.ts:33:    let perms = await this.permissionsCache.getPermissions(tc.shopId, tc.role);
apps/api/src/modules\auth\guards\policy.guard.ts:35:      perms = await this.permissionsRepo.getPermissions(tc.shopId, tc.role);
apps/api/src/modules\auth\guards\policy.guard.ts:36:      await this.permissionsCache.setPermissions(tc.shopId, tc.role, perms);
apps/api/src/modules\settings\settings.try-at-home.spec.ts:53:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\settings\settings.try-at-home.spec.ts:105:  it('invalidates feature-flags cache with correct shopId', async () => {
apps/api/src/modules\settings\settings.try-at-home.spec.ts:154:  it('uses shopId from tenantContext Г?" not a hardcoded value', async () => {
apps/api/src/modules\settings\settings.try-at-home.spec.ts:157:      shopId: SHOP_A, userId: 'user-a', role: 'shop_admin', authenticated: true,
apps/api/src/modules\auth\auth.repository.ts:7:  shopId: string;
apps/api/src/modules\auth\auth.repository.ts:23:        shop_id: string; user_id: string; role: ShopUserRole;
apps/api/src/modules\auth\auth.repository.ts:28:      return { shopId: r.shop_id, userId: r.user_id, role: r.role, status: r.status, firebaseUid: r.firebase_uid };
apps/api/src/modules\auth\auth.repository.ts:31:      await c.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
apps/api/src/modules\auth\auth.repository.ts:46:  async linkFirebaseUid(args: { shopId: string; userId: string; firebaseUid: string; tenant: Tenant }): Promise<{ linked: boolean }> {
apps/api/src/modules\platform-admin\services\impersonation.service.ts:73:           (platform_user_id, target_shop_id, expires_at, reason, ip_address, user_agent)
apps/api/src/modules\platform-admin\services\impersonation.service.ts:80:        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, ip_address, user_agent, metadata)
apps/api/src/modules\platform-admin\services\impersonation.service.ts:105:      const upd = await c.query<{ target_shop_id: string }>(
apps/api/src/modules\platform-admin\services\impersonation.service.ts:109:          RETURNING target_shop_id`,
apps/api/src/modules\platform-admin\services\impersonation.service.ts:115:      // Include target_shop_id so tenant-scoped audit queries pair this `impersonation.ended`
apps/api/src/modules\platform-admin\impersonation-token.spec.ts:19:    expect(claims.target_shop_id).toBe('22222222-2222-2222-2222-222222222222');
apps/api/src/modules\platform-admin\impersonation-token.spec.ts:51:      { sub: 'p', target_shop_id: '22222222-2222-2222-2222-222222222222', iss: 'attacker' },
apps/api/src/modules\auth\guards\policy.guard.spec.ts:20:const shopId = 'shop-uuid-1';
apps/api/src/modules\auth\guards\policy.guard.spec.ts:27:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\guards\policy.guard.spec.ts:50:      authenticated: true, shopId, role: 'shop_admin', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\guards\policy.guard.spec.ts:63:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\guards\policy.guard.spec.ts:80:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps/api/src/modules\auth\auth.controller.ts:105:    return this.svc.invite(auth.shopId, dto, auth.userId);
apps/api/src/modules\auth\auth.controller.ts:118:    return this.authRepo.listUsers(auth.shopId);
apps/api/src/modules\auth\auth.controller.ts:128:    return this.permissionsRepo.getPermissions(auth.shopId, role as import('@goldsmith/tenant-context').ShopUserRole);
apps/api/src/modules\auth\auth.controller.ts:142:    const shopId = auth.shopId;
apps/api/src/modules\auth\auth.controller.ts:143:    await this.permissionsRepo.upsertPermission(shopId, role as import('@goldsmith/tenant-context').ShopUserRole, dto.permission_key, dto.is_enabled);
apps/api/src/modules\auth\auth.service.ts:71:    const tenant = await this.loadTenantById(row.shopId);
apps/api/src/modules\auth\auth.service.ts:74:      const { linked } = await this.repo.linkFirebaseUid({ shopId: row.shopId, userId: row.userId, firebaseUid: args.uid, tenant });
apps/api/src/modules\auth\auth.service.ts:93:    //    after our initial read, we must not restore stale shop_id/role claims.
apps/api/src/modules\auth\auth.service.ts:94:    const statusCheck = await this.repo.getStatusById(row.shopId, row.userId);
apps/api/src/modules\auth\auth.service.ts:99:    // 7. Set Firebase custom claims so subsequent ID tokens carry shop_id + role + goldsmith_uid (DB UUID).
apps/api/src/modules\settings\settings.service.ts:53:    const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\settings.service.ts:54:    this.tenantLookup.invalidate(shopId);
apps/api/src/modules\settings\settings.service.ts:107:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\settings\settings.service.ts:111:      subjectId: shopId,
apps/api/src/modules\settings\settings.service.ts:191:      subjectId: tc.shopId,
apps/api/src/modules\auth\auth.repository.invite.spec.ts:7:const ctx = { shopId: 'shop-1', tenant: fakeTenant, authenticated: false } as const;
apps/api/src/modules\auth\auth.repository.invite.spec.ts:11:    // withTenantTx sequence: BEGIN Г+' SET LOCAL ROLE app_user Г+' SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.repository.invite.spec.ts:12:    //   Г+' conflict SELECT (1 row) Г+' COMMIT Г+' SET app.current_shop_id=POISON Г+' release
apps/api/src/modules\auth\auth.repository.invite.spec.ts:17:        .mockResolvedValueOnce(undefined)                                      // SET LOCAL app.current_shop_id
apps/api/src/modules\auth\auth.repository.invite.spec.ts:20:        .mockResolvedValueOnce(undefined),                                     // SET app.current_shop_id=POISON (finally)
apps/api/src/modules\crm\occasions.service.spec.ts:24:  return { authenticated: true as const, shopId: SHOP, userId: USER, role: 'shop_admin' };
apps/api/src/modules\crm\occasions.service.spec.ts:34:    shop_id: SHOP,
apps/api/src/modules\crm\occasions.service.spec.ts:267:    expect(sql).toMatch(/current_setting\('app\.current_shop_id'\)/);
apps/api/src/modules\billing\billing.controller.ts:154:      { userId: ctx.userId, role: ctx.role, shopId: ctx.shopId },
apps/api/src/modules\billing\billing.controller.ts:174:      { userId: ctx.userId, role: ctx.role, shopId: ctx.shopId },
apps/api/src/modules\billing\billing.controller.ts:221:    return this.estimates.listEstimates(ctx.shopId, limit, offset);
apps/api/src/modules\billing\billing.controller.ts:232:    return this.estimates.getEstimate(id, ctx.shopId);
apps/api/src/modules\auth\firebase-jwt.strategy.ts:17:  shop_id?: string;
apps/api/src/modules\auth\firebase-jwt.strategy.ts:67:      shop_id: decoded['shop_id'] as string | undefined,
apps/api/src/modules\auth\firebase-jwt.strategy.ts:124:      shop_id: impClaims.target_shop_id,
apps/api/src/modules\pricing\pricing.controller.spec.ts:37:  shopId: 'shop-1',
apps/api/src/modules\pricing\pricing.controller.spec.ts:43:  shopId: 'shop-1',
apps/api/src/modules\settings\settings.service.test.ts:15:  shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
apps/api/src/modules\billing\invoice-pdf.service.ts:186:    const key = `tenants/${ctx.shopId}/invoices/${invoiceId}.html`;
apps/api/src/modules\billing\invoice-pdf.service.ts:197:        [ctx.shopId],
apps/api/src/modules\crm\notes.service.ts:9:  shop_id: string;
apps/api/src/modules\crm\notes.service.ts:45:        `INSERT INTO customer_notes (shop_id, customer_id, body, author_user_id)
apps/api/src/modules\crm\notes.service.ts:46:         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3)
apps/api/src/modules\billing\void.service.ts:27:  shop_id:              string;
apps/api/src/modules\billing\void.service.ts:39:  shopId:               string;
apps/api/src/modules\billing\void.service.ts:52:    shopId:            cn.shop_id,
apps/api/src/modules\billing\void.service.ts:64:  id, shop_id, invoice_number, invoice_type,
apps/api/src/modules\billing\void.service.ts:81:    ctx: { userId: string; role: string; shopId: string },
apps/api/src/modules\billing\gstr-export.service.ts:193:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\billing\gstr-export.service.ts:205:         WHERE shop_id = $1
apps/api/src/modules\billing\gstr-export.service.ts:210:        [shopId, month],
apps/api/src/modules\billing\invoice-number.ts:9: * Readable, sortable, unique-per-tenant. UNIQUE(shop_id, invoice_number)
apps/api/src/modules\billing\invoice-number.ts:14:    throw new Error(`generateInvoiceNumber: invalid shopId "${shopUuid}"`);
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:46:    expect(decoded.target_shop_id).toBe(SHOP_ID);
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:87:  it('end: marks session ended_at and audits impersonation.ended with target_shop_id', async () => {
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:90:      .mockResolvedValueOnce({ rowCount: 1, rows: [{ target_shop_id: SHOP_ID }] }) // UPDATE RETURNING
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:100:    expect(updateCall[0]).toMatch(/RETURNING target_shop_id/);
apps/api/src/modules\platform-admin\services\impersonation.service.spec.ts:103:    // Audit row carries target_shop_id so tenant-scoped queries pair start Г+" end
apps/api/src/modules\billing\payment.service.spec.ts:17:  return { authenticated: true, shopId: SHOP, userId: USER, role };
apps/api/src/modules\billing\payment.service.spec.ts:305:    // Tenant A shopId = SHOP Г?" ctx is scoped to SHOP via RLS.
apps/api/src/modules\settings\settings.service.loyalty.test.ts:69:  shopId: SHOP_ID, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
apps/api/src/modules\billing\payment.service.ts:49:    (shop_id, customer_id, customer_phone, aggregate_date, aggregate_month, cash_total_paise, invoice_count)
apps/api/src/modules\billing\payment.service.ts:51:    current_setting('app.current_shop_id', true)::uuid,
apps/api/src/modules\billing\payment.service.ts:68:  WHERE shop_id         = current_setting('app.current_shop_id', true)::uuid
apps/api/src/modules\billing\payment.service.ts:84:  shopId:          string;
apps/api/src/modules\billing\payment.service.ts:100:  shopId: string;
apps/api/src/modules\crm\notes.service.spec.ts:25:  return { authenticated: true as const, shopId: SHOP, userId, role: 'shop_admin' };
apps/api/src/modules\crm\notes.service.spec.ts:35:    shop_id: SHOP,
apps/api/src/modules\crm\notes.service.spec.ts:79:    expect(sql).toContain("current_setting('app.current_shop_id')");
apps/api/src/modules\crm\notes.service.spec.ts:218:    // SQL must reference current_setting (not a hardcoded shop_id binding)
apps/api/src/modules\crm\notes.service.spec.ts:220:    expect(sql).toMatch(/current_setting\('app\.current_shop_id'\)/);
apps/api/src/modules\platform-admin\dto\index.ts:22:  shopId: z.string().uuid(),
apps/api/src/modules\billing\estimate.service.ts:40:  shopId:                 string;
apps/api/src/modules\billing\estimate.service.ts:56:  shop_id:                  string;
apps/api/src/modules\billing\estimate.service.ts:73:    shopId:               row.shop_id,
apps/api/src/modules\billing\estimate.service.ts:102:           (shop_id, customer_id, line_items, gold_rate_paise_per_gram,
apps/api/src/modules\billing\estimate.service.ts:104:         VALUES (current_setting('app.current_shop_id')::uuid,
apps/api/src/modules\billing\billing.service.ts:96:    shopId:            invoice.shop_id,
apps/api/src/modules\billing\billing.service.ts:237:      const cached = await this.redis.get(idemKey(ctx.shopId, idempotencyKey));
apps/api/src/modules\billing\billing.service.ts:243:          this.redis.del(idemKey(ctx.shopId, idempotencyKey)).catch(() => undefined);
apps/api/src/modules\billing\billing.service.ts:256:      this.cacheResponse(ctx.shopId, idempotencyKey, resp); // re-warm Redis
apps/api/src/modules\billing\billing.service.ts:342:    // shop_id filter on the platform pool, in addition to RLS on the tenant pool).
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:12:  authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin',
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:63:const CTX = { authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin' };
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:120:      if (sql.includes('SELECT id, invoice_id, shop_id')) return Promise.resolve({ rows: [{ id: 'pay_001', invoice_id: 'inv_001', shop_id: 'shop_001' }] });
apps/api/src/modules\billing\payment.service.razorpay.spec.ts:156:      if (sql.includes('SELECT id, invoice_id, shop_id')) return Promise.resolve({ rows: [{ id: 'pay_001', invoice_id: 'inv_001', shop_id: 'shop_001' }] });
apps/api/src/modules\settings\blob-storage.service.ts:35:    const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\blob-storage.service.ts:36:    const blobPath = `tenants/${shopId}/logo/${randomUUID()}.webp`;
apps/api/src/modules\billing\story-5.6-pmla-block-ctr.spec.ts:111:  it('getCtrReport SQL is scoped by RLS (no explicit shop_id WHERE needed)', () => {
apps/api/src/modules\billing\story-5.6-pmla-block-ctr.spec.ts:112:    // pmla_aggregates has RLS: USING (shop_id = current_setting('app.current_shop_id')::uuid)
apps/api/src/modules\platform-admin\services\data-export.service.ts:39:  async exportTenant(shopId: string, platformUserId: string): Promise<TenantExport> {
apps/api/src/modules\platform-admin\services\data-export.service.ts:42:      // shop_id. Returning customer PII is the explicit purpose (DPDPA portability).
apps/api/src/modules\platform-admin\services\data-export.service.ts:53:        [shopId],
apps/api/src/modules\platform-admin\services\data-export.service.ts:58:        `SELECT id, shop_id, phone, name, email,
apps/api/src/modules\platform-admin\services\data-export.service.ts:63:           FROM customers WHERE shop_id = $1`,
apps/api/src/modules\settings\settings.repository.ts:28:      const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\settings.repository.ts:33:        [shopId],
apps/api/src/modules\settings\settings.repository.ts:42:      const shopId = tenantContext.requireCurrent().shopId;
apps/api/src/modules\settings\settings.repository.ts:49:        params.push(shopId);
apps/api/src/modules\settings\settings.repository.ts:64:        `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
apps/api/src/modules\billing\void.service.spec.ts:21:    shop_id: SHOP,
apps/api/src/modules\billing\void.service.spec.ts:76:      svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
apps/api/src/modules\billing\void.service.spec.ts:83:      svc.voidInvoice({ userId: MGR, role: 'shop_staff', shopId: SHOP }, 'inv-1', { reason: 'test' }),
apps/api/src/modules\billing\void.service.spec.ts:90:      await svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' });
apps/api/src/modules\billing\void.service.spec.ts:100:      svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
apps/api/src/modules\crm\crm.repository.ts:6:  id: string; shop_id: string; phone: string; name: string; email: string | null;
apps/api/src/modules\crm\crm.repository.ts:35:        `INSERT INTO customers (shop_id, phone, name, email, address_line1, address_line2, city, state, pincode, dob_year, pan_ciphertext, pan_key_id, notes, viewing_consent, created_by_user_id)
apps/api/src/modules\crm\crm.repository.ts:36:         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
apps/api/src/modules\crm\crm.repository.ts:51:      const dataQ = await tx.query<CustomerRow>(`SELECT * FROM customers WHERE shop_id = current_setting('app.current_shop_id')::uuid AND deleted_at IS NULL ${dataFilter} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, dataParams);
apps/api/src/modules\crm\crm.repository.ts:52:      const countQ = await tx.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM customers WHERE shop_id = current_setting('app.current_shop_id')::uuid AND deleted_at IS NULL ${countFilter}`, countParams);
apps/api/src/modules\billing\urd.service.ts:23:  shop_id:               string;
apps/api/src/modules\billing\urd.service.ts:42:  id: string; shopId: string; customerId: string | null; customerName: string;
apps/api/src/modules\billing\urd.service.ts:51:    id: r.id, shopId: r.shop_id, customerId: r.customer_id, customerName: r.customer_name,
apps/api/src/modules\billing\urd.service.ts:61:const URD_COLS = `id, shop_id, customer_id, customer_name, customer_phone, metal_type, purity, weight_g,
apps/api/src/modules\billing\urd.service.ts:70:    ctx: { userId: string; shopId: string },
apps/api/src/modules\billing\estimate.service.spec.ts:13:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\estimate.service.spec.ts:14:    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\estimate.service.spec.ts:34:    shop_id:                  SHOP,
apps/api/src/modules\billing\estimate.service.spec.ts:77:      expect(result.shopId).toBe(SHOP);
apps/api/src/modules\billing\estimate.service.spec.ts:97:    it('returns estimate for matching shopId', async () => {
apps/api/src/modules\crm\history.service.spec.ts:13:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\history.service.spec.ts:18:    id: CUSTOMER_ID, shop_id: SHOP, phone: '+919876543210', name: 'Test Customer',
apps/api/src/modules\settings\blob-storage.service.test.ts:8:const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_ID, tenant: tenantA, authenticated: false };
apps/api/src/modules\billing\billing.service.spec.ts:14:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.spec.ts:60:      shop_id: SHOP,
apps/api/src/modules\billing\billing.service.spec.ts:87:        id: 'inv-1', shop_id: SHOP,
apps/api/src/modules\billing\billing.service.spec.ts:122:        id: `item-${i}`, shop_id: SHOP, invoice_id: 'inv-1',
apps/api/src/modules\billing\billing.service.spec.ts:174:      shopId: SHOP,
apps/api/src/modules\crm\crm-search.service.ts:25:      return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\crm\crm-search.service.ts:28:      const result = await this.searchPort.searchCustomers(ctx.shopId, query);
apps/api/src/modules\crm\crm-search.service.ts:30:        `search: source=meilisearch shopId=${ctx.shopId} q="${query.q}" hits=${result.hits.length}`,
apps/api/src/modules\crm\crm-search.service.ts:37:        return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\crm\crm-search.service.ts:43:        return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\crm\consent.service.spec.ts:12:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\consent.service.spec.ts:22:    shop_id: SHOP,
apps/api/src/modules\settings\settings.repository.test.ts:10:const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
apps/api/src/modules\settings\settings.repository.test.ts:284:              sql.includes('SET LOCAL') || sql.includes('SET app.') || sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\settings\settings.repository.test.ts:310:              sql.includes('SET LOCAL') || sql.includes('SET app.') || sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\settings\settings.repository.test.ts:386:              sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\settings\settings.repository.test.ts:409:              sql.includes('ON CONFLICT (shop_id) DO NOTHING')) return;
apps/api/src/modules\platform-admin\services\data-export.service.spec.ts:22:  it('exports a single tenant scope with shop_id filter on every query', async () => {
apps/api/src/modules\platform-admin\services\data-export.service.spec.ts:41:    // Every data query filtered by shop_id (indexes shifted by 1 for BEGIN only)
apps/api/src/modules\crm\crm-search.service.test.ts:11:function makeAuthCtx(shopId = SHOP_A): TenantContext {
apps/api/src/modules\crm\crm-search.service.test.ts:13:    shopId,
apps/api/src/modules\crm\crm-search.service.test.ts:88:  it('calls adapter with correct shopId (tenant isolation)', async () => {
apps/api/src/modules\crm\crm-search.service.test.ts:126:      shopId: SHOP_A,
apps/api/src/modules\crm\crm-search.service.test.ts:138:  it('Postgres fallback: first WHERE param is shopId (tenant isolation)', async () => {
apps/api/src/modules\loyalty\loyalty.service.ts:63:  // Reads only ctx.shopId Г?" works with both authenticated (HTTP) and worker-built
apps/api/src/modules\loyalty\loyalty.service.ts:73:      const aggregate = await this.repo.lockOrCreateAggregate(tx, ctx.shopId, params.customerId);
apps/api/src/modules\loyalty\loyalty.service.ts:83:      await this.repo.insertTransaction(tx, ctx.shopId, {
apps/api/src/modules\loyalty\loyalty.service.ts:94:      await this.repo.updateAggregate(tx, ctx.shopId, {
apps/api/src/modules\loyalty\loyalty.service.ts:118:    const exists = await this.repo.customerExists(ctx.shopId, customerId);
apps/api/src/modules\billing\compliance-reports.service.ts:59:         WHERE id = current_setting('app.current_shop_id', true)::uuid`,
apps/api/src/modules\billing\compliance-reports.service.ts:189:         WHERE id = current_setting('app.current_shop_id', true)::uuid`,
apps/api/src/modules\billing\compliance-reports.service.ts:199:           AND shop_id = current_setting('app.current_shop_id', true)::uuid`,
apps/api/src/modules\billing\compliance-reports.service.ts:214:        shopId:                    shop.id,
apps/api/src/modules\crm\consent.repository.ts:7:  shop_id: string;
apps/api/src/modules\crm\consent.repository.ts:40:           AND shop_id = current_setting('app.current_shop_id')::uuid`,
apps/api/src/modules\crm\consent.repository.ts:52:      const shop = `current_setting('app.current_shop_id')::uuid`;
apps/api/src/modules\crm\consent.repository.ts:56:         WHERE customer_id = $1 AND shop_id = ${shop}
apps/api/src/modules\crm\consent.repository.ts:65:      // Insert-or-update on (shop_id, customer_id) Г?" preserves consent_version.
apps/api/src/modules\crm\family.service.ts:46:      this.repo.customerBelongsToShop(ctx.shopId, dto.customerId),
apps/api/src/modules\crm\family.service.ts:47:      this.repo.customerBelongsToShop(ctx.shopId, dto.relatedCustomerId),
apps/api/src/modules\crm\family.service.ts:81:    const ok = await this.repo.customerBelongsToShop(ctx.shopId, customerId);
apps/api/src/modules\crm\family.service.ts:98:    const ok = await this.repo.customerBelongsToShop(ctx.shopId, customerId);
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:13:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:65:  it('enqueues a delayed BullMQ job with shopId/customerId/hardDeleteAt', async () => {
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:73:      shopId: SHOP,
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:138:    return { authenticated: false as const, shopId: SHOP, tenant: { id: SHOP, slug: 'x', display_name: 'x', status: 'ACTIVE' } };
apps/api/src/modules\crm\dpdpa-deletion.service.spec.ts:168:        { customerId: CUSTOMER, shopId: SHOP },
apps/api/src/modules\reviews\reviews.service.ts:37:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\reviews\reviews.service.ts:41:      `SELECT id FROM products WHERE id = $1 AND shop_id = $2`,
apps/api/src/modules\reviews\reviews.service.ts:42:      [dto.productId, shopId],
apps/api/src/modules\reviews\reviews.service.ts:47:      shopId,
apps/api/src/modules\reviews\reviews.service.ts:66:    const { shopId } = tenantContext.requireCurrent();
apps/api/src/modules\settings\settings.policies-notif.spec.ts:57:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\crm\crm.service.ts:48:      const keyArn = await this.getShopKekArn(ctx.shopId);
apps/api/src/modules\crm\crm.service.ts:68:    void this.searchSvc.indexCustomer(ctx.shopId, {
apps/api/src/modules\crm\crm.service.ts:72:    trackEvent(ctx.shopId, 'customer.created');
apps/api/src/modules\crm\crm.service.ts:94:      const keyArn = await this.getShopKekArn(ctx.shopId);
apps/api/src/modules\crm\crm.service.ts:108:    void this.searchSvc.indexCustomer(ctx.shopId, {
apps/api/src/modules\crm\dpdpa-deletion.service.ts:18:  shopId:       string;
apps/api/src/modules\crm\dpdpa-deletion.service.ts:50:    void this.searchSvc.removeFromIndex(ctx.shopId, customerId).catch(() => undefined);
apps/api/src/modules\crm\dpdpa-deletion.service.ts:71:      { shopId: ctx.shopId, customerId, hardDeleteAt: hardDeleteAt.toISOString() },
apps/api/src/modules\crm\dpdpa-deletion.service.ts:74:        jobId: `hard-delete:${ctx.shopId}:${customerId}`,
apps/api/src/modules\crm\dpdpa-deletion.service.ts:96:        `SELECT id, name FROM customers WHERE id = $1 AND shop_id = current_setting('app.current_shop_id')::uuid`,
apps/api/src/modules\crm\family.service.spec.ts:14:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\crm\family.service.spec.ts:24:    shop_id: SHOP,
apps/api/src/modules\crm\family.service.spec.ts:121:    const repo = fakeRepo({ customerBelongsToShop: vi.fn(async (_shopId: string, customerId: string) => customerId !== CUSTOMER_B) });
apps/api/src/modules\loyalty\loyalty.service.spec.ts:16:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\loyalty\loyalty.service.spec.ts:40:    shop_id: SHOP,
apps/api/src/modules\loyalty\loyalty.service.spec.ts:53:    lockOrCreateAggregate: vi.fn(async (_tx, _shopId, _customerId) => fakeAggregate()),
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:12:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:13:    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:90:            id: INV_ID, shop_id: SHOP, invoice_number: 'INV-001',
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:108:            id: `item-${i}`, shop_id: SHOP, invoice_id: INV_ID,
apps/api/src/modules\billing\billing.service.rate-lock.spec.ts:139:        id, shop_id: SHOP, metal: 'GOLD', purity: 'GOLD_22K',
apps/api/src/modules\crm\family.repository.ts:7:  shop_id: string;
apps/api/src/modules\crm\family.repository.ts:39:      const shop = `current_setting('app.current_shop_id')::uuid`;
apps/api/src/modules\crm\family.repository.ts:41:        `INSERT INTO family_members (shop_id, customer_id, related_customer_id, relationship, created_by_user_id)
apps/api/src/modules\crm\family.repository.ts:46:        `INSERT INTO family_members (shop_id, customer_id, related_customer_id, relationship, created_by_user_id)
apps/api/src/modules\crm\family.repository.ts:58:         WHERE shop_id = current_setting('app.current_shop_id')::uuid
apps/api/src/modules\reviews\reviews.service.spec.ts:29:  vi.mocked(tenantContext.requireCurrent).mockReturnValue({ shopId: SHOP_ID } as never);
apps/api/src/modules\reviews\reviews.service.spec.ts:50:        id: 'rev-1', shop_id: SHOP_ID, product_id: PRODUCT_ID,
apps/api/src/modules\reviews\reviews.service.spec.ts:64:        shopId:     SHOP_ID,
apps/api/src/modules\reviews\reviews.service.spec.ts:88:        { id: 'r1', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: CUSTOMER_ID,
apps/api/src/modules\reviews\reviews.service.spec.ts:91:        { id: 'r2', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: 'other',
apps/api/src/modules\crm\balance.service.ts:8:  shopId:     string;
apps/api/src/modules\crm\balance.service.ts:24:  shop_id:           string;
apps/api/src/modules\crm\balance.service.ts:39:    await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
apps/api/src/modules\crm\balance.service.ts:69:        `SELECT id, shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at
apps/api/src/modules\crm\balance.service.ts:127:           (shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at)
apps/api/src/modules\platform-admin\platform-admin.controller.ts:93:      shopId: id,
apps/api/src/modules\crm\crm.service.spec.ts:12:  tenantContext: { requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }) },
apps/api/src/modules\crm\crm.service.spec.ts:22:  return { id: CUSTOMER_ID, shop_id: SHOP, phone: '+919876543210', name: 'Test Customer', email: null, address_line1: null, address_line2: null, city: null, state: null, pincode: null, dob_year: null, pan_ciphertext: null, pan_key_id: null, notes: null, viewing_consent: false, created_by_user_id: USER, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'), ...overrides };
apps/api/src/modules\crm\crm.service.spec.ts:37:function authCtx(role = 'shop_admin') { return { authenticated: true as const, shopId: SHOP, userId: USER, role } as any; }
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:12:  shopId:     string;
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:15:const TENANT_SQL = `current_setting('app.current_shop_id')::uuid`;
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:42:   *   3. Scrubs PII columns + replaces the phone with a SHA-256(shop_id || ':' || phone)
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:57:         WHERE id = $1 AND shop_id = ${TENANT_SQL}
apps/api/src/modules\crm\dpdpa-deletion.repository.ts:74:           AND shop_id = ${TENANT_SQL}
apps/api/src/modules\reviews\reviews.repository.ts:6:  shop_id:      string;
apps/api/src/modules\reviews\reviews.repository.ts:20:    shopId:      string;
apps/api/src/modules\reviews\reviews.repository.ts:27:      `INSERT INTO product_reviews (shop_id, product_id, customer_id, rating, review_text)
apps/api/src/modules\reviews\reviews.repository.ts:29:       ON CONFLICT (shop_id, customer_id, product_id)
apps/api/src/modules\reviews\reviews.repository.ts:33:      [params.shopId, params.productId, params.customerId, params.rating, params.reviewText ?? null],
apps/api/src/modules\crm\balance.service.spec.ts:14:    shopId: SHOP,
apps/api/src/modules\crm\balance.service.spec.ts:68:    // params: [shopId, customerId, outstanding, advance]
apps/api/src/modules\crm\balance.service.spec.ts:139:    await svc.handleInvoiceEvent({ shopId: SHOP, customerId: CUSTOMER_ID, invoiceId: 'inv-1' });
apps/api/src/modules\crm\balance.service.spec.ts:143:      expect.objectContaining({ shopId: SHOP }),
apps/api/src/modules\crm\balance.service.spec.ts:153:    await svc.handleInvoiceEvent({ shopId: SHOP, customerId: null, invoiceId: 'inv-1' });
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:11:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:12:    current: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:52:          shop_id: SHOP,
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:78:          id: `item-${i}`, shop_id: SHOP, invoice_id: INVOICE_ID,
apps/api/src/modules\billing\billing.service.loyalty.spec.ts:113:      id, shop_id: SHOP, metal: 'GOLD', purity: 'GOLD_22K',
apps/api/src/modules\loyalty\loyalty.repository.ts:7:  shop_id: string;
apps/api/src/modules\loyalty\loyalty.repository.ts:18:  shop_id: string;
apps/api/src/modules\loyalty\loyalty.repository.ts:62:    shopId: string,
apps/api/src/modules\loyalty\loyalty.repository.ts:66:    // Using the unique (shop_id, customer_id) constraint added in 0037.
apps/api/src/modules\loyalty\loyalty.repository.ts:68:      `INSERT INTO customer_loyalty (shop_id, customer_id, points_balance, lifetime_points)
apps/api/src/modules\inventory\barcode.integration.test.ts:12:const makeProduct = (id: string, shopId: string, sku: string) => ({
apps/api/src/modules\inventory\barcode.integration.test.ts:14:  shop_id: shopId,
apps/api/src/modules\inventory\barcode.integration.test.ts:48:    shopId: SHOP_A, userId: 'user-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\barcode.service.ts:19:    barcodeValue: buildBarcodeValue(row.shop_id, row.id),
apps/api/src/modules\inventory\barcode.service.ts:36:    if (!row || row.shop_id !== ctx.shopId) {
apps/api/src/modules\inventory\barcode.service.ts:55:      if (!row || row.shop_id !== ctx.shopId) {
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:14:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:15:    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:35:    shopId:               SHOP,
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:72:    shop_id:              SHOP,
apps/api/src/modules\billing\billing.service.convert-estimate.spec.ts:206:      id: 'cached-inv', shopId: SHOP, invoiceNumber: 'GS-CACHED',
apps/api/src/modules\loyalty\loyalty.controller.spec.ts:12:  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
apps/api/src/modules\loyalty\loyalty.event-listener.ts:11:  shopId:         string;
apps/api/src/modules\loyalty\loyalty.event-listener.ts:19:  shopId:         string;
apps/api/src/modules\loyalty\loyalty.event-listener.ts:54:        shopId:         event.shopId,
apps/api/src/modules\loyalty\loyalty.event-listener.ts:65:    trackEvent(event.shopId, 'loyalty.accrued', { points: event.goldValuePaise });
apps/api/src/modules\loyalty\loyalty.event-listener.ts:67:      `loyalty accrual enqueued: invoiceId=${event.invoiceId} customerId=${event.customerId} shopId=${event.shopId}`,
apps/api/src/modules\customer\customer-auth.guard.ts:17:  shopId:     string;
apps/api/src/modules\customer\customer-auth.guard.ts:36:    const shopId = req.headers['x-tenant-id'] as string | undefined;
apps/api/src/modules\customer\customer-auth.guard.ts:40:    if (!shopId) throw new UnauthorizedException({ code: 'customer.tenant_id_missing' });
apps/api/src/modules\customer\customer-auth.guard.ts:52:      req.customerCtx = { customerId: DEV_MOCK_CUSTOMER_ID, shopId };
apps/api/src/modules\customer\customer-auth.guard.ts:69:      `SELECT id FROM customers WHERE phone_e164 = $1 AND shop_id = $2 AND deleted_at IS NULL LIMIT 1`,
apps/api/src/modules\customer\customer.controller.ts:61:    const { customerId, shopId } = getCustomerCtx(req);
apps/api/src/modules\customer\customer.controller.ts:62:    const ctx = await this.buildSyntheticCtx(shopId, customerId);
apps/api/src/modules\customer\customer.controller.ts:78:    const { customerId, shopId } = getCustomerCtx(req);
apps/api/src/modules\customer\customer.controller.ts:83:    const ctx = await this.buildSyntheticCtx(shopId, customerId);
apps/api/src/modules\customer\customer.controller.ts:97:    const { customerId, shopId } = getCustomerCtx(req);
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:14:  shopId: SHOP_ID, tenant, authenticated: true,
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:84:        shopId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', // different tenant
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:93:    it('enqueues job when meta found and shopId matches', async () => {
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:95:        shopId: SHOP_ID,
apps/api/src/modules\inventory\inventory.bulk-import.service.test.ts:107:      const meta = JSON.stringify({ shopId: SHOP_ID, storageKey: 'upload/test.csv', idempotencyKey: 'idem-1' });
apps/api/src/modules\customer\customer.controller.spec.ts:38:    customerCtx: { customerId: DEV_CUSTOMER_ID, shopId: SHOP_ID },
apps/api/src/modules\customer\customer.controller.spec.ts:113:        id: 'tah1', shopId: SHOP_ID, customerId: DEV_CUSTOMER_ID,
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:14:  shopId: SHOP_ID, tenant, authenticated: true,
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:104:          expect.objectContaining({ sku: 'RING-001', metal: 'GOLD', shopId: SHOP_ID }),
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:201:    it('tags every createMany row with context shopId', async () => {
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:208:      const [rows] = (repoMock.createMany as ReturnType<typeof vi.fn>).mock.calls[0] as [Array<{ shopId: string }>];
apps/api/src/modules\inventory\inventory.bulk-import.processor.test.ts:209:      expect(rows.every((r) => r.shopId === SHOP_ID)).toBe(true);
apps/api/src/modules\inventory\inventory.bulk-import.processor.ts:138:        shopId: ctx.shopId,
apps/api/src/modules\inventory\inventory.bulk-import.processor.ts:169:      const errKey = `tenants/${ctx.shopId}/bulk-import/${data.jobId}/errors.csv`;
apps/api/src/modules\inventory\barcode.service.test.ts:12:  shop_id: SHOP_ID,
apps/api/src/modules\inventory\barcode.service.test.ts:42:    shopId: SHOP_ID, userId: 'user-1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\barcode.service.test.ts:65:      repoMock.getProduct.mockResolvedValue({ ...productRow, shop_id: OTHER_SHOP_ID });
apps/api/src/modules\inventory\barcode.service.test.ts:95:      const otherTenantRow = { ...productRow, shop_id: OTHER_SHOP_ID };
apps/api/src/modules\reports\reports.service.spec.ts:9:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: 'user-1' }),
apps/api/src/modules\reports\reports.service.spec.ts:10:    current: () => ({ shopId: SHOP }),
apps/api/src/modules\inventory\inventory.search.service.test.ts:12:    shopId: SHOP_ID,
apps/api/src/modules\inventory\inventory.search.service.test.ts:137:    it('Postgres fallback includes shop_id as first WHERE clause (tenant isolation)', async () => {
apps/api/src/modules\inventory\inventory.search.service.test.ts:149:      // First param must be shopId
apps/api/src/modules\inventory\inventory.search.service.test.ts:151:      // SQL must reference p.shop_id = $1
apps/api/src/modules\inventory\inventory.search.service.test.ts:152:      expect(sql).toContain('p.shop_id = $1');
apps/api/src/modules\inventory\inventory.repository.test.ts:9:const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
apps/api/src/modules\inventory\inventory.repository.test.ts:13:  shop_id: SHOP_A,
apps/api/src/modules\inventory\inventory.repository.test.ts:57:          shopId: SHOP_A,
apps/api/src/modules\inventory\inventory.repository.test.ts:65:      expect(result.shop_id).toBe(SHOP_A);
apps/api/src/modules\inventory\inventory.repository.test.ts:116:        shopId: SHOP_A,
apps/api/src/modules\inventory\inventory.service.test.ts:11:  shop_id: SHOP_ID,
apps/api/src/modules\inventory\inventory.service.test.ts:57:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.service.test.ts:60:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.service.test.ts:66:    it('calls repo.createProduct with shopId and createdByUserId from context', async () => {
apps/api/src/modules\inventory\inventory.service.test.ts:73:        expect.objectContaining({ shopId: SHOP_ID, createdByUserId: USER_ID }),
apps/api/src/modules\inventory\inventory.repository.ts:10:  shop_id: string;
apps/api/src/modules\inventory\inventory.repository.ts:32:  shopId: string;
apps/api/src/modules\inventory\inventory.repository.ts:53:  shop_id: string;
apps/api/src/modules\inventory\inventory.repository.ts:74:  id, shop_id, category_id, sku, metal, purity,
apps/api/src/modules\inventory\inventory.repository.ts:91:           (shop_id, category_id, sku, metal, purity,
apps/api/src/modules\inventory\inventory.search.service.ts:20:      return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\inventory\inventory.search.service.ts:23:      const result = await this.searchPort.search(ctx.shopId, query);
apps/api/src/modules\inventory\inventory.search.service.ts:25:        `search: source=meilisearch shopId=${ctx.shopId} q="${query.q}" hits=${result.hits.length}`,
apps/api/src/modules\inventory\inventory.search.service.ts:33:        return this.postgresSearch(ctx.shopId, query);
apps/api/src/modules\inventory\inventory.search.service.ts:39:  private async postgresSearch(shopId: string, query: SearchQuery): Promise<SearchResult> {
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:34:    const { shopId } = ctx;
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:44:         WHERE shop_id = $1`,
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:45:        [shopId],
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:68:         WHERE shop_id = $1
apps/api/src/modules\inventory\inventory.dead-stock.service.ts:72:        [shopId, threshold],
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:12:  shopId: SHOP_ID,
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:77:    // Verify the dead-stock query was called with the shop_id
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:147:  it('tenant isolation: dead-stock query uses shop_id = shopId from ctx', async () => {
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:153:    // First query (threshold): shop_id param
apps/api/src/modules\inventory\inventory.dead-stock.service.test.ts:155:    // Second query (dead stock): first param is shop_id
apps/api/src/modules\inventory\inventory.valuation.service.test.ts:9:  shopId: SHOP_ID, userId: 'u1', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.service.ts:20:    shopId: row.shop_id,
apps/api/src/modules\inventory\inventory.service.ts:61:      shopId: ctx.shopId,
apps/api/src/modules\inventory\inventory.service.ts:103:    id: string; shop_id: string; metal: string; purity: string;
apps/api/src/modules\inventory\inventory.service.ts:200:    trackEvent(ctx.shopId, 'product.published');
apps/api/src/modules\inventory\inventory.service.ts:231:    const key = `tenants/${ctx.shopId}/products/${productId}/${randomUUID()}.${ext}`;
apps/api/src/modules\inventory\stock-movement.repository.ts:10:  shop_id: string;
apps/api/src/modules\inventory\stock-movement.repository.ts:17:  shop_id: string;
apps/api/src/modules\inventory\stock-movement.repository.ts:43:  id, shop_id, product_id, type, reason, quantity_delta,
apps/api/src/modules\inventory\stock-movement.repository.ts:69:        `SELECT id, shop_id, quantity, status FROM products WHERE id = $1`,
apps/api/src/modules\inventory\stock-movement.repository.ts:93:        `SELECT id, shop_id, quantity, status FROM products WHERE id = $1 FOR UPDATE`,
apps/api/src/modules\inventory\stock-movement.service.spec.ts:13:  shopId: SHOP_ID,
apps/api/src/modules\inventory\stock-movement.service.spec.ts:22:      initial ? { id: PRODUCT_ID, shop_id: SHOP_ID, quantity: initial.quantity, status: initial.status } : null,
apps/api/src/modules\inventory\stock-movement.service.spec.ts:26:      shop_id: SHOP_ID,
apps/api/src/modules\inventory\stock-movement.service.ts:28:    shopId: row.shop_id,
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:15:  shopId: string;
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:32:    const storageKey = `tenants/${ctx.shopId}/bulk-import/${jobId}/input.csv`;
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:35:    const meta: BulkImportMeta = { shopId: ctx.shopId, storageKey, idempotencyKey };
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:50:    if (meta.shopId !== ctx.shopId) throw new NotFoundException({ code: 'inventory.bulk_import_job_not_found' });
apps/api/src/modules\inventory\inventory.bulk-import.service.ts:66:      after: { jobId, storageKey: meta.storageKey, shopId: ctx.shopId },
apps/api/src/modules\inventory\publish.integration.test.ts:12:  shop_id: SHOP_A,
apps/api/src/modules\inventory\publish.integration.test.ts:58:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\publish.integration.test.ts:61:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\publish.integration.test.ts:84:      shopId: SHOP_B, userId: 'user-b', role: 'shop_admin', authenticated: true,
apps/api/src/modules\inventory\inventory.valuation.service.ts:55:    const cacheKey = `valuation:${ctx.shopId}`;
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'dir packages' in C:\Alok\Business Projects\Goldsmith
 succeeded in 475ms:


    Directory: C:\Alok\Business Projects\Goldsmith\packages


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----         4/19/2026   1:47 PM                audit                                                                
d-----          5/1/2026   5:42 PM                auth-client                                                          
d-----         4/19/2026   1:43 PM                cache                                                                
d-----         4/26/2026  11:33 AM                compliance                                                           
d-----         4/19/2026   1:47 PM                crypto-envelope                                                      
d-----         4/26/2026  11:33 AM                db                                                                   
d-----         4/19/2026   1:46 PM                i18n                                                                 
d-----         4/26/2026   1:54 PM                integrations                                                         
d-----         4/26/2026  11:33 AM                money                                                                
d-----         4/29/2026   5:17 PM                observability                                                        
d-----         4/25/2026   1:15 AM                queue                                                                
d-----         4/26/2026  11:33 AM                secrets                                                              
d-----         4/19/2026   1:10 PM                shared                                                               
d-----         4/24/2026   9:51 PM                sync                                                                 
d-----         4/19/2026   1:29 PM                tenant-config                                                        
d-----         4/26/2026  11:33 AM                tenant-context                                                       
d-----         4/24/2026   2:52 PM                testing                                                              
d-----         4/25/2026   3:46 PM                ui-mobile                                                            
d-----         4/19/2026  12:14 PM                ui-tokens                                                            


Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "integrations-storage|StoragePort|imagekitUrl" -n' in C:\Alok\Business Projects\Goldsmith
2026-05-02T02:29:31.637776Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.4 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 exited 1 in 393ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:30:12.266137Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node -e \"const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server'); console.log(renderToStaticMarkup(React.createElement('link',{rel:'preload',as:'image',fetchpriority:'high',href:'a',imagesrcset:'b 320w',imagesizes:'100vw'})));\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node -e \"const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server'); console.log(renderToStaticMarkup(React.createElement('link',{rel:'preload',as:'image',fetchpriority:'high',href:'a',imagesrcset:'b 320w',imagesizes:'100vw'})));\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node -e \"const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server'); console.log(renderToStaticMarkup(React.createElement('link',{rel:'preload',as:'image',fetchpriority:'high',href:'a',imagesrcset:'b 320w',imagesizes:'100vw'})));\""` rejected: blocked by policy
2026-05-02T02:30:15.675738Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'node --version'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'node --version' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'node --version'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "type \"docs\\reviews\\codex-story-17.1-spec-round6-20260501.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 543ms:
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
90c410e (HEAD -> main) docs(story-17.1): codex round 5 D"?" server pre-computes all public URLs
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

    docs(story-17.1): codex round 5 D"?" server pre-computes all public URLs
    
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
+  alt_text: string | null;          // null D"+' caller renders auto-fallback "<product> D"?" DD,DD-?Dе+DD-?DA° <n>"
+  width: number;                    // post-rotation
+  height: number;
+  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
+                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
+  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
+  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
+};
+```
+
+`storage_key` is intentionally NOT in the public DTO D"?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+
+Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
 ---
 
 ## Storage adapter D"?" extension
 
 ### `@goldsmith/integrations-storage` additions
 
 **`storage.port.ts`** D"?" extend with one new method needed for bytes-flow:
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
 
 **`MalwareScanPort`** D"?" new file `malware-scan.port.ts`:
 ```typescript
 export interface MalwareScanPort {
   scan(buffer: Buffer, mimeType: string): Promise<{ clean: boolean; reason?: string }>;
 }
 export const MALWARE_SCAN_PORT = 'MALWARE_SCAN_PORT';
 ```
 
 ### `StubStorageAdapter` D"?" fill the dev/CI path
 
 Currently throws on real I/O. Implement against local disk:
 - `uploadBuffer`: writes to `${process.env.STUB_STORAGE_DIR ?? './tmp/storage'}/${key}`, creates parent dirs.
 - `downloadBuffer`: reads same path.
 - `deleteBlob`: best-effort `fs.unlink`.
 - `getPublicUrl`: returns `http://localhost:${PORT}/dev-storage/${key}` (a dev-only Express middleware on the API serves files from STUB_STORAGE_DIR D"?" bound to `127.0.0.1` only, never deployed).
 - `getPresignedUploadUrl` / `getPresignedReadUrl`: identical stub URLs (since STUB doesn't enforce TTL).
 
 ### `AzureBlobStorageAdapter` D"?" real implementation
 
 Constructor reads:
 - `AZURE_STORAGE_ACCOUNT` (e.g., `goldsmithprod`)
 - `AZURE_STORAGE_ACCOUNT_KEY` (Key Vault D"?" for SAS signing)
 - `AZURE_STORAGE_CONTAINER` (e.g., `product-images`)
 
 Methods:
 - `uploadBuffer(key, data, mime)`: `BlobServiceClient.getContainerClient(container).getBlockBlobClient(key).uploadData(data, { blobHTTPHeaders: { blobContentType: mime } })`.
 - `getPresignedUploadUrl(key, mime)`: builds SAS with `sr=b`, `sp=cw` (create+write), `se=now+1h`, `Content-Type` enforced.
 - `getPresignedReadUrl(key)`: builds SAS with `sp=r`, `se=now+1h`. **Used only for the dev-storage fallback path; production reads use `getPublicUrl`.**
 - `getPublicUrl(key)`: returns `https://ik.imagekit.io/${IMAGEKIT_ID}/${key}` D"?" ImageKit Web Folder is configured to fetch from `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/`. Originals stay private in Azure; only ImageKit's authorized fetcher reads them.
 - `deleteBlob(key)`: `blockBlobClient.delete()` with leniency for 404 (already deleted).
 - `downloadBuffer(key)`: `blockBlobClient.downloadToBuffer()` (used only by reconciliation jobs, not request path).
 
 ### `ImageKitTransformUrlBuilder`
 
 Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision A1). Width is caller-controlled (different surfaces need different widths D"?" `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
 
 ```typescript
 imagekitUrl(key: string, opts: {
   width: number;             // > 0; any positive integer the caller needs
   blur?: number;             // 1-100; emits `bl-${n}` for low-quality image placeholders
 }): string
 // D"+'  `https://ik.imagekit.io/${id}/${key}?tr=w-${width}[,bl-${blur}],q-auto,f-auto,mb-0.25`
 //
 // Contract:
 //   * Every returned URL MUST contain `q-auto`, `f-auto`, and `mb-0.25`.
 //   * `bl-` is only present when `blur` is supplied (used by the mobile
 //     blur-placeholder, never on the persisted `public_url` field).
 //   * No code path constructs ImageKit URLs by hand D"?" all callers go
 //     through this builder. A unit test asserts the three required
 //     substrings appear in every output, regardless of options.
 ```
 
 **Caller-side width vocabulary** (documented for implementer reference; not enforced by the type system because future surfaces may add their own widths):
 
 | Surface | Width | Blur | Use |
 |---|---|---|---|
 | Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | D"?" | Public PDP gallery |
 | Customer mobile placeholder | 200 | 30 | LQIP shown while full image loads |
 | Shopkeeper image manager card | 200 | D"?" | Internal thumbnail in the upload UI |
 | `public_url` on upload response | 1024 | D"?" | Single representative URL returned by API; client renders srcset itself |
 
 Adding a new surface that needs a new width is fine D"?" just call the builder with the new number. Bypassing the builder to compose URLs by hand is forbidden (would skip the byte cap).
 
 ### `StorageModule` D"?" wire selection
 
 `STORAGE_ADAPTER` env: `stub` (default) | `azure-imagekit`. The factory selects accordingly. `MALWARE_SCAN_PORT` is always the stub (no real adapter exists yet).
 
 ---
 
 ## Mobile D"?" shopkeeper image manager
 
 ### `apps/shopkeeper/app/inventory/[id]/images.tsx` (new screen)
 
 Reachable from product edit screen via "DD,DD-?Dе+DD-?DA°DD-ГжD, (n/10)" button.
 
 Layout:
 - Header: "D%DDD-?DDD_DГ-O DDD-? DD,DD-?Dе+DD-?DA°DD-ГжD," + "+ DoDD-<DDлDDмDD-ГжD," button (top-right).
 - `DraggableFlatList` of image cards (`react-native-draggable-flatlist`).
 - Each card: thumbnail (200A-200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) AA· drag handle (right) AA· alt-text input (one line) AA· "D1DYD_D?D," button (red, D"%D- 48 dp).
 - Tap "+ DoDD-<DDлDDмDD-ГжD," D"+' `expo-image-picker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: false, quality: 0.95 })`.
 - Selected image D"+' POST as multipart/form-data with `Authorization: Bearer <firebase>`.
 - Upload progress: indeterminate spinner overlay; on success, append to list; on error, Hindi toast keyed by error code.
 
 **i18n** D"?" `packages/i18n/locales/hi-IN/inventory.json`:
 ```json
 "images_title": "D%DDD-?DDD_DГ-O DDD-? DD,DD-?Dе+DD-?DA°DD-ГжD,",
 "images_add": "DD,DD-?Dе+DD-?DA° DoDD-<DDлDDмDD-ГжD,",
 "images_count": "{{n}}/10",
 "images_alt_placeholder": "Dе+DD-^DDADD-?DDDD,D: DD,DD-?Dе+DD-?DA° DD_ Dе+DD,Dе+DA°DDк",
 "images_delete_confirm": "DDD-?D_D_ D+DD Dе+D_DD^ DГжD, DD,DD-?Dе+DD-?DA° DDD-< D1DYD_D"D_ DsD_D1DDD-Гж D1DD-^D,?",
 "images_delete_yes": "D1D_D?, D1DYD_D?D,",
 "images_delete_no": "DA°DГ-ODD-?DГ-O DDA°DD-ГжD,",
 "images_err_invalid_mime": "DDD-ГжDе+DA JPEG / PNG / WebP / HEIC DD,DD-?Dе+DD-?DA°DD-ГжD, D,DD-?Dе+DD-?DD_DA° DDD-? DoD_DDD-? D1DD-^D,",
 "images_err_too_large": "DГжD, DD,DD-?Dе+DD-?DA° DDD-? D-DD-?DDкDе+DDD-?DD_ DDзD1DD-?D DDзDDлDDмDD-? D1DD-^ D"?" DDD-D_DDD_D_ DDr DA°DD,DoDDмDD-%DADD-?D_DD-,DD" DDD-? DDD-<DDD,D DDA°DD-ГжD,",
 "images_err_invalid_dimensions": "DD,DD-?Dе+DD-?DA° DD_ D+DD_DA° 200A-200 D,DD-Гж 8000A-8000 DDD-Гж DDзDD-?Ds D1DD-<D"D_ DsD_D1DD,D?",
 "images_err_payload": "DD,DD-?Dе+DD-?DA° DD_ D+DD_DA° 5 MB D,DD-Гж D.DDD,D D1DD-^",
 "images_err_limit": "D?D D%DDD-?DDD_DГ-O DDD-? D.DDD,DDDr 10 DD,DD-?Dе+DD-?DA°DD-ГжD,",
 "images_err_generic": "DD,DD-?Dе+DD-?DA° D.DDDADD-<DDл D"D1DD-?D, D1DD-< D,DDD-?DD- DГ-ODD-<DDзD_DA°D_ DDD-<DDD,D DDA°DD-ГжD,DD-"
 ```
 
 ### `apps/customer-web/src/components/products/ProductGallery.tsx` (new)
 
 Props: `{ images: PublicImageRow[]; productName: string }`.
 
 Layout:
 - 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
 - D"% 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
 - Click hero D"+' opens lightbox (`<dialog>`, ESC closes).
 - D"+?D"+' arrow keys cycle on desktop. Visible focus ring on the hero on focus.
-- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
+- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
+- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap D"+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
-- Each frame uses `expo-image`: `placeholder` source = `imagekitUrl(storage_key, { width: 200, blur: 30 })` (LQIP); `source` = `imagekitUrl(storage_key, { width: 1024 })` (full). Both URLs carry the `mb-0.25` cap via the builder contract.
+- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
 
 ---
 
 ## Tests
 
 | Test | File | What it asserts |
 |------|------|-----------------|
 | Unit: MIME sniff | `product-images.service.spec.ts` | PHP-renamed-jpg D"+' throws `BadRequestException` with code `INVALID_MIME` + audit emitted |
 | Unit: SVG rejection | same | SVG buffer D"+' throws even though magic-bytes match |
 | Unit: oversized after compression | same | Synthetic high-detail source where the **1920 w** sharp probe at `quality:80, effort:6` exceeds 250 KB D"+' throws `BadRequestException` with code `IMAGE_TOO_LARGE_AFTER_COMPRESSION` + audit emitted; corresponding healthy-source case (probe D"% 250 KB) accepts |
 | Unit: dimension guard | same | 100A-100 D"+' throws; 9000A-9000 D"+' throws |
 | Unit: EXIF strip | same | A JPEG buffer with embedded EXIF (GPS + camera make) processed by `sharp(buf).rotate().toBuffer()` produces output with NO EXIF block (verified via `exifr.parse(out)` returning `null`); visual orientation is preserved (test source has orientation=6 / 90AA° rotation) |
 | Unit: dimensions after rotation | same | A 4000A-3000 source with EXIF orientation=6 (rotate 90AA° clockwise) D"+' after `sharp(buf).rotate().toBuffer()`, the cleaned buffer's metadata reports 3000A-4000; the row inserted into `product_images` has `width=3000, height=4000`, NOT the source 4000A-3000 |
 | Unit: upload happy path | same | Inserts row, calls storage `uploadBuffer` once with cleaned buffer + mime, audit `PRODUCT_IMAGE_UPLOADED` |
 | Unit: image cap | same | 11th upload D"+' throws `IMAGE_LIMIT_REACHED`; cap is enforced inside the tx after `FOR UPDATE` lock |
 | Concurrency: cap under race | `product-images.concurrency.spec.ts` | Two concurrent uploads on a product with 9 images D"+' exactly one inserts (count=10), the other throws `IMAGE_LIMIT_REACHED`; verified by spawning two awaiting `Promise.allSettled` calls against a real test DB with the lock pattern |
 | Security: cross-tenant product attach | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B `productId` D"+' 404 `NOT_FOUND` (NOT a 500 from FK violation, NOT a successful insert); blob best-effort deleted afterward; no row in `product_images` |
 | Unit: reorder | same | `setSortOrders` called with full ordered array; mismatch D"+' throws `ORDER_LIST_MISMATCH` |
 | Unit: delete | same | Repo delete + storage `deleteBlob` called + audit |
 | Integration: upload D"+' list | `product-images.integration.spec.ts` | POST then GET returns inserted row with public_url |
 | Integration: tenant isolation | `product-images.tenant-isolation.spec.ts` | Tenant-A token + tenant-B productId D"+' 404 |
 | Integration: RLS at SQL layer | `product-images.rls.spec.ts` | Direct SQL with shop_id=A cannot SELECT shop_id=B images |
 | Integration: stub storage round-trip | `stub-storage.integration.spec.ts` | uploadBuffer D"+' downloadBuffer returns same bytes |
 | Integration: Azure adapter mocks | `azure-blob.adapter.spec.ts` | `@azure/storage-blob` mocked; SAS URL contains `sp=cw`, `se=` D"% 1h ahead, `sr=b` |
 | Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` D"+' contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` D"+' contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 D"+' contains `mb-0.25` (universal byte-cap invariant) |
 | Performance: PDP gallery render | `product-gallery.perf.spec.ts` | First image load < 500 ms p95 against ImageKit cached path (with mocked CDN) |
 | Performance: upload latency | `upload.perf.spec.ts` | Median upload + probe + EXIF strip + DB write < 2 s for a 4 MB JPEG |
 | Security: payload size | `payload-size.security.spec.ts` | 6 MB body D"+' 413 before any sharp invocation |
 | Security: malicious MIME | covered above | PHP webshell with .jpg extension D"+' 400 |
 | a11y: gallery | `product-gallery.a11y.spec.ts` | axe-core on customer-web ProductGallery D"+' 0 violations; alt-text fallback verified |
 
 Coverage target: D"%D- 80 % on `product-images.service.ts` and adapters.
 
 ---
 
 ## Work streams
 
 | Stream | Responsibility |
 |--------|----------------|
 | **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE D"?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) AA· Drizzle schema update AA· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** AA· `MalwareScanPort` + stub AA· `StubStorageAdapter` real local-disk impl AA· `AzureBlobStorageAdapter` impl AA· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) AA· adapter unit tests AA· `deleteBlob` extension |
 | **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) AA· `ProductImagesRepository` AA· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) AA· audit-action enum extension AA· 5 MB body interceptor AA· service unit tests (TDD) |
 | **WS-C Security** | RLS test on `product_images` (cross-tenant SELECT denied) AA· tenant-isolation integration test AA· payload-size + malicious-MIME security tests AA· `/security-review` gate |
 | **WS-D Mobile (shopkeeper)** | `apps/shopkeeper/app/inventory/[id]/images.tsx` AA· `expo-image-picker` integration AA· `react-native-draggable-flatlist` reorder AA· upload progress UI AA· Hindi i18n AA· 48 dp touch targets |
 | **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) AA· `ResponsiveImage` atom in `packages/ui-web` AA· `apps/customer-mobile/src/components/products/ProductGallery.tsx` AA· public catalog `GET /catalog/products/:id/images` AA· empty-state fallback to `GoldTexturePlaceholder` |
 | **WS-F Gate** | `codex review --base main` AA· `/security-review` (Class A D"?" both run in parallel per CLAUDE.md ceremony) AA· `.codex-review-passed` AA· `.security-review-passed` AA· runtime smoke (shopkeeper Android upload + customer-web PDP render) |
 
 **Order:** WS-A blocks everything. WS-B blocks WS-C / WS-D / WS-E. WS-C / WS-D / WS-E are parallel after WS-B. WS-F runs last.
 
 ---
 
 ## Smoke test protocol
 
 Run on real device (Moto G + Chrome desktop) after CI green.
 
 1. Boot API in `STORAGE_ADAPTER=stub` mode against a seeded shop with one product (no images).
 2. Boot shopkeeper mobile (Metro fresh, `--clear`).
 3. Log in as shop_admin D"+' navigate to product D"+' "DD,DD-?Dе+DD-?DA°DD-ГжD, (0/10)".
 4. Upload a real 4 MP JPEG from gallery D"+' expect spinner D"+' success D"+' image card rendered.
 5. Upload PHP-renamed-as-jpg D"+' expect Hindi error toast "DDD-ГжDе+DA JPEG / PNG / WebP / HEIC DD,DD-?Dе+DD-?DA°DD-ГжD, D,DD-?Dе+DD-?DD_DA° DDD-? DoD_DDD-? D1DD-^D,".
 6. Upload a 6 MB image D"+' expect "DD,DD-?Dе+DD-?DA° DD_ D+DD_DA° 5 MB D,DD-Гж D.DDD,D D1DD-^" toast.
 7. Upload 10 images D"+' 11th attempt D"+' expect "D?D D%DDD-?DDD_DГ-O DDD-? D.DDD,DDDr 10 DD,DD-?Dе+DD-?DA°DD-ГжD," toast.
 8. Reorder via drag handle D"+' reload screen D"+' confirm new order persists.
 9. Edit alt-text on one image D"+' reload D"+' confirm persisted; clear it D"+' reload D"+' confirm fallback string renders.
 10. Delete an image D"+' confirm modal D"+' confirm row removed and gallery count decrements.
 11. Boot customer-web (`apps/customer-web` running against same DB).
 12. Open `/products/<id>` of the seeded product D"+' expect real image gallery (hero + thumbs) replacing `GoldTexturePlaceholder`.
 13. Click hero D"+' lightbox opens D"+' D"+?D"+' keys cycle D"+' ESC closes.
 14. DevTools Network: confirm hero image URL contains `tr=w-1024,q-auto,f-auto,mb-0.25` and the response Content-Length D"% 250 000 bytes (the `mb-0.25` parameter is what enforces this on ImageKit; verify the parameter is in the URL AND the response body honours it).
 15. Lighthouse audit on PDP D"+' SEO D"%D- 90, accessibility D"%D- 95.
 16. axe-core CLI on `/products/<id>` D"+' zero violations.
 
 Production smoke (post-SOW Azure provisioning): repeat steps 1D"?"14 with `STORAGE_ADAPTER=azure-imagekit` against a real Azure container + ImageKit Web Folder. Recorded as runbook checklist; not blocking for this story's merge.
 
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
388:`storage_key` is intentionally NOT in the public DTO D"?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
490:- Each card: thumbnail (200A-200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) AA· drag handle (right) AA· alt-text input (one line) AA· "D1DYD_D?D," button (red, D"%D- 48 dp).
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
- `apps/api/src/modules/inventory/inventory.service.ts` DЫ'?" delete `getImageUploadUrl(productId, contentType)` (line 225) and its fire-and-forget `repo.insertImageRecord` call.
- `apps/api/src/modules/inventory/inventory.controller.ts` DЫ'?" delete `getImageUploadUrl` handler (line 148).
- `apps/api/src/modules/inventory/inventory.repository.ts` DЫ'?" delete `insertImageRecord(shopId, productId, storageKey)` (line 351).
- `apps/api/src/modules/inventory/inventory.service.test.ts` DЫ'?" delete the `describe('getImageUploadUrl')` block (lines 103DЫ'?"130).

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
       Headers: Content-Length DЫ'% 5 MB
       Optional field: "alt_text" (string, DЫ'% 200 chars)
       Guards: FirebaseJwtGuard DЫ'+' TenantInterceptor DЫ'+' @Roles('shop_admin', 'shop_manager')
       Response 201: { id, storage_key, public_url, sort_order, alt_text, width, height, byte_size }
       Errors:
         400 INVALID_MIME       DЫ'?" magic-byte sniff failed
         400 IMAGE_TOO_LARGE_AFTER_COMPRESSION DЫ'?" sharp probe at 1920 w (q-80, effort-6) exceeded 250 KB
         400 INVALID_DIMENSIONS DЫ'?" width or height outside [200, 8000]
         409 IMAGE_LIMIT_REACHED DЫ'?" 10 already exist on this product
         413 PAYLOAD_TOO_LARGE  DЫ'?" body > 5 MB

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
+  alt_text: string | null;          // null D"+' caller renders auto-fallback "<product> D"?" DD,DD-?Dе+DD-?DA° <n>"
+  width: number;                    // post-rotation
+  height: number;
+  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
+                                    // every URL carries q-auto, f-auto, mb-0.25 via the builder
+  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
+  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
+};
+```
+
+`storage_key` is intentionally NOT in the public DTO D"?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
+
+Customer-web `ProductGallery` and customer-mobile `ProductGallery` both consume `PublicImageRow[]` directly. Existing tenant-domain resolver already lives in `apps/api/src/modules/catalog`; reuse without modification.
 
 ---
 
 ## Storage adapter D"?" extension
 
@@ -499,22 +516,22 @@ Props: `{ images: PublicImageRow[]; productName: string }`.
 Layout:
 - 1280 px desktop: hero (left, 60% width) + thumbnail strip (right, vertical, 4 visible).
 - D"% 768 px mobile-web: full-width swipe carousel (CSS scroll-snap; no extra dep) + dot indicators.
 - Click hero D"+' opens lightbox (`<dialog>`, ESC closes).
 - D"+?D"+' arrow keys cycle on desktop. Visible focus ring on the hero on focus.
-- Each `<img>` uses `<picture>` with `srcset="...320w, ...640w, ...1024w, ...1920w"` and `sizes` matching layout.
-- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high">` injected by `next/head` for LCP.
+- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
+- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
 - Empty state: when `images.length === 0`, render existing `GoldTexturePlaceholder`.
 
 ### `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
 
 Props: same.
 
 Layout:
 - Horizontal `FlatList` with `pagingEnabled` + `snapToInterval` (built-in RN; no extra dep) + dot indicators below.
 - Tap D"+' expand fullscreen via `Modal` (true zoom is 18.6, this story is just gallery).
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
90c410e (HEAD -> main) docs(story-17.1): codex round 5 D"?" server pre-computes all public URLs
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

    docs(story-17.1): codex round 5 D"?" server pre-computes all public URLs
    
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
+  alt_text: string | null;          // null D"+' caller renders auto-fallback "<product> D"?" DD,DD-?DDц+DD-?DAA° <n>"
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
+  alt_text: string | null;          // null D"+' caller renders auto-fallback "<product> D"?" DD,DD-?DD"?z+DD-?DADY3 <n>"
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
docs\reviews\codex-story-17.1-spec-20260501.md:4627:- [P1] Make migration safe for existing image rows D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
docs\reviews\codex-story-17.1-spec-20260501.md:4630:- [P1] Validate product ownership before storing bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
docs\reviews\codex-story-17.1-spec-20260501.md:4642:- [P2] Use a valid Sharp WebP quality option D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
docs\reviews\codex-story-17.1-spec-20260501.md:4645:- [P2] Use an existing shop role in the guard D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
docs\reviews\codex-story-17.1-spec-20260501.md:4653:- [P1] Make migration safe for existing image rows D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
docs\reviews\codex-story-17.1-spec-20260501.md:4656:- [P1] Validate product ownership before storing bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
docs\reviews\codex-story-17.1-spec-20260501.md:4668:- [P2] Use a valid Sharp WebP quality option D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
docs\reviews\codex-story-17.1-spec-20260501.md:4671:- [P2] Use an existing shop role in the guard D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4110:- [P1] Move product_images cleanup out of the SQL migration D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4113:- [P2] Validate the actual ImageKit bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4116:- [P2] Store dimensions after EXIF rotation D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4123:- [P1] Move product_images cleanup out of the SQL migration D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4126:- [P2] Validate the actual ImageKit bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round2-20260501.md:4129:- [P2] Store dimensions after EXIF rotation D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1564:- [P1] Move product_images cleanup out of the SQL migration DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1567:- [P2] Validate the actual ImageKit bytes DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1570:- [P2] Store dimensions after EXIF rotation DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1577:- [P1] Move product_images cleanup out of the SQL migration DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1580:- [P2] Validate the actual ImageKit bytes DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1583:- [P2] Store dimensions after EXIF rotation DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2163:- [P2] Include the byte cap in the URL builder contract D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2166:- [P2] Remove the stale DELETE cleanup path D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2169:- [P3] Align oversize docs and tests with the 1920w probe D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2177:- [P2] Include the byte cap in the URL builder contract D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2180:- [P2] Remove the stale DELETE cleanup path D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2183:- [P3] Align oversize docs and tests with the 1920w probe D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1006:  docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1013:  docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap - 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1020:  docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1027:  docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1034:  docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap - 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1041:  docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2418:- [P2] Allow documented thumbnail transform variants D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2426:- [P2] Allow documented thumbnail transform variants D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1736:- [P2] Don't build mobile URLs from an absent public field D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1744:- [P2] Don't build mobile URLs from an absent public field D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
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

- [P2] Don't build mobile URLs from an absent public field DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
  For the customer-mobile gallery, `Props: same` means it receives `PublicImageRow[]`, and the public catalog endpoint only exposes `public_url`, `alt_text`, and dimensions, not `storage_key`. In that scenario this new instruction to call `imagekitUrl(storage_key, ...)` cannot compile or run unless the public DTO is widened or the API returns the needed variant URLs, so implementers will be forced to bypass the builder or ship a broken gallery.
2026-05-02T02:20:34.381464Z ERROR codex_core::session: failed to record rollout items: thread 019de679-771f-70a1-b580-0671f2a707ff not found
2026-05-02T02:20:34.451925Z ERROR codex_core::session: failed to record rollout items: thread 019de679-76f0-7371-906a-fa111dce147b not found
The updated spec now directs the customer-mobile surface to use a field that its documented public API response does not provide. That would leave implementers without the inputs needed to construct the mandated ImageKit URLs.

Review comment:

- [P2] Don't build mobile URLs from an absent public field DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
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
11:**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest D"?" Azure Storage SSE per ADR-0015 supersession), NFR-S3 (tenant-scoped image isolation), NFR-C7 (data residency D"?" Azure Central / South India per ADR-0015), NFR-A4 (alt text), NFR-P9 (image p95 < 500 ms thumbnails), NFR-SE-2 (Lighthouse SEO D"%D- 90)
37:- Customer `<ResponsiveImage>` renders `srcset` of ImageKit URLs with `tr=w-{320|640|1024|1920},q-auto,f-auto,mb-0.25`.
289:    // customer-facing srcset and aspect-ratio CSS need.
333:10. return { ...row, public_url: imagekitUrl(row.storage_key, { width: 1024 }) }   // single representative URL; client renders srcset of all 4 widths
381:  srcset: string;                   // pre-built "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
383:  default_url: string;              // single URL for non-srcset rendering or noscript fallback (w-1024)
384:  placeholder_url: string;          // w-200, blur-30 LQIP for `<img loading=lazy>` decoration / mobile expo-image
446:Pure URL builder, no HTTP client, no auth credentials needed. **The `mb-0.25` byte-cap and `q-auto,f-auto` parameters are mandatory in every URL** because together they are the binding NFR-IMG-1 enforcement (per Design Decision A1). Width is caller-controlled (different surfaces need different widths D"?" `200` for shopkeeper card thumbs, `320/640/1024/1920` for the customer srcset, `200` + `blur` for mobile LQIP placeholders); the byte cap and quality/format flags are not negotiable.
468:| Customer `<ResponsiveImage>` srcset | 320 / 640 / 1024 / 1920 | D"?" | Public PDP gallery |
471:| `public_url` on upload response | 1024 | D"?" | Single representative URL returned by API; client renders srcset itself |
521:- Each `<img>` consumes `image.srcset` directly (server-pre-built; never composes URLs on the client) plus a `sizes` attribute matching layout, and `image.default_url` as the `src` fallback.
522:- `loading="lazy"` on all but the first image; first image has `<link rel=preload as=image fetchpriority="high" href={image.default_url}>` injected by `next/head` for LCP.
532:- Each frame uses `expo-image`: `placeholder={{ uri: image.placeholder_url }}` (server-pre-built LQIP) and `source={{ uri: image.default_url }}` (server-pre-built w-1024 full). Both URLs already carry `mb-0.25` per the server-side builder; the client never composes ImageKit URLs.
557:| Integration: ImageKit URL builder | `imagekit-url-builder.spec.ts` | (a) `imagekitUrl(key, {width:640})` D"+' contains `tr=w-640`, `q-auto`, `f-auto`, `mb-0.25` (NOT containing `bl-`); (b) `imagekitUrl(key, {width:200, blur:30})` D"+' contains `tr=w-200`, `bl-30`, `q-auto`, `f-auto`, `mb-0.25`; (c) every other srcset width (320/1024/1920) likewise; (d) shopkeeper-thumbnail width 200 D"+' contains `mb-0.25` (universal byte-cap invariant) |
576:| **WS-E Customer surfaces** | `apps/customer-web/src/components/products/ProductGallery.tsx` (hero + thumb strip + lightbox + srcset) AA· `ResponsiveImage` atom in `packages/ui-web` AA· `apps/customer-mobile/src/components/products/ProductGallery.tsx` AA· public catalog `GET /catalog/products/:id/images` AA· empty-state fallback to `GoldTexturePlaceholder` |
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
388:`storage_key` is intentionally NOT in the public DTO D"?" it's the shopkeeper-side internal identifier (returned only on the authenticated upload response). All public surfaces consume URLs that the server has already constructed via `imagekitUrl()`, preserving the "every customer-facing URL has `mb-0.25`" invariant.
490:- Each card: thumbnail (200A-200, generated via `imagekitUrl(storage_key, { width: 200 })` so the universal `mb-0.25` cap still applies) AA· drag handle (right) AA· alt-text input (one line) AA· "D1DYD_D?D," button (red, D"%D- 48 dp).
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
The spec update fixes the missing public mobile URLs, but it introduces contract gaps around authenticated shopkeeper image rendering, responsive preloading, and the renamed public URL field. These should be corrected before implementers rely on the design.

Full review comments:

- [P2] Keep storage_key available to authenticated image reads D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
  For authenticated shopkeeper flows, opening a product that already has images or reloading after a reorder still requires either `storage_key` or a prebuilt thumbnail URL, because the documented card renderer calls `imagekitUrl(storage_key, { width: 200 })`. If `storage_key` is literally returned only on the upload response, persisted images cannot render thumbnails after reload.

- [P2] Preload the responsive candidate, not the fallback URL D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
  On viewports/DPRs where `image.srcset` selects 320, 640, or 1920 instead of the w-1024 `default_url`, this preload fetches a URL the `<img>` may not use, causing a duplicate request or no useful LCP preload. The preload should include `imagesrcset`/`imagesizes` matching the image `sizes`, or otherwise target the same candidate the browser will select.

- [P3] Align public GET expectations with default_url D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
  Implementing this DTO means the public catalog GET no longer returns `public_url`, but the test matrix still says the uploadD"+'list integration expects `GET returns inserted row with public_url`. Please update that contract/test to expect `default_url` or explicitly document `public_url` as an alias.
2026-05-02T02:26:39.455755Z ERROR codex_core::session: failed to record rollout items: thread 019de67e-2e88-7c93-9f08-9cf8ec2865a1 not found
2026-05-02T02:26:39.508218Z ERROR codex_core::session: failed to record rollout items: thread 019de67e-2e60-7530-bb66-d80dedf6de5f not found
The spec update fixes the missing public mobile URLs, but it introduces contract gaps around authenticated shopkeeper image rendering, responsive preloading, and the renamed public URL field. These should be corrected before implementers rely on the design.

Full review comments:

- [P2] Keep storage_key available to authenticated image reads D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
  For authenticated shopkeeper flows, opening a product that already has images or reloading after a reorder still requires either `storage_key` or a prebuilt thumbnail URL, because the documented card renderer calls `imagekitUrl(storage_key, { width: 200 })`. If `storage_key` is literally returned only on the upload response, persisted images cannot render thumbnails after reload.

- [P2] Preload the responsive candidate, not the fallback URL D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
  On viewports/DPRs where `image.srcset` selects 320, 640, or 1920 instead of the w-1024 `default_url`, this preload fetches a URL the `<img>` may not use, causing a duplicate request or no useful LCP preload. The preload should include `imagesrcset`/`imagesizes` matching the image `sizes`, or otherwise target the same candidate the browser will select.

- [P3] Align public GET expectations with default_url D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
  Implementing this DTO means the public catalog GET no longer returns `public_url`, but the test matrix still says the uploadD"+'list integration expects `GET returns inserted row with public_url`. Please update that contract/test to expect `default_url` or explicitly document `public_url` as an alias.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "type \"docs\\reviews\\codex-story-17.1-spec-round7-20260501.md\"" in C:\Alok\Business Projects\Goldsmith
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:30:37.674549Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "powershell -NoProfile -Command \"Get-Content -Path 'docs\\reviews\\codex-story-17.1-spec-round7-20260501.md' -Tail 120\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "powershell -NoProfile -Command \"Get-Content -Path 'docs\\reviews\\codex-story-17.1-spec-round7-20260501.md' -Tail 120\"" in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "powershell -NoProfile -Command \"Get-Content -Path 'docs\\reviews\\codex-story-17.1-spec-round7-20260501.md' -Tail 120\""` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"overall_correctness\" /c:\"[P\" \"docs\\reviews\\codex-story-17.1-spec-round7-20260501.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 428ms:
3567:2026-05-02T02:24:42.976109Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
3569:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\"" in C:\Alok\Business Projects\Goldsmith
3571:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
3572:2026-05-02T02:24:46.389503Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
3574:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }' in C:\Alok\Business Projects\Goldsmith
3576:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
3578:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"[P\" /c:\"overall_correctness\" \"docs\\reviews\\codex-story-17.1-spec*.md\"" in C:\Alok\Business Projects\Goldsmith
3580:docs\reviews\codex-story-17.1-spec-20260501.md:4627:- [P1] Make migration safe for existing image rows Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
3581:docs\reviews\codex-story-17.1-spec-20260501.md:4630:- [P1] Validate product ownership before storing bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
3582:docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
3583:docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
3584:docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
3585:docs\reviews\codex-story-17.1-spec-20260501.md:4642:- [P2] Use a valid Sharp WebP quality option Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
3586:docs\reviews\codex-story-17.1-spec-20260501.md:4645:- [P2] Use an existing shop role in the guard Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
3587:docs\reviews\codex-story-17.1-spec-20260501.md:4653:- [P1] Make migration safe for existing image rows Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
3588:docs\reviews\codex-story-17.1-spec-20260501.md:4656:- [P1] Validate product ownership before storing bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
3589:docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
3590:docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
3591:docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
3592:docs\reviews\codex-story-17.1-spec-20260501.md:4668:- [P2] Use a valid Sharp WebP quality option Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
3593:docs\reviews\codex-story-17.1-spec-20260501.md:4671:- [P2] Use an existing shop role in the guard Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
3594:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4110:- [P1] Move product_images cleanup out of the SQL migration Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
3595:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4113:- [P2] Validate the actual ImageKit bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
3596:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4116:- [P2] Store dimensions after EXIF rotation Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
3597:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4123:- [P1] Move product_images cleanup out of the SQL migration Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
3598:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4126:- [P2] Validate the actual ImageKit bytes Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
3599:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4129:- [P2] Store dimensions after EXIF rotation Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
3600:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1564:- [P1] Move product_images cleanup out of the SQL migration Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
3601:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1567:- [P2] Validate the actual ImageKit bytes Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
3602:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1570:- [P2] Store dimensions after EXIF rotation Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
3603:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1577:- [P1] Move product_images cleanup out of the SQL migration Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
3604:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1580:- [P2] Validate the actual ImageKit bytes Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
3605:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1583:- [P2] Store dimensions after EXIF rotation Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
3606:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2163:- [P2] Include the byte cap in the URL builder contract Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
3607:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2166:- [P2] Remove the stale DELETE cleanup path Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
3608:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2169:- [P3] Align oversize docs and tests with the 1920w probe Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
3609:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2177:- [P2] Include the byte cap in the URL builder contract Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
3610:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2180:- [P2] Remove the stale DELETE cleanup path Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
3611:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2183:- [P3] Align oversize docs and tests with the 1920w probe Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
3612:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1006:  docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
3613:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1013:  docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap - 
3614:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1020:  docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
3615:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1027:  docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
3616:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1034:  docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap - 
3617:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1041:  docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
3618:docs\reviews\codex-story-17.1-spec-round4-20260501.md:2418:- [P2] Allow documented thumbnail transform variants Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
3619:docs\reviews\codex-story-17.1-spec-round4-20260501.md:2426:- [P2] Allow documented thumbnail transform variants Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
3620:docs\reviews\codex-story-17.1-spec-round5-20260501.md:1736:- [P2] Don't build mobile URLs from an absent public field Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
3621:docs\reviews\codex-story-17.1-spec-round5-20260501.md:1744:- [P2] Don't build mobile URLs from an absent public field Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
3622:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1297:2026-05-02T02:24:42.976109Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
3623:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1299:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\"" in C:\Alok\Business Projects\Goldsmith
3624:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1301:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
3625:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1302:2026-05-02T02:24:46.389503Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
3626:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1304:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }' in C:\Alok\Business Projects\Goldsmith
3627:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1306:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
3628:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1308:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"[P\" /c:\"overall_correctness\" \"docs\\reviews\\codex-story-17.1-spec*.md\"" in C:\Alok\Business Projects\Goldsmith
3710:- [P2] Don't build mobile URLs from an absent public field Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
3718:- [P2] Don't build mobile URLs from an absent public field Т'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
3776:- [P2] Keep storage_key available to authenticated image reads Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
3779:- [P2] Preload the responsive candidate, not the fallback URL Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
3782:- [P3] Align public GET expectations with default_url Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
3790:- [P2] Keep storage_key available to authenticated image reads Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
3793:- [P2] Preload the responsive candidate, not the fallback URL Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
3796:- [P3] Align public GET expectations with default_url Г?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
7375:2026-05-02T02:24:42.976109Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
7377:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\"" in C:\Alok\Business Projects\Goldsmith
7379:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
7380:2026-05-02T02:24:46.389503Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
7382:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }' in C:\Alok\Business Projects\Goldsmith
7384:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
7386:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"[P\" /c:\"overall_correctness\" \"docs\\reviews\\codex-story-17.1-spec*.md\"" in C:\Alok\Business Projects\Goldsmith
7388:docs\reviews\codex-story-17.1-spec-20260501.md:4627:- [P1] Make migration safe for existing image rows D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
7389:docs\reviews\codex-story-17.1-spec-20260501.md:4630:- [P1] Validate product ownership before storing bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
7390:docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
7391:docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
7392:docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
7393:docs\reviews\codex-story-17.1-spec-20260501.md:4642:- [P2] Use a valid Sharp WebP quality option D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
7394:docs\reviews\codex-story-17.1-spec-20260501.md:4645:- [P2] Use an existing shop role in the guard D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
7395:docs\reviews\codex-story-17.1-spec-20260501.md:4653:- [P1] Make migration safe for existing image rows D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:134-139
7396:docs\reviews\codex-story-17.1-spec-20260501.md:4656:- [P1] Validate product ownership before storing bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:233-235
7397:docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:49-49
7398:docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:38-38
7399:docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:221-221
7400:docs\reviews\codex-story-17.1-spec-20260501.md:4668:- [P2] Use a valid Sharp WebP quality option D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:224-224
7401:docs\reviews\codex-story-17.1-spec-20260501.md:4671:- [P2] Use an existing shop role in the guard D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:168-168
7402:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4110:- [P1] Move product_images cleanup out of the SQL migration D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
7403:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4113:- [P2] Validate the actual ImageKit bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
7404:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4116:- [P2] Store dimensions after EXIF rotation D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
7405:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4123:- [P1] Move product_images cleanup out of the SQL migration D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
7406:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4126:- [P2] Validate the actual ImageKit bytes D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
7407:docs\reviews\codex-story-17.1-spec-round2-20260501.md:4129:- [P2] Store dimensions after EXIF rotation D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
7408:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1564:- [P1] Move product_images cleanup out of the SQL migration DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
7409:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1567:- [P2] Validate the actual ImageKit bytes DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
7410:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1570:- [P2] Store dimensions after EXIF rotation DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
7411:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1577:- [P1] Move product_images cleanup out of the SQL migration DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:135-135
7412:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1580:- [P2] Validate the actual ImageKit bytes DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:48-48
7413:docs\reviews\codex-story-17.1-spec-round3-20260501.md:1583:- [P2] Store dimensions after EXIF rotation DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:295-295
7414:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2163:- [P2] Include the byte cap in the URL builder contract D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
7415:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2166:- [P2] Remove the stale DELETE cleanup path D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
7416:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2169:- [P3] Align oversize docs and tests with the 1920w probe D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
7417:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2177:- [P2] Include the byte cap in the URL builder contract D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:39-39
7418:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2180:- [P2] Remove the stale DELETE cleanup path D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127-127
7419:docs\reviews\codex-story-17.1-spec-round3-20260501.md:2183:- [P3] Align oversize docs and tests with the 1920w probe D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:51-51
7420:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1006:  docs\reviews\codex-story-17.1-spec-20260501.md:4633:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
7421:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1013:  docs\reviews\codex-story-17.1-spec-20260501.md:4636:- [P2] Measure actual variants before claiming the 250 KB cap - 
7422:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1020:  docs\reviews\codex-story-17.1-spec-20260501.md:4639:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
7423:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1027:  docs\reviews\codex-story-17.1-spec-20260501.md:4659:- [P2] Strip EXIF instead of preserving it - C:\Alok\Business 
7424:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1034:  docs\reviews\codex-story-17.1-spec-20260501.md:4662:- [P2] Measure actual variants before claiming the 250 KB cap - 
7425:docs\reviews\codex-story-17.1-spec-round4-20260501.md:1041:  docs\reviews\codex-story-17.1-spec-20260501.md:4665:- [P2] Enforce the image cap inside a lock - C:\Alok\Business 
7426:docs\reviews\codex-story-17.1-spec-round4-20260501.md:2418:- [P2] Allow documented thumbnail transform variants D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
7427:docs\reviews\codex-story-17.1-spec-round4-20260501.md:2426:- [P2] Allow documented thumbnail transform variants D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:432-433
7428:docs\reviews\codex-story-17.1-spec-round5-20260501.md:1736:- [P2] Don't build mobile URLs from an absent public field D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
7429:docs\reviews\codex-story-17.1-spec-round5-20260501.md:1744:- [P2] Don't build mobile URLs from an absent public field D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
7430:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1297:2026-05-02T02:24:42.976109Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
7431:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1299:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\"" in C:\Alok\Business Projects\Goldsmith
7432:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1301:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "for %f in (docs\\reviews\\codex-story-17.1-spec*.md) do @echo --- %f & findstr /n /c:\"findings\" /c:\"[P\" /c:\"overall_correctness\" \"%f\" | findstr /r \".\""` rejected: blocked by policy
7433:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1302:2026-05-02T02:24:46.389503Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
7434:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1304:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }' in C:\Alok\Business Projects\Goldsmith
7435:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1306:`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem docs\\reviews\\codex-story-17.1-spec*.md | ForEach-Object { Write-Output ('--- ' + "'$_.Name); findstr /n /c:"[P" /c:"overall_correctness" $_.FullName }'` rejected: blocked by policy
7436:docs\reviews\codex-story-17.1-spec-round6-20260501.md:1308:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"[P\" /c:\"overall_correctness\" \"docs\\reviews\\codex-story-17.1-spec*.md\"" in C:\Alok\Business Projects\Goldsmith
7518:- [P2] Don't build mobile URLs from an absent public field DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
7526:- [P2] Don't build mobile URLs from an absent public field DЫ'?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:515-515
7584:- [P2] Keep storage_key available to authenticated image reads D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
7587:- [P2] Preload the responsive candidate, not the fallback URL D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
7590:- [P3] Align public GET expectations with default_url D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
7598:- [P2] Keep storage_key available to authenticated image reads D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:388-388
7601:- [P2] Preload the responsive candidate, not the fallback URL D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:522-522
7604:- [P3] Align public GET expectations with default_url D"?" C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:383-383
7630:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"overall_correctness\" /c:\"[P\" \"docs\\reviews\\codex-story-17.1-spec-round7-20260501.md\"" in C:\Alok\Business Projects\Goldsmith
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg \"bigint\\(|BIGINT|byte_size|paise\" packages apps -n -g \"*.ts\" -g \"*.sql\" --max-count 80" in C:\Alok\Business Projects\Goldsmith
 succeeded in 456ms:
packages\compliance\test\gst\split.test.ts:5:  it('computes 3% metal GST on gold value of ₹68,420 → 205,260 paise (floor)', () => {
packages\compliance\test\gst\split.test.ts:6:    // 6,842,000 paise × 300 / 10000 = 205,260 paise exactly
packages\compliance\test\gst\split.test.ts:11:  it('computes 5% making GST on making charge of ₹8,210.40 → 41,052 paise (floor)', () => {
packages\compliance\test\gst\split.test.ts:12:    // 821,040 paise × 500 / 10000 = 41,052 paise exactly (not ₹410.52 rounded up)
packages\compliance\test\gst\split.test.ts:24:  it('floors metal GST: 99 paise × 300 / 10000 = 2 not 3', () => {
apps\api\test\billing.integration.test.ts:10: * `rates:current` cache at 684200 paise/g before the test runs. PricingService reads
apps\api\test\billing.integration.test.ts:12: * Expected paise breakdown for 10g 22K @ 684200 paise/g, making 12%, no stones:
apps\api\test\billing.integration.test.ts:153:  // Pre-seed Redis rates cache for deterministic paise-exact test.
apps\api\test\billing.integration.test.ts:154:  // GOLD_22K = 684200 paise/g (₹6,842/g). All other purities seeded to avoid
apps\api\test\billing.integration.test.ts:428:  // Rate: GOLD_22K = 684200 paise/g (pre-seeded in Redis, deterministic)
apps\api\test\billing.integration.test.ts:434:  it('paise-exact: 10g 22K @ 684200p/g, making 12%, no stones, no hallmark fee → lineTotal 7,909,352', async () => {
packages\compliance\src\urd-rcm\self-invoice.ts:28:function formatPaise(paise: bigint): string {
packages\compliance\src\urd-rcm\self-invoice.ts:29:  const rupees = Number(paise) / 100;
packages\compliance\src\urd-rcm\self-invoice.test.ts:19:describe('golden example (15g x 600000 paise/g = Rs 90,000)', () => {
packages\compliance\src\urd-rcm\self-invoice.test.ts:36:  it('floors fractional paise', () => {
packages\compliance\src\urd-rcm\self-invoice.test.ts:79:  it('paise-exact 0.0001..1.0000', () => {
packages\compliance\src\tcs\tcs-206c.ts:1:export const TCS_THRESHOLD_PAISE = 20_000_000n; // Rs 2,00,000 × 100 paise
packages\compliance\src\tcs\tcs-206c.test.ts:5:  it('exports TCS_THRESHOLD_PAISE as Rs 2,00,000 in paise', () => {
packages\compliance\src\tcs\tcs-206c.test.ts:18:    expect(computeTcs(19_999_900n)).toBe(0n); // Rs 1,99,999 = 19_999_900 paise
packages\compliance\src\tcs\tcs-206c.test.ts:25:  it('returns 1% TCS when total is Rs 2,00,000 + 1 paise', () => {
packages\compliance\src\tcs\tcs-206c.test.ts:32:  it('returns Rs 5,000 (500_000n paise) TCS on Rs 5,00,000 invoice', () => {
packages\compliance\src\tcs\tcs-206c.test.ts:36:  it('returns 1% of total (integer truncation) for odd paise amounts', () => {
packages\compliance\src\tcs\tcs-206c.test.ts:37:    // Rs 3,00,001 = 30_000_100 paise → 1% = 300_001 paise (truncated)
apps\api\test\settings\settings.integration.test.ts:222:    it('updateLoyalty type=tier persists tier name and converts rupees to paise', async () => {
apps\api\test\settings\settings.integration.test.ts:238:      // 25000 rupees × 100 = 2,500,000 paise
apps\api\test\estimate.integration.test.ts:78:  // Pre-seed rates cache (GOLD_22K = 684200 paise/g)
apps\api\test\estimate.integration.test.ts:206:    // TCS should be 0 for totals < Rs 2,00,000 (3954676 paise = ~₹39,547)
packages\compliance\src\pmla\thresholds.test.ts:13:  it('returns ok for Rs 7,99,999 (one paise below warn threshold)', () => {
packages\compliance\src\pmla\thresholds.test.ts:25:  it('returns warn at Rs 9,99,999 (one paise below block threshold)', () => {
packages\compliance\src\pmla\thresholds.test.ts:37:  it('threshold constants are correct paise values', () => {
apps\api\test\rates-refresh.integration.test.ts:103:    // IbjaAdapter and MetalsDevAdapter are MVP stubs (no live HTTP) — always return GOLD_24K = 735000n paise
apps\api\test\rates-refresh.integration.test.ts:119:      gold_24k_paise: string;
apps\api\test\rates-refresh.integration.test.ts:121:      `SELECT source, gold_24k_paise FROM ibja_rate_snapshots ORDER BY fetched_at DESC LIMIT 1`,
apps\api\test\rates-refresh.integration.test.ts:126:    expect(rows.rows[0].gold_24k_paise).toBe('735000');
apps\api\test\rates-refresh.integration.test.ts:142:    // IbjaAdapter and MetalsDevAdapter are MVP stubs (no live HTTP) — always return GOLD_24K = 735000n paise
apps\api\test\rates-refresh.integration.test.ts:158:    const rows = await pool.query<{ source: string; gold_24k_paise: string }>(
apps\api\test\rates-refresh.integration.test.ts:159:      `SELECT source, gold_24k_paise FROM ibja_rate_snapshots ORDER BY fetched_at DESC LIMIT 1`,
apps\api\test\rates-refresh.integration.test.ts:163:    expect(rows.rows[0].gold_24k_paise).toBe('735000');
apps\api\test\rates-refresh.integration.test.ts:230:    // 735000 paise = 7350 rupees
packages\compliance\src\pmla\str-template.ts:57:  const paise2Rs = (p: bigint): string => `Rs ${(Number(p) / 100).toFixed(2)}`;
packages\compliance\src\pmla\str-template.ts:76:    `Amount:             ${paise2Rs(doc.transactionAmountPaise)}`,
apps\api\test\loyalty.integration.test.ts:80:        subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
packages\compliance\src\pmla\str-template.test.ts:83:  it('renders amount in rupees from paise', () => {
apps\api\test\compliance-gates\pan-114b.test.ts:75:  it('PAN_THRESHOLD_PAISE is exactly Rs 2,00,000 in paise (20_000_000n)', () => {
apps\api\test\compliance-gates\pan-114b.test.ts:79:  it('Rs 1,99,999 (19_999_900n paise) — no block without PAN', () => {
apps\api\test\compliance-gates\pan-114b.test.ts:85:  it('Rs 2,00,000 (20_000_000n paise) — blocks without PAN', () => {
apps\api\test\compliance-gates\pan-114b.test.ts:91:  it('Rs 2,00,001 (20_000_100n paise) — blocks without PAN', () => {
apps\shopkeeper\src\features\reports\useReports.ts:6:  total_paise: string;
apps\shopkeeper\src\features\reports\useReports.ts:7:  cash_paise: string;
apps\shopkeeper\src\features\reports\useReports.ts:8:  upi_paise: string;
apps\shopkeeper\src\features\reports\useReports.ts:9:  other_paise: string;
apps\shopkeeper\src\features\reports\useReports.ts:19:  total_paise: string;
apps\shopkeeper\src\features\reports\useReports.ts:20:  balance_due_paise: string;
apps\shopkeeper\src\features\reports\useReports.ts:35:  ltv_paise: string;
apps\shopkeeper\src\features\reports\useReports.ts:95:export function formatPaise(paise: string): string {
apps\shopkeeper\src\features\reports\useReports.ts:96:  const rupees = Math.round(parseInt(paise, 10) / 100);
apps\api\test\inventory-valuation.integration.test.ts:33:// ₹6,000/g for 22K = 600,000 paise/g
apps\api\test\inventory-valuation.integration.test.ts:136:    // 3 × 9g × 600,000 paise/g = 16,200,000 paise = ₹1,62,000
apps\api\test\inventory-valuation.integration.test.ts:160:    // Shop B: 50g × 600,000 = 30,000,000 paise
packages\compliance\src\pmla\cumulative.ts:64:        cash_total_paise, invoice_count)
packages\compliance\src\pmla\cumulative.ts:72:       cash_total_paise = pmla_aggregates.cash_total_paise + EXCLUDED.cash_total_paise,
packages\compliance\src\pmla\cumulative.ts:82:    `SELECT COALESCE(SUM(cash_total_paise), 0)::text AS monthly_total
apps\api\test\compliance-gates\b2b-gst.test.ts:88:  it('no paise lost in CGST/SGST split (odd GST amount)', () => {
apps\api\test\compliance-gates\b2b-gst.test.ts:175:  it('GST paise-exact across 10k weight variations (vs Decimal.js reference)', () => {
apps\api\test\compliance-gates\b2b-gst.test.ts:182:      // Simulate gold value from 1g to 100g of gold at Rs 7,000/g (in paise)
apps\api\test\compliance-gates\b2b-gst.test.ts:183:      // goldValuePaise = i * 700_000 paise (i * Rs 7,000 at 1/100g increments)
apps\api\test\compliance-gates\b2b-gst.test.ts:204:  it('GST making-charge paise-exact across 10k variations (vs Decimal.js reference)', () => {
packages\testing\weight-precision\test\harness.test.ts:5:  it('runs 10,000 random price computations with zero paise-level failures', async () => {
packages\testing\weight-precision\test\harness.test.ts:15:      throw new Error(`${result.failed} paise-level mismatches (showing up to 3):\n${detail}`);
packages\testing\weight-precision\test\harness.test.ts:31:      throw new Error(`${out.failed} invoice paise-level mismatches (showing up to 3 first-line samples):\n${detail}`);
packages\compliance\src\pmla\cumulative.test.ts:43:      if (sql.includes('SUM(cash_total_paise)')) {
packages\compliance\src\pmla\cumulative.test.ts:68:      if (sql.includes('SUM(cash_total_paise)')) {
packages\compliance\src\pmla\cumulative.test.ts:126:      if (sql.includes('SUM(cash_total_paise)')) {
packages\compliance\src\cash-cap\section-269st.ts:3:export const SECTION_269ST_LIMIT_PAISE = 19_999_900n; // Rs 1,99,999 × 100 paise
packages\compliance\src\pmla\ctr-template.ts:38:  const paise2Rs = (p: bigint): string => `Rs ${(Number(p) / 100).toFixed(2)}`;
packages\compliance\src\pmla\ctr-template.ts:41:    .map(t => `  ${t.date}  ${t.invoiceNumber.padEnd(20)}  ${paise2Rs(t.amountPaise)}`)
packages\compliance\src\pmla\ctr-template.ts:65:    `Total Cash:   ${paise2Rs(doc.totalCashPaise)}`,
packages\compliance\src\cash-cap\section-269st.test.ts:28:  it('blocks Rs 1,99,999 + 1 paise over limit', () => {
packages\testing\weight-precision\src\harness.ts:107: * Sums each line's totals using the same paise-floor arithmetic as computeProductPrice.
packages\compliance\src\gst\b2b-treatment.test.ts:26:  it('splits metal GST evenly: 3% of ₹1,000 → Rs 30 (3000 paise)', () => {
packages\compliance\src\gst\b2b-treatment.test.ts:44:  it('assigns remainder paise to SGST when metal GST is odd', () => {
packages\compliance\src\gst\b2b-treatment.test.ts:59:  it('assigns remainder paise to SGST when making GST is odd', () => {
packages\compliance\src\gst\b2b-treatment.test.ts:103:  it('applies full GST as IGST: 3% of ₹1,000 + 5% of ₹100 → 3500 paise', () => {
packages\compliance\src\pan\rule-114b.test.ts:8:  it('equals Rs 2,00,000 × 100 paise', () => {
packages\compliance\src\pan\rule-114b.ts:3:export const PAN_THRESHOLD_PAISE = 20_000_000n; // Rs 2,00,000 × 100 paise
packages\shared\src\schemas\loyalty-config.schema.ts:5:const MAX_THRESHOLD_PAISE  = 1_000_000_000; // ₹1 crore in paise
packages\shared\src\schemas\invoice.schema.ts:3:const PaiseString = z.string().regex(/^\d+$/, 'paise must be non-negative integer string');
packages\shared\src\schemas\invoice.schema.ts:50:  // 1 point = 1 paise (platform default). Only applied when customerId is present.
packages\shared\src\schemas\invoice.schema.ts:60:// Response schema — paise emitted as decimal strings (BigInt-safe across JSON boundaries).
packages\shared\src\schemas\invoice.schema.ts:124:  .regex(/^[1-9]\d*$/, 'paise must be a positive integer string (> 0)');
packages\shared\src\schemas\invoice.schema.ts:128:  // Must be > 0 to match the payments.amount_paise check constraint.
packages\shared\src\schemas\invoice.schema.test.ts:31:  it('rejects non-numeric paise strings', () => {
packages\shared\src\schemas\invoice.schema.test.ts:83:  it('accepts paise fields as decimal strings', () => {
packages\money\test\pricing.test.ts:40:    it('computes total = 8,413,852 paise = ₹84,138.52', () => {
packages\money\test\pricing.test.ts:109:      // 0.0001g × 1,000,000 paise/g = 100 paise exactly
packages\money\test\pricing.test.ts:120:    it('very small weight at rate that produces sub-paise: floors to lower paise', () => {
packages\money\test\pricing.test.ts:121:      // 0.0001g × 684200 paise/g = 68.42 paise → floor → 68 paise
packages\money\test\pricing.test.ts:140:      // 999.9999g × 1,000,000 = 999,999,900 paise ≈ ₹9,999,999 — well within BigInt range
packages\integrations\rates\src\metalsdev-adapter.ts:3:// GOLD_24K ≈ ₹7,350/g → 735000 paise
packages\money\test\money.test.ts:38:      // 1,00,00,000 rupees = 1,00,00,00,000 paise
packages\money\test\money.test.ts:49:    it('returns the raw paise count as number', () => {
packages\integrations\rates\src\metalsdev-adapter.spec.ts:6:  it('returns correct paise values for all purities', async () => {
apps\api\src\modules\custom-orders\custom-orders.service.ts:73:    quotedAmountPaise:     r.quoted_amount_paise?.toString() ?? null,
apps\api\src\modules\custom-orders\custom-orders.service.ts:74:    depositAmountPaise:    r.deposit_amount_paise.toString(),
apps\api\src\modules\custom-orders\custom-orders.service.ts:75:    depositPaidPaise:      r.deposit_paid_paise.toString(),
apps\api\src\modules\custom-orders\custom-orders.service.ts:207:        depositPaidPaise:  updated.deposit_paid_paise.toString(),
apps\api\src\modules\custom-orders\custom-orders.service.ts:230:      const res = await client.query<{ id: string; shop_id: string; deposit_paid_paise: bigint; deposit_amount_paise: bigint; status: string }>(
apps\api\src\modules\custom-orders\custom-orders.service.ts:231:        `SELECT id, shop_id, deposit_paid_paise, deposit_amount_paise, status
apps\api\src\modules\custom-orders\custom-orders.service.ts:245:      const newPaid   = order.deposit_paid_paise + payment.amountPaise;
apps\api\src\modules\custom-orders\custom-orders.service.ts:246:      const newStatus = newPaid >= order.deposit_amount_paise ? 'IN_PROGRESS' : order.status;
apps\api\src\modules\custom-orders\custom-orders.service.ts:250:         SET deposit_paid_paise  = $2,
apps\api\src\modules\custom-orders\custom-orders.repository.ts:11:  quoted_amount_paise:     bigint | null;
apps\api\src\modules\custom-orders\custom-orders.repository.ts:12:  deposit_amount_paise:    bigint;
apps\api\src\modules\custom-orders\custom-orders.repository.ts:13:  deposit_paid_paise:      bigint;
apps\api\src\modules\custom-orders\custom-orders.repository.ts:33:  quoted_amount_paise, deposit_amount_paise, deposit_paid_paise,
apps\api\src\modules\custom-orders\custom-orders.repository.ts:58:            quoted_amount_paise, estimated_delivery_date)
apps\api\src\modules\custom-orders\custom-orders.repository.ts:109:         SET deposit_amount_paise = $2,
apps\api\src\modules\custom-orders\custom-orders.repository.ts:138:      const newPaid  = order.deposit_paid_paise + paidPaise;
apps\api\src\modules\custom-orders\custom-orders.repository.ts:139:      const required = order.deposit_amount_paise;
apps\api\src\modules\custom-orders\custom-orders.repository.ts:144:         SET deposit_paid_paise   = $2,
apps\api\src\modules\settings\settings.service.ts:221:    const paise = wholePaise + fracPaise;
apps\api\src\modules\settings\settings.service.ts:222:    if (!Number.isFinite(paise) || paise < 0 || paise > 1_000_000_000) {
apps\api\src\modules\settings\settings.service.ts:225:    return paise;
apps\api\src\modules\settings\settings.service.loyalty.test.ts:135:      thresholdRupees: '100.00', // 10000 paise
apps\api\src\modules\settings\settings.service.loyalty.test.ts:161:      thresholdRupees: '150000.00', // 15_000_000 paise — same as Gold
apps\api\src\modules\settings\settings.service.loyalty.test.ts:181:      thresholdRupees: '600000.00', // 60_000_000 paise — above Diamond's 50_000_000
apps\api\src\modules\settings\settings.service.loyalty.test.ts:292:    it('single paise', () => { expect(toPaise('0.01')).toBe(1); });
packages\money\src\pricing.ts:93:  // Display-only conversion — safe up to ~900 trillion paise (₹9 trillion)
packages\integrations\rates\src\ibja-adapter.ts:3:// GOLD_24K ≈ ₹7,350/g → 735000 paise
packages\money\src\money.ts:2:  private constructor(private readonly _paise: bigint) {}
packages\money\src\money.ts:4:  static from(paise: bigint): MoneyInPaise {
packages\money\src\money.ts:5:    return new MoneyInPaise(paise);
packages\money\src\money.ts:9:    return new MoneyInPaise(this._paise + other._paise);
packages\money\src\money.ts:13:    return new MoneyInPaise(this._paise - other._paise);
packages\money\src\money.ts:17:    // Display-only: Number() is safe up to ~900 trillion paise (Rs 9 trillion).
packages\money\src\money.ts:24:    return fmt.format(Number(this._paise) / 100);
packages\money\src\money.ts:28:    return Number(this._paise);
packages\integrations\rates\src\ibja-adapter.spec.ts:6:  it('returns correct paise values for all purities', async () => {
apps\api\src\modules\crm\balance.service.ts:26:  outstanding_paise: bigint;
apps\api\src\modules\crm\balance.service.ts:27:  advance_paise:     bigint;
apps\api\src\modules\crm\balance.service.ts:69:        `SELECT id, shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at
apps\api\src\modules\crm\balance.service.ts:81:      outstandingPaise: BigInt(row.outstanding_paise).toString(),
apps\api\src\modules\crm\balance.service.ts:82:      advancePaise:     BigInt(row.advance_paise).toString(),
apps\api\src\modules\crm\balance.service.ts:102:        `SELECT COALESCE(SUM(total_paise), 0)::bigint AS total_invoiced
apps\api\src\modules\crm\balance.service.ts:111:        `SELECT COALESCE(SUM(p.amount_paise), 0)::bigint AS total_paid
apps\api\src\modules\crm\balance.service.ts:127:           (shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at)
apps\api\src\modules\crm\balance.service.ts:131:           outstanding_paise = EXCLUDED.outstanding_paise,
apps\api\src\modules\crm\balance.service.ts:132:           advance_paise     = EXCLUDED.advance_paise,
apps\api\src\modules\crm\balance.service.spec.ts:70:    expect(params[3]).toBe(1_000_000n);  // advance    = max(0, 60K-50K) = 10K (in paise)
apps\api\src\modules\crm\balance.service.spec.ts:161:    const row = { id: 'bal-1', shop_id: SHOP, customer_id: CUSTOMER_ID, outstanding_paise: 2_000_000n, advance_paise: 0n, last_updated_at: new Date() };
apps\api\src\modules\reports\reports.service.ts:7:  total_paise: string;
apps\api\src\modules\reports\reports.service.ts:8:  cash_paise: string;
apps\api\src\modules\reports\reports.service.ts:9:  upi_paise: string;
apps\api\src\modules\reports\reports.service.ts:10:  other_paise: string;
apps\api\src\modules\reports\reports.service.ts:20:  total_paise: string;
apps\api\src\modules\reports\reports.service.ts:21:  balance_due_paise: string;
apps\api\src\modules\reports\reports.service.ts:36:  ltv_paise: string;
apps\api\src\modules\reports\reports.service.ts:58:        total_paise:    string;
apps\api\src\modules\reports\reports.service.ts:59:        cash_paise:     string;
apps\api\src\modules\reports\reports.service.ts:60:        upi_paise:      string;
apps\api\src\modules\reports\reports.service.ts:61:        other_paise:    string;
apps\api\src\modules\reports\reports.service.ts:67:           SELECT id, total_paise
apps\api\src\modules\reports\reports.service.ts:73:           SELECT p.method, p.amount_paise
apps\api\src\modules\reports\reports.service.ts:85:           COALESCE((SELECT SUM(total_paise)     FROM daily_invoices), 0)::text AS total_paise,
apps\api\src\modules\reports\reports.service.ts:86:           COALESCE((SELECT SUM(amount_paise)     FROM daily_payments WHERE method = 'CASH'), 0)::text AS cash_paise,
apps\api\src\modules\reports\reports.service.ts:87:           COALESCE((SELECT SUM(amount_paise)     FROM daily_payments WHERE method = 'UPI'),  0)::text AS upi_paise,
apps\api\src\modules\reports\reports.service.ts:88:           COALESCE((SELECT SUM(amount_paise)     FROM daily_payments WHERE method NOT IN ('CASH','UPI')), 0)::text AS other_paise,
apps\api\src\modules\reports\reports.service.ts:97:        total_paise:    row.total_paise,
apps\api\src\modules\reports\reports.service.ts:98:        cash_paise:     row.cash_paise,
apps\api\src\modules\reports\reports.service.ts:99:        upi_paise:      row.upi_paise,
apps\api\src\modules\reports\reports.service.ts:100:        other_paise:    row.other_paise,
apps\api\src\modules\reports\reports.service.ts:118:           AND i.total_paise - COALESCE(
apps\api\src\modules\reports\reports.service.ts:119:             (SELECT SUM(p.amount_paise)
apps\api\src\modules\reports\reports.service.ts:131:        total_paise:      string;
apps\api\src\modules\reports\reports.service.ts:132:        balance_due_paise: string;
apps\api\src\modules\reports\reports.service.ts:141:           i.total_paise::text,
apps\api\src\modules\reports\reports.service.ts:142:           (i.total_paise - COALESCE(
apps\api\src\modules\reports\reports.service.ts:143:             (SELECT SUM(p.amount_paise)
apps\api\src\modules\reports\reports.service.ts:146:           ))::text AS balance_due_paise,
apps\api\src\modules\reports\reports.service.ts:150:           AND i.total_paise - COALESCE(
apps\api\src\modules\reports\reports.service.ts:151:             (SELECT SUM(p.amount_paise)
apps\api\src\modules\reports\reports.service.ts:166:          total_paise:      row.total_paise,
apps\api\src\modules\reports\reports.service.ts:167:          balance_due_paise: row.balance_due_paise,
apps\api\src\modules\reports\reports.service.ts:185:        ltv_paise:   string;
apps\api\src\modules\reports\reports.service.ts:192:           SUM(i.total_paise)::text AS ltv_paise
apps\api\src\modules\reports\reports.service.ts:196:         ORDER BY SUM(i.total_paise) DESC
apps\api\src\modules\reports\reports.service.spec.ts:44:          total_paise:    '500000',
apps\api\src\modules\reports\reports.service.spec.ts:45:          cash_paise:     '300000',
apps\api\src\modules\reports\reports.service.spec.ts:46:          upi_paise:      '200000',
apps\api\src\modules\reports\reports.service.spec.ts:47:          other_paise:    '0',
apps\api\src\modules\reports\reports.service.spec.ts:58:    expect(result.total_paise).toBe('500000');
apps\api\src\modules\reports\reports.service.spec.ts:59:    expect(result.cash_paise).toBe('300000');
apps\api\src\modules\reports\reports.service.spec.ts:60:    expect(result.upi_paise).toBe('200000');
apps\api\src\modules\reports\reports.service.spec.ts:61:    expect(result.other_paise).toBe('0');
apps\api\src\modules\reports\reports.service.spec.ts:70:          total_paise:    '0',
apps\api\src\modules\reports\reports.service.spec.ts:71:          cash_paise:     '0',
apps\api\src\modules\reports\reports.service.spec.ts:72:          upi_paise:      '0',
apps\api\src\modules\reports\reports.service.spec.ts:73:          other_paise:    '0',
apps\api\src\modules\reports\reports.service.spec.ts:84:    expect(result.total_paise).toBe('0');
apps\api\src\modules\reports\reports.service.spec.ts:104:  it('returns items with balance_due_paise', async () => {
apps\api\src\modules\reports\reports.service.spec.ts:114:            total_paise:       '100000',
apps\api\src\modules\reports\reports.service.spec.ts:115:            balance_due_paise: '50000',
apps\api\src\modules\reports\reports.service.spec.ts:126:    expect(result.items[0]!.balance_due_paise).toBe('50000');
apps\api\src\modules\reports\reports.service.spec.ts:155:          { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
apps\api\src\modules\reports\reports.service.spec.ts:156:          { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
apps\api\src\modules\reports\reports.service.spec.ts:165:    expect(result[0]!.ltv_paise).toBe('2000000');
packages\db\src\schema\ibja-rate-snapshots.ts:8:  gold_24k_paise: bigint('gold_24k_paise', { mode: 'bigint' }).notNull(),
packages\db\src\schema\ibja-rate-snapshots.ts:9:  gold_22k_paise: bigint('gold_22k_paise', { mode: 'bigint' }).notNull(),
packages\db\src\schema\ibja-rate-snapshots.ts:10:  gold_20k_paise: bigint('gold_20k_paise', { mode: 'bigint' }).notNull(),
packages\db\src\schema\ibja-rate-snapshots.ts:11:  gold_18k_paise: bigint('gold_18k_paise', { mode: 'bigint' }).notNull(),
packages\db\src\schema\ibja-rate-snapshots.ts:12:  gold_14k_paise: bigint('gold_14k_paise', { mode: 'bigint' }).notNull(),
packages\db\src\schema\ibja-rate-snapshots.ts:13:  silver_999_paise: bigint('silver_999_paise', { mode: 'bigint' }).notNull(),
packages\db\src\schema\ibja-rate-snapshots.ts:14:  silver_925_paise: bigint('silver_925_paise', { mode: 'bigint' }).notNull(),
apps\api\src\modules\catalog\catalog.controller.ts:35:function toPublicEntry(paise: bigint, fetchedAt: Date): PublicRateEntry {
apps\api\src\modules\catalog\catalog.controller.ts:36:  const rupees = (Number(paise) / 100).toFixed(2);
apps\api\src\modules\catalog\catalog.controller.ts:40:  }).format(Number(paise) / 100);
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:116:         (shop_id, customer_id, locked_rate_24k_paise_per_gram, expires_at, deposit_amount_paise, status)
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:178:    const res = await this.pool.query<{ id: string; locked_rate_24k_paise_per_gram: bigint }>(
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:179:      `SELECT id, locked_rate_24k_paise_per_gram
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:190:    return { bookingId: row.id, lockedRate24kPaise: row.locked_rate_24k_paise_per_gram };
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:244:             deposit_paid_paise  = $3
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:323:        `SELECT id, customer_id, locked_rate_24k_paise_per_gram, locked_at, expires_at,
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:324:                deposit_amount_paise, deposit_paid_paise, razorpay_order_id, status
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:334:        lockedRate24kPaisePerGram: r.locked_rate_24k_paise_per_gram.toString(),
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:337:        depositAmountPaise:        r.deposit_amount_paise.toString(),
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:338:        depositPaidPaise:          r.deposit_paid_paise.toString(),
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:348:        `SELECT id, customer_id, locked_rate_24k_paise_per_gram, locked_at, expires_at,
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:349:                deposit_amount_paise, deposit_paid_paise, razorpay_order_id, status
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:358:        lockedRate24kPaisePerGram: r.locked_rate_24k_paise_per_gram.toString(),
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:361:        depositAmountPaise:        r.deposit_amount_paise.toString(),
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:362:        depositPaidPaise:          r.deposit_paid_paise.toString(),
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:35:      // peekActiveLock: selects locked_rate_24k_paise_per_gram column
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:36:      if (sql.includes('locked_rate_24k_paise_per_gram') && !sql.includes('INSERT')) {
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:38:          return { rows: [{ id: BOOKING, locked_rate_24k_paise_per_gram: 700_000n }] };
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:167:    it('happy path: fetches payment, sets status ACTIVE + deposit_paid_paise', async () => {
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:21:  subtotal_paise: 100000n, gst_metal_paise: 3000n, gst_making_paise: 600n, total_paise: 103600n,
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:22:  tcs_collected_paise: 0n,
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:23:  cgst_metal_paise: 1500n, sgst_metal_paise: 1500n, cgst_making_paise: 300n, sgst_making_paise: 300n,
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:24:  igst_metal_paise: 0n, igst_making_paise: 0n,
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:34:  cgst_metal_paise: 0n, sgst_metal_paise: 0n, cgst_making_paise: 0n, sgst_making_paise: 0n,
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:35:  igst_metal_paise: 3000n, igst_making_paise: 600n,
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:40:  rate_per_gram_paise: 600000n, making_charge_pct: '12.00', metal_type: 'GOLD', purity: '22K',
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:41:  gst_metal_paise: 3000n, gst_making_paise: 600n, line_total_paise: 103600n,
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:79:    expect(cells[11]).toBe('30.00');  // IGST metal = 3000 paise = Rs 30.00
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:109:  it('GSTR-3B CGST total correct (1500+300=1800 paise = Rs 18)', async () => { expect(await svc.generateGstr3bSummary('2026-04')).toContain('18.00'); });
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:114:    expect(csv).toContain('2000.00'); // 2 × 100000 paise = Rs 2000.00 subtotal
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:176:      invoice: { ...B2C_INVOICE, customer_phone: phone, invoice_number: 'INV-42', total_paise: 500000n },
apps\api\src\modules\billing\billing.repository.ts:16:  cgst_metal_paise:     bigint;
apps\api\src\modules\billing\billing.repository.ts:17:  sgst_metal_paise:     bigint;
apps\api\src\modules\billing\billing.repository.ts:18:  cgst_making_paise:    bigint;
apps\api\src\modules\billing\billing.repository.ts:19:  sgst_making_paise:    bigint;
apps\api\src\modules\billing\billing.repository.ts:20:  igst_metal_paise:     bigint;
apps\api\src\modules\billing\billing.repository.ts:21:  igst_making_paise:    bigint;
apps\api\src\modules\billing\billing.repository.ts:26:  subtotal_paise:      bigint;
apps\api\src\modules\billing\billing.repository.ts:27:  gst_metal_paise:     bigint;
apps\api\src\modules\billing\billing.repository.ts:28:  gst_making_paise:    bigint;
apps\api\src\modules\billing\billing.repository.ts:29:  total_paise:         bigint;
apps\api\src\modules\billing\billing.repository.ts:38:  tcs_collected_paise: bigint;
apps\api\src\modules\billing\billing.repository.ts:57:  rate_per_gram_paise:   bigint | null;
apps\api\src\modules\billing\billing.repository.ts:59:  gold_value_paise:      bigint;
apps\api\src\modules\billing\billing.repository.ts:60:  making_charge_paise:   bigint;
apps\api\src\modules\billing\billing.repository.ts:61:  stone_charges_paise:   bigint;
apps\api\src\modules\billing\billing.repository.ts:62:  hallmark_fee_paise:    bigint;
apps\api\src\modules\billing\billing.repository.ts:63:  gst_metal_paise:       bigint;
apps\api\src\modules\billing\billing.repository.ts:64:  gst_making_paise:      bigint;
apps\api\src\modules\billing\billing.repository.ts:65:  line_total_paise:      bigint;
apps\api\src\modules\billing\billing.repository.ts:131:  status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
apps\api\src\modules\billing\billing.repository.ts:132:  cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
apps\api\src\modules\billing\billing.repository.ts:133:  igst_metal_paise, igst_making_paise,
apps\api\src\modules\billing\billing.repository.ts:136:  tcs_collected_paise,
apps\api\src\modules\billing\billing.repository.ts:143:  metal_type, purity, net_weight_g, rate_per_gram_paise, making_charge_pct,
apps\api\src\modules\billing\billing.repository.ts:144:  gold_value_paise, making_charge_paise, stone_charges_paise, hallmark_fee_paise,
apps\api\src\modules\billing\billing.repository.ts:145:  gst_metal_paise, gst_making_paise, line_total_paise, sort_order
apps\api\src\modules\billing\billing.repository.ts:169:              status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
apps\api\src\modules\billing\billing.repository.ts:170:              cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
apps\api\src\modules\billing\billing.repository.ts:171:              igst_metal_paise, igst_making_paise,
apps\api\src\modules\billing\billing.repository.ts:174:              tcs_collected_paise)
apps\api\src\modules\billing\billing.repository.ts:254:            metal_type, purity, net_weight_g, rate_per_gram_paise, making_charge_pct,
apps\api\src\modules\billing\billing.repository.ts:255:            gold_value_paise, making_charge_paise, stone_charges_paise, hallmark_fee_paise,
apps\api\src\modules\billing\billing.repository.ts:256:            gst_metal_paise, gst_making_paise, line_total_paise, sort_order)
apps\api\src\modules\billing\billing.repository.ts:345:           i.total_paise,
apps\api\src\modules\billing\billing.repository.ts:354:         GROUP BY i.id, i.invoice_number, i.issued_at, i.total_paise, i.status
apps\api\src\modules\billing\billing.repository.ts:372:  total_paise:     bigint;
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:83:    subtotal_paise:       7663040n,
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:84:    gst_metal_paise:      246312n,
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:85:    gst_making_paise:     0n,
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:86:    total_paise:          7909352n,
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:87:    cgst_metal_paise:     0n, sgst_metal_paise: 0n, cgst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:88:    sgst_making_paise:    0n, igst_metal_paise: 0n, igst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:94:    tcs_collected_paise:  0n,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:57:          cgst_metal_paise: 0n, sgst_metal_paise: 0n,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:58:          cgst_making_paise: 0n, sgst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:59:          igst_metal_paise: 0n, igst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:64:          subtotal_paise: input.subtotalPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:65:          gst_metal_paise: input.gstMetalPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:66:          gst_making_paise: input.gstMakingPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:67:          total_paise: input.totalPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:73:          tcs_collected_paise: input.tcsCollectedPaise ?? 0n,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:81:          net_weight_g: it.netWeightG, rate_per_gram_paise: it.ratePerGramPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:82:          making_charge_pct: it.makingChargePct, gold_value_paise: it.goldValuePaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:83:          making_charge_paise: it.makingChargePaise, stone_charges_paise: it.stoneChargesPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:84:          hallmark_fee_paise: it.hallmarkFeePaise, gst_metal_paise: it.gstMetalPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:85:          gst_making_paise: it.gstMakingPaise, line_total_paise: it.lineTotalPaise,
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:178:  it('loyaltyPointsToRedeem reduces totalPaise by points (1 point = 1 paise)', async () => {
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:93:            cgst_metal_paise: 0n, sgst_metal_paise: 0n,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:94:            cgst_making_paise: 0n, sgst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:95:            igst_metal_paise: 0n, igst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:97:            status: 'ISSUED', subtotal_paise: 0n,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:98:            gst_metal_paise: 0n, gst_making_paise: 0n, total_paise: input.totalPaise,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:103:            tcs_collected_paise: 0n,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:111:            net_weight_g: it.netWeightG, rate_per_gram_paise: it.ratePerGramPaise,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:112:            making_charge_pct: it.makingChargePct, gold_value_paise: it.goldValuePaise,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:113:            making_charge_paise: it.makingChargePaise,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:114:            stone_charges_paise: it.stoneChargesPaise,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:115:            hallmark_fee_paise: it.hallmarkFeePaise,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:116:            gst_metal_paise: it.gstMetalPaise, gst_making_paise: it.gstMakingPaise,
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:117:            line_total_paise: it.lineTotalPaise, sort_order: i,
apps\api\src\modules\billing\billing.service.ts:103:    subtotalPaise:     invoice.subtotal_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:104:    gstMetalPaise:     invoice.gst_metal_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:105:    gstMakingPaise:    invoice.gst_making_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:106:    totalPaise:        invoice.total_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:117:    cgstMetalPaise:    invoice.cgst_metal_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:118:    sgstMetalPaise:    invoice.sgst_metal_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:119:    cgstMakingPaise:   invoice.cgst_making_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:120:    sgstMakingPaise:   invoice.sgst_making_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:121:    igstMetalPaise:    invoice.igst_metal_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:122:    igstMakingPaise:   invoice.igst_making_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:126:    tcsCollectedPaise: invoice.tcs_collected_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:140:    ratePerGramPaise:   it.rate_per_gram_paise?.toString() ?? null,
apps\api\src\modules\billing\billing.service.ts:142:    goldValuePaise:     it.gold_value_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:143:    makingChargePaise:  it.making_charge_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:144:    stoneChargesPaise:  it.stone_charges_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:145:    hallmarkFeePaise:   it.hallmark_fee_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:146:    gstMetalPaise:      it.gst_metal_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:147:    gstMakingPaise:     it.gst_making_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:148:    lineTotalPaise:     it.line_total_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:643:        total_paise:           result.invoice.total_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:665:      .reduce((sum, item) => sum + item.gold_value_paise, 0n)
apps\api\src\modules\billing\billing.service.ts:669:    trackEvent(ctx.shopId, 'invoice.created', { invoice_type: resp.invoiceType, total_paise: resp.totalPaise });
apps\api\src\modules\billing\billing.service.ts:747:        totalPaise:    r.total_paise.toString(),
apps\api\src\modules\billing\billing.service.ts:757:  // The invoice total = quotedAmountPaise - deposit_paid_paise (remaining balance).
apps\api\src\modules\billing\billing.service.ts:769:      quoted_amount_paise: bigint | null;
apps\api\src\modules\billing\billing.service.ts:770:      deposit_paid_paise: bigint;
apps\api\src\modules\billing\billing.service.ts:775:        `SELECT id, customer_id, description, quoted_amount_paise, deposit_paid_paise, status
apps\api\src\modules\billing\billing.service.ts:788:    if (order.quoted_amount_paise == null) {
apps\api\src\modules\billing\billing.service.ts:792:    const remainingPaise = order.quoted_amount_paise - order.deposit_paid_paise;
apps\api\src\modules\billing\billing.service.ts:1057:        total_paise:    result.invoice.total_paise.toString(),
apps\api\src\modules\billing\billing.service.spec.ts:94:        cgst_metal_paise: input.cgstMetalPaise ?? 0n,
apps\api\src\modules\billing\billing.service.spec.ts:95:        sgst_metal_paise: input.sgstMetalPaise ?? 0n,
apps\api\src\modules\billing\billing.service.spec.ts:96:        cgst_making_paise: input.cgstMakingPaise ?? 0n,
apps\api\src\modules\billing\billing.service.spec.ts:97:        sgst_making_paise: input.sgstMakingPaise ?? 0n,
apps\api\src\modules\billing\billing.service.spec.ts:98:        igst_metal_paise: input.igstMetalPaise ?? 0n,
apps\api\src\modules\billing\billing.service.spec.ts:99:        igst_making_paise: input.igstMakingPaise ?? 0n,
apps\api\src\modules\billing\billing.service.spec.ts:104:        subtotal_paise: input.subtotalPaise,
apps\api\src\modules\billing\billing.service.spec.ts:105:        gst_metal_paise: input.gstMetalPaise,
apps\api\src\modules\billing\billing.service.spec.ts:106:        gst_making_paise: input.gstMakingPaise,
apps\api\src\modules\billing\billing.service.spec.ts:107:        total_paise: input.totalPaise,
apps\api\src\modules\billing\billing.service.spec.ts:115:        tcs_collected_paise: input.tcsCollectedPaise ?? 0n,
apps\api\src\modules\billing\billing.service.spec.ts:129:        rate_per_gram_paise: it.ratePerGramPaise,
apps\api\src\modules\billing\billing.service.spec.ts:131:        gold_value_paise: it.goldValuePaise,
apps\api\src\modules\billing\billing.service.spec.ts:132:        making_charge_paise: it.makingChargePaise,
apps\api\src\modules\billing\billing.service.spec.ts:133:        stone_charges_paise: it.stoneChargesPaise,
apps\api\src\modules\billing\billing.service.spec.ts:134:        hallmark_fee_paise: it.hallmarkFeePaise,
apps\api\src\modules\billing\billing.service.spec.ts:135:        gst_metal_paise: it.gstMetalPaise,
apps\api\src\modules\billing\billing.service.spec.ts:136:        gst_making_paise: it.gstMakingPaise,
apps\api\src\modules\billing\billing.service.spec.ts:137:        line_total_paise: it.lineTotalPaise,
apps\api\src\modules\billing\billing.service.spec.ts:543:            cgst_metal_paise: 0n,
apps\api\src\modules\billing\billing.service.spec.ts:544:            sgst_metal_paise: 0n,
apps\api\src\modules\billing\billing.service.spec.ts:545:            cgst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.spec.ts:546:            sgst_making_paise: 0n,
apps\api\src\modules\billing\billing.service.spec.ts:547:            igst_metal_paise: 900n,
apps\api\src\modules\billing\billing.service.spec.ts:548:            igst_making_paise: 250n,
apps\api\src\modules\billing\billing.service.spec.ts:553:            subtotal_paise: 30_000n,
apps\api\src\modules\billing\billing.service.spec.ts:554:            gst_metal_paise: 900n,
apps\api\src\modules\billing\billing.service.spec.ts:555:            gst_making_paise: 250n,
apps\api\src\modules\billing\billing.service.spec.ts:556:            total_paise: 31_150n,
apps\api\src\modules\billing\billing.service.spec.ts:564:            tcs_collected_paise: 0n,
apps\api\src\modules\billing\compliance-reports.service.ts:66:      const aggRes = await tx.query<{ cash_total_paise: string; aggregate_date: string }>( // nosemgrep: goldsmith.require-tenant-transaction
apps\api\src\modules\billing\compliance-reports.service.ts:67:        `SELECT cash_total_paise::text, aggregate_date::text
apps\api\src\modules\billing\compliance-reports.service.ts:143:        amountPaise:   BigInt(agg.cash_total_paise),
apps\api\src\modules\pricing\pricing.service.ts:17:  gold_24k_paise: bigint;
apps\api\src\modules\pricing\pricing.service.ts:18:  gold_22k_paise: bigint;
apps\api\src\modules\pricing\pricing.service.ts:19:  gold_20k_paise: bigint;
apps\api\src\modules\pricing\pricing.service.ts:20:  gold_18k_paise: bigint;
apps\api\src\modules\pricing\pricing.service.ts:21:  gold_14k_paise: bigint;
apps\api\src\modules\pricing\pricing.service.ts:22:  silver_999_paise: bigint;
apps\api\src\modules\pricing\pricing.service.ts:23:  silver_925_paise: bigint;
apps\api\src\modules\pricing\pricing.service.ts:39:  GOLD_24K: 'gold_24k_paise',
apps\api\src\modules\pricing\pricing.service.ts:40:  GOLD_22K: 'gold_22k_paise',
apps\api\src\modules\pricing\pricing.service.ts:41:  GOLD_20K: 'gold_20k_paise',
apps\api\src\modules\pricing\pricing.service.ts:42:  GOLD_18K: 'gold_18k_paise',
apps\api\src\modules\pricing\pricing.service.ts:43:  GOLD_14K: 'gold_14k_paise',
apps\api\src\modules\pricing\pricing.service.ts:44:  SILVER_999: 'silver_999_paise',
apps\api\src\modules\pricing\pricing.service.ts:45:  SILVER_925: 'silver_925_paise',
apps\api\src\modules\pricing\pricing.service.ts:48:function formatRupees(paise: bigint): string {
apps\api\src\modules\pricing\pricing.service.ts:52:  }).format(Number(paise) / 100);
apps\api\src\modules\pricing\pricing.service.ts:251:      gold_24k_paise: rates.GOLD_24K.perGramPaise,
apps\api\src\modules\pricing\pricing.service.ts:252:      gold_22k_paise: rates.GOLD_22K.perGramPaise,
apps\api\src\modules\pricing\pricing.service.ts:253:      gold_20k_paise: rates.GOLD_20K.perGramPaise,
apps\api\src\modules\pricing\pricing.service.ts:254:      gold_18k_paise: rates.GOLD_18K.perGramPaise,
apps\api\src\modules\pricing\pricing.service.ts:255:      gold_14k_paise: rates.GOLD_14K.perGramPaise,
apps\api\src\modules\pricing\pricing.service.ts:256:      silver_999_paise: rates.SILVER_999.perGramPaise,
apps\api\src\modules\pricing\pricing.service.ts:257:      silver_925_paise: rates.SILVER_925.perGramPaise,
apps\api\src\modules\pricing\pricing.service.ts:266:            gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
apps\api\src\modules\pricing\pricing.service.ts:267:            silver_999_paise, silver_925_paise, stale)
apps\api\src\modules\pricing\pricing.service.ts:272:          snapshotValues.gold_24k_paise,
apps\api\src\modules\pricing\pricing.service.ts:273:          snapshotValues.gold_22k_paise,
apps\api\src\modules\pricing\pricing.service.ts:274:          snapshotValues.gold_20k_paise,
apps\api\src\modules\pricing\pricing.service.ts:275:          snapshotValues.gold_18k_paise,
apps\api\src\modules\pricing\pricing.service.ts:276:          snapshotValues.gold_14k_paise,
apps\api\src\modules\pricing\pricing.service.ts:277:          snapshotValues.silver_999_paise,
apps\api\src\modules\pricing\pricing.service.ts:278:          snapshotValues.silver_925_paise,
apps\api\src\modules\pricing\pricing.service.ts:324:               gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
apps\api\src\modules\pricing\pricing.service.ts:325:               silver_999_paise, silver_925_paise
apps\api\src\modules\pricing\pricing.service.ts:335:        const paise = row[column] as bigint;
apps\api\src\modules\pricing\pricing.service.ts:338:          perGramPaise: paise.toString(),
apps\api\src\modules\pricing\pricing.service.ts:339:          perGramRupees: formatRupees(paise),
apps\api\src\modules\pricing\pricing.service.ts:356:    const paise = BigInt(new Decimal(dto.overrideRupees).mul(100).toFixed(0));
apps\api\src\modules\pricing\pricing.service.ts:371:           (shop_id, purity, override_paise, reason, set_by_user_id, valid_until)
apps\api\src\modules\pricing\pricing.service.ts:373:        [ctx.shopId, dto.purity, paise, dto.reason, ctx.userId, validUntil],
apps\api\src\modules\pricing\pricing.service.ts:386:          JSON.stringify({ perGramPaise: paise.toString(), reason: dto.reason }),
apps\api\src\modules\pricing\pricing.service.ts:430:      const result = await tx.query<{ override_paise: bigint; valid_until: Date; reason: string }>(
apps\api\src\modules\pricing\pricing.service.ts:431:        `SELECT override_paise, valid_until, reason
apps\api\src\modules\pricing\pricing.service.ts:445:      overridePaise: BigInt(row.override_paise),
apps\api\src\modules\billing\estimate.service.ts:59:  gold_rate_paise_per_gram: bigint;
apps\api\src\modules\billing\estimate.service.ts:60:  subtotal_paise:           bigint;
apps\api\src\modules\billing\estimate.service.ts:61:  gst_paise:                bigint;
apps\api\src\modules\billing\estimate.service.ts:62:  total_paise:              bigint;
apps\api\src\modules\billing\estimate.service.ts:76:    goldRatePaisePerGram: row.gold_rate_paise_per_gram.toString(),
apps\api\src\modules\billing\estimate.service.ts:77:    subtotalPaise:        row.subtotal_paise.toString(),
apps\api\src\modules\billing\estimate.service.ts:78:    gstPaise:             row.gst_paise.toString(),
apps\api\src\modules\billing\estimate.service.ts:79:    totalPaise:           row.total_paise.toString(),
apps\api\src\modules\billing\estimate.service.ts:102:           (shop_id, customer_id, line_items, gold_rate_paise_per_gram,
apps\api\src\modules\billing\estimate.service.ts:103:            subtotal_paise, gst_paise, total_paise, expires_at, created_by_user_id)
apps\api\src\modules\billing\estimate.service.ts:107:           id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
apps\api\src\modules\billing\estimate.service.ts:108:           subtotal_paise, gst_paise, total_paise, status, expires_at,
apps\api\src\modules\billing\estimate.service.ts:129:      after: { total_paise: row.total_paise.toString(), status: row.status },
apps\api\src\modules\billing\estimate.service.ts:139:        `SELECT id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
apps\api\src\modules\billing\estimate.service.ts:140:                subtotal_paise, gst_paise, total_paise, status, expires_at,
apps\api\src\modules\billing\estimate.service.ts:157:        `SELECT id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
apps\api\src\modules\billing\estimate.service.ts:158:                subtotal_paise, gst_paise, total_paise, status, expires_at,
apps\api\src\modules\billing\estimate.service.ts:181:           id, shop_id, customer_id, line_items, gold_rate_paise_per_gram,
apps\api\src\modules\billing\estimate.service.ts:182:           subtotal_paise, gst_paise, total_paise, status, expires_at,
apps\api\src\modules\loyalty\loyalty.service.ts:39:  // Even at 100 crore in gold value (1e10 paise) at 100% rate, points = 1e8 — well safe.
apps\api\src\modules\billing\estimate.service.spec.ts:37:    gold_rate_paise_per_gram: 684200n,
apps\api\src\modules\billing\estimate.service.spec.ts:38:    subtotal_paise:           1000000n,
apps\api\src\modules\billing\estimate.service.spec.ts:39:    gst_paise:                30000n,
apps\api\src\modules\billing\estimate.service.spec.ts:40:    total_paise:              1030000n,
apps\api\src\modules\customer\customer.controller.ts:122:      deposit_amount_paise: string;
apps\api\src\modules\customer\customer.controller.ts:125:      `SELECT razorpay_order_id, deposit_amount_paise::text, status
apps\api\src\modules\customer\customer.controller.ts:135:    const amountPaise = row.rows[0].deposit_amount_paise;
apps\api\src\modules\loyalty\loyalty.service.spec.ts:110:    // 6_849_900 paise * 1.00% = 684.99 → floor → 684
apps\api\src\modules\loyalty\loyalty.service.spec.ts:120:    // 100 paise * 0.0001% = effectively zero
apps\api\src\modules\loyalty\loyalty.service.spec.ts:125:    // 1_00_00_000 paise = ₹1,00,000 → 1% = 1000 points
apps\api\src\modules\loyalty\loyalty.service.spec.ts:197:    // 100 paise * 0.01% = 0.01 → floor → 0
apps\api\src\modules\pricing\pricing.service.spec.ts:220:    it('converts rupees string to paise correctly using Decimal (no float arithmetic)', async () => {
apps\api\src\modules\pricing\pricing.service.spec.ts:231:      // 6842.50 rupees * 100 = 684250 paise (BigInt, no float error)
apps\api\src\modules\pricing\pricing.service.spec.ts:301:        rows: [{ override_paise: 684250n, valid_until: validUntil, reason: 'Test' }],
apps\api\src\modules\pricing\pricing.service.spec.ts:347:        gold_24k_paise: 735000n,
apps\api\src\modules\pricing\pricing.service.spec.ts:348:        gold_22k_paise: 673750n,
apps\api\src\modules\pricing\pricing.service.spec.ts:349:        gold_20k_paise: 612500n,
apps\api\src\modules\pricing\pricing.service.spec.ts:350:        gold_18k_paise: 551250n,
apps\api\src\modules\pricing\pricing.service.spec.ts:351:        gold_14k_paise: 428750n,
apps\api\src\modules\pricing\pricing.service.spec.ts:352:        silver_999_paise: 9500n,
apps\api\src\modules\pricing\pricing.service.spec.ts:353:        silver_925_paise: 8788n,
apps\api\src\modules\pricing\pricing.service.spec.ts:360:      // We verify the service maps them to RateHistoryPoint with the correct paise value.
apps\api\src\modules\pricing\pricing.service.spec.ts:373:    it('selects the correct paise column for each purity key', async () => {
apps\api\src\modules\pricing\pricing.service.spec.ts:413:      const row = makeSnapshot(new Date('2026-03-26T10:00:00Z'), { gold_22k_paise: 673750n });
apps\api\src\modules\pricing\pricing.service.spec.ts:418:      // 673750 paise = ₹6737.50 → en-IN format: "6,737.50"
apps\api\src\modules\pricing\pricing.service.spec.ts:424:        makeSnapshot(new Date('2026-03-26T10:00:00Z'), { gold_22k_paise: 673750n }),
apps\api\src\modules\pricing\pricing.service.spec.ts:425:        makeSnapshot(new Date('2026-03-27T10:00:00Z'), { gold_22k_paise: 675000n }),
apps\api\src\modules\billing\gstr-export.service.ts:17:  subtotal_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:18:  gst_metal_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:19:  gst_making_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:20:  total_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:21:  cgst_metal_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:22:  sgst_metal_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:23:  cgst_making_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:24:  sgst_making_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:25:  igst_metal_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:26:  igst_making_paise: bigint | string;
apps\api\src\modules\billing\gstr-export.service.ts:32:function paiseToRupees(paise: bigint | string | number): string {
apps\api\src\modules\billing\gstr-export.service.ts:33:  return (Number(paise) / 100).toFixed(2);
apps\api\src\modules\billing\gstr-export.service.ts:85:  const totalRs = paiseToRupees(BigInt(invoice.total_paise));
apps\api\src\modules\billing\gstr-export.service.ts:87:  const gstMetal = BigInt(invoice.gst_metal_paise);
apps\api\src\modules\billing\gstr-export.service.ts:88:  const gstMaking = BigInt(invoice.gst_making_paise);
apps\api\src\modules\billing\gstr-export.service.ts:91:    const metalTaxable = paiseToRupees((gstMetal * 10000n) / 300n);
apps\api\src\modules\billing\gstr-export.service.ts:104:      isIGST ? paiseToRupees(BigInt(invoice.igst_metal_paise)) : '0.00',
apps\api\src\modules\billing\gstr-export.service.ts:105:      !isIGST ? paiseToRupees(BigInt(invoice.cgst_metal_paise)) : '0.00',
apps\api\src\modules\billing\gstr-export.service.ts:106:      !isIGST ? paiseToRupees(BigInt(invoice.sgst_metal_paise)) : '0.00',
apps\api\src\modules\billing\gstr-export.service.ts:111:    const makingTaxable = paiseToRupees((gstMaking * 10000n) / 500n);
apps\api\src\modules\billing\gstr-export.service.ts:124:      isIGST ? paiseToRupees(BigInt(invoice.igst_making_paise)) : '0.00',
apps\api\src\modules\billing\gstr-export.service.ts:125:      !isIGST ? paiseToRupees(BigInt(invoice.cgst_making_paise)) : '0.00',
apps\api\src\modules\billing\gstr-export.service.ts:126:      !isIGST ? paiseToRupees(BigInt(invoice.sgst_making_paise)) : '0.00',
apps\api\src\modules\billing\gstr-export.service.ts:166:      totalTaxable += BigInt(inv.subtotal_paise);
apps\api\src\modules\billing\gstr-export.service.ts:167:      totalIgst += BigInt(inv.igst_metal_paise) + BigInt(inv.igst_making_paise);
apps\api\src\modules\billing\gstr-export.service.ts:168:      totalCgst += BigInt(inv.cgst_metal_paise) + BigInt(inv.cgst_making_paise);
apps\api\src\modules\billing\gstr-export.service.ts:169:      totalSgst += BigInt(inv.sgst_metal_paise) + BigInt(inv.sgst_making_paise);
apps\api\src\modules\billing\gstr-export.service.ts:176:        paiseToRupees(totalTaxable),
apps\api\src\modules\billing\gstr-export.service.ts:177:        paiseToRupees(totalIgst),
apps\api\src\modules\billing\gstr-export.service.ts:178:        paiseToRupees(totalCgst),
apps\api\src\modules\billing\gstr-export.service.ts:179:        paiseToRupees(totalSgst),
apps\api\src\modules\billing\gstr-export.service.ts:200:           subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
apps\api\src\modules\billing\gstr-export.service.ts:201:           cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
apps\api\src\modules\billing\gstr-export.service.ts:202:           igst_metal_paise, igst_making_paise,
apps\api\src\modules\loyalty\loyalty.repository.ts:168:  // Returns the total invoice spend in paise for this customer over the last 12 months.
apps\api\src\modules\loyalty\loyalty.repository.ts:169:  // Tier thresholds (thresholdPaise) represent spend in paise — compare against this value,
apps\api\src\modules\loyalty\loyalty.repository.ts:174:        `SELECT COALESCE(SUM(i.total_paise), 0) AS total
apps\api\src\modules\pricing\pricing.controller.ts:47:function toEntry(paise: bigint, fetchedAt: Date): PurityEntry {
apps\api\src\modules\pricing\pricing.controller.ts:49:    perGramPaise: paise.toString(),
apps\api\src\modules\pricing\pricing.controller.ts:50:    perGramRupees: `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`,
apps\api\src\modules\billing\invoice-pdf.service.ts:17:function formatINR(paise: bigint | string | number): string {
apps\api\src\modules\billing\invoice-pdf.service.ts:18:  const n = Number(paise) / 100;
apps\api\src\modules\billing\invoice-pdf.service.ts:41:    const rate = it.rate_per_gram_paise ? `₹${formatINR(it.rate_per_gram_paise)}/g` : '—';
apps\api\src\modules\billing\invoice-pdf.service.ts:51:        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4;text-align:right">₹${formatINR(BigInt(it.gst_metal_paise) + BigInt(it.gst_making_paise))}</td>
apps\api\src\modules\billing\invoice-pdf.service.ts:52:        <td style="padding:8px 4px;border-bottom:1px solid #e7e5e4;text-align:right;font-weight:600">₹${formatINR(it.line_total_paise)}</td>
apps\api\src\modules\billing\invoice-pdf.service.ts:62:    ? `<tr><td style="padding:4px 0;color:#57534e">IGST — धातु (3%) / IGST Metal (3%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.igst_metal_paise)}</td></tr>
apps\api\src\modules\billing\invoice-pdf.service.ts:63:       <tr><td style="padding:4px 0;color:#57534e">IGST — मेकिंग (5%) / IGST Making (5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.igst_making_paise)}</td></tr>`
apps\api\src\modules\billing\invoice-pdf.service.ts:64:    : `<tr><td style="padding:4px 0;color:#57534e">CGST — धातु (1.5%) / CGST Metal (1.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.cgst_metal_paise)}</td></tr>
apps\api\src\modules\billing\invoice-pdf.service.ts:65:       <tr><td style="padding:4px 0;color:#57534e">SGST — धातु (1.5%) / SGST Metal (1.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.sgst_metal_paise)}</td></tr>
apps\api\src\modules\billing\invoice-pdf.service.ts:66:       <tr><td style="padding:4px 0;color:#57534e">CGST — मेकिंग (2.5%) / CGST Making (2.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.cgst_making_paise)}</td></tr>
apps\api\src\modules\billing\invoice-pdf.service.ts:67:       <tr><td style="padding:4px 0;color:#57534e">SGST — मेकिंग (2.5%) / SGST Making (2.5%)</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.sgst_making_paise)}</td></tr>`;
apps\api\src\modules\billing\invoice-pdf.service.ts:135:    <tr><td style="padding:4px 0;color:#57534e">Subtotal / कुल मूल्य</td><td style="padding:4px 0;text-align:right">₹${formatINR(invoice.subtotal_paise)}</td></tr>
apps\api\src\modules\billing\invoice-pdf.service.ts:139:      <td style="padding:8px 0;text-align:right">₹${formatINR(invoice.total_paise)}</td>
apps\api\src\modules\pricing\pricing.controller.spec.ts:80:    it('returns base IBJA rates (paise as strings, source, stale)', async () => {
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:72:        if (sql.includes('FROM invoices WHERE id')) return Promise.resolve({ rows: [{ id: 'inv_001', status: 'ISSUED', total_paise: '10000000' }] });
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:73:        if (sql.includes('SUM(amount_paise)')) return Promise.resolve({ rows: [{ paid: '0' }] });
apps\api\src\modules\billing\payment.service.spec.ts:45:        // pg returns BIGINT as string — mirror that in the mock
apps\api\src\modules\billing\payment.service.spec.ts:46:        return { rows: [{ cash_total_paise: existingPaise.toString() }] };
apps\api\src\modules\billing\payment.service.spec.ts:48:      if (sql.includes('SUM(cash_total_paise)')) {
apps\api\src\modules\billing\payment.service.spec.ts:58:      if (sql.includes('SUM(amount_paise)')) {
apps\api\src\modules\billing\payment.service.spec.ts:84:const INVOICE_ROW = { id: INVOICE, status: 'ISSUED', total_paise: '100000000', customer_id: null, customer_phone: '+919999999999' };
apps\api\src\modules\billing\share.service.ts:8:function formatINR(paise: bigint | string | number): string {
apps\api\src\modules\billing\share.service.ts:9:  return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(paise) / 100)}`;
apps\api\src\modules\billing\share.service.ts:47:    const { invoice_number, customer_name, customer_phone, total_paise, issued_at } = data.invoice;
apps\api\src\modules\billing\share.service.ts:48:    const total = formatINR(total_paise);
apps\api\src\modules\billing\payment.service.ts:49:    (shop_id, customer_id, customer_phone, aggregate_date, aggregate_month, cash_total_paise, invoice_count)
apps\api\src\modules\billing\payment.service.ts:59:  RETURNING cash_total_paise,
apps\api\src\modules\billing\payment.service.ts:64:// Idempotency check: validates key + invoice_id + amount_paise so a client
apps\api\src\modules\billing\payment.service.ts:71:    AND amount_paise    = $3
apps\api\src\modules\billing\payment.service.ts:76:  SELECT COALESCE(SUM(cash_total_paise), 0)::text AS monthly_total
apps\api\src\modules\billing\payment.service.ts:181:        total_paise: string;
apps\api\src\modules\billing\payment.service.ts:185:        `SELECT id, status, total_paise, customer_id, customer_phone FROM invoices WHERE id = $1 FOR UPDATE`,
apps\api\src\modules\billing\payment.service.ts:191:      const { status, total_paise, customer_id: customerId, customer_phone: rawPhone } = invRes.rows[0];
apps\api\src\modules\billing\payment.service.ts:205:      const aggRes = await tx.query<{ cash_total_paise: string; aggregate_date: string; aggregate_month: string }>(
apps\api\src\modules\billing\payment.service.ts:209:      const existingDailyPaise = BigInt(aggRes.rows[0]?.cash_total_paise ?? '0');
apps\api\src\modules\billing\payment.service.ts:232:        `SELECT COALESCE(SUM(amount_paise), 0)::text AS paid,
apps\api\src\modules\billing\payment.service.ts:243:      const invoiceTotalPaise = BigInt(total_paise);
apps\api\src\modules\billing\payment.service.ts:302:             (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, idempotency_key)
apps\api\src\modules\billing\payment.service.ts:434:      const inv = await tx.query<{ id: string; status: string; total_paise: string }>(
apps\api\src\modules\billing\payment.service.ts:435:        `SELECT id, status, total_paise FROM invoices WHERE id = $1 FOR SHARE`,
apps\api\src\modules\billing\payment.service.ts:441:        `SELECT COALESCE(SUM(amount_paise), 0)::text AS paid FROM payments WHERE invoice_id = $1 AND status = 'CONFIRMED'`,
apps\api\src\modules\billing\payment.service.ts:445:      const remaining = BigInt(inv.rows[0].total_paise) - paidPaise;
apps\api\src\modules\billing\payment.service.ts:452:      await tx.query(`INSERT INTO payments (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, razorpay_order_id, webhook_status) VALUES (current_setting('app.current_shop_id', true)::uuid, $1, 'UPI', $2, 'PENDING', $3, $4, 'PENDING')`, [invoiceId, amountPaise, ctx.userId, orderId]);
apps\api\src\modules\billing\payment.service.ts:461:      const invRes = await tx.query<{ id: string; status: string; total_paise: string }>(`SELECT id, status, total_paise FROM invoices WHERE id = $1 FOR UPDATE`, [invoiceId]);
apps\api\src\modules\billing\payment.service.ts:464:      const paidRes = await tx.query<{ paid: string }>(`SELECT COALESCE(SUM(amount_paise), 0)::text AS paid FROM payments WHERE invoice_id = $1 AND status = 'CONFIRMED'`, [invoiceId]);
apps\api\src\modules\billing\payment.service.ts:466:      const remaining = BigInt(invRes.rows[0].total_paise) - paidPaise;
apps\api\src\modules\billing\payment.service.ts:468:      const res = await tx.query<{ id: string }>(`INSERT INTO payments (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, webhook_status) VALUES (current_setting('app.current_shop_id', true)::uuid, $1, $2, $3, 'CONFIRMED', $4, 'NA') RETURNING id`, [invoiceId, dto.method, dto.amountPaise, ctx.userId]);
apps\api\src\modules\billing\payment.service.ts:581:        const res = await tx.query<{ id: string; invoice_id: string; shop_id: string; method: string; amount_paise: string; status: string; razorpay_order_id: string | null; razorpay_payment_id: string | null; webhook_status: string; recorded_at: Date; }>(`SELECT id, invoice_id, shop_id, method, amount_paise, status, razorpay_order_id, razorpay_payment_id, webhook_status, recorded_at FROM payments WHERE invoice_id = $1 ORDER BY recorded_at ASC`, [invoiceId]);
apps\api\src\modules\billing\payment.service.ts:582:        resolve(res.rows.map(r => ({ id: r.id, invoiceId: r.invoice_id, shopId: r.shop_id, method: r.method, amountPaise: r.amount_paise, status: r.status, razorpayOrderId: r.razorpay_order_id ?? undefined, razorpayPaymentId: r.razorpay_payment_id ?? undefined, webhookStatus: r.webhook_status, recordedAt: r.recorded_at })));
apps\api\src\modules\billing\urd.service.ts:30:  agreed_rate_paise:     bigint;
apps\api\src\modules\billing\urd.service.ts:31:  gold_value_paise:      bigint;
apps\api\src\modules\billing\urd.service.ts:32:  rcm_gst_paise:         bigint;
apps\api\src\modules\billing\urd.service.ts:33:  net_to_customer_paise: bigint;
apps\api\src\modules\billing\urd.service.ts:53:    agreedRatePaise: r.agreed_rate_paise.toString(), goldValuePaise: r.gold_value_paise.toString(),
apps\api\src\modules\billing\urd.service.ts:54:    rcmGstPaise: r.rcm_gst_paise.toString(), netToCustomerPaise: r.net_to_customer_paise.toString(),
apps\api\src\modules\billing\urd.service.ts:62:  agreed_rate_paise, gold_value_paise, rcm_gst_paise, net_to_customer_paise,
apps\api\src\modules\billing\urd.service.ts:97:            agreed_rate_paise, gold_value_paise, rcm_gst_paise, net_to_customer_paise,
apps\api\src\modules\billing\urd.service.ts:126:      const urdRes = await tx.query<{ id: string; linked_invoice_id: string | null; net_to_customer_paise: bigint }>(
apps\api\src\modules\billing\urd.service.ts:127:        'SELECT id, linked_invoice_id, net_to_customer_paise FROM urd_purchases WHERE id = $1 FOR UPDATE',
apps\api\src\modules\billing\urd.service.ts:133:      const invRes = await tx.query<{ id: string; status: string; total_paise: string }>(
apps\api\src\modules\billing\urd.service.ts:134:        `SELECT id, status, total_paise FROM invoices WHERE id = $1 FOR UPDATE`, [invoiceId],
apps\api\src\modules\billing\urd.service.ts:139:        `SELECT COALESCE(SUM(amount_paise),0)::text AS paid FROM payments WHERE invoice_id = $1 AND status = 'CONFIRMED'`,
apps\api\src\modules\billing\urd.service.ts:142:      const remaining = BigInt(invRes.rows[0].total_paise) - BigInt(paidRes.rows[0]?.paid ?? '0');
apps\api\src\modules\billing\urd.service.ts:143:      if (BigInt(urd.net_to_customer_paise) > remaining) throw new UnprocessableEntityException({ code: 'payment.exceeds_balance' });
apps\api\src\modules\billing\urd.service.ts:149:        `INSERT INTO payments (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, webhook_status)
apps\api\src\modules\billing\urd.service.ts:151:        [invoiceId, urd.net_to_customer_paise, ctx.userId],
apps\api\src\modules\billing\void.service.ts:31:  total_paise:          bigint;
apps\api\src\modules\billing\void.service.ts:56:    totalPaise:        cn.total_paise.toString(),
apps\api\src\modules\billing\void.service.ts:67:  status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
apps\api\src\modules\billing\void.service.ts:68:  cgst_metal_paise, sgst_metal_paise, cgst_making_paise, sgst_making_paise,
apps\api\src\modules\billing\void.service.ts:69:  igst_metal_paise, igst_making_paise,
apps\api\src\modules\billing\void.service.ts:156:      const payRes = await tx.query<{ amount_paise: bigint; recorded_at: Date }>(
apps\api\src\modules\billing\void.service.ts:157:        `SELECT amount_paise, recorded_at
apps\api\src\modules\billing\void.service.ts:172:           SET cash_total_paise = GREATEST(0, cash_total_paise - $1),
apps\api\src\modules\billing\void.service.ts:181:          [pay.amount_paise, aggDateStr,
apps\api\src\modules\billing\void.service.ts:215:      const invRes = await tx.query<{ id: string; status: string; issued_at: Date | null; total_paise: bigint; shop_id: string }>(
apps\api\src\modules\billing\void.service.ts:216:        `SELECT id, status, issued_at, total_paise, shop_id FROM invoices WHERE id = $1`,
apps\api\src\modules\billing\void.service.ts:244:             (shop_id, original_invoice_id, credit_number, reason, total_paise, issued_by_user_id)
apps\api\src\modules\billing\void.service.ts:247:           RETURNING id, shop_id, original_invoice_id, credit_number, reason, total_paise,
apps\api\src\modules\billing\void.service.ts:249:          [originalInvoiceId, creditNumber, dto.reason, invoice.total_paise, ctx.userId],
apps\api\src\modules\billing\void.service.spec.ts:28:    subtotal_paise: 100_000n, gst_metal_paise: 3_000n, gst_making_paise: 600n,
apps\api\src\modules\billing\void.service.spec.ts:29:    total_paise: 103_600n,
apps\api\src\modules\billing\void.service.spec.ts:30:    cgst_metal_paise: 0n, sgst_metal_paise: 0n, cgst_making_paise: 0n,
apps\api\src\modules\billing\void.service.spec.ts:31:    sgst_making_paise: 0n, igst_metal_paise: 0n, igst_making_paise: 0n,
apps\api\src\modules\billing\void.service.spec.ts:36:    tcs_collected_paise: 0n,
apps\api\src\modules\billing\void.service.spec.ts:162:    const pool = makePool([{ rows: [{ id: 'inv-1', status: 'ISSUED', issued_at: issuedAt(60 * 60 * 1000), total_paise: 100_000n, shop_id: SHOP }] }]);
apps\api\src\modules\billing\void.service.spec.ts:178:      reason: 'test', total_paise: 100_000n,
apps\api\src\modules\billing\void.service.spec.ts:182:      { rows: [{ id: 'inv-1', status: 'ISSUED', issued_at: oldIssuedAt, total_paise: 100_000n, shop_id: SHOP }] },
apps\api\src\modules\billing\void.service.spec.ts:200:        .mockResolvedValueOnce({ rows: [{ id: 'inv-1', status: 'ISSUED', issued_at: oldIssuedAt, total_paise: 100_000n, shop_id: SHOP }] })
packages\db\src\schema\custom-orders.ts:9:  quoted_amount_paise:     bigint('quoted_amount_paise', { mode: 'bigint' }),
packages\db\src\schema\custom-orders.ts:10:  deposit_amount_paise:    bigint('deposit_amount_paise', { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\custom-orders.ts:11:  deposit_paid_paise:      bigint('deposit_paid_paise', { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\credit-notes.ts:9:  total_paise:          bigint('total_paise', { mode: 'bigint' }).notNull(),
packages\db\src\schema\urd-purchases.ts:13:  agreed_rate_paise:    bigint('agreed_rate_paise',     { mode: 'bigint' }).notNull(),
packages\db\src\schema\urd-purchases.ts:14:  gold_value_paise:     bigint('gold_value_paise',      { mode: 'bigint' }).notNull(),
packages\db\src\schema\urd-purchases.ts:15:  rcm_gst_paise:        bigint('rcm_gst_paise',         { mode: 'bigint' }).notNull(),
packages\db\src\schema\urd-purchases.ts:16:  net_to_customer_paise: bigint('net_to_customer_paise', { mode: 'bigint' }).notNull(),
apps\api\src\modules\platform-admin\services\data-export.service.ts:69:                status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
apps\api\src\modules\platform-admin\services\data-export.service.ts:77:        `SELECT id, shop_id, invoice_id, method, amount_paise, status,
apps\api\src\modules\inventory\inventory.valuation.service.test.ts:28:// 9g net at 22K ₹6,000/g = 5,400,000 paise
apps\api\src\modules\inventory\inventory.valuation.service.test.ts:51:  it('computes correct paise for a 22K product at 9g', async () => {
apps\api\src\modules\inventory\inventory.valuation.service.test.ts:53:    // 9g × 600,000 paise/g = 5,400,000 paise
apps\api\src\modules\inventory\inventory.valuation.service.test.ts:120:    // (9 + 6) g × 600,000 = 9,000,000 paise
apps\api\src\modules\platform-admin\services\subscription.service.spec.ts:55:          mrr_paise: '0',
apps\api\src\modules\platform-admin\services\subscription.service.ts:62:        `INSERT INTO platform_subscriptions (shop_id, plan, status, mrr_paise, billing_cycle_start)
apps\api\src\modules\platform-admin\services\subscription.service.ts:67:               mrr_paise = EXCLUDED.mrr_paise,
apps\api\src\modules\platform-admin\services\subscription.service.ts:96:        mrr_paise: string;
apps\api\src\modules\platform-admin\services\subscription.service.ts:98:        `SELECT s.id, s.shop_id, sh.display_name, s.plan, s.status, s.mrr_paise
apps\api\src\modules\platform-admin\services\subscription.service.ts:109:        mrrPaise: Number(x.mrr_paise),
packages\db\src\schema\tenant-sync-cursors.ts:9:  cursor: bigint('cursor', { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\sync-change-log.ts:7:  seq: bigint('seq', { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoice-items.ts:16:  rate_per_gram_paise:   bigint('rate_per_gram_paise',    { mode: 'bigint' }),
packages\db\src\schema\invoice-items.ts:18:  gold_value_paise:      bigint('gold_value_paise',       { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoice-items.ts:19:  making_charge_paise:   bigint('making_charge_paise',    { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoice-items.ts:20:  stone_charges_paise:   bigint('stone_charges_paise',    { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoice-items.ts:21:  hallmark_fee_paise:    bigint('hallmark_fee_paise',     { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoice-items.ts:22:  gst_metal_paise:       bigint('gst_metal_paise',        { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoice-items.ts:23:  gst_making_paise:      bigint('gst_making_paise',       { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoice-items.ts:24:  line_total_paise:      bigint('line_total_paise',       { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoices.ts:16:  subtotal_paise:       bigint('subtotal_paise',     { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoices.ts:17:  gst_metal_paise:      bigint('gst_metal_paise',    { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoices.ts:18:  gst_making_paise:     bigint('gst_making_paise',   { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoices.ts:19:  total_paise:          bigint('total_paise',        { mode: 'bigint' }).notNull(),
packages\db\src\schema\invoices.ts:35:  cgst_metal_paise:     bigint('cgst_metal_paise',   { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoices.ts:36:  sgst_metal_paise:     bigint('sgst_metal_paise',   { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoices.ts:37:  cgst_making_paise:    bigint('cgst_making_paise',  { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoices.ts:38:  sgst_making_paise:    bigint('sgst_making_paise',  { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoices.ts:39:  igst_metal_paise:     bigint('igst_metal_paise',   { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoices.ts:40:  igst_making_paise:    bigint('igst_making_paise',  { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\invoices.ts:42:  tcs_collected_paise:  bigint('tcs_collected_paise', { mode: 'bigint' }).notNull().default(0n),
packages\db\src\migrations\0015_rates_foundation.sql:6:  gold_24k_paise bigint NOT NULL,
packages\db\src\migrations\0015_rates_foundation.sql:7:  gold_22k_paise bigint NOT NULL,
packages\db\src\migrations\0015_rates_foundation.sql:8:  gold_20k_paise bigint NOT NULL,
packages\db\src\migrations\0015_rates_foundation.sql:9:  gold_18k_paise bigint NOT NULL,
packages\db\src\migrations\0015_rates_foundation.sql:10:  gold_14k_paise bigint NOT NULL,
packages\db\src\migrations\0015_rates_foundation.sql:11:  silver_999_paise bigint NOT NULL,
packages\db\src\migrations\0015_rates_foundation.sql:12:  silver_925_paise bigint NOT NULL,
packages\db\src\schema\payments.ts:9:  amount_paise:          bigint('amount_paise', { mode: 'bigint' }).notNull(),
packages\db\src\migrations\0017_rate_overrides.sql:11:  override_paise BIGINT NOT NULL CHECK (override_paise > 0),
packages\db\src\schema\pmla-aggregates.ts:14:  cashTotalPaise: bigint('cash_total_paise', { mode: 'bigint' }).notNull().default(0n),
packages\db\src\schema\shop-rate-overrides.ts:13:    overridePaise: bigint('override_paise', { mode: 'bigint' }).notNull(),
packages\db\src\migrations\0019_sync_infrastructure.sql:8:  cursor     BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0019_sync_infrastructure.sql:18:  seq        BIGINT NOT NULL,
packages\db\src\migrations\0022_billing.sql:22:  subtotal_paise     BIGINT NOT NULL CHECK (subtotal_paise   >= 0),
packages\db\src\migrations\0022_billing.sql:23:  gst_metal_paise    BIGINT NOT NULL CHECK (gst_metal_paise  >= 0),
packages\db\src\migrations\0022_billing.sql:24:  gst_making_paise   BIGINT NOT NULL CHECK (gst_making_paise >= 0),
packages\db\src\migrations\0022_billing.sql:25:  total_paise        BIGINT NOT NULL CHECK (total_paise      >  0),
packages\db\src\migrations\0022_billing.sql:45:  rate_per_gram_paise   BIGINT,
packages\db\src\migrations\0022_billing.sql:47:  gold_value_paise      BIGINT NOT NULL CHECK (gold_value_paise      >= 0),
packages\db\src\migrations\0022_billing.sql:48:  making_charge_paise   BIGINT NOT NULL CHECK (making_charge_paise   >= 0),
packages\db\src\migrations\0022_billing.sql:49:  stone_charges_paise   BIGINT NOT NULL DEFAULT 0 CHECK (stone_charges_paise >= 0),
packages\db\src\migrations\0022_billing.sql:50:  hallmark_fee_paise    BIGINT NOT NULL DEFAULT 0 CHECK (hallmark_fee_paise  >= 0),
packages\db\src\migrations\0022_billing.sql:51:  gst_metal_paise       BIGINT NOT NULL CHECK (gst_metal_paise       >= 0),
packages\db\src\migrations\0022_billing.sql:52:  gst_making_paise      BIGINT NOT NULL CHECK (gst_making_paise      >= 0),
packages\db\src\migrations\0022_billing.sql:53:  line_total_paise      BIGINT NOT NULL CHECK (line_total_paise      >  0),
packages\db\src\migrations\0022_billing.sql:64:  amount_paise       BIGINT NOT NULL CHECK (amount_paise > 0),
packages\db\src\migrations\0024_pmla_aggregates.sql:14:  cash_total_paise BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0025_invoice_b2b.sql:9:  ADD COLUMN cgst_metal_paise    BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0025_invoice_b2b.sql:10:  ADD COLUMN sgst_metal_paise    BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0025_invoice_b2b.sql:11:  ADD COLUMN cgst_making_paise   BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0025_invoice_b2b.sql:12:  ADD COLUMN sgst_making_paise   BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0025_invoice_b2b.sql:13:  ADD COLUMN igst_metal_paise    BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0025_invoice_b2b.sql:14:  ADD COLUMN igst_making_paise   BIGINT NOT NULL DEFAULT 0;
packages\db\src\migrations\0026_invoice_void.sql:13:  total_paise         BIGINT NOT NULL,
packages\db\src\migrations\0030_urd_purchases.sql:13:  agreed_rate_paise     BIGINT NOT NULL CHECK (agreed_rate_paise > 0),
packages\db\src\migrations\0030_urd_purchases.sql:14:  gold_value_paise      BIGINT NOT NULL,
packages\db\src\migrations\0030_urd_purchases.sql:15:  rcm_gst_paise         BIGINT NOT NULL,
packages\db\src\migrations\0030_urd_purchases.sql:16:  net_to_customer_paise BIGINT NOT NULL,
packages\db\src\migrations\0032_customer_balances.sql:10:  outstanding_paise BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0032_customer_balances.sql:11:  advance_paise     BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0039_tcs_on_invoices.sql:3:-- exceeding Rs 2,00,000. Adds tcs_collected_paise column to invoices.
packages\db\src\migrations\0039_tcs_on_invoices.sql:5:-- BIGINT (paise, integer-exact). DEFAULT 0 so existing rows are valid (pre-law invoices).
packages\db\src\migrations\0039_tcs_on_invoices.sql:11:  ADD COLUMN tcs_collected_paise BIGINT NOT NULL DEFAULT 0
packages\db\src\migrations\0039_tcs_on_invoices.sql:12:    CONSTRAINT invoices_tcs_collected_paise_check CHECK (tcs_collected_paise >= 0);
packages\db\src\migrations\0042_estimates.sql:13:  gold_rate_paise_per_gram   BIGINT NOT NULL,
packages\db\src\migrations\0042_estimates.sql:14:  subtotal_paise             BIGINT NOT NULL,
packages\db\src\migrations\0042_estimates.sql:15:  gst_paise                  BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0042_estimates.sql:16:  total_paise                BIGINT NOT NULL,
packages\db\src\migrations\0044_custom_orders.sql:19:  quoted_amount_paise     BIGINT CHECK (quoted_amount_paise IS NULL OR quoted_amount_paise >= 0),
packages\db\src\migrations\0044_custom_orders.sql:20:  deposit_amount_paise    BIGINT NOT NULL DEFAULT 0 CHECK (deposit_amount_paise >= 0),
packages\db\src\migrations\0044_custom_orders.sql:21:  deposit_paid_paise      BIGINT NOT NULL DEFAULT 0 CHECK (deposit_paid_paise >= 0),
packages\db\src\migrations\0045_rate_lock_bookings.sql:11:  locked_rate_24k_paise_per_gram  BIGINT NOT NULL,
packages\db\src\migrations\0045_rate_lock_bookings.sql:14:  deposit_amount_paise            BIGINT NOT NULL CHECK (deposit_amount_paise > 0),
packages\db\src\migrations\0045_rate_lock_bookings.sql:15:  deposit_paid_paise              BIGINT NOT NULL DEFAULT 0,
packages\db\src\migrations\0053_platform_subscriptions.sql:13:  mrr_paise            BIGINT NOT NULL DEFAULT 0 CHECK (mrr_paise >= 0),
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "shop_manager|shop_admin|shop_staff" packages apps docs -n --max-count 100' in C:\Alok\Business Projects\Goldsmith
 succeeded in 436ms:
docs\runbook.md:385:  --role shop_admin
docs\reviews\codex-2026-04-20-story-2.5-manual.md:27:- Auth guards on GET (shop_admin|shop_manager) and PATCH (shop_admin only) — correct RBAC
docs\reviews\codex-analytics-20260429-2000.md:1748:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-analytics-20260429-2000.md:2654:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\reviews\codex-20260423-1405.md:1223:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1237:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1250:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1260:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1274:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1287:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1301:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1314:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1328:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1341:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1405.md:1355:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-story-17.1-spec-round6-20260501.md:414: 3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
docs\reviews\codex-story-17.1-spec-round6-20260501.md:530:       Guards: FirebaseJwtGuard ƒ+' TenantInterceptor ƒ+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round6-20260501.md:621:207:       Guards: FirebaseJwtGuard ??? TenantInterceptor ??? @Roles('shop_admin', 'shop_manager')
docs\runbooks\mass-customer-deletion-request.md:17:| Soft-delete customer (PII scrub) | On verified request | OWNER (shop_admin) via shopkeeper app |
docs\runbooks\mass-customer-deletion-request.md:157:1. **Validate the request** — the shop owner (verified `shop_admin` user with
docs\reviews\codex-story-17.1-spec-round5-20260501.md:342: 3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
docs\reviews\codex-story-17.1-spec-round5-20260501.md:618:       Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round5-20260501.md:994:3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:44:- `role: shop_admin` invite — restricted at API layer; unlocked in Story 1.3 with full `@Roles()` guard
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:89:  const roleLabel = role === 'shop_manager' ? 'Manager' : 'Staff';
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:126:**Auth:** Firebase ID token required. `TenantContext.role` must be `shop_admin` (inline check in `StaffService.invite()` until Story 1.3's `@Roles()` guard).
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:133:  role: 'shop_manager' | 'shop_staff';  // shop_admin excluded via IsEnum
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:144:    "role": "shop_staff",
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:160:| `role: shop_admin` in body | 400 | `staff.role_not_allowed` |
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:163:| Caller is not `shop_admin` | 403 | `auth.forbidden` |
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:178:      "role": "shop_staff",
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:238:  "role.shop_staff": "स्टाफ",
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:239:  "role.shop_manager": "मैनेजर",
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:267:  "after": { "role": "shop_staff", "status": "INVITED", "display_name": "Amit" },
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:281:| 26 | `role: shop_admin` rejected at DTO validation layer before hitting service logic | class-validator `IsEnum` + integration test asserting 400 |
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:287:- `StaffService.invite()` — happy path creates INVITED row + returns share text; duplicate ACTIVE phone → 409; duplicate INVITED phone → 201 re-invite; `shop_admin` role in body → 400; non-`shop_admin` caller → 403.
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:296:- Role restriction: POST with `role: shop_admin` → 400 `staff.role_not_allowed`.
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:297:- Non-owner caller: POST with `shop_manager` token → 403 `auth.forbidden`.
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:313:- # assume already logged in as shop_admin (session from auth-flow.yaml)
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:370:- **Given** the invite DTO contains `role: shop_admin`, **when** the request reaches the server, **then** 400 `staff.role_not_allowed` is returned before any DB write.
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:407:5. `shop_manager | shop_staff` only; `shop_admin` blocked at DTO layer
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:207:       Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:631:3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1569:       Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1919:3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
docs\reviews\codex-20260423-1657.md:48:+    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:62:+    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:80:+    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:94:+    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:112:+    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:126:+    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:230:+    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-20260423-1657.md:1925:+    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-20260423-1657.md:2272:+    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:2286:+    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:2304:+    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:2318:+    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:2336:+    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:2350:+    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\reviews\codex-20260423-1657.md:3231:+Then run each smoke test. Replace `$TOKEN` with a valid shop_admin Firebase ID token:
docs\reviews\codex-20260423-1657.md:4675:CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');
docs\reviews\codex-20260423-1657.md:4768:apps\api\test\auth-staff.integration.spec.ts:16://   • Two shops (SHOP_A, SHOP_B) each with one ACTIVE shop_admin
docs\reviews\codex-story-5.2-20260425-1636.md:42:+  @Roles('shop_admin')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:152:        Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:583: 3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
docs\reviews\codex-story-17.1-spec-round7-20260501.md:872:207:       Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1296:631:3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1385:        Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1825:apps/api/src/modules\settings\settings.try-at-home.spec.ts:53:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1828:apps/api/src/modules\settings\settings.try-at-home.spec.ts:157:      shopId: SHOP_A, userId: 'user-a', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1842:apps/api/src/modules\auth\guards\policy.guard.spec.ts:27:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1843:apps/api/src/modules\auth\guards\policy.guard.spec.ts:50:      authenticated: true, shopId, role: 'shop_admin', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1844:apps/api/src/modules\auth\guards\policy.guard.spec.ts:63:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1845:apps/api/src/modules\auth\guards\policy.guard.spec.ts:80:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1866:apps/api/src/modules\crm\occasions.service.spec.ts:24:  return { authenticated: true as const, shopId: SHOP, userId: USER, role: 'shop_admin' };
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1878:apps/api/src/modules\settings\settings.service.test.ts:15:  shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1901:apps/api/src/modules\settings\settings.service.loyalty.test.ts:69:  shopId: SHOP_ID, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1907:apps/api/src/modules\crm\notes.service.spec.ts:25:  return { authenticated: true as const, shopId: SHOP, userId, role: 'shop_admin' };
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1923:apps/api/src/modules\billing\payment.service.razorpay.spec.ts:12:  authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1924:apps/api/src/modules\billing\payment.service.razorpay.spec.ts:63:const CTX = { authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin' };
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1942:apps/api/src/modules\billing\void.service.spec.ts:76:      svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1943:apps/api/src/modules\billing\void.service.spec.ts:83:      svc.voidInvoice({ userId: MGR, role: 'shop_staff', shopId: SHOP }, 'inv-1', { reason: 'test' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1944:apps/api/src/modules\billing\void.service.spec.ts:90:      await svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' });
docs\reviews\codex-story-17.1-spec-round7-20260501.md:1945:apps/api/src/modules\billing\void.service.spec.ts:100:      svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2016:apps/api/src/modules\settings\settings.policies-notif.spec.ts:57:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2056:apps/api/src/modules\crm\crm.service.spec.ts:37:function authCtx(role = 'shop_admin') { return { authenticated: true as const, shopId: SHOP, userId: USER, role } as any; }
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2072:apps/api/src/modules\billing\billing.service.loyalty.spec.ts:11:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2073:apps/api/src/modules\billing\billing.service.loyalty.spec.ts:12:    current: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2084:apps/api/src/modules\inventory\barcode.integration.test.ts:48:    shopId: SHOP_A, userId: 'user-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2124:apps/api/src/modules\inventory\barcode.service.test.ts:42:    shopId: SHOP_ID, userId: 'user-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2140:apps/api/src/modules\inventory\inventory.service.test.ts:57:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2141:apps/api/src/modules\inventory\inventory.service.test.ts:60:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2164:apps/api/src/modules\inventory\inventory.valuation.service.test.ts:9:  shopId: SHOP_ID, userId: 'u1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2185:apps/api/src/modules\inventory\publish.integration.test.ts:58:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2186:apps/api/src/modules\inventory\publish.integration.test.ts:61:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2187:apps/api/src/modules\inventory\publish.integration.test.ts:84:      shopId: SHOP_B, userId: 'user-b', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2684: 3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2800:       Guards: FirebaseJwtGuard Т'+' TenantInterceptor Т'+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:2891:207:       Guards: FirebaseJwtGuard ??? TenantInterceptor ??? @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:3960:        Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:4391: 3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
docs\reviews\codex-story-17.1-spec-round7-20260501.md:4680:207:       Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5104:631:3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5193:        Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5633:apps/api/src/modules\settings\settings.try-at-home.spec.ts:53:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5636:apps/api/src/modules\settings\settings.try-at-home.spec.ts:157:      shopId: SHOP_A, userId: 'user-a', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5650:apps/api/src/modules\auth\guards\policy.guard.spec.ts:27:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5651:apps/api/src/modules\auth\guards\policy.guard.spec.ts:50:      authenticated: true, shopId, role: 'shop_admin', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5652:apps/api/src/modules\auth\guards\policy.guard.spec.ts:63:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5653:apps/api/src/modules\auth\guards\policy.guard.spec.ts:80:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5674:apps/api/src/modules\crm\occasions.service.spec.ts:24:  return { authenticated: true as const, shopId: SHOP, userId: USER, role: 'shop_admin' };
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5686:apps/api/src/modules\settings\settings.service.test.ts:15:  shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5709:apps/api/src/modules\settings\settings.service.loyalty.test.ts:69:  shopId: SHOP_ID, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5715:apps/api/src/modules\crm\notes.service.spec.ts:25:  return { authenticated: true as const, shopId: SHOP, userId, role: 'shop_admin' };
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5731:apps/api/src/modules\billing\payment.service.razorpay.spec.ts:12:  authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin',
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5732:apps/api/src/modules\billing\payment.service.razorpay.spec.ts:63:const CTX = { authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin' };
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5750:apps/api/src/modules\billing\void.service.spec.ts:76:      svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5751:apps/api/src/modules\billing\void.service.spec.ts:83:      svc.voidInvoice({ userId: MGR, role: 'shop_staff', shopId: SHOP }, 'inv-1', { reason: 'test' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5752:apps/api/src/modules\billing\void.service.spec.ts:90:      await svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' });
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5753:apps/api/src/modules\billing\void.service.spec.ts:100:      svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5824:apps/api/src/modules\settings\settings.policies-notif.spec.ts:57:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5864:apps/api/src/modules\crm\crm.service.spec.ts:37:function authCtx(role = 'shop_admin') { return { authenticated: true as const, shopId: SHOP, userId: USER, role } as any; }
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5880:apps/api/src/modules\billing\billing.service.loyalty.spec.ts:11:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5881:apps/api/src/modules\billing\billing.service.loyalty.spec.ts:12:    current: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5892:apps/api/src/modules\inventory\barcode.integration.test.ts:48:    shopId: SHOP_A, userId: 'user-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5932:apps/api/src/modules\inventory\barcode.service.test.ts:42:    shopId: SHOP_ID, userId: 'user-1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5948:apps/api/src/modules\inventory\inventory.service.test.ts:57:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5949:apps/api/src/modules\inventory\inventory.service.test.ts:60:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5972:apps/api/src/modules\inventory\inventory.valuation.service.test.ts:9:  shopId: SHOP_ID, userId: 'u1', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5993:apps/api/src/modules\inventory\publish.integration.test.ts:58:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5994:apps/api/src/modules\inventory\publish.integration.test.ts:61:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:5995:apps/api/src/modules\inventory\publish.integration.test.ts:84:      shopId: SHOP_B, userId: 'user-b', role: 'shop_admin', authenticated: true,
docs\reviews\codex-story-17.1-spec-round7-20260501.md:6492: 3. Log in as shop_admin D"+' navigate to product D"+' "DD,DD-?Dе+DD-?DA°DD-ГжD, (0/10)".
docs\reviews\codex-story-17.1-spec-round7-20260501.md:6608:       Guards: FirebaseJwtGuard DЫ'+' TenantInterceptor DЫ'+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:6699:207:       Guards: FirebaseJwtGuard ??? TenantInterceptor ??? @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round7-20260501.md:8477:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "shop_manager|shop_admin|shop_staff" packages apps docs -n --max-count 100' in C:\Alok\Business Projects\Goldsmith
docs\reviews\codex-story-17.1-spec-round3-20260501.md:840:TenantInterceptor  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round3-20260501.md:841:docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:549:3. Log in as shop_admin  navigate to 
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1062:       Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1404:3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
docs\reviews\codex-story-17.1-spec-round3-20260501.md:1911:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\reviews\codex-story-17.1-spec-round3-20260501.md:2105:       Guards: FirebaseJwtGuard ƒ+' TenantInterceptor ƒ+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-pr1.md:974:   --role shop_admin
docs\reviews\codex-pr1.md:2943:+CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');
docs\reviews\codex-pr1.md:3260:+export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\reviews\codex-pr1.md:3420:+      VALUES ('${SHOP_A}', '+91a', 'Alice A', 'shop_admin', 'ACTIVE');
docs\reviews\codex-pr1.md:3423:+      VALUES ('${SHOP_B}', '+91b', 'Bob B', 'shop_admin', 'ACTIVE');
docs\reviews\codex-pr1.md:3451:+            [SHOP_A, '+91c', 'X', 'shop_staff', 'ACTIVE']);
docs\reviews\codex-pr1.md:3971:+  readonly role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
docs\reviews\codex-pr1.md:4211:+          ($1,'+91AAA001','Alice A','shop_admin','ACTIVE'),
docs\reviews\codex-pr1.md:4212:+          ($1,'+91AAA002','Akhil A','shop_staff','ACTIVE')`,
docs\reviews\codex-pr1.md:4247:+          ($1,'+91BBB001','Bhavna B','shop_admin','ACTIVE'),
docs\reviews\codex-pr1.md:4248:+          ($1,'+91BBB002','Bhim B','shop_manager','ACTIVE')`,
docs\reviews\codex-pr1.md:4283:+          ($1,'+91CCC001','Chandra C','shop_admin','ACTIVE'),
docs\reviews\codex-pr1.md:4284:+          ($1,'+91CCC002','Charu C','shop_staff','ACTIVE')`,
docs\reviews\codex-pr1.md:14827:CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');
docs\reviews\codex-pr1.md:14940:  readonly role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
docs\reviews\codex-pr1.md:15676:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\reviews\codex-pr1.md:16540:      VALUES ('${SHOP_A}', '+91a', 'Alice A', 'shop_admin', 'ACTIVE');
docs\reviews\codex-pr1.md:16543:      VALUES ('${SHOP_B}', '+91b', 'Bob B', 'shop_admin', 'ACTIVE');
docs\reviews\codex-pr1.md:16571:            [SHOP_A, '+91c', 'X', 'shop_staff', 'ACTIVE']);
docs\reviews\codex-story-4.1-rerun.md:4306:    if (tc.role === 'shop_admin') return true;
docs\superpowers\specs\2026-04-18-story-1.1-auth-and-dashboard-design.md:697:3. `UPSERT shop_users` row by `(shop_id, phone)`: `role='shop_admin', status='INVITED', firebase_uid=NULL`. (Status will flip to ACTIVE + firebase_uid populated on first login.)
docs\superpowers\specs\2026-04-18-story-1.1-auth-and-dashboard-design.md:698:4. Print instructions: "Now open the Expo app, enter `<phone>`, receive OTP (check Firebase emulator console at http://localhost:4000), verify, and you'll land on the dashboard as shop_admin."
docs\reviews\codex-story-17.1-spec-round2-20260501.md:144:    fixed to 'shop_admin', 'shop_manager' matching existing inventory writes.
docs\reviews\codex-story-17.1-spec-round2-20260501.md:347:-       Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin','shopkeeper')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:348:+       Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:706: 3. Log in as shop_admin → navigate to product → "तस्वीरें (0/10)".
docs\reviews\codex-story-17.1-spec-round2-20260501.md:953:       Guards: FirebaseJwtGuard Г+' TenantInterceptor Г+' @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1286:3. Log in as shop_admin Г+' navigate to product Г+' "ЕЕ,ЕЭ?ЕцЕЭ?Е°ЕЭ╪Е, (0/10)".
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1427:    fixed to 'shop_admin', 'shop_manager' matching existing inventory writes.
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1476:-       Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin','shopkeeper')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1477:+       Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1842:apps\api\src\modules\inventory\inventory.controller.ts:47:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1843:apps\api\src\modules\inventory\inventory.controller.ts:56:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1844:apps\api\src\modules\inventory\inventory.controller.ts:80:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1845:apps\api\src\modules\inventory\inventory.controller.ts:90:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1846:apps\api\src\modules\inventory\inventory.controller.ts:100:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1847:apps\api\src\modules\inventory\inventory.controller.ts:114:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1848:apps\api\src\modules\inventory\inventory.controller.ts:124:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1849:apps\api\src\modules\inventory\inventory.controller.ts:135:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1850:apps\api\src\modules\inventory\inventory.controller.ts:147:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1853:apps\api\src\modules\inventory\inventory.controller.ts:161:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1854:apps\api\src\modules\inventory\inventory.controller.ts:172:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1855:apps\api\src\modules\inventory\inventory.controller.ts:183:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1856:apps\api\src\modules\inventory\inventory.controller.ts:194:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1857:apps\api\src\modules\inventory\inventory.controller.ts:206:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1858:apps\api\src\modules\inventory\inventory.controller.ts:217:  @Roles('shop_admin', 'shop_manager')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1859:apps\api\src\modules\inventory\inventory.controller.ts:228:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:1860:apps\api\src\modules\inventory\inventory.controller.ts:239:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\reviews\codex-story-17.1-spec-round2-20260501.md:3237:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\reviews\codex-story-17.1-spec-round2-20260501.md:3479:    fixed to 'shop_admin', 'shop_manager' matching existing inventory writes.
docs\reviews\codex-story-17.1-spec-round2-20260501.md:3600:    fixed to 'shop_admin', 'shop_manager' matching existing inventory writes.
docs\sprint-planning.md:32:- `GET /api/v1/inventory/valuation` — shop_admin|shop_manager, bigints as strings
docs\superpowers\specs\2026-04-19-story-1.4-design.md:29:RolesGuard provides coarse role-level gating via `@Roles('shop_admin')`. PolicyGuard provides fine-grained permission-key checks via `@Permission('billing.void')`. Both are registered as global guards in `AppModule` (RolesGuard first, PolicyGuard second). Both can decorate the same endpoint when needed. shop_admin always short-circuits PolicyGuard — no DB/cache lookup ever runs for admin.
docs\superpowers\specs\2026-04-19-story-1.4-design.md:35:Cache key: `shop:{shopId}:permissions:{role}` (e.g. `shop:abc123:permissions:shop_manager`).  
docs\superpowers\specs\2026-04-19-story-1.4-design.md:36:On PUT /auth/roles/:role/permissions, invalidate only that role's key. shop_admin has no cache entry (bypassed). The 60s TTL bounds worst-case staleness to 60s for any missed invalidation.
docs\superpowers\specs\2026-04-19-story-1.4-design.md:83:-- shop_manager defaults
docs\superpowers\specs\2026-04-19-story-1.4-design.md:85:SELECT s.id, 'shop_manager', k.key, k.enabled
docs\superpowers\specs\2026-04-19-story-1.4-design.md:97:-- shop_staff defaults
docs\superpowers\specs\2026-04-19-story-1.4-design.md:99:SELECT s.id, 'shop_staff', k.key, k.enabled
docs\superpowers\specs\2026-04-19-story-1.4-design.md:111:-- shop_admin: NOT seeded — PolicyGuard bypasses DB for admin role
docs\superpowers\specs\2026-04-19-story-1.4-design.md:146:  phone: string; role: 'shop_staff' | 'shop_manager'; displayName: string;
docs\superpowers\specs\2026-04-19-story-1.4-design.md:161:@Roles('shop_admin')
docs\superpowers\specs\2026-04-19-story-1.4-design.md:165:@Roles('shop_admin')
docs\superpowers\specs\2026-04-19-story-1.4-design.md:173:  @IsEnum(['shop_staff', 'shop_manager']) role: string;
docs\superpowers\specs\2026-04-19-story-1.4-design.md:203:@Roles('shop_admin')
docs\superpowers\specs\2026-04-19-story-1.4-design.md:207:@Roles('shop_admin')
docs\superpowers\specs\2026-04-19-story-1.4-design.md:221:1. If `role === 'shop_admin'` → 403 `{ code: 'auth.admin_permissions_immutable' }`.
docs\superpowers\specs\2026-04-19-story-1.4-design.md:278:    if (tc.role === 'shop_admin') return true;           // admin bypass
docs\superpowers\specs\2026-04-19-story-1.4-design.md:355:**Staff list** (`shop_admin` only — this screen is reachable only through settings navigation, which is admin-gated):
docs\superpowers\specs\2026-04-19-story-1.4-design.md:358:- "+ Staff जोड़ें" FAB — visible only to `shop_admin` — opens `BottomSheet` containing `StaffInviteForm`
docs\superpowers\specs\2026-04-19-story-1.4-design.md:360:**Permissions matrix** (visible only to `shop_admin`):
docs\superpowers\specs\2026-04-19-story-1.4-design.md:361:- One `SettingsGroupCard` per editable role (`shop_manager`, `shop_staff`)
docs\superpowers\specs\2026-04-19-story-1.4-design.md:380:  role: z.enum(['shop_staff', 'shop_manager']),
docs\superpowers\specs\2026-04-19-story-1.4-design.md:399:const role = user?.role ?? 'shop_staff';
docs\superpowers\specs\2026-04-19-story-1.4-design.md:401:// shop_admin: dashboard + billing + reports
docs\superpowers\specs\2026-04-19-story-1.4-design.md:402:// shop_manager: billing + reports
docs\superpowers\specs\2026-04-19-story-1.4-design.md:403:// shop_staff: billing only
docs\superpowers\specs\2026-04-19-story-1.4-design.md:454:| `PolicyGuard.canActivate()` — shop_admin bypass | `policy.guard.spec.ts` | No cache/DB lookup, returns true |
docs\superpowers\specs\2026-04-19-story-1.4-design.md:494:   - GET /auth/roles/shop_manager/permissions → 200 with matrix
docs\superpowers\specs\2026-04-19-story-1.4-design.md:496:   - PUT shop_admin permissions → 403
docs\superpowers\specs\2026-04-19-story-1.4-design.md:497:   - PolicyGuard: endpoint with @Permission('billing.void') + shop_manager JWT with is_enabled=false → 403
docs\superpowers\specs\2026-04-19-story-1.4-design.md:505:- `PERMISSIONS_UPDATED` — actor: shop_admin; metadata: `{ role, permissionKey, before, after }`
docs\superpowers\specs\2026-04-19-story-2.1-design.md:228:// Usage: @Roles('shop_admin') on controller methods.
docs\superpowers\specs\2026-04-19-story-2.1-design.md:235:| `shop_admin` | ✅ | ✅ | ✅ |
docs\superpowers\specs\2026-04-19-story-2.1-design.md:236:| `shop_manager` | ✅ | ❌ 403 | ❌ 403 |
docs\superpowers\specs\2026-04-19-story-2.1-design.md:237:| `shop_staff` | ❌ 403 | ❌ 403 | ❌ 403 |
docs\superpowers\specs\2026-04-19-story-2.1-design.md:239:**Domain rationale:** In Indian jewellery retail, only the owner (shop_admin) changes shop-identity information. A manager might need to look up the shop's GSTIN or operating hours for a customer query, hence read access. Staff have no settings access.
docs\superpowers\specs\2026-04-19-story-2.1-design.md:432:| MANAGER read-only | PATCH with `shop_manager` JWT → 403 |
docs\superpowers\specs\2026-04-19-story-2.1-design.md:433:| STAFF blocked | GET with `shop_staff` JWT → 403 |
docs\superpowers\specs\2026-04-19-story-1.3-design.md:54:  role: 'shop_manager' | 'shop_staff';
docs\superpowers\specs\2026-04-19-story-1.3-design.md:64:- `@Roles('shop_admin')` — guard blocks non-owners with `403 { code: 'auth.insufficient_role' }`
docs\superpowers\specs\2026-04-19-story-1.3-design.md:90:- `@TenantWalkerRoute()` + `@Roles('shop_admin', 'shop_manager')`
docs\superpowers\specs\2026-04-19-story-1.3-design.md:138:Action: Verify `RolesGuard` is registered globally (via `APP_GUARD`) or in `AuthModule`. If missing, add to `AuthModule` providers. Apply `@Roles('shop_admin')` to invite handler, `@Roles('shop_admin', 'shop_manager')` to staff list handler.
docs\superpowers\specs\2026-04-19-story-1.3-design.md:150:| shop_staff | ✓ | ✓ | — |
docs\superpowers\specs\2026-04-19-story-1.3-design.md:151:| shop_manager | ✓ | ✓ | ✓ |
docs\superpowers\specs\2026-04-19-story-1.3-design.md:152:| shop_admin | ✓ | ✓ | ✓ |
docs\superpowers\specs\2026-04-19-story-1.3-design.md:160:const isManagerOrOwner = role === 'shop_manager' || role === 'shop_admin';
docs\superpowers\specs\2026-04-19-story-1.3-design.md:249:| `RolesGuard` blocks shop_manager on invite | Unit | Already covered by existing guard tests; add invite-specific integration case |
docs\superpowers\specs\2026-04-20-story-2.4-loyalty-config-design.md:229:GET  /api/v1/settings/loyalty  — shop_admin + shop_manager
docs\superpowers\specs\2026-04-20-story-2.4-loyalty-config-design.md:230:PATCH /api/v1/settings/loyalty — shop_admin only
docs\superpowers\specs\2026-04-20-story-1.6-1.7-audit-trail-logout-all-design.md:124:**Auth:** `@Roles('shop_admin', 'shop_manager')` via existing `PolicyGuard`. `shop_staff` → 403 (no special handling needed — RolesGuard rejects before handler).
docs\superpowers\specs\2026-04-20-story-1.6-1.7-audit-trail-logout-all-design.md:209:@Roles('shop_admin')
docs\superpowers\specs\2026-04-20-story-1.6-1.7-audit-trail-logout-all-design.md:271:- Role gate at component top: if `user.role === 'shop_staff'` → render "आपको यह देखने की permission नहीं है" only, no API call
docs\superpowers\specs\2026-04-20-story-1.6-1.7-audit-trail-logout-all-design.md:380:- `shop_staff` role → `PolicyGuard` throws `ForbiddenException` (403)
docs\superpowers\specs\2026-04-20-story-1.6-1.7-audit-trail-logout-all-design.md:391:- GET `/audit-log` with `shop_staff` JWT → 403
docs\superpowers\specs\2026-04-20-story-1.5-staff-revocation-design.md:54:Guards: FirebaseJwtGuard → TenantInterceptor → @Roles('shop_admin')
docs\superpowers\specs\2026-04-20-story-1.5-staff-revocation-design.md:91:4. if row.role === 'shop_admin'                     → ForbiddenException 403
docs\superpowers\specs\2026-04-20-story-1.5-staff-revocation-design.md:107:@Roles('shop_admin')
docs\superpowers\specs\2026-04-20-story-1.5-staff-revocation-design.md:124:**"हटाएं" button:** rendered per staff row when `isAdmin && member.role !== 'shop_admin'`. Terracotta background, minimum 48×48dp touch target.
docs\superpowers\specs\2026-04-20-story-1.5-staff-revocation-design.md:165:| Unit: revoke shop_admin | same | throws `ForbiddenException` (403) |
docs\superpowers\specs\2026-04-19-story-2.2-design.md:39:- Auth: OWNER (`shop_admin`) or MANAGER (`shop_manager`)
docs\superpowers\specs\2026-04-19-story-2.2-design.md:46:- Auth: OWNER only (`shop_admin`)
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:692:                     VALUES ('11111111-1111-1111-1111-111111111111', '+919000000003', 'T', 'shop_admin', 'INVITED')
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1049:      authenticated: true, userId: 'u', role: 'shop_admin',
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1057:      authenticated: true, userId: 'u', role: 'shop_staff',
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1082:export type ShopUserRole = 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1191:        if (token === 'valid') return { uid: 'u1', phone_number: '+919000000001', shop_id: 'a', role: 'shop_admin' };
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1272:  role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1849:      authenticated: true, userId: args.userId, role: 'shop_admin',
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1863:      authenticated: true, userId: args.userId, role: 'shop_admin',
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:1878:      authenticated: true, userId: args.userId, role: 'shop_admin',
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:2446:         VALUES ($1, '+15555550001', 'Owner A', 'shop_admin', 'ACTIVE', 'firebase-uid-a')
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:2535:     VALUES ($1, $2, $3, 'shop_admin', 'INVITED')
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1343:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1572:CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1733:      VALUES ('${SHOP_A}', '+91a', 'Alice A', 'shop_admin', 'ACTIVE');
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1736:      VALUES ('${SHOP_B}', '+91b', 'Bob B', 'shop_admin', 'ACTIVE');
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1764:            [SHOP_A, '+91c', 'X', 'shop_staff', 'ACTIVE']);
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:1967:  readonly role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3673:          ($1,'+91AAA001','Alice A','shop_admin','ACTIVE'),
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3674:          ($1,'+91AAA002','Akhil A','shop_staff','ACTIVE')`,
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3707:          ($1,'+91BBB001','Bhavna B','shop_admin','ACTIVE'),
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3708:          ($1,'+91BBB002','Bhim B','shop_manager','ACTIVE')`,
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3741:          ($1,'+91CCC001','Chandra C','shop_admin','ACTIVE'),
docs\superpowers\plans\2026-04-18-E2-S1-tenant-rls-scaffolding.md:3742:          ($1,'+91CCC002','Charu C','shop_staff','ACTIVE')`,
apps\shopkeeper\e2e\story-1.3.stub.e2e.ts:5:  it.todo('shop_staff cannot see Reports tab');
apps\shopkeeper\e2e\story-1.3.stub.e2e.ts:6:  it.todo('shop_manager can see Reports tab');
apps\shopkeeper\e2e\story-1.3.stub.e2e.ts:7:  it.todo('shop_admin can see Reports tab');
apps\shopkeeper\e2e\story-1.3.stub.e2e.ts:8:  it.todo('invited staff logs in and session returns role: shop_staff');
apps\shopkeeper\e2e\staff-management-stubs.md:4:TODO: shop_admin navigates to Settings → Staff, fills InviteForm, submits, sees new user in list
apps\shopkeeper\e2e\staff-management-stubs.md:10:TODO: log in as shop_staff, verify Reports and Settings tabs are not visible in bottom tab bar
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:721:    expect(tenantContext.runWith(makeCtx('shop_manager'), () => guard.canActivate(execCtx))).toBe(true);
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:725:    const { reflector, execCtx } = makeExecCtx(['shop_admin']);
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:727:    expect(tenantContext.runWith(makeCtx('shop_admin'), () => guard.canActivate(execCtx))).toBe(true);
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:731:    const { reflector, execCtx } = makeExecCtx(['shop_admin']);
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:734:      tenantContext.runWith(makeCtx('shop_manager'), () => guard.canActivate(execCtx)),
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:739:    const { reflector, execCtx } = makeExecCtx(['shop_admin']);
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:744:  it('passes shop_manager for read role', () => {
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:745:    const { reflector, execCtx } = makeExecCtx(['shop_admin', 'shop_manager']);
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:747:    expect(tenantContext.runWith(makeCtx('shop_manager'), () => guard.canActivate(execCtx))).toBe(true);
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:1391:  shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:1630:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:1643:  @Roles('shop_admin')
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:1658:  @Roles('shop_admin')
docs\superpowers\plans\2026-04-19-story-2.1-shop-profile.md:1897:function makeCtx(role = 'shop_admin'): AuthenticatedTenantContext {
docs\superpowers\plans\2026-04-19-story-1.4.md:90:-- Dynamic per-role permission matrix. shop_admin is NOT seeded — PolicyGuard bypasses DB for admin.
docs\superpowers\plans\2026-04-19-story-1.4.md:111:-- Seed shop_manager defaults for all existing shops
docs\superpowers\plans\2026-04-19-story-1.4.md:113:SELECT s.id, 'shop_manager', k.key, k.enabled
docs\superpowers\plans\2026-04-19-story-1.4.md:125:-- Seed shop_staff defaults for all existing shops
docs\superpowers\plans\2026-04-19-story-1.4.md:127:SELECT s.id, 'shop_staff', k.key, k.enabled
docs\superpowers\plans\2026-04-19-story-1.4.md:173:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\superpowers\plans\2026-04-19-story-1.4.md:284:  role:         z.enum(['shop_staff', 'shop_manager']),
docs\superpowers\plans\2026-04-19-story-1.4.md:296:  role:        z.enum(['shop_manager', 'shop_staff']),
docs\superpowers\plans\2026-04-19-story-1.4.md:374:      expect(await cache.getPermissions('shop1', 'shop_manager')).toBeNull();
docs\superpowers\plans\2026-04-19-story-1.4.md:380:      expect(await cache.getPermissions('shop1', 'shop_manager')).toEqual(data);
docs\superpowers\plans\2026-04-19-story-1.4.md:386:      expect(await cache.getPermissions('shop1', 'shop_manager')).toBeNull();
docs\superpowers\plans\2026-04-19-story-1.4.md:387:      expect(del).toHaveBeenCalledWith('shop:shop1:permissions:shop_manager');
docs\superpowers\plans\2026-04-19-story-1.4.md:395:      await cache.setPermissions('shop1', 'shop_manager', { 'billing.create': true });
docs\superpowers\plans\2026-04-19-story-1.4.md:397:        'shop:shop1:permissions:shop_manager',
docs\superpowers\plans\2026-04-19-story-1.4.md:409:      await cache.invalidate('shop1', 'shop_manager');
docs\superpowers\plans\2026-04-19-story-1.4.md:410:      expect(del).toHaveBeenCalledWith('shop:shop1:permissions:shop_manager');
docs\superpowers\plans\2026-04-19-story-1.4.md:535:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\superpowers\plans\2026-04-19-story-1.4.md:555:  it('shop_admin bypasses — no cache or DB lookup', async () => {
docs\superpowers\plans\2026-04-19-story-1.4.md:558:      authenticated: true, shopId, role: 'shop_admin', tenant: {} as never, userId: 'u1',
docs\superpowers\plans\2026-04-19-story-1.4.md:571:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\superpowers\plans\2026-04-19-story-1.4.md:588:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\superpowers\plans\2026-04-19-story-1.4.md:603:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
docs\superpowers\plans\2026-04-19-story-1.4.md:616:    expect(setCache).toHaveBeenCalledWith(shopId, 'shop_manager', { 'reports.view': true });
docs\superpowers\plans\2026-04-19-story-1.4.md:621:      authenticated: true, shopId, role: 'shop_staff', tenant: {} as never, userId: 'u1',
docs\superpowers\plans\2026-04-19-story-1.4.md:668:    if (tc.role === 'shop_admin') return true;
docs\superpowers\plans\2026-04-19-story-1.4.md:741:      result = await repo.getPermissions('shop-1', 'shop_manager');
docs\superpowers\plans\2026-04-19-story-1.4.md:751:      result = await repo.getPermissions('shop-1', 'shop_manager');
docs\superpowers\plans\2026-04-19-story-1.4.md:825:           VALUES ($1, 'shop_manager', $2, $3) ON CONFLICT DO NOTHING`,
docs\superpowers\plans\2026-04-19-story-1.4.md:832:           VALUES ($1, 'shop_staff', $2, $3) ON CONFLICT DO NOTHING`,
docs\superpowers\plans\2026-04-19-story-1.4.md:890:        phone: '+919000001234', role: 'shop_staff', displayName: 'Test',
docs\superpowers\plans\2026-04-19-story-1.4.md:900:    const rows = [{ id: 'u1', display_name: 'Alice', role: 'shop_staff', status: 'ACTIVE', phone: '+919000001111', invited_at: null, activated_at: null }];
docs\superpowers\plans\2026-04-19-story-1.4.md:933:    role: 'shop_staff' | 'shop_manager';
docs\superpowers\plans\2026-04-19-story-1.4.md:1051:const ctx = { shopId: 'shop-1', tenant: fakeTenant, authenticated: true, userId: 'owner-id', role: 'shop_admin' as const };
docs\superpowers\plans\2026-04-19-story-1.4.md:1075:        phone: '+919000001234', role: 'shop_staff', displayName: 'Alice',
docs\superpowers\plans\2026-04-19-story-1.4.md:1088:          phone: '+919000001234', role: 'shop_staff', displayName: 'Alice',
docs\superpowers\plans\2026-04-19-story-1.4.md:1099:        phone: '+919000001234', role: 'shop_staff', displayName: 'Alice',
docs\superpowers\plans\2026-04-19-story-1.4.md:1142:    role: 'shop_staff' | 'shop_manager';
docs\superpowers\plans\2026-04-19-story-1.4.md:1254:  @Roles('shop_admin')
docs\superpowers\plans\2026-04-19-story-1.4.md:1272:  @Roles('shop_admin')
docs\superpowers\plans\2026-04-19-story-1.4.md:1281:  @Roles('shop_admin')
docs\superpowers\plans\2026-04-19-story-1.4.md:1288:    if (!['shop_manager', 'shop_staff'].includes(role)) {
docs\superpowers\plans\2026-04-19-story-1.4.md:1299:  @Roles('shop_admin')
docs\superpowers\plans\2026-04-19-story-1.4.md:1306:    if (role === 'shop_admin') {
docs\superpowers\plans\2026-04-19-story-1.4.md:1309:    if (!['shop_manager', 'shop_staff'].includes(role)) {
docs\superpowers\plans\2026-04-19-story-1.4.md:1333:      shopId, tenant, authenticated: true, userId: shopId, role: 'shop_admin',
docs\superpowers\plans\2026-04-19-story-1.4.md:1503:    `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, $2, 'Owner', 'shop_admin', 'INVITED')`,
docs\superpowers\plans\2026-04-19-story-1.4.md:1519:      .send({ phone: '+919000009100', role: 'shop_staff', display_name: 'New Staff' });
docs\superpowers\plans\2026-04-19-story-1.4.md:1530:      .send({ phone: '+919000009101', role: 'shop_staff', display_name: 'Dup' });
docs\superpowers\plans\2026-04-19-story-1.4.md:1534:      .send({ phone: '+919000009101', role: 'shop_staff', display_name: 'Dup2' });
docs\superpowers\plans\2026-04-19-story-1.4.md:1542:      `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, $2, 'Staff', 'shop_staff', 'INVITED')`,
docs\superpowers\plans\2026-04-19-story-1.4.md:1550:      .send({ phone: '+919000009103', role: 'shop_staff', display_name: 'Attempt' });
docs\superpowers\plans\2026-04-19-story-1.4.md:1576:    `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, $2, 'Owner', 'shop_admin', 'INVITED')`,
docs\superpowers\plans\2026-04-19-story-1.4.md:1582:      `INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled) VALUES ($1, 'shop_manager', $2, $3)`,
docs\superpowers\plans\2026-04-19-story-1.4.md:1593:describe('GET /api/v1/auth/roles/shop_manager/permissions', () => {
docs\superpowers\plans\2026-04-19-story-1.4.md:1596:      .get('/api/v1/auth/roles/shop_manager/permissions')
docs\superpowers\plans\2026-04-19-story-1.4.md:1604:describe('PUT /api/v1/auth/roles/shop_manager/permissions', () => {
docs\superpowers\plans\2026-04-19-story-1.4.md:1607:      .put('/api/v1/auth/roles/shop_manager/permissions')
docs\superpowers\plans\2026-04-19-story-1.4.md:1612:      .get('/api/v1/auth/roles/shop_manager/permissions')
docs\superpowers\plans\2026-04-19-story-1.4.md:1617:  it('PUT shop_admin permissions → 403', async () => {
docs\superpowers\plans\2026-04-19-story-1.4.md:1619:      .put('/api/v1/auth/roles/shop_admin/permissions')
docs\superpowers\plans\2026-04-19-story-1.4.md:1659:      `INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled) VALUES ($1, 'shop_manager', 'reports.view', false)`,
docs\superpowers\plans\2026-04-19-story-1.4.md:1671:      repo.upsertPermission(TENANT_A, 'shop_manager', 'reports.view', true),
docs\superpowers\plans\2026-04-19-story-1.4.md:1676:      repo.getPermissions(TENANT_B, 'shop_manager'),
docs\superpowers\plans\2026-04-19-story-1.4.md:1683:      `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, '+919000009999', 'TenantAUser', 'shop_staff', 'INVITED')`,
docs\superpowers\plans\2026-04-19-story-1.4.md:1790:{ method: 'GET',  path: '/api/v1/auth/roles/shop_manager/permissions',  expectedStatus: 403 },
docs\superpowers\plans\2026-04-19-story-1.4.md:1791:{ method: 'PUT',  path: '/api/v1/auth/roles/shop_manager/permissions',  expectedStatus: 403 },
docs\superpowers\plans\2026-04-19-story-1.4.md:2174:  const role = user?.role ?? 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.4.md:2176:  const isAdmin   = role === 'shop_admin';
docs\superpowers\plans\2026-04-19-story-1.4.md:2177:  const isManager = role === 'shop_manager';
docs\superpowers\plans\2026-04-19-story-1.4.md:2250:  role:         z.enum(['shop_staff', 'shop_manager']),
docs\superpowers\plans\2026-04-19-story-1.4.md:2261:    defaultValues: { phone: '+91', display_name: '', role: 'shop_staff' },
docs\superpowers\plans\2026-04-19-story-1.4.md:2320:        {(['shop_staff', 'shop_manager'] as const).map((r) => (
docs\superpowers\plans\2026-04-19-story-1.4.md:2334:                  {r === 'shop_staff' ? t('settings.staff.role.staff') : t('settings.staff.role.manager')}
docs\superpowers\plans\2026-04-19-story-1.4.md:2377:  role: 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.4.md:2483:  const label = role === 'shop_manager' ? t('settings.staff.role.manager') : t('settings.staff.role.staff');
docs\superpowers\plans\2026-04-19-story-1.4.md:2557:        <PermissionsMatrix role="shop_manager" />
docs\superpowers\plans\2026-04-19-story-1.4.md:2562:        <PermissionsMatrix role="shop_staff" />
docs\superpowers\plans\2026-04-19-story-1.4.md:2609://   2. OWNER toggles billing.void switch for shop_manager → switch reflects new state
docs\superpowers\plans\2026-04-19-story-1.4.md:2614:  it.todo('OWNER can toggle billing.void permission for shop_manager');
docs\superpowers\plans\2026-04-19-story-1.4.md:2615:  it.todo('shop_staff tab bar does not show dashboard or reports');
docs\superpowers\plans\2026-04-19-story-1.4.md:2698:  -d '{"phone":"+919000001234","role":"shop_staff","display_name":"Smoke Test"}' | jq .
docs\superpowers\plans\2026-04-19-story-1.4.md:2705:  -d '{"phone":"+919000001234","role":"shop_staff","display_name":"Dup"}' | jq .
docs\superpowers\plans\2026-04-19-story-1.4.md:2709:curl -s "$BASE/api/v1/auth/roles/shop_manager/permissions" \
docs\superpowers\plans\2026-04-19-story-1.4.md:2711:# Expected: {"role":"shop_manager","permissions":{"billing.create":true,"billing.void":false,...}}
docs\superpowers\plans\2026-04-19-story-1.4.md:2714:curl -s -X PUT "$BASE/api/v1/auth/roles/shop_manager/permissions" \
docs\superpowers\plans\2026-04-19-story-1.4.md:2721:curl -s "$BASE/api/v1/auth/roles/shop_manager/permissions" \
docs\superpowers\plans\2026-04-19-story-1.4.md:2725:# 6. PUT shop_admin permissions — expect 403
docs\superpowers\plans\2026-04-19-story-1.4.md:2726:curl -s -X PUT "$BASE/api/v1/auth/roles/shop_admin/permissions" \
docs\superpowers\plans\2026-04-19-story-1.4.md:2769:| PUT shop_admin permissions → 403 | WS-B | `role-permissions.integration.test.ts` |
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:108:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:244:  role: 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:310:        id: 'new-uuid', phone: '+919876543210', role: 'shop_staff',
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:315:        repo.insertInvited({ phone: '+919876543210', role: 'shop_staff', invitedByUserId: 'owner-uuid' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:325:        { id: 'u1', phone: '+911111111111', display_name: '+911111111111', role: 'shop_staff', status: 'ACTIVE', invited_at: null },
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:449:  shopId: SHOP_A, tenant, authenticated: true, userId: 'owner-uuid', role: 'shop_admin',
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:465:    id: 'invited-uuid', phone: '+919876543210', role: 'shop_staff',
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:497:      svc.invite({ phone: '+919876543210', role: 'shop_staff' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:501:      phone: '+919876543210', role: 'shop_staff', invitedByUserId: 'owner-uuid',
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:514:        svc.invite({ phone: '+919876543210', role: 'shop_staff' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:525:        svc.invite({ phone: '+919876543210', role: 'shop_staff' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:534:        svc.invite({ phone: '9876543210', role: 'shop_staff' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:543:        svc.invite({ phone: 'not-a-phone', role: 'shop_staff' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:594:async invite(args: { phone: string; role: 'shop_manager' | 'shop_staff' }): Promise<InvitedRow> {
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:728:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:737:    if (ctx.role !== 'shop_admin' && ctx.role !== 'shop_manager') {
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:837:  shopId: SHOP_A, tenant: tenantA, authenticated: true, userId: 'owner-a', role: 'shop_admin',
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:840:  shopId: SHOP_B, tenant: tenantB, authenticated: true, userId: 'owner-b', role: 'shop_admin',
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:857:      id: 'staff-uuid', phone: '+919876543210', role: 'shop_staff' as const,
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:878:      inviteSvc.invite({ phone: '+919876543210', role: 'shop_staff' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:902:          shopId: SHOP_A, userId: 'staff-uuid', role: 'shop_staff',
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:947:    expect(sessionResult.user.role).toBe('shop_staff');
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:960:      id: 'staff-in-a', phone: '+919876543210', role: 'shop_staff' as const,
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:985:      svcA.invite({ phone: '+919876543210', role: 'shop_staff' }),
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1325:  const isManagerOrOwner = role === 'shop_manager' || role === 'shop_admin';
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1363:git commit -m "feat(mobile): role-aware tab visibility — reports hidden for shop_staff"
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1383:  role: 'shop_admin' | 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1401:  role: 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1452:type Role = 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1456:  const [role, setRole] = useState<Role>('shop_staff');
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1503:        {(['shop_staff', 'shop_manager'] as Role[]).map((r) => (
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1509:            accessibilityLabel={r === 'shop_staff' ? t('auth.staff.role_staff') : t('auth.staff.role_manager')}
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1513:              {r === 'shop_staff' ? t('auth.staff.role_staff') : t('auth.staff.role_manager')}
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1660:  if (role === 'shop_admin')   return 'Owner';
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1661:  if (role === 'shop_manager') return t('auth.staff.role_manager');
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1672:    if (role !== undefined && role !== 'shop_admin') {
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1677:  if (role !== 'shop_admin') return <View />;
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1909:export OWNER_TOKEN="<paste Firebase ID token for shop_admin user>"
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1910:export STAFF_TOKEN="<paste Firebase ID token for shop_staff user>"
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1918:  -d '{"phone":"+919876543210","role":"shop_staff"}'
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1927:  -d '{"phone":"+919876543210","role":"shop_staff"}'
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1936:  -d '{"phone":"+919123456789","role":"shop_staff"}'
docs\superpowers\plans\2026-04-19-story-1.3-staff-invite-rbac.md:1955:#   - As shop_admin: should see dashboard tab (only — billing/reports are stubs with href:null or hidden)
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:12:**Goal:** Add a `DELETE /api/v1/auth/staff/:userId` endpoint (shop_admin only) that marks a staff member REVOKED in the DB and immediately invalidates their Firebase session via `revokeRefreshTokens()`; extend `staff.tsx` with a Hindi confirmation sheet and "हटाएं" button.
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:34:- Role guard: `@Roles('shop_admin')` on the controller method, not in service
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:212:          rows: [{ firebase_uid: 'fb-uid-1', role: 'shop_staff' }],
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:224:    expect(result).toEqual({ firebaseUid: 'fb-uid-1', role: 'shop_staff' });
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:250:        .mockResolvedValueOnce({ rows: [{ firebase_uid: null, role: 'shop_staff' }], rowCount: 1 })
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:260:    expect(result).toEqual({ firebaseUid: null, role: 'shop_staff' });
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:453:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:464:      targetRow: { firebaseUid: null, role: 'shop_staff' },
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:482:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:490:  it('throws ForbiddenException(403) when target is a shop_admin', async () => {
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:492:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_admin' },
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:501:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:542:  if (row.role === 'shop_admin') throw new ForbiddenException({ code: 'auth.cannot_revoke_admin' });
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:553:    authenticated: true, userId: callerUserId, role: 'shop_admin' as ShopUserRole,
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:619:@Roles('shop_admin')
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:692:git commit -m "feat(api): DELETE /auth/staff/:userId — shop_admin only, 204"
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:1082:    {isAdmin && member.role !== 'shop_admin' && (
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:1324:  'shop_staff',
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:1378:3. Verify no "हटाएं" button on the shop_admin row
docs\superpowers\plans\2026-04-20-story-1.5-staff-revocation.md:1401:| 403 if revoking shop_admin | WS-B | `auth.service.spec.ts` — ForbiddenException case |
docs\superpowers\plans\2026-04-19-story-2.3-wastage-config.md:748:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-19-story-2.3-wastage-config.md:762:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-19-story-2.3-wastage-config.md:1331:Obtain a valid JWT for `shop_admin` role. Replace `<JWT>` and `<BASE_URL>` below.
docs\superpowers\plans\2026-04-19-story-2.3-wastage-config.md:1398:- [ ] **Smoke test 5 — shop_manager can GET but not PATCH**
docs\superpowers\plans\2026-04-19-story-2.3-wastage-config.md:1401:# With shop_manager JWT:
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:24:5. `role: shop_admin` rejected at DTO layer via `IsEnum`
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:83:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:177:  "role.shop_staff": "स्टाफ",
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:178:  "role.shop_manager": "मैनेजर",
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:204:  "role.shop_staff": "Staff",
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:205:  "role.shop_manager": "Manager",
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:299:  it('accepts valid shop_staff body', async () => {
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:300:    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'Amit', role: 'shop_staff' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:305:  it('accepts valid shop_manager body', async () => {
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:306:    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'Priya', role: 'shop_manager' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:311:  it('rejects shop_admin role', async () => {
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:312:    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'X', role: 'shop_admin' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:318:    const dto = plainToInstance(InviteStaffDto, { phone: '+14155551234', display_name: 'X', role: 'shop_staff' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:324:    const dto = plainToInstance(InviteStaffDto, { phone: '+9198765', display_name: 'X', role: 'shop_staff' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:330:    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: '', role: 'shop_staff' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:336:    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'A'.repeat(101), role: 'shop_staff' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:358:export type InviteRole = 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:370:  @IsEnum(['shop_manager', 'shop_staff'], { message: 'role must be shop_manager or shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:384:  role: 'shop_admin' | 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:395:    role: 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:449:  return { shopId: TENANT_A.id, tenant: TENANT_A, authenticated: true, userId: OWNER_A_ID, role: 'shop_admin' };
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:483:    VALUES ('${OWNER_A_ID}', '${TENANT_A.id}', '+919000000001', 'Owner A', 'shop_admin', 'ACTIVE', now())
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:499:      repo.insertInvited({ phone: '+919876543210', displayName: 'Amit', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:504:    expect(result.role).toBe('shop_staff');
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:513:      VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919111111111', 'Active Staff', 'shop_staff', 'ACTIVE', now())
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:517:        repo.insertInvited({ phone: '+919111111111', displayName: 'X', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:525:      VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919222222222', 'Suspended', 'shop_staff', 'SUSPENDED', now())
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:529:        repo.insertInvited({ phone: '+919222222222', displayName: 'X', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:537:      VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919333333333', 'Revoked', 'shop_staff', 'REVOKED', now())
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:541:        repo.insertInvited({ phone: '+919333333333', displayName: 'X', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:552:       VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919444444444', 'Re-invite Me', 'shop_staff', 'INVITED', now() - INTERVAL '1 hour')
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:576:      shopId: TENANT_B.id, tenant: TENANT_B, authenticated: true, userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', role: 'shop_admin',
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:619:  role: 'shop_admin' | 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:759:const OWNER_CTX = { shopId: TENANT.id, tenant: TENANT, authenticated: true as const, userId: 'owner-uuid', role: 'shop_admin' as const };
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:760:const MGMT_CTX = { shopId: TENANT.id, tenant: TENANT, authenticated: true as const, userId: 'mgr-uuid', role: 'shop_manager' as const };
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:772:      role: 'shop_staff' as const, status: 'INVITED' as const,
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:778:      { phone: '+919876543210', display_name: 'Amit', role: 'shop_staff' },
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:789:  it('throws ForbiddenException if caller is not shop_admin', async () => {
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:791:      svc.invite({ phone: '+919876543210', display_name: 'Amit', role: 'shop_staff' }, MGMT_CTX),
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:799:      role: 'shop_manager' as const, status: 'INVITED' as const,
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:805:      { phone: '+919876543210', display_name: 'Amit', role: 'shop_manager' },
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:817:      svc.invite({ phone: '+919876543210', display_name: 'X', role: 'shop_staff' }, OWNER_CTX),
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:824:    const rows = [{ id: 'u1', display_name: 'Amit', phone_last4: '3210', role: 'shop_staff' as const, status: 'ACTIVE' as const, invited_at: null, activated_at: null }];
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:864:    if (ctx.role !== 'shop_admin') {
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:893:        role: row.role as 'shop_manager' | 'shop_staff',
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:897:      share: { text: buildShareText(ctx.tenant.display_name, row.display_name, row.role as 'shop_manager' | 'shop_staff') },
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:907:function buildShareText(tenantName: string, staffName: string, role: 'shop_manager' | 'shop_staff'): string {
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:908:  const roleLabel = role === 'shop_manager' ? 'Manager' : 'Staff';
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:953:let ownerToken: string;  // Firebase ID token for shop_admin (from emulator)
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:985:  // Seed shop + shop_admin user via Firebase emulator
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1026:    VALUES (gen_random_uuid(), '${shopId}', '+15555550010', 'Owner', 'shop_admin', 'INVITED', now())
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1052:      .send({ phone: '+919876500001', display_name: 'Amit', role: 'shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1061:  it('400: rejects shop_admin role', async () => {
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1065:      .send({ phone: '+919876500002', display_name: 'X', role: 'shop_admin' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1073:      .send({ phone: '+919876500003', role: 'shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1082:      .send({ phone: '+15555550010', display_name: 'Owner Again', role: 'shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1091:      .send({ phone: '+919876500005', display_name: 'Reinvite Me', role: 'shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1098:      .send({ phone: '+919876500005', display_name: 'Reinvite Me', role: 'shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1106:      .send({ phone: '+919876500004', display_name: 'X', role: 'shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1133:      .send({ phone: '+919876500099', display_name: 'Audit Test', role: 'shop_staff' })
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1644:        staff: [{ id: 'u1', display_name: 'Amit', phone_last4: '3210', role: 'shop_staff', status: 'INVITED', invited_at: new Date().toISOString(), activated_at: null }],
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1713:type InviteRole = 'shop_staff' | 'shop_manager';
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1724:  const [form, setForm] = useState<InviteForm>({ display_name: '', phone: '', role: 'shop_staff' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1751:        setForm({ display_name: '', phone: '', role: 'shop_staff' });
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1822:              {(['shop_staff', 'shop_manager'] as InviteRole[]).map((r) => (
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1835:                    marginRight: r === 'shop_staff' ? spacing.sm : 0,
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1898:>   role: 'shop_admin' | 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:2146:**Type consistency:** `ShopUserRow` defined in Task 4 repository, referenced in Task 5 service. `InviteStaffDto.role` typed as `InviteRole = 'shop_manager' | 'shop_staff'` in Task 3 DTO, referenced correctly in Task 4 repo + Task 5 service. `StaffListItemDto` defined in Task 3, returned by Task 4 repo, passed through Task 5 service + Task 6 controller. Consistent throughout.
docs\superpowers\plans\2026-04-23-story-2.6-try-at-home.md:401:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\superpowers\plans\2026-04-23-story-2.6-try-at-home.md:505:      shopId: SHOP_A, userId: 'user-a', role: 'shop_admin', authenticated: true,
docs\superpowers\plans\2026-04-23-story-2.6-try-at-home.md:695:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-23-story-2.6-try-at-home.md:709:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:742:  if (!['shop_admin', 'shop_manager'].includes(ctx.role))
docs\superpowers\plans\2026-04-19-story-2.2-making-charges.md:757:  if (ctx.role !== 'shop_admin')
apps\shopkeeper\src\components\StaffInviteForm.tsx:12:type Role = 'shop_staff' | 'shop_manager';
apps\shopkeeper\src\components\StaffInviteForm.tsx:31:  const [role, setRole] = useState<Role>('shop_staff');
apps\shopkeeper\src\components\StaffInviteForm.tsx:76:            accessibilityState={{ selected: role === 'shop_staff' }}
apps\shopkeeper\src\components\StaffInviteForm.tsx:79:              role === 'shop_staff' && styles.roleButtonSelected,
apps\shopkeeper\src\components\StaffInviteForm.tsx:81:            onPress={() => setRole('shop_staff')}
apps\shopkeeper\src\components\StaffInviteForm.tsx:87:                role === 'shop_staff' && styles.roleButtonTextSelected,
apps\shopkeeper\src\components\StaffInviteForm.tsx:97:            accessibilityState={{ selected: role === 'shop_manager' }}
apps\shopkeeper\src\components\StaffInviteForm.tsx:100:              role === 'shop_manager' && styles.roleButtonSelected,
apps\shopkeeper\src\components\StaffInviteForm.tsx:102:            onPress={() => setRole('shop_manager')}
apps\shopkeeper\src\components\StaffInviteForm.tsx:108:                role === 'shop_manager' && styles.roleButtonTextSelected,
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:34:- Role check for audit-log: **explicit `if (auth.role === 'shop_staff') throw ForbiddenException`** in handler — `PolicyGuard` only enforces `@Permission()` keys, not `@Roles()` metadata
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:209:  userId: 'user-1', role: 'shop_admin',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:235:        metadata: null, actor_name: 'Ram Jewellers', actor_role: 'shop_admin' },
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:237:        metadata: null, actor_name: 'Ram Jewellers', actor_role: 'shop_admin' },
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:659:        actorName: 'Ram Admin', actorRole: 'shop_admin',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:670:  it('returns 200 with events for shop_admin', async () => {
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:677:  it('throws ForbiddenException for shop_staff role', async () => {
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:679:      ...adminCtx, role: 'shop_staff', userId: 'staff-uuid',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:749:@Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:756:  if (auth.role === 'shop_staff') throw new ForbiddenException({ code: 'auth.permission_denied' });
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:767:@Roles('shop_admin')
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:773:  if (auth.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.permission_denied' });
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:1070:  return { authenticated: true, shopId, tenant, userId: 'user-1', role: 'shop_admin' };
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:1187:  authenticated: true, shopId: SHOP_A, tenant: tenantA, userId: USER_A, role: 'shop_admin',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:1281:    actorRole: 'shop_admin',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:1526:  if (user?.role === 'shop_staff') {
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:1775:  shop_admin:   'एडमिन',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:1776:  shop_manager: 'मैनेजर',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:1777:  shop_staff:   'स्टाफ',
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:2059:export OWNER_TOKEN="<firebase id token for shop_admin user>"
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:2060:export STAFF_TOKEN="<firebase id token for shop_staff user>"
docs\superpowers\plans\2026-04-20-story-1.6-1.7-audit-trail-logout-all.md:2117:| GET /audit-log returns 403 for shop_staff | WS-B | `auth.controller.spec.ts:throws ForbiddenException` |
packages\ui-mobile\test\AuditEventRow.test.tsx:10:    actorRole: 'shop_admin',
packages\ui-mobile\test\AuditEventRow.test.tsx:59:  it('renders shop_manager role in Hindi', () => {
packages\ui-mobile\test\AuditEventRow.test.tsx:60:    const { getByText } = render(<AuditEventRow {...baseProps} actorRole="shop_manager" />);
apps\shopkeeper\src\components\PermissionsMatrix.tsx:26:  role: 'shop_manager' | 'shop_staff';
docs\superpowers\plans\2026-04-23-story-3.1-inventory-foundation.md:1524:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\superpowers\plans\2026-04-23-story-3.1-inventory-foundation.md:1527:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
docs\superpowers\plans\2026-04-23-story-3.1-inventory-foundation.md:1794:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-23-story-3.1-inventory-foundation.md:1804:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-23-story-3.1-inventory-foundation.md:1818:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-23-story-3.1-inventory-foundation.md:1828:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-23-story-3.1-inventory-foundation.md:1840:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-20-story-2.4-loyalty-config.md:896:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-20-story-2.4-loyalty-config.md:910:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-20-story-2.4-loyalty-config.md:1769:Start the API server (`cd apps/api && pnpm start:dev`). Replace `<JWT>` with a valid `shop_admin` Firebase JWT and `<BASE_URL>` with `http://localhost:3000`.
docs\superpowers\plans\2026-04-20-story-2.4-loyalty-config.md:1832:- [ ] **Smoke 5 — shop_manager can GET but not PATCH**
docs\superpowers\plans\2026-04-20-story-2.4-loyalty-config.md:1835:# With shop_manager JWT:
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:552:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:899:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:913:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:931:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:945:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:963:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:977:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
docs\superpowers\plans\2026-04-23-story-2.7-2.8-2.9.md:1858:Then run each smoke test. Replace `$TOKEN` with a valid shop_admin Firebase ID token:
docs\superpowers\plans\2026-04-24-story-3.7-valuation-dashboard.md:137:  shopId: SHOP_ID, userId: 'u1', role: 'shop_admin', authenticated: true,
docs\superpowers\plans\2026-04-24-story-3.7-valuation-dashboard.md:514:@Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-24-story-3.7-valuation-dashboard.md:1002:const ctxA: AuthenticatedTenantContext = { shopId: SHOP_A, userId: SHOP_A, role: 'shop_admin', authenticated: true, tenant: tenantA };
docs\superpowers\plans\2026-04-24-story-3.7-valuation-dashboard.md:1003:const ctxB: AuthenticatedTenantContext = { shopId: SHOP_B, userId: SHOP_B, role: 'shop_admin', authenticated: true, tenant: tenantB };
docs\superpowers\plans\2026-04-24-story-3.6-sync-infrastructure.md:13:- `@Roles(['OWNER','MANAGER','STAFF'])` → `@Roles('shop_admin','shop_manager','shop_staff')`
docs\superpowers\plans\2026-04-24-story-3.6-sync-infrastructure.md:1511:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-24-story-3.6-sync-infrastructure.md:1531:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-23-story-3.2-csv-bulk-import.md:607:  userId: USER_ID, role: 'shop_admin', firebaseUid: 'fb-uid',
docs\superpowers\plans\2026-04-23-story-3.2-csv-bulk-import.md:959:  userId: USER_ID, role: 'shop_admin', firebaseUid: 'fb-uid',
docs\superpowers\plans\2026-04-23-story-3.2-csv-bulk-import.md:1156:@Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-23-story-3.2-csv-bulk-import.md:1168:@Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-23-story-3.2-csv-bulk-import.md:1179:@Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-23-story-3.2-csv-bulk-import.md:1685:| OWNER or MANAGER role guard | Task 8 (uses existing `@Roles('shop_admin', 'shop_manager')`) |
docs\superpowers\plans\2026-04-24-story-3.4-product-status-state-machine.md:58:- [ ] `@Patch(':id/status')` with `@Roles('shop_admin', 'shop_manager', 'shop_staff')`
docs\superpowers\plans\2026-04-25-story-5.1-billing-foundation.md:47:- Role guard placement: controller method (not service). `Roles('shop_admin', 'shop_manager', 'shop_staff')` for create/list/get.
docs\superpowers\plans\2026-04-25-story-5.1-billing-foundation.md:1919:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-25-story-5.1-billing-foundation.md:1930:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-25-story-5.1-billing-foundation.md:1941:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-25-story-3.8-stock-movements.md:1116:@Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-25-story-3.8-stock-movements.md:1127:@Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-25-story-3.8-stock-movements.md:1211:- [ ] Confirm role guard present on both endpoints (`@Roles('shop_admin', 'shop_manager', 'shop_staff')`).
docs\superpowers\plans\2026-04-25-story-3.8-stock-movements.md:1680:  - Roles in brief: `'OWNER'/'MANAGER'/'STAFF'` → corrected to `'shop_admin'/'shop_manager'/'shop_staff'` (matches existing controller).
docs\superpowers\plans\2026-04-29-viewing-analytics.md:471:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-26-story-8.1-loyalty-accrual.md:42:| Roles `OWNER`/`MANAGER`/`STAFF` | Actual roles are `shop_admin`/`shop_manager`/`shop_staff` | use lowercase |
docs\superpowers\plans\2026-04-26-story-8.1-loyalty-accrual.md:189:  - `GET /customers/:id/loyalty` — roles `shop_admin`, `shop_manager`, `shop_staff`. Returns `LoyaltyState`.
docs\superpowers\plans\2026-04-26-story-8.1-loyalty-accrual.md:190:  - `POST /customers/:id/loyalty/adjust` — role `shop_admin` ONLY. Body validated via `ZodValidationPipe(AdjustPointsBodySchema)`.
docs\superpowers\plans\2026-04-26-story-8.1-loyalty-accrual.md:207:  - "अंक समायोजित करें" button visible to `shop_admin` only (read role from auth context). Opens `LoyaltyAdjustModal`.
docs\superpowers\plans\2026-04-29-rate-lock-bookings.md:797:  @Roles('shop_admin', 'shop_manager')
docs\superpowers\plans\2026-04-29-rate-lock-bookings.md:806:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
docs\superpowers\plans\2026-04-29-rate-lock-bookings.md:817:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
packages\tenant-context\test\als.test.ts:59:      authenticated: true, userId: 'u', role: 'shop_admin',
packages\tenant-context\test\als.test.ts:67:      authenticated: true, userId: 'u', role: 'shop_staff',
docs\superpowers\plans\2026-05-01-platform-admin-console.md:417:   - Return claims with `shop_id = target_shop_id`, `role = 'shop_admin'` (highest tenant-side role for support), `goldsmith_uid = sub` (the platform user ID — used only for audit metadata; never written to tenant tables), and a new optional field `impersonationSessionId = jti`.
docs\superpowers\plans\2026-05-01-platform-admin-console.md:455:    expect(claims.role).toBe('shop_admin');
docs\superpowers\plans\2026-05-01-platform-admin-console.md:461:      uid: 'shop-uid', role: 'shop_staff', shop_id: 'shop-X', goldsmith_uid: 'u-id',
docs\superpowers\plans\2026-05-01-platform-admin-console.md:472:    expect(claims.role).toBe('shop_staff');
docs\superpowers\plans\2026-05-01-platform-admin-console.md:527:  role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
docs\superpowers\plans\2026-05-01-platform-admin-console.md:604:      role: 'shop_admin',
docs\superpowers\plans\2026-05-01-platform-admin-console.md:682:      uid: 'p-uid', shop_id: 'shop-A', role: 'shop_admin', goldsmith_uid: 'p-id',
docs\superpowers\plans\2026-05-01-platform-admin-console.md:1902:// 1. Provision a shop_admin user for a target shop S; provision a platform_admin user P.
docs\superpowers\plans\2026-05-01-platform-admin-console.md:1908://    GET /api/v1/auth/me. Assert 200, body.tenant.id === S, body.user.role === 'shop_admin'.
docs\superpowers\plans\2026-05-01-platform-admin-console.md:1922:// non-platform-admin tries to impersonate: shop_admin user calls POST /platform/admin/impersonate — assert 403.
apps\shopkeeper\src\features\settings\hooks\useStaffList.ts:8:  role: 'shop_staff' | 'shop_manager' | 'shop_admin';
apps\shopkeeper\src\features\settings\hooks\useInviteStaff.ts:7:  role: 'shop_manager' | 'shop_staff';
apps\shopkeeper\app\settings\staff.tsx:29:  role: 'shop_admin' | 'shop_manager' | 'shop_staff';
apps\shopkeeper\app\settings\staff.tsx:40:  shop_admin: 'एडमिन',
apps\shopkeeper\app\settings\staff.tsx:41:  shop_manager: 'मैनेजर',
apps\shopkeeper\app\settings\staff.tsx:42:  shop_staff: 'स्टाफ',
apps\shopkeeper\app\settings\staff.tsx:78:  const isAdmin = user?.role === 'shop_admin';
apps\shopkeeper\app\settings\staff.tsx:130:      .get<Record<string, boolean>>('/auth/roles/shop_manager/permissions')
apps\shopkeeper\app\settings\staff.tsx:148:    role: 'shop_staff' | 'shop_manager';
apps\shopkeeper\app\settings\staff.tsx:183:      .put('/auth/roles/shop_manager/permissions', { permission_key: key, is_enabled: value })
apps\shopkeeper\app\settings\staff.tsx:282:              {isAdmin && member.role !== 'shop_admin' && (
apps\shopkeeper\app\settings\staff.tsx:369:              role="shop_manager"
packages\tenant-context\src\context.ts:9:export type ShopUserRole = 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
packages\db\test\with-tenant-tx.integration.test.ts:31:      VALUES ('${SHOP_A}', '+91a', 'Alice A', 'shop_admin', 'ACTIVE');
packages\db\test\with-tenant-tx.integration.test.ts:34:      VALUES ('${SHOP_B}', '+91b', 'Bob B', 'shop_admin', 'ACTIVE');
packages\db\test\with-tenant-tx.integration.test.ts:62:            [SHOP_A, '+91c', 'X', 'shop_staff', 'ACTIVE']);
packages\ui-mobile\src\primitives\AuditEventRow.tsx:44:  shop_admin: 'मालिक',
packages\ui-mobile\src\primitives\AuditEventRow.tsx:45:  shop_manager: 'प्रबंधक',
packages\ui-mobile\src\primitives\AuditEventRow.tsx:46:  shop_staff: 'स्टाफ़',
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:21:  const [role, setRole] = useState<'shop_staff' | 'shop_manager'>('shop_staff');
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:72:          style={[styles.roleBtn, role === 'shop_staff' && styles.roleBtnActive]}
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:73:          onPress={() => setRole('shop_staff')}
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:75:          accessibilityState={{ checked: role === 'shop_staff' }}
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:77:          <Text style={[styles.roleBtnText, role === 'shop_staff' && styles.roleBtnTextActive]}>
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:82:          style={[styles.roleBtn, role === 'shop_manager' && styles.roleBtnActive]}
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:83:          onPress={() => setRole('shop_manager')}
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:85:          accessibilityState={{ checked: role === 'shop_manager' }}
apps\shopkeeper\src\features\settings\components\StaffInviteForm.tsx:87:          <Text style={[styles.roleBtnText, role === 'shop_manager' && styles.roleBtnTextActive]}>
packages\tenant-config\test\permissions-cache.test.ts:18:      expect(await cache.getPermissions('shop1', 'shop_manager')).toBeNull();
packages\tenant-config\test\permissions-cache.test.ts:24:      expect(await cache.getPermissions('shop1', 'shop_manager')).toEqual(data);
packages\tenant-config\test\permissions-cache.test.ts:30:      expect(await cache.getPermissions('shop1', 'shop_manager')).toBeNull();
packages\tenant-config\test\permissions-cache.test.ts:31:      expect(del).toHaveBeenCalledWith('shop:shop1:permissions:shop_manager');
packages\tenant-config\test\permissions-cache.test.ts:39:      await cache.setPermissions('shop1', 'shop_manager', { 'billing.create': true });
packages\tenant-config\test\permissions-cache.test.ts:41:        'shop:shop1:permissions:shop_manager',
packages\tenant-config\test\permissions-cache.test.ts:53:      await cache.invalidate('shop1', 'shop_manager');
packages\tenant-config\test\permissions-cache.test.ts:54:      expect(del).toHaveBeenCalledWith('shop:shop1:permissions:shop_manager');
packages\db\src\schema\shop-users.ts:5:export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
apps\shopkeeper\src\features\crm\components\NotesSection.tsx:79:      currentUserId === note.authorUserId || currentUserRole === 'shop_admin';
apps\shopkeeper\src\features\crm\components\NotesSection.tsx:123:                    currentUserRole === 'shop_admin'
apps\shopkeeper\app\settings\audit-log.tsx:140:  if (role === 'shop_staff') {
apps\shopkeeper\app\settings\audit-log.tsx:149:  const isAllowed = role === 'shop_admin' || role === 'shop_manager';
apps\shopkeeper\src\features\crm\components\LoyaltyCard.tsx:45:  const isAdmin = role === 'shop_admin';
apps\shopkeeper\app\settings\account.tsx:21:  shop_admin: 'मालिक',
apps\shopkeeper\app\settings\account.tsx:22:  shop_manager: 'प्रबंधक',
apps\shopkeeper\app\settings\account.tsx:23:  shop_staff: 'स्टाफ़',
apps\shopkeeper\src\features\crm\components\DeletionRequestSheet.tsx:21:// OWNER (shop_admin) only. The OWNER must type the customer's name back to
packages\shared\src\schemas\role-permissions.schema.ts:16:  role:         z.enum(['shop_staff', 'shop_manager']),
packages\shared\src\schemas\role-permissions.schema.ts:28:  role:        z.enum(['shop_manager', 'shop_staff']),
packages\db\src\migrations\0008_role_permissions.sql:2:-- Dynamic per-role permission matrix. shop_admin is NOT seeded — PolicyGuard bypasses DB for admin.
packages\db\src\migrations\0008_role_permissions.sql:23:-- Seed shop_manager defaults for all existing shops
packages\db\src\migrations\0008_role_permissions.sql:25:SELECT s.id, 'shop_manager', k.key, k.enabled
packages\db\src\migrations\0008_role_permissions.sql:37:-- Seed shop_staff defaults for all existing shops
packages\db\src\migrations\0008_role_permissions.sql:39:SELECT s.id, 'shop_staff', k.key, k.enabled
packages\db\src\migrations\0001_initial_schema.sql:9:CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:39:  const isOwner = userRole === 'shop_admin';
packages\testing\tenant-isolation\fixtures\tenant-c.ts:19:          ($1, $2, 'Chandra C', 'shop_admin', 'ACTIVE', $3),
packages\testing\tenant-isolation\fixtures\tenant-c.ts:20:          ($1, '+15555550013', 'Charu C', 'shop_staff', 'ACTIVE', null)`,
packages\testing\tenant-isolation\fixtures\tenant-b.ts:19:          ($1, $2, 'Bhavna B', 'shop_admin', 'ACTIVE', $3),
packages\testing\tenant-isolation\fixtures\tenant-b.ts:20:          ($1, '+15555550012', 'Bhim B', 'shop_manager', 'ACTIVE', null)`,
packages\testing\tenant-isolation\fixtures\tenant-a.ts:19:          ($1, $2, 'Alice A', 'shop_admin', 'ACTIVE', $3),
packages\testing\tenant-isolation\fixtures\tenant-a.ts:20:          ($1, '+15555550011', 'Akhil A', 'shop_staff', 'ACTIVE', null)`,
apps\shopkeeper\src\features\billing\components\CashCapBlockModal.tsx:40:  userRole:       'shop_admin' | 'shop_manager' | 'shop_staff';
apps\shopkeeper\src\features\billing\components\CashCapBlockModal.tsx:58:  const canOverride = userRole === 'shop_admin' || userRole === 'shop_manager';
packages\testing\tenant-isolation\src\tenant-walker-route.decorator.ts:14:   * e.g. { role: 'shop_manager' } turns /roles/:role/permissions into /roles/shop_manager/permissions
apps\shopkeeper\app\rates\override.tsx:68:  const isOwner = user?.role === 'shop_admin';
apps\shopkeeper\app\billing\[id].tsx:88:      {userRole === 'shop_admin' && data.status === 'ISSUED' && (
packages\compliance\src\cash-cap\section-269st.ts:28:  role:          string; // must be 'shop_admin' or 'shop_manager'
packages\compliance\src\cash-cap\section-269st.ts:48:  if (input.role !== 'shop_admin' && input.role !== 'shop_manager') {
packages\compliance\src\cash-cap\section-269st.ts:51:      requiredRoles: ['shop_admin', 'shop_manager'],
apps\api\test\auth-me.integration.test.ts:19:       VALUES ($1, $2, 'O', 'shop_admin', 'INVITED') ON CONFLICT (shop_id, phone) DO NOTHING`,
apps\api\test\auth-me.integration.test.ts:44:    expect(res.body.user.role).toBe('shop_admin');
packages\compliance\src\cash-cap\section-269st.test.ts:97:  it('returns override metadata for shop_admin (OWNER)', () => {
packages\compliance\src\cash-cap\section-269st.test.ts:99:      { role: 'shop_admin', justification: 'Customer is a known regular' },
packages\compliance\src\cash-cap\section-269st.test.ts:103:    expect(result.overrideActorRole).toBe('shop_admin');
packages\compliance\src\cash-cap\section-269st.test.ts:110:  it('returns override metadata for shop_manager (MANAGER)', () => {
packages\compliance\src\cash-cap\section-269st.test.ts:112:      { role: 'shop_manager', justification: 'Emergency bulk purchase approved' },
packages\compliance\src\cash-cap\section-269st.test.ts:115:    expect(result.overrideActorRole).toBe('shop_manager');
packages\compliance\src\cash-cap\section-269st.test.ts:118:  it('throws compliance.override.role_required for shop_staff', () => {
packages\compliance\src\cash-cap\section-269st.test.ts:120:      buildCashCapOverride({ role: 'shop_staff', justification: 'I should not be able to this' }, projected),
packages\compliance\src\cash-cap\section-269st.test.ts:132:      buildCashCapOverride({ role: 'shop_admin', justification: 'Short' }, projected),
packages\compliance\src\cash-cap\section-269st.test.ts:138:      buildCashCapOverride({ role: 'shop_admin', justification: '   abc   ' }, projected),
packages\compliance\src\cash-cap\section-269st.test.ts:144:      { role: 'shop_admin', justification: '  Valid justification here  ' },
apps\api\test\auth-link-migration.integration.test.ts:85:                     VALUES ('11111111-1111-1111-1111-111111111111', '+919000000003', 'T', 'shop_admin', 'INVITED')
apps\api\test\auth-duplicate-phone.integration.test.ts:34:       VALUES ($1, $2, 'Owner A', 'shop_admin', 'INVITED')`,
apps\api\test\auth-duplicate-phone.integration.test.ts:47:       VALUES ($1, $2, 'Owner B', 'shop_admin', 'INVITED'),
apps\api\test\auth-duplicate-phone.integration.test.ts:48:              ($3, $2, 'Owner C', 'shop_admin', 'INVITED')`,
apps\api\test\audit-log-read.integration.test.ts:96:    role: 'shop_admin',
apps\api\test\billing.integration.test.ts:57:  userId: USER_A, role: 'shop_admin',
apps\api\test\billing.integration.test.ts:63:  userId: USER_B, role: 'shop_admin',
apps\api\test\billing.integration.test.ts:495:    userId: USER_A, role: 'shop_admin',
apps\api\test\billing.integration.test.ts:499:    userId: '33333333-0000-4444-0000-000000000003', role: 'shop_manager',
apps\api\test\billing.integration.test.ts:542:      voidSvcA.voidInvoice({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'test void' }),
apps\api\test\billing.integration.test.ts:587:        voidSvcA.voidInvoice({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'late void' }),
apps\api\test\billing.integration.test.ts:602:          { userId: ctxManagerA.userId, role: 'shop_manager', shopId: SHOP_A },
apps\api\test\billing.integration.test.ts:626:        { userId: USER_A, role: 'shop_admin', shopId: SHOP_A },
apps\api\test\billing.integration.test.ts:646:      voidSvcA.issueCreditNote({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'first' }),
apps\api\test\billing.integration.test.ts:651:        voidSvcA.issueCreditNote({ userId: USER_A, role: 'shop_admin', shopId: SHOP_A }, invoiceId, { reason: 'second' }),
apps\api\test\billing.integration.test.ts:667:      userId: USER_B, role: 'shop_admin',
apps\api\test\billing.integration.test.ts:672:        voidSvcA.voidInvoice({ userId: USER_B, role: 'shop_admin', shopId: SHOP_B }, invoiceId, { reason: 'cross-tenant' }),
apps\api\test\auth-uid-race.integration.test.ts:38:     VALUES ($1, $2, 'Owner', 'shop_admin', 'INVITED')
apps\api\test\auth-uid-race.integration.test.ts:87:       VALUES ($1, $2, 'Owner', 'shop_admin', 'ACTIVE', 'already-linked-uid')
apps\api\test\auth-uid-race.integration.test.ts:132:       VALUES ($1, $2, '+919000009922', 'Owner', 'shop_admin', 'ACTIVE', 'winner-uid')
apps\api\test\auth-uid-mismatch.integration.test.ts:19:       VALUES ($1, $2, 'O', 'shop_admin', 'ACTIVE', 'pre-existing-uid')
apps\api\test\auth-staff.integration.spec.ts:16://   • Two shops (SHOP_A, SHOP_B) each with one ACTIVE shop_admin
apps\api\test\auth-staff.integration.spec.ts:42:/** Tokens for shop_admin of each shop — populated in beforeAll. */
apps\api\test\auth-staff.integration.spec.ts:43:let tokenA: string;  // ID token with shop_admin custom claims for SHOP_A
apps\api\test\auth-staff.integration.spec.ts:44:let tokenB: string;  // ID token with shop_admin custom claims for SHOP_B
apps\api\test\auth-staff.integration.spec.ts:49: * Seed a shop + shop_admin user, call /auth/session to provision Firebase
apps\api\test\auth-staff.integration.spec.ts:68:     VALUES ($1, $2, 'Admin', 'shop_admin', 'INVITED')
apps\api\test\auth-staff.integration.spec.ts:145:      .send({ phone: '+919111110001', role: 'shop_staff', display_name: 'New Staff' });
apps\api\test\auth-staff.integration.spec.ts:159:    expect(row.rows[0].role).toBe('shop_staff');
apps\api\test\auth-staff.integration.spec.ts:170:      .send({ phone, role: 'shop_manager', display_name: 'Dup Staff' });
apps\api\test\auth-staff.integration.spec.ts:178:      .send({ phone, role: 'shop_staff', display_name: 'Dup Staff Again' });
apps\api\test\auth-staff.integration.spec.ts:190:      .send({ phone, role: 'shop_staff', display_name: 'Audit Check' });
apps\api\test\auth-staff.integration.spec.ts:209:    expect(metaStr).toContain('shop_staff');
apps\api\test\auth-staff.integration.spec.ts:217:  it('GET returns seeded defaults for shop_manager', async () => {
apps\api\test\auth-staff.integration.spec.ts:219:      .get('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:233:    // Toggle settings.edit from false → true for shop_manager
apps\api\test\auth-staff.integration.spec.ts:235:      .put('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:243:      .get('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:252:      .put('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:264:      .put('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:270:    expect(invalidateSpy).toHaveBeenCalledWith(SHOP_A_ID, 'shop_manager');
apps\api\test\auth-staff.integration.spec.ts:275:      .put('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:289:       VALUES ($1, 'shop_manager', 'billing.void', true)
apps\api\test\auth-staff.integration.spec.ts:296:      .get('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:306:      .get('/api/v1/auth/roles/shop_manager/permissions')
apps\api\test\auth-staff.integration.spec.ts:322:      .send({ phone: exclusivePhone, role: 'shop_staff', display_name: 'Exclusive A' });
apps\api\test\auth-session.integration.test.ts:17:     VALUES ($1, $2, 'Owner', 'shop_admin', 'INVITED')
apps\api\test\auth-session.integration.test.ts:36:    expect(res.body.user.role).toBe('shop_admin');
apps\api\test\auth-repository.integration.test.ts:36:       VALUES ($1, $2, 'T', 'shop_admin', 'INVITED')`,
apps\api\test\auth-repository.integration.test.ts:58:       VALUES ($1, '+910000000099', 'T', 'shop_admin', 'INVITED')`,
apps\api\test\auth-repository.integration.test.ts:67:       VALUES ($1, $2, 'T', 'shop_admin', 'INVITED') RETURNING id`,
apps\api\test\settings\settings.integration.test.ts:103:function makeCtx(role: 'shop_admin' | 'shop_manager' | 'shop_staff' = 'shop_admin'): AuthenticatedTenantContext {
apps\api\test\settings\settings.integration.test.ts:389:    shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
apps\api\test\settings\settings.integration.test.ts:437:  it('shop_manager role can read via service (role enforcement is at controller layer)', async () => {
apps\api\test\settings\settings.integration.test.ts:439:      shopId: SHOP_A, tenant, authenticated: true, userId: 'u2', role: 'shop_manager',
apps\api\test\estimate.integration.test.ts:49:  userId: USER, role: 'shop_admin',
apps\shopkeeper\app\(tabs)\_layout.tsx:25:  const isStaff = role === 'shop_staff';
apps\api\test\endpoint-walker.e2e.test.ts:80:      // Fetch the phone and DB user_id for this fixture's shop_admin row (first shop_user seeded).
apps\api\test\endpoint-walker.e2e.test.ts:98:        role: 'shop_admin',
apps\api\src\common\guards\roles.guard.test.ts:30:    const { reflector, execCtx } = makeExecCtx(['shop_admin'], { role: 'shop_admin' });
apps\api\src\common\guards\roles.guard.test.ts:36:    const { reflector, execCtx } = makeExecCtx(['shop_admin'], { role: 'shop_manager' });
apps\api\src\common\guards\roles.guard.test.ts:42:    const { reflector, execCtx } = makeExecCtx(['shop_admin'], undefined);
apps\api\src\common\guards\roles.guard.test.ts:48:    const { reflector, execCtx } = makeExecCtx(['shop_admin'], { uid: 'x', role: undefined });
apps\api\src\common\guards\roles.guard.test.ts:53:  it('passes shop_manager for multi-role requirement', () => {
apps\api\src\common\guards\roles.guard.test.ts:54:    const { reflector, execCtx } = makeExecCtx(['shop_admin', 'shop_manager'], { role: 'shop_manager' });
apps\api\test\loyalty.integration.test.ts:29:  return { shopId, userId: USER_A, role: 'shop_admin', tenant, authenticated: true };
apps\api\test\logout-all.integration.test.ts:95:    role: 'shop_admin',
apps\api\test\inventory-valuation.integration.test.ts:25:  shopId: SHOP_A, userId: SHOP_A, role: 'shop_admin',
apps\api\test\inventory-valuation.integration.test.ts:29:  shopId: SHOP_B, userId: SHOP_B, role: 'shop_admin',
apps\api\src\modules\wishlist\wishlist.controller.ts:31:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\wishlist\wishlist.controller.ts:38:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\wishlist\wishlist.controller.ts:47:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\test\firebase-jwt-strategy.unit.test.ts:19:        if (token === 'valid') return { uid: 'u1', phone_number: '+919000000001', shop_id: 'a', role: 'shop_admin' };
apps\api\test\firebase-jwt-strategy.unit.test.ts:66:    expect(claims.role).toBe('shop_admin');
apps\api\test\firebase-jwt-strategy.unit.test.ts:76:      uid: 'shop-uid', role: 'shop_staff', shop_id: 'shop-X', goldsmith_uid: 'u-id',
apps\api\test\firebase-jwt-strategy.unit.test.ts:90:    expect(claims.role).toBe('shop_staff');
apps\api\test\claim-conflict.integration.test.ts:15:    await h.pool.query(`INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, $2, 'O', 'shop_admin', 'INVITED') ON CONFLICT DO NOTHING`, [shopA, phone]);
apps\api\test\claim-conflict.integration.test.ts:43:    await h.pool.query(`INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, $2, 'O', 'shop_admin', 'INVITED') ON CONFLICT DO NOTHING`, [shopId, phone]);
apps\api\src\modules\loyalty\loyalty.service.spec.ts:15:function authCtx(role = 'shop_admin'): any {
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.controller.ts:40:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.controller.ts:47:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.controller.ts:56:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.controller.ts:62:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.controller.ts:68:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\loyalty\loyalty.controller.ts:21:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\loyalty\loyalty.controller.ts:32:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\loyalty\loyalty.controller.ts:42:  // Manual points adjustment — OWNER (shop_admin) only.
apps\api\src\modules\loyalty\loyalty.controller.ts:50:  @Roles('shop_admin')
apps\api\src\modules\loyalty\loyalty.controller.spec.ts:11:function authCtx(role = 'shop_admin'): any {
apps\api\src\modules\loyalty\loyalty.controller.spec.ts:73:    it('positive delta succeeds for shop_admin', async () => {
apps\api\src\modules\inventory\inventory.bulk-import.service.test.ts:15:  userId: USER_ID, role: 'shop_admin',
apps\api\src\modules\sync\sync.controller.ts:21:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\sync\sync.controller.ts:43:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\barcode.integration.test.ts:48:    shopId: SHOP_A, userId: 'user-1', role: 'shop_admin', authenticated: true,
apps\api\src\modules\analytics\analytics.controller.ts:19:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\billing\billing.controller.ts:60:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:72:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:87:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:101:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:132:  @Roles('shop_admin')
apps\api\src\modules\billing\billing.controller.ts:146:  @Roles('shop_admin')
apps\api\src\modules\billing\billing.controller.ts:166:  @Roles('shop_admin')
apps\api\src\modules\billing\billing.controller.ts:182:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:198:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:212:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:226:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:237:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:265:  @Roles('shop_admin')
apps\api\src\modules\billing\billing.controller.ts:283:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:291:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:301:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\billing\billing.controller.ts:309:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\billing\billing.controller.ts:320:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\billing\billing.controller.ts:328:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.bulk-import.processor.test.ts:15:  userId: USER_ID, role: 'shop_admin',
apps\api\src\modules\auth\auth.controller.ts:88:  @TenantWalkerRoute({ expectedStatus: 201, body: { phone: '+919876543210', role: 'shop_staff', display_name: 'Test Staff' } })
apps\api\src\modules\auth\auth.controller.ts:90:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\auth\auth.controller.ts:110:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\auth\auth.controller.ts:121:  @TenantWalkerRoute({ pathParams: { role: 'shop_manager' } })
apps\api\src\modules\auth\auth.controller.ts:123:  @Roles('shop_admin')
apps\api\src\modules\auth\auth.controller.ts:131:  @TenantWalkerRoute({ expectedStatus: 200, body: { permission_key: 'billing.create', is_enabled: true }, pathParams: { role: 'shop_manager' } })
apps\api\src\modules\auth\auth.controller.ts:133:  @Roles('shop_admin')
apps\api\src\modules\auth\auth.controller.ts:156:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\auth\auth.controller.ts:168:    if (auth.role === 'shop_staff') throw new ForbiddenException({ errorCode: 'auth.permission_denied' });
apps\api\src\modules\auth\auth.controller.ts:180:  @Roles('shop_admin')
apps\api\src\modules\auth\auth.controller.ts:206:  @Roles('shop_admin')
apps\api\src\modules\inventory\barcode.service.test.ts:42:    shopId: SHOP_ID, userId: 'user-1', role: 'shop_admin', authenticated: true,
apps\api\src\modules\auth\auth.controller.spec.ts:35:  role: 'shop_admin',
apps\api\src\modules\auth\auth.controller.spec.ts:38:const inviteDto = { phone: '+919876543210', role: 'shop_staff' as const, display_name: 'Alice Singh' };
apps\api\src\modules\auth\auth.controller.spec.ts:139:        { id: 'u1', displayName: 'Alice', role: 'shop_staff', status: 'ACTIVE', phone: '+919876543210', invitedAt: null, activatedAt: null },
apps\api\src\modules\auth\auth.controller.spec.ts:157:      const result = await withAdminCtx(() => controller.getPermissions('shop_manager'));
apps\api\src\modules\auth\auth.controller.spec.ts:159:      expect(mockPermissionsRepo.getPermissions).toHaveBeenCalledWith(SHOP_ID, 'shop_manager');
apps\api\src\modules\auth\auth.controller.spec.ts:190:        ctrl2.updatePermission('shop_manager', updatePermDto, {} as never),
apps\api\src\modules\auth\auth.controller.spec.ts:195:        SHOP_ID, 'shop_manager', 'billing.create', false,
apps\api\src\modules\auth\auth.controller.spec.ts:197:      expect(mockPermissionsCache.invalidate).toHaveBeenCalledWith(SHOP_ID, 'shop_manager');
apps\api\src\modules\auth\auth.controller.spec.ts:220:    it('calls svc.getAuditLog and returns result for shop_admin', async () => {
apps\api\src\modules\auth\auth.controller.spec.ts:254:    it('throws ForbiddenException for shop_staff — explicit handler check required because PolicyGuard only reads PERMISSION_KEY, not @Roles()', async () => {
apps\api\src\modules\auth\auth.controller.spec.ts:257:        role: 'shop_staff',
apps\api\src\modules\auth\auth.service.spec.ts:26:  role: 'shop_staff',
apps\api\src\modules\auth\auth.service.spec.ts:115:    expect(call.role).toBe('shop_staff');
apps\api\src\modules\auth\auth.service.spec.ts:148:    expect(metadata).toHaveProperty('role', 'shop_staff');
apps\api\src\modules\auth\auth.service.spec.ts:202:    const mockEvents = [{ id: 'evt-1', action: 'AUTH_VERIFY_SUCCESS', actorName: 'Alice', actorRole: 'shop_admin', createdAt: '2026-04-20T00:00:00.000Z' }];
apps\api\src\modules\auth\auth.service.spec.ts:285:        { shopId: SHOP_ID, tenant: fakeTenant, authenticated: true, userId: 'user-123', role: 'shop_admin' },
apps\api\src\modules\auth\auth.service.spec.ts:404:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
apps\api\src\modules\auth\auth.service.spec.ts:420:      targetRow: { firebaseUid: null, role: 'shop_staff' },
apps\api\src\modules\auth\auth.service.spec.ts:439:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
apps\api\src\modules\auth\auth.service.spec.ts:447:  it('throws ForbiddenException(403) when target is a shop_admin', async () => {
apps\api\src\modules\auth\auth.service.spec.ts:449:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_admin' },
apps\api\src\modules\auth\auth.service.spec.ts:458:      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff', status: 'INVITED' },
apps\api\src\modules\auth\auth.service.spec.ts:484:      targetRow: { firebaseUid: null, role: 'shop_staff', status: 'INVITED' },
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:11:    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:12:    current: () => ({ authenticated: true, shopId: SHOP, userId: USER, role: 'shop_admin' }),
apps\api\src\modules\settings\settings.try-at-home.spec.ts:53:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
apps\api\src\modules\settings\settings.try-at-home.spec.ts:157:      shopId: SHOP_A, userId: 'user-a', role: 'shop_admin', authenticated: true,
apps\api\src\modules\auth\auth.repository.ts:70:    role: 'shop_staff' | 'shop_manager';
apps\api\src\modules\auth\auth.repository.invite.spec.ts:28:        phone: '+919000001234', role: 'shop_staff', displayName: 'Alice',
apps\api\src\modules\auth\auth.repository.invite.spec.ts:54:        phone: '+919000005678', role: 'shop_manager', displayName: 'Bob',
apps\api\src\modules\auth\auth.repository.invite.spec.ts:66:      id: 'u1', display_name: 'Alice', role: 'shop_staff',
apps\api\src\modules\auth\auth.repository.invite.spec.ts:98:          rows: [{ firebase_uid: 'fb-uid-1', role: 'shop_staff', status: 'ACTIVE' }],
apps\api\src\modules\auth\auth.repository.invite.spec.ts:110:    expect(result).toEqual({ firebaseUid: 'fb-uid-1', role: 'shop_staff', status: 'ACTIVE' });
apps\api\src\modules\auth\auth.repository.invite.spec.ts:136:        .mockResolvedValueOnce({ rows: [{ firebase_uid: null, role: 'shop_staff', status: 'ACTIVE' }], rowCount: 1 })
apps\api\src\modules\auth\auth.repository.invite.spec.ts:146:    expect(result).toEqual({ firebaseUid: null, role: 'shop_staff', status: 'ACTIVE' });
apps\api\src\modules\inventory\inventory.search.service.test.ts:15:    role: 'shop_admin',
apps\api\src\modules\inventory\publish.integration.test.ts:58:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps\api\src\modules\inventory\publish.integration.test.ts:61:    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps\api\src\modules\inventory\publish.integration.test.ts:84:      shopId: SHOP_B, userId: 'user-b', role: 'shop_admin', authenticated: true,
apps\api\src\modules\customer\customer.controller.ts:176:      role:    'shop_staff',
apps\api\src\modules\auth\permissions.repository.ts:59:           VALUES ($1, 'shop_manager', $2, $3) ON CONFLICT DO NOTHING`,
apps\api\src\modules\auth\permissions.repository.ts:66:           VALUES ($1, 'shop_staff', $2, $3) ON CONFLICT DO NOTHING`,
apps\api\src\modules\settings\settings.service.test.ts:15:  shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
apps\api\src\modules\settings\settings.service.loyalty.test.ts:69:  shopId: SHOP_ID, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
apps\api\src\modules\billing\compliance-reports.service.ts:41:    if (ctx.role !== 'shop_admin') {
apps\api\src\modules\billing\compliance-reports.service.ts:174:    if (ctx.role !== 'shop_admin') {
apps\api\src\modules\auth\permissions.repository.spec.ts:31:      result = await repo.getPermissions('shop-1', 'shop_manager');
apps\api\src\modules\auth\permissions.repository.spec.ts:40:      result = await repo.getPermissions('shop-1', 'shop_manager');
apps\api\src\modules\billing\compliance-reports.controller.ts:20:  @Roles('shop_admin')
apps\api\src\modules\billing\compliance-reports.controller.ts:41:  @Roles('shop_admin')
apps\api\src\modules\auth\auth.service.ts:148:      authenticated: true, userId: invitedByUserId, role: 'shop_admin' as ShopUserRole,
apps\api\src\modules\auth\auth.service.ts:185:    if (row.role === 'shop_admin') throw new ForbiddenException({ code: 'auth.cannot_revoke_admin' });
apps\api\src\modules\auth\auth.service.ts:215:      authenticated: true, userId: callerUserId, role: 'shop_admin' as ShopUserRole,
apps\api\src\modules\inventory\inventory.valuation.service.test.ts:9:  shopId: SHOP_ID, userId: 'u1', role: 'shop_admin', authenticated: true,
apps\api\src\modules\auth\firebase-jwt.strategy.ts:18:  role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
apps\api\src\modules\auth\firebase-jwt.strategy.ts:125:      role: 'shop_admin',
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:12:  authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin',
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:63:const CTX = { authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin' };
apps\api\src\modules\auth\dto\invite-staff.dto.ts:3:  role: 'shop_manager' | 'shop_staff';
apps\api\src\modules\billing\payment.service.spec.ts:16:function makeCtx(role = 'shop_admin') {
apps\api\src\modules\billing\payment.service.spec.ts:144:  it('allows override by shop_admin with valid justification', async () => {
apps\api\src\modules\billing\payment.service.spec.ts:171:  it('throws ComplianceHardBlockError with role_required for shop_staff override attempt', async () => {
apps\api\src\modules\billing\payment.service.spec.ts:172:    (tenantContext.requireCurrent as any).mockReturnValue(makeCtx('shop_staff'));
apps\api\src\modules\inventory\inventory.controller.ts:47:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:56:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\inventory.controller.ts:80:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:90:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:100:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\inventory.controller.ts:114:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\inventory.controller.ts:124:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:135:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\inventory.controller.ts:147:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:161:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:172:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:183:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\inventory.controller.ts:194:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:206:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:217:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\inventory\inventory.controller.ts:228:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\inventory.controller.ts:239:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\inventory\inventory.service.test.ts:57:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps\api\src\modules\inventory\inventory.service.test.ts:60:    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
apps\api\src\modules\billing\payment.service.ts:261:        // Path B: over limit + override. buildCashCapOverride throws for shop_staff.
apps\api\src\modules\settings\settings.policies-notif.spec.ts:57:    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
apps\api\src\modules\settings\settings.controller.ts:43:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:57:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:70:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:80:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:94:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:107:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:121:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:134:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:148:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:161:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:175:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:202:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:216:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:236:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:250:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:268:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:282:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:300:    if (!['shop_admin', 'shop_manager'].includes(ctx.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\settings\settings.controller.ts:314:    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
apps\api\src\modules\billing\story-5.6-pmla-block-ctr.spec.ts:85:    const role: string = 'shop_manager'; // MANAGER is not shop_admin
apps\api\src\modules\billing\story-5.6-pmla-block-ctr.spec.ts:88:      if (role !== 'shop_admin') throw new ForbiddenException({ code: 'ctr.owner_only' });
apps\api\src\modules\billing\story-5.6-pmla-block-ctr.spec.ts:97:    const role: string = 'shop_staff';
apps\api\src\modules\billing\story-5.6-pmla-block-ctr.spec.ts:100:      if (role !== 'shop_admin') throw new ForbiddenException({ code: 'ctr.owner_only' });
apps\api\src\modules\auth\guards\policy.guard.ts:31:    if (tc.role === 'shop_admin') return true;
apps\api\src\modules\crm\balance.service.spec.ts:11:function authCtx(role = 'shop_admin'): any {
apps\api\src\modules\billing\void.service.spec.ts:76:      svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
apps\api\src\modules\billing\void.service.spec.ts:83:      svc.voidInvoice({ userId: MGR, role: 'shop_staff', shopId: SHOP }, 'inv-1', { reason: 'test' }),
apps\api\src\modules\billing\void.service.spec.ts:90:      await svc.voidInvoice({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' });
apps\api\src\modules\billing\void.service.spec.ts:100:      svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
apps\api\src\modules\billing\void.service.spec.ts:108:      await svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
apps\api\src\modules\billing\void.service.spec.ts:119:      await svc.voidInvoice({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
apps\api\src\modules\billing\void.service.spec.ts:135:      { userId: OWNER, role: 'shop_admin', shopId: SHOP },
apps\api\src\modules\billing\void.service.spec.ts:148:      svc.issueCreditNote({ userId: MGR, role: 'shop_manager', shopId: SHOP }, 'inv-1', { reason: 'test' }),
apps\api\src\modules\billing\void.service.spec.ts:156:      svc.issueCreditNote({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-missing', { reason: 'test' }),
apps\api\src\modules\billing\void.service.spec.ts:165:      await svc.issueCreditNote({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
apps\api\src\modules\billing\void.service.spec.ts:187:      { userId: OWNER, role: 'shop_admin', shopId: SHOP },
apps\api\src\modules\billing\void.service.spec.ts:206:      await svc.issueCreditNote({ userId: OWNER, role: 'shop_admin', shopId: SHOP }, 'inv-1', { reason: 'test' });
apps\api\src\modules\auth\guards\policy.guard.spec.ts:27:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps\api\src\modules\auth\guards\policy.guard.spec.ts:47:  it('shop_admin bypasses — no cache or DB lookup', async () => {
apps\api\src\modules\auth\guards\policy.guard.spec.ts:50:      authenticated: true, shopId, role: 'shop_admin', tenant: {} as never, userId: 'u1',
apps\api\src\modules\auth\guards\policy.guard.spec.ts:63:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps\api\src\modules\auth\guards\policy.guard.spec.ts:80:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps\api\src\modules\auth\guards\policy.guard.spec.ts:95:      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
apps\api\src\modules\auth\guards\policy.guard.spec.ts:108:    expect(setCache).toHaveBeenCalledWith(shopId, 'shop_manager', { 'reports.view': true });
apps\api\src\modules\auth\guards\policy.guard.spec.ts:113:      authenticated: true, shopId, role: 'shop_staff', tenant: {} as never, userId: 'u1',
apps\api\src\modules\crm\consent.service.spec.ts:11:function authCtx(role = 'shop_admin'): any {
apps\api\src\modules\pricing\pricing.controller.spec.ts:45:  role: 'shop_admin',
apps\api\src\modules\billing\void.service.ts:85:    if (ctx.role !== 'shop_admin') {
apps\api\src\modules\billing\void.service.ts:207:    if (ctx.role !== 'shop_admin') {
apps\api\src\modules\pricing\pricing.service.spec.ts:111:  role: 'shop_admin',
apps\api\src\modules\pricing\pricing.controller.ts:133:  @Roles('shop_admin')
apps\api\src\modules\crm\crm.service.ts:88:    if (ctx.role === 'shop_staff') throw new ForbiddenException({ code: 'crm.staff_cannot_edit', message: 'Staff cannot edit customer records' });
apps\api\src\modules\custom-orders\custom-orders.controller.ts:76:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:86:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:97:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:107:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:125:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:143:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:154:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:164:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\custom-orders\custom-orders.controller.ts:175:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\reviews\reviews.controller.ts:32:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:52:  @Post('customers') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:58:  @Get('customers') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:65:  @Get('customers/search') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:82:  @Get('customers/:id') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:88:  @Patch('customers/:id') @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\crm\crm.controller.ts:93:  @Post('customers/:id/family') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:99:  @Delete('customers/:id/family/:linkId') @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\crm\crm.controller.ts:105:  @Get('customers/:id/family') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:111:  @Post('customers/:id/notes') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:117:  @Get('customers/:id/notes') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:123:  @Delete('customers/:id/notes/:noteId') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:129:  @Post('customers/:id/occasions') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:135:  @Get('customers/:id/occasions') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:141:  @Delete('customers/:id/occasions/:occId') @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\crm\crm.controller.ts:147:  @Get('customers/:id/history') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:161:  @Get('customers/:id/balance') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:167:  @Post('customers/:id/request-deletion') @Roles('shop_admin')
apps\api\src\modules\crm\crm.controller.ts:184:  @Post('customers/:id/restore-deletion') @Roles('shop_admin')
apps\api\src\modules\crm\crm.controller.ts:195:  @Get('customers/:id/consent/viewing') @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\crm\crm.controller.ts:201:  @Put('customers/:id/consent/viewing') @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\crm\crm-search.service.test.ts:16:    role: 'shop_admin',
apps\api\src\modules\crm\crm.service.spec.ts:37:function authCtx(role = 'shop_admin') { return { authenticated: true as const, shopId: SHOP, userId: USER, role } as any; }
apps\api\src\modules\crm\crm.service.spec.ts:95:    await expect(svc.updateCustomer(authCtx('shop_staff'), CUSTOMER_ID, { name: 'New Name' })).rejects.toMatchObject({ status: 403 });
apps\api\src\modules\crm\crm.service.spec.ts:99:    await expect(svc.updateCustomer(authCtx('shop_manager'), CUSTOMER_ID, { name: 'New Name' })).resolves.toBeDefined();
apps\api\src\modules\crm\occasions.service.spec.ts:24:  return { authenticated: true as const, shopId: SHOP, userId: USER, role: 'shop_admin' };
apps\api\src\modules\crm\dpdpa-deletion.service.spec.ts:12:function authCtx(role = 'shop_admin'): any {
apps\api\src\modules\crm\notes.service.spec.ts:25:  return { authenticated: true as const, shopId: SHOP, userId, role: 'shop_admin' };
apps\api\src\modules\crm\notes.service.spec.ts:137:    await svc.deleteNote(authCtx(), NOTE_ID, USER_AUTHOR, 'shop_staff');
apps\api\src\modules\crm\notes.service.spec.ts:144:  it('shop_admin can delete any note (even non-author)', async () => {
apps\api\src\modules\crm\notes.service.spec.ts:154:    await svc.deleteNote(authCtx(), NOTE_ID, USER_OTHER, 'shop_admin');
apps\api\src\modules\crm\notes.service.spec.ts:167:      svc.deleteNote(authCtx(), NOTE_ID, USER_OTHER, 'shop_staff'),
apps\api\src\modules\crm\notes.service.spec.ts:182:      svc.deleteNote(authCtx(), NOTE_ID, USER_OTHER, 'shop_manager'),
apps\api\src\modules\crm\notes.service.spec.ts:192:      svc.deleteNote(authCtx(), NOTE_ID, USER_AUTHOR, 'shop_admin'),
apps\api\src\modules\crm\notes.service.spec.ts:202:      svc.deleteNote(authCtx(), NOTE_ID, USER_AUTHOR, 'shop_admin'),
apps\api\src\modules\crm\notes.service.ts:90:      if (note.author_user_id !== requestingUserId && requestingRole !== 'shop_admin') {
apps\api\src\modules\crm\history.service.spec.ts:12:function authCtx(role = 'shop_admin'): any {
apps\api\src\modules\crm\family.service.spec.ts:13:function authCtx(role = 'shop_admin'): any {
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.controller.ts:37:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.controller.ts:46:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.controller.ts:55:  @Roles('shop_admin', 'shop_manager', 'shop_staff')
apps\api\src\modules\reports\reports.controller.ts:15:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\reports\reports.controller.ts:28:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\reports\reports.controller.ts:38:  @Roles('shop_admin', 'shop_manager')
apps\api\src\modules\reports\reports.controller.ts:47:  @Roles('shop_admin', 'shop_manager')
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg \"setTypeParser|types\\.setTypeParser|pg\\.types|int8|20,\" apps packages -n" in C:\Alok\Business Projects\Goldsmith
 succeeded in 483ms:
packages\ui-tokens\src\radii.ts:4:  lg:   20,
packages\integrations\search\test\meilisearch.adapter.test.ts:144:    const query = makeQuery({ q: 'मंगलसूत्र', limit: 20, offset: 40 });
packages\integrations\search\test\meilisearch.adapter.test.ts:148:      expect.objectContaining({ limit: 20, offset: 40 }),
packages\compliance\src\cash-restriction\section-269ss.ts:3:export const RESTRICTION_269SS_THRESHOLD_PAISE = 2_000_000n; // Rs 20,000 × 100
packages\compliance\src\cash-restriction\section-269ss.ts:7:// Section 269SS: prohibits accepting any loan/deposit/advance in cash ≥ Rs 20,000.
packages\compliance\src\cash-restriction\section-269ss.ts:8:// Section 269T: prohibits repaying any loan/deposit in cash ≥ Rs 20,000.
packages\compliance\src\cash-restriction\section-269ss.ts:9:// Both sections share the same Rs 20,000 threshold — use type to distinguish.
packages\compliance\src\cash-restriction\section-269ss.test.ts:14:  it('blocks Rs 20,000 cash advance (at threshold — ≥ Rs 20,000 prohibited)', () => {
packages\compliance\src\cash-restriction\section-269ss.test.ts:41:  it('blocks Rs 20,000 cash repayment (Section 269T — same threshold)', () => {
packages\compliance\src\cash-restriction\section-269ss.test.ts:54:  it('blocks Rs 20,000 cash deposit', () => {
packages\ui-mobile\src\primitives\Skeleton.tsx:11:export function Skeleton({ height = 16, width = 120, testID }: SkeletonProps): React.ReactElement {
packages\shared\src\schemas\loyalty-config.schema.ts:14:  name:           z.string().min(1, { message: 'TIER_NAME_REQUIRED' }).max(20, { message: 'TIER_NAME_TOO_LONG' }),
packages\shared\src\schemas\loyalty-config.schema.ts:35:  name:            z.string().min(1, { message: 'TIER_NAME_REQUIRED' }).max(20, { message: 'TIER_NAME_TOO_LONG' }),
packages\shared\src\schemas\shop-profile.schema.ts:33:  name:              z.string().min(1, { message: 'NAME_REQUIRED' }).max(120, { message: 'NAME_TOO_LONG' }).optional(),
packages\ui-mobile\src\business\DailySummaryCard.tsx:73:    fontSize: 20,
packages\ui-mobile\src\business\RateUpdateToast.tsx:103:    maxWidth: 320,
packages\ui-mobile\src\business\InvoiceShareCelebration.tsx:113:  card:          { width: '100%', maxWidth: 360, borderRadius: 20, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
packages\ui-mobile\src\business\RateHistoryChart.tsx:24:const PAD = { top: 20, right: 16, bottom: 40, left: 8 };
apps\shopkeeper\app\(auth)\phone.tsx:70:            fontSize: 20,
apps\shopkeeper\app\(auth)\phone.tsx:82:          fontSize: 20,
apps\shopkeeper\app\(auth)\otp.tsx:148:            fontSize: 20,
apps\shopkeeper\app\(auth)\otp.tsx:160:          fontSize: 20,
apps\shopkeeper\app\try-at-home\index.tsx:102:  fab:         { position: 'absolute', bottom: 24, right: 20, zIndex: 10, backgroundColor: '#D4A85A', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, elevation: 6 },
apps\customer-web\content\size-guides\rings.json:28:    { "indian": 20, "circumferenceMm": 63.6, "diameterMm": 20.2 },
apps\customer-web\content\size-guides\chains.json:12:    { "inches": 20, "labelHi": "मेटिनी",       "styleHi": "छाती के ऊपरी हिस्से तक" },
apps\shopkeeper\app\settings\wastage.tsx:99:    fontSize: 20,
apps\shopkeeper\src\features\try-at-home\components\ReturnSheet.tsx:121:  sheet:        { backgroundColor: '#FFF8F0', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
apps\shopkeeper\src\features\try-at-home\components\ReturnSheet.tsx:122:  title:        { fontSize: 20, fontWeight: '700', color: '#3E2723', marginBottom: 4 },
apps\shopkeeper\app\settings\staff.tsx:555:    borderRadius: 20,
apps\shopkeeper\app\settings\staff.tsx:568:    borderRadius: 20,
apps\shopkeeper\app\settings\staff.tsx:616:    borderTopLeftRadius: 20,
apps\shopkeeper\app\settings\staff.tsx:617:    borderTopRightRadius: 20,
apps\shopkeeper\app\settings\return-policy.tsx:128:    minHeight: 120,
packages\db\src\migrations\0044_custom_orders.sql:5:-- Section 269SS enforced at service layer for cash deposits ≥ Rs 20,000.
apps\shopkeeper\app\settings\index.tsx:76:    fontSize: 20,
apps\shopkeeper\app\settings\custom-order-policy.tsx:128:    minHeight: 120,
apps\shopkeeper\app\settings\account.tsx:164:    borderRadius: 20,
apps\shopkeeper\src\features\inventory\components\PublishToggle.tsx:93:    borderRadius: 20,
apps\shopkeeper\src\features\inventory\components\InventorySearch.tsx:66:        params: { q: q.trim(), limit: 20, offset: 0 },
apps\shopkeeper\app\reports\gstr-export.tsx:139:  hint:             { marginTop: 20, fontSize: 13, color: '#78716c', textAlign: 'center' },
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:221:    borderTopLeftRadius: 20,
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:222:    borderTopRightRadius: 20,
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:223:    paddingHorizontal: 20,
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:237:    fontSize: 20,
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:248:    lineHeight: 20,
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:322:    padding: 20,
apps\shopkeeper\src\features\billing\components\VoidInvoiceSheet.tsx:342:    marginBottom: 20,
apps\shopkeeper\src\features\billing\components\PmlaWarningBanner.tsx:103:    paddingHorizontal: 20,
apps\shopkeeper\src\features\billing\components\PaymentMethodSelector.tsx:202:  totalRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#D4A843' },
apps\shopkeeper\src\features\billing\components\PaymentMethodSelector.tsx:204:  totalAmount:      { fontSize: 20, fontWeight: '700', color: '#2C1810' },
apps\shopkeeper\src\features\billing\components\PaymentMethodSelector.tsx:222:  completeButton:   { marginTop: 20, backgroundColor: '#D4A843', borderRadius: 8, paddingVertical: 16, alignItems: 'center', minHeight: 52 },
apps\shopkeeper\src\features\billing\components\PanPromptSheet.tsx:256:    borderTopLeftRadius: 20,
apps\shopkeeper\src\features\billing\components\PanPromptSheet.tsx:257:    borderTopRightRadius: 20,
apps\shopkeeper\src\features\billing\components\PanPromptSheet.tsx:258:    paddingHorizontal: 20,
apps\shopkeeper\src\features\billing\components\PanPromptSheet.tsx:272:    fontSize: 20,
apps\shopkeeper\app\rates\override.tsx:358:    fontSize: 20,
apps\shopkeeper\src\features\billing\components\LoyaltyRedeemSheet.tsx:156:    padding: 20,
apps\shopkeeper\src\features\rate-lock\RateLockListScreen.tsx:160:  title:        { fontSize: 20, fontWeight: '700', color: '#1C1917' },
apps\shopkeeper\src\features\rate-lock\RateLockListScreen.tsx:188:  statusChip:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
apps\shopkeeper\src\features\rate-lock\RateLockDetailScreen.tsx:28:  { label: '20K', numerator: 20, denominator: 24 },
apps\shopkeeper\src\features\rate-lock\RateLockDetailScreen.tsx:197:  countdown:    { fontSize: 20, fontWeight: '700', color: '#059669', marginBottom: 4 },
apps\shopkeeper\src\features\billing\components\CtrDownloadCard.tsx:119:    fontSize: 20,
apps\shopkeeper\src\features\rate-lock\CreateRateLockSheet.tsx:168:    borderTopLeftRadius: 20,
apps\shopkeeper\src\features\rate-lock\CreateRateLockSheet.tsx:169:    borderTopRightRadius: 20,
apps\shopkeeper\src\features\rate-lock\CreateRateLockSheet.tsx:179:    marginBottom: 20,
apps\shopkeeper\src\features\rate-lock\CreateRateLockSheet.tsx:181:  title:             { fontSize: 20, fontWeight: '700', color: '#1C1917', marginBottom: 20 },
apps\shopkeeper\src\features\rate-lock\CreateRateLockSheet.tsx:186:    marginBottom: 20,
apps\shopkeeper\src\features\custom-orders\components\AddMilestoneSheet.tsx:98:  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D4A85A' },
apps\shopkeeper\src\features\custom-orders\components\AddMilestoneSheet.tsx:106:  footer:         { padding: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#D4A85A' },
apps\shopkeeper\src\features\billing\components\CashCapBlockModal.tsx:227:    borderTopLeftRadius: 20,
apps\shopkeeper\src\features\billing\components\CashCapBlockModal.tsx:228:    borderTopRightRadius: 20,
apps\shopkeeper\src\features\billing\components\CashCapBlockModal.tsx:229:    padding: 20,
apps\shopkeeper\src\features\billing\components\CashCapBlockModal.tsx:244:    fontSize: 20,
apps\shopkeeper\app\inventory\[id]\analytics.tsx:21:const PAD = { top: 20, right: 16, bottom: 36, left: 8 };
apps\customer-mobile\src\components\TenantBrandHeader.tsx:61:          fontSize: 20,
apps\api\src\modules\billing\billing.repository.ts:177:                   $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
apps\shopkeeper\src\features\crm\components\OccasionsSection.tsx:491:  modalContent: { padding: 20, gap: 12, paddingBottom: 40 },
apps\shopkeeper\src\features\crm\components\OccasionsSection.tsx:500:    borderRadius: 20,
apps\shopkeeper\src\features\crm\components\NotesSection.tsx:275:    maxHeight: 120,
apps\shopkeeper\app\customers\[id].tsx:28:const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F5EDDD' }, content: { padding: 20, paddingBottom: 48, gap: 20 }, header: { gap: 4, marginBottom: 8 }, customerName: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 22, color: '#5C3D11' }, customerPhone: { fontSize: 16, color: '#7A5400' } });
apps\shopkeeper\app\customers\new.tsx:74:  container: { flex: 1, backgroundColor: '#F5EDDD' }, content: { padding: 20, paddingBottom: 48 },
apps\shopkeeper\src\features\crm\components\LoyaltyAdjustModal.tsx:179:    padding: 20,
apps\shopkeeper\src\features\crm\components\FamilyLinker.tsx:239:    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start',
apps\shopkeeper\src\features\crm\components\FamilyLinker.tsx:251:  modal: { flex: 1, backgroundColor: '#FFFBF2', padding: 20, gap: 16 },
apps\shopkeeper\src\features\crm\components\FamilyLinker.tsx:270:    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
apps\customer-mobile\app\browse\[id].tsx:118:            <Text style={{ fontSize: 20, color: colors.primary }}>←</Text>
apps\customer-mobile\app\browse\size-guide.tsx:25:  { indian: 19, circMm: 62.3, diaM: 19.8 }, { indian: 20, circMm: 63.6, diaM: 20.2 },
apps\customer-mobile\app\browse\size-guide.tsx:36:  { inches: 18, label: 'प्रिंसेस' }, { inches: 20, label: 'मेटिनी' },
apps\shopkeeper\src\features\crm\components\DeletionRequestSheet.tsx:148:    backgroundColor: 'rgba(20, 12, 0, 0.55)',
apps\shopkeeper\src\features\crm\components\DeletionRequestSheet.tsx:158:  scrollInner: { padding: 20, paddingBottom: 12, gap: 12 },
apps\shopkeeper\src\features\crm\components\DeletionRequestSheet.tsx:207:    paddingHorizontal: 20,
apps\api\src\modules\billing\billing.controller.ts:219:    const limit  = Math.min(Math.max(pageSize ?? 20, 1), 100);
apps\shopkeeper\app\custom-orders\[id].tsx:100:          'धारा 269SS: ₹20,000 या उससे अधिक नकद अग्रिम स्वीकार नहीं किया जा सकता।',
apps\shopkeeper\app\custom-orders\[id].tsx:255:  chip:             { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 },
apps\shopkeeper\app\custom-orders\new.tsx:110:  content:           { padding: 20, paddingBottom: 48, gap: 4 },
apps\shopkeeper\app\custom-orders\index.tsx:102:  screenTitle:  { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 20, color: '#5C3D11' },
apps\shopkeeper\app\custom-orders\index.tsx:109:  chip:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 },
apps\api\src\modules\billing\payment.service.ts:571:    // Section 269SS: cash advances ≥ Rs 20,000 are prohibited — no override.
apps\shopkeeper\src\features\compliance\StrDownloadCard.tsx:80:    fontSize:    20,
apps\shopkeeper\app\billing\[id].tsx:178:    marginTop: 20,
apps\shopkeeper\app\billing\[id].tsx:195:    marginTop: 20,
apps\shopkeeper\app\billing\urd-exchange.tsx:106:    <ScrollView style={{ flex:1, backgroundColor:CREAM }} contentContainerStyle={{ padding:20, paddingBottom:48 }}>
apps\shopkeeper\app\billing\urd-exchange.tsx:143:        <View style={{ marginTop:20, backgroundColor:'#FFF8EE', borderRadius:10, borderWidth:1, borderColor:'#E8D5B0', padding:16 }}>
apps\shopkeeper\app\billing\estimate\[id].tsx:261:    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
apps\shopkeeper\app\billing\estimate\[id].tsx:285:    fontSize: 20, fontWeight: '700', color: '#92400e',
apps\shopkeeper\app\(tabs)\index.tsx:59:                  fontSize: 20,
apps\shopkeeper\app\(tabs)\reports.tsx:182:    paddingHorizontal: 20,
apps\api\src\modules\custom-orders\custom-orders.controller.ts:89:    @Query('limit',  new ParseIntPipe({ optional: true })) limit  = 20,
apps\api\src\modules\custom-orders\custom-orders.service.ts:155:      // Section 269SS: cash advance ≥ Rs 20,000 is prohibited
apps\api\src\modules\custom-orders\custom-orders.service.ts:196:    // Section 269SS: cash advance ≥ Rs 20,000 prohibited
apps\api\src\modules\auth\auth.controller.ts:173:      pageSize: Number.isFinite(parsedPageSize) ? Math.min(50, Math.max(1, parsedPageSize)) : 20,
apps\api\src\modules\auth\auth.controller.spec.ts:230:        pageSize: 20,
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.controller.ts:49:    @Query('limit',  new ParseIntPipe({ optional: true })) limit  = 20,
apps\api\src\modules\crm\history.service.spec.ts:65:    const result = await svc.getPurchaseHistory(authCtx(), CUSTOMER_ID, { limit: 20, offset: 0 });
apps\api\src\modules\crm\history.service.spec.ts:85:    await expect(svc.getPurchaseHistory(authCtx(), CUSTOMER_ID, { limit: 20, offset: 0 }))
apps\api\src\modules\crm\crm.controller.ts:61:    return this.svc.listCustomers(ctx, query.q, query.limit ?? 20, query.offset ?? 0);
apps\api\src\modules\crm\crm.controller.ts:77:      limit:  Math.max(1, Math.min(parseInt(limitStr ?? '20', 10) || 20, 100)),
apps\api\src\modules\platform-admin\services\tenant-management.service.spec.ts:123:    const out = await svc.listShops({ page: 2, pageSize: 20, search: 'dem' });
apps\api\src\modules\inventory\inventory.controller.ts:69:    const limit = Math.min(parseInt(limitStr, 10) || 20, 100); // cap at 100
apps\api\src\modules\inventory\inventory.repository.test.ts:89:        repo.listProducts({ limit: 20, offset: 0 }),
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg \"withTenantTx|Pool\\(\" packages apps -n -g \"*.ts\" --max-count 80" in C:\Alok\Business Projects\Goldsmith
 succeeded in 424ms:
packages\audit\test\platform-audit-log.integration.test.ts:15:    pool = createPool({ connectionString: container.getConnectionUri() });
packages\audit\test\audit-log.integration.test.ts:17:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\audit\src\audit-log.ts:2:import { withTenantTx } from '@goldsmith/db';
packages\audit\src\audit-log.ts:17:  await withTenantTx(pool, async (tx) => {
packages\sync\test\integration\tenant-isolation.integration.test.ts:6:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
packages\sync\test\integration\tenant-isolation.integration.test.ts:36:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\sync\test\integration\tenant-isolation.integration.test.ts:55:    withTenantTx(pool, async (tx) => {
packages\sync\test\integration\sync-cycle.integration.test.ts:5:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
packages\sync\test\integration\sync-cycle.integration.test.ts:29:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\sync\test\integration\sync-cycle.integration.test.ts:49:      withTenantTx(pool, async (tx) => {
packages\sync\test\integration\sync-cycle.integration.test.ts:79:      withTenantTx(pool, async (tx) => {
packages\sync\test\integration\adr-0004-conformance.test.ts:6:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
packages\sync\test\integration\adr-0004-conformance.test.ts:27:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\sync\test\integration\adr-0004-conformance.test.ts:49:        withTenantTx(pool, async (tx) => {
packages\sync\test\integration\adr-0004-conformance.test.ts:66:        withTenantTx(pool, async (tx) => advanceCursor(tx, SHOP_A)),
packages\testing\tenant-isolation\test\schema-assertions.integration.test.ts:13:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\compliance\src\pmla\cumulative.ts:37:// Call INSIDE an active withTenantTx after the 269ST check but BEFORE recording the payment.
packages\compliance\src\pmla\cumulative.ts:61:  await tx.query( // nosemgrep: goldsmith.require-tenant-transaction -- tx is provided by caller inside withTenantTx; this function has no pool access
packages\testing\tenant-isolation\test\harness.integration.test.ts:13:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\db\test\with-tenant-tx.integration.test.ts:7:import { withTenantTx } from '../src/tx';
packages\db\test\with-tenant-tx.integration.test.ts:19:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\db\test\with-tenant-tx.integration.test.ts:42:describe('withTenantTx', () => {
packages\db\test\with-tenant-tx.integration.test.ts:45:      withTenantTx(pool, async (tx) => (await tx.query('SELECT * FROM shop_users')).rows),
packages\db\test\with-tenant-tx.integration.test.ts:52:    await expect(withTenantTx(pool, async () => undefined)).rejects.toThrow(
packages\db\test\with-tenant-tx.integration.test.ts:60:        withTenantTx(pool, async (tx) => {
packages\sync\src\server\sync-logger.ts:6:// MUST be called inside an open withTenantTx — shares the caller's transaction
packages\db\test\poison-default.integration.test.ts:11:  pool = createPool({ connectionString: container.getConnectionUri() });
packages\db\test\poison-default.integration.test.ts:37:    const appPool = createPool({
packages\sync\src\server\push.ts:2:import { withTenantTx } from '@goldsmith/db';
packages\sync\src\server\push.ts:127:  await withTenantTx(pool, async (tx) => {
packages\sync\src\server\pull.ts:2:import { withTenantTx } from '@goldsmith/db';
packages\sync\src\server\pull.ts:50:  const { rows, cursor } = await withTenantTx(pool, async (tx) => {
packages\testing\tenant-isolation\src\harness.ts:3:import { withTenantTx, tableRegistry } from '@goldsmith/db';
packages\testing\tenant-isolation\src\harness.ts:44:        withTenantTx(pool, async (tx) => {
packages\db\src\tx.ts:5:export async function withTenantTx<T>(
packages\db\src\migrate.ts:31:  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
packages\db\src\index.ts:3:export { withTenantTx } from './tx';
apps\api\test\auth-duplicate-phone.integration.test.ts:22:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\audit-log-read.integration.test.ts:26:/** App pool created via createPool — sets poison GUC on-connect (used by withTenantTx). */
apps\api\test\audit-log-read.integration.test.ts:32:  superPool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\audit-log-read.integration.test.ts:35:  appPool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\audit-log-read.integration.test.ts:93:    // tenant shape only needs id for withTenantTx; other fields are unused by the query.
apps\api\test\audit-immutability.integration.test.ts:16:    superPool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\audit-immutability.integration.test.ts:20:    appPool = new Pool({ connectionString: container.getConnectionUri() });
apps\api\test\auth-link-migration.integration.test.ts:13:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\auth-repository.integration.test.ts:19:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\auth-repository.integration.test.ts:64:  it('linkFirebaseUid updates shop_users via tenant ctx + withTenantTx', async () => {
apps\api\test\auth-rate-limit.integration.test.ts:16:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\auth-missing-phone.integration.test.ts:23:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\estimate.integration.test.ts:65:  pool      = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\endpoint-walker.e2e.test.ts:57:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\_auth-test-setup.ts:24:  const pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\loyalty.integration.test.ts:5:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\loyalty.integration.test.ts:37:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\loyalty.integration.test.ts:49:    withTenantTx(pool, async (tx) =>
apps\api\test\loyalty.integration.test.ts:225:      withTenantTx(pool, async (tx) =>
apps\api\test\loyalty.integration.test.ts:237:    // Seed 100 points inside tenant context (withTenantTx requires it).
apps\api\test\loyalty.integration.test.ts:239:      withTenantTx(pool, async (tx) => {
apps\api\test\billing.integration.test.ts:25:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\billing.integration.test.ts:86:    withTenantTx(pool, async (tx) => {
apps\api\test\billing.integration.test.ts:137:  pool        = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\billing.integration.test.ts:532:      withTenantTx(pool, (tx) =>
apps\api\test\billing.integration.test.ts:550:      withTenantTx(pool, (tx) =>
apps\api\test\billing.integration.test.ts:560:      withTenantTx(pool, (tx) =>
apps\api\test\billing.integration.test.ts:577:      withTenantTx(pool, (tx) =>
apps\api\test\billing.integration.test.ts:616:      withTenantTx(pool, (tx) =>
apps\api\test\billing.integration.test.ts:640:      withTenantTx(pool, (tx) =>
packages\db\src\provider.ts:6:export function createPool(config: PoolConfig): Pool {
packages\db\src\provider.ts:7:  const pool = new Pool({
apps\api\test\drizzle-tenant-lookup.integration.test.ts:16:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\tenant-boot.integration.test.ts:19:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\dead-stock.integration.test.ts:19:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\dead-stock.integration.test.ts:54:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\dead-stock.integration.test.ts:75:      withTenantTx(pool, async (tx) => {
apps\api\test\dead-stock.integration.test.ts:102:      withTenantTx(pool, async (tx) => {
apps\api\test\dead-stock.integration.test.ts:118:      withTenantTx(pool, async (tx) => {
apps\api\test\stock-movements.integration.test.ts:5:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\stock-movements.integration.test.ts:28:    withTenantTx(pool, async (tx) => {
apps\api\test\stock-movements.integration.test.ts:44:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\crm-isolation.integration.test.ts:5:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\crm-isolation.integration.test.ts:23:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\crm-isolation.integration.test.ts:33:    withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:49:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:60:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:71:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:76:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:81:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:87:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:99:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:105:        withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:115:      withTenantTx(pool, async (tx) => {
apps\api\test\crm-isolation.integration.test.ts:124:      withTenantTx(pool, async (tx) => {
apps\api\test\publish-product.integration.test.ts:23:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\rates-chaos.test.ts:94:function makeNullPool(): Pool {
apps\api\test\rates-chaos.test.ts:193:    const pool = makeNullPool();
apps\api\test\rates-chaos.test.ts:214:    const pool = makeNullPool();
apps\api\test\inventory-isolation.integration.test.ts:5:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\inventory-isolation.integration.test.ts:17:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\inventory-isolation.integration.test.ts:36:    withTenantTx(pool, async (tx) => {
apps\api\test\inventory-isolation.integration.test.ts:56:      withTenantTx(pool, async (tx) => {
apps\api\test\inventory-isolation.integration.test.ts:69:      withTenantTx(pool, async (tx) => {
apps\api\test\rates-refresh.integration.test.ts:61:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\inventory-valuation.integration.test.ts:5:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\inventory-valuation.integration.test.ts:54:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\inventory-valuation.integration.test.ts:79:    withTenantTx(pool, async (tx) => {
apps\api\test\inventory-valuation.integration.test.ts:104:    withTenantTx(pool, async (tx) => {
apps\api\test\rls-fail-loud.integration.test.ts:15:    poisonedPool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\rls-fail-loud.integration.test.ts:18:    rawPool = new Pool({ connectionString: container.getConnectionUri() });
apps\api\test\search.integration.test.ts:17:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\search.integration.test.ts:48:    pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\search.integration.test.ts:71:      withTenantTx(pool, async (tx) => {
apps\api\test\search.integration.test.ts:86:      withTenantTx(pool, async (tx) => {
packages\db\src\schema\customer-loyalty.ts:6:// Updated under FOR UPDATE inside the same withTenantTx that inserts the
apps\api\test\logout-all.integration.test.ts:87:/** Wrap a call in a shop's tenant context (required by auditLog → withTenantTx). */
apps\api\test\settings\settings.integration.test.ts:65:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\settings\tenant-isolation.test.ts:17:import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
apps\api\test\settings\tenant-isolation.test.ts:46:  pool = createPool({ connectionString: container.getConnectionUri() });
apps\api\test\settings\tenant-isolation.test.ts:69:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:95:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:110:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:125:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:167:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:188:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:200:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:221:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:247:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:262:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:287:      withTenantTx(pool, async (tx) => {
apps\api\test\settings\tenant-isolation.test.ts:315:      withTenantTx(pool, async (tx) =>
apps\api\test\settings\tenant-isolation.test.ts:370:  it('shop_settings RLS prevents tenant A from reading tenant B loyalty via withTenantTx', async () => {
apps\api\test\settings\tenant-isolation.test.ts:377:      withTenantTx(pool, async (tx) => {
apps\api\src\workers\occasion-reminder.processor.spec.ts:19:function fakePool(client: any): any {
apps\api\src\workers\occasion-reminder.processor.spec.ts:48:    const proc = new OccasionReminderProcessor(fakePool(client));
apps\api\src\workers\occasion-reminder.processor.spec.ts:60:    const proc = new OccasionReminderProcessor(fakePool(client));
apps\api\src\workers\occasion-reminder.processor.spec.ts:77:    const proc = new OccasionReminderProcessor(fakePool(client));
apps\api\src\workers\occasion-reminder.processor.spec.ts:100:    const proc = new OccasionReminderProcessor(fakePool(client));
apps\api\src\workers\occasion-reminder.processor.spec.ts:115:    const proc = new OccasionReminderProcessor(fakePool(client));
apps\api\src\workers\occasion-reminder.processor.spec.ts:130:    const proc = new OccasionReminderProcessor(fakePool(client));
apps\api\src\workers\occasion-reminder.processor.spec.ts:143:    const proc = new OccasionReminderProcessor(fakePool(client));
apps\api\src\workers\loyalty-accrual.processor.spec.ts:42:function fakePool() {
apps\api\src\workers\loyalty-accrual.processor.spec.ts:65:    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());
apps\api\src\workers\loyalty-accrual.processor.spec.ts:80:    const proc = new LoyaltyAccrualProcessor(svc, redis, fakePool());
apps\api\src\workers\loyalty-accrual.processor.spec.ts:93:    const proc = new LoyaltyAccrualProcessor(svc, redis, fakePool());
apps\api\src\workers\loyalty-accrual.processor.spec.ts:102:    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());
apps\api\src\workers\loyalty-accrual.processor.spec.ts:124:    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());
apps\api\src\workers\loyalty-accrual.processor.spec.ts:132:    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());
apps\api\src\workers\loyalty-accrual.processor.spec.ts:144:    const proc = new LoyaltyAccrualProcessor(svc, fakeRedis(), fakePool());
apps\api\src\modules\auth\auth.repository.ts:3:import { withTenantTx, POISON_UUID } from '@goldsmith/db';
apps\api\src\modules\auth\auth.repository.ts:49:      withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\auth\auth.repository.ts:76:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\auth\auth.repository.ts:147:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\auth\auth.repository.invite.spec.ts:11:    // withTenantTx sequence: BEGIN → SET LOCAL ROLE app_user → SET LOCAL app.current_shop_id
apps\api\src\modules\auth\auth.repository.invite.spec.ts:36:    // withTenantTx sequence: BEGIN → SET LOCAL ROLE app_user → SET LOCAL app.current_shop_id
apps\api\src\modules\auth\auth.repository.invite.spec.ts:152:    // withTenantTx: BEGIN → SET LOCAL ROLE → SET LOCAL shop_id → UPDATE (0 rows) → COMMIT → POISON
apps\api\src\modules\auth\auth.repository.invite.spec.ts:182:    // withTenantTx sequence: BEGIN → SET LOCAL ROLE app_user → SET LOCAL app.current_shop_id → UPDATE → COMMIT → POISON (finally) → release
apps\api\src\modules\crm\occasions.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\occasions.service.ts:110:    const occ = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\occasions.service.ts:142:    const rows = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\occasions.service.ts:153:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\auth\auth.module.ts:23:      useFactory: () => createPool({ connectionString: process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/goldsmith_dev' }),
apps\api\src\modules\crm\occasions.service.spec.ts:5:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\occasions.service.spec.ts:10:  return { ...actual, withTenantTx: vi.fn() };
apps\api\src\modules\crm\occasions.service.spec.ts:27:function fakePool(): any {
apps\api\src\modules\crm\occasions.service.spec.ts:51:  (withTenantTx as any).mockImplementation(
apps\api\src\modules\crm\occasions.service.spec.ts:149:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:170:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:187:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:209:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:223:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:239:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:247:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:262:    const svc = new OccasionsService(fakePool());
apps\api\src\modules\crm\occasions.service.spec.ts:268:    expect(withTenantTx).toHaveBeenCalled();
apps\api\src\modules\crm\notes.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\notes.service.ts:43:    const note = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\notes.service.ts:65:    const rows = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\notes.service.ts:83:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\notes.service.spec.ts:5:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\notes.service.spec.ts:10:  return { ...actual, withTenantTx: vi.fn() };
apps\api\src\modules\crm\notes.service.spec.ts:28:function fakePool(): any {
apps\api\src\modules\crm\notes.service.spec.ts:53:  (withTenantTx as any).mockImplementation(
apps\api\src\modules\crm\notes.service.spec.ts:66:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:85:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:104:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:118:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:135:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:152:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:164:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:179:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:189:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:199:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:211:  it('all writes use current_setting tenant guard inside withTenantTx', async () => {
apps\api\src\modules\crm\notes.service.spec.ts:214:    const svc = new NotesService(fakePool());
apps\api\src\modules\crm\notes.service.spec.ts:222:    // withTenantTx wraps every write — service never bypasses it
apps\api\src\modules\crm\notes.service.spec.ts:223:    expect(withTenantTx).toHaveBeenCalled();
apps\api\src\modules\auth\auth.controller.spec.ts:49:// Mock pool for auditLog (withTenantTx pattern)
apps\api\src\modules\auth\permissions.repository.ts:3:import { withTenantTx, POISON_UUID } from '@goldsmith/db';
apps\api\src\modules\auth\permissions.repository.ts:33:        withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\auth\permissions.repository.spec.ts:9:function makePool(rows: Record<string, unknown>[]): import('pg').Pool {
apps\api\src\modules\auth\permissions.repository.spec.ts:28:    const repo = new PermissionsRepository(makePool(rows));
apps\api\src\modules\auth\permissions.repository.spec.ts:37:    const repo = new PermissionsRepository(makePool([]));
apps\api\src\modules\auth\audit-log.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\auth\audit-log.repository.ts:92:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\auth\audit-log.repository.spec.ts:5:// Mock withTenantTx so unit tests don't need a real pool or tenant context.
apps\api\src\modules\auth\audit-log.repository.spec.ts:11:  withTenantTx: vi.fn((_pool: unknown, fn: (tx: { query: typeof mockQuery }) => Promise<unknown>) =>
apps\api\src\modules\crm\family.service.spec.ts:17:function fakePool() {
apps\api\src\modules\crm\family.service.spec.ts:49:  return new FamilyService(pool ?? fakePool(), repo ?? fakeRepo());
apps\api\src\modules\crm\family.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\family.repository.ts:38:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\family.repository.ts:55:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\family.repository.ts:69:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\family.repository.ts:90:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\family.repository.ts:100:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\dpdpa-deletion.service.ts:10:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\dpdpa-deletion.service.ts:94:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\dpdpa-deletion.service.ts:126:   * correlation; actual scoping is enforced by withTenantTx + RLS.
apps\api\src\modules\crm\dpdpa-deletion.service.spec.ts:16:function fakePool(): any {
apps\api\src\modules\crm\dpdpa-deletion.service.spec.ts:37:    overrides.pool ?? fakePool(),
apps\api\src\modules\crm\dpdpa-deletion.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\dpdpa-deletion.repository.ts:54:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\dpdpa-deletion.repository.ts:157:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:22:function fakePool() {
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:91:  const pool     = opts.pool     ?? fakePool();
apps\api\src\modules\crm\crm.service.spec.ts:15:function fakePool() {
apps\api\src\modules\crm\crm.service.spec.ts:32:  const pool = overrides.pool ?? fakePool();
apps\api\src\modules\crm\crm.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\crm.repository.ts:33:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\crm.repository.ts:44:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\crm.repository.ts:58:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\crm.repository.ts:66:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\try-at-home-bookings\try-at-home-bookings.repository.ts:93:  getPool(): Pool {
apps\api\src\modules\analytics\analytics.service.spec.ts:17:function makePool(client: ReturnType<typeof makeMockClient>) {
apps\api\src\modules\analytics\analytics.service.spec.ts:97:    const svc = makeService(makePool(client));
apps\api\src\modules\analytics\analytics.service.spec.ts:110:    const svc = makeService(makePool(client));
apps\api\src\modules\analytics\analytics.service.spec.ts:123:    const svc = makeService(makePool(client));
apps\api\src\modules\analytics\analytics.service.spec.ts:136:    const svc = makeService(makePool(client));
apps\api\src\modules\analytics\analytics.service.spec.ts:149:    const svc = makeService(makePool(client));
apps\api\src\modules\analytics\analytics.service.spec.ts:162:    const svc = makeService(makePool(client));
apps\api\src\modules\analytics\analytics.service.spec.ts:187:    const svc = makeService(makePool(client));
apps\api\src\modules\analytics\analytics.service.spec.ts:205:    const svc = makeService(makePool(client));
apps\api\src\modules\reports\reports.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\reports\reports.service.ts:56:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\reports\reports.service.ts:112:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\reports\reports.service.ts:180:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\reports\reports.service.ts:205:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\consent.service.spec.ts:15:function fakePool() {
apps\api\src\modules\crm\consent.service.spec.ts:46:  return new ConsentService(pool ?? fakePool(), repo ?? fakeRepo());
apps\api\src\modules\auth\auth.service.ts:5:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\auth\auth.service.ts:274:      withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\consent.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\crm\consent.repository.ts:36:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\consent.repository.ts:51:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\crm\consent.repository.ts:93:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\auth\auth.service.spec.ts:37:  // auditLog → withTenantTx: BEGIN, SET LOCAL ROLE, SET LOCAL current_shop_id, INSERT, COMMIT, POISON release
apps\api\src\modules\auth\auth.service.spec.ts:41:      // auditLog → withTenantTx sequence:
apps\api\src\modules\auth\auth.service.spec.ts:52:  // We need two connect() calls: one for loadTenantById, one for auditLog's withTenantTx
apps\api\src\modules\auth\auth.service.spec.ts:61:      .mockResolvedValueOnce(mockClient),    // withTenantTx (auditLog)
apps\api\src\modules\auth\auth.service.spec.ts:135:    // The second pool.connect() is the auditLog withTenantTx client
apps\api\src\modules\auth\auth.service.spec.ts:140:    // Find the INSERT call — 4th query (index 3) in the withTenantTx sequence
apps\api\src\modules\auth\auth.service.spec.ts:242:  // For logoutAll we need a pool that handles withTenantTx (BEGIN/GUC/INSERT/COMMIT)
apps\api\src\modules\auth\auth.service.spec.ts:348: * connect() call 2 = auditClient for auditLog withTenantTx
apps\api\src\modules\reports\reports.service.spec.ts:15:  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) => {
apps\api\src\modules\reports\reports.service.spec.ts:23:function makePool() {
apps\api\src\modules\reports\reports.service.spec.ts:28:  return new ReportsService(makePool());
apps\api\src\modules\sync\sync.module.ts:18:        createPool({ connectionString: process.env['DATABASE_URL'] ?? 'postgresql://localhost/goldsmith' }),
apps\api\src\modules\inventory\stock-movement.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\inventory\stock-movement.repository.ts:67:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\stock-movement.repository.ts:90:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\stock-movement.repository.ts:149:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:49:function makePool(client: ReturnType<typeof makeMockClient>) {
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:71:    const svc = makeService(makePool(client));
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:85:    const svc = makeService(makePool(client));
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:98:    const svc = makeService(makePool(client));
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:109:    const svc = makeService(makePool(client));
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:120:    const svc = makeService(makePool(client));
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:131:    const svc = makeService(makePool(client));
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:140:    const svc = makeService(makePool(client));
apps\api\src\modules\inventory\inventory.dead-stock.service.test.ts:149:    const svc = makeService(makePool(client));
apps\api\src\modules\catalog\catalog.service.spec.ts:23:function makePool(responses: Array<{ rows: object[] }>) {
apps\api\src\modules\catalog\catalog.service.spec.ts:30:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:47:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:61:    const pool = makePool([{ rows: [] }]);
apps\api\src\modules\catalog\catalog.service.spec.ts:87:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:104:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:118:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:132:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:149:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:167:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:181:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:202:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:218:    const pool = makePool([
apps\api\src\modules\catalog\catalog.service.spec.ts:235:    const pool = makePool([]);
apps\api\src\modules\catalog\catalog.service.spec.ts:247:    const pool = makePool([]);
apps\api\src\modules\catalog\catalog.service.spec.ts:268:    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
apps\api\src\modules\catalog\catalog.service.spec.ts:279:    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
apps\api\src\modules\catalog\catalog.service.spec.ts:290:    const pool = makePool([{ rows: [{ huid: 'ZZ9999' }] }]);
apps\api\src\modules\catalog\catalog.service.spec.ts:300:    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
apps\api\src\modules\catalog\catalog.service.spec.ts:310:    const pool = makePool([{ rows: [{ huid: null }] }]);
apps\api\src\modules\catalog\catalog.service.spec.ts:319:    const pool = makePool([{ rows: [{ huid: 'ab1234' }] }]);
apps\api\src\modules\catalog\catalog.service.spec.ts:328:    const pool = makePool([]);
apps\api\src\modules\catalog\catalog.service.spec.ts:336:    const pool = makePool([]);
apps\api\src\modules\catalog\catalog.service.spec.ts:344:    const pool = makePool([{ rows: [] }]);
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:15:vi.mock('@goldsmith/db', () => ({ withTenantTx: vi.fn() }));
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:56:    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([B2C_INVOICE])));
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:74:    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([IGST_INVOICE])));
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:86:    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([IGST_INVOICE])));
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:95:    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([IGST_INVOICE])));
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:103:    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([])));
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:112:    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) => fn(makeTx([B2C_INVOICE, B2C_INVOICE])));
apps\api\src\modules\billing\billing-5.10-5.12.spec.ts:132:    vi.mocked(db.withTenantTx).mockImplementation((_p, fn) =>
apps\api\src\modules\billing\billing.repository.ts:4:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\billing.repository.ts:162:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.repository.ts:273:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.repository.ts:292:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.repository.ts:310:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.repository.ts:323:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.repository.ts:339:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:110:function fakePool(): any {
apps\api\src\modules\billing\billing.service.convert-estimate.spec.ts:144:    overrides.pool ?? fakePool(),
apps\api\src\modules\billing\billing.service.loyalty.spec.ts:17:  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: any) => Promise<unknown>) => {
apps\api\src\modules\billing\billing.service.rate-lock.spec.ts:18:  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: any) => Promise<unknown>) => {
apps\api\src\modules\billing\billing.service.spec.ts:18:function fakePool(opts: { customerExists?: boolean } = {}) {
apps\api\src\modules\billing\billing.service.spec.ts:153:      fakeRedis() as any, fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:191:    const svc = new BillingService(repo as any, inv as any, fakePricing() as any, redis as any, fakePool(), undefined as any, undefined as any, undefined as any);
apps\api\src\modules\billing\billing.service.spec.ts:206:      fakeRedis() as any, fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:222:    const svc  = new BillingService(repo as any, inv as any, fakePricing() as any, fakeRedis() as any, fakePool(), undefined as any, undefined as any, undefined as any);
apps\api\src\modules\billing\billing.service.spec.ts:249:      fakeRedis() as any, fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:296:      fakeRedis() as any, fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:328:      fakeRedis() as any, fakePool({ customerExists: false }), // simulate not-found
apps\api\src\modules\billing\billing.service.spec.ts:355:      fakeRedis() as any, fakePool({ customerExists: true }),
apps\api\src\modules\billing\billing.service.spec.ts:400:      fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:424:      fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:448:      fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:474:      fakePool(),
apps\api\src\modules\billing\billing.service.spec.ts:582:      fakePool(),
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:10:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:175:  // Called before withTenantTx in billing.service.ts; no PoolClient available yet.
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:315:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.ts:346:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.service.ts:12:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\billing.service.ts:764:    // Fetch the custom order (tenant-scoped via withTenantTx to arm GUC)
apps\api\src\modules\billing\billing.service.ts:773:    const order = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\billing.service.ts:852:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\compliance-reports.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\compliance-reports.service.ts:54:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\compliance-reports.service.ts:180:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\estimate.service.spec.ts:19:  withTenantTx: async (pool: any, fn: (client: any) => Promise<unknown>) => fn(pool.__client),
apps\api\src\modules\billing\estimate.service.spec.ts:50:function makePool(queryFn: (sql: string, params?: any[]) => Promise<{ rows: any[] }>): any {
apps\api\src\modules\billing\estimate.service.spec.ts:61:        makePool(async (sql: string) => {
apps\api\src\modules\billing\estimate.service.spec.ts:99:        makePool(async (sql: string) => {
apps\api\src\modules\billing\estimate.service.spec.ts:110:        makePool(async () => ({ rows: [] })),
apps\api\src\modules\billing\estimate.service.spec.ts:121:        makePool(async (sql: string) => {
apps\api\src\modules\billing\estimate.service.spec.ts:136:        makePool(async (sql: string) => {
apps\api\src\modules\billing\estimate.service.spec.ts:148:      svc = new EstimateService(makePool(async () => ({ rows: [] })));
apps\api\src\modules\billing\estimate.service.spec.ts:156:        makePool(async (sql: string) => {
apps\api\src\modules\billing\estimate.service.spec.ts:165:      svc = new EstimateService(makePool(async () => ({ rows: [] })));
apps\api\src\modules\billing\estimate.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\estimate.service.ts:99:    const row = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\estimate.service.ts:137:    const row = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\estimate.service.ts:155:    const rows = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\estimate.service.ts:175:    const row = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\estimate.service.ts:206:    const r = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\gstr-export.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\gstr-export.service.ts:194:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\inventory\inventory.repository.ts:88:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:120:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:130:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:145:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:168:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:187:      await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:234:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:249:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:268:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:303:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:313:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:326:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:339:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\inventory\inventory.repository.ts:352:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\invoice-pdf.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\invoice-pdf.service.ts:194:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:29:function makePool(opts: {
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:102:  const pool     = makePool(opts);
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:175:      const pool = makePool();
apps\api\src\modules\rate-lock-bookings\rate-lock-bookings.service.spec.ts:191:      const pool = makePool();
apps\api\src\modules\custom-orders\custom-orders.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\custom-orders\custom-orders.repository.ts:54:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\custom-orders\custom-orders.repository.ts:106:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\custom-orders\custom-orders.repository.ts:126:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\custom-orders\custom-orders.repository.ts:157:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\custom-orders\custom-orders.repository.ts:176:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\loyalty\loyalty.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\loyalty\loyalty.repository.ts:47:// Minimal tx shape — matches what withTenantTx hands us (a `query` method is enough).
apps\api\src\modules\loyalty\loyalty.repository.ts:58:  // Caller must already be inside a withTenantTx; the lock prevents concurrent accrual races.
apps\api\src\modules\loyalty\loyalty.repository.ts:125:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\loyalty\loyalty.repository.ts:139:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\loyalty\loyalty.repository.ts:159:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\loyalty\loyalty.repository.ts:172:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:15:vi.mock('@goldsmith/db', () => ({ withTenantTx: mockWithTenantTx }));
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:26:function makePool() {
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:54:  const pool    = opts?.pool    ?? makePool();
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:66:// ── Set up withTenantTx mock default before each test ─────────────────────────
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:100:    // withTenantTx called once for validation; NOT a second time for the payment insert.
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:118:    const pool = makePool();
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:134:    const pool = makePool();
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:143:    const pool = makePool(); // rows: [] — no matching payment
apps\api\src\modules\billing\payment.service.razorpay.spec.ts:154:    const pool = makePool();
apps\api\src\modules\loyalty\loyalty.service.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\loyalty\loyalty.service.ts:72:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\loyalty\loyalty.service.ts:163:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\loyalty\loyalty.service.ts:214:  // Must NOT create its own withTenantTx — operates on the passed-in tx.
apps\api\src\modules\loyalty\loyalty.service.ts:272:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\loyalty\loyalty.service.spec.ts:19:function fakePool(): any {
apps\api\src\modules\loyalty\loyalty.service.spec.ts:71:// Mock @goldsmith/db so withTenantTx hands us a stub tx that captures all queries.
apps\api\src\modules\loyalty\loyalty.service.spec.ts:74:  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: TxLike) => Promise<unknown>) => {
apps\api\src\modules\loyalty\loyalty.service.spec.ts:92:    opts.pool ?? fakePool(),
apps\api\src\modules\billing\payment.service.ts:5:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\payment.service.ts:153:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\payment.service.ts:433:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\payment.service.ts:451:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\payment.service.ts:460:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\payment.service.ts:573:    // TODO(Wave 3): DB write — INSERT INTO custom_order_advances (...) within withTenantTx
apps\api\src\modules\billing\payment.service.ts:580:      withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\payment.service.spec.ts:28:  return { ...actual, withTenantTx: vi.fn() };
apps\api\src\modules\billing\payment.service.spec.ts:66:function fakePool(
apps\api\src\modules\billing\payment.service.spec.ts:75:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\payment.service.spec.ts:79:  (withTenantTx as any).mockImplementation((_p: any, fn: (tx: any) => Promise<any>) =>
apps\api\src\modules\billing\payment.service.spec.ts:102:    const pool = fakePool(INVOICE_ROW, 0n);
apps\api\src\modules\billing\payment.service.spec.ts:114:    const pool = fakePool(null, 0n);
apps\api\src\modules\billing\payment.service.spec.ts:125:    const pool = fakePool(INVOICE_ROW, 18_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:135:    const pool = fakePool(INVOICE_ROW, 0n);
apps\api\src\modules\billing\payment.service.spec.ts:145:    const pool = fakePool(INVOICE_ROW, 18_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:159:    const pool = fakePool(INVOICE_ROW, 18_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:173:    const pool = fakePool(INVOICE_ROW, 18_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:183:    const pool = fakePool(INVOICE_ROW, 0n);
apps\api\src\modules\billing\payment.service.spec.ts:196:    const pool = fakePool(INVOICE_ROW, 0n); // zero existing — payment is within limit
apps\api\src\modules\billing\payment.service.spec.ts:223:    const pool = fakePool(INVOICE_ROW, 0n, 80_300_000n); // monthly SUM = Rs 8,03,000
apps\api\src\modules\billing\payment.service.spec.ts:240:    const pool = fakePool(INVOICE_ROW, 0n, 80_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:255:    const pool = fakePool(INVOICE_ROW, 0n, 83_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:269:    const pool = fakePool(INVOICE_ROW, 0n, 90_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:284:    const pool = fakePool(INVOICE_ROW, 0n, 50_000_000n); // Rs 5L — ok
apps\api\src\modules\billing\payment.service.spec.ts:294:    const pool = fakePool(INVOICE_ROW, 0n, 50_000_000n);
apps\api\src\modules\billing\payment.service.spec.ts:309:    const pool = fakePool(INVOICE_ROW, 0n, 80_000_000n); // warn threshold
apps\api\src\modules\billing\urd.service.ts:4:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\urd.service.ts:93:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\urd.service.ts:125:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\urd.service.ts:166:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\story-5.6-pmla-block-ctr.spec.ts:113:    // withTenantTx sets this GUC before any query.
apps\api\src\modules\billing\story-5.6-pmla-block-ctr.spec.ts:116:    const rls_enforced_by = 'withTenantTx GUC + pmla_aggregates RLS policy';
apps\api\src\modules\billing\void.service.spec.ts:43:// ── Mock pg pool (withTenantTx runs the callback on a fake client) ────────────
apps\api\src\modules\billing\void.service.spec.ts:46:  withTenantTx: async (pool: any, fn: (client: any) => Promise<unknown>) => {
apps\api\src\modules\billing\void.service.spec.ts:59:function makePool(querySeq: Array<{ rows: unknown[] }>): any {
apps\api\src\modules\billing\void.service.spec.ts:74:    const svc = new VoidService(makePool([]));
apps\api\src\modules\billing\void.service.spec.ts:81:    const svc = new VoidService(makePool([]));
apps\api\src\modules\billing\void.service.spec.ts:88:    const svc = new VoidService(makePool([]));
apps\api\src\modules\billing\void.service.spec.ts:97:    const pool = makePool([{ rows: [] }]); // SELECT FOR UPDATE returns nothing
apps\api\src\modules\billing\void.service.spec.ts:105:    const pool = makePool([{ rows: [invoiceRow({ status: 'VOIDED', voided_at: new Date() })] }]);
apps\api\src\modules\billing\void.service.spec.ts:116:    const pool = makePool([{ rows: [invoiceRow({ issued_at: expiredIssuedAt })] }]);
apps\api\src\modules\billing\void.service.spec.ts:127:    const pool = makePool([
apps\api\src\modules\billing\void.service.spec.ts:146:    const svc = new VoidService(makePool([]));
apps\api\src\modules\billing\void.service.spec.ts:153:    const pool = makePool([{ rows: [] }]);
apps\api\src\modules\billing\void.service.spec.ts:162:    const pool = makePool([{ rows: [{ id: 'inv-1', status: 'ISSUED', issued_at: issuedAt(60 * 60 * 1000), total_paise: 100_000n, shop_id: SHOP }] }]);
apps\api\src\modules\billing\void.service.spec.ts:181:    const pool = makePool([
apps\api\src\modules\settings\settings.repository.ts:3:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\settings\settings.repository.ts:27:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:41:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:73:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:85:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:100:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:138:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:149:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:180:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:214:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:229:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:241:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:255:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:291:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:302:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:329:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:340:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:367:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\settings\settings.repository.ts:381:    return withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\pricing\pricing.service.spec.ts:17:// Mock withTenantTx (Story 4.2: setOverride/getActiveOverride use it)
apps\api\src\modules\pricing\pricing.service.spec.ts:22:  withTenantTx: vi.fn(
apps\api\src\modules\billing\void.service.ts:10:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\billing\void.service.ts:91:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\billing\void.service.ts:143:        // withTenantTx which cannot participate in the outer void transaction.
apps\api\src\modules\billing\void.service.ts:213:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\pricing\pricing.service.ts:8:import { withTenantTx } from '@goldsmith/db';
apps\api\src\modules\pricing\pricing.service.ts:368:    await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\pricing\pricing.service.ts:428:    // DB query through withTenantTx (RLS-enforced)
apps\api\src\modules\pricing\pricing.service.ts:429:    const row = await withTenantTx(this.pool, async (tx) => {
apps\api\src\modules\platform-admin\platform-admin.module.ts:43:      useFactory: (): Pool => createPool({
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "type \"packages\\db\\src\\provider.ts\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 431ms:
import { Pool, type PoolConfig } from 'pg';
import { logger } from '@goldsmith/observability';

export const POISON_UUID = '00000000-0000-0000-0000-000000000000';

export function createPool(config: PoolConfig): Pool {
  const pool = new Pool({
    max: Number(process.env['PG_POOL_MAX'] ?? '10'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...config,
  });

  pool.on('connect', (client) => {
    client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch((err) => {
      logger.error({ err }, 'failed to set poison default on new client');
    });
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'unexpected pg pool error');
  });

  return pool;
}
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"byte_size\" /c:\"type ImageRow\" /c:\"ImageRow[]\" \"docs\\superpowers\\specs\\2026-05-01-story-17.1-image-pipeline-design.md\"" in C:\Alok\Business Projects\Goldsmith
 succeeded in 2408ms:
152:  byte_size            BIGINT      NOT NULL,
189:- Add `alt_text`, `mime_type`, `byte_size`, `width`, `height`, `exif_stripped_at`, `uploaded_by_user_id`, `scan_status`, `updated_at`.
223:       Response: 200 { images: ImageRow[] }
246:  async reorder(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
250:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
356:  async listForProduct(shopId: string, productId: string): Promise<ImageRow[]>;
358:  async setSortOrders(shopId: string, productId: string, orderedIds: string[]): Promise<ImageRow[]>;
370:    Response: { images: PublicImageRow[] }
395:type ImageRow = {
402:  byte_size: number;
425:The public catalog endpoint maps `ImageRow` → `PublicImageRow` server-side, calling `imagekitUrl(row.storage_key, { width: N })` for every needed variant. All public surfaces consume `PublicImageRow[]` directly, preserving the "every customer-facing URL has `mb-0.25`" invariant — the client never composes ImageKit URLs.
553:Props: `{ images: PublicImageRow[]; productName: string }`.
593:| Integration: upload → list (shopkeeper) | `product-images.integration.spec.ts` | Authenticated POST then authenticated GET `/products/:id/images` → returns `ImageRow[]` with `storage_key`, all timestamps, `scan_status`, etc. |
594:| Integration: upload → public catalog | `product-images.public-catalog.spec.ts` | Authenticated POST then anonymous GET `/catalog/products/:id/images` → returns `PublicImageRow[]` with `srcset`, `default_url`, `placeholder_url` (all containing `mb-0.25`); `storage_key` field is absent from response JSON |
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "imageSrcSet|imageSizes|fetchPriority|imagesrcset" node_modules/@types/react -n --max-count 20' in C:\Alok\Business Projects\Goldsmith
 succeeded in 473ms:
node_modules/@types/react\index.d.ts:3194:        fetchPriority?: "high" | "low" | "auto";
node_modules/@types/react\index.d.ts:3359:        fetchPriority?: "high" | "low" | "auto";
node_modules/@types/react\index.d.ts:3364:        imageSrcSet?: string | undefined;
node_modules/@types/react\index.d.ts:3365:        imageSizes?: string | undefined;
node_modules/@types/react\ts5.0\index.d.ts:3195:        fetchPriority?: "high" | "low" | "auto";
node_modules/@types/react\ts5.0\index.d.ts:3360:        fetchPriority?: "high" | "low" | "auto";
node_modules/@types/react\ts5.0\index.d.ts:3365:        imageSrcSet?: string | undefined;
node_modules/@types/react\ts5.0\index.d.ts:3366:        imageSizes?: string | undefined;
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-05-02T02:33:42.797651Z ERROR codex_core::session: failed to record rollout items: thread 019de683-da06-7e00-8d78-ccf79bde1194 not found
codex
The spec’s new responsive preload example uses HTML attribute names directly in a TSX/React context, which would cause the documented customer-web implementation to fail type checking.

Review comment:

- [P2] Use React prop names for preload attributes — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:562-562
  Because this is specified for `ProductGallery.tsx` via `next/head`, the example is JSX, but `imagesrcset` and `imagesizes` are not valid React `<link>` props in the installed typings; React exposes `imageSrcSet` and `imageSizes` instead (similarly `fetchPriority`). If implementers copy this responsive-preload snippet, the customer-web TypeScript build will fail before the LCP preload can ship.
2026-05-02T02:33:42.844154Z ERROR codex_core::session: failed to record rollout items: thread 019de683-d9e1-72a3-9f62-001ec28a7fe5 not found
The spec’s new responsive preload example uses HTML attribute names directly in a TSX/React context, which would cause the documented customer-web implementation to fail type checking.

Review comment:

- [P2] Use React prop names for preload attributes — C:\Alok\Business Projects\Goldsmith\docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:562-562
  Because this is specified for `ProductGallery.tsx` via `next/head`, the example is JSX, but `imagesrcset` and `imagesizes` are not valid React `<link>` props in the installed typings; React exposes `imageSrcSet` and `imageSizes` instead (similarly `fetchPriority`). If implementers copy this responsive-preload snippet, the customer-web TypeScript build will fail before the LCP preload can ship.
