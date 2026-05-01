import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from './subscription.service';

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

describe('SubscriptionService', () => {
  let pool: { connect: ReturnType<typeof vi.fn> };
  let client: MockClient;

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  // After PG_POOL_ADMIN refactor: BEGIN/COMMIT remains, SET LOCAL ROLE gone.
  // Sequence: BEGIN, upsert, audit, COMMIT (indexes 0/1/2/3).

  it('upsertSubscription upserts row, audits subscription.upserted', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1' }] })     // UPSERT
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // COMMIT

    const svc = new SubscriptionService(pool as never);
    const out = await svc.upsertSubscription({
      shopId: 'shop-1',
      plan: 'growth',
      mrrPaise: 500_000,
      platformUserId: 'p',
    });

    expect(out.id).toBe('sub-1');
    expect(client.query.mock.calls[1]![0]).toMatch(/ON CONFLICT \(shop_id\) DO UPDATE/);
    // Update path preserves status / billing_cycle_start when caller omits them.
    expect(client.query.mock.calls[1]![0]).toMatch(/status = COALESCE\(\$3, platform_subscriptions\.status\)/);
    expect(client.query.mock.calls[1]![0]).toMatch(/billing_cycle_start = COALESCE\(\$5, platform_subscriptions\.billing_cycle_start\)/);
    expect(client.query.mock.calls[2]![1]).toContain('subscription.upserted');
    expect(client.query.mock.calls[2]![1]).toContain('shop-1');
  });

  it('listSubscriptions returns rows joined with shops, mrrPaise as number', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 'sub-1',
          shop_id: 'shop-1',
          display_name: 'Demo',
          plan: 'trial',
          status: 'active',
          mrr_paise: '0',
        }],
      })
      .mockResolvedValueOnce(undefined);                      // COMMIT

    const svc = new SubscriptionService(pool as never);
    const out = await svc.listSubscriptions();

    expect(out).toHaveLength(1);
    expect(out[0]!.mrrPaise).toBe(0);
    expect(typeof out[0]!.mrrPaise).toBe('number');
    expect(out[0]!.displayName).toBe('Demo');
  });

  it('rejects invalid plan', async () => {
    const svc = new SubscriptionService(pool as never);
    await expect(
      svc.upsertSubscription({ shopId: 's', plan: 'platinum' as never, mrrPaise: 0, platformUserId: 'p' }),
    ).rejects.toMatchObject({ response: { code: 'subscription.invalid_plan' } });
  });

  it('rejects negative mrrPaise', async () => {
    const svc = new SubscriptionService(pool as never);
    await expect(
      svc.upsertSubscription({ shopId: 's', plan: 'growth', mrrPaise: -1, platformUserId: 'p' }),
    ).rejects.toMatchObject({ response: { code: 'subscription.invalid_mrr' } });
  });

  it('rejects non-integer mrrPaise', async () => {
    const svc = new SubscriptionService(pool as never);
    await expect(
      svc.upsertSubscription({ shopId: 's', plan: 'growth', mrrPaise: 1.5, platformUserId: 'p' }),
    ).rejects.toMatchObject({ response: { code: 'subscription.invalid_mrr' } });
  });
});
