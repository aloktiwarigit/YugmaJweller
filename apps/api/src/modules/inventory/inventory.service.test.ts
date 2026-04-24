import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { tenantContext } from '@goldsmith/tenant-context';

const SHOP_ID = 'shop-uuid-inventory';
const USER_ID = 'user-owner-1';

const productRow = {
  id: 'prod-abc',
  shop_id: SHOP_ID,
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
  created_by_user_id: USER_ID,
  created_at: new Date('2026-04-23'),
  updated_at: new Date('2026-04-23'),
};

const publishedRow = { ...productRow, published_at: new Date('2026-04-24'), published_by_user_id: USER_ID };

const repoMock = {
  createProduct: vi.fn().mockResolvedValue(productRow),
  getProduct: vi.fn().mockResolvedValue(productRow),
  listProducts: vi.fn().mockResolvedValue([productRow]),
  updateProduct: vi.fn().mockResolvedValue(productRow),
  updateStatusAtomic: vi.fn().mockResolvedValue({ ...productRow, status: 'RESERVED' }),
  countImages: vi.fn().mockResolvedValue(1),
  publishProduct: vi.fn().mockResolvedValue(publishedRow),
  unpublishProduct: vi.fn().mockResolvedValue(productRow),
  insertImageRecord: vi.fn().mockResolvedValue(undefined),
};

const storageMock = {
  getPresignedUploadUrl: vi.fn().mockResolvedValue('https://stub-storage.local/key?sas=STUB'),
  getPublicUrl: vi.fn().mockResolvedValue('https://stub-storage.local/key'),
};

const poolMock = { connect: vi.fn() } as unknown as import('pg').Pool;

function makeService(): InventoryService {
  return new InventoryService(repoMock as never, storageMock as never, poolMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue({
    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
  } as never);
  vi.spyOn(tenantContext, 'current').mockReturnValue({
    shopId: SHOP_ID, userId: USER_ID, role: 'shop_admin', authenticated: true,
  } as never);
});

