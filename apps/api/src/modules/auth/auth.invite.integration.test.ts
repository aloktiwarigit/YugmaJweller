/**
 * auth.invite.integration.test.ts
 *
 * Integration-level tests (mock-pool, no live DB) for:
 *  1. invite → session → ACTIVE flow: verifies linkFirebaseUid called + session result carries invited role
 *  2. Tenant isolation for listStaff: verifies SET LOCAL uses caller's shop_id
 *  3. Tenant isolation for insertInvited: verifies SET LOCAL uses caller's shop_id
 */

import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  tenantContext,
  type Tenant,
  type AuthenticatedTenantContext,
  type UnauthenticatedTenantContext,
} from '@goldsmith/tenant-context';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type { FirebaseAdminProvider } from './firebase-admin.provider';
import type { AuthRateLimitService } from './auth-rate-limit.service';
import type { ISmsAdapter } from './adapters/sms.adapter';

// ─── Constants ──────────────────────────────────────────────────────────────
const SHOP_A = '11111111-1111-1111-1111-111111111111';
const SHOP_B = '22222222-2222-2222-2222-222222222222';

const tenantA: Tenant = { id: SHOP_A, slug: 'shop-a', display_name: 'Test Shop A', status: 'ACTIVE' };
const tenantB: Tenant = { id: SHOP_B, slug: 'shop-b', display_name: 'Test Shop B', status: 'ACTIVE' };

// ─── Mock pool helpers ───────────────────────────────────────────────────────

/**
 * Build a mock pg Pool + PoolClient.
 * The client handles BEGIN/COMMIT/ROLLBACK and SET LOCAL silently.
 * Data queries return `rows`.
 * The spy is still inspectable via client.query.mock.calls.
 */
function makeMockPool(rows: unknown[]): { pool: Pool; client: PoolClient } {
  const client = {
    query: vi.fn().mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK'))) return;
      if (typeof sql === 'string' && (sql.includes('SET LOCAL') || sql.includes('SET app.') || sql.includes('SET ROLE') || sql.includes('RESET ROLE'))) return;
      return { rows, rowCount: rows.length };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { pool, client };
}

// ─── Test 1: invite → session → ACTIVE flow ─────────────────────────────────

describe('invite → session → ACTIVE flow', () => {
  const staffPhone = '+919876543210';
  const staffUid = 'firebase-staff-uid';
  const staffUserId = 'staff-uuid';
  const ownerUserId = 'owner-uuid';

  const ownerCtx: AuthenticatedTenantContext = {
    shopId: SHOP_A,
    tenant: tenantA,
    authenticated: true,
    userId: ownerUserId,
    role: 'shop_admin',
  };

  // Fully mocked repo so we can spy on linkFirebaseUid
  function makeRepo(): AuthRepository {
    return {
      findByPhoneInShop: vi.fn().mockResolvedValue(null),
      insertInvited: vi.fn().mockResolvedValue({
        id: staffUserId,
        phone: staffPhone,
        role: 'shop_staff',
        status: 'INVITED',
        invited_at: new Date(),
      }),
      lookupByPhone: vi.fn().mockResolvedValue({
        userId: staffUserId,
        shopId: SHOP_A,
        role: 'shop_staff',
        status: 'INVITED',
        firebaseUid: null, // first login — will trigger linkFirebaseUid
      }),
      linkFirebaseUid: vi.fn().mockResolvedValue({ linked: true }),
      listStaff: vi.fn().mockResolvedValue([]),
    } as unknown as AuthRepository;
  }

  // Firebase mock — setCustomUserClaims is a no-op
  function makeFirebase(): FirebaseAdminProvider {
    const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
    return {
      admin: () => ({ auth: () => ({ setCustomUserClaims }) }),
    } as unknown as FirebaseAdminProvider;
  }

  // Rate-limit mock — always ok
  function makeRateLimit(): AuthRateLimitService {
    return {
      check: vi.fn().mockResolvedValue({ ok: true }),
      recordSuccess: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthRateLimitService;
  }

  // SMS mock — fire-and-forget
  const sms: ISmsAdapter = { send: vi.fn().mockResolvedValue(undefined) };

  it('calls linkFirebaseUid and returns shop_staff role in session result', async () => {
    const repo = makeRepo();
    const firebase = makeFirebase();
    const rateLimit = makeRateLimit();

    // Pool for service: loadTenantById (SELECT from shops), platformAuditLog (INSERT into platform_audit_events),
    // auditProvisioned (INSERT into audit_events), auditVerifySuccess, and loadUserDisplayName.
    // We route by SQL content to avoid fragile call-count ordering.
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && (
          sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') ||
          sql.includes('SET LOCAL') || sql.includes('SET app.') ||
          sql.includes('SET ROLE') || sql.includes('RESET ROLE')
        )) return;
        // loadTenantById
        if (typeof sql === 'string' && sql.includes('FROM shops')) {
          return { rows: [{ id: SHOP_A, slug: 'shop-a', display_name: 'Test Shop A', status: 'ACTIVE', config: {} }], rowCount: 1 };
        }
        // loadUserDisplayName
        if (typeof sql === 'string' && sql.includes('display_name') && sql.includes('shop_users')) {
          return { rows: [{ display_name: staffPhone }], rowCount: 1 };
        }
        // audit log inserts and other queries — return empty
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    // platformAuditLog calls pool.connect internally too; keep returning the same client
    const service = new AuthService(pool, firebase, repo, rateLimit, sms);

    // Step 1: invite (runs in owner context)
    await tenantContext.runWith(ownerCtx, () =>
      service.invite({ phone: staffPhone, role: 'shop_staff' }),
    );

    // Step 2: session (no tenant context needed — session reads context from lookupByPhone)
    const sessionResult = await service.session({
      uid: staffUid,
      phoneE164: staffPhone,
    });

    // Assertions
    expect(repo.linkFirebaseUid).toHaveBeenCalledOnce();
    expect(repo.linkFirebaseUid).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: staffUid, userId: staffUserId, shopId: SHOP_A }),
    );

    expect(sessionResult.user.role).toBe('shop_staff');
    expect(sessionResult.user.id).toBe(staffUserId);
    expect(sessionResult.requires_token_refresh).toBe(true);
  });
});

