# Wave 5A — Customer Web Scaffold + Catalog API

**Date:** 2026-04-30  
**Ceremony:** Class B (compressed)  
**Branch:** `feat/epic7-customer-web-scaffold`  
**Worktree:** `C:/gs-cust-web`  
**PRD FRs:** FR86–FR99 (customer browsing, product detail, white-label storefront)

---

## 1. Scope

This wave delivers:
1. A complete Next.js 14 App Router customer-web app (`apps/customer-web/`) — white-label, Hindi-first, Direction 05 aesthetic.
2. `catalog.service.ts` — new NestJS service for public product listing + tenant config.
3. Three new catalog endpoints: `GET /catalog/tenant-config`, `GET /catalog/products`, `GET /catalog/products/:id`.
4. Three customer-facing web pages: homepage, product listing, product detail.

**Out of scope for this wave:** wishlist persistence (FR105), reviews (FR100–102), size guides (FR103–104), customer auth.

---

## 2. Work Streams

| Stream | Owner | Files |
|--------|-------|-------|
| WS-A | API | `catalog.service.ts`, `catalog.controller.ts`, `catalog.module.ts`, `drizzle-tenant-lookup.ts` |
| WS-B | Web scaffold | `apps/customer-web/` (all scaffold files, turbo/pnpm wiring) |
| WS-C | Web pages | `app/layout.tsx`, `app/page.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`, components |

---

## 3. WS-A: Catalog API

### 3.1 New: `catalog.service.ts`

Injectable NestJS service added to `CatalogModule`. Depends on `PricingService` (existing) and `PG_POOL`.

#### `getTenantConfig(slug: string): Promise<TenantConfigResponse>`

```
SELECT id, display_name, logo_url, config, status
FROM shops
WHERE slug = $1 AND status = 'ACTIVE'
```

- Returns 404 if no active shop found for slug.
- Maps to response:
  ```ts
  {
    primaryColor:    (config?.['primaryColor'] as string | undefined) ?? '#B58A3C',
    logoUrl:         logo_url ?? null,
    appName:         display_name,
    defaultLanguage: (config?.['defaultLanguage'] as string | undefined) ?? 'hi',
  }
  ```
- `config` JSONB may be `null` — all accesses use `config?.['key']` with explicit defaults.
- `logo_url` returned as-is (validation in the web layer before CSS injection).

#### `getProducts(params): Promise<CatalogProductsResponse>`

```ts
interface GetProductsParams {
  shopId:      string;
  categoryId?: string;
  search?:     string;
  page:        number;   // default 1
  limit:       number;   // max 50, default 12
}
```

**Query:**
```sql
SELECT id, shop_id, category_id, sku, metal, purity,
       net_weight_g, gross_weight_g, stone_weight_g, stone_details,
       making_charge_override_pct, huid, huid_exemption_category,
       status, quantity, published_at
FROM products
WHERE shop_id = $1
  AND status = 'PUBLISHED'
  AND quantity >= 0                         -- quantity=0 products ARE shown (see §6)
  [AND category_id = $2]                   -- if categoryId provided
  [AND (sku ILIKE $3 OR metal ILIKE $3 OR purity ILIKE $3)]  -- if search provided
ORDER BY published_at DESC
LIMIT $n OFFSET $m
```

**Price computation — done ONCE per request, not per product:**
1. Call `PricingService.getCurrentRates()` → rates map.
2. Fetch `shop_settings.making_charges_json` for the shopId in ONE query. Handle missing row (no shop_settings row yet) by using `MAKING_CHARGE_DEFAULTS` from `@goldsmith/shared`.
3. Build `Map<categoryId | '__default__', makingChargePct>` from making charges array.
4. Iterate products:
   - Resolve `ratePerGramPaise = rates[product.purity as PurityKey]?.perGramPaise`. If `undefined`, set `priceAvailable: false` and skip compute.
   - Resolve `makingChargePct`: use `making_charge_override_pct` if set; else look up `categoryId` in making-charges map; else fall back to `MAKING_CHARGE_DEFAULTS` value for the product's metal category.
   - Wrap `computeProductPrice({ netWeightG, ratePerGramPaise, makingChargePct, stoneChargesPaise: 0n, hallmarkFeePaise: 0n })` in try/catch — on `RangeError` (e.g. `net_weight_g = 0`), set `priceAvailable: false`.

**Response shape per product:**
```ts
{
  id, sku, metal, purity, categoryId,
  huid: string | null,
  huidExemptionCategory,
  quantity,
  priceAvailable: boolean,
  estimatedPrice?: {          // only if priceAvailable=true
    totalFormatted: string,   // "₹84,138.52"
    totalPaise: string,       // bigint serialized
    breakdown: { goldValue, makingCharge, gstMetal, gstMaking },
  },
  publishedAt: string,
}
```

#### `getProduct(id: string, shopId: string): Promise<CatalogProductDetailResponse>`

Same columns as listing, single row. Same price computation logic. Returns 404 if not found or `status != 'PUBLISHED'`.

### 3.2 Updated: `catalog.controller.ts`

Three new endpoints, all `@SkipAuth()` + `@SkipTenant()`:

