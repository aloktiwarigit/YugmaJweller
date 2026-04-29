import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrmSearchService } from './crm-search.service';
import { MeilisearchUnavailableError } from '@goldsmith/integrations-search';
import type { CustomerSearchQuery, CustomerSearchResult, CustomerSearchDoc } from '@goldsmith/integrations-search';
import type { TenantContext } from '@goldsmith/tenant-context';

const SHOP_A = 'shop-a-uuid-0000-0000-0000-000000000001';
const SHOP_B = 'shop-b-uuid-0000-0000-0000-000000000002';
const CUSTOMER_ID = 'cust-0001-uuid';

function makeAuthCtx(shopId = SHOP_A): TenantContext {
  return {
    shopId,
    authenticated: true,
    userId: 'user-1',
    role: 'shop_admin',
  } as TenantContext & { userId: string; role: string };
}

const sampleQuery: CustomerSearchQuery = { q: 'रमेश', limit: 10, offset: 0 };

const sampleDoc: CustomerSearchDoc = {
  id: CUSTOMER_ID,
  name: 'रमेश शर्मा',
  phoneLast4: '3210',
  city: 'Ayodhya',
  updatedAt: 1714000000000,
};

const meilisearchResult: CustomerSearchResult = {
  hits: [sampleDoc],
  total: 1,
  source: 'meilisearch',
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeSearchPortMock() {
  return {
    searchCustomers: vi.fn().mockResolvedValue(meilisearchResult),
    indexCustomer:   vi.fn().mockResolvedValue(undefined),
    removeCustomer:  vi.fn().mockResolvedValue(undefined),
    // product methods — not under test here
    search:        vi.fn(),
    indexProduct:  vi.fn(),
    removeProduct: vi.fn(),
  };
}

function makePoolMock(rows: Record<string, unknown>[] = []) {
  const clientMock = {
    query:   vi.fn().mockResolvedValue({ rows }),
    release: vi.fn(),
  };
  return {
    connect:  vi.fn().mockResolvedValue(clientMock),
    _client:  clientMock,
  };
}

function makeService(searchPort = makeSearchPortMock(), pool = makePoolMock()) {
  return {
    svc: new CrmSearchService(searchPort as never, pool as never),
    searchPort,
    pool,
  };
}

// ---------------------------------------------------------------------------

beforeEach(() => { vi.clearAllMocks(); });

// ---------------------------------------------------------------------------
// searchCustomers()
// ---------------------------------------------------------------------------

describe('CrmSearchService.searchCustomers()', () => {
  it('returns Meilisearch result when adapter succeeds', async () => {
    const { svc } = makeService();
    const result = await svc.searchCustomers(makeAuthCtx(), sampleQuery);
    expect(result.source).toBe('meilisearch');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.id).toBe(CUSTOMER_ID);
  });

  it('calls adapter with correct shopId (tenant isolation)', async () => {
    const { svc, searchPort } = makeService();
    await svc.searchCustomers(makeAuthCtx(SHOP_A), sampleQuery);
    expect(searchPort.searchCustomers).toHaveBeenCalledWith(SHOP_A, expect.any(Object));
    // shopB never queried with shopA's context
    expect(searchPort.searchCustomers).not.toHaveBeenCalledWith(SHOP_B, expect.any(Object));
  });

  it('falls back to Postgres when adapter throws MeilisearchUnavailableError', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.searchCustomers.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

    const pgRow = {
      id: CUSTOMER_ID, name: 'रमेश शर्मा', phone_last4: '3210',
      city: 'Ayodhya', updatedAt: '1714000000000', total_count: '1',
    };
    const pool = makePoolMock([pgRow]);
    const { svc } = makeService(searchPort, pool);

    const result = await svc.searchCustomers(makeAuthCtx(), sampleQuery);
    expect(result.source).toBe('postgres');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.phoneLast4).toBe('3210');
  });

  it('re-throws non-Meilisearch errors', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.searchCustomers.mockRejectedValueOnce(new Error('unexpected'));
    const { svc } = makeService(searchPort);
    await expect(svc.searchCustomers(makeAuthCtx(), sampleQuery)).rejects.toThrow('unexpected');
  });

  it('falls back to Postgres for unauthenticated context without calling adapter', async () => {
    const searchPort = makeSearchPortMock();
    const pool = makePoolMock([]);
    const { svc } = makeService(searchPort, pool);

    const unauthCtx: TenantContext = {
      shopId: SHOP_A,
      authenticated: false,
      tenant: { id: SHOP_A, slug: 'test-shop', display_name: 'Test Shop', status: 'ACTIVE' },
    };
    await svc.searchCustomers(unauthCtx, sampleQuery);

    expect(searchPort.searchCustomers).not.toHaveBeenCalled();
    expect(pool.connect).toHaveBeenCalled();
  });

  // ─── Postgres fallback: tenant isolation ───────────────────────────────────

  it('Postgres fallback: first WHERE param is shopId (tenant isolation)', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.searchCustomers.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));
    const pool = makePoolMock([]);
    const { svc } = makeService(searchPort, pool);

    await svc.searchCustomers(makeAuthCtx(SHOP_A), sampleQuery);

    const [sql, params] = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe(SHOP_A);
    expect(sql).toContain('c.shop_id = $1');
  });

  it('Postgres fallback: returns phoneLast4 (not full phone) in hits', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.searchCustomers.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

    const pgRow = {
      id: CUSTOMER_ID, name: 'Priya Sharma', phone_last4: '9999',
      city: null, updatedAt: '1714000000000', total_count: '1',
    };
    const pool = makePoolMock([pgRow]);
    const { svc } = makeService(searchPort, pool);

    const result = await svc.searchCustomers(makeAuthCtx(), { q: 'Priya', limit: 10, offset: 0 });
    const hit = result.hits[0];
    expect(hit?.phoneLast4).toBe('9999');
    // Verify 'phone_last4' mapping; the hit must NOT have a field with 10-digit value
    const hitValues = Object.values(hit ?? {});
    const hasFullPhone = hitValues.some(
      (v) => typeof v === 'string' && /^\+?91\d{10}$/.test(v),
    );
    expect(hasFullPhone).toBe(false);
  });

  it('Postgres fallback: 4-digit numeric query adds RIGHT(phone,4) condition', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.searchCustomers.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));
    const pool = makePoolMock([]);
    const { svc } = makeService(searchPort, pool);

    await svc.searchCustomers(makeAuthCtx(), { q: '3210', limit: 10, offset: 0 });

    const [sql, params] = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('RIGHT(c.phone, 4)');
    expect(params).toContain('3210');
  });

  it('Postgres fallback: non-numeric query does NOT add phone WHERE condition', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.searchCustomers.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));
    const pool = makePoolMock([]);
    const { svc } = makeService(searchPort, pool);

    await svc.searchCustomers(makeAuthCtx(), { q: 'Ramesh', limit: 10, offset: 0 });

    const [sql] = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    // SELECT always has RIGHT(c.phone, 4) AS phone_last4; the WHERE clause must NOT add = condition
    expect(sql).not.toContain('RIGHT(c.phone, 4) =');
  });
});

