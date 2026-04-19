---
generatedBy: 'Opus main orchestrator'
epic: 'E7 (part 1 of 2: stories 7.1-7.10)'
date: '2026-04-17'
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Epic 7 is the largest UX surface in the project. Customer app must be ASPIRATIONAL per user
    directive (comparable to CaratLane/Tanishq/Kalyan). Part 1 covers foundation + browse + PDP +
    HUID ceremony + wishlist + share + inquire (stories 7.1-7.10). Part 2 covers store info +
    profile + gift mode + white-label lock + language + reviews + size guides + policies.
  - >
    Every Epic 7 story includes mandatory checks: (a) Semgrep `no-hex-in-customer-app` pass,
    (b) Chromatic visual-regression across 2 tenant themes, (c) platform-brand-invisibility assertion,
    (d) Hindi+English i18n coverage, (e) WCAG 2.1 AA via axe-core + Lighthouse.
  - >
    Note: Locked design direction is **Direction 5 — Hindi-First Editorial** (2026-04-17; supersedes Direction C).
    Tokens source from `design-directions-v2/customer-aspirational/direction-5-hindi-first-editorial/`.
    Yatra One (display) + Mukta Vaani (secondary) + Tiro Devanagari Hindi (body serif) + Fraunces italic (Latin secondary);
    aged-gold `#B58A3C` primary, terracotta blush `#D4745A` accent, cream `#F5EDDD`, indigo ink `#1E2440`.
    Stories reference design tokens from packages/ui-tokens; acceptance-criteria hex literals below are Direction C residue —
    resolve via packages/ui-tokens during Story E7-S1 execution, do not retain literals.
---

---

## Epic 7: Customer opens the jeweller's app, sees live rate, browses catalog, scans HUID QR to verify — all in the jeweller's brand

**Goal:** Customer-facing app + web matches CaratLane/Tanishq/Kalyan aspirational quality. 60-second browse-to-HUID-verify loop. White-label rigorously enforced. Hindi-first.

**FRs covered:** FR5 (tenant isolation customer-read-path), FR30 (30-sec reflect customer side), FR86, FR87, FR88, FR89, FR90, FR91, FR92, FR93, FR94, FR95, FR96, FR97, FR98, FR99, FR100, FR101, FR102, FR103, FR104, FR105, FR106
**Phase:** Phase 1 — Sprint 5-7
**Dependencies:** Epic 1 (auth), Epic 3 (inventory + sync), Epic 4 (rate + formula), Epic 6 Story 6.1 (customer record)

---

### Story 7.1: Customer opens the jeweller's branded app and sees 4-second ArrivalSequence with live rate + featured pieces

**Class:** B — Customer-web shell + tenant-theming; no auth/compliance/money.

**As a Customer (Priya opening the Anchor Jewellers app for the first time via WhatsApp link)**,
I want a 4-second arrival that establishes the jeweller's brand immediately — logo, Hindi greeting, today's gold rate, featured pieces — before I even tap anything,
So that I instantly know this is a premium trusted jeweller, not a generic e-commerce app.

**FRs implemented:** FR86 (home), FR30 (30s sync from Epic 3 — verified on customer side)
**NFRs verified:** NFR-P1 (cold-start ≤ 60s on 4G), NFR-P2 (FMP < 2.5s web), NFR-P8 (first-load JS ≤ 250KB), NFR-A1-A9 (accessibility)
**Modules + packages touched:**
- `apps/customer/app/_layout.tsx` (new — tenant theme resolution from domain/deep-link)
- `apps/customer/app/(tabs)/index.tsx` (new — home screen)
- `apps/web/src/app/layout.tsx` (new — tenant theme via Next.js middleware)
- `apps/web/src/app/page.tsx` (new — SSR home)
- `apps/web/src/middleware.ts` (new — resolve tenant from host CNAME; inject CSS vars)
- `packages/ui-mobile/business/ArrivalSequence.tsx` (new — UX-DR8 designed moment)
- `packages/ui-web/business/ArrivalSequence.tsx` (new)
- `apps/customer/src/providers/{ThemeProvider,TenantProvider,AuthProvider}.tsx` (new)
- `packages/ui-theme/src/resolve.ts` (used — `resolveTheme(tenantConfig) → ResolvedTokens`)
- `apps/api/src/modules/catalog/catalog.controller.ts` (extend — `GET /api/v1/catalog/home?tenantSlug=X` public endpoint returning rate + featured)

