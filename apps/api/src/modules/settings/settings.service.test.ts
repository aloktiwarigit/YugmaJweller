import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import type { SettingsRepository } from './settings.repository';
import type { SettingsCache } from '@goldsmith/tenant-config';
import type { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import type { Pool } from 'pg';
import { tenantContext, type Tenant, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';
import type { ShopProfileRow, MakingChargeConfig, PatchMakingChargesDto } from '@goldsmith/shared';

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
  } as unknown as SettingsRepository;

  const cache = {
    getProfile: vi.fn().mockResolvedValue(null),
    setProfile: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    getMakingCharges: vi.fn().mockResolvedValue(null),
    setMakingCharges: vi.fn().mockResolvedValue(undefined),
    invalidateMakingCharges: vi.fn().mockResolvedValue(undefined),
  } as unknown as SettingsCache;

  const tenantLookup = { invalidate: vi.fn() } as unknown as DrizzleTenantLookup;
  const pool = {} as Pool;

  const svc = new SettingsService(repo, cache, tenantLookup, pool);
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

    it('does NOT invalidate DrizzleTenantLookup when name unchanged', async () => {
      const { svc, repo, tenantLookup } = makeSvc();
      (repo.updateShopProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        before: profileBefore,
        after: { ...profileBefore, gstin: '09AAACR5055K1Z5' },
      });
      await tenantContext.runWith(ctx, () => svc.updateProfile({ gstin: '09AAACR5055K1Z5' }));
      expect(tenantLookup.invalidate).not.toHaveBeenCalled();
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

    it('returns DB data when DB returns existing configs (no defaults injected)', async () => {
      const { svc, repo, cache } = makeSvc();
      const existing: MakingChargeConfig[] = [{ category: 'RINGS', type: 'percent', value: '10.00' }];
      (repo.getMakingCharges as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);
      const result = await tenantContext.runWith(ctx, () => svc.getMakingCharges());
      expect(result).toEqual(existing);
      expect(cache.setMakingCharges).toHaveBeenCalledWith(existing);
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

    it('merges supplied categories with defaults — unspecified categories retain defaults', async () => {
      const { svc, repo } = makeSvc();
      // current = MAKING_CHARGE_DEFAULTS (returned from getMakingCharges which hits DB → null → defaults)
      const dto: PatchMakingChargesDto = [{ category: 'BRIDAL', type: 'percent', value: '20.00' }];
      await tenantContext.runWith(ctx, () => svc.updateMakingCharges(dto));
      const merged = MAKING_CHARGE_DEFAULTS.map((c) =>
        c.category === 'BRIDAL' ? { ...c, value: '20.00' } : c,
      );
      expect(repo.upsertMakingCharges).toHaveBeenCalledWith(merged);
    });
  });
});
