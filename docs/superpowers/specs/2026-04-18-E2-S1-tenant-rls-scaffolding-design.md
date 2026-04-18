---
title: E2-S1 — Tenant RLS Scaffolding (Platform Substrate)
status: Draft v1 — brainstorming output, pre-plan
author: Alok (Principal Architect) · facilitated via Claude (Opus 4.7)
date: 2026-04-18
supersedes: none
implements:
  - AR-1 (monorepo scaffold + enterprise floor)
  - AR-2, AR-3 (Terraform skeleton + data-residency tags)
  - AR-4, AR-5, AR-6 (RLS + tenant-isolation test harness + SECURITY DEFINER scaffolding)
  - AR-15 (Sentry + OTel + Pino observability baseline)
  - AR-16 (CI gates: Semgrep + Codex + coverage)
frs:
  - FR5 (tenant isolation invariant — foundation only; feature surfaces trace to this)
nfrs:
  - NFR-S7 (zero cross-tenant data exposure)
  - NFR-S8 (tenant-isolation test from Sprint 1)
  - NFR-C7 (data residency ap-south-1)
adrs:
  - ADR-0002 (single-DB RLS) — consumed as-is
  - ADR-0005 (tenant context) — amended by this spec (hybrid ALS + explicit ctx)
  - ADR-0009 (modular monolith) — consumed
  - ADR-0012 (IaC Terraform) — consumed
  - ADR-0013 (per-tenant KEK + envelope encryption) — NEW, flagged for plan session
  - ADR-0014 (PITR restore under DPDPA erasure) — NEW, flagged for plan session
threatModelMitigations:
  - S1-M2 (Semgrep no-tenant-id-from-request-input)
  - S1-M6 (async-boundary ALS propagation Semgrep)
  - S1-M7 (tenant-required BullMQ wrapper)
  - S1-M8 (PII-scrubbing logger)
  - S1-M9 (Drizzle marker → RLS generator)
  - S1-M10 (TenantScopedCache Redis wrapper)
  - S1-M11 (Terraform Semgrep: no public S3)
  - S1-M12 (slow-query + per-tenant query counter alerts)
precedes:
  - Story 1.1 (auth + dashboard) — 1.1 becomes "auth on top of E2-S1"
---

# E2-S1 — Tenant RLS Scaffolding (Platform Substrate)

## 1. Summary

E2-S1 is the **first authorized story** under the 2026-04-17 BMAD Greenfield Readiness gate. It delivers the multi-tenant platform substrate on which every subsequent feature story stands. Zero cross-tenant data leakage is platform-existential (threat-model §4 row 1), and every layer of defense-in-depth ships here so no feature work can accidentally bypass it.

The story extracts the RLS + scaffold + CI portions of the original XL Story 1.1 into a dedicated foundation story. Story 1.1 then shrinks to "auth + dashboard + money-primitives + Supabase adapter + UI tokens on top of E2-S1." This split is sanctioned by IR-report §7 ("would need a '0.0' scaffold story") and by memory `project_bmad_readiness_passed.md` ("start with Story E2-S1 before E1-S1").

**Why this story exists, stated as a test:** if any developer on any machine opens a fresh clone, adds a new table by convention, and writes a query without thinking about tenancy, the system must fail in a way that is impossible to ignore — build failure, CI red, runtime zero-rows, Sentry alert. E2-S1 is the machinery that makes that true.

## 2. Out-of-scope (explicit)

These are NOT in E2-S1 (they are in Story 1.1 or later):

- Auth: OTP send/verify, JWT issue/verify, Supabase adapter, MSG91 adapter
- UI: shopkeeper app screens beyond a minimal health check, customer app, admin app
- `packages/money` — money/weight primitives (Story 1.1 per AR-7)
- `packages/ui-tokens` — Direction 5 design tokens (Story 1.1)
- Feature tables (products, invoices, customers, rate-locks, etc.)
- PostHog event tracking (Epic 12)
- Actual encrypted columns — E2-S1 ships the hook; first use is Story 1.1 on `shop_users.phone`
- axe-core, Lighthouse CI gates — wired in when there are UI surfaces to gate (Story 1.1)

## 3. Architecture — four-layer defense-in-depth

