import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Tenant, TenantLookup } from '@goldsmith/tenant-context';

const TTL_MS = 60_000;

@Injectable()
export class DrizzleTenantLookup implements TenantLookup {
  private cache = new Map<string, { t: Tenant; exp: number }>();

  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async byId(id: string): Promise<Tenant | undefined> {
    const hit = this.cache.get(id);
    if (hit && hit.exp > Date.now()) return hit.t;
    const c = await this.pool.connect();
    try {
      const r = await c.query(
        `SELECT id, slug, display_name, status, config FROM shops WHERE id = $1`, [id],
      );
      if (r.rows.length === 0) return undefined;
      const t = r.rows[0] as Tenant;
      this.cache.set(id, { t, exp: Date.now() + TTL_MS });
      return t;
    } finally { c.release(); }
  }

  invalidate(id: string): void { this.cache.delete(id); }
}
