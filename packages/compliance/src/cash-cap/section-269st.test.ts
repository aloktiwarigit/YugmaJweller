import { describe, it, expect } from 'vitest';
import {
  enforce269ST,
  buildCashCapOverride,
  SECTION_269ST_LIMIT_PAISE,
} from './section-269st';
import { ComplianceHardBlockError } from '../errors';

const BASE = {
  shopId: '0a1b2c3d-4e5f-4000-8000-000000000000',
  customerId: null as string | null,
  customerPhone: '+919999999999' as string | null,
};

describe('enforce269ST', () => {
  it('allows zero cash', () => {
    expect(() =>
      enforce269ST({ ...BASE, existingDailyPaise: 0n, cashAmountPaise: 0n }),
    ).not.toThrow();
  });

  it('allows exactly Rs 1,99,999 from zero (limit boundary)', () => {
    expect(() =>
      enforce269ST({ ...BASE, existingDailyPaise: 0n, cashAmountPaise: SECTION_269ST_LIMIT_PAISE }),
    ).not.toThrow();
  });

  it('blocks Rs 1,99,999 + 1 paise over limit', () => {
    expect(() =>
      enforce269ST({ ...BASE, existingDailyPaise: 0n, cashAmountPaise: SECTION_269ST_LIMIT_PAISE + 1n }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('blocks Rs 2,00,000 (full rupee over limit)', () => {
    expect(() =>
      enforce269ST({ ...BASE, existingDailyPaise: 0n, cashAmountPaise: 20_000_000n }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('throws code compliance.cash_cap_exceeded', () => {
    try {
      enforce269ST({ ...BASE, existingDailyPaise: 0n, cashAmountPaise: 20_000_000n });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ComplianceHardBlockError);
      expect((e as ComplianceHardBlockError).code).toBe('compliance.cash_cap_exceeded');
    }
  });

  it('blocks when existing Rs 1L + new Rs 1L = Rs 2L total', () => {
    expect(() =>
      enforce269ST({ ...BASE, existingDailyPaise: 10_000_000n, cashAmountPaise: 10_000_000n }),
    ).toThrow(ComplianceHardBlockError);
  });

  it('allows existing Rs 1L + new Rs 99,999 = exactly Rs 1,99,999', () => {
    expect(() =>
      enforce269ST({ ...BASE, existingDailyPaise: 10_000_000n, cashAmountPaise: 9_999_900n }),
    ).not.toThrow();
  });

  it('includes allowedRemainingPaise in error meta', () => {
    try {
      enforce269ST({ ...BASE, existingDailyPaise: 15_000_000n, cashAmountPaise: 10_000_000n });
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as ComplianceHardBlockError;
      // 19_999_900 - 15_000_000 = 4_999_900
      expect(err.meta['allowedRemainingPaise']).toBe('4999900');
    }
  });

  it('clamps allowedRemainingPaise to 0 when existing already exceeds limit', () => {
    try {
      enforce269ST({ ...BASE, existingDailyPaise: 25_000_000n, cashAmountPaise: 1n });
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as ComplianceHardBlockError;
      expect(err.meta['allowedRemainingPaise']).toBe('0');
    }
  });

  it('includes projectedPaise in error meta', () => {
    try {
      enforce269ST({ ...BASE, existingDailyPaise: 10_000_000n, cashAmountPaise: 15_000_000n });
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as ComplianceHardBlockError;
      expect(err.meta['projectedPaise']).toBe('25000000');
    }
  });
});

describe('buildCashCapOverride', () => {
  const projected = 20_500_000n;

  it('returns override metadata for shop_admin (OWNER)', () => {
    const result = buildCashCapOverride(
      { role: 'shop_admin', justification: 'Customer is a known regular' },
      projected,
    );
    expect(result.type).toBe('269ST');
    expect(result.overrideActorRole).toBe('shop_admin');
    expect(result.justification).toBe('Customer is a known regular');
    expect(result.limitPaise).toBe(SECTION_269ST_LIMIT_PAISE.toString());
    expect(result.projectedPaise).toBe(projected.toString());
    expect(result.overriddenAt).toBeTruthy();
  });

  it('returns override metadata for shop_manager (MANAGER)', () => {
    const result = buildCashCapOverride(
      { role: 'shop_manager', justification: 'Emergency bulk purchase approved' },
      projected,
    );
    expect(result.overrideActorRole).toBe('shop_manager');
  });

  it('throws compliance.override.role_required for shop_staff', () => {
    expect(() =>
      buildCashCapOverride({ role: 'shop_staff', justification: 'I should not be able to this' }, projected),
    ).toThrow(expect.objectContaining({ code: 'compliance.override.role_required' }));
  });

  it('throws compliance.override.role_required for unknown role', () => {
    expect(() =>
      buildCashCapOverride({ role: 'platform_admin', justification: 'Cross-tenant admin attempt' }, projected),
    ).toThrow(expect.objectContaining({ code: 'compliance.override.role_required' }));
  });

  it('throws compliance.override.justification_too_short when < 10 chars', () => {
    expect(() =>
      buildCashCapOverride({ role: 'shop_admin', justification: 'Short' }, projected),
    ).toThrow(expect.objectContaining({ code: 'compliance.override.justification_too_short' }));
  });

  it('trims whitespace before length check on justification', () => {
    expect(() =>
      buildCashCapOverride({ role: 'shop_admin', justification: '   abc   ' }, projected),
    ).toThrow(expect.objectContaining({ code: 'compliance.override.justification_too_short' }));
  });

  it('stores trimmed justification in result', () => {
    const result = buildCashCapOverride(
      { role: 'shop_admin', justification: '  Valid justification here  ' },
      projected,
    );
    expect(result.justification).toBe('Valid justification here');
  });
});
