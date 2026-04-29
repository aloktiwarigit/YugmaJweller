/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BalanceService } from './balance.service';
import type { CrmRepository } from './crm.repository';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER_ID = 'eeeeeeee-ffff-4000-8000-000000000003';

function authCtx(role = 'shop_admin'): any {
  return {
    authenticated: true as const,
    shopId: SHOP,
    userId: USER,
    role,
    tenant: { id: SHOP, slug: 'test', display_name: 'Test Shop', status: 'ACTIVE' as const },
  };
}

// Builds a fake Pool client whose query responses are keyed by SQL patterns.
// withShopTx calls pool.connect() → client.query(BEGIN/SET LOCAL/...) → our queries → COMMIT.
function fakePoolWithSqlMap(sqlMap: Record<string, any>) {
  const client = {
    query: vi.fn(async (sql: string, params?: any[]) => {
      for (const [pattern, response] of Object.entries(sqlMap)) {
        if (sql.includes(pattern)) {
          return typeof response === 'function' ? response(sql, params) : response;
        }
      }
      return { rows: [] }; // default: BEGIN / COMMIT / SET LOCAL / ROLLBACK
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) } as unknown as import('pg').Pool;
  return { pool, client };
}

function fakeCrmRepo(customer: any = { id: CUSTOMER_ID }): CrmRepository {
  return {
    getCustomerById: vi.fn(async () => customer),
    insertCustomer: vi.fn(), listCustomers: vi.fn(), updateCustomer: vi.fn(),
  } as unknown as CrmRepository;
}

function makeSvc(pool: any, crmRepo?: CrmRepository): BalanceService {
  return new BalanceService(pool, crmRepo ?? fakeCrmRepo());
}

// ─── recalculateBalance — math ────────────────────────────────────────────────

describe('recalculateBalance — math', () => {
  it('invoiced ₹50K paid ₹60K → advance ₹10K outstanding ₹0', async () => {
    const { pool, client } = fakePoolWithSqlMap({
      'FOR UPDATE':              { rows: [] },
      'total_invoiced':          { rows: [{ total_invoiced: 5_000_000n }] },
      'total_paid':              { rows: [{ total_paid: 6_000_000n }] },
      'INSERT INTO customer_balances': { rows: [] },
    });
    const svc = makeSvc(pool);
    await svc.recalculateBalance(authCtx(), CUSTOMER_ID);

    const upsertCall = (client.query as any).mock.calls.find((c: any[]) =>
      c[0]?.includes('INSERT INTO customer_balances'),
    );
    expect(upsertCall).toBeDefined();
    const params = upsertCall[1] as unknown[];
    // params: [shopId, customerId, outstanding, advance]
    expect(params[2]).toBe(0n);          // outstanding = max(0, 50K-60K) = 0
    expect(params[3]).toBe(1_000_000n);  // advance    = max(0, 60K-50K) = 10K (in paise)
  });

  it('invoiced ₹50K paid ₹30K → outstanding ₹20K advance ₹0', async () => {
    const { pool, client } = fakePoolWithSqlMap({
      'FOR UPDATE':              { rows: [] },
      'total_invoiced':          { rows: [{ total_invoiced: 5_000_000n }] },
      'total_paid':              { rows: [{ total_paid: 3_000_000n }] },
      'INSERT INTO customer_balances': { rows: [] },
    });
    const svc = makeSvc(pool);
    await svc.recalculateBalance(authCtx(), CUSTOMER_ID);

    const upsertCall = (client.query as any).mock.calls.find((c: any[]) =>
      c[0]?.includes('INSERT INTO customer_balances'),
    );
    const params = upsertCall[1] as unknown[];
    expect(params[2]).toBe(2_000_000n);  // outstanding = 50K - 30K = 20K
    expect(params[3]).toBe(0n);          // advance = 0
  });

  it('invoiced = paid → both zero', async () => {
    const { pool, client } = fakePoolWithSqlMap({
      'FOR UPDATE':              { rows: [] },
      'total_invoiced':          { rows: [{ total_invoiced: 5_000_000n }] },
      'total_paid':              { rows: [{ total_paid: 5_000_000n }] },
      'INSERT INTO customer_balances': { rows: [] },
    });
    const svc = makeSvc(pool);
    await svc.recalculateBalance(authCtx(), CUSTOMER_ID);

    const upsertCall = (client.query as any).mock.calls.find((c: any[]) =>
      c[0]?.includes('INSERT INTO customer_balances'),
    );
    const params = upsertCall[1] as unknown[];
    expect(params[2]).toBe(0n);
    expect(params[3]).toBe(0n);
  });
});

describe('recalculateBalance — FOR UPDATE lock', () => {
  it('issues SELECT FOR UPDATE on customer_balances to prevent concurrent recalculation', async () => {
    const { pool, client } = fakePoolWithSqlMap({
      'FOR UPDATE':              { rows: [] },
      'total_invoiced':          { rows: [{ total_invoiced: 0n }] },
      'total_paid':              { rows: [{ total_paid: 0n }] },
      'INSERT INTO customer_balances': { rows: [] },
    });
    const svc = makeSvc(pool);
    await svc.recalculateBalance(authCtx(), CUSTOMER_ID);

    const queries = (client.query as any).mock.calls.map((c: any[]) => c[0] as string);
    const forUpdateQuery = queries.find((q: string) => /FOR UPDATE/.test(q));
    expect(forUpdateQuery).toBeDefined();
    expect(forUpdateQuery).toMatch(/customer_balances/);
  });
});

describe('BalanceService event handlers', () => {
  it('handleInvoiceEvent triggers recalculateBalance for named customer', async () => {
    const { pool } = fakePoolWithSqlMap({
      'FOR UPDATE':              { rows: [] },
      'total_invoiced':          { rows: [{ total_invoiced: 0n }] },
      'total_paid':              { rows: [{ total_paid: 0n }] },
      'INSERT INTO customer_balances': { rows: [] },
    });
    const svc = makeSvc(pool);
    const spy = vi.spyOn(svc, 'recalculateBalance');

    await svc.handleInvoiceEvent({ shopId: SHOP, customerId: CUSTOMER_ID, invoiceId: 'inv-1' });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: SHOP }),
      CUSTOMER_ID,
    );
  });

  it('handleInvoiceEvent is a no-op when customerId is null (walk-in customer)', async () => {
    const { pool } = fakePoolWithSqlMap({});
    const svc = makeSvc(pool);
    const spy = vi.spyOn(svc, 'recalculateBalance');

    await svc.handleInvoiceEvent({ shopId: SHOP, customerId: null, invoiceId: 'inv-1' });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('getBalance', () => {
  it('returns balance for a known customer', async () => {
    const row = { id: 'bal-1', shop_id: SHOP, customer_id: CUSTOMER_ID, outstanding_paise: 2_000_000n, advance_paise: 0n, last_updated_at: new Date() };
    const { pool } = fakePoolWithSqlMap({ 'FROM customer_balances': { rows: [row] } });
    const svc = makeSvc(pool);
    const result = await svc.getBalance(authCtx(), CUSTOMER_ID);
    expect(result.outstandingPaise).toBe('2000000');
    expect(result.advancePaise).toBe('0');
  });

  it('returns zero balance when no row exists yet', async () => {
    const { pool } = fakePoolWithSqlMap({ 'FROM customer_balances': { rows: [] } });
    const svc = makeSvc(pool);
    const result = await svc.getBalance(authCtx(), CUSTOMER_ID);
    expect(result.outstandingPaise).toBe('0');
    expect(result.advancePaise).toBe('0');
  });

  it('throws NotFoundException for unknown/cross-tenant customer', async () => {
    const { pool } = fakePoolWithSqlMap({});
    const svc = makeSvc(pool, fakeCrmRepo(null));
    await expect(svc.getBalance(authCtx(), CUSTOMER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
