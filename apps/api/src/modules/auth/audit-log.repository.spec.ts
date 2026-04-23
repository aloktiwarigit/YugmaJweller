import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogRepository } from './audit-log.repository';

// ---------------------------------------------------------------------------
// Mock withTenantTx so unit tests don't need a real pool or tenant context.
// The mock calls the callback immediately with a mock tx object.
// ---------------------------------------------------------------------------
const mockQuery = vi.fn();

vi.mock('@goldsmith/db', () => ({
  withTenantTx: vi.fn((_pool: unknown, fn: (tx: { query: typeof mockQuery }) => Promise<unknown>) =>
    fn({ query: mockQuery }),
  ),
}));

describe('AuditLogRepository', () => {
  let repo: AuditLogRepository;

  beforeEach(() => {
    mockQuery.mockReset();
    repo = new AuditLogRepository({} as import('pg').Pool);
  });

  it('clamps pageSize to 50 when larger value provided', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                        // data query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });         // count query

    await repo.findPaginated({ page: 1, pageSize: 100, dateRange: '7d' });

    // First call args: [sql, [dateFrom, actions, pageSize, offset]]
    const firstCallParams = mockQuery.mock.calls[0][1] as unknown[];
    expect(firstCallParams[2]).toBe(50); // pageSize clamped to 50
  });

  it('passes null for actions when no category filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '5' }] });

    await repo.findPaginated({ page: 1, pageSize: 20 });

    const firstCallParams = mockQuery.mock.calls[0][1] as unknown[];
    expect(firstCallParams[1]).toBeNull(); // no category → null actions
  });

  it('returns total from count query', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '42' }] });

    const result = await repo.findPaginated({ page: 1, pageSize: 20 });

    expect(result.total).toBe(42);
  });

  it('maps null actor_name to "System" and null actor_role to "system"', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            action: 'AUTH_LOGOUT_ALL',
            created_at: new Date('2026-04-20T10:00:00Z'),
            metadata: null,
            actor_name: null,
            actor_role: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    const result = await repo.findPaginated({ page: 1, pageSize: 20 });

    expect(result.events[0].actorName).toBe('System');
    expect(result.events[0].actorRole).toBe('system');
  });
});
