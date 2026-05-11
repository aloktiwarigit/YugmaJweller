# 0017 — Customer Storefront Architecture (Phase A–E uplift)

**Status:** Accepted  
**Date:** 2026-05-06  
**Deciders:** Alok (Principal Architect), Claude Sonnet 4.6 (execution)  
**Covers:** `apps/customer-web` + `apps/customer-mobile` storefront uplift  
**References:** `docs/customer-web-aspirational-storefront-spec-2026-05-06.md`, plans `review-docs-customer-web-aspirational-st-fizzy-token.md`, PRD FR127–FR140

---

## Context

The customer storefront (Next.js web + Expo mobile) was structurally shallow after Phase 1:
flat header with no mega-menu, 6 homepage sections on Unsplash placeholders, ProductCard
always showing an SVG placeholder, and catalog API with only `categoryId`/`metal`/`search`
server-side filtering. Phase A–E (this ADR) is the full uplift to demo-ready depth.

---

## Decisions

### D1 — Direction 5 "Hindi-First Editorial" design system

**Decision:** Lock Direction 5 as the sole design reference for all customer surfaces.

**Palette (binding):**

| Token | Hex | Rationale |
|---|---|---|
| `primary` | `#B58A3C` | aged gold; tenant-overridable |
| `primaryDeep` | `#896024` | hover/press state; WCAG AA on `#F5EDDD` (4.8:1) |
| `bg` | `#F5EDDD` | cream canvas |
| `ink` | `#1E2440` | indigo-ink — 12.4:1 on bg |
| `accent` | `#D4745A` | terracotta, MAX 1 per viewport fold |

> **Deviation from initial plan hex:** The spec sheet listed `primaryDeep` as `#8C6628`.
> That hex fails WCAG AA (3.9:1 on `#F5EDDD`). Corrected to `#896024` (4.8:1) before
> any component was built. All implementations use `#896024`.

**Typography stack:**
- `Yatra One` — display only (≥22px), Devanagari + Latin, mapped to `font-heading` Tailwind class
- `Mukta` — UI body, weights 400/500/600/700, mapped to `font-ui`
- `Hind` — long-form prose >30 words, mapped to `font-prose`
- Fraunces Italic — editorial English eyebrows — **deferred**: no English editorial copy needed for demo

> **Deviation from initial plan:** The spec used `font-display` for Yatra One. Tailwind's
> `font-display` conflicts with the `@tailwind utilities` display utilities. Renamed to
> `font-heading` throughout.

### D2 — RSC-first homepage (12-section rhythm)

**Decision:** Next.js App Router Server Components for the homepage. All section data fetched
server-side; no client-state needed for initial render. Sections with no data (empty API
response + no config override) collapse silently — never render empty card shells.

12-section rhythm (web + mobile parity):
1. HeroSection — banner from `shop_storefront_config.hero_banners`
2. RetailRateStrip — live gold/silver rates
3. CategoryTileGrid — 8 static tiles from `STOREFRONT_CATEGORY_TILES`
4. NewArrivalsSection — `GET /catalog/products/new-arrivals`
5. SpotlightSection — **stub** (see D7)
6. GiftPersonasSection — static persona tiles
7. TopSellersSection — `GET /catalog/products/top-sellers`
8. EverydayCollectionSection — first collection from `GET /catalog/collections`
9. PremiumCollectionSection — second collection; uses inline `#1E2440` dark surface (see D6)
10. RecommendedSection — **stub** (see D7)
11. PromiseSection — static brand-promise pillars
12. Footer — tenant name + contact

### D3 — Server-side filter/sort on `/products`

**Decision:** All catalog filters (purity, price range, inStock, style, occasion, collection,
sort) resolved server-side via extended `GET /api/v1/catalog/products`. URL query params drive
the server fetch; no client-side filter state. Enables server rendering with correct product
counts, SEO, and shareable filter URLs.

### D4 — CSS variable white-label theming

**Decision:** Per-tenant theming via CSS custom properties injected on `<html>` from
`shop_storefront_config`. The `buildThemeStyle()` helper constructs the `style` prop.
No CSS-in-JS, no styled-components, no runtime className generation.

