import { describe, expect, it, vi } from 'vitest';
import { ReviewsRepository } from './reviews.repository';

function makePool(rows: object[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

describe('ReviewsRepository', () => {
  it('lists reviews using the current customers.name schema', async () => {
    const rows = [
      {
        id: 'review-1',
        shop_id: 'shop-1',
        product_id: 'product-1',
        customer_id: 'customer-1',
        rating: 5,
        review_text: 'Excellent',
        created_at: new Date('2026-05-01T00:00:00.000Z'),
        customer_first_name: 'Priya',
        avg_rating: '5.0',
        total_count: '1',
      },
    ];
    const pool = makePool(rows);
    const repo = new ReviewsRepository(pool as never);

    const result = await repo.listByProduct({ shopId: 'shop-1', productId: 'product-1' });

    const sql = pool.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain('split_part(c.name');
    expect(sql).not.toContain('full_name');
    expect(sql).toContain('c.shop_id = pr.shop_id');
    expect(result.reviews[0]?.customer_first_name).toBe('Priya');
    expect(result.averageRating).toBe(5);
    expect(result.total).toBe(1);
  });

  it('filters to only publicly visible reviews', async () => {
    const pool = makePool([]);
    const repo = new ReviewsRepository(pool as never);
    await repo.listByProduct({ shopId: 'shop-1', productId: 'product-1' });
    const sql = pool.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain('is_publicly_visible');
  });

  it('renders एक ग्राहक when customer_id is NULL (anonymised review)', async () => {
    const rows = [
      {
        id: 'review-anon',
        shop_id: 'shop-1',
        product_id: 'product-1',
        customer_id: null,
        rating: 4,
        review_text: 'अच्छा',
        created_at: new Date('2026-05-15T00:00:00.000Z'),
        customer_first_name: 'एक ग्राहक',
        avg_rating: '4.0',
        total_count: '1',
      },
    ];
    const pool = makePool(rows);
    const repo = new ReviewsRepository(pool as never);

    const result = await repo.listByProduct({ shopId: 'shop-1', productId: 'product-1' });

    const sql = pool.query.mock.calls[0]?.[0] as string;
    expect(sql).toMatch(/LEFT JOIN customers c/i);
    expect(sql).toMatch(/COALESCE\(\s*split_part\(c\.name, ' ', 1\)\s*,\s*'एक ग्राहक'\s*\)/);
    expect(result.reviews[0]?.customer_first_name).toBe('एक ग्राहक');
  });

  describe('listAllForShop', () => {
    it('returns all reviews including hidden ones for the given shop', async () => {
      const rows = [
        {
          id: 'review-1',
          shop_id: 'shop-1',
          product_id: 'product-1',
          product_name: 'Gold Bangle',
          customer_id: 'customer-1',
          customer_first_name: 'Sunita',
          rating: 4,
          review_text: 'सुंदर है',
          is_publicly_visible: true,
          created_at: new Date('2026-05-10T00:00:00.000Z'),
        },
        {
          id: 'review-2',
          shop_id: 'shop-1',
          product_id: 'product-2',
          product_name: 'Silver Earring',
          customer_id: null,
          customer_first_name: 'एक ग्राहक',
          rating: 2,
          review_text: null,
          is_publicly_visible: false,
          created_at: new Date('2026-05-08T00:00:00.000Z'),
        },
      ];
      const pool = makePool(rows);
      const repo = new ReviewsRepository(pool as never);

      const result = await repo.listAllForShop({ shopId: 'shop-1' });

      const sql = pool.query.mock.calls[0]?.[0] as string;
      // Must NOT filter by is_publicly_visible (shopkeeper sees all)
      expect(sql).not.toContain('is_publicly_visible = TRUE');
      // Must join products and customers for enriched data
      expect(sql).toContain('LEFT JOIN products p');
      expect(sql).toContain('LEFT JOIN customers c');
      expect(sql).toContain('p.name AS product_name');
      expect(sql).toContain('COALESCE(split_part(c.name');
      expect(result).toHaveLength(2);
      expect(result[0]?.is_publicly_visible).toBe(true);
      expect(result[1]?.is_publicly_visible).toBe(false);
    });

    it('passes shopId as query parameter', async () => {
      const pool = makePool([]);
      const repo = new ReviewsRepository(pool as never);

      await repo.listAllForShop({ shopId: 'shop-abc' });

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('shop-abc');
    });
  });

  describe('setVisibility', () => {
    it('issues an UPDATE query with the correct visibility, reviewId and shopId', async () => {
      const pool = makePool([]);
      const repo = new ReviewsRepository(pool as never);

      await repo.setVisibility({ shopId: 'shop-1', reviewId: 'review-uuid', visible: false });

      const sql = pool.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE product_reviews');
      expect(sql).toContain('is_publicly_visible');
      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain(false);
      expect(params).toContain('review-uuid');
      expect(params).toContain('shop-1');
    });

    it('sets visible=true correctly', async () => {
      const pool = makePool([]);
      const repo = new ReviewsRepository(pool as never);

      await repo.setVisibility({ shopId: 'shop-2', reviewId: 'review-xyz', visible: true });

      const params = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(true);
    });
  });
});
