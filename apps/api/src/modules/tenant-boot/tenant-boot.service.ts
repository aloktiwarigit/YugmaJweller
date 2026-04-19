import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { platformAuditLog, AuditAction } from '@goldsmith/audit';

export interface BootResponse { id: string; display_name: string; config: Record<string, unknown>; etag: string; }

export interface BootRequestCtx { ip?: string; userAgent?: string; requestId?: string; }

@Injectable()
export class TenantBootService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async bootBySlug(slug: string, requestCtx?: BootRequestCtx): Promise<BootResponse> {
    const c = await this.pool.connect();
    let result: BootResponse;
    try {
      await c.query('SET ROLE app_user');
      const r = await c.query<{ id: string; display_name: string; config: Record<string, unknown> }>(
        `SELECT * FROM tenant_boot_lookup($1)`, [slug],
      );
      if (r.rows.length === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      const row = r.rows[0];
      const hash = createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 16);
      const etag = `"${hash}"`;
      result = { ...row, etag };
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }

    // Fire-and-forget audit (spec requires TENANT_BOOT on every successful lookup)
    void platformAuditLog(this.pool, {
      action: AuditAction.TENANT_BOOT,
      metadata: { slug },
      ipAddress: requestCtx?.ip,
      userAgent: requestCtx?.userAgent,
      requestId: requestCtx?.requestId,
    }).catch(() => undefined);

    return result;
  }
}
