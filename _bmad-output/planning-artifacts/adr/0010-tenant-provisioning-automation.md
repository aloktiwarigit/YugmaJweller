# 0010 — Tenant Provisioning: Scripted End-to-End with Terraform Orchestration

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Mary (BA), Alok (Agency)

## Context

PRD §Success Criteria + Journey 6 + FR1 commit to tenant onboarding time:
- Second jeweller: **< 3 weeks** by Month 9
- Tenth jeweller: **< 1 week** by Month 12

This requires tenant provisioning to be scripted end-to-end — no manual DevOps operations per tenant. PRD FR2 + FR3 specify the configurable inputs (branding, feature flags, domain). UX spec Flow 5 describes the admin-console flow.

## Decision

Tenant provisioning is a **single orchestrated workflow** triggered from the platform admin console, combining application-level (DB inserts, default settings, feature flags) and infra-level (Route 53 CNAME, ACM cert, S3 prefix IAM) operations. Executed via a Lambda-backed orchestrator that calls both (a) the API (for app-level) and (b) Terraform (for infra-level) atomically with rollback on partial failure.

**Tenant state machine:**
```
PROVISIONED → ONBOARDING → ACTIVE → (SUSPENDED ⇄ ACTIVE) → TERMINATED (soft, 30d) → TERMINATED (hard)
```

**Provisioning steps (in order, transactional):**
1. Admin enters tenant details in admin console (`apps/admin/app/provision`): shop name, GSTIN, BIS registration, owner phone, initial address, city, district (for BIS HUID mandatory-district check).
2. Admin uploads logo; chooses seed color (HCT-validated for WCAG AA before continuing); picks typography stack (default Devanagari Rozha One + Hind Siliguri + Fraunces); selects plan (Starter / Pro / Enterprise).
3. Admin picks feature flags per PRD scope: try-at-home (on/off), wholesale (on/off), gold-schemes (on/off), loyalty (on by default), customer-viewing-analytics (on by default with consent).
4. Admin picks custom domain OR auto-generates subdomain `<slug>.goldsmith-tenant.app`.
5. Orchestrator invokes `POST /api/v1/platform/tenants/provision` → validates all inputs.
6. Orchestrator invokes Terraform run (infra): Route 53 CNAME, ACM cert, S3 prefix IAM policy, per-tenant KMS CMK (for envelope encryption), per-tenant Meilisearch index create.
7. Orchestrator invokes API: insert `shops` row (state=PROVISIONED), insert default `shop_settings` row (with tenant-selected theme + flags), create first-owner shop_user row (state=INVITED with phone-OTP invite), enable RLS on tenant data scope.
8. Invite owner via WhatsApp + SMS → they receive a link to shopkeeper app + OTP flow.
9. Once owner verifies OTP + completes initial profile, tenant transitions PROVISIONED → ONBOARDING.
10. Owner inputs staff, makes first test invoice, confirms theme looks right in preview screens — transitions ONBOARDING → ACTIVE (auto-advance after 7 days if not manually set).

**Preview flow:**
- Before ACTIVE, owner sees a 5-screen preview (home, product, invoice, settings, customer app home) with their branding applied.
- Approval required; rejection loops back to theme configurator.

**Termination:**
- Admin initiates termination → transitions ACTIVE → TERMINATED (soft).
- 30-day grace period: tenant data read-only; shopkeeper can export.
- After 30 days: hard-delete data (except legally-retained invoice/KYC/compliance records per NFR-C5).
- CNAME removed; cert revoked; KMS CMK scheduled for deletion (crypto-shred PAN envelope-encrypted fields).

**Admin operations console:**
- Tenant list with filter (active, onboarding, suspended, terminated).
- Per-tenant detail: metrics, feature flags, plan, support access.
- One-click suspend / reactivate / terminate (all audit-logged).
- Impersonation (per ADR-0005) with TTL + MFA.
- Bulk operations (e.g., enable a new feature flag for all Pro-plan tenants).

## Consequences

