import { describe, expect, it } from 'vitest';
import { validateHuidPresence } from './validate-presence';
import { ComplianceHardBlockError } from '../errors';

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
});