**ADRs governing:** ADR-0002, ADR-0007 (polling), ADR-0008 (white-label theming)
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6 (tokens only no hex), MUST #7 (i18n), MUST #8
**Complexity:** L

**Acceptance Criteria:**

**Given** Priya taps a WhatsApp deep-link `goldsmith://anchor-jewellers/` OR opens the web URL `anchorjewellers.app`
**When** the app/site loads
**Then** ArrivalSequence renders for 4 seconds: anchor logo (center-stage, tenant brand) + Hindi greeting ("नमस्ते, स्वागत है") + today's 22K rate pill + subtle fade to home
**And** home shows: Hero image (aspirational model-worn shot; editorial full-bleed), Today's rate widget (compact variant Story 4.4), Featured collection story block with 3-5 items, Category pills, Live rate strip
**And** platform brand "Goldsmith" appears nowhere (ESLint + Semgrep + Chromatic VR all enforce)
**And** first meaningful paint < 2.5s on 4G-throttled (Lighthouse CI gate)

**Given** `prefers-reduced-motion: reduce`
**When** ArrivalSequence fires
**Then** 0-duration fade; static arrival; no motion

**Given** the app is on a Xiaomi Redmi mid-tier Android (test device)
**When** cold-start timed on 4G
**Then** first interactive frame ≤ 60s p95 (NFR-P1)

**Given** CI runs
**When** pipeline executes
**Then** Chromatic VR tests pass for home screen rendered in 2 tenant themes (anchor + mock Raj Jewellers Kanpur with deep-green seed)
**And** Semgrep `no-hex-in-customer-app` passes
**And** Semgrep `no-platform-brand-import` passes (no `@/assets/platform-*` imports)
**And** axe-core + Lighthouse CI score ≥ 90 accessibility + ≥ 90 performance

**Tests required:** Unit (theme resolution correctness), Integration (catalog/home endpoint + tenant-scoped response), Tenant-isolation (tenant A catalog never returns tenant B data), E2E (full arrival flow on Android emulator with hi-IN locale), VR (Chromatic), A11y (axe-core), Load (NFR-P1 cold-start)

**Definition of Done:** All AC + 10 CI gates + Storybook ArrivalSequence + home screen composed + Chromatic VR 2-tenant green + 5 review layers.

---

### Story 7.2: Customer signs up via phone OTP with privacy consent toggle for viewing tracking

**Class:** A — Customer-app phone-OTP signup flow in apps/api/src/modules/auth.

**As a Customer (Priya deciding to use the app beyond browsing)**,
I want a simple phone-OTP signup with a clear opt-in toggle for "Recent activity tracking" (default-on but one-tap off),
So that I can save wishlists/custom orders without feeling tracked against my will.

**FRs implemented:** FR9 (customer OTP), FR68 (consent at signup — pre-requisite for Epic 12)
**NFRs verified:** NFR-S4 (rate-limit), NFR-C6 (DPDPA consent capture), NFR-C9 (child data — 18+ attestation)
**Modules + packages touched:**
- `apps/customer/app/(auth)/signup.tsx` + `otp.tsx` + `consent.tsx` (new)
- `apps/api/src/modules/auth/auth.service.ts` (extend — customer role signup path reusing Supabase Auth adapter from Epic 1)
- `packages/db/src/schema/viewing-consent.ts` (used — from Epic 6 Story 6.9 schema foundation)

**ADRs governing:** ADR-0001, ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** a Customer on signup flow
**When** they enter phone + verify OTP + tap 18+ attestation
**Then** account creates with `customer_tenant_link(customer_id, shop_id, opted_in_viewing: true)` row
**And** consent screen shows Hindi copy: "क्या हम याद रख सकते हैं कि आपने क्या देखा?" with default-on toggle + one-tap off
**And** marketing-consent toggle SEPARATE from transactional (NFR-C6 dual consent)

**Given** a Customer under 18 attempts signup
**When** attestation is unchecked
**Then** gentle Hindi block: "18 वर्ष से कम उम्र — माता-पिता के ख़ाते से please" with parental-consent flow link

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (signup + consent persistence), Tenant-isolation, E2E

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 7.3: Customer browses products by category with live-synced availability

**Class:** B — Catalog browse by category; tenant-scoped reads on a safe surface.

**As a Customer (Priya browsing bridal sets)**,
I want to tap "दुल्हन" and see every published bridal piece with live availability — pieces sold earlier today disappear within 30 seconds,
So that I never fall in love with something already sold.

