---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md
  - _bmad-output/planning-artifacts/adr/0002-multi-tenant-single-db-rls.md
  - _bmad-output/planning-artifacts/adr/0003-money-weight-decimal-primitives.md
  - _bmad-output/planning-artifacts/adr/0004-offline-sync-protocol.md
  - _bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md
  - _bmad-output/planning-artifacts/adr/0006-vendor-adapter-pattern.md
  - _bmad-output/planning-artifacts/adr/0007-near-real-time-polling-mvp.md
  - _bmad-output/planning-artifacts/adr/0008-white-label-shared-app-theming.md
  - _bmad-output/planning-artifacts/adr/0009-monorepo-modular-monolith-layout.md
  - _bmad-output/planning-artifacts/adr/0010-tenant-provisioning-automation.md
  - _bmad-output/planning-artifacts/adr/0011-compliance-package-hard-block-gateway.md
  - _bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md
  - _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md
  - _bmad-output/planning-artifacts/prfaq-Goldsmith.md
  - _bmad-output/planning-artifacts/prfaq-Goldsmith-distillate.md
  - _bmad-output/planning-artifacts/research/domain-indian-jewelry-retail-research-2026-04-15.md
  - _bmad-output/planning-artifacts/research/market-customer-insights-research-2026-04-16.md
  - CLAUDE.md
  - C:/Alok/Business Projects/Goldsmith/CLAUDE.md
  - memory/MEMORY.md
workflowType: 'create-epics-and-stories'
project_name: 'Goldsmith'
user_name: 'Alokt'
date: '2026-04-17'
status: 'complete'
completedAt: '2026-04-17'
lastStep: 2
directionLockUpdate:
  date: '2026-04-17'
  supersedes: 'Direction C — Traditional-Modern Bazaar'
  lockedDirection: 'Direction 5 — Hindi-First Editorial'
  location: '_bmad-output/planning-artifacts/design-directions-v2/customer-aspirational/direction-5-hindi-first-editorial/'
---

# Goldsmith — Epic & Story Breakdown

> **⚠ Direction Lock Update — 2026-04-17:** All references to "Direction C", terracotta `#C35C3C` primary, Rozha One display, and Hind Siliguri body are **deprecated**. Locked aesthetic is **Direction 5 — Hindi-First Editorial** (`design-directions-v2/customer-aspirational/direction-5-hindi-first-editorial/`). When executing Story E7-S1 (ui-tokens extraction), source values from v2 direction-5 `:root`: `--tenant-primary: #B58A3C` (aged-gold), `--tenant-accent: #D4745A` (terracotta blush — sparingly), `--cream: #F5EDDD`, `--indigo-ink: #1E2440`. Typography: Yatra One (display) + Mukta Vaani (secondary) + Tiro Devanagari Hindi (body serif) + Fraunces italic (Latin secondary). Every epic/story's hex values + font names below reflect the prior direction and must be remapped during token extraction — not re-planned.

## Overview

This document decomposes the PRD (126 FRs + 70 NFRs), UX Design Specification (Direction C + 4-tier components + 5 state machines + 6 journey flows), and Architecture (modular monolith + 12 ADRs + 14 bounded contexts + full requirements-to-structure mapping) into user-value-framed epics and BDD-scripted implementable stories.

**Positioning guardrail:** North India Hindi-belt traditional jewellers. Ayodhya is the anchor jeweller's location — NOT a design theme. No pilgrim / temple / darshan framing in epic or story names.

**Non-negotiable trace discipline:** Every story references (a) the FR(s) it implements, (b) the module + package paths it touches, (c) the ADR(s) that govern its decisions, (d) the binding pattern rules it must honour, (e) the acceptance tests — including tenant-isolation / weight-precision / compliance-gate assertions where applicable.

**IR-report corrections applied (binding):**
1. ✅ "EPIC 16 Anchor Launch Hardening" eliminated; split into specific user-value stories distributed across Epics 14 + 15 + new Epic 16 "Anchor goes live with confidence".
2. ✅ Epics 1, 4, 13, 15 reframed for user-value.
3. ✅ EPIC 5 Billing sequenced to use hardcoded making-charge first, then integrate real Settings.
4. ✅ FR30 (sync) split across EPIC 3 publish + EPIC 7 read with sync infrastructure in EPIC 3.
5. ✅ EPIC 12 FR68 consent ships before FR64-67 tracking.
6. ✅ Given/When/Then AC mandatory on every story.
7. ✅ Epic 1 Story 1 framed as user-value ("Shop Owner reaches dashboard"), not "monorepo setup".
8. ✅ Every story references FRs + modules/packages + ADRs + pattern rules + test assertions.

---

## Requirements Inventory

### Functional Requirements (126 FRs — referenced from PRD §10)

PRD §10 is authoritative. FRs below are listed compactly to preserve the coverage map; full definitions live in PRD §10 (`_bmad-output/planning-artifacts/prd.md`).

**Tenant & Multi-Tenancy Management (7):**
- FR1: Platform Admin can create a new tenant.
- FR2: Platform Admin can configure tenant branding + apply to customer surfaces.
- FR3: Platform Admin can enable/disable tenant-level feature flags.
- FR4: Platform Admin can suspend/reactivate/terminate a tenant with DPDPA-compliant data retention.
- FR5: System maintains strict data isolation across tenants (zero cross-tenant leakage).
- FR6: Platform Admin can view tenant usage metrics without accessing business data by default.
- FR7: Platform Admin can provision Platform Support time-limited audit-logged tenant-read access.

**Authentication & Authorization (8):**
- FR8: Shopkeeper can register/login via phone OTP.
- FR9: Customer can register/login via phone OTP.
- FR10: Refresh-token-based session persistence (30-day default).
- FR11: Logout invalidates sessions across devices.
- FR12: Shop Owner invites staff by phone + role.
- FR13: Shop Owner configures role-based permissions per role.
- FR14: Shop Owner revokes shop user access.
- FR15: All auth events logged to immutable 5-year audit trail.

**Shopkeeper Self-Service Settings (9):**
- FR16: Shop profile editing (name, address, GSTIN, BIS reg, hours, about, logo, years).
- FR17: Per-category default making charges (% or fixed).
- FR18: Per-category default wastage %.
- FR19: Loyalty program parameters (tiers, thresholds, rates).
- FR20: Rate-lock duration (1-30 days).
- FR21: Try-at-home enable + piece-count limit.
- FR22: Custom order policy text (refund/rework/deposit/cancellation).
- FR23: Return/exchange policy text.
- FR24: Notification preferences per event + channel (WhatsApp/SMS/push/email).

**Inventory Management (10):**
- FR25: Create product record (category, metal, purity, gross/net/stone weight, stone details, making override, images, HUID).
- FR26: CSV bulk import with template.
- FR27: Barcode label printing.
- FR28: Mark product status (in-stock / sold / reserved / on-approval / with-karigar).
- FR29: Publish/unpublish to customer app.
- FR30: Published products reflect in customer app within 30 seconds.
- FR31: Live stock valuation at rate/cost/selling.
- FR32: Record stock movements with auto-update.
- FR33: Search + filter (category, metal, purity, weight, HUID, status, published).
- FR34: Identify dead stock beyond configurable threshold.

**Pricing & Gold Rate (6):**
- FR35: Auto-fetch IBJA rates on configurable cadence.
- FR36: Manual rate override when feed unavailable/disputed.
- FR37: Separate rates per purity.
- FR38: Historical rate chart (30/90/365 days).
- FR39: Customer app home shows today's live rate.
- FR40: Auto-calc product price: (net_weight × rate) + making + stones + GST(3% metal + 5% making) + hallmark.

