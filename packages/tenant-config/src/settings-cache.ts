import type Redis from 'ioredis';
import type { ShopProfileRow } from '@goldsmith/shared';
import { ShopProfileRowSchema } from '@goldsmith/shared';

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

  async getProfile(shopId: string): Promise<ShopProfileRow | null> {
    try {
      const raw = await this.redis.get(this.profileKey(shopId));
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = ShopProfileRowSchema.safeParse(parsed);
      if (!result.success) {
        await this.redis.del(this.profileKey(shopId));
        return null;
      }
      return result.data;
    } catch {
      try { await this.redis.del(this.profileKey(shopId)); } catch { /* ignore del failure */ }
      return null;
    }
  }

  async setProfile(shopId: string, data: ShopProfileRow): Promise<void> {
    await this.redis.set(this.profileKey(shopId), JSON.stringify(data), 'EX', this.ttlSec);
  }

  async invalidate(shopId: string): Promise<void> {
    await this.redis.del(this.profileKey(shopId));
  }

  private profileKey(shopId: string): string {
    return `shop:${shopId}:settings:profile`;
  }
}
