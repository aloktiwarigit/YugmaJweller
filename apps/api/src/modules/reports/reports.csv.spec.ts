import { describe, expect, it } from 'vitest';
import { toCustomerLtvCsv, toDailySummaryCsv, toOutstandingCsv } from './reports.csv';
import type { CustomerLtvItem, DailySummaryResult, OutstandingResult } from './reports.service';

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
