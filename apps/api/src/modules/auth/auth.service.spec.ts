import { describe, it, expect, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditAction } from '@goldsmith/audit';
import type { InviteStaffDto } from '@goldsmith/shared';
import { tenantContext, type Tenant } from '@goldsmith/tenant-context';
import type { AuditLogFilters } from './audit-log.repository';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const SHOP_ID = 'shop-uuid-1';
const INVITER_ID = 'owner-uuid-1';
const NEW_USER_ID = 'new-user-uuid-1';
const PHONE = '+919876543210';

const fakeTenant: Tenant = {
  id: SHOP_ID,
  slug: 'test-shop',
  display_name: 'Test Jewellers',
  status: 'ACTIVE',
};

const inviteDto: InviteStaffDto = {
  phone: PHONE,
  role: 'shop_staff',
  display_name: 'Alice Singh',
};

// ---------------------------------------------------------------------------
// Factory for a minimal pool mock sufficient for loadTenantById + auditLog
// ---------------------------------------------------------------------------
function makePoolMock(tenantOverride?: Partial<Tenant>) {
  const tenant = { ...fakeTenant, ...tenantOverride };

  // loadTenantById: SELECT from shops → 1 row
  // auditLog → withTenantTx: BEGIN, SET LOCAL ROLE, SET LOCAL current_shop_id, INSERT, COMMIT, POISON release
  const mockClient = {
    query: vi.fn()
      // loadTenantById (uses pool.connect() separately — emulated by pool.connect mock)
      // auditLog → withTenantTx sequence:
      .mockResolvedValueOnce(undefined)                                           // BEGIN
      .mockResolvedValueOnce(undefined)                                           // SET LOCAL ROLE app_user
      .mockResolvedValueOnce(undefined)                                           // SET LOCAL app.current_shop_id
      .mockResolvedValueOnce(undefined)                                           // INSERT audit_events
      .mockResolvedValueOnce(undefined)                                           // COMMIT
      .mockResolvedValueOnce(undefined),                                          // POISON (finally)
    release: vi.fn(),
  };

  // loadTenantById uses pool.connect() then c.query + c.release
  // We need two connect() calls: one for loadTenantById, one for auditLog's withTenantTx
  const tenantClient = {
    query: vi.fn().mockResolvedValue({ rows: [tenant], rowCount: 1 }),
    release: vi.fn(),
  };

  const pool = {
    connect: vi.fn()
      .mockResolvedValueOnce(tenantClient)   // loadTenantById
      .mockResolvedValueOnce(mockClient),    // withTenantTx (auditLog)
  } as unknown as import('pg').Pool;

  return pool;
}

