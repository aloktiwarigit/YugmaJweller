import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventorySearchService } from './inventory.search.service';
import { MeilisearchUnavailableError } from '@goldsmith/integrations-search';
import type { SearchQuery, SearchResult, ProductSearchDoc } from '@goldsmith/integrations-search';
import type { TenantContext } from '@goldsmith/tenant-context';

const SHOP_ID = 'shop-search-test';
const PRODUCT_ID = 'prod-search-001';

function makeAuthCtx(): TenantContext {
  return {
    shopId: SHOP_ID,
    authenticated: true,
    userId: 'user-1',
    role: 'shop_admin',
  } as TenantContext & { userId: string; role: string };
}

const sampleQuery: SearchQuery = { q: 'ring', filters: {}, limit: 10, offset: 0 };

const sampleHit: ProductSearchDoc = {
  id: PRODUCT_ID,
  sku: 'RING-001',
  metal: 'GOLD',
  purity: '22K',
  huid: null,
  status: 'IN_STOCK',
  weightG: '10.5000',
  category: 'Rings',
  published: true,
  updatedAt: 1714000000000,
};

const meilisearchResult: SearchResult = {
  hits: [sampleHit],
  total: 1,
  source: 'meilisearch',
};

// ---------------------------------------------------------------------------
// Pool mock helpers
// ---------------------------------------------------------------------------

