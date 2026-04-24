import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { tenantContext } from '@goldsmith/tenant-context';

const SHOP_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const SHOP_B = 'bbbbbbbb-0000-0000-0000-000000000000';
const USER_ID = 'user-owner-a';

const baseProduct = {
  id: '11111111-1111-1111-1111-111111111111',
  shop_id: SHOP_A,
  category_id: null,
  sku: 'RING-001',
  metal: 'GOLD',
  purity: '22K',
  gross_weight_g: '10.5000',
  net_weight_g: '9.0000',
  stone_weight_g: '0.5000',
  stone_details: null,
  making_charge_override_pct: null,
  huid: null,
  status: 'IN_STOCK',
  published_at: null,
  published_by_user_id: null,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-04-24'),
  updated_at: new Date('2026-04-24'),
};

const publishedProduct = {
  ...baseProduct,
  published_at: new Date('2026-04-24T12:00:00Z'),
  published_by_user_id: USER_ID,
};

const repoMock = {
  getProduct: vi.fn().mockResolvedValue(baseProduct),
  countImages: vi.fn().mockResolvedValue(1),
  publishProduct: vi.fn().mockResolvedValue(publishedProduct),
  unpublishProduct: vi.fn().mockResolvedValue(baseProduct),
  updateStatusAtomic: vi.fn(),
  createProduct: vi.fn(),
  listProducts: vi.fn(),
  updateProduct: vi.fn(),
};

const storageMock = { getPresignedUploadUrl: vi.fn(), getPublicUrl: vi.fn() };
const poolMock = { connect: vi.fn() } as unknown as import('pg').Pool;

function makeService(): InventoryService {
  return new InventoryService(repoMock as never, storageMock as never, poolMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue({
    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
  } as never);
  vi.spyOn(tenantContext, 'current').mockReturnValue({
    shopId: SHOP_A, userId: USER_ID, role: 'shop_admin', authenticated: true,
  } as never);
});

describe('POST /products/:id/publish — integration', () => {
  it('returns 200 with publishedAt set', async () => {
    const svc = makeService();
    const result = await svc.publish(baseProduct.id);
    expect(result.publishedAt).not.toBeNull();
    expect(repoMock.publishProduct).toHaveBeenCalledWith(baseProduct.id, USER_ID);
  });

  it('already-published product → 200 (idempotent, re-sets timestamp)', async () => {
    repoMock.getProduct.mockResolvedValueOnce(publishedProduct);
    const svc = makeService();
    const result = await svc.publish(publishedProduct.id);
    expect(result.publishedAt).not.toBeNull();
    expect(repoMock.publishProduct).toHaveBeenCalledTimes(1);
  });

  it('tenant isolation: product from tenant B returns 404 under tenant A token', async () => {
    repoMock.getProduct.mockResolvedValueOnce(null);
    vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue({
      shopId: SHOP_B, userId: 'user-b', role: 'shop_admin', authenticated: true,
    } as never);
    const svc = makeService();
    await expect(svc.publish('foreign-product-id')).rejects.toThrow(NotFoundException);
  });

  it('product with no images → UnprocessableEntityException catalog.product_missing_images', async () => {
    repoMock.countImages.mockResolvedValueOnce(0);
    const svc = makeService();
    await expect(svc.publish(baseProduct.id)).rejects.toMatchObject({
      response: { code: 'catalog.product_missing_images' },
    });
  });

  it('hallmarked product with empty HUID → UnprocessableEntityException catalog.product_missing_huid', async () => {
    repoMock.getProduct.mockResolvedValueOnce({ ...baseProduct, huid: '' });
    const svc = makeService();
    await expect(svc.publish(baseProduct.id)).rejects.toMatchObject({
      response: { code: 'catalog.product_missing_huid' },
    });
  });
});

describe('POST /products/:id/unpublish — integration', () => {
  it('returns 200 with publishedAt null', async () => {
    repoMock.getProduct.mockResolvedValueOnce(publishedProduct);
    const svc = makeService();
    const result = await svc.unpublish(publishedProduct.id);
    expect(result.publishedAt).toBeNull();
    expect(repoMock.unpublishProduct).toHaveBeenCalledWith(publishedProduct.id);
  });

  it('tenant isolation: product from tenant B returns 404 under tenant A token', async () => {
    repoMock.getProduct.mockResolvedValueOnce(null);
    const svc = makeService();
    await expect(svc.unpublish('foreign-product-id')).rejects.toThrow(NotFoundException);
  });
});
