import { describe, it, expect } from 'vitest';
import { computeProductPrice } from '../src/pricing';

const GOLDEN_INPUT = {
  netWeightG:        '10.0000',
  ratePerGramPaise:  684_200n,  // ₹6,842/g
  makingChargePct:   '12.00',
  stoneChargesPaise: 500_000n,  // ₹5,000
  hallmarkFeePaise:  4_500n,    // ₹45
};

describe('computeProductPrice', () => {
  describe('golden example from AC', () => {
    it('computes gold value correctly', () => {
      const r = computeProductPrice(GOLDEN_INPUT);
      expect(r.goldValuePaise).toBe(6_842_000n);
    });

    it('computes making charge correctly', () => {
      const r = computeProductPrice(GOLDEN_INPUT);
      expect(r.makingChargePaise).toBe(821_040n);
    });

    it('computes metal GST correctly', () => {
      const r = computeProductPrice(GOLDEN_INPUT);
      expect(r.gstMetalPaise).toBe(205_260n);
    });

    it('computes making GST correctly', () => {
      const r = computeProductPrice(GOLDEN_INPUT);
      expect(r.gstMakingPaise).toBe(41_052n);
    });

    it('passes through stone and hallmark charges', () => {
      const r = computeProductPrice(GOLDEN_INPUT);
      expect(r.stoneChargesPaise).toBe(500_000n);
      expect(r.hallmarkFeePaise).toBe(4_500n);
    });

    it('computes total = 8,413,852 paise = ₹84,138.52', () => {
      const r = computeProductPrice(GOLDEN_INPUT);
      // 6842000 + 821040 + 500000 + 205260 + 41052 + 4500 = 8413852
      expect(r.totalPaise).toBe(8_413_852n);
    });

    it('formats totalFormatted with rupee symbol', () => {
      const r = computeProductPrice(GOLDEN_INPUT);
      expect(r.totalFormatted.startsWith('₹')).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('throws on zero weight', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, netWeightG: '0.0000' })).toThrow(RangeError);
    });

    it('throws on negative weight', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, netWeightG: '-1.0000' })).toThrow(RangeError);
    });

    it('throws on non-numeric weight string', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, netWeightG: 'abc' })).toThrow(RangeError);
    });

    it('throws on zero rate', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, ratePerGramPaise: 0n })).toThrow(RangeError);
    });

    it('throws on negative rate', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, ratePerGramPaise: -1n })).toThrow(RangeError);
    });

    it('throws on making charge > 100', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, makingChargePct: '100.01' })).toThrow(RangeError);
    });

    it('throws on negative stone charges', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, stoneChargesPaise: -1n })).toThrow(RangeError);
    });

    it('throws on negative hallmark fee', () => {
      expect(() => computeProductPrice({ ...GOLDEN_INPUT, hallmarkFeePaise: -1n })).toThrow(RangeError);
    });
  });

  describe('edge cases', () => {
    it('making charge 0%: making and GST-making both 0', () => {
      const r = computeProductPrice({ ...GOLDEN_INPUT, makingChargePct: '0.00' });
      expect(r.makingChargePaise).toBe(0n);
      expect(r.gstMakingPaise).toBe(0n);
    });

    it('making charge 100%: valid, making = gold value', () => {
      const r = computeProductPrice({ ...GOLDEN_INPUT, makingChargePct: '100.00' });
      expect(r.makingChargePaise).toBe(r.goldValuePaise);
    });

    it('stone charges 0n: stoneChargesPaise = 0 in breakdown', () => {
      const r = computeProductPrice({ ...GOLDEN_INPUT, stoneChargesPaise: 0n });
      expect(r.stoneChargesPaise).toBe(0n);
    });

    it('hallmark fee 0n: hallmarkFeePaise = 0 in breakdown', () => {
      const r = computeProductPrice({ ...GOLDEN_INPUT, hallmarkFeePaise: 0n });
      expect(r.hallmarkFeePaise).toBe(0n);
    });

    it('very small weight (0.0001g) at high rate: floors correctly', () => {
      // 0.0001g × 1,000,000 paise/g = 100 paise exactly
      const r = computeProductPrice({
        netWeightG:        '0.0001',
        ratePerGramPaise:  1_000_000n,
        makingChargePct:   '0.00',
        stoneChargesPaise: 0n,
        hallmarkFeePaise:  0n,
      });
      expect(r.goldValuePaise).toBe(100n);
    });

    it('very small weight at rate that produces sub-paise: floors to lower paise', () => {
      // 0.0001g × 684200 paise/g = 68.42 paise → floor → 68 paise
      const r = computeProductPrice({
        netWeightG:        '0.0001',
        ratePerGramPaise:  684_200n,
        makingChargePct:   '0.00',
        stoneChargesPaise: 0n,
        hallmarkFeePaise:  0n,
      });
      expect(r.goldValuePaise).toBe(68n);  // floor(68.42)
    });

    it('very large weight (999.9999g) at high rate: no overflow (BigInt)', () => {
      const r = computeProductPrice({
        netWeightG:        '999.9999',
        ratePerGramPaise:  1_000_000n,  // ₹10,000/g
        makingChargePct:   '0.00',
        stoneChargesPaise: 0n,
        hallmarkFeePaise:  0n,
      });
      // 999.9999g × 1,000,000 = 999,999,900 paise ≈ ₹9,999,999 — well within BigInt range
      expect(r.goldValuePaise).toBe(999_999_900n);
      expect(typeof r.totalPaise).toBe('bigint');
    });
  });
});
