/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import type { LoyaltyService } from './loyalty.service';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';

function authCtx(role = 'shop_admin'): any {
  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
}

function unauthCtx(): any {
  return { authenticated: false as const };
}

function fakeSvc(overrides: Partial<LoyaltyService> = {}): LoyaltyService {
  return {
    getLoyaltyState:       vi.fn(async () => ({ pointsBalance: 100, lifetimePoints: 200, currentTier: null, tierSince: null })),
    getRecentTransactions: vi.fn(async () => []),
    adjustPoints:          vi.fn(async () => ({ pointsDelta: 50, newBalance: 150 })),
    ...overrides,
  } as unknown as LoyaltyService;
}

describe('LoyaltyController', () => {
  describe('getLoyaltyState', () => {
    it('returns the state for an authenticated user', async () => {
      const svc = fakeSvc();
      const ctrl = new LoyaltyController(svc);
      const result = await ctrl.getLoyaltyState(authCtx(), CUSTOMER);
      expect(result).toEqual({ pointsBalance: 100, lifetimePoints: 200, currentTier: null, tierSince: null });
    });

    it('throws 401 when not authenticated', async () => {
      const ctrl = new LoyaltyController(fakeSvc());
      await expect(ctrl.getLoyaltyState(unauthCtx(), CUSTOMER)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('propagates 404 from service when customer not found', async () => {
      const svc = fakeSvc({
        getLoyaltyState: vi.fn(async () => { throw new NotFoundException({ code: 'loyalty.customer_not_found' }); }),
      });
      const ctrl = new LoyaltyController(svc);
      await expect(ctrl.getLoyaltyState(authCtx(), CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getRecentTransactions', () => {
    it('uses limit=10 default when query missing', async () => {
      const svc = fakeSvc();
      const ctrl = new LoyaltyController(svc);
      await ctrl.getRecentTransactions(authCtx(), CUSTOMER, undefined);
      expect((svc.getRecentTransactions as any).mock.calls[0][1]).toBe(10);
    });

    it('passes through explicit limit', async () => {
      const svc = fakeSvc();
      const ctrl = new LoyaltyController(svc);
      await ctrl.getRecentTransactions(authCtx(), CUSTOMER, 5);
      expect((svc.getRecentTransactions as any).mock.calls[0][1]).toBe(5);
    });

    it('throws 401 when not authenticated', async () => {
      const ctrl = new LoyaltyController(fakeSvc());
      await expect(ctrl.getRecentTransactions(unauthCtx(), CUSTOMER, 5)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('adjustPoints', () => {
    it('positive delta succeeds for shop_admin', async () => {
      const svc = fakeSvc();
      const ctrl = new LoyaltyController(svc);
      const result = await ctrl.adjustPoints(authCtx(), CUSTOMER, { pointsDelta: 50, reason: 'goodwill bonus' });
      expect(result).toEqual({ pointsDelta: 50, newBalance: 150 });
      expect(svc.adjustPoints).toHaveBeenCalledWith(CUSTOMER, { pointsDelta: 50, reason: 'goodwill bonus' });
    });

    it('throws 401 when not authenticated', async () => {
      const ctrl = new LoyaltyController(fakeSvc());
      await expect(
        ctrl.adjustPoints(unauthCtx(), CUSTOMER, { pointsDelta: 50, reason: 'goodwill' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('propagates 422 from service when delta would go negative', async () => {
      const svc = fakeSvc({
        adjustPoints: vi.fn(async () => { throw new UnprocessableEntityException({ code: 'loyalty.would_go_negative' }); }),
      });
      const ctrl = new LoyaltyController(svc);
      await expect(
        ctrl.adjustPoints(authCtx(), CUSTOMER, { pointsDelta: -1000, reason: 'wipe' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
