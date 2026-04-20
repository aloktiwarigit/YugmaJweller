import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditAction } from '@goldsmith/audit';
import type { InviteStaffDto } from '@goldsmith/shared';
import type { ShopUserRole, Tenant } from '@goldsmith/tenant-context';

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

  // AuthService constructor args order: pool, firebase, repo, rateLimit, smsAdapter
  const firebase = {} as never;
  const rateLimit = {} as never;

  // We instantiate directly (no NestJS DI) and inject mocks via cast
  const svc = new AuthService(pool, firebase, authRepo as never, rateLimit, smsAdapter);

  return { svc, authRepo, smsAdapter, pool };
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
// AuthService.revokeStaff() tests
// ---------------------------------------------------------------------------
const CALLER_ID    = 'owner-uuid-1';
const TARGET_ID    = 'staff-uuid-1';
const FIREBASE_UID = 'firebase-uid-staff';

const fakeTenantRevoke: Tenant = {
  id: SHOP_ID,
  slug: 'test-shop',
  display_name: 'Test Jewellers',
  status: 'ACTIVE',
};

/**
 * Pool mock for revokeStaff success path.
 * connect() call 1 = tenantClient for loadTenantById
 * connect() call 2 = auditClient for auditLog withTenantTx
 */
function makeRevokePoolMock() {
  const tenantClient = {
    query: vi.fn().mockResolvedValue({ rows: [fakeTenantRevoke], rowCount: 1 }),
    release: vi.fn(),
  };
  const auditClient = {
    query: vi.fn()
      .mockResolvedValueOnce(undefined)  // BEGIN
      .mockResolvedValueOnce(undefined)  // SET LOCAL ROLE app_user
      .mockResolvedValueOnce(undefined)  // SET LOCAL app.current_shop_id
      .mockResolvedValueOnce(undefined)  // INSERT audit_events
      .mockResolvedValueOnce(undefined)  // COMMIT
      .mockResolvedValueOnce(undefined), // POISON (finally)
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn()
      .mockResolvedValueOnce(tenantClient)
      .mockResolvedValueOnce(auditClient),
  } as unknown as import('pg').Pool;
  return { pool, auditClient };
}

function makeRevokeService(opts: {
  targetRow: { firebaseUid: string | null; role: ShopUserRole } | null;
}) {
  const authRepo = {
    revokeStaff: vi.fn().mockResolvedValue(opts.targetRow),
    markRevoked: vi.fn().mockResolvedValue(undefined),
  };

  const mockFirebaseAuth = {
    revokeRefreshTokens: vi.fn().mockResolvedValue(undefined),
  };
  const firebase = {
    admin: vi.fn().mockReturnValue({ auth: vi.fn().mockReturnValue(mockFirebaseAuth) }),
  };

  const { pool, auditClient } = makeRevokePoolMock();
  const rateLimit = {} as never;
  const smsAdapter = { sendOtp: vi.fn(), sendInvite: vi.fn() } as never;

  const svc = new AuthService(pool, firebase as never, authRepo as never, rateLimit, smsAdapter);
  return { svc, authRepo, mockFirebaseAuth, pool, auditClient };
}

describe('AuthService.revokeStaff()', () => {
  it('calls markRevoked with correct args and revokeRefreshTokens with firebaseUid', async () => {
    const { svc, authRepo, mockFirebaseAuth } = makeRevokeService({
      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
    });

    await svc.revokeStaff(SHOP_ID, TARGET_ID, CALLER_ID);

    expect(authRepo.markRevoked).toHaveBeenCalledWith(SHOP_ID, TARGET_ID, CALLER_ID);
    expect(mockFirebaseAuth.revokeRefreshTokens).toHaveBeenCalledWith(FIREBASE_UID);
  });

  it('skips revokeRefreshTokens when firebaseUid is null', async () => {
    const { svc, mockFirebaseAuth, authRepo } = makeRevokeService({
      targetRow: { firebaseUid: null, role: 'shop_staff' },
    });

    await svc.revokeStaff(SHOP_ID, TARGET_ID, CALLER_ID);

    expect(authRepo.markRevoked).toHaveBeenCalledOnce();
    expect(mockFirebaseAuth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('throws NotFoundException(404) when target user not found', async () => {
    const { svc } = makeRevokeService({ targetRow: null });

    await expect(svc.revokeStaff(SHOP_ID, TARGET_ID, CALLER_ID))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException(400) when caller tries to revoke themselves', async () => {
    const { svc } = makeRevokeService({
      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
    });

    // TARGET_ID === CALLER_ID → self-revoke
    await expect(svc.revokeStaff(SHOP_ID, TARGET_ID, TARGET_ID))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws ForbiddenException(403) when target is a shop_admin', async () => {
    const { svc } = makeRevokeService({
      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_admin' },
    });

    await expect(svc.revokeStaff(SHOP_ID, TARGET_ID, CALLER_ID))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('emits STAFF_REVOKED audit event on success', async () => {
    const { svc, auditClient } = makeRevokeService({
      targetRow: { firebaseUid: FIREBASE_UID, role: 'shop_staff' },
    });

    await svc.revokeStaff(SHOP_ID, TARGET_ID, CALLER_ID);

    const insertCall = (auditClient.query.mock.calls as [string, unknown[]][]).find(
      ([sql]) => sql.includes('INSERT INTO audit_events'),
    );
    expect(insertCall).toBeDefined();
    const action = insertCall![1][1] as string;
    expect(action).toBe(AuditAction.STAFF_REVOKED);
  });
});
