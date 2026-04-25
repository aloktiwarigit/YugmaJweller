import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import {
  enforce269ST,
  buildCashCapOverride,
  SECTION_269ST_LIMIT_PAISE,
} from '@goldsmith/compliance';
import type { CashCapOverride } from '@goldsmith/compliance';
import { AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface CashPaymentOverride {
  justification: string;
}

// Normalizes a phone number to a canonical 10-digit form before using it as
// a pmla_aggregates key. Prevents the same walk-in customer from creating
// separate aggregate rows due to formatting variants (9999999999 vs +91 99999 99999).
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Strip spaces, dashes, parentheses, then remove leading +91 or 91 (10-digit numbers)
  const digits = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+?91(?=\d{10}$)/, '');
  return digits.length > 0 ? digits : null;
}

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
    updated_at       = now()
  WHERE shop_id       = current_setting('app.current_shop_id', true)::uuid
    AND aggregate_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    AND (customer_id IS NOT DISTINCT FROM $2::uuid)
    AND (customer_phone IS NOT DISTINCT FROM $3)
`;

// Idempotency check: validates key + invoice_id + amount_paise so a client
// reusing a key for a different payment does not get a silent no-op.
const CHECK_PAYMENT_IDEM_SQL = `
  SELECT id FROM payments
  WHERE shop_id         = current_setting('app.current_shop_id', true)::uuid
    AND idempotency_key = $1
    AND invoice_id      = $2
    AND amount_paise    = $3
