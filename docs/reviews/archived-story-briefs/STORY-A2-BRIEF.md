# Story A2 — Collections + collection_products tables

Worktree: `C:\gs-stf-2` · Branch: `feat/storefront-collections-a2` · Base: `main` (0343b8c) · Phase: A · **Class: A** (new RLS-enforced tenant tables; auth/RLS context-quarantine = fresh session required)

---

## Read order (mandatory)

1. `C:\Users\alokt\.claude\CLAUDE.md`
2. `C:\gs-stf-2\CLAUDE.md`
3. `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` (especially `feedback_spec_lessons_need_plan_assertions.md`, `feedback_codex_worktree_clm.md`)
4. `C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md` — overarching plan; this story is A2 within Phase A
5. `docs\AGENT-START-HERE.md` then `docs\current-implementation-status.md`
6. `packages\db\src\migrations\0014_inventory_base.sql` — RLS pattern
7. `packages\db\src\migrations\0058_product_images_tenant_fk.sql` — composite FK pattern that prevents cross-tenant FK bypass
8. `packages\db\src\migrations\0047_reviews_wishlist.sql` — recent example of customer-readable RLS
9. `packages\db\src\schema\products.ts` — to add `collection_id` FK after A1+A3 lands

## Model tier

**Default: Sonnet 4.6**. Escalate to Opus only if Codex finds > 8 issues in a round.

Announce on turn 1: `Model tier: sonnet — Class A new-table migration with RLS + composite FK + TDD. Current model: <X>. [Staying | Suggest /model sonnet]`

## Story scope

### A2 — `packages\db\src\migrations\0067_collections.sql`

