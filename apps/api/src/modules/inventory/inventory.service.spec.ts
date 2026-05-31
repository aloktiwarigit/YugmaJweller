import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

const txMock = { query: vi.fn() };
const withTenantTxMock = vi.fn(
  async (_pool: unknown, fn: (tx: typeof txMock) => unknown) => fn(txMock),
);
vi.mock('@goldsmith/db', () => ({
  withTenantTx: (...args: unknown[]) => withTenantTxMock(...(args as [never, never])),
}));

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({
      shopId: 'shop-A',
      userId: 'user-1',
      role: 'shop_admin',
      authenticated: true,
      tenant: { id: 'shop-A', slug: 'a', display_name: 'A', status: 'ACTIVE' },
    }),
    current: () => ({
      shopId: 'shop-A',
      userId: 'user-1',
      role: 'shop_admin',
      authenticated: true,
      tenant: { id: 'shop-A', slug: 'a', display_name: 'A', status: 'ACTIVE' },
    }),
  },
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditAction: {
    INVENTORY_PRODUCT_CREATED: 'INVENTORY_PRODUCT_CREATED',
    INVENTORY_PRODUCT_UPDATED: 'INVENTORY_PRODUCT_UPDATED',
  },
}));

vi.mock('@goldsmith/observability', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@goldsmith/compliance', () => ({
  validateHuidFormat: vi.fn(() => ({ valid: true })),
}));

const productRow = {
  id: 'prod-1', shop_id: 'shop-A', category_id: null, sku: 'RING-1',
  metal: 'GOLD', purity: '22K', gross_weight_g: '5.0000', net_weight_g: '4.5000',
  stone_weight_g: '0.0000', stone_details: null, making_charge_override_pct: null,
  huid: null, huid_exemption_category: 'none' as const, status: 'IN_STOCK', quantity: 1,
  published_at: null, published_by_user_id: null, created_by_user_id: 'user-1',
  created_at: new Date(), updated_at: new Date(),
};

const repoMock = {
  createProduct: vi.fn(async () => productRow),
  getProduct: vi.fn(async () => productRow),
  updateProduct: vi.fn(async () => productRow),
  listProducts: vi.fn(async () => []),
  getProductBillingRow: vi.fn(),
  getProductsByIds: vi.fn(),
  countImages: vi.fn(),
  findCategoryByName: vi.fn(),
  createMany: vi.fn(),
  updateStatusAtomic: vi.fn(),
  publishProduct: vi.fn(),
  unpublishProduct: vi.fn(),
  listProductsForValuation: vi.fn(),
};

const poolMock = {} as never;

function makeService() {
  const svc = new InventoryService(repoMock as never, poolMock);
  return svc;
}

describe('InventoryService.createProduct — try-on asset upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.query.mockResolvedValue({ rows: [] });
  });

  it('upserts a product_try_on_assets row when tryOnBodyPart is set', async () => {
    const svc = makeService();
    await svc.createProduct({
      sku: 'RING-1', metal: 'GOLD', purity: '22K',
      grossWeightG: '5.0000', netWeightG: '4.5000',
      tryOnBodyPart: 'FINGER',
    });

    // withTenantTx should have been called at least once for the upsert
    const calls = withTenantTxMock.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // The upsert SQL should mention product_try_on_assets
    const queryCalls = txMock.query.mock.calls as [string, unknown[]][];
    const upsertCall = queryCalls.find(([sql]) => sql.includes('product_try_on_assets'));
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1]).toEqual(['shop-A', 'prod-1', 'FINGER']);
  });

  it('does NOT upsert when tryOnBodyPart is absent', async () => {
    const svc = makeService();
    await svc.createProduct({
      sku: 'RING-2', metal: 'GOLD', purity: '22K',
      grossWeightG: '5.0000', netWeightG: '4.5000',
    });

    const queryCalls = txMock.query.mock.calls as [string, unknown[]][];
    const upsertCall = queryCalls.find(([sql]) => sql.includes('product_try_on_assets'));
    expect(upsertCall).toBeUndefined();
  });
});

describe('InventoryService.updateProduct — try-on asset upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.query.mockResolvedValue({ rows: [] });
  });

  it('upserts a product_try_on_assets row when tryOnBodyPart is set on update', async () => {
    const svc = makeService();
    await svc.updateProduct('prod-1', { tryOnBodyPart: 'WRIST' });

    const queryCalls = txMock.query.mock.calls as [string, unknown[]][];
    const upsertCall = queryCalls.find(([sql]) => sql.includes('product_try_on_assets'));
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1]).toEqual(['shop-A', 'prod-1', 'WRIST']);
  });

  it('throws NotFoundException when product does not exist', async () => {
    const svc = makeService();
    repoMock.getProduct.mockResolvedValueOnce(null as never);
    await expect(svc.updateProduct('missing', {})).rejects.toThrow(NotFoundException);
  });
});
