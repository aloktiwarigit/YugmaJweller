import { describe, expect, it } from 'vitest';
import { IdempotencyKeyConflictError } from './billing.repository';

describe('BillingRepository.errorTypes', () => {
  it('IdempotencyKeyConflictError carries the offending key', () => {
    const e = new IdempotencyKeyConflictError('k1');
    expect(e.idempotencyKey).toBe('k1');
    expect(e.message).toContain('k1');
  });
});
