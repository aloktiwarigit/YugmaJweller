import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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

const repoMock = {
  createProduct: vi.fn().mockResolvedValue(productRow),
  getProduct: vi.fn().mockResolvedValue(productRow),
  listProducts: vi.fn().mockResolvedValue([productRow]),
  updateProduct: vi.fn().mockResolvedValue(productRow),
  updateStatus: vi.fn().mockResolvedValue({ ...productRow, status: 'RESERVED' }),
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
  });

  describe('updateStatus', () => {
    it('returns updated product with new status on valid transition', async () => {
      const svc = makeService();
      const result = await svc.updateStatus('prod-abc', { status: 'RESERVED' });
      expect(result.status).toBe('RESERVED');
      expect(repoMock.updateStatus).toHaveBeenCalledWith('prod-abc', 'RESERVED');
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

    it('does NOT call repo.updateStatus when transition is invalid', async () => {
      repoMock.getProduct.mockResolvedValueOnce({ ...productRow, status: 'SOLD' });
      const svc = makeService();
      await expect(svc.updateStatus('prod-abc', { status: 'RESERVED' })).rejects.toThrow();
      expect(repoMock.updateStatus).not.toHaveBeenCalled();
    });

    it('allows WITH_KARIGAR → IN_STOCK', async () => {
      repoMock.getProduct.mockResolvedValueOnce({ ...productRow, status: 'WITH_KARIGAR' });
      repoMock.updateStatus.mockResolvedValueOnce({ ...productRow, status: 'IN_STOCK' });
      const svc = makeService();
      const result = await svc.updateStatus('prod-abc', { status: 'IN_STOCK' });
      expect(result.status).toBe('IN_STOCK');
    });
  });
});
