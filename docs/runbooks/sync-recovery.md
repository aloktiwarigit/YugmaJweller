# Sync Recovery Runbook

Covers: stuck cursors, change log replay, client state reset, and >30 min lag handling.

---

## 1. Diagnosing a stuck cursor

A stuck cursor means clients' pull requests return zero changes even though server-side writes are occurring.

**Symptom:** Client has sync lag > 5 minutes with no delta received on pull.

**Step 1 — Check the cursor for the affected tenant:**
```sql
SELECT shop_id, cursor, updated_at
FROM tenant_sync_cursors
WHERE shop_id = '<SHOP_ID>';
```

**Step 2 — Check the last entry in sync_change_log (set GUC first):**
```sql
SET app.current_shop_id = '<SHOP_ID>';
SELECT id, seq, table_name, operation, created_at
FROM sync_change_log
ORDER BY seq DESC
LIMIT 10;
```

**Step 3 — Diagnose:** If `tenant_sync_cursors.cursor = N` but `sync_change_log` has rows with `seq > N`, the cursor was not advanced. This indicates a failed `advanceCursor` call (e.g., a transaction rolled back after advancing but before committing, leaving an orphaned gap).

**Fix — Advance the cursor to match the highest seq:**
```sql
-- Run as migrator role or superuser
UPDATE tenant_sync_cursors
SET cursor = (SELECT MAX(seq) FROM sync_change_log WHERE shop_id = '<SHOP_ID>'),
    updated_at = now()
WHERE shop_id = '<SHOP_ID>';
```

---

## 2. Replaying sync_change_log for a tenant

**When to use:** A client lost its local WatermelonDB database (device wipe, app reinstall).

**No server-side action required.** The client calls:
```
GET /api/v1/sync/pull?lastCursor=0&tables=products
```

The server returns all changes since the beginning (seq > 0). The client applies them to a fresh local DB. If the change log contains thousands of rows, multiple pull requests will be needed — the client should poll until `cursor` stabilizes.

**Manual replay** (for support verification):
```sql
SET app.current_shop_id = '<SHOP_ID>';
SELECT table_name, operation, row_id, seq, created_at
FROM sync_change_log
WHERE seq > 0
ORDER BY seq ASC;
```

---

## 3. Resetting a client's local WatermelonDB state

**Step 1 — Clear the stored cursor** in the shopkeeper app:
```javascript
await AsyncStorage.removeItem('@goldsmith/sync_cursor');
```

**Step 2 — Reset the local database.** In development:
```javascript
await database.write(() => database.unsafeResetDatabase());
```

In production (user-facing): uninstall and reinstall the app, or navigate to Settings → Reset Local Data (if that screen is implemented).

**Step 3 — Trigger a fresh sync.** The next `performSync()` call will pull from cursor 0, rebuilding local state from the server change log.

---

## 4. Handling a tenant with >30 min sync lag

**Step 1 — Quantify the lag:**
```sql
SELECT shop_id, cursor AS server_cursor
FROM tenant_sync_cursors
WHERE shop_id = '<SHOP_ID>';

-- Client's last cursor is in their AsyncStorage.
-- Difference = number of events to catch up on.
SET app.current_shop_id = '<SHOP_ID>';
SELECT COUNT(*) AS events_behind
FROM sync_change_log
WHERE seq > <CLIENT_LAST_CURSOR>;
```

**Step 2 — Check if the client is even online.** Sync lag when offline is expected. Check the OfflineProvider's `isOnline` state and the NetInfo status.

**Step 3 — Check for API errors.** Look at Sentry for `POST /api/v1/sync/push` or `GET /api/v1/sync/pull` errors for this tenant. Idempotency key collisions or Redis unavailability can stall pushes.

**Step 4 — Force a sync from the app** (if the client is online but not syncing):
- Navigate away from the screen and back (triggers React re-mount, restarting the OfflineProvider interval).
- Or force-kill and reopen the app.

**Step 5 — If >10,000 rows behind,** the client will pull in batches — this is by design. No server action needed. Each pull returns all rows since `lastCursor`, ordered by `seq`. The client advances its cursor per successful pull response.
