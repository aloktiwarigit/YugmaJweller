# Virtual Try-On — Shopkeeper Admin + Mobile Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the try-on loop — give shopkeepers the admin UI to enter real mm dimensions, pick a body part, and nudge the overlay anchor (so products render *true-to-size* instead of always falling back to the approximate-size path), and bring the web try-on to customer-mobile via a `react-native-webview` that reuses the already-shipped web build.

**Architecture:** Three surfaces. (1) **Shopkeeper write path** — a new tenant-isolated admin API `GET/PATCH /api/v1/inventory/products/:id/try-on-asset` (anchor + enabled), plus a Hindi dimension/body-part form on the create/edit screens and a dedicated anchor-nudge screen. (2) **Mobile** — a fullscreen, chrome-less customer-web route `/products/[id]/try-on-wv` that mounts the existing `TryOnModal`, loaded inside a `react-native-webview` from a new `apps/customer-mobile/app/browse/try-on/[id].tsx` screen; the native app holds the OS camera permission and the WebView grants it to the page. (3) **Privacy/gates** — privacy-policy section, app-store privacy labels, runtime smoke (every category tracks; zero camera-frame egress), Lighthouse/axe, and the Class A review gate.

**Tech Stack:** NestJS + Drizzle/`pg` (API), Zod (`@goldsmith/shared`), React Native / Expo SDK 50 + NativeWind (shopkeeper + customer-mobile), `react-native-webview` (new), Next.js 14 App Router (customer-web), Vitest + `@testing-library/react`.

**Scope note:** This is Plan 3 of 3. Plans 1 (foundation: migration 0077, `@goldsmith/try-on-core`, bg-removal worker, `GET /catalog/products/:id/try-on`) and 2 (web try-on UI: `components/try-on/**`, `fetchTryOnData`, `TryOnButton` on the PDP, semgrep no-egress rule, `camera=(self)` + `wasm-unsafe-eval`) are **merged to main** (HEAD `2661608`). Do NOT re-implement them.

**Out of scope (post-v1, per spec §Risks / §Out of scope):** 3D hero-piece rendering (r3f/three.js); MediaPipe Web Worker upgrade; depth-only occlusion mask; size-calibration card flow; native `react-native-vision-camera` + `react-native-mediapipe` bridge (WebView is the v1 mobile path).

---

## Conventions verified against the current codebase (do not deviate without noting it)

- **Inventory write API** lives in `apps/api/src/modules/inventory/inventory.controller.ts` (`@Controller('/api/v1/inventory')`), backed by `InventoryService`. Authenticated shopkeeper routes use `@Roles('shop_admin', 'shop_manager')` + `@TenantContextDec() ctx` and guard `if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' })`. Body validation uses `new ZodValidationPipe(<Schema>)` with schemas from `@goldsmith/shared`. UUID params use `ParseUUIDPipe`.
- **`InventoryService`** (`inventory.service.ts`) injects `@Inject(InventoryRepository) repo` and `@Inject('PG_POOL') pool`. The try-on asset upsert already exists in `createProduct`/`updateProduct` (Plan 1 Task 13): `INSERT INTO product_try_on_assets (...) ON CONFLICT (shop_id, product_id) DO UPDATE ...` inside `withTenantTx(this.pool, tx => ...)`. RLS is active under `app_user`; **never** set `app.current_shop_id` by hand. Audit is `void auditLog(this.pool, { action, subjectType, subjectId, actorUserId, after })` (fire-and-forget), per `feedback_audit_pattern_pool_not_tx`.
- **`product_try_on_assets`** columns (migration 0077): `product_id`, `body_part` (`EAR|NECK|FINGER|WRIST`), `asset_storage_key` (null until cutout ready), `anchor_x`/`anchor_y` (`DECIMAL(5,4)`, normalized 0..1), `status` (`pending|ready|failed`), `enabled` (bool). `UNIQUE (shop_id, product_id)`. The catalog read endpoint only serves rows that are `enabled = true AND status = 'ready'`.
- **ImageKit URLs** are built ONLY via `ImageKitTransformUrlBuilder` injected as `IMAGEKIT_URL_BUILDER` from `@goldsmith/integrations-storage`. `ProductImagesService` (same `InventoryModule`) already consumes it as `this.urlBuilder.url(key, { width })`, so the provider is already registered in the module.
- **`InventoryService` unit test** (`inventory.service.spec.ts`) instantiates the service directly via `makeService()` → `new InventoryService(repoMock as never, poolMock)`. `withTenantTx`, `tenantContext`, `auditLog`, `validateHuidFormat` are module-mocked at the top of the file; `txMock.query` is the seam for tenant-tx SQL. Adding a constructor param means updating `makeService()`.
- **Shopkeeper app** (`apps/shopkeeper`) is Expo SDK 50 + expo-router (file-based; new files under `app/**` auto-register — `edit.tsx` already pushes to `/inventory/${id}/movements` and `/analytics` with no explicit `Stack.Screen`). UI tokens from `@goldsmith/ui-tokens` (`colors`, `spacing`, `typography`), i18n via `t('inventory.<key>')` from `@goldsmith/i18n` (catalogs at `packages/i18n/src/locales/{hi-IN,en-IN}/inventory.json`). API via `api` (axios) from `../../src/api/client`. Touch targets ≥ 48dp, body font ≥ 16pt, `accessibilityRole`/`accessibilityLabel` on every control, `mountedRef` guard for async state. Tests are Vitest (`apps/shopkeeper/test/*.test.tsx` or co-located `*.spec.tsx`); mirror `WastageRow.test.tsx` / `MakingChargeRow.test.tsx`.
- **customer-mobile** (`apps/customer-mobile`) resolves tenant via `Constants.expoConfig?.extra?.['tenantSlug']` (default `anchor-dev-2`) and exposes `tenant.id` (shopId) via `useTenantStore`; `apiBaseUrl` comes from `extra.apiBaseUrl`. The PDP at `app/browse/[id].tsx` already requests the OS camera permission for the HUID scanner via a lazy `require('expo-camera')` → `cam.Camera.requestCameraPermissionsAsync()` pattern. App config: `apps/customer-mobile/app.config.ts` (`extra` block + `EXPO_PUBLIC_*` env). `react-native-webview` is **NOT** installed.
- **customer-web** root layout (`app/layout.tsx`) wraps every route in `<TenantProvider value={config}>` + `<StorefrontWrapper config={config}>` (header/footer chrome). `TryOnModal` (Plan 2) is `fixed inset-0 z-50 bg-black` — an opaque fullscreen overlay. Tenant slug resolves via `resolveShopSlug(headers())` (`@/lib/tenant-slug`): `x-shop-slug` header → `NEXT_PUBLIC_SHOP_SLUG` env → hostname → `anchor-dev` for localhost. `fetchTenantConfig(slug)` returns `{ shopId, appName, ... }`. `fetchTryOnData(productId, shopId)` (Plan 2) is a client helper that returns `CatalogTryOnResponse | null`.

---

## File Structure

**Create:**
- `apps/api/test/try-on-admin.tenant-isolation.spec.ts` — cross-tenant denial for the admin try-on-asset endpoints.
- `apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.tsx` — body-part picker + preset chips + mm input (Hindi-first).
- `apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.spec.tsx` — preset→mm + label-by-part unit test.
- `apps/shopkeeper/src/features/inventory/tryOnPresets.ts` — pure preset→mm maps + `labelForBodyPart` + `clampAnchor` (logic, unit-tested).
- `apps/shopkeeper/src/features/inventory/tryOnPresets.spec.ts` — unit test for the pure helpers.
- `apps/shopkeeper/app/inventory/[id]/try-on.tsx` — anchor-nudge + enable screen.
- `apps/customer-web/app/products/[id]/try-on-wv/page.tsx` — fullscreen chrome-less WebView route (server component).
- `apps/customer-web/app/products/[id]/try-on-wv/TryOnWvClient.tsx` — client wrapper: fetch + mount `TryOnModal` + postMessage-on-close.
- `apps/customer-web/test/try-on-wv-client.test.tsx` — WV client states (data → modal; null → error).
- `apps/customer-mobile/app/browse/try-on/[id].tsx` — native screen hosting the WebView.
- `docs/app-store-privacy.md` — Play/App Store data-safety labels for the try-on feature.

**Modify:**
- `packages/shared/src/schemas/product.schema.ts` — `UpdateTryOnAssetSchema` + `AdminTryOnAssetResponse` type (+ barrel export if not wildcard).
- `apps/api/src/modules/inventory/inventory.service.ts` — inject `IMAGEKIT_URL_BUILDER`; add `getTryOnAsset` + `updateTryOnAsset`.
- `apps/api/src/modules/inventory/inventory.service.spec.ts` — pass `urlBuilderStub` into `makeService()`; add tests for the two new methods.
- `apps/api/src/modules/inventory/inventory.controller.ts` — `GET` + `PATCH` `/products/:id/try-on-asset`.
- `packages/i18n/src/locales/hi-IN/inventory.json` + `packages/i18n/src/locales/en-IN/inventory.json` — try-on label keys.
- `apps/shopkeeper/app/inventory/new.tsx` — render `TryOnDimensionsField`; send try-on fields on create.
- `apps/shopkeeper/app/inventory/[id]/edit.tsx` — render `TryOnDimensionsField`; send try-on fields on update; add a link row to the anchor screen.
- `apps/customer-mobile/app.config.ts` — add `extra.webBaseUrl` (from `EXPO_PUBLIC_WEB_BASE_URL`).
- `apps/customer-mobile/package.json` — add `react-native-webview`.
- `apps/customer-mobile/app/browse/[id].tsx` — add a "ट्राय करके देखें" CTA navigating to `/browse/try-on/${id}`.
- `apps/customer-web/app/privacy/page.tsx` — add a virtual-try-on privacy section.

