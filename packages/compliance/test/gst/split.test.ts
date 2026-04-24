import { describe, it, expect } from 'vitest';
import { applyGstSplit } from '../../src/gst/split';

describe('applyGstSplit', () => {
  it('computes 3% metal GST on gold value of ₹68,420 → 205,260 paise (floor)', () => {
    // 6,842,000 paise × 300 / 10000 = 205,260 paise exactly
    const result = applyGstSplit({ goldValuePaise: 6_842_000n, makingChargePaise: 0n });
    expect(result.metalGstPaise).toBe(205_260n);
  });

  it('computes 5% making GST on making charge of ₹8,210.40 → 41,052 paise (floor)', () => {
    // 821,040 paise × 500 / 10000 = 41,052 paise exactly (not ₹410.52 rounded up)
    const result = applyGstSplit({ goldValuePaise: 0n, makingChargePaise: 821_040n });
    expect(result.makingGstPaise).toBe(41_052n);
  });

  it('returns zero GST for zero inputs', () => {
    const result = applyGstSplit({ goldValuePaise: 0n, makingChargePaise: 0n });
    expect(result.metalGstPaise).toBe(0n);
    expect(result.makingGstPaise).toBe(0n);
    expect(result.totalGstPaise).toBe(0n);
  });

  it('floors metal GST: 99 paise × 300 / 10000 = 2 not 3', () => {
    // 99 × 300 = 29700, 29700 / 10000 = 2 (integer division floors)
    const result = applyGstSplit({ goldValuePaise: 99n, makingChargePaise: 0n });
    expect(result.metalGstPaise).toBe(2n);
  });

  it('totalGstPaise is sum of metal and making GST', () => {
    const result = applyGstSplit({ goldValuePaise: 6_842_000n, makingChargePaise: 821_040n });
    expect(result.totalGstPaise).toBe(result.metalGstPaise + result.makingGstPaise);
    expect(result.totalGstPaise).toBe(246_312n);
  });
});