1. **Compile-time**
   - ESLint rule `goldsmith/no-raw-shop-id-param` — forbids `shopId: string` as a service/repo method parameter; requires `ctx: TenantContext`.
   - Semgrep rule `goldsmith/require-tenant-transaction` — every DB call must be wrapped in `withTenantTx`.
   - Semgrep rule `goldsmith/no-tenant-id-from-request-input` — `req.body`, `req.query`, `req.params` must never flow into a tenant-id read.
   - Semgrep rule `goldsmith/als-boundary-preserved` — every `async`/`await`/`Promise.all`/`setImmediate`/`process.nextTick` inside a service method must not drop the ALS context (pragma-flagged exceptions require reviewer sign-off).
   - Semgrep rule `goldsmith/no-raw-ioredis-import` — `ioredis` importable only from `packages/cache`.
   - Semgrep rule `goldsmith/no-raw-bullmq-import` — `bullmq` importable only from `packages/queue`.
   - Codegen-build-fail: every Drizzle `pgTable` usage must be via `tenantScopedTable` or `platformGlobalTable` (Semgrep pattern + AST-walk).

2. **Runtime app** (AsyncLocalStorage primary; explicit ctx for type discipline)
   - `TenantContext` type immutable per request.
   - `tenantContext.runWith(ctx, fn)` — seeds ALS for the promise chain.
   - `@TenantContextDec()` param decorator — reads ALS, throws `tenant.context_not_set` if absent.
   - Services and repos declare `ctx: TenantContext` as first param (lint-enforced for discoverability) but may also read from ALS directly in library code (e.g., cache, queue).
   - BullMQ worker `BaseProcessor` reads tenantId from job, re-validates tenant ACTIVE, calls `runWith`.
   - Outbound HTTP/adapter layer reads ctx from ALS.

3. **DB session**
   - `withTenantTx(fn)` — reads tenantId from ALS, begins transaction, issues `SET LOCAL app.current_shop_id = $1`, runs fn, commits or rolls back.
   - Connection pool on-checkout hook: `SET app.current_shop_id = '00000000-0000-0000-0000-000000000000'` (poison default). Any query that reaches the DB without a `SET LOCAL` inside a `withTenantTx` filters against the poison UUID — returns zero rows. Loud failure, not silent leak.
   - Audit table `audit_events` has `REVOKE UPDATE, DELETE FROM app_user` — DB-level append-only.

4. **DB storage**
   - PostgreSQL RLS on every `tenantScopedTable`: `USING (shop_id = current_setting('app.current_shop_id', true)::uuid) WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid)`.
   - Three DB roles:
     - **`app_user`** — NOSUPERUSER NOBYPASSRLS; SELECT/INSERT/UPDATE/DELETE on tenant tables; no DDL. Used by NestJS API + BullMQ workers + data-migration jobs.
     - **`migrator`** — NOSUPERUSER NOBYPASSRLS; DDL grants only; zero DML on tenant tables. Used by Drizzle migrate CLI in CI/CD. Credential stored in AWS Secrets Manager + scoped to GitHub Actions OIDC-assumed role (never on developer machines).
     - **`platform_admin`** — NOSUPERUSER NOBYPASSRLS; owns SECURITY DEFINER functions for admin-console cross-tenant reads; can manage RLS policies + KEK provisioning. Scoped behind admin MFA in Story 1.5+.
   - Data migrations (backfills, transforms) are deferred out of DDL. They run as `app_user` from a post-migrate BullMQ job that iterates tenants. Documented in `docs/db-workflow.md`.

## 4. Components — package map

```
packages/
├── db/                       # Drizzle schema + migrations + provider + codegen
├── tenant-context/           # TenantContext type, ALS instance, interceptor stub, decorator
├── cache/                    # TenantScopedCache (Redis wrapper reading ALS)
├── queue/                    # TenantQueue + BaseProcessor (BullMQ wrapper)
├── crypto-envelope/          # Per-tenant KEK provisioning + envelope encryption (hooks only, no columns yet)
├── audit/                    # auditLog() — the ONLY path into audit_events
├── observability/            # Sentry + OTel + Pino with PII scrubber
└── testing/tenant-isolation/ # schema-assertions + 3-tenant behavioral harness + endpoint-walker scaffold

apps/api/                     # NestJS bootstrap + health endpoint + interceptor wiring + global exception filter
ops/semgrep/                  # All rules listed above
ops/eslint-rules/             # no-raw-shop-id-param
scripts/                      # db-reset.sh, tenant-provision.sh, tenant-delete.sh
infra/terraform/              # VPC + RDS + Redis + KMS + Secrets Manager skeleton (ap-south-1 locked)
.github/workflows/ship.yml    # CI pipeline — gates relevant to E2-S1
docs/db-workflow.md           # developer-facing guide for migrator → app_user flow
docs/adr/0005 (amended) + 0013 (new) + 0014 (new)
```