**FRs implemented:** FR87, FR30 (customer-read side of sync)
**NFRs verified:** NFR-P6 (< 30s sync lag), NFR-P8, NFR-SC4
**Modules + packages touched:**
- `apps/customer/app/browse/[category].tsx` (new — category listing; Expo Router)
- `apps/web/src/app/browse/[category]/page.tsx` (new — Next.js SSG with ISR for SEO)
- `apps/api/src/modules/catalog/catalog.controller.ts` (extend — `GET /api/v1/catalog/products?category=X&cursor=Y`)
- `apps/customer/src/features/catalog/hooks/useProductsInfinite.ts` (new — TanStack Query infinite + 5s refetchInterval for hot data)
- `packages/ui-mobile/business/ProductCard.tsx` (new Tier 3 — 3 variants: grid/list/feature)
- `packages/ui-web/business/ProductCard.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0007, ADR-0008
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6, MUST #7, MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** Priya taps "दुल्हन" category
**When** catalog page loads
**Then** infinite-scroll grid of ProductCards renders: image + Hindi title + English subtitle + weight/purity meta + price (packages/money formatted)
**And** cards refresh every 5s (sync cursor consumption)
**And** "sold" items fade out within 30s of shopkeeper's status update (tested against Epic 3 Story 3.4)

**Given** a piece sells elsewhere while Priya is on the page
**When** next refetch interval hits
**Then** card updates to "Sold" state within 30s p95

**Given** CI runs, all gates pass (tenant-isolation + Chromatic VR + a11y)

**Tests required:** Unit, Integration, Tenant-isolation, E2E (browse + refresh interval verification), VR (ProductCard 3 variants × 2 tenant themes)

**Definition of Done:** All AC + 10 CI gates + Storybook ProductCard + 5 review layers.

---

### Story 7.4: Customer filters products by metal, purity, price range, occasion, in-stock-only

**Class:** B — Catalog filtering; no money/weight primitives touched.

**As a Customer (Priya looking for 22K bridal between ₹3-5 lakh)**,
I want to narrow the catalog with additive filters that apply instantly,
So that I see only pieces that match my budget and preferences.

**FRs implemented:** FR88
**NFRs verified:** NFR-P5 (filter + render < 200ms API)
**Modules + packages touched:**
- `apps/customer/src/features/catalog/components/FilterSheet.tsx` (new)
- `apps/web/src/features/catalog/components/FilterSidebar.tsx` (new — desktop layout)
- `packages/ui-mobile/atoms/CategoryPill.tsx` (used — from Story 3.1)
- `apps/api/src/modules/catalog/catalog.service.ts` (extend — filter query builder)

**ADRs governing:** ADR-0002, ADR-0006 (Meilisearch)
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya opens filters
**When** she selects Gold + 22K + ₹3L-5L + Occasion:Wedding
**Then** results update live (debounced 300ms) via Meilisearch query
**And** filter chips visible at top; "Clear" + "Apply N results" CTAs visible

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, E2E, A11y

**Definition of Done:** All AC + 10 CI gates + Storybook FilterSheet + 5 review layers.

---

### Story 7.5: Customer searches products by free text in Hindi or English

**Class:** B — Catalog free-text search (Hindi/English) via Meilisearch.

**As a Customer (Priya thinking "kundan earrings")**,
I want to type "kundan" OR "कुंदन" and get matching results — script doesn't matter,
So that language is never a barrier.

**FRs implemented:** FR89
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/customer/app/browse/search.tsx` (new)
- `packages/integrations/search/meilisearch-adapter.ts` (used — transliteration mapping)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #5, MUST #6, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya types "kundan" in search
**When** query fires (300ms debounce)
**Then** Meilisearch returns matches in Hindi (कुंदन) AND English via transliteration; results ordered by relevance
**And** similar treatment for "mangalsutra", "polki", "jhumka"

**Given** CI runs, all gates pass

**Tests required:** Unit (transliteration mapping), Integration, E2E, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 7.6: Customer views product detail with images + full price breakdown + HUID + certification

**Class:** B — Product detail page reads packages/money display; no new money/compliance logic.

**As a Customer (Priya deciding on the श्रेया bridal set)**,
I want to see: multiple lifestyle + product images, full transparent price breakdown (weight × rate + making + stones + GST), HUID + BIS certification, weight/purity specs, description, availability,
So that I can make an informed, family-consulted decision without a phone call to the shop.

