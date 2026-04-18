import type Redis from 'ioredis';
import type { Tenant } from './context';

export interface TenantLookup {
  byId(shopId: string): Promise<Tenant | undefined>;
}

export class TenantCache implements TenantLookup {
  constructor(
    private readonly redis: Redis,
    private readonly loader: (shopId: string) => Promise<Tenant | undefined>,
    private readonly ttlSec = 60,
  ) {}

  async byId(shopId: string): Promise<Tenant | undefined> {
    const key = `tenant:${shopId}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as Tenant;
    const t = await this.loader(shopId);
    if (t) await this.redis.set(key, JSON.stringify(t), 'EX', this.ttlSec);
    return t;
  }

  async invalidate(shopId: string): Promise<void> {
    await this.redis.del(`tenant:${shopId}`);
  }
}
