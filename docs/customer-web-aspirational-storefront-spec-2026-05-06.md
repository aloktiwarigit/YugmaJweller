# Customer Web Aspirational Storefront Spec

Date: 2026-05-06

Reference inspected: https://www.jewelsbox.co/

This spec translates the reference site's storefront structure into an original Goldsmith customer-web direction. The goal is to match the shopping depth and section rhythm, not the Jewelsbox brand, copy, product names, imagery, or exact layout.

## Goal

Make the tenant storefront feel like a complete local jewellery store, not only a polished landing page. A customer should be able to browse by product type, style, metal, price, occasion, and gift intent from the first screen and header.

The result should still feel like the jeweller's own premium storefront:

- Tenant brand is the only customer-facing brand.
- Hindi-first editorial direction remains the product baseline.
- Live rates, HUID/trust, transparent pricing, try-at-home, wishlist, and rate-lock remain Goldsmith differentiators.
- The site should feel aspirational like a mature jewellery retailer, while staying practical for a local store's actual catalog.

## Current Gap

The current homepage is structurally close in broad order:

- Header with search and nav.
- Hero with jewellery imagery.
- Public rate strip.
- New Arrival.
- In Spotlight.
- Loved ones/gifting cards.
- Top Sellers.
- Everyday Collection.
- Recommended products.
- Store promise/trust section.

The main gap is retail depth. The reference site creates browsing confidence through repeated layered paths:

- Top-level metal/category tabs.
- Mega-menu groups for style, metal/stone, and price.
- Occasion/collection browsing.
- Home sections that repeat the same shopping taxonomy visually.
- Footer links that reinforce category, guide, service, and policy paths.

Goldsmith currently relies mostly on simple `/products`, `search`, and `metal` links. That makes the page look good, but it does not yet feel like a full jewellery catalog.

## Reference Pattern To Adapt

The useful pattern from the reference:

- Top nav: metal and category entry points.
- Mega menu per category:
  - Popular categories.
  - Shop by style.
  - Shop by metal and stone.
  - Price band.
  - Optional category image.
- Homepage rhythm:
  - Hero.
  - New arrival.
  - Spotlight.
  - Shop by loved ones.
  - Top sellers.
  - Everyday collection.
  - Premium collection.
  - Recommended for you.
  - Promise/trust.
  - Footer with category, guide, policy, and contact links.

Do not copy:

- Jewelsbox copy.
- Jewelsbox brand names.
- Jewelsbox product names.
- Jewelsbox images.
- Exact menu labels where they are brand-specific.
- Exact section descriptions.

## Target Information Architecture

Use a shared storefront browsing model so the header, homepage, footer, and future collection pages stay consistent.

Recommended top-level nav:

| Nav Item | Purpose |
| --- | --- |
| Gold | Gold jewellery and purity-driven browsing |
| Diamond | Diamond-led gifting, rings, earrings, pendants |
| Silver | Silver essentials and daily/gifting pieces |
| Rings | Engagement, couple, daily, statement |
| Earrings | Studs, hoops, drops, jhumka, daily |
| Pendants | Daily pendants, diamond pendants, religious pendants |
| Bracelets | Bracelets, bangles, kadas |
| Collections | Wedding, festival, daily wear, office wear, gifting, premium |

Each top-level category should expose 3-4 groups:

| Group | Example Links | Query Strategy |
| --- | --- | --- |
| Popular Category | Rings, Earrings, Pendants, Bracelets, Bangles | `/products?search=ring` |
| Shop By Style | Engagement, Couple, Daily Wear, Jhumka, Studs | `/products?search=engagement` |
| Shop By Metal | Gold, Silver, Diamond, 22K, 18K, 925 Silver | `/products?metal=GOLD`, `/products?purity=22K` |
| Price Band | Under Rs 10K, Rs 10K-20K, Rs 20K-30K, Rs 30K-50K, Rs 50K-75K, Rs 75K+ | `/products?price=lt10000` |
| Occasion | Wedding, Festival, Gift, Daily Wear, Office Wear | `/products?search=wedding` |

