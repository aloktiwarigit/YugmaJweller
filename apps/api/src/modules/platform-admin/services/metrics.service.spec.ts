import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsService } from './metrics.service';

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

describe('MetricsService', () => {
  let pool: { connect: ReturnType<typeof vi.fn> };
  let client: MockClient;

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('returns total/active shops + invoice count for last 30 days', async () => {
    client.query
      .mockResolvedValueOnce(undefined) // SET LOCAL ROLE
      .mockResolvedValueOnce({
        rows: [{ total_shops: '7', active_shops: '5', invoices_30d: '142' }],
      })
      .mockResolvedValueOnce(undefined); // RESET ROLE

    const svc = new MetricsService(pool as never);
    const m = await svc.getMetrics();

    expect(m).toEqual({ totalShops: 7, activeShops: 5, invoicesLast30Days: 142 });
  });

  it('escalates to platform_admin role and resets afterwards', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ total_shops: '0', active_shops: '0', invoices_30d: '0' }] })
      .mockResolvedValueOnce(undefined);

    const svc = new MetricsService(pool as never);
    await svc.getMetrics();

    expect(client.query.mock.calls[0]![0]).toBe('SET LOCAL ROLE platform_admin');
    expect(client.query.mock.calls[2]![0]).toBe('RESET ROLE');
    expect(client.release).toHaveBeenCalled();
  });
});
