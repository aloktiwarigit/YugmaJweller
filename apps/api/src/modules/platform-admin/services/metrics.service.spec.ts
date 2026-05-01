import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  // After the PG_POOL_ADMIN refactor MetricsService just calls pool.query directly
  // (no transaction, no role switch) — the pool itself connects as platform_admin.
  let pool: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    pool = { query: vi.fn() };
  });

  it('returns total/active shops + invoice count for last 30 days', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ total_shops: '7', active_shops: '5', invoices_30d: '142' }],
    });

    const svc = new MetricsService(pool as never);
    const m = await svc.getMetrics();

    expect(m).toEqual({ totalShops: 7, activeShops: 5, invoicesLast30Days: 142 });
  });

  it('issues a single aggregate SELECT against the admin pool', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ total_shops: '0', active_shops: '0', invoices_30d: '0' }],
    });

    const svc = new MetricsService(pool as never);
    await svc.getMetrics();

    expect(pool.query).toHaveBeenCalledTimes(1);
    const sql = pool.query.mock.calls[0]![0] as string;
    expect(sql).toMatch(/total_shops/);
    expect(sql).toMatch(/active_shops/);
    expect(sql).toMatch(/invoices_30d/);
  });

  it('propagates pool errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const svc = new MetricsService(pool as never);
    await expect(svc.getMetrics()).rejects.toThrow('boom');
  });
});
