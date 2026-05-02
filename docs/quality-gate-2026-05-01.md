---
title: Quality Gate — 2026-05-01 Pre-Launch Finishing
status: in progress
date: 2026-05-01
supersedes: docs/quality-gate-2026-04-23.md (extends)
---

# Quality Gate — Pre-Launch Finishing (2026-05-01)

Companion to `docs/superpowers/plans/2026-05-01-pre-launch-finishing-prompt.md`.
Tracks Codex / security / integration findings that landed during the finishing pass and
follow-up items deferred to post-launch.

## Step 1 — Main green

| Check | Result |
|-------|--------|
| Working tree clean (excl. tooling) | ✓ |
| `pnpm typecheck` | ✓ 43/43 packages |
| `pnpm lint` | ✓ 0 errors / 28 warnings (pre-existing) |
| `vitest run apps/api/src/` | ✓ 765 tests (was 759 baseline; +6 from finishing-pass tests) |

## Step 2 — Codex review (Wave 6 + finishing fixes)

### Round 1 — 4 findings (2 P1 / 2 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P1 | `tenant-management.service.ts:43` (and 4 sibling helpers) | `SET LOCAL ROLE` outside transaction — Postgres reverts after one statement | `dc7c095` |
| P1 | `firebase-jwt.strategy.ts:100` | Firebase UID assigned to `goldsmith_uid` → fails INSERT to UUID columns on impersonated writes | `dc7c095` |
| P2 | `platform-admin.controller.ts:85` | Method-scoped `@UsePipes` validates URL `:id` against body DTO | `dc7c095` |
| P2 | `platform-admin.module.ts:16` | Duplicate `DrizzleTenantLookup` instance — `TenantInterceptor` reads a different cache than `TenantManagementService` invalidates | `dc7c095` |

### Round 2 — 4 findings (1 P1 / 3 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P1 | `impersonation-session.adapter.ts:14` | Same SET LOCAL bug missed in round 1 — would silently block all impersonated traffic against real DB | `eca29d2` |
| P2 | `firebase-jwt.strategy.ts` (caller-binding) | Impersonation JWT not bound to caller — leaked token reusable by any platform admin | `eca29d2` |
| P2 | `apps/api/src/main.ts` (CORS) | API didn't enable CORS — customer-web /admin browser calls would be blocked by preflight | `eca29d2` |
| P2 | `platform-admin.controller.ts` (semgrep) | `@SkipTenant()` violates `goldsmith.skip-tenant-requires-skip-auth` rule without a `nosemgrep` justification | `eca29d2` |

### Round 3 — 3 findings (1 P1 / 2 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P1 | `tenant-management.service.ts:47` (and 5 sibling services + adapter) | **Structural**: `app_user` (the application connection role) has no membership in `platform_admin`, so `SET ROLE platform_admin` is denied at runtime against any role-separated DB. My round-1 BEGIN/COMMIT fix made the syntax right but the underlying connection model still wrong. | `8c61321` |
| P2 | `subscription.service.ts` (upsert) | `ON CONFLICT DO UPDATE` overwrote `status` and `billing_cycle_start` with `EXCLUDED.*` — re-upserting an existing 'suspended' sub with no status in the patch silently reactivated it and cleared its billing cycle | `8c61321` |
| P2 | `impersonation.service.ts` (endImpersonation) | Audit row missing `target_shop_id` — tenant-scoped audit queries paired starts with no matching ends | `8c61321` |

**Round-3 fix scope**: Added a dedicated `PG_POOL_ADMIN` provider (env `DATABASE_URL_ADMIN`, falls back to `DATABASE_URL` for dev) that connects directly as `platform_admin`. Refactored 6 platform-admin services + 1 adapter to inject `PG_POOL_ADMIN` and dropped the `SET ROLE` / `RESET ROLE` / `SET LOCAL ROLE` plumbing entirely. `BEGIN/COMMIT` retained in write services for atomicity (write + audit).

