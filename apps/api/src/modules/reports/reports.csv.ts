import type { CustomerLtvItem, DailySummaryResult, OutstandingResult } from './reports.service';
// Note: B4-B5 will each extend this import to add
// LoyaltySummaryResult, StockAgingResult as their emitters land.
// Pulling them all in now would trip TS6196 (noUnusedLocals).

// Shared helpers — duplicated locally rather than extracted to packages/shared per
// YAGNI; if a third caller appears, hoist these into @goldsmith/shared.
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Accepts string|number (gstr-export.service.ts accepts string[] only — reconcile on hoist to @goldsmith/shared).
function csvRow(cells: (string | number)[]): string {
  return cells.map((c) => escapeCsv(String(c))).join(',');
}

function paiseToRupees(paise: bigint | string | number): string {
  return (Number(paise) / 100).toFixed(2);
}

function mgToGrams(mg: bigint | string | number): string {
  return (Number(mg) / 1000).toFixed(3);
}

const LE = '\r\n'; // Excel-friendly

export function toDailySummaryCsv(data: DailySummaryResult): string {
  const header = csvRow([
    'Date', 'Total (Rs)', 'Cash (Rs)', 'UPI (Rs)', 'Other (Rs)',
    'Invoice Count', 'Gold Sold (g)',
  ]);
  const row = csvRow([
    data.date,
    paiseToRupees(data.total_paise),
    paiseToRupees(data.cash_paise),
    paiseToRupees(data.upi_paise),
    paiseToRupees(data.other_paise),
    data.invoice_count,
    mgToGrams(data.gold_weight_mg),
  ]);
  return [header, row].join(LE);
}

export function toOutstandingCsv(data: OutstandingResult): string {
  const header = csvRow([
    'Invoice Number', 'Customer Name', 'Customer Phone',
    'Total (Rs)', 'Balance Due (Rs)', 'Issued At',
  ]);
  const rows = data.items.map((it) =>
    csvRow([
      it.invoice_number,
      it.customer_name,
      it.customer_phone ?? '',
      paiseToRupees(it.total_paise),
      paiseToRupees(it.balance_due_paise),
      it.issued_at ?? '',
    ]),
  );
  return [header, ...rows].join(LE);
}

export function toCustomerLtvCsv(items: CustomerLtvItem[]): string {
  const header = csvRow(['Customer ID', 'Name', 'Phone', 'Lifetime Value (Rs)']);
  const rows = items.map((c) =>
    csvRow([c.customer_id, c.name, c.phone, paiseToRupees(c.ltv_paise)]),
  );
  return [header, ...rows].join(LE);
}
