import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import {
  enforce269ST,
  buildCashCapOverride,
  SECTION_269ST_LIMIT_PAISE,
} from '@goldsmith/compliance';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface CashPaymentOverride {
  justification: string;
}

// IST-based aggregate lookup: fetches the existing daily cash total for this
// customer+shop within the IST calendar day, using a lock to prevent TOCTOU.
// Returns 0 if no aggregate row exists yet.
const FETCH_OR_INIT_AGGREGATE_SQL = `
  INSERT INTO pmla_aggregates
    (shop_id, customer_id, customer_phone, aggregate_date, aggregate_month, cash_total_paise, invoice_count)
  VALUES (
    current_setting('app.current_shop_id', true)::uuid,
    $1, $2,
    (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
    to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM'),
    0, 0
  )
  ON CONFLICT ON CONSTRAINT pmla_aggregates_unique
  DO UPDATE SET updated_at = pmla_aggregates.updated_at
  RETURNING cash_total_paise
`;

const INCREMENT_AGGREGATE_SQL = `
  UPDATE pmla_aggregates SET
    cash_total_paise = cash_total_paise + $1,
    invoice_count    = invoice_count + 1,
    updated_at       = now()
  WHERE shop_id       = current_setting('app.current_shop_id', true)::uuid
    AND aggregate_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    AND (customer_id IS NOT DISTINCT FROM $2::uuid)
    AND (customer_phone IS NOT DISTINCT FROM $3)
`;

@Injectable()
export class PaymentService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // Records a cash payment against an invoice.
  // Enforces the Section 269ST Rs 1,99,999 daily cash-cap per customer.
  // idempotencyKey: caller-provided key; duplicate requests return void silently.
  // If override is provided and the limit is exceeded, the actor must be shop_admin
  // or shop_manager with a substantive justification (≥10 chars); override is audit-logged.
  async recordCashPayment(
    invoiceId: string,
    amountPaise: bigint,
    idempotencyKey: string,
    override?: CashPaymentOverride,
  ): Promise<void> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    let overrideWasUsed = false;

    await withTenantTx(this.pool, async (tx) => {
      // 1a. Idempotency check — must happen BEFORE any compliance/aggregate mutation.
      //     If this key was already committed, return silently without re-counting.
      const idemCheck = await tx.query<{ id: string }>(
        `SELECT id FROM payments
         WHERE shop_id = current_setting('app.current_shop_id', true)::uuid
           AND idempotency_key = $1`,
        [idempotencyKey],
      );
      if (idemCheck.rows[0]) return; // Already processed — idempotent

      // 1b. Verify invoice exists (RLS scopes to current tenant)
      const invRes = await tx.query<{
        id: string;
        customer_id: string | null;
        customer_phone: string | null;
      }>(
        `SELECT id, customer_id, customer_phone FROM invoices WHERE id = $1`,
        [invoiceId],
      );
      if (!invRes.rows[0]) {
        throw new NotFoundException({ code: 'invoice.not_found' });
      }
      const { customer_id: customerId, customer_phone: customerPhone } = invRes.rows[0];

      // 2. Lock-or-create the aggregate row (IST date) and read the existing daily total.
      //    INSERT ON CONFLICT acquires an exclusive row lock preventing concurrent
      //    transactions from reading+writing the aggregate simultaneously (TOCTOU-safe).
      const aggRes = await tx.query<{ cash_total_paise: string }>(
        FETCH_OR_INIT_AGGREGATE_SQL,
        [customerId ?? null, customerPhone ?? null],
      );
      // pg returns BIGINT columns as strings — convert explicitly before arithmetic
      const existingDailyPaise = BigInt(aggRes.rows[0]?.cash_total_paise ?? '0');
      const projectedPaise = existingDailyPaise + amountPaise;
      const limitExceeded = projectedPaise > SECTION_269ST_LIMIT_PAISE;

      // 3. Compliance enforcement — three paths:
      //    A. Under limit (override ignored): normal increment
      //    B. Over limit + override provided: role+justification check, then record
      //    C. Over limit + no override: throw hard-block error
      if (!limitExceeded) {
        // Path A: within limit — no override metadata, no audit event
        await tx.query(INCREMENT_AGGREGATE_SQL, [amountPaise, customerId ?? null, customerPhone ?? null]);
      } else if (override) {
        // Path B: limit exceeded and override provided.
        // buildCashCapOverride throws ComplianceHardBlockError if role is shop_staff or unknown.
        const overrideMeta = buildCashCapOverride(
          { role: ctx.role, justification: override.justification },
          projectedPaise,
        );

        await tx.query(INCREMENT_AGGREGATE_SQL, [amountPaise, customerId ?? null, customerPhone ?? null]);

        // 5. Append override metadata to the invoice's JSONB array (preserves prior overrides).
        //    Uses || jsonb_build_array() so multiple overrides accumulate as an array.
        await tx.query(
          `UPDATE invoices
           SET compliance_overrides_jsonb =
             COALESCE(compliance_overrides_jsonb, '[]'::jsonb) || jsonb_build_array($1::jsonb),
               updated_at = now()
           WHERE id = $2`,
          [JSON.stringify({ ...overrideMeta, actorUserId: ctx.userId }), invoiceId],
        );
        overrideWasUsed = true;
      } else {
        // Path C: limit exceeded and no override — hard-block
        enforce269ST({
          shopId:             ctx.shopId,
          customerId:         customerId ?? null,
          customerPhone:      customerPhone ?? null,
          cashAmountPaise:    amountPaise,
          existingDailyPaise,
        });
      }

      // 6. Insert payment record — 'CONFIRMED' for cash (immediate, no clearing delay).
      //    ON CONFLICT DO NOTHING implements idempotency: a retry with the same
      //    idempotency key silently skips the insert without rolling back the transaction.
      await tx.query(
        `INSERT INTO payments
           (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, idempotency_key)
         VALUES (current_setting('app.current_shop_id', true)::uuid, $1, 'CASH', $2, 'CONFIRMED', $3, $4)
         ON CONFLICT (shop_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [invoiceId, amountPaise, ctx.userId, idempotencyKey],
      );
    });

    // 7. Audit override — only when the limit was actually exceeded and override was used.
    //    Fire-and-forget after the transaction commits (separate tx inside auditLog).
    if (overrideWasUsed) {
      void auditLog(this.pool, {
        action:      AuditAction.COMPLIANCE_OVERRIDE_269ST,
        subjectType: 'invoice',
        subjectId:   invoiceId,
        actorUserId: ctx.userId,
        metadata: {
          justification:     override?.justification ?? '',
          amountPaise:       amountPaise.toString(),
          role:              ctx.role,
          limitPaise:        SECTION_269ST_LIMIT_PAISE.toString(),
        },
      }).catch(() => undefined);
    }
  }
}