**Positive:**
- 2nd tenant onboarding realistic at 2-3 weeks by M9 (admin-time + training); 10th tenant at < 1 week (workflow proven, anchor references).
- Zero custom code per tenant.
- All operations audit-logged; compliance-ready.
- Reversible: state machine supports suspend + reactivate; terminate has grace period.

**Negative / trade-offs:**
- Orchestrator lambda is a critical path — must be well-tested + idempotent (rollback on partial failure).
- Terraform runs from inside an orchestrator lambda is nontrivial — either use Terraform Cloud API or a self-hosted runner; tentative decision: Terraform Cloud API with workspace-per-tenant is too many workspaces; single shared workspace with targeted applies + module vars per tenant is the MVP approach.
- CNAME + ACM provisioning has a 1-30 minute DNS propagation window — tenant PROVISIONED state reflects "waiting for DNS" appropriately.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Manual per-tenant provisioning by DevOps** | Violates M9/M12 onboarding targets; 0.5-FTE DevOps cannot sustain |
| **Full self-service tenant signup** | Deferred to Phase 3+; MVP has admin-assisted provisioning (appropriate for first 10-20 tenants for quality + support) |
| **Separate API service per tenant** | Violates ADR-0009 modular-monolith + costs per tenant |
| **Manual Terraform applies triggered on PR** | Slower; human-in-loop bottleneck |

## Implementation Notes

### Orchestrator flow (pseudo)

```ts
// infra/scripts/tenant-provision.ts (runs in Lambda or long-running ECS task)
export async function provisionTenant(input: ProvisionInput): Promise<TenantProvisioned> {
  const txId = uuid();
  const rollbacks: (() => Promise<void>)[] = [];
  try {
    // Step 1: validate inputs + WCAG check
    validate(input);
    validateWcagAA(input.themeConfig);

    // Step 2: create infra via Terraform
    const infra = await terraform.apply('tenant-provision', {
      vars: { shop_slug: input.slug, custom_domain: input.domain }
    });
    rollbacks.push(() => terraform.destroy('tenant-provision', { vars: { ... } }));

    // Step 3: create app rows (transactional, inside API)
    const shop = await api.post('/platform/tenants', {
      idempotencyKey: txId,
      name: input.name,
      slug: input.slug,
      gstin: input.gstin,
      bisRegistration: input.bisRegistration,
      themeConfig: input.themeConfig,
      featureFlags: input.featureFlags,
      plan: input.plan,
      infraResources: {
        cnameDomain: infra.domain,
        s3Prefix: infra.s3Prefix,
        kmsCmkArn: infra.kmsCmkArn,
        meilisearchIndex: infra.meilisearchIndex,
      },
    });
    rollbacks.push(() => api.delete(`/platform/tenants/${shop.id}?hard=true`));

    // Step 4: invite owner
    await api.post(`/platform/tenants/${shop.id}/invite-owner`, {
      phone: input.ownerPhone,
      channel: 'whatsapp+sms',
    });

    return shop;
  } catch (err) {
    for (const rb of rollbacks.reverse()) {
      try { await rb(); } catch (rbErr) { sentry.captureException(rbErr); }
    }
    throw err;
  }
}
```

### Data-classification tags on infra

Terraform applies tagging:
```hcl
resource "aws_route53_record" "tenant_cname" {
  zone_id = var.zone_id
  name    = var.custom_domain
  type    = "CNAME"
  ttl     = 300
  records = [local.cloudfront_distribution]
  tags    = {
    shop_id              = var.shop_id
    data-classification  = "tenant-pii"
    data-residency       = "ap-south-1"
  }
}
```

## Revisit triggers

- Onboarding times regressing; add more automation (e.g., owner-phone-verified auto-advance to ACTIVE).
- Self-service signup demand emerges (Phase 3+); build guided self-provision flow.
- Terraform Cloud workspace costs or complexity warrant migration to CDK + CodePipeline.

## References

- PRD FR1–7, FR124, FR125, Journey 6
- UX spec §Flow 5: Tenant Onboarding
- Architecture §Infrastructure & Deployment, §Requirements-to-Structure
