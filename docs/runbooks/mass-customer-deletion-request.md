# Runbook — DPDPA Customer Deletion Requests

**Story:** 6.8
**Owner:** Platform Operations
**Last reviewed:** 2026-04-26

This runbook covers operational handling of customer-data deletion requests under
the Digital Personal Data Protection Act, 2023 (DPDPA), including the resolution
of conflicts with PMLA's 5-year retention requirement.

---

## TL;DR

| Action | When | Who |
|--------|------|-----|
| Soft-delete customer (PII scrub) | On verified request | OWNER (shop_admin) via shopkeeper app |
| Hard-delete row (FK detach + DELETE) | 30 days after soft-delete | BullMQ worker (auto) |
| Sweep missed jobs | Every day at 02:00 IST | Cron (auto) |
| Manual hard-delete (worker stuck) | Operator intervention | Platform admin |

---

## 1. Verifying that a deletion request is genuine

DPDPA gives the data principal (the customer) the right to erasure. A deletion
request can arrive through three channels:

1. **In-shop verbal** — customer visits the jeweller and asks for their data to be removed.
2. **Phone/WhatsApp** — customer contacts the jeweller remotely.
3. **Customer self-service app** — Epic 7. (Endpoint exists today as a 501 stub.)

Before the OWNER fires the deletion in the shopkeeper app, they should verify the
identity of the requester:

- **In-shop:** verify the requester's phone matches the registered phone via OTP
  on a different device, or check government-issued ID (Aadhaar/PAN/voter ID).
- **Phone/WhatsApp:** call back on the registered phone and re-confirm.
  *Never* accept an unsolicited message from an unknown number as authoritative.
- **Self-service (Epic 7):** identity is established by Firebase phone-OTP flow
  inside the customer app. No additional gate.

The shopkeeper UI requires the OWNER to type the customer's full name back as
written confirmation; this catches fat-finger mistakes (deleting the wrong row)
but is not a security primitive.

If the requester cannot be authenticated, **do not delete**. Log the attempt in
the shop's notebook for audit and decline.

---

## 2. Conflict: deletion vs active layaway / open invoice

A deletion request is **blocked** while there are open `DRAFT` invoices for the
customer. The API returns `crm.deletion.open_invoices` (HTTP 422) and the
shopkeeper UI shows a Hindi error.

Resolution:
1. Open the customer's invoice list and find rows with status = `DRAFT`.
2. For each DRAFT invoice:
   - **Customer wants to abandon the layaway:** void the invoice (Story 5.11).
     Any partial payments must be refunded out-of-band; the platform records
     this as a credit note.
   - **Customer wants to complete the purchase first:** issue the invoice
     (status → `ISSUED`) before processing the deletion.
3. Once no DRAFT invoices remain, the OWNER can re-fire the deletion.

`ISSUED` and `VOIDED` invoices do **not** block deletion — they are kept for
PMLA/tax retention with `customer_id = NULL` after hard-delete.

---

## 3. What is retained vs what is removed

### Removed at soft-delete (day 0, immediate)

- `customers.name` → `'Deleted Customer'`
- `customers.email`, `address_line1/2`, `city`, `state`, `pincode`, `dob_year` → `NULL`
- `customers.phone` → SHA-256(`shop_id:phone`) hash (preserves uniqueness, no plaintext)
- `customers.pan_ciphertext`, `pan_key_id` → `NULL` (PAN ciphertext destroyed; KMS key continues to exist for other customers)
- `customers.notes`, `viewing_consent`, `pii_redacted_at` updated
- `customer_notes.body` → `'[redacted by deletion request]'` (notes table from Story 6.5; guarded with `to_regclass`)
- `family_members` rows → DELETE (both directions)
- `customer_balances` → DELETE (Story 6.3)
- `customer_occasions` → DELETE (Story 6.6)

### Retained at soft-delete

