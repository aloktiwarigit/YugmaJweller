import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomerAuthGuard, getCustomerCtx } from '../customer/customer-auth.guard';
import { ReviewsService } from './reviews.service';
import type { ListReviewsResponse, ReviewResponse } from './reviews.service';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';

// customerId is NOT accepted from the client — always derived from authenticated context
const CreateReviewSchema = z.object({
  productId:  z.string().uuid(),
  rating:     z.number().int().min(1).max(5),
  reviewText: z.string().max(1000).optional(),
});

@Controller('/api/v1/reviews')
export class ReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly svc: ReviewsService,
  ) {}

  @Post()
  @SkipAuth()
  @SkipTenant()
  @UseGuards(CustomerAuthGuard)
  @UsePipes(new ZodValidationPipe(CreateReviewSchema))
  async createReview(
    @Req() req: Request,
    @Body() body: z.infer<typeof CreateReviewSchema>,
  ): Promise<ReviewResponse> {
    const { customerId, shopId } = getCustomerCtx(req);
    const ctx = this.makeCtx(shopId, customerId);
    return tenantContext.runWith(ctx, () =>
      this.svc.createReview({ ...body, customerId }),
    );
  }

  @Get('products/:productId')
  @SkipAuth()
  listReviews(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ListReviewsResponse> {
    return this.svc.listReviews(productId);
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- shopId comes from authenticated CustomerAuthGuard context, not raw request body
  private makeCtx(shopId: string, userId: string): AuthenticatedTenantContext {
    const tenant: Tenant = { id: shopId, slug: '', display_name: '', status: 'ACTIVE' };
    return { authenticated: true, shopId, userId, role: 'shop_staff', tenant };
  }
}
