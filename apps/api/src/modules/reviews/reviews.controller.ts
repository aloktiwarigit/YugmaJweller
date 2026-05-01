import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReviewsService } from './reviews.service';
import type { ListReviewsResponse, ReviewResponse } from './reviews.service';

const CreateReviewSchema = z.object({
  productId:  z.string().uuid(),
  customerId: z.string().uuid(),
  rating:     z.number().int().min(1).max(5),
  reviewText: z.string().max(1000).optional(),
});

@Controller('reviews')
export class ReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly svc: ReviewsService,
  ) {}

  @Post()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  @UsePipes(new ZodValidationPipe(CreateReviewSchema))
  createReview(@Body() body: z.infer<typeof CreateReviewSchema>): Promise<ReviewResponse> {
    return this.svc.createReview(body);
  }

  @Get('products/:productId')
  @SkipAuth()
  listReviews(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ListReviewsResponse> {
    return this.svc.listReviews(productId);
  }
}
