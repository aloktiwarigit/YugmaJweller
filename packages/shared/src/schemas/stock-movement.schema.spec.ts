import { describe, it, expect } from 'vitest';
import { RecordMovementBodySchema } from './stock-movement.schema';

describe('RecordMovementBodySchema', () => {
  it('accepts a PURCHASE with positive delta', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'PURCHASE', quantityDelta: 5, reason: 'Karigar delivery',
    })).not.toThrow();
  });

  it('accepts a SALE with negative delta', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'SALE', quantityDelta: -2, reason: 'Walk-in customer',
    })).not.toThrow();
  });

  it('rejects PURCHASE with negative delta', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'PURCHASE', quantityDelta: -1, reason: 'invalid combo',
    })).toThrow(/DELTA_SIGN_MISMATCH/);
  });

  it('rejects SALE with positive delta', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'SALE', quantityDelta: 1, reason: 'invalid combo',
    })).toThrow(/DELTA_SIGN_MISMATCH/);
  });

  it('rejects ADJUSTMENT_IN with negative delta', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'ADJUSTMENT_IN', quantityDelta: -1, reason: 'invalid combo',
    })).toThrow(/DELTA_SIGN_MISMATCH/);
  });

  it('rejects TRANSFER_OUT with positive delta', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'TRANSFER_OUT', quantityDelta: 1, reason: 'invalid combo',
    })).toThrow(/DELTA_SIGN_MISMATCH/);
  });

  it('rejects zero delta', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'PURCHASE', quantityDelta: 0, reason: 'whatever reason',
    })).toThrow();
  });

  it('rejects reason shorter than 3 chars', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'PURCHASE', quantityDelta: 1, reason: 'ab',
    })).toThrow();
  });

  it('accepts optional sourceName + sourceId', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'PURCHASE',
      quantityDelta: 1,
      reason: 'transfer',
      sourceName: 'Shop B',
      sourceId: '11111111-1111-1111-1111-111111111111',
    })).not.toThrow();
  });

  it('rejects non-uuid sourceId', () => {
    expect(() => RecordMovementBodySchema.parse({
      type: 'PURCHASE', quantityDelta: 1, reason: 'transfer',
      sourceId: 'not-a-uuid',
    })).toThrow();
  });
});
