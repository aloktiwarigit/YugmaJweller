# PRD Addendum — Customer Storefront

**Date:** 2026-05-01
**Author:** Claude (Opus, BMAD Phase 2 — addendum authoring)
**Status:** Phase 1 deliverable; awaiting Codex cross-model review before Phase 2 code starts.
**Parent PRD:** `_bmad-output/planning-artifacts/prd.md` (FR1–FR126, NFR-P1–NFR-C9 — locked, unchanged).
**Source gap analysis:** `docs/customer-storefront-gap-analysis-2026-05-01.md` (§4 = tiered gaps; §6 = addendum proposal; §12 = multi-session execution plan).

---

## Why this addendum exists

After completing the 18-wave epic-completion sweep on 2026-05-01 (`memory/project_feature_complete_2026_05_01.md`), a competitive review against jewelsbox.co identified 22 customer-storefront gaps. Twelve are table-stakes for anchor demo (Tier 1); ten are post-launch polish (Tier 2).

This addendum records:

1. **14 genuinely new functional requirements** (FR127–FR140) that the original 126-FR PRD did not anticipate — these formalise the storefront polish + enrichment surface.
2. **Completion notes for 7 existing FRs** (FR86, FR88, FR90, FR93, FR96, FR104, FR105) where the capability was specified but the shipped implementation only partially satisfies the contract.
3. **3 new non-functional requirements** (NFR-SE-1, NFR-SE-2, NFR-IMG-1) covering SEO and image-delivery quality bars promised in the PRD body but never measurably encoded.

This document is **purely additive**. It does NOT renumber, reword, or remove any FR1–FR126 or NFR-P1–NFR-C9. The original PRD remains the historical capability contract; this addendum extends it.

A single cross-link line is appended to PRD §1009 ("Functional Requirements") pointing to this addendum so that any reader of the PRD discovers FR127+ without re-deriving them.

---

## §1 — New Functional Requirements (FR127–FR140)

These FRs are first-class capability commitments. Like FR1–FR126, each is testable and implementation-agnostic. Implementation-tier mapping (T1/T2) corresponds to gap-analysis §4 and drives wave assignment in `epics-E17-E18.md`.

### Customer App — Storefront Polish (Tier 1)

- **FR127:** The customer storefront (web + mobile) displays a multi-column footer on every page containing tenant-configurable shop address, contact phone, contact WhatsApp, social media links, app-download badge, and platform-static legal links (privacy, terms, FAQ, sitemap). Goldsmith platform brand is never visible.
- **FR128:** The customer storefront homepage displays a trust-pillar strip ("BIS प्रमाणित | HUID सत्यापित | वापसी / आदान-प्रदान") above the fold, leveraging the compliance enforcement already implemented for FR50, FR91, and FR106.
- **FR129:** Customer can view the shop's shipping policy text (shopkeeper-configured, parallel to FR106 return policy) on a dedicated `/shipping-policy` route on web and equivalent screen on mobile.
- **FR130:** Customer can view the shop's cancellation policy text (shopkeeper-configured) on a dedicated `/cancellation-policy` route on web and equivalent screen on mobile.
- **FR131:** Customer can view a per-tenant editable FAQ page at `/faq` (web) and equivalent mobile screen, rendered with table of contents from shopkeeper-supplied Markdown blocks in shop settings.
- **FR132:** Customer can view platform-static buying guides for Gold, Diamond, and Silver at `/buying-guide/[metal]` (web) and equivalent mobile screens — content authored once by platform team, identical across tenants.
- **FR133:** The customer-web app emits a per-tenant `sitemap.xml` (regenerated on publish/unpublish events; see NFR-SE-1) and Schema.org structured data on every product page (`Product` type) and homepage (`JewelryStore` type).
- **FR134:** The customer storefront footer surfaces tenant-configurable social media links (Instagram, Facebook, YouTube) and a WhatsApp click-to-chat link that opens `wa.me/<shop_whatsapp_number>` with a pre-filled greeting in Hindi.

### Customer App — Storefront Enrichment (Tier 2)