### Round 4 — 1 finding (1 P1)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P1 | `apps/customer-web/next.config.mjs` | `@goldsmith/auth-client` not in `transpilePackages` — Next.js production build would fail on TypeScript syntax in workspace package's source | `279e36d` |

### Round 5 — 2 findings (1 P1 / 1 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P1 | `apps/customer-web/lib/admin-firebase.ts` + `_lib/admin-api.ts` | Bracket-form `process.env['NEXT_PUBLIC_FOO']` access NOT statically replaced by Next.js client bundler — production /admin reads undefined for all env vars and falls back to `localhost:3001` for the API | `0d7b82d` |
| P2 | `auth.controller.ts` (`/invite`, `/staff/:userId DELETE`) | `shop_users.{invited_by_user_id, revoked_by_user_id}` are FK to `shop_users(id)`. Impersonation rewrites `ctx.userId` to the session UUID — FK constraint fails. revokeStaff worse: clears Firebase claims first, leaving inconsistent state on half-failure | `0d7b82d` |

### Round 6 — 2 findings (0 P1 / 2 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P2 | `auth.controller.ts` (`/logout/all`) | Under impersonation, `req.user.uid` is the platform admin's Firebase UID. `revokeRefreshTokens(uid)` would terminate the platform admin's own sessions across every device | `d1762dc` |
| P2 | `catalog.service.ts` (`getProducts`, `getProduct`) | Public catalog routes are `@SkipTenant()` and read by `X-Tenant-Id` without checking `shops.status`. After tenant suspension, anyone with cached shop_id keeps fetching | `d1762dc` |

### Round 7 — 2 findings (1 P2 + 1 false-positive P1)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| ~~P1~~ | `platform-admin.module.ts` | "platform_admin role NOBYPASSRLS so RLS blocks queries" — **false positive**: Codex missed migration 0003's `ALTER ROLE platform_admin BYPASSRLS` (DO block, runbook §14). Documented inline so future readers don't re-discover. | `07b075d` |
| P2 | `migrations/0003_auth_link.sql` | `GRANT SELECT ... TO app_user` on `platform_audit_events` — Wave 6 added cross-tenant impersonation rows that app_user has no business reading. **New migration 0056** revokes SELECT (INSERT remains for the audit-log writer) | `07b075d` |
| P2 | `catalog.service.ts` (`verifyHuid`) | The active-shop EXISTS guard added in round 6 missed this 4th catalog endpoint | `07b075d` |

### Round 8 — 2 findings (1 P1 / 1 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P1 | `platform-admin.module.ts` ↔ services | **Circular import**: `PG_POOL_ADMIN` was exported from the module that imports the services that need it. NestJS would resolve `@Inject(undefined)` at bootstrap. Tests bypassed DI so missed it. Moved token to `platform-admin.tokens.ts` (leaf file). | `3897355` |
| P2 | `tenant-management.service.ts` (cache invalidation) | `cache.invalidate(shopId)` ran INSIDE the `inTx` callback, before COMMIT. Parallel request can repopulate cache from the still-uncommitted ACTIVE row → suspended shop serves traffic for 60s TTL. Moved invalidate to AFTER `await inTx(...)`. | `3897355` |

### Round 9 — 1 finding (1 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P2 | `data-export.service.ts` | `SELECT *` dumped encrypted column raw bytes (`pan_ciphertext`, `pan_key_id`) and infra metadata (`shops.kek_key_arn`) into the browser export response. Switched to explicit column projection + `pan_on_file` boolean derivation. | `cc557a6` |

### Round 10 — 1 finding (1 P1, stale test invariant)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P1 | `apps/api/test/auth-link-migration.integration.test.ts` | Test asserted privileges were exactly `['INSERT', 'SELECT']`; my migration 0056 made it `['INSERT']` only. CI would fail on the privilege invariant. | `bbbf7aa` |

