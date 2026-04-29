import { describe, expect, it } from 'vitest';
import { validateHuidPresence } from './validate-presence';
import { ComplianceHardBlockError } from '../errors';
import { HuidExemptionCategory } from './huid-exemption';

describe('validateHuidPresence', () => {
  it('passes when no lines reference a hallmarked product', () => {
    expect(() =>
      validateHuidPresence([
        { lineIndex: 0, huid: null,    productHuidOnRecord: null },
        { lineIndex: 1, huid: 'AB12CD', productHuidOnRecord: null }, // not hallmarked even though line provided HUID
      ]),
    ).not.toThrow();
  });

  it('passes when the hallmarked product line includes a HUID', () => {
    expect(() =>
      validateHuidPresence([
        { lineIndex: 0, huid: 'AB12CD', productHuidOnRecord: 'AB12CD' },
      ]),
    ).not.toThrow();
  });

  it('hard-blocks when a hallmarked product line omits HUID (null)', () => {
    expect(() =>
      validateHuidPresence([
        { lineIndex: 0, huid: null, productHuidOnRecord: 'AB12CD' },
      ]),
    ).toThrow(ComplianceHardBlockError);
    try {
      validateHuidPresence([
        { lineIndex: 2, huid: null, productHuidOnRecord: 'AB12CD' },
      ]);
    } catch (e) {
      expect((e as ComplianceHardBlockError).code).toBe('compliance.huid_missing');
      expect((e as ComplianceHardBlockError).meta).toEqual({ lineIndex: 2 });
    }
  });

  it('hard-blocks when a hallmarked product line provides empty-string HUID', () => {
    expect(() =>
      validateHuidPresence([
        { lineIndex: 0, huid: '', productHuidOnRecord: 'AB12CD' },
      ]),
    ).toThrow(ComplianceHardBlockError);
  });

  it('hard-blocks when a hallmarked product line provides whitespace-only HUID', () => {
    expect(() =>
      validateHuidPresence([
        { lineIndex: 0, huid: '   ', productHuidOnRecord: 'AB12CD' },
      ]),
    ).toThrow(ComplianceHardBlockError);
  });

  it('reports the first failing lineIndex (not the last)', () => {
    try {
      validateHuidPresence([
        { lineIndex: 0, huid: 'AB12CD', productHuidOnRecord: 'AB12CD' },
        { lineIndex: 1, huid: null,     productHuidOnRecord: 'EF34GH' }, // first failure
        { lineIndex: 2, huid: null,     productHuidOnRecord: 'IJ56KL' },
      ]);
      throw new Error('expected to throw');
    } catch (e) {
      expect((e as ComplianceHardBlockError).meta).toEqual({ lineIndex: 1 });
    }
  });

  describe('HUID exemptions', () => {
    it('passes when Kundan/Polki/Jadau product has no HUID (exempt by nature)', () => {
      expect(() =>
        validateHuidPresence([
          {
            lineIndex: 0,
            huid: null,
            productHuidOnRecord: null,
            huidExemptionCategory: HuidExemptionCategory.KundanPolkiJadau,
          },
        ]),
      ).not.toThrow();
    });

    it('passes when under-2g product has no HUID (BIS exempt)', () => {
      expect(() =>
        validateHuidPresence([
          {
            lineIndex: 0,
            huid: null,
            productHuidOnRecord: null,
            huidExemptionCategory: HuidExemptionCategory.Under2g,
          },
        ]),
      ).not.toThrow();
    });

    it('skips HUID check on exempt product even when productHuidOnRecord is set', () => {
      // Edge case: product was hallmarked then reclassified as exempt — exemption wins.
      expect(() =>
        validateHuidPresence([
          {
            lineIndex: 0,
            huid: null,
            productHuidOnRecord: 'AB12CD',
            huidExemptionCategory: HuidExemptionCategory.KundanPolkiJadau,
          },
        ]),
      ).not.toThrow();
    });

    it('still hard-blocks non-exempt hallmarked product with no HUID (category=none)', () => {
      expect(() =>
        validateHuidPresence([
          {
            lineIndex: 0,
            huid: null,
            productHuidOnRecord: 'AB12CD',
            huidExemptionCategory: HuidExemptionCategory.None,
          },
        ]),
      ).toThrow(ComplianceHardBlockError);
    });

    it('backward-compatible: missing huidExemptionCategory defaults to non-exempt', () => {
      expect(() =>
        validateHuidPresence([
          { lineIndex: 0, huid: null, productHuidOnRecord: 'AB12CD' },
        ]),
      ).toThrow(ComplianceHardBlockError);
    });
  });
});