- **FR135:** Shopkeeper can assign products to one or more named collections from a platform-defined enum (Festival, Wedding, Bridal, Daily Wear, Gifting, Engagement, College, Office). Customers can browse `/collections/[slug]` with all products tagged to that collection across categories.
- **FR136:** Customer can browse "Shop By Loved Ones" gift-recipient personas (पत्नी / बहन / माँ / मित्र / पिता / बेटी), each persona linking to a curated cross-collection product list assembled by shopkeeper-controlled persona tags.
- **FR137:** Customer viewing a product detail page sees a "Recommended for you" rail of up to 6 products from the same category and adjacent weight band (±20% net weight), excluding the current product and out-of-stock items.
- **FR138:** Customer viewing a product priced ≥ Rs 50,000 sees a display-only EMI calculator tile on the product detail page with monthly instalment estimates for 3, 6, 9, 12-month tenures (no live payment integration in MVP).
- **FR139:** Customer can save up to 5 named addresses (label, line 1, line 2, city, state, pincode, landmark) in their profile, marked as "default delivery" or "default visit". Address book is DPDPA-compliant (deletion via FR63 honoured) and gated by Firebase phone OTP.
- **FR140:** Customer can enter a referral code at signup; if the code matches an existing customer of the same tenant, the new customer accrues a configurable loyalty-point bonus credited on their first invoice (referrer also accrues a configurable bonus). Referral codes are tenant-scoped and shopkeeper-toggleable per FR3 feature flag.

---

## §2 — Existing-FR Completion Notes

These FRs were specified in the original PRD body but the customer-app implementation as of 2026-05-01 only partially satisfies them. The capability contract stays as written in PRD §1009; the notes below clarify what completion means and trace each closure to a story in Epics 17/18. **No FR text is rewritten — only the test/closure scope is bound here.**

| FR | PRD-body promise | Currently shipped | Outstanding scope to close FR | Closure story |
|---|---|---|---|---|
| **FR86** | Home with rate, **featured collections**, **new arrivals**, seasonal campaigns | Rate widget + 6 hand-picked featured products | Add "नए आगमन" (new arrivals — last 14 days, by `created_at desc`) and "लोकप्रिय" (popular — by 30-day view count desc) homepage rails. Featured collections satisfied by FR135 once T2.1 lands. | T1.10 |
| **FR88** | Filter by metal, purity, **price range**, occasion, in-stock-only | Metal chip filter only | Add price-band chips (<₹10K, ₹10–20K, ₹20–30K, ₹30–50K, ₹50–75K, ₹75K+) computing live price from current rate × net weight; add purity filter; add in-stock filter | T1.4 |
| **FR90** | PDP with **multiple images**, full price breakdown, HUID, certification, **size options**, availability | Single placeholder texture; price breakdown ✓; HUID ✓; no size; no real images | Real image-upload pipeline (FR127-class implementation; covers multi-image gallery); size-option selector for ring/bangle products surfacing PRD-promised sizers (FR104, FR105) | T1.1 (images), T2.10 (size selector) |
| **FR93** | Share via **WhatsApp / SMS / copy link** | Not shipped on customer-web PDP; mobile share partial | Add Web Share API (mobile) + WhatsApp deep-link + copy-to-clipboard fallback on PDP and shop landing pages | T2.10 |
| **FR96** | Profile with **purchase history**, loyalty, wishlist, custom orders, rate-locks, try-at-home | Basic profile only (loyalty badge + wishlist link) | Add timeline view aggregating invoices + try-at-home bookings + rate-locks + reviews chronologically; gated by `linked_via_invoice` per FR100 | T2.3 |
| **FR104** | In-app **ring sizer** | Route directory exists; `page.tsx` missing — 404 | Implement ring sizer with reference-circles method + paper-print ruler method + measure-with-existing-ring method, all in Hindi-first | T1.7 |
| **FR105** | In-app **bangle sizer** | Same as FR104 — 404 | Implement bangle sizer with diameter reference circles and measurement guide | T1.7 |

**Test contract for closure:** Each FR is considered closed only when the corresponding story's BDD acceptance criteria pass AND a runtime smoke test on the intended surface (web browser or mobile) confirms the capability end-to-end. The non-negotiable runtime-smoke floor in `CLAUDE.md` applies — passing tests + clean review do not substitute for using the feature.

---

## §3 — New Non-Functional Requirements

These NFRs sit alongside NFR-P1–NFR-C9 in the original PRD as additional measurable quality bars. They were referenced in PRD §761–793 (Web App Requirements, around line 773 "sitemap.xml + Schema.org promised") but never formally encoded. This addendum closes that gap.

### SEO

