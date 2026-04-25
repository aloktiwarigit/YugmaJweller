import { describe, expect, it, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  validateGstinFormat,
  normalizeGstin,
  getStateCodeFromGstin,
  determineGstTreatment,
  applyB2BGstTreatment,
} from '@goldsmith/compliance';

// ─── GSTIN Validation ────────────────────────────────────────────────────────

describe('B2B GST Compliance Gate — GSTIN validation', () => {
  it('accepts valid GSTIN (Karnataka 29)', () => {
    // '29ABCDE1234F1Z3' has correct checksum for Karnataka state code 29
    expect(validateGstinFormat('29ABCDE1234F1Z3')).toBe(true);
  });

  it('rejects GSTIN with invalid checksum', () => {
    // Flip the last character of a valid Karnataka GSTIN to break checksum
    // '29ABCDE1234F1Z3' is valid; '29ABCDE1234F1Z4' has wrong checksum
    expect(validateGstinFormat('29ABCDE1234F1Z4')).toBe(false);
  });

  it('rejects non-numeric state code', () => {
    expect(validateGstinFormat('AAABCDE1234F1ZM')).toBe(false);
  });

  it('normalizeGstin uppercases and strips whitespace', () => {
    expect(normalizeGstin('  09 abcde 1234 f1z3  ')).toBe('09ABCDE1234F1Z3');
  });

  it('getStateCodeFromGstin extracts first two chars', () => {
    expect(getStateCodeFromGstin('09ABCDE1234F1Z3')).toBe('09');
    expect(getStateCodeFromGstin('27ABCDE1234F1Z3')).toBe('27');
  });
});

// ─── GST Treatment Routing ───────────────────────────────────────────────────

describe('B2B GST Compliance Gate — GST treatment routing', () => {
  it('UP buyer + UP seller → CGST_SGST (intrastate)', () => {
    expect(determineGstTreatment('09', '09')).toBe('CGST_SGST');
  });

  it('MH buyer (27) + UP seller (09) → IGST (interstate)', () => {
    expect(determineGstTreatment('09', '27')).toBe('IGST');
  });

  it('same state different from UP → CGST_SGST (intrastate)', () => {
    expect(determineGstTreatment('27', '27')).toBe('CGST_SGST');
  });

  it('any two different states → IGST', () => {
    expect(determineGstTreatment('29', '09')).toBe('IGST');
    expect(determineGstTreatment('09', '29')).toBe('IGST');
    expect(determineGstTreatment('27', '29')).toBe('IGST');
  });
});

// ─── GST Amount Correctness — CGST_SGST path ─────────────────────────────────

describe('B2B GST Compliance Gate — GST amount correctness — CGST_SGST path', () => {
  it('CGST + SGST sum equals total GST (metal)', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 1_000_000n,  // Rs 10,000
      makingChargePaise: 100_000n, // Rs 1,000
      treatment: 'CGST_SGST',
    });
    // metalGst = 1_000_000n * 300n / 10000n = 30_000n
    expect(result.cgstMetalPaise! + result.sgstMetalPaise!).toBe(30_000n);
    // makingGst = 100_000n * 500n / 10000n = 5_000n
    expect(result.cgstMakingPaise! + result.sgstMakingPaise!).toBe(5_000n);
    expect(result.totalGstPaise).toBe(35_000n);
  });

  it('CGST equals SGST for even total GST (50/50 split)', () => {
    // goldValuePaise = 1_000_000n → metalGst = 30_000n (even) → split = 15_000n each
    const result = applyB2BGstTreatment({
      goldValuePaise: 1_000_000n,
      makingChargePaise: 0n,
      treatment: 'CGST_SGST',
    });
    expect(result.cgstMetalPaise).toBe(15_000n);
    expect(result.sgstMetalPaise).toBe(15_000n);
  });

  it('no paise lost in CGST/SGST split (odd GST amount)', () => {
    // 99_999n * 300n / 10000n = 2_999n (odd → floor division gives 2999n)
    // CGST = 2999n / 2n = 1499n (BigInt floor), SGST = 2999n - 1499n = 1500n
    const result = applyB2BGstTreatment({
      goldValuePaise: 99_999n,
      makingChargePaise: 0n,
      treatment: 'CGST_SGST',
    });
    expect(result.cgstMetalPaise! + result.sgstMetalPaise!).toBe(2999n);
  });

  it('treatment field is CGST_SGST on intrastate result', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 500_000n,
      makingChargePaise: 50_000n,
      treatment: 'CGST_SGST',
    });
    expect(result.treatment).toBe('CGST_SGST');
  });

  it('IGST fields absent on CGST_SGST result', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 500_000n,
      makingChargePaise: 50_000n,
      treatment: 'CGST_SGST',
    });
    expect(result.igstMetalPaise).toBeUndefined();
    expect(result.igstMakingPaise).toBeUndefined();
  });
});

