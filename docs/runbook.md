---
title: Goldsmith — Operations Runbook
status: v1 — Sprint-1 gate draft
author: Alokt (Principal Architect) · facilitated via Claude
date: 2026-04-17
reviewCadence: Before every release; quarterly in steady state
supersedes: none
companionDocs:
  - docs/threat-model.md (STRIDE — mitigations S1-M* referenced here)
  - _bmad-output/planning-artifacts/architecture.md (12 ADRs, 14 bounded contexts)
  - _bmad-output/planning-artifacts/adr/0011-compliance-package-hard-block-gateway.md
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

### 2.1 Pre-deploy checklist

Before running `./scripts/deploy.sh prod` (or GitHub Actions `Deploy to Production`):

- [ ] CI pipeline green on `main` (type-check · lint · tests ≥ 80% · Semgrep · axe-core · Lighthouse · Codex review)
- [ ] Migration plan reviewed: any `DROP`, `ALTER COLUMN TYPE`, or column-remove requires 2-phase deploy (deploy code tolerating both shapes → migrate → deploy code assuming new shape)
- [ ] `threat-model.md` updated if new trust boundary / vendor / admin role introduced
- [ ] No pending DPDPA data-subject requests (would be invalidated by schema change)
- [ ] Low-traffic window: for non-urgent deploys, prefer 02:00–06:00 IST (off-peak wedding-season hours)
- [ ] Anchor POC notified if customer-visible UI changes are shipping

### 2.2 Deploy procedure

```bash
# 1. Tag release from main
git checkout main && git pull
RELEASE_TAG=$(date +%Y.%m.%d)-$(git rev-parse --short HEAD)
git tag -a "release/$RELEASE_TAG" -m "Release $RELEASE_TAG"
git push origin "release/$RELEASE_TAG"

# 2. Confirm CI ran the full ship.yml on the tag
gh workflow view ship --ref "release/$RELEASE_TAG"

# 3. Deploy via Terraform (staging first — always)
cd infra/
terraform workspace select staging
terraform apply -var="release_tag=$RELEASE_TAG"

# 4. Smoke test staging — see §2.4

# 5. Promote to prod
terraform workspace select prod
terraform apply -var="release_tag=$RELEASE_TAG"

# 6. Post-deploy smoke (§2.4) against prod + tag canary metrics in PostHog
```

### 2.3 Rollback

**When to roll back (not forward):**
- Error rate > 5× baseline in first 10 min
- Tenant-isolation assertion fails in prod (CRITICAL — see §5.1)
- Payment-webhook success rate drops > 20%
- Any compliance hard-block misfires (wrongly blocks a legitimate transaction)

**Rollback procedure:**

```bash
# 1. Identify last-known-good tag
PREVIOUS_TAG=$(gh release list --limit 5 | awk '/stable/ {print $1}' | head -1)

# 2. Re-deploy previous tag via Terraform
cd infra/ && terraform workspace select prod
terraform apply -var="release_tag=$PREVIOUS_TAG"

# 3. CRITICAL: DB migrations do NOT roll back automatically.
#    If the bad release ran a migration, you have three options:
#    a) If migration was additive only (new column nullable) — rollback is safe; old code ignores new column
#    b) If migration was destructive (dropped column) — DO NOT roll back code; forward-fix instead
#    c) If migration added NOT NULL constraint — forward-fix or restore from PITR backup (see §10)

# 4. Notify anchor POC: "हमने एक deploy को वापस लिया है — आपका काम प्रभावित नहीं होगा।"
#    (We rolled back a deploy. Your operations are unaffected.)
```

### 2.4 Post-deploy smoke tests

Run these in order against prod after every deploy. Any failure → rollback.

1. `curl https://api.goldsmith.example/healthz` returns 200 with `{"ok": true, "version": "$RELEASE_TAG"}`
2. Shopkeeper app login flow — real OTP through MSG91 (use internal QA number)
3. Customer app product detail page — load PDP for anchor tenant, confirm HUID verify modal opens
4. Rate fetcher job: `curl -H "X-Admin-Token: $TOKEN" /admin/rates/status` shows IBJA + Metals.dev within 0.5% divergence
5. Test invoice creation at Rs 1,99,000 (below 269ST cap) — passes; at Rs 2,00,001 — blocks with compliance reason code
6. BullMQ queue depth steady (not growing)
7. Tenant isolation sanity: as anchor tenant, hit `/api/shops/$OTHER_TENANT_ID/products` — must return 403

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
./scripts/tenant-provision.sh anchor-ayodhya-01

# 3. Create initial admin user (shop owner)
./scripts/user-create.sh \
  --tenant anchor-ayodhya-01 \
  --phone +91XXXXXXXXXX \
  --name "Shop Owner Name" \
  --role shop_admin

# 4. Verify tenant isolation — run smoke test against new tenant
npm run test:tenant-isolation -- --tenant anchor-ayodhya-01
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

_Runbook entries must stay actionable. If a section becomes prose rather than steps, split it or move it to architecture.md._
