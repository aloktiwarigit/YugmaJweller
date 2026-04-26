import { describe, it, expect } from 'vitest';
import {
  getPmlaThresholdStatus,
  PMLA_WARN_THRESHOLD_PAISE,
  PMLA_BLOCK_THRESHOLD_PAISE,
} from './thresholds';

describe('getPmlaThresholdStatus', () => {
  it('returns ok for Rs 0', () => {
    expect(getPmlaThresholdStatus(0n)).toBe('ok');
  });

  it('returns ok for Rs 7,99,999 (one paise below warn threshold)', () => {
    expect(getPmlaThresholdStatus(79_999_900n)).toBe('ok');
  });

  it('returns warn at exactly Rs 8,00,000 (warn boundary)', () => {
    expect(getPmlaThresholdStatus(PMLA_WARN_THRESHOLD_PAISE)).toBe('warn');
  });

  it('returns warn at Rs 8,00,001 (just above warn threshold)', () => {
    expect(getPmlaThresholdStatus(PMLA_WARN_THRESHOLD_PAISE + 1n)).toBe('warn');
  });

  it('returns warn at Rs 9,99,999 (one paise below block threshold)', () => {
    expect(getPmlaThresholdStatus(PMLA_BLOCK_THRESHOLD_PAISE - 1n)).toBe('warn');
  });

  it('returns block at exactly Rs 10,00,000 (block boundary)', () => {
    expect(getPmlaThresholdStatus(PMLA_BLOCK_THRESHOLD_PAISE)).toBe('block');
  });

  it('returns block above Rs 10,00,000', () => {
    expect(getPmlaThresholdStatus(PMLA_BLOCK_THRESHOLD_PAISE + 1n)).toBe('block');
  });

  it('threshold constants are correct paise values', () => {
    expect(PMLA_WARN_THRESHOLD_PAISE).toBe(80_000_000n);   // Rs 8,00,000
    expect(PMLA_BLOCK_THRESHOLD_PAISE).toBe(100_000_000n); // Rs 10,00,000
  });
});
