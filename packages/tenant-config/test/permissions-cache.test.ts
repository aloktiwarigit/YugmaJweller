import { describe, it, expect, vi } from 'vitest';
import { PermissionsCache } from '../src/permissions-cache';
import type { Redis } from '@goldsmith/cache';

function makeRedis(overrides: Partial<Redis> = {}): Redis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as Redis;
}

describe('PermissionsCache', () => {
  describe('getPermissions', () => {
    it('returns null on cache miss', async () => {
      const cache = new PermissionsCache(makeRedis({ get: vi.fn().mockResolvedValue(null) }));
      expect(await cache.getPermissions('shop1', 'shop_manager')).toBeNull();
    });

    it('parses and returns valid JSON', async () => {
      const data = { 'billing.create': true, 'billing.void': false };
      const cache = new PermissionsCache(makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(data)) }));
      expect(await cache.getPermissions('shop1', 'shop_manager')).toEqual(data);
    });

    it('returns null and deletes corrupt key', async () => {
      const del = vi.fn().mockResolvedValue(1);
      const cache = new PermissionsCache(makeRedis({ get: vi.fn().mockResolvedValue('{bad json'), del }));
      expect(await cache.getPermissions('shop1', 'shop_manager')).toBeNull();
      expect(del).toHaveBeenCalledWith('shop:shop1:permissions:shop_manager');
    });
  });

  describe('setPermissions', () => {
    it('sets key with 60s TTL', async () => {
      const set = vi.fn().mockResolvedValue('OK');
      const cache = new PermissionsCache(makeRedis({ set }));
      await cache.setPermissions('shop1', 'shop_manager', { 'billing.create': true });
      expect(set).toHaveBeenCalledWith(
        'shop:shop1:permissions:shop_manager',
        JSON.stringify({ 'billing.create': true }),
        'EX',
        60,
      );
    });
  });

  describe('invalidate', () => {
    it('deletes the role key', async () => {
      const del = vi.fn().mockResolvedValue(1);
      const cache = new PermissionsCache(makeRedis({ del }));
      await cache.invalidate('shop1', 'shop_manager');
      expect(del).toHaveBeenCalledWith('shop:shop1:permissions:shop_manager');
    });
  });
});
