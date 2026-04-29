import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { UnprocessableEntityException } from '@nestjs/common';
import { LoyaltyService } from '../src/modules/loyalty/loyalty.service';
import { LoyaltyRepository } from '../src/modules/loyalty/loyalty.repository';
import { LoyaltyEventListener } from '../src/modules/loyalty/loyalty.event-listener';

const SHOP_A = 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-4000-8000-bbbbbbbbbbbb';
const USER_A = 'cccccccc-cccc-4000-8000-cccccccccccc';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let customerId: string;
let service: LoyaltyService;
let repo: LoyaltyRepository;

function makeCtx(shopId: string): UnauthenticatedTenantContext {
  const tenant: Tenant = { id: shopId, slug: `shop-${shopId.slice(0, 4)}`, display_name: 'Test', status: 'ACTIVE' };
  return { shopId, tenant, authenticated: false };
}

function makeAuthCtx(shopId: string): AuthenticatedTenantContext {
  const tenant: Tenant = { id: shopId, slug: `shop-${shopId.slice(0, 4)}`, display_name: 'Test', status: 'ACTIVE' };
  return { shopId, userId: USER_A, role: 'shop_admin', tenant, authenticated: true };
}

// Stub SettingsCache so service uses LOYALTY_DEFAULTS (1.00% earn rate).
const stubSettingsCache = { getLoyalty: async () => null } as never;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shops and one customer for SHOP_A.
  await pool.query(
    `INSERT INTO shops (id, slug, display_name, status)
     VALUES ($1, 'shop-a', 'Shop A', 'ACTIVE'),
            ($2, 'shop-b', 'Shop B', 'ACTIVE')`,
    [SHOP_A, SHOP_B],
  );

  const r = await tenantContext.runWith(makeCtx(SHOP_A), () =>
    withTenantTx(pool, async (tx) =>
      tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, viewing_consent, created_by_user_id)
         VALUES ($1, '+919876543210', 'Ravi Kumar', false, $2)
         RETURNING id`,
        [SHOP_A, USER_A],
      ),
    ),
  );
  customerId = r.rows[0]!.id;

  repo = new LoyaltyRepository(pool as never);
  service = new LoyaltyService(pool as never, repo, stubSettingsCache);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ─── helpers ────────────────────────────────────────────────────────────────

let invoiceSuffix = 1;

// Inserts a minimal ISSUED invoice and returns its UUID. invoices.id is required
// as FK by loyalty_transactions.invoice_id, so each accrual test needs a real row.
async function seedInvoice(shopId: string, cId: string): Promise<string> {
  const suffix = String(invoiceSuffix++).padStart(6, '0');
  const r = await pool.query<{ id: string }>(
    `INSERT INTO invoices
       (shop_id, invoice_number, customer_id, customer_name,
        subtotal_paise, gst_metal_paise, gst_making_paise, total_paise,
        idempotency_key, status, created_by_user_id)
     VALUES ($1, $2, $3, 'Ravi Kumar', 6842000, 205260, 34210, 7081470,
             $4, 'ISSUED', $5)
     RETURNING id`,
    [shopId, `INV-TEST-${suffix}`, cId, `idem-${suffix}`, USER_A],
  );
  return r.rows[0]!.id;
}

async function getBalance(cId: string, shopId: string): Promise<number> {
  const row = await tenantContext.runWith(makeCtx(shopId), () => repo.getState(cId));
  return row?.points_balance ?? 0;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('loyalty accrual integration (Story 8.1)', () => {
  it('math precision — ₹68,420 gold at 1% earn rate → 684 points', async () => {
    const goldValuePaise = 6_842_000n; // ₹68,420.00
    const iid = await seedInvoice(SHOP_A, customerId);

    const result = await tenantContext.runWith(makeCtx(SHOP_A), () =>
      service.accruePoints({ customerId, invoiceId: iid, goldValuePaise }),
    );

    expect(result.pointsDelta).toBe(684);
    expect(result.newBalance).toBe(684);
    expect(await getBalance(customerId, SHOP_A)).toBe(684);
  });

  it('concurrency — 2 parallel accruals serialize via FOR UPDATE; final balance = sum', async () => {
    const balanceBefore = await getBalance(customerId, SHOP_A);
    const [iid2, iid3] = await Promise.all([
      seedInvoice(SHOP_A, customerId),
      seedInvoice(SHOP_A, customerId),
    ]);

    const [r1, r2] = await Promise.all([
      tenantContext.runWith(makeCtx(SHOP_A), () =>
        service.accruePoints({ customerId, invoiceId: iid2, goldValuePaise: 1_000_000n }),
      ),
      tenantContext.runWith(makeCtx(SHOP_A), () =>
        service.accruePoints({ customerId, invoiceId: iid3, goldValuePaise: 1_000_000n }),
      ),
    ]);

    // Each ₹10,000 gold at 1% = 100 points
    expect(r1.pointsDelta).toBe(100);
    expect(r2.pointsDelta).toBe(100);
    expect(await getBalance(customerId, SHOP_A)).toBe(balanceBefore + 200);
  });

  it('idempotency — duplicate invoiceId → unique index blocks; balance unchanged', async () => {
    const balanceBefore = await getBalance(customerId, SHOP_A);
    const dupId = await seedInvoice(SHOP_A, customerId);

    // First call succeeds.
    await tenantContext.runWith(makeCtx(SHOP_A), () =>
      service.accruePoints({ customerId, invoiceId: dupId, goldValuePaise: 500_000n }),
    );
    const balanceAfterFirst = await getBalance(customerId, SHOP_A);

    // Second call with same invoiceId — unique index should reject it.
    await expect(
      tenantContext.runWith(makeCtx(SHOP_A), () =>
        service.accruePoints({ customerId, invoiceId: dupId, goldValuePaise: 500_000n }),
      ),
    ).rejects.toThrow();

    // Balance remains at post-first-call level; no double-accrual.
    expect(await getBalance(customerId, SHOP_A)).toBe(balanceAfterFirst);
    expect(balanceAfterFirst).toBeGreaterThan(balanceBefore);
  });

  it('walk-in skip — listener does not enqueue when customerId is null', async () => {
    const mockQueue = { add: vi.fn() };
    const listener = new LoyaltyEventListener(mockQueue as never);

    await listener.onInvoiceCreated({
      invoiceId:      'ffffffff-ffff-4000-8000-ffffffffffff',
      shopId:         SHOP_A,
      customerId:     null,
      goldValuePaise: '100000',
      issuedAt:       new Date().toISOString(),
    });

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('walk-in skip — listener does not enqueue when goldValuePaise is zero', async () => {
    const mockQueue = { add: vi.fn() };
    const listener = new LoyaltyEventListener(mockQueue as never);

    await listener.onInvoiceCreated({
      invoiceId:      'eeeeeeee-eeee-4000-8000-eeeeeeeeeeee',
      shopId:         SHOP_A,
      customerId,
      goldValuePaise: '0',
      issuedAt:       new Date().toISOString(),
    });

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('tenant isolation — SHOP_B cannot see SHOP_A loyalty aggregate (RLS → null)', async () => {
    // SHOP_A has an aggregate row from earlier tests.
    const stateA = await tenantContext.runWith(makeCtx(SHOP_A), () => repo.getState(customerId));
    expect(stateA).not.toBeNull();

    // SHOP_B context should see nothing (RLS hides cross-tenant rows).
    const stateB = await tenantContext.runWith(makeCtx(SHOP_B), () => repo.getState(customerId));
    expect(stateB).toBeNull();
  });

  it('DB trigger — UPDATE loyalty_transactions as app_user raises permission error', async () => {
    // Find a transaction row to attempt UPDATE on.
    const txRows = await pool.query<{ id: string }>(
      `SELECT id FROM loyalty_transactions WHERE shop_id = $1 LIMIT 1`,
      [SHOP_A],
    );
    expect(txRows.rows.length).toBeGreaterThan(0);
    const txId = txRows.rows[0]!.id;

    // Use BEGIN + SET LOCAL ROLE inside a transaction so the role change is effective.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_shop_id = '${SHOP_A}'`);
      await client.query('SET LOCAL ROLE app_user');

      await expect(
        client.query(`UPDATE loyalty_transactions SET reason = 'tampered' WHERE id = $1`, [txId]),
      ).rejects.toMatchObject({ code: expect.stringMatching(/^(42501|P0001)$/) });
      // 42501 = insufficient_privilege (role-level grant denial)
      // P0001 = raise_exception (SECURITY DEFINER trigger, fires on some Postgres builds before grant check)
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  });

  it('adjustPoints negative cap — balance 100, adjust -500 → UnprocessableEntityException', async () => {
    // Create a fresh customer with a known 100-point balance.
    const r = await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) =>
        tx.query<{ id: string }>(
          `INSERT INTO customers (shop_id, phone, name, viewing_consent, created_by_user_id)
           VALUES ($1, '+919000000001', 'Test Adjust', false, $2)
           RETURNING id`,
          [SHOP_A, USER_A],
        ),
      ),
    );
    const adjustCustomerId = r.rows[0]!.id;
    const seedInvoiceId = await seedInvoice(SHOP_A, adjustCustomerId);

    // Seed 100 points inside tenant context (withTenantTx requires it).
    await tenantContext.runWith(makeCtx(SHOP_A), () =>
      withTenantTx(pool, async (tx) => {
        await repo.lockOrCreateAggregate(tx, SHOP_A, adjustCustomerId);
        await repo.insertTransaction(tx, SHOP_A, {
          customerId: adjustCustomerId,
          invoiceId: seedInvoiceId,
          type: 'ACCRUAL',
          pointsDelta: 100,
          balanceBefore: 0,
          balanceAfter: 100,
          reason: 'seed for adjust test',
          createdByUserId: null,
        });
        await repo.updateAggregate(tx, SHOP_A, {
          customerId: adjustCustomerId,
          pointsDelta: 100,
          lifetimeDelta: 100,
        });
      }),
    );

    // Attempt -500 → should throw UnprocessableEntityException.
    await expect(
      tenantContext.runWith(makeAuthCtx(SHOP_A), () =>
        service.adjustPoints(adjustCustomerId, { pointsDelta: -500, reason: 'refund test' }),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
