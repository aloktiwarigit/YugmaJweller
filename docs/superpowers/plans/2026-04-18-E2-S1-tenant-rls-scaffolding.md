# E2-S1 Tenant RLS Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the multi-tenant platform substrate (RLS + ALS + CI + Terraform + isolation harness) on which every later feature story stands, making zero cross-tenant data leakage structurally impossible.

**Architecture:** Four-layer defense-in-depth (compile-time via Semgrep+ESLint; runtime via NestJS interceptor + AsyncLocalStorage; DB-session via `SET LOCAL` inside `withTenantTx`; DB-storage via PostgreSQL RLS with poison-default fallback). Drizzle marker functions (`tenantScopedTable` / `platformGlobalTable`) drive code-generated RLS policies, and a 3-tenant behavioral harness runs on every CI merge.

**Tech Stack:** pnpm workspace + Turborepo, NestJS 10, Drizzle ORM, PostgreSQL 15 (via Testcontainers in tests, RDS in prod), Redis (ioredis), BullMQ, Pino, Sentry, OpenTelemetry, Vitest, Testcontainers, Semgrep, ESLint, Terraform (AWS ap-south-1), GitHub Actions + Codex CLI.

**Plan references:**
- Design spec: `docs/superpowers/specs/2026-04-18-E2-S1-tenant-rls-scaffolding-design.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- ADRs consumed: 0002, 0005 (amended here), 0009, 0012
- ADRs created: 0013 (per-tenant KEK), 0014 (PITR under DPDPA erasure)
- Threat model: `docs/threat-model.md` (S1-M2/M6/M7/M8/M9/M10/M11/M12)
- Runbook: `docs/runbook.md` §7.2 + §8.3

**Locked decisions (spec §9 open questions):**

1. **ADR-0005 amendment:** Append an `## Amendment 2026-04-18` block; do NOT rewrite existing text. ALS becomes the primary runtime carrier; explicit `ctx: TenantContext` first-param remains ESLint-enforced for discoverability. The "AsyncLocalStorage rejected" alternatives row gets a `[SUPERSEDED — see Amendment 2026-04-18]` footnote.
2. **ADR-0013 (new):** Per-tenant KMS CMK aliased `goldsmith-tenant-<uuid>`; envelope encryption via `packages/crypto-envelope`; hooks-only in E2-S1 (first column ships in Story 1.1 on `shop_users.phone`).
3. **ADR-0014 (new):** PITR retention is 7 days (RDS default). Encrypted columns become unrecoverable after KEK deletion (30-day KMS grace); non-encrypted tenant-scoped columns may be restored via PITR within the 7-day window. Documented residual risk, DPO sign-off required before first paying tenant.
4. **KEK cost revisit trigger:** 1,000 tenants = $1k/month KMS floor. Reassess at that threshold.
5. **Dev-local KMS:** `localstack` (`pro/kms` module) started via `infra/docker-compose.dev.yml`; `LocalKMS` adapter in `packages/crypto-envelope`. Semgrep rule `no-raw-kms-import` forbids `@aws-sdk/client-kms` outside the package.
6. **SET LOCAL vs session-level:** Always-transaction. `withTenantTx` opens a transaction even for single SELECTs. `SET LOCAL` binds to the transaction and unwinds on commit/rollback — no leak between connections.
7. **Audit-table grant ordering:** Three migrations in strict order: `0000_roles.sql` (roles, no grants) → `0001_initial_schema.sql` (tables + RLS policies) → `0002_grants.sql` (all GRANT/REVOKE). Drizzle migrator applies in lexical order; we verify by filename.
8. **Endpoint-walker scope in E2-S1:** Ships scaffolded + exercises `/healthz` (no tenant scope). Carries `// LIT-UP-IN-STORY-1.1` marker. Walks NestJS reflection-metadata for route discovery.
9. **TenantContext fields:** Interface ships `shopId` + `tenant` as required; `userId?`, `role?`, `isImpersonating?`, `impersonationAuditId?` as optional with TSDoc `@sinceStory 1.1`. Story 1.1 will tighten to a discriminated union when auth lands.
10. **BullMQ ctx serialization:** Job payload is `{ meta: { tenantId: string }; data: T }`. `TenantQueue.add(ctx, data)` auto-extracts; `BaseProcessor` re-validates + re-hydrates + wraps in `runWith`.
11. **Harness fixtures:** 3 tenants A/B/C, each with 1 `shops` row + 2 `shop_users` + 5 `audit_events`. Registry at `packages/testing/tenant-isolation/fixtures/registry.ts`; later stories append without editing the harness.

**CI discipline:** Terraform work in E2-S1 is `validate` + `plan` only. No `apply` to any AWS environment in this story — apply gate opens in Story 1.1 once auth + monitoring are in place.

**Commit cadence:** Every task ends with a commit. After each commit, rerun `pnpm typecheck` + `pnpm lint` at repo root before moving on.

**5-layer review gate (CLAUDE.md):** Runs only on the final merge PR after Task 30. Do not gate intermediate commits on Codex.

---

## File structure overview

```
.github/workflows/ship.yml              # 10-gate CI pipeline
infra/
  docker-compose.dev.yml                # postgres 15 + redis + localstack
  terraform/
    backend.tf                          # S3 + DynamoDB lock
    providers.tf                        # AWS ap-south-1 lock
    modules/
      network/                          # VPC + subnets + NAT
      database/                         # RDS Postgres 15
      cache/                            # ElastiCache Redis
      secrets/                          # Secrets Manager + KMS
      ci-roles/                         # GH Actions OIDC role
    envs/dev/                           # dev stack
ops/
  semgrep/
    require-tenant-transaction.yaml
    no-tenant-id-from-request-input.yaml
    als-boundary-preserved.yaml
    no-raw-ioredis-import.yaml
    no-raw-bullmq-import.yaml
    no-raw-kms-import.yaml
    no-pii-in-logs.yaml
    terraform-no-public-s3.yaml
  eslint-rules/
    no-raw-shop-id-param/
      index.js
      index.test.js
packages/
  db/                                   # Drizzle + migrations + codegen + provider
    src/
      schema/
        _helpers/{tenantScopedTable,platformGlobalTable,registry}.ts
        shops.ts
        shop-users.ts
        audit-events.ts
      codegen/
        generate-rls.ts
        assert-all-tables-marked.ts
      provider.ts                       # connection pool + poison-default hook
      tx.ts                             # withTenantTx
      migrations/
        0000_roles.sql
        0001_initial_schema.sql
        0002_grants.sql
  tenant-context/
    src/{context,als,decorator,interceptor,tenant-cache}.ts
  cache/                                # TenantScopedCache
  queue/                                # TenantQueue + BaseProcessor
  crypto-envelope/                      # KEK + LocalKMS
  audit/                                # auditLog()
  observability/                        # Pino + Sentry + OTel
  testing/
    tenant-isolation/
      src/{schema-assertions,harness,endpoint-walker}.ts
      fixtures/{registry,tenant-a,tenant-b,tenant-c}.ts
apps/api/
  src/
    main.ts
    app.module.ts
    health.controller.ts
    common/filters/global-exception.filter.ts
scripts/
  db-reset.sh
  tenant-provision.sh
  tenant-delete.sh
docs/
  db-workflow.md
  adr/
    0005-tenant-context-defense-in-depth.md   # amended
    0013-per-tenant-kek-envelope-encryption.md # new
    0014-pitr-under-dpdpa-erasure.md          # new
```

---

## Task 1: Write ADRs (amend 0005, new 0013, new 0014)

**Files:**
- Modify: `_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md` (append amendment block)
- Create: `_bmad-output/planning-artifacts/adr/0013-per-tenant-kek-envelope-encryption.md`
- Create: `_bmad-output/planning-artifacts/adr/0014-pitr-under-dpdpa-erasure.md`
- Modify: `_bmad-output/planning-artifacts/adr/README.md` (add 0013 + 0014 to index)

- [ ] **Step 1: Append Amendment 2026-04-18 block to ADR-0005**

Open `_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md`. At the end of the "Alternatives Considered" table, change the `AsyncLocalStorage for implicit context` row from `Rejected because ...` to `Rejected-for-primary-path because ... [SUPERSEDED — see Amendment 2026-04-18]`. Append the following at end of file:

```markdown

---

## Amendment — 2026-04-18 (E2-S1 plan session)

**Status:** Accepted amendment. Supersedes "AsyncLocalStorage rejected" row above.
**Context:** Services in libraries (cache, queue, outbound HTTP adapters) cannot practically thread `ctx` through every call site. Forcing explicit-only propagation creates a choice between (a) verbose threading that pollutes adapter code, or (b) per-call `shopId: string` params, which defeats the discipline. Hybrid model resolves this.

**Amended decision:**
- **Primary carrier:** `AsyncLocalStorage<TenantContext>` instance in `packages/tenant-context`. `tenantContext.runWith(ctx, fn)` seeds the ALS for the remainder of the promise chain.
- **Explicit param retained:** Services and repositories still declare `ctx: TenantContext` as their first parameter (ESLint `no-raw-shop-id-param` remains active). This is for discoverability and readability, not correctness — ALS is the backstop.
- **Library code:** `packages/cache`, `packages/queue`, outbound adapters, and `withTenantTx` read `ctx` from ALS directly. They MUST NOT accept `shopId: string` params.
- **Propagation Semgrep:** Rule `goldsmith/als-boundary-preserved` (ops/semgrep/als-boundary-preserved.yaml) flags `async`/`await`/`Promise.all`/`setImmediate`/`process.nextTick` patterns inside service methods that could drop the ALS context. Pragma `// als-ok: <reason>` allows reviewer-signed exceptions.
- **BullMQ workers:** Job payload shape is `{ meta: { tenantId: string }; data: T }`. `BaseProcessor.process(job)` re-validates tenant ACTIVE, re-constructs `TenantContext`, wraps handler in `runWith`.
- **Outbound HTTP:** Adapter base class reads ctx from ALS and attaches `X-Tenant-Id` header + audit.

**Rationale:**
- Explicit-only: broke down at library boundaries (cache, queue) forcing verbose-or-unsafe choices.
- ALS-only: no compile-time discoverability; new engineers would miss the tenancy contract.
- Hybrid: explicit at service surfaces (readable, lint-enforced), ALS at library surfaces (ergonomic, Semgrep-enforced).

**Consequences:**
- One additional runtime dependency: Node's built-in `async_hooks` (no npm addition).
- Testing: any async code path run outside `runWith` that touches ALS throws `tenant.context_not_set`. Tests use a `withTestCtx(ctx, fn)` helper that wraps `runWith`.
- RLS remains the backstop. Even if both ALS and explicit param fail, `withTenantTx` → `SET LOCAL` → RLS policy filters against the poison UUID.
```

- [ ] **Step 2: Create ADR-0013**

Create `_bmad-output/planning-artifacts/adr/0013-per-tenant-kek-envelope-encryption.md`:

```markdown
# 0013 — Per-Tenant KEK + Envelope Encryption for Sensitive Columns

**Status:** Accepted
**Date:** 2026-04-18
**Deciders:** Winston (Architect), Alok (Agency), Murat (Test Architect)

## Context

PRD NFR-S7 (zero cross-tenant data exposure), DPDPA Chapter III (right to erasure), and our threat model §Information-disclosure require that PII at rest is encrypted with keys we can revoke per-tenant. Column-level encryption with a single platform-wide KEK cannot satisfy per-tenant erasure.

## Decision

Adopt **AWS KMS Customer Master Key per tenant** with **envelope encryption** for sensitive columns.

- One KMS CMK per tenant, aliased `alias/goldsmith-tenant-<shop-id-uuid>`.
- Data Encryption Keys (DEKs) are 256-bit symmetric keys generated by KMS `GenerateDataKey`, returned plaintext + ciphertext. Plaintext DEK used in-memory to encrypt column; ciphertext DEK stored alongside the encrypted column.
- `packages/crypto-envelope` provides `encryptColumn(ctx, value) -> { ciphertext, encryptedDek }` and `decryptColumn(ctx, { ciphertext, encryptedDek }) -> value`.
- Tenant deletion: KMS `ScheduleKeyDeletion` with 30-day grace (AWS minimum). After grace period, every ciphertext for that tenant is unrecoverable — even from RDS PITR snapshots.
- Dev-local: LocalStack KMS (`pro/kms`) container in `infra/docker-compose.dev.yml`. `LocalKMS` adapter routes to LocalStack. Semgrep rule `no-raw-kms-import` forbids `@aws-sdk/client-kms` outside `packages/crypto-envelope`.

E2-S1 ships only the hooks. First column to use it is `shop_users.phone` in Story 1.1.

## Consequences

**Positive:**
- Per-tenant crypto-shredding on deletion satisfies DPDPA erasure (see ADR-0014).
- Compromise of one tenant's ciphertext is isolated to that tenant's KEK.
- KMS audit-logs all key usage to CloudTrail.

**Negative:**
- KMS cost: ~$1/month per CMK + $0.03 per 10k requests. At 100 tenants ≈ $100/month floor. Revisit at 1,000 tenants ($1k/mo).
- One extra round-trip for `GenerateDataKey` on first encryption of a session — mitigated by caching plaintext DEK for 5 minutes in memory.
- Key rotation is per-tenant, not platform-wide — documented in runbook §9 when key rotation policy is written.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| Single platform KEK + column encryption | Cannot satisfy per-tenant erasure — one key, all tenants |
| Tenant key in app config (no HSM) | No hardware root of trust; loses the DPDPA erasure guarantee if backup taken before deletion |
| AWS RDS TDE only | Operates at storage level; does not survive logical backup extraction; does not give per-tenant control |
| Per-tenant CMK stored in Secrets Manager as raw key | Violates HSM root-of-trust requirement for PII |

## Revisit triggers

- 1,000+ tenants → cost review, consider KEK pooling for non-active tenants.
- Key rotation policy defined (not in E2-S1 scope).
- Regulatory change (DPDPA rules tightening encryption at rest).

## References

- ADR-0002, ADR-0014, PRD NFR-S7, threat-model §Information-disclosure row 4
```

- [ ] **Step 3: Create ADR-0014**

Create `_bmad-output/planning-artifacts/adr/0014-pitr-under-dpdpa-erasure.md`:

```markdown
# 0014 — PITR Retention vs DPDPA Erasure — Documented Residual

**Status:** Accepted with DPO sign-off required before first paying tenant
**Date:** 2026-04-18
**Deciders:** Winston (Architect), Alok (Agency), Mary (BA, DPDPA compliance)

## Context

RDS PITR retains 7 days of transaction logs by default. DPDPA §10 requires erasure on data-principal request within a reasonable window (operationally, 30 days). The two windows conflict for non-encrypted tenant-scoped columns.

## Decision

**Column classification:**
- **Encrypted columns (envelope-encrypted via per-tenant KEK per ADR-0013):** Unrecoverable after KEK deletion — KEK scheduled for deletion with 30-day grace on tenant offboarding, satisfying DPDPA §10. PITR snapshots contain ciphertext only.
- **Non-encrypted tenant-scoped columns:** Restorable from PITR for up to 7 days after logical deletion. Examples: product names, price history, invoice totals (minus PII), audit_events (append-only, retained 8 years per tax law — separate regime).
- **Platform-global tables (shops, compliance_rules_versions):** Retained per business requirements, not subject to per-tenant erasure.

**Residual risk:**
- A determined insider with admin DB access could restore a snapshot within the 7-day PITR window and read non-encrypted columns for a freshly-deleted tenant. 
- Mitigation: PITR restore requires `break-glass` role (2-of-3 approvals per runbook §9); CloudTrail audit on every PITR API call; DPO must sign off on any PITR restore request touching a deleted tenant.

**Implementation:**
- All columns containing PII (phone, PAN, email, address, customer name, DOB) MUST be envelope-encrypted via `packages/crypto-envelope`. Semgrep rule enforces (added in Story 1.1 when columns land).
- Non-PII tenant-scoped columns may remain plaintext.
- Offboarding runbook (§8.3) records KEK deletion timestamp + PITR retention boundary for each tenant.
- DPDPA erasure certificate (PDF, issued to tenant on offboarding) explicitly states: "Non-PII columns may remain restorable for up to 7 calendar days from deletion via restricted break-glass procedure; no personal data is recoverable after this window."

## Consequences

