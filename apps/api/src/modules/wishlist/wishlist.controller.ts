import {
  Body,
  Controller,
  Delete,
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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { CustomerAuthGuard, getCustomerCtx } from '../customer/customer-auth.guard';
import { WishlistService } from './wishlist.service';
import type { WishlistItemResponse } from './wishlist.service';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';

const AddToWishlistSchema = z.object({
  productId: z.string().uuid(),
});

@Controller('/api/v1/wishlist')
@SkipAuth()
@SkipTenant()
@UseGuards(CustomerAuthGuard)
export class WishlistController {
  constructor(
    @Inject(WishlistService) private readonly svc: WishlistService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(AddToWishlistSchema))
  async addToWishlist(
    @Req() req: Request,
    @Body() body: z.infer<typeof AddToWishlistSchema>,
  ): Promise<{ added: boolean }> {
    const { customerId, shopId } = getCustomerCtx(req);
    return tenantContext.runWith(this.makeCtx(shopId, customerId), () =>
      this.svc.addToWishlist({ customerId, productId: body.productId }),
    );
  }

  @Delete(':productId')
  async removeFromWishlist(
    @Req() req: Request,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    const { customerId, shopId } = getCustomerCtx(req);
    return tenantContext.runWith(this.makeCtx(shopId, customerId), () =>
      this.svc.removeFromWishlist({ customerId, productId }),
    );
  }

  @Get()
  async listWishlist(
    @Req() req: Request,
  ): Promise<WishlistItemResponse[]> {
    const { customerId, shopId } = getCustomerCtx(req);
    return tenantContext.runWith(this.makeCtx(shopId, customerId), () =>
      this.svc.listWishlist(customerId),
    );
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- shopId comes from authenticated CustomerAuthGuard context, not raw request body
  private makeCtx(shopId: string, userId: string): AuthenticatedTenantContext {
    const tenant: Tenant = { id: shopId, slug: '', display_name: '', status: 'ACTIVE' };
    return { authenticated: true, shopId, userId, role: 'shop_staff', tenant };
  }
}
