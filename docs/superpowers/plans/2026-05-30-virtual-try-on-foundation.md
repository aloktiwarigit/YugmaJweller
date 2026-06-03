# Virtual Try-On — Foundation Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data model, the framework-agnostic fit-engine math, and the catalog API + background background-removal worker that together let the (later) web/mobile UI render jewellery true-to-size on a person's camera.

**Architecture:** A new pure-TS package `@goldsmith/try-on-core` holds all the fitting math (scale, anchor, pose, smoothing, mirror, metric tables) with zero framework deps so web and mobile share it. A new migration `0077` adds optional real-world mm dimensions to `products` and a tenant-scoped `product_try_on_assets` table (transparent-PNG cutout + anchor + body-part) with RLS. A new `@goldsmith/integrations-bg-removal` adapter (rembg, with a throwing Stub) runs as a BullMQ job after each product-image upload to produce the cutout. The public catalog API gains `GET /catalog/products/:id/try-on`.

**Tech Stack:** TypeScript, Vitest (TDD), NestJS, Drizzle/Postgres + raw `pg`, BullMQ, rembg (MIT, isnet-general-use / BiRefNet). All free / on-device-or-self-hosted — no paid SaaS.

**Scope note:** This is Plan 1 of 3. Plan 2 = web try-on UI (WS-D face + WS-E hand). Plan 3 = mobile (WS-F) + privacy/gates (WS-G). This plan produces working, headless-testable software on its own (math unit tests + API contract/tenant-isolation tests + worker).

**Conventions verified against the codebase (do not deviate without noting it):**
- Migrations: plain SQL in `packages/db/src/migrations/NNNN_snake_case.sql`; runner (`packages/db/src/migrate.ts`) auto-discovers `.sql` files sorted lexicographically, tracks applied ones in a `__migrations` table (no journal to edit). **Next free number is `0077`** (0075 + two 0076 files already exist).
- Tenant tables use `tenantScopedTable(...)` (`packages/db/src/schema/_helpers/tenantScopedTable.ts`) which **auto-injects `shop_id uuid NOT NULL`** + a `<name>_shop_id_idx` index — never redeclare `shop_id` in the Drizzle column map.
- **Canonical RLS block** (verified against `0014_inventory_base.sql` / `0074_payment_sessions.sql`): every tenant table needs `ENABLE` **and** `FORCE` row-level security, a `DROP POLICY IF EXISTS` then `CREATE POLICY rls_<table>_tenant_isolation ... FOR ALL USING (...) WITH CHECK (...)` keyed on `current_setting('app.current_shop_id', true)::uuid`, and `REVOKE ALL ... FROM app_user; GRANT <verbs> ... TO app_user;`. The full block is in Task 1.
- **Tenant context in app code** flows via `tenantContext.runWith(ctx, ...)` + `withTenantTx(pool, tx => ...)` (auth paths) or `withShopTx(pool, shopId, tx => ...)` (public catalog reads). Never set `app.current_shop_id` by hand in a service — use these helpers so RLS is active under `app_user`.
- Packages **build to `dist`** (`main`/`types` → `./dist/index.js`, `build: tsc -p tsconfig.build.json`), mirroring `@goldsmith/money`. Tests co-located as `src/*.spec.ts`; `import { describe, it, expect } from 'vitest'` (no globals). Base tsconfig is CommonJS — do **not** add `"type": "module"`.
- Image URLs are ONLY built via `ImageKitTransformUrlBuilder` (`packages/integrations/storage/.../imagekit-url-builder.ts`), injected as `IMAGEKIT_URL_BUILDER` / used as `this.urlBuilder`.
- Storage is `@Inject(STORAGE_PORT)` (`@goldsmith/integrations-storage`) — methods `downloadBuffer(key)`, `uploadBuffer(key, data, contentType)`. There is no `getStorageAdapter()` function.
- BullMQ: `TenantQueue` (enqueue: `queue.add(ctx, jobName, data)`) + `createTenantWorker(name, (ctx,data)=>proc.handle(data), tenants, redis)` from `@goldsmith/queue`; worker is wired in the module's `onModuleInit`. The worker sets `tenantContext` from `job.data.meta.tenantId`, so the processor uses `withTenantTx`.
- Audit: `auditLog(this.pool, {...})` from `@goldsmith/audit` (fire-and-forget), NOT `audit.emit(tx, ...)`.

---

## File Structure

**Create:**
- `packages/db/src/migrations/0077_virtual_try_on.sql` — mm cols on `products`, `product_try_on_assets` table + RLS.
- `packages/db/src/schema/product-try-on-assets.ts` — Drizzle schema for the new table.
- `packages/try-on-core/package.json`, `tsconfig.json`, `src/index.ts` — package skeleton.
- `packages/try-on-core/src/types.ts` — shared types (`Landmark`, `BodyPart`, `Vec2`, `FitResult`, etc.).
- `packages/try-on-core/src/one-euro-filter.ts` (+ `.spec.ts`) — jitter smoothing.
- `packages/try-on-core/src/scale.ts` (+ `.spec.ts`) — `mmPerPixelFace`, `mmPerPixelHand`.
- `packages/try-on-core/src/anchor.ts` (+ `.spec.ts`) — `anchorFor`.
- `packages/try-on-core/src/size.ts` (+ `.spec.ts`) — `sizePx`, weight fallback.
- `packages/try-on-core/src/pose.ts` (+ `.spec.ts`) — `decomposePose`.
- `packages/try-on-core/src/mirror.ts` (+ `.spec.ts`) — front-camera handedness/mirror correction.
- `packages/try-on-core/src/metric-tables.ts` (+ `.spec.ts`) — ring/bangle mm tables ported from `size-guide.tsx`.
- `packages/integrations/bg-removal/package.json`, `tsconfig.json`, `src/{index,types,errors,factory}.ts`.
- `packages/integrations/bg-removal/src/adapters/stub.adapter.ts` (+ `.spec.ts`).
- `packages/integrations/bg-removal/src/adapters/rembg.adapter.ts`.
- `apps/api/src/modules/inventory/try-on-asset.processor.ts` — BullMQ worker producing the cutout asset.
- `apps/api/test/tenant-isolation/product-try-on-assets.isolation.spec.ts`.

**Modify:**
- `packages/db/src/schema/index.ts` — export the new schema; `packages/db/src/schema/products.ts` — 3 mm columns.
- `packages/shared/src/schemas/product.schema.ts` (Zod — Task 13) — mm fields + `tryOnBodyPart` enum.
- `apps/api/src/modules/inventory/inventory.repository.ts` — persist mm columns in INSERT/UPDATE.
- `apps/api/src/modules/inventory/inventory.service.ts` — upsert `product_try_on_assets` row when `tryOnBodyPart` set.
- `apps/api/src/modules/inventory/inventory.module.ts` — register the `try-on-bg-removal` `TenantQueue` + worker (Task 14).
- `apps/api/src/modules/inventory/product-images.service.ts` — enqueue the cutout job after image insert.
- `apps/api/src/modules/catalog/catalog.service.ts` — `getTryOn(productId, shopId)` via `withShopTx`.
- `apps/api/src/modules/catalog/catalog.controller.ts` — `GET products/:id/try-on`.
- `packages/customer-shared/src/catalog-types.ts` — `CatalogTryOnResponse` type.

---

## WS-A — Data & Asset Model

### Task 1: Migration 0077 — mm dimensions + `product_try_on_assets` table + RLS

**Files:**
- Create: `packages/db/src/migrations/0077_virtual_try_on.sql`

- [ ] **Step 1: Confirm the canonical RLS block**

Open `packages/db/src/migrations/0014_inventory_base.sql` (lines ~54-80) and confirm the products/product_images RLS form: `ENABLE` + `FORCE` row-level security, `DROP POLICY IF EXISTS` then `CREATE POLICY rls_<table>_tenant_isolation ... FOR ALL USING (...) WITH CHECK (...)` on `current_setting('app.current_shop_id', true)::uuid`, plus `REVOKE ALL ... FROM app_user; GRANT ... TO app_user;`. Step 2 reproduces this exact form. (1-minute read; do not skip — a missing `FORCE` or `GRANT` silently breaks tenant isolation or all writes.)

- [ ] **Step 2: Write the migration SQL**

Create `packages/db/src/migrations/0077_virtual_try_on.sql`:

