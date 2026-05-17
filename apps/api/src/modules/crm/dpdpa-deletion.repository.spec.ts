// apps/api/src/modules/crm/dpdpa-deletion.repository.spec.ts
//
// Story 19.7 — cascade extension unit tests.
// Tests run with a fake Pool/PoolClient; SQL strings are asserted via
// regex against the captured tx.query() calls. Integration tests against
// real Postgres live in apps/api/test/dpdpa-self-deletion-cascade.integration.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { DpdpaDeletionRepository } from './dpdpa-deletion.repository';

// ── Mock @goldsmith/db so we can stub withTenantTx ──────────────────────────
vi.mock('@goldsmith/db', () => ({
  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: unknown) => unknown) => {
    return fn(mockTx);
  }),
}));

const CUSTOMER = '11111111-2222-4000-8000-000000000001';

let mockTx: { query: ReturnType<typeof vi.fn> };
let repo: DpdpaDeletionRepository;

beforeEach(() => {
  mockTx = { query: vi.fn() };
  // Default: SELECT FOR UPDATE returns one undeleted row; UPDATE returns one row;
  // DRAFT-invoice and dispatched-try-at-home counts both 0.
  mockTx.query
    .mockResolvedValueOnce({ rows: [{ deleted_at: null }] })                            // SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [{ count: '0' }] })                                   // DRAFT count
    .mockResolvedValueOnce({ rows: [{ count: '0' }] })                                   // DISPATCHED try-at-home count
    .mockResolvedValue({                                                                 // catch-all for the rest
      rows: [{ deleted_at: new Date('2026-05-17Z'), hard_delete_scheduled_at: new Date('2026-06-16Z') }],
      rowCount: 1,
    });
  repo = new DpdpaDeletionRepository({} as never);
});

