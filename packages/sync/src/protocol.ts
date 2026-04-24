// packages/sync/src/protocol.ts
// Shared types for the ADR-0004 pull/push sync protocol.
// Used by both the NestJS server and the shopkeeper client.

export type SyncTable = 'products' | 'customers' | 'shop_settings';

export interface TableChanges {
  created: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  deleted: Array<{ id: string }>;
}

export interface PullRequest {
  lastCursor: bigint;
  tables: SyncTable[];
}

export interface PullResponse {
  changes: Partial<Record<SyncTable, TableChanges>>;
  cursor: bigint;
}

export interface PushRequest {
  changes: Partial<Record<SyncTable, TableChanges>>;
  idempotencyKey: string;
}

export interface ConflictRecord {
  table: SyncTable;
  rowId: string;
  reason: string;
  serverState: Record<string, unknown> | null;
}

export interface PushResponse {
  cursor: bigint;
  conflicts: ConflictRecord[];
}
