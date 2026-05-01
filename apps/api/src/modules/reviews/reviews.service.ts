import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import { ReviewsRepository } from './reviews.repository';

export interface CreateReviewDto {
  productId:   string;
  customerId:  string;
  rating:      number;
  reviewText?: string;
}

export interface ReviewResponse {
  id:                string;
  productId:         string;
  customerId:        string;
  rating:            number;
  reviewText:        string | null;
  customerFirstName: string | null;
  createdAt:         string;
}

export interface ListReviewsResponse {
  reviews:       ReviewResponse[];
  averageRating: number | null;
  total:         number;
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(ReviewsRepository) private readonly repo: ReviewsRepository,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async createReview(dto: CreateReviewDto): Promise<ReviewResponse> {
    const { shopId } = tenantContext.requireCurrent();

    // Verify product belongs to this shop
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM products WHERE id = $1 AND shop_id = $2`,
      [dto.productId, shopId],
    );
    if (rows.length === 0) throw new NotFoundException({ code: 'product.not_found' });

    const row = await this.repo.insert({
      shopId,
      productId:  dto.productId,
      customerId: dto.customerId,
      rating:     dto.rating,
      reviewText: dto.reviewText,
    });

    return {
      id:                row.id,
      productId:         row.product_id,
      customerId:        row.customer_id,
      rating:            row.rating,
      reviewText:        row.review_text,
      customerFirstName: row.customer_first_name,
      createdAt:         row.created_at.toISOString(),
    };
  }

  async listReviews(productId: string): Promise<ListReviewsResponse> {
    const { shopId } = tenantContext.requireCurrent();

    const { reviews, averageRating, total } = await this.repo.listByProduct({
      shopId,
      productId,
    });

    return {
      reviews: reviews.map((r) => ({
        id:                r.id,
        productId:         r.product_id,
        customerId:        r.customer_id,
        rating:            r.rating,
        reviewText:        r.review_text,
        customerFirstName: r.customer_first_name,
        createdAt:         r.created_at.toISOString(),
      })),
      averageRating,
      total,
    };
  }
}
