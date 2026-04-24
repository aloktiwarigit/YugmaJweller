import type { SyncTable } from '../protocol';

// All current tables use Last-Writer-Wins by updated_at.
// Returns 'accept' if the client row should win, 'reject' if server row wins.
export function resolveConflict(
  _table: SyncTable,
  clientRow: Record<string, unknown>,
  serverRow: Record<string, unknown> | null,
): 'accept' | 'reject' {
  if (serverRow === null) return 'accept';
  const clientTs = new Date(clientRow['updated_at'] as string).getTime();
  const serverTs = new Date(serverRow['updated_at'] as string).getTime();
  return clientTs >= serverTs ? 'accept' : 'reject';
}
