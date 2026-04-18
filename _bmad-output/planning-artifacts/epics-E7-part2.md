---
generatedBy: 'Opus main orchestrator'
epic: 'E7 (part 2 of 2: stories 7.11-7.20)'
date: '2026-04-17'
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Part 2 covers store info + profile + gift mode + white-label-invariant lock + language toggle +
    reviews + size guides + policies display. Story 7.14 is the CRITICAL white-label enforcement story
    that locks the invariant "Goldsmith platform brand NEVER visible to customer" via ESLint rule +
    Semgrep + Chromatic visual regression.
---

---

### Story 7.11: Customer views store info (hours, address, directions, phone, about, reviews)

**As a Customer (Vikram visiting from out-of-town)**,
I want to quickly find when the shop is open, where exactly it is, how to call, and read about its story,
So that I can plan my visit and feel grounded in the shop's history.

**FRs implemented:** FR95
**NFRs verified:** NFR-P2, NFR-I1 (Ola Maps adapter)
**Modules + packages touched:**
- `apps/customer/app/store-info.tsx` (new)
- `apps/web/src/app/store-info/page.tsx` (new)
- `packages/integrations/maps/ola-maps-adapter.ts` (new)
- `packages/integrations/maps/port.ts` (new)
- `packages/ui-mobile/business/StoreLocatorMap.tsx` (new Tier 3 — composes Ola Maps + ShopCard)

**ADRs governing:** ADR-0006 (Ola Maps adapter), ADR-0008
**Pattern rules honoured:** MUST #5, MUST #6, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Vikram taps "Store Info"
**When** page loads
**Then** shows: shop address (Hindi + English), hours, "अभी खुला है / बंद है" live status, phone (tap-to-call), WhatsApp (tap-to-chat), Ola Maps embed with directions CTA, about text (editable by shopkeeper in Epic 2 Story 2.1), years-in-business pill

**Given** Ola Maps is unavailable
**When** map attempts to load
**Then** graceful fallback to static address + "Open in Maps" deep-link to native maps app

**Given** CI runs, all gates pass; contract test on OlaMapsAdapter

**Tests required:** Unit, Integration, E2E (tap call → phone dialer opens), A11y, Chaos (Ola Maps down)

**Definition of Done:** All AC + 10 CI gates + Storybook StoreLocatorMap + 5 review layers.

---

### Story 7.12: Customer views unified profile (purchases + loyalty + wishlist + custom orders + rate-locks + try-at-home)

**As a Customer (Priya)**,
I want a single "My Account" screen that surfaces everything happening with this jeweller — past purchases, loyalty tier/points, saved wishlist, active custom orders, rate-locks, try-at-home bookings,
So that I don't have to hunt through separate sections.

