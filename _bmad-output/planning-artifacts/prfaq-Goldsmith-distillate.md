---
title: "PRFAQ Distillate: Goldsmith"
type: llm-distillate
source: "prfaq-Goldsmith.md"
created: "2026-04-16"
purpose: "Token-efficient context for downstream PRD creation"
---

# PRFAQ Distillate: Goldsmith App Platform

Dense context pack for PRD / UX / Architecture workflows. Cross-reference with `domain-indian-jewelry-retail-research-2026-04-15.md` and `market-customer-insights-research-2026-04-16.md` for source depth.

## Concept Summary

- **Project:** Goldsmith App Platform — multi-tenant white-label jewelry shopkeeper + customer app, built first for an Ayodhya-based anchor jeweler then generalized.
- **Concept type:** Commercial product (client-funded anchor build → SaaS/platform productization).
- **Business model:** Anchor pays build fee (estimated Rs 20-40L); platform absorbs Rs 30-50L productization delta. Break-even: 5-10 follow-on paying jewelers × Rs 6-10K/month × 12 months.

## Anchor Customer Profile

- **Location:** Ayodhya, UP (Hindi belt; post-Ram Mandir pilgrimage economy since Jan 2024)
- **Size:** 2-5 staff shop
- **Product spectrum:** Gold + diamond + silver + bridal + daily-wear + **wholesale** (unusual — most jewelry apps don't do B2B)
- **Relationship:** Paid client engagement, not own family business
- **Current state:** No existing software, no website, no Instagram — clean greenfield
- **Funding posture:** Client-funded, cost-conscious
- **Branding:** White-labeled as anchor's brand (logo, name, domain)
- **Language requirement:** Hindi-first UI, English toggle

## MVP Scope — CONFIRMED MUST-HAVES (anchor explicit)

**Shopkeeper App:**
- Multi-staff role-based access (owner + 2-5 staff roles/permissions)
- Full-spectrum inventory: gold/diamond/silver/bridal/daily-wear; multi-purity (24K/22K/18K/14K; 925/999 silver)
- GST-compliant billing (3% metal + 5% making); HUID per hallmarked piece; B2C + **B2B wholesale** invoices
- Customer CRM (phone primary key per shop; purchase history; credit/advance tracking)
- Live IBJA gold rate (API auto-fetch + manual override)
- Old gold exchange (URD purchase with RCM self-invoice)
- Estimate generation → convert to order
- Basic reports (daily sales, stock valuation, outstanding payments)
- Loyalty program (tiered: Silver/Gold/Platinum style; shopkeeper configures thresholds, points-per-rupee, redemption rate)
- Custom order tracking (with WhatsApp progress photos at 3 stages: metal cast, stones set, finished)
- Rate-lock booking (default 7 days; configurable 1-30 days via admin)
- Try-at-home service (configurable piece count; enable/disable toggle per tenant)
- WhatsApp invoice + catalog sharing (via AiSensy BSP)
- Hindi-first UI; English toggle
- Admin/Settings panel (first-class epic)

**Customer App (anchor white-labeled):**
- Product catalog (auto-published from shopkeeper inventory; near-real-time sync 5-30 sec)
- Category browsing + filter
- Live gold rate display on home screen
- Wishlist + "Inquire at Shop" (NO online cart/checkout — deferred to Phase 3+)
- Store info (hours, location, phone, directions)
- Loyalty tier + points display
- Custom order progress view
- Try-at-home booking (if shop enables)
- Rate-lock booking flow
- HUID QR scan verification
- Push notifications (rate alerts, custom order updates, festival reminders)
- **Reviews / ratings** (verified-in-store-buyer model only — customer must have linked invoice)
- **Size guides** (ring sizer with physical & paper-print methods; bangle sizer)
- **Return / exchange policy** display (static info page; shopkeeper configures text in admin)
- **Gift mode** — mark wishlist/inquiry "for gift"; triggers gift wrap flag for shop; size guide helps gift buyer
- **Privacy consent toggle** for viewing tracking (default-on, always opt-outable)
- App uses anchor's logo/name/colors/domain — never "Goldsmith App" brand visible

**Shopkeeper App additional features (new):**
- **Customer viewing analytics:**
  - Per-item: total views, unique viewers, time-windowed 7/30 days, hot/cold item dashboards
  - Per-customer: full viewing + wishlist history visible in CRM profile
  - Anonymous vs logged-in distinction; session-based deduplication
  - "Pre-visit intelligence" — when customer inquires or books try-at-home, shopkeeper sees their browsing history to tailor the in-person conversation
- **Review moderation** — shopkeeper can respond to reviews; flag inappropriate content
- **Return/exchange policy editor** in admin settings

## MVP Scope — EXPLICITLY DEFERRED (cost control, anchor rejected)

- **Online cart + checkout** (payment flow, shipping, returns/refunds) — Phase 3+; MVP is wishlist + inquiry → in-person purchase only
- AR try-on (Phase 4+; expensive)
- Video call consultation (Phase 4+)
- Gold savings schemes AS-SHIPPED to anchor (built in codebase for platform/future tenants, anchor toggles OFF)
- 360° product view (Phase 4+)
- Digital gold (regulatory vacuum per SEBI; Phase 4+ if at all)
- Multi-store management (Phase 4+)
- Girvi/mortgage management (Phase 4+)
- Repair & maintenance scheduling (Phase 4+)
- Shipping/registered post delivery (Phase 4+; MVP answer is in-person pickup with insured pouch)
- ML-based product recommendations, time-on-page tracking, search query analytics, heatmaps — Phase 3+
- True real-time inventory sync via WebSocket/SSE — Phase 3+ (MVP uses near-real-time 5-30 sec polling)

## Architectural Principles (NON-NEGOTIABLE)

1. **Multi-tenant from Day 1** — shop_id FK every table; PostgreSQL row-level security; NestJS tenant interceptor. Zero cross-leak tolerance.
2. **Shopkeeper self-service config** — every per-jeweler value is shopkeeper-configurable via admin UI, NOT hardcoded per tenant by platform team. Settings UI is a first-class product surface, Hindi-first.
3. **White-label ready** — logo, theme colors, app name, domain configurable per tenant. Customer app shows anchor's brand, not Goldsmith platform brand.
4. **Weight-centric data model** — DECIMAL/NUMERIC only (never FLOAT) for all weight fields. Gold tracked in grams at purity; prices always derived (weight × rate + charges + tax).
5. **Adapter pattern for all vendors** — IBJA, Razorpay, AiSensy, Digio, Ola Maps, Meta WhatsApp, BIS HUID via Surepass, Metals.dev fallback. Vendor swap = adapter rewrite, not data migration.
6. **Offline-first shopkeeper app** — WatermelonDB + sync; conflict resolution via CRDT-style merge for non-stock fields, transactional locks for stock movements.
7. **Feature flags per tenant** — features like try-at-home, wholesale, gold schemes can be toggled per jeweler (shopkeeper OR platform controlled, depending on nature).

## Shopkeeper-Configurable Admin Settings (Epic-Level Scope)

Required configurable fields (Hindi-first admin UI):
- Shop profile: name, address, GSTIN, BIS registration, phone, hours, years in business, about
- Staff management: add/remove staff; role + permission assignment
- Making charge defaults (by category: rings/chains/bridal/wholesale, etc.) — can still be invoice-overridden
- Wastage percentage defaults
- Rate-lock duration default (1-30 day range)
- Try-at-home: enable/disable toggle + piece count limit
- Loyalty tier thresholds, points-per-rupee, redemption rate
- Custom order policy: refund on change-of-mind rules, max rework rounds, deposit structure, cancellation window
- Invoice template customization: disclaimers, language, branding elements
- Notification preferences: which events trigger WhatsApp/SMS/email
- Language default + fallback for customer app

Platform-controlled (NOT shopkeeper-editable):
- Branding (logo, colors, domain) — quality-gated onboarding
- Legal compliance rules (GST 3%+5%, HUID format, PAN threshold Rs 2L, Section 269ST cap Rs 1,99,999) — these are legal, not preferences
- Tenant subscription plan

## Tech Stack (Validated)

- **Mobile:** React Native (Expo) — shopkeeper + customer apps
- **Web:** Next.js — customer web + platform admin console
- **UI:** NativeWind (RN) + shadcn/ui (web); **reference 21st.dev component marketplace for premium components; godly.website for design inspiration**
- **State:** Zustand + TanStack Query
- **Forms:** React Hook Form + Zod
- **Offline DB (shopkeeper):** WatermelonDB
- **Backend:** Node.js/TypeScript + NestJS
- **Database:** PostgreSQL (Mumbai region) with RLS
- **ORM:** Drizzle
- **Cache:** Redis
- **Search:** Meilisearch (Hindi-first)
- **File storage:** S3-compatible (ImageKit for image CDN)
- **Auth:** Phone OTP (Supabase Auth or Firebase)
- **Monorepo:** Turborepo

## Validated India Vendor Stack

- **Gold rates:** IBJA primary + Metals.dev fallback
- **Payments:** Razorpay primary + Cashfree secondary
- **WhatsApp:** AiSensy BSP (Rs 1,500/mo unlimited agents)
- **KYC (Phase 4+):** Digio
- **Maps:** Ola Maps (5M calls/month FREE)
- **Image CDN:** ImageKit
- **Push:** FCM (free)
- **Analytics:** PostHog (session replay included)
- **Support:** Zoho Desk Standard (WhatsApp-native)
- **Email:** Resend → Amazon SES at scale
- **Hosting:** AWS Mumbai (ap-south-1)
- **HUID verification:** Surepass API wrapper

## Compliance Requirements (Must be in MVP)

1. **BIS/HUID** — mandatory for gold 9K/14K/18K/22K/24K; silver voluntary (Sep 2025); HUID on every invoice
2. **GST** — 3% metal + 5% making; HSN 7113/7114; B2C + B2B (wholesale); URD/RCM on old gold
3. **PAN ≥ Rs 2 Lakh** — Rule 114B; hard-block invoice without PAN/Form 60
4. **Section 269ST** — hard-block cash at Rs 1,99,999/txn/day/event; 100% penalty risk on receiver
5. **PMLA** — cash aggregate ≥ Rs 10L/month triggers CTR flag; 5-year record retention
6. **DPDPA (Phase 3 May 2027)** — encryption, consent, 72-hour breach notification, deletion workflow

## Customer Archetypes (from Market Research)

**Shopkeeper archetypes:**
- **Rajesh-ji** (45-60, Tier-2/3, paper-ledger user) — MVP primary target
- **Amit** (25-40, next-gen, Instagram-influenced) — secondary target
- **Suresh** (multi-branch owner) — deferred Phase 4+

**Consumer personas:**
- **Priya** (wedding buyer, 24-32, 4-6 month journey, 3-5 store visits)
- **Mr. Sharma** (investment buyer, 35-60, Dhanteras/Akshaya-triggered, rate-watching)
- **Riya** (daily-wear millennial, 25-35, Instagram-first, LGD-friendly)
- **Rohit** (gifting buyer, time-pressed)
- **NEW for Ayodhya:** Pilgrim/tourist buyer (one-time visit, darshan + jewelry purchase)

## Rejected Framings (Do Not Resurface)

- Freemium-first shopkeeper SaaS → rejected in favor of anchor-customer-then-platform
- South India launch (Tamil/Kannada-first) → rejected; Ayodhya/Hindi-first chosen
- "Goldsmith Platform" as consumer-facing brand → rejected; anchor's own brand shown to customers
- Minimal Phase 0 (basic billing only) → rejected; feature-complete MVP per anchor scope
- Generic multi-tenant with platform-set per-tenant config → rejected in favor of shopkeeper self-service config
- Including AR/video call/gold schemes as-shipped in MVP → rejected per anchor cost-conscious scope
- "Single-person shops" as initial target → superseded by 2-5 staff anchor (broader permissions/role model needed)

## Competitive Intelligence (Key Facts)

- **91% of Tally complaints unresolved** (ConsumerComplaints.in, 44 filed 40 unresolved) — support gap is structural
- **Marg ERP Jewellery AMC jumped 77%** (Rs 3K → Rs 5.3K) — price-trust gap
- **Omunim mobile app** described as "worst... still in processing condition" — mobile-first gap
- **Only 18% of buyers know HUID** (LocalCircles survey) — education/trust opportunity
- **71% paid 10%+ premium** for hallmarked gold unaware of making charge opacity
- **28% cite lack of trust** as purchase barrier
- **CaratLane/BlueStone/Candere 1.6-3.3/5** average ratings on Sitejabber; hidden depreciation clauses, delivery failures, non-hallmarked accusations
- **eJOHRI ($1M seed, 200 jewelers, 130 cities)** = closest "marketplace for local jewelers" competitor
- **Gullak (launched Jan 2026)** aggregating jeweler savings schemes — validates scheme digitization demand
- **Augmont (Rs 6,100 Cr revenue, IPO filed Oct 2025, SPOT 2.0 platform)** = supply-chain competitor; partner rather than fight
- **Tanishq MoEngage integration** drove +25% app retention — engagement automation has proven ROI
- **Khatabook: 50M+ users, 25% from word-of-mouth** — reference pattern for Indian SMB growth
- **BharatPe: 60% revenue from financial services** (not payments) — reference for embedded finance path

## Pricing Anchors (Indian SMB SaaS)

- **Free tier** (Khatabook/Vyapar floor) — wins adoption
- **Rs 399/year** (myBillBook) — acceptable paid-tier floor
- **Rs 1,500/month** (AiSensy) — ceiling for mass SMB adoption
- **Rs 5,000+/year upfront** — requires deep trust
- **Rs 15,000+ upfront** — only after 6 months proven use
- **Rs 22,500 one-time** (TallyPrime) — accountant-tier ceiling

## SMB SaaS Benchmarks (From Market Research)

- Trial-to-paid conversion: 4-20% (top quartile target)
- Monthly churn: 3-7% (36-76% annual)
- Time-to-First-Value: <5 minutes (>50% of apps uninstalled in 30 days)
- Freemium visitor-to-free: 13.3%; free-to-paid: 2.6%

## Anchor Policy Decisions REQUIRED Before PRD

1. **"App price = committed price"** — is this an ironclad shop commitment, or fallback policies like "quote valid 30 min"?
2. **Custom order policy** — refund on change-of-mind? Max rework rounds included? Deposit structure (at order / at metal cast / at stones set)? Cancellation window?
3. **Custom order warranty insurance** — does anchor carry shop insurance for in-progress custom orders?
4. **Shipping scope** — MVP in-person-only or include registered post? Current plan says deferred but customer Q5 asks directly.
5. **Rate-lock duration default** — 7 days is our draft; anchor sets actual.
6. **Try-at-home piece count** — 3 pieces is our draft; anchor sets actual.
7. **Loyalty tier structure** — threshold values, points-per-rupee, redemption rate — anchor defines.
8. **Shop profile details** — name, years in business, owner name, address, GSTIN, BIS registration — anchor provides.
9. **Owner quote + customer quote** — real voice needed before press release publication; placeholder language directional only.

## Resource & Timeline Estimates

- **Team:** 5 FTE-equivalents (1 PM + 1 UX + 2 frontend + 2 backend + 0.5 DevOps + 0.5 QA — allocations flexible)
- **Build timeline:** 4 months to anchor MVP + 1 month wedding-season buffer = **5 months realistic**
- **Build cost:** Rs 60-80L over 5 months
- **Infra/tools:** Rs 30-50K/month ongoing (AWS Mumbai baseline)
- **Vendor integrations:** Rs 5-15K/month (AiSensy, ImageKit, IBJA API, etc.)
- **Legal review:** one-time Rs 50K-1L for platform terms + DPA

## Critical BLOCKERS Before PRD Stage

1. **🚨 Signed anchor SOW** — scope, fee, timeline, branding rights, IP ownership, change management, milestone payments. Without this in writing, every PRD assumption carries anchor-walks-away risk. **This is the #1 dependency.**
2. **Legal review initiation** (can run parallel to PRD) — platform terms, jeweler-as-merchant classification, DPA for DPDPA.

## Verdict Findings as Actionable Items

**Forged in Steel (no action; proceed):**
- Anchor-customer-then-platform model
- Cost-conscious feature scope
- Shopkeeper self-service config principle
- Hindi-first UI + HUID QR as trust hero
- Survived customer FAQ answers on PAN/cash law and data privacy

**Needs More Heat (address during PRD/UX):**
- Real owner + customer quotes for press release (requires anchor interview before publication, not before PRD)
- 2nd-10th jeweler GTM experiments (scope in Phase 1 planning, not MVP)
- 4 anchor policy decisions (above)
- Consumer engagement thresholds validation plan (define metrics in PRD)

**Cracks in Foundation (address during Architecture + Engineering):**
- Anchor SOW signing (BLOCKER for PRD)
- Multi-tenant isolation test suite (engineering discipline, sprint 1)
- Khatabook/BharatPe threat monitoring (quarterly competitive intel review)
- Offline-sync semantics design (CA stage deep-dive; CRDT vs transactional locks)
- White-label delivery strategy (CA stage decision; shared-app-with-theming for MVP recommended)

## Downstream BMAD Workflow Sequence

1. **OUTSIDE BMAD (CRITICAL BLOCKER):** Lock anchor SOW
2. **BMAD Create PRD (CP)** with John — use DR + MR + this PRFAQ as input; anchor SOW as authoritative scope
3. **BMAD Validate PRD (VP)** — standards check
4. **BMAD Create UX Design (CU)** with Sally — Hindi-first; reference godly.website inspiration + 21st.dev components; settings UI as first-class surface
5. **BMAD Create Architecture (CA)** with Winston — multi-tenant + white-label + offline-first + adapter pattern from Day 1
6. **BMAD Create Epics & Stories (CE)** — first 3 epics: (a) multi-tenant foundation + auth + shopkeeper settings, (b) anchor inventory + GST/HUID billing + wholesale, (c) anchor customer app + catalog + loyalty + custom orders
7. **BMAD Sprint Planning (SP)** + Dev cycle (CS → VS → DS → CR)

## Open Questions (Unresolved in PRFAQ)

1. Anchor's actual shop name + owner's name + years in business
2. Anchor's actual making charge structure by category
3. Anchor's actual loyalty program vision (or willingness to use our default)
4. Anchor's position on registered post shipping
5. Whether anchor has legal entity structure suitable to own the customer-app brand (trademark/domain)
6. Whether customer app should be published under anchor's Apple/Google Developer account OR under platform's account
7. Migration/transition plan for anchor staff (currently on paper) — training, on-site support, fallback procedures
8. Anchor's launch-day plan (soft launch with family customers? Big announcement? Tied to festival?)
