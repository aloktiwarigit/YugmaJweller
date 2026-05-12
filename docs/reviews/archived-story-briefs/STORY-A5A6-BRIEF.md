# Story A5+A6 — Storefront-config JSONB + reviews visibility

Worktree: `C:\gs-stf-3` · Branch: `feat/storefront-config-a5a6` · Base: `main` (0343b8c) · Phase: A · **Class: A** (PII surface + tenant config; auth/RLS context-quarantine = fresh session required)

---

## Read order (mandatory)

1. `C:\Users\alokt\.claude\CLAUDE.md`
2. `C:\gs-stf-3\CLAUDE.md`
3. `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` (especially `feedback_spec_lessons_need_plan_assertions.md`, `feedback_codex_worktree_clm.md`, project memory on DPDPA — search for `feedback_dpdpa` or `project_story_6_8`)
4. `C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md` — overarching plan; this story is A5+A6 within Phase A
5. `docs\AGENT-START-HERE.md` then `docs\current-implementation-status.md`
6. `packages\db\src\migrations\0006_shop_settings.sql` — original shop_settings table; A5 adds a column
7. `packages\db\src\migrations\0047_reviews_wishlist.sql` — original product_reviews table; A6 adds a column
8. `apps\api\src\modules\reviews\reviews.repository.ts` — current public read path; needs `is_publicly_visible` filter in Phase B
9. `packages\shared\src\` — see if a Zod validator pattern for JSONB configs already exists (e.g., for shop notification prefs)

## Model tier

**Default: Sonnet 4.6**. Escalate to Opus only if Codex finds > 8 issues in a round, or if the JSONB Zod schema design produces deep type-inference questions.

Announce on turn 1: `Model tier: sonnet — Class A column additions with Zod validator + RLS-aware tests. Current model: <X>. [Staying | Suggest /model sonnet]`

## Story scope

### A5 — `packages\db\src\migrations\0069_shop_storefront_config.sql`

Add `storefront_config_json JSONB NOT NULL DEFAULT '{}'::jsonb` to `shop_settings`. The table is already RLS-enforced (verify via `\d shop_settings`); no new policy needed.

**Zod schema** (`packages\shared\src\storefront-config.schema.ts`, NEW):
```ts
export const StorefrontConfigSchema = z.object({
  heroBanners: z.array(z.object({
    imageId: z.string().uuid(),
    headlineHi: z.string().min(1).max(120),
    headlineEn: z.string().max(120).optional(),
    ctaUrl: z.string().regex(/^\//, 'must be internal route'),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
  })).default([]),
  featuredCollectionIds: z.array(z.string().uuid()).default([]),
  premiumCollectionIds: z.array(z.string().uuid()).default([]),
  giftPersonaOverrides: z.array(z.object({
    persona: z.string(),
    href: z.string(),
    label: z.string(),
  })).default([]),
  brandPalette: z.object({
    accentMode: z.enum(['warm', 'cool', 'luxe']).optional(),
    heroPattern: z.enum(['devanagari-numerals', 'lotus', 'temple', 'none']).optional(),
  }).default({}),
  trustPillarsOverride: z.array(z.object({
    titleHi: z.string(),
    titleEn: z.string().optional(),
    descriptionHi: z.string(),
  })).default([]),
});
export type StorefrontConfig = z.infer<typeof StorefrontConfigSchema>;
```

The schema MUST be importable both by API (`apps/api`) and by `packages/customer-shared` (worktree `C:\gs-stf-4`) once that package lands. For Phase A, expose it from `packages/shared`.

**Default merge logic** (apply at API read time, not in DB): when `storefront_config_json = '{}'`, return a code-side default (Hindi-first BIS/HUID/exchange/buyback trust pillars per spec §12). The DB never auto-fills — keep it empty until tenant overrides.

### A6 — `packages\db\src\migrations\0070_product_reviews_visibility.sql`

Add `is_publicly_visible BOOLEAN NOT NULL DEFAULT TRUE` to `product_reviews`. Existing rows backfill to TRUE on default.

Indexes:
- Replace or extend the existing review-listing index with a partial: `(shop_id, product_id, created_at DESC) WHERE is_publicly_visible = TRUE`. Verify via `\di+ idx_product_reviews_*` what's already there from `0047`; do NOT drop the old one in this migration if other paths use it — instead add the partial alongside.

**No app-code change in this story** — the public reviews endpoint that uses this column lands in Phase B (story B4, worktree TBD). This story ships the column + index + tests only.

## Ceremony — Class A

1. **Brainstorming** — spec at `docs\superpowers\specs\YYYY-MM-DD-story-a5a6-storefront-config-reviews-visibility.md`. Lock:
   - Should `storefront_config_json` be split into separate columns (one per top-level key) for indexability? Plan says JSONB blob; confirm given JSONB GIN indexes are available if we need them later.
   - Default-merge behavior: code-side or DB-side? Plan says code-side; confirm.
   - DPDPA: should `is_publicly_visible` default to FALSE (opt-in) or TRUE (opt-out)? Plan says TRUE. Memory on DPDPA may have nuance.
2. **Writing-plans** — work-stream plan at `docs\superpowers\plans\YYYY-MM-DD-story-a5a6-storefront-config-reviews-visibility.md`. **5 work streams**:
   - WS-A: Migration `0069` (storefront_config_json column) + Drizzle schema update
   - WS-B: Migration `0070` (is_publicly_visible column + partial index) + Drizzle schema update
   - WS-C: Zod validator in `packages/shared/src/storefront-config.schema.ts` with exhaustive parse/round-trip tests
   - WS-D: Tenant-isolation tests (cross-tenant write/read of storefront_config_json blocked by RLS already on shop_settings)
   - WS-E: Reviews-visibility filter integration test (anticipating Phase B B4 — write the test now, mark `.skip` on the read-path API call until B4 ships, but the column + index must support it today)
3. **Mandatory test assertions** (per memory `feedback_spec_lessons_need_plan_assertions.md`):
   - `'storefront_config_json defaults to empty object'` — fresh shop_settings row has `'{}'::jsonb` not NULL.
   - `'storefront_config_json round-trips through Zod'` — write a config, read it, parse with `StorefrontConfigSchema`, all defaults applied for missing keys.
   - `'storefront_config_json rejects ctaUrl that is not internal'` — Zod validator throws on `'https://example.com/foo'`.
   - `'storefront_config_json RLS blocks cross-tenant write'` — shop_a context cannot UPDATE shop_b settings.
   - `'is_publicly_visible defaults to TRUE on existing rows'` — backfill verification.
   - `'partial index on (shop_id, product_id, created_at DESC) WHERE is_publicly_visible'` — `EXPLAIN SELECT * FROM product_reviews WHERE shop_id = $1 AND product_id = $2 AND is_publicly_visible ORDER BY created_at DESC LIMIT 10` shows index scan.
   - `'is_publicly_visible=FALSE row excluded from public listing index scan'` — set one review to FALSE, verify EXPLAIN does not return it.
4. **TDD per work stream** — Red → Green → Refactor.
5. **Review gate (parallel before push):** `codex review --base main` + `/security-review`. Per memory `feedback_codex_worktree_clm.md`, if codex fails in Windows worktree, run from main repo against this branch as remote ref, OR substitute with `/security-review` + Opus review chain (note in commit). **Security review is especially important here** because A6 touches a PII surface (reviews list).
6. **Runtime smoke** — apply both migrations to local Postgres. Verify shop_settings has the column with default `'{}'`; verify product_reviews has `is_publicly_visible` defaulting TRUE; verify the partial index exists via `\di product_reviews*`.

## Non-negotiable floor

- **DPDPA-aware default for `is_publicly_visible`.** The default is TRUE (preserves existing behavior — reviews were public before this column existed). A user opt-out flow happens in Phase B + admin work. Document this in the migration comment.
- **Zod schema co-located with shared types.** Don't put the validator in `apps/api` if it needs to also be consumable by `packages/customer-shared`.
- **JSONB defaults at DB layer.** `'{}'::jsonb` not NULL — avoids "is null vs is empty" ambiguity downstream.
- **No FLOAT, no cross-tenant queries** — reaffirm.
- **Code-truth audit.** `git grep` for `storefront_config_json` and `is_publicly_visible` in migration + Drizzle schema + Zod schema + tests.

## Pre-flight

```
cd C:\gs-stf-3
pnpm install --frozen-lockfile
pnpm --filter @goldsmith/db build
pnpm --filter @goldsmith/shared build
pnpm --filter @goldsmith/api typecheck
psql $DATABASE_URL -c "\d shop_settings" | head -30
psql $DATABASE_URL -c "\d product_reviews" | head -20
```

The last two confirm the existing tables and indexes — note the names so you don't collide.

## Dispatch prompt

```
You are starting Story A5+A6 in worktree C:\gs-stf-3 on branch feat/storefront-config-a5a6. This is Class A (PII surface + tenant config column additions) per CLAUDE.md ceremony tiering.

Read in order:
1. C:\Users\alokt\.claude\CLAUDE.md
2. C:\gs-stf-3\CLAUDE.md
3. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md
4. C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md
5. C:\gs-stf-3\STORY-A5A6-BRIEF.md

Announce model tier on turn 1.

Run pre-flight from the brief. Do not write code until it passes.

Then /superpowers:brainstorming → /superpowers:writing-plans. Migration numbers reserved: 0069 (A5), 0070 (A6). Do not consume 0066/0068 (worktree gs-stf-1) or 0067 (worktree gs-stf-2).

Class A ceremony is non-negotiable: TDD per work stream, codex review + /security-review parallel before push, runtime smoke. Particular attention to: (a) DPDPA-aware default of TRUE for is_publicly_visible documented in migration comment, (b) Zod schema co-located in packages/shared so it's reusable from packages/customer-shared once that lands, (c) partial index on product_reviews used by the future public-listing query.

Mandatory test assertions are listed in the brief. Reply with model-tier announcement, pre-flight result, and brainstorming plan.
```

## Sister worktrees

- `C:\gs-stf-1` (A1+A3, migrations 0066+0068) — independent of this story.
- `C:\gs-stf-2` (A2, migration 0067) — independent.
- `C:\gs-stf-4` (A4, no migration) — will eventually re-export `StorefrontConfigSchema` from `packages/shared` so customer-web/customer-mobile can validate at the edge. Coordinate via shared package boundary, not via files.

Merge order: 0066+0068 → 0067 → 0069+0070 (this) → A4.
