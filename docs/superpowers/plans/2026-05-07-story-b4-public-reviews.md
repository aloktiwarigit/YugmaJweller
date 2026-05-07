# Story B4 — Public Reviews Endpoint with PII Redaction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/v1/catalog/products/:id/reviews` — a public, paginated, PII-redacted reviews endpoint that filters `is_publicly_visible = TRUE` at the SQL level.

**Architecture:** Service method `getPublicProductReviews` added to `CatalogService` (public boundary); handler added to `CatalogController` with `@SkipAuth @SkipTenant`; name redaction computed in SQL via `CASE/split_part` — raw customer name never leaves the DB layer. New types `PublicReviewItem` + `PublicReviewsResponse` added to `@goldsmith/customer-shared`.

**Tech Stack:** NestJS, pg (Pool + withShopTx), TypeScript strict, Vitest + testcontainers, `@goldsmith/customer-shared` (types), `@goldsmith/db` (withShopTx).

**Spec:** `docs/superpowers/specs/2026-05-07-story-b4-public-reviews.md`

**Branch:** `feat/reviews-public-b4` · Worktree: `C:\gs-stf-b3`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/customer-shared/src/catalog-types.ts` | Add `PublicReviewItem`, `PublicReviewsResponse` |
| Modify | `packages/customer-shared/src/index.ts` | Re-export new types |
| Modify | `apps/api/test/catalog/reviews-visibility.integration.test.ts` | Activate Phase B describe block; write 7 integration assertions |
| Modify | `apps/api/src/modules/catalog/catalog.service.spec.ts` | Add service unit tests for `getPublicProductReviews` |
| Modify | `apps/api/src/modules/catalog/catalog.controller.spec.ts` | Add HTTP tests for `GET /products/:id/reviews` (includes limit-cap test) |
| Modify | `apps/api/src/modules/catalog/catalog.service.ts` | Add `getPublicProductReviews` method |
| Modify | `apps/api/src/modules/catalog/catalog.controller.ts` | Add `getProductReviews` handler |

---

## Task 1: Add `PublicReviewItem` and `PublicReviewsResponse` types to customer-shared

**Files:**
- Modify: `packages/customer-shared/src/catalog-types.ts:64-76`
- Modify: `packages/customer-shared/src/index.ts:1-17`

- [ ] **Step 1: Add types after the existing `ReviewsResponse` interface (line 76)**

Open `packages/customer-shared/src/catalog-types.ts`. After the closing `}` of `ReviewsResponse` (after line 76), add:

```ts
// ─── Public reviews (Story B4) — PII-redacted, filtered by is_publicly_visible ─
// NEVER add customerId, full name, email, or phone here.
export interface PublicReviewItem {
  id:                  string;
  rating:              number;           // 1–5
  reviewText:          string | null;
  customerDisplayName: string;           // first name + last initial (e.g. "Priya S.") or "Anonymous"
  createdAt:           string;           // ISO 8601
}

