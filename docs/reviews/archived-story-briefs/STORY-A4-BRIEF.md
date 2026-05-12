# Story A4 — packages/customer-shared

Worktree: `C:\gs-stf-4` · Branch: `feat/customer-shared-a4` · Base: `main` (0343b8c) · Phase: A · **Class: B** (pure types + helpers + assets; no auth/money/RLS surface)

---

## Read order (mandatory)

1. `C:\Users\alokt\.claude\CLAUDE.md` — global rules + tier triggers
2. `C:\gs-stf-4\CLAUDE.md` — Goldsmith project rules; especially design constraints (Hindi-first, Direction 5, white-label, NEVER default to Inter)
3. `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` (especially `feedback_codex_worktree_clm.md`)
4. `C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md` — overarching plan; this story is A4 within Phase A
5. `docs\AGENT-START-HERE.md` then `docs\current-implementation-status.md`
6. `packages\ui-tokens\package.json` and `packages\ui-tokens\src\` — closest existing pure-TS package; mirror its structure (build via tsc, zero peer deps, ESM only)
7. `packages\shared\package.json` and exports — pattern for a workspace shared lib
8. `apps\customer-web\lib\api.ts` lines 4-83 — the type definitions to migrate INTO this package
9. `apps\customer-mobile\src\api\endpoints.ts` lines 11-77 — the type definitions to migrate INTO this package
10. `apps\customer-web\lib\storefront.ts` — helpers `formatInrFromPaise`, `productDisplayName`, `applyCatalogFilters`, `recommendedProducts`, `PRICE_BANDS`, `PURITY_FILTERS` to migrate

## Model tier

**Default: Sonnet 4.6**. This is a Class B template-following story (mirroring `packages/ui-tokens` shape). No reason to escalate.

Announce on turn 1: `Model tier: sonnet — Class B shared package extraction with TDD on helpers. Current model: <X>. [Staying | Suggest /model sonnet]`

## Story scope

### Phase 1 — package skeleton

```
packages/customer-shared/
├── package.json              # name: @goldsmith/customer-shared, workspace pnpm
├── tsconfig.json             # extends packages/ui-tokens/tsconfig.json
├── tsup.config.ts            # if other packages use tsup; else plain tsc
├── src/
│   ├── index.ts              # barrel
│   ├── catalog-types.ts      # CatalogProductCard, CatalogProductDetail, CatalogImage, CategoryNode, Collection
│   ├── storefront-types.ts   # StorefrontConfig (re-export from @goldsmith/shared once A5 ships its Zod schema), HomeSectionPayload
│   ├── storefront-nav.ts     # STOREFRONT_BROWSE_NAV, MEGA_MENU_CONTENT, STOREFRONT_CATEGORY_TILES, STOREFRONT_OCCASION_TILES, STOREFRONT_PREMIUM_TILES, STOREFRONT_GIFT_PERSONAS
│   ├── format.ts             # formatInrFromPaise, productDisplayName, purityLabel, metalLabel
│   ├── catalog-filters.ts    # PRICE_BANDS, PURITY_FILTERS, CATALOG_STYLES, CATALOG_OCCASIONS, CATALOG_GIFT_PERSONAS, CATALOG_SORTS, buildProductsHref
│   ├── illustrations/        # 6 SVG fallbacks
│   │   ├── ring.svg
│   │   ├── earring.svg
│   │   ├── pendant.svg
│   │   ├── bangle.svg
│   │   ├── necklace.svg
│   │   ├── silver.svg
│   │   └── index.ts          # categoryToFallbackSvg(categoryName: string): string
│   └── __tests__/
│       ├── format.test.ts
│       ├── storefront-nav.test.ts
│       └── illustrations.test.ts
└── README.md
```

### Phase 2 — type contract

The types must mirror what Phase B's API will return. Reference shapes from the plan §"Solution Architecture · API contract" and from existing `apps/customer-web/lib/api.ts`. Key types:

```ts
export interface CatalogProductCard {
  id: string;
  sku: string;
  metal: 'GOLD' | 'SILVER' | 'PLATINUM';
  purity: string; // '24K' | '22K' | ... | '925' | '999'
  categoryId: string;
  categoryName: string;
  netWeightG: string; // string for paise-precision parity
  huid: string | null;
  huidExemptionCategory: string | null;
  quantity: number;
  priceAvailable: boolean;
  estimatedPrice?: { totalRupees: string; totalPaise: number; perGramRupees: string };
  publishedAt: string;
  primaryImage: CatalogImage | null;
}