// ---------------------------------------------------------------------------
// Factory for AuthService with all deps mocked
// ---------------------------------------------------------------------------
function makeService(overrides: {
  inviteStaffResult?: { conflict: boolean; userId?: string };
  smsAdapterSendInvite?: (phone: string, shopName: string, inviteCode: string) => Promise<void>;
  auditLogRepoFindPaginated?: ReturnType<typeof vi.fn>;
}) {
  const inviteStaffResult = overrides.inviteStaffResult ?? { conflict: false, userId: NEW_USER_ID };

  const authRepo = {
    inviteStaff: vi.fn().mockResolvedValue(inviteStaffResult),
  };

  const smsAdapter = {
    sendOtp: vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined),
    sendInvite: overrides.smsAdapterSendInvite ?? vi.fn<[string, string, string], Promise<void>>().mockResolvedValue(undefined),
  };

  const pool = makePoolMock();

  const auditLogRepo = {
    findPaginated: overrides.auditLogRepoFindPaginated ?? vi.fn().mockResolvedValue({ events: [], total: 0 }),
  };

  // AuthService constructor args order: pool, firebase, repo, rateLimit, smsAdapter, auditLogRepo
  const firebase = {} as never;
  const rateLimit = {} as never;

  // We instantiate directly (no NestJS DI) and inject mocks via cast
  const svc = new AuthService(pool, firebase, authRepo as never, rateLimit, smsAdapter, auditLogRepo as never);

  return { svc, authRepo, smsAdapter, pool, auditLogRepo };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuthService.invite()', () => {
  it('calls authRepo.inviteStaff with correct args', async () => {
    const { svc, authRepo } = makeService({});

    await svc.invite(SHOP_ID, inviteDto, INVITER_ID);

    expect(authRepo.inviteStaff).toHaveBeenCalledOnce();
    const call = authRepo.inviteStaff.mock.calls[0][0] as Record<string, unknown>;
    expect(call.shopId).toBe(SHOP_ID);
    expect(call.phone).toBe(PHONE);
    expect(call.role).toBe('shop_staff');
    expect(call.displayName).toBe('Alice Singh');
    expect(call.invitedByUserId).toBe(INVITER_ID);
    // tenant is loaded internally — just check it's an object with the right id
    expect((call.tenant as Tenant).id).toBe(SHOP_ID);
  });

  it('throws ConflictException when authRepo returns { conflict: true }', async () => {
    const { svc } = makeService({ inviteStaffResult: { conflict: true } });

    await expect(svc.invite(SHOP_ID, inviteDto, INVITER_ID)).rejects.toThrow(ConflictException);
  });

  it('does NOT include phone in audit metadata', async () => {
    // We spy on the module-level auditLog by intercepting the pool client queries
    // The INSERT audit_events carries JSON metadata — we capture the arguments.
    const { svc, pool } = makeService({});

    await svc.invite(SHOP_ID, inviteDto, INVITER_ID);

    // The second pool.connect() is the auditLog withTenantTx client
    const auditClient = (pool.connect as ReturnType<typeof vi.fn>).mock.results[1]?.value as {
      query: ReturnType<typeof vi.fn>;
    };

    // Find the INSERT call — 4th query (index 3) in the withTenantTx sequence
    const insertCall = auditClient.query.mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('INSERT INTO audit_events'),
    );
    expect(insertCall).toBeDefined();
    const metadataJsonArg = insertCall![1][6] as string; // $7 = metadata JSON
    const metadata = JSON.parse(metadataJsonArg) as Record<string, unknown>;
    expect(metadata).not.toHaveProperty('phone');
    expect(metadata).toHaveProperty('role', 'shop_staff');
    expect(metadata).toHaveProperty('display_name', 'Alice Singh');
  });

  it('calls auditLog with STAFF_INVITED action', async () => {
    const { svc, pool } = makeService({});

    await svc.invite(SHOP_ID, inviteDto, INVITER_ID);

    const auditClient = (pool.connect as ReturnType<typeof vi.fn>).mock.results[1]?.value as {
      query: ReturnType<typeof vi.fn>;
    };
    const insertCall = auditClient.query.mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('INSERT INTO audit_events'),
    );
    expect(insertCall).toBeDefined();
    const action = insertCall![1][1] as string; // $2 = action
    expect(action).toBe(AuditAction.STAFF_INVITED);
  });

  it('calls smsAdapter.sendInvite when no conflict', async () => {
    const sendInvite = vi.fn<[string, string, string], Promise<void>>().mockResolvedValue(undefined);
    const { svc } = makeService({ smsAdapterSendInvite: sendInvite });

    await svc.invite(SHOP_ID, inviteDto, INVITER_ID);

    expect(sendInvite).toHaveBeenCalledOnce();
    const [phone, shopName, inviteCode] = sendInvite.mock.calls[0] as [string, string, string];
    expect(phone).toBe(PHONE);
    expect(shopName).toBe(SHOP_ID);
    expect(inviteCode).toBe(NEW_USER_ID);
  });

  it('does NOT call smsAdapter.sendInvite on conflict', async () => {
    const sendInvite = vi.fn<[string, string, string], Promise<void>>().mockResolvedValue(undefined);
    const { svc } = makeService({ inviteStaffResult: { conflict: true }, smsAdapterSendInvite: sendInvite });

    await expect(svc.invite(SHOP_ID, inviteDto, INVITER_ID)).rejects.toThrow(ConflictException);
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it('returns { userId } on success', async () => {
    const { svc } = makeService({});

    const result = await svc.invite(SHOP_ID, inviteDto, INVITER_ID);

    expect(result).toEqual({ userId: NEW_USER_ID });
  });
});

// ---------------------------------------------------------------------------
// AuthService.getAuditLog()
// ---------------------------------------------------------------------------
describe('AuthService.getAuditLog()', () => {
  it('returns paginated audit log with page and pageSize metadata', async () => {
    const mockEvents = [{ id: 'evt-1', action: 'AUTH_VERIFY_SUCCESS', actorName: 'Alice', actorRole: 'shop_admin', createdAt: '2026-04-20T00:00:00.000Z' }];
    const findPaginated = vi.fn().mockResolvedValue({ events: mockEvents, total: 5 });
    const { svc } = makeService({ auditLogRepoFindPaginated: findPaginated });

    const filters: AuditLogFilters = { page: 2, pageSize: 20 };
    const result = await svc.getAuditLog(filters);

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(5);
    expect(result.events).toEqual(mockEvents);
    expect(findPaginated).toHaveBeenCalledWith(filters);
  });

  it('caps pageSize at 50', async () => {
    const findPaginated = vi.fn().mockResolvedValue({ events: [], total: 0 });
    const { svc } = makeService({ auditLogRepoFindPaginated: findPaginated });

    const filters: AuditLogFilters = { page: 1, pageSize: 200 };
    const result = await svc.getAuditLog(filters);

    expect(result.pageSize).toBe(50);
  });

  it('delegates filter params to auditLogRepo.findPaginated', async () => {
    const findPaginated = vi.fn().mockResolvedValue({ events: [], total: 3 });
    const { svc } = makeService({ auditLogRepoFindPaginated: findPaginated });

    const filters: AuditLogFilters = { page: 1, pageSize: 10, category: 'login', dateRange: '7d' };
    await svc.getAuditLog(filters);

    expect(findPaginated).toHaveBeenCalledOnce();
    expect(findPaginated).toHaveBeenCalledWith(filters);
  });
});