**FRs implemented:** FR90
**NFRs verified:** NFR-P2 (FMP < 2.5s), NFR-P9 (ImageKit image delivery p95 < 500ms thumbs)
**Modules + packages touched:**
- `apps/customer/app/product/[id].tsx` (new)
- `apps/web/src/app/product/[id]/page.tsx` (new — SSR for SEO + Schema.org Product markup)
- `packages/ui-mobile/business/ProductDetailSpec.tsx` (new Tier 3 — composes PriceBreakdownCard, HUIDMedallion, ShopCard, ImageGallery)
- `packages/ui-mobile/atoms/PriceBreakdownCard.tsx` (new Tier 2)
- `packages/ui-mobile/atoms/ShopCard.tsx` (new Tier 2)
- `packages/ui-mobile/atoms/ImageGallery.tsx` (new — main + thumbs with pinch-zoom + 360° placeholder + video placeholder)

**ADRs governing:** ADR-0007, ADR-0008
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #6, MUST #7
**Complexity:** L

**Acceptance Criteria:**

**Given** Priya taps the श्रेया bridal card from catalog
**When** PDP loads
**Then** hero image gallery (6 images: lifestyle model + product + detail + 360° placeholder + video placeholder) renders above the fold
**And** title (Rozha One display Devanagari) + English subtitle + weight/purity meta
**And** PriceBreakdownCard with full formula breakdown
**And** HUIDMedallion prominent (tap-to-verify transitions to Story 7.7)
**And** ShopCard showing jeweller + since-year + BIS cert + avg rating + review count
**And** primary CTA "आज का भाव लॉक करें · ₹5,000 deposit" (to Story 9.1 rate-lock)
**And** ghost CTAs: Wishlist, Share, Try at Home, Inquire at Shop

**Given** CI runs, all gates pass including Chromatic VR for PDP in 2 tenant themes

**Tests required:** Unit (price breakdown correctness), Integration, Tenant-isolation, E2E (browse → tap product → PDP loads < 2.5s FMP), VR, A11y, SEO (Schema.org markup validates)

**Definition of Done:** All AC + 10 CI gates + Storybook PDP + Chromatic VR + 5 review layers.

---

### Story 7.7: Customer taps HUID QR scan → BIS-verified ceremony fires (designed moment)

**Class:** A — HUID QR scan → BIS/Surepass verify (compliance hard-block integration).

**As a Customer (Vikram first-time visitor from out-of-town)**,
I want to scan the HUID QR code and see a cryptographically real BIS verification — not a fake seal — within 2 seconds,
So that I trust this jeweller before I hand over ₹85,000 cash.

**FRs implemented:** FR91
**NFRs verified:** NFR-I2 (Surepass circuit breaker + fallback)
**Modules + packages touched:**
- `apps/customer/app/huid-scan.tsx` (new — camera + QR scan)
- `packages/ui-mobile/business/HUIDCeremony.tsx` (new Tier 3 — UX-DR10 designed moment; 0.8s scan pulse + 1.2s seal materialize + soft chime + medium haptic)
- `packages/ui-mobile/atoms/HUIDMedallion.tsx` (new Tier 2 — 4 states: verified/pending/unverified/n-a)
- `packages/integrations/huid-verification/surepass-adapter.ts` (new)
- `packages/integrations/huid-verification/port.ts` (new)
- `apps/api/src/modules/catalog/huid-verify.controller.ts` (new — `POST /api/v1/catalog/huid/verify` proxying Surepass)

**ADRs governing:** ADR-0006 (adapter + circuit breaker)
**Pattern rules honoured:** MUST #5, MUST #6, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Vikram on PDP taps HUIDMedallion
**When** camera opens and aligns with QR
**Then** 0.8s gold outline pulse → scan fires → server verifies via Surepass → verified → 1.2s gold seal materialise with soft chime + medium haptic → Hindi copy "यह piece verified है। [Anchor Jewellers] ने BIS के साथ register किया है HUID [code] के लिए।"
**And** rotation animation ONLY during verify ceremony (never always-on per user direction)
**And** `prefers-reduced-motion` disables animation; static seal appears

**Given** Surepass is unavailable (circuit breaker open)
**When** verification attempts
**Then** graceful fallback: "Try BIS Care app with code [X]" — preserves dignity, never fake-verify

**Given** CI runs, all gates pass; contract test on SurepassAdapter passes

**Tests required:** Unit (state transitions), Integration (full scan → verify flow with Surepass sandbox), Chaos (Surepass down → fallback), E2E (emulator with QR fixture), A11y (haptic + ARIA live)

**Definition of Done:** All AC + 10 CI gates + Storybook HUIDCeremony + 5 review layers.

---

