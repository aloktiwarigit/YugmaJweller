import type Redis from 'ioredis';
import type { ShopProfileRow } from '@goldsmith/shared';

export class SettingsCache {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSec = 60,
  ) {}

  async getProfile(shopId: string): Promise<ShopProfileRow | null> {
    const raw = await this.redis.get(this.profileKey(shopId));
    if (!raw) return null;
    return JSON.parse(raw) as ShopProfileRow;
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
