---
generatedBy: 'Opus, BMAD Phase 2 — addendum + epic decomposition'
epic: 'E17 + E18 (Customer Storefront Polish + Enrichment)'
date: '2026-05-01'
status: 'phase-1-deliverable; awaiting Codex cross-model review'
parent_prd: '_bmad-output/planning-artifacts/prd.md (FR1–FR126 unchanged)'
addendum: 'docs/prd-addendum-customer-storefront.md (FR127–FR140 + completions + NFR-SE-1/SE-2/IMG-1)'
gap_source: 'docs/customer-storefront-gap-analysis-2026-05-01.md (§4 tiers, §12 waves)'
notes:
  - >
    Epic 17 = Tier 1 (table-stakes for anchor demo). Epic 18 = Tier 2 (post-launch polish).
    Wave assignments and worktree paths follow gap-analysis §12.2–12.4 verbatim.
  - >
    Story IDs: 17.<n> / 18.<n> (Goldsmith convention). Each story carries a T<id> tag
    cross-referencing the gap-analysis tier table for traceability.
  - >
    Dependencies (§12.8): nothing in Wave 7B/7C touching PDP/product cards starts until
    T1.1 (image pipeline) merges. T2.2/T2.5/T2.6 wait on T1.1; T1.5 pass-2 waits on T2.1;
    T2.7 waits on T1.4.
  - >
    Ceremony per CLAUDE.md: Class A = full ceremony (5–7 work streams, parallel Codex +
    /security-review); Class B = compressed (3–5 work streams, Codex-only gate);
    Class C = minimal (Codex + per-story tests where behaviour changed).
  - >
    Non-negotiable floor (all classes): TS strict, WCAG 2.1 AA on web, ≥48dp touch on
    mobile, Hindi-first typography, no Goldsmith brand on customer surfaces, runtime
    smoke test on intended surface before push.
---

---

## Epic 17: Customer Storefront Polish — close jewelsbox.co table-stakes gap before anchor demo

**Goal:** Bring `apps/customer-web/` and `apps/customer-mobile/` to demo parity with a comparable consumer jewelry storefront so the anchor jeweller's customers see a complete, polished surface — without touching the differentiators (HUID badge, public price breakdown, rate-lock, try-at-home, white-label).

**FRs covered:** FR127, FR128, FR129, FR130, FR131, FR132, FR133, FR134 (new) + FR86, FR88, FR90, FR93, FR104, FR105 (completion)
**NFRs verified:** NFR-A1, NFR-A2, NFR-A4, NFR-A5, NFR-A6, NFR-SE-1, NFR-SE-2, NFR-IMG-1
**Phase:** Phase 2 — Wave 7A (foundation) + Wave 7B (parallel polish tracks)
**Dependencies:** Feature-complete main branch (HEAD ed7900b on 2026-05-01); existing `@goldsmith/integrations-storage` adapter; existing shop_settings table

---

### Story 17.1 (T1.1): Customer can view real product images in a multi-image gallery on the PDP

**Class:** A — touches Azure Blob + ImageKit signing, malware scan hook, RLS on new `product_images` table, encrypted signed-URL TTL.
**Wave:** 7A · **Worktree:** `C:/gs17a-img/` · **Depends on:** none (foundation story)
**Blocks:** every other story in 17/18 that renders product imagery (17.2 footer, 17.10 home rails, 18.1 collections, 18.5 recommendations, 18.6 zoom)

**As an anchor jeweller's customer**,
I want to see real photographs of each piece on the product page with a swipeable/clickable gallery,
So that I can evaluate the jewellery before walking into the shop or booking try-at-home.

**FRs implemented:** FR90 (multiple images — completion); foundation for FR127 (footer asset previews), FR135 (collection cover images)
**NFRs verified:** NFR-IMG-1 (CDN + responsive srcset + 250 KB cap), NFR-S2 (encrypted at rest), NFR-S3 (tenant-scoped image isolation), NFR-A4 (alt text mandatory), NFR-P9 (image p95 < 500 ms thumbnails)
**Modules + packages touched:**
- `packages/integrations-storage/src/azure-blob.adapter.ts` (extend — signed-URL issuance per tenant)
- `packages/integrations-storage/src/imagekit.adapter.ts` (new — transcoding pipeline + variant generation)
- `apps/api/src/modules/inventory/product-images.controller.ts` (new — POST/DELETE/list endpoints)
- `apps/api/src/modules/inventory/product-images.service.ts` (new — MIME validation, EXIF strip, malware-scan hook)
- migration `0056_product_images.sql` (new table with FK to products + RLS policy + cascade delete)
- `apps/shopkeeper/src/screens/inventory/ProductImagesScreen.tsx` (new — upload, reorder, delete UI)
- `apps/customer-web/src/components/products/ProductGallery.tsx` (new — replace `GoldTexturePlaceholder`)
- `apps/customer-mobile/src/components/products/ProductGallery.tsx` (new)
- `packages/ui-web/src/atoms/ResponsiveImage.tsx` (new — `srcset` + lazy loading)

**ADRs governing:** ADR-0007 (storage), ADR-0008 (multi-tenant isolation)
**Pattern rules honoured:** RLS on `product_images.shop_id`; `tenantContext` injected at API gateway; signed-URL TTL ≤ 24 h
**Complexity:** L (3–5 days; one Class A plan-session + one Class A exec-session in fresh sessions per `feedback_fresh_session_prompt_ceremony.md`)

**Acceptance Criteria:**

**Given** shopkeeper Rajesh-ji is on the product edit screen for SKU-1234
**When** he taps "तस्वीर जोड़ें" and selects a 6 MP JPEG from his phone gallery
**Then** the image uploads with a progress indicator
**And** ImageKit returns 4 variants (320w/640w/1024w/1920w) all under 250 KB each
**And** the smallest variant fails to fit under 250 KB → upload is rejected with Hindi error message
**And** EXIF metadata (GPS, device) is stripped before storage
**And** the image carries `shop_id = Rajesh's shop_id` enforced by RLS

**Given** a customer of Rajesh's shop opens product SKU-1234 detail
**When** the page loads on a 4G connection
**Then** the first gallery image renders within p95 ≤ 500 ms (NFR-P9)
**And** swipe/keyboard-arrow navigation works through all uploaded images
**And** every `<img>` has alt text in Hindi (auto-generated from product name + variant index)
**And** Lighthouse SEO score does not drop below 90 (NFR-SE-2)

**Given** a customer of Tenant-B (different shop) has the URL of a Rajesh-shop image
**When** the customer attempts to load the signed URL
**Then** the image loads (signed URLs are public-by-construction, intentional) BUT the API endpoints to list/modify/delete images return 403 (RLS blocks cross-tenant via API)