- `customers` row itself (will be removed on day 30)
- All `invoices` rows for this customer (untouched)
- All `invoice_items`, `payments`, `urd_purchases`, `pmla_aggregates`
- All `audit_events` for this customer (immutable per NFR-S9)

### Removed at hard-delete (day 30)

- `customers` row → DELETE (FK to invoices already detached)

### Retained at hard-delete

- `invoices` rows: `customer_id` → NULL, `customer_name` → `'Deleted Customer'`,
  `customer_phone` → NULL. Tax-relevant columns (`pan_ciphertext`, `huid`,
  `total_paise`, `gst_metal_paise`, `gst_making_paise`, `igst_*`, `cgst_*`,
  `sgst_*`) are **untouched**.
- `audit_events` rows: never touched. Immutable.
- `pmla_aggregates` rows: never touched. PMLA cumulative cash retention.

This split satisfies DPDPA's right to erasure for personal data while preserving
PMLA/CBDT/GST records for the statutory 5-year retention period.

---

## 4. Responding to a regulator audit on deletion compliance

When a regulator (DPDPA Authority, RBI, ED-FIU) requests evidence that a
specific deletion was honoured, gather the following from the audit trail:

```sql
SELECT created_at, action, actor_user_id, after
FROM audit_events
WHERE shop_id = $1
  AND subject_type = 'customer'
  AND subject_id = $2
  AND action IN (
    'CRM_CUSTOMER_DELETION_REQUESTED',
    'CRM_CUSTOMER_SOFT_DELETED',
    'CRM_CUSTOMER_HARD_DELETED'
  )
ORDER BY created_at;
```

The expected timeline:

1. `CRM_CUSTOMER_DELETION_REQUESTED` — when the OWNER triggered it.
   `after.requestedBy` is `'customer'` or `'owner'`.
2. `CRM_CUSTOMER_SOFT_DELETED` — same instant. `after.piiScrubbed = true`,
   `after.hardDeleteScheduledAt` set to now+30d.
3. `CRM_CUSTOMER_HARD_DELETED` — ~30 days later. `after.hardDeletedAt` set.

If the row is found in `customers` with `deleted_at IS NOT NULL`, soft-delete
was successful and PII has already been removed (verifiable by inspecting the
columns — `name = 'Deleted Customer'`, `phone` is a 64-char hex SHA-256, etc.).

If the row is **not** found in `customers` but `audit_events` contain the three
actions above, hard-delete was successful.

If a regulator demands the **content** of the deleted PII, the platform cannot
provide it — that is exactly the DPDPA promise. Provide only the audit trail
and the residual non-PII columns on retained invoices (HUID, total_paise, etc.).

---

## 5. Handling a tenant-wide deletion sweep (shop closing)

When a jeweller stops using the platform and asks for all their customer data
to be deleted, the shop owner can request a tenant-level deletion via support:

1. **Validate the request** — the shop owner (verified `shop_admin` user with
   matching Firebase phone OTP) must email or formally request via WhatsApp
   from their registered phone.
2. **Confirm DRAFT-invoice state** — check that no `DRAFT` invoices exist for
   that tenant. If any exist, force-issue or force-void via platform admin
   tooling.
3. **Bulk soft-delete** (platform admin operation, not currently exposed via UI):
   ```sql
   -- Run inside a single transaction, set tenant context first.
   SET LOCAL app.current_shop_id = '<shop_uuid>';
   SET LOCAL ROLE app_user;
   UPDATE customers SET
     name = 'Deleted Customer', email = NULL, address_line1 = NULL,
     address_line2 = NULL, city = NULL, state = NULL, pincode = NULL,
     dob_year = NULL,
     phone = encode(digest(shop_id::text || ':' || phone, 'sha256'), 'hex'),
     pan_ciphertext = NULL, pan_key_id = NULL, viewing_consent = false,
     notes = NULL,
     deleted_at = now(),
     hard_delete_scheduled_at = now() + interval '30 days',
     pii_redacted_at = now(),
     deletion_requested_by = 'owner',
     updated_at = now()
   WHERE shop_id = '<shop_uuid>'
     AND deleted_at IS NULL;
   ```
