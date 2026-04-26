/**
 * Story 5.7 — PaymentService tests for Razorpay payment methods.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';

// ── Mocks MUST be at top (hoisted by vitest) ─────────────────────────────────

const mockWithTenantTx = vi.fn();
const mockTenantContext = vi.fn().mockReturnValue({
  authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin',
});

vi.mock('@goldsmith/db', () => ({ withTenantTx: mockWithTenantTx }));
vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: { requireCurrent: mockTenantContext },
}));

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
}

function makePool() {
  const client = makeClient();
  return {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    _client: client,
  };
}

function makeRedis() {
  return {
    set: vi.fn().mockResolvedValue('OK') as unknown,
    del: vi.fn().mockResolvedValue(1) as unknown,
  } as unknown as Redis;
}

function makeAdapter() {
  return {
    createOrder: vi.fn().mockResolvedValue({ orderId: 'order_001', amountPaise: 100000n }),
    verifyWebhookSignature: vi.fn().mockReturnValue(true),
    fetchPayment: vi.fn().mockResolvedValue({ id: 'pay_001', status: 'captured', amountPaise: 100000n }),
  };
}

// ── Service factory ────────────────────────────────────────────────────────────

async function makeService(opts?: { pool?: ReturnType<typeof makePool>; redis?: Redis; adapter?: ReturnType<typeof makeAdapter> }) {
  const { PaymentService } = await import('./payment.service');
  const pool    = opts?.pool    ?? makePool();
  const redis   = opts?.redis   ?? makeRedis();
  const adapter = opts?.adapter ?? makeAdapter();
  const queue   = { add: vi.fn().mockResolvedValue({}) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new (PaymentService as any)(pool, redis, adapter, queue);
  return { svc: svc as InstanceType<typeof PaymentService>, pool, redis, adapter, queue };
}

const CTX = { authenticated: true, userId: 'u1', shopId: 's1', role: 'shop_admin' };
type Ctx = Parameters<InstanceType<typeof import('./payment.service').PaymentService>['initiateUpiPayment']>[0];

// ── Set up withTenantTx mock default before each test ─────────────────────────

beforeEach(() => {
  mockWithTenantTx.mockImplementation(async (_pool: Pool, fn: (tx: { query: ReturnType<typeof vi.fn> }) => Promise<void>) => {
    const tx = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, status FROM invoices')) return Promise.resolve({ rows: [{ id: 'inv_001', status: 'ISSUED' }] });
        if (sql.includes('RETURNING id')) return Promise.resolve({ rows: [{ id: 'pay_new_001' }] });
        return Promise.resolve({ rows: [] });
      }),
    };
    await fn(tx);
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('initiateUpiPayment', () => {
  it('calls createOrder and returns orderId', async () => {
    const { svc, adapter } = await makeService();
    const result = await svc.initiateUpiPayment(CTX as Ctx, 'inv_001', 100000n);
    expect(result.orderId).toBe('order_001');
    expect(adapter.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 100000n, currency: 'INR' })
    );
  });

  it('does not insert a payment row when createOrder throws (no orphan)', async () => {
    const adapter = makeAdapter();
    adapter.createOrder.mockRejectedValueOnce(new Error('5xx'));
    const { svc } = await makeService({ adapter });
    mockWithTenantTx.mockClear();
    await expect(svc.initiateUpiPayment(CTX as Ctx, 'inv_001', 100000n)).rejects.toThrow('5xx');
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });
});

describe('recordManualPayment', () => {
  it('returns CONFIRMED payment immediately', async () => {
    const { svc } = await makeService();
    const result = await svc.recordManualPayment(CTX as Ctx, 'inv_001', { method: 'CARD', amountPaise: 50000n });
    expect(result.status).toBe('CONFIRMED');
    expect(result.method).toBe('CARD');
  });
});

describe('confirmWebhookPayment', () => {
  it('confirms on first call (NX acquired)', async () => {
    const redis = makeRedis();
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValueOnce('OK');
    const pool = makePool();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'pay_001', invoice_id: 'inv_001', shop_id: 'shop_001' }] });
    pool._client.query.mockResolvedValue({ rows: [] });
    const { svc } = await makeService({ pool: pool as unknown as ReturnType<typeof makePool>, redis });
    await svc.confirmWebhookPayment('pay_rzp', 'order_rzp', 'shop_001');
    const updateCalls = pool._client.query.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status='CONFIRMED'")
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it('is a no-op on duplicate (NX miss)', async () => {
    const redis = makeRedis();
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const pool = makePool();
    const { svc } = await makeService({ pool: pool as unknown as ReturnType<typeof makePool>, redis });
    await svc.confirmWebhookPayment('pay_rzp', 'order_rzp', 'shop_001');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('releases lock for unknown orderId', async () => {
    const redis = makeRedis();
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValueOnce('OK');
    const pool = makePool(); // rows: [] — no matching payment
    pool.query.mockResolvedValueOnce({ rows: [] });
    const { svc } = await makeService({ pool: pool as unknown as ReturnType<typeof makePool>, redis });
    await expect(svc.confirmWebhookPayment('pay_unk', 'order_unk', 'shop_001')).resolves.toBeUndefined();
    expect(redis.del as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('payments:webhook:pay_unk');
  });

  it('duplicate webhooks 50ms apart → exactly one CONFIRMED update', async () => {
    let nxCount = 0;
    const redis = makeRedis();
    (redis.set as ReturnType<typeof vi.fn>).mockImplementation(async () => nxCount++ === 0 ? 'OK' : null);
    const pool = makePool();
    pool.query.mockResolvedValue({ rows: [{ id: 'pay_001', invoice_id: 'inv_001', shop_id: 'shop_001' }] });
    pool._client.query.mockResolvedValue({ rows: [] });
    const { svc } = await makeService({ pool: pool as unknown as ReturnType<typeof makePool>, redis });
    await Promise.all([
      svc.confirmWebhookPayment('pay_001', 'order_001', 'shop_001'),
      new Promise<void>(res => setTimeout(() => svc.confirmWebhookPayment('pay_001', 'order_001', 'shop_001').then(res), 50)),
    ]);
    const calls = pool._client.query.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status='CONFIRMED'")
    );
    expect(calls).toHaveLength(1);
  });
});
