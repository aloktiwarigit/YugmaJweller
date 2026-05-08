# Story B2+B5+B6+B7 — New catalog endpoints + storefront-config + recommendations + BullMQ jobs

Worktree: `C:\gs-stf-b2` · Branch: `feat/catalog-api-b2b5b6b7` · Base: `main` (5625d31) · Phase: B · **Class: B** (new read-only public endpoints + background jobs; no auth/money/RLS on new surfaces)

**Dependency**: B1+B3 (`feat/catalog-filters-b1b3`) must merge to main first. This branch stacks on top of that work — the same stacking pattern used in Phase A. Do not start implementation until B1+B3 is done and its squash commit is in origin/main. Then rebase this branch: `git rebase main` (drops the prior squash, replays only B2B5B6B7 commits).

---

## Read order (mandatory)

1. `C:\Users\alokt\.claude\CLAUDE.md`
2. `C:\gs-stf-b2\CLAUDE.md`
3. `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md`
4. `C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md` — §"API contract · New endpoints" and §"Phase B"
5. `docs\AGENT-START-HERE.md` → `docs\current-implementation-status.md`
6. **`apps\api\src\modules\catalog\catalog.service.ts`** — read the B1+B3 version (after stacking); this is your foundation
7. **`apps\api\src\modules\catalog\catalog.controller.ts`** — existing endpoint patterns you will add to
8. `apps\api\src\modules\catalog\catalog.module.ts` — check what's registered
9. `packages\db\src\schema\collections.ts` — the collections table from A2
10. `packages\db\src\schema\shop-settings.ts` — has `storefront_config_json` from A5
11. `packages\shared\src\schemas\storefront-config.schema.ts` — `StorefrontConfigSchema` + `STOREFRONT_CONFIG_DEFAULTS`
12. `packages\customer-shared\src\catalog-types.ts` — `Collection`, `CatalogProductCard` types the responses must match
13. `packages\customer-shared\src\storefront-nav.ts` — `STOREFRONT_CATEGORY_TILES` tile data for the categories endpoint fallback
14. `apps\api\src\modules\jobs\` — see what BullMQ processors exist; follow their patterns for B7
15. `apps\api\src\modules\pricing\pricing.service.ts` — need to hook priceSnapshotRefresh dispatch here after rate update
16. `apps\api\src\modules\inventory\inventory.service.ts` — hook priceSnapshotRefresh on product create/edit

## Model tier

**Default: Sonnet 4.6.** Class B. No escalation trigger.

Announce turn 1: `Model tier: sonnet — Class B new catalog endpoints + BullMQ jobs. Current model: <X>. [Staying | Suggest /model sonnet]`

## Phase A+B1B3 context (what's already on main when you start)

- Phase A: migrations 0066–0070, `packages/customer-shared`, `packages/shared/storefront-config.schema.ts`
- B1+B3: `getProducts()` now supports purity/price/inStock/style/occasion/giftPersona/collection/sort filters; `primaryImage` in list response; `ImageKitTransformUrlBuilder.cardSrcset()` exists

## Stories in scope

### B2 — New catalog endpoints

All use the existing `@SkipAuth() @SkipTenant()` + `withShopTx(pool, shopId)` pattern. Tenant resolved from `x-tenant-id` header. Check `shops.status = 'ACTIVE'` (existing pattern in catalog.service.ts). Cache headers as specified.

#### `GET /api/v1/catalog/categories`
Response: `{ categories: CategoryNode[] }` where `CategoryNode = { id, name, name_hi, productCount }`. Derive from distinct `products.category_id + category_name` values with a COUNT(*) WHERE published_at IS NOT NULL. No new table needed — it's a GROUP BY on existing products. Cache: `public, max-age=900, stale-while-revalidate=3600`.

#### `GET /api/v1/catalog/collections`
Response: `{ items: Collection[] }` matching `Collection` type from `@goldsmith/customer-shared`. Joins `collections` (from A2) with a product COUNT. Only return `published_at IS NOT NULL` collections. Cache: `public, max-age=300, stale-while-revalidate=900`.

#### `GET /api/v1/catalog/collections/:slug`
Response: `Collection` (detail) + paginated products (same `CatalogProductCard` shape as `/products`). Reuse the `getProducts()` method with `collection = slug` filter (B1+B3 already handles this). Cache: `public, max-age=120, stale-while-revalidate=300`.

#### `GET /api/v1/catalog/products/featured`
Response: `CatalogProductCard[]` (limit 12 default, max 20 via `?limit`). ORDER BY `featured_score DESC, published_at DESC`. Only products with `featured_score > 0`. Cache: `public, max-age=300, stale-while-revalidate=900`.

#### `GET /api/v1/catalog/products/new-arrivals`
Response: `CatalogProductCard[]` (limit 12). ORDER BY `published_at DESC`. Only products published in last 30 days. Cache: `public, max-age=300, stale-while-revalidate=900`.

#### `GET /api/v1/catalog/products/top-sellers`
Response: `CatalogProductCard[]` (limit 12). ORDER BY `(sales_count_30d * 2 + view_count_30d) DESC, published_at DESC`. Cache: `public, max-age=600, stale-while-revalidate=1800`.

**Note on the `/products/featured` path**: nest under `/api/v1/catalog/products/featured` — NOT `/api/v1/catalog/featured` — to keep the catalog prefix consistent. Verify no route conflict with `/products/:id` (`:id` would match `featured` if registered in wrong order; register static routes before param routes in the controller).

### B5 — `GET /api/v1/catalog/storefront-config`

Response: validated `StorefrontConfig` (from `@goldsmith/shared/schemas/storefront-config.schema.ts`). Deep-merge `STOREFRONT_CONFIG_DEFAULTS` with tenant's `shop_settings.storefront_config_json`. Parse with `StorefrontConfigSchema.parse()` — if JSON is malformed, return defaults and log a warning (don't 500). Cache: `public, max-age=600, stale-while-revalidate=1800`.

`STOREFRONT_CONFIG_DEFAULTS` was defined in A5's Zod schema work — check `packages/shared/src/schemas/storefront-config.schema.ts` for the export.

### B6 — `GET /api/v1/catalog/products/:id/recommendations`

Server-side implementation of the logic currently in `apps/customer-web/lib/storefront.ts:179-206` (`recommendedProducts()`). Algorithm:
1. Same `collection_id` as the product (if non-null) — up to 4 products
2. Same `style` (if non-null) — up to 2 products  
3. Same `metal` + `purity` + weight within ±20% — fill remaining up to 6 total
4. De-duplicate; exclude the product itself; return up to 6

Use `limit 6` SQL queries per tier, union in JS, de-duplicate in memory. All queries run inside `withShopTx`. Filter `published_at IS NOT NULL` and `quantity > 0`. Include `primaryImage` (reuse the join from B3). Cache: `public, max-age=300`.

After B6 ships: mark the client-side `recommendedProducts()` in `apps/customer-web/lib/storefront.ts` as `@deprecated — use GET /api/v1/catalog/products/:id/recommendations`.

### B7 — BullMQ jobs

Two new processors under `apps/api/src/modules/jobs/`:

#### `price-snapshot-refresh.processor.ts`
- Queue: `price-snapshot-refresh`
- Job data: `{ shopId: string }`
- Logic: UPDATE products SET price_snapshot_paise = <formula>, price_snapshot_at = NOW() WHERE shop_id = $1 AND published_at IS NOT NULL
- The formula: `ROUND(net_weight_g * rate_per_gram_paise + making_charge_paise)` where `rate_per_gram_paise` is fetched from the latest active rate for the product's metal. Join `shop_settings` for making charge %. If no rate available, skip (leave NULL).
- Debounce: use Redis NX key `price-snapshot-lock:${shopId}` with 5-minute TTL — if the key exists, skip enqueue. Pattern already exists in BullMQ workers (`loyalty-accrual.processor.ts` or similar — check existing processors).
- **Triggers to wire**: (a) `pricing.service.ts` after `setCurrentRates()` — emit a `PriceSnapshotRequested` event or directly enqueue; (b) `inventory.service.ts` after product create/update — enqueue with 30s delay to batch rapid edits.
- Worker class decorated with `@Processor('price-snapshot-refresh')`.

#### `sales-and-views-rollup.processor.ts`
- Queue: `sales-and-views-rollup`
- Job data: `{ shopId: string }`
- Logic: UPDATE products SET sales_count_30d = subquery-count-from-invoice_items-last-30d, view_count_30d = subquery-count-from-product_views-last-30d WHERE shop_id = $1
- Run as a CRON-style job: schedule once per shop per day (e.g., at 2am IST). Check existing CRON pattern (BullMQ `repeat` option in job registration).
- Idempotent: running twice in the same window just resets to the same values.

**Module wiring**: register both processors in `apps/api/src/modules/jobs/jobs.module.ts` (check if this file exists or if jobs are registered in `app.module.ts`). Follow the exact DI pattern of existing processors.

## Ceremony — Class B

1. **Brainstorming** — **skip** (all endpoints follow the established catalog service pattern; BullMQ jobs follow existing processor pattern). Note skip in first commit.
2. **Writing-plans** — 4–5 work streams at `docs\superpowers\plans\YYYY-MM-DD-story-b2b5b6b7.md`:
   - WS-A: B2 new endpoints (categories, collections list/detail, featured, new-arrivals, top-sellers) — controller + service methods + tests
   - WS-B: B5 storefront-config endpoint + defaults merge + parse error handling + tests
   - WS-C: B6 recommendations endpoint — multi-tier SQL + de-dup + tests
   - WS-D: B7 BullMQ jobs — price-snapshot + rollup + trigger wiring + tests
   - WS-E: Integration smoke — curl all 9 endpoints against dev API
3. **TDD on business logic** — recommendations algorithm, storefront-config defaults merge, price-snapshot formula all have observable behaviour → require tests. Simple passthrough endpoints (categories, featured) rely on typecheck + smoke.
4. **Review gate**:
   - Whole-branch `/code-review` mandatory.
   - `/security-review` — required: new public endpoints (attack surface) + BullMQ jobs that write to products table (any SQL injection risk in the rollup UPDATE).
   - Codex — batch with B1B3 for a combined Phase B Codex pass if budget allows.
5. **Runtime smoke** — curl all endpoints:
   ```
   curl "http://localhost:3001/api/v1/catalog/categories" -H "x-tenant-id: <uuid>"
   curl "http://localhost:3001/api/v1/catalog/collections" -H "x-tenant-id: <uuid>"
   curl "http://localhost:3001/api/v1/catalog/collections/daily-wear" -H "x-tenant-id: <uuid>"
   curl "http://localhost:3001/api/v1/catalog/products/featured" -H "x-tenant-id: <uuid>"
   curl "http://localhost:3001/api/v1/catalog/products/new-arrivals" -H "x-tenant-id: <uuid>"
   curl "http://localhost:3001/api/v1/catalog/products/top-sellers" -H "x-tenant-id: <uuid>"
   curl "http://localhost:3001/api/v1/catalog/products/<id>/recommendations" -H "x-tenant-id: <uuid>"
   curl "http://localhost:3001/api/v1/catalog/storefront-config" -H "x-tenant-id: <uuid>"
   ```
6. **Code-truth audit** — `git grep` for each new endpoint path string in the controller before claiming complete.

## Non-negotiable floor

- **Static routes before param routes**: in NestJS, `GET /products/featured` must be registered BEFORE `GET /products/:id` or NestJS will match `featured` as an `:id`. Verify route order in the controller.
- **`withShopTx` on every new service method** — no raw pool queries.
- **Storage_key never in any response** — same rule as B1B3.
- **BullMQ processor DI pattern**: check existing processors for `@Inject(Pool)` vs `@Inject(DRIZZLE)` token — use the same pattern. Per memory `feedback_import_type_nestjs_di.md`, never `import type` for injected tokens.
- **Rollup job must not hold a long-running transaction**: the sales/views rollup touches potentially thousands of rows. Use a batched UPDATE or a SET-based UPDATE (not row-by-row). Check Postgres query plan.

## Pre-flight

```
cd C:\gs-stf-b2
# Wait for B1+B3 to land on origin/main first, then:
git pull --rebase origin main  # or: git rebase main (if B1B3's squash is now in origin/main)
pnpm install --frozen-lockfile
pnpm --filter @goldsmith/api typecheck
pnpm --filter @goldsmith/api test --run apps/api/src/modules/catalog/
```

Do not write any code until B1+B3 is merged and rebased.

## Dispatch prompt

```
You are starting Story B2+B5+B6+B7 in worktree C:\gs-stf-b2 on branch feat/catalog-api-b2b5b6b7. This is Class B (new public catalog endpoints + storefront-config + recommendations + BullMQ jobs) per CLAUDE.md ceremony tiering.

