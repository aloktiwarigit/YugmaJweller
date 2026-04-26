import { describe, it, expect } from 'vitest';
import { buildCtrDocument, renderCtrText } from './ctr-template';

describe('buildCtrDocument', () => {
  it('computes totalCashPaise as sum of transactions', () => {
    const doc = buildCtrDocument({
      shop:     { gstin: '09ABCDE1234F1Z5', name: 'रामजी ज्वेलर्स' },
      customer: { name: 'सुनीता देवी', phone: '9876543210', panDecrypted: 'ABCDE1234F' },
      monthStr: '2026-04',
      transactions: [
        { date: '2026-04-10', amountPaise: 5_000_000n, invoiceNumber: 'INV-001' },
        { date: '2026-04-20', amountPaise: 5_000_000n, invoiceNumber: 'INV-002' },
      ],
    });

    expect(doc.totalCashPaise).toBe(10_000_000n);
    expect(doc.shopGstin).toBe('09ABCDE1234F1Z5');
    expect(doc.shopName).toBe('रामजी ज्वेलर्स');
    expect(doc.customerName).toBe('सुनीता देवी');
    expect(doc.customerPhone).toBe('9876543210');
    expect(doc.customerPan).toBe('ABCDE1234F');
    expect(doc.monthStr).toBe('2026-04');
    expect(doc.transactions).toHaveLength(2);
  });

  it('handles null PAN gracefully', () => {
    const doc = buildCtrDocument({
      shop:     { gstin: 'N/A', name: 'Test Shop' },
      customer: { name: 'Walk-in', phone: '9999999999', panDecrypted: null },
      monthStr: '2026-04',
      transactions: [],
    });

    expect(doc.customerPan).toBeNull();
    expect(doc.totalCashPaise).toBe(0n);
  });

  it('zero transactions → zero total', () => {
    const doc = buildCtrDocument({
      shop:     { gstin: 'TEST', name: 'Shop' },
      customer: { name: 'Customer', phone: '0000000000', panDecrypted: null },
      monthStr: '2026-01',
      transactions: [],
    });
    expect(doc.totalCashPaise).toBe(0n);
  });

  it('generatedAt is a valid Date', () => {
    const before = new Date();
    const doc = buildCtrDocument({
      shop:     { gstin: 'X', name: 'Y' },
      customer: { name: 'Z', phone: '1234567890', panDecrypted: null },
      monthStr: '2026-01',
      transactions: [],
    });
    const after = new Date();
    expect(doc.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(doc.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('renderCtrText', () => {
  it('output contains shop name and GSTIN', () => {
    const doc = buildCtrDocument({
      shop:     { gstin: '09ABCDE1234F1Z5', name: 'रामजी ज्वेलर्स' },
      customer: { name: 'सुनीता देवी', phone: '9876543210', panDecrypted: 'ABCDE1234F' },
      monthStr: '2026-04',
      transactions: [
        { date: '2026-04-10', amountPaise: 10_000_000n, invoiceNumber: 'INV-001' },
      ],
    });
    const text = renderCtrText(doc);

    expect(text).toContain('रामजी ज्वेलर्स');
    expect(text).toContain('09ABCDE1234F1Z5');
    expect(text).toContain('सुनीता देवी');
    expect(text).toContain('9876543210');
    expect(text).toContain('ABCDE1234F');
    expect(text).toContain('2026-04');
    expect(text).toContain('Rs 100000.00'); // Rs 10L formatted
    expect(text).toContain('INV-001');
    expect(text).toContain('FIU-IND');
  });

  it('null PAN shows "Not on file"', () => {
    const doc = buildCtrDocument({
      shop:     { gstin: 'TEST', name: 'Shop' },
      customer: { name: 'Customer', phone: '1234567890', panDecrypted: null },
      monthStr: '2026-04',
      transactions: [],
    });
    const text = renderCtrText(doc);
    expect(text).toContain('Not on file');
  });

  it('total matches sum of transactions', () => {
    const doc = buildCtrDocument({
      shop:     { gstin: 'X', name: 'Y' },
      customer: { name: 'Z', phone: '0000000000', panDecrypted: null },
      monthStr: '2026-04',
      transactions: [
        { date: '2026-04-01', amountPaise: 5_000_000n, invoiceNumber: 'A' },
        { date: '2026-04-15', amountPaise: 5_000_000n, invoiceNumber: 'B' },
      ],
    });
    const text = renderCtrText(doc);
    expect(text).toContain('Rs 100000.00'); // total: Rs 10L
  });
});
