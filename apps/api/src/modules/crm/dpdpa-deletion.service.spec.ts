/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DpdpaDeletionService } from './dpdpa-deletion.service';
import type { DpdpaDeletionRepository } from './dpdpa-deletion.repository';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const SHOP_OTHER = 'aaaaaaaa-bbbb-4000-8000-0000000000ff';
const USER = 'cccccccc-dddd-4000-8000-000000000002';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';

function authCtx(role = 'shop_admin'): any {
  return { authenticated: true as const, shopId: SHOP, userId: USER, role };
}

function fakePool(): any {
  return { query: vi.fn(async () => ({ rows: [] })) };
}

function fakeQueue(): any {
  return { add: vi.fn(async () => undefined) };
}

function fakeRepo(overrides: Partial<DpdpaDeletionRepository> = {}): DpdpaDeletionRepository {
  const scheduledAt = new Date('2026-04-26T12:00:00Z');
  const hardDeleteAt = new Date('2026-05-26T12:00:00Z');
  return {
    softDeleteAtomic: vi.fn(async () => ({ scheduledAt, hardDeleteAt })),
    hardDeleteAtomic: vi.fn(async () => true),
    findDueForHardDelete: vi.fn(async () => []),
    ...overrides,
  } as unknown as DpdpaDeletionRepository;
}

function makeSvc(overrides: { repo?: DpdpaDeletionRepository; pool?: any; queue?: any; searchSvc?: any } = {}): DpdpaDeletionService {
  return new DpdpaDeletionService(
    overrides.pool ?? fakePool(),
    overrides.repo ?? fakeRepo(),
    overrides.searchSvc ?? ({ removeFromIndex: vi.fn().mockResolvedValue(undefined) } as any),
    overrides.queue ?? fakeQueue(),
  );
}

beforeEach(() => { vi.clearAllMocks(); });

// ─── requestDeletion ──────────────────────────────────────────────────────────

describe('requestDeletion', () => {
  it('calls repo.softDeleteAtomic with customerId and requestedBy', async () => {
    const repo = fakeRepo();
    const svc = makeSvc({ repo });
    await svc.requestDeletion(authCtx(), CUSTOMER, 'owner');
    expect(repo.softDeleteAtomic).toHaveBeenCalledWith(CUSTOMER, 'owner');
  });

  it('returns scheduledAt and hardDeleteAt as ISO strings', async () => {
    const svc = makeSvc();
    const result = await svc.requestDeletion(authCtx(), CUSTOMER, 'owner');
    expect(result).toEqual({
      scheduledAt: '2026-04-26T12:00:00.000Z',
      hardDeleteAt: '2026-05-26T12:00:00.000Z',
    });
  });

  it('enqueues a delayed BullMQ job with shopId/customerId/hardDeleteAt', async () => {
    const queue = fakeQueue();
    const svc = makeSvc({ queue });
    await svc.requestDeletion(authCtx(), CUSTOMER, 'customer');
    expect(queue.add).toHaveBeenCalledOnce();
    const [name, payload, opts] = (queue.add as any).mock.calls[0];
    expect(name).toBe('hard-delete');
    expect(payload).toMatchObject({
      shopId: SHOP,
      customerId: CUSTOMER,
      hardDeleteAt: '2026-05-26T12:00:00.000Z',
    });
    // Delay must roughly equal 30 days; allow ±1 minute for test clock skew
    const expected = new Date('2026-05-26T12:00:00Z').getTime() - Date.now();
    expect(opts.delay).toBeGreaterThan(expected - 60_000);
    expect(opts.delay).toBeLessThan(expected + 60_000);
  });

  it('rethrows ConflictException when already deleted', async () => {
    const repo = fakeRepo({
      softDeleteAtomic: vi.fn(async () => {
        throw new ConflictException({ code: 'crm.deletion.already_requested' });
      }),
    });
    const svc = makeSvc({ repo });
    await expect(svc.requestDeletion(authCtx(), CUSTOMER, 'owner')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows UnprocessableEntityException when DRAFT invoices exist', async () => {
    const repo = fakeRepo({
      softDeleteAtomic: vi.fn(async () => {
        throw new UnprocessableEntityException({ code: 'crm.deletion.open_invoices' });
      }),
    });
    const svc = makeSvc({ repo });
    await expect(svc.requestDeletion(authCtx(), CUSTOMER, 'owner')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('does not enqueue a job when softDeleteAtomic throws', async () => {
    const queue = fakeQueue();
    const repo = fakeRepo({
      softDeleteAtomic: vi.fn(async () => {
        throw new ConflictException({ code: 'crm.deletion.already_requested' });
      }),
    });
    const svc = makeSvc({ repo, queue });
    await expect(svc.requestDeletion(authCtx(), CUSTOMER, 'owner')).rejects.toBeInstanceOf(ConflictException);
    expect(queue.add).not.toHaveBeenCalled();
  });
});

// ─── restoreDeletion ──────────────────────────────────────────────────────────

describe('restoreDeletion', () => {
  it('always throws UnprocessableEntityException with pii_already_scrubbed', async () => {
    const svc = makeSvc();
    await expect(svc.restoreDeletion(authCtx(), CUSTOMER))
      .rejects.toMatchObject({ response: { code: 'crm.deletion.pii_already_scrubbed' } });
  });

  it('does not call repo on restore (PII gone, no path forward)', async () => {
    const repo = fakeRepo();
    const svc = makeSvc({ repo });
    await expect(svc.restoreDeletion(authCtx(), CUSTOMER)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.softDeleteAtomic).not.toHaveBeenCalled();
    expect(repo.hardDeleteAtomic).not.toHaveBeenCalled();
  });
});

// ─── executeHardDelete ────────────────────────────────────────────────────────

describe('executeHardDelete', () => {
  function bgCtx(): any {
    return { authenticated: false as const, shopId: SHOP, tenant: { id: SHOP, slug: 'x', display_name: 'x', status: 'ACTIVE' } };
  }

  it('calls repo.hardDeleteAtomic with customerId', async () => {
    const repo = fakeRepo();
    const svc = makeSvc({ repo });
    await svc.executeHardDelete(bgCtx(), CUSTOMER);
    expect(repo.hardDeleteAtomic).toHaveBeenCalledWith(CUSTOMER);
  });

  it('returns silently when already hard-deleted (idempotent)', async () => {
    const repo = fakeRepo({ hardDeleteAtomic: vi.fn(async () => false) });
    const svc = makeSvc({ repo });
    await expect(svc.executeHardDelete(bgCtx(), CUSTOMER)).resolves.toBeUndefined();
  });

  it('does not throw if scheduled time has not yet elapsed (defensive: repo returns false)', async () => {
    const repo = fakeRepo({ hardDeleteAtomic: vi.fn(async () => false) });
    const svc = makeSvc({ repo });
    await expect(svc.executeHardDelete(bgCtx(), CUSTOMER)).resolves.toBeUndefined();
    expect(repo.hardDeleteAtomic).toHaveBeenCalled();
  });
});

// ─── findDueForHardDelete (sweep) ─────────────────────────────────────────────

describe('findDueForHardDelete', () => {
  it('delegates to repo (used by daily sweep)', async () => {
    const repo = fakeRepo({
      findDueForHardDelete: vi.fn(async () => [
        { customerId: CUSTOMER, shopId: SHOP },
        { customerId: 'other-cust', shopId: SHOP_OTHER },
      ]),
    });
    const svc = makeSvc({ repo });
    const due = await svc.findDueForHardDelete();
    expect(due).toHaveLength(2);
    expect(due[0]).toEqual({ customerId: CUSTOMER, shopId: SHOP });
  });
});
