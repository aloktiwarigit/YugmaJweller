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
  getPmlaThresholdStatus,
  istMonthStr,
  ComplianceHardBlockError,
} from '@goldsmith/compliance';
import type { CashCapOverride, PmlaCumulativeResult } from '@goldsmith/compliance';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { Redis } from '@goldsmith/cache';
import type { PaymentsPort } from '@goldsmith/integrations-payments';

export interface CashPaymentOverride {
  justification: string;
}

export interface PmlaWarningDto {
  cumulativePaise: string;
  monthStr:        string;
  status:          'warn' | 'block'; // 'block' when ok→10L+ without intermediate warn step
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
  RETURNING cash_total_paise,
            aggregate_date::text AS aggregate_date,
            aggregate_month
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

// Monthly SUM reused for idempotency-retry warning reconstruction (steps A and D).
const PMLA_MONTHLY_SUM_SQL = `
  SELECT COALESCE(SUM(cash_total_paise), 0)::text AS monthly_total
  FROM pmla_aggregates
  WHERE aggregate_month = $1
    AND (customer_id IS NOT DISTINCT FROM $2::uuid)
    AND (customer_phone IS NOT DISTINCT FROM $3)
`;

export interface PmlaCashThresholdWarningJob {
  shopId:          string;
  customerId:      string | null;
  customerPhone:   string | null;
  cumulativePaise: string;
  monthStr:        string;
}

export interface ManualPaymentDto {
  method: 'CARD' | 'NET_BANKING' | 'OLD_GOLD' | 'SCHEME';
  amountPaise: bigint;
  referenceNumber?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  shopId: string;
  method: string;
  amountPaise: string;
  status: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  webhookStatus: string;
  recordedAt: Date;
}

const WEBHOOK_IDEM_TTL_SEC = 60 * 60 * 48;

@Injectable()
export class PaymentService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject('BILLING_REDIS') private readonly redis: Redis,
    @Inject('PAYMENTS_ADAPTER') private readonly paymentsAdapter: PaymentsPort,
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
    let crossedWarnThreshold = false;
    let pmlaWarnFromRetry: PmlaWarningDto | null = null;
    let caughtBlockErr: ComplianceHardBlockError | null = null;

