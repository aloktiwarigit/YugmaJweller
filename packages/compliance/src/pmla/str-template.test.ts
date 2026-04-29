import { describe, it, expect } from 'vitest';
import { buildStrDocument, renderStrText } from './str-template';

const FULL_INPUT = {
  shopId:                    'shop-uuid-001',
  shopName:                  'रामजी ज्वेलर्स',
  shopAddress:               '12, सोना बाज़ार, अयोध्या, UP 224001',
  shopGstin:                 '09ABCDE1234F1Z5',
  reportingOfficerName:      'राकेश कुमार',
  suspiciousTransactionDate: new Date('2026-04-15T00:00:00Z'),
  transactionAmountPaise:    5_00_00_000n, // Rs 5 lakh
  transactionNature:         'Cash purchase with structured payments below threshold',
  customerName:              'अज्ञात व्यक्ति',
  customerAddress:           'N/A',
  basisOfSuspicion:          'Customer refused to provide identification and paid in multiple small cash instalments.',
  actionsTaken:              'Transaction recorded. Customer ID requested but refused. Reported to compliance officer.',
  reportDate:                new Date('2026-04-20T00:00:00Z'),
};

describe('buildStrDocument', () => {
  it('builds document with all required fields present in output', () => {
    const doc = buildStrDocument(FULL_INPUT);

    expect(doc.shopId).toBe(FULL_INPUT.shopId);
    expect(doc.shopName).toBe(FULL_INPUT.shopName);
    expect(doc.shopAddress).toBe(FULL_INPUT.shopAddress);
    expect(doc.shopGstin).toBe(FULL_INPUT.shopGstin);
    expect(doc.reportingOfficerName).toBe(FULL_INPUT.reportingOfficerName);
    expect(doc.transactionAmountPaise).toBe(FULL_INPUT.transactionAmountPaise);
    expect(doc.transactionNature).toBe(FULL_INPUT.transactionNature);
    expect(doc.customerName).toBe(FULL_INPUT.customerName);
    expect(doc.customerAddress).toBe(FULL_INPUT.customerAddress);
    expect(doc.basisOfSuspicion).toBe(FULL_INPUT.basisOfSuspicion);
    expect(doc.actionsTaken).toBe(FULL_INPUT.actionsTaken);
    expect(doc.reportDate).toBe(FULL_INPUT.reportDate);
    expect(doc.suspiciousTransactionDate).toBe(FULL_INPUT.suspiciousTransactionDate);
    expect(doc.customerPan).toBeNull();
    expect(doc.generatedAt).toBeInstanceOf(Date);
  });

  it('customerPan is null when not provided', () => {
    const doc = buildStrDocument({ ...FULL_INPUT });
    expect(doc.customerPan).toBeNull();
  });

  it('customerPan is populated when provided', () => {
    const doc = buildStrDocument({ ...FULL_INPUT, customerPan: 'ABCDE1234F' });
    expect(doc.customerPan).toBe('ABCDE1234F');
  });

  it('generatedAt is a valid recent Date', () => {
    const before = new Date();
    const doc = buildStrDocument(FULL_INPUT);
    const after = new Date();
    expect(doc.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(doc.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('renderStrText', () => {
  it('output contains shopName, customerName, basisOfSuspicion', () => {
    const doc = buildStrDocument(FULL_INPUT);
    const text = renderStrText(doc);

    expect(text).toContain('रामजी ज्वेलर्स');
    expect(text).toContain('अज्ञात व्यक्ति');
    expect(text).toContain('Customer refused to provide identification');
  });

  it('output contains FIU-IND and STR header', () => {
    const doc = buildStrDocument(FULL_INPUT);
    const text = renderStrText(doc);
    expect(text).toContain('FIU-IND');
    expect(text).toContain('SUSPICIOUS TRANSACTION REPORT');
  });

  it('null PAN shows "Not on file"', () => {
    const doc = buildStrDocument(FULL_INPUT);
    const text = renderStrText(doc);
    expect(text).toContain('Not on file');
  });

  it('renders amount in rupees from paise', () => {
    const doc = buildStrDocument({ ...FULL_INPUT, transactionAmountPaise: 10_000_000n }); // Rs 1 lakh
    const text = renderStrText(doc);
    expect(text).toContain('Rs 100000.00');
  });

  it('filing instructions mention 7 working days', () => {
    const doc = buildStrDocument(FULL_INPUT);
    const text = renderStrText(doc);
    expect(text).toContain('7 working days');
  });

  it('provided PAN appears in output', () => {
    const doc = buildStrDocument({ ...FULL_INPUT, customerPan: 'XYZAB9876C' });
    const text = renderStrText(doc);
    expect(text).toContain('XYZAB9876C');
  });
});
