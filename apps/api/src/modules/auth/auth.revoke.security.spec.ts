/**
 * auth.revoke.security.spec.ts
 *
 * Two focused security tests for Story 1.5:
 *
 * 1. Cross-tenant isolation: DELETE with tenant-A JWT + tenant-B userId → 404 (not 403).
 *    The repo query includes AND shop_id=$callerShopId so cross-tenant UUIDs are invisible.
 *    A 403 would leak existence; 404 is the correct response.
 *
 * 2. Revoked token rejection: verifyIdToken with checkRevoked:true throws auth/id-token-revoked
 *    → FirebaseJwtStrategy converts it to UnauthorizedException (401).
 */
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseJwtStrategy } from './firebase-jwt.strategy';

// ---------------------------------------------------------------------------
// Test 1: Cross-tenant isolation at service level
// ---------------------------------------------------------------------------
describe('AuthService.revokeStaff — cross-tenant isolation', () => {
  it('returns NotFoundException(404) when userId belongs to a different tenant', async () => {
    // repo.revokeStaff returns null because WHERE id=$1 AND shop_id=$2 finds 0 rows
    // when $2 is shop-A but the user belongs to shop-B. The service cannot distinguish
    // "not found" from "wrong tenant" — both produce 404 by design (no leakage).
    const authRepo = {
      revokeStaff: vi.fn().mockResolvedValue(null), // 0 rows from tenant-scoped SELECT
      markRevoked: vi.fn(),
    };
    const firebase = {
      admin: vi.fn().mockReturnValue({
        auth: vi.fn().mockReturnValue({ revokeRefreshTokens: vi.fn() }),
      }),
    };
    const pool = { connect: vi.fn() } as unknown as import('pg').Pool;
    const rateLimit = {} as never;
    const smsAdapter = { sendOtp: vi.fn(), sendInvite: vi.fn() } as never;

    const auditLogRepo = { findPaginated: vi.fn() } as never;
    const svc = new AuthService(pool, firebase as never, authRepo as never, rateLimit, smsAdapter, auditLogRepo);

    const SHOP_A = 'aaaaaaaa-0000-0000-0000-000000000001';
    const USER_FROM_SHOP_B = 'bbbbbbbb-0000-0000-0000-000000000002'; // belongs to shop-B
    const CALLER = 'aaaaaaaa-0000-0000-0000-000000000099';

    const error = await svc.revokeStaff(SHOP_A, USER_FROM_SHOP_B, CALLER).catch((e) => e);

    // Must be NotFoundException (404), NOT ForbiddenException (403)
    // 403 would confirm to attacker that the UUID exists in another tenant
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error).not.toBeInstanceOf(ForbiddenException);
    expect(authRepo.markRevoked).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 2: Firebase token revocation end-to-end
// ---------------------------------------------------------------------------
describe('FirebaseJwtStrategy — revoked token rejection', () => {
  it('throws UnauthorizedException when verifyIdToken throws auth/id-token-revoked', async () => {
    // Simulates Firebase Admin SDK behaviour after revokeRefreshTokens() has been called.
    // verifyIdToken(token, true) throws with code='auth/id-token-revoked'.
    const revokedError = Object.assign(new Error('Token has been revoked'), {
      code: 'auth/id-token-revoked',
    });

    const mockAuthInstance = {
      verifyIdToken: vi.fn().mockRejectedValue(revokedError),
    };

    const mockProvider = {
      admin: vi.fn().mockReturnValue({
        auth: vi.fn().mockReturnValue(mockAuthInstance),
      }),
    };

    // Construct strategy directly — no NestJS DI needed
    // FirebaseJwtStrategy constructor: (provider: AdminLike, pool?: Pool)
    const strategy = new FirebaseJwtStrategy(mockProvider as never, undefined);

    const error = await strategy.validate('revoked-id-token').catch((e) => e);

    expect(error).toBeInstanceOf(UnauthorizedException);
  });
});
