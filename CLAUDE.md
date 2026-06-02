# Goldsmith — Claude Code Project Guide

Project-level primer. Every Claude Code session should read this first. Updated 2026-05-21 (truth pass: GCP Cloud Run hosting reality, FEATURE-COMPLETE + demo-closeout status, code-truth audit pointer replaced with `docs/current-implementation-status.md`, semgrep path corrected).

---

## What this project is

**Goldsmith** is a multi-tenant white-label jewellery platform for local Indian jewellers. Two apps (shopkeeper + customer-facing) sharing one backend and database, packaged as each jeweller's OWN brand.

- **MVP anchor profile:** A typical Ayodhya (Uttar Pradesh, Hindi belt) jeweller — 2-5 staff, full-spectrum (gold, diamond, silver, bridal, wholesale), Hindi-first, no existing software. (Anchor *profile* drove FR contracts; anchor *signing* is no longer a prerequisite — see Delivery model below.)
- **Productization:** Multi-tenant from Day 1. New jewellers onboard via configuration (theme + brand + seed data), not custom code.
- **Delivery model (locked 2026-05-05):** **Demo-first, customer-customize.** Build a polished demo, pitch 10-15 jewellers in parallel, first signer becomes tenant-1. See §"Delivery model — demo-first" below — that section supersedes the older "anchor-customer-then-platform" framing in BMAD docs; read those docs for FR contracts, not GTM sequencing.

## Where the authoritative context lives

These documents are requirement/context sources, not completion proof. For completion claims, code is the truth: verify current source, migrations, routes, UI reachability, tests, and CI gates. Do not use git logs or memory as proof that a story or FR is implemented.

| Document | Path | What's in it |
|----------|------|--------------|
| Current implementation status | `docs/current-implementation-status.md` + `docs/agent-context/current-state.json` | Live code-first completion state. **Always read these before claiming any FR/story is complete.** Regenerate the agent-context JSONs with `pnpm docs:context`; validate with `pnpm docs:validate`. |
| PRD | `_bmad-output/planning-artifacts/prd.md` | 126 FRs + 70 NFRs + journeys + scoping (binding) |
| Customer storefront addendum | `docs/prd-addendum-customer-storefront.md` | FR127-FR140 + customer storefront completion notes |
| PRFAQ | `_bmad-output/planning-artifacts/prfaq-Goldsmith.md` | Vision, customer FAQs, verdict |
| PRFAQ Distillate | `_bmad-output/planning-artifacts/prfaq-Goldsmith-distillate.md` | Token-efficient handoff pack |
| Domain Research | `_bmad-output/planning-artifacts/research/domain-indian-jewelry-retail-research-2026-04-15.md` | Market, regulatory, tech, competitive (650 lines, 180+ sources) |
| Market Research | `_bmad-output/planning-artifacts/research/market-customer-insights-research-2026-04-16.md` | Customer archetypes, pain quotes, journey maps |
| Implementation Readiness | `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md` | PRD readiness 9.2/10; flagged risks for UX/CA/CE |
| Runbook | `docs/runbook.md` | Live ops manual — Cloud Run deploys (§17), incident playbooks, rollback, env vars |
| Memory | `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` | Prior-session context only; never implementation proof |

## Code-truth audit rules

