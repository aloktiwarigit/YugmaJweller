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
});