export interface CatalogProductDetail extends CatalogProductCard {
  grossWeightG: string;
  style: string | null;
  occasion: string[];
  giftPersona: string[];
  collectionId: string | null;
  images: CatalogImage[];
}

export interface CatalogImage {
  url: string;
  placeholderUrl: string;
  srcset: string;
  width: number;
  height: number;
  alt: string | null;
}

export interface Collection {
  id: string;
  slug: string;
  titleHi: string;
  titleEn?: string;
  subtitleHi?: string;
  heroImage: CatalogImage | null;
  productCount: number;
  isPremium: boolean;
}
```

`StorefrontConfig` type comes from re-exporting `z.infer<typeof StorefrontConfigSchema>` from `@goldsmith/shared` — that schema lands in worktree `C:\gs-stf-3` (A5). For now, scaffold a placeholder type compatible with the plan's shape; replace with the re-export once A5 ships.

### Phase 3 — storefront nav data

The mega-menu data and category tiles. **Hindi-first labels** with English subtext. Pull content from the plan §"UI/UX Direction · Information architecture · Desktop mega-menu". Each top-level item has: Popular Category column (5 links), Shop By Style (5), Shop By Metal+Purity (5), Price Band (6), Occasion (5), and one editorial visual tile.

```ts
export const STOREFRONT_BROWSE_NAV: NavItem[] = [
  { key: 'gold', labelHi: 'सोना', labelEn: 'Gold', href: '/products?metal=GOLD' },
  { key: 'diamond', labelHi: 'हीरा', labelEn: 'Diamond', href: '/products?search=diamond' },
  // ... 6 more
];

export const MEGA_MENU_CONTENT: Record<NavKey, MegaMenuPanel> = {
  gold: {
    popular: [
      { labelHi: 'अंगूठी', labelEn: 'Rings', href: '/products?search=ring' },
      // ...
    ],
    style: [/* ... */],
    metalPurity: [/* ... */],
    priceBand: [/* ... */],
    occasion: [/* ... */],
  },
  // ... per nav key
};
```

### Phase 4 — illustrated SVG fallbacks

6 cream-paper-textured SVGs (one per category). The plan §"Solution Architecture · Image pipeline extension" calls these out as the white-label-safe placeholder when `primaryImage IS NULL`. Constraints:
- Inline SVG (no external image refs)
- viewBox 800×1000 (4:5 portrait — matches ProductCard aspect)
- Cream `#F5EDDD` background, aged-gold `#B58A3C` line work, optional indigo `#1E2440` accents
- Each silhouette is a stylized line drawing of the category — not a photo
- Total file size budget: ≤ 4 KB per SVG, ≤ 24 KB combined
- Must render inline as JSX `string` AND as a standalone `.svg` file (so both web and mobile can consume — web can import as a React component via `?react` query, mobile uses `react-native-svg` from a string)

`categoryToFallbackSvg(categoryName: string): string` — returns SVG markup. Falls back to `silver.svg` for unknown categories.

### Phase 5 — port helpers from customer-web

Move and DELETE from `apps/customer-web/lib/storefront.ts`:
- `formatInrFromPaise` (lines 150-156)
- `productDisplayName` (lines 134-137)
- `productMaterial` (lines 139-141)
- `productTotalPaise` (lines 143-148)
- `applyCatalogFilters` (lines 158-177) — RENAME to `applyCatalogFiltersClient` and mark `@deprecated — moved to server in Phase B B1`
- `recommendedProducts` (lines 179-206) — RENAME to `recommendedProductsClient` and mark `@deprecated — moved to server in Phase B B6`
- `PRICE_BANDS` (lines 28-35), `PURITY_FILTERS` (lines 37-44)
- `emiRows` (lines 217-222)