describe('InventoryService', () => {
  describe('createProduct', () => {
    it('calls repo.createProduct with shopId and createdByUserId from context', async () => {
      const svc = makeService();
      await svc.createProduct({
        sku: 'RING-001', metal: 'GOLD', purity: '22K',
        grossWeightG: '10.5000', netWeightG: '9.0000',
      });
      expect(repoMock.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ shopId: SHOP_ID, createdByUserId: USER_ID }),
      );
    });

    it('throws BadRequestException for invalid HUID', async () => {
      const svc = makeService();
      await expect(
        svc.createProduct({
          sku: 'RING-001', metal: 'GOLD', purity: '22K',
          grossWeightG: '10.5000', netWeightG: '9.0000',
          huid: 'bad!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getProduct', () => {
    it('returns product when found', async () => {
      const svc = makeService();
      const result = await svc.getProduct('prod-abc');
      expect(result.id).toBe('prod-abc');
    });

    it('throws NotFoundException when product not found', async () => {
      repoMock.getProduct.mockResolvedValueOnce(null);
      const svc = makeService();
      await expect(svc.getProduct('not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getImageUploadUrl', () => {
    it('returns a URL from storage', async () => {
      const svc = makeService();
      const result = await svc.getImageUploadUrl('prod-abc', 'image/jpeg');
      expect(storageMock.getPresignedUploadUrl).toHaveBeenCalled();
      expect(result).toContain('stub-storage.local');
    });

    it('scopes upload key to tenant prefix', async () => {
      const svc = makeService();
      await svc.getImageUploadUrl('prod-abc', 'image/jpeg');
      const [key] = (storageMock.getPresignedUploadUrl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(key.startsWith(`tenants/${SHOP_ID}/`)).toBe(true);
    });

    it('throws NotFoundException if product does not belong to this tenant', async () => {
      repoMock.getProduct.mockResolvedValueOnce(null);
      const svc = makeService();
      await expect(svc.getImageUploadUrl('other-prod', 'image/jpeg')).rejects.toThrow(NotFoundException);
    });

    it('inserts image record so countImages returns > 0 after upload URL is issued', async () => {
      const svc = makeService();
      await svc.getImageUploadUrl('prod-abc', 'image/jpeg');
      // Allow the fire-and-forget void to settle
      await new Promise((r) => setTimeout(r, 0));
      expect(repoMock.insertImageRecord).toHaveBeenCalledWith(
        SHOP_ID, 'prod-abc', expect.stringContaining(`tenants/${SHOP_ID}/products/prod-abc/`),
      );
    });
  });

  describe('updateStatus', () => {
    it('returns updated product with new status on valid transition', async () => {
      const svc = makeService();
      const result = await svc.updateStatus('prod-abc', { status: 'RESERVED' });
      expect(result.status).toBe('RESERVED');
      expect(repoMock.updateStatusAtomic).toHaveBeenCalledWith('prod-abc', 'IN_STOCK', 'RESERVED');
    });

    it('throws NotFoundException when product not found', async () => {
      repoMock.getProduct.mockResolvedValueOnce(null);
      const svc = makeService();
      await expect(svc.updateStatus('no-such-id', { status: 'RESERVED' })).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException for invalid transition (SOLD → IN_STOCK)', async () => {
      repoMock.getProduct.mockResolvedValueOnce({ ...productRow, status: 'SOLD' });
      const svc = makeService();
      await expect(svc.updateStatus('prod-abc', { status: 'IN_STOCK' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('does NOT call repo.updateStatusAtomic when transition is invalid', async () => {
      repoMock.getProduct.mockResolvedValueOnce({ ...productRow, status: 'SOLD' });
      const svc = makeService();
      await expect(svc.updateStatus('prod-abc', { status: 'RESERVED' })).rejects.toThrow();
      expect(repoMock.updateStatusAtomic).not.toHaveBeenCalled();
    });

    it('allows WITH_KARIGAR → IN_STOCK', async () => {
      repoMock.getProduct.mockResolvedValueOnce({ ...productRow, status: 'WITH_KARIGAR' });
      repoMock.updateStatusAtomic.mockResolvedValueOnce({ ...productRow, status: 'IN_STOCK' });
      const svc = makeService();
      const result = await svc.updateStatus('prod-abc', { status: 'IN_STOCK' });
      expect(result.status).toBe('IN_STOCK');
    });

    it('throws ConflictException when concurrent update wins (0 rows returned)', async () => {
      repoMock.updateStatusAtomic.mockResolvedValueOnce(null);
      const svc = makeService();
      await expect(svc.updateStatus('prod-abc', { status: 'RESERVED' })).rejects.toThrow(ConflictException);
    });
  });

  describe('publish', () => {
    it('happy path: calls publishProduct and returns product with publishedAt set', async () => {
      const svc = makeService();
      const result = await svc.publish('prod-abc');
      expect(repoMock.publishProduct).toHaveBeenCalledWith('prod-abc', USER_ID);
      expect(result.publishedAt).not.toBeNull();
    });

    it('throws UnprocessableEntityException when hallmarked product has empty HUID string', async () => {
      repoMock.getProduct.mockResolvedValueOnce({ ...productRow, huid: '' });
      const svc = makeService();
      await expect(svc.publish('prod-abc')).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when product has no images', async () => {
      repoMock.countImages.mockResolvedValueOnce(0);
      const svc = makeService();
      await expect(svc.publish('prod-abc')).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException when product does not belong to tenant', async () => {
      repoMock.getProduct.mockResolvedValueOnce(null);
      const svc = makeService();
      await expect(svc.publish('prod-abc')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unpublish', () => {
    it('calls unpublishProduct and returns product with null publishedAt', async () => {
      const svc = makeService();
      const result = await svc.unpublish('prod-abc');
      expect(repoMock.unpublishProduct).toHaveBeenCalledWith('prod-abc');
      expect(result.publishedAt).toBeNull();
    });

    it('throws NotFoundException when product not found', async () => {
      repoMock.getProduct.mockResolvedValueOnce(null);
      const svc = makeService();
      await expect(svc.unpublish('prod-abc')).rejects.toThrow(NotFoundException);
    });
  });
});
