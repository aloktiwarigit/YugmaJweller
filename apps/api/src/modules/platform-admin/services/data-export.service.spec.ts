import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataExportService } from './data-export.service';

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

describe('DataExportService', () => {
  let pool: { connect: ReturnType<typeof vi.fn> };
  let client: MockClient;

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('exports a single tenant scope with shop_id filter on every query', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                                                    // BEGIN
      .mockResolvedValueOnce(undefined)                                                                    // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ id: 's1', slug: 'demo', display_name: 'Demo', status: 'ACTIVE' }] }) // shop
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 })                                          // customers
      .mockResolvedValueOnce({ rows: [{ id: 'inv1' }], rowCount: 1 })                                        // invoices
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }], rowCount: 1 })                                          // payments
      .mockResolvedValueOnce(undefined)                                                                    // INSERT audit
      .mockResolvedValueOnce(undefined);                                                                   // COMMIT

    const svc = new DataExportService(pool as never);
    const out = await svc.exportTenant('s1', 'platform-uid');

    expect(out.shop.id).toBe('s1');
    expect(out.customers).toHaveLength(1);
    expect(out.invoices).toHaveLength(1);
    expect(out.payments).toHaveLength(1);
    expect(out.excluded).toContain('audit_events');

    // Every data query filtered by shop_id (indexes shifted by 2 for BEGIN + SET LOCAL ROLE)
    expect(client.query.mock.calls[2]![1]).toEqual(['s1']);
    expect(client.query.mock.calls[3]![1]).toEqual(['s1']);
    expect(client.query.mock.calls[4]![1]).toEqual(['s1']);
    expect(client.query.mock.calls[5]![1]).toEqual(['s1']);
    // Audit row written
    expect(client.query.mock.calls[6]![1]).toContain('tenant.exported');
  });

  it('throws NotFoundException when shop not found', async () => {
    client.query
      .mockResolvedValueOnce(undefined)             // BEGIN
      .mockResolvedValueOnce(undefined)             // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [] })          // shop SELECT empty → throws
      .mockResolvedValueOnce(undefined);            // ROLLBACK in catch

    const svc = new DataExportService(pool as never);
    await expect(svc.exportTenant('missing', 'p')).rejects.toMatchObject({
      response: { code: 'tenant.not_found' },
    });
  });
});