- Start completion and gap-analysis sessions with `docs/current-implementation-status.md` and `docs/agent-context/current-state.json`. If these look stale, regenerate with `pnpm docs:context` and validate with `pnpm docs:validate` before relying on them.
- Treat BMAD docs, PRD, addenda, plans, specs, and review files as requirements or historical context only.
- Do not mark a story/FR complete unless current code, migrations, reachable routes/UI, tests, or CI provide evidence.
- If code exists but is not wired into app navigation or public/API routes, mark the feature partial.
- If tests exist but are not wired into Turbo/CI or a known runnable command, mark the proof incomplete.
- `docs/agent-context/` is the machine-readable layer the primer points to: `project.context.json`, `current-state.json`, `traceability.json`, `decision-index.json`, `task-routing.json`, `doc-index.json`, `acceptance-evidence.json`, `implementation-map.json`. Consult these before reading long-form Markdown.
- Avoid default-reading memory, git history, long `docs/reviews/**`, BMAD research docs, and HTML prototypes unless the task specifically needs historical context.

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
| Hosting | **GCP Cloud Run** (`asia-south1`, Mumbai) — data residency met. API service `goldsmith-api` in project `goldsmith-dev`; deploy via `cloudbuild.yaml` (see `docs/runbook.md` §17). Customer-web has its own `cloudbuild-customer-web.yaml`. Azure Key Vault `kv-writ-prod` still used **only** for Android signing secrets — not runtime hosting. (asia-east1 stack decommissioned 2026-05-17. The Azure hosting plan in ADR-0015 was never executed; a successor ADR for the GCP move is still to be written.) |

## India vendor stack

Two lists — **wired** (adapter implemented and in use) vs **planned / stub-only** (adapter not yet built, or only a stub for testing). All integrations must use the adapter pattern under `packages/integrations/<vendor>/` — swapping a vendor = adapter rewrite, not a data migration.

**Wired (live in code):**
- **Gold rates:** IBJA (primary) + Metals.dev (fallback) — `packages/integrations/rates/` with circuit-breaker, fallback-chain, LKG cache
- **Payments (primary):** Razorpay — `packages/integrations/payments/src/razorpay-adapter.ts`
- **Auth + OTP:** Firebase Auth (phone OTP end-to-end; free Spark tier, pay-as-you-go $0.06/SMS over quota) — `apps/api/src/modules/auth/firebase-admin.provider.ts`. ADR-0016.
- **Analytics:** PostHog — `packages/observability/src/posthog.ts`
- **Errors:** Sentry — `packages/observability/src/sentry.ts` + per-app `sentry.{client,server,edge}.config.ts`
- **Search:** Meilisearch (Hindi-first) — `packages/integrations/search/src/adapters/meilisearch.adapter.ts` (stub adapter throws `MeilisearchUnavailableError` in dev)
- **File storage:** Azure Blob + ImageKit CDN — `packages/integrations/storage/` (default `STORAGE_ADAPTER=stub`; set `STORAGE_ADAPTER=azure-imagekit` to activate). The only Azure runtime dep in the stack.

**Planned / not yet implemented (stub-only or no adapter):**
- **Payments (secondary):** Cashfree — no adapter yet (only Razorpay + stub)
- **WhatsApp BSP:** AiSensy (Rs 1,500/mo, unlimited agents) — **deferred to Epic 13**; current send-paths in `custom-orders.service.ts` and `billing/share.service.ts` are stubs
- **KYC/eSign (Phase 4+):** Digio — no adapter yet
- **Maps:** Ola Maps (5M calls/month free) — no adapter yet
- **Push:** Firebase Cloud Messaging — no adapter; only an `sms.adapter.ts` TODO for MSG91 exists
- **Email:** Resend (MVP) or a GCP-compatible alternative at scale — no adapter yet
- **HUID verification:** Surepass API wrapper (consumer-facing) — no adapter yet
- **Support:** Zoho Desk Standard (WhatsApp-native) — out-of-app vendor, no integration code

If you're writing code that needs a "planned" vendor, you're **building the integration**: add the adapter under `packages/integrations/<vendor>/`, ship a stub adapter alongside it (`StubXAdapter` that throws `XUnavailableError`), and write tests against the stub first.

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

When the `frontend-design` skill activates, prepend the §Design constraints section above as its priming block. Also add: stack = React Native (Expo) + NativeWind for mobile, Next.js 14 + Tailwind/shadcn/ui + 21st.dev for web. Every design must trace to a PRD FR at `_bmad-output/planning-artifacts/prd.md`.

## Project status (live: 2026-05-21)

