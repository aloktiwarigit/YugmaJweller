import type { DailySummaryResult } from './reports.service';
// Note: B2-B5 will each extend this import to add OutstandingResult,
// CustomerLtvItem, LoyaltySummaryResult, StockAgingResult as their emitters land.
// Pulling them all in now would trip TS6196 (noUnusedLocals).

// Shared helpers — duplicated locally rather than extracted to packages/shared per
// YAGNI; if a third caller appears, hoist these into @goldsmith/shared.
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
