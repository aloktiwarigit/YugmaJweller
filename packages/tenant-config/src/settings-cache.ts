import type { Redis } from '@goldsmith/cache';
import type { ShopProfileRow } from '@goldsmith/shared';
import { ShopProfileRowSchema } from '@goldsmith/shared';
import { tenantContext } from '@goldsmith/tenant-context';

/**
 * Redis-backed cache for shop profile data.
 *
 * Contract:
 * - `getProfile`: swallows Redis errors + JSON parse errors as cache misses (deletes corrupt key).
 * - `setProfile` / `invalidate`: Redis errors propagate to the caller.
 */
export class SettingsCache {
  /** Profile TTL: 60 s — within the ≤30-s write-propagation p95 target when invalidation fires on save. */
  private static readonly DEFAULT_TTL_SEC = 60;

  constructor(
    private readonly redis: Redis,
    private readonly ttlSec = SettingsCache.DEFAULT_TTL_SEC,
  ) {}

  async getProfile(): Promise<ShopProfileRow | null> {
    const key = this.profileKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = ShopProfileRowSchema.safeParse(parsed);
      if (!result.success) {
        await this.redis.del(key);
        return null;
      }
      return result.data;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore del failure */ }
      return null;
    }
  }

  async setProfile(data: ShopProfileRow): Promise<void> {
    await this.redis.set(this.profileKey(), JSON.stringify(data), 'EX', this.ttlSec);
  }

  async invalidate(): Promise<void> {
    await this.redis.del(this.profileKey());
  }

  private profileKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:profile`;
  }
}
