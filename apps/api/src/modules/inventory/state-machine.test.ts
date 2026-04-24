import { describe, it, expect } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  isValidTransition,
  assertValidTransition,
  TRANSITIONS,
  type ProductStatus,
} from './state-machine';

describe('ProductStatus state machine', () => {
  describe('TRANSITIONS table', () => {
    it('IN_STOCK can transition to RESERVED, ON_APPROVAL, WITH_KARIGAR, SOLD', () => {
      expect(TRANSITIONS.IN_STOCK).toEqual(
        expect.arrayContaining(['RESERVED', 'ON_APPROVAL', 'WITH_KARIGAR', 'SOLD']),
      );
      expect(TRANSITIONS.IN_STOCK).toHaveLength(4);
    });

    it('RESERVED can transition to IN_STOCK, ON_APPROVAL, SOLD', () => {
      expect(TRANSITIONS.RESERVED).toEqual(
        expect.arrayContaining(['IN_STOCK', 'ON_APPROVAL', 'SOLD']),
      );
      expect(TRANSITIONS.RESERVED).toHaveLength(3);
    });

    it('ON_APPROVAL can transition to IN_STOCK, RESERVED, SOLD', () => {
      expect(TRANSITIONS.ON_APPROVAL).toEqual(
        expect.arrayContaining(['IN_STOCK', 'RESERVED', 'SOLD']),
      );
      expect(TRANSITIONS.ON_APPROVAL).toHaveLength(3);
    });

    it('WITH_KARIGAR can only transition to IN_STOCK', () => {
      expect(TRANSITIONS.WITH_KARIGAR).toEqual(['IN_STOCK']);
    });

    it('SOLD is terminal — no outbound transitions', () => {
      expect(TRANSITIONS.SOLD).toHaveLength(0);
    });
  });

  describe('isValidTransition', () => {
    it.each([
      ['IN_STOCK', 'RESERVED'],
      ['IN_STOCK', 'ON_APPROVAL'],
      ['IN_STOCK', 'WITH_KARIGAR'],
      ['IN_STOCK', 'SOLD'],
      ['RESERVED', 'IN_STOCK'],
      ['RESERVED', 'ON_APPROVAL'],
      ['RESERVED', 'SOLD'],
      ['ON_APPROVAL', 'IN_STOCK'],
      ['ON_APPROVAL', 'RESERVED'],
      ['ON_APPROVAL', 'SOLD'],
      ['WITH_KARIGAR', 'IN_STOCK'],
    ] as [ProductStatus, ProductStatus][])(
      'allows %s → %s',
      (from, to) => { expect(isValidTransition(from, to)).toBe(true); },
    );

    it.each([
      ['SOLD', 'IN_STOCK'],
      ['SOLD', 'RESERVED'],
      ['SOLD', 'ON_APPROVAL'],
      ['SOLD', 'WITH_KARIGAR'],
      ['WITH_KARIGAR', 'RESERVED'],
      ['WITH_KARIGAR', 'SOLD'],
      ['WITH_KARIGAR', 'ON_APPROVAL'],
      ['IN_STOCK', 'IN_STOCK'],
    ] as [ProductStatus, ProductStatus][])(
      'blocks %s → %s',
      (from, to) => { expect(isValidTransition(from, to)).toBe(false); },
    );
  });

  describe('assertValidTransition', () => {
    it('does not throw for a valid transition', () => {
      expect(() => assertValidTransition('IN_STOCK', 'RESERVED')).not.toThrow();
    });

    it('throws UnprocessableEntityException for invalid transition', () => {
      expect(() => assertValidTransition('SOLD', 'IN_STOCK')).toThrow(UnprocessableEntityException);
    });

    it('sets error code inventory.invalid_status_transition', () => {
      try {
        assertValidTransition('WITH_KARIGAR', 'SOLD');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const body = (err as UnprocessableEntityException).getResponse() as Record<string, unknown>;
        expect(body.code).toBe('inventory.invalid_status_transition');
        expect(typeof body.message).toBe('string');
        expect((body.message as string)).toContain('WITH_KARIGAR');
        expect((body.message as string)).toContain('SOLD');
      }
    });

    it('includes from and to in error message for SOLD terminal case', () => {
      try {
        assertValidTransition('SOLD', 'RESERVED');
        expect.fail('should have thrown');
      } catch (err) {
        const body = (err as UnprocessableEntityException).getResponse() as Record<string, unknown>;
        expect((body.message as string)).toContain('SOLD');
        expect((body.message as string)).toContain('RESERVED');
      }
    });
  });
});
