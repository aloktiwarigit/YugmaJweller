import { describe, it, expect } from 'vitest';
import {
  determineGstTreatment,
  applyB2BGstTreatment,
  type B2BGstBreakdown,
} from './b2b-treatment';

describe('determineGstTreatment', () => {
  it('returns CGST_SGST for same state code', () => {
    const result = determineGstTreatment('27', '27');
    expect(result).toBe('CGST_SGST');
  });

  it('returns IGST for different state codes', () => {
    const result = determineGstTreatment('27', '24');
    expect(result).toBe('IGST');
  });

  it('returns IGST when buyer state differs from seller', () => {
    const result = determineGstTreatment('06', '10');
    expect(result).toBe('IGST');
  });
});

describe('applyB2BGstTreatment — CGST_SGST (intrastate)', () => {
  it('splits metal GST evenly: 3% of ₹1,000 → Rs 30 (3000 paise)', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 100_000n,
      makingChargePaise: 10_000n,
      treatment: 'CGST_SGST',
    });

    expect(result.treatment).toBe('CGST_SGST');
    expect(result.cgstMetalPaise).toBe(1500n);
    expect(result.sgstMetalPaise).toBe(1500n);
    expect(result.cgstMakingPaise).toBe(250n);
    expect(result.sgstMakingPaise).toBe(250n);
    expect(result.totalGstPaise).toBe(3500n);

    expect(result.igstMetalPaise).toBeUndefined();
    expect(result.igstMakingPaise).toBeUndefined();
  });

  it('assigns remainder paise to SGST when metal GST is odd', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 99_999n,
      makingChargePaise: 10_000n,
      treatment: 'CGST_SGST',
    });

    const metalGst = (99_999n * 300n) / 10000n;
    expect(metalGst).toBe(2999n);

    expect(result.cgstMetalPaise).toBe(1499n);
    expect(result.sgstMetalPaise).toBe(1500n);
    expect(result.cgstMetalPaise! + result.sgstMetalPaise!).toBe(metalGst);
  });

  it('assigns remainder paise to SGST when making GST is odd', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 100_000n,
      makingChargePaise: 10_001n,
      treatment: 'CGST_SGST',
    });

    const makingGst = (10_001n * 500n) / 10000n;
    expect(makingGst).toBe(500n);

    expect(result.cgstMakingPaise! + result.sgstMakingPaise!).toBe(makingGst);
  });

  it('invariant: cgst + sgst equals total for all components', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 6_842_000n,
      makingChargePaise: 821_040n,
      treatment: 'CGST_SGST',
    });

    const metalGst = (6_842_000n * 300n) / 10000n;
    const makingGst = (821_040n * 500n) / 10000n;

    expect(result.cgstMetalPaise! + result.sgstMetalPaise!).toBe(metalGst);
    expect(result.cgstMakingPaise! + result.sgstMakingPaise!).toBe(makingGst);
    expect(result.totalGstPaise).toBe(metalGst + makingGst);
  });

  it('returns zero GST for zero inputs', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 0n,
      makingChargePaise: 0n,
      treatment: 'CGST_SGST',
    });

    expect(result.cgstMetalPaise).toBe(0n);
    expect(result.sgstMetalPaise).toBe(0n);
    expect(result.cgstMakingPaise).toBe(0n);
    expect(result.sgstMakingPaise).toBe(0n);
    expect(result.totalGstPaise).toBe(0n);
  });
});

describe('applyB2BGstTreatment — IGST (interstate)', () => {
  it('applies full GST as IGST: 3% of ₹1,000 + 5% of ₹100 → 3500 paise', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 100_000n,
      makingChargePaise: 10_000n,
      treatment: 'IGST',
    });

    expect(result.treatment).toBe('IGST');
    expect(result.igstMetalPaise).toBe(3000n);
    expect(result.igstMakingPaise).toBe(500n);
    expect(result.totalGstPaise).toBe(3500n);

    expect(result.cgstMetalPaise).toBeUndefined();
    expect(result.sgstMetalPaise).toBeUndefined();
    expect(result.cgstMakingPaise).toBeUndefined();
    expect(result.sgstMakingPaise).toBeUndefined();
  });

  it('invariant: igst metal + igst making equals total', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 6_842_000n,
      makingChargePaise: 821_040n,
      treatment: 'IGST',
    });

    const metalGst = (6_842_000n * 300n) / 10000n;
    const makingGst = (821_040n * 500n) / 10000n;

    expect(result.igstMetalPaise! + result.igstMakingPaise!).toBe(
      metalGst + makingGst,
    );
    expect(result.totalGstPaise).toBe(metalGst + makingGst);
  });

  it('returns zero GST for zero inputs', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 0n,
      makingChargePaise: 0n,
      treatment: 'IGST',
    });

    expect(result.igstMetalPaise).toBe(0n);
    expect(result.igstMakingPaise).toBe(0n);
    expect(result.totalGstPaise).toBe(0n);
  });

  it('floors both components identically to CGST_SGST combined', () => {
    const goldValue = 99_999n;
    const makingCharge = 10_001n;

    const cgstSgst = applyB2BGstTreatment({
      goldValuePaise: goldValue,
      makingChargePaise: makingCharge,
      treatment: 'CGST_SGST',
    });

    const igst = applyB2BGstTreatment({
      goldValuePaise: goldValue,
      makingChargePaise: makingCharge,
      treatment: 'IGST',
    });

    expect(cgstSgst.totalGstPaise).toBe(igst.totalGstPaise);
  });
});

describe('B2BGstBreakdown type safety', () => {
  it('CGST_SGST result excludes IGST fields', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 100_000n,
      makingChargePaise: 10_000n,
      treatment: 'CGST_SGST',
    });

    const breakdown: B2BGstBreakdown = result;
    expect(breakdown.igstMetalPaise).toBeUndefined();
    expect(breakdown.igstMakingPaise).toBeUndefined();
  });

  it('IGST result excludes CGST_SGST fields', () => {
    const result = applyB2BGstTreatment({
      goldValuePaise: 100_000n,
      makingChargePaise: 10_000n,
      treatment: 'IGST',
    });

    const breakdown: B2BGstBreakdown = result;
    expect(breakdown.cgstMetalPaise).toBeUndefined();
    expect(breakdown.sgstMetalPaise).toBeUndefined();
    expect(breakdown.cgstMakingPaise).toBeUndefined();
    expect(breakdown.sgstMakingPaise).toBeUndefined();
  });
});