export interface PublicReviewsResponse {
  items:          PublicReviewItem[];
  total:          number;
  page:           number;
  ratingBreakdown: { 1: number; 2: number; 3: number; 4: number; 5: number };
}
```

- [ ] **Step 2: Re-export the new types from index.ts**

In `packages/customer-shared/src/index.ts`, the first export block currently reads:

```ts
export type {
  TenantConfigResponse,
  EstimatedPrice,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRateEntry,
  PublicRatesResponse,
  ReviewItem,
  ReviewsResponse,
  PublicImageItem,
  HuidVerifyResult,
  CatalogImage,
  CatalogProductCard,
  CatalogProductDetail,
  CategoryNode,
  Collection,
} from './catalog-types';
```

Add `PublicReviewItem` and `PublicReviewsResponse` to that list:

```ts
export type {
  TenantConfigResponse,
  EstimatedPrice,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRateEntry,
  PublicRatesResponse,
  ReviewItem,
  ReviewsResponse,
  PublicReviewItem,
  PublicReviewsResponse,
  PublicImageItem,
  HuidVerifyResult,
  CatalogImage,
  CatalogProductCard,
  CatalogProductDetail,
  CategoryNode,
  Collection,
} from './catalog-types';
```

- [ ] **Step 3: Build customer-shared to verify no type errors**

```
pnpm --filter @goldsmith/customer-shared build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/customer-shared/src/catalog-types.ts packages/customer-shared/src/index.ts
git commit -m "feat(b4): add PublicReviewItem + PublicReviewsResponse to customer-shared"
```

---

## Task 2: Write Red — integration tests (testcontainer)

**Files:**
- Modify: `apps/api/test/catalog/reviews-visibility.integration.test.ts`

This file has a `describe.skip('Phase B ...')` block. Remove the `.skip` and replace the entire Phase B describe block with the full implementation below.

The outer `beforeAll` (line 18–27) already starts the PostgreSQL testcontainer and runs all migrations. The Phase B `beforeAll` seeds test fixtures into that database.

**UUIDs used throughout (define at top of Phase B describe block):**

| Constant | Value |
|----------|-------|
| `SHOP_A` | `'a0000000-0000-0000-0000-000000000001'` |
| `SHOP_B` | `'a0000000-0000-0000-0000-000000000002'` |
| `PRODUCT_A` | `'b0000000-0000-0000-0000-000000000001'` (published, belongs to SHOP_A) |
| `PRODUCT_B` | `'b0000000-0000-0000-0000-000000000002'` (for orphan-customer test) |
| `CUSTOMER_PRIYA` | `'c0000000-0000-0000-0000-000000000001'` (name: `'Priya Sharma'`) |
| `CUSTOMER_REKHA` | `'c0000000-0000-0000-0000-000000000002'` (name: `'Rekha'`) |
| `CUSTOMER_SUNITA` | `'c0000000-0000-0000-0000-000000000003'` (name: `'Sunita Patel'`) |
| `CUSTOMER_ANITA` | `'c0000000-0000-0000-0000-000000000004'` (name: `'Anita Devi'`, hidden review) |
| `CUSTOMER_MEENA` | `'c0000000-0000-0000-0000-000000000005'` (name: `'Meena'`, hidden review) |
| `ORPHAN_CUSTOMER_UUID` | `'c0000000-0000-0000-0000-000000000099'` (never inserted — for Anonymous test) |

**Reviews seeded for PRODUCT_A:**
- PRIYA rating=5 visible=TRUE
- REKHA rating=4 visible=TRUE
- SUNITA rating=3 visible=TRUE
- ANITA rating=2 visible=FALSE
- MEENA rating=1 visible=FALSE

**Reviews seeded for PRODUCT_B:**
- Orphan customer (FK bypassed via `session_replication_role=replica`) rating=4 visible=TRUE

- [ ] **Step 1: Replace Phase B describe block**

Remove the entire `describe.skip('Phase B ...', () => { ... });` block from line 77 to end of file.

Replace with the following. Do NOT change the outer `beforeAll`, `afterAll`, or the Phase A describe block.

```ts
// ─── Phase B — public reviews endpoint (Story B4) ────────────────────────────

