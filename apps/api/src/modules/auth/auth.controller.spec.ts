import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
const mockAuthService = { invite: vi.fn(), revokeStaff: vi.fn() };
const mockAuthRepo = { listUsers: vi.fn() };
const mockPermissionsRepo = { getPermissions: vi.fn(), upsertPermission: vi.fn() };
const mockPermissionsCache = { invalidate: vi.fn(), getPermissions: vi.fn(), setPermissions: vi.fn() };

// Mock pool for auditLog (withTenantTx pattern)
function makePoolMock() {
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

  // ─── DELETE /staff/:userId ────────────────────────────────────────────────

  describe('DELETE /staff/:userId', () => {
    it('calls authService.revokeStaff and returns void (204)', async () => {
      mockAuthService.revokeStaff.mockResolvedValueOnce(undefined);

      const result = await withAdminCtx(() =>
        controller.revokeStaff('staff-uuid-1'),
      );

      expect(mockAuthService.revokeStaff).toHaveBeenCalledWith(
        SHOP_ID,
        'staff-uuid-1',
        USER_ID,
      );
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException from authService.revokeStaff', async () => {
      mockAuthService.revokeStaff.mockRejectedValueOnce(
        new NotFoundException({ code: 'auth.staff_not_found' }),
      );

      await expect(
        withAdminCtx(() => controller.revokeStaff('nonexistent-id')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
