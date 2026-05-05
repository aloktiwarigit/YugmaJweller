import { describe, expect, it } from 'vitest';
import { toDailySummaryCsv } from './reports.csv';
import type { DailySummaryResult } from './reports.service';

describe('toDailySummaryCsv', () => {
  it('emits header + one data row with paise→rupees conversion', () => {
    const data: DailySummaryResult = {
      date: '2026-04-29',
      total_paise:    '500000',
      cash_paise:     '300000',
      upi_paise:      '200000',
      other_paise:    '0',
      invoice_count:  3,
      gold_weight_mg: '15000',
    };

    const csv = toDailySummaryCsv(data);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe(
      'Date,Total (Rs),Cash (Rs),UPI (Rs),Other (Rs),Invoice Count,Gold Sold (g)',
    );
    expect(lines[1]).toBe('2026-04-29,5000.00,3000.00,2000.00,0.00,3,15.000');
    expect(lines).toHaveLength(2);
  });

  it('emits zeros when no invoices', () => {
    const data: DailySummaryResult = {
      date: '2026-04-01',
      total_paise: '0', cash_paise: '0', upi_paise: '0', other_paise: '0',
      invoice_count: 0, gold_weight_mg: '0',
    };
    const csv = toDailySummaryCsv(data);
    expect(csv.split('\r\n')[1]).toBe('2026-04-01,0.00,0.00,0.00,0.00,0,0.000');
  });
});