For live state, read `docs/current-implementation-status.md` and `docs/agent-context/current-state.json`. The BMAD planning phases (Domain Research, Market Research, PRFAQ, PRD, Implementation Readiness, UX, Architecture, Epics & Stories) all completed 2026-04-15 through 2026-04-17; readiness gate passed 2026-04-17.

- ✅ **FEATURE-COMPLETE** since 2026-05-01 — all 126 PRD FRs + storefront FR127-FR140 coded; **17 ADRs** (0001-0017, latest `0017-customer-storefront-architecture.md`); migrations through `0075_customer_self_deletion_extensions.sql`.
- ✅ **Storefront uplift Phases A-E** merged — image pipeline, header/tokens, 12-section home, filter/PDP, Lighthouse + Maestro E2E gates.
- ✅ **Demo-closeout complete 2026-05-21** — demo-1 (reviews moderation) + demo-2 (FR65 customer viewing-history) shipped; release APKs (customer + shopkeeper) built locally with Azure Key Vault signing and installed on device.
- ⏭️ **Next:** anchor SOW + tenant-1 onboarding. Pre-tenant-1 punch list tracked in user memory; promote to `docs/tenant-1-readiness.md` before first paying customer signs.

> **Per-story review markers** (`.codex-review-passed`, `.security-review-passed`, `.claude-review-passed`, `.bmad-readiness-passed`) at repo root are **persistent receipts from the last shipping story**, not transient current-branch gates. Do not infer current branch state from their presence or mtime.

## Startup economics (startup-lean, revenue-first)

Pre-revenue, engineering choices minimize recurring cost. Enterprise hardening waits until first paying tenant. See ADR-0015 + `memory/feedback_startup_economics_first.md`.

Floor-cost MVP target: **low-tens of $/month** on the current GCP Cloud Run (`asia-south1`) stack — Cloud Run scale-to-zero pays only for actual request-seconds; Postgres sized to anchor traffic (local Docker today, Cloud SQL or equivalent when tenant-1 deploys); Firebase Auth free tier; Cloud Storage / Azure Blob (env-toggle via `STORAGE_ADAPTER`) for images + ImageKit CDN; Azure Key Vault ~$1 (Android signing only); GitHub + Sentry + PostHog free tiers. Exact ledger lives in `docs/runbook.md` and the deployed Cloud Build pipeline.

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

**Command bundle (use these — they exist in root `package.json`):**

- **Pre-commit gate:** `pnpm typecheck && pnpm lint`. Don't commit without both green.
- **Pre-push / pre-PR gate:** `pnpm test:ci` — runs `typecheck + lint + test:unit + test:integration + test:tenant-isolation + semgrep + docs:validate`. This is the CI command; run it locally before pushing.
- **Semgrep alone:** `pnpm semgrep` (configs in `ops/semgrep/*.yaml`, ESLint custom rules in `ops/eslint-rules/`).
- **Agent-context refresh:** `pnpm docs:context` regenerates `docs/agent-context/*.json` from current repo state; `pnpm docs:validate` checks consistency. Run `docs:context` after merging anything that changes FRs, migrations, ADRs, or routes.
- **Seed data:** `pnpm seed:anchor` (anchor jeweller), `pnpm seed:anchor-dev-2` (second tenant for isolation tests), `pnpm seed:demo` (demo tenant), `pnpm seed:storefront-demo` (storefront preview content).
- **Releases:** `pnpm deploy:customer-release` builds + installs the customer-mobile APK via the PowerShell script (Windows only — see §"Production release build" below). Shopkeeper release is manual Gradle, same section.

**General discipline:**

- Never amend a published commit; create a new one.
- Never skip git hooks with `--no-verify` unless explicitly asked.
- Do not add features, refactor, or abstract beyond what the task requires. Small bug fix ≠ excuse for restructuring the module.
- No FLOAT for weights. No cross-tenant queries. No hardcoded per-tenant values. No Goldsmith-brand leakage to customer surfaces. No compliance rules configurable by shopkeeper.
- Memory is at `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md`. Read feedback files before making decisions that overlap prior user directives.

