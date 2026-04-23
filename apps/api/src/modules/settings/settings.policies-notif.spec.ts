import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { tenantContext } from '@goldsmith/tenant-context';
import { NOTIFICATION_PREFS_DEFAULTS } from '@goldsmith/shared';
import type { NotificationPrefsConfig } from '@goldsmith/shared';

const SHOP_ID = 'shop-uuid-2789';

const repoMock = {
  getCustomOrderPolicy: vi.fn(),
  updateCustomOrderPolicy: vi.fn(),
  getReturnPolicy: vi.fn(),
  updateReturnPolicy: vi.fn(),
  getNotificationPrefs: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  getShopProfile: vi.fn(), updateShopProfile: vi.fn(),
  getMakingCharges: vi.fn(), upsertMakingCharges: vi.fn(),
  getWastage: vi.fn(), upsertWastage: vi.fn(),
  getRateLockDays: vi.fn(), updateRateLockDays: vi.fn(),
  getLoyalty: vi.fn(), upsertLoyalty: vi.fn(),
  getTryAtHome: vi.fn(), updateTryAtHome: vi.fn(),
};

const cacheMock = {
  getProfile: vi.fn().mockResolvedValue(null),   setProfile: vi.fn(),   invalidate: vi.fn(),
  getMakingCharges: vi.fn().mockResolvedValue(null), setMakingCharges: vi.fn(), invalidateMakingCharges: vi.fn(),
  getWastage: vi.fn().mockResolvedValue(null),   setWastage: vi.fn(),   invalidateWastage: vi.fn(),
  getRateLock: vi.fn().mockResolvedValue(null),  setRateLock: vi.fn(),  invalidateRateLock: vi.fn(),
  getLoyalty: vi.fn().mockResolvedValue(null),   setLoyalty: vi.fn(),   invalidateLoyalty: vi.fn(),
  getCustomOrderPolicy:  vi.fn(), setCustomOrderPolicy:  vi.fn(), invalidateCustomOrderPolicy:  vi.fn(),
  getReturnPolicy:       vi.fn(), setReturnPolicy:       vi.fn(), invalidateReturnPolicy:       vi.fn(),
  getNotificationPrefs:  vi.fn(), setNotificationPrefs:  vi.fn(), invalidateNotificationPrefs:  vi.fn(),
};

const flagsCacheMock = {
  getFlags: vi.fn().mockResolvedValue(null),
  setFlags: vi.fn(),
  invalidate: vi.fn(),
};

const poolMock = { connect: vi.fn() } as unknown as import('pg').Pool;

function makeService(): SettingsService {
  return new SettingsService(
    repoMock as never,
    cacheMock as never,
    flagsCacheMock as never,
    { invalidate: vi.fn() } as never,
    poolMock,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue({
    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
  } as never);
  vi.spyOn(tenantContext, 'current').mockReturnValue(undefined);
  cacheMock.getCustomOrderPolicy.mockResolvedValue(undefined);
  cacheMock.setCustomOrderPolicy.mockResolvedValue(undefined);
  cacheMock.invalidateCustomOrderPolicy.mockResolvedValue(undefined);
  cacheMock.getReturnPolicy.mockResolvedValue(undefined);
  cacheMock.setReturnPolicy.mockResolvedValue(undefined);
  cacheMock.invalidateReturnPolicy.mockResolvedValue(undefined);
  cacheMock.getNotificationPrefs.mockResolvedValue(undefined);
  cacheMock.setNotificationPrefs.mockResolvedValue(undefined);
  cacheMock.invalidateNotificationPrefs.mockResolvedValue(undefined);
});

// ─── 2.7 Custom Order Policy ────────────────────────────────────────────────

describe('SettingsService.getCustomOrderPolicy', () => {
  it('returns cached value on hit (no DB call)', async () => {
    cacheMock.getCustomOrderPolicy.mockResolvedValueOnce('Cached policy');
    const svc = makeService();
    const result = await svc.getCustomOrderPolicy();
    expect(result).toBe('Cached policy');
    expect(repoMock.getCustomOrderPolicy).not.toHaveBeenCalled();
  });

  it('loads from DB on cache miss and populates cache', async () => {
    cacheMock.getCustomOrderPolicy.mockResolvedValueOnce(undefined);
    repoMock.getCustomOrderPolicy.mockResolvedValueOnce('DB policy');
    const svc = makeService();
    const result = await svc.getCustomOrderPolicy();
    expect(result).toBe('DB policy');
    expect(cacheMock.setCustomOrderPolicy).toHaveBeenCalledWith('DB policy');
  });

  it('returns null when DB has no stored policy', async () => {
    cacheMock.getCustomOrderPolicy.mockResolvedValueOnce(undefined);
    repoMock.getCustomOrderPolicy.mockResolvedValueOnce(null);
    const svc = makeService();
    expect(await svc.getCustomOrderPolicy()).toBeNull();
  });
});

