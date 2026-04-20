import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import type { SettingsRepository } from './settings.repository';
import type { SettingsCache } from '@goldsmith/tenant-config';
import type { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import type { Pool } from 'pg';
import { tenantContext, type Tenant, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { ShopProfileRow } from '@goldsmith/shared';

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
  } as unknown as SettingsRepository;

  const cache = {
    getProfile: vi.fn().mockResolvedValue(null),
    setProfile: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
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
});
