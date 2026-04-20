import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { AuthRepository } from './auth.repository';

const SHOP_A = '11111111-1111-1111-1111-111111111111';
const tenantA: Tenant = { id: SHOP_A, slug: 'a', display_name: 'Test Shop', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

function makeMockPool(rows: unknown[]): { pool: Pool; client: PoolClient } {
  const client = {
    query: vi.fn().mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK'))) return;
      if (typeof sql === 'string' && (sql.includes('SET LOCAL') || sql.includes('SET app.'))) return;
      return { rows, rowCount: rows.length };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { pool, client };
}

describe('AuthRepository — invite methods', () => {
  describe('findByPhoneInShop', () => {
    it('returns null when phone not found', async () => {
      const { pool } = makeMockPool([]);
      const repo = new AuthRepository(pool);
      const result = await tenantContext.runWith(ctxA, () => repo.findByPhoneInShop('+919876543210'));
      expect(result).toBeNull();
    });

    it('returns id + status when found', async () => {
      const { pool } = makeMockPool([{ id: 'user-uuid', status: 'INVITED' }]);
      const repo = new AuthRepository(pool);
      const result = await tenantContext.runWith(ctxA, () => repo.findByPhoneInShop('+919876543210'));
      expect(result).toEqual({ id: 'user-uuid', status: 'INVITED' });
    });
  });

  describe('insertInvited', () => {
    it('returns the inserted row', async () => {
      const now = new Date();
      const { pool } = makeMockPool([{
        id: 'new-uuid', phone: '+919876543210', role: 'shop_staff',
        status: 'INVITED', invited_at: now,
      }]);
      const repo = new AuthRepository(pool);
      const result = await tenantContext.runWith(ctxA, () =>
        repo.insertInvited({ phone: '+919876543210', role: 'shop_staff', invitedByUserId: 'owner-uuid' }),
      );
      expect(result.id).toBe('new-uuid');
      expect(result.status).toBe('INVITED');
    });
  });

  describe('listStaff', () => {
    it('returns all shop_users rows', async () => {
      const rows = [
        { id: 'u1', phone: '+911111111111', display_name: '+911111111111', role: 'shop_staff', status: 'ACTIVE', invited_at: null },
      ];
      const { pool } = makeMockPool(rows);
      const repo = new AuthRepository(pool);
      const result = await tenantContext.runWith(ctxA, () => repo.listStaff());
      expect(result).toHaveLength(1);
      expect(result[0].phone).toBe('+911111111111');
    });
  });
});
