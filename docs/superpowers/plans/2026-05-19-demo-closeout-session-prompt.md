# Demo-Closeout Session Prompt — 2026-05-19

Copy everything below the `---` into a fresh Claude Code session opened in `C:\Alok\Business Projects\Goldsmith`. The session will close the last two demo-blocker gaps surfaced by the 2026-05-19 production-readiness audit, then run a visual QA sweep, total ~1 day.

---

# Session brief: Goldsmith demo closeout (2 parallel Class B stories + visual QA pass)

## Bootstrap reads (do these first, in order)

1. `CLAUDE.md` at the repo root — non-negotiable rules, ceremony tiers (A/B/C), worktree parallelism rules, Hindi-first design constraints, Maestro visual-QA section, the demo-first delivery model locked 2026-05-05.
2. `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md` — recent project state.
3. `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\project_demo_ready_audit_2026_05_19.md` — the verified-open gap list this session is closing.
4. `C:\Users\alokt\.claude\plans\this-project-is-ready-scalable-trinket.md` — the full audit file with evidence and reasoning.
5. `docs/code-truth-completion-audit-2026-05-04.md` — completion-claim evidence rules. You will use these when claiming "done" at the end.

Skim, do not deep-read research / BMAD docs. Stop reading once you've internalized the demo gaps + ceremony rules.

## Model tier

**Sonnet 4.6** — both stories are Class B per CLAUDE.md (routine UI implementation, locked screen templates, no Opus triggers). If launched on Opus, announce and request `/model sonnet` before proceeding per CLAUDE.md's mandatory self-classification rule.

## What needs to happen (the spec)

### Story Demo-1 — Reviews moderation screen (Class B)

**Goal:** A shopkeeper-only screen at `apps/shopkeeper/app/reviews/` that lets the OWNER role list pending customer reviews, see review body + star rating + product link + customer name, and APPROVE / REJECT each one. Backend already exists.

**Files to create:**
- `apps/shopkeeper/app/reviews/_layout.tsx` — Stack layout matching the pattern from `apps/shopkeeper/app/try-at-home/_layout.tsx`
- `apps/shopkeeper/app/reviews/index.tsx` — list view (pending first, then recently moderated); pull-to-refresh via TanStack Query
- `apps/shopkeeper/app/reviews/[id].tsx` — detail + approve/reject sheet
- Component: `apps/shopkeeper/src/features/reviews/components/ReviewCard.tsx` (one row in the list)
- Component: `apps/shopkeeper/src/features/reviews/components/ModerationSheet.tsx` (approve/reject confirm)

**Backend to call:**
- `grep -rn "ReviewsModerationController\|reviews\.controller\|reviews.service" apps/api/src/modules/` to find the existing endpoints — DO NOT add new ones; the audit confirmed they exist.
- Likely endpoints: `GET /api/v1/reviews?status=pending`, `POST /api/v1/reviews/:id/approve`, `POST /api/v1/reviews/:id/reject` — verify against actual code before wiring.
- Auth: respect existing RolesGuard; only OWNER + role with `reviews.moderate` permission can see the route.

**Navigation wiring:**
- Add a "Reviews" entry on the shopkeeper main tab nav at `apps/shopkeeper/app/(tabs)/_layout.tsx` (or wherever the tab bar is defined — read the existing tabs config first). Hindi label per CLAUDE.md.
- Add a Stack.Screen entry if needed.

### Story Demo-2 — FR65 customer viewing-history tile (Class B half-story)

**Goal:** On the shopkeeper customer detail screen, show a tile below `PurchaseHistoryList` listing the last ~10 products this specific customer has viewed (the "salesperson walks in, sees what they've been browsing" innovation from PRD FR65). Backend already exists per Wave 3B viewing analytics work.

**Files to create / modify:**
- New: `apps/shopkeeper/src/features/crm/components/CustomerViewingHistoryCard.tsx` — title, last-N viewed products, product thumb + name + viewed-at relative time, tap → product detail
- Modify: `apps/shopkeeper/app/customers/[id].tsx` — import and mount the new card directly below the `PurchaseHistoryList` mount at line 152 (or wherever it currently sits — verify line numbers fresh)

