import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerSessionService, type DecodedFirebaseToken } from '../customer-session.service';
import type { Pool, PoolClient } from 'pg';

// withShopTx does: BEGIN, SET LOCAL ROLE app_user, SELECT set_config (GUC), fn queries, COMMIT.
// On exception: ROLLBACK, then finally SELECT set_config (poison).
// makePool counts every client.query call in sequence.
function makePool(rows: Record<string, unknown>[][]): Pool {
  let callCount = 0;
  const client: Partial<PoolClient> = {
    query: vi.fn().mockImplementation(() => {
      const result = rows[callCount] ?? [];
      callCount++;
      return Promise.resolve({ rows: result });
    }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn(),
  } as unknown as Pool;
}

// Prepend the 3 withShopTx setup queries (BEGIN, SET LOCAL ROLE, SELECT set_config)
// and append COMMIT + poison finalizer so tests are readable.
function withTxSetup(fnRows: Record<string, unknown>[][]): Record<string, unknown>[][] {
  return [
    [],  // BEGIN
    [],  // SET LOCAL ROLE app_user
    [],  // SELECT set_config (GUC)
    ...fnRows,
    [],  // COMMIT
    [],  // SELECT set_config (poison, finally)
  ];
}

function withTxRollback(fnRows: Record<string, unknown>[][]): Record<string, unknown>[][] {
  return [
    [],  // BEGIN
    [],  // SET LOCAL ROLE app_user
    [],  // SELECT set_config (GUC)
    ...fnRows,
    [],  // ROLLBACK (on exception)
    [],  // SELECT set_config (poison, finally)
  ];
}

const SHOP_ID  = '11111111-1111-4111-8111-111111111111';
const TOKEN_BASE: DecodedFirebaseToken = {
  uid: 'firebase-uid-abc',
  phone_number: undefined,
  email: undefined,
  name: undefined,
};

describe('CustomerSessionService.findOrCreateCustomerByFirebaseToken', () => {
  let svc: CustomerSessionService;

  beforeEach(() => {
    svc = new CustomerSessionService();
  });

  it('Path 1 — returns existing customer when firebase_uid matches', async () => {
    const existingRow = { id: 'db-uuid-1', name: 'Priya', phone: '+919876543210', email: null, auth_provider: 'phone' };
    const pool = makePool(withTxSetup([
      [existingRow],  // SELECT WHERE firebase_uid = $uid FOR UPDATE
    ]));
    const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, { ...TOKEN_BASE });
    expect(result.customerId).toBe('db-uuid-1');
    expect(result.isNewUser).toBe(false);
  });

  it('Path 2 — links existing phone customer when firebase_uid not found but phone matches', async () => {
    const phoneRow = { id: 'db-uuid-2', name: 'Rahul', email: null };
    const pool = makePool(withTxSetup([
      [],                     // SELECT WHERE firebase_uid = $uid → not found
      [phoneRow],             // SELECT WHERE phone = $phone FOR UPDATE → found
      [{ id: 'db-uuid-2' }], // UPDATE SET firebase_uid RETURNING id
      [],                     // audit INSERT
    ]));
    const token: DecodedFirebaseToken = { ...TOKEN_BASE, phone_number: '+919876543210' };
    const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, token);
    expect(result.customerId).toBe('db-uuid-2');
    expect(result.isNewUser).toBe(false);
  });

  it('Path 3 — links existing email customer when firebase_uid and phone not found but email matches', async () => {
    const emailRow = { id: 'db-uuid-3', name: 'Ananya', phone: null, auth_provider: 'email_password' };
    const pool = makePool(withTxSetup([
      [],                     // SELECT WHERE firebase_uid = $uid → not found
      // no phone in token — phone path skipped entirely
      [emailRow],             // SELECT WHERE lower(email) = lower($email) → found
      [{ id: 'db-uuid-3' }], // UPDATE SET firebase_uid RETURNING id
      [],                     // audit INSERT
    ]));
    const token: DecodedFirebaseToken = { ...TOKEN_BASE, email: 'ananya@example.com', name: 'Ananya' };
    const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, token);
    expect(result.customerId).toBe('db-uuid-3');
    expect(result.isNewUser).toBe(false);
  });

  it('Path 4 — creates new customer when no existing record matches', async () => {
    const newRow = { id: 'db-uuid-4' };
    const pool = makePool(withTxSetup([
      [],       // SELECT WHERE firebase_uid = $uid → not found
      // no phone, no email in TOKEN_BASE
      [newRow], // INSERT RETURNING id
      [],       // audit INSERT
    ]));
    const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, { ...TOKEN_BASE });
    expect(result.customerId).toBe('db-uuid-4');
    expect(result.isNewUser).toBe(true);
  });

  it('Path 4 — throws when INSERT returns no rows (concurrent race: DO NOTHING fired)', async () => {
    const pool = makePool(withTxRollback([
      [], // firebase_uid not found
      // no phone, no email
      [], // INSERT returns no rows (DO NOTHING raced)
    ]));
    await expect(
      svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, { ...TOKEN_BASE }),
    ).rejects.toMatchObject({ response: { code: 'customer.race_condition' } });
  });
});
