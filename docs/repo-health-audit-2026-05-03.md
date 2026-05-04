# Repo Health Audit - Final Sweep

This audit captures the merge/deploy/documentation sweep from the root worktree
at `C:/Alok/Business Projects/Goldsmith`, completed on 2026-05-04.

## Executive Status

| Area | Status | Evidence |
| --- | --- | --- |
| Root branch | `main`, synced with `origin/main` | final HEAD `ac8482f` |
| Main CI | Pass | GitHub Actions `ship` run `25295498104` |
| Open PRs | None | `gh pr list --state open` returned `[]` |
| PR #41 | Merged | `feat/story-17.1-image-pipeline` merged into `main` as `ac8482f` |
| PR #32 | Closed unmerged | stale/dirty `feat/story-3.7-valuation-dashboard`, superseded by merge-train work |
| Deployment | Not proven | no checked-in deploy workflow/script/provider config found |
| Documentation images | Clean | no tracked docs image binaries found |

Local verification during the sweep was run on Node v24.13.1. The repository
requires Node `>=20.11.0 <21`, and CI pins Node `20.11.0`, so GitHub CI remains
the authoritative gate.

## Integrated In The Root Sweep

- Added shared tenant transaction helper `withShopTx(pool, shopId, fn)` and
  kept `withTenantTx` as the request-context wrapper.
- Moved tenant-scoped raw DB access in catalog, analytics, CRM, billing,
  custom orders, rate-lock, try-at-home, reviews, and wishlist paths behind
  tenant transaction helpers.
- Added explicit platform-global DB helpers for cross-tenant platform-admin
  operations and tightened the Semgrep tenant DB rule.
- Fixed `CatalogModule` dependency wiring by importing `AuthModule`.
- Restored public/customer API routes for reviews, wishlist, and try-at-home
  bookings.
- Preserved public review privacy: public review list items omit `customerId`.
- Added migration `0059_reviews_wishlist_update_grant.sql` without mutating
  historical migration `0047`.
- Added API Vitest IPv4 setup for Windows/Testcontainers stability.
- Integrated the observability package drift from `C:/gs-cust-web` and updated
  `pnpm-lock.yaml`.

## Integrated From PR #41

- Product image pipeline migrations `0057` and `0058`.
- Inventory product image API, repository, service, RLS, tenant-isolation, and
  concurrency coverage.
- Azure Blob/ImageKit URL plumbing and stub malware-scan adapter.
- Shopkeeper product image management screen.
- Customer web and customer mobile product galleries.
- Shared `@goldsmith/ui-web` `ResponsiveImage` atom.

## Verification Matrix

| Command or gate | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Pass | root and PR #41 worktree |
| `pnpm -F @goldsmith/db build` | Pass | rebuilt shared DB package |
| `pnpm -F @goldsmith/api typecheck` | Pass | API compiles after route/helper changes |
| Targeted API Vitest set | Pass | 7 files, 73 tests |
| API integration slice | Pass | 37 files, 240 tests |
| PR #41 image pipeline slice | Pass | 9 files, 85 tests |
| `semgrep --config ops/semgrep/ --error --severity ERROR --quiet .` | Pass | tenant DB policy clean |
| Workspace `pnpm typecheck` | Pass | local sweep gate |
| GitHub Actions `ship` on `main` | Pass | run `25295498104`, merge commit `ac8482f` |

GitHub Actions still emits a Node 20 action-runtime deprecation warning for
`actions/checkout`, `actions/setup-node`, and `pnpm/action-setup`. It is a
future maintenance item, not a current CI failure.

## UI Hook Status

Confirmed reachable in `main`:

- Shopkeeper billing tab opens a billing hub.
- Shopkeeper inventory is in the tab bar.
- Inventory search rows open product edit.
- Product image management is linked from product edit.
- Customer web has header navigation to core customer journeys.
- Customer web and customer mobile PDPs include product galleries and CTAs for
  try-at-home/rate-lock flows.

Remaining UI gaps to schedule separately:

- Shopkeeper customers, rates, custom orders, and try-at-home screens are not
  consistently reachable from primary navigation.
- Shopkeeper rate-lock booking components exist but still need app-route
  mounting.
- Customer mobile has duplicate product detail route shapes:
  `browse/[id].tsx` and `browse/[productId].tsx`.
- Customer mobile policy and size-guide screens exist but need navigation links.

## Deployment Truth

The latest code is not proven deployed from this repository.

No checked-in deployment automation was found:

- No deploy job in `.github/workflows/ship.yml`.
- No root deploy script.
- No `infra/`, Terraform, `azure.yaml`, `azd`, Docker deployment file, EAS
  production profile, Vercel/Netlify/Render/Railway/Fly config, Firebase
  Hosting/App Hosting, Cloud Build, or Amplify config.
- `firebase.json` and `.firebaserc` configure the Firebase Auth emulator and
  default test project only; they do not define hosting/functions deployment.

Before claiming production is current, verify the actual provider console,
deployed commit SHA, database migration level, CDN/storage provider config, and
mobile build channel. The deploy story must add repo-backed deployment and
rollback instructions before this runbook can be used operationally.

## Docs And Assets

- No tracked docs image binaries were found under `docs/`, `.remember`, or
  `_bmad-output`.
- The only tracked image-like asset found in the repo scan was
  `apps/shopkeeper/assets/brand/placeholder-logo.svg`.
- `_bmad-output` prototypes reference external Unsplash URLs and should remain
  prototype-only, not product documentation.
- `docs/runbook.md` deployment instructions were corrected to remove stale
  commands for missing deploy scripts, infrastructure directories, and
  Terraform paths.

## Final State

1. Root `main` is merged, pushed, and green.
2. PR #41 is merged.
3. PR #32 is closed as stale/superseded.
4. No open PRs remain.
5. Deployment remains the only unproven area because the repository has no
   executable deploy path.