## Delivery model — demo-first (locked 2026-05-05)

Goldsmith ships on a **demo-first, customer-customize** model, not anchor-launch-prerequisite:

1. **Demo-ready** — Hindi-first UI polished, all daily-ops flows reachable from main nav, compliance hard-blocks demonstrably firing, white-label proof, realistic seed data, regression net (Maestro E2E for golden paths). This is the platform you walk into a jeweler's shop and demo from a phone.
2. **Outreach** — pitch 10-15 Hindi-belt jewelers in parallel; whoever signs first becomes the first deployed tenant. Don't gate on a specific anchor.
3. **Per-customer customize + deploy** — white-label theme, app-store listing under their brand, their seed data, hand-holding through first 2 weeks. ~1 week per customer post-sign.
4. **Productize from real feedback** — build features that paying customers ask for, not speculatively against PRD FR1-140.

**What this means for engineering:**
- Demo-readiness, not full-PRD checkbox completeness, is the current target.
- Defer FR107-112 real notifications integration, FR127-140 storefront enrichment, sync expansion beyond products, tenant terminate/delete with recovery, and pentest-tier hardening until a paying customer drives the priority.
- Backend stays unchanged across tenants; per-customer work is theme + brand + their data + targeted feature requests.
- "Build for the anchor" reasoning in older BMAD docs is superseded by this model — read those docs for FR contract content, not for go-to-market sequencing.

## Ceremony tiering per story (A / B / C) — updated 2026-05-05

The enterprise quality floor (TS strict, no FLOAT, no cross-tenant, Sentry, OTel, axe-core, threat model, ADRs, 48dp touch, Hindi-first, code-truth audit, security review on new attack surfaces) applies to **every class**. Only the process ceremony above the floor scales with risk.

Process changes 2026-05-05 (after WS-3A retrospective showed ~88% of per-task reviews returned zero signal):
- DROP per-task spec compliance review (the plan IS the spec; typecheck + plan-match prove compliance).
- Per-task code review ONLY on Class A subsurfaces inside a story; pure UI/copy/refactor skips per-task review and rides whole-branch review.
- Class C goes straight to code; no brainstorm/spec/plan pipeline.
- Worktree parallelism is the DEFAULT for 2-3 independent stories.
- Recurring reviewer findings get codified as Semgrep/ESLint rules on first repeat.

### Class A — full ceremony
Applies to: auth, money/weight columns, RLS/tenant-isolation, compliance hard-blocks (269ST/PMLA/GST/HUID/PAN), encryption, `platform_admin`, cross-tenant ops, migrations touching RLS/roles/SECURITY DEFINER, webhook handlers.

Protocol:
1. Same session → `/superpowers:brainstorming` + `/superpowers:writing-plans` → commit `plans/<story-id>.md` — **5-7 work streams** (WS-A Data, WS-B API, WS-C Security, WS-D Mobile, WS-E Gate). See work-stream template at `docs/superpowers/plans/_TEMPLATE-work-stream.md`.
2. `/superpowers:executing-plans` — **dispatch parallel agents per work stream**. Auth/RLS/money/crypto stories: **fresh session** for context quarantine. Other Class A: same session permitted.
3. TDD per work stream (Red → Green → Refactor). No separate verification step — TDD completion IS verification.
4. **Review gate — run in parallel:** `codex review --base main` AND `/security-review` simultaneously on HEAD. Both `.codex-review-passed` + `.security-review-passed` markers required. DROP `/code-review`, `/bmad-code-review`, `/superpowers:requesting-code-review`.
5. Runtime smoke test on intended surface (see Non-negotiable floor below)
6. `git push` only after 4 and 5 pass

### Class B — right-sized ceremony (updated 2026-05-05)
Applies to: products, customers, dashboards, notification prefs, non-auth staff CRUD, settings UI not touching compliance, search, reports, debt/fix PRs.

