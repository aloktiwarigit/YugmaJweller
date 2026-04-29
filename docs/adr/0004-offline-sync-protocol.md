# 0004 — Offline Sync: Pull-Then-Push with Per-Aggregate Conflict Policy

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), Murat (Test Architect), Amelia (Dev)
**Consulted:** Mary (BA on shopkeeper offline reality)

## Context

PRD NFR-P11 + NFR-R11 + FR25–55 require the **shopkeeper mobile app to function offline** — invoice generation, inventory reads, customer lookups, draft editing — with sync on reconnect within 30 seconds. Tier-2 Indian network reality (Ayodhya + Hindi-belt) makes offline-first a trust signal, not just an engineering nicety.

Concurrent write scenarios must be handled:
1. Shopkeeper A writes offline + shopkeeper B writes online to the same product's stock → must not double-sell.
2. Two staff members on the same device offline then sync in sequence.
3. Draft invoices that may or may not be completed.
4. Customer-note edits across multiple devices.
5. Settings changes while offline.

## Decision

Adopt **WatermelonDB** as local DB for shopkeeper app, with a **custom pull-then-push sync protocol** over REST (not WatermelonDB's built-in sync — ours is specialized for compliance + tenant-context).

### Protocol

**Pull phase:**
- `GET /api/v1/sync/pull?cursor=<seq>&tables=<csv>&deviceId=<uuid>`
- Server returns per-table changes since `seq` (insert/update/delete rows), capped at 500 records per table, with next cursor.
- Cursor is a monotonic BIGINT per-tenant (one dedicated Postgres sequence `tenant_sync_seq_<shop_id>`; simpler than timestamps for cross-request ordering).
- Server always applies RLS; only records the device's tenant is allowed to see are returned.
- Response: `{ tables: { products: { inserts: [...], updates: [...], deletes: [ids] }, customers: {...}, ... }, nextCursor, moreAvailable }`.
- Client iterates until `moreAvailable === false`.

**Push phase:**
- `POST /api/v1/sync/push` with body `{ changes: [{ op, table, record, clientTimestamp, clientSeq }...], deviceId }` and `Idempotency-Key` header.
- Server processes changes in order per-device; each change re-runs compliance gates + tenant scoping.
- Returns per-change result: `{ applied: [...], rejected: [{ clientSeq, reason, conflictRecord }] }`.

### Conflict resolution (per-aggregate policy)

| Aggregate | Policy | Rationale |
|-----------|--------|-----------|
| **Stock movements** (inventory state) | **Pessimistic — server rejects** | If client's stock decrement would go negative (someone else already sold), server rejects; client surfaces "stock already sold, please review" UX |
| **Invoices** | **Accept all** | Every invoice has a client-generated idempotency key; duplicates dedupe; server re-runs compliance (GST, 269ST, PAN, HUID, PMLA); if newly-server-visible context changes the compliance result (e.g., PMLA cumulative now exceeds Rs 10L), invoice is marked `FLAGGED` and shopkeeper is alerted |
| **Customer notes + CRM fields** | **Last-writer-wins by server_updated_at** | Low-risk merge; rare concurrent edit |
| **Settings** | **Last-writer-wins with audit trail** | Rare; audit preserves history |
| **Custom orders** | **State-machine-governed** | Transitions require correct prior state; server rejects invalid transitions with conflict record |
| **Rate-locks** | **First-writer-wins** | Once locked, further changes by another device require explicit unlock; server rejects second lock |
| **Reviews** (shopkeeper moderation) | **Last-writer-wins with audit** | Low-risk |

### Invariants

- Server cursor is monotonic + never regresses (Postgres SEQUENCE guarantee); failover-safe.
- Client-timestamp is advisory only; server_updated_at is authoritative for LWW comparisons.
- Every stock movement goes through `SELECT ... FOR UPDATE` inside the push transaction; negative balance = reject.
- WatermelonDB schemas mirror server schemas; every record has `_raw.shop_id` baked in + validated on push.
- Compliance gates re-run server-side on every pushed invoice — client compliance is advisory UX only; server is authoritative.

### Cursor persistence

- Client stores cursor per-(shop_id, table) in AsyncStorage.
- On app launch: attempt reconnect → pull from cursor → apply diffs → then push queued outbound → then enable UI writes.
- On sign-out: clear cursor (force full re-pull on next sign-in).

## Consequences

**Positive:**
- Deterministic behaviour in most concurrent scenarios.
- Stock integrity preserved (pessimistic lock prevents overselling).
- Compliance correctness preserved (server re-runs gates on push).
- Simple mental model: pull-then-push; conflicts surface explicitly, not silently.
- Monotonic cursor + idempotency keys give replay safety.

**Negative / trade-offs:**
- Pessimistic stock lock means offline-sold item can be "lost" if another device sold it first — acceptable; UX surfaces clearly.
- LWW on notes can overwrite concurrent edits — mitigated by low frequency and explicit conflict indicator in UI when observed.
- Client complexity (WatermelonDB schema maintenance, cursor tracking, queued-action replay) is non-trivial.
- Sync endpoint is a critical path — must have strict latency + error-handling SLOs.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **WatermelonDB built-in sync** | Not tenant-aware; doesn't re-run compliance gates; less explicit conflict handling |
| **CRDT (e.g., Automerge) for all aggregates** | Overkill; stock integrity requires pessimistic locks; CRDT doesn't handle "cannot oversell" well |
| **Event-sourcing with event log sync** | Heavier architecture; full-ES journey deferred to Phase 3+ |
| **Realm Sync / Firebase Realtime DB** | Vendor lock-in; data residency concerns; doesn't integrate with our multi-tenant RLS Postgres |
| **Optimistic CRDT (last-writer-wins everywhere)** | Unacceptable for stock + invoices + compliance |
| **Last-writer-wins with timestamps** (no server auth'ing) | Client clock drift breaks invariants |

## Implementation Notes

### WatermelonDB schema per tenant

```ts
// apps/shopkeeper/src/db/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb/Schema';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'products',
      columns: [
        { name: 'shop_id', type: 'string', isIndexed: true },
        { name: 'sku', type: 'string', isIndexed: true },
        { name: 'weight_grams', type: 'string' },        // stored as decimal string
        { name: 'purity', type: 'string' },
        { name: 'huid', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'server_updated_at', type: 'number' },
        { name: 'server_seq', type: 'number' },
        { name: 'pending_sync', type: 'boolean' },
        // ... other fields
      ],
    }),
    // ... other tables
  ],
});
```

### Pull handler (server)

```ts
// apps/api/src/modules/sync/sync.controller.ts
@Get('pull')
async pull(@TenantContextDec() ctx: TenantContext, @Query() q: PullQuery) {
  const cursor = BigInt(q.cursor ?? '0');
  const tables = q.tables.split(',');
  return this.syncService.pull(ctx, cursor, tables);
}

// sync.service.ts
async pull(ctx: TenantContext, cursor: bigint, tables: string[]): Promise<PullResponse> {
  return withTenantTx(ctx, async (tx) => {
    const results: Record<string, TableDiff> = {};
    let maxSeq = cursor;
    for (const table of tables) {
      const diff = await this.repo.diffSince(tx, table, cursor, 500);
      results[table] = diff;
      maxSeq = diff.maxSeq > maxSeq ? diff.maxSeq : maxSeq;
    }
    return { tables: results, nextCursor: maxSeq.toString(), moreAvailable: /* compute */ false };
  });
}
```

### Push handler (server)

```ts
@Post('push')
@UseGuards(IdempotencyKeyGuard)
async push(@TenantContextDec() ctx: TenantContext, @Body() body: PushBody) {
  const applied: any[] = [];
  const rejected: any[] = [];
  for (const change of body.changes) {
    try {
      const result = await this.routeByTable(ctx, change);
      applied.push(result);
    } catch (err) {
      if (err instanceof SyncConflictError) {
        rejected.push({ clientSeq: change.clientSeq, reason: err.reason, conflictRecord: err.serverRecord });
      } else {
        throw err;
      }
    }
  }
  return { applied, rejected };
}
```

## Revisit triggers

- WatermelonDB maintenance burden unacceptable → evaluate alternatives (SQLite + custom sync; Realm).
- Sync latency exceeds NFR-P11 (500 ms local ops) → profile + optimize.
- Cursor fan-out contention at high tenant scale → shift to per-table sequences or PostgreSQL logical replication.

## References

- PRD FR25–55 (inventory, billing, CRM), NFR-P11 (offline ops), NFR-R11 (runbook)
- Architecture §Core Decisions A6, §Patterns Sync protocol
- WatermelonDB docs: https://nozbe.github.io/WatermelonDB/