Tables shipped in this story: `shops` (`platformGlobalTable`), `shop_users` (`tenantScopedTable`), `audit_events` (`tenantScopedTable`, append-only).

## 5. Drizzle marker mechanism

Two explicit helpers; absence of a marker is a build error.

```ts
// packages/db/src/schema/_helpers/tenantScopedTable.ts
export function tenantScopedTable<N extends string, C extends ColumnSet>(
  name: N,
  columns: C,
  opts: { encryptedColumns?: (keyof C)[] } = {}
) { /* wraps pgTable, auto-inserts shop_id UUID NOT NULL + FK + idx, stamps metadata */ }

// packages/db/src/schema/_helpers/platformGlobalTable.ts
export function platformGlobalTable<N extends string, C extends ColumnSet>(
  name: N,
  columns: C
) { /* wraps pgTable, explicit marker = global, stamps metadata */ }
```

Codegen (`packages/db/src/codegen/generate-rls.ts`) walks `packages/db/src/schema/*.ts`, reads stamped metadata, and emits:

- For each `tenantScopedTable`: `ALTER TABLE <n> ENABLE ROW LEVEL SECURITY; CREATE POLICY rls_<n>_tenant_isolation ON <n> FOR ALL USING (shop_id = current_setting('app.current_shop_id', true)::uuid) WITH CHECK (same);`
- For each `platformGlobalTable`: nothing (RLS disabled).
- Companion assertion (`assert-all-tables-marked.ts`): scans import-graph, fails build if any `pgTable` usage is not through a helper.

Platform-global tables planned (not all in E2-S1): `shops`, `ibja_rate_snapshots`, `feature_flags_defaults`, `compliance_rules_versions`. Only `shops` ships in E2-S1.

## 6. Data flow

**API request:**
1. NestJS `TenantInterceptor.intercept()` — resolves tenant priority (host → X-Tenant-Id → JWT); validates ACTIVE via `TenantCache` (60s TTL); constructs `TenantContext`.
2. `tenantContext.runWith(ctx, () => next.handle())` — seeds ALS for the remainder of the request lifecycle.
3. Controller: `@TenantContextDec() ctx` — explicit param.
4. Service: accepts `ctx`; calls repo.
5. Repo: `withTenantTx(async tx => { await tx.execute(sql\`SET LOCAL …\`); return query(tx); })`. The `SET LOCAL` step is inside `withTenantTx`, not callable directly.
6. RLS filters. Response.
7. ALS unwinds on response return.

**BullMQ job:**
1. Producer: `tenantQueue.add('job-name', ctx, payload)` — `tenantId` injected into metadata by type constraint.
2. Worker `BaseProcessor.process(job)` — reads tenantId, re-validates ACTIVE, `runWith(ctx, () => handle(ctx, payload))`.
3. Handler path same as API request step 4+.

**Cache:**
1. `cache.get(key)` reads `shopId` from ALS; throws if missing.
2. Redis key is `t:{shopId}:{key}`; no cross-tenant collision possible.
3. Tenant offboarding: `cache.flushTenant(shopId)` walks `t:{shopId}:*` with SCAN.

**Tenant provisioning (runbook §7.2 reuse):**
1. `scripts/tenant-provision.sh --tenant <id>` — inserts `shops` row, creates KMS KEK aliased `goldsmith-tenant-<id>`, seeds default config.
2. Final step: runs `packages/testing/tenant-isolation/harness.ts` against the new tenant — asserts RLS isolation before marking provisioning complete.

**Tenant offboarding (runbook §8.3 completion):**
1. `scripts/tenant-delete.sh --tenant <id>` (requires MFA + multi-person approval at prod).
2. Walks schema registry → for each `tenantScopedTable`, issues `DELETE WHERE shop_id = $1` as `platform_admin` in one transaction.
3. S3 purge of `goldsmith-tenant-assets/<id>/*`.
4. `cache.flushTenant(<id>)`.
5. KMS KEK deletion scheduled with 30-day grace (per AWS minimum).
6. DPDPA erasure certificate generated (PDF) + archived.
7. PITR policy note: per ADR-0014 (new), encrypted PII columns are unrecoverable after KEK deletion even from PITR backups; non-encrypted columns (product names, rates) may be restorable for 7 days per RDS PITR retention — documented residual.

