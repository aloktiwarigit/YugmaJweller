import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';
import { AuditAction } from '@goldsmith/audit';
import { PermissionsCache } from '@goldsmith/tenant-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { PermissionsRepository } from './permissions.repository';
import { PolicyGuard } from './guards/policy.guard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SHOP_ID = 'shop-uuid-1';
const USER_ID = 'owner-uuid-1';
const NEW_USER_ID = 'new-user-uuid-1';

const fakeTenant: Tenant = {
  id: SHOP_ID,
  slug: 'test-shop',
  display_name: 'Test Jewellers',
  status: 'ACTIVE',
};

const adminCtx: AuthenticatedTenantContext = {
  authenticated: true,
  shopId: SHOP_ID,
  tenant: fakeTenant,
  userId: USER_ID,
  role: 'shop_admin',
};

const inviteDto = { phone: '+919876543210', role: 'shop_staff' as const, display_name: 'Alice Singh' };
const updatePermDto = { permission_key: 'billing.create' as const, is_enabled: false };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockAuthService = { invite: vi.fn(), getAuditLog: vi.fn(), logoutAll: vi.fn() };
const mockAuthRepo = { listUsers: vi.fn() };
const mockPermissionsRepo = { getPermissions: vi.fn(), upsertPermission: vi.fn() };
const mockPermissionsCache = { invalidate: vi.fn(), getPermissions: vi.fn(), setPermissions: vi.fn() };

// Mock pool for auditLog (withTenantTx pattern)
function makePoolMock(): { connect: ReturnType<typeof vi.fn>; _client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } } {
  const client = {
    query: vi.fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET LOCAL ROLE app_user
      .mockResolvedValueOnce(undefined) // SET LOCAL app.current_shop_id
      .mockResolvedValueOnce(undefined) // INSERT audit_events
      .mockResolvedValueOnce(undefined) // COMMIT
      .mockResolvedValueOnce(undefined), // POISON (finally)
    release: vi.fn(),
  };
  return { connect: vi.fn().mockResolvedValue(client), _client: client };
}

