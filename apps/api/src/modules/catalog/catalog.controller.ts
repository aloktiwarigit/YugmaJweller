import { Body, Controller, Get, Header, Headers, HttpCode, HttpException, HttpStatus, Inject, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { PricingService } from '../pricing/pricing.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RatesUnavailableError } from '@goldsmith/rates';

// ---------------------------------------------------------------------------
// Public rates response shape (Story 4.4)
// ---------------------------------------------------------------------------

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR: string;
  fetchedAt: string;
}

export interface PublicRatesResponse {
  GOLD_24K: PublicRateEntry;
  GOLD_22K: PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale: boolean;
  source: string;
  refreshedAt: string;
}

function toPublicEntry(paise: bigint, fetchedAt: Date): PublicRateEntry {
  const rupees = (Number(paise) / 100).toFixed(2);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(paise) / 100);
  return {
    perGramRupees: rupees,
    formattedINR: `₹${formatted}`,
    fetchedAt: fetchedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('/api/v1/catalog')
export class CatalogController {
  private readonly viewRateCache = new Map<string, true>();

  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
  ) {}

  // TODO Epic 7: implement full catalog with search + filters
  @Get('products')
  @SkipAuth()
  @SkipTenant()
  listPublished(@Headers('x-tenant-id') tenantId: string): { items: unknown[]; total: number; tenantId: string } {
    return { items: [], total: 0, tenantId };
  }

  /**
   * GET /api/v1/catalog/rates
   * Public — no auth. Tenant-agnostic (IBJA rates are platform-global).
   * Serves market rates only; per-tenant overrides are never applied here.
   */
  @Get('rates')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=60')
  async getPublicRates(): Promise<PublicRatesResponse> {
    try {
      const rates = await this.pricingService.getCurrentRates();
      return {
        GOLD_24K: toPublicEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt),
        GOLD_22K: toPublicEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt),
        SILVER_999: toPublicEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt),
        stale: rates.stale,
        source: rates.source,
        refreshedAt: rates.GOLD_24K.fetchedAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof RatesUnavailableError) {
        throw new HttpException(
          { code: 'rates.unavailable', stale: true },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/catalog/products/:id/view
   * Public — no auth or tenant context required.
   * Rate-limited per IP+product: max 1 event per 60s (in-memory Map).
   * Consent gate and 30s session dedup enforced in AnalyticsService.
   */
  @Post('products/:id/view')
  @HttpCode(204)
  @SkipAuth()
  @SkipTenant()
  async recordProductView(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
    @Ip() ip: string,
    @Body() body: { sessionId?: string; customerId?: string; durationSeconds?: number },
  ): Promise<void> {
    if (!shopId || !body.sessionId) return;

    const rateCacheKey = `${ip}:${productId}`;
    if (this.viewRateCache.has(rateCacheKey)) return;
    this.viewRateCache.set(rateCacheKey, true);
    setTimeout(() => this.viewRateCache.delete(rateCacheKey), 60_000);

    void this.analyticsService.recordView({
      shopId,
      productId,
      customerId: body.customerId,
      sessionId: body.sessionId,
      durationSeconds: body.durationSeconds,
    }).catch(() => undefined);
  }
}
