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
// Returns 0n if no aggregate row exists yet.
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
  // If override is provided, the actor must be shop_admin or shop_manager with
  // a substantive justification (≥10 chars); override is audit-logged.
  async recordCashPayment(
    invoiceId: string,
    amountPaise: bigint,
    override?: CashPaymentOverride,
  ): Promise<void> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    await withTenantTx(this.pool, async (tx) => {
      // 1. Verify invoice exists (RLS scopes to current tenant)
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
      const aggRes = await tx.query<{ cash_total_paise: bigint }>(
        FETCH_OR_INIT_AGGREGATE_SQL,
        [customerId ?? null, customerPhone ?? null],
      );
      const existingDailyPaise = aggRes.rows[0]?.cash_total_paise ?? 0n;

      // 3. Compliance check
      if (override) {
        // Override path: validate actor role + justification before proceeding.
        // buildCashCapOverride throws ComplianceHardBlockError if role is shop_staff or unknown.
        const overrideMeta = buildCashCapOverride(
          { role: ctx.role, justification: override.justification },
          existingDailyPaise + amountPaise,
        );

        // 4a. Increment aggregate (override bypasses the hard-block)
        await tx.query(INCREMENT_AGGREGATE_SQL, [amountPaise, customerId ?? null, customerPhone ?? null]);

        // 5. Store override metadata on the invoice for audit trail
        await tx.query(
          `UPDATE invoices SET compliance_overrides_jsonb = $1, updated_at = now() WHERE id = $2`,
          [
            JSON.stringify({ ...overrideMeta, actorUserId: ctx.userId }),
            invoiceId,
          ],
        );
      } else {
        // No override: enforce the hard-block
        enforce269ST({
          shopId:             ctx.shopId,
          customerId:         customerId ?? null,
          customerPhone:      customerPhone ?? null,
          cashAmountPaise:    amountPaise,
          existingDailyPaise: existingDailyPaise,
        });

        // 4b. Increment aggregate (passed the check)
        await tx.query(INCREMENT_AGGREGATE_SQL, [amountPaise, customerId ?? null, customerPhone ?? null]);
      }

      // 6. Insert payment record
      await tx.query(
        `INSERT INTO payments
           (shop_id, invoice_id, method, amount_paise, status, created_by_user_id)
         VALUES (current_setting('app.current_shop_id', true)::uuid, $1, 'CASH', $2, 'COMPLETED', $3)`,
        [invoiceId, amountPaise, ctx.userId],
      );
    });

    // 7. Audit override — fire-and-forget after transaction commits
    if (override) {
      void auditLog(this.pool, {
        action:      AuditAction.COMPLIANCE_OVERRIDE_269ST,
        subjectType: 'invoice',
        subjectId:   invoiceId,
        actorUserId: ctx.userId,
        metadata: {
          justification:     override.justification,
          amountPaise:       amountPaise.toString(),
          role:              ctx.role,
          limitPaise:        SECTION_269ST_LIMIT_PAISE.toString(),
        },
      }).catch(() => undefined);
    }
  }
}
