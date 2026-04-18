---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/prfaq-Goldsmith.md
  - _bmad-output/planning-artifacts/prfaq-Goldsmith-distillate.md
  - _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md
  - _bmad-output/planning-artifacts/research/domain-indian-jewelry-retail-research-2026-04-15.md
  - _bmad-output/planning-artifacts/research/market-customer-insights-research-2026-04-16.md
  - CLAUDE.md
  - C:/Alok/Business Projects/Goldsmith/CLAUDE.md
  - C:/Users/alokt/.claude/plans/tingly-weaving-frog.md
  - memory/MEMORY.md (all project + feedback memory files)
workflowType: 'architecture'
project_name: 'Goldsmith'
user_name: 'Alokt'
date: '2026-04-17'
status: 'complete'
completedAt: '2026-04-17'
lastStep: 8
designReference: 'Direction 5 — Hindi-First Editorial (locked 2026-04-17; supersedes Direction C). See _bmad-output/planning-artifacts/design-directions-v2/customer-aspirational/direction-5-hindi-first-editorial/'
positioning: 'North India Hindi-belt traditional jewellers; Ayodhya is anchor location, not theme'
complexity: 'HIGH — multi-tenant white-label + 5 compliance surfaces + weight-precision money + near-real-time 2-app sync + offline-first shopkeeper'
architect: 'Winston (BMAD Architect persona) — facilitating Create Architecture workflow'
---

# Architecture Decision Document — Goldsmith

**Author (facilitator):** Winston (BMAD Architect) · **Author (user):** Alokt
**Date:** 2026-04-17

_This document is the authoritative solution design for Goldsmith. It was produced via BMAD Create Architecture workflow, consuming PRD (126 FRs / 70 NFRs), UX spec (4-tier components + 5 state machines + 6 flows), PRFAQ, Domain + Market research, Implementation-Readiness report, and all prior BMAD decisions committed in memory. Every architectural decision here must trace to one or more FRs/NFRs. Downstream workflows (Create Epics & Stories, Test Design, Dev Story) consume this document as their solution substrate._

> **Design direction update — 2026-04-17:** Direction C (Traditional-Modern Bazaar) is superseded by **Direction 5 — Hindi-First Editorial** (locked by anchor). Aesthetic primitives change; architecture is unaffected. Design tokens ship from `design-directions-v2/customer-aspirational/direction-5-hindi-first-editorial/` and will be extracted into `packages/ui-tokens` during Story 1 execution. Token values in UX spec + epics reflect the prior direction and must be re-sourced from the v2 files at extraction time.

**Positioning guardrail:** North India Hindi-belt traditional jewellery retail + fintech-compliance overlay. Ayodhya is the anchor jeweller's physical location, not the design theme. Architecture module names, example tenants, and sample data MUST generalize to Lucknow, Kanpur, Varanasi, Jaipur, Bhopal, Patna, Delhi-NCR — NOT pilgrim-specific.

_Sections are appended through Winston's step-by-step workflow with A+P elicitation applied at every decision point per the Agency Delivery SOP._

---

## Project Context Analysis

### Requirements Overview

**Functional scope (from PRD — 126 FRs, 16 capability areas):**

| # | Capability Area | FRs | Architectural Implication |
|---|-----------------|-----|---------------------------|
| 1 | Tenant & Multi-Tenancy Management | FR1–7 | Dedicated tenant-provisioning module; RLS-first isolation; tenant lifecycle state machine; per-tenant config + feature-flag store |
| 2 | Authentication & Authorization | FR8–15 | Phone-OTP-primary auth provider; JWT + refresh-token rotation; per-shop RBAC (Owner/Manager/Staff/Accountant); immutable auth audit log |
| 3 | Shopkeeper Self-Service Settings | FR16–24 | Settings service as first-class domain (not afterthought admin panel); inline-save semantics; 30-sec propagation to customer surfaces; settings_audit_log with 5y retention |
| 4 | Inventory Management | FR25–34 | Products service with HUID/purity/weight/metal taxonomy; CSV bulk import; barcode/HUID label rendering; publish/unpublish toggles with sub-30s fanout to customer apps |
| 5 | Pricing & Gold Rate | FR35–40 | Rate service with IBJA primary + Metals.dev fallback + cached-last-known-good + shopkeeper manual override; per-purity rate history (30/90/365d); pricing-calc pure function shared across backend + apps |
| 6 | Billing & Compliance | FR41–55 | Billing aggregate with compliance gateway: GST 3+5, Section 269ST hard-block, PAN Rule 114B hard-block at Rs 2L, PMLA cumulative cash tracking + CTR/STR generation, URD/RCM self-invoice; invoice-level idempotency keys; immutable compliance audit |
| 7 | Customer CRM | FR56–63 | Customers aggregate per shop (phone primary key within tenant); family-link graph; DPDPA-compliant deletion workflow (30d soft → hard, retaining legally-required invoice/KYC with notification) |
| 8 | Customer Viewing Analytics | FR64–68 | Event-sourced view-tracking (both identified + anonymous); opt-in consent state per customer; retroactive anonymization on opt-out; walk-in context aggregation for CustomerContextCard |
| 9 | Loyalty | FR69–72 | Loyalty tier engine: auto-accrual on invoice completion, tier-transition on rolling-12-month total; redemption as invoice line item |
| 10 | Custom Order Tracking | FR73–79 | Custom-order state machine (Quoted→Approved→MetalCast→StonesSet→QC→Ready→Delivered); photo upload + WhatsApp dispatch + push + audit at every transition; modification-request handling; 3y immutability post-completion |
| 11 | Rate-Lock & Try-at-Home | FR80–85 | Rate-lock state machine + deposit escrow via Razorpay; try-at-home state machine (Requested→Confirmed→Dispatched→Returned/Purchased); both feature-flag-gated per tenant |
| 12 | Customer App — Browse & Engage | FR86–99 | Catalog read-path with search + filter; wishlist; inquiry; HUID QR scan (Surepass); white-label theming; Hindi/English persistence |
| 13 | Reviews, Size Guides, Policies | FR100–106 | Verified-in-store-buyer review aggregate (linked to invoice); moderation workflow; size-guide static content; policy text surfaced on every PDP |
| 14 | Notifications & Messaging | FR107–112 | BullMQ-orchestrated notification dispatcher: WhatsApp (AiSensy), SMS (MSG91), push (FCM), email (Resend→SES); broadcast segments; dual transactional/marketing consent; per-tenant quota |
| 15 | Reports & Dashboards | FR113–119 | Read-replica-served reporting queries; CSV + branded-PDF exports; PMLA dashboard with auto-CTR template |
| 16 | Platform Admin | FR120–126 | Admin console (Next.js) with cross-tenant metrics, subscription/plan mgmt, impersonation with time-limit + audit, tenant-delete workflow (30d soft + hard), MFA-gated platform-settings |

**Quality attributes (from PRD — 70 NFRs, 7 categories):**

| Category | NFRs | Architectural Shape |
|----------|------|--------------------|
| Performance (P1–P12) | cold-start ≤ 60s p95 on 4G, billing screen < 1s, API reads < 200ms / writes < 500ms, near-real-time sync < 30s p95, first-load JS ≤ 250 KB, wedding-season 10× sustained | Edge caching, Redis for hot paths, read replicas, SSR/SSG for web catalog, client-side optimistic updates, queue-isolated background jobs, deliberate cold-path vs hot-path split |
| Security (S1–S14) | TLS 1.3, AES-256 at rest, app-layer PII encryption, OTP rate-limit, 15-min access + 30-day refresh token rotation, RBAC at API + RLS at DB (defense-in-depth), tenant-isolation test suite from Sprint 1, external pentest before T2, 5y immutable audit, Secrets Manager, OWASP + CVE scans, VPC-private RDS | Two-layer tenant guard (interceptor + RLS), app-layer envelope encryption for PAN with tenant-scoped KMS keys, rotating secrets via ASM, required CI gates (Semgrep + Snyk + Trivy), private-subnet RDS with bastion/MFA |
| Scalability (SC1–SC8) | 10 tenants MVP → 100 @ M12 → 1000 @ M24; 50K products/10K customers/500 invoices per day per tenant; 10× wedding-season | Single-DB multi-tenant for MVP with sharding trigger + plan defined; horizontal ECS/EKS compute; RDS read replicas; S3 + CDN unbounded; BullMQ with per-tenant partition keys to avoid noisy-neighbour |
| Accessibility (A1–A9) | WCAG 2.1 AA, 4.5:1 contrast, full keyboard nav, ARIA + screen reader, ≥44pt/48dp targets, 200% scaling, Hindi TalkBack, senior-demographic usability | Token-driven design system with HCT-generated accessible palette, Storybook + axe-core + Lighthouse CI gates, `lang=hi|en` on text fragments, LocaleAwareText primitive |
| Integration (I1–I8) | Adapter pattern for every vendor, circuit breaker + fallback (IBJA→Metals.dev→cache), webhook idempotency (Razorpay), per-tenant rate limits (AiSensy), retry w/ exponential backoff | `packages/integrations/*` monorepo layout: each vendor = adapter + contract test + adapter-config; shared Ports definitions in `packages/shared/ports` |
| Reliability (R1–R11) | 99.5% baseline / 99.9% wedding-season; Multi-AZ Mumbai; RTO 4h MVP→1h M12; RPO 1h MVP→15m M12; error budget 0.5%; runbooks for 5 critical paths | Multi-AZ RDS + ElastiCache; BullMQ HA; monitoring on Sentry + CloudWatch; runbooks committed under `docs/runbooks/`; blue/green or rolling ECS deploys |
| Compliance (C1–C9) | BIS/HUID, GST 3+5, Section 269ST, PAN Rule 114B, PMLA, DPDPA (Phase 3 May 2027), data residency AWS Mumbai, vendor DPAs, child data protections | `packages/compliance` shared module with hard-block gates, compliance engine versioned via ADR, 5y immutable audit on WORM S3 or compliance-flagged Postgres partition, data-residency enforced at infra IaC |

### Technical Constraints & Dependencies

**Locked stack (see CLAUDE.md + plan v3):**
- Mobile: React Native (Expo SDK 50+) + NativeWind — shopkeeper + customer apps
- Web: Next.js 14+ App Router + Tailwind + shadcn/ui + 21st.dev component vendoring
- State: Zustand (client) + TanStack Query (server) across both apps
- Forms: React Hook Form + Zod (schemas shared with backend via `packages/shared`)
- Offline (shopkeeper): WatermelonDB + custom sync protocol
- Backend: NestJS (TypeScript) — modular monolith, not microservices, for MVP
- DB: PostgreSQL 15+ with row-level security; ORM: Drizzle
- Cache: Redis (ElastiCache); Queue: BullMQ (Redis); Search: Meilisearch (Hindi-first)
- Storage: S3 (AWS Mumbai ap-south-1) + ImageKit CDN
- Auth: Phone OTP via Supabase Auth (recommended — see ADR-0001)
- Monorepo: Turborepo with pnpm workspaces
- Hosting: AWS Mumbai (ap-south-1) — data residency is a legal requirement (DPDPA + RBI guidance)

**India vendor stack — all via adapter pattern:**
- Rates: IBJA (primary) + Metals.dev (fallback) + cached-last-known-good
- Payments: Razorpay (primary) + Cashfree (secondary)
- WhatsApp BSP: AiSensy (Rs 1,500/mo, unlimited agents)
- SMS/OTP: MSG91
- KYC/eSign: Digio (Phase 4+)
- Maps: Ola Maps
- Push: Firebase Cloud Messaging (free)
- Analytics: PostHog (self-hosted Mumbai for data residency)
- Errors: Sentry (self-hosted Mumbai or residency-aware)
- Support: Zoho Desk (WhatsApp-native)
- Email: Resend (MVP) → Amazon SES at scale
- HUID verification (consumer-facing): Surepass

**Architectural non-negotiables (inherited from CLAUDE.md + PRD):**
1. Every tenant-scoped table has `shop_id` FK + RLS policy; API interceptor injects tenant context; defense-in-depth with two independent layers.
2. Money/weight types are `DECIMAL(10,3)` or `DECIMAL(12,4)` — **NEVER FLOAT/REAL** (paise-level precision validated over 10,000+ synthetic transactions).
3. Compliance is hard-block (not warning): Section 269ST, PAN Rule 114B, GST 3+5, HUID-on-hallmark, PMLA warn@8L/block@10L.
4. White-label: customer-facing surfaces NEVER show "Powered by Goldsmith"; theme via CSS vars (web) + React Context (mobile).
5. Shopkeeper self-service config: platform team NEVER hardcodes per-tenant values; compliance rates are platform-only (not editable).
6. Real-time sync MVP: TanStack Query polling 5–30s; WebSocket/SSE deferred to Phase 3+.
7. Hindi-first, Devanagari fonts; senior-friendly touch targets + typography.
8. Adapter pattern for every vendor — swap = adapter rewrite only.
9. Offline-first shopkeeper app with WatermelonDB + conflict-resolution strategy (pessimistic locks on stock movements; last-writer-wins-with-timestamp on non-stock fields).

