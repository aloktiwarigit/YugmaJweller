import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import type { SettingsRepository } from './settings.repository';
import type { SettingsCache } from '@goldsmith/tenant-config';
import type { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import type { Pool } from 'pg';
import { tenantContext, type Tenant, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { MAKING_CHARGE_DEFAULTS, WASTAGE_DEFAULTS } from '@goldsmith/shared';
import type { ShopProfileRow, MakingChargeConfig, PatchMakingChargesDto, WastageConfig, PatchWastageDto } from '@goldsmith/shared';

const SHOP_A = '11111111-1111-1111-1111-111111111111';
const tenant: Tenant = { id: SHOP_A, slug: 'a', display_name: 'Rajesh Jewellers', status: 'ACTIVE' };
const ctx: AuthenticatedTenantContext = {
  shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
};

const profileBefore: ShopProfileRow = {
  name: 'Rajesh Jewellers', address: null, gstin: null, bis_registration: null,
  contact_phone: null, operating_hours: null, about_text: null, logo_url: null,
  years_in_business: null, updated_at: '2026-04-19T00:00:00.000Z',
};
const profileAfter: ShopProfileRow = { ...profileBefore, name: 'Rajesh Jewellers & Sons' };

function makeSvc(): { svc: SettingsService; repo: SettingsRepository; cache: SettingsCache; tenantLookup: DrizzleTenantLookup } {
  const repo = {
    getShopProfile: vi.fn().mockResolvedValue(profileBefore),
    updateShopProfile: vi.fn().mockResolvedValue({ before: profileBefore, after: profileAfter }),
    getMakingCharges: vi.fn().mockResolvedValue(null),
    upsertMakingCharges: vi.fn().mockResolvedValue({ before: null, after: MAKING_CHARGE_DEFAULTS }),
    getWastage: vi.fn().mockResolvedValue(null),
    upsertWastage: vi.fn().mockResolvedValue({ before: null, after: WASTAGE_DEFAULTS }),
    getRateLockDays: vi.fn().mockResolvedValue(null),
    updateRateLockDays: vi.fn().mockResolvedValue({ before: null, after: 7 }),
  } as unknown as SettingsRepository;

  const cache = {
    getProfile: vi.fn().mockResolvedValue(null),
    setProfile: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    getMakingCharges: vi.fn().mockResolvedValue(null),
    setMakingCharges: vi.fn().mockResolvedValue(undefined),
    invalidateMakingCharges: vi.fn().mockResolvedValue(undefined),
    getWastage: vi.fn().mockResolvedValue(null),
    setWastage: vi.fn().mockResolvedValue(undefined),
    invalidateWastage: vi.fn().mockResolvedValue(undefined),
    getRateLock: vi.fn().mockResolvedValue(null),
    setRateLock: vi.fn().mockResolvedValue(undefined),
    invalidateRateLock: vi.fn().mockResolvedValue(undefined),
  } as unknown as SettingsCache;

  const tenantLookup = { invalidate: vi.fn() } as unknown as DrizzleTenantLookup;
  const pool = {} as Pool;
  const flagsCache = {
    getFlags: vi.fn().mockResolvedValue(null),
    setFlags: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  } as never;

  const svc = new SettingsService(repo, cache, flagsCache, tenantLookup, pool);
  return { svc, repo, cache, tenantLookup };
}

describe('SettingsService', () => {
  describe('getProfile', () => {
    it('returns cached value on hit', async () => {
      const { svc, repo, cache } = makeSvc();
      (cache.getProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(profileBefore);
      const result = await tenantContext.runWith(ctx, () => svc.getProfile());
      expect(result).toEqual(profileBefore);
      expect(repo.getShopProfile).not.toHaveBeenCalled();
    });

    it('loads from DB on cache miss and populates cache', async () => {
      const { svc, repo, cache } = makeSvc();
      const result = await tenantContext.runWith(ctx, () => svc.getProfile());
      expect(result).toEqual(profileBefore);
      expect(repo.getShopProfile).toHaveBeenCalledWith();
      expect(cache.setProfile).toHaveBeenCalledWith(profileBefore);
    });
  });

  describe('updateProfile', () => {
    it('calls repo, invalidates cache, returns after', async () => {
      const { svc, repo, cache } = makeSvc();
      const result = await tenantContext.runWith(ctx, () =>
        svc.updateProfile({ name: 'Rajesh Jewellers & Sons' }),
      );
      expect(repo.updateShopProfile).toHaveBeenCalledWith({ name: 'Rajesh Jewellers & Sons' });
      expect(cache.invalidate).toHaveBeenCalledWith();
      expect(result).toEqual(profileAfter);
    });

    it('invalidates DrizzleTenantLookup when name changes', async () => {
      const { svc, tenantLookup } = makeSvc();
      await tenantContext.runWith(ctx, () =>
        svc.updateProfile({ name: 'New Name' }),
      );
      expect(tenantLookup.invalidate).toHaveBeenCalledWith(SHOP_A);
    });

    it('invalidates tenantLookup even when display_name does not change', async () => {
      const { svc, repo, tenantLookup } = makeSvc();
      (repo.updateShopProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        before: profileBefore,
        after: { ...profileBefore, about_text: 'New bio' },
      });
      await tenantContext.runWith(ctx, () => svc.updateProfile({ about_text: 'New bio' }));
      expect(tenantLookup.invalidate).toHaveBeenCalledWith(SHOP_A);
    });

    it('throws BadRequestException for invalid GSTIN', async () => {
      const { svc, repo } = makeSvc();
      await expect(
        tenantContext.runWith(ctx, () => svc.updateProfile({ gstin: 'BAD' })),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateShopProfile).not.toHaveBeenCalled();
    });

    it('swallows auditLog failure and still returns result', async () => {
      const { svc } = makeSvc();
      vi.spyOn(svc as unknown as { auditProfileUpdate: () => void }, 'auditProfileUpdate').mockRejectedValueOnce(new Error('audit down'));
      const result = await tenantContext.runWith(ctx, () =>
        svc.updateProfile({ name: 'Rajesh Jewellers & Sons' }),
      );
      expect(result).toEqual(profileAfter);
    });
  });

  describe('getMakingCharges', () => {
    it('returns cached value on hit', async () => {
      const { svc, cache, repo } = makeSvc();
      const cached: MakingChargeConfig[] = [{ category: 'RINGS', type: 'percent', value: '12.00' }];
      (cache.getMakingCharges as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cached);
      const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
      expect(result).toEqual(cached);
      expect(repo.getMakingCharges).not.toHaveBeenCalled();
    });

    it('loads from DB on cache miss, injects defaults when null, populates cache', async () => {
      const { svc, repo, cache } = makeSvc();
      // repo.getMakingCharges already returns null from makeSvc
      const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
      expect(repo.getMakingCharges).toHaveBeenCalled();
      expect(result).toEqual(MAKING_CHARGE_DEFAULTS);
      expect(cache.setMakingCharges).toHaveBeenCalledWith(MAKING_CHARGE_DEFAULTS);
    });

    it('merges stored configs over defaults, filling missing categories', async () => {
      const { svc, repo, cache } = makeSvc();
      const existing: MakingChargeConfig[] = [{ category: 'RINGS', type: 'percent', value: '10.00' }];
      (repo.getMakingCharges as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);
      const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
      const expected = MAKING_CHARGE_DEFAULTS.map((d) =>
        d.category === 'RINGS' ? { ...d, value: '10.00' } : d,
      );
      expect(result).toEqual(expected);
      expect(result).toHaveLength(MAKING_CHARGE_DEFAULTS.length);
      expect(cache.setMakingCharges).toHaveBeenCalledWith(expected);
    });
  });

  describe('updateMakingCharges', () => {
    it('rejects scientific notation value ("1.5e2")', async () => {
      const { svc } = makeSvc();
      const dto: PatchMakingChargesDto = [{ category: 'RINGS', type: 'percent', value: '1.5e2' }];
      await expect(
        tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects negative value', async () => {
      const { svc } = makeSvc();
      const dto: PatchMakingChargesDto = [{ category: 'RINGS', type: 'percent', value: '-1' }];
      await expect(
        tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects percent > 100', async () => {
      const { svc } = makeSvc();
      const dto: PatchMakingChargesDto = [{ category: 'RINGS', type: 'percent', value: '101' }];
      await expect(
        tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('invalidates making-charges cache after upsert', async () => {
      const { svc, cache } = makeSvc();
      const dto: PatchMakingChargesDto = [{ category: 'RINGS', type: 'percent', value: '14.00' }];
      await tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto));
      expect(cache.invalidateMakingCharges).toHaveBeenCalled();
    });

    it('emits SETTINGS_MAKING_CHARGES_UPDATED audit with before + after', async () => {
      const { svc } = makeSvc();
      const auditSpy = vi.spyOn(svc as unknown as { auditMakingChargesUpdate: () => void }, 'auditMakingChargesUpdate');
      const dto: PatchMakingChargesDto = [{ category: 'RINGS', type: 'percent', value: '14.00' }];
      await tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto));
      await Promise.resolve(); // flush fire-and-forget audit microtask
      expect(auditSpy).toHaveBeenCalledWith(null, MAKING_CHARGE_DEFAULTS);
    });

    it('swallows auditLog failure and still returns after', async () => {
      const { svc } = makeSvc();
      vi.spyOn(svc as unknown as { auditMakingChargesUpdate: () => void }, 'auditMakingChargesUpdate')
        .mockRejectedValueOnce(new Error('audit down'));
      const dto: PatchMakingChargesDto = [{ category: 'RINGS', type: 'percent', value: '14.00' }];
      await expect(
        tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto)),
      ).resolves.toEqual(MAKING_CHARGE_DEFAULTS);
    });

    it('passes patch items and defaults to repo.upsertMakingCharges for atomic merge', async () => {
      const { svc, repo } = makeSvc();
      const dto: PatchMakingChargesDto = [{ category: 'BRIDAL', type: 'percent', value: '20.00' }];
      await tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto));
      expect(repo.upsertMakingCharges).toHaveBeenCalledWith(dto, MAKING_CHARGE_DEFAULTS);
    });
  });

  describe('getWastage', () => {
    it('returns cached value on hit', async () => {
      const { svc, cache, repo } = makeSvc();
      const cached: WastageConfig[] = [{ category: 'BRIDAL', percent: '2.50' }];
      (cache.getWastage as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cached);
      const result = await tenantContext.runWith(ctx, () => svc.getWastage());
      expect(result).toEqual(cached);
      expect(repo.getWastage).not.toHaveBeenCalled();
    });

    it('loads from DB on cache miss, returns WASTAGE_DEFAULTS when null, populates cache', async () => {
      const { svc, repo, cache } = makeSvc();
      const result = await tenantContext.runWith(ctx, () => svc.getWastage());
      expect(repo.getWastage).toHaveBeenCalled();
      expect(result).toEqual(WASTAGE_DEFAULTS);
      expect(cache.setWastage).toHaveBeenCalledWith(WASTAGE_DEFAULTS);
    });

    it('merges stored map over defaults, filling missing categories', async () => {
      const { svc, repo } = makeSvc();
      (repo.getWastage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ BRIDAL: '2.50' });
      const result = await tenantContext.runWith(ctx, () => svc.getWastage());
      const expected = WASTAGE_DEFAULTS.map((d) =>
        d.category === 'BRIDAL' ? { ...d, percent: '2.50' } : d,
      );
      expect(result).toEqual(expected);
      expect(result).toHaveLength(WASTAGE_DEFAULTS.length);
    });
  });

  describe('updateWastage', () => {
    it('rejects scientific notation percent ("1.5e2")', async () => {
      const { svc } = makeSvc();
      const dto: PatchWastageDto = { category: 'RINGS', percent: '1.5e2' };
      await expect(
        tenantContext.runWith(ctx, () => svc.updateWastage(dto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects negative percent', async () => {
      const { svc } = makeSvc();
      const dto: PatchWastageDto = { category: 'RINGS', percent: '-1' };
      await expect(
        tenantContext.runWith(ctx, () => svc.updateWastage(dto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects percent > 30 with UnprocessableEntityException', async () => {
      const { svc } = makeSvc();
      const dto: PatchWastageDto = { category: 'RINGS', percent: '50' };
      await expect(
        tenantContext.runWith(ctx, () => svc.updateWastage(dto)),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects percent > 30: error code is settings.wastage_high', async () => {
      const { svc } = makeSvc();
      const dto: PatchWastageDto = { category: 'RINGS', percent: '31' };
      const caught = await Promise.resolve(tenantContext.runWith(ctx, () => svc.updateWastage(dto))).catch((e: unknown) => e) as { response?: { code?: string } };
      expect(caught.response?.code).toBe('settings.wastage_high');
    });

    it('accepts percent exactly 30 (boundary — not rejected)', async () => {
      const { svc } = makeSvc();
      const dto: PatchWastageDto = { category: 'RINGS', percent: '30' };
      await expect(
        tenantContext.runWith(ctx, () => svc.updateWastage(dto)),
      ).resolves.toBeDefined();
    });

    it('invalidates wastage cache (not profile or making-charges) after upsert', async () => {
      const { svc, cache } = makeSvc();
      const dto: PatchWastageDto = { category: 'BRIDAL', percent: '2.50' };
      await tenantContext.runWith(ctx, () => svc.updateWastage(dto));
      expect(cache.invalidateWastage).toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
      expect(cache.invalidateMakingCharges).not.toHaveBeenCalled();
    });

    it('emits SETTINGS_WASTAGE_UPDATED audit with before + after', async () => {
      const { svc } = makeSvc();
      const auditSpy = vi.spyOn(svc as unknown as { auditWastageUpdate: () => void }, 'auditWastageUpdate');
      const dto: PatchWastageDto = { category: 'BRIDAL', percent: '2.50' };
      await tenantContext.runWith(ctx, () => svc.updateWastage(dto));
      await Promise.resolve();
      expect(auditSpy).toHaveBeenCalledWith(null, WASTAGE_DEFAULTS);
    });

    it('swallows auditLog failure and still returns after', async () => {
      const { svc } = makeSvc();
      vi.spyOn(svc as unknown as { auditWastageUpdate: () => void }, 'auditWastageUpdate')
        .mockRejectedValueOnce(new Error('audit down'));
      const dto: PatchWastageDto = { category: 'BRIDAL', percent: '2.50' };
      await expect(
        tenantContext.runWith(ctx, () => svc.updateWastage(dto)),
      ).resolves.toEqual(WASTAGE_DEFAULTS);
    });

    it('calls repo.upsertWastage with category and percent strings', async () => {
      const { svc, repo } = makeSvc();
      const dto: PatchWastageDto = { category: 'BRIDAL', percent: '2.50' };
      await tenantContext.runWith(ctx, () => svc.updateWastage(dto));
      expect(repo.upsertWastage).toHaveBeenCalledWith('BRIDAL', '2.50');
    });
  });

  describe('rateLock', () => {
    describe('getRateLock', () => {
      it('returns cached value on hit', async () => {
        const { svc, repo, cache } = makeSvc();
        (cache.getRateLock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(14);
        const result = await tenantContext.runWith(ctx, () => svc.getRateLock());
        expect(result).toBe(14);
        expect(repo.getRateLockDays).not.toHaveBeenCalled();
      });

      it('returns default 7 when cache miss and DB null', async () => {
        const { svc, repo, cache } = makeSvc();
        (cache.getRateLock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
        (repo.getRateLockDays as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
        const result = await tenantContext.runWith(ctx, () => svc.getRateLock());
        expect(result).toBe(7);
        expect(cache.setRateLock as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(7);
      });

      it('returns DB value when cache miss and DB has 14', async () => {
        const { svc, repo, cache } = makeSvc();
        (cache.getRateLock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
        (repo.getRateLockDays as ReturnType<typeof vi.fn>).mockResolvedValueOnce(14);
        const result = await tenantContext.runWith(ctx, () => svc.getRateLock());
        expect(result).toBe(14);
        expect(cache.setRateLock as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(14);
      });
    });

    describe('updateRateLock', () => {
      it('updates DB, invalidates cache, returns after value', async () => {
        const { svc, repo, cache } = makeSvc();
        (repo.updateRateLockDays as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ before: 7, after: 14 });
        (cache.invalidateRateLock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        const result = await tenantContext.runWith(ctx, () =>
          svc.updateRateLock({ rateLockDays: 14 }),
        );
        expect(repo.updateRateLockDays).toHaveBeenCalledWith(14);
        expect(cache.invalidateRateLock).toHaveBeenCalledWith();
        expect(result).toBe(14);
      });

      it('boundary: rateLockDays = 1 succeeds', async () => {
        const { svc, repo, cache } = makeSvc();
        (repo.updateRateLockDays as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ before: null, after: 1 });
        (cache.invalidateRateLock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        const result = await tenantContext.runWith(ctx, () =>
          svc.updateRateLock({ rateLockDays: 1 }),
        );
        expect(result).toBe(1);
      });

      it('boundary: rateLockDays = 30 succeeds', async () => {
        const { svc, repo, cache } = makeSvc();
        (repo.updateRateLockDays as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ before: null, after: 30 });
        (cache.invalidateRateLock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        const result = await tenantContext.runWith(ctx, () =>
          svc.updateRateLock({ rateLockDays: 30 }),
        );
        expect(result).toBe(30);
      });

      it('throws UnprocessableEntityException for rateLockDays = 0', async () => {
        const { svc } = makeSvc();
        await expect(
          tenantContext.runWith(ctx, () => svc.updateRateLock({ rateLockDays: 0 })),
        ).rejects.toThrow(UnprocessableEntityException);
      });

      it('throws UnprocessableEntityException for rateLockDays = 31', async () => {
        const { svc } = makeSvc();
        await expect(
          tenantContext.runWith(ctx, () => svc.updateRateLock({ rateLockDays: 31 })),
        ).rejects.toThrow(UnprocessableEntityException);
      });

      it('swallows auditLog failure and still returns result', async () => {
        const { svc, repo, cache } = makeSvc();
        (repo.updateRateLockDays as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ before: 7, after: 14 });
        (cache.invalidateRateLock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        vi.spyOn(
          svc as unknown as { auditRateLockUpdate: () => void },
          'auditRateLockUpdate',
        ).mockRejectedValueOnce(new Error('audit down'));
        const result = await tenantContext.runWith(ctx, () =>
          svc.updateRateLock({ rateLockDays: 14 }),
        );
        expect(result).toBe(14);
      });
    });
  });
});