describe('SettingsService.updateCustomOrderPolicy', () => {
  it('calls repo with text, invalidates cache, returns after value', async () => {
    repoMock.updateCustomOrderPolicy.mockResolvedValueOnce({ before: null, after: 'New policy' });
    const svc = makeService();
    const result = await svc.updateCustomOrderPolicy({ customOrderPolicyText: 'New policy' });
    expect(repoMock.updateCustomOrderPolicy).toHaveBeenCalledWith('New policy');
    expect(cacheMock.invalidateCustomOrderPolicy).toHaveBeenCalled();
    expect(result).toBe('New policy');
  });

  it('throws 422 when text exceeds 2000 chars', async () => {
    const svc = makeService();
    await expect(
      svc.updateCustomOrderPolicy({ customOrderPolicyText: 'x'.repeat(2001) }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repoMock.updateCustomOrderPolicy).not.toHaveBeenCalled();
  });

  it('accepts empty string (clears policy)', async () => {
    repoMock.updateCustomOrderPolicy.mockResolvedValueOnce({ before: 'Old', after: null });
    const svc = makeService();
    const result = await svc.updateCustomOrderPolicy({ customOrderPolicyText: '' });
    expect(repoMock.updateCustomOrderPolicy).toHaveBeenCalledWith('');
    expect(result).toBeNull();
  });
});

// ─── 2.8 Return Policy ──────────────────────────────────────────────────────

describe('SettingsService.updateReturnPolicy', () => {
  it('calls repo with text, invalidates cache, returns after value', async () => {
    repoMock.updateReturnPolicy.mockResolvedValueOnce({ before: null, after: 'Return policy text' });
    const svc = makeService();
    const result = await svc.updateReturnPolicy({ returnPolicyText: 'Return policy text' });
    expect(repoMock.updateReturnPolicy).toHaveBeenCalledWith('Return policy text');
    expect(cacheMock.invalidateReturnPolicy).toHaveBeenCalled();
    expect(result).toBe('Return policy text');
  });

  it('throws 422 when text exceeds 2000 chars', async () => {
    const svc = makeService();
    await expect(
      svc.updateReturnPolicy({ returnPolicyText: 'y'.repeat(2001) }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repoMock.updateReturnPolicy).not.toHaveBeenCalled();
  });
});

// ─── 2.9 Notification Prefs ─────────────────────────────────────────────────

describe('SettingsService.getNotificationPrefs', () => {
  it('returns NOTIFICATION_PREFS_DEFAULTS when DB row is null', async () => {
    repoMock.getNotificationPrefs.mockResolvedValueOnce(null);
    const svc = makeService();
    expect(await svc.getNotificationPrefs()).toEqual(NOTIFICATION_PREFS_DEFAULTS);
  });

  it('returns cached value on hit (no DB call)', async () => {
    const cached: NotificationPrefsConfig = { ...NOTIFICATION_PREFS_DEFAULTS, rateAlerts: { push: false, sms: false } };
    cacheMock.getNotificationPrefs.mockResolvedValueOnce(cached);
    const svc = makeService();
    expect(await svc.getNotificationPrefs()).toEqual(cached);
    expect(repoMock.getNotificationPrefs).not.toHaveBeenCalled();
  });
});

describe('SettingsService.updateNotificationPrefs — passes patch to repo', () => {
  // The service now delegates the merge to the repo (inside a FOR UPDATE transaction)
  // to prevent lost-update races on concurrent partial PATCHes.
  // These tests verify that:
  //   1. The service passes the raw validated patch to repo.updateNotificationPrefs.
  //   2. The cache is invalidated after a successful update.
  //   3. The service returns whatever the repo returns as `after`.

  const mergedResult: NotificationPrefsConfig = {
    ...NOTIFICATION_PREFS_DEFAULTS,
    rateAlerts: { push: false, sms: false },
  };

  beforeEach(() => {
    repoMock.updateNotificationPrefs.mockResolvedValue({
      before: NOTIFICATION_PREFS_DEFAULTS,
      after: mergedResult,
    });
  });

  it('partial key patch does not overwrite untouched keys', async () => {
    const svc = makeService();
    const patch = { rateAlerts: { push: false, sms: false } };
    const result = await svc.updateNotificationPrefs(patch);
    // Service passes the raw patch — merge happens in the repo transaction.
    expect(repoMock.updateNotificationPrefs).toHaveBeenCalledWith(patch);
    expect(cacheMock.invalidateNotificationPrefs).toHaveBeenCalled();
    // Returns what repo returned as `after`.
    expect(result).toEqual(mergedResult);
  });

  it('partial channel patch is forwarded to repo', async () => {
    const svc = makeService();
    const patch = { orderUpdates: { push: false } };
    await svc.updateNotificationPrefs(patch);
    expect(repoMock.updateNotificationPrefs).toHaveBeenCalledWith(patch);
  });

  it('empty patch object is forwarded to repo', async () => {
    repoMock.updateNotificationPrefs.mockResolvedValue({
      before: NOTIFICATION_PREFS_DEFAULTS,
      after: NOTIFICATION_PREFS_DEFAULTS,
    });
    const svc = makeService();
    await svc.updateNotificationPrefs({});
    expect(repoMock.updateNotificationPrefs).toHaveBeenCalledWith({});
  });
});