**External blockers (commercial, not architecture — but architecture must be resilient to them):**
- Anchor SOW not yet signed (#1 per PRFAQ); architecture must NOT assume anchor-specific shortcuts.
- App-store developer account decision (platform-owned vs per-tenant) — architecture must support both via build-pipeline variants (see ADR-0008).
- Four anchor policy values still open — architecture stores them as shopkeeper-configurable; platform team provides safe defaults until anchor chooses.

### Scale & Complexity

**Complexity: HIGH** (matching PRD classification). Six simultaneous hard problems, not one:

1. **Multi-tenant isolation at zero-leak tolerance** — single-DB RLS + API interceptor + tenant-scoped CDN/S3 prefix + per-tenant secrets + tenant-isolation test suite from Sprint 1.
2. **Five stacked regulatory surfaces** — BIS/HUID, GST, PMLA, DPDPA, Section 269ST/Rule 114B/TCS — each with specific data-capture, retention, reporting obligations; must be encoded as first-class domain in `packages/compliance`, not scattered throughout features.
3. **Weight-precision financial math** — DECIMAL only, validated harness; GST split per metal/making; URD-RCM self-invoice distinct from B2C/B2B.
4. **Two-app near-real-time sync** — shopkeeper writes → customer reads within 30s p95; polling-based MVP with optimistic updates and offline-first reconciliation on shopkeeper side.
5. **White-label + per-tenant branding + shopkeeper self-service config** — everything is themeable/configurable via tenant settings + feature flags; shared-app-with-theming for MVP, per-tenant native apps deferred.
6. **Offline-first shopkeeper app with reconciliation** — WatermelonDB + conflict-resolution policy + visible sync-state UX + queued outbound effects (WhatsApp, push, webhooks).

**Scale indicators:**
- 4 distinct frontends (shopkeeper mobile, customer mobile, customer web, platform admin web) + 1 backend API + 1 worker pool.
- 10 tenants MVP → 100 @ M12 → 1000 @ M24 (architecture must reach the M24 target without schema migrations; just horizontal scaling + sharding readiness).
- 50K products × 10K customers × 500 invoices/day per tenant at steady state.
- 10× wedding-season burst sustained 72 hours (Dhanteras + Akshaya Tritiya weeks).

**Primary technical domain:** full-stack TypeScript monorepo (RN + Next.js + NestJS) over managed AWS infra in Mumbai, with domain-specific compliance/vertical-SaaS overlays.

**Estimated bounded contexts (for downstream module design):** ~14 — Tenant, Auth, Settings, Inventory, Pricing, Billing, Compliance, CRM, ViewingAnalytics, Loyalty, CustomOrder, RateLock, TryAtHome, Notifications, Reviews, Reporting, PlatformAdmin. (Higher than a typical SMB app because compliance + analytics + tenancy are separated from their adjacent feature domains deliberately.)

### Cross-Cutting Concerns Identified

These thread through every bounded context and must be solved once at the architecture level, not per-feature:

1. **Tenant context propagation** — resolve at API gateway (host CNAME / JWT claim / X-Tenant-Id), inject into NestJS request scope, assert at DB layer via `SET LOCAL app.current_shop_id` before every query → RLS enforcement. Covered in ADR-0005.
2. **Compliance gate** — `packages/compliance` interposes on any financially-relevant transition (invoice create, cash receipt, old-gold exchange, scheme payment, PMLA-cumulative update). Pure functions + explicit hard-block API. Covered in Patterns §.
3. **Audit logging** — all compliance-sensitive actions + all settings edits + all admin impersonation events → append-only `audit_events` table with tenant_id, user_id, action_type, subject_id, before/after JSON, timestamp; 5-year retention minimum; replica-read only for operators.
4. **Feature flags + tenant config** — `packages/tenant-config` exposes `useFeature(shopId, featureKey)` + `useSetting(shopId, settingKey)`; values resolve via cached Redis read + DB fallback; changes propagate via TanStack Query refetch on settings-change signal (polled every 5–30s like other data).
5. **Localization (Hindi-first with English toggle)** — locale-aware formatting, Devanagari font loading, `LocaleAwareText` primitive, server-rendered translations where SEO-relevant; ICU messages; form schemas adaptive (PAN uppercase, phone +91, HUID uppercase).
6. **Offline + sync** — only shopkeeper app is offline-first; WatermelonDB schemas must mirror server schemas with tenant_id baked into every record; custom sync adapter with pull-then-push; conflict resolution policy per aggregate (locks for stock, LWW for notes).
7. **Background jobs + scheduled work** — BullMQ queues: `notifications`, `reports`, `compliance`, `integrations`, `sync`; per-tenant partition keys on all jobs to prevent noisy-neighbour; retry w/ exponential backoff; DLQ monitored via Sentry.
8. **Idempotency** — client-generated UUID idempotency keys on invoice creation, payment capture, custom-order stage transitions, webhook handling; server persists (idempotency_key, tenant_id, result_hash) with TTL.
9. **Observability** — structured JSON logs with `tenant_id`, `user_id`, `request_id`, `trace_id` on every entry; OpenTelemetry traces (self-hosted collector in Mumbai); Sentry error + performance; PostHog product analytics (residency-compliant); metrics to CloudWatch; dashboards + alerts for 10 critical paths.
10. **Security baseline** — app-layer PII envelope encryption (PAN) with tenant-scoped KMS keys, TLS 1.3 mandatory, HSTS, OTP rate-limits, session rotation, SAST/DAST in CI, Snyk + Semgrep + Trivy, quarterly secret rotation, annual pentest.
11. **Data residency** — every ap-south-1-hosted resource tagged `data-classification=customer-pii` or `data-classification=tenant-pii`; IaC gates on data-class tags; vendor DPAs required for any processor touching tenant data (AiSensy, Razorpay, IBJA, etc.); PostHog + Sentry self-hosted in Mumbai.
12. **Time & calendar** — every timestamp stored as `timestamptz` UTC; rendered in `Asia/Kolkata` for user-facing UI; per-shop timezone override reserved for Phase 4+ cross-city multi-branch tenants; Hindu calendar support for festival campaign scheduling is a Phase 2 concern (`Notifications` module).
13. **Money + weight primitives** — shared `packages/money` with DECIMAL-backed `MoneyInPaise` (int64) + `Weight` (`grams` DECIMAL(12,4)) + `Karat`/`Purity` enum; compile-time errors for number arithmetic; dedicated rounding-rule helper (paise-down for GST, gram-to-4dp for weight).
14. **Image pipeline** — ImageKit-backed tenant-prefixed paths, pre-signed upload URLs via backend, client-side EXIF stripping for privacy, multi-size rendering (thumb/card/detail/zoom), WebP preferred.

### A+P Synthesis (applied inline per Agency Delivery SOP)

**Advanced Elicitation (5 methods):**
- **A1 First Principles:** The architecture's irreducible purpose is to let the shopkeeper change a setting at 10pm and see the customer app reflect in 30 seconds — _without calling us_. Every architectural choice ladders back to (a) tenant isolation is absolute, (b) compliance is a gate not a feature, (c) state propagation is a product commitment (the 30-sec SLA is architecture, not UX).
- **A2 Pre-mortem:** "This architecture failed in Month 8 because…" — (1) a tenant-isolation bug leaked across shops during wedding season; (2) a weight-precision rounding error compounded to lakhs of discrepancy; (3) vendor lock-in on AiSensy caused a 3-week WhatsApp outage mid-festival; (4) RLS and interceptor disagreed and the DB was authoritative allowing silent cross-tenant reads; (5) the offline-sync conflict policy lost a stock movement. Every failure mode is mapped to an explicit mitigation in §Patterns (Step 5).
- **A3 Stakeholder Round Table:** Rajesh-ji ("system must survive Dhanteras"), Priya ("rate must be accurate and honored"), Vikram ("HUID scan must feel cryptographically trusted"), Platform Admin ("new tenant in < 1 week at M12"), Legal/Compliance ("5y audit immutable, PMLA CTR auto-generated"), Operations ("blast-radius per tenant must be contained").
- **A4 Comparative Analysis Matrix:** multi-tenant strategies scored — single-DB + RLS (chosen) vs schema-per-tenant vs DB-per-tenant — on (a) isolation confidence, (b) operational complexity, (c) cost per tenant, (d) migration effort, (e) noisy-neighbour risk. Single-DB+RLS wins for MVP; sharding trigger documented in ADR-0009.
- **A5 Critique-and-refine:** first draft had "microservices from Day 1" — refined to **modular monolith** (NestJS modules = bounded contexts; extract later only when team/scale forces it). Rationale: team of 5 FTE cannot operate 14-microservice ops layer; deployment complexity kills anchor timeline. Modular monolith preserves optionality: module boundaries are strict, extraction is a refactor not a rewrite.

**Party Mode (Winston + Mary + Murat + John):**
- **Winston (chosen voice — Architect):** Tenant isolation is defense-in-depth (RLS + interceptor, independent failure modes). Compliance is a dedicated package consumed by all feature modules, never inlined. Modular monolith preserves shipping speed; `packages/integrations/*` adapter pattern preserves vendor optionality.
- **Mary (Business Analyst):** Architecture must enable 2nd-tenant-in-3-weeks @ M9 — that means tenant provisioning, theme configuration, feature-flag flipping, DNS CNAME automation, staff invite, CSV inventory import are all API-driven and script-able. Platform-admin console is as first-class as shopkeeper app.
- **Murat (Test Architect):** Four testable contracts are non-negotiable from Sprint 1: (1) tenant-isolation suite (3 tenants, every endpoint asserts zero cross-read), (2) weight-precision harness (10K synthetic transactions), (3) compliance hard-block suite (every NFR-C1..9 has test), (4) offline-sync invariant suite (race conditions, conflict resolution, replay). Real DB (Postgres) not mocks.
- **John (PM):** Anchor must sign off on 5 critical moments (billing 90s, customer browse 60s, HUID verify, rate-update, invoice-share) — architecture commits to p95 targets on each and instruments them in PostHog + Sentry from Sprint 1. Month-6 engagement-pivot trigger requires DAU/WAU/MAU telemetry live on Day 1 of customer app launch.

**Synthesis:** Modular monolith NestJS backend + 4 frontends in Turborepo; single Postgres with RLS + interceptor two-layer guard; BullMQ async; Redis hot path; adapter-pattern vendor packages; dedicated `compliance`, `tenant-config`, `money`, `sync` shared packages; observability + security + data-residency as cross-cutting concerns enforced in CI + IaC; tenant provisioning scripted end-to-end for sub-1-week onboarding.

---

## Starter Template Evaluation

### Primary Technology Domain

**Hybrid full-stack TypeScript monorepo** — four frontends (2× React Native / Expo mobile, 2× Next.js 14 App Router web) + one NestJS backend API + worker pool, orchestrated by Turborepo with pnpm workspaces. Cloud target: AWS Mumbai (ap-south-1).

### Technical Preferences — Status: LOCKED

The technical stack was finalized in the Plan v3 (`C:\Users\alokt\.claude\plans\tingly-weaving-frog.md`) + CLAUDE.md + PRD §7 Project-Type Requirements + PRD §8 Technical Architecture Considerations. These decisions are authoritative inputs to Architecture; this workflow does NOT re-litigate them, only documents them and pins the initialization commands for Epic 1 Story 1.

- **Mobile apps (2):** React Native via Expo SDK 50+ with Expo Router + NativeWind + EAS Build
- **Web apps (2):** Next.js 14+ (App Router) with Tailwind + shadcn/ui vendored + 21st.dev component library for premium patterns
- **State:** Zustand (client) + TanStack Query v5 (server state) — same stack in RN and web for consistency
- **Forms:** React Hook Form + Zod (schemas shared across frontend + backend via `packages/shared`)
- **Offline (shopkeeper only):** WatermelonDB with custom sync adapter to backend
- **Backend:** NestJS (modular monolith) with Express underlying + class-validator + class-transformer
- **Database:** PostgreSQL 15+ (AWS RDS ap-south-1 Multi-AZ)
- **ORM:** Drizzle ORM + drizzle-kit migrations; RLS policies hand-written in SQL migrations
- **Cache:** Redis (AWS ElastiCache)
- **Queue:** BullMQ (Redis-backed) — NestJS BullMQ module
- **Search:** Meilisearch 1.5+ (self-hosted on ECS, Mumbai) with Hindi + Devanagari tokenization
- **File storage:** S3 (ap-south-1) + ImageKit CDN
- **Auth:** Phone OTP via Supabase Auth (Mumbai-hosted) — primary recommendation; see ADR-0001 for rationale vs Firebase Auth
- **Monorepo:** Turborepo + pnpm workspaces
- **IaC:** Terraform (or AWS CDK TypeScript) — infra-as-code committed to repo
- **CI/CD:** GitHub Actions + Expo EAS for mobile builds
- **Web hosting:** AWS (ECS Fargate behind ALB + CloudFront) — NOT Vercel, because data-residency + tenant-isolation on custom domains is cleaner with CloudFront + per-tenant CNAME + origin in ap-south-1

### Why no off-the-shelf starter covers this

Evaluated categories:

| Category | Candidates | Verdict |
|----------|-----------|---------|
| T3 Turbo (create-t3-turbo) | tRPC + Next.js + Expo + Prisma | Closest match architecturally, but tRPC is not a fit because we need openapi-typed REST for third-party integrations (Razorpay webhooks, IBJA polling) and because the mobile app must work offline with WatermelonDB sync over HTTP |
| `create-expo-stack` / `expo-router-template` | Expo + Tamagui | Mobile-only; doesn't solve backend or web |
| `create-next-app` | Web-only | Single-app only |
| `nestjs/typescript-starter` | Backend-only | Single-app only |
| `ts-rest` / OpenAPI-generator templates | Contract-first | Useful pattern (consume later); not a starter |
| `turbo/examples/with-tailwind` + manual assembly | Turborepo official examples | Most aligned — use as skeleton + compose custom |
| Agency scaffold (`C:/Alok/Business Projects/agency-templates/`) | BMAD + Superpowers + Enterprise floor | Primary source — per Agency Delivery Protocol in CLAUDE.md, `/new-greenfield-project` scaffolds this repo from agency-templates; architecture builds on top of that scaffold |

**Conclusion:** No single public starter covers (a) RN Expo mobile × 2 + (b) Next.js web × 2 + (c) NestJS API + (d) Drizzle + (e) WatermelonDB sync + (f) multi-tenant RLS + (g) Indian-vendor adapter packages + (h) compliance package, all under Turborepo with the agency's enterprise floor. Using a public starter would force either (1) heavy deletion/rework or (2) lock-in to patterns incompatible with our requirements (tRPC, Vercel, Prisma).

### Selected Starter Strategy

**Compose from the agency's own greenfield template + Turborepo official examples.** The scaffold comes from `/new-greenfield-project` which materializes from `C:/Alok/Business Projects/agency-templates/` and brings the enterprise floor (ship.yml CI, Sentry, OTel, GrowthBook flags, Storybook, ADR template, threat model, runbook, Semgrep + axe + Lighthouse CI). We then add the Goldsmith-specific packages and apps per the monorepo structure in §Project Structure.

**Rationale:**
1. Agency template already enforces the 5-layer review gate + Codex CLI + TypeScript strict + coverage ≥ 80% gate → zero work.
2. Turborepo `with-tailwind` + `with-prisma` examples show the ergonomic pnpm workspace + Turbo pipeline patterns we'll mirror (pipeline names, cache keys).
3. We own the entire stack and can pin versions deliberately — no upstream starter drift to chase.
4. All four apps can scaffold with their native CLIs (Expo, create-next-app, nestjs new) into the monorepo — initialization is a script, not a template to fork.

### Initialization Sequence (Epic 1 Story 1)

Execute in this order inside the repo root:

```bash
# 0. Greenfield scaffold (agency template — already produces the monorepo skeleton + enterprise floor)
#    This step was run by /new-greenfield-project prior to architecture; if not yet run, do it first.

# 1. Initialize root with pnpm + turbo
corepack enable
corepack use pnpm@latest
pnpm init
pnpm add -w -D turbo@latest typescript@5 @types/node tsx

# Create pnpm-workspace.yaml with apps/* and packages/*
# Create turbo.json with build/lint/test/typecheck pipelines

# 2. Backend API (NestJS)
pnpm create nest-app apps/api --strict --package-manager pnpm
# Then add: drizzle-orm drizzle-kit pg, bullmq ioredis, @nestjs/bullmq, class-validator class-transformer

# 3. Shopkeeper mobile (Expo + Expo Router + NativeWind)
pnpm create expo apps/shopkeeper --template tabs --yes
cd apps/shopkeeper
pnpm add nativewind tailwindcss @tanstack/react-query zustand react-hook-form zod @nozbe/watermelondb
cd ../..

# 4. Customer mobile (Expo — white-labeled)
pnpm create expo apps/customer --template tabs --yes
cd apps/customer
pnpm add nativewind tailwindcss @tanstack/react-query zustand react-hook-form zod
cd ../..

# 5. Customer web (Next.js 14 App Router)
pnpm create next-app apps/web --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --no-git --use-pnpm
cd apps/web
pnpm dlx shadcn@latest init -d
pnpm add next-intl @tanstack/react-query zustand react-hook-form zod
cd ../..

# 6. Platform admin (Next.js 14 App Router)
pnpm create next-app apps/admin --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --no-git --use-pnpm
cd apps/admin && pnpm dlx shadcn@latest init -d && cd ../..

# 7. Scaffold shared packages
mkdir -p packages/{shared,ui-mobile,ui-web,db,tenant-config,compliance,money,integrations,sync,observability,testing}
# Each package: pnpm init, tsconfig.json extends root base, package.json "type":"module", exports map

# 8. Wire Turborepo pipelines (turbo.json) — dev, build, lint, typecheck, test, test:tenant-isolation, test:weight-precision, e2e

# 9. Root-level CI scaffolding ships from greenfield template (ship.yml already present)
# 10. Commit and open first PR — Epic 1 Story 1 is this initialization
```

### Architectural Decisions Provided by the Starter

- **Language & runtime:** TypeScript 5+ `strict: true` + `noUncheckedIndexedAccess: true`; Node 20 LTS; ESM modules; shared `tsconfig.base.json` at root.
- **Styling:** Tailwind CSS + shadcn/ui on web; NativeWind (Tailwind-for-RN) on mobile; design tokens defined once in `packages/ui-tokens` and consumed by both.
- **Build tooling:** Turborepo remote cache (enable once team > 1 dev); individual apps use Metro (RN), Next.js built-in (webpack/turbopack), and SWC (NestJS).
- **Testing frameworks:** Vitest for unit (all TS packages + Next.js); Jest for NestJS (follows NestJS convention); Detox for RN E2E; Playwright for web E2E; k6 for load.
- **Lint/format:** ESLint flat config (eslint.config.js) at root with per-app overrides; Prettier; Husky + lint-staged for pre-commit.
- **Code organization:** Feature-oriented modules inside apps; DDD-aligned bounded contexts inside `apps/api/src/modules/*`; cross-app logic strictly in `packages/*`.
- **State management:** Zustand + TanStack Query v5 in every frontend; React Hook Form + Zod for forms.
- **API layering:** REST with OpenAPI 3.1 contract — generated via `@nestjs/swagger`; typed client + Zod schema sync via `ts-rest` or custom generator committed to `packages/api-client`.
- **Routing:** Expo Router v3 (file-based) for mobile; Next.js App Router for web.
- **Environment config:** `.env` per app, validated at boot with Zod schema; secrets resolved from AWS Secrets Manager in production, `.env.local` in dev (gitignored).
- **DX features:** `turbo dev` runs all apps in parallel; hot reload everywhere; typechecked monorepo on every save; Storybook for `packages/ui-web` + `packages/ui-mobile`.

**Note:** Monorepo initialization + enterprise floor is Epic 1 Story 1 (the infra/scaffolding story that IR flagged as non-optional for greenfield projects). Every subsequent app/package is added per-epic as its features require — no big-bang migration story.

### A+P Synthesis

- **A1 First Principles:** The monorepo exists to make the 2nd–10th jeweller onboarding cheap — shared schemas, shared compliance logic, shared theming. A polyglot or poly-repo arrangement would negate that. TypeScript everywhere + Turborepo is the economic decision.
- **A2 Tree of Thoughts:** evaluated (a) microservices-from-Day-1, (b) modular monolith, (c) BFF-per-app + shared-core. (b) wins for MVP; (a) defers until team size + independent-deploy pressure justifies; (c) considered for Phase 4+ if customer and shopkeeper apps diverge significantly.
- **A3 Comparative Matrix:** Turborepo vs Nx vs Moonrepo — Turborepo wins on simplicity + Vercel-proven patterns + remote-cache story; Nx is heavier than we need; Moonrepo is promising but less mature for RN integration.
- **A4 Critique-and-refine:** first draft considered Yarn Berry workspaces; switched to pnpm because (i) symlink-based node_modules works well with Metro/RN, (ii) disk efficiency matters for CI cache, (iii) workspace protocol is the de-facto standard.
- **A5 Lessons Learned:** Marg/Tally/Omunim failed on operational complexity — we will NOT reproduce it. Modular monolith + one Postgres + one Redis + one worker pool = operable by 0.5 DevOps FTE for anchor phase.

- **P Party Mode:**
  - **Winston (Architect):** Turborepo + pnpm + modular monolith is the decision.
  - **Amelia (Dev):** Exact CLI commands committed in architecture doc + Epic 1 Story 1 so Dev Story agent has a recipe to follow without re-deriving.
  - **Murat (Test Architect):** `test:tenant-isolation` and `test:weight-precision` pipelines MUST be Turbo tasks from Day 1 (not an afterthought); first CI run asserts they exist and pass.
  - **John (PM):** Epic 1 Story 1 is explicitly the scaffolding story — framed as "Shop Owner can reach a dashboard page" end-to-end, not "set up the monorepo" (PM framing discipline from IR report §5).

**Synthesis:** Compose the greenfield scaffold from `agency-templates/` + Turborepo `with-tailwind` pattern; add apps (4) and packages (~11) via native CLIs; pin TypeScript strict + coverage ≥ 80% + enterprise-floor CI gates from Epic 1 Story 1. This is the starter — not a fork of someone else's.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (block implementation):**
1. Multi-tenant isolation pattern (single-DB RLS + interceptor) — ADR-0002
2. Auth provider + OTP flow (Supabase Auth Mumbai) — ADR-0001
3. Money/weight primitive types + rounding (DECIMAL-only `Money`/`Weight` in `packages/money`) — ADR-0003
4. Offline-sync protocol + conflict resolution (WatermelonDB + pull-then-push + per-aggregate policy) — ADR-0004
5. Vendor-adapter contract + port definition (`packages/integrations/*`) — ADR-0006
6. Near-real-time sync approach (TanStack Query polling + server-side update cursor) — ADR-0007
7. White-label theming delivery (shared app + tenant theme context, per-tenant native apps deferred) — ADR-0008
8. Compliance hard-block gateway (stateless gates in `packages/compliance`) — ADR-0011
9. Tenant provisioning + lifecycle state machine — ADR-0010
10. Monorepo module boundaries + package layout — ADR-0009

**Important (shape architecture):**
- Image pipeline (ImageKit + tenant prefixes + pre-signed uploads)
- Search (Meilisearch Hindi tokenizer, per-tenant index OR one index with tenant filter)
- Observability baseline (Sentry + OTel + PostHog self-hosted)
- CI/CD pipeline specifics (GitHub Actions + EAS + Terraform apply)
- RBAC enforcement layer placement (NestJS guards + Casbin-style policies in DB)
- Feature-flag engine (GrowthBook OSS self-hosted)
- Error-budget + SLO monitoring tooling

**Deferred (post-MVP):**
- Sharding strategy (documented as ADR with trigger conditions; not implemented)
- WebSocket/SSE real-time replacement for polling — Phase 3+
- Cross-region DR to ap-south-2 Hyderabad — Phase 4+
- Per-tenant native iOS/Android app builds — Phase 4+
- Tenant-per-schema or tenant-per-DB migration path
- GraphQL layer for Phase 4+ complex client queries
- Event sourcing for audit (event log is append-only now; not full ES)

---

### Data Architecture

**D1 · Database engine: PostgreSQL 15 (AWS RDS Mumbai Multi-AZ).**
- Rationale: RLS is native and mature; DECIMAL precision is authoritative; foreign keys + strict constraints; rich index types; battle-tested vertical scaling on AWS; JSONB for flexible tenant-config; full-text search as fallback to Meilisearch; cost-effective at our scale for the foreseeable horizon.
- Version: 15.x (latest minor patch at provisioning time). Upgrade path: 16→17 evaluated at Month 12 per AWS RDS support.
- Configured with `pg_stat_statements`, `pgaudit` (compliance logging), `pg_cron` for scheduled maintenance.

**D2 · ORM: Drizzle ORM (latest) + drizzle-kit migrations.**
- Rationale: TypeScript-first schema (no code-gen surprises), compiled-to-SQL queries (no query runtime), explicit SQL for RLS policies in migrations, lightweight (unlike Prisma), and Drizzle's relational-queries API is sufficient for our reads.
- Rejected alternatives: Prisma (heavy runtime + mediocre raw-SQL ergonomics + binary engine friction), TypeORM (legacy), Kysely (too low-level — we want a schema layer, not a query builder).

**D3 · Multi-tenant isolation: Single-database, row-level security (RLS) + NestJS tenant interceptor (defense-in-depth).**
- **Schema rule:** Every tenant-scoped table has a non-nullable `shop_id UUID REFERENCES shops(id)` column and an RLS policy `USING (shop_id = current_setting('app.current_shop_id')::uuid)`. Platform-global tables (feature_flags_defaults, compliance_rules_versions, ibja_rate_snapshots) do NOT have `shop_id` and are readable by all tenants as platform reference data.
- **Runtime enforcement:** NestJS `TenantInterceptor` resolves tenant from (host CNAME → X-Tenant-Id → JWT claim — in that priority) and sets request-scoped `TenantContext`. The Drizzle `db` provider wraps every transaction with `SET LOCAL app.current_shop_id = '<uuid>'` before any query runs. Platform-admin queries execute with a distinct `PlatformContext` that switches to the `platform_admin` Postgres role (which bypasses RLS with `SECURITY DEFINER` function access, audit-logged).
- **Why two layers:** If the interceptor fails (code bug, direct DB access), RLS refuses the query. If RLS is misconfigured (migration bug), the interceptor refuses the query. Failure modes are independent.
- **Tenant isolation test suite:** `packages/testing/tenant-isolation` provides a harness that (a) provisions 3 tenants with distinct data, (b) calls every API endpoint with tenant A's JWT, (c) asserts NO data from B or C is ever returned, (d) also asserts direct DB reads without `SET LOCAL` throw, (e) runs on every CI run + blocks merges on any cross-tenant leak. Ships with Epic 1.

**D4 · Data modeling approach: Domain-driven, normalized 3NF with pragmatic denormalization for read-heavy aggregates.**
- Normalized tables for transactional integrity (invoices, invoice_items, customers, products, stock_movements).
- Denormalized read models (e.g., `customer_analytics_summary`, `product_hot_scores`) refreshed by BullMQ jobs on transactional triggers — keeps hot-read p95 < 200ms without inflating write amplification.
- Append-only tables for compliance (`compliance_audit_events`, `pmla_cash_aggregates`) — no UPDATE, no DELETE; use INSERT + versioning pattern.
- JSONB for loosely-structured tenant-configurable fields (`shop_settings.feature_flags`, `shop_settings.theme_config`, `product.stone_details`) — with Zod schema validation at the API layer.

**D5 · Data validation: Zod schemas shared across frontend + backend + WatermelonDB.**
- `packages/shared/schemas` exports one Zod schema per domain entity. Backend parses every inbound DTO through it. Frontend forms use the same schema via `@hookform/resolvers/zod`. WatermelonDB record classes derive types from the same schemas.
- Backend Drizzle tables are defined in TypeScript (`packages/db/schema`) with `drizzle-zod` generating the corresponding Zod types for runtime validation.
- Never trust client data — validate at the edge (controller), then again at the aggregate-root constructor (double-guard for commands that cross multiple endpoints).

**D6 · Migration approach: Drizzle-kit-generated SQL migrations, hand-edited for RLS + constraints + indexes, committed to repo, forward-only in production.**
- Local dev: `drizzle-kit generate`, commit the generated SQL, PR reviewed.
- Production: `drizzle-kit migrate` gated behind a deployment approval step in GitHub Actions (requires Platform Admin + Code Reviewer sign-off for any migration touching `shop_id`, RLS, or compliance tables).
- **Zero-downtime rule:** Every migration must be backward-compatible with the prior API version (expand-then-contract pattern). Breaking changes require a two-deploy sequence.
- **Rollback:** Forward-only migrations + a manual `down` SQL file per migration for emergency rollback during the same deploy window; point-in-time recovery beyond that (RPO 1h).

**D7 · Caching strategy: Redis (ElastiCache) with three distinct patterns.**
- **Rate cache** (IBJA/Metals.dev responses): Per-purity key with 15-minute TTL; write-through on successful API call; serve-stale-on-error with freshness timestamp + "stale" flag.
- **Tenant config cache**: `shop:{shop_id}:settings` with 60s TTL; invalidated via Redis pub/sub on settings update; fallback to DB on miss.
- **Session cache**: Supabase Auth's tokens are stateless JWTs (no cache); refresh-token rotation state + blacklist in Redis with TTL matching expiry.
- **No cache for compliance data** — invoices, PMLA aggregates, audit logs must be authoritative-read every time.
- **Noisy-neighbour protection**: Redis keys are tenant-prefixed (`shop:{id}:`); per-tenant rate limits evaluated via Redis INCR + TTL.

**D8 · Weight + money types: `DECIMAL` everywhere; primitive wrappers in `packages/money`.**
- **Money:** `MoneyInPaise` = `bigint` in TS (pre-multiplied by 100); DB column `amount_paise BIGINT NOT NULL`; never floats; rounding down to paise on GST split, half-up on display.
- **Weight:** `Weight` = `DECIMAL(12,4)` grams; TS wrapper uses `decimal.js` for all arithmetic; never number.
- **Purity:** `Purity` = enum (`GOLD_24K` | `GOLD_22K` | `GOLD_20K` | `GOLD_18K` | `GOLD_14K` | `SILVER_999` | `SILVER_925` etc.); stored as TEXT with CHECK constraint.
- **Tax:** `GST_METAL_RATE_BP` = `300` basis points (3.00%); `GST_MAKING_RATE_BP` = `500` basis points (5.00%); constants in `packages/compliance`.
- **10K-transaction harness:** `packages/testing/weight-precision` runs synthetic transactions across a 10,000-invoice sample spanning all purities + making combinations + GST splits; asserts every total paise-exact. Blocks CI on failure.

**D9 · Soft-delete + retention policies.**
- Soft-delete via `deleted_at TIMESTAMPTZ` column on customer, product, shop_user, review tables; compliance-sensitive tables (invoice, audit_events, custom_order post-completion) are NEVER soft-deletable.
- DPDPA deletion workflow: customer deletion request → CRM soft-delete immediate → scheduled hard-delete at day 30 → retain legally-required invoice + KYC + HUID records with customer-notification email per DPDPA Sec 9.
- Tenant termination: 30-day soft-suspended → hard-delete per tenant-off-boarding runbook; export bundle (invoices, customers, inventory, custom orders, reviews) provided before hard-delete.

---

### Authentication & Security

**S1 · Auth provider: Supabase Auth (self-hosted or cloud, Mumbai region) — Phone OTP primary.** (See ADR-0001.)
- Rationale: Production-ready phone-OTP flow with WhatsApp-provider pluggability (can use AiSensy for OTP later); explicit multi-tenant-aware user metadata; JWT issuance with custom claims; MFA support for platform admin roles; integrates cleanly with PostgreSQL RLS (we already use Postgres; Supabase Auth ships with `auth.users` table and helper functions).
- Phone OTP via MSG91 for customers (SMS cost) and Supabase's built-in (for shopkeeper + platform admin) with MSG91 as backup delivery channel.
- Rejected: Firebase Auth (Google cloud lock-in, data-residency concerns for Mumbai), Cognito (complex, poor DX), build-our-own (too risky — token rotation + OTP rate-limit + recovery are not commodity problems).
- **Contingency:** Supabase Auth is consumed via `packages/integrations/auth/supabase-auth-adapter` implementing the `AuthPort` interface; switching providers requires adapter-swap only.

**S2 · JWT structure + rotation.**
- **Access token:** 15-minute expiry; signed RS256; claims: `sub` (user_id), `shop_id` (current tenant if shopkeeper/staff; null if platform admin), `role`, `aud` (app: shopkeeper|customer|admin|api), `iat`, `exp`, `jti`.
- **Refresh token:** 30-day expiry; single-use (rotate on every use); persisted to Redis `refresh:{jti}` with sliding TTL; revoke on logout or password change.
- **Customer JWT scope:** Customer can access multiple tenants (Priya shops at 3 different jewellers). JWT has no `shop_id` but each request specifies `X-Tenant-Id`; server verifies the customer has an active `customer_tenant_link` record for that shop; otherwise 403.

**S3 · Authorization layers (defense-in-depth).**
- **Layer 1 (edge) — NestJS `TenantGuard`** — verifies X-Tenant-Id/host/CNAME resolves to a valid tenant and user is entitled.
- **Layer 2 (controller) — NestJS `RoleGuard` + `@Roles(...)` decorator** — checks user role is in allowed set for the route.
- **Layer 3 (service) — Permission policies via `@Policy('inventory.edit')`** — fine-grained action check against per-shop role-permissions matrix stored in `role_permissions` table (configurable per tenant per FR13).
- **Layer 4 (DB) — RLS policy** — SQL enforces shop_id scoping.

**S4 · PII encryption at application layer (envelope encryption).**
- **Fields encrypted:** PAN, Form 60 payload, any Aadhaar digits if ever captured (not in MVP), KYC documents' S3 object metadata, bank account numbers (when scheme payments ship).
- **Scheme:** AWS KMS root key (regional ap-south-1, CMK per tenant created at tenant-provision time) → per-record data key (AES-256-GCM) → ciphertext stored in DB; data key wrapped by tenant CMK.
- **Rationale:** RDS encryption-at-rest protects against storage theft; app-layer envelope protects against privileged DB access + provides tenant-level crypto-shredding on tenant deletion (delete tenant CMK → all that tenant's PAN is unrecoverable).
- **Implementation:** `packages/security/envelope` with `encryptPII(shopId, plaintext): Ciphertext` and `decryptPII(shopId, ciphertext): plaintext` — only accessible from authorized services.

**S5 · Rate limiting + abuse prevention.**
- **Per-user API rate limit**: 100 requests/min (authenticated), 20/min per IP (unauthenticated) — enforced at NestJS via `@nestjs/throttler` backed by Redis.
- **OTP send rate limit**: Per phone number: 5 sends / 15 min; per IP: 30 sends / 15 min; block after 10 failed OTP verifies per phone.
- **Per-tenant quota**: WhatsApp send quota enforced at AiSensy adapter (per-tenant daily cap from `shop_settings`); BullMQ job-enqueue throttled per tenant to prevent one shop flooding the queue.
- **Adaptive**: Suspicious pattern detection (burst of failed logins → temporary tenant-scoped lockout) emits Sentry alert + PostHog event.

**S6 · Audit logging (immutable, 5-year retention).**
- Single `audit_events` table with partitioning by `created_at` month; daily S3 export to WORM-bucket (object-lock enabled) for compliance; replication to `audit_events_readonly` replica DB for operator queries.
- Events: auth (login/logout/role-change/access-revoke), compliance (invoice-create, cash-override, PAN-capture, HUID-entry, CTR-trigger, STR-trigger), admin (impersonation-start/end, setting-change, plan-change, tenant-create/suspend/terminate, data-export, data-delete).
- Structure: `id, tenant_id, user_id, session_id, event_type, subject_type, subject_id, action, before_json, after_json, request_id, ip_address, user_agent, created_at`.
- **Never edit** — enforced at DB (RLS denies UPDATE/DELETE for `app_user` role; only platform-write-only role can INSERT).

**S7 · Secrets management: AWS Secrets Manager + per-environment + per-tenant.**
- Platform secrets (database URL, IBJA key, Razorpay key, AiSensy key) stored under `/goldsmith/{env}/platform/*`.
- Per-tenant secrets (tenant-scoped Razorpay sub-merchant keys if/when we use Route; tenant-specific AiSensy template IDs) stored under `/goldsmith/{env}/tenants/{shop_id}/*`.
- Quarterly rotation enforced via scheduled task + runbook.
- `packages/security/secrets` provides `getSecret(path)` with in-memory cache (60s TTL) + forced-refresh on SIGUSR2.

**S8 · Transport security.**
- TLS 1.3 mandatory; HSTS on every web domain with `max-age=63072000; includeSubDomains; preload`; custom CNAMEs terminated at CloudFront with ACM certs auto-rotated; ACM PKI for internal ALB→Fargate.
- HTTP 3 (QUIC) enabled on CloudFront for customer-web perf; falls back to H/2 cleanly.
- Strict CSP (no `unsafe-inline`, nonce-based script allow-list) on all web apps.

**S9 · Security CI gates.**
- Semgrep ruleset (OWASP + custom rules for `shop_id` + `DECIMAL` + compliance invariants) runs on every PR.
- Snyk dependency scan — critical/high CVE blocks merge.
- Trivy container scan on every image before ECR push.
- `npm audit --production` in CI; no known vulnerabilities in shipped prod deps.
- **DAST**: quarterly manual pentest (external firm) + ZAP baseline scan on every release to staging.

---

### API & Communication Patterns

**A1 · API style: REST + OpenAPI 3.1.**
- NestJS controllers generate OpenAPI via `@nestjs/swagger`; contract published at `/api/docs/v1/openapi.json`.
- Typed client auto-generated via `openapi-typescript` + custom zod-aware wrapper committed to `packages/api-client`; every frontend consumes this typed client.
- **Why REST over GraphQL/tRPC:** Third-party integrations (Razorpay webhooks, IBJA, AiSensy outbound) are REST; shared contract language across internal + external is valuable; offline-sync protocol needs stable versioned endpoints; GraphQL's pagination/cache complexity is not worth it at our data shape; tRPC's type-only contract excludes third parties.
- Versioning: URI-based (`/api/v1/...`); v2 introduced only when breaking change necessary; v1 supported for 12 months post-v2.

**A2 · Error handling standard.**
- All errors return `application/problem+json` per RFC 7807 with additional fields: `tenantId`, `requestId`, `errorCode` (namespaced, e.g., `compliance.pan.required`, `billing.cash_cap_exceeded`).
- NestJS `GlobalExceptionFilter` catches all; maps known errors to typed `HttpException` subclasses in `packages/shared/errors`.
- Client wrapper throws typed errors; forms display Hindi-localized message from error code → message catalog in `packages/shared/i18n`.
- Never leak internal stack traces; log to Sentry with full context server-side.

**A3 · Idempotency contract.**
- Every write endpoint accepts `Idempotency-Key` header (client-generated UUID); server persists `(key, tenant_id, request_hash, response_payload, created_at)` with 24h TTL; duplicate key returns cached response.
- Critical writes (invoice creation, payment capture, custom-order-stage-advance, deposit, refund) require the header (rejected without one).
- Non-critical writes (wishlist add, settings edit) accept header optionally.

**A4 · Webhook handling.**
- All inbound webhooks (Razorpay payment, AiSensy delivery receipt, IBJA rate push if subscribed, Supabase auth-event) hit `/api/v1/webhooks/:provider` with provider-specific signature verification.
- Verify signature → idempotency check (using provider-supplied event ID) → enqueue BullMQ job → return 200 immediately. Actual processing async.
- Retries handled by provider per their spec; our idempotency layer safely dedupes.
- Audit-log every webhook event.

**A5 · Rate-limiting headers.**
- Standard headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- 429 with `Retry-After` on exceed.

**A6 · Offline-sync protocol (shopkeeper app).**
- **Pull phase:** Client sends last-seen server cursor `GET /api/v1/sync/pull?cursor={seq}&table={name}` → server returns changes since `seq` (insert/update/delete rows), capped at 500 records per table per request, with next cursor.
- **Push phase:** Client POSTs `{changes: [{op, table, record, client_timestamp, client_device_id}...]}` with idempotency key per batch.
- **Conflict resolution:**
  - Stock movements: **pessimistic lock** — if client's stock movement conflicts with server's (negative balance), server REJECTS the push and returns a conflict record; client surfaces a "stock already sold, review" UX.
  - Customer notes, settings: **last-writer-wins** by `server_updated_at`.
  - Invoices: **accept all** (every invoice has a client-generated idempotency key; server always accepts; duplicates dedupe); compliance pre-checks re-run server-side — if server finds PAN missing for ≥ Rs 2L, it marks the invoice `FLAGGED` and alerts shopkeeper.
- **Cursor**: monotonic BIGINT `seq` per-tenant (via dedicated sequence) — simpler than timestamps for cross-request ordering.
- **Delta-only** (no full-table resend); row-level permissions enforced at pull (RLS already does this + sync endpoint adds table-allow-list check).
- Documented in detail in ADR-0004.

**A7 · Near-real-time sync for customer app (MVP polling).**
- `TanStack Query refetchInterval: 5 * 1000` (5s) for hot paths (product availability, rate display); `30 * 1000` (30s) for medium-hot (wishlist, custom-order status); `60 * 1000` for cold (category counts, review counts).
- Server returns `Last-Modified` and `ETag`; client sends `If-None-Match` → 304 avoids payload transfer.
- **Long-poll for critical paths (Phase 2):** custom-order stage updates and rate-lock status can upgrade to long-poll (HTTP hang for up to 25s awaiting change) if polling cost becomes material.
- WebSocket/SSE deferred to Phase 3+ (ADR-0007).

**A8 · Search API.**
- Meilisearch for Hindi + English fuzzy search across products, customers (shopkeeper-only), shops (customer catalog).
- Per-tenant index namespace: `shop_{shop_id}_products`, `shop_{shop_id}_customers`. At 1000-tenant scale, evaluate shared-index-with-tenant-filter (Meilisearch supports); MVP uses per-tenant for clean data isolation.
- Sync via BullMQ `search-indexer` job triggered on entity write; full re-index on schema change (rare).
- Fallback to Postgres full-text search (`pg_trgm` + `unaccent`) if Meilisearch unavailable; noted in runbook.

**A9 · GraphQL layer: deferred to Phase 4+.**
- Considered for platform admin's cross-tenant aggregations; not needed at MVP scale.
- When added, it will be BFF-style (single endpoint, federated across modules); REST remains primary for integrations.

---

### Frontend Architecture

**F1 · State management: Zustand (client) + TanStack Query v5 (server).**
- Zustand for ephemeral UI state + cross-screen local state (current tenant theme, offline indicator, billing-screen draft, filter selections).
- TanStack Query for all server-derived state — cache, refetch, optimistic updates, infinite queries.
- React Context: reserved for theme (white-label per-tenant), auth session, feature flags — NEVER for server state.

**F2 · Component architecture: 4-tier (Tier 0 primitives → Tier 1 composed → Tier 2 domain atoms → Tier 3 business → Tier 4 screens).**
- Matches UX spec §Component Strategy. Tier 0 vendored from shadcn/ui (web) + custom RN primitives (mobile); Tier 1–4 authored in `packages/ui-web` and `packages/ui-mobile` + per-app-specific Tier 4 screens.
- Strict import direction: screens → business → domain atoms → composed → primitives. Lint rule enforces this.
- Storybook for `packages/ui-web` + `packages/ui-mobile` with Hindi + English + 2-tenant-theme stories per component.

**F3 · Routing: Expo Router v3 (mobile) + Next.js App Router (web).**
- File-based routing on both; layouts handle tenant-theming + auth guards at layout level.
- Deep-links: customer mobile supports `goldsmith://<tenant-domain>/product/{id}`; web supports canonical `https://<tenant-domain>/product/{id}` with `<link rel="alternate" ...>` to the mobile app deep-link.
- Route-based code splitting on both (Next.js by default; Expo Router via dynamic imports + Hermes codegen).

**F4 · White-label theming implementation.**
- **Tokens:** `packages/ui-tokens` exports the token schema; `packages/ui-theme` exports the resolver that accepts `ThemeConfig` (anchor-tenant has one, 2nd-tenant has another, etc.) and produces a resolved token object.
- **Web:** CSS custom properties at `:root` populated per-request (SSR) from tenant config; Tailwind reads them via `@layer` and custom CSS-variable-aware utility classes; shadcn components theme via CSS vars natively.
- **Mobile:** React Context `<ThemeProvider value={resolvedTokens}>` at app root; NativeWind classes read tokens via `nativewind.config.ts` + runtime theme resolver.
- **HCT palette generation:** seed color from tenant config → HCT algorithm produces the 50-950 scale → WCAG AA gate rejects seeds that fail contrast; admin console surfaces this at tenant-provisioning time. Library: `@material/material-color-utilities`.
- **Per-tenant feature flags:** `useFeature('try_at_home')` reads from `ShopSettingsContext` (hydrated at app boot, updated via TanStack Query on settings change).
- **Platform brand invisibility:** eslint rule forbids importing `@/assets/platform-*` in `apps/customer/**` and `apps/web/**`; CI visual-regression asserts no platform-brand presence.

**F5 · Performance + bundle budgets.**
- Customer web first-load JS gzipped ≤ 250 KB (NFR-P8) — enforced via `next-bundle-analyzer` + CI gate.
- Customer mobile cold-start p95 ≤ 60s on 4G — Hermes enabled, Expo Updates for OTA hotfixes, asset lazy-load, font subsetting (Devanagari + Latin subsets).
- Next.js: SSG for catalog + product-detail landing (SEO), SSR for authenticated views, ISR with 60s revalidate for rate-sensitive pages.
- Images: ImageKit URL transforms for on-the-fly sizing + WebP/AVIF; responsive `srcset` + `sizes`.
- Lighthouse CI gates: Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 80.

**F6 · Form patterns: React Hook Form + Zod resolvers + shared schemas.**
- Pattern per surface matches UX spec §Form Patterns (save-on-change for settings; submit-at-end for billing; multi-step for onboarding).
- Every form field labeled, ARIA-described, inline-validated; error messages localized via `@/i18n/errors`.

**F7 · Offline UX (shopkeeper mobile).**
- `NetInfo` listener + WatermelonDB sync status visible as persistent badge (per UX spec); offline-queued actions counter surfaces.
- All mutations are queued locally and replayed on reconnect; optimistic UI updates with rollback on server reject.

---

### Infrastructure & Deployment

**I1 · Hosting topology (AWS Mumbai ap-south-1).**
- **Web (Next.js customer + admin):** ECS Fargate behind ALB, CloudFront in front with tenant-CNAME resolution via Lambda@Edge (reads shop_id → origin header); multi-AZ.
- **API (NestJS):** ECS Fargate behind internal ALB; private subnets; RDS access via private endpoint.
- **Workers (BullMQ):** ECS Fargate scaled on queue depth; same image as API but different startup command.
- **Mobile apps:** Expo EAS Build → App Store / Play Store; MVP uses platform-owned developer accounts; per-tenant accounts deferred (Phase 4+).
- **Database:** RDS PostgreSQL 15 Multi-AZ in ap-south-1 (write primary + standby); RDS Read Replica for reporting workloads (from Month 6+).
- **Cache:** ElastiCache Redis Multi-AZ.
- **Search:** Meilisearch self-hosted on ECS Fargate (stateful — EBS volume with snapshot backups).
- **File storage:** S3 (bucket-per-env, prefix-per-tenant `tenants/{shop_id}/products/{product_id}/...`); CloudFront distribution per-env; ImageKit as origin-pull CDN for image transforms.
- **DNS:** Route 53 hosted zones; per-tenant CNAME provisioning automated via admin console → Route 53 API; SSL via ACM auto-issued.

**I2 · IaC: Terraform (with AWS provider + Cloudflare provider for email routing + Vercel unused).**
- Terraform modules: `network`, `database`, `cache`, `compute`, `storage`, `dns-and-tls`, `secrets`, `observability`, `ci-roles`.
- State in S3 backend with DynamoDB lock; per-env workspace (`dev`, `staging`, `prod`).
- Tenant provisioning uses Terraform for infra-level (Route 53 CNAME, S3 prefix IAM) + application-level (shop row, default settings, RLS policy validation) via a single orchestration lambda.
- Alternative: AWS CDK (TypeScript) if team preference — both tracked in ADR-0012; Terraform chosen for MVP due to mature module ecosystem + stable HCL for non-TS DevOps.

**I3 · CI/CD pipeline (GitHub Actions).**
- **On PR:** install → typecheck → lint → test unit → test integration (against ephemeral Postgres via `services`) → test tenant-isolation suite → test weight-precision harness → Semgrep + Snyk + Trivy scans → Codex review → Storybook build + Chromatic visual regression → Lighthouse CI (for changed web apps) → coverage gate (≥ 80%) → blocks merge if any fail.
- **On merge to `main`:** build container images → push to ECR → terraform plan (apply requires manual approval for prod).
- **Mobile deploys:** EAS Build per-app triggered on version tag; submission to stores requires platform-admin approval; OTA updates via EAS Update for JS-only hotfixes.
- **ship.yml** (from agency template) enforces the 5-layer review gate per CLAUDE.md; CI is the real gate, local hooks are fast feedback only.

**I4 · Environments.**
- `dev` — local + cloud dev sandbox; synthetic data; unlimited tenants for testing; auto-destroy nightly.
- `staging` — pre-prod in Mumbai; integrations pointed at vendor-sandbox endpoints (Razorpay test mode, AiSensy test account, IBJA reduced polling); used for anchor demo walkthroughs + QA.
- `prod` — Mumbai; real vendor endpoints; restricted deploy approvals; feature flags control gradual rollout of new features.

**I5 · Observability.**
- **Errors:** Sentry (self-hosted in Mumbai ECS on dedicated VPC) with per-app project; tenant_id + user_id contextual on every event.
- **Tracing:** OpenTelemetry with OTLP collector in Mumbai → Sentry Performance (self-hosted) OR Grafana Tempo; distributed across API → DB → Redis → workers → outbound integrations.
- **Metrics:** CloudWatch metrics + dashboards for infra (CPU, memory, RDS, Redis, ALB, queue depth); custom app metrics (invoice-generation p95, sync-lag, compliance-block-rate) via OpenTelemetry → CloudWatch Contributor Insights.
- **Logs:** Structured JSON to CloudWatch Logs with correlation IDs (`tenant_id`, `user_id`, `request_id`, `trace_id`); 30-day retention + export to S3 + Athena queryable for audit queries.
- **Product analytics:** PostHog self-hosted in Mumbai (dedicated RDS + ClickHouse); funnels, cohorts, session-replay (opt-in only per DPDPA); shopkeeper's customer-viewing-analytics reads from the product-event stream via a dedicated ingestion pipeline.
- **Alerts:** PagerDuty for P1 (uptime < 99.5%, error budget burn, security alerts); Slack for P2 (perf degradation, queue depth > threshold); per-alert runbook link (see `docs/runbooks/`).

**I6 · Scaling strategy.**
- **API + workers**: Horizontal ECS auto-scaling on CPU, queue depth (workers), and custom "p95 latency > threshold" metric.
- **RDS**: vertical scaling (larger instance) up to M12; read replica added at Month 6; sharding readiness documented in ADR-0009 with trigger condition (DB connections > 70% for 7 days OR single-tenant contention > threshold).
- **Cache**: Redis cluster mode off for MVP (single primary + replica); cluster mode on at ~100 tenants.
- **CDN**: CloudFront handles static + cached API responses globally; origin in Mumbai.
- **Wedding-season**: Pre-provision 10× capacity for Dhanteras week + Akshaya Tritiya week; auto-scale policies tuned for burst; load tested before each festival per runbook.

**I7 · Backup + DR.**
- RDS automated backups daily with 7-day retention + PITR; manual snapshot before every migration.
- S3 versioning on all buckets; cross-region replication to ap-south-2 (Hyderabad) for disaster-recovery-in-waiting (Phase 4+ cutover).
- Redis: no backup needed (cache + session data; reconstruct on failure).
- Meilisearch: daily EBS snapshot; reconstructable from Postgres source of truth.
- **RTO**: 4 hours (MVP) → 1 hour (M12); **RPO**: 1 hour (MVP) → 15 minutes (M12) via more frequent snapshots + replication.

**I8 · Feature-flag engine: GrowthBook OSS self-hosted.**
- Self-hosted in Mumbai; SDK integrated into API + all frontends.
- Flags evaluated server-side at auth time → surfaced to client via `/me/context` endpoint; clients re-fetch on settings-change signal.
- Usage: (a) per-tenant features (try-at-home, wholesale, gold-scheme), (b) per-environment rollout (new billing flow, new reports), (c) A/B experiments post-MVP.

**I9 · Data residency enforcement.**
- Terraform assertions: every AWS resource tagged with `data-classification` (pii | tenant-pii | platform-pii | non-pii); `data-residency=ap-south-1` enforced via SCP on the AWS Organizations account.
- Vendor-data-residency audit: quarterly review of every vendor DPA; PostHog, Sentry, self-hosted in Mumbai; Razorpay, AiSensy, MSG91, IBJA, Ola Maps, ImageKit all have India-hosted infrastructure per their DPAs.
- Annual third-party compliance audit to validate data never leaves India without explicit DPA.

---

### Decision Impact Analysis

**Implementation sequence (architectural enablers first, features second):**
1. Monorepo scaffold + CI + IaC skeleton (Epic 1 Story 1)
2. Database + RLS + Drizzle + tenant-interceptor + tenant-isolation-suite (Epic 1 Story 2–3)
3. Auth (Supabase Auth + JWT + RBAC) (Epic 1 Story 4–5)
4. Shared packages: money, compliance primitives, tenant-config, integrations port definitions (Epic 1 Story 6)
5. Observability baseline + Sentry + PostHog + feature flags (Epic 1 Story 7)
6. Settings service + self-service admin UI (Epic 2)
7. Inventory + pricing service + IBJA adapter + rate cache (Epic 3–4)
8. Billing + compliance engine + Razorpay adapter + PAN flow + Section 269ST hard-block + PMLA cumulative (Epic 5)
9. CRM + customer viewing analytics consent + event pipeline (Epic 6 + 12)
10. Customer app (browse + HUID QR + wishlist + white-label theming) (Epic 7)
11. Loyalty + custom-order + rate-lock + try-at-home state machines (Epic 8–10)
12. Reviews + size guides + policies (Epic 11)
13. Notifications dispatcher + BullMQ workers (Epic 13, continuous)
14. Reports + reporting replica + CSV/PDF export (Epic 14)
15. Platform admin console + tenant provisioning automation (Epic 15)
16. Performance + wedding-season hardening + pentest (Epic 16, reframed per IR-report recommendation — see Epics stage)

**Cross-component dependencies (high-level):**
- Every feature epic depends on `packages/compliance`, `packages/money`, `packages/tenant-config`, `packages/integrations/*` being present; these ship in Epic 1–2.
- Customer viewing analytics (Epic 12) requires opt-in consent persistence from Auth/Customer module (Epic 1+6) shipped before event ingestion begins.
- Near-real-time-sync depends on Epic 3 (publish mechanism) + Epic 7 (customer read). Server-cursor pattern must be in place at Epic 3; Epic 7 subscribes.
- WhatsApp-based flows (invoice share, custom order progress, campaign) depend on Epic 13 (dispatcher + AiSensy adapter); upstream epics design around eventual delivery (enqueue not sync).
- Reports (Epic 14) requires read-replica online — add the replica concurrently with Epic 6 to let dashboards be ready at Epic 9+.

### A+P Synthesis

- **A1 Critique-and-refine:** Initial draft had "token-based sessions stored in DB" — refined to JWT + Redis refresh-token rotation; DB-stored sessions is a scale bottleneck at 100K+ active customers.
- **A2 Comparative matrix (auth):** Supabase Auth vs Firebase Auth vs Cognito scored on (a) Mumbai residency, (b) phone OTP ergonomics, (c) custom claims, (d) MFA, (e) RLS integration, (f) cost, (g) adapter-swappability. Supabase wins; all scores in ADR-0001.
- **A3 Pre-mortem (sync protocol):** "Sync broke because…" — (1) server cursor went backward on failover (fix: cursor is DB sequence with monotonic guarantee); (2) client local clock drift broke LWW (fix: server_updated_at authoritative, client_timestamp only for audit); (3) stock went negative on concurrent writes (fix: pessimistic DB lock on stock decrement). All fixes in-design per ADR-0004.
- **A4 Reverse-engineering (compliance):** Worked backward from "shopkeeper cannot produce a compliant invoice" — required a pure-function compliance gateway that billing must call before persisting; anything that touches money passes through it. Resulted in `packages/compliance` being the only place GST/cash-cap/PAN/HUID logic exists.
- **A5 Stakeholder round table:** Winston (two-layer tenant guard), Murat (tenant-isolation + weight-precision CI gates non-negotiable), Mary (tenant provisioning must be scripted not manual for M9/M12 speed targets), John (p95 latency targets instrumented Day 1).

- **P Party Mode (Winston + Murat + Mary + Amelia):**
  - **Winston:** Modular monolith with strict module boundaries is the decision for MVP; document extraction paths in ADRs so team knows when/how to break apart.
  - **Murat:** Testing packages (`packages/testing/*`) ship in Epic 1, not later. Tenant-isolation + weight-precision + compliance-hard-block suites are gating from Sprint 1.
  - **Mary:** Tenant provisioning flow (admin console, scripts, Terraform orchestration) is explicitly in MVP scope — deferring it until Month 6 would break the M9 onboarding claim.
  - **Amelia:** Every architectural decision here translates into story-level acceptance criteria via ADR links; no decision is "taken for granted" — stories enforce them via code review templates.

**Synthesis:** All critical decisions made with explicit rationale + rejected alternatives. ADRs 0001–0012 to be written in Step 8 covering each locked decision. Implementation sequence aligned with Epic order (from IR report + PRD §9). Deferred decisions (sharding, Phase-3 real-time, Phase-4 native-per-tenant apps) documented with trigger conditions so future teams know when to revisit.

---

## Implementation Patterns & Consistency Rules

**Purpose of this section:** Multiple AI agents (Claude Code, Claude Agent SDK, human devs) will implement this system in parallel across stories. Without explicit conventions, two agents will pick different names, structures, or patterns and diverge. This section pins every choice where divergence would hurt. Patterns here are **binding** — CI, code review, and `/feature-dev:code-reviewer` enforce them.

### Pattern Categories Defined

Conflict-point inventory across naming, structure, format, communication, process, security, localization, compliance, and sync. Each has a rule + enforcement mechanism (lint / CI / review gate).

---

### Naming Patterns

**Database (PostgreSQL):**
- Table names: `snake_case`, plural noun (`shops`, `invoices`, `invoice_items`, `custom_orders`, `audit_events`).
- Column names: `snake_case` (`shop_id`, `created_at`, `deleted_at`, `pan_encrypted_ciphertext`).
- Primary keys: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY` on every tenant-scoped table.
- Foreign keys: `<singular>_id` (`shop_id`, `customer_id`, `invoice_id`). Never `fk_*` prefixes.
- Timestamps: `created_at`, `updated_at`, `deleted_at` (if soft-delete); always `TIMESTAMPTZ`, default `NOW()`.
- Enums: stored as `TEXT` with `CHECK (col IN (...))`; enum values SHOUT_SNAKE (`GOLD_22K`, `INVOICE_VOIDED`). Avoid PostgreSQL native enums (migration pain).
- Indexes: `idx_<table>_<columns>` (`idx_invoices_shop_id_created_at`). Partial indexes end with `_partial` (`idx_products_published_partial`).
- RLS policies: `rls_<table>_tenant_isolation`, `rls_<table>_platform_admin`.

**API:**
- Base path: `/api/v1/<resource>` — plural, `kebab-case` for multi-word (`/api/v1/custom-orders`, `/api/v1/rate-locks`).
- Path parameters: `:id` in route (NestJS), curly-brace `{id}` in OpenAPI docs — same variable name in JSON schema.
- Query parameters: `camelCase` (`?shopId=...`, `?sinceSeq=...`, `?includeDeleted=true`).
- Headers: `X-Tenant-Id`, `X-Request-Id`, `Idempotency-Key` — kebab-case for custom headers, capitalized hyphen convention.
- HTTP methods: conventional (GET read, POST create + actions, PATCH partial-update, PUT replace, DELETE soft-delete). Actions that are NOT idempotent use POST (`POST /invoices/:id/void`); actions that ARE idempotent use PUT.
- Status codes: 200 OK (success + data), 201 Created (with `Location` header), 202 Accepted (async enqueued), 204 No Content (delete), 400 Bad Request (validation), 401 Unauthorized (no creds), 403 Forbidden (creds but denied), 404 Not Found, 409 Conflict (concurrency + compliance hard-block), 422 Unprocessable Entity (semantically-invalid data), 429 Too Many Requests, 500 Internal Server Error, 503 Service Unavailable.

**Code (TypeScript):**
- Files: `kebab-case` for modules (`tenant.interceptor.ts`), `PascalCase` for class-only files (`InvoiceService.ts` allowed but discouraged; prefer `invoice.service.ts`). NestJS convention wins; we use `<name>.<kind>.ts` — `invoice.controller.ts`, `invoice.service.ts`, `invoice.repository.ts`, `invoice.module.ts`, `invoice.dto.ts`, `invoice.types.ts`.
- React components: `PascalCase.tsx` (`ProductCard.tsx`, `HUIDMedallion.tsx`). Component file exports the named component as default? NO — use named export `export function ProductCard(...)` for grep-ability; only `page.tsx` / `layout.tsx` in Next.js App Router use default export (convention requires it).
- Functions + variables: `camelCase` (`createInvoice`, `shopId`, `isPublished`).
- Constants: `SCREAMING_SNAKE_CASE` for module-level constants (`GST_METAL_RATE_BP`, `SECTION_269ST_CAP_PAISE`).
- Types + interfaces: `PascalCase`; NO `I` prefix (`Invoice`, not `IInvoice`). Type aliases preferred over interfaces unless extending is required.
- Booleans: `isX` / `hasX` / `canX` (`isPublished`, `hasPan`, `canOverrideCashCap`).
- Enum types: `PascalCase` values (TS enum convention: `InvoiceStatus.VOIDED`) BUT when serialized to DB/API the value is SCREAMING_SNAKE (`VOIDED`). Helper `toApiValue` / `fromApiValue` in `packages/shared/enums`.

**Design tokens (UX + frontend):**
- Token path: dot-separated (`colors.primary.600`, `spacing.4`, `typography.body`). Consumed in Tailwind as `colors.primary.600` → `bg-primary-600`; in NativeWind likewise.
- Token names never describe use-case (not `colors.buttonBg`); they describe value semantics (`colors.primary.600`). Use-case is expressed at consumption site.

**Files + directories:**
- All directories `kebab-case`.
- React components in their own directory when they have co-located subcomponents, styles, or tests (`ProductCard/index.tsx` + `ProductCard/ProductCardSkeleton.tsx` + `ProductCard/ProductCard.test.tsx`). Simple components ship as single files.
- Tests co-located with source (`invoice.service.ts` + `invoice.service.test.ts`); integration and E2E tests in `apps/api/test/integration/` and `apps/<app>/e2e/`.

---

### Structure Patterns

**NestJS module layout (inside `apps/api/src/modules/<domain>/`):**
```
<domain>/
  <domain>.module.ts             # NestJS module wiring
  <domain>.controller.ts         # HTTP endpoints; thin, delegates to service
  <domain>.service.ts            # Business orchestration; calls compliance, repositories, events
  <domain>.repository.ts         # Drizzle-backed data access; ONLY place that writes SQL
  <domain>.types.ts              # TS types specific to this module (Zod-derived)
  <domain>.dto.ts                # Input DTOs (Zod-based)
  <domain>.errors.ts             # Module-specific errors extending AppError
  <domain>.events.ts             # Domain events emitted on state transitions
  state-machine.ts               # Only when module owns a state machine (custom-order, rate-lock, try-at-home, tenant, invoice)
  __tests__/                     # Unit + integration tests
```

**Frontend feature layout (`apps/<app>/src/features/<feature>/`):**
```
<feature>/
  components/                    # Feature-specific components (Tier 4 screens + any leaf helpers)
  hooks/                         # Feature-specific hooks (useInvoiceDraft, etc.)
  api/                           # TanStack Query hooks + fetchers
  store/                         # Zustand slices (UI state only)
  types.ts                       # Shared types within feature
  utils.ts                       # Feature helpers
  index.ts                       # Public API of the feature
```

**Shared package layout (`packages/<pkg>/`):**
```
<pkg>/
  src/
    index.ts                     # Public exports only
    <submodule>/
  package.json                   # type: module; exports map; peerDependencies explicit
  tsconfig.json                  # Extends root tsconfig.base.json
  README.md                      # What this package does; how to consume
```

**Co-location rules (binding):**
- Tests co-located next to source.
- Zod schemas co-located with the type they validate (`packages/shared/schemas/invoice.schema.ts`).
- ADRs live in `_bmad-output/planning-artifacts/adr/NNNN-<slug>.md` (numbered, never renumbered; decisions append-only with `Superseded by` links).
- Runbooks live in `docs/runbooks/<incident-slug>.md`.
- Threat model lives in `docs/threat-model.md` (STRIDE per the Agency Delivery Protocol).
- Stories live in `docs/stories/<story-id>.md` (per BMAD CE).

---

### Format Patterns

**API responses:**
- Successful reads: return the resource directly, no wrapper. `GET /api/v1/invoices/abc` → `{ "id": "abc", ... }`.
- Successful collections: `{ "data": [ ... ], "nextCursor": "...", "total": 123 }` — cursor-based pagination (not offset).
- Success envelope NOT used for single-resource GETs (avoid double-envelope); used for batch+paged responses only.
- Actions with side effects: `POST /invoices/:id/void` returns the updated resource (not `{ success: true }`).
- Errors: RFC 7807 problem+json: `{ "type": "...", "title": "...", "status": 422, "detail": "...", "errorCode": "compliance.pan.required", "tenantId": "...", "requestId": "..." }`.

**JSON field casing: `camelCase` on the wire.**
- Drizzle snake_case columns are auto-transformed to camelCase in the DTO layer.
- Never mix: API is fully camelCase; DB is fully snake_case.
- Never leak DB column names (e.g., `shop_id`) into API responses — always `shopId`.

**Dates + timestamps:**
- API: ISO-8601 UTC strings with offset (`2026-04-17T09:30:00.000Z`).
- DB: `TIMESTAMPTZ` (stores UTC); rendered via app config with `Asia/Kolkata` default per user.
- UI: formatted per locale (Hindi: `१७ अप्रैल २०२६, सुबह ३:०० बजे`; English: `17 Apr 2026, 3:00 AM IST`) via `date-fns` + locale pack.

**Money + weight:**
- API: money always as `{ "amountPaise": 199999, "currency": "INR" }` OR plain `amountPaise` integer if unambiguous. NEVER a float. NEVER a string for on-wire efficiency (JSON int fine up to 2^53 which covers paise).
- Weight: `{ "grams": "12.3456" }` — stringified decimal to preserve precision across JSON number float issues; parsed back via `decimal.js` on client.
- Display layer converts: `₹ 1,99,999.00` (Indian grouping), `12.3456 ग्राम`.

**Booleans:** `true` / `false` only. No `1` / `0`, no `"yes"` / `"no"`.
**Null handling:** Use `null` when a value is known-absent. Use `undefined` for optional fields not present in the DTO (TypeScript `Field?: T` style). Never `""` as semantic absent.

**Pagination:** Cursor-based. Request: `?cursor=<opaque>&limit=<20>`; response includes `nextCursor` (null when no more). Offset pagination only for Platform Admin cross-tenant views where total-count matters.

---

### Communication Patterns

**Domain events:**
- Event name: `<domain>.<pastTenseAction>` — `invoice.created`, `custom_order.stage_advanced`, `rate_lock.expired`, `tenant.suspended`.
- Payload: `{ eventId, eventType, tenantId, occurredAt, version: 1, data: {...} }` — `data` is typed per event.
- Dispatched via NestJS `EventEmitter2` for in-process handlers + BullMQ for async side-effects (WhatsApp send, analytics ingest).
- Versioning: `version: 1` on every event; consumers reject unknown major versions; new breaking events get `.v2` suffix.
- Idempotency: all event handlers dedupe on `eventId` before processing.

**Background jobs (BullMQ):**
- Queue names: `<domain>-<action>` — `notifications-dispatch`, `reports-eod`, `integrations-razorpay-webhook`, `search-reindex`, `compliance-pmla-aggregate`.
- Job payload: always include `{ tenantId, userId, idempotencyKey, data }`.
- Per-tenant partition: `jobId = <queue>:<tenantId>:<business-key>` — prevents one tenant's backlog from starving others.
- Retry: exponential backoff starting 2s, max 3 retries for transient errors; non-retryable errors → DLQ + Sentry alert + runbook ref.

**State machines:** every stateful entity has an explicit state machine file (`state-machine.ts`) with:
- `State` type (union of string literals).
- `Event` type.
- `transitions: Record<State, Record<Event, State>>` lookup table.
- `guards: Record<Event, (ctx) => boolean | Promise<boolean>>` invariant-checks.
- `sideEffects: Record<Event, (ctx) => void>` — enqueue events, audit, notify.
- Pure function `apply(state, event, ctx): State` — calls guard, returns new state OR throws `InvalidTransitionError`.
- **Machines** (per UX spec §Flows): `InvoiceStateMachine`, `CustomOrderStateMachine`, `RateLockStateMachine`, `TryAtHomeStateMachine`, `TenantLifecycleStateMachine`.

**Webhooks (inbound):**
- Endpoint: `POST /api/v1/webhooks/:provider`. Signature verification is mandatory (HMAC SHA-256 with provider-specific secret from Secrets Manager).
- Response: 200 immediately after enqueue; 401 on signature fail; never leak details.
- Idempotency: dedupe on provider's event ID.

**Sync protocol between shopkeeper mobile and backend:**
- `GET /api/v1/sync/pull?cursor=<seq>&tables=<csv>` — server returns batch of changes + nextCursor.
- `POST /api/v1/sync/push` — body `{ changes: [...], clientCursor, deviceId }`; idempotency key on outer request.
- Conflict: 409 with `{ conflictType, serverRecord, clientRecord, resolution: "server_wins" | "client_wins" | "manual" }`.

---

### Process Patterns

**Error handling (full stack):**
- Backend: every known error extends `AppError` class (in `packages/shared/errors`) with `errorCode`, `status`, `messageKey` (i18n key), optional `details`. Global filter maps to problem+json.
- Unknown errors: caught by global filter, logged to Sentry with full context, surfaced as generic 500 with `errorCode: "internal.unexpected"`.
- Client: typed API client throws `AppError` subclasses; components use React Error Boundaries at feature level; forms display localized messages from error code → message registry.
- **Never silent failure** — always surface via toast/inline/boundary.
- **Compliance errors are special**: errorCode prefix `compliance.*` — UI treats them as hard-block moments (modal or inline guard per UX spec), never a retryable toast.

**Retry policies:**
- HTTP client (integrations): exponential backoff, max 3 retries; circuit breaker opens after 5 consecutive failures over 60s; half-open probe every 30s.
- BullMQ workers: per-queue retry config (3 tries exponential, max delay 5 min).
- Client-side TanStack Query: `retry: 3` with exponential backoff on transient; `retry: 0` on 4xx.

**Loading states:**
- Pattern: `isLoading` (initial) + `isFetching` (refetch) + `error` + `data` — TanStack Query standard. UI components destructure these; use skeleton for `isLoading`, subtle indicator for `isFetching`, error-boundary for `error`, content for `data`.
- Every list/card component has a corresponding `<X.Skeleton />` component; never a bare spinner on hot paths.
- Optimistic updates use TanStack Query `onMutate` + rollback `onError`.

**Validation timing:**
- Server-side: at controller (Zod DTO validation) AND at aggregate root (double-guard for invariants).
- Client-side: as user types (after 500ms on first blur) — inline errors near field.
- Never rely on client validation only.

**Authentication flow:**
- Phone OTP: send via Supabase Auth (fallback MSG91) → user enters OTP → verify → issue access (15m) + refresh (30d) JWTs → client stores access in memory, refresh in secure storage (Keychain / Android Keystore / httpOnly cookie on web).
- Refresh: client calls `/auth/refresh` with refresh token → server rotates (invalidate old, issue new).
- Logout: server revokes refresh token in Redis.
- Session across apps: each app is a separate `aud` in JWT; refresh tokens are app-scoped.

**Compliance hard-block pattern (CRITICAL — cross-cutting):**
- Every financial state transition passes through `packages/compliance/gates`:
  - `applyGstSplit({ metalValue, makingCharge })` → computes 3%+5% split (pure).
  - `enforce269ST({ cashSoFar, cashIncrement, tenantId, customerId })` → throws `ComplianceHardBlockError('compliance.cash_cap_exceeded')` if would breach Rs 1,99,999; supervisor override flow is a separate explicit call `override269ST({ ...justification, userId, role })` that audit-logs.
  - `enforcePanRequired({ total, pan, form60 })` → throws if total ≥ Rs 2L and neither PAN nor Form 60 present.
  - `trackPmlaCumulative({ customerId, cashAmount, month })` → updates aggregate; throws at Rs 10L block threshold; emits `pmla.cash_threshold_warning` event at Rs 8L.
  - `validateHuidPresence({ productsByLine })` → throws if any hallmarked product line lacks HUID.
- These are **pure or transactional-helper** functions; no feature module re-implements the rule; no feature module skips the gate.
- **Enforcement:** Semgrep rule forbids `invoices.insert` without `applyGstSplit` + `enforce269ST` + `enforcePanRequired` + `validateHuidPresence` in the preceding call tree (AST-based); code review checklist in `/feature-dev:code-reviewer` asserts this.

**Tenant-context pattern (CRITICAL — cross-cutting):**
- Controller: injects `@TenantContext() ctx: TenantContext` parameter (custom decorator).
- Service: never accepts raw `shopId`; always accepts or reads from `TenantContext`.
- Repository: uses `db.transaction(async (tx) => { await tx.execute(sql\`SET LOCAL app.current_shop_id = ${ctx.shopId}\`); ... })` — RLS enforces.
- **Enforcement:** ESLint rule forbids `shop_id` parameter in service signatures; Semgrep rule requires `SET LOCAL app.current_shop_id` at top of every transaction; tenant-isolation test suite runs on every CI.

**Audit pattern (CRITICAL — cross-cutting):**
- `packages/audit` exposes `auditLog({ action, subjectType, subjectId, before, after, metadata })` — called from every compliance-sensitive or admin action.
- Typed `AuditAction` enum keeps call-sites consistent.
- Logs to `audit_events` table + S3 daily export.
- **Enforcement:** `/feature-dev:code-reviewer` gate flags service methods that mutate money or PMLA or auth without a preceding `auditLog` call.

**Localization pattern:**
- All user-facing strings behind `i18n.t('<key>')` — keys organized by feature (`billing.generate_invoice`, `compliance.pan_required.title`).
- Default locale: Hindi (`hi-IN`). Fallback: English (`en-IN`). Schema: ICU messages.
- Translation catalog: `packages/i18n/locales/<lang>/<feature>.json`.
- Date/time/number formatting: locale-aware via `Intl` APIs + locale pack.
- `LocaleAwareText` component (per UX spec) applies Hindi typography (line-height 1.6, weight +100 vs Latin) automatically based on text script.

**Observability pattern:**
- Structured logs: every log line includes `{ level, message, tenantId, userId, requestId, traceId, ...custom }`. Use `@nestjs/logger` with Pino transport.
- Traces: OpenTelemetry auto-instrumentation for HTTP, Postgres, Redis, BullMQ; custom spans for every service method that takes > 50ms.
- Metrics: per-domain counters (e.g., `invoice_generated_count{shop_id, staff_role}`), histograms for latency, gauges for queue depth.
- Sentry: `Sentry.captureException(err, { tags: { tenantId, feature }, extra: { ... }})` on every surfaced error.

**Theming pattern (white-label):**
- `packages/ui-theme` exports `resolveTheme(tenantConfig) → ResolvedTokens`.
- Web: `<body>` injected with CSS variables from `ResolvedTokens` at SSR (Next.js middleware reads tenant from host); Tailwind classes use `var(--color-primary-600)`.
- Mobile: `<ThemeProvider>` wraps app root with `ResolvedTokens`; NativeWind resolves via runtime config.
- **Enforcement:** Semgrep rule forbids hex-color literals in `apps/customer/**` and `apps/web/**` (platform/admin paths exempt); must use token references.

**Feature-flag pattern:**
- `useFeature(key, defaultValue)` hook in frontend; `featureFlags.isEnabled(key, ctx)` in backend.
- All flags documented in `docs/feature-flags.md` with: name, owner, purpose, default, rollout plan, removal criteria.
- Stale flags: quarterly cleanup — any flag 100% enabled for > 90 days is removed.

---

### Enforcement Guidelines

**All AI agents MUST (binding rules):**
1. Every tenant-scoped DB table has `shop_id UUID NOT NULL` + foreign key + RLS policy in the migration. Migration PR without RLS is rejected.
2. Every financial amount in DB is `NUMERIC(18,2)` paise-or-higher OR `BIGINT` paise; NEVER `REAL` / `DOUBLE PRECISION` / `FLOAT`. Weights are `NUMERIC(12,4)` grams. Semgrep enforces; PR rejected on violation.
3. Every service method that mutates state emits a domain event AND calls `auditLog` when compliance-sensitive.
4. Every background job + webhook has an idempotency key persisted; duplicate detection before work.
5. No direct `shop_id` parameter in service method signatures — flow through `TenantContext`. ESLint enforces.
6. No hex colors in customer-facing code — must resolve via design tokens. Semgrep enforces.
7. No English-only UI strings in customer-facing code — every string behind `i18n.t`. Semgrep warns; PR rejected if Hindi translation missing from `packages/i18n/locales/hi-IN/`.
8. Every new public API endpoint adds a `tenant-isolation-test` case in `packages/testing/tenant-isolation`; CI runs the suite and blocks merge on failure.
9. Every financial state transition passes through `packages/compliance` gates; no feature re-implements GST, 269ST, PAN, PMLA, HUID.
10. Every public function in `packages/*` has a JSDoc description (enforced by eslint-plugin-jsdoc).

**Enforcement stack:**
- **ESLint (flat config)** with rules for naming, imports, unused, React hooks, a11y; `eslint-plugin-goldsmith` (custom) rules for tenant/compliance guards.
- **Semgrep** rules in `ops/semgrep/*.yaml` covering: FLOAT bans, hex-color bans, `shop_id` param bans, compliance-gate enforcement, secret-in-source detection.
- **Codex CLI review** as the authoritative cross-model gate per CLAUDE.md; runs on every push before merge.
- **`/feature-dev:code-reviewer`** checklist includes pattern adherence; subagent returns findings with line references.
- **CI pipeline** runs tenant-isolation + weight-precision + compliance-hard-block + axe-core + Lighthouse CI + Semgrep + Snyk + Trivy on every PR.
- **Storybook visual regression** via Chromatic catches theme token drift and accessibility regressions.

**Pattern violation process:**
- PR author fixes before merge; patterns are not negotiable.
- If a pattern is genuinely wrong for a case, author proposes a pattern update in a separate PR → ADR → update this section → then applies to new PR.
- Never bypass CI with `--no-verify`; emergencies use `CLAUDE_OVERRIDE_REASON` env var per CLAUDE.md with audit trail in `~/.claude/override-log.jsonl`.

---

### Pattern Examples

**Good — tenant-scoped repository method:**
```ts
// apps/api/src/modules/invoice/invoice.repository.ts
@Injectable()
export class InvoiceRepository {
  constructor(@Inject(DB) private db: DrizzleDB) {}

  async findById(ctx: TenantContext, id: string): Promise<Invoice | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL app.current_shop_id = ${ctx.shopId}`);
      const [row] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1);
      return row ? mapInvoiceRow(row) : null;
    });
  }
}
```

**Anti-pattern — tenant-context leaked as raw param:**
```ts
// ❌ REJECTED — ESLint rule forbids shop_id parameter
async findById(shopId: string, id: string): Promise<Invoice | null> { ... }
```

**Good — compliance-gated invoice creation:**
```ts
async create(ctx: TenantContext, input: CreateInvoiceDto): Promise<Invoice> {
  const lines = input.lines.map(buildLineWithGst);
  await validateHuidPresence(lines);
  const total = computeTotal(lines);
  await enforcePanRequired({ total, pan: input.pan, form60: input.form60 });
  await enforce269ST({
    cashSoFar: await pmla.getTodaysCashForCustomer(ctx, input.customerId),
    cashIncrement: input.paymentSplit.cash,
    tenantId: ctx.shopId,
    customerId: input.customerId,
  });
  const invoice = await this.repo.insert(ctx, { ...input, lines, total, idempotencyKey: input.idempotencyKey });
  await auditLog({ ctx, action: 'INVOICE_CREATED', subjectType: 'Invoice', subjectId: invoice.id, after: invoice });
  await this.events.emit('invoice.created', { invoice });
  return invoice;
}
```

**Anti-pattern — inline compliance logic:**
```ts
// ❌ REJECTED — re-implements what packages/compliance owns
async create(...) {
  if (input.paymentSplit.cash >= 200000) throw new Error('cash too high');  // NOT compliant with Rs 1,99,999 exact boundary; not audit-logged; not tenant-scoped
  ...
}
```

**Good — state machine transition:**
```ts
// apps/api/src/modules/custom-order/state-machine.ts
export const transitions: Record<CustomOrderState, Partial<Record<CustomOrderEvent, CustomOrderState>>> = {
  QUOTED: { APPROVE: 'APPROVED', REJECT: 'REJECTED', MODIFY: 'QUOTED' },
  APPROVED: { PAY_DEPOSIT: 'METAL_CAST' },
  METAL_CAST: { ADVANCE: 'STONES_SET', MODIFY: 'METAL_CAST' },
  STONES_SET: { ADVANCE: 'QC' },
  QC: { ADVANCE: 'READY', REWORK: 'STONES_SET' },
  READY: { DELIVER: 'DELIVERED' },
  DELIVERED: {},
  REJECTED: {},
};
```

### A+P Synthesis

- **A1 Critique-and-refine:** First draft had loose naming rules; refined to explicit casing per layer (snake_case DB, camelCase JSON/code, SCREAMING_SNAKE enum values, kebab-case files/URLs). Consistency across layers prevents every agent disagreeing.
- **A2 Pre-mortem:** "Two agents shipped conflicting code because…" — (1) one used `userId` in DTO, the other `user_id` (fix: wire format pinned to camelCase); (2) one skipped RLS in migration (fix: migration-review CI check); (3) one bypassed compliance gate (fix: Semgrep rule + reviewer checklist). Every failure mode has an enforcement mechanism now.
- **A3 Stakeholder round table:** Winston (tenant-context propagation rule), Murat (enforcement via CI not docs), Amelia (patterns as code — lint/Semgrep — not PR comments), Paige (examples alongside rules make them sticky).
- **A4 Comparative matrix (theming approach):** CSS-vars vs Tailwind JIT vs runtime theme object — chose CSS-vars on web (fast, SSR-friendly, tenant-per-request) + React Context on mobile (no CSS-vars runtime in RN without heavy deps); rejected JIT-at-build because tenants are dynamic.
- **A5 Lessons-learned extraction:** Marg/Tally failed on inconsistent ERP data formats across modules; we prevent by pinning wire format + shared Zod schemas + enforcement.

- **P Party Mode (Winston + Murat + Amelia + Paige):**
  - **Winston:** Boundary rules (tenant-context, compliance gate, event contract) are architectural, not stylistic — CI enforcement is mandatory.
  - **Murat:** Every rule has a test or a lint rule. "Document and hope" fails. Codex review is the final authoritative gate because cross-model catches single-model blind-spots.
  - **Amelia:** Patterns drive story templates — every story's Definition of Done references the enforcement table. Dev Story agent reads this section before generating code.
  - **Paige:** Examples are the best documentation — Good + Anti-pattern pairs accelerate adoption + give reviewers clear language.

**Synthesis:** 10 binding "MUST" rules; 6 enforcement layers (ESLint + Semgrep + Codex + code-reviewer + CI gates + Storybook VR); worked examples for the 3 highest-risk areas (tenant scoping, compliance gate, state machine). Every rule has a failure mode, a detection mechanism, and a concrete fix.

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
goldsmith/
├── README.md
├── CLAUDE.md                           # Project instructions (already present)
├── AGENTS.md                           # Optional Codex agent config
├── package.json                        # Root — Turborepo + pnpm workspace config
├── pnpm-workspace.yaml                 # apps/* + packages/*
├── pnpm-lock.yaml
├── turbo.json                          # Turborepo pipeline definitions
├── tsconfig.base.json                  # Strict TS base extended by all packages
├── .eslintrc.json / eslint.config.js   # Root ESLint flat config
├── .prettierrc
├── .editorconfig
├── .gitignore
├── .nvmrc                              # Node 20 LTS
├── .npmrc                              # pnpm config
├── .env.example                        # Root env template (checked in)
├── commitlint.config.js                # Conventional commits enforced
│
├── .github/
│   └── workflows/
│       ├── ship.yml                    # Main CI: lint → typecheck → test → security → build → deploy
│       ├── tenant-isolation.yml        # Runs on every PR; blocks merge
│       ├── weight-precision.yml        # Nightly + on-demand
│       ├── lighthouse.yml              # Web perf/a11y
│       ├── chromatic.yml               # Storybook visual regression
│       ├── storybook.yml               # Build Storybook site on release
│       ├── expo-eas-build.yml          # Mobile builds on version tag
│       └── codex-review.yml            # Cross-model code review gate
│
├── .husky/
│   ├── pre-commit                      # lint-staged + quick unit tests
│   └── commit-msg                      # commitlint check
│
├── .vscode/
│   ├── settings.json                   # Team editor config
│   └── extensions.json                 # Recommended extensions
│
├── apps/
│   ├── api/                            # NestJS backend API + workers
│   │   ├── src/
│   │   │   ├── main.ts                 # Bootstrap (API mode)
│   │   │   ├── worker.ts               # BullMQ worker bootstrap
│   │   │   ├── app.module.ts
│   │   │   ├── config/
│   │   │   │   ├── config.module.ts
│   │   │   │   ├── env.schema.ts       # Zod schema for env vars
│   │   │   │   └── secrets.ts          # AWS Secrets Manager resolver
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── tenant-context.decorator.ts
│   │   │   │   │   ├── roles.decorator.ts
│   │   │   │   │   └── idempotency-key.decorator.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── tenant.guard.ts
│   │   │   │   │   ├── role.guard.ts
│   │   │   │   │   └── policy.guard.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── tenant.interceptor.ts      # Resolves tenant, sets request context
│   │   │   │   │   ├── audit.interceptor.ts
│   │   │   │   │   ├── idempotency.interceptor.ts
│   │   │   │   │   └── logging.interceptor.ts
│   │   │   │   ├── pipes/
│   │   │   │   │   └── zod-validation.pipe.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── global-exception.filter.ts  # Maps errors to problem+json
│   │   │   │   └── providers/
│   │   │   │       ├── db.provider.ts             # Drizzle DB with RLS tx wrapper
│   │   │   │       ├── redis.provider.ts
│   │   │   │       └── bullmq.provider.ts
│   │   │   ├── modules/                           # Bounded contexts (one module per domain)
│   │   │   │   ├── tenant/                        # FR1-7
│   │   │   │   ├── auth/                          # FR8-15
│   │   │   │   ├── settings/                      # FR16-24
│   │   │   │   ├── inventory/                     # FR25-34
│   │   │   │   ├── pricing/                       # FR35-40
│   │   │   │   ├── billing/                       # FR41-55
│   │   │   │   ├── crm/                           # FR56-63
│   │   │   │   ├── viewing-analytics/             # FR64-68
│   │   │   │   ├── loyalty/                       # FR69-72
│   │   │   │   ├── custom-order/                  # FR73-79
│   │   │   │   ├── rate-lock/                     # FR80-83
│   │   │   │   ├── try-at-home/                   # FR84-85
│   │   │   │   ├── catalog/                       # FR86-99 (customer read-path)
│   │   │   │   ├── reviews/                       # FR100-103
│   │   │   │   ├── policies/                      # FR104-106 (size guides, policies)
│   │   │   │   ├── notifications/                 # FR107-112
│   │   │   │   ├── reports/                       # FR113-119
│   │   │   │   ├── platform-admin/                # FR120-126
│   │   │   │   ├── sync/                          # Shopkeeper offline sync endpoints
│   │   │   │   └── webhooks/                      # Inbound webhook handlers (Razorpay, AiSensy, etc.)
│   │   │   └── workers/                           # BullMQ processors
│   │   │       ├── notifications.processor.ts
│   │   │       ├── reports-eod.processor.ts
│   │   │       ├── search-indexer.processor.ts
│   │   │       ├── compliance-pmla.processor.ts
│   │   │       └── integrations.processor.ts
│   │   ├── test/
│   │   │   ├── integration/                        # NestJS e2e test suites against ephemeral Postgres
│   │   │   ├── e2e/                                # Full HTTP-level tests
│   │   │   └── fixtures/
│   │   ├── Dockerfile
│   │   ├── Dockerfile.worker
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shopkeeper/                     # React Native (Expo) — shopkeeper mobile app
│   │   ├── app/                        # Expo Router file-based routes
│   │   │   ├── _layout.tsx
│   │   │   ├── (auth)/
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx           # Home / daily summary
│   │   │   │   ├── customers.tsx
│   │   │   │   ├── billing.tsx
│   │   │   │   ├── inventory.tsx
│   │   │   │   └── more.tsx
│   │   │   ├── customer/[id].tsx
│   │   │   ├── billing/new.tsx
│   │   │   ├── billing/[id].tsx
│   │   │   ├── inventory/[id]/edit.tsx
│   │   │   ├── custom-orders/
│   │   │   ├── rate-locks/
│   │   │   ├── try-at-home/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── src/
│   │   │   ├── features/               # Feature directories per Patterns §
│   │   │   │   ├── billing/
│   │   │   │   ├── inventory/
│   │   │   │   ├── crm/
│   │   │   │   ├── viewing-analytics/
│   │   │   │   ├── loyalty/
│   │   │   │   ├── custom-order/
│   │   │   │   ├── rate-lock/
│   │   │   │   ├── try-at-home/
│   │   │   │   ├── settings/
│   │   │   │   └── reports/
│   │   │   ├── db/                     # WatermelonDB schema + models + sync adapter
│   │   │   │   ├── schema.ts
│   │   │   │   ├── models/
│   │   │   │   └── sync/
│   │   │   ├── providers/              # ThemeProvider, AuthProvider, TenantProvider, OfflineProvider
│   │   │   ├── lib/
│   │   │   └── i18n/                   # Local app overrides (most i18n in packages/i18n)
│   │   ├── assets/
│   │   ├── app.json                    # Expo config (white-label build variants)
│   │   ├── eas.json
│   │   ├── metro.config.js
│   │   ├── nativewind.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── customer/                       # React Native (Expo) — customer mobile app (white-labeled)
│   │   ├── app/                        # Expo Router
│   │   │   ├── _layout.tsx             # Loads tenant theme from domain context
│   │   │   ├── (auth)/
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx           # Home (rate, featured, categories)
│   │   │   │   ├── browse.tsx
│   │   │   │   ├── wishlist.tsx
│   │   │   │   ├── orders.tsx
│   │   │   │   └── account.tsx
│   │   │   ├── product/[id].tsx
│   │   │   ├── category/[slug].tsx
│   │   │   ├── huid-scan.tsx
│   │   │   ├── rate-lock/
│   │   │   ├── custom-order/[id].tsx
│   │   │   ├── try-at-home/
│   │   │   ├── store-info.tsx
│   │   │   └── settings/
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── catalog/
│   │   │   │   ├── product-detail/
│   │   │   │   ├── wishlist/
│   │   │   │   ├── huid-verify/
│   │   │   │   ├── rate-lock/
│   │   │   │   ├── custom-order/
│   │   │   │   ├── try-at-home/
│   │   │   │   ├── loyalty/
│   │   │   │   └── reviews/
│   │   │   ├── providers/              # ThemeProvider (white-label), TenantProvider, AuthProvider
│   │   │   └── lib/
│   │   ├── assets/
│   │   ├── app.config.ts               # Dynamic per-build tenant config
│   │   ├── eas.json
│   │   ├── nativewind.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── web/                            # Next.js 14 — customer web (white-labeled per-tenant CNAME)
│   │   ├── src/
│   │   │   ├── app/                    # App Router
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx            # Tenant home
│   │   │   │   ├── (auth)/
│   │   │   │   ├── browse/
│   │   │   │   ├── product/[id]/
│   │   │   │   ├── category/[slug]/
│   │   │   │   ├── wishlist/
│   │   │   │   ├── account/
│   │   │   │   ├── custom-order/[id]/
│   │   │   │   ├── rate-lock/
│   │   │   │   ├── store-info/
│   │   │   │   ├── api/                # Next.js route handlers (proxy + auth stub + SSR helpers only)
│   │   │   │   └── sitemap.ts
│   │   │   ├── features/
│   │   │   ├── components/             # App-specific composition (Tier 4 screens)
│   │   │   ├── providers/
│   │   │   ├── lib/
│   │   │   └── middleware.ts           # Tenant resolution from host → X-Tenant-Id forwarded to API
│   │   ├── public/
│   │   │   └── (tenant-agnostic assets only; tenant assets served from ImageKit)
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── admin/                          # Next.js 14 — platform admin console
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── login/
│       │   │   ├── (auth)/
│       │   │   │   ├── dashboard/
│       │   │   │   ├── tenants/
│       │   │   │   ├── tenants/[id]/
│       │   │   │   ├── provision/
│       │   │   │   ├── subscriptions/
│       │   │   │   ├── feature-flags/
│       │   │   │   ├── audit/
│       │   │   │   ├── platform-settings/
│       │   │   │   └── support/
│       │   │   └── api/                # Admin-specific proxy routes
│       │   ├── features/
│       │   ├── providers/
│       │   ├── lib/
│       │   └── middleware.ts           # MFA + platform-admin role gate
│       ├── public/
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── shared/                         # Cross-cutting types, Zod schemas, error classes, enums
│   │   ├── src/
│   │   │   ├── schemas/                # Zod schemas per domain entity
│   │   │   ├── errors/                 # AppError + subclasses
│   │   │   ├── enums/                  # PurityKind, InvoiceStatus, etc.
│   │   │   ├── types/                  # Domain types derived from schemas
│   │   │   ├── events/                 # Domain event contracts
│   │   │   └── utils/                  # Generic utilities
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── db/                             # Drizzle schema + migrations + db provider
│   │   ├── src/
│   │   │   ├── schema/                 # One file per aggregate
│   │   │   │   ├── shops.ts
│   │   │   │   ├── shop-users.ts
│   │   │   │   ├── shop-settings.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── customers.ts
│   │   │   │   ├── invoices.ts
│   │   │   │   ├── invoice-items.ts
│   │   │   │   ├── custom-orders.ts
│   │   │   │   ├── rate-locks.ts
│   │   │   │   ├── try-at-home-bookings.ts
│   │   │   │   ├── loyalty.ts
│   │   │   │   ├── reviews.ts
│   │   │   │   ├── view-events.ts
│   │   │   │   ├── pmla-aggregates.ts
│   │   │   │   ├── audit-events.ts
│   │   │   │   ├── feature-flags.ts
│   │   │   │   └── index.ts
│   │   │   ├── policies/               # RLS policies (exported as SQL strings used in migrations)
│   │   │   └── migrations/             # Drizzle-generated + hand-edited SQL migrations
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── compliance/                     # GST, HUID, 269ST, PAN, PMLA — the hard-block gateway
│   │   ├── src/
│   │   │   ├── gst/
│   │   │   │   ├── split.ts            # applyGstSplit pure function
│   │   │   │   └── rates.ts            # GST_METAL_RATE_BP, GST_MAKING_RATE_BP
│   │   │   ├── cash-cap/
│   │   │   │   └── section-269st.ts    # enforce269ST + override269ST
│   │   │   ├── pan/
│   │   │   │   └── rule-114b.ts        # enforcePanRequired, validate PAN format
│   │   │   ├── pmla/
│   │   │   │   ├── cumulative.ts       # trackPmlaCumulative
│   │   │   │   └── ctr-template.ts     # generateCtrTemplate
│   │   │   ├── huid/
│   │   │   │   └── validate.ts         # validateHuidPresence + format check
│   │   │   ├── urd-rcm/
│   │   │   │   └── self-invoice.ts     # buildUrdSelfInvoice
│   │   │   ├── tcs/
│   │   │   │   └── bullion.ts          # computeTcsOnBullion
│   │   │   ├── rules-versioning.ts     # Rule set version per compliance-rules-versions table
│   │   │   └── errors.ts               # ComplianceHardBlockError hierarchy
│   │   └── package.json
│   │
│   ├── money/                          # Money + Weight + Purity primitives
│   │   ├── src/
│   │   │   ├── money.ts                # MoneyInPaise, arithmetic, formatting
│   │   │   ├── weight.ts               # Weight (grams, DECIMAL), arithmetic
│   │   │   ├── purity.ts               # Purity enum + helpers
│   │   │   └── rounding.ts             # Rules for paise-down, gram-to-4dp
│   │   └── package.json
│   │
│   ├── tenant-config/                  # Shop settings resolver, feature flags, theme resolver
│   │   ├── src/
│   │   │   ├── settings/
│   │   │   ├── feature-flags/          # GrowthBook client wrapper
│   │   │   ├── theme/                  # resolveTheme(tenantConfig) -> ResolvedTokens
│   │   │   └── cache/                  # Redis-backed cache
│   │   └── package.json
│   │
│   ├── integrations/                   # Vendor adapters — swap = rewrite this only
│   │   ├── rates/
│   │   │   ├── src/
│   │   │   │   ├── port.ts             # RatesPort interface
│   │   │   │   ├── ibja-adapter.ts
│   │   │   │   ├── metalsdev-adapter.ts
│   │   │   │   └── fallback-chain.ts
│   │   │   └── package.json
│   │   ├── payments/                   # Razorpay + Cashfree adapters
│   │   ├── whatsapp/                   # AiSensy adapter
│   │   ├── sms-otp/                    # MSG91 adapter
│   │   ├── kyc/                        # Digio (Phase 4+)
│   │   ├── maps/                       # Ola Maps
│   │   ├── push/                       # Firebase Cloud Messaging
│   │   ├── analytics/                  # PostHog client wrapper
│   │   ├── errors/                     # Sentry client wrapper
│   │   ├── email/                      # Resend → SES
│   │   ├── storage/                    # S3 + ImageKit
│   │   ├── huid-verification/          # Surepass
│   │   └── auth/                       # Supabase Auth adapter
│   │
│   ├── sync/                           # Offline-sync protocol (server endpoints + client adapter)
│   │   ├── src/
│   │   │   ├── server/                 # Used by apps/api/modules/sync
│   │   │   │   ├── pull.ts
│   │   │   │   ├── push.ts
│   │   │   │   └── cursor.ts
│   │   │   ├── client/                 # Used by apps/shopkeeper
│   │   │   │   ├── watermelon-adapter.ts
│   │   │   │   └── conflict-policies.ts
│   │   │   └── protocol.ts             # Shared types
│   │   └── package.json
│   │
│   ├── api-client/                     # Generated OpenAPI client + Zod integration
│   │   ├── src/
│   │   │   ├── generated/              # openapi-typescript output (committed)
│   │   │   ├── client.ts               # Fetcher with auth + tenant header + retry
│   │   │   ├── hooks/                  # TanStack Query hooks per resource
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── audit/                          # auditLog() helper + event type registry
│   │   ├── src/
│   │   │   ├── logger.ts
│   │   │   └── actions.ts              # AuditAction enum
│   │   └── package.json
│   │
│   ├── observability/                  # Sentry, OTel, logger config shared across apps
│   │   ├── src/
│   │   │   ├── sentry.ts
│   │   │   ├── otel.ts
│   │   │   ├── logger.ts               # Pino setup with context bag
│   │   │   └── metrics.ts
│   │   └── package.json
│   │
│   ├── security/                       # Envelope encryption + secrets + JWT helpers
│   │   ├── src/
│   │   │   ├── envelope.ts             # encryptPII / decryptPII
│   │   │   ├── secrets.ts              # AWS Secrets Manager client
│   │   │   └── jwt.ts                  # Verify + issue helpers
│   │   └── package.json
│   │
│   ├── i18n/                           # ICU catalogs + runtime
│   │   ├── src/
│   │   │   ├── locales/
│   │   │   │   ├── hi-IN/
│   │   │   │   │   ├── common.json
│   │   │   │   │   ├── billing.json
│   │   │   │   │   ├── compliance.json
│   │   │   │   │   └── ... (per domain)
│   │   │   │   └── en-IN/
│   │   │   ├── runtime.ts              # i18n.t() + formatters
│   │   │   └── locale-aware-text.tsx   # LocaleAwareText primitive
│   │   └── package.json
│   │
│   ├── ui-tokens/                      # Design tokens (colors, typography, spacing, motion, elevation)
│   │   ├── src/
│   │   │   ├── colors.ts
│   │   │   ├── typography.ts
│   │   │   ├── spacing.ts
│   │   │   ├── motion.ts
│   │   │   ├── elevation.ts
│   │   │   └── hct.ts                  # HCT palette generator
│   │   └── package.json
│   │
│   ├── ui-web/                         # Web component library (Tier 0-3 per UX spec)
│   │   ├── src/
│   │   │   ├── primitives/             # Tier 0 — vendored shadcn + overrides
│   │   │   ├── composed/               # Tier 1 — FormField, ActionSheet, EmptyState, LocaleAwareText
│   │   │   ├── atoms/                  # Tier 2 — RateWidget, HUIDMedallion, PriceBreakdownCard, SariBorderDivider, ShopCard, etc.
│   │   │   └── business/               # Tier 3 — ProductCard, InvoiceLineItem, CustomerContextCard, CustomOrderStageTracker, etc.
│   │   ├── stories/                    # Storybook stories (Hindi + English + 2-tenant-theme)
│   │   ├── .storybook/
│   │   └── package.json
│   │
│   ├── ui-mobile/                      # React Native component library (NativeWind-based)
│   │   ├── src/
│   │   │   ├── primitives/
│   │   │   ├── composed/
│   │   │   ├── atoms/
│   │   │   └── business/
│   │   ├── stories/                    # React Native Storybook stories
│   │   └── package.json
│   │
│   └── testing/                        # Shared test harnesses + fixtures
│       ├── tenant-isolation/           # Harness (ships with Epic 1)
│       ├── weight-precision/           # 10K-transaction harness
│       ├── compliance-gates/           # Every NFR-C* has a test
│       ├── offline-sync/               # Conflict-resolution test scenarios
│       ├── fixtures/                   # Factory functions for shops, customers, products, invoices
│       └── package.json
│
├── infra/
│   ├── terraform/
│   │   ├── modules/
│   │   │   ├── network/
│   │   │   ├── database/
│   │   │   ├── cache/
│   │   │   ├── compute/
│   │   │   ├── storage/
│   │   │   ├── dns-and-tls/
│   │   │   ├── secrets/
│   │   │   ├── observability/
│   │   │   └── ci-roles/
│   │   ├── envs/
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── prod/
│   │   └── backend.tf                  # S3 state + DynamoDB lock
│   └── scripts/                        # Operational scripts (tenant-provision, backup-verify, etc.)
│
├── ops/
│   ├── semgrep/
│   │   ├── tenant-safety.yaml          # shop_id param ban, SET LOCAL enforcement
│   │   ├── money-safety.yaml           # FLOAT/REAL ban
│   │   ├── compliance-gates.yaml       # Enforce packages/compliance calls
│   │   ├── theme-tokens.yaml           # Hex-color ban in customer-facing apps
│   │   └── secrets-scan.yaml
│   ├── eslint-plugin-goldsmith/        # Custom ESLint rules
│   ├── storybook/                      # Root Storybook aggregator
│   └── lighthouse/                     # Lighthouse CI config
│
├── docs/
│   ├── prd.md                          # Symlink/copy of _bmad-output/planning-artifacts/prd.md for easier dev access
│   ├── ux-design.md                    # Symlink/copy
│   ├── architecture.md                 # Symlink/copy (this doc)
│   ├── adr/                            # Architectural Decision Records
│   │   ├── 0001-auth-provider-supabase.md
│   │   ├── 0002-multi-tenant-single-db-rls.md
│   │   ├── 0003-money-weight-decimal-primitives.md
│   │   ├── 0004-offline-sync-protocol.md
│   │   ├── 0005-tenant-context-defense-in-depth.md
│   │   ├── 0006-vendor-adapter-pattern.md
│   │   ├── 0007-near-real-time-polling-mvp.md
│   │   ├── 0008-white-label-shared-app-theming.md
│   │   ├── 0009-monorepo-modular-monolith-layout.md
│   │   ├── 0010-tenant-provisioning-automation.md
│   │   ├── 0011-compliance-package-hard-block-gateway.md
│   │   └── 0012-iac-terraform-over-cdk.md
│   ├── stories/                        # BMAD Create Epics & Stories output
│   ├── runbooks/
│   │   ├── incident-response.md
│   │   ├── tenant-isolation-breach.md
│   │   ├── payment-webhook-failure.md
│   │   ├── ibja-rate-outage.md
│   │   ├── whatsapp-send-failure.md
│   │   ├── mass-customer-deletion-request.md
│   │   ├── wedding-season-load-prep.md
│   │   ├── tenant-provisioning.md
│   │   ├── tenant-offboarding.md
│   │   └── ctr-str-filing.md
│   ├── threat-model.md                 # STRIDE per Agency Delivery Protocol
│   ├── feature-flags.md
│   ├── data-retention.md               # DPDPA + PMLA retention policies
│   ├── dependency-review.md
│   └── dev-setup.md
│
├── plans/                              # Agency Delivery Protocol per-story plans
│
├── _bmad/                              # BMAD-METHOD framework
├── _bmad-output/                       # BMAD workflow artifacts (planning-artifacts/, implementation-artifacts/)
│
├── .bmad-readiness-passed              # Marker file (required per CLAUDE.md before coding begins)
└── .codex-review-passed                # Marker file set on successful Codex review
```

