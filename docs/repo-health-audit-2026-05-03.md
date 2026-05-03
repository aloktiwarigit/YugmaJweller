# Repo Health Audit - 2026-05-03

This audit captures the state observed from the root worktree at
`C:/Alok/Business Projects/Goldsmith` on 2026-05-03.

## Executive status

| Area | Status | Evidence |
| --- | --- | --- |
| Root worktree | Clean, but not pushed | `main...origin/main [ahead 11]` |
| Local main | `53f6531` | Story 17.1 docs/spec handoff |
| Remote main | `3ad39ca` | GitHub `origin/main` |
| Remote CI | Red | Latest `ship` runs on `origin/main` failed |
| Deployment | Not proven | No deploy job, no GitHub deployments, no root deploy script |
| Open PRs | 2 | #41 Story 17.1 image pipeline, #32 valuation dashboard |
| Project memory | Stale | `.remember` canonical files last updated 2026-04-30 |
| Documentation images | Clean | No tracked image binaries under `docs/` or `_bmad-output/` |

## Source control

Local `main` is ahead of `origin/main` by 11 commits. These are Story 17.1
documentation, design-spec, plan, and review-trail commits. They are not on
GitHub, so remote CI has not run against the current local `main`.

Open GitHub PRs:

| PR | Branch | Status | Risk |
| --- | --- | --- | --- |
| #41 | `feat/story-17.1-image-pipeline` | Open, `UNSTABLE` | `integration` and `semgrep` failed; final build skipped |
| #32 | `feat/story-3.7-valuation-dashboard` | Open, `DIRTY` | Conflicting, no current check rollup |

Dirty sibling worktrees at audit time:

| Worktree | Branch | Dirty state |
| --- | --- | --- |
| `C:/gs-browse` | `feat/epic7-browse-huid-qr` | Untracked `.next/`, `next-env.d.ts`, review doc |
| `C:/gs-cust-mob` | `feat/epic7-customer-mobile-scaffold` | Untracked `nativewind-env.d.ts` |
| `C:/gs-cust-web` | `feat/epic7-customer-web-scaffold` | Modified `packages/observability/package.json` |
| `C:/gs-reviews` | `feat/epic7-reviews-wishlist` | Multiple modified API/web files plus untracked build/review artifacts |
| `C:/gscf` | `feat/epic7-customer-flows` | Modified `pnpm-lock.yaml` |

Notes:

- Several old branch tips appear in `git branch --no-merged main` even when
  their PRs were merged by GitHub. Treat branch ancestry as noisy because of
  squash merges.
- `feat/story-17.1-task8` is local-only and not an upstream-tracked branch.
- `docs/lean-story-protocol` is ahead of its upstream by 6 commits.

## CI and deployment

The only checked-in workflow is `.github/workflows/ship.yml`. It gates install,
typecheck, lint, unit, integration, tenant isolation, semgrep, Expo config,
shopkeeper tests, e2e YAML validation, Lighthouse stub, and build.

Local verification notes:

- Local shell is Node v24.13.1, while the repo expects Node `>=20.11.0 <21`;
  local results are useful but not CI-equivalent.
- `pnpm test:unit` passed in the root audit run.
- `pnpm --filter @goldsmith/shopkeeper test` passed.
- `pnpm --filter @goldsmith/customer-mobile test` passed.
- `pnpm --filter @goldsmith/ui-mobile test` passed.
- `pnpm --filter @goldsmith/db test:integration` failed locally at initial
  Testcontainers/Postgres `pool.connect()` with `read ECONNRESET`.
- `semgrep --config ops/semgrep/ --error --severity ERROR .` failed with 98
  blocking `ops.semgrep.goldsmith.require-tenant-transaction` findings.

No checked-in deployment automation was found:

- No deploy step in `.github/workflows/ship.yml`.
- No GitHub deployment records.
- Root `package.json` has no deploy script.
- `firebase.json` configures only the Auth emulator; `.firebaserc` points to
  `goldsmith-test`.
