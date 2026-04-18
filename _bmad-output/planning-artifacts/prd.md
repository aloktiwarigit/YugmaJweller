---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
status: 'complete'
completedDate: '2026-04-16'
inputDocuments:
  - _bmad-output/planning-artifacts/research/domain-indian-jewelry-retail-research-2026-04-15.md
  - _bmad-output/planning-artifacts/research/market-customer-insights-research-2026-04-16.md
  - _bmad-output/planning-artifacts/prfaq-Goldsmith.md
  - _bmad-output/planning-artifacts/prfaq-Goldsmith-distillate.md
  - memory/project_goldsmith_overview.md
  - memory/project_anchor_jeweler_profile.md
  - memory/project_anchor_mvp_scope_final.md
  - memory/feedback_anchor_customer_model.md
  - memory/feedback_shopkeeper_self_service_config.md
  - memory/feedback_mvp_target_segment.md
  - C:/Users/alokt/.claude/plans/tingly-weaving-frog.md
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 2
  brainstorming: 0
  prfaq: 2
  projectDocs: 7
classification:
  projectType: 'multi-tenant SaaS B2B2C — Mobile App (primary) + Web App (customer web + platform admin) hybrid'
  domain: 'Retail Commerce (primary) + Fintech Compliance Overlay (BIS/GST/PMLA/DPDPA/Section 269ST)'
  complexity: 'HIGH'
  complexityDrivers:
    - Multi-regulatory stacking (5 compliance surfaces — BIS, GST, PMLA, DPDPA, Section 269ST)
    - Multi-tenant isolation with zero cross-leak tolerance
    - Weight-precision financial math (DECIMAL/NUMERIC, never FLOAT)
    - Two-app shared-DB with near-real-time sync (<30 sec propagation)
    - White-label per tenant with shopkeeper self-service config
    - Real-time data consistency between shopkeeper writes and customer reads
  strategicClassification:
    goToMarketType: 'displacement-play'
    competitorBar: 'broken-incumbents'
    wedge: 'reliability-support-over-feature-parity'
    productizationTrajectory: 'anchor-bespoke-first, platform-substrate-second'
  testSurfacesCalledOut:
    - Multi-tenant isolation test suite from sprint 1
    - Weight-precision math test harness (10,000+ transaction validation)
    - Two-app sync integration tests (publish propagation, sold reflection, concurrent edits)
  projectContext: 'greenfield'
---

# Product Requirements Document - Goldsmith App Platform

**Author:** Alokt
**Date:** 2026-04-16

