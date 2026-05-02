# Pre-Launch Finishing — Fresh Session Prompt

> Use this prompt in a fresh Claude session AFTER all 6 waves are merged (which happened 2026-05-01, main HEAD `ed7900b`).
> The codebase is feature-complete. This session does the engineering work that was deferred during the campaign.

---

## PROMPT — Pre-Launch Finishing

```
You are doing the pre-launch engineering finishing work for the Goldsmith jewellery platform.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md
3. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\project_feature_complete_2026_05_01.md

Model tier: Sonnet 4.6 — most of this is mechanical (test runs, pushes, fixups). If on
Opus, suggest /model sonnet. Escalate to Opus only if a security review finding is
substantive enough to need correctness reasoning.

Context:
All 126 PRD FRs are coded and on main. 18 stories merged across 6 waves on
2026-04-29 → 2026-05-01. Migrations 0000–0055. 759 API unit tests passing. typecheck
+ lint clean. Main HEAD: ed7900b. Local-only — nothing pushed to origin yet.

This session closes the remaining engineering gaps. NOT a feature session.

Work scope (in dependency order — do NOT reorder):

## Step 1 — Verify main is still green
  cd "C:\Alok\Business Projects\Goldsmith"
  git pull
  git status               # expect clean tree, ahead of origin
  pnpm install
  pnpm typecheck && pnpm lint
  cd apps/api && pnpm exec vitest run src/    # expect 759 passing
Stop and report if anything is red.

## Step 2 — Codex review on Wave 6 (platform-admin)
The Wave 6 worktree at C:/gs-admin had Codex blocked by the Windows CLM bug
(see feedback_codex_worktree_clm.md). Now that the branch is merged to main,
run Codex against main from the full repo clone:

  cd "C:\Alok\Business Projects\Goldsmith"
  codex review --base origin/main HEAD~17..HEAD
  # That range covers all Wave 6 commits up to ed7900b.
  # If "origin/main" is unknown because we haven't pushed yet, use the pre-Wave-6 SHA:
  # codex review --base 945a84d HEAD

If Codex finds P1/P2 issues, fix them as new commits on main and re-run.
On success, write .codex-review-passed at the repo root with a one-line summary.

## Step 3 — Security review on Wave 6
Run /security-review focused on the Wave 6 surface — cross-tenant operations,
impersonation JWT handling, audit logging completeness. The platform_admin role
+ impersonation flow is the highest-risk surface in the entire codebase.

Specifically inspect:
- apps/api/src/modules/platform-admin/impersonation-token.ts (HS256 sign/verify)
- apps/api/src/modules/platform-admin/services/impersonation.service.ts (TTL, audit)
- apps/api/src/auth/firebase-jwt.strategy.ts (X-Impersonation-Token consumption path)
- packages/tenant-context/src/tenant.interceptor.ts (DB liveness double-check)
- apps/api/src/modules/platform-admin/services/data-export.service.ts (PII scope)
- apps/api/src/modules/platform-admin/services/metrics.service.ts (cross-tenant BYPASS)

Apply any P1 findings. Document P2 findings in docs/quality-gate-2026-05-01.md
for follow-up. Write .security-review-passed when complete.

## Step 4 — Integration tests (Testcontainers)
Wave 6 deferred two integration test files:
- apps/api/test/platform-admin.integration.test.ts
- apps/api/test/impersonation.integration.test.ts

These need Docker Desktop running on Windows for Testcontainers. If Docker is not
available, document that fact in the quality-gate doc and skip these — the unit
tests already cover the route wiring and service logic.

If Docker IS available, write the tests using the same pattern as existing
integration tests (see apps/api/test/audit-log.integration.test.ts for shape):
- platform-admin: createTenant → list → suspend → unsuspend → metrics
- impersonation: startImpersonation → verify GUC swap on a normal API call →
  endImpersonation → verify expired session is rejected (401)

## Step 5 — Customer-web Firebase Google sign-in
Wave 6 shipped customer-web /admin with paste-token MVP auth. Replace with proper
Firebase Web SDK Google sign-in:
- Install firebase package in apps/customer-web (it has none today)
- Use the same Firebase project as the shopkeeper app (per user_cloud_preference + the
  shared-Firebase decision in EPIC7-S0)
- /admin/login page with Google sign-in button → exchanges with /auth/session for
  a platform_admin JWT (the API endpoint already supports the role)
- Replace the paste-token flow in app/admin/page.tsx
- middleware.ts already short-circuits the root layout for /admin — keep that

## Step 6 — Push everything to origin
Only after Steps 1–5 are clean:
  git push origin main

Then for each unpushed feature branch (run `git branch -vv` to see which lack
upstream tracking), push them too — they're useful for audit trail:
  git push -u origin feat/story-compliance-str
  ... (one per branch)

## Step 7 — Update memory + retro
Save a feedback memory if anything in this finishing pass surprised you (e.g., a
Codex finding that should have been caught earlier in the campaign — that becomes a
"check this next campaign" memory).

Run /bmad-retrospective on the entire 6-wave campaign — focus on what worked
(parallel sessions, pre-assigned migrations, isolation domains) and what to change
next time (the billing.service.ts serialization chain caused the most merge
friction — was that worth it vs splitting into a billing-coordinator pattern?).

## What is OUT OF SCOPE for this session
- Anchor SOW negotiation (commercial)
- Azure provisioning (deferred until SOW)
- Apple/Google developer accounts (commercial decision)
- DPDPA legal review (legal team)
- External pentest (vendor engagement)
- Real-device smoke test on Ayodhya phone (needs the SOW + a real anchor)

If the user asks about any of those, redirect them to the feature-complete memory:
those are gates, not engineering work.

## Non-negotiable rules
- NEVER push --force to main
- NEVER skip git hooks (--no-verify) unless user explicitly asks
- Codex review on origin/main must be GREEN before push (no skipping the gate)
- All amounts in paise (bigint), never FLOAT (still applies to any fixes)
- TDD for any new test code: red → green → refactor
```

---

## How to use this prompt

1. Open a fresh Claude Code session in `C:\Alok\Business Projects\Goldsmith`
2. Paste the prompt block above (between the ``` markers)
3. The session will work through Steps 1–7 in order

## Estimated time

- Steps 1–4 (verification + reviews + tests): 2–3 hours
- Step 5 (Firebase sign-in): 1–2 hours
- Steps 6–7 (push + retro): 30 min

Total: ~4–5 hours for a clean shippable state. After that, only commercial/infra/legal blockers remain before anchor pilot launch.
