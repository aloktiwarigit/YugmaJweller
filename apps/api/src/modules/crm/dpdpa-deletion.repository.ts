import { Inject, Injectable, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface SoftDeleteOptions {
  reason?:     'no-need' | 'privacy' | 'other-jeweller' | 'other';
  reasonText?: string;
}

export interface SoftDeleteResult {
  scheduledAt:             Date;
  hardDeleteAt:            Date;
  cascadeCounts:           { wishlists: number; reviews: number; rateLocks: number; tryAtHome: number };
  rateLockRefundsPending:  number;
}

export interface DueForHardDelete {
  customerId: string;
  shopId:     string;
}

const TENANT_SQL = `current_setting('app.current_shop_id')::uuid`;

interface ChildTablePresence {
  has_notes:     boolean;
  has_occasions: boolean;
  has_balances:  boolean;
}

async function probeChildTables(tx: PoolClient): Promise<ChildTablePresence> {
  const r = await tx.query<ChildTablePresence>(`
    SELECT
      to_regclass('public.customer_notes')     IS NOT NULL AS has_notes,
      to_regclass('public.customer_occasions') IS NOT NULL AS has_occasions,
      to_regclass('public.customer_balances')  IS NOT NULL AS has_balances
  `);
  return r.rows[0];
}

@Injectable()
export class DpdpaDeletionRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Atomically soft-deletes a customer:
   *   1. SELECT FOR UPDATE — verifies the row belongs to the tenant and is not
   *      already deleted (avoids re-scrubbing or stacking schedules).
   *   2. Guards against open DRAFT invoices — these block deletion until paid or voided.
   *   3. Guards against DISPATCHED try-at-home bookings — pieces must be returned first.
   *   4. Scrubs PII columns + replaces the phone with a SHA-256(shop_id || ':' || phone)
   *      hash so the unique-phone constraint is preserved without exposing the number.
   *   5. Cascades to: wishlists (hard-delete), product_reviews (anonymise via NULL
   *      customer_id), rate_lock_bookings (CANCELLED), try_at_home_bookings (REQUESTED→CANCELLED).
   *   6. Anonymizes/deletes related rows in child tables (notes/occasions/balances/family).
   *      Child tables that ship in stories 6.3/6.5/6.6 are guarded with to_regclass
   *      so this branch can be tested in isolation; on main they all exist.
   *
   * Throws:
   *   - NotFoundException                    'crm.customer_not_found'
   *   - ConflictException                    'crm.deletion.already_requested'
   *   - UnprocessableEntityException         'crm.deletion.open_invoices'
   *   - UnprocessableEntityException         'crm.deletion.try_at_home_in_flight'
   */
  async softDeleteAtomic(
    customerId:  string,
    requestedBy: 'customer' | 'owner',
    options:     SoftDeleteOptions = {},
  ): Promise<SoftDeleteResult> {
    return withTenantTx(this.pool, async (tx) => {
      const sel = await tx.query<{ deleted_at: Date | null }>(
        `SELECT deleted_at FROM customers
         WHERE id = $1 AND shop_id = ${TENANT_SQL}
         FOR UPDATE`,
        [customerId],
      );
      if (sel.rows.length === 0) {
        throw new NotFoundException({ code: 'crm.customer_not_found', message: 'Customer not found' });
      }
      if (sel.rows[0].deleted_at !== null) {
        throw new ConflictException({
          code: 'crm.deletion.already_requested',
          message: 'Deletion already requested for this customer',
        });
      }

      const drafts = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM invoices
         WHERE customer_id = $1
           AND shop_id = ${TENANT_SQL}
           AND status = 'DRAFT'`,
        [customerId],
      );
      if (parseInt(drafts.rows[0].count, 10) > 0) {
        throw new UnprocessableEntityException({
          code: 'crm.deletion.open_invoices',
          message: 'Cannot delete customer with open DRAFT invoices — issue or void them first',
        });
      }

      // Mirror open-DRAFT-invoices guard: physical pieces dispatched to this
      // customer must be returned before deletion. Otherwise we lose the
      // shopkeeper's only link to the dispatched stock.
      const dispatched = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM try_at_home_bookings
         WHERE customer_id = $1 AND shop_id = ${TENANT_SQL} AND status = 'DISPATCHED'`,
        [customerId],
      );
      if (parseInt(dispatched.rows[0].count, 10) > 0) {
        throw new UnprocessableEntityException({
          code: 'crm.deletion.try_at_home_in_flight',
          message: 'Cannot delete customer with dispatched try-at-home bookings — recover the piece first',
        });
      }

      const upd = await tx.query<{ deleted_at: Date; hard_delete_scheduled_at: Date }>(
        `UPDATE customers SET
           name                     = 'Deleted Customer',
           email                    = NULL,
           address_line1            = NULL,
           address_line2            = NULL,
           city                     = NULL,
           state                    = NULL,
           pincode                  = NULL,
           dob_year                 = NULL,
           phone                    = encode(digest(shop_id::text || ':' || phone, 'sha256'), 'hex'),
           pan_ciphertext           = NULL,
           pan_key_id               = NULL,
           viewing_consent          = false,
           notes                    = NULL,
           deleted_at               = now(),
           hard_delete_scheduled_at = now() + interval '30 days',
           pii_redacted_at          = now(),
           deletion_requested_by    = $2,
           deletion_reason          = $3,
           deletion_reason_text     = $4,
           updated_at               = now()
         WHERE id = $1
           AND shop_id = ${TENANT_SQL}
         RETURNING deleted_at, hard_delete_scheduled_at`,
        [customerId, requestedBy, options.reason ?? null, options.reasonText ?? null],
      );

      // Wishlists are ephemeral — hard-delete now (day 0).
      const wishlistRes = await tx.query(
        `DELETE FROM wishlists
         WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
        [customerId],
      );

      // Cascade: anonymise reviews — keep them for storefront social proof but
      // drop the customer attribution. The FK is ON DELETE SET NULL after 0075,
      // so the day-30 hard-delete cleans up automatically; we NULL it here at
      // day 0 so the storefront query stops rendering the soft-deleted-customer
      // name immediately.
      const reviewsRes = await tx.query(
        `UPDATE product_reviews
           SET customer_id = NULL
         WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
        [customerId],
      );

      // Cascade: cancel rate-lock bookings. The schema enum has 'CANCELLED'
      // since 0045. Active bookings with paid deposits surface a
      // rateLockRefundsPending count in the audit log so the shopkeeper can
      // process refunds manually (the payments adapter has no refund API).
      const rateLockRes = await tx.query<{ refunds_pending: string; total: string }>(
        `WITH cancelled AS (
           UPDATE rate_lock_bookings
              SET status = 'CANCELLED'
            WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}
              AND status IN ('PENDING_PAYMENT','ACTIVE')
            RETURNING deposit_paid_paise
         )
         SELECT COUNT(*) FILTER (WHERE deposit_paid_paise > 0)::text AS refunds_pending,
                COUNT(*)::text AS total FROM cancelled`,
        [customerId],
      );
      const rateLockRefundsPending = parseInt(rateLockRes.rows[0]?.refunds_pending ?? '0', 10);
      const rateLocksCount         = parseInt(rateLockRes.rows[0]?.total ?? '0', 10);

      // Cascade: cancel REQUESTED try-at-home bookings. DISPATCHED is blocked
      // at the top of this function; RETURNED / CONVERTED_TO_SALE / EXPIRED
      // are terminal and unaffected.
      const tryAtHomeRes = await tx.query(
        `UPDATE try_at_home_bookings
           SET status = 'CANCELLED'
         WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}
           AND status = 'REQUESTED'`,
        [customerId],
      );

      // family_members: drop both directions immediately.
      await tx.query(
        `DELETE FROM family_members
         WHERE shop_id = ${TENANT_SQL}
           AND (customer_id = $1 OR related_customer_id = $1)`,
        [customerId],
      );

      const tables = await probeChildTables(tx);
      if (tables.has_notes) {
        await tx.query(
          `UPDATE customer_notes
              SET body = '[redacted by deletion request]', updated_at = now()
            WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
          [customerId],
        );
      }
      if (tables.has_occasions) {
        await tx.query(
          `DELETE FROM customer_occasions
            WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
          [customerId],
        );
      }
      if (tables.has_balances) {
        await tx.query(
          `DELETE FROM customer_balances
            WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
          [customerId],
        );
      }

      return {
        scheduledAt:  upd.rows[0].deleted_at,
        hardDeleteAt: upd.rows[0].hard_delete_scheduled_at,
        cascadeCounts: {
          wishlists: wishlistRes.rowCount ?? 0,
          reviews:   reviewsRes.rowCount ?? 0,
          rateLocks: rateLocksCount,
          tryAtHome: tryAtHomeRes.rowCount ?? 0,
        },
        rateLockRefundsPending,
      };
    });
  }

  /**
   * Idempotent. Returns true if the row was hard-deleted, false if either:
   *   - the row no longer exists (already hard-deleted), or
   *   - the row is not yet eligible (deleted_at IS NULL OR hard_delete_scheduled_at > now()).
   * Caller (worker) must have established the tenant context for `customerId`.
   */
  async hardDeleteAtomic(customerId: string): Promise<boolean> {
    return withTenantTx(this.pool, async (tx) => {
      const sel = await tx.query<{ deleted_at: Date | null; hard_delete_scheduled_at: Date | null; pii_redacted_at: Date | null }>(
        `SELECT deleted_at, hard_delete_scheduled_at, pii_redacted_at
           FROM customers
          WHERE id = $1 AND shop_id = ${TENANT_SQL}
          FOR UPDATE`,
        [customerId],
      );
      if (sel.rows.length === 0) return false;
      const { deleted_at, hard_delete_scheduled_at, pii_redacted_at } = sel.rows[0];
      if (deleted_at === null || pii_redacted_at === null) return false;
      if (hard_delete_scheduled_at === null || hard_delete_scheduled_at.getTime() > Date.now()) return false;

      // FK-order cleanup of any rows that might have been re-created or
      // that exist on the merged-main schema.
      await tx.query(
        `DELETE FROM family_members
         WHERE shop_id = ${TENANT_SQL}
           AND (customer_id = $1 OR related_customer_id = $1)`,
        [customerId],
      );

      const tables = await probeChildTables(tx);
      if (tables.has_notes) {
        await tx.query(
          `DELETE FROM customer_notes
            WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
          [customerId],
        );
      }
      if (tables.has_occasions) {
        await tx.query(
          `DELETE FROM customer_occasions
            WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
          [customerId],
        );
      }
      if (tables.has_balances) {
        await tx.query(
          `DELETE FROM customer_balances
            WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
          [customerId],
        );
      }

      // Remove viewing_consent before deleting the customer (FK: viewing_consent.customer_id → customers.id).
      await tx.query(
        `DELETE FROM viewing_consent WHERE customer_id = $1 AND shop_id = ${TENANT_SQL}`,
        [customerId],
      );

      // Detach invoices: retain rows for tax/PMLA, null the customer link.
      await tx.query(
        `UPDATE invoices SET
            customer_id    = NULL,
            customer_name  = 'Deleted Customer',
            customer_phone = NULL
          WHERE customer_id = $1
            AND shop_id = ${TENANT_SQL}`,
        [customerId],
      );

      const del = await tx.query(
        `DELETE FROM customers
          WHERE id = $1 AND shop_id = ${TENANT_SQL}
          RETURNING id`,
        [customerId],
      );
      return del.rowCount === 1;
    });
  }

  /**
   * Cross-tenant query for the daily safety-net sweep — finds any customer
   * whose 30-day grace window has expired but whose row still exists.
   *
   * IMPORTANT: This bypasses tenant context because the sweep runs as a
   * platform cron, not a per-tenant request. The connection runs as the
   * pool's default role (bypasses RLS). Per-row work is then re-entered
   * via tenantContext.runWith(shop) before mutating anything.
   */
  async findDueForHardDelete(): Promise<DueForHardDelete[]> {
    // nosemgrep: goldsmith.require-tenant-transaction -- platform sweep, by design
    const r = await this.pool.query<{ id: string; shop_id: string }>(
      `SELECT id, shop_id FROM customers
        WHERE deleted_at IS NOT NULL
          AND hard_delete_scheduled_at IS NOT NULL
          AND hard_delete_scheduled_at <= now()
        LIMIT 500`,
    );
    return r.rows.map((row) => ({ customerId: row.id, shopId: row.shop_id }));
  }
}
