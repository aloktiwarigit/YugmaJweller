import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
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
    CUSTOMER_REVIEW_SUBMIT: 'CUSTOMER_REVIEW_SUBMIT',
  },
}));

const mockRepo = {
  insert:        vi.fn(),
  listByProduct: vi.fn(),
};

const mockPool = {
  query: vi.fn(),
};

const SHOP_ID    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CUSTOMER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tenantContext.requireCurrent).mockReturnValue({ shopId: SHOP_ID } as never);
});

describe('ReviewsService', () => {
  let svc: ReviewsService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: ReviewsRepository, useValue: mockRepo },
        { provide: 'PG_POOL', useValue: mockPool },
      ],
    }).compile();
    svc = mod.get(ReviewsService);
  });

  describe('createReview', () => {
    it('saves review for a valid product', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] });
      mockRepo.insert.mockResolvedValueOnce({
        id: 'rev-1', shop_id: SHOP_ID, product_id: PRODUCT_ID,
        customer_id: CUSTOMER_ID, rating: 4, review_text: 'Very nice',
        created_at: new Date('2026-01-01T00:00:00Z'),
        customer_first_name: null,
      });

      const result = await svc.createReview({
        productId:  PRODUCT_ID,
        customerId: CUSTOMER_ID,
        rating:     4,
        reviewText: 'Very nice',
      });

      expect(mockRepo.insert).toHaveBeenCalledWith({
        shopId:     SHOP_ID,
        productId:  PRODUCT_ID,
        customerId: CUSTOMER_ID,
        rating:     4,
        reviewText: 'Very nice',
      });
      expect(result.rating).toBe(4);
      expect(result.reviewText).toBe('Very nice');
    });

    it('emits CUSTOMER_REVIEW_SUBMIT audit event with rating and no PII', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] });
      mockRepo.insert.mockResolvedValueOnce({
        id: 'rev-2', shop_id: SHOP_ID, product_id: PRODUCT_ID,
        customer_id: CUSTOMER_ID, rating: 3, review_text: null,
        created_at: new Date(), customer_first_name: null,
      });

      await svc.createReview({ productId: PRODUCT_ID, customerId: CUSTOMER_ID, rating: 3 });

      expect(auditLog).toHaveBeenCalledWith(
        mockPool,
        expect.objectContaining({
          action:      'CUSTOMER_REVIEW_SUBMIT',
          subjectType: 'product',
          subjectId:   PRODUCT_ID,
          actorUserId: CUSTOMER_ID,
        }),
      );
      const call = vi.mocked(auditLog).mock.calls.at(-1)!;
      const after = (call[1] as { after?: Record<string, unknown> }).after ?? {};
      expect(after['rating']).toBe(3);
      expect(after).not.toHaveProperty('reviewText');
      expect(after).not.toHaveProperty('phone');
      expect(after).not.toHaveProperty('pan');
    });

    it('throws NotFoundException for unknown product', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        svc.createReview({ productId: PRODUCT_ID, customerId: CUSTOMER_ID, rating: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(mockRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('listReviews', () => {
    it('returns correct average rating', async () => {
      const mockRows = [
        { id: 'r1', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: CUSTOMER_ID,
          rating: 5, review_text: 'Excellent', created_at: new Date(),
          customer_first_name: 'Priya', avg_rating: '4.5', total_count: '2' },
        { id: 'r2', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: 'other',
          rating: 4, review_text: null, created_at: new Date(),
          customer_first_name: 'Amit', avg_rating: '4.5', total_count: '2' },
      ];
      mockRepo.listByProduct.mockResolvedValueOnce({
        reviews:       mockRows,
        averageRating: 4.5,
        total:         2,
      });

      const result = await svc.listReviews(PRODUCT_ID);

      expect(result.averageRating).toBe(4.5);
      expect(result.total).toBe(2);
      expect(result.reviews).toHaveLength(2);
      expect(result.reviews[0]!.customerFirstName).toBe('Priya');
      expect((result.reviews[0] as unknown as Record<string, unknown>)['customerId']).toBeUndefined();
    });

    it('returns null averageRating when no reviews', async () => {
      mockRepo.listByProduct.mockResolvedValueOnce({
        reviews: [], averageRating: null, total: 0,
      });

      const result = await svc.listReviews(PRODUCT_ID);

      expect(result.averageRating).toBeNull();
      expect(result.total).toBe(0);
    });
  });
});
