import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PlatformAdminController } from './platform-admin.controller';
import { TenantManagementService } from './services/tenant-management.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';
import { ImpersonationService } from './services/impersonation.service';
import { DataExportService } from './services/data-export.service';

const PLATFORM_UID = 'firebase-platform-uid';
const SHOP_ID = '11111111-1111-1111-1111-111111111111';
const SESSION_ID = '22222222-2222-2222-2222-222222222222';

const fakeReq = (uid = PLATFORM_UID) => ({ headers: { 'user-agent': 'test-ua' }, user: { uid } }) as never;

describe('PlatformAdminController', () => {
  let controller: PlatformAdminController;
  let tenants: { createShop: ReturnType<typeof vi.fn>; listShops: ReturnType<typeof vi.fn>; updateShop: ReturnType<typeof vi.fn>; suspendShop: ReturnType<typeof vi.fn>; unsuspendShop: ReturnType<typeof vi.fn> };
  let subs: { upsertSubscription: ReturnType<typeof vi.fn>; listSubscriptions: ReturnType<typeof vi.fn> };
  let metrics: { getMetrics: ReturnType<typeof vi.fn> };
  let impersonation: { startImpersonation: ReturnType<typeof vi.fn>; endImpersonation: ReturnType<typeof vi.fn> };
  let exports: { exportTenant: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    tenants = {
      createShop: vi.fn().mockResolvedValue({ id: SHOP_ID }),
      listShops: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      updateShop: vi.fn().mockResolvedValue(undefined),
      suspendShop: vi.fn().mockResolvedValue(undefined),
      unsuspendShop: vi.fn().mockResolvedValue(undefined),
    };
    subs = {
      upsertSubscription: vi.fn().mockResolvedValue({ id: 'sub-1' }),
      listSubscriptions: vi.fn().mockResolvedValue([]),
    };
    metrics = { getMetrics: vi.fn().mockResolvedValue({ totalShops: 1, activeShops: 1, invoicesLast30Days: 0 }) };
    impersonation = {
      startImpersonation: vi.fn().mockResolvedValue({ sessionId: SESSION_ID, token: 'jwt', expiresAt: '2026-01-01T00:00:00Z' }),
      endImpersonation: vi.fn().mockResolvedValue(undefined),
    };
    exports = { exportTenant: vi.fn().mockResolvedValue({ shop: {}, customers: [], invoices: [], payments: [], exported_at: '', excluded: [] }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformAdminController],
      providers: [
        Reflector,
        { provide: TenantManagementService, useValue: tenants },
        { provide: SubscriptionService, useValue: subs },
        { provide: MetricsService, useValue: metrics },
        { provide: ImpersonationService, useValue: impersonation },
        { provide: DataExportService, useValue: exports },
      ],
    }).compile();

    controller = module.get(PlatformAdminController);
  });

  it('createTenant forwards platformUid from req.user.uid', async () => {
    const out = await controller.createTenant({ slug: 'demo', displayName: 'Demo' }, fakeReq());
    expect(out).toEqual({ id: SHOP_ID });
    expect(tenants.createShop).toHaveBeenCalledWith({ slug: 'demo', displayName: 'Demo', platformUserId: PLATFORM_UID });
  });

  it('listTenants clamps pageSize to 100', async () => {
    await controller.listTenants('1', '500', undefined);
    expect(tenants.listShops).toHaveBeenCalledWith({ page: 1, pageSize: 100, search: undefined });
  });

  it('listTenants clamps pageSize to minimum 1', async () => {
    await controller.listTenants('1', '0', undefined);
    expect(tenants.listShops).toHaveBeenCalledWith({ page: 1, pageSize: 1, search: undefined });
  });

  it('updateTenant forwards path id + body + platformUid', async () => {
    await controller.updateTenant(SHOP_ID, { displayName: 'New' }, fakeReq());
    expect(tenants.updateShop).toHaveBeenCalledWith({
      shopId: SHOP_ID,
      patch: { displayName: 'New' },
      platformUserId: PLATFORM_UID,
    });
  });

  it('suspend forwards reason + platformUid', async () => {
    await controller.suspend(SHOP_ID, { reason: 'overdue' }, fakeReq());
    expect(tenants.suspendShop).toHaveBeenCalledWith(SHOP_ID, 'overdue', PLATFORM_UID);
  });

  it('unsuspend forwards platformUid', async () => {
    await controller.unsuspend(SHOP_ID, fakeReq());
    expect(tenants.unsuspendShop).toHaveBeenCalledWith(SHOP_ID, PLATFORM_UID);
  });

  it('export forwards shopId + platformUid', async () => {
    await controller.export(SHOP_ID, fakeReq());
    expect(exports.exportTenant).toHaveBeenCalledWith(SHOP_ID, PLATFORM_UID);
  });

  it('upsertSub merges platformUid into args', async () => {
    await controller.upsertSub(
      { shopId: SHOP_ID, plan: 'growth', mrrPaise: 100, status: 'active' },
      fakeReq(),
    );
    expect(subs.upsertSubscription).toHaveBeenCalledWith(expect.objectContaining({
      shopId: SHOP_ID, plan: 'growth', mrrPaise: 100, platformUserId: PLATFORM_UID,
    }));
  });

  it('listSubs returns service output as-is', async () => {
    const out = await controller.listSubs();
    expect(out).toEqual([]);
    expect(subs.listSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('getMetrics returns service output as-is', async () => {
    const out = await controller.getMetrics();
    expect(out).toEqual({ totalShops: 1, activeShops: 1, invoicesLast30Days: 0 });
  });

  it('startImpersonation forwards uid + body and propagates user-agent', async () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'tester' }, user: { uid: PLATFORM_UID } } as never;
    await controller.startImpersonation({ targetShopId: SHOP_ID, reason: 'support ticket' }, req);
    expect(impersonation.startImpersonation).toHaveBeenCalledWith({
      platformUserId: PLATFORM_UID,
      targetShopId: SHOP_ID,
      reason: 'support ticket',
      ip: '203.0.113.7',
      userAgent: 'tester',
    });
  });

  it('endImpersonation forwards sessionId + uid', async () => {
    await controller.endImpersonation(SESSION_ID, fakeReq());
    expect(impersonation.endImpersonation).toHaveBeenCalledWith(SESSION_ID, PLATFORM_UID);
  });

  it('rejects with 401 when req.user.uid is missing', async () => {
    const req = { headers: {}, user: undefined } as never;
    await expect(controller.createTenant({ slug: 'x', displayName: 'X' }, req)).rejects.toMatchObject({
      response: { code: 'auth.missing' },
    });
  });
});
