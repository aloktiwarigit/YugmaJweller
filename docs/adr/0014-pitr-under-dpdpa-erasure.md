# 0014 — PITR Retention vs DPDPA Erasure — Documented Residual

**Status:** Superseded in part by ADR-0015 (2026-04-18). Principle stands (documented residual + DPO sign-off). AWS RDS PITR specifics swap to **Azure Postgres Flexible Server PITR** (configurable 1-35 days) + Azure Activity Log audit. Full Azure rewrite deferred to infrastructure story.
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
