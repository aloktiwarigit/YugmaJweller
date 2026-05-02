# Customer Storefront Gap Analysis — vs. jewelsbox.co

**Date:** 2026-05-01
**Author:** Claude (Opus, principal-architect mode)
**Scope:** Compare Goldsmith customer-facing surfaces (`apps/customer-web/` + `apps/customer-mobile/`) against jewelsbox.co; identify gaps; tier them; map to existing PRD FRs and propose new FRs where genuinely missing.
**Pipeline:** Phase 0 (this doc) → Phase 1 (PRD addendum + Epic 17) → Phase 2 (per-story execution) → Phase 3 (merge train) → Phase 4 (deploy).
**Reference:** `CLAUDE.md`, `MEMORY.md`, `_bmad-output/planning-artifacts/prd.md` (FR86–FR106 cover customer app today).

---

## 1. Framing — what jewelsbox.co actually is

jewelsbox.co is a **B2C consumer-facing online jewelry retailer** — comparable to a small-scale CaratLane/Tanishq. Categories, collections, gift personas, sub-brands, online checkout-style storefront. **It is not a shop-management platform.** It has no inventory backend, no GST/HUID enforcement, no multi-tenant white-label, no shopkeeper console.

Therefore the meaningful comparison is:

> **jewelsbox.co (their consumer storefront)** vs. **`apps/customer-web/` + `apps/customer-mobile/`** (our white-label customer storefront that each anchor jeweller gets)

The shopkeeper-side of Goldsmith — billing, GST/HUID/269ST/PMLA, inventory, loyalty engine, B2B wholesale invoicing, custom orders, stock movements ledger — has no equivalent on jewelsbox.co. That's our control-plane; this doc is about the customer-discovery plane only.

---

## 2. What we have today (customer-facing inventory)

### `apps/customer-web/` (Next.js 14 App Router)

| Route | Status | Notes |
|---|---|---|
| `/` | live | Hero + `GoldRateCard` + 6 featured products |
| `/products` | live | Sidebar (category) + metal chip filter + search by SKU; pagination |
| `/products/[id]` | live | `HuidBadge` + BIS-certified pill + gross/net weight + `PriceBreakdown` + try-at-home CTA + rate-lock CTA + `WishlistButton` + `ReviewSection` |
| `/wishlist` | live | Wishlist list view |
| `/loyalty` | live | Tier ladder (रजत / स्वर्ण / प्लेटिनम) + how-it-works |
| `/rate-lock` | live | Booking surface |
| `/try-at-home` | live | Booking surface |
| `/return-policy` | live | Per-tenant configurable text |
| `/contact` | live | Phone/WhatsApp/hours; deep-link from PDP CTAs |
| `/size-guide` | **MISSING** | Route directory exists; `page.tsx` does not — broken link |
| `/admin` | live | Platform admin (separate, not customer surface) |

### `apps/customer-mobile/` (Expo SDK 50, React Native)

| Route | Status |
|---|---|
| `(auth)/welcome` | live (phone OTP) |
| `(tabs)/index` | live (`TenantBrandHeader` + `RateCard` + `CategoryRow` + `ProductGrid`) |
| `(tabs)/browse` | live |
| `(tabs)/wishlist` | live |
| `(tabs)/profile` | live (basic) |
| `loyalty/`, `rate-lock/`, `try-at-home/` | live |

### Customer-facing components

`GoldRateCard`, `ProductCard`, `ProductGrid`, `CategorySidebar`, `MetalFilterChips`, `HuidBadge`, `EstimatedPriceBadge`, `PriceBreakdown`, `WishlistButton`, `StarRating`, `ReviewSection`, `GoldTexturePlaceholder` (← stub, not real images).

### Layout

Header only: logo + app-name + sticky-top. **No footer at all.** No navigation drawer. No social links. No store-locator block.

---

## 3. What jewelsbox.co has — full inventory

### Header / mega-menu
- Logo + 3 metal-vertical nav (Diamond, Silver, Gold)
- Account login/signup
- Mega-menu: Category × Metal/Stone × Price-band × Collection × Corporate Gifting
- **Price-band filter** (Under ₹10K, ₹10–20K, ₹20–30K, ₹30–50K, ₹50–75K, ₹75K+)
- **Style sub-filters** (Engagement / Band / Daily Wear / Couple / Promise rings; Studs / Drops / Jhumkas etc.)
- **Collection groupings** (Festival, Wedding, Gifting, Daily Wear, Engagement, Bridal, College, Official)

