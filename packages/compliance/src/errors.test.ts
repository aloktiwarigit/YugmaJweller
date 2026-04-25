import { describe, expect, it } from 'vitest';
import { ComplianceHardBlockError } from './errors';

describe('ComplianceHardBlockError', () => {
  it('preserves code and meta', () => {
    const err = new ComplianceHardBlockError('compliance.huid_missing', { lineIndex: 2 });
    expect(err.code).toBe('compliance.huid_missing');
    expect(err.meta).toEqual({ lineIndex: 2 });
    expect(err.name).toBe('ComplianceHardBlockError');
    expect(err.message).toContain('compliance.huid_missing');
  });

  it('survives instanceof across catch boundaries', () => {
    try {
      throw new ComplianceHardBlockError('x.y');
    } catch (e) {
      expect(e).toBeInstanceOf(ComplianceHardBlockError);
      expect(e).toBeInstanceOf(Error);
    }
  });
});
