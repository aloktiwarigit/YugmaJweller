# Story A1+A3 — Products storefront columns + primary_image_id

Worktree: `C:\gs-stf-1` · Branch: `feat/storefront-schema-a1a3` · Base: `main` (0343b8c) · Phase: A (Schema foundation) · **Class: A** (RLS-touching schema; auth/RLS context-quarantine = fresh session required)

This brief is the input to a fresh Claude Code session. Open a new terminal at `C:\gs-stf-1`, start `claude code`, and paste the dispatch prompt at the bottom.

---

## Read order (mandatory before any change)

1. `C:\Users\alokt\.claude\CLAUDE.md` — global agency rules (tier triggers, ceremony, Codex budget posture)
2. `C:\gs-stf-1\CLAUDE.md` — Goldsmith project rules (stack, RLS, Direction 5, ceremony A/B/C)
3. `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` — feedback files (especially: `feedback_spec_lessons_need_plan_assertions.md`, `feedback_codex_worktree_clm.md`, `feedback_codex_iteration_depth_for_structural_code.md`, `feedback_audit_pattern_pool_not_tx.md`, `feedback_import_type_nestjs_di.md`, `feedback_tsx_inject_di.md`)
4. `C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md` — the approved overarching plan (this story is A1+A3 within Phase A)
5. `docs\AGENT-START-HERE.md` then `docs\current-implementation-status.md` — current code-backed state baseline
6. `packages\db\src\migrations\0014_inventory_base.sql` and `0058_product_images_tenant_fk.sql` — RLS pattern + composite-FK pattern this story must mirror
7. `packages\db\src\schema\products.ts` — current Drizzle schema for products
8. `apps\api\src\modules\catalog\catalog.service.ts` and `apps\api\src\modules\inventory\product-images.service.ts` — surfaces this story will touch in Phase B

## Model tier

**Default: Sonnet 4.6** (per-story Class A implementation, TDD red→green→refactor — Sonnet is the right tier per `CLAUDE.md` triggers). Escalate to **Opus 4.7** only if: (a) the trigger maintenance logic for `primary_image_id` produces concurrency edge cases that need deeper reasoning, or (b) Codex review surfaces > 8 findings in a single round (per memory `feedback_codex_iteration_depth_for_structural_code.md`).

Announce on turn 1: `Model tier: sonnet — Class A schema migration with TDD per work stream. Current model: <X>. [Staying | Suggest /model sonnet]`

## Story scope — what this branch ships

### A1 — `packages\db\src\migrations\0066_products_storefront_columns.sql`
Add to `products`:
- `style TEXT` with CHECK in `('ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS','DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS')`, nullable
- `occasion TEXT[]` DEFAULT `'{}'` NOT NULL
- `gift_persona TEXT[]` DEFAULT `'{}'` NOT NULL
- `featured_score SMALLINT` CHECK 0–100 DEFAULT 0 NOT NULL
- `sales_count_30d INT` DEFAULT 0 NOT NULL
- `view_count_30d INT` DEFAULT 0 NOT NULL
- `price_snapshot_paise BIGINT` nullable
- `price_snapshot_at TIMESTAMPTZ` nullable
- `published_search_idx_at TIMESTAMPTZ` nullable