```sql
-- Migration 0077: Virtual Try-On (VTO)
--
-- Adds the data the try-on feature needs to render jewellery true-to-size:
--   1. Optional real-world physical dimensions (mm) on products. Weight is NOT
--      a usable size proxy (volume != shape), so true-to-size requires real mm.
--      These are compliance-neutral display fields, NOT money/weight columns.
--   2. product_try_on_assets: one transparent-PNG cutout + anchor + body-part
--      per product, kept off the hot product_images path. Tenant-scoped + RLS.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Physical dimension columns on products (all optional)
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS try_on_length_mm   DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS try_on_width_mm    DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS try_on_diameter_mm DECIMAL(8,2);

-- ---------------------------------------------------------------------------
-- 2. product_try_on_assets — cutout + placement metadata
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_try_on_assets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL,
  source_image_id    UUID,
  body_part          TEXT NOT NULL,
  asset_storage_key  TEXT,                       -- null until the cutout job completes
  anchor_x           DECIMAL(5,4) NOT NULL DEFAULT 0.5,  -- normalized 0..1 within cutout
  anchor_y           DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  status             TEXT NOT NULL DEFAULT 'pending',    -- pending|ready|failed
  enabled            BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Composite FKs prevent cross-tenant FK bypass (same pattern as 0067/0074).
  -- Parent UNIQUE(shop_id,id) constraints already exist: products_shop_id_id_uniq
  -- (0067) and product_images_shop_id_id_uniq (0067/0068). Confirm they exist;
  -- if not, add them in a DO block first (see 0074 for the guarded pattern).
  CONSTRAINT pta_shop_product_fkey
    FOREIGN KEY (shop_id, product_id)
    REFERENCES products (shop_id, id) ON DELETE CASCADE,
  CONSTRAINT pta_shop_image_fkey
    FOREIGN KEY (shop_id, source_image_id)
    REFERENCES product_images (shop_id, id) ON DELETE SET NULL (source_image_id),
  CONSTRAINT product_try_on_assets_body_part_chk
    CHECK (body_part IN ('EAR', 'NECK', 'FINGER', 'WRIST')),
  CONSTRAINT product_try_on_assets_status_chk
    CHECK (status IN ('pending', 'ready', 'failed')),
  CONSTRAINT product_try_on_assets_anchor_x_rng CHECK (anchor_x >= 0 AND anchor_x <= 1),
  CONSTRAINT product_try_on_assets_anchor_y_rng CHECK (anchor_y >= 0 AND anchor_y <= 1)
);

-- One try-on asset per product in v1 (single overlay). Drop/extend later if
-- multiple body parts per product are needed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_try_on_assets_product
  ON product_try_on_assets (product_id);

CREATE INDEX IF NOT EXISTS idx_product_try_on_assets_shop
  ON product_try_on_assets (shop_id);

-- RLS — ENABLE + FORCE (so even the table owner cannot bypass), canonical policy.
ALTER TABLE product_try_on_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_try_on_assets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_product_try_on_assets_tenant_isolation ON product_try_on_assets;
CREATE POLICY rls_product_try_on_assets_tenant_isolation ON product_try_on_assets
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON product_try_on_assets FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_try_on_assets TO app_user;

COMMIT;
```

Note: if `psql` reports `products_shop_id_id_uniq` / `product_images_shop_id_id_uniq` do not exist, add them with the guarded `DO $$ ... ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (shop_id, id) ... $$` block from `0074_payment_sessions.sql` before the `CREATE TABLE`. If the composite-FK approach is blocked, fall back to plain `REFERENCES products(id) ON DELETE CASCADE` + `REFERENCES product_images(id) ON DELETE SET NULL` (RLS still isolates; composite FK is defense-in-depth) and note the deviation.

- [ ] **Step 3: Apply the migration against the dev DB**

The runner is `packages/db/src/migrate.ts` (CLI entry runs `runMigrations`). With dev Postgres running and `DATABASE_URL` set, run whichever exists — check `packages/db/package.json` scripts first:
```
pnpm --filter @goldsmith/db migrate        # if a migrate script exists
# fallback if not:
pnpm --filter @goldsmith/db exec tsx src/migrate.ts
```
Expected: output logs `applying migration` for `0077_virtual_try_on.sql`, no error. (Migrations also auto-apply in test fixtures via `runMigrations`, so the tenant-isolation test in Task 17 will pick it up regardless.)

- [ ] **Step 4: Verify the table + RLS exist**

Run:
```
psql "$DATABASE_URL" -c "\d+ product_try_on_assets"
```
Expected: the table prints with the columns above and `Policies (forced row security enabled): rls_product_try_on_assets_tenant_isolation`.

- [ ] **Step 5: Commit**

```
git add packages/db/src/migrations/0077_virtual_try_on.sql
git commit -m "feat(db): migration 0077 — try-on dimensions + product_try_on_assets (RLS)"
```

---

### Task 2: Drizzle schema for `product_try_on_assets` + barrel export

**Files:**
- Create: `packages/db/src/schema/product-try-on-assets.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/schema/products.ts` (add the 3 mm columns to the Drizzle model)

- [ ] **Step 1: Write the schema file**

Create `packages/db/src/schema/product-try-on-assets.ts`:

```typescript
import { uuid, text, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { products } from './products';
import { productImages } from './product-images';

// shop_id is auto-injected by tenantScopedTable — do NOT redeclare it here.
export const productTryOnAssets = tenantScopedTable('product_try_on_assets', {
  id:                uuid('id').primaryKey().defaultRandom(),
  product_id:        uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  source_image_id:   uuid('source_image_id').references(() => productImages.id, { onDelete: 'set null' }),
  body_part:         text('body_part').notNull(),
  asset_storage_key: text('asset_storage_key'),
  anchor_x:          decimal('anchor_x', { precision: 5, scale: 4 }).notNull().default('0.5000'),
  anchor_y:          decimal('anchor_y', { precision: 5, scale: 4 }).notNull().default('0.0000'),
  status:            text('status').notNull().default('pending'),
  enabled:           boolean('enabled').notNull().default(false),
  created_at:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Add the mm columns to the products Drizzle model**

In `packages/db/src/schema/products.ts`, inside the `tenantScopedTable('products', { ... })` column map, add after `primary_image_id`:

```typescript
  // -------------------------------------------------------------------------
  // Virtual try-on physical dimensions — migration 0077 (optional, mm)
  // -------------------------------------------------------------------------
  try_on_length_mm:   decimal('try_on_length_mm',   { precision: 8, scale: 2 }),
  try_on_width_mm:    decimal('try_on_width_mm',    { precision: 8, scale: 2 }),
  try_on_diameter_mm: decimal('try_on_diameter_mm', { precision: 8, scale: 2 }),
```

(Confirm `decimal` is already imported at the top of `products.ts` — it is, since weight columns use it.)

- [ ] **Step 3: Export from the barrel**

In `packages/db/src/schema/index.ts`, add near the other `product-*` exports:

```typescript
export * from './product-try-on-assets';
```

- [ ] **Step 4: Typecheck the db package**

Run:
```
pnpm --filter @goldsmith/db typecheck
```
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```
git add packages/db/src/schema/product-try-on-assets.ts packages/db/src/schema/index.ts packages/db/src/schema/products.ts
git commit -m "feat(db): drizzle schema for product_try_on_assets + products mm columns"
```

---

## WS-B — Fit-Engine Core (`@goldsmith/try-on-core`)

### Task 3: Package skeleton

**Files:**
- Create: `packages/try-on-core/package.json`, `packages/try-on-core/tsconfig.json`, `packages/try-on-core/src/index.ts`, `packages/try-on-core/src/types.ts`

- [ ] **Step 1: Write `package.json`**

Create `packages/try-on-core/package.json` (mirrors `packages/money` — builds to `dist`, CommonJS, no `type:module`):

```json
{
  "name": "@goldsmith/try-on-core",
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
    "test": "vitest run",
    "test:unit": "vitest run",
    "lint": "eslint src"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` + `tsconfig.build.json`**

Create `packages/try-on-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"]
}
```

Create `packages/try-on-core/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.spec.ts"]
}
```

- [ ] **Step 3: Write the shared types**

Create `packages/try-on-core/src/types.ts`:

```typescript
/** Normalized landmark from MediaPipe: x,y in [0,1] of the image, z relative depth. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** A 2D point in normalized image space [0,1]. */
export interface Vec2 {
  x: number;
  y: number;
}

export type BodyPart = 'EAR' | 'NECK' | 'FINGER' | 'WRIST';

/** Which physical dimension drives on-screen size for a given body part. */
export interface DimensionsMm {
  lengthMm?: number;
  widthMm?: number;
  diameterMm?: number;
}

/** Output of the fit pipeline for one rendered frame, in normalized image space. */
export interface FitResult {
  /** Where the asset anchor point should land, normalized [0,1]. */
  anchor: Vec2;
  /** On-screen width of the asset in normalized image units. */
  widthNorm: number;
  /** In-plane rotation in radians (head roll / finger axis). */
  rotationRad: number;
  /** True when size came from real mm dimensions; false = weight-derived estimate. */
  trueToSize: boolean;
}
```

- [ ] **Step 4: Write the barrel**

Create `packages/try-on-core/src/index.ts`:

```typescript
export * from './types';
```

- [ ] **Step 5: Add the package to the workspace + verify it resolves**

Run:
```
pnpm install
pnpm --filter @goldsmith/try-on-core typecheck
```
Expected: install succeeds, typecheck PASS.

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/package.json packages/try-on-core/tsconfig.json packages/try-on-core/src/index.ts packages/try-on-core/src/types.ts
git commit -m "feat(try-on-core): package skeleton + shared types"
```

---

### Task 4: One-Euro filter (jitter smoothing)

**Files:**
- Create: `packages/try-on-core/src/one-euro-filter.ts`
- Test: `packages/try-on-core/src/one-euro-filter.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/try-on-core/src/one-euro-filter.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from './one-euro-filter';

describe('OneEuroFilter', () => {
  it('returns the first sample unchanged', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.0, dCutoff: 1.0 });
    expect(f.filter(10, 0)).toBeCloseTo(10, 5);
  });

  it('smooths a noisy-but-stationary signal toward its mean', () => {
    const f = new OneEuroFilter({ minCutoff: 0.5, beta: 0.0, dCutoff: 1.0 });
    const noisy = [100, 102, 98, 101, 99, 100.5, 99.5];
    let out = 0;
    noisy.forEach((v, i) => { out = f.filter(v, i / 30); }); // 30 fps timestamps
    // Output should sit near the ~100 mean, not chase the last raw value's swing.
    expect(out).toBeGreaterThan(99);
    expect(out).toBeLessThan(101);
  });

  it('tracks a fast ramp without large lag (adaptive cutoff)', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.5, dCutoff: 1.0 });
    let out = 0;
    for (let i = 0; i < 10; i++) out = f.filter(i * 10, i / 30); // ramp 0,10,20,...
    // Last raw is 90; with speed-adaptive cutoff the output should be close.
    expect(out).toBeGreaterThan(80);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- one-euro-filter
```
Expected: FAIL — `Cannot find module './one-euro-filter'`.

- [ ] **Step 3: Implement the filter**

Create `packages/try-on-core/src/one-euro-filter.ts`:

```typescript
export interface OneEuroOptions {
  /** Lower = more smoothing when still. Typical start 1.0. */
  minCutoff: number;
  /** Higher = less lag when moving fast. Typical start 0.0, raise to taste. */
  beta: number;
  /** Cutoff for the derivative. Typical 1.0. */
  dCutoff: number;
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/**
 * Casiez et al. One Euro Filter. Adaptive low-pass: heavy smoothing when the
 * signal is stationary (kills jitter), light smoothing when it moves fast
 * (no rubber-banding). Preferred over plain EMA which forces one tradeoff.
 */
export class OneEuroFilter {
  private readonly opts: OneEuroOptions;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(opts: OneEuroOptions) {
    this.opts = opts;
  }

  filter(x: number, t: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }
    const dt = Math.max(t - this.tPrev, 1e-6);

    const dx = (x - this.xPrev) / dt;
    const aD = alpha(this.opts.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.opts.minCutoff + this.opts.beta * Math.abs(dxHat);
    const a = alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;
    return xHat;
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}
```

- [ ] **Step 4: Export it**

Append to `packages/try-on-core/src/index.ts`:
```typescript
export * from './one-euro-filter';
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- one-euro-filter
```
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/src/one-euro-filter.ts packages/try-on-core/src/one-euro-filter.spec.ts packages/try-on-core/src/index.ts
git commit -m "feat(try-on-core): One Euro adaptive smoothing filter"
```

---

### Task 5: Metric scale — `mmPerPixelFace` / `mmPerPixelHand`

**Files:**
- Create: `packages/try-on-core/src/scale.ts`
- Test: `packages/try-on-core/src/scale.spec.ts`

Note: this returns **px-per-mm in normalized-x units** (caller multiplies by frame pixel width to get device px). Keeping it normalized makes the math resolution-independent.

- [ ] **Step 1: Write the failing test**

Create `packages/try-on-core/src/scale.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normPerMmFace, normPerMmHand, DEFAULT_IPD_MM } from './scale';
import type { Landmark } from './types';

const L = (x: number, y: number, z = 0): Landmark => ({ x, y, z });

describe('normPerMmFace', () => {
  it('derives normalized-units-per-mm from the iris-centre distance and IPD', () => {
    // Two iris centres 0.2 normalized-x apart, default IPD 63mm.
    const leftIris = L(0.4, 0.5);
    const rightIris = L(0.6, 0.5);
    const npm = normPerMmFace(leftIris, rightIris, DEFAULT_IPD_MM);
    // 0.2 norm over 63 mm => ~0.003175 norm/mm
    expect(npm).toBeCloseTo(0.2 / 63, 6);
  });

  it('uses a custom IPD when provided (calibration)', () => {
    const npm = normPerMmFace(L(0.4, 0.5), L(0.6, 0.5), 70);
    expect(npm).toBeCloseTo(0.2 / 70, 6);
  });

  it('accounts for vertical separation (euclidean, not just dx)', () => {
    const npm = normPerMmFace(L(0.4, 0.5), L(0.6, 0.6), 63);
    const dist = Math.hypot(0.2, 0.1);
    expect(npm).toBeCloseTo(dist / 63, 6);
  });
});