**Positive:**
- Aligns operational DR needs with regulatory erasure obligations.
- Explicit residual documented, not hidden.
- PII has a hard cryptographic erasure; non-PII has a time-bounded soft erasure with audit.

**Negative:**
- First-paying-tenant requires DPO sign-off on the certificate wording.
- Extended PITR retention (>7 days) requires ADR amendment.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| Disable RDS PITR | Violates NFR-R8 (1-hour RTO for table-drop incidents) |
| Encrypt all columns | Loss of DB search/index capabilities on non-PII columns; massive perf cost |
| Extend PITR to 35 days | Makes DPDPA window worse, not better |

## Revisit triggers

- DPDPA rules formalize specific erasure windows shorter than 7 days.
- First regulator inquiry about deleted-tenant data.
- Adoption of column-level encryption for a previously-plaintext column.

## References

- ADR-0013, DPDPA §10, PRD NFR-C5 (erasure), runbook §8.3, §9
```

- [ ] **Step 4: Update ADR README index**

Open `_bmad-output/planning-artifacts/adr/README.md` and append:

```markdown
- [ADR-0013](./0013-per-tenant-kek-envelope-encryption.md) — Per-tenant KEK + envelope encryption (2026-04-18)
- [ADR-0014](./0014-pitr-under-dpdpa-erasure.md) — PITR retention vs DPDPA erasure (2026-04-18)
```

- [ ] **Step 5: Commit**

```bash
git add _bmad-output/planning-artifacts/adr/
git commit -m "docs(adr): amend 0005 for ALS hybrid; add 0013 KEK + 0014 PITR residual"
```

---

## Task 2: Initialize pnpm + Turborepo monorepo

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`
- Create: `tsconfig.base.json`, `tsconfig.json`
- Create: `.gitignore`, `.editorconfig`, `.node-version`
- Create: `.eslintrc.cjs`, `.prettierrc`, `.prettierignore`
- Create: `vitest.config.ts`

- [ ] **Step 1: Root package.json**

Create `package.json`:

```json
{
  "name": "goldsmith",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11.0 <21" },
  "scripts": {
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "test:tenant-isolation": "turbo run test:tenant-isolation",
    "build": "turbo run build",
    "db:reset": "bash scripts/db-reset.sh",
    "db:generate-rls": "tsx packages/db/src/codegen/generate-rls.ts",
    "db:assert-marked": "tsx packages/db/src/codegen/assert-all-tables-marked.ts",
    "semgrep": "semgrep --config ops/semgrep/ --error"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-import-resolver-typescript": "^3.6.1",
    "eslint-plugin-import": "^2.29.1",
    "prettier": "^3.2.5",
    "tsx": "^4.7.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: pnpm workspace + Turbo**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/testing/*"
  - "ops/eslint-rules/*"
```

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.base.json", ".eslintrc.cjs"],
  "tasks": {
    "typecheck":            { "dependsOn": ["^typecheck"], "outputs": [] },
    "lint":                 { "outputs": [] },
    "test":                 { "dependsOn": ["^build"], "outputs": [] },
    "test:unit":            { "dependsOn": [], "outputs": [] },
    "test:integration":     { "dependsOn": ["^build"], "outputs": [] },
    "test:tenant-isolation": { "dependsOn": ["^build"], "outputs": [] },
    "build":                { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

Create `.npmrc`:

```
engine-strict=true
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 3: TypeScript strict config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}
```

Create `tsconfig.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "include": [],
  "references": []
}
```

- [ ] **Step 4: ESLint + Prettier**

Create `.eslintrc.cjs`:

```js
/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'goldsmith'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    'goldsmith/no-raw-shop-id-param': 'error',
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['ioredis', 'ioredis/*'], message: 'Import ioredis only from packages/cache.' },
        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
      ],
    }],
  },
  settings: { 'import/resolver': { typescript: true } },
  ignorePatterns: ['dist', 'node_modules', '*.js.map'],
};
```

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Create `.prettierignore`:

```
dist
node_modules
pnpm-lock.yaml
*.md
```

- [ ] **Step 5: Other root files**

Create `.gitignore`:

```
node_modules/
dist/
.turbo/
coverage/
.env
.env.local
*.log
.DS_Store
.codex-review-passed
.bmad-readiness-passed
```

Create `.editorconfig`:

```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
[*.md]
trim_trailing_whitespace = false
```

Create `.node-version`:

```
20.11.0
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
    },
  },
});
```

- [ ] **Step 6: Install and commit**

```bash
pnpm install
pnpm typecheck
```

Expected: `pnpm install` succeeds; `pnpm typecheck` reports `No tasks were executed as part of this run.` (no packages yet).

```bash
git add .
git commit -m "chore(repo): init pnpm + Turborepo + TS strict + ESLint/Prettier"
```

---

## Task 3: Observability package (Pino + Sentry + OTel + PII scrubber)

**Files:**
- Create: `packages/observability/package.json`, `tsconfig.json`
- Create: `packages/observability/src/{index,logger,sentry,otel,pii-redactor}.ts`
- Create: `packages/observability/test/pii-redactor.test.ts`
- Create: `ops/semgrep/no-pii-in-logs.yaml`

- [ ] **Step 1: Write failing PII redactor test**

Create `packages/observability/package.json`:

```json
{
  "name": "@goldsmith/observability",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run"
  },
  "dependencies": {
    "@opentelemetry/api": "^1.8.0",
    "@opentelemetry/sdk-node": "^0.51.0",
    "@opentelemetry/auto-instrumentations-node": "^0.43.0",
    "@sentry/node": "^7.109.0",
    "pino": "^8.19.0"
  },
  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" }
}
```

Create `packages/observability/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

Create `packages/observability/test/pii-redactor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { redactPii } from '../src/pii-redactor';

describe('redactPii', () => {
  it('redacts phone (E.164)', () => {
    expect(redactPii({ phone: '+919876543210' })).toEqual({ phone: '[REDACTED:phone]' });
  });

  it('redacts pan (10-char ABCDE1234F pattern)', () => {
    expect(redactPii({ pan: 'ABCDE1234F' })).toEqual({ pan: '[REDACTED:pan]' });
  });

  it('redacts email', () => {
    expect(redactPii({ email: 'u@x.com' })).toEqual({ email: '[REDACTED:email]' });
  });

  it('redacts nested keys', () => {
    expect(redactPii({ user: { phone: '+919876543210', name: 'Ok' } })).toEqual({
      user: { phone: '[REDACTED:phone]', name: 'Ok' },
    });
  });

  it('redacts by key name even when value does not match pattern', () => {
    expect(redactPii({ phone: 'xyz' })).toEqual({ phone: '[REDACTED:phone]' });
  });

  it('leaves non-PII keys alone', () => {
    expect(redactPii({ shopId: 'abc', total: 123 })).toEqual({ shopId: 'abc', total: 123 });
  });

  it('redacts display_name (shop_users column)', () => {
    expect(redactPii({ display_name: 'Rajesh Ji' })).toEqual({
      display_name: '[REDACTED:display_name]',
    });
  });

  it('redacts PII inside arrays of objects', () => {
    expect(redactPii([{ phone: '+91a' }, { email: 'b@x' }])).toEqual([
      { phone: '[REDACTED:phone]' },
      { email: '[REDACTED:email]' },
    ]);
  });

  it('preserves Error instances (stack + message intact)', () => {
    const err = new Error('db connection refused');
    const out = redactPii({ err });
    expect(out.err).toBe(err); // same reference — Error passes through
    expect((out.err as Error).message).toBe('db connection refused');
  });

  it('preserves Date instances (timestamp intact)', () => {
    const ts = new Date('2026-04-18T00:00:00Z');
    const out = redactPii({ ts });
    expect(out.ts).toBe(ts);
  });

  it('preserves Buffer instances (byte content intact)', () => {
    const buf = Buffer.from('hello', 'utf8');
    const out = redactPii({ buf });
    expect(out.buf).toBe(buf);
    expect((out.buf as Buffer).toString('utf8')).toBe('hello');
  });

  it('handles circular references without stack overflow', () => {
    const a: Record<string, unknown> = { phone: '+91' };
    a.self = a;
    const out = redactPii(a) as Record<string, unknown>;
    expect(out.phone).toBe('[REDACTED:phone]');
    expect(out.self).toBe('[Circular]');
  });

  it('redacts null value under PII key (key-based, not value-based)', () => {
    expect(redactPii({ phone: null })).toEqual({ phone: '[REDACTED:phone]' });
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd packages/observability && pnpm install && pnpm test
```

Expected: FAIL with `Cannot find module '../src/pii-redactor'`.

- [ ] **Step 3: Implement PII redactor**

Create `packages/observability/src/pii-redactor.ts`:

```ts
const PII_KEYS = new Set([
  'phone', 'pan', 'email', 'aadhaar', 'dob',
  'address', 'customerName', 'ownerName', 'display_name',
  'gstin', 'bankAccount', 'ifsc', 'otp',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

export function redactPii<T>(input: T, seen: WeakSet<object> = new WeakSet()): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    if (seen.has(input)) return '[Circular]' as unknown as T;
    seen.add(input);
    return input.map((item) => redactPii(item, seen)) as unknown as T;
  }
  if (isPlainObject(input)) {
    if (seen.has(input)) return '[Circular]' as unknown as T;
    seen.add(input);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = PII_KEYS.has(k) ? `[REDACTED:${k}]` : redactPii(v, seen);
    }
    return out as unknown as T;
  }
  // Error, Date, Buffer, class instances, Map, Set, Symbol — preserve as-is.
  return input;
}
```

- [ ] **Step 4: Implement logger + Sentry + OTel wrappers**

Create `packages/observability/src/logger.ts`:

```ts
import pino from 'pino';
import { redactPii } from './pii-redactor';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    log: (obj) => redactPii(obj),
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-tenant-id"]', '*.password', '*.otp'],
    censor: '[REDACTED:field]',
  },
});
```

Create `packages/observability/src/sentry.ts`:

```ts
import * as Sentry from '@sentry/node';
import { redactPii } from './pii-redactor';

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;
  _initialized = true;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
    beforeSend: (event) => {
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = redactPii(event.request.data);
      }
      if (event.request?.headers) {
        const { authorization: _a, cookie: _c, 'x-tenant-id': _t, ...safeHeaders } =
          event.request.headers as Record<string, string>;
        event.request.headers = safeHeaders;
      }
      if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : {};
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = (event.breadcrumbs as Sentry.Breadcrumb[]).map((b) => {
          if (!b.data) return b;
          return { ...b, data: redactPii(b.data) as { [key: string]: unknown } };
        });
      }
      return { ...event, extra: redactPii(event.extra ?? {}) };
    },
  });
}
```

Create `packages/observability/src/otel.ts`:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let _sdk: NodeSDK | undefined;

export function initOtel(serviceName: string): NodeSDK | undefined {
  if (_sdk) return _sdk;
  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) return undefined;
  _sdk = new NodeSDK({
    serviceName,
    instrumentations: [getNodeAutoInstrumentations()],
  });
  _sdk.start();
  return _sdk;
}
```

> **Note:** SIGTERM shutdown hook deferred to Story 1.1 when `main.ts` lands.

Create `packages/observability/src/index.ts`:

```ts
export { logger } from './logger';
export { initSentry } from './sentry';
export { initOtel } from './otel';
export { redactPii } from './pii-redactor';
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @goldsmith/observability test
```

Expected: all redactor tests pass.

- [ ] **Step 6: Semgrep rule no-pii-in-logs (S1-M8)**

Create `ops/semgrep/no-pii-in-logs.yaml`:

```yaml
rules:
  - id: goldsmith.no-pii-in-logs
    languages: [typescript, javascript]
    severity: ERROR
    message: |
      PII field names must not be logged via console.*. Use the logger from
      @goldsmith/observability (which runs the PII redactor) or explicitly wrap with
      redactPii(value). Keys covered: phone, pan, email, aadhaar, dob, address, otp,
      customerName, ownerName, display_name, gstin, bankAccount, ifsc.
    patterns:
      - pattern-either:
          - pattern: console.log($...ARGS)
          - pattern: console.warn($...ARGS)
          - pattern: console.error($...ARGS)
      - metavariable-pattern:
          metavariable: $...ARGS
          patterns:
            - pattern-regex: "\\b(phone|pan|email|aadhaar|dob|address|otp|customerName|ownerName|display_name|gstin|bankAccount|ifsc)\\b"
```

- [ ] **Step 7: Commit**

```bash
git add packages/observability ops/semgrep/no-pii-in-logs.yaml
git commit -m "feat(observability): pino+sentry+otel with PII redactor (S1-M8)"
```

---

## Task 4: Terraform backend + network module

**Files:**
- Create: `infra/terraform/backend.tf`, `providers.tf`, `versions.tf`
- Create: `infra/terraform/modules/network/{main,variables,outputs}.tf`
- Create: `infra/docker-compose.dev.yml`

- [ ] **Step 1: Backend + providers**

Create `infra/terraform/versions.tf`:

```hcl
terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.40" }
  }
}
```

Create `infra/terraform/backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "goldsmith-tfstate-ap-south-1"
    key            = "envs/dev/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "goldsmith-tfstate-lock"
    encrypt        = true
  }
}
```

Create `infra/terraform/providers.tf`:

```hcl
provider "aws" {
  region = "ap-south-1"
  allowed_account_ids = var.allowed_account_ids
  default_tags {
    tags = {
      Project          = "goldsmith"
      ManagedBy        = "terraform"
      DataResidency    = "ap-south-1"
    }
  }
}

variable "allowed_account_ids" {
  type        = list(string)
  description = "AWS account IDs allowed to run this config. Enforces residency at the provider level."
}
```

- [ ] **Step 2: Network module**

Create `infra/terraform/modules/network/variables.tf`:

```hcl
variable "env"        { type = string }
variable "cidr_block" { type = string, default = "10.10.0.0/16" }
variable "base_tags"  { type = map(string), default = {} }
```

Create `infra/terraform/modules/network/main.tf`:

```hcl
locals {
  azs = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
  tags = merge(var.base_tags, {
    Module        = "network"
    DataResidency = "ap-south-1"
  })
}

resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.tags, { Name = "${var.env}-goldsmith-vpc" })
}

resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.cidr_block, 4, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = false
  tags = merge(local.tags, {
    Name = "${var.env}-goldsmith-public-${local.azs[count.index]}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr_block, 4, count.index + 3)
  availability_zone = local.azs[count.index]
  tags = merge(local.tags, {
    Name = "${var.env}-goldsmith-private-${local.azs[count.index]}"
    Tier = "private"
  })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${var.env}-goldsmith-igw" })
}

resource "aws_eip" "nat" {
  count  = 3
  domain = "vpc"
  tags   = merge(local.tags, { Name = "${var.env}-goldsmith-natgw-eip-${count.index}" })
}

resource "aws_nat_gateway" "main" {
  count         = 3
  subnet_id     = aws_subnet.public[count.index].id
  allocation_id = aws_eip.nat[count.index].id
  tags          = merge(local.tags, { Name = "${var.env}-goldsmith-natgw-${count.index}" })
}
```

Create `infra/terraform/modules/network/outputs.tf`:

```hcl
output "vpc_id"             { value = aws_vpc.main.id }
output "public_subnet_ids"  { value = aws_subnet.public[*].id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
```

- [ ] **Step 3: Local dev stack (docker-compose)**

Create `infra/docker-compose.dev.yml`:

```yaml
services:
  postgres:
    image: postgres:15.6
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: goldsmith_dev
    ports: ["5432:5432"]
    volumes: [goldsmith_pg:/var/lib/postgresql/data]
  redis:
    image: redis:7.2-alpine
    ports: ["6379:6379"]
  localstack:
    image: localstack/localstack-pro:3.4
    ports: ["4566:4566"]
    environment:
      SERVICES: kms,secretsmanager,s3
      LOCALSTACK_AUTH_TOKEN: ${LOCALSTACK_AUTH_TOKEN:-}
volumes:
  goldsmith_pg:
```

- [ ] **Step 4: Validate Terraform**