// ─── Test 2: Tenant isolation — listStaff scopes to caller's shop ────────────

describe('tenant isolation — listStaff uses caller shop_id in SET LOCAL', () => {
  const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
  const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };

  it('uses SHOP_A id when called in Shop A context', async () => {
    const { pool, client } = makeMockPool([]);
    const repo = new AuthRepository(pool);

    await tenantContext.runWith(ctxA, () => repo.listStaff());

    // withTenantTx issues: SET LOCAL app.current_shop_id = '<shopId>' (string interpolation)
    const setLocalCall = (client.query as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]: [string]) => typeof sql === 'string' && sql.includes('app.current_shop_id'),
    );
    expect(setLocalCall).toBeDefined();
    const sqlStr: string = setLocalCall![0];
    expect(sqlStr).toContain(SHOP_A);
    expect(sqlStr).not.toContain(SHOP_B);
  });

  it('uses SHOP_B id when called in Shop B context', async () => {
    const { pool, client } = makeMockPool([]);
    const repo = new AuthRepository(pool);

    await tenantContext.runWith(ctxB, () => repo.listStaff());

    const setLocalCall = (client.query as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]: [string]) => typeof sql === 'string' && sql.includes('app.current_shop_id'),
    );
    expect(setLocalCall).toBeDefined();
    const sqlStr: string = setLocalCall![0];
    expect(sqlStr).toContain(SHOP_B);
    expect(sqlStr).not.toContain(SHOP_A);
  });
});

// ─── Test 3: Tenant isolation — insertInvited scopes to caller's shop ────────

describe('tenant isolation — insertInvited uses caller shop_id in SET LOCAL', () => {
  const now = new Date();

  const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
  const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };

  const insertedRow = {
    id: 'new-uuid',
    phone: '+919876543210',
    role: 'shop_staff',
    status: 'INVITED',
    invited_at: now,
  };

  it('uses SHOP_A id for insertInvited in Shop A context', async () => {
    const { pool, client } = makeMockPool([insertedRow]);
    const repo = new AuthRepository(pool);

    await tenantContext.runWith(ctxA, () =>
      repo.insertInvited({ phone: '+919876543210', role: 'shop_staff', invitedByUserId: 'owner-uuid' }),
    );

    const setLocalCall = (client.query as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]: [string]) => typeof sql === 'string' && sql.includes('app.current_shop_id'),
    );
    expect(setLocalCall).toBeDefined();
    const sqlStr: string = setLocalCall![0];
    expect(sqlStr).toContain(SHOP_A);
    expect(sqlStr).not.toContain(SHOP_B);
  });

  it('uses SHOP_B id for insertInvited in Shop B context', async () => {
    const { pool, client } = makeMockPool([insertedRow]);
    const repo = new AuthRepository(pool);

    await tenantContext.runWith(ctxB, () =>
      repo.insertInvited({ phone: '+919876543210', role: 'shop_staff', invitedByUserId: 'owner-uuid' }),
    );

    const setLocalCall = (client.query as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]: [string]) => typeof sql === 'string' && sql.includes('app.current_shop_id'),
    );
    expect(setLocalCall).toBeDefined();
    const sqlStr: string = setLocalCall![0];
    expect(sqlStr).toContain(SHOP_B);
    expect(sqlStr).not.toContain(SHOP_A);
  });
});
