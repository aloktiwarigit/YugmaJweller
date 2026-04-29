# 0012 — IaC: Terraform over AWS CDK for MVP

**Status:** Superseded in part by ADR-0015 (2026-04-18). Terraform stays as the IaC tool of choice; provider swaps from `hashicorp/aws` to `hashicorp/azurerm`. `azd` (Azure Developer CLI) introduced as preferred front-end for app-centric infra; Terraform retained for complex custom topologies. AWS-specific rationale (SCP examples, CloudTrail) superseded. Full rewrite deferred until infrastructure story.
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Amelia (Dev), Alok (Agency)

## Context

Goldsmith hosts on AWS Mumbai (ap-south-1), with multi-service footprint: RDS, ElastiCache, ECS Fargate, ALB, CloudFront, Route 53, ACM, S3, Secrets Manager, KMS, IAM, VPC. Infrastructure must be:
- **Code-managed** (no Click-ops).
- **Environment-parameterizable** (dev / staging / prod).
- **Tenant-provisioning-orchestratable** (ADR-0010).
- **Operable by a 0.5-FTE DevOps** — choose a tool that a TS-heavy dev can also run.
- **Data-residency-enforceable** (SCPs + tagging).

Two finalists: **Terraform (HashiCorp)** and **AWS CDK (TypeScript)**.

## Decision

**Adopt Terraform with the HashiCorp AWS provider** for MVP. Revisit CDK at Phase 3+ if team preference or cloud portability (e.g., multi-cloud DR) creates pressure.

**Structure:**
```
infra/terraform/
  modules/
    network/              # VPC, subnets, NAT, NACLs, security groups
    database/             # RDS Multi-AZ Postgres 15, parameter group, options
    cache/                # ElastiCache Redis Multi-AZ
    compute/              # ECS cluster, Fargate task definitions, service auto-scaling
    storage/              # S3 buckets (per-env), CloudFront distributions, ImageKit origin setup
    dns-and-tls/          # Route 53 zones, ACM certs
    secrets/              # Secrets Manager + per-tenant paths
    observability/        # Sentry/OTel/PostHog self-hosted ECS services
    ci-roles/             # IAM roles for GitHub Actions + Terraform runs
  envs/
    dev/                  # dev-specific vars + backend config
    staging/
    prod/
  backend.tf              # S3 + DynamoDB state locking
  providers.tf            # AWS ap-south-1 + Cloudflare (optional) + PagerDuty
```

**Operational flow:**
- Local dev: `terraform plan` on PR, comment on PR with plan output.
- Merge to `main`: `terraform apply` gated by manual approval for prod (auto-approved for dev/staging).
- State backend: S3 (versioned + encrypted) + DynamoDB lock table in ap-south-1.
- Modules are reusable + versioned via Git tags.

**Tenant provisioning integration (ADR-0010):**
- Orchestrator Lambda calls Terraform Cloud API (or self-hosted `terraform` binary) with tenant-specific variables.
- Single shared Terraform workspace; per-tenant state isolation via resource-level tagging + naming conventions (not separate workspaces — 100+ workspaces is ops nightmare).

**Data-residency enforcement:**
- Every resource tagged `data-classification=<kind>` + `data-residency=ap-south-1`.
- AWS Organizations SCP denies any resource creation outside ap-south-1 (with explicit allow-list for ap-south-2 replicas planned for Phase 4+).
- Terraform CI step validates all resources in a plan carry the required tags; blocks apply on missing tags.

## Consequences

**Positive:**
- Mature HCL module ecosystem (terraform-aws-modules) covers 80% of our needs out of box.
- Wide community knowledge (DevOps candidates + consultants know Terraform).
- State-locking via DynamoDB is battle-tested.
- Clear separation of code + state (HCL is declarative, not code-mixed).
- Plan/apply workflow is easy to reason about + CI-integratable.

**Negative / trade-offs:**
- HCL is a separate language; team (TypeScript-heavy) must context-switch.
- Complex logic (e.g., conditional resource creation) is awkward in HCL — CDK shines here but our needs are modest.
- Terraform Cloud pricing for team feature at scale — MVP uses self-hosted Terraform state (S3+DynamoDB), no Terraform Cloud required.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **AWS CDK (TypeScript)** | Team preference could flip here; CDK's imperative TS is nice; BUT module ecosystem is less mature than Terraform for India-specific patterns (e.g., ECS + CloudFront + per-tenant CNAME patterns); state-management story via CDK CloudFormation has foot-guns; rollback is harder; defer to Phase 3+ as a possible migration |
| **Pulumi** | Small community in India; less mature module ecosystem; single-vendor risk |
| **Cloud Click-Ops + CloudFormation drift detection** | Untenable for ~100-tenant operation; no version control |
| **Serverless Framework** | Serverless-only focus; we have ECS + RDS + ElastiCache which don't fit |
| **Ansible + custom scripts** | Not declarative; drift-prone; huge foot-gun |

## Implementation Notes

### Module example — `database`

```hcl
# infra/terraform/modules/database/main.tf
resource "aws_db_instance" "main" {
  identifier              = "${var.env}-goldsmith-postgres"
  engine                  = "postgres"
  engine_version          = "15.5"
  instance_class          = var.instance_class
  allocated_storage       = var.allocated_storage
  multi_az                = var.env == "prod"
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.rds.arn
  backup_retention_period = 7
  deletion_protection     = var.env == "prod"
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  parameter_group_name    = aws_db_parameter_group.main.name
  tags = merge(var.base_tags, {
    Name                = "${var.env}-goldsmith-postgres"
    data-classification = "tenant-pii"
    data-residency      = "ap-south-1"
  })
}
```

### SCP denying out-of-region resources

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyOutsideApSouth1",
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "StringNotEquals": {
        "aws:RequestedRegion": ["ap-south-1"]
      },
      "StringNotLike": {
        "aws:PrincipalArn": "arn:aws:iam::*:role/TerraformAdmin"
      }
    }
  }]
}
```

### Tenant-tag validation in CI

```hcl
# infra/terraform/modules/validation/main.tf — uses data source to check tags at plan time
# Terraform Sentinel / OPA Conftest alternative for policy-as-code checks
```

## Revisit triggers

- Team grows past 10 engineers with preference for TypeScript-based IaC → evaluate CDK migration (plan → parity → cutover).
- Multi-cloud DR requirement emerges (e.g., ap-south-2 with GCP Mumbai backup) → Terraform's multi-provider strength wins here.
- Terraform upgrade cost (major version bump) becomes painful → consider CDK or Pulumi migration then.

## References

- PRD NFR-C7 (data residency), NFR-R1–R11 (reliability, DR)
- Architecture §Infrastructure & Deployment I2, I9
- CLAUDE.md Enterprise Floor