    try {
    await withTenantTx(this.pool, async (tx) => {
      // ── A. Early idempotency check ─────────────────────────────────────────
      // Reconstruct pmlaWarning from the current monthly aggregate on retry.
      // The original audit event and BullMQ notification are already committed.
      const earlyIdem = await tx.query<{ id: string }>(CHECK_PAYMENT_IDEM_SQL, [idempotencyKey, invoiceId, amountPaise]);
      if (earlyIdem.rows[0]) {
        const eInv = await tx.query<{ customer_id: string | null; customer_phone: string | null }>(
          `SELECT customer_id, customer_phone FROM invoices WHERE id = $1`,
          [invoiceId],
        );
        if (eInv.rows[0]) {
          const eCid = eInv.rows[0].customer_id;
          const eCphone = eCid ? null : normalizePhone(eInv.rows[0].customer_phone);
          const eMonth = istMonthStr(new Date());
          const eSumRes = await tx.query<{ monthly_total: string }>(PMLA_MONTHLY_SUM_SQL, [eMonth, eCid, eCphone]);
          const eCumulative = BigInt(eSumRes.rows[0]?.monthly_total ?? '0');
          const ePmlaStatus = getPmlaThresholdStatus(eCumulative);
          if (ePmlaStatus !== 'ok') {
            pmlaWarnFromRetry = { cumulativePaise: eCumulative.toString(), monthStr: eMonth, status: ePmlaStatus };
          }
        }
        return;
      }

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
      // Customer identity available from step B — reconstruct pmlaWarning same as step A.
      const lateIdem = await tx.query<{ id: string }>(CHECK_PAYMENT_IDEM_SQL, [idempotencyKey, invoiceId, amountPaise]);
      if (lateIdem.rows[0]) {
        const lMonth = aggRes.rows[0]?.aggregate_month ?? istMonthStr(aggDateIST);
        const lSumRes = await tx.query<{ monthly_total: string }>(PMLA_MONTHLY_SUM_SQL, [lMonth, customerId ?? null, customerPhone ?? null]);
        const lCumulative = BigInt(lSumRes.rows[0]?.monthly_total ?? '0');
        const lPmlaStatus = getPmlaThresholdStatus(lCumulative);
        if (lPmlaStatus !== 'ok') {
          pmlaWarnFromRetry = { cumulativePaise: lCumulative.toString(), monthStr: lMonth, status: lPmlaStatus };
        }
        return;
      }

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
      // trackPmlaCumulative upserts the daily row (replacing old INCREMENT step)
      // and returns the post-payment monthly total + status.
      // Pre-payment status is inferred from (postTotal - amountPaise) to detect
      // the threshold CROSSING on this payment (avoids re-firing on every subsequent
      // payment once the customer is already in the warn band).
      pmlaResult = await trackPmlaCumulative(tx, {
        customerId:           customerId ?? null,
        customerPhone:        customerPhone ?? null,
        cashIncrementPaise:   amountPaise,
        transactionDateIST:   aggDateIST,      // P1b fix: same IST date as step C's lock
        incrementInvoiceCount: isFirstCashPayment, // P2 fix: count per invoice, not per installment
      });
      const prePaymentMonthlyPaise = pmlaResult.cumulativePaise - amountPaise;
      const prePmlaStatus = getPmlaThresholdStatus(prePaymentMonthlyPaise);
      // Fires on first crossing of Rs 8L warn threshold (ok→warn OR ok→block).
      // ok→block fires warn effects because Rs 8L WAS crossed; Story 5.6 adds
      // the separate block effects. Subsequent warn/block payments: prePmlaStatus
      // is not 'ok', so crossedWarnThreshold stays false (no duplicates).
      crossedWarnThreshold = prePmlaStatus === 'ok' && pmlaResult.status !== 'ok';

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
      // Only fires when THIS payment crosses the Rs 8L warn threshold (not on
      // subsequent payments that are already above Rs 8L). crossedWarnThreshold
      // is false when customer was already in warn band before this payment.
      if (crossedWarnThreshold && pmlaResult) {
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
              customerPhone:   customerPhone ?? null,
            }),
          ],
        );
      }
    });
    } catch (err) {
      if (err instanceof ComplianceHardBlockError && err.code === 'compliance.pmla_threshold_blocked') {
        caughtBlockErr = err;
      } else {
        throw err;
      }
    }

    // Audit the PMLA block in a separate tx (main tx rolled back).
    if (caughtBlockErr) {
      await auditLog(this.pool, {
        action:      AuditAction.PMLA_BLOCK_THRESHOLD_REACHED,
        subjectType: 'invoice',
        subjectId:   invoiceId,
        actorUserId: ctx.userId,
        after: {
          cumulativePaise: String(caughtBlockErr.meta['cumulativePaise'] ?? ''),
          month:           String(caughtBlockErr.meta['monthStr'] ?? ''),
        },
      });
      throw caughtBlockErr;
    }

    // TypeScript cannot track `let` variable mutations through async closures.
    // Snapshot with explicit annotation so post-commit checks resolve correctly.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const capturedPmla = pmlaResult as PmlaCumulativeResult | null;

    // ── Post-commit: async BullMQ job for PMLA notification ─────────────────
    // Enqueued AFTER the transaction commits so the job never fires for a rolled-back payment.
    // Fire-and-forget (void) — a queue failure must not fail the payment response.
    // crossedWarnThreshold: only enqueue on the payment that crosses Rs 8L, not on
    // every subsequent payment that is already in the warn band (avoids notification spam).
    if (crossedWarnThreshold && capturedPmla) {
      const job: PmlaCashThresholdWarningJob = {
        shopId:          ctx.shopId,
        customerId:      null, // Epic 6: customer identity TBD
        customerPhone:   null,
        cumulativePaise: capturedPmla.cumulativePaise.toString(),
        monthStr:        capturedPmla.monthStr,
      };
      void this.pmlaQueue.add('cash-threshold-warning', job).catch(() => undefined);
    }

    // On first crossing: return pmlaWarning with actual status ('warn' or 'block').
    // On idempotency retry: return pmlaWarnFromRetry reconstructed from current aggregate
    // (no duplicate audit event or BullMQ job — those were committed on first request).
    if (crossedWarnThreshold && capturedPmla) {
      return {
        pmlaWarning: {
          cumulativePaise: capturedPmla.cumulativePaise.toString(),
          monthStr:        capturedPmla.monthStr,
          status:          capturedPmla.status as 'warn' | 'block',
        },
      };
    }
    if (pmlaWarnFromRetry) {
      return { pmlaWarning: pmlaWarnFromRetry };
    }
    return {};
  }


  async initiateUpiPayment(ctx: AuthenticatedTenantContext, invoiceId: string, amountPaise: bigint): Promise<{ orderId: string }> {
    await withTenantTx(this.pool, async (tx) => {
      const inv = await tx.query<{ id: string; status: string; total_paise: string }>(
        `SELECT id, status, total_paise FROM invoices WHERE id = $1 FOR SHARE`,
        [invoiceId],
      );
      if (!inv.rows[0]) throw new NotFoundException({ code: 'invoice.not_found' });
      if (inv.rows[0].status !== 'ISSUED') throw new UnprocessableEntityException({ code: 'invoice.not_payable', status: inv.rows[0].status });
      const paidRes = await tx.query<{ paid: string }>(
        `SELECT COALESCE(SUM(amount_paise), 0)::text AS paid FROM payments WHERE invoice_id = $1 AND status = 'CONFIRMED'`,
        [invoiceId],
      );
      const paidPaise = BigInt(paidRes.rows[0]?.paid ?? '0');
      const remaining = BigInt(inv.rows[0].total_paise) - paidPaise;
      if (amountPaise > remaining) throw new UnprocessableEntityException({ code: 'payment.exceeds_balance' });
    });
    const receiptId = `inv_${invoiceId.slice(0, 8)}_${Date.now()}`;
    const result = await this.paymentsAdapter.createOrder({ amountPaise, currency: 'INR', receiptId, notes: { invoiceId, shopId: ctx.shopId } });
    const orderId = result.orderId;
    await withTenantTx(this.pool, async (tx) => {
      await tx.query(`INSERT INTO payments (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, razorpay_order_id, webhook_status) VALUES (current_setting('app.current_shop_id', true)::uuid, $1, 'UPI', $2, 'PENDING', $3, $4, 'PENDING')`, [invoiceId, amountPaise, ctx.userId, orderId]);
      await tx.query(`INSERT INTO audit_events (shop_id, actor_user_id, action, subject_type, subject_id, metadata) VALUES (current_setting('app.current_shop_id', true)::uuid, $1, $2, $3, $4, $5)`, [ctx.userId, AuditAction.PAYMENT_INITIATED, 'invoice', invoiceId, JSON.stringify({ orderId, amountPaise: amountPaise.toString() })]);
    });
    return { orderId };
  }

  async recordManualPayment(ctx: AuthenticatedTenantContext, invoiceId: string, dto: ManualPaymentDto): Promise<Payment> {
    let paymentId: string | undefined;
    await withTenantTx(this.pool, async (tx) => {
      const invRes = await tx.query<{ id: string; status: string; total_paise: string }>(`SELECT id, status, total_paise FROM invoices WHERE id = $1 FOR UPDATE`, [invoiceId]);
      if (!invRes.rows[0]) throw new NotFoundException({ code: 'invoice.not_found' });
      if (invRes.rows[0].status !== 'ISSUED') throw new UnprocessableEntityException({ code: 'invoice.not_payable', status: invRes.rows[0].status });
      const paidRes = await tx.query<{ paid: string }>(`SELECT COALESCE(SUM(amount_paise), 0)::text AS paid FROM payments WHERE invoice_id = $1 AND status = 'CONFIRMED'`, [invoiceId]);
      const paidPaise = BigInt(paidRes.rows[0]?.paid ?? '0');
      const remaining = BigInt(invRes.rows[0].total_paise) - paidPaise;
      if (dto.amountPaise > remaining) throw new UnprocessableEntityException({ code: 'payment.exceeds_balance' });
      const res = await tx.query<{ id: string }>(`INSERT INTO payments (shop_id, invoice_id, method, amount_paise, status, created_by_user_id, webhook_status) VALUES (current_setting('app.current_shop_id', true)::uuid, $1, $2, $3, 'CONFIRMED', $4, 'NA') RETURNING id`, [invoiceId, dto.method, dto.amountPaise, ctx.userId]);
      paymentId = res.rows[0]!.id;
      await tx.query(`INSERT INTO audit_events (shop_id, actor_user_id, action, subject_type, subject_id, metadata) VALUES (current_setting('app.current_shop_id', true)::uuid, $1, $2, $3, $4, $5)`, [ctx.userId, AuditAction.PAYMENT_RECORDED, 'invoice', invoiceId, JSON.stringify({ method: dto.method, amountPaise: dto.amountPaise.toString() })]);
    });
    return { id: paymentId!, invoiceId, shopId: ctx.shopId, method: dto.method, amountPaise: dto.amountPaise.toString(), status: 'CONFIRMED', webhookStatus: 'NA', recordedAt: new Date() };
  }

  // Confirms a payment received via Razorpay webhook.
  // Security design:
  //   1. shopId is NOT taken from the webhook payload. It is looked up from the DB
  //      using razorpay_order_id — the row was written at initiateUpiPayment time by
  //      the authenticated tenant. This prevents cross-tenant payment injection via
  //      attacker-controlled notes.shopId in the webhook body.
  //   2. All DML runs under tenant GUC (SET LOCAL app.current_shop_id) so RLS
  //      policies on payments and audit_events are enforced as a second fence.
  //   3. Redis NX lock deduplicates concurrent or repeated webhook deliveries.
  // shopIdFromNotes: the shop_id our server embedded in the Razorpay order notes
  // at initiateUpiPayment time. The webhook HMAC is verified before this is called
  // so the notes are trustworthy — we use shopIdFromNotes only to set the GUC for
  // the initial row lookup, then verify the found row's shop_id matches as a
  // second guard against cross-tenant injection.
  async confirmWebhookPayment(razorpayPaymentId: string, razorpayOrderId: string, shopIdFromNotes: string): Promise<void> {
    const redisKey = `payments:webhook:${razorpayPaymentId}`;

    // SET NX: only the first caller proceeds.
    const acquired = await this.redis.set(redisKey, '1', 'EX', WEBHOOK_IDEM_TTL_SEC, 'NX');
    if (!acquired) return;

    const client = await this.pool.connect();
    let paymentId: string;
    let invoiceId: string;
    let dbShopId: string;
    try {
      await client.query('BEGIN');
      // Use the notes-supplied shopId to arm RLS for the initial lookup.
      // This is safe because: (1) the webhook HMAC is verified before we reach
      // here, (2) shopIdFromNotes was set by OUR server at order-creation time.
      // We then validate the found row's shop_id equals shopIdFromNotes.
      // nosemgrep: goldsmith.no-raw-shop-id-param
      await client.query(`SET LOCAL app.current_shop_id = '${shopIdFromNotes}'`);
      const res = await client.query<{ id: string; invoice_id: string; shop_id: string }>(
        `SELECT id, invoice_id, shop_id
         FROM payments
         WHERE razorpay_order_id = $1
           AND status            = 'PENDING'
         LIMIT 1`,
        [razorpayOrderId],
      );
      if (!res.rows[0] || res.rows[0].shop_id !== shopIdFromNotes) {
        await client.query('ROLLBACK');
        client.release();
        await this.redis.del(redisKey);
        return;
      }
      ({ id: paymentId, invoice_id: invoiceId, shop_id: dbShopId } = res.rows[0]);
    } catch (lookupErr) {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
      await this.redis.del(redisKey);
      throw lookupErr;
    }

    try {
      // GUC already set to dbShopId from the BEGIN block; RLS is active.
      await client.query(`SET LOCAL app.current_shop_id = '${dbShopId}'`);
      await client.query(
        `UPDATE payments
         SET status              = 'CONFIRMED',
             webhook_status      = 'CAPTURED',
             razorpay_payment_id = $1,
             webhook_received_at = now()
         WHERE id = $2`,
        [razorpayPaymentId, paymentId],
      );
      await client.query(
        `INSERT INTO audit_events
           (shop_id, actor_user_id, action, subject_type, subject_id, metadata)
         VALUES (current_setting('app.current_shop_id', true)::uuid, NULL, $1, $2, $3, $4)`,
        [
          AuditAction.PAYMENT_RECORDED,
          'invoice',
          invoiceId,
          JSON.stringify({ source: 'razorpay_webhook', razorpayPaymentId, razorpayOrderId }),
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      // Release the lock so the worker can retry.
      await this.redis.del(redisKey);
      throw err;
    } finally {
      client.release();
    }
  }

  async listPayments(invoiceId: string): Promise<Payment[]> {
    const rows = await new Promise<Payment[]>((resolve, reject) => {
      withTenantTx(this.pool, async (tx) => {
        const res = await tx.query<{ id: string; invoice_id: string; shop_id: string; method: string; amount_paise: string; status: string; razorpay_order_id: string | null; razorpay_payment_id: string | null; webhook_status: string; recorded_at: Date; }>(`SELECT id, invoice_id, shop_id, method, amount_paise, status, razorpay_order_id, razorpay_payment_id, webhook_status, recorded_at FROM payments WHERE invoice_id = $1 ORDER BY recorded_at ASC`, [invoiceId]);
        resolve(res.rows.map(r => ({ id: r.id, invoiceId: r.invoice_id, shopId: r.shop_id, method: r.method, amountPaise: r.amount_paise, status: r.status, razorpayOrderId: r.razorpay_order_id ?? undefined, razorpayPaymentId: r.razorpay_payment_id ?? undefined, webhookStatus: r.webhook_status, recordedAt: r.recorded_at })));
      }).catch(reject);
    });
    return rows;
  }
}