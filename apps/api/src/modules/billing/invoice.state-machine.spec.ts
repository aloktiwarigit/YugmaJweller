import { describe, it, expect } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { canVoid, assertCanVoid } from './invoice.state-machine';

const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

function issuedAt(offsetMs: number): Date {
  return new Date(Date.now() - offsetMs);
}

describe('canVoid', () => {
  it('returns true for ISSUED invoice within 24h', () => {
    expect(canVoid({ status: 'ISSUED', issuedAt: issuedAt(60_000) })).toBe(true);
  });

  it('returns false for ISSUED invoice at 24h+1min', () => {
    expect(canVoid({ status: 'ISSUED', issuedAt: issuedAt(VOID_WINDOW_MS + 60_000) })).toBe(false);
  });

  it('returns false for ISSUED invoice with null issuedAt', () => {
    expect(canVoid({ status: 'ISSUED', issuedAt: null })).toBe(false);
  });

  it('returns false for DRAFT invoice', () => {
    expect(canVoid({ status: 'DRAFT', issuedAt: issuedAt(60_000) })).toBe(false);
  });

  it('returns false for VOIDED invoice', () => {
    expect(canVoid({ status: 'VOIDED', issuedAt: issuedAt(60_000) })).toBe(false);
  });
});

describe('assertCanVoid', () => {
  it('throws billing.void.invalid_status for DRAFT', () => {
    expect(() => assertCanVoid({ status: 'DRAFT', issuedAt: issuedAt(60_000), id: 'inv-1' }))
      .toThrow(UnprocessableEntityException);
    try {
      assertCanVoid({ status: 'DRAFT', issuedAt: issuedAt(60_000), id: 'inv-1' });
    } catch (e) {
      expect((e as UnprocessableEntityException).getResponse()).toMatchObject({
        code: 'billing.void.invalid_status',
      });
    }
  });

  it('throws billing.void.invalid_status for VOIDED', () => {
    try {
      assertCanVoid({ status: 'VOIDED', issuedAt: issuedAt(60_000), id: 'inv-1' });
    } catch (e) {
      expect((e as UnprocessableEntityException).getResponse()).toMatchObject({
        code: 'billing.void.invalid_status',
      });
    }
  });

  it('throws billing.void.window_expired when outside 24h window', () => {
    try {
      assertCanVoid({ status: 'ISSUED', issuedAt: issuedAt(VOID_WINDOW_MS + 60_000), id: 'inv-1' });
    } catch (e) {
      const resp = (e as UnprocessableEntityException).getResponse() as Record<string, unknown>;
      expect(resp.code).toBe('billing.void.window_expired');
      expect(resp.meta).toBeDefined();
    }
  });

  it('throws billing.void.window_expired for null issuedAt', () => {
    try {
      assertCanVoid({ status: 'ISSUED', issuedAt: null, id: 'inv-1' });
    } catch (e) {
      expect((e as UnprocessableEntityException).getResponse()).toMatchObject({
        code: 'billing.void.window_expired',
      });
    }
  });

  it('does not throw for ISSUED invoice within 24h', () => {
    expect(() =>
      assertCanVoid({ status: 'ISSUED', issuedAt: issuedAt(60_000), id: 'inv-1' }),
    ).not.toThrow();
  });
});