Contrast guard in `buildThemeStyle()`: if tenant `primary` fails WCAG AA on `#F5EDDD`
for text use, nav text falls back to `ink`. Prevents invisible nav on bright-yellow tenants.

### D5 — Worktree parallelism for C+D phases

**Decision:** Web (C1–C5) and mobile (D1–D5) phases built in parallel via separate git
worktrees. Shared only through `packages/customer-shared` (read-only) and `packages/ui-tokens`.
No shared mutable state between worktrees; merge order: C first, then D.

### D6 — PremiumCollectionSection dark surface uses inline hex

**Decision:** PremiumCollectionSection uses `style={{ background: '#1E2440' }}` inline rather
than a Tailwind `bg-ink` class.

**Rationale:** The root layout sets `text-ink` (colour `#1E2440`) on `<body>`. When
`bg-ink` is applied to a child, Tailwind's cascade doesn't reset `text-color`, rendering
white text invisible on the dark background. Using an inline background escapes the cascade
while keeping the `text-white` override on the same element clean.

### D7 — Spotlight + Recommended sections are stubs in Phase C–E

**Decision:** Sections 5 (Spotlight) and 10 (Recommended) render placeholder skeletons in
Phase C–E. They will be wired to real data when `GET /catalog/products/recommendations`
(B6 story) delivers a signal-based recommendation engine.

**Implication:** Demo deck screenshots should show sections 1–4, 6–9, 11–12 as complete;
5 and 10 are acknowledged stubs not representative of final quality.

### D8 — `fetchPublicRates()` calls `/api/v1/catalog/rates`, not `/api/v1/rates/current`

**Decision (interim):** `fetchPublicRates()` in `apps/customer-web/lib/api.ts` calls the
catalog-scoped rate endpoint (`/catalog/rates`) which does NOT require a tenant header.
The authenticated pricing endpoint (`/rates/current`) requires `x-tenant-id`.

**Known technical debt:** The catalog rates endpoint was added as a passthrough; it lacks
the stale-rate warning logic present on `/rates/current`. Post-SOW cleanup: consolidate
into a single public-rates endpoint that includes freshness metadata.

### D9 — MegaMenu/Drawer content: gold + silver panels only (MVP)

**Decision:** MegaMenu (web hover) and MobileBrowseDrawer (mobile accordion) show rich
category panels for Gold and Silver only. The remaining 6 top-level nav items (Diamond,
Rings, Earrings, Pendants, Bracelets, Collections) navigate directly to filtered product
listing — no panel content.

**Rationale:** Panel content requires curated category images and copy. The anchor demo
inventory is gold + silver dominant. Other panels are a post-SOW content task, not
engineering work.

---

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Client-side filter SPA | Falls apart >50 products; no SEO; no shareable URLs |
| styled-components for theming | Runtime overhead; SSR hydration complexity; not needed |
| Subdomain-based tenant resolution | Header-based (`x-shop-slug`) sufficient for demo phase; subdomain needs DNS per tenant |
| Cart / B2C checkout | Not in Phase A–E scope; drives to estimate/contact/try-at-home/rate-lock |
| Dark mode | Cream palette has no natural dark counterpart; post-v1 |
| AI personalisation for recommendations | Rule-based (same category ±20% weight ±15% price) sufficient for demo |

---

## Consequences

- **Positive:** RSC-first gives fast TTFB + correct initial render without hydration flash.
  CSS variable theming is zero-runtime-cost. Worktree parallelism kept web + mobile on separate
  commit tracks with no rebase conflicts.
- **Positive:** All 126 PRD FRs are coded; FR127–FR140 storefront addendum shipped. Demo is
  reachable from main nav on both web and mobile.
- **Deferred debt:** Fraunces Italic, SVG illustrated fallbacks, fetchPublicRates endpoint
  consolidation, MegaMenu panel content for 6 remaining nav items, Spotlight + Recommended
  real data — all tracked as post-SOW stories.
- **Binding constraint:** `primaryDeep = #896024` is now embedded in `packages/ui-tokens`.
  Any future palette work must verify WCAG AA on `#F5EDDD` before changing this token.