Protocol:
1. `/superpowers:brainstorming` — same session. **Skip if the story follows an established template** (e.g., "wire ExportButtons into another screen", "add another report screen following the existing pattern"). The brainstorming output is reusable across template-following stories.
2. `/superpowers:writing-plans` → commit plan file — **3-5 work streams**, same session.
3. **Default to worktree parallelism** when 2-3 stories don't share blast radius (different modules, no overlapping migration numbers, no overlapping mobile screens). `git worktree add C:/gs<N> feat/<story-id>` per stream. See "Worktree parallelism" subsection below.
4. **TDD on business logic.** Render-plumbing/hook-wiring without business logic can rely on typecheck + smoke; tests required where there's behavior to verify.
5. **Right-sized review gates within a story:**
   - **Per-task code review ONLY on Class A subsurfaces** inside the story (lines that touch RLS, money/paise/weight, auth/JWT/Firebase, compliance hard-blocks, encryption, audit logs, BullMQ tenant boundary). Pure UI/copy/refactor lines skip per-task review.
   - **Per-task spec compliance review is DROPPED.** The plan IS the spec; if code matches plan text and typecheck passes, compliance is by construction.
   - **Whole-branch code review** before push — mandatory.
   - **`/security-review`** before push — mandatory if the story adds a new attack surface (new endpoint, new file processor, new external integration, new SQL query, new auth path).
   - **Re-review only if reviewer flagged a non-trivial issue.** Doc-only fix-ups (comment edits, test-name renames) do NOT need re-review.
6. **Codex CLI cross-model review** when the weekly limit allows (memory `feedback_codex_limit_batch_strategy.md` for current state). When unavailable, the Claude `/security-review` + whole-branch review + CI is the documented substitute (note in commit).
7. **Runtime smoke test on intended surface** — mandatory before PR merge:
   - Shopkeeper stories: emulator or device (Metro boot + golden-path flow). Memory `feedback_drive_smoke_headless.md` for headless walk via adb screencap + input.
   - API-only stories: `curl` round-trip against running service.
   - Web stories: browser render + golden-path flow.
8. **Code-truth audit before claiming complete.** Grep current code for the FR's expected route/migration/test. No completion claim without code evidence. Memory + git logs are NOT proof. Per `docs/current-implementation-status.md` + `docs/agent-context/current-state.json` (regenerate via `pnpm docs:context` if stale).
9. `git push`

**Cut from prior Class B ceremony (drop entirely, observed zero signal in WS-3A):**
- Per-task spec compliance review
- Per-task code review on pure UI/copy lines
- Re-review of doc-only fix-ups
- Brainstorm session for stories that follow a locked template

**Codified recurring patterns are caught by Semgrep/ESLint, NOT manual review.** See `ops/semgrep/*.yaml` (run via `pnpm semgrep`) and `ops/eslint-rules/` + `.eslintrc.cjs` overrides. Every reviewer-caught pattern that recurs more than once gets codified before the next story. Manual reviewers must NOT spend time on patterns that have automated rules.

### Class C — minimal ceremony (updated 2026-05-05)
Applies to: copy tweaks, color/spacing, config toggles, doc-only, refactors < 50 LOC, dep bumps, **nav-edge wiring** (adding a `Stack.Screen` + main-tab link to existing surfaces), **seed-data scripts**, **Semgrep/ESLint rule additions**, **CLAUDE.md / agent-context doc updates**.

Protocol: **Code straight to commit. No brainstorm/spec/plan pipeline.** Tests only where behavior changed (so a Semgrep rule addition needs a positive + negative test fixture; a CLAUDE.md edit needs none). Whole-branch review on the PR (NOT per-task review). Runtime smoke required only if a user-visible runtime surface changed; doc-only / config-toggle-only / lint-rule-only changes are exempt.

**Class C is for a single small change, not a Class B in disguise.** If the work touches > 50 LOC, multiple modules, or new logic (vs nav/copy/config), it's actually Class B — reclassify.

