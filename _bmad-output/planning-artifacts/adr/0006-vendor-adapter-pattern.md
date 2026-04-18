# 0006 — Vendor Integrations: Adapter-Port Pattern with Fallback Chain

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Mary (BA on vendor risk), Alok (Agency)
**Consulted:** Murat (Test Architect on contract tests)

## Context

Goldsmith depends on **~12 third-party vendors** (IBJA, Razorpay, Cashfree, AiSensy, MSG91, Digio, Ola Maps, ImageKit, FCM, Surepass, PostHog, Sentry, Resend/SES, Supabase Auth). Each has unique quirks, quota limits, downtime incidents. NFR-I1 mandates adapter pattern: "vendor swap = adapter rewrite only, not data migration or business-logic change."

Goals:
1. Business-logic code never imports vendor SDKs directly — always via a port interface.
2. Primary + fallback vendors for critical paths (rates, payments, WhatsApp).
3. Contract tests ensure adapters honour the port exactly.
4. Circuit breaker + exponential backoff uniform across all integrations.
5. Webhook handling is idempotent + signature-verified per vendor.

## Decision

Adopt the **Ports & Adapters (Hexagonal) pattern** for all vendor integrations:

**Structure:**
```
packages/integrations/<vendor-category>/
  src/
    port.ts                 # Interface only (the "Port"); business logic depends on this
    <primary>-adapter.ts    # Primary vendor impl (e.g., razorpay-adapter)
    <fallback>-adapter.ts   # Fallback vendor (e.g., cashfree-adapter) — only for critical paths
    mock-adapter.ts         # For tests
    fallback-chain.ts       # Orchestrates primary → fallback → cache
    errors.ts               # Port-level errors (mapped from vendor-specific errors)
    contract-tests.ts       # Tests every adapter honours the port
```

**Port interface (example — `RatesPort`):**
```ts
export interface RatesPort {
  getRatesByPurity(): Promise<Record<Purity, { perGramPaise: MoneyInPaise; fetchedAt: Date }>>;
  getRate(purity: Purity): Promise<{ perGramPaise: MoneyInPaise; fetchedAt: Date }>;
  name: string;
  isHealthy(): Promise<boolean>;
}
```

**Fallback chain (example — rates):**
```
IBJA primary → Metals.dev fallback → last-known-good cache (Redis)
```

The chain calls IBJA; if it errors / returns stale / times out, calls Metals.dev; if also fails, returns cache with `stale: true` flag → UI surfaces freshness indicator.

**Circuit breaker per adapter:**
- Opens after 5 consecutive failures in 60s.
- Half-open probe every 30s.
- Closed after 3 consecutive successes from half-open.
- Metrics emitted to Sentry / CloudWatch.

**Webhook handling uniform pattern:**
- Route: `POST /api/v1/webhooks/:provider`.
- Controller: (a) verify signature via vendor-specific HMAC SHA-256; (b) dedupe on provider event ID; (c) enqueue BullMQ job; (d) return 200.
- Worker: processes async; idempotent per event ID; retries on transient failure; DLQ on permanent.

**Contract tests:**
- Every adapter passes the same `port.contract.test.ts` suite.
- CI runs against mock adapter always; against real vendor (with sandbox credentials) nightly.
- Contract asserts: method shapes, error mapping to port-level errors, idempotency where specified.

**Configuration:**
- Manifest in `packages/integrations/manifest.ts` declares primary + fallback per port.
- Environment-specific overrides in `apps/api/.env.<env>`.
- DI-wired: NestJS modules register the port with the active adapter from manifest.

## Consequences

**Positive:**
- Business logic is vendor-agnostic; swap-in-place migration paths.
- Fallback chains reduce impact of vendor outages for critical paths.
- Circuit breakers prevent cascading failures.
- Contract tests catch adapter regressions before production.
- Webhook handling is uniform — no per-vendor bespoke code in business logic.

**Negative / trade-offs:**
- Port interfaces must be rich enough to cover all consumer needs but abstract enough to not leak vendor-specific quirks — this is an ongoing design effort.
- Adapter rewrites are work — but they should only happen on vendor swap, not on feature changes.
- Some vendor features (e.g., Razorpay Route for marketplaces) don't map cleanly across vendors — we model them as extensions, not base port.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **Direct SDK use in service code** | Violates NFR-I1; vendor lock-in; high-risk swap cost |
| **Single mega-port interface for all integrations** | Too abstract; doesn't capture vendor-specific shapes for things like UPI vs card |
| **Per-feature integration (e.g., `razorpay-payments` module inside billing)** | Violates package layout; couples billing to Razorpay; rejected |
| **Separate gateway service (e.g., Kong + plugin-per-vendor)** | Overkill for MVP; operational burden; defer to Phase 3+ if integrations proliferate |

## Implementation Notes

### Fallback chain (rates example)

```ts
// packages/integrations/rates/src/fallback-chain.ts
export class RatesFallbackChain implements RatesPort {
  name = 'fallback-chain';

  constructor(
    private primary: RatesPort,
    private fallback: RatesPort,
    private cache: LastKnownGoodRateCache,
  ) {}

  async getRate(purity: Purity) {
    try {
      const result = await this.primary.getRate(purity);
      await this.cache.set(purity, result);
      return result;
    } catch (err) {
      this.logger.warn({ primary: this.primary.name, err }, 'Primary rate feed failed');
      try {
        const result = await this.fallback.getRate(purity);
        await this.cache.set(purity, result);
        return result;
      } catch (err2) {
        this.logger.warn({ fallback: this.fallback.name, err: err2 }, 'Fallback rate feed failed');
        const cached = await this.cache.get(purity);
        if (!cached) throw new RatesUnavailableError();
        return { ...cached, stale: true };
      }
    }
  }

  async isHealthy() {
    return (await this.primary.isHealthy()) || (await this.fallback.isHealthy());
  }
}
```

### Contract test

```ts
// packages/integrations/rates/src/contract-tests.ts
export function ratesPortContract(adapterFactory: () => RatesPort) {
  describe('RatesPort contract', () => {
    const adapter = adapterFactory();

    it('returns rates for all known purities', async () => {
      const result = await adapter.getRatesByPurity();
      expect(result.GOLD_24K.perGramPaise).toBeTypeOf('bigint');
      expect(result.GOLD_22K.fetchedAt).toBeInstanceOf(Date);
    });

    it('throws RatesUnavailableError on permanent failure', async () => {
      // ... (vendor-specific simulation)
    });

    // ... more
  });
}
```

### Webhook handler

```ts
@Controller('webhooks')
export class WebhooksController {
  @Post('razorpay')
  async razorpay(@Headers('x-razorpay-signature') sig: string, @Body() body: unknown, @RawBody() raw: Buffer) {
    if (!this.razorpay.verifySignature(raw, sig)) throw new UnauthorizedException('webhook.signature_invalid');
    const event = JSON.parse(raw.toString());
    const existing = await this.idempotency.check(`razorpay:${event.id}`);
    if (existing) return; // dedupe
    await this.queue.add('razorpay-event', event);
    await this.idempotency.mark(`razorpay:${event.id}`);
  }
}
```

## Revisit triggers

- A port interface becomes leaky (adapters accumulate vendor-specific params) → redesign port.
- A vendor adds a feature we want that doesn't fit the port → extend port with optional capability + feature-flag gate.
- Contract tests become too brittle or slow → split into fast (mock) + slow (real sandbox) tiers.

## References

- PRD NFR-I1–I8
- Architecture §Integration Points
