import { getPmlaThresholdStatus } from './thresholds';
import type { PmlaThresholdStatus } from './thresholds';

export interface PmlaCumulativeResult {
  cumulativePaise: bigint;
  status:          PmlaThresholdStatus;
  monthStr:        string; // 'YYYY-MM' in IST
}

// Minimal DB client interface — satisfied by pg.PoolClient.
// Keeps packages/compliance free of a hard pg dependency.
interface DbClient {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

const IST_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Returns 'YYYY-MM-DD' in IST for the given Date.
export function istDateStr(date: Date): string {
  return IST_FORMAT.format(date); // sv-SE locale → 'YYYY-MM-DD'
}

// Returns 'YYYY-MM' in IST for the given Date.
export function istMonthStr(date: Date): string {
  return istDateStr(date).slice(0, 7);
}

// Call INSIDE an active withTenantTx after the 269ST check but BEFORE recording the payment.
// Atomically upserts the daily pmla_aggregates row (increment) and returns the monthly total.
// Does NOT throw on warn — caller decides what to do with status.
// Story 5.6 extends this: caller throws ComplianceHardBlockError on 'block'.
export async function trackPmlaCumulative(
  tx: DbClient,
  params: {
    customerId:             string | null;
    customerPhone:          string | null;
    cashIncrementPaise:     bigint;
    transactionDateIST:     Date;
    incrementInvoiceCount?: boolean; // default true; pass false for 2nd+ installment on same invoice
  },
): Promise<PmlaCumulativeResult> {
  const {
    customerId, customerPhone, cashIncrementPaise,
    transactionDateIST, incrementInvoiceCount = true,
  } = params;
  const dateStr  = istDateStr(transactionDateIST);
  const monthStr = dateStr.slice(0, 7);

  // Atomic upsert: create the daily row with cashIncrementPaise, or add to existing.
  // invoice_count is only incremented when this is the first cash payment for the invoice
  // so split payments (multiple installments) count as one invoice in the aggregate.
  await tx.query(
    `INSERT INTO pmla_aggregates
       (shop_id, customer_id, customer_phone, aggregate_date, aggregate_month,
        cash_total_paise, invoice_count)
     VALUES (
       current_setting('app.current_shop_id', true)::uuid,
       $1, $2, $3::date, $4,
       $5, $6
     )
     ON CONFLICT ON CONSTRAINT pmla_aggregates_unique
     DO UPDATE SET
       cash_total_paise = pmla_aggregates.cash_total_paise + EXCLUDED.cash_total_paise,
       invoice_count    = pmla_aggregates.invoice_count + EXCLUDED.invoice_count,
       updated_at       = now()`,
    [customerId, customerPhone, dateStr, monthStr, cashIncrementPaise,
     incrementInvoiceCount ? 1 : 0],
  );

  // Monthly SUM for the customer identity within this tenant.
  // Uses IS NOT DISTINCT FROM to handle NULLs correctly.
  const monthlyRes = await tx.query<{ monthly_total: string }>(
    `SELECT COALESCE(SUM(cash_total_paise), 0)::text AS monthly_total
     FROM pmla_aggregates
     WHERE aggregate_month = $1
       AND (customer_id IS NOT DISTINCT FROM $2::uuid)
       AND (customer_phone IS NOT DISTINCT FROM $3)`,
    [monthStr, customerId, customerPhone],
  );

  const cumulativePaise = BigInt(monthlyRes.rows[0]?.monthly_total ?? '0');
  return {
    cumulativePaise,
    status: getPmlaThresholdStatus(cumulativePaise),
    monthStr,
  };
}
