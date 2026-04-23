/**
 * Unit tests for AuthService.logoutAll — tenant isolation guard (Story 1.7).
 *
 * These tests do NOT use Testcontainers — the surface being tested is purely
 * the Firebase token-revocation call. The key invariant is that logoutAll
 * revokes EXACTLY the firebase UID it received, never any other user's UID.
 *
 * RLS + DB isolation is covered by the Testcontainers tests; here we confirm
 * that the application layer has no "revoke all staff in shop" footgun.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any imports that reference them.
// ---------------------------------------------------------------------------

const mockAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('@goldsmith/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  platformAuditLog: vi.fn().mockResolvedValue(undefined),
  AuditAction: {
    AUTH_LOGOUT_ALL: 'AUTH_LOGOUT_ALL',
    AUTH_VERIFY_SUCCESS: 'AUTH_VERIFY_SUCCESS',
    AUTH_VERIFY_FAILURE: 'AUTH_VERIFY_FAILURE',
    AUTH_VERIFY_LOCKED: 'AUTH_VERIFY_LOCKED',
    AUTH_VERIFY_REJECTED: 'AUTH_VERIFY_REJECTED',
    AUTH_USER_PROVISIONED: 'AUTH_USER_PROVISIONED',
    AUTH_UID_MISMATCH: 'AUTH_UID_MISMATCH',
    AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    TENANT_CLAIM_CONFLICT: 'TENANT_CLAIM_CONFLICT',
    TENANT_BOOT: 'TENANT_BOOT',
    STAFF_INVITED: 'STAFF_INVITED',
    STAFF_REVOKED: 'STAFF_REVOKED',
    STAFF_ACTIVATED: 'STAFF_ACTIVATED',
  },
}));

// AuthService imports: we need stub versions of the other deps.
// Import after vi.mock() so the mock is in place.
import { AuthService } from '../src/modules/auth/auth.service';
import type { FirebaseAdminProvider } from '../src/modules/auth/firebase-admin.provider';
import type { AuthRepository } from '../src/modules/auth/auth.repository';
import type { AuthRateLimitService } from '../src/modules/auth/auth-rate-limit.service';
import type { ISmsAdapter } from '../src/modules/auth/sms/sms-adapter.interface';
import type { AuditLogRepository } from '../src/modules/auth/audit-log.repository';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeRevokeMock(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(undefined);
}

/**
 * Build a minimal AuthService with all dependencies stubbed.
 * Only FirebaseAdminProvider.revokeRefreshTokens is real — the rest are no-ops.
 */
function makeService(revokeRefreshTokens: ReturnType<typeof makeRevokeMock>): AuthService {
  const mockFirebase = {
    admin: () => ({
      auth: () => ({ revokeRefreshTokens }),
    }),
  } as unknown as FirebaseAdminProvider;

  const mockPool = {} as unknown as Pool;

  const mockRepo = {} as unknown as AuthRepository;
  const mockRateLimit = {} as unknown as AuthRateLimitService;
  const mockSms = {} as unknown as ISmsAdapter;
  const mockAuditLogRepo = {} as unknown as AuditLogRepository;

  return new AuthService(
    mockPool,
    mockFirebase,
    mockRepo,
    mockRateLimit,
    mockSms,
    mockAuditLogRepo,
  );
}

/** Wrap a call in a shop's tenant context (required by auditLog → withTenantTx). */
// eslint-disable-next-line goldsmith/no-raw-shop-id-param -- test harness building context manually
function withCtx<T>(shopId: string, userId: string, fn: () => Promise<T>): Promise<T> {
  const ctx: AuthenticatedTenantContext = {
    authenticated: true,
    shopId,
    tenant: { id: shopId, slug: 'test', display_name: 'Test', status: 'ACTIVE' },
    userId,
    role: 'shop_admin',
  };
  return tenantContext.runWith(ctx, fn) as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService.logoutAll — tenant isolation', () => {
  beforeEach(() => {
    mockAuditLog.mockClear();
  });

  it('calls revokeRefreshTokens exactly once with the provided firebaseUid', async () => {
    const mockRevoke = makeRevokeMock();
    const service = makeService(mockRevoke);

    await withCtx('shop-a', 'user-a', () =>
      service.logoutAll('user-a', 'firebase-uid-A'),
    );

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockRevoke).toHaveBeenCalledWith('firebase-uid-A');
  });

  it('does NOT call revokeRefreshTokens with any other UID', async () => {
    const mockRevoke = makeRevokeMock();
    const service = makeService(mockRevoke);

    const firebaseUidB = 'firebase-uid-B';

    await withCtx('shop-a', 'user-a', () =>
      service.logoutAll('user-a', 'firebase-uid-A'),
    );

    // The cross-tenant / other-user UID must never appear in any call
    const allArgs = mockRevoke.mock.calls.flat();
    expect(allArgs).not.toContain(firebaseUidB);
  });

  it('calling logoutAll for shop A user does not affect shop B user revocation', async () => {
    const mockRevoke = makeRevokeMock();
    const service = makeService(mockRevoke);

    // Shop A logout
    await withCtx('shop-a', 'user-a', () =>
      service.logoutAll('user-a', 'firebase-uid-A'),
    );

    // Shop B logout
    await withCtx('shop-b', 'user-b', () =>
      service.logoutAll('user-b', 'firebase-uid-B'),
    );

    // Each call is independent — exactly one call per logoutAll invocation
    expect(mockRevoke).toHaveBeenCalledTimes(2);
    expect(mockRevoke).toHaveBeenNthCalledWith(1, 'firebase-uid-A');
    expect(mockRevoke).toHaveBeenNthCalledWith(2, 'firebase-uid-B');
  });

  it('records an audit log entry after revoking tokens', async () => {
    const mockRevoke = makeRevokeMock();
    const service = makeService(mockRevoke);

    await withCtx('shop-a', 'user-a', () =>
      service.logoutAll('user-a', 'firebase-uid-A'),
    );

    // auditLog must be called with AUTH_LOGOUT_ALL action
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const [, auditArgs] = mockAuditLog.mock.calls[0] as [unknown, { action: string; actorUserId: string }];
    expect(auditArgs.action).toBe('AUTH_LOGOUT_ALL');
    expect(auditArgs.actorUserId).toBe('user-a');
  });
});