`;

@Injectable()
export class PaymentService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // Records a cash payment against an invoice.
  // Enforces the Section 269ST Rs 1,99,999 daily cash-cap per customer.
  // idempotencyKey: caller-provided key; duplicate requests return void silently.
  //
  // Transaction order is carefully designed:
  //   A. Early idem check (no lock): fast path for sequential retries
  //   B. Invoice SELECT FOR UPDATE: lock invoice to serialize concurrent payments
  //   C. Aggregate lock (IST date, TOCTOU-safe): INSERT ON CONFLICT row lock
  //   D. Late idem check (post-lock): catches concurrent retries that slipped past A
  //   E. Balance check: MUST come after D so a concurrent retry returning early at D
  //      never hits the false-positive payment_exceeds_balance error
  //   F. Compliance enforcement
  //   G. Increment aggregate
  //   H. Insert payment
  //   I. Override metadata on invoice
  async recordCashPayment(
    invoiceId: string,
    amountPaise: bigint,
    idempotencyKey: string,
    override?: CashPaymentOverride,
  ): Promise<void> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    await withTenantTx(this.pool, async (tx) => {
      // ── A. Early idempotency check ─────────────────────────────────────────
      const earlyIdem = await tx.query<{ id: string }>(CHECK_PAYMENT_IDEM_SQL, [idempotencyKey, invoiceId, amountPaise]);
      if (earlyIdem.rows[0]) return;

      // ── B. Verify invoice — lock row to serialize concurrent payments ───────
      const invRes = await tx.query<{
        id: string;
        status: string;
        total_paise: string;
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
      // Normalize customer identity for aggregate key:
      //   - customer_id takes precedence; when non-null, phone is set to null
      //   - phone is normalized to canonical 10-digit form to prevent variant-based bypass
      const customerPhone = customerId ? null : normalizePhone(rawPhone);

      if (status !== 'ISSUED') {
        throw new UnprocessableEntityException({ code: 'invoice.not_payable', status });
      }

      // ── C. Acquire aggregate row lock (IST date, TOCTOU-safe) ──────────────
      const aggRes = await tx.query<{ cash_total_paise: string }>(
        FETCH_OR_INIT_AGGREGATE_SQL,
        [customerId ?? null, customerPhone ?? null],
      );
      const existingDailyPaise = BigInt(aggRes.rows[0]?.cash_total_paise ?? '0');

      // ── D. Late idempotency check (post-lock) ──────────────────────────────
      // A concurrent retry that waited on the invoice lock in B would have the
      // first request's payment committed by now — this returns it early BEFORE
      // the balance check in E. Without this order, the retry would see
      // alreadyPaidPaise including the first payment and falsely throw
      // payment_exceeds_balance when amountPaise == invoice total.
      const lateIdem = await tx.query<{ id: string }>(CHECK_PAYMENT_IDEM_SQL, [idempotencyKey, invoiceId, amountPaise]);
      if (lateIdem.rows[0]) return;

      // ── E. Balance check (after late idem — only reached for new payments) ─
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
          code:                   'invoice.payment_exceeds_balance',
          amountPaise:            amountPaise.toString(),
          remainingBalancePaise:  remainingBalancePaise.toString(),
        });
      }

      // ── F. Compliance enforcement ──────────────────────────────────────────
      const projectedPaise = existingDailyPaise + amountPaise;
      const limitExceeded = projectedPaise > SECTION_269ST_LIMIT_PAISE;
      let overrideMeta: CashCapOverride | null = null;

      if (!limitExceeded) {
        // Path A: within limit — no override metadata, no audit event
      } else if (override) {
        // Path B: over limit + override. buildCashCapOverride throws for shop_staff.
        overrideMeta = buildCashCapOverride(
          { role: ctx.role, justification: override.justification },
          projectedPaise,
        );
      } else {
        // Path C: over limit + no override — hard-block (throws ComplianceHardBlockError)
        enforce269ST({
          shopId:             ctx.shopId,
          customerId:         customerId ?? null,
          customerPhone:      customerPhone ?? null,
          cashAmountPaise:    amountPaise,
          existingDailyPaise,
        });
      }

      // ── G. Increment aggregate ─────────────────────────────────────────────
      await tx.query(INCREMENT_AGGREGATE_SQL, [amountPaise, customerId ?? null, customerPhone ?? null]);

      // ── H. Insert payment record ───────────────────────────────────────────
      // Catch 23505 from uq_payments_shop_idempotency: a reused key targeting
      // a different invoice/amount missed the SELECT checks (they filter all three)
      // but the DB unique index catches it. Map to typed 409 instead of 500.
      try {
        await tx.query(
          `INSERT INTO payments
             (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, idempotency_key)
           VALUES (current_setting('app.current_shop_id', true)::uuid, $1, 'CASH', $2, 'CONFIRMED', $3, $4)`,
          [invoiceId, amountPaise, ctx.userId, idempotencyKey],
        );
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
          throw new ConflictException({ code: 'payment.idempotency_key_conflict' });
        }
        throw err;
      }

      // ── I. Override metadata + audit (in-transaction for atomicity) ──────────
      // Compliance overrides MUST be audited atomically with the payment.
      // A committed override with no audit trail is a regulatory gap.
      if (overrideMeta) {
        await tx.query(
          `UPDATE invoices
           SET compliance_overrides_jsonb =
             COALESCE(compliance_overrides_jsonb, '[]'::jsonb) || jsonb_build_array($1::jsonb),
               updated_at = now()
           WHERE id = $2`,
          [JSON.stringify({ ...overrideMeta, actorUserId: ctx.userId }), invoiceId],
        );

        // Write audit event within the same transaction — if this fails, the
        // payment rolls back, ensuring no override escapes without an audit record.
        await tx.query(
          `INSERT INTO audit_events
             (shop_id, actor_user_id, action, subject_type, subject_id, metadata)
           VALUES
             (current_setting('app.current_shop_id', true)::uuid, $1, $2, $3, $4, $5)`,
          [
            ctx.userId,
            AuditAction.COMPLIANCE_OVERRIDE_269ST,
            'invoice',
            invoiceId,
            JSON.stringify({
              justification: overrideMeta.justification,
              amountPaise:   amountPaise.toString(),
              role:          ctx.role,
              limitPaise:    SECTION_269ST_LIMIT_PAISE.toString(),
            }),
          ],
        );
      }
    });
  }
}