**FRs implemented:** FR96
**NFRs verified:** NFR-P5 (profile loads < 2s p95)
**Modules + packages touched:**
- `apps/customer/app/(tabs)/account.tsx` (new)
- `apps/web/src/app/account/page.tsx` (new)
- `apps/api/src/modules/catalog/me.controller.ts` (new — `GET /api/v1/customer/me` aggregates from billing + loyalty + crm + rate-lock + try-at-home + custom-order services via cross-module read services per ADR-0009)
- `packages/ui-mobile/business/AccountDashboard.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0009 (module boundary — account reads via service APIs, not direct tables)
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #6, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Priya signed in
**When** she opens account screen
**Then** sections render: Loyalty card (tier + points + progression from Epic 8 Story 8.2), Purchases (last 5 + "View all"), Wishlist (last 5 + count), Custom Orders (active + completed count), Rate-Locks (active), Try-at-Home (upcoming), Settings shortcut
**And** each section loads independently; any service failure degrades that section only with "Unavailable — try again" state

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (multi-service aggregation), Tenant-isolation, E2E, A11y

**Definition of Done:** All AC + 10 CI gates + Storybook AccountDashboard + 5 review layers.

---

### Story 7.13: Customer marks an inquiry or wishlist item as "for gift" (triggers gift-wrap flag for shop)

**As a Customer (Rohit buying for his sister's birthday)**,
I want a simple toggle on wishlist or inquiry marking it "Gift",
So that the shop knows to prepare a gift box + omit price from the tag.

**FRs implemented:** FR97
**NFRs verified:** NFR-P6 (flag propagates to shopkeeper CRM ≤ 30s)
**Modules + packages touched:**
- `packages/db/src/schema/wishlists.ts` (extend — `is_gift BOOLEAN`)
- `packages/db/src/schema/inquiries.ts` (extend — `is_gift BOOLEAN`)
- `apps/customer/src/features/catalog/components/GiftToggle.tsx` (new)
- `apps/shopkeeper/src/features/crm/components/GiftBadge.tsx` (new — visible on inquiry + customer context)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #5, MUST #7
**Complexity:** XS

**Acceptance Criteria:**

**Given** Rohit on wishlist
**When** he toggles "Gift" on an item
**Then** `is_gift=true` persists; shopkeeper's view of that wishlist item shows gift icon + "Prepare gift-wrap" hint

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 7.14: Customer app shows ONLY the anchor/tenant's brand — Goldsmith platform brand NEVER visible

**This is the white-label invariant enforcement story. Locks the moat.**

**As the Goldsmith Platform**,
I need structural guarantees — not checklist items — that the platform brand cannot appear on any customer-facing surface. Visual regression + Semgrep + ESLint all enforce.

**FRs implemented:** FR98 (white-label exclusivity)
**NFRs verified:** NFR-SC1-3 (scales without breaking)
**Modules + packages touched:**
- `ops/semgrep/theme-tokens.yaml` (extend — `goldsmith/no-platform-brand-in-customer-app` rule catching string "Goldsmith" or imports from `@/assets/platform-*` in `apps/customer/**` + `apps/web/**`)
- `ops/eslint-plugin-goldsmith/rules/no-platform-brand.ts` (new — lint rule)
- `apps/customer/package.json` + `apps/web/package.json` (extend ESLint overrides)
- `.github/workflows/ship.yml` (extend — Chromatic VR step that asserts visual regression catches platform-brand leak)
- `packages/testing/white-label-invariant/*` (new — integration test suite)

**ADRs governing:** ADR-0008
**Pattern rules honoured:** MUST #6
**Complexity:** M

**Acceptance Criteria:**

**Given** any PR modifying `apps/customer/**` or `apps/web/**`
**When** CI runs
**Then** Semgrep `goldsmith/no-platform-brand-in-customer-app` scans: catches any literal "Goldsmith" string OR import from `@/assets/platform-*`; fails PR on detection
**And** ESLint catches same at dev-time
**And** Chromatic VR compares snapshots against golden images that assert platform logo/name NEVER appears at render-time
**And** package.json `exports` field restricts customer/web apps from importing platform-branded packages

**Given** a dev accidentally adds a "Powered by Goldsmith" footer
**When** they commit
**Then** PR is blocked; CI reports exact line + file + fix instruction

**Given** a tenant's theme config has an empty `logo_url` (misconfig)
**When** customer visits
**Then** fallback is shop-name-in-Hindi-display-font, NEVER platform fallback

**Given** CI runs
**When** full pipeline executes
**Then** white-label-invariant test suite passes across all 4 tenants (anchor + 3 mocks with varied themes)

**Tests required:** Unit (Semgrep rule regex), Integration (invariant suite runs in every CI), VR (Chromatic snapshots), Chaos (deliberately-corrupted tenant config fails safely)

**Definition of Done:** All AC + 10 CI gates + invariant documented in architecture.md §Patterns + 5 review layers.

---

### Story 7.15: Customer toggles app language Hindi ↔ English; choice persists

**As a Customer (Amit who's comfortable in both languages)**,
I want a single toggle at the top right to switch Hindi ↔ English — and my choice persists across sessions,
So that I read in my preferred language without setting it every time.

**FRs implemented:** FR99
**NFRs verified:** NFR-A6 (Devanagari rendering), NFR-A4 (screen reader Hindi/English correctly announced)
**Modules + packages touched:**
- `packages/i18n/src/runtime.ts` (used — i18n.t)
- `packages/i18n/src/locale-aware-text.tsx` (used — LocaleAwareText primitive)
- `apps/customer/src/providers/LocaleProvider.tsx` (new)
- `packages/ui-mobile/atoms/LanguageToggle.tsx` (new)

**ADRs governing:** ADR-0008
**Pattern rules honoured:** MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya in Hindi default
**When** she taps language toggle → English
**Then** all UI re-renders in English within 500ms; `lang="en"` on `<html>` / root view
**And** choice persists to SecureStore / localStorage; next session opens in English
**And** TalkBack/VoiceOver reads in chosen language

**Given** some strings missing English translation
**When** toggle to English
**Then** fallback to Hindi with `lang="hi"` on specific fragments; Sentry alert flags missing keys

**Given** CI runs, all gates pass; i18n coverage check asserts 100% key-parity between hi-IN and en-IN

**Tests required:** Unit, E2E (toggle + persistence), A11y (both languages with screen reader), i18n coverage gate

**Definition of Done:** All AC + 10 CI gates + Storybook LanguageToggle + 5 review layers.

---

### Story 7.16: Customer submits + views verified-buyer reviews (rating + text) on products and shop

**As a Customer (Priya 2 weeks post-wedding)**,
I want to rate + review the श्रेया bridal set AND the Anchor Jewellers shop — linked to my invoice so the review is verified-buyer,
So that my positive experience helps other brides trust this jeweller.

**FRs implemented:** FR100, FR101, FR102
**NFRs verified:** NFR-C6 (DPDPA — review PII handling)
**Modules + packages touched:**
- `apps/api/src/modules/reviews/*` (new)
- `packages/db/src/schema/reviews.ts` (new — product + shop reviews; verified via invoice link)
- `apps/customer/app/reviews/submit.tsx` (new)
- `packages/ui-mobile/business/ReviewCard.tsx` (new Tier 3)
- `packages/ui-web/business/ReviewCard.tsx` (new)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6, MUST #7, MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** Priya 7 days after invoice ₹3.8L completed
**When** she receives WhatsApp "How was your experience?" nudge (Epic 13)
**Then** deep-link opens review form pre-filled with invoice reference
**And** she rates 1-5 stars + Hindi/English text (max 500 chars)
**And** submit persists as `verified_buyer: true` linked to invoice
**And** shows on product PDP + shop page immediately (awaiting moderation per Story 7.17)

**Given** a non-buyer attempts review submission
**When** API fires
**Then** 403 with "Only verified in-store buyers can review"

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (review + verification + display), Tenant-isolation, E2E

**Definition of Done:** All AC + 10 CI gates + Storybook ReviewCard + 5 review layers.

---

### Story 7.17: Shopkeeper moderates customer reviews (flag, respond publicly, request removal)

**As a Shop Owner (Rajesh-ji)**,
I want to respond publicly to reviews + flag inappropriate ones for platform-admin review,
So that I can engage authentic customer feedback while protecting my shop from abuse.

**FRs implemented:** FR103
**NFRs verified:** NFR-S9 (moderation audit)
**Modules + packages touched:**
- `apps/api/src/modules/reviews/moderation.service.ts` (new)
- `apps/shopkeeper/app/reviews/moderate.tsx` (new)
- `apps/shopkeeper/src/features/reviews/components/ModerationInbox.tsx` (new)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Rajesh-ji views a review
**When** he taps "Respond Publicly"
**Then** he writes Hindi response (max 300 chars); publishes as shop-response linked to review
**And** both reviewer + reader see response inline below review

**Given** review is spam or abusive
**When** Rajesh-ji flags it
**Then** review enters `FLAGGED` state; hidden from public view pending platform-admin review (Epic 15); audit logs action

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 7.18: Customer uses in-app ring sizer (physical-method + paper-print method)

**As a Customer (Priya measuring for her sister's ring)**,
I want the app to help me measure ring size — either by placing a known-size ring on screen (physical method) or printing a paper template,
So that I buy the right size without visiting the shop.

**FRs implemented:** FR104
**NFRs verified:** NFR-A1-A9
**Modules + packages touched:**
- `apps/customer/app/size-guide/ring.tsx` (new)
- `packages/ui-mobile/business/SizeGuide.tsx` (new Tier 3 — ring + bangle variants)
- `apps/web/src/app/size-guide/ring/page.tsx` (new)

**ADRs governing:** ADR-0008
**Pattern rules honoured:** MUST #5, MUST #6, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Priya taps "Size Guide → Ring" on PDP
**When** tool loads
**Then** two paths: (a) "Place existing ring on screen" → calibrated circles with Indian ring sizes 5-22 + Hindi labels, (b) "Print paper template" → generates printable PDF with calibration marker
**And** tool works offline (PWA-cached)

**Given** CI runs, all gates pass

**Tests required:** Unit (sizing math calibration), E2E, A11y

**Definition of Done:** All AC + 10 CI gates + Storybook SizeGuide + 5 review layers.

---

### Story 7.19: Customer uses in-app bangle sizer (diameter reference + measurement guide)

**As a Customer (Priya buying bangles for a gift)**,
I want to measure bangle size using a paper-print method with clear Hindi instructions,
So that I don't order the wrong size.

**FRs implemented:** FR105
**NFRs verified:** NFR-A1-A9
**Modules + packages touched:**
- `apps/customer/app/size-guide/bangle.tsx` (new)
- `packages/ui-mobile/business/SizeGuide.tsx` (used — bangle variant)

**ADRs governing:** ADR-0008
**Pattern rules honoured:** MUST #5, MUST #6, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya taps "Size Guide → Bangle"
**When** tool loads
**Then** printable template + Hindi instruction "अंगूठे को छुएँ, कलाई के चारों ओर नापें" + Indian bangle sizes 2.4-2.14 mapped

**Given** CI runs, all gates pass

**Tests required:** Unit, E2E, A11y

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 7.20: Customer views shop's return/exchange policy on every product detail page + dedicated policy section

**As a Customer (Priya considering commitment)**,
I want to read exactly what happens if I want to return or exchange — shopkeeper-written + visible on PDP and a dedicated section,
So that I trust the post-purchase experience before I commit.

**FRs implemented:** FR106
**NFRs verified:** NFR-P6 (policy changes propagate ≤ 30s)
**Modules + packages touched:**
- `apps/api/src/modules/catalog/catalog.service.ts` (extend — returns shop_settings policy text)
- `apps/customer/app/policies.tsx` (new — dedicated policy section)
- `apps/customer/src/features/catalog/components/PolicySummaryCard.tsx` (new)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6, MUST #7
**Depends on:** Epic 2 Story 2.8 (return/exchange policy text)
**Complexity:** S

**Acceptance Criteria:**

**Given** the shopkeeper has configured return policy text in Epic 2 Story 2.8
**When** Priya views a PDP
**Then** PolicySummaryCard shows 2-line summary ("14-day return; full refund if pieces unworn; exchange anytime")
**And** "Full policy" link opens dedicated policy section with complete text
**And** Hindi primary with English fallback

**Given** shopkeeper edits policy
**When** settings save
**Then** customer app reflects new text within 30s on next polling refetch

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation, E2E

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---
