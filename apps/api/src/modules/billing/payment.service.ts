import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from '@goldsmith/queue';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import {
  enforce269ST,
  buildCashCapOverride,
  SECTION_269ST_LIMIT_PAISE,
  trackPmlaCumulative,
} from '@goldsmith/compliance';
import type { CashCapOverride, PmlaCumulativeResult } from '@goldsmith/compliance';
import { AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface CashPaymentOverride {
  justification: string;
}

export interface PmlaWarningDto {
  cumulativePaise: string;
  monthStr:        string;
  status:          'warn';
}

export interface CashPaymentResult {
  pmlaWarning?: PmlaWarningDto;
}

// Normalizes a phone number to a canonical 10-digit form before using it as
// a pmla_aggregates key. Prevents the same walk-in customer from creating
// separate aggregate rows due to formatting variants (9999999999 vs +91 99999 99999).
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Strip spaces, dashes, parentheses, then remove leading +91 or 91 (10-digit numbers)
  const digits = phone.replace(/[\s\-().]/g, '').replace(/^\+?91(?=\d{10}$)/, '');
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

// Idempotency check: validates key + invoice_id + amount_paise so a client
// reusing a key for a different payment does not get a silent no-op.
const CHECK_PAYMENT_IDEM_SQL = `
  SELECT id FROM payments
  WHERE shop_id         = current_setting('app.current_shop_id', true)::uuid
    AND idempotency_key = $1
    AND invoice_id      = $2
    AND amount_paise    = $3
`;

export interface PmlaCashThresholdWarningJob {
  shopId:          string;
  customerId:      string | null;
  customerPhone:   string | null;
  cumulativePaise: string;
  monthStr:        string;
}

@Injectable()
export class PaymentService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @InjectQueue('compliance-pmla') private readonly pmlaQueue: Queue,
  ) {}

  // Records a cash payment against an invoice.
  // Enforces the Section 269ST Rs 1,99,999 daily cash-cap per customer.
  // Tracks monthly PMLA cumulative cash (warn at Rs 8L, block at Rs 10L in Story 5.6).
  // idempotencyKey: caller-provided key; duplicate requests return silently.
  //
  // Transaction order:
  //   A. Early idem check (no lock): fast path for sequential retries
  //   B. Invoice SELECT FOR UPDATE: lock invoice to serialize concurrent payments
  //   C. Aggregate lock (IST date, TOCTOU-safe): INSERT ON CONFLICT row lock
  //   D. Late idem check (post-lock): catches concurrent retries
  //   E. Balance check
  //   F. Compliance 269ST enforcement
  //   G. PMLA tracking (replaces old INCREMENT step): atomic upsert + monthly SUM
  //   H. Insert payment
  //   I. Override metadata on invoice
  //   J. PMLA audit log (inside tx, atomic with payment)
  //
  //   Post-commit: enqueue async BullMQ job for PMLA notification if status === 'warn'
  async recordCashPayment(
    invoiceId: string,
    amountPaise: bigint,
    idempotencyKey: string,
    override?: CashPaymentOverride,
  ): Promise<CashPaymentResult> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    let pmlaResult: PmlaCumulativeResult | null = null;

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
      // aggregate_date/month come from DB's NOW() — capture them here so step G
      // uses the same day bucket rather than JS new Date() which can diverge at
      // IST midnight if app and DB clocks differ by even one second.
      const aggRes = await tx.query<{ cash_total_paise: string; aggregate_date: string; aggregate_month: string }>(
        FETCH_OR_INIT_AGGREGATE_SQL,
        [customerId ?? null, customerPhone ?? null],
      );
      const existingDailyPaise = BigInt(aggRes.rows[0]?.cash_total_paise ?? '0');
      // IST midnight of the aggregate_date — passed to trackPmlaCumulative so both
      // the 269ST lock and the PMLA upsert target the same calendar day.
      const aggDateIST = aggRes.rows[0]?.aggregate_date
        ? new Date(`${aggRes.rows[0].aggregate_date}T00:00:00+05:30`)
        : new Date();

      // ── D. Late idempotency check (post-lock) ──────────────────────────────
      const lateIdem = await tx.query<{ id: string }>(CHECK_PAYMENT_IDEM_SQL, [idempotencyKey, invoiceId, amountPaise]);
      if (lateIdem.rows[0]) return;

      // ── E. Balance check ────────────────────────────────────────────────────
      const paidRes = await tx.query<{ paid: string; cash_count: string }>(
        `SELECT COALESCE(SUM(amount_paise), 0)::text AS paid,
                COUNT(*) FILTER (WHERE method = 'CASH')::text AS cash_count
         FROM payments
         WHERE invoice_id = $1 AND status != 'FAILED'`,
        [invoiceId],
      );
      const alreadyPaidPaise = BigInt(paidRes.rows[0]?.paid ?? '0');
      // True only when this is the first cash payment for this invoice.
      // Passed to trackPmlaCumulative so invoice_count is incremented once
      // per invoice, not once per payment installment.
      const isFirstCashPayment = Number(paidRes.rows[0]?.cash_count ?? '0') === 0;
      const invoiceTotalPaise = BigInt(total_paise);
      const remainingBalancePaise = invoiceTotalPaise - alreadyPaidPaise;
      if (amountPaise > remainingBalancePaise) {
        throw new UnprocessableEntityException({
          code:                   'invoice.payment_exceeds_balance',
          amountPaise:            amountPaise.toString(),
          remainingBalancePaise:  remainingBalancePaise.toString(),
        });
      }

      // ── F. Compliance 269ST enforcement ────────────────────────────────────
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

      // ── G. PMLA tracking — atomic daily upsert + monthly cumulative SUM ────
      // Replaces the old two-step fetch-or-init + increment pattern.
      // Upserts the daily row (INSERT ON CONFLICT DO UPDATE with increment),
      // then queries the monthly SUM. Returns warn/block/ok status.
      pmlaResult = await trackPmlaCumulative(tx, {
        customerId:           customerId ?? null,
        customerPhone:        customerPhone ?? null,
        cashIncrementPaise:   amountPaise,
        transactionDateIST:   aggDateIST,      // P1b fix: same IST date as step C's lock
        incrementInvoiceCount: isFirstCashPayment, // P2 fix: count per invoice, not per installment
      });

      // ── H. Insert payment record ───────────────────────────────────────────
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

      // ── I. Override metadata + 269ST audit (in-transaction for atomicity) ──
      if (overrideMeta) {
        await tx.query(
          `UPDATE invoices
           SET compliance_overrides_jsonb =
             COALESCE(compliance_overrides_jsonb, '[]'::jsonb) || jsonb_build_array($1::jsonb),
               updated_at = now()
           WHERE id = $2`,
          [JSON.stringify({ ...overrideMeta, actorUserId: ctx.userId }), invoiceId],
        );

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

      // ── J. PMLA audit log (inside tx — atomic with payment) ─────────────────
      if (pmlaResult && pmlaResult.status === 'warn') {
        await tx.query(
          `INSERT INTO audit_events
             (shop_id, actor_user_id, action, subject_type, subject_id, metadata)
           VALUES
             (current_setting('app.current_shop_id', true)::uuid, $1, $2, $3, $4, $5)`,
          [
            ctx.userId,
            AuditAction.PMLA_WARN_THRESHOLD_REACHED,
            'invoice',
            invoiceId,
            JSON.stringify({
              cumulativePaise: pmlaResult.cumulativePaise.toString(),
              month:           pmlaResult.monthStr,
              customerId:      customerId ?? null,
            }),
          ],
        );
      }
    });

    // TypeScript cannot track `let` variable mutations through async closures.
    // Snapshot with explicit annotation so post-commit checks resolve correctly.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const capturedPmla = pmlaResult as PmlaCumulativeResult | null;

    // ── Post-commit: async BullMQ job for PMLA notification ─────────────────
    // Enqueued AFTER the transaction commits so the job never fires for a rolled-back payment.
    // Fire-and-forget (void) — a queue failure must not fail the payment response.
    if (capturedPmla?.status === 'warn') {
      const job: PmlaCashThresholdWarningJob = {
        shopId:          ctx.shopId,
        customerId:      null, // Epic 6: customer identity TBD
        customerPhone:   null,
        cumulativePaise: capturedPmla.cumulativePaise.toString(),
        monthStr:        capturedPmla.monthStr,
      };
      void this.pmlaQueue.add('cash-threshold-warning', job).catch(() => undefined);
    }

    return capturedPmla?.status === 'warn'
      ? {
          pmlaWarning: {
            cumulativePaise: capturedPmla.cumulativePaise.toString(),
            monthStr:        capturedPmla.monthStr,
            status:          'warn',
          },
        }
      : {};
  }
}
