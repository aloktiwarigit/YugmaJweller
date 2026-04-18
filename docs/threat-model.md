---
title: Goldsmith — Threat Model (STRIDE)
status: v1 — Sprint-1 gate draft
author: Alokt (Principal Architect) · facilitated via Claude
date: 2026-04-17
reviewCadence: Before every new surface goes live; quarterly otherwise
supersedes: none
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md (126 FRs + 70 NFRs)
  - _bmad-output/planning-artifacts/architecture.md (12 ADRs, 14 bounded contexts)
  - _bmad-output/planning-artifacts/adr/0002-multi-tenant-single-db-rls.md
  - _bmad-output/planning-artifacts/adr/0005-tenant-context-defense-in-depth.md
  - _bmad-output/planning-artifacts/adr/0011-compliance-package-hard-block-gateway.md
  - C:/Alok/Business Projects/Goldsmith/CLAUDE.md (engineering rules)
---

# Goldsmith — Threat Model (STRIDE)

> **Gate status:** Required artifact for the Greenfield Protocol. This is the Sprint-1 draft — thorough enough to direct Sprint 1 work, not exhaustive penetration research. It is a **living document**. Revise before every new trust boundary goes live and quarterly otherwise.

## 1. Purpose & Scope

Goldsmith is a multi-tenant white-label jewellery platform for traditional Hindi-belt Indian jewellers. It carries physical-gold commerce, multi-lakh-rupee transactions, regulated compliance surfaces (Section 269ST cash cap, PMLA, PAN Rule 114B, BIS HUID, DPDPA), and zero-cross-tenant-leakage as a non-negotiable brand promise. A security failure in this system has four distinct blast radii:

1. **Financial** — transaction tampering, rate-lock deposit theft, payment webhook forgery
2. **Physical** — try-at-home inventory is real gold; fraud risk is material
3. **Regulatory** — a single Section 269ST breach is a statutory violation; a PMLA miss can trigger FIU reporting investigation; a DPDPA breach is a Data Protection Board matter
4. **Brand/tenancy** — one cross-tenant data leak ends the platform-viability thesis (white-label multi-tenant is the only business model)

This document applies the STRIDE framework (Spoofing / Tampering / Repudiation / Information Disclosure / Denial of Service / Elevation of Privilege) across six trust boundaries, inventories the top assets, maps threats to existing architectural controls, and identifies mitigations that must ship with Sprint 1.

**Out of scope for v1:** Red-team engagement findings, supply-chain compromise beyond high-level vendor vetting, nation-state actors targeting individual tenants. External pentest is contractually required before onboarding the 2nd tenant (see §9).

## 2. System Context & Trust Boundaries

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                               PUBLIC INTERNET                                 │
└───────────────────────────────────────────────────────────────────────────────┘
  [Customer mobile RN]   [Customer web Next.js]   [Shopkeeper mobile RN]   [Admin web]
         │                      │                          │                    │
         │    === TB-1: Client ↔ API Gateway (TLS 1.3 + JWT) ===               │
         ▼                      ▼                          ▼                    ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                         API GATEWAY (NestJS)                                │
  │   · tenant_id resolver (host header + JWT claim) · rate limit · WAF         │
  │   · compliance hard-block gateway (269ST / PAN / PMLA / GST / HUID)         │
  └─────────────────────────────────────────────────────────────────────────────┘
         │
         │    === TB-2: Gateway ↔ Application Services (in-process, VPC) ===
         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │          APPLICATION SERVICES (NestJS modular monolith)                     │
  │   · auth · catalogue · orders · rate-lock · try-at-home · invoicing         │
  │   · loyalty · customer-analytics · admin · tenant-provisioning              │
  └─────────────────────────────────────────────────────────────────────────────┘
         │                   │                      │                    │
         │                   │                      │                    │
         │  === TB-3: App ↔ Database (RLS + separate roles) ===           │
         │  === TB-4: App ↔ Vendors (HTTPS + HMAC webhooks) ===           │
         │  === TB-5: Mobile offline store ↔ Sync service ===             │
         │  === TB-6: Admin console ↔ cross-tenant support data ===       │
         ▼                   ▼                      ▼                    ▼
     PostgreSQL 15        Redis cache           BullMQ queue         Vendor APIs
     (RLS + app role)     (tenant-scoped       (tenant_id in        (Razorpay,
                           keys)                 every job)          Cashfree,
                                                                     AiSensy BSP,
                                                                     MSG91, IBJA,
                                                                     Surepass,
                                                                     Firebase FCM)