---

## WS-A1 — Shopkeeper try-on-asset write API (Class A subsurface: new endpoint, tenant isolation)

### Task 1: `UpdateTryOnAssetSchema` + response type (Zod, `@goldsmith/shared`)

**Files:**
- Modify: `packages/shared/src/schemas/product.schema.ts`
- Test: `packages/shared/src/schemas/product.schema.spec.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/schemas/product.schema.spec.ts`:

```typescript
import { UpdateTryOnAssetSchema } from './product.schema';

describe('UpdateTryOnAssetSchema', () => {
  it('accepts normalized anchors and an enabled flag', () => {
    const parsed = UpdateTryOnAssetSchema.parse({ anchorX: 0.5, anchorY: 0.0, enabled: true });
    expect(parsed.anchorX).toBe(0.5);
    expect(parsed.enabled).toBe(true);
  });

  it('rejects an anchor outside 0..1', () => {
    expect(() => UpdateTryOnAssetSchema.parse({ anchorX: 1.4, anchorY: 0, enabled: false })).toThrow();
  });

  it('requires the enabled flag', () => {
    expect(() => UpdateTryOnAssetSchema.parse({ anchorX: 0.5, anchorY: 0.5 })).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```
pnpm --filter @goldsmith/shared test -- product.schema
```
Expected: FAIL — `UpdateTryOnAssetSchema` not exported.

- [ ] **Step 3: Add the schema + response type**

In `packages/shared/src/schemas/product.schema.ts`, append (reuse the existing `z` import):

```typescript
// ─── Virtual try-on asset (Plan 3 — shopkeeper anchor/enable admin) ──────────
export const UpdateTryOnAssetSchema = z.object({
  /** Normalized anchor within the cutout [0,1]. */
  anchorX: z.number().min(0).max(1),
  anchorY: z.number().min(0).max(1),
  /** Show this overlay to customers. Only takes effect once the cutout is ready. */
  enabled: z.boolean(),
});
export type UpdateTryOnAssetDto = z.infer<typeof UpdateTryOnAssetSchema>;

export interface AdminTryOnAssetResponse {
  productId: string;
  bodyPart: 'EAR' | 'NECK' | 'FINGER' | 'WRIST';
  /** Cutout (transparent PNG) URL, or null while pending/failed. */
  assetUrl: string | null;
  anchorX: number;
  anchorY: number;
  status: 'pending' | 'ready' | 'failed';
  enabled: boolean;
}
```

(If `packages/shared/src/index.ts` re-exports schemas explicitly rather than `export *`, add `UpdateTryOnAssetSchema`, `UpdateTryOnAssetDto`, and `AdminTryOnAssetResponse` to that barrel. Confirm by grepping `export * from './schemas/product.schema'` first.)

- [ ] **Step 4: Run it to verify it passes**

```
pnpm --filter @goldsmith/shared test -- product.schema
```
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add packages/shared/src/schemas/product.schema.ts packages/shared/src/schemas/product.schema.spec.ts
git commit -m "feat(shared): UpdateTryOnAssetSchema + AdminTryOnAssetResponse"
```

---

### Task 2: `InventoryService.getTryOnAsset` + `updateTryOnAsset`

**Files:**
- Modify: `apps/api/src/modules/inventory/inventory.service.ts`
- Test: `apps/api/src/modules/inventory/inventory.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/inventory/inventory.service.spec.ts`, first update the service factory to pass a url-builder stub. Find:

```typescript
const poolMock = {} as never;

function makeService() {
  const svc = new InventoryService(repoMock as never, poolMock);
```

Replace with:

```typescript
const poolMock = {} as never;
const urlBuilderStub = { url: (key: string, _opts: unknown) => `https://ik.imagekit.io/goldsmith/${key}?tr=w-1024` };