- No checked-in `vercel.json`, `netlify.toml`, `render.yaml`, `railway.json`,
  `fly.toml`, Dockerfile/compose, EAS, App Hosting, or Cloud Build deploy file.

Conclusion: the latest code is not proven deployed from this repository. Any
deployment, if it exists, is outside the checked-in automation and must be
verified in the hosting provider console.

## Feature and UI integration

Root `main` already contains these app surfaces:

- `apps/api`
- `apps/shopkeeper`
- `apps/customer-web`
- `apps/customer-mobile`

Root `main` does not contain Story 17.1 implementation. That implementation is
on PR #41 / `C:/gs17a-img`.

Confirmed fix applied during this audit in `C:/gs17a-img`:

- `apps/shopkeeper/app/inventory/_layout.tsx` now registers `[id]/images`.
- `apps/shopkeeper/app/inventory/[id]/edit.tsx` now exposes a link to
  `/inventory/:id/images`.
- Verification: `pnpm -F @goldsmith/shopkeeper typecheck` passed in
  `C:/gs17a-img` with a Node engine warning because local Node is v24.13.1
  while the repo expects Node `>=20.11.0 <21`.

Additional UI reachability fixes applied on root `main` during this audit:

- Shopkeeper billing tab now renders a hub linking to invoice, estimate,
  old-gold purchase, and barcode scan routes.
- Shopkeeper inventory is reachable from the bottom tabs.
- Shopkeeper inventory search rows now open the product edit route.
- Customer-web now has global header navigation to product, wishlist,
  try-at-home, rate-lock, loyalty, and return policy pages.
- Customer-web PDP CTAs now link to `/try-at-home` and `/rate-lock` instead of
  falling back to `/contact`.
- Customer-mobile PDP CTAs now route to `/try-at-home` and `/rate-lock` instead
  of showing placeholder alerts.

Remaining UI reachability gaps:

- Shopkeeper customers, rates, custom orders, and try-at-home routes exist but
  are not consistently reachable from primary navigation.
- Shopkeeper rate-lock booking feature components exist but are not mounted in
  an app route.
- Customer-mobile has duplicate dynamic product-detail route shapes:
  `browse/[id].tsx` and `browse/[productId].tsx`.
- Customer-mobile policy and size-guide screens exist but are not linked.

## Documentation and assets

`.remember` was stale relative to code:

- It said customer mobile and customer web were not started, but both app
  directories now exist.
- It reported migrations through `0046`; root `main` has 52 migration files,
  through `0056`.
- It reported green build/CI status from April 30, but current remote CI is red.
- It did not mention open PR #41, open PR #32, or the local `main` ahead state.

Image asset audit:

- `git ls-files '*.png' '*.jpg' '*.jpeg' '*.gif' '*.webp' '*.svg'` found only
  `apps/shopkeeper/assets/brand/placeholder-logo.svg`.
- No tracked image binaries exist under `docs/` or `_bmad-output/`.
- Documentation prototypes reference external Unsplash URLs, not committed
  stale image files.

## Priority gaps

| Priority | Gap | Next action |
| --- | --- | --- |
| P0 | Remote CI red on `main` and PR #41 | Fix semgrep/integration failures before any merge/deploy claim |
| P0 | Local `main` 11 commits ahead of `origin/main` | Push or intentionally hold these docs commits after review |
| P0 | No deploy automation | Decide target runtime and add deploy workflow before claiming latest code is live |
| P1 | PR #41 open and unstable | Resolve CI, then merge image pipeline |
| P1 | PR #32 open and conflicting | Rebase/resolve or close if superseded |
| P1 | Dirty sibling worktrees | Clean build artifacts, commit intentional changes, or archive branches |
| P1 | `.remember` stale | Use `.remember/current-state-2026-05-03.md` as the current session handoff |