Move and DELETE from `apps/customer-web/lib/theme.ts`:
- `metalLabel`, `purityLabel` (NOT the `buildThemeStyle` — that's web-specific, leave it)
- `METAL_LABELS`, `PURITY_LABELS` const maps

Update `apps/customer-web/lib/api.ts` and `apps/customer-mobile/src/api/endpoints.ts` to import types from `@goldsmith/customer-shared`. Verify nothing breaks via `pnpm typecheck` in both apps.

## Ceremony — Class B

1. **Brainstorming** — **may be skipped** if you follow the plan structure tightly (memory rule: brainstorming-skippable for template-following stories that mirror an existing pattern; `packages/ui-tokens` is the template). Skip with a note in commit.
2. **Writing-plans** — short work-stream plan at `docs\superpowers\plans\YYYY-MM-DD-story-a4-customer-shared.md`. **3 work streams**:
   - WS-A: Package skeleton + types + barrel exports + tsconfig wiring
   - WS-B: Storefront nav data + SVG fallbacks + tests
   - WS-C: Helper migration from customer-web/customer-mobile + dedup + typecheck both apps
3. **TDD on business logic.** Helper functions like `formatInrFromPaise`, `productDisplayName`, `categoryToFallbackSvg` get unit tests. Pure type re-exports do not need tests; `pnpm typecheck` proves them.
4. **Review gate before push:**
   - **Whole-branch `/code-review`** is mandatory.
   - **`/security-review`** — only if a new attack surface lands. This story has no API endpoint, no SQL, no auth path, no external integration. **Skip security review** unless the SVG content includes user-controllable data (it doesn't). Note "no new attack surface — security review skipped per Class B protocol" in commit.
   - **Codex** — discretionary per memory `feedback_codex_limit_batch_strategy.md`. If Codex budget allows, batch this branch with the Phase B branches for a single combined diff Codex round.
5. **Runtime smoke** — N/A. This is a library-only branch; no UI surface. Prove via `pnpm --filter @goldsmith/customer-web build && pnpm --filter @goldsmith/customer-mobile typecheck`. Both must pass after the import migrations.
6. **Code-truth audit.** `git grep` confirms:
   - `@goldsmith/customer-shared` resolves in both apps' `package.json`
   - The 6 SVG files exist on disk
   - The legacy helper definitions are deleted from `apps/customer-web/lib/storefront.ts` (not just shadowed)
   - `pnpm typecheck` passes across the monorepo

## Non-negotiable floor

- **No Inter / Space Grotesk / Latin-default fonts** in any visual asset (SVG fallbacks). All Hindi labels in nav data use Devanagari script.
- **No "Goldsmith" string** anywhere in the package — copy must be tenant-neutral.
- **Zero peer deps.** Compile with tsc, no React/RN imports. Consumers wrap as needed.
- **Zod schema for `StorefrontConfig` lives in `@goldsmith/shared`** (lands in A5). This package re-exports the type only.
- **No CDN URLs hardcoded.** SVG fallbacks are inline; image type fields are URL strings only (no defaults to CDN hostnames in this package).

## Pre-flight

```
cd C:\gs-stf-4
pnpm install --frozen-lockfile
pnpm --filter @goldsmith/ui-tokens build
pnpm --filter @goldsmith/customer-web typecheck
pnpm --filter @goldsmith/customer-mobile typecheck
```

The last two must pass BEFORE you start migrating types — that's your before-state baseline.

## Dispatch prompt

```
You are starting Story A4 in worktree C:\gs-stf-4 on branch feat/customer-shared-a4. This is Class B (pure types + helpers + assets, no auth/money/RLS surface) per CLAUDE.md ceremony tiering.

Read in order:
1. C:\Users\alokt\.claude\CLAUDE.md
2. C:\gs-stf-4\CLAUDE.md
3. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md
4. C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md
5. C:\gs-stf-4\STORY-A4-BRIEF.md

Announce model tier on turn 1.

Run pre-flight from the brief. Do not write code until it passes.

Brainstorming may be skipped (template-following story mirroring packages/ui-tokens). Go straight to /superpowers:writing-plans for a 3-work-stream plan: package skeleton + types, storefront nav data + SVG fallbacks, helper migration.

No migration consumed. No new attack surface. Skip /security-review per Class B protocol; whole-branch /code-review before push is mandatory. Codex is discretionary — batch with Phase B branches if budget allows.

Mandatory: 6 illustrated SVG fallbacks (cream + aged-gold), Hindi-first nav data, NO Inter/Space Grotesk fonts, NO "Goldsmith" string, NO Zod schema (StorefrontConfig type re-exports from @goldsmith/shared once A5 ships).

Reply with model-tier announcement, pre-flight result, and writing-plans plan.
```

## Sister worktrees

- `C:\gs-stf-1` (A1+A3, migrations 0066+0068) — defines `products` columns whose types you'll mirror in `CatalogProductCard`. Coordinate by reading the A1+A3 migration when it lands; until then, scaffold against the plan's shape.
- `C:\gs-stf-2` (A2, migration 0067) — defines `collections` whose row shape becomes the `Collection` type. Same coordination: read the migration when it lands.
- `C:\gs-stf-3` (A5+A6, migrations 0069+0070) — defines `StorefrontConfigSchema` Zod validator in `@goldsmith/shared`. Re-export the inferred type from this package once A5 lands.

Merge order: 0066+0068 → 0067 → 0069+0070 → A4 (this).

Because A4 has no migration, it can be developed in parallel with all three Class A stories. Final type alignment happens in a final commit on this branch after the 3 Class A stories merge.