```
GET /catalog/tenant-config
  Headers: X-Shop-Slug (required)
  Response: TenantConfigResponse
  Cache-Control: public, max-age=3600

GET /catalog/products
  Headers: X-Tenant-Id (required — shopId)
  Query: categoryId?, search?, page?, limit? (max 50)
  Response: { items: CatalogProduct[], total: number, page: number }
  Cache-Control: public, max-age=30, stale-while-revalidate=60

GET /catalog/products/:id
  Headers: X-Tenant-Id (required)
  Guard: 400 BadRequestException if X-Tenant-Id missing
  Response: CatalogProductDetailResponse
  Cache-Control: public, max-age=30, stale-while-revalidate=60
```

**Throttling:** Apply `@UseGuards(ThrottlerGuard)` at the `CatalogController` **class level** only. Install `@nestjs/throttler`. Register `ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }])` in `AppModule`. Do NOT apply global `APP_GUARD` for throttling — this would require `@SkipThrottle()` on every existing authenticated controller.

### 3.3 Updated: `drizzle-tenant-lookup.ts`

Add `bySlug(slug: string): Promise<Tenant | undefined>` method — same pattern as existing `byId` but queries `WHERE slug = $1 AND status = 'ACTIVE'`. Cache hit keyed on `slug:${slug}`.

### 3.4 Updated: `catalog.module.ts`

`PG_POOL` is a globally-registered token in AppModule — no extra module import needed. Add `CatalogService` to `providers` and `exports`. `PricingModule` is already imported.

### 3.5 Tests (TDD)

- `catalog.service.spec.ts`: unit tests for `getTenantConfig` (active/suspended/missing shop), `getProducts` (empty result, purity mismatch → priceAvailable=false, zero-weight → priceAvailable=false, making charge fallback chain), `getProduct` (404, price computation).
- `catalog.controller.spec.ts`: extend existing spec with new endpoint smoke tests.

---

## 4. WS-B: Next.js Scaffold

### 4.1 Workspace wiring

- Add `apps/customer-web` to `pnpm-workspace.yaml`.
- `apps/customer-web/package.json`: name `@goldsmith/customer-web`, deps include `next@14`, `react`, `react-dom`, `@goldsmith/ui-tokens`, `tailwindcss`, `@shadcn/ui`, `next-themes`.
- `turbo.json`: add `dev` task `{ "cache": false, "persistent": true }`.

### 4.2 File structure

```
apps/customer-web/
  app/
    layout.tsx              # root layout — theme injection
    page.tsx                # homepage
    products/
      page.tsx              # listing
      [id]/
        page.tsx            # detail
    not-found.tsx           # shop unavailable (slug 404)
    error.tsx               # error boundary
  components/
    GoldRateCard.tsx
    ProductCard.tsx
    ProductGrid.tsx
    CategorySidebar.tsx
    HuidBadge.tsx
    EstimatedPriceBadge.tsx # shows अनुमानित मूल्य label
    WishlistButton.tsx      # stub — toast only
  lib/
    api.ts                  # typed fetch helpers for catalog endpoints
    theme.ts                # CSS variable injection helpers
  next.config.ts
  tailwind.config.ts
  tsconfig.json
  postcss.config.js
  components.json           # shadcn config
```

### 4.3 Fonts

```ts
// app/layout.tsx
import { Yatra_One, Noto_Sans_Devanagari } from 'next/font/google';

const yatraOne = Yatra_One({
  weight: '400',
  subsets: ['devanagari'],
  variable: '--font-heading',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  weight: ['400', '500', '600'],
  subsets: ['devanagari'],
  variable: '--font-body',
  display: 'swap',
});
```

Inter and Space Grotesk are **never imported**.

### 4.4 Tailwind config

```ts
// tailwind.config.ts
import { colors } from '@goldsmith/ui-tokens';

export default {
  content: ['./app/**/*.tsx', './components/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        primary:    'var(--primary-color)',
        bg:         colors.bg,        // #F5EDDD fallback
        ink:        colors.ink,
        border:     colors.border,
        error:      colors.error,
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'serif'],
        body:    ['var(--font-body)', 'sans-serif'],
      },
    },
  },
};
```

---

## 5. WS-C: Customer Web Pages

### 5.1 `app/layout.tsx` — root layout (server component)

```
1. Read X-Shop-Slug from Next.js headers() OR process.env.NEXT_PUBLIC_SHOP_SLUG.
2. If neither, render shop-unavailable page.
3. fetch(`${process.env.API_URL}/catalog/tenant-config`, {
     // API_URL is server-side only (e.g. http://localhost:3001) — not NEXT_PUBLIC_
     headers: { 'X-Shop-Slug': slug },
     next: { revalidate: 3600 },   // P2 fix: cache tenant config for 1 hour
   })
4. On 404: render not-found.tsx ("यह दुकान उपलब्ध नहीं है")
5. Validate logoUrl: only inject if starts with 'https://' (P2 XSS fix).
   logoUrl from response is used in <img> tag, NOT as a CSS url() value.
6. Inject theme:
   <html
     style={{
       ['--primary-color' as string]: primaryColor,
       ['--app-name' as string]: appName,
     } as React.CSSProperties}
   >
7. Set <title>{appName}</title>. No "Goldsmith" anywhere in DOM.
```

