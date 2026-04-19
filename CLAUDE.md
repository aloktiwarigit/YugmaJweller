# Goldsmith — Claude Code Project Guide

Project-level primer. Every Claude Code session should read this first. Updated 2026-04-18 (stack corrected to Azure + Firebase; startup-lean infra deferred — see ADR-0015).

---

## What this project is

**Goldsmith** is a multi-tenant white-label jewellery platform for local Indian jewellers. Two apps (shopkeeper + customer-facing) sharing one backend and database, packaged as each jeweller's OWN brand.

- **MVP anchor:** An Ayodhya (Uttar Pradesh, Hindi belt) jeweller — 2-5 staff, full-spectrum (gold, diamond, silver, bridal, wholesale), client-funded, cost-conscious.
- **Productization:** After anchor launch, onboard 2nd-Nth jewellers via configuration (no custom code).
- **Strategic model:** Anchor-customer-then-platform (not freemium-first). Multi-tenant architecture from Day 1.

## Where the authoritative context lives

Always load these before making significant decisions. Do not re-derive what's already documented.

| Document | Path | What's in it |
|----------|------|--------------|
| PRD | `_bmad-output/planning-artifacts/prd.md` | 126 FRs + 70 NFRs + journeys + scoping (binding) |
| PRFAQ | `_bmad-output/planning-artifacts/prfaq-Goldsmith.md` | Vision, customer FAQs, verdict |
| PRFAQ Distillate | `_bmad-output/planning-artifacts/prfaq-Goldsmith-distillate.md` | Token-efficient handoff pack |
| Domain Research | `_bmad-output/planning-artifacts/research/domain-indian-jewelry-retail-research-2026-04-15.md` | Market, regulatory, tech, competitive (650 lines, 180+ sources) |
| Market Research | `_bmad-output/planning-artifacts/research/market-customer-insights-research-2026-04-16.md` | Customer archetypes, pain quotes, journey maps |
| Implementation Readiness | `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md` | PRD readiness 9.2/10; flagged risks for UX/CA/CE |
| Approved plan | `C:\Users\alokt\.claude\plans\tingly-weaving-frog.md` | Phased roadmap (v2 anchor-customer pivot) |
| Memory | `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` | Project overview, feedback, decisions |

## Tech stack (locked)

| Layer | Choice |
|-------|--------|
| Mobile | **React Native (Expo SDK 50+)** — shopkeeper + customer apps |
| Web | **Next.js 14+ (App Router)** — customer web + platform admin |
| Mobile UI | **NativeWind** (Tailwind for RN) |
| Web UI | **Tailwind CSS** + **shadcn/ui** + **21st.dev** for premium components |
| Design inspiration | **godly.website** (curated premium references) |
| State | Zustand + TanStack Query |
| Forms | React Hook Form + Zod (shared schemas with backend) |
| Offline (shopkeeper) | WatermelonDB |
| Backend | **NestJS** (TypeScript) |
| Database | **PostgreSQL 15+** with row-level security |
| ORM | **Drizzle** |
| Cache | Redis |
| Queue | BullMQ |
| Search | Meilisearch (Hindi-first) |
| File storage | **Azure Blob Storage** (Central India / South India) + **ImageKit** CDN |
| Auth | **Firebase Auth** (phone OTP) — see ADR-0015 |
| Monorepo | **Turborepo** |
| Hosting | **Azure Central India or South India** — data residency mandatory. Deferred until anchor SOW signed (see ADR-0015 + startup-economics feedback). |

## India vendor stack (locked)

- **Gold rates:** IBJA (primary) + Metals.dev (fallback)
- **Payments:** Razorpay (primary) + Cashfree (secondary)
- **WhatsApp:** AiSensy BSP (Rs 1,500/mo, unlimited agents) — onboard when anchor MRR justifies
- **SMS/OTP:** **Firebase Auth** handles phone OTP end-to-end (free Spark tier for MVP; pay-as-you-go $0.06/SMS when exceeded). MSG91 deferred unless Firebase Auth cannot fit a specific flow.
- **KYC/eSign (Phase 4+):** Digio
- **Maps:** Ola Maps (5M calls/month free)
- **Push:** Firebase Cloud Messaging (free)
- **Analytics:** PostHog (data-residency-compliant deployment)
- **Errors:** Sentry
- **Support:** Zoho Desk Standard (WhatsApp-native)
- **Email:** Resend (MVP) → Azure Communication Services Email at scale
- **HUID verification:** Surepass API wrapper (consumer-facing)

All vendor integrations must use adapter pattern — swap = adapter rewrite only, not data migration.

## Non-negotiable engineering rules