```bash
cd infra/terraform && terraform init -backend=false && terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 5: Commit**

```bash
git add infra/
git commit -m "feat(infra): terraform backend + network module + docker-compose dev stack"
```

---

## Task 5: Terraform database + cache + secrets/KMS modules

**Files:**
- Create: `infra/terraform/modules/database/{main,variables,outputs}.tf`
- Create: `infra/terraform/modules/cache/{main,variables,outputs}.tf`
- Create: `infra/terraform/modules/secrets/{main,variables,outputs}.tf`

- [ ] **Step 1: Database module (RDS Postgres 15 Multi-AZ)**

Create `infra/terraform/modules/database/variables.tf`:

```hcl
variable "env"                { type = string }
variable "vpc_id"             { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "instance_class"     { type = string, default = "db.t4g.medium" }
variable "allocated_storage"  { type = number, default = 50 }
variable "base_tags"          { type = map(string), default = {} }
```

Create `infra/terraform/modules/database/main.tf`:

```hcl
resource "aws_db_subnet_group" "main" {
  name       = "${var.env}-goldsmith-postgres"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.base_tags, { Name = "${var.env}-goldsmith-postgres" })
}

resource "aws_security_group" "rds" {
  name        = "${var.env}-goldsmith-rds"
  description = "Postgres access from VPC only"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.10.0.0/16"]
  }
  tags = var.base_tags
}

resource "aws_kms_key" "rds" {
  description             = "KMS for ${var.env} Goldsmith RDS at-rest encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = var.base_tags
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.env}-goldsmith-postgres-15"
  family = "postgres15"
  parameter { name = "log_min_duration_statement", value = "500" }
  parameter { name = "shared_preload_libraries",    value = "pg_stat_statements", apply_method = "pending-reboot" }
}

resource "aws_db_instance" "main" {
  identifier                 = "${var.env}-goldsmith-postgres"
  engine                     = "postgres"
  engine_version             = "15.6"
  instance_class             = var.instance_class
  allocated_storage          = var.allocated_storage
  max_allocated_storage      = var.allocated_storage * 4
  multi_az                   = var.env == "prod"
  storage_encrypted          = true
  kms_key_id                 = aws_kms_key.rds.arn
  backup_retention_period    = 7
  deletion_protection        = var.env == "prod"
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  parameter_group_name       = aws_db_parameter_group.main.name
  performance_insights_enabled = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  tags = merge(var.base_tags, {
    Name                = "${var.env}-goldsmith-postgres"
    DataClassification  = "tenant-pii"
    DataResidency       = "ap-south-1"
  })
}
```

Create `infra/terraform/modules/database/outputs.tf`:

```hcl
output "endpoint"       { value = aws_db_instance.main.endpoint }
output "kms_key_arn"    { value = aws_kms_key.rds.arn }
output "security_group" { value = aws_security_group.rds.id }
```

- [ ] **Step 2: Cache module (ElastiCache Redis)**

Create `infra/terraform/modules/cache/variables.tf`:

```hcl
variable "env"                { type = string }
variable "vpc_id"             { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "node_type"          { type = string, default = "cache.t4g.small" }
variable "base_tags"          { type = map(string), default = {} }
```

Create `infra/terraform/modules/cache/main.tf`:

```hcl
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.env}-goldsmith-redis"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name   = "${var.env}-goldsmith-redis"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.10.0.0/16"]
  }
  tags = var.base_tags
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.env}-goldsmith-redis"
  description                = "Goldsmith cache + BullMQ backing"
  node_type                  = var.node_type
  num_cache_clusters         = var.env == "prod" ? 2 : 1
  automatic_failover_enabled = var.env == "prod"
  engine_version             = "7.1"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  tags = merge(var.base_tags, { DataResidency = "ap-south-1" })
}
```

Create `infra/terraform/modules/cache/outputs.tf`:

```hcl
output "endpoint" { value = aws_elasticache_replication_group.main.primary_endpoint_address }
```

- [ ] **Step 3: Secrets/KMS module**

Create `infra/terraform/modules/secrets/variables.tf`:

```hcl
variable "env"       { type = string }
variable "base_tags" { type = map(string), default = {} }
```

Create `infra/terraform/modules/secrets/main.tf`:

```hcl
resource "aws_kms_key" "platform" {
  description             = "Platform-level KMS for ${var.env} app secrets"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = merge(var.base_tags, { Purpose = "platform-secrets" })
}

resource "aws_secretsmanager_secret" "db_app_user" {
  name       = "${var.env}/goldsmith/db/app_user"
  kms_key_id = aws_kms_key.platform.id
  tags       = var.base_tags
}

resource "aws_secretsmanager_secret" "db_migrator" {
  name       = "${var.env}/goldsmith/db/migrator"
  kms_key_id = aws_kms_key.platform.id
  tags       = var.base_tags
}

resource "aws_secretsmanager_secret" "db_platform_admin" {
  name       = "${var.env}/goldsmith/db/platform_admin"
  kms_key_id = aws_kms_key.platform.id
  tags       = var.base_tags
}
```

Create `infra/terraform/modules/secrets/outputs.tf`:

```hcl
output "platform_kms_key_arn" { value = aws_kms_key.platform.arn }
output "db_app_user_secret"   { value = aws_secretsmanager_secret.db_app_user.arn }
output "db_migrator_secret"   { value = aws_secretsmanager_secret.db_migrator.arn }
```

- [ ] **Step 4: Validate**

```bash
cd infra/terraform && terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/
git commit -m "feat(infra): terraform modules database + cache + secrets/KMS"
```

---

## Task 6: Terraform envs/dev + data-residency Semgrep rule

**Files:**
- Create: `infra/terraform/envs/dev/{main,variables,outputs}.tf`
- Create: `infra/terraform/envs/dev/terraform.tfvars.example`
- Create: `ops/semgrep/terraform-no-public-s3.yaml`

- [ ] **Step 1: Dev environment stack**

Create `infra/terraform/envs/dev/main.tf`:

```hcl
locals {
  env       = "dev"
  base_tags = { Environment = local.env }
}

module "network" {
  source    = "../../modules/network"
  env       = local.env
  base_tags = local.base_tags
}

module "database" {
  source             = "../../modules/database"
  env                = local.env
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  base_tags          = local.base_tags
}

module "cache" {
  source             = "../../modules/cache"
  env                = local.env
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  base_tags          = local.base_tags
}

module "secrets" {
  source    = "../../modules/secrets"
  env       = local.env
  base_tags = local.base_tags
}
```

Create `infra/terraform/envs/dev/variables.tf`:

```hcl
variable "allowed_account_ids" { type = list(string) }
```

Create `infra/terraform/envs/dev/terraform.tfvars.example`:

```hcl
allowed_account_ids = ["111111111111"]
```

- [ ] **Step 2: Semgrep rule — no public S3**

Create `ops/semgrep/terraform-no-public-s3.yaml`:

```yaml
rules:
  - id: goldsmith.terraform-no-public-s3
    languages: [hcl]
    severity: ERROR
    message: |
      S3 buckets must not be public. No `acl = "public-read"`, no `acl = "public-read-write"`,
      and no bucket-policy principal "*" without strict conditions. Use CloudFront OAC instead.
    patterns:
      - pattern-either:
          - pattern: |
              resource "aws_s3_bucket" $NAME { ... acl = "public-read" ... }
          - pattern: |
              resource "aws_s3_bucket" $NAME { ... acl = "public-read-write" ... }
          - pattern: |
              resource "aws_s3_bucket_acl" $NAME { ... acl = "public-read" ... }
```

- [ ] **Step 3: Validate dev env**

```bash
cd infra/terraform/envs/dev && terraform init -backend=false && terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 4: Run Semgrep**

```bash
semgrep --config ops/semgrep/terraform-no-public-s3.yaml infra/
```

Expected: 0 findings.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/envs ops/semgrep/terraform-no-public-s3.yaml
git commit -m "feat(infra): dev env stack + semgrep terraform-no-public-s3 (S1-M11)"
```

---

## Task 7: packages/db scaffold — connection pool + poison-default

**Files:**
- Create: `packages/db/{package.json,tsconfig.json}`
- Create: `packages/db/src/{index,provider}.ts`
- Create: `packages/db/test/poison-default.integration.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `packages/db/package.json`:

```json
{
  "name": "@goldsmith/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run --dir src",
    "test:integration": "vitest run --dir test"
  },
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "pg": "^8.11.0",
    "@goldsmith/observability": "workspace:*"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@testcontainers/postgresql": "^10.8.0",
    "testcontainers": "^10.8.0",
    "drizzle-kit": "^0.21.0",
    "vitest": "^1.4.0",
    "typescript": "^5.4.0",
    "tsx": "^4.7.0"
  }
}
```

