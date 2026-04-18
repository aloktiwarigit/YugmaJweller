OpenAI Codex v0.121.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith-e2-s1
model: gpt-5.4
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019da15e-5170-7a51-b90d-13a43e1d7e9f
--------
user
changes against 'origin/main'
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff b6f374a3edcdcb4ea1b0b3eeb43d1d3f7d1fd624' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 253ms:
diff --git a/.editorconfig b/.editorconfig
new file mode 100644
index 0000000..0a29570
--- /dev/null
+++ b/.editorconfig
@@ -0,0 +1,10 @@
+root = true
+[*]
+charset = utf-8
+end_of_line = lf
+indent_style = space
+indent_size = 2
+insert_final_newline = true
+trim_trailing_whitespace = true
+[*.md]
+trim_trailing_whitespace = false
diff --git a/.eslintrc.cjs b/.eslintrc.cjs
new file mode 100644
index 0000000..3d94dc0
--- /dev/null
+++ b/.eslintrc.cjs
@@ -0,0 +1,59 @@
+/* eslint-env node */
+module.exports = {
+  root: true,
+  parser: '@typescript-eslint/parser',
+  plugins: ['@typescript-eslint', 'import', 'goldsmith'],
+  extends: [
+    'eslint:recommended',
+    'plugin:@typescript-eslint/recommended',
+    'plugin:import/recommended',
+    'plugin:import/typescript',
+  ],
+  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
+  rules: {
+    '@typescript-eslint/no-explicit-any': 'error',
+    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
+    'goldsmith/no-raw-shop-id-param': 'error',
+    'no-restricted-imports': ['error', {
+      patterns: [
+        { group: ['ioredis', 'ioredis/*'], message: 'Import ioredis only from packages/cache.' },
+        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
+        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
+      ],
+    }],
+  },
+  settings: { 'import/resolver': { typescript: true } },
+  ignorePatterns: ['dist', 'node_modules', '*.js.map'],
+  overrides: [
+    {
+      files: ['packages/tenant-context/**/*.ts', '**/packages/tenant-context/**/*.ts'],
+      rules: { 'no-restricted-imports': ['error', { patterns: [
+        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
+        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
+        { group: ['@azure/keyvault-keys', '@azure/keyvault-keys/*'], message: 'Import @azure/keyvault-keys only from packages/crypto-envelope.' },
+      ] }] },
+    },
+    {
+      files: ['packages/cache/**/*.ts', '**/packages/cache/**/*.ts'],
+      rules: { 'no-restricted-imports': ['error', { patterns: [
+        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
+        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
+        { group: ['@azure/keyvault-keys', '@azure/keyvault-keys/*'], message: 'Import @azure/keyvault-keys only from packages/crypto-envelope.' },
+      ] }] },
+    },
+    {
+      files: ['packages/queue/**/*.ts', '**/packages/queue/**/*.ts'],
+      rules: { 'no-restricted-imports': ['error', { patterns: [
+        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
+        { group: ['@azure/keyvault-keys', '@azure/keyvault-keys/*'], message: 'Import @azure/keyvault-keys only from packages/crypto-envelope.' },
+      ] }] },
+    },
+    {
+      files: ['packages/crypto-envelope/**/*.ts', '**/packages/crypto-envelope/**/*.ts'],
+      rules: { 'no-restricted-imports': ['error', { patterns: [
+        { group: ['ioredis', 'ioredis/*'], message: 'Import ioredis only from packages/cache.' },
+        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
+      ] }] },
+    },
+  ],
+};
diff --git a/.github/workflows/ship.yml b/.github/workflows/ship.yml
new file mode 100644
index 0000000..f3c2f4d
--- /dev/null
+++ b/.github/workflows/ship.yml
@@ -0,0 +1,107 @@
+name: ship
+on:
+  push: { branches: [main] }
+  pull_request: { branches: [main] }
+
+permissions:
+  contents: read
+  id-token: write
+
+env:
+  PNPM_VERSION: "9.12.0"
+  NODE_VERSION: "20.11.0"
+
+jobs:
+  install:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: "${{ env.PNPM_VERSION }}" }
+      - uses: actions/setup-node@v4
+        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
+      - run: pnpm install --frozen-lockfile
+
+  typecheck:
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: "${{ env.PNPM_VERSION }}" }
+      - uses: actions/setup-node@v4
+        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm typecheck
+
+  lint:
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: "${{ env.PNPM_VERSION }}" }
+      - uses: actions/setup-node@v4
+        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm lint
+
+  unit:
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: "${{ env.PNPM_VERSION }}" }
+      - uses: actions/setup-node@v4
+        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm test:unit -- --coverage
+
+  integration:
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: "${{ env.PNPM_VERSION }}" }
+      - uses: actions/setup-node@v4
+        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm test:integration
+
+  tenant-isolation:
+    needs: install
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: "${{ env.PNPM_VERSION }}" }
+      - uses: actions/setup-node@v4
+        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm test:tenant-isolation
+
+  semgrep:
+    needs: install
+    runs-on: ubuntu-latest
+    container: returntocorp/semgrep:latest
+    steps:
+      - uses: actions/checkout@v4
+      - run: semgrep --config ops/semgrep/ --error .
+
+  # Codex review is a LOCAL pre-push gate per CLAUDE.md, not a CI job.
+  # Run `codex review --diff HEAD~1` (or the `codex-review-gate` Claude Code plugin)
+  # before opening / merging a PR. CI handles the objective gates only.
+
+  build:
+    needs: [typecheck, lint, unit, integration, tenant-isolation, semgrep]
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: "${{ env.PNPM_VERSION }}" }
+      - uses: actions/setup-node@v4
+        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm build
diff --git a/.node-version b/.node-version
new file mode 100644
index 0000000..8b0beab
--- /dev/null
+++ b/.node-version
@@ -0,0 +1 @@
+20.11.0
diff --git a/.npmrc b/.npmrc
new file mode 100644
index 0000000..8a3e95d
--- /dev/null
+++ b/.npmrc
@@ -0,0 +1,3 @@
+engine-strict=true
+auto-install-peers=true
+strict-peer-dependencies=false
diff --git a/.prettierignore b/.prettierignore
new file mode 100644
index 0000000..3ddfe74
--- /dev/null
+++ b/.prettierignore
@@ -0,0 +1,4 @@
+dist
+node_modules
+pnpm-lock.yaml
+*.md
diff --git a/.prettierrc b/.prettierrc
new file mode 100644
index 0000000..4cbc711
--- /dev/null
+++ b/.prettierrc
@@ -0,0 +1,7 @@
+{
+  "semi": true,
+  "singleQuote": true,
+  "trailingComma": "all",
+  "printWidth": 100,
+  "tabWidth": 2
+}
diff --git a/CLAUDE.md b/CLAUDE.md
index d0fa69b..7bc99b0 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -1,6 +1,6 @@
 # Goldsmith — Claude Code Project Guide
 
-Project-level primer. Every Claude Code session should read this first. Updated 2026-04-17.
+Project-level primer. Every Claude Code session should read this first. Updated 2026-04-18 (stack corrected to Azure + Firebase; startup-lean infra deferred — see ADR-0015).
 
 ---
 
@@ -45,24 +45,24 @@ Always load these before making significant decisions. Do not re-derive what's a
 | Cache | Redis |
 | Queue | BullMQ |
 | Search | Meilisearch (Hindi-first) |
-| File storage | S3 (AWS Mumbai) + **ImageKit** CDN |
-| Auth | Phone OTP (Supabase Auth or Firebase Auth) |
+| File storage | **Azure Blob Storage** (Central India / South India) + **ImageKit** CDN |
+| Auth | **Firebase Auth** (phone OTP) — see ADR-0015 |
 | Monorepo | **Turborepo** |
-| Hosting | AWS Mumbai (ap-south-1) — data residency mandatory |
+| Hosting | **Azure Central India or South India** — data residency mandatory. Deferred until anchor SOW signed (see ADR-0015 + startup-economics feedback). |
 
 ## India vendor stack (locked)
 
 - **Gold rates:** IBJA (primary) + Metals.dev (fallback)
 - **Payments:** Razorpay (primary) + Cashfree (secondary)
-- **WhatsApp:** AiSensy BSP (Rs 1,500/mo, unlimited agents)
-- **SMS/OTP:** MSG91 (Rs 0.18-0.30/SMS)
+- **WhatsApp:** AiSensy BSP (Rs 1,500/mo, unlimited agents) — onboard when anchor MRR justifies
+- **SMS/OTP:** **Firebase Auth** handles phone OTP end-to-end (free Spark tier for MVP; pay-as-you-go $0.06/SMS when exceeded). MSG91 deferred unless Firebase Auth cannot fit a specific flow.
 - **KYC/eSign (Phase 4+):** Digio
 - **Maps:** Ola Maps (5M calls/month free)
 - **Push:** Firebase Cloud Messaging (free)
 - **Analytics:** PostHog (data-residency-compliant deployment)
 - **Errors:** Sentry
 - **Support:** Zoho Desk Standard (WhatsApp-native)
-- **Email:** Resend (MVP) → Amazon SES at scale
+- **Email:** Resend (MVP) → Azure Communication Services Email at scale
 - **HUID verification:** Surepass API wrapper (consumer-facing)
 
 All vendor integrations must use adapter pattern — swap = adapter rewrite only, not data migration.
@@ -180,12 +180,26 @@ Prepend this priming to any frontend-design session on a new feature.
 - Then: Create Architecture (CA) with Winston
 - Then: Create Epics & Stories (CE) → Sprint Planning → Dev cycle
 
+## Startup economics (startup-lean, revenue-first)
+
+Pre-revenue, engineering choices minimize recurring cost. Enterprise hardening waits until first paying tenant. See ADR-0015 + `memory/feedback_startup_economics_first.md`.
+
+Floor-cost MVP target: **≤ $20/month** (Firebase Auth free tier, Azure Postgres Flexible Burstable B1ms ~$12/mo once deployed, Azure Container Apps consumption scale-to-zero, Blob Storage pennies, Key Vault ~$1, GitHub + Sentry + PostHog free tiers).
+
+**Graduation triggers (ONLY then add enterprise infra):**
+- First paying anchor signs SOW + MRR confirmed
+- Regulatory audit demands Multi-AZ / per-tenant KEK / cross-region DR
+- Observable tenant-count or traffic destabilises current stack
+
+Everything in the original "Enterprise Floor" (Sentry + OTel + feature flags + Storybook + ADRs + threat model + runbook + PostHog + TS strict + 80% coverage) stays day-1 — **those are free**. The **infrastructure** graduations (Multi-AZ, 3 NAT, per-tenant KMS, Redis clusters, staging environments) wait.
+
 ## External blockers to unblock before coding begins
 
 1. 🚨 **Anchor SOW** — scope, fee, timeline, branding rights, IP ownership, change management, milestone payments. #1 dependency per PRFAQ verdict.
 2. Legal review — platform terms, jeweller-as-merchant classification, DPA for DPDPA.
 3. Apple/Google developer account decision — platform-owned vs per-tenant.
 4. Anchor policy decisions (4 items flagged in PRFAQ/PRD): "app price = committed price" policy, custom order refund/rework/deposit/cancellation policy, warranty insurance commitment, shipping scope.
+5. **Azure subscription** — reachable when the anchor SOW is signed, not before. Until then, all dev is local Docker + validated-only Terraform/azd configs.
 
 ## Working rules
 
diff --git a/_bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md b/_bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md
index 9e21513..59d614a 100644
--- a/_bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md
+++ b/_bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md
@@ -1,6 +1,6 @@
 # 0001 — Auth Provider: Supabase Auth (Mumbai) for Phone OTP
 
-**Status:** Accepted
+**Status:** Superseded in part by ADR-0015 (2026-04-18) — primary auth provider swapped to Firebase Auth for startup-lean MVP. Supabase Auth moves to "alternatives considered" in ADR-0015. Full rewrite deferred to Story 1.1 (auth) when infrastructure story lands.
 **Date:** 2026-04-17
 **Deciders:** Winston (Architect), John (PM), Alok (Agency)
 **Consulted:** Murat (Test Architect on OTP rate-limit semantics), Mary (BA on legal/residency)
diff --git a/_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md b/_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md
index 086ab9c..24684e2 100644
--- a/_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md
+++ b/_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md
@@ -1,6 +1,6 @@
 # 0005 — Tenant Context Propagation: Two-Layer Guard + RLS Enforcement
 
-**Status:** Accepted
+**Status:** Accepted (amended 2026-04-18)
 **Date:** 2026-04-17
 **Deciders:** Winston (Architect), Murat (Test Architect)
 
@@ -72,7 +72,7 @@ interface TenantContext {
 
 | Option | Rejected because |
 |--------|------------------|
-| **AsyncLocalStorage for implicit context** | Implicit = forgettable; harder to test; stack-trace confusion; we want explicit `ctx` param as a discipline |
+| **AsyncLocalStorage for implicit context** | Rejected-for-primary-path because Implicit = forgettable; harder to test; stack-trace confusion; we want explicit `ctx` param as a discipline [SUPERSEDED — see Amendment 2026-04-18] |
 | **Global middleware state (request.scope.tenantId)** | Same problem as ALS; no compile-time guarantee |
 | **Tenant set via thread-local** | Node is single-threaded async; would need ALS (see above) |
 | **Let controllers pass shopId manually** | Easy to forget; no compile-time guard |
@@ -129,3 +129,28 @@ export class BaseProcessor extends WorkerHost {
 - ADR-0002 (isolation strategy this builds on)
 - Architecture §Patterns Tenant-context, Audit
 - PRD FR1–7 + FR123 (platform-admin impersonation)
+
+---
+
+## Amendment — 2026-04-18 (E2-S1 plan session)
+
+**Status:** Accepted amendment. Supersedes "AsyncLocalStorage rejected" row above.
+**Context:** Services in libraries (cache, queue, outbound HTTP adapters) cannot practically thread `ctx` through every call site. Forcing explicit-only propagation creates a choice between (a) verbose threading that pollutes adapter code, or (b) per-call `shopId: string` params, which defeats the discipline. Hybrid model resolves this.
+
+**Amended decision:**
+- **Primary carrier:** `AsyncLocalStorage<TenantContext>` instance in `packages/tenant-context`. `tenantContext.runWith(ctx, fn)` seeds the ALS for the remainder of the promise chain.
+- **Explicit param retained:** Services and repositories still declare `ctx: TenantContext` as their first parameter (ESLint `no-raw-shop-id-param` remains active). This is for discoverability and readability, not correctness — ALS is the backstop.
+- **Library code:** `packages/cache`, `packages/queue`, outbound adapters, and `withTenantTx` read `ctx` from ALS directly. They MUST NOT accept `shopId: string` params.
+- **Propagation Semgrep:** Rule `goldsmith/als-boundary-preserved` (ops/semgrep/als-boundary-preserved.yaml) flags `async`/`await`/`Promise.all`/`setImmediate`/`process.nextTick` patterns inside service methods that could drop the ALS context. Pragma `// als-ok: <reason>` allows reviewer-signed exceptions. This rule augments, not replaces, `goldsmith/require-tenant-transaction` from the original decision.
+- **BullMQ workers:** Job payload shape is `{ meta: { tenantId: string }; data: T }`. `BaseProcessor.process(job)` re-validates tenant ACTIVE, re-constructs `TenantContext`, wraps handler in `runWith`.
+- **Outbound HTTP:** Adapter base class reads ctx from ALS and attaches `X-Tenant-Id` header + audit.
+
+**Rationale:**
+- Explicit-only: broke down at library boundaries (cache, queue) forcing verbose-or-unsafe choices.
+- ALS-only: no compile-time discoverability; new engineers would miss the tenancy contract.
+- Hybrid: explicit at service surfaces (readable, lint-enforced), ALS at library surfaces (ergonomic, Semgrep-enforced).
+
+**Consequences:**
+- One additional runtime dependency: Node's built-in `async_hooks` (no npm addition).
+- Testing: any async code path run outside `runWith` that touches ALS throws `tenant.context_not_set`. Tests use a `withTestCtx(ctx, fn)` helper that wraps `runWith`.
+- RLS remains the backstop. Even if both ALS and explicit param fail, `withTenantTx` → `SET LOCAL` → RLS policy filters against the poison UUID.
diff --git a/_bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md b/_bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md
index 5f7a47c..8aa0429 100644
--- a/_bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md
+++ b/_bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md
@@ -1,6 +1,6 @@
 # 0012 — IaC: Terraform over AWS CDK for MVP
 
-**Status:** Accepted
+**Status:** Superseded in part by ADR-0015 (2026-04-18). Terraform stays as the IaC tool of choice; provider swaps from `hashicorp/aws` to `hashicorp/azurerm`. `azd` (Azure Developer CLI) introduced as preferred front-end for app-centric infra; Terraform retained for complex custom topologies. AWS-specific rationale (SCP examples, CloudTrail) superseded. Full rewrite deferred until infrastructure story.
 **Date:** 2026-04-17
 **Deciders:** Winston (Architect), Amelia (Dev), Alok (Agency)
 
diff --git a/_bmad-output/planning-artifacts/adr/0013-per-tenant-kek-envelope-encryption.md b/_bmad-output/planning-artifacts/adr/0013-per-tenant-kek-envelope-encryption.md
new file mode 100644
index 0000000..882c295
--- /dev/null
+++ b/_bmad-output/planning-artifacts/adr/0013-per-tenant-kek-envelope-encryption.md
@@ -0,0 +1,52 @@
+# 0013 — Per-Tenant KEK + Envelope Encryption for Sensitive Columns
+
+**Status:** Superseded in part by ADR-0015 (2026-04-18). Principle stands (per-tenant KEK + envelope encryption). AWS KMS CMK implementation swaps to **Azure Key Vault key per tenant** (RBAC-scoped, `ScheduleKeyDeletion` → soft-delete + purge protection). **For MVP, a single platform-level KEK is acceptable** — per-tenant keys deferred until compliance audit or first tenant contract demands. Full Azure rewrite deferred to infrastructure story.
+**Date:** 2026-04-18
+**Deciders:** Winston (Architect), Alok (Agency), Murat (Test Architect)
+
+## Context
+
+PRD NFR-S7 (zero cross-tenant data exposure), DPDPA Chapter III (right to erasure), and our threat model §Information-disclosure require that PII at rest is encrypted with keys we can revoke per-tenant. Column-level encryption with a single platform-wide KEK cannot satisfy per-tenant erasure.
+
+## Decision
+
+Adopt **AWS KMS Customer Master Key per tenant** with **envelope encryption** for sensitive columns.
+
+- One KMS CMK per tenant, aliased `alias/goldsmith-tenant-<shop-id-uuid>`.
+- Data Encryption Keys (DEKs) are 256-bit symmetric keys generated by KMS `GenerateDataKey`, returned plaintext + ciphertext. Plaintext DEK used in-memory to encrypt column; ciphertext DEK stored alongside the encrypted column.
+- `packages/crypto-envelope` provides `encryptColumn(ctx, value) -> { ciphertext, encryptedDek }` and `decryptColumn(ctx, { ciphertext, encryptedDek }) -> value`.
+- Tenant deletion: KMS `ScheduleKeyDeletion` with 30-day grace (AWS minimum). After grace period, every ciphertext for that tenant is unrecoverable — even from RDS PITR snapshots.
+- Dev-local: LocalStack KMS (`pro/kms`) container in `infra/docker-compose.dev.yml`. `LocalKMS` adapter routes to LocalStack. Semgrep rule `no-raw-kms-import` forbids `@aws-sdk/client-kms` outside `packages/crypto-envelope`.
+
+E2-S1 ships only the hooks. First column to use it is `shop_users.phone` in Story 1.1.
+
+## Consequences
+
+**Positive:**
+- Per-tenant crypto-shredding on deletion satisfies DPDPA erasure (see ADR-0014).
+- Compromise of one tenant's ciphertext is isolated to that tenant's KEK.
+- KMS audit-logs all key usage to CloudTrail.
+
+**Negative:**
+- KMS cost: ~$1/month per CMK + $0.03 per 10k requests. At 100 tenants ≈ $100/month floor. Revisit at 1,000 tenants ($1k/mo).
+- One extra round-trip for `GenerateDataKey` on first encryption of a session — mitigated by caching plaintext DEK for 5 minutes in memory. Cache is request-scoped or a per-tenant LRU with hard eviction on tenant offboarding event; plaintext DEK buffers are zeroed on eviction to limit heap exposure.
+- Key rotation is per-tenant, not platform-wide — documented in runbook §9 when key rotation policy is written.
+
+## Alternatives Considered
+
+| Option | Rejected because |
+|--------|------------------|
+| Single platform KEK + column encryption | Cannot satisfy per-tenant erasure — one key, all tenants |
+| Tenant key in app config (no HSM) | No hardware root of trust; loses the DPDPA erasure guarantee if backup taken before deletion |
+| AWS RDS TDE only | Operates at storage level; does not survive logical backup extraction; does not give per-tenant control |
+| Per-tenant CMK stored in Secrets Manager as raw key | Violates HSM root-of-trust requirement for PII |
+
+## Revisit triggers
+
+- 1,000+ tenants → cost review, consider KEK pooling for non-active tenants.
+- Key rotation policy defined (not in E2-S1 scope).
+- Regulatory change (DPDPA rules tightening encryption at rest).
+
+## References
+
+- ADR-0002, ADR-0014, PRD NFR-S7, threat-model §Information-disclosure row 4
diff --git a/_bmad-output/planning-artifacts/adr/0014-pitr-under-dpdpa-erasure.md b/_bmad-output/planning-artifacts/adr/0014-pitr-under-dpdpa-erasure.md
new file mode 100644
index 0000000..b9f8b61
--- /dev/null
+++ b/_bmad-output/planning-artifacts/adr/0014-pitr-under-dpdpa-erasure.md
@@ -0,0 +1,55 @@
+# 0014 — PITR Retention vs DPDPA Erasure — Documented Residual
+
+**Status:** Superseded in part by ADR-0015 (2026-04-18). Principle stands (documented residual + DPO sign-off). AWS RDS PITR specifics swap to **Azure Postgres Flexible Server PITR** (configurable 1-35 days) + Azure Activity Log audit. Full Azure rewrite deferred to infrastructure story.
+**Date:** 2026-04-18
+**Deciders:** Winston (Architect), Alok (Agency), Mary (BA, DPDPA compliance)
+
+## Context
+
+RDS PITR retains 7 days of transaction logs by default. DPDPA §10 requires erasure on data-principal request within a reasonable window (operationally, 30 days). The two windows conflict for non-encrypted tenant-scoped columns.
+
+## Decision
+
+**Column classification:**
+- **Encrypted columns (envelope-encrypted via per-tenant KEK per ADR-0013):** Unrecoverable after KEK deletion — KEK scheduled for deletion with 30-day grace on tenant offboarding, satisfying DPDPA §10. PITR snapshots contain ciphertext only.
+- **Non-encrypted tenant-scoped columns:** Restorable from PITR for up to 7 days after logical deletion. Examples: product names, price history, invoice totals (minus PII), audit_events (append-only, retained 8 years per tax law — separate regime).
+- **Platform-global tables (shops, compliance_rules_versions):** Retained per business requirements, not subject to per-tenant erasure.
+
+**Residual risk:**
+- A determined insider with admin DB access could restore a snapshot within the 7-day PITR window and read non-encrypted columns for a freshly-deleted tenant. 
+- Mitigation: PITR restore requires `break-glass` role (2-of-3 approvals per runbook §9); CloudTrail audit on every PITR API call; DPO must sign off on any PITR restore request touching a deleted tenant.
+
+**Implementation:**
+- All columns containing PII (phone, PAN, email, address, customer name, DOB) MUST be envelope-encrypted via `packages/crypto-envelope`. Semgrep rule enforces (added in Story 1.1 when columns land).
+- Non-PII tenant-scoped columns may remain plaintext.
+- Offboarding runbook (§8.3) records KEK deletion timestamp + PITR retention boundary for each tenant.
+- DPDPA erasure certificate (PDF, issued to tenant on offboarding) explicitly states: "Non-PII columns may remain restorable for up to 7 calendar days from deletion via restricted break-glass procedure; no personal data is recoverable after this window."
+
+## Consequences
+
+**Positive:**
+- Aligns operational DR needs with regulatory erasure obligations.
+- Explicit residual documented, not hidden.
+- PII has a hard cryptographic erasure; non-PII has a time-bounded soft erasure with audit.
+
+**Negative:**
+- First-paying-tenant requires DPO sign-off on the certificate wording.
+- Extended PITR retention (>7 days) requires ADR amendment.
+
+## Alternatives Considered
+
+| Option | Rejected because |
+|--------|------------------|
+| Disable RDS PITR | Violates NFR-R8 (1-hour RTO for table-drop incidents) |
+| Encrypt all columns | Loss of DB search/index capabilities on non-PII columns; massive perf cost |
+| Extend PITR to 35 days | Makes DPDPA window worse, not better |
+
+## Revisit triggers
+
+- DPDPA rules formalize specific erasure windows shorter than 7 days.
+- First regulator inquiry about deleted-tenant data.
+- Adoption of column-level encryption for a previously-plaintext column.
+
+## References
+
+- ADR-0013, DPDPA §10, PRD NFR-C5 (erasure), runbook §8.3, §9
diff --git a/_bmad-output/planning-artifacts/adr/0015-stack-correction-azure-firebase-startup-lean.md b/_bmad-output/planning-artifacts/adr/0015-stack-correction-azure-firebase-startup-lean.md
new file mode 100644
index 0000000..b18b781
--- /dev/null
+++ b/_bmad-output/planning-artifacts/adr/0015-stack-correction-azure-firebase-startup-lean.md
@@ -0,0 +1,128 @@
+# 0015 — Stack Correction: Azure + Firebase, Startup-Lean Infra (Revenue-First)
+
+**Status:** Accepted
+**Date:** 2026-04-18
+**Deciders:** Alok (Agency/founder), Claude (Opus 4.7) as planning counterpart
+**Supersedes:** parts of ADR-0001, ADR-0012, ADR-0013, ADR-0014 (see Amendments section)
+
+## Context
+
+The original architecture (ADRs 0001-0012, CLAUDE.md pre-2026-04-18) assumed AWS Mumbai (ap-south-1) with enterprise-grade infrastructure from Day 1: Multi-AZ RDS, 3× NAT gateways, ElastiCache Multi-AZ, per-tenant KMS CMKs, dedicated staging. Cost floor for a dev environment alone: ~$150-200/month. For a prod + dev setup approaching anchor launch: ~$400-500/month.
+
+During E2-S1 execution (the tenant-RLS scaffolding story), two uncoordinated assumptions in the prior architecture surfaced:
+
+1. **Cloud mismatch.** Alok's primary cloud is Microsoft Azure, not AWS. The AWS default was inherited from generic architecture patterns, never validated against the actual operator's expertise and account access. Azure Central India / South India are first-class AWS ap-south-1 equivalents for India data residency.
+
+2. **Cost/stage mismatch.** Goldsmith is pre-revenue. Anchor SOW is not yet signed (the #1 blocker per PRFAQ). Running always-on Multi-AZ infrastructure before the first paying tenant is cash burn against a venture whose viability is still being validated. The original CLAUDE.md "Enterprise Floor" conflated two distinct concerns — **code-quality enterprise floor** (TS strict, 80% coverage, Sentry, OTel, threat model, ADRs — all free or near-free) and **infrastructure enterprise floor** (Multi-AZ, NAT redundancy, per-tenant KMS, Redis clusters — real dollars per month) — and demanded both from Day 1.
+
+Alok's stated principle (2026-04-18, verbatim):
+
+> "We have to prove first it can generate revenue with minimum cost then only we can plan for better infra later."
+
+This ADR records the correction.
+
+## Decision
+
+### Stack: Azure + Firebase
+
+| Concern | Primary | Rationale |
+|---------|---------|-----------|
+| Compute | **Azure Container Apps** (consumption tier, scale-to-zero) | Free when idle; pay-per-request; no VM management |
+| Database | **Azure Database for PostgreSQL Flexible Server**, Burstable B1ms | ~$12/mo; Postgres 15.x; supports RLS unchanged |
+| Cache / queue backing | **Defer Redis in MVP.** In-process LRU + Postgres rate-limit table. Re-add Azure Cache for Redis when backpressure justifies | $0 in MVP, ~$16/mo when needed |
+| Queue | **Defer BullMQ.** Postgres jobs table + `LISTEN/NOTIFY` or Azure Container Apps jobs | $0 in MVP |
+| Secrets / keys | **Azure Key Vault** (single platform-level vault, single KEK) | ~$1/mo + pennies per op; per-tenant keys **deferred** until compliance audit or regulator asks |
+| Identity (end users) | **Firebase Auth** (phone OTP) | Free Spark tier for MVP phone OTP; pay-as-you-go $0.06/SMS when exceeded; replaces MSG91 + custom OTP stack |
+| Push notifications | **Firebase Cloud Messaging (FCM)** | Free, already in vendor stack |
+| Identity (platform admin) | **Microsoft Entra ID (Azure AD)** | Free tier covers small team |
+| Storage | **Azure Blob Storage** (Hot tier) | Pennies/month; data residency in Central India |
+| CDN | **ImageKit** (unchanged) | Vendor stack consistent |
+| IaC | **`azd` (Azure Developer CLI)** as primary; Terraform `azurerm` provider for cases where `azd` doesn't fit | `azd init + azd up` ships infra-to-deployed in minutes; Terraform retains option for future complex topologies |
+| Region | **Azure Central India (Pune)** or **South India (Chennai)** | DPDPA data residency requirement (NFR-C7) |
+| Observability | Pino + Sentry + OpenTelemetry + PostHog (unchanged) | All have free tiers; cloud-neutral |
+| Hosting decision deadline | **Not before anchor SOW is signed** | No production Azure subscription stood up until revenue is contracted |
+
+### Infrastructure MVP cost target: ≤ $20/month when anchor launches
+
+**Target infra spend at first paying tenant:**
+- Azure Container Apps (consumption, one service, scale-to-zero): ~$0-3/mo
+- Azure Postgres Flexible Server Burstable B1ms: ~$12-15/mo
+- Azure Key Vault: ~$1/mo
+- Azure Blob Storage Hot: ~$1-2/mo
+- Firebase Auth + FCM (Spark): $0 at MVP phone-OTP volumes
+- Azure Entra ID (free tier): $0
+- **Total: ~$15-20/mo**
+
+**Graduation triggers (only then add enterprise infra):**
+- First paying anchor signs SOW with measurable MRR
+- Regulatory audit (DPDPA compliance review, RBI inquiry) demands Multi-AZ / per-tenant KEK / cross-region DR
+- Observable traffic / tenant-count destabilises current stack (p95 latency SLO breach, connection saturation)
+
+### Documentation scope for this correction
+
+**Amended in this ADR session (minimum viable):**
+- `CLAUDE.md` — Tech stack Hosting/Auth/File storage/Email lines; vendor stack SMS/OTP; new Startup Economics section; Azure subscription listed as SOW-gated blocker.
+- This ADR (0015) itself documents the course correction.
+- Superseded notes prepended to ADR-0001, ADR-0012, ADR-0013, ADR-0014.
+- `docs/superpowers/plans/2026-04-18-E2-S1-tenant-rls-scaffolding.md` — Tasks 4/5/6 (AWS Terraform) removed from E2-S1 scope; Tasks 23/28/29 AWS refs swapped to Azure/Firebase.
+
+**Deferred to Infrastructure Story** (new story, post-anchor-SOW):
+- Full rewrite of `_bmad-output/planning-artifacts/architecture.md` (~2000 lines, AWS→Azure translation).
+- PRD NFR-C7 wording update (ap-south-1 → Azure India region).
+- Story 1.1 rewrite for Firebase Auth (replaces Supabase Auth adapter).
+- Runbook `scripts/tenant-provision.sh` + `tenant-delete.sh` AWS-CLI→`az`-CLI translation.
+- ADR-0013 full Azure Key Vault rewrite (currently flagged superseded here).
+- ADR-0014 full Azure Postgres PITR rewrite (currently flagged superseded here).
+
+Rationale for the deferral: the architecture / PRD / runbook rewrites are ~6-8 hours of careful editing that would burn attention on documents we'll revisit anyway when actually standing up infrastructure. Amending them now without standing up infra just risks the docs drifting from whatever actually ships. Better to update in the same session as the azd scaffold work.
+
+## Consequences
+
+**Positive:**
+- MVP infra cost floor drops from ~$200/mo to ~$20/mo — 10× runway extension on the same funding.
+- Azure + Firebase matches the operator's expertise, reducing operational errors during anchor launch.
+- Firebase Auth eliminates an entire vendor dependency (MSG91) and a custom OTP flow from MVP scope.
+- Scale-to-zero compute means idle environments are genuinely free.
+- Startup-economics principle codified — future decisions have a durable answer on "can we afford this yet?".
+
+**Negative / trade-offs:**
+- Existing 6 AWS Terraform commits (c5b9e96..d4705a1) are reset off the feature branch. Work is not lost — patterns are reusable when writing Azure equivalents — but the HCL itself is thrown away.
+- No Redis in MVP means rate-limiting / async jobs use Postgres-only patterns that will need migration to Redis+BullMQ when volume justifies. The migration is a real future cost.
+- Single AZ Postgres means a zone outage takes the service down. Acceptable trade-off pre-revenue; must upgrade before anchor go-live.
+- Azure Container Apps consumption has a cold-start penalty (~500ms-2s) on first request after idle. Acceptable for jeweller-app UX where sessions are long-lived.
+- Some prior ADRs (0013, 0014) reference AWS KMS / AWS RDS specifics that no longer apply until their Azure rewrites land.
+
+## Alternatives Considered
+
+| Option | Rejected because |
+|--------|------------------|
+| **Stay on AWS** | Operator's expertise is Azure; generic AWS default was unjustified |
+| **GCP + Firebase** (Firestore + Cloud Run) | Firestore's multi-tenancy model is weaker than Postgres RLS; switching the data layer restarts our RLS work |
+| **Supabase (Postgres + Auth)** | Free tier has limits that would be hit quickly; Supabase US region conflicts with India data residency; managed but not free beyond hobby scale |
+| **Pure Firebase (Firestore + Auth + Functions)** | Firestore's security-rules model doesn't give us Postgres RLS; we've already built RLS-based architecture |
+| **Self-hosted everything (Hetzner / Contabo)** | Management overhead + no SOC 2 / India-sovereignty story for DPDPA compliance |
+| **Azure `Burstable B1ms` + always-on Container App** (no scale-to-zero) | ~$20-30/mo compute floor without scale-to-zero; Consumption tier is strictly better until traffic is steady |
+
+## Revisit triggers
+
+- First paying anchor signs SOW → stand up real Azure subscription, `azd up` dev environment, then plan prod environment.
+- Azure Container Apps consumption cold-start becomes user-visible latency issue → graduate to Container Apps `Dedicated` or App Service.
+- Postgres Burstable B1ms saturation (> 80% CPU sustained or connection limit hit) → graduate to General Purpose D2ds_v5.
+- DPDPA compliance audit or a tenant contract demanding per-tenant KEK → rewrite ADR-0013 with Azure Key Vault key-per-tenant implementation.
+- Traffic volume justifies Redis → add Azure Cache for Redis, restore BullMQ.
+- Regulator requires cross-AZ / cross-region DR → graduate to Multi-AZ Flexible Server + geo-redundant backup.
+
+## Amendments applied to superseded ADRs
+
+- **ADR-0001 (Supabase Auth):** Primary chosen vendor swaps to Firebase Auth. Supabase Auth remains listed as an alternative. Full amendment deferred to the Infrastructure Story.
+- **ADR-0012 (Terraform over CDK, AWS provider ecosystem):** Decision to use Terraform over CDK stands. The provider becomes `azurerm` instead of `aws`. `azd` (Azure Developer CLI) is introduced as the preferred front-end for application-centric infra; Terraform is retained for complex custom topologies. The AWS-specific rationale (module ecosystem maturity on AWS, SCP examples) is superseded.
+- **ADR-0013 (per-tenant KEK via AWS KMS CMK):** Decision stands in principle (per-tenant KEK + envelope encryption). Concrete implementation swaps from AWS KMS CMK to Azure Key Vault key per tenant (access via RBAC, `ScheduleKeyDeletion` becomes `purge protection + soft delete`). Full rewrite deferred; for MVP a single platform KEK is acceptable until a tenant contract demands per-tenant.
+- **ADR-0014 (PITR under DPDPA erasure, AWS RDS):** Decision stands in principle (documented residual, DPO sign-off). AWS RDS PITR specifics (7-day retention default, CloudTrail on PITR API calls) swap to Azure Postgres Flexible Server PITR (configurable 1-35 days) + Azure Activity Log. Full rewrite deferred.
+
+## References
+
+- Memory: `user_cloud_preference.md`, `feedback_startup_economics_first.md`
+- PRFAQ: Anchor SOW is #1 blocker → validates "don't spend until revenue contracted"
+- PRD: NFR-C7 (data residency India) remains satisfied by Azure Central India / South India
+- CLAUDE.md (this project): Tech stack + Startup economics sections updated 2026-04-18
+- Previous ADRs: 0001, 0012, 0013, 0014 (partial supersede annotations)
diff --git a/_bmad-output/planning-artifacts/adr/README.md b/_bmad-output/planning-artifacts/adr/README.md
index 679618c..721c78b 100644
--- a/_bmad-output/planning-artifacts/adr/README.md
+++ b/_bmad-output/planning-artifacts/adr/README.md
@@ -10,7 +10,7 @@ This directory holds the authoritative ADRs for the Goldsmith platform. Each ADR
 
 | # | Title | Status | Date |
 |---|-------|--------|------|
-| 0001 | Auth provider — Supabase Auth (Mumbai) for phone OTP | Accepted | 2026-04-17 |
+| 0001 | Auth provider — Supabase Auth (Mumbai) for phone OTP | Superseded in part by 0015 | 2026-04-17 |
 | 0002 | Multi-tenant isolation — single DB + RLS + interceptor (defense-in-depth) | Accepted | 2026-04-17 |
 | 0003 | Money + weight primitives — DECIMAL-only, never FLOAT | Accepted | 2026-04-17 |
 | 0004 | Offline sync — pull-then-push with per-aggregate conflict policy | Accepted | 2026-04-17 |
@@ -21,4 +21,7 @@ This directory holds the authoritative ADRs for the Goldsmith platform. Each ADR
 | 0009 | Backend topology — modular monolith NestJS; microservices deferred with extraction plan | Accepted | 2026-04-17 |
 | 0010 | Tenant provisioning — scripted end-to-end with Terraform orchestration | Accepted | 2026-04-17 |
 | 0011 | Compliance — dedicated package with pure-function hard-block gateway | Accepted | 2026-04-17 |
-| 0012 | IaC — Terraform over AWS CDK for MVP | Accepted | 2026-04-17 |
+| 0012 | IaC — Terraform over AWS CDK for MVP | Superseded in part by 0015 | 2026-04-17 |
+| 0013 | Per-Tenant KEK + Envelope Encryption for Sensitive Columns | Superseded in part by 0015 | 2026-04-18 |
+| 0014 | PITR Retention vs DPDPA Erasure — Documented Residual | Superseded in part by 0015 | 2026-04-18 |
+| 0015 | Stack correction — Azure + Firebase, startup-lean infra (revenue-first) | Accepted | 2026-04-18 |
diff --git a/apps/api/package.json b/apps/api/package.json
new file mode 100644
index 0000000..0b4d0cf
--- /dev/null
+++ b/apps/api/package.json
@@ -0,0 +1,35 @@
+{
+  "name": "@goldsmith/api",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./dist/main.js",
+  "exports": {
+    ".": "./src/app.module.ts",
+    "./src/*": "./src/*.ts"
+  },
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run",
+    "test:integration": "vitest run --dir test",
+    "build": "tsc -p tsconfig.build.json",
+    "start": "node dist/main.js"
+  },
+  "dependencies": {
+    "@nestjs/common": "^10.3.0",
+    "@nestjs/core": "^10.3.0",
+    "@nestjs/platform-express": "^10.3.0",
+    "reflect-metadata": "^0.2.0",
+    "rxjs": "^7.8.0",
+    "@goldsmith/tenant-context": "workspace:*",
+    "@goldsmith/observability": "workspace:*"
+  },
+  "devDependencies": {
+    "@nestjs/testing": "^10.3.0",
+    "@types/express": "^4.17.0",
+    "@types/supertest": "^6.0.0",
+    "supertest": "^7.0.0",
+    "vitest": "^1.4.0",
+    "typescript": "^5.4.0"
+  }
+}
diff --git a/apps/api/src/app.module.ts b/apps/api/src/app.module.ts
new file mode 100644
index 0000000..9fed610
--- /dev/null
+++ b/apps/api/src/app.module.ts
@@ -0,0 +1,48 @@
+import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
+import { APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
+import { Observable } from 'rxjs';
+import { HealthController, SKIP_TENANT } from './health.controller';
+import { HttpTenantResolver } from './tenant-resolver';
+import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
+import { TenantInterceptor, type TenantLookup, type Tenant } from '@goldsmith/tenant-context';
+
+@Injectable()
+class NoopTenantLookup implements TenantLookup {
+  // eslint-disable-next-line @typescript-eslint/no-unused-vars
+  async byId(_id: string): Promise<Tenant | undefined> { return undefined; }
+}
+
+@Injectable()
+class ConditionalTenantInterceptor implements NestInterceptor {
+  constructor(
+    private readonly reflector: Reflector,
+    private readonly inner: TenantInterceptor,
+  ) {}
+  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
+    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT, [ctx.getHandler(), ctx.getClass()]);
+    if (skip) return next.handle();
+    return this.inner.intercept(ctx, next);
+  }
+}
+
+@Module({
+  controllers: [HealthController],
+  providers: [
+    HttpTenantResolver,
+    NoopTenantLookup,
+    {
+      provide: TenantInterceptor,
+      useFactory: (resolver: HttpTenantResolver, tenants: NoopTenantLookup) =>
+        new TenantInterceptor(resolver, tenants),
+      inject: [HttpTenantResolver, NoopTenantLookup],
+    },
+    {
+      provide: APP_INTERCEPTOR,
+      useFactory: (reflector: Reflector, inner: TenantInterceptor) =>
+        new ConditionalTenantInterceptor(reflector, inner),
+      inject: [Reflector, TenantInterceptor],
+    },
+    { provide: APP_FILTER,      useClass: GlobalExceptionFilter },
+  ],
+})
+export class AppModule {}
diff --git a/apps/api/src/common/filters/global-exception.filter.ts b/apps/api/src/common/filters/global-exception.filter.ts
new file mode 100644
index 0000000..60d3a72
--- /dev/null
+++ b/apps/api/src/common/filters/global-exception.filter.ts
@@ -0,0 +1,13 @@
+import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
+import { logger } from '@goldsmith/observability';
+
+@Catch()
+export class GlobalExceptionFilter implements ExceptionFilter {
+  catch(exception: unknown, host: ArgumentsHost): void {
+    const res = host.switchToHttp().getResponse();
+    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
+    const code = exception instanceof Error ? exception.message : 'internal_error';
+    logger.error({ err: exception, status }, 'request failed');
+    res.status(status).json({ error: { code, status } });
+  }
+}
diff --git a/apps/api/src/health.controller.ts b/apps/api/src/health.controller.ts
new file mode 100644
index 0000000..9f3040b
--- /dev/null
+++ b/apps/api/src/health.controller.ts
@@ -0,0 +1,14 @@
+import { Controller, Get, SetMetadata } from '@nestjs/common';
+
+export const SKIP_TENANT = 'skip-tenant';
+// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
+export const SkipTenant = () => SetMetadata(SKIP_TENANT, true);
+
+@Controller()
+export class HealthController {
+  @Get('/healthz')
+  @SkipTenant()
+  health(): { status: 'ok' } {
+    return { status: 'ok' };
+  }
+}
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
new file mode 100644
index 0000000..0c62838
--- /dev/null
+++ b/apps/api/src/main.ts
@@ -0,0 +1,18 @@
+import 'reflect-metadata';
+import { NestFactory } from '@nestjs/core';
+import { initSentry, initOtel, logger } from '@goldsmith/observability';
+import { AppModule } from './app.module';
+
+async function bootstrap(): Promise<void> {
+  initSentry();
+  initOtel('goldsmith-api');
+  const app = await NestFactory.create(AppModule, { logger: false });
+  const port = Number(process.env['PORT'] ?? '3000');
+  await app.listen(port, '0.0.0.0');
+  logger.info({ port }, 'api listening');
+}
+
+bootstrap().catch((err) => {
+  logger.error({ err }, 'bootstrap failed');
+  process.exit(1);
+});
diff --git a/apps/api/src/tenant-resolver.ts b/apps/api/src/tenant-resolver.ts
new file mode 100644
index 0000000..3e835ac
--- /dev/null
+++ b/apps/api/src/tenant-resolver.ts
@@ -0,0 +1,14 @@
+import { Injectable } from '@nestjs/common';
+import type { TenantResolver, RequestLike } from '@goldsmith/tenant-context';
+
+@Injectable()
+export class HttpTenantResolver implements TenantResolver {
+  // eslint-disable-next-line @typescript-eslint/no-unused-vars
+  async fromHost(_host: string): Promise<string | undefined> { return undefined; }
+  fromHeader(req: RequestLike): string | undefined {
+    const h = req.headers['x-tenant-id'];
+    return typeof h === 'string' ? h : undefined;
+  }
+  // eslint-disable-next-line @typescript-eslint/no-unused-vars
+  fromJwt(_req: RequestLike): string | undefined { return undefined; }
+}
diff --git a/apps/api/test/health.e2e.test.ts b/apps/api/test/health.e2e.test.ts
new file mode 100644
index 0000000..59bd129
--- /dev/null
+++ b/apps/api/test/health.e2e.test.ts
@@ -0,0 +1,28 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { Test } from '@nestjs/testing';
+import type { INestApplication } from '@nestjs/common';
+import request from 'supertest';
+import { AppModule } from '../src/app.module';
+
+let app: INestApplication;
+
+beforeAll(async () => {
+  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
+  app = module.createNestApplication();
+  await app.init();
+});
+
+afterAll(async () => { await app?.close(); });
+
+describe('GET /healthz', () => {
+  it('returns 200 OK without requiring tenant ctx', async () => {
+    const res = await request(app.getHttpServer()).get('/healthz');
+    expect(res.status).toBe(200);
+    expect(res.body).toEqual({ status: 'ok' });
+  });
+
+  it('tenant-scoped endpoint returns 401 without ctx', async () => {
+    const res = await request(app.getHttpServer()).get('/demo/ping');
+    expect([401, 404]).toContain(res.status);
+  });
+});
diff --git a/apps/api/tsconfig.build.json b/apps/api/tsconfig.build.json
new file mode 100644
index 0000000..5a015d5
--- /dev/null
+++ b/apps/api/tsconfig.build.json
@@ -0,0 +1 @@
+{ "extends": "./tsconfig.json", "exclude": ["**/*.test.ts", "**/*.e2e.test.ts", "test/**/*"] }
diff --git a/apps/api/tsconfig.json b/apps/api/tsconfig.json
new file mode 100644
index 0000000..456b3b2
--- /dev/null
+++ b/apps/api/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": { "experimentalDecorators": true, "emitDecoratorMetadata": true, "exactOptionalPropertyTypes": false, "outDir": "./dist" },
+  "include": ["src/**/*", "test/**/*"]
+}
diff --git a/docs/db-workflow.md b/docs/db-workflow.md
new file mode 100644
index 0000000..30f280f
--- /dev/null
+++ b/docs/db-workflow.md
@@ -0,0 +1,31 @@
+# DB Workflow (E2-S1)
+
+## Roles
+- `app_user` — NOSUPERUSER NOBYPASSRLS; DML on tenant tables via `withTenantTx`. Used by `apps/api` + (future) BullMQ workers.
+- `migrator` — NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault (Infrastructure Story), scoped to GitHub OIDC role.
+- `platform_admin` — owns SECURITY DEFINER cross-tenant reads; used from admin console (Story 1.5+).
+
+## DDL vs DML flow
+DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`. DML happens through `withTenantTx(pool, fn)` (never direct `pool.query`) under `app_user`. `app_user` cannot run DDL; `migrator` cannot run DML on tenant tables.
+
+## Adding a new table
+1. Add a file under `packages/db/src/schema/` using `tenantScopedTable` or `platformGlobalTable`.
+2. Run `pnpm -F @goldsmith/db run db:assert-marked` — passes if marker used.
+3. Run `pnpm -F @goldsmith/db exec tsx src/codegen/generate-rls.ts` — emits RLS SQL.
+4. Create a new migration `NNNN_<name>.sql` (next number) with table DDL + the emitted RLS block.
+5. Add a `GRANT ... ON <new_table> TO app_user` in the same migration.
+6. Add a harness fixture entry in `packages/testing/tenant-isolation/fixtures/*` so the 3-tenant test exercises the new table.
+
+## Post-migrate data migrations
+Backfills/transforms run as a per-tenant job using `app_user` + `withTenantTx`. MVP: run via a `tsx` script iterating tenants. Post-MVP (when BullMQ is added): use BullMQ worker pattern. Do NOT put backfills in `.sql` files.
+
+## Running locally
+```bash
+docker compose -f infra/docker-compose.dev.yml up -d postgres
+pnpm install
+pnpm db:reset
+pnpm test
+pnpm test:tenant-isolation
+```
+
+Redis + LocalStack containers are defined in docker-compose.dev.yml but deferred per ADR-0015 — start them only when needed.
diff --git a/docs/runbook.md b/docs/runbook.md
index bdbe991..5d8c43f 100644
--- a/docs/runbook.md
+++ b/docs/runbook.md
@@ -1,14 +1,17 @@
 ---
 title: Goldsmith — Operations Runbook
-status: v1 — Sprint-1 gate draft
+status: v1.1 — E2-S1 update
 author: Alokt (Principal Architect) · facilitated via Claude
-date: 2026-04-17
+date: 2026-04-18
 reviewCadence: Before every release; quarterly in steady state
 supersedes: none
 companionDocs:
   - docs/threat-model.md (STRIDE — mitigations S1-M* referenced here)
   - _bmad-output/planning-artifacts/architecture.md (12 ADRs, 14 bounded contexts)
   - _bmad-output/planning-artifacts/adr/0011-compliance-package-hard-block-gateway.md
+mvpScope: >
+  ADR-0015 (startup-lean): LocalKMS only — no Azure Key Vault, no Redis, no
+  cloud KMS until Infrastructure Story lands. Scripts reflect this scope.
 ---
 
 # Goldsmith — Operations Runbook
@@ -365,7 +368,11 @@ Each vendor has a runbook entry. The pattern: **detect → reduce blast → comm
   --bis-license HAL/XX/1234
 
 # 2. Run tenant provisioning job (creates RLS policies, seeds category tree, creates admin user)
-./scripts/tenant-provision.sh anchor-ayodhya-01
+#    MVP note: uses LocalKMS placeholder KEK (ADR-0015); Azure Key Vault KEK lands in Infrastructure Story.
+./scripts/tenant-provision.sh \
+  --tenant anchor-ayodhya-01 \
+  --slug anchor-ayodhya-01 \
+  --display "Aanchal Jewellers"
 
 # 3. Create initial admin user (shop owner)
 ./scripts/user-create.sh \
@@ -375,7 +382,7 @@ Each vendor has a runbook entry. The pattern: **detect → reduce blast → comm
   --role shop_admin
 
 # 4. Verify tenant isolation — run smoke test against new tenant
-npm run test:tenant-isolation -- --tenant anchor-ayodhya-01
+pnpm test:tenant-isolation
 ```
 
 ### 7.3 Post-onboarding checklist
diff --git a/docs/superpowers/plans/2026-04-18-E2-S1-tenant-rls-scaffolding.md b/docs/superpowers/plans/2026-04-18-E2-S1-tenant-rls-scaffolding.md
index 978f3a7..36e1850 100644
--- a/docs/superpowers/plans/2026-04-18-E2-S1-tenant-rls-scaffolding.md
+++ b/docs/superpowers/plans/2026-04-18-E2-S1-tenant-rls-scaffolding.md
@@ -2,11 +2,13 @@
 
 > **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
 
-**Goal:** Ship the multi-tenant platform substrate (RLS + ALS + CI + Terraform + isolation harness) on which every later feature story stands, making zero cross-tenant data leakage structurally impossible.
+> **🔄 2026-04-18 SCOPE CORRECTION (ADR-0015):** Tasks 4-6 (AWS Terraform infrastructure) are **REMOVED from E2-S1 scope**. Infrastructure provisioning is deferred to a new "Infrastructure Story" landed after anchor SOW is signed, at which point we will use Azure + Firebase (not AWS) and `azd` (Azure Developer CLI). Task 23 (`packages/crypto-envelope`) swaps `@aws-sdk/client-kms` → `@azure/keyvault-keys` + `@azure/identity`. Task 28 scripts use `az` CLI. Task 29 CI drops the `terraform-validate` gate. All **cloud-neutral** tasks (1-3, 7-27 minus noted swaps, plus 30) stay as-written. The total E2-S1 task count drops from 30 to 27. See ADR-0015 for rationale.
+
+**Goal:** Ship the multi-tenant platform substrate (RLS + ALS + CI + isolation harness) on which every later feature story stands, making zero cross-tenant data leakage structurally impossible. (Cloud infrastructure is NOT part of this story per ADR-0015.)
 
 **Architecture:** Four-layer defense-in-depth (compile-time via Semgrep+ESLint; runtime via NestJS interceptor + AsyncLocalStorage; DB-session via `SET LOCAL` inside `withTenantTx`; DB-storage via PostgreSQL RLS with poison-default fallback). Drizzle marker functions (`tenantScopedTable` / `platformGlobalTable`) drive code-generated RLS policies, and a 3-tenant behavioral harness runs on every CI merge.
 
-**Tech Stack:** pnpm workspace + Turborepo, NestJS 10, Drizzle ORM, PostgreSQL 15 (via Testcontainers in tests, RDS in prod), Redis (ioredis), BullMQ, Pino, Sentry, OpenTelemetry, Vitest, Testcontainers, Semgrep, ESLint, Terraform (AWS ap-south-1), GitHub Actions + Codex CLI.
+**Tech Stack:** pnpm workspace + Turborepo, NestJS 10, Drizzle ORM, PostgreSQL 15 (via Testcontainers for tests; Azure Postgres Flexible Server when deployed — deferred), Pino, Sentry, OpenTelemetry, Vitest, Testcontainers, Semgrep, ESLint, GitHub Actions + Codex CLI. Redis + BullMQ deferred to post-MVP per startup-economics principle.
 
 **Plan references:**
 - Design spec: `docs/superpowers/specs/2026-04-18-E2-S1-tenant-rls-scaffolding-design.md`
@@ -30,7 +32,7 @@
 10. **BullMQ ctx serialization:** Job payload is `{ meta: { tenantId: string }; data: T }`. `TenantQueue.add(ctx, data)` auto-extracts; `BaseProcessor` re-validates + re-hydrates + wraps in `runWith`.
 11. **Harness fixtures:** 3 tenants A/B/C, each with 1 `shops` row + 2 `shop_users` + 5 `audit_events`. Registry at `packages/testing/tenant-isolation/fixtures/registry.ts`; later stories append without editing the harness.
 
-**CI discipline:** Terraform work in E2-S1 is `validate` + `plan` only. No `apply` to any AWS environment in this story — apply gate opens in Story 1.1 once auth + monitoring are in place.
+**CI discipline:** No cloud infrastructure in this story per ADR-0015. CI runs typecheck + lint + unit + integration + tenant-isolation + semgrep + codex-review + build. The `terraform-validate` job in Task 29 is removed from the ship.yml pipeline for this story; it returns in the Infrastructure Story.
 
 **Commit cadence:** Every task ends with a commit. After each commit, rerun `pnpm typecheck` + `pnpm lint` at repo root before moving on.
 
@@ -41,29 +43,19 @@
 ## File structure overview
 
 ```
-.github/workflows/ship.yml              # 10-gate CI pipeline
+.github/workflows/ship.yml              # CI pipeline (no terraform-validate in E2-S1)
 infra/
-  docker-compose.dev.yml                # postgres 15 + redis + localstack
-  terraform/
-    backend.tf                          # S3 + DynamoDB lock
-    providers.tf                        # AWS ap-south-1 lock
-    modules/
-      network/                          # VPC + subnets + NAT
-      database/                         # RDS Postgres 15
-      cache/                            # ElastiCache Redis
-      secrets/                          # Secrets Manager + KMS
-      ci-roles/                         # GH Actions OIDC role
-    envs/dev/                           # dev stack
+  docker-compose.dev.yml                # postgres 15 + (deferred Redis/localstack)
+  # terraform/ — DEFERRED to Infrastructure Story (post-SOW), Azure + azd
 ops/
   semgrep/
     require-tenant-transaction.yaml
     no-tenant-id-from-request-input.yaml
     als-boundary-preserved.yaml
-    no-raw-ioredis-import.yaml
-    no-raw-bullmq-import.yaml
-    no-raw-kms-import.yaml
+    no-raw-ioredis-import.yaml          # kept; ioredis ships in Task 20 when Redis is added
+    no-raw-bullmq-import.yaml           # kept; BullMQ ships in Task 21
+    no-raw-keyvault-import.yaml         # replaces no-raw-kms-import (Azure SDK naming)
     no-pii-in-logs.yaml
-    terraform-no-public-s3.yaml
   eslint-rules/
     no-raw-shop-id-param/
       index.js
@@ -333,6 +325,7 @@ Create `package.json`:
     "@typescript-eslint/eslint-plugin": "^7.0.0",
     "@typescript-eslint/parser": "^7.0.0",
     "eslint": "^8.57.0",
+    "eslint-import-resolver-typescript": "^3.6.1",
     "eslint-plugin-import": "^2.29.1",
     "prettier": "^3.2.5",
     "tsx": "^4.7.0",
@@ -365,7 +358,7 @@ Create `turbo.json`:
     "typecheck":            { "dependsOn": ["^typecheck"], "outputs": [] },
     "lint":                 { "outputs": [] },
     "test":                 { "dependsOn": ["^build"], "outputs": [] },
-    "test:unit":            { "dependsOn": ["^build"], "outputs": [] },
+    "test:unit":            { "dependsOn": [], "outputs": [] },
     "test:integration":     { "dependsOn": ["^build"], "outputs": [] },
     "test:tenant-isolation": { "dependsOn": ["^build"], "outputs": [] },
     "build":                { "dependsOn": ["^build"], "outputs": ["dist/**"] }
@@ -389,8 +382,8 @@ Create `tsconfig.base.json`:
 {
   "compilerOptions": {
     "target": "ES2022",
-    "module": "NodeNext",
-    "moduleResolution": "NodeNext",
+    "module": "CommonJS",
+    "moduleResolution": "Node",
     "lib": ["ES2022"],
     "strict": true,
     "noImplicitAny": true,
@@ -444,9 +437,9 @@ module.exports = {
     'goldsmith/no-raw-shop-id-param': 'error',
     'no-restricted-imports': ['error', {
       patterns: [
-        { group: ['ioredis'], message: 'Import ioredis only from packages/cache.' },
-        { group: ['bullmq'], message: 'Import bullmq only from packages/queue.' },
-        { group: ['@aws-sdk/client-kms'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
+        { group: ['ioredis', 'ioredis/*'], message: 'Import ioredis only from packages/cache.' },
+        { group: ['bullmq', 'bullmq/*'], message: 'Import bullmq only from packages/queue.' },
+        { group: ['@aws-sdk/client-kms', '@aws-sdk/client-kms/*'], message: 'Import @aws-sdk/client-kms only from packages/crypto-envelope.' },
       ],
     }],
   },
@@ -621,6 +614,51 @@ describe('redactPii', () => {
   it('leaves non-PII keys alone', () => {
     expect(redactPii({ shopId: 'abc', total: 123 })).toEqual({ shopId: 'abc', total: 123 });
   });
+
+  it('redacts display_name (shop_users column)', () => {
+    expect(redactPii({ display_name: 'Rajesh Ji' })).toEqual({
+      display_name: '[REDACTED:display_name]',
+    });
+  });
+
+  it('redacts PII inside arrays of objects', () => {
+    expect(redactPii([{ phone: '+91a' }, { email: 'b@x' }])).toEqual([
+      { phone: '[REDACTED:phone]' },
+      { email: '[REDACTED:email]' },
+    ]);
+  });
+
+  it('preserves Error instances (stack + message intact)', () => {
+    const err = new Error('db connection refused');
+    const out = redactPii({ err });
+    expect(out.err).toBe(err); // same reference — Error passes through
+    expect((out.err as Error).message).toBe('db connection refused');
+  });
+
+  it('preserves Date instances (timestamp intact)', () => {
+    const ts = new Date('2026-04-18T00:00:00Z');
+    const out = redactPii({ ts });
+    expect(out.ts).toBe(ts);
+  });
+
+  it('preserves Buffer instances (byte content intact)', () => {
+    const buf = Buffer.from('hello', 'utf8');
+    const out = redactPii({ buf });
+    expect(out.buf).toBe(buf);
+    expect((out.buf as Buffer).toString('utf8')).toBe('hello');
+  });
+
+  it('handles circular references without stack overflow', () => {
+    const a: Record<string, unknown> = { phone: '+91' };
+    a.self = a;
+    const out = redactPii(a) as Record<string, unknown>;
+    expect(out.phone).toBe('[REDACTED:phone]');
+    expect(out.self).toBe('[Circular]');
+  });
+
+  it('redacts null value under PII key (key-based, not value-based)', () => {
+    expect(redactPii({ phone: null })).toEqual({ phone: '[REDACTED:phone]' });
+  });
 });
 ```
 
@@ -639,24 +677,33 @@ Create `packages/observability/src/pii-redactor.ts`:
 ```ts
 const PII_KEYS = new Set([
   'phone', 'pan', 'email', 'aadhaar', 'dob',
-  'address', 'name', 'customerName', 'ownerName',
+  'address', 'customerName', 'ownerName', 'display_name',
   'gstin', 'bankAccount', 'ifsc', 'otp',
 ]);
 
-export function redactPii<T>(input: T): T {
+function isPlainObject(v: unknown): v is Record<string, unknown> {
+  if (v === null || typeof v !== 'object') return false;
+  const proto = Object.getPrototypeOf(v) as unknown;
+  return proto === Object.prototype || proto === null;
+}
+
+export function redactPii<T>(input: T, seen: WeakSet<object> = new WeakSet()): T {
   if (input === null || input === undefined) return input;
-  if (Array.isArray(input)) return input.map((item) => redactPii(item)) as unknown as T;
-  if (typeof input === 'object') {
+  if (Array.isArray(input)) {
+    if (seen.has(input)) return '[Circular]' as unknown as T;
+    seen.add(input);
+    return input.map((item) => redactPii(item, seen)) as unknown as T;
+  }
+  if (isPlainObject(input)) {
+    if (seen.has(input)) return '[Circular]' as unknown as T;
+    seen.add(input);
     const out: Record<string, unknown> = {};
-    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
-      if (PII_KEYS.has(k)) {
-        out[k] = `[REDACTED:${k}]`;
-      } else {
-        out[k] = redactPii(v);
-      }
+    for (const [k, v] of Object.entries(input)) {
+      out[k] = PII_KEYS.has(k) ? `[REDACTED:${k}]` : redactPii(v, seen);
     }
     return out as unknown as T;
   }
+  // Error, Date, Buffer, class instances, Map, Set, Symbol — preserve as-is.
   return input;
 }
 ```
@@ -687,14 +734,37 @@ Create `packages/observability/src/sentry.ts`:
 import * as Sentry from '@sentry/node';
 import { redactPii } from './pii-redactor';
 
+let _initialized = false;
+
 export function initSentry(): void {
-  const dsn = process.env.SENTRY_DSN;
+  if (_initialized) return;
+  const dsn = process.env['SENTRY_DSN'];
   if (!dsn) return;
+  _initialized = true;
   Sentry.init({
     dsn,
-    environment: process.env.NODE_ENV ?? 'development',
-    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
-    beforeSend: (event) => ({ ...event, extra: redactPii(event.extra ?? {}) }),
+    environment: process.env['NODE_ENV'] ?? 'development',
+    tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
+    beforeSend: (event) => {
+      if (event.request?.data && typeof event.request.data === 'object') {
+        event.request.data = redactPii(event.request.data);
+      }
+      if (event.request?.headers) {
+        const { authorization: _a, cookie: _c, 'x-tenant-id': _t, ...safeHeaders } =
+          event.request.headers as Record<string, string>;
+        event.request.headers = safeHeaders;
+      }
+      if (event.user) {
+        event.user = event.user.id ? { id: event.user.id } : {};
+      }
+      if (event.breadcrumbs) {
+        event.breadcrumbs = (event.breadcrumbs as Sentry.Breadcrumb[]).map((b) => {
+          if (!b.data) return b;
+          return { ...b, data: redactPii(b.data) as { [key: string]: unknown } };
+        });
+      }
+      return { ...event, extra: redactPii(event.extra ?? {}) };
+    },
   });
 }
 ```
@@ -705,17 +775,22 @@ Create `packages/observability/src/otel.ts`:
 import { NodeSDK } from '@opentelemetry/sdk-node';
 import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
 
+let _sdk: NodeSDK | undefined;
+
 export function initOtel(serviceName: string): NodeSDK | undefined {
-  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return undefined;
-  const sdk = new NodeSDK({
+  if (_sdk) return _sdk;
+  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) return undefined;
+  _sdk = new NodeSDK({
     serviceName,
     instrumentations: [getNodeAutoInstrumentations()],
   });
-  sdk.start();
-  return sdk;
+  _sdk.start();
+  return _sdk;
 }
 ```
 
+> **Note:** SIGTERM shutdown hook deferred to Story 1.1 when `main.ts` lands.
+
 Create `packages/observability/src/index.ts`:
 
 ```ts
@@ -743,9 +818,10 @@ rules:
     languages: [typescript, javascript]
     severity: ERROR
     message: |
-      PII field names must not be logged. Use `logger.info({ ... })` where values pass through the
-      PII redactor, or explicitly wrap with `redactPii(value)`. Do NOT inline PII-named keys into
-      console.log or templated strings.
+      PII field names must not be logged via console.*. Use the logger from
+      @goldsmith/observability (which runs the PII redactor) or explicitly wrap with
+      redactPii(value). Keys covered: phone, pan, email, aadhaar, dob, address, otp,
+      customerName, ownerName, display_name, gstin, bankAccount, ifsc.
     patterns:
       - pattern-either:
           - pattern: console.log($...ARGS)
@@ -754,7 +830,7 @@ rules:
       - metavariable-pattern:
           metavariable: $...ARGS
           patterns:
-            - pattern-regex: "(phone|pan|email|aadhaar|otp|customerName|gstin)"
+            - pattern-regex: "\\b(phone|pan|email|aadhaar|dob|address|otp|customerName|ownerName|display_name|gstin|bankAccount|ifsc)\\b"
 ```
 
 - [ ] **Step 7: Commit**
@@ -766,492 +842,25 @@ git commit -m "feat(observability): pino+sentry+otel with PII redactor (S1-M8)"
 
 ---
 
-## Task 4: Terraform backend + network module
-
-**Files:**
-- Create: `infra/terraform/backend.tf`, `providers.tf`, `versions.tf`
-- Create: `infra/terraform/modules/network/{main,variables,outputs}.tf`
-- Create: `infra/docker-compose.dev.yml`
-
-- [ ] **Step 1: Backend + providers**
-
-Create `infra/terraform/versions.tf`:
-
-```hcl
-terraform {
-  required_version = ">= 1.7.0"
-  required_providers {
-    aws = { source = "hashicorp/aws", version = "~> 5.40" }
-  }
-}
-```
-
-Create `infra/terraform/backend.tf`:
-
-```hcl
-terraform {
-  backend "s3" {
-    bucket         = "goldsmith-tfstate-ap-south-1"
-    key            = "envs/dev/terraform.tfstate"
-    region         = "ap-south-1"
-    dynamodb_table = "goldsmith-tfstate-lock"
-    encrypt        = true
-  }
-}
-```
-
-Create `infra/terraform/providers.tf`:
-
-```hcl
-provider "aws" {
-  region = "ap-south-1"
-  allowed_account_ids = var.allowed_account_ids
-  default_tags {
-    tags = {
-      Project          = "goldsmith"
-      ManagedBy        = "terraform"
-      DataResidency    = "ap-south-1"
-    }
-  }
-}
-
-variable "allowed_account_ids" {
-  type        = list(string)
-  description = "AWS account IDs allowed to run this config. Enforces residency at the provider level."
-}
-```
-
-- [ ] **Step 2: Network module**
-
-Create `infra/terraform/modules/network/variables.tf`:
-
-```hcl
-variable "env"        { type = string }
-variable "cidr_block" { type = string, default = "10.10.0.0/16" }
-variable "base_tags"  { type = map(string), default = {} }
-```
-
-Create `infra/terraform/modules/network/main.tf`:
-
-```hcl
-locals {
-  azs = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
-  tags = merge(var.base_tags, {
-    Module        = "network"
-    DataResidency = "ap-south-1"
-  })
-}
-
-resource "aws_vpc" "main" {
-  cidr_block           = var.cidr_block
-  enable_dns_support   = true
-  enable_dns_hostnames = true
-  tags                 = merge(local.tags, { Name = "${var.env}-goldsmith-vpc" })
-}
-
-resource "aws_subnet" "public" {
-  count                   = 3
-  vpc_id                  = aws_vpc.main.id
-  cidr_block              = cidrsubnet(var.cidr_block, 4, count.index)
-  availability_zone       = local.azs[count.index]
-  map_public_ip_on_launch = false
-  tags = merge(local.tags, {
-    Name = "${var.env}-goldsmith-public-${local.azs[count.index]}"
-    Tier = "public"
-  })
-}
-
-resource "aws_subnet" "private" {
-  count             = 3
-  vpc_id            = aws_vpc.main.id
-  cidr_block        = cidrsubnet(var.cidr_block, 4, count.index + 3)
-  availability_zone = local.azs[count.index]
-  tags = merge(local.tags, {
-    Name = "${var.env}-goldsmith-private-${local.azs[count.index]}"
-    Tier = "private"
-  })
-}
-
-resource "aws_internet_gateway" "main" {
-  vpc_id = aws_vpc.main.id
-  tags   = merge(local.tags, { Name = "${var.env}-goldsmith-igw" })
-}
-
-resource "aws_eip" "nat" {
-  count  = 3
-  domain = "vpc"
-  tags   = merge(local.tags, { Name = "${var.env}-goldsmith-natgw-eip-${count.index}" })
-}
-
-resource "aws_nat_gateway" "main" {
-  count         = 3
-  subnet_id     = aws_subnet.public[count.index].id
-  allocation_id = aws_eip.nat[count.index].id
-  tags          = merge(local.tags, { Name = "${var.env}-goldsmith-natgw-${count.index}" })
-}
-```
-
-Create `infra/terraform/modules/network/outputs.tf`:
-
-```hcl
-output "vpc_id"             { value = aws_vpc.main.id }
-output "public_subnet_ids"  { value = aws_subnet.public[*].id }
-output "private_subnet_ids" { value = aws_subnet.private[*].id }
-```
-
-- [ ] **Step 3: Local dev stack (docker-compose)**
-
-Create `infra/docker-compose.dev.yml`:
-
-```yaml
-services:
-  postgres:
-    image: postgres:15.6
-    environment:
-      POSTGRES_USER: postgres
-      POSTGRES_PASSWORD: postgres
-      POSTGRES_DB: goldsmith_dev
-    ports: ["5432:5432"]
-    volumes: [goldsmith_pg:/var/lib/postgresql/data]
-  redis:
-    image: redis:7.2-alpine
-    ports: ["6379:6379"]
-  localstack:
-    image: localstack/localstack-pro:3.4
-    ports: ["4566:4566"]
-    environment:
-      SERVICES: kms,secretsmanager,s3
-      LOCALSTACK_AUTH_TOKEN: ${LOCALSTACK_AUTH_TOKEN:-}
-volumes:
-  goldsmith_pg:
-```
-
-- [ ] **Step 4: Validate Terraform**
-
-```bash
-cd infra/terraform && terraform init -backend=false && terraform validate
-```
-
-Expected: `Success! The configuration is valid.`
-
-- [ ] **Step 5: Commit**
-
-```bash
-git add infra/
-git commit -m "feat(infra): terraform backend + network module + docker-compose dev stack"
-```
-
----
-
-## Task 5: Terraform database + cache + secrets/KMS modules
-
-**Files:**
-- Create: `infra/terraform/modules/database/{main,variables,outputs}.tf`
-- Create: `infra/terraform/modules/cache/{main,variables,outputs}.tf`
-- Create: `infra/terraform/modules/secrets/{main,variables,outputs}.tf`
-
-- [ ] **Step 1: Database module (RDS Postgres 15 Multi-AZ)**
-
-Create `infra/terraform/modules/database/variables.tf`:
-
-```hcl
-variable "env"                { type = string }
-variable "vpc_id"             { type = string }
-variable "private_subnet_ids" { type = list(string) }
-variable "instance_class"     { type = string, default = "db.t4g.medium" }
-variable "allocated_storage"  { type = number, default = 50 }
-variable "base_tags"          { type = map(string), default = {} }
-```
-
-Create `infra/terraform/modules/database/main.tf`:
-
-```hcl
-resource "aws_db_subnet_group" "main" {
-  name       = "${var.env}-goldsmith-postgres"
-  subnet_ids = var.private_subnet_ids
-  tags       = merge(var.base_tags, { Name = "${var.env}-goldsmith-postgres" })
-}
-
-resource "aws_security_group" "rds" {
-  name        = "${var.env}-goldsmith-rds"
-  description = "Postgres access from VPC only"
-  vpc_id      = var.vpc_id
-  ingress {
-    from_port   = 5432
-    to_port     = 5432
-    protocol    = "tcp"
-    cidr_blocks = ["10.10.0.0/16"]
-  }
-  tags = var.base_tags
-}
-
-resource "aws_kms_key" "rds" {
-  description             = "KMS for ${var.env} Goldsmith RDS at-rest encryption"
-  deletion_window_in_days = 30
-  enable_key_rotation     = true
-  tags                    = var.base_tags
-}
-
-resource "aws_db_parameter_group" "main" {
-  name   = "${var.env}-goldsmith-postgres-15"
-  family = "postgres15"
-  parameter { name = "log_min_duration_statement", value = "500" }
-  parameter { name = "shared_preload_libraries",    value = "pg_stat_statements", apply_method = "pending-reboot" }
-}
-
-resource "aws_db_instance" "main" {
-  identifier                 = "${var.env}-goldsmith-postgres"
-  engine                     = "postgres"
-  engine_version             = "15.6"
-  instance_class             = var.instance_class
-  allocated_storage          = var.allocated_storage
-  max_allocated_storage      = var.allocated_storage * 4
-  multi_az                   = var.env == "prod"
-  storage_encrypted          = true
-  kms_key_id                 = aws_kms_key.rds.arn
-  backup_retention_period    = 7
-  deletion_protection        = var.env == "prod"
-  db_subnet_group_name       = aws_db_subnet_group.main.name
-  vpc_security_group_ids     = [aws_security_group.rds.id]
-  parameter_group_name       = aws_db_parameter_group.main.name
-  performance_insights_enabled = true
-  enabled_cloudwatch_logs_exports = ["postgresql"]
-  tags = merge(var.base_tags, {
-    Name                = "${var.env}-goldsmith-postgres"
-    DataClassification  = "tenant-pii"
-    DataResidency       = "ap-south-1"
-  })
-}
-```
-
-Create `infra/terraform/modules/database/outputs.tf`:
-
-```hcl
-output "endpoint"       { value = aws_db_instance.main.endpoint }
-output "kms_key_arn"    { value = aws_kms_key.rds.arn }
-output "security_group" { value = aws_security_group.rds.id }
-```
-
-- [ ] **Step 2: Cache module (ElastiCache Redis)**
-
-Create `infra/terraform/modules/cache/variables.tf`:
-
-```hcl
-variable "env"                { type = string }
-variable "vpc_id"             { type = string }
-variable "private_subnet_ids" { type = list(string) }
-variable "node_type"          { type = string, default = "cache.t4g.small" }
-variable "base_tags"          { type = map(string), default = {} }
-```
-
-Create `infra/terraform/modules/cache/main.tf`:
-
-```hcl
-resource "aws_elasticache_subnet_group" "main" {
-  name       = "${var.env}-goldsmith-redis"
-  subnet_ids = var.private_subnet_ids
-}
-
-resource "aws_security_group" "redis" {
-  name   = "${var.env}-goldsmith-redis"
-  vpc_id = var.vpc_id
-  ingress {
-    from_port   = 6379
-    to_port     = 6379
-    protocol    = "tcp"
-    cidr_blocks = ["10.10.0.0/16"]
-  }
-  tags = var.base_tags
-}
-
-resource "aws_elasticache_replication_group" "main" {
-  replication_group_id       = "${var.env}-goldsmith-redis"
-  description                = "Goldsmith cache + BullMQ backing"
-  node_type                  = var.node_type
-  num_cache_clusters         = var.env == "prod" ? 2 : 1
-  automatic_failover_enabled = var.env == "prod"
-  engine_version             = "7.1"
-  port                       = 6379
-  parameter_group_name       = "default.redis7"
-  subnet_group_name          = aws_elasticache_subnet_group.main.name
-  security_group_ids         = [aws_security_group.redis.id]
-  at_rest_encryption_enabled = true
-  transit_encryption_enabled = true
-  tags = merge(var.base_tags, { DataResidency = "ap-south-1" })
-}
-```
-
-Create `infra/terraform/modules/cache/outputs.tf`:
-
-```hcl
-output "endpoint" { value = aws_elasticache_replication_group.main.primary_endpoint_address }
-```
-
-- [ ] **Step 3: Secrets/KMS module**
-
-Create `infra/terraform/modules/secrets/variables.tf`:
-
-```hcl
-variable "env"       { type = string }
-variable "base_tags" { type = map(string), default = {} }
-```
-
-Create `infra/terraform/modules/secrets/main.tf`:
-
-```hcl
-resource "aws_kms_key" "platform" {
-  description             = "Platform-level KMS for ${var.env} app secrets"
-  deletion_window_in_days = 30
-  enable_key_rotation     = true
-  tags                    = merge(var.base_tags, { Purpose = "platform-secrets" })
-}
-
-resource "aws_secretsmanager_secret" "db_app_user" {
-  name       = "${var.env}/goldsmith/db/app_user"
-  kms_key_id = aws_kms_key.platform.id
-  tags       = var.base_tags
-}
-
-resource "aws_secretsmanager_secret" "db_migrator" {
-  name       = "${var.env}/goldsmith/db/migrator"
-  kms_key_id = aws_kms_key.platform.id
-  tags       = var.base_tags
-}
-
-resource "aws_secretsmanager_secret" "db_platform_admin" {
-  name       = "${var.env}/goldsmith/db/platform_admin"
-  kms_key_id = aws_kms_key.platform.id
-  tags       = var.base_tags
-}
-```
-
-Create `infra/terraform/modules/secrets/outputs.tf`:
-
-```hcl
-output "platform_kms_key_arn" { value = aws_kms_key.platform.arn }
-output "db_app_user_secret"   { value = aws_secretsmanager_secret.db_app_user.arn }
-output "db_migrator_secret"   { value = aws_secretsmanager_secret.db_migrator.arn }
-```
-
-- [ ] **Step 4: Validate**
-
-```bash
-cd infra/terraform && terraform validate
-```
-
-Expected: `Success! The configuration is valid.`
-
-- [ ] **Step 5: Commit**
-
-```bash
-git add infra/terraform/modules/
-git commit -m "feat(infra): terraform modules database + cache + secrets/KMS"
-```
-
----
-
-## Task 6: Terraform envs/dev + data-residency Semgrep rule
-
-**Files:**
-- Create: `infra/terraform/envs/dev/{main,variables,outputs}.tf`
-- Create: `infra/terraform/envs/dev/terraform.tfvars.example`
-- Create: `ops/semgrep/terraform-no-public-s3.yaml`
-
-- [ ] **Step 1: Dev environment stack**
-
-Create `infra/terraform/envs/dev/main.tf`:
-
-```hcl
-locals {
-  env       = "dev"
-  base_tags = { Environment = local.env }
-}
-
-module "network" {
-  source    = "../../modules/network"
-  env       = local.env
-  base_tags = local.base_tags
-}
-
-module "database" {
-  source             = "../../modules/database"
-  env                = local.env
-  vpc_id             = module.network.vpc_id
-  private_subnet_ids = module.network.private_subnet_ids
-  base_tags          = local.base_tags
-}
+## Tasks 4-6: REMOVED from E2-S1 scope per ADR-0015
 
-module "cache" {
-  source             = "../../modules/cache"
-  env                = local.env
-  vpc_id             = module.network.vpc_id
-  private_subnet_ids = module.network.private_subnet_ids
-  base_tags          = local.base_tags
-}
+The original Tasks 4 (Terraform backend + network module), 5 (database + cache + secrets/KMS modules), and 6 (envs/dev + terraform-no-public-s3 semgrep rule) targeted AWS ap-south-1.
 
-module "secrets" {
-  source    = "../../modules/secrets"
-  env       = local.env
-  base_tags = local.base_tags
-}
-```
+Per ADR-0015 (2026-04-18 stack correction), infrastructure provisioning is:
 
-Create `infra/terraform/envs/dev/variables.tf`:
+1. **Not in E2-S1 scope** — no `terraform apply`, no AWS resources, no Azure resources created during this story.
+2. **Re-platformed to Azure + Firebase** when it does land — see ADR-0015 for the full target stack (Azure Container Apps + Postgres Flexible Server + Key Vault + Blob Storage + Entra ID; Firebase Auth + FCM).
+3. **Scheduled for a new "Infrastructure Story"** that runs after anchor SOW is signed. That story will use `azd` (Azure Developer CLI) as the primary front-end, Terraform `azurerm` provider only for custom topologies.
 
-```hcl
-variable "allowed_account_ids" { type = list(string) }
-```
+**Startup-economics floor** (from ADR-0015 + `memory/feedback_startup_economics_first.md`): MVP target infra cost is ≤ $20/month. Nothing is spun up until revenue is contracted.
 
-Create `infra/terraform/envs/dev/terraform.tfvars.example`:
+**What E2-S1 still ships** (cloud-neutral):
+- The full tenant-RLS substrate (Tasks 1-3, 7-27, 30).
+- `withTenantTx`, ALS tenant-context, NestJS interceptor, 3-tenant behavioral harness.
+- All enforcement rails (Semgrep + ESLint) for multi-tenant safety.
+- Postgres runs locally via Testcontainers during tests, Docker Compose for dev — both $0.
 
-```hcl
-allowed_account_ids = ["111111111111"]
-```
-
-- [ ] **Step 2: Semgrep rule — no public S3**
-
-Create `ops/semgrep/terraform-no-public-s3.yaml`:
-
-```yaml
-rules:
-  - id: goldsmith.terraform-no-public-s3
-    languages: [hcl]
-    severity: ERROR
-    message: |
-      S3 buckets must not be public. No `acl = "public-read"`, no `acl = "public-read-write"`,
-      and no bucket-policy principal "*" without strict conditions. Use CloudFront OAC instead.
-    patterns:
-      - pattern-either:
-          - pattern: |
-              resource "aws_s3_bucket" $NAME { ... acl = "public-read" ... }
-          - pattern: |
-              resource "aws_s3_bucket" $NAME { ... acl = "public-read-write" ... }
-          - pattern: |
-              resource "aws_s3_bucket_acl" $NAME { ... acl = "public-read" ... }
-```
-
-- [ ] **Step 3: Validate dev env**
-
-```bash
-cd infra/terraform/envs/dev && terraform init -backend=false && terraform validate
-```
-
-Expected: `Success! The configuration is valid.`
-
-- [ ] **Step 4: Run Semgrep**
-
-```bash
-semgrep --config ops/semgrep/terraform-no-public-s3.yaml infra/
-```
-
-Expected: 0 findings.
-
-- [ ] **Step 5: Commit**
-
-```bash
-git add infra/terraform/envs ops/semgrep/terraform-no-public-s3.yaml
-git commit -m "feat(infra): dev env stack + semgrep terraform-no-public-s3 (S1-M11)"
-```
+Proceed directly to Task 7.
 
 ---
 
@@ -3345,11 +2954,21 @@ git commit -m "feat(audit): auditLog() as sole path into audit_events"
 
 ## Task 23: `packages/crypto-envelope` — LocalKMS + envelope hooks + semgrep
 
+> **🔄 ADR-0015 adaptation (at execution time):**
+> - Rename `src/aws-kms.ts` → `src/azure-keyvault.ts`. Class `AwsKms` → `AzureKeyVault`.
+> - package.json dep: `@aws-sdk/client-kms` → `@azure/keyvault-keys ^4.8.0` + `@azure/identity ^4.0.0`.
+> - `ops/semgrep/no-raw-kms-import.yaml` → `ops/semgrep/no-raw-keyvault-import.yaml` with pattern `import $...X from '@azure/keyvault-keys'` and `import $...X from '@azure/keyvault-secrets'`.
+> - `LocalKMS` adapter stays identical (cloud-neutral in-memory implementation for tests).
+> - `KmsAdapter` interface stays identical (`createKeyForTenant`, `generateDataKey`, `decryptDataKey`, `scheduleKeyDeletion`).
+> - `scheduleKeyDeletion` in AzureKeyVault uses `beginDeleteKey` + Key Vault soft-delete + purge protection (default 90-day retention in Azure vs 30-day AWS grace).
+> - For MVP (startup-lean), a single platform Key Vault with ONE KEK is acceptable (per ADR-0015). Per-tenant keys land when compliance audit demands.
+> - Code blocks below show the AWS version — swap the names + SDK at implementation time.
+
 **Files:**
 - Create: `packages/crypto-envelope/{package.json,tsconfig.json}`
-- Create: `packages/crypto-envelope/src/{kms-adapter,local-kms,aws-kms,envelope,index}.ts`
+- Create: `packages/crypto-envelope/src/{kms-adapter,local-kms,azure-keyvault,envelope,index}.ts` (renamed from aws-kms)
 - Create: `packages/crypto-envelope/test/envelope.test.ts`
-- Create: `ops/semgrep/no-raw-kms-import.yaml`
+- Create: `ops/semgrep/no-raw-keyvault-import.yaml` (renamed from no-raw-kms-import)
 
 - [ ] **Step 1: Package + failing test**
 
@@ -4350,6 +3969,12 @@ git commit -m "feat(testing): endpoint-walker scaffold exercising /healthz (LIT-
 
 ## Task 28: Scripts — db-reset + tenant-provision + tenant-delete
 
+> **🔄 ADR-0015 adaptation (at execution time):**
+> - MVP scope (no cloud yet): scripts operate against local Docker Postgres + the `LocalKMS` in-memory adapter. No `aws` or `az` CLI calls.
+> - `tenant-provision.sh` inserts `shops` row + calls a Node helper that uses `LocalKMS.createKeyForTenant`. Result: a fake ARN string stored in `shops.kek_key_arn`. Real Azure Key Vault integration lands in the Infrastructure Story.
+> - `tenant-delete.sh` deletes rows + marks the LocalKMS key deleted. No real KMS API calls.
+> - When Infrastructure Story lands: helper is swapped from LocalKMS → AzureKeyVault, CLI gate becomes `az account show && az keyvault key create/delete ...`. Script shape stays the same.
+
 **Files:**
 - Create: `scripts/db-reset.sh`
 - Create: `scripts/tenant-provision.sh`
@@ -4496,6 +4121,12 @@ git commit -m "feat(scripts): db-reset + tenant-provision + tenant-delete (runbo
 
 ## Task 29: CI `ship.yml` with 10 gated jobs + Codex
 
+> **🔄 ADR-0015 adaptation (at execution time):**
+> - **Drop the `terraform-validate` job** — no cloud IaC in this story. That leaves 9 gates: install, typecheck, lint, unit, integration, tenant-isolation, semgrep, codex-review, build.
+> - The Semgrep rule file name changes: `no-raw-kms-import.yaml` → `no-raw-keyvault-import.yaml`.
+> - Node version pin stays 20.11.0. pnpm 9.12.0 via corepack.
+> - Infrastructure Story will add `azd-validate` or equivalent when it lands.
+
 **Files:**
 - Create: `.github/workflows/ship.yml`
 - Create: `docs/db-workflow.md`
diff --git a/ops/eslint-rules/goldsmith/index.js b/ops/eslint-rules/goldsmith/index.js
new file mode 100644
index 0000000..3b7c981
--- /dev/null
+++ b/ops/eslint-rules/goldsmith/index.js
@@ -0,0 +1,6 @@
+'use strict';
+module.exports = {
+  rules: {
+    'no-raw-shop-id-param': require('./rules/no-raw-shop-id-param'),
+  },
+};
diff --git a/ops/eslint-rules/goldsmith/package.json b/ops/eslint-rules/goldsmith/package.json
new file mode 100644
index 0000000..1d74e11
--- /dev/null
+++ b/ops/eslint-rules/goldsmith/package.json
@@ -0,0 +1,9 @@
+{
+  "name": "eslint-plugin-goldsmith",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./index.js",
+  "scripts": { "test": "node --test tests/*.test.js" },
+  "peerDependencies": { "eslint": "^8.57.0" },
+  "devDependencies": { "@typescript-eslint/parser": "^7.0.0" }
+}
diff --git a/ops/eslint-rules/goldsmith/rules/no-raw-shop-id-param.js b/ops/eslint-rules/goldsmith/rules/no-raw-shop-id-param.js
new file mode 100644
index 0000000..c7677b1
--- /dev/null
+++ b/ops/eslint-rules/goldsmith/rules/no-raw-shop-id-param.js
@@ -0,0 +1,61 @@
+'use strict';
+
+const ALLOWED_PATH_FRAGMENTS = [
+  '/packages/db/',
+  'packages/db/',
+  '/packages/tenant-context/',
+  'packages/tenant-context/',
+  '/packages/testing/',
+  'packages/testing/',
+  '/packages/crypto-envelope/',
+  'packages/crypto-envelope/',
+  '/packages/cache/',
+  'packages/cache/',
+  '/scripts/',
+  'scripts/',
+  '/migrations/',
+  'migrations/',
+];
+
+module.exports = {
+  meta: {
+    type: 'problem',
+    docs: {
+      description:
+        'Service/repo methods must take `ctx: TenantContext` instead of a raw `shopId: string` param.',
+    },
+    messages: {
+      noRawShopIdParam:
+        'Forbidden: parameter `{{name}}: string` named `shopId`/`shop_id`/`tenantId`. Use `ctx: TenantContext` (ADR-0005).',
+    },
+    schema: [],
+  },
+  create(context) {
+    const filename = (context.filename || context.getFilename() || '').replace(/\\/g, '/');
+    if (ALLOWED_PATH_FRAGMENTS.some((frag) => filename.includes(frag.replace(/\\/g, '/')))) {
+      return {};
+    }
+    const check = (node) => {
+      for (const p of node.params) {
+        const id = p.type === 'Identifier' ? p : p.type === 'AssignmentPattern' ? p.left : null;
+        if (!id || id.type !== 'Identifier') continue;
+        const name = id.name;
+        if (!/^(shopId|shop_id|tenantId)$/.test(name)) continue;
+        const ann = id.typeAnnotation && id.typeAnnotation.typeAnnotation;
+        const isString = ann && ann.type === 'TSStringKeyword';
+        if (isString) context.report({ node: id, messageId: 'noRawShopIdParam', data: { name } });
+      }
+    };
+    return {
+      FunctionDeclaration: check,
+      FunctionExpression(node) {
+        // Skip: will be handled by MethodDefinition to avoid double-reporting
+        if (node.parent && node.parent.type === 'MethodDefinition') return;
+        check(node);
+      },
+      ArrowFunctionExpression: check,
+      MethodDefinition(node) { check(node.value); },
+      TSDeclareMethod(node) { check(node.value || node); },
+    };
+  },
+};
diff --git a/ops/eslint-rules/goldsmith/tests/no-raw-shop-id-param.test.js b/ops/eslint-rules/goldsmith/tests/no-raw-shop-id-param.test.js
new file mode 100644
index 0000000..51e781e
--- /dev/null
+++ b/ops/eslint-rules/goldsmith/tests/no-raw-shop-id-param.test.js
@@ -0,0 +1,28 @@
+const { RuleTester } = require('eslint');
+const rule = require('../rules/no-raw-shop-id-param');
+
+const tester = new RuleTester({
+  parser: require.resolve('@typescript-eslint/parser'),
+});
+
+tester.run('no-raw-shop-id-param', rule, {
+  valid: [
+    { code: 'async function create(ctx: TenantContext, input: Dto) {}' },
+    { code: 'class X { async do(ctx: TenantContext, arg: number) {} }' },
+    { code: 'function migrateShop(shopId: string) {}', filename: 'packages/db/src/migrate.ts' },
+  ],
+  invalid: [
+    {
+      code: 'class X { async create(shopId: string, input: Dto) {} }',
+      filename: 'apps/api/src/modules/demo/demo.service.ts',
+      errors: [{ messageId: 'noRawShopIdParam' }],
+    },
+    {
+      code: 'async function doThing(shopId: string) {}',
+      filename: 'apps/api/src/modules/demo/demo.service.ts',
+      errors: [{ messageId: 'noRawShopIdParam' }],
+    },
+  ],
+});
+
+console.log('no-raw-shop-id-param rule tests passed');
diff --git a/ops/semgrep/als-boundary-preserved.yaml b/ops/semgrep/als-boundary-preserved.yaml
new file mode 100644
index 0000000..3f7acd3
--- /dev/null
+++ b/ops/semgrep/als-boundary-preserved.yaml
@@ -0,0 +1,23 @@
+rules:
+  - id: goldsmith.als-boundary-preserved
+    languages: [typescript]
+    severity: WARNING
+    message: |
+      Detaching from the current microtask (setImmediate/process.nextTick/setTimeout) or spawning
+      workers inside service code can drop the AsyncLocalStorage tenant context. If this is
+      intentional, add `// als-ok: <reason>` on the prior line (reviewer sign-off required per
+      ADR-0005 amendment).
+    patterns:
+      - pattern-either:
+          - pattern: setImmediate($...X)
+          - pattern: process.nextTick($...X)
+          - pattern: setTimeout($...X)
+          - pattern: new Worker($...X)
+      - pattern-not-regex: 'als-ok:'
+    paths:
+      include: ["apps/api/**", "packages/**"]
+      exclude:
+        - "packages/tenant-context/**"
+        - "packages/queue/**"
+        - "packages/testing/**"
+        - "**/*.test.ts"
diff --git a/ops/semgrep/no-pii-in-logs.yaml b/ops/semgrep/no-pii-in-logs.yaml
new file mode 100644
index 0000000..fb5ef8b
--- /dev/null
+++ b/ops/semgrep/no-pii-in-logs.yaml
@@ -0,0 +1,18 @@
+rules:
+  - id: goldsmith.no-pii-in-logs
+    languages: [typescript, javascript]
+    severity: ERROR
+    message: |
+      PII field names must not be logged via console.*. Use the logger from
+      @goldsmith/observability (which runs the PII redactor) or explicitly wrap with
+      redactPii(value). Keys covered: phone, pan, email, aadhaar, dob, address, otp,
+      customerName, ownerName, display_name, gstin, bankAccount, ifsc.
+    patterns:
+      - pattern-either:
+          - pattern: console.log($...ARGS)
+          - pattern: console.warn($...ARGS)
+          - pattern: console.error($...ARGS)
+      - metavariable-pattern:
+          metavariable: $...ARGS
+          patterns:
+            - pattern-regex: "\\b(phone|pan|email|aadhaar|dob|address|otp|customerName|ownerName|display_name|gstin|bankAccount|ifsc)\\b"
diff --git a/ops/semgrep/no-raw-bullmq-import.yaml b/ops/semgrep/no-raw-bullmq-import.yaml
new file mode 100644
index 0000000..0014ae0
--- /dev/null
+++ b/ops/semgrep/no-raw-bullmq-import.yaml
@@ -0,0 +1,16 @@
+rules:
+  - id: goldsmith.no-raw-bullmq-import
+    languages: [typescript]
+    severity: ERROR
+    message: |
+      Direct import of bullmq is forbidden outside packages/queue. Use TenantQueue +
+      createTenantWorker so tenant metadata is always present (threat-model S1-M7).
+    patterns:
+      - pattern-either:
+          - pattern: import { Queue } from 'bullmq'
+          - pattern: import { Worker } from 'bullmq'
+          - pattern: import { QueueEvents } from 'bullmq'
+          - pattern: require('bullmq')
+    paths:
+      exclude:
+        - "packages/queue/**"
diff --git a/ops/semgrep/no-raw-ioredis-import.yaml b/ops/semgrep/no-raw-ioredis-import.yaml
new file mode 100644
index 0000000..ef96b92
--- /dev/null
+++ b/ops/semgrep/no-raw-ioredis-import.yaml
@@ -0,0 +1,17 @@
+rules:
+  - id: goldsmith.no-raw-ioredis-import
+    languages: [typescript]
+    severity: ERROR
+    message: |
+      Direct import of `ioredis` is forbidden outside packages/cache. Use TenantScopedCache so
+      every key is tenant-prefixed (threat-model S1-M10).
+    patterns:
+      - pattern-either:
+          - pattern: import $...X from 'ioredis'
+          - pattern: import { $...X } from 'ioredis'
+          - pattern: require('ioredis')
+    paths:
+      exclude:
+        - "packages/cache/**"
+        - "packages/tenant-context/**"
+        - "packages/queue/**"
diff --git a/ops/semgrep/no-raw-keyvault-import.yaml b/ops/semgrep/no-raw-keyvault-import.yaml
new file mode 100644
index 0000000..358da1e
--- /dev/null
+++ b/ops/semgrep/no-raw-keyvault-import.yaml
@@ -0,0 +1,16 @@
+rules:
+  - id: goldsmith.no-raw-keyvault-import
+    languages: [typescript]
+    severity: ERROR
+    message: |
+      Direct import of @azure/keyvault-keys or @azure/keyvault-secrets is forbidden outside
+      packages/crypto-envelope. Use the envelope helpers so column-level encryption consistently
+      uses per-tenant KEKs (ADR-0013, ADR-0015).
+    patterns:
+      - pattern-either:
+          - pattern: import $...X from '@azure/keyvault-keys'
+          - pattern: import { $...X } from '@azure/keyvault-keys'
+          - pattern: import $...X from '@azure/keyvault-secrets'
+          - pattern: import { $...X } from '@azure/keyvault-secrets'
+    paths:
+      exclude: ["packages/crypto-envelope/**"]
diff --git a/ops/semgrep/no-tenant-id-from-request-input.yaml b/ops/semgrep/no-tenant-id-from-request-input.yaml
new file mode 100644
index 0000000..72bebec
--- /dev/null
+++ b/ops/semgrep/no-tenant-id-from-request-input.yaml
@@ -0,0 +1,25 @@
+rules:
+  - id: goldsmith.no-tenant-id-from-request-input
+    languages: [typescript]
+    severity: ERROR
+    message: |
+      Tenant ID must never be taken from request input. Use JWT claim (via TenantInterceptor) or
+      host CNAME. Violates threat-model S1-M2.
+    patterns:
+      - pattern-either:
+          - pattern: |
+              $X.query.shopId
+          - pattern: |
+              $X.body.shopId
+          - pattern: |
+              $X.params.shopId
+          - pattern: |
+              $X.query.shop_id
+          - pattern: |
+              $X.body.tenant_id
+          - pattern: |
+              $X.params.tenant_id
+    paths:
+      exclude:
+        - "packages/tenant-context/**"
+        - "**/*.test.ts"
diff --git a/ops/semgrep/require-tenant-transaction.yaml b/ops/semgrep/require-tenant-transaction.yaml
new file mode 100644
index 0000000..2460c8d
--- /dev/null
+++ b/ops/semgrep/require-tenant-transaction.yaml
@@ -0,0 +1,23 @@
+rules:
+  - id: goldsmith.require-tenant-transaction
+    languages: [typescript]
+    severity: ERROR
+    message: |
+      Raw DB execution is forbidden. Wrap queries in `withTenantTx` (packages/db) so the
+      tenant SET LOCAL is always applied. If this call is intentionally platform-global, use the
+      `platformGlobalExecute()` helper + reviewer sign-off.
+    paths:
+      exclude:
+        - "packages/db/**"
+        - "packages/testing/**"
+        - "**/*.test.ts"
+        - "**/*.integration.test.ts"
+    patterns:
+      - pattern-either:
+          - pattern: $DB.execute($...X)
+          - pattern: $DB.query($...X)
+          - pattern: $POOL.connect()
+      - pattern-not-inside: |
+          withTenantTx(...) { ... }
+      - pattern-not-inside: |
+          withTenantTx($POOL, async ($TX) => { ... })
diff --git a/ops/semgrep/tests/no-tenant-id-from-request-input/bad.ts b/ops/semgrep/tests/no-tenant-id-from-request-input/bad.ts
new file mode 100644
index 0000000..a5f3da0
--- /dev/null
+++ b/ops/semgrep/tests/no-tenant-id-from-request-input/bad.ts
@@ -0,0 +1,3 @@
+export function bad(req: { body: { shopId?: string } }) {
+  return req.body.shopId;
+}
diff --git a/ops/semgrep/tests/no-tenant-id-from-request-input/ok.ts b/ops/semgrep/tests/no-tenant-id-from-request-input/ok.ts
new file mode 100644
index 0000000..1737017
--- /dev/null
+++ b/ops/semgrep/tests/no-tenant-id-from-request-input/ok.ts
@@ -0,0 +1,2 @@
+import { tenantContext } from '@goldsmith/tenant-context';
+export function ok() { return tenantContext.requireCurrent().shopId; }
diff --git a/ops/semgrep/tests/require-tenant-transaction/bad.ts b/ops/semgrep/tests/require-tenant-transaction/bad.ts
new file mode 100644
index 0000000..59e09b8
--- /dev/null
+++ b/ops/semgrep/tests/require-tenant-transaction/bad.ts
@@ -0,0 +1,4 @@
+import { pool } from '@goldsmith/db';
+export async function bad() {
+  return pool.query('SELECT * FROM shop_users');
+}
diff --git a/ops/semgrep/tests/require-tenant-transaction/ok.ts b/ops/semgrep/tests/require-tenant-transaction/ok.ts
new file mode 100644
index 0000000..6de5174
--- /dev/null
+++ b/ops/semgrep/tests/require-tenant-transaction/ok.ts
@@ -0,0 +1,4 @@
+import { pool, withTenantTx } from '@goldsmith/db';
+export async function ok() {
+  return withTenantTx(pool, async (tx) => (await tx.query('SELECT * FROM shop_users')).rows);
+}
diff --git a/package.json b/package.json
new file mode 100644
index 0000000..4a38137
--- /dev/null
+++ b/package.json
@@ -0,0 +1,34 @@
+{
+  "name": "goldsmith",
+  "version": "0.0.0",
+  "private": true,
+  "packageManager": "pnpm@9.12.0",
+  "engines": { "node": ">=20.11.0 <21" },
+  "scripts": {
+    "typecheck": "turbo run typecheck",
+    "lint": "turbo run lint",
+    "test": "turbo run test",
+    "test:unit": "turbo run test:unit",
+    "test:integration": "turbo run test:integration",
+    "test:tenant-isolation": "turbo run test:tenant-isolation",
+    "build": "turbo run build",
+    "db:reset": "bash scripts/db-reset.sh",
+    "db:generate-rls": "tsx packages/db/src/codegen/generate-rls.ts",
+    "db:assert-marked": "tsx packages/db/src/codegen/assert-all-tables-marked.ts",
+    "semgrep": "semgrep --config ops/semgrep/ --error"
+  },
+  "devDependencies": {
+    "@types/node": "^20.11.0",
+    "@typescript-eslint/eslint-plugin": "^7.0.0",
+    "@typescript-eslint/parser": "^7.0.0",
+    "eslint": "^8.57.0",
+    "eslint-import-resolver-typescript": "^3.6.1",
+    "eslint-plugin-import": "^2.29.1",
+    "prettier": "^3.2.5",
+    "tsx": "^4.7.0",
+    "turbo": "^2.0.0",
+    "typescript": "^5.4.0",
+    "vitest": "^1.4.0",
+    "@vitest/coverage-v8": "^1.4.0"
+  }
+}
diff --git a/packages/audit/package.json b/packages/audit/package.json
new file mode 100644
index 0000000..d516a5d
--- /dev/null
+++ b/packages/audit/package.json
@@ -0,0 +1,24 @@
+{
+  "name": "@goldsmith/audit",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run",
+    "test:integration": "vitest run --dir test"
+  },
+  "dependencies": {
+    "@goldsmith/db": "workspace:*",
+    "@goldsmith/tenant-context": "workspace:*",
+    "pg": "^8.11.0"
+  },
+  "devDependencies": {
+    "vitest": "^1.4.0",
+    "testcontainers": "^10.8.0",
+    "@testcontainers/postgresql": "^10.8.0",
+    "@types/pg": "^8.11.0",
+    "typescript": "^5.4.0"
+  }
+}
diff --git a/packages/audit/src/audit-log.ts b/packages/audit/src/audit-log.ts
new file mode 100644
index 0000000..676188b
--- /dev/null
+++ b/packages/audit/src/audit-log.ts
@@ -0,0 +1,35 @@
+import type { Pool } from 'pg';
+import { withTenantTx } from '@goldsmith/db';
+
+export interface AuditEntry {
+  action: string;
+  subjectType: string;
+  subjectId?: string;
+  before?: unknown;
+  after?: unknown;
+  metadata?: Record<string, unknown>;
+  actorUserId?: string;
+  ip?: string;
+  userAgent?: string;
+}
+
+export async function auditLog(pool: Pool, entry: AuditEntry): Promise<void> {
+  await withTenantTx(pool, async (tx) => {
+    await tx.query(
+      `INSERT INTO audit_events
+       (shop_id, actor_user_id, action, subject_type, subject_id, before, after, metadata, ip, user_agent)
+       VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
+      [
+        entry.actorUserId ?? null,
+        entry.action,
+        entry.subjectType,
+        entry.subjectId ?? null,
+        entry.before ? JSON.stringify(entry.before) : null,
+        entry.after ? JSON.stringify(entry.after) : null,
+        entry.metadata ? JSON.stringify(entry.metadata) : null,
+        entry.ip ?? null,
+        entry.userAgent ?? null,
+      ],
+    );
+  });
+}
diff --git a/packages/audit/src/index.ts b/packages/audit/src/index.ts
new file mode 100644
index 0000000..d6edf12
--- /dev/null
+++ b/packages/audit/src/index.ts
@@ -0,0 +1 @@
+export { auditLog, type AuditEntry } from './audit-log';
diff --git a/packages/audit/test/audit-log.integration.test.ts b/packages/audit/test/audit-log.integration.test.ts
new file mode 100644
index 0000000..79675de
--- /dev/null
+++ b/packages/audit/test/audit-log.integration.test.ts
@@ -0,0 +1,42 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { resolve } from 'node:path';
+import { Pool } from 'pg';
+import { createPool, runMigrations } from '@goldsmith/db';
+import { tenantContext } from '@goldsmith/tenant-context';
+import { auditLog } from '../src/audit-log';
+
+const A = '11111111-1111-1111-1111-111111111111';
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  // Resolve from this file's location up two levels to monorepo root, then into packages/db
+  const migrationsDir = resolve(__dirname, '../../db/src/migrations');
+  await runMigrations(pool, migrationsDir);
+  const c = await pool.connect();
+  await c.query(`INSERT INTO shops (id, slug, display_name, status) VALUES ('${A}', 'a', 'A', 'ACTIVE');`);
+  c.release();
+}, 60_000);
+
+afterAll(async () => { await pool?.end(); await container?.stop(); });
+
+describe('auditLog', () => {
+  it('inserts a row under the current tenant', async () => {
+    await tenantContext.runWith({ shopId: A } as never, () =>
+      auditLog(pool, { action: 'test.happened', subjectType: 'demo', subjectId: 'x', before: null, after: { ok: true } }),
+    );
+    const c = await pool.connect();
+    await c.query(`SET ROLE app_user; SET app.current_shop_id='${A}';`);
+    const { rows } = await c.query('SELECT action FROM audit_events');
+    expect(rows.some((r: { action: string }) => r.action === 'test.happened')).toBe(true);
+    await c.query('RESET ROLE');
+    c.release();
+  });
+
+  it('throws outside a tenant context', async () => {
+    await expect(auditLog(pool, { action: 'x', subjectType: 'y' })).rejects.toThrow(/tenant\.context_not_set/);
+  });
+});
diff --git a/packages/audit/tsconfig.json b/packages/audit/tsconfig.json
new file mode 100644
index 0000000..feacc57
--- /dev/null
+++ b/packages/audit/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
diff --git a/packages/cache/package.json b/packages/cache/package.json
new file mode 100644
index 0000000..a45ac4b
--- /dev/null
+++ b/packages/cache/package.json
@@ -0,0 +1,16 @@
+{
+  "name": "@goldsmith/cache",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run"
+  },
+  "dependencies": {
+    "ioredis": "^5.3.0",
+    "@goldsmith/tenant-context": "workspace:*"
+  },
+  "devDependencies": { "vitest": "^1.4.0", "ioredis-mock": "^8.9.0", "@types/ioredis-mock": "^8.2.7", "typescript": "^5.4.0" }
+}
diff --git a/packages/cache/src/index.ts b/packages/cache/src/index.ts
new file mode 100644
index 0000000..10d8fdf
--- /dev/null
+++ b/packages/cache/src/index.ts
@@ -0,0 +1 @@
+export { TenantScopedCache } from './tenant-scoped-cache';
diff --git a/packages/cache/src/tenant-scoped-cache.ts b/packages/cache/src/tenant-scoped-cache.ts
new file mode 100644
index 0000000..6e99648
--- /dev/null
+++ b/packages/cache/src/tenant-scoped-cache.ts
@@ -0,0 +1,29 @@
+import type Redis from 'ioredis';
+import { tenantContext } from '@goldsmith/tenant-context';
+
+export class TenantScopedCache {
+  constructor(private readonly redis: Redis) {}
+
+  private key(k: string): string {
+    return `t:${tenantContext.requireCurrent().shopId}:${k}`;
+  }
+
+  async get(k: string): Promise<string | null> { return this.redis.get(this.key(k)); }
+
+  async set(k: string, v: string, ttlSec?: number): Promise<void> {
+    if (ttlSec) await this.redis.set(this.key(k), v, 'EX', ttlSec);
+    else await this.redis.set(this.key(k), v);
+  }
+
+  async del(k: string): Promise<void> { await this.redis.del(this.key(k)); }
+
+  async flushTenant(shopId: string): Promise<void> {
+    const prefix = `t:${shopId}:`;
+    let cursor = '0';
+    do {
+      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
+      if (keys.length > 0) await this.redis.del(...keys);
+      cursor = next;
+    } while (cursor !== '0');
+  }
+}
diff --git a/packages/cache/test/tenant-scoped-cache.test.ts b/packages/cache/test/tenant-scoped-cache.test.ts
new file mode 100644
index 0000000..e6351e1
--- /dev/null
+++ b/packages/cache/test/tenant-scoped-cache.test.ts
@@ -0,0 +1,34 @@
+import { describe, it, expect } from 'vitest';
+import RedisMock from 'ioredis-mock';
+import { tenantContext } from '@goldsmith/tenant-context';
+import { TenantScopedCache } from '../src/tenant-scoped-cache';
+
+const A = { shopId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
+const B = { shopId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' };
+
+describe('TenantScopedCache', () => {
+  it('key-prefixes with shopId from ALS', async () => {
+    const redis = new RedisMock();
+    const cache = new TenantScopedCache(redis as never);
+    await tenantContext.runWith(A as never, () => cache.set('k', 'vA'));
+    await tenantContext.runWith(B as never, () => cache.set('k', 'vB'));
+    expect(await tenantContext.runWith(A as never, () => cache.get('k'))).toBe('vA');
+    expect(await tenantContext.runWith(B as never, () => cache.get('k'))).toBe('vB');
+  });
+
+  it('throws if no tenant ctx', async () => {
+    const redis = new RedisMock();
+    const cache = new TenantScopedCache(redis as never);
+    await expect(cache.get('k')).rejects.toThrow(/tenant\.context_not_set/);
+  });
+
+  it('flushTenant removes only that tenant keys', async () => {
+    const redis = new RedisMock();
+    const cache = new TenantScopedCache(redis as never);
+    await tenantContext.runWith(A as never, async () => { await cache.set('a1', '1'); await cache.set('a2', '2'); });
+    await tenantContext.runWith(B as never, () => cache.set('b1', '1'));
+    await cache.flushTenant(A.shopId);
+    expect(await tenantContext.runWith(A as never, () => cache.get('a1'))).toBeNull();
+    expect(await tenantContext.runWith(B as never, () => cache.get('b1'))).toBe('1');
+  });
+});
diff --git a/packages/cache/tsconfig.json b/packages/cache/tsconfig.json
new file mode 100644
index 0000000..feacc57
--- /dev/null
+++ b/packages/cache/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
diff --git a/packages/crypto-envelope/package.json b/packages/crypto-envelope/package.json
new file mode 100644
index 0000000..4b95efd
--- /dev/null
+++ b/packages/crypto-envelope/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "@goldsmith/crypto-envelope",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run"
+  },
+  "dependencies": {},
+  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" }
+}
diff --git a/packages/crypto-envelope/src/envelope.ts b/packages/crypto-envelope/src/envelope.ts
new file mode 100644
index 0000000..bd6be94
--- /dev/null
+++ b/packages/crypto-envelope/src/envelope.ts
@@ -0,0 +1,33 @@
+import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
+import type { KmsAdapter } from './kms-adapter';
+
+export interface EnvelopeCiphertext {
+  ciphertext: Buffer;
+  encryptedDek: Buffer;
+  iv: Buffer;
+  tag: Buffer;
+  keyArn: string;
+}
+
+export async function encryptColumn(
+  kms: KmsAdapter,
+  keyArn: string,
+  plaintext: string,
+): Promise<EnvelopeCiphertext> {
+  const { plaintext: dek, encryptedDek } = await kms.generateDataKey(keyArn);
+  const iv = randomBytes(12);
+  const cipher = createCipheriv('aes-256-gcm', dek, iv);
+  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
+  const tag = cipher.getAuthTag();
+  dek.fill(0);
+  return { ciphertext: ct, encryptedDek, iv, tag, keyArn };
+}
+
+export async function decryptColumn(kms: KmsAdapter, payload: EnvelopeCiphertext): Promise<string> {
+  const dek = await kms.decryptDataKey(payload.encryptedDek, payload.keyArn);
+  const decipher = createDecipheriv('aes-256-gcm', dek, payload.iv);
+  decipher.setAuthTag(payload.tag);
+  const plain = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
+  dek.fill(0);
+  return plain.toString('utf8');
+}
diff --git a/packages/crypto-envelope/src/index.ts b/packages/crypto-envelope/src/index.ts
new file mode 100644
index 0000000..d93d5da
--- /dev/null
+++ b/packages/crypto-envelope/src/index.ts
@@ -0,0 +1,3 @@
+export type { KmsAdapter } from './kms-adapter';
+export { LocalKMS } from './local-kms';
+export { encryptColumn, decryptColumn, type EnvelopeCiphertext } from './envelope';
diff --git a/packages/crypto-envelope/src/kms-adapter.ts b/packages/crypto-envelope/src/kms-adapter.ts
new file mode 100644
index 0000000..d4007bd
--- /dev/null
+++ b/packages/crypto-envelope/src/kms-adapter.ts
@@ -0,0 +1,11 @@
+export interface EncryptedDek {
+  encryptedDek: Buffer;
+  keyArn: string;
+}
+
+export interface KmsAdapter {
+  createKeyForTenant(tenantId: string): Promise<string>;
+  generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }>;
+  decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer>;
+  scheduleKeyDeletion(keyArn: string, pendingDays?: number): Promise<void>;
+}
diff --git a/packages/crypto-envelope/src/local-kms.ts b/packages/crypto-envelope/src/local-kms.ts
new file mode 100644
index 0000000..de90cb2
--- /dev/null
+++ b/packages/crypto-envelope/src/local-kms.ts
@@ -0,0 +1,41 @@
+import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
+import type { KmsAdapter } from './kms-adapter';
+
+interface StoredKey { keyMaterial: Buffer; deleted: boolean; }
+
+export class LocalKMS implements KmsAdapter {
+  private keys = new Map<string, StoredKey>();
+
+  async createKeyForTenant(tenantId: string): Promise<string> {
+    const arn = `local:kms:${tenantId}:${randomBytes(8).toString('hex')}`;
+    this.keys.set(arn, { keyMaterial: randomBytes(32), deleted: false });
+    return arn;
+  }
+
+  async generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }> {
+    const kek = this.keys.get(keyArn);
+    if (!kek || kek.deleted) throw new Error('key.unavailable');
+    const plaintext = randomBytes(32);
+    const iv = randomBytes(12);
+    const cipher = createCipheriv('aes-256-gcm', kek.keyMaterial, iv);
+    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
+    const tag = cipher.getAuthTag();
+    return { plaintext, encryptedDek: Buffer.concat([iv, tag, ct]) };
+  }
+
+  async decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer> {
+    const kek = this.keys.get(keyArn);
+    if (!kek || kek.deleted) throw new Error('key.unavailable');
+    const iv = encryptedDek.subarray(0, 12);
+    const tag = encryptedDek.subarray(12, 28);
+    const ct = encryptedDek.subarray(28);
+    const decipher = createDecipheriv('aes-256-gcm', kek.keyMaterial, iv);
+    decipher.setAuthTag(tag);
+    return Buffer.concat([decipher.update(ct), decipher.final()]);
+  }
+
+  async scheduleKeyDeletion(keyArn: string): Promise<void> {
+    const k = this.keys.get(keyArn);
+    if (k) k.deleted = true;
+  }
+}
diff --git a/packages/crypto-envelope/test/envelope.test.ts b/packages/crypto-envelope/test/envelope.test.ts
new file mode 100644
index 0000000..02f34be
--- /dev/null
+++ b/packages/crypto-envelope/test/envelope.test.ts
@@ -0,0 +1,29 @@
+import { describe, it, expect } from 'vitest';
+import { LocalKMS } from '../src/local-kms';
+import { encryptColumn, decryptColumn } from '../src/envelope';
+
+describe('envelope encryption (LocalKMS)', () => {
+  it('round-trips plaintext through encrypt + decrypt', async () => {
+    const kms = new LocalKMS();
+    const arn = await kms.createKeyForTenant('tenant-a');
+    const enc = await encryptColumn(kms, arn, 'hello');
+    expect(enc.ciphertext).not.toEqual(Buffer.from('hello', 'utf8'));
+    expect(await decryptColumn(kms, enc)).toBe('hello');
+  });
+
+  it('ciphertext for same plaintext differs (IV randomness)', async () => {
+    const kms = new LocalKMS();
+    const arn = await kms.createKeyForTenant('tenant-a');
+    const a = await encryptColumn(kms, arn, 'x');
+    const b = await encryptColumn(kms, arn, 'x');
+    expect(a.ciphertext).not.toEqual(b.ciphertext);
+  });
+
+  it('KEK deletion prevents decryption', async () => {
+    const kms = new LocalKMS();
+    const arn = await kms.createKeyForTenant('tenant-b');
+    const enc = await encryptColumn(kms, arn, 'secret');
+    await kms.scheduleKeyDeletion(arn);
+    await expect(decryptColumn(kms, enc)).rejects.toThrow(/key\.unavailable/);
+  });
+});
diff --git a/packages/crypto-envelope/tsconfig.json b/packages/crypto-envelope/tsconfig.json
new file mode 100644
index 0000000..feacc57
--- /dev/null
+++ b/packages/crypto-envelope/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
diff --git a/packages/db/package.json b/packages/db/package.json
new file mode 100644
index 0000000..0b1a20f
--- /dev/null
+++ b/packages/db/package.json
@@ -0,0 +1,30 @@
+{
+  "name": "@goldsmith/db",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run",
+    "test:unit": "vitest run --dir src",
+    "test:integration": "vitest run --dir test",
+    "build": "pnpm db:assert-marked && tsc --noEmit",
+    "db:assert-marked": "tsx src/codegen/assert-all-tables-marked.ts"
+  },
+  "dependencies": {
+    "@goldsmith/observability": "workspace:*",
+    "@goldsmith/tenant-context": "workspace:*",
+    "drizzle-orm": "^0.30.0",
+    "pg": "^8.11.0"
+  },
+  "devDependencies": {
+    "@types/pg": "^8.11.0",
+    "@testcontainers/postgresql": "^10.8.0",
+    "testcontainers": "^10.8.0",
+    "drizzle-kit": "^0.21.0",
+    "vitest": "^1.4.0",
+    "typescript": "^5.4.0",
+    "tsx": "^4.7.0"
+  }
+}
diff --git a/packages/db/src/codegen/assert-all-tables-marked.test.ts b/packages/db/src/codegen/assert-all-tables-marked.test.ts
new file mode 100644
index 0000000..e833884
--- /dev/null
+++ b/packages/db/src/codegen/assert-all-tables-marked.test.ts
@@ -0,0 +1,26 @@
+import { describe, it, expect } from 'vitest';
+import { findRawPgTableUsages } from './assert-all-tables-marked';
+
+describe('findRawPgTableUsages', () => {
+  it('flags pgTable call that is not inside the helpers directory', () => {
+    const source = `
+      import { pgTable, text } from 'drizzle-orm/pg-core';
+      export const widgets = pgTable('widgets', { name: text('name') });
+    `;
+    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/widgets.ts');
+    expect(hits).toHaveLength(1);
+    expect(hits[0].message).toMatch(/tenantScopedTable|platformGlobalTable/);
+  });
+
+  it('allows pgTable used inside the helpers directory', () => {
+    const source = `import { pgTable } from 'drizzle-orm/pg-core'; pgTable('x', {});`;
+    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/_helpers/tenantScopedTable.ts');
+    expect(hits).toHaveLength(0);
+  });
+
+  it('ignores comments that mention pgTable', () => {
+    const source = `// pgTable is only allowed in _helpers\nexport const x = 1;`;
+    const hits = findRawPgTableUsages(source, 'packages/db/src/schema/widgets.ts');
+    expect(hits).toHaveLength(0);
+  });
+});
diff --git a/packages/db/src/codegen/assert-all-tables-marked.ts b/packages/db/src/codegen/assert-all-tables-marked.ts
new file mode 100644
index 0000000..faf2d60
--- /dev/null
+++ b/packages/db/src/codegen/assert-all-tables-marked.ts
@@ -0,0 +1,63 @@
+import { readFileSync, readdirSync, statSync } from 'node:fs';
+import { join, relative, sep } from 'node:path';
+
+export interface Violation { file: string; line: number; message: string; }
+
+export function findRawPgTableUsages(source: string, file: string): Violation[] {
+  if (file.includes(`${sep}_helpers${sep}`) || file.includes('/_helpers/')) return [];
+  const out: Violation[] = [];
+  const lines = source.split('\n');
+  for (let i = 0; i < lines.length; i++) {
+    const raw = lines[i];
+    const code = raw.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
+    if (/\bpgTable\s*\(/.test(code)) {
+      out.push({
+        file,
+        line: i + 1,
+        message: `raw pgTable() forbidden — use tenantScopedTable() or platformGlobalTable() from _helpers/`,
+      });
+    }
+  }
+  return out;
+}
+
+function walk(dir: string): string[] {
+  const out: string[] = [];
+  for (const e of readdirSync(dir)) {
+    const p = join(dir, e);
+    if (statSync(p).isDirectory()) out.push(...walk(p));
+    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
+  }
+  return out;
+}
+
+export function assertAllTablesMarked(schemaDir: string): Violation[] {
+  const files = walk(schemaDir);
+  const violations: Violation[] = [];
+  for (const f of files) {
+    violations.push(...findRawPgTableUsages(readFileSync(f, 'utf8'), relative(process.cwd(), f)));
+  }
+  return violations;
+}
+
+// Entry-point guard: runs when invoked directly via `tsx src/codegen/assert-all-tables-marked.ts`
+// Uses argv[1] path check because import.meta.url may be undefined under esbuild/tsx transforms.
+const _argv1 = process.argv[1] ?? '';
+const _isMain =
+  _argv1.endsWith('assert-all-tables-marked.ts') ||
+  _argv1.endsWith('assert-all-tables-marked.js');
+if (_isMain) {
+  // When invoked via `pnpm run db:assert-marked` from packages/db/, cwd is packages/db.
+  // When invoked from the monorepo root (e.g., in CI), cwd is the repo root.
+  // Resolve schema dir relative to this file so it works from any cwd.
+  const schemaDir = join(
+    _argv1.replace(/\\/g, '/').replace(/\/src\/codegen\/assert-all-tables-marked\.(ts|js)$/, ''),
+    'src/schema',
+  );
+  const violations = assertAllTablesMarked(schemaDir);
+  if (violations.length > 0) {
+    for (const v of violations) console.error(`${v.file}:${v.line} — ${v.message}`);
+    process.exit(1);
+  }
+  console.log('OK — all tables marked via helpers.');
+}
diff --git a/packages/db/src/codegen/generate-rls.test.ts b/packages/db/src/codegen/generate-rls.test.ts
new file mode 100644
index 0000000..d761f55
--- /dev/null
+++ b/packages/db/src/codegen/generate-rls.test.ts
@@ -0,0 +1,35 @@
+import { describe, it, expect, beforeEach } from 'vitest';
+import { generateRlsSql } from './generate-rls';
+import { tableRegistry } from '../schema/_helpers/registry';
+import { tenantScopedTable } from '../schema/_helpers/tenantScopedTable';
+import { platformGlobalTable } from '../schema/_helpers/platformGlobalTable';
+import { text, uuid } from 'drizzle-orm/pg-core';
+
+beforeEach(() => tableRegistry.clear());
+
+describe('generateRlsSql', () => {
+  it('emits ENABLE RLS + policy per tenantScopedTable', () => {
+    tenantScopedTable('invoices', { total: text('total') });
+    const sql = generateRlsSql();
+    expect(sql).toContain('ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;');
+    expect(sql).toContain(
+      `CREATE POLICY rls_invoices_tenant_isolation ON invoices\n  FOR ALL\n  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)\n  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);`,
+    );
+  });
+
+  it('emits FORCE ROW LEVEL SECURITY so owners cannot bypass', () => {
+    tenantScopedTable('invoices', { total: text('total') });
+    expect(generateRlsSql()).toContain('ALTER TABLE invoices FORCE ROW LEVEL SECURITY;');
+  });
+
+  it('skips platformGlobalTable', () => {
+    platformGlobalTable('rates', { id: uuid('id').primaryKey() });
+    const sql = generateRlsSql();
+    expect(sql).not.toContain('rates');
+  });
+
+  it('is idempotent (uses DROP POLICY IF EXISTS)', () => {
+    tenantScopedTable('x', { y: text('y') });
+    expect(generateRlsSql()).toContain('DROP POLICY IF EXISTS rls_x_tenant_isolation ON x;');
+  });
+});
diff --git a/packages/db/src/codegen/generate-rls.ts b/packages/db/src/codegen/generate-rls.ts
new file mode 100644
index 0000000..8381333
--- /dev/null
+++ b/packages/db/src/codegen/generate-rls.ts
@@ -0,0 +1,35 @@
+import { writeFileSync } from 'node:fs';
+import { join } from 'node:path';
+import { tableRegistry } from '../schema/_helpers/registry';
+
+export function generateRlsSql(): string {
+  const parts: string[] = ['-- AUTO-GENERATED by generate-rls.ts. Do not edit by hand.\n'];
+  for (const meta of tableRegistry.list()) {
+    if (meta.kind !== 'tenant') continue;
+    parts.push(`-- ${meta.name}`);
+    parts.push(`ALTER TABLE ${meta.name} ENABLE ROW LEVEL SECURITY;`);
+    parts.push(`ALTER TABLE ${meta.name} FORCE ROW LEVEL SECURITY;`);
+    parts.push(`DROP POLICY IF EXISTS rls_${meta.name}_tenant_isolation ON ${meta.name};`);
+    parts.push(
+      `CREATE POLICY rls_${meta.name}_tenant_isolation ON ${meta.name}\n` +
+      `  FOR ALL\n` +
+      `  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)\n` +
+      `  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);`,
+    );
+    parts.push('');
+  }
+  return parts.join('\n');
+}
+
+// CLI entry point — invoked via `tsx src/codegen/generate-rls.ts`
+// Uses the same Windows-safe argv[1] check pattern as assert-all-tables-marked.ts.
+const invoked = process.argv[1] ?? '';
+if (invoked.endsWith('generate-rls.ts') || invoked.endsWith('generate-rls.js')) {
+  // Dynamic side-effect import so the pure function above stays clean for tests.
+  void import('../schema').then(() => {
+    const out = generateRlsSql();
+    const target = join(process.cwd(), 'packages/db/src/migrations/__generated__rls.sql');
+    writeFileSync(target, out);
+    console.log(`wrote ${target}`);
+  });
+}
diff --git a/packages/db/src/index.ts b/packages/db/src/index.ts
new file mode 100644
index 0000000..a343d87
--- /dev/null
+++ b/packages/db/src/index.ts
@@ -0,0 +1,5 @@
+export { createPool, POISON_UUID } from './provider';
+export { runMigrations } from './migrate';
+export { withTenantTx } from './tx';
+export { tableRegistry } from './schema';
+export type { TableMeta, TableKind } from './schema';
diff --git a/packages/db/src/migrate.ts b/packages/db/src/migrate.ts
new file mode 100644
index 0000000..8fa173d
--- /dev/null
+++ b/packages/db/src/migrate.ts
@@ -0,0 +1,35 @@
+import { readFileSync, readdirSync } from 'node:fs';
+import { join } from 'node:path';
+import { Pool } from 'pg';
+import { logger } from '@goldsmith/observability';
+
+export async function runMigrations(pool: Pool, dir: string): Promise<void> {
+  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
+  const c = await pool.connect();
+  try {
+    await c.query(`
+      CREATE TABLE IF NOT EXISTS __migrations (
+        filename TEXT PRIMARY KEY,
+        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
+      );
+    `);
+    for (const f of files) {
+      const applied = await c.query('SELECT 1 FROM __migrations WHERE filename=$1', [f]);
+      if (applied.rowCount && applied.rowCount > 0) continue;
+      logger.info({ filename: f }, 'applying migration');
+      await c.query(readFileSync(join(dir, f), 'utf8'));
+      await c.query('INSERT INTO __migrations (filename) VALUES ($1)', [f]);
+    }
+  } finally {
+    c.release();
+  }
+}
+
+// CLI entry point — Windows-safe argv check
+const invoked = process.argv[1] ?? '';
+if (invoked.endsWith('migrate.ts') || invoked.endsWith('migrate.js')) {
+  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
+  runMigrations(pool, join(process.cwd(), 'packages/db/src/migrations'))
+    .then(() => pool.end())
+    .catch((e) => { logger.error({ err: e }, 'migration failed'); process.exit(1); });
+}
diff --git a/packages/db/src/migrations/0000_roles.sql b/packages/db/src/migrations/0000_roles.sql
new file mode 100644
index 0000000..fdce6fe
--- /dev/null
+++ b/packages/db/src/migrations/0000_roles.sql
@@ -0,0 +1,18 @@
+-- 0000_roles.sql — DB roles (created before tables, no grants yet)
+-- Applied by the `migrator` role. Idempotent.
+
+DO $$
+BEGIN
+  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
+    CREATE ROLE app_user NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_app_user';
+  END IF;
+  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_admin') THEN
+    CREATE ROLE platform_admin NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_platform_admin';
+  END IF;
+END$$;
+
+-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
+-- runs migrations — bootstrapping it inside a migration is circular. This file documents the
+-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
+
+-- Real passwords injected via secrets in deploy; local dev uses docker-compose defaults.
diff --git a/packages/db/src/migrations/0001_initial_schema.sql b/packages/db/src/migrations/0001_initial_schema.sql
new file mode 100644
index 0000000..34db53b
--- /dev/null
+++ b/packages/db/src/migrations/0001_initial_schema.sql
@@ -0,0 +1,69 @@
+-- 0001_initial_schema.sql
+-- Creates shops, shop_users, audit_events + RLS policies.
+-- Codegen'd RLS from generate-rls.ts is appended manually below the DDL.
+
+CREATE EXTENSION IF NOT EXISTS "pgcrypto";
+
+CREATE TYPE shop_status        AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
+CREATE TYPE shop_user_status   AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
+CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');
+
+-- shops (platform-global; NO RLS)
+CREATE TABLE shops (
+  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  slug          TEXT NOT NULL UNIQUE,
+  display_name  TEXT NOT NULL,
+  status        shop_status NOT NULL DEFAULT 'PROVISIONING',
+  kek_key_arn   TEXT,
+  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
+  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
+  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- shop_users (tenant-scoped; RLS enabled below)
+CREATE TABLE shop_users (
+  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
+  phone         TEXT NOT NULL,
+  display_name  TEXT NOT NULL,
+  role          shop_user_role NOT NULL,
+  status        shop_user_status NOT NULL DEFAULT 'INVITED',
+  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
+  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+CREATE INDEX shop_users_shop_id_idx ON shop_users (shop_id);
+CREATE UNIQUE INDEX shop_users_shop_id_phone_idx ON shop_users (shop_id, phone);
+
+-- audit_events (tenant-scoped, append-only; RLS enabled + DML locked down in 0002)
+CREATE TABLE audit_events (
+  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
+  actor_user_id  UUID,
+  action         TEXT NOT NULL,
+  subject_type   TEXT NOT NULL,
+  subject_id     TEXT,
+  before         JSONB,
+  after          JSONB,
+  metadata       JSONB,
+  ip             TEXT,
+  user_agent     TEXT,
+  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+CREATE INDEX audit_events_shop_id_created_idx ON audit_events (shop_id, created_at DESC);
+
+-- RLS policies (self-contained here for review; equivalent output from generate-rls.ts).
+ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;
+ALTER TABLE shop_users FORCE ROW LEVEL SECURITY;
+DROP POLICY IF EXISTS rls_shop_users_tenant_isolation ON shop_users;
+CREATE POLICY rls_shop_users_tenant_isolation ON shop_users
+  FOR ALL
+  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
+  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
+
+ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
+ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
+DROP POLICY IF EXISTS rls_audit_events_tenant_isolation ON audit_events;
+CREATE POLICY rls_audit_events_tenant_isolation ON audit_events
+  FOR ALL
+  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
+  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
diff --git a/packages/db/src/migrations/0002_grants.sql b/packages/db/src/migrations/0002_grants.sql
new file mode 100644
index 0000000..8a1c610
--- /dev/null
+++ b/packages/db/src/migrations/0002_grants.sql
@@ -0,0 +1,35 @@
+-- 0002_grants.sql — privilege grants. Order: roles (0000) → tables (0001) → grants (here).
+
+-- app_user: DML on tenant tables, no DDL
+GRANT USAGE ON SCHEMA public TO app_user;
+GRANT SELECT, INSERT, UPDATE, DELETE ON shop_users TO app_user;
+GRANT SELECT                         ON shops      TO app_user;
+
+-- audit_events: append-only for app_user (invariant 11)
+GRANT INSERT, SELECT ON audit_events TO app_user;
+REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_user;
+
+GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
+
+-- migrator: DDL only, zero DML on tenant tables (invariant 5)
+-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
+-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
+-- guarded so local dev does not fail.
+DO $$
+BEGIN
+  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
+    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
+    REVOKE ALL ON shops        FROM migrator;
+    REVOKE ALL ON shop_users   FROM migrator;
+    REVOKE ALL ON audit_events FROM migrator;
+  END IF;
+END$$;
+
+-- platform_admin: broad access for SECURITY DEFINER functions (used in Story 1.5+)
+GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_admin;
+ALTER DEFAULT PRIVILEGES IN SCHEMA public
+  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_admin;
+
+-- Default privileges so future tables automatically flow to app_user via migrations
+ALTER DEFAULT PRIVILEGES IN SCHEMA public
+  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
diff --git a/packages/db/src/provider.ts b/packages/db/src/provider.ts
new file mode 100644
index 0000000..326dfd5
--- /dev/null
+++ b/packages/db/src/provider.ts
@@ -0,0 +1,25 @@
+import { Pool, type PoolConfig } from 'pg';
+import { logger } from '@goldsmith/observability';
+
+export const POISON_UUID = '00000000-0000-0000-0000-000000000000';
+
+export function createPool(config: PoolConfig): Pool {
+  const pool = new Pool({
+    max: Number(process.env['PG_POOL_MAX'] ?? '10'),
+    idleTimeoutMillis: 30_000,
+    connectionTimeoutMillis: 5_000,
+    ...config,
+  });
+
+  pool.on('connect', (client) => {
+    client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch((err) => {
+      logger.error({ err }, 'failed to set poison default on new client');
+    });
+  });
+
+  pool.on('error', (err) => {
+    logger.error({ err }, 'unexpected pg pool error');
+  });
+
+  return pool;
+}
diff --git a/packages/db/src/schema/_helpers/helpers.test.ts b/packages/db/src/schema/_helpers/helpers.test.ts
new file mode 100644
index 0000000..0dfe94a
--- /dev/null
+++ b/packages/db/src/schema/_helpers/helpers.test.ts
@@ -0,0 +1,39 @@
+import { describe, it, expect, beforeEach } from 'vitest';
+import { uuid, text } from 'drizzle-orm/pg-core';
+import { tenantScopedTable } from './tenantScopedTable';
+import { platformGlobalTable } from './platformGlobalTable';
+import { tableRegistry } from './registry';
+
+beforeEach(() => tableRegistry.clear());
+
+describe('tenantScopedTable', () => {
+  it('auto-injects shop_id NOT NULL + FK + index', () => {
+    const t = tenantScopedTable('widgets', { name: text('name').notNull() });
+    const cols = (t as unknown as { _: { columns: Record<string, unknown> } })._.columns;
+    expect(cols.shop_id).toBeDefined();
+    expect(cols.name).toBeDefined();
+  });
+
+  it('registers metadata with kind=tenant', () => {
+    tenantScopedTable('widgets', { name: text('name') });
+    expect(tableRegistry.list()).toEqual([
+      { name: 'widgets', kind: 'tenant', encryptedColumns: [] },
+    ]);
+  });
+
+  it('records encryptedColumns option', () => {
+    tenantScopedTable('secrets', { blob: text('blob') }, { encryptedColumns: ['blob'] });
+    expect(tableRegistry.list()[0]).toEqual({
+      name: 'secrets', kind: 'tenant', encryptedColumns: ['blob'],
+    });
+  });
+});
+
+describe('platformGlobalTable', () => {
+  it('registers metadata with kind=global', () => {
+    platformGlobalTable('rates', { id: uuid('id').primaryKey() });
+    expect(tableRegistry.list()).toEqual([
+      { name: 'rates', kind: 'global', encryptedColumns: [] },
+    ]);
+  });
+});
diff --git a/packages/db/src/schema/_helpers/platformGlobalTable.ts b/packages/db/src/schema/_helpers/platformGlobalTable.ts
new file mode 100644
index 0000000..5814863
--- /dev/null
+++ b/packages/db/src/schema/_helpers/platformGlobalTable.ts
@@ -0,0 +1,13 @@
+import { pgTable, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
+import { tableRegistry } from './registry';
+
+type ColumnBuilders = Record<string, PgColumnBuilderBase>;
+
+// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
+export function platformGlobalTable<N extends string, C extends ColumnBuilders>(
+  name: N,
+  columns: C,
+) {
+  tableRegistry.register({ name, kind: 'global', encryptedColumns: [] });
+  return pgTable(name, columns);
+}
diff --git a/packages/db/src/schema/_helpers/registry.ts b/packages/db/src/schema/_helpers/registry.ts
new file mode 100644
index 0000000..93cf07d
--- /dev/null
+++ b/packages/db/src/schema/_helpers/registry.ts
@@ -0,0 +1,21 @@
+export type TableKind = 'tenant' | 'global';
+export interface TableMeta {
+  name: string;
+  kind: TableKind;
+  encryptedColumns: string[];
+}
+
+class TableRegistry {
+  private readonly byName = new Map<string, TableMeta>();
+  register(meta: TableMeta): void {
+    if (this.byName.has(meta.name)) {
+      throw new Error(`Table "${meta.name}" registered twice — use a unique name.`);
+    }
+    this.byName.set(meta.name, meta);
+  }
+  list(): TableMeta[] { return [...this.byName.values()]; }
+  get(name: string): TableMeta | undefined { return this.byName.get(name); }
+  clear(): void { this.byName.clear(); }
+}
+
+export const tableRegistry = new TableRegistry();
diff --git a/packages/db/src/schema/_helpers/tenantScopedTable.ts b/packages/db/src/schema/_helpers/tenantScopedTable.ts
new file mode 100644
index 0000000..823522f
--- /dev/null
+++ b/packages/db/src/schema/_helpers/tenantScopedTable.ts
@@ -0,0 +1,44 @@
+import { pgTable, uuid, index, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
+import { tableRegistry } from './registry';
+
+type ColumnBuilders = Record<string, PgColumnBuilderBase>;
+
+// Drizzle 0.30.x stores columns under a Symbol; expose them via `._` for
+// compatibility with the test accessor pattern `t._.columns`.
+const drizzleColumnsSymbol = Symbol.for('drizzle:Columns');
+
+// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
+export function tenantScopedTable<N extends string, C extends ColumnBuilders>(
+  name: N,
+  columns: C,
+  opts: { encryptedColumns?: (keyof C & string)[] } = {},
+) {
+  tableRegistry.register({
+    name,
+    kind: 'tenant',
+    encryptedColumns: opts.encryptedColumns ?? [],
+  });
+
+  const table = pgTable(
+    name,
+    {
+      shop_id: uuid('shop_id').notNull(),
+      ...columns,
+    } as C & { shop_id: ReturnType<typeof uuid> },
+    (t) => ({
+      shopIdIdx: index(`${name}_shop_id_idx`).on((t as Record<string, unknown>).shop_id as never),
+    }),
+  );
+
+  // Attach `_` accessor so tests (and tooling) can reach `t._.columns`
+  const cols = (table as unknown as Record<symbol, Record<string, unknown>>)[drizzleColumnsSymbol]
+    ?? Object.fromEntries(Object.keys(table).map((k) => [k, (table as Record<string, unknown>)[k]]));
+
+  Object.defineProperty(table, '_', {
+    enumerable: false,
+    configurable: true,
+    value: { columns: cols },
+  });
+
+  return table;
+}
diff --git a/packages/db/src/schema/audit-events.ts b/packages/db/src/schema/audit-events.ts
new file mode 100644
index 0000000..362c19a
--- /dev/null
+++ b/packages/db/src/schema/audit-events.ts
@@ -0,0 +1,16 @@
+import { uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
+import { tenantScopedTable } from './_helpers/tenantScopedTable';
+
+export const auditEvents = tenantScopedTable('audit_events', {
+  id: uuid('id').primaryKey().defaultRandom(),
+  actor_user_id: uuid('actor_user_id'),
+  action: text('action').notNull(),
+  subject_type: text('subject_type').notNull(),
+  subject_id: text('subject_id'),
+  before: jsonb('before'),
+  after: jsonb('after'),
+  metadata: jsonb('metadata'),
+  ip: text('ip'),
+  user_agent: text('user_agent'),
+  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
+});
diff --git a/packages/db/src/schema/index.ts b/packages/db/src/schema/index.ts
new file mode 100644
index 0000000..094ab5b
--- /dev/null
+++ b/packages/db/src/schema/index.ts
@@ -0,0 +1,5 @@
+export * from './shops';
+export * from './shop-users';
+export * from './audit-events';
+export { tableRegistry } from './_helpers/registry';
+export type { TableMeta, TableKind } from './_helpers/registry';
diff --git a/packages/db/src/schema/shop-users.ts b/packages/db/src/schema/shop-users.ts
new file mode 100644
index 0000000..be9f6a5
--- /dev/null
+++ b/packages/db/src/schema/shop-users.ts
@@ -0,0 +1,19 @@
+import { uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
+import { tenantScopedTable } from './_helpers/tenantScopedTable';
+
+export const shopUserStatusEnum = pgEnum('shop_user_status', ['INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
+export const shopUserRoleEnum   = pgEnum('shop_user_role',   ['shop_admin', 'shop_manager', 'shop_staff']);
+
+export const shopUsers = tenantScopedTable(
+  'shop_users',
+  {
+    id: uuid('id').primaryKey().defaultRandom(),
+    phone: text('phone').notNull(),
+    display_name: text('display_name').notNull(),
+    role: shopUserRoleEnum('role').notNull(),
+    status: shopUserStatusEnum('status').notNull().default('INVITED'),
+    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
+    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
+  },
+  { encryptedColumns: [] },
+);
diff --git a/packages/db/src/schema/shops.ts b/packages/db/src/schema/shops.ts
new file mode 100644
index 0000000..208d720
--- /dev/null
+++ b/packages/db/src/schema/shops.ts
@@ -0,0 +1,15 @@
+import { uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
+import { platformGlobalTable } from './_helpers/platformGlobalTable';
+
+export const shopStatusEnum = pgEnum('shop_status', ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']);
+
+export const shops = platformGlobalTable('shops', {
+  id: uuid('id').primaryKey().defaultRandom(),
+  slug: text('slug').notNull().unique(),
+  display_name: text('display_name').notNull(),
+  status: shopStatusEnum('status').notNull().default('PROVISIONING'),
+  kek_key_arn: text('kek_key_arn'),
+  config: jsonb('config').notNull().default({}),
+  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
+  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
+});
diff --git a/packages/db/src/tx.ts b/packages/db/src/tx.ts
new file mode 100644
index 0000000..b7e79d3
--- /dev/null
+++ b/packages/db/src/tx.ts
@@ -0,0 +1,30 @@
+import type { Pool, PoolClient } from 'pg';
+import { tenantContext } from '@goldsmith/tenant-context';
+import { POISON_UUID } from './provider';
+
+export async function withTenantTx<T>(
+  pool: Pool,
+  fn: (tx: PoolClient) => Promise<T>,
+): Promise<T> {
+  const ctx = tenantContext.current();
+  if (!ctx) throw new Error('tenant.context_not_set');
+  const client = await pool.connect();
+  try {
+    await client.query('BEGIN');
+    await client.query('SET LOCAL ROLE app_user');
+    await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
+    const result = await fn(client);
+    await client.query('COMMIT');
+    return result;
+  } catch (err) {
+    await client.query('ROLLBACK').catch(() => undefined);
+    throw err;
+  } finally {
+    // Reset session-level shop context to poison default before returning to pool.
+    // SET LOCAL is rolled back with the transaction, but any prior session-level
+    // SET (e.g. from seed scripts) persists. Explicitly re-poison here so that
+    // a recycled connection never leaks tenant state to the next caller.
+    await client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
+    client.release();
+  }
+}
diff --git a/packages/db/test/poison-default.integration.test.ts b/packages/db/test/poison-default.integration.test.ts
new file mode 100644
index 0000000..4a8d786
--- /dev/null
+++ b/packages/db/test/poison-default.integration.test.ts
@@ -0,0 +1,48 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { createPool, POISON_UUID } from '../src/provider';
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  const c = await pool.connect();
+  await c.query(`
+    CREATE TABLE demo (id SERIAL PRIMARY KEY, shop_id UUID NOT NULL, data TEXT);
+    INSERT INTO demo (shop_id, data) VALUES
+      ('11111111-1111-1111-1111-111111111111', 'a'),
+      ('22222222-2222-2222-2222-222222222222', 'b');
+    ALTER TABLE demo ENABLE ROW LEVEL SECURITY;
+    CREATE POLICY rls_demo ON demo FOR ALL
+      USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
+      WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
+    CREATE ROLE app_user NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'x';
+    GRANT SELECT, INSERT, UPDATE, DELETE ON demo TO app_user;
+    GRANT USAGE ON SCHEMA public TO app_user;
+    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
+  `);
+  c.release();
+}, 60_000);
+
+afterAll(async () => {
+  await pool?.end();
+  await container?.stop();
+});
+
+describe('connection pool poison default', () => {
+  it('sets poison UUID on checkout so unscoped SELECT returns 0 rows', async () => {
+    const appPool = createPool({
+      connectionString: container.getConnectionUri().replace('test:test', 'app_user:x'),
+    });
+    const client = await appPool.connect();
+    const { rows } = await client.query('SELECT * FROM demo');
+    expect(rows).toHaveLength(0);
+    const { rows: setting } = await client.query(`SELECT current_setting('app.current_shop_id', true) AS v`);
+    expect(setting[0].v).toBe(POISON_UUID);
+    client.release();
+    await appPool.end();
+  });
+});
diff --git a/packages/db/test/with-tenant-tx.integration.test.ts b/packages/db/test/with-tenant-tx.integration.test.ts
new file mode 100644
index 0000000..52aaff7
--- /dev/null
+++ b/packages/db/test/with-tenant-tx.integration.test.ts
@@ -0,0 +1,74 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { readFileSync } from 'node:fs';
+import { join } from 'node:path';
+import { Pool } from 'pg';
+import { createPool } from '../src/provider';
+import { withTenantTx } from '../src/tx';
+import { tenantContext } from '@goldsmith/tenant-context';
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+const SHOP_A = '11111111-1111-1111-1111-111111111111';
+const SHOP_B = '22222222-2222-2222-2222-222222222222';
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  const c = await pool.connect();
+  for (const f of ['0000_roles.sql', '0001_initial_schema.sql', '0002_grants.sql']) {
+    await c.query(readFileSync(join(__dirname, `../src/migrations/${f}`), 'utf8'));
+  }
+  await c.query(`INSERT INTO shops (id, slug, display_name, status) VALUES
+    ('${SHOP_A}','a','Shop A','ACTIVE'),
+    ('${SHOP_B}','b','Shop B','ACTIVE');`);
+  await c.query(`
+    SET ROLE app_user;
+    SET app.current_shop_id = '${SHOP_A}';
+    INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+      VALUES ('${SHOP_A}', '+91a', 'Alice A', 'shop_admin', 'ACTIVE');
+    SET app.current_shop_id = '${SHOP_B}';
+    INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+      VALUES ('${SHOP_B}', '+91b', 'Bob B', 'shop_admin', 'ACTIVE');
+    RESET ROLE;
+  `);
+  c.release();
+}, 60_000);
+
+afterAll(async () => { await pool?.end(); await container?.stop(); });
+
+describe('withTenantTx', () => {
+  it('scopes SELECT to ALS tenant', async () => {
+    const rows = await tenantContext.runWith({ shopId: SHOP_A } as never, () =>
+      withTenantTx(pool, async (tx) => (await tx.query('SELECT * FROM shop_users')).rows),
+    );
+    expect(rows).toHaveLength(1);
+    expect(rows[0].shop_id).toBe(SHOP_A);
+  });
+
+  it('throws when called outside runWith', async () => {
+    await expect(withTenantTx(pool, async () => undefined)).rejects.toThrow(
+      /tenant\.context_not_set/,
+    );
+  });
+
+  it('rolls back on error + leaves SET LOCAL unleaked', async () => {
+    await tenantContext.runWith({ shopId: SHOP_A } as never, async () => {
+      await expect(
+        withTenantTx(pool, async (tx) => {
+          await tx.query('INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1,$2,$3,$4,$5)',
+            [SHOP_A, '+91c', 'X', 'shop_staff', 'ACTIVE']);
+          throw new Error('boom');
+        }),
+      ).rejects.toThrow('boom');
+    });
+    // Fresh conn, no tenant set → poison-default. Must SET ROLE app_user so RLS applies
+    // (superusers bypass RLS even with FORCE; app_user is NOBYPASSRLS).
+    const c = await pool.connect();
+    await c.query('SET ROLE app_user');
+    const { rows } = await c.query('SELECT * FROM shop_users');
+    expect(rows).toHaveLength(0);
+    await c.query('RESET ROLE');
+    c.release();
+  });
+});
diff --git a/packages/db/tsconfig.json b/packages/db/tsconfig.json
new file mode 100644
index 0000000..feacc57
--- /dev/null
+++ b/packages/db/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
diff --git a/packages/db/vitest.config.ts b/packages/db/vitest.config.ts
new file mode 100644
index 0000000..93041f1
--- /dev/null
+++ b/packages/db/vitest.config.ts
@@ -0,0 +1,18 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    environment: 'node',
+    coverage: {
+      provider: 'v8',
+      reporter: ['text', 'lcov'],
+      // Enforce thresholds only on schema helpers (well-covered).
+      // codegen files have partial coverage; full coverage is a TODO for a dedicated
+      // codegen test suite. DB connection files (index/migrate/provider/tx) require a
+      // live Postgres instance and are covered by integration tests.
+      include: ['src/schema/_helpers/**/*.ts'],
+      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
+      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
+    },
+  },
+});
diff --git a/packages/observability/package.json b/packages/observability/package.json
new file mode 100644
index 0000000..3962e7e
--- /dev/null
+++ b/packages/observability/package.json
@@ -0,0 +1,20 @@
+{
+  "name": "@goldsmith/observability",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run",
+    "test:unit": "vitest run"
+  },
+  "dependencies": {
+    "@opentelemetry/api": "^1.8.0",
+    "@opentelemetry/sdk-node": "^0.51.0",
+    "@opentelemetry/auto-instrumentations-node": "^0.43.0",
+    "@sentry/node": "^7.109.0",
+    "pino": "^8.19.0"
+  },
+  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" }
+}
diff --git a/packages/observability/src/index.ts b/packages/observability/src/index.ts
new file mode 100644
index 0000000..ebfb1fd
--- /dev/null
+++ b/packages/observability/src/index.ts
@@ -0,0 +1,4 @@
+export { logger } from './logger';
+export { initSentry } from './sentry';
+export { initOtel } from './otel';
+export { redactPii } from './pii-redactor';
diff --git a/packages/observability/src/logger.ts b/packages/observability/src/logger.ts
new file mode 100644
index 0000000..e4864ff
--- /dev/null
+++ b/packages/observability/src/logger.ts
@@ -0,0 +1,13 @@
+import pino from 'pino';
+import { redactPii } from './pii-redactor';
+
+export const logger = pino({
+  level: process.env['LOG_LEVEL'] ?? 'info',
+  formatters: {
+    log: (obj) => redactPii(obj),
+  },
+  redact: {
+    paths: ['req.headers.authorization', 'req.headers["x-tenant-id"]', '*.password', '*.otp'],
+    censor: '[REDACTED:field]',
+  },
+});
diff --git a/packages/observability/src/otel.ts b/packages/observability/src/otel.ts
new file mode 100644
index 0000000..d453a7e
--- /dev/null
+++ b/packages/observability/src/otel.ts
@@ -0,0 +1,15 @@
+import { NodeSDK } from '@opentelemetry/sdk-node';
+import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
+
+let _sdk: NodeSDK | undefined;
+
+export function initOtel(serviceName: string): NodeSDK | undefined {
+  if (_sdk) return _sdk;
+  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) return undefined;
+  _sdk = new NodeSDK({
+    serviceName,
+    instrumentations: [getNodeAutoInstrumentations()],
+  });
+  _sdk.start();
+  return _sdk;
+}
diff --git a/packages/observability/src/pii-redactor.ts b/packages/observability/src/pii-redactor.ts
new file mode 100644
index 0000000..ecf0774
--- /dev/null
+++ b/packages/observability/src/pii-redactor.ts
@@ -0,0 +1,31 @@
+const PII_KEYS = new Set([
+  'phone', 'pan', 'email', 'aadhaar', 'dob',
+  'address', 'customerName', 'ownerName', 'display_name',
+  'gstin', 'bankAccount', 'ifsc', 'otp',
+]);
+
+function isPlainObject(v: unknown): v is Record<string, unknown> {
+  if (v === null || typeof v !== 'object') return false;
+  const proto = Object.getPrototypeOf(v) as unknown;
+  return proto === Object.prototype || proto === null;
+}
+
+export function redactPii<T>(input: T, seen: WeakSet<object> = new WeakSet()): T {
+  if (input === null || input === undefined) return input;
+  if (Array.isArray(input)) {
+    if (seen.has(input)) return '[Circular]' as unknown as T;
+    seen.add(input);
+    return input.map((item) => redactPii(item, seen)) as unknown as T;
+  }
+  if (isPlainObject(input)) {
+    if (seen.has(input)) return '[Circular]' as unknown as T;
+    seen.add(input);
+    const out: Record<string, unknown> = {};
+    for (const [k, v] of Object.entries(input)) {
+      out[k] = PII_KEYS.has(k) ? `[REDACTED:${k}]` : redactPii(v, seen);
+    }
+    return out as unknown as T;
+  }
+  // Error, Date, Buffer, class instances, Map, Set, Symbol — preserve as-is.
+  return input;
+}
diff --git a/packages/observability/src/sentry.ts b/packages/observability/src/sentry.ts
new file mode 100644
index 0000000..245f968
--- /dev/null
+++ b/packages/observability/src/sentry.ts
@@ -0,0 +1,37 @@
+import * as Sentry from '@sentry/node';
+import { redactPii } from './pii-redactor';
+
+let _initialized = false;
+
+export function initSentry(): void {
+  if (_initialized) return;
+  const dsn = process.env['SENTRY_DSN'];
+  if (!dsn) return;
+  _initialized = true;
+  Sentry.init({
+    dsn,
+    environment: process.env['NODE_ENV'] ?? 'development',
+    tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
+    beforeSend: (event) => {
+      if (event.request?.data && typeof event.request.data === 'object') {
+        event.request.data = redactPii(event.request.data);
+      }
+      if (event.request?.headers) {
+        // eslint-disable-next-line @typescript-eslint/no-unused-vars
+        const { authorization: _a, cookie: _c, 'x-tenant-id': _t, ...safeHeaders } =
+          event.request.headers as Record<string, string>;
+        event.request.headers = safeHeaders;
+      }
+      if (event.user) {
+        event.user = event.user.id ? { id: event.user.id } : {};
+      }
+      if (event.breadcrumbs) {
+        event.breadcrumbs = (event.breadcrumbs as Sentry.Breadcrumb[]).map((b) => {
+          if (!b.data) return b;
+          return { ...b, data: redactPii(b.data) as { [key: string]: unknown } };
+        });
+      }
+      return { ...event, extra: redactPii(event.extra ?? {}) };
+    },
+  });
+}
diff --git a/packages/observability/test/pii-redactor.test.ts b/packages/observability/test/pii-redactor.test.ts
new file mode 100644
index 0000000..ea926f0
--- /dev/null
+++ b/packages/observability/test/pii-redactor.test.ts
@@ -0,0 +1,75 @@
+import { describe, it, expect } from 'vitest';
+import { redactPii } from '../src/pii-redactor';
+
+describe('redactPii', () => {
+  it('redacts phone (E.164)', () => {
+    expect(redactPii({ phone: '+919876543210' })).toEqual({ phone: '[REDACTED:phone]' });
+  });
+
+  it('redacts pan (10-char ABCDE1234F pattern)', () => {
+    expect(redactPii({ pan: 'ABCDE1234F' })).toEqual({ pan: '[REDACTED:pan]' });
+  });
+
+  it('redacts email', () => {
+    expect(redactPii({ email: 'u@x.com' })).toEqual({ email: '[REDACTED:email]' });
+  });
+
+  it('redacts nested keys', () => {
+    expect(redactPii({ user: { phone: '+919876543210', name: 'Ok' } })).toEqual({
+      user: { phone: '[REDACTED:phone]', name: 'Ok' },
+    });
+  });
+
+  it('redacts by key name even when value does not match pattern', () => {
+    expect(redactPii({ phone: 'xyz' })).toEqual({ phone: '[REDACTED:phone]' });
+  });
+
+  it('leaves non-PII keys alone', () => {
+    expect(redactPii({ shopId: 'abc', total: 123 })).toEqual({ shopId: 'abc', total: 123 });
+  });
+
+  it('redacts display_name (shop_users column)', () => {
+    expect(redactPii({ display_name: 'Rajesh Ji' })).toEqual({
+      display_name: '[REDACTED:display_name]',
+    });
+  });
+
+  it('redacts PII inside arrays of objects', () => {
+    expect(redactPii([{ phone: '+91a' }, { email: 'b@x' }])).toEqual([
+      { phone: '[REDACTED:phone]' },
+      { email: '[REDACTED:email]' },
+    ]);
+  });
+
+  it('preserves Error instances (stack + message intact)', () => {
+    const err = new Error('db connection refused');
+    const out = redactPii({ err });
+    expect(out.err).toBe(err); // same reference — Error passes through
+    expect((out.err as Error).message).toBe('db connection refused');
+  });
+
+  it('preserves Date instances (timestamp intact)', () => {
+    const ts = new Date('2026-04-18T00:00:00Z');
+    const out = redactPii({ ts });
+    expect(out.ts).toBe(ts);
+  });
+
+  it('preserves Buffer instances (byte content intact)', () => {
+    const buf = Buffer.from('hello', 'utf8');
+    const out = redactPii({ buf });
+    expect(out.buf).toBe(buf);
+    expect((out.buf as Buffer).toString('utf8')).toBe('hello');
+  });
+
+  it('handles circular references without stack overflow', () => {
+    const a: Record<string, unknown> = { phone: '+91' };
+    a.self = a;
+    const out = redactPii(a) as Record<string, unknown>;
+    expect(out.phone).toBe('[REDACTED:phone]');
+    expect(out.self).toBe('[Circular]');
+  });
+
+  it('redacts null value under PII key (key-based, not value-based)', () => {
+    expect(redactPii({ phone: null })).toEqual({ phone: '[REDACTED:phone]' });
+  });
+});
diff --git a/packages/observability/tsconfig.json b/packages/observability/tsconfig.json
new file mode 100644
index 0000000..feacc57
--- /dev/null
+++ b/packages/observability/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
diff --git a/packages/observability/vitest.config.ts b/packages/observability/vitest.config.ts
new file mode 100644
index 0000000..34c49db
--- /dev/null
+++ b/packages/observability/vitest.config.ts
@@ -0,0 +1,16 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    environment: 'node',
+    coverage: {
+      provider: 'v8',
+      reporter: ['text', 'lcov'],
+      // Only enforce thresholds on the files that have unit tests.
+      // sentry.ts / logger.ts / otel.ts are infrastructure wrappers tested via integration.
+      include: ['src/pii-redactor.ts'],
+      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
+      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
+    },
+  },
+});
diff --git a/packages/queue/package.json b/packages/queue/package.json
new file mode 100644
index 0000000..7d86856
--- /dev/null
+++ b/packages/queue/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "@goldsmith/queue",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run"
+  },
+  "dependencies": {
+    "bullmq": "^5.7.0",
+    "@goldsmith/tenant-context": "workspace:*",
+    "@goldsmith/observability": "workspace:*"
+  },
+  "devDependencies": { "vitest": "^1.4.0", "ioredis": "^5.3.0", "typescript": "^5.4.0" }
+}
diff --git a/packages/queue/src/base-processor.ts b/packages/queue/src/base-processor.ts
new file mode 100644
index 0000000..cf03b17
--- /dev/null
+++ b/packages/queue/src/base-processor.ts
@@ -0,0 +1,33 @@
+import { Worker, type Job, type WorkerOptions } from 'bullmq';
+import type Redis from 'ioredis';
+import { tenantContext, type TenantContext, type Tenant } from '@goldsmith/tenant-context';
+import { logger } from '@goldsmith/observability';
+import { extractTenantId, type JobPayload } from './tenant-queue';
+
+export interface TenantResolver {
+  byId(id: string): Promise<Tenant | undefined>;
+}
+
+export function createTenantWorker<T>(
+  name: string,
+  handler: (ctx: TenantContext, data: T) => Promise<void>,
+  tenants: TenantResolver,
+  connection: Redis,
+  opts: Omit<WorkerOptions, 'connection'> = {},
+): Worker<JobPayload<T>> {
+  return new Worker<JobPayload<T>>(
+    name,
+    async (job: Job<JobPayload<T>>) => {
+      const shopId = extractTenantId(job.data);
+      const tenant = await tenants.byId(shopId);
+      if (!tenant) throw new Error('tenant.not_found');
+      if (tenant.status !== 'ACTIVE') throw new Error('tenant.inactive');
+      const ctx: TenantContext = { shopId: tenant.id, tenant };
+      return tenantContext.runWith(ctx, async () => {
+        logger.info({ jobId: job.id, shopId, name: job.name }, 'processing');
+        await handler(ctx, job.data.data);
+      });
+    },
+    { connection, ...opts },
+  );
+}
diff --git a/packages/queue/src/index.ts b/packages/queue/src/index.ts
new file mode 100644
index 0000000..125987c
--- /dev/null
+++ b/packages/queue/src/index.ts
@@ -0,0 +1,2 @@
+export { TenantQueue, buildJobPayload, extractTenantId, type JobPayload } from './tenant-queue';
+export { createTenantWorker, type TenantResolver } from './base-processor';
diff --git a/packages/queue/src/tenant-queue.ts b/packages/queue/src/tenant-queue.ts
new file mode 100644
index 0000000..213dd9c
--- /dev/null
+++ b/packages/queue/src/tenant-queue.ts
@@ -0,0 +1,29 @@
+import { Queue, type JobsOptions } from 'bullmq';
+import type Redis from 'ioredis';
+import type { TenantContext } from '@goldsmith/tenant-context';
+
+export interface JobPayload<T> {
+  meta: { tenantId: string };
+  data: T;
+}
+
+export function buildJobPayload<T>(ctx: TenantContext, data: T): JobPayload<T> {
+  return { meta: { tenantId: ctx.shopId }, data };
+}
+
+export function extractTenantId(payload: Partial<JobPayload<unknown>>): string {
+  const id = payload?.meta?.tenantId;
+  if (!id) throw new Error('queue.missing_tenant_meta');
+  return id;
+}
+
+export class TenantQueue<T> {
+  private readonly queue: Queue<JobPayload<T>>;
+  constructor(name: string, connection: Redis) {
+    this.queue = new Queue<JobPayload<T>>(name, { connection });
+  }
+  async add(ctx: TenantContext, jobName: string, data: T, opts?: JobsOptions): Promise<void> {
+    await this.queue.add(jobName, buildJobPayload(ctx, data), opts);
+  }
+  async close(): Promise<void> { await this.queue.close(); }
+}
diff --git a/packages/queue/test/tenant-queue.test.ts b/packages/queue/test/tenant-queue.test.ts
new file mode 100644
index 0000000..3e5120c
--- /dev/null
+++ b/packages/queue/test/tenant-queue.test.ts
@@ -0,0 +1,21 @@
+import { describe, it, expect } from 'vitest';
+import { buildJobPayload, extractTenantId } from '../src/tenant-queue';
+
+const A = { shopId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
+
+describe('tenant-queue payload shape', () => {
+  it('buildJobPayload wraps data with meta.tenantId from ctx', () => {
+    expect(buildJobPayload(A as never, { foo: 1 })).toEqual({
+      meta: { tenantId: A.shopId },
+      data: { foo: 1 },
+    });
+  });
+
+  it('extractTenantId reads meta.tenantId', () => {
+    expect(extractTenantId({ meta: { tenantId: A.shopId }, data: {} })).toBe(A.shopId);
+  });
+
+  it('extractTenantId throws on missing meta', () => {
+    expect(() => extractTenantId({} as never)).toThrow(/queue\.missing_tenant_meta/);
+  });
+});
diff --git a/packages/queue/tsconfig.json b/packages/queue/tsconfig.json
new file mode 100644
index 0000000..feacc57
--- /dev/null
+++ b/packages/queue/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
diff --git a/packages/tenant-context/package.json b/packages/tenant-context/package.json
new file mode 100644
index 0000000..a4c27fb
--- /dev/null
+++ b/packages/tenant-context/package.json
@@ -0,0 +1,20 @@
+{
+  "name": "@goldsmith/tenant-context",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run",
+    "test:unit": "vitest run --dir src --passWithNoTests",
+    "test:integration": "vitest run --dir test"
+  },
+  "dependencies": {
+    "@nestjs/common": "^10.3.0",
+    "@nestjs/core": "^10.3.0",
+    "ioredis": "^5.3.0"
+  },
+  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" },
+  "peerDependencies": { "rxjs": "^7.8.0", "reflect-metadata": "^0.2.0" }
+}
diff --git a/packages/tenant-context/src/als.ts b/packages/tenant-context/src/als.ts
new file mode 100644
index 0000000..709e585
--- /dev/null
+++ b/packages/tenant-context/src/als.ts
@@ -0,0 +1,18 @@
+import { AsyncLocalStorage } from 'node:async_hooks';
+import type { TenantContext } from './context';
+
+const als = new AsyncLocalStorage<TenantContext>();
+
+export const tenantContext = {
+  runWith<T>(ctx: TenantContext, fn: () => T | Promise<T>): T | Promise<T> {
+    return als.run(ctx, fn);
+  },
+  current(): TenantContext | undefined {
+    return als.getStore();
+  },
+  requireCurrent(): TenantContext {
+    const ctx = als.getStore();
+    if (!ctx) throw new Error('tenant.context_not_set');
+    return ctx;
+  },
+} as const;
diff --git a/packages/tenant-context/src/context.ts b/packages/tenant-context/src/context.ts
new file mode 100644
index 0000000..40e1916
--- /dev/null
+++ b/packages/tenant-context/src/context.ts
@@ -0,0 +1,19 @@
+export interface Tenant {
+  id: string;
+  slug: string;
+  display_name: string;
+  status: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
+}
+
+export interface TenantContext {
+  readonly shopId: string;
+  readonly tenant: Tenant;
+  /** @sinceStory 1.1 — populated by JWT verification in auth module */
+  readonly userId?: string;
+  /** @sinceStory 1.1 */
+  readonly role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
+  /** @sinceStory 1.5 — platform-admin impersonation */
+  readonly isImpersonating?: boolean;
+  /** @sinceStory 1.5 */
+  readonly impersonationAuditId?: string;
+}
diff --git a/packages/tenant-context/src/decorator.ts b/packages/tenant-context/src/decorator.ts
new file mode 100644
index 0000000..ea4eda5
--- /dev/null
+++ b/packages/tenant-context/src/decorator.ts
@@ -0,0 +1,8 @@
+import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
+import { tenantContext } from './als';
+import type { TenantContext } from './context';
+
+export const TenantContextDec = createParamDecorator(
+  // eslint-disable-next-line @typescript-eslint/no-unused-vars
+  (_: unknown, _ctx: ExecutionContext): TenantContext => tenantContext.requireCurrent(),
+);
diff --git a/packages/tenant-context/src/index.ts b/packages/tenant-context/src/index.ts
new file mode 100644
index 0000000..694490b
--- /dev/null
+++ b/packages/tenant-context/src/index.ts
@@ -0,0 +1,5 @@
+export { tenantContext } from './als';
+export { TenantContextDec } from './decorator';
+export { TenantInterceptor, type TenantResolver, type RequestLike } from './interceptor';
+export { TenantCache, type TenantLookup } from './tenant-cache';
+export type { TenantContext, Tenant } from './context';
diff --git a/packages/tenant-context/src/interceptor.ts b/packages/tenant-context/src/interceptor.ts
new file mode 100644
index 0000000..45af099
--- /dev/null
+++ b/packages/tenant-context/src/interceptor.ts
@@ -0,0 +1,62 @@
+import {
+  Injectable,
+  type CallHandler,
+  type ExecutionContext,
+  type NestInterceptor,
+  ForbiddenException,
+  UnauthorizedException,
+} from '@nestjs/common';
+import { from, Observable } from 'rxjs';
+import { switchMap } from 'rxjs/operators';
+import { tenantContext } from './als';
+import type { TenantContext, Tenant } from './context';
+import type { TenantLookup } from './tenant-cache';
+
+export interface RequestLike {
+  headers: Record<string, string | string[] | undefined>;
+  hostname?: string;
+  path?: string;
+}
+
+export interface TenantResolver {
+  fromHost(host: string): Promise<string | undefined>;
+  fromHeader(req: RequestLike): string | undefined;
+  fromJwt(req: RequestLike): string | undefined;
+}
+
+@Injectable()
+export class TenantInterceptor implements NestInterceptor {
+  constructor(
+    private readonly resolver: TenantResolver,
+    private readonly tenants: TenantLookup,
+  ) {}
+
+  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
+    return from(this.resolve(ctx)).pipe(switchMap((tc) =>
+      new Observable<unknown>((sub) => {
+        tenantContext.runWith(tc, () => {
+          const inner = next.handle().subscribe({
+            next: (v) => sub.next(v),
+            error: (e) => sub.error(e),
+            complete: () => sub.complete(),
+          });
+          return () => inner.unsubscribe();
+        });
+      }),
+    ));
+  }
+
+  private async resolve(ctx: ExecutionContext): Promise<TenantContext> {
+    const req = ctx.switchToHttp().getRequest<RequestLike>();
+    let shopId: string | undefined;
+    if (req.hostname) shopId = await this.resolver.fromHost(req.hostname);
+    shopId ??= this.resolver.fromHeader(req);
+    shopId ??= this.resolver.fromJwt(req);
+
+    if (!shopId) throw new UnauthorizedException('tenant.resolution_failed');
+    const tenant: Tenant | undefined = await this.tenants.byId(shopId);
+    if (!tenant) throw new UnauthorizedException('tenant.not_found');
+    if (tenant.status !== 'ACTIVE') throw new ForbiddenException('tenant.inactive');
+    return { shopId: tenant.id, tenant };
+  }
+}
diff --git a/packages/tenant-context/src/tenant-cache.ts b/packages/tenant-context/src/tenant-cache.ts
new file mode 100644
index 0000000..15a0f93
--- /dev/null
+++ b/packages/tenant-context/src/tenant-cache.ts
@@ -0,0 +1,27 @@
+import type Redis from 'ioredis';
+import type { Tenant } from './context';
+
+export interface TenantLookup {
+  byId(shopId: string): Promise<Tenant | undefined>;
+}
+
+export class TenantCache implements TenantLookup {
+  constructor(
+    private readonly redis: Redis,
+    private readonly loader: (shopId: string) => Promise<Tenant | undefined>,
+    private readonly ttlSec = 60,
+  ) {}
+
+  async byId(shopId: string): Promise<Tenant | undefined> {
+    const key = `tenant:${shopId}`;
+    const cached = await this.redis.get(key);
+    if (cached) return JSON.parse(cached) as Tenant;
+    const t = await this.loader(shopId);
+    if (t) await this.redis.set(key, JSON.stringify(t), 'EX', this.ttlSec);
+    return t;
+  }
+
+  async invalidate(shopId: string): Promise<void> {
+    await this.redis.del(`tenant:${shopId}`);
+  }
+}
diff --git a/packages/tenant-context/test/als.test.ts b/packages/tenant-context/test/als.test.ts
new file mode 100644
index 0000000..d537d5e
--- /dev/null
+++ b/packages/tenant-context/test/als.test.ts
@@ -0,0 +1,30 @@
+import { describe, it, expect } from 'vitest';
+import { tenantContext } from '../src/als';
+
+const A = { shopId: '11111111-1111-1111-1111-111111111111' };
+
+describe('tenantContext (ALS)', () => {
+  it('current() is undefined outside runWith', () => {
+    expect(tenantContext.current()).toBeUndefined();
+  });
+
+  it('runWith makes current() return the ctx', async () => {
+    await tenantContext.runWith(A as never, async () => {
+      expect(tenantContext.current()?.shopId).toBe(A.shopId);
+    });
+    expect(tenantContext.current()).toBeUndefined();
+  });
+
+  it('context survives await + Promise.all', async () => {
+    await tenantContext.runWith(A as never, async () => {
+      await Promise.all([
+        (async () => { await new Promise((r) => setImmediate(r)); expect(tenantContext.current()?.shopId).toBe(A.shopId); })(),
+        (async () => { await new Promise((r) => process.nextTick(r));  expect(tenantContext.current()?.shopId).toBe(A.shopId); })(),
+      ]);
+    });
+  });
+
+  it('requireCurrent throws when unset', () => {
+    expect(() => tenantContext.requireCurrent()).toThrow(/tenant\.context_not_set/);
+  });
+});
diff --git a/packages/tenant-context/tsconfig.json b/packages/tenant-context/tsconfig.json
new file mode 100644
index 0000000..3aa3f44
--- /dev/null
+++ b/packages/tenant-context/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../tsconfig.base.json", "compilerOptions": { "experimentalDecorators": true, "emitDecoratorMetadata": true }, "include": ["src/**/*", "test/**/*"] }
diff --git a/packages/tenant-context/vitest.config.ts b/packages/tenant-context/vitest.config.ts
new file mode 100644
index 0000000..742229f
--- /dev/null
+++ b/packages/tenant-context/vitest.config.ts
@@ -0,0 +1,16 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    environment: 'node',
+    passWithNoTests: true,
+    coverage: {
+      provider: 'v8',
+      reporter: ['text', 'lcov'],
+      // No unit tests live in src/ for this package (integration tests are in test/).
+      // Thresholds are effectively waived here; coverage is enforced via test:integration.
+      thresholds: { lines: 0, statements: 0, functions: 0, branches: 0 },
+      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
+    },
+  },
+});
diff --git a/packages/testing/tenant-isolation/fixtures/registry.ts b/packages/testing/tenant-isolation/fixtures/registry.ts
new file mode 100644
index 0000000..5cbf247
--- /dev/null
+++ b/packages/testing/tenant-isolation/fixtures/registry.ts
@@ -0,0 +1,15 @@
+import type { Pool } from 'pg';
+
+export interface FixtureTenant {
+  id: string;
+  slug: string;
+  displayName: string;
+  seed: (pool: Pool, id: string) => Promise<void>;
+}
+
+const tenants: FixtureTenant[] = [];
+export const fixtureRegistry = {
+  add(t: FixtureTenant): void { tenants.push(t); },
+  list(): FixtureTenant[] { return [...tenants]; },
+  clear(): void { tenants.length = 0; },
+};
diff --git a/packages/testing/tenant-isolation/fixtures/tenant-a.ts b/packages/testing/tenant-isolation/fixtures/tenant-a.ts
new file mode 100644
index 0000000..08cebf6
--- /dev/null
+++ b/packages/testing/tenant-isolation/fixtures/tenant-a.ts
@@ -0,0 +1,30 @@
+import type { Pool } from 'pg';
+import { fixtureRegistry } from './registry';
+
+export const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
+
+fixtureRegistry.add({
+  id: TENANT_A_ID,
+  slug: 'fixture-a',
+  displayName: 'Fixture Tenant A',
+  seed: async (pool: Pool, id: string) => {
+    const c = await pool.connect();
+    try {
+      await c.query(`SET ROLE app_user`);
+      await c.query(`SET app.current_shop_id='${id}'`);
+      await c.query(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES
+          ($1,'+91AAA001','Alice A','shop_admin','ACTIVE'),
+          ($1,'+91AAA002','Akhil A','shop_staff','ACTIVE')`,
+        [id],
+      );
+      for (let i = 1; i <= 5; i++) {
+        await c.query(
+          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, $2, 'seed')`,
+          [id, `seed.a.${i}`],
+        );
+      }
+      await c.query('RESET ROLE');
+    } finally { c.release(); }
+  },
+});
diff --git a/packages/testing/tenant-isolation/fixtures/tenant-b.ts b/packages/testing/tenant-isolation/fixtures/tenant-b.ts
new file mode 100644
index 0000000..baf2a3e
--- /dev/null
+++ b/packages/testing/tenant-isolation/fixtures/tenant-b.ts
@@ -0,0 +1,30 @@
+import type { Pool } from 'pg';
+import { fixtureRegistry } from './registry';
+
+export const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
+
+fixtureRegistry.add({
+  id: TENANT_B_ID,
+  slug: 'fixture-b',
+  displayName: 'Fixture Tenant B',
+  seed: async (pool: Pool, id: string) => {
+    const c = await pool.connect();
+    try {
+      await c.query(`SET ROLE app_user`);
+      await c.query(`SET app.current_shop_id='${id}'`);
+      await c.query(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES
+          ($1,'+91BBB001','Bhavna B','shop_admin','ACTIVE'),
+          ($1,'+91BBB002','Bhim B','shop_manager','ACTIVE')`,
+        [id],
+      );
+      for (let i = 1; i <= 5; i++) {
+        await c.query(
+          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, $2, 'seed')`,
+          [id, `seed.b.${i}`],
+        );
+      }
+      await c.query('RESET ROLE');
+    } finally { c.release(); }
+  },
+});
diff --git a/packages/testing/tenant-isolation/fixtures/tenant-c.ts b/packages/testing/tenant-isolation/fixtures/tenant-c.ts
new file mode 100644
index 0000000..4776b8a
--- /dev/null
+++ b/packages/testing/tenant-isolation/fixtures/tenant-c.ts
@@ -0,0 +1,30 @@
+import type { Pool } from 'pg';
+import { fixtureRegistry } from './registry';
+
+export const TENANT_C_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
+
+fixtureRegistry.add({
+  id: TENANT_C_ID,
+  slug: 'fixture-c',
+  displayName: 'Fixture Tenant C',
+  seed: async (pool: Pool, id: string) => {
+    const c = await pool.connect();
+    try {
+      await c.query(`SET ROLE app_user`);
+      await c.query(`SET app.current_shop_id='${id}'`);
+      await c.query(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES
+          ($1,'+91CCC001','Chandra C','shop_admin','ACTIVE'),
+          ($1,'+91CCC002','Charu C','shop_staff','ACTIVE')`,
+        [id],
+      );
+      for (let i = 1; i <= 5; i++) {
+        await c.query(
+          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, $2, 'seed')`,
+          [id, `seed.c.${i}`],
+        );
+      }
+      await c.query('RESET ROLE');
+    } finally { c.release(); }
+  },
+});
diff --git a/packages/testing/tenant-isolation/package.json b/packages/testing/tenant-isolation/package.json
new file mode 100644
index 0000000..cb8ee94
--- /dev/null
+++ b/packages/testing/tenant-isolation/package.json
@@ -0,0 +1,30 @@
+{
+  "name": "@goldsmith/testing-tenant-isolation",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src test",
+    "test": "vitest run",
+    "test:tenant-isolation": "vitest run"
+  },
+  "dependencies": {
+    "@goldsmith/api": "workspace:*",
+    "@goldsmith/db": "workspace:*",
+    "@goldsmith/tenant-context": "workspace:*",
+    "pg": "^8.11.0"
+  },
+  "devDependencies": {
+    "vitest": "^1.4.0",
+    "testcontainers": "^10.8.0",
+    "@testcontainers/postgresql": "^10.8.0",
+    "@nestjs/testing": "^10.3.0",
+    "@nestjs/common": "^10.3.0",
+    "@nestjs/core": "^10.3.0",
+    "@types/pg": "^8.11.0",
+    "supertest": "^7.0.0",
+    "@types/supertest": "^6.0.0",
+    "typescript": "^5.4.0"
+  }
+}
diff --git a/packages/testing/tenant-isolation/src/endpoint-walker.ts b/packages/testing/tenant-isolation/src/endpoint-walker.ts
new file mode 100644
index 0000000..5f28a19
--- /dev/null
+++ b/packages/testing/tenant-isolation/src/endpoint-walker.ts
@@ -0,0 +1,26 @@
+// LIT-UP-IN-STORY-1.1 — in E2-S1 this walker only exercises /healthz. Story 1.1 will introduce
+// tenant-scoped endpoints and extend this walker to probe each with tenant A's ctx and assert
+// zero B/C data leakage (Acceptance Criterion #10).
+
+import { Test } from '@nestjs/testing';
+import type { INestApplication, Type } from '@nestjs/common';
+import request from 'supertest';
+
+export interface WalkResult {
+  route: string;
+  method: string;
+  status: number;
+  skipReason?: string;
+}
+
+export async function walkHealthz(appModule: Type<unknown>): Promise<WalkResult[]> {
+  const module = await Test.createTestingModule({ imports: [appModule] }).compile();
+  const app: INestApplication = module.createNestApplication();
+  await app.init();
+  try {
+    const res = await request(app.getHttpServer()).get('/healthz');
+    return [{ route: '/healthz', method: 'GET', status: res.status }];
+  } finally {
+    await app.close();
+  }
+}
diff --git a/packages/testing/tenant-isolation/src/harness.ts b/packages/testing/tenant-isolation/src/harness.ts
new file mode 100644
index 0000000..8ca37df
--- /dev/null
+++ b/packages/testing/tenant-isolation/src/harness.ts
@@ -0,0 +1,59 @@
+import type { Pool } from 'pg';
+import { tenantContext } from '@goldsmith/tenant-context';
+import { withTenantTx, tableRegistry } from '@goldsmith/db';
+import { fixtureRegistry } from '../fixtures/registry';
+import '../fixtures/tenant-a';
+import '../fixtures/tenant-b';
+import '../fixtures/tenant-c';
+
+export interface HarnessResult { ok: boolean; failures: string[]; }
+
+export async function provisionFixtures(pool: Pool): Promise<void> {
+  const c = await pool.connect();
+  try {
+    for (const t of fixtureRegistry.list()) {
+      await c.query(
+        `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE')
+         ON CONFLICT (id) DO NOTHING`,
+        [t.id, t.slug, t.displayName],
+      );
+    }
+  } finally { c.release(); }
+  for (const t of fixtureRegistry.list()) await t.seed(pool, t.id);
+}
+
+export async function runTenantIsolationHarness(pool: Pool): Promise<HarnessResult> {
+  const fails: string[] = [];
+  const tenants = fixtureRegistry.list();
+  const tenantTables = tableRegistry.list().filter((m) => m.kind === 'tenant');
+
+  for (const self of tenants) {
+    for (const meta of tenantTables) {
+      const rows = await tenantContext.runWith({ shopId: self.id } as never, () =>
+        withTenantTx(pool, async (tx) => {
+          const r = await tx.query(`SELECT shop_id FROM ${meta.name}`);
+          return r.rows as Array<{ shop_id: string }>;
+        }),
+      );
+      for (const row of rows) {
+        if (row.shop_id !== self.id) {
+          fails.push(`${self.slug}: leaked row ${row.shop_id} from ${meta.name} (invariant 13)`);
+        }
+      }
+    }
+  }
+
+  const c = await pool.connect();
+  try {
+    await c.query('SET ROLE app_user');
+    for (const meta of tenantTables) {
+      const r = await c.query(`SELECT count(*)::int AS n FROM ${meta.name}`);
+      if ((r.rows[0] as { n: number }).n !== 0) {
+        fails.push(`${meta.name}: no-ctx read returned rows (invariant 12)`);
+      }
+    }
+    await c.query('RESET ROLE');
+  } finally { c.release(); }
+
+  return { ok: fails.length === 0, failures: fails };
+}
diff --git a/packages/testing/tenant-isolation/src/index.ts b/packages/testing/tenant-isolation/src/index.ts
new file mode 100644
index 0000000..d140d5a
--- /dev/null
+++ b/packages/testing/tenant-isolation/src/index.ts
@@ -0,0 +1,6 @@
+export { assertRlsInvariants } from './schema-assertions';
+export { provisionFixtures, runTenantIsolationHarness } from './harness';
+export { fixtureRegistry } from '../fixtures/registry';
+export { TENANT_A_ID } from '../fixtures/tenant-a';
+export { TENANT_B_ID } from '../fixtures/tenant-b';
+export { TENANT_C_ID } from '../fixtures/tenant-c';
diff --git a/packages/testing/tenant-isolation/src/schema-assertions.ts b/packages/testing/tenant-isolation/src/schema-assertions.ts
new file mode 100644
index 0000000..2bf9d2f
--- /dev/null
+++ b/packages/testing/tenant-isolation/src/schema-assertions.ts
@@ -0,0 +1,61 @@
+import type { Pool } from 'pg';
+import { tableRegistry } from '@goldsmith/db';
+
+export interface AssertResult { ok: boolean; failures: string[]; }
+
+export async function assertRlsInvariants(pool: Pool): Promise<AssertResult> {
+  const fails: string[] = [];
+  const c = await pool.connect();
+  try {
+    for (const meta of tableRegistry.list()) {
+      const q = await c.query(
+        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
+          JOIN pg_namespace n ON n.oid = relnamespace
+          WHERE relname = $1 AND n.nspname = 'public'`,
+        [meta.name],
+      );
+      if (q.rowCount === 0) { fails.push(`table ${meta.name} missing`); continue; }
+      const { relrowsecurity, relforcerowsecurity } = q.rows[0] as { relrowsecurity: boolean; relforcerowsecurity: boolean };
+      if (meta.kind === 'tenant') {
+        if (!relrowsecurity) fails.push(`${meta.name}: RLS not enabled (invariant 2)`);
+        if (!relforcerowsecurity) fails.push(`${meta.name}: FORCE RLS not set (invariant 2)`);
+        const p = await c.query(`SELECT polname FROM pg_policy WHERE polrelid = to_regclass($1)`, [meta.name]);
+        if (p.rowCount === 0) fails.push(`${meta.name}: no policy (invariant 2)`);
+      } else if (meta.kind === 'global') {
+        if (relrowsecurity) fails.push(`${meta.name}: RLS enabled on platformGlobalTable (invariant 3)`);
+      }
+    }
+
+    const app = await c.query(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname='app_user'`);
+    if (app.rowCount === 0) fails.push('app_user role missing (invariant 4)');
+    else {
+      const r = app.rows[0] as { rolbypassrls: boolean; rolsuper: boolean };
+      if (r.rolbypassrls) fails.push('app_user has BYPASSRLS (invariant 4)');
+      if (r.rolsuper) fails.push('app_user has SUPERUSER (invariant 4)');
+    }
+
+    const migratorDml = await c.query(
+      `SELECT table_name, privilege_type FROM information_schema.table_privileges
+        WHERE grantee='migrator' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
+          AND table_schema='public'`,
+    );
+    for (const row of migratorDml.rows as Array<{ table_name: string; privilege_type: string }>) {
+      const meta = tableRegistry.get(row.table_name);
+      if (meta?.kind === 'tenant') {
+        fails.push(`migrator has ${row.privilege_type} on tenant table ${row.table_name} (invariant 5)`);
+      }
+    }
+
+    const auditGrants = await c.query(
+      `SELECT privilege_type FROM information_schema.table_privileges
+        WHERE grantee='app_user' AND table_name='audit_events'`,
+    );
+    const types = new Set(auditGrants.rows.map((r: { privilege_type: string }) => r.privilege_type));
+    if (!types.has('INSERT')) fails.push('app_user lacks INSERT on audit_events (invariant 11)');
+    if (types.has('UPDATE')) fails.push('app_user has UPDATE on audit_events (invariant 11)');
+    if (types.has('DELETE')) fails.push('app_user has DELETE on audit_events (invariant 11)');
+  } finally {
+    c.release();
+  }
+  return { ok: fails.length === 0, failures: fails };
+}
diff --git a/packages/testing/tenant-isolation/test/endpoint-walker.e2e.test.ts b/packages/testing/tenant-isolation/test/endpoint-walker.e2e.test.ts
new file mode 100644
index 0000000..3067074
--- /dev/null
+++ b/packages/testing/tenant-isolation/test/endpoint-walker.e2e.test.ts
@@ -0,0 +1,11 @@
+import { describe, it, expect } from 'vitest';
+import { walkHealthz } from '../src/endpoint-walker';
+import { AppModule } from '@goldsmith/api/src/app.module';
+
+describe('endpoint walker (E2-S1 scaffold)', () => {
+  it('exercises /healthz and confirms 200', async () => {
+    const res = await walkHealthz(AppModule);
+    expect(res).toHaveLength(1);
+    expect(res[0]).toMatchObject({ route: '/healthz', method: 'GET', status: 200 });
+  });
+});
diff --git a/packages/testing/tenant-isolation/test/harness.integration.test.ts b/packages/testing/tenant-isolation/test/harness.integration.test.ts
new file mode 100644
index 0000000..dcc606f
--- /dev/null
+++ b/packages/testing/tenant-isolation/test/harness.integration.test.ts
@@ -0,0 +1,26 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import { createPool, runMigrations } from '@goldsmith/db';
+import { provisionFixtures, runTenantIsolationHarness } from '../src';
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, resolve(__dirname, '../../../db/src/migrations'));
+  await provisionFixtures(pool);
+}, 120_000);
+
+afterAll(async () => { await pool?.end(); await container?.stop(); });
+
+describe('tenant-isolation harness', () => {
+  it('3 tenants isolate on every tenantScopedTable (invariants 12-13)', async () => {
+    const r = await runTenantIsolationHarness(pool);
+    if (!r.ok) console.error(r.failures);
+    expect(r.ok).toBe(true);
+  });
+});
diff --git a/packages/testing/tenant-isolation/test/schema-assertions.integration.test.ts b/packages/testing/tenant-isolation/test/schema-assertions.integration.test.ts
new file mode 100644
index 0000000..ec773c0
--- /dev/null
+++ b/packages/testing/tenant-isolation/test/schema-assertions.integration.test.ts
@@ -0,0 +1,25 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import { createPool, runMigrations } from '@goldsmith/db';
+import { assertRlsInvariants } from '../src/schema-assertions';
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, resolve(__dirname, '../../../db/src/migrations'));
+}, 60_000);
+
+afterAll(async () => { await pool?.end(); await container?.stop(); });
+
+describe('assertRlsInvariants', () => {
+  it('passes against freshly migrated schema', async () => {
+    const result = await assertRlsInvariants(pool);
+    if (!result.ok) console.error(result.failures);
+    expect(result.ok).toBe(true);
+  });
+});
diff --git a/packages/testing/tenant-isolation/tsconfig.json b/packages/testing/tenant-isolation/tsconfig.json
new file mode 100644
index 0000000..f923c93
--- /dev/null
+++ b/packages/testing/tenant-isolation/tsconfig.json
@@ -0,0 +1,9 @@
+{
+  "extends": "../../../tsconfig.base.json",
+  "compilerOptions": {
+    "experimentalDecorators": true,
+    "emitDecoratorMetadata": true,
+    "exactOptionalPropertyTypes": false
+  },
+  "include": ["src/**/*", "test/**/*", "fixtures/**/*"]
+}
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
new file mode 100644
index 0000000..e4881a6
--- /dev/null
+++ b/pnpm-lock.yaml
@@ -0,0 +1,9603 @@
+lockfileVersion: '9.0'
+
+settings:
+  autoInstallPeers: true
+  excludeLinksFromLockfile: false
+
+importers:
+
+  .:
+    devDependencies:
+      '@types/node':
+        specifier: ^20.11.0
+        version: 20.19.39
+      '@typescript-eslint/eslint-plugin':
+        specifier: ^7.0.0
+        version: 7.18.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint@8.57.1)(typescript@5.9.3)
+      '@typescript-eslint/parser':
+        specifier: ^7.0.0
+        version: 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+      '@vitest/coverage-v8':
+        specifier: ^1.4.0
+        version: 1.6.1(vitest@1.6.1(@types/node@20.19.39))
+      eslint:
+        specifier: ^8.57.0
+        version: 8.57.1
+      eslint-import-resolver-typescript:
+        specifier: ^3.6.1
+        version: 3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1)
+      eslint-plugin-import:
+        specifier: ^2.29.1
+        version: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1)
+      prettier:
+        specifier: ^3.2.5
+        version: 3.8.3
+      tsx:
+        specifier: ^4.7.0
+        version: 4.21.0
+      turbo:
+        specifier: ^2.0.0
+        version: 2.9.6
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  apps/api:
+    dependencies:
+      '@goldsmith/observability':
+        specifier: workspace:*
+        version: link:../../packages/observability
+      '@goldsmith/tenant-context':
+        specifier: workspace:*
+        version: link:../../packages/tenant-context
+      '@nestjs/common':
+        specifier: ^10.3.0
+        version: 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/core':
+        specifier: ^10.3.0
+        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/platform-express':
+        specifier: ^10.3.0
+        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)
+      reflect-metadata:
+        specifier: ^0.2.0
+        version: 0.2.2
+      rxjs:
+        specifier: ^7.8.0
+        version: 7.8.2
+    devDependencies:
+      '@nestjs/testing':
+        specifier: ^10.3.0
+        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)(@nestjs/platform-express@10.4.22)
+      '@types/express':
+        specifier: ^4.17.0
+        version: 4.17.25
+      '@types/supertest':
+        specifier: ^6.0.0
+        version: 6.0.3
+      supertest:
+        specifier: ^7.0.0
+        version: 7.2.2
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  ops/eslint-rules/goldsmith:
+    dependencies:
+      eslint:
+        specifier: ^8.57.0
+        version: 8.57.1
+    devDependencies:
+      '@typescript-eslint/parser':
+        specifier: ^7.0.0
+        version: 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+
+  packages/audit:
+    dependencies:
+      '@goldsmith/db':
+        specifier: workspace:*
+        version: link:../db
+      '@goldsmith/tenant-context':
+        specifier: workspace:*
+        version: link:../tenant-context
+      pg:
+        specifier: ^8.11.0
+        version: 8.20.0
+    devDependencies:
+      '@testcontainers/postgresql':
+        specifier: ^10.8.0
+        version: 10.28.0
+      '@types/pg':
+        specifier: ^8.11.0
+        version: 8.20.0
+      testcontainers:
+        specifier: ^10.8.0
+        version: 10.28.0
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  packages/cache:
+    dependencies:
+      '@goldsmith/tenant-context':
+        specifier: workspace:*
+        version: link:../tenant-context
+      ioredis:
+        specifier: ^5.3.0
+        version: 5.10.1
+    devDependencies:
+      '@types/ioredis-mock':
+        specifier: ^8.2.7
+        version: 8.2.7(ioredis@5.10.1)
+      ioredis-mock:
+        specifier: ^8.9.0
+        version: 8.13.1(@types/ioredis-mock@8.2.7(ioredis@5.10.1))(ioredis@5.10.1)
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  packages/crypto-envelope:
+    devDependencies:
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  packages/db:
+    dependencies:
+      '@goldsmith/observability':
+        specifier: workspace:*
+        version: link:../observability
+      '@goldsmith/tenant-context':
+        specifier: workspace:*
+        version: link:../tenant-context
+      drizzle-orm:
+        specifier: ^0.30.0
+        version: 0.30.10(@opentelemetry/api@1.9.1)(@types/pg@8.20.0)(pg@8.20.0)
+      pg:
+        specifier: ^8.11.0
+        version: 8.20.0
+    devDependencies:
+      '@testcontainers/postgresql':
+        specifier: ^10.8.0
+        version: 10.28.0
+      '@types/pg':
+        specifier: ^8.11.0
+        version: 8.20.0
+      drizzle-kit:
+        specifier: ^0.21.0
+        version: 0.21.4
+      testcontainers:
+        specifier: ^10.8.0
+        version: 10.28.0
+      tsx:
+        specifier: ^4.7.0
+        version: 4.21.0
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  packages/observability:
+    dependencies:
+      '@opentelemetry/api':
+        specifier: ^1.8.0
+        version: 1.9.1
+      '@opentelemetry/auto-instrumentations-node':
+        specifier: ^0.43.0
+        version: 0.43.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-node':
+        specifier: ^0.51.0
+        version: 0.51.1(@opentelemetry/api@1.9.1)
+      '@sentry/node':
+        specifier: ^7.109.0
+        version: 7.120.4
+      pino:
+        specifier: ^8.19.0
+        version: 8.21.0
+    devDependencies:
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  packages/queue:
+    dependencies:
+      '@goldsmith/observability':
+        specifier: workspace:*
+        version: link:../observability
+      '@goldsmith/tenant-context':
+        specifier: workspace:*
+        version: link:../tenant-context
+      bullmq:
+        specifier: ^5.7.0
+        version: 5.74.1
+    devDependencies:
+      ioredis:
+        specifier: ^5.3.0
+        version: 5.10.1
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  packages/tenant-context:
+    dependencies:
+      '@nestjs/common':
+        specifier: ^10.3.0
+        version: 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/core':
+        specifier: ^10.3.0
+        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      ioredis:
+        specifier: ^5.3.0
+        version: 5.10.1
+      reflect-metadata:
+        specifier: ^0.2.0
+        version: 0.2.2
+      rxjs:
+        specifier: ^7.8.0
+        version: 7.8.2
+    devDependencies:
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+  packages/testing/tenant-isolation:
+    dependencies:
+      '@goldsmith/api':
+        specifier: workspace:*
+        version: link:../../../apps/api
+      '@goldsmith/db':
+        specifier: workspace:*
+        version: link:../../db
+      '@goldsmith/tenant-context':
+        specifier: workspace:*
+        version: link:../../tenant-context
+      pg:
+        specifier: ^8.11.0
+        version: 8.20.0
+    devDependencies:
+      '@nestjs/common':
+        specifier: ^10.3.0
+        version: 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/core':
+        specifier: ^10.3.0
+        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/testing':
+        specifier: ^10.3.0
+        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)(@nestjs/platform-express@10.4.22)
+      '@testcontainers/postgresql':
+        specifier: ^10.8.0
+        version: 10.28.0
+      '@types/pg':
+        specifier: ^8.11.0
+        version: 8.20.0
+      '@types/supertest':
+        specifier: ^6.0.0
+        version: 6.0.3
+      supertest:
+        specifier: ^7.0.0
+        version: 7.2.2
+      testcontainers:
+        specifier: ^10.8.0
+        version: 10.28.0
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@20.19.39)
+
+packages:
+
+  '@ampproject/remapping@2.3.0':
+    resolution: {integrity: sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==}
+    engines: {node: '>=6.0.0'}
+
+  '@babel/helper-string-parser@7.27.1':
+    resolution: {integrity: sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-validator-identifier@7.28.5':
+    resolution: {integrity: sha512-qSs4ifwzKJSV39ucNjsvc6WVHs6b7S03sOh2OcHF9UHfVPqWWALUsNUVzhSBiItjRZoLHx7nIarVjqKVusUZ1Q==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/parser@7.29.2':
+    resolution: {integrity: sha512-4GgRzy/+fsBa72/RZVJmGKPmZu9Byn8o4MoLpmNe1m8ZfYnz5emHLQz3U4gLud6Zwl0RZIcgiLD7Uq7ySFuDLA==}
+    engines: {node: '>=6.0.0'}
+    hasBin: true
+
+  '@babel/types@7.29.0':
+    resolution: {integrity: sha512-LwdZHpScM4Qz8Xw2iKSzS+cfglZzJGvofQICy7W7v4caru4EaAmyUuO6BGrbyQ2mYV11W0U8j5mBhd14dd3B0A==}
+    engines: {node: '>=6.9.0'}
+
+  '@balena/dockerignore@1.0.2':
+    resolution: {integrity: sha512-wMue2Sy4GAVTk6Ic4tJVcnfdau+gx2EnG7S+uAEe+TWJFqE4YoWN4/H8MSLj4eYJKxGg26lZwboEniNiNwZQ6Q==}
+
+  '@bcoe/v8-coverage@0.2.3':
+    resolution: {integrity: sha512-0hYQ8SB4Db5zvZB4axdMHGwEaQjkZzFjQiN9LVYvIFB2nSUHW9tYpxWriPrWDASIxiaXax83REcLxuSdnGPZtw==}
+
+  '@borewit/text-codec@0.2.2':
+    resolution: {integrity: sha512-DDaRehssg1aNrH4+2hnj1B7vnUGEjU6OIlyRdkMd0aUdIUvKXrJfXsy8LVtXAy7DRvYVluWbMspsRhz2lcW0mQ==}
+
+  '@emnapi/core@1.10.0':
+    resolution: {integrity: sha512-yq6OkJ4p82CAfPl0u9mQebQHKPJkY7WrIuk205cTYnYe+k2Z8YBh11FrbRG/H6ihirqcacOgl2BIO8oyMQLeXw==}
+
+  '@emnapi/runtime@1.10.0':
+    resolution: {integrity: sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==}
+
+  '@emnapi/wasi-threads@1.2.1':
+    resolution: {integrity: sha512-uTII7OYF+/Mes/MrcIOYp5yOtSMLBWSIoLPpcgwipoiKbli6k322tcoFsxoIIxPDqW01SQGAgko4EzZi2BNv2w==}
+
+  '@esbuild-kit/core-utils@3.3.2':
+    resolution: {integrity: sha512-sPRAnw9CdSsRmEtnsl2WXWdyquogVpB3yZ3dgwJfe8zrOzTsV7cJvmwrKVa+0ma5BoiGJ+BoqkMvawbayKUsqQ==}
+    deprecated: 'Merged into tsx: https://tsx.is'
+
+  '@esbuild-kit/esm-loader@2.6.5':
+    resolution: {integrity: sha512-FxEMIkJKnodyA1OaCUoEvbYRkoZlLZ4d/eXFu9Fh8CbBBgP5EmZxrfTRyN0qpXZ4vOvqnE5YdRdcrmUUXuU+dA==}
+    deprecated: 'Merged into tsx: https://tsx.is'
+
+  '@esbuild/aix-ppc64@0.19.12':
+    resolution: {integrity: sha512-bmoCYyWdEL3wDQIVbcyzRyeKLgk2WtWLTWz1ZIAZF/EGbNOwSA6ew3PftJ1PqMiOOGu0OyFMzG53L0zqIpPeNA==}
+    engines: {node: '>=12'}
+    cpu: [ppc64]
+    os: [aix]
+
+  '@esbuild/aix-ppc64@0.21.5':
+    resolution: {integrity: sha512-1SDgH6ZSPTlggy1yI6+Dbkiz8xzpHJEVAlF/AM1tHPLsf5STom9rwtjE4hKAF20FfXXNTFqEYXyJNWh1GiZedQ==}
+    engines: {node: '>=12'}
+    cpu: [ppc64]
+    os: [aix]
+
+  '@esbuild/aix-ppc64@0.27.7':
+    resolution: {integrity: sha512-EKX3Qwmhz1eMdEJokhALr0YiD0lhQNwDqkPYyPhiSwKrh7/4KRjQc04sZ8db+5DVVnZ1LmbNDI1uAMPEUBnQPg==}
+    engines: {node: '>=18'}
+    cpu: [ppc64]
+    os: [aix]
+
+  '@esbuild/android-arm64@0.18.20':
+    resolution: {integrity: sha512-Nz4rJcchGDtENV0eMKUNa6L12zz2zBDXuhj/Vjh18zGqB44Bi7MBMSXjgunJgjRhCmKOjnPuZp4Mb6OKqtMHLQ==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [android]
+
+  '@esbuild/android-arm64@0.19.12':
+    resolution: {integrity: sha512-P0UVNGIienjZv3f5zq0DP3Nt2IE/3plFzuaS96vihvD0Hd6H/q4WXUGpCxD/E8YrSXfNyRPbpTq+T8ZQioSuPA==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [android]
+
+  '@esbuild/android-arm64@0.21.5':
+    resolution: {integrity: sha512-c0uX9VAUBQ7dTDCjq+wdyGLowMdtR/GoC2U5IYk/7D1H1JYC0qseD7+11iMP2mRLN9RcCMRcjC4YMclCzGwS/A==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [android]
+
+  '@esbuild/android-arm64@0.27.7':
+    resolution: {integrity: sha512-62dPZHpIXzvChfvfLJow3q5dDtiNMkwiRzPylSCfriLvZeq0a1bWChrGx/BbUbPwOrsWKMn8idSllklzBy+dgQ==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [android]
+
+  '@esbuild/android-arm@0.18.20':
+    resolution: {integrity: sha512-fyi7TDI/ijKKNZTUJAQqiG5T7YjJXgnzkURqmGj13C6dCqckZBLdl4h7bkhHt/t0WP+zO9/zwroDvANaOqO5Sw==}
+    engines: {node: '>=12'}
+    cpu: [arm]
+    os: [android]
+
+  '@esbuild/android-arm@0.19.12':
+    resolution: {integrity: sha512-qg/Lj1mu3CdQlDEEiWrlC4eaPZ1KztwGJ9B6J+/6G+/4ewxJg7gqj8eVYWvao1bXrqGiW2rsBZFSX3q2lcW05w==}
+    engines: {node: '>=12'}
+    cpu: [arm]
+    os: [android]
+
+  '@esbuild/android-arm@0.21.5':
+    resolution: {integrity: sha512-vCPvzSjpPHEi1siZdlvAlsPxXl7WbOVUBBAowWug4rJHb68Ox8KualB+1ocNvT5fjv6wpkX6o/iEpbDrf68zcg==}
+    engines: {node: '>=12'}
+    cpu: [arm]
+    os: [android]
+
+  '@esbuild/android-arm@0.27.7':
+    resolution: {integrity: sha512-jbPXvB4Yj2yBV7HUfE2KHe4GJX51QplCN1pGbYjvsyCZbQmies29EoJbkEc+vYuU5o45AfQn37vZlyXy4YJ8RQ==}
+    engines: {node: '>=18'}
+    cpu: [arm]
+    os: [android]
+
+  '@esbuild/android-x64@0.18.20':
+    resolution: {integrity: sha512-8GDdlePJA8D6zlZYJV/jnrRAi6rOiNaCC/JclcXpB+KIuvfBN4owLtgzY2bsxnx666XjJx2kDPUmnTtR8qKQUg==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [android]
+
+  '@esbuild/android-x64@0.19.12':
+    resolution: {integrity: sha512-3k7ZoUW6Q6YqhdhIaq/WZ7HwBpnFBlW905Fa4s4qWJyiNOgT1dOqDiVAQFwBH7gBRZr17gLrlFCRzF6jFh7Kew==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [android]
+
+  '@esbuild/android-x64@0.21.5':
+    resolution: {integrity: sha512-D7aPRUUNHRBwHxzxRvp856rjUHRFW1SdQATKXH2hqA0kAZb1hKmi02OpYRacl0TxIGz/ZmXWlbZgjwWYaCakTA==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [android]
+
+  '@esbuild/android-x64@0.27.7':
+    resolution: {integrity: sha512-x5VpMODneVDb70PYV2VQOmIUUiBtY3D3mPBG8NxVk5CogneYhkR7MmM3yR/uMdITLrC1ml/NV1rj4bMJuy9MCg==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [android]
+
+  '@esbuild/darwin-arm64@0.18.20':
+    resolution: {integrity: sha512-bxRHW5kHU38zS2lPTPOyuyTm+S+eobPUnTNkdJEfAddYgEcll4xkT8DB9d2008DtTbl7uJag2HuE5NZAZgnNEA==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@esbuild/darwin-arm64@0.19.12':
+    resolution: {integrity: sha512-B6IeSgZgtEzGC42jsI+YYu9Z3HKRxp8ZT3cqhvliEHovq8HSX2YX8lNocDn79gCKJXOSaEot9MVYky7AKjCs8g==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@esbuild/darwin-arm64@0.21.5':
+    resolution: {integrity: sha512-DwqXqZyuk5AiWWf3UfLiRDJ5EDd49zg6O9wclZ7kUMv2WRFr4HKjXp/5t8JZ11QbQfUS6/cRCKGwYhtNAY88kQ==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@esbuild/darwin-arm64@0.27.7':
+    resolution: {integrity: sha512-5lckdqeuBPlKUwvoCXIgI2D9/ABmPq3Rdp7IfL70393YgaASt7tbju3Ac+ePVi3KDH6N2RqePfHnXkaDtY9fkw==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@esbuild/darwin-x64@0.18.20':
+    resolution: {integrity: sha512-pc5gxlMDxzm513qPGbCbDukOdsGtKhfxD1zJKXjCCcU7ju50O7MeAZ8c4krSJcOIJGFR+qx21yMMVYwiQvyTyQ==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [darwin]
+
+  '@esbuild/darwin-x64@0.19.12':
+    resolution: {integrity: sha512-hKoVkKzFiToTgn+41qGhsUJXFlIjxI/jSYeZf3ugemDYZldIXIxhvwN6erJGlX4t5h417iFuheZ7l+YVn05N3A==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [darwin]
+
+  '@esbuild/darwin-x64@0.21.5':
+    resolution: {integrity: sha512-se/JjF8NlmKVG4kNIuyWMV/22ZaerB+qaSi5MdrXtd6R08kvs2qCN4C09miupktDitvh8jRFflwGFBQcxZRjbw==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [darwin]
+
+  '@esbuild/darwin-x64@0.27.7':
+    resolution: {integrity: sha512-rYnXrKcXuT7Z+WL5K980jVFdvVKhCHhUwid+dDYQpH+qu+TefcomiMAJpIiC2EM3Rjtq0sO3StMV/+3w3MyyqQ==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [darwin]
+
+  '@esbuild/freebsd-arm64@0.18.20':
+    resolution: {integrity: sha512-yqDQHy4QHevpMAaxhhIwYPMv1NECwOvIpGCZkECn8w2WFHXjEwrBn3CeNIYsibZ/iZEUemj++M26W3cNR5h+Tw==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [freebsd]
+
+  '@esbuild/freebsd-arm64@0.19.12':
+    resolution: {integrity: sha512-4aRvFIXmwAcDBw9AueDQ2YnGmz5L6obe5kmPT8Vd+/+x/JMVKCgdcRwH6APrbpNXsPz+K653Qg8HB/oXvXVukA==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [freebsd]
+
+  '@esbuild/freebsd-arm64@0.21.5':
+    resolution: {integrity: sha512-5JcRxxRDUJLX8JXp/wcBCy3pENnCgBR9bN6JsY4OmhfUtIHe3ZW0mawA7+RDAcMLrMIZaf03NlQiX9DGyB8h4g==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [freebsd]
+
+  '@esbuild/freebsd-arm64@0.27.7':
+    resolution: {integrity: sha512-B48PqeCsEgOtzME2GbNM2roU29AMTuOIN91dsMO30t+Ydis3z/3Ngoj5hhnsOSSwNzS+6JppqWsuhTp6E82l2w==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [freebsd]
+
+  '@esbuild/freebsd-x64@0.18.20':
+    resolution: {integrity: sha512-tgWRPPuQsd3RmBZwarGVHZQvtzfEBOreNuxEMKFcd5DaDn2PbBxfwLcj4+aenoh7ctXcbXmOQIn8HI6mCSw5MQ==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@esbuild/freebsd-x64@0.19.12':
+    resolution: {integrity: sha512-EYoXZ4d8xtBoVN7CEwWY2IN4ho76xjYXqSXMNccFSx2lgqOG/1TBPW0yPx1bJZk94qu3tX0fycJeeQsKovA8gg==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@esbuild/freebsd-x64@0.21.5':
+    resolution: {integrity: sha512-J95kNBj1zkbMXtHVH29bBriQygMXqoVQOQYA+ISs0/2l3T9/kj42ow2mpqerRBxDJnmkUDCaQT/dfNXWX/ZZCQ==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@esbuild/freebsd-x64@0.27.7':
+    resolution: {integrity: sha512-jOBDK5XEjA4m5IJK3bpAQF9/Lelu/Z9ZcdhTRLf4cajlB+8VEhFFRjWgfy3M1O4rO2GQ/b2dLwCUGpiF/eATNQ==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@esbuild/linux-arm64@0.18.20':
+    resolution: {integrity: sha512-2YbscF+UL7SQAVIpnWvYwM+3LskyDmPhe31pE7/aoTMFKKzIc9lLbyGUpmmb8a8AixOL61sQ/mFh3jEjHYFvdA==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [linux]
+
+  '@esbuild/linux-arm64@0.19.12':
+    resolution: {integrity: sha512-EoTjyYyLuVPfdPLsGVVVC8a0p1BFFvtpQDB/YLEhaXyf/5bczaGeN15QkR+O4S5LeJ92Tqotve7i1jn35qwvdA==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [linux]
+
+  '@esbuild/linux-arm64@0.21.5':
+    resolution: {integrity: sha512-ibKvmyYzKsBeX8d8I7MH/TMfWDXBF3db4qM6sy+7re0YXya+K1cem3on9XgdT2EQGMu4hQyZhan7TeQ8XkGp4Q==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [linux]
+
+  '@esbuild/linux-arm64@0.27.7':
+    resolution: {integrity: sha512-RZPHBoxXuNnPQO9rvjh5jdkRmVizktkT7TCDkDmQ0W2SwHInKCAV95GRuvdSvA7w4VMwfCjUiPwDi0ZO6Nfe9A==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [linux]
+
+  '@esbuild/linux-arm@0.18.20':
+    resolution: {integrity: sha512-/5bHkMWnq1EgKr1V+Ybz3s1hWXok7mDFUMQ4cG10AfW3wL02PSZi5kFpYKrptDsgb2WAJIvRcDm+qIvXf/apvg==}
+    engines: {node: '>=12'}
+    cpu: [arm]
+    os: [linux]
+
+  '@esbuild/linux-arm@0.19.12':
+    resolution: {integrity: sha512-J5jPms//KhSNv+LO1S1TX1UWp1ucM6N6XuL6ITdKWElCu8wXP72l9MM0zDTzzeikVyqFE6U8YAV9/tFyj0ti+w==}
+    engines: {node: '>=12'}
+    cpu: [arm]
+    os: [linux]
+
+  '@esbuild/linux-arm@0.21.5':
+    resolution: {integrity: sha512-bPb5AHZtbeNGjCKVZ9UGqGwo8EUu4cLq68E95A53KlxAPRmUyYv2D6F0uUI65XisGOL1hBP5mTronbgo+0bFcA==}
+    engines: {node: '>=12'}
+    cpu: [arm]
+    os: [linux]
+
+  '@esbuild/linux-arm@0.27.7':
+    resolution: {integrity: sha512-RkT/YXYBTSULo3+af8Ib0ykH8u2MBh57o7q/DAs3lTJlyVQkgQvlrPTnjIzzRPQyavxtPtfg0EopvDyIt0j1rA==}
+    engines: {node: '>=18'}
+    cpu: [arm]
+    os: [linux]
+
+  '@esbuild/linux-ia32@0.18.20':
+    resolution: {integrity: sha512-P4etWwq6IsReT0E1KHU40bOnzMHoH73aXp96Fs8TIT6z9Hu8G6+0SHSw9i2isWrD2nbx2qo5yUqACgdfVGx7TA==}
+    engines: {node: '>=12'}
+    cpu: [ia32]
+    os: [linux]
+
+  '@esbuild/linux-ia32@0.19.12':
+    resolution: {integrity: sha512-Thsa42rrP1+UIGaWz47uydHSBOgTUnwBwNq59khgIwktK6x60Hivfbux9iNR0eHCHzOLjLMLfUMLCypBkZXMHA==}
+    engines: {node: '>=12'}
+    cpu: [ia32]
+    os: [linux]
+
+  '@esbuild/linux-ia32@0.21.5':
+    resolution: {integrity: sha512-YvjXDqLRqPDl2dvRODYmmhz4rPeVKYvppfGYKSNGdyZkA01046pLWyRKKI3ax8fbJoK5QbxblURkwK/MWY18Tg==}
+    engines: {node: '>=12'}
+    cpu: [ia32]
+    os: [linux]
+
+  '@esbuild/linux-ia32@0.27.7':
+    resolution: {integrity: sha512-GA48aKNkyQDbd3KtkplYWT102C5sn/EZTY4XROkxONgruHPU72l+gW+FfF8tf2cFjeHaRbWpOYa/uRBz/Xq1Pg==}
+    engines: {node: '>=18'}
+    cpu: [ia32]
+    os: [linux]
+
+  '@esbuild/linux-loong64@0.18.20':
+    resolution: {integrity: sha512-nXW8nqBTrOpDLPgPY9uV+/1DjxoQ7DoB2N8eocyq8I9XuqJ7BiAMDMf9n1xZM9TgW0J8zrquIb/A7s3BJv7rjg==}
+    engines: {node: '>=12'}
+    cpu: [loong64]
+    os: [linux]
+
+  '@esbuild/linux-loong64@0.19.12':
+    resolution: {integrity: sha512-LiXdXA0s3IqRRjm6rV6XaWATScKAXjI4R4LoDlvO7+yQqFdlr1Bax62sRwkVvRIrwXxvtYEHHI4dm50jAXkuAA==}
+    engines: {node: '>=12'}
+    cpu: [loong64]
+    os: [linux]
+
+  '@esbuild/linux-loong64@0.21.5':
+    resolution: {integrity: sha512-uHf1BmMG8qEvzdrzAqg2SIG/02+4/DHB6a9Kbya0XDvwDEKCoC8ZRWI5JJvNdUjtciBGFQ5PuBlpEOXQj+JQSg==}
+    engines: {node: '>=12'}
+    cpu: [loong64]
+    os: [linux]
+
+  '@esbuild/linux-loong64@0.27.7':
+    resolution: {integrity: sha512-a4POruNM2oWsD4WKvBSEKGIiWQF8fZOAsycHOt6JBpZ+JN2n2JH9WAv56SOyu9X5IqAjqSIPTaJkqN8F7XOQ5Q==}
+    engines: {node: '>=18'}
+    cpu: [loong64]
+    os: [linux]
+
+  '@esbuild/linux-mips64el@0.18.20':
+    resolution: {integrity: sha512-d5NeaXZcHp8PzYy5VnXV3VSd2D328Zb+9dEq5HE6bw6+N86JVPExrA6O68OPwobntbNJ0pzCpUFZTo3w0GyetQ==}
+    engines: {node: '>=12'}
+    cpu: [mips64el]
+    os: [linux]
+
+  '@esbuild/linux-mips64el@0.19.12':
+    resolution: {integrity: sha512-fEnAuj5VGTanfJ07ff0gOA6IPsvrVHLVb6Lyd1g2/ed67oU1eFzL0r9WL7ZzscD+/N6i3dWumGE1Un4f7Amf+w==}
+    engines: {node: '>=12'}
+    cpu: [mips64el]
+    os: [linux]
+
+  '@esbuild/linux-mips64el@0.21.5':
+    resolution: {integrity: sha512-IajOmO+KJK23bj52dFSNCMsz1QP1DqM6cwLUv3W1QwyxkyIWecfafnI555fvSGqEKwjMXVLokcV5ygHW5b3Jbg==}
+    engines: {node: '>=12'}
+    cpu: [mips64el]
+    os: [linux]
+
+  '@esbuild/linux-mips64el@0.27.7':
+    resolution: {integrity: sha512-KabT5I6StirGfIz0FMgl1I+R1H73Gp0ofL9A3nG3i/cYFJzKHhouBV5VWK1CSgKvVaG4q1RNpCTR2LuTVB3fIw==}
+    engines: {node: '>=18'}
+    cpu: [mips64el]
+    os: [linux]
+
+  '@esbuild/linux-ppc64@0.18.20':
+    resolution: {integrity: sha512-WHPyeScRNcmANnLQkq6AfyXRFr5D6N2sKgkFo2FqguP44Nw2eyDlbTdZwd9GYk98DZG9QItIiTlFLHJHjxP3FA==}
+    engines: {node: '>=12'}
+    cpu: [ppc64]
+    os: [linux]
+
+  '@esbuild/linux-ppc64@0.19.12':
+    resolution: {integrity: sha512-nYJA2/QPimDQOh1rKWedNOe3Gfc8PabU7HT3iXWtNUbRzXS9+vgB0Fjaqr//XNbd82mCxHzik2qotuI89cfixg==}
+    engines: {node: '>=12'}
+    cpu: [ppc64]
+    os: [linux]
+
+  '@esbuild/linux-ppc64@0.21.5':
+    resolution: {integrity: sha512-1hHV/Z4OEfMwpLO8rp7CvlhBDnjsC3CttJXIhBi+5Aj5r+MBvy4egg7wCbe//hSsT+RvDAG7s81tAvpL2XAE4w==}
+    engines: {node: '>=12'}
+    cpu: [ppc64]
+    os: [linux]
+
+  '@esbuild/linux-ppc64@0.27.7':
+    resolution: {integrity: sha512-gRsL4x6wsGHGRqhtI+ifpN/vpOFTQtnbsupUF5R5YTAg+y/lKelYR1hXbnBdzDjGbMYjVJLJTd2OFmMewAgwlQ==}
+    engines: {node: '>=18'}
+    cpu: [ppc64]
+    os: [linux]
+
+  '@esbuild/linux-riscv64@0.18.20':
+    resolution: {integrity: sha512-WSxo6h5ecI5XH34KC7w5veNnKkju3zBRLEQNY7mv5mtBmrP/MjNBCAlsM2u5hDBlS3NGcTQpoBvRzqBcRtpq1A==}
+    engines: {node: '>=12'}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@esbuild/linux-riscv64@0.19.12':
+    resolution: {integrity: sha512-2MueBrlPQCw5dVJJpQdUYgeqIzDQgw3QtiAHUC4RBz9FXPrskyyU3VI1hw7C0BSKB9OduwSJ79FTCqtGMWqJHg==}
+    engines: {node: '>=12'}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@esbuild/linux-riscv64@0.21.5':
+    resolution: {integrity: sha512-2HdXDMd9GMgTGrPWnJzP2ALSokE/0O5HhTUvWIbD3YdjME8JwvSCnNGBnTThKGEB91OZhzrJ4qIIxk/SBmyDDA==}
+    engines: {node: '>=12'}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@esbuild/linux-riscv64@0.27.7':
+    resolution: {integrity: sha512-hL25LbxO1QOngGzu2U5xeXtxXcW+/GvMN3ejANqXkxZ/opySAZMrc+9LY/WyjAan41unrR3YrmtTsUpwT66InQ==}
+    engines: {node: '>=18'}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@esbuild/linux-s390x@0.18.20':
+    resolution: {integrity: sha512-+8231GMs3mAEth6Ja1iK0a1sQ3ohfcpzpRLH8uuc5/KVDFneH6jtAJLFGafpzpMRO6DzJ6AvXKze9LfFMrIHVQ==}
+    engines: {node: '>=12'}
+    cpu: [s390x]
+    os: [linux]
+
+  '@esbuild/linux-s390x@0.19.12':
+    resolution: {integrity: sha512-+Pil1Nv3Umes4m3AZKqA2anfhJiVmNCYkPchwFJNEJN5QxmTs1uzyy4TvmDrCRNT2ApwSari7ZIgrPeUx4UZDg==}
+    engines: {node: '>=12'}
+    cpu: [s390x]
+    os: [linux]
+
+  '@esbuild/linux-s390x@0.21.5':
+    resolution: {integrity: sha512-zus5sxzqBJD3eXxwvjN1yQkRepANgxE9lgOW2qLnmr8ikMTphkjgXu1HR01K4FJg8h1kEEDAqDcZQtbrRnB41A==}
+    engines: {node: '>=12'}
+    cpu: [s390x]
+    os: [linux]
+
+  '@esbuild/linux-s390x@0.27.7':
+    resolution: {integrity: sha512-2k8go8Ycu1Kb46vEelhu1vqEP+UeRVj2zY1pSuPdgvbd5ykAw82Lrro28vXUrRmzEsUV0NzCf54yARIK8r0fdw==}
+    engines: {node: '>=18'}
+    cpu: [s390x]
+    os: [linux]
+
+  '@esbuild/linux-x64@0.18.20':
+    resolution: {integrity: sha512-UYqiqemphJcNsFEskc73jQ7B9jgwjWrSayxawS6UVFZGWrAAtkzjxSqnoclCXxWtfwLdzU+vTpcNYhpn43uP1w==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [linux]
+
+  '@esbuild/linux-x64@0.19.12':
+    resolution: {integrity: sha512-B71g1QpxfwBvNrfyJdVDexenDIt1CiDN1TIXLbhOw0KhJzE78KIFGX6OJ9MrtC0oOqMWf+0xop4qEU8JrJTwCg==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [linux]
+
+  '@esbuild/linux-x64@0.21.5':
+    resolution: {integrity: sha512-1rYdTpyv03iycF1+BhzrzQJCdOuAOtaqHTWJZCWvijKD2N5Xu0TtVC8/+1faWqcP9iBCWOmjmhoH94dH82BxPQ==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [linux]
+
+  '@esbuild/linux-x64@0.27.7':
+    resolution: {integrity: sha512-hzznmADPt+OmsYzw1EE33ccA+HPdIqiCRq7cQeL1Jlq2gb1+OyWBkMCrYGBJ+sxVzve2ZJEVeePbLM2iEIZSxA==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [linux]
+
+  '@esbuild/netbsd-arm64@0.27.7':
+    resolution: {integrity: sha512-b6pqtrQdigZBwZxAn1UpazEisvwaIDvdbMbmrly7cDTMFnw/+3lVxxCTGOrkPVnsYIosJJXAsILG9XcQS+Yu6w==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [netbsd]
+
+  '@esbuild/netbsd-x64@0.18.20':
+    resolution: {integrity: sha512-iO1c++VP6xUBUmltHZoMtCUdPlnPGdBom6IrO4gyKPFFVBKioIImVooR5I83nTew5UOYrk3gIJhbZh8X44y06A==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [netbsd]
+
+  '@esbuild/netbsd-x64@0.19.12':
+    resolution: {integrity: sha512-3ltjQ7n1owJgFbuC61Oj++XhtzmymoCihNFgT84UAmJnxJfm4sYCiSLTXZtE00VWYpPMYc+ZQmB6xbSdVh0JWA==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [netbsd]
+
+  '@esbuild/netbsd-x64@0.21.5':
+    resolution: {integrity: sha512-Woi2MXzXjMULccIwMnLciyZH4nCIMpWQAs049KEeMvOcNADVxo0UBIQPfSmxB3CWKedngg7sWZdLvLczpe0tLg==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [netbsd]
+
+  '@esbuild/netbsd-x64@0.27.7':
+    resolution: {integrity: sha512-OfatkLojr6U+WN5EDYuoQhtM+1xco+/6FSzJJnuWiUw5eVcicbyK3dq5EeV/QHT1uy6GoDhGbFpprUiHUYggrw==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [netbsd]
+
+  '@esbuild/openbsd-arm64@0.27.7':
+    resolution: {integrity: sha512-AFuojMQTxAz75Fo8idVcqoQWEHIXFRbOc1TrVcFSgCZtQfSdc1RXgB3tjOn/krRHENUB4j00bfGjyl2mJrU37A==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [openbsd]
+
+  '@esbuild/openbsd-x64@0.18.20':
+    resolution: {integrity: sha512-e5e4YSsuQfX4cxcygw/UCPIEP6wbIL+se3sxPdCiMbFLBWu0eiZOJ7WoD+ptCLrmjZBK1Wk7I6D/I3NglUGOxg==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [openbsd]
+
+  '@esbuild/openbsd-x64@0.19.12':
+    resolution: {integrity: sha512-RbrfTB9SWsr0kWmb9srfF+L933uMDdu9BIzdA7os2t0TXhCRjrQyCeOt6wVxr79CKD4c+p+YhCj31HBkYcXebw==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [openbsd]
+
+  '@esbuild/openbsd-x64@0.21.5':
+    resolution: {integrity: sha512-HLNNw99xsvx12lFBUwoT8EVCsSvRNDVxNpjZ7bPn947b8gJPzeHWyNVhFsaerc0n3TsbOINvRP2byTZ5LKezow==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [openbsd]
+
+  '@esbuild/openbsd-x64@0.27.7':
+    resolution: {integrity: sha512-+A1NJmfM8WNDv5CLVQYJ5PshuRm/4cI6WMZRg1by1GwPIQPCTs1GLEUHwiiQGT5zDdyLiRM/l1G0Pv54gvtKIg==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [openbsd]
+
+  '@esbuild/openharmony-arm64@0.27.7':
+    resolution: {integrity: sha512-+KrvYb/C8zA9CU/g0sR6w2RBw7IGc5J2BPnc3dYc5VJxHCSF1yNMxTV5LQ7GuKteQXZtspjFbiuW5/dOj7H4Yw==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [openharmony]
+
+  '@esbuild/sunos-x64@0.18.20':
+    resolution: {integrity: sha512-kDbFRFp0YpTQVVrqUd5FTYmWo45zGaXe0X8E1G/LKFC0v8x0vWrhOWSLITcCn63lmZIxfOMXtCfti/RxN/0wnQ==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [sunos]
+
+  '@esbuild/sunos-x64@0.19.12':
+    resolution: {integrity: sha512-HKjJwRrW8uWtCQnQOz9qcU3mUZhTUQvi56Q8DPTLLB+DawoiQdjsYq+j+D3s9I8VFtDr+F9CjgXKKC4ss89IeA==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [sunos]
+
+  '@esbuild/sunos-x64@0.21.5':
+    resolution: {integrity: sha512-6+gjmFpfy0BHU5Tpptkuh8+uw3mnrvgs+dSPQXQOv3ekbordwnzTVEb4qnIvQcYXq6gzkyTnoZ9dZG+D4garKg==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [sunos]
+
+  '@esbuild/sunos-x64@0.27.7':
+    resolution: {integrity: sha512-ikktIhFBzQNt/QDyOL580ti9+5mL/YZeUPKU2ivGtGjdTYoqz6jObj6nOMfhASpS4GU4Q/Clh1QtxWAvcYKamA==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [sunos]
+
+  '@esbuild/win32-arm64@0.18.20':
+    resolution: {integrity: sha512-ddYFR6ItYgoaq4v4JmQQaAI5s7npztfV4Ag6NrhiaW0RrnOXqBkgwZLofVTlq1daVTQNhtI5oieTvkRPfZrePg==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [win32]
+
+  '@esbuild/win32-arm64@0.19.12':
+    resolution: {integrity: sha512-URgtR1dJnmGvX864pn1B2YUYNzjmXkuJOIqG2HdU62MVS4EHpU2946OZoTMnRUHklGtJdJZ33QfzdjGACXhn1A==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [win32]
+
+  '@esbuild/win32-arm64@0.21.5':
+    resolution: {integrity: sha512-Z0gOTd75VvXqyq7nsl93zwahcTROgqvuAcYDUr+vOv8uHhNSKROyU961kgtCD1e95IqPKSQKH7tBTslnS3tA8A==}
+    engines: {node: '>=12'}
+    cpu: [arm64]
+    os: [win32]
+
+  '@esbuild/win32-arm64@0.27.7':
+    resolution: {integrity: sha512-7yRhbHvPqSpRUV7Q20VuDwbjW5kIMwTHpptuUzV+AA46kiPze5Z7qgt6CLCK3pWFrHeNfDd1VKgyP4O+ng17CA==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [win32]
+
+  '@esbuild/win32-ia32@0.18.20':
+    resolution: {integrity: sha512-Wv7QBi3ID/rROT08SABTS7eV4hX26sVduqDOTe1MvGMjNd3EjOz4b7zeexIR62GTIEKrfJXKL9LFxTYgkyeu7g==}
+    engines: {node: '>=12'}
+    cpu: [ia32]
+    os: [win32]
+
+  '@esbuild/win32-ia32@0.19.12':
+    resolution: {integrity: sha512-+ZOE6pUkMOJfmxmBZElNOx72NKpIa/HFOMGzu8fqzQJ5kgf6aTGrcJaFsNiVMH4JKpMipyK+7k0n2UXN7a8YKQ==}
+    engines: {node: '>=12'}
+    cpu: [ia32]
+    os: [win32]
+
+  '@esbuild/win32-ia32@0.21.5':
+    resolution: {integrity: sha512-SWXFF1CL2RVNMaVs+BBClwtfZSvDgtL//G/smwAc5oVK/UPu2Gu9tIaRgFmYFFKrmg3SyAjSrElf0TiJ1v8fYA==}
+    engines: {node: '>=12'}
+    cpu: [ia32]
+    os: [win32]
+
+  '@esbuild/win32-ia32@0.27.7':
+    resolution: {integrity: sha512-SmwKXe6VHIyZYbBLJrhOoCJRB/Z1tckzmgTLfFYOfpMAx63BJEaL9ExI8x7v0oAO3Zh6D/Oi1gVxEYr5oUCFhw==}
+    engines: {node: '>=18'}
+    cpu: [ia32]
+    os: [win32]
+
+  '@esbuild/win32-x64@0.18.20':
+    resolution: {integrity: sha512-kTdfRcSiDfQca/y9QIkng02avJ+NCaQvrMejlsB3RRv5sE9rRoeBPISaZpKxHELzRxZyLvNts1P27W3wV+8geQ==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [win32]
+
+  '@esbuild/win32-x64@0.19.12':
+    resolution: {integrity: sha512-T1QyPSDCyMXaO3pzBkF96E8xMkiRYbUEZADd29SyPGabqxMViNoii+NcK7eWJAEoU6RZyEm5lVSIjTmcdoB9HA==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [win32]
+
+  '@esbuild/win32-x64@0.21.5':
+    resolution: {integrity: sha512-tQd/1efJuzPC6rCFwEvLtci/xNFcTZknmXs98FYDfGE4wP9ClFV98nyKrzJKVPMhdDnjzLhdUyMX4PsQAPjwIw==}
+    engines: {node: '>=12'}
+    cpu: [x64]
+    os: [win32]
+
+  '@esbuild/win32-x64@0.27.7':
+    resolution: {integrity: sha512-56hiAJPhwQ1R4i+21FVF7V8kSD5zZTdHcVuRFMW0hn753vVfQN8xlx4uOPT4xoGH0Z/oVATuR82AiqSTDIpaHg==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [win32]
+
+  '@eslint-community/eslint-utils@4.9.1':
+    resolution: {integrity: sha512-phrYmNiYppR7znFEdqgfWHXR6NCkZEK7hwWDHZUjit/2/U0r6XvkDl0SYnoM51Hq7FhCGdLDT6zxCCOY1hexsQ==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+    peerDependencies:
+      eslint: ^6.0.0 || ^7.0.0 || >=8.0.0
+
+  '@eslint-community/regexpp@4.12.2':
+    resolution: {integrity: sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==}
+    engines: {node: ^12.0.0 || ^14.0.0 || >=16.0.0}
+
+  '@eslint/eslintrc@2.1.4':
+    resolution: {integrity: sha512-269Z39MS6wVJtsoUl10L60WdkhJVdPG24Q4eZTH3nnF6lpvSShEK3wQjDX9JRWAUPvPh7COouPpU9IrqaZFvtQ==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+
+  '@eslint/js@8.57.1':
+    resolution: {integrity: sha512-d9zaMRSTIKDLhctzH12MtXvJKSSUhaHcjV+2Z+GK+EEY7XKpP5yR4x+N3TAcHTcu963nIr+TMcCb4DBCYX1z6Q==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+
+  '@fastify/busboy@2.1.1':
+    resolution: {integrity: sha512-vBZP4NlzfOlerQTnba4aqZoMhE/a9HY7HRqoOPaETQcSQuWEIyZMHGfVu6w9wGtGK5fED5qRs2DteVCjOH60sA==}
+    engines: {node: '>=14'}
+
+  '@grpc/grpc-js@1.14.3':
+    resolution: {integrity: sha512-Iq8QQQ/7X3Sac15oB6p0FmUg/klxQvXLeileoqrTRGJYLV+/9tubbr9ipz0GKHjmXVsgFPo/+W+2cA8eNcR+XA==}
+    engines: {node: '>=12.10.0'}
+
+  '@grpc/proto-loader@0.7.15':
+    resolution: {integrity: sha512-tMXdRCfYVixjuFK+Hk0Q1s38gV9zDiDJfWL3h1rv4Qc39oILCu1TRTDt7+fGUI8K4G1Fj125Hx/ru3azECWTyQ==}
+    engines: {node: '>=6'}
+    hasBin: true
+
+  '@grpc/proto-loader@0.8.0':
+    resolution: {integrity: sha512-rc1hOQtjIWGxcxpb9aHAfLpIctjEnsDehj0DAiVfBlmT84uvR0uUtN2hEi/ecvWVjXUGf5qPF4qEgiLOx1YIMQ==}
+    engines: {node: '>=6'}
+    hasBin: true
+
+  '@hapi/b64@5.0.0':
+    resolution: {integrity: sha512-ngu0tSEmrezoiIaNGG6rRvKOUkUuDdf4XTPnONHGYfSGRmDqPZX5oJL6HAdKTo1UQHECbdB4OzhWrfgVppjHUw==}
+
+  '@hapi/boom@10.0.1':
+    resolution: {integrity: sha512-ERcCZaEjdH3OgSJlyjVk8pHIFeus91CjKP3v+MpgBNp5IvGzP2l/bRiD78nqYcKPaZdbKkK5vDBVPd2ohHBlsA==}
+
+  '@hapi/boom@9.1.4':
+    resolution: {integrity: sha512-Ls1oH8jaN1vNsqcaHVYJrKmgMcKsC1wcp8bujvXrHaAqD2iDYq3HoOwsxwo09Cuda5R5nC0o0IxlrlTuvPuzSw==}
+
+  '@hapi/bourne@2.1.0':
+    resolution: {integrity: sha512-i1BpaNDVLJdRBEKeJWkVO6tYX6DMFBuwMhSuWqLsY4ufeTKGVuV5rBsUhxPayXqnnWHgXUAmWK16H/ykO5Wj4Q==}
+
+  '@hapi/catbox@12.1.1':
+    resolution: {integrity: sha512-hDqYB1J+R0HtZg4iPH3LEnldoaBsar6bYp0EonBmNQ9t5CO+1CqgCul2ZtFveW1ReA5SQuze9GPSU7/aecERhw==}
+
+  '@hapi/cryptiles@5.1.0':
+    resolution: {integrity: sha512-fo9+d1Ba5/FIoMySfMqPBR/7Pa29J2RsiPrl7bkwo5W5o+AN1dAYQRi4SPrPwwVxVGKjgLOEWrsvt1BonJSfLA==}
+    engines: {node: '>=12.0.0'}
+
+  '@hapi/hoek@11.0.7':
+    resolution: {integrity: sha512-HV5undWkKzcB4RZUusqOpcgxOaq6VOAH7zhhIr2g3G8NF/MlFO75SjOr2NfuSx0Mh40+1FqCkagKLJRykUWoFQ==}
+
+  '@hapi/hoek@9.3.0':
+    resolution: {integrity: sha512-/c6rf4UJlmHlC9b5BaNvzAcFv7HZ2QHaV0D4/HNlBdvFnvQq8RI4kYdhyPCl7Xj+oWvTWQ8ujhqS53LIgAe6KQ==}
+
+  '@hapi/iron@6.0.0':
+    resolution: {integrity: sha512-zvGvWDufiTGpTJPG1Y/McN8UqWBu0k/xs/7l++HVU535NLHXsHhy54cfEMdW7EjwKfbBfM9Xy25FmTiobb7Hvw==}
+
+  '@hapi/podium@4.1.3':
+    resolution: {integrity: sha512-ljsKGQzLkFqnQxE7qeanvgGj4dejnciErYd30dbrYzUOF/FyS/DOF97qcrT3bhoVwCYmxa6PEMhxfCPlnUcD2g==}
+
+  '@hapi/podium@5.0.2':
+    resolution: {integrity: sha512-T7gf2JYHQQfEfewTQFbsaXoZxSvuXO/QBIGljucUQ/lmPnTTNAepoIKOakWNVWvo2fMEDjycu77r8k6dhreqHA==}
+
+  '@hapi/shot@6.0.2':
+    resolution: {integrity: sha512-WKK1ShfJTrL1oXC0skoIZQYzvLsyMDEF8lfcWuQBjpjCN29qivr9U36ld1z0nt6edvzv28etNMOqUF4klnHryw==}
+
+  '@hapi/teamwork@5.1.1':
+    resolution: {integrity: sha512-1oPx9AE5TIv+V6Ih54RP9lTZBso3rP8j4Xhb6iSVwPXtAM+sDopl5TFMv5Paw73UnpZJ9gjcrTE1BXrWt9eQrg==}
+    engines: {node: '>=12.0.0'}
+
+  '@hapi/teamwork@6.0.1':
+    resolution: {integrity: sha512-52OXRslUfYwXAOG8k58f2h2ngXYQGP0x5RPOo+eWA/FtyLgHjGMrE3+e9LSXP/0q2YfHAK5wj9aA9DTy1K+kyQ==}
+    engines: {node: '>=14.0.0'}
+
+  '@hapi/topo@5.1.0':
+    resolution: {integrity: sha512-foQZKJig7Ob0BMAYBfcJk8d77QtOe7Wo4ox7ff1lQYoNNAb6jwcY1ncdoy2e9wQZzvNy7ODZCYJkK8kzmcAnAg==}
+
+  '@hapi/topo@6.0.2':
+    resolution: {integrity: sha512-KR3rD5inZbGMrHmgPxsJ9dbi6zEK+C3ZwUwTa+eMwWLz7oijWUTWD2pMSNNYJAU6Qq+65NkxXjqHr/7LM2Xkqg==}
+
+  '@hapi/validate@1.1.3':
+    resolution: {integrity: sha512-/XMR0N0wjw0Twzq2pQOzPBZlDzkekGcoCtzO314BpIEsbXdYGthQUbxgkGDf4nhk1+IPDAsXqWjMohRQYO06UA==}
+
+  '@hapi/validate@2.0.1':
+    resolution: {integrity: sha512-NZmXRnrSLK8MQ9y/CMqE9WSspgB9xA41/LlYR0k967aSZebWr4yNrpxIbov12ICwKy4APSlWXZga9jN5p6puPA==}
+
+  '@humanwhocodes/config-array@0.13.0':
+    resolution: {integrity: sha512-DZLEEqFWQFiyK6h5YIeynKx7JlvCYWL0cImfSRXZ9l4Sg2efkFGTuFf6vzXjK1cq6IYkU+Eg/JizXw+TD2vRNw==}
+    engines: {node: '>=10.10.0'}
+    deprecated: Use @eslint/config-array instead
+
+  '@humanwhocodes/module-importer@1.0.1':
+    resolution: {integrity: sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==}
+    engines: {node: '>=12.22'}
+
+  '@humanwhocodes/object-schema@2.0.3':
+    resolution: {integrity: sha512-93zYdMES/c1D69yZiKDBj0V24vqNzB/koF26KPaagAfd3P/4gUlh3Dys5ogAK+Exi9QyzlD8x/08Zt7wIKcDcA==}
+    deprecated: Use @eslint/object-schema instead
+
+  '@ioredis/as-callback@3.0.0':
+    resolution: {integrity: sha512-Kqv1rZ3WbgOrS+hgzJ5xG5WQuhvzzSTRYvNeyPMLOAM78MHSnuKI20JeJGbpuAt//LCuP0vsexZcorqW7kWhJg==}
+
+  '@ioredis/commands@1.5.1':
+    resolution: {integrity: sha512-JH8ZL/ywcJyR9MmJ5BNqZllXNZQqQbnVZOqpPQqE1vHiFgAw4NHbvE0FOduNU8IX9babitBT46571OnPTT0Zcw==}
+
+  '@isaacs/cliui@8.0.2':
+    resolution: {integrity: sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==}
+    engines: {node: '>=12'}
+
+  '@istanbuljs/schema@0.1.6':
+    resolution: {integrity: sha512-+Sg6GCR/wy1oSmQDFq4LQDAhm3ETKnorxN+y5nbLULOR3P0c14f2Wurzj3/xqPXtasLFfHd5iRFQ7AJt4KH2cw==}
+    engines: {node: '>=8'}
+
+  '@jest/schemas@29.6.3':
+    resolution: {integrity: sha512-mo5j5X+jIZmJQveBKeS/clAueipV7KgiX1vMgCxam1RNYiqE1w62n0/tJJnHtjW8ZHcQco5gY85jA3mi0L+nSA==}
+    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}
+
+  '@jridgewell/gen-mapping@0.3.13':
+    resolution: {integrity: sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==}
+
+  '@jridgewell/resolve-uri@3.1.2':
+    resolution: {integrity: sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==}
+    engines: {node: '>=6.0.0'}
+
+  '@jridgewell/sourcemap-codec@1.5.5':
+    resolution: {integrity: sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==}
+
+  '@jridgewell/trace-mapping@0.3.31':
+    resolution: {integrity: sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==}
+
+  '@js-sdsl/ordered-map@4.4.2':
+    resolution: {integrity: sha512-iUKgm52T8HOE/makSxjqoWhe95ZJA1/G1sYsGev2JDKUSS14KAgg1LHb+Ba+IPow0xflbnSkOsZcO08C7w1gYw==}
+
+  '@lukeed/csprng@1.1.0':
+    resolution: {integrity: sha512-Z7C/xXCiGWsg0KuKsHTKJxbWhpI3Vs5GwLfOean7MGyVFGqdRgBbAjOCh6u4bbjPc/8MJ2pZmK/0DLdCbivLDA==}
+    engines: {node: '>=8'}
+
+  '@msgpackr-extract/msgpackr-extract-darwin-arm64@3.0.3':
+    resolution: {integrity: sha512-QZHtlVgbAdy2zAqNA9Gu1UpIuI8Xvsd1v8ic6B2pZmeFnFcMWiPLfWXh7TVw4eGEZ/C9TH281KwhVoeQUKbyjw==}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@msgpackr-extract/msgpackr-extract-darwin-x64@3.0.3':
+    resolution: {integrity: sha512-mdzd3AVzYKuUmiWOQ8GNhl64/IoFGol569zNRdkLReh6LRLHOXxU4U8eq0JwaD8iFHdVGqSy4IjFL4reoWCDFw==}
+    cpu: [x64]
+    os: [darwin]
+
+  '@msgpackr-extract/msgpackr-extract-linux-arm64@3.0.3':
+    resolution: {integrity: sha512-YxQL+ax0XqBJDZiKimS2XQaf+2wDGVa1enVRGzEvLLVFeqa5kx2bWbtcSXgsxjQB7nRqqIGFIcLteF/sHeVtQg==}
+    cpu: [arm64]
+    os: [linux]
+
+  '@msgpackr-extract/msgpackr-extract-linux-arm@3.0.3':
+    resolution: {integrity: sha512-fg0uy/dG/nZEXfYilKoRe7yALaNmHoYeIoJuJ7KJ+YyU2bvY8vPv27f7UKhGRpY6euFYqEVhxCFZgAUNQBM3nw==}
+    cpu: [arm]
+    os: [linux]
+
+  '@msgpackr-extract/msgpackr-extract-linux-x64@3.0.3':
+    resolution: {integrity: sha512-cvwNfbP07pKUfq1uH+S6KJ7dT9K8WOE4ZiAcsrSes+UY55E/0jLYc+vq+DO7jlmqRb5zAggExKm0H7O/CBaesg==}
+    cpu: [x64]
+    os: [linux]
+
+  '@msgpackr-extract/msgpackr-extract-win32-x64@3.0.3':
+    resolution: {integrity: sha512-x0fWaQtYp4E6sktbsdAqnehxDgEc/VwM7uLsRCYWaiGu0ykYdZPiS8zCWdnjHwyiumousxfBm4SO31eXqwEZhQ==}
+    cpu: [x64]
+    os: [win32]
+
+  '@napi-rs/wasm-runtime@0.2.12':
+    resolution: {integrity: sha512-ZVWUcfwY4E/yPitQJl481FjFo3K22D6qF0DuFH6Y/nbnE11GY5uguDxZMGXPQ8WQ0128MXQD7TnfHyK4oWoIJQ==}
+
+  '@nestjs/common@10.4.22':
+    resolution: {integrity: sha512-fxJ4v85nDHaqT1PmfNCQ37b/jcv2OojtXTaK1P2uAXhzLf9qq6WNUOFvxBrV4fhQek1EQoT1o9oj5xAZmv3NRw==}
+    peerDependencies:
+      class-transformer: '*'
+      class-validator: '*'
+      reflect-metadata: ^0.1.12 || ^0.2.0
+      rxjs: ^7.1.0
+    peerDependenciesMeta:
+      class-transformer:
+        optional: true
+      class-validator:
+        optional: true
+
+  '@nestjs/core@10.4.22':
+    resolution: {integrity: sha512-6IX9+VwjiKtCjx+mXVPncpkQ5ZjKfmssOZPFexmT+6T9H9wZ3svpYACAo7+9e7Nr9DZSoRZw3pffkJP7Z0UjaA==}
+    peerDependencies:
+      '@nestjs/common': ^10.0.0
+      '@nestjs/microservices': ^10.0.0
+      '@nestjs/platform-express': ^10.0.0
+      '@nestjs/websockets': ^10.0.0
+      reflect-metadata: ^0.1.12 || ^0.2.0
+      rxjs: ^7.1.0
+    peerDependenciesMeta:
+      '@nestjs/microservices':
+        optional: true
+      '@nestjs/platform-express':
+        optional: true
+      '@nestjs/websockets':
+        optional: true
+
+  '@nestjs/platform-express@10.4.22':
+    resolution: {integrity: sha512-ySSq7Py/DFozzZdNDH67m/vHoeVdphDniWBnl6q5QVoXldDdrZIHLXLRMPayTDh5A95nt7jjJzmD4qpTbNQ6tA==}
+    peerDependencies:
+      '@nestjs/common': ^10.0.0
+      '@nestjs/core': ^10.0.0
+
+  '@nestjs/testing@10.4.22':
+    resolution: {integrity: sha512-HO9aPus3bAedAC+jKVAA8jTdaj4fs5M9fing4giHrcYV2txe9CvC1l1WAjwQ9RDhEHdugjY4y+FZA/U/YqPZrA==}
+    peerDependencies:
+      '@nestjs/common': ^10.0.0
+      '@nestjs/core': ^10.0.0
+      '@nestjs/microservices': ^10.0.0
+      '@nestjs/platform-express': ^10.0.0
+    peerDependenciesMeta:
+      '@nestjs/microservices':
+        optional: true
+      '@nestjs/platform-express':
+        optional: true
+
+  '@noble/hashes@1.8.0':
+    resolution: {integrity: sha512-jCs9ldd7NwzpgXDIf6P3+NrHh9/sD6CQdxHyjQI+h/6rDNo88ypBxxz45UDuZHz9r3tNz7N/VInSVoVdtXEI4A==}
+    engines: {node: ^14.21.3 || >=16}
+
+  '@nodelib/fs.scandir@2.1.5':
+    resolution: {integrity: sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==}
+    engines: {node: '>= 8'}
+
+  '@nodelib/fs.stat@2.0.5':
+    resolution: {integrity: sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==}
+    engines: {node: '>= 8'}
+
+  '@nodelib/fs.walk@1.2.8':
+    resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}
+    engines: {node: '>= 8'}
+
+  '@nolyfill/is-core-module@1.0.39':
+    resolution: {integrity: sha512-nn5ozdjYQpUCZlWGuxcJY/KpxkWQs4DcbMCmKojjyrYDEAGy4Ce19NN4v5MduafTwJlbKc99UA8YhSVqq9yPZA==}
+    engines: {node: '>=12.4.0'}
+
+  '@nuxtjs/opencollective@0.3.2':
+    resolution: {integrity: sha512-um0xL3fO7Mf4fDxcqx9KryrB7zgRM5JSlvGN5AGkP6JLM5XEKyjeAiPbNxdXVXQ16isuAhYpvP88NgL2BGd6aA==}
+    engines: {node: '>=8.0.0', npm: '>=5.0.0'}
+    hasBin: true
+
+  '@opentelemetry/api-logs@0.49.1':
+    resolution: {integrity: sha512-kaNl/T7WzyMUQHQlVq7q0oV4Kev6+0xFwqzofryC66jgGMacd0QH5TwfpbUwSTby+SdAdprAe5UKMvBw4tKS5Q==}
+    engines: {node: '>=14'}
+
+  '@opentelemetry/api-logs@0.51.1':
+    resolution: {integrity: sha512-E3skn949Pk1z2XtXu/lxf6QAZpawuTM/IUEXcAzpiUkTd73Hmvw26FiN3cJuTmkpM5hZzHwkomVdtrh/n/zzwA==}
+    engines: {node: '>=14'}
+
+  '@opentelemetry/api@1.9.1':
+    resolution: {integrity: sha512-gLyJlPHPZYdAk1JENA9LeHejZe1Ti77/pTeFm/nMXmQH/HFZlcS/O2XJB+L8fkbrNSqhdtlvjBVjxwUYanNH5Q==}
+    engines: {node: '>=8.0.0'}
+
+  '@opentelemetry/auto-instrumentations-node@0.43.0':
+    resolution: {integrity: sha512-2WvHUSi/QVeVG8ObPD0Ls6WevfIbQjspxIQRuHaQFWXhmEwy/MsEcoQUjbNKXwO5516aS04GTydKEoRKsMwhdA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.4.1
+
+  '@opentelemetry/context-async-hooks@1.22.0':
+    resolution: {integrity: sha512-Nfdxyg8YtWqVWkyrCukkundAjPhUXi93JtVQmqDT1mZRVKqA7e2r7eJCrI+F651XUBMp0hsOJSGiFk3QSpaIJw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/context-async-hooks@1.24.1':
+    resolution: {integrity: sha512-R5r6DO4kgEOVBxFXhXjwospLQkv+sYxwCfjvoZBe7Zm6KKXAV9kDSJhi/D1BweowdZmO+sdbENLs374gER8hpQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/core@1.22.0':
+    resolution: {integrity: sha512-0VoAlT6x+Xzik1v9goJ3pZ2ppi6+xd3aUfg4brfrLkDBHRIVjMP0eBHrKrhB+NKcDyMAg8fAbGL3Npg/F6AwWA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/core@1.24.1':
+    resolution: {integrity: sha512-wMSGfsdmibI88K9wB498zXY04yThPexo8jvwNNlm542HZB7XrrMRBbAyKJqG8qDRJwIBdBrPMi4V9ZPW/sqrcg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/core@1.30.1':
+    resolution: {integrity: sha512-OOCM2C/QIURhJMuKaekP3TRBxBKxG/TWWA0TL2J6nXUtDnuCtccy49LUJF8xPFXMX+0LMcxFpCo8M9cGY1W6rQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/exporter-trace-otlp-grpc@0.49.1':
+    resolution: {integrity: sha512-Zbd7f3zF7fI2587MVhBizaW21cO/SordyrZGtMtvhoxU6n4Qb02Gx71X4+PzXH620e0+JX+Pcr9bYb1HTeVyJA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/exporter-trace-otlp-grpc@0.51.1':
+    resolution: {integrity: sha512-P9+Hkszih95ITvldGZ+kXvj9HpD1QfS+PwooyHK72GYA+Bgm+yUSAsDkUkDms8+s9HW6poxURv3LcjaMuBBpVQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/exporter-trace-otlp-http@0.49.1':
+    resolution: {integrity: sha512-KOLtZfZvIrpGZLVvblKsiVQT7gQUZNKcUUH24Zz6Xbi7LJb9Vt6xtUZFYdR5IIjvt47PIqBKDWUQlU0o1wAsRw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/exporter-trace-otlp-http@0.51.1':
+    resolution: {integrity: sha512-n+LhLPsX07URh+HhV2SHVSvz1t4G/l/CE5BjpmhAPqeTceFac1VpyQkavWEJbvnK5bUEXijWt4LxAxFpt2fXyw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/exporter-trace-otlp-proto@0.49.1':
+    resolution: {integrity: sha512-n8ON/c9pdMyYAfSFWKkgsPwjYoxnki+6Olzo+klKfW7KqLWoyEkryNkbcMIYnGGNXwdkMIrjoaP0VxXB26Oxcg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/exporter-trace-otlp-proto@0.51.1':
+    resolution: {integrity: sha512-SE9f0/6V6EeXC9i+WA4WFjS1EYgaBCpAnI5+lxWvZ7iO7EU1IvHvZhP6Kojr0nLldo83gqg6G7OWFqsID3uF+w==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/exporter-zipkin@1.22.0':
+    resolution: {integrity: sha512-XcFs6rGvcTz0qW5uY7JZDYD0yNEXdekXAb6sFtnZgY/cHY6BQ09HMzOjv9SX+iaXplRDcHr1Gta7VQKM1XXM6g==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/exporter-zipkin@1.24.1':
+    resolution: {integrity: sha512-+Rl/VFmu2n6eaRMnVbyfZx1DqR/1KNyWebYuHyQBZaEAVIn/ZLgmofRpXN1X2nhJ4BNaptQUNxAstCYYz6dKoQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/instrumentation-amqplib@0.35.0':
+    resolution: {integrity: sha512-rb3hIWA7f0HXpXpfElnGC6CukRxy58/OJ6XYlTzpZJtNJPao7BuobZjkQEscaRYhUzgi7X7R1aKkIUOTV5JFrg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-aws-lambda@0.39.0':
+    resolution: {integrity: sha512-D+oG/hIBDdwCNq7Y6BEuddjcwDVD0C8NhBE7A85mRZ9RLG0bKoWrhIdVvbpqEoa0U5AWe9Y98RX4itNg7WTy4w==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-aws-sdk@0.39.1':
+    resolution: {integrity: sha512-QnvIMVpzRYqQHSXydGUksbhBjPbMyHSUBwi6ocN7gEXoI711+tIY3R1cfRutl0u3M67A/fAvPI3IgACfJaFORg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-bunyan@0.36.0':
+    resolution: {integrity: sha512-sHD5BSiqSrgWow7VmugEFzV8vGdsz5m+w1v9tK6YwRzuAD7vbo57chluq+UBzIqStoCH+0yOzRzSALH7hrfffg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-cassandra-driver@0.36.0':
+    resolution: {integrity: sha512-gMfxzryOIP/mvSLXBJp/QxSr2NvS+cC1dkIXn+aSOzYoU1U3apeF3nAyuikmY9dRCQDV7wHPslqbi+pCmd4pAQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-connect@0.34.0':
+    resolution: {integrity: sha512-PJO99nfyUp3JSoBMhwZsOQDm/XKfkb/QQ8YTsNX4ZJ28phoRcNLqe36mqIMp80DKmKAX4xkxCAyrSYtW8QqZxA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-cucumber@0.4.0':
+    resolution: {integrity: sha512-n53QvozzgMS9imEclow2nBYJ/jtZlZqiKIqDUi2/g0nDi08F555JhDS03d/Z+4NJxbu7bDLAg12giCV9KZN/Jw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/instrumentation-dataloader@0.7.0':
+    resolution: {integrity: sha512-sIaevxATJV5YaZzBTTcTaDEnI+/1vxYs+lVk1honnvrEAaP0FA9C/cFrQEN0kP2BDHkHRE/t6y5lGUqusi/h3A==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-dns@0.34.0':
+    resolution: {integrity: sha512-3tmXdvrzHQ7S3v82Cm36PTYLtgg2+hVm00K1xB3uzP08GEo9w/F8DW4me9z6rDroVGiLIg621RZ6dzjBcmmFCg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-express@0.36.1':
+    resolution: {integrity: sha512-ltIE4kIMa+83QjW/p7oe7XCESF29w3FQ9/T1VgShdX7fzm56K2a0xfEX1vF8lnHRGERYxIWX9D086C6gJOjVGA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-fastify@0.34.0':
+    resolution: {integrity: sha512-2Qu66XBkfJ8tr6H+RHBTyw/EX73N9U7pvNa49aonDnT9/mK58k7AKOscpRnKXOvHqc2YIdEPRcBIWxhksPFZVA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-fs@0.10.0':
+    resolution: {integrity: sha512-XtMoNINVsIQTQHjtxe7A0Lng96wxA5DSD5CYVVvpquG6HJRdZ4xNe9DTU03YtoEFqlN9qTfvGb/6ILzhKhiG8g==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-generic-pool@0.34.0':
+    resolution: {integrity: sha512-jdI7tfVVwZJuTu4j2kAvJtx4wlEQKIXSZnZG4RdqRHc56KqQQDuVTBLvUgmDXvnSVclH9ayf4oaAV08R9fICtw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-graphql@0.38.1':
+    resolution: {integrity: sha512-mSt4ztn3EVlLtZJ+tDEqq5GUEYdY8cbTT9SeVJFmXSfdSQkPZn0ovo/dRe6dUcplM60gg4w+llw8SZuQN0iZfQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-grpc@0.49.1':
+    resolution: {integrity: sha512-f8mQjFi5/PiP4SK3VDU1/3sUUgs6exMtBgcnNycgCKgN40htiPT+MuDRwdRnRMNI/4vNQ7p1/5r4Q5oN0GuRBw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-hapi@0.35.0':
+    resolution: {integrity: sha512-j7q99aTLHfjNKW94qJnEaDatgz+q2psTKs7lxZO4QHRnoDltDk39a44/+AkI1qBJNw5xyLjrApqkglfbWJ2abg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-http@0.49.1':
+    resolution: {integrity: sha512-Yib5zrW2s0V8wTeUK/B3ZtpyP4ldgXj9L3Ws/axXrW1dW0/mEFKifK50MxMQK9g5NNJQS9dWH7rvcEGZdWdQDA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-ioredis@0.38.0':
+    resolution: {integrity: sha512-c9nQFhRjFAtpInTks7z5v9CiOCiR8U9GbIhIv0TLEJ/r0wqdKNLfLZzCrr9XQ9WasxeOmziLlPFhpRBAd9Q4oA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-knex@0.34.0':
+    resolution: {integrity: sha512-6kZOEvNJOylTQunU5zSSi4iTuCkwIL9nwFnZg7719p61u3d6Qj3X4xi9su46VE3M0dH7vEoxUW+nb/0ilm+aZg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-koa@0.38.0':
+    resolution: {integrity: sha512-lQujF4I3wdcrOF14miCV2pC72H+OJKb2LrrmTvTDAhELQDN/95v0doWgT9aHybUGkaAeB3QG4d09sved548TlA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-lru-memoizer@0.35.0':
+    resolution: {integrity: sha512-wCXe+iCF7JweMgY3blLM2Y1G0GSwLEeSA61z/y1UwzvBLEEXt7vL6qOl2mkNcUL9ZbLDS+EABatBH+vFO6DV5Q==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-memcached@0.34.0':
+    resolution: {integrity: sha512-RleFfaag3Evg4pTzHwDBwo1KiFgnCtiT4V6MQRRHadytNGdpcL+Ynz32ydDdiOXeadt7xpRI7HSvBy0quGTXSw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-mongodb@0.41.0':
+    resolution: {integrity: sha512-DlSH0oyEuTW5gprCUppb0Qe3pK3cpUUFW5eTmayWNyICI1LFunwtcrULTNv6UiThD/V5ykAf/GGGEa7KFAmkog==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-mongoose@0.36.0':
+    resolution: {integrity: sha512-UelQ8dLQRLTdck3tPJdZ17b+Hk9usLf1cY2ou5THAaZpulUdpg62Q9Hx2RHRU71Rp2/YMDk25og7GJhuWScfEA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-mysql2@0.36.0':
+    resolution: {integrity: sha512-F63lKcl/R+if2j5Vz66c2/SLXQEtLlFkWTmYb8NQSgmcCaEKjML4RRRjZISIT4IBwdpanJ2qmNuXVM6MYqhBXw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-mysql@0.36.0':
+    resolution: {integrity: sha512-2mt/032SLkiuddzMrq3YwM0bHksXRep69EzGRnBfF+bCbwYvKLpqmSFqJZ9T3yY/mBWj+tvdvc1+klXGrh2QnQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-nestjs-core@0.35.0':
+    resolution: {integrity: sha512-INKA7CIOteTSRVxP7SQaFby11AYU3uezI93xDaDRGY4TloXNVoyw5n6UmcVJU4yDn6xY2r7zZ2SVHvblUc21/g==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-net@0.34.0':
+    resolution: {integrity: sha512-gjybNOQQqbXmD1qVHNO2qBJI4V6p3QQ7xKg3pnC/x7wRdxn+siLQj7QIVxW85C3mymngoJJdRs6BwI3qPUfsPQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-pg@0.39.1':
+    resolution: {integrity: sha512-pX5ujDOyGpPcrZlzaD3LJzmyaSMMMKAP+ffTHJp9vasvZJr+LifCk53TMPVUafcXKV/xX/IIkvADO+67M1Z25g==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-pino@0.36.0':
+    resolution: {integrity: sha512-oEz+BJEYRBMAUu7MVJFJhhlsBuwLaUGjbJciKZRIeGX+fUtgcbQGV+a2Ris9jR3yFzWZrYg0aNBSCbGqvPCtMQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-redis-4@0.37.0':
+    resolution: {integrity: sha512-WNO+HALvPPvjbh7UEEIuay0Z0d2mIfSCkBZbPRwZttDGX6LYGc2WnRgJh3TnYqjp7/y9IryWIbajAFIebj1OBA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-redis@0.37.0':
+    resolution: {integrity: sha512-9G0T74kheu37k+UvyBnAcieB5iowxska3z2rhUcSTL8Cl0y/CvMn7sZ7txkUbXt0rdX6qeEUdMLmbsY2fPUM7Q==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-restify@0.36.0':
+    resolution: {integrity: sha512-QbOh8HpnnRn4xxFXX77Gdww6M78yx7dRiIKR6+H3j5LH5u6sYckTXw3TGPSsXsaM4DQHy0fOw15sAcJoWkC+aQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-router@0.35.0':
+    resolution: {integrity: sha512-MdxGJuNTIy/2qDI8yow6cRBQ87m6O//VuHIlawe8v0x1NsTOSwS72xm+BzTuY9D0iMqiJUiTlE3dBs8DA91MTw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-socket.io@0.37.0':
+    resolution: {integrity: sha512-aIztxmx/yis/goEndnoITrZvDDr1GdCtlsWo9ex7MhUIjqq5nJbTuyigf3GmU86XFFhSThxfQuJ9DpJyPxfBfA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-tedious@0.8.0':
+    resolution: {integrity: sha512-BBRW8+Qm2PLNkVMynr3Q7L4xCAOCOs0J9BJIJ8ZGoatW42b2H4qhMhq35jfPDvEL5u5azxHDapmUVYrDJDjAfA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation-winston@0.35.0':
+    resolution: {integrity: sha512-ymcuA3S2flnLmH1GS0105H91iDLap8cizOCaLMCp7Xz7r4L+wFf1zfix9M+iSkxcPFshHRt8LFA/ELXw51nk0g==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation@0.49.1':
+    resolution: {integrity: sha512-0DLtWtaIppuNNRRllSD4bjU8ZIiLp1cDXvJEbp752/Zf+y3gaLNaoGRGIlX4UHhcsrmtL+P2qxi3Hodi8VuKiQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/instrumentation@0.51.1':
+    resolution: {integrity: sha512-JIrvhpgqY6437QIqToyozrUG1h5UhwHkaGK/WAX+fkrpyPtc+RO5FkRtUd9BH0MibabHHvqsnBGKfKVijbmp8w==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/otlp-exporter-base@0.49.1':
+    resolution: {integrity: sha512-z6sHliPqDgJU45kQatAettY9/eVF58qVPaTuejw9YWfSRqid9pXPYeegDCSdyS47KAUgAtm+nC28K3pfF27HWg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/otlp-exporter-base@0.51.1':
+    resolution: {integrity: sha512-UYlnOYyDdzo1Gw559EHCzru0RwhvuXCwoH8jGo9J4gO1TE58GjnEmIjomMsKBCym3qWNJfIQXw+9SZCV0DdQNg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/otlp-grpc-exporter-base@0.49.1':
+    resolution: {integrity: sha512-DNDNUWmOqtKTFJAyOyHHKotVox0NQ/09ETX8fUOeEtyNVHoGekAVtBbvIA3AtK+JflP7LC0PTjlLfruPM3Wy6w==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/otlp-grpc-exporter-base@0.51.1':
+    resolution: {integrity: sha512-ZAS+4pq8o7dsugGTwV9s6JMKSxi+guIHdn0acOv0bqj26e9pWDFx5Ky+bI0aY46uR9Y0JyXqY+KAEYM/SO3DFA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/otlp-proto-exporter-base@0.49.1':
+    resolution: {integrity: sha512-x1qB4EUC7KikUl2iNuxCkV8yRzrSXSyj4itfpIO674H7dhI7Zv37SFaOJTDN+8Z/F50gF2ISFH9CWQ4KCtGm2A==}
+    engines: {node: '>=14'}
+    deprecated: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/otlp-proto-exporter-base@0.51.1':
+    resolution: {integrity: sha512-gxxxwfk0inDMb5DLeuxQ3L8TtptxSiTNHE4nnAJH34IQXAVRhXSXW1rK8PmDKDngRPIZ6J7ncUCjjIn8b+AgqQ==}
+    engines: {node: '>=14'}
+    deprecated: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/otlp-transformer@0.49.1':
+    resolution: {integrity: sha512-Z+koA4wp9L9e3jkFacyXTGphSWTbOKjwwXMpb0CxNb0kjTHGUxhYRN8GnkLFsFo5NbZPjP07hwAqeEG/uCratQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.9.0'
+
+  '@opentelemetry/otlp-transformer@0.51.1':
+    resolution: {integrity: sha512-OppYOXwV9LQqqtYUCywqoOqX/JT9LQ5/FMuPZ//eTkvuHdUC4ZMwz2c6uSoT2R90GWvvGnF1iEqTGyTT3xAt2Q==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.9.0'
+
+  '@opentelemetry/propagation-utils@0.30.16':
+    resolution: {integrity: sha512-ZVQ3Z/PQ+2GQlrBfbMMMT0U7MzvYZLCPP800+ooyaBqm4hMvuQHfP028gB9/db0mwkmyEAMad9houukUVxhwcw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/propagator-aws-xray@1.26.2':
+    resolution: {integrity: sha512-k43wxTjKYvwfce9L4eT8fFYy/ATmCfPHZPZsyT/6ABimf2KE1HafoOsIcxLOtmNSZt6dCvBIYCrXaOWta20xJg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/propagator-b3@1.22.0':
+    resolution: {integrity: sha512-qBItJm9ygg/jCB5rmivyGz1qmKZPsL/sX715JqPMFgq++Idm0x+N9sLQvWFHFt2+ZINnCSojw7FVBgFW6izcXA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/propagator-b3@1.24.1':
+    resolution: {integrity: sha512-nda97ZwhpZKyUJTXqQuKzNhPMUgMLunbbGWn8kroBwegn+nh6OhtyGkrVQsQLNdVKJl0KeB5z0ZgeWszrYhwFw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/propagator-jaeger@1.22.0':
+    resolution: {integrity: sha512-pMLgst3QIwrUfepraH5WG7xfpJ8J3CrPKrtINK0t7kBkuu96rn+HDYQ8kt3+0FXvrZI8YJE77MCQwnJWXIrgpA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/propagator-jaeger@1.24.1':
+    resolution: {integrity: sha512-7bRBJn3FG1l195A1m+xXRHvgzAOBsfmRi9uZ5Da18oTh7BLmNDiA8+kpk51FpTsU1PCikPVpRDNPhKVB6lyzZg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/redis-common@0.36.2':
+    resolution: {integrity: sha512-faYX1N0gpLhej/6nyp6bgRjzAKXn5GOEMYY7YhciSfCoITAktLUtQ36d24QEWNA1/WA1y6qQunCe0OhHRkVl9g==}
+    engines: {node: '>=14'}
+
+  '@opentelemetry/resource-detector-alibaba-cloud@0.28.10':
+    resolution: {integrity: sha512-TZv/1Y2QCL6sJ+X9SsPPBXe4786bc/Qsw0hQXFsNTbJzDTGGUmOAlSZ2qPiuqAd4ZheUYfD+QA20IvAjUz9Hhg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/resource-detector-aws@1.12.0':
+    resolution: {integrity: sha512-Cvi7ckOqiiuWlHBdA1IjS0ufr3sltex2Uws2RK6loVp4gzIJyOijsddAI6IZ5kiO8h/LgCWe8gxPmwkTKImd+Q==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/resource-detector-container@0.3.11':
+    resolution: {integrity: sha512-22ndMDakxX+nuhAYwqsciexV8/w26JozRUV0FN9kJiqSWtA1b5dCVtlp3J6JivG5t8kDN9UF5efatNnVbqRT9Q==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/resource-detector-gcp@0.29.13':
+    resolution: {integrity: sha512-vdotx+l3Q+89PeyXMgKEGnZ/CwzwMtuMi/ddgD9/5tKZ08DfDGB2Npz9m2oXPHRCjc4Ro6ifMqFlRyzIvgOjhg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.0.0
+
+  '@opentelemetry/resources@1.22.0':
+    resolution: {integrity: sha512-+vNeIFPH2hfcNL0AJk/ykJXoUCtR1YaDUZM+p3wZNU4Hq98gzq+7b43xbkXjadD9VhWIUQqEwXyY64q6msPj6A==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/resources@1.24.1':
+    resolution: {integrity: sha512-cyv0MwAaPF7O86x5hk3NNgenMObeejZFLJJDVuSeSMIsknlsj3oOZzRv3qSzlwYomXsICfBeFFlxwHQte5mGXQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/resources@1.30.1':
+    resolution: {integrity: sha512-5UxZqiAgLYGFjS4s9qm5mBVo433u+dSPUFWVWXmLAD4wB65oMCoXaJP1KJa9DIYYMeHu3z4BZcStG3LC593cWA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/sdk-logs@0.49.1':
+    resolution: {integrity: sha512-gCzYWsJE0h+3cuh3/cK+9UwlVFyHvj3PReIOCDOmdeXOp90ZjKRoDOJBc3mvk1LL6wyl1RWIivR8Rg9OToyesw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.4.0 <1.9.0'
+      '@opentelemetry/api-logs': '>=0.39.1'
+
+  '@opentelemetry/sdk-logs@0.51.1':
+    resolution: {integrity: sha512-ULQQtl82b673PpZc5/0EtH4V+BrwVOgKJZEB7tYZnGTG3I98tQVk89S9/JSixomDr++F4ih+LSJTCqIKBz+MQQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.4.0 <1.9.0'
+      '@opentelemetry/api-logs': '>=0.39.1'
+
+  '@opentelemetry/sdk-metrics@1.22.0':
+    resolution: {integrity: sha512-k6iIx6H3TZ+BVMr2z8M16ri2OxWaljg5h8ihGJxi/KQWcjign6FEaEzuigXt5bK9wVEhqAcWLCfarSftaNWkkg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.9.0'
+
+  '@opentelemetry/sdk-metrics@1.24.1':
+    resolution: {integrity: sha512-FrAqCbbGao9iKI+Mgh+OsC9+U2YMoXnlDHe06yH7dvavCKzE3S892dGtX54+WhSFVxHR/TMRVJiK/CV93GR0TQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.9.0'
+
+  '@opentelemetry/sdk-metrics@1.30.1':
+    resolution: {integrity: sha512-q9zcZ0Okl8jRgmy7eNW3Ku1XSgg3sDLa5evHZpCwjspw7E8Is4K/haRPDJrBcX3YSn/Y7gUvFnByNYEKQNbNog==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.10.0'
+
+  '@opentelemetry/sdk-node@0.49.1':
+    resolution: {integrity: sha512-feBIT85ndiSHXsQ2gfGpXC/sNeX4GCHLksC4A9s/bfpUbbgbCSl0RvzZlmEpCHarNrkZMwFRi4H0xFfgvJEjrg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.9.0'
+
+  '@opentelemetry/sdk-node@0.51.1':
+    resolution: {integrity: sha512-GgmNF9C+6esr8PIJxCqHw84rEOkYm6XdFWZ2+Wyc3qaUt92ACoN7uSw5iKNvaUq62W0xii1wsGxwHzyENtPP8w==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.9.0'
+
+  '@opentelemetry/sdk-trace-base@1.22.0':
+    resolution: {integrity: sha512-pfTuSIpCKONC6vkTpv6VmACxD+P1woZf4q0K46nSUvXFvOFqjBYKFaAMkKD3M1mlKUUh0Oajwj35qNjMl80m1Q==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/sdk-trace-base@1.24.1':
+    resolution: {integrity: sha512-zz+N423IcySgjihl2NfjBf0qw1RWe11XIAWVrTNOSSI6dtSPJiVom2zipFB2AEEtJWpv0Iz6DY6+TjnyTV5pWg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/sdk-trace-node@1.22.0':
+    resolution: {integrity: sha512-gTGquNz7ue8uMeiWPwp3CU321OstQ84r7PCDtOaCicjbJxzvO8RZMlEC4geOipTeiF88kss5n6w+//A0MhP1lQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/sdk-trace-node@1.24.1':
+    resolution: {integrity: sha512-/FZX8uWaGIAwsDhqI8VvQ+qWtfMNlXjaFYGc+vmxgdRFppCSSIRwrPyIhJO1qx61okyYhoyxVEZAfoiNxrfJCg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.9.0'
+
+  '@opentelemetry/semantic-conventions@1.22.0':
+    resolution: {integrity: sha512-CAOgFOKLybd02uj/GhCdEeeBjOS0yeoDeo/CA7ASBSmenpZHAKGB3iDm/rv3BQLcabb/OprDEsSQ1y0P8A7Siw==}
+    engines: {node: '>=14'}
+
+  '@opentelemetry/semantic-conventions@1.24.1':
+    resolution: {integrity: sha512-VkliWlS4/+GHLLW7J/rVBA00uXus1SWvwFvcUDxDwmFxYfg/2VI6ekwdXS28cjI8Qz2ky2BzG8OUHo+WeYIWqw==}
+    engines: {node: '>=14'}
+
+  '@opentelemetry/semantic-conventions@1.28.0':
+    resolution: {integrity: sha512-lp4qAiMTD4sNWW4DbKLBkfiMZ4jbAboJIGOQr5DvciMRI494OapieI9qiODpOt0XBr1LjIDy1xAGAnVs5supTA==}
+    engines: {node: '>=14'}
+
+  '@opentelemetry/semantic-conventions@1.40.0':
+    resolution: {integrity: sha512-cifvXDhcqMwwTlTK04GBNeIe7yyo28Mfby85QXFe1Yk8nmi36Ab/5UQwptOx84SsoGNRg+EVSjwzfSZMy6pmlw==}
+    engines: {node: '>=14'}
+
+  '@opentelemetry/sql-common@0.40.1':
+    resolution: {integrity: sha512-nSDlnHSqzC3pXn/wZEZVLuAuJ1MYMXPBwtv2qAbCa3847SaHItdE7SzUq/Jtb0KZmh1zfAbNi3AAMjztTT4Ugg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.1.0
+
+  '@paralleldrive/cuid2@2.3.1':
+    resolution: {integrity: sha512-XO7cAxhnTZl0Yggq6jOgjiOHhbgcO4NqFqwSmQpjK3b6TEE6Uj/jfSk6wzYyemh3+I0sHirKSetjQwn5cZktFw==}
+
+  '@pkgjs/parseargs@0.11.0':
+    resolution: {integrity: sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==}
+    engines: {node: '>=14'}
+
+  '@protobufjs/aspromise@1.1.2':
+    resolution: {integrity: sha512-j+gKExEuLmKwvz3OgROXtrJ2UG2x8Ch2YZUxahh+s1F2HZ+wAceUNLkvy6zKCPVRkU++ZWQrdxsUeQXmcg4uoQ==}
+
+  '@protobufjs/base64@1.1.2':
+    resolution: {integrity: sha512-AZkcAA5vnN/v4PDqKyMR5lx7hZttPDgClv83E//FMNhR2TMcLUhfRUBHCmSl0oi9zMgDDqRUJkSxO3wm85+XLg==}
+
+  '@protobufjs/codegen@2.0.4':
+    resolution: {integrity: sha512-YyFaikqM5sH0ziFZCN3xDC7zeGaB/d0IUb9CATugHWbd1FRFwWwt4ld4OYMPWu5a3Xe01mGAULCdqhMlPl29Jg==}
+
+  '@protobufjs/eventemitter@1.1.0':
+    resolution: {integrity: sha512-j9ednRT81vYJ9OfVuXG6ERSTdEL1xVsNgqpkxMsbIabzSo3goCjDIveeGv5d03om39ML71RdmrGNjG5SReBP/Q==}
+
+  '@protobufjs/fetch@1.1.0':
+    resolution: {integrity: sha512-lljVXpqXebpsijW71PZaCYeIcE5on1w5DlQy5WH6GLbFryLUrBD4932W/E2BSpfRJWseIL4v/KPgBFxDOIdKpQ==}
+
+  '@protobufjs/float@1.0.2':
+    resolution: {integrity: sha512-Ddb+kVXlXst9d+R9PfTIxh1EdNkgoRe5tOX6t01f1lYWOvJnSPDBlG241QLzcyPdoNTsblLUdujGSE4RzrTZGQ==}
+
+  '@protobufjs/inquire@1.1.0':
+    resolution: {integrity: sha512-kdSefcPdruJiFMVSbn801t4vFK7KB/5gd2fYvrxhuJYg8ILrmn9SKSX2tZdV6V+ksulWqS7aXjBcRXl3wHoD9Q==}
+
+  '@protobufjs/path@1.1.2':
+    resolution: {integrity: sha512-6JOcJ5Tm08dOHAbdR3GrvP+yUUfkjG5ePsHYczMFLq3ZmMkAD98cDgcT2iA1lJ9NVwFd4tH/iSSoe44YWkltEA==}
+
+  '@protobufjs/pool@1.1.0':
+    resolution: {integrity: sha512-0kELaGSIDBKvcgS4zkjz1PeddatrjYcmMWOlAuAPwAeccUrPHdUqo/J6LiymHHEiJT5NrF1UVwxY14f+fy4WQw==}
+
+  '@protobufjs/utf8@1.1.0':
+    resolution: {integrity: sha512-Vvn3zZrhQZkkBE8LSuW3em98c0FwgO4nxzv6OdSxPKJIEKY2bGbHn+mhGIPerzI4twdxaP8/0+06HBpwf345Lw==}
+
+  '@rollup/rollup-android-arm-eabi@4.60.1':
+    resolution: {integrity: sha512-d6FinEBLdIiK+1uACUttJKfgZREXrF0Qc2SmLII7W2AD8FfiZ9Wjd+rD/iRuf5s5dWrr1GgwXCvPqOuDquOowA==}
+    cpu: [arm]
+    os: [android]
+
+  '@rollup/rollup-android-arm64@4.60.1':
+    resolution: {integrity: sha512-YjG/EwIDvvYI1YvYbHvDz/BYHtkY4ygUIXHnTdLhG+hKIQFBiosfWiACWortsKPKU/+dUwQQCKQM3qrDe8c9BA==}
+    cpu: [arm64]
+    os: [android]
+
+  '@rollup/rollup-darwin-arm64@4.60.1':
+    resolution: {integrity: sha512-mjCpF7GmkRtSJwon+Rq1N8+pI+8l7w5g9Z3vWj4T7abguC4Czwi3Yu/pFaLvA3TTeMVjnu3ctigusqWUfjZzvw==}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@rollup/rollup-darwin-x64@4.60.1':
+    resolution: {integrity: sha512-haZ7hJ1JT4e9hqkoT9R/19XW2QKqjfJVv+i5AGg57S+nLk9lQnJ1F/eZloRO3o9Scy9CM3wQ9l+dkXtcBgN5Ew==}
+    cpu: [x64]
+    os: [darwin]
+
+  '@rollup/rollup-freebsd-arm64@4.60.1':
+    resolution: {integrity: sha512-czw90wpQq3ZsAVBlinZjAYTKduOjTywlG7fEeWKUA7oCmpA8xdTkxZZlwNJKWqILlq0wehoZcJYfBvOyhPTQ6w==}
+    cpu: [arm64]
+    os: [freebsd]
+
+  '@rollup/rollup-freebsd-x64@4.60.1':
+    resolution: {integrity: sha512-KVB2rqsxTHuBtfOeySEyzEOB7ltlB/ux38iu2rBQzkjbwRVlkhAGIEDiiYnO2kFOkJp+Z7pUXKyrRRFuFUKt+g==}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@rollup/rollup-linux-arm-gnueabihf@4.60.1':
+    resolution: {integrity: sha512-L+34Qqil+v5uC0zEubW7uByo78WOCIrBvci69E7sFASRl0X7b/MB6Cqd1lky/CtcSVTydWa2WZwFuWexjS5o6g==}
+    cpu: [arm]
+    os: [linux]
+
+  '@rollup/rollup-linux-arm-musleabihf@4.60.1':
+    resolution: {integrity: sha512-n83O8rt4v34hgFzlkb1ycniJh7IR5RCIqt6mz1VRJD6pmhRi0CXdmfnLu9dIUS6buzh60IvACM842Ffb3xd6Gg==}
+    cpu: [arm]
+    os: [linux]
+
+  '@rollup/rollup-linux-arm64-gnu@4.60.1':
+    resolution: {integrity: sha512-Nql7sTeAzhTAja3QXeAI48+/+GjBJ+QmAH13snn0AJSNL50JsDqotyudHyMbO2RbJkskbMbFJfIJKWA6R1LCJQ==}
+    cpu: [arm64]
+    os: [linux]
+
+  '@rollup/rollup-linux-arm64-musl@4.60.1':
+    resolution: {integrity: sha512-+pUymDhd0ys9GcKZPPWlFiZ67sTWV5UU6zOJat02M1+PiuSGDziyRuI/pPue3hoUwm2uGfxdL+trT6Z9rxnlMA==}
+    cpu: [arm64]
+    os: [linux]
+
+  '@rollup/rollup-linux-loong64-gnu@4.60.1':
+    resolution: {integrity: sha512-VSvgvQeIcsEvY4bKDHEDWcpW4Yw7BtlKG1GUT4FzBUlEKQK0rWHYBqQt6Fm2taXS+1bXvJT6kICu5ZwqKCnvlQ==}
+    cpu: [loong64]
+    os: [linux]
+
+  '@rollup/rollup-linux-loong64-musl@4.60.1':
+    resolution: {integrity: sha512-4LqhUomJqwe641gsPp6xLfhqWMbQV04KtPp7/dIp0nzPxAkNY1AbwL5W0MQpcalLYk07vaW9Kp1PBhdpZYYcEw==}
+    cpu: [loong64]
+    os: [linux]
+
+  '@rollup/rollup-linux-ppc64-gnu@4.60.1':
+    resolution: {integrity: sha512-tLQQ9aPvkBxOc/EUT6j3pyeMD6Hb8QF2BTBnCQWP/uu1lhc9AIrIjKnLYMEroIz/JvtGYgI9dF3AxHZNaEH0rw==}
+    cpu: [ppc64]
+    os: [linux]
+
+  '@rollup/rollup-linux-ppc64-musl@4.60.1':
+    resolution: {integrity: sha512-RMxFhJwc9fSXP6PqmAz4cbv3kAyvD1etJFjTx4ONqFP9DkTkXsAMU4v3Vyc5BgzC+anz7nS/9tp4obsKfqkDHg==}
+    cpu: [ppc64]
+    os: [linux]
+
+  '@rollup/rollup-linux-riscv64-gnu@4.60.1':
+    resolution: {integrity: sha512-QKgFl+Yc1eEk6MmOBfRHYF6lTxiiiV3/z/BRrbSiW2I7AFTXoBFvdMEyglohPj//2mZS4hDOqeB0H1ACh3sBbg==}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@rollup/rollup-linux-riscv64-musl@4.60.1':
+    resolution: {integrity: sha512-RAjXjP/8c6ZtzatZcA1RaQr6O1TRhzC+adn8YZDnChliZHviqIjmvFwHcxi4JKPSDAt6Uhf/7vqcBzQJy0PDJg==}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@rollup/rollup-linux-s390x-gnu@4.60.1':
+    resolution: {integrity: sha512-wcuocpaOlaL1COBYiA89O6yfjlp3RwKDeTIA0hM7OpmhR1Bjo9j31G1uQVpDlTvwxGn2nQs65fBFL5UFd76FcQ==}
+    cpu: [s390x]
+    os: [linux]
+
+  '@rollup/rollup-linux-x64-gnu@4.60.1':
+    resolution: {integrity: sha512-77PpsFQUCOiZR9+LQEFg9GClyfkNXj1MP6wRnzYs0EeWbPcHs02AXu4xuUbM1zhwn3wqaizle3AEYg5aeoohhg==}
+    cpu: [x64]
+    os: [linux]
+
+  '@rollup/rollup-linux-x64-musl@4.60.1':
+    resolution: {integrity: sha512-5cIATbk5vynAjqqmyBjlciMJl1+R/CwX9oLk/EyiFXDWd95KpHdrOJT//rnUl4cUcskrd0jCCw3wpZnhIHdD9w==}
+    cpu: [x64]
+    os: [linux]
+
+  '@rollup/rollup-openbsd-x64@4.60.1':
+    resolution: {integrity: sha512-cl0w09WsCi17mcmWqqglez9Gk8isgeWvoUZ3WiJFYSR3zjBQc2J5/ihSjpl+VLjPqjQ/1hJRcqBfLjssREQILw==}
+    cpu: [x64]
+    os: [openbsd]
+
+  '@rollup/rollup-openharmony-arm64@4.60.1':
+    resolution: {integrity: sha512-4Cv23ZrONRbNtbZa37mLSueXUCtN7MXccChtKpUnQNgF010rjrjfHx3QxkS2PI7LqGT5xXyYs1a7LbzAwT0iCA==}
+    cpu: [arm64]
+    os: [openharmony]
+
+  '@rollup/rollup-win32-arm64-msvc@4.60.1':
+    resolution: {integrity: sha512-i1okWYkA4FJICtr7KpYzFpRTHgy5jdDbZiWfvny21iIKky5YExiDXP+zbXzm3dUcFpkEeYNHgQ5fuG236JPq0g==}
+    cpu: [arm64]
+    os: [win32]
+
+  '@rollup/rollup-win32-ia32-msvc@4.60.1':
+    resolution: {integrity: sha512-u09m3CuwLzShA0EYKMNiFgcjjzwqtUMLmuCJLeZWjjOYA3IT2Di09KaxGBTP9xVztWyIWjVdsB2E9goMjZvTQg==}
+    cpu: [ia32]
+    os: [win32]
+
+  '@rollup/rollup-win32-x64-gnu@4.60.1':
+    resolution: {integrity: sha512-k+600V9Zl1CM7eZxJgMyTUzmrmhB/0XZnF4pRypKAlAgxmedUA+1v9R+XOFv56W4SlHEzfeMtzujLJD22Uz5zg==}
+    cpu: [x64]
+    os: [win32]
+
+  '@rollup/rollup-win32-x64-msvc@4.60.1':
+    resolution: {integrity: sha512-lWMnixq/QzxyhTV6NjQJ4SFo1J6PvOX8vUx5Wb4bBPsEb+8xZ89Bz6kOXpfXj9ak9AHTQVQzlgzBEc1SyM27xQ==}
+    cpu: [x64]
+    os: [win32]
+
+  '@rtsao/scc@1.1.0':
+    resolution: {integrity: sha512-zt6OdqaDoOnJ1ZYsCYGt9YmWzDXl4vQdKTyJev62gFhRGKdx7mcT54V9KIjg+d2wi9EXsPvAPKe7i7WjfVWB8g==}
+
+  '@sentry-internal/tracing@7.120.4':
+    resolution: {integrity: sha512-Fz5+4XCg3akeoFK+K7g+d7HqGMjmnLoY2eJlpONJmaeT9pXY7yfUyXKZMmMajdE2LxxKJgQ2YKvSCaGVamTjHw==}
+    engines: {node: '>=8'}
+
+  '@sentry/core@7.120.4':
+    resolution: {integrity: sha512-TXu3Q5kKiq8db9OXGkWyXUbIxMMuttB5vJ031yolOl5T/B69JRyAoKuojLBjRv1XX583gS1rSSoX8YXX7ATFGA==}
+    engines: {node: '>=8'}
+
+  '@sentry/integrations@7.120.4':
+    resolution: {integrity: sha512-kkBTLk053XlhDCg7OkBQTIMF4puqFibeRO3E3YiVc4PGLnocXMaVpOSCkMqAc1k1kZ09UgGi8DxfQhnFEjUkpA==}
+    engines: {node: '>=8'}
+
+  '@sentry/node@7.120.4':
+    resolution: {integrity: sha512-qq3wZAXXj2SRWhqErnGCSJKUhPSlZ+RGnCZjhfjHpP49KNpcd9YdPTIUsFMgeyjdh6Ew6aVCv23g1hTP0CHpYw==}
+    engines: {node: '>=8'}
+
+  '@sentry/types@7.120.4':
+    resolution: {integrity: sha512-cUq2hSSe6/qrU6oZsEP4InMI5VVdD86aypE+ENrQ6eZEVLTCYm1w6XhW1NvIu3UuWh7gZec4a9J7AFpYxki88Q==}
+    engines: {node: '>=8'}
+
+  '@sentry/utils@7.120.4':
+    resolution: {integrity: sha512-zCKpyDIWKHwtervNK2ZlaK8mMV7gVUijAgFeJStH+CU/imcdquizV3pFLlSQYRswG+Lbyd6CT/LGRh3IbtkCFw==}
+    engines: {node: '>=8'}
+
+  '@sideway/address@4.1.5':
+    resolution: {integrity: sha512-IqO/DUQHUkPeixNQ8n0JA6102hT9CmaljNTPmQ1u8MEhBo/R4Q8eKLN/vGZxuebwOroDB4cbpjheD4+/sKFK4Q==}
+
+  '@sideway/formula@3.0.1':
+    resolution: {integrity: sha512-/poHZJJVjx3L+zVD6g9KgHfYnb443oi7wLu/XKojDviHy6HOEOA6z1Trk5aR1dGcmPenJEgb2sK2I80LeS3MIg==}
+
+  '@sideway/pinpoint@2.0.0':
+    resolution: {integrity: sha512-RNiOoTPkptFtSVzQevY/yWtZwf/RxyVnPy/OcA9HBM3MlGDnBEYL5B41H0MTn0Uec8Hi+2qUtTfG2WWZBmMejQ==}
+
+  '@sinclair/typebox@0.27.10':
+    resolution: {integrity: sha512-MTBk/3jGLNB2tVxv6uLlFh1iu64iYOQ2PbdOSK3NW8JZsmlaOh2q6sdtKowBhfw8QFLmYNzTW4/oK4uATIi6ZA==}
+
+  '@testcontainers/postgresql@10.28.0':
+    resolution: {integrity: sha512-NN25rruG5D4Q7pCNIJuHwB+G85OSeJ3xHZ2fWx0O6sPoPEfCYwvpj8mq99cyn68nxFkFYZeyrZJtSFO+FnydiA==}
+
+  '@tokenizer/inflate@0.2.7':
+    resolution: {integrity: sha512-MADQgmZT1eKjp06jpI2yozxaU9uVs4GzzgSL+uEq7bVcJ9V1ZXQkeGNql1fsSI0gMy1vhvNTNbUqrx+pZfJVmg==}
+    engines: {node: '>=18'}
+
+  '@tokenizer/token@0.3.0':
+    resolution: {integrity: sha512-OvjF+z51L3ov0OyAU0duzsYuvO01PH7x4t6DJx+guahgTnBHkhJdG7soQeTSFLWN3efnHyibZ4Z8l2EuWwJN3A==}
+
+  '@turbo/darwin-64@2.9.6':
+    resolution: {integrity: sha512-X/56SnVXIQZBLKwniGTwEQTGmtE5brSACnKMBWpY3YafuxVYefrC2acamfjgxP7BG5w3I+6jf0UrLoSzgPcSJg==}
+    cpu: [x64]
+    os: [darwin]
+
+  '@turbo/darwin-arm64@2.9.6':
+    resolution: {integrity: sha512-aalBeSl4agT/QtYGDyf/XLajedWzUC9Vg/pm/YO6QQ93vkQ91Vz5uK1ta5RbVRDozQSz4njxUNqRNmOXDzW+qw==}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@turbo/linux-64@2.9.6':
+    resolution: {integrity: sha512-YKi05jnNHaD7vevgYwahpzGwbsNNTwzU2c7VZdmdFm7+cGDP4oREUWSsainiMfRqjRuolQxBwRn8wf1jmu+YZA==}
+    cpu: [x64]
+    os: [linux]
+
+  '@turbo/linux-arm64@2.9.6':
+    resolution: {integrity: sha512-02o/ZS69cOYEDczXvOB2xmyrtzjQ2hVFtWZK1iqxXUfzMmTjZK4UumrfNnjckSg+gqeBfnPRHa0NstA173Ik3g==}
+    cpu: [arm64]
+    os: [linux]
+
+  '@turbo/windows-64@2.9.6':
+    resolution: {integrity: sha512-wVdQjvnBI15wB6JrA+43CtUtagjIMmX6XYO758oZHAsCNSxqRlJtdyujih0D8OCnwCRWiGWGI63zAxR0hO6s9g==}
+    cpu: [x64]
+    os: [win32]
+
+  '@turbo/windows-arm64@2.9.6':
+    resolution: {integrity: sha512-1XUUyWW0W6FTSqGEhU8RHVqb2wP1SPkr7hIvBlMEwH9jr+sJQK5kqeosLJ/QaUv4ecSAd1ZhIrLoW7qslAzT4A==}
+    cpu: [arm64]
+    os: [win32]
+
+  '@tybys/wasm-util@0.10.1':
+    resolution: {integrity: sha512-9tTaPJLSiejZKx+Bmog4uSubteqTvFrVrURwkmHixBo0G4seD0zUxp98E1DzUBJxLQ3NPwXrGKDiVjwx/DpPsg==}
+
+  '@types/accepts@1.3.7':
+    resolution: {integrity: sha512-Pay9fq2lM2wXPWbteBsRAGiWH2hig4ZE2asK+mm7kUzlxRTfL961rj89I6zV/E3PcIkDqyuBEcMxFT7rccugeQ==}
+
+  '@types/aws-lambda@8.10.122':
+    resolution: {integrity: sha512-vBkIh9AY22kVOCEKo5CJlyCgmSWvasC+SWUxL/x/vOwRobMpI/HG1xp/Ae3AqmSiZeLUbOhW0FCD3ZjqqUxmXw==}
+
+  '@types/body-parser@1.19.6':
+    resolution: {integrity: sha512-HLFeCYgz89uk22N5Qg3dvGvsv46B8GLvKKo1zKG4NybA8U2DiEO3w9lqGg29t/tfLRJpJ6iQxnVw4OnB7MoM9g==}
+
+  '@types/bunyan@1.8.9':
+    resolution: {integrity: sha512-ZqS9JGpBxVOvsawzmVt30sP++gSQMTejCkIAQ3VdadOcRE8izTyW66hufvwLeH+YEGP6Js2AW7Gz+RMyvrEbmw==}
+
+  '@types/connect@3.4.36':
+    resolution: {integrity: sha512-P63Zd/JUGq+PdrM1lv0Wv5SBYeA2+CORvbrXbngriYY0jzLUWfQMQQxOhjONEz/wlHOAxOdY7CY65rgQdTjq2w==}
+
+  '@types/connect@3.4.38':
+    resolution: {integrity: sha512-K6uROf1LD88uDQqJCktA4yzL1YYAK6NgfsI0v/mTgyPKWsX1CnJ0XPSDhViejru1GcRkLWb8RlzFYJRqGUbaug==}
+
+  '@types/content-disposition@0.5.9':
+    resolution: {integrity: sha512-8uYXI3Gw35MhiVYhG3s295oihrxRyytcRHjSjqnqZVDDy/xcGBRny7+Xj1Wgfhv5QzRtN2hB2dVRBUX9XW3UcQ==}
+
+  '@types/cookiejar@2.1.5':
+    resolution: {integrity: sha512-he+DHOWReW0nghN24E1WUqM0efK4kI9oTqDm6XmK8ZPe2djZ90BSNdGnIyCLzCPw7/pogPlGbzI2wHGGmi4O/Q==}
+
+  '@types/cookies@0.9.2':
+    resolution: {integrity: sha512-1AvkDdZM2dbyFybL4fxpuNCaWyv//0AwsuUk2DWeXyM1/5ZKm6W3z6mQi24RZ4l2ucY+bkSHzbDVpySqPGuV8A==}
+
+  '@types/docker-modem@3.0.6':
+    resolution: {integrity: sha512-yKpAGEuKRSS8wwx0joknWxsmLha78wNMe9R2S3UNsVOkZded8UqOrV8KoeDXoXsjndxwyF3eIhyClGbO1SEhEg==}
+
+  '@types/dockerode@3.3.47':
+    resolution: {integrity: sha512-ShM1mz7rCjdssXt7Xz0u1/R2BJC7piWa3SJpUBiVjCf2A3XNn4cP6pUVaD8bLanpPVVn4IKzJuw3dOvkJ8IbYw==}
+
+  '@types/estree@1.0.8':
+    resolution: {integrity: sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==}
+
+  '@types/express-serve-static-core@4.19.8':
+    resolution: {integrity: sha512-02S5fmqeoKzVZCHPZid4b8JH2eM5HzQLZWN2FohQEy/0eXTq8VXZfSN6Pcr3F6N9R/vNrj7cpgbhjie6m/1tCA==}
+
+  '@types/express@4.17.25':
+    resolution: {integrity: sha512-dVd04UKsfpINUnK0yBoYHDF3xu7xVH4BuDotC/xGuycx4CgbP48X/KF/586bcObxT0HENHXEU8Nqtu6NR+eKhw==}
+
+  '@types/hapi__catbox@12.1.0':
+    resolution: {integrity: sha512-v4XNUu6w9LmGgDZ4+OT1dSuvme5qNxFFyMVpqYPNugw4zN5xpWsNCsN7/0jG7wCKx39EQctW9iTT1O55UnH6/Q==}
+    deprecated: This is a stub types definition. @hapi/catbox provides its own type definitions, so you do not need this installed.
+
+  '@types/hapi__hapi@20.0.13':
+    resolution: {integrity: sha512-LP4IPfhIO5ZPVOrJo7H8c8Slc0WYTFAUNQX1U0LBPKyXioXhH5H2TawIgxKujIyOhbwoBbpvOsBf6o5+ToJIrQ==}
+
+  '@types/hapi__mimos@4.1.4':
+    resolution: {integrity: sha512-i9hvJpFYTT/qzB5xKWvDYaSXrIiNqi4ephi+5Lo6+DoQdwqPXQgmVVOZR+s3MBiHoFqsCZCX9TmVWG3HczmTEQ==}
+
+  '@types/hapi__shot@6.0.0':
+    resolution: {integrity: sha512-CUxk0AEQRpIT2cx7EYXkqaXm60LP46ZyEhr/7uov7D/ZLysA5DKkfBtPIYnoWvn8qfcFV/7YHLd3U9gThuhb0A==}
+    deprecated: This is a stub types definition. @hapi/shot provides its own type definitions, so you do not need this installed.
+
+  '@types/http-assert@1.5.6':
+    resolution: {integrity: sha512-TTEwmtjgVbYAzZYWyeHPrrtWnfVkm8tQkP8P21uQifPgMRgjrow3XDEYqucuC8SKZJT7pUnhU/JymvjggxO9vw==}
+
+  '@types/http-errors@2.0.5':
+    resolution: {integrity: sha512-r8Tayk8HJnX0FztbZN7oVqGccWgw98T/0neJphO91KkmOzug1KkofZURD4UaD5uH8AqcFLfdPErnBod0u71/qg==}
+
+  '@types/ioredis-mock@8.2.7':
+    resolution: {integrity: sha512-YsGiaOIYBKeVvu/7GYziAD8qX3LJem5LK00d5PKykzsQJMLysAqXA61AkNuYWCekYl64tbMTqVOMF4SYoCPbQg==}
+    peerDependencies:
+      ioredis: '>=5'
+
+  '@types/ioredis@4.28.10':
+    resolution: {integrity: sha512-69LyhUgrXdgcNDv7ogs1qXZomnfOEnSmrmMFqKgt1XMJxmoOSG/u3wYy13yACIfKuMJ8IhKgHafDO3sx19zVQQ==}
+
+  '@types/json5@0.0.29':
+    resolution: {integrity: sha512-dRLjCWHYg4oaA77cxO64oO+7JwCwnIzkZPdrrC71jQmQtlhM556pwKo5bUzqvZndkVbeFLIIi+9TC40JNF5hNQ==}
+
+  '@types/keygrip@1.0.6':
+    resolution: {integrity: sha512-lZuNAY9xeJt7Bx4t4dx0rYCDqGPW8RXhQZK1td7d4H6E9zYbLoOtjBvfwdTKpsyxQI/2jv+armjX/RW+ZNpXOQ==}
+
+  '@types/koa-compose@3.2.9':
+    resolution: {integrity: sha512-BroAZ9FTvPiCy0Pi8tjD1OfJ7bgU1gQf0eR6e1Vm+JJATy9eKOG3hQMFtMciMawiSOVnLMdmUOC46s7HBhSTsA==}
+
+  '@types/koa@2.14.0':
+    resolution: {integrity: sha512-DTDUyznHGNHAl+wd1n0z1jxNajduyTh8R53xoewuerdBzGo6Ogj6F2299BFtrexJw4NtgjsI5SMPCmV9gZwGXA==}
+
+  '@types/koa__router@12.0.3':
+    resolution: {integrity: sha512-5YUJVv6NwM1z7m6FuYpKfNLTZ932Z6EF6xy2BbtpJSyn13DKNQEkXVffFVSnJHxvwwWh2SAeumpjAYUELqgjyw==}
+
+  '@types/memcached@2.2.10':
+    resolution: {integrity: sha512-AM9smvZN55Gzs2wRrqeMHVP7KE8KWgCJO/XL5yCly2xF6EKa4YlbpK+cLSAH4NG/Ah64HrlegmGqW8kYws7Vxg==}
+
+  '@types/methods@1.1.4':
+    resolution: {integrity: sha512-ymXWVrDiCxTBE3+RIrrP533E70eA+9qu7zdWoHuOmGujkYtzf4HQF96b8nwHLqhuf4ykX61IGRIB38CC6/sImQ==}
+
+  '@types/mime-db@1.43.6':
+    resolution: {integrity: sha512-r2cqxAt/Eo5yWBOQie1lyM1JZFCiORa5xtLlhSZI0w8RJggBPKw8c4g/fgQCzWydaDR5bL4imnmix2d1n52iBw==}
+
+  '@types/mime@1.3.5':
+    resolution: {integrity: sha512-/pyBZWSLD2n0dcHE3hq8s8ZvcETHtEuF+3E7XVt0Ig2nvsVQXdghHVcEkIWjy9A0wKfTn97a/PSDYohKIlnP/w==}
+
+  '@types/mysql@2.15.22':
+    resolution: {integrity: sha512-wK1pzsJVVAjYCSZWQoWHziQZbNggXFDUEIGf54g4ZM/ERuP86uGdWeKZWMYlqTPMZfHJJvLPyogXGvCOg87yLQ==}
+
+  '@types/node@18.19.130':
+    resolution: {integrity: sha512-GRaXQx6jGfL8sKfaIDD6OupbIHBr9jv7Jnaml9tB7l4v068PAOXqfcujMMo5PhbIs6ggR1XODELqahT2R8v0fg==}
+
+  '@types/node@20.19.39':
+    resolution: {integrity: sha512-orrrD74MBUyK8jOAD/r0+lfa1I2MO6I+vAkmAWzMYbCcgrN4lCrmK52gRFQq/JRxfYPfonkr4b0jcY7Olqdqbw==}
+
+  '@types/pg-pool@2.0.4':
+    resolution: {integrity: sha512-qZAvkv1K3QbmHHFYSNRYPkRjOWRLBYrL4B9c+wG0GSVGBw0NtJwPcgx/DSddeDJvRGMHCEQ4VMEVfuJ/0gZ3XQ==}
+
+  '@types/pg@8.20.0':
+    resolution: {integrity: sha512-bEPFOaMAHTEP1EzpvHTbmwR8UsFyHSKsRisLIHVMXnpNefSbGA1bD6CVy+qKjGSqmZqNqBDV2azOBo8TgkcVow==}
+
+  '@types/pg@8.6.1':
+    resolution: {integrity: sha512-1Kc4oAGzAl7uqUStZCDvaLFqZrW9qWSjXOmBfdgyBP5La7Us6Mg4GBvRlSoaZMhQF/zSj1C8CtKMBkoiT8eL8w==}
+
+  '@types/qs@6.15.0':
+    resolution: {integrity: sha512-JawvT8iBVWpzTrz3EGw9BTQFg3BQNmwERdKE22vlTxawwtbyUSlMppvZYKLZzB5zgACXdXxbD3m1bXaMqP/9ow==}
+
+  '@types/range-parser@1.2.7':
+    resolution: {integrity: sha512-hKormJbkJqzQGhziax5PItDUTMAM9uE2XXQmM37dyd4hVM+5aVl7oVxMVUiVQn2oCQFN/LKCZdvSM0pFRqbSmQ==}
+
+  '@types/send@0.17.6':
+    resolution: {integrity: sha512-Uqt8rPBE8SY0RK8JB1EzVOIZ32uqy8HwdxCnoCOsYrvnswqmFZ/k+9Ikidlk/ImhsdvBsloHbAlewb2IEBV/Og==}
+
+  '@types/send@1.2.1':
+    resolution: {integrity: sha512-arsCikDvlU99zl1g69TcAB3mzZPpxgw0UQnaHeC1Nwb015xp8bknZv5rIfri9xTOcMuaVgvabfIRA7PSZVuZIQ==}
+
+  '@types/serve-static@1.15.10':
+    resolution: {integrity: sha512-tRs1dB+g8Itk72rlSI2ZrW6vZg0YrLI81iQSTkMmOqnqCaNr/8Ek4VwWcN5vZgCYWbg/JJSGBlUaYGAOP73qBw==}
+
+  '@types/shimmer@1.2.0':
+    resolution: {integrity: sha512-UE7oxhQLLd9gub6JKIAhDq06T0F6FnztwMNRvYgjeQSBeMc1ZG/tA47EwfduvkuQS8apbkM/lpLpWsaCeYsXVg==}
+
+  '@types/ssh2-streams@0.1.13':
+    resolution: {integrity: sha512-faHyY3brO9oLEA0QlcO8N2wT7R0+1sHWZvQ+y3rMLwdY1ZyS1z0W3t65j9PqT4HmQ6ALzNe7RZlNuCNE0wBSWA==}
+
+  '@types/ssh2@0.5.52':
+    resolution: {integrity: sha512-lbLLlXxdCZOSJMCInKH2+9V/77ET2J6NPQHpFI0kda61Dd1KglJs+fPQBchizmzYSOJBgdTajhPqBO1xxLywvg==}
+
+  '@types/ssh2@1.15.5':
+    resolution: {integrity: sha512-N1ASjp/nXH3ovBHddRJpli4ozpk6UdDYIX4RJWFa9L1YKnzdhTlVmiGHm4DZnj/jLbqZpes4aeR30EFGQtvhQQ==}
+
+  '@types/superagent@8.1.9':
+    resolution: {integrity: sha512-pTVjI73witn+9ILmoJdajHGW2jkSaOzhiFYF1Rd3EQ94kymLqB9PjD9ISg7WaALC7+dCHT0FGe9T2LktLq/3GQ==}
+
+  '@types/supertest@6.0.3':
+    resolution: {integrity: sha512-8WzXq62EXFhJ7QsH3Ocb/iKQ/Ty9ZVWnVzoTKc9tyyFRRF3a74Tk2+TLFgaFFw364Ere+npzHKEJ6ga2LzIL7w==}
+
+  '@types/tedious@4.0.14':
+    resolution: {integrity: sha512-KHPsfX/FoVbUGbyYvk1q9MMQHLPeRZhRJZdO45Q4YjvFkv4hMNghCWTvy7rdKessBsmtz4euWCWAB6/tVpI1Iw==}
+
+  '@typescript-eslint/eslint-plugin@7.18.0':
+    resolution: {integrity: sha512-94EQTWZ40mzBc42ATNIBimBEDltSJ9RQHCC8vc/PDbxi4k8dVwUAv4o98dk50M1zB+JGFxp43FP7f8+FP8R6Sw==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+    peerDependencies:
+      '@typescript-eslint/parser': ^7.0.0
+      eslint: ^8.56.0
+      typescript: '*'
+    peerDependenciesMeta:
+      typescript:
+        optional: true
+
+  '@typescript-eslint/parser@7.18.0':
+    resolution: {integrity: sha512-4Z+L8I2OqhZV8qA132M4wNL30ypZGYOQVBfMgxDH/K5UX0PNqTu1c6za9ST5r9+tavvHiTWmBnKzpCJ/GlVFtg==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+    peerDependencies:
+      eslint: ^8.56.0
+      typescript: '*'
+    peerDependenciesMeta:
+      typescript:
+        optional: true
+
+  '@typescript-eslint/scope-manager@7.18.0':
+    resolution: {integrity: sha512-jjhdIE/FPF2B7Z1uzc6i3oWKbGcHb87Qw7AWj6jmEqNOfDFbJWtjt/XfwCpvNkpGWlcJaog5vTR+VV8+w9JflA==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+
+  '@typescript-eslint/type-utils@7.18.0':
+    resolution: {integrity: sha512-XL0FJXuCLaDuX2sYqZUUSOJ2sG5/i1AAze+axqmLnSkNEVMVYLF+cbwlB2w8D1tinFuSikHmFta+P+HOofrLeA==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+    peerDependencies:
+      eslint: ^8.56.0
+      typescript: '*'
+    peerDependenciesMeta:
+      typescript:
+        optional: true
+
+  '@typescript-eslint/types@7.18.0':
+    resolution: {integrity: sha512-iZqi+Ds1y4EDYUtlOOC+aUmxnE9xS/yCigkjA7XpTKV6nCBd3Hp/PRGGmdwnfkV2ThMyYldP1wRpm/id99spTQ==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+
+  '@typescript-eslint/typescript-estree@7.18.0':
+    resolution: {integrity: sha512-aP1v/BSPnnyhMHts8cf1qQ6Q1IFwwRvAQGRvBFkWlo3/lH29OXA3Pts+c10nxRxIBrDnoMqzhgdwVe5f2D6OzA==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+    peerDependencies:
+      typescript: '*'
+    peerDependenciesMeta:
+      typescript:
+        optional: true
+
+  '@typescript-eslint/utils@7.18.0':
+    resolution: {integrity: sha512-kK0/rNa2j74XuHVcoCZxdFBMF+aq/vH83CXAOHieC+2Gis4mF8jJXT5eAfyD3K0sAxtPuwxaIOIOvhwzVDt/kw==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+    peerDependencies:
+      eslint: ^8.56.0
+
+  '@typescript-eslint/visitor-keys@7.18.0':
+    resolution: {integrity: sha512-cDF0/Gf81QpY3xYyJKDV14Zwdmid5+uuENhjH2EqFaF0ni+yAyq/LzMaIJdhNJXZI7uLzwIlA+V7oWoyn6Curg==}
+    engines: {node: ^18.18.0 || >=20.0.0}
+
+  '@ungap/structured-clone@1.3.0':
+    resolution: {integrity: sha512-WmoN8qaIAo7WTYWbAZuG8PYEhn5fkz7dZrqTBZ7dtt//lL2Gwms1IcnQ5yHqjDfX8Ft5j4YzDM23f87zBfDe9g==}
+
+  '@unrs/resolver-binding-android-arm-eabi@1.11.1':
+    resolution: {integrity: sha512-ppLRUgHVaGRWUx0R0Ut06Mjo9gBaBkg3v/8AxusGLhsIotbBLuRk51rAzqLC8gq6NyyAojEXglNjzf6R948DNw==}
+    cpu: [arm]
+    os: [android]
+
+  '@unrs/resolver-binding-android-arm64@1.11.1':
+    resolution: {integrity: sha512-lCxkVtb4wp1v+EoN+HjIG9cIIzPkX5OtM03pQYkG+U5O/wL53LC4QbIeazgiKqluGeVEeBlZahHalCaBvU1a2g==}
+    cpu: [arm64]
+    os: [android]
+
+  '@unrs/resolver-binding-darwin-arm64@1.11.1':
+    resolution: {integrity: sha512-gPVA1UjRu1Y/IsB/dQEsp2V1pm44Of6+LWvbLc9SDk1c2KhhDRDBUkQCYVWe6f26uJb3fOK8saWMgtX8IrMk3g==}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@unrs/resolver-binding-darwin-x64@1.11.1':
+    resolution: {integrity: sha512-cFzP7rWKd3lZaCsDze07QX1SC24lO8mPty9vdP+YVa3MGdVgPmFc59317b2ioXtgCMKGiCLxJ4HQs62oz6GfRQ==}
+    cpu: [x64]
+    os: [darwin]
+
+  '@unrs/resolver-binding-freebsd-x64@1.11.1':
+    resolution: {integrity: sha512-fqtGgak3zX4DCB6PFpsH5+Kmt/8CIi4Bry4rb1ho6Av2QHTREM+47y282Uqiu3ZRF5IQioJQ5qWRV6jduA+iGw==}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@unrs/resolver-binding-linux-arm-gnueabihf@1.11.1':
+    resolution: {integrity: sha512-u92mvlcYtp9MRKmP+ZvMmtPN34+/3lMHlyMj7wXJDeXxuM0Vgzz0+PPJNsro1m3IZPYChIkn944wW8TYgGKFHw==}
+    cpu: [arm]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-arm-musleabihf@1.11.1':
+    resolution: {integrity: sha512-cINaoY2z7LVCrfHkIcmvj7osTOtm6VVT16b5oQdS4beibX2SYBwgYLmqhBjA1t51CarSaBuX5YNsWLjsqfW5Cw==}
+    cpu: [arm]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-arm64-gnu@1.11.1':
+    resolution: {integrity: sha512-34gw7PjDGB9JgePJEmhEqBhWvCiiWCuXsL9hYphDF7crW7UgI05gyBAi6MF58uGcMOiOqSJ2ybEeCvHcq0BCmQ==}
+    cpu: [arm64]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-arm64-musl@1.11.1':
+    resolution: {integrity: sha512-RyMIx6Uf53hhOtJDIamSbTskA99sPHS96wxVE/bJtePJJtpdKGXO1wY90oRdXuYOGOTuqjT8ACccMc4K6QmT3w==}
+    cpu: [arm64]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-ppc64-gnu@1.11.1':
+    resolution: {integrity: sha512-D8Vae74A4/a+mZH0FbOkFJL9DSK2R6TFPC9M+jCWYia/q2einCubX10pecpDiTmkJVUH+y8K3BZClycD8nCShA==}
+    cpu: [ppc64]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-riscv64-gnu@1.11.1':
+    resolution: {integrity: sha512-frxL4OrzOWVVsOc96+V3aqTIQl1O2TjgExV4EKgRY09AJ9leZpEg8Ak9phadbuX0BA4k8U5qtvMSQQGGmaJqcQ==}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-riscv64-musl@1.11.1':
+    resolution: {integrity: sha512-mJ5vuDaIZ+l/acv01sHoXfpnyrNKOk/3aDoEdLO/Xtn9HuZlDD6jKxHlkN8ZhWyLJsRBxfv9GYM2utQ1SChKew==}
+    cpu: [riscv64]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-s390x-gnu@1.11.1':
+    resolution: {integrity: sha512-kELo8ebBVtb9sA7rMe1Cph4QHreByhaZ2QEADd9NzIQsYNQpt9UkM9iqr2lhGr5afh885d/cB5QeTXSbZHTYPg==}
+    cpu: [s390x]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-x64-gnu@1.11.1':
+    resolution: {integrity: sha512-C3ZAHugKgovV5YvAMsxhq0gtXuwESUKc5MhEtjBpLoHPLYM+iuwSj3lflFwK3DPm68660rZ7G8BMcwSro7hD5w==}
+    cpu: [x64]
+    os: [linux]
+
+  '@unrs/resolver-binding-linux-x64-musl@1.11.1':
+    resolution: {integrity: sha512-rV0YSoyhK2nZ4vEswT/QwqzqQXw5I6CjoaYMOX0TqBlWhojUf8P94mvI7nuJTeaCkkds3QE4+zS8Ko+GdXuZtA==}
+    cpu: [x64]
+    os: [linux]
+
+  '@unrs/resolver-binding-wasm32-wasi@1.11.1':
+    resolution: {integrity: sha512-5u4RkfxJm+Ng7IWgkzi3qrFOvLvQYnPBmjmZQ8+szTK/b31fQCnleNl1GgEt7nIsZRIf5PLhPwT0WM+q45x/UQ==}
+    engines: {node: '>=14.0.0'}
+    cpu: [wasm32]
+
+  '@unrs/resolver-binding-win32-arm64-msvc@1.11.1':
+    resolution: {integrity: sha512-nRcz5Il4ln0kMhfL8S3hLkxI85BXs3o8EYoattsJNdsX4YUU89iOkVn7g0VHSRxFuVMdM4Q1jEpIId1Ihim/Uw==}
+    cpu: [arm64]
+    os: [win32]
+
+  '@unrs/resolver-binding-win32-ia32-msvc@1.11.1':
+    resolution: {integrity: sha512-DCEI6t5i1NmAZp6pFonpD5m7i6aFrpofcp4LA2i8IIq60Jyo28hamKBxNrZcyOwVOZkgsRp9O2sXWBWP8MnvIQ==}
+    cpu: [ia32]
+    os: [win32]
+
+  '@unrs/resolver-binding-win32-x64-msvc@1.11.1':
+    resolution: {integrity: sha512-lrW200hZdbfRtztbygyaq/6jP6AKE8qQN2KvPcJ+x7wiD038YtnYtZ82IMNJ69GJibV7bwL3y9FgK+5w/pYt6g==}
+    cpu: [x64]
+    os: [win32]
+
+  '@vitest/coverage-v8@1.6.1':
+    resolution: {integrity: sha512-6YeRZwuO4oTGKxD3bijok756oktHSIm3eczVVzNe3scqzuhLwltIF3S9ZL/vwOVIpURmU6SnZhziXXAfw8/Qlw==}
+    peerDependencies:
+      vitest: 1.6.1
+
+  '@vitest/expect@1.6.1':
+    resolution: {integrity: sha512-jXL+9+ZNIJKruofqXuuTClf44eSpcHlgj3CiuNihUF3Ioujtmc0zIa3UJOW5RjDK1YLBJZnWBlPuqhYycLioog==}
+
+  '@vitest/runner@1.6.1':
+    resolution: {integrity: sha512-3nSnYXkVkf3mXFfE7vVyPmi3Sazhb/2cfZGGs0JRzFsPFvAMBEcrweV1V1GsrstdXeKCTXlJbvnQwGWgEIHmOA==}
+
+  '@vitest/snapshot@1.6.1':
+    resolution: {integrity: sha512-WvidQuWAzU2p95u8GAKlRMqMyN1yOJkGHnx3M1PL9Raf7AQ1kwLKg04ADlCa3+OXUZE7BceOhVZiuWAbzCKcUQ==}
+
+  '@vitest/spy@1.6.1':
+    resolution: {integrity: sha512-MGcMmpGkZebsMZhbQKkAf9CX5zGvjkBTqf8Zx3ApYWXr3wG+QvEu2eXWfnIIWYSJExIp4V9FCKDEeygzkYrXMw==}
+
+  '@vitest/utils@1.6.1':
+    resolution: {integrity: sha512-jOrrUvXM4Av9ZWiG1EajNto0u96kWAhJ1LmPmJhXXQx/32MecEKd10pOLYgS2BQx1TgkGhloPU1ArDW2vvaY6g==}
+
+  abort-controller@3.0.0:
+    resolution: {integrity: sha512-h8lQ8tacZYnR3vNQTgibj+tODHI5/+l06Au2Pcriv/Gmet0eaj4TwWH41sO9wnHDiQsEj19q0drzdWdeAHtweg==}
+    engines: {node: '>=6.5'}
+
+  accepts@1.3.8:
+    resolution: {integrity: sha512-PYAthTa2m2VKxuvSD3DPC/Gy+U+sOA1LAuT8mkmRuvw+NACSaeXEQ+NHcVF7rONl6qcaxV3Uuemwawk+7+SJLw==}
+    engines: {node: '>= 0.6'}
+
+  acorn-import-assertions@1.9.0:
+    resolution: {integrity: sha512-cmMwop9x+8KFhxvKrKfPYmN6/pKTYYHBqLa0DfvVZcKMJWNyWLnaqND7dx/qn66R7ewM1UX5XMaDVP5wlVTaVA==}
+    deprecated: package has been renamed to acorn-import-attributes
+    peerDependencies:
+      acorn: ^8
+
+  acorn-import-attributes@1.9.5:
+    resolution: {integrity: sha512-n02Vykv5uA3eHGM/Z2dQrcD56kL8TyDb2p1+0P83PClMnC/nc+anbQRhIOWnSq4Ke/KvDPrY3C9hDtC/A3eHnQ==}
+    peerDependencies:
+      acorn: ^8
+
+  acorn-jsx@5.3.2:
+    resolution: {integrity: sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==}
+    peerDependencies:
+      acorn: ^6.0.0 || ^7.0.0 || ^8.0.0
+
+  acorn-walk@8.3.5:
+    resolution: {integrity: sha512-HEHNfbars9v4pgpW6SO1KSPkfoS0xVOM/9UzkJltjlsHZmJasxg8aXkuZa7SMf8vKGIBhpUsPluQSqhJFCqebw==}
+    engines: {node: '>=0.4.0'}
+
+  acorn@8.16.0:
+    resolution: {integrity: sha512-UVJyE9MttOsBQIDKw1skb9nAwQuR5wuGD3+82K6JgJlm/Y+KI92oNsMNGZCYdDsVtRHSak0pcV5Dno5+4jh9sw==}
+    engines: {node: '>=0.4.0'}
+    hasBin: true
+
+  agent-base@7.1.4:
+    resolution: {integrity: sha512-MnA+YT8fwfJPgBx3m60MNqakm30XOkyIoH1y6huTQvC0PwZG7ki8NacLBcrPbNoo8vEZy7Jpuk7+jMO+CUovTQ==}
+    engines: {node: '>= 14'}
+
+  ajv@6.14.0:
+    resolution: {integrity: sha512-IWrosm/yrn43eiKqkfkHis7QioDleaXQHdDVPKg0FSwwd/DuvyX79TZnFOnYpB7dcsFAMmtFztZuXPDvSePkFw==}
+
+  ansi-regex@5.0.1:
+    resolution: {integrity: sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==}
+    engines: {node: '>=8'}
+
+  ansi-regex@6.2.2:
+    resolution: {integrity: sha512-Bq3SmSpyFHaWjPk8If9yc6svM8c56dB5BAtW4Qbw5jHTwwXXcTLoRMkpDJp6VL0XzlWaCHTXrkFURMYmD0sLqg==}
+    engines: {node: '>=12'}
+
+  ansi-styles@4.3.0:
+    resolution: {integrity: sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==}
+    engines: {node: '>=8'}
+
+  ansi-styles@5.2.0:
+    resolution: {integrity: sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA==}
+    engines: {node: '>=10'}
+
+  ansi-styles@6.2.3:
+    resolution: {integrity: sha512-4Dj6M28JB+oAH8kFkTLUo+a2jwOFkuqb3yucU0CANcRRUbxS0cP0nZYCGjcc3BNXwRIsUVmDGgzawme7zvJHvg==}
+    engines: {node: '>=12'}
+
+  append-field@1.0.0:
+    resolution: {integrity: sha512-klpgFSWLW1ZEs8svjfb7g4qWY0YS5imI82dTg+QahUvJ8YqAY0P10Uk8tTyh9ZGuYEZEMaeJYCF5BFuX552hsw==}
+
+  archiver-utils@5.0.2:
+    resolution: {integrity: sha512-wuLJMmIBQYCsGZgYLTy5FIB2pF6Lfb6cXMSF8Qywwk3t20zWnAi7zLcQFdKQmIB8wyZpY5ER38x08GbwtR2cLA==}
+    engines: {node: '>= 14'}
+
+  archiver@7.0.1:
+    resolution: {integrity: sha512-ZcbTaIqJOfCc03QwD468Unz/5Ir8ATtvAHsK+FdXbDIbGfihqh9mrvdcYunQzqn4HrvWWaFyaxJhGZagaJJpPQ==}
+    engines: {node: '>= 14'}
+
+  argparse@2.0.1:
+    resolution: {integrity: sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==}
+
+  array-buffer-byte-length@1.0.2:
+    resolution: {integrity: sha512-LHE+8BuR7RYGDKvnrmcuSq3tDcKv9OFEXQt/HpbZhY7V6h0zlUXutnAD82GiFx9rdieCMjkvtcsPqBwgUl1Iiw==}
+    engines: {node: '>= 0.4'}
+
+  array-flatten@1.1.1:
+    resolution: {integrity: sha512-PCVAQswWemu6UdxsDFFX/+gVeYqKAod3D3UVm91jHwynguOwAvYPhx8nNlM++NqRcK6CxxpUafjmhIdKiHibqg==}
+
+  array-includes@3.1.9:
+    resolution: {integrity: sha512-FmeCCAenzH0KH381SPT5FZmiA/TmpndpcaShhfgEN9eCVjnFBqq3l1xrI42y8+PPLI6hypzou4GXw00WHmPBLQ==}
+    engines: {node: '>= 0.4'}
+
+  array-union@2.1.0:
+    resolution: {integrity: sha512-HGyxoOTYUyCM6stUe6EJgnd4EoewAI7zMdfqO+kGjnlZmBDz/cR5pf8r/cR4Wq60sL/p0IkcjUEEPwS3GFrIyw==}
+    engines: {node: '>=8'}
+
+  array.prototype.findlastindex@1.2.6:
+    resolution: {integrity: sha512-F/TKATkzseUExPlfvmwQKGITM3DGTK+vkAsCZoDc5daVygbJBnjEUCbgkAvVFsgfXfX4YIqZ/27G3k3tdXrTxQ==}
+    engines: {node: '>= 0.4'}
+
+  array.prototype.flat@1.3.3:
+    resolution: {integrity: sha512-rwG/ja1neyLqCuGZ5YYrznA62D4mZXg0i1cIskIUKSiqF3Cje9/wXAls9B9s1Wa2fomMsIv8czB8jZcPmxCXFg==}
+    engines: {node: '>= 0.4'}
+
+  array.prototype.flatmap@1.3.3:
+    resolution: {integrity: sha512-Y7Wt51eKJSyi80hFrJCePGGNo5ktJCslFuboqJsbf57CCPcm5zztluPlc4/aD8sWsKvlwatezpV4U1efk8kpjg==}
+    engines: {node: '>= 0.4'}
+
+  arraybuffer.prototype.slice@1.0.4:
+    resolution: {integrity: sha512-BNoCY6SXXPQ7gF2opIP4GBE+Xw7U+pHMYKuzjgCN3GwiaIR09UUeKfheyIry77QtrCBlC0KK0q5/TER/tYh3PQ==}
+    engines: {node: '>= 0.4'}
+
+  asap@2.0.6:
+    resolution: {integrity: sha512-BSHWgDSAiKs50o2Re8ppvp3seVHXSRM44cdSsT9FfNEUUZLOGWVCsiWaRPWM1Znn+mqZ1OfVZ3z3DWEzSp7hRA==}
+
+  asn1@0.2.6:
+    resolution: {integrity: sha512-ix/FxPn0MDjeyJ7i/yoHGFt/EX6LyNbxSEhPPXODPL+KB0VPk86UYfL0lMdy+KCnv+fmvIzySwaK5COwqVbWTQ==}
+
+  assertion-error@1.1.0:
+    resolution: {integrity: sha512-jgsaNduz+ndvGyFt3uSuWqvy4lCnIJiovtouQN5JZHOKCS2QuhEdbcQHFhVksz2N2U9hXJo8odG7ETyWlEeuDw==}
+
+  async-function@1.0.0:
+    resolution: {integrity: sha512-hsU18Ae8CDTR6Kgu9DYf0EbCr/a5iGL0rytQDobUcdpYOKokk8LEjVphnXkDkgpi0wYVsqrXuP0bZxJaTqdgoA==}
+    engines: {node: '>= 0.4'}
+
+  async-lock@1.4.1:
+    resolution: {integrity: sha512-Az2ZTpuytrtqENulXwO3GGv1Bztugx6TT37NIo7imr/Qo0gsYiGtSdBa2B6fsXhTpVZDNfu1Qn3pk531e3q+nQ==}
+
+  async@3.2.6:
+    resolution: {integrity: sha512-htCUDlxyyCLMgaM3xXg0C0LW2xqfuQ6p05pCEIsXuyQ+a1koYKTuBMzRNwmybfLgvJDMd0r1LTn4+E0Ti6C2AA==}
+
+  asynckit@0.4.0:
+    resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
+
+  atomic-sleep@1.0.0:
+    resolution: {integrity: sha512-kNOjDqAh7px0XWNI+4QbzoiR/nTkHAWNud2uvnJquD1/x5a7EQZMJT0AczqK0Qn67oY/TTQ1LbUKajZpp3I9tQ==}
+    engines: {node: '>=8.0.0'}
+
+  available-typed-arrays@1.0.7:
+    resolution: {integrity: sha512-wvUjBtSGN7+7SjNpq/9M2Tg350UZD3q62IFZLbRAR1bSMlCo1ZaeW+BJ+D090e4hIIZLBcTDWe4Mh4jvUDajzQ==}
+    engines: {node: '>= 0.4'}
+
+  b4a@1.8.0:
+    resolution: {integrity: sha512-qRuSmNSkGQaHwNbM7J78Wwy+ghLEYF1zNrSeMxj4Kgw6y33O3mXcQ6Ie9fRvfU/YnxWkOchPXbaLb73TkIsfdg==}
+    peerDependencies:
+      react-native-b4a: '*'
+    peerDependenciesMeta:
+      react-native-b4a:
+        optional: true
+
+  balanced-match@1.0.2:
+    resolution: {integrity: sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==}
+
+  bare-events@2.8.2:
+    resolution: {integrity: sha512-riJjyv1/mHLIPX4RwiK+oW9/4c3TEUeORHKefKAKnZ5kyslbN+HXowtbaVEqt4IMUB7OXlfixcs6gsFeo/jhiQ==}
+    peerDependencies:
+      bare-abort-controller: '*'
+    peerDependenciesMeta:
+      bare-abort-controller:
+        optional: true
+
+  bare-fs@4.7.1:
+    resolution: {integrity: sha512-WDRsyVN52eAx/lBamKD6uyw8H4228h/x0sGGGegOamM2cd7Pag88GfMQalobXI+HaEUxpCkbKQUDOQqt9wawRw==}
+    engines: {bare: '>=1.16.0'}
+    peerDependencies:
+      bare-buffer: '*'
+    peerDependenciesMeta:
+      bare-buffer:
+        optional: true
+
+  bare-os@3.8.7:
+    resolution: {integrity: sha512-G4Gr1UsGeEy2qtDTZwL7JFLo2wapUarz7iTMcYcMFdS89AIQuBoyjgXZz0Utv7uHs3xA9LckhVbeBi8lEQrC+w==}
+    engines: {bare: '>=1.14.0'}
+
+  bare-path@3.0.0:
+    resolution: {integrity: sha512-tyfW2cQcB5NN8Saijrhqn0Zh7AnFNsnczRcuWODH0eYAXBsJ5gVxAUuNr7tsHSC6IZ77cA0SitzT+s47kot8Mw==}
+
+  bare-stream@2.13.0:
+    resolution: {integrity: sha512-3zAJRZMDFGjdn+RVnNpF9kuELw+0Fl3lpndM4NcEOhb9zwtSo/deETfuIwMSE5BXanA0FrN1qVjffGwAg2Y7EA==}
+    peerDependencies:
+      bare-abort-controller: '*'
+      bare-buffer: '*'
+      bare-events: '*'
+    peerDependenciesMeta:
+      bare-abort-controller:
+        optional: true
+      bare-buffer:
+        optional: true
+      bare-events:
+        optional: true
+
+  bare-url@2.4.1:
+    resolution: {integrity: sha512-fZapLWNB25gS+etK27NV9KgBNXgo2yeYHuj+OyPblQd6GYAE3JVy6aKxszMV5jhGGFwraXQKA5fldvf3lMyEqw==}
+
+  base64-js@1.5.1:
+    resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}
+
+  bcrypt-pbkdf@1.0.2:
+    resolution: {integrity: sha512-qeFIXtP4MSoi6NLqO12WfqARWWuCKi2Rn/9hJLEmtB5yTNr9DqFWkJRCf2qShWzPeAMRnOgCrq0sg/KLv5ES9w==}
+
+  bignumber.js@9.3.1:
+    resolution: {integrity: sha512-Ko0uX15oIUS7wJ3Rb30Fs6SkVbLmPBAKdlm7q9+ak9bbIeFf0MwuBsQV6z7+X768/cHsfg+WlysDWJcmthjsjQ==}
+
+  bl@4.1.0:
+    resolution: {integrity: sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==}
+
+  body-parser@1.20.4:
+    resolution: {integrity: sha512-ZTgYYLMOXY9qKU/57FAo8F+HA2dGX7bqGc71txDRC1rS4frdFI5R7NhluHxH6M0YItAP0sHB4uqAOcYKxO6uGA==}
+    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
+
+  brace-expansion@1.1.14:
+    resolution: {integrity: sha512-MWPGfDxnyzKU7rNOW9SP/c50vi3xrmrua/+6hfPbCS2ABNWfx24vPidzvC7krjU/RTo235sV776ymlsMtGKj8g==}
+
+  brace-expansion@2.1.0:
+    resolution: {integrity: sha512-TN1kCZAgdgweJhWWpgKYrQaMNHcDULHkWwQIspdtjV4Y5aurRdZpjAqn6yX3FPqTA9ngHCc4hJxMAMgGfve85w==}
+
+  braces@3.0.3:
+    resolution: {integrity: sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==}
+    engines: {node: '>=8'}
+
+  buffer-crc32@1.0.0:
+    resolution: {integrity: sha512-Db1SbgBS/fg/392AblrMJk97KggmvYhr4pB5ZIMTWtaivCPMWLkmb7m21cJvpvgK+J3nsU2CmmixNBZx4vFj/w==}
+    engines: {node: '>=8.0.0'}
+
+  buffer-from@1.1.2:
+    resolution: {integrity: sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ==}
+
+  buffer@5.7.1:
+    resolution: {integrity: sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==}
+
+  buffer@6.0.3:
+    resolution: {integrity: sha512-FTiCpNxtwiZZHEZbcbTIcZjERVICn9yq/pDFkTl95/AxzD1naBctN7YO68riM/gLSDY7sdrMby8hofADYuuqOA==}
+
+  buildcheck@0.0.7:
+    resolution: {integrity: sha512-lHblz4ahamxpTmnsk+MNTRWsjYKv965MwOrSJyeD588rR3Jcu7swE+0wN5F+PbL5cjgu/9ObkhfzEPuofEMwLA==}
+    engines: {node: '>=10.0.0'}
+
+  bullmq@5.74.1:
+    resolution: {integrity: sha512-GfJEos2zoOGM9xqkB7VZouwwFuejKFqm667cBcmbBekJXKqqXWk4QYP3Uy2pzgUwCbg1cR7GgGmGczM7fnhWSA==}
+
+  busboy@1.6.0:
+    resolution: {integrity: sha512-8SFQbg/0hQ9xy3UNTB0YEnsNBbWfhf7RtnzpL7TkBiTBRfrQ9Fxcnz7VJsleJpyp6rVLvXiuORqjlHi5q+PYuA==}
+    engines: {node: '>=10.16.0'}
+
+  byline@5.0.0:
+    resolution: {integrity: sha512-s6webAy+R4SR8XVuJWt2V2rGvhnrhxN+9S15GNuTK3wKPOXFF6RNc+8ug2XhH+2s4f+uudG4kUVYmYOQWL2g0Q==}
+    engines: {node: '>=0.10.0'}
+
+  bytes@3.1.2:
+    resolution: {integrity: sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==}
+    engines: {node: '>= 0.8'}
+
+  cac@6.7.14:
+    resolution: {integrity: sha512-b6Ilus+c3RrdDk+JhLKUAQfzzgLEPy6wcXqS7f/xe1EETvsDP6GORG7SFuOs6cID5YkqchW/LXZbX5bc8j7ZcQ==}
+    engines: {node: '>=8'}
+
+  call-bind-apply-helpers@1.0.2:
+    resolution: {integrity: sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==}
+    engines: {node: '>= 0.4'}
+
+  call-bind@1.0.9:
+    resolution: {integrity: sha512-a/hy+pNsFUTR+Iz8TCJvXudKVLAnz/DyeSUo10I5yvFDQJBFU2s9uqQpoSrJlroHUKoKqzg+epxyP9lqFdzfBQ==}
+    engines: {node: '>= 0.4'}
+
+  call-bound@1.0.4:
+    resolution: {integrity: sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==}
+    engines: {node: '>= 0.4'}
+
+  callsites@3.1.0:
+    resolution: {integrity: sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==}
+    engines: {node: '>=6'}
+
+  chai@4.5.0:
+    resolution: {integrity: sha512-RITGBfijLkBddZvnn8jdqoTypxvqbOLYQkGGxXzeFjVHvudaPw0HNFD9x928/eUwYWd2dPCugVqspGALTZZQKw==}
+    engines: {node: '>=4'}
+
+  chalk@4.1.2:
+    resolution: {integrity: sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==}
+    engines: {node: '>=10'}
+
+  check-error@1.0.3:
+    resolution: {integrity: sha512-iKEoDYaRmd1mxM90a2OEfWhjsjPpYPuQ+lMYsoxB126+t8fw7ySEO48nmDg5COTjxDI65/Y2OWpeEHk3ZOe8zg==}
+
+  chownr@1.1.4:
+    resolution: {integrity: sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==}
+
+  cjs-module-lexer@1.4.3:
+    resolution: {integrity: sha512-9z8TZaGM1pfswYeXrUpzPrkx8UnWYdhJclsiYMm6x/w5+nN+8Tf/LnAgfLGQCm59qAOxU8WwHEq2vNwF6i4j+Q==}
+
+  cli-color@2.0.4:
+    resolution: {integrity: sha512-zlnpg0jNcibNrO7GG9IeHH7maWFeCz+Ja1wx/7tZNU5ASSSSZ+/qZciM0/LHCYxSdqv5h2sdbQ/PXYdOuetXvA==}
+    engines: {node: '>=0.10'}
+
+  cliui@8.0.1:
+    resolution: {integrity: sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==}
+    engines: {node: '>=12'}
+
+  cluster-key-slot@1.1.2:
+    resolution: {integrity: sha512-RMr0FhtfXemyinomL4hrWcYJxmX6deFdCxpJzhDttxgO1+bcCnkk+9drydLVDmAMG7NE6aN/fl4F7ucU/90gAA==}
+    engines: {node: '>=0.10.0'}
+
+  color-convert@2.0.1:
+    resolution: {integrity: sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==}
+    engines: {node: '>=7.0.0'}
+
+  color-name@1.1.4:
+    resolution: {integrity: sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==}
+
+  combined-stream@1.0.8:
+    resolution: {integrity: sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==}
+    engines: {node: '>= 0.8'}
+
+  commander@9.5.0:
+    resolution: {integrity: sha512-KRs7WVDKg86PWiuAqhDrAQnTXZKraVcCc6vFdL14qrZ/DcWwuRo7VoiYXalXO7S5GKpqYiVEwCbgFDfxNHKJBQ==}
+    engines: {node: ^12.20.0 || >=14}
+
+  component-emitter@1.3.1:
+    resolution: {integrity: sha512-T0+barUSQRTUQASh8bx02dl+DhF54GtIDY13Y3m9oWTklKbb3Wv974meRpeZ3lp1JpLVECWWNHC4vaG2XHXouQ==}
+
+  compress-commons@6.0.2:
+    resolution: {integrity: sha512-6FqVXeETqWPoGcfzrXb37E50NP0LXT8kAMu5ooZayhWWdgEY4lBEEcbQNXtkuKQsGduxiIcI4gOTsxTmuq/bSg==}
+    engines: {node: '>= 14'}
+
+  concat-map@0.0.1:
+    resolution: {integrity: sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==}
+
+  concat-stream@2.0.0:
+    resolution: {integrity: sha512-MWufYdFw53ccGjCA+Ol7XJYpAlW6/prSMzuPOTRnJGcGzuhLn4Scrz7qf6o8bROZ514ltazcIFJZevcfbo0x7A==}
+    engines: {'0': node >= 6.0}
+
+  confbox@0.1.8:
+    resolution: {integrity: sha512-RMtmw0iFkeR4YV+fUOSucriAQNb9g8zFR52MWCtl+cCZOFRNL6zeB395vPzFhEjjn4fMxXudmELnl/KF/WrK6w==}
+
+  consola@2.15.3:
+    resolution: {integrity: sha512-9vAdYbHj6x2fLKC4+oPH0kFzY/orMZyG2Aj+kNylHxKGJ/Ed4dpNyAQYwJOdqO4zdM7XpVHmyejQDcQHrnuXbw==}
+
+  content-disposition@0.5.4:
+    resolution: {integrity: sha512-FveZTNuGw04cxlAiWbzi6zTAL/lhehaWbTtgluJh4/E95DqMwTmha3KZN1aAWA8cFIhHzMZUvLevkw5Rqk+tSQ==}
+    engines: {node: '>= 0.6'}
+
+  content-type@1.0.5:
+    resolution: {integrity: sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==}
+    engines: {node: '>= 0.6'}
+
+  cookie-signature@1.0.7:
+    resolution: {integrity: sha512-NXdYc3dLr47pBkpUCHtKSwIOQXLVn8dZEuywboCOJY/osA0wFSLlSawr3KN8qXJEyX66FcONTH8EIlVuK0yyFA==}
+
+  cookie-signature@1.2.2:
+    resolution: {integrity: sha512-D76uU73ulSXrD1UXF4KE2TMxVVwhsnCgfAyTg9k8P6KGZjlXKrOLe4dJQKI3Bxi5wjesZoFXJWElNWBjPZMbhg==}
+    engines: {node: '>=6.6.0'}
+
+  cookie@0.7.2:
+    resolution: {integrity: sha512-yki5XnKuf750l50uGTllt6kKILY4nQ1eNIQatoXEByZ5dWgnKqbnqmTrBE5B4N7lrMJKQ2ytWMiTO2o0v6Ew/w==}
+    engines: {node: '>= 0.6'}
+
+  cookiejar@2.1.4:
+    resolution: {integrity: sha512-LDx6oHrK+PhzLKJU9j5S7/Y3jM/mUHvD/DeI1WQmJn652iPC5Y4TBzC9l+5OMOXlyTTA+SmVUPm0HQUwpD5Jqw==}
+
+  core-util-is@1.0.3:
+    resolution: {integrity: sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ==}
+
+  cors@2.8.5:
+    resolution: {integrity: sha512-KIHbLJqu73RGr/hnbrO9uBeixNGuvSQjul/jdFvS/KFSIH1hWVd1ng7zOHx+YrEfInLG7q4n6GHQ9cDtxv/P6g==}
+    engines: {node: '>= 0.10'}
+
+  cpu-features@0.0.10:
+    resolution: {integrity: sha512-9IkYqtX3YHPCzoVg1Py+o9057a3i0fp7S530UWokCSaFVTc7CwXPRiOjRjBQQ18ZCNafx78YfnG+HALxtVmOGA==}
+    engines: {node: '>=10.0.0'}
+
+  crc-32@1.2.2:
+    resolution: {integrity: sha512-ROmzCKrTnOwybPcJApAA6WBWij23HVfGVNKqqrZpuyZOHqK2CwHSvpGuyt/UNNvaIjEd8X5IFGp4Mh+Ie1IHJQ==}
+    engines: {node: '>=0.8'}
+    hasBin: true
+
+  crc32-stream@6.0.0:
+    resolution: {integrity: sha512-piICUB6ei4IlTv1+653yq5+KoqfBYmj9bw6LqXoOneTMDXk5nM1qt12mFW1caG3LlJXEKW1Bp0WggEmIfQB34g==}
+    engines: {node: '>= 14'}
+
+  cron-parser@4.9.0:
+    resolution: {integrity: sha512-p0SaNjrHOnQeR8/VnfGbmg9te2kfyYSQ7Sc/j/6DtPL3JQvKxmjO9TSjNFpujqV3vEYYBvNNvXSxzyksBWAx1Q==}
+    engines: {node: '>=12.0.0'}
+
+  cross-spawn@7.0.6:
+    resolution: {integrity: sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==}
+    engines: {node: '>= 8'}
+
+  d@1.0.2:
+    resolution: {integrity: sha512-MOqHvMWF9/9MX6nza0KgvFH4HpMU0EF5uUDXqX/BtxtU8NfB0QzRtJ8Oe/6SuS4kbhyzVJwjd97EA4PKrzJ8bw==}
+    engines: {node: '>=0.12'}
+
+  data-view-buffer@1.0.2:
+    resolution: {integrity: sha512-EmKO5V3OLXh1rtK2wgXRansaK1/mtVdTUEiEI0W8RkvgT05kfxaH29PliLnpLP73yYO6142Q72QNa8Wx/A5CqQ==}
+    engines: {node: '>= 0.4'}
+
+  data-view-byte-length@1.0.2:
+    resolution: {integrity: sha512-tuhGbE6CfTM9+5ANGf+oQb72Ky/0+s3xKUpHvShfiz2RxMFgFPjsXuRLBVMtvMs15awe45SRb83D6wH4ew6wlQ==}
+    engines: {node: '>= 0.4'}
+
+  data-view-byte-offset@1.0.1:
+    resolution: {integrity: sha512-BS8PfmtDGnrgYdOonGZQdLZslWIeCGFP9tpan0hi1Co2Zr2NKADsvGYA8XxuG/4UWgJ6Cjtv+YJnB6MM69QGlQ==}
+    engines: {node: '>= 0.4'}
+
+  debug@2.6.9:
+    resolution: {integrity: sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA==}
+    peerDependencies:
+      supports-color: '*'
+    peerDependenciesMeta:
+      supports-color:
+        optional: true
+
+  debug@3.2.7:
+    resolution: {integrity: sha512-CFjzYYAi4ThfiQvizrFQevTTXHtnCqWfe7x1AhgEscTz6ZbLbfoLRLPugTQyBth6f8ZERVUSyWHFD/7Wu4t1XQ==}
+    peerDependencies:
+      supports-color: '*'
+    peerDependenciesMeta:
+      supports-color:
+        optional: true
+
+  debug@4.4.3:
+    resolution: {integrity: sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==}
+    engines: {node: '>=6.0'}
+    peerDependencies:
+      supports-color: '*'
+    peerDependenciesMeta:
+      supports-color:
+        optional: true
+
+  deep-eql@4.1.4:
+    resolution: {integrity: sha512-SUwdGfqdKOwxCPeVYjwSyRpJ7Z+fhpwIAtmCUdZIWZ/YP5R9WAsyuSgpLVDi9bjWoN2LXHNss/dk3urXtdQxGg==}
+    engines: {node: '>=6'}
+
+  deep-is@0.1.4:
+    resolution: {integrity: sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ==}
+
+  define-data-property@1.1.4:
+    resolution: {integrity: sha512-rBMvIzlpA8v6E+SJZoo++HAYqsLrkg7MSfIinMPFhmkorw7X+dOXVJQs+QT69zGkzMyfDnIMN2Wid1+NbL3T+A==}
+    engines: {node: '>= 0.4'}
+
+  define-properties@1.2.1:
+    resolution: {integrity: sha512-8QmQKqEASLd5nx0U1B1okLElbUuuttJ/AnYmRXbbbGDWh6uS208EjD4Xqq/I9wK7u0v6O08XhTWnt5XtEbR6Dg==}
+    engines: {node: '>= 0.4'}
+
+  delayed-stream@1.0.0:
+    resolution: {integrity: sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==}
+    engines: {node: '>=0.4.0'}
+
+  denque@2.1.0:
+    resolution: {integrity: sha512-HVQE3AAb/pxF8fQAoiqpvg9i3evqug3hoiwakOyZAwJm+6vZehbkYXZ0l4JxS+I3QxM97v5aaRNhj8v5oBhekw==}
+    engines: {node: '>=0.10'}
+
+  depd@2.0.0:
+    resolution: {integrity: sha512-g7nH6P6dyDioJogAAGprGpCtVImJhpPk/roCzdb3fIh61/s/nPsfR6onyMwkCAR/OlC3yBC0lESvUoQEAssIrw==}
+    engines: {node: '>= 0.8'}
+
+  destroy@1.2.0:
+    resolution: {integrity: sha512-2sJGJTaXIIaR1w4iJSNoN0hnMY7Gpc/n8D4qSCJw8QqFWXf7cuAgnEHxBpweaVcPevC2l3KpjYCx3NypQQgaJg==}
+    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
+
+  detect-libc@2.1.2:
+    resolution: {integrity: sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==}
+    engines: {node: '>=8'}
+
+  dezalgo@1.0.4:
+    resolution: {integrity: sha512-rXSP0bf+5n0Qonsb+SVVfNfIsimO4HEtmnIpPHY8Q1UCzKlQrDMfdobr8nJOOsRgWCyMRqeSBQzmWUMq7zvVig==}
+
+  diff-sequences@29.6.3:
+    resolution: {integrity: sha512-EjePK1srD3P08o2j4f0ExnylqRs5B9tJjcp9t1krH2qRi8CCdsYfwe9JgSLurFBWwq4uOlipzfk5fHNvwFKr8Q==}
+    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}
+
+  difflib@0.2.4:
+    resolution: {integrity: sha512-9YVwmMb0wQHQNr5J9m6BSj6fk4pfGITGQOOs+D9Fl+INODWFOfvhIU1hNv6GgR1RBoC/9NJcwu77zShxV0kT7w==}
+
+  dir-glob@3.0.1:
+    resolution: {integrity: sha512-WkrWp9GR4KXfKGYzOLmTuGVi1UWFfws377n9cc55/tb6DuqyF6pcQ5AbiHEshaDpY9v6oaSr2XCDidGmMwdzIA==}
+    engines: {node: '>=8'}
+
+  docker-compose@0.24.8:
+    resolution: {integrity: sha512-plizRs/Vf15H+GCVxq2EUvyPK7ei9b/cVesHvjnX4xaXjM9spHe2Ytq0BitndFgvTJ3E3NljPNUEl7BAN43iZw==}
+    engines: {node: '>= 6.0.0'}
+
+  docker-modem@5.0.7:
+    resolution: {integrity: sha512-XJgGhoR/CLpqshm4d3L7rzH6t8NgDFUIIpztYlLHIApeJjMZKYJMz2zxPsYxnejq5h3ELYSw/RBsi3t5h7gNTA==}
+    engines: {node: '>= 8.0'}
+
+  dockerode@4.0.10:
+    resolution: {integrity: sha512-8L/P9JynLBiG7/coiA4FlQXegHltRqS0a+KqI44P1zgQh8QLHTg7FKOwhkBgSJwZTeHsq30WRoVFLuwkfK0YFg==}
+    engines: {node: '>= 8.0'}
+
+  doctrine@2.1.0:
+    resolution: {integrity: sha512-35mSku4ZXK0vfCuHEDAwt55dg2jNajHZ1odvF+8SSr82EsZY4QmXfuWso8oEd8zRhVObSN18aM0CjSdoBX7zIw==}
+    engines: {node: '>=0.10.0'}
+
+  doctrine@3.0.0:
+    resolution: {integrity: sha512-yS+Q5i3hBf7GBkd4KG8a7eBNNWNGLTaEwwYWUijIYM7zrlYDM0BFXHjjPWlWZ1Rg7UaddZeIDmi9jF3HmqiQ2w==}
+    engines: {node: '>=6.0.0'}
+
+  dreamopt@0.8.0:
+    resolution: {integrity: sha512-vyJTp8+mC+G+5dfgsY+r3ckxlz+QMX40VjPQsZc5gxVAxLmi64TBoVkP54A/pRAXMXsbu2GMMBrZPxNv23waMg==}
+    engines: {node: '>=0.4.0'}
+
+  drizzle-kit@0.21.4:
+    resolution: {integrity: sha512-Nxcc1ONJLRgbhmR+azxjNF9Ly9privNLEIgW53c92whb4xp8jZLH1kMCh/54ci1mTMuYxPdOukqLwJ8wRudNwA==}
+    hasBin: true
+
+  drizzle-orm@0.30.10:
+    resolution: {integrity: sha512-IRy/QmMWw9lAQHpwbUh1b8fcn27S/a9zMIzqea1WNOxK9/4EB8gIo+FZWLiPXzl2n9ixGSv8BhsLZiOppWEwBw==}
+    peerDependencies:
+      '@aws-sdk/client-rds-data': '>=3'
+      '@cloudflare/workers-types': '>=3'
+      '@electric-sql/pglite': '>=0.1.1'
+      '@libsql/client': '*'
+      '@neondatabase/serverless': '>=0.1'
+      '@op-engineering/op-sqlite': '>=2'
+      '@opentelemetry/api': ^1.4.1
+      '@planetscale/database': '>=1'
+      '@types/better-sqlite3': '*'
+      '@types/pg': '*'
+      '@types/react': '>=18'
+      '@types/sql.js': '*'
+      '@vercel/postgres': '>=0.8.0'
+      '@xata.io/client': '*'
+      better-sqlite3: '>=7'
+      bun-types: '*'
+      expo-sqlite: '>=13.2.0'
+      knex: '*'
+      kysely: '*'
+      mysql2: '>=2'
+      pg: '>=8'
+      postgres: '>=3'
+      react: '>=18'
+      sql.js: '>=1'
+      sqlite3: '>=5'
+    peerDependenciesMeta:
+      '@aws-sdk/client-rds-data':
+        optional: true
+      '@cloudflare/workers-types':
+        optional: true
+      '@electric-sql/pglite':
+        optional: true
+      '@libsql/client':
+        optional: true
+      '@neondatabase/serverless':
+        optional: true
+      '@op-engineering/op-sqlite':
+        optional: true
+      '@opentelemetry/api':
+        optional: true
+      '@planetscale/database':
+        optional: true
+      '@types/better-sqlite3':
+        optional: true
+      '@types/pg':
+        optional: true
+      '@types/react':
+        optional: true
+      '@types/sql.js':
+        optional: true
+      '@vercel/postgres':
+        optional: true
+      '@xata.io/client':
+        optional: true
+      better-sqlite3:
+        optional: true
+      bun-types:
+        optional: true
+      expo-sqlite:
+        optional: true
+      knex:
+        optional: true
+      kysely:
+        optional: true
+      mysql2:
+        optional: true
+      pg:
+        optional: true
+      postgres:
+        optional: true
+      react:
+        optional: true
+      sql.js:
+        optional: true
+      sqlite3:
+        optional: true
+
+  dunder-proto@1.0.1:
+    resolution: {integrity: sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==}
+    engines: {node: '>= 0.4'}
+
+  eastasianwidth@0.2.0:
+    resolution: {integrity: sha512-I88TYZWc9XiYHRQ4/3c5rjjfgkjhLyW2luGIheGERbNQ6OY7yTybanSpDXZa8y7VUP9YmDcYa+eyq4ca7iLqWA==}
+
+  ee-first@1.1.1:
+    resolution: {integrity: sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==}
+
+  emoji-regex@8.0.0:
+    resolution: {integrity: sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==}
+
+  emoji-regex@9.2.2:
+    resolution: {integrity: sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==}
+
+  encodeurl@2.0.0:
+    resolution: {integrity: sha512-Q0n9HRi4m6JuGIV1eFlmvJB7ZEVxu93IrMyiMsGC0lrMJMWzRgx6WGquyfQgZVb31vhGgXnfmPNNXmxnOkRBrg==}
+    engines: {node: '>= 0.8'}
+
+  end-of-stream@1.4.5:
+    resolution: {integrity: sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg==}
+
+  env-paths@3.0.0:
+    resolution: {integrity: sha512-dtJUTepzMW3Lm/NPxRf3wP4642UWhjL2sQxc+ym2YMj1m/H2zDNQOlezafzkHwn6sMstjHTwG6iQQsctDW/b1A==}
+    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}
+
+  es-abstract@1.24.2:
+    resolution: {integrity: sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==}
+    engines: {node: '>= 0.4'}
+
+  es-define-property@1.0.1:
+    resolution: {integrity: sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==}
+    engines: {node: '>= 0.4'}
+
+  es-errors@1.3.0:
+    resolution: {integrity: sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==}
+    engines: {node: '>= 0.4'}
+
+  es-object-atoms@1.1.1:
+    resolution: {integrity: sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==}
+    engines: {node: '>= 0.4'}
+
+  es-set-tostringtag@2.1.0:
+    resolution: {integrity: sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==}
+    engines: {node: '>= 0.4'}
+
+  es-shim-unscopables@1.1.0:
+    resolution: {integrity: sha512-d9T8ucsEhh8Bi1woXCf+TIKDIROLG5WCkxg8geBCbvk22kzwC5G2OnXVMO6FUsvQlgUUXQ2itephWDLqDzbeCw==}
+    engines: {node: '>= 0.4'}
+
+  es-to-primitive@1.3.0:
+    resolution: {integrity: sha512-w+5mJ3GuFL+NjVtJlvydShqE1eN3h3PbI7/5LAsYJP/2qtuMXjfL2LpHSRqo4b4eSF5K/DH1JXKUAHSB2UW50g==}
+    engines: {node: '>= 0.4'}
+
+  es5-ext@0.10.64:
+    resolution: {integrity: sha512-p2snDhiLaXe6dahss1LddxqEm+SkuDvV8dnIQG0MWjyHpcMNfXKPE+/Cc0y+PhxJX3A4xGNeFCj5oc0BUh6deg==}
+    engines: {node: '>=0.10'}
+
+  es6-iterator@2.0.3:
+    resolution: {integrity: sha512-zw4SRzoUkd+cl+ZoE15A9o1oQd920Bb0iOJMQkQhl3jNc03YqVjAhG7scf9C5KWRU/R13Orf588uCC6525o02g==}
+
+  es6-symbol@3.1.4:
+    resolution: {integrity: sha512-U9bFFjX8tFiATgtkJ1zg25+KviIXpgRvRHS8sau3GfhVzThRQrOeksPeT0BWW2MNZs1OEWJ1DPXOQMn0KKRkvg==}
+    engines: {node: '>=0.12'}
+
+  es6-weak-map@2.0.3:
+    resolution: {integrity: sha512-p5um32HOTO1kP+w7PRnB+5lQ43Z6muuMuIMffvDN8ZB4GcnjLBV6zGStpbASIMk4DCAvEaamhe2zhyCb/QXXsA==}
+
+  esbuild-register@3.6.0:
+    resolution: {integrity: sha512-H2/S7Pm8a9CL1uhp9OvjwrBh5Pvx0H8qVOxNu8Wed9Y7qv56MPtq+GGM8RJpq6glYJn9Wspr8uw7l55uyinNeg==}
+    peerDependencies:
+      esbuild: '>=0.12 <1'
+
+  esbuild@0.18.20:
+    resolution: {integrity: sha512-ceqxoedUrcayh7Y7ZX6NdbbDzGROiyVBgC4PriJThBKSVPWnnFHZAkfI1lJT8QFkOwH4qOS2SJkS4wvpGl8BpA==}
+    engines: {node: '>=12'}
+    hasBin: true
+
+  esbuild@0.19.12:
+    resolution: {integrity: sha512-aARqgq8roFBj054KvQr5f1sFu0D65G+miZRCuJyJ0G13Zwx7vRar5Zhn2tkQNzIXcBrNVsv/8stehpj+GAjgbg==}
+    engines: {node: '>=12'}
+    hasBin: true
+
+  esbuild@0.21.5:
+    resolution: {integrity: sha512-mg3OPMV4hXywwpoDxu3Qda5xCKQi+vCTZq8S9J/EpkhB2HzKXq4SNFZE3+NK93JYxc8VMSep+lOUSC/RVKaBqw==}
+    engines: {node: '>=12'}
+    hasBin: true
+
+  esbuild@0.27.7:
+    resolution: {integrity: sha512-IxpibTjyVnmrIQo5aqNpCgoACA/dTKLTlhMHihVHhdkxKyPO1uBBthumT0rdHmcsk9uMonIWS0m4FljWzILh3w==}
+    engines: {node: '>=18'}
+    hasBin: true
+
+  escalade@3.2.0:
+    resolution: {integrity: sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==}
+    engines: {node: '>=6'}
+
+  escape-html@1.0.3:
+    resolution: {integrity: sha512-NiSupZ4OeuGwr68lGIeym/ksIZMJodUGOSCZ/FSnTxcrekbvqrgdUxlJOMpijaKZVjAJrWrGs/6Jy8OMuyj9ow==}
+
+  escape-string-regexp@4.0.0:
+    resolution: {integrity: sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA==}
+    engines: {node: '>=10'}
+
+  eslint-import-resolver-node@0.3.10:
+    resolution: {integrity: sha512-tRrKqFyCaKict5hOd244sL6EQFNycnMQnBe+j8uqGNXYzsImGbGUU4ibtoaBmv5FLwJwcFJNeg1GeVjQfbMrDQ==}
+
+  eslint-import-resolver-typescript@3.10.1:
+    resolution: {integrity: sha512-A1rHYb06zjMGAxdLSkN2fXPBwuSaQ0iO5M/hdyS0Ajj1VBaRp0sPD3dn1FhME3c/JluGFbwSxyCfqdSbtQLAHQ==}
+    engines: {node: ^14.18.0 || >=16.0.0}
+    peerDependencies:
+      eslint: '*'
+      eslint-plugin-import: '*'
+      eslint-plugin-import-x: '*'
+    peerDependenciesMeta:
+      eslint-plugin-import:
+        optional: true
+      eslint-plugin-import-x:
+        optional: true
+
+  eslint-module-utils@2.12.1:
+    resolution: {integrity: sha512-L8jSWTze7K2mTg0vos/RuLRS5soomksDPoJLXIslC7c8Wmut3bx7CPpJijDcBZtxQ5lrbUdM+s0OlNbz0DCDNw==}
+    engines: {node: '>=4'}
+    peerDependencies:
+      '@typescript-eslint/parser': '*'
+      eslint: '*'
+      eslint-import-resolver-node: '*'
+      eslint-import-resolver-typescript: '*'
+      eslint-import-resolver-webpack: '*'
+    peerDependenciesMeta:
+      '@typescript-eslint/parser':
+        optional: true
+      eslint:
+        optional: true
+      eslint-import-resolver-node:
+        optional: true
+      eslint-import-resolver-typescript:
+        optional: true
+      eslint-import-resolver-webpack:
+        optional: true
+
+  eslint-plugin-import@2.32.0:
+    resolution: {integrity: sha512-whOE1HFo/qJDyX4SnXzP4N6zOWn79WhnCUY/iDR0mPfQZO8wcYE4JClzI2oZrhBnnMUCBCHZhO6VQyoBU95mZA==}
+    engines: {node: '>=4'}
+    peerDependencies:
+      '@typescript-eslint/parser': '*'
+      eslint: ^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9
+    peerDependenciesMeta:
+      '@typescript-eslint/parser':
+        optional: true
+
+  eslint-scope@7.2.2:
+    resolution: {integrity: sha512-dOt21O7lTMhDM+X9mB4GX+DZrZtCUJPL/wlcTqxyrx5IvO0IYtILdtrQGQp+8n5S0gwSVmOf9NQrjMOgfQZlIg==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+
+  eslint-visitor-keys@3.4.3:
+    resolution: {integrity: sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+
+  eslint@8.57.1:
+    resolution: {integrity: sha512-ypowyDxpVSYpkXr9WPv2PAZCtNip1Mv5KTW0SCurXv/9iOpcrH9PaqUElksqEB6pChqHGDRCFTyrZlGhnLNGiA==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+    deprecated: This version is no longer supported. Please see https://eslint.org/version-support for other options.
+    hasBin: true
+
+  esniff@2.0.1:
+    resolution: {integrity: sha512-kTUIGKQ/mDPFoJ0oVfcmyJn4iBDRptjNVIzwIFR7tqWXdVI9xfA2RMwY/gbSpJG3lkdWNEjLap/NqVHZiJsdfg==}
+    engines: {node: '>=0.10'}
+
+  espree@9.6.1:
+    resolution: {integrity: sha512-oruZaFkjorTpF32kDSI5/75ViwGeZginGGy2NoOSg3Q9bnwlnmDm4HLnkl0RE3n+njDXR037aY1+x58Z/zFdwQ==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+
+  esquery@1.7.0:
+    resolution: {integrity: sha512-Ap6G0WQwcU/LHsvLwON1fAQX9Zp0A2Y6Y/cJBl9r/JbW90Zyg4/zbG6zzKa2OTALELarYHmKu0GhpM5EO+7T0g==}
+    engines: {node: '>=0.10'}
+
+  esrecurse@4.3.0:
+    resolution: {integrity: sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==}
+    engines: {node: '>=4.0'}
+
+  estraverse@5.3.0:
+    resolution: {integrity: sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==}
+    engines: {node: '>=4.0'}
+
+  estree-walker@3.0.3:
+    resolution: {integrity: sha512-7RUKfXgSMMkzt6ZuXmqapOurLGPPfgj6l9uRZ7lRGolvk0y2yocc35LdcxKC5PQZdn2DMqioAQ2NoWcrTKmm6g==}
+
+  esutils@2.0.3:
+    resolution: {integrity: sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==}
+    engines: {node: '>=0.10.0'}
+
+  etag@1.8.1:
+    resolution: {integrity: sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==}
+    engines: {node: '>= 0.6'}
+
+  event-emitter@0.3.5:
+    resolution: {integrity: sha512-D9rRn9y7kLPnJ+hMq7S/nhvoKwwvVJahBi2BPmx3bvbsEdK3W9ii8cBSGjP+72/LnM4n6fo3+dkCX5FeTQruXA==}
+
+  event-target-shim@5.0.1:
+    resolution: {integrity: sha512-i/2XbnSz/uxRCU6+NdVJgKWDTM427+MqYbkQzD321DuCQJUqOuJKIA0IM2+W2xtYHdKOmZ4dR6fExsd4SXL+WQ==}
+    engines: {node: '>=6'}
+
+  events-universal@1.0.1:
+    resolution: {integrity: sha512-LUd5euvbMLpwOF8m6ivPCbhQeSiYVNb8Vs0fQ8QjXo0JTkEHpz8pxdQf0gStltaPpw0Cca8b39KxvK9cfKRiAw==}
+
+  events@3.3.0:
+    resolution: {integrity: sha512-mQw+2fkQbALzQ7V0MY0IqdnXNOeTtP4r0lN9z7AAawCXgqea7bDii20AYrIBrFd/Hx0M2Ocz6S111CaFkUcb0Q==}
+    engines: {node: '>=0.8.x'}
+
+  execa@8.0.1:
+    resolution: {integrity: sha512-VyhnebXciFV2DESc+p6B+y0LjSm0krU4OgJN44qFAhBY0TJ+1V61tYD2+wHusZ6F9n5K+vl8k0sTy7PEfV4qpg==}
+    engines: {node: '>=16.17'}
+
+  express@4.22.1:
+    resolution: {integrity: sha512-F2X8g9P1X7uCPZMA3MVf9wcTqlyNp7IhH5qPCI0izhaOIYXaW9L535tGA3qmjRzpH+bZczqq7hVKxTR4NWnu+g==}
+    engines: {node: '>= 0.10.0'}
+
+  ext@1.7.0:
+    resolution: {integrity: sha512-6hxeJYaL110a9b5TEJSj0gojyHQAmA2ch5Os+ySCiA1QGdS697XWY1pzsrSjqA9LDEEgdB/KypIlR59RcLuHYw==}
+
+  extend@3.0.2:
+    resolution: {integrity: sha512-fjquC59cD7CyW6urNXK0FBufkZcoiGG80wTuPujX590cB5Ttln20E2UB4S/WARVqhXffZl2LNgS+gQdPIIim/g==}
+
+  fast-deep-equal@3.1.3:
+    resolution: {integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==}
+
+  fast-fifo@1.3.2:
+    resolution: {integrity: sha512-/d9sfos4yxzpwkDkuN7k2SqFKtYNmCTzgfEpz82x34IM9/zc8KGxQoXg1liNC/izpRM/MBdt44Nmx41ZWqk+FQ==}
+
+  fast-glob@3.3.3:
+    resolution: {integrity: sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==}
+    engines: {node: '>=8.6.0'}
+
+  fast-json-stable-stringify@2.1.0:
+    resolution: {integrity: sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==}
+
+  fast-levenshtein@2.0.6:
+    resolution: {integrity: sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==}
+
+  fast-redact@3.5.0:
+    resolution: {integrity: sha512-dwsoQlS7h9hMeYUq1W++23NDcBLV4KqONnITDV9DjfS3q1SgDGVrBdvvTLUotWtPSD7asWDV9/CmsZPy8Hf70A==}
+    engines: {node: '>=6'}
+
+  fast-safe-stringify@2.1.1:
+    resolution: {integrity: sha512-W+KJc2dmILlPplD/H4K9l9LcAHAfPtP6BY84uVLXQ6Evcz9Lcg33Y2z1IVblT6xdY54PXYVHEv+0Wpq8Io6zkA==}
+
+  fastq@1.20.1:
+    resolution: {integrity: sha512-GGToxJ/w1x32s/D2EKND7kTil4n8OVk/9mycTc4VDza13lOvpUZTGX3mFSCtV9ksdGBVzvsyAVLM6mHFThxXxw==}
+
+  fdir@6.5.0:
+    resolution: {integrity: sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==}
+    engines: {node: '>=12.0.0'}
+    peerDependencies:
+      picomatch: ^3 || ^4
+    peerDependenciesMeta:
+      picomatch:
+        optional: true
+
+  fengari-interop@0.1.4:
+    resolution: {integrity: sha512-4/CW/3PJUo3ebD4ACgE1g/3NGEYSq7OQAyETyypsAl/WeySDBbxExikkayNkZzbpgyC9GyJp8v1DU2VOXxNq7Q==}
+    peerDependencies:
+      fengari: ^0.1.0
+
+  fengari@0.1.5:
+    resolution: {integrity: sha512-0DS4Nn4rV8qyFlQCpKK8brT61EUtswynrpfFTcgLErcilBIBskSMQ86fO2WVuybr14ywyKdRjv91FiRZwnEuvQ==}
+
+  fflate@0.8.2:
+    resolution: {integrity: sha512-cPJU47OaAoCbg0pBvzsgpTPhmhqI5eJjh/JIu8tPj5q+T7iLvW/JAYUqmE7KOB4R1ZyEhzBaIQpQpardBF5z8A==}
+
+  file-entry-cache@6.0.1:
+    resolution: {integrity: sha512-7Gps/XWymbLk2QLYK4NzpMOrYjMhdIxXuIvy2QBsLE6ljuodKvdkWs/cpyJJ3CVIVpH0Oi1Hvg1ovbMzLdFBBg==}
+    engines: {node: ^10.12.0 || >=12.0.0}
+
+  file-type@20.4.1:
+    resolution: {integrity: sha512-hw9gNZXUfZ02Jo0uafWLaFVPter5/k2rfcrjFJJHX/77xtSDOfJuEFb6oKlFV86FLP1SuyHMW1PSk0U9M5tKkQ==}
+    engines: {node: '>=18'}
+
+  fill-range@7.1.1:
+    resolution: {integrity: sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==}
+    engines: {node: '>=8'}
+
+  finalhandler@1.3.2:
+    resolution: {integrity: sha512-aA4RyPcd3badbdABGDuTXCMTtOneUCAYH/gxoYRTZlIJdF0YPWuGqiAsIrhNnnqdXGswYk6dGujem4w80UJFhg==}
+    engines: {node: '>= 0.8'}
+
+  find-up@5.0.0:
+    resolution: {integrity: sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng==}
+    engines: {node: '>=10'}
+
+  flat-cache@3.2.0:
+    resolution: {integrity: sha512-CYcENa+FtcUKLmhhqyctpclsq7QF38pKjZHsGNiSQF5r4FtoKDWabFDl3hzaEQMvT1LHEysw5twgLvpYYb4vbw==}
+    engines: {node: ^10.12.0 || >=12.0.0}
+
+  flatted@3.4.2:
+    resolution: {integrity: sha512-PjDse7RzhcPkIJwy5t7KPWQSZ9cAbzQXcafsetQoD7sOJRQlGikNbx7yZp2OotDnJyrDcbyRq3Ttb18iYOqkxA==}
+
+  for-each@0.3.5:
+    resolution: {integrity: sha512-dKx12eRCVIzqCxFGplyFKJMPvLEWgmNtUrpTiJIR5u97zEhRG8ySrtboPHZXx7daLxQVrl643cTzbab2tkQjxg==}
+    engines: {node: '>= 0.4'}
+
+  foreground-child@3.3.1:
+    resolution: {integrity: sha512-gIXjKqtFuWEgzFRJA9WCQeSJLZDjgJUOMCMzxtvFq/37KojM1BFGufqsCy0r4qSQmYLsZYMeyRqzIWOMup03sw==}
+    engines: {node: '>=14'}
+
+  form-data@4.0.5:
+    resolution: {integrity: sha512-8RipRLol37bNs2bhoV67fiTEvdTrbMUYcFTiy3+wuuOnUog2QBHCZWXDRijWQfAkhBj2Uf5UnVaiWwA5vdd82w==}
+    engines: {node: '>= 6'}
+
+  formidable@3.5.4:
+    resolution: {integrity: sha512-YikH+7CUTOtP44ZTnUhR7Ic2UASBPOqmaRkRKxRbywPTe5VxF7RRCck4af9wutiZ/QKM5nME9Bie2fFaPz5Gug==}
+    engines: {node: '>=14.0.0'}
+
+  forwarded@0.2.0:
+    resolution: {integrity: sha512-buRG0fpBtRHSTCOASe6hD258tEubFoRLb4ZNA6NxMVHNw2gOcwHo9wyablzMzOA5z9xA9L1KNjk/Nt6MT9aYow==}
+    engines: {node: '>= 0.6'}
+
+  fresh@0.5.2:
+    resolution: {integrity: sha512-zJ2mQYM18rEFOudeV4GShTGIQ7RbzA7ozbU9I/XBpm7kqgMywgmylMwXHxZJmkVoYkna9d2pVXVXPdYTP9ej8Q==}
+    engines: {node: '>= 0.6'}
+
+  fs-constants@1.0.0:
+    resolution: {integrity: sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==}
+
+  fs.realpath@1.0.0:
+    resolution: {integrity: sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw==}
+
+  fsevents@2.3.3:
+    resolution: {integrity: sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==}
+    engines: {node: ^8.16.0 || ^10.6.0 || >=11.0.0}
+    os: [darwin]
+
+  function-bind@1.1.2:
+    resolution: {integrity: sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==}
+
+  function.prototype.name@1.1.8:
+    resolution: {integrity: sha512-e5iwyodOHhbMr/yNrc7fDYG4qlbIvI5gajyzPnb5TCwyhjApznQh1BMFou9b30SevY43gCJKXycoCBjMbsuW0Q==}
+    engines: {node: '>= 0.4'}
+
+  functions-have-names@1.2.3:
+    resolution: {integrity: sha512-xckBUXyTIqT97tq2x2AMb+g163b5JFysYk0x4qxNFwbfQkmNZoiRHb6sPzI9/QV33WeuvVYBUIiD4NzNIyqaRQ==}
+
+  gaxios@6.7.1:
+    resolution: {integrity: sha512-LDODD4TMYx7XXdpwxAVRAIAuB0bzv0s+ywFonY46k126qzQHT9ygyoa9tncmOiQmmDrik65UYsEkv3lbfqQ3yQ==}
+    engines: {node: '>=14'}
+
+  gcp-metadata@6.1.1:
+    resolution: {integrity: sha512-a4tiq7E0/5fTjxPAaH4jpjkSv/uCaU2p5KC6HVGrvl0cDjA8iBZv4vv1gyzlmK0ZUKqwpOyQMKzZQe3lTit77A==}
+    engines: {node: '>=14'}
+
+  generator-function@2.0.1:
+    resolution: {integrity: sha512-SFdFmIJi+ybC0vjlHN0ZGVGHc3lgE0DxPAT0djjVg+kjOnSqclqmj0KQ7ykTOLP6YxoqOvuAODGdcHJn+43q3g==}
+    engines: {node: '>= 0.4'}
+
+  get-caller-file@2.0.5:
+    resolution: {integrity: sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==}
+    engines: {node: 6.* || 8.* || >= 10.*}
+
+  get-func-name@2.0.2:
+    resolution: {integrity: sha512-8vXOvuE167CtIc3OyItco7N/dpRtBbYOsPsXCz7X/PMnlGjYjSGuZJgM1Y7mmew7BKf9BqvLX2tnOVy1BBUsxQ==}
+
+  get-intrinsic@1.3.0:
+    resolution: {integrity: sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==}
+    engines: {node: '>= 0.4'}
+
+  get-port@7.2.0:
+    resolution: {integrity: sha512-afP4W205ONCuMoPBqcR6PSXnzX35KTcJygfJfcp+QY+uwm3p20p1YczWXhlICIzGMCxYBQcySEcOgsJcrkyobg==}
+    engines: {node: '>=16'}
+
+  get-proto@1.0.1:
+    resolution: {integrity: sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g==}
+    engines: {node: '>= 0.4'}
+
+  get-stream@8.0.1:
+    resolution: {integrity: sha512-VaUJspBffn/LMCJVoMvSAdmscJyS1auj5Zulnn5UoYcY531UWmdwhRWkcGKnGU93m5HSXP9LP2usOryrBtQowA==}
+    engines: {node: '>=16'}
+
+  get-symbol-description@1.1.0:
+    resolution: {integrity: sha512-w9UMqWwJxHNOvoNzSJ2oPF5wvYcvP7jUvYzhp67yEhTi17ZDBBC1z9pTdGuzjD+EFIqLSYRweZjqfiPzQ06Ebg==}
+    engines: {node: '>= 0.4'}
+
+  get-tsconfig@4.14.0:
+    resolution: {integrity: sha512-yTb+8DXzDREzgvYmh6s9vHsSVCHeC0G3PI5bEXNBHtmshPnO+S5O7qgLEOn0I5QvMy6kpZN8K1NKGyilLb93wA==}
+
+  glob-parent@5.1.2:
+    resolution: {integrity: sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==}
+    engines: {node: '>= 6'}
+
+  glob-parent@6.0.2:
+    resolution: {integrity: sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==}
+    engines: {node: '>=10.13.0'}
+
+  glob@10.5.0:
+    resolution: {integrity: sha512-DfXN8DfhJ7NH3Oe7cFmu3NCu1wKbkReJ8TorzSAFbSKrlNaQSKfIzqYqVY8zlbs2NLBbWpRiU52GX2PbaBVNkg==}
+    deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
+    hasBin: true
+
+  glob@7.2.3:
+    resolution: {integrity: sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q==}
+    deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
+
+  glob@8.1.0:
+    resolution: {integrity: sha512-r8hpEjiQEYlF2QU0df3dS+nxxSIreXQS1qRhMJM0Q5NDdR386C7jb7Hwwod8Fgiuex+k0GFjgft18yvxm5XoCQ==}
+    engines: {node: '>=12'}
+    deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
+
+  globals@13.24.0:
+    resolution: {integrity: sha512-AhO5QUcj8llrbG09iWhPU2B204J1xnPeL8kQmVorSsy+Sjj1sk8gIyh6cUocGmH4L0UuhAJy+hJMRA4mgA4mFQ==}
+    engines: {node: '>=8'}
+
+  globalthis@1.0.4:
+    resolution: {integrity: sha512-DpLKbNU4WylpxJykQujfCcwYWiV/Jhm50Goo0wrVILAv5jOr9d+H+UR3PhSCD2rCCEIg0uc+G+muBTwD54JhDQ==}
+    engines: {node: '>= 0.4'}
+
+  globby@11.1.0:
+    resolution: {integrity: sha512-jhIXaOzy1sb8IyocaruWSn1TjmnBVs8Ayhcy83rmxNJ8q2uWKCAj3CnJY+KpGSXCueAPc0i05kVvVKtP1t9S3g==}
+    engines: {node: '>=10'}
+
+  google-logging-utils@0.0.2:
+    resolution: {integrity: sha512-NEgUnEcBiP5HrPzufUkBzJOD/Sxsco3rLNo1F1TNf7ieU8ryUzBhqba8r756CjLX7rn3fHl6iLEwPYuqpoKgQQ==}
+    engines: {node: '>=14'}
+
+  gopd@1.2.0:
+    resolution: {integrity: sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==}
+    engines: {node: '>= 0.4'}
+
+  graceful-fs@4.2.11:
+    resolution: {integrity: sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==}
+
+  graphemer@1.4.0:
+    resolution: {integrity: sha512-EtKwoO6kxCL9WO5xipiHTZlSzBm7WLT627TqC/uVRd0HKmq8NXyebnNYxDoBi7wt8eTWrUrKXCOVaFq9x1kgag==}
+
+  hanji@0.0.5:
+    resolution: {integrity: sha512-Abxw1Lq+TnYiL4BueXqMau222fPSPMFtya8HdpWsz/xVAhifXou71mPh/kY2+08RgFcVccjG3uZHs6K5HAe3zw==}
+
+  has-bigints@1.1.0:
+    resolution: {integrity: sha512-R3pbpkcIqv2Pm3dUwgjclDRVmWpTJW2DcMzcIhEXEx1oh/CEMObMm3KLmRJOdvhM7o4uQBnwr8pzRK2sJWIqfg==}
+    engines: {node: '>= 0.4'}
+
+  has-flag@4.0.0:
+    resolution: {integrity: sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==}
+    engines: {node: '>=8'}
+
+  has-property-descriptors@1.0.2:
+    resolution: {integrity: sha512-55JNKuIW+vq4Ke1BjOTjM2YctQIvCT7GFzHwmfZPGo5wnrgkid0YQtnAleFSqumZm4az3n2BS+erby5ipJdgrg==}
+
+  has-proto@1.2.0:
+    resolution: {integrity: sha512-KIL7eQPfHQRC8+XluaIw7BHUwwqL19bQn4hzNgdr+1wXoU0KKj6rufu47lhY7KbJR2C6T6+PfyN0Ea7wkSS+qQ==}
+    engines: {node: '>= 0.4'}
+
+  has-symbols@1.1.0:
+    resolution: {integrity: sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ==}
+    engines: {node: '>= 0.4'}
+
+  has-tostringtag@1.0.2:
+    resolution: {integrity: sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==}
+    engines: {node: '>= 0.4'}
+
+  hasown@2.0.3:
+    resolution: {integrity: sha512-ej4AhfhfL2Q2zpMmLo7U1Uv9+PyhIZpgQLGT1F9miIGmiCJIoCgSmczFdrc97mWT4kVY72KA+WnnhJ5pghSvSg==}
+    engines: {node: '>= 0.4'}
+
+  heap@0.2.7:
+    resolution: {integrity: sha512-2bsegYkkHO+h/9MGbn6KWcE45cHZgPANo5LXF7EvWdT0yT2EguSVO1nDgU5c8+ZOPwp2vMNa7YFsJhVcDR9Sdg==}
+
+  html-escaper@2.0.2:
+    resolution: {integrity: sha512-H2iMtd0I4Mt5eYiapRdIDjp+XzelXQ0tFE4JS7YFwFevXXMmOp9myNrUvCg0D6ws8iqkRPBfKHgbwig1SmlLfg==}
+
+  http-errors@2.0.1:
+    resolution: {integrity: sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==}
+    engines: {node: '>= 0.8'}
+
+  https-proxy-agent@7.0.6:
+    resolution: {integrity: sha512-vK9P5/iUfdl95AI+JVyUuIcVtd4ofvtrOr3HNtM2yxC9bnMbEdp3x01OhQNnjb8IJYi38VlTE3mBXwcfvywuSw==}
+    engines: {node: '>= 14'}
+
+  human-signals@5.0.0:
+    resolution: {integrity: sha512-AXcZb6vzzrFAUE61HnN4mpLqd/cSIwNQjtNWR0euPm6y0iqx3G4gOXaIDdtdDwZmhwe82LA6+zinmW4UBWVePQ==}
+    engines: {node: '>=16.17.0'}
+
+  iconv-lite@0.4.24:
+    resolution: {integrity: sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA==}
+    engines: {node: '>=0.10.0'}
+
+  ieee754@1.2.1:
+    resolution: {integrity: sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==}
+
+  ignore@5.3.2:
+    resolution: {integrity: sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==}
+    engines: {node: '>= 4'}
+
+  immediate@3.0.6:
+    resolution: {integrity: sha512-XXOFtyqDjNDAQxVfYxuF7g9Il/IbWmmlQg2MYKOH8ExIT1qg6xc4zyS3HaEEATgs1btfzxq15ciUiY7gjSXRGQ==}
+
+  import-fresh@3.3.1:
+    resolution: {integrity: sha512-TR3KfrTZTYLPB6jUjfx6MF9WcWrHL9su5TObK4ZkYgBdWKPOFoSoQIdEuTuR82pmtxH2spWG9h6etwfr1pLBqQ==}
+    engines: {node: '>=6'}
+
+  import-in-the-middle@1.7.1:
+    resolution: {integrity: sha512-1LrZPDtW+atAxH42S6288qyDFNQ2YCty+2mxEPRtfazH6Z5QwkaBSTS2ods7hnVJioF6rkRfNoA6A/MstpFXLg==}
+
+  import-in-the-middle@1.7.4:
+    resolution: {integrity: sha512-Lk+qzWmiQuRPPulGQeK5qq0v32k2bHnWrRPFgqyvhw7Kkov5L6MOLOIU3pcWeujc9W4q54Cp3Q2WV16eQkc7Bg==}
+
+  imurmurhash@0.1.4:
+    resolution: {integrity: sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==}
+    engines: {node: '>=0.8.19'}
+
+  inflight@1.0.6:
+    resolution: {integrity: sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA==}
+    deprecated: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
+
+  inherits@2.0.4:
+    resolution: {integrity: sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==}
+
+  internal-slot@1.1.0:
+    resolution: {integrity: sha512-4gd7VpWNQNB4UKKCFFVcp1AVv+FMOgs9NKzjHKusc8jTMhd5eL1NqQqOpE0KzMds804/yHlglp3uxgluOqAPLw==}
+    engines: {node: '>= 0.4'}
+
+  ioredis-mock@8.13.1:
+    resolution: {integrity: sha512-Wsi50AU+cMiI32nAgfwpUaJVBtb4iQdVsOHl9M6R3tePCO/8vGsToCVIG82XWAxN4Se55TZoOzVseu+QngFLyw==}
+    engines: {node: '>=12.22'}
+    peerDependencies:
+      '@types/ioredis-mock': ^8
+      ioredis: ^5
+
+  ioredis@5.10.1:
+    resolution: {integrity: sha512-HuEDBTI70aYdx1v6U97SbNx9F1+svQKBDo30o0b9fw055LMepzpOOd0Ccg9Q6tbqmBSJaMuY0fB7yw9/vjBYCA==}
+    engines: {node: '>=12.22.0'}
+
+  ipaddr.js@1.9.1:
+    resolution: {integrity: sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==}
+    engines: {node: '>= 0.10'}
+
+  is-array-buffer@3.0.5:
+    resolution: {integrity: sha512-DDfANUiiG2wC1qawP66qlTugJeL5HyzMpfr8lLK+jMQirGzNod0B12cFB/9q838Ru27sBwfw78/rdoU7RERz6A==}
+    engines: {node: '>= 0.4'}
+
+  is-async-function@2.1.1:
+    resolution: {integrity: sha512-9dgM/cZBnNvjzaMYHVoxxfPj2QXt22Ev7SuuPrs+xav0ukGB0S6d4ydZdEiM48kLx5kDV+QBPrpVnFyefL8kkQ==}
+    engines: {node: '>= 0.4'}
+
+  is-bigint@1.1.0:
+    resolution: {integrity: sha512-n4ZT37wG78iz03xPRKJrHTdZbe3IicyucEtdRsV5yglwc3GyUfbAfpSeD0FJ41NbUNSt5wbhqfp1fS+BgnvDFQ==}
+    engines: {node: '>= 0.4'}
+
+  is-boolean-object@1.2.2:
+    resolution: {integrity: sha512-wa56o2/ElJMYqjCjGkXri7it5FbebW5usLw/nPmCMs5DeZ7eziSYZhSmPRn0txqeW4LnAmQQU7FgqLpsEFKM4A==}
+    engines: {node: '>= 0.4'}
+
+  is-bun-module@2.0.0:
+    resolution: {integrity: sha512-gNCGbnnnnFAUGKeZ9PdbyeGYJqewpmc2aKHUEMO5nQPWU9lOmv7jcmQIv+qHD8fXW6W7qfuCwX4rY9LNRjXrkQ==}
+
+  is-callable@1.2.7:
+    resolution: {integrity: sha512-1BC0BVFhS/p0qtw6enp8e+8OD0UrK0oFLztSjNzhcKA3WDuJxxAPXzPuPtKkjEY9UUoEWlX/8fgKeu2S8i9JTA==}
+    engines: {node: '>= 0.4'}
+
+  is-core-module@2.16.1:
+    resolution: {integrity: sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==}
+    engines: {node: '>= 0.4'}
+
+  is-data-view@1.0.2:
+    resolution: {integrity: sha512-RKtWF8pGmS87i2D6gqQu/l7EYRlVdfzemCJN/P3UOs//x1QE7mfhvzHIApBTRf7axvT6DMGwSwBXYCT0nfB9xw==}
+    engines: {node: '>= 0.4'}
+
+  is-date-object@1.1.0:
+    resolution: {integrity: sha512-PwwhEakHVKTdRNVOw+/Gyh0+MzlCl4R6qKvkhuvLtPMggI1WAHt9sOwZxQLSGpUaDnrdyDsomoRgNnCfKNSXXg==}
+    engines: {node: '>= 0.4'}
+
+  is-extglob@2.1.1:
+    resolution: {integrity: sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==}
+    engines: {node: '>=0.10.0'}
+
+  is-finalizationregistry@1.1.1:
+    resolution: {integrity: sha512-1pC6N8qWJbWoPtEjgcL2xyhQOP491EQjeUo3qTKcmV8YSDDJrOepfG8pcC7h/QgnQHYSv0mJ3Z/ZWxmatVrysg==}
+    engines: {node: '>= 0.4'}
+
+  is-fullwidth-code-point@3.0.0:
+    resolution: {integrity: sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==}
+    engines: {node: '>=8'}
+
+  is-generator-function@1.1.2:
+    resolution: {integrity: sha512-upqt1SkGkODW9tsGNG5mtXTXtECizwtS2kA161M+gJPc1xdb/Ax629af6YrTwcOeQHbewrPNlE5Dx7kzvXTizA==}
+    engines: {node: '>= 0.4'}
+
+  is-glob@4.0.3:
+    resolution: {integrity: sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==}
+    engines: {node: '>=0.10.0'}
+
+  is-map@2.0.3:
+    resolution: {integrity: sha512-1Qed0/Hr2m+YqxnM09CjA2d/i6YZNfF6R2oRAOj36eUdS6qIV/huPJNSEpKbupewFs+ZsJlxsjjPbc0/afW6Lw==}
+    engines: {node: '>= 0.4'}
+
+  is-negative-zero@2.0.3:
+    resolution: {integrity: sha512-5KoIu2Ngpyek75jXodFvnafB6DJgr3u8uuK0LEZJjrU19DrMD3EVERaR8sjz8CCGgpZvxPl9SuE1GMVPFHx1mw==}
+    engines: {node: '>= 0.4'}
+
+  is-number-object@1.1.1:
+    resolution: {integrity: sha512-lZhclumE1G6VYD8VHe35wFaIif+CTy5SJIi5+3y4psDgWu4wPDoBhF8NxUOinEc7pHgiTsT6MaBb92rKhhD+Xw==}
+    engines: {node: '>= 0.4'}
+
+  is-number@7.0.0:
+    resolution: {integrity: sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==}
+    engines: {node: '>=0.12.0'}
+
+  is-path-inside@3.0.3:
+    resolution: {integrity: sha512-Fd4gABb+ycGAmKou8eMftCupSir5lRxqf4aD/vd0cD2qc4HL07OjCeuHMr8Ro4CoMaeCKDB0/ECBOVWjTwUvPQ==}
+    engines: {node: '>=8'}
+
+  is-promise@2.2.2:
+    resolution: {integrity: sha512-+lP4/6lKUBfQjZ2pdxThZvLUAafmZb8OAxFb8XXtiQmS35INgr85hdOGoEs124ez1FCnZJt6jau/T+alh58QFQ==}
+
+  is-regex@1.2.1:
+    resolution: {integrity: sha512-MjYsKHO5O7mCsmRGxWcLWheFqN9DJ/2TmngvjKXihe6efViPqc274+Fx/4fYj/r03+ESvBdTXK0V6tA3rgez1g==}
+    engines: {node: '>= 0.4'}
+
+  is-set@2.0.3:
+    resolution: {integrity: sha512-iPAjerrse27/ygGLxw+EBR9agv9Y6uLeYVJMu+QNCoouJ1/1ri0mGrcWpfCqFZuzzx3WjtwxG098X+n4OuRkPg==}
+    engines: {node: '>= 0.4'}
+
+  is-shared-array-buffer@1.0.4:
+    resolution: {integrity: sha512-ISWac8drv4ZGfwKl5slpHG9OwPNty4jOWPRIhBpxOoD+hqITiwuipOQ2bNthAzwA3B4fIjO4Nln74N0S9byq8A==}
+    engines: {node: '>= 0.4'}
+
+  is-stream@2.0.1:
+    resolution: {integrity: sha512-hFoiJiTl63nn+kstHGBtewWSKnQLpyb155KHheA1l39uvtO9nWIop1p3udqPcUd/xbF1VLMO4n7OI6p7RbngDg==}
+    engines: {node: '>=8'}
+
+  is-stream@3.0.0:
+    resolution: {integrity: sha512-LnQR4bZ9IADDRSkvpqMGvt/tEJWclzklNgSw48V5EAaAeDd6qGvN8ei6k5p0tvxSR171VmGyHuTiAOfxAbr8kA==}
+    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}
+
+  is-string@1.1.1:
+    resolution: {integrity: sha512-BtEeSsoaQjlSPBemMQIrY1MY0uM6vnS1g5fmufYOtnxLGUZM2178PKbhsk7Ffv58IX+ZtcvoGwccYsh0PglkAA==}
+    engines: {node: '>= 0.4'}
+
+  is-symbol@1.1.1:
+    resolution: {integrity: sha512-9gGx6GTtCQM73BgmHQXfDmLtfjjTUDSyoxTCbp5WtoixAhfgsDirWIcVQ/IHpvI5Vgd5i/J5F7B9cN/WlVbC/w==}
+    engines: {node: '>= 0.4'}
+
+  is-typed-array@1.1.15:
+    resolution: {integrity: sha512-p3EcsicXjit7SaskXHs1hA91QxgTw46Fv6EFKKGS5DRFLD8yKnohjF3hxoju94b/OcMZoQukzpPpBE9uLVKzgQ==}
+    engines: {node: '>= 0.4'}
+
+  is-weakmap@2.0.2:
+    resolution: {integrity: sha512-K5pXYOm9wqY1RgjpL3YTkF39tni1XajUIkawTLUo9EZEVUFga5gSQJF8nNS7ZwJQ02y+1YCNYcMh+HIf1ZqE+w==}
+    engines: {node: '>= 0.4'}
+
+  is-weakref@1.1.1:
+    resolution: {integrity: sha512-6i9mGWSlqzNMEqpCp93KwRS1uUOodk2OJ6b+sq7ZPDSy2WuI5NFIxp/254TytR8ftefexkWn5xNiHUNpPOfSew==}
+    engines: {node: '>= 0.4'}
+
+  is-weakset@2.0.4:
+    resolution: {integrity: sha512-mfcwb6IzQyOKTs84CQMrOwW4gQcaTOAWJ0zzJCl2WSPDrWk/OzDaImWFH3djXhb24g4eudZfLRozAvPGw4d9hQ==}
+    engines: {node: '>= 0.4'}
+
+  isarray@1.0.0:
+    resolution: {integrity: sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ==}
+
+  isarray@2.0.5:
+    resolution: {integrity: sha512-xHjhDr3cNBK0BzdUJSPXZntQUx/mwMS5Rw4A7lPJ90XGAO6ISP/ePDNuo0vhqOZU+UD5JoodwCAAoZQd3FeAKw==}
+
+  isexe@2.0.0:
+    resolution: {integrity: sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==}
+
+  istanbul-lib-coverage@3.2.2:
+    resolution: {integrity: sha512-O8dpsF+r0WV/8MNRKfnmrtCWhuKjxrq2w+jpzBL5UZKTi2LeVWnWOmWRxFlesJONmc+wLAGvKQZEOanko0LFTg==}
+    engines: {node: '>=8'}
+
+  istanbul-lib-report@3.0.1:
+    resolution: {integrity: sha512-GCfE1mtsHGOELCU8e/Z7YWzpmybrx/+dSTfLrvY8qRmaY6zXTKWn6WQIjaAFw069icm6GVMNkgu0NzI4iPZUNw==}
+    engines: {node: '>=10'}
+
+  istanbul-lib-source-maps@5.0.6:
+    resolution: {integrity: sha512-yg2d+Em4KizZC5niWhQaIomgf5WlL4vOOjZ5xGCmF8SnPE/mDWWXgvRExdcpCgh9lLRRa1/fSYp2ymmbJ1pI+A==}
+    engines: {node: '>=10'}
+
+  istanbul-reports@3.2.0:
+    resolution: {integrity: sha512-HGYWWS/ehqTV3xN10i23tkPkpH46MLCIMFNCaaKNavAXTF1RkqxawEPtnjnGZ6XKSInBKkiOA5BKS+aZiY3AvA==}
+    engines: {node: '>=8'}
+
+  iterare@1.2.1:
+    resolution: {integrity: sha512-RKYVTCjAnRthyJes037NX/IiqeidgN1xc3j1RjFfECFp28A1GVwK9nA+i0rJPaHqSZwygLzRnFlzUuHFoWWy+Q==}
+    engines: {node: '>=6'}
+
+  jackspeak@3.4.3:
+    resolution: {integrity: sha512-OGlZQpz2yfahA/Rd1Y8Cd9SIEsqvXkLVoSw/cgwhnhFMDbsQFeZYoJJ7bIZBS9BcamUW96asq/npPWugM+RQBw==}
+
+  joi@17.13.3:
+    resolution: {integrity: sha512-otDA4ldcIx+ZXsKHWmp0YizCweVRZG96J10b0FevjfuncLO1oX59THoAmHkNubYJ+9gWsYsp5k8v4ib6oDv1fA==}
+
+  js-tokens@9.0.1:
+    resolution: {integrity: sha512-mxa9E9ITFOt0ban3j6L5MpjwegGz6lBQmM1IJkWeBZGcMxto50+eWdjC/52xDbS2vy0k7vIMK0Fe2wfL9OQSpQ==}
+
+  js-yaml@4.1.1:
+    resolution: {integrity: sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==}
+    hasBin: true
+
+  json-bigint@1.0.0:
+    resolution: {integrity: sha512-SiPv/8VpZuWbvLSMtTDU8hEfrZWg/mH/nV/b4o0CYbSxu1UIQPLdwKOCIyLQX+VIPO5vrLX3i8qtqFyhdPSUSQ==}
+
+  json-buffer@3.0.1:
+    resolution: {integrity: sha512-4bV5BfR2mqfQTJm+V5tPPdf+ZpuhiIvTuAB5g8kcrXOZpTT/QwwVRWBywX1ozr6lEuPdbHxwaJlm9G6mI2sfSQ==}
+
+  json-diff@0.9.0:
+    resolution: {integrity: sha512-cVnggDrVkAAA3OvFfHpFEhOnmcsUpleEKq4d4O8sQWWSH40MBrWstKigVB1kGrgLWzuom+7rRdaCsnBD6VyObQ==}
+    hasBin: true
+
+  json-schema-traverse@0.4.1:
+    resolution: {integrity: sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==}
+
+  json-stable-stringify-without-jsonify@1.0.1:
+    resolution: {integrity: sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw==}
+
+  json5@1.0.2:
+    resolution: {integrity: sha512-g1MWMLBiz8FKi1e4w0UyVL3w+iJceWAFBAaBnnGKOpNa5f8TLktkbre1+s6oICydWAm+HRUGTmI+//xv2hvXYA==}
+    hasBin: true
+
+  keyv@4.5.4:
+    resolution: {integrity: sha512-oxVHkHR/EJf2CNXnWxRLW6mg7JyCCUcG0DtEGmL2ctUo1PNTin1PUil+r/+4r5MpVgC/fn1kjsx7mjSujKqIpw==}
+
+  lazystream@1.0.1:
+    resolution: {integrity: sha512-b94GiNHQNy6JNTrt5w6zNyffMrNkXZb3KTkCZJb2V1xaEGCk093vkZ2jk3tpaeP33/OiXC+WvK9AxUebnf5nbw==}
+    engines: {node: '>= 0.6.3'}
+
+  levn@0.4.1:
+    resolution: {integrity: sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ==}
+    engines: {node: '>= 0.8.0'}
+
+  lie@3.1.1:
+    resolution: {integrity: sha512-RiNhHysUjhrDQntfYSfY4MU24coXXdEOgw9WGcKHNeEwffDYbF//u87M1EWaMGzuFoSbqW0C9C6lEEhDOAswfw==}
+
+  local-pkg@0.5.1:
+    resolution: {integrity: sha512-9rrA30MRRP3gBD3HTGnC6cDFpaE1kVDWxWgqWJUN0RvDNAo+Nz/9GxB+nHOH0ifbVFy0hSA1V6vFDvnx54lTEQ==}
+    engines: {node: '>=14'}
+
+  localforage@1.10.0:
+    resolution: {integrity: sha512-14/H1aX7hzBBmmh7sGPd+AOMkkIrHM3Z1PAyGgZigA1H1p5O5ANnMyWzvpAETtG68/dC4pC0ncy3+PPGzXZHPg==}
+
+  locate-path@6.0.0:
+    resolution: {integrity: sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw==}
+    engines: {node: '>=10'}
+
+  lodash.camelcase@4.3.0:
+    resolution: {integrity: sha512-TwuEnCnxbc3rAvhf/LbG7tJUDzhqXyFnv3dtzLOPgCG/hODL7WFnsbwktkD7yUV0RrreP/l1PALq/YSg6VvjlA==}
+
+  lodash.defaults@4.2.0:
+    resolution: {integrity: sha512-qjxPLHd3r5DnsdGacqOMU6pb/avJzdh9tFX2ymgoZE27BmjXrNy/y4LoaiTeAb+O3gL8AfpJGtqfX/ae2leYYQ==}
+
+  lodash.isarguments@3.1.0:
+    resolution: {integrity: sha512-chi4NHZlZqZD18a0imDHnZPrDeBbTtVN7GXMwuGdRH9qotxAjYs3aVLKc7zNOG9eddR5Ksd8rvFEBc9SsggPpg==}
+
+  lodash.merge@4.6.2:
+    resolution: {integrity: sha512-0KpjqXRVvrYyCsX1swR/XTK0va6VQkQM6MNo7PqW77ByjAhoARA8EfrP1N4+KlKj8YS0ZUCtRT/YUuhyYDujIQ==}
+
+  lodash.throttle@4.1.1:
+    resolution: {integrity: sha512-wIkUCfVKpVsWo3JSZlc+8MB5it+2AN5W8J7YVMST30UrvcQNZ1Okbj+rbVniijTWE6FGYy4XJq/rHkas8qJMLQ==}
+
+  lodash@4.18.1:
+    resolution: {integrity: sha512-dMInicTPVE8d1e5otfwmmjlxkZoUpiVLwyeTdUsi/Caj/gfzzblBcCE5sRHV/AsjuCmxWrte2TNGSYuCeCq+0Q==}
+
+  long@5.3.2:
+    resolution: {integrity: sha512-mNAgZ1GmyNhD7AuqnTG3/VQ26o760+ZYBPKjPvugO8+nLbYfX6TVpJPseBvopbdY+qpZ/lKUnmEc1LeZYS3QAA==}
+
+  loupe@2.3.7:
+    resolution: {integrity: sha512-zSMINGVYkdpYSOBmLi0D1Uo7JU9nVdQKrHxC8eYlV+9YKK9WePqAlL7lSlorG/U2Fw1w0hTBmaa/jrQ3UbPHtA==}
+
+  lru-cache@10.4.3:
+    resolution: {integrity: sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ==}
+
+  lru-queue@0.1.0:
+    resolution: {integrity: sha512-BpdYkt9EvGl8OfWHDQPISVpcl5xZthb+XPsbELj5AQXxIC8IriDZIQYjBJPEm5rS420sjZ0TLEzRcq5KdBhYrQ==}
+
+  luxon@3.7.2:
+    resolution: {integrity: sha512-vtEhXh/gNjI9Yg1u4jX/0YVPMvxzHuGgCm6tC5kZyb08yjGWGnqAjGJvcXbqQR2P3MyMEFnRbpcdFS6PBcLqew==}
+    engines: {node: '>=12'}
+
+  magic-string@0.30.21:
+    resolution: {integrity: sha512-vd2F4YUyEXKGcLHoq+TEyCjxueSeHnFxyyjNp80yg0XV4vUhnDer/lvvlqM/arB5bXQN5K2/3oinyCRyx8T2CQ==}
+
+  magicast@0.3.5:
+    resolution: {integrity: sha512-L0WhttDl+2BOsybvEOLK7fW3UA0OQ0IQ2d6Zl2x/a6vVRs3bAY0ECOSHHeL5jD+SbOpOCUEi0y1DgHEn9Qn1AQ==}
+
+  make-dir@4.0.0:
+    resolution: {integrity: sha512-hXdUTZYIVOt1Ex//jAQi+wTZZpUpwBj/0QsOzqegb3rGMMeJiSEu5xLHnYfBrRV4RH2+OCSOO95Is/7x1WJ4bw==}
+    engines: {node: '>=10'}
+
+  math-intrinsics@1.1.0:
+    resolution: {integrity: sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==}
+    engines: {node: '>= 0.4'}
+
+  media-typer@0.3.0:
+    resolution: {integrity: sha512-dq+qelQ9akHpcOl/gUVRTxVIOkAJ1wR3QAvb4RsVjS8oVoFjDGTc679wJYmUmknUF5HwMLOgb5O+a3KxfWapPQ==}
+    engines: {node: '>= 0.6'}
+
+  memoizee@0.4.17:
+    resolution: {integrity: sha512-DGqD7Hjpi/1or4F/aYAspXKNm5Yili0QDAFAY4QYvpqpgiY6+1jOfqpmByzjxbWd/T9mChbCArXAbDAsTm5oXA==}
+    engines: {node: '>=0.12'}
+
+  merge-descriptors@1.0.3:
+    resolution: {integrity: sha512-gaNvAS7TZ897/rVaZ0nMtAyxNyi/pdbjbAwUpFQpN70GqnVfOiXpeUUMKRBmzXaSQ8DdTX4/0ms62r2K+hE6mQ==}
+
+  merge-stream@2.0.0:
+    resolution: {integrity: sha512-abv/qOcuPfk3URPfDzmZU1LKmuw8kT+0nIHvKrKgFrwifol/doWcdA4ZqsWQ8ENrFKkd67Mfpo/LovbIUsbt3w==}
+
+  merge2@1.4.1:
+    resolution: {integrity: sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==}
+    engines: {node: '>= 8'}
+
+  methods@1.1.2:
+    resolution: {integrity: sha512-iclAHeNqNm68zFtnZ0e+1L2yUIdvzNoauKU4WBA3VvH/vPFieF7qfRlwUZU+DA9P9bPXIS90ulxoUoCH23sV2w==}
+    engines: {node: '>= 0.6'}
+
+  micromatch@4.0.8:
+    resolution: {integrity: sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==}
+    engines: {node: '>=8.6'}
+
+  mime-db@1.52.0:
+    resolution: {integrity: sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==}
+    engines: {node: '>= 0.6'}
+
+  mime-types@2.1.35:
+    resolution: {integrity: sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==}
+    engines: {node: '>= 0.6'}
+
+  mime@1.6.0:
+    resolution: {integrity: sha512-x0Vn8spI+wuJ1O6S7gnbaQg8Pxh4NNHb7KSINmEWKiPE4RKOplvijn+NkmYmmRgP68mc70j2EbeTFRsrswaQeg==}
+    engines: {node: '>=4'}
+    hasBin: true
+
+  mime@2.6.0:
+    resolution: {integrity: sha512-USPkMeET31rOMiarsBNIHZKLGgvKc/LrjofAnBlOttf5ajRvqiRA8QsenbcooctK6d6Ts6aqZXBA+XbkKthiQg==}
+    engines: {node: '>=4.0.0'}
+    hasBin: true
+
+  mimic-fn@4.0.0:
+    resolution: {integrity: sha512-vqiC06CuhBTUdZH+RYl8sFrL096vA45Ok5ISO6sE/Mr1jRbGH4Csnhi8f3wKVl7x8mO4Au7Ir9D3Oyv1VYMFJw==}
+    engines: {node: '>=12'}
+
+  minimatch@3.1.5:
+    resolution: {integrity: sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==}
+
+  minimatch@5.1.9:
+    resolution: {integrity: sha512-7o1wEA2RyMP7Iu7GNba9vc0RWWGACJOCZBJX2GJWip0ikV+wcOsgVuY9uE8CPiyQhkGFSlhuSkZPavN7u1c2Fw==}
+    engines: {node: '>=10'}
+
+  minimatch@9.0.9:
+    resolution: {integrity: sha512-OBwBN9AL4dqmETlpS2zasx+vTeWclWzkblfZk7KTA5j3jeOONz/tRCnZomUyvNg83wL5Zv9Ss6HMJXAgL8R2Yg==}
+    engines: {node: '>=16 || 14 >=14.17'}
+
+  minimist@1.2.8:
+    resolution: {integrity: sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==}
+
+  minipass@7.1.3:
+    resolution: {integrity: sha512-tEBHqDnIoM/1rXME1zgka9g6Q2lcoCkxHLuc7ODJ5BxbP5d4c2Z5cGgtXAku59200Cx7diuHTOYfSBD8n6mm8A==}
+    engines: {node: '>=16 || 14 >=14.17'}
+
+  mkdirp-classic@0.5.3:
+    resolution: {integrity: sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==}
+
+  mkdirp@0.5.6:
+    resolution: {integrity: sha512-FP+p8RB8OWpF3YZBCrP5gtADmtXApB5AMLn+vdyA+PyxCjrCs00mjyUozssO33cwDeT3wNGdLxJ5M//YqtHAJw==}
+    hasBin: true
+
+  mkdirp@1.0.4:
+    resolution: {integrity: sha512-vVqVZQyf3WLx2Shd0qJ9xuvqgAyKPLAiqITEtqW0oIUjzo3PePDd6fW9iFz30ef7Ysp/oiWqbhszeGWW2T6Gzw==}
+    engines: {node: '>=10'}
+    hasBin: true
+
+  mlly@1.8.2:
+    resolution: {integrity: sha512-d+ObxMQFmbt10sretNDytwt85VrbkhhUA/JBGm1MPaWJ65Cl4wOgLaB1NYvJSZ0Ef03MMEU/0xpPMXUIQ29UfA==}
+
+  module-details-from-path@1.0.4:
+    resolution: {integrity: sha512-EGWKgxALGMgzvxYF1UyGTy0HXX/2vHLkw6+NvDKW2jypWbHpjQuj4UMcqQWXHERJhVGKikolT06G3bcKe4fi7w==}
+
+  ms@2.0.0:
+    resolution: {integrity: sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==}
+
+  ms@2.1.3:
+    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}
+
+  msgpackr-extract@3.0.3:
+    resolution: {integrity: sha512-P0efT1C9jIdVRefqjzOQ9Xml57zpOXnIuS+csaB4MdZbTdmGDLo8XhzBG1N7aO11gKDDkJvBLULeFTo46wwreA==}
+    hasBin: true
+
+  msgpackr@1.11.5:
+    resolution: {integrity: sha512-UjkUHN0yqp9RWKy0Lplhh+wlpdt9oQBYgULZOiFhV3VclSF1JnSQWZ5r9gORQlNYaUKQoR8itv7g7z1xDDuACA==}
+
+  multer@2.0.2:
+    resolution: {integrity: sha512-u7f2xaZ/UG8oLXHvtF/oWTRvT44p9ecwBBqTwgJVq0+4BW1g8OW01TyMEGWBHbyMOYVHXslaut7qEQ1meATXgw==}
+    engines: {node: '>= 10.16.0'}
+
+  nan@2.26.2:
+    resolution: {integrity: sha512-0tTvBTYkt3tdGw22nrAy50x7gpbGCCFH3AFcyS5WiUu7Eu4vWlri1woE6qHBSfy11vksDqkiwjOnlR7WV8G1Hw==}
+
+  nanoid@3.3.11:
+    resolution: {integrity: sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==}
+    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
+    hasBin: true
+
+  napi-postinstall@0.3.4:
+    resolution: {integrity: sha512-PHI5f1O0EP5xJ9gQmFGMS6IZcrVvTjpXjz7Na41gTE7eE2hK11lg04CECCYEEjdc17EV4DO+fkGEtt7TpTaTiQ==}
+    engines: {node: ^12.20.0 || ^14.18.0 || >=16.0.0}
+    hasBin: true
+
+  natural-compare@1.4.0:
+    resolution: {integrity: sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==}
+
+  negotiator@0.6.3:
+    resolution: {integrity: sha512-+EUsqGPLsM+j/zdChZjsnX51g4XrHFOIXwfnCVPGlQk/k5giakcKsuxCObBRu6DSm9opw/O6slWbJdghQM4bBg==}
+    engines: {node: '>= 0.6'}
+
+  next-tick@1.1.0:
+    resolution: {integrity: sha512-CXdUiJembsNjuToQvxayPZF9Vqht7hewsvy2sOWafLvi2awflj9mOC6bHIg50orX8IJvWKY9wYQ/zB2kogPslQ==}
+
+  node-abort-controller@3.1.1:
+    resolution: {integrity: sha512-AGK2yQKIjRuqnc6VkX2Xj5d+QW8xZ87pa1UK6yA6ouUyuxfHuMP6umE5QK7UmTeOAymo+Zx1Fxiuw9rVx8taHQ==}
+
+  node-exports-info@1.6.0:
+    resolution: {integrity: sha512-pyFS63ptit/P5WqUkt+UUfe+4oevH+bFeIiPPdfb0pFeYEu/1ELnJu5l+5EcTKYL5M7zaAa7S8ddywgXypqKCw==}
+    engines: {node: '>= 0.4'}
+
+  node-fetch@2.7.0:
+    resolution: {integrity: sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==}
+    engines: {node: 4.x || >=6.0.0}
+    peerDependencies:
+      encoding: ^0.1.0
+    peerDependenciesMeta:
+      encoding:
+        optional: true
+
+  node-gyp-build-optional-packages@5.2.2:
+    resolution: {integrity: sha512-s+w+rBWnpTMwSFbaE0UXsRlg7hU4FjekKU4eyAih5T8nJuNZT1nNsskXpxmeqSK9UzkBl6UgRlnKc8hz8IEqOw==}
+    hasBin: true
+
+  normalize-path@3.0.0:
+    resolution: {integrity: sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA==}
+    engines: {node: '>=0.10.0'}
+
+  npm-run-path@5.3.0:
+    resolution: {integrity: sha512-ppwTtiJZq0O/ai0z7yfudtBpWIoxM8yE6nHi1X47eFR2EWORqfbu6CnPlNsjeN683eT0qG6H/Pyf9fCcvjnnnQ==}
+    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}
+
+  object-assign@4.1.1:
+    resolution: {integrity: sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==}
+    engines: {node: '>=0.10.0'}
+
+  object-inspect@1.13.4:
+    resolution: {integrity: sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==}
+    engines: {node: '>= 0.4'}
+
+  object-keys@1.1.1:
+    resolution: {integrity: sha512-NuAESUOUMrlIXOfHKzD6bpPu3tYt3xvjNdRIQ+FeT0lNb4K8WR70CaDxhuNguS2XG+GjkyMwOzsN5ZktImfhLA==}
+    engines: {node: '>= 0.4'}
+
+  object.assign@4.1.7:
+    resolution: {integrity: sha512-nK28WOo+QIjBkDduTINE4JkF/UJJKyf2EJxvJKfblDpyg0Q+pkOHNTL0Qwy6NP6FhE/EnzV73BxxqcJaXY9anw==}
+    engines: {node: '>= 0.4'}
+
+  object.entries@1.1.9:
+    resolution: {integrity: sha512-8u/hfXFRBD1O0hPUjioLhoWFHRmt6tKA4/vZPyckBr18l1KE9uHrFaFaUi8MDRTpi4uak2goyPTSNJLXX2k2Hw==}
+    engines: {node: '>= 0.4'}
+
+  object.fromentries@2.0.8:
+    resolution: {integrity: sha512-k6E21FzySsSK5a21KRADBd/NGneRegFO5pLHfdQLpRDETUNJueLXs3WCzyQ3tFRDYgbq3KHGXfTbi2bs8WQ6rQ==}
+    engines: {node: '>= 0.4'}
+
+  object.groupby@1.0.3:
+    resolution: {integrity: sha512-+Lhy3TQTuzXI5hevh8sBGqbmurHbbIjAi0Z4S63nthVLmLxfbj4T54a4CfZrXIrt9iP4mVAPYMo/v99taj3wjQ==}
+    engines: {node: '>= 0.4'}
+
+  object.values@1.2.1:
+    resolution: {integrity: sha512-gXah6aZrcUxjWg2zR2MwouP2eHlCBzdV4pygudehaKXSGW4v2AsRQUK+lwwXhii6KFZcunEnmSUoYp5CXibxtA==}
+    engines: {node: '>= 0.4'}
+
+  on-exit-leak-free@2.1.2:
+    resolution: {integrity: sha512-0eJJY6hXLGf1udHwfNftBqH+g73EU4B504nZeKpz1sYRKafAghwxEJunB2O7rDZkL4PGfsMVnTXZ2EjibbqcsA==}
+    engines: {node: '>=14.0.0'}
+
+  on-finished@2.4.1:
+    resolution: {integrity: sha512-oVlzkg3ENAhCk2zdv7IJwd/QUD4z2RxRwpkcGY8psCVcCYZNq4wYnVWALHM+brtuJjePWiYF/ClmuDr8Ch5+kg==}
+    engines: {node: '>= 0.8'}
+
+  once@1.4.0:
+    resolution: {integrity: sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==}
+
+  onetime@6.0.0:
+    resolution: {integrity: sha512-1FlR+gjXK7X+AsAHso35MnyN5KqGwJRi/31ft6x0M194ht7S+rWAvd7PHss9xSKMzE0asv1pyIHaJYq+BbacAQ==}
+    engines: {node: '>=12'}
+
+  optionator@0.9.4:
+    resolution: {integrity: sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g==}
+    engines: {node: '>= 0.8.0'}
+
+  own-keys@1.0.1:
+    resolution: {integrity: sha512-qFOyK5PjiWZd+QQIh+1jhdb9LpxTF0qs7Pm8o5QHYZ0M3vKqSqzsZaEB6oWlxZ+q2sJBMI/Ktgd2N5ZwQoRHfg==}
+    engines: {node: '>= 0.4'}
+
+  p-limit@3.1.0:
+    resolution: {integrity: sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==}
+    engines: {node: '>=10'}
+
+  p-limit@5.0.0:
+    resolution: {integrity: sha512-/Eaoq+QyLSiXQ4lyYV23f14mZRQcXnxfHrN0vCai+ak9G0pp9iEQukIIZq5NccEvwRB8PUnZT0KsOoDCINS1qQ==}
+    engines: {node: '>=18'}
+
+  p-locate@5.0.0:
+    resolution: {integrity: sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw==}
+    engines: {node: '>=10'}
+
+  package-json-from-dist@1.0.1:
+    resolution: {integrity: sha512-UEZIS3/by4OC8vL3P2dTXRETpebLI2NiI5vIrjaD/5UtrkFX/tNbwjTSRAGC/+7CAo2pIcBaRgWmcBBHcsaCIw==}
+
+  parent-module@1.0.1:
+    resolution: {integrity: sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g==}
+    engines: {node: '>=6'}
+
+  parseurl@1.3.3:
+    resolution: {integrity: sha512-CiyeOxFT/JZyN5m0z9PfXw4SCBJ6Sygz1Dpl0wqjlhDEGGBP1GnsUVEL0p63hoG1fcj3fHynXi9NYO4nWOL+qQ==}
+    engines: {node: '>= 0.8'}
+
+  path-exists@4.0.0:
+    resolution: {integrity: sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==}
+    engines: {node: '>=8'}
+
+  path-is-absolute@1.0.1:
+    resolution: {integrity: sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg==}
+    engines: {node: '>=0.10.0'}
+
+  path-key@3.1.1:
+    resolution: {integrity: sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==}
+    engines: {node: '>=8'}
+
+  path-key@4.0.0:
+    resolution: {integrity: sha512-haREypq7xkM7ErfgIyA0z+Bj4AGKlMSdlQE2jvJo6huWD1EdkKYV+G/T4nq0YEF2vgTT8kqMFKo1uHn950r4SQ==}
+    engines: {node: '>=12'}
+
+  path-parse@1.0.7:
+    resolution: {integrity: sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==}
+
+  path-scurry@1.11.1:
+    resolution: {integrity: sha512-Xa4Nw17FS9ApQFJ9umLiJS4orGjm7ZzwUrwamcGQuHSzDyth9boKDaycYdDcZDuqYATXw4HFXgaqWTctW/v1HA==}
+    engines: {node: '>=16 || 14 >=14.18'}
+
+  path-to-regexp@0.1.13:
+    resolution: {integrity: sha512-A/AGNMFN3c8bOlvV9RreMdrv7jsmF9XIfDeCd87+I8RNg6s78BhJxMu69NEMHBSJFxKidViTEdruRwEk/WIKqA==}
+
+  path-to-regexp@3.3.0:
+    resolution: {integrity: sha512-qyCH421YQPS2WFDxDjftfc1ZR5WKQzVzqsp4n9M2kQhVOo/ByahFoUNJfl58kOcEGfQ//7weFTDhm+ss8Ecxgw==}
+
+  path-type@4.0.0:
+    resolution: {integrity: sha512-gDKb8aZMDeD/tZWs9P6+q0J9Mwkdl6xMV8TjnGP3qJVJ06bdMgkbBlLU8IdfOsIsFz2BW1rNVT3XuNEl8zPAvw==}
+    engines: {node: '>=8'}
+
+  pathe@1.1.2:
+    resolution: {integrity: sha512-whLdWMYL2TwI08hn8/ZqAbrVemu0LNaNNJZX73O6qaIdCTfXutsLhMkjdENX0qhsQ9uIimo4/aQOmXkoon2nDQ==}
+
+  pathe@2.0.3:
+    resolution: {integrity: sha512-WUjGcAqP1gQacoQe+OBJsFA7Ld4DyXuUIjZ5cc75cLHvJ7dtNsTugphxIADwspS+AraAUePCKrSVtPLFj/F88w==}
+
+  pathval@1.1.1:
+    resolution: {integrity: sha512-Dp6zGqpTdETdR63lehJYPeIOqpiNBNtc7BpWSLrOje7UaIsE5aY92r/AunQA7rsXvet3lrJ3JnZX29UPTKXyKQ==}
+
+  pg-cloudflare@1.3.0:
+    resolution: {integrity: sha512-6lswVVSztmHiRtD6I8hw4qP/nDm1EJbKMRhf3HCYaqud7frGysPv7FYJ5noZQdhQtN2xJnimfMtvQq21pdbzyQ==}
+
+  pg-connection-string@2.12.0:
+    resolution: {integrity: sha512-U7qg+bpswf3Cs5xLzRqbXbQl85ng0mfSV/J0nnA31MCLgvEaAo7CIhmeyrmJpOr7o+zm0rXK+hNnT5l9RHkCkQ==}
+
+  pg-int8@1.0.1:
+    resolution: {integrity: sha512-WCtabS6t3c8SkpDBUlb1kjOs7l66xsGdKpIPZsg4wR+B3+u9UAum2odSsF9tnvxg80h4ZxLWMy4pRjOsFIqQpw==}
+    engines: {node: '>=4.0.0'}
+
+  pg-pool@3.13.0:
+    resolution: {integrity: sha512-gB+R+Xud1gLFuRD/QgOIgGOBE2KCQPaPwkzBBGC9oG69pHTkhQeIuejVIk3/cnDyX39av2AxomQiyPT13WKHQA==}
+    peerDependencies:
+      pg: '>=8.0'
+
+  pg-protocol@1.13.0:
+    resolution: {integrity: sha512-zzdvXfS6v89r6v7OcFCHfHlyG/wvry1ALxZo4LqgUoy7W9xhBDMaqOuMiF3qEV45VqsN6rdlcehHrfDtlCPc8w==}
+
+  pg-types@2.2.0:
+    resolution: {integrity: sha512-qTAAlrEsl8s4OiEQY69wDvcMIdQN6wdz5ojQiOy6YRMuynxenON0O5oCpJI6lshc6scgAY8qvJ2On/p+CXY0GA==}
+    engines: {node: '>=4'}
+
+  pg@8.20.0:
+    resolution: {integrity: sha512-ldhMxz2r8fl/6QkXnBD3CR9/xg694oT6DZQ2s6c/RI28OjtSOpxnPrUCGOBJ46RCUxcWdx3p6kw/xnDHjKvaRA==}
+    engines: {node: '>= 16.0.0'}
+    peerDependencies:
+      pg-native: '>=3.0.1'
+    peerDependenciesMeta:
+      pg-native:
+        optional: true
+
+  pgpass@1.0.5:
+    resolution: {integrity: sha512-FdW9r/jQZhSeohs1Z3sI1yxFQNFvMcnmfuj4WBMUTxOrAyLMaTcE1aAMBiTlbMNaXvBCQuVi0R7hd8udDSP7ug==}
+
+  picocolors@1.1.1:
+    resolution: {integrity: sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==}
+
+  picomatch@2.3.2:
+    resolution: {integrity: sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==}
+    engines: {node: '>=8.6'}
+
+  picomatch@4.0.4:
+    resolution: {integrity: sha512-QP88BAKvMam/3NxH6vj2o21R6MjxZUAd6nlwAS/pnGvN9IVLocLHxGYIzFhg6fUQ+5th6P4dv4eW9jX3DSIj7A==}
+    engines: {node: '>=12'}
+
+  pino-abstract-transport@1.2.0:
+    resolution: {integrity: sha512-Guhh8EZfPCfH+PMXAb6rKOjGQEoy0xlAIn+irODG5kgfYV+BQ0rGYYWTIel3P5mmyXqkYkPmdIkywsn6QKUR1Q==}
+
+  pino-std-serializers@6.2.2:
+    resolution: {integrity: sha512-cHjPPsE+vhj/tnhCy/wiMh3M3z3h/j15zHQX+S9GkTBgqJuTuJzYJ4gUyACLhDaJ7kk9ba9iRDmbH2tJU03OiA==}
+
+  pino@8.21.0:
+    resolution: {integrity: sha512-ip4qdzjkAyDDZklUaZkcRFb2iA118H9SgRh8yzTkSQK8HilsOJF7rSY8HoW5+I0M46AZgX/pxbprf2vvzQCE0Q==}
+    hasBin: true
+
+  pkg-types@1.3.1:
+    resolution: {integrity: sha512-/Jm5M4RvtBFVkKWRu2BLUTNP8/M2a+UwuAX+ae4770q1qVGtfjG+WTCupoZixokjmHiry8uI+dlY8KXYV5HVVQ==}
+
+  possible-typed-array-names@1.1.0:
+    resolution: {integrity: sha512-/+5VFTchJDoVj3bhoqi6UeymcD00DAwb1nJwamzPvHEszJ4FpF6SNNbUbOS8yI56qHzdV8eK0qEfOSiodkTdxg==}
+    engines: {node: '>= 0.4'}
+
+  postcss@8.5.10:
+    resolution: {integrity: sha512-pMMHxBOZKFU6HgAZ4eyGnwXF/EvPGGqUr0MnZ5+99485wwW41kW91A4LOGxSHhgugZmSChL5AlElNdwlNgcnLQ==}
+    engines: {node: ^10 || ^12 || >=14}
+
+  postgres-array@2.0.0:
+    resolution: {integrity: sha512-VpZrUqU5A69eQyW2c5CA1jtLecCsN2U/bD6VilrFDWq5+5UIEVO7nazS3TEcHf1zuPYO/sqGvUvW62g86RXZuA==}
+    engines: {node: '>=4'}
+
+  postgres-bytea@1.0.1:
+    resolution: {integrity: sha512-5+5HqXnsZPE65IJZSMkZtURARZelel2oXUEO8rH83VS/hxH5vv1uHquPg5wZs8yMAfdv971IU+kcPUczi7NVBQ==}
+    engines: {node: '>=0.10.0'}
+
+  postgres-date@1.0.7:
+    resolution: {integrity: sha512-suDmjLVQg78nMK2UZ454hAG+OAW+HQPZ6n++TNDUX+L0+uUlLywnoxJKDou51Zm+zTCjrCl0Nq6J9C5hP9vK/Q==}
+    engines: {node: '>=0.10.0'}
+
+  postgres-interval@1.2.0:
+    resolution: {integrity: sha512-9ZhXKM/rw350N1ovuWHbGxnGh/SNJ4cnxHiM0rxE4VN41wsg8P8zWn9hv/buK00RP4WvlOyr/RBDiptyxVbkZQ==}
+    engines: {node: '>=0.10.0'}
+
+  prelude-ls@1.2.1:
+    resolution: {integrity: sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==}
+    engines: {node: '>= 0.8.0'}
+
+  prettier@3.8.3:
+    resolution: {integrity: sha512-7igPTM53cGHMW8xWuVTydi2KO233VFiTNyF5hLJqpilHfmn8C8gPf+PS7dUT64YcXFbiMGZxS9pCSxL/Dxm/Jw==}
+    engines: {node: '>=14'}
+    hasBin: true
+
+  pretty-format@29.7.0:
+    resolution: {integrity: sha512-Pdlw/oPxN+aXdmM9R00JVC9WVFoCLTKJvDVLgmJ+qAffBMxsV85l/Lu7sNx4zSzPyoL2euImuEwHhOXdEgNFZQ==}
+    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}
+
+  process-nextick-args@2.0.1:
+    resolution: {integrity: sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag==}
+
+  process-warning@3.0.0:
+    resolution: {integrity: sha512-mqn0kFRl0EoqhnL0GQ0veqFHyIN1yig9RHh/InzORTUiZHFRAur+aMtRkELNwGs9aNwKS6tg/An4NYBPGwvtzQ==}
+
+  process@0.11.10:
+    resolution: {integrity: sha512-cdGef/drWFoydD1JsMzuFf8100nZl+GT+yacc2bEced5f9Rjk4z+WtFUTBu9PhOi9j/jfmBPu0mMEY4wIdAF8A==}
+    engines: {node: '>= 0.6.0'}
+
+  proper-lockfile@4.1.2:
+    resolution: {integrity: sha512-TjNPblN4BwAWMXU8s9AEz4JmQxnD1NNL7bNOY/AKUzyamc379FWASUhc/K1pL2noVb+XmZKLL68cjzLsiOAMaA==}
+
+  properties-reader@2.3.0:
+    resolution: {integrity: sha512-z597WicA7nDZxK12kZqHr2TcvwNU1GCfA5UwfDY/HDp3hXPoPlb5rlEx9bwGTiJnc0OqbBTkU975jDToth8Gxw==}
+    engines: {node: '>=14'}
+
+  protobufjs@7.5.5:
+    resolution: {integrity: sha512-3wY1AxV+VBNW8Yypfd1yQY9pXnqTAN+KwQxL8iYm3/BjKYMNg4i0owhEe26PWDOMaIrzeeF98Lqd5NGz4omiIg==}
+    engines: {node: '>=12.0.0'}
+
+  proxy-addr@2.0.7:
+    resolution: {integrity: sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==}
+    engines: {node: '>= 0.10'}
+
+  pump@3.0.4:
+    resolution: {integrity: sha512-VS7sjc6KR7e1ukRFhQSY5LM2uBWAUPiOPa/A3mkKmiMwSmRFUITt0xuj+/lesgnCv+dPIEYlkzrcyXgquIHMcA==}
+
+  punycode@2.3.1:
+    resolution: {integrity: sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==}
+    engines: {node: '>=6'}
+
+  qs@6.14.2:
+    resolution: {integrity: sha512-V/yCWTTF7VJ9hIh18Ugr2zhJMP01MY7c5kh4J870L7imm6/DIzBsNLTXzMwUA3yZ5b/KBqLx8Kp3uRvd7xSe3Q==}
+    engines: {node: '>=0.6'}
+
+  qs@6.15.1:
+    resolution: {integrity: sha512-6YHEFRL9mfgcAvql/XhwTvf5jKcOiiupt2FiJxHkiX1z4j7WL8J/jRHYLluORvc1XxB5rV20KoeK00gVJamspg==}
+    engines: {node: '>=0.6'}
+
+  queue-microtask@1.2.3:
+    resolution: {integrity: sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==}
+
+  quick-format-unescaped@4.0.4:
+    resolution: {integrity: sha512-tYC1Q1hgyRuHgloV/YXs2w15unPVh8qfu/qCTfhTYamaw7fyhumKa2yGpdSo87vY32rIclj+4fWYQXUMs9EHvg==}
+
+  range-parser@1.2.1:
+    resolution: {integrity: sha512-Hrgsx+orqoygnmhFbKaHE6c296J+HTAQXoxEF6gNupROmmGJRoyzfG3ccAveqCBrwr/2yxQ5BVd/GTl5agOwSg==}
+    engines: {node: '>= 0.6'}
+
+  raw-body@2.5.3:
+    resolution: {integrity: sha512-s4VSOf6yN0rvbRZGxs8Om5CWj6seneMwK3oDb4lWDH0UPhWcxwOWw5+qk24bxq87szX1ydrwylIOp2uG1ojUpA==}
+    engines: {node: '>= 0.8'}
+
+  react-is@18.3.1:
+    resolution: {integrity: sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg==}
+
+  readable-stream@2.3.8:
+    resolution: {integrity: sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA==}
+
+  readable-stream@3.6.2:
+    resolution: {integrity: sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==}
+    engines: {node: '>= 6'}
+
+  readable-stream@4.7.0:
+    resolution: {integrity: sha512-oIGGmcpTLwPga8Bn6/Z75SVaH1z5dUut2ibSyAMVhmUggWpmDn2dapB0n7f8nwaSiRtepAsfJyfXIO5DCVAODg==}
+    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}
+
+  readdir-glob@1.1.3:
+    resolution: {integrity: sha512-v05I2k7xN8zXvPD9N+z/uhXPaj0sUFCe2rcWZIpBsqxfP7xXFQ0tipAd/wjj1YxWyWtUS5IDJpOG82JKt2EAVA==}
+
+  readline-sync@1.4.10:
+    resolution: {integrity: sha512-gNva8/6UAe8QYepIQH/jQ2qn91Qj0B9sYjMBBs3QOB8F2CXcKgLxQaJRP76sWVRQt+QU+8fAkCbCvjjMFu7Ycw==}
+    engines: {node: '>= 0.8.0'}
+
+  real-require@0.2.0:
+    resolution: {integrity: sha512-57frrGM/OCTLqLOAh0mhVA9VBMHd+9U7Zb2THMGdBUoZVOtGbJzjxsYGDJ3A9AYYCP4hn6y1TVbaOfzWtm5GFg==}
+    engines: {node: '>= 12.13.0'}
+
+  redis-errors@1.2.0:
+    resolution: {integrity: sha512-1qny3OExCf0UvUV/5wpYKf2YwPcOqXzkwKKSmKHiE6ZMQs5heeE/c8eXK+PNllPvmjgAbfnsbpkGZWy8cBpn9w==}
+    engines: {node: '>=4'}
+
+  redis-parser@3.0.0:
+    resolution: {integrity: sha512-DJnGAeenTdpMEH6uAJRK/uiyEIH9WVsUmoLwzudwGJUwZPp80PDBWPHXSAGNPwNvIXAbe7MSUB1zQFugFml66A==}
+    engines: {node: '>=4'}
+
+  reflect-metadata@0.2.2:
+    resolution: {integrity: sha512-urBwgfrvVP/eAyXx4hluJivBKzuEbSQs9rKWCrCkbSxNv8mxPcUZKeuoF3Uy4mJl3Lwprp6yy5/39VWigZ4K6Q==}
+
+  reflect.getprototypeof@1.0.10:
+    resolution: {integrity: sha512-00o4I+DVrefhv+nX0ulyi3biSHCPDe+yLv5o/p6d/UVlirijB8E16FtfwSAi4g3tcqrQ4lRAqQSoFEZJehYEcw==}
+    engines: {node: '>= 0.4'}
+
+  regexp.prototype.flags@1.5.4:
+    resolution: {integrity: sha512-dYqgNSZbDwkaJ2ceRd9ojCGjBq+mOm9LmtXnAnEGyHhN/5R7iDW2TRw3h+o/jCFxus3P2LfWIIiwowAjANm7IA==}
+    engines: {node: '>= 0.4'}
+
+  require-directory@2.1.1:
+    resolution: {integrity: sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==}
+    engines: {node: '>=0.10.0'}
+
+  require-in-the-middle@7.5.2:
+    resolution: {integrity: sha512-gAZ+kLqBdHarXB64XpAe2VCjB7rIRv+mU8tfRWziHRJ5umKsIHN2tLLv6EtMw7WCdP19S0ERVMldNvxYCHnhSQ==}
+    engines: {node: '>=8.6.0'}
+
+  resolve-from@4.0.0:
+    resolution: {integrity: sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g==}
+    engines: {node: '>=4'}
+
+  resolve-pkg-maps@1.0.0:
+    resolution: {integrity: sha512-seS2Tj26TBVOC2NIc2rOe2y2ZO7efxITtLZcGSOnHHNOQ7CkiUBfw0Iw2ck6xkIhPwLhKNLS8BO+hEpngQlqzw==}
+
+  resolve@1.22.12:
+    resolution: {integrity: sha512-TyeJ1zif53BPfHootBGwPRYT1RUt6oGWsaQr8UyZW/eAm9bKoijtvruSDEmZHm92CwS9nj7/fWttqPCgzep8CA==}
+    engines: {node: '>= 0.4'}
+    hasBin: true
+
+  resolve@2.0.0-next.6:
+    resolution: {integrity: sha512-3JmVl5hMGtJ3kMmB3zi3DL25KfkCEyy3Tw7Gmw7z5w8M9WlwoPFnIvwChzu1+cF3iaK3sp18hhPz8ANeimdJfA==}
+    engines: {node: '>= 0.4'}
+    hasBin: true
+
+  retry@0.12.0:
+    resolution: {integrity: sha512-9LkiTwjUh6rT555DtE9rTX+BKByPfrMzEAtnlEtdEwr3Nkffwiihqe2bWADg+OQRjt9gl6ICdmB/ZFDCGAtSow==}
+    engines: {node: '>= 4'}
+
+  reusify@1.1.0:
+    resolution: {integrity: sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==}
+    engines: {iojs: '>=1.0.0', node: '>=0.10.0'}
+
+  rimraf@3.0.2:
+    resolution: {integrity: sha512-JZkJMZkAGFFPP2YqXZXPbMlMBgsxzE8ILs4lMIX/2o0L9UBw9O/Y3o6wFw/i9YLapcUJWwqbi3kdxIPdC62TIA==}
+    deprecated: Rimraf versions prior to v4 are no longer supported
+    hasBin: true
+
+  rollup@4.60.1:
+    resolution: {integrity: sha512-VmtB2rFU/GroZ4oL8+ZqXgSA38O6GR8KSIvWmEFv63pQ0G6KaBH9s07PO8XTXP4vI+3UJUEypOfjkGfmSBBR0w==}
+    engines: {node: '>=18.0.0', npm: '>=8.0.0'}
+    hasBin: true
+
+  run-parallel@1.2.0:
+    resolution: {integrity: sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==}
+
+  rxjs@7.8.2:
+    resolution: {integrity: sha512-dhKf903U/PQZY6boNNtAGdWbG85WAbjT/1xYoZIC7FAY0yWapOBQVsVrDl58W86//e1VpMNBtRV4MaXfdMySFA==}
+
+  safe-array-concat@1.1.3:
+    resolution: {integrity: sha512-AURm5f0jYEOydBj7VQlVvDrjeFgthDdEF5H1dP+6mNpoXOMo1quQqJ4wvJDyRZ9+pO3kGWoOdmV08cSv2aJV6Q==}
+    engines: {node: '>=0.4'}
+
+  safe-buffer@5.1.2:
+    resolution: {integrity: sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==}
+
+  safe-buffer@5.2.1:
+    resolution: {integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==}
+
+  safe-push-apply@1.0.0:
+    resolution: {integrity: sha512-iKE9w/Z7xCzUMIZqdBsp6pEQvwuEebH4vdpjcDWnyzaI6yl6O9FHvVpmGelvEHNsoY6wGblkxR6Zty/h00WiSA==}
+    engines: {node: '>= 0.4'}
+
+  safe-regex-test@1.1.0:
+    resolution: {integrity: sha512-x/+Cz4YrimQxQccJf5mKEbIa1NzeCRNI5Ecl/ekmlYaampdNLPalVyIcCZNNH3MvmqBugV5TMYZXv0ljslUlaw==}
+    engines: {node: '>= 0.4'}
+
+  safe-stable-stringify@2.5.0:
+    resolution: {integrity: sha512-b3rppTKm9T+PsVCBEOUR46GWI7fdOs00VKZ1+9c1EWDaDMvjQc6tUwuFyIprgGgTcWoVHSKrU8H31ZHA2e0RHA==}
+    engines: {node: '>=10'}
+
+  safer-buffer@2.1.2:
+    resolution: {integrity: sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==}
+
+  semver@6.3.1:
+    resolution: {integrity: sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==}
+    hasBin: true
+
+  semver@7.7.4:
+    resolution: {integrity: sha512-vFKC2IEtQnVhpT78h1Yp8wzwrf8CM+MzKMHGJZfBtzhZNycRFnXsHk6E5TxIkkMsgNS7mdX3AGB7x2QM2di4lA==}
+    engines: {node: '>=10'}
+    hasBin: true
+
+  send@0.19.2:
+    resolution: {integrity: sha512-VMbMxbDeehAxpOtWJXlcUS5E8iXh6QmN+BkRX1GARS3wRaXEEgzCcB10gTQazO42tpNIya8xIyNx8fll1OFPrg==}
+    engines: {node: '>= 0.8.0'}
+
+  serve-static@1.16.3:
+    resolution: {integrity: sha512-x0RTqQel6g5SY7Lg6ZreMmsOzncHFU7nhnRWkKgWuMTu5NN0DR5oruckMqRvacAN9d5w6ARnRBXl9xhDCgfMeA==}
+    engines: {node: '>= 0.8.0'}
+
+  set-function-length@1.2.2:
+    resolution: {integrity: sha512-pgRc4hJ4/sNjWCSS9AmnS40x3bNMDTknHgL5UaMBTMyJnU90EgWh1Rz+MC9eFu4BuN/UwZjKQuY/1v3rM7HMfg==}
+    engines: {node: '>= 0.4'}
+
+  set-function-name@2.0.2:
+    resolution: {integrity: sha512-7PGFlmtwsEADb0WYyvCMa1t+yke6daIG4Wirafur5kcf+MhUnPms1UeR0CKQdTZD81yESwMHbtn+TR+dMviakQ==}
+    engines: {node: '>= 0.4'}
+
+  set-proto@1.0.0:
+    resolution: {integrity: sha512-RJRdvCo6IAnPdsvP/7m6bsQqNnn1FCBX5ZNtFL98MmFF/4xAIJTIg1YbHW5DC2W5SKZanrC6i4HsJqlajw/dZw==}
+    engines: {node: '>= 0.4'}
+
+  setprototypeof@1.2.0:
+    resolution: {integrity: sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==}
+
+  shebang-command@2.0.0:
+    resolution: {integrity: sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==}
+    engines: {node: '>=8'}
+
+  shebang-regex@3.0.0:
+    resolution: {integrity: sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==}
+    engines: {node: '>=8'}
+
+  shimmer@1.2.1:
+    resolution: {integrity: sha512-sQTKC1Re/rM6XyFM6fIAGHRPVGvyXfgzIDvzoq608vM+jeyVD0Tu1E6Np0Kc2zAIFWIj963V2800iF/9LPieQw==}
+
+  side-channel-list@1.0.1:
+    resolution: {integrity: sha512-mjn/0bi/oUURjc5Xl7IaWi/OJJJumuoJFQJfDDyO46+hBWsfaVM65TBHq2eoZBhzl9EchxOijpkbRC8SVBQU0w==}
+    engines: {node: '>= 0.4'}
+
+  side-channel-map@1.0.1:
+    resolution: {integrity: sha512-VCjCNfgMsby3tTdo02nbjtM/ewra6jPHmpThenkTYh8pG9ucZ/1P8So4u4FGBek/BjpOVsDCMoLA/iuBKIFXRA==}
+    engines: {node: '>= 0.4'}
+
+  side-channel-weakmap@1.0.2:
+    resolution: {integrity: sha512-WPS/HvHQTYnHisLo9McqBHOJk2FkHO/tlpvldyrnem4aeQp4hai3gythswg6p01oSoTl58rcpiFAjF2br2Ak2A==}
+    engines: {node: '>= 0.4'}
+
+  side-channel@1.1.0:
+    resolution: {integrity: sha512-ZX99e6tRweoUXqR+VBrslhda51Nh5MTQwou5tnUDgbtyM0dBgmhEDtWGP/xbKn6hqfPRHujUNwz5fy/wbbhnpw==}
+    engines: {node: '>= 0.4'}
+
+  siginfo@2.0.0:
+    resolution: {integrity: sha512-ybx0WO1/8bSBLEWXZvEd7gMW3Sn3JFlW3TvX1nREbDLRNQNaeNN8WK0meBwPdAaOI7TtRRRJn/Es1zhrrCHu7g==}
+
+  signal-exit@3.0.7:
+    resolution: {integrity: sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ==}
+
+  signal-exit@4.1.0:
+    resolution: {integrity: sha512-bzyZ1e88w9O1iNJbKnOlvYTrWPDl46O1bG0D3XInv+9tkPrxrN8jUUTiFlDkkmKWgn1M6CfIA13SuGqOa9Korw==}
+    engines: {node: '>=14'}
+
+  sisteransi@1.0.5:
+    resolution: {integrity: sha512-bLGGlR1QxBcynn2d5YmDX4MGjlZvy2MRBDRNHLJ8VI6l6+9FUiyTFNJ0IveOSP0bcXgVDPRcfGqA0pjaqUpfVg==}
+
+  slash@3.0.0:
+    resolution: {integrity: sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q==}
+    engines: {node: '>=8'}
+
+  sonic-boom@3.8.1:
+    resolution: {integrity: sha512-y4Z8LCDBuum+PBP3lSV7RHrXscqksve/bi0as7mhwVnBW+/wUqKT/2Kb7um8yqcFy0duYbbPxzt89Zy2nOCaxg==}
+
+  source-map-js@1.2.1:
+    resolution: {integrity: sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==}
+    engines: {node: '>=0.10.0'}
+
+  source-map-support@0.5.21:
+    resolution: {integrity: sha512-uBHU3L3czsIyYXKX88fdrGovxdSCoTGDRZ6SYXtSRxLZUzHg5P/66Ht6uoUlHu9EZod+inXhKo3qQgwXUT/y1w==}
+
+  source-map@0.6.1:
+    resolution: {integrity: sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g==}
+    engines: {node: '>=0.10.0'}
+
+  split-ca@1.0.1:
+    resolution: {integrity: sha512-Q5thBSxp5t8WPTTJQS59LrGqOZqOsrhDGDVm8azCqIBjSBd7nd9o2PM+mDulQQkh8h//4U6hFZnc/mul8t5pWQ==}
+
+  split2@4.2.0:
+    resolution: {integrity: sha512-UcjcJOWknrNkF6PLX83qcHM6KHgVKNkV62Y8a5uYDVv9ydGQVwAHMKqHdJje1VTWpljG0WYpCDhrCdAOYH4TWg==}
+    engines: {node: '>= 10.x'}
+
+  sprintf-js@1.1.3:
+    resolution: {integrity: sha512-Oo+0REFV59/rz3gfJNKQiBlwfHaSESl1pcGyABQsnnIfWOFt6JNj5gCog2U6MLZ//IGYD+nA8nI+mTShREReaA==}
+
+  ssh-remote-port-forward@1.0.4:
+    resolution: {integrity: sha512-x0LV1eVDwjf1gmG7TTnfqIzf+3VPRz7vrNIjX6oYLbeCrf/PeVY6hkT68Mg+q02qXxQhrLjB0jfgvhevoCRmLQ==}
+
+  ssh2@1.17.0:
+    resolution: {integrity: sha512-wPldCk3asibAjQ/kziWQQt1Wh3PgDFpC0XpwclzKcdT1vql6KeYxf5LIt4nlFkUeR8WuphYMKqUA56X4rjbfgQ==}
+    engines: {node: '>=10.16.0'}
+
+  stable-hash@0.0.5:
+    resolution: {integrity: sha512-+L3ccpzibovGXFK+Ap/f8LOS0ahMrHTf3xu7mMLSpEGU0EO9ucaysSylKo9eRDFNhWve/y275iPmIZ4z39a9iA==}
+
+  stackback@0.0.2:
+    resolution: {integrity: sha512-1XMJE5fQo1jGH6Y/7ebnwPOBEkIEnT4QF32d5R1+VXdXveM0IBMJt8zfaxX1P3QhVwrYe+576+jkANtSS2mBbw==}
+
+  standard-as-callback@2.1.0:
+    resolution: {integrity: sha512-qoRRSyROncaz1z0mvYqIE4lCd9p2R90i6GxW3uZv5ucSu8tU7B5HXUP1gG8pVZsYNVaXjk8ClXHPttLyxAL48A==}
+
+  statuses@2.0.2:
+    resolution: {integrity: sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==}
+    engines: {node: '>= 0.8'}
+
+  std-env@3.10.0:
+    resolution: {integrity: sha512-5GS12FdOZNliM5mAOxFRg7Ir0pWz8MdpYm6AY6VPkGpbA7ZzmbzNcBJQ0GPvvyWgcY7QAhCgf9Uy89I03faLkg==}
+
+  stop-iteration-iterator@1.1.0:
+    resolution: {integrity: sha512-eLoXW/DHyl62zxY4SCaIgnRhuMr6ri4juEYARS8E6sCEqzKpOiE521Ucofdx+KnDZl5xmvGYaaKCk5FEOxJCoQ==}
+    engines: {node: '>= 0.4'}
+
+  streamsearch@1.1.0:
+    resolution: {integrity: sha512-Mcc5wHehp9aXz1ax6bZUyY5afg9u2rv5cqQI3mRrYkGC8rW2hM02jWuwjtL++LS5qinSyhj2QfLyNsuc+VsExg==}
+    engines: {node: '>=10.0.0'}
+
+  streamx@2.25.0:
+    resolution: {integrity: sha512-0nQuG6jf1w+wddNEEXCF4nTg3LtufWINB5eFEN+5TNZW7KWJp6x87+JFL43vaAUPyCfH1wID+mNVyW6OHtFamg==}
+
+  string-width@4.2.3:
+    resolution: {integrity: sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==}
+    engines: {node: '>=8'}
+
+  string-width@5.1.2:
+    resolution: {integrity: sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==}
+    engines: {node: '>=12'}
+
+  string.prototype.trim@1.2.10:
+    resolution: {integrity: sha512-Rs66F0P/1kedk5lyYyH9uBzuiI/kNRmwJAR9quK6VOtIpZ2G+hMZd+HQbbv25MgCA6gEffoMZYxlTod4WcdrKA==}
+    engines: {node: '>= 0.4'}
+
+  string.prototype.trimend@1.0.9:
+    resolution: {integrity: sha512-G7Ok5C6E/j4SGfyLCloXTrngQIQU3PWtXGst3yM7Bea9FRURf1S42ZHlZZtsNque2FN2PoUhfZXYLNWwEr4dLQ==}
+    engines: {node: '>= 0.4'}
+
+  string.prototype.trimstart@1.0.8:
+    resolution: {integrity: sha512-UXSH262CSZY1tfu3G3Secr6uGLCFVPMhIqHjlgCUtCCcgihYc/xKs9djMTMUOb2j1mVSeU8EU6NWc/iQKU6Gfg==}
+    engines: {node: '>= 0.4'}
+
+  string_decoder@1.1.1:
+    resolution: {integrity: sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==}
+
+  string_decoder@1.3.0:
+    resolution: {integrity: sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==}
+
+  strip-ansi@6.0.1:
+    resolution: {integrity: sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==}
+    engines: {node: '>=8'}
+
+  strip-ansi@7.2.0:
+    resolution: {integrity: sha512-yDPMNjp4WyfYBkHnjIRLfca1i6KMyGCtsVgoKe/z1+6vukgaENdgGBZt+ZmKPc4gavvEZ5OgHfHdrazhgNyG7w==}
+    engines: {node: '>=12'}
+
+  strip-bom@3.0.0:
+    resolution: {integrity: sha512-vavAMRXOgBVNF6nyEEmL3DBK19iRpDcoIwW+swQ+CbGiu7lju6t+JklA1MHweoWtadgt4ISVUsXLyDq34ddcwA==}
+    engines: {node: '>=4'}
+
+  strip-final-newline@3.0.0:
+    resolution: {integrity: sha512-dOESqjYr96iWYylGObzd39EuNTa5VJxyvVAEm5Jnh7KGo75V43Hk1odPQkNDyXNmUR6k+gEiDVXnjB8HJ3crXw==}
+    engines: {node: '>=12'}
+
+  strip-json-comments@3.1.1:
+    resolution: {integrity: sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig==}
+    engines: {node: '>=8'}
+
+  strip-literal@2.1.1:
+    resolution: {integrity: sha512-631UJ6O00eNGfMiWG78ck80dfBab8X6IVFB51jZK5Icd7XAs60Z5y7QdSd/wGIklnWvRbUNloVzhOKKmutxQ6Q==}
+
+  strtok3@10.3.5:
+    resolution: {integrity: sha512-ki4hZQfh5rX0QDLLkOCj+h+CVNkqmp/CMf8v8kZpkNVK6jGQooMytqzLZYUVYIZcFZ6yDB70EfD8POcFXiF5oA==}
+    engines: {node: '>=18'}
+
+  superagent@10.3.0:
+    resolution: {integrity: sha512-B+4Ik7ROgVKrQsXTV0Jwp2u+PXYLSlqtDAhYnkkD+zn3yg8s/zjA2MeGayPoY/KICrbitwneDHrjSotxKL+0XQ==}
+    engines: {node: '>=14.18.0'}
+
+  supertest@7.2.2:
+    resolution: {integrity: sha512-oK8WG9diS3DlhdUkcFn4tkNIiIbBx9lI2ClF8K+b2/m8Eyv47LSawxUzZQSNKUrVb2KsqeTDCcjAAVPYaSLVTA==}
+    engines: {node: '>=14.18.0'}
+
+  supports-color@7.2.0:
+    resolution: {integrity: sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==}
+    engines: {node: '>=8'}
+
+  supports-preserve-symlinks-flag@1.0.0:
+    resolution: {integrity: sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==}
+    engines: {node: '>= 0.4'}
+
+  tar-fs@2.1.4:
+    resolution: {integrity: sha512-mDAjwmZdh7LTT6pNleZ05Yt65HC3E+NiQzl672vQG38jIrehtJk/J3mNwIg+vShQPcLF/LV7CMnDW6vjj6sfYQ==}
+
+  tar-fs@3.1.2:
+    resolution: {integrity: sha512-QGxxTxxyleAdyM3kpFs14ymbYmNFrfY+pHj7Z8FgtbZ7w2//VAgLMac7sT6nRpIHjppXO2AwwEOg0bPFVRcmXw==}
+
+  tar-stream@2.2.0:
+    resolution: {integrity: sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==}
+    engines: {node: '>=6'}
+
+  tar-stream@3.1.8:
+    resolution: {integrity: sha512-U6QpVRyCGHva435KoNWy9PRoi2IFYCgtEhq9nmrPPpbRacPs9IH4aJ3gbrFC8dPcXvdSZ4XXfXT5Fshbp2MtlQ==}
+
+  teex@1.0.1:
+    resolution: {integrity: sha512-eYE6iEI62Ni1H8oIa7KlDU6uQBtqr4Eajni3wX7rpfXD8ysFx8z0+dri+KWEPWpBsxXfxu58x/0jvTVT1ekOSg==}
+
+  test-exclude@6.0.0:
+    resolution: {integrity: sha512-cAGWPIyOHU6zlmg88jwm7VRyXnMN7iV68OGAbYDk/Mh/xC/pzVPlQtY6ngoIH/5/tciuhGfvESU8GrHrcxD56w==}
+    engines: {node: '>=8'}
+
+  testcontainers@10.28.0:
+    resolution: {integrity: sha512-1fKrRRCsgAQNkarjHCMKzBKXSJFmzNTiTbhb5E/j5hflRXChEtHvkefjaHlgkNUjfw92/Dq8LTgwQn6RDBFbMg==}
+
+  text-decoder@1.2.7:
+    resolution: {integrity: sha512-vlLytXkeP4xvEq2otHeJfSQIRyWxo/oZGEbXrtEEF9Hnmrdly59sUbzZ/QgyWuLYHctCHxFF4tRQZNQ9k60ExQ==}
+
+  text-table@0.2.0:
+    resolution: {integrity: sha512-N+8UisAXDGk8PFXP4HAzVR9nbfmVJ3zYLAWiTIoqC5v5isinhr+r5uaO8+7r3BMfuNIufIsA7RdpVgacC2cSpw==}
+
+  thread-stream@2.7.0:
+    resolution: {integrity: sha512-qQiRWsU/wvNolI6tbbCKd9iKaTnCXsTwVxhhKM6nctPdujTyztjlbUkUTUymidWcMnZ5pWR0ej4a0tjsW021vw==}
+
+  timers-ext@0.1.8:
+    resolution: {integrity: sha512-wFH7+SEAcKfJpfLPkrgMPvvwnEtj8W4IurvEyrKsDleXnKLCDw71w8jltvfLa8Rm4qQxxT4jmDBYbJG/z7qoww==}
+    engines: {node: '>=0.12'}
+
+  tinybench@2.9.0:
+    resolution: {integrity: sha512-0+DUvqWMValLmha6lr4kD8iAMK1HzV0/aKnCtWb9v9641TnP/MFb7Pc2bxoxQjTXAErryXVgUOfv2YqNllqGeg==}
+
+  tinyglobby@0.2.16:
+    resolution: {integrity: sha512-pn99VhoACYR8nFHhxqix+uvsbXineAasWm5ojXoN8xEwK5Kd3/TrhNn1wByuD52UxWRLy8pu+kRMniEi6Eq9Zg==}
+    engines: {node: '>=12.0.0'}
+
+  tinypool@0.8.4:
+    resolution: {integrity: sha512-i11VH5gS6IFeLY3gMBQ00/MmLncVP7JLXOw1vlgkytLmJK7QnEr7NXf0LBdxfmNPAeyetukOk0bOYrJrFGjYJQ==}
+    engines: {node: '>=14.0.0'}
+
+  tinyspy@2.2.1:
+    resolution: {integrity: sha512-KYad6Vy5VDWV4GH3fjpseMQ/XU2BhIYP7Vzd0LG44qRWm/Yt2WCOTicFdvmgo6gWaqooMQCawTtILVQJupKu7A==}
+    engines: {node: '>=14.0.0'}
+
+  tmp@0.2.5:
+    resolution: {integrity: sha512-voyz6MApa1rQGUxT3E+BK7/ROe8itEx7vD8/HEvt4xwXucvQ5G5oeEiHkmHZJuBO21RpOf+YYm9MOivj709jow==}
+    engines: {node: '>=14.14'}
+
+  to-regex-range@5.0.1:
+    resolution: {integrity: sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==}
+    engines: {node: '>=8.0'}
+
+  toidentifier@1.0.1:
+    resolution: {integrity: sha512-o5sSPKEkg/DIQNmH43V0/uerLrpzVedkUh8tGNvaeXpfpuwjKenlSox/2O/BTlZUtEe+JG7s5YhEz608PlAHRA==}
+    engines: {node: '>=0.6'}
+
+  token-types@6.1.2:
+    resolution: {integrity: sha512-dRXchy+C0IgK8WPC6xvCHFRIWYUbqqdEIKPaKo/AcTUNzwLTK6AH7RjdLWsEZcAN/TBdtfUw3PYEgPr5VPr6ww==}
+    engines: {node: '>=14.16'}
+
+  tr46@0.0.3:
+    resolution: {integrity: sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==}
+
+  ts-api-utils@1.4.3:
+    resolution: {integrity: sha512-i3eMG77UTMD0hZhgRS562pv83RC6ukSAC2GMNWc+9dieh/+jDM5u5YG+NHX6VNDRHQcHwmsTHctP9LhbC3WxVw==}
+    engines: {node: '>=16'}
+    peerDependencies:
+      typescript: '>=4.2.0'
+
+  tsconfig-paths@3.15.0:
+    resolution: {integrity: sha512-2Ac2RgzDe/cn48GvOe3M+o82pEFewD3UPbyoUHHdKasHwJKjds4fLXWf/Ux5kATBKN20oaFGu+jbElp1pos0mg==}
+
+  tslib@2.8.1:
+    resolution: {integrity: sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==}
+
+  tsx@4.21.0:
+    resolution: {integrity: sha512-5C1sg4USs1lfG0GFb2RLXsdpXqBSEhAaA/0kPL01wxzpMqLILNxIxIOKiILz+cdg/pLnOUxFYOR5yhHU666wbw==}
+    engines: {node: '>=18.0.0'}
+    hasBin: true
+
+  turbo@2.9.6:
+    resolution: {integrity: sha512-+v2QJey7ZUeUiuigkU+uFfklvNUyPI2VO2vBpMYJA+a1hKFLFiKtUYlRHdb3P9CrAvMzi0upbjI4WT+zKtqkBg==}
+    hasBin: true
+
+  tweetnacl@0.14.5:
+    resolution: {integrity: sha512-KXXFFdAbFXY4geFIwoyNK+f5Z1b7swfXABfL7HXCmoIWMKU3dmS26672A4EeQtDzLKy7SXmfBu51JolvEKwtGA==}
+
+  type-check@0.4.0:
+    resolution: {integrity: sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew==}
+    engines: {node: '>= 0.8.0'}
+
+  type-detect@4.1.0:
+    resolution: {integrity: sha512-Acylog8/luQ8L7il+geoSxhEkazvkslg7PSNKOX59mbB9cOveP5aq9h74Y7YU8yDpJwetzQQrfIwtf4Wp4LKcw==}
+    engines: {node: '>=4'}
+
+  type-fest@0.20.2:
+    resolution: {integrity: sha512-Ne+eE4r0/iWnpAxD852z3A+N0Bt5RN//NjJwRd2VFHEmrywxf5vsZlh4R6lixl6B+wz/8d+maTSAkN1FIkI3LQ==}
+    engines: {node: '>=10'}
+
+  type-is@1.6.18:
+    resolution: {integrity: sha512-TkRKr9sUTxEH8MdfuCSP7VizJyzRNMjj2J2do2Jr3Kym598JVdEksuzPQCnlFPW4ky9Q+iA+ma9BGm06XQBy8g==}
+    engines: {node: '>= 0.6'}
+
+  type@2.7.3:
+    resolution: {integrity: sha512-8j+1QmAbPvLZow5Qpi6NCaN8FB60p/6x8/vfNqOk/hC+HuvFZhL4+WfekuhQLiqFZXOgQdrs3B+XxEmCc6b3FQ==}
+
+  typed-array-buffer@1.0.3:
+    resolution: {integrity: sha512-nAYYwfY3qnzX30IkA6AQZjVbtK6duGontcQm1WSG1MD94YLqK0515GNApXkoxKOWMusVssAHWLh9SeaoefYFGw==}
+    engines: {node: '>= 0.4'}
+
+  typed-array-byte-length@1.0.3:
+    resolution: {integrity: sha512-BaXgOuIxz8n8pIq3e7Atg/7s+DpiYrxn4vdot3w9KbnBhcRQq6o3xemQdIfynqSeXeDrF32x+WvfzmOjPiY9lg==}
+    engines: {node: '>= 0.4'}
+
+  typed-array-byte-offset@1.0.4:
+    resolution: {integrity: sha512-bTlAFB/FBYMcuX81gbL4OcpH5PmlFHqlCCpAl8AlEzMz5k53oNDvN8p1PNOWLEmI2x4orp3raOFB51tv9X+MFQ==}
+    engines: {node: '>= 0.4'}
+
+  typed-array-length@1.0.7:
+    resolution: {integrity: sha512-3KS2b+kL7fsuk/eJZ7EQdnEmQoaho/r6KUef7hxvltNA5DR8NAUM+8wJMbJyZ4G9/7i3v5zPBIMN5aybAh2/Jg==}
+    engines: {node: '>= 0.4'}
+
+  typedarray@0.0.6:
+    resolution: {integrity: sha512-/aCDEGatGvZ2BIk+HmLf4ifCJFwvKFNb9/JeZPMulfgFracn9QFcAf5GO8B/mweUjSoblS5In0cWhqpfs/5PQA==}
+
+  typescript@5.9.3:
+    resolution: {integrity: sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==}
+    engines: {node: '>=14.17'}
+    hasBin: true
+
+  ufo@1.6.3:
+    resolution: {integrity: sha512-yDJTmhydvl5lJzBmy/hyOAA0d+aqCBuwl818haVdYCRrWV84o7YyeVm4QlVHStqNrrJSTb6jKuFAVqAFsr+K3Q==}
+
+  uid@2.0.2:
+    resolution: {integrity: sha512-u3xV3X7uzvi5b1MncmZo3i2Aw222Zk1keqLA1YkHldREkAhAqi65wuPfe7lHx8H/Wzy+8CE7S7uS3jekIM5s8g==}
+    engines: {node: '>=8'}
+
+  uint8array-extras@1.5.0:
+    resolution: {integrity: sha512-rvKSBiC5zqCCiDZ9kAOszZcDvdAHwwIKJG33Ykj43OKcWsnmcBRL09YTU4nOeHZ8Y2a7l1MgTd08SBe9A8Qj6A==}
+    engines: {node: '>=18'}
+
+  unbox-primitive@1.1.0:
+    resolution: {integrity: sha512-nWJ91DjeOkej/TA8pXQ3myruKpKEYgqvpw9lz4OPHj/NWFNluYrjbz9j01CJ8yKQd2g4jFoOkINCTW2I5LEEyw==}
+    engines: {node: '>= 0.4'}
+
+  undici-types@5.26.5:
+    resolution: {integrity: sha512-JlCMO+ehdEIKqlFxk6IfVoAUVmgz7cU7zD/h9XZ0qzeosSHmUJVOzSQvvYSYWXkFXC+IfLKSIffhv0sVZup6pA==}
+
+  undici-types@6.21.0:
+    resolution: {integrity: sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==}
+
+  undici@5.29.0:
+    resolution: {integrity: sha512-raqeBD6NQK4SkWhQzeYKd1KmIG6dllBOTt55Rmkt4HtI9mwdWtJljnrXjAFUBLTSN67HWrOIZ3EPF4kjUw80Bg==}
+    engines: {node: '>=14.0'}
+
+  unpipe@1.0.0:
+    resolution: {integrity: sha512-pjy2bYhSsufwWlKwPc+l3cN7+wuJlK6uz0YdJEOlQDbl6jo/YlPi4mb8agUkVC8BF7V8NuzeyPNqRksA3hztKQ==}
+    engines: {node: '>= 0.8'}
+
+  unrs-resolver@1.11.1:
+    resolution: {integrity: sha512-bSjt9pjaEBnNiGgc9rUiHGKv5l4/TGzDmYw3RhnkJGtLhbnnA/5qJj7x3dNDCRx/PJxu774LlH8lCOlB4hEfKg==}
+
+  uri-js@4.4.1:
+    resolution: {integrity: sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==}
+
+  util-deprecate@1.0.2:
+    resolution: {integrity: sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==}
+
+  utils-merge@1.0.1:
+    resolution: {integrity: sha512-pMZTvIkT1d+TFGvDOqodOclx0QWkkgi6Tdoa8gC8ffGAAqz9pzPTZWAybbsHHoED/ztMtkv/VoYTYyShUn81hA==}
+    engines: {node: '>= 0.4.0'}
+
+  uuid@10.0.0:
+    resolution: {integrity: sha512-8XkAphELsDnEGrDxUOHB3RGvXz6TeuYSGEZBOjtTtPm2lwhGBjLgOzLHB63IUWfBpNucQjND6d3AOudO+H3RWQ==}
+    hasBin: true
+
+  uuid@11.1.0:
+    resolution: {integrity: sha512-0/A9rDy9P7cJ+8w1c9WD9V//9Wj15Ce2MPz8Ri6032usz+NfePxx5AcN3bN+r6ZL6jEo066/yNYB3tn4pQEx+A==}
+    hasBin: true
+
+  uuid@9.0.1:
+    resolution: {integrity: sha512-b+1eJOlsR9K8HJpow9Ok3fiWOWSIcIzXodvv0rQjVoOVNpWMpxf1wZNpt4y9h10odCNrqnYp1OBzRktckBe3sA==}
+    hasBin: true
+
+  vary@1.1.2:
+    resolution: {integrity: sha512-BNGbWLfd0eUPabhkXUVm0j8uuvREyTh5ovRa/dyow/BqAbZJyC+5fU+IzQOzmAKzYqYRAISoRhdQr3eIZ/PXqg==}
+    engines: {node: '>= 0.8'}
+
+  vite-node@1.6.1:
+    resolution: {integrity: sha512-YAXkfvGtuTzwWbDSACdJSg4A4DZiAqckWe90Zapc/sEX3XvHcw1NdurM/6od8J207tSDqNbSsgdCacBgvJKFuA==}
+    engines: {node: ^18.0.0 || >=20.0.0}
+    hasBin: true
+
+  vite@5.4.21:
+    resolution: {integrity: sha512-o5a9xKjbtuhY6Bi5S3+HvbRERmouabWbyUcpXXUA1u+GNUKoROi9byOJ8M0nHbHYHkYICiMlqxkg1KkYmm25Sw==}
+    engines: {node: ^18.0.0 || >=20.0.0}
+    hasBin: true
+    peerDependencies:
+      '@types/node': ^18.0.0 || >=20.0.0
+      less: '*'
+      lightningcss: ^1.21.0
+      sass: '*'
+      sass-embedded: '*'
+      stylus: '*'
+      sugarss: '*'
+      terser: ^5.4.0
+    peerDependenciesMeta:
+      '@types/node':
+        optional: true
+      less:
+        optional: true
+      lightningcss:
+        optional: true
+      sass:
+        optional: true
+      sass-embedded:
+        optional: true
+      stylus:
+        optional: true
+      sugarss:
+        optional: true
+      terser:
+        optional: true
+
+  vitest@1.6.1:
+    resolution: {integrity: sha512-Ljb1cnSJSivGN0LqXd/zmDbWEM0RNNg2t1QW/XUhYl/qPqyu7CsqeWtqQXHVaJsecLPuDoak2oJcZN2QoRIOag==}
+    engines: {node: ^18.0.0 || >=20.0.0}
+    hasBin: true
+    peerDependencies:
+      '@edge-runtime/vm': '*'
+      '@types/node': ^18.0.0 || >=20.0.0
+      '@vitest/browser': 1.6.1
+      '@vitest/ui': 1.6.1
+      happy-dom: '*'
+      jsdom: '*'
+    peerDependenciesMeta:
+      '@edge-runtime/vm':
+        optional: true
+      '@types/node':
+        optional: true
+      '@vitest/browser':
+        optional: true
+      '@vitest/ui':
+        optional: true
+      happy-dom:
+        optional: true
+      jsdom:
+        optional: true
+
+  webidl-conversions@3.0.1:
+    resolution: {integrity: sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==}
+
+  whatwg-url@5.0.0:
+    resolution: {integrity: sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==}
+
+  which-boxed-primitive@1.1.1:
+    resolution: {integrity: sha512-TbX3mj8n0odCBFVlY8AxkqcHASw3L60jIuF8jFP78az3C2YhmGvqbHBpAjTRH2/xqYunrJ9g1jSyjCjpoWzIAA==}
+    engines: {node: '>= 0.4'}
+
+  which-builtin-type@1.2.1:
+    resolution: {integrity: sha512-6iBczoX+kDQ7a3+YJBnh3T+KZRxM/iYNPXicqk66/Qfm1b93iu+yOImkg0zHbj5LNOcNv1TEADiZ0xa34B4q6Q==}
+    engines: {node: '>= 0.4'}
+
+  which-collection@1.0.2:
+    resolution: {integrity: sha512-K4jVyjnBdgvc86Y6BkaLZEN933SwYOuBFkdmBu9ZfkcAbdVbpITnDmjvZ/aQjRXQrv5EPkTnD1s39GiiqbngCw==}
+    engines: {node: '>= 0.4'}
+
+  which-typed-array@1.1.20:
+    resolution: {integrity: sha512-LYfpUkmqwl0h9A2HL09Mms427Q1RZWuOHsukfVcKRq9q95iQxdw0ix1JQrqbcDR9PH1QDwf5Qo8OZb5lksZ8Xg==}
+    engines: {node: '>= 0.4'}
+
+  which@2.0.2:
+    resolution: {integrity: sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==}
+    engines: {node: '>= 8'}
+    hasBin: true
+
+  why-is-node-running@2.3.0:
+    resolution: {integrity: sha512-hUrmaWBdVDcxvYqnyh09zunKzROWjbZTiNy8dBEjkS7ehEDQibXJ7XvlmtbwuTclUiIyN+CyXQD4Vmko8fNm8w==}
+    engines: {node: '>=8'}
+    hasBin: true
+
+  word-wrap@1.2.5:
+    resolution: {integrity: sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA==}
+    engines: {node: '>=0.10.0'}
+
+  wordwrap@1.0.0:
+    resolution: {integrity: sha512-gvVzJFlPycKc5dZN4yPkP8w7Dc37BtP1yczEneOb4uq34pXZcvrtRTmWV8W+Ume+XCxKgbjM+nevkyFPMybd4Q==}
+
+  wrap-ansi@7.0.0:
+    resolution: {integrity: sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==}
+    engines: {node: '>=10'}
+
+  wrap-ansi@8.1.0:
+    resolution: {integrity: sha512-si7QWI6zUMq56bESFvagtmzMdGOtoxfR+Sez11Mobfc7tm+VkUckk9bW2UeffTGVUbOksxmSw0AA2gs8g71NCQ==}
+    engines: {node: '>=12'}
+
+  wrappy@1.0.2:
+    resolution: {integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==}
+
+  xtend@4.0.2:
+    resolution: {integrity: sha512-LKYU1iAXJXUgAXn9URjiu+MWhyUXHsvfp7mcuYm9dSUKK0/CjtrUwFAxD82/mCWbtLsGjFIad0wIsod4zrTAEQ==}
+    engines: {node: '>=0.4'}
+
+  y18n@5.0.8:
+    resolution: {integrity: sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==}
+    engines: {node: '>=10'}
+
+  yaml@2.8.3:
+    resolution: {integrity: sha512-AvbaCLOO2Otw/lW5bmh9d/WEdcDFdQp2Z2ZUH3pX9U2ihyUY0nvLv7J6TrWowklRGPYbB/IuIMfYgxaCPg5Bpg==}
+    engines: {node: '>= 14.6'}
+    hasBin: true
+
+  yargs-parser@21.1.1:
+    resolution: {integrity: sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==}
+    engines: {node: '>=12'}
+
+  yargs@17.7.2:
+    resolution: {integrity: sha512-7dSzzRQ++CKnNI/krKnYRV7JKKPUXMEh61soaHKg9mrWEhzFWhFnxPxGl+69cD1Ou63C13NUPCnmIcrvqCuM6w==}
+    engines: {node: '>=12'}
+
+  yocto-queue@0.1.0:
+    resolution: {integrity: sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==}
+    engines: {node: '>=10'}
+
+  yocto-queue@1.2.2:
+    resolution: {integrity: sha512-4LCcse/U2MHZ63HAJVE+v71o7yOdIe4cZ70Wpf8D/IyjDKYQLV5GD46B+hSTjJsvV5PztjvHoU580EftxjDZFQ==}
+    engines: {node: '>=12.20'}
+
+  zip-stream@6.0.1:
+    resolution: {integrity: sha512-zK7YHHz4ZXpW89AHXUPbQVGKI7uvkd3hzusTdotCg1UxyaVtg0zFJSTfW/Dq5f7OBBVnq6cZIaC8Ti4hb6dtCA==}
+    engines: {node: '>= 14'}
+
+  zod@3.25.76:
+    resolution: {integrity: sha512-gzUt/qt81nXsFGKIFcC3YnfEAx5NkunCfnDlvuBSSFS02bcXu4Lmea0AFIUwbLWxWPx3d9p8S5QoaujKcNQxcQ==}
+
+snapshots:
+
+  '@ampproject/remapping@2.3.0':
+    dependencies:
+      '@jridgewell/gen-mapping': 0.3.13
+      '@jridgewell/trace-mapping': 0.3.31
+
+  '@babel/helper-string-parser@7.27.1': {}
+
+  '@babel/helper-validator-identifier@7.28.5': {}
+
+  '@babel/parser@7.29.2':
+    dependencies:
+      '@babel/types': 7.29.0
+
+  '@babel/types@7.29.0':
+    dependencies:
+      '@babel/helper-string-parser': 7.27.1
+      '@babel/helper-validator-identifier': 7.28.5
+
+  '@balena/dockerignore@1.0.2': {}
+
+  '@bcoe/v8-coverage@0.2.3': {}
+
+  '@borewit/text-codec@0.2.2': {}
+
+  '@emnapi/core@1.10.0':
+    dependencies:
+      '@emnapi/wasi-threads': 1.2.1
+      tslib: 2.8.1
+    optional: true
+
+  '@emnapi/runtime@1.10.0':
+    dependencies:
+      tslib: 2.8.1
+    optional: true
+
+  '@emnapi/wasi-threads@1.2.1':
+    dependencies:
+      tslib: 2.8.1
+    optional: true
+
+  '@esbuild-kit/core-utils@3.3.2':
+    dependencies:
+      esbuild: 0.18.20
+      source-map-support: 0.5.21
+
+  '@esbuild-kit/esm-loader@2.6.5':
+    dependencies:
+      '@esbuild-kit/core-utils': 3.3.2
+      get-tsconfig: 4.14.0
+
+  '@esbuild/aix-ppc64@0.19.12':
+    optional: true
+
+  '@esbuild/aix-ppc64@0.21.5':
+    optional: true
+
+  '@esbuild/aix-ppc64@0.27.7':
+    optional: true
+
+  '@esbuild/android-arm64@0.18.20':
+    optional: true
+
+  '@esbuild/android-arm64@0.19.12':
+    optional: true
+
+  '@esbuild/android-arm64@0.21.5':
+    optional: true
+
+  '@esbuild/android-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/android-arm@0.18.20':
+    optional: true
+
+  '@esbuild/android-arm@0.19.12':
+    optional: true
+
+  '@esbuild/android-arm@0.21.5':
+    optional: true
+
+  '@esbuild/android-arm@0.27.7':
+    optional: true
+
+  '@esbuild/android-x64@0.18.20':
+    optional: true
+
+  '@esbuild/android-x64@0.19.12':
+    optional: true
+
+  '@esbuild/android-x64@0.21.5':
+    optional: true
+
+  '@esbuild/android-x64@0.27.7':
+    optional: true
+
+  '@esbuild/darwin-arm64@0.18.20':
+    optional: true
+
+  '@esbuild/darwin-arm64@0.19.12':
+    optional: true
+
+  '@esbuild/darwin-arm64@0.21.5':
+    optional: true
+
+  '@esbuild/darwin-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/darwin-x64@0.18.20':
+    optional: true
+
+  '@esbuild/darwin-x64@0.19.12':
+    optional: true
+
+  '@esbuild/darwin-x64@0.21.5':
+    optional: true
+
+  '@esbuild/darwin-x64@0.27.7':
+    optional: true
+
+  '@esbuild/freebsd-arm64@0.18.20':
+    optional: true
+
+  '@esbuild/freebsd-arm64@0.19.12':
+    optional: true
+
+  '@esbuild/freebsd-arm64@0.21.5':
+    optional: true
+
+  '@esbuild/freebsd-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/freebsd-x64@0.18.20':
+    optional: true
+
+  '@esbuild/freebsd-x64@0.19.12':
+    optional: true
+
+  '@esbuild/freebsd-x64@0.21.5':
+    optional: true
+
+  '@esbuild/freebsd-x64@0.27.7':
+    optional: true
+
+  '@esbuild/linux-arm64@0.18.20':
+    optional: true
+
+  '@esbuild/linux-arm64@0.19.12':
+    optional: true
+
+  '@esbuild/linux-arm64@0.21.5':
+    optional: true
+
+  '@esbuild/linux-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/linux-arm@0.18.20':
+    optional: true
+
+  '@esbuild/linux-arm@0.19.12':
+    optional: true
+
+  '@esbuild/linux-arm@0.21.5':
+    optional: true
+
+  '@esbuild/linux-arm@0.27.7':
+    optional: true
+
+  '@esbuild/linux-ia32@0.18.20':
+    optional: true
+
+  '@esbuild/linux-ia32@0.19.12':
+    optional: true
+
+  '@esbuild/linux-ia32@0.21.5':
+    optional: true
+
+  '@esbuild/linux-ia32@0.27.7':
+    optional: true
+
+  '@esbuild/linux-loong64@0.18.20':
+    optional: true
+
+  '@esbuild/linux-loong64@0.19.12':
+    optional: true
+
+  '@esbuild/linux-loong64@0.21.5':
+    optional: true
+
+  '@esbuild/linux-loong64@0.27.7':
+    optional: true
+
+  '@esbuild/linux-mips64el@0.18.20':
+    optional: true
+
+  '@esbuild/linux-mips64el@0.19.12':
+    optional: true
+
+  '@esbuild/linux-mips64el@0.21.5':
+    optional: true
+
+  '@esbuild/linux-mips64el@0.27.7':
+    optional: true
+
+  '@esbuild/linux-ppc64@0.18.20':
+    optional: true
+
+  '@esbuild/linux-ppc64@0.19.12':
+    optional: true
+
+  '@esbuild/linux-ppc64@0.21.5':
+    optional: true
+
+  '@esbuild/linux-ppc64@0.27.7':
+    optional: true
+
+  '@esbuild/linux-riscv64@0.18.20':
+    optional: true
+
+  '@esbuild/linux-riscv64@0.19.12':
+    optional: true
+
+  '@esbuild/linux-riscv64@0.21.5':
+    optional: true
+
+  '@esbuild/linux-riscv64@0.27.7':
+    optional: true
+
+  '@esbuild/linux-s390x@0.18.20':
+    optional: true
+
+  '@esbuild/linux-s390x@0.19.12':
+    optional: true
+
+  '@esbuild/linux-s390x@0.21.5':
+    optional: true
+
+  '@esbuild/linux-s390x@0.27.7':
+    optional: true
+
+  '@esbuild/linux-x64@0.18.20':
+    optional: true
+
+  '@esbuild/linux-x64@0.19.12':
+    optional: true
+
+  '@esbuild/linux-x64@0.21.5':
+    optional: true
+
+  '@esbuild/linux-x64@0.27.7':
+    optional: true
+
+  '@esbuild/netbsd-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/netbsd-x64@0.18.20':
+    optional: true
+
+  '@esbuild/netbsd-x64@0.19.12':
+    optional: true
+
+  '@esbuild/netbsd-x64@0.21.5':
+    optional: true
+
+  '@esbuild/netbsd-x64@0.27.7':
+    optional: true
+
+  '@esbuild/openbsd-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/openbsd-x64@0.18.20':
+    optional: true
+
+  '@esbuild/openbsd-x64@0.19.12':
+    optional: true
+
+  '@esbuild/openbsd-x64@0.21.5':
+    optional: true
+
+  '@esbuild/openbsd-x64@0.27.7':
+    optional: true
+
+  '@esbuild/openharmony-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/sunos-x64@0.18.20':
+    optional: true
+
+  '@esbuild/sunos-x64@0.19.12':
+    optional: true
+
+  '@esbuild/sunos-x64@0.21.5':
+    optional: true
+
+  '@esbuild/sunos-x64@0.27.7':
+    optional: true
+
+  '@esbuild/win32-arm64@0.18.20':
+    optional: true
+
+  '@esbuild/win32-arm64@0.19.12':
+    optional: true
+
+  '@esbuild/win32-arm64@0.21.5':
+    optional: true
+
+  '@esbuild/win32-arm64@0.27.7':
+    optional: true
+
+  '@esbuild/win32-ia32@0.18.20':
+    optional: true
+
+  '@esbuild/win32-ia32@0.19.12':
+    optional: true
+
+  '@esbuild/win32-ia32@0.21.5':
+    optional: true
+
+  '@esbuild/win32-ia32@0.27.7':
+    optional: true
+
+  '@esbuild/win32-x64@0.18.20':
+    optional: true
+
+  '@esbuild/win32-x64@0.19.12':
+    optional: true
+
+  '@esbuild/win32-x64@0.21.5':
+    optional: true
+
+  '@esbuild/win32-x64@0.27.7':
+    optional: true
+
+  '@eslint-community/eslint-utils@4.9.1(eslint@8.57.1)':
+    dependencies:
+      eslint: 8.57.1
+      eslint-visitor-keys: 3.4.3
+
+  '@eslint-community/regexpp@4.12.2': {}
+
+  '@eslint/eslintrc@2.1.4':
+    dependencies:
+      ajv: 6.14.0
+      debug: 4.4.3
+      espree: 9.6.1
+      globals: 13.24.0
+      ignore: 5.3.2
+      import-fresh: 3.3.1
+      js-yaml: 4.1.1
+      minimatch: 3.1.5
+      strip-json-comments: 3.1.1
+    transitivePeerDependencies:
+      - supports-color
+
+  '@eslint/js@8.57.1': {}
+
+  '@fastify/busboy@2.1.1': {}
+
+  '@grpc/grpc-js@1.14.3':
+    dependencies:
+      '@grpc/proto-loader': 0.8.0
+      '@js-sdsl/ordered-map': 4.4.2
+
+  '@grpc/proto-loader@0.7.15':
+    dependencies:
+      lodash.camelcase: 4.3.0
+      long: 5.3.2
+      protobufjs: 7.5.5
+      yargs: 17.7.2
+
+  '@grpc/proto-loader@0.8.0':
+    dependencies:
+      lodash.camelcase: 4.3.0
+      long: 5.3.2
+      protobufjs: 7.5.5
+      yargs: 17.7.2
+
+  '@hapi/b64@5.0.0':
+    dependencies:
+      '@hapi/hoek': 9.3.0
+
+  '@hapi/boom@10.0.1':
+    dependencies:
+      '@hapi/hoek': 11.0.7
+
+  '@hapi/boom@9.1.4':
+    dependencies:
+      '@hapi/hoek': 9.3.0
+
+  '@hapi/bourne@2.1.0': {}
+
+  '@hapi/catbox@12.1.1':
+    dependencies:
+      '@hapi/boom': 10.0.1
+      '@hapi/hoek': 11.0.7
+      '@hapi/podium': 5.0.2
+      '@hapi/validate': 2.0.1
+
+  '@hapi/cryptiles@5.1.0':
+    dependencies:
+      '@hapi/boom': 9.1.4
+
+  '@hapi/hoek@11.0.7': {}
+
+  '@hapi/hoek@9.3.0': {}
+
+  '@hapi/iron@6.0.0':
+    dependencies:
+      '@hapi/b64': 5.0.0
+      '@hapi/boom': 9.1.4
+      '@hapi/bourne': 2.1.0
+      '@hapi/cryptiles': 5.1.0
+      '@hapi/hoek': 9.3.0
+
+  '@hapi/podium@4.1.3':
+    dependencies:
+      '@hapi/hoek': 9.3.0
+      '@hapi/teamwork': 5.1.1
+      '@hapi/validate': 1.1.3
+
+  '@hapi/podium@5.0.2':
+    dependencies:
+      '@hapi/hoek': 11.0.7
+      '@hapi/teamwork': 6.0.1
+      '@hapi/validate': 2.0.1
+
+  '@hapi/shot@6.0.2':
+    dependencies:
+      '@hapi/hoek': 11.0.7
+      '@hapi/validate': 2.0.1
+
+  '@hapi/teamwork@5.1.1': {}
+
+  '@hapi/teamwork@6.0.1': {}
+
+  '@hapi/topo@5.1.0':
+    dependencies:
+      '@hapi/hoek': 9.3.0
+
+  '@hapi/topo@6.0.2':
+    dependencies:
+      '@hapi/hoek': 11.0.7
+
+  '@hapi/validate@1.1.3':
+    dependencies:
+      '@hapi/hoek': 9.3.0
+      '@hapi/topo': 5.1.0
+
+  '@hapi/validate@2.0.1':
+    dependencies:
+      '@hapi/hoek': 11.0.7
+      '@hapi/topo': 6.0.2
+
+  '@humanwhocodes/config-array@0.13.0':
+    dependencies:
+      '@humanwhocodes/object-schema': 2.0.3
+      debug: 4.4.3
+      minimatch: 3.1.5
+    transitivePeerDependencies:
+      - supports-color
+
+  '@humanwhocodes/module-importer@1.0.1': {}
+
+  '@humanwhocodes/object-schema@2.0.3': {}
+
+  '@ioredis/as-callback@3.0.0': {}
+
+  '@ioredis/commands@1.5.1': {}
+
+  '@isaacs/cliui@8.0.2':
+    dependencies:
+      string-width: 5.1.2
+      string-width-cjs: string-width@4.2.3
+      strip-ansi: 7.2.0
+      strip-ansi-cjs: strip-ansi@6.0.1
+      wrap-ansi: 8.1.0
+      wrap-ansi-cjs: wrap-ansi@7.0.0
+
+  '@istanbuljs/schema@0.1.6': {}
+
+  '@jest/schemas@29.6.3':
+    dependencies:
+      '@sinclair/typebox': 0.27.10
+
+  '@jridgewell/gen-mapping@0.3.13':
+    dependencies:
+      '@jridgewell/sourcemap-codec': 1.5.5
+      '@jridgewell/trace-mapping': 0.3.31
+
+  '@jridgewell/resolve-uri@3.1.2': {}
+
+  '@jridgewell/sourcemap-codec@1.5.5': {}
+
+  '@jridgewell/trace-mapping@0.3.31':
+    dependencies:
+      '@jridgewell/resolve-uri': 3.1.2
+      '@jridgewell/sourcemap-codec': 1.5.5
+
+  '@js-sdsl/ordered-map@4.4.2': {}
+
+  '@lukeed/csprng@1.1.0': {}
+
+  '@msgpackr-extract/msgpackr-extract-darwin-arm64@3.0.3':
+    optional: true
+
+  '@msgpackr-extract/msgpackr-extract-darwin-x64@3.0.3':
+    optional: true
+
+  '@msgpackr-extract/msgpackr-extract-linux-arm64@3.0.3':
+    optional: true
+
+  '@msgpackr-extract/msgpackr-extract-linux-arm@3.0.3':
+    optional: true
+
+  '@msgpackr-extract/msgpackr-extract-linux-x64@3.0.3':
+    optional: true
+
+  '@msgpackr-extract/msgpackr-extract-win32-x64@3.0.3':
+    optional: true
+
+  '@napi-rs/wasm-runtime@0.2.12':
+    dependencies:
+      '@emnapi/core': 1.10.0
+      '@emnapi/runtime': 1.10.0
+      '@tybys/wasm-util': 0.10.1
+    optional: true
+
+  '@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)':
+    dependencies:
+      file-type: 20.4.1
+      iterare: 1.2.1
+      reflect-metadata: 0.2.2
+      rxjs: 7.8.2
+      tslib: 2.8.1
+      uid: 2.0.2
+    transitivePeerDependencies:
+      - supports-color
+
+  '@nestjs/core@10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)':
+    dependencies:
+      '@nestjs/common': 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nuxtjs/opencollective': 0.3.2
+      fast-safe-stringify: 2.1.1
+      iterare: 1.2.1
+      path-to-regexp: 3.3.0
+      reflect-metadata: 0.2.2
+      rxjs: 7.8.2
+      tslib: 2.8.1
+      uid: 2.0.2
+    optionalDependencies:
+      '@nestjs/platform-express': 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)
+    transitivePeerDependencies:
+      - encoding
+
+  '@nestjs/platform-express@10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)':
+    dependencies:
+      '@nestjs/common': 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/core': 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      body-parser: 1.20.4
+      cors: 2.8.5
+      express: 4.22.1
+      multer: 2.0.2
+      tslib: 2.8.1
+    transitivePeerDependencies:
+      - supports-color
+
+  '@nestjs/testing@10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)(@nestjs/platform-express@10.4.22)':
+    dependencies:
+      '@nestjs/common': 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/core': 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      tslib: 2.8.1
+    optionalDependencies:
+      '@nestjs/platform-express': 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)
+
+  '@noble/hashes@1.8.0': {}
+
+  '@nodelib/fs.scandir@2.1.5':
+    dependencies:
+      '@nodelib/fs.stat': 2.0.5
+      run-parallel: 1.2.0
+
+  '@nodelib/fs.stat@2.0.5': {}
+
+  '@nodelib/fs.walk@1.2.8':
+    dependencies:
+      '@nodelib/fs.scandir': 2.1.5
+      fastq: 1.20.1
+
+  '@nolyfill/is-core-module@1.0.39': {}
+
+  '@nuxtjs/opencollective@0.3.2':
+    dependencies:
+      chalk: 4.1.2
+      consola: 2.15.3
+      node-fetch: 2.7.0
+    transitivePeerDependencies:
+      - encoding
+
+  '@opentelemetry/api-logs@0.49.1':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+
+  '@opentelemetry/api-logs@0.51.1':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+
+  '@opentelemetry/api@1.9.1': {}
+
+  '@opentelemetry/auto-instrumentations-node@0.43.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-amqplib': 0.35.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-aws-lambda': 0.39.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-aws-sdk': 0.39.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-bunyan': 0.36.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-cassandra-driver': 0.36.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-connect': 0.34.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-cucumber': 0.4.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-dataloader': 0.7.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-dns': 0.34.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-express': 0.36.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-fastify': 0.34.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-fs': 0.10.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-generic-pool': 0.34.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-graphql': 0.38.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-grpc': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-hapi': 0.35.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-http': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-ioredis': 0.38.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-knex': 0.34.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-koa': 0.38.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-lru-memoizer': 0.35.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-memcached': 0.34.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-mongodb': 0.41.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-mongoose': 0.36.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-mysql': 0.36.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-mysql2': 0.36.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-nestjs-core': 0.35.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-net': 0.34.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-pg': 0.39.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-pino': 0.36.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-redis': 0.37.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-redis-4': 0.37.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-restify': 0.36.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-router': 0.35.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-socket.io': 0.37.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-tedious': 0.8.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation-winston': 0.35.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resource-detector-alibaba-cloud': 0.28.10(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resource-detector-aws': 1.12.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resource-detector-container': 0.3.11(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resource-detector-gcp': 0.29.13(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-node': 0.49.1(@opentelemetry/api@1.9.1)
+    transitivePeerDependencies:
+      - encoding
+      - supports-color
+
+  '@opentelemetry/context-async-hooks@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+
+  '@opentelemetry/context-async-hooks@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+
+  '@opentelemetry/core@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/semantic-conventions': 1.22.0
+
+  '@opentelemetry/core@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/semantic-conventions': 1.24.1
+
+  '@opentelemetry/core@1.30.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/semantic-conventions': 1.28.0
+
+  '@opentelemetry/exporter-trace-otlp-grpc@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@grpc/grpc-js': 1.14.3
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-grpc-exporter-base': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-transformer': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/exporter-trace-otlp-grpc@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@grpc/grpc-js': 1.14.3
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-grpc-exporter-base': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-transformer': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/exporter-trace-otlp-http@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-transformer': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/exporter-trace-otlp-http@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-transformer': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/exporter-trace-otlp-proto@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-proto-exporter-base': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-transformer': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/exporter-trace-otlp-proto@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-proto-exporter-base': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-transformer': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/exporter-zipkin@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.22.0
+
+  '@opentelemetry/exporter-zipkin@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.24.1
+
+  '@opentelemetry/instrumentation-amqplib@0.35.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-aws-lambda@0.39.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/propagator-aws-xray': 1.26.2(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/aws-lambda': 8.10.122
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-aws-sdk@0.39.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/propagation-utils': 0.30.16(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-bunyan@0.36.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.49.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@types/bunyan': 1.8.9
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-cassandra-driver@0.36.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-connect@0.34.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/connect': 3.4.36
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-cucumber@0.4.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-dataloader@0.7.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-dns@0.34.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      semver: 7.7.4
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-express@0.36.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-fastify@0.34.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-fs@0.10.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-generic-pool@0.34.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-graphql@0.38.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-grpc@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.22.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-hapi@0.35.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/hapi__hapi': 20.0.13
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-http@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.22.0
+      semver: 7.7.4
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-ioredis@0.38.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/redis-common': 0.36.2
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/ioredis4': '@types/ioredis@4.28.10'
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-knex@0.34.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-koa@0.38.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/koa': 2.14.0
+      '@types/koa__router': 12.0.3
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-lru-memoizer@0.35.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-memcached@0.34.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/memcached': 2.2.10
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-mongodb@0.41.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-metrics': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-mongoose@0.36.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-mysql2@0.36.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@opentelemetry/sql-common': 0.40.1(@opentelemetry/api@1.9.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-mysql@0.36.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/mysql': 2.15.22
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-nestjs-core@0.35.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-net@0.34.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-pg@0.39.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@opentelemetry/sql-common': 0.40.1(@opentelemetry/api@1.9.1)
+      '@types/pg': 8.6.1
+      '@types/pg-pool': 2.0.4
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-pino@0.36.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-redis-4@0.37.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/redis-common': 0.36.2
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-redis@0.37.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/redis-common': 0.36.2
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-restify@0.36.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-router@0.35.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-socket.io@0.37.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-tedious@0.8.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      '@types/tedious': 4.0.14
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation-winston@0.35.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.49.1
+      '@types/shimmer': 1.2.0
+      import-in-the-middle: 1.7.1
+      require-in-the-middle: 7.5.2
+      semver: 7.7.4
+      shimmer: 1.2.1
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/instrumentation@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.51.1
+      '@types/shimmer': 1.2.0
+      import-in-the-middle: 1.7.4
+      require-in-the-middle: 7.5.2
+      semver: 7.7.4
+      shimmer: 1.2.1
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/otlp-exporter-base@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/otlp-exporter-base@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/otlp-grpc-exporter-base@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@grpc/grpc-js': 1.14.3
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.49.1(@opentelemetry/api@1.9.1)
+      protobufjs: 7.5.5
+
+  '@opentelemetry/otlp-grpc-exporter-base@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@grpc/grpc-js': 1.14.3
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.51.1(@opentelemetry/api@1.9.1)
+      protobufjs: 7.5.5
+
+  '@opentelemetry/otlp-proto-exporter-base@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.49.1(@opentelemetry/api@1.9.1)
+      protobufjs: 7.5.5
+
+  '@opentelemetry/otlp-proto-exporter-base@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/otlp-exporter-base': 0.51.1(@opentelemetry/api@1.9.1)
+      protobufjs: 7.5.5
+
+  '@opentelemetry/otlp-transformer@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.49.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-logs': 0.49.1(@opentelemetry/api-logs@0.49.1)(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-metrics': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/otlp-transformer@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.51.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-logs': 0.51.1(@opentelemetry/api-logs@0.51.1)(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-metrics': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/propagation-utils@0.30.16(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+
+  '@opentelemetry/propagator-aws-xray@1.26.2(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+
+  '@opentelemetry/propagator-b3@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/propagator-b3@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/propagator-jaeger@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/propagator-jaeger@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/redis-common@0.36.2': {}
+
+  '@opentelemetry/resource-detector-alibaba-cloud@0.28.10(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+
+  '@opentelemetry/resource-detector-aws@1.12.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+
+  '@opentelemetry/resource-detector-container@0.3.11(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+
+  '@opentelemetry/resource-detector-gcp@0.29.13(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.40.0
+      gcp-metadata: 6.1.1
+    transitivePeerDependencies:
+      - encoding
+      - supports-color
+
+  '@opentelemetry/resources@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.22.0
+
+  '@opentelemetry/resources@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.24.1
+
+  '@opentelemetry/resources@1.30.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.28.0
+
+  '@opentelemetry/sdk-logs@0.49.1(@opentelemetry/api-logs@0.49.1)(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.49.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/sdk-logs@0.51.1(@opentelemetry/api-logs@0.51.1)(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.51.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/sdk-metrics@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      lodash.merge: 4.6.2
+
+  '@opentelemetry/sdk-metrics@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      lodash.merge: 4.6.2
+
+  '@opentelemetry/sdk-metrics@1.30.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.1)
+
+  '@opentelemetry/sdk-node@0.49.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.49.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-trace-otlp-grpc': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-trace-otlp-http': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-trace-otlp-proto': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-zipkin': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.49.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-logs': 0.49.1(@opentelemetry/api-logs@0.49.1)(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-metrics': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-node': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.22.0
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/sdk-node@0.51.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/api-logs': 0.51.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-trace-otlp-grpc': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-trace-otlp-http': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-trace-otlp-proto': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/exporter-zipkin': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/instrumentation': 0.51.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-logs': 0.51.1(@opentelemetry/api-logs@0.51.1)(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-metrics': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-node': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.24.1
+    transitivePeerDependencies:
+      - supports-color
+
+  '@opentelemetry/sdk-trace-base@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.22.0
+
+  '@opentelemetry/sdk-trace-base@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/resources': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/semantic-conventions': 1.24.1
+
+  '@opentelemetry/sdk-trace-node@1.22.0(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/context-async-hooks': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/core': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/propagator-b3': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/propagator-jaeger': 1.22.0(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.22.0(@opentelemetry/api@1.9.1)
+      semver: 7.7.4
+
+  '@opentelemetry/sdk-trace-node@1.24.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/context-async-hooks': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/core': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/propagator-b3': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/propagator-jaeger': 1.24.1(@opentelemetry/api@1.9.1)
+      '@opentelemetry/sdk-trace-base': 1.24.1(@opentelemetry/api@1.9.1)
+      semver: 7.7.4
+
+  '@opentelemetry/semantic-conventions@1.22.0': {}
+
+  '@opentelemetry/semantic-conventions@1.24.1': {}
+
+  '@opentelemetry/semantic-conventions@1.28.0': {}
+
+  '@opentelemetry/semantic-conventions@1.40.0': {}
+
+  '@opentelemetry/sql-common@0.40.1(@opentelemetry/api@1.9.1)':
+    dependencies:
+      '@opentelemetry/api': 1.9.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.1)
+
+  '@paralleldrive/cuid2@2.3.1':
+    dependencies:
+      '@noble/hashes': 1.8.0
+
+  '@pkgjs/parseargs@0.11.0':
+    optional: true
+
+  '@protobufjs/aspromise@1.1.2': {}
+
+  '@protobufjs/base64@1.1.2': {}
+
+  '@protobufjs/codegen@2.0.4': {}
+
+  '@protobufjs/eventemitter@1.1.0': {}
+
+  '@protobufjs/fetch@1.1.0':
+    dependencies:
+      '@protobufjs/aspromise': 1.1.2
+      '@protobufjs/inquire': 1.1.0
+
+  '@protobufjs/float@1.0.2': {}
+
+  '@protobufjs/inquire@1.1.0': {}
+
+  '@protobufjs/path@1.1.2': {}
+
+  '@protobufjs/pool@1.1.0': {}
+
+  '@protobufjs/utf8@1.1.0': {}
+
+  '@rollup/rollup-android-arm-eabi@4.60.1':
+    optional: true
+
+  '@rollup/rollup-android-arm64@4.60.1':
+    optional: true
+
+  '@rollup/rollup-darwin-arm64@4.60.1':
+    optional: true
+
+  '@rollup/rollup-darwin-x64@4.60.1':
+    optional: true
+
+  '@rollup/rollup-freebsd-arm64@4.60.1':
+    optional: true
+
+  '@rollup/rollup-freebsd-x64@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-arm-gnueabihf@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-arm-musleabihf@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-arm64-gnu@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-arm64-musl@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-loong64-gnu@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-loong64-musl@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-ppc64-gnu@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-ppc64-musl@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-riscv64-gnu@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-riscv64-musl@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-s390x-gnu@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-x64-gnu@4.60.1':
+    optional: true
+
+  '@rollup/rollup-linux-x64-musl@4.60.1':
+    optional: true
+
+  '@rollup/rollup-openbsd-x64@4.60.1':
+    optional: true
+
+  '@rollup/rollup-openharmony-arm64@4.60.1':
+    optional: true
+
+  '@rollup/rollup-win32-arm64-msvc@4.60.1':
+    optional: true
+
+  '@rollup/rollup-win32-ia32-msvc@4.60.1':
+    optional: true
+
+  '@rollup/rollup-win32-x64-gnu@4.60.1':
+    optional: true
+
+  '@rollup/rollup-win32-x64-msvc@4.60.1':
+    optional: true
+
+  '@rtsao/scc@1.1.0': {}
+
+  '@sentry-internal/tracing@7.120.4':
+    dependencies:
+      '@sentry/core': 7.120.4
+      '@sentry/types': 7.120.4
+      '@sentry/utils': 7.120.4
+
+  '@sentry/core@7.120.4':
+    dependencies:
+      '@sentry/types': 7.120.4
+      '@sentry/utils': 7.120.4
+
+  '@sentry/integrations@7.120.4':
+    dependencies:
+      '@sentry/core': 7.120.4
+      '@sentry/types': 7.120.4
+      '@sentry/utils': 7.120.4
+      localforage: 1.10.0
+
+  '@sentry/node@7.120.4':
+    dependencies:
+      '@sentry-internal/tracing': 7.120.4
+      '@sentry/core': 7.120.4
+      '@sentry/integrations': 7.120.4
+      '@sentry/types': 7.120.4
+      '@sentry/utils': 7.120.4
+
+  '@sentry/types@7.120.4': {}
+
+  '@sentry/utils@7.120.4':
+    dependencies:
+      '@sentry/types': 7.120.4
+
+  '@sideway/address@4.1.5':
+    dependencies:
+      '@hapi/hoek': 9.3.0
+
+  '@sideway/formula@3.0.1': {}
+
+  '@sideway/pinpoint@2.0.0': {}
+
+  '@sinclair/typebox@0.27.10': {}
+
+  '@testcontainers/postgresql@10.28.0':
+    dependencies:
+      testcontainers: 10.28.0
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - bare-buffer
+      - react-native-b4a
+      - supports-color
+
+  '@tokenizer/inflate@0.2.7':
+    dependencies:
+      debug: 4.4.3
+      fflate: 0.8.2
+      token-types: 6.1.2
+    transitivePeerDependencies:
+      - supports-color
+
+  '@tokenizer/token@0.3.0': {}
+
+  '@turbo/darwin-64@2.9.6':
+    optional: true
+
+  '@turbo/darwin-arm64@2.9.6':
+    optional: true
+
+  '@turbo/linux-64@2.9.6':
+    optional: true
+
+  '@turbo/linux-arm64@2.9.6':
+    optional: true
+
+  '@turbo/windows-64@2.9.6':
+    optional: true
+
+  '@turbo/windows-arm64@2.9.6':
+    optional: true
+
+  '@tybys/wasm-util@0.10.1':
+    dependencies:
+      tslib: 2.8.1
+    optional: true
+
+  '@types/accepts@1.3.7':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/aws-lambda@8.10.122': {}
+
+  '@types/body-parser@1.19.6':
+    dependencies:
+      '@types/connect': 3.4.38
+      '@types/node': 20.19.39
+
+  '@types/bunyan@1.8.9':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/connect@3.4.36':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/connect@3.4.38':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/content-disposition@0.5.9': {}
+
+  '@types/cookiejar@2.1.5': {}
+
+  '@types/cookies@0.9.2':
+    dependencies:
+      '@types/connect': 3.4.38
+      '@types/express': 4.17.25
+      '@types/keygrip': 1.0.6
+      '@types/node': 20.19.39
+
+  '@types/docker-modem@3.0.6':
+    dependencies:
+      '@types/node': 20.19.39
+      '@types/ssh2': 1.15.5
+
+  '@types/dockerode@3.3.47':
+    dependencies:
+      '@types/docker-modem': 3.0.6
+      '@types/node': 20.19.39
+      '@types/ssh2': 1.15.5
+
+  '@types/estree@1.0.8': {}
+
+  '@types/express-serve-static-core@4.19.8':
+    dependencies:
+      '@types/node': 20.19.39
+      '@types/qs': 6.15.0
+      '@types/range-parser': 1.2.7
+      '@types/send': 1.2.1
+
+  '@types/express@4.17.25':
+    dependencies:
+      '@types/body-parser': 1.19.6
+      '@types/express-serve-static-core': 4.19.8
+      '@types/qs': 6.15.0
+      '@types/serve-static': 1.15.10
+
+  '@types/hapi__catbox@12.1.0':
+    dependencies:
+      '@hapi/catbox': 12.1.1
+
+  '@types/hapi__hapi@20.0.13':
+    dependencies:
+      '@hapi/boom': 9.1.4
+      '@hapi/iron': 6.0.0
+      '@hapi/podium': 4.1.3
+      '@types/hapi__catbox': 12.1.0
+      '@types/hapi__mimos': 4.1.4
+      '@types/hapi__shot': 6.0.0
+      '@types/node': 20.19.39
+      joi: 17.13.3
+
+  '@types/hapi__mimos@4.1.4':
+    dependencies:
+      '@types/mime-db': 1.43.6
+
+  '@types/hapi__shot@6.0.0':
+    dependencies:
+      '@hapi/shot': 6.0.2
+
+  '@types/http-assert@1.5.6': {}
+
+  '@types/http-errors@2.0.5': {}
+
+  '@types/ioredis-mock@8.2.7(ioredis@5.10.1)':
+    dependencies:
+      ioredis: 5.10.1
+
+  '@types/ioredis@4.28.10':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/json5@0.0.29': {}
+
+  '@types/keygrip@1.0.6': {}
+
+  '@types/koa-compose@3.2.9':
+    dependencies:
+      '@types/koa': 2.14.0
+
+  '@types/koa@2.14.0':
+    dependencies:
+      '@types/accepts': 1.3.7
+      '@types/content-disposition': 0.5.9
+      '@types/cookies': 0.9.2
+      '@types/http-assert': 1.5.6
+      '@types/http-errors': 2.0.5
+      '@types/keygrip': 1.0.6
+      '@types/koa-compose': 3.2.9
+      '@types/node': 20.19.39
+
+  '@types/koa__router@12.0.3':
+    dependencies:
+      '@types/koa': 2.14.0
+
+  '@types/memcached@2.2.10':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/methods@1.1.4': {}
+
+  '@types/mime-db@1.43.6': {}
+
+  '@types/mime@1.3.5': {}
+
+  '@types/mysql@2.15.22':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/node@18.19.130':
+    dependencies:
+      undici-types: 5.26.5
+
+  '@types/node@20.19.39':
+    dependencies:
+      undici-types: 6.21.0
+
+  '@types/pg-pool@2.0.4':
+    dependencies:
+      '@types/pg': 8.20.0
+
+  '@types/pg@8.20.0':
+    dependencies:
+      '@types/node': 20.19.39
+      pg-protocol: 1.13.0
+      pg-types: 2.2.0
+
+  '@types/pg@8.6.1':
+    dependencies:
+      '@types/node': 20.19.39
+      pg-protocol: 1.13.0
+      pg-types: 2.2.0
+
+  '@types/qs@6.15.0': {}
+
+  '@types/range-parser@1.2.7': {}
+
+  '@types/send@0.17.6':
+    dependencies:
+      '@types/mime': 1.3.5
+      '@types/node': 20.19.39
+
+  '@types/send@1.2.1':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/serve-static@1.15.10':
+    dependencies:
+      '@types/http-errors': 2.0.5
+      '@types/node': 20.19.39
+      '@types/send': 0.17.6
+
+  '@types/shimmer@1.2.0': {}
+
+  '@types/ssh2-streams@0.1.13':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@types/ssh2@0.5.52':
+    dependencies:
+      '@types/node': 20.19.39
+      '@types/ssh2-streams': 0.1.13
+
+  '@types/ssh2@1.15.5':
+    dependencies:
+      '@types/node': 18.19.130
+
+  '@types/superagent@8.1.9':
+    dependencies:
+      '@types/cookiejar': 2.1.5
+      '@types/methods': 1.1.4
+      '@types/node': 20.19.39
+      form-data: 4.0.5
+
+  '@types/supertest@6.0.3':
+    dependencies:
+      '@types/methods': 1.1.4
+      '@types/superagent': 8.1.9
+
+  '@types/tedious@4.0.14':
+    dependencies:
+      '@types/node': 20.19.39
+
+  '@typescript-eslint/eslint-plugin@7.18.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint@8.57.1)(typescript@5.9.3)':
+    dependencies:
+      '@eslint-community/regexpp': 4.12.2
+      '@typescript-eslint/parser': 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+      '@typescript-eslint/scope-manager': 7.18.0
+      '@typescript-eslint/type-utils': 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+      '@typescript-eslint/utils': 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+      '@typescript-eslint/visitor-keys': 7.18.0
+      eslint: 8.57.1
+      graphemer: 1.4.0
+      ignore: 5.3.2
+      natural-compare: 1.4.0
+      ts-api-utils: 1.4.3(typescript@5.9.3)
+    optionalDependencies:
+      typescript: 5.9.3
+    transitivePeerDependencies:
+      - supports-color
+
+  '@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3)':
+    dependencies:
+      '@typescript-eslint/scope-manager': 7.18.0
+      '@typescript-eslint/types': 7.18.0
+      '@typescript-eslint/typescript-estree': 7.18.0(typescript@5.9.3)
+      '@typescript-eslint/visitor-keys': 7.18.0
+      debug: 4.4.3
+      eslint: 8.57.1
+    optionalDependencies:
+      typescript: 5.9.3
+    transitivePeerDependencies:
+      - supports-color
+
+  '@typescript-eslint/scope-manager@7.18.0':
+    dependencies:
+      '@typescript-eslint/types': 7.18.0
+      '@typescript-eslint/visitor-keys': 7.18.0
+
+  '@typescript-eslint/type-utils@7.18.0(eslint@8.57.1)(typescript@5.9.3)':
+    dependencies:
+      '@typescript-eslint/typescript-estree': 7.18.0(typescript@5.9.3)
+      '@typescript-eslint/utils': 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+      debug: 4.4.3
+      eslint: 8.57.1
+      ts-api-utils: 1.4.3(typescript@5.9.3)
+    optionalDependencies:
+      typescript: 5.9.3
+    transitivePeerDependencies:
+      - supports-color
+
+  '@typescript-eslint/types@7.18.0': {}
+
+  '@typescript-eslint/typescript-estree@7.18.0(typescript@5.9.3)':
+    dependencies:
+      '@typescript-eslint/types': 7.18.0
+      '@typescript-eslint/visitor-keys': 7.18.0
+      debug: 4.4.3
+      globby: 11.1.0
+      is-glob: 4.0.3
+      minimatch: 9.0.9
+      semver: 7.7.4
+      ts-api-utils: 1.4.3(typescript@5.9.3)
+    optionalDependencies:
+      typescript: 5.9.3
+    transitivePeerDependencies:
+      - supports-color
+
+  '@typescript-eslint/utils@7.18.0(eslint@8.57.1)(typescript@5.9.3)':
+    dependencies:
+      '@eslint-community/eslint-utils': 4.9.1(eslint@8.57.1)
+      '@typescript-eslint/scope-manager': 7.18.0
+      '@typescript-eslint/types': 7.18.0
+      '@typescript-eslint/typescript-estree': 7.18.0(typescript@5.9.3)
+      eslint: 8.57.1
+    transitivePeerDependencies:
+      - supports-color
+      - typescript
+
+  '@typescript-eslint/visitor-keys@7.18.0':
+    dependencies:
+      '@typescript-eslint/types': 7.18.0
+      eslint-visitor-keys: 3.4.3
+
+  '@ungap/structured-clone@1.3.0': {}
+
+  '@unrs/resolver-binding-android-arm-eabi@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-android-arm64@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-darwin-arm64@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-darwin-x64@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-freebsd-x64@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-arm-gnueabihf@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-arm-musleabihf@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-arm64-gnu@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-arm64-musl@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-ppc64-gnu@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-riscv64-gnu@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-riscv64-musl@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-s390x-gnu@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-x64-gnu@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-linux-x64-musl@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-wasm32-wasi@1.11.1':
+    dependencies:
+      '@napi-rs/wasm-runtime': 0.2.12
+    optional: true
+
+  '@unrs/resolver-binding-win32-arm64-msvc@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-win32-ia32-msvc@1.11.1':
+    optional: true
+
+  '@unrs/resolver-binding-win32-x64-msvc@1.11.1':
+    optional: true
+
+  '@vitest/coverage-v8@1.6.1(vitest@1.6.1(@types/node@20.19.39))':
+    dependencies:
+      '@ampproject/remapping': 2.3.0
+      '@bcoe/v8-coverage': 0.2.3
+      debug: 4.4.3
+      istanbul-lib-coverage: 3.2.2
+      istanbul-lib-report: 3.0.1
+      istanbul-lib-source-maps: 5.0.6
+      istanbul-reports: 3.2.0
+      magic-string: 0.30.21
+      magicast: 0.3.5
+      picocolors: 1.1.1
+      std-env: 3.10.0
+      strip-literal: 2.1.1
+      test-exclude: 6.0.0
+      vitest: 1.6.1(@types/node@20.19.39)
+    transitivePeerDependencies:
+      - supports-color
+
+  '@vitest/expect@1.6.1':
+    dependencies:
+      '@vitest/spy': 1.6.1
+      '@vitest/utils': 1.6.1
+      chai: 4.5.0
+
+  '@vitest/runner@1.6.1':
+    dependencies:
+      '@vitest/utils': 1.6.1
+      p-limit: 5.0.0
+      pathe: 1.1.2
+
+  '@vitest/snapshot@1.6.1':
+    dependencies:
+      magic-string: 0.30.21
+      pathe: 1.1.2
+      pretty-format: 29.7.0
+
+  '@vitest/spy@1.6.1':
+    dependencies:
+      tinyspy: 2.2.1
+
+  '@vitest/utils@1.6.1':
+    dependencies:
+      diff-sequences: 29.6.3
+      estree-walker: 3.0.3
+      loupe: 2.3.7
+      pretty-format: 29.7.0
+
+  abort-controller@3.0.0:
+    dependencies:
+      event-target-shim: 5.0.1
+
+  accepts@1.3.8:
+    dependencies:
+      mime-types: 2.1.35
+      negotiator: 0.6.3
+
+  acorn-import-assertions@1.9.0(acorn@8.16.0):
+    dependencies:
+      acorn: 8.16.0
+
+  acorn-import-attributes@1.9.5(acorn@8.16.0):
+    dependencies:
+      acorn: 8.16.0
+
+  acorn-jsx@5.3.2(acorn@8.16.0):
+    dependencies:
+      acorn: 8.16.0
+
+  acorn-walk@8.3.5:
+    dependencies:
+      acorn: 8.16.0
+
+  acorn@8.16.0: {}
+
+  agent-base@7.1.4: {}
+
+  ajv@6.14.0:
+    dependencies:
+      fast-deep-equal: 3.1.3
+      fast-json-stable-stringify: 2.1.0
+      json-schema-traverse: 0.4.1
+      uri-js: 4.4.1
+
+  ansi-regex@5.0.1: {}
+
+  ansi-regex@6.2.2: {}
+
+  ansi-styles@4.3.0:
+    dependencies:
+      color-convert: 2.0.1
+
+  ansi-styles@5.2.0: {}
+
+  ansi-styles@6.2.3: {}
+
+  append-field@1.0.0: {}
+
+  archiver-utils@5.0.2:
+    dependencies:
+      glob: 10.5.0
+      graceful-fs: 4.2.11
+      is-stream: 2.0.1
+      lazystream: 1.0.1
+      lodash: 4.18.1
+      normalize-path: 3.0.0
+      readable-stream: 4.7.0
+
+  archiver@7.0.1:
+    dependencies:
+      archiver-utils: 5.0.2
+      async: 3.2.6
+      buffer-crc32: 1.0.0
+      readable-stream: 4.7.0
+      readdir-glob: 1.1.3
+      tar-stream: 3.1.8
+      zip-stream: 6.0.1
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - bare-buffer
+      - react-native-b4a
+
+  argparse@2.0.1: {}
+
+  array-buffer-byte-length@1.0.2:
+    dependencies:
+      call-bound: 1.0.4
+      is-array-buffer: 3.0.5
+
+  array-flatten@1.1.1: {}
+
+  array-includes@3.1.9:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-object-atoms: 1.1.1
+      get-intrinsic: 1.3.0
+      is-string: 1.1.1
+      math-intrinsics: 1.1.0
+
+  array-union@2.1.0: {}
+
+  array.prototype.findlastindex@1.2.6:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-errors: 1.3.0
+      es-object-atoms: 1.1.1
+      es-shim-unscopables: 1.1.0
+
+  array.prototype.flat@1.3.3:
+    dependencies:
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-shim-unscopables: 1.1.0
+
+  array.prototype.flatmap@1.3.3:
+    dependencies:
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-shim-unscopables: 1.1.0
+
+  arraybuffer.prototype.slice@1.0.4:
+    dependencies:
+      array-buffer-byte-length: 1.0.2
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+      is-array-buffer: 3.0.5
+
+  asap@2.0.6: {}
+
+  asn1@0.2.6:
+    dependencies:
+      safer-buffer: 2.1.2
+
+  assertion-error@1.1.0: {}
+
+  async-function@1.0.0: {}
+
+  async-lock@1.4.1: {}
+
+  async@3.2.6: {}
+
+  asynckit@0.4.0: {}
+
+  atomic-sleep@1.0.0: {}
+
+  available-typed-arrays@1.0.7:
+    dependencies:
+      possible-typed-array-names: 1.1.0
+
+  b4a@1.8.0: {}
+
+  balanced-match@1.0.2: {}
+
+  bare-events@2.8.2: {}
+
+  bare-fs@4.7.1:
+    dependencies:
+      bare-events: 2.8.2
+      bare-path: 3.0.0
+      bare-stream: 2.13.0(bare-events@2.8.2)
+      bare-url: 2.4.1
+      fast-fifo: 1.3.2
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - react-native-b4a
+
+  bare-os@3.8.7: {}
+
+  bare-path@3.0.0:
+    dependencies:
+      bare-os: 3.8.7
+
+  bare-stream@2.13.0(bare-events@2.8.2):
+    dependencies:
+      streamx: 2.25.0
+      teex: 1.0.1
+    optionalDependencies:
+      bare-events: 2.8.2
+    transitivePeerDependencies:
+      - react-native-b4a
+
+  bare-url@2.4.1:
+    dependencies:
+      bare-path: 3.0.0
+
+  base64-js@1.5.1: {}
+
+  bcrypt-pbkdf@1.0.2:
+    dependencies:
+      tweetnacl: 0.14.5
+
+  bignumber.js@9.3.1: {}
+
+  bl@4.1.0:
+    dependencies:
+      buffer: 5.7.1
+      inherits: 2.0.4
+      readable-stream: 3.6.2
+
+  body-parser@1.20.4:
+    dependencies:
+      bytes: 3.1.2
+      content-type: 1.0.5
+      debug: 2.6.9
+      depd: 2.0.0
+      destroy: 1.2.0
+      http-errors: 2.0.1
+      iconv-lite: 0.4.24
+      on-finished: 2.4.1
+      qs: 6.14.2
+      raw-body: 2.5.3
+      type-is: 1.6.18
+      unpipe: 1.0.0
+    transitivePeerDependencies:
+      - supports-color
+
+  brace-expansion@1.1.14:
+    dependencies:
+      balanced-match: 1.0.2
+      concat-map: 0.0.1
+
+  brace-expansion@2.1.0:
+    dependencies:
+      balanced-match: 1.0.2
+
+  braces@3.0.3:
+    dependencies:
+      fill-range: 7.1.1
+
+  buffer-crc32@1.0.0: {}
+
+  buffer-from@1.1.2: {}
+
+  buffer@5.7.1:
+    dependencies:
+      base64-js: 1.5.1
+      ieee754: 1.2.1
+
+  buffer@6.0.3:
+    dependencies:
+      base64-js: 1.5.1
+      ieee754: 1.2.1
+
+  buildcheck@0.0.7:
+    optional: true
+
+  bullmq@5.74.1:
+    dependencies:
+      cron-parser: 4.9.0
+      ioredis: 5.10.1
+      msgpackr: 1.11.5
+      node-abort-controller: 3.1.1
+      semver: 7.7.4
+      tslib: 2.8.1
+      uuid: 11.1.0
+    transitivePeerDependencies:
+      - supports-color
+
+  busboy@1.6.0:
+    dependencies:
+      streamsearch: 1.1.0
+
+  byline@5.0.0: {}
+
+  bytes@3.1.2: {}
+
+  cac@6.7.14: {}
+
+  call-bind-apply-helpers@1.0.2:
+    dependencies:
+      es-errors: 1.3.0
+      function-bind: 1.1.2
+
+  call-bind@1.0.9:
+    dependencies:
+      call-bind-apply-helpers: 1.0.2
+      es-define-property: 1.0.1
+      get-intrinsic: 1.3.0
+      set-function-length: 1.2.2
+
+  call-bound@1.0.4:
+    dependencies:
+      call-bind-apply-helpers: 1.0.2
+      get-intrinsic: 1.3.0
+
+  callsites@3.1.0: {}
+
+  chai@4.5.0:
+    dependencies:
+      assertion-error: 1.1.0
+      check-error: 1.0.3
+      deep-eql: 4.1.4
+      get-func-name: 2.0.2
+      loupe: 2.3.7
+      pathval: 1.1.1
+      type-detect: 4.1.0
+
+  chalk@4.1.2:
+    dependencies:
+      ansi-styles: 4.3.0
+      supports-color: 7.2.0
+
+  check-error@1.0.3:
+    dependencies:
+      get-func-name: 2.0.2
+
+  chownr@1.1.4: {}
+
+  cjs-module-lexer@1.4.3: {}
+
+  cli-color@2.0.4:
+    dependencies:
+      d: 1.0.2
+      es5-ext: 0.10.64
+      es6-iterator: 2.0.3
+      memoizee: 0.4.17
+      timers-ext: 0.1.8
+
+  cliui@8.0.1:
+    dependencies:
+      string-width: 4.2.3
+      strip-ansi: 6.0.1
+      wrap-ansi: 7.0.0
+
+  cluster-key-slot@1.1.2: {}
+
+  color-convert@2.0.1:
+    dependencies:
+      color-name: 1.1.4
+
+  color-name@1.1.4: {}
+
+  combined-stream@1.0.8:
+    dependencies:
+      delayed-stream: 1.0.0
+
+  commander@9.5.0: {}
+
+  component-emitter@1.3.1: {}
+
+  compress-commons@6.0.2:
+    dependencies:
+      crc-32: 1.2.2
+      crc32-stream: 6.0.0
+      is-stream: 2.0.1
+      normalize-path: 3.0.0
+      readable-stream: 4.7.0
+
+  concat-map@0.0.1: {}
+
+  concat-stream@2.0.0:
+    dependencies:
+      buffer-from: 1.1.2
+      inherits: 2.0.4
+      readable-stream: 3.6.2
+      typedarray: 0.0.6
+
+  confbox@0.1.8: {}
+
+  consola@2.15.3: {}
+
+  content-disposition@0.5.4:
+    dependencies:
+      safe-buffer: 5.2.1
+
+  content-type@1.0.5: {}
+
+  cookie-signature@1.0.7: {}
+
+  cookie-signature@1.2.2: {}
+
+  cookie@0.7.2: {}
+
+  cookiejar@2.1.4: {}
+
+  core-util-is@1.0.3: {}
+
+  cors@2.8.5:
+    dependencies:
+      object-assign: 4.1.1
+      vary: 1.1.2
+
+  cpu-features@0.0.10:
+    dependencies:
+      buildcheck: 0.0.7
+      nan: 2.26.2
+    optional: true
+
+  crc-32@1.2.2: {}
+
+  crc32-stream@6.0.0:
+    dependencies:
+      crc-32: 1.2.2
+      readable-stream: 4.7.0
+
+  cron-parser@4.9.0:
+    dependencies:
+      luxon: 3.7.2
+
+  cross-spawn@7.0.6:
+    dependencies:
+      path-key: 3.1.1
+      shebang-command: 2.0.0
+      which: 2.0.2
+
+  d@1.0.2:
+    dependencies:
+      es5-ext: 0.10.64
+      type: 2.7.3
+
+  data-view-buffer@1.0.2:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      is-data-view: 1.0.2
+
+  data-view-byte-length@1.0.2:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      is-data-view: 1.0.2
+
+  data-view-byte-offset@1.0.1:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      is-data-view: 1.0.2
+
+  debug@2.6.9:
+    dependencies:
+      ms: 2.0.0
+
+  debug@3.2.7:
+    dependencies:
+      ms: 2.1.3
+
+  debug@4.4.3:
+    dependencies:
+      ms: 2.1.3
+
+  deep-eql@4.1.4:
+    dependencies:
+      type-detect: 4.1.0
+
+  deep-is@0.1.4: {}
+
+  define-data-property@1.1.4:
+    dependencies:
+      es-define-property: 1.0.1
+      es-errors: 1.3.0
+      gopd: 1.2.0
+
+  define-properties@1.2.1:
+    dependencies:
+      define-data-property: 1.1.4
+      has-property-descriptors: 1.0.2
+      object-keys: 1.1.1
+
+  delayed-stream@1.0.0: {}
+
+  denque@2.1.0: {}
+
+  depd@2.0.0: {}
+
+  destroy@1.2.0: {}
+
+  detect-libc@2.1.2:
+    optional: true
+
+  dezalgo@1.0.4:
+    dependencies:
+      asap: 2.0.6
+      wrappy: 1.0.2
+
+  diff-sequences@29.6.3: {}
+
+  difflib@0.2.4:
+    dependencies:
+      heap: 0.2.7
+
+  dir-glob@3.0.1:
+    dependencies:
+      path-type: 4.0.0
+
+  docker-compose@0.24.8:
+    dependencies:
+      yaml: 2.8.3
+
+  docker-modem@5.0.7:
+    dependencies:
+      debug: 4.4.3
+      readable-stream: 3.6.2
+      split-ca: 1.0.1
+      ssh2: 1.17.0
+    transitivePeerDependencies:
+      - supports-color
+
+  dockerode@4.0.10:
+    dependencies:
+      '@balena/dockerignore': 1.0.2
+      '@grpc/grpc-js': 1.14.3
+      '@grpc/proto-loader': 0.7.15
+      docker-modem: 5.0.7
+      protobufjs: 7.5.5
+      tar-fs: 2.1.4
+      uuid: 10.0.0
+    transitivePeerDependencies:
+      - supports-color
+
+  doctrine@2.1.0:
+    dependencies:
+      esutils: 2.0.3
+
+  doctrine@3.0.0:
+    dependencies:
+      esutils: 2.0.3
+
+  dreamopt@0.8.0:
+    dependencies:
+      wordwrap: 1.0.0
+
+  drizzle-kit@0.21.4:
+    dependencies:
+      '@esbuild-kit/esm-loader': 2.6.5
+      commander: 9.5.0
+      env-paths: 3.0.0
+      esbuild: 0.19.12
+      esbuild-register: 3.6.0(esbuild@0.19.12)
+      glob: 8.1.0
+      hanji: 0.0.5
+      json-diff: 0.9.0
+      zod: 3.25.76
+    transitivePeerDependencies:
+      - supports-color
+
+  drizzle-orm@0.30.10(@opentelemetry/api@1.9.1)(@types/pg@8.20.0)(pg@8.20.0):
+    optionalDependencies:
+      '@opentelemetry/api': 1.9.1
+      '@types/pg': 8.20.0
+      pg: 8.20.0
+
+  dunder-proto@1.0.1:
+    dependencies:
+      call-bind-apply-helpers: 1.0.2
+      es-errors: 1.3.0
+      gopd: 1.2.0
+
+  eastasianwidth@0.2.0: {}
+
+  ee-first@1.1.1: {}
+
+  emoji-regex@8.0.0: {}
+
+  emoji-regex@9.2.2: {}
+
+  encodeurl@2.0.0: {}
+
+  end-of-stream@1.4.5:
+    dependencies:
+      once: 1.4.0
+
+  env-paths@3.0.0: {}
+
+  es-abstract@1.24.2:
+    dependencies:
+      array-buffer-byte-length: 1.0.2
+      arraybuffer.prototype.slice: 1.0.4
+      available-typed-arrays: 1.0.7
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      data-view-buffer: 1.0.2
+      data-view-byte-length: 1.0.2
+      data-view-byte-offset: 1.0.1
+      es-define-property: 1.0.1
+      es-errors: 1.3.0
+      es-object-atoms: 1.1.1
+      es-set-tostringtag: 2.1.0
+      es-to-primitive: 1.3.0
+      function.prototype.name: 1.1.8
+      get-intrinsic: 1.3.0
+      get-proto: 1.0.1
+      get-symbol-description: 1.1.0
+      globalthis: 1.0.4
+      gopd: 1.2.0
+      has-property-descriptors: 1.0.2
+      has-proto: 1.2.0
+      has-symbols: 1.1.0
+      hasown: 2.0.3
+      internal-slot: 1.1.0
+      is-array-buffer: 3.0.5
+      is-callable: 1.2.7
+      is-data-view: 1.0.2
+      is-negative-zero: 2.0.3
+      is-regex: 1.2.1
+      is-set: 2.0.3
+      is-shared-array-buffer: 1.0.4
+      is-string: 1.1.1
+      is-typed-array: 1.1.15
+      is-weakref: 1.1.1
+      math-intrinsics: 1.1.0
+      object-inspect: 1.13.4
+      object-keys: 1.1.1
+      object.assign: 4.1.7
+      own-keys: 1.0.1
+      regexp.prototype.flags: 1.5.4
+      safe-array-concat: 1.1.3
+      safe-push-apply: 1.0.0
+      safe-regex-test: 1.1.0
+      set-proto: 1.0.0
+      stop-iteration-iterator: 1.1.0
+      string.prototype.trim: 1.2.10
+      string.prototype.trimend: 1.0.9
+      string.prototype.trimstart: 1.0.8
+      typed-array-buffer: 1.0.3
+      typed-array-byte-length: 1.0.3
+      typed-array-byte-offset: 1.0.4
+      typed-array-length: 1.0.7
+      unbox-primitive: 1.1.0
+      which-typed-array: 1.1.20
+
+  es-define-property@1.0.1: {}
+
+  es-errors@1.3.0: {}
+
+  es-object-atoms@1.1.1:
+    dependencies:
+      es-errors: 1.3.0
+
+  es-set-tostringtag@2.1.0:
+    dependencies:
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+      has-tostringtag: 1.0.2
+      hasown: 2.0.3
+
+  es-shim-unscopables@1.1.0:
+    dependencies:
+      hasown: 2.0.3
+
+  es-to-primitive@1.3.0:
+    dependencies:
+      is-callable: 1.2.7
+      is-date-object: 1.1.0
+      is-symbol: 1.1.1
+
+  es5-ext@0.10.64:
+    dependencies:
+      es6-iterator: 2.0.3
+      es6-symbol: 3.1.4
+      esniff: 2.0.1
+      next-tick: 1.1.0
+
+  es6-iterator@2.0.3:
+    dependencies:
+      d: 1.0.2
+      es5-ext: 0.10.64
+      es6-symbol: 3.1.4
+
+  es6-symbol@3.1.4:
+    dependencies:
+      d: 1.0.2
+      ext: 1.7.0
+
+  es6-weak-map@2.0.3:
+    dependencies:
+      d: 1.0.2
+      es5-ext: 0.10.64
+      es6-iterator: 2.0.3
+      es6-symbol: 3.1.4
+
+  esbuild-register@3.6.0(esbuild@0.19.12):
+    dependencies:
+      debug: 4.4.3
+      esbuild: 0.19.12
+    transitivePeerDependencies:
+      - supports-color
+
+  esbuild@0.18.20:
+    optionalDependencies:
+      '@esbuild/android-arm': 0.18.20
+      '@esbuild/android-arm64': 0.18.20
+      '@esbuild/android-x64': 0.18.20
+      '@esbuild/darwin-arm64': 0.18.20
+      '@esbuild/darwin-x64': 0.18.20
+      '@esbuild/freebsd-arm64': 0.18.20
+      '@esbuild/freebsd-x64': 0.18.20
+      '@esbuild/linux-arm': 0.18.20
+      '@esbuild/linux-arm64': 0.18.20
+      '@esbuild/linux-ia32': 0.18.20
+      '@esbuild/linux-loong64': 0.18.20
+      '@esbuild/linux-mips64el': 0.18.20
+      '@esbuild/linux-ppc64': 0.18.20
+      '@esbuild/linux-riscv64': 0.18.20
+      '@esbuild/linux-s390x': 0.18.20
+      '@esbuild/linux-x64': 0.18.20
+      '@esbuild/netbsd-x64': 0.18.20
+      '@esbuild/openbsd-x64': 0.18.20
+      '@esbuild/sunos-x64': 0.18.20
+      '@esbuild/win32-arm64': 0.18.20
+      '@esbuild/win32-ia32': 0.18.20
+      '@esbuild/win32-x64': 0.18.20
+
+  esbuild@0.19.12:
+    optionalDependencies:
+      '@esbuild/aix-ppc64': 0.19.12
+      '@esbuild/android-arm': 0.19.12
+      '@esbuild/android-arm64': 0.19.12
+      '@esbuild/android-x64': 0.19.12
+      '@esbuild/darwin-arm64': 0.19.12
+      '@esbuild/darwin-x64': 0.19.12
+      '@esbuild/freebsd-arm64': 0.19.12
+      '@esbuild/freebsd-x64': 0.19.12
+      '@esbuild/linux-arm': 0.19.12
+      '@esbuild/linux-arm64': 0.19.12
+      '@esbuild/linux-ia32': 0.19.12
+      '@esbuild/linux-loong64': 0.19.12
+      '@esbuild/linux-mips64el': 0.19.12
+      '@esbuild/linux-ppc64': 0.19.12
+      '@esbuild/linux-riscv64': 0.19.12
+      '@esbuild/linux-s390x': 0.19.12
+      '@esbuild/linux-x64': 0.19.12
+      '@esbuild/netbsd-x64': 0.19.12
+      '@esbuild/openbsd-x64': 0.19.12
+      '@esbuild/sunos-x64': 0.19.12
+      '@esbuild/win32-arm64': 0.19.12
+      '@esbuild/win32-ia32': 0.19.12
+      '@esbuild/win32-x64': 0.19.12
+
+  esbuild@0.21.5:
+    optionalDependencies:
+      '@esbuild/aix-ppc64': 0.21.5
+      '@esbuild/android-arm': 0.21.5
+      '@esbuild/android-arm64': 0.21.5
+      '@esbuild/android-x64': 0.21.5
+      '@esbuild/darwin-arm64': 0.21.5
+      '@esbuild/darwin-x64': 0.21.5
+      '@esbuild/freebsd-arm64': 0.21.5
+      '@esbuild/freebsd-x64': 0.21.5
+      '@esbuild/linux-arm': 0.21.5
+      '@esbuild/linux-arm64': 0.21.5
+      '@esbuild/linux-ia32': 0.21.5
+      '@esbuild/linux-loong64': 0.21.5
+      '@esbuild/linux-mips64el': 0.21.5
+      '@esbuild/linux-ppc64': 0.21.5
+      '@esbuild/linux-riscv64': 0.21.5
+      '@esbuild/linux-s390x': 0.21.5
+      '@esbuild/linux-x64': 0.21.5
+      '@esbuild/netbsd-x64': 0.21.5
+      '@esbuild/openbsd-x64': 0.21.5
+      '@esbuild/sunos-x64': 0.21.5
+      '@esbuild/win32-arm64': 0.21.5
+      '@esbuild/win32-ia32': 0.21.5
+      '@esbuild/win32-x64': 0.21.5
+
+  esbuild@0.27.7:
+    optionalDependencies:
+      '@esbuild/aix-ppc64': 0.27.7
+      '@esbuild/android-arm': 0.27.7
+      '@esbuild/android-arm64': 0.27.7
+      '@esbuild/android-x64': 0.27.7
+      '@esbuild/darwin-arm64': 0.27.7
+      '@esbuild/darwin-x64': 0.27.7
+      '@esbuild/freebsd-arm64': 0.27.7
+      '@esbuild/freebsd-x64': 0.27.7
+      '@esbuild/linux-arm': 0.27.7
+      '@esbuild/linux-arm64': 0.27.7
+      '@esbuild/linux-ia32': 0.27.7
+      '@esbuild/linux-loong64': 0.27.7
+      '@esbuild/linux-mips64el': 0.27.7
+      '@esbuild/linux-ppc64': 0.27.7
+      '@esbuild/linux-riscv64': 0.27.7
+      '@esbuild/linux-s390x': 0.27.7
+      '@esbuild/linux-x64': 0.27.7
+      '@esbuild/netbsd-arm64': 0.27.7
+      '@esbuild/netbsd-x64': 0.27.7
+      '@esbuild/openbsd-arm64': 0.27.7
+      '@esbuild/openbsd-x64': 0.27.7
+      '@esbuild/openharmony-arm64': 0.27.7
+      '@esbuild/sunos-x64': 0.27.7
+      '@esbuild/win32-arm64': 0.27.7
+      '@esbuild/win32-ia32': 0.27.7
+      '@esbuild/win32-x64': 0.27.7
+
+  escalade@3.2.0: {}
+
+  escape-html@1.0.3: {}
+
+  escape-string-regexp@4.0.0: {}
+
+  eslint-import-resolver-node@0.3.10:
+    dependencies:
+      debug: 3.2.7
+      is-core-module: 2.16.1
+      resolve: 2.0.0-next.6
+    transitivePeerDependencies:
+      - supports-color
+
+  eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1):
+    dependencies:
+      '@nolyfill/is-core-module': 1.0.39
+      debug: 4.4.3
+      eslint: 8.57.1
+      get-tsconfig: 4.14.0
+      is-bun-module: 2.0.0
+      stable-hash: 0.0.5
+      tinyglobby: 0.2.16
+      unrs-resolver: 1.11.1
+    optionalDependencies:
+      eslint-plugin-import: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  eslint-module-utils@2.12.1(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1):
+    dependencies:
+      debug: 3.2.7
+    optionalDependencies:
+      '@typescript-eslint/parser': 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+      eslint: 8.57.1
+      eslint-import-resolver-node: 0.3.10
+      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1)
+    transitivePeerDependencies:
+      - supports-color
+
+  eslint-plugin-import@2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1):
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
+      eslint-module-utils: 2.12.1(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10)(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1)
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
+      '@typescript-eslint/parser': 7.18.0(eslint@8.57.1)(typescript@5.9.3)
+    transitivePeerDependencies:
+      - eslint-import-resolver-typescript
+      - eslint-import-resolver-webpack
+      - supports-color
+
+  eslint-scope@7.2.2:
+    dependencies:
+      esrecurse: 4.3.0
+      estraverse: 5.3.0
+
+  eslint-visitor-keys@3.4.3: {}
+
+  eslint@8.57.1:
+    dependencies:
+      '@eslint-community/eslint-utils': 4.9.1(eslint@8.57.1)
+      '@eslint-community/regexpp': 4.12.2
+      '@eslint/eslintrc': 2.1.4
+      '@eslint/js': 8.57.1
+      '@humanwhocodes/config-array': 0.13.0
+      '@humanwhocodes/module-importer': 1.0.1
+      '@nodelib/fs.walk': 1.2.8
+      '@ungap/structured-clone': 1.3.0
+      ajv: 6.14.0
+      chalk: 4.1.2
+      cross-spawn: 7.0.6
+      debug: 4.4.3
+      doctrine: 3.0.0
+      escape-string-regexp: 4.0.0
+      eslint-scope: 7.2.2
+      eslint-visitor-keys: 3.4.3
+      espree: 9.6.1
+      esquery: 1.7.0
+      esutils: 2.0.3
+      fast-deep-equal: 3.1.3
+      file-entry-cache: 6.0.1
+      find-up: 5.0.0
+      glob-parent: 6.0.2
+      globals: 13.24.0
+      graphemer: 1.4.0
+      ignore: 5.3.2
+      imurmurhash: 0.1.4
+      is-glob: 4.0.3
+      is-path-inside: 3.0.3
+      js-yaml: 4.1.1
+      json-stable-stringify-without-jsonify: 1.0.1
+      levn: 0.4.1
+      lodash.merge: 4.6.2
+      minimatch: 3.1.5
+      natural-compare: 1.4.0
+      optionator: 0.9.4
+      strip-ansi: 6.0.1
+      text-table: 0.2.0
+    transitivePeerDependencies:
+      - supports-color
+
+  esniff@2.0.1:
+    dependencies:
+      d: 1.0.2
+      es5-ext: 0.10.64
+      event-emitter: 0.3.5
+      type: 2.7.3
+
+  espree@9.6.1:
+    dependencies:
+      acorn: 8.16.0
+      acorn-jsx: 5.3.2(acorn@8.16.0)
+      eslint-visitor-keys: 3.4.3
+
+  esquery@1.7.0:
+    dependencies:
+      estraverse: 5.3.0
+
+  esrecurse@4.3.0:
+    dependencies:
+      estraverse: 5.3.0
+
+  estraverse@5.3.0: {}
+
+  estree-walker@3.0.3:
+    dependencies:
+      '@types/estree': 1.0.8
+
+  esutils@2.0.3: {}
+
+  etag@1.8.1: {}
+
+  event-emitter@0.3.5:
+    dependencies:
+      d: 1.0.2
+      es5-ext: 0.10.64
+
+  event-target-shim@5.0.1: {}
+
+  events-universal@1.0.1:
+    dependencies:
+      bare-events: 2.8.2
+    transitivePeerDependencies:
+      - bare-abort-controller
+
+  events@3.3.0: {}
+
+  execa@8.0.1:
+    dependencies:
+      cross-spawn: 7.0.6
+      get-stream: 8.0.1
+      human-signals: 5.0.0
+      is-stream: 3.0.0
+      merge-stream: 2.0.0
+      npm-run-path: 5.3.0
+      onetime: 6.0.0
+      signal-exit: 4.1.0
+      strip-final-newline: 3.0.0
+
+  express@4.22.1:
+    dependencies:
+      accepts: 1.3.8
+      array-flatten: 1.1.1
+      body-parser: 1.20.4
+      content-disposition: 0.5.4
+      content-type: 1.0.5
+      cookie: 0.7.2
+      cookie-signature: 1.0.7
+      debug: 2.6.9
+      depd: 2.0.0
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      etag: 1.8.1
+      finalhandler: 1.3.2
+      fresh: 0.5.2
+      http-errors: 2.0.1
+      merge-descriptors: 1.0.3
+      methods: 1.1.2
+      on-finished: 2.4.1
+      parseurl: 1.3.3
+      path-to-regexp: 0.1.13
+      proxy-addr: 2.0.7
+      qs: 6.14.2
+      range-parser: 1.2.1
+      safe-buffer: 5.2.1
+      send: 0.19.2
+      serve-static: 1.16.3
+      setprototypeof: 1.2.0
+      statuses: 2.0.2
+      type-is: 1.6.18
+      utils-merge: 1.0.1
+      vary: 1.1.2
+    transitivePeerDependencies:
+      - supports-color
+
+  ext@1.7.0:
+    dependencies:
+      type: 2.7.3
+
+  extend@3.0.2: {}
+
+  fast-deep-equal@3.1.3: {}
+
+  fast-fifo@1.3.2: {}
+
+  fast-glob@3.3.3:
+    dependencies:
+      '@nodelib/fs.stat': 2.0.5
+      '@nodelib/fs.walk': 1.2.8
+      glob-parent: 5.1.2
+      merge2: 1.4.1
+      micromatch: 4.0.8
+
+  fast-json-stable-stringify@2.1.0: {}
+
+  fast-levenshtein@2.0.6: {}
+
+  fast-redact@3.5.0: {}
+
+  fast-safe-stringify@2.1.1: {}
+
+  fastq@1.20.1:
+    dependencies:
+      reusify: 1.1.0
+
+  fdir@6.5.0(picomatch@4.0.4):
+    optionalDependencies:
+      picomatch: 4.0.4
+
+  fengari-interop@0.1.4(fengari@0.1.5):
+    dependencies:
+      fengari: 0.1.5
+
+  fengari@0.1.5:
+    dependencies:
+      readline-sync: 1.4.10
+      sprintf-js: 1.1.3
+      tmp: 0.2.5
+
+  fflate@0.8.2: {}
+
+  file-entry-cache@6.0.1:
+    dependencies:
+      flat-cache: 3.2.0
+
+  file-type@20.4.1:
+    dependencies:
+      '@tokenizer/inflate': 0.2.7
+      strtok3: 10.3.5
+      token-types: 6.1.2
+      uint8array-extras: 1.5.0
+    transitivePeerDependencies:
+      - supports-color
+
+  fill-range@7.1.1:
+    dependencies:
+      to-regex-range: 5.0.1
+
+  finalhandler@1.3.2:
+    dependencies:
+      debug: 2.6.9
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      on-finished: 2.4.1
+      parseurl: 1.3.3
+      statuses: 2.0.2
+      unpipe: 1.0.0
+    transitivePeerDependencies:
+      - supports-color
+
+  find-up@5.0.0:
+    dependencies:
+      locate-path: 6.0.0
+      path-exists: 4.0.0
+
+  flat-cache@3.2.0:
+    dependencies:
+      flatted: 3.4.2
+      keyv: 4.5.4
+      rimraf: 3.0.2
+
+  flatted@3.4.2: {}
+
+  for-each@0.3.5:
+    dependencies:
+      is-callable: 1.2.7
+
+  foreground-child@3.3.1:
+    dependencies:
+      cross-spawn: 7.0.6
+      signal-exit: 4.1.0
+
+  form-data@4.0.5:
+    dependencies:
+      asynckit: 0.4.0
+      combined-stream: 1.0.8
+      es-set-tostringtag: 2.1.0
+      hasown: 2.0.3
+      mime-types: 2.1.35
+
+  formidable@3.5.4:
+    dependencies:
+      '@paralleldrive/cuid2': 2.3.1
+      dezalgo: 1.0.4
+      once: 1.4.0
+
+  forwarded@0.2.0: {}
+
+  fresh@0.5.2: {}
+
+  fs-constants@1.0.0: {}
+
+  fs.realpath@1.0.0: {}
+
+  fsevents@2.3.3:
+    optional: true
+
+  function-bind@1.1.2: {}
+
+  function.prototype.name@1.1.8:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-properties: 1.2.1
+      functions-have-names: 1.2.3
+      hasown: 2.0.3
+      is-callable: 1.2.7
+
+  functions-have-names@1.2.3: {}
+
+  gaxios@6.7.1:
+    dependencies:
+      extend: 3.0.2
+      https-proxy-agent: 7.0.6
+      is-stream: 2.0.1
+      node-fetch: 2.7.0
+      uuid: 9.0.1
+    transitivePeerDependencies:
+      - encoding
+      - supports-color
+
+  gcp-metadata@6.1.1:
+    dependencies:
+      gaxios: 6.7.1
+      google-logging-utils: 0.0.2
+      json-bigint: 1.0.0
+    transitivePeerDependencies:
+      - encoding
+      - supports-color
+
+  generator-function@2.0.1: {}
+
+  get-caller-file@2.0.5: {}
+
+  get-func-name@2.0.2: {}
+
+  get-intrinsic@1.3.0:
+    dependencies:
+      call-bind-apply-helpers: 1.0.2
+      es-define-property: 1.0.1
+      es-errors: 1.3.0
+      es-object-atoms: 1.1.1
+      function-bind: 1.1.2
+      get-proto: 1.0.1
+      gopd: 1.2.0
+      has-symbols: 1.1.0
+      hasown: 2.0.3
+      math-intrinsics: 1.1.0
+
+  get-port@7.2.0: {}
+
+  get-proto@1.0.1:
+    dependencies:
+      dunder-proto: 1.0.1
+      es-object-atoms: 1.1.1
+
+  get-stream@8.0.1: {}
+
+  get-symbol-description@1.1.0:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+
+  get-tsconfig@4.14.0:
+    dependencies:
+      resolve-pkg-maps: 1.0.0
+
+  glob-parent@5.1.2:
+    dependencies:
+      is-glob: 4.0.3
+
+  glob-parent@6.0.2:
+    dependencies:
+      is-glob: 4.0.3
+
+  glob@10.5.0:
+    dependencies:
+      foreground-child: 3.3.1
+      jackspeak: 3.4.3
+      minimatch: 9.0.9
+      minipass: 7.1.3
+      package-json-from-dist: 1.0.1
+      path-scurry: 1.11.1
+
+  glob@7.2.3:
+    dependencies:
+      fs.realpath: 1.0.0
+      inflight: 1.0.6
+      inherits: 2.0.4
+      minimatch: 3.1.5
+      once: 1.4.0
+      path-is-absolute: 1.0.1
+
+  glob@8.1.0:
+    dependencies:
+      fs.realpath: 1.0.0
+      inflight: 1.0.6
+      inherits: 2.0.4
+      minimatch: 5.1.9
+      once: 1.4.0
+
+  globals@13.24.0:
+    dependencies:
+      type-fest: 0.20.2
+
+  globalthis@1.0.4:
+    dependencies:
+      define-properties: 1.2.1
+      gopd: 1.2.0
+
+  globby@11.1.0:
+    dependencies:
+      array-union: 2.1.0
+      dir-glob: 3.0.1
+      fast-glob: 3.3.3
+      ignore: 5.3.2
+      merge2: 1.4.1
+      slash: 3.0.0
+
+  google-logging-utils@0.0.2: {}
+
+  gopd@1.2.0: {}
+
+  graceful-fs@4.2.11: {}
+
+  graphemer@1.4.0: {}
+
+  hanji@0.0.5:
+    dependencies:
+      lodash.throttle: 4.1.1
+      sisteransi: 1.0.5
+
+  has-bigints@1.1.0: {}
+
+  has-flag@4.0.0: {}
+
+  has-property-descriptors@1.0.2:
+    dependencies:
+      es-define-property: 1.0.1
+
+  has-proto@1.2.0:
+    dependencies:
+      dunder-proto: 1.0.1
+
+  has-symbols@1.1.0: {}
+
+  has-tostringtag@1.0.2:
+    dependencies:
+      has-symbols: 1.1.0
+
+  hasown@2.0.3:
+    dependencies:
+      function-bind: 1.1.2
+
+  heap@0.2.7: {}
+
+  html-escaper@2.0.2: {}
+
+  http-errors@2.0.1:
+    dependencies:
+      depd: 2.0.0
+      inherits: 2.0.4
+      setprototypeof: 1.2.0
+      statuses: 2.0.2
+      toidentifier: 1.0.1
+
+  https-proxy-agent@7.0.6:
+    dependencies:
+      agent-base: 7.1.4
+      debug: 4.4.3
+    transitivePeerDependencies:
+      - supports-color
+
+  human-signals@5.0.0: {}
+
+  iconv-lite@0.4.24:
+    dependencies:
+      safer-buffer: 2.1.2
+
+  ieee754@1.2.1: {}
+
+  ignore@5.3.2: {}
+
+  immediate@3.0.6: {}
+
+  import-fresh@3.3.1:
+    dependencies:
+      parent-module: 1.0.1
+      resolve-from: 4.0.0
+
+  import-in-the-middle@1.7.1:
+    dependencies:
+      acorn: 8.16.0
+      acorn-import-assertions: 1.9.0(acorn@8.16.0)
+      cjs-module-lexer: 1.4.3
+      module-details-from-path: 1.0.4
+
+  import-in-the-middle@1.7.4:
+    dependencies:
+      acorn: 8.16.0
+      acorn-import-attributes: 1.9.5(acorn@8.16.0)
+      cjs-module-lexer: 1.4.3
+      module-details-from-path: 1.0.4
+
+  imurmurhash@0.1.4: {}
+
+  inflight@1.0.6:
+    dependencies:
+      once: 1.4.0
+      wrappy: 1.0.2
+
+  inherits@2.0.4: {}
+
+  internal-slot@1.1.0:
+    dependencies:
+      es-errors: 1.3.0
+      hasown: 2.0.3
+      side-channel: 1.1.0
+
+  ioredis-mock@8.13.1(@types/ioredis-mock@8.2.7(ioredis@5.10.1))(ioredis@5.10.1):
+    dependencies:
+      '@ioredis/as-callback': 3.0.0
+      '@ioredis/commands': 1.5.1
+      '@types/ioredis-mock': 8.2.7(ioredis@5.10.1)
+      fengari: 0.1.5
+      fengari-interop: 0.1.4(fengari@0.1.5)
+      ioredis: 5.10.1
+      semver: 7.7.4
+
+  ioredis@5.10.1:
+    dependencies:
+      '@ioredis/commands': 1.5.1
+      cluster-key-slot: 1.1.2
+      debug: 4.4.3
+      denque: 2.1.0
+      lodash.defaults: 4.2.0
+      lodash.isarguments: 3.1.0
+      redis-errors: 1.2.0
+      redis-parser: 3.0.0
+      standard-as-callback: 2.1.0
+    transitivePeerDependencies:
+      - supports-color
+
+  ipaddr.js@1.9.1: {}
+
+  is-array-buffer@3.0.5:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      get-intrinsic: 1.3.0
+
+  is-async-function@2.1.1:
+    dependencies:
+      async-function: 1.0.0
+      call-bound: 1.0.4
+      get-proto: 1.0.1
+      has-tostringtag: 1.0.2
+      safe-regex-test: 1.1.0
+
+  is-bigint@1.1.0:
+    dependencies:
+      has-bigints: 1.1.0
+
+  is-boolean-object@1.2.2:
+    dependencies:
+      call-bound: 1.0.4
+      has-tostringtag: 1.0.2
+
+  is-bun-module@2.0.0:
+    dependencies:
+      semver: 7.7.4
+
+  is-callable@1.2.7: {}
+
+  is-core-module@2.16.1:
+    dependencies:
+      hasown: 2.0.3
+
+  is-data-view@1.0.2:
+    dependencies:
+      call-bound: 1.0.4
+      get-intrinsic: 1.3.0
+      is-typed-array: 1.1.15
+
+  is-date-object@1.1.0:
+    dependencies:
+      call-bound: 1.0.4
+      has-tostringtag: 1.0.2
+
+  is-extglob@2.1.1: {}
+
+  is-finalizationregistry@1.1.1:
+    dependencies:
+      call-bound: 1.0.4
+
+  is-fullwidth-code-point@3.0.0: {}
+
+  is-generator-function@1.1.2:
+    dependencies:
+      call-bound: 1.0.4
+      generator-function: 2.0.1
+      get-proto: 1.0.1
+      has-tostringtag: 1.0.2
+      safe-regex-test: 1.1.0
+
+  is-glob@4.0.3:
+    dependencies:
+      is-extglob: 2.1.1
+
+  is-map@2.0.3: {}
+
+  is-negative-zero@2.0.3: {}
+
+  is-number-object@1.1.1:
+    dependencies:
+      call-bound: 1.0.4
+      has-tostringtag: 1.0.2
+
+  is-number@7.0.0: {}
+
+  is-path-inside@3.0.3: {}
+
+  is-promise@2.2.2: {}
+
+  is-regex@1.2.1:
+    dependencies:
+      call-bound: 1.0.4
+      gopd: 1.2.0
+      has-tostringtag: 1.0.2
+      hasown: 2.0.3
+
+  is-set@2.0.3: {}
+
+  is-shared-array-buffer@1.0.4:
+    dependencies:
+      call-bound: 1.0.4
+
+  is-stream@2.0.1: {}
+
+  is-stream@3.0.0: {}
+
+  is-string@1.1.1:
+    dependencies:
+      call-bound: 1.0.4
+      has-tostringtag: 1.0.2
+
+  is-symbol@1.1.1:
+    dependencies:
+      call-bound: 1.0.4
+      has-symbols: 1.1.0
+      safe-regex-test: 1.1.0
+
+  is-typed-array@1.1.15:
+    dependencies:
+      which-typed-array: 1.1.20
+
+  is-weakmap@2.0.2: {}
+
+  is-weakref@1.1.1:
+    dependencies:
+      call-bound: 1.0.4
+
+  is-weakset@2.0.4:
+    dependencies:
+      call-bound: 1.0.4
+      get-intrinsic: 1.3.0
+
+  isarray@1.0.0: {}
+
+  isarray@2.0.5: {}
+
+  isexe@2.0.0: {}
+
+  istanbul-lib-coverage@3.2.2: {}
+
+  istanbul-lib-report@3.0.1:
+    dependencies:
+      istanbul-lib-coverage: 3.2.2
+      make-dir: 4.0.0
+      supports-color: 7.2.0
+
+  istanbul-lib-source-maps@5.0.6:
+    dependencies:
+      '@jridgewell/trace-mapping': 0.3.31
+      debug: 4.4.3
+      istanbul-lib-coverage: 3.2.2
+    transitivePeerDependencies:
+      - supports-color
+
+  istanbul-reports@3.2.0:
+    dependencies:
+      html-escaper: 2.0.2
+      istanbul-lib-report: 3.0.1
+
+  iterare@1.2.1: {}
+
+  jackspeak@3.4.3:
+    dependencies:
+      '@isaacs/cliui': 8.0.2
+    optionalDependencies:
+      '@pkgjs/parseargs': 0.11.0
+
+  joi@17.13.3:
+    dependencies:
+      '@hapi/hoek': 9.3.0
+      '@hapi/topo': 5.1.0
+      '@sideway/address': 4.1.5
+      '@sideway/formula': 3.0.1
+      '@sideway/pinpoint': 2.0.0
+
+  js-tokens@9.0.1: {}
+
+  js-yaml@4.1.1:
+    dependencies:
+      argparse: 2.0.1
+
+  json-bigint@1.0.0:
+    dependencies:
+      bignumber.js: 9.3.1
+
+  json-buffer@3.0.1: {}
+
+  json-diff@0.9.0:
+    dependencies:
+      cli-color: 2.0.4
+      difflib: 0.2.4
+      dreamopt: 0.8.0
+
+  json-schema-traverse@0.4.1: {}
+
+  json-stable-stringify-without-jsonify@1.0.1: {}
+
+  json5@1.0.2:
+    dependencies:
+      minimist: 1.2.8
+
+  keyv@4.5.4:
+    dependencies:
+      json-buffer: 3.0.1
+
+  lazystream@1.0.1:
+    dependencies:
+      readable-stream: 2.3.8
+
+  levn@0.4.1:
+    dependencies:
+      prelude-ls: 1.2.1
+      type-check: 0.4.0
+
+  lie@3.1.1:
+    dependencies:
+      immediate: 3.0.6
+
+  local-pkg@0.5.1:
+    dependencies:
+      mlly: 1.8.2
+      pkg-types: 1.3.1
+
+  localforage@1.10.0:
+    dependencies:
+      lie: 3.1.1
+
+  locate-path@6.0.0:
+    dependencies:
+      p-locate: 5.0.0
+
+  lodash.camelcase@4.3.0: {}
+
+  lodash.defaults@4.2.0: {}
+
+  lodash.isarguments@3.1.0: {}
+
+  lodash.merge@4.6.2: {}
+
+  lodash.throttle@4.1.1: {}
+
+  lodash@4.18.1: {}
+
+  long@5.3.2: {}
+
+  loupe@2.3.7:
+    dependencies:
+      get-func-name: 2.0.2
+
+  lru-cache@10.4.3: {}
+
+  lru-queue@0.1.0:
+    dependencies:
+      es5-ext: 0.10.64
+
+  luxon@3.7.2: {}
+
+  magic-string@0.30.21:
+    dependencies:
+      '@jridgewell/sourcemap-codec': 1.5.5
+
+  magicast@0.3.5:
+    dependencies:
+      '@babel/parser': 7.29.2
+      '@babel/types': 7.29.0
+      source-map-js: 1.2.1
+
+  make-dir@4.0.0:
+    dependencies:
+      semver: 7.7.4
+
+  math-intrinsics@1.1.0: {}
+
+  media-typer@0.3.0: {}
+
+  memoizee@0.4.17:
+    dependencies:
+      d: 1.0.2
+      es5-ext: 0.10.64
+      es6-weak-map: 2.0.3
+      event-emitter: 0.3.5
+      is-promise: 2.2.2
+      lru-queue: 0.1.0
+      next-tick: 1.1.0
+      timers-ext: 0.1.8
+
+  merge-descriptors@1.0.3: {}
+
+  merge-stream@2.0.0: {}
+
+  merge2@1.4.1: {}
+
+  methods@1.1.2: {}
+
+  micromatch@4.0.8:
+    dependencies:
+      braces: 3.0.3
+      picomatch: 2.3.2
+
+  mime-db@1.52.0: {}
+
+  mime-types@2.1.35:
+    dependencies:
+      mime-db: 1.52.0
+
+  mime@1.6.0: {}
+
+  mime@2.6.0: {}
+
+  mimic-fn@4.0.0: {}
+
+  minimatch@3.1.5:
+    dependencies:
+      brace-expansion: 1.1.14
+
+  minimatch@5.1.9:
+    dependencies:
+      brace-expansion: 2.1.0
+
+  minimatch@9.0.9:
+    dependencies:
+      brace-expansion: 2.1.0
+
+  minimist@1.2.8: {}
+
+  minipass@7.1.3: {}
+
+  mkdirp-classic@0.5.3: {}
+
+  mkdirp@0.5.6:
+    dependencies:
+      minimist: 1.2.8
+
+  mkdirp@1.0.4: {}
+
+  mlly@1.8.2:
+    dependencies:
+      acorn: 8.16.0
+      pathe: 2.0.3
+      pkg-types: 1.3.1
+      ufo: 1.6.3
+
+  module-details-from-path@1.0.4: {}
+
+  ms@2.0.0: {}
+
+  ms@2.1.3: {}
+
+  msgpackr-extract@3.0.3:
+    dependencies:
+      node-gyp-build-optional-packages: 5.2.2
+    optionalDependencies:
+      '@msgpackr-extract/msgpackr-extract-darwin-arm64': 3.0.3
+      '@msgpackr-extract/msgpackr-extract-darwin-x64': 3.0.3
+      '@msgpackr-extract/msgpackr-extract-linux-arm': 3.0.3
+      '@msgpackr-extract/msgpackr-extract-linux-arm64': 3.0.3
+      '@msgpackr-extract/msgpackr-extract-linux-x64': 3.0.3
+      '@msgpackr-extract/msgpackr-extract-win32-x64': 3.0.3
+    optional: true
+
+  msgpackr@1.11.5:
+    optionalDependencies:
+      msgpackr-extract: 3.0.3
+
+  multer@2.0.2:
+    dependencies:
+      append-field: 1.0.0
+      busboy: 1.6.0
+      concat-stream: 2.0.0
+      mkdirp: 0.5.6
+      object-assign: 4.1.1
+      type-is: 1.6.18
+      xtend: 4.0.2
+
+  nan@2.26.2:
+    optional: true
+
+  nanoid@3.3.11: {}
+
+  napi-postinstall@0.3.4: {}
+
+  natural-compare@1.4.0: {}
+
+  negotiator@0.6.3: {}
+
+  next-tick@1.1.0: {}
+
+  node-abort-controller@3.1.1: {}
+
+  node-exports-info@1.6.0:
+    dependencies:
+      array.prototype.flatmap: 1.3.3
+      es-errors: 1.3.0
+      object.entries: 1.1.9
+      semver: 6.3.1
+
+  node-fetch@2.7.0:
+    dependencies:
+      whatwg-url: 5.0.0
+
+  node-gyp-build-optional-packages@5.2.2:
+    dependencies:
+      detect-libc: 2.1.2
+    optional: true
+
+  normalize-path@3.0.0: {}
+
+  npm-run-path@5.3.0:
+    dependencies:
+      path-key: 4.0.0
+
+  object-assign@4.1.1: {}
+
+  object-inspect@1.13.4: {}
+
+  object-keys@1.1.1: {}
+
+  object.assign@4.1.7:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-properties: 1.2.1
+      es-object-atoms: 1.1.1
+      has-symbols: 1.1.0
+      object-keys: 1.1.1
+
+  object.entries@1.1.9:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-properties: 1.2.1
+      es-object-atoms: 1.1.1
+
+  object.fromentries@2.0.8:
+    dependencies:
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-object-atoms: 1.1.1
+
+  object.groupby@1.0.3:
+    dependencies:
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+
+  object.values@1.2.1:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-properties: 1.2.1
+      es-object-atoms: 1.1.1
+
+  on-exit-leak-free@2.1.2: {}
+
+  on-finished@2.4.1:
+    dependencies:
+      ee-first: 1.1.1
+
+  once@1.4.0:
+    dependencies:
+      wrappy: 1.0.2
+
+  onetime@6.0.0:
+    dependencies:
+      mimic-fn: 4.0.0
+
+  optionator@0.9.4:
+    dependencies:
+      deep-is: 0.1.4
+      fast-levenshtein: 2.0.6
+      levn: 0.4.1
+      prelude-ls: 1.2.1
+      type-check: 0.4.0
+      word-wrap: 1.2.5
+
+  own-keys@1.0.1:
+    dependencies:
+      get-intrinsic: 1.3.0
+      object-keys: 1.1.1
+      safe-push-apply: 1.0.0
+
+  p-limit@3.1.0:
+    dependencies:
+      yocto-queue: 0.1.0
+
+  p-limit@5.0.0:
+    dependencies:
+      yocto-queue: 1.2.2
+
+  p-locate@5.0.0:
+    dependencies:
+      p-limit: 3.1.0
+
+  package-json-from-dist@1.0.1: {}
+
+  parent-module@1.0.1:
+    dependencies:
+      callsites: 3.1.0
+
+  parseurl@1.3.3: {}
+
+  path-exists@4.0.0: {}
+
+  path-is-absolute@1.0.1: {}
+
+  path-key@3.1.1: {}
+
+  path-key@4.0.0: {}
+
+  path-parse@1.0.7: {}
+
+  path-scurry@1.11.1:
+    dependencies:
+      lru-cache: 10.4.3
+      minipass: 7.1.3
+
+  path-to-regexp@0.1.13: {}
+
+  path-to-regexp@3.3.0: {}
+
+  path-type@4.0.0: {}
+
+  pathe@1.1.2: {}
+
+  pathe@2.0.3: {}
+
+  pathval@1.1.1: {}
+
+  pg-cloudflare@1.3.0:
+    optional: true
+
+  pg-connection-string@2.12.0: {}
+
+  pg-int8@1.0.1: {}
+
+  pg-pool@3.13.0(pg@8.20.0):
+    dependencies:
+      pg: 8.20.0
+
+  pg-protocol@1.13.0: {}
+
+  pg-types@2.2.0:
+    dependencies:
+      pg-int8: 1.0.1
+      postgres-array: 2.0.0
+      postgres-bytea: 1.0.1
+      postgres-date: 1.0.7
+      postgres-interval: 1.2.0
+
+  pg@8.20.0:
+    dependencies:
+      pg-connection-string: 2.12.0
+      pg-pool: 3.13.0(pg@8.20.0)
+      pg-protocol: 1.13.0
+      pg-types: 2.2.0
+      pgpass: 1.0.5
+    optionalDependencies:
+      pg-cloudflare: 1.3.0
+
+  pgpass@1.0.5:
+    dependencies:
+      split2: 4.2.0
+
+  picocolors@1.1.1: {}
+
+  picomatch@2.3.2: {}
+
+  picomatch@4.0.4: {}
+
+  pino-abstract-transport@1.2.0:
+    dependencies:
+      readable-stream: 4.7.0
+      split2: 4.2.0
+
+  pino-std-serializers@6.2.2: {}
+
+  pino@8.21.0:
+    dependencies:
+      atomic-sleep: 1.0.0
+      fast-redact: 3.5.0
+      on-exit-leak-free: 2.1.2
+      pino-abstract-transport: 1.2.0
+      pino-std-serializers: 6.2.2
+      process-warning: 3.0.0
+      quick-format-unescaped: 4.0.4
+      real-require: 0.2.0
+      safe-stable-stringify: 2.5.0
+      sonic-boom: 3.8.1
+      thread-stream: 2.7.0
+
+  pkg-types@1.3.1:
+    dependencies:
+      confbox: 0.1.8
+      mlly: 1.8.2
+      pathe: 2.0.3
+
+  possible-typed-array-names@1.1.0: {}
+
+  postcss@8.5.10:
+    dependencies:
+      nanoid: 3.3.11
+      picocolors: 1.1.1
+      source-map-js: 1.2.1
+
+  postgres-array@2.0.0: {}
+
+  postgres-bytea@1.0.1: {}
+
+  postgres-date@1.0.7: {}
+
+  postgres-interval@1.2.0:
+    dependencies:
+      xtend: 4.0.2
+
+  prelude-ls@1.2.1: {}
+
+  prettier@3.8.3: {}
+
+  pretty-format@29.7.0:
+    dependencies:
+      '@jest/schemas': 29.6.3
+      ansi-styles: 5.2.0
+      react-is: 18.3.1
+
+  process-nextick-args@2.0.1: {}
+
+  process-warning@3.0.0: {}
+
+  process@0.11.10: {}
+
+  proper-lockfile@4.1.2:
+    dependencies:
+      graceful-fs: 4.2.11
+      retry: 0.12.0
+      signal-exit: 3.0.7
+
+  properties-reader@2.3.0:
+    dependencies:
+      mkdirp: 1.0.4
+
+  protobufjs@7.5.5:
+    dependencies:
+      '@protobufjs/aspromise': 1.1.2
+      '@protobufjs/base64': 1.1.2
+      '@protobufjs/codegen': 2.0.4
+      '@protobufjs/eventemitter': 1.1.0
+      '@protobufjs/fetch': 1.1.0
+      '@protobufjs/float': 1.0.2
+      '@protobufjs/inquire': 1.1.0
+      '@protobufjs/path': 1.1.2
+      '@protobufjs/pool': 1.1.0
+      '@protobufjs/utf8': 1.1.0
+      '@types/node': 20.19.39
+      long: 5.3.2
+
+  proxy-addr@2.0.7:
+    dependencies:
+      forwarded: 0.2.0
+      ipaddr.js: 1.9.1
+
+  pump@3.0.4:
+    dependencies:
+      end-of-stream: 1.4.5
+      once: 1.4.0
+
+  punycode@2.3.1: {}
+
+  qs@6.14.2:
+    dependencies:
+      side-channel: 1.1.0
+
+  qs@6.15.1:
+    dependencies:
+      side-channel: 1.1.0
+
+  queue-microtask@1.2.3: {}
+
+  quick-format-unescaped@4.0.4: {}
+
+  range-parser@1.2.1: {}
+
+  raw-body@2.5.3:
+    dependencies:
+      bytes: 3.1.2
+      http-errors: 2.0.1
+      iconv-lite: 0.4.24
+      unpipe: 1.0.0
+
+  react-is@18.3.1: {}
+
+  readable-stream@2.3.8:
+    dependencies:
+      core-util-is: 1.0.3
+      inherits: 2.0.4
+      isarray: 1.0.0
+      process-nextick-args: 2.0.1
+      safe-buffer: 5.1.2
+      string_decoder: 1.1.1
+      util-deprecate: 1.0.2
+
+  readable-stream@3.6.2:
+    dependencies:
+      inherits: 2.0.4
+      string_decoder: 1.3.0
+      util-deprecate: 1.0.2
+
+  readable-stream@4.7.0:
+    dependencies:
+      abort-controller: 3.0.0
+      buffer: 6.0.3
+      events: 3.3.0
+      process: 0.11.10
+      string_decoder: 1.3.0
+
+  readdir-glob@1.1.3:
+    dependencies:
+      minimatch: 5.1.9
+
+  readline-sync@1.4.10: {}
+
+  real-require@0.2.0: {}
+
+  redis-errors@1.2.0: {}
+
+  redis-parser@3.0.0:
+    dependencies:
+      redis-errors: 1.2.0
+
+  reflect-metadata@0.2.2: {}
+
+  reflect.getprototypeof@1.0.10:
+    dependencies:
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-errors: 1.3.0
+      es-object-atoms: 1.1.1
+      get-intrinsic: 1.3.0
+      get-proto: 1.0.1
+      which-builtin-type: 1.2.1
+
+  regexp.prototype.flags@1.5.4:
+    dependencies:
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-errors: 1.3.0
+      get-proto: 1.0.1
+      gopd: 1.2.0
+      set-function-name: 2.0.2
+
+  require-directory@2.1.1: {}
+
+  require-in-the-middle@7.5.2:
+    dependencies:
+      debug: 4.4.3
+      module-details-from-path: 1.0.4
+      resolve: 1.22.12
+    transitivePeerDependencies:
+      - supports-color
+
+  resolve-from@4.0.0: {}
+
+  resolve-pkg-maps@1.0.0: {}
+
+  resolve@1.22.12:
+    dependencies:
+      es-errors: 1.3.0
+      is-core-module: 2.16.1
+      path-parse: 1.0.7
+      supports-preserve-symlinks-flag: 1.0.0
+
+  resolve@2.0.0-next.6:
+    dependencies:
+      es-errors: 1.3.0
+      is-core-module: 2.16.1
+      node-exports-info: 1.6.0
+      object-keys: 1.1.1
+      path-parse: 1.0.7
+      supports-preserve-symlinks-flag: 1.0.0
+
+  retry@0.12.0: {}
+
+  reusify@1.1.0: {}
+
+  rimraf@3.0.2:
+    dependencies:
+      glob: 7.2.3
+
+  rollup@4.60.1:
+    dependencies:
+      '@types/estree': 1.0.8
+    optionalDependencies:
+      '@rollup/rollup-android-arm-eabi': 4.60.1
+      '@rollup/rollup-android-arm64': 4.60.1
+      '@rollup/rollup-darwin-arm64': 4.60.1
+      '@rollup/rollup-darwin-x64': 4.60.1
+      '@rollup/rollup-freebsd-arm64': 4.60.1
+      '@rollup/rollup-freebsd-x64': 4.60.1
+      '@rollup/rollup-linux-arm-gnueabihf': 4.60.1
+      '@rollup/rollup-linux-arm-musleabihf': 4.60.1
+      '@rollup/rollup-linux-arm64-gnu': 4.60.1
+      '@rollup/rollup-linux-arm64-musl': 4.60.1
+      '@rollup/rollup-linux-loong64-gnu': 4.60.1
+      '@rollup/rollup-linux-loong64-musl': 4.60.1
+      '@rollup/rollup-linux-ppc64-gnu': 4.60.1
+      '@rollup/rollup-linux-ppc64-musl': 4.60.1
+      '@rollup/rollup-linux-riscv64-gnu': 4.60.1
+      '@rollup/rollup-linux-riscv64-musl': 4.60.1
+      '@rollup/rollup-linux-s390x-gnu': 4.60.1
+      '@rollup/rollup-linux-x64-gnu': 4.60.1
+      '@rollup/rollup-linux-x64-musl': 4.60.1
+      '@rollup/rollup-openbsd-x64': 4.60.1
+      '@rollup/rollup-openharmony-arm64': 4.60.1
+      '@rollup/rollup-win32-arm64-msvc': 4.60.1
+      '@rollup/rollup-win32-ia32-msvc': 4.60.1
+      '@rollup/rollup-win32-x64-gnu': 4.60.1
+      '@rollup/rollup-win32-x64-msvc': 4.60.1
+      fsevents: 2.3.3
+
+  run-parallel@1.2.0:
+    dependencies:
+      queue-microtask: 1.2.3
+
+  rxjs@7.8.2:
+    dependencies:
+      tslib: 2.8.1
+
+  safe-array-concat@1.1.3:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      get-intrinsic: 1.3.0
+      has-symbols: 1.1.0
+      isarray: 2.0.5
+
+  safe-buffer@5.1.2: {}
+
+  safe-buffer@5.2.1: {}
+
+  safe-push-apply@1.0.0:
+    dependencies:
+      es-errors: 1.3.0
+      isarray: 2.0.5
+
+  safe-regex-test@1.1.0:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      is-regex: 1.2.1
+
+  safe-stable-stringify@2.5.0: {}
+
+  safer-buffer@2.1.2: {}
+
+  semver@6.3.1: {}
+
+  semver@7.7.4: {}
+
+  send@0.19.2:
+    dependencies:
+      debug: 2.6.9
+      depd: 2.0.0
+      destroy: 1.2.0
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      etag: 1.8.1
+      fresh: 0.5.2
+      http-errors: 2.0.1
+      mime: 1.6.0
+      ms: 2.1.3
+      on-finished: 2.4.1
+      range-parser: 1.2.1
+      statuses: 2.0.2
+    transitivePeerDependencies:
+      - supports-color
+
+  serve-static@1.16.3:
+    dependencies:
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      parseurl: 1.3.3
+      send: 0.19.2
+    transitivePeerDependencies:
+      - supports-color
+
+  set-function-length@1.2.2:
+    dependencies:
+      define-data-property: 1.1.4
+      es-errors: 1.3.0
+      function-bind: 1.1.2
+      get-intrinsic: 1.3.0
+      gopd: 1.2.0
+      has-property-descriptors: 1.0.2
+
+  set-function-name@2.0.2:
+    dependencies:
+      define-data-property: 1.1.4
+      es-errors: 1.3.0
+      functions-have-names: 1.2.3
+      has-property-descriptors: 1.0.2
+
+  set-proto@1.0.0:
+    dependencies:
+      dunder-proto: 1.0.1
+      es-errors: 1.3.0
+      es-object-atoms: 1.1.1
+
+  setprototypeof@1.2.0: {}
+
+  shebang-command@2.0.0:
+    dependencies:
+      shebang-regex: 3.0.0
+
+  shebang-regex@3.0.0: {}
+
+  shimmer@1.2.1: {}
+
+  side-channel-list@1.0.1:
+    dependencies:
+      es-errors: 1.3.0
+      object-inspect: 1.13.4
+
+  side-channel-map@1.0.1:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+      object-inspect: 1.13.4
+
+  side-channel-weakmap@1.0.2:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+      object-inspect: 1.13.4
+      side-channel-map: 1.0.1
+
+  side-channel@1.1.0:
+    dependencies:
+      es-errors: 1.3.0
+      object-inspect: 1.13.4
+      side-channel-list: 1.0.1
+      side-channel-map: 1.0.1
+      side-channel-weakmap: 1.0.2
+
+  siginfo@2.0.0: {}
+
+  signal-exit@3.0.7: {}
+
+  signal-exit@4.1.0: {}
+
+  sisteransi@1.0.5: {}
+
+  slash@3.0.0: {}
+
+  sonic-boom@3.8.1:
+    dependencies:
+      atomic-sleep: 1.0.0
+
+  source-map-js@1.2.1: {}
+
+  source-map-support@0.5.21:
+    dependencies:
+      buffer-from: 1.1.2
+      source-map: 0.6.1
+
+  source-map@0.6.1: {}
+
+  split-ca@1.0.1: {}
+
+  split2@4.2.0: {}
+
+  sprintf-js@1.1.3: {}
+
+  ssh-remote-port-forward@1.0.4:
+    dependencies:
+      '@types/ssh2': 0.5.52
+      ssh2: 1.17.0
+
+  ssh2@1.17.0:
+    dependencies:
+      asn1: 0.2.6
+      bcrypt-pbkdf: 1.0.2
+    optionalDependencies:
+      cpu-features: 0.0.10
+      nan: 2.26.2
+
+  stable-hash@0.0.5: {}
+
+  stackback@0.0.2: {}
+
+  standard-as-callback@2.1.0: {}
+
+  statuses@2.0.2: {}
+
+  std-env@3.10.0: {}
+
+  stop-iteration-iterator@1.1.0:
+    dependencies:
+      es-errors: 1.3.0
+      internal-slot: 1.1.0
+
+  streamsearch@1.1.0: {}
+
+  streamx@2.25.0:
+    dependencies:
+      events-universal: 1.0.1
+      fast-fifo: 1.3.2
+      text-decoder: 1.2.7
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - react-native-b4a
+
+  string-width@4.2.3:
+    dependencies:
+      emoji-regex: 8.0.0
+      is-fullwidth-code-point: 3.0.0
+      strip-ansi: 6.0.1
+
+  string-width@5.1.2:
+    dependencies:
+      eastasianwidth: 0.2.0
+      emoji-regex: 9.2.2
+      strip-ansi: 7.2.0
+
+  string.prototype.trim@1.2.10:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-data-property: 1.1.4
+      define-properties: 1.2.1
+      es-abstract: 1.24.2
+      es-object-atoms: 1.1.1
+      has-property-descriptors: 1.0.2
+
+  string.prototype.trimend@1.0.9:
+    dependencies:
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      define-properties: 1.2.1
+      es-object-atoms: 1.1.1
+
+  string.prototype.trimstart@1.0.8:
+    dependencies:
+      call-bind: 1.0.9
+      define-properties: 1.2.1
+      es-object-atoms: 1.1.1
+
+  string_decoder@1.1.1:
+    dependencies:
+      safe-buffer: 5.1.2
+
+  string_decoder@1.3.0:
+    dependencies:
+      safe-buffer: 5.2.1
+
+  strip-ansi@6.0.1:
+    dependencies:
+      ansi-regex: 5.0.1
+
+  strip-ansi@7.2.0:
+    dependencies:
+      ansi-regex: 6.2.2
+
+  strip-bom@3.0.0: {}
+
+  strip-final-newline@3.0.0: {}
+
+  strip-json-comments@3.1.1: {}
+
+  strip-literal@2.1.1:
+    dependencies:
+      js-tokens: 9.0.1
+
+  strtok3@10.3.5:
+    dependencies:
+      '@tokenizer/token': 0.3.0
+
+  superagent@10.3.0:
+    dependencies:
+      component-emitter: 1.3.1
+      cookiejar: 2.1.4
+      debug: 4.4.3
+      fast-safe-stringify: 2.1.1
+      form-data: 4.0.5
+      formidable: 3.5.4
+      methods: 1.1.2
+      mime: 2.6.0
+      qs: 6.15.1
+    transitivePeerDependencies:
+      - supports-color
+
+  supertest@7.2.2:
+    dependencies:
+      cookie-signature: 1.2.2
+      methods: 1.1.2
+      superagent: 10.3.0
+    transitivePeerDependencies:
+      - supports-color
+
+  supports-color@7.2.0:
+    dependencies:
+      has-flag: 4.0.0
+
+  supports-preserve-symlinks-flag@1.0.0: {}
+
+  tar-fs@2.1.4:
+    dependencies:
+      chownr: 1.1.4
+      mkdirp-classic: 0.5.3
+      pump: 3.0.4
+      tar-stream: 2.2.0
+
+  tar-fs@3.1.2:
+    dependencies:
+      pump: 3.0.4
+      tar-stream: 3.1.8
+    optionalDependencies:
+      bare-fs: 4.7.1
+      bare-path: 3.0.0
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - bare-buffer
+      - react-native-b4a
+
+  tar-stream@2.2.0:
+    dependencies:
+      bl: 4.1.0
+      end-of-stream: 1.4.5
+      fs-constants: 1.0.0
+      inherits: 2.0.4
+      readable-stream: 3.6.2
+
+  tar-stream@3.1.8:
+    dependencies:
+      b4a: 1.8.0
+      bare-fs: 4.7.1
+      fast-fifo: 1.3.2
+      streamx: 2.25.0
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - bare-buffer
+      - react-native-b4a
+
+  teex@1.0.1:
+    dependencies:
+      streamx: 2.25.0
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - react-native-b4a
+
+  test-exclude@6.0.0:
+    dependencies:
+      '@istanbuljs/schema': 0.1.6
+      glob: 7.2.3
+      minimatch: 3.1.5
+
+  testcontainers@10.28.0:
+    dependencies:
+      '@balena/dockerignore': 1.0.2
+      '@types/dockerode': 3.3.47
+      archiver: 7.0.1
+      async-lock: 1.4.1
+      byline: 5.0.0
+      debug: 4.4.3
+      docker-compose: 0.24.8
+      dockerode: 4.0.10
+      get-port: 7.2.0
+      proper-lockfile: 4.1.2
+      properties-reader: 2.3.0
+      ssh-remote-port-forward: 1.0.4
+      tar-fs: 3.1.2
+      tmp: 0.2.5
+      undici: 5.29.0
+    transitivePeerDependencies:
+      - bare-abort-controller
+      - bare-buffer
+      - react-native-b4a
+      - supports-color
+
+  text-decoder@1.2.7:
+    dependencies:
+      b4a: 1.8.0
+    transitivePeerDependencies:
+      - react-native-b4a
+
+  text-table@0.2.0: {}
+
+  thread-stream@2.7.0:
+    dependencies:
+      real-require: 0.2.0
+
+  timers-ext@0.1.8:
+    dependencies:
+      es5-ext: 0.10.64
+      next-tick: 1.1.0
+
+  tinybench@2.9.0: {}
+
+  tinyglobby@0.2.16:
+    dependencies:
+      fdir: 6.5.0(picomatch@4.0.4)
+      picomatch: 4.0.4
+
+  tinypool@0.8.4: {}
+
+  tinyspy@2.2.1: {}
+
+  tmp@0.2.5: {}
+
+  to-regex-range@5.0.1:
+    dependencies:
+      is-number: 7.0.0
+
+  toidentifier@1.0.1: {}
+
+  token-types@6.1.2:
+    dependencies:
+      '@borewit/text-codec': 0.2.2
+      '@tokenizer/token': 0.3.0
+      ieee754: 1.2.1
+
+  tr46@0.0.3: {}
+
+  ts-api-utils@1.4.3(typescript@5.9.3):
+    dependencies:
+      typescript: 5.9.3
+
+  tsconfig-paths@3.15.0:
+    dependencies:
+      '@types/json5': 0.0.29
+      json5: 1.0.2
+      minimist: 1.2.8
+      strip-bom: 3.0.0
+
+  tslib@2.8.1: {}
+
+  tsx@4.21.0:
+    dependencies:
+      esbuild: 0.27.7
+      get-tsconfig: 4.14.0
+    optionalDependencies:
+      fsevents: 2.3.3
+
+  turbo@2.9.6:
+    optionalDependencies:
+      '@turbo/darwin-64': 2.9.6
+      '@turbo/darwin-arm64': 2.9.6
+      '@turbo/linux-64': 2.9.6
+      '@turbo/linux-arm64': 2.9.6
+      '@turbo/windows-64': 2.9.6
+      '@turbo/windows-arm64': 2.9.6
+
+  tweetnacl@0.14.5: {}
+
+  type-check@0.4.0:
+    dependencies:
+      prelude-ls: 1.2.1
+
+  type-detect@4.1.0: {}
+
+  type-fest@0.20.2: {}
+
+  type-is@1.6.18:
+    dependencies:
+      media-typer: 0.3.0
+      mime-types: 2.1.35
+
+  type@2.7.3: {}
+
+  typed-array-buffer@1.0.3:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      is-typed-array: 1.1.15
+
+  typed-array-byte-length@1.0.3:
+    dependencies:
+      call-bind: 1.0.9
+      for-each: 0.3.5
+      gopd: 1.2.0
+      has-proto: 1.2.0
+      is-typed-array: 1.1.15
+
+  typed-array-byte-offset@1.0.4:
+    dependencies:
+      available-typed-arrays: 1.0.7
+      call-bind: 1.0.9
+      for-each: 0.3.5
+      gopd: 1.2.0
+      has-proto: 1.2.0
+      is-typed-array: 1.1.15
+      reflect.getprototypeof: 1.0.10
+
+  typed-array-length@1.0.7:
+    dependencies:
+      call-bind: 1.0.9
+      for-each: 0.3.5
+      gopd: 1.2.0
+      is-typed-array: 1.1.15
+      possible-typed-array-names: 1.1.0
+      reflect.getprototypeof: 1.0.10
+
+  typedarray@0.0.6: {}
+
+  typescript@5.9.3: {}
+
+  ufo@1.6.3: {}
+
+  uid@2.0.2:
+    dependencies:
+      '@lukeed/csprng': 1.1.0
+
+  uint8array-extras@1.5.0: {}
+
+  unbox-primitive@1.1.0:
+    dependencies:
+      call-bound: 1.0.4
+      has-bigints: 1.1.0
+      has-symbols: 1.1.0
+      which-boxed-primitive: 1.1.1
+
+  undici-types@5.26.5: {}
+
+  undici-types@6.21.0: {}
+
+  undici@5.29.0:
+    dependencies:
+      '@fastify/busboy': 2.1.1
+
+  unpipe@1.0.0: {}
+
+  unrs-resolver@1.11.1:
+    dependencies:
+      napi-postinstall: 0.3.4
+    optionalDependencies:
+      '@unrs/resolver-binding-android-arm-eabi': 1.11.1
+      '@unrs/resolver-binding-android-arm64': 1.11.1
+      '@unrs/resolver-binding-darwin-arm64': 1.11.1
+      '@unrs/resolver-binding-darwin-x64': 1.11.1
+      '@unrs/resolver-binding-freebsd-x64': 1.11.1
+      '@unrs/resolver-binding-linux-arm-gnueabihf': 1.11.1
+      '@unrs/resolver-binding-linux-arm-musleabihf': 1.11.1
+      '@unrs/resolver-binding-linux-arm64-gnu': 1.11.1
+      '@unrs/resolver-binding-linux-arm64-musl': 1.11.1
+      '@unrs/resolver-binding-linux-ppc64-gnu': 1.11.1
+      '@unrs/resolver-binding-linux-riscv64-gnu': 1.11.1
+      '@unrs/resolver-binding-linux-riscv64-musl': 1.11.1
+      '@unrs/resolver-binding-linux-s390x-gnu': 1.11.1
+      '@unrs/resolver-binding-linux-x64-gnu': 1.11.1
+      '@unrs/resolver-binding-linux-x64-musl': 1.11.1
+      '@unrs/resolver-binding-wasm32-wasi': 1.11.1
+      '@unrs/resolver-binding-win32-arm64-msvc': 1.11.1
+      '@unrs/resolver-binding-win32-ia32-msvc': 1.11.1
+      '@unrs/resolver-binding-win32-x64-msvc': 1.11.1
+
+  uri-js@4.4.1:
+    dependencies:
+      punycode: 2.3.1
+
+  util-deprecate@1.0.2: {}
+
+  utils-merge@1.0.1: {}
+
+  uuid@10.0.0: {}
+
+  uuid@11.1.0: {}
+
+  uuid@9.0.1: {}
+
+  vary@1.1.2: {}
+
+  vite-node@1.6.1(@types/node@20.19.39):
+    dependencies:
+      cac: 6.7.14
+      debug: 4.4.3
+      pathe: 1.1.2
+      picocolors: 1.1.1
+      vite: 5.4.21(@types/node@20.19.39)
+    transitivePeerDependencies:
+      - '@types/node'
+      - less
+      - lightningcss
+      - sass
+      - sass-embedded
+      - stylus
+      - sugarss
+      - supports-color
+      - terser
+
+  vite@5.4.21(@types/node@20.19.39):
+    dependencies:
+      esbuild: 0.21.5
+      postcss: 8.5.10
+      rollup: 4.60.1
+    optionalDependencies:
+      '@types/node': 20.19.39
+      fsevents: 2.3.3
+
+  vitest@1.6.1(@types/node@20.19.39):
+    dependencies:
+      '@vitest/expect': 1.6.1
+      '@vitest/runner': 1.6.1
+      '@vitest/snapshot': 1.6.1
+      '@vitest/spy': 1.6.1
+      '@vitest/utils': 1.6.1
+      acorn-walk: 8.3.5
+      chai: 4.5.0
+      debug: 4.4.3
+      execa: 8.0.1
+      local-pkg: 0.5.1
+      magic-string: 0.30.21
+      pathe: 1.1.2
+      picocolors: 1.1.1
+      std-env: 3.10.0
+      strip-literal: 2.1.1
+      tinybench: 2.9.0
+      tinypool: 0.8.4
+      vite: 5.4.21(@types/node@20.19.39)
+      vite-node: 1.6.1(@types/node@20.19.39)
+      why-is-node-running: 2.3.0
+    optionalDependencies:
+      '@types/node': 20.19.39
+    transitivePeerDependencies:
+      - less
+      - lightningcss
+      - sass
+      - sass-embedded
+      - stylus
+      - sugarss
+      - supports-color
+      - terser
+
+  webidl-conversions@3.0.1: {}
+
+  whatwg-url@5.0.0:
+    dependencies:
+      tr46: 0.0.3
+      webidl-conversions: 3.0.1
+
+  which-boxed-primitive@1.1.1:
+    dependencies:
+      is-bigint: 1.1.0
+      is-boolean-object: 1.2.2
+      is-number-object: 1.1.1
+      is-string: 1.1.1
+      is-symbol: 1.1.1
+
+  which-builtin-type@1.2.1:
+    dependencies:
+      call-bound: 1.0.4
+      function.prototype.name: 1.1.8
+      has-tostringtag: 1.0.2
+      is-async-function: 2.1.1
+      is-date-object: 1.1.0
+      is-finalizationregistry: 1.1.1
+      is-generator-function: 1.1.2
+      is-regex: 1.2.1
+      is-weakref: 1.1.1
+      isarray: 2.0.5
+      which-boxed-primitive: 1.1.1
+      which-collection: 1.0.2
+      which-typed-array: 1.1.20
+
+  which-collection@1.0.2:
+    dependencies:
+      is-map: 2.0.3
+      is-set: 2.0.3
+      is-weakmap: 2.0.2
+      is-weakset: 2.0.4
+
+  which-typed-array@1.1.20:
+    dependencies:
+      available-typed-arrays: 1.0.7
+      call-bind: 1.0.9
+      call-bound: 1.0.4
+      for-each: 0.3.5
+      get-proto: 1.0.1
+      gopd: 1.2.0
+      has-tostringtag: 1.0.2
+
+  which@2.0.2:
+    dependencies:
+      isexe: 2.0.0
+
+  why-is-node-running@2.3.0:
+    dependencies:
+      siginfo: 2.0.0
+      stackback: 0.0.2
+
+  word-wrap@1.2.5: {}
+
+  wordwrap@1.0.0: {}
+
+  wrap-ansi@7.0.0:
+    dependencies:
+      ansi-styles: 4.3.0
+      string-width: 4.2.3
+      strip-ansi: 6.0.1
+
+  wrap-ansi@8.1.0:
+    dependencies:
+      ansi-styles: 6.2.3
+      string-width: 5.1.2
+      strip-ansi: 7.2.0
+
+  wrappy@1.0.2: {}
+
+  xtend@4.0.2: {}
+
+  y18n@5.0.8: {}
+
+  yaml@2.8.3: {}
+
+  yargs-parser@21.1.1: {}
+
+  yargs@17.7.2:
+    dependencies:
+      cliui: 8.0.1
+      escalade: 3.2.0
+      get-caller-file: 2.0.5
+      require-directory: 2.1.1
+      string-width: 4.2.3
+      y18n: 5.0.8
+      yargs-parser: 21.1.1
+
+  yocto-queue@0.1.0: {}
+
+  yocto-queue@1.2.2: {}
+
+  zip-stream@6.0.1:
+    dependencies:
+      archiver-utils: 5.0.2
+      compress-commons: 6.0.2
+      readable-stream: 4.7.0
+
+  zod@3.25.76: {}
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
new file mode 100644
index 0000000..2a628dd
--- /dev/null
+++ b/pnpm-workspace.yaml
@@ -0,0 +1,5 @@
+packages:
+  - "apps/*"
+  - "packages/*"
+  - "packages/testing/*"
+  - "ops/eslint-rules/*"
diff --git a/scripts/db-reset.sh b/scripts/db-reset.sh
new file mode 100644
index 0000000..3b43c25
--- /dev/null
+++ b/scripts/db-reset.sh
@@ -0,0 +1,16 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"
+
+echo "→ dropping + recreating schema public ..."
+psql "$DB_URL" <<'SQL'
+DROP SCHEMA IF EXISTS public CASCADE;
+CREATE SCHEMA public;
+GRANT ALL ON SCHEMA public TO postgres;
+SQL
+
+echo "→ running migrations ..."
+DATABASE_URL="$DB_URL" pnpm -F @goldsmith/db exec tsx src/migrate.ts
+
+echo "✓ db reset complete"
diff --git a/scripts/tenant-delete.sh b/scripts/tenant-delete.sh
new file mode 100644
index 0000000..abbb8a0
--- /dev/null
+++ b/scripts/tenant-delete.sh
@@ -0,0 +1,64 @@
+#!/usr/bin/env bash
+# Usage: tenant-delete.sh --tenant <uuid> --confirm
+# MVP scope: deletes DB rows + generates placeholder DPDPA certificate.
+# Redis flush deferred (no Redis in MVP per ADR-0015). Azure Key Vault deletion deferred.
+set -euo pipefail
+
+TENANT_ID=""; CONFIRM=0
+while [[ $# -gt 0 ]]; do
+  case "$1" in
+    --tenant)  TENANT_ID="$2"; shift 2 ;;
+    --confirm) CONFIRM=1; shift ;;
+    *) echo "unknown arg: $1" >&2; exit 2 ;;
+  esac
+done
+[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }
+[[ $CONFIRM -ne 1 ]] && { echo "--confirm required (MFA + multi-person approval in prod)" >&2; exit 2; }
+
+DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"
+
+echo "→ deleting tenant rows from every tenantScopedTable ..."
+DATABASE_URL="$DB_URL" TENANT_ID="$TENANT_ID" \
+pnpm --config.engine-strict=false -F @goldsmith/db exec tsx -e "
+import { createPool, tableRegistry } from '@goldsmith/db';
+const pool = createPool({ connectionString: process.env.DATABASE_URL });
+const tenantId = process.env.TENANT_ID;
+(async () => {
+  const c = await pool.connect();
+  try {
+    await c.query('BEGIN');
+    await c.query('SET ROLE platform_admin');
+    for (const m of tableRegistry.list().filter((x) => x.kind === 'tenant')) {
+      await c.query(\`DELETE FROM \${m.name} WHERE shop_id=\$1\`, [tenantId]);
+    }
+    await c.query('DELETE FROM shops WHERE id=\$1', [tenantId]);
+    await c.query('RESET ROLE');
+    await c.query('COMMIT');
+  } catch (e) { await c.query('ROLLBACK'); throw e; }
+  finally { c.release(); await pool.end(); }
+})().catch((e) => { console.error(e); process.exit(1); });
+"
+
+echo "→ flushing tenant cache keys ..."
+echo "  (MVP: no Redis — skipped per ADR-0015. Redis flush will land with Infrastructure Story.)"
+
+echo "→ scheduling KEK deletion ..."
+echo "  (MVP: LocalKMS in-memory — deleted on process exit. Azure Key Vault ScheduleKeyDeletion lands with Infrastructure Story.)"
+
+echo "→ generating DPDPA erasure certificate ..."
+CERT_TXT="certs/dpdpa-erasure-$TENANT_ID-$(date -u +%Y%m%dT%H%M%SZ).txt"
+mkdir -p certs
+cat > "$CERT_TXT" <<CERT
+DPDPA Erasure Certificate — PLACEHOLDER (MVP)
+
+Tenant ID: $TENANT_ID
+Erasure completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
+Method: Logical deletion of all tenant-scoped rows in Goldsmith Postgres.
+Residual: Per ADR-0014, non-encrypted columns may be restorable from PITR
+backups for up to 7 calendar days via restricted break-glass procedure.
+
+Signed: (placeholder — full PDF certificate issued in Story 1.5 when
+platform-admin console + DPO sign-off flow lands)
+CERT
+
+echo "✓ tenant $TENANT_ID deleted; certificate at $CERT_TXT"
diff --git a/scripts/tenant-provision.sh b/scripts/tenant-provision.sh
new file mode 100644
index 0000000..1eb52c9
--- /dev/null
+++ b/scripts/tenant-provision.sh
@@ -0,0 +1,37 @@
+#!/usr/bin/env bash
+# Usage: tenant-provision.sh --tenant <uuid-or-slug> [--slug <slug>] [--display <name>]
+# MVP scope: uses LocalKMS (in-memory). Azure Key Vault integration lands in Infrastructure Story.
+set -euo pipefail
+
+TENANT_ID=""; SLUG=""; DISPLAY=""
+while [[ $# -gt 0 ]]; do
+  case "$1" in
+    --tenant)  TENANT_ID="$2"; shift 2 ;;
+    --slug)    SLUG="$2"; shift 2 ;;
+    --display) DISPLAY="$2"; shift 2 ;;
+    *) echo "unknown arg: $1" >&2; exit 2 ;;
+  esac
+done
+[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }
+SLUG="${SLUG:-$TENANT_ID}"
+DISPLAY="${DISPLAY:-$SLUG}"
+
+DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"
+
+echo "→ inserting shops row for $TENANT_ID ..."
+psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
+INSERT INTO shops (id, slug, display_name, status)
+VALUES ('$TENANT_ID', '$SLUG', '$DISPLAY', 'PROVISIONING')
+ON CONFLICT (id) DO NOTHING;
+SQL
+
+echo "→ provisioning LocalKMS KEK (MVP — Azure Key Vault deferred per ADR-0015) ..."
+# LocalKMS is per-process in-memory, so this only records a placeholder ARN.
+# Real KEK provisioning lands with Azure Key Vault in the Infrastructure Story.
+KEK_ARN="local:kms:${TENANT_ID}:placeholder"
+psql "$DB_URL" -v ON_ERROR_STOP=1 -c "UPDATE shops SET kek_key_arn='$KEK_ARN', status='ACTIVE' WHERE id='$TENANT_ID';"
+
+echo "→ running tenant-isolation harness against new tenant ..."
+DATABASE_URL="$DB_URL" pnpm -F @goldsmith/testing-tenant-isolation test:tenant-isolation
+
+echo "✓ tenant $TENANT_ID provisioned (KEK $KEK_ARN) and harness-gated"
diff --git a/tsconfig.base.json b/tsconfig.base.json
new file mode 100644
index 0000000..7258341
--- /dev/null
+++ b/tsconfig.base.json
@@ -0,0 +1,23 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "module": "CommonJS",
+    "moduleResolution": "Node",
+    "lib": ["ES2022"],
+    "strict": true,
+    "noImplicitAny": true,
+    "strictNullChecks": true,
+    "noFallthroughCasesInSwitch": true,
+    "noImplicitReturns": true,
+    "noImplicitOverride": true,
+    "noUnusedLocals": true,
+    "noUnusedParameters": true,
+    "exactOptionalPropertyTypes": true,
+    "forceConsistentCasingInFileNames": true,
+    "esModuleInterop": true,
+    "skipLibCheck": true,
+    "declaration": true,
+    "sourceMap": true,
+    "resolveJsonModule": true
+  }
+}
diff --git a/tsconfig.json b/tsconfig.json
new file mode 100644
index 0000000..e9613b9
--- /dev/null
+++ b/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "./tsconfig.base.json",
+  "include": [],
+  "references": []
+}
diff --git a/turbo.json b/turbo.json
new file mode 100644
index 0000000..0eddddd
--- /dev/null
+++ b/turbo.json
@@ -0,0 +1,13 @@
+{
+  "$schema": "https://turbo.build/schema.json",
+  "globalDependencies": ["tsconfig.base.json", ".eslintrc.cjs"],
+  "tasks": {
+    "typecheck":            { "dependsOn": ["^typecheck"], "outputs": [] },
+    "lint":                 { "outputs": [] },
+    "test":                 { "dependsOn": ["^build"], "outputs": [] },
+    "test:unit":            { "dependsOn": [], "outputs": [] },
+    "test:integration":     { "dependsOn": ["^build"], "outputs": [] },
+    "test:tenant-isolation": { "dependsOn": ["^build"], "outputs": [] },
+    "build":                { "dependsOn": ["^build"], "outputs": ["dist/**"] }
+  }
+}
diff --git a/vitest.config.ts b/vitest.config.ts
new file mode 100644
index 0000000..f859dd2
--- /dev/null
+++ b/vitest.config.ts
@@ -0,0 +1,13 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    environment: 'node',
+    coverage: {
+      provider: 'v8',
+      reporter: ['text', 'lcov'],
+      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
+      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
+    },
+  },
+});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --name-only b6f374a3edcdcb4ea1b0b3eeb43d1d3f7d1fd624' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 177ms:
.editorconfig
.eslintrc.cjs
.github/workflows/ship.yml
.node-version
.npmrc
.prettierignore
.prettierrc
CLAUDE.md
_bmad-output/planning-artifacts/adr/0001-auth-provider-supabase.md
_bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md
_bmad-output/planning-artifacts/adr/0012-iac-terraform-over-cdk.md
_bmad-output/planning-artifacts/adr/0013-per-tenant-kek-envelope-encryption.md
_bmad-output/planning-artifacts/adr/0014-pitr-under-dpdpa-erasure.md
_bmad-output/planning-artifacts/adr/0015-stack-correction-azure-firebase-startup-lean.md
_bmad-output/planning-artifacts/adr/README.md
apps/api/package.json
apps/api/src/app.module.ts
apps/api/src/common/filters/global-exception.filter.ts
apps/api/src/health.controller.ts
apps/api/src/main.ts
apps/api/src/tenant-resolver.ts
apps/api/test/health.e2e.test.ts
apps/api/tsconfig.build.json
apps/api/tsconfig.json
docs/db-workflow.md
docs/runbook.md
docs/superpowers/plans/2026-04-18-E2-S1-tenant-rls-scaffolding.md
ops/eslint-rules/goldsmith/index.js
ops/eslint-rules/goldsmith/package.json
ops/eslint-rules/goldsmith/rules/no-raw-shop-id-param.js
ops/eslint-rules/goldsmith/tests/no-raw-shop-id-param.test.js
ops/semgrep/als-boundary-preserved.yaml
ops/semgrep/no-pii-in-logs.yaml
ops/semgrep/no-raw-bullmq-import.yaml
ops/semgrep/no-raw-ioredis-import.yaml
ops/semgrep/no-raw-keyvault-import.yaml
ops/semgrep/no-tenant-id-from-request-input.yaml
ops/semgrep/require-tenant-transaction.yaml
ops/semgrep/tests/no-tenant-id-from-request-input/bad.ts
ops/semgrep/tests/no-tenant-id-from-request-input/ok.ts
ops/semgrep/tests/require-tenant-transaction/bad.ts
ops/semgrep/tests/require-tenant-transaction/ok.ts
package.json
packages/audit/package.json
packages/audit/src/audit-log.ts
packages/audit/src/index.ts
packages/audit/test/audit-log.integration.test.ts
packages/audit/tsconfig.json
packages/cache/package.json
packages/cache/src/index.ts
packages/cache/src/tenant-scoped-cache.ts
packages/cache/test/tenant-scoped-cache.test.ts
packages/cache/tsconfig.json
packages/crypto-envelope/package.json
packages/crypto-envelope/src/envelope.ts
packages/crypto-envelope/src/index.ts
packages/crypto-envelope/src/kms-adapter.ts
packages/crypto-envelope/src/local-kms.ts
packages/crypto-envelope/test/envelope.test.ts
packages/crypto-envelope/tsconfig.json
packages/db/package.json
packages/db/src/codegen/assert-all-tables-marked.test.ts
packages/db/src/codegen/assert-all-tables-marked.ts
packages/db/src/codegen/generate-rls.test.ts
packages/db/src/codegen/generate-rls.ts
packages/db/src/index.ts
packages/db/src/migrate.ts
packages/db/src/migrations/0000_roles.sql
packages/db/src/migrations/0001_initial_schema.sql
packages/db/src/migrations/0002_grants.sql
packages/db/src/provider.ts
packages/db/src/schema/_helpers/helpers.test.ts
packages/db/src/schema/_helpers/platformGlobalTable.ts
packages/db/src/schema/_helpers/registry.ts
packages/db/src/schema/_helpers/tenantScopedTable.ts
packages/db/src/schema/audit-events.ts
packages/db/src/schema/index.ts
packages/db/src/schema/shop-users.ts
packages/db/src/schema/shops.ts
packages/db/src/tx.ts
packages/db/test/poison-default.integration.test.ts
packages/db/test/with-tenant-tx.integration.test.ts
packages/db/tsconfig.json
packages/db/vitest.config.ts
packages/observability/package.json
packages/observability/src/index.ts
packages/observability/src/logger.ts
packages/observability/src/otel.ts
packages/observability/src/pii-redactor.ts
packages/observability/src/sentry.ts
packages/observability/test/pii-redactor.test.ts
packages/observability/tsconfig.json
packages/observability/vitest.config.ts
packages/queue/package.json
packages/queue/src/base-processor.ts
packages/queue/src/index.ts
packages/queue/src/tenant-queue.ts
packages/queue/test/tenant-queue.test.ts
packages/queue/tsconfig.json
packages/tenant-context/package.json
packages/tenant-context/src/als.ts
packages/tenant-context/src/context.ts
packages/tenant-context/src/decorator.ts
packages/tenant-context/src/index.ts
packages/tenant-context/src/interceptor.ts
packages/tenant-context/src/tenant-cache.ts
packages/tenant-context/test/als.test.ts
packages/tenant-context/tsconfig.json
packages/tenant-context/vitest.config.ts
packages/testing/tenant-isolation/fixtures/registry.ts
packages/testing/tenant-isolation/fixtures/tenant-a.ts
packages/testing/tenant-isolation/fixtures/tenant-b.ts
packages/testing/tenant-isolation/fixtures/tenant-c.ts
packages/testing/tenant-isolation/package.json
packages/testing/tenant-isolation/src/endpoint-walker.ts
packages/testing/tenant-isolation/src/harness.ts
packages/testing/tenant-isolation/src/index.ts
packages/testing/tenant-isolation/src/schema-assertions.ts
packages/testing/tenant-isolation/test/endpoint-walker.e2e.test.ts
packages/testing/tenant-isolation/test/harness.integration.test.ts
packages/testing/tenant-isolation/test/schema-assertions.integration.test.ts
packages/testing/tenant-isolation/tsconfig.json
pnpm-lock.yaml
pnpm-workspace.yaml
scripts/db-reset.sh
scripts/tenant-delete.sh
scripts/tenant-provision.sh
tsconfig.base.json
tsconfig.json
turbo.json
vitest.config.ts

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content package.json; Get-Content apps/api/package.json; Get-Content packages/db/src/tx.ts; Get-Content packages/tenant-context/src/als.ts; Get-Content apps/api/src/tenant-resolver.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 230ms:
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
    "vitest": "^1.4.0",
    "@vitest/coverage-v8": "^1.4.0"
  }
}
{
  "name": "@goldsmith/api",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/main.js",
  "exports": {
    ".": "./src/app.module.ts",
    "./src/*": "./src/*.ts"
  },
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
    "@nestjs/testing": "^10.3.0",
    "@types/express": "^4.17.0",
    "@types/supertest": "^6.0.0",
    "supertest": "^7.0.0",
    "vitest": "^1.4.0",
    "typescript": "^5.4.0"
  }
}
import type { Pool, PoolClient } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import { POISON_UUID } from './provider';

export async function withTenantTx<T>(
  pool: Pool,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  const ctx = tenantContext.current();
  if (!ctx) throw new Error('tenant.context_not_set');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_user');
    await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    // Reset session-level shop context to poison default before returning to pool.
    // SET LOCAL is rolled back with the transaction, but any prior session-level
    // SET (e.g. from seed scripts) persists. Explicitly re-poison here so that
    // a recycled connection never leaks tenant state to the next caller.
    await client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
    client.release();
  }
}
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
import { Injectable } from '@nestjs/common';
import type { TenantResolver, RequestLike } from '@goldsmith/tenant-context';

@Injectable()
export class HttpTenantResolver implements TenantResolver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fromHost(_host: string): Promise<string | undefined> { return undefined; }
  fromHeader(req: RequestLike): string | undefined {
    const h = req.headers['x-tenant-id'];
    return typeof h === 'string' ? h : undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fromJwt(_req: RequestLike): string | undefined { return undefined; }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/package.json; Get-Content packages/db/src/provider.ts; Get-Content packages/db/src/migrate.ts; Get-Content packages/db/src/migrations/0000_roles.sql; Get-Content packages/db/src/migrations/0001_initial_schema.sql; Get-Content packages/db/src/migrations/0002_grants.sql' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 255ms:
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
    "test:integration": "vitest run --dir test",
    "build": "pnpm db:assert-marked && tsc --noEmit",
    "db:assert-marked": "tsx src/codegen/assert-all-tables-marked.ts"
  },
  "dependencies": {
    "@goldsmith/observability": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*",
    "drizzle-orm": "^0.30.0",
    "pg": "^8.11.0"
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
import { Pool, type PoolConfig } from 'pg';
import { logger } from '@goldsmith/observability';

export const POISON_UUID = '00000000-0000-0000-0000-000000000000';

export function createPool(config: PoolConfig): Pool {
  const pool = new Pool({
    max: Number(process.env['PG_POOL_MAX'] ?? '10'),
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

// CLI entry point â€” Windows-safe argv check
const invoked = process.argv[1] ?? '';
if (invoked.endsWith('migrate.ts') || invoked.endsWith('migrate.js')) {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  runMigrations(pool, join(process.cwd(), 'packages/db/src/migrations'))
    .then(() => pool.end())
    .catch((e) => { logger.error({ err: e }, 'migration failed'); process.exit(1); });
}
-- 0000_roles.sql â€” DB roles (created before tables, no grants yet)
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
-- runs migrations â€” bootstrapping it inside a migration is circular. This file documents the
-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.

-- Real passwords injected via secrets in deploy; local dev uses docker-compose defaults.
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

-- RLS policies (self-contained here for review; equivalent output from generate-rls.ts).
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
-- 0002_grants.sql â€” privilege grants. Order: roles (0000) â†’ tables (0001) â†’ grants (here).

-- app_user: DML on tenant tables, no DDL
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_users TO app_user;
GRANT SELECT                         ON shops      TO app_user;

-- audit_events: append-only for app_user (invariant 11)
GRANT INSERT, SELECT ON audit_events TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- migrator: DDL only, zero DML on tenant tables (invariant 5)
-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
-- guarded so local dev does not fail.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
    REVOKE ALL ON shops        FROM migrator;
    REVOKE ALL ON shop_users   FROM migrator;
    REVOKE ALL ON audit_events FROM migrator;
  END IF;
END$$;

-- platform_admin: broad access for SECURITY DEFINER functions (used in Story 1.5+)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_admin;

-- Default privileges so future tables automatically flow to app_user via migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/tenant-context/src/context.ts; Get-Content packages/tenant-context/src/interceptor.ts; Get-Content packages/tenant-context/src/tenant-cache.ts; Get-Content packages/tenant-context/src/decorator.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 190ms:
export interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
}

export interface TenantContext {
  readonly shopId: string;
  readonly tenant: Tenant;
  /** @sinceStory 1.1 â€” populated by JWT verification in auth module */
  readonly userId?: string;
  /** @sinceStory 1.1 */
  readonly role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
  /** @sinceStory 1.5 â€” platform-admin impersonation */
  readonly isImpersonating?: boolean;
  /** @sinceStory 1.5 */
  readonly impersonationAuditId?: string;
}
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { from, Observable } from 'rxjs';
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

    if (!shopId) throw new UnauthorizedException('tenant.resolution_failed');
    const tenant: Tenant | undefined = await this.tenants.byId(shopId);
    if (!tenant) throw new UnauthorizedException('tenant.not_found');
    if (tenant.status !== 'ACTIVE') throw new ForbiddenException('tenant.inactive');
    return { shopId: tenant.id, tenant };
  }
}
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
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { tenantContext } from './als';
import type { TenantContext } from './context';

export const TenantContextDec = createParamDecorator(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_: unknown, _ctx: ExecutionContext): TenantContext => tenantContext.requireCurrent(),
);

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/tenant-context/package.json; Get-Content packages/cache/src/tenant-scoped-cache.ts; Get-Content packages/queue/src/tenant-queue.ts; Get-Content packages/queue/src/base-processor.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 217ms:
{
  "name": "@goldsmith/tenant-context",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run --dir src --passWithNoTests",
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

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/app.module.ts; Get-Content apps/api/src/health.controller.ts; Get-Content apps/api/src/main.ts; Get-Content apps/api/src/common/filters/global-exception.filter.ts; Get-Content apps/api/test/health.e2e.test.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 185ms:
import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { HealthController, SKIP_TENANT } from './health.controller';
import { HttpTenantResolver } from './tenant-resolver';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TenantInterceptor, type TenantLookup, type Tenant } from '@goldsmith/tenant-context';

@Injectable()
class NoopTenantLookup implements TenantLookup {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector, inner: TenantInterceptor) =>
        new ConditionalTenantInterceptor(reflector, inner),
      inject: [Reflector, TenantInterceptor],
    },
    { provide: APP_FILTER,      useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
import { Controller, Get, SetMetadata } from '@nestjs/common';

export const SKIP_TENANT = 'skip-tenant';
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const SkipTenant = () => SetMetadata(SKIP_TENANT, true);

@Controller()
export class HealthController {
  @Get('/healthz')
  @SkipTenant()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { initSentry, initOtel, logger } from '@goldsmith/observability';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  initSentry();
  initOtel('goldsmith-api');
  const app = await NestFactory.create(AppModule, { logger: false });
  const port = Number(process.env['PORT'] ?? '3000');
  await app.listen(port, '0.0.0.0');
  logger.info({ port }, 'api listening');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed');
  process.exit(1);
});
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

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/observability/src/logger.ts; Get-Content packages/audit/src/audit-log.ts; Get-Content packages/crypto-envelope/src/envelope.ts; Get-Content packages/crypto-envelope/src/local-kms.ts; Get-Content packages/crypto-envelope/src/kms-adapter.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 596ms:
import pino from 'pino';
import { redactPii } from './pii-redactor';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  formatters: {
    log: (obj) => redactPii(obj),
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-tenant-id"]', '*.password', '*.otp'],
    censor: '[REDACTED:field]',
  },
});
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

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/observability/package.json; Get-Content packages/cache/package.json; Get-Content packages/queue/package.json; Get-Content packages/audit/package.json; Get-Content packages/crypto-envelope/package.json' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 214ms:
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
  "devDependencies": { "vitest": "^1.4.0", "ioredis-mock": "^8.9.0", "@types/ioredis-mock": "^8.2.7", "typescript": "^5.4.0" }
}
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
  "devDependencies": { "vitest": "^1.4.0", "ioredis": "^5.3.0", "typescript": "^5.4.0" }
}
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
    "@goldsmith/tenant-context": "workspace:*",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "testcontainers": "^10.8.0",
    "@testcontainers/postgresql": "^10.8.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.4.0"
  }
}
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
  "dependencies": {},
  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/tsconfig.json; Get-Content packages/audit/tsconfig.json; Get-Content apps/api/tsconfig.json; Get-Content apps/api/tsconfig.build.json' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 197ms:
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "experimentalDecorators": true, "emitDecoratorMetadata": true, "exactOptionalPropertyTypes": false, "outDir": "./dist" },
  "include": ["src/**/*", "test/**/*"]
}
{ "extends": "./tsconfig.json", "exclude": ["**/*.test.ts", "**/*.e2e.test.ts", "test/**/*"] }

2026-04-18T16:14:10.936415Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm -r --if-present typecheck'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm -r --if-present typecheck' in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm -r --if-present typecheck'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/codegen/generate-rls.ts; Get-Content packages/db/src/schema/_helpers/registry.ts; Get-Content packages/db/src/schema/_helpers/tenantScopedTable.ts; Get-Content packages/db/src/schema/_helpers/platformGlobalTable.ts; Get-Content packages/db/src/schema/index.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 216ms:
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tableRegistry } from '../schema/_helpers/registry';

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

// CLI entry point â€” invoked via `tsx src/codegen/generate-rls.ts`
// Uses the same Windows-safe argv[1] check pattern as assert-all-tables-marked.ts.
const invoked = process.argv[1] ?? '';
if (invoked.endsWith('generate-rls.ts') || invoked.endsWith('generate-rls.js')) {
  // Dynamic side-effect import so the pure function above stays clean for tests.
  void import('../schema').then(() => {
    const out = generateRlsSql();
    const target = join(process.cwd(), 'packages/db/src/migrations/__generated__rls.sql');
    writeFileSync(target, out);
    console.log(`wrote ${target}`);
  });
}
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
      throw new Error(`Table "${meta.name}" registered twice â€” use a unique name.`);
    }
    this.byName.set(meta.name, meta);
  }
  list(): TableMeta[] { return [...this.byName.values()]; }
  get(name: string): TableMeta | undefined { return this.byName.get(name); }
  clear(): void { this.byName.clear(); }
}

export const tableRegistry = new TableRegistry();
import { pgTable, uuid, index, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, PgColumnBuilderBase>;

// Drizzle 0.30.x stores columns under a Symbol; expose them via `._` for
// compatibility with the test accessor pattern `t._.columns`.
const drizzleColumnsSymbol = Symbol.for('drizzle:Columns');

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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

  const table = pgTable(
    name,
    {
      shop_id: uuid('shop_id').notNull(),
      ...columns,
    } as C & { shop_id: ReturnType<typeof uuid> },
    (t) => ({
      shopIdIdx: index(`${name}_shop_id_idx`).on((t as Record<string, unknown>).shop_id as never),
    }),
  );

  // Attach `_` accessor so tests (and tooling) can reach `t._.columns`
  const cols = (table as unknown as Record<symbol, Record<string, unknown>>)[drizzleColumnsSymbol]
    ?? Object.fromEntries(Object.keys(table).map((k) => [k, (table as Record<string, unknown>)[k]]));

  Object.defineProperty(table, '_', {
    enumerable: false,
    configurable: true,
    value: { columns: cols },
  });

  return table;
}
import { pgTable, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, PgColumnBuilderBase>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function platformGlobalTable<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
) {
  tableRegistry.register({ name, kind: 'global', encryptedColumns: [] });
  return pgTable(name, columns);
}
export * from './shops';
export * from './shop-users';
export * from './audit-events';
export { tableRegistry } from './_helpers/registry';
export type { TableMeta, TableKind } from './_helpers/registry';

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/schema/shops.ts; Get-Content packages/db/src/schema/shop-users.ts; Get-Content packages/db/src/schema/audit-events.ts; Get-Content packages/db/src/codegen/assert-all-tables-marked.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 186ms:
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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface Violation { file: string; line: number; message: string; }

export function findRawPgTableUsages(source: string, file: string): Violation[] {
  if (file.includes(`${sep}_helpers${sep}`) || file.includes('/_helpers/')) return [];
  const out: Violation[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const code = raw.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/\bpgTable\s*\(/.test(code)) {
      out.push({
        file,
        line: i + 1,
        message: `raw pgTable() forbidden â€” use tenantScopedTable() or platformGlobalTable() from _helpers/`,
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

// Entry-point guard: runs when invoked directly via `tsx src/codegen/assert-all-tables-marked.ts`
// Uses argv[1] path check because import.meta.url may be undefined under esbuild/tsx transforms.
const _argv1 = process.argv[1] ?? '';
const _isMain =
  _argv1.endsWith('assert-all-tables-marked.ts') ||
  _argv1.endsWith('assert-all-tables-marked.js');
if (_isMain) {
  // When invoked via `pnpm run db:assert-marked` from packages/db/, cwd is packages/db.
  // When invoked from the monorepo root (e.g., in CI), cwd is the repo root.
  // Resolve schema dir relative to this file so it works from any cwd.
  const schemaDir = join(
    _argv1.replace(/\\/g, '/').replace(/\/src\/codegen\/assert-all-tables-marked\.(ts|js)$/, ''),
    'src/schema',
  );
  const violations = assertAllTablesMarked(schemaDir);
  if (violations.length > 0) {
    for (const v of violations) console.error(`${v.file}:${v.line} â€” ${v.message}`);
    process.exit(1);
  }
  console.log('OK â€” all tables marked via helpers.');
}

2026-04-18T16:14:28.618329Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Name node_modules\\.bin\\tsc* 2>"'$null'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Name node_modules\\.bin\\tsc* 2>"'$null' in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Name node_modules\\.bin\\tsc* 2>"'$null'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Name node_modules\\.bin\\tsc*" in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 184ms:
tsc
tsc.CMD
tsc.ps1

2026-04-18T16:14:33.698819Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "& .\\node_modules\\.bin\\tsc.CMD -p packages/db/tsconfig.json --noEmit"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "& .\\node_modules\\.bin\\tsc.CMD -p packages/db/tsconfig.json --noEmit" in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "& .\\node_modules\\.bin\\tsc.CMD -p packages/db/tsconfig.json --noEmit"` rejected: blocked by policy
2026-04-18T16:14:36.156383Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node .\\node_modules\\typescript\\bin\\tsc -p packages/db/tsconfig.json --noEmit"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node .\\node_modules\\typescript\\bin\\tsc -p packages/db/tsconfig.json --noEmit" in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "node .\\node_modules\\typescript\\bin\\tsc -p packages/db/tsconfig.json --noEmit"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --stat b6f374a3edcdcb4ea1b0b3eeb43d1d3f7d1fd624' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 194ms:
 .editorconfig                                      |   10 +
 .eslintrc.cjs                                      |   59 +
 .github/workflows/ship.yml                         |  107 +
 .node-version                                      |    1 +
 .npmrc                                             |    3 +
 .prettierignore                                    |    4 +
 .prettierrc                                        |    7 +
 CLAUDE.md                                          |   28 +-
 .../adr/0001-auth-provider-supabase.md             |    2 +-
 .../adr/0005-tenant-context-defense-in-depth.md    |   29 +-
 .../adr/0012-iac-terraform-over-cdk.md             |    2 +-
 .../adr/0013-per-tenant-kek-envelope-encryption.md |   52 +
 .../adr/0014-pitr-under-dpdpa-erasure.md           |   55 +
 ...stack-correction-azure-firebase-startup-lean.md |  128 +
 _bmad-output/planning-artifacts/adr/README.md      |    7 +-
 apps/api/package.json                              |   35 +
 apps/api/src/app.module.ts                         |   48 +
 .../src/common/filters/global-exception.filter.ts  |   13 +
 apps/api/src/health.controller.ts                  |   14 +
 apps/api/src/main.ts                               |   18 +
 apps/api/src/tenant-resolver.ts                    |   14 +
 apps/api/test/health.e2e.test.ts                   |   28 +
 apps/api/tsconfig.build.json                       |    1 +
 apps/api/tsconfig.json                             |    5 +
 docs/db-workflow.md                                |   31 +
 docs/runbook.md                                    |   15 +-
 .../2026-04-18-E2-S1-tenant-rls-scaffolding.md     |  689 +-
 ops/eslint-rules/goldsmith/index.js                |    6 +
 ops/eslint-rules/goldsmith/package.json            |    9 +
 .../goldsmith/rules/no-raw-shop-id-param.js        |   61 +
 .../goldsmith/tests/no-raw-shop-id-param.test.js   |   28 +
 ops/semgrep/als-boundary-preserved.yaml            |   23 +
 ops/semgrep/no-pii-in-logs.yaml                    |   18 +
 ops/semgrep/no-raw-bullmq-import.yaml              |   16 +
 ops/semgrep/no-raw-ioredis-import.yaml             |   17 +
 ops/semgrep/no-raw-keyvault-import.yaml            |   16 +
 ops/semgrep/no-tenant-id-from-request-input.yaml   |   25 +
 ops/semgrep/require-tenant-transaction.yaml        |   23 +
 .../tests/no-tenant-id-from-request-input/bad.ts   |    3 +
 .../tests/no-tenant-id-from-request-input/ok.ts    |    2 +
 .../tests/require-tenant-transaction/bad.ts        |    4 +
 ops/semgrep/tests/require-tenant-transaction/ok.ts |    4 +
 package.json                                       |   34 +
 packages/audit/package.json                        |   24 +
 packages/audit/src/audit-log.ts                    |   35 +
 packages/audit/src/index.ts                        |    1 +
 packages/audit/test/audit-log.integration.test.ts  |   42 +
 packages/audit/tsconfig.json                       |    1 +
 packages/cache/package.json                        |   16 +
 packages/cache/src/index.ts                        |    1 +
 packages/cache/src/tenant-scoped-cache.ts          |   29 +
 packages/cache/test/tenant-scoped-cache.test.ts    |   34 +
 packages/cache/tsconfig.json                       |    1 +
 packages/crypto-envelope/package.json              |   13 +
 packages/crypto-envelope/src/envelope.ts           |   33 +
 packages/crypto-envelope/src/index.ts              |    3 +
 packages/crypto-envelope/src/kms-adapter.ts        |   11 +
 packages/crypto-envelope/src/local-kms.ts          |   41 +
 packages/crypto-envelope/test/envelope.test.ts     |   29 +
 packages/crypto-envelope/tsconfig.json             |    1 +
 packages/db/package.json                           |   30 +
 .../src/codegen/assert-all-tables-marked.test.ts   |   26 +
 .../db/src/codegen/assert-all-tables-marked.ts     |   63 +
 packages/db/src/codegen/generate-rls.test.ts       |   35 +
 packages/db/src/codegen/generate-rls.ts            |   35 +
 packages/db/src/index.ts                           |    5 +
 packages/db/src/migrate.ts                         |   35 +
 packages/db/src/migrations/0000_roles.sql          |   18 +
 packages/db/src/migrations/0001_initial_schema.sql |   69 +
 packages/db/src/migrations/0002_grants.sql         |   35 +
 packages/db/src/provider.ts                        |   25 +
 packages/db/src/schema/_helpers/helpers.test.ts    |   39 +
 .../db/src/schema/_helpers/platformGlobalTable.ts  |   13 +
 packages/db/src/schema/_helpers/registry.ts        |   21 +
 .../db/src/schema/_helpers/tenantScopedTable.ts    |   44 +
 packages/db/src/schema/audit-events.ts             |   16 +
 packages/db/src/schema/index.ts                    |    5 +
 packages/db/src/schema/shop-users.ts               |   19 +
 packages/db/src/schema/shops.ts                    |   15 +
 packages/db/src/tx.ts                              |   30 +
 .../db/test/poison-default.integration.test.ts     |   48 +
 .../db/test/with-tenant-tx.integration.test.ts     |   74 +
 packages/db/tsconfig.json                          |    1 +
 packages/db/vitest.config.ts                       |   18 +
 packages/observability/package.json                |   20 +
 packages/observability/src/index.ts                |    4 +
 packages/observability/src/logger.ts               |   13 +
 packages/observability/src/otel.ts                 |   15 +
 packages/observability/src/pii-redactor.ts         |   31 +
 packages/observability/src/sentry.ts               |   37 +
 packages/observability/test/pii-redactor.test.ts   |   75 +
 packages/observability/tsconfig.json               |    1 +
 packages/observability/vitest.config.ts            |   16 +
 packages/queue/package.json                        |   17 +
 packages/queue/src/base-processor.ts               |   33 +
 packages/queue/src/index.ts                        |    2 +
 packages/queue/src/tenant-queue.ts                 |   29 +
 packages/queue/test/tenant-queue.test.ts           |   21 +
 packages/queue/tsconfig.json                       |    1 +
 packages/tenant-context/package.json               |   20 +
 packages/tenant-context/src/als.ts                 |   18 +
 packages/tenant-context/src/context.ts             |   19 +
 packages/tenant-context/src/decorator.ts           |    8 +
 packages/tenant-context/src/index.ts               |    5 +
 packages/tenant-context/src/interceptor.ts         |   62 +
 packages/tenant-context/src/tenant-cache.ts        |   27 +
 packages/tenant-context/test/als.test.ts           |   30 +
 packages/tenant-context/tsconfig.json              |    1 +
 packages/tenant-context/vitest.config.ts           |   16 +
 .../testing/tenant-isolation/fixtures/registry.ts  |   15 +
 .../testing/tenant-isolation/fixtures/tenant-a.ts  |   30 +
 .../testing/tenant-isolation/fixtures/tenant-b.ts  |   30 +
 .../testing/tenant-isolation/fixtures/tenant-c.ts  |   30 +
 packages/testing/tenant-isolation/package.json     |   30 +
 .../tenant-isolation/src/endpoint-walker.ts        |   26 +
 packages/testing/tenant-isolation/src/harness.ts   |   59 +
 packages/testing/tenant-isolation/src/index.ts     |    6 +
 .../tenant-isolation/src/schema-assertions.ts      |   61 +
 .../test/endpoint-walker.e2e.test.ts               |   11 +
 .../test/harness.integration.test.ts               |   26 +
 .../test/schema-assertions.integration.test.ts     |   25 +
 packages/testing/tenant-isolation/tsconfig.json    |    9 +
 pnpm-lock.yaml                                     | 9603 ++++++++++++++++++++
 pnpm-workspace.yaml                                |    5 +
 scripts/db-reset.sh                                |   16 +
 scripts/tenant-delete.sh                           |   64 +
 scripts/tenant-provision.sh                        |   37 +
 tsconfig.base.json                                 |   23 +
 tsconfig.json                                      |    5 +
 turbo.json                                         |   13 +
 vitest.config.ts                                   |   13 +
 131 files changed, 12840 insertions(+), 546 deletions(-)

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content ops/eslint-rules/goldsmith/package.json; Get-Content ops/eslint-rules/goldsmith/index.js' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 187ms:
{
  "name": "eslint-plugin-goldsmith",
  "version": "0.0.0",
  "private": true,
  "main": "./index.js",
  "scripts": { "test": "node --test tests/*.test.js" },
  "peerDependencies": { "eslint": "^8.57.0" },
  "devDependencies": { "@typescript-eslint/parser": "^7.0.0" }
}
'use strict';
module.exports = {
  rules: {
    'no-raw-shop-id-param': require('./rules/no-raw-shop-id-param'),
  },
};

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Test-Path node_modules\\eslint-plugin-goldsmith; Test-Path ops\\eslint-rules\\goldsmith\\node_modules\\eslint" in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 186ms:
True
True

2026-04-18T16:14:52.361977Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Item node_modules\\eslint-plugin-goldsmith | Format-List *"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Item node_modules\\eslint-plugin-goldsmith | Format-List *" in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Item node_modules\\eslint-plugin-goldsmith | Format-List *"` rejected: blocked by policy
2026-04-18T16:14:56.319276Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path pnpm-lock.yaml -Pattern '"'^  '"\\.:|eslint-plugin-goldsmith' -Context 0,25"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path pnpm-lock.yaml -Pattern '"'^  '"\\.:|eslint-plugin-goldsmith' -Context 0,25" in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path pnpm-lock.yaml -Pattern '"'^  '"\\.:|eslint-plugin-goldsmith' -Context 0,25"` rejected: blocked by policy
2026-04-18T16:14:58.930121Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path pnpm-lock.yaml -Pattern 'eslint-plugin-goldsmith' -Context 3,3"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path pnpm-lock.yaml -Pattern 'eslint-plugin-goldsmith' -Context 3,3" in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path pnpm-lock.yaml -Pattern 'eslint-plugin-goldsmith' -Context 3,3"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'findstr /C:"eslint-plugin-goldsmith" pnpm-lock.yaml' in C:\Alok\Business Projects\Goldsmith-e2-s1
2026-04-18T16:15:01.487536Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.2 seconds
Output:

 exited 1 in 170ms:
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content pnpm-lock.yaml -TotalCount 120' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 191ms:
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    devDependencies:
      '@types/node':
        specifier: ^20.11.0
        version: 20.19.39
      '@typescript-eslint/eslint-plugin':
        specifier: ^7.0.0
        version: 7.18.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint@8.57.1)(typescript@5.9.3)
      '@typescript-eslint/parser':
        specifier: ^7.0.0
        version: 7.18.0(eslint@8.57.1)(typescript@5.9.3)
      '@vitest/coverage-v8':
        specifier: ^1.4.0
        version: 1.6.1(vitest@1.6.1(@types/node@20.19.39))
      eslint:
        specifier: ^8.57.0
        version: 8.57.1
      eslint-import-resolver-typescript:
        specifier: ^3.6.1
        version: 3.10.1(eslint-plugin-import@2.32.0)(eslint@8.57.1)
      eslint-plugin-import:
        specifier: ^2.29.1
        version: 2.32.0(@typescript-eslint/parser@7.18.0(eslint@8.57.1)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@8.57.1)
      prettier:
        specifier: ^3.2.5
        version: 3.8.3
      tsx:
        specifier: ^4.7.0
        version: 4.21.0
      turbo:
        specifier: ^2.0.0
        version: 2.9.6
      typescript:
        specifier: ^5.4.0
        version: 5.9.3
      vitest:
        specifier: ^1.4.0
        version: 1.6.1(@types/node@20.19.39)

  apps/api:
    dependencies:
      '@goldsmith/observability':
        specifier: workspace:*
        version: link:../../packages/observability
      '@goldsmith/tenant-context':
        specifier: workspace:*
        version: link:../../packages/tenant-context
      '@nestjs/common':
        specifier: ^10.3.0
        version: 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
      '@nestjs/core':
        specifier: ^10.3.0
        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
      '@nestjs/platform-express':
        specifier: ^10.3.0
        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)
      reflect-metadata:
        specifier: ^0.2.0
        version: 0.2.2
      rxjs:
        specifier: ^7.8.0
        version: 7.8.2
    devDependencies:
      '@nestjs/testing':
        specifier: ^10.3.0
        version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)(@nestjs/platform-express@10.4.22)
      '@types/express':
        specifier: ^4.17.0
        version: 4.17.25
      '@types/supertest':
        specifier: ^6.0.0
        version: 6.0.3
      supertest:
        specifier: ^7.0.0
        version: 7.2.2
      typescript:
        specifier: ^5.4.0
        version: 5.9.3
      vitest:
        specifier: ^1.4.0
        version: 1.6.1(@types/node@20.19.39)

  ops/eslint-rules/goldsmith:
    dependencies:
      eslint:
        specifier: ^8.57.0
        version: 8.57.1
    devDependencies:
      '@typescript-eslint/parser':
        specifier: ^7.0.0
        version: 7.18.0(eslint@8.57.1)(typescript@5.9.3)

  packages/audit:
    dependencies:
      '@goldsmith/db':
        specifier: workspace:*
        version: link:../db
      '@goldsmith/tenant-context':
        specifier: workspace:*
        version: link:../tenant-context
      pg:
        specifier: ^8.11.0
        version: 8.20.0
    devDependencies:
      '@testcontainers/postgresql':
        specifier: ^10.8.0
        version: 10.28.0
      '@types/pg':
        specifier: ^8.11.0
        version: 8.20.0
      testcontainers:
        specifier: ^10.8.0

2026-04-18T16:15:16.259825Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content scripts/tenant-delete.sh | ForEach-Object {"$i`:$($_)"; $i++} | Select-Object -First 45'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content scripts/tenant-delete.sh | ForEach-Object {"$i`:$($_)"; $i++} | Select-Object -First 45' in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content scripts/tenant-delete.sh | ForEach-Object {"$i`:$($_)"; $i++} | Select-Object -First 45'` rejected: blocked by policy
2026-04-18T16:15:21.022882Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "@'
from pathlib import Path
for i,line in enumerate(Path('scripts/tenant-delete.sh').read_text().splitlines(),1):
    if i<=45: print(f'{i}:{line}')
'@ | python -"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "@'
from pathlib import Path
for i,line in enumerate(Path('scripts/tenant-delete.sh').read_text().splitlines(),1):
    if i<=45: print(f'{i}:{line}')
'@ | python -" in C:\Alok\Business Projects\Goldsmith-e2-s1
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "@'
from pathlib import Path
for i,line in enumerate(Path('scripts/tenant-delete.sh').read_text().splitlines(),1):
    if i<=45: print(f'{i}:{line}')
'@ | python -"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n \".*\" scripts\\tenant-delete.sh" in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 643ms:
1:#!/usr/bin/env bash
2:# Usage: tenant-delete.sh --tenant <uuid> --confirm
3:# MVP scope: deletes DB rows + generates placeholder DPDPA certificate.
4:# Redis flush deferred (no Redis in MVP per ADR-0015). Azure Key Vault deletion deferred.
5:set -euo pipefail
6:
7:TENANT_ID=""; CONFIRM=0
8:while [[ $# -gt 0 ]]; do
9:  case "$1" in
10:    --tenant)  TENANT_ID="$2"; shift 2 ;;
11:    --confirm) CONFIRM=1; shift ;;
12:    *) echo "unknown arg: $1" >&2; exit 2 ;;
13:  esac
14:done
15:[[ -z "$TENANT_ID" ]] && { echo "--tenant required" >&2; exit 2; }
16:[[ $CONFIRM -ne 1 ]] && { echo "--confirm required (MFA + multi-person approval in prod)" >&2; exit 2; }
17:
18:DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/goldsmith_dev}"
19:
20:echo "→ deleting tenant rows from every tenantScopedTable ..."
21:DATABASE_URL="$DB_URL" TENANT_ID="$TENANT_ID" \
22:pnpm --config.engine-strict=false -F @goldsmith/db exec tsx -e "
23:import { createPool, tableRegistry } from '@goldsmith/db';
24:const pool = createPool({ connectionString: process.env.DATABASE_URL });
25:const tenantId = process.env.TENANT_ID;
26:(async () => {
27:  const c = await pool.connect();
28:  try {
29:    await c.query('BEGIN');
30:    await c.query('SET ROLE platform_admin');
31:    for (const m of tableRegistry.list().filter((x) => x.kind === 'tenant')) {
32:      await c.query(\`DELETE FROM \${m.name} WHERE shop_id=\$1\`, [tenantId]);
33:    }
34:    await c.query('DELETE FROM shops WHERE id=\$1', [tenantId]);
35:    await c.query('RESET ROLE');
36:    await c.query('COMMIT');
37:  } catch (e) { await c.query('ROLLBACK'); throw e; }
38:  finally { c.release(); await pool.end(); }
39:})().catch((e) => { console.error(e); process.exit(1); });
40:"
41:
42:echo "→ flushing tenant cache keys ..."
43:echo "  (MVP: no Redis — skipped per ADR-0015. Redis flush will land with Infrastructure Story.)"
44:
45:echo "→ scheduling KEK deletion ..."
46:echo "  (MVP: LocalKMS in-memory — deleted on process exit. Azure Key Vault ScheduleKeyDeletion lands with Infrastructure Story.)"
47:
48:echo "→ generating DPDPA erasure certificate ..."
49:CERT_TXT="certs/dpdpa-erasure-$TENANT_ID-$(date -u +%Y%m%dT%H%M%SZ).txt"
50:mkdir -p certs
51:cat > "$CERT_TXT" <<CERT
52:DPDPA Erasure Certificate — PLACEHOLDER (MVP)
53:
54:Tenant ID: $TENANT_ID
55:Erasure completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
56:Method: Logical deletion of all tenant-scoped rows in Goldsmith Postgres.
57:Residual: Per ADR-0014, non-encrypted columns may be restorable from PITR
58:backups for up to 7 calendar days via restricted break-glass procedure.
59:
60:Signed: (placeholder — full PDF certificate issued in Story 1.5 when
61:platform-admin console + DPO sign-off flow lands)
62:CERT
63:
64:echo "✓ tenant $TENANT_ID deleted; certificate at $CERT_TXT"

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'findstr /n "goldsmith" .eslintrc.cjs package.json' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 670ms:
.eslintrc.cjs:5:  plugins: ['@typescript-eslint', 'import', 'goldsmith'],
.eslintrc.cjs:16:    'goldsmith/no-raw-shop-id-param': 'error',
package.json:2:  "name": "goldsmith",

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content ops/semgrep/require-tenant-transaction.yaml; Get-Content ops/semgrep/no-tenant-id-from-request-input.yaml; Get-Content ops/semgrep/als-boundary-preserved.yaml; Get-Content ops/semgrep/no-pii-in-logs.yaml' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 1463ms:
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

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content ops/semgrep/no-raw-ioredis-import.yaml; Get-Content ops/semgrep/no-raw-bullmq-import.yaml; Get-Content ops/semgrep/no-raw-keyvault-import.yaml' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 1071ms:
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
        - "packages/queue/**"
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
rules:
  - id: goldsmith.no-raw-keyvault-import
    languages: [typescript]
    severity: ERROR
    message: |
      Direct import of @azure/keyvault-keys or @azure/keyvault-secrets is forbidden outside
      packages/crypto-envelope. Use the envelope helpers so column-level encryption consistently
      uses per-tenant KEKs (ADR-0013, ADR-0015).
    patterns:
      - pattern-either:
          - pattern: import $...X from '@azure/keyvault-keys'
          - pattern: import { $...X } from '@azure/keyvault-keys'
          - pattern: import $...X from '@azure/keyvault-secrets'
          - pattern: import { $...X } from '@azure/keyvault-secrets'
    paths:
      exclude: ["packages/crypto-envelope/**"]

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n \".*\" packages\\tenant-context\\package.json; findstr /n \".*\" packages\\observability\\package.json; findstr /n \".*\" apps\\api\\package.json" in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 888ms:
1:{
2:  "name": "@goldsmith/tenant-context",
3:  "version": "0.0.0",
4:  "private": true,
5:  "main": "./src/index.ts",
6:  "scripts": {
7:    "typecheck": "tsc --noEmit",
8:    "lint": "eslint src test",
9:    "test": "vitest run",
10:    "test:unit": "vitest run --dir src --passWithNoTests",
11:    "test:integration": "vitest run --dir test"
12:  },
13:  "dependencies": {
14:    "@nestjs/common": "^10.3.0",
15:    "@nestjs/core": "^10.3.0",
16:    "ioredis": "^5.3.0"
17:  },
18:  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" },
19:  "peerDependencies": { "rxjs": "^7.8.0", "reflect-metadata": "^0.2.0" }
20:}
1:{
2:  "name": "@goldsmith/observability",
3:  "version": "0.0.0",
4:  "private": true,
5:  "main": "./src/index.ts",
6:  "scripts": {
7:    "typecheck": "tsc --noEmit",
8:    "lint": "eslint src test",
9:    "test": "vitest run",
10:    "test:unit": "vitest run"
11:  },
12:  "dependencies": {
13:    "@opentelemetry/api": "^1.8.0",
14:    "@opentelemetry/sdk-node": "^0.51.0",
15:    "@opentelemetry/auto-instrumentations-node": "^0.43.0",
16:    "@sentry/node": "^7.109.0",
17:    "pino": "^8.19.0"
18:  },
19:  "devDependencies": { "vitest": "^1.4.0", "typescript": "^5.4.0" }
20:}
1:{
2:  "name": "@goldsmith/api",
3:  "version": "0.0.0",
4:  "private": true,
5:  "main": "./dist/main.js",
6:  "exports": {
7:    ".": "./src/app.module.ts",
8:    "./src/*": "./src/*.ts"
9:  },
10:  "scripts": {
11:    "typecheck": "tsc --noEmit",
12:    "lint": "eslint src test",
13:    "test": "vitest run",
14:    "test:integration": "vitest run --dir test",
15:    "build": "tsc -p tsconfig.build.json",
16:    "start": "node dist/main.js"
17:  },
18:  "dependencies": {
19:    "@nestjs/common": "^10.3.0",
20:    "@nestjs/core": "^10.3.0",
21:    "@nestjs/platform-express": "^10.3.0",
22:    "reflect-metadata": "^0.2.0",
23:    "rxjs": "^7.8.0",
24:    "@goldsmith/tenant-context": "workspace:*",
25:    "@goldsmith/observability": "workspace:*"
26:  },
27:  "devDependencies": {
28:    "@nestjs/testing": "^10.3.0",
29:    "@types/express": "^4.17.0",
30:    "@types/supertest": "^6.0.0",
31:    "supertest": "^7.0.0",
32:    "vitest": "^1.4.0",
33:    "typescript": "^5.4.0"
34:  }
35:}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/observability/src/pii-redactor.ts; Get-Content packages/observability/src/sentry.ts; Get-Content packages/observability/src/otel.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 667ms:
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
  // Error, Date, Buffer, class instances, Map, Set, Symbol â€” preserve as-is.
  return input;
}
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/test/with-tenant-tx.integration.test.ts; Get-Content packages/db/test/poison-default.integration.test.ts; Get-Content packages/audit/test/audit-log.integration.test.ts' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 1251ms:
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
    // Fresh conn, no tenant set â†’ poison-default. Must SET ROLE app_user so RLS applies
    // (superusers bypass RLS even with FORCE; app_user is NOBYPASSRLS).
    const c = await pool.connect();
    await c.query('SET ROLE app_user');
    const { rows } = await c.query('SELECT * FROM shop_users');
    expect(rows).toHaveLength(0);
    await c.query('RESET ROLE');
    c.release();
  });
});
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
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { createPool, runMigrations } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import { auditLog } from '../src/audit-log';

const A = '11111111-1111-1111-1111-111111111111';
let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  // Resolve from this file's location up two levels to monorepo root, then into packages/db
  const migrationsDir = resolve(__dirname, '../../db/src/migrations');
  await runMigrations(pool, migrationsDir);
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
    await c.query(`SET ROLE app_user; SET app.current_shop_id='${A}';`);
    const { rows } = await c.query('SELECT action FROM audit_events');
    expect(rows.some((r: { action: string }) => r.action === 'test.happened')).toBe(true);
    await c.query('RESET ROLE');
    c.release();
  });

  it('throws outside a tenant context', async () => {
    await expect(auditLog(pool, { action: 'x', subjectType: 'y' })).rejects.toThrow(/tenant\.context_not_set/);
  });
});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n \".*\" packages\\tenant-context\\src\\interceptor.ts" in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 549ms:
1:import {
2:  Injectable,
3:  type CallHandler,
4:  type ExecutionContext,
5:  type NestInterceptor,
6:  ForbiddenException,
7:  UnauthorizedException,
8:} from '@nestjs/common';
9:import { from, Observable } from 'rxjs';
10:import { switchMap } from 'rxjs/operators';
11:import { tenantContext } from './als';
12:import type { TenantContext, Tenant } from './context';
13:import type { TenantLookup } from './tenant-cache';
14:
15:export interface RequestLike {
16:  headers: Record<string, string | string[] | undefined>;
17:  hostname?: string;
18:  path?: string;
19:}
20:
21:export interface TenantResolver {
22:  fromHost(host: string): Promise<string | undefined>;
23:  fromHeader(req: RequestLike): string | undefined;
24:  fromJwt(req: RequestLike): string | undefined;
25:}
26:
27:@Injectable()
28:export class TenantInterceptor implements NestInterceptor {
29:  constructor(
30:    private readonly resolver: TenantResolver,
31:    private readonly tenants: TenantLookup,
32:  ) {}
33:
34:  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
35:    return from(this.resolve(ctx)).pipe(switchMap((tc) =>
36:      new Observable<unknown>((sub) => {
37:        tenantContext.runWith(tc, () => {
38:          const inner = next.handle().subscribe({
39:            next: (v) => sub.next(v),
40:            error: (e) => sub.error(e),
41:            complete: () => sub.complete(),
42:          });
43:          return () => inner.unsubscribe();
44:        });
45:      }),
46:    ));
47:  }
48:
49:  private async resolve(ctx: ExecutionContext): Promise<TenantContext> {
50:    const req = ctx.switchToHttp().getRequest<RequestLike>();
51:    let shopId: string | undefined;
52:    if (req.hostname) shopId = await this.resolver.fromHost(req.hostname);
53:    shopId ??= this.resolver.fromHeader(req);
54:    shopId ??= this.resolver.fromJwt(req);
55:
56:    if (!shopId) throw new UnauthorizedException('tenant.resolution_failed');
57:    const tenant: Tenant | undefined = await this.tenants.byId(shopId);
58:    if (!tenant) throw new UnauthorizedException('tenant.not_found');
59:    if (tenant.status !== 'ACTIVE') throw new ForbiddenException('tenant.inactive');
60:    return { shopId: tenant.id, tenant };
61:  }
62:}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'findstr /n ".*" package.json | findstr /n "devDependencies eslint-plugin"' in C:\Alok\Business Projects\Goldsmith-e2-s1
 succeeded in 534ms:
20:20:  "devDependencies": {
22:22:    "@typescript-eslint/eslint-plugin": "^7.0.0",
26:26:    "eslint-plugin-import": "^2.29.1",

codex
The patch introduces runtime packaging and CI lint configuration issues that will block starting the built API or running lint on a clean install. It also contains tenant-context/RLS handling bugs in newly added infrastructure code.

Full review comments:

- [P1] Point runtime entries at built JavaScript — C:\Alok\Business Projects\Goldsmith-e2-s1\packages\tenant-context\package.json:5-5
  When the API is built and started with `node dist/main.js`, its workspace dependencies are resolved through their package `main` fields; pointing `@goldsmith/tenant-context` (and the other internal packages using the same pattern) at `./src/index.ts` means plain Node will try to load TypeScript source after build and fail instead of starting the service. Please emit/package these libraries to `dist` or run the API with a TS loader consistently.

- [P1] Declare the custom ESLint plugin at the root — C:\Alok\Business Projects\Goldsmith-e2-s1\.eslintrc.cjs:5-5
  This root config requires `eslint-plugin-goldsmith`, but the root importer in `package.json`/`pnpm-lock.yaml` does not depend on the workspace plugin package. On a clean frozen install in CI, ESLint resolves plugins relative to this root config and will fail with a missing `eslint-plugin-goldsmith` module before linting any package.

- [P2] Return the inner subscription teardown — C:\Alok\Business Projects\Goldsmith-e2-s1\packages\tenant-context\src\interceptor.ts:37-44
  For tenant-scoped requests whose handler returns a long-lived or cancellable Observable, the outer Observable currently drops the teardown returned inside `runWith`, so unsubscribing the request does not unsubscribe `next.handle()`. Returning the `tenantContext.runWith(...)` result from this subscribe callback preserves cancellation and avoids leaking work after client disconnects.

- [P2] Seed RLS context before tenant deletion — C:\Alok\Business Projects\Goldsmith-e2-s1\scripts\tenant-delete.sh:29-32
  When deleting a tenant that has rows in tenant-scoped tables, `SET ROLE platform_admin` still does not bypass the forced RLS policies because the role is created with `NOBYPASSRLS`; without setting `app.current_shop_id` to `tenantId`, the loop cannot see or delete those rows, and the subsequent `DELETE FROM shops` will hit the `ON DELETE RESTRICT` references or leave tenant data behind. Set the transaction-local tenant GUC before deleting, or use an explicitly audited bypass path.
The patch introduces runtime packaging and CI lint configuration issues that will block starting the built API or running lint on a clean install. It also contains tenant-context/RLS handling bugs in newly added infrastructure code.

Full review comments:

- [P1] Point runtime entries at built JavaScript — C:\Alok\Business Projects\Goldsmith-e2-s1\packages\tenant-context\package.json:5-5
  When the API is built and started with `node dist/main.js`, its workspace dependencies are resolved through their package `main` fields; pointing `@goldsmith/tenant-context` (and the other internal packages using the same pattern) at `./src/index.ts` means plain Node will try to load TypeScript source after build and fail instead of starting the service. Please emit/package these libraries to `dist` or run the API with a TS loader consistently.

- [P1] Declare the custom ESLint plugin at the root — C:\Alok\Business Projects\Goldsmith-e2-s1\.eslintrc.cjs:5-5
  This root config requires `eslint-plugin-goldsmith`, but the root importer in `package.json`/`pnpm-lock.yaml` does not depend on the workspace plugin package. On a clean frozen install in CI, ESLint resolves plugins relative to this root config and will fail with a missing `eslint-plugin-goldsmith` module before linting any package.

- [P2] Return the inner subscription teardown — C:\Alok\Business Projects\Goldsmith-e2-s1\packages\tenant-context\src\interceptor.ts:37-44
  For tenant-scoped requests whose handler returns a long-lived or cancellable Observable, the outer Observable currently drops the teardown returned inside `runWith`, so unsubscribing the request does not unsubscribe `next.handle()`. Returning the `tenantContext.runWith(...)` result from this subscribe callback preserves cancellation and avoids leaking work after client disconnects.

- [P2] Seed RLS context before tenant deletion — C:\Alok\Business Projects\Goldsmith-e2-s1\scripts\tenant-delete.sh:29-32
  When deleting a tenant that has rows in tenant-scoped tables, `SET ROLE platform_admin` still does not bypass the forced RLS policies because the role is created with `NOBYPASSRLS`; without setting `app.current_shop_id` to `tenantId`, the loop cannot see or delete those rows, and the subsequent `DELETE FROM shops` will hit the `ON DELETE RESTRICT` references or leave tenant data behind. Set the transaction-local tenant GUC before deleting, or use an explicitly audited bypass path.