### Data model
- **NEVER use FLOAT or REAL for weight columns.** Use `DECIMAL(10,3)` or `DECIMAL(12,4)`. Paise-level precision required across 10,000+ transactions.
- **Every tenant-scoped table has `shop_id` FK** with PostgreSQL row-level security policy. No exceptions.
- **Tenant context injected at API gateway** via NestJS interceptor; verified at query layer. Two-layer defense.

### Multi-tenant isolation
- Zero cross-tenant data leakage is non-negotiable.
- Automated tenant-isolation test suite from **sprint 1**, not sprint N.
- External pentest before onboarding 2nd tenant.

### Compliance enforcement (hard-blocks, not warnings)
- **Section 269ST cash cap:** Hard-block at Rs 1,99,999 per transaction/day/event. Supervisor override requires role check + audit-logged justification.
- **PAN Rule 114B:** Hard-block invoice completion at Rs 2 lakh without PAN or Form 60.
- **GST rates:** 3% metal + 5% making hardcoded. No user override on rates.
- **HUID:** Required field on every hallmarked product; appears on every hallmarked invoice.
- **PMLA:** Cumulative monthly cash per customer tracked; warning at Rs 8L, block at Rs 10L with CTR template auto-generated.

### Shopkeeper self-service configuration
All per-jeweller values must be shopkeeper-configurable via in-app admin UI. Platform team does NOT hardcode per-tenant values. Includes:
- Making charges (by category), wastage %, rate-lock duration, try-at-home toggle + piece count, loyalty tier thresholds, custom order policy, return policy, notification preferences, shop profile, staff permissions

Compliance values (GST %, HUID format, PAN threshold, Section 269ST cap) are platform-controlled, NOT editable by shopkeeper.

### Story AC gate (runtime smoke test)
Story AC is not closed until the changed surface has been smoke-tested on its intended runtime. A passing test suite + clean code review does not substitute for running the actual artifact the story promised. Layered code inspection catches surface bugs; runtime integration catches system bugs. Without the runtime gate, system bugs leak straight to the demo.
- **Shopkeeper stories:** physical device or emulator — Metro boot confirmed, golden-path flow exercised.
- **API-only stories:** `curl` round-trip against the running service.
- **Web stories:** browser render of the affected page, golden-path flow exercised.

## Design constraints (every frontend task must honour these)

### Language & typography
- **Hindi-first UI, English toggle.** Not translated English.
- **Devanagari fonts:** Noto Sans Devanagari (bundled), fallbacks: Mukta, Hind.
- Font scales with browser zoom up to 200% without layout breakage.
- **Do NOT default to Inter, Space Grotesk, or Latin-centric display fonts** — frontend-design skill's defaults will fight this; override explicitly.

### Senior-friendly shopkeeper UX
- Target demographic: **45-65 year old Ayodhya jewellers** (paper-ledger users, now adopting a phone app).
- Touch targets: ≥ 48×48 dp (Android) / 44×44 pt (iOS).
- Primary actions never require fine motor control.
- Minimum font size 16pt for body, 14pt for secondary; support "large font" system setting.
- High contrast (≥ 4.5:1); no color-only information signalling.

### Accessibility
- **WCAG 2.1 Level AA** for all customer-facing web pages.
- Full keyboard navigation on web; ARIA labels everywhere; semantic HTML.
- Form errors announced to screen readers; never color-only error indication.

### White-label multi-tenant theming
- **Each jeweller's customer-facing surfaces (mobile + web) show ONLY their brand.** Logo, colors, app name, domain.
- **Goldsmith platform brand is NEVER visible to customers.** No "Powered by Goldsmith" footer, no platform logo in loading states.
- Theme applied via CSS variables (web) + React Context (mobile).
- Per-tenant config keys: `primary_color`, `secondary_color`, `logo_url`, `app_name`, `domain`, `default_language`, `feature_flags`.

### Anti-slop aesthetic
- Do not produce "generic SaaS startup" aesthetics. The 45-65 shopkeeper will reject it.
- Reference **godly.website** for inspiration; **frontend-design skill** when active will guide tone.
- Warm, trust-heavy, traditional-meets-modern. Not cold Western tech.
- Pilgrim/devotional context (Ayodhya post-Ram Mandir) — respectful, not kitsch.

## Real-time sync contract

- **MVP target:** Near-real-time (polling every 5-30 sec). Shopkeeper writes propagate to customer app within 30 seconds at p95.
- True real-time (WebSocket / Server-Sent Events) deferred to Phase 3+.
- Use TanStack Query refetch interval; do not introduce WebSocket infrastructure in MVP.

## Frontend-design skill invocation priming

When the `frontend-design` skill activates (automatic for UI work), the session context should remind it of:

```
Stack: React Native (Expo) for mobile, Next.js 14 (App Router) for web,
Tailwind CSS + shadcn/ui + 21st.dev on web, NativeWind on mobile.

Language: Hindi-first with English toggle. Use Noto Sans Devanagari /
Mukta / Hind for Indic text. DO NOT default to Inter or Space Grotesk.

Audience:
 - Shopkeeper app: 45-65 year old Ayodhya jewellers, paper-ledger-upgraders.
   Large touch targets (≥48dp), 16pt min body font, high contrast,
   senior-friendly defaults. Hindi.
 - Customer app: 25-45 millennial + pilgrim tourist + wedding shopper.
   Premium visual quality (rival Tanishq/CaratLane). Hindi default.
 - Admin console: platform team, English OK, desktop web.

Visual tone: Warm, trust-heavy, traditional-meets-modern. Not cold
Western tech. Reference godly.website.

White-label: Every customer-facing surface shows the anchor jeweller's
brand exclusively — logo, colors, app name, domain. Goldsmith platform
brand is NEVER visible to customers.

Accessibility: WCAG 2.1 AA. Keyboard navigation, ARIA labels, screen
reader support, form error announcements, no color-only signals.

Compliance UX: Section 269ST cash-cap block, PAN prompt at Rs 2L,
HUID QR scan for customer trust — these are first-class UX moments,
not afterthoughts.

Reference PRD FRs at _bmad-output/planning-artifacts/prd.md when
designing specific features. Every design must trace to one or more FRs.
```

Prepend this priming to any frontend-design session on a new feature.

## BMAD workflow status

- ✅ Domain Research — complete
- ✅ Market Research — complete
- ✅ PRFAQ Challenge — complete
- ✅ Create PRD — complete (126 FRs, 70 NFRs)
- ✅ Check Implementation Readiness — complete (9.2/10)
- ⏭️ Next: Create UX Design (CU) with Sally
- Then: Create Architecture (CA) with Winston
- Then: Create Epics & Stories (CE) → Sprint Planning → Dev cycle

## Startup economics (startup-lean, revenue-first)

Pre-revenue, engineering choices minimize recurring cost. Enterprise hardening waits until first paying tenant. See ADR-0015 + `memory/feedback_startup_economics_first.md`.

Floor-cost MVP target: **≤ $20/month** (Firebase Auth free tier, Azure Postgres Flexible Burstable B1ms ~$12/mo once deployed, Azure Container Apps consumption scale-to-zero, Blob Storage pennies, Key Vault ~$1, GitHub + Sentry + PostHog free tiers).

**Graduation triggers (ONLY then add enterprise infra):**
- First paying anchor signs SOW + MRR confirmed
- Regulatory audit demands Multi-AZ / per-tenant KEK / cross-region DR
- Observable tenant-count or traffic destabilises current stack

Everything in the original "Enterprise Floor" (Sentry + OTel + feature flags + Storybook + ADRs + threat model + runbook + PostHog + TS strict + 80% coverage) stays day-1 — **those are free**. The **infrastructure** graduations (Multi-AZ, 3 NAT, per-tenant KMS, Redis clusters, staging environments) wait.

## External blockers to unblock before coding begins

1. 🚨 **Anchor SOW** — scope, fee, timeline, branding rights, IP ownership, change management, milestone payments. #1 dependency per PRFAQ verdict.
2. Legal review — platform terms, jeweller-as-merchant classification, DPA for DPDPA.
3. Apple/Google developer account decision — platform-owned vs per-tenant.
4. Anchor policy decisions (4 items flagged in PRFAQ/PRD): "app price = committed price" policy, custom order refund/rework/deposit/cancellation policy, warranty insurance commitment, shipping scope.
5. **Azure subscription** — reachable when the anchor SOW is signed, not before. Until then, all dev is local Docker + validated-only Terraform/azd configs.

## Working rules

- When editing code, run typecheck + lint before committing.
- Never amend a published commit; create a new one.
- Never skip git hooks with `--no-verify` unless explicitly asked.
- Do not add features, refactor, or abstract beyond what the task requires. Small bug fix ≠ excuse for restructuring the module.
- No FLOAT for weights. No cross-tenant queries. No hardcoded per-tenant values. No Goldsmith-brand leakage to customer surfaces. No compliance rules configurable by shopkeeper.
- Memory is at `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md`. Read feedback files before making decisions that overlap prior user directives.

## BMAD decision-point SOP

At every BMAD workflow menu (A/P/C), auto-execute:
1. **A** — run 5 top context-matched elicitation methods, synthesise recommendation, apply by default
2. **P** — run Party Mode with 3-4 relevant BMAD personas, apply synthesis by default
3. **C** — continue to next step

User directive (2026-04-16): auto-accept recommendations unless user overrides. No y/n prompts at each micro-step.

---

_When in doubt, read the PRD. Every design, architecture, and implementation decision should trace back to a specific FR or NFR._
