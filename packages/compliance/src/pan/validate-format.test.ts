import { describe, expect, it } from 'vitest';
import { validatePanFormat, normalizePan } from './validate-format';

describe('normalizePan', () => {
  it('uppercases and strips whitespace', () => {
    expect(normalizePan('  abcde1234f  ')).toBe('ABCDE1234F');
  });
  it('returns already-normalized PAN unchanged', () => {
    expect(normalizePan('ABCDE1234F')).toBe('ABCDE1234F');
  });
});

describe('validatePanFormat', () => {
  it('accepts a canonical valid PAN', () => {
    expect(validatePanFormat('ABCDE1234F')).toBe(true);
  });

  it('accepts another valid PAN', () => {
    expect(validatePanFormat('PQRST9876Z')).toBe(true);
  });

  it('auto-uppercases before validating', () => {
    expect(validatePanFormat('abcde1234f')).toBe(true);
  });

  it('rejects PAN with digit in position 1-5 (wrong alpha positions)', () => {
    expect(validatePanFormat('1BCDE1234F')).toBe(false);
  });

  it('rejects PAN with letter in numeric positions 6-9', () => {
    expect(validatePanFormat('ABCDEA234F')).toBe(false);
    expect(validatePanFormat('ABCDE12A4F')).toBe(false);
  });

  it('rejects PAN with digit in position 10', () => {
    expect(validatePanFormat('ABCDE12341')).toBe(false);
  });

  it('rejects a 9-char PAN (too short)', () => {
    expect(validatePanFormat('ABCDE123F')).toBe(false);
  });

  it('rejects an 11-char PAN (too long)', () => {
    expect(validatePanFormat('ABCDE12345F')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validatePanFormat('')).toBe(false);
  });

  it('rejects a PAN with special characters', () => {
    expect(validatePanFormat('ABCDE-234F')).toBe(false);
  });
});