#### Table 1: `collections`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE
slug            TEXT NOT NULL
title_hi        TEXT NOT NULL
title_en        TEXT
subtitle_hi    TEXT
hero_image_id   UUID  -- composite FK below; NOT a plain FK
sort_order      INT NOT NULL DEFAULT 0
is_premium      BOOLEAN NOT NULL DEFAULT FALSE
published_at    TIMESTAMPTZ
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (shop_id, slug)
```

**Composite FK on `hero_image_id`** (mirrors `0058_product_images_tenant_fk.sql`):
```
FOREIGN KEY (shop_id, hero_image_id) REFERENCES product_images (shop_id, id) ON DELETE SET NULL
```
This requires `product_images` to have a unique key on `(shop_id, id)` — verify via `\d product_images` that `0058` left this in place.

Indexes:
- `(shop_id, sort_order) WHERE published_at IS NOT NULL` — listing hot path

RLS:
- `ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;`
- `CREATE POLICY tenant_isolation ON collections USING (shop_id = current_setting('app.current_shop_id', true)::uuid)`
- Grants: `GRANT SELECT, INSERT, UPDATE, DELETE ON collections TO app_user`

#### Table 2: `collection_products`
```
shop_id        UUID NOT NULL
collection_id  UUID NOT NULL
product_id     UUID NOT NULL
sort_order     INT NOT NULL DEFAULT 0
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
PRIMARY KEY (shop_id, collection_id, product_id)
FOREIGN KEY (shop_id, collection_id) REFERENCES collections (shop_id, id) ON DELETE CASCADE
FOREIGN KEY (shop_id, product_id) REFERENCES products (shop_id, id) ON DELETE CASCADE
```

This requires `products` and `collections` to expose `(shop_id, id)` as a unique key. `products` already has it via `0058` migration approach. `collections` PK is on `id` alone — add `UNIQUE (shop_id, id)` so the composite FK can target it.

RLS + grants: same pattern as `collections`.

Indexes:
- `(shop_id, collection_id, sort_order)` — products-in-collection list
- `(shop_id, product_id)` — reverse lookup (products' collections)

### Drizzle schema (NEW FILES)

- `packages\db\src\schema\collections.ts` — define both tables with Drizzle types
- Update `packages\db\src\schema\index.ts` to export

**Note on `products.collection_id`**: The plan says A1 owns this column. **Do NOT add `collection_id` in this story.** It lands in worktree `C:\gs-stf-1` (A1+A3). Coordinate via merge order: A1 lands first (migration 0066), then this story's `collection_products` join is the canonical link. Single-FK `products.collection_id` is a denormalization for "primary collection per product" — not required for this story's MVP.

## Ceremony — Class A

1. **Brainstorming** — spec at `docs\superpowers\specs\YYYY-MM-DD-story-a2-collections.md`. Lock:
   - Whether `slug` should be enforced lowercase / kebab-case at the DB layer or app layer
   - Whether `hero_image_id` truly needs to come from `product_images` (vs a separate `collection_images` table) — plan says reuse product_images for CDN/RLS/scan_status; confirm
   - Cascade semantics on collection delete: hard-delete `collection_products`, but products themselves untouched
2. **Writing-plans** — work-stream plan at `docs\superpowers\plans\YYYY-MM-DD-story-a2-collections.md`. **5 work streams**:
   - WS-A: Migration `0067` DDL + RLS + composite FKs + indexes
   - WS-B: Drizzle schema + types
   - WS-C: Tenant-isolation tests (cross-tenant FK bypass attempts)
   - WS-D: Cascade behavior tests (collection delete → join row delete; product delete → join row delete)
   - WS-E: Index performance smoke (EXPLAIN on collection listing + products-in-collection)
3. **Mandatory test assertions** (per memory `feedback_spec_lessons_need_plan_assertions.md`):
   - `'collections.hero_image_id composite FK blocks cross-tenant assignment'` — set `app.current_shop_id = $shop_a`; insert `collections` with `hero_image_id` belonging to `$shop_b`; expect failure.
   - `'collection_products composite FK blocks cross-tenant linkage'` — attempt to insert `(shop_a, collection_a, product_b)`; expect failure.
   - `'RLS blocks cross-tenant collection SELECT'` — `app_user` with `shop_a` context cannot SELECT `shop_b` collections.
   - `'cascade deletes join rows but not products'` — delete a collection, verify `collection_products` rows for it are gone, but `products` rows remain.
   - `'unique (shop_id, slug) enforced'` — second insert with same slug in same shop fails; same slug in different shop succeeds.
4. **TDD per work stream** — Red → Green → Refactor.
5. **Review gate (parallel before push):** `codex review --base main` + `/security-review`. Per memory `feedback_codex_worktree_clm.md`, if codex fails in Windows worktree, run from `C:\Alok\Business Projects\Goldsmith` against this branch as a remote ref, OR substitute with `/security-review` + Opus review chain (note in commit).
6. **Runtime smoke** — apply migration to local Postgres. Insert a sample collection + 3 products; verify RLS on cross-tenant probes.

## Non-negotiable floor

- **Composite `(shop_id, ...)` FK pattern** is the single most important security invariant of this story. Plain FKs like `FOREIGN KEY (hero_image_id) REFERENCES product_images(id)` would allow cross-tenant references at the DB layer. Always use the composite form.
- **RLS + FORCE on every new table.** No exceptions.
- **No FLOAT.** Not relevant for this story but verify nothing was accidentally introduced.
- **Code-truth audit.** `git grep` for table names + FK columns in Drizzle + migration + tests before claiming complete.

## Pre-flight

```
cd C:\gs-stf-2
pnpm install --frozen-lockfile
pnpm --filter @goldsmith/db build
pnpm --filter @goldsmith/api typecheck
psql $DATABASE_URL -c "\d product_images" | grep -E "shop_id.*id|id.*shop_id"
```

The last command verifies `product_images` has the `(shop_id, id)` unique key needed for the composite FK target.

## Dispatch prompt

```
You are starting Story A2 in worktree C:\gs-stf-2 on branch feat/storefront-collections-a2. This is Class A (new RLS-enforced tenant tables) per CLAUDE.md ceremony tiering.

Read in order:
1. C:\Users\alokt\.claude\CLAUDE.md
2. C:\gs-stf-2\CLAUDE.md
3. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md
4. C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md
5. C:\gs-stf-2\STORY-A2-BRIEF.md

Announce model tier on turn 1.

Run pre-flight from the brief. Do not write code until it passes.

Then /superpowers:brainstorming → /superpowers:writing-plans. Migration number reserved: 0067 only. Do not consume 0066 (worktree gs-stf-1) or 0068 (worktree gs-stf-1) or 0069/0070 (worktree gs-stf-3).

Class A ceremony is non-negotiable: TDD per work stream, codex review + /security-review parallel before push, runtime smoke. Use composite (shop_id, ...) FK pattern from migration 0058 — never plain FKs that could allow cross-tenant references. Mandatory test assertions are listed in the brief.

Reply with model-tier announcement, pre-flight result, and brainstorming plan.
```

## Sister worktrees

- `C:\gs-stf-1` (A1+A3, migrations 0066+0068) — products columns + primary_image_id. Adds `products.collection_id` FK to your `collections` table; merges first.
- `C:\gs-stf-3` (A5+A6, migrations 0069+0070) — independent.
- `C:\gs-stf-4` (A4, no migration) — independent.

Merge order: 0066+0068 → 0067 (this) → 0069+0070 → A4.
