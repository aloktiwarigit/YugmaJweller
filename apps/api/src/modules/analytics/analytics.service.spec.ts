import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { AnalyticsService } from './analytics.service';

const SHOP    = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const PRODUCT = 'bbbbbbbb-cccc-4000-8000-000000000002';
const SESSION = 'cccccccc-dddd-4000-8000-000000000003';
const CUSTOMER = 'dddddddd-eeee-4000-8000-000000000004';

function makeMockClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

function makePool(client: ReturnType<typeof makeMockClient>) {
  return {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as import('pg').Pool;
}

function makeService(pool: import('pg').Pool): AnalyticsService {
  return new AnalyticsService(pool);
}

// Helper: set up client to handle the full withShopTx + consent + dedup + INSERT sequence
// Query call order: BEGIN, SET ROLE, SET shop_id, consent SELECT, dedup SELECT, INSERT, COMMIT, POISON (finally)
function setupClientForInsert(
  client: ReturnType<typeof makeMockClient>,
  opts: { consentRow?: { consent_given: boolean }; dedupRow?: { id: string } },
) {
  const q = client.query as Mock;
  q.mockResolvedValueOnce(undefined)                                  // BEGIN
   .mockResolvedValueOnce(undefined)                                  // SET LOCAL ROLE
   .mockResolvedValueOnce(undefined)                                  // SET LOCAL shop_id
   .mockResolvedValueOnce({ rows: opts.consentRow ? [opts.consentRow] : [] }) // consent SELECT
   .mockResolvedValueOnce({ rows: opts.dedupRow   ? [opts.dedupRow]   : [] }) // dedup SELECT
   .mockResolvedValueOnce(undefined)                                  // INSERT
   .mockResolvedValueOnce(undefined)                                  // COMMIT
   .mockResolvedValue(undefined);                                     // POISON (finally)
}

// Anonymous view: no consent query (skipped), just dedup + INSERT
function setupClientForAnonymous(client: ReturnType<typeof makeMockClient>) {
  const q = client.query as Mock;
  q.mockResolvedValueOnce(undefined)      // BEGIN
   .mockResolvedValueOnce(undefined)      // SET LOCAL ROLE
   .mockResolvedValueOnce(undefined)      // SET LOCAL shop_id
   .mockResolvedValueOnce({ rows: [] })   // dedup SELECT (no prior view)
   .mockResolvedValueOnce(undefined)      // INSERT
   .mockResolvedValueOnce(undefined)      // COMMIT
   .mockResolvedValue(undefined);         // POISON
}

describe('AnalyticsService.recordView', () => {
  it('inserts a row when consent_given=true', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: { consent_given: true } });
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeDefined();
  });

  it('does NOT insert when no consent row exists for customer', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: undefined });
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('does NOT insert when consent_given=false', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: { consent_given: false } });
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('does NOT insert when same session viewed same product within 30s', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: { consent_given: true }, dedupRow: { id: SESSION } });
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('inserts for anonymous view (no customerId) without consent check', async () => {
    const client = makeMockClient();
    setupClientForAnonymous(client);
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeDefined();
  });
});

describe('AnalyticsService.getProductViewSummary', () => {
  it('returns parsed aggregates for the requested period', async () => {
    const client = makeMockClient();
    const q = client.query as Mock;
    q.mockResolvedValueOnce(undefined)  // BEGIN
     .mockResolvedValueOnce(undefined)  // SET LOCAL ROLE
     .mockResolvedValueOnce(undefined)  // SET LOCAL shop_id
     .mockResolvedValueOnce({
       rows: [{ total_views: '42', unique_viewers: '17', avg_duration_seconds: '12.5' }],
     })                                 // aggregate SELECT
     .mockResolvedValueOnce(undefined)  // COMMIT
     .mockResolvedValue(undefined);     // POISON

    const svc = makeService(makePool(client));
    const result = await svc.getProductViewSummary({ shopId: SHOP, productId: PRODUCT, days: 30 });

    expect(result).toEqual({ totalViews: 42, uniqueViewers: 17, avgDurationSeconds: 12.5 });
  });

  it('returns null avgDurationSeconds when no durations recorded', async () => {
    const client = makeMockClient();
    const q = client.query as Mock;
    q.mockResolvedValueOnce(undefined)
     .mockResolvedValueOnce(undefined)
     .mockResolvedValueOnce(undefined)
     .mockResolvedValueOnce({
       rows: [{ total_views: '0', unique_viewers: '0', avg_duration_seconds: null }],
     })
     .mockResolvedValueOnce(undefined)
     .mockResolvedValue(undefined);

    const svc = makeService(makePool(client));
    const result = await svc.getProductViewSummary({ shopId: SHOP, productId: PRODUCT, days: 90 });

    expect(result.avgDurationSeconds).toBeNull();
    expect(result.totalViews).toBe(0);
  });
});