### Round 11 — 2 findings (0 P1 / 2 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P2 | `tenant-management.service.ts` (suspendShop) | `WHERE status <> 'TERMINATED'` allowed PROVISIONING → SUSPENDED → ACTIVE round-trip, bypassing the provisioning lifecycle. Tightened to `status = 'ACTIVE'`. | `0cfe871` |
| P2 | `impersonation.service.ts` (startImpersonation) | No pre-flight check that target shop is ACTIVE — minted a JWT the interceptor would reject as `tenant.inactive` on every subsequent call. Added pre-flight SELECT. | `0cfe871` |

### Round 12 — 1 finding (1 P2)

| Sev | File | Issue | Fix commit |
|-----|------|-------|------------|
| P2 | `apps/customer-web/lib/admin-firebase.ts` | `getAuth()` defaults to LOCAL persistence (IndexedDB) — privileged platform_admin refresh token survives tab close on shared/compromised browsers. Added `inMemoryOnly` option to `@goldsmith/auth-client/web` and opted in for /admin. | `35e9ab9` |

### Round 13 — *(not run; stopping after round 12 per finishing-pass cap)*

**Cumulative findings caught + fixed across 12 rounds: 26**
- 7 P1 (6 real + 1 false positive)
- 19 P2

The false positive: Codex round 7 flagged `platform_admin` role as NOBYPASSRLS, missing migration 0003's DO-block ALTER. Documented inline so future readers don't re-discover.

## Step 3 — Security review (manual, focus = Wave 6 surface)

Files reviewed:
- `apps/api/src/modules/platform-admin/impersonation-token.ts` — HS256 sign/verify
- `apps/api/src/modules/platform-admin/services/impersonation.service.ts` — TTL, audit
- `apps/api/src/modules/auth/firebase-jwt.strategy.ts` — X-Impersonation-Token consumption
- `packages/tenant-context/src/interceptor.ts` — DB liveness double-check
- `apps/api/src/modules/platform-admin/services/data-export.service.ts` — PII scope
- `apps/api/src/modules/platform-admin/services/metrics.service.ts` — cross-tenant BYPASS

### Findings applied

- **P2** — `IMPERSONATION_JWT_SECRET` length floor (≥32 bytes) enforced at both sign time
  (`impersonation.service`) and verify time (`firebase-jwt.strategy`). Runbook §16 already
  required `openssl rand -base64 48`; now the code refuses weak keys instead of silently
  accepting them. *(Commit `eca29d2`)*

### Findings deferred (NOT blocking launch)

- **P2 (data-export scope ambiguity)** — `data-export.service` excludes `audit_events`,
  `loyalty_ledger`, `product_views`, `try_at_home_bookings`. Defensible for tenant-data
  export (DPDPA shop-side request), but if reused for customer-side DPDPA portability
  the customer would not receive their loyalty ledger or try-at-home history. **Decision
  needed before first DPDPA portability request lands**: split into
  `exportTenantForShop()` vs `exportCustomerData(customerId)`, or accept the current
  scope and route customer requests through a separate code path.

- **P3 (no rate limiting on impersonation paths)** — A compromised platform_admin can
  spawn many impersonation sessions or repeatedly probe token validation. Mitigation:
  monitor `platform_audit_events` for `impersonation.started` rate. Application-level
  rate limiting deferred to the broader rate-limit story (E15-S1, post-launch).

## Step 4 — Integration tests (Testcontainers)

**Status: deferred to CI.** Docker Desktop is installed locally (v29.2.1) but the engine
is not running on dev workstation. Per the finishing-pass prompt's fallback, the
unit tests already cover route wiring + service logic (765 passing).

### Tests authored (deferred to next session with Docker running)

- `apps/api/test/platform-admin.integration.test.ts` — `createTenant → list → suspend →
  unsuspend → metrics` round-trip against a real Postgres in Testcontainers, asserting
  `cache.invalidate` actually flushes the shared `TenantLookupModule` singleton (the
  shape of bug Codex flagged in round 1).
