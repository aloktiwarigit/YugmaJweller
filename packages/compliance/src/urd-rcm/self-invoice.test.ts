import { describe, it, expect } from 'vitest';
import { buildUrdSelfInvoice, RCM_RATE_BP } from './self-invoice';

const BASE = {
  shopName: 'श्री सोनम ज्वैलर्स',
  shopGstin: '09AABCS1429B1ZX',
  customerName: 'राम कुमार',
  customerPhone: '+919876543210' as string | null,
  metalType: 'GOLD', purity: '22K', weightG: '15.0000',
  agreedRatePaise: 600000n,
  invoiceDate: new Date('2026-04-26T10:00:00Z'),
  invoiceNumber: 'URD-AABBCC-20260426-XYZABC',
};

describe('RCM_RATE_BP', () => {
  it('is 300', () => { expect(RCM_RATE_BP).toBe(300); });
});

describe('golden example (15g x 600000 paise/g = Rs 90,000)', () => {
  it('goldValuePaise = 9_000_000', () => { expect(buildUrdSelfInvoice(BASE).goldValuePaise).toBe(9_000_000n); });
  it('rcmGstPaise = 270_000 (3% of 9000000)', () => { expect(buildUrdSelfInvoice(BASE).rcmGstPaise).toBe(270_000n); });
  it('netToCustomerPaise = 8_730_000', () => { expect(buildUrdSelfInvoice(BASE).netToCustomerPaise).toBe(8_730_000n); });
  it('conservation: gold = rcm + net', () => {
    const { goldValuePaise: g, rcmGstPaise: r, netToCustomerPaise: n } = buildUrdSelfInvoice(BASE);
    expect(g).toBe(r + n);
  });
});

describe('weight precision', () => {
  it('0.0001 g -> goldValue = 60', () => {
    expect(buildUrdSelfInvoice({...BASE, weightG:'0.0001', agreedRatePaise:600000n}).goldValuePaise).toBe(60n);
  });
  it('1.0001 g -> goldValue = 600060', () => {
    expect(buildUrdSelfInvoice({...BASE, weightG:'1.0001', agreedRatePaise:600000n}).goldValuePaise).toBe(600060n);
  });
  it('floors fractional paise', () => {
    expect(buildUrdSelfInvoice({...BASE, weightG:'0.0003', agreedRatePaise:100001n}).goldValuePaise).toBe(30n);
  });
});

describe('zero/invalid weight throws', () => {
  it('zero', () => { expect(() => buildUrdSelfInvoice({...BASE, weightG:'0'})).toThrow(RangeError); });
  it('negative', () => { expect(() => buildUrdSelfInvoice({...BASE, weightG:'-1'})).toThrow(RangeError); });
  it('non-numeric', () => { expect(() => buildUrdSelfInvoice({...BASE, weightG:'abc'})).toThrow(RangeError); });
});

describe('RCM floor division', () => {
  it('100p gold -> rcm = 3n (floor 3.0)', () => {
    const r = buildUrdSelfInvoice({...BASE, weightG:'0.0001', agreedRatePaise:1000000n});
    expect(r.goldValuePaise).toBe(100n); expect(r.rcmGstPaise).toBe(3n);
  });
  it('1p gold -> rcm = 0n', () => {
    const r = buildUrdSelfInvoice({...BASE, weightG:'0.0001', agreedRatePaise:10000n});
    expect(r.goldValuePaise).toBe(1n); expect(r.rcmGstPaise).toBe(0n);
  });
});

describe('self-invoice text', () => {
  const r = buildUrdSelfInvoice(BASE);
  it('has REVERSE CHARGE', () => { expect(r.selfInvoiceText).toContain('REVERSE CHARGE'); });
  it('has GSTIN', () => { expect(r.selfInvoiceText).toContain(BASE.shopGstin); });
  it('has shop name', () => { expect(r.selfInvoiceText).toContain(BASE.shopName); });
  it('has customer name', () => { expect(r.selfInvoiceText).toContain(BASE.customerName); });
  it('has phone', () => { expect(r.selfInvoiceText).toContain(BASE.customerPhone); });
  it('has invoice number', () => { expect(r.selfInvoiceText).toContain(BASE.invoiceNumber); });
  it('has Unregistered', () => { expect(r.selfInvoiceText.toLowerCase()).toContain('unregistered'); });
  it('has 3%', () => { expect(r.selfInvoiceText).toContain('3%'); });
  it('null phone ok', () => { expect(buildUrdSelfInvoice({...BASE, customerPhone:null}).selfInvoiceText).toContain(BASE.shopGstin); });
});

describe('compliance invariants', () => {
  it('customer receives less than gold value', () => {
    const r = buildUrdSelfInvoice(BASE);
    expect(r.netToCustomerPaise).toBeLessThan(r.goldValuePaise);
  });
});

describe('10K weight-precision harness', () => {
  it('paise-exact 0.0001..1.0000', () => {
    for (let i = 1; i <= 10000; i++) {
      const w = (i * 0.0001).toFixed(4);
      const r = buildUrdSelfInvoice({...BASE, weightG:w, agreedRatePaise:600000n});
      const gRef = BigInt(Math.floor(i * 0.0001 * 600000));
      const rcmRef = (gRef * 300n) / 10000n;
      expect(r.goldValuePaise).toBe(gRef);
      expect(r.rcmGstPaise).toBe(rcmRef);
      expect(r.netToCustomerPaise).toBe(gRef - rcmRef);
    }
  });
});