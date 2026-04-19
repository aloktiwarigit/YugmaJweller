import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsCache } from '../src/settings-cache';
import type { ShopProfileRow } from '@goldsmith/shared';

const SHOP_A = '11111111-1111-1111-1111-111111111111';

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const profile: ShopProfileRow = {
  name: 'Rajesh Jewellers',
  address: null,
  gstin: null,
  bis_registration: null,
  contact_phone: null,
  operating_hours: null,
  about_text: null,
  logo_url: null,
  years_in_business: null,
  updated_at: '2026-04-19T00:00:00.000Z',
};

describe('SettingsCache', () => {
  let cache: SettingsCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new SettingsCache(mockRedis as never, 60);
  });

  it('returns null on cache miss', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const result = await cache.getProfile(SHOP_A);
    expect(result).toBeNull();
    expect(mockRedis.get).toHaveBeenCalledWith(`shop:${SHOP_A}:settings:profile`);
  });

  it('returns parsed value on cache hit', async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(profile));
    const result = await cache.getProfile(SHOP_A);
    expect(result).toEqual(profile);
  });

  it('sets value with correct key and TTL', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');
    await cache.setProfile(SHOP_A, profile);
    expect(mockRedis.set).toHaveBeenCalledWith(
      `shop:${SHOP_A}:settings:profile`,
      JSON.stringify(profile),
      'EX',
      60,
    );
  });

  it('deletes the key on invalidate', async () => {
    mockRedis.del.mockResolvedValueOnce(1);
    await cache.invalidate(SHOP_A);
    expect(mockRedis.del).toHaveBeenCalledWith(`shop:${SHOP_A}:settings:profile`);
  });

  it('returns null and deletes key on malformed JSON in cache', async () => {
    mockRedis.get.mockResolvedValueOnce('NOT_VALID_JSON');
    mockRedis.del.mockResolvedValueOnce(1);
    const result = await cache.getProfile(SHOP_A);
    expect(result).toBeNull();
    expect(mockRedis.del).toHaveBeenCalledWith(`shop:${SHOP_A}:settings:profile`);
  });

  it('returns null and deletes key when cached shape fails Zod validation', async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ name: null, updated_at: '2026-04-19T00:00:00.000Z' }));
    mockRedis.del.mockResolvedValueOnce(1);
    const result = await cache.getProfile(SHOP_A);
    expect(result).toBeNull();
    expect(mockRedis.del).toHaveBeenCalledWith(`shop:${SHOP_A}:settings:profile`);
  });

  it('propagates Redis error from getProfile as null (absorbed)', async () => {
    mockRedis.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mockRedis.del.mockResolvedValueOnce(1);
    const result = await cache.getProfile(SHOP_A);
    expect(result).toBeNull();
  });
});