### Story 7.8: Customer adds product to wishlist (synced to shopkeeper CRM)

**Class:** B — Wishlist with tenant-scoped RLS; safe catalog surface.

**As a Customer (Priya saving items before visiting shop)**,
I want one-tap wishlist so pieces I like are remembered across sessions AND visible to the salesperson when I walk in (per Epic 12 walk-in context),
So that my shop visit starts warm, not cold.

**FRs implemented:** FR92
**NFRs verified:** NFR-P6 (wishlist sync ≤ 30s)
**Modules + packages touched:**
- `apps/customer/app/wishlist.tsx` (new)
- `packages/db/src/schema/wishlists.ts` (new — customer_id + product_id per shop)
- `apps/api/src/modules/catalog/wishlist.service.ts` (new)
- `packages/ui-mobile/atoms/WishlistHeart.tsx` (new — animated fill + 150ms bounce)

**ADRs governing:** ADR-0002, ADR-0007
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya on PDP taps heart icon
**When** wishlist API fires
**Then** heart fills with gold; 150ms subtle bounce; 2s toast "पसंद में जोड़ा" (bottom-anchored mobile)
**And** wishlist persists server-side with tenant-scoped RLS
**And** shopkeeper's Customer Context Card (Epic 12) reflects within 30s

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (wishlist + Epic 12 walk-in integration), Tenant-isolation, E2E, VR

**Definition of Done:** All AC + 10 CI gates + Storybook WishlistHeart + 5 review layers.

---

### Story 7.9: Customer shares product link via WhatsApp / SMS / copy

**Class:** B — Product share link UX; no auth/money/compliance.

**As a Customer (Priya wanting family consensus)**,
I want to share the श्रेया bridal set with my family WhatsApp group so they can see the exact piece I'm considering — image + price + shop name — without installing the app,
So that consensus forms before I commit ₹3.8L.

**FRs implemented:** FR93
**NFRs verified:** NFR-P6
**Modules + packages touched:**
- `packages/ui-mobile/atoms/ShareSheet.tsx` (new)
- `apps/customer/app/share/[productId].tsx` (new — deep-link target)
- `apps/web/src/app/share/[productId]/page.tsx` (new — web fallback with Open Graph tags)

**ADRs governing:** ADR-0008
**Pattern rules honoured:** MUST #6, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya taps Share on PDP
**When** native share sheet opens with WhatsApp + SMS + Copy
**Then** selected option sends rich card: product image + title + price + shop name + deep-link
**And** deep-link preserves exact PDP state on recipient's device (WhatsApp OG preview renders correctly)
**And** no platform brand visible in shared content (tenant's brand only)

**Given** CI runs, all gates pass

**Tests required:** Unit (deep-link construction), E2E (share + open on 2nd device), VR (OG preview card)

**Definition of Done:** All AC + 10 CI gates + Storybook ShareSheet + 5 review layers.

---

### Story 7.10: Customer submits "Inquire at Shop" request with optional note

**Class:** B — Catalog inquiry writes to CRM on a safe surface.

**As a Customer (who hasn't decided yet but wants to follow up)**,
I want to send an inquiry from a product page — "Can I visit Saturday to try this on?" — that lands in the shopkeeper's CRM as an inquiry,
So that the shop can prepare the piece + greet me by name when I walk in.

**FRs implemented:** FR94
**NFRs verified:** NFR-P6
**Modules + packages touched:**
- `apps/customer/app/inquire/[productId].tsx` (new)
- `packages/db/src/schema/inquiries.ts` (new)
- `apps/api/src/modules/crm/inquiries.service.ts` (new)
- `packages/ui-mobile/business/InquiryCard.tsx` (new Tier 3)
- `apps/shopkeeper/src/features/crm/components/InquiryInbox.tsx` (new — shopkeeper-side inbox)

**ADRs governing:** ADR-0002, ADR-0006 (WhatsApp dispatch for shopkeeper notification via Epic 13)
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Priya taps "दुकान पर पूछें" on PDP
**When** she submits: preferred visit time + optional note + contact preference (WhatsApp/phone)
**Then** inquiry persists; `crm.inquiry_received` event emits; shopkeeper gets push (Epic 13 Story 13.6)
**And** Priya sees confirmation in her "My Inquiries" list
**And** shopkeeper inquiry inbox shows with full context + "Respond on WhatsApp" action

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (inquiry + shopkeeper notification), Tenant-isolation, E2E

**Definition of Done:** All AC + 10 CI gates + Storybook InquiryCard + 5 review layers.

---
