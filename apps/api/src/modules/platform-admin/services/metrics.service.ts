import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { platformGlobalExecute } from '../../../platform-global-execute';
import { PG_POOL_ADMIN } from '../platform-admin.tokens';

export interface PlatformMetrics {
  totalShops: number;
  activeShops: number;
  invoicesLast30Days: number;
}

@Injectable()
export class MetricsService {
  // PLATFORM_ADMIN_BYPASS: intentional cross-tenant read. Safe because (a) this endpoint
  // requires platform_admin role (enforced by RolesGuard on the controller) and (b) returns
  // only aggregate counts, no PII. The pool connects directly as platform_admin (BYPASSRLS),
  // so the cross-tenant SELECT goes through without RLS interference.
  constructor(@Inject(PG_POOL_ADMIN) private readonly pool: Pool) {}

  async getMetrics(): Promise<PlatformMetrics> {
    const r = await platformGlobalExecute('platform-admin aggregate metrics cross-tenant read', async () =>
      this.pool.query<{
        total_shops: string;
        active_shops: string;
        invoices_30d: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::text FROM shops)                                            AS total_shops,
           (SELECT COUNT(*)::text FROM shops WHERE status = 'ACTIVE')                    AS active_shops,
           (SELECT COUNT(*)::text FROM invoices WHERE created_at > now() - interval '30 days') AS invoices_30d`,
      ),
    );
    const row = r.rows[0]!;
    return {
      totalShops: Number(row.total_shops),
      activeShops: Number(row.active_shops),
      invoicesLast30Days: Number(row.invoices_30d),
    };
  }
}
