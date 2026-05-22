# Stranded Work Inventory — 2026-05-21

Forensic audit on 2026-05-21 identified **5 pieces of functionality** that were built but never landed on `main`. This document is the recovery manifest — every commit is pinned by an annotated git tag (also pushed to `origin`) so the work cannot be lost.

## Provenance

- Triggered by: rates display showing hardcoded ₹7,350 in the customer-mobile demo APK
- Investigation: traced from `GET /api/v1/catalog/rates` → `source: metalsdev` (stub) → discovered the real `goldapi.io` adapter sitting in `stash@{0}` → comprehensive audit of all stashes + branches
- Audit method: `git cherry main <ref>` for every local + remote branch; full content read of `stash@{0}`; verification that suspected squash-merge candidates have their files actually present on `main`

## Status: PROTECTED

Each item is pinned by an annotated tag (`stranded/*-2026-05-21`). Tags are immutable refs. Even if the source stash is dropped or the source branch deleted, the commits remain reachable via the tag. Tags are pushed to `origin` for triple-redundancy (local refs + remote refs + this doc with SHAs).

To list the lockbox:
```bash
git tag -l 'stranded/*'
```

To inspect any item:
```bash
git show <tag-name>          # commit + diff
git log -1 <tag-name>        # message only
git diff main <tag-name>     # what would be added if recovered
```

---

## Item 1 — goldapi.io adapter ✅ DEMO-CRITICAL

