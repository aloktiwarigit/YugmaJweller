import { describe, it, expect } from 'vitest';
import { MoneyInPaise } from '../src/money';

describe('MoneyInPaise', () => {
  describe('from()', () => {
    it('wraps a bigint', () => {
      expect(MoneyInPaise.from(100n).toNumber()).toBe(100);
    });
  });

  describe('add()', () => {
    it('adds two amounts', () => {
      const a = MoneyInPaise.from(100n);
      const b = MoneyInPaise.from(50n);
      expect(a.add(b).toNumber()).toBe(150);
    });

    it('is immutable', () => {
      const a = MoneyInPaise.from(100n);
      const b = MoneyInPaise.from(50n);
      a.add(b);
      expect(a.toNumber()).toBe(100);
    });
  });

  describe('subtract()', () => {
    it('subtracts two amounts', () => {
      expect(MoneyInPaise.from(200n).subtract(MoneyInPaise.from(50n)).toNumber()).toBe(150);
    });
  });

  describe('toRupees()', () => {
    it('formats small amount', () => {
      expect(MoneyInPaise.from(100n).toRupees()).toContain('1');
    });

    it('formats large amount with Indian grouping (crore)', () => {
      // 1,00,00,000 rupees = 1,00,00,00,000 paise
      const result = MoneyInPaise.from(10_000_000_00n).toRupees();
      expect(result).toContain('1,00,00,000');
    });

    it('includes rupee symbol', () => {
      expect(MoneyInPaise.from(100n).toRupees()).toContain('₹');
    });
  });

  describe('toNumber()', () => {
    it('returns the raw paise count as number', () => {
      expect(MoneyInPaise.from(12345n).toNumber()).toBe(12345);
    });
  });
});
