---
generatedBy: 'Opus main orchestrator'
epic: 'E15 + E16'
date: '2026-04-17'
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Epic 15 reframed per IR-report correction — user-value framed as "Platform Admin onboards a new
    jeweller in under 1 day". Story 15.5 is the central provisioning orchestrator story.
  - >
    Epic 16 reframed per IR-report correction — eliminates "Anchor Launch Hardening" as a name. Each
    story is a specific user-value outcome with measurable success criteria tied to NFRs. Story 16.6
    (Anchor Sign-Off Day) is the final production-launch milestone.
---

---

## Epic 15: Platform Admin can onboard a new jeweller in under 1 day with zero custom code

**Goal:** Validate the platform's productization claim. Admin console + tenant provisioning automation + impersonation + subscription management. 2nd jeweller onboarded in < 3 weeks at M9; 10th in < 1 week at M12.

**FRs covered:** FR1 (full automated create), FR2, FR3, FR4, FR6, FR7, FR120, FR121, FR122, FR123, FR124, FR125, FR126
**Phase:** Phase 1 — Sprint 9-10 (skeleton stories earlier)
**Dependencies:** Epic 1 (tenant data model), all feature epics (for tenant preview rendering)

---

### Story 15.1: Platform Admin logs in via MFA-gated login

**Class:** A — Platform-admin MFA-gated auth module + platform_admin role.

**As a Platform Admin (Alokt)**,
I want to log in to the admin console with phone OTP + TOTP second factor,
So that privileged platform access requires two-factor authentication.

**FRs implemented:** FR126 (MFA for admin role)
**NFRs verified:** NFR-S14 (VPC-private + bastion + MFA), NFR-S6 (MFA via authenticator app)
**Modules + packages touched:**
- `apps/admin/app/login/*` (new)
- `apps/admin/src/middleware.ts` (new — platform-admin role guard + MFA enforcement)
- `apps/api/src/modules/auth/mfa.service.ts` (new — TOTP via Supabase Auth MFA feature)

**ADRs governing:** ADR-0001, ADR-0005
**Pattern rules honoured:** MUST #5, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Alokt navigates to admin.goldsmith.internal
**When** login flow runs
**Then** phone OTP + TOTP authenticator app second factor required
**And** failed second-factor 3x → 15-min lockout
**And** session token has `platform-admin` aud claim; expires in 8h (shorter than regular)

**Given** CI runs, all gates pass

**Tests required:** Unit (MFA verify), Integration (Supabase Auth MFA), E2E, Security (brute-force resistance)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 15.2: Platform Admin views tenant list + detail with filter by status

**Class:** A — SECURITY DEFINER cross-tenant query for tenant list/detail + tenant-isolation test.

**As a Platform Admin**,
I want a sortable tenant list — filter by ACTIVE/SUSPENDED/TERMINATED/ONBOARDING + search by name/city/GSTIN — with quick-drill per tenant,
So that I can locate any tenant in seconds for support.

