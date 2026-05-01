import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';
import type { LoyaltyState, LoyaltyTransaction } from '@goldsmith/shared';
import type { Pool } from 'pg';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomerAuthGuard, getCustomerCtx } from './customer-auth.guard';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { RateLockBookingsService } from '../rate-lock-bookings/rate-lock-bookings.service';
import type { RateLockBookingResult } from '../rate-lock-bookings/rate-lock-bookings.service';
import { TryAtHomeBookingsService } from '../try-at-home-bookings/try-at-home-bookings.service';
import type { BookingResponse } from '../try-at-home-bookings/try-at-home-bookings.service';

const CreateRateLockSchema = z.object({
  depositAmountPaise: z.string().regex(/^\d+$/, 'Must be a positive integer string'),
});

const CreateTryAtHomeSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(20),
  notes:      z.string().max(500).optional(),
});

@Controller('/api/v1/customer')
@SkipAuth()
@SkipTenant()
@UseGuards(CustomerAuthGuard)
export class CustomerController {
  constructor(
    @Inject('PG_POOL')                 private readonly pool: Pool,
    @Inject(LoyaltyService)            private readonly loyaltySvc: LoyaltyService,
    @Inject(RateLockBookingsService)   private readonly rateLockSvc: RateLockBookingsService,
    @Inject(TryAtHomeBookingsService)  private readonly taSvc: TryAtHomeBookingsService,
  ) {}

  // ── Loyalty ──────────────────────────────────────────────────────────────────

  @Get('loyalty')
  async getLoyalty(
    @Req() req: Request,
  ): Promise<{ state: LoyaltyState; transactions: LoyaltyTransaction[] }> {
    const { customerId, shopId } = getCustomerCtx(req);
    const ctx = await this.buildSyntheticCtx(shopId, customerId);
    const [state, transactions] = await Promise.all([
      tenantContext.runWith(ctx, () => this.loyaltySvc.getLoyaltyState(customerId)),
      tenantContext.runWith(ctx, () => this.loyaltySvc.getRecentTransactions(customerId, 10)),
    ]);
    return { state, transactions };
  }

  // ── Rate-Lock ─────────────────────────────────────────────────────────────────

  @Post('rate-lock/bookings')
  @HttpCode(201)
  async createRateLockBooking(
    @Req() req: Request,
    @Body(new ZodValidationPipe(CreateRateLockSchema)) dto: z.infer<typeof CreateRateLockSchema>,
  ): Promise<RateLockBookingResult> {
    const { customerId, shopId } = getCustomerCtx(req);
    const depositAmountPaise = BigInt(dto.depositAmountPaise);
    if (depositAmountPaise <= 0n) {
      throw new UnauthorizedException({ code: 'rate_lock.deposit_amount_required' });
    }
    const ctx = await this.buildSyntheticCtx(shopId, customerId);
    return tenantContext.runWith(ctx, () =>
      this.rateLockSvc.createBooking({ customerId, depositAmountPaise }),
    );
  }

  // ── Try-at-Home ───────────────────────────────────────────────────────────────

  @Post('try-at-home/bookings')
  @HttpCode(201)
  async createTryAtHomeBooking(
    @Req() req: Request,
    @Body(new ZodValidationPipe(CreateTryAtHomeSchema)) dto: z.infer<typeof CreateTryAtHomeSchema>,
  ): Promise<BookingResponse> {
    const { customerId, shopId } = getCustomerCtx(req);
    const ctx = await this.buildSyntheticCtx(shopId, customerId);
    return tenantContext.runWith(ctx, () =>
      this.taSvc.createBooking({ customerId, productIds: dto.productIds, notes: dto.notes }),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async buildSyntheticCtx(shopId: string, customerId: string): Promise<AuthenticatedTenantContext> {
    const row = await this.pool.query<{ slug: string; display_name: string }>(
      `SELECT slug, display_name FROM shops WHERE id = $1 LIMIT 1`,
      [shopId],
    );
    if (!row.rows[0]) throw new UnauthorizedException({ code: 'customer.shop_not_found' });

    const tenant: Tenant = {
      id:           shopId,
      slug:         row.rows[0].slug,
      display_name: row.rows[0].display_name,
      status:       'ACTIVE',
    };

    return {
      authenticated: true,
      shopId,
      userId:  customerId,
      role:    'shop_staff',
      tenant,
    };
  }
}
