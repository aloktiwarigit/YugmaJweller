import { describe, expect, it } from 'vitest';
import { toCustomerLtvCsv, toDailySummaryCsv, toLoyaltySummaryCsv, toOutstandingCsv, toStockAgingCsv } from './reports.csv';
import type { CustomerLtvItem, DailySummaryResult, LoyaltySummaryResult, OutstandingResult, StockAgingResult } from './reports.service';

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

describe('toOutstandingCsv', () => {
  it('escapes commas in customer names and emits all rows', () => {
    const data: OutstandingResult = {
      total: 3, page: 1, limit: 100,
      items: [
        {
          id: 'inv-1', invoice_number: 'GS-2026-0001',
          customer_name: 'Sharma, Ramesh', customer_phone: '9876543210',
          total_paise: '100000', balance_due_paise: '50000',
          issued_at: '2026-04-01T10:00:00.000Z',
        },
        {
          id: 'inv-2', invoice_number: 'GS-2026-0002',
          customer_name: 'राज कुमार', customer_phone: null,
          total_paise: '200000', balance_due_paise: '200000',
          issued_at: '2026-04-02T14:30:00.000Z',
        },
        {
          id: 'inv-3', invoice_number: 'GS-2026-0003',
          customer_name: 'O"Brien', customer_phone: '9999999999',
          total_paise: '50000', balance_due_paise: '25000',
          issued_at: '2026-04-03T09:00:00.000Z',
        },
      ],
    };
    const csv = toOutstandingCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'Invoice Number,Customer Name,Customer Phone,Total (Rs),Balance Due (Rs),Issued At',
    );
    expect(lines[1]).toBe(
      'GS-2026-0001,"Sharma, Ramesh",9876543210,1000.00,500.00,2026-04-01T10:00:00.000Z',
    );
    expect(lines[2]).toBe(
      'GS-2026-0002,राज कुमार,,2000.00,2000.00,2026-04-02T14:30:00.000Z',
    );
    expect(lines[3]).toBe(
      'GS-2026-0003,"O""Brien",9999999999,500.00,250.00,2026-04-03T09:00:00.000Z',
    );
  });

  it('emits header only when no items', () => {
    const data: OutstandingResult = { total: 0, page: 1, limit: 100, items: [] };
    expect(toOutstandingCsv(data).split('\r\n')).toHaveLength(1);
  });

  it('neutralizes Excel formula injection in customer names', () => {
    const data: OutstandingResult = {
      total: 1, page: 1, limit: 100,
      items: [{
        id: 'i1', invoice_number: 'GS-2026-0099',
        customer_name: '=HYPERLINK("https://evil","Click")',
        customer_phone: '9876543210',
        total_paise: '100000', balance_due_paise: '50000',
        issued_at: '2026-04-01T10:00:00.000Z',
      }],
    };
    const csv = toOutstandingCsv(data);
    const lines = csv.split('\r\n');
    // Cell starts with =, must be prefixed with ' AND quoted (because it contains comma + quotes).
    // Result: the leading ' makes Excel treat the rest as text, neutralizing the formula.
    expect(lines[1]).toContain(`"'=HYPERLINK(""https://evil"",""Click"")"`);
  });
});

describe('toCustomerLtvCsv', () => {
  it('emits header + data rows sorted by descending LTV (input order preserved)', () => {
    const data: CustomerLtvItem[] = [
      { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
      { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
    ];
    const csv = toCustomerLtvCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Customer ID,Name,Phone,Lifetime Value (Rs)');
    expect(lines[1]).toBe('c1,रमेश सिंह,9900000001,20000.00');
    expect(lines[2]).toBe('c2,सुमन देवी,9900000002,15000.00');
  });

  it('emits header only when no customers', () => {
    expect(toCustomerLtvCsv([]).split('\r\n')).toHaveLength(1);
  });
});

describe('toLoyaltySummaryCsv', () => {
  it('emits a 2-section CSV: totals header+row, blank line, per-tier breakdown', () => {
    const data: LoyaltySummaryResult = {
      points_issued: 5000,
      points_redeemed: 1200,
      members_by_tier: [
        { tier: 'GOLD',   count: 12 },
        { tier: 'SILVER', count: 8  },
        { tier: null,     count: 3  },
      ],
    };
    const csv = toLoyaltySummaryCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Points Issued,Points Redeemed,Net Points');
    expect(lines[1]).toBe('5000,1200,3800');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('Tier,Member Count');
    expect(lines[4]).toBe('GOLD,12');
    expect(lines[5]).toBe('SILVER,8');
    expect(lines[6]).toBe('UNTIERED,3');
  });

  it('emits empty tier list cleanly', () => {
    const data: LoyaltySummaryResult = {
      points_issued: 0, points_redeemed: 0, members_by_tier: [],
    };
    const csv = toLoyaltySummaryCsv(data);
    const lines = csv.split('\r\n');
    expect(lines).toEqual([
      'Points Issued,Points Redeemed,Net Points',
      '0,0,0',
      '',
      'Tier,Member Count',
    ]);
  });
});

describe('toStockAgingCsv', () => {
  it('emits item-level CSV with bucket label and null cost as empty', () => {
    const data: StockAgingResult = {
      buckets: [], // unused by CSV
      items: [
        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
          weightG: '5.000', daysInStock: 10, bucket: '<30d',
          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
        { id: 'p2', sku: 'C-002', metal: 'GOLD', purity: '22K',
          weightG: '4.000', daysInStock: 75, bucket: '60-90d',
          costPaise: null, firstListedAt: '2026-02-15T00:00:00.000Z' },
      ],
    };
    const csv = toStockAgingCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'SKU,Metal,Purity,Weight (g),Days in Stock,Age Bucket,Cost (Rs),First Listed',
    );
    expect(lines[1]).toBe('R-001,GOLD,22K,5.000,10,<30d,50000.00,2026-04-15T00:00:00.000Z');
    expect(lines[2]).toBe('C-002,GOLD,22K,4.000,75,60-90d,,2026-02-15T00:00:00.000Z');
  });

  it('emits header only when no items', () => {
    const data: StockAgingResult = { buckets: [], items: [] };
    expect(toStockAgingCsv(data).split('\r\n')).toHaveLength(1);
  });

  it('renders zero-cost item as 0.00, not blank', () => {
    const data: StockAgingResult = {
      buckets: [],
      items: [
        { id: 'p3', sku: 'Z-001', metal: 'GOLD', purity: '22K',
          weightG: '1.000', daysInStock: 5, bucket: '<30d',
          costPaise: '0', firstListedAt: '2026-05-01T00:00:00.000Z' },
      ],
    };
    const lines = toStockAgingCsv(data).split('\r\n');
    expect(lines[1]).toBe('Z-001,GOLD,22K,1.000,5,<30d,0.00,2026-05-01T00:00:00.000Z');
  });
});
