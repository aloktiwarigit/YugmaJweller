import { describe, expect, it } from 'vitest';
import { validateGstinFormat, normalizeGstin, getStateCodeFromGstin } from './validate';

describe('normalizeGstin', () => {
  it('uppercases and strips whitespace', () => {
    expect(normalizeGstin('  29abcde1234f1z3  ')).toBe('29ABCDE1234F1Z3');
  });

  it('uppercases with internal spaces', () => {
    expect(normalizeGstin('29 ABCDE 1234 F1Z3')).toBe('29ABCDE1234F1Z3');
  });

  it('returns already-normalized GSTIN unchanged', () => {
    expect(normalizeGstin('29ABCDE1234F1Z3')).toBe('29ABCDE1234F1Z3');
  });
});

describe('validateGstinFormat', () => {
  it('accepts a canonical valid GSTIN (Karnataka)', () => {
    expect(validateGstinFormat('29ABCDE1234F1Z3')).toBe(true);
  });

  it('auto-uppercases before validating', () => {
    expect(validateGstinFormat('29abcde1234f1z3')).toBe(true);
  });

  it('auto-strips whitespace before validating', () => {
    expect(validateGstinFormat('  29 ABCDE 1234 F1Z3  ')).toBe(true);
  });

  it('rejects a 14-char GSTIN (too short)', () => {
    expect(validateGstinFormat('29ABCDE1234F1Z')).toBe(false);
  });

  it('rejects a 16-char GSTIN (too long)', () => {
    expect(validateGstinFormat('29ABCDE1234F1Z33')).toBe(false);
  });

  it('rejects state code 00 (invalid)', () => {
    expect(validateGstinFormat('00ABCDE1234F1Z3')).toBe(false);
  });

  it('rejects state code 39 (out of range)', () => {
    expect(validateGstinFormat('39ABCDE1234F1Z3')).toBe(false);
  });

  it('accepts state code 01 (minimum valid)', () => {
    const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let factor = 2;
    let sum = 0;
    for (const ch of '01ABCDE1234F1Z'.slice(0, 14)) {
      const product = factor * CHARS.indexOf(ch);
      sum += Math.floor(product / 36) + (product % 36);
      factor = factor === 2 ? 1 : 2;
    }
    const check = (36 - (sum % 36)) % 36;
    const validGstin = '01ABCDE1234F1Z' + CHARS[check];
    expect(validateGstinFormat(validGstin)).toBe(true);
  });

  it('accepts state code 38 (maximum valid)', () => {
    const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let factor = 2;
    let sum = 0;
    for (const ch of '38ABCDE1234F1Z'.slice(0, 14)) {
      const product = factor * CHARS.indexOf(ch);
      sum += Math.floor(product / 36) + (product % 36);
      factor = factor === 2 ? 1 : 2;
    }
    const check = (36 - (sum % 36)) % 36;
    const validGstin = '38ABCDE1234F1Z' + CHARS[check];
    expect(validateGstinFormat(validGstin)).toBe(true);
  });

  it('rejects PAN with digit in position 1 (should be letter)', () => {
    expect(validateGstinFormat('291BCDE1234F1Z3')).toBe(false);
  });

  it('rejects PAN with letter in position 3 (should be digit)', () => {
    expect(validateGstinFormat('29ABCDA1234F1Z3')).toBe(false);
  });

  it('rejects PAN with letter in position 5 (should be digit)', () => {
    expect(validateGstinFormat('29ABCDEA234F1Z3')).toBe(false);
  });

  it('rejects PAN with digit in position 7 (should be letter)', () => {
    expect(validateGstinFormat('29ABCDE12341Z3')).toBe(false);
  });

  it('rejects entity number 0 (invalid)', () => {
    const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let factor = 2;
    let sum = 0;
    for (const ch of '29ABCDE1234F0Z'.slice(0, 14)) {
      const product = factor * CHARS.indexOf(ch);
      sum += Math.floor(product / 36) + (product % 36);
      factor = factor === 2 ? 1 : 2;
    }
    const check = (36 - (sum % 36)) % 36;
    const invalidGstin = '29ABCDE1234F0Z' + CHARS[check];
    expect(validateGstinFormat(invalidGstin)).toBe(false);
  });

  it('accepts entity number 1-9', () => {
    const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 1; i <= 9; i++) {
      let factor = 2;
      let sum = 0;
      for (const ch of (`29ABCDE1234F${i}Z`.slice(0, 14))) {
        const product = factor * CHARS.indexOf(ch);
        sum += Math.floor(product / 36) + (product % 36);
        factor = factor === 2 ? 1 : 2;
      }
      const check = (36 - (sum % 36)) % 36;
      const validGstin = `29ABCDE1234F${i}Z` + CHARS[check];
      expect(validateGstinFormat(validGstin)).toBe(true);
    }
  });

  it('accepts entity number A-Z', () => {
    const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) {
      const entityChar = String.fromCharCode(65 + i);
      let factor = 2;
      let sum = 0;
      for (const ch of (`29ABCDE1234F${entityChar}Z`.slice(0, 14))) {
        const product = factor * CHARS.indexOf(ch);
        sum += Math.floor(product / 36) + (product % 36);
        factor = factor === 2 ? 1 : 2;
      }
      const check = (36 - (sum % 36)) % 36;
      const validGstin = `29ABCDE1234F${entityChar}Z` + CHARS[check];
      expect(validateGstinFormat(validGstin)).toBe(true);
    }
  });

  it('rejects if char 14 is not Z', () => {
    expect(validateGstinFormat('29ABCDE1234F1A3')).toBe(false);
    expect(validateGstinFormat('29ABCDE1234F1Y3')).toBe(false);
  });

  it('rejects invalid checksum (flip last char)', () => {
    const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let factor = 2;
    let sum = 0;
    for (const ch of '29ABCDE1234F1Z'.slice(0, 14)) {
      const product = factor * CHARS.indexOf(ch);
      sum += Math.floor(product / 36) + (product % 36);
      factor = factor === 2 ? 1 : 2;
    }
    const check = (36 - (sum % 36)) % 36;
    const correctCheckChar = CHARS[check];
    const wrongCheckChar = CHARS[(check + 1) % 36];
    const validGstin = '29ABCDE1234F1Z' + correctCheckChar;
    const invalidGstin = '29ABCDE1234F1Z' + wrongCheckChar;
    expect(validateGstinFormat(validGstin)).toBe(true);
    expect(validateGstinFormat(invalidGstin)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateGstinFormat('')).toBe(false);
  });
});

describe('getStateCodeFromGstin', () => {
  it('returns state code from valid GSTIN', () => {
    expect(getStateCodeFromGstin('29ABCDE1234F1Z3')).toBe('29');
  });

  it('returns state code 09 (Uttar Pradesh)', () => {
    expect(getStateCodeFromGstin('09ABCDE1234F1Z3')).toBe('09');
  });

  it('returns state code 01', () => {
    expect(getStateCodeFromGstin('01ABCDE1234F1Z3')).toBe('01');
  });

  it('returns state code 38', () => {
    expect(getStateCodeFromGstin('38ABCDE1234F1Z3')).toBe('38');
  });
});
