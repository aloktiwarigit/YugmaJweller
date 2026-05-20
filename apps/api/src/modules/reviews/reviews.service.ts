import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import { withShopTx } from '@goldsmith/db';
import { ReviewsRepository } from './reviews.repository';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ModerationReviewItem {
  id:                  string;
  productId:           string;
  productName:         string | null;
  customerId:          string | null;
  customerFirstName:   string | null;
  rating:              number;
  reviewText:          string | null;
  isPubliclyVisible:   boolean;
  createdAt:           string;
}

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

export interface PublicReviewItem {
  id:                string;
  rating:            number;
  reviewText:        string | null;
  customerFirstName: string | null;
  createdAt:         string;
}

export interface ListReviewsResponse {
  reviews:       PublicReviewItem[];
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

    // Verify product belongs to this shop before allowing a customer review.
    const { rows } = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM products WHERE id = $1 AND shop_id = $2`,
        [dto.productId, shopId],
      ),
    );
    if (rows.length === 0) throw new NotFoundException({ code: 'product.not_found' });

    const row = await this.repo.insert({
      shopId,
      productId:  dto.productId,
      customerId: dto.customerId,
      rating:     dto.rating,
      reviewText: dto.reviewText,
    });

    void auditLog(this.pool, {
      action:      AuditAction.CUSTOMER_REVIEW_SUBMIT,
      subjectType: 'product',
      subjectId:   dto.productId,
      actorUserId: dto.customerId,
      after:       { rating: dto.rating, shopId },
    }).catch(() => undefined);

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
        rating:            r.rating,
        reviewText:        r.review_text,
        customerFirstName: r.customer_first_name,
        createdAt:         r.created_at.toISOString(),
      })),
      averageRating,
      total,
    };
  }

  async listModerationReviews(): Promise<ModerationReviewItem[]> {
    const { shopId } = tenantContext.requireCurrent();
    const rows = await this.repo.listAllForShop(shopId);
    return rows.map((r) => ({
      id:                r.id,
      productId:         r.product_id,
      productName:       r.product_name,
      customerId:        r.customer_id,
      customerFirstName: r.customer_first_name,
      rating:            r.rating,
      reviewText:        r.review_text,
      isPubliclyVisible: r.is_publicly_visible,
      createdAt:         r.created_at.toISOString(),
    }));
  }

  async setReviewVisibility(reviewId: string, visible: boolean): Promise<void> {
    if (!UUID_RE.test(reviewId)) {
      throw new BadRequestException({ code: 'review.invalid_id' });
    }
    const { shopId, userId } = tenantContext.requireCurrent();
    await this.repo.setVisibility(shopId, reviewId, visible);
    void auditLog(this.pool, {
      action:      AuditAction.REVIEW_MODERATED,
      subjectType: 'review',
      subjectId:   reviewId,
      actorUserId: userId,
      after:       { visible },
    }).catch(() => undefined);
  }
}
