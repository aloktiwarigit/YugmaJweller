# Goldsmith — Claude Code Project Guide

Project-level primer. Every Claude Code session should read this first. Updated 2026-05-04 (code-truth completion audit added; stack correction remains ADR-0015).

---

## What this project is

**Goldsmith** is a multi-tenant white-label jewellery platform for local Indian jewellers. Two apps (shopkeeper + customer-facing) sharing one backend and database, packaged as each jeweller's OWN brand.

- **MVP anchor:** An Ayodhya (Uttar Pradesh, Hindi belt) jeweller — 2-5 staff, full-spectrum (gold, diamond, silver, bridal, wholesale), client-funded, cost-conscious.
- **Productization:** After anchor launch, onboard 2nd-Nth jewellers via configuration (no custom code).
- **Strategic model:** Anchor-customer-then-platform (not freemium-first). Multi-tenant architecture from Day 1.

## Where the authoritative context lives

These documents are requirement/context sources, not completion proof. For completion claims, code is the truth: verify current source, migrations, routes, UI reachability, tests, and CI gates. Do not use git logs or memory as proof that a story or FR is implemented.

| Document | Path | What's in it |
|----------|------|--------------|
| Code-truth completion audit | `docs/code-truth-completion-audit-2026-05-04.md` | Current code-first completion gaps, evidence rules, and future agent-context plan |
| PRD | `_bmad-output/planning-artifacts/prd.md` | 126 FRs + 70 NFRs + journeys + scoping (binding) |
| Customer storefront addendum | `docs/prd-addendum-customer-storefront.md` | FR127-FR140 + customer storefront completion notes |
| PRFAQ | `_bmad-output/planning-artifacts/prfaq-Goldsmith.md` | Vision, customer FAQs, verdict |
| PRFAQ Distillate | `_bmad-output/planning-artifacts/prfaq-Goldsmith-distillate.md` | Token-efficient handoff pack |
| Domain Research | `_bmad-output/planning-artifacts/research/domain-indian-jewelry-retail-research-2026-04-15.md` | Market, regulatory, tech, competitive (650 lines, 180+ sources) |
| Market Research | `_bmad-output/planning-artifacts/research/market-customer-insights-research-2026-04-16.md` | Customer archetypes, pain quotes, journey maps |
| Implementation Readiness | `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md` | PRD readiness 9.2/10; flagged risks for UX/CA/CE |
| Approved plan | `C:\Users\alokt\.claude\plans\tingly-weaving-frog.md` | Phased roadmap (v2 anchor-customer pivot) |
| Memory | `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` | Prior-session context only; never implementation proof |

## Code-truth audit rules

- Start completion and gap-analysis sessions with `docs/code-truth-completion-audit-2026-05-04.md`.
- Treat BMAD docs, PRD, addenda, plans, specs, and review files as requirements or historical context only.
- Do not mark a story/FR complete unless current code, migrations, reachable routes/UI, tests, or CI provide evidence.
- If code exists but is not wired into app navigation or public/API routes, mark the feature partial.
- If tests exist but are not wired into Turbo/CI or a known runnable command, mark the proof incomplete.
- Future broad-context work should create or update `docs/agent-context/` machine-readable docs before spending tokens on long Markdown plans/reviews.
- Target agent-context files: `project.context.json`, `traceability.json`, `decision-index.json`, `task-routing.json`, `doc-index.json`, and `acceptance-evidence.json`.
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
- ✅ Create UX Design — complete (Direction 5 Hindi-First Editorial locked)
- ✅ Create Architecture — complete (modular monolith, 12 ADRs)
- ✅ Create Epics & Stories — complete (16 epics, 138 stories)
- ✅ .bmad-readiness-passed — gate passed 2026-04-17
- ⏭️ **Now in execution:** Sprint 1 — story-by-story dev cycle

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
8. **Code-truth audit before claiming complete.** Grep current code for the FR's expected route/migration/test. No completion claim without code evidence. Memory + git logs are NOT proof. Per `docs/code-truth-completion-audit-2026-05-04.md`.
9. `git push`

**Cut from prior Class B ceremony (drop entirely, observed zero signal in WS-3A):**
- Per-task spec compliance review
- Per-task code review on pure UI/copy lines
- Re-review of doc-only fix-ups
- Brainstorm session for stories that follow a locked template

**Codified recurring patterns are caught by Semgrep/ESLint, NOT manual review.** See `tools/semgrep/goldsmith-*.yml` (current set) and `.eslintrc.cjs` overrides. Every reviewer-caught pattern that recurs more than once gets codified before the next story. Manual reviewers must NOT spend time on patterns that have automated rules.

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