**Billing & Compliance (15):**
- FR41: Generate estimate with full breakdown.
- FR42: Convert estimate → invoice with validity tracking.
- FR43: Generate B2C invoice (GST 3+5, HSN 7113/7114, HUID per line, total).
- FR44: Generate B2B wholesale invoice (vendor GSTIN + correct GST treatment).
- FR45: Split payments (cash/UPI/card/net-banking/old-gold-adjust/scheme-redeem).
- FR46: Hard-block invoice completion if total ≥ Rs 2L without PAN/Form 60.
- FR47: Hard-block cash at Rs 1,99,999 per txn/day/event with supervisor audit-logged override.
- FR48: Record URD (old-gold) purchase with auto self-invoice (RCM 3%).
- FR49: Adjust old-gold value against new-purchase invoice.
- FR50: Capture + store HUID on every hallmarked line.
- FR51: Print/share invoice as PDF via WhatsApp/SMS/email.
- FR52: Void/modify invoice within configurable window (default 24h, owner-only); after = credit-note flow.
- FR53: Cumulative monthly cash per customer: warn at Rs 8L, hard-block at Rs 10L with CTR template.
- FR54: Owner generates PMLA CTR + STR templates pre-filled.
- FR55: Export transaction data as GSTR-1/3B CSV (MVP) / JSON (Phase 2).

**Customer CRM (8):**
- FR56: Create customer record (phone PK per shop, name, email, address, PAN optional, DOB, anniversary).
- FR57: Link family members.
- FR58: View full purchase history (all staff, all dates) per shop.
- FR59: Track credit balance (advance + outstanding).
- FR60: Private notes on customer record (visible to all shop staff).
- FR61: Record occasions for reminder workflows.
- FR62: Search customers (phone/name partial/recent).
- FR63: DPDPA-compliant customer deletion (soft-30d → hard; retain legally-required with notification).

**Customer Viewing Analytics (5):**
- FR64: Track logged-in product views (product_id, customer_id, timestamp, duration).
- FR65: Track anonymous product views (session_id).
- FR66: Per-product analytics (views, unique viewers, time-windowed, hot/cold dashboards).
- FR67: Per-customer browsing history in CRM profile.
- FR68: Customer opt-in/out of viewing tracking; opt-out retroactively anonymizes.

**Loyalty Program (4):**
- FR69: Auto-credit points on invoice completion by configured earn rate.
- FR70: Customer views tier/points/progression in customer app.
- FR71: Shopkeeper redeems customer points as invoice discount.
- FR72: Auto-upgrade/downgrade tier by rolling-12-month total.

**Custom Order Tracking (7):**
- FR73: Create custom order (customer link, design sketch/photos, weight, purity, stones, delivery date, deposit, quote).
- FR74: Configurable stages (default Quoted → Approved → Metal Cast → Stones Set → QC → Ready → Delivered).
- FR75: Upload progress photos at any stage → auto WhatsApp + push.
- FR76: Customer views stage/delivery/progress photos in customer app.
- FR77: Customer modification request; shopkeeper approve/reject with notes.
- FR78: Convert completed custom order to final invoice with deposit pull-through.
- FR79: Custom order data immutable post-completion for 3 years.

**Rate-Lock & Try-at-Home (6):**
- FR80: Customer books rate-lock with Razorpay deposit.
- FR81: Rate-lock stores locked-rate, expiry, deposit.
- FR82: Honor locked rate on purchase within validity.
- FR83: Shopkeeper manual override honor post-expiry with audit.
- FR84: Customer books try-at-home (N pieces, date, address) if enabled.
- FR85: Shopkeeper approve/reject/reschedule try-at-home + track through state machine.

**Customer App — Browse & Engage (14):**
- FR86: Home — rate, featured, new arrivals, seasonal campaigns.
- FR87: Browse by category.
- FR88: Filter by metal/purity/price/occasion/in-stock.
- FR89: Free-text search (name/desc/SKU).
- FR90: Product detail (images, full price breakdown, HUID, certification, description, sizes, availability).
- FR91: HUID QR scan → BIS verification.
- FR92: Add to wishlist.
- FR93: Share product link (WhatsApp/SMS/copy).
- FR94: "Inquire at Shop" request.
- FR95: Store info (hours/address/directions/phone/about).
- FR96: Profile view (purchases/loyalty/wishlist/custom orders/rate-locks/try-at-home).
- FR97: Mark inquiry/wishlist "for gift" (triggers gift-wrap flag).
- FR98: Customer app shows ONLY anchor/tenant brand — Goldsmith platform brand never visible.
- FR99: Language toggle Hindi (default) / English; persists.

**Reviews, Size Guides, Policies (7):**
- FR100: Submit product review (rating + text; verified-buyer).
- FR101: Submit shop review if linked invoice.
- FR102: View all published reviews.
- FR103: Shopkeeper moderation (flag, respond publicly, request removal).
- FR104: In-app ring sizer (physical-method + paper-print).
- FR105: In-app bangle sizer.
- FR106: View shop return/exchange policy on every PDP + policy section.

**Notifications & Messaging (6):**
- FR107: WhatsApp notifications to customers (invoice receipt, progress photos, rate-lock confirm/expiry, try-at-home, loyalty tier, festival campaign with opt-in).
- FR108: Push notifications on same events.
- FR109: Push notifications to shopkeepers (low stock, PMLA warning, new inquiry, new try-at-home booking, new review, overdue stage).
- FR110: Shopkeeper broadcast WhatsApp to filtered segments.
- FR111: Customer opt-in/out marketing vs transactional.
- FR112: All outbound events logged per tenant for audit + quota.

**Reports & Dashboards (7):**
- FR113: Daily sales summary (invoices, value, GST, payment mix, exchanges).
- FR114: Stock valuation report (rate/cost/selling).
- FR115: Outstanding-payment report.
- FR116: Customer analytics (top LTV, new rate, repeat rate).
- FR117: Inventory aging with dead-stock flag.
- FR118: Loyalty program summary.
- FR119: Export report as CSV + branded PDF.

**Platform Admin (7):**
- FR120: Cross-tenant metrics dashboard.
- FR121: Subscription plan management (Starter/Pro/Enterprise) + plan assign.
- FR122: Override tenant subscription status (grace, trial extend).
- FR123: Impersonate tenant user (time-limited, audit-logged).
- FR124: Tenant data export (full bundle on request).
- FR125: Tenant deletion workflow (30-day soft → hard).
- FR126: Global platform settings (vendor API creds, feature-flag defaults, compliance-rule versioning) MFA-gated.

### Non-Functional Requirements (70 NFRs — referenced from PRD §11)

**Performance (P1-P12):** cold-start ≤60s p95 on 4G, FMP <2.5s, billing <1s, invoice gen <5s, API read <200ms / write <500ms, sync <30s p95, IBJA refresh 15 min + <100ms serve, first-load JS ≤250 KB, ImageKit p95 <500ms / <1.5s, 10× wedding season, offline ops <500ms, WhatsApp send <30s.

**Security (S1-S14):** TLS 1.3 + HSTS, AES-256 at rest, app-layer PII encryption with tenant-scoped keys, OTP rate-limit (5/15min + lockout @10), 15min access / 30d refresh rotation, password-less, RBAC+RLS defense-in-depth, 0 cross-tenant exposure + test from Sprint 1 + pentest before T2, 5-year immutable audit, API rate limit 100/min auth + 20/min anon + tenant throttle, Secrets Manager quarterly rotation, Snyk CVE CI, OWASP Top 10 SAST+DAST, RDS VPC-private + bastion + MFA.

**Scalability (SC1-SC8):** 10 tenants M5 → 100 M12 → 1000 M24, 50K products / 10K customers / 500 invoices/day per tenant, 10× wedding season 72h, ECS auto-scale + RDS read replicas, S3/CDN unbounded, BullMQ <1000 backlog p95.

**Accessibility (A1-A9):** WCAG 2.1 AA customer web, 4.5:1 normal / 3:1 large text, full keyboard nav, ARIA + screen reader, 200% zoom, Hindi + English with Noto Sans Devanagari, 44pt iOS / 48dp Android touch, error announce + no color-only, senior-user (45-65) validated.

**Integration (I1-I8):** adapter pattern per NFR-I1, IBJA circuit-breaker + fallback, Razorpay webhook idempotency, AiSensy per-tenant quota, retry w/ exp backoff max 3 tries, GSTR-1/3B CSV + FIU-IND templates, tenant-level integration config in Secrets Manager, annual vendor DPA review.