| Field | Value |
|---|---|
| Tag | `stranded/goldapi-adapter-2026-05-21` |
| Commit SHA | `e1b769423517e2312dfb77f1bd67a5db55620fb4` |
| Original location | `stash@{0}` (orphan, no branch — labelled `detached-head-wip`) |
| Author date | 2026-05-18 14:58:14 -0400 |
| Files | `packages/integrations/rates/src/ibja-adapter.ts` (+181), `apps/api/src/modules/pricing/pricing.module.ts` (~46), `apps/customer-web/package.json` (2), `pnpm-lock.yaml` (2) |
| Total | 4 files, +139/-92 |
| Ceremony class | **A** (pricing/money surface) |
| Conflict expectation | **Medium** — `pricing.module.ts` has been re-edited since the stash (today's queue-runtime + redis-client extraction in commit `4ac47b5`). Cron-pattern lines from stash need to merge with current `BullModule.registerQueue` structure. |

### What it does

Replaces the dead `IbjaAdapter` (which calls `api.gold-api.com`, failing with `getaddrinfo ENOTFOUND` from Cloud Run) with a real goldapi.io implementation:

- Reads `GOLDAPI_KEY` env var (already set on Cloud Run — verified via `gcloud run services describe`)
- Calls `https://www.goldapi.io/api/XAU/INR` and `XAG/INR` with `x-access-token` header — returns per-gram INR directly, no FX math
- 9-hour in-memory cache survives Redis outages (independent of Upstash)
- Cron rewired from every-15-min + hourly (~50/day, blows free tier in 2 days) to **3x/day at 09:00 / 13:00 / 18:00 IST** — fits the 100/month free tier with margin
- Karat derivation linear from 24K (same as current)
- Throws `RatesAdapterError` on quota exhaustion → fallback chain → LKG cache

### Why it matters

Today's production API returns hardcoded `₹7,350/g` 24K from the `MetalsDevAdapter` stub (which has a literal `// STUB:` comment). The "IBJA" adapter that fronts it is calling a dead domain. Live rates have been broken silently since whenever `gold-api.com` went down — the stub masks the failure.

### Recovery procedure

```bash
git checkout -b feat/rates-goldapi-recovery main

# Apply the stranded work. Tag points at the stash commit (a special 3-parent merge commit).
git stash apply stranded/goldapi-adapter-2026-05-21

# Conflict-prone file: pricing.module.ts (today's queue-runtime refactor vs stash's cron rewrite)
# Resolve by:
#   - Keep today's areQueueWorkersEnabled() guard + createRedisClient() imports
#   - Take stash's REFRESH_MORNING_CRON / MIDDAY_CRON / EVENING_CRON constants
#   - Take stash's onModuleInit logic (3x/day pattern, drop the every-15-min cron registrations)

# Verify ibja-adapter.ts reads GOLDAPI_KEY correctly
grep -n "GOLDAPI_KEY\|getApiKey" packages/integrations/rates/src/ibja-adapter.ts

# Local smoke against live goldapi.io (uses a quota call — ~1 of your 100/month)
GOLDAPI_KEY=<your-key> curl -H "x-access-token: $GOLDAPI_KEY" https://www.goldapi.io/api/XAU/INR

# Standard ceremony gate
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm semgrep
# Class A — Codex review required before merge per CLAUDE.md ceremony

# Then: remove or guard MetalsDevAdapter so the stub never silently masks failures again
# (recommended addendum, not in stash)
```

---

## Item 2 — customer-mobile demo P0s (3 commits) ✅ DEMO-CRITICAL

| Field | Value |
|---|---|
| Tag | `stranded/customer-mobile-demo-p0s-2026-05-21` (points at tip) |
| Tip SHA | `49325f535ff3a5163cb8e10d30f90c7715fbf81c` |
| Original location | local branch `feat/customer-mobile-demo-p0s` (126 commits behind main) |
| Author dates | 2026-05-15 20:03–20:05 -0400 |
| Ceremony class | **C** (visual polish, no behavior change) |
| Conflict expectation | **Low–Medium** — all three target customer-mobile files that have likely been edited since (today's commit `8822035` touched several customer-mobile screens) |

### Commits in tag

| SHA | Subject | Files |
|---|---|---|
| `3fd623e` | fix(mobile): Devanagari fontFamily on wishlist + policy + size-guide (P0) | `app/(tabs)/wishlist.tsx`, `app/browse/policy.tsx`, `app/browse/size-guide.tsx` (20+/20-) |
| `7f0e2ef` | fix(mobile): replace placeholder grey View with product image in PDP recommendations (P0) | `app/browse/[id].tsx` (+26/-3) |
| `49325f5` | fix(mobile): remove stray 'use client' directive from RN file (P0) | `app/(tabs)/browse.tsx` (-1) |

### Why it matters

A Hindi-speaking jeweller demoing this app will see three core screens (wishlist, return-policy, size-guide) rendering in OS-fallback fonts instead of the Yatra One / Mukta design system fonts. The PDP recommendations carousel shows grey rectangles where product photos should be. The `'use client'` directive (a Next.js construct) in a React Native file is at best a warning and at worst a future runtime break.

### Recovery procedure

```bash
git checkout -b feat/customer-mobile-demo-p0s-recovery main

# Cherry-pick the three commits in order
git cherry-pick 3fd623e0108c2b983c76b5aac419aca87df1feb6
git cherry-pick 7f0e2eff41f0a1266c83afde693a5a0882911d30
git cherry-pick 49325f535ff3a5163cb8e10d30f90c7715fbf81c

# Likely conflict points (today's screen edits in commit 8822035):
#   - apps/customer-mobile/app/(tabs)/wishlist.tsx (today: wishlist cache integration)
#   - apps/customer-mobile/app/browse/[id].tsx (today: cleaner empty/error states)
# Resolve by keeping today's behavior changes AND the stranded fontFamily/image fixes.

pnpm typecheck && pnpm lint
# Class C — no Codex review needed; smoke-test on device before merge
```

---

## Item 3 — customer-web SEO ⚠️ NOT DEMO-CRITICAL

| Field | Value |
|---|---|
| Tag | `stranded/customer-web-demo-p0s-2026-05-21` |
| Commit SHA | `52074d5b29a9775e73056d7cff0b020456b19add` |
| Original location | local branch `feat/customer-web-demo-p0s` |
| Author date | 2026-05-15 20:04:10 -0400 |
| Files | `apps/customer-web/app/products/[id]/page.tsx` (+63) |
| Ceremony class | **C** (single-file SEO addition) |
| Conflict expectation | **Low** |

### What it does

Adds Next.js `generateMetadata` + Product JSON-LD structured data to the customer-web PDP. Helps Google understand the page as a product listing for organic search ranking.

### Why it's NOT demo-critical

You're demoing the Android app sideload-style in jewellers' shops, not directing prospects to the public web URL. SEO has zero impact on that flow. Land it before the public storefront launch (post-anchor SOW), not before the demo.

### Recovery procedure

```bash
git checkout -b feat/customer-web-seo-recovery main
git cherry-pick 52074d5b29a9775e73056d7cff0b020456b19add
pnpm typecheck && pnpm lint && pnpm test:unit
# Class C
```

---

## Item 4 — shopkeeper demo polish ✅ DEMO-CRITICAL

| Field | Value |
|---|---|
| Tag | `stranded/phase-1-polish-missing-2026-05-21` |
| Commit SHA | `975a43c626b5ed84834f4105c86cf3262eefe1f3` |
| Original location | local branch `feat/phase-1-polish` (this is the FIRST of two commits on the branch; the second `4a805c1` is already squash-merged to main) |
| Author date | 2026-05-05 19:58:04 -0400 |
| Files | `apps/shopkeeper/app/(tabs)/index.tsx`, `apps/shopkeeper/app/settings/{billing,index,reports}.tsx` (+57/-42) |
| Ceremony class | **C** (UI polish, no behavior change) |
| Conflict expectation | **Medium** — phase-1-polish is 275 commits behind main; shopkeeper UI has evolved substantially |

### What it does (from commit body)

- Wire dashboard CTAs: 'Staff जोड़ें' → `/settings/staff`, 'सेटिंग्स में जाएँ' → `/settings`
- Replace non-functional settings icon `View` with `Pressable` (Ionicons gear, navigates to `/settings`)
- Remove stub toast + `showStub` handler (Story 1.2 is complete; these are dev noise)
- Translate three English-only settings menu labels to Hindi
- Upgrade `settings/billing` and `settings/reports` from raw "जल्द आ रहा है" text to proper empty-state screens with icon + Hindi "यह जल्द उपलब्ध होगा" copy

### Why it matters

Exactly the kind of polish a jeweller notices in 30 seconds: tap a dashboard CTA → nothing happens (stub), tap settings gear → it's a non-functional View, see English-only labels in a Hindi-first app, navigate to billing → see raw stub text instead of a designed empty state.

### Recovery procedure

```bash
git checkout -b feat/shopkeeper-polish-recovery main
git cherry-pick 975a43c626b5ed84834f4105c86cf3262eefe1f3

# Likely conflicts in apps/shopkeeper/app/(tabs)/index.tsx — that file has been touched
# many times since this commit. Resolve by keeping current dashboard structure AND
# applying the CTA wiring + Pressable settings icon from the cherry-pick.

# Verify settings/billing.tsx and settings/reports.tsx exist (they may have been
# subsequently replaced with real implementations — in which case the empty-state
# fix is moot and the cherry-pick conflict can be resolved by taking the current main).

pnpm typecheck && pnpm lint
# Class C — smoke-test in shopkeeper app
```

---

## Item 5 — public repo safety cleanup ⚠️ SECURITY-RELEVANT

| Field | Value |
|---|---|
| Tag | `stranded/public-repo-safety-cleanup-2026-05-21` |
| Commit SHA | `1eff8419df68cf536de82141c1edfe34f42730dc` |
| Original location | local branch `chore/public-repo-safety-cleanup` (80 commits behind main) |
| Author date | 2026-05-17 20:42:12 -0400 |
| Ceremony class | **C** (CI workflow + gitignore) |
| Conflict expectation | **Low** (mostly new files + gitignore additions) |

### What it does

| File | Change |
|---|---|
| `.github/workflows/secret-scan.yml` | **+26 lines, new file** — secret scanning CI workflow |
| `.gitignore` (root) | +14 lines (additional ignores) |
| `apps/shopkeeper/.gitignore` | +5 lines, new file |
| `play-store/screenshots/flow-more-settings.png` | **DELETED** (826 KB binary that was accidentally committed) |
| `play-store/screenshots/flow-more-settings.xml` | DELETED (1 line) |

### Why it matters

This is hygiene + future-prevention:
- The accidentally-committed Play Store screenshots may contain real device data
- The secret-scan workflow prevents recurrence of secrets/binaries leaking into a public repo
- Important caveat: **deleting from current main does NOT remove the data from git history.** Since this repo is public on GitHub (`github.com/aloktiwarigit/YugmaJweller`), the binary is permanently in the history. The cleanup only stops further bleed. A history rewrite (`git filter-repo`) would be needed for true removal, but rewriting history on a public repo with collaborators / external clones is a separate, high-impact decision.

### Recovery procedure

```bash
git checkout -b chore/public-repo-safety-cleanup-recovery main
git cherry-pick 1eff8419df68cf536de82141c1edfe34f42730dc

# Verify the secret-scan workflow uses up-to-date action versions
# (today's commit fad2651 bumped to Node-24-compatible actions across the repo)
# This commit may need a follow-up bump.

pnpm typecheck  # workflow file changes don't need lint, but typecheck is cheap
# Class C — no review needed; merge after CI is green
```

### Follow-up to consider

Independent of this recovery, consider whether to:
1. Repeat the audit periodically with `gitleaks` or `truffleHog` against the full history
2. Decide on history-rewrite for `flow-more-settings.png` if it contains sensitive data

---

## Recommended recovery order

If recovering all 5:

| Step | Item | Reason for order |
|---|---|---|
| 1 | goldapi adapter | Highest demo impact (rate accuracy). Class A — most ceremony — do first while focused. |
| 2 | customer-mobile demo P0s (3 commits) | Direct visual impact; small risk; should land before any client demo. |
| 3 | shopkeeper demo polish | Same. |
| 4 | public repo safety cleanup | Important but not demo-blocking. |
| 5 | customer-web SEO | Defer until storefront launch. |

Realistic effort: **1.5–2 hours sequential** for all 5, with green CI between each.

---

## What we verified is NOT stranded (squash-merge artifacts)

These branches show `ahead` of main per `git rev-list --count`, but their work IS on main via squash-merge. **Safe to delete** when convenient:

| Branch | Verification |
|---|---|
| `origin/feat/storefront-schema-a1a3` | Migration `0066_products_storefront_columns.sql`, `0068_products_primary_image.sql` ✅ on main |
| `origin/feat/storefront-collections-a2` | Migration `0067_collections.sql` ✅ on main |
| `origin/feat/storefront-config-a5a6` | Migrations `0069_shop_storefront_config.sql`, `0070_product_reviews_visibility.sql` ✅ on main |
| `origin/feat/customer-shared-a4` | `packages/customer-shared/` ✅ on main with full package structure |
| `feat/phase-1-customer-mobile-fixes` | All 2 commits show `-` in `git cherry main` (squashed) |
| `feat/phase-1-demo-seed` | All 2 commits squashed |
| `feat/phase-1-shopkeeper-nav-wiring` | Commit squashed |
| `feat/phase-1-white-label-theming` | All 2 commits squashed |
| `backup/phase-a-merge-history` | Intentional history-preservation branch — leave alone |

**Stale memory note:** `MEMORY.md` entry `project_phase_a_storefront_complete.md` says "A4 (customer-shared package) not yet implemented". This is incorrect as of audit date — A4 IS on main. Update or remove that memory note.

## Stashes 1–24 — likely intermediate WIP

All 24 remaining stashes are tied to feature branches whose stories appear as **complete on main** (5.6, 5.9, 5.11, 6.1, 6.2, 6.8, 4.2, 4.6, 5.10/5.12). Most likely intermediate workflow WIPs from conflict-resolution / interruption events.

**Recommendation:** do NOT auto-recover any. Each one, if needed, should be inspected with `git stash show -p stash@{N}` against current main to determine if its content is already present. Most will be obsolete.

If you want to clean up: `git stash drop stash@{N}` per entry (irreversible — only do after confirming the content is in main).

---

## Lockbox cleanup commands (for future reference)

After all stranded items are recovered into main:

```bash
# Delete the source branches (work is on main, tags preserve history)
git branch -D feat/customer-mobile-demo-p0s feat/customer-web-demo-p0s
git branch -D feat/phase-1-polish chore/public-repo-safety-cleanup
git branch -D feat/phase-1-customer-mobile-fixes feat/phase-1-demo-seed
git branch -D feat/phase-1-shopkeeper-nav-wiring feat/phase-1-white-label-theming

# Drop the goldapi stash (tag preserves the SHA)
git stash drop stash@{0}

# Tags can stay forever — they're tiny and they're the receipt
# To list: git tag -l 'stranded/*'
# To delete a specific tag (if you really want to): git tag -d stranded/<name>; git push --delete origin stranded/<name>
```

---

## Sign-off

Audit completed 2026-05-21 by Claude Opus 4.7 under principal-architect review. All 5 stranded items pinned by annotated tags pushed to `origin`. This doc is committed to `main` as the canonical recovery manifest.

If a future session needs to recover any item: open this doc, jump to the relevant Item §, follow the Recovery procedure verbatim.