describe('Phase B — GET /catalog/products/:id/reviews with is_publicly_visible filter', () => {
  const SHOP_A             = 'a0000000-0000-0000-0000-000000000001';
  const SHOP_B             = 'a0000000-0000-0000-0000-000000000002';
  const PRODUCT_A          = 'b0000000-0000-0000-0000-000000000001';
  const PRODUCT_B          = 'b0000000-0000-0000-0000-000000000002';
  const CUSTOMER_PRIYA     = 'c0000000-0000-0000-0000-000000000001'; // 'Priya Sharma'
  const CUSTOMER_REKHA     = 'c0000000-0000-0000-0000-000000000002'; // 'Rekha'
  const CUSTOMER_SUNITA    = 'c0000000-0000-0000-0000-000000000003'; // 'Sunita Patel'
  const CUSTOMER_ANITA     = 'c0000000-0000-0000-0000-000000000004'; // 'Anita Devi' (hidden)
  const CUSTOMER_MEENA     = 'c0000000-0000-0000-0000-000000000005'; // 'Meena' (hidden)
  const ORPHAN_UUID        = 'c0000000-0000-0000-0000-000000000099'; // never inserted
  const CREATOR_UUID       = 'f0000000-0000-0000-0000-000000000001'; // arbitrary creator id

  // SQL for the public reviews list query (mirrors catalog.service.getPublicProductReviews)
  const REVIEWS_SQL = `
    SELECT
      pr.id,
      pr.rating,
      pr.review_text,
      CASE
        WHEN c.name IS NULL THEN 'Anonymous'
        WHEN position(' ' IN c.name) = 0 THEN c.name
        ELSE split_part(c.name, ' ', 1) || ' ' || LEFT(split_part(c.name, ' ', -1), 1) || '.'
      END AS customer_display_name,
      pr.created_at
    FROM product_reviews pr
    LEFT JOIN customers c ON c.id = pr.customer_id AND c.shop_id = pr.shop_id
    WHERE pr.shop_id = $1
      AND pr.product_id = $2
      AND pr.is_publicly_visible = TRUE
    ORDER BY pr.created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const BREAKDOWN_SQL = `
    SELECT rating, COUNT(*)::int AS cnt
      FROM product_reviews
     WHERE shop_id = $1
       AND product_id = $2
       AND is_publicly_visible = TRUE
     GROUP BY rating
  `;

  beforeAll(async () => {
    // Seed shops
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status)
       VALUES ($1, 'shop-a', 'Shop A', 'ACTIVE'),
              ($2, 'shop-b', 'Shop B', 'ACTIVE')
       ON CONFLICT DO NOTHING`,
      [SHOP_A, SHOP_B],
    );

    // Seed products (published)
    await pool.query(
      `INSERT INTO products
         (id, shop_id, sku, metal, purity, gross_weight_g, net_weight_g, created_by_user_id, published_at)
       VALUES
         ($1, $3, 'B4-P-A', 'GOLD', '22K', 5.0000, 4.5000, $4, NOW()),
         ($2, $3, 'B4-P-B', 'GOLD', '22K', 3.0000, 2.7000, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [PRODUCT_A, PRODUCT_B, SHOP_A, CREATOR_UUID],
    );

    // Seed customers
    await pool.query(
      `INSERT INTO customers (id, shop_id, phone, name, viewing_consent, created_by_user_id)
       VALUES
         ($1, $6, '9991111001', 'Priya Sharma', TRUE, $7),
         ($2, $6, '9991111002', 'Rekha',        TRUE, $7),
         ($3, $6, '9991111003', 'Sunita Patel', TRUE, $7),
         ($4, $6, '9991111004', 'Anita Devi',   TRUE, $7),
         ($5, $6, '9991111005', 'Meena',         TRUE, $7)
       ON CONFLICT DO NOTHING`,
      [CUSTOMER_PRIYA, CUSTOMER_REKHA, CUSTOMER_SUNITA, CUSTOMER_ANITA, CUSTOMER_MEENA,
       SHOP_A, CREATOR_UUID],
    );

    // Seed reviews for PRODUCT_A
    await pool.query(
      `INSERT INTO product_reviews (id, shop_id, product_id, customer_id, rating, is_publicly_visible)
       VALUES
         ('d0000000-0000-0000-0000-000000000001', $1, $2, $3, 5, TRUE),
         ('d0000000-0000-0000-0000-000000000002', $1, $2, $4, 4, TRUE),
         ('d0000000-0000-0000-0000-000000000003', $1, $2, $5, 3, TRUE),
         ('d0000000-0000-0000-0000-000000000004', $1, $2, $6, 2, FALSE),
         ('d0000000-0000-0000-0000-000000000005', $1, $2, $7, 1, FALSE)
       ON CONFLICT DO NOTHING`,
      [SHOP_A, PRODUCT_A, CUSTOMER_PRIYA, CUSTOMER_REKHA, CUSTOMER_SUNITA,
       CUSTOMER_ANITA, CUSTOMER_MEENA],
    );

    // Seed orphan review for PRODUCT_B (customer_id that doesn't exist — FK bypassed)
    await pool.query("SET session_replication_role = 'replica'");
    await pool.query(
      `INSERT INTO product_reviews (id, shop_id, product_id, customer_id, rating, is_publicly_visible)
       VALUES ('d0000000-0000-0000-0000-000000000006', $1, $2, $3, 4, TRUE)
       ON CONFLICT DO NOTHING`,
      [SHOP_A, PRODUCT_B, ORPHAN_UUID],
    );
    await pool.query("SET session_replication_role = 'origin'");
  });

  // ── Assertion 1: is_publicly_visible=FALSE rows excluded ───────────────────

  it('only returns is_publicly_visible=TRUE reviews — FALSE rows excluded', async () => {
    const { rows } = await pool.query(REVIEWS_SQL, [SHOP_A, PRODUCT_A, 10, 0]);
    // PRODUCT_A has 5 reviews: 3 visible, 2 hidden
    expect(rows).toHaveLength(3);
    const allVisible = rows.every((r: { is_publicly_visible?: boolean }) =>
      // column not in SELECT — verify by checking no hidden customer names appear
      r.customer_display_name !== 'Anita D.' && r.customer_display_name !== 'Meena',
    );
    expect(allVisible).toBe(true);
  });

  // ── Assertion 2: cross-tenant review isolation ──────────────────────────────

  it('returns empty for shop_b context querying shop_a product', async () => {
    // PRODUCT_A belongs to SHOP_A. Querying with SHOP_B shop_id finds nothing.
    const { rows } = await pool.query(REVIEWS_SQL, [SHOP_B, PRODUCT_A, 10, 0]);
    expect(rows).toHaveLength(0);
  });

  // ── Assertion 3: PII redaction — full name → first + initial ───────────────

  it('PII: full name Priya Sharma is redacted to Priya S.', async () => {
    const { rows } = await pool.query<{ customer_display_name: string }>(
      REVIEWS_SQL, [SHOP_A, PRODUCT_A, 10, 0],
    );
    const priyaRow = rows.find((r) => r.customer_display_name === 'Priya S.');
    expect(priyaRow).toBeDefined();
    // Full name must never appear
    const fullNameLeaked = rows.some((r) =>
      r.customer_display_name.includes('Sharma'),
    );
    expect(fullNameLeaked).toBe(false);
  });

  // ── Assertion 4: PII redaction — single-token name ─────────────────────────

  it('PII: single-token name Rekha is returned as-is (no dot, no crash)', async () => {
    const { rows } = await pool.query<{ customer_display_name: string }>(
      REVIEWS_SQL, [SHOP_A, PRODUCT_A, 10, 0],
    );
    const rekhaRow = rows.find((r) => r.customer_display_name === 'Rekha');
    expect(rekhaRow).toBeDefined();
  });

  // ── Assertion 5: PII redaction — orphan customer → Anonymous ───────────────

  it('PII: missing customer row (LEFT JOIN miss) returns Anonymous', async () => {
    // PRODUCT_B has a review with customer_id = ORPHAN_UUID (not in customers table)
    const { rows } = await pool.query<{ customer_display_name: string }>(
      REVIEWS_SQL, [SHOP_A, PRODUCT_B, 10, 0],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_display_name).toBe('Anonymous');
  });

  // ── Assertion 6: ratingBreakdown counts only visible reviews ───────────────

  it('breakdown totals 3 (only visible reviews counted; 2 hidden excluded)', async () => {
    const { rows } = await pool.query<{ rating: number; cnt: number }>(
      BREAKDOWN_SQL, [SHOP_A, PRODUCT_A],
    );
    const total = rows.reduce((sum, r) => sum + r.cnt, 0);
    // 3 visible reviews (ratings 5, 4, 3); 2 hidden (ratings 2, 1) excluded
    expect(total).toBe(3);
    const ratingMap = Object.fromEntries(rows.map((r) => [r.rating, r.cnt]));
    expect(ratingMap[5]).toBe(1);
    expect(ratingMap[4]).toBe(1);
    expect(ratingMap[3]).toBe(1);
    expect(ratingMap[2]).toBeUndefined(); // hidden, not counted
    expect(ratingMap[1]).toBeUndefined(); // hidden, not counted
  });

  // ── Assertion 7: partial index idx_product_reviews_public used in EXPLAIN ──

  it('EXPLAIN uses idx_product_reviews_public (not a seq scan) for the public filter', async () => {
    const client = await (pool as import('pg').Pool).connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN ${REVIEWS_SQL}`,
        [SHOP_A, PRODUCT_A, 10, 0],
      );
      await client.query('ROLLBACK');
      const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(plan).toContain('idx_product_reviews_public');
    } finally {
      client.release();
    }
  });
});
```

- [ ] **Step 2: Run integration tests to confirm all Phase B tests FAIL (Red)**

```
pnpm --filter @goldsmith/api test apps/api/test/catalog/reviews-visibility.integration.test.ts --run
```

Expected: Phase A tests still PASS. Phase B tests all FAIL with errors like `TypeError: Cannot read properties of undefined` or `expect(received).toHaveLength(3)` because the service method and SQL aren't in place yet.

> **Note:** The integration tests for Phase B test the SQL queries DIRECTLY against the testcontainer DB. They will actually PASS once the migrations are applied (migration 0070 added the column; the queries are valid SQL). If all Phase B tests pass at Red phase, that means the SQL is correct — which is expected, since migrations are already applied. If this happens, verify that the controller + service tests (Tasks 3–4) are failing (Red) before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/catalog/reviews-visibility.integration.test.ts
git commit -m "test(b4): Red — integration tests for public reviews PII + visibility filter"
```

