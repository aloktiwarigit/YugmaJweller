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
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET LOCAL ROLE
      .mockResolvedValueOnce({
        rows: [{ total_shops: '7', active_shops: '5', invoices_30d: '142' }],
      })
      .mockResolvedValueOnce(undefined); // COMMIT

    const svc = new MetricsService(pool as never);
    const m = await svc.getMetrics();

    expect(m).toEqual({ totalShops: 7, activeShops: 5, invoicesLast30Days: 142 });
  });

  it('escalates to platform_admin role inside a transaction', async () => {
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ total_shops: '0', active_shops: '0', invoices_30d: '0' }] })
      .mockResolvedValueOnce(undefined); // COMMIT

    const svc = new MetricsService(pool as never);
    await svc.getMetrics();

    expect(client.query.mock.calls[0]![0]).toBe('BEGIN');
    expect(client.query.mock.calls[1]![0]).toBe('SET LOCAL ROLE platform_admin');
    expect(client.query.mock.calls[3]![0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back the transaction when the inner query throws', async () => {
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET LOCAL ROLE
      .mockRejectedValueOnce(new Error('boom')) // SELECT throws
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const svc = new MetricsService(pool as never);
    await expect(svc.getMetrics()).rejects.toThrow('boom');

    expect(client.query.mock.calls[3]![0]).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
