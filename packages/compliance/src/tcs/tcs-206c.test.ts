import { describe, it, expect } from 'vitest';
import { computeTcs, TCS_THRESHOLD_PAISE, TCS_RATE_BP } from './tcs-206c';

describe('computeTcs (Section 206C(1D))', () => {
  it('exports TCS_THRESHOLD_PAISE as Rs 2,00,000 in paise', () => {
    expect(TCS_THRESHOLD_PAISE).toBe(20_000_000n);
  });

  it('exports TCS_RATE_BP as 100 basis points (1%)', () => {
    expect(TCS_RATE_BP).toBe(100);
  });

  it('returns 0n for a zero-value invoice', () => {
    expect(computeTcs(0n)).toBe(0n);
  });

  it('returns 0n when invoice total is below threshold (Rs 1,99,999)', () => {
    expect(computeTcs(19_999_900n)).toBe(0n); // Rs 1,99,999 = 19_999_900 paise
  });

  it('returns 0n when invoice total is exactly Rs 2,00,000 (threshold is exclusive)', () => {
    expect(computeTcs(20_000_000n)).toBe(0n); // exactly at threshold → no TCS
  });

  it('returns 1% TCS when total is Rs 2,00,000 + 1 paise', () => {
    const total = 20_000_001n;
    const tcs = computeTcs(total);
    // 1% of 20_000_001 = 200_000 (truncated integer)
    expect(tcs).toBe(200_000n);
  });

  it('returns Rs 5,000 (500_000n paise) TCS on Rs 5,00,000 invoice', () => {
    expect(computeTcs(50_000_000n)).toBe(500_000n); // Rs 5,00,000 → Rs 5,000 TCS
  });

  it('returns 1% of total (integer truncation) for odd paise amounts', () => {
    // Rs 3,00,001 = 30_000_100 paise → 1% = 300_001 paise (truncated)
    expect(computeTcs(30_000_100n)).toBe(300_001n);
  });

  it('never returns negative TCS', () => {
    // Even for very small totals below threshold
    expect(computeTcs(0n)).toBeGreaterThanOrEqual(0n);
    expect(computeTcs(1n)).toBeGreaterThanOrEqual(0n);
  });
});
