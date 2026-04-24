import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BarcodeService } from './barcode.service';
import { tenantContext } from '@goldsmith/tenant-context';

const SHOP_ID = 'aabbccdd-0000-0000-0000-000000000000';
const OTHER_SHOP_ID = 'ffffffff-0000-0000-0000-000000000000';
const PRODUCT_ID = '11223344-5566-7788-99aa-bbccddee0000';

const productRow = {
  id: PRODUCT_ID,
  shop_id: SHOP_ID,
  category_id: null,
  sku: 'RING-001',
  metal: 'GOLD',
  purity: '22K',
  gross_weight_g: '12.4500',
  net_weight_g: '11.0000',
  stone_weight_g: '0.0000',
  stone_details: null,
  making_charge_override_pct: null,
  huid: 'AB1234',
  status: 'IN_STOCK',
  published_at: null,
  created_by_user_id: 'user-1',
  created_at: new Date('2026-04-24'),
  updated_at: new Date('2026-04-24'),
};

const repoMock = {
  getProduct: vi.fn(),
  getProductsByIds: vi.fn(),
};

function makeService(): BarcodeService {
  return new BarcodeService(repoMock as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue({
    shopId: SHOP_ID, userId: 'user-1', role: 'shop_admin', authenticated: true,
  } as never);
});

describe('BarcodeService', () => {
  describe('generateBarcode', () => {
    it('returns BarcodeData with correctly formatted barcodeValue', async () => {
      repoMock.getProduct.mockResolvedValue(productRow);
      const svc = makeService();
      const result = await svc.generateBarcode(PRODUCT_ID);

      // shopPrefix = first 6 chars of SHOP_ID without hyphens = 'aabbcc'
      // productPrefix = first 12 chars of PRODUCT_ID without hyphens = '112233445566'
      expect(result.barcodeValue).toBe('GS-aabbcc-112233445566');
      expect(result.sku).toBe('RING-001');
      expect(result.productName).toBe('RING-001');
      expect(result.weightDisplay).toBe('12.4500 g');
      expect(result.huid).toBe('AB1234');
      expect(result.metal).toBe('GOLD');
      expect(result.purity).toBe('22K');
    });

    it('throws NotFoundException when product does not belong to current tenant', async () => {
      repoMock.getProduct.mockResolvedValue({ ...productRow, shop_id: OTHER_SHOP_ID });
      const svc = makeService();
      await expect(svc.generateBarcode(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when product not found', async () => {
      repoMock.getProduct.mockResolvedValue(null);
      const svc = makeService();
      await expect(svc.generateBarcode(PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateBarcodes', () => {
    it('returns BarcodeData array for multiple products', async () => {
      const product2 = { ...productRow, id: '99887766-5544-3322-1100-ffeeddccbb00', sku: 'CHAIN-002' };
      repoMock.getProductsByIds.mockResolvedValue([productRow, product2]);
      const svc = makeService();
      const results = await svc.generateBarcodes([PRODUCT_ID, product2.id]);
      expect(results).toHaveLength(2);
      expect(results[0].sku).toBe('RING-001');
      expect(results[1].sku).toBe('CHAIN-002');
    });

    it('enforces max 50 product limit', async () => {
      const svc = makeService();
      const ids = Array.from({ length: 51 }, (_, i) => `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`);
      await expect(svc.generateBarcodes(ids)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when any productId belongs to different tenant', async () => {
      const otherTenantRow = { ...productRow, shop_id: OTHER_SHOP_ID };
      repoMock.getProductsByIds.mockResolvedValue([otherTenantRow]);
      const svc = makeService();
      await expect(svc.generateBarcodes([PRODUCT_ID])).rejects.toThrow(NotFoundException);
    });

    it('returns correct barcodeValue format for batch', async () => {
      repoMock.getProductsByIds.mockResolvedValue([productRow]);
      const svc = makeService();
      const results = await svc.generateBarcodes([PRODUCT_ID]);
      expect(results[0].barcodeValue).toMatch(/^GS-[0-9a-f]{6}-[0-9a-f]{12}$/);
    });
  });
});