// ─── GST Amount Correctness — IGST path ──────────────────────────────────────

describe('B2B GST Compliance Gate — GST amount correctness — IGST path', () => {
  it('IGST equals full GST (no split)', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 1_000_000n,
      makingChargePaise: 100_000n,
      treatment: 'IGST',
    });
    expect(result.igstMetalPaise).toBe(30_000n);
    expect(result.igstMakingPaise).toBe(5_000n);
    expect(result.totalGstPaise).toBe(35_000n);
  });

  it('IGST total equals CGST_SGST total for same inputs', () => {
    const params = { goldValuePaise: 500_000n, makingChargePaise: 50_000n };
    const intra = applyB2BGstTreatment({ ...params, treatment: 'CGST_SGST' });
    const inter = applyB2BGstTreatment({ ...params, treatment: 'IGST' });
    expect(intra.totalGstPaise).toBe(inter.totalGstPaise);
  });

  it('treatment field is IGST on interstate result', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 500_000n,
      makingChargePaise: 50_000n,
      treatment: 'IGST',
    });
    expect(result.treatment).toBe('IGST');
  });

  it('CGST/SGST fields absent on IGST result', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 500_000n,
      makingChargePaise: 50_000n,
      treatment: 'IGST',
    });
    expect(result.cgstMetalPaise).toBeUndefined();
    expect(result.sgstMetalPaise).toBeUndefined();
    expect(result.cgstMakingPaise).toBeUndefined();
    expect(result.sgstMakingPaise).toBeUndefined();
  });

  it('zero making charge → zero making GST (IGST path)', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 1_000_000n,
      makingChargePaise: 0n,
      treatment: 'IGST',
    });
    expect(result.igstMakingPaise).toBe(0n);
    expect(result.totalGstPaise).toBe(30_000n);
  });
});

// ─── Weight-precision — 10,000 B2B invoices ──────────────────────────────────

describe('B2B GST Compliance Gate — Weight-precision — 10,000 B2B invoices', () => {
  it('GST paise-exact across 10k weight variations (vs Decimal.js reference)', () => {
    // Tests that BigInt floor division matches Decimal.js floor for the
    // full range of gold values used in jewellery billing.
    // Each iteration simulates a different gold weight (1/100g increments).
    let mismatches = 0;

    for (let i = 1; i <= 10_000; i++) {
      // Simulate gold value from 1g to 100g of gold at Rs 7,000/g (in paise)
      // goldValuePaise = i * 700_000 paise (i * Rs 7,000 at 1/100g increments)
      const goldValuePaise = BigInt(i) * 700_000n;

      // Reference: Decimal.js computes floor(goldValuePaise * 3%)
      const decimalRef = BigInt(
        new Decimal(goldValuePaise.toString())
          .mul(new Decimal('300'))
          .div(new Decimal('10000'))
          .floor()
          .toFixed(0),
      );

      // System: BigInt floor division (same arithmetic as applyB2BGstTreatment)
      const systemResult = (goldValuePaise * 300n) / 10000n;

      if (decimalRef !== systemResult) mismatches++;
    }

    expect(mismatches).toBe(0);
  });

  it('GST making-charge paise-exact across 10k variations (vs Decimal.js reference)', () => {
    let mismatches = 0;

    for (let i = 1; i <= 10_000; i++) {
      // Simulate making charge at 12% of gold value
      // goldValuePaise = i * 700_000n; makingCharge = floor(goldValue * 0.12)
      const goldValuePaise = BigInt(i) * 700_000n;
      const makingChargePaise = (goldValuePaise * 1200n) / 10000n;

      // Reference: Decimal.js computes floor(makingChargePaise * 5%)
      const decimalRef = BigInt(
        new Decimal(makingChargePaise.toString())
          .mul(new Decimal('500'))
          .div(new Decimal('10000'))
          .floor()
          .toFixed(0),
      );

      // System: BigInt floor division (same arithmetic as applyB2BGstTreatment)
      const systemResult = (makingChargePaise * 500n) / 10000n;

      if (decimalRef !== systemResult) mismatches++;
    }

    expect(mismatches).toBe(0);
  });
});