Indexes:
- partial: `(shop_id, style) WHERE published_at IS NOT NULL`
- GIN on `occasion`, GIN on `gift_persona`
- partial: `(shop_id, featured_score DESC) WHERE published_at IS NOT NULL AND featured_score > 0`
- partial: `(shop_id, price_snapshot_paise) WHERE price_snapshot_paise IS NOT NULL AND published_at IS NOT NULL`
- composite: `(shop_id, (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC) WHERE published_at IS NOT NULL` — name `products_top_sellers_idx`
- `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- GIN trigram: `(coalesce(sku,'') || ' ' || coalesce(metal,'') || ' ' || coalesce(purity,'')) gin_trgm_ops WHERE published_at IS NOT NULL`

### A3 — `packages\db\src\migrations\0068_products_primary_image.sql`
- Add `products.primary_image_id UUID` FK to `product_images(id)` ON DELETE SET NULL
- Composite FK enforcement on `(shop_id, primary_image_id)` mirroring the pattern from `0058_product_images_tenant_fk.sql` so the FK cannot bypass RLS via cross-tenant image associations
- Backfill: `UPDATE products SET primary_image_id = (SELECT id FROM product_images pi WHERE pi.product_id = products.id AND pi.scan_status = 'clean' ORDER BY sort_order ASC LIMIT 1)`
- Trigger function `maintain_products_primary_image()` recomputes `products.primary_image_id` on `product_images` INSERT/UPDATE-of-sort_order/DELETE/UPDATE-of-scan_status. Use `SECURITY INVOKER` so RLS stays in force.

**Migration numbers reserved at phase kickoff:** `0066` (A1), `0068` (A3). `0067` is reserved for A2 in worktree `C:\gs-stf-2`. Do not consume `0067`.

**Drizzle schema changes:** update `packages\db\src\schema\products.ts` to mirror the new columns. Keep types tight (`text` with enum union for `style`, `text` array for `occasion`/`gift_persona`, `bigint` for paise, `timestamp` with `mode: 'date'`).

## Ceremony — Class A non-negotiables

1. **Brainstorming** (`/superpowers:brainstorming`) → spec file at `docs\superpowers\specs\YYYY-MM-DD-story-a1a3-storefront-schema.md`. Lock open questions. Pay attention to:
   - Does `style` need to be an enum type vs CHECK constraint? (Plan says CHECK; confirm.)
   - Should `occasion`/`gift_persona` be lookup tables instead of TEXT[]? (Plan says arrays; confirm scale and query pattern.)
   - Trigger or app-level maintenance for `primary_image_id`? (Plan says trigger with `SECURITY INVOKER`; confirm and document why.)
2. **Writing-plans** (`/superpowers:writing-plans`) → work-stream plan at `docs\superpowers\plans\YYYY-MM-DD-story-a1a3-storefront-schema.md`. Use the template at `docs\superpowers\plans\_TEMPLATE-work-stream.md`. **Target 5–7 work streams**:
   - WS-A: Drizzle schema changes + migration `0066`
   - WS-B: Migration `0068` + composite FK + backfill + trigger
   - WS-C: Trigger maintenance integration tests
   - WS-D: RLS + cross-tenant safety tests
   - WS-E: Index performance smoke (EXPLAIN on filter+sort queries with seeded data)
   - WS-F: Drizzle types + repo helpers consumed in Phase B
3. **Mandatory test assertions** (per memory `feedback_spec_lessons_need_plan_assertions.md` — every spec-level lesson must produce an explicit plan test):
   - `'primary_image_id FK does not bypass RLS via cross-tenant image'` — set `app.current_shop_id = $shop_a`; attempt to set `products.primary_image_id` to an image owned by `$shop_b`; expect failure.
   - `'maintain trigger respects RLS under SECURITY INVOKER'` — `app_user` deletes a `product_images` row in `$shop_a`; expect `products.primary_image_id` recompute to occur within `$shop_a` only.
   - `'CHECK constraint blocks invalid style'` — insert with `style='UNKNOWN'`; expect failure.
   - `'GIN occasion index used by ANY(...)'` — `EXPLAIN SELECT ... WHERE 'WEDDING' = ANY(occasion)` shows GIN bitmap.
   - `'composite top-sellers index used by ORDER BY'` — `EXPLAIN ... ORDER BY (sales_count_30d * 2 + view_count_30d) DESC` shows index scan.
   - `'pg_trgm index used by similarity'` — `EXPLAIN ... WHERE sku % 'AB-1042'` shows GIN scan.
4. **TDD per work stream** — Red (failing test) → Green (minimal change) → Refactor. No skipping the red phase. Use the existing tenant-isolation harness (`pnpm --filter @goldsmith/api test:tenant-isolation`).
5. **Review gate (parallel before push):**
   - `codex review --base main` — **note: per memory `feedback_codex_worktree_clm.md`, codex review may fail in Windows worktrees due to CLM**. If it fails, run codex from the main repo path (`C:\Alok\Business Projects\Goldsmith`) against this branch via remote ref, OR substitute with `/security-review` + Opus review chain (note in commit message).
   - `/security-review` on HEAD — must produce `.security-review-passed` marker.
6. **Runtime smoke** — apply migration to local Postgres, run a tenant-isolation integration test that exercises the new columns + trigger end-to-end. `psql $DATABASE_URL -f packages/db/src/migrations/0066_*.sql` and `0068_*.sql`; verify rollback DDL is also valid by running on a scratch DB.
7. **Commit cadence** — small, surface-grouped commits. Migration in one commit; Drizzle schema in another; tests in a third. Never amend a published commit.

## Non-negotiable floor (must hold)

- **No FLOAT for weights.** This story doesn't add weight columns but the existing `gross_weight_g`, `net_weight_g` MUST remain `DECIMAL(10,3)` — verify no migration changes their type accidentally.
- **RLS on every tenant-scoped table.** `products` already has RLS; new columns inherit. Any new index that scans across tenants for ranking must be backed by `(shop_id, ...)` composite to prevent cross-tenant leakage in query plans.
- **Composite `(shop_id, ...)` FK pattern from `0058`.** Use it for `primary_image_id` so a malicious `UPDATE products SET primary_image_id = $b_image_id WHERE id = $a_product_id` is blocked at the DB layer, not just the application layer.
- **Trigger `SECURITY INVOKER`.** Never `SECURITY DEFINER` on the maintain trigger — that would let the trigger bypass RLS and corrupt cross-tenant state.
- **No `import type` for NestJS DI** (memory `feedback_import_type_nestjs_di.md`). Not relevant for this DB-only story but flag if any module wiring crosses the line.
- **No Goldsmith brand on customer surfaces** — N/A for this story but never violate.
- **Code-truth audit before claiming complete.** `git grep` for the new column names in Drizzle schema + migration + tests. Memory + commit messages are NOT proof.

## Pre-flight (run before brainstorming)

```
cd C:\gs-stf-1
pnpm install --frozen-lockfile
pnpm --filter @goldsmith/api typecheck
pnpm --filter @goldsmith/db build
pnpm --filter @goldsmith/api test --run apps/api/src/modules/catalog/catalog.service.spec.ts
```

All four must pass before you write a single new line. If any fail, stop and diagnose root cause — don't paper over with `--no-verify` or skip-flags.

## Dispatch prompt (paste into the fresh session)

```
You are starting Story A1+A3 in worktree C:\gs-stf-1 on branch feat/storefront-schema-a1a3. This is Class A (RLS-touching schema migration) per CLAUDE.md ceremony tiering.