## 7. Invariants (each is enforced + tested)

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | Every table is either `tenantScopedTable` or `platformGlobalTable` — no bare `pgTable` | AST codegen build-fail + Semgrep |
| 2 | Every `tenantScopedTable` has `rowsecurity = true` + one `FOR ALL` policy matching standard pattern | `schema-assertions.ts` |
| 3 | Every `platformGlobalTable` has `rowsecurity = false` | `schema-assertions.ts` |
| 4 | `app_user` has no `BYPASSRLS` | `schema-assertions.ts` against `pg_roles` |
| 5 | `migrator` has zero `SELECT/UPDATE/DELETE/INSERT` on any `tenantScopedTable` | `schema-assertions.ts` against `information_schema.table_privileges` |
| 6 | No `db.execute()`, `db.query()`, raw client calls outside `withTenantTx` | Semgrep `require-tenant-transaction` |
| 7 | No `ioredis` import outside `packages/cache` | Semgrep |
| 8 | No `bullmq.Queue`/`Worker` import outside `packages/queue` | Semgrep |
| 9 | No service method parameter typed `shopId: string` | ESLint `no-raw-shop-id-param` |
| 10 | No `req.body`/`req.params`/`req.query` flowing into tenant-id read | Semgrep `no-tenant-id-from-request-input` |
| 11 | `audit_events` table: `GRANT INSERT` to `app_user`, `REVOKE UPDATE, DELETE` | Migration + `schema-assertions.ts` |
| 12 | Connection pool checkout sets poison default `app.current_shop_id` | Integration test: query without `SET LOCAL` → 0 rows |
| 13 | Behavioral: 3 tenants A/B/C — A's ctx cannot read B/C rows on any `tenantScopedTable` | `harness.ts` iterates registry |
| 14 | Tenant-provisioning script runs harness against new tenant as a final gate | `tenant-provision.sh` exits non-zero if harness fails |
| 15 | Data residency: Terraform emits only `ap-south-1` resources | Terraform `validate` + policy check |

## 8. CI pipeline (`.github/workflows/ship.yml` — initial wire-up)

Job graph (sequential, each blocks merge on failure):

1. **install** — pnpm + Turborepo cache
2. **typecheck** — `turbo run typecheck` strict mode
3. **lint** — `turbo run lint` (includes ESLint `no-raw-shop-id-param`)
4. **unit** — `turbo run test:unit` ≥80% coverage on new packages
5. **integration** — `turbo run test:integration` against Testcontainers Postgres
6. **tenant-isolation-harness** — `turbo run test:tenant-isolation` (schema-assertions + 3-tenant behavioral)
7. **semgrep** — `semgrep --config ops/semgrep/` across monorepo
8. **codex-review** — `codex review --diff origin/main...HEAD`; creates `.codex-review-passed` marker
9. **terraform-validate** — `terraform validate` + data-residency check
10. **build** — final `turbo run build` across all apps

Deferred to Story 1.1 (because no UI yet): axe-core, Lighthouse CI, Snyk CVE scan, Trivy container scan. Stubs remain in ship.yml commented with `TODO(1.1)`.

## 9. Open questions flagged for plan-writing session

The plan-writing session must resolve these before any code is written:

1. **ADR-0005 amendment wording.** Current text rejects ALS; decision is hybrid. Exact text of the amendment (not a rewrite — explicit successor + rationale) to be drafted at plan time.
2. **ADR-0013 and ADR-0014 drafts.** New ADRs for per-tenant KEK + PITR-under-DPDPA-erasure. Draft during plan session, commit alongside E2-S1's first PR.
3. **Tenant-provisioning KEK cost.** AWS KMS CMK is ~$1/month per KEK + $0.03/10k API calls. At 100 tenants = $100/month floor; acceptable. At 10,000 tenants = $10k/month; plan session should document the revisit trigger.
4. **Dev-local KMS**. Local developer flow can't hit AWS KMS. Plan should specify a `LocalKMS` adapter (e.g., aws-kms-local in Docker) for unit/integration tests; Semgrep rule forbids importing the real KMS SDK outside `packages/crypto-envelope`.
5. **`SET LOCAL` vs `SET` at connection level.** `SET LOCAL` binds to the current transaction; outside a transaction, it's a no-op. Must confirm the DB provider always opens a transaction (even for single SELECTs) — or switch to a session-level `SET` paired with a `RESET` in a `finally`. Recommended: transaction-always.
6. **Audit-table grant ordering.** `REVOKE UPDATE, DELETE` on `audit_events` for `app_user` must happen AFTER the table is created but BEFORE the app runs. Plan must sequence this in `0000_roles.sql` vs `0001_initial_schema.sql`.
7. **Endpoint-walker scaffolding.** The `endpoint-walker.ts` is scaffolded in E2-S1 but lit up in Story 1.1 when routes exist. Plan should lock whether a no-op test in E2-S1 is OK or if a trivial `/healthz` walker exercise is required.
8. **`TenantContext` fields not known until Story 1.1 ships auth.** `userId`, `role`, `isImpersonating` can't be populated without JWT. E2-S1 ships the type as `Partial<TenantContext>` or uses `shopId` only + a typed gap comment. Plan must pick.
9. **BullMQ `ctx` serialization.** `ctx` cannot be serialized into a Redis job payload whole (contains `Tenant` DB object + function refs). Plan must define the serialized subset (`{ shopId: string }`) and the re-hydration flow.
10. **Harness tenant fixtures.** 3 tenants with what data? For E2-S1's 3 tables (`shops`, `shop_users`, `audit_events`) the harness has limited surface. Plan should specify seed data volume + the "grows as tables are added" pattern so later stories plug in.

## 10. Acceptance criteria (BDD — starting set, plan session expands)

These are the baseline criteria. The plan-writing session will add per-invariant unit-level ACs and tighten error-message strings. Every AC below MUST remain in the final plan; none may be removed.

- **Given** a fresh clone on a clean machine, **when** `pnpm install && pnpm db:reset && pnpm test`, **then** all tests pass including tenant-isolation harness.
- **Given** a developer adds a new `pgTable('orders', {...})` without using a helper, **when** they run `pnpm build`, **then** codegen-assert fails with a message pointing to `tenantScopedTable` / `platformGlobalTable`.
- **Given** a developer writes `await db.execute(sql\`SELECT * FROM shop_users\`)` outside `withTenantTx`, **when** CI runs, **then** Semgrep `require-tenant-transaction` fails the build.
- **Given** the DB provider's poison-default is set, **when** a query runs without `SET LOCAL`, **then** it returns zero rows (RLS filters against poison UUID).
- **Given** 3 tenants A/B/C provisioned with distinct fixtures, **when** the harness runs, **then** each tenant's context can read only its own rows on every `tenantScopedTable`, and no-ctx reads return zero rows.
- **Given** `scripts/tenant-provision.sh --tenant fixture-d` runs, **when** it completes, **then** the harness has run against tenant-d as its final validation step and exited clean.
- **Given** `scripts/tenant-delete.sh --tenant fixture-d --confirm` runs, **when** complete, **then** all fixture-d rows are deleted, KMS KEK is scheduled for deletion, Redis `t:fixture-d:*` keys are flushed, and a DPDPA erasure certificate PDF exists.
- **Given** `migrator` role credentials, **when** a user tries `SELECT * FROM shop_users`, **then** PostgreSQL returns permission denied.
- **Given** Terraform applied, **when** a resource is queried, **then** every resource is in region `ap-south-1` (SCP + module check).
- **Given** Story 1.1's first test endpoint hits the API, **when** tenant A's JWT is used, **then** zero data from tenants B/C is in the response.

## 11. Non-negotiables honored

- ✅ Zero cross-tenant leakage (threat-model §5.1)
- ✅ Defense-in-depth: RLS is backstop, ALS + explicit ctx is primary (ADR-0005 amended)
- ✅ No FLOAT/REAL for weight — enforced by `money-safety.yaml` Semgrep (consumed from existing ops/semgrep config written in this story)
- ✅ No hardcoded per-tenant values — `shops` row is the only per-tenant config primitive shipped
- ✅ `app_user` NOSUPERUSER NOBYPASSRLS
- ✅ `migrator` separate, DDL-only
- ✅ Data residency `ap-south-1` (Terraform enforced)
- ✅ 5-layer review gate per CLAUDE.md before merge

## 12. Next step

Plan-writing session (fresh context). Input: this design doc + all referenced source docs (`architecture.md`, ADR-0002/0005, threat-model.md, runbook.md, `epics-E1-E2.md`). Output: `plans/E2-S1-tenant-rls-scaffolding.md` — per-file, per-step implementation plan with TDD ordering. Per CLAUDE.md per-story protocol, plan writing happens in a fresh session (context quarantine); this one stops here.
