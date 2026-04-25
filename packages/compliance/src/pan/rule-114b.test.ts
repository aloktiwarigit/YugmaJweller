import { describe, expect, it } from 'vitest';
import { enforcePanRequired, validateForm60, PAN_THRESHOLD_PAISE } from './rule-114b';
import { ComplianceHardBlockError } from '../errors';

const THRESHOLD = PAN_THRESHOLD_PAISE; // 20_000_000n (Rs 2,00,000)

describe('PAN_THRESHOLD_PAISE', () => {
  it('equals Rs 2,00,000 × 100 paise', () => {
    expect(THRESHOLD).toBe(20_000_000n);
  });
});

describe('enforcePanRequired', () => {
  it('passes when total is below threshold with no PAN (Rs 1,99,999)', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 19_999_900n, pan: null, form60Data: null }),
    ).not.toThrow();
  });

  it('passes when total is exactly threshold with valid PAN (Rs 2,00,000)', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_000n, pan: 'ABCDE1234F', form60Data: null }),
    ).not.toThrow();
  });

  it('hard-blocks when total equals threshold and no PAN or Form60 (Rs 2,00,000)', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_000n, pan: null, form60Data: null }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('hard-blocks when total is above threshold and no PAN or Form60 (Rs 2,00,001)', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_100n, pan: null, form60Data: null }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('emits compliance.pan_required code', () => {
    try {
      enforcePanRequired({ totalPaise: 20_000_100n, pan: undefined, form60Data: null });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ComplianceHardBlockError).code).toBe('compliance.pan_required');
      expect((e as ComplianceHardBlockError).meta.thresholdPaise).toBe(THRESHOLD.toString());
    }
  });

  it('passes when total is above threshold and valid PAN provided', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_100n, pan: 'ABCDE1234F', form60Data: null }),
    ).not.toThrow();
  });

  it('passes when total is above threshold and Form60 provided', () => {
    expect(() =>
      enforcePanRequired({
        totalPaise: 20_000_100n,
        pan: null,
        form60Data: { name: 'Ram', address: 'Ayodhya', reasonForNoPan: 'No card', estimatedAnnualIncomePaise: '100000' },
      }),
    ).not.toThrow();
  });

  it('rejects an empty-string PAN (treated as missing)', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 20_000_100n, pan: '   ', form60Data: null }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('passes when total is zero (no PAN required)', () => {
    expect(() =>
      enforcePanRequired({ totalPaise: 0n, pan: null, form60Data: null }),
    ).not.toThrow();
  });
});

describe('validateForm60', () => {
  const validForm60 = {
    name: 'Ram Kumar',
    address: '12 Main Road, Ayodhya',
    reasonForNoPan: 'PAN card not yet issued',
    estimatedAnnualIncomePaise: '500000',
  };

  it('passes with all required fields present', () => {
    expect(() => validateForm60(validForm60)).not.toThrow();
  });

  it('throws when name is missing', () => {
    const bad = { ...validForm60, name: '' };
    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
    try {
      validateForm60(bad);
    } catch (e) {
      expect((e as ComplianceHardBlockError).code).toBe('compliance.form60_incomplete');
      expect((e as ComplianceHardBlockError).meta.missingFields).toContain('name');
    }
  });

  it('throws when address is missing', () => {
    const bad = { ...validForm60, address: '   ' };
    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
  });

  it('throws when reasonForNoPan is missing', () => {
    const bad = { ...validForm60, reasonForNoPan: '' };
    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
  });

  it('throws when estimatedAnnualIncomePaise is missing', () => {
    const bad = { ...validForm60, estimatedAnnualIncomePaise: '' };
    expect(() => validateForm60(bad)).toThrow(ComplianceHardBlockError);
  });

  it('reports all missing fields at once', () => {
    try {
      validateForm60({ name: '', address: '', reasonForNoPan: '', estimatedAnnualIncomePaise: '' });
    } catch (e) {
      const missing = (e as ComplianceHardBlockError).meta.missingFields as string[];
      expect(missing).toHaveLength(4);
    }
  });
});