// ---------------------------------------------------------------------------
// AuthService.logoutAll()
// ---------------------------------------------------------------------------
describe('AuthService.logoutAll()', () => {
  // For logoutAll we need a pool that handles withTenantTx (BEGIN/GUC/INSERT/COMMIT)
  // and a firebase mock that exposes admin().auth().revokeRefreshTokens()
  function makeLogoutAllService(revokeImpl?: () => Promise<void>): { svc: AuthService; mockRevoke: ReturnType<typeof vi.fn>; auditClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }; pool: unknown; withCtx: (fn: () => Promise<void>) => Promise<unknown> } {
    const mockRevoke = vi.fn().mockImplementation(revokeImpl ?? (() => Promise.resolve()));
    const firebase = {
      admin: vi.fn().mockReturnValue({
        auth: vi.fn().mockReturnValue({
          revokeRefreshTokens: mockRevoke,
        }),
      }),
    } as never;

    const auditClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)   // BEGIN
        .mockResolvedValueOnce(undefined)   // SET LOCAL ROLE
        .mockResolvedValueOnce(undefined)   // SET LOCAL current_shop_id
        .mockResolvedValueOnce(undefined)   // INSERT audit_events
        .mockResolvedValueOnce(undefined)   // COMMIT
        .mockResolvedValueOnce(undefined),  // finally: SET app.current_shop_id poison
      release: vi.fn(),
    };

    const pool = {
      connect: vi.fn().mockResolvedValue(auditClient),
    } as unknown as import('pg').Pool;

    const auditLogRepo = {
      findPaginated: vi.fn().mockResolvedValue({ events: [], total: 0 }),
    };

    const svc = new AuthService(
      pool,
      firebase,
      {} as never,   // authRepo — not needed for logoutAll
      {} as never,   // rateLimit — not needed for logoutAll
      {} as never,   // smsAdapter — not needed for logoutAll
      auditLogRepo as never,
    );

    // Helper: run fn inside a tenant context (as the TenantInterceptor would in production)
    const withCtx = (fn: () => Promise<void>): Promise<unknown> =>
      tenantContext.runWith(
        { shopId: SHOP_ID, tenant: fakeTenant, authenticated: true, userId: 'user-123', role: 'shop_admin' },
        fn,
      );

    return { svc, mockRevoke, auditClient, pool, withCtx };
  }

  it('calls firebase revokeRefreshTokens with the given firebaseUid', async () => {
    const { svc, mockRevoke, withCtx } = makeLogoutAllService();

    await withCtx(() => svc.logoutAll('user-123', 'firebase-uid-abc'));

    expect(mockRevoke).toHaveBeenCalledOnce();
    expect(mockRevoke).toHaveBeenCalledWith('firebase-uid-abc');
  });

  it('emits AUTH_LOGOUT_ALL audit event after revoking tokens', async () => {
    const { svc, mockRevoke, auditClient, withCtx } = makeLogoutAllService();

    await withCtx(() => svc.logoutAll('user-123', 'firebase-uid-abc'));

    expect(mockRevoke).toHaveBeenCalledOnce();

    const insertCall = auditClient.query.mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('INSERT INTO audit_events'),
    );
    expect(insertCall).toBeDefined();
    const action = insertCall![1][1] as string; // $2 = action
    expect(action).toBe(AuditAction.AUTH_LOGOUT_ALL);
  });

  it('includes actorUserId = userId in the audit row', async () => {
    const { svc, auditClient, withCtx } = makeLogoutAllService();

    await withCtx(() => svc.logoutAll('user-123', 'firebase-uid-abc'));

    const insertCall = auditClient.query.mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('INSERT INTO audit_events'),
    );
    expect(insertCall).toBeDefined();
    const actorUserId = insertCall![1][0] as string; // $1 = actor_user_id
    expect(actorUserId).toBe('user-123');
  });
});
