import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BarcodeService } from './barcode.service';
import { tenantContext } from '@goldsmith/tenant-context';

// Integration-style tests: BarcodeService wired to a mock repository,
// verifying full request→response behaviour including tenant-isolation logic.

const SHOP_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const SHOP_B = 'bbbbbbbb-0000-0000-0000-000000000000';

const makeProduct = (id: string, shopId: string, sku: string) => ({
  id,
  shop_id: shopId,
  category_id: null,
  sku,
  metal: 'GOLD',
  purity: '22K',
  gross_weight_g: '8.7500',
  net_weight_g: '8.0000',
  stone_weight_g: '0.0000',
  stone_details: null,
  making_charge_override_pct: null,
  huid: null,
  status: 'IN_STOCK',
  published_at: null,
  created_by_user_id: 'user-1',
  created_at: new Date('2026-04-24'),
  updated_at: new Date('2026-04-24'),
});

const PROD_A1 = makeProduct('11111111-1111-1111-1111-111111111111', SHOP_A, 'BANGLE-001');
const PROD_A2 = makeProduct('22222222-2222-2222-2222-222222222222', SHOP_A, 'CHAIN-002');
const PROD_B1 = makeProduct('33333333-3333-3333-3333-333333333333', SHOP_B, 'RING-B1');

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
    shopId: SHOP_A, userId: 'user-1', role: 'shop_admin', authenticated: true,
  } as never);
});

describe('BarcodeService — integration', () => {
  describe('POST /products/barcodes (generateBarcodes)', () => {
    it('returns correct BarcodeData for 3 products', async () => {
      const products = [PROD_A1, PROD_A2, { ...PROD_A1, id: '44444444-4444-4444-4444-444444444444', sku: 'PENDANT-003' }];
      repoMock.getProductsByIds.mockResolvedValue(products);
      const svc = makeService();

      const ids = products.map((p) => p.id);
      const results = await svc.generateBarcodes(ids);

      expect(results).toHaveLength(3);
      // barcodeValue format: GS-{6 hex}-{12 hex}
      for (const r of results) {
        expect(r.barcodeValue).toMatch(/^GS-[0-9a-f]{6}-[0-9a-f]{12}$/);
      }
      expect(results[0].sku).toBe('BANGLE-001');
      expect(results[1].sku).toBe('CHAIN-002');
      expect(results[0].weightDisplay).toBe('8.7500 g');
    });

    it('tenant isolation: productId from tenant B returns NotFoundException with tenant A token', async () => {
      repoMock.getProductsByIds.mockResolvedValue([PROD_B1]);
      const svc = makeService();

      await expect(svc.generateBarcodes([PROD_B1.id])).rejects.toThrow(NotFoundException);
    });

    it('mixed tenant IDs: throws NotFoundException even if some belong to A', async () => {
      repoMock.getProductsByIds.mockResolvedValue([PROD_A1, PROD_B1]);
      const svc = makeService();

      await expect(svc.generateBarcodes([PROD_A1.id, PROD_B1.id])).rejects.toThrow(NotFoundException);
    });
  });
});
