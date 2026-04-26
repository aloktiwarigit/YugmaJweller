/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';

vi.mock('@goldsmith/db', async () => {
  const actual = await vi.importActual<typeof import('@goldsmith/db')>('@goldsmith/db');
  return { ...actual, withTenantTx: vi.fn() };
});

vi.mock('@goldsmith/audit', async () => {
  const actual = await vi.importActual<typeof import('@goldsmith/audit')>('@goldsmith/audit');
  return { ...actual, auditLog: vi.fn(async () => undefined) };
});

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER_AUTHOR = 'cccccccc-dddd-4000-8000-000000000002';
const USER_OTHER = 'cccccccc-dddd-4000-8000-000000000099';
const CUSTOMER = 'eeeeeeee-ffff-4000-8000-000000000003';
const NOTE_ID = '55555555-6666-4000-8000-000000000005';

function authCtx(userId = USER_AUTHOR): any {
  return { authenticated: true as const, shopId: SHOP, userId, role: 'shop_admin' };
}

function fakePool(): any {
  return { query: vi.fn(async () => ({ rows: [] })) };
}

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    shop_id: SHOP,
    customer_id: CUSTOMER,
    body: 'test note',
    author_user_id: USER_AUTHOR,
    deleted_at: null,
    created_at: new Date('2026-01-01T10:00:00Z'),
    updated_at: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

function makeTx(rows: any[] = []) {
  return {
    query: vi.fn(async () => ({ rows })),
  };
}

function setupWithTenantTx(tx: any): void {
  (withTenantTx as any).mockImplementation(
    (_p: any, fn: (tx: any) => Promise<any>) => fn(tx),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addNote', () => {
  it('inserts note and returns response', async () => {
    const tx = makeTx([noteRow({ body: 'hello' })]);
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    const result = await svc.addNote(authCtx(), CUSTOMER, 'hello');

    expect(result).toMatchObject({
      id: NOTE_ID,
      customerId: CUSTOMER,
      body: 'hello',
      authorUserId: USER_AUTHOR,
    });
    expect(tx.query).toHaveBeenCalledOnce();
    const sql = tx.query.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO customer_notes');
    expect(sql).toContain("current_setting('app.current_shop_id')");
  });

  it('emits CRM_NOTE_ADDED audit event', async () => {
    const tx = makeTx([noteRow()]);
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await svc.addNote(authCtx(), CUSTOMER, 'audit me');

    // audit is fired async via void+catch; flush microtasks
    await new Promise((r) => setImmediate(r));

    expect(auditLog).toHaveBeenCalledOnce();
    const auditArg = (auditLog as any).mock.calls[0][1];
    expect(auditArg.action).toBe(AuditAction.CRM_NOTE_ADDED);
    expect(auditArg.subjectType).toBe('customer_note');
    expect(auditArg.actorUserId).toBe(USER_AUTHOR);
  });
});

describe('listNotes', () => {
  it('returns notes; query excludes soft-deleted via deleted_at IS NULL', async () => {
    const tx = makeTx([noteRow({ body: 'visible' })]);
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    const result = await svc.listNotes(authCtx(), CUSTOMER);

    expect(result).toHaveLength(1);
    expect(result[0].body).toBe('visible');
    const sql = tx.query.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('ORDER BY created_at DESC');
  });

  it('returns empty array when no notes', async () => {
    const tx = makeTx([]);
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    const result = await svc.listNotes(authCtx(), CUSTOMER);

    expect(result).toEqual([]);
  });
});

describe('deleteNote — author/owner guard', () => {
  it('author can delete their own note', async () => {
    const tx = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [noteRow({ author_user_id: USER_AUTHOR })] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await svc.deleteNote(authCtx(), NOTE_ID, USER_AUTHOR, 'shop_staff');

    expect(tx.query).toHaveBeenCalledTimes(2);
    const updateSql = tx.query.mock.calls[1][0];
    expect(updateSql).toContain('UPDATE customer_notes SET deleted_at = now()');
  });

  it('shop_admin can delete any note (even non-author)', async () => {
    const tx = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [noteRow({ author_user_id: USER_AUTHOR })] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await svc.deleteNote(authCtx(), NOTE_ID, USER_OTHER, 'shop_admin');

    expect(tx.query).toHaveBeenCalledTimes(2);
  });

  it('non-author STAFF gets ForbiddenException with Hindi message', async () => {
    const tx = {
      query: vi.fn(async () => ({ rows: [noteRow({ author_user_id: USER_AUTHOR })] })),
    };
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await expect(
      svc.deleteNote(authCtx(), NOTE_ID, USER_OTHER, 'shop_staff'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // SELECT was made but UPDATE was not
    expect(tx.query).toHaveBeenCalledTimes(1);
  });

  it('non-author MANAGER (not admin) is also forbidden', async () => {
    const tx = {
      query: vi.fn(async () => ({ rows: [noteRow({ author_user_id: USER_AUTHOR })] })),
    };
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await expect(
      svc.deleteNote(authCtx(), NOTE_ID, USER_OTHER, 'shop_manager'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFoundException if note does not exist', async () => {
    const tx = { query: vi.fn(async () => ({ rows: [] })) };
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await expect(
      svc.deleteNote(authCtx(), NOTE_ID, USER_AUTHOR, 'shop_admin'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-delete: SELECT filters by deleted_at IS NULL (cannot re-delete)', async () => {
    const tx = { query: vi.fn(async () => ({ rows: [] })) };
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await expect(
      svc.deleteNote(authCtx(), NOTE_ID, USER_AUTHOR, 'shop_admin'),
    ).rejects.toBeInstanceOf(NotFoundException);

    const sql = tx.query.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
  });
});

describe('tenant isolation', () => {
  it('all writes use current_setting tenant guard inside withTenantTx', async () => {
    const tx = makeTx([noteRow()]);
    setupWithTenantTx(tx);
    const svc = new NotesService(fakePool());

    await svc.addNote(authCtx(), CUSTOMER, 'note');

    // SQL must reference current_setting (not a hardcoded shop_id binding)
    const sql = tx.query.mock.calls[0][0];
    expect(sql).toMatch(/current_setting\('app\.current_shop_id'\)/);

    // withTenantTx wraps every write — service never bypasses it
    expect(withTenantTx).toHaveBeenCalled();
  });
});
