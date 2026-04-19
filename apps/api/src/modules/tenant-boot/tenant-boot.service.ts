import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

export interface BootResponse { id: string; display_name: string; config: Record<string, unknown>; etag: string; }

@Injectable()
export class TenantBootService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async bootBySlug(slug: string): Promise<BootResponse> {
    const c = await this.pool.connect();
    try {
      await c.query('SET ROLE app_user');
      const r = await c.query<{ id: string; display_name: string; config: Record<string, unknown> }>(
        `SELECT * FROM tenant_boot_lookup($1)`, [slug],
      );
      if (r.rows.length === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      const row = r.rows[0];
      const hash = createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 16);
      const etag = `"${hash}"`;
      return { ...row, etag };
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }
}
