# 0015 — Stack Correction: Azure + Firebase, Startup-Lean Infra (Revenue-First)

**Status:** Accepted
**Date:** 2026-04-18
**Deciders:** Alok (Agency/founder), Claude (Opus 4.7) as planning counterpart
**Supersedes:** parts of ADR-0001, ADR-0012, ADR-0013, ADR-0014 (see Amendments section)

## Context

The original architecture (ADRs 0001-0012, CLAUDE.md pre-2026-04-18) assumed AWS Mumbai (ap-south-1) with enterprise-grade infrastructure from Day 1: Multi-AZ RDS, 3× NAT gateways, ElastiCache Multi-AZ, per-tenant KMS CMKs, dedicated staging. Cost floor for a dev environment alone: ~$150-200/month. For a prod + dev setup approaching anchor launch: ~$400-500/month.

During E2-S1 execution (the tenant-RLS scaffolding story), two uncoordinated assumptions in the prior architecture surfaced:

1. **Cloud mismatch.** Alok's primary cloud is Microsoft Azure, not AWS. The AWS default was inherited from generic architecture patterns, never validated against the actual operator's expertise and account access. Azure Central India / South India are first-class AWS ap-south-1 equivalents for India data residency.

2. **Cost/stage mismatch.** Goldsmith is pre-revenue. Anchor SOW is not yet signed (the #1 blocker per PRFAQ). Running always-on Multi-AZ infrastructure before the first paying tenant is cash burn against a venture whose viability is still being validated. The original CLAUDE.md "Enterprise Floor" conflated two distinct concerns — **code-quality enterprise floor** (TS strict, 80% coverage, Sentry, OTel, threat model, ADRs — all free or near-free) and **infrastructure enterprise floor** (Multi-AZ, NAT redundancy, per-tenant KMS, Redis clusters — real dollars per month) — and demanded both from Day 1.

Alok's stated principle (2026-04-18, verbatim):

> "We have to prove first it can generate revenue with minimum cost then only we can plan for better infra later."

This ADR records the correction.

## Decision

### Stack: Azure + Firebase

| Concern | Primary | Rationale |
|---------|---------|-----------|
| Compute | **Azure Container Apps** (consumption tier, scale-to-zero) | Free when idle; pay-per-request; no VM management |
| Database | **Azure Database for PostgreSQL Flexible Server**, Burstable B1ms | ~$12/mo; Postgres 15.x; supports RLS unchanged |
| Cache / queue backing | **Defer Redis in MVP.** In-process LRU + Postgres rate-limit table. Re-add Azure Cache for Redis when backpressure justifies | $0 in MVP, ~$16/mo when needed |
| Queue | **Defer BullMQ.** Postgres jobs table + `LISTEN/NOTIFY` or Azure Container Apps jobs | $0 in MVP |
| Secrets / keys | **Azure Key Vault** (single platform-level vault, single KEK) | ~$1/mo + pennies per op; per-tenant keys **deferred** until compliance audit or regulator asks |
| Identity (end users) | **Firebase Auth** (phone OTP) | Free Spark tier for MVP phone OTP; pay-as-you-go $0.06/SMS when exceeded; replaces MSG91 + custom OTP stack |
| Push notifications | **Firebase Cloud Messaging (FCM)** | Free, already in vendor stack |
| Identity (platform admin) | **Microsoft Entra ID (Azure AD)** | Free tier covers small team |
| Storage | **Azure Blob Storage** (Hot tier) | Pennies/month; data residency in Central India |
| CDN | **ImageKit** (unchanged) | Vendor stack consistent |
| IaC | **`azd` (Azure Developer CLI)** as primary; Terraform `azurerm` provider for cases where `azd` doesn't fit | `azd init + azd up` ships infra-to-deployed in minutes; Terraform retains option for future complex topologies |
| Region | **Azure Central India (Pune)** or **South India (Chennai)** | DPDPA data residency requirement (NFR-C7) |
| Observability | Pino + Sentry + OpenTelemetry + PostHog (unchanged) | All have free tiers; cloud-neutral |
| Hosting decision deadline | **Not before anchor SOW is signed** | No production Azure subscription stood up until revenue is contracted |

### Infrastructure MVP cost target: ≤ $20/month when anchor launches

**Target infra spend at first paying tenant:**
- Azure Container Apps (consumption, one service, scale-to-zero): ~$0-3/mo
- Azure Postgres Flexible Server Burstable B1ms: ~$12-15/mo
- Azure Key Vault: ~$1/mo
- Azure Blob Storage Hot: ~$1-2/mo
- Firebase Auth + FCM (Spark): $0 at MVP phone-OTP volumes
- Azure Entra ID (free tier): $0
- **Total: ~$15-20/mo**

**Graduation triggers (only then add enterprise infra):**
- First paying anchor signs SOW with measurable MRR
- Regulatory audit (DPDPA compliance review, RBI inquiry) demands Multi-AZ / per-tenant KEK / cross-region DR
- Observable traffic / tenant-count destabilises current stack (p95 latency SLO breach, connection saturation)

### Documentation scope for this correction

**Amended in this ADR session (minimum viable):**
- `CLAUDE.md` — Tech stack Hosting/Auth/File storage/Email lines; vendor stack SMS/OTP; new Startup Economics section; Azure subscription listed as SOW-gated blocker.
- This ADR (0015) itself documents the course correction.
- Superseded notes prepended to ADR-0001, ADR-0012, ADR-0013, ADR-0014.
- `docs/superpowers/plans/2026-04-18-E2-S1-tenant-rls-scaffolding.md` — Tasks 4/5/6 (AWS Terraform) removed from E2-S1 scope; Tasks 23/28/29 AWS refs swapped to Azure/Firebase.

**Deferred to Infrastructure Story** (new story, post-anchor-SOW):
- Full rewrite of `_bmad-output/planning-artifacts/architecture.md` (~2000 lines, AWS→Azure translation).
- PRD NFR-C7 wording update (ap-south-1 → Azure India region).
- Story 1.1 rewrite for Firebase Auth (replaces Supabase Auth adapter).
- Runbook `scripts/tenant-provision.sh` + `tenant-delete.sh` AWS-CLI→`az`-CLI translation.
- ADR-0013 full Azure Key Vault rewrite (currently flagged superseded here).
- ADR-0014 full Azure Postgres PITR rewrite (currently flagged superseded here).

Rationale for the deferral: the architecture / PRD / runbook rewrites are ~6-8 hours of careful editing that would burn attention on documents we'll revisit anyway when actually standing up infrastructure. Amending them now without standing up infra just risks the docs drifting from whatever actually ships. Better to update in the same session as the azd scaffold work.

## Consequences

**Positive:**
- MVP infra cost floor drops from ~$200/mo to ~$20/mo — 10× runway extension on the same funding.
- Azure + Firebase matches the operator's expertise, reducing operational errors during anchor launch.
- Firebase Auth eliminates an entire vendor dependency (MSG91) and a custom OTP flow from MVP scope.
- Scale-to-zero compute means idle environments are genuinely free.
- Startup-economics principle codified — future decisions have a durable answer on "can we afford this yet?".

**Negative / trade-offs:**
- Existing 6 AWS Terraform commits (c5b9e96..d4705a1) are reset off the feature branch. Work is not lost — patterns are reusable when writing Azure equivalents — but the HCL itself is thrown away.
- No Redis in MVP means rate-limiting / async jobs use Postgres-only patterns that will need migration to Redis+BullMQ when volume justifies. The migration is a real future cost.
- Single AZ Postgres means a zone outage takes the service down. Acceptable trade-off pre-revenue; must upgrade before anchor go-live.
- Azure Container Apps consumption has a cold-start penalty (~500ms-2s) on first request after idle. Acceptable for jeweller-app UX where sessions are long-lived.
- Some prior ADRs (0013, 0014) reference AWS KMS / AWS RDS specifics that no longer apply until their Azure rewrites land.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Stay on AWS** | Operator's expertise is Azure; generic AWS default was unjustified |
| **GCP + Firebase** (Firestore + Cloud Run) | Firestore's multi-tenancy model is weaker than Postgres RLS; switching the data layer restarts our RLS work |
| **Supabase (Postgres + Auth)** | Free tier has limits that would be hit quickly; Supabase US region conflicts with India data residency; managed but not free beyond hobby scale |
| **Pure Firebase (Firestore + Auth + Functions)** | Firestore's security-rules model doesn't give us Postgres RLS; we've already built RLS-based architecture |
| **Self-hosted everything (Hetzner / Contabo)** | Management overhead + no SOC 2 / India-sovereignty story for DPDPA compliance |
| **Azure `Burstable B1ms` + always-on Container App** (no scale-to-zero) | ~$20-30/mo compute floor without scale-to-zero; Consumption tier is strictly better until traffic is steady |

## Revisit triggers

- First paying anchor signs SOW → stand up real Azure subscription, `azd up` dev environment, then plan prod environment.
- Azure Container Apps consumption cold-start becomes user-visible latency issue → graduate to Container Apps `Dedicated` or App Service.
- Postgres Burstable B1ms saturation (> 80% CPU sustained or connection limit hit) → graduate to General Purpose D2ds_v5.
- DPDPA compliance audit or a tenant contract demanding per-tenant KEK → rewrite ADR-0013 with Azure Key Vault key-per-tenant implementation.
- Traffic volume justifies Redis → add Azure Cache for Redis, restore BullMQ.
- Regulator requires cross-AZ / cross-region DR → graduate to Multi-AZ Flexible Server + geo-redundant backup.

## Amendments applied to superseded ADRs

- **ADR-0001 (Supabase Auth):** Primary chosen vendor swaps to Firebase Auth. Supabase Auth remains listed as an alternative. Full amendment deferred to the Infrastructure Story.
- **ADR-0012 (Terraform over CDK, AWS provider ecosystem):** Decision to use Terraform over CDK stands. The provider becomes `azurerm` instead of `aws`. `azd` (Azure Developer CLI) is introduced as the preferred front-end for application-centric infra; Terraform is retained for complex custom topologies. The AWS-specific rationale (module ecosystem maturity on AWS, SCP examples) is superseded.
- **ADR-0013 (per-tenant KEK via AWS KMS CMK):** Decision stands in principle (per-tenant KEK + envelope encryption). Concrete implementation swaps from AWS KMS CMK to Azure Key Vault key per tenant (access via RBAC, `ScheduleKeyDeletion` becomes `purge protection + soft delete`). Full rewrite deferred; for MVP a single platform KEK is acceptable until a tenant contract demands per-tenant.
- **ADR-0014 (PITR under DPDPA erasure, AWS RDS):** Decision stands in principle (documented residual, DPO sign-off). AWS RDS PITR specifics (7-day retention default, CloudTrail on PITR API calls) swap to Azure Postgres Flexible Server PITR (configurable 1-35 days) + Azure Activity Log. Full rewrite deferred.

## References

- Memory: `user_cloud_preference.md`, `feedback_startup_economics_first.md`
- PRFAQ: Anchor SOW is #1 blocker → validates "don't spend until revenue contracted"
- PRD: NFR-C7 (data residency India) remains satisfied by Azure Central India / South India
- CLAUDE.md (this project): Tech stack + Startup economics sections updated 2026-04-18
- Previous ADRs: 0001, 0012, 0013, 0014 (partial supersede annotations)
