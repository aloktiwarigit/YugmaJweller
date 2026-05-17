---
title: Goldsmith — Operations Runbook
status: v1.1 — E2-S1 update
author: Alokt (Principal Architect) · facilitated via Claude
date: 2026-04-18
reviewCadence: Before every release; quarterly in steady state
supersedes: none
companionDocs:
  - docs/threat-model.md (STRIDE — mitigations S1-M* referenced here)
  - _bmad-output/planning-artifacts/architecture.md (12 ADRs, 14 bounded contexts)
  - docs/adr/0011-compliance-package-hard-block-gateway.md
mvpScope: >
  ADR-0015 (startup-lean): LocalKMS only — no Azure Key Vault, no Redis, no
  cloud KMS until Infrastructure Story lands. Scripts reflect this scope.
---

# Goldsmith — Operations Runbook

> **Gate status:** Required artifact for the Greenfield Protocol. Paired with `threat-model.md`. This is the Sprint-1 draft — enough for day-one operations. Expand before first production tenant goes live; expand again before 2nd tenant.
>
> **Core principle:** Every entry here answers three questions — **what happened? · what do I do now? · who do I tell?** — in that order. No philosophy. No retrospective analysis. Those belong in post-incident reviews, not runbooks.

## 0. Index

| Section | Use when |
|---------|----------|
| [§1 On-call & escalation](#1-on-call--escalation) | Always — know who gets paged |
| [§2 Deployment](#2-deployment) | Shipping code to prod |
| [§2.3 Rollback](#23-rollback) | A deploy went wrong |
| [§3 Monitoring & alert response](#3-monitoring--alert-response) | A pager went off |
| [§4 Vendor outage playbooks](#4-vendor-outage-playbooks) | A vendor is degraded |
| [§5 Data & tenant incidents](#5-data--tenant-incidents) | Tenant-isolation bug · data loss · cross-tenant leak |
| [§6 Compliance-event playbooks](#6-compliance-event-playbooks) | FIU-IND notice · DPDPA request · BIS/RBI event |
| [§7 Tenant onboarding](#7-tenant-onboarding) | New jeweller signs SOW |
| [§8 Tenant offboarding](#8-tenant-offboarding) | Jeweller terminates contract |
| [§9 Break-glass credentials](#9-break-glass-credentials) | Normal access paths are unavailable |
| [§10 Recovery objectives](#10-recovery-objectives-rto--rpo) | RTO / RPO targets |
| [§12 Anchor seeding](#12-anchor-seeding-dev--prod) | Dev-time + prod anchor tenant bootstrap |
| [§13 Firebase service-account rotation](#13-firebase-service-account-rotation-90-day-cadence) | 90-day secret rotation |
| [§14 Role bootstrap prerequisites (BYPASSRLS)](#14-role-bootstrap-prerequisites-bypassrls) | Pre-migration superuser grant for platform_admin |
| [§17 Cloud Run deploys](#17-cloud-run-deploys-api--goldsmith-dev-asia-south1) | API build + deploy + rollback on GCP Cloud Run |
| [§18 App Hosting deploys](#18-app-hosting-deploys-firebase-app-hosting--customer-web) | customer-web first deploy, env-var matrix, rollback, error triage |
| [§19 Tenant onboarding — App Hosting backend per tenant](#19-tenant-onboarding--app-hosting-backend-per-tenant) | Manual per-tenant deploy steps until automation story lands |

---

## 1. On-call & escalation

### 1.1 Roster (pre-first-hire)

| Role | Primary | Secondary |
|------|---------|-----------|
| On-call engineer | Alok (founder) | — (SOLO until first hire) |
| Compliance escalation | Alok | Legal counsel (see §6) |
| Anchor jeweller liaison | Alok | Anchor's designated POC |

> **Note:** Solo on-call is an accepted operational risk until first engineering hire. Impact: single point of failure for incident response. Mitigation: detailed playbooks (this doc), vendor auto-recovery where possible, WhatsApp-BSP incident channel with anchor.

### 1.2 Escalation rungs

1. **Level 1 — Auto-recovery:** vendor circuit breakers, cache failovers, BullMQ retry
2. **Level 2 — Alert to Alok:** Sentry + PostHog alerts → WhatsApp + email
3. **Level 3 — Anchor liaison:** if customer-visible impact > 10 min, notify anchor POC via WhatsApp
4. **Level 4 — Legal counsel:** if regulatory event (see §6)
5. **Level 5 — Public disclosure:** if DPDPA-reportable breach — Data Protection Board within 72 hours

### 1.3 Contact modes (in order of reliability)

1. WhatsApp (AiSensy BSP incident channel) — first choice
2. Phone call — second
3. SMS — fallback
4. Email — async only, not for incidents

---

## 2. Deployment

> 2026-05-16 customer-app readiness note: the repository now contains CI gates
> and templates for customer-web release artifact builds
> (`cloudbuild-customer-web.yaml`, `apps/customer-web/apphosting.yaml`) plus a
> customer-mobile EAS production profile (`apps/customer-mobile/eas.json`).
> These templates are not proof that production is live. Do not claim production
> is current until the actual provider/backend, deployed Git SHA or image digest,
> migration level, secrets, domains, Firebase project, CDN/storage provider, and
> mobile build/submission IDs are verified and recorded.

### 2.1 Pre-deploy checklist

Before a production promotion:

- [ ] customer-web target selected: Cloud Build image to Cloud Run, or Firebase App Hosting backend
- [ ] customer-web production env values are set and non-local HTTPS: `API_URL`, `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_SITE_URL`
- [ ] customer-web tenant/Firebase values are set for the target tenant: `NEXT_PUBLIC_SHOP_SLUG`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] GitHub Actions production environment added if CI/CD promotion is automated, with required approvals and OIDC/secret access scoped to deploy only
- [ ] Release artifact/version exposes the deployed Git SHA through `/healthz` or an equivalent release metadata endpoint
- [ ] Database migration command and rollback/forward-fix policy are part of the deploy workflow
- [ ] CDN/storage/ImageKit/Azure Blob production configuration is provisioned and smoke-testable
- [ ] customer-mobile EAS production profile has tenant-specific env/secrets if the native app is part of the release
- [ ] CI pipeline green on `main` (type-check, lint, tests, tenant isolation, Semgrep, customer-web build/Lighthouse, customer-mobile production Expo config, Codex review)
- [ ] Migration plan reviewed: any `DROP`, `ALTER COLUMN TYPE`, or column-remove requires 2-phase deploy (deploy code tolerating both shapes → migrate → deploy code assuming new shape)
- [ ] `threat-model.md` updated if new trust boundary / vendor / admin role introduced
- [ ] No pending DPDPA data-subject requests (would be invalidated by schema change)
- [ ] Low-traffic window: for non-urgent deploys, prefer 02:00–06:00 IST (off-peak wedding-season hours)
- [ ] Anchor POC notified if customer-visible UI changes are shipping

### 2.2 Deploy procedure

No one-command production promotion workflow is checked in yet. The current
repo-backed customer-web paths are build/config templates only; they still
require a release operator to supply production values and record the deployed
artifact.

Customer-web Cloud Build image path:

1. Build and test from a clean `main` checkout after CI is green.
2. Submit the image build with every substitution supplied:

   ```bash
   SHOP_SLUG=tenant-prod-slug
   API_URL=https://api.tenant.example.com
   SITE_URL=https://shop.tenant.example.com
   FIREBASE_API_KEY=replace-with-firebase-web-api-key
   FIREBASE_AUTH_DOMAIN=tenant-prod.firebaseapp.com
   FIREBASE_PROJECT_ID=tenant-prod
   FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000

   gcloud builds submit --config cloudbuild-customer-web.yaml --project "$GCP_PROJECT" \
     --substitutions="_SHOP_SLUG=$SHOP_SLUG,_API_URL=$API_URL,_API_BASE=$API_URL,_SITE_URL=$SITE_URL,_FIREBASE_API_KEY=$FIREBASE_API_KEY,_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN,_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,_FIREBASE_APP_ID=$FIREBASE_APP_ID" .
   ```

3. The Cloud Build template rejects unset `REPLACE_WITH_*` values, non-HTTPS
   API/site URLs, and non-kebab-case tenant slugs.
4. Deploy the `$BUILD_ID` image, not `latest`, to the selected Cloud Run service
   with the same runtime env values. `NEXT_PUBLIC_*` values are already baked
   into the client bundle, so do not promote one image across tenants.
5. Run the post-deploy smoke tests against staging, then production.
6. Record deployed Git SHA, image digest/tag, migration version, domain, Firebase
   project ID, and operator in the release log.

Customer-web Firebase App Hosting path:

1. Create or select the production App Hosting backend in the production Firebase/GCP project.
2. Replace every `REPLACE_WITH_*` value in `apps/customer-web/apphosting.yaml`
   for the target tenant/backend before connecting or deploying the backend.
3. Verify `API_URL`, `NEXT_PUBLIC_API_BASE`, and `NEXT_PUBLIC_SITE_URL` are
   HTTPS and do not point at local/dev services.
4. Trigger the App Hosting build from the intended Git SHA.
5. Record backend ID, Firebase project ID, deployed Git SHA, generated/custom
   domain, and operator in the release log.

### 2.3 Rollback

**When to roll back (not forward):**
- Error rate > 5× baseline in first 10 min
- Tenant-isolation assertion fails in prod (CRITICAL — see §5.1)
- Payment-webhook success rate drops > 20%
- Any compliance hard-block misfires (wrongly blocks a legitimate transaction)

**Rollback procedure:**

No executable rollback command is checked in yet. The deploy story must define
rollback for the selected provider and artifact format.

Required rollback rules:

1. Identify the last-known-good artifact by Git SHA, not by mutable branch name.
2. Re-deploy only the previous application artifact; do not automatically roll back DB migrations.
3. If the bad release ran an additive migration, rollback is normally safe because old code ignores the new shape.
4. If the bad release ran a destructive migration, do not roll back code; forward-fix instead.
5. Notify the anchor POC when a production rollback affects customer-visible behavior.

### 2.4 Post-deploy smoke tests

Run these in order against staging and prod after every deploy. Replace
`goldsmith.example` with the actual production host once the deployment story
selects the provider. Any failure means stop promotion or execute the rollback
procedure.

1. `curl https://api.goldsmith.example/healthz` returns 200 with `{"ok": true, "version": "$RELEASE_TAG"}`
2. Shopkeeper app login flow — real OTP through MSG91 (use internal QA number)
3. Customer app product detail page — load PDP for anchor tenant, confirm HUID verify modal opens
4. Rate fetcher job: `curl -H "X-Admin-Token: $TOKEN" /admin/rates/status` shows IBJA + Metals.dev within 0.5% divergence
5. Test invoice creation at Rs 1,99,000 (below 269ST cap) — passes; at Rs 2,00,001 — blocks with compliance reason code
6. BullMQ queue depth steady (not growing)
7. Tenant isolation sanity: as anchor tenant, hit `/api/shops/$OTHER_TENANT_ID/products` — must return 403
8. If customer-mobile is in scope, install the exact EAS build on a QA device and verify Firebase OTP login, browse, PDP, wishlist, and payment handoff against the production API.

### 2.5 Customer-mobile EAS production builds

The production profile in `apps/customer-mobile/eas.json` sets
`APP_ENV=production` only. All tenant, API, Firebase, and store identifiers must
come from EAS environment variables/secrets or the CI environment at build time.
CI validates the production Expo config with safe placeholders; it does not
create or submit a store build.

Required production values:

- `EXPO_PUBLIC_API_BASE_URL`: public HTTPS API origin
- `EXPO_PUBLIC_SHOP_SLUG`: tenant slug matching the `shops.slug` row
- `EXPO_PUBLIC_ANDROID_PACKAGE`: production Android package, not ending in `.dev`
- `EXPO_PUBLIC_IOS_BUNDLE_ID`: production iOS bundle ID, not ending in `.dev`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`: production Firebase project ID
- `EXPO_PUBLIC_EAS_PROJECT_ID`: EAS project UUID
- `GOOGLE_SERVICES_JSON`: production Android Firebase config file path/secret
- `GOOGLE_SERVICES_PLIST`: production iOS Firebase config file path/secret
- `EXPO_PUBLIC_DEV_AUTH`: must be unset

Build and submit shape:

```bash
cd apps/customer-mobile
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

Record EAS build IDs, store submission IDs, package/bundle identifiers, Firebase
project ID, tenant slug, Git SHA, and operator in the release log. A successful
EAS build or submission is not proof that the API/customer-web production deploy
is current; verify each shipped surface separately.

---

## 3. Monitoring & alert response

### 3.1 Dashboards

| Dashboard | Host | What it shows |
|-----------|------|--------------|
| **Sentry** | sentry.io (self-hosted later) | Error traces, release-health, per-tenant error distribution |
| **PostHog** | self-hosted (DPDPA-compliant deployment) | User journeys, funnel drop-off, feature-flag exposure |
| **AWS CloudWatch** | AWS console | RDS CPU/IOPS, ECS task health, ALB p99 latency |
| **Vendor-health dashboard** (S1-M15) | internal admin | IBJA / Metals.dev / Razorpay / Cashfree / AiSensy / MSG91 / Surepass / FCM status |
| **Compliance audit log** | internal admin | Section 269ST blocks, PAN Rule 114B prompts, PMLA flags (last 30 days) |

### 3.2 Alert severity & response

| Severity | Definition | Response time | Channel |
|----------|------------|---------------|---------|
| **P0** | Cross-tenant data leak · prod down · compliance hard-block broken · payment-webhook fail | < 5 min | WhatsApp + phone call |
| **P1** | Error rate 5×+ · vendor outage impacting >1 tenant · RLS assertion fail in a non-prod env | < 30 min | WhatsApp |
| **P2** | Single-tenant impact · slow queries · non-critical feature regression | < 4 hours | Email |
| **P3** | Cosmetic · non-urgent vendor degradation · stale dashboards | Next business day | Weekly review |

### 3.3 Common alert playbooks

#### **"Error rate 5× baseline"** (P1)
1. Open Sentry → Issues → group by `tenant_id` to identify scope
2. If one tenant → jump to §5.2 (single-tenant incident)
3. If all tenants → check §4 (vendor outage) before concluding bug in our code
4. If bug in our code → rollback (§2.3) is default; forward-fix only if DB migration ran

#### **"Tenant-isolation assertion failed"** (P0 — CRITICAL)
1. **STOP — do not debug in prod.** Flip kill-switch: set `TENANT_ISOLATION_STRICT_MODE=true` on API gateway; all tenant-scoped queries fail-closed
2. Notify anchor POC immediately — transparent communication > speed
3. Capture RLS state: `SELECT * FROM pg_policies WHERE schemaname = 'public';` — save output to incident log
4. Roll back to last-known-good tag (§2.3)
5. Post-incident: write root cause, update Semgrep rules in S1-M2/M6/M9 if pattern was evadable
6. External pentest re-engagement required before next multi-tenant release

#### **"Section 269ST hard-block misfire"** (P0)
1. Confirm via `/admin/compliance/audit` — was a legitimate sub-Rs-2L transaction blocked, or was a Rs-2L+ transaction allowed?
2. If FALSE BLOCK (legitimate sale blocked): apply supervisor-override workflow for that shopkeeper with explicit audit note; hotfix priority next
3. If FALSE ALLOW (Rs-2L+ slipped through): this is a statutory event — notify legal counsel within 1 hour
4. Quarantine all transactions from that tenant in last 24h for audit
5. Root-cause via compliance package unit tests; patch + deploy within 24 hours

#### **"Payment webhook signature fail"** (P0)
1. Confirm Razorpay/Cashfree dashboard shows payments succeeded on vendor side
2. If yes — DO NOT manually finalize orders; that creates reconciliation nightmares
3. Run reconciliation job: `npm run reconcile:payments -- --from=TIMESTAMP`
4. If signature mismatch is systematic (all webhooks failing), check if secret was rotated
5. If specific webhooks failing — forensic; could be S1-M13 forged-payload attempt. Escalate.

---

## 4. Vendor outage playbooks

Each vendor has a runbook entry. The pattern: **detect → reduce blast → communicate → recover**.

### 4.1 IBJA gold rate feed

- **Detect:** Vendor-health dashboard shows IBJA ≠ Metals.dev > 0.5% for > 10 min, OR IBJA 5xx responses
- **Reduce blast:** Rate-fetcher auto-fails-over to Metals.dev; `/admin/rates/status` shows "fallback active"
- **If both down:** freeze new rate-locks; UI banner: "आज का रेट अपडेट नहीं हो पा रहा — कुछ समय बाद कोशिश करें।" (Today's rate cannot update — try again shortly.) Existing rate-locks honored at locked rate.
- **Communicate:** Anchor POC WhatsApp if > 30 min
- **Recover:** When divergence resolves for 3 consecutive pulls, auto-unfreeze

### 4.2 Razorpay (primary payments)

- **Detect:** Webhook success rate < 80% OR charge-capture success rate < 80%
- **Reduce blast:** Circuit breaker fails over to Cashfree (secondary) — customers see "किसी दूसरे तरीके से भुगतान करें" selector
- **Existing rate-locks:** held in pending state; reconcile via polling every 60s for up to 4 hours
- **Communicate:** Anchor POC; customer in-app banner
- **Recover:** Manual check of vendor dashboard; reconcile polled payments

### 4.3 Cashfree (secondary)

- Same pattern as Razorpay but directions reversed (fallback to Razorpay)
- Document any single-rail outage > 4 hours as P1 incident

### 4.4 AiSensy WhatsApp BSP

- **Detect:** Message-send 5xx rate > 10%, OR template-approval revocation from Meta
- **Reduce blast:** SMS fallback via MSG91 for transactional (OTP, rate-lock confirmation, invoice ready)
- **Limit:** Marketing/reminder messages do NOT auto-fall-back to SMS (cost + DPDPA re-consent)
- **Communicate:** Anchor POC WhatsApp
- **Recover:** AiSensy support SLA is 4 hours; after 8 hours, consider switching BSP (adapter pattern ADR-0006)

### 4.5 MSG91 OTP

- **Detect:** OTP delivery SLA > 60s for > 10% of sends
- **Reduce blast:** Firebase Auth phone as secondary (uses Google SMS)
- **Limit:** Voice-OTP backup exists via MSG91 but premium-priced; use for P0 only
- **Recover:** Standard vendor support

### 4.6 Surepass (HUID verification)

- **Detect:** Surepass 5xx > 5% OR > 30s timeout
- **Reduce blast:** PDP shows "HUID verification unavailable — BIS portal link provided"; invoices still record HUID (manual verification by customer)
- **Communicate:** Customer-facing banner on PDP only (not invoice)
- **Recover:** Resume when Surepass health > 99%

### 4.7 Firebase Cloud Messaging (push)

- **Detect:** FCM delivery success < 95%
- **Reduce blast:** Fallback to WhatsApp notification via AiSensy (if user opted into WA channel)
- **Communicate:** Internal only
- **Recover:** Usually auto-recovers

### 4.8 AWS Mumbai (ap-south-1) regional outage

- **Detect:** ALB/RDS both unreachable
- **Reduce blast:** This is a SEV-0 event; no automatic failover exists in v1 (PRD §data residency mandates ap-south-1 single-region)
- **Communicate:** Anchor POC immediately; customer-app offline banner
- **Recover:** Wait for AWS recovery; restore from PITR only if region not expected to recover within 4 hours and ap-south-2 failover has been pre-provisioned (deferred to Phase 2)

---

## 5. Data & tenant incidents

### 5.1 Cross-tenant data leak (P0)

**This is platform-existential. Follow exactly.**

1. **Immediate:** set `TENANT_ISOLATION_STRICT_MODE=true` — all tenant-scoped queries fail-closed
2. **Within 15 min:** notify anchor POC + legal counsel
3. **Within 1 hour:** assess scope — which tenants' data was exposed to whom, for how long
4. **Within 24 hours:** if personal data involved → DPDPA breach notification workflow (§6.2)
5. **Within 72 hours:** regulatory notification to Data Protection Board if DPDPA-reportable
6. Root cause analysis via `git bisect` on test covering the leaked boundary
7. External pentest re-engagement before any further multi-tenant work
8. Public post-mortem within 7 days

### 5.2 Single-tenant data corruption

- Restore per-tenant data from PITR (last 7 days) to a staging instance; diff with live; selective restore
- Notify affected tenant POC within 1 hour of detection
- Document every affected row in the audit log

### 5.3 Weight/money precision error

- If any weight column found with `REAL` or `FLOAT` type in prod → **immediate migration with downtime**; no production transactions may execute against wrong-type columns
- Run reconciliation: sum of all `txn_amount_paise` should equal sum of `(weight × rate) + making + stones + gst`; any drift > 0 paise is a bug
- Escalate to legal counsel if any customer billed an incorrect amount

### 5.4 Lost rate-lock deposit

- Razorpay dashboard → search by customer phone → verify capture
- If captured but not reflected — reconciliation job (§3.3 webhook playbook)
- If not captured but customer has receipt — Razorpay dispute workflow; anchor POC engaged for customer communication

### 5.5 Try-at-home inventory loss

- Anchor's physical insurance claim is the primary recovery path
- Platform logs what went out when and to whom — evidence for insurance + police FIR
- If fraud pattern emerges (multiple losses same customer cluster), flag in admin + alert other tenants (when 2nd tenant live)

---

## 6. Compliance-event playbooks

### 6.1 FIU-IND notice received (PMLA enquiry)

1. Legal counsel engaged within 24 hours
2. Preserve all relevant audit logs — no deletion, no modification
3. Provide response via counsel within statutory deadline
4. Internal review: did our PMLA tracking (S1-M23) detect the pattern? If not, gap analysis

### 6.2 DPDPA data-subject request

- Access request: respond within 30 days; provide copy of all data tied to subject's phone + name
- Correction request: 7-day SLA
- Erasure request: 30 days; retention legally permitted for tax/PMLA (typically 8 years post-last-txn); explicit explanation of retention basis required
- Breach notification: Data Protection Board within 72 hours if personal-data-related; affected users notified without "undue delay"

### 6.3 BIS HUID spec change

- Surepass adapter updated; contract test extended
- Tenant admin console banner: "HUID spec update — please re-verify products hallmarked before DATE"
- Customer-facing invoices remain valid (old spec is grandfathered per BIS usual practice)

### 6.4 RBI circular affecting jewellery fintech

- Legal counsel reviews within 1 week
- If affects payments (e.g., cash-cap amendment): compliance package patched + deployed as P1
- If affects KYC: tenant admin console update; DPDPA re-consent if KYC surface changes

### 6.5 Meta/WhatsApp policy change

- AiSensy or adapter-swapped BSP updates templates
- Re-approval cycle typically 2–7 days; transactional messages prioritized

---

## 7. Tenant onboarding

### 7.1 Pre-onboarding

- [ ] Anchor SOW signed (legal) · SOW includes DPDPA Data Fiduciary/Processor designation
- [ ] Payment gateway KYC complete (Razorpay + Cashfree sub-merchant model)
- [ ] BIS HUID registration verified (shop license number)
- [ ] GSTIN verified
- [ ] Brand assets received: logo SVG, 2 brand colors, shop name (Hindi + English), domain (tenant.goldsmith.example or custom)
- [ ] Anchor sign-off on locked design direction (Direction 5 Hindi-First Editorial per 2026-04-17)

### 7.2 Provisioning steps

```bash
# 1. Create tenant record (admin console or CLI)
./scripts/tenant-create.sh \
  --id anchor-ayodhya-01 \
  --name-hi "आँचल ज्वैलर्स" \
  --name-en "Aanchal Jewellers" \
  --city "Ayodhya" \
  --state "UP" \
  --primary-color "#B58A3C" \
  --accent-color "#D4745A" \
  --logo s3://goldsmith-tenant-assets/anchor-ayodhya-01/logo.svg \
  --gstin 09ABCDE1234F1Z5 \
  --bis-license HAL/XX/1234

# 2. Run tenant provisioning job (creates RLS policies, seeds category tree, creates admin user)
#    MVP note: uses LocalKMS placeholder KEK (ADR-0015); Azure Key Vault KEK lands in Infrastructure Story.
./scripts/tenant-provision.sh \
  --tenant anchor-ayodhya-01 \
  --slug anchor-ayodhya-01 \
  --display "Aanchal Jewellers"

# 3. Create initial admin user (shop owner)
./scripts/user-create.sh \
  --tenant anchor-ayodhya-01 \
  --phone +91XXXXXXXXXX \
  --name "Shop Owner Name" \
  --role shop_admin

# 4. Verify tenant isolation — run smoke test against new tenant
pnpm test:tenant-isolation
```

### 7.3 Post-onboarding checklist

- [ ] Anchor admin logs in successfully via OTP
- [ ] First product created in each category (gold/diamond/silver/bridal)
- [ ] Staff members invited + accepted
- [ ] Making charges, wastage %, rate-lock duration configured
- [ ] Rate feed pulling live IBJA + Metals.dev
- [ ] First test invoice at Rs 1,99,999 + Rs 2,00,001 verifies compliance hard-block
- [ ] WhatsApp BSP number verified against AiSensy template library
- [ ] Tenant-specific threat-model review (if tenant has unusual requirements)

---

## 8. Tenant offboarding

### 8.1 Termination notice

- 30 days notice per SOW standard
- Anchor decides: data export or data deletion (or both, export then delete)

### 8.2 Data export

```bash
./scripts/tenant-export.sh --tenant anchor-ayodhya-01 --output s3://anchor-export-bucket/
# Produces: products.csv, invoices.csv, customers.csv, staff.csv, audit-log.csv, images/*.zip
```

- Delivered via time-bound signed S3 URL (valid 7 days)
- Anchor signs receipt; receipt archived

### 8.3 Data deletion

- Wait-period 30 days after export delivered (in case of re-import request)
- Run `./scripts/tenant-delete.sh --tenant anchor-ayodhya-01 --confirm` (requires MFA + multi-person approval for prod)
- DELETE operations logged; RLS policies dropped; S3 assets purged; archived audit-log kept 8 years for tax
- DPDPA erasure certificate issued to anchor

---

## 9. Break-glass credentials

- Production DB superuser credentials — AWS Secrets Manager, quorum-access (requires 2 of: Alok, legal counsel, accountant)
- AWS root account — hardware MFA in physical safe; used only for billing + account-level changes
- Domain registrar — Alok + legal counsel 2FA
- **Never** store credentials in source, Slack, email, notes apps, or browser-saved passwords

---

## 10. Recovery objectives (RTO / RPO)

| Scenario | RTO | RPO | Mechanism |
|----------|-----|-----|-----------|
| Single-task ECS failure | < 2 min | 0 | ECS auto-restart |
| Single-AZ outage (ap-south-1a/b/c) | < 15 min | 0 | Multi-AZ RDS failover + ALB |
| Regional outage (ap-south-1) | 4 hours | 1 hour | Manual PITR restore to ap-south-2 (deferred — Phase 2) |
| Accidental table-drop | 1 hour | < 5 min | RDS PITR |
| Accidental tenant-delete | 1 hour | last export | PITR + export receipt |
| Ransomware on dev machine | 0 impact (no prod creds on dev) | 0 | Secrets Manager + break-glass protocol |

---

## 11. Review cadence

- **Pre-deploy:** §2.1 checklist
- **Weekly (solo-founder phase):** scan §3.3 common alerts, check audit log samples
- **Monthly:** vendor SLAs review, incident summary
- **Quarterly:** full runbook + threat-model joint review
- **On every new trust boundary:** runbook + threat-model update required before deploy
- **On every incident severity P0/P1:** post-incident review adds to this runbook

---

## 12. Anchor seeding (dev + prod)

Use `scripts/seed-anchor.ts` (pnpm seed:anchor). Inputs from `.env.local` (never commit):

- SEED_ANCHOR_SLUG (default: anchor-dev)
- SEED_ANCHOR_DISPLAY_NAME (default: अयोध्या स्वर्णकार)
- SEED_ANCHOR_PHONE_E164 (required, +CC format)
- FIREBASE_SERVICE_ACCOUNT_JSON_B64 (required)

Running the script is idempotent: it UPSERTs the shops row by slug, UPSERTs shop_users by
(shop_id, phone) with status='INVITED', and prints the Firebase emulator console URL so you
can pick up the dev OTP. On first login via Expo, status flips to ACTIVE + firebase_uid is
populated.

When the anchor SOW signs, re-run this same script against the real Firebase project
(FIREBASE_PROJECT_ID=goldsmith-prod) with the anchor's real phone number.

## 13. Firebase service-account rotation (90-day cadence)

Firebase Admin service-account JSON rotates every 90 days per our secrets-hygiene policy.

### Current dev project (provisioned 2026-04-19)

| Field | Value |
|---|---|
| Project ID | `goldsmith-dev` |
| Display name | Goldsmith Dev |
| Plan | Blaze (pay-as-you-go; Auth free ≤ 10K/mo) |
| Android app ID | `1:528920018833:android:0c79882996c8299ce3e430` |
| Android package | `com.goldsmith.shopkeeper.dev` |
| Enabled providers | Phone, Email/Password, Google (google.com) |
| Admin service account | `firebase-adminsdk-fbsvc@goldsmith-dev.iam.gserviceaccount.com` |
| Admin key ID | `661b54dcee689b084392482e0e80676d03488b49` (rotate by 2026-07-18) |
| Local key path | `.secrets/firebase-admin-sdk-goldsmith-dev.json` (gitignored) |
| iOS | Deferred (not needed pre-anchor-SOW) |
| Client config | `apps/shopkeeper/google-services.json` (gitignored — regenerate via `firebase apps:sdkconfig ANDROID <appId> --project goldsmith-dev --out apps/shopkeeper/google-services.json`) |

### Rotation steps

1. Firebase Console → Project settings → Service accounts → Generate new private key.
   Alternative CLI: `gcloud iam service-accounts keys create .secrets/firebase-admin-sdk-goldsmith-dev.json --iam-account=firebase-adminsdk-fbsvc@goldsmith-dev.iam.gserviceaccount.com --project=goldsmith-dev`.
2. Base64-encode the downloaded JSON: `base64 -w0 .secrets/firebase-admin-sdk-goldsmith-dev.json` (or macOS: `base64 -i … | tr -d '\n'`).
3. Update Azure Key Vault secret `firebase-service-account-json` (prod) or `apps/api/.env.local` (dev).
4. Redeploy Container App (prod) or restart dev server. Verify with a test OTP.
5. Delete old key in Firebase Console only after the new key is confirmed live (≥30min overlap).
6. List old keys: `gcloud iam service-accounts keys list --iam-account=firebase-adminsdk-fbsvc@goldsmith-dev.iam.gserviceaccount.com`. Delete: `gcloud iam service-accounts keys delete <KEY_ID> --iam-account=<acct>`.
7. Log the rotation in `docs/security-log.md` (create if absent).

---

---

## 14. Role bootstrap prerequisites (BYPASSRLS)

`platform_admin` role needs the `BYPASSRLS` attribute for Story 1.1's SECURITY DEFINER auth
functions (`auth_lookup_user_by_phone`, `tenant_boot_lookup`). Granting `BYPASSRLS` requires
the PostgreSQL `SUPERUSER` privilege.

### Dev / CI

No action needed — Testcontainers + local Docker Postgres run the migrator as `postgres`
(superuser), and migration 0003 applies `ALTER ROLE platform_admin BYPASSRLS;` in a DO block
that handles the success case silently.

### Production (Azure Database for PostgreSQL)

The infrastructure operator MUST run the following command as the Postgres admin user BEFORE
deploying migration 0003:

```bash
psql -h <host> -U <admin> -d <db> -c "ALTER ROLE platform_admin BYPASSRLS;"
```

If this step is skipped, migration 0003 will raise a clear exception with remediation
instructions rather than silently failing. The error message reads:

```
migration 0003 requires platform_admin BYPASSRLS. Run as superuser:
ALTER ROLE platform_admin BYPASSRLS; (see docs/runbook.md §14)
```

### Verification

After the grant is applied, confirm with:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'platform_admin';
-- Expected: rolbypassrls = true
```

---

## 15. Provisioning a platform_admin user

Platform admins are NEVER created via the shopkeeper invite flow. They have no row in
`shop_users` and no `shop_id`. Provisioning is manual and audited.

1. **Create a Firebase Auth user** for the platform admin (email/password or Google).
2. **Set the role custom claim** via the Firebase Admin SDK. Suggested helper script
   `scripts/set-platform-admin.mjs <firebase-uid>`:

   ```js
   import admin from 'firebase-admin';
   admin.initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS
   const uid = process.argv[2];
   await admin.auth().setCustomUserClaims(uid, { role: 'platform_admin' });
   console.log(`platform_admin claim set on ${uid}`);
   ```

3. The user must sign out and refresh the ID token for the claim to apply.
4. **Verify** by hitting `GET /platform/admin/metrics` with the user's ID token — it should
   return 200. A non-platform-admin token returns 403.
5. **Audit**: keep a record of who has `platform_admin`. Quarterly review — revoke claims
   for any admin who no longer needs access.

`platform_admin` users do NOT have a `shop_id` claim. Tenant-scoped routes are unreachable
to them unless they start an impersonation session (see §16).

## 16. IMPERSONATION_JWT_SECRET rotation

The impersonation JWT (`X-Impersonation-Token` header) is signed with HS256 using
`IMPERSONATION_JWT_SECRET`. Rotation invalidates all in-flight impersonation tokens.
DB session rows are unaffected; running sessions must be re-started after rotation.

### When to rotate

- Quarterly (cron-suggested cadence).
- Within 24 hours of any known leak or suspected compromise.
- After offboarding a platform admin who held an active token.

### Procedure

1. Generate a new secret (≥ 32 bytes):

   ```bash
   openssl rand -base64 48
   ```

2. Update Azure Key Vault entry `impersonation-jwt-secret`.
3. Roll API instances (`az containerapp revision restart` or equivalent). All running
   impersonation tokens become invalid as instances pick up the new secret.
4. Verify rotation by attempting to use a pre-rotation impersonation token — it must fail
   with `auth.impersonation_token_invalid`.

### What does NOT need to be rotated

- Firebase ID tokens for platform admins — issued by Firebase, not us.
- Tenant-side `audit_events` rows referencing impersonation sessions — the session row's
  `id` is stable across secret rotations.

---

<<<<<<< HEAD
## 17. Cloud Run deploys (API — goldsmith-dev, asia-south1)

> Added 2026-05-16 — Story 19.5. ADR note: ADR-0015 specifies Azure as the target
> hosting provider. The API is currently deployed to GCP Cloud Run in the goldsmith-dev
> project as an operational decision made before the Azure subscription was provisioned.
> This divergence is intentional and temporary; ADR-0015 will be amended in the
> Infrastructure Story when Azure Container Apps are provisioned for production.

### 17.1 Service facts

| Field | Value |
|-------|-------|
| GCP project | `goldsmith-dev` |
| Region | `asia-south1` |
| Service name | `goldsmith-api` |
| Service URL | `https://goldsmith-api-528920018833.asia-south1.run.app` |
| Artifact Registry | `asia-south1-docker.pkg.dev/goldsmith-dev/goldsmith-api/api` |
| Health endpoint | `GET /health` → `{ status: "ok", db: "ok" }` (deep, DB check) |
| Shallow probe | `GET /healthz` → `{ status: "ok" }` (no DB, kept for legacy monitors) |

### 17.2 Deploy trigger

Deploys are triggered by submitting a Cloud Build job against `main`:

```bash
# From repo root — Cloud Build builds + pushes image + deploys to Cloud Run atomically.
gcloud builds submit \
  --config cloudbuild.yaml \
  --project goldsmith-dev \
  .
```

A GitHub Cloud Build trigger can be wired to `main` to make this automatic on push.
Until the trigger is configured, deploys are manual via the command above.

Pre-deploy: ensure `pnpm typecheck && pnpm lint && pnpm --filter @goldsmith/api test:unit` are
green on `main`. Do not submit a build that fails local checks.

### 17.3 Health gating and traffic strategy

Cloud Run performs a startup probe on the container's `EXPOSE` port (8080). The `Dockerfile`
also runs a `HEALTHCHECK` at `GET /health` every 30 s (5 s timeout, 20 s start-period, 3
retries). Cloud Run will only route traffic to the new revision once the startup probe passes.

**Default traffic strategy:** 100% traffic is shifted to the new revision automatically after
a healthy startup. This is appropriate for the current single-tenant demo-readiness phase.

**Canary deploys (optional, for future use):**

```bash
# Deploy new revision but hold all traffic on the current one:
gcloud run deploy goldsmith-api \
  --image=asia-south1-docker.pkg.dev/goldsmith-dev/goldsmith-api/api:<BUILD_ID> \
  --region=asia-south1 \
  --project=goldsmith-dev \
  --no-traffic

# Inspect the new revision's health:
curl https://<new-revision-url>/health

# If healthy, shift 10% of traffic:
gcloud run services update-traffic goldsmith-api \
  --region=asia-south1 \
  --project=goldsmith-dev \
  --to-revisions=<new-revision-name>=10,LATEST=90

# Fully promote when satisfied:
gcloud run services update-traffic goldsmith-api \
  --region=asia-south1 \
  --project=goldsmith-dev \
  --to-latest
```

### 17.4 Rollback recipe

Identify the previous healthy revision name, then shift 100% traffic back to it:

```bash
# List revisions (most recent first):
gcloud run revisions list \
  --service=goldsmith-api \
  --region=asia-south1 \
  --project=goldsmith-dev \
  --format="table(name,status.conditions[0].status,createTime)" \
  --sort-by="~createTime"

# Roll back to a specific revision (replace <previous-revision-name>):
gcloud run services update-traffic goldsmith-api \
  --region=asia-south1 \
  --project=goldsmith-dev \
  --to-revisions=<previous-revision-name>=100
```

**Do NOT roll back DB migrations** when rolling back the application binary. See §2.3 for the
general rollback policy (additive migrations are safe to leave; destructive migrations require a
forward-fix, not a code rollback).

### 17.5 Log query (Cloud Logging)

Errors in the current revision:

```
resource.type="cloud_run_revision"
resource.labels.service_name="goldsmith-api"
severity>=ERROR
```

All structured logs for a specific revision:

```
resource.type="cloud_run_revision"
resource.labels.revision_name="<revision-name>"
```

Cloud Logging URL (replace the project if needed):
`https://console.cloud.google.com/logs/query;query=resource.type%3D"cloud_run_revision"%0Aseverity%3E%3DERROR?project=goldsmith-dev`

### 17.6 Alert configuration

> **Stub:** Cloud Monitoring alerts for Cloud Run error rate, revision unhealthy, and
> cold-start latency are not yet configured. Add these before onboarding the first paying
> tenant. Minimum recommended alerts:
> - Error rate > 5% sustained for 5 min → P1 page (Alok WhatsApp)
> - Revision startup failure (health check failed) → P1 page
> - Request latency p99 > 5 s sustained for 10 min → P2 email

### 17.7 Common failure modes

| Symptom | Cause | Resolution |
|---------|-------|------------|
| New revision stays UNHEALTHY, traffic stays on previous | `/health` returns 503 — DB unreachable at startup (bad `DATABASE_URL`, Cloud SQL not reachable, wrong VPC connector) | Check Cloud Logging for the revision; verify `DATABASE_URL` secret; fix and re-deploy |
| Revision UNHEALTHY — crash-loop | Missing required env var (e.g. `FIREBASE_PROJECT_ID`, `KMS_MASTER_SECRET`) | Check Cloud Logging for `FATAL bootstrap failed`; add missing env var in Cloud Run service config |
| 503 on `/health` in prod but DB is up | DB pool exhausted (all connections in use) | Increase `DATABASE_POOL_MAX` env var or scale down concurrent requests |
| Deploy step fails with `PERMISSION_DENIED` | Cloud Build service account lacks `roles/run.admin` or `roles/iam.serviceAccountUser` | Grant roles to `<project-number>@cloudbuild.gserviceaccount.com` |
| Image not found during deploy | `push-api` step failed or race with `deploy-cloud-run` | Check Cloud Build logs; `push-api` step must complete before `deploy-cloud-run` (`waitFor` enforces this) |

### 17.8 Auth posture note

The service is deployed with `--allow-unauthenticated` because mobile apps and the customer-web
browser client reach the API directly from end-user devices. Application-layer authentication is
enforced by `FirebaseJwtGuard` on all tenant-scoped routes. Public routes (`/health`, `/healthz`,
`/api/v1/tenant/boot`, public catalog) are intentionally unauthenticated.

If a WAF or API Gateway is added in front of Cloud Run in a future phase, the
`--allow-unauthenticated` flag should be reviewed and potentially removed (traffic would then
flow through the gateway only, which would enforce its own auth).
=======
---

## 18. App Hosting deploys (Firebase App Hosting — customer-web)

The customer-web Next.js app runs on Firebase App Hosting (`goldsmith-customer-web` backend, region `asia-east1`). Each tenant has **one backend deployment** with per-tenant environment variables set in `apps/customer-web/apphosting.yaml`.

### 17.1 First deploy (new tenant)

Prerequisites: Firebase project exists, App Hosting backend created in Firebase console, all `apphosting.yaml` values populated (no `REPLACE_WITH_*` placeholders).

```bash
# From the repo root. Requires firebase-tools and a logged-in account
# with Editor or Firebase App Hosting Admin on the project.
firebase deploy --only apphosting --project <firebase-project-id>
```

Verify the deploy URL in the Firebase console → App Hosting → backend → Traffic. The initial deploy may take 3–5 minutes for Cloud Build to compile the Next.js SSR bundle.

**CI gate:** The `apphosting-deploy-check` workflow (`.github/workflows/apphosting-deploy-check.yml`) blocks merges when `[deploy]` appears in the commit/PR title AND `apphosting.yaml` still contains `REPLACE_WITH_*` placeholders. Add `[deploy]` to the PR title only when all values are populated and you intend to trigger a deploy. See fixture tests in that workflow for the exact logic.

### 17.2 Environment variable matrix

All variables are set in `apps/customer-web/apphosting.yaml`. The `[env.ts]` column marks variables validated at build time by `apps/customer-web/lib/env.ts` — missing values cause a hard build failure.

| Variable | Purpose | Source | env.ts |
|---|---|---|---|
| `NODE_ENV` | Runtime mode (`production`) | Hardcoded in apphosting.yaml | — |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | Hardcoded `"1"` | — |
| `NEXT_PUBLIC_SHOP_SLUG` | Tenant slug (maps to `shops.slug` in DB) | Tenant provisioning step (§7.2) | required |
| `API_URL` | SSR server-to-server API URL | Cloud Run service URL from `gcloud run services describe` | — |
| `NEXT_PUBLIC_API_BASE` | Browser-accessible API URL | Same as `API_URL` for public Cloud Run; CDN-fronted URL if applicable | required |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL for sitemap + OG tags | Firebase App Hosting assigned domain or custom domain | required |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK public key | Firebase console → Project settings → Web app SDK config | warning if missing |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Firebase console → Web app SDK config (format: `<project>.firebaseapp.com`) | warning if missing |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Firebase console → Project settings → General | warning if missing |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID | Firebase console → Web app SDK config (format: `1:<num>:web:<hash>`) | — |

`NEXT_PUBLIC_FIREBASE_*` values are public keys — safe to commit in `apphosting.yaml`. They are restricted by Firebase security rules, not by secrecy.

### 17.3 Rollback

Firebase App Hosting maintains revision history per backend. To roll back:

**Via Firebase console:**
1. Firebase console → App Hosting → `goldsmith-customer-web` → Traffic
2. Select the previous revision → "Route all traffic to this revision"

**Via gcloud (equivalent):**
```bash
# List revisions
gcloud run revisions list \
  --service goldsmith-customer-web \
  --region asia-east1 \
  --project <firebase-project-id>

# Route 100% traffic to a previous revision
gcloud run services update-traffic goldsmith-customer-web \
  --to-revisions <REVISION_NAME>=100 \
  --region asia-east1 \
  --project <firebase-project-id>
```

Rollback does NOT affect the database or Cloud Run API — only the customer-web SSR layer. Database rollback follows §2.3.

### 17.4 SSR error triage (Cloud Logging)

Cloud Logging URL pattern for this backend (replace `<project-id>` with the Firebase project):

```
https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22goldsmith-customer-web%22%0Aseverity%3E%3DERROR;project=<project-id>
```

Shorter: navigate to Cloud Logging → select resource type "Cloud Run Revision" → filter by service name `goldsmith-customer-web` → severity >= ERROR.

For SSR errors, the stack trace includes the Next.js route segment and any uncaught error from server components or API route handlers.

### 17.5 Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails: "Missing required production environment variables" | `NEXT_PUBLIC_SHOP_SLUG`, `NEXT_PUBLIC_API_BASE`, or `NEXT_PUBLIC_SITE_URL` absent | Populate all required vars in `apphosting.yaml` before deploy |
| All pages return 500 | `API_URL` or `NEXT_PUBLIC_API_BASE` points to wrong endpoint | Verify Cloud Run service URL; `curl $API_URL/api/v1/tenant/boot?slug=$SLUG` from Cloud Shell |
| Tenant not found (404 on storefront) | `NEXT_PUBLIC_SHOP_SLUG` does not match any row in `shops.slug` | Confirm tenant exists: `SELECT slug FROM shops WHERE slug = '<value>';` |
| /admin login loop | `NEXT_PUBLIC_FIREBASE_*` values missing or wrong project | Copy correct SDK config from Firebase console → Web app → SDK setup |
| Deploy never completes | Cloud Build quota or billing not enabled on Firebase project | Check Cloud Build history in GCP console; ensure Blaze plan active |

---

## 19. Tenant onboarding — App Hosting backend per tenant

> **Scope:** This section covers the App Hosting deployment step only. Database provisioning, RLS policies, and seed data are in §7.

Each jeweller tenant gets their own `apphosting.yaml` values and their own Firebase App Hosting backend (or the same backend with environment variable updates for single-backend multi-tenant routing).

**Current model (MVP / demo phase):** manual `firebase deploy --only apphosting` per tenant after updating `apphosting.yaml` with that tenant's values. One backend, one tenant.

**Productisation placeholder:** A future story will automate per-tenant App Hosting backend provisioning (Firebase Management API + GitHub Actions per-tenant workflow dispatch). Until that story lands, onboarding a new tenant follows these manual steps:

1. Complete §7.1 pre-onboarding checklist (SOW, brand assets, GSTIN, etc.).
2. Run §7.2 provisioning steps to create the tenant DB record, RLS policies, and admin user.
3. Update `apps/customer-web/apphosting.yaml` with the tenant's values (all vars in §18.2).
4. Open a PR with `[deploy]` in the title — the `apphosting-deploy-check` CI gate verifies zero placeholders remain.
5. After PR merge: `firebase deploy --only apphosting --project <firebase-project-id>`.
6. Complete §7.3 post-onboarding checklist.

Estimated elapsed time for steps 3–6: ~1 hour per tenant (primarily wait time for Cloud Build).
>>>>>>> worktree-agent-a42ad07e19385196f

---

_Runbook entries must stay actionable. If a section becomes prose rather than steps, split it or move it to architecture.md._