---

## Task 3: Write Red — service unit tests

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.service.spec.ts`

Add the following describe block at the end of the file (after all existing describes).

`makePool` and other fixtures are already defined at the top of that file — reuse them.

- [ ] **Step 1: Append service unit tests at the end of `catalog.service.spec.ts`**

```ts
// ---------------------------------------------------------------------------
// getPublicProductReviews — Story B4
// ---------------------------------------------------------------------------

describe('CatalogService.getPublicProductReviews()', () => {
  it('throws NotFoundException when product is not found for this tenant', async () => {
    // Response sequence: existence check returns 0 rows → NotFoundException
    const pool = makePool([{ rows: [] }]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    await expect(
      svc.getPublicProductReviews({
        shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns PII-redacted items and ratingBreakdown for a published product', async () => {
    // Response sequence: [existence check, reviews, breakdown]
    const pool = makePool([
      { rows: [{ id: '1' }] }, // existence check → product found
      { rows: [
        {
          id: 'rev-1', rating: 5, review_text: 'Excellent!',
          customer_display_name: 'Priya S.', created_at: new Date('2026-01-15T10:00:00Z'),
        },
      ]}, // reviews query
      { rows: [{ rating: 5, cnt: 1 }] }, // breakdown query
    ]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    const result = await svc.getPublicProductReviews({
      shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('rev-1');
    expect(result.items[0].rating).toBe(5);
    expect(result.items[0].customerDisplayName).toBe('Priya S.');
    expect(result.items[0].reviewText).toBe('Excellent!');
    expect(result.items[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.ratingBreakdown[5]).toBe(1);
    expect(result.ratingBreakdown[1]).toBe(0);
    expect(result.ratingBreakdown[2]).toBe(0);
    expect(result.ratingBreakdown[3]).toBe(0);
    expect(result.ratingBreakdown[4]).toBe(0);
  });

  it('returns empty items + zeroed breakdown when product has no public reviews', async () => {
    const pool = makePool([
      { rows: [{ id: '1' }] }, // existence check → product found
      { rows: [] },             // reviews → empty
      { rows: [] },             // breakdown → empty
    ]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    const result = await svc.getPublicProductReviews({
      shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 10,
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('caps safeLimit at 50 even when caller passes limit=200', async () => {
    const pool = makePool([
      { rows: [{ id: '1' }] },
      { rows: [] },
      { rows: [] },
    ]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    await svc.getPublicProductReviews({
      shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 200,
    });

    // Third pool.query call is the reviews query — check LIMIT param is ≤ 50
    const reviewsCallArgs = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1];
    const limitParam = reviewsCallArgs[1][2]; // $3 = safeLimit
    expect(limitParam).toBeLessThanOrEqual(50);
  });
});
```

- [ ] **Step 2: Run service tests to confirm Red**

```
pnpm --filter @goldsmith/api test apps/api/src/modules/catalog/catalog.service.spec.ts --run
```

Expected: Existing tests PASS. New `getPublicProductReviews` describe block FAILS with `TypeError: svc.getPublicProductReviews is not a function`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/catalog/catalog.service.spec.ts
git commit -m "test(b4): Red — service unit tests for getPublicProductReviews"
```

---

## Task 4: Write Red — controller HTTP tests

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.controller.spec.ts`

The `mockCatalogService` object (around line 38) needs a new mock method. The describe block is added at the end.

- [ ] **Step 1: Add `getPublicProductReviews` to `mockCatalogService`**

Find the `const mockCatalogService = { ... }` block (around line 38–43). Add the new mock method:

```ts
const mockCatalogService = {
  getTenantConfig:         vi.fn().mockResolvedValue(mockTenantConfig),
  getProducts:             vi.fn().mockResolvedValue(mockProductsResponse),
  getProduct:              vi.fn().mockRejectedValue(new NotFoundException()),
  verifyHuid:              vi.fn(),
  getPublicProductReviews: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  }),
};
```

- [ ] **Step 2: Add `getPublicProductReviews` reset to `beforeEach`**

Find the `beforeEach(() => { ... })` block (around line 69–76). Add a reset line:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRates);
  mockCatalogService.getTenantConfig.mockResolvedValue(mockTenantConfig);
  mockCatalogService.getProducts.mockResolvedValue(mockProductsResponse);
  mockCatalogService.getProduct.mockRejectedValue(new NotFoundException());
  mockCatalogService.verifyHuid.mockResolvedValue({ verified: true, huid: 'AB1234', certifyingBody: 'BIS' });
  mockCatalogService.getPublicProductReviews.mockResolvedValue({
    items: [], total: 0, page: 1, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
});
```

- [ ] **Step 3: Append HTTP test describe block at end of file**

```ts
describe('GET /api/v1/catalog/products/:id/reviews', () => {
  const PRODUCT_ID = '00000000-0000-0000-0000-000000000001';
  const BASE       = `/api/v1/catalog/products/${PRODUCT_ID}/reviews`;

  it('returns 400 when x-tenant-id header is missing', async () => {
    await request(app.getHttpServer()).get(BASE).expect(400);
  });

  it('returns 400 for a non-UUID product id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/catalog/products/not-a-uuid/reviews')
      .set('X-Tenant-Id', 'shop-uuid')
      .expect(400);
  });

  it('returns 404 when service throws NotFoundException (product not found / wrong tenant)', async () => {
    mockCatalogService.getPublicProductReviews.mockRejectedValueOnce(new NotFoundException());
    await request(app.getHttpServer())
      .get(BASE)
      .set('X-Tenant-Id', 'shop-uuid')
      .expect(404);
  });

  it('returns 200 with items array and correct cache header', async () => {
    const res = await request(app.getHttpServer())
      .get(BASE)
      .set('X-Tenant-Id', 'shop-uuid')
      .expect(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body).toHaveProperty('ratingBreakdown');
    expect(res.headers['cache-control']).toBe('public, max-age=120, stale-while-revalidate=600');
  });

  it('caps limit at 50 when ?limit=200 is requested (assertion #8)', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}?limit=200`)
      .set('X-Tenant-Id', 'shop-uuid');
    expect(mockCatalogService.getPublicProductReviews).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it('defaults limit to 10 when not specified', async () => {
    await request(app.getHttpServer())
      .get(BASE)
      .set('X-Tenant-Id', 'shop-uuid');
    expect(mockCatalogService.getPublicProductReviews).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it('passes page and shopId to service', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}?page=3`)
      .set('X-Tenant-Id', 'tenant-uuid-123');
    expect(mockCatalogService.getPublicProductReviews).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, shopId: 'tenant-uuid-123' }),
    );
  });
});
```

- [ ] **Step 4: Run controller tests to confirm Red**

```
pnpm --filter @goldsmith/api test apps/api/src/modules/catalog/catalog.controller.spec.ts --run
```

Expected: All existing tests PASS. New `GET /products/:id/reviews` describe block FAILS — the route doesn't exist yet (NestJS returns 404 for unregistered routes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/catalog/catalog.controller.spec.ts
git commit -m "test(b4): Red — HTTP controller tests for GET /products/:id/reviews"
```

---

## Task 5: Implement `getPublicProductReviews` in CatalogService (Green)

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.service.ts`

- [ ] **Step 1: Add import for shared types at top of catalog.service.ts**

Find the existing imports at the top. Add after the last import line:

```ts
import type { PublicReviewItem, PublicReviewsResponse } from '@goldsmith/customer-shared';
```

- [ ] **Step 2: Add `getPublicProductReviews` method**

Add after the `getReturnPolicy` method (at the end of the class, before the final `}`):

```ts
  // ---------------------------------------------------------------------------
  // Story B4 — public reviews with PII redaction + visibility filter
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- public catalog endpoint; shopId from x-tenant-id header, not TenantContext
  async getPublicProductReviews(params: {
    shopId:    string;
    productId: string;
    page:      number;
    limit:     number;
  }): Promise<PublicReviewsResponse> {
    const { shopId, productId } = params;
    const safePage  = Math.max(1, params.page);
    const safeLimit = Math.min(50, Math.max(1, params.limit));
    const offset    = (safePage - 1) * safeLimit;

    return withShopTx(this.pool, shopId, async (tx) => {
      // Step 1 — existence guard: product must belong to this (active) tenant and be published.
      // 404 on miss prevents tenant enumeration (caller cannot distinguish "no reviews"
      // from "wrong tenant / suspended shop").
      const existsResult = await tx.query<{ id: string }>(
        `SELECT 1 AS id FROM products
          WHERE id = $1
            AND shop_id = $2
            AND published_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')`,
        [productId, shopId],
      );
      if (existsResult.rows.length === 0) {
        throw new NotFoundException({ code: 'catalog.product_not_found' });
      }

      // Step 2 — reviews list + rating breakdown run in parallel inside the same tx.
      // PII redaction is computed in SQL: raw customer name never reaches the app layer.
      // LEFT JOIN handles deleted-customer rows (null name → 'Anonymous').
      const [reviewsResult, breakdownResult] = await Promise.all([
        tx.query<{
          id:                    string;
          rating:                number;
          review_text:           string | null;
          customer_display_name: string;
          created_at:            Date;
        }>(
          `SELECT
             pr.id,
             pr.rating,
             pr.review_text,
             CASE
               WHEN c.name IS NULL THEN 'Anonymous'
               WHEN position(' ' IN c.name) = 0 THEN c.name
               ELSE split_part(c.name, ' ', 1) || ' ' || LEFT(split_part(c.name, ' ', -1), 1) || '.'
             END AS customer_display_name,
             pr.created_at
           FROM product_reviews pr
           LEFT JOIN customers c ON c.id = pr.customer_id AND c.shop_id = pr.shop_id
           WHERE pr.shop_id = $1
             AND pr.product_id = $2
             AND pr.is_publicly_visible = TRUE
           ORDER BY pr.created_at DESC
           LIMIT $3 OFFSET $4`,
          [shopId, productId, safeLimit, offset],
        ),
        tx.query<{ rating: number; cnt: number }>(
          `SELECT rating, COUNT(*)::int AS cnt
             FROM product_reviews
            WHERE shop_id = $1
              AND product_id = $2
              AND is_publicly_visible = TRUE
            GROUP BY rating`,
          [shopId, productId],
        ),
      ]);

      const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      for (const row of breakdownResult.rows) {
        const star = row.rating as 1 | 2 | 3 | 4 | 5;
        breakdown[star] = row.cnt;
        total += row.cnt;
      }

      const items: PublicReviewItem[] = reviewsResult.rows.map((row) => ({
        id:                  row.id,
        rating:              row.rating,
        reviewText:          row.review_text,
        customerDisplayName: row.customer_display_name,
        createdAt:           row.created_at.toISOString(),
      }));

      return { items, total, page: safePage, ratingBreakdown: breakdown };
    });
  }
```

- [ ] **Step 3: Run service unit tests to confirm Green**

```
pnpm --filter @goldsmith/api test apps/api/src/modules/catalog/catalog.service.spec.ts --run
```

Expected: ALL tests PASS (existing + new `getPublicProductReviews` block).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/catalog/catalog.service.ts
git commit -m "feat(b4): implement CatalogService.getPublicProductReviews — SQL PII redaction + visibility filter"
```

---

## Task 6: Implement `getProductReviews` handler in CatalogController (Green)

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.controller.ts`

- [ ] **Step 1: Add import for `PublicReviewsResponse`**

Find the existing imports at the top of the file. Add to the imports:

```ts
import type { PublicReviewsResponse } from '@goldsmith/customer-shared';
```

- [ ] **Step 2: Add the handler**

Insert the new handler BEFORE `recordProductView` (the `@Post('products/:id/view')` handler). Placement after the `listProductImages` handler and before `getPublicRates` is ideal — keeps product sub-resource routes together.

The new handler goes between `listProductImages` and the `getPublicRates` block:

```ts
  // -------------------------------------------------------------------------
  // GET /catalog/products/:id/reviews — Story B4 (PII-redacted, public)
  // -------------------------------------------------------------------------

  @Get('products/:id/reviews')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  async getProductReviews(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ): Promise<PublicReviewsResponse> {
    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
    return this.catalogService.getPublicProductReviews({
      shopId,
      productId,
      page:  Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
    });
  }
```

- [ ] **Step 3: Run controller tests to confirm Green**

```
pnpm --filter @goldsmith/api test apps/api/src/modules/catalog/catalog.controller.spec.ts --run
```

Expected: ALL tests PASS (existing + new `GET /products/:id/reviews` block).

- [ ] **Step 4: Run integration tests to confirm all Green**

```
pnpm --filter @goldsmith/api test apps/api/test/catalog/reviews-visibility.integration.test.ts --run
```

Expected: ALL 10 tests PASS (3 Phase A schema tests + 7 Phase B integration assertions).

- [ ] **Step 5: Run full API test suite**

```
pnpm --filter @goldsmith/api test --run
```

Expected: All tests PASS. No regressions.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/catalog/catalog.controller.ts
git commit -m "feat(b4): add GET /catalog/products/:id/reviews handler — SkipAuth, ParseUUID, cache 120s"
```

---

## Task 7: Typecheck and lint

- [ ] **Step 1: Typecheck the API package**

```
pnpm --filter @goldsmith/api typecheck
```

Expected: No errors.

- [ ] **Step 2: Lint the API package**

```
pnpm --filter @goldsmith/api lint
```

Expected: No errors. If the `goldsmith/no-raw-shop-id-param` eslint rule triggers on the new method, the `eslint-disable-next-line` comment added in Task 5 Step 2 should suppress it. If it fires on the controller, add the same comment above the handler.

- [ ] **Step 3: Typecheck customer-shared**

```
pnpm --filter @goldsmith/customer-shared typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(b4): typecheck + lint fixes"
```

---

## Task 8: Codex review gate

- [ ] **Step 1: Run Codex review from main repo**

Per `memory/feedback_codex_worktree_clm.md`, Codex may fail inside a Windows worktree. Run from the main repo copy against this branch:

```
codex review --base main
```

If running from the worktree fails, run from `C:\Alok\Business Projects\Goldsmith`:

```
codex review --base main --branch feat/reviews-public-b4
```

- [ ] **Step 2: Fix any P0 or P1 findings**

Address each Codex P0/P1 finding before writing the marker. P2/P3 findings: use judgment — fix if low-risk, log if they require larger scope. Do not re-run Codex for P2/P3 fixes.

- [ ] **Step 3: Write `.codex-review-passed` marker**

In worktree `C:\gs-stf-b3`:

```bash
echo "codex review passed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .codex-review-passed
git add .codex-review-passed
git commit -m "chore(b4): codex review passed"
```

---

## Task 9: Security review gate

- [ ] **Step 1: Run `/security-review` on HEAD**

This triggers the security review skill on the current branch diff. Focus areas:

- PII redaction: verify `customerDisplayName` is the only name-derived field in `PublicReviewItem`; no `customerId`, `email`, or `phone` field exists anywhere in the response chain
- `is_publicly_visible = TRUE` at SQL level: confirm the WHERE clause is in `REVIEWS_SQL` and `BREAKDOWN_SQL` — not filtered post-fetch in application code
- Cross-tenant isolation: `withShopTx` sets `app.current_shop_id`; `WHERE pr.shop_id = $1` is explicit; LEFT JOIN uses `AND c.shop_id = pr.shop_id`
- UUID input validation: `ParseUUIDPipe` is on `:id`; non-UUIDs → 400 before any DB call
- `x-tenant-id` guard: `if (!shopId) throw new BadRequestException(...)` before service call
- Cache header correctness: `public, max-age=120` is safe (no session-specific data; `is_publicly_visible` is evaluated at query time per request)

- [ ] **Step 2: Fix any security findings**

Address all findings before writing the marker.

- [ ] **Step 3: Write `.security-review-passed` marker**

```bash
echo "security review passed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .security-review-passed
git add .security-review-passed
git commit -m "chore(b4): security review passed"
```

---

## Task 10: Runtime smoke test

- [ ] **Step 1: Start the API dev server**

```
pnpm --filter @goldsmith/api dev
```

Wait for `Application is running on: http://[::1]:3000`.

- [ ] **Step 2: Seed a test review (if anchor-dev DB has none)**

If no reviews exist, insert one with psql or a direct script (use the authenticated `/api/v1/reviews` endpoint or seed SQL directly).

- [ ] **Step 3: Call the public reviews endpoint**

Replace `<PRODUCT_UUID>` and `<SHOP_UUID>` with real values from your local DB:

```bash
curl -s -H "x-tenant-id: <SHOP_UUID>" \
  "http://localhost:3000/api/v1/catalog/products/<PRODUCT_UUID>/reviews?page=1&limit=5" | \
  python -m json.tool
```

- [ ] **Step 4: Verify smoke test checklist**

- [ ] `customerDisplayName` is redacted (e.g. `"Priya S."`, never `"Priya Sharma"`)
- [ ] No `customerId`, `email`, or `phone` fields in any item
- [ ] `ratingBreakdown` keys are `"1"` through `"5"`; values sum to `total`
- [ ] `Cache-Control: public, max-age=120, stale-while-revalidate=600` in response headers
- [ ] Non-UUID product ID → 400 response
- [ ] Wrong tenant ID → 404 response

- [ ] **Step 5: Final commit if smoke test revealed any fixes**

```bash
git add -p
git commit -m "fix(b4): smoke test fixes"
```

---

## Resume point

If this session is interrupted, resume from the last incomplete task. The commit log is the source of truth. Run `git log --oneline` to see what's been completed.

All Red tests must fail before any Green implementation begins (Tasks 2–4 before Tasks 5–6). Do not skip the Red phase.
