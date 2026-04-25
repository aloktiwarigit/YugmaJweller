import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryDeadStockService } from './inventory.dead-stock.service';
import type { TenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SHOP_ID = 'shop-dead-stock-test';

const ctx: TenantContext = {
  shopId: SHOP_ID,
  tenant: { id: SHOP_ID, slug: 'test', display_name: 'Test', status: 'ACTIVE' },
  authenticated: false,
};

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id:            'prod-1',
    sku:           'RING-001',
    metal:         'GOLD',
    purity:        '22K',
    weightG:       '10.0000',
    status:        'IN_STOCK',
    created_at:    new Date('2025-09-01'),
    days_in_stock: 200,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pool mock helpers
// ---------------------------------------------------------------------------

function makeMockClient(thresholdRow: { threshold: number } | null, products: object[]) {
  const mockClient = {
    query: vi.fn()
      .mockResolvedValueOnce({
        rows: thresholdRow ? [thresholdRow] : [],
      })
      .mockResolvedValueOnce({
        rows: products,
      }),
    release: vi.fn(),
  };
  return mockClient;
}

function makePool(client: ReturnType<typeof makeMockClient>) {
  return {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as import('pg').Pool;
}

function makeService(pool: import('pg').Pool): InventoryDeadStockService {
  return new InventoryDeadStockService(pool);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InventoryDeadStockService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('respects threshold from shop_settings — products older than threshold returned', async () => {
    const product = makeProduct({ days_in_stock: 100, created_at: new Date('2025-11-01') });
    const client = makeMockClient({ threshold: 90 }, [product]);
    const svc = makeService(makePool(client));

    const result = await svc.getDeadStock(ctx);

    expect(result).toHaveLength(1);
    expect(result[0]!.daysInStock).toBe(100);
    // Verify the dead-stock query was called with the shop_id
    const deadStockCall = client.query.mock.calls[1]!;
    expect(deadStockCall[1]).toContain(SHOP_ID);
  });

  it('defaults to threshold=180 when no shop_settings row exists', async () => {
    const product = makeProduct({ days_in_stock: 200 });
    const client = makeMockClient(null, [product]);
    const svc = makeService(makePool(client));

    const result = await svc.getDeadStock(ctx);

    expect(result).toHaveLength(1);
    // With threshold=180: days=200 < 180*1.5=270 → DISCOUNT
    expect(result[0]!.suggestedAction).toBe('DISCOUNT');
  });

  it('suggestedAction = DISCOUNT when daysInStock < threshold * 1.5', async () => {
    // threshold=90, daysInStock=100 → 100 < 90*1.5=135 → DISCOUNT
    const product = makeProduct({ days_in_stock: 100 });
    const client = makeMockClient({ threshold: 90 }, [product]);
    const svc = makeService(makePool(client));

    const result = await svc.getDeadStock(ctx);

    expect(result[0]!.suggestedAction).toBe('DISCOUNT');
  });

  it('suggestedAction = KARIGAR when daysInStock >= threshold * 1.5 and < threshold * 3', async () => {
    // threshold=90, daysInStock=200 → 135 <= 200 < 270 → KARIGAR
    const product = makeProduct({ days_in_stock: 200 });
    const client = makeMockClient({ threshold: 90 }, [product]);
    const svc = makeService(makePool(client));

    const result = await svc.getDeadStock(ctx);

    expect(result[0]!.suggestedAction).toBe('KARIGAR');
  });

  it('suggestedAction = REPURPOSE when daysInStock >= threshold * 3', async () => {
    // threshold=90, daysInStock=300 → 300 >= 270 → REPURPOSE
    const product = makeProduct({ days_in_stock: 300 });
    const client = makeMockClient({ threshold: 90 }, [product]);
    const svc = makeService(makePool(client));

    const result = await svc.getDeadStock(ctx);

    expect(result[0]!.suggestedAction).toBe('REPURPOSE');
  });

  it('suggestedAction = DISCOUNT when daysInStock exactly equals threshold', async () => {
    // threshold=90, daysInStock=90 → 90 < 90*1.5=135 → DISCOUNT
    const product = makeProduct({ days_in_stock: 90 });
    const client = makeMockClient({ threshold: 90 }, [product]);
    const svc = makeService(makePool(client));

    const result = await svc.getDeadStock(ctx);

    expect(result[0]!.suggestedAction).toBe('DISCOUNT');
  });

  it('returns empty array when no dead stock products exist', async () => {
    const client = makeMockClient({ threshold: 90 }, []);
    const svc = makeService(makePool(client));

    const result = await svc.getDeadStock(ctx);

    expect(result).toEqual([]);
  });

  it('tenant isolation: dead-stock query uses shop_id = shopId from ctx', async () => {
    const client = makeMockClient({ threshold: 90 }, []);
    const svc = makeService(makePool(client));

    await svc.getDeadStock(ctx);

    // First query (threshold): shop_id param
    expect(client.query.mock.calls[0]![1]).toEqual([SHOP_ID]);
    // Second query (dead stock): first param is shop_id
    expect(client.query.mock.calls[1]![1]![0]).toBe(SHOP_ID);
  });

  it('releases the client connection even when the query throws', async () => {
    const client = {
      query: vi.fn().mockRejectedValueOnce(new Error('db error')),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as import('pg').Pool;
    const svc = makeService(pool);

    await expect(svc.getDeadStock(ctx)).rejects.toThrow('db error');
    expect(client.release).toHaveBeenCalled();
  });
});