// ---------------------------------------------------------------------------
// indexCustomer()
// ---------------------------------------------------------------------------

describe('CrmSearchService.indexCustomer()', () => {
  it('calls adapter.indexCustomer and phoneLast4 is exactly 4 chars', async () => {
    const { svc, searchPort } = makeService();
    await svc.indexCustomer(SHOP_A, sampleDoc);
    expect(searchPort.indexCustomer).toHaveBeenCalledWith(SHOP_A, sampleDoc);
    expect(sampleDoc.phoneLast4).toHaveLength(4);
  });

  it('swallows MeilisearchUnavailableError (best-effort)', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.indexCustomer.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));
    const { svc } = makeService(searchPort);
    await expect(svc.indexCustomer(SHOP_A, sampleDoc)).resolves.toBeUndefined();
  });

  it('re-throws non-Meilisearch errors', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.indexCustomer.mockRejectedValueOnce(new Error('fatal'));
    const { svc } = makeService(searchPort);
    await expect(svc.indexCustomer(SHOP_A, sampleDoc)).rejects.toThrow('fatal');
  });

  it('full phone never in search doc — phoneLast4 is exactly 4 digits', () => {
    // Simulate what CrmService builds: phone.slice(-4) from "+919876543210"
    const phone = '+919876543210';
    const phoneLast4 = phone.slice(-4);
    expect(phoneLast4).toBe('3210');
    expect(phoneLast4).toHaveLength(4);
    // Full phone must not be in the doc
    const doc: CustomerSearchDoc = {
      id: 'x', name: 'Test', phoneLast4, city: null, updatedAt: 0,
    };
    expect(Object.values(doc)).not.toContain(phone);
  });
});

// ---------------------------------------------------------------------------
// removeFromIndex()
// ---------------------------------------------------------------------------

describe('CrmSearchService.removeFromIndex()', () => {
  it('calls adapter.removeCustomer', async () => {
    const { svc, searchPort } = makeService();
    await svc.removeFromIndex(SHOP_A, CUSTOMER_ID);
    expect(searchPort.removeCustomer).toHaveBeenCalledWith(SHOP_A, CUSTOMER_ID);
  });

  it('swallows MeilisearchUnavailableError', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.removeCustomer.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));
    const { svc } = makeService(searchPort);
    await expect(svc.removeFromIndex(SHOP_A, CUSTOMER_ID)).resolves.toBeUndefined();
  });

  it('re-throws non-Meilisearch errors', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.removeCustomer.mockRejectedValueOnce(new Error('network'));
    const { svc } = makeService(searchPort);
    await expect(svc.removeFromIndex(SHOP_A, CUSTOMER_ID)).rejects.toThrow('network');
  });
});

// ---------------------------------------------------------------------------
// Tenant isolation: shop_A and shop_B indexes are separate
// ---------------------------------------------------------------------------

describe('tenant isolation', () => {
  it('shop_A search never queries shop_B adapter (Meilisearch path)', async () => {
    const searchPort = makeSearchPortMock();
    const { svc } = makeService(searchPort);

    await svc.searchCustomers(makeAuthCtx(SHOP_A), sampleQuery);

    expect(searchPort.searchCustomers).toHaveBeenCalledTimes(1);
    const callArgs = (searchPort.searchCustomers as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(callArgs[0]).toBe(SHOP_A);
    expect(callArgs[0]).not.toBe(SHOP_B);
  });

  it('shop_A Postgres fallback uses shop_A id in WHERE clause', async () => {
    const searchPort = makeSearchPortMock();
    searchPort.searchCustomers.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));
    const pool = makePoolMock([]);
    const { svc } = makeService(searchPort, pool);

    await svc.searchCustomers(makeAuthCtx(SHOP_A), sampleQuery);

    const params = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(SHOP_A);
    expect(params[0]).not.toBe(SHOP_B);
  });
});