// ---------------------------------------------------------------------------
// Helper — run handler inside tenant ALS context
// ---------------------------------------------------------------------------
function withAdminCtx<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContext.runWith(adminCtx, fn) as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: PermissionsRepository, useValue: mockPermissionsRepo },
        { provide: PermissionsCache, useValue: mockPermissionsCache },
        { provide: PolicyGuard, useValue: { canActivate: vi.fn().mockReturnValue(true) } },
        { provide: 'PG_POOL', useValue: makePoolMock() },
        Reflector,
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  // ─── POST /invite ────────────────────────────────────────────────────────

  describe('POST /invite', () => {
    it('calls authService.invite and returns userId', async () => {
      mockAuthService.invite.mockResolvedValueOnce({ userId: NEW_USER_ID });

      const result = await withAdminCtx(() =>
        controller.invite(inviteDto),
      );

      expect(mockAuthService.invite).toHaveBeenCalledWith(SHOP_ID, inviteDto, USER_ID);
      expect(result).toEqual({ userId: NEW_USER_ID });
    });

    it('propagates ConflictException from authService.invite', async () => {
      mockAuthService.invite.mockRejectedValueOnce(
        new ConflictException({ errorCode: 'auth.invite_conflict' }),
      );

      await expect(
        withAdminCtx(() => controller.invite(inviteDto)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─── GET /users ──────────────────────────────────────────────────────────

  describe('GET /users', () => {
    it('calls authRepo.listUsers and returns array', async () => {
      const fakeUsers = [
        { id: 'u1', displayName: 'Alice', role: 'shop_staff', status: 'ACTIVE', phone: '+919876543210', invitedAt: null, activatedAt: null },
      ];
      mockAuthRepo.listUsers.mockResolvedValueOnce(fakeUsers);

      const result = await withAdminCtx(() => controller.listUsers());

      expect(mockAuthRepo.listUsers).toHaveBeenCalledWith(SHOP_ID);
      expect(result).toEqual(fakeUsers);
    });
  });

  // ─── GET /roles/:role/permissions ────────────────────────────────────────

  describe('GET /roles/:role/permissions', () => {
    it('calls permissionsRepo.getPermissions and returns map', async () => {
      const fakePerms = { 'billing.create': true, 'billing.void': false };
      mockPermissionsRepo.getPermissions.mockResolvedValueOnce(fakePerms);

      const result = await withAdminCtx(() => controller.getPermissions('shop_manager'));

      expect(mockPermissionsRepo.getPermissions).toHaveBeenCalledWith(SHOP_ID, 'shop_manager');
      expect(result).toEqual(fakePerms);
    });
  });

  // ─── PUT /roles/:role/permissions ────────────────────────────────────────

  describe('PUT /roles/:role/permissions', () => {
    it('calls upsertPermission + invalidate + auditLog and returns void', async () => {
      // Provide a fresh pool mock that satisfies all queries for this test
      const poolMock = makePoolMock();
      // Rebuild module with fresh pool for audit queries
      const module2: TestingModule = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          { provide: AuthService, useValue: mockAuthService },
          { provide: AuthRepository, useValue: mockAuthRepo },
          { provide: PermissionsRepository, useValue: mockPermissionsRepo },
          { provide: PermissionsCache, useValue: mockPermissionsCache },
          { provide: PolicyGuard, useValue: { canActivate: vi.fn().mockReturnValue(true) } },
          { provide: 'PG_POOL', useValue: poolMock },
          Reflector,
        ],
      }).compile();

      const ctrl2 = module2.get(AuthController);

      mockPermissionsRepo.upsertPermission.mockResolvedValueOnce(undefined);
      mockPermissionsCache.invalidate.mockResolvedValueOnce(undefined);

      const result = await withAdminCtx(() =>
        ctrl2.updatePermission('shop_manager', updatePermDto, {} as never),
      );

      expect(result).toBeUndefined();
      expect(mockPermissionsRepo.upsertPermission).toHaveBeenCalledWith(
        SHOP_ID, 'shop_manager', 'billing.create', false,
      );
      expect(mockPermissionsCache.invalidate).toHaveBeenCalledWith(SHOP_ID, 'shop_manager');
      // auditLog fires through pool client queries — verify INSERT was called
      expect(poolMock._client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_events'),
        expect.arrayContaining([USER_ID, AuditAction.PERMISSIONS_UPDATED]),
      );
    });
  });

  // ─── Guard: unauthenticated context ──────────────────────────────────────

  describe('unauthenticated context', () => {
    it('GET /users throws UnauthorizedException when context is unauthenticated', async () => {
      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
      await expect(
        tenantContext.runWith(unauthCtx, () => controller.listUsers()) as Promise<unknown>,
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ─── GET /audit-log ──────────────────────────────────────────────────────

  describe('GET /audit-log', () => {
    it('calls svc.getAuditLog and returns result for shop_admin', async () => {
      const fakeResult = { events: [], total: 0, page: 1, pageSize: 20 };
      mockAuthService.getAuditLog.mockResolvedValueOnce(fakeResult);

      const result = await withAdminCtx(() =>
        controller.getAuditLog(undefined, undefined, undefined, undefined),
      );

      expect(mockAuthService.getAuditLog).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        dateRange: undefined,
        category: undefined,
      });
      expect(result).toEqual(fakeResult);
    });

    it('calls svc.getAuditLog with parsed page/pageSize params', async () => {
      const fakeResult = { events: [], total: 0, page: 2, pageSize: 10 };
      mockAuthService.getAuditLog.mockResolvedValueOnce(fakeResult);

      const result = await withAdminCtx(() =>
        controller.getAuditLog('2', '10', '7d', 'login'),
      );

      expect(mockAuthService.getAuditLog).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        dateRange: '7d',
        category: 'login',
      });
      expect(result).toEqual(fakeResult);
    });

    it('shop_staff RBAC enforced at guard level (not in handler body)', async () => {
      // @Roles('shop_admin', 'shop_manager') on the handler causes PolicyGuard to throw
      // ForbiddenException in production. In this unit test PolicyGuard is mocked to always
      // pass — so calling the handler directly with a shop_staff context succeeds.
      // The RBAC gate is exercised in the integration tests (audit-log-read.integration.test.ts).
      const staffCtx: AuthenticatedTenantContext = {
        ...adminCtx,
        role: 'shop_staff',
      };
      mockAuthService.getAuditLog.mockResolvedValueOnce({ events: [], total: 0, page: 1, pageSize: 20 });

      // Handler body does NOT throw when guard mock allows through
      await expect(
        tenantContext.runWith(staffCtx, () =>
          controller.getAuditLog(undefined, undefined, undefined, undefined),
        ) as Promise<unknown>,
      ).resolves.toBeDefined();
    });

    it('throws UnauthorizedException when context is not authenticated', async () => {
      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };
      await expect(
        tenantContext.runWith(unauthCtx, () =>
          controller.getAuditLog(undefined, undefined, undefined, undefined),
        ) as Promise<unknown>,
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ─── GET /audit-log/export ───────────────────────────────────────────────

  describe('GET /audit-log/export', () => {
    it('returns deferred stub', () => {
      const result = controller.auditLogExport();
      expect(result).toEqual({ status: 'deferred', reason: 'Azure subscription not provisioned' });
    });
  });

  // ─── POST /logout/all ────────────────────────────────────────────────────

  describe('POST /logout/all', () => {
    it('calls svc.logoutAll with userId and firebaseUid', async () => {
      const FIREBASE_UID = 'firebase-uid-abc';
      mockAuthService.logoutAll.mockResolvedValueOnce(undefined);

      const fakeReq = { user: { uid: FIREBASE_UID } } as never;
      const result = await withAdminCtx(() => controller.logoutAll(fakeReq));

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(USER_ID, FIREBASE_UID);
      expect(result).toBeUndefined();
    });

    it('throws UnauthorizedException when uid is missing from firebase user', async () => {
      const fakeReq = { user: { uid: undefined } } as never;

      await expect(
        withAdminCtx(() => controller.logoutAll(fakeReq)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is not on request', async () => {
      const fakeReq = {} as never;

      await expect(
        withAdminCtx(() => controller.logoutAll(fakeReq)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when context is not authenticated', async () => {
      const FIREBASE_UID = 'firebase-uid-abc';
      const fakeReq = { user: { uid: FIREBASE_UID } } as never;
      const unauthCtx = { authenticated: false as const, shopId: SHOP_ID, tenant: fakeTenant };

      await expect(
        tenantContext.runWith(unauthCtx, () => controller.logoutAll(fakeReq)) as Promise<unknown>,
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
