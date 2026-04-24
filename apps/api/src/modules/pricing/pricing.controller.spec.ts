/**
 * Story 4.1/4.2 — PricingController unit tests
 * Run: pnpm --filter @goldsmith/api test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { RatesUnavailableError } from '@goldsmith/rates';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import type { TenantContext, AuthenticatedTenantContext, UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Mock tenant context ALS — getCurrent reads from tenantContextAls.current()
// vi.hoisted() ensures the mock is created before vi.mock() hoisting runs.
// ---------------------------------------------------------------------------
const { mockTenantContextCurrent } = vi.hoisted(() => ({
  mockTenantContextCurrent: vi.fn<[], TenantContext | undefined>().mockReturnValue(undefined),
}));

vi.mock('@goldsmith/tenant-context', async (importActual) => {
  const actual = await importActual<typeof import('@goldsmith/tenant-context')>();
  return {
    ...actual,
    tenantContext: {
      current: mockTenantContextCurrent,
      requireCurrent: vi.fn(),
      runWith: vi.fn(),
    },
  };
});

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

const fakeTenant = { id: 'shop-1', slug: 'shop', display_name: 'Shop', status: 'ACTIVE' as const };

const unauthCtx: UnauthenticatedTenantContext = {
  authenticated: false,
  shopId: 'shop-1',
  tenant: fakeTenant,
};

const authCtx: AuthenticatedTenantContext = {
  authenticated: true,
  shopId: 'shop-1',
  userId: 'user-1',
  role: 'shop_admin',
  tenant: fakeTenant,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPricingService = {
  getCurrentRates: vi.fn(),
  getCurrentRatesForTenant: vi.fn(),
  setOverride: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PricingController', () => {
  let controller: PricingController;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTenantContextCurrent.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [
        { provide: PricingService, useValue: mockPricingService },
      ],
    }).compile();

    controller = module.get<PricingController>(PricingController);
  });

  describe('GET /api/v1/rates/current', () => {
    it('returns base IBJA rates when no tenant context (public call)', async () => {
      mockTenantContextCurrent.mockReturnValue(undefined);
      (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRatesResult);

      const result = await controller.getCurrent();

      expect(mockPricingService.getCurrentRates).toHaveBeenCalled();
      expect(mockPricingService.getCurrentRatesForTenant).not.toHaveBeenCalled();
      expect(result.GOLD_24K.perGramPaise).toBe('735000');
      expect(result.GOLD_24K.perGramRupees).toBe('7350.00');
      expect(result.GOLD_24K.fetchedAt).toBe(NOW.toISOString());
      expect(result.stale).toBe(false);
      expect(result.source).toBe('ibja');
    });

    it('returns base rates for unauthenticated tenant context', async () => {
      mockTenantContextCurrent.mockReturnValue(unauthCtx);
      (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRatesResult);

      const result = await controller.getCurrent();

      expect(mockPricingService.getCurrentRates).toHaveBeenCalled();
      expect(result.GOLD_24K.perGramPaise).toBe('735000');
    });

    it('returns override-applied rates for authenticated shopkeeper', async () => {
      mockTenantContextCurrent.mockReturnValue(authCtx);
      const overriddenRates = {
        ...fakeRatesResult,
        GOLD_22K: { perGramPaise: 700000n, fetchedAt: NOW },
        overriddenPurities: ['GOLD_22K' as const],
      };
      (mockPricingService.getCurrentRatesForTenant as Mock).mockResolvedValue(overriddenRates);

      const result = await controller.getCurrent();

      expect(mockPricingService.getCurrentRatesForTenant).toHaveBeenCalledWith(authCtx);
      expect(mockPricingService.getCurrentRates).not.toHaveBeenCalled();
      expect(result.GOLD_22K.perGramPaise).toBe('700000');
      expect(result.GOLD_22K.overridden).toBe(true);
      expect(result.GOLD_24K.overridden).toBeUndefined();
      expect(result.overriddenPurities).toContain('GOLD_22K');
    });

    it('returns 503 when PricingService.getCurrentRates throws RatesUnavailableError', async () => {
      mockTenantContextCurrent.mockReturnValue(undefined);
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
      const metadata = Reflect.getMetadata('skip-auth', controller.getCurrent);
      expect(metadata).toBe(true);
    });
  });

  describe('POST /api/v1/rates/override', () => {
    const dto = { purity: 'GOLD_22K' as const, overrideRupees: '6842', reason: 'Testing' };

    it('calls pricingService.setOverride for authenticated OWNER', async () => {
      (mockPricingService.setOverride as Mock).mockResolvedValue(undefined);

      await controller.setOverride(authCtx as TenantContext, dto);

      expect(mockPricingService.setOverride).toHaveBeenCalledWith(authCtx, dto);
    });

    it('throws 401 when tenant context is unauthenticated', async () => {
      await expect(controller.setOverride(unauthCtx as TenantContext, dto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockPricingService.setOverride).not.toHaveBeenCalled();
    });
  });
});