**When NOT to parallelize:**
- Stories that touch `apps/api/src/modules/billing/billing.service.ts` (it's a serialization choke point per memory `project_epic_completion_plan.md`)
- Stories that share a migration sequence number (one must land first; the other rebases)
- Stories that share a mobile screen file (e.g., two stories both editing `apps/shopkeeper/app/reports/daily-summary.tsx`)
- Class A auth/RLS work — keep serial for context-quarantine reasons

### Code-truth audit gate — no completion claim without code evidence (2026-05-05)

Per `docs/code-truth-completion-audit-2026-05-04.md`, every claim that a story / FR / acceptance criterion is "complete" MUST be backed by a `git grep` or file-existence check against current code. Memory, prior session summaries, commit logs, and review markers are **not proof**.

Before a story's commit message says "complete", run (or have an agent run) the audit checklist:
- The expected route is registered (`grep '<route>' apps/api/src/...`)
- The expected migration exists (`ls packages/db/src/migrations/<seq>*.sql`)
- The expected test file exists and at least one test asserts new behavior
- The expected mobile screen has a `Stack.Screen` entry in `_layout.tsx`
- The story's FRs are reachable from main app navigation (not orphan routes)

If any check fails, the story is NOT complete. Status downgrades to "partial" until the gap closes.

---

## Android smoke test — known Windows issues (learned 2026-04-19)

Running `expo run:android` or `npx expo start --dev-client` on Windows with pnpm has several landmines. Read this before starting any shopkeeper smoke test.

### 1. Windows MAX_PATH (260-char) breaks CMake/Gradle
pnpm's virtual store puts packages at `.pnpm/<pkg>@<ver>_<hash>/node_modules/...`. The hash encodes peer-dep combinations and can be 30-60 chars. Combined with `C:\Alok\Business Projects\Goldsmith\.worktrees\<branch>\`, paths routinely exceed 260 chars.

**Symptom:** `java.io.IOException: The filename, directory name, or volume label syntax is incorrect` during `app:compileDebugJavaWithJavac`.

**Fix:** Build from a short root. Copy the repo to `C:\gs\` (5-char root) and build from there:
```
xcopy /E /I "C:\Alok\Business Projects\Goldsmith" C:\gs
cd C:\gs\apps\shopkeeper
npx expo run:android --device
```
The Windows long-path registry key (`HKLM\...\LongPathsEnabled=1`) is NOT sufficient — CMake/ninja are not compiled with `longPathAware` and ignore it.

### 2. Junctions don't help
Windows junctions (`mklink /J C:\wt "C:\Alok\Business Projects\..."`) are resolved to their real target by CMake's `stat()` calls. No path shortening benefit.

### 3. `node-linker=hoisted` causes duplicate Gradle plugin
Adding `node-linker=hoisted` to `.npmrc` creates two copies of `@react-native/gradle-plugin` — one from pnpm's virtual store, one hoisted — both registered as Gradle included builds with the same build path `:gradle-plugin`. Build fails immediately.

**Don't do this.** Keep pnpm's default virtual store layout.

### 4. Metro must run from the same root as the APK build
The dev-client APK bakes in relative pnpm hash paths for the JS bundle entry. If Metro runs from a different root (e.g., worktree) those paths don't resolve.

**Rule:** Always start Metro from `C:\gs\apps\shopkeeper` when the APK was built from `C:\gs`.

### 5. pnpm virtual store isolation breaks Metro — hoist everything
After a fresh pnpm install, packages like `@babel/runtime`, `@react-native/assets-registry`, `@tanstack/react-query` etc. exist only in the virtual store (`.pnpm/<pkg>@<ver>/node_modules/`). Metro cannot find them via its resolver — it whack-a-moles with a new "Unable to resolve" error for each missing package.

**The only reliable fix for the C:\gs dev copy:** set `public-hoist-pattern[]=*` in `.npmrc` and re-run `pnpm install`. This hoists all packages to the root `node_modules/`, which Metro can traverse normally:

```
# C:\gs\.npmrc — add this line
public-hoist-pattern[]=*
```
```bash
cd C:/gs && echo y | pnpm install
```

**Do NOT try:** adding packages one by one, symlinking manually, or adding specific patterns (`@babel/*`, `@tanstack/*`) — you will whack-a-mole through 10+ packages.

**Important:** Do NOT add `public-hoist-pattern[]=*` to the real repo's `.npmrc` (at `C:\Alok\Business Projects\Goldsmith\.npmrc`) or any worktree. That change lives only in `C:\gs` which is the throw-away build copy.

### 6. expo-linking version split
`expo-linking@55.0.13` calls `requireNativeModule('ExpoLinking')` — it's a native module. `expo-linking@6.3.1` is pure JS (re-exports `Linking` from react-native). The APK's native shell only contains the modules autolinking registered at build time.

If the Metro bundle resolves to `expo-linking@55.0.13` but the APK was built without `ExpoLinking` native module → crash at boot.

**Fix:** Pin `expo-linking@~6.3.1` as a direct dep in `apps/shopkeeper/package.json`. Check pnpm lock to confirm `expo-router` resolves to the `p3emlajxqafsfmn5fyfb4xm6ji` hash (which depends on 6.3.1), not the `zbxarhgj6iufaeqwbgpssqow3a` hash (which depends on 55.0.13).

### 7. Stale Metro cache re-introduces resolved native modules
Even after fixing `expo-linking` version, a cached Metro bundle can serve the old 55.x resolution.

**Always restart Metro with `--clear`** after any dependency changes:
```
npx expo start --dev-client --clear --port 8081
```

### 8. ADB reverse tunnel must be re-armed each session
```bash
adb -s <DEVICE_SERIAL> reverse tcp:8081 tcp:8081
```
Run this after every Metro restart. Verify with `adb reverse --list`.

---

_When in doubt, read the PRD. Every design, architecture, and implementation decision should trace back to a specific FR or NFR._