describe('softDeleteAtomic cascade', () => {
  it('hard-deletes wishlist rows for the customer inside the same tx', async () => {
    await repo.softDeleteAtomic(CUSTOMER, 'customer', { reason: 'privacy' });

    const calls = mockTx.query.mock.calls.map((c) => c[0] as string);
    const wishlistCall = calls.find((sql) => /DELETE FROM wishlists/i.test(sql));
    expect(wishlistCall).toBeDefined();
    expect(wishlistCall).toMatch(/customer_id = \$1/);
    expect(wishlistCall).toMatch(/current_setting\('app\.current_shop_id'\)/);
  });

  it('anonymises product_reviews by NULL-ing customer_id', async () => {
    await repo.softDeleteAtomic(CUSTOMER, 'customer', { reason: 'privacy' });

    const calls = mockTx.query.mock.calls.map((c) => c[0] as string);
    const reviewsCall = calls.find((sql) => /UPDATE product_reviews/i.test(sql));
    expect(reviewsCall).toBeDefined();
    expect(reviewsCall).toMatch(/SET customer_id = NULL/);
    expect(reviewsCall).toMatch(/WHERE customer_id = \$1/);
    expect(reviewsCall).toMatch(/current_setting\('app\.current_shop_id'\)/);
  });

  it('cancels active and pending rate-lock bookings', async () => {
    await repo.softDeleteAtomic(CUSTOMER, 'customer', { reason: 'no-need' });

    const calls = mockTx.query.mock.calls.map((c) => c[0] as string);
    const rateLockCall = calls.find((sql) => /UPDATE rate_lock_bookings/i.test(sql));
    expect(rateLockCall).toBeDefined();
    expect(rateLockCall).toMatch(/SET status = 'CANCELLED'/);
    expect(rateLockCall).toMatch(/status IN \('PENDING_PAYMENT','ACTIVE'\)/);
    expect(rateLockCall).toMatch(/WHERE customer_id = \$1/);
  });

  it('blocks deletion when try-at-home is DISPATCHED', async () => {
    mockTx.query.mockReset();
    // First call: dispatched count = 1 → throws UnprocessableEntityException
    mockTx.query
      .mockResolvedValueOnce({ rows: [{ deleted_at: null }] })                  // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })                         // DRAFT count
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });                        // DISPATCHED count = 1

    await expect(
      repo.softDeleteAtomic(CUSTOMER, 'customer', { reason: 'privacy' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    // Reset again for second call assertion on the error code
    mockTx.query.mockReset();
    mockTx.query
      .mockResolvedValueOnce({ rows: [{ deleted_at: null }] })                  // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })                         // DRAFT count
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });                        // DISPATCHED count = 1

    await expect(
      repo.softDeleteAtomic(CUSTOMER, 'customer', { reason: 'privacy' }),
    ).rejects.toMatchObject({
      response: { code: 'crm.deletion.try_at_home_in_flight' },
    });
  });

  it('cancels REQUESTED try-at-home bookings (DISPATCHED already blocked above)', async () => {
    await repo.softDeleteAtomic(CUSTOMER, 'customer', { reason: 'no-need' });

    const calls = mockTx.query.mock.calls.map((c) => c[0] as string);
    const tahCall = calls.find((sql) =>
      /UPDATE try_at_home_bookings/i.test(sql) && /SET status = 'CANCELLED'/i.test(sql),
    );
    expect(tahCall).toBeDefined();
    expect(tahCall).toMatch(/status = 'REQUESTED'/);
  });

  it('persists deletion_reason and deletion_reason_text to customers UPDATE', async () => {
    await repo.softDeleteAtomic(CUSTOMER, 'customer', {
      reason: 'other',
      reasonText: 'मुझे यह ऐप पसंद नहीं',
    });

    const calls = mockTx.query.mock.calls.map((c) => c[0] as string);
    // Match the customers UPDATE (it contains 'Deleted Customer' as a literal)
    const updateCall = calls.find((sql) =>
      /UPDATE customers/i.test(sql) && /Deleted Customer/i.test(sql),
    );
    expect(updateCall).toBeDefined();
    expect(updateCall).toMatch(/deletion_reason\s*=/);
    expect(updateCall).toMatch(/deletion_reason_text\s*=/);

    // Confirm the params include the reason values
    const updateCallArgs = mockTx.query.mock.calls.find((c) =>
      typeof c[0] === 'string' && /UPDATE customers/i.test(c[0]) && /Deleted Customer/i.test(c[0]),
    )?.[1] as unknown[];
    expect(updateCallArgs).toContain('other');
    expect(updateCallArgs).toContain('मुझे यह ऐप पसंद नहीं');
  });

  it('returns cascadeCounts and rateLockRefundsPending in SoftDeleteResult', async () => {
    // Override query mocks so the cascade UPDATE/DELETEs return realistic rowCounts.
    mockTx.query.mockReset();
    mockTx.query
      .mockResolvedValueOnce({ rows: [{ deleted_at: null }] })                                                   // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })                                                          // DRAFT count
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })                                                          // DISPATCHED count
      .mockResolvedValueOnce({ rows: [{ deleted_at: new Date(), hard_delete_scheduled_at: new Date(Date.now() + 30 * 86400_000) }] }) // UPDATE customers
      .mockResolvedValueOnce({ rowCount: 3 })                                                                     // DELETE wishlists
      .mockResolvedValueOnce({ rowCount: 2 })                                                                     // UPDATE product_reviews
      .mockResolvedValueOnce({ rows: [{ refunds_pending: '1', total: '1' }] })                                    // UPDATE rate_lock with refunds
      .mockResolvedValueOnce({ rowCount: 1 })                                                                     // UPDATE try-at-home
      .mockResolvedValueOnce({ rowCount: 0 })                                                                     // DELETE family_members
      .mockResolvedValueOnce({ rows: [{ has_notes: false, has_occasions: false, has_balances: false }] })         // probeChildTables
      .mockResolvedValue({ rowCount: 0 });                                                                        // catch-all

    const result = await repo.softDeleteAtomic(CUSTOMER, 'customer', { reason: 'privacy' });

    expect(result.cascadeCounts).toEqual({
      wishlists: 3,
      reviews:   2,
      rateLocks: expect.any(Number),
      tryAtHome: 1,
    });
    expect(result.rateLockRefundsPending).toBe(1);
  });
});
