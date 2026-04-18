import type Redis from 'ioredis';
import { tenantContext } from '@goldsmith/tenant-context';

export class TenantScopedCache {
  constructor(private readonly redis: Redis) {}

  private key(k: string): string {
    return `t:${tenantContext.requireCurrent().shopId}:${k}`;
  }

  async get(k: string): Promise<string | null> { return this.redis.get(this.key(k)); }

  async set(k: string, v: string, ttlSec?: number): Promise<void> {
    if (ttlSec) await this.redis.set(this.key(k), v, 'EX', ttlSec);
    else await this.redis.set(this.key(k), v);
  }

  async del(k: string): Promise<void> { await this.redis.del(this.key(k)); }

  async flushTenant(shopId: string): Promise<void> {
    const prefix = `t:${shopId}:`;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
      if (keys.length > 0) await this.redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  }
}