*(Product Manager: John — facilitating PRD creation via BMAD Create PRD workflow)*

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Classification](#project-classification)
3. [Success Criteria](#success-criteria)
4. [Product Scope](#product-scope)
5. [User Journeys](#user-journeys)
6. [Domain-Specific Requirements](#domain-specific-requirements)
7. [Innovation & Novel Patterns](#innovation--novel-patterns)
8. [Project-Type Specific Requirements](#project-type-specific-requirements)
9. [Project Scoping & Phased Development](#project-scoping--phased-development)
10. [Functional Requirements](#functional-requirements) (126 FRs — binding capability contract)
11. [Non-Functional Requirements](#non-functional-requirements) (70 NFRs — measurable quality attributes)
12. [Document Notes](#document-notes)

**Authoritative references for downstream BMAD workflows:**
- **UX Design (Sally):** §5 Journeys + §10 Functional Requirements + §7 Innovation + NFR-A1-A9 Accessibility
- **Architecture (Winston):** §6 Domain + §8 Project-Type + §10 FRs + §11 NFRs (all categories)
- **Epics & Stories (Winston):** §9 Scoping + §10 FRs (trace every story to an FR)
- **Test Design (Murat):** §3 Success Criteria + §10 FRs + §11 NFRs (each NFR is testable)

---

## Executive Summary

Goldsmith is a **multi-tenant white-label platform that packages each local Indian jeweller's shop into two co-branded apps — a shopkeeper management app and a customer-facing storefront app — running on a shared real-time database and compliance engine.**

The MVP is delivered as a bespoke launch for an anchor jeweller in Ayodhya, Uttar Pradesh — a 2-5 staff, full-spectrum (gold, diamond, silver, bridal, wholesale) shop operating in the post-Ram Mandir pilgrim economy. The anchor funds the initial build; the architecture is designed from Day 1 to onboard a second, tenth, and hundredth jeweller with configuration changes only — no code changes. Shopkeepers self-configure their own settings (making charges, loyalty tiers, rate-lock duration, try-at-home rules, return policy) via an in-app admin panel; the platform team does not hardcode per-tenant values.

The product solves a single well-researched problem: **local Indian jewellers are losing share to organised chains not because they sell worse jewellery, but because they have no digital surface to make their trust visible.** Organised retail grew from 22% to 38% of India's USD 90B jewellery market between FY19 and FY25 while 75% of the country's 500,000+ local jewellers still have no formal software. Incumbents that do serve them (Tally, Marg, Omunim) carry structural support failures — 91% of Tally complaints are unresolved, Marg's AMC jumped 77%, Omunim's mobile app is "still in processing" per 2025 user reviews. The opening is real and measurable; compliance-driven tailwinds (BIS HUID mandate now covers 380 districts and forces every jeweller to adopt software) accelerate it.

### What Makes This Special

**Core insight:** Trust asymmetry (not feature gap) is the real competitive force. A 55-year-old Ayodhya jeweller who has earned three generations of customer trust has no way to make that trust visible online; a Tanishq showroom that opened last year does. Goldsmith's job is to flip that asymmetry — give each local jeweller a digital surface on their own brand that matches the polish of a big chain while keeping the intimacy of the local relationship.

**Differentiators:**

- **White-label per tenant, substrate shared** — every jeweller's customer app looks like their brand (logo, colours, name, domain); under the hood is a multi-tenant platform that makes a 10th tenant cheaper to serve than the 2nd.
- **Shopkeeper self-service configuration** — making charges, loyalty rules, rate-lock duration, try-at-home toggles, return policy, staff permissions are all editable by the shopkeeper in Hindi-first admin UI. No vendor call to change a price.
- **Jewellery-native compliance depth** — BIS/HUID on every invoice, GST 3% metal + 5% making split, URD/RCM self-invoicing on old gold exchange, PAN prompt at Rs 2 lakh, Section 269ST cash cap enforcement, PMLA cumulative cash monitoring. Features that generic SMB apps (Khatabook, Vyapar) cannot replicate without 2-3 quarters of focused investment.
- **Two apps, one shared database, near-real-time sync** — shopkeeper publishes a piece to inventory, customer app reflects within 30 seconds. Shopkeeper marks sold, customer app hides it. No ERP in the industry does this for local jewellers.
- **Hindi-first UI** — not translated English. No major jewellery app (Tanishq, Kalyan, CaratLane, BlueStone) is Hindi-first. In Ayodhya and the broader Hindi belt, this is a wedge, not a nice-to-have.
- **Customer viewing analytics for shopkeeper** — a novel B2B2C intelligence layer. Shopkeeper sees which customers viewed which items, wishlist history, browsing duration. A salesperson greets a walk-in with "I see you looked at the diamond pendant last night" — an edge no big chain can match because they lack hyperlocal salesperson context.

**Delivery moment (user delight):** The anchor jeweller opens admin settings at 10pm on a slow Tuesday, changes his making charge for diamond rings from 12% to 10%, and watches his customer app reflect the change in 30 seconds — no phone call to Marg or Tally, no vendor waiting for weeks. *"I run my own technology now."*

## Project Classification

| Attribute | Value |
|-----------|-------|
| **Project Type** | Multi-tenant SaaS B2B2C — React Native mobile apps (primary) + Next.js web apps (customer web + platform admin) hybrid |
| **Domain** | Retail Commerce (primary) + Fintech Compliance Overlay (BIS, GST, PMLA, DPDPA, Section 269ST) |
| **Complexity** | HIGH |
| **Complexity Drivers** | (1) Two-app shared real-time database with multi-tenant isolation — the defining architectural challenge; (2) multi-regulatory stacking across 5 compliance surfaces; (3) weight-precision financial math (DECIMAL/NUMERIC only, never FLOAT); (4) near-real-time sync under 30 seconds between shopkeeper writes and customer reads; (5) white-label per tenant with shopkeeper self-service config |
| **Strategic GTM** | Displacement play — competitive incumbents are structurally broken (unresolved support, AMC escalation, non-mobile); core wedge is reliability and support, not raw feature parity |
| **Productization Trajectory** | Anchor-bespoke MVP (Months 1-5) → multi-tenant productization (Months 5-9) → 2nd-10th jeweller (Months 9-12) → Hindi-belt scale (Month 12+) |
| **Project Context** | Greenfield — fresh codebase; research-rich (Domain Research, Market Research, PRFAQ all complete) |

---

## Success Criteria

### User Success (Shopkeeper — Anchor)

- **Activation:** Anchor jeweller completes first real invoice (not demo) within 48 hours of onboarding call, including HUID, customer record, and GST breakdown.
- **Daily adoption:** Anchor uses the app on 100% of operating days post-launch for first 60 days; all invoices generated through the app (no parallel paper daybook).
- **Self-service config:** Anchor changes at least 3 admin settings themselves (making charge, loyalty tier, rate-lock duration, or shop profile) in first 30 days without platform-team assistance.
- **Compliance confidence:** Anchor generates complete BIS/HUID + GST invoices for 100% of hallmarked transactions; PAN collected on 100% of transactions ≥ Rs 2 lakh; zero Section 269ST violations in production.
- **Karigar/custom-order trust:** First bridal custom order fully tracked with WhatsApp progress photos at 3 stages; zero customer disputes on progress visibility.
- **Staff adoption:** 100% of anchor's 2-5 staff actively use app within first 30 days (not just owner).

### User Success (Customer — Anchor's end consumers)

- **First-visit value:** New customer cold-starts app → views today's gold rate → browses a category → views at least one product within 60 seconds p95 (includes load time).
- **Trust signal consumption:** 30%+ of first-time customers scan a HUID QR code within their first three sessions.
- **Repeat engagement:** 25%+ of downloading customers return to the app weekly within the first 60 days (checking gold rate or custom order progress).
- **Wishlist → inquiry conversion:** 15%+ of wishlisted items converted to "Inquire at Shop" actions within 30 days.
- **Custom order satisfaction:** 90%+ of custom-order customers report satisfaction with progress visibility (post-delivery NPS survey).
- **Loyalty participation:** 40%+ of transacting customers opt into loyalty program within first 90 days.

### Business Success

- **Anchor milestone (Month 5):** Anchor signs off on production deployment; zero unresolved P1 bugs; anchor references Goldsmith positively to at least one other jeweller.
- **Productization milestone (Month 9):** Second paying jeweller onboarded in under 3 weeks with zero custom code changes.
- **Platform traction milestone (Month 12):** 10+ paying jewellers; ≥ 5 onboarded in under 1 week each; gross margin positive per paying tenant.
- **Revenue milestones:** Anchor fee collected on all agreed milestones (covers ~40-60% of build cost); paid-tier jeweller subscriptions ≥ Rs 5 lakh MRR by Month 12.
- **Pivot trigger (Month 6):** If consumer app metrics fall below install 30%+, weekly return 25%+, custom-order engagement 60%+, loyalty 15%+ of anchor's transacting customer base, pivot Phase 2 focus to shopkeeper-only SaaS (Path B).

### Technical Success

- **Tenant isolation:** Automated tenant-isolation test suite runs on 100% of CI runs; zero cross-tenant data exposure bugs in production.
- **Weight-precision math:** Paise-level accuracy maintained across 10,000+ synthetic transactions (FLOAT banned in weight columns; DECIMAL/NUMERIC validated).
- **Real-time sync:** Shopkeeper writes propagate to customer app within 30 seconds at p95 for baseline load.
- **Compliance enforcement:** App hard-blocks (not just warns) on Section 269ST violations, missing PAN for ≥ Rs 2L transactions, and unhallmarked items marked for sale in mandatory districts.
- **Test coverage:** Unit ≥ 75% on billing/HUID/compliance modules; integration ≥ 60% on multi-tenant flows; E2E smoke suite runs under 10 minutes on CI.
- **Uptime:** 99.5% baseline; **99.9% during wedding season** (Dhanteras week + Akshaya Tritiya week); 99.9% by Month 12 with 5+ paying tenants.
- **Performance:** Customer app first meaningful paint < 2.5 sec on 4G; shopkeeper app billing screen interactive < 1 sec on mid-tier Android.
- **Offline capability:** Shopkeeper app supports invoice generation offline; sync on reconnect within 30 sec.
- **DPDPA readiness:** Encryption at rest/in transit (TLS 1.3); consent flow in production before anchor launch; 72-hour breach notification workflow testable by Month 9 (full enforcement May 2027).
- **Engagement instrumentation:** Consumer app analytics wired in Phase 0 (not Phase 2) — DAU/WAU/MAU measurable from Day 1 of anchor launch for Month-6 pivot trigger.

### Measurable Outcomes (Consolidated)

| KPI | Target | When |
|-----|--------|------|
| Anchor daily active usage | 100% of business days | First 60 days post-launch |
| Customer app install rate (% of anchor transacting customers) | 30-40% (stretch 40%+) | By Month 6 |
| Customer app weekly return rate | 25%+ | By Month 6 |
| Custom-order customer engagement (views progress photos) | 60%+ | By Month 6 |
| Loyalty program opt-in | 15%+ of transacting customers | By Month 6 |
| Custom-order satisfaction NPS | > 50 | Running average |
| P1 bug resolution time | < 24 hours | Always |
| Tenant onboarding time (2nd jeweller) | < 3 weeks | Month 9 |
| Tenant onboarding time (10th jeweller) | < 1 week | Month 12 |
| Paying jewellers | 10+ | Month 12 |
| Near-real-time sync lag (p95) | < 30 sec | Always |
| Tenant isolation test coverage | 100% of multi-tenant APIs | From sprint 1 |
| Compliance hard-block rate (PAN, cash, HUID) | 100% of applicable transactions | From launch |
| Uptime (baseline / wedding season) | 99.5% / 99.9% | From launch / festival weeks |

---

## Product Scope

### MVP — Minimum Viable Product (Anchor Launch, Months 1-5)

**Foundation (multi-tenant + compliance):**
- Multi-tenant architecture with `shop_id` FK + PostgreSQL row-level security
- Auth: phone OTP for shopkeeper + customer
- Admin/Settings panel (Hindi-first) with shopkeeper self-service config for: shop profile, staff & roles, making charge defaults, loyalty tiers, rate-lock duration, try-at-home toggle & piece count, return policy text, custom order policy, notification preferences
- GST 3% metal + 5% making charges; HSN 7113/7114; URD/RCM self-invoicing
- HUID tracking per product + on every hallmarked invoice
- PAN prompt & hard-block at Rs 2L transactions
- Section 269ST cash cap hard-block at Rs 1,99,999
- PMLA cumulative cash tracking with Rs 10L/month flag
- Near-real-time sync (5-30 sec polling)

**Shopkeeper App (anchor MVP):**
- Inventory management: gold/diamond/silver/bridal categories; multi-purity (24K/22K/18K/14K + silver 999/925); barcode; live stock valuation
- Daily IBJA gold rate auto-fetch + manual override
- Billing: B2C + B2B wholesale invoices; making charge auto-calc; stone charges; HUID per piece
- Customer CRM: purchase history, credit/advance tracking, family member linking
- Old gold exchange with URD RCM self-invoice
- Estimate generation → convert to order
- Loyalty program management (tiered)
- Custom order tracking: stages (order confirmed → metal cast → stones set → QC → ready) + photo upload at each stage + customer notifications
- Rate-lock booking management
- Try-at-home booking management (toggle-able per tenant)
- WhatsApp invoice + catalog sharing (AiSensy BSP)
- Review moderation
- Customer viewing analytics dashboard (per-item + per-customer)
- Basic reports: daily sales, stock valuation, outstanding payments
- Offline invoice generation (WatermelonDB)

**Customer App (anchor white-labeled):**
- Product catalog (auto-published from shopkeeper inventory)
- Category browsing + filter (metal, purity, price, occasion)
- Live gold rate display on home screen
- Wishlist + "Inquire at Shop" (NO online cart/checkout)
- Store info (hours, location, phone, directions)
- Loyalty tier + points display
- Custom order progress view (customer-side)
- Try-at-home booking (if shop enables)
- Rate-lock booking flow
- HUID QR scan verification
- Reviews & ratings (verified-in-store-buyers only)
- Size guides (ring, bangle)
- Return/exchange policy display (static, shopkeeper-configured)
- Gift mode (mark inquiry "for gift")
- Privacy consent toggle for viewing tracking
- Push notifications (rate alerts, custom order updates, festival reminders)
- Anchor's brand (logo, colours, name, domain) — never "Goldsmith" visible

### Growth Features (Post-MVP, Months 5-12)

- Gold savings schemes (built into codebase during MVP, feature-flag OFF for anchor; enabled for 2nd+ jewellers who want it)
- Karigar management module (issue/receipt registers, metal ledger, wastage tracking, karigar performance dashboard)
- Advanced analytics & reporting (profit margin, customer lifetime value, karigar performance, hot/cold inventory aging)
- GSTR-1/3B automated export
- FIU-IND CTR/STR report templates
- Multi-salesperson analytics
- Self-service tenant admin console (for platform team provisioning)
- Theme/branding configurator (automated white-label setup)
- 2nd-10th jeweller onboarding automation

### Vision (Future, Month 12+)

- Full cart + online checkout (payments, shipping, returns, refunds)
- AR try-on (Perfect Corp / GlamAR integration)
- Video consultation (C-Live style)
- 360° product view
- Multi-store management for single jeweller
- Embedded finance (NBFC-partnered gold loans, scheme-backed credit for shopkeeper working capital)
- Digital gold integration (pending IBJA self-regulatory framework clarity)
- Girvi/mortgage management
- Repair & maintenance scheduling with on-site pickup
- True real-time sync (WebSocket/SSE) replacing near-real-time polling
- Hyperlocal customer marketplace (cross-jeweller discovery)
- ML-based product recommendations, time-on-page analytics, search-query intelligence
- Cross-border e-commerce (NRI / international pilgrim audience)
- Blockchain provenance for LGD/high-value diamond pieces

---

## User Journeys

### Journey 1: Anchor Shopkeeper — Happy Path (Rajesh-ji archetype)

**Persona:** Rajesh-ji, 52, second-generation owner of anchor jewellery shop in Ayodhya. Class-12 educated, commerce background. WhatsApp + PhonePe user. Has never used Tally directly — his accountant visits once a month. Employs 3 staff including his 28-year-old son Amit who nudged him toward the app.

**Opening scene — the pain:** It's 9:15 pm on a Sunday. Rajesh-ji is closing the shop. His paper daybook has 11 invoices from today. Gold rate moved from ₹6,842 to ₹6,858 mid-afternoon and he has to recheck three invoices manually. His son asks if a piece worth ₹1.2L is still in stock; Rajesh-ji genuinely isn't sure without opening the safe. A customer from Lucknow WhatsApps asking today's rate — Rajesh-ji replies with a photo of a handwritten note.

**Rising action — onboarding:** Platform team visits the shop over a weekend. Rajesh-ji's staff scan 240 existing pieces into the app using barcode labels the team prints. Shop profile, GSTIN, BIS registration, making-charge defaults are configured by Rajesh-ji himself in the admin panel (Hindi labels). He sets rate-lock duration to 7 days because "shaadi walo ko time chahiye." Total setup: 2 days.

**Climax — the Monday:** Customer walks in. Rajesh-ji's son opens the shopkeeper app, searches for the chain the customer saw on WhatsApp two days ago, sees full inventory status including HUID. He generates an invoice in 90 seconds — GST 3%+5% auto-calculated, HUID recorded, customer record linked to previous purchase from 2023. At Rs 2.3L bill, PAN prompt appears; customer doesn't have PAN on phone so Form 60 is filled in app. Cash-cap warning triggers at Rs 1,99,999; customer pays Rs 1,50,000 cash + Rs 80,000 UPI. Invoice shared to customer's WhatsApp. Loyalty points credited automatically.

**Resolution — the new reality:** Three weeks in, Rajesh-ji hasn't touched the paper daybook. His wife notices he comes home earlier. His accountant who used to spend 4 hours monthly reconciling now spends 1 hour reviewing auto-generated reports. When a Lucknow customer WhatsApps him for today's rate, he sends a screenshot of his customer app — she books rate-lock and walks in three days later. "Ab main bhi Tanishq jaisa chalaata hoon."

**Capabilities required:** Admin settings UI (Hindi), inventory management, barcode printing, daily rate integration (IBJA), multi-staff roles, GST-compliant billing engine, HUID tracking, PAN/Form 60 flow, Section 269ST hard-block, WhatsApp invoice sharing, customer CRM with family history, loyalty auto-accrual, rate-lock booking.

---

### Journey 2: Anchor Shopkeeper — Edge Case (Wedding-Season Dhanteras Day)

**Persona:** Same as Journey 1, plus staff member Ravi (25) handling billing.

**Opening scene:** It's Dhanteras morning. The shop has 40+ customers in the first 4 hours. Gold rate updated at 9:00 am; IBJA feed refreshes at 2:00 pm mid-rush. Normally this would be chaos.

**Rising action:** Three simultaneous situations test the system:

1. **Bridal family from Faizabad:** wants to book a ₹4.8 lakh custom bridal set for wedding in 5 weeks. Ravi creates custom order on app — captures design sketch photo, approved weight, stones, deposit ₹50,000 UPI. Rate-lock applied. WhatsApp progress-photo schedule set automatically.
2. **Tourist pilgrim from Ahmedabad:** Rs 85,000 chain for mother. Wants to verify hallmark. Ravi shows HUID QR scan on the customer app right at the counter. Customer verifies, pays, asks Ravi to share the digital invoice on WhatsApp. Ravi clicks one button.
3. **Wholesale buyer:** local vendor picking up 6 pieces for his shop. Ravi switches bill type to "wholesale" — different GST treatment, B2B invoice with vendor's GSTIN, no retail making charge overlay.

**Climax — mid-rate-update:** IBJA feed updates rate at 2 pm. 5 open estimates from earlier in the day are affected. App shows rate-change alert; Ravi can re-price estimates or honor locked rates (for customers who paid deposits). No invoice created on pre-lock estimate goes live with stale rate. Two hours later, one customer returns to confirm her earlier estimate; Rajesh-ji honors the original locked rate manually — the app lets him override with an auditable note.

**Resolution:** Day closes with 67 invoices, 4 custom orders booked, 2 wholesale bills. End-of-day report shows total sales, cash aggregate (flagged for PMLA monitoring — approaching Rs 10L cumulative for the month), stock depletion, loyalty points issued. Rajesh-ji's accountant gets the auto-export. Nobody touched a paper slip.

**Capabilities required:** Custom order workflow with photos + rate-lock, HUID QR in-app scan, wholesale B2B billing, mid-day rate update with estimate re-pricing, rate-lock override with audit log, PMLA cash aggregation monitoring, end-of-day reporting.

---

### Journey 3: Anchor Staff — Customer Viewing Analytics in Action

**Persona:** Ravi, 25, anchor's senior sales staff. Mobile-native, Hindi/English bilingual. Uses WhatsApp Business and Instagram himself.

**Opening scene:** Monday 11 am. A customer walks in whom Ravi half-remembers. Before she reaches the counter, Ravi opens shopkeeper app, sees notification: "Priya S. (Lucknow) — 4 visits to app in last 10 days; wishlisted Diamond Bridal Set #BS-042 three times; viewed Mangalsutra #MG-087 last night for 6 minutes."

**Rising action:** Ravi greets her by name and says, "Namaste Priya-ji, aap jo diamond bridal set dekh rahi thi, abhi shop mein hai — photo mein thoda chhota lagta hai, actual mein bilkul perfect fit hai aapke liye." Her face lights up — the usual "let me just browse first" awkwardness evaporates.

**Climax:** Ravi pulls up the piece, shows her also the mangalsutra she viewed last night, which has a matching design. She asks about lightness/comfort, tries both on. Ravi knows she was researching Kundan vs Polki from her viewing pattern; he steers to the Polki piece that matches her budget band. 25 minutes later, she books rate-lock for the bridal set (Rs 3.8L, 7-day lock) and puts Rs 25,000 deposit.

**Resolution:** Priya leaves with a booking receipt on WhatsApp. Ravi updates customer profile: "Daughter's wedding Nov 15; mother-in-law color preference conservative." Next time she visits, even if Ravi is off, any staff member sees this context. Three months later, the wedding happens; Priya refers three cousins to the shop.

**Capabilities required:** Customer viewing analytics (per-customer browsing + wishlist + time-spent visible to staff), walk-in notification, CRM note-taking, staff-to-staff context sharing, persistent customer profile.

---

### Journey 4: Customer — Wedding Buyer (Priya persona)

**Persona:** Priya, 28, software engineer in Lucknow. Her daughter is 1 year old, but she's actually buying for her younger sister's wedding. Family has been visiting the anchor shop for 15 years.

**Opening scene:** 7 months before the wedding. Priya searches Instagram for bridal jewelry inspiration. Her mother reminds her — "call Rajesh bhai, he has new designs." Priya's mother gives her the anchor app link on WhatsApp. She downloads it.

**Rising action:** Over 3 weeks, Priya opens the app 11 times — mostly at night after work. She browses bridal, wishlists 4 sets, uses ring-size guide to figure out her sister's size (asks her over phone; sister reads ring measurements using paper-print method in app), toggles try-at-home setting, realizes she can book 3 pieces to come to Lucknow.

**Climax:** She books try-at-home for 3 pieces to arrive at her Lucknow home next weekend. Anchor's courier arrives with insured pouch. Priya's sister tries all 3 over a Saturday evening with mom, aunt, grandmother all weighing in on WhatsApp (video call with dad). One piece is "the one." Priya books rate-lock the next morning, Rs 2.8L with Rs 50,000 UPI deposit. Custom minor modification requested — small name engraving. Anchor confirms via WhatsApp.

**Resolution:** Over the next 4 weeks, Priya receives 3 progress photos on WhatsApp — metal cast (week 1), stones set (week 3), finished piece (week 4). She shares photos with her family WhatsApp group; cousins in Delhi and Hyderabad compliment the design and ask about the shop. Wedding day — the piece fits perfectly. Priya leaves a 5-star review. Her own future daughter's wedding will likely be at the same shop.

**Capabilities required:** Product catalog with lifestyle images, category filters, wishlist, size guides (ring + bangle, paper-print method), try-at-home booking (anchor-side fulfillment), custom order with engraving, rate-lock with deposit, WhatsApp progress photos at 3 stages, verified-buyer review, family-shareable product links.

---

### Journey 5: Customer — Pilgrim Tourist (New for Ayodhya)

**Persona:** Vikram, 45, from Mumbai. Visiting Ayodhya for 3 days for Ram Mandir darshan with his wife and mother. Plans to buy a small piece for his mother — she asked him to bring something "from Prabhu's land."

**Opening scene:** On the train to Ayodhya, Vikram searches "jewellery shop Ayodhya." Google Maps shows [Anchor Jewellers]; reviews are 4.6/5 with recent entries. He downloads the app (prompted by a "visiting Ayodhya?" notification from the anchor's shop-listing page).

**Rising action:** Vikram opens the app, sees the live gold rate, browses silver (for mother, ₹5,000-8,000 budget). Wishlists 3 pieces. Anxiety quietly bubbles: "Is this jeweller actually trustworthy? Small-town shop, unfamiliar brand." He taps a piece, reads the HUID, scans the QR code — BIS verification opens, shows genuine hallmark from registered AHC. The anxiety dissolves.

**Climax:** After darshan on day 2, Vikram walks to the shop. He shows Ravi the wishlisted silver bracelet on his app. Ravi brings it out; it's exactly as pictured. Vikram asks if Anchor ships to Mumbai — Ravi says "in-person pickup with insured pouch for now, sir." Vikram pays ₹7,200 UPI. Ravi puts the piece in a tamper-evident pouch, prints the BIS-hallmarked invoice with HUID; Vikram's wife takes a photo of invoice + HUID for home records.

**Resolution:** Back in Mumbai, Vikram's mother cries when she receives the piece — not because of the silver, but because of the ceremony of it. Vikram scans the HUID again at home — same verification, same confidence. He leaves a 5-star review: "Visiting pilgrim shopkeepers deserve your trust. HUID QR made me comfortable." The anchor gets 2 more pilgrim customers in the next 30 days who cite Vikram's review. (Hidden value: pilgrim customer segment is one-time but viral through reviews.)

**Capabilities required:** Shop discovery (Google Maps integration, store locator), live gold rate on home, silver category browsing, HUID QR scan with BIS verification, in-person pickup flow, BIS-compliant printed invoice, verified-buyer review system, public reviews visible to future customers.

---

### Journey 6: Platform Admin — 2nd Jeweller Onboarding

**Persona:** Me/Platform team. Post-anchor launch, Month 7. Anchor has referred a jeweller friend in Varanasi — Suresh ji, 58, runs a 3-staff shop, no current software.

**Opening scene:** Suresh ji calls the platform number. He's seen Rajesh ji's app in action and wants "the same thing." Platform admin console is open.

**Rising action:** Admin creates new tenant: enters Suresh's shop name "Varanasi Gold House", GSTIN, BIS registration, uploads logo (provided by Suresh's designer son), picks theme color (temple gold). Tenant provisioning runs — shop_id created, RLS policies applied, domain `varanasigoldhouse.app` (or `.com` if purchased) points to the customer web app, iOS/Android apps appear under anchor's branding in the tenant's Play Store + App Store developer accounts (or platform's — decision per commercial agreement).

**Climax:** Feature flags set per Suresh's preferences: try-at-home OFF (he doesn't want the operational burden yet), gold savings scheme ON (Suresh runs an existing chit-fund scheme, wants to digitize it), wholesale OFF (he's pure retail). Suresh's son does a 30-minute walkthrough of admin settings — sets his own making charges, loyalty tier thresholds, custom-order policy text. Platform team trains Suresh's staff over 1 day on-site in Varanasi.

**Resolution:** Suresh ji goes live on Day 14 from initial call. Total custom code written: zero. Total platform-team hours: 12 (tenant provisioning 1 hour + on-site training 8 hours + 3 hours of remote support in first week). Suresh ji pays Rs 25K onboarding + Rs 7K/month subscription. Platform's productization claim is validated for the first time.

**Capabilities required:** Platform admin console with tenant provisioning flow, theme/branding configurator, feature flag admin per tenant, domain/subdomain CNAME automation, tenant-specific analytics, remote support tooling, onboarding automation scripts, self-service settings walkthrough (helps non-admin shopkeepers configure themselves).

---

### Journey Requirements Summary

Across all 6 journeys, the following capability areas emerge:

**Shopkeeper App capabilities** (Journeys 1, 2, 3):
- Inventory management with barcode/QR, multi-purity, live valuation
- Billing engine: B2C + B2B wholesale; GST 3%+5% auto-split; HUID per piece; PAN prompt & hard-block at Rs 2L; Section 269ST cash cap enforcement; PMLA cumulative monitoring
- Customer CRM: purchase history, family linking, notes, occasion reminders
- Customer viewing analytics: per-item + per-customer + walk-in notification
- Staff roles & permissions, staff-to-staff context sharing
- Daily IBJA rate integration + manual override
- Rate-lock booking management with override audit log
- Custom order workflow: stages, progress photos, customer notifications, modifications
- Loyalty management
- Estimate → Invoice conversion
- Old gold exchange URD/RCM self-invoice
- WhatsApp invoice & catalog sharing
- Reports: daily sales, stock valuation, end-of-day, PMLA flag

**Customer App capabilities** (Journeys 4, 5):
- Product catalog with lifestyle imagery, category filters, wishlist
- Live gold rate on home screen (updated throughout day)
- Store info, hours, location, directions (maps)
- HUID QR scan with BIS verification
- Ring/bangle size guides (physical + paper-print methods)
- Try-at-home booking flow
- Rate-lock booking with deposit
- Custom order customer view: progress photos, status updates, modification requests
- Verified-in-store-buyer reviews & ratings
- Return/exchange policy display (shopkeeper-configured)
- Gift mode (mark inquiry as gift)
- Privacy consent toggle for viewing tracking
- Push notifications (rate alerts, progress updates, festival reminders)
- White-label branding: anchor's logo/colors/name/domain
- Family-shareable product links (WhatsApp deep link)

**Platform Admin capabilities** (Journey 6):
- Tenant provisioning (create shop, RLS policies, domain setup)
- Theme/branding configurator (logo, colors, app name, domain)
- Feature flag admin per tenant (try-at-home, wholesale, gold schemes, etc.)
- Tenant analytics dashboard (cross-tenant, usage metrics, compliance flags)
- Remote support / read-only tenant access for troubleshooting
- Onboarding automation & walkthrough scripts
- Subscription & billing management

**Cross-cutting capabilities**:
- Multi-tenant isolation (shop_id FK + PostgreSQL RLS)
- Near-real-time sync (< 30 sec propagation shopkeeper writes → customer reads)
- Hindi-first UI with English toggle
- Offline shopkeeper invoice with sync-on-reconnect
- DPDPA-compliant consent + encryption + data deletion workflow
- BIS/GST/PMLA/Section 269ST compliance engine (shared across all tenants)

---

## Domain-Specific Requirements

Indian jewellery retail + fintech compliance overlay. HIGH complexity driven by 5 stacked regulatory surfaces + multi-tenant architecture. All requirements below are **non-negotiable** — non-compliance carries business-ending risk (fines, imprisonment, loss of BIS registration).

### Compliance & Regulatory

**1. BIS Hallmarking + HUID (Bureau of Indian Standards)**
- Mandatory for gold (9K, 14K, 18K, 20K, 22K, 23K, 24K) across 380 districts as of Phase 6 (March 2026)
- Silver hallmarking voluntary since September 2025; mandatory status under evaluation — build for mandatory compliance
- **HUID requirements:** Every hallmarked product must carry a 6-digit alphanumeric HUID laser-marked at AHC; every invoice must record HUID per line item
- **BIS API integration:** 2025 mandate — every step of hallmarking (weighing, XRF testing, laser marking) must report digitally to BIS portal (`manakonline.in`, `huid.manakonline.in`). No public open API — access requires BIS authorization OR third-party wrapper (Surepass for consumer verification only)
- **Jeweller BIS registration:** Rs 2,000 application + Rs 7,500 registration fee (MSME concessions 20-80%); lifetime validity once granted
- **Exemptions:** Jewellery under 2 grams, Kundan/Polki/Jadau, gold bullion/coins/threads, jewellers with turnover ≤ Rs 40 lakh (app must support exemption flagging)
- **Penalties:** Fine up to 5× cost of non-compliant article; Rs 5 lakh general; imprisonment up to 1-3 years; loss of BIS registration

**2. GST on Gold & Silver Jewellery (CBIC)**
- 3% on metal value (1.5% CGST + 1.5% SGST); HSN 7113 (jewellery), 7108 (gold), 7106 (silver)
- 5% on making/labour charges (HSN 9988)
- E-invoicing mandatory for turnover > Rs 5 crore (not anchor's initial concern; platform concern for larger tenants)
- GSTR-1 monthly filing if turnover > Rs 1.5 crore; GSTR-3B monthly if > Rs 5 crore
- **URD Purchase (Unregistered Dealer — old gold from customer):**
  - Reverse Charge Mechanism: buyer (jeweller) pays 3% GST; self-invoice required
  - Rule 32(5) Margin Scheme has CONFLICTING AAR rulings (Karnataka/Maharashtra allow; Kerala rejects) — **default to RCM for anchor MVP (safer); expose Margin Scheme as Phase 4+ config option for tenants in supportive states**
- **App enforcement:** Hard-coded 3%+5% split on metal + making; no user override on rates. B2C + B2B wholesale invoice types with correct GST treatment.

**3. Income Tax — PAN & Cash Transaction Rules**
- **Rule 114B:** PAN mandatory for any transaction ≥ Rs 2 lakh (all payment modes). Form 60 acceptable substitute.
- **Section 269ST:** No person shall receive Rs 2 lakh+ in cash in single transaction/day/event. Penalty: 100% of amount received, on the **receiver** (jeweller). Effective cap: Rs 1,99,999.
- **Section 269SS/269T:** Loans/deposits ≥ Rs 20,000 must be via account payee cheque/DD/electronic transfer.
- **TCS (Section 206C(1D)):** 1% TCS on cash sale of bullion > Rs 2 lakh.
- **App enforcement:** Hard-block invoice completion without PAN/Form 60 at Rs 2L threshold. Hard-block cash receipt at Rs 1,99,999 with override requiring supervisor justification logged to audit trail. TCS auto-calculation on bullion cash sales.

**4. PMLA Compliance + FIU-IND Reporting**
- Jewellers are **reporting entities** under PMLA since December 2020 for cash transactions ≥ Rs 10 lakh/month (single or aggregate from one person).
- **FIU-IND Registration:** Mandatory at first qualifying transaction via FINnet 2.0 portal.
- **Cash Transaction Reports (CTR):** Cash ≥ Rs 10 lakh/month → due 15th of following month. Cross-border transactions > Rs 5 lakh also reportable.
- **Suspicious Transaction Reports (STR):** Any suspected money laundering — no minimum threshold — within 7 working days.
- **Record retention:** 5 years minimum.
- **Penalties:** Rs 1 lakh per failure to report; imprisonment up to 7 years for deliberate non-compliance.
- **App enforcement:** Cumulative cash tracking per customer per month; auto-flag at Rs 8L (warn), Rs 10L (block + CTR template generation). 5-year audit log immutability. STR template with guided fields.

**5. DPDPA 2023 (Digital Personal Data Protection Act)**
- Phased enforcement: Phase 1 (Nov 2025, partial), Phase 2 (Nov 2026, consent manager), **Phase 3 (May 13, 2027 — FULL enforcement)**
- **Obligations as Data Fiduciary:**
  - Free, specific, informed, unconditional consent before processing
  - Privacy notice with data categories, purposes, grievance mechanism
  - Data minimization, purpose limitation, accuracy
  - Encryption at rest (AWS RDS encryption) and in transit (TLS 1.3)
  - 72-hour breach notification to DPBI + affected users
  - Data retention: min 1 year, erase on purpose fulfillment or consent withdrawal
  - Right to erasure: honor deletion request within reasonable time
  - Child protections: no tracking/profiling of minors; verifiable parental consent
  - Processor contracts with DPA for any third-party processor (AiSensy, Razorpay, IBJA, etc.)
- **Penalties:** Up to Rs 250 crore for security safeguard failures; up to Rs 200 crore for breach notification failures; up to Rs 200 crore for child data violations; up to Rs 50 crore general.
- **App requirements:** Consent flow in customer app signup (default-on for viewing tracking, opt-outable); privacy notice accessible; data export & deletion workflows; breach notification runbook; DPA agreements with all third-party vendors.

### Technical Constraints

**Security Requirements**
- **Multi-tenant isolation:** Zero cross-tenant data leakage. PostgreSQL row-level security policies enforced on all tables with `shop_id`. Tenant context injected at API gateway; verified at query layer.
- **Encryption:** AES-256 at rest (RDS encryption, S3 SSE); TLS 1.3 in transit (all HTTPS; no HTTP fallback). PAN numbers hashed/encrypted at application layer beyond RDS encryption.
- **Authentication:** Phone OTP primary (Supabase Auth or Firebase Auth); session tokens with secure attributes, short expiry, refresh token rotation.
- **Authorization:** Role-based access control per shop (owner/manager/staff); staff-level permissions granular (billing, inventory edit, settings, analytics view).
- **Audit logging:** All compliance-sensitive actions (invoice creation, cash override, scheme payment, PAN capture, HUID entry, CTR trigger) logged immutably with timestamp, user, tenant, before/after state. 5-year retention minimum.
- **Secrets management:** AWS Secrets Manager for API keys (IBJA, Razorpay, AiSensy, Digio); no secrets in code, env files, or logs.
- **Rate limiting:** API-level rate limits to prevent abuse; per-tenant throttles to prevent noisy-neighbor issues.

**Privacy Requirements**
- **Data minimization:** Collect only what's required. PAN collected only at Rs 2L+ threshold; Aadhaar never collected (use Form 60 alternative).
- **Consent:** Explicit opt-in for viewing tracking, WhatsApp marketing (separate from transactional), push notifications.
- **Data residency:** All customer data stored in AWS Mumbai (ap-south-1); no cross-border data transfer without DPA in place.
- **Data deletion:** User-initiated deletion workflow via customer app settings; processed within 30 days (7-day internal target); compliance records retained per regulatory requirements (invoices, KYC) even after user deletion — with user notification of this retention.
- **Third-party data sharing:** Tax filings (GSTR, FIU-IND CTR/STR) are legally required; WhatsApp/Razorpay/Ola Maps have their own DPAs.

**Performance Requirements**
- **Real-time sync:** Shopkeeper writes → customer app visibility in < 30 seconds at p95 (MVP target; upgrade to true real-time Phase 3+).
- **Customer app first meaningful paint:** < 2.5 sec on 4G (Ayodhya Tier-2 network reality).
- **Shopkeeper app billing screen interactive:** < 1 sec on mid-tier Android (Xiaomi/Realme/Samsung mid-range).
- **IBJA rate fetch:** Every 15 min during market hours (10am-5pm); manual refresh available; Redis-cached.
- **Database query p95:** < 200 ms for common reads (inventory list, invoice create, customer lookup).
- **Offline support:** Shopkeeper app supports invoice creation offline (WatermelonDB); sync on reconnect within 30 sec.

**Availability Requirements**
- **Uptime baseline:** 99.5% (3.65 hrs downtime/month acceptable for MVP).
- **Wedding-season uptime:** 99.9% during Dhanteras week, Akshaya Tritiya week (tightened SLA; < 45 min downtime/week).
- **Disaster recovery:** AWS Mumbai multi-AZ deployment; RDS automated backups (daily, 7-day retention); RTO 4 hours, RPO 1 hour for MVP.
- **Regional failover:** Defer to Phase 3+ (cross-region active-passive with ap-south-2 Hyderabad).

### Integration Requirements

**Required third-party integrations (anchor MVP)**
- **IBJA gold rate API** (primary) — daily rate fetch with manual override fallback; Metals.dev as secondary fallback
- **Razorpay** — UPI + card deposits for rate-lock, custom order advance, scheme payments (when shipped); webhooks for payment status
- **AiSensy WhatsApp Business API** — invoice sharing, progress photos, rate alerts, scheme reminders, festival campaigns
- **MSG91 OTP** — phone verification for shopkeeper and customer auth
- **Ola Maps** — store locator, directions in customer app; geocoding
- **ImageKit** — product image CDN + on-the-fly transformations
- **FCM (Firebase Cloud Messaging)** — push notifications on both apps
- **Surepass HUID API** — consumer-facing HUID verification wrapper (since BIS has no public API)
- **PostHog** — product analytics + session replay (self-hosted in Mumbai or EU region for DPDPA compliance)
- **Sentry** — error tracking (self-hosted in Mumbai or data-residency-aware tier)

**Deferred integrations (Phase 4+)**
- BIS HUID portal direct API integration (for jeweller hallmarking workflow — not anchor scope since anchor uses AHC-provided HUIDs)
- Digio for KYC automation (Phase 4+ when embedded finance ships)
- Tally data export / one-way sync (for tenants migrating from Tally)
- Augmont/SafeGold for bullion sourcing API (Phase 4+)
- Accounting export (GSTR-1/3B JSON) — MVP is CSV export; automated JSON export Phase 4+

### Risk Mitigations

**Regulatory Risks**
- **Risk:** BIS HUID mandate expansion to new districts caught mid-build.
  - **Mitigation:** District configuration in admin settings; shopkeeper selects their district; app auto-checks mandatory status; feature releases tied to district config, not code.
- **Risk:** DPDPA Phase 3 enforcement (May 2027) catches us unprepared.
  - **Mitigation:** All DPDPA requirements (encryption, consent, breach notification, deletion workflow) built from Day 1 — not retrofitted.
- **Risk:** Rule 32(5) Margin Scheme ruling changes (Supreme Court resolution of AAR conflict).
  - **Mitigation:** Default to RCM (conservative); Margin Scheme as configurable Phase 4+ option; monitor legal updates quarterly.
- **Risk:** Cash transaction reporting failure → Rs 1 lakh fine + imprisonment up to 7 years for jeweller.
  - **Mitigation:** App cannot fail silently on PMLA thresholds — hard-block + CTR template generation; shopkeeper trained at onboarding on CTR filing workflow.

**Technical Risks**
- **Risk:** Weight-precision error (FLOAT arithmetic) compounds over thousands of transactions.
  - **Mitigation:** Schema review gate — all weight columns DECIMAL(10,3) or DECIMAL(12,4); automated test validates 10,000-transaction precision before any release.
- **Risk:** Tenant isolation bug — tenant A sees tenant B data.
  - **Mitigation:** Automated tenant-isolation test suite from sprint 1; RLS policies on all tables; pre-release security audit; post-launch external pentest before 2nd tenant onboarding.
- **Risk:** Near-real-time sync fails during wedding-season peak load.
  - **Mitigation:** Load test at 10x baseline; queue-based publish architecture; degraded-mode fallback (polling every 60 sec) if real-time path overloaded.
- **Risk:** IBJA API outage → all pricing stale.
  - **Mitigation:** Metals.dev fallback + manual override; cached last-known-good rate with "stale" indicator; shopkeeper-visible alert.
- **Risk:** Anchor data loss (shop goes offline for hours with unbilled customers).
  - **Mitigation:** Offline-first shopkeeper app; WatermelonDB local persistence; sync on reconnect; conflict resolution favoring transactional locks on stock movements.

**Integration Risks**
- **Risk:** Razorpay / AiSensy / IBJA vendor lock-in.
  - **Mitigation:** Adapter pattern on all vendor integrations; swap requires adapter rewrite only, no data migration.
- **Risk:** Third-party vendor compliance gaps (AiSensy DPA missing, Razorpay PCI-DSS audit lapsed).
  - **Mitigation:** Annual vendor DPA + compliance review; legal review before signing.

**Business/Operational Risks**
- **Risk:** Anchor scope creep mid-build.
  - **Mitigation:** Written SOW with change management process; out-of-scope work billable; weekly demos catch drift early.
- **Risk:** Anchor's customers install app but engagement is low (dormancy).
  - **Mitigation:** Engagement instrumentation in Phase 0 (not Phase 2); Month-6 metrics gate with pre-defined pivot trigger to shopkeeper-only SaaS.
- **Risk:** Competitor (Khatabook, BharatPe) launches jewelry module.
  - **Mitigation:** Jewelry-native depth (HUID, URD/RCM, karigar, loyalty) they can't replicate in < 2-3 quarters; lock in 50+ tenants fast.

### Completeness Validation

Items often overlooked in Indian jewellery retail compliance that this PRD explicitly addresses:
- ✓ Wholesale B2B invoice distinct from B2C (different GST treatment, template, terms)
- ✓ URD purchase RCM self-invoice vs. Margin Scheme choice (conservative default)
- ✓ TCS on bullion cash sales (separate from Section 269ST cash cap)
- ✓ PAN threshold (Rs 2L) vs. PMLA threshold (Rs 10L) — different triggers, different flows
- ✓ Silver hallmarking status tracking (voluntary today, mandatory soon)
- ✓ 5-year PMLA record retention immutability (not just audit log hygiene)
- ✓ Child data protections (jewellery purchases for minors — parental consent flow)
- ✓ Consent manager readiness for DPDPA Phase 2 (Nov 2026)
- ✓ District-level BIS mandate tracking (380 districts today, expanding)
- ✓ BIS registration certificate upload + expiry tracking in shop profile

**A+P synthesis applied inline:** Winston (tenant isolation + encryption), Murat (weight-precision test gate, 10,000-transaction validation), Mary (AAR conflict flag on Rule 32(5)), Victor (adapter pattern for vendor lock-in), Sally (shopkeeper-trained CTR workflow), Paige (completeness checklist).

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Customer Viewing Analytics as B2B2C Salesperson Intelligence (genuinely novel)**

Big brand apps (Tanishq, CaratLane) have sophisticated customer analytics, but the insight never reaches the salesperson standing in the showroom — it powers backend personalization and email campaigns. Goldsmith's innovation: push customer viewing data to the shopkeeper app in real time, so when a customer walks into the shop, the salesperson sees a notification with that customer's wishlist, recent views, time spent per piece, and can open the conversation with specific context. *"Priya-ji, the diamond bridal set you looked at last night — it's in the display case. Want to try it on?"* This closes the gap between digital intent and in-person sales that chain brands can't close (they don't have hyperlocal salespeople who greet you by name).

**Why this is novel:** Existing "customer 360" tools (Salesforce, HubSpot) are built for corporate sales teams with CRM discipline. Indian local jewelers have never had the CRM muscle to use such tools. Goldsmith bundles the intelligence into the salesperson's daily workflow at exactly the moment the customer walks in — zero CRM learning curve.

**2. White-Label Multi-Tenant Where Each Tenant's Brand Is The Product**

Existing multi-tenant SaaS (Shopify, Squarespace) is white-label-*adjacent* — the storefront carries the tenant's brand, but the admin dashboard is Shopify/Squarespace. Goldsmith's innovation: the shopkeeper's admin UI is ALSO in their brand. Customer-facing surfaces (mobile apps, web, WhatsApp templates) use anchor's brand exclusively. The platform brand is invisible to everyone except the platform team.

**Why this is novel for Indian jewelry:** eJOHRI is a marketplace (all jewelers under eJOHRI brand). Tanishq/CaratLane are single-brand direct channels. No one has built "Shopify for local jewelers where each shop looks like Tanishq under their own name." The architectural discipline to make this work — per-tenant theme config, shopkeeper self-service settings, domain-per-tenant — is the moat.

**3. Shopkeeper Self-Service Configuration as First-Class UX**

Enterprise SaaS rarely exposes deep configuration to end-users; it's usually locked behind "contact sales" or admin consoles requiring training. Goldsmith's innovation: the 55-year-old Ayodhya jeweller changes his own making charges, loyalty thresholds, try-at-home toggles in Hindi-first admin UI, and the customer app reflects in 30 seconds. Platform team never touches it.

**Why this is novel:** Indian SMB SaaS (Tally, Marg, Omunim) requires vendor-led configuration. Every price change is a support ticket or a sales call. Goldsmith's "settings as a product" philosophy removes this dependency — the shopkeeper runs their own technology.

**4. Anchor-Customer-Then-Platform GTM in Indian Jewelry Vertical**

Proven in Indian B2B SaaS (Zoho started with one big customer; Freshworks began as Freshdesk for a single client; GoFrugal grew from Chennai retailers). Never tried in jewelry ERP — Marg, Tally, Omunim all launched as horizontal products targeting mass market. Goldsmith's innovation: go deep with anchor, productize later. Lower capital risk, higher product-market fit, slower scale curve (acceptable trade-off in a category where trust matters).

### Market Context & Competitive Landscape

**What exists:**
- **Horizontal SMB apps** (Khatabook, Vyapar, myBillBook, GimBooks): cheap, mobile-first, popular, NOT jewelry-deep
- **Vertical jewelry ERPs** (Tally + jewelry addons, Marg, Omunim, GehnaERP, Nebu): desktop-first, feature-rich, broken support (91% Tally complaints unresolved)
- **Consumer D2C jewelry brands** (CaratLane, BlueStone, Candere): polished apps, own brand only, structural trust issues (1.6-3.3/5 app store ratings)
- **Marketplace attempts** (eJOHRI with $1M seed, 200 jewelers): multi-brand aggregator, low brand equity per seller

**What doesn't exist (the innovation gap):**
- A mobile-first, Hindi-first, jewelry-native ERP that lets each shopkeeper have their OWN customer-facing app under their OWN brand
- A customer-viewing-analytics layer that empowers the local salesperson, not a central CRM
- A platform where "sign up a new jeweler" takes 3 weeks at Month 9 and 1 week at Month 12 via self-service

**Validation from Market Research:**
- 75% of India's 500,000+ local jewelers have no formal software
- Only 18% of gold buyers know HUID requirement (trust-layer innovation opportunity)
- BIS HUID mandate covers 380 districts — regulatory tailwind, not headwind
- AiSensy Rs 1,500/mo WhatsApp, IBJA rate API, Ola Maps 5M free calls, ImageKit, FCM — the infrastructure for a low-cost premium product is finally affordable in India

### Validation Approach

**For customer viewing analytics (Innovation #1):**
- Measure anchor's salesperson walk-in conversation quality via post-interaction NPS with customers (target > 60)
- Track "%-of-walk-ins-where-staff-opened-with-contextual-greeting" over first 90 days (target 70%+)
- Compare vs. baseline (pre-app) walk-in → sale conversion rate
- Pilot with anchor's 3-5 staff; measure staff adoption (target 100% usage within 30 days)

**For white-label multi-tenant (Innovation #2):**
- Demonstrate 2nd tenant onboarding in < 3 weeks at Month 9 with zero code changes
- Measure % of customer-visible elements that carry anchor's brand (target: 100%; platform brand NEVER visible to end customer)
- Validate legal structure: each tenant owns their brand, domain, customer data; platform is intermediary

**For shopkeeper self-service config (Innovation #3):**
- Anchor changes ≥ 3 admin settings themselves in first 30 days (target), zero platform-team support tickets on settings
- Average time-to-configure new setting < 2 minutes
- Post-onboarding survey: "Can you change your own making charge without calling us?" → 100% yes

**For anchor-customer GTM (Innovation #4):**
- Anchor deployment stable by Month 5 (signed off, zero P1 bugs)
- Anchor references Goldsmith to ≥ 1 other jeweler by Month 7
- 2nd paying tenant by Month 9

### Risk Mitigation (Innovation-Specific)

**Risk: Customer viewing analytics feels "creepy" — customers perceive surveillance.**
- *Mitigation:* Clear opt-in consent in customer app signup flow ("Allow [Anchor Jewellers] to remember what you browsed to serve you better?"). Always-visible opt-out in customer app settings. Shopkeeper sees only consenting customers' data. Privacy notice in clear Hindi, not legalese. DPDPA Phase 3 compliance built-in from Day 1.

**Risk: White-label complexity eats the development budget.**
- *Mitigation:* MVP white-label scope = theme + logo + name + domain + app-strings (not per-tenant iOS/Android app builds). Per-tenant native app submission deferred to Phase 4+ when justified by tenant count and commercial terms. Shared app with dynamic theming is the MVP approach; native per-tenant apps are the vision.

**Risk: Self-service config creates misconfigurations that break compliance (e.g., shopkeeper sets making charge GST to 3% instead of 5%).**
- *Mitigation:* Compliance-sensitive values (GST rates, HUID format, Section 269ST cap, PAN threshold) are PLATFORM-controlled, NOT shopkeeper-configurable. Shopkeeper can edit making-charge amounts, loyalty tiers, policy text, branding — NOT the regulatory math. Clear separation documented in settings model.

**Risk: Anchor-customer GTM is slow (one tenant by Month 5, two by Month 9) — investors or team lose patience.**
- *Mitigation:* Pre-defined pivot trigger at Month 6 (if consumer engagement weak, pivot Phase 2 to shopkeeper-only SaaS — smaller prize but profitable). Expectations set from Day 1 that the curve is "slow then fast" — same codebase serves both paths.

**Fallback if any innovation fails:**
- If customer analytics doesn't drive measurable sales uplift → still a B2B2C CRM feature with moderate value; keep it, deprioritize
- If white-label takes longer than expected → ship shared-app-with-theming for MVP, native per-tenant apps Phase 4+
- If self-service config causes support tickets → add guided tour + in-app video help; worst case, lock advanced settings behind "contact support"
- If anchor GTM stalls → pivot to shopkeeper-only SaaS (Path B per Executive Summary)

**A+P synthesis applied:**
- **Victor (Innovation Strategist):** Highlighted "white-label where each tenant's brand IS the product" as the true moat — elevated from buried detail to lead innovation.
- **Dr. Quinn (Problem Solver):** Identified "customer analytics reaching salesperson in real-time" as root-cause solution to "local jewelers can't digitize customer relationships" pain — elevated to Innovation #1.
- **Carson (Brainstorming Coach):** Suggested the "settings as a product" framing for self-service config — adopted.
- **Maya (Design Thinking):** Flagged privacy/surveillance perception risk for customer analytics — captured in risk mitigation with specific consent language.

---

## Project-Type Specific Requirements

Hybrid across three project types: **saas_b2b** (multi-tenant platform substrate), **mobile_app** (primary surfaces for shopkeeper and customer), **web_app** (customer web + platform admin). Key questions from each type addressed below.

### SaaS B2B — Multi-Tenant Platform Requirements

**Tenant Model**
- **Isolation strategy:** Single-database multi-tenant with `shop_id` FK on every tenant-scoped table + PostgreSQL row-level security (RLS) policies.
- **Tenant provisioning:** Platform admin console creates tenant row, seeds default settings, provisions tenant-specific S3 prefix for assets, configures DNS/CNAME for custom domain (when applicable).
- **Tenant identification at runtime:** (a) custom domain CNAME-resolved, (b) `X-Tenant-Id` header for API calls, (c) JWT claim for authenticated sessions. NestJS interceptor injects tenant context into every request scope.
- **Tenant lifecycle:** ACTIVE → SUSPENDED (payment overdue) → TERMINATED (off-boarded). Data retention per tenant on termination — 30-day soft-delete, then hard-delete after shopkeeper explicit consent or per DPDPA.
- **Tenant data boundaries:** Product images, invoices, scheme records, customer PII all segregated by `shop_id`. No cross-tenant queries in application code.

**RBAC (Role-Based Access Control) Matrix**

Per-tenant roles (within a single shop):

| Role | Inventory | Billing | Customer CRM | Admin Settings | Reports | Viewing Analytics |
|------|-----------|---------|--------------|----------------|---------|-------------------|
| **Owner** | Full CRUD | Full CRUD, override | Full CRUD | Full CRUD | Full | Full |
| **Manager** | Full CRUD | Full CRUD (no override) | Full CRUD | Read-only | Full | Full |
| **Staff/Salesperson** | Read + limited edit (mark sold, reserve) | Create invoice (approve by manager for > configured limit) | Read + notes | No access | Own sales only | Assigned customers |
| **Accountant** (Phase 4+) | Read | Read | Read | Read | Full | No access |

Platform-level roles (across tenants):

| Role | Tenants | Platform Settings | Billing Plans | Support Access |
|------|---------|-------------------|---------------|----------------|
| **Platform Admin** | All CRUD | Full | Full | Full (read-only tenant data, with audit log) |
| **Platform Support** | Read + impersonate for support | None | None | Ticket-scoped tenant read access, time-limited |

**Subscription Tiers (initial; will evolve post-anchor)**
- **Anchor:** Custom commercial terms (build fee + post-launch support SLA); not a tier.
- **Starter (Month 9+):** Shopkeeper app only + basic customer app (inventory + billing + HUID + basic CRM); Rs 999-1,499/month; intended for 2nd-10th jewelers onboarding.
- **Pro (Month 9+):** Full MVP feature set (loyalty, custom orders, rate-lock, try-at-home, viewing analytics, wholesale); Rs 2,499-4,999/month.
- **Enterprise (Phase 4+):** Karigar module, multi-salesperson analytics, advanced reporting, GSTR auto-export, priority support; Rs 7,500-15,000/month.
- **Freemium (Phase 4+ consideration):** Free inventory + basic billing for < 10 invoices/month to capture long-tail, conversion-driven.

**Integration List (MVP)**
- IBJA gold rate API (primary), Metals.dev fallback
- Razorpay payment gateway (UPI, cards, EMI)
- AiSensy WhatsApp Business API
- MSG91 OTP
- Ola Maps (store locator, geocoding)
- ImageKit (product image CDN)
- Firebase Cloud Messaging (push)
- Surepass HUID verification (consumer-facing)
- PostHog (product analytics, data-residency-compliant deployment)
- Sentry (error tracking)
- AWS S3 (Mumbai) for file storage
- AWS RDS PostgreSQL (Mumbai) with multi-AZ

**Compliance Requirements**
See Domain-Specific Requirements section above for full detail (BIS, GST, PMLA, DPDPA, Section 269ST).

### Mobile App Requirements

**Native vs Cross-Platform**
- **Decision:** Cross-platform via React Native (Expo) for both shopkeeper and customer apps.
- **Rationale:** Shared component library across both apps + with web stack (Next.js + shared React ecosystem); faster iteration; cheaper team; Expo EAS handles builds/submissions. Native performance is not a bottleneck for this product's workloads (catalog browse, barcode scan, billing form, photo upload).
- **Trade-off accepted:** Heavy AR/video features (Phase 4+) may require native modules or separate native apps. Acceptable deferral.

**Offline Support**
- **Shopkeeper app:** Critical. WatermelonDB local persistence for inventory, customers, drafts, open invoices. Conflict resolution on reconnect: transactional locks for stock movements (pessimistic); CRDT-style merge for non-stock fields (last-writer-wins with timestamp).
- **Customer app:** Not critical. Online-only acceptable (Ayodhya 4G is reasonable for browsing; cached product images via standard RN image caching).

**Push Notifications**
- **Shopkeeper app pushes:** Rate-update alert, low-stock alert, PMLA threshold warning, custom order milestone ready for customer notification, customer walk-in (if attribution works via proximity), support reply.
- **Customer app pushes:** Gold rate alerts (opt-in), custom order progress photo ready, festival campaign (Dhanteras, Akshaya Tritiya), loyalty tier milestone, wishlist price drop, try-at-home booking confirmation.
- **Provider:** FCM (free); configured per tenant with tenant-specific notification icons.
- **Opt-in flow:** Asked at signup; granular controls in customer app settings (marketing vs transactional vs alerts).

**Device Features**
- **Required:** Camera (barcode scan, HUID QR scan, product photo upload, custom order progress photos), Location (store locator in customer app), Secure storage (auth tokens, PAN encrypted), Local storage (WatermelonDB for shopkeeper offline).
- **Optional:** NFC (future UPI Lite X in Phase 4+), Biometric auth (Face ID / fingerprint for shopkeeper login; nice-to-have, defer to post-MVP if cuts cost).
- **Permissions requested:** Camera, Location (customer app only, one-time at store-locator entry), Notifications, Storage (for offline mode shopkeeper app).

**Store Compliance (Play Store + App Store)**
- **Play Store:** Standard Indian retail category. Data safety disclosure (phone, PAN stored encrypted, purchase history, viewing analytics with opt-in). Age rating: everyone (3+).
- **App Store:** Standard. Apple App Tracking Transparency (ATT) prompt for viewing analytics. Privacy nutrition label per DPDPA requirements.
- **Publishing account decision:** Platform-owned developer account for MVP anchor (simpler); per-tenant developer accounts for Phase 4+ if tenant wants full native app ownership. Document this in platform commercial terms.
- **App name per tenant:** Anchor's app in stores listed as "[Anchor Jewellers]" (not "Goldsmith"). App bundle ID per tenant. Release automation handles multi-variant submissions.

### Web App Requirements

**Single Page App (SPA) vs Multi-Page (MPA)**
- **Customer web:** Next.js with App Router — hybrid SSG for catalog pages (SEO-relevant), SSR for product detail (live rate + inventory), client-side for wishlist/auth flows.
- **Platform admin:** Pure SPA (Next.js with client-side rendering); no SEO needed, admin access only.

**Browser Support**
- **Tier 1 (full support):** Chrome 100+, Safari 15+, Edge 100+, Firefox 100+ (desktop + mobile)
- **Tier 2 (graceful degradation):** Samsung Internet (heavy in Tier-2/3 India), UC Browser (India market share material)
- **Not supported:** Internet Explorer (zero consideration)

**SEO Needed**
- **Customer web:** YES. Anchor's shop needs discoverability when pilgrims Google "jewelry shop Ayodhya" or customers Google "[Anchor Jewellers]". Target: category pages + product pages indexed; structured data (Schema.org JewelryStore, Product); sitemap; robots.txt.
- **Platform admin:** No (noindex).

**Real-Time Requirements**
- **Customer web:** Live gold rate refresh (polling every 60 sec); near-real-time inventory updates (< 30 sec propagation via polling); WebSocket/SSE deferred to Phase 3+.
- **Platform admin:** Tenant metrics refresh on demand; no hard real-time requirement.

**Accessibility**
- **Target:** WCAG 2.1 AA for customer web (public-facing; DPDPA has accessibility considerations).
- **Scope:** Color contrast, keyboard navigation, screen reader labels, alt text on product images, form error announcements.
- **Hindi/English toggle:** Language switcher accessible; font scales with browser zoom; Hindi fonts (Noto Sans Devanagari) bundled.
- **Deferred:** Full WCAG AAA, voice navigation — Phase 4+.

### Technical Architecture Considerations

**Monorepo Structure**
```
goldsmith/
  apps/
    shopkeeper/          # React Native (Expo) — shopkeeper mobile
    customer-mobile/     # React Native (Expo) — jeweller-branded customer mobile
    customer-web/        # Next.js — jeweller-branded customer web
    admin/               # Next.js — platform team admin
  packages/
    api/                 # NestJS backend
    shared/              # Shared types, Zod schemas, utilities
    ui-mobile/           # Shared RN component library (NativeWind)
    ui-web/              # Shared React component library (shadcn/ui, 21st.dev)
    db/                  # Drizzle ORM schema + migrations
    tenant-config/       # Per-tenant config, theme, feature flags
    compliance/          # Shared GST/HUID/Section 269ST/PMLA logic
  _bmad/                 # BMAD framework
  _bmad-output/          # BMAD artifacts
```
**Tool:** Turborepo for task orchestration + caching.

**Backend Architecture**
- **Framework:** NestJS with modular structure (inventory module, billing module, customer module, compliance module, analytics module, admin module, auth module).
- **Tenant interceptor:** Resolves tenant from request context; injects into TenantContext service used by all downstream services.
- **Database:** PostgreSQL 15+ with Drizzle ORM; RLS policies as safety net even on code bugs.
- **Cache:** Redis for IBJA rate cache, session store, rate-limit counters.
- **Queue:** BullMQ (Redis-backed) for WhatsApp sends, push notifications, scheduled reminders, end-of-day reports, PMLA CTR generation.
- **File storage:** S3 (Mumbai) with per-tenant prefixes; pre-signed URLs for upload; CloudFront + ImageKit for image delivery.

**Frontend Architecture (Mobile)**
- **React Native (Expo SDK 50+):** Expo Router for navigation.
- **State management:** Zustand for global state; TanStack Query for server state with optimistic updates.
- **Forms:** React Hook Form + Zod schemas (shared with backend).
- **Offline:** WatermelonDB in shopkeeper app; standard AsyncStorage in customer app for preferences.
- **UI:** NativeWind for styling; **component library sourced from 21st.dev** for premium components (cards, modals, data tables); tenant theme applied via React Context.

**Frontend Architecture (Web)**
- **Next.js 14+ (App Router):** Hybrid rendering (SSG/SSR/CSR per page).
- **UI:** Tailwind CSS + shadcn/ui; **design inspiration from godly.website**; tenant theme via CSS variables + theme provider.
- **State:** Zustand + TanStack Query (same as mobile for consistency).
- **i18n:** next-intl with Hindi as default, English as fallback.

### Implementation Considerations

**Testing Strategy (ties to Step 3 targets)**
- **Unit tests:** Jest + React Testing Library; ≥ 75% coverage on billing, HUID, compliance modules; critical paths 90%+.
- **Integration tests:** NestJS e2e tests for API + database + tenant isolation; ≥ 60% coverage on multi-tenant flows.
- **E2E tests:** Playwright for web, Detox for mobile; smoke suite < 10 min on CI; critical journeys (onboarding, first invoice, custom order, customer first visit) fully automated.
- **Tenant isolation suite:** Custom test harness that spins up 3 tenants and asserts zero cross-tenant data visibility across every API endpoint. Runs on every CI.
- **Weight-precision harness:** Simulates 10,000+ transactions with realistic weight × rate × making charges × GST calculations; asserts paise-level accuracy.
- **Load testing:** k6 scripts at 10x baseline wedding-season load before each release.

**CI/CD**
- **GitHub Actions** pipelines: lint → unit → integration → build → e2e smoke → deploy to staging → manual promote to production.
- **Expo EAS** for mobile builds and submissions.
- **Vercel / AWS Amplify** for web deploys (multi-tenant domain handling).
- **Automated changelog + release notes** via conventional commits.

**Observability**
- **Sentry** for errors (shopkeeper + customer + web + backend).
- **PostHog** for product analytics + session replay (data-residency-compliant deployment).
- **CloudWatch** for infra metrics (ECS/EKS, RDS, Redis, S3).
- **Structured JSON logs** with tenant_id, user_id, request_id for correlation.

**Performance Budgets**
- **Customer web first-load JS:** < 250 KB (gzipped) on critical path.
- **Customer mobile cold-start to product view:** < 60 sec p95 (4G Ayodhya baseline).
- **Shopkeeper billing screen interactive:** < 1 sec on mid-tier Android.
- **Backend API p95:** < 200 ms for reads, < 500 ms for writes.

**A+P synthesis:**
- **Winston:** Tenant isolation suite as sprint-1 non-negotiable; RBAC matrix explicitly documented (not implicit).
- **Murat:** Weight-precision harness called out as required deliverable, not aspiration.
- **Sally:** Browser support Tier 2 includes Samsung Internet + UC Browser (Indian market reality, often overlooked).
- **Winston:** Per-tenant S3 prefix as isolation belt-and-suspenders; pre-signed URLs with tenant-scoped signatures.
- **Paige:** Performance budgets explicit; first-load JS < 250 KB enforced in CI.

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** **Platform-MVP, delivered as Anchor-MVP** — a dual-layered strategy.

- **Anchor-layer:** Ship the anchor jeweller a feature-complete product that makes them say "this is exactly what I needed" within 30 days of launch. Fund from anchor engagement fee. Validate the product works for one deeply-served customer.
- **Platform-layer:** Architect everything (database, config, UI, deployment) so that the 2nd, 10th, and 100th jeweller require only configuration, not code. The 2-week architectural overhead we pay now is the whole business later.

**Why this approach over alternatives:**
- **Problem-solving MVP** (ship only inventory + billing): rejected — insufficient to impress the anchor or beat incumbents; misses the white-label/customer-app differentiator that matters for productization.
- **Experience MVP** (ship beautiful UX, thin features): rejected — jewellery compliance is non-negotiable; pretty UI on broken billing fails legally.
- **Revenue MVP** (charge before building): rejected — anchor is already paying; validation is about productization, not revenue.
- **Platform-MVP-via-Anchor (chosen):** combines real-world validation (anchor uses daily, pays for it) with architectural discipline (every feature built with N-tenant mindset).

**Resource Requirements**
- **Team:** 5 FTE-equivalents for Months 1-5 (anchor build phase):
  - 1 Product Manager (John, part-time OK after PRD done)
  - 1 UX/Product Designer (full-time M1-M3, part-time M4-M5)
  - 2 Frontend engineers (React Native + Next.js, one senior one mid)
  - 2 Backend engineers (NestJS + PostgreSQL, both need multi-tenant fluency)
  - 0.5 DevOps (CI/CD, AWS Mumbai, Expo EAS)
  - 0.5 QA (manual + test automation during build; goes to 1.0 FTE wedding-season hardening)
- **Build cost:** Rs 60-80L over 5 months (Indian rates, mid-senior team).
- **Infra + SaaS + integrations:** Rs 5-10L over 5 months (AWS Mumbai baseline, vendor subscriptions).
- **Anchor fee (pending commercial terms):** expected Rs 20-40L, covering 40-60% of build cost.
- **Post-anchor (Months 5-12):** team scales to 7-8 FTE (+ 1 BDR/sales for 2nd-10th jeweller GTM, + 0.5 Customer Success, + 1 additional engineer).

### MVP Feature Set (Phase 1, Months 1-5)

Core user journeys supported by MVP:
- ✓ J1 — Anchor shopkeeper happy path (inventory → billing → CRM → daily operations)
- ✓ J2 — Anchor shopkeeper wedding-season edge case (custom orders, wholesale, rate-lock, PMLA monitoring)
- ✓ J3 — Anchor staff customer-viewing analytics (novel B2B2C intelligence)
- ✓ J4 — Wedding customer journey (Priya persona — catalog, wishlist, try-at-home, custom order tracking, rate-lock, review)
- ✓ J5 — Pilgrim tourist journey (Vikram persona — store discovery, HUID verification, in-person purchase, review)
- ✗ J6 — 2nd jeweller onboarding is a **Phase 2 target** (Month 9), not MVP

Full must-have capability list in **Product Scope > MVP** section (Step 3) and **Journey Requirements Summary** (Step 4).

### Post-MVP Features

**Phase 2 — Productization & 2nd-10th Jewellers (Months 5-12)**

Already enumerated in Product Scope > Growth. Strategic additions:
- **Onboarding automation:** Tenant provisioning in < 1 day via admin console; theme configurator; feature-flag admin; remote training scripts.
- **Gold savings schemes:** Build in codebase (feature-flag OFF for anchor, ON for 2nd+ jewellers who want it); validates platform's configurability claim.
- **Karigar management module:** Critical for jewellers with heavy custom work; not an anchor priority but Suresh-ji-style 2nd jewellers will demand it.
- **GSTR-1/3B automated export:** Platform-level feature; each tenant benefits; Accountant-role addition in RBAC matrix.
- **Field-agent GTM tooling:** Mobile-based lead capture, demo scheduling, post-demo follow-up via WhatsApp automation for BDR team.

**Phase 3 — Scale in Hindi Belt (Months 12-18)**

- Multi-store management for single tenant (UP/Bihar/MP jewellers with 2-5 branches)
- Advanced customer analytics (time-on-page, search queries, heatmaps)
- Self-service tenant signup + trial (freemium-style motion for long-tail jewellers)
- Tally import/sync (to capture jewellers currently on Tally who won't migrate cold-turkey)
- Embedded finance Phase 1: NBFC partnership for scheme-backed credit to shopkeeper working capital

**Phase 4 — Vision (Month 18+)**

Full enumeration in Product Scope > Vision. Prioritised order when triggered:
1. Full cart + online checkout (once consumer engagement validated at Month 18)
2. AR try-on + video consultation (differentiators when competing with CaratLane in urban expansion)
3. Multi-store + Girvi (unlock larger-shop tenants)
4. Blockchain provenance for LGD (Surat diamond manufacturing integration)
5. Cross-border e-commerce (NRI pilgrim audience, ONDC integration possibility)
6. Embedded finance Phase 2: consumer gold loans, BharatPe-style 60%-revenue-from-finance outcome

### Scope Boundaries (explicit "OUT" for MVP — clarity for engineering)

The following are **out of MVP** and should be rejected if they appear in implementation debates:

| OUT of MVP | When (next) | Why deferred |
|-----------|-------------|--------------|
| Online cart + checkout | Phase 4+ | Anchor confirmed inquiry-only; 85% sales offline anyway |
| AR try-on | Phase 4+ | Anchor rejected for cost; urban-competitive feature |
| Video consultation | Phase 4+ | Anchor rejected for cost |
| Gold savings schemes shipped to anchor | Phase 2 (code built, flag OFF for anchor) | Anchor rejected; platform needs for 2nd+ |
| 360° product view | Phase 4+ | Cost/complexity; deferred |
| Digital gold integration | Phase 4+ | SEBI regulatory vacuum; wait for IBJA framework |
| Multi-store for single tenant | Phase 3+ | Not anchor requirement |
| Girvi / mortgage | Phase 4+ | Not anchor requirement |
| Repair scheduling | Phase 4+ | Not anchor requirement |
| True real-time sync (WebSocket/SSE) | Phase 3+ | Polling < 30 sec acceptable for MVP |
| ML recommendations / heatmaps | Phase 3+ | Requires data scale that MVP doesn't have |
| Per-tenant native iOS/Android app publishing | Phase 4+ | Shared app with theming is MVP |
| Cross-region DR / ap-south-2 failover | Phase 4+ | Multi-AZ Mumbai sufficient for MVP |
| Freemium self-service signup | Phase 3+ | Platform admin manual onboarding for first 10 tenants |
| Registered post shipping | Phase 4+ | In-person pickup + insured pouch for MVP |

### Risk Mitigation Strategy (Scope-Level)

**Technical Risks**

- **Biggest technical challenge:** Multi-tenant isolation + near-real-time sync + weight-precision math, simultaneously, under compliance load.
  - *Simplification for MVP:* Polling (not WebSocket); shared app with theming (not per-tenant native apps); single Mumbai AZ with multi-AZ redundancy (not cross-region DR); RLS policies as primary isolation (not tenant-per-schema).
  - *Riskiest assumption:* That polling every 5-30 sec survives Dhanteras-day load for anchor. Mitigation: load test at 10x baseline before wedding season.

**Market Risks**

- **Biggest market risk:** Anchor's customers don't adopt the customer app (install but dormant).
  - *MVP de-risk approach:* Engagement instrumentation on Day 1 of consumer-app launch (Phase 2); Month-6 pivot trigger pre-defined with specific thresholds (install 30%+, weekly-return 25%+, custom-order engagement 60%+, loyalty 15%+).
  - *Validation learning needed:* Actual anchor-specific adoption rates vs. research-based assumptions; refine targets based on observed behaviour.
- **Second-biggest market risk:** Jewellers #2-10 don't materialise (anchor refers nobody; trade events don't convert).
  - *Mitigation:* Don't bet on any one GTM path. Run 3 parallel experiments (referral + trade events + field agents) in Months 6-9 with honest CAC tracking.

**Resource Risks**

- **Fewer resources than planned:** If budget cuts force reduction to 3 FTE-equivalents from 5.
  - *Contingency:* Cut to shopkeeper-app-only MVP for anchor (defer customer-app to Phase 2); anchor still gets billing + inventory + compliance upgrade (meaningful value); build time extends to 6 months; consumer-engagement thesis deferred to Month 10+ launch.
- **Anchor pulls out mid-build:** Commercial terms fail or scope creep unresolvable.
  - *Contingency:* Multi-tenant architecture means work is not wasted; pivot to direct-to-jeweller sales (harder but possible); need 3-month runway extension OR another anchor.
- **Key team member loses / burns out:** Small team = single points of failure.
  - *Mitigation:* Written documentation as sprint discipline; no single person owns > 30% of codebase; rotate sprint leads.

**Execution Discipline (scope creep prevention)**

- Written SOW with anchor; formal change management process for any new feature request mid-build
- "OUT of MVP" table above is authoritative; any addition requires explicit PM+Architect+Anchor sign-off
- Weekly demos to anchor prevent late-stage surprise misalignment
- Feature-flag all new additions so they can be turned OFF if they cause instability close to anchor launch

### Scope Confidence Assessment

| Scope Area | Confidence | Reason |
|-----------|-----------|--------|
| MVP feature list | HIGH | Validated through DR + MR + PRFAQ + anchor confirmation |
| MVP timeline (4-5 months) | MEDIUM | Depends on team hiring/retention; wedding-season buffer added |
| Anchor commercial terms | LOW until signed | **#1 dependency per PRFAQ verdict** |
| 2nd-jeweller onboarding by Month 9 | MEDIUM | Productization work in Phase 2 is engineering-intensive |
| Consumer app engagement targets | MEDIUM-LOW | Research-based; needs real-world validation; pivot trigger defined |
| Month-12 10+ paying jewellers | LOW | Depends on GTM experiments validating; may extend to Month 15 |

**A+P synthesis:**
- **Dr. Quinn (Problem Solver):** "Biggest technical challenge" section clarifies the stacked-problem nature — not three separate hard problems but one hard problem with three dimensions.
- **Mary:** GTM risk hedged with 3 parallel experiments + honest CAC tracking.
- **Winston:** Contingency for FTE reduction to 3 = cut customer-app from anchor MVP, not cut quality.
- **Victor:** "OUT of MVP" table is strategic discipline; called out feature-flag-everything pattern.

---

## Functional Requirements

**This is the binding capability contract.** UX, Architecture, and Epic breakdown in subsequent BMAD workflows must trace every design decision back to these FRs. Any capability not listed here will NOT exist in the product unless explicitly added.

### FR Capability Areas Overview

1. **Tenant & Multi-Tenancy Management** (FR1-FR7)
2. **Authentication & Authorization** (FR8-FR15)
3. **Shopkeeper Self-Service Settings** (FR16-FR24)
4. **Inventory Management** (FR25-FR34)
5. **Pricing & Gold Rate** (FR35-FR40)
6. **Billing & Compliance** (FR41-FR55)
7. **Customer Relationship Management (CRM)** (FR56-FR63)
8. **Customer Viewing Analytics** (FR64-FR68)
9. **Loyalty Program** (FR69-FR72)
10. **Custom Order Tracking** (FR73-FR79)
11. **Rate-Lock & Try-at-Home** (FR80-FR85)
12. **Customer App — Browse & Engage** (FR86-FR99)
13. **Reviews, Size Guides & Policies** (FR100-FR106)
14. **Notifications & Messaging** (FR107-FR112)
15. **Reports & Dashboards** (FR113-FR119)
16. **Platform Admin** (FR120-FR126)

### Tenant & Multi-Tenancy Management

- **FR1:** Platform Admin can create a new tenant (shop) with name, GSTIN, BIS registration, address, and owner contact.
- **FR2:** Platform Admin can configure tenant branding (logo, primary/secondary colors, customer-app name, domain/subdomain) and apply it to the tenant's customer-facing surfaces.
- **FR3:** Platform Admin can enable or disable tenant-level feature flags (try-at-home, wholesale, gold schemes, loyalty, viewing analytics, etc.).
- **FR4:** Platform Admin can suspend, reactivate, or terminate a tenant, with automated data retention workflows per DPDPA.
- **FR5:** The system maintains strict data isolation between tenants such that no user in tenant A can access any data from tenant B.
- **FR6:** Platform Admin can view tenant-level usage metrics (active users, invoice count, DAU/WAU/MAU) without accessing tenant business data unless explicitly permitted for support.
- **FR7:** Platform Admin can provision Platform Support users with time-limited, audit-logged read access to a specific tenant for troubleshooting.

### Authentication & Authorization

- **FR8:** Shopkeeper users can register and log in via phone OTP.
- **FR9:** Customer users can register and log in via phone OTP.
- **FR10:** Users can remain logged in via refresh tokens with configurable expiry (default 30 days).
- **FR11:** Shopkeeper users can log out from any device, invalidating sessions.
- **FR12:** Shop Owner can invite additional shop users (manager, staff) by phone number and assign a role.
- **FR13:** Shop Owner can configure role-based permissions per role (inventory edit, billing create, settings edit, analytics view).
- **FR14:** Shop Owner can revoke a shop user's access at any time.
- **FR15:** All authentication events (login, logout, role change, access revoked) are logged to an immutable audit trail with 5-year retention.

### Shopkeeper Self-Service Settings

- **FR16:** Shopkeeper can edit shop profile (name, address, GSTIN, BIS registration, phone, operating hours, years in business, about text).
- **FR17:** Shopkeeper can configure default making charges per product category (rings, chains, bangles, bridal, wholesale) — stored as either percentage of gold value or fixed rate per gram.
- **FR18:** Shopkeeper can configure default wastage percentages per category.
- **FR19:** Shopkeeper can configure loyalty program parameters — tier names, threshold values, points-per-rupee accrual, and redemption rate.
- **FR20:** Shopkeeper can configure rate-lock duration (1-30 day range; default 7 days).
- **FR21:** Shopkeeper can enable/disable try-at-home service and set piece-count limit per booking.
- **FR22:** Shopkeeper can configure custom order policy text (refund rules, rework rounds, deposit structure, cancellation window) displayed to customers.
- **FR23:** Shopkeeper can configure return/exchange policy text displayed to customers.
- **FR24:** Shopkeeper can configure notification preferences — which events trigger WhatsApp, SMS, email, or push (to self and to customers).

### Inventory Management

- **FR25:** Shopkeeper can create a product record with category, metal type, purity, gross weight, net weight, stone weight, stone details, making-charge override, images, and HUID.
- **FR26:** Shopkeeper can bulk-import products via CSV with a template matching the product schema.
- **FR27:** Shopkeeper can print barcode labels for products.
- **FR28:** Shopkeeper can mark a product as in-stock, sold, reserved, on-approval, or with-karigar.
- **FR29:** Shopkeeper can publish or unpublish a product to the customer app.
- **FR30:** The system reflects published products in the customer app within 30 seconds of publishing (MVP near-real-time target).
- **FR31:** Shopkeeper can view current stock valuation at live gold rate, cost price, and selling price, per category and metal type.
- **FR32:** Shopkeeper can record stock movements (purchase, sale, adjustment, transfer) with auto-updated inventory balance.
- **FR33:** Shopkeeper can search and filter inventory by category, metal, purity, weight range, HUID, status, and published flag.
- **FR34:** Shopkeeper can identify dead stock (unsold beyond configurable threshold in days).

### Pricing & Gold Rate

- **FR35:** The system fetches daily gold rates from IBJA API automatically at a configurable cadence (default 15 min during market hours).
- **FR36:** Shopkeeper can manually override daily gold rate when IBJA feed is unavailable or disputed.
- **FR37:** The system maintains separate rates per purity (24K, 22K, 18K, 14K, silver 999, 925).
- **FR38:** Shopkeeper can view historical gold rate chart (daily rates over last 30/90/365 days).
- **FR39:** The system displays today's live gold rate on the customer app home screen.
- **FR40:** The system auto-calculates product price as `(net_weight × rate) + making_charges + stone_charges + GST(3% metal + 5% making) + hallmarking_fee`.

### Billing & Compliance

- **FR41:** Shopkeeper can generate an estimate for a customer with one or more line items, displayed with full breakdown (weight × rate + making + stones + GST).
- **FR42:** Shopkeeper can convert an estimate into an invoice with validity period tracking.
- **FR43:** Shopkeeper can generate a B2C invoice with GST 3% on metal + 5% on making charges, HSN codes 7113/7114, HUID per line item, and total calculated.
- **FR44:** Shopkeeper can generate a B2B wholesale invoice with correct GST treatment and vendor GSTIN capture.
- **FR45:** Shopkeeper can record split payments per invoice (cash, UPI, card, net banking, old-gold adjustment, scheme redemption).
- **FR46:** The system hard-blocks invoice completion when total ≥ Rs 2 lakh and PAN (or Form 60) is not captured from the customer.
- **FR47:** The system hard-blocks cash payment line item when it would cause cash receipt in a single transaction/day/event to reach or exceed Rs 2 lakh, with an override path requiring supervisor role and audit-logged justification.
- **FR48:** Shopkeeper can record an old-gold purchase (URD) from a customer with auto-generated self-invoice under Reverse Charge Mechanism (3% GST payable by jeweller).
- **FR49:** Shopkeeper can adjust an old-gold purchase value against a new-purchase invoice in a single transaction.
- **FR50:** The system captures and stores HUID for every hallmarked product line item on invoices.
- **FR51:** Shopkeeper can print or share an invoice as PDF via WhatsApp, SMS, or email.
- **FR52:** Shopkeeper can void or modify an invoice within a configurable window (default 24 hours, owner-only); after window, only credit-note flow is available.
- **FR53:** The system tracks cumulative cash transactions per customer per month; flags warning at Rs 8 lakh and hard-blocks further cash at Rs 10 lakh with CTR template generation.
- **FR54:** Shopkeeper (with Owner role) can generate PMLA Cash Transaction Report (CTR) and Suspicious Transaction Report (STR) templates pre-filled with customer and transaction details.
- **FR55:** Shopkeeper can export transaction data in GSTR-1 and GSTR-3B compatible formats (CSV for MVP; JSON for Phase 2).

### Customer Relationship Management (CRM)

- **FR56:** Shopkeeper can create a customer record with phone (primary key per shop), name, email, address, PAN (optional; required at Rs 2L threshold), date of birth, anniversary.
- **FR57:** Shopkeeper can link family members to a customer record (spouse, parents, children, siblings).
- **FR58:** Shopkeeper can view a customer's complete purchase history across all staff and all dates for that shop.
- **FR59:** Shopkeeper can track customer credit balance (advance paid, outstanding due).
- **FR60:** Shopkeeper can add private notes to a customer record (visible to all shop staff).
- **FR61:** Shopkeeper can record occasions (birthdays, anniversaries, festivals) against a customer or family member for reminder workflows.
- **FR62:** Shopkeeper can search customers by phone, name, partial match, or recent-activity filter.
- **FR63:** Customer data is DPDPA-compliant — customer can request deletion from the customer app; shopkeeper's side honors deletion within 30 days while retaining legally required compliance records (invoices, KYC) with customer notification.

### Customer Viewing Analytics

- **FR64:** The system tracks product view events by logged-in customers (product_id, customer_id, timestamp, view_duration).
- **FR65:** The system tracks anonymous product view events (session_id, product_id, timestamp) without customer attribution.
- **FR66:** Shopkeeper can view per-product analytics: total views, unique viewers, time-windowed views (7/30 days), with "hot items" and "cold items" dashboards.
- **FR67:** Shopkeeper can view per-customer browsing history (products viewed, time spent, wishlist adds, search queries) in the customer's CRM profile.
- **FR68:** Customer can opt in/out of viewing tracking via customer app privacy settings at any time; opt-out retroactively removes customer attribution from past events (anonymizes retained events).

### Loyalty Program

- **FR69:** The system automatically credits loyalty points to customers on invoice completion based on shopkeeper-configured earn rate.
- **FR70:** Customer can view current loyalty tier, points balance, and progression toward next tier in the customer app.
- **FR71:** Shopkeeper can redeem a customer's loyalty points against a new invoice as a discount line item.
- **FR72:** The system upgrades/downgrades customer tier automatically based on rolling-12-month purchase total against shopkeeper-configured tier thresholds.

### Custom Order Tracking

- **FR73:** Shopkeeper can create a custom order record linked to a customer with description, design sketch/photos, agreed weight and purity, stones, agreed delivery date, deposit amount, quote amount.
- **FR74:** Shopkeeper can advance a custom order through configurable stages (default: Quoted → Approved → Metal Cast → Stones Set → QC → Ready → Delivered).
- **FR75:** Shopkeeper can upload progress photos at any stage; photos are automatically shared to the customer via WhatsApp and app push notification.
- **FR76:** Customer can view their custom order's current stage, delivery date, and progress photo gallery in the customer app.
- **FR77:** Customer can request a modification via the app at any stage prior to completion; shopkeeper receives notification to approve/reject with notes.
- **FR78:** Shopkeeper can convert a completed custom order into a final invoice with automatic pull-through of deposit paid.
- **FR79:** Custom order data is immutable post-completion for 3 years (audit trail).

### Rate-Lock & Try-at-Home

- **FR80:** Customer can book a rate-lock on a product at current gold rate, with a deposit paid via Razorpay UPI/card.
- **FR81:** Rate-lock record stores locked-rate, expiry date (shopkeeper-configured default, customer can see), and deposit amount.
- **FR82:** When customer completes purchase within rate-lock validity, the system honors the locked rate regardless of current market rate.
- **FR83:** Shopkeeper can manually override and honor a rate-lock after expiry with audit-logged justification.
- **FR84:** Customer can book a try-at-home appointment (if shop has feature enabled) selecting up to N products (N = shopkeeper-configured), preferred date, and address.
- **FR85:** Shopkeeper can approve/reject/reschedule try-at-home bookings and track status through Requested → Confirmed → Dispatched → Returned / Purchased.

### Customer App — Browse & Engage

- **FR86:** Customer can view a home screen with today's gold rate, featured collections, new arrivals, and seasonal campaigns.
- **FR87:** Customer can browse products by category (gold, diamond, silver, bridal, daily wear, wholesale-visible if shop enables).
- **FR88:** Customer can filter products by metal, purity, price range, occasion, and in-stock-only.
- **FR89:** Customer can search products by free text (name, description, SKU).
- **FR90:** Customer can view product detail with multiple images, full price breakdown, HUID, certification info, description, size options, availability.
- **FR91:** Customer can scan a HUID QR code from the customer app camera to verify BIS hallmark authenticity.
- **FR92:** Customer can add products to wishlist.
- **FR93:** Customer can share a product link via WhatsApp, SMS, or copy link.
- **FR94:** Customer can submit an "Inquire at Shop" request on any product (with optional note and preferred contact method).
- **FR95:** Customer can view store info — address, hours, directions via maps, phone number, about text.
- **FR96:** Customer can view their profile with purchase history, loyalty tier/points, wishlist, custom orders, rate-locks, try-at-home bookings.
- **FR97:** Customer can mark an inquiry or wishlist item as "for gift" (triggers gift-wrap flag for shop).
- **FR98:** The customer app displays the anchor/tenant jeweller's branding (logo, colors, name, domain) — the Goldsmith platform brand is never visible to the customer.
- **FR99:** Customer can toggle app language between Hindi (default) and English; choice persists across sessions.

### Reviews, Size Guides & Policies

- **FR100:** Customer can submit a review (rating + text) for a product they purchased (verified via linked invoice).
- **FR101:** Customer can submit a review for the shop overall (not product-specific) if they have a linked invoice.
- **FR102:** Customer can view all published reviews on product and shop pages.
- **FR103:** Shopkeeper can moderate reviews — flag inappropriate, respond publicly, request removal (admin-approved).
- **FR104:** Customer can access an in-app ring sizer (physical-method with reference circles + paper-print method for measuring with a ring they own).
- **FR105:** Customer can access an in-app bangle sizer (diameter reference and measurement guide).
- **FR106:** Customer can view the shop's return/exchange policy text (shopkeeper-configured) on every product detail page and in-app policy section.

### Notifications & Messaging

- **FR107:** The system sends WhatsApp notifications to customers for: invoice receipt, custom order progress photos, rate-lock confirmations and expiry reminders, try-at-home appointment confirmations, loyalty tier upgrades, festival campaigns (with opt-in).
- **FR108:** The system sends push notifications to customers on the same events.
- **FR109:** The system sends push notifications to shopkeepers for: low stock alerts, cumulative-cash PMLA warnings, new customer inquiry, new try-at-home booking, new review, custom order stage overdue.
- **FR110:** Shopkeeper can send a broadcast WhatsApp message to filtered customer segments (e.g., "all loyalty Silver+ customers" or "all customers with last purchase > 6 months").
- **FR111:** Customer can opt in/out of marketing vs transactional notifications separately.
- **FR112:** All outbound messaging events are logged per tenant for audit and quota tracking.

### Reports & Dashboards

- **FR113:** Shopkeeper can view daily sales summary — total invoices, total value, GST collected, payment method breakdown, exchanges.
- **FR114:** Shopkeeper can view stock valuation report at current market rate, cost price, and selling price.
- **FR115:** Shopkeeper can view outstanding-payment report (customers with credit balance or overdue dues).
- **FR116:** Shopkeeper can view customer analytics (top customers by LTV, new customer rate, repeat rate).
- **FR117:** Shopkeeper can view inventory aging report (time-in-stock per product, flagged dead stock).
- **FR118:** Shopkeeper can view loyalty program summary (members per tier, points accrued/redeemed).
- **FR119:** Shopkeeper can export any report as CSV and as a PDF version with shop branding.

### Platform Admin

- **FR120:** Platform Admin can view cross-tenant metrics dashboard (active tenants, total MAU, total invoices, total GMV through the platform).
- **FR121:** Platform Admin can manage subscription plans (Starter, Pro, Enterprise) and assign a plan to a tenant.
- **FR122:** Platform Admin can override tenant subscription status (grace period for non-payment, extend trial).
- **FR123:** Platform Admin can impersonate a tenant user (time-limited, audit-logged) for support purposes.
- **FR124:** Platform Admin can trigger a tenant data export (full tenant data bundle) on request for data-portability compliance.
- **FR125:** Platform Admin can initiate a tenant deletion workflow (soft-delete with 30-day recovery window, then hard-delete).
- **FR126:** Platform Admin can configure global platform settings (vendor API credentials, feature flag defaults, compliance-engine rules versioning) via a secured admin interface with multi-factor authentication.

---

### FR Validation Summary

- **Total FRs:** 126, spanning 16 capability areas
- **Every FR is testable:** each describes a capability that can be verified (does it exist / does it work)
- **Implementation-agnostic:** no UI details, performance numbers, or technology choices
- **Full journey coverage:** Every journey (J1-J6) maps to supporting FRs
- **MVP scope coverage:** All "IN" items from Product Scope MVP section have corresponding FRs; all "OUT" items explicitly absent
- **Compliance coverage:** BIS/HUID, GST 3%+5%, URD/RCM, PAN Rs 2L, Section 269ST, PMLA all encoded as functional capabilities with enforcement behaviour
- **Innovation coverage:** Customer viewing analytics (FR64-68), white-label multi-tenant (FR1-7, FR98), shopkeeper self-service config (FR16-24) all first-class
- **Capability contract:** UX must design for these 126 FRs; Architecture must support them; Epics must implement them.

**A+P synthesis:**
- **Winston:** FR5 "strict data isolation" is the non-negotiable; stated as capability without implementation detail (RLS + interceptor is implementation, not FR content).
- **Murat:** FR47 (Section 269ST) and FR53 (PMLA) specify "hard-block" explicitly — testable capability contract for compliance engine.
- **Sally:** FR99 (Hindi/English toggle) is a capability not a UI choice — correct altitude.
- **Mary:** FR63 (DPDPA deletion) split from CRM FRs for visibility; legally distinct from business CRM.
- **Victor:** FR98 (anchor branding exclusive on customer app) is the white-label differentiator encoded as FR.

---

## Non-Functional Requirements

All six quality attribute categories apply to this product. Each NFR is specific and measurable. These complement (not duplicate) the FRs — FRs say WHAT the system does, NFRs say HOW WELL.

### Performance

- **NFR-P1:** Customer app cold-start to first product view on 4G — p95 ≤ 60 seconds, p50 ≤ 30 seconds (Ayodhya Tier-2 network baseline).
- **NFR-P2:** Customer app first meaningful paint (web) — < 2.5 seconds on 4G, < 1.5 seconds on WiFi.
- **NFR-P3:** Shopkeeper app billing screen interactive — < 1 second on mid-tier Android (Xiaomi Redmi Note class, 4GB RAM).
- **NFR-P4:** Shopkeeper invoice generation (full flow from product scan to invoice PDF) — < 5 seconds p95.
- **NFR-P5:** API p95 latency — reads < 200 ms, writes < 500 ms, complex reports < 2 seconds.
- **NFR-P6:** Near-real-time sync shopkeeper-write → customer-read propagation — < 30 seconds at p95 under baseline load.
- **NFR-P7:** IBJA gold rate refresh — every 15 minutes during market hours (10am-5pm IST); Redis-cached for < 100 ms serve.
- **NFR-P8:** Customer web first-load JavaScript (gzipped critical path) — ≤ 250 KB.
- **NFR-P9:** Image delivery via ImageKit — p95 < 500 ms for optimized product thumbnails, < 1.5 sec for full-resolution.
- **NFR-P10:** Wedding-season peak load target — 10× baseline sustained for 72-hour Dhanteras window with all performance SLAs held.
- **NFR-P11:** Offline shopkeeper invoice operations (create, read, update drafts) — < 500 ms local latency.
- **NFR-P12:** WhatsApp message send via AiSensy — queued and dispatched within 30 seconds of trigger event.

### Security

- **NFR-S1:** All data in transit protected with TLS 1.3 minimum; no HTTP fallback; HSTS enabled on all customer web domains.
- **NFR-S2:** All data at rest encrypted — AWS RDS encryption (AES-256), S3 SSE, encrypted EBS volumes.
- **NFR-S3:** Sensitive PII (PAN numbers, Aadhaar if ever captured, bank details if scheme payments captured) encrypted at application layer with tenant-scoped keys beyond RDS encryption.
- **NFR-S4:** Authentication via phone OTP with rate-limiting (max 5 OTP requests per phone per 15 min; lockout after 10 failed attempts).
- **NFR-S5:** Session tokens — short-lived access tokens (15 min), refresh tokens with rotation on use (30-day expiry); revocable server-side.
- **NFR-S6:** Password-less design; no password storage vulnerability. Biometric auth (Face ID, fingerprint) as optional convenience for shopkeeper-app quick-login.
- **NFR-S7:** RBAC enforced at API layer (NestJS guards) AND database layer (PostgreSQL RLS) — defense in depth.
- **NFR-S8:** Multi-tenant isolation: zero cross-tenant data exposure verified by automated test suite running on 100% of CI runs; external penetration test before onboarding 2nd tenant.
- **NFR-S9:** All compliance-sensitive actions (invoice creation, cash override, scheme payment, PAN capture, HUID entry, CTR trigger, data export, tenant impersonation) logged to immutable audit trail with minimum 5-year retention (PMLA requirement).
- **NFR-S10:** API rate limiting: 100 requests/minute per authenticated user, 20/minute per IP for unauthenticated endpoints; tenant-level throttles to prevent noisy-neighbour.
- **NFR-S11:** Secrets (API keys, database credentials, third-party tokens) stored in AWS Secrets Manager; rotated quarterly; never in source control, environment files committed to VCS, or logs.
- **NFR-S12:** All dependencies scanned for known CVEs on every CI run (npm audit, Snyk); critical/high CVEs block release.
- **NFR-S13:** OWASP Top 10 coverage validated via automated security testing (SAST + DAST) before production releases.
- **NFR-S14:** Production database access restricted to VPC-private networking; no public IP; access via bastion host with MFA and audit logging.

### Scalability

- **NFR-SC1:** Architecture must support 10 tenants at MVP launch (Month 5) without architectural changes.
- **NFR-SC2:** Architecture must scale to 100 tenants by Month 12 with horizontal scaling only (no schema migrations or code rewrites).
- **NFR-SC3:** Architecture must scale to 1,000 tenants by Month 24 with planned investments (read replicas, sharding strategy defined, CDN tier-2 if needed).
- **NFR-SC4:** Single tenant capacity: support 50,000 products in inventory, 10,000 active customers, 500 invoices/day without performance degradation.
- **NFR-SC5:** Wedding-season peak: 10× normal transaction volume sustained for 72 hours with no manual intervention required.
- **NFR-SC6:** Auto-scaling for ECS/EKS compute tier based on CPU/memory thresholds; RDS with read replicas for report-heavy workloads.
- **NFR-SC7:** Image storage (S3) unbounded; CDN handles traffic scale transparently.
- **NFR-SC8:** Queue depth (BullMQ WhatsApp/push/report jobs) < 1000 backlog at p95 even during peak; worker auto-scaling responds within 5 min.

### Accessibility

- **NFR-A1:** Customer web meets WCAG 2.1 Level AA compliance for all public-facing pages (catalog, product detail, store info, reviews).
- **NFR-A2:** Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text (WCAG AA).
- **NFR-A3:** Full keyboard navigation support on customer web; no mouse-only interactions.
- **NFR-A4:** Screen reader compatibility — ARIA labels on all interactive elements, semantic HTML, image alt text.
- **NFR-A5:** Font size responsive to browser/device zoom (up to 200%) without layout breakage.
- **NFR-A6:** Hindi and English language support with correct Devanagari font rendering (Noto Sans Devanagari bundled); switch without layout shift.
- **NFR-A7:** Touch targets on mobile apps ≥ 44x44 points (iOS HIG) / 48x48 dp (Android).
- **NFR-A8:** Form validation errors announced to screen readers; never color-only error indication.
- **NFR-A9:** Shopkeeper app usable by senior-age users (45-65 demographic) — tested in user research with font-size-increased settings; primary actions never require fine motor control.

### Integration

- **NFR-I1:** All third-party integrations (IBJA, Razorpay, AiSensy, MSG91, Digio, Ola Maps, ImageKit, FCM, Surepass, Sentry, PostHog) implemented via adapter pattern — vendor swap requires adapter-layer rewrite, not data migration or business-logic change.
- **NFR-I2:** IBJA rate API — circuit breaker on failure; automatic fallback to Metals.dev; further fallback to last-known-good cached rate with "stale" UI indicator if both unavailable.
- **NFR-I3:** Razorpay webhooks handled with idempotency — same webhook received twice does not double-record payment.
- **NFR-I4:** AiSensy WhatsApp send rate limited per tenant per day to avoid spam detection; template pre-approved per tenant.
- **NFR-I5:** All integrations have retry policy with exponential backoff (max 3 retries, max delay 5 min); permanent failures logged to Sentry with tenant context.
- **NFR-I6:** Data export formats for compliance: GSTR-1/3B CSV (MVP), JSON (Phase 2); FIU-IND CTR/STR templates conform to FINnet 2.0 schemas.
- **NFR-I7:** Tenant-level integration configuration editable by platform admin; credentials secured in Secrets Manager per tenant scope.
- **NFR-I8:** Integration vendor compliance (DPA agreements, PCI-DSS for Razorpay, ISO 27001 where available) reviewed annually with legal.

### Reliability & Availability

- **NFR-R1:** Uptime baseline — 99.5% monthly (max ~3.65 hrs downtime/month acceptable for MVP).
- **NFR-R2:** Uptime wedding-season — 99.9% during Dhanteras week + Akshaya Tritiya week (max ~45 min downtime/week).
- **NFR-R3:** Uptime Month 12+ with 5+ paying tenants — 99.9% monthly.
- **NFR-R4:** Planned maintenance windows announced 7 days in advance; limited to low-traffic hours (2-5am IST); never during wedding-season peaks.
- **NFR-R5:** RDS automated backups daily with 7-day retention; point-in-time recovery enabled.
- **NFR-R6:** Recovery Time Objective (RTO) — 4 hours for MVP; 1 hour by Month 12.
- **NFR-R7:** Recovery Point Objective (RPO) — 1 hour for MVP; 15 minutes by Month 12.
- **NFR-R8:** AWS Mumbai Multi-AZ deployment for RDS + ECS; single-region acceptable for MVP, cross-region ap-south-2 failover deferred to Phase 4+.
- **NFR-R9:** Error budget per month: 0.5% (aligned with 99.5% SLA); consumed via actual incidents tracked in post-mortems.
- **NFR-R10:** All critical paths (login, invoice generation, custom order, payment webhook) have automated uptime monitoring with alert on 2 consecutive failures.
- **NFR-R11:** Incident response runbooks for: tenant-isolation bug, payment webhook failure, IBJA rate unavailability, WhatsApp send failure, mass customer-data deletion request.

### Compliance (cross-cutting; formalised here for traceability)

- **NFR-C1:** BIS/HUID: All hallmarked invoices record HUID; customer-app provides HUID QR scan with link to BIS verification (via Surepass wrapper).
- **NFR-C2:** GST: 3% metal + 5% making hardcoded in compliance engine; HSN codes 7113/7114 on all invoices; URD RCM self-invoice auto-generated on old-gold purchase.
- **NFR-C3:** Section 269ST: Hard-block cash receipt at Rs 1,99,999 per transaction/day/event; supervisor override requires role check + justification + audit log.
- **NFR-C4:** PAN Rule 114B: Hard-block invoice completion at Rs 2L threshold without PAN/Form 60 capture; PAN stored encrypted.
- **NFR-C5:** PMLA: Cumulative monthly cash per customer tracked; warning at Rs 8L, block at Rs 10L with CTR template generation; STR template available to owner role; 5-year record retention.
- **NFR-C6:** DPDPA 2023: Consent capture at customer app signup (default-on opt-in for viewing tracking, opt-outable); privacy notice accessible; data export & deletion workflows; 72-hour breach notification runbook ready by Month 9 (full enforcement May 2027).
- **NFR-C7:** Data residency: All customer/tenant data stored in AWS Mumbai (ap-south-1); no cross-border data transfer without signed DPA.
- **NFR-C8:** Vendor DPAs: All third-party processors (AiSensy, Razorpay, IBJA, MSG91, Digio, Ola Maps, ImageKit, PostHog self-hosted, Sentry self-hosted) have DPA in place before tenant launch.
- **NFR-C9:** Child data protections: Customer app requires age-18+ attestation at signup; parental consent flow for minor purchases by legal guardian.

---

### NFR Validation Summary

- **Total NFRs:** 70, across 7 categories
- **Each NFR is measurable:** specific numbers (latency, percentiles, ratios, thresholds) or binary (pass/fail)
- **Each NFR is testable:** can be verified via load test, security audit, compliance audit, or automated monitoring
- **No duplication with FRs:** NFRs specify HOW WELL; FRs specify WHAT
- **Compliance traceability:** NFR-C1-C9 formalise domain requirements for engineering and audit use
- **Realistic constraints:** targets set based on Ayodhya Tier-2 network reality, mid-tier Android hardware, Indian SMB adoption patterns

**A+P synthesis:**
- **Winston:** Multi-tenant isolation as NFR-S8 — test suite is the measurable mechanism; external pentest before 2nd tenant is the verification gate.
- **Murat:** NFR-P10 "10× baseline wedding-season sustained for 72 hours" = explicit load test target for k6 harness.
- **Sally:** NFR-A9 "usable by 45-65 demographic with font-size increased" is an explicit accessibility target rarely spelled out; drove home user-research requirement.
- **Paige:** NFR-R11 (incident response runbooks) required pre-launch for each critical path — cannot defer these to post-incident learning.
- **Dr. Quinn:** Defense-in-depth enforcement (NFR-S7 RBAC at API + RLS at DB) named explicitly so architecture cannot shortcut either layer.

---

## Document Notes

### Section Relationships & Cross-References

This PRD was built incrementally across 11 BMAD workflow steps. The following are intentional cross-references (not duplications) — each section serves a specific reader:

- **Compliance requirements** appear in three registers — §6 (Domain, legal/regulatory source of truth), §9 (MVP/Growth/Vision scope lists), and §10 (FR41-55 as capability contract), §11 (NFR-C1-9 as measurable attributes). This layering is intentional: §6 explains WHY, §9 lists WHAT phase, §10 specifies testable capability, §11 specifies how well. Do not collapse.
- **Product scope** appears in §4 (high-level MVP/Growth/Vision) and §9 (strategic scoping rationale + "OUT of MVP" authoritative table). §9 is the enforcement reference; §4 is the summary.
- **Customer viewing analytics** appears as Innovation #1 (§7), FR64-68 (§10), and Journey 3 (§5). §7 explains the strategic novelty; §5 shows the UX moment; §10 is the binding capability contract.
- **Shopkeeper self-service config** appears as Innovation #3 (§7) and FR16-24 (§10). §7 articulates the principle; §10 enumerates specific settings.

### Traceability Matrix (sample — full matrix belongs in Test Design workflow)

| Journey | Supporting FRs | Supporting NFRs |
|---------|----------------|-----------------|
| J1 Anchor happy path | FR25-34 (inventory), FR41-55 (billing), FR56-63 (CRM), FR107-112 (notifications) | NFR-P3, NFR-P11, NFR-R1, NFR-S9 |
| J2 Wedding-season edge | FR42-43 (estimate/invoice), FR48-49 (URD/RCM), FR53-54 (PMLA), FR80-83 (rate-lock) | NFR-P10 (10× load), NFR-R2 (wedding season 99.9%) |
| J3 Viewing analytics | FR64-68 | NFR-S9 (audit), NFR-C6 (DPDPA consent) |
| J4 Wedding customer | FR86-99 (browse), FR73-79 (custom order), FR80-85 (rate-lock/TAH), FR100-106 (reviews/sizer) | NFR-P1, NFR-P2, NFR-A1-9 (accessibility) |
| J5 Pilgrim tourist | FR91 (HUID scan), FR95 (store info), FR102 (reviews), FR43 (invoice with HUID) | NFR-C1 (HUID), NFR-P1 |
| J6 2nd jeweler onboarding | FR1-7 (tenant mgmt), FR120-126 (platform admin) | NFR-SC1-3 (scalability) |

### Known Unresolved Items (for handoff to downstream workflows)

**Commercial / External (blocker for build):**
- 🚨 Anchor SOW not signed (PRFAQ #1 blocker) — commercial terms, fee, timeline, branding rights, IP ownership
- Legal review of platform terms (jeweler-as-merchant, platform-as-intermediary, DPA for DPDPA)
- Apple/Google developer account decision: platform-owned vs per-tenant
- Trademark clearance for tenant-chosen app names (tenant's responsibility)

**Policy Decisions Required Before Anchor Launch (configurable in admin but anchor needs to choose):**
- "App price = committed price" policy — ironclad or fallback
- Custom order refund/rework/deposit/cancellation policy values
- Custom order warranty insurance commitment
- Shipping/delivery scope for MVP (current plan: in-person only)
- Rate-lock duration default (7 days placeholder)
- Try-at-home piece count default (3 placeholder)
- Loyalty tier structure specifics
- Press release owner quote + customer quote real voice

**Research Gaps to Close Pre-Build:**
- Field validation: 20-30 shopkeeper interviews in Ayodhya/UP Tier-2 cities
- Play Store review scrape of Khatabook/Omunim/Marg for pain-point corroboration
- Primary consumer survey (n=500+) for trust-signal ranking validation
- 2nd-10th jeweller GTM experiments planned for Months 6-9 with honest CAC tracking

**Technical Decisions Requiring Architecture-Stage Deep-Dive:**
- Offline-sync semantics for concurrent karigar metal withdrawals (CRDT vs transactional locks)
- White-label delivery strategy (shared app with theming for MVP vs per-tenant native apps Phase 4+)
- Image/asset CDN strategy at tenant scale (per-tenant CloudFront distributions vs shared CDN with tenant-prefixed paths)
- BullMQ job partitioning per tenant to prevent noisy-neighbour
- Database sharding trigger point (when to move from single multi-tenant DB to sharded)

### Document Statistics

- **Total length:** ~1,300+ lines
- **Capability contract (FRs):** 126 functional requirements
- **Quality contract (NFRs):** 70 non-functional requirements
- **User journeys:** 6 (primary + edge-case + secondary users + platform admin)
- **Input documents referenced:** 11 (DR, MR, PRFAQ + distillate, 6 memory files, approved plan)
- **BMAD workflow steps completed:** 11 of 12 (step-12 complete is next)

### Version History

- **v1 (2026-04-16):** Initial PRD creation via BMAD Create PRD workflow, executing A+P+C SOP per user directive at every menu step.

### Polish Summary

**Actions taken:**
1. Added Table of Contents with navigation links and downstream-reader index
2. Added Document Notes section with traceability matrix + cross-reference explanation
3. Flagged known unresolved items for handoff (commercial, policy, research, technical)
4. Did NOT collapse intentional compliance layering (§6/§9/§10/§11) — each serves a distinct reader
5. Did NOT rewrite core sections (preservation discipline; voice + intent preserved)

**Coherence verified:**
- All sections use ## Level 2 headers consistently
- Sub-sections use ### Level 3 with clear progression
- Terminology consistent throughout (shopkeeper/customer/tenant; anchor/2nd-jeweller/platform)
- Product differentiator (white-label multi-tenant + self-service config + jewelry-native + Hindi-first) threaded through executive summary, innovation, FRs, NFRs

**Not consolidated (intentional):**
- Compliance appears in 4 registers — kept as-is (see cross-reference explanation above)
- Feature lists in §4 and §9 — §4 is summary reference, §9 is authoritative "OUT" list

**A+P synthesis for polish:**
- **Paige (Tech Writer):** Added TOC + traceability matrix + document statistics for navigability and dual-audience readability.
- **Victor:** Flagged "known unresolved items" as first-class section — prevents downstream workflows rediscovering blockers.
- **Winston:** Architectural decisions to defer (offline-sync, white-label, CDN, sharding) itemized for Architecture workflow handoff.
- **Mary:** Research gaps itemized with specific validation mechanisms for Product Brief or research spike planning.