### Homepage sections
- Hero banner (wedding ensemble) + carousel
- New Arrival (10-product carousel)
- In Spotlight (4 categories: Best Sellers, Earring, Rings, Pendant)
- **Shop By Loved Ones** (gift personas: Girlfriend, Sister, Best Friend, Soulmate)
- Top Sellers (4 product cards)
- Everyday Collection (6 tiles)
- Premium Collection (3 showcases)
- Recommended for You (4 cards)
- **Jewels Box Promise** trust strip ("100% Certified | 100% Refund | Lifetime Exchange & Buyback")
- Our Brands (4 sub-brands: Silva Silver, Sangini Gold, Diya Diamonds, Ananya Gold)

### Footer (multi-column)
- Online Shopping links (categories)
- Popular Searches
- About Us / Blog / Reels / Contact
- JewelBox Advantage (30-day returns, shipping policy)
- **Know Your Jewelry — Diamond / Gold / Silver buying guides**
- Customer Service (cancellation, returns, terms, privacy)
- **Download Our App** (Google Play badge)
- Corporate Office address (Noida)
- Store Location (Lucknow) + phone + email
- **Social media row** (FB / Twitter / IG / YouTube / LinkedIn)
- Bottom strip (FAQ, Privacy, Terms, **Sitemap HTML**)

### Auth
- Phone-OTP login (same as us)
- Registration: Name / Email / Gender / City / **Referral Code**

### Trust & policies
- 100% Certified Jewellery
- 100% Refund
- **Lifetime Exchange & Buyback**
- 30-day Free Returns
- Shipping Policy
- Cancellation/Return Policy
- Terms / Privacy / FAQ

### Content
- Blog
- **Reels** (video gallery)
- Diamond / Gold / Silver buying guides
- About Us / Our Story

### Other
- Native mobile app (Google Play)
- B2B: **Corporate Gifting** dedicated path
- WhatsApp click-to-chat

---

## 4. Gap analysis — tiered

Each gap annotated with:
- **FR-status** — `existing` (PRD has it, not fully shipped), `new` (needs new FR), `out-of-scope` (deliberately scoped out)
- **Class** — A / B / C per ceremony tiering
- **Sizing** — XS (≤4h) / S (≤1d) / M (≤2d) / L (3-5d)

### Tier 1 — Table-stakes for anchor launch (must close before SOW demo)

| # | Gap | FR-status | Class | Size | Notes |
|---|---|---|---|---|---|
| T1.1 | **Real product images + multi-image gallery on PDP** (replace `GoldTexturePlaceholder`) | existing FR90 ("multiple images") | **A** | L | Image-upload pipeline: Azure Blob + ImageKit signing, MIME validation, EXIF strip, malware-scan hook, per-tenant signed-URL TTL, RLS on `product_images` table, shopkeeper upload UI |
| T1.2 | **Footer** (multi-column with policies, store address, social, app-download badge) | new FR | C | S | Pure presentation; tenant-config for address/phone/social; static for legal links |
| T1.3 | **Trust-pillar strip on homepage** ("BIS प्रमाणित \| HUID सत्यापित \| वापसी / आदान-प्रदान") | partial FR98 (branding) + new FR | C | XS | Leverages compliance work already done; copy + 3 SVG icons |
| T1.4 | **Price-band filter** (<₹10K, ₹10–20K, …) on `/products` | existing FR88 ("filter by price range") | B | S | Catalog API: add `priceMin`/`priceMax` query params; UI: chip group below metal chips; price computed from current rate × net weight |
| T1.5 | **Mega-menu navigation** (Category × Metal × Stone × Collection) | existing FR87 + FR88 | B | M | Header dropdown component; collections need T1.7 first |
| T1.6 | **Shipping policy + Cancellation policy pages** (per-tenant configurable, like return-policy) | existing FR106 (return only) + new FRs | C | XS | Mirror `/return-policy` pattern; add 2 columns to `shop_settings` |
| T1.7 | **`/size-guide` page** (currently 404 — file missing) | existing FR104 + FR105 | C | S | Ring sizer + bangle sizer with reference circles; pure content + minimal JS |
| T1.8 | **FAQ page** (per-tenant editable) | new FR | C | XS | Editable Markdown blocks in `shop_settings`; renders with TOC |
| T1.9 | **Buying guides** — Gold / Diamond / Silver (educational content) | new FR | C | S | MDX content; same on every tenant; SEO benefit |
| T1.10 | **"नए आगमन" + "लोकप्रिय" homepage sections** (currently only "विशेष आभूषण") | existing FR86 ("featured collections, new arrivals, and seasonal campaigns") | B | XS | API: order by `createdAt desc` for new; `viewing_analytics` count desc for popular |
| T1.11 | **Sitemap.xml + structured data** (Schema.org Product + JewelryStore) | new FR (NFR-SE-?) | B | S | PRD line 773 promised; not shipped |
| T1.12 | **Social media + WhatsApp click-to-chat** in header/footer | new FR (extends FR98) | C | XS | Tenant-config columns: `whatsapp_number`, `instagram_url`, `facebook_url` |