```

**Six trust boundaries (TB):**

| TB | Boundary | Authentication | Authorization |
|----|----------|----------------|----------------|
| 1 | Client ↔ API Gateway | Phone OTP → JWT (Supabase/Firebase Auth) | JWT claim + tenant_id from host |
| 2 | Gateway ↔ App services | In-process; AsyncLocalStorage tenant ctx | Role + scope check in service layer |
| 3 | App ↔ Database | PostgreSQL app role (non-bypassing) | Row-level security (RLS) on every tenant-scoped table |
| 4 | App ↔ Vendors | API keys per vendor, stored in AWS Secrets Manager | HMAC-signed webhooks (Razorpay, Cashfree), TLS pinning for AiSensy |
| 5 | Mobile offline store ↔ Sync | WatermelonDB encrypted at rest; JWT for sync | Last-write-wins with server-authoritative tenant_id enforcement |
| 6 | Admin console ↔ cross-tenant | Platform-team SSO (MFA required) | Role-based access with audit logging on every read |

## 3. Threat Actors

| Actor | Motivation | Capability | Likelihood |
|-------|------------|------------|------------|
| **External attacker** (opportunistic) | Steal PII, commit fraud, extort | Public tools, credential-stuffing, automated scanners | HIGH |
| **Malicious tenant** (hostile jeweller) | Cross-tenant competitive data theft, scrape other tenants' customers/rates | Authenticated API access, knowledge of product model | MEDIUM |
| **Disgruntled insider** (shop staff, platform ops) | Data exfiltration, fraudulent invoice voids, inventory theft via try-at-home | Legitimate credentials + shop-floor physical access | MEDIUM |
| **Fraudulent customer** | Try-at-home fraud, fake rate-lock deposit disputes, chargeback abuse | Verified account, WhatsApp history, KYC-passable | HIGH |
| **Compromised vendor** | Supply-chain injection via Razorpay/AiSensy/MSG91/Surepass | Webhook-level write access, OTP visibility | LOW-MEDIUM |
| **Regulatory entity** (exercising investigation powers) | Lawful access to transaction history, customer PII | Subpoena / FIU-IND notice | LOW-MEDIUM |
| **State-level actor** | Targeted surveillance of specific customer/jeweller | Advanced persistent, potentially vendor-cooperative | LOW (out of v1 scope) |

## 4. Asset Inventory (prioritized by blast radius)

| Rank | Asset | Classification | Blast radius if compromised |
|------|-------|----------------|-----------------------------|
| 1 | Multi-tenant data boundary (shop_id RLS) | Platform-existential | Platform brand death — single leak ends viability |
| 2 | Section 269ST cash-cap hard-block | Regulatory-existential | Statutory violation, criminal liability for jeweller |
| 3 | Weight (DECIMAL 10,3) and money (paise integers) precision | Financial-existential | Accumulating rounding = Rs lakhs over 10k txns |
| 4 | Payment gateway integration (Razorpay/Cashfree) | Financial-high | Direct monetary theft |
| 5 | Rate-lock deposits (Rs 5,000 × N customers) | Financial-high | Direct monetary theft, customer trust collapse |
| 6 | Try-at-home inventory (physical gold) | Physical-high | Gold theft; insurance claim disputes |
| 7 | PAN + KYC data (DPDPA) | Regulatory-high | Data Protection Board investigation |
| 8 | OTP session (phone auth) | Auth-high | Account takeover |
| 9 | HUID product authenticity | Brand-medium | Counterfeit sold as certified → BIS complaint |
| 10 | Gold rate feed (IBJA) integrity | Financial-medium | Tenant-wide mispricing |
| 11 | WhatsApp conversation history | PII-medium | DPDPA breach, family-share screenshots leaked |
| 12 | Customer viewing analytics (shopkeeper intel) | Competitive-medium | Scraping + resale |
| 13 | PMLA cumulative cash tracking | Regulatory-medium | FIU-IND CTR filing failure |
| 14 | White-label brand config (logo, colors) | Brand-medium | Tenant impersonation for phishing |
| 15 | Shopkeeper staff permissions | Authorization-medium | Unauthorized supervisor-override on 269ST |

## 5. STRIDE Analysis by Trust Boundary

### 5.1 TB-1 · Client ↔ API Gateway

| STRIDE | Threat | Existing control | Residual risk | Sprint-1 mitigation |
|--------|--------|------------------|---------------|----------------------|
| **S** | Attacker spoofs shopkeeper via SIM-swap or SS7-intercepted OTP | MSG91 OTP + Supabase/Firebase JWT (TB-1) | MEDIUM — SIM-swap is endemic in Indian telecom | **S1-M1:** Re-OTP required for Rs-2L+ actions (rate-lock, void, refund); device-binding token stored in WatermelonDB; "new device" SMS + WhatsApp notification via AiSensy to existing number on every fresh login |
| **S** | Tenant A gets tenant B's JWT (URL leakage, misconfigured browser share) | JWT bound to `tenant_id` claim + host header cross-check | LOW | Keep JWT in memory-only (not localStorage) for web; rotate tenant keys on admin role change |
| **T** | Client-side tampering of invoice totals before POST | Server recomputes all monetary totals from authoritative rate + weight; ignores client totals | LOW | Semgrep rule blocking `req.body.total` from flowing into DB write; integration test with tampered payload |
| **T** | Query-param/header injection for tenant_id bypass | `tenant_id` is resolved server-side from JWT + host — never from any user-supplied param | LOW-MED | **S1-M2:** Semgrep `no-tenant-id-from-request-input` rule in CI; unit tests asserting 403 on injection |
| **R** | Shopkeeper voids invoice then denies it | NestJS audit logger writes immutable audit trail (append-only `audit_log` table, no DELETE grant) | LOW | Audit log review in weekly ops; append-only constraint enforced at DB grant level, not app level |
| **I** | OTP leakage via SMS screen-notification on shared phone | MSG91 OTP masking (partial reveal) + 5-minute TTL | MEDIUM — shared family phones common | **S1-M3:** Out-of-band alert via WhatsApp whenever OTP sent; shopkeeper can revoke all sessions from "Devices" screen |
| **I** | Rate-limiting-bypass scraping of customer PII via public product endpoints | Cloudflare WAF + per-IP rate limit + per-tenant rate limit | LOW-MED | **S1-M4:** Customer endpoints return only public product data (no PII); wishlist/reviews require auth; `shop_id` filter hard-enforced at gateway |
| **D** | OTP-flood costs tenant (MSG91 Rs 0.18 × millions) | MSG91 account-level rate limit + per-phone cool-down (60s) | LOW-MED | **S1-M5:** Circuit-breaker on OTP endpoint with sliding-window count; alert to Sentry on anomaly |
| **D** | Slowloris / connection-flood DoS on NestJS | AWS ALB connection limits + Cloudflare | LOW | Standard cloud-native protections |
| **E** | JWT role claim tampering (e.g., client edits JWT to add `role: supervisor`) | JWT HMAC/RSA signature verify + short TTL (15min access / 7d refresh) | LOW | Refresh-token rotation on every issue; blocklist on suspected leak |

### 5.2 TB-2 · Gateway ↔ Application Services

| STRIDE | Threat | Existing control | Residual risk | Sprint-1 mitigation |
|--------|--------|------------------|---------------|----------------------|
| **S** | Internal module A masquerades as module B | In-process; no cross-module auth | N/A | Process-level isolation inherent in monolith |
| **T** | AsyncLocalStorage tenant context dropped mid-request | ADR-0005 mandates AsyncLocalStorage enforcement in every async boundary | MED — easy to break via new library not aware of pattern | **S1-M6:** Semgrep rule flagging `async`/`await`/`Promise.all` patterns without `TenantContext.runWith()` wrap in service layer; integration test that exercises every controller with tenant injection assertion |
| **T** | BullMQ job executes without tenant_id | Convention: every queued job payload MUST include tenant_id; interceptor re-injects AsyncLocalStorage context from payload | MED | **S1-M7:** BullMQ wrapper class that makes tenant_id a required constructor param; failure to pass = compile-time TypeScript error |
| **R** | Service-level action (e.g., price-override) attributed to wrong user | Audit log includes user_id, tenant_id, action, before/after state | LOW | Audit log schema includes `correlation_id` tracked from API layer through all downstream jobs |
| **I** | Log output leaks PII (PAN, phone numbers, customer names) | NestJS logger has PII-scrubbing middleware; Sentry DSN scrubs `pan`, `phone`, `email` | LOW-MED — easy to break when adding new fields | **S1-M8:** Semgrep rule flagging any `console.log` or `logger.info` calls with known-PII field names; CI test that ships a sample payload through logger and asserts scrubbed output |
| **D** | Memory leak or unbounded query locks the monolith | Query timeout at DB driver; Node `--max-old-space-size`; ECS restart policy | LOW | Standard container-level protections |
| **E** | Service accidentally elevates role by reading JWT before middleware ran | Middleware order enforced in NestJS bootstrap; unit test asserts order | LOW | Type-level separation: `UnauthenticatedRequest` vs `AuthenticatedRequest` types |

### 5.3 TB-3 · Application ↔ Database (the tenant boundary — CRITICAL)

| STRIDE | Threat | Existing control | Residual risk | Sprint-1 mitigation |
|--------|--------|------------------|---------------|----------------------|
| **S** | App connects as superuser, bypasses RLS | App role is `app_user` with `NOSUPERUSER NOBYPASSRLS`; migrations run as separate `migrator` role | LOW | ADR-0002 enforced; CI verifies `pg_roles` on every deploy |
| **T** | Developer writes raw SQL that omits tenant_id WHERE clause | RLS policy on every tenant-scoped table forces `shop_id = current_setting('app.tenant_id')::uuid` | LOW — RLS is the backstop | **S1-M9:** Drizzle schema marker (e.g., `.tenantScoped()`) that generates RLS assertion in migration; automated test that confirms every table with `shop_id` column has a corresponding RLS policy |
| **T** | Redis cache key omits tenant_id, serves tenant A's data to tenant B | Redis cache keys MUST prefix with `t:{tenant_id}:`; wrapper class enforces | MED | **S1-M10:** No direct `redis.get/set` — only `TenantScopedCache.get/set(tenantId, key, val)`; Semgrep rule flagging raw ioredis import outside the wrapper module |
| **R** | Row updated with no audit trace (missing `updated_by`) | `updated_by`, `updated_at` columns required on every write; Drizzle template enforces | LOW | Audit trigger-based approach evaluated in ADR-0002 (not chosen due to overhead); column-level enforcement sufficient |
| **I** | Backup data leaked (S3 bucket misconfigured) | S3 bucket policy: block public access, KMS-encrypted, AWS CloudTrail on every GET | LOW | **S1-M11:** Semgrep rule on Terraform forbidding `acl = "public-read"`; AWS Config rule enforcing encryption |
| **I** | Read replica misconfigured, leaks across tenants | Read replica inherits RLS; same `app_user` role | LOW | |
| **I** | Developer runs ad-hoc query in prod with elevated role | Prod DB access is break-glass-only via AWS Session Manager; every action logged | LOW-MED | Break-glass access requires ticket + MFA + time-bound credentials (Vanta / manual audit initially) |
| **D** | Expensive query with no tenant filter locks DB | Query timeout (30s app, 5s read replica); per-tenant query budget via BullMQ | LOW-MED | **S1-M12:** Slow-query alerting in PostgreSQL; per-tenant query counter surfaces to Sentry |
| **E** | App exploits weak `CREATE FUNCTION` or `CREATE EXTENSION` to bypass RLS | `app_user` has no `CREATE` rights; extensions gated to `migrator` role | LOW | |

### 5.4 TB-4 · Application ↔ Vendors

| STRIDE | Threat | Existing control | Residual risk | Sprint-1 mitigation |
|--------|--------|------------------|---------------|----------------------|
| **S** | Razorpay webhook forged to inject fake payment | HMAC signature verified via Razorpay's secret on every webhook | LOW | Adapter pattern ADR-0006; integration test with forged sig asserts 401 |
| **S** | AiSensy WhatsApp BSP compromised — attacker sends invoice-like messages as tenant | BSP credentials scoped per-tenant; templates pre-approved by Meta | MED | **S1-M13:** WhatsApp message audit log — every template send recorded with template_id, recipient_id, tenant_id; alert on unusual template-usage spike |
| **S** | MSG91 SMS compromised, OTP visible to vendor insiders | Not controllable — OTP is in plaintext SMS | MED-HIGH (vendor insider) | Partially mitigated by short TTL + 3-try limit + device-binding on first login; ACCEPT RESIDUAL per §8 |
| **T** | Razorpay webhook payload tampered between vendor and us | HMAC signature on body; TLS 1.3 | LOW | |
| **T** | IBJA gold rate feed compromised, tenants price at wrong rate | Rate-fetcher pulls IBJA + Metals.dev and flags divergence >0.5%; freezes pricing and alerts ops | LOW-MED | **S1-M14:** Rate-integrity gate — block new rate-locks if divergence unreconciled for >30min; manual override by platform ops only |
| **T** | Surepass HUID verification response forged, customer sold counterfeit as certified | Surepass signs responses; we verify; fallback to BIS direct-verify-portal link for user trust | LOW-MED | Adapter pattern ADR-0006; contract test against Surepass sandbox weekly |
| **R** | Razorpay payment completed but webhook never delivered | Payment status polled every 60s for rate-lock-pending orders; reconciliation job nightly | LOW | |
| **I** | Vendor credentials in source code or logs | AWS Secrets Manager; `.env` in gitignore; pre-commit hook scans for AWS key patterns | LOW | Pre-commit + CI scanners (truffleHog, gitleaks) |
| **I** | FCM push notification body reveals PII | FCM payload is minimal: `{notification_id, type}`; client fetches details via authenticated API | LOW | |
| **D** | IBJA rate API downtime during peak wedding-season trading | Metals.dev fallback; last-known-rate cached 5min; graceful degradation (rate-lock disabled with user banner, UI clearly states "rates temporarily unavailable") | MED | **S1-M15:** Vendor-health dashboard surfaces IBJA/Metals.dev/Razorpay/Cashfree/AiSensy/MSG91 status; operational runbook for each vendor outage |
| **D** | MSG91 OTP delivery SLA breached during wedding season | Fallback to Firebase Auth phone (uses Google's SMS); manual voice-call backup | LOW-MED | |
| **E** | Vendor integration granted more scope than needed (e.g., Razorpay can issue refunds when we only need charge capture) | Scope least-privilege: per-integration API key with minimum scopes | LOW | |

### 5.5 TB-5 · Mobile offline store ↔ Sync service

| STRIDE | Threat | Existing control | Residual risk | Sprint-1 mitigation |
|--------|--------|------------------|---------------|----------------------|
| **S** | Stolen device used to push fraudulent sync | Device-binding token + JWT expiry (7d max on refresh) | MED | **S1-M16:** "Remote logout" from shop admin; WhatsApp notification on new device login; biometric lock for shopkeeper app beyond 15 min idle |
| **T** | Offline-created invoice tampered before sync | All weight + money values DECIMAL, server re-validates rate at sync time vs time-of-creation rate within ±2% tolerance | LOW | ADR-0004 offline-sync protocol |
| **T** | Clock skew on device creates back-dated invoices for 269ST avoidance | Server stamps `sync_received_at`; invoices with device_timestamp > 24h older than sync_received_at are flagged for review | MED | **S1-M17:** Clock-skew anomaly report in admin console; automatic flag on invoices with >24h skew |
| **R** | Shop staff creates invoice offline, later claims device malfunction | Server-side audit at sync includes device_id, device_timestamp, sync_timestamp, user_id | LOW | |
| **I** | WatermelonDB on stolen/lost device exposes past 7 days of transactions | SQLite encryption via SQLCipher; keys derived from device-specific secret + user biometric | MED | **S1-M18:** Full-device wipe on 10 failed biometric attempts; remote-wipe capability from admin |
| **D** | Staff goes offline then comes back with 10,000 queued writes, overwhelming sync | BullMQ backpressure; per-device sync rate limit | LOW | |
| **E** | Staff app exploits offline mode to void invoices they weren't authorized to void | Permissions cached in JWT claims; void requires supervisor role; server re-checks on sync | LOW | |

### 5.6 TB-6 · Admin console ↔ cross-tenant support data

| STRIDE | Threat | Existing control | Residual risk | Sprint-1 mitigation |
|--------|--------|------------------|---------------|----------------------|
| **S** | Platform ops SSO compromised | Cloudflare Zero Trust + mandatory MFA + hardware keys for privileged roles | LOW | |
| **T** | Platform ops modifies tenant rate/making without tenant approval | Every admin mutation on tenant data requires reason field + is sent to tenant's registered WhatsApp number within 60s | LOW-MED | **S1-M19:** "Shadow-write" admin design — admin can PROPOSE changes; tenant must approve in their admin UI; exceptions only for compliance-forced changes (hard-blocked by platform governance) |
| **R** | Platform ops performs action, denies it | Every read AND every write logged in audit_log with `actor_type='platform'` | LOW | |
| **I** | Platform ops scrapes all tenants' customer lists | Admin queries require `purpose` field (support ticket ID, incident ID); reads logged and reviewed weekly | MED | **S1-M20:** Rate-limit on admin cross-tenant reads (e.g., max 3 tenants per hour without escalation); alerting on bulk-customer-read patterns |
| **D** | Not applicable to admin console specifically | — | — | — |
| **E** | Admin role escalated from support-read to platform-write via misconfiguration | Role granular: `support:read`, `support:write`, `platform:write`, `platform:billing`. Every elevation requires multi-person approval in Vanta or equivalent. | LOW | |

## 6. Compliance-Specific Threats

These threats are regulatorily weighted — a miss is not just a bug, it's a statutory event.

### 6.1 Section 269ST (cash-cap Rs 1,99,999 per txn/day/event)

| Threat | Control | Residual | Action |
|--------|---------|----------|--------|
| Staff splits single cash sale across 2 invoices to bypass cap | Server-side aggregate check by (shop_id, customer_id OR walk-in + device) per day; block on sum ≥ Rs 2L | LOW-MED | **S1-M21:** "Walk-in customer" attempts same day across devices detected by phone-number dedup + name fuzzy-match; hard-block with override |
| Supervisor-override abused | Override requires: supervisor role + typed reason + biometric re-auth + audit log entry with 2FA | LOW | |
| Cash payment recorded as "cheque" to bypass cap | Payment-method dropdown is audited; cheque entries require cheque number + bank name + photograph upload | LOW-MED | Compliance package ADR-0011; periodic audit sampling |
| Offline invoice created while offline, violating cap on sync | Aggregate check happens server-side at sync; violating invoice is quarantined with supervisor alert | LOW | |

### 6.2 PAN Rule 114B (invoice completion blocked at ≥ Rs 2L without PAN or Form 60)

| Threat | Control | Residual | Action |
|--------|---------|----------|--------|
| Invoice finalized below Rs 2L then line-items added to push above | Running-total live check; invoice state machine does not allow line-item add after finalize | LOW | |
| PAN photographed but not actually captured (OCR'd to wrong value) | PAN OCR confidence threshold + user-confirmation step + manual-entry fallback | LOW-MED | **S1-M22:** PAN structural validation (AAAPA1234A regex + checksum) pre-server-save |
| Form 60 accepted without signature | Form 60 upload requires photograph AND shopkeeper biometric attestation | LOW | |

### 6.3 PMLA (cumulative monthly cash tracking per customer)

| Threat | Control | Residual | Action |
|--------|---------|----------|--------|
| Customer's cumulative monthly cash not tracked across multiple shops of same chain tenant | Customer entity is shop_id-scoped (per tenant); chains with multiple physical stores are ONE tenant with one customer table | LOW | |
| Customer splits across family members to avoid Rs 10L threshold | Out of scope for automated detection in v1; flagged as risk | MED | **S1-M23:** Manual PMLA audit tool — FIU officer queryable on demand; no automated cross-customer aggregation to avoid profiling risk |
| CTR template generation fails silently | CTR generation has compile-time schema validation; failure hard-stops the transaction; email + WhatsApp to shopkeeper | LOW | |

### 6.4 HUID (BIS hallmarking)

| Threat | Control | Residual | Action |
|--------|---------|----------|--------|
| Hallmarked product sold without HUID recorded | Invoice validation rejects hallmarked-category product without HUID field | LOW | |
| Counterfeit HUID entered | Surepass API verification; if Surepass down, explicit "unverified" banner on customer invoice + BIS portal link | LOW-MED | |

### 6.5 DPDPA (Digital Personal Data Protection Act)

| Threat | Control | Residual | Action |
|--------|---------|----------|--------|
| Customer PII retained beyond legal requirement | Retention policy: customer PII retained as long as legally required for tax/PMLA (typically 8 years post-last-transaction); documented in privacy policy | LOW | |
| Customer consent not recorded for WhatsApp marketing | Explicit opt-in stored with timestamp + IP + consent version | LOW | |
| Data subject rights (access, correction, erasure) requests not handled in 30 days | Admin console has DPDPA-request workflow; 30-day SLA tracked | LOW-MED | **S1-M24:** DPDPA request tracker in admin console; automated SLA escalation |
| Cross-border data transfer (backup replica outside India) | All data resident in AWS Mumbai (ap-south-1); backups in ap-south-1 + ap-south-2 only | LOW | Terraform guards against non-IN regions |

### 6.6 Weight & money precision

| Threat | Control | Residual | Action |
|--------|---------|----------|--------|
| Weight stored as FLOAT, accumulating rounding | All weight columns DECIMAL(10,3) or (12,4); Drizzle schema enforces; CI test inserts 10,000 sample transactions and asserts exact arithmetic | LOW | ADR-0003; per CLAUDE.md non-negotiable |
| Money computed in floating-point arithmetic | All money in paise (integer); all rate-times-weight done via DECIMAL math in PostgreSQL, not JS floats | LOW | |

## 7. Top Priority Mitigations for Sprint 1

These are pulled from the tables above — the mitigations that MUST ship before Sprint 2 begins. They are also candidate stories for Epic 1 / Epic 2.

| ID | Mitigation | Epic | Estimate |
|----|------------|------|----------|
| S1-M1 | Re-OTP for Rs-2L+ actions + device-binding | Epic 1 (auth) | M |
| S1-M2 | Semgrep `no-tenant-id-from-request-input` rule + tests | Epic 2 (tenant foundations) | S |
| S1-M3 | Out-of-band WhatsApp alert on OTP send + session revoke UI | Epic 1 | M |
| S1-M4 | Public endpoint audit — no PII on unauth routes | Epic 2 | S |
| S1-M5 | OTP-flood circuit breaker | Epic 1 | S |
| S1-M6 | AsyncLocalStorage enforcement Semgrep + tests | Epic 2 | M |
| S1-M7 | Tenant-required BullMQ wrapper with compile-time enforcement | Epic 2 | S |
| S1-M8 | PII-scrubbing logger Semgrep + CI test | Epic 2 | S |
| S1-M9 | Drizzle `.tenantScoped()` marker → RLS assertion generator | Epic 2 | M |
| S1-M10 | `TenantScopedCache` Redis wrapper | Epic 2 | S |
| S1-M11 | Terraform Semgrep: no public S3 ACLs | Epic 2 (infra) | XS |
| S1-M12 | Slow-query + per-tenant query counter alerts | Epic 2 | S |
| S1-M13 | WhatsApp template audit log + anomaly alert | Epic 8 (whatsapp) | S |
| S1-M14 | Rate-integrity gate across IBJA + Metals.dev | Epic 4 (rates) | M |
| S1-M15 | Vendor-health dashboard + runbooks | Epic 14 (ops) | L |
| S1-M16 | Remote-logout + device-binding + biometric idle-lock | Epic 1 | M |
| S1-M17 | Clock-skew anomaly report | Epic 6 (offline-sync) | S |
| S1-M18 | Mobile device wipe on failed biometrics | Epic 1 | S |
| S1-M19 | "Shadow-write" admin design — propose-then-approve | Epic 15 (admin) | L |
| S1-M20 | Admin cross-tenant read rate-limit + alerting | Epic 15 | S |
| S1-M21 | Walk-in dedup for 269ST aggregate | Epic 9 (compliance) | M |
| S1-M22 | PAN structural validation | Epic 9 | XS |
| S1-M23 | PMLA manual audit tool | Epic 9 | M |
| S1-M24 | DPDPA request tracker | Epic 15 | M |

## 8. Accepted Residual Risks (v1)

The following are explicitly accepted, with monitoring:

1. **MSG91 SMS OTP visibility to vendor insiders** (TB-4). Partially mitigated by short TTL + device binding. Alternative is Firebase Auth phone which also ships SMS via Google — same class of risk. Full elimination requires WhatsApp Business OTP, which requires Meta approval. Revisit before 2nd-tenant onboarding.

2. **SIM-swap attacks targeting individual shopkeepers**. India's SIM-swap is endemic. Partially mitigated by device-binding + re-OTP on large actions + WhatsApp notification. Full elimination requires hardware tokens, which are inappropriate for the target demographic (45-65 year-old shopkeepers).

3. **Family members splitting transactions to avoid PMLA Rs 10L threshold**. Automated detection requires cross-customer aggregation which creates profiling risk and operational false-positive burden. Manual audit tool provided; flagged in periodic review.

4. **Nation-state actors**. Out of scope for v1. Revisit if Goldsmith reaches a scale that would attract this threat class.

5. **Supply-chain compromise beyond high-level vendor vetting**. Vendor vetting covers certifications, data residency, incident history. Deeper supply-chain analysis (SBOM, reproducible builds) deferred to Phase 2.

## 9. Review Cadence & Triggers

**Scheduled:** Quarterly by Principal Architect + on-call security review.

**Triggered — re-run this threat model BEFORE:**

- Onboarding 2nd tenant (triggers external pentest requirement per CLAUDE.md).
- Adding any new trust boundary (new vendor integration, new client surface, new admin role).
- Any change to RLS schema, AsyncLocalStorage pattern, or compliance hard-block gateway.
- Breach of an accepted residual in §8 into actual incident.
- Any regulatory event (FIU-IND notice, RBI circular, DPDPA amendment, BIS HUID spec change).
- Every 12 months regardless.

**Review participants:**
- Principal Architect (Alok) — MUST
- Security-reviewer subagent (via `/security-review` skill) — MUST
- External pentester — REQUIRED before 2nd tenant
- Legal counsel on regulatory threats (§6) — ANNUAL

## 10. Open Questions for Anchor SOW Review

These cannot be answered without anchor commercial input. They must be settled in the SOW:

1. Who bears liability for try-at-home-inventory theft (§6)? Anchor? Platform? Insurance?
2. Who carries DPDPA Data Fiduciary designation for customer data — anchor jeweller or Goldsmith platform? (Likely anchor, since platform is white-label processor. Requires legal confirmation.)
3. In event of a 269ST breach from a bug in platform code, who bears statutory liability? (Indemnity clause required.)
4. Rate-lock deposit disputes under Rs 5,000 — anchor handles via WhatsApp support or platform provides escalation path?

---

_End of v1. Route review comments via GitHub issue with label `threat-model` against the planning repo, or — pre-repo-creation — annotate this file with inline `<!-- reviewer: ... -->` comments._