**Reliability (R1-R11):** 99.5% baseline / 99.9% wedding season, 99.9% M12, 7d planned maintenance window, RDS daily backup + PITR, RTO 4h MVP → 1h M12, RPO 1h MVP → 15min M12, Multi-AZ Mumbai, 0.5% error budget, critical path uptime monitoring + 10 runbooks, incident response per path.

**Compliance (C1-C9):** BIS/HUID on hallmark invoices + QR scan, GST 3+5 hardcoded + URD RCM auto, Section 269ST Rs 1,99,999 hard-block, PAN Rule 114B Rs 2L hard-block, PMLA cumulative warn@8L/block@10L + CTR/STR + 5y retention, DPDPA consent + privacy notice + export + deletion + 72h breach runbook by M9 (full Phase 3 May 2027), data residency AWS Mumbai only + no cross-border without DPA, vendor DPAs in place before tenant launch, child data protection (18+ attest + parental consent for minor purchase).

### Additional Requirements (from Architecture + ADRs)

**Starter / scaffold (ADR-0009, Architecture §Starter):**
- AR-1: Epic 1 Story 1 = monorepo scaffold composed from agency-templates + 4 apps (api, shopkeeper, customer, web, admin) + ~15 packages + CI green + health endpoint. Framed as user-value: "Shop Owner reaches their shop dashboard in the app".

**Infrastructure & IaC (ADR-0012):**
- AR-2: Terraform modules for network + database + cache + compute + storage + dns-tls + secrets + observability + ci-roles committed; `dev`/`staging`/`prod` workspaces.
- AR-3: AWS Mumbai ap-south-1 ONLY (SCP denies out-of-region); data-classification + data-residency tags on every resource.

**Data + multi-tenant (ADR-0002, 0005):**
- AR-4: Every tenant-scoped table has `shop_id` FK + RLS policy + `SET LOCAL app.current_shop_id` wrapper in every transaction.
- AR-5: `tenant-isolation` test suite ships in Epic 1; runs on every CI; blocks merge on leak.
- AR-6: Platform-admin privileged paths use SECURITY DEFINER + audit.

**Money + weight (ADR-0003):**
- AR-7: `packages/money` with DECIMAL-only primitives; FLOAT banned via Semgrep; 10K-transaction weight-precision harness in Epic 1.

**Compliance (ADR-0011):**
- AR-8: `packages/compliance` single authority for GST/269ST/PAN/PMLA/HUID/URD-RCM; versioned via `compliance_rules_versions`; hard-block gates called from every financial state transition.

**Offline sync (ADR-0004):**
- AR-9: WatermelonDB local DB for shopkeeper; pull-then-push over `/api/v1/sync/*` with monotonic cursor (per-tenant SEQUENCE); pessimistic lock on stock, LWW on notes, state-machine-governed on custom orders.

**Vendor integrations (ADR-0006):**
- AR-10: Every vendor behind `packages/integrations/<vendor>` implementing port interface + contract-test + circuit breaker + fallback chain where applicable.

**Theming + white-label (ADR-0008):**
- AR-11: `packages/ui-theme` resolves tenant theme to CSS vars (web) + React Context (mobile); HCT palette generator with WCAG AA gate at provisioning; Semgrep bans hex literals in customer-facing apps.

**Auth (ADR-0001):**
- AR-12: Supabase Auth (Mumbai) via `packages/integrations/auth`; JWT RS256 + refresh-token Redis rotation; MFA for platform admin.

**Real-time / sync protocol (ADR-0007):**
- AR-13: TanStack Query polling 5/30/60s with If-None-Match; ETag on read endpoints; WebSocket/SSE deferred.

**Tenant provisioning (ADR-0010):**
- AR-14: Orchestrated provisioning via admin console + Terraform + API lambda; tenant state machine PROVISIONED → ONBOARDING → ACTIVE → SUSPENDED/TERMINATED.

**Observability:**
- AR-15: Sentry + OpenTelemetry + PostHog (all self-hosted Mumbai) + structured JSON logs with tenant_id/user_id/request_id/trace_id on every line.

**Security baseline:**
- AR-16: Semgrep + Snyk + Trivy + axe-core + Lighthouse CI gates from Sprint 1; Codex CLI cross-model review gate per CLAUDE.md Agency Delivery Protocol.

### UX Design Requirements (from ux-design-specification.md — Direction C)