- **NFR-SE-1:** Customer-web emits a per-tenant `sitemap.xml` listing every published product, every published collection landing page, the homepage, and every static policy/guide page. Sitemap is regenerated on `product.published` and `product.unpublished` events with a 5-minute debounce; served at `/<tenant-domain>/sitemap.xml` with correct `Content-Type: application/xml`. Schema.org JSON-LD blocks are embedded on every PDP (`Product` type with `name`, `image`, `offers.price`, `brand`, `material`) and on the homepage (`JewelryStore` type with `name`, `address`, `telephone`, `openingHours`).

- **NFR-SE-2:** Customer-web homepage and a representative PDP each score ≥ 90 on Lighthouse SEO category at p95 across three runs in CI (`pnpm lighthouse:ci` against the staging build). Failures block the merge train.

### Images

- **NFR-IMG-1:** All customer-facing product images are served via ImageKit CDN with responsive `srcset` (320w, 640w, 1024w, 1920w variants); no single variant exceeds 250 KB at the variant's intrinsic resolution. The shopkeeper upload pipeline (T1.1) enforces this at upload time by transcoding any source image > 250 KB into ImageKit-managed variants and rejecting upload if the smallest variant cannot be brought under the limit.

---

## §4 — Cross-link to PRD §1009

The PRD body remains the binding capability contract for FR1–FR126. A single line is appended near the top of PRD §1009 (immediately after the introductory sentence "**This is the binding capability contract.**") pointing readers to this addendum:

> **Addendum:** Customer-storefront capabilities FR127–FR140 + completion notes for FR86/88/90/93/96/104/105 + NFR-SE-1/SE-2/IMG-1 are recorded in `docs/prd-addendum-customer-storefront.md`. The original 126-FR / 70-NFR list below is the historical MVP capability contract; the addendum is the post-feature-complete extension.

No other lines in the PRD body are altered.

---

## §5 — Open questions (gated, not blocking)

The gap analysis (§7) flagged six anchor-SOW or platform-decision questions. Their resolution is required before the gated stories below can ship; un-gated stories in Epics 17/18 are unblocked.

| # | Question | Default if unanswered | Gates which stories |
|---|---|---|---|
| Q1 | "Lifetime exchange & buyback" surfaced on customer storefront? | Skip — leave URD purchase shopkeeper-only | Out of scope for E17/E18; revisit if anchor commits |
| Q2 | EMI integration display-only or live? | Display-only (FR138 as written) | T2.7 (FR138) ships display-only; live integration deferred |
| Q3 | Marketing opt-in default position? | Unchecked (DPDPA explicit-consent) | T2.8 (FR140 referral) and broader notification UX |
| Q4 | Collections list — fixed enum or shopkeeper-defined? | Platform-defined enum + shopkeeper-assignable products (FR135 as written) | T2.1 (FR135) |
| Q5 | Sub-brand support? | N/A for anchor; data model leaves room | None for E17/E18 |
| Q6 | Profile order history — show shopkeeper-side invoices via customer linkage, or only self-initiated? | Both, gated by `linked_via_invoice` | T2.3 (FR96 closure) |

Answers, when received, are recorded as anchor-SOW decisions in `_bmad-output/planning-artifacts/prd.md` "Known Unresolved Items" section.

---

## §6 — Acceptance for this addendum

This addendum is accepted into the PRD when:

- [x] FR127–FR140 drafted with same testability bar as FR1–FR126
- [x] FR86/88/90/93/96/104/105 completion scope traced to Epic 17/18 stories
- [x] NFR-SE-1, NFR-SE-2, NFR-IMG-1 specified with measurable thresholds
- [x] Open questions surfaced with defaults (§5)
- [x] Cross-link wording for PRD §1009 prepared (§4)
- [ ] Codex cross-model review pass (`.codex-review-passed` marker, or substitute gate per `feedback_codex_worktree_clm.md`)
- [ ] Committed to main alongside `epics-E17-E18.md` and PRD §1009 cross-link line

When all six are checked, Phase 2 wave 7A (T1.1 image-upload pipeline) is unblocked.

---

## §7 — Document control

| Field | Value |
|---|---|
| Authoring model | Opus 4.7, BMAD Phase 2 (addendum mode) |
| Source of truth for gaps | `docs/customer-storefront-gap-analysis-2026-05-01.md` |
| Implementing epics | `_bmad-output/planning-artifacts/epics-E17-E18.md` |
| Cross-model review | Codex CLI (Codex-only gate per Class B/C; full chain for Class A T1.1) |
| Phase 2 entry artifact | `memory/project_phase1_storefront_complete.md` |
| Last updated | 2026-05-01 |
