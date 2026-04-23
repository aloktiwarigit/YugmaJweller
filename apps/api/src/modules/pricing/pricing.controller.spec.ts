/**
 * Story 4.1 WS-C — PricingController unit tests (RED phase)
 * Run: pnpm --filter @goldsmith/api test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { RatesUnavailableError } from '@goldsmith/rates';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-23T10:00:00.000Z');

const fakeRatesResult = {
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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPricingService = {
  getCurrentRates: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PricingController', () => {
  let controller: PricingController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [
        { provide: PricingService, useValue: mockPricingService },
      ],
    }).compile();

    controller = module.get<PricingController>(PricingController);
  });

  describe('GET /api/v1/rates/current', () => {
    it('returns 200 with rate data (paise as strings, source, stale)', async () => {
      (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRatesResult);

      const result = await controller.getCurrent();

      // perGramPaise must be serialized as strings (bigint cannot be JSON-serialized as number)
      expect(result.GOLD_24K.perGramPaise).toBe('735000');
      expect(result.GOLD_24K.perGramRupees).toBe('7350.00');
      expect(result.GOLD_24K.fetchedAt).toBe(NOW.toISOString());
      expect(result.stale).toBe(false);
      expect(result.source).toBe('ibja');
    });

    it('returns 503 when PricingService.getCurrentRates throws RatesUnavailableError', async () => {
      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());

      await expect(controller.getCurrent()).rejects.toBeInstanceOf(HttpException);

      try {
        await controller.getCurrent();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(503);
      }
    });

    it('is a public endpoint — controller metadata has SkipAuth', () => {
      // Verify that the controller or handler has the SKIP_AUTH metadata set
      // This is a compile-time / metadata check to ensure the endpoint is public
      // We check the class has no guard that would require authentication
      // The SkipAuth decorator sets 'skip-auth' metadata on the handler
      const metadata = Reflect.getMetadata('skip-auth', controller.getCurrent);
      expect(metadata).toBe(true);
    });
  });
});
