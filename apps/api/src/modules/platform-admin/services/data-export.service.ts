import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL_ADMIN } from '../platform-admin.tokens';

// Pool here is PG_POOL_ADMIN, which connects directly as platform_admin.
// BEGIN/COMMIT remains for atomicity — the export queries + audit insert read consistent
// state and audit only commits when the export succeeded.
async function inTx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    try {
      const result = await fn(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
  } finally {
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
  constructor(@Inject(PG_POOL_ADMIN) private readonly pool: Pool) {}

  async exportTenant(shopId: string, platformUserId: string): Promise<TenantExport> {
    return inTx(this.pool, async (c) => {
      // PLATFORM_ADMIN_BYPASS: scoped export — every query is filtered to the requested
      // shop_id. Returning customer PII is the explicit purpose (DPDPA portability).
      //
      // Explicit column projection per table — never SELECT *. Encrypted columns
      // (customers.pan_ciphertext, customers.pan_key_id, invoices.pan_ciphertext,
      // invoices.pan_key_id) are useless to the export consumer (raw bytes without keys)
      // and infrastructure metadata (shops.kek_key_arn = Azure Key Vault KEK ARN) MUST NOT
      // appear in any browser-deliverable response. Surface only a boolean `pan_on_file`
      // so the consumer knows PAN exists without leaking the ciphertext.
      const shop = await c.query(
        `SELECT id, slug, display_name, status, config, created_at, updated_at
           FROM shops WHERE id = $1`,
        [shopId],
      );
      if (shop.rows.length === 0) throw new NotFoundException({ code: 'tenant.not_found' });

      const customers = await c.query(
        `SELECT id, shop_id, phone, name, email,
                address_line1, address_line2, city, state, pincode,
                dob_year, viewing_consent,
                (pan_ciphertext IS NOT NULL) AS pan_on_file,
                created_at, updated_at
           FROM customers WHERE shop_id = $1`,
        [shopId],
      );
      const invoices = await c.query(
        `SELECT id, shop_id, invoice_number, invoice_type,
                customer_id, customer_name, customer_phone,
                status, subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
                idempotency_key, issued_at, created_by_user_id,
                (pan_ciphertext IS NOT NULL) AS pan_on_file,
                created_at, updated_at
           FROM invoices WHERE shop_id = $1`,
        [shopId],
      );
      const payments = await c.query(
        `SELECT id, shop_id, invoice_id, method, amount_paise, status,
                recorded_at, created_by_user_id
           FROM payments WHERE shop_id = $1`,
        [shopId],
      );

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
        excluded: [
          'audit_events',
          'loyalty_ledger',
          'product_views',
          'try_at_home_bookings',
          'pan_ciphertext / pan_key_id (encrypted, replaced by pan_on_file boolean)',
          'shops.kek_key_arn (infrastructure metadata)',
        ],
      };
    });
  }
}
