import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WishlistService } from './wishlist.service';
import type { WishlistItemResponse } from './wishlist.service';

const AddToWishlistSchema = z.object({
  customerId: z.string().uuid(),
  productId:  z.string().uuid(),
});

// Wishlist is customer-facing: customer role modelling is deferred, so Firebase auth is enough.
@Controller('/api/v1/wishlist')
export class WishlistController {
  constructor(
    @Inject(WishlistService) private readonly svc: WishlistService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(AddToWishlistSchema))
  addToWishlist(@Body() body: z.infer<typeof AddToWishlistSchema>): Promise<{ added: boolean }> {
    return this.svc.addToWishlist(body);
  }

  @Delete(':productId')
  removeFromWishlist(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<void> {
    return this.svc.removeFromWishlist({ customerId, productId });
  }

  @Get()
  listWishlist(
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<WishlistItemResponse[]> {
    return this.svc.listWishlist(customerId);
  }
}
