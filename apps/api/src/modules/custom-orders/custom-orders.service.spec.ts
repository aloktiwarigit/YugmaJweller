import { describe, it, expect, vi, beforeEach } from 'vitest';

const SHOP     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER = 'cccccccc-cccc-4000-8000-000000000001';

vi.mock('@goldsmith/db', () => ({
  withShopTx: vi.fn(),
  withTenantTx: vi.fn(),
}));
vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: { CUSTOM_ORDER_CREATED: 'CUSTOM_ORDER_CREATED' },
}));
vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: { requireCurrent: vi.fn(), current: vi.fn() },
}));
vi.mock('@goldsmith/compliance', () => ({
  enforce269ss: vi.fn(),
  ComplianceHardBlockError: class {},
}));
vi.mock('@goldsmith/observability', () => ({ trackEvent: vi.fn() }));

import { withShopTx } from '@goldsmith/db';
import { CustomOrdersService } from './custom-orders.service';

function makeService() {
  return new CustomOrdersService(
    { query: vi.fn() } as never,   // PG_POOL
    {
      insert: vi.fn(), findById: vi.fn(), list: vi.fn(),
      insertMilestone: vi.fn(), listMilestones: vi.fn(),
      updateStatus: vi.fn(), updateDepositOrder: vi.fn(),
      recordDepositPaid: vi.fn(),
    } as never,  // CustomOrdersRepository
    { createOrder: vi.fn(), verifySignature: vi.fn() } as never, // PAYMENTS_ADAPTER
    { upload: vi.fn(), getUrl: vi.fn(), delete: vi.fn() } as never, // STORAGE_PORT
  );
}

describe('CustomOrdersService.getOrdersForCustomer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns mapped orders and total', async () => {
    const fakeRow = {
      id: 'ord-1', status: 'IN_PROGRESS', description: 'Gold ring',
      quoted_amount_paise: 100000n, deposit_amount_paise: 20000n,
      estimated_delivery_date: null,
      created_at: new Date('2026-04-01T10:00:00.000Z'),
    };
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [fakeRow] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const result = await makeService().getOrdersForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      id: 'ord-1',
      status: 'IN_PROGRESS',
      description: 'Gold ring',
      quotedAmountPaise: '100000',
      depositAmountPaise: '20000',
      estimatedDeliveryDate: null,
      createdAt: '2026-04-01T10:00:00.000Z',
    });
  });

  it('returns empty list when customer has no orders', async () => {
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const result = await makeService().getOrdersForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.orders).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('passes shopId and customerId as WHERE clause params', async () => {
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, shopId, fn) => {
      expect(shopId).toBe(SHOP);
      return fn(mockTx as never);
    });

    await makeService().getOrdersForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    const firstCall = mockTx.query.mock.calls[0]!;
    expect(firstCall[1]).toContain(CUSTOMER);
    expect(firstCall[1]).toContain(SHOP);
  });
});