function makeService() {
  const svc = new InventoryService(repoMock as never, poolMock, urlBuilderStub as never);
```

Then append a new describe block (the file already mocks `@goldsmith/db`'s `withTenantTx` to call `fn(txMock)`, so drive the SQL via `txMock.query`):

```typescript
describe('InventoryService try-on asset admin', () => {
  beforeEach(() => {
    txMock.query.mockReset();
  });

  it('getTryOnAsset maps the row and builds the cutout URL', async () => {
    txMock.query.mockResolvedValueOnce({
      rows: [{
        body_part: 'EAR', asset_storage_key: 'shop-A/p1.cutout.png',
        anchor_x: '0.5000', anchor_y: '0.0000', status: 'ready', enabled: true,
      }],
    });
    const svc = makeService();
    const r = await svc.getTryOnAsset('prod-1');
    expect(r.bodyPart).toBe('EAR');
    expect(r.anchorX).toBe(0.5);
    expect(r.status).toBe('ready');
    expect(r.assetUrl).toContain('p1.cutout.png');
  });

  it('getTryOnAsset returns null assetUrl when the cutout is not ready', async () => {
    txMock.query.mockResolvedValueOnce({
      rows: [{ body_part: 'FINGER', asset_storage_key: null, anchor_x: '0.5000', anchor_y: '0.5000', status: 'pending', enabled: false }],
    });
    const r = await makeService().getTryOnAsset('prod-1');
    expect(r.assetUrl).toBeNull();
    expect(r.status).toBe('pending');
  });

  it('getTryOnAsset throws NotFound when no asset row exists', async () => {
    txMock.query.mockResolvedValueOnce({ rows: [] });
    await expect(makeService().getTryOnAsset('prod-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateTryOnAsset writes anchors + enabled and returns the updated row', async () => {
    txMock.query.mockResolvedValueOnce({
      rows: [{ body_part: 'EAR', asset_storage_key: 'shop-A/p1.cutout.png', anchor_x: '0.4200', anchor_y: '0.1000', status: 'ready', enabled: true }],
    });
    const r = await makeService().updateTryOnAsset('prod-1', { anchorX: 0.42, anchorY: 0.1, enabled: true });
    expect(r.anchorX).toBe(0.42);
    expect(r.enabled).toBe(true);
    // Persisted anchors are sent as 4-dp strings.
    const params = txMock.query.mock.calls[0][1];
    expect(params[0]).toBe('0.4200');
    expect(params[1]).toBe('0.1000');
  });

  it('updateTryOnAsset throws NotFound when the product has no asset row', async () => {
    txMock.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      makeService().updateTryOnAsset('prod-1', { anchorX: 0.5, anchorY: 0.5, enabled: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
pnpm --filter @goldsmith/api test -- inventory.service
```
Expected: FAIL — constructor arity / `getTryOnAsset` not a function.

- [ ] **Step 3: Inject the url builder + implement the methods**

In `apps/api/src/modules/inventory/inventory.service.ts`:

Add the import (near the other `@goldsmith/*` imports):

```typescript
import { IMAGEKIT_URL_BUILDER, type ImageKitTransformUrlBuilder } from '@goldsmith/integrations-storage';
import type { AdminTryOnAssetResponse, UpdateTryOnAssetDto } from '@goldsmith/shared';
```

Extend the constructor:

```typescript
  constructor(
    @Inject(InventoryRepository) private readonly repo: InventoryRepository,
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(IMAGEKIT_URL_BUILDER) private readonly urlBuilder: ImageKitTransformUrlBuilder,
  ) {}
```

Add the two methods (place after `updateProduct`):

```typescript
  /** Map a try-on asset DB row to the admin response, building the cutout URL. */
  private mapTryOnAssetRow(productId: string, row: {
    body_part: string; asset_storage_key: string | null;
    anchor_x: string; anchor_y: string; status: string; enabled: boolean;
  }): AdminTryOnAssetResponse {
    return {
      productId,
      bodyPart: row.body_part as AdminTryOnAssetResponse['bodyPart'],
      assetUrl: row.asset_storage_key ? this.urlBuilder.url(row.asset_storage_key, { width: 1024 }) : null,
      anchorX: Number(row.anchor_x),
      anchorY: Number(row.anchor_y),
      status: row.status as AdminTryOnAssetResponse['status'],
      enabled: row.enabled,
    };
  }

  /** Read the (single) try-on asset row for a product, for the admin nudge UI. */
  async getTryOnAsset(productId: string): Promise<AdminTryOnAssetResponse> {
    const r = await withTenantTx(this.pool, (tx) =>
      tx.query<{
        body_part: string; asset_storage_key: string | null;
        anchor_x: string; anchor_y: string; status: string; enabled: boolean;
      }>(
        `SELECT body_part, asset_storage_key, anchor_x, anchor_y, status, enabled
           FROM product_try_on_assets
          WHERE product_id = $1
          LIMIT 1`,
        [productId],
      ),
    );
    const row = r.rows[0];
    if (!row) throw new NotFoundException({ code: 'inventory.try_on_asset_not_found' });
    return this.mapTryOnAssetRow(productId, row);
  }

  /**
   * Update the anchor + enabled flag. `enabled` only sticks when the cutout is
   * 'ready' (`enabled = ($3 AND status = 'ready')`) so a shopkeeper can never
   * publish an overlay that has no cutout. RLS-scoped via withTenantTx.
   */
  async updateTryOnAsset(productId: string, dto: UpdateTryOnAssetDto): Promise<AdminTryOnAssetResponse> {
    const r = await withTenantTx(this.pool, (tx) =>
      tx.query<{
        body_part: string; asset_storage_key: string | null;
        anchor_x: string; anchor_y: string; status: string; enabled: boolean;
      }>(
        `UPDATE product_try_on_assets
            SET anchor_x = $1, anchor_y = $2,
                enabled = ($3 AND status = 'ready'),
                updated_at = now()
          WHERE product_id = $4
        RETURNING body_part, asset_storage_key, anchor_x, anchor_y, status, enabled`,
        [dto.anchorX.toFixed(4), dto.anchorY.toFixed(4), dto.enabled, productId],
      ),
    );
    const row = r.rows[0];
    if (!row) throw new NotFoundException({ code: 'inventory.try_on_asset_not_found' });

    const ctx = tenantContext.current();
    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_PRODUCT_UPDATED,
      subjectType: 'product_try_on_asset',
      subjectId: productId,
      actorUserId: ctx?.authenticated ? (ctx as AuthenticatedTenantContext).userId : undefined,
      after: { anchorX: dto.anchorX, anchorY: dto.anchorY, enabled: row.enabled },
    }).catch(() => undefined);

    return this.mapTryOnAssetRow(productId, row);
  }
```

(`withTenantTx`, `tenantContext`, `AuthenticatedTenantContext`, `auditLog`, `AuditAction`, `NotFoundException` are all already imported in this file — confirm; they are used by `createProduct`/`updateProduct`/`getProduct`.)

- [ ] **Step 4: Run to verify it passes**

```
pnpm --filter @goldsmith/api test -- inventory.service
```
Expected: PASS (existing + 5 new).

- [ ] **Step 5: Commit**

```
git add apps/api/src/modules/inventory/inventory.service.ts apps/api/src/modules/inventory/inventory.service.spec.ts
git commit -m "feat(inventory): getTryOnAsset + updateTryOnAsset (anchor/enable, RLS, ready-guard)"
```

---

### Task 3: Controller routes — `GET` + `PATCH` `/products/:id/try-on-asset`

**Files:**
- Modify: `apps/api/src/modules/inventory/inventory.controller.ts`

- [ ] **Step 1: Add the imports**

In `inventory.controller.ts`, extend the `@goldsmith/shared` value + type imports:

```typescript
import { CreateProductSchema, UpdateProductSchema, UpdateStatusDtoSchema, GenerateBarcodesRequestSchema, UpdateTryOnAssetSchema } from '@goldsmith/shared';
import type { CreateProductDto, UpdateProductDto, UpdateStatusDto, ProductResponse, BulkImportJobStatus, BarcodeData, UpdateTryOnAssetDto, AdminTryOnAssetResponse } from '@goldsmith/shared';
```

- [ ] **Step 2: Add the routes**

Add after the `@Patch('/products/:id/status')` handler (keep both before the barcode/bulk routes):

```typescript
  @Get('/products/:id/try-on-asset')
  @Roles('shop_admin', 'shop_manager')
  async getTryOnAsset(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminTryOnAssetResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getTryOnAsset(id);
  }

  @Patch('/products/:id/try-on-asset')
  @Roles('shop_admin', 'shop_manager')
  async updateTryOnAsset(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTryOnAssetSchema)) dto: UpdateTryOnAssetDto,
  ): Promise<AdminTryOnAssetResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.updateTryOnAsset(id, dto);
  }
```

- [ ] **Step 3: Typecheck**

```
pnpm --filter @goldsmith/api typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add apps/api/src/modules/inventory/inventory.controller.ts
git commit -m "feat(inventory): GET/PATCH /products/:id/try-on-asset admin routes"
```

---

### Task 4: Tenant-isolation test for the admin try-on-asset endpoints

**Files:**
- Create: `apps/api/test/try-on-admin.tenant-isolation.spec.ts`

This is the per-feature isolation test (the generic `tenantScopedTable` harness already covers raw RLS on `product_try_on_assets` from Plan 1 Task 2). Copy the bootstrap (testcontainers `PostgreSqlContainer`, `runMigrations`, two-shop seeding, `tenantContext.runWith` + `withTenantTx`, `InventoryService` construction) from `apps/api/test/product-images.tenant-isolation.spec.ts`.

- [ ] **Step 1: Write the test**

Create `apps/api/test/try-on-admin.tenant-isolation.spec.ts`:

```typescript
// Bootstrap (PostgreSqlContainer, runMigrations, SHOP_A/SHOP_B seeding,
// tenantContext, withTenantTx, an InventoryService built with the real pool +
// a stub url-builder { url: (k) => `https://ik/${k}` }) copied verbatim from
// apps/api/test/product-images.tenant-isolation.spec.ts. Then:
//
// In beforeAll, under SHOP_A context (tenantContext.runWith + withTenantTx):
//   - insert a product (productAId) with published_at = now()
//   - INSERT INTO product_try_on_assets (shop_id, product_id, body_part,
//       asset_storage_key, status, enabled)
//       VALUES (SHOP_A, productAId, 'EAR', 'shopA/p.cutout.png', 'ready', true)

import { NotFoundException } from '@nestjs/common';

describe('try-on admin — cross-tenant isolation', () => {
  it('shop A reads its own asset', async () => {
    const r = await runAs(SHOP_A, () => inventoryService.getTryOnAsset(productAId));
    expect(r.bodyPart).toBe('EAR');
    expect(r.enabled).toBe(true);
  });

  it('shop B getTryOnAsset on shop A product → NotFound (RLS hides the row)', async () => {
    await expect(runAs(SHOP_B, () => inventoryService.getTryOnAsset(productAId)))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('shop B updateTryOnAsset on shop A product → NotFound (no row visible to update)', async () => {
    await expect(
      runAs(SHOP_B, () => inventoryService.updateTryOnAsset(productAId, { anchorX: 0.9, anchorY: 0.9, enabled: true })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('shop A cannot enable an asset whose cutout is not ready', async () => {
    // Seed productA2 with a 'pending' asset, then try to enable it.
    const r = await runAs(SHOP_A, () => inventoryService.updateTryOnAsset(productA2Id, { anchorX: 0.5, anchorY: 0.5, enabled: true }));
    expect(r.enabled).toBe(false); // ready-guard: enabled = ($3 AND status='ready')
  });
});
```

`runAs(shopId, fn)` wraps `fn` in `tenantContext.runWith({ shopId, userId, role: 'shop_admin', authenticated: true, tenant: {...} }, fn)` — copy the exact helper shape from the reference spec. Add the `productA2Id` seed (a SHOP_A product + a `status='pending'` asset row) in `beforeAll`.

- [ ] **Step 2: Run it**

```
pnpm --filter @goldsmith/api test -- try-on-admin.tenant-isolation
```
Expected: all PASS (Docker/testcontainers required, like the reference spec).

- [ ] **Step 3: Commit**

```
git add apps/api/test/try-on-admin.tenant-isolation.spec.ts
git commit -m "test(tenant-isolation): admin try-on-asset cross-tenant denial + ready-guard"
```

---

## WS-A2 — Shopkeeper dimension + body-part form

### Task 5: i18n keys + pure preset helpers (`tryOnPresets.ts`)

**Files:**
- Modify: `packages/i18n/src/locales/hi-IN/inventory.json`, `packages/i18n/src/locales/en-IN/inventory.json`
- Create: `apps/shopkeeper/src/features/inventory/tryOnPresets.ts`
- Test: `apps/shopkeeper/src/features/inventory/tryOnPresets.spec.ts`

The dominant visible dimension drives true-to-size, matching the renderer's resolution order (Plan 2): face items (EAR/NECK) use **lengthMm**; hand items (FINGER/WRIST) use **diameterMm**. Presets are entry conveniences that fill the mm input; they are deliberately small and live here (not imported from `@goldsmith/try-on-core`) to avoid adding a Metro-transpiled dependency to the RN app — `clampAnchor` and the maps are unit-tested so they can't silently drift.

- [ ] **Step 1: Add the i18n keys**

In `packages/i18n/src/locales/hi-IN/inventory.json`, add:

```json
  "tryon_section": "वर्चुअल ट्राय-ऑन",
  "tryon_bodypart_label": "आभूषण का प्रकार चुनें",
  "tryon_bodypart_ear": "झुमके / बाली",
  "tryon_bodypart_neck": "हार / पेंडेंट",
  "tryon_bodypart_finger": "अंगूठी",
  "tryon_bodypart_wrist": "चूड़ी / कंगन",
  "tryon_mm_label_ear": "झुमके की लंबाई (मिमी)",
  "tryon_mm_label_neck": "पेंडेंट की लंबाई (मिमी)",
  "tryon_mm_label_finger": "अंगूठी का व्यास (मिमी)",
  "tryon_mm_label_wrist": "चूड़ी का भीतरी व्यास (मिमी)",
  "tryon_mm_hint": "असली नाप डालें ताकि ग्राहक को सही आकार दिखे।",
  "tryon_preset_small": "छोटा",
  "tryon_preset_medium": "मध्यम",
  "tryon_preset_large": "बड़ा",
  "tryon_anchor_link": "ट्राय-ऑन सेटअप (एंकर)",
  "tryon_anchor_title": "ट्राय-ऑन एंकर सेट करें",
  "tryon_anchor_hint": "तस्वीर पर टैप करके या तीर बटनों से बिंदु को सही जगह लाएं।",
  "tryon_anchor_enable": "ग्राहकों को ट्राय-ऑन दिखाएं",
  "tryon_anchor_pending": "तस्वीर तैयार हो रही है — कुछ देर बाद देखें।",
  "tryon_anchor_failed": "कटआउट नहीं बन पाया। दूसरी तस्वीर अपलोड करें।",
  "tryon_anchor_save": "एंकर सहेजें",
  "tryon_anchor_saved": "ट्राय-ऑन एंकर सहेजा गया"
```

In `packages/i18n/src/locales/en-IN/inventory.json`, add the parallel English values:

```json
  "tryon_section": "Virtual Try-On",
  "tryon_bodypart_label": "Select jewellery type",
  "tryon_bodypart_ear": "Earrings",
  "tryon_bodypart_neck": "Necklace / Pendant",
  "tryon_bodypart_finger": "Ring",
  "tryon_bodypart_wrist": "Bangle / Bracelet",
  "tryon_mm_label_ear": "Earring length (mm)",
  "tryon_mm_label_neck": "Pendant length (mm)",
  "tryon_mm_label_finger": "Ring inner diameter (mm)",
  "tryon_mm_label_wrist": "Bangle inner diameter (mm)",
  "tryon_mm_hint": "Enter the real measurement so customers see the true size.",
  "tryon_preset_small": "Small",
  "tryon_preset_medium": "Medium",
  "tryon_preset_large": "Large",
  "tryon_anchor_link": "Try-On setup (anchor)",
  "tryon_anchor_title": "Set the try-on anchor",
  "tryon_anchor_hint": "Tap the photo or use the arrow buttons to position the point.",
  "tryon_anchor_enable": "Show try-on to customers",
  "tryon_anchor_pending": "Cutout is processing — check back shortly.",
  "tryon_anchor_failed": "Cutout could not be generated. Upload a different photo.",
  "tryon_anchor_save": "Save anchor",
  "tryon_anchor_saved": "Try-on anchor saved"
```

- [ ] **Step 2: Write the failing helper test**

Create `apps/shopkeeper/src/features/inventory/tryOnPresets.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BODY_PARTS, mmFieldForBodyPart, presetsForBodyPart, clampAnchor } from './tryOnPresets';

describe('tryOnPresets', () => {
  it('lists all four body parts in face-then-hand order', () => {
    expect(BODY_PARTS).toEqual(['EAR', 'NECK', 'FINGER', 'WRIST']);
  });

  it('maps EAR/NECK to lengthMm and FINGER/WRIST to diameterMm', () => {
    expect(mmFieldForBodyPart('EAR')).toBe('tryOnLengthMm');
    expect(mmFieldForBodyPart('NECK')).toBe('tryOnLengthMm');
    expect(mmFieldForBodyPart('FINGER')).toBe('tryOnDiameterMm');
    expect(mmFieldForBodyPart('WRIST')).toBe('tryOnDiameterMm');
  });

  it('gives three ascending presets per body part', () => {
    const ring = presetsForBodyPart('FINGER');
    expect(ring).toHaveLength(3);
    expect(ring[0].mm).toBeLessThan(ring[2].mm);
  });

  it('clampAnchor keeps values inside [0,1]', () => {
    expect(clampAnchor(-0.2)).toBe(0);
    expect(clampAnchor(1.7)).toBe(1);
    expect(clampAnchor(0.42)).toBeCloseTo(0.42, 5);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```
pnpm --filter @goldsmith/shopkeeper test -- tryOnPresets
```
Expected: FAIL — module not found. (Confirm the filter name in `apps/shopkeeper/package.json`'s `name` field; adjust if different.)

- [ ] **Step 4: Implement the helpers**

Create `apps/shopkeeper/src/features/inventory/tryOnPresets.ts`:

```typescript
export type BodyPart = 'EAR' | 'NECK' | 'FINGER' | 'WRIST';

/** Face items first (most stable / highest wow), then hand items — matches the spec sequence. */
export const BODY_PARTS: BodyPart[] = ['EAR', 'NECK', 'FINGER', 'WRIST'];

/** Which mm field the dominant dimension maps to, matching the renderer's resolution order. */
export function mmFieldForBodyPart(part: BodyPart): 'tryOnLengthMm' | 'tryOnDiameterMm' {
  return part === 'FINGER' || part === 'WRIST' ? 'tryOnDiameterMm' : 'tryOnLengthMm';
}

export interface Preset {
  /** i18n key for the chip label. */
  labelKey: 'inventory.tryon_preset_small' | 'inventory.tryon_preset_medium' | 'inventory.tryon_preset_large';
  mm: number;
}

/**
 * Small/Medium/Large convenience presets (mm). Ring/bangle values track the
 * canonical diameter tables in @goldsmith/try-on-core (RING_DIAMETER_MM /
 * BANGLE_DIAMETER_MM); earring/pendant lengths are typical drops. Shopkeepers
 * can always override with the raw mm input.
 */
const PRESETS: Record<BodyPart, Preset[]> = {
  EAR:    [{ labelKey: 'inventory.tryon_preset_small', mm: 15 }, { labelKey: 'inventory.tryon_preset_medium', mm: 25 }, { labelKey: 'inventory.tryon_preset_large', mm: 40 }],
  NECK:   [{ labelKey: 'inventory.tryon_preset_small', mm: 20 }, { labelKey: 'inventory.tryon_preset_medium', mm: 30 }, { labelKey: 'inventory.tryon_preset_large', mm: 45 }],
  FINGER: [{ labelKey: 'inventory.tryon_preset_small', mm: 14 }, { labelKey: 'inventory.tryon_preset_medium', mm: 16 }, { labelKey: 'inventory.tryon_preset_large', mm: 18 }],
  WRIST:  [{ labelKey: 'inventory.tryon_preset_small', mm: 56 }, { labelKey: 'inventory.tryon_preset_medium', mm: 58 }, { labelKey: 'inventory.tryon_preset_large', mm: 60 }],
};

export function presetsForBodyPart(part: BodyPart): Preset[] {
  return PRESETS[part];
}

/** i18n key for the mm-input label, by body part. */
export function mmLabelKeyForBodyPart(part: BodyPart): string {
  return `inventory.tryon_mm_label_${part.toLowerCase()}`;
}

/** i18n key for a body-part chip. */
export function bodyPartLabelKey(part: BodyPart): string {
  return `inventory.tryon_bodypart_${part.toLowerCase()}`;
}

/** Clamp a normalized anchor coordinate into [0,1]. */
export function clampAnchor(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}
```

- [ ] **Step 5: Run to verify it passes**

```
pnpm --filter @goldsmith/shopkeeper test -- tryOnPresets
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add packages/i18n/src/locales/hi-IN/inventory.json packages/i18n/src/locales/en-IN/inventory.json apps/shopkeeper/src/features/inventory/tryOnPresets.ts apps/shopkeeper/src/features/inventory/tryOnPresets.spec.ts
git commit -m "feat(shopkeeper): try-on preset helpers + i18n keys"
```

---

### Task 6: `TryOnDimensionsField` component

**Files:**
- Create: `apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.tsx`
- Test: `apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.spec.tsx`

The field is controlled: it takes the current `{ bodyPart, mm }` value and emits changes. The parent screen maps `mm` onto the right product field (`tryOnLengthMm` or `tryOnDiameterMm`) via `mmFieldForBodyPart` at submit time.

- [ ] **Step 1: Write the failing test**

Create `apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.spec.tsx` (mirror `WastageRow.test.tsx` harness — RN Testing Library + the repo's `react-native.mock`):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { TryOnDimensionsField } from './TryOnDimensionsField';

describe('TryOnDimensionsField', () => {
  it('emits the chosen body part', () => {
    const onChange = vi.fn();
    render(<TryOnDimensionsField value={{ bodyPart: undefined, mm: '' }} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('झुमके / बाली'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bodyPart: 'EAR' }));
  });

  it('shows the mm input only once a body part is chosen', () => {
    const { rerender } = render(<TryOnDimensionsField value={{ bodyPart: undefined, mm: '' }} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/मिमी/)).toBeNull();
    rerender(<TryOnDimensionsField value={{ bodyPart: 'FINGER', mm: '' }} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/मिमी/)).toBeTruthy();
  });

  it('fills the mm value when a preset chip is tapped', () => {
    const onChange = vi.fn();
    render(<TryOnDimensionsField value={{ bodyPart: 'FINGER', mm: '' }} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('मध्यम'));
    expect(onChange).toHaveBeenCalledWith({ bodyPart: 'FINGER', mm: '16' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
pnpm --filter @goldsmith/shopkeeper test -- TryOnDimensionsField
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.tsx`:

```tsx
import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import {
  BODY_PARTS,
  type BodyPart,
  presetsForBodyPart,
  mmLabelKeyForBodyPart,
  bodyPartLabelKey,
} from '../tryOnPresets';

export interface TryOnFieldValue {
  bodyPart: BodyPart | undefined;
  /** mm as a string (keeps the controlled-input pattern used elsewhere). */
  mm: string;
}

interface Props {
  value: TryOnFieldValue;
  onChange: (next: TryOnFieldValue) => void;
}

export function TryOnDimensionsField({ value, onChange }: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>{t('inventory.tryon_section')}</Text>
      <Text style={styles.label}>{t('inventory.tryon_bodypart_label')}</Text>

      <View style={styles.chipRow}>
        {BODY_PARTS.map((part) => {
          const selected = value.bodyPart === part;
          const label = t(bodyPartLabelKey(part));
          return (
            <Pressable
              key={part}
              onPress={() => onChange({ bodyPart: part, mm: value.bodyPart === part ? value.mm : '' })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.bodyPart != null && (
        <>
          <Text style={styles.label}>{t(mmLabelKeyForBodyPart(value.bodyPart))}</Text>
          <View style={styles.presetRow}>
            {presetsForBodyPart(value.bodyPart).map((p) => (
              <Pressable
                key={p.labelKey}
                onPress={() => onChange({ bodyPart: value.bodyPart, mm: String(p.mm) })}
                accessibilityRole="button"
                accessibilityLabel={t(p.labelKey)}
                style={styles.presetChip}
              >
                <Text style={styles.presetChipText}>{t(p.labelKey)} · {p.mm}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={value.mm}
            onChangeText={(v) => onChange({ bodyPart: value.bodyPart, mm: v.replace(/[^\d.]/g, '') })}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t(mmLabelKeyForBodyPart(value.bodyPart))}
          />
          <Text style={styles.hint}>{t('inventory.tryon_mm_hint')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.xs },
  section: { ...typography.body, color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  label: { ...typography.body, color: colors.textSecondary, fontSize: 16, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minHeight: 48, paddingHorizontal: spacing.md, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 24, backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 15, color: colors.textPrimary },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  presetChip: {
    minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.background,
  },
  presetChipText: { fontSize: 14, color: colors.textPrimary },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: spacing.sm, minHeight: 48, fontSize: 16, color: colors.textPrimary,
  },
  hint: { fontSize: 13, color: colors.textSecondary },
});
```

- [ ] **Step 4: Run to verify it passes**

```
pnpm --filter @goldsmith/shopkeeper test -- TryOnDimensionsField
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```
git add apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.tsx apps/shopkeeper/src/features/inventory/components/TryOnDimensionsField.spec.tsx
git commit -m "feat(shopkeeper): TryOnDimensionsField — body-part picker + mm presets"
```

---

### Task 7: Wire `TryOnDimensionsField` into create + edit screens

**Files:**
- Modify: `apps/shopkeeper/app/inventory/new.tsx`
- Modify: `apps/shopkeeper/app/inventory/[id]/edit.tsx`

- [ ] **Step 1: New-product screen — add state + field + payload**

In `apps/shopkeeper/app/inventory/new.tsx`:

Add imports:

```typescript
import { TryOnDimensionsField, type TryOnFieldValue } from '../../src/features/inventory/components/TryOnDimensionsField';
import { mmFieldForBodyPart } from '../../src/features/inventory/tryOnPresets';
```

Add state inside `NewProductScreen` (next to `const [errors, ...]`):

```typescript
  const [tryOn, setTryOn] = useState<TryOnFieldValue>({ bodyPart: undefined, mm: '' });
```

In the `mutationFn`'s `api.post` body object, append the try-on fields (only when a body part is chosen; map mm to the dominant field):

```typescript
        ...(data.tryOnBodyPart
          ? {
              tryOnBodyPart: data.tryOnBodyPart,
              ...(data.tryOnMm
                ? { [mmFieldForBodyPart(data.tryOnBodyPart)]: data.tryOnMm }
                : {}),
            }
          : {}),
```

To pass these through, extend the value handed to `mutation.mutate`. The simplest, lowest-risk wiring: keep `FormState` as-is and pass try-on values alongside. Change `handleSave` to merge them:

```typescript
  function handleSave(): void {
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    mutation.mutate({
      ...form,
      tryOnBodyPart: tryOn.bodyPart,
      tryOnMm: tryOn.mm.trim() || undefined,
    });
  }
```

And widen the `mutationFn` param type to `FormState & { tryOnBodyPart?: BodyPart; tryOnMm?: string }`:

```typescript
import type { BodyPart } from '../../src/features/inventory/tryOnPresets';
// ...
    mutationFn: async (data: FormState & { tryOnBodyPart?: BodyPart; tryOnMm?: string }) => {
```

Render the field just before the Save `Pressable` (after `HuidExemptionPicker`):

```tsx
      <TryOnDimensionsField value={tryOn} onChange={setTryOn} />
```

- [ ] **Step 2: Edit-product screen — load + edit + send**

In `apps/shopkeeper/app/inventory/[id]/edit.tsx`:

Add the same imports as Step 1 (adjust the relative path to `../../../src/...`).

Add state:

```typescript
  const [tryOn, setTryOn] = useState<TryOnFieldValue>({ bodyPart: undefined, mm: '' });
```

Hydrate it from the fetched product in the existing `useEffect(() => { if (data) {...} }, [data])` — the GET product response includes `tryOnBodyPart`, `tryOnLengthMm`, `tryOnDiameterMm` (Plan 1 added the columns + Zod fields; the product GET maps them). Add inside that effect:

```typescript
      const bp = (data as { tryOnBodyPart?: BodyPart }).tryOnBodyPart;
      const lengthMm = (data as { tryOnLengthMm?: string | null }).tryOnLengthMm;
      const diameterMm = (data as { tryOnDiameterMm?: string | null }).tryOnDiameterMm;
      if (bp) {
        const mm = mmFieldForBodyPart(bp) === 'tryOnDiameterMm' ? diameterMm : lengthMm;
        setTryOn({ bodyPart: bp, mm: mm ?? '' });
      }
```

(If the product GET does not yet surface these fields, this hydration silently no-ops — confirm during smoke; the create-then-edit round-trip is the acceptance check. If absent, add the three columns to the inventory product mapper as a noted deviation.)

In the update `mutation`'s `mutationFn`, after building `cleaned`, append the try-on fields:

```typescript
      if (tryOn.bodyPart) {
        cleaned.tryOnBodyPart = tryOn.bodyPart;
        if (tryOn.mm.trim()) cleaned[mmFieldForBodyPart(tryOn.bodyPart)] = tryOn.mm.trim();
      }
```

Render the field after the `<HuidInput .../>` block:

```tsx
      <TryOnDimensionsField value={tryOn} onChange={setTryOn} />
```

Add a link row to the anchor screen (Task 9), alongside the existing movements/analytics links:

```tsx
      <Pressable
        style={styles.linkRow}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPress={() => router.push(`/inventory/${id}/try-on` as any)}
        accessibilityRole="link"
        accessibilityLabel={t('inventory.tryon_anchor_link')}>
        <Text style={styles.linkText}>{t('inventory.tryon_anchor_link')} →</Text>
      </Pressable>
```

- [ ] **Step 3: Typecheck**

```
pnpm --filter @goldsmith/shopkeeper typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add apps/shopkeeper/app/inventory/new.tsx apps/shopkeeper/app/inventory/[id]/edit.tsx
git commit -m "feat(shopkeeper): try-on dimensions on create/edit + anchor screen link"
```

---

## WS-A3 — Shopkeeper anchor-nudge screen

> **Deviation (documented):** The spec placed the anchor overlay inside `inventory/[id]/images.tsx`. That screen is a drag-reorder list of all images; mixing a single-asset anchor editor into it is awkward. This plan instead adds a dedicated `inventory/[id]/try-on.tsx`, linked from `edit.tsx` (the established pattern used by `movements`/`analytics`). It overlays the anchor on the **cutout** (true anchor space), which the admin `getTryOnAsset` URL provides.

### Task 8: Anchor screen

**Files:**
- Create: `apps/shopkeeper/app/inventory/[id]/try-on.tsx`

`clampAnchor` (Task 5) is already unit-tested, so this screen is render/hook plumbing → typecheck + device smoke (no separate unit test, per the Class B floor). It uses tap-to-place plus four big nudge buttons (±0.02) so no fine motor control is required (CLAUDE.md senior-friendly rule).

- [ ] **Step 1: Implement the screen**

Create `apps/shopkeeper/app/inventory/[id]/try-on.tsx`:

```tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, Alert, Switch,
  type LayoutChangeEvent, type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { clampAnchor } from '../../../src/features/inventory/tryOnPresets';
import { api } from '../../../src/api/client';

interface AssetState {
  assetUrl: string | null;
  anchorX: number;
  anchorY: number;
  status: 'pending' | 'ready' | 'failed';
  enabled: boolean;
}

const NUDGE = 0.02;

export default function TryOnAnchorScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mountedRef = useRef(true);
  const [asset, setAsset] = useState<AssetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<AssetState>(`/api/v1/inventory/products/${id}/try-on-asset`);
        if (mountedRef.current) setAsset(res.data);
      } catch {
        if (mountedRef.current) setAsset(null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [id]);

  const setAnchor = useCallback((x: number, y: number) => {
    setAsset((prev) => (prev ? { ...prev, anchorX: clampAnchor(x), anchorY: clampAnchor(y) } : prev));
  }, []);

  const onImagePress = useCallback((e: GestureResponderEvent) => {
    if (box.w === 0 || box.h === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    setAnchor(locationX / box.w, locationY / box.h);
  }, [box, setAnchor]);

  const onSave = useCallback(async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const res = await api.patch<AssetState>(`/api/v1/inventory/products/${id}/try-on-asset`, {
        anchorX: asset.anchorX, anchorY: asset.anchorY, enabled: asset.enabled,
      });
      if (mountedRef.current) {
        setAsset(res.data);
        Alert.alert('', t('inventory.tryon_anchor_saved'));
      }
    } catch {
      Alert.alert('', t('inventory.images_err_generic'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [asset, id]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;

  if (!asset) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>{t('inventory.tryon_anchor_pending')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('inventory.tryon_anchor_title')}</Text>
      <Text style={styles.hint}>{t('inventory.tryon_anchor_hint')}</Text>

      {asset.status !== 'ready' || !asset.assetUrl ? (
        <Text style={styles.body}>
          {asset.status === 'failed' ? t('inventory.tryon_anchor_failed') : t('inventory.tryon_anchor_pending')}
        </Text>
      ) : (
        <>
          <Pressable
            onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            onPress={onImagePress}
            accessibilityRole="adjustable"
            accessibilityLabel={t('inventory.tryon_anchor_hint')}
            style={styles.canvas}
          >
            <Image source={{ uri: asset.assetUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
            <View
              pointerEvents="none"
              style={[styles.dot, { left: asset.anchorX * box.w - 10, top: asset.anchorY * box.h - 10 }]}
            />
          </Pressable>

          {/* Big nudge buttons — no fine motor control needed */}
          <View style={styles.nudgeGrid}>
            <NudgeBtn label="↑" onPress={() => setAnchor(asset.anchorX, asset.anchorY - NUDGE)} />
            <View style={styles.nudgeRow}>
              <NudgeBtn label="←" onPress={() => setAnchor(asset.anchorX - NUDGE, asset.anchorY)} />
              <NudgeBtn label="→" onPress={() => setAnchor(asset.anchorX + NUDGE, asset.anchorY)} />
            </View>
            <NudgeBtn label="↓" onPress={() => setAnchor(asset.anchorX, asset.anchorY + NUDGE)} />
          </View>

          <View style={styles.enableRow}>
            <Text style={styles.body}>{t('inventory.tryon_anchor_enable')}</Text>
            <Switch
              value={asset.enabled}
              onValueChange={(v) => setAsset((p) => (p ? { ...p, enabled: v } : p))}
              accessibilityLabel={t('inventory.tryon_anchor_enable')}
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t('inventory.tryon_anchor_save')}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>{t('inventory.tryon_anchor_save')}</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}

function NudgeBtn({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.nudgeBtn}>
      <Text style={styles.nudgeText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  title: { ...typography.body, fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 14, color: colors.textSecondary },
  body: { fontSize: 16, color: colors.textPrimary },
  canvas: {
    width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#F2ECDD', borderWidth: 1, borderColor: colors.border,
  },
  dot: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white,
  },
  nudgeGrid: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  nudgeRow: { flexDirection: 'row', gap: spacing.xl },
  nudgeBtn: {
    minWidth: 56, minHeight: 56, borderRadius: 12, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  nudgeText: { fontSize: 24, color: colors.primary },
  enableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, minHeight: 48 },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12, minHeight: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: 18, fontWeight: '600' },
});
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter @goldsmith/shopkeeper typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add apps/shopkeeper/app/inventory/[id]/try-on.tsx
git commit -m "feat(shopkeeper): try-on anchor nudge + enable screen"
```

---

## WS-F — Mobile try-on (WebView reusing the web build)

> **Deviation (documented):** Spec path was `apps/customer-mobile/app/browse/[id]/try-on.tsx`. Because `app/browse/[id].tsx` is the existing 1080-line PDP file, introducing a `[id]/` directory beside it risks expo-router route ambiguity and forces moving/renaming the PDP. This plan uses a non-colliding sibling route `app/browse/try-on/[id].tsx` (path `/browse/try-on/<id>`) and wires the CTA to it — no PDP relocation.

### Task 9: customer-web fullscreen WV route + client wrapper

**Files:**
- Create: `apps/customer-web/app/products/[id]/try-on-wv/page.tsx`
- Create: `apps/customer-web/app/products/[id]/try-on-wv/TryOnWvClient.tsx`
- Create: `apps/customer-web/test/try-on-wv-client.test.tsx`

The route fetches the tenant config server-side to resolve `shopId`, then renders the client wrapper. `TryOnModal` (Plan 2) is an opaque `fixed inset-0 z-50 bg-black` overlay, so the root-layout `StorefrontWrapper` chrome sits fully behind it and is never visible — this satisfies the "no nav chrome" requirement without restructuring layouts. On close the wrapper posts a message so the host React-Native WebView can pop the screen.

- [ ] **Step 1: Write the failing client test**

Create `apps/customer-web/test/try-on-wv-client.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockFetchTryOnData = vi.fn();
vi.mock('../lib/api', async () => {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...real, fetchTryOnData: mockFetchTryOnData };
});

vi.mock('../components/try-on/TryOnModal', () => ({
  TryOnModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="try-on-modal"><button onClick={onClose}>close</button></div>
  ),
}));

const DATA = {
  productId: 'p1', bodyPart: 'EAR', assetUrl: 'https://x.com/e.png',
  anchorX: 0.5, anchorY: 0, lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('TryOnWvClient', () => {
  it('mounts the modal when try-on data is available', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(DATA);
    const { TryOnWvClient } = await import('../app/products/[id]/try-on-wv/TryOnWvClient');
    render(<TryOnWvClient productId="p1" shopId="shop-1" />);
    await waitFor(() => expect(screen.getByTestId('try-on-modal')).toBeInTheDocument());
  });

  it('shows an error state when no try-on data', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(null);
    const { TryOnWvClient } = await import('../app/products/[id]/try-on-wv/TryOnWvClient');
    render(<TryOnWvClient productId="p1" shopId="shop-1" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('posts a close message to the native WebView on close', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(DATA);
    const postMessage = vi.fn();
    (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView = { postMessage };
    const { TryOnWvClient } = await import('../app/products/[id]/try-on-wv/TryOnWvClient');
    render(<TryOnWvClient productId="p1" shopId="shop-1" />);
    await waitFor(() => screen.getByTestId('try-on-modal'));
    screen.getByText('close').click();
    expect(postMessage).toHaveBeenCalledWith(expect.stringContaining('tryon-close'));
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
pnpm --filter @goldsmith/customer-web test -- try-on-wv-client
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client wrapper**

Create `apps/customer-web/app/products/[id]/try-on-wv/TryOnWvClient.tsx`:

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { fetchTryOnData } from '@/lib/api';
import type { CatalogTryOnResponse } from '@/lib/api';
import { TryOnModal } from '@/components/try-on/TryOnModal';

interface Props {
  productId: string;
  shopId: string;
}

type State = 'loading' | 'ready' | 'unavailable';

/** Notify a hosting react-native-webview (if any) that the user closed try-on. */
function notifyNativeClose(): void {
  const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
  rn?.postMessage(JSON.stringify({ type: 'tryon-close' }));
}

export function TryOnWvClient({ productId, shopId }: Props) {
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<CatalogTryOnResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await fetchTryOnData(productId, shopId);
      if (cancelled) return;
      if (d && d.assetUrl) { setData(d); setState('ready'); }
      else setState('unavailable');
    })();
    return () => { cancelled = true; };
  }, [productId, shopId]);

  const handleClose = useCallback(() => {
    notifyNativeClose();
  }, []);

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
        <span className="sr-only" role="status">लोड हो रहा है…</span>
      </div>
    );
  }

  if (state === 'unavailable' || !data) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black px-8">
        <p role="alert" className="text-center font-body text-sm text-white/80">
          इस उत्पाद के लिए ट्राय-ऑन उपलब्ध नहीं है
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg bg-primary px-6 py-3 font-ui text-sm text-white"
        >
          वापस जाएं
        </button>
      </div>
    );
  }

  return <TryOnModal tryOnData={data} onClose={handleClose} />;
}
```

- [ ] **Step 4: Run to verify it passes**

```
pnpm --filter @goldsmith/customer-web test -- try-on-wv-client
```
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the server route**

Create `apps/customer-web/app/products/[id]/try-on-wv/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig } from '@/lib/api';
import { TryOnWvClient } from './TryOnWvClient';

interface PageProps {
  params: { id: string };
  searchParams: { shop?: string };
}

/**
 * Fullscreen, chrome-less try-on route for embedding in the customer-mobile
 * WebView. The root layout's StorefrontWrapper chrome renders behind the
 * opaque fullscreen TryOnModal and is never visible. `?shop=<slug>` lets the
 * mobile host pin its tenant; otherwise we fall back to the normal resolver.
 */
export default async function TryOnWvPage({ params, searchParams }: PageProps) {
  const slug = searchParams.shop?.trim().toLowerCase() || resolveShopSlug(headers());
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  return <TryOnWvClient productId={params.id} shopId={config.shopId} />;
}
```

- [ ] **Step 6: Typecheck + commit**

```
pnpm --filter @goldsmith/customer-web typecheck
git add "apps/customer-web/app/products/[id]/try-on-wv" apps/customer-web/test/try-on-wv-client.test.tsx
git commit -m "feat(customer-web): fullscreen /products/[id]/try-on-wv route for mobile WebView"
```

---

### Task 10: `react-native-webview` dependency + `webBaseUrl` config

**Files:**
- Modify: `apps/customer-mobile/package.json`
- Modify: `apps/customer-mobile/app.config.ts`

- [ ] **Step 1: Add the dependency (Expo SDK 50-aligned version)**

```
pnpm --filter @goldsmith/customer-mobile add react-native-webview@13.6.4
```

(13.6.4 is the version Expo SDK 50 pins. If `npx expo install react-native-webview` is available and preferred, use it to let Expo choose the SDK-correct version; record the resolved version in the commit.)

- [ ] **Step 2: Add `webBaseUrl` to expo config**

In `apps/customer-mobile/app.config.ts`, inside the `extra` block (next to `apiBaseUrl`/`tenantSlug`), add:

```typescript
    webBaseUrl: process.env['EXPO_PUBLIC_WEB_BASE_URL'] ?? 'http://10.0.2.2:3000',
```

And add `EXPO_PUBLIC_WEB_BASE_URL` to the env echo array near the other `EXPO_PUBLIC_*` entries (the `['EXPO_PUBLIC_API_BASE_URL', ...]` list):

```typescript
    ['EXPO_PUBLIC_WEB_BASE_URL',        process.env['EXPO_PUBLIC_WEB_BASE_URL']],
```

> **Secure-context note:** Browser `getUserMedia` only runs in a secure context (HTTPS, or `http://localhost`). For production point `EXPO_PUBLIC_WEB_BASE_URL` at the deployed HTTPS customer-web host. For on-device dev smoke, run `adb reverse tcp:3000 tcp:3000` and set `EXPO_PUBLIC_WEB_BASE_URL=http://localhost:3000` (localhost is a secure context); `http://10.0.2.2:3000` will NOT grant the camera.

- [ ] **Step 3: Typecheck + commit**

```
pnpm --filter @goldsmith/customer-mobile typecheck
git add apps/customer-mobile/package.json apps/customer-mobile/app.config.ts pnpm-lock.yaml
git commit -m "feat(customer-mobile): add react-native-webview + webBaseUrl config"
```

---

### Task 11: Mobile try-on screen + PDP CTA

**Files:**
- Create: `apps/customer-mobile/app/browse/try-on/[id].tsx`
- Modify: `apps/customer-mobile/app/browse/[id].tsx`

The screen holds the OS camera permission (reusing the PDP's lazy `expo-camera` pattern) so the in-WebView `getUserMedia` is granted without a second OS prompt; the WebView's Android `WebChromeClient.onPermissionRequest` is handled by react-native-webview and grants camera once the app holds the runtime permission. The DPDPA consent sheet still appears in-page (Plan 2 `ConsentSheet`). This screen is render/permission plumbing → typecheck + device smoke (no unit test).

- [ ] **Step 1: Confirm the Android camera permission exists**

```
grep -rn "expo-camera\|CAMERA" apps/customer-mobile/app.config.ts apps/customer-mobile/app.json 2>/dev/null
```
Expected: the `expo-camera` plugin (or an explicit `android.permissions` entry) is present — the HUID scanner already requires it. If neither is present, add `'expo-camera'` to the `plugins` array in `app.config.ts` (it auto-injects `android.permission.CAMERA`) and note the deviation.

- [ ] **Step 2: Implement the screen**

Create `apps/customer-mobile/app/browse/try-on/[id].tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

type PermState = 'checking' | 'granted' | 'denied';

export default function MobileTryOnScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [perm, setPerm] = useState<PermState>('checking');

  const webBaseUrl = (Constants.expoConfig?.extra?.['webBaseUrl'] as string | undefined) ?? '';
  const tenantSlug = (Constants.expoConfig?.extra?.['tenantSlug'] as string | undefined) ?? '';
  const uri = `${webBaseUrl}/products/${id}/try-on-wv?shop=${encodeURIComponent(tenantSlug)}`;

  useEffect(() => {
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const cam = require('expo-camera') as {
          Camera: { requestCameraPermissionsAsync: () => Promise<{ status: string }> };
        };
        const { status } = await cam.Camera.requestCameraPermissionsAsync();
        setPerm(status === 'granted' ? 'granted' : 'denied');
      } catch {
        // expo-camera not linked — let the WebView prompt handle it.
        setPerm('granted');
      }
    })();
  }, []);

  const onMessage = (e: WebViewMessageEvent): void => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string };
      if (msg.type === 'tryon-close') router.back();
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="बंद करें"
          accessibilityRole="button"
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 22, color: '#fff' }}>✕</Text>
        </TouchableOpacity>
        <Text style={{ marginLeft: spacing.sm, fontFamily: typography.serif.family, fontSize: 16, color: '#fff' }}>
          ट्राय करके देखें
        </Text>
      </View>

      {perm === 'checking' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {perm === 'denied' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: '#fff', textAlign: 'center' }}>
            कैमरा अनुमति नहीं मिली। सेटिंग्स में कैमरा चालू करें और फिर से प्रयास करें।
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.lg, minHeight: 48, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="वापस जाएं"
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>वापस जाएं</Text>
          </TouchableOpacity>
        </View>
      )}

      {perm === 'granted' && (
        <WebView
          source={{ uri }}
          onMessage={onMessage}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // iOS: grant camera to the page without a second prompt.
          // (Android grants via WebChromeClient.onPermissionRequest once the
          //  app holds CAMERA, handled by react-native-webview.)
          mediaCapturePermissionGrantType="grant"
          originWhitelist={['*']}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 3: Wire the CTA on the PDP**

In `apps/customer-mobile/app/browse/[id].tsx`, inside the `{!isUnavailable && (<View style={{ gap: spacing.sm }}> ... )}` action-CTA block (where the HUID-scan and "घर पर ट्राय बुक करें" buttons are), add a prominent try-on button as the first child:

```tsx
            <TouchableOpacity
              onPress={() => router.push(`/browse/try-on/${product.id}` as Parameters<typeof router.push>[0])}
              style={{ backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center', minHeight: 48 }}
              accessibilityLabel="आभूषण पहनकर देखें — वर्चुअल ट्राय-ऑन"
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.white, fontWeight: '600' }}>
                ✦ ट्राय करके देखें
              </Text>
            </TouchableOpacity>
```

- [ ] **Step 4: Typecheck + commit**

```
pnpm --filter @goldsmith/customer-mobile typecheck
git add "apps/customer-mobile/app/browse/try-on/[id].tsx" "apps/customer-mobile/app/browse/[id].tsx"
git commit -m "feat(customer-mobile): WebView try-on screen + PDP CTA"
```

---

## WS-G — Privacy, gates & polish

### Task 12: Privacy-policy section + app-store privacy labels

**Files:**
- Modify: `apps/customer-web/app/privacy/page.tsx`
- Create: `docs/app-store-privacy.md`

- [ ] **Step 1: Add the try-on privacy section to the web policy**

In `apps/customer-web/app/privacy/page.tsx`, add inside the card `<div>` (after the existing paragraphs, before the closing `</div>`):

```tsx
        <h2 className="mt-4 font-heading text-xl text-ink">वर्चुअल ट्राय-ऑन और कैमरा</h2>
        <p>
          वर्चुअल ट्राय-ऑन पूरी तरह आपके डिवाइस पर चलता है। कैमरा का दृश्य केवल आपके फ़ोन/ब्राउज़र
          में संसाधित होता है — कोई वीडियो या फ़ोटो किसी सर्वर पर नहीं भेजी जाती, सहेजी नहीं जाती,
          और कोई चेहरा-पहचान टेम्पलेट नहीं बनाया जाता।
        </p>
        <p className="text-sm text-inkMute">
          हम केवल आपकी सहमति का रिकॉर्ड रखते हैं (कोई कैमरा डेटा नहीं)। यह सुविधा DPDPA 2023 के
          अनुरूप बनाई गई है। कैमरा अनुमति आप कभी भी डिवाइस सेटिंग्स से बंद कर सकते हैं।
        </p>
```

- [ ] **Step 2: Create the app-store privacy labels doc**

Create `docs/app-store-privacy.md`:

```markdown
# App-Store Privacy Labels — Virtual Try-On

The try-on feature runs entirely on-device (MediaPipe Tasks Vision, WASM). No
camera frame, image, video, or biometric template is collected, stored, or
transmitted. Only a consent **event** (no camera data) is recorded.

## Google Play — Data safety form

- **Camera (photos/videos):** Accessed, **not collected**, **not shared**.
  Purpose: App functionality (virtual try-on preview). Processed on-device only.
- **Biometric / face data:** **Not collected.** No face embedding, template,
  age/gender/skin-tone inference.
- **Data shared with third parties:** None for try-on.
- **Data deletion:** No try-on data is stored, so there is nothing to delete;
  camera permission is revocable in OS settings.

## Apple App Store — App Privacy ("Nutrition label")

- **Data Not Collected** for the try-on feature (camera is used in real time and
  discarded each frame; nothing leaves the device).
- `NSCameraUsageDescription` (iOS): "आभूषण को वर्चुअली पहनकर देखने के लिए कैमरा
  का उपयोग होता है। कोई फ़ोटो या वीडियो सहेजी या भेजी नहीं जाती।"

## Enforcement

- Semgrep `goldsmith.no-try-on-direct-network` (ops/semgrep/no-try-on-egress.yaml)
  blocks raw network calls inside `apps/customer-web/components/try-on/**`.
- Runtime QA: DevTools/proxy network capture must show zero outbound requests
  carrying camera frames during a try-on session (see Task 13).
```

- [ ] **Step 3: Commit**

```
git add apps/customer-web/app/privacy/page.tsx docs/app-store-privacy.md
git commit -m "docs(privacy): try-on privacy section + app-store data-safety labels"
```

---

### Task 13: Runtime smoke, Lighthouse/axe, full gate, agent-context

This is the non-negotiable runtime floor for a Class A story. Web smoke + device smoke + the egress check are mandatory; record results in the PR.

- [ ] **Step 1: Web runtime smoke — all four categories track + true-to-size**

Bring up the stack (API on 3001, customer-web on 3000, Postgres + Redis), seed storefront demo data, and run `pnpm setup:mediapipe` in `apps/customer-web` if not already done. Then, as a shopkeeper, for one product per body part: set the body part + a real mm dimension, upload an image (cutout worker runs with `BG_REMOVAL_ADAPTER=rembg`), open the anchor screen, nudge + enable. As a customer, open each product's PDP and tap "✦ ट्राय करके देखें". Verify on a real camera feed:
  - **EAR**: earrings anchor at both lobes, scale with face distance, hide the far-side earring past ~45° yaw.
  - **NECK**: pendant hangs gravity-down below the chin.
  - **FINGER**: ring sits on the ring finger, rotates with the finger axis.
  - **WRIST**: bangle sits at the wrist, scales true-to-size.
  - No "अनुमानित आकार" badge on products that have real mm (true-to-size path active).

  Record pass/fail per category. (Realism tuning of indices/filters is empirical — log any anchor offset for a follow-up; functional anchoring + scaling is the gate.)

- [ ] **Step 2: Privacy egress check (DPDPA invariant)**

With browser DevTools → Network (and/or a proxy) open during an active try-on session, confirm **zero** outbound requests carry camera frames/landmarks. Only expected requests: the `.task` model + WASM (same-origin `/mediapipe/*`), the cutout PNG (ImageKit), and `GET /catalog/products/:id/try-on`. Record the captured request list.

- [ ] **Step 3: Device smoke — mobile WebView**

Build/run customer-mobile from a short path (`C:\g` or `C:\gs`, per `docs/windows-android-dev.md`). Set `EXPO_PUBLIC_WEB_BASE_URL` to an HTTPS host (or `adb reverse tcp:3000 tcp:3000` + `http://localhost:3000`). On the PDP tap "✦ ट्राय करके देखें": the native screen requests camera permission once, the WebView loads the WV route, the in-page consent sheet appears, and after Agree the overlay tracks on the live camera. Closing returns to the PDP (postMessage → `router.back()`).

- [ ] **Step 4: Lighthouse + axe on the PDP**

```
# Lighthouse (PDP, with the try-on CTA present)
npx lighthouse http://localhost:3000/products/<id> --only-categories=performance,accessibility,best-practices --quiet --chrome-flags="--headless"
```
Run the project's axe-core check on `/products/[id]` (per the storefront Lighthouse/axe gate). Expected: accessibility ≥ existing baseline, no new violations from the CTA. Record scores.

- [ ] **Step 5: Full pre-push gate**

```
pnpm typecheck
pnpm lint
pnpm test:ci
```
Expected: all green (typecheck + lint + unit + integration + tenant-isolation + semgrep + docs:validate). The semgrep `no-try-on-egress` rule must stay green (the WV client uses only `fetchTryOnData` from `lib/api`, no raw fetch).

- [ ] **Step 6: Regenerate agent-context**

```
pnpm docs:context
pnpm docs:validate
```
Expected: regenerates cleanly; validate passes (new inventory route + shopkeeper screens picked up).

- [ ] **Step 7: Commit**

```
git add docs/agent-context
git commit -m "chore(docs): regenerate agent-context after try-on plan 3"
```

---

### Task 14: Class A review gate

- [ ] **Step 1: Run the parallel review gate on HEAD**

Per CLAUDE.md Class A: run `codex review --base main` (cross-model, when the weekly limit allows — see `feedback_codex_limit_batch_strategy.md`) **and** `/security-review` simultaneously. The new attack surface is the authenticated `PATCH /api/v1/inventory/products/:id/try-on-asset` endpoint (tenant isolation, role gate, the `enabled = ($3 AND status='ready')` guard) and the public `try-on-wv` route (tenant resolution via `?shop`/header).

- [ ] **Step 2: Resolve findings, write markers**

Fix any P1/P2 in Claude, re-run the relevant gate once (do not burn Codex rounds iterating). On clean: ensure `.security-review-passed` (and `.codex-review-passed` when Codex ran) reflect this branch. If Codex is unavailable, note the `/security-review` + whole-branch review + CI substitute in the commit, per the project Class B/A substitute rule.

- [ ] **Step 3: Push**

```
git push -u origin <branch>
```
Open the PR only after Steps 1–2 of this task and Task 13 Steps 1–6 pass.

---

## Self-Review (completed by plan author)

**1. Spec coverage (WS-A shopkeeper UI, WS-F mobile, WS-G privacy/gates):**

| Spec item | Task |
|---|---|
| WS-A `new.tsx`/`edit.tsx` Hindi dimension form, presets→mm, body-part selector | Tasks 5, 6, 7 |
| WS-A `images.tsx` auto-proposed anchor overlay + nudge + PATCH | Tasks 1–4 (API), 8 (screen) — relocated to `inventory/[id]/try-on.tsx`, documented |
| WS-A `PATCH /inventory/products/:id/try-on-asset` (anchor + enabled) | Tasks 1–3 |
| WS-A reuse REST + idempotency patterns, tenant isolation | Tasks 2 (`withTenantTx`/RLS), 4 (isolation test) |
| WS-F `browse/[id]/try-on.tsx` screen | Task 11 (sibling `browse/try-on/[id].tsx`, documented) |
| WS-F WebView reusing web build via fullscreen route | Tasks 9 (`try-on-wv`), 11 (WebView) |
| WS-F Expo Camera permission, reuse HuidScanModal pattern | Task 11 |
| WS-F CTA from `browse/[id].tsx` | Task 11 |
| WS-F build from `C:\g`/`C:\gs` | Task 13 Step 3 |
| WS-G privacy-policy section | Task 12 |
| WS-G app-store privacy labels | Task 12 (`docs/app-store-privacy.md`) |
| WS-G runtime smoke: 4 tracks on video | Task 13 Step 1 |
| WS-G devtools zero camera-frame egress | Task 13 Step 2 |
| WS-G Lighthouse + axe on PDP | Task 13 Step 4 |
| WS-G full `pnpm test:ci` | Task 13 Step 5 |
| Class A review gate (codex + security-review) | Task 14 |

**Documented deviations:** (a) anchor editor in a dedicated `inventory/[id]/try-on.tsx` rather than `images.tsx` (the latter is a reorder list); (b) mobile screen at `browse/try-on/[id].tsx` rather than `browse/[id]/try-on.tsx` (avoids expo-router collision with the existing PDP file); (c) `InventoryService` gains an `IMAGEKIT_URL_BUILDER` constructor param (already provided in `InventoryModule`), with the unit-test `makeService()` updated to match.

**2. Placeholder scan:** No TBD/TODO/"handle later". Every code step ships complete code. Two steps say "confirm against file X first" (the `@goldsmith/shared` barrel style; the product GET surfacing the mm fields) — these are existing-codebase reconciliations naming the exact file/symbol and the fallback if the assumption is wrong, not deferred work.

**3. Type consistency:** `BodyPart` union `'EAR'|'NECK'|'FINGER'|'WRIST'` is identical across `UpdateTryOnAssetSchema`/`AdminTryOnAssetResponse` (Task 1), `tryOnPresets.ts` (Task 5), `TryOnDimensionsField` (Task 6), and `CatalogTryOnResponse` (Plan 1). `mmFieldForBodyPart` returns the exact Zod field names `tryOnLengthMm`/`tryOnDiameterMm` (Plan 1 Task 13) used in Task 7's payloads. `AdminTryOnAssetResponse` shape (productId, bodyPart, assetUrl, anchorX, anchorY, status, enabled) is identical across the schema (Task 1), the service `mapTryOnAssetRow` (Task 2), and the anchor screen's `AssetState` (Task 8). `updateTryOnAsset` persists anchors via `.toFixed(4)` (string) matching the migration's `DECIMAL(5,4)` and the Task 2 test assertion. The WV `postMessage` payload `{ type: 'tryon-close' }` is produced in `TryOnWvClient` (Task 9) and consumed in the mobile `onMessage` (Task 11).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-virtual-try-on-plan3.md`. This is the final plan of the 3-part Virtual Try-On feature (Plans 1 + 2 merged to main at HEAD `2661608`).

**Before running WS-F/WS-G smoke:** the customer-web `pnpm setup:mediapipe` step (Plan 2) must have been run so `public/mediapipe/` holds the WASM + `.task` models.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks. Class A → the review gate (`/security-review` on the new endpoint + Codex when available) runs before push. Use `/superpowers:subagent-driven-development`.

2. **Inline Execution** — execute tasks sequentially in this session with checkpoints. Use `/superpowers:executing-plans`.

**Merge-order note:** WS-A1 (API) must land before the shopkeeper anchor screen (WS-A3) and the mobile/web try-on are end-to-end testable, since true-to-size + enabling overlays depends on the new write path.
