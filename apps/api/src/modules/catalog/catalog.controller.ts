import {
  BadRequestException, Body, Controller, Get, Header,
  Headers, HttpCode, HttpException, HttpStatus,
  Inject, Ip, Param, ParseUUIDPipe, Post, Query, Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { assertPublicTenantHeader, isUuidShape } from '../../common/validators/tenant-header';
import { PricingService } from '../pricing/pricing.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CatalogService } from './catalog.service';
import type { TenantConfigResponse, CatalogProductsResponse, CatalogProduct, HuidVerifyResult, PublicImageRow } from './catalog.service';
import { RatesUnavailableError } from '@goldsmith/rates';
import type { PublicReviewsResponse, Collection, CategoryNode } from '@goldsmith/customer-shared';
import type { StorefrontConfig } from '@goldsmith/shared';

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
  async listPublished(
    @Headers('x-tenant-id') shopId: string,
    @Query('categoryId')  categoryId?: string,
    @Query('search')      search?: string,
    @Query('metal')       metal?: string,
    @Query('purity')      purity?: string,
    @Query('priceMin')    priceMinRaw?: string,
    @Query('priceMax')    priceMaxRaw?: string,
    @Query('inStockOnly') inStockOnlyRaw?: string,
    @Query('style')       style?: string,
    @Query('occasion')    occasion?: string,
    @Query('giftPersona') giftPersona?: string,
    @Query('collection')  collection?: string,
    @Query('sort')        sort?: string,
    @Query('page')        page = '1',
    @Query('limit')       limit = '12',
    @Res({ passthrough: true }) res?: Response,
  ): Promise<CatalogProductsResponse> {
    shopId = assertPublicTenantHeader(shopId);

    let priceMin: number | undefined;
    let priceMax: number | undefined;

    if (priceMinRaw !== undefined) {
      priceMin = parseInt(priceMinRaw, 10);
      if (isNaN(priceMin)) throw new BadRequestException({ code: 'catalog.invalid_price_min' });
    }
    if (priceMaxRaw !== undefined) {
      priceMax = parseInt(priceMaxRaw, 10);
      if (isNaN(priceMax)) throw new BadRequestException({ code: 'catalog.invalid_price_max' });
    }

    const parsedPage  = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

    // Homepage hot path: sort=newest (or default), page=1, no filters beyond base
    const isHotPath =
      parsedPage === 1 &&
      (!sort || sort === 'newest') &&
      !categoryId && !search && !metal &&
      !purity && !priceMinRaw && !priceMaxRaw &&
      !inStockOnlyRaw && !style && !occasion && !giftPersona && !collection;

    res?.setHeader(
      'Cache-Control',
      isHotPath
        ? 'public, max-age=300, stale-while-revalidate=900'
        : 'public, max-age=30, stale-while-revalidate=60',
    );

    return this.catalogService.getProducts({
      shopId,
      categoryId,
      search,
      metal,
      purity,
      priceMin,
      priceMax,
      inStockOnly: inStockOnlyRaw === 'true',
      style,
      occasion,
      giftPersona,
      collection,
      sort: sort as 'newest' | 'priceAsc' | 'priceDesc' | 'trending' | 'bestseller' | undefined,
      page:  parsedPage,
      limit: parsedLimit,
    });
  }

  // -------------------------------------------------------------------------
  // B2 — GET /catalog/products/featured
  // MUST be registered before products/:id to avoid NestJS matching "featured" as :id
  // -------------------------------------------------------------------------

  @Get('products/featured')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900')
  async getFeatured(
    @Headers('x-tenant-id') shopId: string,
    @Query('limit') limitRaw = '12',
  ): Promise<{ items: CatalogProduct[] }> {
    shopId = assertPublicTenantHeader(shopId);
    const limit = Math.min(20, Math.max(1, parseInt(limitRaw, 10) || 12));
    return this.catalogService.getFeatured(shopId, limit);
  }

  // -------------------------------------------------------------------------
  // B2 — GET /catalog/products/new-arrivals
  // -------------------------------------------------------------------------

  @Get('products/new-arrivals')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900')
  async getNewArrivals(
    @Headers('x-tenant-id') shopId: string,
    @Query('limit') limitRaw = '12',
  ): Promise<{ items: CatalogProduct[] }> {
    shopId = assertPublicTenantHeader(shopId);
    const limit = Math.min(20, Math.max(1, parseInt(limitRaw, 10) || 12));
    return this.catalogService.getNewArrivals(shopId, limit);
  }

  // -------------------------------------------------------------------------
  // B2 — GET /catalog/products/top-sellers
  // -------------------------------------------------------------------------

  @Get('products/top-sellers')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800')
  async getTopSellers(
    @Headers('x-tenant-id') shopId: string,
    @Query('limit') limitRaw = '12',
  ): Promise<{ items: CatalogProduct[] }> {
    shopId = assertPublicTenantHeader(shopId);
    const limit = Math.min(20, Math.max(1, parseInt(limitRaw, 10) || 12));
    return this.catalogService.getTopSellers(shopId, limit);
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
    shopId = assertPublicTenantHeader(shopId);
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
    shopId = assertPublicTenantHeader(shopId);
    if (!payload) throw new BadRequestException({ code: 'catalog.huid_payload_required' });
    return this.catalogService.verifyHuid(productId, shopId, payload);
  }

  // -------------------------------------------------------------------------
  // GET /catalog/products/:id/images — Story 17.1 Task 7
  // Public endpoint; tenant scoped by x-tenant-id header (same as getProduct).
  // Returns PublicImageRow[] — no storage_key, server-built srcset + URLs.
  // -------------------------------------------------------------------------

  @Get('products/:id/images')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  async listProductImages(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
  ): Promise<{ images: PublicImageRow[] }> {
    shopId = assertPublicTenantHeader(shopId);
    const images = await this.catalogService.listPublicImages(productId, shopId);
    return { images };
  }

  // -------------------------------------------------------------------------
  // GET /catalog/products/:id/reviews — Story B4 (PII-redacted, public)
  // -------------------------------------------------------------------------

  @Get('products/:id/reviews')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  async getProductReviews(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ): Promise<PublicReviewsResponse> {
    shopId = assertPublicTenantHeader(shopId);
    return this.catalogService.getPublicProductReviews({
      shopId,
      productId,
      page:  Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
    });
  }

  // -------------------------------------------------------------------------
  // B6 — GET /catalog/products/:id/recommendations
  // -------------------------------------------------------------------------

  @Get('products/:id/recommendations')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=300')
  async getRecommendations(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
  ): Promise<{ items: CatalogProduct[] }> {
    shopId = assertPublicTenantHeader(shopId);
    return this.catalogService.getRecommendations(productId, shopId);
  }

  // -------------------------------------------------------------------------
  // B2 — GET /catalog/categories
  // -------------------------------------------------------------------------

  @Get('categories')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600')
  async getCategories(
    @Headers('x-tenant-id') shopId: string,
  ): Promise<{ categories: CategoryNode[] }> {
    shopId = assertPublicTenantHeader(shopId);
    return this.catalogService.getCategories(shopId);
  }

  // -------------------------------------------------------------------------
  // B2 — GET /catalog/collections
  // -------------------------------------------------------------------------

  @Get('collections')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900')
  async getCollections(
    @Headers('x-tenant-id') shopId: string,
  ): Promise<{ items: Collection[] }> {
    shopId = assertPublicTenantHeader(shopId);
    return this.catalogService.getCollections(shopId);
  }

  // -------------------------------------------------------------------------
  // B2 — GET /catalog/collections/:slug
  // -------------------------------------------------------------------------

  @Get('collections/:slug')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=300')
  async getCollection(
    @Param('slug') slug: string,
    @Headers('x-tenant-id') shopId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '12',
  ): Promise<{ collection: Collection; products: CatalogProductsResponse }> {
    shopId = assertPublicTenantHeader(shopId);
    if (!slug) throw new BadRequestException({ code: 'catalog.slug_required' });
    return this.catalogService.getCollection(
      slug,
      shopId,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(50, Math.max(1, parseInt(limit, 10) || 12)),
    );
  }

  // -------------------------------------------------------------------------
  // B5 — GET /catalog/storefront-config
  // -------------------------------------------------------------------------

  @Get('storefront-config')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800')
  async getStorefrontConfig(
    @Headers('x-tenant-id') shopId: string,
  ): Promise<StorefrontConfig> {
    shopId = assertPublicTenantHeader(shopId);
    return this.catalogService.getStorefrontConfig(shopId);
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
    // Best-effort analytics — drop silently on missing/malformed input rather than
    // surfacing 4xx. Validates UUID shape before passing to analyticsService (which
    // calls withShopTx); never let a raw header value reach set_config().
    if (!shopId || !body.sessionId || !isUuidShape(shopId)) return;

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
