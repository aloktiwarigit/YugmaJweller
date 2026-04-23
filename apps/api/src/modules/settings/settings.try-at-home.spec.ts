import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { tenantContext } from '@goldsmith/tenant-context';

const SHOP_ID = 'shop-uuid-1';

const repoMock = {
  getTryAtHome: vi.fn(),
  updateTryAtHome: vi.fn(),
  getShopProfile: vi.fn(), updateShopProfile: vi.fn(),
  getMakingCharges: vi.fn(), upsertMakingCharges: vi.fn(),
  getWastage: vi.fn(), upsertWastage: vi.fn(),
  getRateLockDays: vi.fn(), updateRateLockDays: vi.fn(),
  getLoyalty: vi.fn(), upsertLoyalty: vi.fn(),
};

const cacheMock = {
  getProfile: vi.fn().mockResolvedValue(null),   setProfile: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn().mockResolvedValue(undefined),
  getMakingCharges: vi.fn().mockResolvedValue(null), setMakingCharges: vi.fn().mockResolvedValue(undefined),
  invalidateMakingCharges: vi.fn().mockResolvedValue(undefined),
  getWastage: vi.fn().mockResolvedValue(null),   setWastage: vi.fn().mockResolvedValue(undefined),
  invalidateWastage: vi.fn().mockResolvedValue(undefined),
  getRateLock: vi.fn().mockResolvedValue(null),  setRateLock: vi.fn().mockResolvedValue(undefined),
  invalidateRateLock: vi.fn().mockResolvedValue(undefined),
  getLoyalty: vi.fn().mockResolvedValue(null),   setLoyalty: vi.fn().mockResolvedValue(undefined),
  invalidateLoyalty: vi.fn().mockResolvedValue(undefined),
};

const flagsCacheMock = {
  getFlags: vi.fn(),
  setFlags: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn().mockResolvedValue(undefined),
};

const tenantLookupMock = { invalidate: vi.fn() };
const poolMock = { connect: vi.fn() } as unknown as import('pg').Pool;

function makeService(): SettingsService {
  return new SettingsService(
    repoMock as never,
    cacheMock as never,
    flagsCacheMock as never,
    tenantLookupMock as never,
    poolMock,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue({
    shopId: SHOP_ID, userId: 'owner-1', role: 'shop_admin', authenticated: true,
  } as never);
  vi.spyOn(tenantContext, 'current').mockReturnValue(undefined); // suppress audit in unit tests
  repoMock.getTryAtHome.mockResolvedValue({ enabled: false, maxPieces: null });
  repoMock.updateTryAtHome.mockResolvedValue({
    before: { tryAtHomeEnabled: false, tryAtHomeMaxPieces: 3 },
    after:  { tryAtHomeEnabled: false, tryAtHomeMaxPieces: 3 },
  });
  flagsCacheMock.getFlags.mockResolvedValue(null);
});