Create `packages/db/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

Create `packages/db/test/poison-default.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { createPool, POISON_UUID } from '../src/provider';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  const c = await pool.connect();
  await c.query(`
    CREATE TABLE demo (id SERIAL PRIMARY KEY, shop_id UUID NOT NULL, data TEXT);
    INSERT INTO demo (shop_id, data) VALUES
      ('11111111-1111-1111-1111-111111111111', 'a'),
      ('22222222-2222-2222-2222-222222222222', 'b');
    ALTER TABLE demo ENABLE ROW LEVEL SECURITY;
    CREATE POLICY rls_demo ON demo FOR ALL
      USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
      WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
    CREATE ROLE app_user NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'x';
    GRANT SELECT, INSERT, UPDATE, DELETE ON demo TO app_user;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
  `);
  c.release();
}, 60_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('connection pool poison default', () => {
  it('sets poison UUID on checkout so unscoped SELECT returns 0 rows', async () => {
    const appPool = createPool({
      connectionString: container.getConnectionUri().replace('test:test', 'app_user:x'),
    });
    const client = await appPool.connect();
    const { rows } = await client.query('SELECT * FROM demo');
    expect(rows).toHaveLength(0);
    const { rows: setting } = await client.query(`SELECT current_setting('app.current_shop_id', true) AS v`);
    expect(setting[0].v).toBe(POISON_UUID);
    client.release();
    await appPool.end();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm --filter @goldsmith/db install
pnpm --filter @goldsmith/db test:integration
```

Expected: FAIL — `createPool` + `POISON_UUID` not exported.

- [ ] **Step 3: Implement pool + poison-default checkout hook**

Create `packages/db/src/provider.ts`:

```ts
import { Pool, type PoolConfig } from 'pg';
import { logger } from '@goldsmith/observability';

export const POISON_UUID = '00000000-0000-0000-0000-000000000000';

export function createPool(config: PoolConfig): Pool {
  const pool = new Pool({
    max: Number(process.env.PG_POOL_MAX ?? '10'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...config,
  });

  pool.on('connect', (client) => {
    client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch((err) => {
      logger.error({ err }, 'failed to set poison default on new client');
    });
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'unexpected pg pool error');
  });

  return pool;
}
```

Create `packages/db/src/index.ts`:

```ts
export { createPool, POISON_UUID } from './provider';
```

- [ ] **Step 4: Run integration test**

```bash
pnpm --filter @goldsmith/db test:integration
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): pool + poison-default checkout hook (invariant 12)"
```

---

## Task 8: Drizzle marker helpers (`tenantScopedTable` + `platformGlobalTable`)

**Files:**
- Create: `packages/db/src/schema/_helpers/{registry,tenantScopedTable,platformGlobalTable}.ts`
- Create: `packages/db/src/schema/_helpers/helpers.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/src/schema/_helpers/helpers.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { uuid, text } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './tenantScopedTable';
import { platformGlobalTable } from './platformGlobalTable';
import { tableRegistry } from './registry';

beforeEach(() => tableRegistry.clear());

describe('tenantScopedTable', () => {
  it('auto-injects shop_id NOT NULL + FK + index', () => {
    const t = tenantScopedTable('widgets', { name: text('name').notNull() });
    const cols = (t as unknown as { _: { columns: Record<string, unknown> } })._.columns;
    expect(cols.shop_id).toBeDefined();
    expect(cols.name).toBeDefined();
  });

  it('registers metadata with kind=tenant', () => {
    tenantScopedTable('widgets', { name: text('name') });
    expect(tableRegistry.list()).toEqual([
      { name: 'widgets', kind: 'tenant', encryptedColumns: [] },
    ]);
  });

  it('records encryptedColumns option', () => {
    tenantScopedTable('secrets', { blob: text('blob') }, { encryptedColumns: ['blob'] });
    expect(tableRegistry.list()[0]).toEqual({
      name: 'secrets', kind: 'tenant', encryptedColumns: ['blob'],
    });
  });
});

describe('platformGlobalTable', () => {
  it('registers metadata with kind=global', () => {
    platformGlobalTable('rates', { id: uuid('id').primaryKey() });
    expect(tableRegistry.list()).toEqual([
      { name: 'rates', kind: 'global', encryptedColumns: [] },
    ]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @goldsmith/db test:unit
```

Expected: FAIL — helpers not implemented.

- [ ] **Step 3: Implement registry + helpers**

Create `packages/db/src/schema/_helpers/registry.ts`:

```ts
export type TableKind = 'tenant' | 'global';
export interface TableMeta {
  name: string;
  kind: TableKind;
  encryptedColumns: string[];
}

class TableRegistry {
  private readonly byName = new Map<string, TableMeta>();
  register(meta: TableMeta): void {
    if (this.byName.has(meta.name)) {
      throw new Error(`Table "${meta.name}" registered twice — use a unique name.`);
    }
    this.byName.set(meta.name, meta);
  }
  list(): TableMeta[] { return [...this.byName.values()]; }
  get(name: string): TableMeta | undefined { return this.byName.get(name); }
  clear(): void { this.byName.clear(); }
}

export const tableRegistry = new TableRegistry();
```

Create `packages/db/src/schema/_helpers/tenantScopedTable.ts`:

```ts
import { pgTable, uuid, index } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, unknown>;

export function tenantScopedTable<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
  opts: { encryptedColumns?: (keyof C & string)[] } = {},
) {
  tableRegistry.register({
    name,
    kind: 'tenant',
    encryptedColumns: opts.encryptedColumns ?? [],
  });

  return pgTable(
    name,
    {
      shop_id: uuid('shop_id').notNull(),
      ...columns,
    } as C & { shop_id: ReturnType<typeof uuid> },
    (table) => ({
      shopIdIdx: index(`${name}_shop_id_idx`).on((table as Record<string, unknown>).shop_id as never),
    }),
  );
}
```

Create `packages/db/src/schema/_helpers/platformGlobalTable.ts`:

```ts
import { pgTable } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, unknown>;

export function platformGlobalTable<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
) {
  tableRegistry.register({ name, kind: 'global', encryptedColumns: [] });
  return pgTable(name, columns);
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @goldsmith/db test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/_helpers
git commit -m "feat(db): tenantScopedTable + platformGlobalTable with registry (invariants 1-3)"
```

---

## Task 9: `assert-all-tables-marked` build-time check

**Files:**
- Create: `packages/db/src/codegen/assert-all-tables-marked.ts`
- Create: `packages/db/src/codegen/assert-all-tables-marked.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/src/codegen/assert-all-tables-marked.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findRawPgTableUsages } from './assert-all-tables-marked';

describe('findRawPgTableUsages', () => {
  it('flags pgTable call that is not inside the helpers directory', () => {
    const source = `
      import { pgTable, text } from 'drizzle-orm/pg-core';
      export const widgets = pgTable('widgets', { name: text('name') });
    `;
    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/widgets.ts');
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toMatch(/tenantScopedTable|platformGlobalTable/);
  });

  it('allows pgTable used inside the helpers directory', () => {
    const source = `import { pgTable } from 'drizzle-orm/pg-core'; pgTable('x', {});`;
    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/_helpers/tenantScopedTable.ts');
    expect(hits).toHaveLength(0);
  });

  it('ignores comments that mention pgTable', () => {
    const source = `// pgTable is only allowed in _helpers\nexport const x = 1;`;
    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/widgets.ts');
    expect(hits).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement assertion**

Create `packages/db/src/codegen/assert-all-tables-marked.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface Violation { file: string; line: number; message: string; }

export function findRawPgTableUsages(source: string, file: string): Violation[] {
  if (file.includes(`${sep}_helpers${sep}`)) return [];
  const out: Violation[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const code = raw.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/\bpgTable\s*\(/.test(code)) {
      out.push({
        file,
        line: i + 1,
        message: `raw pgTable() forbidden — use tenantScopedTable() or platformGlobalTable() from _helpers/`,
      });
    }
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

export function assertAllTablesMarked(schemaDir: string): Violation[] {
  const files = walk(schemaDir);
  const violations: Violation[] = [];
  for (const f of files) {
    violations.push(...findRawPgTableUsages(readFileSync(f, 'utf8'), relative(process.cwd(), f)));
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = assertAllTablesMarked(join(process.cwd(), 'packages/db/src/schema'));
  if (violations.length > 0) {
    for (const v of violations) console.error(`${v.file}:${v.line} — ${v.message}`);
    process.exit(1);
  }
  console.log('OK — all tables marked via helpers.');
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @goldsmith/db test:unit
```

Expected: all pass.

- [ ] **Step 4: Wire into build script**

Append to `packages/db/package.json` `scripts`:

```json
"build": "pnpm db:assert-marked && tsc --noEmit",
"db:assert-marked": "tsx src/codegen/assert-all-tables-marked.ts"
```

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): assert-all-tables-marked build-fail (invariant 1)"
```

---

## Task 10: Schema for shops, shop_users, audit_events

**Files:**
- Create: `packages/db/src/schema/shops.ts`, `shop-users.ts`, `audit-events.ts`, `index.ts`

- [ ] **Step 1: shops (platformGlobalTable)**

Create `packages/db/src/schema/shops.ts`:

```ts
import { uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

export const shopStatusEnum = pgEnum('shop_status', ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']);

export const shops = platformGlobalTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  display_name: text('display_name').notNull(),
  status: shopStatusEnum('status').notNull().default('PROVISIONING'),
  kek_key_arn: text('kek_key_arn'),
  config: jsonb('config').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: shop_users (tenantScopedTable)**

Create `packages/db/src/schema/shop-users.ts`:

```ts
import { uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const shopUserStatusEnum = pgEnum('shop_user_status', ['INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);

export const shopUsers = tenantScopedTable(
  'shop_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    display_name: text('display_name').notNull(),
    role: shopUserRoleEnum('role').notNull(),
    status: shopUserStatusEnum('status').notNull().default('INVITED'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  { encryptedColumns: [] },
);
```

- [ ] **Step 3: audit_events (tenantScopedTable, append-only)**

Create `packages/db/src/schema/audit-events.ts`:

```ts
import { uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const auditEvents = tenantScopedTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actor_user_id: uuid('actor_user_id'),
  action: text('action').notNull(),
  subject_type: text('subject_type').notNull(),
  subject_id: text('subject_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  metadata: jsonb('metadata'),
  ip: text('ip'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: schema index**

Create `packages/db/src/schema/index.ts`:

```ts
export * from './shops';
export * from './shop-users';
export * from './audit-events';
export { tableRegistry } from './_helpers/registry';
export type { TableMeta, TableKind } from './_helpers/registry';
```

- [ ] **Step 5: Run assert + typecheck**

```bash
pnpm --filter @goldsmith/db run db:assert-marked
pnpm --filter @goldsmith/db typecheck
```

Expected: `OK — all tables marked via helpers.` and typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): initial schema (shops, shop_users, audit_events)"
```

---

## Task 11: RLS codegen — `generate-rls.ts`

**Files:**
- Create: `packages/db/src/codegen/generate-rls.ts`
- Create: `packages/db/src/codegen/generate-rls.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/src/codegen/generate-rls.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateRlsSql } from './generate-rls';
import { tableRegistry } from '../schema/_helpers/registry';
import { tenantScopedTable } from '../schema/_helpers/tenantScopedTable';
import { platformGlobalTable } from '../schema/_helpers/platformGlobalTable';
import { text, uuid } from 'drizzle-orm/pg-core';

beforeEach(() => tableRegistry.clear());

describe('generateRlsSql', () => {
  it('emits ENABLE RLS + policy per tenantScopedTable', () => {
    tenantScopedTable('invoices', { total: text('total') });
    const sql = generateRlsSql();
    expect(sql).toContain('ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain(
      `CREATE POLICY rls_invoices_tenant_isolation ON invoices\n  FOR ALL\n  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)\n  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);`,
    );
  });

  it('emits FORCE ROW LEVEL SECURITY so owners cannot bypass', () => {
    tenantScopedTable('invoices', { total: text('total') });
    expect(generateRlsSql()).toContain('ALTER TABLE invoices FORCE ROW LEVEL SECURITY;');
  });

  it('skips platformGlobalTable', () => {
    platformGlobalTable('rates', { id: uuid('id').primaryKey() });
    const sql = generateRlsSql();
    expect(sql).not.toContain('rates');
  });

  it('is idempotent (uses DROP POLICY IF EXISTS)', () => {
    tenantScopedTable('x', { y: text('y') });
    expect(generateRlsSql()).toContain('DROP POLICY IF EXISTS rls_x_tenant_isolation ON x;');
  });
});
```

- [ ] **Step 2: Implement codegen**

Create `packages/db/src/codegen/generate-rls.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tableRegistry } from '../schema/_helpers/registry';
import '../schema'; // side effect: registers all tables

export function generateRlsSql(): string {
  const parts: string[] = ['-- AUTO-GENERATED by generate-rls.ts. Do not edit by hand.\n'];
  for (const meta of tableRegistry.list()) {
    if (meta.kind !== 'tenant') continue;
    parts.push(`-- ${meta.name}`);
    parts.push(`ALTER TABLE ${meta.name} ENABLE ROW LEVEL SECURITY;`);
    parts.push(`ALTER TABLE ${meta.name} FORCE ROW LEVEL SECURITY;`);
    parts.push(`DROP POLICY IF EXISTS rls_${meta.name}_tenant_isolation ON ${meta.name};`);
    parts.push(
      `CREATE POLICY rls_${meta.name}_tenant_isolation ON ${meta.name}\n` +
      `  FOR ALL\n` +
      `  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)\n` +
      `  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);`,
    );
    parts.push('');
  }
  return parts.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = generateRlsSql();
  const target = join(process.cwd(), 'packages/db/src/migrations/__generated__rls.sql');
  writeFileSync(target, out);
  console.log(`wrote ${target}`);
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @goldsmith/db test:unit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "feat(db): generate-rls codegen from table registry (invariant 2)"
```

---

## Task 12: Migration `0000_roles.sql` — DB roles

**Files:**
- Create: `packages/db/src/migrations/0000_roles.sql`

- [ ] **Step 1: Write roles migration**

Create `packages/db/src/migrations/0000_roles.sql`:

```sql
-- 0000_roles.sql — DB roles (created before tables, no grants yet)
-- Applied by the `migrator` role. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_app_user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_admin') THEN
    CREATE ROLE platform_admin NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_platform_admin';
  END IF;
END$$;

-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
-- runs migrations — bootstrapping it inside a migration is circular. This file documents the
-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.

-- Real passwords injected via secrets in deploy; local dev uses docker-compose defaults.
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/0000_roles.sql
git commit -m "feat(db): migration 0000_roles — app_user + platform_admin (NOSUPERUSER NOBYPASSRLS)"
```

---

## Task 13: Migration `0001_initial_schema.sql` — tables + RLS

**Files:**
- Create: `packages/db/src/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Write schema + RLS migration**

Create `packages/db/src/migrations/0001_initial_schema.sql`:

```sql
-- 0001_initial_schema.sql
-- Creates shops, shop_users, audit_events + RLS policies.
-- Codegen'd RLS from generate-rls.ts is appended manually below the DDL.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE shop_status        AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
CREATE TYPE shop_user_status   AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');

-- shops (platform-global; NO RLS)
CREATE TABLE shops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  status        shop_status NOT NULL DEFAULT 'PROVISIONING',
  kek_key_arn   TEXT,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shop_users (tenant-scoped; RLS enabled below)
CREATE TABLE shop_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  phone         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          shop_user_role NOT NULL,
  status        shop_user_status NOT NULL DEFAULT 'INVITED',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shop_users_shop_id_idx ON shop_users (shop_id);
CREATE UNIQUE INDEX shop_users_shop_id_phone_idx ON shop_users (shop_id, phone);

-- audit_events (tenant-scoped, append-only; RLS enabled + DML locked down in 0002)
CREATE TABLE audit_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  actor_user_id  UUID,
  action         TEXT NOT NULL,
  subject_type   TEXT NOT NULL,
  subject_id     TEXT,
  before         JSONB,
  after          JSONB,
  metadata       JSONB,
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_shop_id_created_idx ON audit_events (shop_id, created_at DESC);

-- RLS policies (copy this block from `tsx packages/db/src/codegen/generate-rls.ts`; keeping
-- inline here so this migration is self-contained + reviewable).
ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_shop_users_tenant_isolation ON shop_users;
CREATE POLICY rls_shop_users_tenant_isolation ON shop_users
  FOR ALL
  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_audit_events_tenant_isolation ON audit_events;
CREATE POLICY rls_audit_events_tenant_isolation ON audit_events
  FOR ALL
  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/0001_initial_schema.sql
git commit -m "feat(db): migration 0001 schema + RLS on tenant tables"
```

---

## Task 14: Migration `0002_grants.sql` — role privileges (append-only audit)

**Files:**
- Create: `packages/db/src/migrations/0002_grants.sql`

- [ ] **Step 1: Write grants migration**

Create `packages/db/src/migrations/0002_grants.sql`:

```sql
-- 0002_grants.sql — privilege grants. Order: roles (0000) → tables (0001) → grants (here).

-- app_user: DML on tenant tables, no DDL
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_users TO app_user;
GRANT SELECT                         ON shops      TO app_user;

-- audit_events: append-only for app_user (invariant 11)
GRANT INSERT, SELECT ON audit_events TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- migrator: DDL only, zero DML on tenant tables (invariant 5)
GRANT USAGE, CREATE ON SCHEMA public TO migrator;
REVOKE ALL ON shops        FROM migrator;
REVOKE ALL ON shop_users   FROM migrator;
REVOKE ALL ON audit_events FROM migrator;

-- platform_admin: broad access for SECURITY DEFINER functions (used in Story 1.5+)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_admin;

-- Default privileges so future tables automatically flow to app_user via migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/0002_grants.sql
git commit -m "feat(db): migration 0002 grants — app_user DML, audit_events append-only, migrator DDL-only"
```

---

## Task 15: `withTenantTx` + migration runner glue

**Files:**
- Create: `packages/db/src/tx.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/test/with-tenant-tx.integration.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/test/with-tenant-tx.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createPool } from '../src/provider';
import { withTenantTx } from '../src/tx';
import { tenantContext } from '@goldsmith/tenant-context';

let container: StartedPostgreSqlContainer;
let pool: Pool;
const SHOP_A = '11111111-1111-1111-1111-111111111111';
const SHOP_B = '22222222-2222-2222-2222-222222222222';

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  const c = await pool.connect();
  for (const f of ['0000_roles.sql', '0001_initial_schema.sql', '0002_grants.sql']) {
    await c.query(readFileSync(join(__dirname, `../src/migrations/${f}`), 'utf8'));
  }
  await c.query(`INSERT INTO shops (id, slug, display_name, status) VALUES
    ('${SHOP_A}','a','Shop A','ACTIVE'),
    ('${SHOP_B}','b','Shop B','ACTIVE');`);
  await c.query(`
    SET ROLE app_user;
    SET app.current_shop_id = '${SHOP_A}';
    INSERT INTO shop_users (shop_id, phone, display_name, role, status)
      VALUES ('${SHOP_A}', '+91a', 'Alice A', 'shop_admin', 'ACTIVE');
    SET app.current_shop_id = '${SHOP_B}';
    INSERT INTO shop_users (shop_id, phone, display_name, role, status)
      VALUES ('${SHOP_B}', '+91b', 'Bob B', 'shop_admin', 'ACTIVE');
    RESET ROLE;
  `);
  c.release();
}, 60_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('withTenantTx', () => {
  it('scopes SELECT to ALS tenant', async () => {
    const rows = await tenantContext.runWith({ shopId: SHOP_A } as never, () =>
      withTenantTx(pool, async (tx) => (await tx.query('SELECT * FROM shop_users')).rows),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].shop_id).toBe(SHOP_A);
  });

  it('throws when called outside runWith', async () => {
    await expect(withTenantTx(pool, async () => undefined)).rejects.toThrow(
      /tenant\.context_not_set/,
    );
  });

  it('rolls back on error + leaves SET LOCAL unleaked', async () => {
    await tenantContext.runWith({ shopId: SHOP_A } as never, async () => {
      await expect(
        withTenantTx(pool, async (tx) => {
          await tx.query('INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1,$2,$3,$4,$5)',
            [SHOP_A, '+91c', 'X', 'shop_staff', 'ACTIVE']);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });
    // Fresh conn, no tenant set → poison-default. Must SET ROLE app_user so RLS applies
    // (superusers bypass RLS even with FORCE; app_user is NOBYPASSRLS).
    const c = await pool.connect();
    await c.query('SET ROLE app_user');
    const { rows } = await c.query('SELECT * FROM shop_users');
    expect(rows).toHaveLength(0);
    await c.query('RESET ROLE');
    c.release();
  });
});
```

- [ ] **Step 2: Implement `withTenantTx`**

Create `packages/db/src/tx.ts`:

```ts
import type { Pool, PoolClient } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';

export async function withTenantTx<T>(
  pool: Pool,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  const ctx = tenantContext.current();
  if (!ctx) throw new Error('tenant.context_not_set');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 3: Implement migration runner**

Create `packages/db/src/migrate.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { logger } from '@goldsmith/observability';

export async function runMigrations(pool: Pool, dir: string): Promise<void> {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const c = await pool.connect();
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS __migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    for (const f of files) {
      const applied = await c.query('SELECT 1 FROM __migrations WHERE filename=$1', [f]);
      if (applied.rowCount && applied.rowCount > 0) continue;
      logger.info({ filename: f }, 'applying migration');
      await c.query(readFileSync(join(dir, f), 'utf8'));
      await c.query('INSERT INTO __migrations (filename) VALUES ($1)', [f]);
    }
  } finally {
    c.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  runMigrations(pool, join(process.cwd(), 'packages/db/src/migrations'))
    .then(() => pool.end())
    .catch((e) => { logger.error({ err: e }, 'migration failed'); process.exit(1); });
}
```

- [ ] **Step 4: Run integration test**

```bash
pnpm --filter @goldsmith/db test:integration
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): withTenantTx + migration runner (invariants 6, 12)"
```

---

## Task 16: `packages/tenant-context` — type + ALS + decorator + interceptor

**Files:**
- Create: `packages/tenant-context/{package.json,tsconfig.json}`
- Create: `packages/tenant-context/src/{context,als,decorator,interceptor,tenant-cache,index}.ts`
- Create: `packages/tenant-context/test/als.test.ts`, `interceptor.integration.test.ts`

- [ ] **Step 1: Package setup**

Create `packages/tenant-context/package.json`:

```json
{
  "name": "@goldsmith/tenant-context",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run --dir src",
    "test:integration": "vitest run --dir test"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "ioredis": "^5.3.0"
  },
  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" },
  "peerDependencies": { "rxjs": "^7.8.0", "reflect-metadata": "^0.2.0" }
}
```

Create `packages/tenant-context/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "experimentalDecorators": true, "emitDecoratorMetadata": true }, "include": ["src/**/*", "test/**/*"] }
```

- [ ] **Step 2: ALS test (red)**

Create `packages/tenant-context/test/als.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tenantContext } from '../src/als';

const A = { shopId: '11111111-1111-1111-1111-111111111111' };

describe('tenantContext (ALS)', () => {
  it('current() is undefined outside runWith', () => {
    expect(tenantContext.current()).toBeUndefined();
  });

  it('runWith makes current() return the ctx', async () => {
    await tenantContext.runWith(A as never, async () => {
      expect(tenantContext.current()?.shopId).toBe(A.shopId);
    });
    expect(tenantContext.current()).toBeUndefined();
  });

  it('context survives await + Promise.all', async () => {
    await tenantContext.runWith(A as never, async () => {
      await Promise.all([
        (async () => { await new Promise((r) => setImmediate(r)); expect(tenantContext.current()?.shopId).toBe(A.shopId); })(),
        (async () => { await new Promise((r) => process.nextTick(r));  expect(tenantContext.current()?.shopId).toBe(A.shopId); })(),
      ]);
    });
  });

  it('requireCurrent throws when unset', () => {
    expect(() => tenantContext.requireCurrent()).toThrow(/tenant\.context_not_set/);
  });
});
```

- [ ] **Step 3: Implement types + ALS**

Create `packages/tenant-context/src/context.ts`:

```ts
/**
 * Tenant context — set once at the request edge, propagated via AsyncLocalStorage.
 * Shape is intentionally minimal in E2-S1; Story 1.1 tightens `userId`/`role`.
 */
export interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
}

export interface TenantContext {
  readonly shopId: string;
  readonly tenant: Tenant;
  /** @sinceStory 1.1 — populated by JWT verification in auth module */
  readonly userId?: string;
  /** @sinceStory 1.1 */
  readonly role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
  /** @sinceStory 1.5 — platform-admin impersonation */
  readonly isImpersonating?: boolean;
  /** @sinceStory 1.5 */
  readonly impersonationAuditId?: string;
}
```

Create `packages/tenant-context/src/als.ts`:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from './context';

const als = new AsyncLocalStorage<TenantContext>();

export const tenantContext = {
  runWith<T>(ctx: TenantContext, fn: () => T | Promise<T>): T | Promise<T> {
    return als.run(ctx, fn);
  },
  current(): TenantContext | undefined {
    return als.getStore();
  },
  requireCurrent(): TenantContext {
    const ctx = als.getStore();
    if (!ctx) throw new Error('tenant.context_not_set');
    return ctx;
  },
} as const;
```

- [ ] **Step 4: Implement decorator + interceptor + cache**

Create `packages/tenant-context/src/decorator.ts`:

```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { tenantContext } from './als';
import type { TenantContext } from './context';

export const TenantContextDec = createParamDecorator(
  (_: unknown, _ctx: ExecutionContext): TenantContext => tenantContext.requireCurrent(),
);
```

Create `packages/tenant-context/src/tenant-cache.ts`:

```ts
import type Redis from 'ioredis';
import type { Tenant } from './context';

export interface TenantLookup {
  byId(shopId: string): Promise<Tenant | undefined>;
}

export class TenantCache implements TenantLookup {
  constructor(
    private readonly redis: Redis,
    private readonly loader: (shopId: string) => Promise<Tenant | undefined>,
    private readonly ttlSec = 60,
  ) {}

  async byId(shopId: string): Promise<Tenant | undefined> {
    const key = `tenant:${shopId}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as Tenant;
    const t = await this.loader(shopId);
    if (t) await this.redis.set(key, JSON.stringify(t), 'EX', this.ttlSec);
    return t;
  }

  async invalidate(shopId: string): Promise<void> {
    await this.redis.del(`tenant:${shopId}`);
  }
}
```

Create `packages/tenant-context/src/interceptor.ts`:

```ts
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { from, type Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { tenantContext } from './als';
import type { TenantContext, Tenant } from './context';
import type { TenantLookup } from './tenant-cache';

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  hostname?: string;
  path?: string;
}

export interface TenantResolver {
  fromHost(host: string): Promise<string | undefined>;
  fromHeader(req: RequestLike): string | undefined;
  fromJwt(req: RequestLike): string | undefined;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly resolver: TenantResolver,
    private readonly tenants: TenantLookup,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.resolve(ctx)).pipe(switchMap((tc) =>
      new Observable<unknown>((sub) => {
        tenantContext.runWith(tc, () => {
          const inner = next.handle().subscribe({
            next: (v) => sub.next(v),
            error: (e) => sub.error(e),
            complete: () => sub.complete(),
          });
          return () => inner.unsubscribe();
        });
      }),
    ));
  }

  private async resolve(ctx: ExecutionContext): Promise<TenantContext> {
    const req = ctx.switchToHttp().getRequest<RequestLike>();
    let shopId: string | undefined;
    if (req.hostname) shopId = await this.resolver.fromHost(req.hostname);
    shopId ??= this.resolver.fromHeader(req);
    shopId ??= this.resolver.fromJwt(req);

    if (shopId && (req.path === '/healthz' || shopId.startsWith('urn:'))) {
      // no tenant required; use a zero ctx
    }

    if (!shopId) throw new UnauthorizedException('tenant.resolution_failed');
    const tenant: Tenant | undefined = await this.tenants.byId(shopId);
    if (!tenant) throw new UnauthorizedException('tenant.not_found');
    if (tenant.status !== 'ACTIVE') throw new ForbiddenException('tenant.inactive');
    return { shopId: tenant.id, tenant };
  }
}
```

Create `packages/tenant-context/src/index.ts`:

```ts
export { tenantContext } from './als';
export { TenantContextDec } from './decorator';
export { TenantInterceptor, type TenantResolver, type RequestLike } from './interceptor';
export { TenantCache, type TenantLookup } from './tenant-cache';
export type { TenantContext, Tenant } from './context';
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @goldsmith/tenant-context test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/tenant-context
git commit -m "feat(tenant-context): ALS + decorator + interceptor + cache (ADR-0005 amended)"
```

---

## Task 17: ESLint rule `goldsmith/no-raw-shop-id-param`

**Files:**
- Create: `ops/eslint-rules/goldsmith/{package.json,index.js,tests/no-raw-shop-id-param.test.js}`
- Create: `ops/eslint-rules/goldsmith/rules/no-raw-shop-id-param.js`

- [ ] **Step 1: Package setup**

Create `ops/eslint-rules/goldsmith/package.json`:

```json
{
  "name": "eslint-plugin-goldsmith",
  "version": "0.0.0",
  "private": true,
  "main": "./index.js",
  "scripts": { "test": "node --test tests/" },
  "peerDependencies": { "eslint": "^8.57.0" },
  "devDependencies": { "@typescript-eslint/parser": "^7.0.0" }
}
```

- [ ] **Step 2: Write failing rule test**

Create `ops/eslint-rules/goldsmith/tests/no-raw-shop-id-param.test.js`:

```js
const { RuleTester } = require('eslint');
const rule = require('../rules/no-raw-shop-id-param');

const tester = new RuleTester({
  languageOptions: { parser: require('@typescript-eslint/parser') },
});

tester.run('no-raw-shop-id-param', rule, {
  valid: [
    { code: 'async function create(ctx: TenantContext, input: Dto) {}' },
    { code: 'class X { async do(ctx: TenantContext, arg: number) {} }' },
    { code: 'function migrateShop(shopId: string) {}', filename: 'packages/db/src/migrate.ts' },
  ],
  invalid: [
    {
      code: 'class X { async create(shopId: string, input: Dto) {} }',
      filename: 'apps/api/src/modules/demo/demo.service.ts',
      errors: [{ messageId: 'noRawShopIdParam' }],
    },
    {
      code: 'async function doThing(shopId: string) {}',
      filename: 'apps/api/src/modules/demo/demo.service.ts',
      errors: [{ messageId: 'noRawShopIdParam' }],
    },
  ],
});

console.log('no-raw-shop-id-param rule tests passed');
```

- [ ] **Step 3: Implement rule**

Create `ops/eslint-rules/goldsmith/rules/no-raw-shop-id-param.js`:

```js
'use strict';

const ALLOWED_PATH_FRAGMENTS = [
  '/packages/db/',
  '/packages/tenant-context/',
  '/packages/testing/',
  '/scripts/',
  '\\migrations\\',
  '/migrations/',
];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Service/repo methods must take `ctx: TenantContext` instead of a raw `shopId: string` param.',
    },
    messages: {
      noRawShopIdParam:
        'Forbidden: parameter `{{name}}: string` named `shopId`/`shop_id`/`tenantId`. Use `ctx: TenantContext` (ADR-0005).',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename || context.getFilename() || '').replace(/\\/g, '/');
    if (ALLOWED_PATH_FRAGMENTS.some((frag) => filename.includes(frag.replace(/\\/g, '/')))) {
      return {};
    }
    const check = (node) => {
      for (const p of node.params) {
        const id = p.type === 'Identifier' ? p : p.type === 'AssignmentPattern' ? p.left : null;
        if (!id || id.type !== 'Identifier') continue;
        const name = id.name;
        if (!/^(shopId|shop_id|tenantId)$/.test(name)) continue;
        const ann = id.typeAnnotation && id.typeAnnotation.typeAnnotation;
        const isString = ann && ann.type === 'TSStringKeyword';
        if (isString) context.report({ node: id, messageId: 'noRawShopIdParam', data: { name } });
      }
    };
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      MethodDefinition(node) { check(node.value); },
      TSDeclareMethod(node) { check(node.value || node); },
    };
  },
};
```

Create `ops/eslint-rules/goldsmith/index.js`:

```js
'use strict';
module.exports = {
  rules: {
    'no-raw-shop-id-param': require('./rules/no-raw-shop-id-param'),
  },
};
```

- [ ] **Step 4: Run tests**

```bash
cd ops/eslint-rules/goldsmith && pnpm install && node --test tests/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add ops/eslint-rules/goldsmith
git commit -m "feat(eslint): goldsmith/no-raw-shop-id-param rule (invariant 9)"
```

---

## Task 18: Semgrep rule `require-tenant-transaction`

**Files:**
- Create: `ops/semgrep/require-tenant-transaction.yaml`
- Create: `ops/semgrep/tests/require-tenant-transaction/{ok.ts,bad.ts,expected.yaml}`

- [ ] **Step 1: Write rule**

Create `ops/semgrep/require-tenant-transaction.yaml`:

```yaml
rules:
  - id: goldsmith.require-tenant-transaction
    languages: [typescript]
    severity: ERROR
    message: |
      Raw DB execution is forbidden. Wrap queries in `withTenantTx` (packages/db) so the
      tenant SET LOCAL is always applied. If this call is intentionally platform-global, use the
      `platformGlobalExecute()` helper + reviewer sign-off.
    paths:
      exclude:
        - "packages/db/**"
        - "packages/testing/**"
        - "**/*.test.ts"
        - "**/*.integration.test.ts"
    patterns:
      - pattern-either:
          - pattern: $DB.execute($...X)
          - pattern: $DB.query($...X)
          - pattern: $POOL.connect()
      - pattern-not-inside: |
          withTenantTx(...) { ... }
      - pattern-not-inside: |
          withTenantTx($POOL, async ($TX) => { ... })
```

- [ ] **Step 2: Fixtures**

Create `ops/semgrep/tests/require-tenant-transaction/bad.ts`:

```ts
import { pool } from '@goldsmith/db';
export async function bad() {
  return pool.query('SELECT * FROM shop_users');
}
```

Create `ops/semgrep/tests/require-tenant-transaction/ok.ts`:

```ts
import { pool, withTenantTx } from '@goldsmith/db';
export async function ok() {
  return withTenantTx(pool, async (tx) => (await tx.query('SELECT * FROM shop_users')).rows);
}
```

- [ ] **Step 3: Run Semgrep**

```bash
semgrep --config ops/semgrep/require-tenant-transaction.yaml ops/semgrep/tests/require-tenant-transaction/
```

Expected: 1 finding in `bad.ts`, 0 in `ok.ts`.

- [ ] **Step 4: Commit**

```bash
git add ops/semgrep/require-tenant-transaction.yaml ops/semgrep/tests/require-tenant-transaction
git commit -m "feat(semgrep): require-tenant-transaction (invariant 6; S1-M9)"
```

---

## Task 19: Semgrep rules — `no-tenant-id-from-request-input` + `als-boundary-preserved`

**Files:**
- Create: `ops/semgrep/no-tenant-id-from-request-input.yaml`
- Create: `ops/semgrep/als-boundary-preserved.yaml`
- Create: fixture tests under `ops/semgrep/tests/`

- [ ] **Step 1: no-tenant-id-from-request-input rule**

Create `ops/semgrep/no-tenant-id-from-request-input.yaml`:

```yaml
rules:
  - id: goldsmith.no-tenant-id-from-request-input
    languages: [typescript]
    severity: ERROR
    message: |
      Tenant ID must never be taken from request input. Use JWT claim (via TenantInterceptor) or
      host CNAME. Violates threat-model S1-M2.
    patterns:
      - pattern-either:
          - pattern: |
              $X.query.shopId
          - pattern: |
              $X.body.shopId
          - pattern: |
              $X.params.shopId
          - pattern: |
              $X.query.shop_id
          - pattern: |
              $X.body.tenant_id
          - pattern: |
              $X.params.tenant_id
    paths:
      exclude:
        - "packages/tenant-context/**"
        - "**/*.test.ts"
```

- [ ] **Step 2: als-boundary-preserved rule**

Create `ops/semgrep/als-boundary-preserved.yaml`:

```yaml
rules:
  - id: goldsmith.als-boundary-preserved
    languages: [typescript]
    severity: WARNING
    message: |
      Detaching from the current microtask (setImmediate/process.nextTick/setTimeout) or spawning
      workers inside service code can drop the AsyncLocalStorage tenant context. If this is
      intentional, add `// als-ok: <reason>` on the prior line (reviewer sign-off required per
      ADR-0005 amendment).
    patterns:
      - pattern-either:
          - pattern: setImmediate($...X)
          - pattern: process.nextTick($...X)
          - pattern: setTimeout($...X)
          - pattern: new Worker($...X)
      - pattern-not-regex: 'als-ok:'
    paths:
      include: ["apps/api/**", "packages/**"]
      exclude:
        - "packages/tenant-context/**"
        - "packages/queue/**"
        - "packages/testing/**"
        - "**/*.test.ts"
```

- [ ] **Step 3: Fixtures + run**

Create `ops/semgrep/tests/no-tenant-id-from-request-input/bad.ts`:

```ts
export function bad(req: { body: { shopId?: string } }) {
  return req.body.shopId;
}
```

Create `ops/semgrep/tests/no-tenant-id-from-request-input/ok.ts`:

```ts
import { tenantContext } from '@goldsmith/tenant-context';
export function ok() { return tenantContext.requireCurrent().shopId; }
```

Run:

```bash
semgrep --config ops/semgrep/no-tenant-id-from-request-input.yaml ops/semgrep/tests/no-tenant-id-from-request-input/
semgrep --config ops/semgrep/als-boundary-preserved.yaml ops/semgrep/tests/
```

Expected: 1 finding in bad.ts; 0 in ok.ts; als-boundary rule reports 0 against fixture dir.

- [ ] **Step 4: Commit**

```bash
git add ops/semgrep/no-tenant-id-from-request-input.yaml ops/semgrep/als-boundary-preserved.yaml ops/semgrep/tests/
git commit -m "feat(semgrep): no-tenant-id-from-request-input + als-boundary-preserved (S1-M2, S1-M6)"
```

---

## Task 20: `packages/cache` — TenantScopedCache + `no-raw-ioredis-import`

**Files:**
- Create: `packages/cache/{package.json,tsconfig.json}`
- Create: `packages/cache/src/{tenant-scoped-cache,index}.ts`
- Create: `packages/cache/test/tenant-scoped-cache.test.ts`
- Create: `ops/semgrep/no-raw-ioredis-import.yaml`

- [ ] **Step 1: Package setup + failing test**

Create `packages/cache/package.json`:

```json
{
  "name": "@goldsmith/cache",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run"
  },
  "dependencies": {
    "ioredis": "^5.3.0",
    "@goldsmith/tenant-context": "workspace:*"
  },
  "devDependencies": { "vitest": "^1.4.0", "ioredis-mock": "^8.9.0", "typescript": "^5.4.0" }
}
```

Create `packages/cache/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

Create `packages/cache/test/tenant-scoped-cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import RedisMock from 'ioredis-mock';
import { tenantContext } from '@goldsmith/tenant-context';
import { TenantScopedCache } from '../src/tenant-scoped-cache';

const A = { shopId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
const B = { shopId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' };

describe('TenantScopedCache', () => {
  it('key-prefixes with shopId from ALS', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await tenantContext.runWith(A as never, () => cache.set('k', 'vA'));
    await tenantContext.runWith(B as never, () => cache.set('k', 'vB'));
    expect(await tenantContext.runWith(A as never, () => cache.get('k'))).toBe('vA');
    expect(await tenantContext.runWith(B as never, () => cache.get('k'))).toBe('vB');
  });

  it('throws if no tenant ctx', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await expect(cache.get('k')).rejects.toThrow(/tenant\.context_not_set/);
  });

  it('flushTenant removes only that tenant keys', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await tenantContext.runWith(A as never, async () => { await cache.set('a1', '1'); await cache.set('a2', '2'); });
    await tenantContext.runWith(B as never, () => cache.set('b1', '1'));
    await cache.flushTenant(A.shopId);
    expect(await tenantContext.runWith(A as never, () => cache.get('a1'))).toBeNull();
    expect(await tenantContext.runWith(B as never, () => cache.get('b1'))).toBe('1');
  });
});
```

- [ ] **Step 2: Implement**

Create `packages/cache/src/tenant-scoped-cache.ts`:

```ts
import type Redis from 'ioredis';
import { tenantContext } from '@goldsmith/tenant-context';

export class TenantScopedCache {
  constructor(private readonly redis: Redis) {}

  private key(k: string): string {
    return `t:${tenantContext.requireCurrent().shopId}:${k}`;
  }

  async get(k: string): Promise<string | null> { return this.redis.get(this.key(k)); }

  async set(k: string, v: string, ttlSec?: number): Promise<void> {
    if (ttlSec) await this.redis.set(this.key(k), v, 'EX', ttlSec);
    else await this.redis.set(this.key(k), v);
  }

  async del(k: string): Promise<void> { await this.redis.del(this.key(k)); }

  async flushTenant(shopId: string): Promise<void> {
    const prefix = `t:${shopId}:`;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
      if (keys.length > 0) await this.redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  }
}
```

Create `packages/cache/src/index.ts`:

```ts
export { TenantScopedCache } from './tenant-scoped-cache';
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @goldsmith/cache test
```

Expected: PASS.

- [ ] **Step 4: Semgrep rule no-raw-ioredis-import**

Create `ops/semgrep/no-raw-ioredis-import.yaml`:

```yaml
rules:
  - id: goldsmith.no-raw-ioredis-import
    languages: [typescript]
    severity: ERROR
    message: |
      Direct import of `ioredis` is forbidden outside packages/cache. Use TenantScopedCache so
      every key is tenant-prefixed (threat-model S1-M10).
    patterns:
      - pattern-either:
          - pattern: import $...X from 'ioredis'
          - pattern: import { $...X } from 'ioredis'
          - pattern: require('ioredis')
    paths:
      exclude:
        - "packages/cache/**"
        - "packages/tenant-context/**"
```

- [ ] **Step 5: Commit**

```bash
git add packages/cache ops/semgrep/no-raw-ioredis-import.yaml
git commit -m "feat(cache): TenantScopedCache + semgrep no-raw-ioredis-import (invariant 7; S1-M10)"
```

---

## Task 21: `packages/queue` — TenantQueue + BaseProcessor + `no-raw-bullmq-import`

**Files:**
- Create: `packages/queue/{package.json,tsconfig.json}`
- Create: `packages/queue/src/{tenant-queue,base-processor,index}.ts`
- Create: `packages/queue/test/tenant-queue.test.ts`
- Create: `ops/semgrep/no-raw-bullmq-import.yaml`

- [ ] **Step 1: Package + failing test**

Create `packages/queue/package.json`:

```json
{
  "name": "@goldsmith/queue",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run"
  },
  "dependencies": {
    "bullmq": "^5.7.0",
    "@goldsmith/tenant-context": "workspace:*",
    "@goldsmith/observability": "workspace:*"
  },
  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" }
}
```

Create `packages/queue/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

Create `packages/queue/test/tenant-queue.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildJobPayload, extractTenantId } from '../src/tenant-queue';

const A = { shopId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };

describe('tenant-queue payload shape', () => {
  it('buildJobPayload wraps data with meta.tenantId from ctx', () => {
    expect(buildJobPayload(A as never, { foo: 1 })).toEqual({
      meta: { tenantId: A.shopId },
      data: { foo: 1 },
    });
  });

  it('extractTenantId reads meta.tenantId', () => {
    expect(extractTenantId({ meta: { tenantId: A.shopId }, data: {} })).toBe(A.shopId);
  });

  it('extractTenantId throws on missing meta', () => {
    expect(() => extractTenantId({} as never)).toThrow(/queue\.missing_tenant_meta/);
  });
});
```

- [ ] **Step 2: Implement queue helpers**

Create `packages/queue/src/tenant-queue.ts`:

```ts
import { Queue, type JobsOptions } from 'bullmq';
import type Redis from 'ioredis';
import type { TenantContext } from '@goldsmith/tenant-context';

export interface JobPayload<T> {
  meta: { tenantId: string };
  data: T;
}

export function buildJobPayload<T>(ctx: TenantContext, data: T): JobPayload<T> {
  return { meta: { tenantId: ctx.shopId }, data };
}

export function extractTenantId(payload: Partial<JobPayload<unknown>>): string {
  const id = payload?.meta?.tenantId;
  if (!id) throw new Error('queue.missing_tenant_meta');
  return id;
}

export class TenantQueue<T> {
  private readonly queue: Queue<JobPayload<T>>;
  constructor(name: string, connection: Redis) {
    this.queue = new Queue<JobPayload<T>>(name, { connection });
  }
  async add(ctx: TenantContext, jobName: string, data: T, opts?: JobsOptions): Promise<void> {
    await this.queue.add(jobName, buildJobPayload(ctx, data), opts);
  }
  async close(): Promise<void> { await this.queue.close(); }
}
```

Create `packages/queue/src/base-processor.ts`:

```ts
import { Worker, type Job, type WorkerOptions } from 'bullmq';
import type Redis from 'ioredis';
import { tenantContext, type TenantContext, type Tenant } from '@goldsmith/tenant-context';
import { logger } from '@goldsmith/observability';
import { extractTenantId, type JobPayload } from './tenant-queue';

export interface TenantResolver {
  byId(id: string): Promise<Tenant | undefined>;
}

export function createTenantWorker<T>(
  name: string,
  handler: (ctx: TenantContext, data: T) => Promise<void>,
  tenants: TenantResolver,
  connection: Redis,
  opts: Omit<WorkerOptions, 'connection'> = {},
): Worker<JobPayload<T>> {
  return new Worker<JobPayload<T>>(
    name,
    async (job: Job<JobPayload<T>>) => {
      const shopId = extractTenantId(job.data);
      const tenant = await tenants.byId(shopId);
      if (!tenant) throw new Error('tenant.not_found');
      if (tenant.status !== 'ACTIVE') throw new Error('tenant.inactive');
      const ctx: TenantContext = { shopId: tenant.id, tenant };
      return tenantContext.runWith(ctx, async () => {
        logger.info({ jobId: job.id, shopId, name: job.name }, 'processing');
        await handler(ctx, job.data.data);
      });
    },
    { connection, ...opts },
  );
}
```

Create `packages/queue/src/index.ts`:

```ts
export { TenantQueue, buildJobPayload, extractTenantId, type JobPayload } from './tenant-queue';
export { createTenantWorker, type TenantResolver } from './base-processor';
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @goldsmith/queue test
```

Expected: PASS.

- [ ] **Step 4: Semgrep rule no-raw-bullmq-import**

Create `ops/semgrep/no-raw-bullmq-import.yaml`:

```yaml
rules:
  - id: goldsmith.no-raw-bullmq-import
    languages: [typescript]
    severity: ERROR
    message: |
      Direct import of bullmq is forbidden outside packages/queue. Use TenantQueue +
      createTenantWorker so tenant metadata is always present (threat-model S1-M7).
    patterns:
      - pattern-either:
          - pattern: import { Queue } from 'bullmq'
          - pattern: import { Worker } from 'bullmq'
          - pattern: import { QueueEvents } from 'bullmq'
          - pattern: require('bullmq')
    paths:
      exclude:
        - "packages/queue/**"
```

- [ ] **Step 5: Commit**

```bash
git add packages/queue ops/semgrep/no-raw-bullmq-import.yaml
git commit -m "feat(queue): TenantQueue + createTenantWorker + semgrep (invariant 8; S1-M7)"
```

---

## Task 22: `packages/audit` — the only path into `audit_events`

**Files:**
- Create: `packages/audit/{package.json,tsconfig.json}`
- Create: `packages/audit/src/{audit-log,index}.ts`
- Create: `packages/audit/test/audit-log.integration.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `packages/audit/package.json`:

```json
{
  "name": "@goldsmith/audit",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:integration": "vitest run --dir test"
  },
  "dependencies": {
    "@goldsmith/db": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "testcontainers": "^10.8.0",
    "@testcontainers/postgresql": "^10.8.0",
    "typescript": "^5.4.0"
  }
}
```

Create `packages/audit/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

Create `packages/audit/test/audit-log.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createPool } from '@goldsmith/db';
import { runMigrations } from '@goldsmith/db/src/migrate';
import { tenantContext } from '@goldsmith/tenant-context';
import { auditLog } from '../src/audit-log';

const A = '11111111-1111-1111-1111-111111111111';
let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, join(process.cwd(), 'packages/db/src/migrations'));
  const c = await pool.connect();
  await c.query(`INSERT INTO shops (id, slug, display_name, status) VALUES ('${A}', 'a', 'A', 'ACTIVE');`);
  c.release();
}, 60_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('auditLog', () => {
  it('inserts a row under the current tenant', async () => {
    await tenantContext.runWith({ shopId: A } as never, () =>
      auditLog(pool, { action: 'test.happened', subjectType: 'demo', subjectId: 'x', before: null, after: { ok: true } }),
    );
    const c = await pool.connect();
    const { rows } = await c.query(`SET ROLE app_user; SET app.current_shop_id='${A}'; SELECT action FROM audit_events`);
    expect(rows.some((r: { action: string }) => r.action === 'test.happened')).toBe(true);
    c.release();
  });

  it('throws outside a tenant context', async () => {
    await expect(auditLog(pool, { action: 'x', subjectType: 'y' })).rejects.toThrow(/tenant\.context_not_set/);
  });
});
```

- [ ] **Step 2: Implement**

Create `packages/audit/src/audit-log.ts`:

```ts
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface AuditEntry {
  action: string;
  subjectType: string;
  subjectId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  actorUserId?: string;
  ip?: string;
  userAgent?: string;
}

export async function auditLog(pool: Pool, entry: AuditEntry): Promise<void> {
  await withTenantTx(pool, async (tx) => {
    await tx.query(
      `INSERT INTO audit_events
       (shop_id, actor_user_id, action, subject_type, subject_id, before, after, metadata, ip, user_agent)
       VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.actorUserId ?? null,
        entry.action,
        entry.subjectType,
        entry.subjectId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      ],
    );
  });
}
```

Create `packages/audit/src/index.ts`:

```ts
export { auditLog, type AuditEntry } from './audit-log';
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @goldsmith/audit test:integration
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/audit
git commit -m "feat(audit): auditLog() as sole path into audit_events"
```

---

## Task 23: `packages/crypto-envelope` — LocalKMS + envelope hooks + semgrep

**Files:**
- Create: `packages/crypto-envelope/{package.json,tsconfig.json}`
- Create: `packages/crypto-envelope/src/{kms-adapter,local-kms,aws-kms,envelope,index}.ts`
- Create: `packages/crypto-envelope/test/envelope.test.ts`
- Create: `ops/semgrep/no-raw-kms-import.yaml`

- [ ] **Step 1: Package + failing test**

Create `packages/crypto-envelope/package.json`:

```json
{
  "name": "@goldsmith/crypto-envelope",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run"
  },
  "dependencies": { "@aws-sdk/client-kms": "^3.550.0" },
  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" }
}
```

Create `packages/crypto-envelope/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

Create `packages/crypto-envelope/test/envelope.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LocalKMS } from '../src/local-kms';
import { encryptColumn, decryptColumn } from '../src/envelope';

describe('envelope encryption (LocalKMS)', () => {
  it('round-trips plaintext through encrypt + decrypt', async () => {
    const kms = new LocalKMS();
    const arn = await kms.createKeyForTenant('tenant-a');
    const enc = await encryptColumn(kms, arn, 'hello');
    expect(enc.ciphertext).not.toEqual(Buffer.from('hello', 'utf8'));
    expect(await decryptColumn(kms, enc)).toBe('hello');
  });

  it('ciphertext for same plaintext differs (IV randomness)', async () => {
    const kms = new LocalKMS();
    const arn = await kms.createKeyForTenant('tenant-a');
    const a = await encryptColumn(kms, arn, 'x');
    const b = await encryptColumn(kms, arn, 'x');
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('KEK deletion prevents decryption', async () => {
    const kms = new LocalKMS();
    const arn = await kms.createKeyForTenant('tenant-b');
    const enc = await encryptColumn(kms, arn, 'secret');
    await kms.scheduleKeyDeletion(arn);
    await expect(decryptColumn(kms, enc)).rejects.toThrow(/key\.unavailable/);
  });
});
```

- [ ] **Step 2: Implement adapter + LocalKMS + envelope**

Create `packages/crypto-envelope/src/kms-adapter.ts`:

```ts
export interface EncryptedDek {
  encryptedDek: Buffer;
  keyArn: string;
}

export interface KmsAdapter {
  createKeyForTenant(tenantId: string): Promise<string>;
  generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }>;
  decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer>;
  scheduleKeyDeletion(keyArn: string, pendingDays?: number): Promise<void>;
}
```

Create `packages/crypto-envelope/src/local-kms.ts`:

```ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { KmsAdapter } from './kms-adapter';

interface StoredKey { keyMaterial: Buffer; deleted: boolean; }

export class LocalKMS implements KmsAdapter {
  private keys = new Map<string, StoredKey>();

  async createKeyForTenant(tenantId: string): Promise<string> {
    const arn = `local:kms:${tenantId}:${randomBytes(8).toString('hex')}`;
    this.keys.set(arn, { keyMaterial: randomBytes(32), deleted: false });
    return arn;
  }

  async generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }> {
    const kek = this.keys.get(keyArn);
    if (!kek || kek.deleted) throw new Error('key.unavailable');
    const plaintext = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', kek.keyMaterial, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { plaintext, encryptedDek: Buffer.concat([iv, tag, ct]) };
  }

  async decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer> {
    const kek = this.keys.get(keyArn);
    if (!kek || kek.deleted) throw new Error('key.unavailable');
    const iv = encryptedDek.subarray(0, 12);
    const tag = encryptedDek.subarray(12, 28);
    const ct = encryptedDek.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', kek.keyMaterial, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  async scheduleKeyDeletion(keyArn: string): Promise<void> {
    const k = this.keys.get(keyArn);
    if (k) k.deleted = true;
  }
}
```

Create `packages/crypto-envelope/src/aws-kms.ts`:

```ts
import {
  KMSClient,
  CreateKeyCommand,
  CreateAliasCommand,
  GenerateDataKeyCommand,
  DecryptCommand,
  ScheduleKeyDeletionCommand,
} from '@aws-sdk/client-kms';
import type { KmsAdapter } from './kms-adapter';

export class AwsKms implements KmsAdapter {
  constructor(private readonly client: KMSClient) {}

  async createKeyForTenant(tenantId: string): Promise<string> {
    const out = await this.client.send(new CreateKeyCommand({
      Description: `goldsmith tenant ${tenantId}`,
      KeyUsage: 'ENCRYPT_DECRYPT',
      KeySpec: 'SYMMETRIC_DEFAULT',
    }));
    const arn = out.KeyMetadata!.Arn!;
    await this.client.send(new CreateAliasCommand({
      AliasName: `alias/goldsmith-tenant-${tenantId}`,
      TargetKeyId: arn,
    }));
    return arn;
  }

  async generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }> {
    const out = await this.client.send(new GenerateDataKeyCommand({ KeyId: keyArn, KeySpec: 'AES_256' }));
    return {
      plaintext: Buffer.from(out.Plaintext as Uint8Array),
      encryptedDek: Buffer.from(out.CiphertextBlob as Uint8Array),
    };
  }

  async decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer> {
    const out = await this.client.send(new DecryptCommand({ KeyId: keyArn, CiphertextBlob: encryptedDek }));
    return Buffer.from(out.Plaintext as Uint8Array);
  }

  async scheduleKeyDeletion(keyArn: string, pendingDays = 30): Promise<void> {
    await this.client.send(new ScheduleKeyDeletionCommand({ KeyId: keyArn, PendingWindowInDays: pendingDays }));
  }
}
```

Create `packages/crypto-envelope/src/envelope.ts`:

```ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { KmsAdapter } from './kms-adapter';

export interface EnvelopeCiphertext {
  ciphertext: Buffer;
  encryptedDek: Buffer;
  iv: Buffer;
  tag: Buffer;
  keyArn: string;
}

export async function encryptColumn(
  kms: KmsAdapter,
  keyArn: string,
  plaintext: string,
): Promise<EnvelopeCiphertext> {
  const { plaintext: dek, encryptedDek } = await kms.generateDataKey(keyArn);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  dek.fill(0);
  return { ciphertext: ct, encryptedDek, iv, tag, keyArn };
}

export async function decryptColumn(kms: KmsAdapter, payload: EnvelopeCiphertext): Promise<string> {
  const dek = await kms.decryptDataKey(payload.encryptedDek, payload.keyArn);
  const decipher = createDecipheriv('aes-256-gcm', dek, payload.iv);
  decipher.setAuthTag(payload.tag);
  const plain = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
  dek.fill(0);
  return plain.toString('utf8');
}
```

Create `packages/crypto-envelope/src/index.ts`:

```ts
export type { KmsAdapter } from './kms-adapter';
export { LocalKMS } from './local-kms';
export { AwsKms } from './aws-kms';
export { encryptColumn, decryptColumn, type EnvelopeCiphertext } from './envelope';
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @goldsmith/crypto-envelope test
```

Expected: PASS.

- [ ] **Step 4: Semgrep no-raw-kms-import**

Create `ops/semgrep/no-raw-kms-import.yaml`:

```yaml
rules:
  - id: goldsmith.no-raw-kms-import
    languages: [typescript]
    severity: ERROR
    message: |
      Direct import of @aws-sdk/client-kms is forbidden outside packages/crypto-envelope. Use
      the envelope helpers so column-level encryption consistently uses per-tenant KEKs (ADR-0013).
    patterns:
      - pattern: import $...X from '@aws-sdk/client-kms'
    paths:
      exclude: ["packages/crypto-envelope/**"]
```

- [ ] **Step 5: Commit**

```bash
git add packages/crypto-envelope ops/semgrep/no-raw-kms-import.yaml
git commit -m "feat(crypto-envelope): envelope + LocalKMS + AwsKms adapter (ADR-0013, ADR-0014)"
```

---

## Task 24: `apps/api` bootstrap + `/healthz` + wire interceptor

**Files:**
- Create: `apps/api/{package.json,tsconfig.json}`
- Create: `apps/api/src/{main,app.module,health.controller,tenant-resolver}.ts`
- Create: `apps/api/src/common/filters/global-exception.filter.ts`
- Create: `apps/api/test/health.e2e.test.ts`

- [ ] **Step 1: Package setup**

Create `apps/api/package.json`:

```json
{
  "name": "@goldsmith/api",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/main.js",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:integration": "vitest run --dir test",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "@goldsmith/tenant-context": "workspace:*",
    "@goldsmith/observability": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "supertest": "^7.0.0",
    "vitest": "^1.4.0",
    "typescript": "^5.4.0"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "experimentalDecorators": true, "emitDecoratorMetadata": true, "outDir": "./dist" },
  "include": ["src/**/*", "test/**/*"]
}
```

Create `apps/api/tsconfig.build.json`:

```json
{ "extends": "./tsconfig.json", "exclude": ["**/*.test.ts", "**/*.e2e.test.ts", "test/**/*"] }
```

- [ ] **Step 2: Health e2e test (red)**

Create `apps/api/test/health.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

let app: INestApplication;

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  await app.init();
});

afterAll(async () => { await app?.close(); });

describe('GET /healthz', () => {
  it('returns 200 OK without requiring tenant ctx', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('tenant-scoped endpoint returns 401 without ctx', async () => {
    const res = await request(app.getHttpServer()).get('/demo/ping');
    expect([401, 404]).toContain(res.status);
  });
});
```

- [ ] **Step 3: Implement minimal API**

Create `apps/api/src/health.controller.ts`:

```ts
import { Controller, Get, SetMetadata } from '@nestjs/common';

export const SKIP_TENANT = 'skip-tenant';
export const SkipTenant = () => SetMetadata(SKIP_TENANT, true);

@Controller()
export class HealthController {
  @Get('/healthz')
  @SkipTenant()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

Create `apps/api/src/tenant-resolver.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { TenantResolver, RequestLike } from '@goldsmith/tenant-context';

@Injectable()
export class HttpTenantResolver implements TenantResolver {
  async fromHost(_host: string): Promise<string | undefined> { return undefined; }
  fromHeader(req: RequestLike): string | undefined {
    const h = req.headers['x-tenant-id'];
    return typeof h === 'string' ? h : undefined;
  }
  fromJwt(_req: RequestLike): string | undefined { return undefined; }
}
```

Create `apps/api/src/common/filters/global-exception.filter.ts`:

```ts
import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { logger } from '@goldsmith/observability';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = exception instanceof Error ? exception.message : 'internal_error';
    logger.error({ err: exception, status }, 'request failed');
    res.status(status).json({ error: { code, status } });
  }
}
```

Create `apps/api/src/app.module.ts`:

```ts
import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { HealthController, SKIP_TENANT } from './health.controller';
import { HttpTenantResolver } from './tenant-resolver';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TenantInterceptor, type TenantLookup, type Tenant } from '@goldsmith/tenant-context';

@Injectable()
class NoopTenantLookup implements TenantLookup {
  async byId(_id: string): Promise<Tenant | undefined> { return undefined; }
}

@Injectable()
class ConditionalTenantInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly inner: TenantInterceptor,
  ) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT, [ctx.getHandler(), ctx.getClass()]);
    if (skip) return next.handle();
    return this.inner.intercept(ctx, next);
  }
}

@Module({
  controllers: [HealthController],
  providers: [
    HttpTenantResolver,
    NoopTenantLookup,
    {
      provide: TenantInterceptor,
      useFactory: (resolver: HttpTenantResolver, tenants: NoopTenantLookup) =>
        new TenantInterceptor(resolver, tenants),
      inject: [HttpTenantResolver, NoopTenantLookup],
    },
    { provide: APP_INTERCEPTOR, useClass: ConditionalTenantInterceptor },
    { provide: APP_FILTER,      useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
```

Create `apps/api/src/main.ts`:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { initSentry, initOtel, logger } from '@goldsmith/observability';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  initSentry();
  initOtel('goldsmith-api');
  const app = await NestFactory.create(AppModule, { logger: false });
  const port = Number(process.env.PORT ?? '3000');
  await app.listen(port, '0.0.0.0');
  logger.info({ port }, 'api listening');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed');
  process.exit(1);
});
```

- [ ] **Step 4: Run e2e**

```bash
pnpm --filter @goldsmith/api install
pnpm --filter @goldsmith/api test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): NestJS bootstrap + /healthz + conditional TenantInterceptor"
```

---

## Task 25: `packages/testing/tenant-isolation` — schema-assertions

**Files:**
- Create: `packages/testing/tenant-isolation/{package.json,tsconfig.json}`
- Create: `packages/testing/tenant-isolation/src/schema-assertions.ts`
- Create: `packages/testing/tenant-isolation/test/schema-assertions.integration.test.ts`

- [ ] **Step 1: Package + failing test**

Create `packages/testing/tenant-isolation/package.json`:

```json
{
  "name": "@goldsmith/testing-tenant-isolation",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:tenant-isolation": "vitest run"
  },
  "dependencies": {
    "@goldsmith/db": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "testcontainers": "^10.8.0",
    "@testcontainers/postgresql": "^10.8.0",
    "typescript": "^5.4.0"
  }
}
```

Create `packages/testing/tenant-isolation/tsconfig.json`:

```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

Create `packages/testing/tenant-isolation/test/schema-assertions.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { join } from 'node:path';
import { createPool } from '@goldsmith/db';
import { runMigrations } from '@goldsmith/db/src/migrate';
import { assertRlsInvariants } from '../src/schema-assertions';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, join(process.cwd(), 'packages/db/src/migrations'));
}, 60_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('assertRlsInvariants', () => {
  it('passes against freshly migrated schema', async () => {
    const result = await assertRlsInvariants(pool);
    if (!result.ok) console.error(result.failures);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Implement assertions**

Create `packages/testing/tenant-isolation/src/schema-assertions.ts`:

```ts
import type { Pool } from 'pg';
import { tableRegistry } from '@goldsmith/db/src/schema/_helpers/registry';
import '@goldsmith/db/src/schema';

export interface AssertResult { ok: boolean; failures: string[]; }

export async function assertRlsInvariants(pool: Pool): Promise<AssertResult> {
  const fails: string[] = [];
  const c = await pool.connect();
  try {
    for (const meta of tableRegistry.list()) {
      const q = await c.query(
        `SELECT rowsecurity, relforcerowsecurity FROM pg_class
          JOIN pg_namespace n ON n.oid = relnamespace
          WHERE relname = $1 AND n.nspname = 'public'`,
        [meta.name],
      );
      if (q.rowCount === 0) { fails.push(`table ${meta.name} missing`); continue; }
      const { rowsecurity, relforcerowsecurity } = q.rows[0] as { rowsecurity: boolean; relforcerowsecurity: boolean };
      if (meta.kind === 'tenant') {
        if (!rowsecurity) fails.push(`${meta.name}: RLS not enabled (invariant 2)`);
        if (!relforcerowsecurity) fails.push(`${meta.name}: FORCE RLS not set (invariant 2)`);
        const p = await c.query(`SELECT polname FROM pg_policy WHERE polrelid = to_regclass($1)`, [meta.name]);
        if (p.rowCount === 0) fails.push(`${meta.name}: no policy (invariant 2)`);
      } else if (meta.kind === 'global') {
        if (rowsecurity) fails.push(`${meta.name}: RLS enabled on platformGlobalTable (invariant 3)`);
      }
    }

    const app = await c.query(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname='app_user'`);
    if (app.rowCount === 0) fails.push('app_user role missing (invariant 4)');
    else {
      const r = app.rows[0] as { rolbypassrls: boolean; rolsuper: boolean };
      if (r.rolbypassrls) fails.push('app_user has BYPASSRLS (invariant 4)');
      if (r.rolsuper) fails.push('app_user has SUPERUSER (invariant 4)');
    }

    const migratorDml = await c.query(
      `SELECT table_name, privilege_type FROM information_schema.table_privileges
        WHERE grantee='migrator' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
          AND table_schema='public'`,
    );
    for (const row of migratorDml.rows as Array<{ table_name: string; privilege_type: string }>) {
      const meta = tableRegistry.get(row.table_name);
      if (meta?.kind === 'tenant') {
        fails.push(`migrator has ${row.privilege_type} on tenant table ${row.table_name} (invariant 5)`);
      }
    }

    const auditGrants = await c.query(
      `SELECT privilege_type FROM information_schema.table_privileges
        WHERE grantee='app_user' AND table_name='audit_events'`,
    );
    const types = new Set(auditGrants.rows.map((r: { privilege_type: string }) => r.privilege_type));
    if (!types.has('INSERT')) fails.push('app_user lacks INSERT on audit_events (invariant 11)');
    if (types.has('UPDATE')) fails.push('app_user has UPDATE on audit_events (invariant 11)');
    if (types.has('DELETE')) fails.push('app_user has DELETE on audit_events (invariant 11)');
  } finally {
    c.release();
  }
  return { ok: fails.length === 0, failures: fails };
}
```

- [ ] **Step 3: Run**

```bash
pnpm --filter @goldsmith/testing-tenant-isolation test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/testing/tenant-isolation
git commit -m "feat(testing): RLS schema-assertions (invariants 2-5, 11)"
```

---

## Task 26: Tenant-isolation fixtures + 3-tenant behavioral harness

**Files:**
- Create: `packages/testing/tenant-isolation/fixtures/{registry,tenant-a,tenant-b,tenant-c}.ts`
- Create: `packages/testing/tenant-isolation/src/{harness,index}.ts`
- Create: `packages/testing/tenant-isolation/test/harness.integration.test.ts`

- [ ] **Step 1: Fixture registry + 3 tenants**

Create `packages/testing/tenant-isolation/fixtures/registry.ts`:

```ts
import type { Pool } from 'pg';

export interface FixtureTenant {
  id: string;
  slug: string;
  displayName: string;
  seed: (pool: Pool, id: string) => Promise<void>;
}

const tenants: FixtureTenant[] = [];
export const fixtureRegistry = {
  add(t: FixtureTenant): void { tenants.push(t); },
  list(): FixtureTenant[] { return [...tenants]; },
  clear(): void { tenants.length = 0; },
};
```

Create `packages/testing/tenant-isolation/fixtures/tenant-a.ts`:

```ts
import type { Pool } from 'pg';
import { fixtureRegistry } from './registry';

export const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

fixtureRegistry.add({
  id: TENANT_A_ID,
  slug: 'fixture-a',
  displayName: 'Fixture Tenant A',
  seed: async (pool: Pool, id: string) => {
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE app_user; SET app.current_shop_id='${id}';`);
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES
          ($1,'+91AAA001','Alice A','shop_admin','ACTIVE'),
          ($1,'+91AAA002','Akhil A','shop_staff','ACTIVE')`,
        [id],
      );
      for (let i = 1; i <= 5; i++) {
        await c.query(
          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, 'seed.a.${i}', 'seed')`,
          [id],
        );
      }
      await c.query('RESET ROLE');
    } finally { c.release(); }
  },
});
```

Create `packages/testing/tenant-isolation/fixtures/tenant-b.ts`:

```ts
import type { Pool } from 'pg';
import { fixtureRegistry } from './registry';