**Given** a malicious file (PHP webshell renamed to .jpg) is uploaded
**When** the upload pipeline runs
**Then** MIME sniffing rejects the file with HTTP 400 + audit-logged warning event

**Given** CI runs
**Then** all 10 gates pass: typecheck, lint, unit tests ≥ 80% coverage on `product-images.service`, integration test (Azure Blob mock + ImageKit mock), tenant-isolation test (Tenant-A cannot list Tenant-B's images), Semgrep, axe-core on shopkeeper screen, Lighthouse on PDP, Codex review, /security-review

**Tests required:** Unit (MIME validation, EXIF strip, signed-URL TTL), Integration (Azure Blob + ImageKit + DB transactional), Tenant-isolation (RLS), E2E (shopkeeper upload → customer view), Performance (NFR-P9 p95 budget), Security (malware-scan hook, oversized payload, SVG with embedded script)

**Definition of Done:** All AC + 10 CI gates + `.codex-review-passed` + `.security-review-passed` markers + runtime smoke on Moto G or web browser confirming a real photo renders on a real customer PDP.

**Out of scope:** AI auto-cropping, watermarking, 360° turntable capture (T2.6 leaves hook), bulk re-encode of legacy placeholders (data migration handled separately).

---

### Story 17.2 (T1.2): Customer can see a multi-column footer on every storefront page

**Class:** C — pure presentation, tenant-config columns, no compliance surface.
**Wave:** 7B-A · **Worktree:** `C:/gs17b-content/` · **Depends on:** none (Class C, can ship parallel to 17.1)

**As an anchor jeweller's customer**,
I want a complete footer with the shop's address, phone, social links, app-download badge, and policy links,
So that I can find contact details, follow the shop, and download the mobile app from any page.

**FRs implemented:** FR127, FR134
**NFRs verified:** NFR-A1 (WCAG AA), NFR-A4 (semantic HTML), NFR-A6 (Devanagari rendering)
**Modules + packages touched:**
- `apps/customer-web/src/components/layout/Footer.tsx` (new)
- `apps/customer-web/src/app/layout.tsx` (mount footer)
- `apps/customer-mobile/src/components/layout/FooterSheet.tsx` (new — bottom-sheet variant on mobile profile screen)
- migration `0057_shop_settings_footer_columns.sql` (add `whatsapp_number`, `instagram_url`, `facebook_url`, `youtube_url`, `app_play_store_url`, `app_app_store_url` to `shop_settings`)
- `apps/api/src/modules/settings/footer.dto.ts` (Zod schema)
- `apps/shopkeeper/src/screens/settings/FooterSettingsScreen.tsx` (new — shopkeeper UI to edit columns)

**ADRs governing:** ADR-0008 (tenant config)
**Complexity:** S (≤ 1 day)

**Acceptance Criteria:**

**Given** Rajesh-ji has set Instagram and WhatsApp in footer settings
**When** any customer opens any web page of his shop
**Then** the footer shows: Online Shopping links column · Customer Service column · About column · Contact (address + phone + WhatsApp) · Social row · App download badges · Bottom bar (FAQ · Privacy · Terms · Sitemap)
**And** the Goldsmith platform brand is nowhere on the footer
**And** all icons are reachable by keyboard (Tab order matches visual order)
**And** all links have descriptive accessible names ("WhatsApp Rajesh Jewellers" not "wa")

**Given** Rajesh has not configured Instagram URL
**When** the customer opens any page
**Then** the Instagram icon is hidden (not a broken link)

**Given** axe-core CI runs on a sample storefront page
**Then** zero violations on the footer

**Tests required:** Unit (Footer rendering with all/no/some social links), accessibility (axe-core in CI), visual snapshot

**Definition of Done:** All AC + Codex review + axe-core green + browser smoke on customer-web confirming footer renders.

**Out of scope:** Newsletter signup form (T2.8 covers this), in-footer language toggle (kept in header).

---

### Story 17.3 (T1.3): Customer sees a trust-pillar strip on the homepage

**Class:** C — copy + 3 SVG icons; surfaces capabilities already implemented.
**Wave:** 7B-A · **Worktree:** `C:/gs17b-content/` · **Depends on:** none

**As an anchor jeweller's customer**,
I want to see a clear trust strip on the homepage announcing BIS certification, HUID verification, and the shop's return policy,
So that I trust the shop's authenticity before browsing further.

**FRs implemented:** FR128
**NFRs verified:** NFR-A6 (Devanagari + Hindi-first)
**Modules + packages touched:**
- `apps/customer-web/src/components/home/TrustStrip.tsx` (new — 3 columns with SVG icon + Hindi tagline)
- `apps/customer-mobile/src/components/home/TrustStrip.tsx` (new)
- `apps/customer-web/src/app/page.tsx` (mount above existing featured products)
- `apps/customer-mobile/app/(tabs)/index.tsx` (mount)

**ADRs governing:** ADR-0006 (UX direction Hindi-First Editorial)
**Complexity:** XS (≤ 4 h)

**Acceptance Criteria:**

**Given** any customer opens the homepage
**Then** the trust strip is visible above the fold on a 360-px-wide mobile and a 1280-px desktop
**And** the three pillars read "BIS प्रमाणित" · "HUID सत्यापित" · "वापसी / आदान-प्रदान"
**And** each pillar has an SVG icon at minimum 48×48 dp on mobile (NFR-A7)
**And** tapping the return-policy pillar navigates to `/return-policy` (existing route)
**And** color contrast on the strip ≥ 4.5:1 (NFR-A2)

**Tests required:** Visual snapshot (mobile + desktop), axe-core, navigation test

**Definition of Done:** All AC + Codex review + browser smoke.

**Out of scope:** "Lifetime exchange & buyback" pillar (gated on Q1).

---

### Story 17.4 (T1.4): Customer can filter products by price band on `/products`

**Class:** B — catalog API change + price computation + UI chip group.
**Wave:** 7B-B · **Worktree:** `C:/gs17b-struct/` · **Depends on:** none (price band uses live rate × net weight, already in API)

**As an anchor jeweller's customer**,
I want to filter the product list by price ranges (Under ₹10K, ₹10–20K, ₹20–30K, ₹30–50K, ₹50–75K, ₹75K+),
So that I can quickly narrow to what fits my budget without scrolling thousands of items.

**FRs implemented:** FR88 (price range — completion)
**NFRs verified:** NFR-P5 (API p95 < 200 ms reads), NFR-A1 (keyboard reachable filters)
**Modules + packages touched:**
- `apps/api/src/modules/catalog/catalog.controller.ts` (extend — `priceMinPaise` + `priceMaxPaise` query params)
- `apps/api/src/modules/catalog/catalog.service.ts` (extend — price computation in SQL using current rate snapshot)
- `apps/customer-web/src/components/products/PriceBandFilter.tsx` (new — chip group)
- `apps/customer-web/src/app/products/page.tsx` (mount filter, wire to query)
- `apps/customer-mobile/src/screens/browse/PriceBandFilter.tsx` (new)

**ADRs governing:** ADR-0010 (rate caching)
**Complexity:** S

**Acceptance Criteria:**

**Given** a customer opens `/products`
**When** they tap "₹10–20K"
**Then** the URL gains `?priceMin=1000000&priceMax=2000000` (paise)
**And** the API returns only products whose computed live price `(net_weight × current_rate + making + 3% GST + 5% making_GST)` falls in [10K, 20K]
**And** API p95 latency stays < 200 ms (NFR-P5)
**And** chip selection persists across pagination

**Given** the customer combines price band ₹50–75K with metal=gold
**Then** the SQL query AND-combines both filters and tenant context

**Given** the gold rate ticks during the customer's session
**Then** the filter still uses the rate that was current when the page loaded (snapshot consistency)

**Tests required:** Unit (price computation), Integration (controller + service + DB), Tenant-isolation, Performance (p95 budget)

**Definition of Done:** All AC + Codex review + API contract test + browser smoke.

**Out of scope:** Saved-filter persistence per customer (Phase 3+).

---

### Story 17.5 (T1.5): Customer can navigate via a mega-menu (Category × Metal × Price-band)

**Class:** B — header dropdown component; collections column is pass-2 (gated on T2.1).
**Wave:** 7B-B · **Worktree:** `C:/gs17b-struct/` · **Depends on:** 17.4 (price-band) for the price-band column
**Pass-2 (post-T2.1):** add Collections column once Story 18.1 lands (separate small follow-up story tracked in §12.4 sync point)

**As an anchor jeweller's customer**,
I want a mega-menu in the header that lets me drill into Category × Metal × Price-band combinations,
So that I can reach a curated product list in one click instead of multiple filter taps.

**FRs implemented:** FR87, FR88 (organization — completion)
**NFRs verified:** NFR-A3 (full keyboard navigation), NFR-A4 (ARIA listbox + menu)
**Modules + packages touched:**
- `apps/customer-web/src/components/layout/MegaMenu.tsx` (new)
- `apps/customer-web/src/components/layout/Header.tsx` (mount)
- `apps/customer-mobile/src/components/layout/CategoryDrawer.tsx` (new — drawer variant on mobile)

**ADRs governing:** ADR-0006
**Complexity:** M

**Acceptance Criteria:**

**Given** a customer hovers/taps the "श्रेणियाँ" header item on desktop
**Then** the mega-menu opens with three columns: Category (8 rows) · Metal (3 rows) · Price-band (6 rows)
**And** keyboard: Tab enters the menu, Arrow keys move between items, Enter selects, Escape closes
**And** ARIA: `role="menu"`, `aria-haspopup="true"` on trigger, `aria-expanded` toggles correctly
**And** clicking any combination produces a filtered `/products?category=<>&metal=<>&priceMin=<>` URL

**Given** the customer is on mobile (≤ 768 px width)
**Then** the trigger opens a bottom drawer with the same three sections collapsible

**Tests required:** Unit (menu state machine), accessibility (axe-core + keyboard interaction), visual snapshot, navigation E2E

**Definition of Done:** All AC + Codex review + browser smoke + screen-reader smoke on NVDA or VoiceOver.

**Out of scope:** Collections column (pass-2 follow-up story); Stone column (Phase 3+).

---

### Story 17.6 (T1.6): Customer can view shipping policy and cancellation policy pages

**Class:** C — mirror existing `/return-policy` pattern.
**Wave:** 7B-B · **Worktree:** `C:/gs17b-struct/` · **Depends on:** none

**As an anchor jeweller's customer**,
I want dedicated shipping and cancellation policy pages,
So that I can read each shop's specific terms before completing a try-at-home or rate-lock booking.

**FRs implemented:** FR129, FR130
**NFRs verified:** NFR-A1, NFR-A6
**Modules + packages touched:**
- `apps/customer-web/src/app/shipping-policy/page.tsx` (new — mirror return-policy)
- `apps/customer-web/src/app/cancellation-policy/page.tsx` (new)
- `apps/customer-mobile/src/screens/info/ShippingPolicyScreen.tsx` (new)
- `apps/customer-mobile/src/screens/info/CancellationPolicyScreen.tsx` (new)
- migration `0058_shop_settings_shipping_cancellation.sql` (add `shipping_policy_text` and `cancellation_policy_text` TEXT columns)
- `apps/shopkeeper/src/screens/settings/PoliciesScreen.tsx` (extend with two new editable fields)

**Complexity:** XS

**Acceptance Criteria:**

**Given** Rajesh-ji has filled the two new policy text fields
**When** any customer opens `/shipping-policy` or `/cancellation-policy`
**Then** the configured Markdown renders with TOC for headings
**And** absent shopkeeper text → page shows "इस दुकान ने नीति निर्धारित नहीं की है" (policy not set) — not 404

**Given** the page is rendered
**Then** Lighthouse SEO ≥ 90 (NFR-SE-2)

**Tests required:** Unit (Markdown render), Integration (settings CRUD), accessibility

**Definition of Done:** All AC + Codex review + browser smoke.

---

### Story 17.7 (T1.7): Customer can use in-app ring sizer and bangle sizer

**Class:** C — pure content + minimal JS for reference circles.
**Wave:** 7B-A · **Worktree:** `C:/gs17b-content/` · **Depends on:** none

**As an anchor jeweller's customer**,
I want a working ring sizer and bangle sizer page with reference circles and a paper-print method,
So that I can determine my size before booking try-at-home or buying online.

**FRs implemented:** FR104 (ring sizer), FR105 (bangle sizer)
**NFRs verified:** NFR-A1, NFR-A6, NFR-A7 (touch targets)
**Modules + packages touched:**
- `apps/customer-web/src/app/size-guide/page.tsx` (new — currently 404)
- `apps/customer-web/src/components/size-guide/RingSizerWidget.tsx` (new)
- `apps/customer-web/src/components/size-guide/BangleSizerWidget.tsx` (new)
- `apps/customer-mobile/src/screens/info/SizeGuideScreen.tsx` (new)

**Complexity:** S

**Acceptance Criteria:**

**Given** a customer opens `/size-guide`
**Then** the page shows three method tabs: "अंगूठी (Ring)" · "कंगन (Bangle)" · "प्रिंट (Print)"

**Given** the customer selects the Ring tab
**Then** they see reference circles labeled with Indian sizes (1–28) at correct mm diameters
**And** a "Place your existing ring on the circle" instruction in Hindi
**And** the page renders identically at 100% / 150% / 200% browser zoom (NFR-A5)

**Given** the customer selects "Print"
**Then** they see a printable paper ruler with a "press to print" button
**And** the print-style sheet preserves the 1:1 scale ruler

**Given** the customer is on mobile
**Then** all interactive elements (tabs, print button, "Show reference") are ≥ 48×48 dp (NFR-A7)

**Tests required:** Unit (size lookup table), Visual snapshot, accessibility, print-stylesheet smoke

**Definition of Done:** All AC + Codex review + browser smoke + verification that the previously-404 route now renders.

**Out of scope:** AR finger-measurement (Phase 3+).

---

### Story 17.8 (T1.8): Customer can view a per-tenant FAQ page

**Class:** C — editable Markdown blocks in shop_settings.
**Wave:** 7B-A · **Worktree:** `C:/gs17b-content/` · **Depends on:** none

**As an anchor jeweller's customer**,
I want a FAQ page populated by the shop with the questions they actually get asked,
So that I get answers without having to call the shop.

**FRs implemented:** FR131
**Modules + packages touched:**
- `apps/customer-web/src/app/faq/page.tsx` (new)
- `apps/customer-mobile/src/screens/info/FAQScreen.tsx` (new)
- migration `0059_shop_settings_faq.sql` (add `faq_blocks JSONB` — array of `{question, answer_md}`)
- `apps/shopkeeper/src/screens/settings/FAQEditorScreen.tsx` (new)

**Complexity:** XS

**Acceptance Criteria:**

**Given** Rajesh-ji adds 5 FAQ entries in shopkeeper settings
**When** a customer opens `/faq`
**Then** all 5 questions render as collapsible accordion items with Hindi headings rendered in Yatra One
**And** clicking a question expands the answer (Markdown-rendered)
**And** keyboard: Enter/Space toggles expand/collapse; ARIA `aria-expanded` updates

**Given** Rajesh has not set any FAQ
**Then** the page shows a Hindi placeholder explaining that FAQ is not yet set up

**Tests required:** Unit (Markdown render), Integration (settings CRUD), accessibility

**Definition of Done:** All AC + Codex review + browser smoke.

---

### Story 17.9 (T1.9): Customer can read platform-static buying guides for Gold, Diamond, Silver

**Class:** C — MDX content authored once, identical across tenants.
**Wave:** 7B-A · **Worktree:** `C:/gs17b-content/` · **Depends on:** none

**As an anchor jeweller's customer**,
I want educational guides on choosing gold, diamond, and silver jewellery,
So that I can make an informed decision before visiting the shop.

**FRs implemented:** FR132
**NFRs verified:** NFR-SE-2 (Lighthouse SEO), NFR-A6
**Modules + packages touched:**
- `apps/customer-web/src/app/buying-guide/[metal]/page.tsx` (new — dynamic route, validate metal slug ∈ {gold, diamond, silver})
- `apps/customer-web/src/content/buying-guides/gold.mdx` (new — written by platform team)
- `apps/customer-web/src/content/buying-guides/diamond.mdx` (new)
- `apps/customer-web/src/content/buying-guides/silver.mdx` (new)
- `apps/customer-mobile/src/screens/info/BuyingGuideScreen.tsx` (new — renders same MDX via @mdx-js/react)

**Complexity:** S (content authoring is the bulk; component is straightforward)

**Acceptance Criteria:**

**Given** a customer opens `/buying-guide/gold`
**Then** the page renders the gold-buying guide with TOC, headings, images
**And** unknown metal slugs (e.g. `/buying-guide/platinum`) return 404
**And** the page achieves Lighthouse SEO ≥ 90 (NFR-SE-2)
**And** the buying-guide content is identical across tenants (platform-static, no tenant config)

**Tests required:** Unit (MDX render), Integration (route guard for invalid slugs), Lighthouse SEO

**Definition of Done:** All AC + Codex review + browser smoke + content-team sign-off on text accuracy.

**Out of scope:** Per-tenant override of guide content (Phase 3+).

---

### Story 17.10 (T1.10): Customer sees "नए आगमन" and "लोकप्रिय" rails on homepage

**Class:** B — query change + 2 new home sections.
**Wave:** 7B-B · **Worktree:** `C:/gs17b-struct/` · **Depends on:** 17.1 (T1.1 images) for product cards to render real images

**As an anchor jeweller's customer**,
I want to see new arrivals and popular products on the homepage,
So that I discover fresh stock and what other customers are looking at.

**FRs implemented:** FR86 (new arrivals + featured collections — completion)
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/api/src/modules/catalog/catalog.controller.ts` (extend — GET `/catalog/new-arrivals` + GET `/catalog/popular`)
- `apps/api/src/modules/catalog/catalog.service.ts` (extend — `findNewArrivals(limit, daysWindow=14)` and `findPopular(limit, daysWindow=30)`)
- `apps/customer-web/src/components/home/NewArrivalsRail.tsx` (new)
- `apps/customer-web/src/components/home/PopularRail.tsx` (new)
- `apps/customer-mobile/src/components/home/NewArrivalsRail.tsx` (new)
- `apps/customer-mobile/src/components/home/PopularRail.tsx` (new)

**Complexity:** XS (queries straightforward; uses existing `viewing_analytics` for popular)

**Acceptance Criteria:**

**Given** the customer opens the homepage
**Then** "नए आगमन" rail shows up to 10 most recently published products (`published_at` desc, last 14 days)
**And** "लोकप्रिय" rail shows up to 10 most-viewed products in the last 30 days (sum of `view_count` from `viewing_analytics`)
**And** if either rail has < 3 items, the rail is hidden (no near-empty placeholder)
**And** API p95 latency < 200 ms (NFR-P5) — both queries must use existing indexes on `published_at` and `viewing_analytics(product_id, viewed_at)`

**Tests required:** Unit (service queries), Integration (controller + tenant scoping), Performance

**Definition of Done:** All AC + Codex review + browser smoke + EXPLAIN ANALYZE confirms index usage.

---

### Story 17.11 (T1.11): Customer-web emits per-tenant sitemap.xml and Schema.org structured data

**Class:** B — SEO infra; tenant-scoped sitemap regeneration.
**Wave:** 7B-B · **Worktree:** `C:/gs17b-struct/` · **Depends on:** none

**As an anchor jeweller**,
I want my customer storefront to be discoverable on Google with structured data so that Google Shopping and rich results pick up my products,
So that customers find my shop via search.

**FRs implemented:** FR133
**NFRs verified:** NFR-SE-1, NFR-SE-2
**Modules + packages touched:**
- `apps/customer-web/src/app/sitemap.xml/route.ts` (new — Next.js route emitting application/xml)
- `apps/customer-web/src/lib/seo/sitemap.ts` (new — query published products + collections + static pages)
- `apps/customer-web/src/components/seo/ProductJsonLd.tsx` (new — Schema.org Product)
- `apps/customer-web/src/components/seo/JewelryStoreJsonLd.tsx` (new — Schema.org JewelryStore on homepage)
- `apps/api/src/modules/catalog/catalog.events.ts` (extend — emit `product.published` / `product.unpublished` events)
- `apps/customer-web/src/lib/seo/sitemap-cache.ts` (new — 5-minute debounce, in-memory then Redis fallback)

**Complexity:** S

**Acceptance Criteria:**

**Given** Rajesh-ji publishes a new product
**When** 5 minutes pass
**Then** `GET /sitemap.xml` for Rajesh's tenant domain includes the new product URL
**And** `Content-Type: application/xml; charset=utf-8`

**Given** a customer opens any PDP
**Then** the rendered HTML contains a JSON-LD `<script type="application/ld+json">` block with Schema.org `Product` type containing `name`, `image`, `offers.price`, `brand`, `material`
**And** Google Rich Results Test validates the markup with no errors (CI uses Schema.org validator)

**Given** a customer opens the homepage
**Then** a `JewelryStore` JSON-LD block contains `name`, `address`, `telephone`, `openingHours` from shop_settings

**Given** Lighthouse SEO runs in CI on homepage and a sample PDP
**Then** both score ≥ 90 (NFR-SE-2)

**Tests required:** Unit (sitemap generation, JSON-LD shape), Integration (event-debounce → cache invalidation), Schema.org validation, Lighthouse SEO budget

**Definition of Done:** All AC + Codex review + browser smoke + Lighthouse SEO score ≥ 90 captured in CI artifacts.

**Out of scope:** Per-product OG-image generation (Phase 3+).

---

### Story 17.12 (T1.12): Customer can click WhatsApp and social media icons in header/footer

**Class:** C — tenant-config columns + click-to-chat link generation.
**Wave:** 7B-A · **Worktree:** `C:/gs17b-content/` · **Depends on:** 17.2 (T1.2 footer) for the rendering surface

**As an anchor jeweller's customer**,
I want a one-tap WhatsApp link to message the shop and clickable social media icons,
So that I can reach the shop via my preferred channel.

**FRs implemented:** FR134
**NFRs verified:** NFR-A1, NFR-A4
**Modules + packages touched:**
- `apps/customer-web/src/components/layout/SocialRow.tsx` (new — rendered inside Footer)
- `apps/customer-web/src/components/layout/WhatsAppButton.tsx` (new — sticky FAB on mobile web)
- `apps/customer-mobile/src/components/layout/WhatsAppButton.tsx` (new)
- (DB columns added by 17.2 migration — re-used here)

**Complexity:** XS

**Acceptance Criteria:**

**Given** Rajesh-ji has set `whatsapp_number = +91-9876543210` in footer settings
**When** a customer taps the WhatsApp icon
**Then** the device opens `https://wa.me/919876543210?text=<URL-encoded Hindi greeting>`
**And** Goldsmith brand is not in the greeting

**Given** Rajesh has set Instagram + Facebook URLs but not YouTube
**Then** the social row shows two icons (no YouTube placeholder)

**Given** axe-core runs
**Then** each icon has a descriptive accessible name in Hindi

**Tests required:** Unit (URL generation + URL-encoding), accessibility, visual snapshot

**Definition of Done:** All AC + Codex review + browser smoke confirming `wa.me` deep-link works on a real device.

---

## Epic 18: Customer Storefront Enrichment — post-launch polish to extend storefront depth

**Goal:** Add discovery, profile, and commerce-adjacent surfaces beyond table-stakes — collections, gift personas, recommendations, image zoom, EMI calculator, address book, newsletter opt-in, referral codes, sticky PDP CTAs.

**FRs covered:** FR135, FR136, FR137, FR138, FR139, FR140 (new) + FR93, FR96 (completion)
**NFRs verified:** NFR-A1, NFR-A4, NFR-A5, NFR-A6, NFR-IMG-1, NFR-SE-1
**Phase:** Phase 2 — Wave 7C (after Wave 7B merges)
**Dependencies:** Wave 7B merged; T1.1 image pipeline merged (cards need real images for T2.5/T2.6 to be meaningful)

---

### Story 18.1 (T2.1): Shopkeeper can assign products to named collections; customer can browse collection landing pages

**Class:** B — new tables + CRUD UI + new customer routes.
**Wave:** 7C-A · **Worktree:** `C:/gs18a-disc/` · **Depends on:** 17.1 (images for collection cover render); blocks: 18.2, mega-menu pass-2

**As an anchor jeweller**,
I want to group products into themed collections (Festival, Wedding, Bridal, Daily Wear, Gifting, Engagement, College, Office),
So that customers can browse curated themes that match their occasion.

**FRs implemented:** FR135 + FR86 (featured collections — completion)
**Modules + packages touched:**
- migration `0060_collections.sql` (new `collections` table — platform-defined enum slug + tenant FK + cover_image_id; new `product_collections` join table with RLS)
- `apps/api/src/modules/catalog/collections.controller.ts` (new — list collections, list products in collection)
- `apps/api/src/modules/catalog/collections.service.ts` (new)
- `apps/shopkeeper/src/screens/inventory/CollectionAssignScreen.tsx` (new — multi-select collections per product)
- `apps/customer-web/src/app/collections/[slug]/page.tsx` (new — collection landing)
- `apps/customer-mobile/src/screens/browse/CollectionScreen.tsx` (new)

**ADRs governing:** ADR-0008 (RLS on `product_collections`)
**Complexity:** M

**Acceptance Criteria:**

**Given** Rajesh-ji opens a product edit screen
**When** he selects "Wedding" + "Bridal" from the collections multi-select
**Then** two rows are inserted into `product_collections` with his shop_id
**And** RLS prevents him from assigning to another tenant's collection

**Given** a customer opens `/collections/wedding`
**Then** the page shows all products tagged Wedding for the current tenant
**And** the page is paginated (20 per page) with sort options (newest, price low-high, price high-low)
**And** the API returns 404 for unknown collection slugs

**Given** Rajesh-ji has not assigned any products to "Engagement"
**Then** `/collections/engagement` shows a Hindi empty state ("कोई आभूषण नहीं") — not 404

**Tests required:** Unit (service), Integration (controller + RLS), Tenant-isolation, E2E (assign → browse)

**Definition of Done:** All AC + Codex review + browser smoke + EXPLAIN confirms index on `(shop_id, collection_slug)`.

**Out of scope:** Custom shopkeeper-defined collection names (Q4 default = platform enum).

---

### Story 18.2 (T2.2): Customer can browse "Shop By Loved Ones" gift-persona pages

**Class:** B — reuses collections infra with persona tags.
**Wave:** 7C-A · **Worktree:** `C:/gs18a-disc/` · **Depends on:** 18.1 (shares persona-tag infrastructure)

**As an anchor jeweller's customer**,
I want curated gift-persona pages (पत्नी / बहन / माँ / मित्र / पिता / बेटी),
So that I can quickly find appropriate gifts for specific recipients without browsing whole categories.

**FRs implemented:** FR136
**Modules + packages touched:**
- migration `0061_gift_personas.sql` (extend `product_collections` to support `persona` slug — or add `product_personas` table)
- `apps/api/src/modules/catalog/personas.controller.ts` (new)
- `apps/customer-web/src/app/personas/[slug]/page.tsx` (new)
- `apps/customer-mobile/src/screens/browse/PersonaScreen.tsx` (new)
- `apps/customer-web/src/components/home/GiftPersonasSection.tsx` (new — homepage tile section)

**Complexity:** S

**Acceptance Criteria:**

**Given** a customer opens the homepage
**Then** a "किसके लिए?" persona section shows 6 persona tiles with labels in Hindi
**And** tapping पत्नी navigates to `/personas/wife`
**And** the persona page shows products tagged for that persona across all categories
**And** persona slugs are platform-defined enum (no shopkeeper-custom personas)

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + Codex review + browser smoke.

---

### Story 18.3 (T2.3): Customer can view their order/visit history timeline in profile

**Class:** B — aggregation across invoices, try-at-home, rate-locks, reviews; gated by linked_via_invoice.
**Wave:** 7C-B · **Worktree:** `C:/gs18b-prof/` · **Depends on:** none (customer-side aggregation)

**As an anchor jeweller's customer**,
I want a unified timeline in my profile showing my purchases, try-at-home bookings, rate-locks, and reviews,
So that I can recall my activity with this shop in one place.

**FRs implemented:** FR96 (completion)
**NFRs verified:** NFR-S3 (PII isolation), NFR-A1
**Modules + packages touched:**
- `apps/api/src/modules/customer/customer-timeline.controller.ts` (new — `/api/v1/customer/me/timeline`)
- `apps/api/src/modules/customer/customer-timeline.service.ts` (new — UNION query across invoices, try_at_home_bookings, rate_locks, reviews ORDER BY ts DESC)
- `apps/customer-web/src/app/profile/timeline/page.tsx` (new)
- `apps/customer-mobile/src/screens/profile/TimelineScreen.tsx` (new)

**ADRs governing:** ADR-0009
**Complexity:** M

**Acceptance Criteria:**

**Given** a logged-in customer Priya has 3 invoices, 2 try-at-home bookings, 1 rate-lock, and 2 reviews on Rajesh's shop
**When** she opens her profile timeline
**Then** all 8 events render in reverse-chronological order with type-specific icons + Hindi labels
**And** invoice events are gated by `linked_via_invoice = true` per FR100
**And** other tenants' data never appears (tenant-scoped query)
**And** API p95 latency < 200 ms (NFR-P5)

**Given** Priya has zero events
**Then** the page shows a Hindi welcome message ("अपनी पहली खरीदारी से शुरुआत करें") — not an empty list

**Tests required:** Unit, Integration, Tenant-isolation, RLS, Performance

**Definition of Done:** All AC + Codex review + browser smoke.

**Out of scope:** Cross-tenant unified timeline (DPDPA-incompatible).

---

### Story 18.4 (T2.4): Customer can save up to 5 named addresses in their profile

**Class:** B — new table + CRUD UI; DPDPA-compliant.
**Wave:** 7C-B · **Worktree:** `C:/gs18b-prof/` · **Depends on:** none

**As an anchor jeweller's customer**,
I want to save my home, office, and parents' addresses with labels,
So that I can use them quickly for try-at-home delivery or invoice billing without re-typing.

**FRs implemented:** FR139
**NFRs verified:** NFR-S3 (PII encrypted at rest), NFR-C6 (DPDPA — deletion via FR63 honoured)
**Modules + packages touched:**
- migration `0062_customer_addresses.sql` (new table with FK to customers, RLS, soft-delete column)
- `apps/api/src/modules/customer/addresses.controller.ts` (new)
- `apps/api/src/modules/customer/addresses.service.ts` (new — enforce 5-address cap)
- `apps/customer-web/src/app/profile/addresses/page.tsx` (new)
- `apps/customer-mobile/src/screens/profile/AddressesScreen.tsx` (new)

**Complexity:** S

**Acceptance Criteria:**

**Given** Priya has 4 saved addresses
**When** she adds a 5th
**Then** it succeeds
**And** when she tries to add a 6th
**Then** the API returns 409 Conflict with Hindi error "पते की सीमा 5 है"

**Given** Priya marks an address as "default delivery"
**Then** all other addresses' `is_default_delivery = false` (atomic update)

**Given** Priya invokes DPDPA delete on her account (FR63)
**Then** all her addresses are removed within 30 days alongside the customer record

**Tests required:** Unit, Integration, Tenant-isolation, DPDPA cascade test

**Definition of Done:** All AC + Codex review + browser smoke.

---

### Story 18.5 (T2.5): Customer sees "Recommended for you" rail on the PDP

**Class:** B — same-category + adjacent-weight-band query.
**Wave:** 7C-A · **Worktree:** `C:/gs18a-disc/` · **Depends on:** 17.1 (cards need real images)

**As an anchor jeweller's customer**,
I want to see other products similar to the one I'm viewing,
So that I find alternatives in my preferred style and weight band.

**FRs implemented:** FR137
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/api/src/modules/catalog/catalog.service.ts` (extend — `findRecommended(productId, limit=6)`)
- `apps/api/src/modules/catalog/catalog.controller.ts` (extend — GET `/catalog/products/:id/recommended`)
- `apps/customer-web/src/components/products/RecommendedRail.tsx` (new — render below price breakdown on PDP)
- `apps/customer-mobile/src/components/products/RecommendedRail.tsx` (new)

**Complexity:** S

**Acceptance Criteria:**

**Given** a customer opens PDP for a 7g gold ring
**Then** "आपको ये भी पसंद आ सकता है" rail shows up to 6 other gold rings with net weight in [5.6 g, 8.4 g] (±20%)
**And** the current product is excluded
**And** out-of-stock products are excluded
**And** API p95 latency < 200 ms (NFR-P5)

**Given** there are fewer than 3 matching products
**Then** the rail is hidden (no near-empty rail)

**Tests required:** Unit (recommendation query), Integration, Performance

**Definition of Done:** All AC + Codex review + browser smoke.

**Out of scope:** Collaborative-filtering / ML-based recommendations (Phase 3+).

---

### Story 18.6 (T2.6): Customer can zoom into product images on the PDP

**Class:** B — image zoom + 360° hook (data shape only, capture out of scope).
**Wave:** 7C-A · **Worktree:** `C:/gs18a-disc/` · **Depends on:** 17.1 (real images required)

**As an anchor jeweller's customer**,
I want to zoom into product images to see craftsmanship detail,
So that I can evaluate the piece visually before booking try-at-home.

**FRs implemented:** FR90 extension (multi-image)
**NFRs verified:** NFR-IMG-1, NFR-A1, NFR-A7
**Modules + packages touched:**
- `apps/customer-web/src/components/products/ZoomableImage.tsx` (new — pointer/touch zoom)
- `apps/customer-mobile/src/components/products/ZoomableImage.tsx` (new — pinch zoom + double-tap zoom)
- migration `0063_product_images_360.sql` (extend `product_images` with `is_360_frame BOOLEAN DEFAULT false` + `frame_index INT NULL` — data shape for future 360° capture; not yet rendered)

**Complexity:** S

**Acceptance Criteria:**

**Given** a customer hovers over a desktop PDP image
**Then** the cursor area shows a 2× magnified view inset
**And** keyboard `+` / `-` zoom in/out (NFR-A1)
**And** Esc closes the zoom

**Given** a customer pinches a mobile PDP image
**Then** the image zooms up to 3× max with smooth transform
**And** double-tap toggles between 1× and 2.5×

**Given** images are tagged `is_360_frame = true`
**Then** they are not rendered in the gallery (held for Phase 3+ 360° viewer)

**Tests required:** Unit (zoom math), Integration (touch + pointer events), accessibility, visual

**Definition of Done:** All AC + Codex review + browser smoke + mobile device smoke.

**Out of scope:** Actual 360° viewer (Phase 3+); the migration only reserves the data shape.

---

### Story 18.7 (T2.7): Customer sees an EMI calculator tile on PDP for products ≥ ₹50,000

**Class:** B — display-only (Q2 default = no live integration).
**Wave:** 7C-B · **Worktree:** `C:/gs18b-prof/` · **Depends on:** 17.4 (price computation pattern)

**As an anchor jeweller's customer**,
I want to see what an EMI on this jewellery would look like before walking into the shop,
So that I can plan my budget for high-ticket purchases.

**FRs implemented:** FR138
**Modules + packages touched:**
- `apps/customer-web/src/components/products/EmiCalculator.tsx` (new — display-only)
- `apps/customer-mobile/src/components/products/EmiCalculator.tsx` (new)
- `packages/money/src/emi.ts` (new — pure compute: monthly instalment given principal + tenure + APR; no payment integration)

**Complexity:** S

**Acceptance Criteria:**

**Given** a customer opens a PDP with computed price ≥ ₹50,000
**Then** an EMI tile is visible below the price breakdown
**And** the tile shows monthly instalments for 3, 6, 9, 12-month tenures at a configurable display APR (default 12% — labeled "अनुमानित" / estimated; no obligation)
**And** a Hindi disclaimer line states "EMI शुरू करने के लिए दुकान से संपर्क करें" (contact shop to start EMI — no online checkout)

**Given** the product price is ₹49,999
**Then** the EMI tile is hidden

**Given** the customer changes the product variant and the price drops below ₹50,000
**Then** the EMI tile hides reactively

**Tests required:** Unit (EMI compute), Visual snapshot

**Definition of Done:** All AC + Codex review + browser smoke + legal sign-off on disclaimer wording (Q2 default applies).

**Out of scope:** Live Razorpay/Bajaj EMI integration (Phase 3+).

---

### Story 18.8 (T2.8): Customer can opt in to newsletter / WhatsApp marketing with DPDPA consent

**Class:** B — extends existing notification_preferences with DPDPA explicit-consent default.
**Wave:** 7C-B · **Worktree:** `C:/gs18b-prof/` · **Depends on:** 17.2 (footer signup form)

**As an anchor jeweller**,
I want a footer signup form that lets visitors opt in to my WhatsApp / email broadcasts,
So that I can build a marketing list without violating DPDPA explicit-consent rules.

**FRs implemented:** FR111 extension (opt-in marketing); also closes part of FR140 (referral first-touchpoint)
**NFRs verified:** NFR-C6 (DPDPA explicit consent), NFR-A1
**Modules + packages touched:**
- `apps/customer-web/src/components/layout/NewsletterSignup.tsx` (new — within Footer)
- `apps/customer-mobile/src/screens/profile/MarketingPreferencesScreen.tsx` (new)
- `apps/api/src/modules/notifications/marketing-optin.controller.ts` (new — POST `/marketing/optin` with consent timestamp)
- (uses existing `notification_preferences` table — no migration needed; extend Zod schema)

**Complexity:** XS

**Acceptance Criteria:**

**Given** a non-logged-in visitor enters phone number in the footer signup
**When** they submit
**Then** the consent checkbox is **unchecked by default** (Q3 default = DPDPA explicit consent) and they must tick it
**And** the consent text in Hindi spells out: channel (WhatsApp/email), frequency (monthly), and right-to-revoke
**And** the API records `consent_granted_at = NOW()`, `consent_text_hash = sha256(<rendered consent text>)` for audit

**Given** the visitor unticks consent and submits
**Then** the API returns 400 with Hindi error "जारी रखने के लिए सहमति आवश्यक है"

**Given** an opted-in customer revokes via FR111 toggle
**Then** all future broadcasts skip them within 24 hours

**Tests required:** Unit, Integration (consent capture + audit), Tenant-isolation

**Definition of Done:** All AC + Codex review + browser smoke + legal review of consent text.

---

### Story 18.9 (T2.9): Customer can enter a referral code at signup; bonuses accrue on first invoice

**Class:** B — new column on customers + loyalty bonus event in BillingService.
**Wave:** 7C-B · **Worktree:** `C:/gs18b-prof/` · **Depends on:** none

**As an anchor jeweller**,
I want a referral program where existing customers refer friends and both earn loyalty points on the new customer's first invoice,
So that I grow my customer base via word-of-mouth.

**FRs implemented:** FR140
**Modules + packages touched:**
- migration `0064_referral_codes.sql` (add `referral_code TEXT UNIQUE per shop_id` + `referred_by_customer_id UUID` to `customers`)
- `apps/api/src/modules/customer/referral.service.ts` (new — generate, validate, attribute)
- `apps/api/src/modules/billing/billing.service.ts` (extend — emit `customer.firstInvoice` event for loyalty bonus)
- `apps/api/src/modules/loyalty/loyalty.service.ts` (extend — award referral bonus to both referrer and new customer)
- `apps/customer-web/src/app/(auth)/signup/page.tsx` (extend — referral code field optional)
- `apps/customer-mobile/src/screens/auth/SignupScreen.tsx` (extend)

**Complexity:** S

**Acceptance Criteria:**

**Given** Priya signs up with referral code "RAJ-PRIYA-001" (which belongs to existing customer Anita)
**When** she completes her first invoice
**Then** Anita's loyalty ledger gets `referral_bonus = configurable_amount` (default 100 pts)
**And** Priya's loyalty ledger gets `welcome_bonus = configurable_amount` (default 50 pts)
**And** subsequent invoices do NOT trigger another bonus (first-invoice only)

**Given** Priya signs up with an invalid referral code
**Then** signup succeeds but no referral attribution is recorded

**Given** the shopkeeper toggles `feature_flags.referral_program = false` per FR3
**Then** referral codes stop accruing on new signups

**Given** the same code is used by 1000 new customers
**Then** the referrer accrues 1000 × bonus (no per-month cap by default; cap is configurable via shop_settings)

**Tests required:** Unit (code generation + validation), Integration (signup → first invoice → bonus accrual), Tenant-isolation

**Definition of Done:** All AC + Codex review + browser smoke.

**Out of scope:** Cross-tenant referral codes (forbidden by RLS).

---

### Story 18.10 (T2.10): Customer experiences a polished PDP with sticky CTAs, breadcrumbs, and product share

**Class:** C — pure layout/CSS + share button.
**Wave:** 7C-A · **Worktree:** `C:/gs18a-disc/` · **Depends on:** 17.1 (real images for the polished gallery to look right)

**As an anchor jeweller's customer**,
I want a polished PDP with breadcrumbs at the top, sticky try-at-home / wishlist CTAs as I scroll, and a share button,
So that I can navigate back, take action without scrolling, and share the product with my partner.

**FRs implemented:** FR93 (share — completion), FR90 polish
**NFRs verified:** NFR-A1, NFR-A7
**Modules + packages touched:**
- `apps/customer-web/src/components/products/PdpStickyCtas.tsx` (new)
- `apps/customer-web/src/components/products/Breadcrumbs.tsx` (new)
- `apps/customer-web/src/components/products/ShareButton.tsx` (new — Web Share API + WhatsApp deep link + copy fallback)
- `apps/customer-mobile/src/components/products/PdpStickyCtas.tsx` (new)
- `apps/customer-mobile/src/components/products/ShareButton.tsx` (new — React Native Share API + WhatsApp deep link)

**Complexity:** XS

**Acceptance Criteria:**

**Given** a customer opens a PDP on desktop
**Then** breadcrumbs render at the top: Home › Category › Product
**And** as the user scrolls past the price breakdown, the try-at-home + wishlist CTAs become sticky at the bottom of the viewport

**Given** the customer taps "Share"
**Then** on mobile the OS Share sheet opens (Web Share API)
**And** on desktop a small popover offers WhatsApp + Copy Link

**Given** the customer is on a 360-px-wide screen
**Then** the sticky CTAs do not occlude content (≥ 16 px padding above bottom)
**And** every CTA is ≥ 48×48 dp (NFR-A7)

**Tests required:** Unit (share URL generation), accessibility (axe-core), visual snapshot at multiple widths

**Definition of Done:** All AC + Codex review + browser smoke + mobile device smoke (Web Share API only works on real devices).

---

## Wave + worktree summary

| Wave | Worktree | Stories | Class mix | Notes |
|---|---|---|---|---|
| **7A** | `C:/gs17a-img/` | 17.1 (T1.1) | A × 1 | Sequential, fresh-session plan + exec; blocks ~6 downstream stories |
| **7B-A** (content track) | `C:/gs17b-content/` | 17.2 · 17.3 · 17.7 · 17.8 · 17.9 · 17.12 | C × 6 | Class C can batch 2-3 per session |
| **7B-B** (structural track) | `C:/gs17b-struct/` | 17.4 · 17.5 · 17.6 · 17.10 · 17.11 | B × 4, C × 1 | One Codex review per branch |
| **7C-A** (discovery track) | `C:/gs18a-disc/` | 18.1 · 18.2 · 18.5 · 18.6 · 18.10 | B × 4, C × 1 | 18.1 first; 18.2/18.5 depend on 18.1 |
| **7C-B** (profile/commerce track) | `C:/gs18b-prof/` | 18.3 · 18.4 · 18.7 · 18.8 · 18.9 | B × 5 | All independent within track |
| **7D** (merge train) | (main) | — | — | Pre-flight audit per `feedback_pre_merge_train_audit.md`; sequential merge 7A → 7B-A → 7B-B → 7C-A → 7C-B; tag `pre-launch-rc-1` |

**Concurrency:** Max 2 parallel tracks · Max 5 holding branches · Codex queue ≤ 5 · One Class A story at a time (only 17.1 is Class A).

**Migration sequence reservation:** 0056 (product_images) · 0057 (footer columns) · 0058 (shipping/cancellation) · 0059 (FAQ) · 0060 (collections) · 0061 (gift_personas) · 0062 (customer_addresses) · 0063 (product_images_360) · 0064 (referral_codes). Numbers are pre-assigned to avoid the 0037 collision pattern observed in the prior merge train (`memory/project_merge_train_2026_04_29.md`). If a wave merges in unexpected order, the merging session must rebase-and-renumber per the merge-train runbook.

---

## Phase 1 acceptance for Epic 17 + 18

- [x] All 22 stories drafted with Class, Wave, Worktree, Dependencies
- [x] BDD acceptance criteria written for each story
- [x] FRs + NFRs traced per story
- [x] Migrations pre-assigned 0056–0064
- [x] Wave + concurrency summary written
- [ ] Codex cross-model review on this file + addendum (substitute gate per `feedback_codex_worktree_clm.md` if Worktree CLM blocks)
- [ ] Committed to main alongside addendum + PRD §1009 cross-link

When all six are checked, Phase 2 wave 7A (Story 17.1 — image-upload pipeline) is unblocked.
