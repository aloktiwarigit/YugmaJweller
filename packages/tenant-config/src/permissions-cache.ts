import type { Redis } from '@goldsmith/cache';
import type { ShopUserRole } from '@goldsmith/tenant-context';

/**
 * Redis-backed cache for per-role permission maps.
 *
 * Contract:
 * - `getPermissions`: swallows Redis errors + JSON parse errors as cache misses (deletes corrupt key).
 * - `setPermissions` / `invalidate`: Redis errors propagate to the caller.
 *
 * TTL: 60 s — aligns with SettingsCache and the ≤30-s write-propagation p95 target when
 * invalidation fires on role/permission changes.
 */
export class PermissionsCache {
  private static readonly TTL_SEC = 60;

  constructor(private readonly redis: Redis) {}

  async getPermissions(shopId: string, role: ShopUserRole): Promise<Record<string, boolean> | null> {
    const key = this.key(shopId, role);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore */ }
      return null;
    }
  }

  async setPermissions(shopId: string, role: ShopUserRole, data: Record<string, boolean>): Promise<void> {
    await this.redis.set(this.key(shopId, role), JSON.stringify(data), 'EX', PermissionsCache.TTL_SEC);
  }

  async invalidate(shopId: string, role: ShopUserRole): Promise<void> {
    await this.redis.del(this.key(shopId, role));
  }

  private key(shopId: string, role: ShopUserRole): string {
    return `shop:${shopId}:permissions:${role}`;
  }
}