describe('SettingsService.updateTryAtHome', () => {
  it('saves enabled=true and returns updated row', async () => {
    repoMock.getTryAtHome.mockResolvedValue({ enabled: false, maxPieces: 3 });
    repoMock.updateTryAtHome.mockResolvedValue({
      before: { tryAtHomeEnabled: false, tryAtHomeMaxPieces: 3 },
      after:  { tryAtHomeEnabled: true,  tryAtHomeMaxPieces: 3 },
    });

    const svc = makeService();
    const result = await svc.updateTryAtHome({ tryAtHomeEnabled: true });

    expect(repoMock.updateTryAtHome).toHaveBeenCalledWith(true, 3);
    expect(result).toEqual({ tryAtHomeEnabled: true, tryAtHomeMaxPieces: 3 });
  });

  it('ignores maxPieces when tryAtHomeEnabled=false', async () => {
    repoMock.getTryAtHome.mockResolvedValue({ enabled: true, maxPieces: 5 });
    repoMock.updateTryAtHome.mockResolvedValue({
      before: { tryAtHomeEnabled: true,  tryAtHomeMaxPieces: 5 },
      after:  { tryAtHomeEnabled: false, tryAtHomeMaxPieces: 5 },
    });

    const svc = makeService();
    await svc.updateTryAtHome({ tryAtHomeEnabled: false, tryAtHomeMaxPieces: 9 });

    expect(repoMock.updateTryAtHome).toHaveBeenCalledWith(false, 5);
  });

  it('throws 422 when tryAtHomeMaxPieces=11', async () => {
    const svc = makeService();
    await expect(svc.updateTryAtHome({ tryAtHomeMaxPieces: 11 }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repoMock.updateTryAtHome).not.toHaveBeenCalled();
  });

  it('throws 422 when tryAtHomeMaxPieces=0', async () => {
    const svc = makeService();
    await expect(svc.updateTryAtHome({ tryAtHomeMaxPieces: 0 }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('invalidates feature-flags cache with correct shopId', async () => {
    repoMock.getTryAtHome.mockResolvedValue({ enabled: false, maxPieces: 3 });
    repoMock.updateTryAtHome.mockResolvedValue({
      before: { tryAtHomeEnabled: false, tryAtHomeMaxPieces: 3 },
      after:  { tryAtHomeEnabled: true,  tryAtHomeMaxPieces: 3 },
    });

    const svc = makeService();
    await svc.updateTryAtHome({ tryAtHomeEnabled: true });

    expect(flagsCacheMock.invalidate).toHaveBeenCalledWith(SHOP_ID);
    expect(flagsCacheMock.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsService.getFeatureFlags', () => {
  it('returns cached flags on hit without DB call', async () => {
    flagsCacheMock.getFlags.mockResolvedValue({ try_at_home: true, max_pieces: 5 });

    const svc = makeService();
    const flags = await svc.getFeatureFlags();

    expect(flags).toEqual({ try_at_home: true, max_pieces: 5 });
    expect(repoMock.getTryAtHome).not.toHaveBeenCalled();
  });

  it('reads from DB and populates cache on miss', async () => {
    flagsCacheMock.getFlags.mockResolvedValue(null);
    repoMock.getTryAtHome.mockResolvedValue({ enabled: true, maxPieces: 4 });

    const svc = makeService();
    const flags = await svc.getFeatureFlags();

    expect(flags).toEqual({ try_at_home: true, max_pieces: 4 });
    expect(flagsCacheMock.setFlags).toHaveBeenCalledWith(SHOP_ID, { try_at_home: true, max_pieces: 4 });
  });

  it('uses TRY_AT_HOME_DEFAULT_MAX_PIECES=3 when DB maxPieces is null', async () => {
    flagsCacheMock.getFlags.mockResolvedValue(null);
    repoMock.getTryAtHome.mockResolvedValue({ enabled: false, maxPieces: null });

    const svc = makeService();
    const flags = await svc.getFeatureFlags();

    expect(flags.max_pieces).toBe(3);
  });
});

describe('tenant isolation', () => {
  it('uses shopId from tenantContext — not a hardcoded value', async () => {
    const SHOP_A = 'aaaaaaaa-0000-0000-0000-000000000001';
    vi.spyOn(tenantContext, 'requireCurrent').mockReturnValue({
      shopId: SHOP_A, userId: 'user-a', role: 'shop_admin', authenticated: true,
    } as never);
    repoMock.getTryAtHome.mockResolvedValue({ enabled: false, maxPieces: 3 });
    repoMock.updateTryAtHome.mockResolvedValue({
      before: { tryAtHomeEnabled: false, tryAtHomeMaxPieces: 3 },
      after:  { tryAtHomeEnabled: true,  tryAtHomeMaxPieces: 3 },
    });

    const svc = makeService();
    await svc.updateTryAtHome({ tryAtHomeEnabled: true });

    expect(flagsCacheMock.invalidate).toHaveBeenCalledWith(SHOP_A);
  });
});
