OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR, C:\Users\alokt\.codex\memories]
reasoning effort: xhigh
reasoning summaries: none
session id: 019dfe97-0f0c-7c62-8150-e2841d593f36
--------
user
changes against 'main'
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 5c361c14f136f8ccf45b3daecbe0545971106d71' in C:\Alok\Business Projects\Goldsmith
 succeeded in 439352ms:
diff --git a/.eslintrc.cjs b/.eslintrc.cjs
index 146d868..b8504d2 100644
--- a/.eslintrc.cjs
+++ b/.eslintrc.cjs
@@ -24,7 +24,17 @@ module.exports = {
     }],
   },
   settings: { 'import/resolver': { typescript: true } },
-  ignorePatterns: ['dist', 'node_modules', '*.js.map'],
+  ignorePatterns: [
+    'dist',
+    'node_modules',
+    '*.js.map',
+    '**/*.d.ts',
+    '**/*.js.map',
+    'apps/**/android/**',
+    'apps/**/ios/**',
+    'packages/**/src/**/*.js',
+    'packages/**/test/**/*.js',
+  ],
   overrides: [
     // Test/spec files: relax return-type and shopId-param rules — factory functions
     // and helpers in tests don't benefit from strict return-type annotations.
diff --git a/.gitignore b/.gitignore
index 5f12230..5f30714 100644
--- a/.gitignore
+++ b/.gitignore
@@ -47,6 +47,14 @@ pnpm-debug.log*
 # Build artifacts
 *.tgz
 
+# TypeScript package emit accidentally produced in source/test folders.
+packages/**/src/**/*.js
+packages/**/src/**/*.d.ts
+packages/**/src/**/*.js.map
+packages/**/test/**/*.js
+packages/**/test/**/*.d.ts
+packages/**/test/**/*.js.map
+
 # Next.js build cache (apps/customer-web — generated, never source)
 apps/customer-web/.next/
 
diff --git a/.serena/project.yml b/.serena/project.yml
index cf9a898..e1294b9 100644
--- a/.serena/project.yml
+++ b/.serena/project.yml
@@ -125,3 +125,14 @@ ignored_memory_patterns: []
 # The full set of modes to be activated is base_modes (from global config) + default_modes + added_modes.
 # See https://oraios.github.io/serena/02-usage/050_configuration.html#modes
 added_modes:
+
+# list of additional workspace folder paths for cross-package reference support (e.g. in monorepos).
+# Paths can be absolute or relative to the project root.
+# Each folder is registered as an LSP workspace folder, enabling language servers to discover
+# symbols and references across package boundaries.
+# Currently supported for: TypeScript.
+# Example:
+#   additional_workspace_folders:
+#     - ../sibling-package
+#     - ../shared-lib
+additional_workspace_folders: []
diff --git a/CLAUDE.md b/CLAUDE.md
index 1dbcf54..5952213 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -1,6 +1,6 @@
 # Goldsmith — Claude Code Project Guide
 
-Project-level primer. Every Claude Code session should read this first. Updated 2026-04-18 (stack corrected to Azure + Firebase; startup-lean infra deferred — see ADR-0015).
+Project-level primer. Every Claude Code session should read this first. Updated 2026-05-06 (agent handoff docs are now the default entry point; stack correction remains ADR-0015).
 
 ---
 
@@ -14,18 +14,30 @@ Project-level primer. Every Claude Code session should read this first. Updated
 
 ## Where the authoritative context lives
 
-Always load these before making significant decisions. Do not re-derive what's already documented.
+These documents are requirement/context sources, not completion proof. For completion claims, code is the truth: verify current source, migrations, routes, UI reachability, tests, and CI gates. Do not use git logs or memory as proof that a story or FR is implemented.
 
 | Document | Path | What's in it |
 |----------|------|--------------|
+| Agent start-here | `docs/AGENT-START-HERE.md` | Minimal future-session read order and what not to read by default |
+| Current implementation status | `docs/current-implementation-status.md` | Current code-backed status by functional area, UI reachability, and launch gaps |
+| Machine-readable project context | `docs/agent-context/project.context.json` | Stack, commands, invariants, read order, and source-of-truth rules |
+| Machine-readable current state | `docs/agent-context/current-state.json` | Code-backed area status and high-risk gaps |
+| Machine-readable implementation map | `docs/agent-context/implementation-map.json` | Apps, packages, API controllers/endpoints, UI routes, migrations, CI jobs |
 | PRD | `_bmad-output/planning-artifacts/prd.md` | 126 FRs + 70 NFRs + journeys + scoping (binding) |
-| PRFAQ | `_bmad-output/planning-artifacts/prfaq-Goldsmith.md` | Vision, customer FAQs, verdict |
-| PRFAQ Distillate | `_bmad-output/planning-artifacts/prfaq-Goldsmith-distillate.md` | Token-efficient handoff pack |
-| Domain Research | `_bmad-output/planning-artifacts/research/domain-indian-jewelry-retail-research-2026-04-15.md` | Market, regulatory, tech, competitive (650 lines, 180+ sources) |
-| Market Research | `_bmad-output/planning-artifacts/research/market-customer-insights-research-2026-04-16.md` | Customer archetypes, pain quotes, journey maps |
-| Implementation Readiness | `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-16.md` | PRD readiness 9.2/10; flagged risks for UX/CA/CE |
+| Customer storefront addendum | `docs/prd-addendum-customer-storefront.md` | FR127-FR140 + customer storefront completion notes |
 | Approved plan | `C:\Users\alokt\.claude\plans\tingly-weaving-frog.md` | Phased roadmap (v2 anchor-customer pivot) |
-| Memory | `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` | Project overview, feedback, decisions |
+| Memory | `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` | Prior-session context only; never implementation proof |
+
+## Code-truth audit rules
+
+- Start completion and gap-analysis sessions with `docs/AGENT-START-HERE.md`, then `docs/current-implementation-status.md` and `docs/agent-context/current-state.json`.
+- Treat BMAD docs, PRD, addenda, plans, specs, and review files as requirements or historical context only.
+- Do not mark a story/FR complete unless current code, migrations, reachable routes/UI, tests, or CI provide evidence.
+- If code exists but is not wired into app navigation or public/API routes, mark the feature partial.
+- If tests exist but are not wired into Turbo/CI or a known runnable command, mark the proof incomplete.
+- Future broad-context work should update `docs/agent-context/` machine-readable docs before spending tokens on long Markdown plans/reviews.
+- Target agent-context files: `project.context.json`, `current-state.json`, `implementation-map.json`, `traceability.json`, `decision-index.json`, `task-routing.json`, `doc-index.json`, and `acceptance-evidence.json`.
+- Avoid default-reading memory, git history, long `docs/reviews/**`, BMAD research docs, and HTML prototypes unless the task specifically needs historical context.
 
 ## Tech stack (locked)
 
@@ -212,9 +224,31 @@ Everything in the original "Enterprise Floor" (Sentry + OTel + feature flags + S
 - No FLOAT for weights. No cross-tenant queries. No hardcoded per-tenant values. No Goldsmith-brand leakage to customer surfaces. No compliance rules configurable by shopkeeper.
 - Memory is at `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md`. Read feedback files before making decisions that overlap prior user directives.
 
-## Ceremony tiering per story (A / B / C) — 2026-04-19
+## Delivery model — demo-first (locked 2026-05-05)
+
+Goldsmith ships on a **demo-first, customer-customize** model, not anchor-launch-prerequisite:
+
+1. **Demo-ready** — Hindi-first UI polished, all daily-ops flows reachable from main nav, compliance hard-blocks demonstrably firing, white-label proof, realistic seed data, regression net (Maestro E2E for golden paths). This is the platform you walk into a jeweler's shop and demo from a phone.
+2. **Outreach** — pitch 10-15 Hindi-belt jewelers in parallel; whoever signs first becomes the first deployed tenant. Don't gate on a specific anchor.
+3. **Per-customer customize + deploy** — white-label theme, app-store listing under their brand, their seed data, hand-holding through first 2 weeks. ~1 week per customer post-sign.
+4. **Productize from real feedback** — build features that paying customers ask for, not speculatively against PRD FR1-140.
+
+**What this means for engineering:**
+- Demo-readiness, not full-PRD checkbox completeness, is the current target.
+- Defer FR107-112 real notifications integration, FR127-140 storefront enrichment, sync expansion beyond products, tenant terminate/delete with recovery, and pentest-tier hardening until a paying customer drives the priority.
+- Backend stays unchanged across tenants; per-customer work is theme + brand + their data + targeted feature requests.
+- "Build for the anchor" reasoning in older BMAD docs is superseded by this model — read those docs for FR contract content, not for go-to-market sequencing.
 
-The enterprise quality floor (TS strict, no FLOAT, no cross-tenant, Sentry, OTel, axe-core, threat model, ADRs, 48dp touch, Hindi-first, Codex green) applies to **every class**. Only the process ceremony above the floor scales with risk.
+## Ceremony tiering per story (A / B / C) — updated 2026-05-05
+
+The enterprise quality floor (TS strict, no FLOAT, no cross-tenant, Sentry, OTel, axe-core, threat model, ADRs, 48dp touch, Hindi-first, code-truth audit, security review on new attack surfaces) applies to **every class**. Only the process ceremony above the floor scales with risk.
+
+Process changes 2026-05-05 (after WS-3A retrospective showed ~88% of per-task reviews returned zero signal):
+- DROP per-task spec compliance review (the plan IS the spec; typecheck + plan-match prove compliance).
+- Per-task code review ONLY on Class A subsurfaces inside a story; pure UI/copy/refactor skips per-task review and rides whole-branch review.
+- Class C goes straight to code; no brainstorm/spec/plan pipeline.
+- Worktree parallelism is the DEFAULT for 2-3 independent stories.
+- Recurring reviewer findings get codified as Semgrep/ESLint rules on first repeat.
 
 ### Class A — full ceremony
 Applies to: auth, money/weight columns, RLS/tenant-isolation, compliance hard-blocks (269ST/PMLA/GST/HUID/PAN), encryption, `platform_admin`, cross-tenant ops, migrations touching RLS/roles/SECURITY DEFINER, webhook handlers.
@@ -227,25 +261,42 @@ Protocol:
 5. Runtime smoke test on intended surface (see Non-negotiable floor below)
 6. `git push` only after 4 and 5 pass
 
-### Class B — compressed ceremony (updated 2026-04-19)
+### Class B — right-sized ceremony (updated 2026-05-05)
 Applies to: products, customers, dashboards, notification prefs, non-auth staff CRUD, settings UI not touching compliance, search, reports, debt/fix PRs.
 
 Protocol:
-1. `/superpowers:brainstorming` — same session (alignment is cheap; no fresh-session overhead for Class B)
-2. `/superpowers:writing-plans` → commit plan file — **3-5 work streams**, same session. No B-slots.
-3. Single-implementer execution, **same session** (default). Fresh session only if plan reveals a Class A surface mid-execution — triggers reclassification to A, not just a session reset.
-4. TDD per-commit discipline (kept)
-5. **Review gate: Codex CLI only.** Run `codex review --base main`, write `.codex-review-passed` marker. DROP all Claude-on-Claude layers (`/code-review`, `/security-review`, `/bmad-code-review`, `/superpowers:requesting-code-review`) — echo chamber with ~90% overlap and zero cross-model signal. CI is the second gate.
-6. **Runtime smoke test on intended surface** — mandatory before PR merge:
-   - Shopkeeper stories: emulator or device (Metro boot + golden-path flow)
-   - API-only stories: `curl` round-trip against running service
-   - Web stories: browser render + golden-path flow
-7. `git push`
-
-### Class C — minimal ceremony
-Applies to: copy tweaks, color/spacing, config toggles, doc-only, refactors < 50 LOC, dep bumps.
-
-Protocol: `/bmad-quick-dev` or inline, single session, **Codex-only review**, tests only where behavior changed. Runtime smoke test required **only if behavior changed** — doc-only and config-toggle-only changes are exempt (no runtime surface to test).
+1. `/superpowers:brainstorming` — same session. **Skip if the story follows an established template** (e.g., "wire ExportButtons into another screen", "add another report screen following the existing pattern"). The brainstorming output is reusable across template-following stories.
+2. `/superpowers:writing-plans` → commit plan file — **3-5 work streams**, same session.
+3. **Default to worktree parallelism** when 2-3 stories don't share blast radius (different modules, no overlapping migration numbers, no overlapping mobile screens). `git worktree add C:/gs<N> feat/<story-id>` per stream. See "Worktree parallelism" subsection below.
+4. **TDD on business logic.** Render-plumbing/hook-wiring without business logic can rely on typecheck + smoke; tests required where there's behavior to verify.
+5. **Right-sized review gates within a story:**
+   - **Per-task code review ONLY on Class A subsurfaces** inside the story (lines that touch RLS, money/paise/weight, auth/JWT/Firebase, compliance hard-blocks, encryption, audit logs, BullMQ tenant boundary). Pure UI/copy/refactor lines skip per-task review.
+   - **Per-task spec compliance review is DROPPED.** The plan IS the spec; if code matches plan text and typecheck passes, compliance is by construction.
+   - **Whole-branch code review** before push — mandatory.
+   - **`/security-review`** before push — mandatory if the story adds a new attack surface (new endpoint, new file processor, new external integration, new SQL query, new auth path).
+   - **Re-review only if reviewer flagged a non-trivial issue.** Doc-only fix-ups (comment edits, test-name renames) do NOT need re-review.
+6. **Codex CLI cross-model review** when the weekly limit allows (memory `feedback_codex_limit_batch_strategy.md` for current state). When unavailable, the Claude `/security-review` + whole-branch review + CI is the documented substitute (note in commit).
+7. **Runtime smoke test on intended surface** — mandatory before PR merge:
+   - Shopkeeper stories: emulator or device (Metro boot + golden-path flow). Memory `feedback_drive_smoke_headless.md` for headless walk via adb screencap + input.
+   - API-only stories: `curl` round-trip against running service.
+   - Web stories: browser render + golden-path flow.
+8. **Code-truth audit before claiming complete.** Grep current code for the FR's expected route/migration/test. No completion claim without code evidence. Memory + git logs are NOT proof. Use `docs/current-implementation-status.md` and `docs/agent-context/current-state.json` for the current status baseline.
+9. `git push`
+
+**Cut from prior Class B ceremony (drop entirely, observed zero signal in WS-3A):**
+- Per-task spec compliance review
+- Per-task code review on pure UI/copy lines
+- Re-review of doc-only fix-ups
+- Brainstorm session for stories that follow a locked template
+
+**Codified recurring patterns are caught by Semgrep/ESLint, NOT manual review.** See `tools/semgrep/goldsmith-*.yml` (current set) and `.eslintrc.cjs` overrides. Every reviewer-caught pattern that recurs more than once gets codified before the next story. Manual reviewers must NOT spend time on patterns that have automated rules.
+
+### Class C — minimal ceremony (updated 2026-05-05)
+Applies to: copy tweaks, color/spacing, config toggles, doc-only, refactors < 50 LOC, dep bumps, **nav-edge wiring** (adding a `Stack.Screen` + main-tab link to existing surfaces), **seed-data scripts**, **Semgrep/ESLint rule additions**, **CLAUDE.md / agent-context doc updates**.
+
+Protocol: **Code straight to commit. No brainstorm/spec/plan pipeline.** Tests only where behavior changed (so a Semgrep rule addition needs a positive + negative test fixture; a CLAUDE.md edit needs none). Whole-branch review on the PR (NOT per-task review). Runtime smoke required only if a user-visible runtime surface changed; doc-only / config-toggle-only / lint-rule-only changes are exempt.
+
+**Class C is for a single small change, not a Class B in disguise.** If the work touches > 50 LOC, multiple modules, or new logic (vs nav/copy/config), it's actually Class B — reclassify.
 
 ### Reclassification rules
 - If mid-story a B/C task reveals a Class A surface (new API endpoint, money field, auth adjacency) → STOP, reclassify to A, add missing ceremony, then continue. Never merge a Class A touch under a B/C gate.
@@ -255,6 +306,37 @@ Protocol: `/bmad-quick-dev` or inline, single session, **Codex-only review**, te
 ### Non-negotiable floor (all classes)
 Story AC is not closed until the changed surface has been smoke-tested on its intended runtime — **unless the change has no runtime surface** (doc-only, config-toggle-only). A passing test suite + clean code review does not substitute for running the actual artifact the story promised. Layered code inspection catches surface bugs; runtime integration catches system bugs. Without the runtime gate, system bugs leak straight to the demo.
 
+### Worktree parallelism — default for independent stories (2026-05-05)
+
+When 2-3 stories don't share blast radius (different modules, no overlapping migration numbers, no overlapping mobile screens, no overlapping API routes), run them in parallel via separate worktrees:
+
+```
+git worktree add C:/gs<N> feat/<story-id>
+```
+
+Each worktree gets its own implementer + reviewer cycle. Merge order respects migration sequence (lowest first); other parallel work merges in PR-ready order. Memory `feedback_parallel_session_worktrees.md` has the operational pattern; memory `feedback_orchestrator_parallelization.md` has the orchestration model.
+
+**Anti-pattern:** running two implementers in the SAME working directory. Always different worktrees. The single-working-directory anti-pattern bit us in stories 5.7/5.9 and 6.9/8.1 (memory).
+
+**When NOT to parallelize:**
+- Stories that touch `apps/api/src/modules/billing/billing.service.ts` (it's a serialization choke point per memory `project_epic_completion_plan.md`)
+- Stories that share a migration sequence number (one must land first; the other rebases)
+- Stories that share a mobile screen file (e.g., two stories both editing `apps/shopkeeper/app/reports/daily-summary.tsx`)
+- Class A auth/RLS work — keep serial for context-quarantine reasons
+
+### Code-truth audit gate — no completion claim without code evidence (2026-05-05)
+
+Per `docs/current-implementation-status.md`, every claim that a story / FR / acceptance criterion is "complete" MUST be backed by a `git grep` or file-existence check against current code. Memory, prior session summaries, commit logs, and review markers are **not proof**.
+
+Before a story's commit message says "complete", run (or have an agent run) the audit checklist:
+- The expected route is registered (`grep '<route>' apps/api/src/...`)
+- The expected migration exists (`ls packages/db/src/migrations/<seq>*.sql`)
+- The expected test file exists and at least one test asserts new behavior
+- The expected mobile screen has a `Stack.Screen` entry in `_layout.tsx`
+- The story's FRs are reachable from main app navigation (not orphan routes)
+
+If any check fails, the story is NOT complete. Status downgrades to "partial" until the gap closes.
+
 ---
 
 ## Android smoke test — known Windows issues (learned 2026-04-19)
diff --git a/apps/api/package.json b/apps/api/package.json
index 24af57c..4ef81c4 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -11,8 +11,8 @@
     "typecheck": "tsc --noEmit",
     "lint": "eslint src test",
     "test": "vitest run",
-    "test:integration": "vitest run --dir test",
-    "test:e2e": "vitest run test/endpoint-walker.e2e.test.ts",
+    "test:integration": "vitest run --dir test --no-file-parallelism --hookTimeout=180000 --testTimeout=180000",
+    "test:e2e": "vitest run --config vitest.e2e.config.ts test/endpoint-walker.e2e.test.ts",
     "build": "tsc -p tsconfig.build.json",
     "start": "node dist/main.js"
   },
@@ -75,4 +75,4 @@
     "vitest": "^1.4.0",
     "zod": "^3.23.0"
   }
-}
\ No newline at end of file
+}
diff --git a/apps/api/src/modules/auth/auth.module.ts b/apps/api/src/modules/auth/auth.module.ts
index ac1e42a..f828383 100644
--- a/apps/api/src/modules/auth/auth.module.ts
+++ b/apps/api/src/modules/auth/auth.module.ts
@@ -4,6 +4,7 @@ import { Redis } from '@goldsmith/cache';
 import { createPool } from '@goldsmith/db';
 import { PermissionsCache } from '@goldsmith/tenant-config';
 import { AuthController } from './auth.controller';
+import { AuthCompatibilityController } from './auth-compatibility.controller';
 import { AuthService } from './auth.service';
 import { AuthRepository } from './auth.repository';
 import { AuditLogRepository } from './audit-log.repository';
