import type { CustomerLtvItem, DailySummaryResult, LoyaltySummaryResult, OutstandingResult, StockAgingResult } from './reports.service';

// Shared helpers — duplicated locally rather than extracted to packages/shared per
// YAGNI; if a third caller appears, hoist these into @goldsmith/shared.
function escapeCsv(value: string): string {
  // Block Excel/Sheets formula injection: prepend single quote when the cell
  // starts with =, +, -, @, \t, or \r so spreadsheet apps treat it as text.
  // Without this guard, a hostile customer_name like =HYPERLINK(...) in
  // outstanding.csv would silently exfiltrate adjacent financial cells.
  let v = value;
  if (v.length > 0 && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
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

export function toLoyaltySummaryCsv(data: LoyaltySummaryResult): string {
  const totalsHeader = csvRow(['Points Issued', 'Points Redeemed', 'Net Points']);
  const totalsRow = csvRow([
    data.points_issued,
    data.points_redeemed,
    data.points_issued - data.points_redeemed,
  ]);
  const tierHeader = csvRow(['Tier', 'Member Count']);
  const tierRows = data.members_by_tier.map((t) =>
    csvRow([t.tier ?? 'UNTIERED', t.count]),
  );
  return [totalsHeader, totalsRow, '', tierHeader, ...tierRows].join(LE);
}

export function toStockAgingCsv(data: StockAgingResult): string {
  const header = csvRow([
    'SKU', 'Metal', 'Purity', 'Weight (g)',
    'Days in Stock', 'Age Bucket', 'Cost (Rs)', 'First Listed',
  ]);
  const rows = data.items.map((it) =>
    csvRow([
      it.sku,
      it.metal,
      it.purity,
      it.weightG,
      it.daysInStock,
      it.bucket,
      // === null intentional: costPaise is string|null; ?? '' would render '0' as blank
      it.costPaise === null ? '' : paiseToRupees(it.costPaise),
      it.firstListedAt,
    ]),
  );
  return [header, ...rows].join(LE);
}