IMPORTANT: This branch depends on B1+B3 landing on main first. Check that git log main shows the B1+B3 catalog-filters commit before proceeding. If not present, wait.

Read in order:
1. C:\Users\alokt\.claude\CLAUDE.md
2. C:\gs-stf-b2\CLAUDE.md
3. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md
4. C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md
5. C:\gs-stf-b2\STORY-B2B5B6B7-BRIEF.md

Announce model tier on turn 1. Run pre-flight (including git rebase main to pick up B1+B3). Do not write code until pre-flight passes.

Brainstorming skipped (template-following). Go straight to /superpowers:writing-plans: 4–5 work streams covering B2 endpoints, B5 storefront-config, B6 recommendations, B7 BullMQ jobs.

No new migrations. Key constraints: static routes before param routes in NestJS controller, withShopTx on every service method, never expose storage_key, BullMQ processor DI pattern must match existing processors.

/security-review required before push. Whole-branch /code-review required.

Reply with model-tier announcement, confirmation that B1+B3 is in main, pre-flight result, and writing-plans structure.
```

## Sister worktrees

- `C:\gs-stf-b1` (`feat/catalog-filters-b1b3`) — **must merge before you start**. Stack your work on top.
- `C:\gs-stf-b3` (`feat/reviews-public-b4`) — independent, runs in parallel. Class A PII story.
