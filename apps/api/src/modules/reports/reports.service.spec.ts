import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000000';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: 'user-1' }),
    current: () => ({ shopId: SHOP }),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    return fn(fakeTx);
  },
}));

// Overridable per test
let fakeTx: { query: ReturnType<typeof vi.fn> };

function makePool() {
  return {} as import('pg').Pool;
}

function makeService(): ReportsService {
  return new ReportsService(makePool());
}

// ---------------------------------------------------------------------------
// getDailySummary
// ---------------------------------------------------------------------------
describe('getDailySummary', () => {
  it('rejects an invalid date format', async () => {
    const svc = makeService();
    await expect(svc.getDailySummary('not-a-date')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns parsed aggregate for a valid date', async () => {
    fakeTx = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          total_paise:    '500000',
          cash_paise:     '300000',
          upi_paise:      '200000',
          other_paise:    '0',
          invoice_count:  '3',
          gold_weight_mg: '15000',
        }],
      }),
    };

    const svc = makeService();
    const result = await svc.getDailySummary('2026-04-29');

    expect(result.date).toBe('2026-04-29');
    expect(result.total_paise).toBe('500000');
    expect(result.cash_paise).toBe('300000');
    expect(result.upi_paise).toBe('200000');
    expect(result.other_paise).toBe('0');
    expect(result.invoice_count).toBe(3);
    expect(result.gold_weight_mg).toBe('15000');
  });

  it('handles zero invoices (all COALESCEs return 0)', async () => {
    fakeTx = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          total_paise:    '0',
          cash_paise:     '0',
          upi_paise:      '0',
          other_paise:    '0',
          invoice_count:  '0',
          gold_weight_mg: '0',
        }],
      }),
    };

    const svc = makeService();
    const result = await svc.getDailySummary('2026-04-01');

    expect(result.invoice_count).toBe(0);
    expect(result.total_paise).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// getOutstanding
// ---------------------------------------------------------------------------
describe('getOutstanding', () => {
  it('clamps limit to 100', async () => {
    fakeTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })  // count
        .mockResolvedValueOnce({ rows: [] }),                 // items
    };

    const svc = makeService();
    const result = await svc.getOutstanding(1, 999);
    expect(result.limit).toBe(100);
  });

  it('returns items with balance_due_paise', async () => {
    fakeTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({
          rows: [{
            id:                'inv-1',
            invoice_number:    'GS-2026-0001',
            customer_name:     'राज कुमार',
            customer_phone:    '9876543210',
            total_paise:       '100000',
            balance_due_paise: '50000',
            issued_at:         new Date('2026-04-01T10:00:00Z'),
          }],
        }),
    };

    const svc = makeService();
    const result = await svc.getOutstanding(1, 20);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.balance_due_paise).toBe('50000');
    expect(result.items[0]!.invoice_number).toBe('GS-2026-0001');
    expect(result.items[0]!.issued_at).toBe('2026-04-01T10:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// getCustomerLtv
// ---------------------------------------------------------------------------
describe('getCustomerLtv', () => {
  it('clamps limit to 50', async () => {
    fakeTx = {
      query: vi.fn().mockResolvedValue({
        rows: [],
      }),
    };

    const svc = makeService();
    const result = await svc.getCustomerLtv(999);
    // Verify query was called with limit 50
    const callArgs = fakeTx.query.mock.calls[0] as [string, unknown[]];
    expect(callArgs[1]).toContain(50);
    expect(result).toEqual([]);
  });

  it('returns customers sorted by descending LTV', async () => {
    fakeTx = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
          { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
        ],
      }),
    };

    const svc = makeService();
    const result = await svc.getCustomerLtv(20);

    expect(result).toHaveLength(2);
    expect(result[0]!.ltv_paise).toBe('2000000');
    expect(result[0]!.name).toBe('रमेश सिंह');
  });
});

// ---------------------------------------------------------------------------
// getLoyaltySummary
// ---------------------------------------------------------------------------
describe('getLoyaltySummary', () => {
  it('returns parsed points totals and tier breakdown', async () => {
    fakeTx = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{ points_issued: '5000', points_redeemed: '1200' }],
        })
        .mockResolvedValueOnce({
          rows: [
            { tier: 'GOLD',   count: '12' },
            { tier: 'SILVER', count: '8' },
            { tier: null,     count: '3' },
          ],
        }),
    };

    const svc = makeService();
    const result = await svc.getLoyaltySummary();

    expect(result.points_issued).toBe(5000);
    expect(result.points_redeemed).toBe(1200);
    expect(result.members_by_tier).toHaveLength(3);
    expect(result.members_by_tier[0]).toEqual({ tier: 'GOLD', count: 12 });
    expect(result.members_by_tier[2]).toEqual({ tier: null, count: 3 });
  });

  it('returns zeros when no loyalty data exists', async () => {
    fakeTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ points_issued: '0', points_redeemed: '0' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const svc = makeService();
    const result = await svc.getLoyaltySummary();

    expect(result.points_issued).toBe(0);
    expect(result.points_redeemed).toBe(0);
    expect(result.members_by_tier).toEqual([]);
  });
});