4. **Audit** — write one `CRM_CUSTOMER_DELETION_REQUESTED` +
   `CRM_CUSTOMER_SOFT_DELETED` per row, or one bulk `TENANT_DELETION_SWEEP`
   audit event with the affected count and reason.
5. **Daily sweep** picks up these rows automatically at day-30 and hard-deletes
   them along with the rest of the queue. No further intervention needed.
6. **Tenant termination** — once all customers are hard-deleted, the shop's
   own row in `shops` can be marked `status = 'TERMINATED'`. Retain the shop
   row + audit_events for the platform's own audit trail.

---

## 6. Manual hard-delete (worker is stuck)

If the BullMQ `dpdpa-hard-delete` queue is failing to process and the daily
sweep is also unable to drain (e.g., database migration in progress, worker
crashing), a platform admin can manually fire a hard-delete:

```bash
# Replace <shop_uuid> and <customer_uuid>; runs as app_user with tenant ctx.
psql "$DATABASE_URL" <<SQL
BEGIN;
SET LOCAL ROLE app_user;
SET LOCAL app.current_shop_id = '<shop_uuid>';

-- Verify eligibility
SELECT id, deleted_at, hard_delete_scheduled_at
FROM customers
WHERE id = '<customer_uuid>';

-- If deleted_at IS NOT NULL AND hard_delete_scheduled_at <= now(), proceed:
DELETE FROM family_members
  WHERE customer_id = '<customer_uuid>'
     OR related_customer_id = '<customer_uuid>';
-- Repeat for customer_notes, customer_occasions, customer_balances if those tables exist.
UPDATE invoices SET customer_id = NULL, customer_name = 'Deleted Customer', customer_phone = NULL
  WHERE customer_id = '<customer_uuid>';
DELETE FROM customers WHERE id = '<customer_uuid>';

-- Audit (replace <user_uuid> with the operator's user id)
INSERT INTO audit_events (shop_id, actor_user_id, action, subject_type, subject_id, after)
VALUES (
  current_setting('app.current_shop_id')::uuid,
  '<operator_user_uuid>',
  'CRM_CUSTOMER_HARD_DELETED',
  'customer',
  '<customer_uuid>',
  jsonb_build_object('hardDeletedAt', now()::text, 'manual', true)
);
COMMIT;
SQL
```

Always paste the operator's user id (not a service account) so the audit trail
identifies who fired the manual deletion.

---

## 7. Recovery: PII restore after deletion

**Not possible.** The service's `restoreDeletion` endpoint always returns
HTTP 422 `crm.deletion.pii_already_scrubbed` because:

1. Plaintext PII is overwritten in place at soft-delete time.
2. PAN ciphertext is set to NULL — there is no encrypted archive.
3. Phone is replaced with a hash; the original is unrecoverable.

If a customer claims a deletion was made in error and they want their data
back, the only path is **re-registration** — they walk in or call the shop and
the OWNER creates a new customer record from scratch.

This is intentional. DPDPA §13(c) requires "erasure" to be irrecoverable; a
restore-from-archive workflow would defeat the legal promise.

---

## 8. Observability

The processor + sweep emit logs prefixed with `dpdpa-hard-delete:` and
`dpdpa-sweep:`. To find pending soft-deletes by tenant:

```sql
SELECT shop_id, COUNT(*) AS pending,
       MIN(hard_delete_scheduled_at) AS earliest_scheduled,
       MAX(hard_delete_scheduled_at) AS latest_scheduled
FROM customers
WHERE deleted_at IS NOT NULL
GROUP BY shop_id
ORDER BY pending DESC;
```

If a row's `hard_delete_scheduled_at` is more than 24 hours in the past and
the row still exists, the sweep is failing — investigate the worker logs
before manually intervening.
