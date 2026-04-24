import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Weight } from '../src/weight';

describe('Weight', () => {
  describe('from()', () => {
    it('parses a valid string', () => {
      const w = Weight.from('10.5000');
      expect(w.toFixed4()).toBe('10.5000');
    });

    it('parses integer string', () => {
      expect(Weight.from('5').toFixed4()).toBe('5.0000');
    });

    it('throws on NaN string', () => {
      expect(() => Weight.from('abc')).toThrow('invalid weight');
    });

    it('throws on negative value', () => {
      expect(() => Weight.from('-1.0')).toThrow('invalid weight');
    });

    it('throws on zero', () => {
      expect(() => Weight.from('0')).toThrow('invalid weight');
    });
  });

  describe('fromDecimal()', () => {
    it('wraps a positive Decimal', () => {
      const d = new Decimal('3.1415');
      expect(Weight.fromDecimal(d).toFixed4()).toBe('3.1415');
    });

    it('throws on non-positive Decimal', () => {
      expect(() => Weight.fromDecimal(new Decimal(0))).toThrow('invalid weight');
    });
  });

  describe('add()', () => {
    it('adds two weights immutably', () => {
      const a = Weight.from('1.0000');
      const b = Weight.from('2.0000');
      const c = a.add(b);
      expect(c.toFixed4()).toBe('3.0000');
      expect(a.toFixed4()).toBe('1.0000');
    });
  });

  describe('multiply()', () => {
    it('returns a Decimal (not a Weight)', () => {
      const w = Weight.from('10.0000');
      const result = w.multiply(new Decimal('1.5'));
      expect(result instanceof Decimal).toBe(true);
      expect(result.toFixed(4)).toBe('15.0000');
    });

    it('accepts a number factor', () => {
      const w = Weight.from('4.0000');
      expect(w.multiply(2).toFixed(4)).toBe('8.0000');
    });
  });

  describe('toGrams()', () => {
    it('returns a display string with g suffix', () => {
      expect(Weight.from('10.5000').toGrams()).toBe('10.5000 g');
    });
  });
});
