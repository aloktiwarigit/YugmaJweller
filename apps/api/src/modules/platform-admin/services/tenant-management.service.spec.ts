import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantManagementService } from './tenant-management.service';

const SHOP_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_UID = 'platform-admin-uid';

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

describe('TenantManagementService', () => {
  let pool: { connect: ReturnType<typeof vi.fn> };
  let client: MockClient;
  let cache: { invalidate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
    cache = { invalidate: vi.fn() };
  });

  // All write helpers run inside BEGIN/SET LOCAL ROLE/.../COMMIT, so query indexes are
  // shifted by 2 from a pre-transaction baseline (calls[0]=BEGIN, calls[1]=SET LOCAL ROLE).

  it('createShop inserts shop, returns id, audits tenant.created', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ id: SHOP_ID }] })     // INSERT shops
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // COMMIT

    const svc = new TenantManagementService(pool as never, cache as never);
    const out = await svc.createShop({ slug: 'demo', displayName: 'Demo Jewellers', platformUserId: ADMIN_UID });

    expect(out.id).toBe(SHOP_ID);
    expect(client.query.mock.calls[2]![0]).toMatch(/INSERT INTO shops/);
    expect(client.query.mock.calls[3]![1]).toContain('tenant.created');
    expect(client.query.mock.calls[3]![1]).toContain(ADMIN_UID);
  });

  it('suspendShop sets status SUSPENDED, audits, invalidates cache', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 1 })                 // UPDATE
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // COMMIT

    const svc = new TenantManagementService(pool as never, cache as never);
    await svc.suspendShop(SHOP_ID, 'overdue invoice', ADMIN_UID);

    expect(client.query.mock.calls[2]![0]).toMatch(/UPDATE shops SET status = 'SUSPENDED'/);
    expect(client.query.mock.calls[3]![1]).toContain('tenant.suspended');
    expect(cache.invalidate).toHaveBeenCalledWith(SHOP_ID);
  });

  it('suspendShop 404s when shop missing or already terminated', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 0 })                 // UPDATE returns 0 → throws
      .mockResolvedValueOnce(undefined);                      // ROLLBACK

    const svc = new TenantManagementService(pool as never, cache as never);
    await expect(svc.suspendShop('00000000-0000-0000-0000-000000000000', 'r', ADMIN_UID))
      .rejects.toMatchObject({ response: { code: 'tenant.not_found' } });
  });

  it('unsuspendShop sets status ACTIVE and audits', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 1 })                 // UPDATE
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // COMMIT

    const svc = new TenantManagementService(pool as never, cache as never);
    await svc.unsuspendShop(SHOP_ID, ADMIN_UID);

    expect(client.query.mock.calls[2]![0]).toMatch(/UPDATE shops SET status = 'ACTIVE'/);
    expect(client.query.mock.calls[3]![1]).toContain('tenant.unsuspended');
    expect(cache.invalidate).toHaveBeenCalledWith(SHOP_ID);
  });

  it('updateShop builds dynamic SET clause and invalidates cache', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 1 })                 // UPDATE
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // COMMIT

    const svc = new TenantManagementService(pool as never, cache as never);
    await svc.updateShop({
      shopId: SHOP_ID,
      platformUserId: ADMIN_UID,
      patch: { displayName: 'New', contactPhone: '+919999' },
    });

    const setSql = client.query.mock.calls[2]![0] as string;
    expect(setSql).toMatch(/display_name = \$1/);
    expect(setSql).toMatch(/contact_phone = \$2/);
    expect(cache.invalidate).toHaveBeenCalledWith(SHOP_ID);
  });

  it('updateShop with empty patch is a no-op', async () => {
    const svc = new TenantManagementService(pool as never, cache as never);
    await svc.updateShop({ shopId: SHOP_ID, platformUserId: ADMIN_UID, patch: {} });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('listShops paginates and supports search', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // BEGIN
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({
        rows: [{ id: SHOP_ID, slug: 'demo', display_name: 'Demo', status: 'ACTIVE', created_at: '2026-01-01' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ count: '17' }] })
      .mockResolvedValueOnce(undefined);                      // COMMIT

    const svc = new TenantManagementService(pool as never, cache as never);
    const out = await svc.listShops({ page: 2, pageSize: 20, search: 'dem' });

    expect(out.items).toHaveLength(1);
    expect(out.total).toBe(17);
    const select = client.query.mock.calls[2]![0] as string;
    expect(select).toMatch(/ILIKE/);
    expect(select).toMatch(/LIMIT \$1 OFFSET \$2/);
  });
});
