import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

async function withPlatformAdmin<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('SET LOCAL ROLE platform_admin');
    return await fn(c);
  } finally {
    await c.query('RESET ROLE').catch(() => undefined);
    c.release();
  }
}

export interface TenantExport {
  shop: Record<string, unknown>;
  customers: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  exported_at: string;
  /** Tables intentionally excluded from this scoped export. */
  excluded: string[];
}

@Injectable()
export class DataExportService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async exportTenant(shopId: string, platformUserId: string): Promise<TenantExport> {
    return withPlatformAdmin(this.pool, async (c) => {
      // PLATFORM_ADMIN_BYPASS: scoped export — every query is filtered to the requested
      // shop_id. Returning customer PII is the explicit purpose (DPDPA portability).
      const shop = await c.query(`SELECT * FROM shops WHERE id = $1`, [shopId]);
      if (shop.rows.length === 0) throw new NotFoundException({ code: 'tenant.not_found' });

      const customers = await c.query(`SELECT * FROM customers WHERE shop_id = $1`, [shopId]);
      const invoices = await c.query(`SELECT * FROM invoices WHERE shop_id = $1`, [shopId]);
      const payments = await c.query(`SELECT * FROM payments WHERE shop_id = $1`, [shopId]);

      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          'tenant.exported',
          platformUserId,
          shopId,
          JSON.stringify({
            counts: {
              customers: customers.rowCount,
              invoices: invoices.rowCount,
              payments: payments.rowCount,
            },
          }),
        ],
      );

      return {
        shop: shop.rows[0]!,
        customers: customers.rows,
        invoices: invoices.rows,
        payments: payments.rows,
        exported_at: new Date().toISOString(),
        excluded: ['audit_events', 'loyalty_ledger', 'product_views', 'try_at_home_bookings'],
      };
    });
  }
}
