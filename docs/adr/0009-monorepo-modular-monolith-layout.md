# 0009 — Backend Topology: Modular Monolith NestJS; Microservices Deferred with Extraction Plan

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Amelia (Dev), Alok (Agency)

## Context

The backend must serve four frontends (shopkeeper mobile, customer mobile, customer web, platform admin web), host ~14 bounded contexts (tenant, auth, settings, inventory, pricing, billing, compliance, crm, viewing-analytics, loyalty, custom-order, rate-lock, try-at-home, notifications, reviews, reports, platform-admin, sync, webhooks), and process background jobs. MVP team is 5 FTE + 0.5 DevOps.

Three topologies considered:
1. **Modular monolith** — single deployable; strict module boundaries; NestJS provides the module primitive.
2. **Microservices from Day 1** — each bounded context as its own service.
3. **BFF-per-app + shared core** — thin BFF per frontend; shared domain services.

## Decision

**MVP: single modular-monolith NestJS backend** (`apps/api`) with strict module boundaries (one module per bounded context). Microservices extraction deferred; each module is designed to be extractable when pressure justifies.

**Module boundaries (binding):**
- Module A calls module B ONLY via (a) injected NestJS provider that B exposes in `<domain>.module.ts` OR (b) emitted domain event consumed by B's listener.
- No `import { FooRepository } from '../bar/bar.repository'` — cross-module data access happens via service-level API only.
- ESLint `no-restricted-imports` rule enforces: module A cannot import from module B's `repository`, `types`, or `state-machine` files. Only exported service interfaces.
- Shared cross-cutting lives in `packages/*` — tenant-config, compliance, money, audit, events, security, observability.

**Deployment unit:**
- One container image `goldsmith-api`, run in two modes: API server (`main.ts`) and worker pool (`worker.ts`).
- Both read the same codebase and config, differ only in bootstrap + process lifecycle.

**Shared database but separate schemas per bounded context's table families:**
- Not per-context Postgres schemas; tables are grouped logically but share the `public` schema for simpler migrations.
- Per-module tables clearly owned (e.g., Billing module owns `invoices`, `invoice_items`, `payments`; other modules read via Billing service, not directly).

### Extraction plan (when we'll split)

Each module is designed to be extractable. The plan anticipates the order and trigger conditions:

| Module | Earliest extraction | Trigger |
|--------|---------------------|---------|
| `notifications` | Phase 2 | WhatsApp throughput + backlog exceed single-instance Redis; easier to scale independently |
| `reports` | Phase 2 | Heavy query workloads impact API p95; extract to dedicated read-replica + service |
| `viewing-analytics` | Phase 2 | Event ingestion volume exceeds comfortable Postgres load; extract to ClickHouse + service |
| `search` | Phase 2 | Meilisearch ops grow complex + indexing fan-out cost-pressures API |
| `platform-admin` | Phase 3 | Privileged cross-tenant path warrants separate deployment + stricter access controls |
| `custom-order`, `rate-lock`, `try-at-home` | Phase 3+ | Only if team size + deploy cadence forces |

**Extraction mechanics:** 
- Each module already depends only on port interfaces (repositories, vendor adapters, event bus) — lift the module into its own app folder, change events from in-process to queue-backed, deploy independently.
- State machines + aggregates stay intact; HTTP surface stays identical.

## Consequences

**Positive:**
- 5-FTE + 0.5-DevOps team can operate the system (one deploy pipeline, one monitoring dashboard set, one set of runbooks).
- Fastest time-to-first-paying-tenant — no microservice tax on Day 1.
- Module boundaries are real (enforced by ESLint + code review) so extraction is a refactor, not a rewrite.
- Cross-module operations (e.g., create invoice → accrue loyalty → update PMLA → send WhatsApp) are transactionally consistent in-process; easier testing; easier debugging.

**Negative / trade-offs:**
- Any module's bug can crash the whole API process — mitigated by error boundaries + health checks + horizontal scaling + BullMQ DLQ.
- Team-scale limit: ~10-15 engineers before merge conflicts + deploy contention force extraction.
- Database contention across modules must be monitored; read replicas + materialized views as the first optimization before extraction.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Microservices from Day 1** | Operational cost too high for 0.5 DevOps; deploy-choreography slows shipping; observability fan-out; distributed transactions painful for invoice-creation flow |
| **BFF-per-app + shared core** | Adds a second service layer; our 4 apps consume mostly the same API; simple REST per `apps/api/modules/<domain>` with per-app view adapters in `packages/api-client` is sufficient |
| **Serverless functions per endpoint** | Cold-start unpredictability; harder to enforce RLS transaction wrapping; harder to share worker pool; not aligned with team expertise |
| **Single-file "god app"** | No module boundaries = re-architecture debt later |

## Implementation Notes

### Module boundary example

```ts
// apps/api/src/modules/billing/billing.module.ts
@Module({
  imports: [CrmModule, InventoryModule, PricingModule, NotificationsModule, ComplianceModule],
  controllers: [BillingController],
  providers: [BillingService, InvoiceRepository, /* internal */],
  exports: [BillingService, /* NO InvoiceRepository — internal */],
})
export class BillingModule {}

// apps/api/src/modules/loyalty/loyalty.service.ts
@Injectable()
export class LoyaltyService {
  constructor(
    private readonly billing: BillingService, // OK — billing exports the service
    // private readonly invoiceRepo: InvoiceRepository, // BAD — not exported; ESLint rejects
  ) {}

  @OnEvent('invoice.created')
  async onInvoiceCreated(event: InvoiceCreatedEvent) {
    // consume event instead of reaching into billing internals
    await this.accruePoints(event.ctx, event.invoice);
  }
}
```

### ESLint rule (conceptual)

```js
// eslint.config.js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/modules/*/repositories/*', '**/modules/*/state-machine*'],
          message: 'Do not reach into another module\'s internals. Use its exported service.',
        },
      ],
    }],
  },
}
```

## Revisit triggers

- Team grows past 10 engineers with merge-conflict velocity loss.
- One module's deploy cadence materially differs from others.
- Regulatory requirement forces deployment isolation (e.g., PMLA-reporting in a separate compliance-zone).
- Observability surfacing shows one module dominating latency/errors, extraction would reduce blast radius.

## References

- Architecture §Service Boundaries
- Agency Delivery Protocol (modular-monolith default)
- PRD §Scale & Complexity
