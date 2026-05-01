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

  // After the PG_POOL_ADMIN refactor: BEGIN/COMMIT remains for atomicity (audit + reads
  // commit together) but SET LOCAL ROLE is gone — the pool is already platform_admin.
  // Call sequence is now: BEGIN, shop, customers, invoices, payments, audit, COMMIT.

  it('exports a single tenant scope with shop_id filter on every query', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                                                    // BEGIN
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

    // Every data query filtered by shop_id (indexes shifted by 1 for BEGIN only)
    expect(client.query.mock.calls[1]![1]).toEqual(['s1']);
    expect(client.query.mock.calls[2]![1]).toEqual(['s1']);
    expect(client.query.mock.calls[3]![1]).toEqual(['s1']);
    expect(client.query.mock.calls[4]![1]).toEqual(['s1']);
    // Audit row written
    expect(client.query.mock.calls[5]![1]).toContain('tenant.exported');
    expect(client.query.mock.calls[6]![0]).toBe('COMMIT');
  });

  it('explicitly projects safe columns — never SELECT * — and redacts encrypted/infra fields', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                                                    // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 's1' }] })                                                     // shop
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                                    // customers
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                                    // invoices
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                                    // payments
      .mockResolvedValueOnce(undefined)                                                                    // audit
      .mockResolvedValueOnce(undefined);                                                                   // COMMIT

    const svc = new DataExportService(pool as never);
    const out = await svc.exportTenant('s1', 'platform-uid');

    // Each data SELECT must explicitly list columns (no `SELECT *`).
    const shopSql = client.query.mock.calls[1]![0] as string;
    const custSql = client.query.mock.calls[2]![0] as string;
    const invSql  = client.query.mock.calls[3]![0] as string;
    const paySql  = client.query.mock.calls[4]![0] as string;
    for (const sql of [shopSql, custSql, invSql, paySql]) {
      expect(sql).not.toMatch(/SELECT\s+\*/i);
    }
    // Encrypted bytes / infra metadata must never be returned as projected columns.
    // (The expression `(pan_ciphertext IS NOT NULL)` is acceptable — it reads the column
    // server-side to derive a boolean — but no row sent to the consumer should carry the
    // raw ciphertext or the KEK ARN.)
    expect(shopSql).not.toContain('kek_key_arn');
    // Customer + invoice queries surface a pan_on_file boolean instead of the ciphertext.
    expect(custSql).toContain('pan_on_file');
    expect(invSql).toContain('pan_on_file');
    // No SELECT projects pan_ciphertext or pan_key_id directly (must be computed-only usage).
    for (const sql of [custSql, invSql]) {
      // A bare reference like ", pan_ciphertext," or ", pan_ciphertext\n" would mean
      // it's projected as a returned column.
      expect(sql).not.toMatch(/[,\s]pan_ciphertext\s*[,\n]/);
      expect(sql).not.toMatch(/[,\s]pan_key_id\s*[,\n]/);
    }

    // The excluded list must call out the redactions for export-consumer transparency.
    expect(out.excluded.some((e) => /pan_ciphertext/.test(e))).toBe(true);
    expect(out.excluded.some((e) => /kek_key_arn/.test(e))).toBe(true);
  });

  it('throws NotFoundException when shop not found', async () => {
    client.query
      .mockResolvedValueOnce(undefined)             // BEGIN
      .mockResolvedValueOnce({ rows: [] })          // shop SELECT empty → throws
      .mockResolvedValueOnce(undefined);            // ROLLBACK in catch

    const svc = new DataExportService(pool as never);
    await expect(svc.exportTenant('missing', 'p')).rejects.toMatchObject({
      response: { code: 'tenant.not_found' },
    });
  });
});