function makePoolMock(rows: Record<string, unknown>[] = [], rowCount = 1) {
  const clientMock = {
    query: vi.fn().mockResolvedValue({ rows, rowCount }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(clientMock),
    _client: clientMock,
  };
}

// ---------------------------------------------------------------------------
// SearchPort mock
// ---------------------------------------------------------------------------

function makeSearchPortMock() {
  return {
    search: vi.fn().mockResolvedValue(meilisearchResult),
    indexProduct: vi.fn().mockResolvedValue(undefined),
    removeProduct: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(
  searchPort = makeSearchPortMock(),
  pool = makePoolMock(),
) {
  return {
    svc: new InventorySearchService(searchPort as never, pool as never),
    searchPort,
    pool,
  };
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventorySearchService', () => {
  // -------------------------------------------------------------------------
  // search()
  // -------------------------------------------------------------------------

  describe('search()', () => {
    it('returns Meilisearch result when adapter succeeds', async () => {
      const { svc } = makeService();
      const result = await svc.search(makeAuthCtx(), sampleQuery);
      expect(result.source).toBe('meilisearch');
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]?.id).toBe(PRODUCT_ID);
    });

    it('falls back to Postgres when adapter throws MeilisearchUnavailableError', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.search.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

      const pgRow = {
        id: PRODUCT_ID,
        sku: 'RING-001',
        metal: 'GOLD',
        purity: '22K',
        huid: null,
        status: 'IN_STOCK',
        weightG: '10.5000',
        category: 'Rings',
        published: true,
        updatedAt: '1714000000000',
        total_count: '1',
      };
      const pool = makePoolMock([pgRow], 1);

      const { svc } = makeService(searchPort, pool);
      const result = await svc.search(makeAuthCtx(), sampleQuery);

      expect(result.source).toBe('postgres');
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]?.id).toBe(PRODUCT_ID);
    });

    it('re-throws non-Meilisearch errors', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.search.mockRejectedValueOnce(new Error('unexpected'));

      const { svc } = makeService(searchPort);
      await expect(svc.search(makeAuthCtx(), sampleQuery)).rejects.toThrow('unexpected');
    });

    it('Postgres fallback includes shop_id as first WHERE clause (tenant isolation)', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.search.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

      const pool = makePoolMock([], 0);
      const { svc } = makeService(searchPort, pool);

      await svc.search(makeAuthCtx(), sampleQuery);

      const [sql, params] = (pool._client.query as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, unknown[]];

      // First param must be shopId
      expect(params[0]).toBe(SHOP_ID);
      // SQL must reference p.shop_id = $1
      expect(sql).toContain('p.shop_id = $1');
    });

    it('Postgres fallback applies metal filter when provided', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.search.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

      const pool = makePoolMock([], 0);
      const { svc } = makeService(searchPort, pool);
      const queryWithMetal: SearchQuery = {
        q: '',
        filters: { metal: 'GOLD' },
        limit: 10,
        offset: 0,
      };

      await svc.search(makeAuthCtx(), queryWithMetal);

      const [sql, params] = (pool._client.query as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, unknown[]];

      expect(sql).toContain('p.metal =');
      expect(params).toContain('GOLD');
    });

    it('applies purity filter in postgres fallback', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.search.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

      const pool = makePoolMock([], 0);
      const { svc } = makeService(searchPort, pool);

      await svc.search(makeAuthCtx(), { q: '', filters: { purity: '22K' }, limit: 10, offset: 0 });

      const sql: string = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const params: unknown[] = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];

      expect(sql).toContain('p.purity = ');
      expect(params).toContain('22K');
    });

    it('applies status filter in postgres fallback', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.search.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

      const pool = makePoolMock([], 0);
      const { svc } = makeService(searchPort, pool);

      await svc.search(makeAuthCtx(), { q: '', filters: { status: 'SOLD' }, limit: 10, offset: 0 });

      const sql: string = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const params: unknown[] = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];

      expect(sql).toContain('p.status = ');
      expect(params).toContain('SOLD');
    });

    it('applies published=true filter in postgres fallback', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.search.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

      const pool = makePoolMock([], 0);
      const { svc } = makeService(searchPort, pool);

      await svc.search(makeAuthCtx(), { q: '', filters: { published: true }, limit: 10, offset: 0 });

      const sql: string = (pool._client.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;

      expect(sql).toContain('IS NOT NULL');
    });

    it('falls back to Postgres for unauthenticated context without calling adapter', async () => {
      const searchPort = makeSearchPortMock();
      const pool = makePoolMock([], 0);
      const { svc } = makeService(searchPort, pool);

      const unauthCtx: TenantContext = {
        shopId: SHOP_ID,
        authenticated: false,
        tenant: { id: SHOP_ID, slug: 'test-shop', display_name: 'Test Shop', status: 'ACTIVE' },
      };
      await svc.search(unauthCtx, sampleQuery);

      expect(searchPort.search).not.toHaveBeenCalled();
      expect(pool.connect).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // indexProduct()
  // -------------------------------------------------------------------------

  describe('indexProduct()', () => {
    it('fetches product by shopId+productId and calls adapter.indexProduct', async () => {
      const pgRow = {
        id: PRODUCT_ID,
        sku: 'RING-001',
        metal: 'GOLD',
        purity: '22K',
        huid: null,
        status: 'IN_STOCK',
        weightG: '10.5000',
        category: 'Rings',
        published: true,
        updatedAt: '1714000000000',
      };
      const pool = makePoolMock([pgRow], 1);
      const searchPort = makeSearchPortMock();
      const { svc } = makeService(searchPort, pool);

      await svc.indexProduct(SHOP_ID, PRODUCT_ID);

      const [sql, params] = (pool._client.query as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, unknown[]];

      // Must scope by shop_id
      expect(params[0]).toBe(SHOP_ID);
      expect(params[1]).toBe(PRODUCT_ID);
      expect(sql).toContain('p.shop_id = $1');
      expect(sql).toContain('p.id = $2');

      // Must call adapter.indexProduct with the correct doc shape
      expect(searchPort.indexProduct).toHaveBeenCalledWith(
        SHOP_ID,
        expect.objectContaining<Partial<ProductSearchDoc>>({
          id: PRODUCT_ID,
          sku: 'RING-001',
          metal: 'GOLD',
          purity: '22K',
        }),
      );
    });

    it('logs a warning and returns (does not throw) when product not found', async () => {
      const pool = makePoolMock([], 0);
      const searchPort = makeSearchPortMock();
      const { svc } = makeService(searchPort, pool);

      await expect(svc.indexProduct(SHOP_ID, 'no-such-product')).resolves.toBeUndefined();
      expect(searchPort.indexProduct).not.toHaveBeenCalled();
    });

    it('swallows MeilisearchUnavailableError and returns without throwing', async () => {
      const pgRow = {
        id: PRODUCT_ID,
        sku: 'RING-001',
        metal: 'GOLD',
        purity: '22K',
        huid: null,
        status: 'IN_STOCK',
        weightG: '10.5000',
        category: '',
        published: false,
        updatedAt: '0',
      };
      const pool = makePoolMock([pgRow], 1);
      const searchPort = makeSearchPortMock();
      searchPort.indexProduct.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));

      const { svc } = makeService(searchPort, pool);
      await expect(svc.indexProduct(SHOP_ID, PRODUCT_ID)).resolves.toBeUndefined();
    });

    it('re-throws non-Meilisearch errors from adapter', async () => {
      const pgRow = {
        id: PRODUCT_ID,
        sku: 'RING-001',
        metal: 'GOLD',
        purity: '22K',
        huid: null,
        status: 'IN_STOCK',
        weightG: '10.5000',
        category: '',
        published: false,
        updatedAt: '0',
      };
      const pool = makePoolMock([pgRow], 1);
      const searchPort = makeSearchPortMock();
      searchPort.indexProduct.mockRejectedValueOnce(new Error('fatal'));

      const { svc } = makeService(searchPort, pool);
      await expect(svc.indexProduct(SHOP_ID, PRODUCT_ID)).rejects.toThrow('fatal');
    });
  });

  // -------------------------------------------------------------------------
  // removeFromIndex()
  // -------------------------------------------------------------------------

  describe('removeFromIndex()', () => {
    it('calls adapter.removeProduct', async () => {
      const searchPort = makeSearchPortMock();
      const { svc } = makeService(searchPort);

      await svc.removeFromIndex(SHOP_ID, PRODUCT_ID);
      expect(searchPort.removeProduct).toHaveBeenCalledWith(SHOP_ID, PRODUCT_ID);
    });

    it('swallows MeilisearchUnavailableError without throwing', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.removeProduct.mockRejectedValueOnce(new MeilisearchUnavailableError('down'));
      const { svc } = makeService(searchPort);

      await expect(svc.removeFromIndex(SHOP_ID, PRODUCT_ID)).resolves.toBeUndefined();
    });

    it('re-throws non-Meilisearch errors', async () => {
      const searchPort = makeSearchPortMock();
      searchPort.removeProduct.mockRejectedValueOnce(new Error('network'));
      const { svc } = makeService(searchPort);

      await expect(svc.removeFromIndex(SHOP_ID, PRODUCT_ID)).rejects.toThrow('network');
    });
  });
});