**FRs implemented:** FR6 (tenant metrics), FR7 (Platform Support time-limited access basis)
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/admin/app/(auth)/tenants/page.tsx` (new — tenant list)
- `apps/admin/app/(auth)/tenants/[id]/page.tsx` (new — tenant detail)
- `apps/api/src/modules/platform-admin/tenant-admin.controller.ts` (new — SECURITY DEFINER Postgres functions per ADR-0005)
- `packages/ui-web/business/TenantCard.tsx` (new)

**ADRs governing:** ADR-0005, ADR-0009
**Pattern rules honoured:** MUST #5 (impersonation context not raw params)
**Complexity:** M

**Acceptance Criteria:**

**Given** admin logged in
**When** opens tenant list
**Then** table shows: shop name, city, plan, status, last active, MAU count
**And** filter + sort + search functional
**And** tap tenant → detail with metrics dashboard

**Given** CI runs, all gates pass including platform-admin audit: every list query audit-logged

**Tests required:** Unit, Integration, Tenant-isolation (admin sees all; regular users see only own)

**Definition of Done:** All AC + 10 CI gates + Storybook TenantCard + 5 review layers.

---

### Story 15.3: Platform Admin opens theme configurator wizard with HCT-validated WCAG AA seed colors

**Class:** B — Theme configurator wizard UI; non-sensitive, safe surface.

**As a Platform Admin onboarding a new jeweller**,
I want a 5-step wizard: shop details → logo upload → primary seed color (auto-validated WCAG AA via HCT) → typography stack → domain,
So that theme setup is 15 minutes, not 15 hours.

**FRs implemented:** FR2 (first part — branding config)
**NFRs verified:** NFR-A2 (contrast ratios)
**Modules + packages touched:**
- `apps/admin/app/(auth)/provision/wizard/*` (new — multi-step form)
- `packages/ui-web/business/ThemeConfiguratorWizard.tsx` (new Tier 3 — UX-DR17 steps 1-3)
- `packages/ui-theme/src/hct.ts` (used — HCT palette generation with WCAG gate)

**ADRs governing:** ADR-0008
**Pattern rules honoured:** MUST #5, MUST #6
**Complexity:** M

**Acceptance Criteria:**

**Given** admin enters seed color #4A7C59 (forest green)
**When** HCT generates scale
**Then** WCAG AA contrast check runs; if fail, wizard suggests adjusted seed
**And** live preview of Anchor-style home + PDP renders with new theme

**Given** CI runs, all gates pass including Chromatic VR for wizard preview

**Tests required:** Unit (HCT + WCAG gate), Integration, VR

**Definition of Done:** All AC + 10 CI gates + Storybook ThemeConfiguratorWizard + 5 review layers.

---

### Story 15.4: Platform Admin configures per-tenant feature flags (try-at-home, wholesale, gold-scheme, loyalty, viewing-analytics)

**Class:** B — Per-tenant feature-flag CRUD; safe surface, non-sensitive.

**As a Platform Admin configuring Varanasi Gold House (no try-at-home, custom chit-fund)**,
I want toggles per-tenant for each major feature + per-plan defaults,
So that Suresh-ji doesn't get features he didn't buy.

**FRs implemented:** FR3
**NFRs verified:** NFR-S9
**Modules + packages touched:**
- `apps/admin/app/(auth)/tenants/[id]/feature-flags/page.tsx` (new)
- `packages/integrations/feature-flags/growthbook-adapter.ts` (new — self-hosted GrowthBook OSS)
- `packages/ui-web/business/FeatureFlagToggle.tsx` (new)

**ADRs governing:** ADR-0006 (GrowthBook)
**Pattern rules honoured:** MUST #5
**Complexity:** M

**Acceptance Criteria:**

**Given** admin on tenant feature-flag page
**When** toggles try-at-home OFF + gold-scheme ON
**Then** changes persist; shopkeeper app reflects within 60s (TanStack Query refetch on settings-change signal)
**And** audit logs flag change with before/after + admin user

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (flag evaluation + audit), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + Storybook FeatureFlagToggle + 5 review layers.

---

### Story 15.5: Platform Admin provisions a new tenant end-to-end with zero custom code

**Class:** A — Tenant-provisioning orchestrator + KMS CMK + multi-step infra + rollback + idempotency.

**THE central provisioning story. Zero custom code per tenant.**

**As a Platform Admin onboarding the 5th jeweller**,
I want to complete the entire provisioning in one wizard session: shop row + CNAME + ACM cert + S3 prefix + per-tenant KMS CMK + Meilisearch index + owner invite,
So that the 5th jeweller is onboarded in under 4 hours, not 4 days.

**FRs implemented:** FR1 (full automated create)
**NFRs verified:** NFR-SC1-3 (architecture scales to 100 @ M12)
**Modules + packages touched:**
- `infra/scripts/tenant-provision.ts` (new — orchestrator Lambda with rollback on partial failure)
- `apps/api/src/modules/platform-admin/provision.service.ts` (new)
- `infra/terraform/modules/tenant-provision/*` (new — CNAME + ACM + S3 prefix + KMS CMK + Meilisearch index modules)
- `apps/admin/app/(auth)/provision/page.tsx` (new — final confirmation screen)

**ADRs governing:** ADR-0010 (authoritative for this story), ADR-0012
**Pattern rules honoured:** MUST #4 (idempotency on provision), MUST #5, MUST #8, MUST #9 (data residency + tag validation)
**Complexity:** XL

**Acceptance Criteria:**

**Given** admin completes wizard (Stories 15.1-15.4)
**When** they tap "Provision Tenant" with idempotency key
**Then** orchestrator executes in order: (1) validate inputs + WCAG check; (2) Terraform apply for infra (CNAME + ACM + S3 + KMS CMK + Meilisearch index); (3) API creates tenant row + default settings + feature flags + first-owner shop_user INVITED; (4) WhatsApp + SMS invite sent to owner
**And** state machine: PROVISIONED → ONBOARDING on owner OTP verify
**And** partial-failure rollback works: any step failure triggers reverse-order cleanup + Sentry alert

**Given** admin re-submits same provision request (network retry)
**When** idempotency key matches prior submission
**Then** returns cached result; zero duplicate infra

**Given** CI runs, all gates pass; provisioning integration test creates + tears down mock tenant

**Tests required:** Unit (rollback ordering), Integration (full provision + teardown in staging), Tenant-isolation (new tenant data invisible to other tenants from moment-1), Chaos (step-N failure → rollback)

**Definition of Done:** All AC + 10 CI gates + runbook `docs/runbooks/tenant-provisioning.md` + 5 review layers.

---

### Story 15.6: Provisioned tenant's owner receives WhatsApp/SMS invite; completes OTP verify; tenant transitions PROVISIONED → ONBOARDING

**Class:** A — Provisioned-tenant invite + OTP verification completes a platform_admin flow.

**As a new Shop Owner (Suresh-ji of Varanasi Gold House)**,
I want to receive a WhatsApp + SMS invite with a single tap-to-verify link,
So that I activate my tenant without confusing email/username setup.

**FRs implemented:** FR1 finalization
**NFRs verified:** NFR-P12
**Modules + packages touched:**
- `apps/api/src/modules/platform-admin/invite.service.ts` (new)
- `apps/shopkeeper/app/(auth)/provisioning-invite.tsx` (new — deep-link target)

**ADRs governing:** ADR-0010
**Pattern rules honoured:** MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** Suresh-ji receives WhatsApp "Welcome to [Varanasi Gold House] — tap to verify"
**When** he taps + completes OTP
**Then** tenant state transitions PROVISIONED → ONBOARDING; 5-screen preview unlocks (home + product + invoice + settings + customer-app home)
**And** on approval, state advances to ACTIVE

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (invite + deep-link + state transition), E2E

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 15.7: Platform Admin impersonates tenant user with time-limit + MFA + audit-logged justification

**Class:** A — Impersonation service per ADR-0005 + time-limited token + audit + RLS isolation test.

**As a Platform Support agent troubleshooting a ticket**,
I want to impersonate the affected shopkeeper user for 60 minutes (read-only default, write requires second-step approval) with all actions audit-logged,
So that I can diagnose without giving support agents standing write access.

**FRs implemented:** FR123, FR7 (support access)
**NFRs verified:** NFR-S9 (impersonation audit; 5y retention), NFR-S14 (MFA for privileged paths)
**Modules + packages touched:**
- `apps/api/src/modules/platform-admin/impersonation.service.ts` (new — per ADR-0005)
- `apps/admin/app/(auth)/tenants/[id]/impersonate/page.tsx` (new)
- `apps/api/src/common/interceptors/tenant.interceptor.ts` (extend — resolves impersonation token)

**ADRs governing:** ADR-0005 (authoritative)
**Pattern rules honoured:** MUST #5, MUST #8
**Complexity:** L

**Acceptance Criteria:**

**Given** Platform Support user requests impersonation with justification "Ticket #123: invoice not saving"
**When** request fires
**Then** generates time-limited token (max 60 min TTL) with `imp=true` claim + `impersonation_audit_id`; read-only by default
**And** every request in impersonation session audit-logged with action + subject + impersonation_audit_id
**And** write mode requires second-step admin approval (second admin clicks "Allow write for 10 min")

**Given** impersonation TTL expires
**When** next request fires
**Then** 401 with "Impersonation expired; reauthorize"

**Given** CI runs, all gates pass; impersonation tests cover expiry, write-escalation, audit completeness

**Tests required:** Unit (token + TTL), Integration, Tenant-isolation (impersonating tenant A cannot read tenant B), Chaos (token expiry mid-request)

**Definition of Done:** All AC + 10 CI gates + runbook for impersonation workflow + 5 review layers.

---

### Story 15.8: Platform Admin suspends/reactivates/terminates a tenant with DPDPA-compliant retention

**Class:** A — Tenant lifecycle state machine + DPDPA retention + KMS key deletion + soft/hard-delete.

**As a Platform Admin**,
I want to suspend a non-paying tenant (read-only), reactivate after payment, or terminate (30-day soft-delete → hard per DPDPA + PMLA retention),
So that tenant lifecycle operations are clean and reversible.

**FRs implemented:** FR4, FR125
**NFRs verified:** NFR-C6 (DPDPA retention), NFR-C5 (PMLA 5-year compliance retention)
**Modules + packages touched:**
- `apps/api/src/modules/platform-admin/lifecycle.service.ts` (new — tenant state machine per ADR-0010)
- `apps/api/src/workers/tenant-hard-delete.processor.ts` (new — BullMQ scheduled 30-day trigger)
- `apps/admin/app/(auth)/tenants/[id]/lifecycle/page.tsx` (new)

**ADRs governing:** ADR-0010, ADR-0011
**Pattern rules honoured:** MUST #5, MUST #9
**Complexity:** L

**Acceptance Criteria:**

**Given** admin suspends tenant
**When** action fires
**Then** state ACTIVE → SUSPENDED; tenant users see "Account suspended — contact support"; audit logs

**Given** admin terminates tenant
**When** action fires
**Then** state → TERMINATED (soft-30-day); data export bundle prepared; day-30 hard-delete purges PII except legally-required invoice/KYC/compliance records
**And** terminated tenant's CNAME removed; ACM cert revoked; KMS CMK scheduled for deletion (crypto-shreds PAN envelope ciphertexts)

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (full lifecycle), Tenant-isolation (terminated tenant data not visible to anyone after hard-delete)

**Definition of Done:** All AC + 10 CI gates + runbook `docs/runbooks/tenant-offboarding.md` + 5 review layers.

---

### Story 15.9: Platform Admin triggers tenant data export (full bundle) for portability

**Class:** A — DPDPA portability export + KMS encryption + cross-tenant operation.

**As a Platform Admin honouring tenant data-portability request**,
I want to generate a complete export: invoices + customers + inventory + custom orders + reviews + images + settings — all in CSV + JSON + PDF,
So that DPDPA portability rights are fulfilled within 30 days.

**FRs implemented:** FR124
**NFRs verified:** NFR-C6 (DPDPA export)
**Modules + packages touched:**
- `apps/api/src/modules/platform-admin/data-export.service.ts` (new)
- `apps/api/src/workers/tenant-data-export.processor.ts` (new — BullMQ large export job)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** admin requests export for tenant X
**When** job runs
**Then** export bundle created in S3 with tenant-scoped KMS-encrypted zip; link delivered via WhatsApp + email with 7-day expiry
**And** audit logs export event

**Given** CI runs, all gates pass

**Tests required:** Unit (export shape), Integration (full export + encryption), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 15.10: Platform Admin views cross-tenant metrics dashboard (active tenants, MAU, invoices, GMV)

**Class:** A — Cross-tenant metrics dashboard reading all tenants + SECURITY DEFINER + audit-logged.

**As a Platform Admin**,
I want the platform health summary: active tenants, total MAU/WAU/DAU, total invoices, total GMV flowing through the platform, per-plan distribution,
So that I know the business's pulse at a glance.

**FRs implemented:** FR120
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/admin/app/(auth)/dashboard/page.tsx` (new)
- `apps/api/src/modules/platform-admin/metrics.service.ts` (new — reads from PostHog + read replica)
- `packages/ui-web/business/MetricsDashboard.tsx` (new Tier 3)

**ADRs governing:** ADR-0005 (cross-tenant via SECURITY DEFINER)
**Pattern rules honoured:** MUST #5 (platform context), MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** admin on dashboard
**When** page loads
**Then** real-time metrics render: active tenants count, MAU/WAU/DAU trends (from PostHog), total invoices last 30 days, total GMV, per-plan breakdown
**And** renders < 2s p95

**Given** CI runs, all gates pass; cross-tenant access audit-logged

**Tests required:** Unit, Integration, E2E

**Definition of Done:** All AC + 10 CI gates + Storybook MetricsDashboard + 5 review layers.

---

### Story 15.11: Platform Admin manages subscription plans + assigns to tenants + overrides status (grace/trial extend)

**Class:** A — Platform-global subscription plans + cross-tenant assignment + override grace period.

**As a Platform Admin**,
I want CRUD on plans (Starter / Pro / Enterprise) + per-tenant plan assignment + override tools for grace period or trial extension,
So that commercial flexibility doesn't require DB surgery.

**FRs implemented:** FR121, FR122
**NFRs verified:** NFR-S9
**Modules + packages touched:**
- `apps/api/src/modules/platform-admin/subscription.service.ts` (new)
- `packages/db/src/schema/plans.ts` + `subscriptions.ts` (new — platform-global plans; tenant-scoped subscriptions)
- `apps/admin/app/(auth)/plans/*` (new)
- `apps/admin/app/(auth)/tenants/[id]/subscription/page.tsx` (new)

**ADRs governing:** ADR-0010
**Pattern rules honoured:** MUST #5
**Complexity:** M

**Acceptance Criteria:**

**Given** admin creates plan "Pro · ₹2,499/month"
**When** saved
**Then** plan available for assignment; any tenant can switch plans with effective-from date
**And** override "Grace period extend +7 days" adjusts tenant's next-payment-due without changing plan

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation, E2E

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 15.12: Platform Admin configures global platform settings (vendor API creds, compliance-rule versioning) with MFA gate

**Class:** A — Secrets Manager writes (vendor API keys) + compliance-rules versioning + MFA gate.

**As a Platform Admin**,
I want to rotate vendor API keys (IBJA, Razorpay, AiSensy, Surepass) + version compliance rules (GST rate change) without code deploy — all MFA-gated,
So that operational changes don't require engineering + no secrets in code.

**FRs implemented:** FR126
**NFRs verified:** NFR-S11 (Secrets Manager), NFR-S14 (MFA)
**Modules + packages touched:**
- `apps/admin/app/(auth)/platform-settings/*` (new)
- `apps/api/src/modules/platform-admin/settings.service.ts` (new — writes to AWS Secrets Manager via packages/security/secrets)
- `packages/compliance/src/rules-versioning.ts` (used — compliance rules versioning)
- `packages/db/src/schema/compliance-rules-versions.ts` (new)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #5, MUST #9
**Complexity:** L

**Acceptance Criteria:**

**Given** admin rotates Razorpay API key
**When** saves with MFA re-auth
**Then** key persists to Secrets Manager; adapter picks up new key within 60s (secrets cache TTL)
**And** audit logs rotation event (not the key itself)

**Given** admin creates compliance-rules-version "GST rate 4% effective 2027-01-01"
**When** saved
**Then** rules-versioning module picks up new version at effective date; old invoices still tied to version they were created under
**And** migration plan + gradual rollout documented per ADR-0011

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (secrets rotation propagation), Compliance (rules versioning integrity)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

## Epic 16: Anchor jeweller goes live with confidence — performance, resilience, compliance, and 24-hour P1 support

**Goal (reframed per IR-report correction):** Not "hardening" — six specific user-value outcomes tied to measurable NFRs, culminating in anchor sign-off on production launch.

**FRs covered:** None new — cements NFRs + runbooks + observability as user-value
**Phase:** Phase 1 — Sprint 10 (final)
**Dependencies:** All prior epics

---

### Story 16.1: Anchor survives Dhanteras 10× load sustained 72 hours

**Class:** B — Load-testing scripts + performance verification; no code behavior change.

**As the Anchor Jeweller (Rajesh-ji on Dhanteras day)**,
I want the app to hold up when 40+ customers come through in 4 hours and keep that pace across Dhanteras week + Akshaya Tritiya week,
So that my biggest sales days don't turn into operational disasters.

**FRs implemented:** (NFR outcomes)
**NFRs verified:** NFR-P10 (10× baseline 72h), NFR-R2 (99.9% wedding-season), NFR-SC5 (auto-scaling)
**Modules + packages touched:**
- `packages/testing/load/k6-scripts/*` (new — k6 scripts simulating wedding-season load)
- `infra/terraform/modules/compute/auto-scaling.tf` (extend — policies tuned)
- `docs/runbooks/wedding-season-load-prep.md` (new)

**ADRs governing:** ADR-0012
**Pattern rules honoured:** MUST #8
**Complexity:** L

**Acceptance Criteria:**

**Given** staging env matches prod capacity
**When** k6 load test simulates 10× baseline (50 invoices/hour sustained → 500 invoices/hour × 72h)
**Then** all performance SLAs held: NFR-P4 invoice gen p95 < 5s; NFR-P6 sync p95 < 30s; NFR-P7 rate serve < 100ms; error rate < 0.5%
**And** auto-scaling scales ECS fleet 3→10 within 5 min of load spike; scales down after

**Given** the runbook is authored + rehearsed
**When** actual Dhanteras arrives
**Then** platform team has pre-verified capacity + monitoring dashboards + escalation paths

**Given** CI runs, load-test artifacts committed

**Tests required:** Load (k6 10× sustained 72h in staging), Chaos (primary RDS failover mid-load)

**Definition of Done:** All AC + load-test evidence committed + runbook rehearsed + 5 review layers.

---

### Story 16.2: Anchor data is always recoverable after outage

**Class:** C — Disaster-recovery runbook + drill documentation; no code changes.

**As the Anchor Jeweller**,
I want confidence that if power goes out mid-day or internet drops during a custom-order photo upload, nothing is lost — drill-verified,
So that I don't live in fear of cloud outages.

**FRs implemented:** (NFR outcomes)
**NFRs verified:** NFR-R5 (daily backups + PITR), NFR-R6 (RTO 4h MVP), NFR-R7 (RPO 1h MVP)
**Modules + packages touched:**
- `docs/runbooks/incident-response.md` (new)
- `docs/runbooks/offline-sync-recovery.md` (new)
- `docs/runbooks/mass-customer-deletion-request.md` (new)

**ADRs governing:** ADR-0004, ADR-0012
**Pattern rules honoured:** (cross-cutting)
**Complexity:** M

**Acceptance Criteria:**

**Given** staging env with realistic data
**When** platform team runs disaster-recovery drills: (a) RDS PITR restore to 30-min-ago snapshot, (b) offline-sync drill (disconnect shopkeeper tablet mid-transaction then reconnect), (c) mass deletion request
**Then** RTO measured ≤ 4h; RPO measured ≤ 1h; zero data loss on offline-sync drill; mass-deletion runbook end-to-end in < 24h

**Given** CI runs, drill artifacts committed

**Tests required:** Chaos (DB failure + restore), E2E (offline-sync drill), Runbook walkthrough

**Definition of Done:** All AC + drill evidence committed + 3 runbooks published + 5 review layers.

---

### Story 16.3: Anchor's tenant isolation is independently verified by external pentest

**Class:** C — External pentest scope + report docs; evidence-collection only.

**As the Anchor Jeweller**,
I want a third-party pentest signed off before any 2nd tenant is onboarded — to know my customer data is genuinely safe,
So that the foundational trust is externally validated.

**FRs implemented:** (NFR outcome)
**NFRs verified:** NFR-S8 (external pentest before T2), NFR-S13 (OWASP DAST)
**Modules + packages touched:**
- `docs/security/pentest-report.pdf` (new — from external firm)
- `docs/security/pentest-scope.md` (new — scope definition)

**ADRs governing:** ADR-0002 (isolation proved externally)
**Pattern rules honoured:** MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** external firm engaged with scope: multi-tenant RLS isolation + cross-tenant leak attempts + auth + PAN encryption + impersonation abuse
**When** pentest completes
**Then** zero critical/high findings accepted; any medium findings remediated; clean signed report on file
**And** before 2nd tenant onboards, report signed off

**Given** CI runs, pentest-report committed to private security folder

**Tests required:** External (pentest by firm), Internal (re-test any remediated findings)

**Definition of Done:** Clean pentest report + remediation tracking + sign-off + 5 review layers.

---

### Story 16.4: Anchor can reach a human in 5 minutes for P1 support

**Class:** B — P1 support SLA + Zoho Desk integration; operational outcome on safe surface.

**As the Anchor Jeweller (Rajesh-ji on a problem day)**,
I want a real human in 5 minutes via WhatsApp — not a chatbot — with 24h P1 resolution guarantee,
So that if my app breaks mid-Dhanteras, someone is actually answering.

**FRs implemented:** (Commercial SLA outcome)
**NFRs verified:** NFR-R9 (error budget + on-call), NFR-R10 (critical-path monitoring + alert), NFR-R11 (incident runbooks)
**Modules + packages touched:**
- `packages/integrations/support/zoho-desk-adapter.ts` (new — deferred unless contracted)
- `docs/runbooks/incident-response.md` (extend — P1 escalation path)
- Zoho Desk + WhatsApp-native support channel provisioned

**ADRs governing:** ADR-0006
**Pattern rules honoured:** (cross-cutting)
**Complexity:** M

**Acceptance Criteria:**

**Given** anchor raises a P1 ticket via WhatsApp
**When** ticket fires
**Then** routed to Zoho Desk; on-call agent acknowledges < 5 min; P1 resolution target < 24h
**And** 3 synthetic P1 tickets in final drill all resolved < 24h with < 5-min ack

**Given** CI runs, all gates pass

**Tests required:** Runbook drill (3 synthetic P1 tickets)

**Definition of Done:** All AC + 5 review layers + support-channel operational.

---

### Story 16.5: Anchor's telemetry tells us if the customer app is working (pivot-trigger gate)

**Class:** B — PostHog customer-app telemetry dashboard + events; observability only.

**As the Platform Team**,
I need DAU/WAU/MAU + engagement funnels visible from Day 0 of customer-app launch so the Month-6 pivot trigger per PRD §Success Criteria is actionable — not a scramble 30 days before the decision,
So that if customer engagement falls short, we pivot to shopkeeper-only SaaS confidently.

**FRs implemented:** (PRD §Success Criteria pivot-trigger gate)
**NFRs verified:** NFR-R10 (monitoring), NFR-C6 (PostHog residency-compliant)
**Modules + packages touched:**
- `apps/api/src/modules/observability/posthog-setup.ts` (extend — custom events for pivot-trigger cohorts)
- `apps/admin/app/(auth)/analytics/customer-engagement/page.tsx` (new — dashboard embedding PostHog)
- `docs/runbooks/monthly-pivot-check.md` (new)

**ADRs governing:** ADR-0012 (PostHog self-hosted Mumbai per NFR-C7)
**Pattern rules honoured:** MUST #8, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** customer app is about to launch
**When** 24h pre-launch check runs
**Then** PostHog DAU/WAU/MAU dashboards render real data for staging test users; critical-path funnels (rate view → product view → HUID scan → wishlist → rate-lock) show conversion rates
**And** alerts configured: DAU < 30% of transacting customers = amber; < 20% = red (per PRD pivot criteria)

**Given** CI runs, all gates pass; dashboard operational before customer app goes live

**Tests required:** E2E (dashboard renders real data), Runbook (Month-6 pivot check simulation)

**Definition of Done:** All AC + dashboard committed + runbook authored + 5 review layers.

---

### Story 16.6: Anchor sign-off day — demo walkthrough, production approval, reference commitment

**Class:** C — Anchor sign-off ceremony doc + checklist; governance doc only.

**As the Anchor Jeweller (Rajesh-ji)**,
I want a structured sign-off day where I walk through every capability, approve production launch, confirm zero unresolved P1 bugs, and commit to referring Goldsmith to at least one other jeweller,
So that my production go-live is explicit, celebrated, and documented.

**FRs implemented:** (PRD §Success Criteria final integration)
**NFRs verified:** (all NFRs cumulatively)
**Modules + packages touched:**
- `docs/runbooks/anchor-sign-off-day.md` (new — demo script + checklist)

**ADRs governing:** (all)
**Pattern rules honoured:** (all 10)
**Complexity:** L (integration ceremony)

**Acceptance Criteria:**

**Given** all Epic 1-15 stories merged + Stories 16.1-16.5 complete
**When** anchor walkthrough executes
**Then** demo script covers: billing 90s loop end-to-end, customer app + HUID ceremony on customer device, custom order creation + progress, rate-lock booking + redemption, settings self-service edit + customer app reflects in 30s, reports + GSTR export, compliance-hard-block moments, Dhanteras load survival (showcase staging load test), P1 support drill
**And** all 15 PRD Success Criteria items explicitly marked ✅ on sign-off checklist
**And** anchor signs production launch approval document
**And** anchor commits in writing to refer Goldsmith to ≥ 1 other jeweller within 90 days of launch

**Given** all 5 review layers pass on final merge train + Codex review approves
**When** production deploy executes
**Then** anchor is LIVE; DAU/WAU/MAU dashboard (Story 16.5) begins rendering real user data

**Tests required:** E2E (full demo walkthrough), Sign-off checklist walkthrough

**Definition of Done:** Anchor signature captured + zero unresolved P1 bugs + reference commitment documented + `.anchor-sign-off-passed` marker + 5 review layers.

---
