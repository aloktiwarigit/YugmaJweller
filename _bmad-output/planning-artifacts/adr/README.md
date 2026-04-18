# Architectural Decision Records — Goldsmith

This directory holds the authoritative ADRs for the Goldsmith platform. Each ADR documents one locked architectural decision with its context, consequences, and rejected alternatives. ADRs are numbered sequentially and NEVER renumbered; superseded decisions stay in place with a `Superseded by: NNNN` link so future teams understand evolution.

**Format:** [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision Records), trimmed for this project's working style.

**Authorship rule:** Every locked decision in `_bmad-output/planning-artifacts/architecture.md` maps to exactly one ADR here. Any PR that modifies a locked decision OR touches `packages/compliance` / `packages/money` / `packages/db/policies` / `packages/tenant-config` MUST update or append an ADR with rationale.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| 0001 | Auth provider — Supabase Auth (Mumbai) for phone OTP | Accepted | 2026-04-17 |
| 0002 | Multi-tenant isolation — single DB + RLS + interceptor (defense-in-depth) | Accepted | 2026-04-17 |
| 0003 | Money + weight primitives — DECIMAL-only, never FLOAT | Accepted | 2026-04-17 |
| 0004 | Offline sync — pull-then-push with per-aggregate conflict policy | Accepted | 2026-04-17 |
| 0005 | Tenant context propagation — two-layer guard + RLS enforcement | Accepted | 2026-04-17 |
| 0006 | Vendor integrations — adapter-port pattern with fallback chain | Accepted | 2026-04-17 |
| 0007 | Near-real-time sync — TanStack Query polling for MVP | Accepted | 2026-04-17 |
| 0008 | White-label — shared app with tenant theming; per-tenant native apps deferred | Accepted | 2026-04-17 |
| 0009 | Backend topology — modular monolith NestJS; microservices deferred with extraction plan | Accepted | 2026-04-17 |
| 0010 | Tenant provisioning — scripted end-to-end with Terraform orchestration | Accepted | 2026-04-17 |
| 0011 | Compliance — dedicated package with pure-function hard-block gateway | Accepted | 2026-04-17 |
| 0012 | IaC — Terraform over AWS CDK for MVP | Accepted | 2026-04-17 |