### 5.2 `app/page.tsx` — homepage (server component)

Sections (top to bottom):
1. **Hero:** Shop logo (`<img src={logoUrl} alt={appName}>`), shop name in Yatra One (`font-heading text-4xl`), tagline "श्रेष्ठ आभूषण, विश्वसनीय सेवा" in Noto Sans Devanagari.
2. **GoldRateCard:** Server-fetched `GET /catalog/rates` (`{ next: { revalidate: 60 } }`). Shows सोना 24K / 22K / चाँदी 999 rates in ₹/ग्राम. `stale` indicator if rates are stale.
3. **Featured products:** `GET /catalog/products?limit=6` (first 6 published). Grid of `ProductCard` components.

### 5.3 `app/products/page.tsx` — product listing (server component)

- `CategorySidebar`: metal filter buttons (सोना / चाँदी / हीरा). Passes `categoryId` query param.
- Search input: `<input>` client component, updates URL param `search=` on submit (no debounce in server component — link/form submit).
- `ProductGrid`: 12 items per page, pagination via URL `?page=N`.
- Each `ProductCard`: SKU, metal+purity label in Hindi (`GOLD_22K` → `सोना 22K`), `EstimatedPriceBadge` (shows estimated price with "अनुमानित" label), HUID badge if present, quantity=0 shows "उपलब्ध नहीं" overlay.
- Empty state: "अभी कोई उत्पाद उपलब्ध नहीं है" with shop contact prompt.

### 5.4 `app/products/[id]/page.tsx` — product detail (server component)

- Product image: placeholder gold-texture SVG if no image URL (not a grey box).
- Hindi labels: metal+purity, gross/net weight in ग्राम.
- `HuidBadge`: "हॉलमार्क ✓ {huid}" if `huid` present; exemption note if `huid_exemption_category != 'none'`.
- `EstimatedPriceBadge`: `priceAvailable=true` → show `totalFormatted` with "अनुमानित मूल्य" label + tooltip "पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं". `priceAvailable=false` → "मूल्य के लिए संपर्क करें".
- `WishlistButton`: client component, `onClick` shows shadcn `toast('इच्छा सूची में जोड़ा गया')`. No persistence — Wave 7 stub.
- Quantity=0: "उपलब्ध नहीं" banner across image.
- Back link: "← उत्पाद देखें" to `/products`.

### 5.5 Accessibility (WCAG 2.1 AA — all pages)

- All interactive elements keyboard-navigable with visible focus ring.
- ARIA labels in Hindi for icon-only buttons.
- Form errors announced via `aria-live="polite"`.
- No color-only information signals.
- Images have descriptive `alt` text in Hindi.
- Font scales with browser zoom to 200% without layout breakage.

---

## 6. Design Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Catalog search | SQL ILIKE on sku/metal/purity | Products have no name column; category+metal filter is primary discovery; Meilisearch customer-catalog indexing is Wave N+ |
| Branding storage | `shops.config` JSONB + `shops.logo_url` | No migration needed; `config` JSONB is the intended extension point |
| Tenant resolution | `X-Shop-Slug` header (middleware) with `NEXT_PUBLIC_SHOP_SLUG` fallback | Supports both subdomain and env-var deployment modes at zero extra cost |
| Throttling scope | `@UseGuards(ThrottlerGuard)` at CatalogController class only | Avoids maintenance debt of `@SkipThrottle()` on every authenticated endpoint |
| Out-of-stock display | Show with `उपलब्ध नहीं` badge, not filtered | Customers see the full range; filters would hide the jeweller's catalogue |
| Stone/hallmark in price | `stoneChargesPaise=0n`, `hallmarkFeePaise=0n` | Estimated price display; clearly labelled `अनुमानित मूल्य` to set expectations |
| making charges N+1 | Fetch once, build Map, iterate products | Single DB call per request regardless of product count |
| logo_url XSS | Validate `https://` prefix; use in `<img>`, never as CSS `url()` | Prevents CSS injection via malicious logo URLs |

---

## 7. Non-Negotiable Rules

- Zero Goldsmith platform branding on any customer-facing DOM element.
- Noto Sans Devanagari for body; Yatra One for headings. Inter/Space Grotesk never imported.
- All catalog queries scoped to `shop_id` from request header — no cross-tenant leakage.
- `computeProductPrice()` for all price display — no raw DB field exposure.
- WCAG 2.1 AA on all pages.
- `priceAvailable: false` whenever purity unknown or weight invalid — never crash the listing.
- `shops.config` always accessed via optional chaining with explicit defaults.

---

## 8. Definition of Done

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green in `C:/gs-cust-web`
- [ ] `codex review --base main` → `.codex-review-passed`
- [ ] Runtime smoke: `pnpm dev` in `apps/customer-web`, browse product listing, verify Hindi labels, Noto Sans Devanagari font, computed prices with "अनुमानित मूल्य" label
- [ ] Lighthouse a11y score ≥ 90
- [ ] Zero Goldsmith branding in page source
