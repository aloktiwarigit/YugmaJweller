import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistRepository } from './wishlist.repository';
import { tenantContext } from '@goldsmith/tenant-context';
import { auditLog } from '@goldsmith/audit';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: vi.fn(),
  },
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditAction: {
    CUSTOMER_WISHLIST_ADD:    'CUSTOMER_WISHLIST_ADD',
    CUSTOMER_WISHLIST_REMOVE: 'CUSTOMER_WISHLIST_REMOVE',
  },
}));

const mockRepo = {
  add:             vi.fn(),
  remove:          vi.fn(),
  listForCustomer: vi.fn(),
  isWishlisted:    vi.fn(),
};

const mockPool = {
  query: vi.fn(),
};

const SHOP_ID     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CUSTOMER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tenantContext.requireCurrent).mockReturnValue({ shopId: SHOP_ID } as never);
});

describe('WishlistService', () => {
  let svc: WishlistService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: WishlistRepository, useValue: mockRepo },
        { provide: 'PG_POOL', useValue: mockPool },
      ],
    }).compile();
    svc = mod.get(WishlistService);
  });

  describe('addToWishlist', () => {
    it('adds product to wishlist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] });
      mockRepo.add.mockResolvedValueOnce({
        id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID,
        product_id: PRODUCT_ID, created_at: new Date(),
      });

      const result = await svc.addToWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID });

      expect(mockRepo.add).toHaveBeenCalledWith({ shopId: SHOP_ID, customerId: CUSTOMER_ID, productId: PRODUCT_ID });
      expect(result).toEqual({ added: true });
    });

    it('emits CUSTOMER_WISHLIST_ADD audit event with no PII', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] });
      mockRepo.add.mockResolvedValueOnce({
        id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID,
        product_id: PRODUCT_ID, created_at: new Date(),
      });

      await svc.addToWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID });

      expect(auditLog).toHaveBeenCalledWith(
        mockPool,
        expect.objectContaining({
          action:      'CUSTOMER_WISHLIST_ADD',
          subjectType: 'product',
          subjectId:   PRODUCT_ID,
          actorUserId: CUSTOMER_ID,
        }),
      );
      const call = vi.mocked(auditLog).mock.calls.at(-1)!;
      const after = (call[1] as { after?: Record<string, unknown> }).after ?? {};
      expect(after).not.toHaveProperty('phone');
      expect(after).not.toHaveProperty('pan');
      expect(after).not.toHaveProperty('name');
    });

    it('throws NotFoundException for unknown product', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        svc.addToWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(mockRepo.add).not.toHaveBeenCalled();
    });
  });

  describe('removeFromWishlist', () => {
    it('removes product from wishlist', async () => {
      mockRepo.remove.mockResolvedValueOnce(undefined);

      await svc.removeFromWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID });

      expect(mockRepo.remove).toHaveBeenCalledWith({
        shopId: SHOP_ID, customerId: CUSTOMER_ID, productId: PRODUCT_ID,
      });
    });

    it('emits CUSTOMER_WISHLIST_REMOVE audit event with no PII', async () => {
      mockRepo.remove.mockResolvedValueOnce(undefined);

      await svc.removeFromWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID });

      expect(auditLog).toHaveBeenCalledWith(
        mockPool,
        expect.objectContaining({
          action:      'CUSTOMER_WISHLIST_REMOVE',
          subjectType: 'product',
          subjectId:   PRODUCT_ID,
          actorUserId: CUSTOMER_ID,
        }),
      );
      const call = vi.mocked(auditLog).mock.calls.at(-1)!;
      const after = (call[1] as { after?: Record<string, unknown> }).after ?? {};
      expect(after).not.toHaveProperty('phone');
      expect(after).not.toHaveProperty('pan');
      expect(after).not.toHaveProperty('name');
    });
  });

  describe('listWishlist', () => {
    it('returns wishlist items for customer', async () => {
      const mockRows = [
        {
          product_id: PRODUCT_ID, sku: 'GLD-001', purity: '22K', metal: 'GOLD',
          gross_weight_g: '10.000', net_weight_g: '9.500', huid: 'AB123456',
          added_at: new Date('2026-01-01T00:00:00Z'),
        },
      ];
      mockRepo.listForCustomer.mockResolvedValueOnce(mockRows);

      const result = await svc.listWishlist(CUSTOMER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]!.productId).toBe(PRODUCT_ID);
      expect(result[0]!.purity).toBe('22K');
    });
  });

  describe('toggle round-trip', () => {
    it('add then remove works correctly', async () => {
      // Add
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] });
      mockRepo.add.mockResolvedValueOnce({ id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID, product_id: PRODUCT_ID, created_at: new Date() });
      await svc.addToWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID });

      // Remove
      mockRepo.remove.mockResolvedValueOnce(undefined);
      await svc.removeFromWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID });

      // Re-add
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] });
      mockRepo.add.mockResolvedValueOnce({ id: 'w2', shop_id: SHOP_ID, customer_id: CUSTOMER_ID, product_id: PRODUCT_ID, created_at: new Date() });
      const result = await svc.addToWishlist({ customerId: CUSTOMER_ID, productId: PRODUCT_ID });

      expect(result).toEqual({ added: true });
      expect(mockRepo.add).toHaveBeenCalledTimes(2);
      expect(mockRepo.remove).toHaveBeenCalledTimes(1);
    });
  });
});
