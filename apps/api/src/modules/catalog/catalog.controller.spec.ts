/**
 * Story 4.4 — CatalogController unit + HTTP integration tests
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import request from 'supertest';
import { RatesUnavailableError } from '@goldsmith/rates';
import { CatalogController } from './catalog.controller';
import { PricingService } from '../pricing/pricing.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const mockPricingService = {
  getCurrentRates: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CatalogController', () => {
  let controller: CatalogController;
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: PricingService, useValue: mockPricingService }],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRates);
  });

  // -------------------------------------------------------------------------
  // Unit tests — getPublicRates()
  // -------------------------------------------------------------------------

  describe('getPublicRates() — unit', () => {
    it('returns correctly shaped PublicRatesResponse', async () => {
      const result = await controller.getPublicRates();

      expect(result.GOLD_24K).toEqual({
        perGramRupees: '7350.00',
        formattedINR: '₹7,350.00',
        fetchedAt: NOW.toISOString(),
      });
      expect(result.GOLD_22K.perGramRupees).toBe('6737.50');
      expect(result.GOLD_22K.formattedINR).toMatch(/^₹/);
      expect(result.SILVER_999).toEqual({
        perGramRupees: '95.00',
        formattedINR: '₹95.00',
        fetchedAt: NOW.toISOString(),
      });
      expect(result.stale).toBe(false);
      expect(result.source).toBe('ibja');
      expect(result.refreshedAt).toBe(NOW.toISOString());
    });

    it('propagates stale flag from rates service', async () => {
      (mockPricingService.getCurrentRates as Mock).mockResolvedValue({
        ...fakeRates,
        stale: true,
        source: 'last_known_good',
      });

      const result = await controller.getPublicRates();
      expect(result.stale).toBe(true);
      expect(result.source).toBe('last_known_good');
    });

    it('returns 503 with rates.unavailable + stale:true when all sources fail', async () => {
      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());

      await expect(controller.getPublicRates()).rejects.toBeInstanceOf(HttpException);

      try {
        await controller.getPublicRates();
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(503);
        expect((err as HttpException).getResponse()).toMatchObject({
          code: 'rates.unavailable',
          stale: true,
        });
      }
    });

    it('only includes GOLD_24K, GOLD_22K, SILVER_999 in response', async () => {
      const result = await controller.getPublicRates();
      expect(result).toHaveProperty('GOLD_24K');
      expect(result).toHaveProperty('GOLD_22K');
      expect(result).toHaveProperty('SILVER_999');
      expect(result).not.toHaveProperty('GOLD_18K');
      expect(result).not.toHaveProperty('GOLD_14K');
      expect(result).not.toHaveProperty('SILVER_925');
    });
  });

  // -------------------------------------------------------------------------
  // HTTP integration — Cache-Control header + public access
  // -------------------------------------------------------------------------

  describe('GET /api/v1/catalog/rates — HTTP', () => {
    it('returns 200 without an auth header (public route)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/rates')
        .expect(200);
    });

    it('returns Cache-Control: public, max-age=60 header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/rates');

      expect(res.headers['cache-control']).toBe('public, max-age=60');
    });

    it('returns 503 JSON when rates are unavailable', async () => {
      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());

      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/rates')
        .expect(503);

      expect(res.body).toMatchObject({ code: 'rates.unavailable', stale: true });
    });
  });
});
