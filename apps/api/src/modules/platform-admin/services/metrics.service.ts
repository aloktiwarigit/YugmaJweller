import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

export interface PlatformMetrics {
  totalShops: number;
  activeShops: number;
  invoicesLast30Days: number;
}

@Injectable()
export class MetricsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getMetrics(): Promise<PlatformMetrics> {
    const c = await this.pool.connect();
    try {
      // PLATFORM_ADMIN_BYPASS: intentional cross-tenant read; safe because this endpoint
      // requires platform_admin role (enforced by RolesGuard on the controller) and returns
      // only aggregate counts, no PII. invoices is RLS-enabled, so we run as platform_admin
      // (BYPASSRLS) for the duration of this transaction only.
      // SET LOCAL ROLE is transaction-scoped; BEGIN/COMMIT keeps the role active for the SELECT.
      await c.query('BEGIN');
      try {
        await c.query('SET LOCAL ROLE platform_admin');
        const r = await c.query<{
          total_shops: string;
          active_shops: string;
          invoices_30d: string;
        }>(
          `SELECT
             (SELECT COUNT(*)::text FROM shops)                                            AS total_shops,
             (SELECT COUNT(*)::text FROM shops WHERE status = 'ACTIVE')                    AS active_shops,
             (SELECT COUNT(*)::text FROM invoices WHERE created_at > now() - interval '30 days') AS invoices_30d`,
        );
        await c.query('COMMIT');
        const row = r.rows[0]!;
        return {
          totalShops: Number(row.total_shops),
          activeShops: Number(row.active_shops),
          invoicesLast30Days: Number(row.invoices_30d),
        };
      } catch (e) {
        await c.query('ROLLBACK').catch(() => undefined);
        throw e;
      }
    } finally {
      c.release();
    }
  }
}
