/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CrmService } from './crm.service';
import type { CrmRepository } from './crm.repository';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER_ID = 'eeeeeeee-ffff-4000-8000-000000000003';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: { requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }) },
}));

function fakePool() {
  return { connect: vi.fn(), query: vi.fn(async () => ({ rows: [{ kek_key_arn: `arn:shop:${SHOP}` }] })) } as unknown as import('pg').Pool;
}
function fakeKms() {
  return { generateDataKey: vi.fn(async (keyArn: string) => ({ plaintext: Buffer.alloc(32), encryptedDek: Buffer.from(`enc:${keyArn}`) })), decryptDataKey: vi.fn(async () => Buffer.alloc(32)) };
}
function baseCustomerRow(overrides: Record<string, unknown> = {}) {
  return { id: CUSTOMER_ID, shop_id: SHOP, phone: '+919876543210', name: 'Test Customer', email: null, address_line1: null, address_line2: null, city: null, state: null, pincode: null, dob_year: null, pan_ciphertext: null, pan_key_id: null, notes: null, viewing_consent: false, created_by_user_id: USER, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'), ...overrides };
}
function fakeRepo(rows: Record<string, unknown>[] = []) {
  const row = rows[0] ?? baseCustomerRow();
  return { insertCustomer: vi.fn(async () => row), listCustomers: vi.fn(async () => ({ rows: rows.length ? rows : [row], total: rows.length || 1 })), getCustomerById: vi.fn(async () => row), updateCustomer: vi.fn(async () => row) } as unknown as CrmRepository;
}
function fakeSearchSvc() {
  return { indexCustomer: vi.fn(async () => undefined), removeFromIndex: vi.fn(async () => undefined), searchCustomers: vi.fn(async () => ({ hits: [], total: 0, source: 'postgres' as const })) };
}
function makeSvc(overrides: { repo?: CrmRepository; pool?: any; kms?: any } = {}) {
  const pool = overrides.pool ?? fakePool();
  const kms = overrides.kms ?? fakeKms();
  const repo = overrides.repo ?? fakeRepo();
  return new CrmService(pool as any, kms as any, repo, fakeSearchSvc() as any);
}
function authCtx(role = 'shop_admin') { return { authenticated: true as const, shopId: SHOP, userId: USER, role } as any; }

describe('phone normalization', () => {
  it('accepts +91 E.164 phone unchanged', async () => {
    const repo = fakeRepo(); const svc = makeSvc({ repo });
    await svc.createCustomer(authCtx(), { phone: '+919876543210', name: 'Ravi' });
    const calls = (repo.insertCustomer as any).mock.calls as [any[]][];
    expect(calls[0]?.[0]).toMatchObject({ phone: '+919876543210' });
  });
  it('normalizes 10-digit number by adding +91 prefix', async () => {
    const repo = fakeRepo(); const svc = makeSvc({ repo });
    await svc.createCustomer(authCtx(), { phone: '9876543210', name: 'Ravi' });
    const calls = (repo.insertCustomer as any).mock.calls as [any[]][];
    expect(calls[0]?.[0]).toMatchObject({ phone: '+919876543210' });
  });
  it('strips spaces and dashes before normalization', async () => {
    const repo = fakeRepo(); const svc = makeSvc({ repo });
    await svc.createCustomer(authCtx(), { phone: '+91 98765-43210', name: 'Ravi' });
    const calls = (repo.insertCustomer as any).mock.calls as [any[]][];
    expect(calls[0]?.[0]).toMatchObject({ phone: '+919876543210' });
  });
  it('rejects malformed phone', async () => {
    const svc = makeSvc();
    await expect(svc.createCustomer(authCtx(), { phone: '+91876543210', name: 'Ravi' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('duplicate phone (23505)', () => {
  it('throws ConflictException with crm.phone_exists', async () => {
    const pg23505 = Object.assign(new Error('dup'), { code: '23505' });
    const repo = fakeRepo(); (repo.insertCustomer as any) = vi.fn(async () => { throw pg23505; });
    const svc = makeSvc({ repo });
    await expect(svc.createCustomer(authCtx(), { phone: '+919876543210', name: 'Ravi' })).rejects.toMatchObject({ response: { code: 'crm.phone_exists' } });
  });
});

describe('PAN encryption', () => {
  it('stores encrypted PAN — ciphertext in repo input, plaintext absent', async () => {
    const repo = fakeRepo(); const svc = makeSvc({ repo });
    await svc.createCustomer(authCtx(), { phone: '+919876543210', name: 'Ravi', pan: 'ABCDE1234F' });
    const calls = (repo.insertCustomer as any).mock.calls as [any[]][];
    const input = calls[0]?.[0] as any;
    expect(input.panCiphertext).toBeInstanceOf(Buffer);
    expect(input.panKeyId).toMatch(/arn:shop:/);
    expect(JSON.stringify(input)).not.toContain('ABCDE1234F');
  });
  it('stores null when PAN not provided', async () => {
    const repo = fakeRepo(); const svc = makeSvc({ repo });
    await svc.createCustomer(authCtx(), { phone: '+919876543210', name: 'Ravi' });
    const calls = (repo.insertCustomer as any).mock.calls as [any[]][];
    const input = calls[0]?.[0] as any;
    expect(input.panCiphertext).toBeNull(); expect(input.panKeyId).toBeNull();
  });
});

describe('updateCustomer role guard', () => {
  it('STAFF role cannot update — ForbiddenException', async () => {
    const svc = makeSvc();
    await expect(svc.updateCustomer(authCtx('shop_staff'), CUSTOMER_ID, { name: 'New Name' })).rejects.toMatchObject({ status: 403 });
  });
  it('MANAGER role can update', async () => {
    const repo = fakeRepo(); const svc = makeSvc({ repo });
    await expect(svc.updateCustomer(authCtx('shop_manager'), CUSTOMER_ID, { name: 'New Name' })).resolves.toBeDefined();
  });
});

describe('createCustomer response', () => {
  it('returns CustomerResponse with hasPan=false when no PAN', async () => {
    const svc = makeSvc();
    const result = await svc.createCustomer(authCtx(), { phone: '+919876543210', name: 'Ravi' });
    expect(result.id).toBe(CUSTOMER_ID); expect(result.hasPan).toBe(false); expect(result).not.toHaveProperty('panCiphertext');
  });
  it('returns CustomerResponse with hasPan=true when PAN is stored', async () => {
    const row = baseCustomerRow({ pan_ciphertext: Buffer.from('cipher'), pan_key_id: 'arn:shop:x' });
    const repo = fakeRepo([row]); const svc = makeSvc({ repo });
    const result = await svc.createCustomer(authCtx(), { phone: '+919876543210', name: 'Ravi', pan: 'ABCDE1234F' });
    expect(result.hasPan).toBe(true);
  });
});