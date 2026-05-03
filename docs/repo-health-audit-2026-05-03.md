# Repo Health Audit - 2026-05-03

This audit captures the merge sweep from the root worktree at
`C:/Alok/Business Projects/Goldsmith` on 2026-05-03.

## Executive Status

| Area | Status | Evidence |
| --- | --- | --- |
| Root branch | `main`, ahead of `origin/main` | `main...origin/main [ahead 12]` before the pending sweep commit |
| Root HEAD before pending sweep commit | `cf8138e` | `chore(sweep): hook implemented features into UI` |
| Remote main | `3ad39ca` | `origin/main` |
| Worktree | Dirty by design | Pending tenant DB, API route, Semgrep, docs, and lockfile fixes |
| API typecheck | Pass | `pnpm -F @goldsmith/api typecheck` |
| API targeted tests | Pass | 7 files, 73 tests |
| API integration slice | Pass | 37 files, 240 tests with Redis/Firebase env and `--no-file-parallelism --maxWorkers=1` |
| Semgrep ERROR gate | Pass | `semgrep --config ops/semgrep/ --error --severity ERROR --quiet .` |
| Deployment | Not proven | No checked-in deploy workflow/script/provider config found |
| Documentation images | Clean | No tracked docs image binaries found |

Local verification was run on Node v24.13.1. The repository requires
Node `>=20.11.0 <21`, and CI pins Node `20.11.0`, so CI must still be treated
as authoritative after the sweep is pushed.

## Integrated In This Sweep

- Added shared tenant transaction helper `withShopTx(pool, shopId, fn)` and
  kept `withTenantTx` as the request-context wrapper.
- Moved tenant-scoped raw DB access in catalog, analytics, CRM, billing,
  custom orders, rate-lock, try-at-home, reviews, and wishlist paths behind
  tenant transaction helpers.
- Added explicit platform-global DB helpers for cross-tenant platform-admin
  operations and updated the Semgrep rule to allow only reviewed platform
  global paths.
- Fixed `CatalogModule` dependency wiring by importing `AuthModule`.
- Restored public/customer API routes:
  - `/api/v1/reviews`
  - `/api/v1/wishlist`
  - `/api/v1/try-at-home/bookings`
- Preserved public review privacy: public review list items omit `customerId`.
- Added migration `0059_reviews_wishlist_update_grant.sql` so review upsert
  has the required `UPDATE` grant without mutating historical migration `0047`.
- Added API Vitest setup to prefer IPv4 DNS. This fixes Windows/Testcontainers
  `localhost` connection resets without changing production runtime behavior.
- Integrated the observability package drift from `C:/gs-cust-web` and updated
  `pnpm-lock.yaml` so frozen install is not blocked by the `pino` specifier.

## Git And PR Status

| Item | Status | Action |
| --- | --- | --- |
| Root `main` | Pending sweep commit | Commit this doc plus code/test/security fixes, then push |
| PR #41 `feat/story-17.1-image-pipeline` | Open, previously `UNSTABLE` | Rebase after root sweep commit; push local `0380e33` route-hook commit; rerun CI |
| PR #32 `feat/story-3.7-valuation-dashboard` | Open, stale/dirty | Close or supersede after confirming no unique functionality remains |
| `C:/gs17a-img` | Clean, ahead by one local commit | Push/rebase after root is green |
| `C:/gs-browse` | Generated artifacts only | Do not merge `.next/`, `next-env.d.ts`, or local review doc |
| `C:/gs-cust-mob` | Generated artifact only | Do not merge `nativewind-env.d.ts` unless the app intentionally tracks it |
| `C:/gs-reviews` | Useful API fixes recovered | Ignore generated customer-web build output and superseded review docs |
| `C:/gscf` | Lockfile concern reviewed | Root lockfile now includes the observability specifier fix |

## Verification Matrix

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm -F @goldsmith/db build` | Pass | Rebuilt shared DB package after transaction helper changes |
| `pnpm -F @goldsmith/api typecheck` | Pass | API compiles after route/helper changes |
| Targeted API Vitest set | Pass | 7 files, 73 tests |
| `semgrep --config ops/semgrep/ --error --severity ERROR --quiet .` | Pass | ERROR gate clean after tenant DB policy update |
| API integration slice | Pass | `REDIS_URL=redis://127.0.0.1:6379`, Firebase emulator on `127.0.0.1:9099`, sequential workers |
| `pnpm install --lockfile-only` | Pass | Lockfile drift corrected; existing peer warnings remain |

The broad `pnpm -F @goldsmith/api test` run initially failed locally because it
ran container-backed integration specs in parallel and used `localhost` on
Windows/Node v24. After adding the IPv4 Vitest setup and running the CI-like
integration slice with constrained workers, all API integration tests passed.

## UI Hook Status

Root `main` already includes a checkpoint commit for UI reachability:

- Shopkeeper billing tab opens a billing hub.
- Shopkeeper inventory is in the tab bar.
- Inventory search rows open product edit.
- Customer web has header navigation to core customer journeys.
- Customer web and customer mobile PDP CTAs route to try-at-home and rate-lock.

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
- No GitHub deployment records observed during the sweep.
- No checked-in `vercel.json`, `netlify.toml`, `render.yaml`, `railway.json`,
  `fly.toml`, Dockerfile/compose deployment, EAS production profile, App
  Hosting, or Cloud Build deploy file.

Before claiming production is current, verify the actual provider console,
deployed commit SHA, database migration level, CDN/storage provider config, and
mobile build channel.

## Docs And Assets

- No tracked docs image binaries were found under `docs/`, `.remember`, or
  `_bmad-output`.
- The only tracked image-like asset found in the repo scan was
  `apps/shopkeeper/assets/brand/placeholder-logo.svg`.
- `_bmad-output` prototypes reference external Unsplash URLs and should remain
  prototype-only, not product documentation.
- Older Story 17.1 review rounds are audit trail only; use the latest PR/spec
  state instead of earlier review notes.

## Merge Plan

1. Commit the root sweep fixes on `main`.
2. Rerun CI-equivalent gates under Node 20.11.0 if available, otherwise rely on
   GitHub CI after push.
3. Push `main` and wait for `ship.yml`.
4. Rebase PR #41 onto the swept `main`, push the local image-route commit, and
   rerun checks.
5. Close or explicitly supersede PR #32 after confirming it has no unique
   production functionality.
6. Only then verify deployment provider state and update runbook/deploy docs.
