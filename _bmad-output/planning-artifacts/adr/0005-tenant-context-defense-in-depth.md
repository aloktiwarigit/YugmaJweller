# 0005 — Tenant Context Propagation: Two-Layer Guard + RLS Enforcement

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Murat (Test Architect)

## Context

ADR-0002 locks the multi-tenant isolation strategy (single DB + RLS + interceptor). This ADR specifies **how tenant context is propagated through the request path** so every layer — controller, service, repository, DB — agrees on the tenant boundary.

Failure modes to prevent:
- Controller extracts tenant correctly, service forgets, repo runs unscoped query.
- Interceptor fails silently, downstream code assumes tenant present.
- Background job picks up tenant_id from user input instead of trusted source.
- Admin impersonation accidentally stays active beyond the intended window.

## Decision

**Tenant resolution priority (set once at the edge, never re-derived):**
1. Host / CNAME resolution (customer web / customer mobile when on tenant-branded domain).
2. `X-Tenant-Id` header (shopkeeper mobile + explicit cross-tenant contexts).
3. JWT claim `shop_id` (shopkeeper app where single-tenant session).
4. Platform admin with `X-Impersonate-Tenant-Id` header (audit-logged, MFA-required, time-limited).

**`TenantContext` type (request-scoped, immutable):**
```ts
interface TenantContext {
  shopId: string;            // UUID
  tenant: Tenant;            // loaded from DB (active status validated)
  userId: string;            // JWT sub
  role: Role;                // resolved via role_permissions lookup
  isImpersonating: boolean;  // true only for platform-admin-impersonated requests
  impersonationAuditId?: string;
}
```

**Propagation rules:**
- `TenantInterceptor` resolves and sets `req.tenantContext` before any controller runs.
- Controllers extract via `@TenantContext()` custom decorator (param decorator).
- Services accept `ctx: TenantContext` as first parameter — NEVER accept raw `shopId`.
- Repositories accept `ctx` + wrap every transaction with `SET LOCAL app.current_shop_id = ${ctx.shopId}` BEFORE any query.
- Background jobs receive `{ tenantId }` in payload; worker hydrates `TenantContext` at job start (re-validates tenant is ACTIVE).
- Events include `tenantId` in metadata; consumers re-hydrate context.

**Enforcement:**
- ESLint rule `goldsmith/no-raw-shop-id-param` forbids `shopId: string` as a service method parameter (require `ctx: TenantContext`).
- Semgrep rule `goldsmith/require-tenant-transaction` scans for DB transactions without `SET LOCAL app.current_shop_id` and flags them.
- Tenant-isolation test suite asserts every endpoint respects tenant boundary.
- Platform-admin privileged paths use `SECURITY DEFINER` Postgres functions that (a) require `platform_admin` DB role, (b) audit-log the bypass with action + subject + impersonation_audit_id.

**Impersonation workflow (platform admin only):**
1. Admin initiates impersonation via `POST /api/v1/platform/impersonate` with target `shop_id` + justification + TTL (max 60 minutes).
2. Audit log records start event; ephemeral token issued with `imp: true` claim + `exp` matching TTL.
3. All requests with impersonation token audit-log per-action.
4. End-impersonation event logged; admin must reauthorize for subsequent sessions.
5. Impersonated read-only by default; write access requires explicit escalation (second-step approval).

## Consequences

**Positive:**
- Tenant boundary is set once, propagated unchanged through the full request tree.
- Services cannot forget to scope (compile error via ESLint).
- DB layer is a hard floor (RLS blocks even if all app-layer guards fail).
- Impersonation is a rare, audited, time-bound event — not a silent side-door.
- Background jobs re-validate tenant is ACTIVE before processing (prevents work on terminated tenants).

**Negative / trade-offs:**
- Every service method has `ctx` as first parameter — verbose but consistent.
- Hydrating `TenantContext` adds ~1 DB round-trip per request — mitigated by cache (`packages/tenant-config/cache`) with 60s TTL.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **AsyncLocalStorage for implicit context** | Implicit = forgettable; harder to test; stack-trace confusion; we want explicit `ctx` param as a discipline |
| **Global middleware state (request.scope.tenantId)** | Same problem as ALS; no compile-time guarantee |
| **Tenant set via thread-local** | Node is single-threaded async; would need ALS (see above) |
| **Let controllers pass shopId manually** | Easy to forget; no compile-time guard |

## Implementation Notes

### Custom decorator

```ts
// apps/api/src/common/decorators/tenant-context.decorator.ts
export const TenantContextDec = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.tenantContext) {
      throw new InternalServerErrorException('tenant.context_not_set');
    }
    return request.tenantContext;
  }
);
```

### Service signature convention

```ts
// GOOD
async create(ctx: TenantContext, input: CreateInvoiceDto): Promise<Invoice> { ... }

// BAD — rejected by ESLint
async create(shopId: string, input: CreateInvoiceDto): Promise<Invoice> { ... }
```

### Worker hydration

```ts
// apps/api/src/workers/base.processor.ts
@Processor('any-queue')
export class BaseProcessor extends WorkerHost {
  async process(job: Job<{ tenantId: string; ... }>) {
    const tenant = await this.tenantService.getActive(job.data.tenantId);
    if (!tenant) throw new Error('tenant.inactive');
    const ctx: TenantContext = { shopId: tenant.id, tenant, /* worker-role */ };
    return this.handle(ctx, job.data);
  }
}
```

## Revisit triggers

- Multi-tenant impersonation becomes routine (>10/day) — invest in a dedicated admin UI + workflow instead of ad-hoc justification text.
- Tenant context hydration becomes a hot path bottleneck — extend cache TTL or denormalize into JWT claims.

## References

- ADR-0002 (isolation strategy this builds on)
- Architecture §Patterns Tenant-context, Audit
- PRD FR1–7 + FR123 (platform-admin impersonation)
