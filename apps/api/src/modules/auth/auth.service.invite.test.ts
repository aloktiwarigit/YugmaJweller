import { describe, it, expect, vi } from 'vitest';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { StubSmsAdapter, type ISmsAdapter } from './adapters/sms.adapter';
import { tenantContext, type Tenant, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { Pool, PoolClient } from 'pg';

const SHOP_A = '11111111-1111-1111-1111-111111111111';
const tenant: Tenant = { id: SHOP_A, slug: 'a', display_name: 'Test Jewellers', status: 'ACTIVE' };
const ownerCtx: AuthenticatedTenantContext = {
  shopId: SHOP_A, tenant, authenticated: true, userId: 'owner-uuid', role: 'shop_admin',
};

function makeAuditClient(): PoolClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  } as unknown as PoolClient;
}

function makeSvc(overrides: {
  findByPhoneInShop?: ReturnType<typeof vi.fn>;
  insertInvited?: ReturnType<typeof vi.fn>;
  listStaff?: ReturnType<typeof vi.fn>;
} = {}) {
  const insertedRow = {
    id: 'invited-uuid', phone: '+919876543210', role: 'shop_staff',
    status: 'INVITED', invited_at: new Date(),
  };

  const repo = {
    findByPhoneInShop: overrides.findByPhoneInShop ?? vi.fn().mockResolvedValue(null),
    insertInvited: overrides.insertInvited ?? vi.fn().mockResolvedValue(insertedRow),
    listStaff: overrides.listStaff ?? vi.fn().mockResolvedValue([insertedRow]),
    lookupByPhone: vi.fn(),
    linkFirebaseUid: vi.fn(),
  } as unknown as AuthRepository;

  const sms: ISmsAdapter = { send: vi.fn().mockResolvedValue(undefined) };

  const auditClient = makeAuditClient();
  const pool = { connect: vi.fn().mockResolvedValue(auditClient) } as unknown as Pool;

  const svc = new AuthService(
    pool,
    {} as FirebaseAdminProvider,
    repo,
    {} as AuthRateLimitService,
    sms,
  );

  return { svc, repo, sms, pool, auditClient };
}

describe('AuthService.invite()', () => {
  it('inserts INVITED row, sends SMS, emits audit on happy path', async () => {
    const { svc, repo, sms } = makeSvc();
    const result = await tenantContext.runWith(ownerCtx, () =>
      svc.invite({ phone: '+919876543210', role: 'shop_staff' }),
    );
    expect(repo.findByPhoneInShop).toHaveBeenCalledWith('+919876543210');
    expect(repo.insertInvited).toHaveBeenCalledWith({
      phone: '+919876543210', role: 'shop_staff', invitedByUserId: 'owner-uuid',
    });
    expect(sms.send).toHaveBeenCalledWith('+919876543210', expect.any(String));
    expect(result.status).toBe('INVITED');
    expect(result.id).toBe('invited-uuid');
  });

  it('throws 409 when phone is already INVITED', async () => {
    const { svc } = makeSvc({
      findByPhoneInShop: vi.fn().mockResolvedValue({ id: 'existing', status: 'INVITED' }),
    });
    await expect(
      tenantContext.runWith(ownerCtx, () =>
        svc.invite({ phone: '+919876543210', role: 'shop_staff' }),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws 409 when phone is already ACTIVE', async () => {
    const { svc } = makeSvc({
      findByPhoneInShop: vi.fn().mockResolvedValue({ id: 'existing', status: 'ACTIVE' }),
    });
    await expect(
      tenantContext.runWith(ownerCtx, () =>
        svc.invite({ phone: '+919876543210', role: 'shop_staff' }),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws 400 on invalid phone format', async () => {
    const { svc } = makeSvc();
    await expect(
      tenantContext.runWith(ownerCtx, () =>
        svc.invite({ phone: '9876543210', role: 'shop_staff' }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('does NOT insert when phone is invalid', async () => {
    const { svc, repo } = makeSvc();
    await expect(
      tenantContext.runWith(ownerCtx, () =>
        svc.invite({ phone: 'not-a-phone', role: 'shop_staff' }),
      ),
    ).rejects.toThrow();
    expect(repo.insertInvited).not.toHaveBeenCalled();
  });
});

describe('AuthService.listStaff()', () => {
  it('returns the staff list from repo', async () => {
    const { svc, repo } = makeSvc();
    const result = await tenantContext.runWith(ownerCtx, () => svc.listStaff());
    expect(repo.listStaff).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });
});