describe('normPerMmHand', () => {
  it('derives scale from finger-segment width and an assumed finger width', () => {
    // Two finger-edge points 0.05 norm apart, finger width 9mm.
    const npm = normPerMmHand(L(0.5, 0.5), L(0.55, 0.5), 9);
    expect(npm).toBeCloseTo(0.05 / 9, 6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- scale
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/try-on-core/src/scale.ts`:

```typescript
import type { Landmark } from './types';

/** Average adult inter-pupillary distance in millimetres. */
export const DEFAULT_IPD_MM = 63;

/** Average finger width (mm) at the ring-band location, used as the hand reference. */
export const DEFAULT_FINGER_WIDTH_MM = 9;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Normalized-image-units per millimetre, from the two iris centres and a known
 * inter-pupillary distance. Multiply a mm length by this to get its size in
 * normalized image units; multiply that by frame pixel width for device px.
 * IPD varies ~54-74mm, so the 63mm default carries up to ~15% error — pass a
 * user-supplied PD (or card-calibrated value) to tighten it.
 */
export function normPerMmFace(
  leftIris: Landmark,
  rightIris: Landmark,
  ipdMm: number = DEFAULT_IPD_MM,
): number {
  return dist(leftIris, rightIris) / ipdMm;
}

/**
 * Normalized-image-units per millimetre for the hand, from a measured finger
 * width in normalized units and an assumed real finger width in mm.
 */
export function normPerMmHand(
  edgeA: Landmark,
  edgeB: Landmark,
  fingerWidthMm: number = DEFAULT_FINGER_WIDTH_MM,
): number {
  return dist(edgeA, edgeB) / fingerWidthMm;
}
```

- [ ] **Step 4: Export it**

Append to `packages/try-on-core/src/index.ts`:
```typescript
export * from './scale';
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- scale
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/src/scale.ts packages/try-on-core/src/scale.spec.ts packages/try-on-core/src/index.ts
git commit -m "feat(try-on-core): metric scale from IPD (face) and finger width (hand)"
```

---

### Task 6: `anchorFor` — per-body-part anchor point

**Files:**
- Create: `packages/try-on-core/src/anchor.ts`
- Test: `packages/try-on-core/src/anchor.spec.ts`

Landmark-index constants are community-mapped (face mesh has no official earlobe/neck vertex); they are isolated as named constants so they can be retuned against an on-face debug overlay without touching the math.

- [ ] **Step 1: Write the failing test**

Create `packages/try-on-core/src/anchor.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { anchorFor, FACE_INDEX, HAND_INDEX } from './anchor';
import type { Landmark } from './types';

// Build a face-landmark array where every index defaults to (0.5,0.5) and we
// override only the ones the anchor math reads.
function faceLandmarks(overrides: Record<number, [number, number]>): Landmark[] {
  const arr: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) arr[Number(i)] = { x, y, z: 0 };
  return arr;
}

function handLandmarks(overrides: Record<number, [number, number]>): Landmark[] {
  const arr: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) arr[Number(i)] = { x, y, z: 0 };
  return arr;
}

describe('anchorFor EAR', () => {
  it('places the earring below the ear-region landmark by a fraction of face height', () => {
    const lm = faceLandmarks({
      [FACE_INDEX.chin]: [0.5, 0.9],
      [FACE_INDEX.foreheadTop]: [0.5, 0.1],
      [FACE_INDEX.leftEar]: [0.35, 0.5],
    });
    const a = anchorFor('EAR', lm, { side: 'left' });
    expect(a.x).toBeCloseTo(0.35, 3);
    // face height = 0.8; lobe drop = LOBE_DROP_FRACTION * 0.8 below the ear y.
    expect(a.y).toBeGreaterThan(0.5);
  });
});

describe('anchorFor NECK', () => {
  it('projects below the chin toward the sternal notch', () => {
    const lm = faceLandmarks({
      [FACE_INDEX.chin]: [0.5, 0.8],
      [FACE_INDEX.foreheadTop]: [0.5, 0.2],
    });
    const a = anchorFor('NECK', lm, {});
    expect(a.x).toBeCloseTo(0.5, 3);
    expect(a.y).toBeGreaterThan(0.8); // below the chin
  });
});

describe('anchorFor FINGER', () => {
  it('is the midpoint of the ring-finger base and PIP joints', () => {
    const lm = handLandmarks({
      [HAND_INDEX.ringMcp]: [0.40, 0.50],
      [HAND_INDEX.ringPip]: [0.50, 0.40],
    });
    const a = anchorFor('FINGER', lm, {});
    expect(a.x).toBeCloseTo(0.45, 3);
    expect(a.y).toBeCloseTo(0.45, 3);
  });
});

describe('anchorFor WRIST', () => {
  it('is the wrist landmark', () => {
    const lm = handLandmarks({ [HAND_INDEX.wrist]: [0.5, 0.7] });
    const a = anchorFor('WRIST', lm, {});
    expect(a.x).toBeCloseTo(0.5, 3);
    expect(a.y).toBeCloseTo(0.7, 3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- anchor
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/try-on-core/src/anchor.ts`:

```typescript
import type { Landmark, Vec2, BodyPart } from './types';

/**
 * Community-mapped MediaPipe face-mesh indices. The mesh has NO official
 * earlobe or neck vertex, so EAR/NECK anchors are extrapolated. Retune these
 * against an on-face debug overlay before shipping; isolated here on purpose.
 */
export const FACE_INDEX = {
  chin: 152,
  foreheadTop: 10,
  leftEar: 234,
  rightEar: 454,
} as const;

/** Official MediaPipe Hands 21-point indices. */
export const HAND_INDEX = {
  wrist: 0,
  ringMcp: 13,
  ringPip: 14,
} as const;

/** Earring drop below the ear point, as a fraction of face height. */
export const LOBE_DROP_FRACTION = 0.06;
/** Necklace drop below the chin, as a fraction of face height. */
export const NECK_DROP_FRACTION = 0.35;

export interface AnchorOptions {
  side?: 'left' | 'right';
}

function faceHeight(lm: Landmark[]): number {
  return Math.abs(lm[FACE_INDEX.chin].y - lm[FACE_INDEX.foreheadTop].y);
}

export function anchorFor(part: BodyPart, lm: Landmark[], opts: AnchorOptions): Vec2 {
  switch (part) {
    case 'EAR': {
      const ear = opts.side === 'right' ? lm[FACE_INDEX.rightEar] : lm[FACE_INDEX.leftEar];
      return { x: ear.x, y: ear.y + LOBE_DROP_FRACTION * faceHeight(lm) };
    }
    case 'NECK': {
      const chin = lm[FACE_INDEX.chin];
      return { x: chin.x, y: chin.y + NECK_DROP_FRACTION * faceHeight(lm) };
    }
    case 'FINGER': {
      const a = lm[HAND_INDEX.ringMcp];
      const b = lm[HAND_INDEX.ringPip];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    case 'WRIST': {
      const w = lm[HAND_INDEX.wrist];
      return { x: w.x, y: w.y };
    }
  }
}
```

- [ ] **Step 4: Export it**

Append to `packages/try-on-core/src/index.ts`:
```typescript
export * from './anchor';
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- anchor
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/src/anchor.ts packages/try-on-core/src/anchor.spec.ts packages/try-on-core/src/index.ts
git commit -m "feat(try-on-core): per-body-part anchor computation"
```

---

### Task 7: `sizePx` — true-to-size with flagged weight fallback

**Files:**
- Create: `packages/try-on-core/src/size.ts`
- Test: `packages/try-on-core/src/size.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/try-on-core/src/size.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveAssetWidthNorm, estimateDiameterMmFromWeight } from './size';

describe('resolveAssetWidthNorm', () => {
  it('uses real mm dimension when present (true-to-size)', () => {
    // 20mm wide piece, scale 0.003 norm/mm => 0.06 norm wide.
    const r = resolveAssetWidthNorm(
      { dimensions: { widthMm: 20 }, metal: 'GOLD', purity: '22K', netWeightG: 5 },
      0.003,
      'EAR',
    );
    expect(r.widthNorm).toBeCloseTo(0.06, 6);
    expect(r.trueToSize).toBe(true);
  });

  it('falls back to a weight estimate and flags it not-true-to-size', () => {
    const r = resolveAssetWidthNorm(
      { dimensions: {}, metal: 'GOLD', purity: '22K', netWeightG: 5 },
      0.003,
      'FINGER',
    );
    expect(r.trueToSize).toBe(false);
    expect(r.widthNorm).toBeGreaterThan(0);
  });

  it('prefers diameterMm for FINGER/WRIST', () => {
    const r = resolveAssetWidthNorm(
      { dimensions: { diameterMm: 18 }, metal: 'GOLD', purity: '22K', netWeightG: 4 },
      0.003,
      'FINGER',
    );
    expect(r.widthNorm).toBeCloseTo(18 * 0.003, 6);
    expect(r.trueToSize).toBe(true);
  });
});

describe('estimateDiameterMmFromWeight', () => {
  it('returns a positive coarse estimate scaled by metal density', () => {
    const d22 = estimateDiameterMmFromWeight(5, 'GOLD', '22K');
    const d24 = estimateDiameterMmFromWeight(5, 'GOLD', '24K');
    expect(d22).toBeGreaterThan(0);
    // Denser metal (24K) => slightly smaller volume for same mass.
    expect(d24).toBeLessThan(d22);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- size
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/try-on-core/src/size.ts`:

```typescript
import type { BodyPart, DimensionsMm } from './types';

/** Approximate metal densities (g/cm^3) for the weight→volume fallback only. */
const DENSITY_G_PER_CM3: Record<string, number> = {
  'GOLD_24K': 19.32,
  'GOLD_22K': 17.7,
  'GOLD_18K': 15.4,
  'SILVER_999': 10.49,
  'PLATINUM': 21.45,
};

function densityFor(metal: string, purity: string): number {
  const key = `${metal}_${purity}`.toUpperCase();
  if (DENSITY_G_PER_CM3[key]) return DENSITY_G_PER_CM3[key];
  if (metal.toUpperCase() === 'GOLD') return DENSITY_G_PER_CM3['GOLD_22K'];
  if (metal.toUpperCase() === 'SILVER') return DENSITY_G_PER_CM3['SILVER_999'];
  if (metal.toUpperCase() === 'PLATINUM') return DENSITY_G_PER_CM3['PLATINUM'];
  return DENSITY_G_PER_CM3['GOLD_22K'];
}

export interface ProductSizeInput {
  dimensions: DimensionsMm;
  metal: string;
  purity: string;
  netWeightG: number;
}

export interface SizeResult {
  widthNorm: number;
  trueToSize: boolean;
}

/**
 * COARSE fallback only. weight -> volume (mass/density) is well defined, but
 * volume -> shape is not, so we assume a sphere and take its diameter. This is
 * a size-band estimate, never true-to-size — callers must surface that.
 */
export function estimateDiameterMmFromWeight(
  netWeightG: number,
  metal: string,
  purity: string,
): number {
  const density = densityFor(metal, purity); // g/cm^3
  const volumeCm3 = netWeightG / density;
  const radiusCm = Math.cbrt((3 * volumeCm3) / (4 * Math.PI));
  return radiusCm * 2 * 10; // cm diameter -> mm
}

/**
 * Resolve the on-screen asset width in normalized image units. Prefers real mm
 * dimensions (true-to-size); falls back to a weight estimate flagged false.
 */
export function resolveAssetWidthNorm(
  input: ProductSizeInput,
  normPerMm: number,
  part: BodyPart,
): SizeResult {
  const d = input.dimensions;
  const preferDiameter = part === 'FINGER' || part === 'WRIST';

  const mm = preferDiameter
    ? d.diameterMm ?? d.widthMm ?? d.lengthMm
    : d.widthMm ?? d.lengthMm ?? d.diameterMm;

  if (mm && mm > 0) {
    return { widthNorm: mm * normPerMm, trueToSize: true };
  }

  const estMm = estimateDiameterMmFromWeight(input.netWeightG, input.metal, input.purity);
  return { widthNorm: estMm * normPerMm, trueToSize: false };
}
```

- [ ] **Step 4: Export it**

Append to `packages/try-on-core/src/index.ts`:
```typescript
export * from './size';
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- size
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/src/size.ts packages/try-on-core/src/size.spec.ts packages/try-on-core/src/index.ts
git commit -m "feat(try-on-core): true-to-size resolver + flagged weight fallback"
```

---

### Task 8: `decomposePose` — roll/pitch/yaw from the 4×4 matrix

**Files:**
- Create: `packages/try-on-core/src/pose.ts`
- Test: `packages/try-on-core/src/pose.spec.ts`

MediaPipe's `facialTransformationMatrixes` are **column-major** 16-float arrays. The decomposition reads the rotation block accordingly.

- [ ] **Step 1: Write the failing test**

Create `packages/try-on-core/src/pose.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { decomposePose } from './pose';

// Column-major 4x4. Identity => zero rotation.
const IDENTITY = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

// Column-major rotation about Z (screen roll) by +30deg.
function rotZ(deg: number): number[] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  // columns: [c,s,0,0],[-s,c,0,0],[0,0,1,0],[0,0,0,1]
  return [
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

describe('decomposePose', () => {
  it('returns ~zero angles for identity', () => {
    const p = decomposePose(IDENTITY);
    expect(p.rollRad).toBeCloseTo(0, 5);
    expect(p.pitchRad).toBeCloseTo(0, 5);
    expect(p.yawRad).toBeCloseTo(0, 5);
  });

  it('extracts roll from a Z rotation', () => {
    const p = decomposePose(rotZ(30));
    expect((p.rollRad * 180) / Math.PI).toBeCloseTo(30, 1);
  });

  it('throws on a non-16-length matrix', () => {
    expect(() => decomposePose([1, 2, 3])).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- pose
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/try-on-core/src/pose.ts`:

```typescript
export interface PoseAngles {
  rollRad: number;  // in-plane (screen) rotation — drives earring/necklace tilt
  pitchRad: number; // nodding
  yawRad: number;   // turning left/right — used to hide the far-side earring
}

/**
 * Decompose a MediaPipe facial transformation matrix (column-major, 16 floats)
 * into Euler angles. Reads the 3x3 rotation block:
 *   m[col*4 + row]. r00=m[0], r10=m[1], r20=m[2], r01=m[4], r11=m[5], r21=m[6],
 *   r02=m[8], r12=m[9], r22=m[10].
 */
export function decomposePose(m: number[]): PoseAngles {
  if (m.length !== 16) {
    throw new Error(`decomposePose expects a 16-length matrix, got ${m.length}`);
  }
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];

  const yawRad = Math.atan2(-r20, Math.hypot(r21, r22));
  const pitchRad = Math.atan2(r21, r22);
  const rollRad = Math.atan2(r10, r00);

  return { rollRad, pitchRad, yawRad };
}
```

- [ ] **Step 4: Export it**

Append to `packages/try-on-core/src/index.ts`:
```typescript
export * from './pose';
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- pose
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/src/pose.ts packages/try-on-core/src/pose.spec.ts packages/try-on-core/src/index.ts
git commit -m "feat(try-on-core): pose decomposition from facial transform matrix"
```

---

### Task 9: Mirror / handedness correction

**Files:**
- Create: `packages/try-on-core/src/mirror.ts`
- Test: `packages/try-on-core/src/mirror.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/try-on-core/src/mirror.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveEarSide, mirrorXIfNeeded } from './mirror';

describe('mirrorXIfNeeded', () => {
  it('flips x around 0.5 when the feed is mirrored', () => {
    expect(mirrorXIfNeeded(0.3, true)).toBeCloseTo(0.7, 6);
  });
  it('leaves x unchanged when not mirrored', () => {
    expect(mirrorXIfNeeded(0.3, false)).toBeCloseTo(0.3, 6);
  });
});

describe('resolveEarSide', () => {
  it('swaps left/right when the front camera is mirrored', () => {
    expect(resolveEarSide('left', true)).toBe('right');
    expect(resolveEarSide('left', false)).toBe('left');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- mirror
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/try-on-core/src/mirror.ts`:

```typescript
/**
 * Front (selfie) cameras present a mirrored feed. MediaPipe reports landmarks
 * in the image-as-captured frame, so any side logic must be flipped to match
 * what the user sees, or earrings/rings land on the wrong side.
 */
export function mirrorXIfNeeded(x: number, mirrored: boolean): number {
  return mirrored ? 1 - x : x;
}

export function resolveEarSide(
  side: 'left' | 'right',
  mirrored: boolean,
): 'left' | 'right' {
  if (!mirrored) return side;
  return side === 'left' ? 'right' : 'left';
}
```

- [ ] **Step 4: Export it**

Append to `packages/try-on-core/src/index.ts`:
```typescript
export * from './mirror';
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- mirror
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/src/mirror.ts packages/try-on-core/src/mirror.spec.ts packages/try-on-core/src/index.ts
git commit -m "feat(try-on-core): front-camera mirror + handedness correction"
```

---

### Task 10: Metric reference tables (ring / bangle / chain)

**Files:**
- Create: `packages/try-on-core/src/metric-tables.ts`
- Test: `packages/try-on-core/src/metric-tables.spec.ts`

Values are ported from `apps/customer-mobile/app/browse/size-guide.tsx` (the authoritative in-app tables) so the fit-check and the size guide never diverge.

- [ ] **Step 1: Write the failing test**

Create `packages/try-on-core/src/metric-tables.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  RING_DIAMETER_MM,
  BANGLE_DIAMETER_MM,
  ringDiameterForIndianSize,
  nearestBangleSize,
} from './metric-tables';

describe('ring tables', () => {
  it('has Indian sizes 1..20', () => {
    expect(RING_DIAMETER_MM[1]).toBeCloseTo(12.1, 2);
    expect(RING_DIAMETER_MM[20]).toBeCloseTo(20.2, 2);
  });
  it('looks up diameter by Indian ring size', () => {
    expect(ringDiameterForIndianSize(10)).toBeCloseTo(16.0, 2);
  });
});

describe('bangle tables', () => {
  it('maps standard labels to inner diameters (mm)', () => {
    expect(BANGLE_DIAMETER_MM['M']).toBe(58);
  });
  it('finds the nearest bangle size for a measured wrist diameter', () => {
    expect(nearestBangleSize(57)).toBe('S'); // 56mm is closest to 57
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
pnpm --filter @goldsmith/try-on-core test -- metric-tables
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/try-on-core/src/metric-tables.ts`:

```typescript
/**
 * Indian ring sizes 1..20 -> inner diameter (mm). Ported verbatim from
 * apps/customer-mobile/app/browse/size-guide.tsx (diaM column). Keep in sync.
 */
export const RING_DIAMETER_MM: Record<number, number> = {
  1: 12.1, 2: 12.6, 3: 13.0, 4: 13.4, 5: 13.8, 6: 14.3, 7: 14.7, 8: 15.1,
  9: 15.6, 10: 16.0, 11: 16.4, 12: 16.8, 13: 17.3, 14: 17.7, 15: 18.1,
  16: 18.5, 17: 19.0, 18: 19.4, 19: 19.8, 20: 20.2,
};

/** Bangle label -> inner diameter (mm). Ported from size-guide.tsx. */
export const BANGLE_DIAMETER_MM: Record<string, number> = {
  XS: 54, S: 56, M: 58, L: 60, XL: 62, XXL: 64,
};

export function ringDiameterForIndianSize(size: number): number | undefined {
  return RING_DIAMETER_MM[size];
}

export function nearestBangleSize(diameterMm: number): string {
  let best = '';
  let bestDelta = Infinity;
  for (const [label, dia] of Object.entries(BANGLE_DIAMETER_MM)) {
    const delta = Math.abs(dia - diameterMm);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = label;
    }
  }
  return best;
}
```

- [ ] **Step 4: Export it**

Append to `packages/try-on-core/src/index.ts`:
```typescript
export * from './metric-tables';
```

- [ ] **Step 5: Run the test to verify it passes + run the whole package suite**

Run:
```
pnpm --filter @goldsmith/try-on-core test
```
Expected: PASS — all spec files green.

- [ ] **Step 6: Commit**

```
git add packages/try-on-core/src/metric-tables.ts packages/try-on-core/src/metric-tables.spec.ts packages/try-on-core/src/index.ts
git commit -m "feat(try-on-core): ring/bangle metric reference tables"
```

---

## WS-C — Catalog API & Background-Removal Worker

### Task 11: `@goldsmith/integrations-bg-removal` — types, error, Stub adapter

**Files:**
- Create: `packages/integrations/bg-removal/package.json`, `tsconfig.json`
- Create: `packages/integrations/bg-removal/src/{index,types,errors,factory}.ts`
- Create: `packages/integrations/bg-removal/src/adapters/stub.adapter.ts`
- Test: `packages/integrations/bg-removal/src/adapters/stub.adapter.spec.ts`

- [ ] **Step 1: Write `package.json` + tsconfigs**

Create `packages/integrations/bg-removal/package.json` (mirrors `packages/integrations/storage` — builds to `dist`, CommonJS):

```json
{
  "name": "@goldsmith/integrations-bg-removal",
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
    "test": "vitest run",
    "lint": "eslint src"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "typescript": "^5.4.0"
  }
}
```

Create `packages/integrations/bg-removal/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "include": ["src/**/*"]
}
```

Create `packages/integrations/bg-removal/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.spec.ts"]
}
```

(Note the `../../../` — three levels up. Confirm against `packages/integrations/storage/tsconfig.json`.)

- [ ] **Step 2: Write the types + error**

Create `packages/integrations/bg-removal/src/types.ts`:

```typescript
export interface RemoveBackgroundInput {
  /** Raw source image bytes (jpeg/png). */
  image: Buffer;
  /** Hint to pick a model: 'fine' uses BiRefNet for thin chains/filigree. */
  quality?: 'standard' | 'fine';
}

export interface RemoveBackgroundResult {
  /** Transparent PNG bytes. */
  png: Buffer;
  /** Tight alpha bounding box in pixels, for anchor auto-proposal. */
  bbox: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
}

export interface BgRemovalAdapter {
  removeBackground(input: RemoveBackgroundInput): Promise<RemoveBackgroundResult>;
}
```

Create `packages/integrations/bg-removal/src/errors.ts`:

```typescript
export class BgRemovalUnavailableError extends Error {
  constructor(message = 'Background-removal adapter is not available') {
    super(message);
    this.name = 'BgRemovalUnavailableError';
  }
}
```

- [ ] **Step 3: Write the failing Stub test**

Create `packages/integrations/bg-removal/src/adapters/stub.adapter.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { StubBgRemovalAdapter } from './stub.adapter';
import { BgRemovalUnavailableError } from '../errors';

describe('StubBgRemovalAdapter', () => {
  it('throws BgRemovalUnavailableError', async () => {
    const a = new StubBgRemovalAdapter();
    await expect(
      a.removeBackground({ image: Buffer.from('') }),
    ).rejects.toBeInstanceOf(BgRemovalUnavailableError);
  });
});
```

- [ ] **Step 4: Run it to verify failure**

Run:
```
pnpm --filter @goldsmith/integrations-bg-removal test
```
Expected: FAIL — `StubBgRemovalAdapter` not found.

- [ ] **Step 5: Implement the Stub + factory + barrel**

Create `packages/integrations/bg-removal/src/adapters/stub.adapter.ts`:

```typescript
import type { BgRemovalAdapter, RemoveBackgroundInput, RemoveBackgroundResult } from '../types';
import { BgRemovalUnavailableError } from '../errors';

export class StubBgRemovalAdapter implements BgRemovalAdapter {
  async removeBackground(_input: RemoveBackgroundInput): Promise<RemoveBackgroundResult> {
    throw new BgRemovalUnavailableError(
      'StubBgRemovalAdapter called — set BG_REMOVAL_ADAPTER=rembg to enable real cutouts',
    );
  }
}
```

Create `packages/integrations/bg-removal/src/factory.ts` (rembg branch wired in Task 12):

```typescript
import type { BgRemovalAdapter } from './types';
import { StubBgRemovalAdapter } from './adapters/stub.adapter';

export function getBgRemovalAdapter(): BgRemovalAdapter {
  const which = process.env['BG_REMOVAL_ADAPTER'] ?? 'stub';
  switch (which) {
    // 'rembg' case added in Task 12.
    case 'stub':
    default:
      return new StubBgRemovalAdapter();
  }
}
```

Create `packages/integrations/bg-removal/src/index.ts`:

```typescript
export * from './types';
export * from './errors';
export * from './factory';
export { StubBgRemovalAdapter } from './adapters/stub.adapter';
```

- [ ] **Step 6: Run the test + typecheck**

Run:
```
pnpm install
pnpm --filter @goldsmith/integrations-bg-removal test
pnpm --filter @goldsmith/integrations-bg-removal typecheck
```
Expected: PASS + clean typecheck.

- [ ] **Step 7: Commit**

```
git add packages/integrations/bg-removal
git commit -m "feat(bg-removal): adapter interface + Stub (throws BgRemovalUnavailableError)"
```

---

### Task 12: rembg adapter (self-hosted subprocess)

**Files:**
- Create: `packages/integrations/bg-removal/src/adapters/rembg.adapter.ts`
- Modify: `packages/integrations/bg-removal/src/factory.ts`
- Modify: `packages/integrations/bg-removal/src/index.ts`

The adapter shells out to the `rembg` CLI (Python, MIT) using `isnet-general-use` by default and `birefnet-general` for `quality:'fine'`. It computes the alpha bbox with the already-present `sharp` (used in the image pipeline). **Never** use ImageKit AI bg-removal (paid) or briaai RMBG weights (non-commercial).

- [ ] **Step 1: Add `sharp` as a dependency**

In `packages/integrations/bg-removal/package.json`, add to a new `dependencies` block:

```json
  "dependencies": {
    "sharp": "^0.34.5"
  },
```

Run `pnpm install`.

- [ ] **Step 2: Implement the adapter**

Create `packages/integrations/bg-removal/src/adapters/rembg.adapter.ts`:

```typescript
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import type { BgRemovalAdapter, RemoveBackgroundInput, RemoveBackgroundResult } from '../types';
import { BgRemovalUnavailableError } from '../errors';

/**
 * Self-hosted rembg adapter. Requires the `rembg` Python CLI on PATH with the
 * model weights pre-baked into the worker image. Free/MIT. Model:
 *   - standard -> isnet-general-use
 *   - fine     -> birefnet-general (thin chains, filigree)
 */
export class RembgAdapter implements BgRemovalAdapter {
  private readonly cmd = process.env['REMBG_CMD'] ?? 'rembg';

  async removeBackground(input: RemoveBackgroundInput): Promise<RemoveBackgroundResult> {
    const model = input.quality === 'fine' ? 'birefnet-general' : 'isnet-general-use';
    const png = await this.runRembg(input.image, model);

    const meta = await sharp(png).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    // Tight alpha bounding box via sharp's trim (returns trimOffset).
    const trimmed = await sharp(png).trim().toBuffer({ resolveWithObject: true });
    const info = trimmed.info as unknown as {
      trimOffsetLeft?: number;
      trimOffsetTop?: number;
      width: number;
      height: number;
    };
    const bbox = {
      x: Math.abs(info.trimOffsetLeft ?? 0),
      y: Math.abs(info.trimOffsetTop ?? 0),
      width: info.width,
      height: info.height,
    };

    return { png, bbox, width, height };
  }

  private runRembg(image: Buffer, model: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.cmd, ['i', '-m', model], { stdio: ['pipe', 'pipe', 'pipe'] });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      proc.stdout.on('data', (d: Buffer) => out.push(d));
      proc.stderr.on('data', (d: Buffer) => err.push(d));
      proc.on('error', (e) =>
        reject(new BgRemovalUnavailableError(`rembg spawn failed: ${e.message}`)),
      );
      proc.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(out));
        else reject(new BgRemovalUnavailableError(`rembg exited ${code}: ${Buffer.concat(err).toString()}`));
      });
      proc.stdin.write(image);
      proc.stdin.end();
    });
  }
}
```

- [ ] **Step 3: Wire the factory + barrel**

In `packages/integrations/bg-removal/src/factory.ts`, add the import and case:

```typescript
import { RembgAdapter } from './adapters/rembg.adapter';
```
```typescript
    case 'rembg':
      return new RembgAdapter();
```

In `packages/integrations/bg-removal/src/index.ts`, add:

```typescript
export { RembgAdapter } from './adapters/rembg.adapter';
```

- [ ] **Step 4: Typecheck**

Run:
```
pnpm --filter @goldsmith/integrations-bg-removal typecheck
```
Expected: PASS. (No unit test for the subprocess path — it's an external-process boundary; it's exercised by the worker smoke test in Task 14 and is the documented manual-verification surface.)

- [ ] **Step 5: Commit**

```
git add packages/integrations/bg-removal
git commit -m "feat(bg-removal): rembg subprocess adapter (isnet/birefnet) + factory wiring"
```

---

### Task 13: Inventory write API — mm dimensions + body_part (Zod)

**Files:**
- Modify: `packages/shared/src/schemas/product.schema.ts` (Zod DTOs — this is where product validation lives, NOT class-validator)
- Modify: `apps/api/src/modules/inventory/inventory.repository.ts` (the INSERT/UPDATE SQL builder)
- Modify: `apps/api/src/modules/inventory/inventory.service.ts` (upsert the try-on asset row when `bodyPart` set)
- Test: `packages/shared/src/schemas/product.schema.spec.ts` (extend; create if absent) + `apps/api/src/modules/inventory/inventory.service.spec.ts`

Before editing, confirm the exact repo/service method names and the INSERT builder in `inventory.repository.ts` (the service delegates persistence to the repo, per Task-2 exploration). Field naming convention: **camelCase in Zod/DTO** (`tryOnLengthMm`), **snake_case in SQL** (`try_on_length_mm`), matching `grossWeightG` → `gross_weight_g`.

- [ ] **Step 1: Write the failing Zod test**

In `packages/shared/src/schemas/product.schema.spec.ts` (mirror the file's existing test style; create it if missing):

```typescript
import { describe, it, expect } from 'vitest';
import { CreateProductSchema } from './product.schema';

describe('CreateProductSchema try-on fields', () => {
  it('accepts optional mm dimensions and a try-on body part', () => {
    const parsed = CreateProductSchema.parse({
      sku: 'RING-1', metal: 'GOLD', purity: '22K',
      grossWeightG: '5.0000', netWeightG: '4.5000',
      tryOnLengthMm: '24.50', tryOnBodyPart: 'FINGER',
    });
    expect(parsed.tryOnLengthMm).toBe('24.50');
    expect(parsed.tryOnBodyPart).toBe('FINGER');
  });

  it('rejects an invalid body part', () => {
    expect(() =>
      CreateProductSchema.parse({
        sku: 'RING-2', metal: 'GOLD', purity: '22K',
        grossWeightG: '5.0000', netWeightG: '4.5000',
        tryOnBodyPart: 'FOOT',
      }),
    ).toThrow();
  });

  it('omits try-on fields cleanly when not provided', () => {
    const parsed = CreateProductSchema.parse({
      sku: 'RING-3', metal: 'GOLD', purity: '22K',
      grossWeightG: '5.0000', netWeightG: '4.5000',
    });
    expect(parsed.tryOnLengthMm).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run:
```
pnpm --filter @goldsmith/shared test -- product.schema
```
Expected: FAIL — `tryOnLengthMm` not on the parsed type / body-part not validated.

- [ ] **Step 3: Add the fields to the Zod schema**

In `packages/shared/src/schemas/product.schema.ts`, add to `ProductBaseSchema` (reuse the existing `z` import; mm strings allow up to 2 decimals):

```typescript
  tryOnLengthMm:   z.string().regex(/^\d+(\.\d{1,2})?$/, 'MM_FORMAT_INVALID').optional(),
  tryOnWidthMm:    z.string().regex(/^\d+(\.\d{1,2})?$/, 'MM_FORMAT_INVALID').optional(),
  tryOnDiameterMm: z.string().regex(/^\d+(\.\d{1,2})?$/, 'MM_FORMAT_INVALID').optional(),
  tryOnBodyPart:   z.enum(['EAR', 'NECK', 'FINGER', 'WRIST']).optional(),
```

`UpdateProductSchema` already derives from `ProductBaseSchema.partial()`, so it picks these up automatically.

- [ ] **Step 4: Run the Zod test to verify it passes**

Run:
```
pnpm --filter @goldsmith/shared test -- product.schema
```
Expected: PASS.

- [ ] **Step 5: Persist mm columns in the repository**

In `apps/api/src/modules/inventory/inventory.repository.ts`, in the product **create** INSERT, add `try_on_length_mm, try_on_width_mm, try_on_diameter_mm` to the column list and bind `dto.tryOnLengthMm ?? null` (etc.) as parameters. In the **update** builder, add the same three to the dynamic SET list (only when the key is present, following the existing partial-update pattern).

- [ ] **Step 6: Upsert the try-on asset row in the service**

In `apps/api/src/modules/inventory/inventory.service.ts`, after the product create/update succeeds, when `dto.tryOnBodyPart` is set, upsert the asset row inside the tenant tx (RLS active). Use the established `withTenantTx` helper, NOT a hand-set GUC:

```typescript
import { withTenantTx } from '@goldsmith/db';
import { tenantContext, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';

// inside createProduct/updateProduct, after persistence, when dto.tryOnBodyPart:
if (dto.tryOnBodyPart) {
  const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
  await withTenantTx(this.pool, (tx) =>
    tx.query(
      `INSERT INTO product_try_on_assets (shop_id, product_id, body_part, status, enabled)
         VALUES ($1, $2, $3, 'pending', false)
       ON CONFLICT (product_id)
         DO UPDATE SET body_part = EXCLUDED.body_part, updated_at = now()`,
      [ctx.shopId, row.id, dto.tryOnBodyPart],
    ),
  );
}
```

- [ ] **Step 7: Service test for the upsert**

In `apps/api/src/modules/inventory/inventory.service.spec.ts`, add a test (mirror the file's existing mocking harness) asserting that when `tryOnBodyPart` is provided, a write touching `product_try_on_assets` is issued. The exact mock shape depends on the file's harness; assert the upsert SQL string contains `product_try_on_assets`.

- [ ] **Step 8: Run the inventory tests + commit**

Run:
```
pnpm --filter @goldsmith/api test -- inventory.service
```
Expected: PASS. Then:
```
git add packages/shared/src/schemas/product.schema.ts packages/shared/src/schemas/product.schema.spec.ts apps/api/src/modules/inventory
git commit -m "feat(inventory): try-on mm dimensions (Zod) + body_part asset upsert"
```

---

### Task 14: BullMQ cutout worker + enqueue on image upload

Uses the codebase's tenant-aware queue pattern from `@goldsmith/queue` (`TenantQueue` + `createTenantWorker`), mirroring `inventory.bulk-import.{service,processor}.ts`. The worker sets `tenantContext` from `job.data.meta.tenantId`; the processor therefore uses `withTenantTx` (RLS active) and never sets the GUC by hand. Storage is the injected `STORAGE_PORT` (`downloadBuffer`/`uploadBuffer`). Background removal uses the `getBgRemovalAdapter()` env factory from Task 12.

**Files:**
- Create: `apps/api/src/modules/inventory/try-on-asset.processor.ts`
- Modify: `apps/api/src/modules/inventory/inventory.module.ts` (queue provider + worker in `onModuleInit`)
- Modify: the image-upload service `product-images.service.ts` (enqueue after image insert)
- Modify: `apps/api/package.json` (+ `@goldsmith/integrations-bg-removal`)

Before coding, read `inventory.bulk-import.processor.ts`, `inventory.bulk-import.service.ts`, and `inventory.module.ts` to copy the exact `TenantQueue`/`createTenantWorker`/`INVENTORY_REDIS`/`DrizzleTenantLookup` wiring. Find the `product_images` insert in `product-images.service.ts` (the `withTenantTx` block that returns `inserted`).

- [ ] **Step 1: Add the dependency**

In `apps/api/package.json` dependencies add (if missing) `"@goldsmith/integrations-bg-removal": "workspace:*"` and confirm `"@goldsmith/queue"`, `"@goldsmith/integrations-storage"`, `"@goldsmith/db"`, `"@goldsmith/tenant-context"` are already present. Run `pnpm install`.

- [ ] **Step 2: Implement the processor**

Create `apps/api/src/modules/inventory/try-on-asset.processor.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { STORAGE_PORT, type StoragePort } from '@goldsmith/integrations-storage';
import { getBgRemovalAdapter } from '@goldsmith/integrations-bg-removal';

export interface TryOnCutoutJob {
  productId: string;
  imageId: string;
  storageKey: string;
}

@Injectable()
export class TryOnAssetProcessor {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  // tenantContext is already set by createTenantWorker before this runs, so
  // withTenantTx applies the correct app.current_shop_id under app_user.
  async handle(data: TryOnCutoutJob): Promise<void> {
    const { productId, imageId, storageKey } = data;
    const bg = getBgRemovalAdapter();

    try {
      const original = await this.storage.downloadBuffer(storageKey);
      const cutout = await bg.removeBackground({ image: original, quality: 'fine' });

      const cutoutKey = `${storageKey}.cutout.png`;
      await this.storage.uploadBuffer(cutoutKey, cutout.png, 'image/png');

      // Anchor auto-proposal: centre-x, top-y of the alpha bbox, normalized.
      const anchorX = cutout.width > 0 ? (cutout.bbox.x + cutout.bbox.width / 2) / cutout.width : 0.5;
      const anchorY = cutout.height > 0 ? cutout.bbox.y / cutout.height : 0.0;

      await withTenantTx(this.pool, (tx) =>
        tx.query(
          `UPDATE product_try_on_assets
              SET asset_storage_key = $1, source_image_id = $2,
                  anchor_x = $3, anchor_y = $4,
                  status = 'ready', enabled = true, updated_at = now()
            WHERE product_id = $5`,
          [cutoutKey, imageId, anchorX.toFixed(4), anchorY.toFixed(4), productId],
        ),
      );
    } catch (err) {
      await withTenantTx(this.pool, (tx) =>
        tx.query(
          `UPDATE product_try_on_assets SET status = 'failed', updated_at = now()
            WHERE product_id = $1`,
          [productId],
        ),
      );
      throw err; // let BullMQ record the failed job for retry/inspection
    }
  }
}
```

- [ ] **Step 3: Register the queue + worker in the module**

In `inventory.module.ts`, mirror the bulk-import wiring: add a `TenantQueue<TryOnCutoutJob>` provider named e.g. `'TRY_ON_QUEUE'` over queue name `'try-on-bg-removal'` (inject `'INVENTORY_REDIS'`), add `TryOnAssetProcessor` to `providers`, and in `onModuleInit` (guarded by `areQueueWorkersEnabled()`) create the worker:

```typescript
this.tryOnWorker = createTenantWorker<TryOnCutoutJob>(
  'try-on-bg-removal',
  (_ctx, data) => this.tryOnProcessor.handle(data),
  this.tenants,            // DrizzleTenantLookup, already injected for bulk-import
  this.redis,              // INVENTORY_REDIS
);
```
Close `this.tryOnWorker` in `onModuleDestroy` alongside the existing worker.

- [ ] **Step 4: Enqueue after image insert**

In `product-images.service.ts`, inject the queue (`@Inject('TRY_ON_QUEUE') private readonly tryOnQueue: TenantQueue<TryOnCutoutJob>`). After `inserted` is returned from the `withTenantTx` upload block, enqueue with the current tenant context so `meta.tenantId` is set:

```typescript
const ctx = tenantContext.requireCurrent();
await this.tryOnQueue.add(ctx, 'cutout', {
  productId,
  imageId:    inserted.id,
  storageKey,
});
```

Place this AFTER a successful insert; a queue/Redis failure must not fail the upload — wrap in a `try/catch` that logs and continues (the bulk-import queue's own `error` handler already degrades gracefully).

- [ ] **Step 5: Smoke-run the worker path**

With Redis + Postgres + `BG_REMOVAL_ADAPTER=rembg` (rembg + model weights installed), create a product with `tryOnBodyPart`, upload an image, then:
```
psql "$DATABASE_URL" -c "SELECT product_id, status, enabled, asset_storage_key FROM product_try_on_assets ORDER BY updated_at DESC LIMIT 1;"
```
Expected: one row with `status='ready'`, `enabled=true`, non-null `asset_storage_key`. (With `BG_REMOVAL_ADAPTER=stub` the row goes to `status='failed'` — that is the expected, safe default when no real adapter is configured.)

- [ ] **Step 6: Commit**

```
git add apps/api/src/modules/inventory/try-on-asset.processor.ts apps/api/src/modules/inventory/inventory.module.ts apps/api/src/modules/inventory/product-images.service.ts apps/api/package.json
git commit -m "feat(inventory): tenant-aware cutout worker — rembg -> product_try_on_assets"
```

---

### Task 15: Shared `CatalogTryOnResponse` type

**Files:**
- Modify: `packages/customer-shared/src/catalog-types.ts`

- [ ] **Step 1: Add the type**

In `packages/customer-shared/src/catalog-types.ts`, append:

```typescript
// ─── Virtual try-on (Plan 1) ────────────────────────────────────────────────
export interface CatalogTryOnResponse {
  productId: string;
  bodyPart: 'EAR' | 'NECK' | 'FINGER' | 'WRIST';
  /** Transparent-PNG cutout URL (ImageKit). Null when not yet processed. */
  assetUrl: string | null;
  /** Normalized anchor within the cutout [0,1]. */
  anchorX: number;
  anchorY: number;
  /** Real-world dimensions in mm (any may be null → engine uses weight fallback). */
  lengthMm: number | null;
  widthMm: number | null;
  diameterMm: number | null;
  /** Engine inputs for the weight fallback. */
  metal: string;
  purity: string;
  netWeightG: string;
  /** True only when at least one real mm dimension is present. */
  trueToSize: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run:
```
pnpm --filter @goldsmith/customer-shared typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add packages/customer-shared/src/catalog-types.ts
git commit -m "feat(customer-shared): CatalogTryOnResponse type"
```

---

### Task 16: Catalog API — `GET /catalog/products/:id/try-on`

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.service.ts`
- Modify: `apps/api/src/modules/catalog/catalog.controller.ts`
- Test: `apps/api/src/modules/catalog/catalog.service.spec.ts` (extend)

- [ ] **Step 1: Write the failing service test**

In `apps/api/src/modules/catalog/catalog.service.spec.ts`, add a test mirroring **the harness used by the existing `listPublicImages` test** (the shop-scoped read methods use `withShopTx`, so reuse whatever connect-aware pool mock that test uses — do NOT invent a plain `.query` mock if the file's shop-scoped tests use a client/connect mock):

```typescript
describe('CatalogService.getTryOn', () => {
  it('returns the cutout URL + dimensions for an enabled, ready asset', async () => {
    // Build the pool/mock exactly as the existing listPublicImages test does,
    // returning this single row from the shop-scoped query:
    const row = {
      product_id: 'p1', body_part: 'EAR', asset_storage_key: 'shop/p1.cutout.png',
      anchor_x: '0.5000', anchor_y: '0.0000',
      try_on_length_mm: '24.50', try_on_width_mm: null, try_on_diameter_mm: null,
      metal: 'GOLD', purity: '22K', net_weight_g: '4.5000',
    };
    const service = makeCatalogServiceReturning([row]); // reuse the file's withShopTx-aware helper
    const r = await service.getTryOn('p1', 'shop1');
    expect(r.bodyPart).toBe('EAR');
    expect(r.assetUrl).toContain('p1.cutout.png');
    expect(r.trueToSize).toBe(true);
    expect(r.lengthMm).toBe(24.5);
  });

  it('throws NotFound when the product has no enabled+ready try-on asset', async () => {
    const service = makeCatalogServiceReturning([]); // no rows
    await expect(service.getTryOn('p1', 'shop1')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run:
```
pnpm --filter @goldsmith/api test -- catalog.service
```
Expected: FAIL — `getTryOn` not a function.

- [ ] **Step 3: Implement the service method**

In `catalog.service.ts`, add the method using `withShopTx` (so RLS is active under `app_user` on this public route, exactly like `listPublicImages` at ~657-681). The query also guards published + ACTIVE shop inline (mirror `listPublicImages`'s `published_at IS NOT NULL` + `EXISTS (...ACTIVE)` guard), so unpublished/inactive products never expose a try-on asset:

```typescript
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';

// eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from x-tenant-id header, not TenantContext
async getTryOn(productId: string, shopId: string): Promise<CatalogTryOnResponse> {
  const r = await withShopTx(this.pool, shopId, async (tx) =>
    tx.query<{
      product_id: string; body_part: string; asset_storage_key: string | null;
      anchor_x: string; anchor_y: string;
      try_on_length_mm: string | null; try_on_width_mm: string | null; try_on_diameter_mm: string | null;
      metal: string; purity: string; net_weight_g: string;
    }>(
      `SELECT a.product_id, a.body_part, a.asset_storage_key, a.anchor_x, a.anchor_y,
              p.try_on_length_mm, p.try_on_width_mm, p.try_on_diameter_mm,
              p.metal, p.purity, p.net_weight_g
         FROM product_try_on_assets a
         JOIN products p ON p.id = a.product_id AND p.shop_id = a.shop_id
        WHERE a.product_id = $1
          AND a.shop_id = $2
          AND a.enabled = true
          AND a.status = 'ready'
          AND p.published_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
        LIMIT 1`,
      [productId, shopId],
    ),
  );
  const row = r.rows[0];
  if (!row) throw new NotFoundException({ code: 'catalog.try_on_unavailable' });

  const lengthMm = row.try_on_length_mm !== null ? Number(row.try_on_length_mm) : null;
  const widthMm = row.try_on_width_mm !== null ? Number(row.try_on_width_mm) : null;
  const diameterMm = row.try_on_diameter_mm !== null ? Number(row.try_on_diameter_mm) : null;

  return {
    productId: row.product_id,
    bodyPart: row.body_part as CatalogTryOnResponse['bodyPart'],
    assetUrl: row.asset_storage_key ? this.urlBuilder.url(row.asset_storage_key, { width: 1024 }) : null,
    anchorX: Number(row.anchor_x),
    anchorY: Number(row.anchor_y),
    lengthMm,
    widthMm,
    diameterMm,
    metal: row.metal,
    purity: row.purity,
    netWeightG: row.net_weight_g,
    trueToSize: lengthMm !== null || widthMm !== null || diameterMm !== null,
  };
}
```

(Confirm `NotFoundException` and `withShopTx` are already imported in the service — both are, used by `getProduct`/`listPublicImages`.)

- [ ] **Step 4: Add the controller route**

In `catalog.controller.ts`, add after the `products/:id/images` route (keep it before any catch-all):

```typescript
@Get('products/:id/try-on')
@SkipAuth()
@SkipTenant()
@Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
async getTryOn(
  @Param('id', new ParseUUIDPipe()) productId: string,
  @Headers('x-tenant-id') shopId: string,
): Promise<import('@goldsmith/customer-shared').CatalogTryOnResponse> {
  shopId = assertPublicTenantHeader(shopId);
  return this.catalogService.getTryOn(productId, shopId);
}
```

- [ ] **Step 5: Run the service test to verify it passes**

Run:
```
pnpm --filter @goldsmith/api test -- catalog.service
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add apps/api/src/modules/catalog/catalog.service.ts apps/api/src/modules/catalog/catalog.controller.ts apps/api/src/modules/catalog/catalog.service.spec.ts
git commit -m "feat(catalog): GET /catalog/products/:id/try-on endpoint"
```

---

### Task 17: Tenant-isolation tests for `product_try_on_assets`

Two layers. (a) **Raw RLS is auto-covered**: the generic harness in `packages/testing/tenant-isolation` (`runTenantIsolationHarness`, invariants 12-13) iterates every table registered via `tenantScopedTable`. Because Task 2 registers `product_try_on_assets`, the no-context-read and per-tenant-only-rows invariants apply automatically — confirm by running it. (b) Add a **service-level** cross-tenant test on `getTryOn`, mirroring `apps/api/test/product-images.tenant-isolation.spec.ts` (testcontainers + `tenantContext.runWith`), which is the established per-feature pattern.

**Files:**
- Create: `apps/api/test/try-on.tenant-isolation.spec.ts`

- [ ] **Step 1: Confirm the generic harness covers the new table**

Run:
```
pnpm test:tenant-isolation
```
Expected: the harness suite passes; `product_try_on_assets` now appears among the iterated tenant tables (it is registered by `tenantScopedTable` in Task 2). If a fixture needs a seeded row to exercise invariant 13 for this table, add one `product_try_on_assets` insert to the existing tenant fixtures (`packages/testing/tenant-isolation/fixtures/tenant-*.ts`) following their seed pattern.

- [ ] **Step 2: Write the service-level cross-tenant test**

Create `apps/api/test/try-on.tenant-isolation.spec.ts`, copying the bootstrap (testcontainers `PostgreSqlContainer`, `runMigrations`, shop seeding, `tenantContext`, `withTenantTx`, `CatalogService` construction with the stub url-builder) from `apps/api/test/product-images.tenant-isolation.spec.ts`. Seed a published product + an enabled/ready try-on asset in SHOP_A, then assert shop B's `getTryOn` cannot see it:

```typescript
// ... bootstrap copied from product-images.tenant-isolation.spec.ts ...
describe('try-on — cross-tenant isolation', () => {
  it('shop B getTryOn on shop A product → NotFoundException', async () => {
    await expect(catalogService.getTryOn(productAId, SHOP_B)).rejects.toThrow(NotFoundException);
  });

  it('shop A getTryOn on its own product → returns the asset', async () => {
    const r = await catalogService.getTryOn(productAId, SHOP_A);
    expect(r.productId).toBe(productAId);
    expect(r.bodyPart).toBe('EAR');
  });
});
```

Seed setup (inside `beforeAll`, under SHOP_A context via `tenantContext.runWith` + `withTenantTx`): insert the product with `published_at = now()`, then `INSERT INTO product_try_on_assets (shop_id, product_id, body_part, status, enabled) VALUES (SHOP_A, productAId, 'EAR', 'ready', true)`, and ensure the SHOP_A `shops` row is `status='ACTIVE'` (the `getTryOn` guard requires it).

- [ ] **Step 3: Run it**

Run:
```
pnpm --filter @goldsmith/api test -- try-on.tenant-isolation
```
Expected: both tests PASS.

- [ ] **Step 4: Commit**

```
git add apps/api/test/try-on.tenant-isolation.spec.ts
git commit -m "test(tenant-isolation): getTryOn cross-tenant denial + generic harness coverage"
```

---

### Task 18: Regenerate agent-context + full gate

**Files:**
- Modify: `docs/agent-context/*.json` (generated)

- [ ] **Step 1: Regenerate the agent-context JSONs**

Run:
```
pnpm docs:context
pnpm docs:validate
```
Expected: regenerates without error; validate passes.

- [ ] **Step 2: Run the full pre-push gate**

Run:
```
pnpm typecheck
pnpm lint
pnpm test:ci
```
Expected: all green (typecheck + lint + unit + integration + tenant-isolation + semgrep + docs:validate).

- [ ] **Step 3: Commit**

```
git add docs/agent-context
git commit -m "chore(docs): regenerate agent-context after try-on foundation"
```

---

## Self-Review (completed by plan author)

**1. Spec coverage (WS-A/B/C portion of the spec):**
- WS-A data model → Tasks 1, 2 (migration + schema) ✓; shopkeeper dimension/body_part write path → Task 13 ✓. (The shopkeeper *UI* for dimension entry + anchor nudge is WS-A's mobile-admin surface — it is UI and is deferred to Plan 2/3's UI work alongside the web/mobile try-on, since it shares the asset-management screens; noted as a gap to schedule, see below.)
- WS-B fit-engine → Tasks 3-10 cover scale, anchor, size+weight-fallback, pose, smoothing, mirror, metric tables ✓. Occlusion (`occlusionMask`) is render-coupled (depth-buffer / segmentation) and is implemented in the web renderer in Plan 2, not as pure math here — intentional; flagged below.
- WS-C API + worker → adapter (11), rembg (12), worker+enqueue (14), endpoint (16), shared type (15), isolation (17) ✓.

**Scheduling gaps to carry into Plan 2/3 (not silent):**
- **Shopkeeper admin UI** for entering mm dimensions + body_part and nudging the anchor point (extends `apps/shopkeeper/app/inventory/{new,[id]/edit,[id]/images}.tsx`). Belongs with the UI plans; listed here so it is not lost.
- **`occlusionMask`** lives in the Plan 2 web renderer (depth-only occluder mesh) — it depends on three.js, so it is not a pure-core function.

**2. Placeholder scan:** No TBD/TODO/"handle errors" placeholders; every code step has complete code. Two steps intentionally instruct "confirm the exact path/method name against file X before editing" — these are existing-codebase reconciliations (DTO filenames, storage adapter method signatures, pool injection token, tenant-isolation harness helpers) that must be read live; each names the exact file and the exact symbol to match, and supplies complete code to write.

**3. Type consistency:** `BodyPart` union `'EAR'|'NECK'|'FINGER'|'WRIST'` is identical across the migration CHECK constraint (Task 1), the Zod `z.enum([...])` for `tryOnBodyPart` (Task 13), `try-on-core/types.ts` (Task 3), and `CatalogTryOnResponse` (Task 15). `normPerMm` naming consistent between `scale.ts` (Task 5) and `size.ts` (Task 7). `getBgRemovalAdapter`/`BgRemovalUnavailableError`/`StubBgRemovalAdapter`/`RembgAdapter` consistent across the bg-removal package (Tasks 11-12). `product_try_on_assets` columns identical across migration (Task 1), Drizzle schema (Task 2), the asset upsert (Task 13), the worker UPDATE (Task 14), and the catalog query (Task 16). Field-naming convention consistent: camelCase in TS/Zod (`tryOnLengthMm`, `bodyPart`), snake_case in SQL (`try_on_length_mm`, `body_part`). Migration number `0077` consistent across header, file-structure, and Task 1.

---

## Execution Handoff

Plan 1 (Foundation) complete. Plans 2 (web try-on UI) and 3 (mobile + privacy/gates) will be written against these concrete foundations once Plan 1 lands (CV/UI tuning is empirical and benefits from real assets + the real endpoint existing).

Two execution options for Plan 1:
1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration. This is a Class A feature → the review gate (`/security-review` on the new endpoint + worker, Codex when available) runs before push.
2. **Inline Execution** — execute tasks in this session via executing-plans with checkpoints.
