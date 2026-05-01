import {
  BadRequestException, Body, Controller, Get, Header,
  Headers, HttpCode, HttpException, HttpStatus,
  Inject, Ip, Param, ParseUUIDPipe, Post, Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { PricingService } from '../pricing/pricing.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CatalogService } from './catalog.service';
import type { TenantConfigResponse, CatalogProductsResponse, CatalogProduct, HuidVerifyResult } from './catalog.service';
import { RatesUnavailableError } from '@goldsmith/rates';

// ---------------------------------------------------------------------------
// Public rates response shape (Story 4.4 — unchanged)
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
// Controller — throttled at class level for public catalog endpoints
// ---------------------------------------------------------------------------

@Controller('/api/v1/catalog')
@UseGuards(ThrottlerGuard)
export class CatalogController {
  private readonly viewRateCache = new Map<string, true>();

  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /catalog/tenant-config
  // -------------------------------------------------------------------------

  @Get('tenant-config')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=3600')
  async getTenantConfig(
    @Headers('x-shop-slug') slug: string,
  ): Promise<TenantConfigResponse> {
    if (!slug) throw new BadRequestException({ code: 'catalog.slug_required' });
    return this.catalogService.getTenantConfig(slug);
  }

  // -------------------------------------------------------------------------
  // GET /catalog/products
  // -------------------------------------------------------------------------

  @Get('products')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  async listPublished(
    @Headers('x-tenant-id') shopId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('metal') metal?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '12',
  ): Promise<CatalogProductsResponse> {
    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
    return this.catalogService.getProducts({
      shopId,
      categoryId,
      search,
      metal,
      page:  Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 12)),
    });
  }

  // -------------------------------------------------------------------------
  // GET /catalog/products/:id
  // -------------------------------------------------------------------------

  @Get('products/:id')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  async getProduct(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
  ): Promise<CatalogProduct> {
    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
    return this.catalogService.getProduct(productId, shopId);
  }

  // -------------------------------------------------------------------------
  // GET /catalog/products/:id/verify-huid — Story 5C HUID QR verification
  // -------------------------------------------------------------------------

  @Get('products/:id/verify-huid')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'no-store')
  async verifyHuid(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
    @Query('payload') payload: string,
  ): Promise<HuidVerifyResult> {
    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
    if (!payload) throw new BadRequestException({ code: 'catalog.huid_payload_required' });
    return this.catalogService.verifyHuid(productId, shopId, payload);
  }

  // -------------------------------------------------------------------------
  // GET /catalog/rates — Story 4.4 (unchanged)
  // -------------------------------------------------------------------------

  @Get('rates')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=60')
  async getPublicRates(): Promise<PublicRatesResponse> {
    try {
      const rates = await this.pricingService.getCurrentRates();
      return {
        GOLD_24K:    toPublicEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt),
        GOLD_22K:    toPublicEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt),
        SILVER_999:  toPublicEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt),
        stale:       rates.stale,
        source:      rates.source,
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

  // -------------------------------------------------------------------------
  // POST /catalog/products/:id/view — Story 3B analytics (unchanged)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // GET /catalog/return-policy — public; reads shop_settings per tenant
  // -------------------------------------------------------------------------

  @Get('return-policy')
  @SkipAuth()
  @Header('Cache-Control', 'public, max-age=300')
  getReturnPolicy(): Promise<{ returnPolicyText: string | null }> {
    return this.catalogService.getReturnPolicy();
  }
}