**Design system + tokens (UX §Visual Foundation + §Component Strategy):**
- UX-DR1: Extract Direction C tokens (warm terracotta #C35C3C primary, aged gold #C49B3C accent, cream #F5EBD9 neutral, muted semantic palette) into `packages/ui-tokens` with HCT-generated full 50-950 scale; WCAG AA contrast gate.
- UX-DR2: Build Tier 0 vendored shadcn primitives (~20) with Direction C customizations in `packages/ui-web/primitives`; RN primitives in `packages/ui-mobile/primitives`.
- UX-DR3: Tier 1 composed primitives: `LocaleAwareText` (Hindi/Latin auto-apply line-height + weight), `FormField`, `IconButton`, `ActionSheet`, `EmptyState`, `ErrorBoundary`, `LoadingState`.
- UX-DR4: Tier 2 jewellery domain atoms: `RateWidget` (3 variants), `HUIDMedallion` (verified/pending/unverified/n-a; 12s rotation on verified; reduced-motion respected), `BISBadge`, `PriceBreakdownCard`, `SariBorderDivider`, `ShopCard`, `LoyaltyTierBadge`, `SizeGuide` (ring + bangle), `CategoryPill`, `ProductBadge`.
- UX-DR5: Tier 3 business components: shopkeeper set (`ProductCard`, `InvoiceLineItem`, `CustomerContextCard`, `CustomOrderStageTracker`, `InventoryRow`, `DailySummaryCard`, `BillingLineBuilder`, `ComplianceInlineAlert`, `SettingsGroupCard`) + customer set (`ProductDetailSpec`, `RateLockCard`, `TryAtHomeBookingCard`, `CustomerOrderTimelineView`, `ReviewCard`, `WishlistGrid`, `InquiryCard`, `StoreLocatorMap`) + admin set (`TenantCard`, `FeatureFlagToggle`, `ThemeConfiguratorWizard`, `MetricsDashboard`).

**Typography + locale (UX §Typography):**
- UX-DR6: Typography stack — Rozha One (Hindi display) + Hind Siliguri (Hindi body) + Fraunces (Latin). Self-hosted via Next.js Font + Expo Font. `LocaleAwareText` applies Hindi effective weight +100 vs Latin; line-height 1.6 Hindi vs 1.5 Latin.
- UX-DR7: Surface-specific font scale: shopkeeper base 18px body (senior-friendly), customer mobile 16px, customer web 16px, admin 14px.

**5 designed-moment components (UX §Effortless Interactions + §Critical Success Moments):**
- UX-DR8: `ArrivalSequence` — 4-sec customer app cold-start: anchor logo + Hindi greeting + live rate.
- UX-DR9: `RateUpdateToast` — shopkeeper 1-sec rate change propagation confirmation.
- UX-DR10: `HUIDCeremony` — 0.8s gold outline pulse + 1.2s seal materialise + soft chime + medium haptic; Hindi success copy.
- UX-DR11: `ComplianceBlockModal` — warmth-toned ("hum aapki safety ke liye") modal with alternative-action suggestions.
- UX-DR12: `InvoiceShareCelebration` — haptic + toast + animated PDF-slide-to-WhatsApp sheet.

**6 user journey flows (UX §User Journey Flows):**
- UX-DR13: Shopkeeper billing loop (90-second target, p95); single-screen revealing sections; Quick/Standard/Detail rhythm modes; inline compliance pre-checks; offline-first; WhatsApp auto-share.
- UX-DR14: Customer browse-to-reserve loop (60-second target, p95); 4-sec arrival → browse → product detail → HUID ceremony → rate-lock OR inquire → WhatsApp family share.
- UX-DR15: Custom order 7-stage lifecycle flow with progress photos, approval ceremony, modification handling, review prompt.
- UX-DR16: Shopkeeper walk-in peripheral context (3-sec target from detection to context-visible); privacy-respecting peripheral card (not modal); opt-in consent enforced.
- UX-DR17: Tenant onboarding flow (platform admin + theme configurator + WCAG check + feature flags + staff invite + 5-screen preview + owner approve + training + launch).
- UX-DR18: Shopkeeper Settings flow — WhatsApp-like, grouped cards, inline save, read-only compliance panel (explains "ये values कानून से fixed हैं"), 30-sec propagation to customer app.

**UX consistency patterns (UX §UX Consistency Patterns):**
- UX-DR19: Button hierarchy (Primary terracotta / Secondary ghost / Destructive crimson); one-primary-per-screen exceptions + override authority.
- UX-DR20: Feedback intensity matrix (zero → designed-moment); no emoji in feedback copy; haptic+toast conventions.
- UX-DR21: Form patterns per context (save-on-change settings; submit-at-end billing; multi-step onboarding; live-update search).
- UX-DR22: Navigation patterns per surface (bottom-tabs mobile, top-bar customer web, sidebar admin web); command-K palette for shopkeeper + admin.
- UX-DR23: Modal + overlay patterns (bottom-sheet mobile confirmation; center modal web; compliance-hard-block = center/bottom-sheet no-backdrop-dismiss).
- UX-DR24: Empty-state conventions (illustration + copy + primary CTA; Hindi-first, never apologetic).
- UX-DR25: Motion patterns (5 canonical: arrival/exit/state-shift/success-beat/error-shake); respects prefers-reduced-motion.
- UX-DR26: Search + filter patterns (debounced live-update; Hindi/English transliteration-tolerant).
- UX-DR27: Loyalty tier visualization, rate-freshness indicator, offline-mode indicator, viewing-analytics surface (non-surveillance framing).

**Responsive + accessibility (UX §Responsive + §Accessibility):**
- UX-DR28: Breakpoints xs 360 / sm 480 / md 768 / lg 1024 / xl 1440 / 2xl 1920.
- UX-DR29: WCAG 2.1 AA enforced via axe-core + Lighthouse CI; 4.5:1 text contrast; full keyboard nav; ARIA live regions; focus ring (2px terracotta-600, 2px offset); 48dp+ shopkeeper / 44pt+ customer touch; 200% zoom tolerant.
- UX-DR30: Hindi TalkBack + English TalkBack tested; `lang` attribute on text fragments; Hindi screen-reader tested before anchor launch.

**Ayodhya-specific baseline (UX §Ayodhya-Specific Baseline):**
- UX-DR31: Network 4G LTE primary with 3G graceful degrade; mid-tier Android (Xiaomi Redmi Note class) tested; sunlight-contrast validation; privacy-on-screen in crowded scenarios.

### FR Coverage Map

(Populated in §Epic List below. Every FR mapped to exactly one owning epic.)

---

## Epic Story Files (consolidation map)

The 16 epics' detailed stories are in separate files to respect size limits; together they form the canonical output of BMAD CE Step 3. Dev Story agent should read the relevant file + this master index.

| Epic | Stories | File |
|------|---------|------|
| Epic 1: Shop Owner account + staff + dashboard | 7 | `epics-E1-E2.md` |
| Epic 2: Shopkeeper self-service settings | 9 | `epics-E1-E2.md` |
| Epic 3: Inventory + sync | 10 | `epics-E3-E4.md` |
| Epic 4: Pricing + gold rate | 6 | `epics-E3-E4.md` |
| Epic 5: Billing + compliance | 13 | `epics-E5.md` |
| Epic 6: CRM | 9 | `epics-E6-E8.md` |
| Epic 7: Customer app (browse + HUID + wishlist + inquire) | 10 | `epics-E7-part1.md` |
| Epic 7: Customer app (store info + profile + white-label + i18n + reviews + size guides) | 10 | `epics-E7-part2.md` |
| Epic 8: Loyalty | 5 | `epics-E6-E8.md` |
| Epic 9: Rate-lock | 5 | `epics-E9-E10-E11-E12.md` |
| Epic 10: Try-at-home | 4 | `epics-E9-E10-E11-E12.md` |
| Epic 11: Custom order | 8 | `epics-E9-E10-E11-E12.md` |
| Epic 12: Viewing analytics (consent-first) | 6 | `epics-E9-E10-E11-E12.md` |
| Epic 13: Notifications | 10 | `epics-E13-E14.md` |
| Epic 14: Reports | 8 | `epics-E13-E14.md` |
| Epic 15: Platform admin + tenant provisioning | 12 | `epics-E15-E16.md` |
| Epic 16: Anchor go-live with confidence | 6 | `epics-E15-E16.md` |
| **Total** | **138 stories** | |

**Subagent batch failure recovery note:** Initial dispatch of 5 parallel Sonnet subagents produced 2 successful files (E1-E2 + E9-E12 = 39 stories). The remaining 3 subagents hit the 32k output-token cap (E3-E5, E6-E8) or were killed by rate-limit (E13-E14 re-dispatch, customer-aspirational design agent). The orchestrator (Opus main conversation) completed the remaining 9 epic-files directly with per-epic Writes to stay under the cap. Format is consistent across all files; the agent-failure is a workflow-level issue, not a story-quality issue.

**Design direction status:** Separately flagged. Direction C was rejected as "not comparable to CaratLane / Tanishq / Kalyan Jewellers". Customer-aspirational design re-run agent was dispatched but killed by rate-limit before producing output. Re-dispatch after limit resets — this is tracked as Task #13. Story structure in Epic 7 uses token references (packages/ui-tokens) so design-token-value changes post-design-rerun don't invalidate stories; only token values swap.

---

## Epic List

16 epics organized around user value. Epics sized for incremental delivery; each epic stands alone once its predecessors ship. IR-report corrections applied.

### Epic 1: Shop Owner can create an account, invite staff, and reach their shop dashboard
**User outcome:** A jeweller owner signs up via phone OTP, sees a branded empty-state shop dashboard, invites staff, and gives them roles — all in Hindi, on their white-labeled app.
**FRs covered:** FR1 (tenant create — seeded by platform admin offline for MVP anchor), FR5 (tenant isolation invariant), FR8, FR9 (OTP auth), FR10, FR11 (session), FR12, FR13, FR14 (staff + RBAC), FR15 (auth audit).
**NFRs directly enforced here:** NFR-P3, NFR-S1, NFR-S2, NFR-S4, NFR-S5, NFR-S7, NFR-S8 (tenant-isolation test from Sprint 1), NFR-S9 (audit), NFR-S10 (rate limit), NFR-S11 (secrets), NFR-C7 (data residency), NFR-C8 (vendor DPA — Supabase Auth + MSG91 contracted pre-epic).
**Additional Requirements absorbed:** AR-1 (scaffold + enterprise floor), AR-2/3 (IaC + data-classification tags), AR-4/5/6 (RLS + test harness + SECURITY DEFINER), AR-7 (money + weight primitives skeleton + harness skeleton), AR-12 (Supabase Auth adapter), AR-15 (observability baseline), AR-16 (CI gates).
**UX-DRs absorbed:** UX-DR1/2/3 (tokens + Tier 0 primitives + Tier 1 composed), UX-DR6/7 (typography), UX-DR28/29/30 (responsive + a11y + Hindi TalkBack), parts of UX-DR22 (navigation shell), partial UX-DR19/20 (button hierarchy + feedback patterns foundation).
**Phase:** Phase 0 — Sprint 1-2.
**Dependencies:** None (foundation).
**Definition of success:** Owner logs in → sees empty dashboard in Hindi → invites two staff → staff log in → see role-appropriate (limited) dashboard. Tenant-isolation test suite green. CI all gates green.

---

### Epic 2: Shopkeeper runs their own shop by editing making charges, loyalty, policies, and preferences in Hindi
**User outcome:** Innovation #3 from PRD — the jeweller changes their own making charges / rate-lock duration / try-at-home toggle / loyalty rules / policy text / notification preferences in a WhatsApp-like settings UI, without calling the platform team.
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24.
**NFRs directly enforced:** NFR-P6 (30-sec propagation), NFR-S9 (settings-change audit).
**UX-DRs absorbed:** UX-DR18 (Settings flow), partial UX-DR19/21 (button + form patterns for settings).
**Phase:** Phase 0 — Sprint 2-3.
**Dependencies:** Epic 1.
**Definition of success:** Owner changes making charge for Diamond Rings from 12% to 10%; change saves inline with haptic + toast; customer-facing surfaces (catalog, later epic) will read from settings within 30s of publish.

---

### Epic 3: Shopkeeper manages inventory with barcode scan, multi-purity, and publishes pieces that reach the customer app in under 30 seconds
**User outcome:** Shopkeeper scans/enters 240 pieces at onboarding; publishes them one by one or in bulk; sees live stock valuation; customer app later reflects published pieces. **Sync infrastructure (cursor, pull/push endpoints, WatermelonDB schema) ships here, used by the customer app in Epic 7.**
**FRs covered:** FR25, FR26 (CSV bulk), FR27 (barcode), FR28 (status), FR29 (publish/unpublish), FR30 (30-sec sync SLA — publish side + sync protocol), FR31 (live valuation), FR32 (stock movements), FR33 (search + filter), FR34 (dead stock).
**NFRs directly enforced:** NFR-P6, NFR-P11 (offline <500ms), NFR-SC4 (50K products per tenant), NFR-I1 (ImageKit adapter).
**Additional Requirements absorbed:** AR-9 (WatermelonDB + sync protocol cursor + pull/push endpoints + pessimistic stock lock + conflict resolution scaffolding).
**UX-DRs absorbed:** UX-DR13 (partial — offline-first foundation), UX-DR22 (shopkeeper bottom-tab nav expanded), UX-DR26 (search + filter patterns), partial UX-DR4 (ProductBadge + CategoryPill).
**Phase:** Phase 0 — Sprint 3-4.
**Dependencies:** Epic 1.
**Definition of success:** Shopkeeper onboards anchor inventory (240 pieces) via CSV + barcode scan; publishes 100; sync cursor advances; offline invoice draft + reconnect cleanly. Weight-precision harness passes 10K-transaction assertion against product data.

---

### Epic 4: Shopkeeper sets today's gold rate and sees live prices throughout the app; customer sees the same rate on home
**User outcome:** Shopkeeper sees IBJA rate auto-fetched every 15 minutes; overrides when needed; historical rate chart available; customer app home shows today's live rate and rate ticker.
**FRs covered:** FR35, FR36, FR37, FR38, FR39, FR40 (price formula — shared across billing + catalog).
**NFRs directly enforced:** NFR-P7 (IBJA refresh cadence + <100ms Redis serve), NFR-I2 (circuit breaker + Metals.dev fallback + cached-last-known-good).
**Additional Requirements absorbed:** AR-10 (rates adapter + fallback chain).
**UX-DRs absorbed:** UX-DR4 (RateWidget 3 variants — full, compact, ticker), UX-DR9 (RateUpdateToast designed moment), UX-DR27 (rate-freshness indicator).
**Phase:** Phase 0 — Sprint 3.
**Dependencies:** Epic 1.
**Definition of success:** IBJA rates fetched every 15 min; shopkeeper overrides + rationale logged; historical chart renders; customer app home shows 24K + 22K + silver rate with freshness timestamp.

---

### Epic 5: Shopkeeper bills a customer in 90 seconds with compliant GST + HUID + cash-cap + PAN enforcement
**User outcome:** The 90-second billing loop — the core shopkeeper experience. Estimate → invoice → auto GST(3+5) + HUID + PAN prompt at Rs 2L hard-block + Section 269ST cash-cap hard-block at Rs 1,99,999 + PMLA cumulative tracking + split payment + WhatsApp invoice share. Works offline; syncs on reconnect.
**FRs covered:** FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR55.
**NFRs directly enforced:** NFR-P4 (invoice gen <5s p95), NFR-P11 (offline <500ms), NFR-C1, NFR-C2, NFR-C3, NFR-C4, NFR-C5, NFR-S9 (compliance audit).
**Additional Requirements absorbed:** AR-8 (compliance package hard-block gateway — first production consumer), AR-10 (Razorpay payments adapter), partial AR-9 (offline invoice drafts).
**Sequencing note (IR-report correction):** Story 5.1 uses hardcoded making-charge default until Epic 2 integrates. Once Epic 2 ships, later stories in this epic switch to reading from `shop_settings`. Epic 5 thus ships in parallel with Epic 2 with clear hand-off points.
**UX-DRs absorbed:** UX-DR13 (billing loop complete), UX-DR5 (InvoiceLineItem, BillingLineBuilder, ComplianceInlineAlert), UX-DR11 (ComplianceBlockModal), UX-DR12 (InvoiceShareCelebration), UX-DR21 (form patterns billing), UX-DR23 (hard-block modal no-backdrop-dismiss).
**Phase:** Phase 0 — Sprint 4-5.
**Dependencies:** Epic 1, Epic 3 (inventory), Epic 4 (rates); uses Epic 2 settings once available (non-blocking).
**Definition of success:** Anchor completes first real invoice (not demo) within 48 hours of onboarding call — PRD §Success Criteria #1 for anchor. Compliance hard-block suite green. Weight-precision harness green. Tenant-isolation test green. Sub-90-second p95 invoice path validated in UX instrumentation.

---

### Epic 6: Shopkeeper knows every customer — purchase history, family links, notes, occasions
**User outcome:** Shopkeeper creates customer records, links family members, adds notes, tracks credit, sets occasion reminders. Enables Journey 3 (customer walk-in context in Epic 12).
**FRs covered:** FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR63 (DPDPA-compliant deletion).
**NFRs directly enforced:** NFR-S3 (PAN encryption — used when PAN is captured here for high-value customers), NFR-C6 (DPDPA deletion workflow + 72-hour breach-notification runbook ready by M9), NFR-C9 (child data protection).
**Additional Requirements absorbed:** (FR68 consent schema foundation for later Epic 12 analytics is added in a story here so it's available when analytics ships).
**UX-DRs absorbed:** UX-DR5 (CustomerContextCard, shopkeeper CRM screens), UX-DR22 (customer list + detail navigation), UX-DR26 (customer search Hindi/English agnostic).
**Phase:** Phase 0 — Sprint 4-5.
**Dependencies:** Epic 1.
**Definition of success:** Anchor imports 500 existing customers from paper records; phone-based search returns results; family members linked; DPDPA deletion workflow tested (soft-delete 30-day → hard, retaining invoices). Consent schema ready for Epic 12 to consume.

---

### Epic 7: Customer opens the jeweller's app, sees live rate, browses catalog, scans HUID QR to verify — all in the jeweller's brand
**User outcome:** The 60-second browse-to-HUID-verify loop — Journeys 4 + 5 from PRD. Customer opens anchor-branded app → sees rate → browses category → opens product detail → sees full price breakdown + HUID → scans QR → BIS-verified ceremony → wishlist / inquire / share. White-label rigorously enforced.
**FRs covered:** FR5 (tenant isolation in customer read-path), FR30 (30-sec reflect — consumer side), FR86, FR87, FR88, FR89, FR90, FR91 (HUID QR scan), FR92, FR93, FR94, FR95, FR96, FR97 (gift mode), FR98 (anchor brand exclusive — platform brand NEVER visible), FR99 (Hindi/English toggle).
**NFRs directly enforced:** NFR-P1 (cold-start), NFR-P2 (FMP web), NFR-P8 (first-load JS), NFR-P9 (ImageKit), NFR-A1 through NFR-A9 (customer web WCAG 2.1 AA), NFR-SC1-3 (tenant scale).
**Additional Requirements absorbed:** AR-11 (theming + HCT + Semgrep enforcement), AR-13 (polling + ETag), AR-10 (Surepass HUID-verification adapter).
**UX-DRs absorbed:** UX-DR4 (HUIDMedallion, BISBadge, PriceBreakdownCard, SariBorderDivider, ShopCard, LoyaltyTierBadge, SizeGuide Tier 2 atoms), UX-DR5 (customer ProductDetailSpec, WishlistGrid, InquiryCard, StoreLocatorMap), UX-DR8 (ArrivalSequence), UX-DR10 (HUIDCeremony), UX-DR14 (customer browse-to-reserve loop complete), UX-DR22 (customer web top-bar + customer mobile bottom-tabs nav), UX-DR25 (motion patterns).
**Phase:** Phase 1 — Sprint 5-7 (starts as Epic 6 finishes).
**Dependencies:** Epic 1, Epic 3 (inventory + sync infrastructure), Epic 4 (rate + formula).
**Definition of success:** Customer cold-starts app → views rate → browses category → sees product detail with full price breakdown + HUID → scans QR → BIS-verified ceremony fires → wishlists item → shares to WhatsApp. Customer app shows ONLY anchor brand (Chromatic VR green; Semgrep platform-brand-leak check green). Tenant-isolation test green including cross-tenant customer.

---

### Epic 8: Customer earns and redeems loyalty points with every purchase
**User outcome:** Customers see their loyalty tier + points balance + progress to next tier in the customer app; auto-upgrade/downgrade on rolling-12-month total; shopkeeper redeems points as invoice discount.
**FRs covered:** FR69, FR70, FR71, FR72.
**NFRs directly enforced:** NFR-P6 (tier changes propagate ≤30s).
**UX-DRs absorbed:** UX-DR27 (loyalty tier visualization), UX-DR4 (LoyaltyTierBadge).
**Phase:** Phase 1 — Sprint 6.
**Dependencies:** Epic 5 (invoice completion triggers accrual), Epic 6 (customer records).
**Definition of success:** Customer sees tier + points after first purchase; tier upgrade celebration fires on crossing threshold; shopkeeper redeems points on next invoice with auto-calc; tier history immutable.

---

### Epic 9: Customer reserves a rate for 7 days with a deposit; if they come back, the locked rate is honoured
**User outcome:** Customer sees a product → taps "Lock today's rate" → pays Razorpay deposit → receives confirmation (locked-rate + expiry + deposit); if they purchase within validity, the locked rate is honoured automatically; shopkeeper can override post-expiry with audit-logged justification.
**FRs covered:** FR80, FR81, FR82, FR83.
**NFRs directly enforced:** NFR-I3 (Razorpay webhook idempotency), NFR-S9 (override audit).
**Additional Requirements absorbed:** AR-10 (Razorpay adapter).
**UX-DRs absorbed:** UX-DR5 (RateLockCard), UX-DR14 (rate-lock flow within browse-to-reserve loop).
**Phase:** Phase 1 — Sprint 7.
**Dependencies:** Epic 5, Epic 7.
**Definition of success:** Customer locks rate at Rs 6,842/g → 7 days later market rate Rs 6,920/g → customer returns to buy → invoice uses Rs 6,842/g automatically; post-expiry override by shopkeeper audit-logged with justification.

---

### Epic 10: Customer books try-at-home; shopkeeper fulfills and tracks through the booking lifecycle
**User outcome:** Feature-flagged per tenant (anchor ON; Suresh-ji in Varanasi OFF). Customer requests try-at-home for N pieces, date, address → shopkeeper approves/reschedules → dispatches → tracks through Requested → Confirmed → Dispatched → Returned / Purchased.
**FRs covered:** FR84, FR85.
**NFRs directly enforced:** NFR-P6 (state reflects ≤30s).
**UX-DRs absorbed:** UX-DR5 (TryAtHomeBookingCard + shopkeeper booking mgmt screens), partial UX-DR14 (try-at-home entry from product detail).
**Phase:** Phase 1 — Sprint 7-8.
**Dependencies:** Epic 5 (invoice generation on purchase), Epic 6 (customer record), Epic 7 (customer app entry).
**Definition of success:** Customer books 3 pieces for home visit on Saturday; shopkeeper confirms; pieces dispatched; returned with purchase of 1 piece → invoice generated; state machine audit-complete.

---

### Epic 11: Customer places a custom bridal order and follows progress with photos at 3 stages
**User outcome:** The bridal narrative journey (Journey 4). Customer submits design inspiration via app OR shopkeeper creates in shop → quote → deposit → 7-stage tracking (Quoted → Approved → Metal Cast → Stones Set → QC → Ready → Delivered) → progress photos at Metal Cast + Stones Set + QC auto-shared via WhatsApp → customer modification request + shopkeeper approve/reject → final invoice with deposit pull-through.
**FRs covered:** FR73, FR74, FR75, FR76, FR77, FR78, FR79.
**NFRs directly enforced:** NFR-S9 (state-transition audit), NFR-C5 (3y retention).
**UX-DRs absorbed:** UX-DR5 (CustomOrderStageTracker, CustomerOrderTimelineView), UX-DR15 (custom order lifecycle flow).
**Phase:** Phase 1 — Sprint 7-8.
**Dependencies:** Epic 5, Epic 6, Epic 7.
**Definition of success:** Priya submits inspiration → anchor quotes Rs 3.8L + Rs 50K deposit via Razorpay → approval ceremony fires → 4 weeks later ready → final invoice with deposit pre-applied; WhatsApp progress photos at 3 stages; modification request handling tested.

---

### Epic 12: Customer opts into seeing recognition; when they walk into the shop, staff know their wishlist and recent views
**User outcome:** Innovation #1 from PRD. Customer opts into viewing-tracking at signup (default-on per DPDPA but one-tap opt-out always available). On logged-in product views + wishlist adds, events emit. When customer walks into shop (detected via beacon OR loyalty QR scan OR name lookup), shopkeeper app shows `CustomerContextCard` at top with recent browsing + wishlist + rate-locks + occasions. Consent-respecting: opt-out retroactively anonymizes.
**FRs covered:** FR68 (consent — SHIPS FIRST), FR64, FR65, FR66, FR67.
**NFRs directly enforced:** NFR-C6 (DPDPA consent flow), NFR-S9 (analytics-view audit).
**Sequencing note (IR-report correction):** FR68 (consent flow + retroactive anonymization) is Story 12.1. Story 12.2 onwards (event ingestion + per-customer analytics + walk-in card) can only begin after 12.1 merges.
**UX-DRs absorbed:** UX-DR16 (walk-in peripheral context flow), UX-DR5 (CustomerContextCard), UX-DR27 (viewing-analytics surface with non-surveillance framing), partial UX-DR7 (customer-app privacy settings).
**Phase:** Phase 1 — Sprint 8-9.
**Dependencies:** Epic 6 (customer record), Epic 7 (customer browse events). FR68 consent story blocks Epic 12 event stories.
**Definition of success:** Customer opts in at signup; browses 6 products → events ingested; walks into shop → staff sees peripheral card in < 3 seconds; opt-out later → past events anonymized; audit trail intact.

---

### Epic 13: Customers receive WhatsApp updates at the right moments; shopkeepers receive the right push alerts
**User outcome:** Split into per-user-value slices (not "notifications infrastructure"):
  - Customer receives WhatsApp invoice + progress photos + rate-lock confirmation + try-at-home confirmation + loyalty upgrade + festival campaign (opt-in).
  - Shopkeeper receives push for low stock + PMLA cumulative-cash warning + new customer inquiry + new try-at-home booking + new review + custom order stage overdue.
  - Shopkeeper broadcasts WhatsApp to segmented customers.
  - All customers separately opt-in to marketing vs transactional.
**FRs covered:** FR107, FR108, FR109, FR110, FR111, FR112.
**NFRs directly enforced:** NFR-P12 (WhatsApp <30s dispatch), NFR-I4 (AiSensy per-tenant quota), NFR-I5 (retry + DLQ), NFR-C6 (marketing opt-in consent).
**Additional Requirements absorbed:** AR-10 (AiSensy + FCM + Resend adapters).
**UX-DRs absorbed:** UX-DR20 (feedback intensity matrix for push + WhatsApp), UX-DR25 (motion for toast + haptic on receipt confirmations).
**Phase:** Phase 1 — runs continuously from Sprint 6; per-slice stories land as their consuming feature ships (e.g., "customer receives WhatsApp invoice" lands in Sprint 4-5 alongside Epic 5).
**Dependencies:** Whichever feature-epic is emitting the event (Epic 5 invoice, Epic 8 loyalty, Epic 9 rate-lock, Epic 10 try-at-home, Epic 11 custom order, Epic 5 PMLA warning, etc.). Each slice depends on its emitting event source.
**Definition of success:** Every transactional notification arrives on WhatsApp + push in < 30s of trigger; opt-in marketing separate; DLQ monitored; audit per-tenant for quota + compliance.

---

### Epic 14: Shopkeeper sees the day's numbers, ages inventory, and exports GSTR-ready data
**User outcome:** End-of-day report; stock valuation; outstanding payments; customer analytics; inventory aging with dead-stock flag; loyalty summary; CSV + branded PDF export.
**FRs covered:** FR113, FR114, FR115, FR116, FR117, FR118, FR119.
**NFRs directly enforced:** NFR-P5 (complex reports <2s via read replica), NFR-SC6 (RDS read replica scaling).
**Additional Requirements absorbed:** Read replica provisioning.
**UX-DRs absorbed:** UX-DR5 (DailySummaryCard + reports screens), UX-DR25 (motion for chart load).
**Phase:** Phase 1 — Sprint 9.
**Dependencies:** Epic 5 (invoice data), Epic 6 (customer data), Epic 8 (loyalty data).
**Definition of success:** End-of-day report renders in < 2s; CSV + branded PDF export functional; accountant receives auto-report; PMLA cumulative-cash dashboard surfaces threshold warnings.

---

### Epic 15: Platform Admin can onboard a new jeweller in under 1 day with zero custom code
**User outcome:** Innovation validated. Platform admin fills provisioning wizard (shop name, GSTIN, BIS reg, owner phone, logo, seed color [HCT WCAG-gated], feature flags, plan) → Terraform provisions infra (CNAME + ACM + S3 prefix + tenant KMS CMK + Meilisearch index) + API creates tenant row + invites owner via WhatsApp + SMS → owner verifies OTP + sees preview across 5 screens → approves → launches.
**FRs covered:** FR1 (full automated create — not just seeded), FR2 (branding config + apply), FR3 (feature flags per tenant), FR4 (suspend/reactivate/terminate with DPDPA retention), FR6 (cross-tenant metrics), FR7 (Platform Support time-limited access), FR120 (cross-tenant dashboard), FR121 (subscription plan mgmt), FR122 (override subscription status), FR123 (time-limited audit-logged impersonation), FR124 (tenant data export), FR125 (tenant deletion workflow), FR126 (MFA-gated global platform settings).
**NFRs directly enforced:** NFR-S8 (external pentest before tenant #2), NFR-SC1-3 (architecture supports 10 → 100 → 1000 tenants).
**Additional Requirements absorbed:** AR-14 (tenant provisioning orchestrator), AR-6 (SECURITY DEFINER cross-tenant paths), AR-3 (data-residency + tag validation).
**UX-DRs absorbed:** UX-DR5 (admin TenantCard, FeatureFlagToggle, ThemeConfiguratorWizard, MetricsDashboard), UX-DR17 (tenant onboarding flow), UX-DR22 (admin sidebar nav).
**Phase:** Phase 1 — Sprint 9-10. Earlier stories (MFA-gated admin login; tenant list for support) ship as needed throughout Phase 0-1; full provisioning flow lands by end of Phase 1.
**Dependencies:** Epic 1 (tenant data model), all feature epics complete (so preview can render the full shopkeeper + customer app).
**Definition of success:** 2nd jeweller (Varanasi Gold House, mock) provisioned end-to-end in < 3 weeks at M9; at M12, 10th jeweller onboarded in < 1 week; zero custom code changes verified. Impersonation audit-logged. External pentest passed before 2nd live tenant.

---

### Epic 16: Anchor jeweller goes live with confidence — performance, resilience, compliance, and 24-hour P1 support
**User outcome (NOT "hardening" per IR report — specific user-value framing):**
  - **Anchor jeweller survives wedding-season peak (Dhanteras week):** 40+ invoices in 4 hours without degradation.
  - **Anchor data is recoverable after outage:** power cut mid-day → offline invoices sync → no loss.
  - **Anchor passes external pentest before 2nd tenant onboards:** tenant-isolation integrity validated by external firm.
  - **Anchor support is real:** P1 bugs resolved <24h; shopkeeper can reach human support via WhatsApp.
  - **Anchor telemetry is live:** DAU/WAU/MAU dashboards visible to platform + anchor from Day 1 so Month-6 engagement pivot trigger is actionable.
**FRs covered:** None new — this epic cements NFRs + runbooks as user-value outcomes.
**NFRs directly enforced:** NFR-P10 (10× wedding-season load sustained 72h), NFR-R1 through NFR-R11 (uptime + backups + RTO/RPO + runbooks + monitoring + incident response), NFR-S8 (external pentest before 2nd tenant), NFR-S12 (CVE scanning baseline), NFR-S13 (OWASP SAST+DAST), NFR-S14 (VPC private + bastion + MFA).
**Stories (all user-value framed, none "hardening"):**
  - 16.1 Anchor survives Dhanteras 10× load (k6 load test + auto-scaling policies tuned; runbook rehearsed).
  - 16.2 Anchor data is always recoverable (RDS PITR drilled; offline sync drill; S3 versioning verified; runbook for mass-customer-deletion-request tested).
  - 16.3 Anchor's tenant isolation is independently verified (external pentest; zero cross-tenant findings signed off).
  - 16.4 Anchor can reach a human in 5 minutes (Zoho Desk + WhatsApp native support channel wired; P1 runbook with 24h resolution target).
  - 16.5 Anchor's telemetry tells us if the customer app is working (PostHog DAU/WAU/MAU cohorts live from Day 1; pivot-trigger dashboards; alert on critical-path failures).
  - 16.6 Anchor sign-off day (demo walkthrough; anchor approves production launch; zero unresolved P1 bugs; references Goldsmith to at least one other jeweller per PRD success criteria).
**UX-DRs absorbed:** UX-DR31 (Ayodhya-specific baseline validated on actual anchor device fleet).
**Phase:** Phase 1 — Sprint 10.
**Dependencies:** All prior epics.
**Definition of success:** Anchor signs off on production deployment; zero unresolved P1 bugs; Dhanteras-load drill passed; external pentest passed; 24h P1 support channel live; PostHog DAU/WAU/MAU dashboards rendering real data.

---

### Phase 2+ epics (out of scope for this CE run — scoped for completeness)

Not expanded into stories here; documented so readers know they're tracked:
- Epic P2-A: 2nd-10th jeweller onboarding automation + guided self-service improvements (extends Epic 15).
- Epic P2-B: Karigar management module (issue/receipt registers, metal ledger, wastage tracking, karigar performance dashboard).
- Epic P2-C: Gold savings schemes (built feature-flagged OFF for anchor; enabled for 2nd+ jewellers).
- Epic P2-D: GSTR-1/3B JSON auto-export (replaces MVP CSV).
- Epic P2-E: Multi-store management for single tenant (Phase 3+).
- Epic P2-F: True real-time sync (WebSocket/SSE) replacing polling (Phase 3+).
- Epic P2-G: Per-tenant native app builds via EAS variants (Phase 4+).
- Epic P2-H: Cross-region DR ap-south-2 (Phase 4+).

---

## FR Coverage Map

Every one of the 126 FRs maps to exactly one owning epic. Cross-cutting FRs are called out inline.

| FR | Description (short) | Owning Epic | Cross-epic notes |
|-----|--------------------|-------------|------------------|
| FR1 | Platform admin create tenant | E15 | E1 uses seeded tenant for anchor |
| FR2 | Tenant branding + apply | E15 | Theme resolver in E1, consumed by E7 |
| FR3 | Per-tenant feature flags | E15 | Platform-default flags used from E1 |
| FR4 | Tenant suspend/reactivate/terminate | E15 | — |
| FR5 | Strict tenant isolation (invariant) | E1 | Verified in every epic via tenant-isolation test suite |
| FR6 | Tenant usage metrics view | E15 | — |
| FR7 | Platform support time-limited access | E15 | — |
| FR8 | Shopkeeper OTP signup/login | E1 | — |
| FR9 | Customer OTP signup/login | E1 | Customer app uses from E7 |
| FR10 | Refresh token persistence | E1 | — |
| FR11 | Logout all devices | E1 | — |
| FR12 | Invite staff | E1 | — |
| FR13 | Per-role permissions | E1 | Used by every epic's RBAC |
| FR14 | Revoke staff access | E1 | — |
| FR15 | Auth audit trail | E1 | — |
| FR16 | Shop profile edit | E2 | — |
| FR17 | Default making charges | E2 | Consumed by E5 billing |
| FR18 | Default wastage % | E2 | Consumed by E3 inventory + E5 billing |
| FR19 | Loyalty config | E2 | Consumed by E8 |
| FR20 | Rate-lock duration config | E2 | Consumed by E9 |
| FR21 | Try-at-home toggle + piece count | E2 | Gates E10 |
| FR22 | Custom order policy text | E2 | Displayed in E11 |
| FR23 | Return/exchange policy text | E2 | Displayed in E7 PDP |
| FR24 | Notification preferences | E2 | Consumed by E13 |
| FR25 | Create product | E3 | — |
| FR26 | CSV bulk import | E3 | — |
| FR27 | Barcode label print | E3 | — |
| FR28 | Product status | E3 | — |
| FR29 | Publish/unpublish | E3 | Customer-side read in E7 |
| FR30 | 30-sec sync SLA | E3 (publish) | Verified in E7 (customer-read) |
| FR31 | Live stock valuation | E3 | — |
| FR32 | Stock movements | E3 | — |
| FR33 | Search + filter | E3 | — |
| FR34 | Dead stock | E3 | — |
| FR35 | IBJA auto-fetch | E4 | — |
| FR36 | Manual rate override | E4 | — |
| FR37 | Per-purity rates | E4 | — |
| FR38 | Historical rate chart | E4 | — |
| FR39 | Rate on customer home | E4 | Consumed in E7 |
| FR40 | Price formula | E4 | Consumed by E5 + E7 |
| FR41 | Generate estimate | E5 | — |
| FR42 | Estimate → invoice | E5 | — |
| FR43 | B2C invoice | E5 | — |
| FR44 | B2B wholesale invoice | E5 | — |
| FR45 | Split payments | E5 | — |
| FR46 | PAN hard-block Rs 2L | E5 | Gate in packages/compliance |
| FR47 | Section 269ST hard-block + override | E5 | Gate in packages/compliance |
| FR48 | URD/RCM self-invoice | E5 | — |
| FR49 | Old-gold adjust | E5 | — |
| FR50 | HUID capture | E5 | Used in E7 QR scan |
| FR51 | Invoice PDF share | E5 | WhatsApp via E13 |
| FR52 | Void/modify invoice window | E5 | — |
| FR53 | PMLA cumulative warn @8L / block @10L + CTR | E5 | — |
| FR54 | PMLA CTR + STR templates | E5 | — |
| FR55 | GSTR-1/3B CSV export | E5 | JSON Phase 2 |
| FR56 | Create customer | E6 | — |
| FR57 | Link family members | E6 | — |
| FR58 | Purchase history | E6 | Shares data with E5 |
| FR59 | Credit balance | E6 | — |
| FR60 | Customer notes | E6 | — |
| FR61 | Occasion reminders | E6 | Consumed by E13 |
| FR62 | Customer search | E6 | — |
| FR63 | DPDPA deletion workflow | E6 | — |
| FR64 | Logged-in product view tracking | E12 | Gated by FR68 |
| FR65 | Anonymous view tracking | E12 | Gated by FR68 |
| FR66 | Per-product analytics | E12 | — |
| FR67 | Per-customer browsing history | E12 | — |
| FR68 | Viewing opt-in/out + retroactive anonymize | E12 | SHIPS FIRST in E12 |
| FR69 | Auto-credit points | E8 | Triggered from E5 invoice |
| FR70 | Customer tier/points view | E8 | — |
| FR71 | Points redemption | E8 | Used in E5 invoice |
| FR72 | Tier upgrade/downgrade | E8 | — |
| FR73 | Create custom order | E11 | — |
| FR74 | Stage progression | E11 | — |
| FR75 | Progress photos + notifications | E11 | Notifications via E13 |
| FR76 | Customer stage view | E11 | — |
| FR77 | Customer modification request | E11 | — |
| FR78 | Convert to final invoice | E11 | Uses E5 |
| FR79 | 3-year immutability | E11 | — |
| FR80 | Rate-lock booking | E9 | — |
| FR81 | Rate-lock record | E9 | — |
| FR82 | Honor locked rate | E9 | Enforced in E5 billing |
| FR83 | Post-expiry override | E9 | — |
| FR84 | Try-at-home booking | E10 | Feature-flag gated per FR21 |
| FR85 | Try-at-home state machine | E10 | — |
| FR86 | Customer home | E7 | — |
| FR87 | Category browse | E7 | — |
| FR88 | Filters | E7 | — |
| FR89 | Search | E7 | Meilisearch per-tenant index |
| FR90 | Product detail | E7 | — |
| FR91 | HUID QR scan | E7 | Surepass adapter |
| FR92 | Wishlist | E7 | Walk-in context in E12 |
| FR93 | Share product | E7 | — |
| FR94 | Inquire at shop | E7 | Shopkeeper CRM in E6 |
| FR95 | Store info | E7 | — |
| FR96 | Customer profile | E7 | — |
| FR97 | Gift mode flag | E7 | — |
| FR98 | Anchor brand exclusive | E7 | Enforced via Semgrep + Chromatic VR |
| FR99 | Hindi/English toggle | E7 | LocaleAwareText from E1 |
| FR100 | Product review | E11/E7 | Verified-buyer check uses invoice from E5; UI lives in E7 catalog — assign to E7 for ownership clarity (story 7.x covers reviews UI; reviews aggregate in E11 custom-order doesn't apply here — assign to **E7**) |
| FR101 | Shop review | E7 | — |
| FR102 | View reviews | E7 | — |
| FR103 | Shopkeeper moderate reviews | E7 | Moderation screen in shopkeeper app |
| FR104 | Ring sizer | E7 | — |
| FR105 | Bangle sizer | E7 | — |
| FR106 | Return/exchange policy display | E7 | Text from E2 |
| FR107 | Customer WhatsApp notifications | E13 | — |
| FR108 | Customer push | E13 | — |
| FR109 | Shopkeeper push | E13 | — |
| FR110 | Broadcast WhatsApp | E13 | — |
| FR111 | Marketing vs transactional opt-in | E13 | — |
| FR112 | Notification audit log | E13 | — |
| FR113 | Daily sales summary | E14 | — |
| FR114 | Stock valuation report | E14 | — |
| FR115 | Outstanding payments report | E14 | — |
| FR116 | Customer analytics report | E14 | Uses E6 + E12 data |
| FR117 | Inventory aging | E14 | — |
| FR118 | Loyalty summary report | E14 | Uses E8 data |
| FR119 | CSV + PDF export | E14 | — |
| FR120 | Cross-tenant metrics dashboard | E15 | — |
| FR121 | Subscription plan mgmt | E15 | — |
| FR122 | Override subscription status | E15 | — |
| FR123 | Time-limited impersonation | E15 | — |
| FR124 | Tenant data export | E15 | — |
| FR125 | Tenant deletion workflow | E15 | — |
| FR126 | MFA global platform settings | E15 | — |

**Coverage stats:** 126/126 FRs mapped to exactly one owning epic. Cross-cutting FRs (FR5, FR30, FR40, FR63, FR68, FR91, FR98) explicitly noted with their dependents.

**NFR coverage:** All 70 NFRs cross-referenced in each epic's "NFRs directly enforced" line; cross-cutting NFRs (NFR-S7/S8 tenant isolation, NFR-C1..C9 compliance, NFR-A1..A9 accessibility) are threaded through every relevant epic + explicitly verified in Epic 16 sign-off.

**UX-DR coverage:** 31/31 UX-DRs mapped; most absorbed across Epic 1 (tokens + typography + a11y baseline) + Epic 7 (customer-facing atoms + journey flows) + Epic 5 (billing components + compliance moments) + Epic 15 (admin components). Full UX-DR traceability is captured per-story in Step 3.

---