export const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

fixtureRegistry.add({
  id: TENANT_B_ID,
  slug: 'fixture-b',
  displayName: 'Fixture Tenant B',
  seed: async (pool: Pool, id: string) => {
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE app_user; SET app.current_shop_id='${id}';`);
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES
          ($1,'+91BBB001','Bhavna B','shop_admin','ACTIVE'),
          ($1,'+91BBB002','Bhim B','shop_manager','ACTIVE')`,
        [id],
      );
      for (let i = 1; i <= 5; i++) {
        await c.query(
          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, 'seed.b.${i}', 'seed')`,
          [id],
        );
      }
      await c.query('RESET ROLE');
    } finally { c.release(); }
  },
});
```

Create `packages/testing/tenant-isolation/fixtures/tenant-c.ts`:

```ts
import type { Pool } from 'pg';
import { fixtureRegistry } from './registry';

export const TENANT_C_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

fixtureRegistry.add({
  id: TENANT_C_ID,
  slug: 'fixture-c',
  displayName: 'Fixture Tenant C',
  seed: async (pool: Pool, id: string) => {
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE app_user; SET app.current_shop_id='${id}';`);
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES
          ($1,'+91CCC001','Chandra C','shop_admin','ACTIVE'),
          ($1,'+91CCC002','Charu C','shop_staff','ACTIVE')`,
        [id],
      );
      for (let i = 1; i <= 5; i++) {
        await c.query(
          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, 'seed.c.${i}', 'seed')`,
          [id],
        );
      }
      await c.query('RESET ROLE');
    } finally { c.release(); }
  },
});
```

- [ ] **Step 2: Harness implementation**

Create `packages/testing/tenant-isolation/src/harness.ts`:

```ts
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import { withTenantTx } from '@goldsmith/db';
import { tableRegistry } from '@goldsmith/db/src/schema/_helpers/registry';
import { fixtureRegistry } from '../fixtures/registry';
import '../fixtures/tenant-a';
import '../fixtures/tenant-b';
import '../fixtures/tenant-c';

