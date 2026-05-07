# Story B4 — Public Reviews Endpoint with PII Redaction

**Date:** 2026-05-07
**Branch:** `feat/reviews-public-b4`
**Worktree:** `C:\gs-stf-b3`
**Class:** A (PII surface — customer name exposed publicly; DPDPA-adjacent)
**Phase:** B (API expansion)
**Plan reference:** `C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md` §"Phase B · Story B4"

---

## Purpose

Expose a public, paginated, PII-redacted list of product reviews under the public catalog API. Consumed by the customer-web PDP (Phase C) and customer-mobile PDP (Phase D). Independent of B1/B3 and B2/B5/B6/B7 — lives in the `catalog` module (public boundary), not the authenticated `reviews` module.

---

## Locked design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PII redaction location | SQL inline (`CASE`/`split_part` in `SELECT`) | Raw name never leaves DB layer; no risk of full name appearing in app logs, error payloads, or future code paths |
| Product-not-found behavior | `404 NotFoundException` | Prevents tenant enumeration — caller cannot distinguish "no reviews" from "wrong tenant". Consistent with `getProduct()` pattern |
| Rating breakdown scope | Visible-only (`is_publicly_visible = TRUE`) | Hidden reviews must not leak via aggregate; DPDPA-clean; breakdown total = sum of items |

---

## Endpoint

```
GET /api/v1/catalog/products/:id/reviews
```

### Auth / tenant
- `@SkipAuth()` `@SkipTenant()` — no session required
- Tenant resolved from `x-tenant-id` header (UUID)
- Missing header → `400 BadRequestException({ code: 'catalog.tenant_id_required' })`

### Path parameter
- `:id` — UUID of the product, validated by `ParseUUIDPipe`
- Non-UUID → `400` (no DB hit)

### Query parameters

| Param | Default | Validation |
|-------|---------|-----------|
| `page` | `1` | `Math.max(1, parseInt \|\| 1)` |
| `limit` | `10` | `Math.min(50, Math.max(1, parseInt \|\| 10))` |

### Response shape

```ts
interface PublicReviewItem {
  id: string;
  rating: number;            // 1–5
  reviewText: string | null;
  customerDisplayName: string;  // PII-redacted (see below)
  createdAt: string;         // ISO 8601
  // NEVER: customerId, full name, email, phone
}

interface PublicReviewsResponse {
  items: PublicReviewItem[];
  total: number;
  page: number;
  ratingBreakdown: { 1: number; 2: number; 3: number; 4: number; 5: number };
}
```

### Cache header
```
Cache-Control: public, max-age=120, stale-while-revalidate=600
```

---

## PII redaction rules

`customerDisplayName` is computed entirely in SQL. Rules in priority order:

1. Customer row missing (LEFT JOIN miss, or customer deleted) → `'Anonymous'`
2. `c.name` has no space (single token) → return `c.name` as-is (e.g. `'Rekha'`)
3. `c.name` has at least one space → `<first token> + ' ' + <first char of last token> + '.'` (e.g. `'Priya S.'`)

SQL expression:

```sql
CASE
  WHEN c.name IS NULL THEN 'Anonymous'
  WHEN position(' ' IN c.name) = 0 THEN c.name
  ELSE split_part(c.name, ' ', 1) || ' ' || LEFT(split_part(c.name, ' ', -1), 1) || '.'
END AS customer_display_name
```

`customers` is joined with `LEFT JOIN ... AND c.shop_id = pr.shop_id` — the `shop_id` equality on the JOIN prevents cross-tenant name leakage even if RLS GUC were absent.

---

## SQL queries

All queries run inside a single `withShopTx(pool, shopId, async tx => { ... })`. Three steps:

### Step 1 — product existence guard (sequential, runs first)

```sql
SELECT 1 FROM products
WHERE id = $1
  AND shop_id = $2
  AND published_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
```

Zero rows → `throw new NotFoundException({ code: 'catalog.product_not_found' })`.

### Step 2 — reviews with PII redaction (after guard passes)

```sql
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
```

Uses partial index `idx_product_reviews_public (shop_id, product_id, created_at DESC) WHERE is_publicly_visible = TRUE` (added in migration 0070).

### Step 3 — rating breakdown (parallel with Step 2 via `Promise.all`)

```sql
SELECT rating, COUNT(*)::int AS cnt
FROM product_reviews
WHERE shop_id = $1
  AND product_id = $2
  AND is_publicly_visible = TRUE
GROUP BY rating
```

`total` is derived as the sum of all `cnt` values. `ratingBreakdown` is built by keying the result rows; missing ratings default to `0`.

---

## Implementation location