### Architectural Boundaries

**API boundaries (outside ↔ inside):**
- **Public HTTP boundary**: ALB + CloudFront. Terminates TLS, enforces WAF rules, rate-limits per IP. Only `/api/v1/**` passes to NestJS; static assets served from S3 via CloudFront.
- **Authentication boundary**: NestJS `JwtAuthGuard` (for authenticated endpoints) + public endpoints whitelist. JWT verification happens before tenant resolution.
- **Tenant boundary**: `TenantInterceptor` after auth — if tenant resolution fails, 400 or 403. All downstream code trusts `TenantContext`.
- **Compliance boundary**: Every write to money-affecting tables goes through `packages/compliance` gates; no direct DB write skips this.
- **Data access boundary**: Services never touch DB directly; only via repositories. Repositories always wrap queries in `db.transaction` with `SET LOCAL app.current_shop_id`. Code reviewer rejects violations.

**Component boundaries (frontend):**
- Tier 0 primitives (`packages/ui-*/primitives`) have NO knowledge of domain concepts — pure rendering + accessibility + theming.
- Tier 2 domain atoms (`packages/ui-*/atoms`) know about jewellery concepts (HUID, rate, purity, gold medallion) but don't fetch data.
- Tier 3 business components (`packages/ui-*/business`) compose atoms + hooks; still no direct HTTP.
- Tier 4 screens (`apps/*/features/*`) are the only place that calls API client hooks.
- Import rule enforced by ESLint: `apps/*` can import from `packages/*`; `packages/ui-*/atoms` cannot import from `packages/ui-*/business`; `packages/*` cannot import from `apps/*` (reverse-dep is illegal).

