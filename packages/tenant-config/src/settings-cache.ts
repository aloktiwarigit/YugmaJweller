import type { Redis } from '@goldsmith/cache';
import type { LoyaltyConfig, ShopProfileRow, MakingChargeConfig, WastageConfig } from '@goldsmith/shared';
import { LoyaltyConfigSchema, ShopProfileRowSchema, MakingChargesArraySchema, WastageArraySchema } from '@goldsmith/shared';
import { tenantContext } from '@goldsmith/tenant-context';

/**
 * Redis-backed cache for shop settings.
 *
 * Contract:
 * - get* methods: swallow Redis errors + JSON parse errors as cache misses (delete corrupt key).
 * - set* / invalidate* methods: Redis errors propagate to the caller.
 */
export class SettingsCache {
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

  async getMakingCharges(): Promise<MakingChargeConfig[] | null> {
    const key = this.makingChargesKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = MakingChargesArraySchema.safeParse(parsed);
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

  async setMakingCharges(data: MakingChargeConfig[]): Promise<void> {
    await this.redis.set(this.makingChargesKey(), JSON.stringify(data), 'EX', this.ttlSec);
  }

  async invalidateMakingCharges(): Promise<void> {
    await this.redis.del(this.makingChargesKey());
  }

  async getWastage(): Promise<WastageConfig[] | null> {
    const key = this.wastageKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = WastageArraySchema.safeParse(parsed);
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

  async setWastage(data: WastageConfig[]): Promise<void> {
    await this.redis.set(this.wastageKey(), JSON.stringify(data), 'EX', this.ttlSec);
  }

  async invalidateWastage(): Promise<void> {
    await this.redis.del(this.wastageKey());
  }

  async getLoyalty(): Promise<LoyaltyConfig | null> {
    const key = this.loyaltyKey();
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = LoyaltyConfigSchema.safeParse(parsed);
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

  async setLoyalty(config: LoyaltyConfig): Promise<void> {
    await this.redis.set(this.loyaltyKey(), JSON.stringify(config), 'EX', this.ttlSec);
  }

  async invalidateLoyalty(): Promise<void> {
    await this.redis.del(this.loyaltyKey());
  }

  private profileKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:profile`;
  }

  private makingChargesKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:making_charges`;
  }

  private wastageKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:wastage`;
  }

  private loyaltyKey(): string {
    return `shop:${tenantContext.requireCurrent().shopId}:settings:loyalty`;
  }
}