**Tier 1 total:** ~12 stories, mostly Class B/C, **one Class A** (T1.1 image pipeline).

### Tier 2 — Strongly recommended (post-launch polish)

| # | Gap | FR-status | Class | Size | Notes |
|---|---|---|---|---|---|
| T2.1 | **Collections** (Festival, Wedding, Bridal, Gifting, Daily Wear, Engagement) | partial FR86 | B | M | New `collections` table + `product_collections` join; `/collections/[slug]` routes; shopkeeper assigns products to collections |
| T2.2 | **"Shop By Loved Ones" gift personas** (पत्नी / बहन / माँ / मित्र) | new FR | B | S | Reuses collections infra with gift-recipient tag |
| T2.3 | **Order/visit history in customer profile** (purchases + try-at-home + rate-locks + reviews timeline) | existing FR96 ("profile with purchase history, ...") | B | M | API: `/api/v1/customer/me/timeline`; mobile + web profile screens |
| T2.4 | **Address book** in customer profile | partial FR96 | B | S | New `customer_addresses` table; CRUD UI |
| T2.5 | **Recommended products on PDP** ("आपको ये भी पसंद आ सकता है") | new FR | B | S | Same category + similar weight band; can use existing search infra |
| T2.6 | **Image zoom + 360° hooks on PDP** | extends FR90 | B | S | `<img>` zoom-on-hover + tap; 360° as future-compat field on `product_images` |
| T2.7 | **EMI calculator** (Razorpay or Bajaj) on PDP for ₹50K+ items | new FR | B | S | Display tile on PDP with No-Cost-EMI option calculator; no payment integration yet |
| T2.8 | **Newsletter / WhatsApp-marketing opt-in** with DPDPA consent | partial FR111 (notif prefs) | B | XS | Footer signup form; persists to existing `notification_preferences` |
| T2.9 | **Referral code** at signup | new FR | B | S | `referral_code` column on `customers`; loyalty bonus on first invoice |
| T2.10 | **Better PDP layout** — sticky add-to-wishlist / try-at-home CTAs on scroll, breadcrumbs | extends FR90 | C | XS | Pure CSS / layout |

**Tier 2 total:** ~10 stories, all Class B/C.

### Tier 3 — Strategic / explicitly deferred

| # | Gap | Status | Notes |
|---|---|---|---|
| T3.1 | **Cart + online checkout** | **OUT** (locked) | Anchor MVP scope: "app price = committed price; browse online → walk into shop / book try-at-home." Only revisit if anchor SOW changes. |
| T3.2 | **"Lifetime exchange & buyback" brand promise** banner | **anchor decision** | We have buyback on shopkeeper side (URD/old-gold purchase, story 5.9). Surfacing as a brand promise needs anchor commitment + policy text. Doc proposes; anchor signs off. |
| T3.3 | **Sub-brands** (jewelsbox has 4) | N/A | Anchor has single brand. Future: per-tenant could opt into sub-brand grouping but not Phase 1. |
| T3.4 | **Corporate Gifting** path | Phase 3+ | We have B2B wholesale invoice on shopkeeper side; consumer-facing B2B portal is a separate epic. |
| T3.5 | **Blog + Reels** (content marketing) | Phase 3+ | Marketing surface; not table-stakes. |
| T3.6 | **360° / AR try-on** | Phase 3+ | Capability hooks in T2.6 leave the door open. |
| T3.7 | **Email account verification** | OUT | Phone OTP is sufficient per Firebase Auth choice (ADR-0015). |

---

## 5. What we have that jewelsbox.co does NOT — our actual moat

These should be **front-and-center in anchor demos**. They are not gaps; they are differentiators.