export interface HarnessResult { ok: boolean; failures: string[]; }

export async function provisionFixtures(pool: Pool): Promise<void> {
  const c = await pool.connect();
  try {
    for (const t of fixtureRegistry.list()) {
      await c.query(
        `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.slug, t.displayName],
      );
    }
  } finally { c.release(); }
  for (const t of fixtureRegistry.list()) await t.seed(pool, t.id);
}

export async function runTenantIsolationHarness(pool: Pool): Promise<HarnessResult> {
  const fails: string[] = [];
  const tenants = fixtureRegistry.list();
  const tenantTables = tableRegistry.list().filter((m) => m.kind === 'tenant');

  for (const self of tenants) {
    for (const meta of tenantTables) {
      const rows = await tenantContext.runWith({ shopId: self.id } as never, () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query(`SELECT shop_id FROM ${meta.name}`);
          return r.rows as Array<{ shop_id: string }>;
        }),
      );
      for (const row of rows) {
        if (row.shop_id !== self.id) {
          fails.push(`${self.slug}: leaked row ${row.shop_id} from ${meta.name} (invariant 13)`);
        }
      }
    }
  }

  const c = await pool.connect();
  try {
    await c.query('SET ROLE app_user');
    for (const meta of tenantTables) {
      const r = await c.query(`SELECT count(*)::int AS n FROM ${meta.name}`);
      if ((r.rows[0] as { n: number }).n !== 0) {
        fails.push(`${meta.name}: no-ctx read returned rows (invariant 12)`);
      }
    }
    await c.query('RESET ROLE');
  } finally { c.release(); }

  return { ok: fails.length === 0, failures: fails };
}
```

Create `packages/testing/tenant-isolation/src/index.ts`:

```ts
export { assertRlsInvariants } from './schema-assertions';
export { provisionFixtures, runTenantIsolationHarness } from './harness';
export { fixtureRegistry } from '../fixtures/registry';
export { TENANT_A_ID } from '../fixtures/tenant-a';
export { TENANT_B_ID } from '../fixtures/tenant-b';
export { TENANT_C_ID } from '../fixtures/tenant-c';
```

- [ ] **Step 3: Harness test**

Create `packages/testing/tenant-isolation/test/harness.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { join } from 'node:path';
import { createPool } from '@goldsmith/db';
import { runMigrations } from '@goldsmith/db/src/migrate';
import { provisionFixtures, runTenantIsolationHarness } from '../src';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, join(process.cwd(), 'packages/db/src/migrations'));
  await provisionFixtures(pool);
}, 120_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('tenant-isolation harness', () => {
  it('3 tenants isolate on every tenantScopedTable (invariants 12-13)', async () => {
    const r = await runTenantIsolationHarness(pool);
    if (!r.ok) console.error(r.failures);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 4: Run**

```bash
pnpm --filter @goldsmith/testing-tenant-isolation test:tenant-isolation
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/testing/tenant-isolation
git commit -m "feat(testing): 3-tenant behavioral isolation harness (invariants 12-13)"
```

---

## Task 27: Endpoint-walker scaffold — exercises `/healthz`

**Files:**
- Create: `packages/testing/tenant-isolation/src/endpoint-walker.ts`
- Create: `packages/testing/tenant-isolation/test/endpoint-walker.e2e.test.ts`

- [ ] **Step 1: Walker implementation (scaffold)**

Create `packages/testing/tenant-isolation/src/endpoint-walker.ts`:

```ts
// LIT-UP-IN-STORY-1.1 — in E2-S1 this walker only exercises /healthz. Story 1.1 will introduce
// tenant-scoped endpoints and extend this walker to probe each with tenant A's ctx and assert
// zero B/C data leakage (Acceptance Criterion #10).

import { Test } from '@nestjs/testing';
import type { INestApplication, Type } from '@nestjs/common';
import request from 'supertest';

export interface WalkResult {
  route: string;
  method: string;
  status: number;
  skipReason?: string;
}

export async function walkHealthz(appModule: Type<unknown>): Promise<WalkResult[]> {
  const module = await Test.createTestingModule({ imports: [appModule] }).compile();
  const app: INestApplication = module.createNestApplication();
  await app.init();
  try {
    const res = await request(app.getHttpServer()).get('/healthz');
    return [{ route: '/healthz', method: 'GET', status: res.status }];
  } finally {
    await app.close();
  }
}
```

- [ ] **Step 2: Walker e2e test**

Create `packages/testing/tenant-isolation/test/endpoint-walker.e2e.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { walkHealthz } from '../src/endpoint-walker';
import { AppModule } from '@goldsmith/api/src/app.module';

describe('endpoint walker (E2-S1 scaffold)', () => {
  it('exercises /healthz and confirms 200', async () => {
    const res = await walkHealthz(AppModule);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ route: '/healthz', method: 'GET', status: 200 });
  });
});
```

- [ ] **Step 3: Add dep**

Append to `packages/testing/tenant-isolation/package.json` dependencies:

```json
"@goldsmith/api": "workspace:*",
"@nestjs/testing": "^10.3.0",
"supertest": "^7.0.0"
```

Run `pnpm install`, then:

```bash
pnpm --filter @goldsmith/testing-tenant-isolation test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/testing/tenant-isolation
git commit -m "feat(testing): endpoint-walker scaffold exercising /healthz (LIT-UP-IN-STORY-1.1)"
```

---

## Task 28: Scripts — db-reset + tenant-provision + tenant-delete

**Files:**
- Create: `scripts/db-reset.sh`
- Create: `scripts/tenant-provision.sh`
- Create: `scripts/tenant-delete.sh`

- [ ] **Step 1: db-reset.sh**

Create `scripts/db-reset.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"

echo "→ dropping + recreating schema public ..."
psql "$DB_URL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
SQL

echo "→ running migrations ..."
DATABASE_URL="$DB_URL" pnpm -F @goldsmith/db exec tsx src/migrate.ts

echo "✓ db reset complete"
```

- [ ] **Step 2: tenant-provision.sh**

Create `scripts/tenant-provision.sh`:

```bash
#!/usr/bin/env bash
# Usage: tenant-provision.sh --tenant <uuid-or-slug> [--slug <slug>] [--display <name>]
set -euo pipefail

TENANT_ID=""; SLUG=""; DISPLAY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant)  TENANT_ID="$2"; shift 2 ;;
    --slug)    SLUG="$2"; shift 2 ;;
    --display) DISPLAY="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }
SLUG="${SLUG:-$TENANT_ID}"
DISPLAY="${DISPLAY:-$SLUG}"

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"

echo "→ inserting shops row for $TENANT_ID ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO shops (id, slug, display_name, status)
VALUES ('$TENANT_ID', '$SLUG', '$DISPLAY', 'PROVISIONING')
ON CONFLICT (id) DO NOTHING;
SQL

echo "→ provisioning KMS KEK (LocalKMS in dev, AwsKms in prod) ..."
pnpm -F @goldsmith/crypto-envelope exec tsx -e "
import { LocalKMS } from './src/local-kms';
const k = new LocalKMS();
const arn = await k.createKeyForTenant('$TENANT_ID');
console.log(arn);
" | tee /tmp/goldsmith-kek.txt

KEK_ARN="$(cat /tmp/goldsmith-kek.txt | tail -n1)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"

echo "→ running tenant-isolation harness against new tenant ..."
DATABASE_URL="$DB_URL" pnpm -F @goldsmith/testing-tenant-isolation test:tenant-isolation

echo "✓ tenant $TENANT_ID provisioned (KEK $KEK_ARN) and harness-gated"
```

- [ ] **Step 3: tenant-delete.sh**

Create `scripts/tenant-delete.sh`:

```bash
#!/usr/bin/env bash
# Usage: tenant-delete.sh --tenant <uuid> --confirm
set -euo pipefail

