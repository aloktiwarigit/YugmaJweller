# 0002 — Multi-Tenant Isolation: Single DB + Row-Level Security + Interceptor (Defense-in-Depth)

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Murat (Test Architect)
**Consulted:** Mary (BA on tenant-lifecycle semantics), Alok (Agency)

## Context

PRD FR1–7 + FR5 + NFR-S7 + NFR-S8 require **zero cross-tenant data exposure**. Multi-tenancy is the defining architectural challenge per PRD §Project Classification. Tenant isolation failure is business-ending: a single shop seeing another shop's invoices or customer PII would destroy trust + expose us to DPDPA fines up to Rs 250 crore.

At the same time, MVP operates with a 5-FTE team + 0.5 DevOps. We must not adopt isolation architecture we cannot operate reliably.

Three isolation strategies were compared:

1. **Single DB, shared tables, `shop_id` + RLS** — per-row isolation enforced by PostgreSQL.
2. **Single DB, schema-per-tenant** — per-schema isolation.
3. **DB-per-tenant** — strongest isolation, no shared substrate.

## Decision

Adopt **single DB, shared tables, `shop_id` column + PostgreSQL Row-Level Security (RLS) policies + NestJS `TenantInterceptor` (application-layer guard)** as defense-in-depth. Both layers independently enforce tenant scoping; either catches the other's bug.

**Database layer:**
- Every tenant-scoped table has `shop_id UUID NOT NULL REFERENCES shops(id)` + foreign-key constraint.
- RLS policy on every tenant-scoped table: `USING (shop_id = current_setting('app.current_shop_id')::uuid)`.
- Default Postgres role (`app_user`) is subject to RLS; platform-admin role (`platform_admin`) bypasses RLS via `SECURITY DEFINER` functions (audit-logged).
- Platform-global tables (e.g., `ibja_rate_snapshots`, `feature_flags_defaults`, `compliance_rules_versions`) have no `shop_id` and are readable by all tenants.

**Application layer:**
- NestJS `TenantInterceptor` resolves tenant from (host CNAME → `X-Tenant-Id` → JWT claim) in that priority.
- Interceptor validates tenant exists + is ACTIVE + user is entitled.
- Drizzle DB provider wraps every transaction with `SET LOCAL app.current_shop_id = '<uuid>'` before any query runs.
- Services NEVER accept `shop_id` as a parameter; they read from injected `TenantContext`.

**Testing layer:**
- `packages/testing/tenant-isolation` provides a harness that (a) provisions 3 tenants with distinct data, (b) calls every API endpoint with tenant A's JWT, (c) asserts NO data from B or C is ever returned, (d) also asserts direct DB reads without `SET LOCAL` throw, (e) runs on every CI run + blocks merges on any cross-tenant leak.
- Ships with Epic 1 (non-optional from Sprint 1).

## Consequences

**Positive:**
- Two independent failure modes — RLS catches interceptor bugs; interceptor catches RLS misconfiguration.
- Shared DB = cheap 10th tenant (the economic substrate); operable by 0.5 DevOps.
- PostgreSQL RLS is production-proven + battle-tested; policy syntax is declarative + reviewable.
- Single schema means single migration story across tenants (no fan-out migration orchestration).
- Testing is straightforward: one Postgres instance, 3 tenants, done.

**Negative / trade-offs:**
- Noisy-neighbour risk if one tenant's workload starves others — mitigated via per-tenant rate limits + BullMQ partitioning + read replicas.
- RLS performance overhead (~5% per query) accepted.
- Cross-tenant platform-admin queries require explicit `SECURITY DEFINER` functions; cannot use same code paths.
- Bugs that bypass both layers (e.g., raw SQL without `SET LOCAL`) could leak — mitigated via Semgrep rule requiring `SET LOCAL` at every transaction boundary + tenant-isolation test suite.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Schema-per-tenant** | Migration operational cost is 100× at 100-tenant scale; connection-pool overhead (N pools or schema-switching); backup complexity |
| **DB-per-tenant** | Strong isolation but prohibitive cost; one backup/upgrade per tenant; cannot operate with 5-FTE team; reserved for Phase 4+ VIP-tenant option |
| **Single DB, `shop_id` only, no RLS** | Single layer of enforcement; one bug = data leak; unacceptable for compliance |
| **Application-layer-only isolation (manual WHERE clauses)** | Easy to forget; no DB backstop; strongly rejected |

## Implementation Notes

### Migration template (every new tenant-scoped table)

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES customers(id),
  total_paise BIGINT NOT NULL,
  -- ... other columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_shop_id_created_at ON invoices (shop_id, created_at DESC);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_invoices_tenant_isolation ON invoices
  FOR ALL
  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
```

### Interceptor pseudo-code

```ts
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const shopId = resolveTenant(req); // from host / X-Tenant-Id / JWT
    if (!shopId) throw new UnauthorizedException('tenant.resolution_failed');
    const tenant = await this.tenantService.getActive(shopId);
    if (!tenant) throw new ForbiddenException('tenant.inactive');
    req.tenantContext = { shopId, tenant };
    return next.handle();
  }
}
```

### DB transaction wrapper

```ts
async function withTenantTx<T>(ctx: TenantContext, fn: (tx: DrizzleTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_shop_id = ${ctx.shopId}`);
    return fn(tx);
  });
}
```

## Revisit triggers

- RLS performance becomes material bottleneck (>15% overhead in profiling).
- Regulatory requirement emerges for stronger isolation (e.g., tenant-crypto-shred on deletion needs separate tenant CMK — we do app-layer envelope encryption for that already).
- Single-DB contention requires sharding (documented in ADR-0009 extraction plan).
- Enterprise tenant with contractual DB-per-tenant requirement — add a tiered option.

## References

- PRD FR1–7, FR5, NFR-S7, NFR-S8
- Architecture §Data Architecture D3, §Patterns Tenant-context, §Testing tenant-isolation
- PostgreSQL RLS docs: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
