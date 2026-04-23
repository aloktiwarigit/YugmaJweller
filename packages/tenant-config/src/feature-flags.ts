import type { Redis } from '@goldsmith/cache';

/**
 * Redis-backed cache for per-shop feature flags.
 *
 * Contract:
 * - `getFlags`: swallows Redis errors + JSON parse errors as cache misses (deletes corrupt key).
 * - `setFlags` / `invalidate`: Redis errors propagate to the caller.
 *
 * TTL: 60 s — aligns with SettingsCache and the ≤30-s write-propagation p95 target when
 * invalidation fires on feature flag changes.
 */
export interface FeatureFlags {
  try_at_home: boolean;
  max_pieces: number;
}

export class FeatureFlagsCache {
  private static readonly TTL_SEC = 60;

  constructor(private readonly redis: Redis) {}

  async getFlags(shopId: string): Promise<FeatureFlags | null> {
    const key = this.key(shopId);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as FeatureFlags;
    } catch {
      try { await this.redis.del(key); } catch { /* ignore */ }
      return null;
    }
  }

  async setFlags(shopId: string, data: FeatureFlags): Promise<void> {
    await this.redis.set(this.key(shopId), JSON.stringify(data), 'EX', FeatureFlagsCache.TTL_SEC);
  }

  async invalidate(shopId: string): Promise<void> {
    await this.redis.del(this.key(shopId));
  }

  private key(shopId: string): string {
    return `shop:${shopId}:feature-flags`;
  }
}
