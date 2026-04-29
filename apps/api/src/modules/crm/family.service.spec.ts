/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FamilyService } from './family.service';
import type { FamilyRepository } from './family.repository';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER_A = 'eeeeeeee-ffff-4000-8000-000000000003';
const CUSTOMER_B = '11111111-2222-4000-8000-000000000004';
const LINK_ID = '55555555-6666-4000-8000-000000000005';

function authCtx(role = 'shop_admin'): any {
  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
}

function fakePool() {
  return { query: vi.fn(async () => ({ rows: [] })) } as unknown as import('pg').Pool;
}

function baseFamilyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LINK_ID,
    shop_id: SHOP,
    customer_id: CUSTOMER_A,
    related_customer_id: CUSTOMER_B,
    relationship: 'SPOUSE',
    created_by_user_id: USER,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function fakeRepo(overrides: Partial<FamilyRepository> = {}): FamilyRepository {
  return {
    insertLink: vi.fn(async () => baseFamilyRow()),
    insertLinkPair: vi.fn(async () => baseFamilyRow()),
    deleteLink: vi.fn(async () => undefined),
    deleteLinkPair: vi.fn(async () => undefined),
    getLinksByCustomer: vi.fn(async () => []),
    getLinkById: vi.fn(async () => baseFamilyRow()),
    unlinkByIdAtomic: vi.fn(async () => baseFamilyRow()),
    customerBelongsToShop: vi.fn(async () => true),
    ...overrides,
  } as unknown as FamilyRepository;
}

function makeSvc(repo?: FamilyRepository, pool?: any): FamilyService {
  return new FamilyService(pool ?? fakePool(), repo ?? fakeRepo());
}

// ─── linkFamily ──────────────────────────────────────────────────────────────

describe('linkFamily', () => {
  it('creates both directed edges (A→B and B→A)', async () => {
    const repo = fakeRepo();
    const svc = makeSvc(repo);
    await svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'SPOUSE' });
    expect(repo.insertLinkPair).toHaveBeenCalledOnce();
    const call = (repo.insertLinkPair as any).mock.calls[0][0];
    expect(call).toMatchObject({ customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'SPOUSE', reverseRelationship: 'SPOUSE', createdByUserId: USER });
  });

  it('maps PARENT→CHILD for reverse edge', async () => {
    const repo = fakeRepo();
    const svc = makeSvc(repo);
    await svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'PARENT' });
    const call = (repo.insertLinkPair as any).mock.calls[0][0];
    expect(call.reverseRelationship).toBe('CHILD');
  });

  it('maps CHILD→PARENT for reverse edge', async () => {
    const repo = fakeRepo();
    const svc = makeSvc(repo);
    await svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'CHILD' });
    const call = (repo.insertLinkPair as any).mock.calls[0][0];
    expect(call.reverseRelationship).toBe('PARENT');
  });

  it('SIBLING↔SIBLING reverse is SIBLING', async () => {
    const repo = fakeRepo();
    const svc = makeSvc(repo);
    await svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'SIBLING' });
    const call = (repo.insertLinkPair as any).mock.calls[0][0];
    expect(call.reverseRelationship).toBe('SIBLING');
  });

  it('IN_LAW↔IN_LAW reverse is IN_LAW', async () => {
    const repo = fakeRepo();
    const svc = makeSvc(repo);
    await svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'IN_LAW' });
    const call = (repo.insertLinkPair as any).mock.calls[0][0];
    expect(call.reverseRelationship).toBe('IN_LAW');
  });

  it('OTHER↔OTHER reverse is OTHER', async () => {
    const repo = fakeRepo();
    const svc = makeSvc(repo);
    await svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'OTHER' });
    const call = (repo.insertLinkPair as any).mock.calls[0][0];
    expect(call.reverseRelationship).toBe('OTHER');
  });

  it('self-link throws BadRequestException', async () => {
    const svc = makeSvc();
    await expect(svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_A, relationship: 'SPOUSE' }))
      .rejects.toMatchObject({ response: { code: 'crm.family_self_link' } });
  });

  it('duplicate link (PG 23505) throws ConflictException with crm.family_link_exists', async () => {
    const pg23505 = Object.assign(new Error('dup'), { code: '23505' });
    const repo = fakeRepo({ insertLinkPair: vi.fn(async () => { throw pg23505; }) });
    const svc = makeSvc(repo);
    await expect(svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'SPOUSE' }))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'SPOUSE' }))
      .rejects.toMatchObject({ response: { code: 'crm.family_link_exists' } });
  });

  it('cross-tenant link attempt throws NotFoundException', async () => {
    const repo = fakeRepo({ customerBelongsToShop: vi.fn(async (_shopId: string, customerId: string) => customerId !== CUSTOMER_B) });
    const svc = makeSvc(repo);
    await expect(svc.linkFamily(authCtx(), { customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'SPOUSE' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── unlinkFamily ─────────────────────────────────────────────────────────────

describe('unlinkFamily', () => {
  it('deletes both directed edges atomically via single TX call', async () => {
    const repo = fakeRepo({ unlinkByIdAtomic: vi.fn(async () => baseFamilyRow()) });
    const svc = makeSvc(repo);
    await svc.unlinkFamily(authCtx(), CUSTOMER_A, LINK_ID);
    expect(repo.unlinkByIdAtomic).toHaveBeenCalledOnce();
    const call = (repo.unlinkByIdAtomic as any).mock.calls[0][0];
    expect(call).toBe(LINK_ID);
  });

  it('wrong tenant (link not found) throws NotFoundException', async () => {
    const repo = fakeRepo({ unlinkByIdAtomic: vi.fn(async () => null) });
    const svc = makeSvc(repo);
    await expect(svc.unlinkFamily(authCtx(), CUSTOMER_A, LINK_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── getFamilyLinks ───────────────────────────────────────────────────────────

describe('getFamilyLinks', () => {
  it('throws NotFoundException for unknown/foreign-tenant customer', async () => {
    const repo = fakeRepo({ customerBelongsToShop: vi.fn(async () => false) });
    const svc = makeSvc(repo);
    await expect(svc.getFamilyLinks(authCtx(), CUSTOMER_A)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns links joined with customer info', async () => {
    const linked: any = { ...baseFamilyRow(), related_name: 'Ramesh Gupta', related_phone: '+919876543210' };
    const repo = fakeRepo({ getLinksByCustomer: vi.fn(async () => [linked]) });
    const svc = makeSvc(repo);
    const result = await svc.getFamilyLinks(authCtx(), CUSTOMER_A);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: LINK_ID, customerId: CUSTOMER_A, relatedCustomerId: CUSTOMER_B, relationship: 'SPOUSE', relatedName: 'Ramesh Gupta', relatedPhone: '+919876543210' });
  });

  it('returns empty array when no links exist', async () => {
    const repo = fakeRepo({ getLinksByCustomer: vi.fn(async () => []) });
    const svc = makeSvc(repo);
    const result = await svc.getFamilyLinks(authCtx(), CUSTOMER_A);
    expect(result).toEqual([]);
  });
});

void BadRequestException; // suppress unused import warning if TS strict mode