Use existing query support first:

- `search`
- `metal`
- `purity`
- `price`
- `inStockOnly`
- `categoryId`

Do not introduce collection URLs until collection pages exist. For now, collection links should resolve to `/products` with query parameters.

## Homepage Structure

### 1. Header And Mega Menu

The header should do more than list links. It should make the store browsable.

Desktop:

- Top strip with logo/store name, search, and secondary links.
- Second row with nav items.
- Hover/focus mega menu for major categories.
- Menu content organized into columns: Popular, Style, Metal, Price, Occasion.
- Optional visual tile for the active nav category.

Mobile:

- Keep search prominent.
- Use horizontally scrollable category chips or a compact menu.
- Avoid hover-only behavior.
- Ensure all links are reachable by touch and keyboard.

### 2. Hero

The hero should remain shopping-first:

- First viewport must clearly show the tenant store name.
- Use jewellery/product imagery, not abstract gradients.
- Primary CTA: `Shop Collection`.
- Secondary CTA: `Book Try At Home` or `View Today Rates`.
- Keep rate/trust signals close to the hero.

### 3. Rate Strip

Keep the current live rate strip because it is a Goldsmith differentiator.

Improve copy hierarchy:

- Gold 24K
- Gold 22K
- Silver 999
- Per gram label
- Last updated/stale indicator later if available

### 4. Shop By Category

Add a dedicated category grid near the top:

- Rings
- Earrings
- Pendants
- Nosepins
- Bracelets
- Bangles
- Necklaces
- Silver Essentials

Each tile links to `/products?search=<category>`.

### 5. New Arrivals

Use actual catalog products when available.

Fallback should still look like shopping paths:

- New Gold Designs
- Diamond Picks
- Silver Gifting
- Daily Wear

Avoid generic text-only tiles.

### 6. In Spotlight

Use one large editorial feature plus 3-4 smaller shopping cards:

- Wedding Edit
- Daily Wear
- Gift Under Rs 20K
- Temple/Festival Jewellery
- Office Wear

This should feel curated, not random.

### 7. Shop By Loved Ones

Keep the concept, but make it store-appropriate:

- For Mother
- For Sister
- For Wife
- For Bride
- For Self
- For Friend

Each card should use search links like `/products?search=gift`, `/products?search=bridal`, or price links for affordable gifting.

### 8. Top Sellers

Use live products when available.

If there are no products, show category fallback cards that still invite browsing. Do not show a dead empty state on the homepage unless the whole store truly has no catalog.

### 9. Everyday Collection

Use compact, scannable tiles:

- Daily Rings
- Office Earrings
- Lightweight Pendants
- Silver Essentials
- Kids Gifts
- Simple Bangles

### 10. Premium Collection

Add a premium section that the current homepage is missing.

Suggested paths:

- Bridal Sets
- Diamond Classics
- Heavy Gold
- Occasion Necklaces
- Premium Gifts

This section is important because it creates the aspirational feeling the reference site has.

### 11. Recommended For You

Render only if products exist.

Later enhancement:

- Use viewed category, wishlist, or same-metal recommendations.
- For now, use a curated slice of fetched products.

### 12. Store Promise

Keep trust concrete and local:

- BIS/HUID verified.
- Transparent price breakdown.
- Exchange/buyback support.
- Try-at-home where enabled.
- WhatsApp/store callback.

Do not overclaim "100% refund" unless that is actually backed by the tenant policy.

## Visual Direction

Use the locked Hindi-first editorial direction as the base, but raise the retail polish.

Keep:

- Aged gold primary.
- Cream background.
- Indigo ink.
- Terracotta blush as a restrained accent.
- Tenant-controlled primary color.
- Devanagari display personality.

Improve:

- Use more white space around product grids.
- Reduce reliance on purple blocks as the main luxury signal.
- Use real product/category imagery wherever possible.
- Use consistent 8px or smaller radii for cards.
- Keep cards for repeated items only.
- Avoid nested cards.
- Avoid decorative gradient blobs/orbs.
- Ensure text never overlaps images on mobile.

Recommended image style:

- Product-on-model for hero/spotlight.
- Clean product photography for category tiles.
- Store-specific or tenant-uploaded imagery preferred.
- Unsplash/demo images are acceptable only as demo placeholders.

## Implementation Plan

### Phase 1: Shared Browse Data

Create or extend `apps/customer-web/lib/storefront.ts`:

- `STOREFRONT_BROWSE_NAV`
- `STOREFRONT_CATEGORY_TILES`
- `STOREFRONT_OCCASION_TILES`
- `STOREFRONT_PREMIUM_TILES`
- `buildProductsHref(...)`

All homepage/header links should come from shared data, not duplicated arrays inside `app/page.tsx` and `app/layout.tsx`.

### Phase 2: Header Refactor

Extract the current header out of `apps/customer-web/app/layout.tsx` into:

- `apps/customer-web/components/StorefrontHeader.tsx`

Responsibilities:

- Tenant logo/name.
- Search form.
- Desktop mega menu.
- Mobile browse row/menu.
- Secondary links: Diamond Guide, Silver Guide, Loyalty, Wishlist, Try At Home, Rate Lock.

Keep root layout responsible for tenant config, theme, page shell, and footer.

### Phase 3: Homepage Components

Break `apps/customer-web/app/page.tsx` into small components if it grows too large:

- `HeroSection`
- `RetailRateStrip`
- `SectionHeading`
- `CategoryTileGrid`
- `SpotlightSection`
- `GiftPersonasSection`
- `CollectionLinkGrid`
- `PromiseSection`

Do not create abstractions before they remove real duplication.

### Phase 4: Product Listing

Update `apps/customer-web/app/products/page.tsx`:

- Show active browse intent in the title if `search`, `metal`, `purity`, or `price` is present.
- Add quick links matching the same categories used by the header.
- Keep filters working with existing query params.
- Ensure empty states suggest adjacent categories, not a dead end.

### Phase 5: Product Imagery

The current product cards still use placeholders. To reach the aspirational benchmark, the product card must show actual product imagery.

Needed work:

- Fetch first public product image for product cards, or extend catalog product API with primary image metadata.
- Use placeholder only when no image exists.
- Keep HUID and price badges visible.

This is one of the biggest visual gaps against a mature jewellery storefront.

## Detailed Implementation Prompt

Use this prompt for the implementation task:

```text
You are working in the Goldsmith monorepo at apps/customer-web. Redesign the customer web storefront to match the retail information architecture quality of https://www.jewelsbox.co/ while keeping the implementation original and tenant-branded.

Do not copy Jewelsbox branding, images, copy, product names, or exact visual layout. Only adapt the structural pattern: layered category browsing, mega-menu groups, home sections for new arrivals/spotlight/loved ones/top sellers/everyday/premium/recommended, and trust/promise reinforcement.

Current code paths:
- apps/customer-web/app/layout.tsx contains the current header/nav.
- apps/customer-web/app/page.tsx contains the homepage sections.
- apps/customer-web/app/products/page.tsx supports searchParams: search, metal, purity, price, inStockOnly, categoryId.
- apps/customer-web/lib/storefront.ts contains storefront helpers, price bands, filters, tenant helpers, and recommendation helpers.
- apps/customer-web/components/ProductGrid.tsx and ProductCard.tsx render product lists.

Implementation requirements:
1. Add shared storefront browse data in apps/customer-web/lib/storefront.ts for top-level categories, mega-menu groups, category tiles, occasion/gift tiles, everyday collection links, and premium collection links.
2. Refactor the header into a StorefrontHeader component or update layout.tsx cleanly if extraction is too large. The header must include tenant logo/name, search, top category nav, and a desktop mega menu with grouped links: Popular Category, Shop By Style, Shop By Metal/Purity, Price Band, Occasion.
3. Keep mobile usable. All categories must be reachable on touch devices without hover-only behavior.
4. Update the homepage to include: hero, live rate strip, shop-by-category, new arrivals, spotlight, shop-by-loved-ones, top sellers, everyday collection, premium collection, recommended products, and store promise.
5. All browse links must resolve to supported routes/query params. Prefer /products?search=..., /products?metal=GOLD, /products?purity=22K, and /products?price=...
6. Preserve tenant branding and white-label behavior. Do not show the Goldsmith platform brand on customer-facing pages.
7. Preserve live rate, HUID/trust, transparent pricing, try-at-home, wishlist, and rate-lock entry points.
8. Use the existing Hindi-first editorial design direction: aged gold, cream, indigo ink, restrained terracotta, Devanagari display personality. Improve polish with product-led imagery, clearer section rhythm, and less reliance on one large purple/cream block.
9. Avoid nested cards, decorative gradient blobs/orbs, and text/image overlap. Cards should use 8px or smaller radii unless an existing component requires otherwise.
10. Verify desktop and mobile at http://localhost:3000/. Capture screenshots for 1366x900 and a mobile viewport. Run pnpm --filter @goldsmith/customer-web typecheck and lint if available.

Acceptance criteria:
- Header exposes at least 7 top-level browse paths.
- At least 4 top-level nav items expose grouped mega-menu content on desktop.
- Mobile users can reach the same browse links.
- Homepage contains the full section rhythm listed above.
- Product links use supported filters and do not depend on unimplemented collection routes.
- No Jewelsbox brand/copy/assets remain in code.
- Customer-facing pages show only the tenant store brand.
- Desktop and mobile screenshots show no overlapping text or broken layouts.
- TypeScript passes for customer-web.
```

## Acceptance Criteria

Functional:

- Header has a richer browse model than a flat nav list.
- Search remains available in the header.
- All browse links navigate to supported product listing filters.
- Homepage has category, occasion, price, daily, premium, and trust paths.
- Product grid sections use live products when available.
- Fallback content still drives browsing.

Visual:

- Store identity is visible in the first viewport.
- Jewellery/product imagery is visible in the first viewport.
- Section hierarchy is clear on desktop and mobile.
- No text overlaps or overflows on mobile.
- Cards are not nested inside other cards.
- Page does not read as a one-note purple/cream theme.

White-label:

- No customer-facing "Goldsmith" platform brand.
- No Jewelsbox brand, copy, images, or product names.
- Store name, logo, contact, and policies remain tenant-driven.

Verification:

- `pnpm --filter @goldsmith/customer-web typecheck`
- `pnpm --filter @goldsmith/customer-web lint`
- Open `http://localhost:3000/`
- Verify `/products?search=ring`
- Verify `/products?metal=GOLD`
- Verify `/products?price=lt10000`
- Capture desktop and mobile screenshots.

## Risks And Follow-Ups

Risk: Search-based links can produce empty results if a tenant's catalog uses different category names.

Mitigation: Later, add tenant-managed collections or category slugs from the backend instead of static search terms.

Risk: Product cards still look less premium if they use placeholders.

Mitigation: Prioritize product image integration after the IA/header/homepage pass.

Risk: A large mega-menu can become difficult on mobile.

Mitigation: Use a touch-first mobile browse drawer or horizontal category shelves instead of desktop hover behavior.

Risk: Price bands can feel wrong for premium tenants.

Mitigation: Keep defaults, but allow tenant-configured price bands later.

## Recommended Build Order

1. Shared browse data in `lib/storefront.ts`.
2. Header/mega-menu.
3. Homepage section rhythm.
4. Product listing browse-title and empty-state improvements.
5. Product imagery integration.
6. Tenant-managed collection/category API.

