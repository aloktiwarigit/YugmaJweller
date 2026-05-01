import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImpersonationSessionAdapter } from './impersonation-session.adapter';

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

describe('ImpersonationSessionAdapter', () => {
  let pool: { connect: ReturnType<typeof vi.fn> };
  let client: MockClient;

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('returns true when the session row reports active=true (inside BEGIN/COMMIT)', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                            // BEGIN
      .mockResolvedValueOnce(undefined)                            // SET LOCAL ROLE platform_admin
      .mockResolvedValueOnce({ rows: [{ active: true }] })         // SELECT
      .mockResolvedValueOnce(undefined);                           // COMMIT

    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('11111111-1111-1111-1111-111111111111')).resolves.toBe(true);

    expect(client.query.mock.calls[0]![0]).toBe('BEGIN');
    expect(client.query.mock.calls[1]![0]).toBe('SET LOCAL ROLE platform_admin');
    expect(client.query.mock.calls[3]![0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('returns false when the session row reports active=false', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ active: false }] })
      .mockResolvedValueOnce(undefined);

    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('11111111-1111-1111-1111-111111111111')).resolves.toBe(false);
  });

  it('returns false when the session id does not exist', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined);

    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('99999999-9999-9999-9999-999999999999')).resolves.toBe(false);
  });

  it('rolls back and rethrows when the SELECT fails', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('db boom'))
      .mockResolvedValueOnce(undefined);                           // ROLLBACK

    const adapter = new ImpersonationSessionAdapter(pool as never);
    await expect(adapter.isActive('11111111-1111-1111-1111-111111111111')).rejects.toThrow('db boom');
    expect(client.query.mock.calls[3]![0]).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
