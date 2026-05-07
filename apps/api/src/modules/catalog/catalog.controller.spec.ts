/**
 * Story 4.4 + Wave 5A + Wave 5C — CatalogController unit + HTTP integration tests
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { HttpException, NotFoundException } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { RatesUnavailableError } from '@goldsmith/rates';
import { CatalogController } from './catalog.controller';
import { PricingService } from '../pricing/pricing.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CatalogService } from './catalog.service';
import type { TenantConfigResponse, CatalogProductsResponse } from './catalog.service';

const NOW = new Date('2026-04-24T10:00:00.000Z');
const fakeRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: NOW },
  stale: false,
  source: 'ibja',
};
const mockPricingService = { getCurrentRates: vi.fn() };
const mockAnalyticsService = { recordView: vi.fn().mockResolvedValue(undefined) };
const mockTenantConfig: TenantConfigResponse = {
  shopId: 'shop-uuid-1', primaryColor: '#B58A3C', logoUrl: null,
  appName: 'Test Shop', defaultLanguage: 'hi',
};
const mockProductsResponse: CatalogProductsResponse = { items: [], total: 0, page: 1 };
const mockCatalogService = {
  getTenantConfig: vi.fn().mockResolvedValue(mockTenantConfig),
  getProducts:     vi.fn().mockResolvedValue(mockProductsResponse),
  getProduct:      vi.fn().mockRejectedValue(new NotFoundException()),
  verifyHuid:      vi.fn(),
};

describe('CatalogController', () => {
  let controller: CatalogController;
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [CatalogController],
      providers: [
        { provide: PricingService, useValue: mockPricingService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: CatalogService, useValue: mockCatalogService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<CatalogController>(CatalogController);
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    vi.clearAllMocks();
    (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRates);
    mockCatalogService.getTenantConfig.mockResolvedValue(mockTenantConfig);
    mockCatalogService.getProducts.mockResolvedValue(mockProductsResponse);
    mockCatalogService.getProduct.mockRejectedValue(new NotFoundException());
    mockCatalogService.verifyHuid.mockResolvedValue({ verified: true, huid: 'AB1234', certifyingBody: 'BIS' });
  });

  describe('getPublicRates() — unit', () => {
    it('returns correctly shaped PublicRatesResponse', async () => {
      const result = await controller.getPublicRates();
      expect(result.GOLD_24K).toEqual({ perGramRupees: '7350.00', formattedINR: '₹7,350.00', fetchedAt: NOW.toISOString() });
      expect(result.GOLD_22K.perGramRupees).toBe('6737.50');
      expect(result.stale).toBe(false);
      expect(result.source).toBe('ibja');
    });
    it('propagates stale flag', async () => {
      (mockPricingService.getCurrentRates as Mock).mockResolvedValue({ ...fakeRates, stale: true, source: 'lkg' });
      const result = await controller.getPublicRates();
      expect(result.stale).toBe(true);
    });
    it('returns 503 when rates unavailable', async () => {
      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());
      await expect(controller.getPublicRates()).rejects.toBeInstanceOf(HttpException);
    });
    it('only exposes 24K, 22K, 999 rates', async () => {
      const result = await controller.getPublicRates();
      expect(result).toHaveProperty('GOLD_24K');
      expect(result).not.toHaveProperty('GOLD_18K');
    });
  });

  describe('GET /api/v1/catalog/rates — HTTP', () => {
    it('returns 200 without auth', async () => {
      await request(app.getHttpServer()).get('/api/v1/catalog/rates').expect(200);
    });
    it('has Cache-Control: public, max-age=60', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/catalog/rates');
      expect(res.headers['cache-control']).toBe('public, max-age=60');
    });
    it('returns 503 when unavailable', async () => {
      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());
      const res = await request(app.getHttpServer()).get('/api/v1/catalog/rates').expect(503);
      expect(res.body).toMatchObject({ code: 'rates.unavailable', stale: true });
    });
  });

  describe('GET /api/v1/catalog/tenant-config', () => {
    it('returns 400 when X-Shop-Slug missing', async () => {
      await request(app.getHttpServer()).get('/api/v1/catalog/tenant-config').expect(400);
    });
    it('returns config + cache header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/tenant-config').set('X-Shop-Slug', 'test-shop').expect(200);
      expect(res.body.primaryColor).toBe('#B58A3C');
      expect(res.headers['cache-control']).toBe('public, max-age=3600');
    });
  });

  describe('GET /api/v1/catalog/products', () => {
    it('returns 400 when X-Tenant-Id missing', async () => {
      await request(app.getHttpServer()).get('/api/v1/catalog/products').expect(400);
    });
    it('returns listing + cache header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products').set('X-Tenant-Id', 'shop-uuid').expect(200);
      expect(res.body.items).toBeInstanceOf(Array);
      // No filter params + page=1 → hot path: 5-minute TTL
      expect(res.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=900');
    });
    it('priceMin NaN → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products?priceMin=abc')
        .set('X-Tenant-Id', 'shop-uuid')
        .expect(400);
      expect(res.body).toMatchObject({ code: 'catalog.invalid_price_min' });
    });
    it('priceMax NaN → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products?priceMax=xyz')
        .set('X-Tenant-Id', 'shop-uuid')
        .expect(400);
      expect(res.body).toMatchObject({ code: 'catalog.invalid_price_max' });
    });
    it('filtered cache header when B1 filter param present', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products?purity=GOLD_22K')
        .set('X-Tenant-Id', 'shop-uuid')
        .expect(200);
      expect(res.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=60');
    });
  });

  describe('GET /api/v1/catalog/products/:id', () => {
    it('returns 400 when X-Tenant-Id missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/products/00000000-0000-0000-0000-000000000001').expect(400);
    });
    it('returns 404 for unknown product', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/products/00000000-0000-0000-0000-000000000001')
        .set('X-Tenant-Id', 'shop-uuid').expect(404);
    });
  });

  describe('GET /api/v1/catalog/products/:id/verify-huid', () => {
    const PRODUCT_ID = '00000000-0000-0000-0000-000000000001';
    const BASE_URL   = `/api/v1/catalog/products/${PRODUCT_ID}/verify-huid`;

    it('returns 400 when X-Tenant-Id missing', async () => {
      await request(app.getHttpServer())
        .get(`${BASE_URL}?payload=AB1234`).expect(400);
    });

    it('returns 400 when payload param missing', async () => {
      await request(app.getHttpServer())
        .get(BASE_URL).set('X-Tenant-Id', 'shop-uuid').expect(400);
    });

    it('returns verified=true when HUID matches', async () => {
      mockCatalogService.verifyHuid.mockResolvedValue({
        verified: true, huid: 'AB1234', certifyingBody: 'BIS',
      });
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}?payload=AB1234`)
        .set('X-Tenant-Id', 'shop-uuid')
        .expect(200);
      expect(res.body).toMatchObject({ verified: true, huid: 'AB1234', certifyingBody: 'BIS' });
    });

    it('returns verified=false when HUID does not match', async () => {
      mockCatalogService.verifyHuid.mockResolvedValue({
        verified: false, huid: 'ZZ9999', certifyingBody: 'BIS',
      });
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}?payload=ZZ9999`)
        .set('X-Tenant-Id', 'shop-uuid')
        .expect(200);
      expect(res.body.verified).toBe(false);
    });

    it('has Cache-Control: no-store', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}?payload=AB1234`)
        .set('X-Tenant-Id', 'shop-uuid')
        .expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('accepts BIS URL format payload', async () => {
      mockCatalogService.verifyHuid.mockResolvedValue({
        verified: true, huid: 'AB1234', certifyingBody: 'BIS',
      });
      const payload = encodeURIComponent('https://jewel.bis.gov.in/?huid=AB1234');
      await request(app.getHttpServer())
        .get(`${BASE_URL}?payload=${payload}`)
        .set('X-Tenant-Id', 'shop-uuid')
        .expect(200);
      expect(mockCatalogService.verifyHuid).toHaveBeenCalledWith(
        PRODUCT_ID, 'shop-uuid', 'https://jewel.bis.gov.in/?huid=AB1234',
      );
    });
  });
});