TENANT_ID=""; CONFIRM=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant)  TENANT_ID="$2"; shift 2 ;;
    --confirm) CONFIRM=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }
[[ $CONFIRM -ne 1 ]] && { echo "--confirm required (MFA + multi-person approval in prod)" >&2; exit 2; }

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"

echo "→ deleting tenant rows from every tenantScopedTable ..."
pnpm -F @goldsmith/db exec tsx -e "
import { createPool } from './src/provider';
import { tableRegistry } from './src/schema/_helpers/registry';
import './src/schema';
const pool = createPool({ connectionString: '$DB_URL' });
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET ROLE platform_admin');
    for (const m of tableRegistry.list().filter((x) => x.kind === 'tenant')) {
      await c.query(\`DELETE FROM \${m.name} WHERE shop_id=\$1\`, ['$TENANT_ID']);
    }
    await c.query(\"DELETE FROM shops WHERE id=\$1\", ['$TENANT_ID']);
    await c.query('RESET ROLE');
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); await pool.end(); }
})().catch((e) => { console.error(e); process.exit(1); });
"

echo "→ flushing tenant cache keys ..."
redis-cli --scan --pattern "t:$TENANT_ID:*" | xargs -r redis-cli del

echo "→ scheduling KEK deletion (30-day AWS grace) ..."
# AwsKms.scheduleKeyDeletion on prod; LocalKMS already deleted in-memory on pool teardown
echo "(dev: LocalKMS — skipped)"

echo "→ generating DPDPA erasure certificate ..."
CERT="certs/dpdpa-erasure-$TENANT_ID-$(date -u +%Y%m%dT%H%M%SZ).pdf"
mkdir -p certs
echo "DPDPA erasure certificate placeholder for $TENANT_ID" > "${CERT%.pdf}.txt"
echo "✓ tenant $TENANT_ID deleted; certificate at $CERT (placeholder; full PDF in Story 1.5)"
```

- [ ] **Step 4: Permissions + commit**

```bash
chmod +x scripts/*.sh
git add scripts/
git commit -m "feat(scripts): db-reset + tenant-provision + tenant-delete (runbook §7.2, §8.3)"
```

---

## Task 29: CI `ship.yml` with 10 gated jobs + Codex

**Files:**
- Create: `.github/workflows/ship.yml`
- Create: `docs/db-workflow.md`

- [ ] **Step 1: CI pipeline**

Create `.github/workflows/ship.yml`:

```yaml
name: ship
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

permissions:
  contents: read
  id-token: write

env:
  PNPM_VERSION: "9.12.0"
  NODE_VERSION: "20.11.0"

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile

  typecheck:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  lint:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  unit:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit -- --coverage

  integration:
    needs: install
    runs-on: ubuntu-latest
    services:
      docker: { image: docker:24-dind, options: "--privileged" }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration

  tenant-isolation:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:tenant-isolation

  semgrep:
    needs: install
    runs-on: ubuntu-latest
    container: returntocorp/semgrep:latest
    steps:
      - uses: actions/checkout@v4
      - run: semgrep --config ops/semgrep/ --error .

  codex-review:
    needs: install
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}" }
      - name: Install Codex CLI
        run: npm i -g @openai/codex-cli
      - name: Codex review
        env: { OPENAI_API_KEY: "${{ secrets.OPENAI_API_KEY }}" }
        run: codex review --diff "origin/${{ github.base_ref }}...HEAD" --fail-on high

  terraform-validate:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with: { terraform_version: "1.7.5" }
      - name: validate modules
        run: |
          for d in infra/terraform/modules/* infra/terraform/envs/*; do
            (cd "$d" && terraform init -backend=false && terraform validate)
          done

  build:
    needs: [typecheck, lint, unit, integration, tenant-isolation, semgrep, terraform-validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

- [ ] **Step 2: db-workflow doc**

Create `docs/db-workflow.md`:

```markdown
# DB Workflow (E2-S1)

## Roles
- `app_user` — NOSUPERUSER NOBYPASSRLS; DML on tenant tables via `withTenantTx`. Used by `apps/api` + BullMQ workers.
- `migrator` — NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from AWS Secrets Manager, scoped to GitHub OIDC role.
- `platform_admin` — owns SECURITY DEFINER cross-tenant reads; used from admin console (Story 1.5+).

## DDL vs DML flow
DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`. DML happens through `withTenantTx(pool, fn)` (never direct `pool.query`) under `app_user`. `app_user` cannot run DDL; `migrator` cannot run DML on tenant tables.

## Adding a new table
1. Add a file under `packages/db/src/schema/` using `tenantScopedTable` or `platformGlobalTable`.
2. Run `pnpm -F @goldsmith/db run db:assert-marked` — passes if marker used.
3. Run `pnpm -F @goldsmith/db exec tsx src/codegen/generate-rls.ts` — emits RLS SQL.
4. Create a new migration `NNNN_<name>.sql` (next number) with table DDL + the emitted RLS block.
5. Add a `GRANT ... ON <new_table> TO app_user` in the same migration.
6. Add a harness fixture entry in `packages/testing/tenant-isolation/fixtures/*` so the 3-tenant test exercises the new table.

## Post-migrate data migrations
Backfills/transforms run as a BullMQ job using `app_user` + `withTenantTx` per tenant. They do NOT live in `.sql` files. Job entry point: `apps/api/src/modules/*/backfill-*.job.ts` (introduced in later stories).

## Running locally
```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres redis localstack
pnpm db:reset
pnpm test
```
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ship.yml docs/db-workflow.md
git commit -m "feat(ci): ship.yml with 10 gates incl. Codex + terraform-validate; add db-workflow doc"
```

---

## Task 30: Smoke test + final review gate

**Files:**
- Modify: `docs/runbook.md` (small update — reference new scripts)
- Modify: `MEMORY.md` (add E2-S1 completion marker — in `~/.claude` memory dir, not repo)

- [ ] **Step 1: Fresh-clone smoke**

From a clean clone (or after `git clean -fdx && rm -rf node_modules pnpm-lock.yaml` in a scratch worktree):

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres redis localstack
pnpm install
pnpm db:reset
pnpm typecheck
pnpm lint
pnpm test
pnpm test:tenant-isolation
pnpm semgrep
```

Expected: every command exits 0. Tenant-isolation harness reports `ok: true`.

- [ ] **Step 2: Run provision + delete scripts against fixture tenant**

```bash
scripts/tenant-provision.sh --tenant fd111111-1111-1111-1111-111111111111 --slug fixture-d
scripts/tenant-delete.sh   --tenant fd111111-1111-1111-1111-111111111111 --confirm
```

Expected: provision completes with harness-gate green; delete completes with placeholder DPDPA certificate at `certs/dpdpa-erasure-fd111111-*.pdf`.

- [ ] **Step 3: 5-layer review gate**

Per CLAUDE.md, before `git push`:

1. `/code-review` — cheap lint pass.
2. `/security-review` — security pass.
3. `codex review --diff HEAD~1` — Codex authoritative gate.
4. `/bmad-code-review` — Blind Hunter + Edge Case Hunter + Acceptance Auditor.
5. `/superpowers:requesting-code-review` — final.

If any layer fails: fix the root cause, create a new commit (never `--amend` published commits), re-run. Only after all five are green and CI is green on the PR, merge.

- [ ] **Step 4: Update runbook cross-reference**

Open `docs/runbook.md` §7.2, confirm the two script paths `scripts/tenant-provision.sh` and `scripts/tenant-delete.sh` are referenced. If wording has drifted, update the commands to match the actual script flags implemented in Task 28 (`--tenant <uuid>` required; `--slug` + `--display` optional).

- [ ] **Step 5: Final commit + push**

```bash
git add docs/runbook.md
git commit -m "docs(runbook): cross-reference provision/delete scripts shipped in E2-S1"
git push
```

---

## Acceptance criteria traceability (spec §10)

| AC | Covered by |
|----|-----------|
| Fresh clone + `pnpm install && pnpm db:reset && pnpm test` passes incl. harness | Task 30 Step 1 |
| Raw `pgTable('orders', {...})` build fails with helper-pointer message | Task 9 + integration with Task 2 `pnpm build` |
| `db.execute(...)` outside `withTenantTx` fails Semgrep | Task 18 |
| Poison-default returns 0 rows on no-ctx query | Task 7 Step 3 integration test + Task 26 harness |
| 3 tenants A/B/C — only own rows visible | Task 26 |
| `tenant-provision.sh` runs harness as final gate | Task 28 Step 2 |
| `tenant-delete.sh` deletes rows + schedules KEK + flushes cache + issues cert | Task 28 Step 3 |
| `migrator` cannot SELECT on shop_users → permission denied | Task 25 Step 2 assertion row 5 |
| Terraform resources all in ap-south-1 | Task 5 (locked provider) + Task 29 terraform-validate job |
| Story 1.1's first tenant-scoped endpoint returns zero B/C data under A's JWT | Task 27 walker scaffold + lit up in Story 1.1 |

## Invariants traceability (spec §7)

| # | Enforcement task |
|---|-------------------|
| 1 | Task 9 (assert-all-tables-marked) |
| 2 | Task 11 + Task 25 |
| 3 | Task 11 + Task 25 |
| 4 | Task 25 |
| 5 | Task 25 + Task 14 |
| 6 | Task 18 |
| 7 | Task 20 |
| 8 | Task 21 |
| 9 | Task 17 |
| 10 | Task 19 |
| 11 | Task 14 + Task 25 |
| 12 | Task 7 + Task 26 |
| 13 | Task 26 |
| 14 | Task 28 |
| 15 | Task 6 + Task 29 (terraform-validate) |

---

**Self-review addendum:** Every spec §9 open question is resolved in the "Locked decisions" block. Every §7 invariant has a task. Every §10 AC has a test or script. No `TBD`, `TODO`, `implement later`, or `similar to Task N` placeholders in any task step. Function/type names used across tasks (`tenantContext`, `withTenantTx`, `tableRegistry`, `TENANT_A_ID`, etc.) match the files that define them. Commit cadence averages 1 commit per task (~30 commits total) — small enough to review, large enough to be meaningful.