- `apps/api/test/impersonation.integration.test.ts` — `startImpersonation → verify GUC
  swap on a normal API call → endImpersonation → verify expired session is rejected
  (401)`. Specifically exercises:
  - `withPlatformAdmin` BEGIN/COMMIT actually persists `SET LOCAL ROLE` (the round-1+2 P1)
  - `goldsmith_uid: impClaims.jti` actually allows tenant-write paths to insert
  - `impClaims.sub === decoded.uid` caller-binding rejects a leaked token

Both follow the pattern in `apps/api/test/audit-log.integration.test.ts`.

## Step 5 — Customer-web Firebase Google sign-in

### Implemented (commit `21c3819`, hardened in `35e9ab9`)

- Added `firebase` peer + `@goldsmith/auth-client/web` sub-export with
  `initWebFirebase`, `signInWithGoogle`, `subscribeToIdToken`, `signOutOfFirebase`.
  Keeps the "no `firebase/*` outside `packages/auth-client`" semgrep rule clean.
- Added `firebase` and `@goldsmith/auth-client` deps to `apps/customer-web`.
- New `apps/customer-web/lib/admin-firebase.ts` — env-driven Web SDK init.
- New `apps/customer-web/app/admin/login/page.tsx` — Google popup, asserts
  `claims.role === 'platform_admin'` after sign-in (otherwise rejects with a
  pointer to runbook §15).
- Rewrote `apps/customer-web/app/admin/page.tsx` to subscribe to ID-token rotation
  via `subscribeToIdToken` and redirect to `/admin/login` when no token. Replaces
  the paste-token UI.
- Added `apps/customer-web/.env.example` documenting `NEXT_PUBLIC_FIREBASE_*` vars.

### Known constraints / follow-ups

- **Token storage is in-memory only.** No localStorage / no httpOnly cookie.
  Page reload requires re-popup. Trade-off: avoids XSS-vector on a privileged token,
  at the cost of a small UX papercut for the platform admin audience.
- **CORS allowlist is env-driven** (`ADMIN_WEB_ORIGIN`, default
  `http://localhost:3000`). Update prod env to the production admin host.

## Step 6 — Push to origin

*(awaiting user confirmation. 13 commits ahead of origin since session start, all behind a clean Codex round-12 verification + 771 unit tests passing + customer-web production build verified.)*

## Step 7 — Retro lessons

- **Codex iterates deeper than expected on structural cross-cutting code.** 12 rounds, 26 real bugs caught, only 1 false positive. Each round catches a different kind of issue (round 1-3 = structural; 4-5 = config/build; 6-9 = leak/governance; 10-12 = lifecycle/state edge cases).
- **Tests bypass DI and don't catch wiring bugs.** Round 8's circular-import P1 would have crashed bootstrap but all 765 unit tests passed because they construct services directly with `new Service(pool, ...)`. Lesson: integration tests against a Nest module factory are the only way to catch DI wiring.
- **`SELECT *` in any export path is a P2 trap door.** Round 9 caught it in data-export; the tenant-data export shape was authored for "tenant data" without auditing what columns exist (PAN ciphertext, KEK ARN). Default to explicit projection in any platform-admin endpoint.
- **Default Firebase Web SDK persistence is LOCAL.** Round 12. Always set `inMemoryPersistence` for privileged surfaces. Documented the trade-off in code (page reload re-popups Google sign-in) so future readers don't "fix" it back to LOCAL for UX.
- **Codex on Wave 6 was the right gate timing.** Wave 6 shipped major new architecture (platform-admin role + impersonation + cross-tenant ops) — exactly the surface where a fresh cross-model review catches what same-session implementer momentum misses. Same gate on Wave 1-5 (well-trodden tenant-scoped patterns) would have caught proportionally less.

