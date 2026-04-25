import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import {
  enforce269ST,
  buildCashCapOverride,
  SECTION_269ST_LIMIT_PAISE,
} from '@goldsmith/compliance';
import type { CashCapOverride } from '@goldsmith/compliance';
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

const CHECK_PAYMENT_IDEM_SQL = `
  SELECT id FROM payments
  WHERE shop_id       = current_setting('app.current_shop_id', true)::uuid
    AND idempotency_key = $1
`;

@Injectable()
export class PaymentService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // Records a cash payment against an invoice.
  // Enforces the Section 269ST Rs 1,99,999 daily cash-cap per customer.
  // idempotencyKey: caller-provided key; duplicate requests return void silently.
  //
  // Idempotency is guaranteed by a double-check pattern:
  //   (a) early SELECT before any locking — fast-path for sequential retries
  //   (b) late SELECT after acquiring the aggregate row lock — catches concurrent races
  //
  // Override: if provided and the limit is exceeded, actor must be shop_admin or
  // shop_manager with justification ≥10 chars; override is audit-logged.
  async recordCashPayment(
    invoiceId: string,
    amountPaise: bigint,
    idempotencyKey: string,
    override?: CashPaymentOverride,
  ): Promise<void> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    let overrideWasUsed = false;

    await withTenantTx(this.pool, async (tx) => {
      // ── A. Early idempotency check ─────────────────────────────────────────
      // Catches sequential retries before acquiring any locks.
      const earlyIdem = await tx.query<{ id: string }>(CHECK_PAYMENT_IDEM_SQL, [idempotencyKey]);
      if (earlyIdem.rows[0]) return; // Already committed — safe retry

      // ── B. Verify invoice (RLS scopes to current tenant) ──────────────────
      // FOR UPDATE locks the row — serializes concurrent payments on the same invoice,
      // preventing a TOCTOU gap between the balance check and the payment INSERT.
      const invRes = await tx.query<{
        id: string;
        status: string;
        total_paise: string; // pg returns BIGINT as string
        customer_id: string | null;
        customer_phone: string | null;
      }>(
        `SELECT id, status, total_paise, customer_id, customer_phone FROM invoices WHERE id = $1 FOR UPDATE`,
        [invoiceId],
      );
      if (!invRes.rows[0]) {
        throw new NotFoundException({ code: 'invoice.not_found' });
      }
      const { status, total_paise, customer_id: customerId, customer_phone: rawPhone } = invRes.rows[0];

      // Normalize customer identity: customer_id takes precedence over phone.
      // When customer_id is known, we clear phone from the aggregate key so that
      // the same customer with different phone data across invoices maps to one row.
      const customerPhone = customerId ? null : rawPhone;

      // Only ISSUED invoices accept payments (not DRAFT or VOIDED)
      if (status !== 'ISSUED') {
        throw new UnprocessableEntityException({ code: 'invoice.not_payable', status });
      }

      // Overpayment guard: amount must not exceed outstanding balance
      const paidRes = await tx.query<{ paid: string }>(
        `SELECT COALESCE(SUM(amount_paise), 0)::text AS paid
         FROM payments
         WHERE invoice_id = $1 AND status != 'FAILED'`,
        [invoiceId],
      );
      const alreadyPaidPaise = BigInt(paidRes.rows[0]?.paid ?? '0');
      const invoiceTotalPaise = BigInt(total_paise);
      const remainingBalancePaise = invoiceTotalPaise - alreadyPaidPaise;
      if (amountPaise > remainingBalancePaise) {
        throw new UnprocessableEntityException({
          code: 'invoice.payment_exceeds_balance',
          amountPaise:            amountPaise.toString(),
          remainingBalancePaise:  remainingBalancePaise.toString(),
        });
      }

      // ── C. Acquire aggregate row lock (IST date, TOCTOU-safe) ──────────────
      // INSERT ON CONFLICT acquires an exclusive row lock. Concurrent transactions
      // on the same customer+date block here until this transaction commits.
      const aggRes = await tx.query<{ cash_total_paise: string }>(
        FETCH_OR_INIT_AGGREGATE_SQL,
        [customerId ?? null, customerPhone ?? null],
      );
      // pg returns BIGINT columns as strings — convert explicitly before arithmetic
      const existingDailyPaise = BigInt(aggRes.rows[0]?.cash_total_paise ?? '0');

      // ── D. Late idempotency check (post-lock) ──────────────────────────────
      // Catches concurrent requests that committed the same idempotency_key
      // while this transaction was waiting for the aggregate lock in step C.
      const lateIdem = await tx.query<{ id: string }>(CHECK_PAYMENT_IDEM_SQL, [idempotencyKey]);
      if (lateIdem.rows[0]) return; // Another concurrent request committed first

      // ── E. Compliance enforcement ──────────────────────────────────────────
      // Three paths: within limit / over limit with override / hard-block
      const projectedPaise = existingDailyPaise + amountPaise;
      const limitExceeded = projectedPaise > SECTION_269ST_LIMIT_PAISE;
      let overrideMeta: CashCapOverride | null = null;

      if (!limitExceeded) {
        // Path A: within limit — no override metadata, no audit event
      } else if (override) {
        // Path B: over limit + override provided.
        // buildCashCapOverride throws ComplianceHardBlockError for shop_staff or unknown role.
        overrideMeta = buildCashCapOverride(
          { role: ctx.role, justification: override.justification },
          projectedPaise,
        );
      } else {
        // Path C: over limit + no override — hard-block (throws)
        enforce269ST({
          shopId:             ctx.shopId,
          customerId:         customerId ?? null,
          customerPhone:      customerPhone ?? null,
          cashAmountPaise:    amountPaise,
          existingDailyPaise,
        });
      }

      // ── F. Increment aggregate (now safe — we hold the lock) ───────────────
      await tx.query(INCREMENT_AGGREGATE_SQL, [amountPaise, customerId ?? null, customerPhone ?? null]);

      // ── G. Insert payment record (idempotency_key unique partial index) ────
      // 'CONFIRMED' is correct for cash (immediate, no clearing delay).
      await tx.query(
        `INSERT INTO payments
           (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, idempotency_key)
         VALUES (current_setting('app.current_shop_id', true)::uuid, $1, 'CASH', $2, 'CONFIRMED', $3, $4)`,
        [invoiceId, amountPaise, ctx.userId, idempotencyKey],
      );

      // ── H. Store override metadata on invoice for audit trail ──────────────
      if (overrideMeta) {
        await tx.query(
          `UPDATE invoices
           SET compliance_overrides_jsonb =
             COALESCE(compliance_overrides_jsonb, '[]'::jsonb) || jsonb_build_array($1::jsonb),
               updated_at = now()
           WHERE id = $2`,
          [JSON.stringify({ ...overrideMeta, actorUserId: ctx.userId }), invoiceId],
        );
        overrideWasUsed = true;
      }
    });

    // ── I. Audit override (fire-and-forget, after transaction commits) ────────
    if (overrideWasUsed) {
      void auditLog(this.pool, {
        action:      AuditAction.COMPLIANCE_OVERRIDE_269ST,
        subjectType: 'invoice',
        subjectId:   invoiceId,
        actorUserId: ctx.userId,
        metadata: {
          justification: override?.justification ?? '',
          amountPaise:   amountPaise.toString(),
          role:          ctx.role,
          limitPaise:    SECTION_269ST_LIMIT_PAISE.toString(),
        },
      }).catch(() => undefined);
    }
  }
}
