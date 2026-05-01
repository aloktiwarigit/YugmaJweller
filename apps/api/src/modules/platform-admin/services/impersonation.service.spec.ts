import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImpersonationService } from './impersonation.service';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const SHOP_ID = '22222222-2222-2222-2222-222222222222';

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

describe('ImpersonationService', () => {
  let pool: { connect: ReturnType<typeof vi.fn> };
  let client: MockClient;

  beforeEach(() => {
    process.env['IMPERSONATION_JWT_SECRET'] = 'unit-test-secret-32-bytes-aaaaaaaaaaaaaaaaaa';
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('start: inserts session, audits, returns short-lived JWT with jti = session id', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                    // BEGIN
      .mockResolvedValueOnce(undefined)                                    // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ id: SESSION_ID }] })               // INSERT impersonation_sessions
      .mockResolvedValueOnce(undefined)                                    // INSERT platform_audit_events
      .mockResolvedValueOnce(undefined);                                   // COMMIT

    const svc = new ImpersonationService(pool as never);
    const out = await svc.startImpersonation({
      platformUserId: 'p-uid',
      targetShopId: SHOP_ID,
      reason: 'investigating ticket #1234',
      ip: '127.0.0.1',
      userAgent: 'ua',
    });

    expect(out.sessionId).toBe(SESSION_ID);
    expect(out.token).toMatch(/^eyJ/);
    const decoded = JSON.parse(Buffer.from(out.token.split('.')[1]!, 'base64url').toString());
    expect(decoded.target_shop_id).toBe(SHOP_ID);
    expect(decoded.exp - decoded.iat).toBe(1800);
    expect(decoded.jti).toBe(SESSION_ID);

    // Indexes shifted by 2 for BEGIN + SET LOCAL ROLE
    const insertCall = client.query.mock.calls[2]!;
    expect(insertCall[0]).toMatch(/INSERT INTO impersonation_sessions/);
    const auditCall = client.query.mock.calls[3]!;
    expect(auditCall[0]).toMatch(/INSERT INTO platform_audit_events/);
    expect(auditCall[1]).toContain('impersonation.started');
    expect(auditCall[1]).toContain(SHOP_ID);
  });

  it('end: marks session ended_at and audits impersonation.ended', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                    // BEGIN
      .mockResolvedValueOnce(undefined)                                    // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 1 })                              // UPDATE
      .mockResolvedValueOnce(undefined)                                    // INSERT audit
      .mockResolvedValueOnce(undefined);                                   // COMMIT

    const svc = new ImpersonationService(pool as never);
    await svc.endImpersonation(SESSION_ID, 'p-uid');

    const updateCall = client.query.mock.calls[2]!;
    expect(updateCall[0]).toMatch(/UPDATE impersonation_sessions/);
    expect(updateCall[0]).toMatch(/ended_at = now\(\)/);
    expect(updateCall[1]).toEqual([SESSION_ID, 'p-uid']);
  });

  it('end: 404 when session does not belong to caller (or already ended)', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                    // BEGIN
      .mockResolvedValueOnce(undefined)                                    // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 0 })                              // UPDATE returns 0 → throws
      .mockResolvedValueOnce(undefined);                                   // ROLLBACK

    const svc = new ImpersonationService(pool as never);
    await expect(svc.endImpersonation(SESSION_ID, 'wrong-uid')).rejects.toMatchObject({
      response: { code: 'impersonation_session.not_found' },
    });
  });

  it('refuses when IMPERSONATION_JWT_SECRET is unset', async () => {
    delete process.env['IMPERSONATION_JWT_SECRET'];
    const svc = new ImpersonationService(pool as never);
    await expect(
      svc.startImpersonation({ platformUserId: 'p', targetShopId: SHOP_ID, reason: 'r' }),
    ).rejects.toMatchObject({
      response: { code: 'impersonation.secret_missing' },
    });
  });

  it('refuses when IMPERSONATION_JWT_SECRET is shorter than 32 bytes', async () => {
    process.env['IMPERSONATION_JWT_SECRET'] = 'too-short';
    const svc = new ImpersonationService(pool as never);
    await expect(
      svc.startImpersonation({ platformUserId: 'p', targetShopId: SHOP_ID, reason: 'r' }),
    ).rejects.toMatchObject({
      response: { code: 'impersonation.secret_invalid' },
    });
  });
});