**Service boundaries (backend):**
- Each `apps/api/modules/<domain>` is a bounded context. Services in module A call services in module B only via injected NestJS providers OR via emitted domain events — never by reaching into another module's repository.
- Cross-module events: published to `EventEmitter2` (in-process) + optionally enqueued to BullMQ for async cross-module work.
- Modules share data only via well-typed read models (e.g., Loyalty reads Invoice's final total via an interface, not by joining invoice_items in the Loyalty repo).
- Platform-admin module has higher privilege: bypass-RLS via `SECURITY DEFINER` Postgres functions that enforce platform-admin role + audit-log the call.

**Data boundaries:**
- Tenant-scoped tables (most): `shop_id` + RLS + foreign keys.
- Platform-global tables (few): `ibja_rate_snapshots`, `compliance_rules_versions`, `feature_flags_defaults`, `countries`, `plans` — no `shop_id`, read by all tenants.
- Cross-tenant tables (none): Every query is scoped to one tenant (customer-who-shops-at-multiple-jewellers is modeled as `customer_tenant_link(customer_id, shop_id, opted_in_viewing, ...)` — per-shop record).
- Cache boundaries: tenant-prefixed Redis keys; no shared keys for mutable tenant data.
- File boundaries: S3 keys prefixed `tenants/<shop_id>/...`; IAM policies restrict tenant-scoped pre-signed URLs.

### Requirements-to-Structure Mapping

Every PRD FR + UX spec screen maps to a specific directory. This is the authoritative traceability table for BMAD Create Epics & Stories (CE).

| PRD FR Area | Backend module | Frontend (shopkeeper) | Frontend (customer) | Frontend (admin) | Shared packages |
|---|---|---|---|---|---|
| FR1–7 Tenant | `modules/tenant` | — | — | `admin/app/tenants/**`, `admin/app/provision` | `packages/tenant-config`, `packages/db/schema/shops.ts` |
| FR8–15 Auth | `modules/auth` | `shopkeeper/app/(auth)` | `customer/app/(auth)` | `admin/app/login`, `admin/middleware.ts` | `packages/security/jwt.ts`, `packages/integrations/auth/supabase-auth` |
| FR16–24 Settings | `modules/settings` | `shopkeeper/features/settings` + `shopkeeper/app/settings/**` | — | — | `packages/tenant-config/settings` |
| FR25–34 Inventory | `modules/inventory` | `shopkeeper/features/inventory` + `shopkeeper/app/inventory/**` | (read via catalog) | — | `packages/db/schema/products.ts` |
| FR35–40 Pricing | `modules/pricing` | `shopkeeper/features/rate-widget` | `customer/features/catalog` (rate display) | — | `packages/integrations/rates` |
| FR41–55 Billing | `modules/billing` | `shopkeeper/features/billing` + `shopkeeper/app/billing/**` | — | — | `packages/compliance` (all gates), `packages/money`, `packages/integrations/payments` |
| FR56–63 CRM | `modules/crm` | `shopkeeper/features/crm` + `shopkeeper/app/customer/**` | — | — | `packages/db/schema/customers.ts` |
| FR64–68 Viewing Analytics | `modules/viewing-analytics` | `shopkeeper/features/viewing-analytics` | `customer/features/tracking` (event emit + consent) | — | `packages/integrations/analytics` |
| FR69–72 Loyalty | `modules/loyalty` | `shopkeeper/features/loyalty` | `customer/features/loyalty` | — | — |
| FR73–79 Custom Order | `modules/custom-order` | `shopkeeper/features/custom-order` | `customer/features/custom-order` + `customer/app/custom-order/[id]` | — | State machine in `modules/custom-order/state-machine.ts` |
| FR80–83 Rate-Lock | `modules/rate-lock` | `shopkeeper/features/rate-lock` | `customer/features/rate-lock` + `customer/app/rate-lock/**` | — | Razorpay adapter |
| FR84–85 Try-at-Home | `modules/try-at-home` | `shopkeeper/features/try-at-home` | `customer/features/try-at-home` | — | — |
| FR86–99 Catalog/Browse | `modules/catalog` (+ `sync` for updates) | — | `customer/features/catalog`, `customer/features/product-detail`, `customer/features/wishlist`, `customer/features/huid-verify` | — | `packages/integrations/huid-verification`, `packages/integrations/search` |
| FR100–106 Reviews/Sizes/Policies | `modules/reviews`, `modules/policies` | `shopkeeper/features/reviews` | `customer/features/reviews`, `customer/features/size-guide`, `customer/features/policies` | — | — |
| FR107–112 Notifications | `modules/notifications` + worker | (consumer) | (consumer) | (consumer) | `packages/integrations/whatsapp`, `packages/integrations/sms-otp`, `packages/integrations/push`, `packages/integrations/email` |
| FR113–119 Reports | `modules/reports` + worker | `shopkeeper/features/reports` + `shopkeeper/app/reports/**` | — | `admin/app/dashboard` (cross-tenant) | — |
| FR120–126 Platform Admin | `modules/platform-admin` | — | — | `admin/app/**` | `packages/audit` (impersonation) |

**Cross-cutting concerns → location map:**
- Tenant context + RLS → `packages/db` + `apps/api/common/interceptors/tenant.interceptor.ts` + `apps/api/common/providers/db.provider.ts`.
- Compliance gates → `packages/compliance` (only).
- Money/weight → `packages/money` (only).
- Audit logging → `packages/audit` + `apps/api/common/interceptors/audit.interceptor.ts`.
- Feature flags → `packages/tenant-config/feature-flags`.
- Theming → `packages/ui-theme` + `packages/ui-tokens` + `packages/ui-web/providers` + `packages/ui-mobile/providers`.
- i18n → `packages/i18n`.
- Offline sync → `packages/sync` + `apps/api/modules/sync` + `apps/shopkeeper/src/db/sync`.
- Observability → `packages/observability`.
- Security → `packages/security`.
- Test harnesses → `packages/testing`.

### Integration Points

**Internal communication:**
- Frontend → Backend: typed REST via `packages/api-client` (generated from OpenAPI).
- Frontend (shopkeeper) ↔ WatermelonDB: direct read/write to local DB; sync via `packages/sync/client` to `/api/v1/sync/*` endpoints.
- Backend module ↔ Module: direct NestJS provider injection for sync calls; `EventEmitter2` for fire-and-forget; BullMQ for durable async work.
- Backend ↔ DB: only via repositories inside `db.transaction(SET LOCAL app.current_shop_id...)`.
- Backend ↔ Cache: `packages/tenant-config/cache` (tenant-prefixed keys only).
- Backend ↔ Queue: `@nestjs/bullmq` producer/consumer in workers; durable persistence via Redis.

**External integrations (all via adapter-port pattern):**

```
NestJS module → depends on → Port interface (in packages/integrations/<vendor>/port.ts)
                              ↑
Adapter implementation (primary vendor)   ←   configured via `INTEGRATIONS_MANIFEST` env/config
Adapter implementation (fallback vendor)
Mock adapter (for tests)
```

- Rates: `RatesPort` ← IbjaAdapter (primary) → MetalsDevAdapter (fallback) → LastKnownGoodCache (final fallback).
- Payments: `PaymentsPort` ← RazorpayAdapter (primary) / CashfreeAdapter (secondary).
- WhatsApp: `WhatsAppPort` ← AiSensyAdapter (primary) — MVP has no secondary; add later if quota/cost forces.
- SMS-OTP: `SmsOtpPort` ← Msg91Adapter — Supabase Auth uses this for delivery; backup via Twilio deferred.
- Push: `PushPort` ← FcmAdapter.
- Maps: `MapsPort` ← OlaMapsAdapter.
- Storage: `StoragePort` ← S3Adapter (for primary storage) + `ImagePort` ← ImageKitAdapter (for image delivery).
- Analytics: `AnalyticsPort` ← PostHogAdapter.
- Errors: `ErrorsPort` ← SentryAdapter.
- Email: `EmailPort` ← ResendAdapter (MVP) → SesAdapter (Phase 2+).
- HUID verify: `HuidVerifyPort` ← SurepassAdapter.
- Auth: `AuthPort` ← SupabaseAuthAdapter.
- KYC: `KycPort` ← DigioAdapter (Phase 4+).

**Data flow — invoice generation (representative):**
```
Shopkeeper app [billing screen]
  → PATCH /api/v1/invoices/:id (draft update, offline-first to WatermelonDB)
  → POST /api/v1/invoices (on submit, with Idempotency-Key)
     → TenantInterceptor (resolves shopId) + RoleGuard
     → BillingController
     → BillingService.create(ctx, dto)
        → applyGstSplit (packages/compliance)
        → validateHuidPresence (packages/compliance)
        → enforcePanRequired (packages/compliance)
        → enforce269ST (packages/compliance) — checks pmla cash aggregate
        → RatesPort.getRate(ctx) — IBJA via cache
        → MoneyInPaise total computed (packages/money)
        → InvoiceRepository.insert (Drizzle tx with SET LOCAL app.current_shop_id, RLS enforces)
        → auditLog (packages/audit)
        → EventEmitter.emit('invoice.created')
           → LoyaltyService (accrue points) [sync in-process]
           → InventoryService (decrement stock) [sync]
           → BullMQ enqueue notifications-dispatch (WhatsApp invoice share)
           → BullMQ enqueue search-indexer (customer history reindex)
           → BullMQ enqueue viewing-analytics-update (customer activity)
           → BullMQ enqueue compliance-pmla-update (update monthly aggregate)
        → return Invoice DTO
  → 201 Created + Location header + invoice JSON
  → Client updates TanStack Query cache + navigates to success screen + haptic + WhatsApp share sheet

  [Customer app next poll within 30s picks up product's new "sold" status via sync cursor]
```

### File Organization Patterns

**Configuration files:** Root-level for cross-monorepo (`turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `commitlint.config.js`). Per-app config in each `apps/*/` and per-package in `packages/*/` — each extending root base.

**Source organization:** apps/* own screens + features; packages/* own reusable code; infra/* owns IaC; ops/* owns build-time tooling; docs/* owns human-readable docs.

**Test organization (layered):**
- Unit: co-located `*.test.ts` next to source. Uses Vitest (packages + Next.js) or Jest (NestJS).
- Integration: `apps/api/test/integration/` against ephemeral Postgres (testcontainers); `apps/*/e2e/` for frontend with MSW or real backend-on-localhost.
- E2E: `apps/web/e2e/` (Playwright); `apps/shopkeeper/e2e/` + `apps/customer/e2e/` (Detox).
- Harnesses: `packages/testing/*` provide shared fixtures, factories, and the tenant-isolation / weight-precision / compliance-gates suites invoked from CI.

**Asset organization:** Tenant-agnostic assets in `apps/*/public/`; tenant-specific assets in S3/`tenants/<shop_id>/...` served via ImageKit.

### Development Workflow Integration

**Dev server:** `turbo dev` runs all four apps + API concurrently; Metro for mobile, Next.js dev server for web, NestJS watch mode for API. Shared packages rebuild on change via Turborepo's pipeline deps.

**Build process:** `turbo build` with remote cache. Per-app build outputs: `apps/api/dist` (NestJS), `apps/web/.next` (Next.js), `apps/admin/.next`, `apps/shopkeeper/dist` (Expo web only), `apps/customer/dist`. Mobile binaries produced by EAS Build on-demand.

**Deployment:** GitHub Actions triggers per-app deploys on merge to main → ECR push → Terraform apply (prod requires approval) → ALB target group rotates → health check gates go-live. Mobile: EAS Submit on tag.

### A+P Synthesis

- **A1 Graph of Thoughts:** Built the structure as a dependency graph (apps depend on packages; packages can depend on packages only if lower in the hierarchy: `shared` < `db`/`money`/`compliance` < `tenant-config` < `audit` < `integrations/*` < `sync` < `api-client` < `ui-tokens` < `ui-mobile`/`ui-web`). ESLint rule enforces this DAG.
- **A2 Comparative matrix (module organization):** Feature-folders vs domain-modules vs layer-folders. Chose domain-modules for `apps/api` (NestJS convention + bounded-context clarity) + feature-folders for frontend apps (co-locates screens + hooks + state per feature). Best of both.
- **A3 Pre-mortem (structure):** "The structure broke because…" — (1) a package circular-dependency (fix: ESLint `no-restricted-imports` + Turborepo's automatic dep-graph); (2) apps reaching into packages/ internal files (fix: package.json `exports` map restricts public API); (3) ADRs never written (fix: CI rule — any PR modifying locked-decision files in `packages/compliance`, `packages/money`, tenant-config requires ADR link).
- **A4 Self-consistency check:** Verified every PRD capability area has a home; every UX surface has a feature folder; every state machine has a file; every vendor has an adapter package.
- **A5 Lessons learned (agency templates):** The agency-templates scaffold already places `/docs`, `/_bmad-output`, `/plans`, and CI/review gates — we extend that, don't fight it.

- **P Party Mode (Winston + Amelia + John + Paige):**
  - **Winston:** Structure mirrors the bounded-context decomposition from Step 4; package DAG is the enforcement mechanism.
  - **Amelia:** Every PRD FR has a specific file path — Dev Story agent can generate code without ambiguity about where things go.
  - **John:** Requirements-to-structure mapping is the handoff artifact for Create Epics & Stories (CE); each epic's story points to specific modules/packages.
  - **Paige:** ADR numbering + docs/ placement + runbook naming are uniform; easy to search, easy to onboard.

**Synthesis:** Full directory tree for 4 apps + 15 packages + infra + ops + docs; explicit package dependency DAG enforced by ESLint + Turborepo; requirements-to-structure mapping for all 126 FRs; ADR 0001–0012 to be authored in Step 8.

---

## Architecture Validation Results

### Coherence Validation

**Decision compatibility — PASS.**
- Every locked stack component has a first-class home in the structure (`apps/*` + `packages/*`).
- Version ecosystem is internally consistent: TypeScript 5 + Node 20 LTS + React 18 + Next.js 14 + NestJS 10+ + Drizzle latest + Expo SDK 50+ + Turborepo latest + pnpm 8+.
- No contradictions: the choice to defer WebSocket sync is compatible with TanStack Query polling; the modular-monolith backend is compatible with RLS (one DB, many bounded contexts); adapter-pattern vendors are compatible with the per-tenant feature-flag model.

**Pattern consistency — PASS.**
- Naming conventions consistent across DB (snake_case) / API wire (camelCase) / code (camelCase) / enums (SCREAMING_SNAKE) / files (kebab-case) / components (PascalCase) — with explicit transformation boundaries.
- Structure patterns mirror bounded contexts: NestJS module-per-domain + frontend feature-folders + shared packages in dependency DAG.
- Communication patterns match technology choices: in-process `EventEmitter2` for same-request side effects + BullMQ for durable async + polling for cross-app sync.

**Structure alignment — PASS.**
- Project tree has a specific file path for every PRD FR (126/126 mapped in Requirements-to-Structure table).
- Package dependency DAG (enforced via ESLint) prevents cross-domain leakage; each bounded context can be extracted to a microservice later via the module boundary without refactoring.
- Cross-cutting concerns (tenant, compliance, money, audit, theme, i18n, sync, observability, security) each have a single owner package — no duplication risk.

### Requirements Coverage Validation

**PRD FRs — 126/126 covered (100%).**
Spot-checks below; full table in Requirements-to-Structure Mapping (§6):

| Sample FR | Validation |
|---|---|
| FR1 (platform admin create tenant) | `apps/admin/app/provision` + `apps/api/modules/tenant.service.create()` + `packages/db/schema/shops.ts` + `infra/scripts/tenant-provision.ts` |
| FR5 (strict tenant isolation) | RLS policy on every tenant-scoped table (§db/policies) + `TenantInterceptor` (apps/api/common) + `packages/testing/tenant-isolation` suite (runs on every CI) |
| FR30 (30-sec sync) | `apps/api/modules/sync` push endpoint + `apps/shopkeeper/src/db/sync` WatermelonDB adapter + `TanStack Query refetchInterval: 5-30s` in `apps/customer` + customer web |
| FR40 (price formula) | `packages/money` + `packages/compliance/gst` — pure functions; consumed from billing + catalog |
| FR46 (PAN hard-block at Rs 2L) | `packages/compliance/pan/rule-114b.ts#enforcePanRequired` — throws `ComplianceHardBlockError('compliance.pan.required')`; UI surfaces per UX spec `ComplianceInlineAlert` |
| FR47 (Section 269ST hard-block) | `packages/compliance/cash-cap/section-269st.ts#enforce269ST` + `override269ST` with audit; UI via `ComplianceInlineAlert` / ComplianceBlockModal |
| FR53 (PMLA cumulative cash) | `packages/compliance/pmla/cumulative.ts` + `pmla_aggregates` DB table (append-only) + BullMQ `compliance-pmla` worker + CTR template generator |
| FR64-68 (viewing analytics) | `apps/api/modules/viewing-analytics` + `packages/integrations/analytics` (PostHog) + consent-before-capture in `apps/customer/features/tracking` |
| FR91 (HUID QR scan) | `apps/customer/app/huid-scan.tsx` + `apps/customer/features/huid-verify` + `packages/integrations/huid-verification` (Surepass) + UX ceremony component `HUIDCeremony` |
| FR98 (white-label brand exclusivity) | Theme resolver in `packages/ui-theme` + Semgrep rule forbidding platform-brand imports in `apps/customer` and `apps/web` + visual-regression Chromatic |
| FR99 (Hindi/English toggle) | `packages/i18n` + `LocaleAwareText` primitive + locale-aware storage + `lang` attribute propagation |
| FR120-126 (platform admin) | `apps/admin/app/**` + `apps/api/modules/platform-admin` + `packages/audit` for impersonation trail |

**PRD NFRs — 70/70 addressed.**

| NFR category | Architectural home |
|---|---|
| Performance (P1–P12) | Redis hot paths, read replicas (M6+), SSR/SSG for SEO, TanStack Query cache, Hermes, font subsetting, Meilisearch, Lighthouse CI gates, bundle-analyzer CI gate |
| Security (S1–S14) | TLS 1.3 + HSTS, RDS + S3 + EBS encryption, envelope encryption for PAN with per-tenant KMS key, Supabase Auth OTP + rotation, dual RBAC+RLS, 5y audit on WORM, Secrets Manager, Semgrep+Snyk+Trivy CI gates, VPC-private RDS+bastion+MFA |
| Scalability (SC1–SC8) | Horizontal ECS, read replicas at M6, sharding plan in ADR-0009, CDN unbounded, BullMQ tenant partitioning, 10× wedding-season load test runbook |
| Accessibility (A1–A9) | Token-driven design system, HCT-generated accessible palette, axe-core + Lighthouse CI, LocaleAwareText, Hindi TalkBack support, ≥48dp targets, senior-friendly base font + spacing multipliers |
| Integration (I1–I8) | Adapter-pattern via `packages/integrations/*`, circuit breaker + fallback chain for IBJA, webhook idempotency, per-tenant AiSensy quota, exponential backoff + DLQ |
| Reliability (R1–R11) | Multi-AZ RDS + ElastiCache + ECS; RTO/RPO targets mapped; 10 runbooks in `docs/runbooks/`; alerts per critical path; error-budget tracking |
| Compliance (C1–C9) | `packages/compliance` hard-block gateway; DPDPA consent at customer signup; data residency enforced at IaC + SCP; vendor DPAs tracked; 5y retention |

**UX spec coverage — 6/6 journeys + 5/5 state machines + 4-tier components + 6 journey flows + responsive + a11y all mapped to architecture.**

**IR report risks (§5) — all addressed:**
- Deep dependency chain in EPIC 5 (Billing) — addressed by `packages/compliance` + `packages/money` shipped in Epic 1 so Epic 5 has zero internal dep blockers.
- Near-real-time sync spanning EPIC 3+7 — addressed by sync endpoints in Epic 3 + customer read-path using same cursor protocol in Epic 7.
- Consent-before-events for EPIC 12 — addressed by FR68 consent flow in Epic 6 (CRM) shipped before Epic 12 (Analytics).
- EPIC 16 "Anchor Launch Hardening" reframe — addressed in §Decision Impact Analysis as specific hardening stories (wedding-season load test, pentest, DR drill, runbook rehearsal); CE will split further.
- Tenant isolation + weight-precision test suites from Sprint 1 — shipped in `packages/testing` as Epic 1 deliverable.

### Implementation Readiness Validation

**Decision completeness — READY.**
- 12 critical decisions locked with rationale + rejected alternatives (ADR 0001–0012 will formalize each).
- Versions pinned to latest stable (exact patches set at Epic 1 Story 1 time of `pnpm init`).
- Implementation patterns comprehensive (10 binding "MUST" rules + 6 enforcement layers + worked examples).

**Structure completeness — READY.**
- All 4 apps + 15 packages + infra + ops + docs directories defined.
- Every file boundary explicit.
- Package dependency DAG enforceable via ESLint + Turborepo.

**Pattern completeness — READY.**
- Naming conventions span DB / API / code / files / tokens / tests.
- Communication patterns cover events / jobs / state machines / webhooks / sync.
- Process patterns cover errors / retries / loading / validation / auth / compliance / audit / tenant-context / theming / i18n / feature flags / observability.
- All patterns have enforcement mechanism (ESLint / Semgrep / CI / Codex review / code-reviewer agent / Storybook VR).

### Gap Analysis Results

**Critical gaps — NONE.**

**Important gaps (address in subsequent work, not blockers for CE):**
1. **Exact Zod schema definitions for all 126 FRs** — structure says where they go; content authored per-story (Epic 1 ships the shared-schemas package skeleton; each Epic fills its schemas).
2. **Detailed RLS policy SQL per table** — policy template in `packages/db/src/policies` will be written during Epic 1 Story 2; this architecture specifies the pattern.
3. **Full OpenAPI specification per endpoint** — generated during Dev Story execution from NestJS decorators; architecture specifies the contract format.
4. **Exact Terraform module implementations** — scaffolded from agency templates; Epic 1 Story 1 delivers the skeleton; per-service modules ship with their epic.
5. **Specific ADR bodies** — Step 8 drafts them.
6. **IBJA rate caching TTL + fallback thresholds exact values** — specified architecturally (15-min refresh, stale-indicator > 30 min, cache fallback on error); exact TTLs tuned during integration testing.

**Nice-to-have gaps (post-MVP):**
- Sharding implementation (documented in ADR-0009 with trigger conditions; not implemented).
- Cross-region DR runbook details (RDS snapshot cross-region replication wiring; scheduled for Phase 4+).
- Event-sourcing migration plan (current `audit_events` is append-only but not full ES; would consider at Phase 3+ if compliance audit queries grow complex).
- BFF extraction plan (currently a single API serves all 4 apps; BFF per app is a Phase 4+ option if client-specific shapes diverge).
- Per-tenant native app builds (FR expansion when tenant count + commercial terms justify).

**Validation issues raised + resolved inline:**
- Observed that customer-web's SEO-friendly rendering (SSG/SSR) requires per-tenant build artifacts or dynamic SSR with tenant resolution — resolved via Next.js `middleware.ts` resolving tenant from host header + ISR with per-tenant cache keys. No per-tenant build needed.
- Observed that offline-sync needs server to provide monotonic cursor — resolved by using a Postgres SEQUENCE (one per tenant) as source of truth; cursor returned per-table as `(shop_id, table_name, seq)`.
- Observed that compliance engine versioning needs runtime switchover (e.g., GST rate change) — resolved by `compliance_rules_versions` table + `rules-versioning.ts` dispatching to the active version; migrations don't change behaviour mid-deploy.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (PRD 126 FRs + 70 NFRs + 6 journeys)
- [x] UX spec integrated (Direction C, 4-tier components, 5 state machines, 6 flows)
- [x] Scale and complexity assessed (HIGH — 6 simultaneous hard problems)
- [x] Technical constraints identified (locked stack, non-negotiables, compliance, data residency)
- [x] Cross-cutting concerns mapped (14 concerns, each with owner + enforcement)

**Architectural Decisions**
- [x] Critical decisions locked (12 ADRs scoped)
- [x] Technology stack fully specified
- [x] Integration patterns defined (adapter pattern + ports + fallback + circuit breaker)
- [x] Performance considerations addressed (hot-path cache, SSR/SSG, polling strategy, wedding-season scaling)
- [x] Security baseline defined (defense-in-depth RBAC+RLS, envelope encryption, audit, secrets)
- [x] Data residency enforced at IaC + SCP + vendor DPA review

**Implementation Patterns**
- [x] Naming conventions (DB / API / code / files / tokens)
- [x] Structure patterns (modules / features / packages)
- [x] Communication patterns (events / jobs / state machines / webhooks / sync)
- [x] Process patterns (error / retry / loading / auth / compliance / audit / tenant / theme / i18n / flags / observability)
- [x] 10 binding "MUST" rules with 6 enforcement layers
- [x] Worked examples for 3 highest-risk areas

**Project Structure**
- [x] Complete directory tree (4 apps + 15 packages + infra + ops + docs)
- [x] Component boundaries per-tier + dependency DAG
- [x] Integration points mapped (REST + events + jobs + sync protocol)
- [x] Requirements-to-structure mapping for 126 FRs
- [x] Cross-cutting concern owners assigned

**Validation**
- [x] Coherence validated
- [x] Requirements coverage validated (126/126 FRs + 70/70 NFRs)
- [x] Implementation readiness confirmed
- [x] Gaps classified (critical / important / nice-to-have); no criticals open
- [x] IR report risks addressed

### Architecture Readiness Assessment

**Overall status:** READY FOR CREATE EPICS & STORIES (CE) + DEV CYCLE

**Confidence:** HIGH.
- Every PRD FR has a code home; every NFR has an enforcement mechanism.
- Defense-in-depth on the two highest-risk concerns (tenant isolation, compliance) is architectural, not reliant on discipline.
- The modular-monolith decision preserves shipping speed for a 5-FTE team while preserving extraction optionality for post-MVP scale.
- Every locked decision will be backed by an ADR (Step 8) with explicit context + consequences + rejected alternatives — downstream agents + future teams understand WHY.

**Key strengths:**
1. **Tenant isolation is structural, not procedural** — RLS + interceptor + test suite from Sprint 1 prevent the #1 multi-tenant failure mode.
2. **Compliance is a package, not a feature** — `packages/compliance` is the single authority for GST, 269ST, PAN, PMLA, HUID; no feature can inline its own version.
3. **Money + weight are types, not numbers** — `packages/money` makes weight-precision errors compile-time errors in most cases.
4. **White-label is architectural** — Semgrep prevents platform-brand leak; theme is resolved at request/render time from tenant config.
5. **Stack minimalism for operability** — one API, one DB, one Redis, one search, one queue — a 0.5-FTE DevOps can operate.
6. **Adapter pattern preserves vendor optionality** — AiSensy, IBJA, Razorpay, etc., all swap-able.
7. **Tests are infrastructure, not an afterthought** — tenant-isolation + weight-precision + compliance-hard-block suites ship in Epic 1.
8. **Observability from Day 1** — DAU/WAU/MAU telemetry is live when customer app launches, enabling the Month-6 engagement pivot per PRD success criteria.

**Areas for future enhancement (by phase):**
- Phase 2: read replica for reports; more i18n keys (festival campaigns); karigar module scaffold; GSTR-1/3B JSON export; tenant self-service provisioning admin flows.
- Phase 3: WebSocket/SSE real-time; long-poll fallback for rate + custom-order updates; Meilisearch tuning at 10+ tenants; feature-flag A/B experimentation.
- Phase 4: per-tenant native iOS/Android apps; cross-region DR cutover; sharding if contention forces; BFF extraction if apps diverge; full event sourcing for audit.

### Implementation Handoff

**For CE (Create Epics & Stories) workflow:**
- Consume this architecture + PRD §9 Scoping + PRD §10 FRs + UX spec §Flows.
- Use Requirements-to-Structure Mapping to locate code homes.
- Apply IR-report risk mitigations: user-value framing on EPIC 1/4/13/15; eliminate EPIC 16 or split into specific hardening stories; sequence internal dependencies within EPIC 5; consent-before-tracking in EPIC 12.
- Every story references: (a) the FR(s) it implements, (b) the module(s) and package(s) it touches, (c) the ADRs that govern its decisions, (d) the pattern rules it must honour, (e) the acceptance tests including tenant-isolation + weight-precision + compliance-gate assertions where applicable.

**For AI agents executing stories:**
- This document is the authoritative solution substrate. Follow it exactly.
- Apply the 10 binding "MUST" rules — CI rejects violations.
- Use package public APIs (exports map); don't reach into package internals.
- Write code that a future reader will understand; pattern consistency > local cleverness.
- Run all 5 layers of review (code-review, security-review, Codex CLI, bmad-code-review, feature-dev:code-reviewer) per Agency Delivery Protocol before push.

**First implementation priority:**
- Epic 1 Story 1 — Monorepo scaffold + enterprise floor + CI green + deployable "Hello World" health endpoint. Literal command sequence in §Starter Template Evaluation.

### A+P Synthesis

- **A1 Critique-and-refine:** First draft glossed over "important gaps" as minor; refined to distinguish critical (zero — all blockers resolved) vs important (delivered inside first few epics, not pre-CE) vs nice-to-have (post-MVP).
- **A2 Reverse-engineering:** Worked backward from "what would break at Month 8" — the failure modes map 1-to-1 to the 10 binding rules + 14 cross-cutting concerns; nothing material left exposed.
- **A3 Stakeholder round table:** Winston ("structure is ready"), Mary ("second-tenant-in-3-weeks is supported"), Murat ("test harnesses are in Epic 1, gating"), Paige ("ADRs + runbooks + threat model structure are in place"), Amelia ("story templates can reference specific paths + ADRs"), John ("user-value framing checklist inherited from IR").
- **A4 Pre-mortem on architecture itself:** "Architecture missed something that bit us in Month 6 because…" — (1) module boundaries eroded (fix: enforced dependency DAG); (2) ADRs were never written (fix: Step 8 authors all 12); (3) compliance rule versions weren't tracked (fix: `compliance_rules_versions` table + rules-versioning module); (4) operators had no runbooks (fix: 10 runbooks authored under `docs/runbooks/`).
- **A5 Comparative matrix (readiness score):** Scored coherence / coverage / readiness / gaps across 4 levels; overall HIGH confidence with ONE conditional: ADRs must be authored in Step 8 to preserve decision context for future teams.

- **P Party Mode (Winston + Mary + Murat + John + Amelia + Paige):**
  - **Winston (Architect):** Architecture is self-consistent + enforceable + adapter-ready for scale. Ready for CE.
  - **Mary (BA):** Tenant provisioning is scripted + tenant-admin console is scoped + second-jeweller path is real. Month-9 target achievable.
  - **Murat (Test Architect):** Test harnesses are first-class. Tenant-isolation + weight-precision suites block from Sprint 1. Compliance hard-block suite is comprehensive. Ready for test-design.
  - **John (PM):** User-value framing handled per IR report; p95 instrumentation from Day 1 enables Month-6 pivot gate.
  - **Amelia (Dev):** Story templates can reference specific paths, ADRs, and pattern rules. Dev Story agent will have unambiguous guidance.
  - **Paige (Tech Writer):** ADR numbering + runbook inventory + threat model + feature-flag doc + retention doc all scoped. Ready to write.

**Synthesis:** Architecture passes all coherence + coverage + readiness checks; zero critical gaps; 12 ADRs pending authorship in Step 8 to complete. Ready for Create Epics & Stories (CE) and subsequent Dev cycle.

---

## Architecture Completion & Handoff

### What Was Produced (Summary)

Over this single collaborative workflow we produced the authoritative solution substrate for Goldsmith. Contents:

1. **Project Context Analysis** — every PRD capability area + every NFR category mapped to architectural implications; 9 non-negotiables; 14 cross-cutting concerns identified with owners.
2. **Starter Template Evaluation** — locked the composed-from-agency-template approach; explicit initialization commands for Epic 1 Story 1; rejected alternatives documented.
3. **Core Architectural Decisions** — 12 critical decisions locked across Data, Auth+Security, API+Communication, Frontend, Infrastructure; implementation sequence defined; cross-component dependencies mapped.
4. **Implementation Patterns & Consistency Rules** — 10 binding "MUST" rules, 6 enforcement layers, naming/structure/format/communication/process patterns with worked examples + anti-patterns.
5. **Project Structure & Boundaries** — full directory tree for 4 apps + ~15 packages + infra + ops + docs; package dependency DAG; requirements-to-structure mapping for all 126 FRs.
6. **Architecture Validation Results** — coherence, coverage, readiness all confirmed; zero critical gaps; IR-report risks addressed.
7. **12 ADRs** — one per locked decision, under `_bmad-output/planning-artifacts/adr/`:
   - 0001 Auth provider (Supabase Auth Mumbai)
   - 0002 Multi-tenant single-DB RLS + interceptor
   - 0003 Money + weight DECIMAL primitives
   - 0004 Offline sync pull-then-push protocol
   - 0005 Tenant-context defense-in-depth
   - 0006 Vendor adapter + fallback chain
   - 0007 Near-real-time polling (MVP)
   - 0008 White-label shared-app theming
   - 0009 Modular-monolith NestJS + extraction plan
   - 0010 Tenant provisioning scripted end-to-end
   - 0011 Compliance package hard-block gateway
   - 0012 Terraform over CDK (for MVP)

### Architectural Principles (TL;DR — the spine)

1. **Tenant isolation is structural, not procedural.** RLS + interceptor + test suite from Sprint 1.
2. **Compliance is a package, not a feature.** `packages/compliance` is the single authority.
3. **Money + weight are types, not numbers.** `packages/money` prevents FLOAT misuse at compile time.
4. **White-label is enforced.** Semgrep prevents platform-brand leak; theme resolved from tenant config.
5. **Modular monolith for MVP, extraction-ready via package dependency DAG.**
6. **Vendor integrations via ports + adapters** — swap = adapter rewrite only.
7. **Offline-first shopkeeper + near-real-time polling customer** — until Phase 3+ WebSocket upgrade.
8. **Observability, CI gates, and automated tests are infrastructure** — they ship in Epic 1, not later.
9. **Hindi-first with locale-aware typography + full WCAG AA** across customer-facing surfaces.
10. **Data residency enforced at IaC + SCP + vendor DPA review** — not assumed.

### Readiness Assessment

**Overall: READY FOR CREATE EPICS & STORIES (CE).** Confidence HIGH.

- 126/126 FRs mapped to module + package paths.
- 70/70 NFRs addressed with explicit mechanisms.
- Zero critical gaps; 6 important gaps delivered inside Epic 1–5 (not blockers for CE).
- 12 ADRs provide decision context for future teams + downstream agents.

### Implementation Handoff

**For the Create Epics & Stories (CE) workflow:**
- Consume this architecture + PRD + UX spec.
- Use the Requirements-to-Structure Mapping table (§Project Structure) to locate code homes for each story.
- Honour IR-report risks: user-value framing on EPIC 1/4/13/15; eliminate EPIC 16 "Hardening" as a name (split into specific stories); consent-before-tracking for EPIC 12.
- Every story template should reference: (a) FR(s) implemented, (b) module + package paths, (c) governing ADRs, (d) pattern-rule list, (e) tenant-isolation / weight-precision / compliance-gate test assertions where applicable.

**For Dev Story execution (Amelia):**
- This document + the 12 ADRs + PRD + UX spec are authoritative. Read in that order.
- Apply the 10 binding "MUST" rules — CI rejects violations.
- Run all 5 review layers (code-review, security-review, Codex CLI, bmad-code-review, feature-dev:code-reviewer) before push per Agency Delivery Protocol.

**First implementation priority:**
- **Epic 1 Story 1** — monorepo scaffold + enterprise floor + CI green + deployable "Hello World" API health endpoint + reachable shopkeeper home stub. Literal command sequence in §Starter Template Evaluation.

**Parallel unblockers (not architecture-dependent):**
- Anchor SOW negotiation (PRFAQ #1 blocker).
- Legal review for jeweller-as-merchant classification + DPDPA DPA.
- Apple/Google developer account decision (platform-owned vs per-tenant; ADR-0008 defers per-tenant to Phase 4+, so platform-owned for MVP).
- 4 anchor policy decisions (cash-pricing, custom-order, warranty, shipping) — architectural neutrality preserved; shopkeeper-configurable defaults until anchor chooses.

### Next BMAD Workflow

**Create Epics & Stories (CE)** with Winston/John. This architecture + PRD + UX spec are its authoritative inputs. CE's output: epic + story files under `_bmad-output/planning-artifacts/epics-and-stories/` (or `docs/stories/` per project convention), one per implementation unit, each traceable to specific FRs and referencing this architecture for solution substrate.

After CE: Sprint Planning → Per-Story Protocol (brainstorm → plan → execute with context quarantine → TDD → verification → 5-layer review → push) per Agency Delivery Protocol.

---

## Document Statistics

- **Sections:** 9 (Init + Context + Starter + Decisions + Patterns + Structure + Validation + Completion)
- **PRD FRs covered:** 126/126 (100%)
- **PRD NFRs addressed:** 70/70 (100%)
- **UX spec journeys mapped:** 6/6
- **UX state machines mapped:** 5/5
- **ADRs produced:** 12
- **Non-negotiables honoured:** 9/9 (CLAUDE.md)
- **Cross-cutting concerns resolved:** 14
- **Binding enforcement rules:** 10 MUSTs with 6 enforcement layers
- **Input documents:** PRD, UX spec, PRFAQ, PRFAQ distillate, IR report, Domain Research, Market Research, CLAUDE.md (user + project), plan v3, MEMORY.md

## Version History

- **v1 (2026-04-17):** Initial Architecture document via BMAD Create Architecture workflow. A+P synthesis applied inline at every step per Agency Delivery SOP. All 12 ADRs authored under `_bmad-output/planning-artifacts/adr/`. Status: COMPLETE. Next workflow: Create Epics & Stories (CE).








