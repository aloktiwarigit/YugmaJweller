import { describe, it, expect } from 'vitest';
import { enforce269ss, RESTRICTION_269SS_THRESHOLD_PAISE } from './section-269ss';
import { ComplianceHardBlockError } from '../errors';

describe('enforce269ss', () => {
  it('allows Rs 19,999 cash advance (below threshold)', () => {
    expect(() => enforce269ss(1_999_900n, 'advance')).not.toThrow();
  });

  it('allows zero cash advance', () => {
    expect(() => enforce269ss(0n, 'advance')).not.toThrow();
  });

  it('blocks Rs 20,000 cash advance (at threshold — ≥ Rs 20,000 prohibited)', () => {
    expect(() => enforce269ss(RESTRICTION_269SS_THRESHOLD_PAISE, 'advance')).toThrow(ComplianceHardBlockError);
  });

  it('blocks Rs 50,000 cash advance (above threshold)', () => {
    expect(() => enforce269ss(5_000_000n, 'advance')).toThrow(ComplianceHardBlockError);
  });

  it('throws with code SECTION_269SS in meta', () => {
    try {
      enforce269ss(RESTRICTION_269SS_THRESHOLD_PAISE, 'advance');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ComplianceHardBlockError);
      expect((e as ComplianceHardBlockError).meta['code']).toBe('SECTION_269SS');
    }
  });

  it('includes amountPaise string in meta', () => {
    try {
      enforce269ss(5_000_000n, 'advance');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as ComplianceHardBlockError).meta['amountPaise']).toBe('5000000');
    }
  });

  it('blocks Rs 20,000 cash repayment (Section 269T — same threshold)', () => {
    expect(() => enforce269ss(RESTRICTION_269SS_THRESHOLD_PAISE, 'repayment')).toThrow(ComplianceHardBlockError);
  });

  it('includes type "repayment" in meta', () => {
    try {
      enforce269ss(RESTRICTION_269SS_THRESHOLD_PAISE, 'repayment');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as ComplianceHardBlockError).meta['type']).toBe('repayment');
    }
  });

  it('blocks Rs 20,000 cash deposit', () => {
    expect(() => enforce269ss(RESTRICTION_269SS_THRESHOLD_PAISE, 'deposit')).toThrow(ComplianceHardBlockError);
  });

  it('Rs 19,999 deposit does not throw', () => {
    expect(() => enforce269ss(1_999_900n, 'deposit')).not.toThrow();
  });
});
