import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Res } from '@nestjs/common';
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

  // ── Rate-Lock Checkout Page ───────────────────────────────────────────────────
  // Serves a self-contained HTML page that loads Razorpay checkout.js and opens
  // the payment modal. Mobile app opens this URL via Linking.openURL; the webhook
  // activates the booking server-side on payment capture.

  @Get('rate-lock/bookings/:id/payment-page')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async getRateLockPaymentPage(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { customerId, shopId } = getCustomerCtx(req);

    // Verify booking belongs to this customer+shop
    const row = await this.pool.query<{
      razorpay_order_id: string | null;
      deposit_amount_paise: string;
      status: string;
    }>(
      `SELECT razorpay_order_id, deposit_amount_paise::text, status
       FROM rate_lock_bookings
       WHERE id = $1 AND customer_id = $2 AND shop_id = $3`,
      [bookingId, customerId, shopId],
    );
    if (!row.rows[0]) throw new NotFoundException({ code: 'rate_lock.not_found' });
    if (row.rows[0].status !== 'PENDING_PAYMENT') {
      throw new NotFoundException({ code: 'rate_lock.not_pending_payment' });
    }
    const orderId     = row.rows[0].razorpay_order_id;
    const amountPaise = row.rows[0].deposit_amount_paise;
    if (!orderId) throw new NotFoundException({ code: 'rate_lock.order_not_created' });

    const shopRow = await this.pool.query<{ display_name: string }>(
      `SELECT display_name FROM shops WHERE id = $1 LIMIT 1`,
      [shopId],
    );
    const shopName = shopRow.rows[0]?.display_name ?? 'Goldsmith';
    const keyId    = process.env['RAZORPAY_KEY_ID'] ?? '';

    const html = buildRazorpayCheckoutHtml({ orderId, amountPaise, shopName, keyId });
    res.send(html);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async buildSyntheticCtx(shopId: string, customerId: string): Promise<AuthenticatedTenantContext> {
    const row = await this.pool.query<{ slug: string; display_name: string; status: string }>(
      `SELECT slug, display_name, status FROM shops WHERE id = $1 LIMIT 1`,
      [shopId],
    );
    if (!row.rows[0]) throw new UnauthorizedException({ code: 'customer.shop_not_found' });

    // Guard: only serve ACTIVE shops. SUSPENDED/TERMINATED/PROVISIONING shops must be
    // rejected here because @SkipTenant bypasses the TenantInterceptor status check.
    if (row.rows[0].status !== 'ACTIVE') {
      throw new ServiceUnavailableException({ code: 'tenant.inactive' });
    }

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

function buildRazorpayCheckoutHtml(params: {
  orderId:     string;
  amountPaise: string;
  shopName:    string;
  keyId:       string;
}): string {
  // HTML-escape for HTML text/attribute context (title, h1, p).
  const escHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // JSON.stringify for values embedded inside <script> — HTML entity encoding is
  // NOT decoded by JS parsers inside script blocks, so esc() is wrong there.
  // JSON.stringify properly escapes backslashes, quotes, and all control chars.
  const jsStr = (s: string): string => JSON.stringify(s);

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>भुगतान — ${escHtml(params.shopName)}</title>
  <style>
    body { font-family: sans-serif; display:flex; align-items:center; justify-content:center;
           min-height:100vh; margin:0; background:#FFFBF5; }
    .card { text-align:center; padding:2rem; max-width:360px; }
    h1 { font-size:1.4rem; color:#1C1917; margin-bottom:0.5rem; }
    p  { color:#6B7280; font-size:0.9rem; margin-bottom:1.5rem; }
    button { background:#B8860B; color:#fff; border:none; border-radius:8px;
             padding:14px 32px; font-size:1rem; cursor:pointer; min-width:200px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escHtml(params.shopName)}</h1>
    <p>दर-लॉक जमा राशि — ₹${Math.round(Number(params.amountPaise) / 100).toLocaleString('en-IN')}</p>
    <button id="payBtn">Razorpay से भुगतान करें</button>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    document.getElementById('payBtn').addEventListener('click', function() {
      var rzp = new Razorpay({
        key:      ${jsStr(params.keyId)},
        order_id: ${jsStr(params.orderId)},
        amount:   ${jsStr(params.amountPaise)},
        currency: "INR",
        name:     ${jsStr(params.shopName)},
        description: "दर-लॉक जमा राशि",
        handler: function(response) {
          document.querySelector('.card').innerHTML =
            '<h1>भुगतान सफल!</h1><p>ऐप पर वापस जाएं। बुकिंग जल्द सक्रिय होगी।</p>';
        },
        modal: { ondismiss: function() {} }
      });
      rzp.open();
    });
    // Auto-open on load for smoother UX
    window.addEventListener('load', function() {
      document.getElementById('payBtn').click();
    });
  </script>
</body>
</html>`;
}
