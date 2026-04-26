/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ConsentService } from './consent.service';
import type { ConsentRepository, ViewingConsentRow, UpsertConsentResult } from './consent.repository';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';

function authCtx(role = 'shop_admin'): any {
  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
}

function fakePool() {
  return { query: vi.fn(async () => ({ rows: [] })) } as unknown as import('pg').Pool;
}

function row(overrides: Partial<ViewingConsentRow> = {}): ViewingConsentRow {
  return {
    id: '11111111-2222-4000-8000-000000000004',
    shop_id: SHOP,
    customer_id: CUSTOMER,
    consent_given: false,
    consent_version: 'v1',
    consented_at: null,
    withdrawn_at: null,
    ip_at_consent: null,
    user_agent_at_consent: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function fakeRepo(overrides: Partial<ConsentRepository> = {}): ConsentRepository {
  return {
    getByCustomer: vi.fn(async () => null),
    upsertConsent: vi.fn(async (): Promise<UpsertConsentResult> => ({ before: null, after: row() })),
    customerExists: vi.fn(async () => true),
    ...overrides,
  } as unknown as ConsentRepository;
}

function makeSvc(repo?: ConsentRepository, pool?: any): ConsentService {
  return new ConsentService(pool ?? fakePool(), repo ?? fakeRepo());
}

// ─── getConsent ──────────────────────────────────────────────────────────────

describe('getConsent', () => {
  it('returns default { consentGiven: false, consentVersion: "v1" } when no row exists', async () => {
    const repo = fakeRepo({ getByCustomer: vi.fn(async () => null) });
    const svc = makeSvc(repo);
    const result = await svc.getConsent(authCtx(), CUSTOMER);
    expect(result).toEqual({
      consentGiven: false,
      consentVersion: 'v1',
      consentedAt: null,
      withdrawnAt: null,
    });
  });

  it('returns row mapped to response when consent exists', async () => {
    const consentedAt = new Date('2026-02-01T10:00:00Z');
    const repo = fakeRepo({
      getByCustomer: vi.fn(async () => row({ consent_given: true, consented_at: consentedAt })),
    });
    const svc = makeSvc(repo);
    const result = await svc.getConsent(authCtx(), CUSTOMER);
    expect(result).toEqual({
      consentGiven: true,
      consentVersion: 'v1',
      consentedAt: consentedAt.toISOString(),
      withdrawnAt: null,
    });
  });

  it('throws NotFoundException for unknown/foreign-tenant customer', async () => {
    const repo = fakeRepo({ customerExists: vi.fn(async () => false) });
    const svc = makeSvc(repo);
    await expect(svc.getConsent(authCtx(), CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── updateConsent ───────────────────────────────────────────────────────────

describe('updateConsent', () => {
  it('grant: upsert with consentGiven=true; consented_at set in returned row', async () => {
    const consentedAt = new Date('2026-02-01T10:00:00Z');
    const repo = fakeRepo({
      upsertConsent: vi.fn(async () => ({
        before: null,
        after: row({ consent_given: true, consented_at: consentedAt }),
      })),
    });
    const svc = makeSvc(repo);
    const result = await svc.updateConsent(authCtx(), CUSTOMER, { consentGiven: true });
    expect(repo.upsertConsent).toHaveBeenCalledOnce();
    const call = (repo.upsertConsent as any).mock.calls[0][0];
    expect(call).toMatchObject({ customerId: CUSTOMER, consentGiven: true });
    expect(result.consentGiven).toBe(true);
    expect(result.consentedAt).toBe(consentedAt.toISOString());
    expect(result.withdrawnAt).toBeNull();
  });

  it('withdraw: upsert with consentGiven=false; withdrawn_at set in returned row', async () => {
    const withdrawnAt = new Date('2026-03-01T10:00:00Z');
    const repo = fakeRepo({
      upsertConsent: vi.fn(async () => ({
        before: row({ consent_given: true, consented_at: new Date('2026-02-01T10:00:00Z') }),
        after: row({ consent_given: false, withdrawn_at: withdrawnAt }),
      })),
    });
    const svc = makeSvc(repo);
    const result = await svc.updateConsent(authCtx(), CUSTOMER, { consentGiven: false });
    const call = (repo.upsertConsent as any).mock.calls[0][0];
    expect(call).toMatchObject({ customerId: CUSTOMER, consentGiven: false });
    expect(result.consentGiven).toBe(false);
    expect(result.withdrawnAt).toBe(withdrawnAt.toISOString());
    expect(result.consentedAt).toBeNull();
  });

  it('passes ip + userAgent through to repository for forensic record', async () => {
    const repo = fakeRepo();
    const svc = makeSvc(repo);
    await svc.updateConsent(authCtx(), CUSTOMER, { consentGiven: true }, {
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
    });
    const call = (repo.upsertConsent as any).mock.calls[0][0];
    expect(call.ip).toBe('203.0.113.7');
    expect(call.userAgent).toBe('Mozilla/5.0');
  });

  it('throws NotFoundException for unknown/foreign-tenant customer', async () => {
    const repo = fakeRepo({ customerExists: vi.fn(async () => false) });
    const svc = makeSvc(repo);
    await expect(svc.updateConsent(authCtx(), CUSTOMER, { consentGiven: true }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repo.upsertConsent).not.toHaveBeenCalled();
  });
});