@@ -16,7 +17,7 @@ import { SMS_ADAPTER } from './sms/sms-adapter.interface';
 
 @Module({
   imports: [PassportModule],
-  controllers: [AuthController],
+  controllers: [AuthController, AuthCompatibilityController],
   providers: [
     {
       provide: 'PG_POOL',
diff --git a/apps/api/src/modules/catalog/catalog.service.spec.ts b/apps/api/src/modules/catalog/catalog.service.spec.ts
index 6b1a4e5..2de0337 100644
--- a/apps/api/src/modules/catalog/catalog.service.spec.ts
+++ b/apps/api/src/modules/catalog/catalog.service.spec.ts
@@ -153,6 +153,47 @@ describe('CatalogService.getProducts()', () => {
     expect(BigInt(result.items[0].estimatedPrice!.totalPaise)).toBe(withCustom.totalPaise);
   });
 
+  it('normalizes legacy object-shaped making charges without crashing', async () => {
+    const legacyMc = { RINGS: { type: 'percent', value: '18.00' } };
+    const pool = makePool([
+      { rows: [{ making_charges_json: legacyMc }] },
+      { rows: [baseProduct] },
+    ]);
+    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
+    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);
+
+    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
+
+    const expected = computeProductPrice({
+      netWeightG: '4.5000', ratePerGramPaise: 673750n,
+      makingChargePct: '18.00', stoneChargesPaise: 0n, hallmarkFeePaise: 0n,
+    });
+    expect(result.items[0].priceAvailable).toBe(true);
+    expect(BigInt(result.items[0].estimatedPrice!.totalPaise)).toBe(expected.totalPaise);
+  });
+
+  it('maps raw DB purity values to current rate keys', async () => {
+    const products = [
+      { ...baseProduct, id: 'prod-22k', purity: '22K', total_count: '3' },
+      { ...baseProduct, id: 'prod-24k', purity: '24K', total_count: '3' },
+      { ...baseProduct, id: 'prod-999', metal: 'SILVER', purity: '999', total_count: '3' },
+    ];
+    const pool = makePool([
+      { rows: [] },
+      { rows: products },
+    ]);
+    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
+    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);
+
+    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
+
+    expect(result.items).toHaveLength(3);
+    expect(result.items.every((item) => item.priceAvailable)).toBe(true);
+    expect(BigInt(result.items[0]!.estimatedPrice!.breakdown.goldValuePaise)).toBe(3031875n);
+    expect(BigInt(result.items[1]!.estimatedPrice!.breakdown.goldValuePaise)).toBe(3307500n);
+    expect(BigInt(result.items[2]!.estimatedPrice!.breakdown.goldValuePaise)).toBe(42750n);
+  });
+
   it('falls back to 12.00% when no making charge matches category', async () => {
     const pool = makePool([
       { rows: [] },
diff --git a/apps/api/src/modules/catalog/catalog.service.ts b/apps/api/src/modules/catalog/catalog.service.ts
index ea25e38..98e2046 100644
--- a/apps/api/src/modules/catalog/catalog.service.ts
+++ b/apps/api/src/modules/catalog/catalog.service.ts
@@ -5,8 +5,11 @@ import { PricingService } from '../pricing/pricing.service';
 import type { CurrentRatesResult } from '../pricing/pricing.service';
 import { computeProductPrice } from '@goldsmith/money';
 import type { PriceBreakdown } from '@goldsmith/money';
-import { MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';
-import type { MakingChargeConfig } from '@goldsmith/shared';
+import {
+  MAKING_CHARGE_DEFAULTS,
+  MakingChargesArraySchema,
+} from '@goldsmith/shared';
+import type { MakingChargeConfig, PurityKey } from '@goldsmith/shared';
 import { SettingsRepository } from '../settings/settings.repository';
 import {
   IMAGEKIT_URL_BUILDER,
@@ -135,6 +138,55 @@ interface ShopRow {
   config:       Record<string, unknown> | null;
 }
 
+const DB_PURITY_TO_RATE_KEY: Record<string, PurityKey> = {
+  '24K':        'GOLD_24K',
+  '22K':        'GOLD_22K',
+  '20K':        'GOLD_20K',
+  '18K':        'GOLD_18K',
+  '14K':        'GOLD_14K',
+  '999':        'SILVER_999',
+  '925':        'SILVER_925',
+  'GOLD_24K':   'GOLD_24K',
+  'GOLD_22K':   'GOLD_22K',
+  'GOLD_20K':   'GOLD_20K',
+  'GOLD_18K':   'GOLD_18K',
+  'GOLD_14K':   'GOLD_14K',
+  'SILVER_999': 'SILVER_999',
+  'SILVER_925': 'SILVER_925',
+};
+
+function toRateKey(rawPurity: string): PurityKey | undefined {
+  return DB_PURITY_TO_RATE_KEY[rawPurity.trim().toUpperCase()];
+}
+
+function normalizeMakingCharges(raw: unknown): MakingChargeConfig[] {
+  const currentShape = MakingChargesArraySchema.safeParse(raw);
+  if (currentShape.success) return currentShape.data;
+
+  if (raw === null || raw === undefined || Array.isArray(raw) || typeof raw !== 'object') {
+    return MAKING_CHARGE_DEFAULTS;
+  }
+
+  const legacyRows = Object.entries(raw as Record<string, unknown>).map(([rawCategory, value]) => {
+    const category = rawCategory.trim().toUpperCase();
+    if (typeof value === 'string' || typeof value === 'number') {
+      return { category, type: 'percent', value: String(value) };
+    }
+    if (value !== null && typeof value === 'object') {
+      const row = value as Record<string, unknown>;
+      return {
+        category,
+        type: row['type'] === 'fixed_per_gram' ? 'fixed_per_gram' : 'percent',
+        value: String(row['value'] ?? row['percent'] ?? row['makingChargePct'] ?? ''),
+      };
+    }
+    return { category, type: 'percent', value: '' };
+  });
+
+  const legacyShape = MakingChargesArraySchema.safeParse(legacyRows);
+  return legacyShape.success ? legacyShape.data : MAKING_CHARGE_DEFAULTS;
+}
+
 export interface ProductCatalogRow {
   id:                        string;
   sku:                       string;
@@ -248,7 +300,7 @@ export class CatalogService {
     ]);
     const { mcResult, productsResult } = scopedResult;
 
-    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
+    const configs = normalizeMakingCharges(mcResult.rows[0]?.making_charges_json);
     const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));
 
     const total = productsResult.rows.length > 0 ? Number(productsResult.rows[0].total_count) : 0;
@@ -295,7 +347,7 @@ export class CatalogService {
       throw new NotFoundException({ code: 'catalog.product_not_found' });
     }
 
-    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
+    const configs = normalizeMakingCharges(mcResult.rows[0]?.making_charges_json);
     const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));
 
     return this.computeCatalogProduct(productResult.rows[0], ratesResult, mcMap);
@@ -334,7 +386,10 @@ export class CatalogService {
     rates: CurrentRatesResult,
     mcMap: Map<string, string>,
   ): CatalogProduct {
-    const rateEntry = (rates as unknown as Record<string, { perGramPaise: bigint } | undefined>)[row.purity];
+    const rateKey = toRateKey(row.purity);
+    const rateEntry = rateKey === undefined
+      ? undefined
+      : (rates as unknown as Record<string, { perGramPaise: bigint } | undefined>)[rateKey];
 
     let priceAvailable = false;
     let estimatedPrice: EstimatedPrice | undefined;
diff --git a/apps/api/src/modules/reviews/reviews.repository.ts b/apps/api/src/modules/reviews/reviews.repository.ts
index 4ab659e..2be0b74 100644
--- a/apps/api/src/modules/reviews/reviews.repository.ts
+++ b/apps/api/src/modules/reviews/reviews.repository.ts
@@ -43,15 +43,15 @@ export class ReviewsRepository {
     productId: string;
   }): Promise<{ reviews: ReviewRow[]; averageRating: number | null; total: number }> {
     return withShopTx(this.pool, params.shopId, async (tx) => {
-      // Join customers to get first name only (privacy)
+      // Join customers to get first name only (privacy).
       const { rows } = await tx.query<ReviewRow & { avg_rating: string | null; total_count: string }>(
         `SELECT pr.id, pr.shop_id, pr.product_id, pr.customer_id,
                 pr.rating, pr.review_text, pr.created_at,
-                split_part(c.full_name, ' ', 1) AS customer_first_name,
+                split_part(c.name, ' ', 1) AS customer_first_name,
                 AVG(pr.rating) OVER () AS avg_rating,
                 COUNT(*) OVER ()::text AS total_count
            FROM product_reviews pr
-           JOIN customers c ON c.id = pr.customer_id
+           JOIN customers c ON c.id = pr.customer_id AND c.shop_id = pr.shop_id
           WHERE pr.shop_id = $1 AND pr.product_id = $2
           ORDER BY pr.created_at DESC
           LIMIT 50`,
diff --git a/apps/api/src/modules/tenant-boot/tenant-boot.service.ts b/apps/api/src/modules/tenant-boot/tenant-boot.service.ts
index 18973f3..5252e13 100644
--- a/apps/api/src/modules/tenant-boot/tenant-boot.service.ts
+++ b/apps/api/src/modules/tenant-boot/tenant-boot.service.ts
@@ -17,7 +17,7 @@ export class TenantBootService {
     try {
       await c.query('SET ROLE app_user');
       const r = await c.query<{ id: string; display_name: string; config: Record<string, unknown> }>(
-        `SELECT * FROM tenant_boot_lookup($1)`, [slug],
+        `SELECT * FROM public.tenant_boot_lookup($1)`, [slug],
       );
       if (r.rows.length === 0) throw new NotFoundException({ code: 'tenant.not_found' });
       const row = r.rows[0];
diff --git a/apps/api/test/auth-link-migration.integration.test.ts b/apps/api/test/auth-link-migration.integration.test.ts
index 0f6fa27..fd5483b 100644
--- a/apps/api/test/auth-link-migration.integration.test.ts
+++ b/apps/api/test/auth-link-migration.integration.test.ts
@@ -107,4 +107,28 @@ describe('0003_auth_link migration', () => {
       c.release();
     }
   });
+
+  it('pre-auth SECURITY DEFINER functions schema-qualify platform table access', async () => {
+    const c = await pool.connect();
+    try {
+      const defs = await c.query<{ name: string; definition: string }>(`
+        SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition
+          FROM pg_proc p
+          JOIN pg_namespace n ON n.oid = p.pronamespace
+         WHERE n.nspname = 'public'
+           AND p.proname IN ('auth_lookup_user_by_phone', 'tenant_boot_lookup')
+         ORDER BY p.proname
+      `);
+      expect(defs.rows).toHaveLength(2);
+      for (const row of defs.rows) {
+        expect(row.definition).toContain('public.shops');
+      }
+      const schemaGrant = await c.query<{ has_schema_privilege: boolean }>(
+        `SELECT has_schema_privilege('platform_admin', 'public', 'USAGE')`,
+      );
+      expect(schemaGrant.rows[0]?.has_schema_privilege).toBe(true);
+    } finally {
+      c.release();
+    }
+  });
 });
diff --git a/apps/customer-mobile/README.md b/apps/customer-mobile/README.md
index c0a7b32..b8896b8 100644
--- a/apps/customer-mobile/README.md
+++ b/apps/customer-mobile/README.md
@@ -14,7 +14,7 @@ pnpm --filter @goldsmith/customer-mobile start
 
 | Var | Required | Purpose |
 |---|---|---|
-| `EXPO_PUBLIC_API_BASE_URL` | yes | NestJS API origin (e.g. `http://10.0.2.2:3000`) |
+| `EXPO_PUBLIC_API_BASE_URL` | yes | NestJS API origin (e.g. `http://10.0.2.2:3001`) |
 | `EXPO_PUBLIC_SHOP_SLUG` | yes | Tenant slug (`anchor-dev` for dev) |
 | `EXPO_PUBLIC_DEV_AUTH` | dev-only | Set to `1` to inject a mock customer session at boot |
 | `EXPO_PUBLIC_APP_NAME` | optional | Override app display name (defaults to tenant displayName) |
diff --git a/apps/customer-mobile/app.config.ts b/apps/customer-mobile/app.config.ts
index 4ddaead..819355b 100644
--- a/apps/customer-mobile/app.config.ts
+++ b/apps/customer-mobile/app.config.ts
@@ -28,6 +28,7 @@ const config: ExpoConfig = {
     'expo-font',
     'expo-router',
     'expo-secure-store',
+    './plugins/with-pnpm-gradle-plugin-paths',
   ],
   // White-label: package / bundleIdentifier MUST differ per tenant build
   // — app stores and devices identify apps by these values, so two tenant
@@ -43,7 +44,7 @@ const config: ExpoConfig = {
     supportsTablet: false,
   },
   extra: {
-    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3000',
+    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3001',
     tenantSlug: process.env['EXPO_PUBLIC_SHOP_SLUG'] ?? 'anchor-dev',
     devAuth: process.env['EXPO_PUBLIC_DEV_AUTH'] === '1',
     firebaseProjectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'goldsmith-dev',
diff --git a/apps/customer-mobile/app/(tabs)/profile.tsx b/apps/customer-mobile/app/(tabs)/profile.tsx
index 88c40ff..325db6a 100644
--- a/apps/customer-mobile/app/(tabs)/profile.tsx
+++ b/apps/customer-mobile/app/(tabs)/profile.tsx
@@ -1,5 +1,6 @@
 import React, { useState, useRef } from 'react';
 import { View, Text, Pressable, ScrollView } from 'react-native';
+import { useRouter } from 'expo-router';
 import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
 import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
 import { LoyaltyPointsCard } from '../../src/components/LoyaltyPointsCard';
@@ -14,6 +15,7 @@ import { customerSelfDelete } from '../../src/api/endpoints';
 
 export default function Profile(): React.ReactElement {
   const { customer, signOut } = useCustomerSession();
+  const router = useRouter();
   const [resultMsg, setResultMsg] = useState<string | null>(null);
   const [deleting, setDeleting]   = useState(false);
   const [activeTab, setActiveTab] = useState<TimelineTab>('purchases');
@@ -60,6 +62,28 @@ export default function Profile(): React.ReactElement {
 
         <LoyaltyPointsCard />
 
+        <View
+          testID="profile-service-links"
+          style={{
+            paddingHorizontal: spacing.lg,
+            paddingTop: spacing.sm,
+            gap: spacing.sm,
+          }}
+        >
+          <ProfileServiceLink
+            testID="profile-address-book-link"
+            title="पता पुस्तिका"
+            subtitle="होम डिलीवरी और ट्राई-एट-होम के लिए"
+            onPress={() => router.push('/profile/addresses')}
+          />
+          <ProfileServiceLink
+            testID="profile-referral-code-link"
+            title="रेफरल कोड"
+            subtitle="दोस्तों के साथ साझा करने के लिए"
+            onPress={() => router.push('/profile/referral')}
+          />
+        </View>
+
         {/* ── Timeline ── */}
         <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
           <TimelineTabBar activeTab={activeTab} onTabChange={handleTabChange} />
@@ -135,3 +159,41 @@ export default function Profile(): React.ReactElement {
     </View>
   );
 }
+
+function ProfileServiceLink({
+  title,
+  subtitle,
+  testID,
+  onPress,
+}: {
+  title:    string;
+  subtitle: string;
+  testID:   string;
+  onPress:  () => void;
+}): React.ReactElement {
+  return (
+    <Pressable
+      testID={testID}
+      onPress={onPress}
+      accessibilityRole="button"
+      accessibilityLabel={`${title} खोलें`}
+      style={{
+        backgroundColor: colors.white,
+        borderRadius: radii.md,
+        borderWidth: 1,
+        borderColor: colors.border,
+        paddingHorizontal: spacing.md,
+        paddingVertical: spacing.md,
+        minHeight: 64,
+        justifyContent: 'center',
+      }}
+    >
+      <Text style={{ fontFamily: typography.headingMid.family, fontSize: 16, color: colors.ink }}>
+        {title}
+      </Text>
+      <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute, marginTop: 4 }}>
+        {subtitle}
+      </Text>
+    </Pressable>
+  );
+}
diff --git a/apps/customer-mobile/app/rate-lock/index.tsx b/apps/customer-mobile/app/rate-lock/index.tsx
index 05bed3a..8316e10 100644
--- a/apps/customer-mobile/app/rate-lock/index.tsx
+++ b/apps/customer-mobile/app/rate-lock/index.tsx
@@ -12,7 +12,7 @@ import { getPublicRates, createCustomerRateLockBooking } from '../../src/api/end
 import type { RateLockBookingResult } from '../../src/api/endpoints';
 
 const API_BASE =
-  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3000';
+  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3001';
 
 function ConfirmationCard({ booking }: { booking: RateLockBookingResult }): React.ReactElement {
   const lockedRate = Math.round(Number(booking.lockedRate24kPaisePerGram) / 100);
diff --git a/apps/customer-mobile/package.json b/apps/customer-mobile/package.json
index db2f0d7..dd0bada 100644
--- a/apps/customer-mobile/package.json
+++ b/apps/customer-mobile/package.json
@@ -5,8 +5,8 @@
   "main": "expo-router/entry",
   "scripts": {
     "start": "expo start --dev-client",
-    "android": "expo start --dev-client --android",
-    "ios": "expo start --dev-client --ios",
+    "android": "expo run:android",
+    "ios": "expo run:ios",
     "export": "expo export --platform web --output-dir dist",
     "typecheck": "tsc --noEmit",
     "lint": "eslint .",
@@ -17,13 +17,15 @@
     "@expo/vector-icons": "~14.0.0",
     "@goldsmith/auth-client": "workspace:*",
     "@goldsmith/i18n": "workspace:*",
+    "@goldsmith/money": "workspace:*",
     "@goldsmith/shared": "workspace:*",
     "@goldsmith/ui-mobile": "workspace:*",
     "@goldsmith/ui-tokens": "workspace:*",
     "@react-native-async-storage/async-storage": "1.23.1",
     "@react-native-firebase/app": "^21.0.0",
     "@react-native-firebase/auth": "^21.0.0",
-    "@react-navigation/native": "^7.2.2",
+    "@react-navigation/native": "^6.1.18",
+    "@tanstack/query-core": "5.99.2",
     "@tanstack/react-query": "^5.0.0",
     "axios": "^1.7.0",
     "expo": "~51.0.0",
@@ -32,19 +34,22 @@
     "expo-dev-client": "~4.0.0",
     "expo-font": "~12.0.0",
     "expo-haptics": "~13.0.1",
-    "expo-image": "^55.0.9",
+    "expo-image": "~1.13.0",
+    "expo-linking": "~6.3.1",
     "expo-router": "~3.5.0",
     "expo-secure-store": "~13.0.2",
     "expo-splash-screen": "~0.27.0",
     "expo-status-bar": "~1.12.0",
     "nativewind": "^4.0.36",
+    "prop-types": "^15.8.1",
     "react": "18.2.0",
     "react-dom": "18.2.0",
-    "react-native": "0.74.0",
+    "react-native": "0.74.5",
+    "react-native-gesture-handler": "~2.16.1",
     "react-native-reanimated": "~3.10.1",
-    "react-native-safe-area-context": "4.10.0",
-    "react-native-screens": "3.31.0",
-    "react-native-svg": "^15.2.0",
+    "react-native-safe-area-context": "4.10.5",
+    "react-native-screens": "3.31.1",
+    "react-native-svg": "15.2.0",
     "react-native-web": "~0.19.0",
     "tailwindcss": "^3.4.4",
     "zustand": "^4.5.0"
@@ -56,7 +61,7 @@
     "@types/react": "~18.2.79",
     "axios-mock-adapter": "^1.22.0",
     "jsdom": "^24.0.0",
-    "typescript": "^5.4.0",
+    "typescript": "~5.3.3",
     "vitest": "^1.6.0"
   }
 }
diff --git a/apps/customer-mobile/src/api/client.ts b/apps/customer-mobile/src/api/client.ts
index 6c46bbb..b63fb9a 100644
--- a/apps/customer-mobile/src/api/client.ts
+++ b/apps/customer-mobile/src/api/client.ts
@@ -7,7 +7,7 @@ import { useCustomerSessionStore } from '../stores/customerSessionStore';
 import { useTenantStore } from '../stores/tenantStore';
 
 const baseURL =
-  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3000';
+  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3001';
 
 export const api: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });
 
diff --git a/apps/customer-mobile/src/hooks/useCustomerTimeline.ts b/apps/customer-mobile/src/hooks/useCustomerTimeline.ts
index 4733e9c..fd6dac5 100644
--- a/apps/customer-mobile/src/hooks/useCustomerTimeline.ts
+++ b/apps/customer-mobile/src/hooks/useCustomerTimeline.ts
@@ -1,4 +1,4 @@
-import { useQuery } from '@tanstack/react-query';
+import { useQuery, type UseQueryResult } from '@tanstack/react-query';
 import {
   getPurchases,
   getCustomOrders,
@@ -17,7 +17,7 @@ interface PaginationOpts {
   offset: number;
 }
 
-export function usePurchases(opts: PaginationOpts) {
+export function usePurchases(opts: PaginationOpts): UseQueryResult<PurchasesResponse, Error> {
   return useQuery<PurchasesResponse>({
     queryKey:  ['customer-timeline', 'purchases', opts.limit, opts.offset],
     queryFn:   () => getPurchases(opts),
@@ -25,7 +25,7 @@ export function usePurchases(opts: PaginationOpts) {
   });
 }
 
-export function useCustomOrders(opts: PaginationOpts) {
+export function useCustomOrders(opts: PaginationOpts): UseQueryResult<CustomOrdersResponse, Error> {
   return useQuery<CustomOrdersResponse>({
     queryKey:  ['customer-timeline', 'custom-orders', opts.limit, opts.offset],
     queryFn:   () => getCustomOrders(opts),
@@ -33,7 +33,7 @@ export function useCustomOrders(opts: PaginationOpts) {
   });
 }
 
-export function useRateLocks(opts: PaginationOpts) {
+export function useRateLocks(opts: PaginationOpts): UseQueryResult<RateLockBookingsResponse, Error> {
   return useQuery<RateLockBookingsResponse>({
     queryKey:  ['customer-timeline', 'rate-locks', opts.limit, opts.offset],
     queryFn:   () => getRateLockBookings(opts),
@@ -41,7 +41,7 @@ export function useRateLocks(opts: PaginationOpts) {
   });
 }
 
-export function useTryAtHomeBookings(opts: PaginationOpts) {
+export function useTryAtHomeBookings(opts: PaginationOpts): UseQueryResult<TryAtHomeBookingsListResponse, Error> {
   return useQuery<TryAtHomeBookingsListResponse>({
     queryKey:  ['customer-timeline', 'try-at-home', opts.limit, opts.offset],
     queryFn:   () => getTryAtHomeBookings(opts),
diff --git a/apps/customer-mobile/test/profile.test.tsx b/apps/customer-mobile/test/profile.test.tsx
index c33706c..6aea60c 100644
--- a/apps/customer-mobile/test/profile.test.tsx
+++ b/apps/customer-mobile/test/profile.test.tsx
@@ -1,7 +1,8 @@
 import { describe, it, expect, vi, beforeEach } from 'vitest';
-import { render } from '@testing-library/react';
+import { fireEvent, render } from '@testing-library/react';
 import React from 'react';
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
+import { useRouter } from 'expo-router';
 
 // Mock all network calls
 vi.mock('../src/api/endpoints', () => ({
@@ -35,7 +36,16 @@ function wrapper({ children }: { children: React.ReactNode }) {
 }
 
 describe('Profile screen', () => {
-  beforeEach(() => { vi.clearAllMocks(); });
+  const push = vi.fn();
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vi.mocked(useRouter).mockReturnValue({
+      push,
+      replace: vi.fn(),
+      back: vi.fn(),
+    } as unknown as ReturnType<typeof useRouter>);
+  });
 
   it('renders brand header and loyalty card', () => {
     const { getByTestId } = render(<Profile />, { wrapper });
@@ -61,4 +71,14 @@ describe('Profile screen', () => {
     expect(getByTestId('profile-delete-button')).toBeTruthy();
     expect(getByTestId('profile-signout-button')).toBeTruthy();
   });
+
+  it('links to address book and referral code flows', () => {
+    const { getByTestId } = render(<Profile />, { wrapper });
+
+    fireEvent.click(getByTestId('profile-address-book-link'));
+    expect(push).toHaveBeenCalledWith('/profile/addresses');
+
+    fireEvent.click(getByTestId('profile-referral-code-link'));
+    expect(push).toHaveBeenCalledWith('/profile/referral');
+  });
 });
diff --git a/apps/customer-web/app/contact/page.tsx b/apps/customer-web/app/contact/page.tsx
index 819ebbc..5c8dced 100644
--- a/apps/customer-web/app/contact/page.tsx
+++ b/apps/customer-web/app/contact/page.tsx
@@ -1,5 +1,12 @@
 import { headers } from 'next/headers';
 import { fetchTenantConfig } from '@/lib/api';
+import {
+  buildTelUrl,
+  buildWhatsAppUrl,
+  tenantAddress,
+  tenantPhone,
+  tenantWhatsapp,
+} from '@/lib/storefront';
 
 function resolveSlug(): string | null {
   const h = headers();
@@ -14,8 +21,8 @@ interface PageProps {
 }
 
 const INTEREST_LABELS: Record<string, string> = {
-  'try-at-home': 'घर पर आभूषण कोशिश (Try at Home)',
-  'rate-lock':   'दर-लॉक बुकिंग (Rate Lock)',
+  'try-at-home': 'घर पर आभूषण ट्राई',
+  'rate-lock':   'दर-लॉक बुकिंग',
 };
 
 export default async function ContactPage({ searchParams }: PageProps) {
@@ -25,42 +32,66 @@ export default async function ContactPage({ searchParams }: PageProps) {
   const interestLabel = searchParams.interest
     ? (INTEREST_LABELS[searchParams.interest] ?? searchParams.interest)
     : null;
+  const phone = config ? tenantPhone(config) : null;
+  const phoneHref = buildTelUrl(phone);
+  const whatsappHref = config
+    ? buildWhatsAppUrl(
+        tenantWhatsapp(config),
+        `नमस्ते ${config.appName}, मुझे ${interestLabel ?? 'आभूषण'} के बारे में जानकारी चाहिए।`,
+      )
+    : null;
+  const address = config ? tenantAddress(config) : null;
 
   return (
-    <div className="max-w-xl mx-auto px-4 py-12">
+    <div className="mx-auto max-w-xl px-4 py-12">
       <a
         href="/products"
-        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
+        className="mb-6 inline-block font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
         aria-label="उत्पाद सूची पर वापस जाएं"
       >
-        ← उत्पाद देखें
+        उत्पाद देखें
       </a>
 
-      <h1 className="font-heading text-3xl text-ink mb-2">दुकान से संपर्क करें</h1>
+      <h1 className="font-heading text-3xl text-ink">दुकान से संपर्क करें</h1>
 
       {interestLabel && (
-        <p className="font-body text-sm text-inkMute mb-6">
+        <p className="mb-6 mt-2 font-body text-sm text-inkMute">
           आप <strong className="text-ink">{interestLabel}</strong> में रुचि रखते हैं।
         </p>
       )}
 
-      <div className="rounded-lg border border-border bg-white p-6 flex flex-col gap-4">
-        <p className="font-body text-sm text-ink">
-          इस सेवा के लिए दुकानदार से सीधे संपर्क करें:
-        </p>
-
-        {config && (
-          <p className="font-heading text-lg text-ink">{config.appName}</p>
-        )}
+      <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6">
+        {config && <p className="font-heading text-lg text-ink">{config.appName}</p>}
 
-        <div className="flex flex-col gap-2 font-body text-sm text-ink">
-          <p>📞 दुकान पर कॉल करें</p>
-          <p>💬 WhatsApp पर संदेश भेजें</p>
-          <p>🕐 सोमवार–शनिवार, सुबह 10 बजे से शाम 8 बजे</p>
+        <div className="flex flex-col gap-3 font-body text-sm text-ink">
+          {address && <p>{address}</p>}
+          {phoneHref ? (
+            <a
+              className="text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
+              href={phoneHref}
+            >
+              कॉल करें: {phone}
+            </a>
+          ) : (
+            <p className="text-inkMute">फोन नंबर अभी ऑनलाइन उपलब्ध नहीं है।</p>
+          )}
+          {whatsappHref ? (
+            <a
+              className="text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
+              href={whatsappHref}
+              rel="noopener noreferrer"
+              target="_blank"
+            >
+              WhatsApp पर संदेश भेजें
+            </a>
+          ) : (
+            <p className="text-inkMute">WhatsApp लिंक अभी उपलब्ध नहीं है।</p>
+          )}
+          <p>सोमवार-शनिवार, सुबह 10 बजे से शाम 8 बजे</p>
         </div>
 
-        <p className="font-body text-xs text-inkMute border-t border-border pt-4">
-          ऑनलाइन बुकिंग सुविधा जल्द उपलब्ध होगी।
+        <p className="border-t border-border pt-4 font-body text-xs text-inkMute">
+          ऑनलाइन बुकिंग सुविधा उपलब्ध होने तक दुकान आपकी रुचि सीधे पुष्टि करेगी।
         </p>
       </div>
     </div>
diff --git a/apps/customer-web/app/layout.tsx b/apps/customer-web/app/layout.tsx
index a5564d1..c4d112f 100644
--- a/apps/customer-web/app/layout.tsx
+++ b/apps/customer-web/app/layout.tsx
@@ -4,6 +4,7 @@ import { Yatra_One, Noto_Sans_Devanagari } from 'next/font/google';
 import './globals.css';
 import { fetchTenantConfig } from '@/lib/api';
 import { buildThemeStyle } from '@/lib/theme';
+import { StorefrontFooter } from '@/components/StorefrontFooter';
 
 const yatraOne = Yatra_One({
   weight: '400',
@@ -64,6 +65,18 @@ export default async function RootLayout({ children }: { children: React.ReactNo
   const config = await fetchTenantConfig(slug);
   if (!config) return unavailablePage;
 
+  const navItems = [
+    { href: '/products', label: 'उत्पाद' },
+    { href: '/products?metal=GOLD', label: 'सोना' },
+    { href: '/products?metal=SILVER', label: 'चांदी' },
+    { href: '/products?search=ring', label: 'रिंग्स' },
+    { href: '/products?search=earring', label: 'ईयररिंग्स' },
+    { href: '/products?search=pendant', label: 'पेंडेंट्स' },
+    { href: '/wishlist', label: 'पसंदीदा' },
+    { href: '/try-at-home', label: 'घर पर ट्राई' },
+    { href: '/rate-lock', label: 'दर-लॉक' },
+  ];
+
   // XSS guard: only allow https:// logo URLs
   const safeLogoUrl =
     config.logoUrl && config.logoUrl.startsWith('https://') ? config.logoUrl : null;
@@ -77,34 +90,70 @@ export default async function RootLayout({ children }: { children: React.ReactNo
       <body className="bg-bg text-ink min-h-screen font-body">
         <a
           href="#main-content"
-          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-white px-4 py-2 rounded z-50"
+          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-50 rounded bg-white px-4 py-2 text-primary"
         >
           मुख्य सामग्री पर जाएं
         </a>
-        <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-40">
-          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
-            {safeLogoUrl && (
-              <img
-                src={safeLogoUrl}
-                alt={`${config.appName} का लोगो`}
-                className="h-10 w-auto object-contain"
-              />
-            )}
-            <span className="font-heading text-xl text-ink">{config.appName}</span>
+        <header className="sticky top-0 z-40 border-b border-[#2b0d4f]/20 bg-white shadow-sm">
+          <div className="bg-[#2b0d4f] text-white">
+            <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 md:grid-cols-[220px_1fr_auto] md:items-center">
+              <a href="/" className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-white">
+                {safeLogoUrl ? (
+                  <img
+                    src={safeLogoUrl}
+                    alt={`${config.appName} का लोगो`}
+                    className="h-10 w-auto object-contain sm:h-11"
+                  />
+                ) : (
+                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d7b46a] bg-[#f7edd7] font-heading text-base text-[#2b0d4f] sm:h-11 sm:w-11 sm:text-lg">
+                    स्व
+                  </span>
+                )}
+                <span className="truncate font-heading text-lg sm:text-xl">{config.appName}</span>
+              </a>
+
+              <form action="/products" className="flex min-h-[44px] overflow-hidden rounded bg-white text-[#1E2440]">
+                <label htmlFor="site-search" className="sr-only">आभूषण खोजें</label>
+                <input
+                  id="site-search"
+                  name="search"
+                  className="min-w-0 flex-1 px-3 font-body text-sm outline-none sm:px-4"
+                  placeholder="सोना, डायमंड, रिंग्स, ईयररिंग्स खोजें"
+                />
+                <button
+                  type="submit"
+                  className="w-14 bg-[#d7a74d] font-body text-sm font-semibold text-[#2b0d4f] focus-visible:outline-2 focus-visible:outline-white"
+                >
+                  खोजें
+                </button>
+              </form>
+
+              <div className="hidden items-center gap-4 text-center text-xs font-semibold uppercase tracking-wide md:flex">
+                <a href="/buying-guide/diamond" className="hover:text-[#f0d58f] focus-visible:outline-2 focus-visible:outline-white">Diamond</a>
+                <a href="/buying-guide/silver" className="hover:text-[#f0d58f] focus-visible:outline-2 focus-visible:outline-white">Silver</a>
+                <a href="/loyalty" className="hover:text-[#f0d58f] focus-visible:outline-2 focus-visible:outline-white">Loyalty</a>
+              </div>
+            </div>
+          </div>
+          <div className="overflow-x-auto bg-white">
             <nav
-              className="ml-auto hidden items-center gap-4 text-sm font-body text-ink md:flex"
+              className="mx-auto flex max-w-6xl items-center gap-6 whitespace-nowrap px-4 py-3 text-sm font-semibold text-[#2b0d4f]"
               aria-label="मुख्य नेविगेशन"
             >
-              <a className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/products">उत्पाद</a>
-              <a className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/wishlist">पसंदीदा</a>
-              <a className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/try-at-home">घर पर ट्राई</a>
-              <a className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/rate-lock">Rate Lock</a>
-              <a className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/loyalty">लॉयल्टी</a>
-              <a className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href="/return-policy">Return Policy</a>
+              {navItems.map((item) => (
+                <a
+                  key={item.href}
+                  className="hover:text-[#b57b2c] focus-visible:outline-2 focus-visible:outline-primary"
+                  href={item.href}
+                >
+                  {item.label}
+                </a>
+              ))}
             </nav>
           </div>
         </header>
         <main id="main-content">{children}</main>
+        <StorefrontFooter config={config} />
       </body>
     </html>
   );
diff --git a/apps/customer-web/app/page.tsx b/apps/customer-web/app/page.tsx
index 37b828a..606ec22 100644
--- a/apps/customer-web/app/page.tsx
+++ b/apps/customer-web/app/page.tsx
@@ -1,13 +1,114 @@
 import { headers } from 'next/headers';
 import { fetchTenantConfig, fetchPublicRates, fetchProducts } from '@/lib/api';
-import { GoldRateCard } from '@/components/GoldRateCard';
 import { ProductGrid } from '@/components/ProductGrid';
+import { baseUrlFromHeaders, jsonLd, tenantAddress, tenantPhone } from '@/lib/storefront';
+
+const heroImages = [
+  {
+    src: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80',
+    alt: 'सोने और हीरे का हार',
+  },
+  {
+    src: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=700&q=80',
+    alt: 'हीरे की अंगूठी',
+  },
+  {
+    src: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=700&q=80',
+    alt: 'त्योहार के लिए आभूषण',
+  },
+];
+
+const collectionTiles = [
+  {
+    title: 'नई कलेक्शन',
+    text: 'हल्के और शादी के डिजाइन',
+    href: '/products',
+    src: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=700&q=80',
+  },
+  {
+    title: 'रिंग्स',
+    text: 'रोजमर्रा और एंगेजमेंट',
+    href: '/products?search=ring',
+    src: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=700&q=80',
+  },
+  {
+    title: 'ईयररिंग्स',
+    text: 'पार्टी और गिफ्ट विकल्प',
+    href: '/products?search=earring',
+    src: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=700&q=80',
+  },
+  {
+    title: 'चांदी',
+    text: '925 और 999 शुद्धता',
+    href: '/products?metal=SILVER',
+    src: 'https://images.unsplash.com/photo-1619119069152-a2b331eb392a?auto=format&fit=crop&w=700&q=80',
+  },
+];
+
+const lovedOnes = [
+  { label: 'बहन के लिए', href: '/products?search=gift' },
+  { label: 'पत्नी के लिए', href: '/products?search=necklace' },
+  { label: 'मां के लिए', href: '/products?search=bangle' },
+  { label: 'अपने लिए', href: '/products?search=daily' },
+];
+
+const everydayCollections = [
+  { title: 'Everyday Rings', href: '/products?search=ring' },
+  { title: 'Hoops & Huggies', href: '/products?search=earring' },
+  { title: 'Everyday Bracelet', href: '/products?search=bracelet' },
+  { title: 'Daily Pendant', href: '/products?search=pendant' },
+  { title: 'Silver Essentials', href: '/products?metal=SILVER' },
+  { title: 'Gold Classics', href: '/products?metal=GOLD' },
+];
 
 function resolveSlug(): string | null {
   const h = headers();
   return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
 }
 
+function SectionHeading({
+  title,
+  subtitle,
+}: {
+  title: string;
+  subtitle: string;
+}) {
+  return (
+    <div className="mx-auto max-w-3xl text-center">
+      <h2 className="font-heading text-3xl text-[#2b0d4f] sm:text-4xl">{title}</h2>
+      <p className="mt-2 font-body text-sm leading-relaxed text-inkMute sm:text-base">{subtitle}</p>
+    </div>
+  );
+}
+
+function RetailRateStrip({ rates }: { rates: Awaited<ReturnType<typeof fetchPublicRates>> }) {
+  const entries = rates
+    ? [
+        { label: 'Gold 24K', value: rates.GOLD_24K.formattedINR },
+        { label: 'Gold 22K', value: rates.GOLD_22K.formattedINR },
+        { label: 'Silver 999', value: rates.SILVER_999.formattedINR },
+      ]
+    : [
+        { label: 'Gold 24K', value: 'दुकान से पूछें' },
+        { label: 'Gold 22K', value: 'दुकान से पूछें' },
+        { label: 'Silver 999', value: 'दुकान से पूछें' },
+      ];
+
+  return (
+    <section aria-label="आज की दरें" className="bg-white">
+      <div className="mx-auto grid max-w-6xl gap-px border-x border-border bg-border sm:grid-cols-3">
+        {entries.map((entry) => (
+          <div key={entry.label} className="bg-white px-5 py-4 text-center">
+            <p className="font-body text-xs font-semibold uppercase tracking-wide text-[#7d5c25]">{entry.label}</p>
+            <p className="mt-1 font-body text-lg font-bold text-[#2b0d4f]">{entry.value}</p>
+            {rates && <p className="font-body text-xs text-inkMute">प्रति ग्राम</p>}
+          </div>
+        ))}
+      </div>
+    </section>
+  );
+}
+
 export default async function HomePage() {
   const slug = resolveSlug();
 
@@ -31,49 +132,246 @@ export default async function HomePage() {
 
   const [rates, featuredData] = await Promise.all([
     fetchPublicRates(),
-    fetchProducts(config.shopId, { limit: 6 }),
+    fetchProducts(config.shopId, { limit: 12 }),
   ]);
 
   const featured = featuredData?.items ?? [];
-  const total    = featuredData?.total ?? 0;
+  const topProducts = featured.slice(0, 4);
+  const recommended = featured.slice(4, 8);
+  const baseUrl = baseUrlFromHeaders(headers());
+  const homeJsonLd = {
+    '@context': 'https://schema.org',
+    '@type': 'JewelryStore',
+    name: config.appName,
+    url: baseUrl,
+    ...(config.logoUrl?.startsWith('https://') ? { image: config.logoUrl } : {}),
+    ...(tenantAddress(config)
+      ? { address: { '@type': 'PostalAddress', streetAddress: tenantAddress(config) } }
+      : {}),
+    ...(tenantPhone(config) ? { telephone: tenantPhone(config) } : {}),
+    openingHours: 'Mo-Sa 10:00-20:00',
+  };
 
   return (
-    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
-      {/* Hero */}
-      <section aria-labelledby="hero-heading" className="text-center py-8">
-        <h1 id="hero-heading" className="font-heading text-4xl text-ink mb-3">
-          {config.appName}
-        </h1>
-        <p className="font-body text-lg text-inkMute">
-          श्रेष्ठ आभूषण, विश्वसनीय सेवा
-        </p>
-      </section>
+    <div className="bg-[#fbf4e7]">
+      <script
+        type="application/ld+json"
+        dangerouslySetInnerHTML={{ __html: jsonLd(homeJsonLd) }}
+      />
+
+      <section className="bg-white" aria-labelledby="hero-heading">
+        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:py-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
+          <div className="flex flex-col justify-center rounded-[8px] bg-[#fff7ec] p-6 shadow-sm ring-1 ring-[#e7cf9b] sm:min-h-[420px] sm:p-10">
+            <p className="font-body text-[11px] font-bold uppercase tracking-[0.22em] text-[#b57b2c] sm:text-xs sm:tracking-[0.28em]">
+              Gold, Diamond, Silver
+            </p>
+            <h1 id="hero-heading" className="mt-4 font-heading text-4xl leading-tight text-[#2b0d4f] sm:text-6xl">
+              {config.appName}
+            </h1>
+            <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-ink sm:text-lg">
+              शादी, त्योहार और रोजमर्रा के लिए भरोसेमंद आभूषण। शुद्धता, HUID और आज की दरें साफ-साफ देखें।
+            </p>
+            <div className="mt-7 flex flex-wrap gap-3">
+              <a
+                href="/products"
+                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#2b0d4f] px-6 font-body text-sm font-semibold text-white shadow-sm hover:bg-[#3b1768] focus-visible:outline-2 focus-visible:outline-primary"
+              >
+                Shop Collection
+              </a>
+              <a
+                href="/try-at-home"
+                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#2b0d4f] px-6 font-body text-sm font-semibold text-[#2b0d4f] hover:bg-white focus-visible:outline-2 focus-visible:outline-primary"
+              >
+                घर पर ट्राई
+              </a>
+            </div>
+          </div>
 
-      {/* Gold rate card */}
-      <section aria-labelledby="rates-heading">
-        <h2 id="rates-heading" className="sr-only">आज की दरें</h2>
-        <GoldRateCard rates={rates} />
+          <div className="grid grid-cols-2 gap-3 sm:min-h-[420px]">
+            <img
+              src={heroImages[0].src}
+              alt={heroImages[0].alt}
+              className="col-span-2 h-56 w-full rounded-[8px] object-cover shadow-sm lg:h-full"
+            />
+            <img
+              src={heroImages[1].src}
+              alt={heroImages[1].alt}
+              className="h-44 w-full rounded-[8px] object-cover shadow-sm lg:h-full"
+            />
+            <img
+              src={heroImages[2].src}
+              alt={heroImages[2].alt}
+              className="h-44 w-full rounded-[8px] object-cover shadow-sm lg:h-full"
+            />
+          </div>
+        </div>
       </section>
 
-      {/* Featured products */}
-      <section aria-labelledby="featured-heading">
-        <h2 id="featured-heading" className="font-heading text-2xl text-ink mb-4">
-          विशेष आभूषण
-        </h2>
-        <ProductGrid
-          products={featured}
-          emptyMessage="अभी कोई उत्पाद उपलब्ध नहीं है"
+      <RetailRateStrip rates={rates} />
+
+      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="collection-heading">
+        <SectionHeading
+          title="New Arrival"
+          subtitle="दुकान की पसंदीदा श्रेणियां, ताकि ग्राहक सीधे सही डिजाइन तक पहुंचें।"
         />
-        {total > 6 && (
-          <div className="mt-6 text-center">
+        <div id="collection-heading" className="sr-only">New Arrival</div>
+        <div className="mt-8 grid gap-5 md:grid-cols-4">
+          {collectionTiles.map((tile) => (
             <a
-              href="/products"
-              className="inline-block font-body text-primary underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary"
+              key={tile.title}
+              href={tile.href}
+              className="group relative min-h-[260px] overflow-hidden rounded-[8px] bg-[#2b0d4f] text-white shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
             >
-              सभी उत्पाद देखें →
+              <img
+                src={tile.src}
+                alt=""
+                className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
+              />
+              <span className="absolute inset-0 bg-gradient-to-t from-[#21063f]/90 via-[#21063f]/20 to-transparent" />
+              <span className="absolute bottom-0 left-0 right-0 p-5">
+                <span className="block font-heading text-2xl">{tile.title}</span>
+                <span className="mt-1 block font-body text-sm text-white/85">{tile.text}</span>
+              </span>
             </a>
+          ))}
+        </div>
+      </section>
+
+      <section className="bg-white py-10" aria-labelledby="spotlight-heading">
+        <div className="mx-auto max-w-6xl px-4">
+          <SectionHeading
+            title="In Spotlight"
+            subtitle="हाई-Intent ग्राहकों के लिए शादी, गिफ्ट और रोजमर्रा के डिजाइन एक ही जगह।"
+          />
+          <div id="spotlight-heading" className="sr-only">In Spotlight</div>
+          <div className="mt-8 grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
+            <a
+              href="/products?search=wedding"
+              className="relative min-h-[360px] overflow-hidden rounded-[8px] bg-[#2b0d4f] text-white shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
+            >
+              <img
+                src="https://images.unsplash.com/photo-1519657337289-077653f724ed?auto=format&fit=crop&w=1100&q=80"
+                alt=""
+                className="absolute inset-0 h-full w-full object-cover opacity-80"
+              />
+              <span className="absolute inset-0 bg-gradient-to-r from-[#21063f]/85 via-[#21063f]/25 to-transparent" />
+              <span className="absolute bottom-0 left-0 max-w-md p-7">
+                <span className="block font-heading text-4xl">Wedding Edit</span>
+                <span className="mt-2 block font-body text-sm leading-relaxed text-white/90">
+                  हार, ईयररिंग्स और रिंग्स को एक साथ देखें।
+                </span>
+                <span className="mt-5 inline-flex rounded-full bg-[#d7a74d] px-5 py-2 font-body text-sm font-semibold text-[#2b0d4f]">
+                  Explore More
+                </span>
+              </span>
+            </a>
+            <div className="grid gap-5 sm:grid-cols-2">
+              {lovedOnes.map((item) => (
+                <a
+                  key={item.label}
+                  href={item.href}
+                  className="flex min-h-[168px] items-end rounded-[8px] border border-[#e3c680] bg-[#fff7ec] p-5 font-heading text-2xl text-[#2b0d4f] shadow-sm hover:border-[#b57b2c] focus-visible:outline-2 focus-visible:outline-primary"
+                >
+                  {item.label}
+                </a>
+              ))}
+            </div>
+          </div>
+        </div>
+      </section>
+
+      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="top-sellers-heading">
+        <SectionHeading
+          title="Top Sellers"
+          subtitle="लाइव कैटलॉग से उपलब्ध डिजाइन यहां दिखेंगे; अभी ग्राहक श्रेणी देखकर दुकान से उपलब्धता पूछ सकते हैं।"
+        />
+        <div id="top-sellers-heading" className="sr-only">Top Sellers</div>
+        <div className="mt-8">
+          {topProducts.length > 0 ? (
+            <ProductGrid products={topProducts} />
+          ) : (
+            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
+              {collectionTiles.map((tile) => (
+                <a
+                  key={tile.title}
+                  href={tile.href}
+                  className="overflow-hidden rounded-[8px] border border-[#e3c680] bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
+                >
+                  <img src={tile.src} alt="" className="aspect-square w-full object-cover" />
+                  <span className="block p-4">
+                    <span className="block font-body text-sm font-bold text-[#2b0d4f]">{tile.title}</span>
+                    <span className="mt-1 block font-body text-sm text-inkMute">दुकान से उपलब्धता पूछें</span>
+                    <span className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-[#2b0d4f] font-body text-sm font-semibold text-[#2b0d4f]">
+                      View Designs
+                    </span>
+                  </span>
+                </a>
+              ))}
+            </div>
+          )}
+        </div>
+      </section>
+
+      <section className="bg-white py-10" aria-labelledby="everyday-heading">
+        <div className="mx-auto max-w-6xl px-4">
+          <SectionHeading
+            title="Everyday Collection"
+            subtitle="हल्के, पहनने में आसान और गिफ्ट के लिए उपयुक्त आभूषण।"
+          />
+          <div id="everyday-heading" className="sr-only">Everyday Collection</div>
+          <div className="mt-8 grid gap-4 md:grid-cols-3">
+            {everydayCollections.map((item, index) => (
+              <a
+                key={item.title}
+                href={item.href}
+                className="flex min-h-[96px] items-center justify-center rounded-[8px] border border-[#e3c680] bg-[#fbf4e7] px-6 text-center font-body text-sm font-bold uppercase tracking-wide text-[#2b0d4f] shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
+                style={{
+                  background:
+                    index % 2 === 0
+                      ? 'linear-gradient(135deg, #fff7ec 0%, #f5dfab 100%)'
+                      : 'linear-gradient(135deg, #f8eefc 0%, #ead7f6 100%)',
+                }}
+              >
+                {item.title}
+              </a>
+            ))}
+          </div>
+        </div>
+      </section>
+
+      {recommended.length > 0 && (
+        <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="recommended-heading">
+          <SectionHeading
+            title="Recommended for you"
+            subtitle="कैटलॉग में मौजूद अन्य डिजाइन जिन्हें ग्राहक आगे देख सकते हैं।"
+          />
+          <div id="recommended-heading" className="sr-only">Recommended for you</div>
+          <div className="mt-8">
+            <ProductGrid products={recommended} />
+          </div>
+        </section>
+      )}
+
+      <section className="bg-[#fbf0f3] py-10" aria-labelledby="promise-heading">
+        <div className="mx-auto max-w-6xl px-4">
+          <SectionHeading
+            title={`${config.appName} Promise`}
+            subtitle="भरोसे, पारदर्शिता और दुकान की सेवा नीति को ग्राहक खरीदारी से पहले समझ सके।"
+          />
+          <div id="promise-heading" className="sr-only">{config.appName} Promise</div>
+          <div className="mt-8 grid gap-5 md:grid-cols-3">
+            {[
+              ['100% Certified Jewellery', 'BIS/HUID और शुद्धता की साफ जानकारी'],
+              ['Transparent Pricing', 'दर, वजन और मेकिंग चार्ज अलग-अलग'],
+              ['Exchange Support', 'दुकान की वापसी और एक्सचेंज नीति उपलब्ध'],
+            ].map(([title, text]) => (
+              <div key={title} className="min-h-[160px] rounded-[8px] bg-white p-6 text-center shadow-sm">
+                <p className="font-heading text-2xl text-[#2b0d4f]">{title}</p>
+                <p className="mt-3 font-body text-sm leading-relaxed text-inkMute">{text}</p>
+              </div>
+            ))}
           </div>
-        )}
+        </div>
       </section>
     </div>
   );
diff --git a/apps/customer-web/app/products/[id]/page.tsx b/apps/customer-web/app/products/[id]/page.tsx
index 7944d93..30da9b7 100644
--- a/apps/customer-web/app/products/[id]/page.tsx
+++ b/apps/customer-web/app/products/[id]/page.tsx
@@ -1,12 +1,29 @@
 import { notFound } from 'next/navigation';
 import { headers } from 'next/headers';
-import { fetchTenantConfig, fetchProduct, fetchProductReviews, fetchProductImages } from '@/lib/api';
+import {
+  fetchTenantConfig,
+  fetchProduct,
+  fetchProductReviews,
+  fetchProductImages,
+  fetchProducts,
+} from '@/lib/api';
 import { HuidBadge } from '@/components/HuidBadge';
 import { WishlistButton } from '@/components/WishlistButton';
 import { ReviewSection } from '@/components/ReviewSection';
 import { PriceBreakdown } from '@/components/PriceBreakdown';
 import { ProductGallery } from '@/components/products/ProductGallery';
-import { purityLabel, metalLabel } from '@/lib/theme';
+import { ProductGrid } from '@/components/ProductGrid';
+import { EmiCalculatorTile } from '@/components/EmiCalculatorTile';
+import { ProductShareActions } from '@/components/ProductShareActions';
+import {
+  baseUrlFromHeaders,
+  jsonLd,
+  productDisplayName,
+  productMaterial,
+  productTotalPaise,
+  recommendedProducts,
+} from '@/lib/storefront';
+import { metalLabel } from '@/lib/theme';
 
 function resolveSlug(): string | null {
   const h = headers();
@@ -24,30 +41,72 @@ export default async function ProductDetailPage({ params }: PageProps) {
   const config = await fetchTenantConfig(slug);
   if (!config) notFound();
 
-  const [product, reviewsData, images] = await Promise.all([
-    fetchProduct(params.id, config.shopId),
+  const product = await fetchProduct(params.id, config.shopId);
+  if (!product) notFound();
+
+  const [reviewsData, images, relatedData] = await Promise.all([
     fetchProductReviews(params.id, config.shopId),
     fetchProductImages(params.id, config.shopId),
+    fetchProducts(config.shopId, {
+      categoryId: product.categoryId ?? undefined,
+      limit: 24,
+    }),
   ]);
-  if (!product) notFound();
 
   const isUnavailable = product.quantity === 0;
-  const displayPurity = purityLabel(product.purity);
-  const displayMetal  = metalLabel(product.metal);
+  const displayName = productDisplayName(product);
+  const displayMetal = metalLabel(product.metal);
+  const totalPaise = productTotalPaise(product);
+  const baseUrl = baseUrlFromHeaders(headers());
+  const productUrl = `${baseUrl}/products/${product.id}`;
+  const relatedProducts = recommendedProducts(product, relatedData?.items ?? []);
+  const productJsonLd = {
+    '@context': 'https://schema.org',
+    '@type': 'Product',
+    name: displayName,
+    sku: product.sku,
+    brand: { '@type': 'Brand', name: config.appName },
+    material: productMaterial(product),
+    ...(images.length > 0 ? { image: images.map((image) => image.default_url) } : {}),
+    ...(totalPaise !== null
+      ? {
+          offers: {
+            '@type': 'Offer',
+            priceCurrency: 'INR',
+            price: (totalPaise / 100).toFixed(2),
+            availability: isUnavailable
+              ? 'https://schema.org/OutOfStock'
+              : 'https://schema.org/InStock',
+            url: productUrl,
+          },
+        }
+      : {}),
+    ...(reviewsData.total > 0 && reviewsData.averageRating !== null
+      ? {
+          aggregateRating: {
+            '@type': 'AggregateRating',
+            ratingValue: reviewsData.averageRating,
+            reviewCount: reviewsData.total,
+          },
+        }
+      : {}),
+  };
 
   return (
-    <div className="max-w-4xl mx-auto px-4 py-8">
-      {/* Back link */}
+    <div className="mx-auto max-w-6xl px-4 py-8">
+      <script
+        type="application/ld+json"
+        dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd) }}
+      />
       <a
         href="/products"
-        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
+        className="mb-6 inline-block font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
         aria-label="सभी उत्पाद सूची पर वापस जाएं"
       >
-        ← उत्पाद देखें
+        उत्पाद देखें
       </a>
 
-      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
-        {/* Product image — responsive preload for LCP hero */}
+      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
         {images.length > 0 && (
           <link
             rel="preload"
@@ -58,44 +117,42 @@ export default async function ProductDetailPage({ params }: PageProps) {
             href={images[0]!.default_url}
           />
         )}
-        <div className="relative rounded-lg overflow-hidden border border-border bg-bg">
-          <ProductGallery images={images} productName={displayPurity} />
+        <div className="relative overflow-hidden rounded-lg border border-border bg-bg">
+          <ProductGallery images={images} productName={displayName} />
           {isUnavailable && (
             <div
-              className="absolute inset-0 flex items-center justify-center bg-ink/40 pointer-events-none"
+              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40"
               aria-hidden="true"
             >
-              <span className="font-body text-white text-lg font-medium">उपलब्ध नहीं</span>
+              <span className="font-body text-lg font-medium text-white">उपलब्ध नहीं</span>
             </div>
           )}
         </div>
 
-        {/* Product details */}
         <div className="flex flex-col gap-5" aria-label="उत्पाद विवरण">
           <div>
-            <h1 className="font-heading text-3xl text-ink">{displayPurity}</h1>
-            <p className="font-body text-sm text-inkMute mt-1">
+            <h1 className="font-heading text-3xl text-ink">{displayName}</h1>
+            <p className="mt-1 font-body text-sm text-inkMute">
               {displayMetal} · SKU: {product.sku}
             </p>
             {product.categoryName && (
-              <p className="font-body text-xs text-inkMute mt-0.5">{product.categoryName}</p>
+              <p className="mt-0.5 font-body text-xs text-inkMute">{product.categoryName}</p>
             )}
           </div>
 
-          {/* HUID badge */}
           <div className="flex flex-wrap gap-2">
             <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
             {product.huid && (
               <span
-                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-body text-green-700 border border-green-200"
+                className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 font-body text-xs text-green-700"
                 aria-label="BIS प्रमाणित हॉलमार्क आभूषण"
               >
-                BIS प्रमाणित ✓
+                BIS प्रमाणित
               </span>
             )}
             {isUnavailable && (
               <span
-                className="inline-block rounded-full bg-error/10 px-2 py-0.5 text-xs font-body text-error border border-error/30"
+                className="inline-block rounded-full border border-error/30 bg-error/10 px-2 py-0.5 font-body text-xs text-error"
                 role="status"
                 aria-label="यह उत्पाद अभी उपलब्ध नहीं है"
               >
@@ -104,10 +161,9 @@ export default async function ProductDetailPage({ params }: PageProps) {
             )}
           </div>
 
-          {/* Average rating summary */}
           {reviewsData.total > 0 && reviewsData.averageRating !== null && (
             <div className="flex items-center gap-2">
-              <span className="text-yellow-500 text-lg" aria-hidden="true">
+              <span className="text-lg text-yellow-500" aria-hidden="true">
                 {'★'.repeat(Math.round(reviewsData.averageRating))}
                 {'☆'.repeat(5 - Math.round(reviewsData.averageRating))}
               </span>
@@ -117,53 +173,51 @@ export default async function ProductDetailPage({ params }: PageProps) {
             </div>
           )}
 
-          {/* Weight details */}
           <dl className="grid grid-cols-2 gap-2 font-body text-sm">
             <div>
-              <dt className="text-inkMute">कुल वज़न</dt>
-              <dd className="text-ink font-medium">{product.grossWeightG} ग्राम</dd>
+              <dt className="text-inkMute">कुल वजन</dt>
+              <dd className="font-medium text-ink">{product.grossWeightG} ग्राम</dd>
             </div>
             <div>
-              <dt className="text-inkMute">शुद्ध वज़न</dt>
-              <dd className="text-ink font-medium">{product.netWeightG} ग्राम</dd>
+              <dt className="text-inkMute">शुद्ध वजन</dt>
+              <dd className="font-medium text-ink">{product.netWeightG} ग्राम</dd>
             </div>
           </dl>
 
-          {/* Full price breakdown */}
           {product.priceAvailable && product.estimatedPrice ? (
             <PriceBreakdown price={product.estimatedPrice} />
           ) : (
-            <p className="font-body text-sm text-inkMute border border-border rounded-lg p-4">
+            <p className="rounded-lg border border-border p-4 font-body text-sm text-inkMute">
               मूल्य के लिए कृपया दुकान पर संपर्क करें।
             </p>
           )}
 
-          {/* Action CTAs */}
+          {totalPaise !== null && <EmiCalculatorTile totalPaise={totalPaise} />}
+
           {!isUnavailable && (
             <div className="flex flex-col gap-3 border-t border-border pt-4">
-              <WishlistButton productId={product.id} productName={displayPurity} />
+              <WishlistButton productId={product.id} productName={displayName} />
 
-              {/* Try at Home CTA */}
               <a
                 href={`/try-at-home?product=${product.id}`}
-                className="w-full rounded-md border border-primary bg-primary/5 px-6 py-3 font-body text-primary text-center hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
-                aria-label={`${displayPurity} — घर पर कोशिश करने की जानकारी`}
+                className="w-full rounded-md border border-primary bg-primary/5 px-6 py-3 text-center font-body text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
+                aria-label={`${displayName} घर पर ट्राई करने की जानकारी`}
               >
-                🏠 कोशिश घर पर करें
+                घर पर ट्राई करें
               </a>
 
-              {/* Rate Lock CTA */}
               <a
                 href={`/rate-lock?product=${product.id}`}
-                className="w-full rounded-md border border-border bg-white px-6 py-3 font-body text-ink text-center hover:bg-border/30 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
-                aria-label={`${displayPurity} — आज का मूल्य लॉक करें`}
+                className="w-full rounded-md border border-border bg-white px-6 py-3 text-center font-body text-ink transition-colors hover:bg-border/30 focus-visible:outline-2 focus-visible:outline-primary"
+                aria-label={`${displayName} आज का मूल्य लॉक करें`}
               >
-                🔒 दर-लॉक बुकिंग करें
+                आज की दर लॉक करें
               </a>
             </div>
           )}
 
-          {/* Price disclaimer */}
+          <ProductShareActions productName={displayName} productUrl={productUrl} />
+
           {product.priceAvailable && (
             <p className="font-body text-xs text-inkMute" role="note">
               * यह अनुमानित मूल्य है। अंतिम मूल्य की पुष्टि दुकान पर करें।
@@ -172,7 +226,15 @@ export default async function ProductDetailPage({ params }: PageProps) {
         </div>
       </div>
 
-      {/* Reviews */}
+      {relatedProducts.length > 0 && (
+        <section aria-labelledby="recommended-heading" className="mt-10">
+          <h2 id="recommended-heading" className="mb-4 font-heading text-2xl text-ink">
+            आपके लिए सुझाव
+          </h2>
+          <ProductGrid products={relatedProducts} />
+        </section>
+      )}
+
       <ReviewSection
         productId={product.id}
         shopId={config.shopId}
diff --git a/apps/customer-web/app/products/page.tsx b/apps/customer-web/app/products/page.tsx
index d70958d..256bad1 100644
--- a/apps/customer-web/app/products/page.tsx
+++ b/apps/customer-web/app/products/page.tsx
@@ -1,8 +1,21 @@
 import { headers } from 'next/headers';
 import { fetchTenantConfig, fetchProducts } from '@/lib/api';
 import { ProductGrid } from '@/components/ProductGrid';
-import { CategorySidebar } from '@/components/CategorySidebar';
-import { MetalFilterChips } from '@/components/browse/MetalFilterChips';
+import {
+  PRICE_BANDS,
+  PURITY_FILTERS,
+  applyCatalogFilters,
+} from '@/lib/storefront';
+import { metalLabel, purityLabel } from '@/lib/theme';
+
+const PAGE_SIZE = 12;
+const FILTER_FETCH_LIMIT = 120;
+
+const METAL_FILTERS = [
+  { value: '', label: 'सभी' },
+  { value: 'GOLD', label: 'सोना' },
+  { value: 'SILVER', label: 'चांदी' },
+] as const;
 
 function resolveSlug(): string | null {
   const h = headers();
@@ -11,136 +24,240 @@ function resolveSlug(): string | null {
 
 interface PageProps {
   searchParams: {
-    page?:       string;
-    search?:     string;
-    metal?:      string;
-    categoryId?: string;
+    page?:        string;
+    search?:      string;
+    metal?:       string;
+    purity?:      string;
+    price?:       string;
+    inStockOnly?: string;
+    categoryId?:  string;
   };
 }
 
 export default async function ProductsPage({ searchParams }: PageProps) {
   const slug = resolveSlug();
   if (!slug) {
-    return <p className="p-8 font-body text-inkMute text-center">दुकान नहीं मिली।</p>;
+    return <p className="p-8 text-center font-body text-inkMute">दुकान नहीं मिली।</p>;
   }
 
   const config = await fetchTenantConfig(slug);
   if (!config) {
-    return <p className="p-8 font-body text-inkMute text-center">दुकान उपलब्ध नहीं है।</p>;
+    return <p className="p-8 text-center font-body text-inkMute">दुकान उपलब्ध नहीं है।</p>;
   }
 
-  const page       = Math.max(1, parseInt(searchParams.page ?? '1', 10));
-  const search     = searchParams.search?.trim();
-  const metal      = searchParams.metal;
+  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10));
+  const search = searchParams.search?.trim() || undefined;
+  const metal = searchParams.metal || undefined;
+  const purity = searchParams.purity || undefined;
+  const price = searchParams.price || undefined;
+  const inStockOnly = searchParams.inStockOnly === 'true';
   const categoryId = searchParams.categoryId;
 
   const productsData = await fetchProducts(config.shopId, {
     categoryId,
     search,
-    page,
-    limit: 12,
+    limit: FILTER_FETCH_LIMIT,
   });
 
-  const items    = productsData?.items ?? [];
-  const total    = productsData?.total ?? 0;
-  const lastPage = Math.max(1, Math.ceil(total / 12));
+  const filteredItems = applyCatalogFilters(productsData?.items ?? [], {
+    metal,
+    purity,
+    price,
+    inStockOnly,
+  });
+  const total = filteredItems.length;
+  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
+  const currentPage = Math.min(page, lastPage);
+  const items = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
 
-  function buildHref(overrides: { page?: number; search?: string; metal?: string }) {
+  function buildHref(
+    overrides: Partial<{
+      page: number;
+      search: string | null;
+      metal: string | null;
+      purity: string | null;
+      price: string | null;
+      inStockOnly: boolean | null;
+    }> = {},
+  ) {
     const params = new URLSearchParams();
-    const p = overrides.page ?? page;
-    const s = overrides.search ?? search;
-    const m = overrides.metal ?? metal;
-    if (p > 1) params.set('page', String(p));
-    if (s)     params.set('search', s);
-    if (m)     params.set('metal', m);
+    const nextPage = overrides.page ?? 1;
+    const nextSearch = overrides.search !== undefined ? overrides.search : search;
+    const nextMetal = overrides.metal !== undefined ? overrides.metal : metal;
+    const nextPurity = overrides.purity !== undefined ? overrides.purity : purity;
+    const nextPrice = overrides.price !== undefined ? overrides.price : price;
+    const nextInStock =
+      overrides.inStockOnly !== undefined ? overrides.inStockOnly : inStockOnly;
+
+    if (nextPage > 1) params.set('page', String(nextPage));
+    if (nextSearch) params.set('search', nextSearch);
+    if (nextMetal) params.set('metal', nextMetal);
+    if (nextPurity) params.set('purity', nextPurity);
+    if (nextPrice) params.set('price', nextPrice);
+    if (nextInStock) params.set('inStockOnly', 'true');
+    if (categoryId) params.set('categoryId', categoryId);
+
     const qs = params.toString();
     return `/products${qs ? `?${qs}` : ''}`;
   }
 
-  const chipExtras: Record<string, string> = {};
-  if (search) chipExtras['search'] = search;
+  const activeFilters = [
+    metal ? { label: metalLabel(metal), href: buildHref({ metal: null }) } : null,
+    purity ? { label: purityLabel(purity), href: buildHref({ purity: null }) } : null,
+    price
+      ? {
+          label: PRICE_BANDS.find((band) => band.value === price)?.label ?? price,
+          href: buildHref({ price: null }),
+        }
+      : null,
+    inStockOnly ? { label: 'सिर्फ उपलब्ध', href: buildHref({ inStockOnly: null }) } : null,
+  ].filter((item): item is { label: string; href: string } => Boolean(item));
 
   return (
-    <div className="max-w-6xl mx-auto px-4 py-8">
-      <h1 className="font-heading text-3xl text-ink mb-4">आभूषण संग्रह</h1>
+    <div className="mx-auto max-w-6xl px-4 py-8">
+      <h1 className="mb-4 font-heading text-3xl text-ink">आभूषण संग्रह</h1>
 
-      {/* Mobile horizontal metal filter chips */}
-      <div className="mb-4">
-        <MetalFilterChips selected={metal ?? ''} baseHref="/products" extraParams={chipExtras} />
-      </div>
+      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
+        <aside
+          className="rounded-lg border border-border bg-white p-4"
+          aria-label="उत्पाद फिल्टर"
+        >
+          <h2 className="font-body text-sm font-semibold text-ink">फिल्टर</h2>
 
-      <div className="flex gap-6">
-        {/* Sidebar — desktop only */}
-        <aside className="hidden md:block w-40 shrink-0" aria-label="फ़िल्टर">
-          <CategorySidebar selectedMetal={metal ?? ''} baseHref="/products" />
+          <div className="mt-4 flex flex-col gap-5">
+            <FilterGroup label="धातु">
+              {METAL_FILTERS.map((filter) => (
+                <FilterChip
+                  key={filter.value || 'all'}
+                  href={buildHref({ metal: filter.value || null })}
+                  isActive={(metal ?? '') === filter.value}
+                  label={filter.label}
+                />
+              ))}
+            </FilterGroup>
+
+            <FilterGroup label="शुद्धता">
+              <FilterChip href={buildHref({ purity: null })} isActive={!purity} label="सभी" />
+              {PURITY_FILTERS.map((filter) => (
+                <FilterChip
+                  key={filter.value}
+                  href={buildHref({ purity: filter.value })}
+                  isActive={purity === filter.value}
+                  label={filter.label}
+                />
+              ))}
+            </FilterGroup>
+
+            <FilterGroup label="मूल्य">
+              <FilterChip href={buildHref({ price: null })} isActive={!price} label="सभी" />
+              {PRICE_BANDS.map((band) => (
+                <FilterChip
+                  key={band.value}
+                  href={buildHref({ price: band.value })}
+                  isActive={price === band.value}
+                  label={band.label}
+                />
+              ))}
+            </FilterGroup>
+
+            <a
+              href={buildHref({ inStockOnly: inStockOnly ? null : true })}
+              className={`inline-flex min-h-[44px] items-center justify-center rounded-md border px-3 py-2 text-center font-body text-sm focus-visible:outline-2 focus-visible:outline-primary ${
+                inStockOnly
+                  ? 'border-primary bg-primary text-white'
+                  : 'border-border bg-bg text-ink hover:border-primary'
+              }`}
+              aria-pressed={inStockOnly}
+            >
+              सिर्फ उपलब्ध उत्पाद
+            </a>
+          </div>
         </aside>
 
-        {/* Main content */}
-        <div className="flex-1 flex flex-col gap-4">
-          {/* Search form */}
-          <form role="search" aria-label="उत्पाद खोजें" method="get" action="/products" className="flex gap-2">
+        <div className="flex flex-col gap-4">
+          <form
+            role="search"
+            aria-label="उत्पाद खोजें"
+            method="get"
+            action="/products"
+            className="flex gap-2"
+          >
             {metal && <input type="hidden" name="metal" value={metal} />}
-            <label htmlFor="product-search" className="sr-only">उत्पाद खोज</label>
+            {purity && <input type="hidden" name="purity" value={purity} />}
+            {price && <input type="hidden" name="price" value={price} />}
+            {inStockOnly && <input type="hidden" name="inStockOnly" value="true" />}
+            {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
+            <label htmlFor="product-search" className="sr-only">
+              उत्पाद खोज
+            </label>
             <input
               id="product-search"
               type="search"
               name="search"
               defaultValue={search}
               placeholder="SKU, धातु, शुद्धता खोजें..."
-              className="flex-1 rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink placeholder:text-inkMute focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
+              className="min-h-[44px] flex-1 rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink placeholder:text-inkMute focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
             />
             <button
               type="submit"
-              className="rounded-md bg-primary px-4 py-2 font-body text-sm text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
+              className="min-h-[44px] rounded-md bg-primary px-4 py-2 font-body text-sm text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
             >
               खोजें
             </button>
           </form>
 
-          {/* Active filter pill */}
-          {metal && (
-            <div className="flex items-center gap-2 flex-wrap">
-              <span className="font-body text-xs text-inkMute">फ़िल्टर:</span>
+          {activeFilters.length > 0 && (
+            <div className="flex flex-wrap items-center gap-2">
+              <span className="font-body text-xs text-inkMute">लगे हुए फिल्टर:</span>
+              {activeFilters.map((filter) => (
+                <a
+                  key={filter.label}
+                  href={filter.href}
+                  className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-body text-xs text-primary hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
+                >
+                  {filter.label}
+                  <span aria-hidden="true">x</span>
+                </a>
+              ))}
               <a
-                href={buildHref({ metal: '' })}
-                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary font-body text-xs px-3 py-1 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
-                aria-label={`${metal === 'GOLD' ? 'सोना' : metal === 'SILVER' ? 'चाँदी' : metal} फ़िल्टर हटाएं`}
+                href="/products"
+                className="font-body text-xs text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
               >
-                {metal === 'GOLD' ? 'सोना' : metal === 'SILVER' ? 'चाँदी' : metal}
-                <span aria-hidden="true"> ×</span>
+                सभी हटाएं
               </a>
             </div>
           )}
 
-          {/* Result count */}
           <p className="font-body text-xs text-inkMute" aria-live="polite" aria-atomic="true">
             {total} उत्पाद मिले
           </p>
 
           <ProductGrid products={items} />
 
-          {/* Pagination — "Show more" style (simpler for senior UX) */}
           {lastPage > 1 && (
-            <nav aria-label="पृष्ठ नेवीगेशन" className="flex justify-center items-center gap-4 mt-4">
-              {page > 1 && (
+            <nav
+              aria-label="पृष्ठ नेवीगेशन"
+              className="mt-4 flex items-center justify-center gap-4"
+            >
+              {currentPage > 1 && (
                 <a
-                  href={buildHref({ page: page - 1 })}
+                  href={buildHref({ page: currentPage - 1 })}
                   className="font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                   aria-label="पिछला पृष्ठ"
                 >
-                  ← पिछला
+                  पिछला
                 </a>
               )}
               <span className="font-body text-sm text-inkMute" aria-current="page">
-                {page} / {lastPage}
+                {currentPage} / {lastPage}
               </span>
-              {page < lastPage && (
+              {currentPage < lastPage && (
                 <a
-                  href={buildHref({ page: page + 1 })}
-                  className="rounded-md bg-primary/10 text-primary font-body text-sm px-5 py-2 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
+                  href={buildHref({ page: currentPage + 1 })}
+                  className="rounded-md bg-primary/10 px-5 py-2 font-body text-sm text-primary hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
                   aria-label="और उत्पाद देखें"
                 >
-                  और देखें →
+                  और देखें
                 </a>
               )}
             </nav>
@@ -150,3 +267,36 @@ export default async function ProductsPage({ searchParams }: PageProps) {
     </div>
   );
 }
+
+function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
+  return (
+    <section aria-label={label}>
+      <h3 className="mb-2 font-body text-xs font-semibold uppercase text-inkMute">{label}</h3>
+      <div className="flex flex-wrap gap-2">{children}</div>
+    </section>
+  );
+}
+
+function FilterChip({
+  href,
+  isActive,
+  label,
+}: {
+  href: string;
+  isActive: boolean;
+  label: string;
+}) {
+  return (
+    <a
+      href={href}
+      className={`inline-flex min-h-[36px] items-center rounded-full border px-3 py-1 font-body text-sm focus-visible:outline-2 focus-visible:outline-primary ${
+        isActive
+          ? 'border-primary bg-primary text-white'
+          : 'border-border bg-bg text-ink hover:border-primary'
+      }`}
+      aria-current={isActive ? 'page' : undefined}
+    >
+      {label}
+    </a>
+  );
+}
diff --git a/apps/customer-web/app/return-policy/page.tsx b/apps/customer-web/app/return-policy/page.tsx
index dcd1829..0a294a5 100644
--- a/apps/customer-web/app/return-policy/page.tsx
+++ b/apps/customer-web/app/return-policy/page.tsx
@@ -17,27 +17,28 @@ export default async function ReturnPolicyPage() {
   const policyText = await fetchReturnPolicy(config.shopId);
 
   return (
-    <div className="max-w-3xl mx-auto px-4 py-8">
+    <div className="mx-auto max-w-3xl px-4 py-8">
       <a
         href="/products"
-        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
+        className="mb-6 inline-block font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
       >
-        ← उत्पाद देखें
+        उत्पाद देखें
       </a>
 
-      <h1 className="font-heading text-3xl text-ink mb-6">वापसी और आदान-प्रदान नीति</h1>
+      <h1 className="mb-6 font-heading text-3xl text-ink">वापसी और आदान-प्रदान नीति</h1>
 
-      {policyText ? (
-        <div className="bg-white rounded-lg border border-border p-6">
-          <p className="font-body text-base text-ink leading-relaxed whitespace-pre-wrap">{policyText}</p>
-        </div>
-      ) : (
-        <div className="bg-white rounded-lg border border-border p-6">
-          <p className="font-body text-base text-inkMute">
-            इस दुकान की वापसी नीति अभी उपलब्ध नहीं है। अधिक जानकारी के लिए दुकान पर संपर्क करें।
+      <div className="rounded-lg border border-border bg-white p-6">
+        {policyText ? (
+          <p className="whitespace-pre-wrap font-body text-base leading-relaxed text-ink">
+            {policyText}
           </p>
-        </div>
-      )}
+        ) : (
+          <p className="font-body text-base leading-relaxed text-inkMute">
+            इस दुकान की वापसी नीति अभी उपलब्ध नहीं है। अधिक जानकारी के लिए दुकान पर संपर्क
+            करें।
+          </p>
+        )}
+      </div>
     </div>
   );
 }
diff --git a/apps/customer-web/lib/api.ts b/apps/customer-web/lib/api.ts
index 633e100..6bfaed6 100644
--- a/apps/customer-web/lib/api.ts
+++ b/apps/customer-web/lib/api.ts
@@ -2,11 +2,35 @@
 // Types are defined inline (not imported from API package — avoids circular dep).
 
 export interface TenantConfigResponse {
-  shopId:          string;
-  primaryColor:    string;
-  logoUrl:         string | null;
-  appName:         string;
-  defaultLanguage: string;
+  shopId:                 string;
+  primaryColor:           string;
+  logoUrl:                string | null;
+  appName:                string;
+  defaultLanguage:        string;
+  domain?:                string | null;
+  address?:               string | null;
+  shopAddress?:           string | null;
+  contactPhone?:          string | null;
+  contactWhatsApp?:       string | null;
+  whatsappNumber?:        string | null;
+  instagramUrl?:          string | null;
+  facebookUrl?:           string | null;
+  youtubeUrl?:            string | null;
+  appDownloadUrl?:        string | null;
+  shippingPolicyText?:    string | null;
+  cancellationPolicyText?: string | null;
+  faqMarkdown?:           string | null;
+  'shop_address'?:        string | null;
+  'contact_phone'?:       string | null;
+  'contact_whatsapp'?:    string | null;
+  'whatsapp_number'?:     string | null;
+  'instagram_url'?:       string | null;
+  'facebook_url'?:        string | null;
+  'youtube_url'?:         string | null;
+  'app_download_url'?:    string | null;
+  'shipping_policy_text'?: string | null;
+  'cancellation_policy_text'?: string | null;
+  'faq_markdown'?:        string | null;
 }
 
 export interface EstimatedPrice {
@@ -58,7 +82,7 @@ export interface PublicRatesResponse {
   refreshedAt: string;
 }
 
-const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';
+const API_URL = process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_BASE'] ?? 'http://localhost:3001';
 
 export async function fetchTenantConfig(slug: string): Promise<TenantConfigResponse | null> {
   try {
@@ -87,13 +111,24 @@ export async function fetchPublicRates(): Promise<PublicRatesResponse | null> {
 
 export async function fetchProducts(
   shopId: string,
-  params: { categoryId?: string; search?: string; page?: number; limit?: number } = {},
+  params: {
+    categoryId?: string;
+    search?: string;
+    page?: number;
+    limit?: number;
+    metal?: string;
+    purity?: string;
+    inStockOnly?: boolean;
+  } = {},
 ): Promise<CatalogProductsResponse | null> {
   const qs = new URLSearchParams();
   if (params.categoryId) qs.set('categoryId', params.categoryId);
   if (params.search)     qs.set('search', params.search);
   if (params.page)       qs.set('page', String(params.page));
   if (params.limit)      qs.set('limit', String(params.limit));
+  if (params.metal)      qs.set('metal', params.metal);
+  if (params.purity)     qs.set('purity', params.purity);
+  if (params.inStockOnly) qs.set('inStockOnly', 'true');
 
   try {
     const res = await fetch(`${API_URL}/api/v1/catalog/products?${qs.toString()}`, {
diff --git a/apps/customer-web/middleware.ts b/apps/customer-web/middleware.ts
index 388d79a..d0daaff 100644
--- a/apps/customer-web/middleware.ts
+++ b/apps/customer-web/middleware.ts
@@ -1,8 +1,13 @@
 import { NextRequest, NextResponse } from 'next/server';
+import { resolveShopSlug } from './lib/tenant-slug';
 
 export function middleware(req: NextRequest): NextResponse {
   const reqHeaders = new Headers(req.headers);
   reqHeaders.set('x-pathname', req.nextUrl.pathname);
+
+  const shopSlug = resolveShopSlug(req.headers);
+  if (shopSlug) reqHeaders.set('x-shop-slug', shopSlug);
+
   return NextResponse.next({ request: { headers: reqHeaders } });
 }
 
diff --git a/apps/customer-web/package.json b/apps/customer-web/package.json
index f2bc31f..354cd67 100644
--- a/apps/customer-web/package.json
+++ b/apps/customer-web/package.json
@@ -5,6 +5,7 @@
   "scripts": {
     "dev": "next dev --port 3000",
     "build": "next build",
+    "test:unit": "vitest run lib/tenant-slug.test.ts",
     "start": "next start",
     "typecheck": "tsc --noEmit",
     "lint": "next lint"
diff --git a/apps/shopkeeper/.env.example b/apps/shopkeeper/.env.example
index 86aadf2..2fb8be6 100644
--- a/apps/shopkeeper/.env.example
+++ b/apps/shopkeeper/.env.example
@@ -1,7 +1,7 @@
 EXPO_PUBLIC_APP_NAME=अयोध्या स्वर्णकार
 # Android emulator: use 10.0.2.2 (maps to host machine localhost)
 # iOS simulator: localhost works fine
-# Physical device: use your machine's LAN IP (e.g. http://192.168.1.x:3000)
-EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
+# Physical device: use your machine's LAN IP (e.g. http://192.168.1.x:3001)
+EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001
 EXPO_PUBLIC_TENANT_SLUG=anchor-dev
 EXPO_PUBLIC_FIREBASE_PROJECT_ID=goldsmith-dev
diff --git a/apps/shopkeeper/.gitignore b/apps/shopkeeper/.gitignore
index ccb8190..2712ecc 100644
--- a/apps/shopkeeper/.gitignore
+++ b/apps/shopkeeper/.gitignore
@@ -12,3 +12,9 @@ google-services.json
 GoogleService-Info.plist
 ios/
 android/
+
+# @generated expo-cli sync-2b81b286409207a5da26e14c78851eb30d8ccbdb
+# The following patterns were generated by expo-cli
+
+expo-env.d.ts
+# @end expo-cli
\ No newline at end of file
diff --git a/apps/shopkeeper/app.config.ts b/apps/shopkeeper/app.config.ts
index 365fa9e..2953f1e 100644
--- a/apps/shopkeeper/app.config.ts
+++ b/apps/shopkeeper/app.config.ts
@@ -13,6 +13,7 @@ const config: ExpoConfig = {
   plugins: [
     '@react-native-firebase/app',
     '@react-native-firebase/auth',
+    './plugins/with-pnpm-gradle-plugin-paths',
     'expo-dev-client',
     'expo-font',
     'expo-router',
@@ -27,7 +28,7 @@ const config: ExpoConfig = {
     supportsTablet: false,
   },
   extra: {
-    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3000',
+    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3001',
     tenantSlug: process.env['EXPO_PUBLIC_TENANT_SLUG'] ?? 'anchor-dev',
     firebaseProjectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'goldsmith-dev',
     router: { origin: false },
diff --git a/apps/shopkeeper/app/(auth)/phone.tsx b/apps/shopkeeper/app/(auth)/phone.tsx
index 84b5128..c435978 100644
--- a/apps/shopkeeper/app/(auth)/phone.tsx
+++ b/apps/shopkeeper/app/(auth)/phone.tsx
@@ -10,6 +10,17 @@ import { useTenantStore } from '../../src/stores/tenantStore';
 
 const PHONE_RE = /^\d{10}$/;
 
+function normalizeIndianPhoneInput(value: string): string {
+  const digits = value.replace(/\D/g, '');
+  const withoutCountryCode = digits.length > 10 && digits.startsWith('91')
+    ? digits.slice(2)
+    : digits;
+  const withoutTrunkPrefix = withoutCountryCode.length > 10 && withoutCountryCode.startsWith('0')
+    ? withoutCountryCode.slice(1)
+    : withoutCountryCode;
+  return withoutTrunkPrefix.slice(0, 10);
+}
+
 export default function PhoneScreen(): React.ReactElement {
   const [phone, setPhone] = useState('');
   const [loading, setLoading] = useState(false);
@@ -25,11 +36,12 @@ export default function PhoneScreen(): React.ReactElement {
     setErrorMsg(null);
     setLoading(true);
     try {
+      const phoneE164 = '+91' + phone;
       // sendOtp normalises to E.164 internally but we also store E.164 for resend
-      const confirmation = await sendOtp('+91' + phone);
+      const confirmation = await sendOtp(phoneE164);
       setConfirmation(
         confirmation as Parameters<typeof setConfirmation>[0],
-        '+91' + phone,
+        phoneE164,
       );
       router.push('/(auth)/otp');
     } catch (e) {
@@ -125,8 +137,7 @@ export default function PhoneScreen(): React.ReactElement {
           <Input
             value={phone}
             onChangeText={(v) => {
-              // allow only digits
-              setPhone(v.replace(/\D/g, '').slice(0, 10));
+              setPhone(normalizeIndianPhoneInput(v));
             }}
             placeholder={t('auth.phone.placeholder')}
             keyboardType="phone-pad"
diff --git a/apps/shopkeeper/app/(tabs)/_layout.tsx b/apps/shopkeeper/app/(tabs)/_layout.tsx
index 81a02cf..42a920a 100644
--- a/apps/shopkeeper/app/(tabs)/_layout.tsx
+++ b/apps/shopkeeper/app/(tabs)/_layout.tsx
@@ -1,8 +1,8 @@
 import React from 'react';
 import { Tabs } from 'expo-router';
 import { Ionicons } from '@expo/vector-icons';
-import { useAuthStore } from '../../src/stores/authStore';
 import { colors } from '@goldsmith/ui-tokens';
+import { useAuthStore } from '../../src/stores/authStore';
 
 type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
 
@@ -21,7 +21,7 @@ function TabIcon({
 export default function TabsLayout(): JSX.Element {
   const role = useAuthStore((s) => s.user?.role);
 
-  // If role is not yet loaded, fail open (show all tabs); route guards protect actual screens.
+  // If role is not yet loaded, fail open; route guards protect actual screens.
   const isStaff = role === 'shop_staff';
 
   return (
@@ -44,7 +44,7 @@ export default function TabsLayout(): JSX.Element {
       <Tabs.Screen
         name="inventory"
         options={{
-          title: 'इन्वेंटरी',
+          title: 'इन्वेंट्री',
           tabBarIcon: ({ color, size }: { color: string; size: number }) => (
             <TabIcon name="cube-outline" color={color} size={size} />
           ),
@@ -63,7 +63,6 @@ export default function TabsLayout(): JSX.Element {
         name="reports"
         options={{
           title: 'रिपोर्ट',
-          // href: null removes the tab from the tab bar without removing the route
           href: isStaff ? null : undefined,
           tabBarIcon: ({ color, size }: { color: string; size: number }) => (
             <TabIcon name="bar-chart-outline" color={color} size={size} />
@@ -79,16 +78,6 @@ export default function TabsLayout(): JSX.Element {
           ),
         }}
       />
-      <Tabs.Screen
-        name="settings"
-        options={{
-          title: 'सेटिंग्स',
-          href: isStaff ? null : undefined,
-          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
-            <TabIcon name="settings-outline" color={color} size={size} />
-          ),
-        }}
-      />
     </Tabs>
   );
 }
diff --git a/apps/shopkeeper/app/_layout.tsx b/apps/shopkeeper/app/_layout.tsx
index 781fa49..f23665f 100644
--- a/apps/shopkeeper/app/_layout.tsx
+++ b/apps/shopkeeper/app/_layout.tsx
@@ -2,6 +2,7 @@ import { Stack, useNavigationContainerRef } from 'expo-router';
 import { useFonts } from 'expo-font';
 import * as SplashScreen from 'expo-splash-screen';
 import { useEffect, useRef } from 'react';
+import { LogBox } from 'react-native';
 import { SafeAreaProvider } from 'react-native-safe-area-context';
 import { StatusBar } from 'expo-status-bar';
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
@@ -18,6 +19,9 @@ const posthogClient = POSTHOG_API_KEY
 const queryClient = new QueryClient();
 
 SplashScreen.preventAutoHideAsync().catch(() => {});
+LogBox.ignoreLogs([
+  'This method is deprecated (as well as all React Native Firebase namespaced API)',
+]);
 
 function ScreenTracker(): null {
   const posthog = usePostHog();
diff --git a/apps/shopkeeper/app/index.tsx b/apps/shopkeeper/app/index.tsx
index 9b1b02c..7cde773 100644
--- a/apps/shopkeeper/app/index.tsx
+++ b/apps/shopkeeper/app/index.tsx
@@ -16,7 +16,7 @@ export default function Index(): React.ReactElement {
       </View>
     );
   }
-  // firebaseUser alone is not sufficient — user is populated only after successful /auth/session,
+  // firebaseUser alone is not sufficient — user is populated only after successful /api/v1/auth/session,
   // so firebaseUser && user guarantees a fully provisioned session.
   if (firebaseUser && user) {
     return <Redirect href="/(tabs)" />;
diff --git a/apps/shopkeeper/app/settings/account.tsx b/apps/shopkeeper/app/settings/account.tsx
index bc0257e..13854b2 100644
--- a/apps/shopkeeper/app/settings/account.tsx
+++ b/apps/shopkeeper/app/settings/account.tsx
@@ -36,7 +36,7 @@ export default function AccountScreen(): React.ReactElement {
   const handleLogoutAll = async (): Promise<void> => {
     setLoading(true);
     try {
-      await api.post('/auth/logout/all');
+      await api.post('/api/v1/auth/logout/all');
       useAuthStore.getState().reset();
       router.replace('/(auth)/phone');
     } catch {
diff --git a/apps/shopkeeper/app/settings/audit-log.tsx b/apps/shopkeeper/app/settings/audit-log.tsx
index d29ebf9..25e4c05 100644
--- a/apps/shopkeeper/app/settings/audit-log.tsx
+++ b/apps/shopkeeper/app/settings/audit-log.tsx
@@ -76,7 +76,7 @@ async function fetchAuditLog(params: {
     qs['category'] = params.category;
   }
   const queryString = new URLSearchParams(qs).toString();
-  const res = await api.get<AuditLogResponse>(`/auth/audit-log?${queryString}`);
+  const res = await api.get<AuditLogResponse>(`/api/v1/auth/audit-log?${queryString}`);
   return res.data;
 }
 
diff --git a/apps/shopkeeper/app/settings/staff.tsx b/apps/shopkeeper/app/settings/staff.tsx
index 4bddcce..a164358 100644
--- a/apps/shopkeeper/app/settings/staff.tsx
+++ b/apps/shopkeeper/app/settings/staff.tsx
@@ -106,7 +106,7 @@ export default function StaffScreen(): React.ReactElement {
     setListLoading(true);
     setListError(null);
     try {
-      const res = await api.get<StaffUser[]>('/auth/users');
+      const res = await api.get<StaffUser[]>('/api/v1/auth/users');
       setStaff((res.data ?? []).filter((m) => m.status !== 'REVOKED'));
     } catch {
       setListError('स्टाफ लोड नहीं हो सका। दोबारा कोशिश करें।');
@@ -127,7 +127,7 @@ export default function StaffScreen(): React.ReactElement {
     if (!isAdmin) return;
     setPermsLoading(true);
     api
-      .get<Record<string, boolean>>('/auth/roles/shop_manager/permissions')
+      .get<Record<string, boolean>>('/api/v1/auth/roles/shop_manager/permissions')
       .then((res) => {
         setPermissions(res.data ?? {});
       })
@@ -151,7 +151,7 @@ export default function StaffScreen(): React.ReactElement {
     setInviteLoading(true);
     setInviteError(null);
     try {
-      await api.post('/auth/invite', { ...data, shop_id: shopId });
+      await api.post('/api/v1/auth/invite', { ...data, shop_id: shopId });
       setSuccessMsg('आमंत्रण भेज दिया गया');
       setTimeout(() => setSuccessMsg(null), 3000);
       // Invalidate staff list
@@ -180,7 +180,7 @@ export default function StaffScreen(): React.ReactElement {
     setPermissions(updated);
     // UpdatePermissionSchema expects { permission_key, is_enabled } — one call per toggle.
     api
-      .put('/auth/roles/shop_manager/permissions', { permission_key: key, is_enabled: value })
+      .put('/api/v1/auth/roles/shop_manager/permissions', { permission_key: key, is_enabled: value })
       .catch(() => {
         // Rollback optimistic update on error
         setPermissions(previous);
@@ -206,7 +206,7 @@ export default function StaffScreen(): React.ReactElement {
     setRevokeTarget(null);
 
     try {
-      await api.delete(`/auth/staff/${target.id}`);
+      await api.delete(`/api/v1/auth/staff/${target.id}`);
       setSuccessMsg('हटा दिया गया');
       setTimeout(() => setSuccessMsg(null), 3000);
       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
diff --git a/apps/shopkeeper/babel.config.js b/apps/shopkeeper/babel.config.js
index 9d89e13..d872de3 100644
--- a/apps/shopkeeper/babel.config.js
+++ b/apps/shopkeeper/babel.config.js
@@ -2,5 +2,6 @@ module.exports = function (api) {
   api.cache(true);
   return {
     presets: ['babel-preset-expo'],
+    plugins: ['react-native-reanimated/plugin'],
   };
 };
diff --git a/apps/shopkeeper/expo-env.d.ts b/apps/shopkeeper/expo-env.d.ts
index 070bc54..5411fdd 100644
--- a/apps/shopkeeper/expo-env.d.ts
+++ b/apps/shopkeeper/expo-env.d.ts
@@ -1,22 +1,3 @@
 /// <reference types="expo/types" />
 
-// Type stub for expo-haptics — package is a native module mocked in tests and
-// resolved at runtime via the Expo native module registry. Declaring it here
-// lets tsc resolve the import without requiring the package in node_modules.
-declare module 'expo-haptics' {
-  export enum ImpactFeedbackStyle {
-    Light = 'Light',
-    Medium = 'Medium',
-    Heavy = 'Heavy',
-    Rigid = 'Rigid',
-    Soft = 'Soft',
-  }
-  export enum NotificationFeedbackType {
-    Success = 'Success',
-    Warning = 'Warning',
-    Error = 'Error',
-  }
-  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
-  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
-  export function selectionAsync(): Promise<void>;
-}
+// NOTE: This file should not be edited and should be in your git ignore
\ No newline at end of file
diff --git a/apps/shopkeeper/metro.config.js b/apps/shopkeeper/metro.config.js
index 74abfbc..087cbb2 100644
--- a/apps/shopkeeper/metro.config.js
+++ b/apps/shopkeeper/metro.config.js
@@ -11,6 +11,7 @@ config.resolver.nodeModulesPaths = [
   path.resolve(projectRoot, 'node_modules'),
   path.resolve(workspaceRoot, 'node_modules'),
 ];
-config.resolver.disableHierarchicalLookup = true;
+// Keep hierarchical lookup enabled so Metro can follow pnpm virtual-store
+// transitive dependencies used by Expo and React Native libraries.
 
 module.exports = config;
diff --git a/apps/shopkeeper/package.json b/apps/shopkeeper/package.json
index b05b32a..f14b6b6 100644
--- a/apps/shopkeeper/package.json
+++ b/apps/shopkeeper/package.json
@@ -18,39 +18,45 @@
     "@goldsmith/auth-client": "workspace:*",
     "@goldsmith/compliance": "workspace:*",
     "@goldsmith/i18n": "workspace:*",
+    "@goldsmith/money": "workspace:*",
     "@goldsmith/shared": "workspace:*",
     "@goldsmith/sync": "workspace:*",
     "@goldsmith/ui-mobile": "workspace:*",
     "@goldsmith/ui-tokens": "workspace:*",
     "@nozbe/watermelondb": "^0.27.1",
     "@react-native-async-storage/async-storage": "1.23.1",
-    "@react-native-community/netinfo": "^11.3.1",
+    "@react-native-community/netinfo": "11.3.1",
     "@react-native-firebase/app": "^21.0.0",
     "@react-native-firebase/auth": "^21.0.0",
-    "@react-navigation/native": "^7.2.2",
-    "@react-navigation/native-stack": "^7.14.12",
+    "@react-navigation/native": "^6.1.18",
+    "@react-navigation/native-stack": "^6.9.26",
+    "@tanstack/query-core": "5.99.2",
     "@tanstack/react-query": "^5.0.0",
     "axios": "^1.7.0",
     "expo": "~51.0.0",
     "expo-constants": "~16.0.0",
     "expo-dev-client": "~4.0.0",
-    "expo-document-picker": "~11.7.0",
+    "expo-document-picker": "~12.0.2",
     "expo-font": "~12.0.0",
     "expo-haptics": "~13.0.1",
-    "expo-image": "^55.0.9",
-    "expo-image-picker": "^55.0.19",
+    "expo-image": "~1.13.0",
+    "expo-image-picker": "~15.1.0",
+    "expo-linking": "~6.3.1",
     "expo-print": "~13.0.0",
     "expo-router": "~3.5.0",
     "expo-splash-screen": "~0.27.0",
     "expo-status-bar": "~1.12.0",
     "posthog-react-native": "^3.0.0",
+    "prop-types": "^15.8.1",
     "react": "18.2.0",
     "react-dom": "18.2.0",
-    "react-native": "0.74.0",
+    "react-native": "0.74.5",
     "react-native-draggable-flatlist": "^4.0.3",
-    "react-native-safe-area-context": "4.10.0",
-    "react-native-screens": "3.31.0",
-    "react-native-svg": "^15.2.0",
+    "react-native-gesture-handler": "~2.16.1",
+    "react-native-reanimated": "~3.10.1",
+    "react-native-safe-area-context": "4.10.5",
+    "react-native-screens": "3.31.1",
+    "react-native-svg": "15.2.0",
     "react-native-web": "~0.19.0",
     "uuid": "^9.0.0",
     "zustand": "^4.5.0"
@@ -63,7 +69,7 @@
     "axe-core": "^4.9.0",
     "axios-mock-adapter": "^1.22.0",
     "jsdom": "^24.0.0",
-    "typescript": "^5.4.0",
+    "typescript": "~5.3.3",
     "vitest": "^1.6.0"
   }
 }
diff --git a/apps/shopkeeper/src/api/client.ts b/apps/shopkeeper/src/api/client.ts
index dcec58a..ca39ae7 100644
--- a/apps/shopkeeper/src/api/client.ts
+++ b/apps/shopkeeper/src/api/client.ts
@@ -7,7 +7,7 @@ import Constants from 'expo-constants';
 import { getIdToken } from '@goldsmith/auth-client';
 
 const baseURL =
-  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3000';
+  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3001';
 
 export const api: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });
 
diff --git a/apps/shopkeeper/src/api/endpoints.ts b/apps/shopkeeper/src/api/endpoints.ts
index a19eca4..7e7991e 100644
--- a/apps/shopkeeper/src/api/endpoints.ts
+++ b/apps/shopkeeper/src/api/endpoints.ts
@@ -2,6 +2,8 @@ import { api } from './client';
 import type { Tenant } from '../stores/tenantStore';
 import type { AuthenticatedUser } from '../stores/authStore';
 
+const AUTH_API_BASE = '/api/v1/auth';
+
 export interface AuthSessionResponse {
   user: AuthenticatedUser;
   tenant: Pick<Tenant, 'id' | 'slug' | 'displayName'>;
@@ -9,12 +11,12 @@ export interface AuthSessionResponse {
 }
 
 export async function postAuthSession(idToken: string): Promise<AuthSessionResponse> {
-  const res = await api.post<AuthSessionResponse>('/auth/session', { idToken });
+  const res = await api.post<AuthSessionResponse>(`${AUTH_API_BASE}/session`, { idToken });
   return res.data;
 }
 
 export async function getAuthMe(): Promise<AuthenticatedUser> {
-  const res = await api.get<{ user: AuthenticatedUser }>('/auth/me');
+  const res = await api.get<{ user: AuthenticatedUser }>(`${AUTH_API_BASE}/me`);
   return res.data.user;
 }
 
diff --git a/apps/shopkeeper/src/lib/api-client.ts b/apps/shopkeeper/src/lib/api-client.ts
index c375290..dc5cd39 100644
--- a/apps/shopkeeper/src/lib/api-client.ts
+++ b/apps/shopkeeper/src/lib/api-client.ts
@@ -1,7 +1,10 @@
 import axios from 'axios';
 import Constants from 'expo-constants';
 
-// API base URL from Expo config or fallback to local dev
-const baseURL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000';
+// API base URL from Expo config or fallback to local dev.
+const baseURL =
+  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ??
+  (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
+  'http://localhost:3001';
 
 export const apiClient = axios.create({ baseURL });
diff --git a/apps/shopkeeper/src/providers/AuthProvider.tsx b/apps/shopkeeper/src/providers/AuthProvider.tsx
index 534352e..d47707f 100644
--- a/apps/shopkeeper/src/providers/AuthProvider.tsx
+++ b/apps/shopkeeper/src/providers/AuthProvider.tsx
@@ -1,6 +1,7 @@
 import { useEffect } from 'react';
 import { auth } from '@goldsmith/auth-client';
 import { useAuthStore } from '../stores/authStore';
+import { getAuthMe } from '../api/endpoints';
 
 export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
   const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
@@ -24,8 +25,11 @@ export function AuthProvider({ children }: { children: React.ReactNode }): React
         try {
           const token = await u.getIdToken();
           setIdToken(token);
+          const apiUser = await getAuthMe();
+          setUser(apiUser);
         } catch {
           setIdToken(null);
+          setUser(null);
         } finally {
           setLoading(false);
         }
diff --git a/apps/shopkeeper/test/AuthProvider.test.tsx b/apps/shopkeeper/test/AuthProvider.test.tsx
index a8e5704..f2eb4d6 100644
--- a/apps/shopkeeper/test/AuthProvider.test.tsx
+++ b/apps/shopkeeper/test/AuthProvider.test.tsx
@@ -1,6 +1,18 @@
 import React from 'react';
-import { describe, it, expect, beforeEach } from 'vitest';
+import { describe, it, expect, beforeEach, vi } from 'vitest';
 import { render, act } from '@testing-library/react';
+
+const authEndpointMocks = vi.hoisted(() => ({
+  getAuthMe: vi.fn(),
+}));
+
+vi.mock('@goldsmith/auth-client', async () => {
+  const firebaseAuthMock = await import('./firebase-auth.mock');
+  return { auth: firebaseAuthMock.default };
+});
+
+vi.mock('../src/api/endpoints', () => authEndpointMocks);
+
 import { AuthProvider } from '../src/providers/AuthProvider';
 import { useAuthStore } from '../src/stores/authStore';
 import { __setCurrentUser } from './firebase-auth.mock';
@@ -8,11 +20,18 @@ import { __setCurrentUser } from './firebase-auth.mock';
 describe('AuthProvider', () => {
   beforeEach(() => {
     useAuthStore.setState({ firebaseUser: null, user: null, idToken: null, loading: true });
+    authEndpointMocks.getAuthMe.mockReset();
+    authEndpointMocks.getAuthMe.mockResolvedValue({
+      id: 'u1',
+      shopId: 's1',
+      role: 'shop_owner',
+      displayName: 'Test User',
+    });
     // Reset listener by setting null so next render starts fresh
     __setCurrentUser(null);
   });
 
-  it('sets firebaseUser + idToken when Firebase emits a user', async () => {
+  it('sets firebaseUser, idToken, and API user when Firebase emits a user', async () => {
     render(<AuthProvider>{null}</AuthProvider>);
     await act(async () => {
       __setCurrentUser({
@@ -24,6 +43,12 @@ describe('AuthProvider', () => {
     const s = useAuthStore.getState();
     expect(s.firebaseUser).toEqual({ uid: 'u1', phoneNumber: '+919999999999' });
     expect(s.idToken).toBe('idtok');
+    expect(s.user).toEqual({
+      id: 'u1',
+      shopId: 's1',
+      role: 'shop_owner',
+      displayName: 'Test User',
+    });
     expect(s.loading).toBe(false);
   });
 
@@ -59,4 +84,21 @@ describe('AuthProvider', () => {
     expect(s.idToken).toBeNull();
     expect(s.loading).toBe(false);
   });
+
+  it('clears API user when session restore fails', async () => {
+    authEndpointMocks.getAuthMe.mockRejectedValue(new Error('session expired'));
+    render(<AuthProvider>{null}</AuthProvider>);
+    await act(async () => {
+      __setCurrentUser({
+        uid: 'u3',
+        phoneNumber: '+919876543210',
+        getIdToken: async () => 'idtok',
+      });
+    });
+    const s = useAuthStore.getState();
+    expect(s.firebaseUser).toEqual({ uid: 'u3', phoneNumber: '+919876543210' });
+    expect(s.idToken).toBeNull();
+    expect(s.user).toBeNull();
+    expect(s.loading).toBe(false);
+  });
 });
diff --git a/apps/shopkeeper/test/otp.screen.test.tsx b/apps/shopkeeper/test/otp.screen.test.tsx
index 90bf3e8..220be4e 100644
--- a/apps/shopkeeper/test/otp.screen.test.tsx
+++ b/apps/shopkeeper/test/otp.screen.test.tsx
@@ -83,7 +83,7 @@ describe('(auth)/otp.tsx', () => {
     fireEvent.change(input, { target: { value: '123456' } });
     fireEvent.click(getByTestId('otp-cta'));
 
-    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalled());
+    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledWith({ confirm: mockConfirm }, '123456'));
     await waitFor(() => expect(postAuthSessionMock).toHaveBeenCalledWith('tok-123'));
     await waitFor(() =>
       expect(expoRouter.router.replace).toHaveBeenCalledWith('/(tabs)'),
diff --git a/apps/shopkeeper/test/phone.screen.test.tsx b/apps/shopkeeper/test/phone.screen.test.tsx
index 4c44150..8abfd49 100644
--- a/apps/shopkeeper/test/phone.screen.test.tsx
+++ b/apps/shopkeeper/test/phone.screen.test.tsx
@@ -58,6 +58,19 @@ describe('(auth)/phone.tsx', () => {
     expect(expoRouter.router.push).toHaveBeenCalledWith('/(auth)/otp');
   });
 
+  it('accepts pasted +91 number and keeps the login flow on the same E.164 phone', async () => {
+    const confirmMock = vi.fn();
+    sendOtpMock.mockResolvedValue({ confirmationId: 'abc', confirm: confirmMock });
+    const { getByTestId } = render(<Phone />);
+    const input = getByTestId('phone-input');
+    fireEvent.change(input, { target: { value: '+91 98765 43210' } });
+    fireEvent.click(getByTestId('phone-cta'));
+
+    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledWith('+919876543210'));
+    expect(useOtpStore.getState().phoneE164).toBe('+919876543210');
+    expect(expoRouter.router.push).toHaveBeenCalledWith('/(auth)/otp');
+  });
+
   it('shows Toast on sendOtp failure', async () => {
     sendOtpMock.mockRejectedValue(new Error('network'));
     const { getByTestId, findByText } = render(<Phone />);
diff --git a/docs/agent-context/acceptance-evidence.json b/docs/agent-context/acceptance-evidence.json
index 0423fcc..623ef70 100644
--- a/docs/agent-context/acceptance-evidence.json
+++ b/docs/agent-context/acceptance-evidence.json
@@ -1,5 +1,5 @@
 {
-  "generated": "2026-05-04T22:25:48.841Z",
+  "generated": "2026-05-06T08:05:28.112Z",
   "summary": {
     "total": 23,
     "implemented": 14,
@@ -398,7 +398,12 @@
       "class": "B",
       "status": "planned",
       "frs": [
+        "FR113",
+        "FR114",
+        "FR115",
+        "FR116",
         "FR117",
+        "FR118",
         "FR119"
       ],
       "specFile": "",
diff --git a/docs/agent-context/decision-index.json b/docs/agent-context/decision-index.json
index 8c99b0b..4c8f37e 100644
--- a/docs/agent-context/decision-index.json
+++ b/docs/agent-context/decision-index.json
@@ -1,5 +1,5 @@
 {
-  "generated": "2026-05-04T22:25:47.967Z",
+  "generated": "2026-05-06T08:05:26.488Z",
   "adrs": [
     {
       "id": "ADR-0001",
diff --git a/docs/agent-context/doc-index.json b/docs/agent-context/doc-index.json
index 7c86e83..3549e8d 100644
--- a/docs/agent-context/doc-index.json
+++ b/docs/agent-context/doc-index.json
@@ -1,141 +1,141 @@
 {
-  "generated": "2026-05-04T22:25:48.550Z",
+  "generated": "2026-05-06T08:05:27.615Z",
   "docs": [
     {
       "path": "_bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 680,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0001-auth-provider-supabase.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0002-multi-tenant-single-db-rls.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1290,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0002-multi-tenant-single-db-rls.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0003-money-weight-decimal-primitives.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1420,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0003-money-weight-decimal-primitives.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0004-offline-sync-protocol.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1820,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0004-offline-sync-protocol.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1570,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0005-tenant-context-defense-in-depth.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0006-vendor-adapter-pattern.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1880,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0006-vendor-adapter-pattern.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0007-near-real-time-polling-mvp.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1150,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0007-near-real-time-polling-mvp.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0008-white-label-shared-app-theming.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1370,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0008-white-label-shared-app-theming.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0009-monorepo-modular-monolith-layout.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1330,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0009-monorepo-modular-monolith-layout.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0010-tenant-provisioning-automation.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1590,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0010-tenant-provisioning-automation.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0011-compliance-package-hard-block-gateway.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 2190,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0011-compliance-package-hard-block-gateway.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1500,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0012-iac-terraform-over-cdk.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0013-per-tenant-kek-envelope-encryption.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 530,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0013-per-tenant-kek-envelope-encryption.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0014-pitr-under-dpdpa-erasure.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 560,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0014-pitr-under-dpdpa-erasure.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0015-stack-correction-azure-firebase-startup-lean.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 1290,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0015-stack-correction-azure-firebase-startup-lean.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/0016-firebase-auth-id-token-direct.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 640,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/0016-firebase-auth-id-token-direct.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/adr/README.md",
-      "kind": "other",
+      "kind": "adr",
       "estimatedTokens": 280,
-      "readWhen": "reference only",
-      "avoidByDefault": false,
-      "supersededBy": null
+      "readWhen": "checking architecture decisions",
+      "avoidByDefault": true,
+      "supersededBy": "docs/adr/README.md"
     },
     {
       "path": "_bmad-output/planning-artifacts/architecture.md",
@@ -289,6 +289,14 @@
       "avoidByDefault": false,
       "supersededBy": null
     },
+    {
+      "path": "docs/AGENT-START-HERE.md",
+      "kind": "handoff",
+      "estimatedTokens": 480,
+      "readWhen": "first file for every future coding or planning session",
+      "avoidByDefault": false,
+      "supersededBy": null
+    },
     {
       "path": "docs/adr/0001-auth-provider-supabase.md",
       "kind": "adr",
@@ -426,10 +434,18 @@
       "supersededBy": null
     },
     {
-      "path": "docs/code-truth-completion-audit-2026-05-04.md",
-      "kind": "audit",
-      "estimatedTokens": 2670,
-      "readWhen": "gap analysis or completion assessment",
+      "path": "docs/agent-context/README.md",
+      "kind": "other",
+      "estimatedTokens": 300,
+      "readWhen": "reference only",
+      "avoidByDefault": false,
+      "supersededBy": null
+    },
+    {
+      "path": "docs/current-implementation-status.md",
+      "kind": "status",
+      "estimatedTokens": 720,
+      "readWhen": "checking current implementation status or launch gaps",
       "avoidByDefault": false,
       "supersededBy": null
     },
@@ -451,9 +467,9 @@
     },
     {
       "path": "docs/functional-overview.md",
-      "kind": "other",
-      "estimatedTokens": 2850,
-      "readWhen": "reference only",
+      "kind": "overview",
+      "estimatedTokens": 900,
+      "readWhen": "needing product, functional, architecture, and UI/UX context in human-readable form",
       "avoidByDefault": false,
       "supersededBy": null
     },
@@ -969,6 +985,22 @@
       "avoidByDefault": true,
       "supersededBy": null
     },
+    {
+      "path": "docs/superpowers/plans/2026-05-04-ws2b-profile-timeline.md",
+      "kind": "plan",
+      "estimatedTokens": 22500,
+      "readWhen": "executing a specific story — read only that story's plan",
+      "avoidByDefault": true,
+      "supersededBy": null
+    },
+    {
+      "path": "docs/superpowers/plans/2026-05-05-ws2a-shopkeeper-nav.md",
+      "kind": "plan",
+      "estimatedTokens": 10630,
+      "readWhen": "executing a specific story — read only that story's plan",
+      "avoidByDefault": true,
+      "supersededBy": null
+    },
     {
       "path": "docs/superpowers/plans/_TEMPLATE-work-stream.md",
       "kind": "plan",
@@ -1121,6 +1153,22 @@
       "avoidByDefault": false,
       "supersededBy": null
     },
+    {
+      "path": "docs/superpowers/specs/2026-05-04-ws2b-profile-timeline-design.md",
+      "kind": "spec",
+      "estimatedTokens": 2590,
+      "readWhen": "implementing or reviewing a specific story",
+      "avoidByDefault": false,
+      "supersededBy": null
+    },
+    {
+      "path": "docs/superpowers/specs/2026-05-05-ws2a-shopkeeper-nav-design.md",
+      "kind": "spec",
+      "estimatedTokens": 2220,
+      "readWhen": "implementing or reviewing a specific story",
+      "avoidByDefault": false,
+      "supersededBy": null
+    },
     {
       "path": "docs/threat-model.md",
       "kind": "other",
@@ -1128,6 +1176,14 @@
       "readWhen": "reference only",
       "avoidByDefault": false,
       "supersededBy": null
+    },
+    {
+      "path": "docs/verification/local-qa-checklist.md",
+      "kind": "other",
+      "estimatedTokens": 1110,
+      "readWhen": "reference only",
+      "avoidByDefault": false,
+      "supersededBy": null
     }
   ]
 }
diff --git a/docs/agent-context/project.context.json b/docs/agent-context/project.context.json
index e8435f3..c35996c 100644
--- a/docs/agent-context/project.context.json
+++ b/docs/agent-context/project.context.json
@@ -1,10 +1,38 @@
 {
-  "generated": "2026-05-04T22:25:47.739Z",
+  "generated": "2026-05-06T08:05:24.817Z",
   "repo": "Goldsmith",
   "description": "Multi-tenant white-label jewellery platform for local Indian jewellers",
+  "readOrder": [
+    "docs/AGENT-START-HERE.md",
+    "docs/agent-context/project.context.json",
+    "docs/agent-context/current-state.json",
+    "docs/agent-context/implementation-map.json",
+    "docs/agent-context/task-routing.json"
+  ],
+  "sourceOfTruth": {
+    "completionClaims": "current code, migrations, reachable UI routes, tests, and CI gates",
+    "functionalRequirements": [
+      "_bmad-output/planning-artifacts/prd.md",
+      "docs/prd-addendum-customer-storefront.md"
+    ],
+    "architectureDecisions": [
+      "_bmad-output/planning-artifacts/architecture.md",
+      "docs/adr/*.md",
+      "docs/agent-context/decision-index.json"
+    ],
+    "uiUxRules": [
+      "CLAUDE.md",
+      "docs/functional-overview.md",
+      "_bmad-output/planning-artifacts/ux-design-specification.md"
+    ],
+    "currentStatus": [
+      "docs/current-implementation-status.md",
+      "docs/agent-context/current-state.json"
+    ]
+  },
   "stack": {
     "api": "NestJS (TypeScript) + PostgreSQL 15 + Drizzle + Redis + BullMQ",
-    "mobile": "React Native (Expo SDK 50) + NativeWind",
+    "mobile": "React Native (Expo SDK 51) + NativeWind",
     "web": "Next.js 14 (App Router) + Tailwind CSS + shadcn/ui",
     "auth": "Firebase Auth (phone OTP)",
     "storage": "Azure Blob Storage + ImageKit CDN",
@@ -151,7 +179,10 @@
     "wishlist"
   ],
   "commands": {
-    "dev": "pnpm dev",
+    "start:api": "pnpm --filter @goldsmith/api start",
+    "dev:shopkeeper": "pnpm --filter @goldsmith/shopkeeper start",
+    "dev:customer-mobile": "pnpm --filter @goldsmith/customer-mobile start",
+    "dev:customer-web": "pnpm --filter @goldsmith/customer-web dev",
     "typecheck": "pnpm typecheck",
     "lint": "pnpm lint",
     "test:unit": "pnpm test:unit",
@@ -171,10 +202,10 @@
     "GST rates: 3% metal + 5% making hardcoded. No user override on rates.",
     "HUID: Required field on every hallmarked product; appears on every hallmarked invoice.",
     "PMLA: Cumulative monthly cash per customer tracked; warning at Rs 8L, block at Rs 10L with CTR template auto-generated.",
-    "auditLog(pool, {action, subjectType, subjectId, actorUserId}) from @goldsmith/audit — never audit.emit(tx, ...)",
+    "auditLog(pool, {action, subjectType, subjectId, actorUserId}) from @goldsmith/audit - never audit.emit(tx, ...)",
     "Use import (not import type) for NestJS @Injectable constructor params",
     "No Goldsmith platform brand on any customer-facing surface",
-    "All new @Injectable constructors need explicit @Inject(Token) — tsx/esbuild drops paramtypes"
+    "All new @Injectable constructors need explicit @Inject(Token) - tsx/esbuild drops paramtypes"
   ],
   "ceremonyClasses": {
     "A": [
@@ -206,7 +237,7 @@
     ]
   },
   "migrations": {
-    "current": "0059",
+    "current": "0060",
     "reserved": "0060-0085",
     "pattern": "packages/db/src/migrations/{seq}_{slug}.sql"
   }
diff --git a/docs/agent-context/task-routing.json b/docs/agent-context/task-routing.json
index ef8e496..55eec02 100644
--- a/docs/agent-context/task-routing.json
+++ b/docs/agent-context/task-routing.json
@@ -48,7 +48,8 @@
       "description": "NotificationsModule, outbox, BullMQ processors, WhatsApp/Email/SMS/Push adapters",
       "readFirst": ["docs/agent-context/project.context.json", "docs/agent-context/task-routing.json"],
       "readAlso": ["docs/agent-context/decision-index.json"],
-      "sourceFiles": ["apps/api/src/modules/notifications/", "packages/integrations/"],
+      "sourceFiles": ["apps/api/src/modules/settings/", "packages/queue/src/", "packages/integrations/"],
+      "futureFiles": ["apps/api/src/modules/notifications/"],
       "avoidFiles": ["_bmad-output/**", "docs/reviews/**"],
       "runBefore": ["pnpm typecheck", "pnpm test:integration"]
     },
diff --git a/docs/agent-context/traceability-seed.json b/docs/agent-context/traceability-seed.json
index 4d6bdd9..4ca0b1f 100644
--- a/docs/agent-context/traceability-seed.json
+++ b/docs/agent-context/traceability-seed.json
@@ -1,10 +1,10 @@
 {
   "overrides": [
     { "id": "FR64", "title": "Logged-in customer view event tracking", "status": "partial", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
-    { "id": "FR65", "title": "Anonymous product view event tracking", "status": "missing", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
-    { "id": "FR66", "title": "Per-product analytics with hot/cold dashboards", "status": "missing", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
+    { "id": "FR65", "title": "Anonymous product view event tracking", "status": "complete", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
+    { "id": "FR66", "title": "Per-product analytics with hot/cold dashboards", "status": "partial", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
     { "id": "FR67", "title": "Per-customer browsing history in CRM", "status": "missing", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
-    { "id": "FR68", "title": "Customer viewing opt-out and retroactive anonymization", "status": "missing", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
+    { "id": "FR68", "title": "Customer viewing opt-out and retroactive anonymization", "status": "partial", "wave": "WS-3C", "epic": "E12", "story": "12.x" },
     { "id": "FR73", "title": "Custom order customer-side progress view", "status": "partial", "wave": "WS-3D", "epic": "E11", "story": "11.x" },
     { "id": "FR74", "title": "Custom order modification request", "status": "missing", "wave": "WS-3D", "epic": "E11", "story": "11.x" },
     { "id": "FR107", "title": "WhatsApp notifications to customers for invoice/order/rate-lock/try-at-home/loyalty", "status": "missing", "wave": "WS-0.2", "epic": "E13", "story": "13.x" },
@@ -13,8 +13,13 @@
     { "id": "FR110", "title": "Broadcast WhatsApp to filtered customer segments", "status": "missing", "wave": "WS-3B", "epic": "E13", "story": "13.x" },
     { "id": "FR111", "title": "Customer opt-in/out of marketing vs transactional notifications", "status": "missing", "wave": "WS-3B", "epic": "E13", "story": "13.x" },
     { "id": "FR112", "title": "Outbound messaging events logged per tenant for audit and quota tracking", "status": "missing", "wave": "WS-3B", "epic": "E13", "story": "13.x" },
-    { "id": "FR117", "title": "Inventory aging and dead stock report", "status": "missing", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
-    { "id": "FR119", "title": "Export any report as CSV and PDF with shop branding", "status": "missing", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
+    { "id": "FR113", "title": "Daily sales summary report", "status": "complete", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
+    { "id": "FR114", "title": "Stock valuation report at current market rate", "status": "complete", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
+    { "id": "FR115", "title": "Outstanding-payment report", "status": "complete", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
+    { "id": "FR116", "title": "Customer analytics report", "status": "partial", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
+    { "id": "FR117", "title": "Inventory aging and dead stock report", "status": "complete", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
+    { "id": "FR118", "title": "Loyalty program summary report", "status": "complete", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
+    { "id": "FR119", "title": "Export any report as CSV and PDF with shop branding", "status": "partial", "wave": "WS-3A", "epic": "E14", "story": "14.x" },
     { "id": "FR126", "title": "Global platform settings and compliance versioning", "status": "partial", "wave": "WS-2C", "epic": "E16", "story": "16.x" },
     { "id": "FR127", "title": "Tenant-configurable footer", "status": "missing", "wave": "WS-1A", "epic": "E17", "story": "17.x" },
     { "id": "FR128", "title": "Homepage trust-pillar strip", "status": "missing", "wave": "WS-1B", "epic": "E17", "story": "17.x" },
diff --git a/docs/agent-context/traceability.json b/docs/agent-context/traceability.json
index 0ac7b9b..51fc30e 100644
--- a/docs/agent-context/traceability.json
+++ b/docs/agent-context/traceability.json
@@ -1,10 +1,12 @@
 {
-  "generated": "2026-05-04T22:25:48.264Z",
+  "generated": "2026-05-06T08:05:27.088Z",
+  "statusAuthority": "docs/agent-context/current-state.json",
+  "note": "Traceability is a requirement lookup and explicit-gap seed. Use current-state.json plus code evidence for completion claims.",
   "summary": {
     "total": 140,
-    "complete": 4,
-    "partial": 3,
-    "missing": 133,
+    "complete": 10,
+    "partial": 7,
+    "missing": 123,
     "planned": 0
   },
   "frs": [
@@ -845,8 +847,8 @@
       "title": "Anonymous product view event tracking",
       "epic": "E12",
       "story": "12.x",
-      "status": "missing",
-      "evidence": "missing",
+      "status": "complete",
+      "evidence": "spec-only",
       "wave": "WS-3C",
       "specFile": null,
       "codeModule": null,
@@ -858,8 +860,8 @@
       "title": "Per-product analytics with hot/cold dashboards",
       "epic": "E12",
       "story": "12.x",
-      "status": "missing",
-      "evidence": "missing",
+      "status": "partial",
+      "evidence": "spec-only",
       "wave": "WS-3C",
       "specFile": null,
       "codeModule": null,
@@ -884,8 +886,8 @@
       "title": "Customer viewing opt-out and retroactive anonymization",
       "epic": "E12",
       "story": "12.x",
-      "status": "missing",
-      "evidence": "missing",
+      "status": "partial",
+      "evidence": "spec-only",
       "wave": "WS-3C",
       "specFile": null,
       "codeModule": null,
@@ -1466,12 +1468,12 @@
     },
     {
       "id": "FR113",
-      "title": "FR113",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
+      "title": "Daily sales summary report",
+      "epic": "E14",
+      "story": "14.x",
+      "status": "complete",
+      "evidence": "spec-only",
+      "wave": "WS-3A",
       "specFile": null,
       "codeModule": null,
       "testFile": null,
@@ -1479,12 +1481,12 @@
     },
     {
       "id": "FR114",
-      "title": "FR114",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
+      "title": "Stock valuation report at current market rate",
+      "epic": "E14",
+      "story": "14.x",
+      "status": "complete",
+      "evidence": "spec-only",
+      "wave": "WS-3A",
       "specFile": null,
       "codeModule": null,
       "testFile": null,
@@ -1492,12 +1494,12 @@
     },
     {
       "id": "FR115",
-      "title": "FR115",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
+      "title": "Outstanding-payment report",
+      "epic": "E14",
+      "story": "14.x",
+      "status": "complete",
+      "evidence": "spec-only",
+      "wave": "WS-3A",
       "specFile": null,
       "codeModule": null,
       "testFile": null,
@@ -1505,12 +1507,12 @@
     },
     {
       "id": "FR116",
-      "title": "FR116",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
+      "title": "Customer analytics report",
+      "epic": "E14",
+      "story": "14.x",
+      "status": "partial",
+      "evidence": "spec-only",
+      "wave": "WS-3A",
       "specFile": null,
       "codeModule": null,
       "testFile": null,
@@ -1521,8 +1523,8 @@
       "title": "Inventory aging and dead stock report",
       "epic": "E14",
       "story": "14.x",
-      "status": "missing",
-      "evidence": "missing",
+      "status": "complete",
+      "evidence": "spec-only",
       "wave": "WS-3A",
       "specFile": null,
       "codeModule": null,
@@ -1531,12 +1533,12 @@
     },
     {
       "id": "FR118",
-      "title": "FR118",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
+      "title": "Loyalty program summary report",
+      "epic": "E14",
+      "story": "14.x",
+      "status": "complete",
+      "evidence": "spec-only",
+      "wave": "WS-3A",
       "specFile": null,
       "codeModule": null,
       "testFile": null,
@@ -1547,8 +1549,8 @@
       "title": "Export any report as CSV and PDF with shop branding",
       "epic": "E14",
       "story": "14.x",
-      "status": "missing",
-      "evidence": "missing",
+      "status": "partial",
+      "evidence": "spec-only",
       "wave": "WS-3A",
       "specFile": null,
       "codeModule": null,
@@ -2597,32 +2599,6 @@
       "testFile": null,
       "ciJob": null
     },
-    {
-      "id": "FR65",
-      "title": "Anonymous product view event tracking",
-      "epic": "E12",
-      "story": "12.x",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": "WS-3C",
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
-    {
-      "id": "FR66",
-      "title": "Per-product analytics with hot/cold dashboards",
-      "epic": "E12",
-      "story": "12.x",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": "WS-3C",
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
     {
       "id": "FR67",
       "title": "Per-customer browsing history in CRM",
@@ -2636,19 +2612,6 @@
       "testFile": null,
       "ciJob": null
     },
-    {
-      "id": "FR68",
-      "title": "Customer viewing opt-out and retroactive anonymization",
-      "epic": "E12",
-      "story": "12.x",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": "WS-3C",
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
     {
       "id": "FR69",
       "title": "FR69",
@@ -3208,97 +3171,6 @@
       "testFile": null,
       "ciJob": null
     },
-    {
-      "id": "FR113",
-      "title": "FR113",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
-    {
-      "id": "FR114",
-      "title": "FR114",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
-    {
-      "id": "FR115",
-      "title": "FR115",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
-    {
-      "id": "FR116",
-      "title": "FR116",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
-    {
-      "id": "FR117",
-      "title": "Inventory aging and dead stock report",
-      "epic": "E14",
-      "story": "14.x",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": "WS-3A",
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
-    {
-      "id": "FR118",
-      "title": "FR118",
-      "epic": "",
-      "story": "",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": null,
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
-    {
-      "id": "FR119",
-      "title": "Export any report as CSV and PDF with shop branding",
-      "epic": "E14",
-      "story": "14.x",
-      "status": "missing",
-      "evidence": "missing",
-      "wave": "WS-3A",
-      "specFile": null,
-      "codeModule": null,
-      "testFile": null,
-      "ciJob": null
-    },
     {
       "id": "FR120",
       "title": "FR120",
diff --git a/docs/functional-overview.md b/docs/functional-overview.md
index c42d84c..935f990 100644
--- a/docs/functional-overview.md
+++ b/docs/functional-overview.md
@@ -1,284 +1,89 @@
-# Goldsmith — Functional Overview
+# Goldsmith Functional Overview
 
-**What it is:** A multi-tenant, white-label jewelry management platform for Hindi-belt Indian jewellers. One codebase powers N jewellers, each with their own branded app and data isolation. The anchor customer is a 2–5 staff jewellery shop in Ayodhya, UP.
+Verified against current code on 2026-05-06. This is the human-readable product and system overview. For machine-readable context, use `docs/agent-context/project.context.json`, `docs/agent-context/current-state.json`, and `docs/agent-context/implementation-map.json`.
 
-**Business model:** Monthly / yearly SaaS subscription. Shopkeeper runs their own branded app — Goldsmith platform brand is never visible to customers.
+## Product
 
----
+Goldsmith is a multi-tenant, white-label jewellery platform for Hindi-belt Indian jewellers. One backend and database serve many shops; every customer-facing surface carries only the jeweller's brand, never the Goldsmith platform brand.
 
-## Who Uses It
+Current delivery target is demo-ready first, then customer-customize and deploy for the first paying jeweller. Older BMAD anchor-customer sequencing is historical context, not the active delivery model.
 
-| Role | Surface | What they do |
-|------|---------|--------------|
-| **Shop Owner** | Shopkeeper mobile app | Full access — billing, inventory, staff, settings, reports |
-| **Manager** | Shopkeeper mobile app | Billing, inventory, customers — no staff management |
-| **Staff** | Shopkeeper mobile app | Billing and inventory only — read-heavy |
-| **Customer** | Customer mobile app + web | Browse inventory, reserve pieces, view invoices |
-| **Platform Admin** | Admin console (web) | Onboard new jewellers, manage tenants |
+## Users And Surfaces
 
----
+| User | Surface | Current code surface |
+| --- | --- | --- |
+| Shop owner | Expo shopkeeper app | Auth, dashboard, inventory, billing, reports, settings, CRM, custom orders, try-at-home, rate-lock |
+| Manager | Expo shopkeeper app | Most operational flows except owner-only controls |
+| Staff | Expo shopkeeper app | Billing, inventory, CRM-adjacent read/create paths; reports/settings hidden by role where needed |
+| Customer | Expo customer app | Auth, home, browse/PDP, wishlist, profile timeline, loyalty, rate-lock, try-at-home |
+| Customer/web visitor | Next.js storefront | Home, catalog, PDP, reviews, wishlist UI, size guide, return policy, contact, rate-lock/try-at-home info |
+| Platform admin | Next.js admin + API | Tenant list/create/update/suspend/unsuspend/export, subscriptions, metrics, impersonation |
 
-## Platform Architecture (Multi-Tenant)
+## Architecture
 
-```mermaid
-graph TB
-    subgraph "Jeweller A — Sharma Jewellers"
-        SA[Shopkeeper App\nRavi's phone]
-        CA[Customer App\nbranded as Sharma Jewellers]
-    end
+The backend is a NestJS modular monolith in `apps/api`. PostgreSQL row-level security and tenant-context helpers provide the hard isolation boundary. Firebase Auth handles phone OTP. Drizzle/pg-backed repositories and shared Zod schemas keep API and app contracts aligned. Redis/BullMQ exist for queue-backed work. Azure Blob Storage plus ImageKit is the image/storage direction.
 
-    subgraph "Jeweller B — Gupta Gold"
-        SB[Shopkeeper App\nRajesh's phone]
-        CB[Customer App\nbranded as Gupta Gold]
-    end
+The repo is a pnpm/Turborepo monorepo:
 
-    subgraph "Goldsmith Backend"
-        API[NestJS API]
-        DB[(PostgreSQL\nRow-Level Security)]
-        REDIS[(Redis Cache)]
-    end
+| Area | Paths |
+| --- | --- |
+| API | `apps/api/src/modules/*` |
+| Shopkeeper app | `apps/shopkeeper/app`, `apps/shopkeeper/src` |
+| Customer mobile app | `apps/customer-mobile/app`, `apps/customer-mobile/src` |
+| Customer web/admin | `apps/customer-web/app`, `apps/customer-web/components`, `apps/customer-web/lib` |
+| Shared contracts | `packages/shared/src/schemas` |
+| Money/weight safety | `packages/money`, `packages/compliance`, `ops/semgrep` |
+| Tenant safety | `packages/db`, `packages/tenant-context`, `packages/testing/tenant-isolation` |
 
-    SA -->|Firebase JWT\nshop_id injected| API
-    CA -->|X-Tenant-Id header| API
-    SB -->|Firebase JWT\nshop_id injected| API
-    CB -->|X-Tenant-Id header| API
-    API --> DB
-    API --> REDIS
+## Functional Map
 
-    note1[Every DB query is\nscoped by shop_id via RLS.\nTenant A can never read\nTenant B data.]
-```
-
----
-
-## Core User Journeys
-
-### 1. The 90-Second Billing Loop (Primary Value)
-
-The shopkeeper's daily core operation — customer walks in, walks out with a GST invoice in under 90 seconds.
-
-```mermaid
-sequenceDiagram
-    participant C as Customer
-    participant R as Ravi (Staff)
-    participant App as Shopkeeper App
-    participant API as Backend
-
-    C->>R: "I want this gold chain"
-    R->>App: Scan barcode on piece
-    App->>API: GET /inventory/products/:id
-    API-->>App: Product details\n(weight, purity, HUID)
-    App->>API: GET /rates/current
-    API-->>App: Live IBJA gold rate
-    App->>App: Compute price\n(weight × rate + making + GST)
-    App-->>R: Shows price breakdown\n₹1,12,440 (incl. GST)
-    R->>App: Select customer / create new
-    R->>App: Record payment\n(Cash ₹50K + UPI ₹62,440)
-    App->>API: POST /billing/invoices\n(Idempotency-Key header)
-    API->>API: Validate HUID\nApply GST 3%+5%\nCheck 269ST cash cap\nCheck PAN if >₹2L
-    API-->>App: Invoice created ✓
-    App->>App: Show celebration\n"भेज दिया! 🎉"
-    App->>API: POST /invoices/:id/share/whatsapp
-    API-->>C: WhatsApp invoice PDF
-```
+Implemented or launch-close areas:
 
----
+- Tenant boot, tenant lookup, RLS helpers, tenant-isolation tests.
+- Firebase auth, staff invite/revoke, RBAC/policy guards, audit log, logout-all.
+- Shop settings: profile, making charges, wastage, loyalty, rate-lock duration, try-at-home, custom-order policy, return policy, notification preferences, feature flags.
+- Inventory: products, barcode labels, CSV import, state machine, publish/unpublish, valuation, dead stock, stock movements, image upload/gallery management.
+- Pricing: current rates, history, manual override, provider adapter shape, decimal money/weight primitives.
+- Billing/compliance: invoices, estimates, GST/PAN/269ST/PMLA/HUID gates, payment recording, void/credit note, URD, GSTR CSV, invoice share URL, CTR/STR templates.
+- CRM: customers, family, notes, occasions, history, balances, consent, search, DPDPA deletion.
+- Loyalty: config, customer balances/transactions, adjustments, accrual hooks, summary reporting.
+- Bookings/orders: rate-lock, custom-orders, try-at-home backend and shopkeeper routes, customer-mobile booking/progress surfaces.
+- Reports/analytics: daily summary, outstanding, customer LTV, loyalty summary, GSTR CSV, product views, dead-stock screen.
+- Platform admin: tenant lifecycle basics, subscriptions, metrics, impersonation, export.
 
-### 2. Customer Discovery Loop (The Killer Feature)
+Partial or deferred areas:
 
-Women browse the jeweller's real inventory from home and reserve pieces — drives 20% more footfall.
+- Provider-backed notifications FR107-FR112 are deferred. Preferences and WhatsApp deep links exist, but no NotificationsModule/outbox/AiSensy/FCM pipeline exists.
+- Storefront enrichment FR127-FR140 is mostly missing: footer, trust strip, shipping/cancellation/FAQ/buying guides, sitemap/schema, collections/personas/recommendations/EMI, address book, referrals.
+- FR119 export-any-report as CSV/PDF is incomplete. GSTR CSV exists; broad branded CSV/PDF exports do not.
+- Viewing analytics is partial: product view capture exists, but hot/cold dashboards and per-customer browsing history are incomplete.
+- Sync/offline exists but push scope is limited mostly to products.
+- Tenant terminate/delete with 30-day recovery and global platform settings UI are not evidenced.
 
-```mermaid
-sequenceDiagram
-    participant M as Meena (Customer)
-    participant CApp as Customer App\n(branded as Sharma Jewellers)
-    participant API as Backend
-    participant R as Ravi (Shopkeeper)
-    participant SApp as Shopkeeper App
+## UI/UX Rules
 
-    Note over M: 10:47 PM, lying on charpoy\nbefore niece's engagement
+Shopkeeper UX is Hindi-first, senior-friendly, high contrast, and touch-first. Customer surfaces must feel like the jeweller's own premium storefront. Admin can be English and workmanlike. Customer-facing UI must never show the Goldsmith brand.
 
-    M->>CApp: Opens app
-    CApp->>API: GET /catalog/products\n(tenant from app branding)
-    API-->>CApp: Published inventory\n(only IN_STOCK + published pieces)
-    M->>CApp: Browses gold kadas
-    CApp-->>M: Shows real photos\nHUID, weight, LIVE price\n₹1,12,440 — calculated now
-    M->>CApp: Taps "मेरे लिए रखें"
-    CApp->>API: POST /catalog/reserve
-    API->>API: Mark product RESERVED
-    API-->>R: WhatsApp: "Meena Gupta ne\nyeh kada reserve kiya"
-    R->>SApp: Sees reservation in app
-    Note over R: Keeps kada on separate\ntray next morning
-    Note over M: Next morning walks in\npiece is waiting
-```
-
----
+Relevant source paths:
 
-### 3. Inventory Lifecycle
-
-```mermaid
-stateDiagram-v2
-    [*] --> IN_STOCK : Product created\n(HUID validated)
-    IN_STOCK --> RESERVED : Customer reserves\n(via app or counter)
-    IN_STOCK --> ON_APPROVAL : Sent home to try
-    IN_STOCK --> WITH_KARIGAR : Sent for repair
-    IN_STOCK --> SOLD : Sold (invoice created)
-    RESERVED --> IN_STOCK : Reservation cancelled
-    RESERVED --> SOLD : Customer buys
-    ON_APPROVAL --> IN_STOCK : Returned
-    ON_APPROVAL --> SOLD : Customer buys
-    WITH_KARIGAR --> IN_STOCK : Returns from karigar
-    SOLD --> [*] : Terminal\n(can be reversed\nonly by void invoice)
-```
+- Shopkeeper navigation: `apps/shopkeeper/app/(tabs)/_layout.tsx`, `apps/shopkeeper/app/(tabs)/more.tsx`, `apps/shopkeeper/app/inventory/index.tsx`.
+- Customer mobile profile timeline: `apps/customer-mobile/app/(tabs)/profile.tsx`, `apps/customer-mobile/src/components/timeline/*`.
+- Customer web storefront: `apps/customer-web/app/page.tsx`, `apps/customer-web/app/products/page.tsx`, `apps/customer-web/app/products/[id]/page.tsx`.
+- Design tokens: `packages/ui-tokens/src`, `packages/ui-mobile/src`, `packages/ui-web/src`.
 
----
+## Verification
 
-### 4. Compliance Decision Tree (Invoice Creation)
+Use these commands before claiming broad correctness:
 
-```mermaid
-flowchart TD
-    A[Shopkeeper taps\nGenerate Invoice] --> B{Hallmarked piece?}
-    B -->|Yes| C{HUID present?}
-    C -->|No| D[HARD BLOCK\nHUID ज़रूरी है\nFix Now CTA]
-    C -->|Yes| E{Invoice total\n≥ ₹2,00,000?}
-    B -->|No| E
-    E -->|Yes| F{PAN or\nForm 60 captured?}
-    F -->|No| G[PAN Prompt Sheet\nslides up]
-    G --> H[Customer provides PAN]
-    H --> I[PAN encrypted\nAES-256-GCM\nplaintext never stored]
-    I --> J
-    F -->|Yes| J{Cash payment\nportion?}
-    E -->|No| J
-    J -->|Yes| K{Daily cash total\n≥ ₹1,99,999?}
-    K -->|Yes| L[HARD BLOCK\n269ST Cash Cap\nSuggest UPI split]
-    L -->|OWNER override| M[Override logged\nin audit trail]
-    M --> N
-    K -->|No| N[Update PMLA\nmonthly aggregate]
-    N --> O{Monthly cash\n≥ ₹8L?}
-    O -->|Yes, <₹10L| P[Warn shopkeeper\nPMLA banner shown]
-    O -->|≥₹10L| Q[HARD BLOCK\nCTR template\nauto-generated]
-    O -->|No| R
-    P --> R[Invoice saved\nAudit logged\nInventory decremented]
-    R --> S[WhatsApp invoice\nshared with customer]
+```bash
+pnpm docs:context
+pnpm docs:validate
+pnpm typecheck
+pnpm lint
+pnpm test:unit
+pnpm test:integration
+pnpm test:tenant-isolation
+pnpm semgrep
 ```
 
----
-
-## Feature Map by Epic
-
-### Epic 1 — Authentication & Staff Management ✅
-- Firebase phone OTP login (no password)
-- Staff invite by OWNER → staff activates via OTP
-- Role-based access: OWNER / MANAGER / STAFF
-- Dynamic permissions (OWNER can grant/revoke specific actions)
-- Staff revocation (Firebase refresh tokens revoked immediately)
-- Immutable audit trail (every action logged, cannot be deleted)
-- Logout all devices
-
-### Epic 2 — Shop Settings ✅
-- Shop profile (name, address, GSTIN, logo)
-- Making charges by category (RINGS 12%, BRIDAL 15%, WHOLESALE 7% etc.)
-- Wastage percentage per category
-- Loyalty program tiers (Silver / Gold / Diamond with point earn/redeem rates)
-- Rate-lock duration (how long a quoted price is valid)
-- Try-at-home toggle + max pieces
-- Custom order policy, return policy
-- Notification preferences
-
-### Epic 3 — Inventory Management ✅
-- Add products: metal, purity, weight (DECIMAL 12,4 — never float), HUID, images
-- Barcode (Code 128) label printing — scan at billing counter
-- CSV bulk import (for anchor onboarding of 240+ existing pieces)
-- Product status state machine (IN_STOCK → RESERVED → SOLD etc.)
-- Publish/unpublish to customer app
-- **Offline sync** — WatermelonDB on device; sync within 30s on reconnect
-- Live stock valuation at today's gold rate
-- Stock movements ledger (PMLA-compliant, immutable, 5-year retention)
-- Meilisearch inventory search (Hindi + English transliteration)
-- Dead stock dashboard (pieces unsold > configurable threshold)
-
-### Epic 4 — Gold Rates ✅
-- IBJA auto-fetch every 15 minutes (primary rate source)
-- Metals.dev fallback with circuit breaker
-- Last-known-good cache (serves stale rates when both sources fail)
-- Manual rate override by OWNER (audit logged with reason)
-- Rate history chart (30 / 90 / 365 days)
-- Live rate widget on customer app home screen
-- Canonical pricing formula:
-  ```
-  total = (weight × rate) + making_charge + stone_charges
-          + GST_metal(3%) + GST_making(5%) + hallmark_fee
-  ```
-  All arithmetic via decimal.js — zero float usage enforced by Semgrep.
-
-### Epic 5 — Billing (Partial — in active development)
-- **Done:** B2C invoice creation with GST 3%+5%, HUID validation
-- **Done:** Making charges from shop settings (category-aware)
-- **Done:** PAN Rule 114B — hard block at ₹2L, PAN encrypted (AES-256-GCM)
-- **Done:** Section 269ST — cash cap hard block at ₹1,99,999/day/customer
-- **Done:** PMLA cumulative tracking — warn at ₹8L, block at ₹10L + CTR auto-generate
-- **Done:** B2B wholesale invoice (GSTIN validation, CGST/SGST vs IGST treatment)
-- **Done:** Invoice void within 24h (OWNER only) + credit note after window
-- **In progress:** Razorpay split payment (cash + UPI + card + old-gold)
-- **In progress:** URD old-gold purchase with RCM self-invoice (3% GST, jeweller's liability)
-- **Planned:** Invoice PDF + WhatsApp share (tenant-branded)
-- **Planned:** GSTR-1 / GSTR-3B CSV export
-- **Planned:** End-to-end integration test (anchor first invoice in < 90 seconds)
-
-### Epic 6 — Customer CRM (In active development)
-- Customer records: phone (primary key per shop), name, PAN encrypted, address, DOB year
-- Family links (mother↔daughter, spouse↔spouse etc. — for bridal context)
-- Purchase history across all staff and dates
-- Credit balance (outstanding dues + advance payments)
-- Private notes per customer (staff-visible, author-controlled delete)
-- Occasions (birthday, anniversary) with 7-day-before WhatsApp reminders
-- Customer search (Meilisearch with Hindi/English transliteration, masked phone)
-- DPDPA-compliant data deletion workflow
-
-### Epic 7 — Customer App (Planned)
-- Product catalog (browse by metal, weight, price, occasion)
-- Live gold rate widget on home
-- Product reservation ("मेरे लिए रखें")
-- Invoice viewing (customer's own purchase history)
-- WhatsApp-first sharing (product links, invoice PDFs)
-- Mobile web first (no app install required for discovery)
-
-### Epics 8–16 — Planned
-| Epic | Feature |
-|------|---------|
-| 8 | Loyalty accrual + redemption |
-| 9 | Rate-lock (quote valid for N days, price guaranteed) |
-| 10 | Custom orders (design, karigar workflow, deposit, delivery) |
-| 11 | Try-at-home workflow (piece goes home, returns or converts to sale) |
-| 12 | Walk-in context (customer history shown when they arrive) |
-| 13 | WhatsApp notifications (AiSensy BSP — occasion reminders, invoice share, rate alerts) |
-| 14 | Analytics + reports (shopkeeper intelligence dashboard) |
-| 15 | Platform admin (onboard new jewellers, tenant provisioning) |
-| 16 | Multi-store (single owner, multiple shop locations) |
-
----
-
-## Key Compliance Rules (Platform-Enforced, Not Configurable)
-
-| Rule | Threshold | Action |
-|------|-----------|--------|
-| Section 269ST | Cash ≥ ₹1,99,999 in single transaction/day | Hard block — suggest UPI |
-| PAN Rule 114B | Invoice total ≥ ₹2,00,000 | Hard block — collect PAN or Form 60 |
-| PMLA Warning | Monthly cash per customer ≥ ₹8,00,000 | Shopkeeper warned |
-| PMLA Block | Monthly cash per customer ≥ ₹10,00,000 | Hard block + CTR template auto-generated |
-| GST rates | Metal 3%, Making 5% | Hardcoded — not editable |
-| HUID | All hallmarked pieces | Required on every invoice line |
-| Weight precision | All weight columns | DECIMAL(12,4) — never float |
-
----
-
-## What Makes This Defensible
-
-1. **Compliance automation** — 269ST, PAN, PMLA, HUID are hard-blocks enforced by the system. The jeweller cannot accidentally violate them. Competitors (Tally, Vyapar) require manual discipline.
-
-2. **Multi-tenant RLS** — Row-level security in PostgreSQL ensures zero cross-tenant data leakage. Scales to N jewellers with no per-tenant infrastructure.
-
-3. **Hindi-first UX** — Built for a 50-year-old Ayodhya jeweller, not translated English. 48dp touch targets, 16pt minimum font, high contrast.
-
-4. **Customer discovery loop** — Women browse real inventory from home at night, reserve pieces. No competitor does this for tier-2/3 Hindi-belt jewellers.
-
-5. **White-label** — Every jeweller's customers see only their brand. Goldsmith is invisible to end customers.
+CI is `.github/workflows/ship.yml`. It includes typecheck, lint, unit, integration, tenant isolation, Semgrep, shopkeeper config/typecheck, shopkeeper a11y/unit test, Maestro YAML validation, Lighthouse stub, docs validation, and build.
diff --git a/package.json b/package.json
index 698307d..b949c0f 100644
--- a/package.json
+++ b/package.json
@@ -9,7 +9,7 @@
     "lint": "turbo run lint",
     "test": "turbo run test",
     "test:unit": "turbo run test:unit",
-    "test:integration": "turbo run test:integration",
+    "test:integration": "turbo run test:integration --concurrency=1",
     "test:tenant-isolation": "turbo run test:tenant-isolation",
     "build": "turbo run build",
     "db:reset": "bash scripts/db-reset.sh",
@@ -17,7 +17,7 @@
     "db:assert-marked": "tsx packages/db/src/codegen/assert-all-tables-marked.ts",
     "semgrep": "semgrep --config ops/semgrep/ --error",
     "seed:anchor": "tsx scripts/seed-anchor.ts",
-    "docs:context": "tsx scripts/docs/scan-repo-context.ts && tsx scripts/docs/extract-adrs.ts && tsx scripts/docs/extract-bmad-trace.ts && tsx scripts/docs/scan-docs.ts && tsx scripts/docs/extract-acceptance.ts",
+    "docs:context": "tsx scripts/docs/scan-repo-context.ts && tsx scripts/docs/scan-implementation-map.ts && tsx scripts/docs/scan-current-state.ts && tsx scripts/docs/extract-adrs.ts && tsx scripts/docs/extract-bmad-trace.ts && tsx scripts/docs/scan-docs.ts && tsx scripts/docs/extract-acceptance.ts",
     "docs:validate": "tsx scripts/docs/validate-agent-context.ts",
     "test:ci": "pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration && pnpm test:tenant-isolation && pnpm semgrep && pnpm docs:validate"
   },
diff --git a/packages/db/package.json b/packages/db/package.json
index fecd5ee..6fdefbb 100644
--- a/packages/db/package.json
+++ b/packages/db/package.json
@@ -17,7 +17,7 @@
     "lint": "eslint src test",
     "test": "vitest run",
     "test:unit": "vitest run --dir src",
-    "test:integration": "vitest run --dir test",
+    "test:integration": "vitest run --dir test --no-file-parallelism",
     "db:assert-marked": "tsx src/codegen/assert-all-tables-marked.ts"
   },
   "dependencies": {
diff --git a/packages/db/test/poison-default.integration.test.ts b/packages/db/test/poison-default.integration.test.ts
index 4a8d786..40df20d 100644
--- a/packages/db/test/poison-default.integration.test.ts
+++ b/packages/db/test/poison-default.integration.test.ts
@@ -25,7 +25,7 @@ beforeAll(async () => {
     GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
   `);
   c.release();
-}, 60_000);
+}, 180_000);
 
 afterAll(async () => {
   await pool?.end();
diff --git a/packages/db/test/with-tenant-tx.integration.test.ts b/packages/db/test/with-tenant-tx.integration.test.ts
index e15f732..8377289 100644
--- a/packages/db/test/with-tenant-tx.integration.test.ts
+++ b/packages/db/test/with-tenant-tx.integration.test.ts
@@ -35,7 +35,7 @@ beforeAll(async () => {
     RESET ROLE;
   `);
   c.release();
-}, 60_000);
+}, 180_000);
 
 afterAll(async () => { await pool?.end(); await container?.stop(); });
 
diff --git a/packages/sync/package.json b/packages/sync/package.json
index 68441ee..28ea25e 100644
--- a/packages/sync/package.json
+++ b/packages/sync/package.json
@@ -16,7 +16,7 @@
     "typecheck": "tsc --noEmit",
     "lint": "eslint src test",
     "test": "vitest run",
-    "test:integration": "vitest run --dir test/integration"
+    "test:integration": "vitest run --dir test/integration --no-file-parallelism"
   },
   "dependencies": {
     "@goldsmith/db": "workspace:*",
diff --git a/packages/sync/test/integration/adr-0004-conformance.test.ts b/packages/sync/test/integration/adr-0004-conformance.test.ts
index 731eb5d..e3c0000 100644
--- a/packages/sync/test/integration/adr-0004-conformance.test.ts
+++ b/packages/sync/test/integration/adr-0004-conformance.test.ts
@@ -34,7 +34,7 @@ beforeAll(async () => {
     `INSERT INTO tenant_sync_cursors (shop_id, cursor) VALUES ($1, 0)`,
     [SHOP_A],
   );
-}, 120_000);
+}, 180_000);
 
 afterAll(async () => {
   await pool?.end();
diff --git a/packages/sync/test/integration/sync-cycle.integration.test.ts b/packages/sync/test/integration/sync-cycle.integration.test.ts
index fab8210..09e769e 100644
--- a/packages/sync/test/integration/sync-cycle.integration.test.ts
+++ b/packages/sync/test/integration/sync-cycle.integration.test.ts
@@ -36,7 +36,7 @@ beforeAll(async () => {
     `INSERT INTO tenant_sync_cursors (shop_id, cursor) VALUES ($1, 0)`,
     [SHOP_ID],
   );
-}, 120_000);
+}, 180_000);
 
 afterAll(async () => {
   await pool?.end();
diff --git a/packages/sync/test/integration/tenant-isolation.integration.test.ts b/packages/sync/test/integration/tenant-isolation.integration.test.ts
index af8d7ef..dae2855 100644
--- a/packages/sync/test/integration/tenant-isolation.integration.test.ts
+++ b/packages/sync/test/integration/tenant-isolation.integration.test.ts
@@ -63,7 +63,7 @@ beforeAll(async () => {
       await syncLogger.logInTx(tx, SHOP_A, 'products', PRODUCT_A, 'INSERT', { id: PRODUCT_A });
     }),
   );
-}, 120_000);
+}, 180_000);
 
 afterAll(async () => {
   await pool?.end();
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 14a52f9..289e3ef 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -30,10 +30,10 @@ importers:
         version: 8.57.1
       eslint-import-resolver-typescript:
         specifier: ^3.6.1
-        version: 3.10.1(eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1))(eslint@8.57.1)
+        version: 3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1)
       eslint-plugin-import:
         specifier: ^2.29.1
-        version: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1)
+        version: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1)
       fast-glob:
         specifier: ^3.3.2
         version: 3.3.3
@@ -229,7 +229,7 @@ importers:
     dependencies:
       '@expo/metro-runtime':
         specifier: ~3.2.3
-        version: 3.2.3(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+        version: 3.2.3(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
       '@expo/vector-icons':
         specifier: ~14.0.0
         version: 14.0.4
@@ -239,6 +239,9 @@ importers:
       '@goldsmith/i18n':
         specifier: workspace:*
         version: link:../../packages/i18n
+      '@goldsmith/money':
+        specifier: workspace:*
+        version: link:../../packages/money
       '@goldsmith/shared':
         specifier: workspace:*
         version: link:../../packages/shared
@@ -250,16 +253,19 @@ importers:
         version: link:../../packages/ui-tokens
       '@react-native-async-storage/async-storage':
         specifier: 1.23.1
-        version: 1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+        version: 1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
       '@react-native-firebase/app':
         specifier: ^21.0.0
-        version: 21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        version: 21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       '@react-native-firebase/auth':
         specifier: ^21.0.0
-        version: 21.14.0(@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
+        version: 21.14.0(@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       '@react-navigation/native':
-        specifier: ^7.2.2
-        version: 7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: ^6.1.18
+        version: 6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@tanstack/query-core':
+        specifier: 5.99.2
+        version: 5.99.2
       '@tanstack/react-query':
         specifier: ^5.0.0
         version: 5.99.2(react@18.2.0)
@@ -285,11 +291,14 @@ importers:
         specifier: ~13.0.1
         version: 13.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-image:
-        specifier: ^55.0.9
-        version: 55.0.9(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native-web@0.19.13(react-dom@18.2.0(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: ~1.13.0
+        version: 1.13.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
+      expo-linking:
+        specifier: ~6.3.1
+        version: 6.3.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-router:
         specifier: ~3.5.0
-        version: 3.5.24(3uvatxgwuo3u64yzrd3pvxnccy)
+        version: 3.5.24(cquuc5ycyjexai4b474uj66fie)
       expo-secure-store:
         specifier: ~13.0.2
         version: 13.0.2(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
@@ -301,7 +310,10 @@ importers:
         version: 1.12.1
       nativewind:
         specifier: ^4.0.36
-        version: 4.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3))
+        version: 4.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3))
+      prop-types:
+        specifier: ^15.8.1
+        version: 15.8.1
       react:
         specifier: 18.2.0
         version: 18.2.0
@@ -309,20 +321,23 @@ importers:
         specifier: 18.2.0
         version: 18.2.0(react@18.2.0)
       react-native:
-        specifier: 0.74.0
-        version: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+        specifier: 0.74.5
+        version: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native-gesture-handler:
+        specifier: ~2.16.1
+        version: 2.16.2(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-reanimated:
         specifier: ~3.10.1
-        version: 3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        version: 3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-safe-area-context:
-        specifier: 4.10.0
-        version: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: 4.10.5
+        version: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-screens:
-        specifier: 3.31.0
-        version: 3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: 3.31.1
+        version: 3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-svg:
-        specifier: ^15.2.0
-        version: 15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: 15.2.0
+        version: 15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-web:
         specifier: ~0.19.0
         version: 0.19.13(react-dom@18.2.0(react@18.2.0))(react@18.2.0)
@@ -352,8 +367,8 @@ importers:
         specifier: ^24.0.0
         version: 24.1.3
       typescript:
-        specifier: ^5.4.0
-        version: 5.9.3
+        specifier: ~5.3.3
+        version: 5.3.3
       vitest:
         specifier: ^1.6.0
         version: 1.6.1(@types/node@20.19.39)(jsdom@24.1.3)(lightningcss@1.27.0)(terser@5.46.1)
@@ -377,7 +392,7 @@ importers:
         version: 2.1.1
       firebase:
         specifier: ^11.0.0
-        version: 11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
+        version: 11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
       next:
         specifier: 14.2.3
         version: 14.2.3(@babel/core@7.29.0)(@opentelemetry/api@1.9.1)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
@@ -423,7 +438,7 @@ importers:
     dependencies:
       '@expo/metro-runtime':
         specifier: ~3.2.3
-        version: 3.2.3(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+        version: 3.2.3(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
       '@expo/vector-icons':
         specifier: ~14.0.0
         version: 14.0.4
@@ -436,6 +451,9 @@ importers:
       '@goldsmith/i18n':
         specifier: workspace:*
         version: link:../../packages/i18n
+      '@goldsmith/money':
+        specifier: workspace:*
+        version: link:../../packages/money
       '@goldsmith/shared':
         specifier: workspace:*
         version: link:../../packages/shared
@@ -453,22 +471,25 @@ importers:
         version: 0.27.1
       '@react-native-async-storage/async-storage':
         specifier: 1.23.1
-        version: 1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+        version: 1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
       '@react-native-community/netinfo':
-        specifier: ^11.3.1
-        version: 11.5.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: 11.3.1
+        version: 11.3.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
       '@react-native-firebase/app':
         specifier: ^21.0.0
-        version: 21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        version: 21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       '@react-native-firebase/auth':
         specifier: ^21.0.0
-        version: 21.14.0(@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
+        version: 21.14.0(@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       '@react-navigation/native':
-        specifier: ^7.2.2
-        version: 7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: ^6.1.18
+        version: 6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       '@react-navigation/native-stack':
-        specifier: ^7.14.12
-        version: 7.14.12(@react-navigation/native@7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: ^6.9.26
+        version: 6.9.26(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@tanstack/query-core':
+        specifier: 5.99.2
+        version: 5.99.2
       '@tanstack/react-query':
         specifier: ^5.0.0
         version: 5.99.2(react@18.2.0)
@@ -485,8 +506,8 @@ importers:
         specifier: ~4.0.0
         version: 4.0.29(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-document-picker:
-        specifier: ~11.7.0
-        version: 11.7.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
+        specifier: ~12.0.2
+        version: 12.0.2(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-font:
         specifier: ~12.0.0
         version: 12.0.10(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
@@ -494,17 +515,20 @@ importers:
         specifier: ~13.0.1
         version: 13.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-image:
-        specifier: ^55.0.9
-        version: 55.0.9(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native-web@0.19.13(react-dom@18.2.0(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: ~1.13.0
+        version: 1.13.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-image-picker:
-        specifier: ^55.0.19
-        version: 55.0.19(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
+        specifier: ~15.1.0
+        version: 15.1.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
+      expo-linking:
+        specifier: ~6.3.1
+        version: 6.3.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-print:
         specifier: ~13.0.0
         version: 13.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-router:
         specifier: ~3.5.0
-        version: 3.5.24(3uvatxgwuo3u64yzrd3pvxnccy)
+        version: 3.5.24(cquuc5ycyjexai4b474uj66fie)
       expo-splash-screen:
         specifier: ~0.27.0
         version: 0.27.7(expo-modules-autolinking@1.11.3)(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
@@ -513,7 +537,10 @@ importers:
         version: 1.12.1
       posthog-react-native:
         specifier: ^3.0.0
-        version: 3.16.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(@react-navigation/native@7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo-file-system@17.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))
+        version: 3.16.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo-file-system@17.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))
+      prop-types:
+        specifier: ^15.8.1
+        version: 15.8.1
       react:
         specifier: 18.2.0
         version: 18.2.0
@@ -521,20 +548,26 @@ importers:
         specifier: 18.2.0
         version: 18.2.0(react@18.2.0)
       react-native:
-        specifier: 0.74.0
-        version: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+        specifier: 0.74.5
+        version: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
       react-native-draggable-flatlist:
         specifier: ^4.0.3
-        version: 4.0.3(@babel/core@7.29.0)(react-native-gesture-handler@2.31.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+        version: 4.0.3(@babel/core@7.29.0)(react-native-gesture-handler@2.16.2(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+      react-native-gesture-handler:
+        specifier: ~2.16.1
+        version: 2.16.2(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-reanimated:
+        specifier: ~3.10.1
+        version: 3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-safe-area-context:
-        specifier: 4.10.0
-        version: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: 4.10.5
+        version: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-screens:
-        specifier: 3.31.0
-        version: 3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: 3.31.1
+        version: 3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-svg:
-        specifier: ^15.2.0
-        version: 15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+        specifier: 15.2.0
+        version: 15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react-native-web:
         specifier: ~0.19.0
         version: 0.19.13(react-dom@18.2.0(react@18.2.0))(react@18.2.0)
@@ -567,8 +600,8 @@ importers:
         specifier: ^24.0.0
         version: 24.1.3
       typescript:
-        specifier: ^5.4.0
-        version: 5.9.3
+        specifier: ~5.3.3
+        version: 5.3.3
       vitest:
         specifier: ^1.6.0
         version: 1.6.1(@types/node@22.19.17)(jsdom@24.1.3)(lightningcss@1.27.0)(terser@5.46.1)
@@ -2524,7 +2557,7 @@ packages:
 
   '@expo/bunyan@4.0.1':
     resolution: {integrity: sha512-+Lla7nYSiHZirgK+U/uYzsLv/X+HaJienbD5AKX1UQZHYfWaP+9uuQluRB4GrEVWF0GZ7vEVp/jzaOT9k/SQlg==}
-    engines: {'0': node >=0.10.0}
+    engines: {node: '>=0.10.0'}
 
   '@expo/cli@0.18.31':
     resolution: {integrity: sha512-v9llw9fT3Uv+TCM6Xllo54t672CuYtinEQZ2LPJ2EJsCwuTc4Cd2gXQaouuIVD21VoeGQnr5JtJuWbF97sBKzQ==}
@@ -2533,21 +2566,12 @@ packages:
   '@expo/code-signing-certificates@0.0.5':
     resolution: {integrity: sha512-BNhXkY1bblxKZpltzAx98G2Egj9g1Q+JRcvR7E99DOj862FTCX+ZPsAUtPTr7aHxwtrL7+fL3r0JSmM9kBm+Bw==}
 
-  '@expo/config-plugins@55.0.8':
-    resolution: {integrity: sha512-8WfWTRntTCcowfOS+tHdB0z98gKetTwktg4G5TWkCkXVa8Jt1NUnvzaaU4UHk2vbR2U4N84RyZJFizSwfF6C9g==}
-
   '@expo/config-plugins@8.0.11':
     resolution: {integrity: sha512-oALE1HwnLFthrobAcC9ocnR9KXLzfWEjgIe4CPe+rDsfC6GDs8dGYCXfRFoCEzoLN4TGYs9RdZ8r0KoCcNrm2A==}
 
   '@expo/config-types@51.0.3':
     resolution: {integrity: sha512-hMfuq++b8VySb+m9uNNrlpbvGxYc8OcFCUX9yTmi9tlx6A4k8SDabWFBgmnr4ao3wEArvWrtUQIfQCVtPRdpKA==}
 
-  '@expo/config-types@55.0.5':
-    resolution: {integrity: sha512-sCmSUZG4mZ/ySXvfyyBdhjivz8Q539X1NondwDdYG7s3SBsk+wsgPJzYsqgAG/P9+l0xWjUD2F+kQ1cAJ6NNLg==}
-
-  '@expo/config@55.0.15':
-    resolution: {integrity: sha512-lHc0ELIQ8126jYOMZpLv3WIuvordW98jFg5aT/J1/12n2ycuXu01XLZkJsdw0avO34cusUYb1It+MvY8JiMduA==}
-
   '@expo/config@9.0.4':
     resolution: {integrity: sha512-g5ns5u1JSKudHYhjo1zaSfkJ/iZIcWmUmIQptMJZ6ag1C0ShL2sj8qdfU8MmAMuKLOgcIfSaiWlQnm4X3VJVkg==}
 
@@ -2557,10 +2581,6 @@ packages:
   '@expo/env@0.3.0':
     resolution: {integrity: sha512-OtB9XVHWaXidLbHvrVDeeXa09yvTl3+IQN884sO6PhIi2/StXfgSH/9zC7IvzrDB8kW3EBJ1PPLuCUJ2hxAT7Q==}
 
-  '@expo/env@2.1.1':
-    resolution: {integrity: sha512-rVvHC4I6xlPcg+mAO09ydUi2Wjv1ZytpLmHOSzvXzBAz9mMrJggqCe4s4dubjJvi/Ino/xQCLhbaLCnTtLpikg==}
-    engines: {node: '>=20.12.0'}
-
   '@expo/image-utils@0.5.1':
     resolution: {integrity: sha512-U/GsFfFox88lXULmFJ9Shfl2aQGcwoKPF7fawSCLixIKtMCpsI+1r0h+5i0nQnmt9tHuzXZDL8+Dg1z6OhkI9A==}
 
@@ -2588,22 +2608,11 @@ packages:
   '@expo/plist@0.1.3':
     resolution: {integrity: sha512-GW/7hVlAylYg1tUrEASclw1MMk9FP4ZwyFAY/SUTJIhPDQHtfOlXREyWV3hhrHdX/K+pS73GNgdfT6E/e+kBbg==}
 
-  '@expo/plist@0.5.2':
-    resolution: {integrity: sha512-o4xdVdBpe4aTl3sPMZ2u3fJH4iG1I768EIRk1xRZP+GaFI93MaR3JvoFibYqxeTmLQ1p1kNEVqylfUjezxx45g==}
-
   '@expo/prebuild-config@7.0.9':
     resolution: {integrity: sha512-9i6Cg7jInpnGEHN0jxnW0P+0BexnePiBzmbUvzSbRXpdXihYUX2AKMu73jgzxn5P1hXOSkzNS7umaY+BZ+aBag==}
     peerDependencies:
       expo-modules-autolinking: '>=0.8.1'
 
-  '@expo/require-utils@55.0.4':
-    resolution: {integrity: sha512-JAANvXqV7MOysWeVWgaiDzikoyDjJWOV/ulOW60Zb3kXJfrx2oZOtGtDXDFKD1mXuahQgoM5QOjuZhF7gFRNjA==}
-    peerDependencies:
-      typescript: ^5.0.0 || ^5.0.0-0
-    peerDependenciesMeta:
-      typescript:
-        optional: true
-
   '@expo/rudder-sdk-node@1.1.1':
     resolution: {integrity: sha512-uy/hS/awclDJ1S88w9UGpc6Nm9XnNUjzOAAib1A3PVAnGQIwebg8DpFqOthFBTlZxeuV/BKbZ5jmTbtNZkp1WQ==}
     engines: {node: '>=12'}
@@ -4019,45 +4028,82 @@ packages:
   '@react-native-community/cli-clean@13.6.4':
     resolution: {integrity: sha512-nS1BJ+2Z+aLmqePxB4AYgJ+C/bgQt02xAgSYtCUv+lneRBGhL2tHRrK8/Iolp0y+yQoUtHHf4txYi90zGXLVfw==}
 
+  '@react-native-community/cli-clean@13.6.9':
+    resolution: {integrity: sha512-7Dj5+4p9JggxuVNOjPbduZBAP1SUgNhLKVw5noBUzT/3ZpUZkDM+RCSwyoyg8xKWoE4OrdUAXwAFlMcFDPKykA==}
+
   '@react-native-community/cli-config@13.6.4':
     resolution: {integrity: sha512-GGK415WoTx1R9FXtfb/cTnan9JIWwSm+a5UCuFd6+suzS0oIt1Md1vCzjNh6W1CK3b43rZC2e+3ZU7Ljd7YtyQ==}
 
+  '@react-native-community/cli-config@13.6.9':
+    resolution: {integrity: sha512-rFfVBcNojcMm+KKHE/xqpqXg8HoKl4EC7bFHUrahMJ+y/tZll55+oX/PGG37rzB8QzP2UbMQ19DYQKC1G7kXeg==}
+
   '@react-native-community/cli-debugger-ui@13.6.4':
     resolution: {integrity: sha512-9Gs31s6tA1kuEo69ay9qLgM3x2gsN/RI994DCUKnFSW+qSusQJyyrmfllR2mGU3Wl1W09/nYpIg87W9JPf5y4A==}
 
+  '@react-native-community/cli-debugger-ui@13.6.9':
+    resolution: {integrity: sha512-TkN7IdFmGPPvTpAo3nCAH9uwGCPxWBEAwpqEZDrq0NWllI7Tdie8vDpGdrcuCcKalmhq6OYnkXzeBah7O1Ztpw==}
+
   '@react-native-community/cli-doctor@13.6.4':
     resolution: {integrity: sha512-lWOXCISH/cHtLvO0cWTr+IPSzA54FewVOw7MoCMEvWusH+1n7c3hXTAve78mLozGQ7iuUufkHFWwKf3dzOkflQ==}
 
+  '@react-native-community/cli-doctor@13.6.9':
+    resolution: {integrity: sha512-5quFaLdWFQB+677GXh5dGU9I5eg2z6Vg4jOX9vKnc9IffwyIFAyJfCZHrxLSRPDGNXD7biDQUdoezXYGwb6P/A==}
+
   '@react-native-community/cli-hermes@13.6.4':
     resolution: {integrity: sha512-VIAufA/2wTccbMYBT9o+mQs9baOEpTxCiIdWeVdkPWKzIwtKsLpDZJlUqj4r4rI66mwjFyQ60PhwSzEJ2ApFeQ==}
 
+  '@react-native-community/cli-hermes@13.6.9':
+    resolution: {integrity: sha512-GvwiwgvFw4Ws+krg2+gYj8sR3g05evmNjAHkKIKMkDTJjZ8EdyxbkifRUs1ZCq3TMZy2oeblZBXCJVOH4W7ZbA==}
+
   '@react-native-community/cli-platform-android@13.6.4':
     resolution: {integrity: sha512-WhknYwIobKKCqaGCN3BzZEQHTbaZTDiGvcXzevvN867ldfaGdtbH0DVqNunbPoV1RNzeV9qKoQHFdWBkg83tpg==}
 
+  '@react-native-community/cli-platform-android@13.6.9':
+    resolution: {integrity: sha512-9KsYGdr08QhdvT3Ht7e8phQB3gDX9Fs427NJe0xnoBh+PDPTI2BD5ks5ttsH8CzEw8/P6H8tJCHq6hf2nxd9cw==}
+
   '@react-native-community/cli-platform-apple@13.6.4':
     resolution: {integrity: sha512-TLBiotdIz0veLbmvNQIdUv9fkBx7m34ANGYqr5nH7TFxdmey+Z+omoBqG/HGpvyR7d0AY+kZzzV4k+HkYHM/aQ==}
 
+  '@react-native-community/cli-platform-apple@13.6.9':
+    resolution: {integrity: sha512-KoeIHfhxMhKXZPXmhQdl6EE+jGKWwoO9jUVWgBvibpVmsNjo7woaG/tfJMEWfWF3najX1EkQAoJWpCDBMYWtlA==}
+
   '@react-native-community/cli-platform-ios@13.6.4':
     resolution: {integrity: sha512-8Dlva8RY+MY5nhWAj6V7voG3+JOEzDTJmD0FHqL+4p0srvr9v7IEVcxfw5lKBDIUNd0OMAHNevGA+cyz1J60jg==}
 
+  '@react-native-community/cli-platform-ios@13.6.9':
+    resolution: {integrity: sha512-CiUcHlGs8vE0CAB4oi1f+dzniqfGuhWPNrDvae2nm8dewlahTBwIcK5CawyGezjcJoeQhjBflh9vloska+nlnw==}
+
   '@react-native-community/cli-server-api@13.6.4':
     resolution: {integrity: sha512-D2qSuYCFwrrUJUM0SDc9l3lEhU02yjf+9Peri/xhspzAhALnsf6Z/H7BCjddMV42g9/eY33LqiGyN5chr83a+g==}
 
+  '@react-native-community/cli-server-api@13.6.9':
+    resolution: {integrity: sha512-W8FSlCPWymO+tlQfM3E0JmM8Oei5HZsIk5S0COOl0MRi8h0NmHI4WSTF2GCfbFZkcr2VI/fRsocoN8Au4EZAug==}
+
   '@react-native-community/cli-tools@13.6.4':
     resolution: {integrity: sha512-N4oHLLbeTdg8opqJozjClmuTfazo1Mt+oxU7mr7m45VCsFgBqTF70Uwad289TM/3l44PP679NRMAHVYqpIRYtQ==}
 
+  '@react-native-community/cli-tools@13.6.9':
+    resolution: {integrity: sha512-OXaSjoN0mZVw3nrAwcY1PC0uMfyTd9fz7Cy06dh+EJc+h0wikABsVRzV8cIOPrVV+PPEEXE0DBrH20T2puZzgQ==}
+
   '@react-native-community/cli-types@13.6.4':
     resolution: {integrity: sha512-NxGCNs4eYtVC8x0wj0jJ/MZLRy8C+B9l8lY8kShuAcvWTv5JXRqmXjg8uK1aA+xikPh0maq4cc/zLw1roroY/A==}
 
+  '@react-native-community/cli-types@13.6.9':
+    resolution: {integrity: sha512-RLxDppvRxXfs3hxceW/mShi+6o5yS+kFPnPqZTaMKKR5aSg7LwDpLQW4K2D22irEG8e6RKDkZUeH9aL3vO2O0w==}
+
   '@react-native-community/cli@13.6.4':
     resolution: {integrity: sha512-V7rt2N5JY7M4dJFgdNfR164r3hZdR/Z7V54dv85TFQHRbdwF4QrkG+GeagAU54qrkK/OU8OH3AF2+mKuiNWpGA==}
     engines: {node: '>=18'}
     hasBin: true
 
-  '@react-native-community/netinfo@11.5.2':
-    resolution: {integrity: sha512-/g0m65BtX9HU+bPiCH2517bOHpEIUsGrWFXDzi1a5nNKn5KujQgm04WhL7/OSXWKHyrT8VVtUoJA0XKRxueBpQ==}
+  '@react-native-community/cli@13.6.9':
+    resolution: {integrity: sha512-hFJL4cgLPxncJJd/epQ4dHnMg5Jy/7Q56jFvA3MHViuKpzzfTCJCB+pGY54maZbtym53UJON9WTGpM3S81UfjQ==}
+    engines: {node: '>=18'}
+    hasBin: true
+
+  '@react-native-community/netinfo@11.3.1':
+    resolution: {integrity: sha512-UBnJxyV0b7i9Moa97Av+HKho1ByzX0DtbJXzUQS5E3xhQs6P2D/Os0iw3ouy7joY1TVd6uIhplPbr7l1SJNaNQ==}
     peerDependencies:
-      react: '*'
       react-native: '>=0.59'
 
   '@react-native-firebase/app@21.14.0':
@@ -4083,6 +4129,10 @@ packages:
     resolution: {integrity: sha512-ms+D6pJ6l30epm53pwnAislW79LEUHJxWfe1Cu0LWyTTBlg1OFoqXfB3eIbpe4WyH3nrlkQAh0yyk4huT2mCvw==}
     engines: {node: '>=18'}
 
+  '@react-native/assets-registry@0.74.87':
+    resolution: {integrity: sha512-1XmRhqQchN+pXPKEKYdpJlwESxVomJOxtEnIkbo7GAlaN2sym84fHEGDXAjLilih5GVPpcpSmFzTy8jx3LtaFg==}
+    engines: {node: '>=18'}
+
   '@react-native/babel-plugin-codegen@0.74.81':
     resolution: {integrity: sha512-Bj6g5/xkLMBAdC6665TbD3uCKCQSmLQpGv3gyqya/ydZpv3dDmDXfkGmO4fqTwEMunzu09Sk55st2ipmuXAaAg==}
     engines: {node: '>=18'}
@@ -4119,6 +4169,10 @@ packages:
     resolution: {integrity: sha512-ezPOwPxbDgrBZLJJMcXryXJXjv3VWt+Mt4jRZiEtvy6pAoi2owSH0b178T5cEZaWsxQN0BbyJ7F/xJsNiF4z0Q==}
     engines: {node: '>=18'}
 
+  '@react-native/community-cli-plugin@0.74.87':
+    resolution: {integrity: sha512-EgJG9lSr8x3X67dHQKQvU6EkO+3ksVlJHYIVv6U/AmW9dN80BEFxgYbSJ7icXS4wri7m4kHdgeq2PQ7/3vvrTQ==}
+    engines: {node: '>=18'}
+
   '@react-native/debugger-frontend@0.74.81':
     resolution: {integrity: sha512-HCYF1/88AfixG75558HkNh9wcvGweRaSZGBA71KoZj03umXM8XJy0/ZpacGOml2Fwiqpil72gi6uU+rypcc/vw==}
     engines: {node: '>=18'}
@@ -4127,6 +4181,10 @@ packages:
     resolution: {integrity: sha512-gUIhhpsYLUTYWlWw4vGztyHaX/kNlgVspSvKe2XaPA7o3jYKUoNLc3Ov7u70u/MBWfKdcEffWq44eSe3j3s5JQ==}
     engines: {node: '>=18'}
 
+  '@react-native/debugger-frontend@0.74.87':
+    resolution: {integrity: sha512-MN95DJLYTv4EqJc+9JajA3AJZSBYJz2QEJ3uWlHrOky2vKrbbRVaW1ityTmaZa2OXIvNc6CZwSRSE7xCoHbXhQ==}
+    engines: {node: '>=18'}
+
   '@react-native/dev-middleware@0.74.81':
     resolution: {integrity: sha512-x2IpvUJN1LJE0WmPsSfQIbQaa9xwH+2VDFOUrzuO9cbQap8rNfZpcvVNbrZgrlKbgS4LXbbsj6VSL8b6SnMKMA==}
     engines: {node: '>=18'}
@@ -4135,26 +4193,47 @@ packages:
     resolution: {integrity: sha512-BRmgCK5vnMmHaKRO+h8PKJmHHH3E6JFuerrcfE3wG2eZ1bcSr+QTu8DAlpxsDWvJvHpCi8tRJGauxd+Ssj/c7w==}
     engines: {node: '>=18'}
 
+  '@react-native/dev-middleware@0.74.87':
+    resolution: {integrity: sha512-7TmZ3hTHwooYgIHqc/z87BMe1ryrIqAUi+AF7vsD+EHCGxHFdMjSpf1BZ2SUPXuLnF2cTiTfV2RwhbPzx0tYIA==}
+    engines: {node: '>=18'}
+
   '@react-native/gradle-plugin@0.74.81':
     resolution: {integrity: sha512-7YQ4TLnqfe2kplWWzBWO6k0rPSrWEbuEiRXSJNZQCtCk+t2YX985G62p/9jWm3sGLN4UTcpDXaFNTTPBvlycoQ==}
     engines: {node: '>=18'}
 
+  '@react-native/gradle-plugin@0.74.87':
+    resolution: {integrity: sha512-T+VX0N1qP+U9V4oAtn7FTX7pfsoVkd1ocyw9swYXgJqU2fK7hC9famW7b3s3ZiufPGPr1VPJe2TVGtSopBjL6A==}
+    engines: {node: '>=18'}
+
   '@react-native/js-polyfills@0.74.81':
     resolution: {integrity: sha512-o4MiR+/kkHoeoQ/zPwt81LnTm6pqdg0wOhU7S7vIZUqzJ7YUpnpaAvF+/z7HzUOPudnavoCN0wvcZPe/AMEyCA==}
     engines: {node: '>=18'}
 
+  '@react-native/js-polyfills@0.74.87':
+    resolution: {integrity: sha512-M5Evdn76CuVEF0GsaXiGi95CBZ4IWubHqwXxV9vG9CC9kq0PSkoM2Pn7Lx7dgyp4vT7ccJ8a3IwHbe+5KJRnpw==}
+    engines: {node: '>=18'}
+
   '@react-native/metro-babel-transformer@0.74.81':
     resolution: {integrity: sha512-PVcMjj23poAK6Uemflz4MIJdEpONpjqF7JASNqqQkY6wfDdaIiZSNk8EBCWKb0t7nKqhMvtTq11DMzYJ0JFITg==}
     engines: {node: '>=18'}
     peerDependencies:
       '@babel/core': '*'
 
+  '@react-native/metro-babel-transformer@0.74.87':
+    resolution: {integrity: sha512-UsJCO24sNax2NSPBmV1zLEVVNkS88kcgAiYrZHtYSwSjpl4WZ656tIeedBfiySdJ94Hr3kQmBYLipV5zk0NI1A==}
+    engines: {node: '>=18'}
+    peerDependencies:
+      '@babel/core': '*'
+
   '@react-native/normalize-colors@0.74.81':
     resolution: {integrity: sha512-g3YvkLO7UsSWiDfYAU+gLhRHtEpUyz732lZB+N8IlLXc5MnfXHC8GKneDGY3Mh52I3gBrs20o37D5viQX9E1CA==}
 
   '@react-native/normalize-colors@0.74.85':
     resolution: {integrity: sha512-pcE4i0X7y3hsAE0SpIl7t6dUc0B0NZLd1yv7ssm4FrLhWG+CGyIq4eFDXpmPU1XHmL5PPySxTAjEMiwv6tAmOw==}
 
+  '@react-native/normalize-colors@0.74.87':
+    resolution: {integrity: sha512-Xh7Nyk/MPefkb0Itl5Z+3oOobeG9lfLb7ZOY2DKpFnoCE1TzBmib9vMNdFaLdSxLIP+Ec6icgKtdzYg8QUPYzA==}
+
   '@react-native/virtualized-lists@0.74.81':
     resolution: {integrity: sha512-5jF9S10Ug2Wl+L/0+O8WmbC726sMMX8jk/1JrvDDK+0DRLMobfjLc1L26fONlVBF7lE5ctqvKZ9TlKdhPTNOZg==}
     engines: {node: '>=18'}
@@ -4166,6 +4245,17 @@ packages:
       '@types/react':
         optional: true
 
+  '@react-native/virtualized-lists@0.74.87':
+    resolution: {integrity: sha512-lsGxoFMb0lyK/MiplNKJpD+A1EoEUumkLrCjH4Ht+ZlG8S0BfCxmskLZ6qXn3BiDSkLjfjI/qyZ3pnxNBvkXpQ==}
+    engines: {node: '>=18'}
+    peerDependencies:
+      '@types/react': ^18.2.6
+      react: '*'
+      react-native: '*'
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+
   '@react-navigation/bottom-tabs@6.5.20':
     resolution: {integrity: sha512-ow6Z06iS4VqBO8d7FP+HsGjJLWt2xTWIvuWjpoCvsM/uQXzCRDIjBv9HaKcXbF0yTW7IMir0oDAbU5PFzEDdgA==}
     peerDependencies:
@@ -4180,11 +4270,6 @@ packages:
     peerDependencies:
       react: '*'
 
-  '@react-navigation/core@7.17.2':
-    resolution: {integrity: sha512-Rt2OZwcgOmjv401uLGAKaRM6xo0fiBce/A7LfRHI1oe5FV+KooWcgAoZ2XOtgKj6UzVMuQWt3b2e6rxo/mDJRA==}
-    peerDependencies:
-      react: '>= 18.2.0'
-
   '@react-navigation/elements@1.3.31':
     resolution: {integrity: sha512-bUzP4Awlljx5RKEExw8WYtif8EuQni2glDaieYROKTnaxsu9kEIA515sXQgUDZU4Ob12VoL7+z70uO3qrlfXcQ==}
     peerDependencies:
@@ -4193,18 +4278,6 @@ packages:
       react-native: '*'
       react-native-safe-area-context: '>= 3.0.0'
 
-  '@react-navigation/elements@2.9.15':
-    resolution: {integrity: sha512-cyz/pPiyyC6gaTVLsGFc1g0MYgrmuCFqklAWGXMWPscr5YU3ui94vPI4vnZwcsEy0T758TQWLzmS5XudZeRKcA==}
-    peerDependencies:
-      '@react-native-masked-view/masked-view': '>= 0.2.0'
-      '@react-navigation/native': ^7.2.2
-      react: '>= 18.2.0'
-      react-native: '*'
-      react-native-safe-area-context: '>= 4.0.0'
-    peerDependenciesMeta:
-      '@react-native-masked-view/masked-view':
-        optional: true
-
   '@react-navigation/native-stack@6.9.26':
     resolution: {integrity: sha512-++dueQ+FDj2XkZ902DVrK79ub1vp19nSdAZWxKRgd6+Bc0Niiesua6rMCqymYOVaYh+dagwkA9r00bpt/U5WLw==}
     peerDependencies:
@@ -4214,33 +4287,15 @@ packages:
       react-native-safe-area-context: '>= 3.0.0'
       react-native-screens: '>= 3.0.0'
 
-  '@react-navigation/native-stack@7.14.12':
-    resolution: {integrity: sha512-dUfpkrVeVKKV8iqXsmoUp3Rv0iH3YaB3eZwScru/FlcqAp/r3/qA6zEXkGX9hZK+/ziWAPFrf1frBSNbgOYSFQ==}
-    peerDependencies:
-      '@react-navigation/native': ^7.2.2
-      react: '>= 18.2.0'
-      react-native: '*'
-      react-native-safe-area-context: '>= 4.0.0'
-      react-native-screens: '>= 4.0.0'
-
   '@react-navigation/native@6.1.18':
     resolution: {integrity: sha512-mIT9MiL/vMm4eirLcmw2h6h/Nm5FICtnYSdohq4vTLA2FF/6PNhByM7s8ffqoVfE5L0uAa6Xda1B7oddolUiGg==}
     peerDependencies:
       react: '*'
       react-native: '*'
 
-  '@react-navigation/native@7.2.2':
-    resolution: {integrity: sha512-kem1Ko2BcbAjmbQIv66dNmr6EtfDut3QU0qjsVhMnLLhktwyXb6FzZYp8gTrUb6AvkAbaJoi+BF5Pl55pAUa5w==}
-    peerDependencies:
-      react: '>= 18.2.0'
-      react-native: '*'
-
   '@react-navigation/routers@6.1.9':
     resolution: {integrity: sha512-lTM8gSFHSfkJvQkxacGM6VJtBt61ip2XO54aNfswD+KMw6eeZ4oehl7m0me3CR9hnDE4+60iAZR8sAhvCiI3NA==}
 
-  '@react-navigation/routers@7.5.3':
-    resolution: {integrity: sha512-1tJHg4KKRJuQ1/EvJxatrMef3NZXEPzwUIUZ3n1yJ2t7Q97siwRtbynRpQG9/69ebbtiZ8W3ScOZF/OmhvM4Rg==}
-
   '@remix-run/node@2.17.4':
     resolution: {integrity: sha512-9A29JaYiGHDEmaiQuD1IlO/TrQxnnkj98GpytihU+Nz6yTt6RwzzyMMqTAoasRd1dPD4OeSaSqbwkcim/eE76Q==}
     engines: {node: '>=18.0.0'}
@@ -4712,9 +4767,6 @@ packages:
     peerDependencies:
       '@types/react': ^18.0.0
 
-  '@types/react-test-renderer@19.1.0':
-    resolution: {integrity: sha512-XD0WZrHqjNrxA/MaR9O22w/RNidWR9YZmBdRGI7wcnWGrv/3dA8wKCJ8m63Sn+tLJhcjmuhOi629N66W6kgWzQ==}
-
   '@types/react@18.2.79':
     resolution: {integrity: sha512-RwGAGXPl9kSXwdNTafkOEuFrTBD5SA2B3iEB96xi8+xu5ddUa/cpvyVCSNn+asgLCTHkb5ZxN8gbuibYJi4s1w==}
 
@@ -5321,10 +5373,6 @@ packages:
   balanced-match@1.0.2:
     resolution: {integrity: sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==}
 
-  balanced-match@4.0.4:
-    resolution: {integrity: sha512-BLrgEcRTwX2o6gGxGOCNyMvGSp35YofuYzw9h1IMTRmKqttAZZVU67bdb9Pr2vUHA8+j3i2tJfjO6C6+4myGTA==}
-    engines: {node: 18 || 20 || >=22}
-
   bare-events@2.8.2:
     resolution: {integrity: sha512-riJjyv1/mHLIPX4RwiK+oW9/4c3TEUeORHKefKAKnZ5kyslbN+HXowtbaVEqt4IMUB7OXlfixcs6gsFeo/jhiQ==}
     peerDependencies:
@@ -5422,10 +5470,6 @@ packages:
   brace-expansion@2.1.0:
     resolution: {integrity: sha512-TN1kCZAgdgweJhWWpgKYrQaMNHcDULHkWwQIspdtjV4Y5aurRdZpjAqn6yX3FPqTA9ngHCc4hJxMAMgGfve85w==}
 
-  brace-expansion@5.0.5:
-    resolution: {integrity: sha512-VZznLgtwhn+Mact9tfiwx64fA9erHH/MCXEUfB/0bX/6Fz6ny5EGTXYltMocqg4xFAQZtnO3DHWWXi8RiuN7cQ==}
-    engines: {node: 18 || 20 || >=22}
-
   braces@3.0.3:
     resolution: {integrity: sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==}
     engines: {node: '>=8'}
@@ -6453,12 +6497,6 @@ packages:
     peerDependencies:
       expo: '*'
 
-  expo-constants@55.0.14:
-    resolution: {integrity: sha512-l23QVQCYBPKT5zbxxZdJeuhiunadvWdjcQ9+GC8h+02jCoLmWRk20064nCINnQTP3Hf+uLPteUiwYrJd0e446w==}
-    peerDependencies:
-      expo: '*'
-      react-native: '*'
-
   expo-dev-client@4.0.29:
     resolution: {integrity: sha512-aANlw9dC4PJEPaRNpe+X5xwyYI+aCIcbZklAAsFlkv2/05gLrsvAFgmQpRtowAzF+VggHWde1eKUOeUccAYIEg==}
     peerDependencies:
@@ -6479,8 +6517,8 @@ packages:
     peerDependencies:
       expo: '*'
 
-  expo-document-picker@11.7.0:
-    resolution: {integrity: sha512-y5OgUuJlip/Vj3CXi6Rfx6PqMkoYwytKmgN6x8afRPehVcYVk3j/EZxvz1MLgUhCmjyFnIpfgG5WTf8uSNbIiA==}
+  expo-document-picker@12.0.2:
+    resolution: {integrity: sha512-tmwuRWoCPv6SmNDSMEWcttMBJ95k8/g5sMWnHdmvOx0UKp0pFXP8FI+55HKtQpo6k2+118MkdDDhQSwKqASVAw==}
     peerDependencies:
       expo: '*'
 
@@ -6499,26 +6537,20 @@ packages:
     peerDependencies:
       expo: '*'
 
-  expo-image-loader@55.0.0:
-    resolution: {integrity: sha512-NOjp56wDrfuA5aiNAybBIjqIn1IxKeGJ8CECWZncQ/GzjZfyTYAHTCyeApYkdKkMBLHINzI4BbTGSlbCa0fXXQ==}
+  expo-image-loader@4.7.0:
+    resolution: {integrity: sha512-cx+MxxsAMGl9AiWnQUzrkJMJH4eNOGlu7XkLGnAXSJrRoIiciGaKqzeaD326IyCTV+Z1fXvIliSgNW+DscvD8g==}
     peerDependencies:
       expo: '*'
 
-  expo-image-picker@55.0.19:
-    resolution: {integrity: sha512-PqOOfRz7+hbB9IFN0LfNxpJJwuPlUG0Abr0qM3Wc61OJ7FFyuKJ50QJ/fFItzSuoXifET1YIFBiXx5nA8Gkinw==}
+  expo-image-picker@15.1.0:
+    resolution: {integrity: sha512-6cE10S7d0qG7+pcHtsYukRKuFL44ssOM0/v+5JIBzRwxpIgGA6qokr8PxasFEpxOA9NpN0gwry33jmq1qLXJTg==}
     peerDependencies:
       expo: '*'
 
-  expo-image@55.0.9:
-    resolution: {integrity: sha512-+NVgWv+tr7a6EpBEaIIVVp+XfruRA2JL5xOxvd6ajvFGdH0rOhagwX1m1piAII6w7sh6uAnBr8X+fDZsav7B2w==}
+  expo-image@1.13.0:
+    resolution: {integrity: sha512-0NLDcFmEn4Nh1sXeRvNzDHT+Fl6FXtTol6ki6kYYH0/iDeSFWyIy/Fek6kzDDYAmhipSMR7buPf7VVoHseTbAA==}
     peerDependencies:
       expo: '*'
-      react: '*'
-      react-native: '*'
-      react-native-web: '*'
-    peerDependenciesMeta:
-      react-native-web:
-        optional: true
 
   expo-json-utils@0.13.1:
     resolution: {integrity: sha512-mlfaSArGVb+oJmUcR22jEONlgPp0wj4iNIHfQ2je9Q8WTOqMc0Ws9tUciz3JdJnhffdHqo/k8fpvf0IRmN5HPA==}
@@ -6528,11 +6560,8 @@ packages:
     peerDependencies:
       expo: '*'
 
-  expo-linking@55.0.13:
-    resolution: {integrity: sha512-xbOqNWQCC5RGtXSW83ZCKOjRivyxO2zBouRYy/hgbsyrHUJhztMAjlq8RKYDUL8D6QVsH9Q81SNoq4Zhcn+4HQ==}
-    peerDependencies:
-      react: '*'
-      react-native: '*'
+  expo-linking@6.3.1:
+    resolution: {integrity: sha512-xuZCntSBGWCD/95iZ+mTUGTwHdy8Sx+immCqbUBxdvZ2TN61P02kKg7SaLS8A4a/hLrSCwrg5tMMwu5wfKr35g==}
 
   expo-manifests@0.14.3:
     resolution: {integrity: sha512-L3b5/qocBPiQjbW0cpOHfnqdKZbTJS7sA3mgeDJT+mWga/xYsdpma1EfNmsuvrOzjLGjStr1k1fceM9Bl49aqQ==}
@@ -6913,10 +6942,6 @@ packages:
     resolution: {integrity: sha512-7yetJWqbS9sbn0vIfliPsFgoXMKn/YMF+Wuiog97x+urnSRRRZ7xB+uVkwGKzRgq9CDFfMQnE9ruL5DHv9c6Xg==}
     engines: {node: '>=6'}
 
-  getenv@2.0.0:
-    resolution: {integrity: sha512-VilgtJj/ALgGY77fiLam5iD336eSWi96Q15JSAG1zi8NRBysm3LXKdGnHb4m5cuyxvOLQQKWpBZAT6ni4FI2iQ==}
-    engines: {node: '>=6'}
-
   glob-parent@5.1.2:
     resolution: {integrity: sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==}
     engines: {node: '>= 6'}
@@ -6936,10 +6961,6 @@ packages:
     deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
     hasBin: true
 
-  glob@13.0.6:
-    resolution: {integrity: sha512-Wjlyrolmm8uDpm/ogGyXZXb1Z+Ca2B8NbJwqBVg0axK9GbBeoS7yGV6vjXnYdGm6X53iehEuxxbyiKp8QmN4Vw==}
-    engines: {node: 18 || 20 || >=22}
-
   glob@7.1.6:
     resolution: {integrity: sha512-LwaxwyZ72Lk7vZINtNNrywX0ZuLyStrdDtabefZKAY5ZGJhVtgdznluResxNmPitE0SAO+O26sWTHeKSI2wMBA==}
     deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
@@ -7854,10 +7875,6 @@ packages:
   lru-cache@10.4.3:
     resolution: {integrity: sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ==}
 
-  lru-cache@11.3.5:
-    resolution: {integrity: sha512-NxVFwLAnrd9i7KUBxC4DrUhmgjzOs+1Qm50D3oF1/oL+r1NpZ4gA7xvG0/zJ8evR7zIKn4vLf7qTNduWFtCrRw==}
-    engines: {node: 20 || >=22}
-
   lru-cache@5.1.1:
     resolution: {integrity: sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==}
 
@@ -8055,10 +8072,6 @@ packages:
     resolution: {integrity: sha512-vqiC06CuhBTUdZH+RYl8sFrL096vA45Ok5ISO6sE/Mr1jRbGH4Csnhi8f3wKVl7x8mO4Au7Ir9D3Oyv1VYMFJw==}
     engines: {node: '>=12'}
 
-  minimatch@10.2.5:
-    resolution: {integrity: sha512-MULkVLfKGYDFYejP07QOurDLLQpcjk7Fw+7jXS2R2czRQzR56yHRveU5NDJEOviH+hETZKSkIk5c+T23GjFUMg==}
-    engines: {node: 18 || 20 || >=22}
-
   minimatch@3.1.5:
     resolution: {integrity: sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==}
 
@@ -8507,10 +8520,6 @@ packages:
     resolution: {integrity: sha512-Xa4Nw17FS9ApQFJ9umLiJS4orGjm7ZzwUrwamcGQuHSzDyth9boKDaycYdDcZDuqYATXw4HFXgaqWTctW/v1HA==}
     engines: {node: '>=16 || 14 >=14.18'}
 
-  path-scurry@2.0.2:
-    resolution: {integrity: sha512-3O/iVVsJAPsOnpwWIeD+d6z/7PmqApyQePUtCndjatj/9I5LylHvt5qluFaBT3I5h3r1ejfR056c+FCv+NnNXg==}
-    engines: {node: 18 || 20 || >=22}
-
   path-to-regexp@0.1.13:
     resolution: {integrity: sha512-A/AGNMFN3c8bOlvV9RreMdrv7jsmF9XIfDeCd87+I8RNg6s78BhJxMu69NEMHBSJFxKidViTEdruRwEk/WIKqA==}
 
@@ -8909,9 +8918,6 @@ packages:
   react-is@18.3.1:
     resolution: {integrity: sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg==}
 
-  react-is@19.2.5:
-    resolution: {integrity: sha512-Dn0t8IQhCmeIT3wu+Apm1/YVsJXsGWi6k4sPdnBIdqMVtHtv0IGi6dcpNpNkNac0zB2uUAqNX3MHzN8c+z2rwQ==}
-
   react-native-css-interop@0.2.3:
     resolution: {integrity: sha512-wc+JI7iUfdFBqnE18HhMTtD0q9vkhuMczToA87UdHGWwMyxdT5sCcNy+i4KInPCE855IY0Ic8kLQqecAIBWz7w==}
     engines: {node: '>=18'}
@@ -8935,8 +8941,8 @@ packages:
       react-native-gesture-handler: '>=2.0.0'
       react-native-reanimated: '>=2.8.0'
 
-  react-native-gesture-handler@2.31.1:
-    resolution: {integrity: sha512-wQDlECdEzHhYKTnQXFnSqWUtJ5TS3MGQi7EWvQczTnEVKfk6XVSBecnpWAoI/CqlYQ7IWMJEyutY6BxwEBoxeg==}
+  react-native-gesture-handler@2.16.2:
+    resolution: {integrity: sha512-vGFlrDKlmyI+BT+FemqVxmvO7nqxU33cgXVsn6IKAFishvlG3oV2Ds67D5nPkHMea8T+s1IcuMm0bF8ntZtAyg==}
     peerDependencies:
       react: '*'
       react-native: '*'
@@ -8953,14 +8959,14 @@ packages:
       react: '*'
       react-native: '*'
 
-  react-native-safe-area-context@4.10.0:
-    resolution: {integrity: sha512-T0TsnOr1Ud/7tcVeYURmhvTUe4rdwzYXNM+GbGrxqDcP/19EQkreAr6za0eSVukgUaW65LvhB65fT2pbaR+PjA==}
+  react-native-safe-area-context@4.10.5:
+    resolution: {integrity: sha512-Wyb0Nqw2XJ6oZxW/cK8k5q7/UAhg/wbEG6UVf89rQqecDZTDA5ic//P9J6VvJRVZerzGmxWQpVuM7f+PRYUM4g==}
     peerDependencies:
       react: '*'
       react-native: '*'
 
-  react-native-screens@3.31.0:
-    resolution: {integrity: sha512-TzA52rgh64gdMjcv+rnRSFbAocQpkKjUUgXmhz8ZJHfdzz36SSBJ6kmqVY3qF1si32oOyMDjUdHscPK7xfKCgQ==}
+  react-native-screens@3.31.1:
+    resolution: {integrity: sha512-8fRW362pfZ9y4rS8KY5P3DFScrmwo/vu1RrRMMx0PNHbeC9TLq0Kw1ubD83591yz64gLNHFLTVkTJmWeWCXKtQ==}
     peerDependencies:
       react: '*'
       react-native: '*'
@@ -8971,6 +8977,12 @@ packages:
       react: '*'
       react-native: '*'
 
+  react-native-svg@15.2.0:
+    resolution: {integrity: sha512-R0E6IhcJfVLsL0lRmnUSm72QO+mTqcAOM5Jb8FVGxJqX3NfJMlMP0YyvcajZiaRR8CqQUpEoqrY25eyZb006kw==}
+    peerDependencies:
+      react: '*'
+      react-native: '*'
+
   react-native-web@0.19.13:
     resolution: {integrity: sha512-etv3bN8rJglrRCp/uL4p7l8QvUNUC++QwDbdZ8CB7BvZiMvsxfFIRM1j04vxNldG3uo2puRd6OSWR3ibtmc29A==}
     peerDependencies:
@@ -8988,6 +9000,17 @@ packages:
       '@types/react':
         optional: true
 
+  react-native@0.74.5:
+    resolution: {integrity: sha512-Bgg2WvxaGODukJMTZFTZBNMKVaROHLwSb8VAGEdrlvKwfb1hHg/3aXTUICYk7dwgAnb+INbGMwnF8yeAgIUmqw==}
+    engines: {node: '>=18'}
+    hasBin: true
+    peerDependencies:
+      '@types/react': ^18.2.6
+      react: 18.2.0
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+
   react-refresh@0.14.2:
     resolution: {integrity: sha512-jCvmsr+1IUSMUyzOkRcvnVbX3ZYC6g9TDrDbFuFmRDq7PD4yaGbLKNQL6k2jnArV8hjYxh7hVhAZB6s9HDGpZA==}
     engines: {node: '>=0.10.0'}
@@ -9292,10 +9315,6 @@ packages:
   setprototypeof@1.2.0:
     resolution: {integrity: sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==}
 
-  sf-symbols-typescript@2.2.0:
-    resolution: {integrity: sha512-TPbeg0b7ylrswdGCji8FRGFAKuqbpQlLbL8SOle3j1iHSs5Ob5mhvMAxWN2UItOjgALAB5Zp3fmMfj8mbWvXKw==}
-    engines: {node: '>=10'}
-
   shallow-clone@3.0.1:
     resolution: {integrity: sha512-/6KqX+GVUdqPuPPd2LxDDxzX6CAbjJehAAOKlNpqqUpAqPM6HeL8f+o3a+JsyGjn2lv0WY8UsTgUJjU9Ok55NA==}
     engines: {node: '>=8'}
@@ -9886,6 +9905,11 @@ packages:
   typedarray@0.0.6:
     resolution: {integrity: sha512-/aCDEGatGvZ2BIk+HmLf4ifCJFwvKFNb9/JeZPMulfgFracn9QFcAf5GO8B/mweUjSoblS5In0cWhqpfs/5PQA==}
 
+  typescript@5.3.3:
+    resolution: {integrity: sha512-pXWcraxM0uxAS+tN0AG/BF2TyqmHO014Z070UsJ+pFvYuRSq8KH8DmWpnbXe0pEPDHXZV3FcAbJkijJ5oNEnWw==}
+    engines: {node: '>=14.17'}
+    hasBin: true
+
   typescript@5.9.3:
     resolution: {integrity: sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==}
     engines: {node: '>=14.17'}
@@ -11891,24 +11915,6 @@ snapshots:
       node-forge: 1.4.0
       nullthrows: 1.1.1
 
-  '@expo/config-plugins@55.0.8':
-    dependencies:
-      '@expo/config-types': 55.0.5
-      '@expo/json-file': 10.0.13
-      '@expo/plist': 0.5.2
-      '@expo/sdk-runtime-versions': 1.0.0
-      chalk: 4.1.2
-      debug: 4.4.3
-      getenv: 2.0.0
-      glob: 13.0.6
-      resolve-from: 5.0.0
-      semver: 7.7.4
-      slugify: 1.6.9
-      xcode: 3.0.1
-      xml2js: 0.6.0
-    transitivePeerDependencies:
-      - supports-color
-
   '@expo/config-plugins@8.0.11':
     dependencies:
       '@expo/config-types': 51.0.3
@@ -11931,24 +11937,6 @@ snapshots:
 
   '@expo/config-types@51.0.3': {}
 
-  '@expo/config-types@55.0.5': {}
-
-  '@expo/config@55.0.15(typescript@5.9.3)':
-    dependencies:
-      '@expo/config-plugins': 55.0.8
-      '@expo/config-types': 55.0.5
-      '@expo/json-file': 10.0.13
-      '@expo/require-utils': 55.0.4(typescript@5.9.3)
-      deepmerge: 4.3.1
-      getenv: 2.0.0
-      glob: 13.0.6
-      resolve-workspace-root: 2.0.1
-      semver: 7.7.4
-      slugify: 1.6.9
-    transitivePeerDependencies:
-      - supports-color
-      - typescript
-
   '@expo/config@9.0.4':
     dependencies:
       '@babel/code-frame': 7.10.4
@@ -11982,14 +11970,6 @@ snapshots:
     transitivePeerDependencies:
       - supports-color
 
-  '@expo/env@2.1.1':
-    dependencies:
-      chalk: 4.1.2
-      debug: 4.4.3
-      getenv: 2.0.0
-    transitivePeerDependencies:
-      - supports-color
-
   '@expo/image-utils@0.5.1':
     dependencies:
       '@expo/spawn-async': 1.7.2
@@ -12039,9 +12019,9 @@ snapshots:
     transitivePeerDependencies:
       - supports-color
 
-  '@expo/metro-runtime@3.2.3(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))':
+  '@expo/metro-runtime@3.2.3(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))':
     dependencies:
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
 
   '@expo/osascript@2.4.2':
     dependencies:
@@ -12062,12 +12042,6 @@ snapshots:
       base64-js: 1.5.1
       xmlbuilder: 14.0.0
 
-  '@expo/plist@0.5.2':
-    dependencies:
-      '@xmldom/xmldom': 0.8.13
-      base64-js: 1.5.1
-      xmlbuilder: 15.1.1
-
   '@expo/prebuild-config@7.0.9(expo-modules-autolinking@1.11.3)':
     dependencies:
       '@expo/config': 9.0.4
@@ -12086,16 +12060,6 @@ snapshots:
       - encoding
       - supports-color
 
-  '@expo/require-utils@55.0.4(typescript@5.9.3)':
-    dependencies:
-      '@babel/code-frame': 7.29.0
-      '@babel/core': 7.29.0
-      '@babel/plugin-transform-modules-commonjs': 7.28.6(@babel/core@7.29.0)
-    optionalDependencies:
-      typescript: 5.9.3
-    transitivePeerDependencies:
-      - supports-color
-
   '@expo/rudder-sdk-node@1.1.1':
     dependencies:
       '@expo/bunyan': 4.0.1
@@ -12110,9 +12074,9 @@ snapshots:
 
   '@expo/sdk-runtime-versions@1.0.0': {}
 
-  '@expo/server@0.4.4(typescript@5.9.3)':
+  '@expo/server@0.4.4(typescript@5.3.3)':
     dependencies:
-      '@remix-run/node': 2.17.4(typescript@5.9.3)
+      '@remix-run/node': 2.17.4(typescript@5.3.3)
       abort-controller: 3.0.0
       debug: 4.4.3
       source-map-support: 0.5.21
@@ -12208,10 +12172,10 @@ snapshots:
       idb: 7.1.1
       tslib: 2.8.1
 
-  '@firebase/auth-compat@0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))':
+  '@firebase/auth-compat@0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))':
     dependencies:
       '@firebase/app-compat': 0.2.50
-      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
+      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
       '@firebase/auth-types': 0.13.0(@firebase/app-types@0.9.3)(@firebase/util@1.10.3)
       '@firebase/component': 0.6.12
       '@firebase/util': 1.10.3
@@ -12221,10 +12185,23 @@ snapshots:
       - '@firebase/app-types'
       - '@react-native-async-storage/async-storage'
 
-  '@firebase/auth-compat@0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))':
+  '@firebase/auth-compat@0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))':
     dependencies:
       '@firebase/app-compat': 0.2.50
-      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
+      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
+      '@firebase/auth-types': 0.13.0(@firebase/app-types@0.9.3)(@firebase/util@1.10.3)
+      '@firebase/component': 0.6.12
+      '@firebase/util': 1.10.3
+      tslib: 2.8.1
+    transitivePeerDependencies:
+      - '@firebase/app'
+      - '@firebase/app-types'
+      - '@react-native-async-storage/async-storage'
+
+  '@firebase/auth-compat@0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))':
+    dependencies:
+      '@firebase/app-compat': 0.2.50
+      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
       '@firebase/auth-types': 0.13.0(@firebase/app-types@0.9.3)(@firebase/util@1.10.3)
       '@firebase/component': 0.6.12
       '@firebase/util': 1.10.3
@@ -12243,7 +12220,7 @@ snapshots:
       '@firebase/app-types': 0.9.3
       '@firebase/util': 1.10.3
 
-  '@firebase/auth@1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))':
+  '@firebase/auth@1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))':
     dependencies:
       '@firebase/app': 0.11.1
       '@firebase/component': 0.6.12
@@ -12251,9 +12228,9 @@ snapshots:
       '@firebase/util': 1.10.3
       tslib: 2.8.1
     optionalDependencies:
-      '@react-native-async-storage/async-storage': 1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+      '@react-native-async-storage/async-storage': 1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))
 
-  '@firebase/auth@1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))':
+  '@firebase/auth@1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))':
     dependencies:
       '@firebase/app': 0.11.1
       '@firebase/component': 0.6.12
@@ -12261,7 +12238,17 @@ snapshots:
       '@firebase/util': 1.10.3
       tslib: 2.8.1
     optionalDependencies:
-      '@react-native-async-storage/async-storage': 1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))
+      '@react-native-async-storage/async-storage': 1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+
+  '@firebase/auth@1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))':
+    dependencies:
+      '@firebase/app': 0.11.1
+      '@firebase/component': 0.6.12
+      '@firebase/logger': 0.4.4
+      '@firebase/util': 1.10.3
+      tslib: 2.8.1
+    optionalDependencies:
+      '@react-native-async-storage/async-storage': 1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))
 
   '@firebase/component@0.6.12':
     dependencies:
@@ -13863,15 +13850,21 @@ snapshots:
       '@radix-ui/react-compose-refs': 1.0.0(react@18.2.0)
       react: 18.2.0
 
-  '@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))':
+  '@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))':
     dependencies:
       merge-options: 3.0.4
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)
+    optional: true
 
-  '@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))':
+  '@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))':
     dependencies:
       merge-options: 3.0.4
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+
+  '@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))':
+    dependencies:
+      merge-options: 3.0.4
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)
     optional: true
 
   '@react-native-community/cli-clean@13.6.4':
@@ -13883,6 +13876,15 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-clean@13.6.9':
+    dependencies:
+      '@react-native-community/cli-tools': 13.6.9
+      chalk: 4.1.2
+      execa: 5.1.1
+      fast-glob: 3.3.3
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-config@13.6.4':
     dependencies:
       '@react-native-community/cli-tools': 13.6.4
@@ -13894,12 +13896,29 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-config@13.6.9':
+    dependencies:
+      '@react-native-community/cli-tools': 13.6.9
+      chalk: 4.1.2
+      cosmiconfig: 5.2.1
+      deepmerge: 4.3.1
+      fast-glob: 3.3.3
+      joi: 17.13.3
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-debugger-ui@13.6.4':
     dependencies:
       serve-static: 1.16.3
     transitivePeerDependencies:
       - supports-color
 
+  '@react-native-community/cli-debugger-ui@13.6.9':
+    dependencies:
+      serve-static: 1.16.3
+    transitivePeerDependencies:
+      - supports-color
+
   '@react-native-community/cli-doctor@13.6.4':
     dependencies:
       '@react-native-community/cli-config': 13.6.4
@@ -13922,6 +13941,28 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-doctor@13.6.9':
+    dependencies:
+      '@react-native-community/cli-config': 13.6.9
+      '@react-native-community/cli-platform-android': 13.6.9
+      '@react-native-community/cli-platform-apple': 13.6.9
+      '@react-native-community/cli-platform-ios': 13.6.9
+      '@react-native-community/cli-tools': 13.6.9
+      chalk: 4.1.2
+      command-exists: 1.2.9
+      deepmerge: 4.3.1
+      envinfo: 7.21.0
+      execa: 5.1.1
+      hermes-profile-transformer: 0.0.6
+      node-stream-zip: 1.15.0
+      ora: 5.4.1
+      semver: 7.7.4
+      strip-ansi: 5.2.0
+      wcwidth: 1.0.1
+      yaml: 2.8.3
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-hermes@13.6.4':
     dependencies:
       '@react-native-community/cli-platform-android': 13.6.4
@@ -13931,6 +13972,15 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-hermes@13.6.9':
+    dependencies:
+      '@react-native-community/cli-platform-android': 13.6.9
+      '@react-native-community/cli-tools': 13.6.9
+      chalk: 4.1.2
+      hermes-profile-transformer: 0.0.6
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-platform-android@13.6.4':
     dependencies:
       '@react-native-community/cli-tools': 13.6.4
@@ -13942,6 +13992,17 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-platform-android@13.6.9':
+    dependencies:
+      '@react-native-community/cli-tools': 13.6.9
+      chalk: 4.1.2
+      execa: 5.1.1
+      fast-glob: 3.3.3
+      fast-xml-parser: 4.5.6
+      logkitty: 0.7.1
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-platform-apple@13.6.4':
     dependencies:
       '@react-native-community/cli-tools': 13.6.4
@@ -13953,12 +14014,29 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-platform-apple@13.6.9':
+    dependencies:
+      '@react-native-community/cli-tools': 13.6.9
+      chalk: 4.1.2
+      execa: 5.1.1
+      fast-glob: 3.3.3
+      fast-xml-parser: 4.5.6
+      ora: 5.4.1
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-platform-ios@13.6.4':
     dependencies:
       '@react-native-community/cli-platform-apple': 13.6.4
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-platform-ios@13.6.9':
+    dependencies:
+      '@react-native-community/cli-platform-apple': 13.6.9
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-server-api@13.6.4':
     dependencies:
       '@react-native-community/cli-debugger-ui': 13.6.4
@@ -13976,6 +14054,23 @@ snapshots:
       - supports-color
       - utf-8-validate
 
+  '@react-native-community/cli-server-api@13.6.9':
+    dependencies:
+      '@react-native-community/cli-debugger-ui': 13.6.9
+      '@react-native-community/cli-tools': 13.6.9
+      compression: 1.8.1
+      connect: 3.7.0
+      errorhandler: 1.5.2
+      nocache: 3.0.4
+      pretty-format: 26.6.2
+      serve-static: 1.16.3
+      ws: 6.2.3
+    transitivePeerDependencies:
+      - bufferutil
+      - encoding
+      - supports-color
+      - utf-8-validate
+
   '@react-native-community/cli-tools@13.6.4':
     dependencies:
       appdirsjs: 1.2.7
@@ -13992,10 +14087,30 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@react-native-community/cli-tools@13.6.9':
+    dependencies:
+      appdirsjs: 1.2.7
+      chalk: 4.1.2
+      execa: 5.1.1
+      find-up: 5.0.0
+      mime: 2.6.0
+      node-fetch: 2.7.0
+      open: 6.4.0
+      ora: 5.4.1
+      semver: 7.7.4
+      shell-quote: 1.8.3
+      sudo-prompt: 9.2.1
+    transitivePeerDependencies:
+      - encoding
+
   '@react-native-community/cli-types@13.6.4':
     dependencies:
       joi: 17.13.3
 
+  '@react-native-community/cli-types@13.6.9':
+    dependencies:
+      joi: 17.13.3
+
   '@react-native-community/cli@13.6.4':
     dependencies:
       '@react-native-community/cli-clean': 13.6.4
@@ -14021,20 +14136,34 @@ snapshots:
       - supports-color
       - utf-8-validate
 
-  '@react-native-community/netinfo@11.5.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
+  '@react-native-community/cli@13.6.9':
     dependencies:
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      '@react-native-community/cli-clean': 13.6.9
+      '@react-native-community/cli-config': 13.6.9
+      '@react-native-community/cli-debugger-ui': 13.6.9
+      '@react-native-community/cli-doctor': 13.6.9
+      '@react-native-community/cli-hermes': 13.6.9
+      '@react-native-community/cli-server-api': 13.6.9
+      '@react-native-community/cli-tools': 13.6.9
+      '@react-native-community/cli-types': 13.6.9
+      chalk: 4.1.2
+      commander: 9.5.0
+      deepmerge: 4.3.1
+      execa: 5.1.1
+      find-up: 4.1.0
+      fs-extra: 8.1.0
+      graceful-fs: 4.2.11
+      prompts: 2.4.2
+      semver: 7.7.4
+    transitivePeerDependencies:
+      - bufferutil
+      - encoding
+      - supports-color
+      - utf-8-validate
 
-  '@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
+  '@react-native-community/netinfo@11.3.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))':
     dependencies:
-      firebase: 11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-    optionalDependencies:
-      expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
-    transitivePeerDependencies:
-      - '@react-native-async-storage/async-storage'
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
 
   '@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))(react@18.3.1)':
     dependencies:
@@ -14046,12 +14175,15 @@ snapshots:
     transitivePeerDependencies:
       - '@react-native-async-storage/async-storage'
 
-  '@react-native-firebase/auth@21.14.0(@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))':
+  '@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
     dependencies:
-      '@react-native-firebase/app': 21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      plist: 3.1.0
+      firebase: 11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
+      react: 18.2.0
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
     optionalDependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+    transitivePeerDependencies:
+      - '@react-native-async-storage/async-storage'
 
   '@react-native-firebase/auth@21.14.0(@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))(react@18.3.1))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))':
     dependencies:
@@ -14060,8 +14192,17 @@ snapshots:
     optionalDependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
 
+  '@react-native-firebase/auth@21.14.0(@react-native-firebase/app@21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))':
+    dependencies:
+      '@react-native-firebase/app': 21.14.0(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      plist: 3.1.0
+    optionalDependencies:
+      expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+
   '@react-native/assets-registry@0.74.81': {}
 
+  '@react-native/assets-registry@0.74.87': {}
+
   '@react-native/babel-plugin-codegen@0.74.81(@babel/preset-env@7.29.2(@babel/core@7.29.0))':
     dependencies:
       '@react-native/codegen': 0.74.81(@babel/preset-env@7.29.2(@babel/core@7.29.0))
@@ -14222,10 +14363,34 @@ snapshots:
       - supports-color
       - utf-8-validate
 
+  '@react-native/community-cli-plugin@0.74.87(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))':
+    dependencies:
+      '@react-native-community/cli-server-api': 13.6.9
+      '@react-native-community/cli-tools': 13.6.9
+      '@react-native/dev-middleware': 0.74.87
+      '@react-native/metro-babel-transformer': 0.74.87(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+      chalk: 4.1.2
+      execa: 5.1.1
+      metro: 0.80.12
+      metro-config: 0.80.12
+      metro-core: 0.80.12
+      node-fetch: 2.7.0
+      querystring: 0.2.1
+      readline: 1.3.0
+    transitivePeerDependencies:
+      - '@babel/core'
+      - '@babel/preset-env'
+      - bufferutil
+      - encoding
+      - supports-color
+      - utf-8-validate
+
   '@react-native/debugger-frontend@0.74.81': {}
 
   '@react-native/debugger-frontend@0.74.85': {}
 
+  '@react-native/debugger-frontend@0.74.87': {}
+
   '@react-native/dev-middleware@0.74.81':
     dependencies:
       '@isaacs/ttlcache': 1.4.1
@@ -14268,10 +14433,35 @@ snapshots:
       - supports-color
       - utf-8-validate
 
+  '@react-native/dev-middleware@0.74.87':
+    dependencies:
+      '@isaacs/ttlcache': 1.4.1
+      '@react-native/debugger-frontend': 0.74.87
+      '@rnx-kit/chromium-edge-launcher': 1.0.0
+      chrome-launcher: 0.15.2
+      connect: 3.7.0
+      debug: 2.6.9
+      node-fetch: 2.7.0
+      nullthrows: 1.1.1
+      open: 7.4.2
+      selfsigned: 2.4.1
+      serve-static: 1.16.3
+      temp-dir: 2.0.0
+      ws: 6.2.3
+    transitivePeerDependencies:
+      - bufferutil
+      - encoding
+      - supports-color
+      - utf-8-validate
+
   '@react-native/gradle-plugin@0.74.81': {}
 
+  '@react-native/gradle-plugin@0.74.87': {}
+
   '@react-native/js-polyfills@0.74.81': {}
 
+  '@react-native/js-polyfills@0.74.87': {}
+
   '@react-native/metro-babel-transformer@0.74.81(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))':
     dependencies:
       '@babel/core': 7.29.0
@@ -14282,18 +14472,21 @@ snapshots:
       - '@babel/preset-env'
       - supports-color
 
+  '@react-native/metro-babel-transformer@0.74.87(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))':
+    dependencies:
+      '@babel/core': 7.29.0
+      '@react-native/babel-preset': 0.74.87(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+      hermes-parser: 0.19.1
+      nullthrows: 1.1.1
+    transitivePeerDependencies:
+      - '@babel/preset-env'
+      - supports-color
+
   '@react-native/normalize-colors@0.74.81': {}
 
   '@react-native/normalize-colors@0.74.85': {}
 
-  '@react-native/virtualized-lists@0.74.81(@types/react@18.2.79)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
-    dependencies:
-      invariant: 2.2.4
-      nullthrows: 1.1.1
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-    optionalDependencies:
-      '@types/react': 18.2.79
+  '@react-native/normalize-colors@0.74.87': {}
 
   '@react-native/virtualized-lists@0.74.81(@types/react@18.3.28)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0))(react@18.2.0)':
     dependencies:
@@ -14313,15 +14506,34 @@ snapshots:
     optionalDependencies:
       '@types/react': 18.3.28
 
-  '@react-navigation/bottom-tabs@6.5.20(@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
+  '@react-native/virtualized-lists@0.74.87(@types/react@18.2.79)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
     dependencies:
-      '@react-navigation/elements': 1.3.31(@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      '@react-navigation/native': 6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      invariant: 2.2.4
+      nullthrows: 1.1.1
+      react: 18.2.0
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+    optionalDependencies:
+      '@types/react': 18.2.79
+
+  '@react-native/virtualized-lists@0.74.87(@types/react@18.3.28)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))(react@18.3.1)':
+    dependencies:
+      invariant: 2.2.4
+      nullthrows: 1.1.1
+      react: 18.3.1
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)
+    optionalDependencies:
+      '@types/react': 18.3.28
+    optional: true
+
+  '@react-navigation/bottom-tabs@6.5.20(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
+    dependencies:
+      '@react-navigation/elements': 1.3.31(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@react-navigation/native': 6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       color: 4.2.3
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react-native-screens: 3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native-safe-area-context: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-screens: 3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       warn-once: 0.1.1
 
   '@react-navigation/core@6.4.17(react@18.2.0)':
@@ -14334,89 +14546,39 @@ snapshots:
       react-is: 16.13.1
       use-latest-callback: 0.2.6(react@18.2.0)
 
-  '@react-navigation/core@7.17.2(react@18.2.0)':
+  '@react-navigation/elements@1.3.31(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
     dependencies:
-      '@react-navigation/routers': 7.5.3
-      escape-string-regexp: 4.0.0
-      fast-deep-equal: 3.1.3
-      nanoid: 3.3.11
-      query-string: 7.1.3
+      '@react-navigation/native': 6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react: 18.2.0
-      react-is: 19.2.5
-      use-latest-callback: 0.2.6(react@18.2.0)
-      use-sync-external-store: 1.6.0(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native-safe-area-context: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
 
-  '@react-navigation/elements@1.3.31(@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
+  '@react-navigation/native-stack@6.9.26(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
     dependencies:
-      '@react-navigation/native': 6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-
-  '@react-navigation/elements@2.9.15(@react-navigation/native@7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
-    dependencies:
-      '@react-navigation/native': 7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      color: 4.2.3
+      '@react-navigation/elements': 1.3.31(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@react-navigation/native': 6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      use-latest-callback: 0.2.6(react@18.2.0)
-      use-sync-external-store: 1.6.0(react@18.2.0)
-
-  '@react-navigation/native-stack@6.9.26(@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
-    dependencies:
-      '@react-navigation/elements': 1.3.31(@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      '@react-navigation/native': 6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react-native-screens: 3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native-safe-area-context: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-screens: 3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       warn-once: 0.1.1
 
-  '@react-navigation/native-stack@7.14.12(@react-navigation/native@7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
-    dependencies:
-      '@react-navigation/elements': 2.9.15(@react-navigation/native@7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      '@react-navigation/native': 7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      color: 4.2.3
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react-native-screens: 3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      sf-symbols-typescript: 2.2.0
-      warn-once: 0.1.1
-    transitivePeerDependencies:
-      - '@react-native-masked-view/masked-view'
-
-  '@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
+  '@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
     dependencies:
       '@react-navigation/core': 6.4.17(react@18.2.0)
       escape-string-regexp: 4.0.0
       fast-deep-equal: 3.1.3
       nanoid: 3.3.11
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-
-  '@react-navigation/native@7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)':
-    dependencies:
-      '@react-navigation/core': 7.17.2(react@18.2.0)
-      escape-string-regexp: 4.0.0
-      fast-deep-equal: 3.1.3
-      nanoid: 3.3.11
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      use-latest-callback: 0.2.6(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
 
   '@react-navigation/routers@6.1.9':
     dependencies:
       nanoid: 3.3.11
 
-  '@react-navigation/routers@7.5.3':
-    dependencies:
-      nanoid: 3.3.11
-
-  '@remix-run/node@2.17.4(typescript@5.9.3)':
+  '@remix-run/node@2.17.4(typescript@5.3.3)':
     dependencies:
-      '@remix-run/server-runtime': 2.17.4(typescript@5.9.3)
+      '@remix-run/server-runtime': 2.17.4(typescript@5.3.3)
       '@remix-run/web-fetch': 4.4.2
       '@web3-storage/multipart-parser': 1.0.0
       cookie-signature: 1.2.2
@@ -14424,11 +14586,11 @@ snapshots:
       stream-slice: 0.1.2
       undici: 6.25.0
     optionalDependencies:
-      typescript: 5.9.3
+      typescript: 5.3.3
 
   '@remix-run/router@1.23.2': {}
 
-  '@remix-run/server-runtime@2.17.4(typescript@5.9.3)':
+  '@remix-run/server-runtime@2.17.4(typescript@5.3.3)':
     dependencies:
       '@remix-run/router': 1.23.2
       '@types/cookie': 0.6.0
@@ -14438,7 +14600,7 @@ snapshots:
       source-map: 0.7.6
       turbo-stream: 2.4.1
     optionalDependencies:
-      typescript: 5.9.3
+      typescript: 5.3.3
 
   '@remix-run/web-blob@3.1.0':
     dependencies:
@@ -14935,10 +15097,6 @@ snapshots:
     dependencies:
       '@types/react': 18.3.28
 
-  '@types/react-test-renderer@19.1.0':
-    dependencies:
-      '@types/react': 18.3.28
-
   '@types/react@18.2.79':
     dependencies:
       '@types/prop-types': 15.7.15
@@ -15649,8 +15807,6 @@ snapshots:
 
   balanced-match@1.0.2: {}
 
-  balanced-match@4.0.4: {}
-
   bare-events@2.8.2: {}
 
   bare-fs@4.7.1:
@@ -15751,10 +15907,6 @@ snapshots:
     dependencies:
       balanced-match: 1.0.2
 
-  brace-expansion@5.0.5:
-    dependencies:
-      balanced-match: 4.0.4
-
   braces@3.0.3:
     dependencies:
       fill-range: 7.1.1
@@ -16753,8 +16905,8 @@ snapshots:
       '@typescript-eslint/parser': 7.2.0(eslint@8.57.1)(typescript@5.9.3)
       eslint: 8.57.1
       eslint-import-resolver-node: 0.3.10
-      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1))(eslint@8.57.1)
-      eslint-plugin-import: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1)
+      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1)
+      eslint-plugin-import: 2.32.0(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1)
       eslint-plugin-jsx-a11y: 6.10.2(eslint@8.57.1)
       eslint-plugin-react: 7.37.5(eslint@8.57.1)
       eslint-plugin-react-hooks: 5.0.0-canary-7118f5dd7-20230705(eslint@8.57.1)
@@ -16773,7 +16925,7 @@ snapshots:
     transitivePeerDependencies:
       - supports-color
 
-  eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1))(eslint@8.57.1):
+  eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1):
     dependencies:
       '@nolyfill/is-core-module': 1.0.39
       debug: 4.4.3
@@ -16784,22 +16936,33 @@ snapshots:
       tinyglobby: 0.2.16
       unrs-resolver: 1.11.1
     optionalDependencies:
-      eslint-plugin-import: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1)
+      eslint-plugin-import: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1)
     transitivePeerDependencies:
       - supports-color
 
-  eslint-module-utils@2.12.1(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1):
+  eslint-module-utils@2.12.1(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1):
     dependencies:
       debug: 3.2.7
     optionalDependencies:
       '@typescript-eslint/parser': 7.18.0(eslint@8.57.1)(typescript@5.9.3)
       eslint: 8.57.1
       eslint-import-resolver-node: 0.3.10
-      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1))(eslint@8.57.1)
+      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  eslint-module-utils@2.12.1(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1):
+    dependencies:
+      debug: 3.2.7
+    optionalDependencies:
+      '@typescript-eslint/parser': 7.2.0(eslint@8.57.1)(typescript@5.9.3)
+      eslint: 8.57.1
+      eslint-import-resolver-node: 0.3.10
+      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1)
     transitivePeerDependencies:
       - supports-color
 
-  eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1):
+  eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1):
     dependencies:
       '@rtsao/scc': 1.1.0
       array-includes: 3.1.9
@@ -16810,7 +16973,7 @@ snapshots:
       doctrine: 2.1.0
       eslint: 8.57.1
       eslint-import-resolver-node: 0.3.10
-      eslint-module-utils: 2.12.1(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1)
+      eslint-module-utils: 2.12.1(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1)
       hasown: 2.0.3
       is-core-module: 2.16.1
       is-glob: 4.0.3
@@ -16828,6 +16991,35 @@ snapshots:
       - eslint-import-resolver-webpack
       - supports-color
 
+  eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1):
+    dependencies:
+      '@rtsao/scc': 1.1.0
+      array-includes: 3.1.9
+      array.prototype.findlastindex: 1.2.6
+      array.prototype.flat: 1.3.3
+      array.prototype.flatmap: 1.3.3
+      debug: 3.2.7
+      doctrine: 2.1.0
+      eslint: 8.57.1
+      eslint-import-resolver-node: 0.3.10
+      eslint-module-utils: 2.12.1(@typescript-eslint/parser@7.2.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1))(eslint@8.57.1)
+      hasown: 2.0.3
+      is-core-module: 2.16.1
+      is-glob: 4.0.3
+      minimatch: 3.1.5
+      object.fromentries: 2.0.8
+      object.groupby: 1.0.3
+      object.values: 1.2.1
+      semver: 6.3.1
+      string.prototype.trimend: 1.0.9
+      tsconfig-paths: 3.15.0
+    optionalDependencies:
+      '@typescript-eslint/parser': 7.2.0(eslint@8.57.1)(typescript@5.9.3)
+    transitivePeerDependencies:
+      - eslint-import-resolver-typescript
+      - eslint-import-resolver-webpack
+      - supports-color
+
   eslint-plugin-jsx-a11y@6.10.2(eslint@8.57.1):
     dependencies:
       aria-query: 5.3.2
@@ -17031,16 +17223,6 @@ snapshots:
     transitivePeerDependencies:
       - supports-color
 
-  expo-constants@55.0.14(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(typescript@5.9.3):
-    dependencies:
-      '@expo/config': 55.0.15(typescript@5.9.3)
-      '@expo/env': 2.1.1
-      expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-    transitivePeerDependencies:
-      - supports-color
-      - typescript
-
   expo-dev-client@4.0.29(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
@@ -17073,7 +17255,7 @@ snapshots:
       expo-dev-menu-interface: 1.8.4(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       semver: 7.7.4
 
-  expo-document-picker@11.7.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
+  expo-document-picker@12.0.2(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
 
@@ -17090,23 +17272,18 @@ snapshots:
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
 
-  expo-image-loader@55.0.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
+  expo-image-loader@4.7.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
 
-  expo-image-picker@55.0.19(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
+  expo-image-picker@15.1.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
-      expo-image-loader: 55.0.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
+      expo-image-loader: 4.7.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
 
-  expo-image@55.0.9(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native-web@0.19.13(react-dom@18.2.0(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
+  expo-image@1.13.0(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      sf-symbols-typescript: 2.2.0
-    optionalDependencies:
-      react-native-web: 0.19.13(react-dom@18.2.0(react@18.2.0))(react@18.2.0)
 
   expo-json-utils@0.13.1: {}
 
@@ -17114,16 +17291,13 @@ snapshots:
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
 
-  expo-linking@55.0.13(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(typescript@5.9.3):
+  expo-linking@6.3.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
     dependencies:
-      expo-constants: 55.0.14(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(typescript@5.9.3)
+      expo-constants: 16.0.2(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       invariant: 2.2.4
-      react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
     transitivePeerDependencies:
       - expo
       - supports-color
-      - typescript
 
   expo-manifests@0.14.3(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))):
     dependencies:
@@ -17151,25 +17325,25 @@ snapshots:
     dependencies:
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
 
-  expo-router@3.5.24(3uvatxgwuo3u64yzrd3pvxnccy):
+  expo-router@3.5.24(cquuc5ycyjexai4b474uj66fie):
     dependencies:
-      '@expo/metro-runtime': 3.2.3(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
-      '@expo/server': 0.4.4(typescript@5.9.3)
+      '@expo/metro-runtime': 3.2.3(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+      '@expo/server': 0.4.4(typescript@5.3.3)
       '@radix-ui/react-slot': 1.0.1(react@18.2.0)
-      '@react-navigation/bottom-tabs': 6.5.20(@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      '@react-navigation/native': 6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      '@react-navigation/native-stack': 6.9.26(@react-navigation/native@6.1.18(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@react-navigation/bottom-tabs': 6.5.20(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@react-navigation/native': 6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@react-navigation/native-stack': 6.9.26(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-screens@3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       expo: 51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
       expo-constants: 16.0.2(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
-      expo-linking: 55.0.13(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(typescript@5.9.3)
+      expo-linking: 6.3.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-splash-screen: 0.27.7(expo-modules-autolinking@1.11.3)(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
       expo-status-bar: 1.12.1
       react-native-helmet-async: 2.0.4(react@18.2.0)
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react-native-screens: 3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-safe-area-context: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-screens: 3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       schema-utils: 4.3.3
     optionalDependencies:
-      react-native-reanimated: 3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-reanimated: 3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
     transitivePeerDependencies:
       - encoding
       - expo-modules-autolinking
@@ -17451,7 +17625,7 @@ snapshots:
       - encoding
       - supports-color
 
-  firebase@11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))):
+  firebase@11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))):
     dependencies:
       '@firebase/analytics': 0.10.11(@firebase/app@0.11.1)
       '@firebase/analytics-compat': 0.2.17(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
@@ -17460,8 +17634,8 @@ snapshots:
       '@firebase/app-check-compat': 0.3.18(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
       '@firebase/app-compat': 0.2.50
       '@firebase/app-types': 0.9.3
-      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
-      '@firebase/auth-compat': 0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
+      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
+      '@firebase/auth-compat': 0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
       '@firebase/data-connect': 0.3.0(@firebase/app@0.11.1)
       '@firebase/database': 1.0.12
       '@firebase/database-compat': 2.0.3
@@ -17484,7 +17658,7 @@ snapshots:
     transitivePeerDependencies:
       - '@react-native-async-storage/async-storage'
 
-  firebase@11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))):
+  firebase@11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))):
     dependencies:
       '@firebase/analytics': 0.10.11(@firebase/app@0.11.1)
       '@firebase/analytics-compat': 0.2.17(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
@@ -17493,8 +17667,41 @@ snapshots:
       '@firebase/app-check-compat': 0.3.18(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
       '@firebase/app-compat': 0.2.50
       '@firebase/app-types': 0.9.3
-      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
-      '@firebase/auth-compat': 0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
+      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
+      '@firebase/auth-compat': 0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))
+      '@firebase/data-connect': 0.3.0(@firebase/app@0.11.1)
+      '@firebase/database': 1.0.12
+      '@firebase/database-compat': 2.0.3
+      '@firebase/firestore': 4.7.8(@firebase/app@0.11.1)
+      '@firebase/firestore-compat': 0.3.43(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)
+      '@firebase/functions': 0.12.2(@firebase/app@0.11.1)
+      '@firebase/functions-compat': 0.3.19(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
+      '@firebase/installations': 0.6.12(@firebase/app@0.11.1)
+      '@firebase/installations-compat': 0.2.12(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)
+      '@firebase/messaging': 0.12.16(@firebase/app@0.11.1)
+      '@firebase/messaging-compat': 0.2.16(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
+      '@firebase/performance': 0.7.0(@firebase/app@0.11.1)
+      '@firebase/performance-compat': 0.2.13(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
+      '@firebase/remote-config': 0.5.0(@firebase/app@0.11.1)
+      '@firebase/remote-config-compat': 0.2.12(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
+      '@firebase/storage': 0.13.6(@firebase/app@0.11.1)
+      '@firebase/storage-compat': 0.3.16(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)
+      '@firebase/util': 1.10.3
+      '@firebase/vertexai': 1.0.4(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)
+    transitivePeerDependencies:
+      - '@react-native-async-storage/async-storage'
+
+  firebase@11.3.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))):
+    dependencies:
+      '@firebase/analytics': 0.10.11(@firebase/app@0.11.1)
+      '@firebase/analytics-compat': 0.2.17(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
+      '@firebase/app': 0.11.1
+      '@firebase/app-check': 0.8.11(@firebase/app@0.11.1)
+      '@firebase/app-check-compat': 0.3.18(@firebase/app-compat@0.2.50)(@firebase/app@0.11.1)
+      '@firebase/app-compat': 0.2.50
+      '@firebase/app-types': 0.9.3
+      '@firebase/auth': 1.9.0(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
+      '@firebase/auth-compat': 0.5.18(@firebase/app-compat@0.2.50)(@firebase/app-types@0.9.3)(@firebase/app@0.11.1)(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1)))
       '@firebase/data-connect': 0.3.0(@firebase/app@0.11.1)
       '@firebase/database': 1.0.12
       '@firebase/database-compat': 2.0.3
@@ -17701,8 +17908,6 @@ snapshots:
 
   getenv@1.0.0: {}
 
-  getenv@2.0.0: {}
-
   glob-parent@5.1.2:
     dependencies:
       is-glob: 4.0.3
@@ -17728,12 +17933,6 @@ snapshots:
       package-json-from-dist: 1.0.1
       path-scurry: 1.11.1
 
-  glob@13.0.6:
-    dependencies:
-      minimatch: 10.2.5
-      minipass: 7.1.3
-      path-scurry: 2.0.2
-
   glob@7.1.6:
     dependencies:
       fs.realpath: 1.0.0
@@ -18729,8 +18928,6 @@ snapshots:
 
   lru-cache@10.4.3: {}
 
-  lru-cache@11.3.5: {}
-
   lru-cache@5.1.1:
     dependencies:
       yallist: 3.1.1
@@ -19038,10 +19235,6 @@ snapshots:
 
   mimic-fn@4.0.0: {}
 
-  minimatch@10.2.5:
-    dependencies:
-      brace-expansion: 5.0.5
-
   minimatch@3.1.5:
     dependencies:
       brace-expansion: 1.1.14
@@ -19149,11 +19342,11 @@ snapshots:
 
   napi-postinstall@0.3.4: {}
 
-  nativewind@4.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3)):
+  nativewind@4.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3)):
     dependencies:
       comment-json: 4.6.2
       debug: 4.4.3
-      react-native-css-interop: 0.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3))
+      react-native-css-interop: 0.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3))
       tailwindcss: 3.4.19(tsx@4.21.0)(yaml@2.8.3)
     transitivePeerDependencies:
       - react
@@ -19498,11 +19691,6 @@ snapshots:
       lru-cache: 10.4.3
       minipass: 7.1.3
 
-  path-scurry@2.0.2:
-    dependencies:
-      lru-cache: 11.3.5
-      minipass: 7.1.3
-
   path-to-regexp@0.1.13: {}
 
   path-to-regexp@3.3.0: {}
@@ -19674,14 +19862,14 @@ snapshots:
     transitivePeerDependencies:
       - debug
 
-  posthog-react-native@3.16.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(@react-navigation/native@7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo-file-system@17.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)):
+  posthog-react-native@3.16.1(@react-native-async-storage/async-storage@1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)))(@react-navigation/native@6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(expo-file-system@17.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)):
     dependencies:
-      react-native-svg: 15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-svg: 15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
     optionalDependencies:
-      '@react-native-async-storage/async-storage': 1.23.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
-      '@react-navigation/native': 7.2.2(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@react-native-async-storage/async-storage': 1.23.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))
+      '@react-navigation/native': 6.1.18(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       expo-file-system: 17.0.1(expo@51.0.39(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0)))
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-safe-area-context: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
 
   prelude-ls@1.2.1: {}
 
@@ -19875,9 +20063,7 @@ snapshots:
 
   react-is@18.3.1: {}
 
-  react-is@19.2.5: {}
-
-  react-native-css-interop@0.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3)):
+  react-native-css-interop@0.2.3(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-svg@15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)(tailwindcss@3.4.19(tsx@4.21.0)(yaml@2.8.3)):
     dependencies:
       '@babel/helper-module-imports': 7.28.6
       '@babel/traverse': 7.29.0
@@ -19885,34 +20071,35 @@ snapshots:
       debug: 4.4.3
       lightningcss: 1.27.0
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      react-native-reanimated: 3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native-reanimated: 3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       semver: 7.7.4
       tailwindcss: 3.4.19(tsx@4.21.0)(yaml@2.8.3)
     optionalDependencies:
-      react-native-safe-area-context: 4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react-native-svg: 15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-safe-area-context: 4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-svg: 15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
     transitivePeerDependencies:
       - supports-color
 
-  react-native-draggable-flatlist@4.0.3(@babel/core@7.29.0)(react-native-gesture-handler@2.31.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)):
+  react-native-draggable-flatlist@4.0.3(@babel/core@7.29.0)(react-native-gesture-handler@2.16.2(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0))(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)):
     dependencies:
       '@babel/preset-typescript': 7.28.5(@babel/core@7.29.0)
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
-      react-native-gesture-handler: 2.31.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
-      react-native-reanimated: 3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native-gesture-handler: 2.16.2(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      react-native-reanimated: 3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
     transitivePeerDependencies:
       - '@babel/core'
       - supports-color
 
-  react-native-gesture-handler@2.31.1(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
+  react-native-gesture-handler@2.16.2(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
     dependencies:
       '@egjs/hammerjs': 2.0.17
-      '@types/react-test-renderer': 19.1.0
       hoist-non-react-statics: 3.3.2
       invariant: 2.2.4
+      lodash: 4.18.1
+      prop-types: 15.8.1
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
 
   react-native-helmet-async@2.0.4(react@18.2.0):
     dependencies:
@@ -19921,7 +20108,7 @@ snapshots:
       react-fast-compare: 3.2.2
       shallowequal: 1.1.0
 
-  react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
+  react-native-reanimated@3.10.1(@babel/core@7.29.0)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
     dependencies:
       '@babel/core': 7.29.0
       '@babel/plugin-transform-arrow-functions': 7.27.1(@babel/core@7.29.0)
@@ -19933,37 +20120,36 @@ snapshots:
       convert-source-map: 2.0.0
       invariant: 2.2.4
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
     transitivePeerDependencies:
       - supports-color
 
-  react-native-safe-area-context@4.10.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
+  react-native-safe-area-context@4.10.5(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
     dependencies:
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
 
-  react-native-screens@3.31.0(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
+  react-native-screens@3.31.1(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
     dependencies:
       react: 18.2.0
       react-freeze: 1.0.4(react@18.2.0)
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
       warn-once: 0.1.1
 
-  react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
+  react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0))(react@18.2.0):
     dependencies:
       css-select: 5.2.2
       css-tree: 1.1.3
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
+      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0)
       warn-once: 0.1.1
 
-  react-native-svg@15.15.4(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0))(react@18.2.0):
+  react-native-svg@15.2.0(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0):
     dependencies:
       css-select: 5.2.2
       css-tree: 1.1.3
       react: 18.2.0
-      react-native: 0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0)
-      warn-once: 0.1.1
+      react-native: 0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0)
 
   react-native-web@0.19.13(react-dom@18.2.0(react@18.2.0))(react@18.2.0):
     dependencies:
@@ -19980,7 +20166,7 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
-  react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0):
+  react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0):
     dependencies:
       '@jest/create-cache-key-function': 29.7.0
       '@react-native-community/cli': 13.6.4
@@ -19992,7 +20178,7 @@ snapshots:
       '@react-native/gradle-plugin': 0.74.81
       '@react-native/js-polyfills': 0.74.81
       '@react-native/normalize-colors': 0.74.81
-      '@react-native/virtualized-lists': 0.74.81(@types/react@18.2.79)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
+      '@react-native/virtualized-lists': 0.74.81(@types/react@18.3.28)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0))(react@18.2.0)
       abort-controller: 3.0.0
       anser: 1.4.10
       ansi-regex: 5.0.1
@@ -20021,7 +20207,7 @@ snapshots:
       ws: 6.2.3
       yargs: 17.7.2
     optionalDependencies:
-      '@types/react': 18.2.79
+      '@types/react': 18.3.28
     transitivePeerDependencies:
       - '@babel/core'
       - '@babel/preset-env'
@@ -20030,7 +20216,7 @@ snapshots:
       - supports-color
       - utf-8-validate
 
-  react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0):
+  react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1):
     dependencies:
       '@jest/create-cache-key-function': 29.7.0
       '@react-native-community/cli': 13.6.4
@@ -20042,7 +20228,57 @@ snapshots:
       '@react-native/gradle-plugin': 0.74.81
       '@react-native/js-polyfills': 0.74.81
       '@react-native/normalize-colors': 0.74.81
-      '@react-native/virtualized-lists': 0.74.81(@types/react@18.3.28)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.2.0))(react@18.2.0)
+      '@react-native/virtualized-lists': 0.74.81(@types/react@18.3.28)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))(react@18.3.1)
+      abort-controller: 3.0.0
+      anser: 1.4.10
+      ansi-regex: 5.0.1
+      base64-js: 1.5.1
+      chalk: 4.1.2
+      event-target-shim: 5.0.1
+      flow-enums-runtime: 0.0.6
+      invariant: 2.2.4
+      jest-environment-node: 29.7.0
+      jsc-android: 250231.0.0
+      memoize-one: 5.2.1
+      metro-runtime: 0.80.12
+      metro-source-map: 0.80.12
+      mkdirp: 0.5.6
+      nullthrows: 1.1.1
+      pretty-format: 26.6.2
+      promise: 8.3.0
+      react: 18.3.1
+      react-devtools-core: 5.3.2
+      react-refresh: 0.14.2
+      react-shallow-renderer: 16.15.0(react@18.3.1)
+      regenerator-runtime: 0.13.11
+      scheduler: 0.24.0-canary-efb381bbf-20230505
+      stacktrace-parser: 0.1.11
+      whatwg-fetch: 3.6.20
+      ws: 6.2.3
+      yargs: 17.7.2
+    optionalDependencies:
+      '@types/react': 18.3.28
+    transitivePeerDependencies:
+      - '@babel/core'
+      - '@babel/preset-env'
+      - bufferutil
+      - encoding
+      - supports-color
+      - utf-8-validate
+
+  react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0):
+    dependencies:
+      '@jest/create-cache-key-function': 29.7.0
+      '@react-native-community/cli': 13.6.9
+      '@react-native-community/cli-platform-android': 13.6.9
+      '@react-native-community/cli-platform-ios': 13.6.9
+      '@react-native/assets-registry': 0.74.87
+      '@react-native/codegen': 0.74.87(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+      '@react-native/community-cli-plugin': 0.74.87(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+      '@react-native/gradle-plugin': 0.74.87
+      '@react-native/js-polyfills': 0.74.87
+      '@react-native/normalize-colors': 0.74.87
+      '@react-native/virtualized-lists': 0.74.87(@types/react@18.2.79)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.2.79)(react@18.2.0))(react@18.2.0)
       abort-controller: 3.0.0
       anser: 1.4.10
       ansi-regex: 5.0.1
@@ -20071,7 +20307,7 @@ snapshots:
       ws: 6.2.3
       yargs: 17.7.2
     optionalDependencies:
-      '@types/react': 18.3.28
+      '@types/react': 18.2.79
     transitivePeerDependencies:
       - '@babel/core'
       - '@babel/preset-env'
@@ -20080,19 +20316,19 @@ snapshots:
       - supports-color
       - utf-8-validate
 
-  react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1):
+  react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1):
     dependencies:
       '@jest/create-cache-key-function': 29.7.0
-      '@react-native-community/cli': 13.6.4
-      '@react-native-community/cli-platform-android': 13.6.4
-      '@react-native-community/cli-platform-ios': 13.6.4
-      '@react-native/assets-registry': 0.74.81
-      '@react-native/codegen': 0.74.81(@babel/preset-env@7.29.2(@babel/core@7.29.0))
-      '@react-native/community-cli-plugin': 0.74.81(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
-      '@react-native/gradle-plugin': 0.74.81
-      '@react-native/js-polyfills': 0.74.81
-      '@react-native/normalize-colors': 0.74.81
-      '@react-native/virtualized-lists': 0.74.81(@types/react@18.3.28)(react-native@0.74.0(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))(react@18.3.1)
+      '@react-native-community/cli': 13.6.9
+      '@react-native-community/cli-platform-android': 13.6.9
+      '@react-native-community/cli-platform-ios': 13.6.9
+      '@react-native/assets-registry': 0.74.87
+      '@react-native/codegen': 0.74.87(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+      '@react-native/community-cli-plugin': 0.74.87(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))
+      '@react-native/gradle-plugin': 0.74.87
+      '@react-native/js-polyfills': 0.74.87
+      '@react-native/normalize-colors': 0.74.87
+      '@react-native/virtualized-lists': 0.74.87(@types/react@18.3.28)(react-native@0.74.5(@babel/core@7.29.0)(@babel/preset-env@7.29.2(@babel/core@7.29.0))(@types/react@18.3.28)(react@18.3.1))(react@18.3.1)
       abort-controller: 3.0.0
       anser: 1.4.10
       ansi-regex: 5.0.1
@@ -20129,6 +20365,7 @@ snapshots:
       - encoding
       - supports-color
       - utf-8-validate
+    optional: true
 
   react-refresh@0.14.2: {}
 
@@ -20522,8 +20759,6 @@ snapshots:
 
   setprototypeof@1.2.0: {}
 
-  sf-symbols-typescript@2.2.0: {}
-
   shallow-clone@3.0.1:
     dependencies:
       kind-of: 6.0.3
@@ -21263,6 +21498,8 @@ snapshots:
 
   typedarray@0.0.6: {}
 
+  typescript@5.3.3: {}
+
   typescript@5.9.3: {}
 
   ua-parser-js@1.0.41: {}
diff --git a/scripts/docs/extract-bmad-trace.ts b/scripts/docs/extract-bmad-trace.ts
index ccdb282..3eb5c4f 100644
--- a/scripts/docs/extract-bmad-trace.ts
+++ b/scripts/docs/extract-bmad-trace.ts
@@ -220,7 +220,14 @@ export async function generate(root: string): Promise<Record<string, unknown>> {
     planned: frs.filter(f => f.status === 'planned').length,
   };
 
-  return { generated: new Date().toISOString(), summary, frs, gaps };
+  return {
+    generated: new Date().toISOString(),
+    statusAuthority: 'docs/agent-context/current-state.json',
+    note: 'Traceability is a requirement lookup and explicit-gap seed. Use current-state.json plus code evidence for completion claims.',
+    summary,
+    frs,
+    gaps,
+  };
 }
 
 if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
diff --git a/scripts/docs/scan-docs.ts b/scripts/docs/scan-docs.ts
index d64ea1d..cecd035 100644
--- a/scripts/docs/scan-docs.ts
+++ b/scripts/docs/scan-docs.ts
@@ -6,10 +6,25 @@ import { globSync } from 'fast-glob';
 const __filename = fileURLToPath(import.meta.url);
 const __dirname = dirname(__filename);
 
-type DocKind = 'requirements' | 'plan' | 'spec' | 'review' | 'adr' | 'research' | 'runbook' | 'audit' | 'other';
+type DocKind =
+  | 'handoff'
+  | 'status'
+  | 'overview'
+  | 'requirements'
+  | 'plan'
+  | 'spec'
+  | 'review'
+  | 'adr'
+  | 'research'
+  | 'runbook'
+  | 'audit'
+  | 'other';
 
 function inferKind(p: string): DocKind {
-  if (p.includes('docs/adr/')) return 'adr';
+  if (p === 'docs/AGENT-START-HERE.md') return 'handoff';
+  if (p === 'docs/current-implementation-status.md') return 'status';
+  if (p === 'docs/functional-overview.md') return 'overview';
+  if (p.includes('docs/adr/') || p.includes('_bmad-output/planning-artifacts/adr/')) return 'adr';
   if (p.includes('superpowers/specs')) return 'spec';
   if (p.includes('superpowers/plans')) return 'plan';
   if (p.includes('/reviews/')) return 'review';
@@ -23,13 +38,18 @@ function inferKind(p: string): DocKind {
 function inferAvoid(p: string): boolean {
   return (
     p.startsWith('_bmad-output/planning-artifacts/research/') ||
+    p.startsWith('_bmad-output/planning-artifacts/adr/') ||
     p.includes('docs/reviews/') ||
     p.includes('docs/superpowers/plans/') ||
+    p === 'docs/code-truth-completion-audit-2026-05-04.md' ||
     p.endsWith('.html')
   );
 }
 
 function inferReadWhen(kind: DocKind, p: string): string {
+  if (kind === 'handoff') return 'first file for every future coding or planning session';
+  if (kind === 'status') return 'checking current implementation status or launch gaps';
+  if (kind === 'overview') return 'needing product, functional, architecture, and UI/UX context in human-readable form';
   if (kind === 'adr') return 'checking architecture decisions';
   if (kind === 'spec') return 'implementing or reviewing a specific story';
   if (kind === 'plan') return 'executing a specific story — read only that story\'s plan';
@@ -57,7 +77,11 @@ export async function generate(root: string): Promise<Record<string, unknown>> {
       estimatedTokens: Math.ceil(lineCount * 10),
       readWhen: inferReadWhen(kind, normPath),
       avoidByDefault: inferAvoid(normPath),
-      supersededBy: null as string | null,
+      supersededBy: normPath === 'docs/code-truth-completion-audit-2026-05-04.md'
+        ? 'docs/current-implementation-status.md'
+        : normPath.startsWith('_bmad-output/planning-artifacts/adr/')
+          ? normPath.replace('_bmad-output/planning-artifacts/adr/', 'docs/adr/')
+          : null as string | null,
     };
   });
 
diff --git a/scripts/docs/scan-repo-context.ts b/scripts/docs/scan-repo-context.ts
index 1b2d7ef..3e1e554 100644
--- a/scripts/docs/scan-repo-context.ts
+++ b/scripts/docs/scan-repo-context.ts
@@ -8,13 +8,13 @@ const __dirname = dirname(__filename);
 function getApiModules(root: string): string[] {
   const dir = join(root, 'apps/api/src/modules');
   if (!existsSync(dir)) return [];
-  return readdirSync(dir).filter(f => statSync(join(dir, f)).isDirectory()).sort();
+  return readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory()).sort();
 }
 
 function getCurrentMigration(root: string): string {
   const dir = join(root, 'packages/db/src/migrations');
   if (!existsSync(dir)) return '0000';
-  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
+  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
   return files.length ? files[files.length - 1].split('_')[0] : '0000';
 }
 
@@ -55,13 +55,13 @@ function extractInvariants(claudeMd: string): string[] {
     }
   }
   const hardcoded = [
-    'auditLog(pool, {action, subjectType, subjectId, actorUserId}) from @goldsmith/audit — never audit.emit(tx, ...)',
+    'auditLog(pool, {action, subjectType, subjectId, actorUserId}) from @goldsmith/audit - never audit.emit(tx, ...)',
     'Use import (not import type) for NestJS @Injectable constructor params',
     'No Goldsmith platform brand on any customer-facing surface',
-    'All new @Injectable constructors need explicit @Inject(Token) — tsx/esbuild drops paramtypes',
+    'All new @Injectable constructors need explicit @Inject(Token) - tsx/esbuild drops paramtypes',
   ];
   for (const h of hardcoded) {
-    if (!invariants.some(i => i.startsWith(h.slice(0, 20)))) invariants.push(h);
+    if (!invariants.some((i) => i.startsWith(h.slice(0, 20)))) invariants.push(h);
   }
   return invariants;
 }
@@ -70,16 +70,44 @@ export async function generate(root: string): Promise<Record<string, unknown>> {
   const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
   const appsDir = join(root, 'apps');
   const apps = readdirSync(appsDir)
-    .filter(f => statSync(join(appsDir, f)).isDirectory())
-    .map(name => ({ name, path: `apps/${name}` }));
+    .filter((f) => statSync(join(appsDir, f)).isDirectory())
+    .map((name) => ({ name, path: `apps/${name}` }));
 
   return {
     generated: new Date().toISOString(),
     repo: 'Goldsmith',
     description: 'Multi-tenant white-label jewellery platform for local Indian jewellers',
+    readOrder: [
+      'docs/AGENT-START-HERE.md',
+      'docs/agent-context/project.context.json',
+      'docs/agent-context/current-state.json',
+      'docs/agent-context/implementation-map.json',
+      'docs/agent-context/task-routing.json',
+    ],
+    sourceOfTruth: {
+      completionClaims: 'current code, migrations, reachable UI routes, tests, and CI gates',
+      functionalRequirements: [
+        '_bmad-output/planning-artifacts/prd.md',
+        'docs/prd-addendum-customer-storefront.md',
+      ],
+      architectureDecisions: [
+        '_bmad-output/planning-artifacts/architecture.md',
+        'docs/adr/*.md',
+        'docs/agent-context/decision-index.json',
+      ],
+      uiUxRules: [
+        'CLAUDE.md',
+        'docs/functional-overview.md',
+        '_bmad-output/planning-artifacts/ux-design-specification.md',
+      ],
+      currentStatus: [
+        'docs/current-implementation-status.md',
+        'docs/agent-context/current-state.json',
+      ],
+    },
     stack: {
       api: 'NestJS (TypeScript) + PostgreSQL 15 + Drizzle + Redis + BullMQ',
-      mobile: 'React Native (Expo SDK 50) + NativeWind',
+      mobile: 'React Native (Expo SDK 51) + NativeWind',
       web: 'Next.js 14 (App Router) + Tailwind CSS + shadcn/ui',
       auth: 'Firebase Auth (phone OTP)',
       storage: 'Azure Blob Storage + ImageKit CDN',
@@ -90,7 +118,10 @@ export async function generate(root: string): Promise<Record<string, unknown>> {
     packages: getPackages(root),
     apiModules: getApiModules(root),
     commands: {
-      dev: 'pnpm dev',
+      'start:api': 'pnpm --filter @goldsmith/api start',
+      'dev:shopkeeper': 'pnpm --filter @goldsmith/shopkeeper start',
+      'dev:customer-mobile': 'pnpm --filter @goldsmith/customer-mobile start',
+      'dev:customer-web': 'pnpm --filter @goldsmith/customer-web dev',
       typecheck: 'pnpm typecheck',
       lint: 'pnpm lint',
       'test:unit': 'pnpm test:unit',
@@ -103,7 +134,16 @@ export async function generate(root: string): Promise<Record<string, unknown>> {
     },
     invariants: extractInvariants(claudeMd),
     ceremonyClasses: {
-      A: ['auth', 'money', 'RLS', 'compliance', 'platform-admin', 'migrations touching RLS/roles/SECURITY DEFINER', 'webhook handlers', 'encryption'],
+      A: [
+        'auth',
+        'money',
+        'RLS',
+        'compliance',
+        'platform-admin',
+        'migrations touching RLS/roles/SECURITY DEFINER',
+        'webhook handlers',
+        'encryption',
+      ],
       B: ['products', 'customers', 'dashboards', 'notification prefs', 'settings', 'search', 'reports'],
       C: ['copy tweaks', 'colors/spacing', 'config-toggles', 'doc-only', 'refactors <50 LOC', 'dep bumps'],
     },
@@ -115,12 +155,11 @@ export async function generate(root: string): Promise<Record<string, unknown>> {
   };
 }
 
-// CLI entry point — only runs when this file is the direct entrypoint
 if (process.argv[1]?.toLowerCase() === __filename.toLowerCase()) {
   const repoRoot = resolve(__dirname, '../..');
   const outPath = join(repoRoot, 'docs/agent-context/project.context.json');
-  generate(repoRoot).then(result => {
+  generate(repoRoot).then((result) => {
     writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
-    console.log('✓ project.context.json written');
-  }).catch(err => { console.error(err); process.exit(1); });
+    console.log('project.context.json written');
+  }).catch((err) => { console.error(err); process.exit(1); });
 }
diff --git a/scripts/docs/validate-agent-context.ts b/scripts/docs/validate-agent-context.ts
index 21056fb..2bff98f 100644
--- a/scripts/docs/validate-agent-context.ts
+++ b/scripts/docs/validate-agent-context.ts
@@ -7,12 +7,14 @@ const __dirname = dirname(__filename);
 
 // Import all generators — tsx resolves .js imports to .ts source files
 import { generate as genContext } from './scan-repo-context.js';
+import { generate as genImplementationMap } from './scan-implementation-map.js';
+import { generate as genCurrentState } from './scan-current-state.js';
 import { generate as genAdrs } from './extract-adrs.js';
 import { generate as genTrace } from './extract-bmad-trace.js';
 import { generate as genDocs } from './scan-docs.js';
 import { generate as genAcceptance } from './extract-acceptance.js';
 
-const ARRAY_KEYS = ['frs', 'adrs', 'docs', 'stories', 'routes'] as const;
+const ARRAY_KEYS = ['frs', 'adrs', 'docs', 'stories', 'routes', 'apps', 'areas', 'apiControllers'] as const;
 // Keys that are volatile and should be excluded from drift comparison
 const VOLATILE_KEYS = ['generated', 'generatedAt', 'generated_at'] as const;
 
@@ -88,6 +90,8 @@ async function main(root: string): Promise<void> {
   const outDir = join(root, 'docs/agent-context');
   const generators = [
     { name: 'project.context.json', fn: genContext },
+    { name: 'implementation-map.json', fn: genImplementationMap },
+    { name: 'current-state.json', fn: genCurrentState },
     { name: 'decision-index.json', fn: genAdrs },
     { name: 'traceability.json', fn: genTrace },
     { name: 'doc-index.json', fn: genDocs },
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied
warning: in the working copy of '.eslintrc.cjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'CLAUDE.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/api/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/api/src/modules/auth/auth.module.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/api/src/modules/catalog/catalog.service.spec.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/api/src/modules/catalog/catalog.service.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/api/src/modules/reviews/reviews.repository.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/api/src/modules/tenant-boot/tenant-boot.service.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/api/test/auth-link-migration.integration.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/app.config.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/app/(tabs)/profile.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/app/rate-lock/index.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/src/api/client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/src/hooks/useCustomerTimeline.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-mobile/test/profile.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/app/contact/page.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/app/layout.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/app/page.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/app/products/[id]/page.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/app/products/page.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/app/return-policy/page.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/lib/api.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/middleware.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/customer-web/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app.config.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app/(auth)/phone.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app/(tabs)/_layout.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app/_layout.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app/index.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app/settings/account.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app/settings/audit-log.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/app/settings/staff.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/babel.config.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/expo-env.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/metro.config.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/src/api/client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/src/api/endpoints.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/src/lib/api-client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/src/providers/AuthProvider.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/test/AuthProvider.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/test/otp.screen.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'apps/shopkeeper/test/phone.screen.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/agent-context/acceptance-evidence.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/agent-context/decision-index.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/agent-context/doc-index.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/agent-context/project.context.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/agent-context/task-routing.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/agent-context/traceability-seed.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/agent-context/traceability.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/functional-overview.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'packages/db/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'packages/db/test/poison-default.integration.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'packages/db/test/with-tenant-tx.integration.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'packages/sync/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'packages/sync/test/integration/adr-0004-conformance.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'packages/sync/test/integration/sync-cycle.integration.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'packages/sync/test/integration/tenant-isolation.integration.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'pnpm-lock.yaml', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/docs/extract-bmad-trace.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/docs/scan-docs.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/docs/scan-repo-context.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/docs/validate-agent-context.ts', LF will be replaced by CRLF the next time Git touches it

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --stat 5c361c14f136f8ccf45b3daecbe0545971106d71; git diff --name-status 5c361c14f136f8ccf45b3daecbe0545971106d71' in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:47:32.814054Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:47:32.824095Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --stat 5c361c14f136f8ccf45b3daecbe0545971106d71' in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:47:35.799000Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:47:35.806671Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:47:38.030363Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:47:38.032841Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command pwd in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:47:40.397538Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:47:40.400234Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Write-Output hello' in C:\Users\alokt\AppData\Local\Temp
2026-05-06T18:47:43.257211Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:47:43.258688Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
mcp: codex/list_mcp_resources started
mcp: codex/list_mcp_resources (completed)
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command Get-Location in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:47:49.444155Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:47:49.445867Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Start-Sleep -Seconds 1; Write-Output retry' in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:47:53.452488Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:47:53.454258Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "[Console]::Out.WriteLine('x')" in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:48:19.543188Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:48:19.545751Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '' in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:48:38.394232Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:48:38.395461Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
mcp: codex/list_mcp_resource_templates started
mcp: codex/list_mcp_resource_templates (completed)
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Write-Output ok' in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:50:01.621120Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:50:01.622360Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Write-Output ok' in C:\Alok\Business Projects\Goldsmith
2026-05-06T18:51:14.704363Z ERROR codex_core::exec: exec error: windows sandbox: setup refresh failed with status exit code: 0xc0000142
2026-05-06T18:51:14.705669Z ERROR codex_core::tools::router: error=execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
 exited -1 in 0ms:
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 0xc0000142" })
codex
I did not identify any discrete, actionable regressions in the inspected changes.
2026-05-06T18:51:24.450280Z ERROR codex_core::session: failed to record rollout items: thread 019dfe97-120a-7233-9e17-9a96bf7cf8d1 not found
2026-05-06T18:51:24.713930Z ERROR codex_core::session: failed to record rollout items: thread 019dfe97-0f0c-7c62-8150-e2841d593f36 not found
I did not identify any discrete, actionable regressions in the inspected changes.