| Capability | jewelsbox.co | Goldsmith |
|---|---|---|
| Live gold-rate widget on every page | ❌ | ✅ `GoldRateCard` |
| HUID + BIS-certified badge **per product** | ❌ (top-level "Certified" copy only) | ✅ `HuidBadge` on PDP |
| **Public price breakdown** (net wt × rate + making + 3% GST + 5% making-GST) | ❌ (final price only) | ✅ `PriceBreakdown` |
| Try-at-home booking (with security/return tracking) | ❌ | ✅ |
| Rate-lock booking (lock today's rate for X days) | ❌ | ✅ |
| Reviews per product with verified-buyer flag | ❌ | ✅ `ReviewSection` |
| Multi-tenant white-label (each shop's own brand, no platform brand) | ❌ (single retailer brand) | ✅ |
| **Hindi-first typography** (Yatra One + Noto Sans Devanagari) | ❌ (Latin sans) | ✅ |
| Senior-friendly mobile UX (≥48dp touch, ≥16pt body) | ❌ | ✅ |
| WCAG 2.1 AA + skip-link + ARIA labels | ❌ | ✅ |
| Per-tenant configurable return policy / settings | ❌ | ✅ |
| Server-side compliance hard-blocks (269ST, PMLA, PAN, GST) | ❌ | ✅ |
| Phone-OTP auth (Firebase, free tier) | ✅ | ✅ |
| Wishlist | ✅ | ✅ |

---

## 6. PRD addendum proposal (Phase 1 input)

Phase 1 will execute via `/bmad-edit-prd`. Two categories of change:

### 6a. Genuine new FRs (proposed: FR127–FR140)

| Proposed FR | Title | Tier | Source gap |
|---|---|---|---|
| FR127 | Customer storefront footer (multi-column with tenant-config address, social, app-download, policy links) | T1 | T1.2 |
| FR128 | Trust-pillar strip on homepage | T1 | T1.3 |
| FR129 | Shipping policy page (per-tenant configurable) | T1 | T1.6 |
| FR130 | Cancellation policy page (per-tenant configurable) | T1 | T1.6 |
| FR131 | FAQ page (per-tenant editable) | T1 | T1.8 |
| FR132 | Buying guides — Gold, Diamond, Silver (platform-static) | T1 | T1.9 |
| FR133 | Sitemap.xml + Schema.org structured data (Product, JewelryStore) | T1 | T1.11 |
| FR134 | Social media + WhatsApp click-to-chat in footer (tenant-config) | T1 | T1.12 |
| FR135 | Collections (Festival, Wedding, Bridal, Daily Wear, Gifting, Engagement) — shopkeeper-assignable | T2 | T2.1 |
| FR136 | Gift-recipient personas ("Shop By Loved Ones") | T2 | T2.2 |
| FR137 | Recommended products on PDP | T2 | T2.5 |
| FR138 | EMI calculator (display-only) on PDP for ≥ ₹50,000 items | T2 | T2.7 |
| FR139 | Customer address book (saved addresses in profile) | T2 | T2.4 |
| FR140 | Referral code at signup + loyalty bonus on first invoice | T2 | T2.9 |

### 6b. Existing-FR completion (no new FR; complete the implementation)

| FR | Promised | Currently shipped | Gap to close |
|---|---|---|---|
| FR86 | Home with rate, **featured collections, new arrivals, seasonal campaigns** | Rate + 6 featured | Add new arrivals + popular sections (T1.10); collections await FR135 |
| FR88 | Filter by metal, purity, **price range**, occasion, in-stock | Metal chip only | Add price-band filter (T1.4); purity filter; in-stock filter |
| FR90 | PDP with **multiple images**, full price breakdown, HUID, certification, **size options**, availability | Placeholder image; price breakdown ✓; HUID ✓; no size; no real images | T1.1 image pipeline; size options |
| FR93 | Share via WhatsApp / SMS / copy link | Not shipped on customer-web PDP | Add share component |
| FR96 | Profile with purchase history, loyalty, wishlist, custom orders, rate-locks, try-at-home | Basic profile only | T2.3 timeline view |
| FR104 / FR105 | Ring sizer + bangle sizer | Route 404 | T1.7 |

### 6c. NFR additions (proposed)

- **NFR-SE-1:** Customer-web sitemap.xml regenerated nightly per tenant; Schema.org structured data on Product + Organization (JewelryStore).
- **NFR-SE-2:** Customer-web homepage Lighthouse SEO score ≥ 90.
- **NFR-IMG-1:** All product images served via ImageKit CDN with responsive srcset; max 250 KB per image at default viewport.

---

## 7. Open questions / anchor-SOW decisions

| # | Question | Default if unanswered | Who decides |
|---|---|---|---|
| Q1 | "Lifetime exchange & buyback" brand promise — surface this on customer storefront? | Skip — leave URD purchase as a shopkeeper-only flow until anchor commits to a customer-facing program | Anchor |
| Q2 | EMI integration — display-only (FR138) or live (Razorpay/Bajaj)? | Display-only for Phase 2; live integration deferred to Phase 3 | Anchor + you |
| Q3 | Newsletter / WhatsApp marketing — opt-in default position (checked / unchecked)? | **Unchecked** (DPDPA explicit-consent default) | Legal |
| Q4 | Collections list — fixed platform set (Festival/Wedding/etc.) or shopkeeper-defined? | Platform-defined enum + shopkeeper-assignable products | You |
| Q5 | Sub-brand support — N/A for anchor? | N/A; data model leaves room for future tenant→sub-brand grouping | You |
| Q6 | Customer profile order history — show shopkeeper-side invoices via customer linkage, or only customer-self-initiated activity (try-at-home, rate-lock, wishlist)? | Both, gated by `linked_via_invoice` flag (FR100 already requires this for reviews) | You |

---

## 8. Sizing summary

- **Tier 1:** ~12 stories, ~3 Class A weeks of effort if Class A (T1.1) is sequenced first. Realistically 1.5–2 weeks at current 1–2 stories/day pace.
- **Tier 2:** ~10 stories, all B/C, ~1.5 weeks.
- **Total Tier 1+2:** ~3–4 weeks single-developer wall-clock; ~2.5–3 weeks with 2-track parallelism (Track A: T1.1 + T1.4 + T1.5; Track B: T1.2 + T1.3 + T1.6–T1.12).

Migrations needed: ~5 (`product_images`, `collections` + join, `customer_addresses`, `shop_settings` columns for shipping/cancellation/FAQ/social, `referral_codes`).

---

## 9. Phase 1 next steps (when this doc is approved)

1. `/bmad-edit-prd` — append PRD addendum with FR127–FR140 + NFR-SE-1/2/IMG-1 + FR-completion notes for FR86/88/90/93/96/104/105
2. `/bmad-create-epics-and-stories` scoped to **Epic 17: Customer Storefront Polish** (T1 stories) + **Epic 18: Customer Storefront Enrichment** (T2 stories)
3. Codex review on the PRD diff + epic outline (one cross-model gate before any code)
4. Begin Phase 2 per-story execution loop

Phase 1 is one Opus session, ~2–3 hours.

---

## 10. Risk + mitigation

| Risk | Mitigation |
|---|---|
| Image-upload pipeline (T1.1) is the only Class A and the largest story — slips → blocks PDP polish | Sequence T1.1 first; use existing Azure Blob + ImageKit infra (already in stack); reuse signed-URL pattern from existing storage adapter |
| Mega-menu (T1.5) depends on collections (T2.1) for full effect | Ship T1.5 with Category × Metal × Price-band only; revisit when T2.1 lands |
| PRD locked at 126 FRs; addendum must not contradict | Addendum file is *additive only*; cross-link from PRD §1009; original 126-FR list remains the historical MVP record |
| Codex worktree CLM blocker on Windows | Run codex review from full repo copy (`C:/gs17/`) or fall back to Opus review chain per `feedback_codex_worktree_clm.md` |
| Anchor-SOW decisions Q1/Q2/Q6 unresolved → doc references them but doesn't block code | Phase 2 stories that depend on Q1/Q2 are gated; Phase 2 stories that don't depend on them ship in parallel |

---

## 11. Acceptance for this doc

This Phase-0 doc is accepted when:

- [x] Gap inventory complete (sections 2 + 3 + 4)
- [x] Differentiators captured (section 5)
- [x] PRD addendum proposal drafted (section 6)
- [x] Open questions surfaced (section 7)
- [x] Sizing + risk recorded (sections 8 + 10)
- [ ] User signs off on Tier 1 scope, Q1–Q6 defaults, Phase 1 next-steps
- [ ] User commits this doc to main

When (6) and (7) are checked, Phase 1 starts.

---

## 12. Multi-session execution plan

This work spans ~22 stories across ~3-4 wall-clock weeks. Executing it in one session would rot context catastrophically. The plan below partitions work into discrete sessions with explicit handoff artifacts so any session can pick up cold from the committed state. Pattern follows `feedback_fresh_session_prompt_ceremony.md`, `feedback_parallel_session_worktrees.md`, and `feedback_orchestrator_parallelization.md` (max 2 parallel tracks).

### 12.1 Session map (waves)

| Wave | Sessions | Mode | Stories | Wall-clock |
|---|---|---|---|---|
| **Phase 0** (this doc) | 1 Opus | Solo | — | done |
| **Phase 1** (PRD + epics) | 1 Opus | Solo | — | ~3 hr |
| **Wave 7A** | 2 Sonnet (plan + exec, both fresh) | Solo | T1.1 image pipeline (Class A) | ~3-5 days |
| **Wave 7B** | 4-6 Sonnet | 2 parallel tracks | T1 layout/polish (10 stories) | ~3-4 days |
| **Wave 7C** | 6-10 Sonnet | 2 parallel tracks | T2 enrichment (10 stories) | ~5-7 days |
| **Wave 7D** | 1 Sonnet | Solo | Merge train + RC tag | ~1 day |
| **Total** | **14-20 sessions** | — | ~22 stories | **3-4 weeks** |

### 12.2 Wave 7A — Foundation (sequential, solo)

**Hard barrier: nothing in 7B/7C that touches PDP or product cards starts until 7A merges.**

| Story | Class | Sessions | Worktree |
|---|---|---|---|
| T1.1 image-upload pipeline (Azure Blob + ImageKit signing, MIME validation, EXIF strip, malware-scan hook, signed-URL TTL, RLS on `product_images`, shopkeeper upload UI) | A | 2 (plan + exec, both fresh per `feedback_fresh_session_prompt_ceremony.md`) | `C:/gs17a-img/` |

### 12.3 Wave 7B — Tier 1 layout/polish (2 parallel tracks)

| Track | Worktree | Stories | Class | Notes |
|---|---|---|---|---|
| **A — content/footer** | `C:/gs17b-content/` | T1.2 footer · T1.12 social/WhatsApp · T1.3 trust strip · T1.7 size-guide · T1.8 FAQ · T1.9 buying guides | C | Class C stories can batch 2-3 per session |
| **B — structural** | `C:/gs17b-struct/` | T1.4 price-band filter · T1.5 mega-menu (no-collections pass-1) · T1.10 new-arrivals/popular · T1.6 shipping/cancellation pages · T1.11 sitemap + Schema.org | B | One Codex review per branch |

**Cadence:** Tracks merge to main independently as each story passes Codex; no inter-track sync needed within Wave 7B.

### 12.4 Wave 7C — Tier 2 enrichment (after 7B merges; 2 parallel tracks)

| Track | Worktree | Stories | Class | Notes |
|---|---|---|---|---|
| **A — discovery** | `C:/gs18a-disc/` | T2.1 collections → T2.2 personas → T2.5 recommendations → T2.6 image zoom · T2.10 PDP polish | B | T2.1 first; T2.2/T2.5 depend on T2.1 |
| **B — profile + commerce** | `C:/gs18b-prof/` | T2.3 timeline · T2.4 address book · T2.7 EMI calculator · T2.8 newsletter · T2.9 referral code | B | All independent; can ship in any order |

**Sync point:** After T2.1 (collections) merges, do **T1.5 pass-2** (mega-menu adds collections column) as a small follow-up story in Track A.

### 12.5 Wave 7D — Merge train + RC tag (solo)

1. Pre-flight audit per `feedback_pre_merge_train_audit.md`: every holding branch has ≥3 implementation commits (not just markers)
2. Sequential merge in dependency order: 7A → 7B-A → 7B-B → 7C-A → 7C-B
3. Per-PR Codex review-on-main double-check
4. Customer-web smoke on staging — golden-path: home → /products → /products/[id] → wishlist → try-at-home CTA
5. Tag `pre-launch-rc-1` on main

### 12.6 Per-session prompt template

Every Phase 2 session begins with this header so context loads from disk, not from prior conversation. Drop into the new-session prompt verbatim, fill the `<...>` slots:

```
You are Claude in a fresh session for Goldsmith story T<id>: <title>.

CONTEXT TO LOAD (read in this order, do not re-derive):
1. C:\Users\alokt\.claude\CLAUDE.md  (global agency rules)
2. C:\Alok\Business Projects\Goldsmith\CLAUDE.md  (project rules + Windows Android landmines)
3. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md
4. docs\customer-storefront-gap-analysis-2026-05-01.md  (this doc — gap + session plan)
5. docs\prd-addendum-customer-storefront.md  (Phase 1 output)
6. docs\superpowers\specs\2026-05-XX-T<id>-<slug>.md  (story spec)
7. docs\superpowers\plans\2026-05-XX-T<id>-<slug>.md  (work-stream plan, if Phase 2 plan-session has run)

STORY METADATA:
- ID: T<id>
- Class: <A | B | C>
- Wave: <7A | 7B-A | 7B-B | 7C-A | 7C-B | 7D>
- Worktree: <C:/gs17a-img/ | C:/gs17b-content/ | …>
- Model tier: <opus for Class A plan, sonnet for everything else>
- Ceremony: <full | compressed | minimal>
- Review gate: codex review --base main → .codex-review-passed
  (Class A: also /security-review in parallel → .security-review-passed)

NON-NEGOTIABLE FLOOR (all classes):
- TypeScript strict, no FLOAT for weights, no cross-tenant queries
- Hindi-first UI; ≥48dp touch on mobile; WCAG 2.1 AA on web
- White-label: never leak Goldsmith brand to customer surfaces
- Runtime smoke test on intended surface before push (web: browser; mobile: emulator/device)

ACCEPTANCE: <copy bullets from spec section "Acceptance Criteria">

OUT OF SCOPE: <copy from spec; common: cart, online checkout, payment integration>

DO NOT skip Codex review. DO NOT push without runtime smoke test (unless story has no runtime surface — doc/config-only).
```

### 12.7 Inter-session handoff artifacts

Each session ends by committing one or more of these so the next session can recover state from disk:

| Artifact | Path | When |
|---|---|---|
| Story spec | `docs/superpowers/specs/2026-05-XX-T<id>-<slug>.md` | End of plan-session |
| Work-stream plan | `docs/superpowers/plans/2026-05-XX-T<id>-<slug>.md` | End of plan-session |
| Code commits on `feat/T<id>-<slug>` | feature branch in worktree | End of exec-session |
| `.codex-review-passed` marker | branch root | After Codex review |
| `.security-review-passed` marker | branch root | After security review (Class A only) |
| Story-complete memory | `memory/project_story_T<id>_complete.md` | After merge |

**Rule:** if a session ends without writing at least one handoff artifact, the next session has nothing to resume from. Treat that as a failed session and re-plan.

### 12.8 Dependency lock

| If you're starting | First verify |
|---|---|
| Anything in Wave 7B/7C touching PDP/product cards | T1.1 image pipeline merged to main |
| T1.5 mega-menu pass-2 (with collections) | T2.1 collections merged to main |
| T2.2 gift personas | T2.1 collections merged (shares infra) |
| T2.5 recommendations | T1.1 (images) merged (cards need images) |
| T2.6 image zoom | T1.1 (images) merged |
| T2.7 EMI calculator | T1.4 price-band merged (shares price-computation pattern) |
| Wave 7D merge train | All 7A/7B/7C branches passed Codex; queue ≤ 5 |

### 12.9 Concurrency limits

- **Max 2 parallel tracks** at any time (proven; 3+ = workspace contention)
- **Max 5 holding branches** before pausing for merge train (`project_strategic_pause_2026_04_26.md`)
- **Codex queue ≤ 5** before starting a new wave
- **One Class A story at a time** (T1.1 in 7A; no other Class A planned in this epic)

### 12.10 Re-entry from cold

If you (or anyone) opens a fresh session weeks from now and has lost context, the recovery procedure is:

1. Read this doc §12.6 (prompt template) and §12.8 (dependency lock)
2. Run `git branch -a | grep -E 'feat/T1\.|feat/T2\.'` to see what branches exist
3. Run `git log main --oneline -20` to see what has merged
4. Run `cat .codex-review-passed 2>/dev/null` on each holding branch to see review state
5. The next story to start is the lowest-numbered T<id> whose dependencies (§12.8) are satisfied and which is not already in flight

This is the operational source of truth for the whole epic. Phase 1 will write specs that reference this doc and the FR addendum; do not re-derive any of the above per-story.