### Reclassification rules
- If mid-story a B/C task reveals a Class A surface (new API endpoint, money field, auth adjacency) → STOP, reclassify to A, add missing ceremony, then continue. Never merge a Class A touch under a B/C gate.
- Mixed-surface PRs default to the highest class. Split PRs to keep B/C out of A ceremony when practical.
- Story 1.1 and all stories merged at/before 1.1 are locked on uniform-ceremony rules. Tiering applies from 1.2 onward.

### Non-negotiable floor (all classes)
Story AC is not closed until the changed surface has been smoke-tested on its intended runtime — **unless the change has no runtime surface** (doc-only, config-toggle-only). A passing test suite + clean code review does not substitute for running the actual artifact the story promised. Layered code inspection catches surface bugs; runtime integration catches system bugs. Without the runtime gate, system bugs leak straight to the demo.

### Worktree parallelism — default for independent stories (2026-05-05)

When 2-3 stories don't share blast radius (different modules, no overlapping migration numbers, no overlapping mobile screens, no overlapping API routes), run them in parallel via separate worktrees:

```
git worktree add C:/gs<N> feat/<story-id>
```

Each worktree gets its own implementer + reviewer cycle. Merge order respects migration sequence (lowest first); other parallel work merges in PR-ready order. Memory `feedback_parallel_session_worktrees.md` has the operational pattern; memory `feedback_orchestrator_parallelization.md` has the orchestration model.

**Anti-pattern:** running two implementers in the SAME working directory. Always different worktrees. The single-working-directory anti-pattern bit us in stories 5.7/5.9 and 6.9/8.1 (memory).

**Worktree cleanup — mandatory after each story merges:** Run `git worktree remove C:/gs<N>` immediately after the story's branch merges to main. Orphaned worktree directories accumulate at 1–14 GB each and are not cleaned up automatically. Do NOT leave `C:\` littered with old `gs*` folders — they waste disk and cause confusion about what is active work vs. dead history.

**When NOT to parallelize:**
- Stories that touch `apps/api/src/modules/billing/billing.service.ts` (it's a serialization choke point per memory `project_epic_completion_plan.md`)
- Stories that share a migration sequence number (one must land first; the other rebases)
- Stories that share a mobile screen file (e.g., two stories both editing `apps/shopkeeper/app/reports/daily-summary.tsx`)
- Class A auth/RLS work — keep serial for context-quarantine reasons

### Code-truth audit gate — no completion claim without code evidence (2026-05-05)

Per `docs/current-implementation-status.md` + `docs/agent-context/current-state.json`, every claim that a story / FR / acceptance criterion is "complete" MUST be backed by a `git grep` or file-existence check against current code. Memory, prior session summaries, commit logs, and review markers are **not proof**.

Before a story's commit message says "complete", run (or have an agent run) the audit checklist:
- The expected route is registered (`grep '<route>' apps/api/src/...`)
- The expected migration exists (`ls packages/db/src/migrations/<seq>*.sql`)
- The expected test file exists and at least one test asserts new behavior
- The expected mobile screen has a `Stack.Screen` entry in `_layout.tsx`
- The story's FRs are reachable from main app navigation (not orphan routes)

If any check fails, the story is NOT complete. Status downgrades to "partial" until the gap closes.

---

## Android / mobile build — Windows gotchas

See `docs/windows-android-dev.md` for the full 8-issue guide (MAX_PATH, junctions, hoisting, Metro root, expo-linking version split, ADB tunnel). Key rule: **always build from `C:\gs` or shorter path**; never from the main workspace.

For customer-mobile Maestro visual QA, see `docs/maestro-qa-guide.md` — full setup sequence (Docker, API on 3001, Metro, ADB reverse, AVD, Maestro CLI).

For production release builds (customer APK + shopkeeper Gradle), see `docs/release-build-guide.md` — deploy script flags, `.env.production` vars, workspace path constraint (`C:\g` exactly), signing secrets table.

---

_When in doubt, read the PRD. Every design, architecture, and implementation decision should trace back to a specific FR or NFR._