Read in order:
1. C:\Users\alokt\.claude\CLAUDE.md
2. C:\gs-stf-1\CLAUDE.md
3. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md
4. C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md (the approved storefront plan; this story is A1+A3)
5. C:\gs-stf-1\STORY-A1A3-BRIEF.md (the per-story brief — scope, ceremony, mandatory tests)

Then announce model tier on turn 1.

Then run the pre-flight commands in the brief. Do not write code until pre-flight passes.

Then start /superpowers:brainstorming to lock the spec, followed by /superpowers:writing-plans to produce the work-stream plan. Migration numbers reserved: 0066 (A1) and 0068 (A3). Do not consume 0067 — that's reserved for A2 in worktree C:\gs-stf-2.

Class A ceremony is non-negotiable: TDD per work stream, codex review + /security-review in parallel before push, runtime smoke against local Postgres. Per memory feedback_codex_worktree_clm.md, codex may fail in Windows worktrees — if so, run codex from C:\Alok\Business Projects\Goldsmith against this branch as remote ref.

The mandatory test assertions are listed in the brief under "Ceremony — Class A non-negotiables, step 3". Every one of those tests must exist in the work-stream plan with an explicit Red phase.

Reply with the model-tier announcement, the result of pre-flight, and your plan for the brainstorming session.
```

## Sister worktrees (for context, not your concern)

- `C:\gs-stf-2` (`feat/storefront-collections-a2`) — A2 collections + collection_products tables + RLS, migration `0067`. **Independent of this story.**
- `C:\gs-stf-3` (`feat/storefront-config-a5a6`) — A5 storefront-config JSONB + A6 reviews visibility, migrations `0069` + `0070`. **Independent.**
- `C:\gs-stf-4` (`feat/customer-shared-a4`) — A4 packages/customer-shared (types + helpers + storefront nav data + 6 illustrated SVG fallbacks). Pure Class B, no migration. **Independent of this story but consumed by Phase B onwards.**

The 4 worktrees should not touch each other. Migration numbers are pre-assigned. Merge order respects numeric sequence: 0066/0068 → 0067 → 0069/0070 → A4.