### New types
**File:** `packages/customer-shared/src/catalog-types.ts`
Add `PublicReviewItem` and `PublicReviewsResponse`. Check for existing `ReviewItem` placeholder from A4 — replace if shape differs.

### New service method
**File:** `apps/api/src/modules/catalog/catalog.service.ts`

```ts
// eslint-disable-next-line goldsmith/no-raw-shop-id-param
async getPublicProductReviews(params: {
  shopId: string;
  productId: string;
  page: number;
  limit: number;
}): Promise<PublicReviewsResponse>
```

Follows same `withShopTx` + EXISTS guard + `Promise.all` pattern as `getProduct` and `listPublicImages`.

### New controller handler
**File:** `apps/api/src/modules/catalog/catalog.controller.ts`

```ts
@Get('products/:id/reviews')
@SkipAuth()
@SkipTenant()
@Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
async getProductReviews(
  @Param('id', new ParseUUIDPipe()) productId: string,
  @Headers('x-tenant-id') shopId: string,
  @Query('page') page = '1',
  @Query('limit') limit = '10',
): Promise<PublicReviewsResponse>
```

`CatalogService` is already injected — no new DI wiring. Route registered after `products/:id` (NestJS most-specific-first matching handles sub-paths correctly).

---

## Test assertions — Red phase (all must be written before any implementation)

**File:** `apps/api/test/catalog/reviews-visibility.integration.test.ts`
Remove `describe.skip` from the Phase B block and add the following 8 assertions. All must **fail** before Green begins.

| # | Assertion | Mechanism |
|---|-----------|-----------|
| 1 | `is_publicly_visible=FALSE rows excluded` | Seed 2 reviews (TRUE + FALSE); `items.length === 1` |
| 2 | `cross-tenant review isolation` | shopA context + shopB productId → 404 |
| 3 | `PII: full name → first + initial` | `name='Priya Sharma'` → `customerDisplayName === 'Priya S.'` |
| 4 | `PII: single-token name` | `name='Rekha'` → `customerDisplayName === 'Rekha'` |
| 5 | `PII: deleted customer → Anonymous` | LEFT JOIN miss (no customers row) → `customerDisplayName === 'Anonymous'` |
| 6 | `ratingBreakdown counts only visible` | 3 visible + 2 hidden; `total === 3`, breakdown sums to 3 |
| 7 | `partial index used in EXPLAIN` | `EXPLAIN` output `ILIKE '%idx_product_reviews_public%'` |
| 8 | `limit capped at 50` | `?limit=200` → `items.length ≤ 50` |

**Additional tests** (coverage, not in the 8 mandatory):
- Product not found (wrong shop_id) → 404
- Non-UUID `:id` → 400
- Missing `x-tenant-id` header → 400
- Product exists but zero public reviews → `{ items: [], total: 0, ratingBreakdown: {1:0,...} }` (not 404)
- Suspended tenant → 404

---

## Non-negotiable floor

- `WHERE is_publicly_visible = TRUE` must be in the SQL `WHERE` clause — never filtered in application code after fetch. If the column is absent (pre-migration state), the query fails loud.
- `customer_id`, raw `name`, `email`, `phone` must never appear in the response shape or serialised output.
- `withShopTx` wraps all queries — RLS active under `app_user`.
- Product existence check runs before any review fetch — fail fast, no data leaked.
- Input validation: `ParseUUIDPipe` on `:id`; `limit` capped at 50.

---

## Review gates

Both required before `git push`. Run in parallel after all tests pass:

1. `codex review --base main` → write `.codex-review-passed`
   - If Codex fails in Windows worktree, run from `C:\Alok\Business Projects\Goldsmith` against this branch ref (per `feedback_codex_worktree_clm.md`)
2. `/security-review` on HEAD → write `.security-review-passed`
   - Key checks: PII redaction completeness, `is_publicly_visible` filter enforced at SQL, cross-tenant isolation, UUID input validation, no `customer_id` in response

---

## Runtime smoke test

After both gates pass and before push:

```bash
curl -H "x-tenant-id: <anchor-dev-uuid>" \
  "http://localhost:3000/api/v1/catalog/products/<product-id>/reviews?page=1&limit=5"
```

Verify:
- `customerDisplayName` is redacted (e.g. `"Priya S."`, not `"Priya Sharma"`)
- No `customerId`, `email`, or `phone` fields in any item
- `is_publicly_visible=FALSE` review absent
- `ratingBreakdown` values sum to `total`

---

## Known pre-existing issue (do not fix in B4)

`reviews.repository.ts:51` references `c.full_name` — but `customers` table has `c.name` (single column, `0028_customers.sql`). This is a bug in the shopkeeper authenticated read path. It is **out of scope** for B4. B4's public path uses `c.name` correctly. Log in a follow-up issue.