**Backend to call:**
- `grep -rn "ViewingAnalytics\|viewing-history\|product_views" apps/api/src/modules/` to find the existing endpoint that returns per-customer viewing history. There IS an `analytics.service.ts` from Wave 3B Story Viewing Analytics — verify which endpoint accepts a `customerId` filter. If the endpoint exists but does not support filtering by customer, that becomes a 5-line API addition; gate that as a Class A check (cross-tenant ownership) before writing.

**Empty state:**
- If the customer has no viewing history yet (likely on demo day for a fresh tenant), the card renders a tasteful empty state: small icon + Hindi line like "अभी तक कोई व्यू नहीं" + a faint suggestion to seed it. Do not render a blank card.

### Visual QA sweep (post-merge step, ~30 min)

After both stories merge:
1. Rename `apps/shopkeeper/assets/fonts/FONTS-TODO.md` → `apps/shopkeeper/assets/fonts/FONTS.md` (misleading filename; the TODO is done — confirmed in audit).
2. Per CLAUDE.md "Customer mobile visual QA with Maestro" section, boot the stack (Docker, API on :3001, Metro, Pixel_6_Pravesh AVD).
3. Run the existing Maestro sweep: `maestro test artifacts/maestro/customer-full-sweep.yaml` (verify the file exists; if it's `customer-tabs-smoke.yaml`, use that — `grep -l "" artifacts/maestro/*.yaml`).
4. Capture five screenshots via `adb shell screencap -p` + `adb pull` (per CLAUDE.md — do NOT use the PowerShell `adb exec-out` form, it corrupts PNGs):
   - customer home, customer PDP, shopkeeper dashboard, shopkeeper customer-detail (with new viewing-history tile), shopkeeper reviews list.
5. Side-by-side open against current Tanishq.com mobile + CaratLane mobile screenshots (use real images from the web, current 2026 design). If anything looks beige-block / blank-hero / generic-shadcn, file a P0 fix-up against THAT story before declaring demo-ready.
6. Save the five screenshots to `artifacts/maestro/demo-readiness-2026-05-19-{home,pdp,dashboard,customer-detail,reviews}.png`.

## Ceremony — Class B per CLAUDE.md (updated 2026-05-05)

For each of the two stories:

1. **Brainstorm-skip allowed.** Both follow locked templates already in the repo (try-at-home directory layout, LoyaltyCard / PurchaseHistoryList tile pattern). No fresh brainstorm.
2. **Write a small work-stream plan** to `docs/superpowers/plans/2026-05-19-story-demo-{1,2}-*.md` — 3-5 work streams, same session, ~30 min planning each. Include tests where there's behavior to verify (the moderation approve/reject branches; the empty-state branch on the viewing-history card).
3. **Default to worktree parallelism.** These two stories do not share blast radius (different modules, different files, no migration). Run them in parallel:
   ```powershell
   git worktree add C:/gs-demo1 feat/story-demo-1-reviews-moderation
   git worktree add C:/gs-demo2 feat/story-demo-2-fr65-viewing-history
   ```
   Each worktree gets its own implementer pass.
4. **TDD on business logic.** Render-plumbing without behavior can rely on typecheck + smoke; tests required for moderation approve/reject mutation logic + empty-state branch on the viewing-history card.
5. **Right-sized review gates:**
   - Per-task code review only on Class A subsurfaces. Neither story touches RLS / money / auth / compliance, so per-task review is skipped per the 2026-05-05 ceremony update.
   - Whole-branch code review before push — mandatory. Use the codex CLI if available (`codex review --base main`); if Codex weekly limit is hit per `feedback_codex_limit_batch_strategy.md`, fall back to `/security-review` only if the story adds a new attack surface (neither does; it's reading existing endpoints + writing UI), otherwise CI + typecheck + smoke is the documented substitute.
   - Re-review only if reviewer flagged a non-trivial issue.
6. **Runtime smoke test on intended surface** — mandatory:
   - Story Demo-1: emulator boot, navigate to Reviews tab, approve one mock review, reject another, verify list updates.
   - Story Demo-2: emulator boot, open a customer detail page, verify the viewing-history tile renders (empty state OR populated, both branches).
7. **Code-truth audit before claiming complete** — per `docs/code-truth-completion-audit-2026-05-04.md`:
   - `apps/shopkeeper/app/reviews/_layout.tsx` exists
   - `apps/shopkeeper/app/reviews/index.tsx` exists
   - `Stack.Screen` for reviews registered in the shopkeeper layout
   - Reviews route reachable from main tab nav (grep the tabs file)
   - `CustomerViewingHistoryCard` is imported and mounted in `customers/[id].tsx`
8. `git push` only after 6 + 7 pass.
9. PR both branches; merge demo-1 first if no conflicts, demo-2 second. Update `memory/MEMORY.md` with one-line completion entries for each.

## Non-negotiable rules (from CLAUDE.md — these always apply)

- **TypeScript strict, no FLOAT for weight, no cross-tenant queries, no hardcoded per-tenant values, no Goldsmith brand on customer surfaces, no compliance rules editable by shopkeeper.**
- **Hindi-first UI.** Use the existing token stack (`@goldsmith/ui-tokens`) for typography. Yatra One for headings, Mukta Vaani for body — these are already bundled and loaded per `apps/shopkeeper/app/_layout.tsx`. Do NOT default to Inter / Space Grotesk.
- **48dp touch targets, 16pt body min, ≥4.5:1 contrast.** Senior-friendly. The shopkeeper persona is 45-65 year old Ayodhya jewellers.
- **NativeWind + Tailwind tokens.** Don't write raw RGB hex; pull from `colors` in `@goldsmith/ui-tokens`.
- **Tenant scoping must be respected.** Every list call goes through the existing TanStack Query hook that injects `shopId` via the tenant interceptor. Don't write raw `pool.query` paths.
- **White-label brand check** — no "Goldsmith" string in any customer-facing output (the shopkeeper app is internal staff so this rule applies less, but still don't leak it).
- **Aspirational visual quality** — the user's global CLAUDE.md mandates Linear/Stripe/Cred-level polish. Every screen rendered must look like it could ship in a Sequoia-portfolio Series-A app, not a hackathon prototype. If the screen you wrote doesn't carry that intentionality (typography rhythm, color accent system, micro-spacing, semantic iconography, motion choreography), iterate before declaring done.

## Current state at session start

- Main HEAD: `73c798f` (1 commit ahead of origin per last audit; pull and confirm fresh on session start).
- Marker files present: `.bmad-readiness-passed`, `.codex-review-passed`, `.security-review-passed` (all dated within last 30 days; do not delete).
- Typecheck green across 30 packages.
- 68 migrations sequential, no gaps. **No new migrations needed** for either story — both consume existing backend.
- BullMQ recently fixed for ioredis client error handling (commit `f9bec9c`); do not touch queue setup.
- Codex weekly limit status: check `memory/feedback_codex_limit_batch_strategy.md` first; if limited, document substitute gate in commit message.

## Done definition for the session

- Two PRs merged to main (`feat/story-demo-1-reviews-moderation`, `feat/story-demo-2-fr65-viewing-history`).
- `apps/shopkeeper/assets/fonts/FONTS-TODO.md` renamed to `FONTS.md`.
- Five demo-readiness screenshots saved to `artifacts/maestro/demo-readiness-2026-05-19-*.png`.
- One-line MEMORY.md entries added for each story.
- One memory file (`project_demo_closeout_2026_05_19_complete.md`) summarizing what shipped.
- The 2026-05-19 audit file's verdict updates to **demo-ready: unconditional PASS**.

## Anti-patterns to avoid (drawn from prior session lessons in memory)

- Do **not** run the two implementers in the same working directory — always two worktrees (memory `feedback_parallel_session_worktrees.md`).
- Do **not** use `import type` for NestJS constructor params (memory `feedback_import_type_nestjs_di.md`). The mobile work shouldn't touch NestJS, but if the FR65 endpoint needs a `customerId` filter added, this rule kicks in.
- Do **not** trust on-disk file presence as "shipped" — always `git log --all -- <path>` before claiming done (memory `feedback_audit_must_check_git_not_disk.md`).
- Do **not** add new dependencies. Both stories should use only packages already in `package.json`.
- Do **not** mention `Generated with Claude Code` in commit messages or PR bodies unless explicitly asked.
- Do **not** start working on any of the P1 items (Azure IaC, PII encryption, adapter pattern, etc.) — those are out of scope for this session per ADR-0015 + startup-economics rule.

## First action

Read the bootstrap files in order. Then announce model tier per CLAUDE.md (one line). Then create the two worktrees and write the two work-stream plans. Then dispatch the two implementers in parallel.
