import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImpersonationSessionAdapter } from './impersonation-session.adapter';

describe('ImpersonationSessionAdapter', () => {
  // After PG_POOL_ADMIN refactor: pool already runs as platform_admin; isActive is a single
  // pool.query — no transaction, no role switch.
  let pool: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    pool = { query: vi.fn() };
  });

  it('returns true when the session row reports active=true', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ active: true }] });
    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('11111111-1111-1111-1111-111111111111')).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect((pool.query.mock.calls[0]![0] as string)).toMatch(/FROM impersonation_sessions/);
  });

  it('returns false when the session row reports active=false', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ active: false }] });
    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('11111111-1111-1111-1111-111111111111')).resolves.toBe(false);
  });

  it('returns false when the session id does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('99999999-9999-9999-9999-999999999999')).resolves.toBe(false);
  });

  it('propagates pool errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('db boom'));
    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('11111111-1111-1111-1111-111111111111')).rejects.toThrow('db boom');
  });
});
