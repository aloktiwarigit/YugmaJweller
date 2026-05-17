import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { withShopTx } from '@goldsmith/db';

export interface ReviewRow {
  id:           string;
  shop_id:      string;
  product_id:   string;
  customer_id:  string;
  rating:       number;
  review_text:  string | null;
  created_at:   Date;
  customer_first_name: string | null;
}

@Injectable()
export class ReviewsRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async insert(params: {
    shopId:      string;
    productId:   string;
    customerId:  string;
    rating:      number;
    reviewText?: string;
  }): Promise<ReviewRow> {
    return withShopTx(this.pool, params.shopId, async (tx) => {
      const { rows } = await tx.query<ReviewRow>(
        `INSERT INTO product_reviews (shop_id, product_id, customer_id, rating, review_text)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (shop_id, customer_id, product_id)
         DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text,
                       created_at = NOW()
         RETURNING *, NULL AS customer_first_name`,
        [params.shopId, params.productId, params.customerId, params.rating, params.reviewText ?? null],
      );
      return rows[0]!;
    });
  }

  async listByProduct(params: {
    shopId:    string;
    productId: string;
  }): Promise<{ reviews: ReviewRow[]; averageRating: number | null; total: number }> {
    return withShopTx(this.pool, params.shopId, async (tx) => {
      // Join customers to get first name only (privacy)
      const { rows } = await tx.query<ReviewRow & { avg_rating: string | null; total_count: string }>(
        `SELECT pr.id, pr.shop_id, pr.product_id, pr.customer_id,
                pr.rating, pr.review_text, pr.created_at,
                split_part(c.name, ' ', 1) AS customer_first_name,
                AVG(pr.rating) OVER () AS avg_rating,
                COUNT(*) OVER ()::text AS total_count
           FROM product_reviews pr
           JOIN customers c ON c.id = pr.customer_id AND c.shop_id = pr.shop_id
           JOIN products p ON p.id = pr.product_id AND p.shop_id = pr.shop_id AND p.published_at IS NOT NULL
          WHERE pr.shop_id = $1 AND pr.product_id = $2
              AND pr.is_publicly_visible = TRUE
          ORDER BY pr.created_at DESC
          LIMIT 50`,
        [params.shopId, params.productId],
      );

      if (rows.length === 0) {
        return { reviews: rows, averageRating: null, total: 0 };
      }

      const avgRating = rows[0]!.avg_rating ? Math.round(parseFloat(rows[0]!.avg_rating) * 10) / 10 : null;
      const total     = parseInt(rows[0]!.total_count, 10);

      return { reviews: rows, averageRating: avgRating, total };
    });
  }
}
