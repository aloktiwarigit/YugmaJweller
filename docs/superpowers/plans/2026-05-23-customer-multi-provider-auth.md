# Customer Multi-Provider Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Sign-In and Email/Password auth to the customer apps (mobile + web), with unified identity — same DB customer record regardless of auth provider.

**Architecture:** Explicit session endpoint (`POST /api/v1/customer/auth/session`) called once after Firebase sign-in; `CustomerAuthGuard` extended to look up by `firebase_uid` first; lazy migration writes `firebase_uid` for existing phone-OTP customers on first request. Migration 0076 adds `firebase_uid`, `display_name`, `auth_provider` columns and makes `phone` nullable (OAuth users have no phone number).

**Tech Stack:** NestJS (backend), React Native / Expo (customer-mobile), Next.js 14 (customer-web), Firebase Auth SDK (multi-provider), `@react-native-google-signin/google-signin` ^13.0.0, Drizzle ORM, PostgreSQL 15.

**Class:** A — auth + identity schema migration. Full ceremony applies.

**Design spec:** `docs/superpowers/specs/2026-05-23-customer-multi-provider-auth-design.md`

---

## File Map

| File | Change |
|------|--------|
| `packages/db/src/migrations/0076_customers_auth_identity.sql` | New — phone nullable + 3 new columns + 2 indexes |
| `packages/db/src/schema/customers.ts` | Add `firebaseUid`, `displayName`, `authProvider` columns; make `phone` nullable |
| `packages/audit/src/audit-actions.ts` | Add 3 customer auth events |
| `apps/api/src/modules/customer/customer-session.service.ts` | New — 4-path unified customer lookup |
| `apps/api/src/modules/customer/customer-session.controller.ts` | New — `POST auth/session`, `PATCH profile/phone` |
| `apps/api/src/modules/customer/customer-auth.guard.ts` | Extend — firebase_uid lookup + lazy migration + extend `CustomerContext` |
| `apps/api/src/modules/customer/customer.module.ts` | Wire new service + controller |
| `apps/api/src/modules/customer/__tests__/customer-session.service.spec.ts` | New — TDD tests for all 4 lookup paths |
| `apps/api/src/modules/customer/__tests__/customer-auth.guard.spec.ts` | Extend — new guard paths |
| `apps/customer-mobile/src/lib/google-sign-in.ts` | New — native Google Sign-In helper |
| `apps/customer-mobile/src/stores/customerSessionStore.ts` | `phoneE164: string \| null` |
| `apps/customer-mobile/src/providers/CustomerAuthProvider.tsx` | Call session endpoint; store DB UUID |
| `apps/customer-mobile/app/(auth)/welcome.tsx` | Three-card layout (phone / Google / email) |
| `apps/customer-mobile/app/(auth)/email-auth.tsx` | New — email sign-in + create-account screen |
| `apps/customer-mobile/app.config.ts` | Add `@react-native-google-signin/google-signin` plugin |
| `apps/customer-mobile/package.json` | Add `@react-native-google-signin/google-signin` ^13.0.0 |
| `apps/customer-web/src/auth/firebase-customer.ts` | Add `signInWithGoogle`, `signInWithEmail`, `createEmailAccount`, `sendPasswordReset` |
| `apps/customer-web/app/sign-in/sign-in-page-client.tsx` | Three-tab layout (phone / Google / email); call session endpoint |
| `apps/customer-web/app/profile/page.tsx` (or its client) | Add "phone" nudge when `phoneE164` is null |

---

## Task 0: Firebase Setup (manual — do first, unblocks all other tasks)

**Files:** None (Firebase console + MCP tool actions)

- [ ] **Step 1: Verify current Firebase project state**

  In the Claude session with Firebase MCP access, run:
  ```
  mcp__plugin_firebase_firebase__firebase_get_project { "projectId": "goldsmith-dev" }
  ```
  Confirm the project is accessible and note the current auth providers.

- [ ] **Step 2: Enable Email/Password provider**

  In Firebase Console → Authentication → Sign-in method → Email/Password → Enable.
  
  Or via MCP:
  ```
  mcp__plugin_firebase_firebase__firebase_update_environment {
    "projectId": "goldsmith-dev",
    "feature": "auth",
    "config": { "providers": ["phone", "google", "email"] }
  }
  ```

- [ ] **Step 3: Enable Google Sign-In provider**

  In Firebase Console → Authentication → Sign-in method → Google → Enable.
  Set support email to `aloktiwari49@gmail.com`.

- [ ] **Step 4: Configure OAuth consent screen**

  Google Cloud Console → APIs & Services → OAuth consent screen:
  - App name: `Goldsmith`
  - User support email: `aloktiwari49@gmail.com`
  - Authorized domains: add customer-web production domain when known
  - Scopes: keep default (`openid`, `profile`, `email` — no extra)

- [ ] **Step 5: Add web redirect URI**

  Firebase Console → Authentication → Google → Web SDK configuration → Authorized redirect URIs:
  - `http://localhost:3000`

- [ ] **Step 6: Verify Type-3 Web OAuth client ID exists in google-services.json**

  Check `apps/customer-mobile/google-services.json` for a client with `client_type: 3`.
  Expected: `528920018833-b2ua9n337u2blajt89t7f5qo5nj0d2rh.apps.googleusercontent.com`

  ```bash
  grep -A2 '"client_type": 3' apps/customer-mobile/google-services.json
  ```
  Expected output: `"client_id": "528920018833-b2ua9n337u2blajt89t7f5qo5nj0d2rh.apps.googleusercontent.com"`

- [ ] **Step 7: No google-services.json re-download needed**

  Enabling auth providers does NOT invalidate the existing file. Skip this step — the Type-1 Android + Type-3 Web OAuth client IDs are already present.

---

## Task 1: AuditAction enum additions

**Files:**
- Modify: `packages/audit/src/audit-actions.ts`

- [ ] **Step 1: Write the failing test**

  Create file: `packages/audit/src/__tests__/audit-actions.spec.ts`
  ```typescript
  import { AuditAction } from '../audit-actions';

  describe('AuditAction — customer auth events', () => {
    it('has CUSTOMER_SESSION_CREATED', () => {
      expect(AuditAction.CUSTOMER_SESSION_CREATED).toBe('CUSTOMER_SESSION_CREATED');
    });
    it('has CUSTOMER_AUTH_PROVIDER_LINKED', () => {
      expect(AuditAction.CUSTOMER_AUTH_PROVIDER_LINKED).toBe('CUSTOMER_AUTH_PROVIDER_LINKED');
    });
    it('has CUSTOMER_AUTH_FAILED', () => {
      expect(AuditAction.CUSTOMER_AUTH_FAILED).toBe('CUSTOMER_AUTH_FAILED');
    });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd apps/api && pnpm vitest run packages/audit/src/__tests__/audit-actions.spec.ts
  ```
  Expected: FAIL — `AuditAction.CUSTOMER_SESSION_CREATED is undefined`

- [ ] **Step 3: Add the three new enum values**

  In `packages/audit/src/audit-actions.ts`, after the last `CUSTOMER_*` line (line 99, after `CUSTOMER_TRY_AT_HOME_REQUESTED`):
  ```typescript
    CUSTOMER_SESSION_CREATED         = 'CUSTOMER_SESSION_CREATED',
    CUSTOMER_AUTH_PROVIDER_LINKED    = 'CUSTOMER_AUTH_PROVIDER_LINKED',
    CUSTOMER_AUTH_FAILED             = 'CUSTOMER_AUTH_FAILED',
  ```

- [ ] **Step 4: Run test to confirm it passes**

  ```bash
  cd apps/api && pnpm vitest run packages/audit/src/__tests__/audit-actions.spec.ts
  ```
  Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add packages/audit/src/audit-actions.ts packages/audit/src/__tests__/audit-actions.spec.ts
  git commit -m "feat(audit): add CUSTOMER_SESSION_CREATED/AUTH_PROVIDER_LINKED/AUTH_FAILED events"
  ```

---

## Task 2: DB Migration 0076

**Files:**
- Create: `packages/db/src/migrations/0076_customers_auth_identity.sql`

**Key facts:**
- `customers.email TEXT` **already exists** (migration 0028). Do NOT add it again.
- `customers.phone TEXT NOT NULL` must become nullable (OAuth users have no phone).
- PostgreSQL partial unique index with `WHERE firebase_uid IS NOT NULL` allows multiple NULL `firebase_uid` values (existing customers before lazy migration).
- Existing `idx_customers_shop_phone` unique index remains. NULL phone values don't conflict in PostgreSQL unique indexes.

- [ ] **Step 1: Write the migration file**

  Create `packages/db/src/migrations/0076_customers_auth_identity.sql`:
  ```sql
  -- Migration 0076: Multi-provider auth identity
  -- Makes phone nullable (OAuth users have no phone number at sign-up).
  -- Adds firebase_uid, display_name, auth_provider.
  -- email column already exists (migration 0028) — not re-added here.

  ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

  ALTER TABLE customers
    ADD COLUMN firebase_uid  TEXT,
    ADD COLUMN display_name  TEXT,
    ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'phone'
      CHECK (auth_provider IN ('phone', 'google', 'email_password'));

  -- Partial unique index: two customers in the same shop cannot share a firebase_uid,
  -- but multiple NULL values are allowed (existing customers before lazy migration).
  CREATE UNIQUE INDEX customers_shop_firebase_uid_idx
    ON customers (shop_id, firebase_uid)
    WHERE firebase_uid IS NOT NULL;

  -- Case-insensitive email lookup index (email already exists, adding lookup index).
  CREATE INDEX customers_shop_email_idx
    ON customers (shop_id, lower(email))
    WHERE email IS NOT NULL;
  ```

- [ ] **Step 2: Verify migration file is consistent with existing schema**

  Check that `email` is not already in this migration, and confirm `0075` is the last migration:
  ```bash
  ls packages/db/src/migrations/ | sort | tail -5
  ```
  Expected: last file is `0075_*.sql`

  ```bash
  grep "ADD COLUMN email" packages/db/src/migrations/0076_customers_auth_identity.sql
  ```
  Expected: no output (email column not re-added)

- [ ] **Step 3: Commit**

  ```bash
  git add packages/db/src/migrations/0076_customers_auth_identity.sql
  git commit -m "feat(db): migration 0076 — customer multi-provider auth identity columns"
  ```

---

## Task 3: Drizzle schema update

**Files:**
- Modify: `packages/db/src/schema/customers.ts`

- [ ] **Step 1: Add the three new columns and make phone nullable**

  In `packages/db/src/schema/customers.ts`, change:
  ```typescript
  export const customers = tenantScopedTable('customers', {
    id:              uuid('id').primaryKey().defaultRandom(),
    phone:           text('phone').notNull(),
    name:            text('name').notNull(),
    email:           text('email'),
  ```
  To:
  ```typescript
  export const customers = tenantScopedTable('customers', {
    id:              uuid('id').primaryKey().defaultRandom(),
    phone:           text('phone'),
    name:            text('name').notNull(),
    email:           text('email'),
    firebaseUid:     text('firebase_uid'),
    displayName:     text('display_name'),
    authProvider:    text('auth_provider').$type<'phone' | 'google' | 'email_password'>().notNull().default('phone'),
  ```
  
  Leave all other columns unchanged.

- [ ] **Step 2: Run typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 errors (or only pre-existing errors unrelated to this change)

- [ ] **Step 3: Commit**

  ```bash
  git add packages/db/src/schema/customers.ts
  git commit -m "feat(db): drizzle schema — add firebaseUid/displayName/authProvider, phone nullable"
  ```

---

## Task 4: CustomerSessionService (TDD — 4 lookup paths)

**Files:**
- Create: `apps/api/src/modules/customer/customer-session.service.ts`
- Create: `apps/api/src/modules/customer/__tests__/customer-session.service.spec.ts`

**Key design:** All four paths run inside a single `withShopTx` transaction with `FOR UPDATE`. Audit rows are inserted directly via `tx.query` (the session endpoint uses `@SkipTenant()` so `auditLog()` / `withTenantTx` cannot be used — they require `tenantContext.current()`).

```
Path 1 — firebase_uid hit:   SELECT WHERE firebase_uid = $uid FOR UPDATE → return existing
Path 2 — phone link:         SELECT WHERE phone = $phone FOR UPDATE → UPDATE SET firebase_uid → return linked
Path 3 — email link:         SELECT WHERE lower(email) = lower($email) FOR UPDATE → UPDATE SET firebase_uid → return linked
Path 4 — new customer:       INSERT (firebase_uid, auth_provider, …) ON CONFLICT DO NOTHING → return {isNewUser: true}
```

- [ ] **Step 1: Write the failing tests**

  Create `apps/api/src/modules/customer/__tests__/customer-session.service.spec.ts`:
  ```typescript
  import { CustomerSessionService, type DecodedFirebaseToken } from '../customer-session.service';
  import type { Pool, PoolClient } from 'pg';

  function makePool(rows: Record<string, unknown>[][]): Pool {
    let callCount = 0;
    const client: Partial<PoolClient> = {
      query: jest.fn().mockImplementation(() => {
        const result = rows[callCount] ?? [];
        callCount++;
        return Promise.resolve({ rows: result });
      }),
      release: jest.fn(),
    };
    return {
      connect: jest.fn().mockResolvedValue(client),
      query: jest.fn(),
    } as unknown as Pool;
  }

  const SHOP_ID  = '11111111-1111-4111-8111-111111111111';
  const TOKEN_BASE: DecodedFirebaseToken = {
    uid: 'firebase-uid-abc',
    phone_number: undefined,
    email: undefined,
    name: undefined,
  };

  describe('CustomerSessionService.findOrCreateCustomerByFirebaseToken', () => {
    let svc: CustomerSessionService;

    beforeEach(() => {
      svc = new CustomerSessionService();
    });

    it('Path 1 — returns existing customer when firebase_uid matches', async () => {
      const existingRow = { id: 'db-uuid-1', name: 'Priya', phone: '+919876543210', auth_provider: 'phone' };
      // withShopTx does: BEGIN, SET app.current_shop_id, then our queries, then COMMIT
      // We provide rows per query in order: shop check, GUC set, firebase_uid SELECT
      const pool = makePool([
        [{ status: 'ACTIVE' }],      // assertActiveShop
        [],                            // SET app.current_shop_id (no rows)
        [existingRow],                 // SELECT WHERE firebase_uid = $uid
      ]);
      const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, { ...TOKEN_BASE });
      expect(result.customerId).toBe('db-uuid-1');
      expect(result.isNewUser).toBe(false);
    });

    it('Path 2 — links existing phone customer when firebase_uid not found but phone matches', async () => {
      const phoneRow = { id: 'db-uuid-2', name: 'Rahul', phone: '+919876543210', auth_provider: 'phone' };
      const pool = makePool([
        [{ status: 'ACTIVE' }],        // assertActiveShop
        [],                             // SET app.current_shop_id
        [],                             // SELECT WHERE firebase_uid = $uid → not found
        [phoneRow],                     // SELECT WHERE phone = $phone FOR UPDATE → found
        [{ id: 'db-uuid-2' }],          // UPDATE SET firebase_uid RETURNING id
        [],                             // audit INSERT
      ]);
      const token: DecodedFirebaseToken = { ...TOKEN_BASE, phone_number: '+919876543210' };
      const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, token);
      expect(result.customerId).toBe('db-uuid-2');
      expect(result.isNewUser).toBe(false);
    });

    it('Path 3 — links existing email customer when firebase_uid and phone not found but email matches', async () => {
      const emailRow = { id: 'db-uuid-3', name: 'Ananya', phone: null, auth_provider: 'email_password' };
      const pool = makePool([
        [{ status: 'ACTIVE' }],        // assertActiveShop
        [],                             // SET app.current_shop_id
        [],                             // SELECT WHERE firebase_uid = $uid → not found
        [],                             // SELECT WHERE phone = $phone → not found (no phone in token)
        [emailRow],                     // SELECT WHERE lower(email) = lower($email) → found
        [{ id: 'db-uuid-3' }],          // UPDATE SET firebase_uid RETURNING id
        [],                             // audit INSERT
      ]);
      const token: DecodedFirebaseToken = { ...TOKEN_BASE, email: 'ananya@example.com', name: 'Ananya' };
      const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, token);
      expect(result.customerId).toBe('db-uuid-3');
      expect(result.isNewUser).toBe(false);
    });

    it('Path 4 — creates new customer when no existing record matches', async () => {
      const newRow = { id: 'db-uuid-4' };
      const pool = makePool([
        [{ status: 'ACTIVE' }],        // assertActiveShop
        [],                             // SET app.current_shop_id
        [],                             // SELECT WHERE firebase_uid = $uid → not found
        [],                             // no phone in token — skip
        [],                             // no email in token — skip
        [newRow],                       // INSERT RETURNING id
        [],                             // audit INSERT
      ]);
      const result = await svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, { ...TOKEN_BASE });
      expect(result.customerId).toBe('db-uuid-4');
      expect(result.isNewUser).toBe(true);
    });

    it('Path 4 — throws when INSERT returns no rows (concurrent race: DO NOTHING fired)', async () => {
      const pool = makePool([
        [{ status: 'ACTIVE' }],
        [],                             // SET app.current_shop_id
        [],                             // firebase_uid not found
        [],                             // no phone
        [],                             // no email
        [],                             // INSERT returns no rows (DO NOTHING raced)
      ]);
      await expect(
        svc.findOrCreateCustomerByFirebaseToken(pool, SHOP_ID, { ...TOKEN_BASE }),
      ).rejects.toMatchObject({ response: { code: 'customer.race_condition' } });
    });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd apps/api && pnpm vitest run src/modules/customer/__tests__/customer-session.service.spec.ts
  ```
  Expected: FAIL — `CustomerSessionService is not defined`

- [ ] **Step 3: Implement CustomerSessionService**

  Create `apps/api/src/modules/customer/customer-session.service.ts`:
  ```typescript
  import { Injectable, UnauthorizedException } from '@nestjs/common';
  import type { Pool } from 'pg';
  import { withShopTx } from '@goldsmith/db';
  import { AuditAction } from '@goldsmith/audit';
  import { CUSTOMER_SELF_REGISTRATION_ACTOR_ID } from './customer-auth.guard';

  export interface DecodedFirebaseToken {
    uid:           string;
    phone_number?: string;
    email?:        string;
    name?:         string;
  }

  export interface CustomerSessionResult {
    customerId:   string;
    name:         string;
    phoneE164:    string | null;
    email:        string | null;
    authProvider: 'phone' | 'google' | 'email_password';
    isNewUser:    boolean;
  }

  @Injectable()
  export class CustomerSessionService {
    // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- session endpoint validates shopId before calling this
    async findOrCreateCustomerByFirebaseToken(
      pool:    Pool,
      shopId:  string,
      decoded: DecodedFirebaseToken,
    ): Promise<CustomerSessionResult> {
      return withShopTx(pool, shopId, async (tx) => {
        const { uid, phone_number: phone, email, name } = decoded;

        // Path 1 — existing customer with this firebase_uid
        const byUid = await tx.query<{
          id: string; name: string; phone: string | null; email: string | null; auth_provider: string;
        }>(
          `SELECT id, name, phone, email, auth_provider
           FROM customers
           WHERE shop_id = $1 AND firebase_uid = $2 AND deleted_at IS NULL
           FOR UPDATE`,
          [shopId, uid],
        );
        if (byUid.rows[0]) {
          const r = byUid.rows[0];
          return {
            customerId:   r.id,
            name:         r.name,
            phoneE164:    r.phone,
            email:        r.email,
            authProvider: r.auth_provider as CustomerSessionResult['authProvider'],
            isNewUser:    false,
          };
        }

        // Path 2 — existing phone customer (link firebase_uid)
        if (phone) {
          const byPhone = await tx.query<{ id: string; name: string; email: string | null }>(
            `SELECT id, name, email FROM customers
             WHERE shop_id = $1 AND phone = $2 AND deleted_at IS NULL
             FOR UPDATE`,
            [shopId, phone],
          );
          if (byPhone.rows[0]) {
            const r = byPhone.rows[0];
            await tx.query(
              `UPDATE customers SET firebase_uid = $1, auth_provider = 'phone' WHERE id = $2`,
              [uid, r.id],
            );
            await tx.query(
              `INSERT INTO audit_events (shop_id, action, subject_type, subject_id, metadata)
               VALUES ($1, $2, 'customer', $3, $4::jsonb)`,
              [shopId, AuditAction.CUSTOMER_AUTH_PROVIDER_LINKED, r.id,
               JSON.stringify({ provider: 'phone', firebaseUid: uid })],
            );
            return {
              customerId:   r.id,
              name:         r.name,
              phoneE164:    phone,
              email:        r.email,
              authProvider: 'phone',
              isNewUser:    false,
            };
          }
        }

        // Path 3 — existing email customer (link firebase_uid)
        if (email) {
          const byEmail = await tx.query<{ id: string; name: string; phone: string | null; auth_provider: string }>(
            `SELECT id, name, phone, auth_provider FROM customers
             WHERE shop_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL
             FOR UPDATE`,
            [shopId, email],
          );
          if (byEmail.rows[0]) {
            const r = byEmail.rows[0];
            const provider = r.auth_provider as CustomerSessionResult['authProvider'];
            await tx.query(
              `UPDATE customers SET firebase_uid = $1 WHERE id = $2`,
              [uid, r.id],
            );
            await tx.query(
              `INSERT INTO audit_events (shop_id, action, subject_type, subject_id, metadata)
               VALUES ($1, $2, 'customer', $3, $4::jsonb)`,
              [shopId, AuditAction.CUSTOMER_AUTH_PROVIDER_LINKED, r.id,
               JSON.stringify({ provider, firebaseUid: uid })],
            );
            return {
              customerId:   r.id,
              name:         r.name,
              phoneE164:    r.phone,
              email,
              authProvider: provider,
              isNewUser:    false,
            };
          }
        }

        // Path 4 — new customer
        const authProvider: CustomerSessionResult['authProvider'] =
          phone ? 'phone' : email ? 'email_password' : 'google';
        const displayName = name ?? (email ? email.split('@')[0] : (phone ? `Mobile customer ${phone.slice(-4)}` : 'Customer'));

        const inserted = await tx.query<{ id: string }>(
          `INSERT INTO customers
             (shop_id, phone, email, name, display_name, firebase_uid, auth_provider, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (shop_id, firebase_uid) WHERE firebase_uid IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [shopId, phone ?? null, email ?? null, displayName, displayName, uid, authProvider, CUSTOMER_SELF_REGISTRATION_ACTOR_ID],
        );

        if (!inserted.rows[0]) {
          // Concurrent request raced and won — caller should retry
          throw new UnauthorizedException({ code: 'customer.race_condition' });
        }

        await tx.query(
          `INSERT INTO audit_events (shop_id, action, subject_type, subject_id, metadata)
           VALUES ($1, $2, 'customer', $3, $4::jsonb)`,
          [shopId, AuditAction.CUSTOMER_SESSION_CREATED, inserted.rows[0].id,
           JSON.stringify({ provider: authProvider, isNewUser: true, firebaseUid: uid })],
        );

        return {
          customerId:   inserted.rows[0].id,
          name:         displayName,
          phoneE164:    phone ?? null,
          email:        email ?? null,
          authProvider,
          isNewUser:    true,
        };
      });
    }
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd apps/api && pnpm vitest run src/modules/customer/__tests__/customer-session.service.spec.ts
  ```
  Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/modules/customer/customer-session.service.ts \
          apps/api/src/modules/customer/__tests__/customer-session.service.spec.ts
  git commit -m "feat(customer): CustomerSessionService — 4-path firebase_uid lookup/create (TDD)"
  ```

---

## Task 5: CustomerSessionController

**Files:**
- Create: `apps/api/src/modules/customer/customer-session.controller.ts`

The controller:
- Has `@SkipAuth()` + `@SkipTenant()` on the session endpoint (reads `x-tenant-id` manually)
- Manually calls `admin.verifyIdToken(token, checkRevoked: true)` — stronger check than guard's per-request validation
- Delegates to `CustomerSessionService.findOrCreateCustomerByFirebaseToken`
- Returns `{ customer: CustomerSessionDto, isNewUser: boolean, authProvider }`

- [ ] **Step 1: Write the failing test**

  Create `apps/api/src/modules/customer/__tests__/customer-session.controller.spec.ts`:
  ```typescript
  import { Test, type TestingModule } from '@nestjs/testing';
  import { CustomerSessionController } from '../customer-session.controller';
  import { CustomerSessionService } from '../customer-session.service';
  import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
  import { UnauthorizedException } from '@nestjs/common';

  const mockVerifyIdToken = jest.fn();
  const mockFirebase = { admin: () => ({ auth: () => ({ verifyIdToken: mockVerifyIdToken }) }) };
  const mockPool = {};
  const mockService = { findOrCreateCustomerByFirebaseToken: jest.fn() };

  describe('CustomerSessionController', () => {
    let controller: CustomerSessionController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [CustomerSessionController],
        providers: [
          { provide: FirebaseAdminProvider, useValue: mockFirebase },
          { provide: 'PG_POOL', useValue: mockPool },
          { provide: CustomerSessionService, useValue: mockService },
        ],
      }).compile();
      controller = module.get(CustomerSessionController);
      jest.clearAllMocks();
    });

    it('returns customer session when token is valid', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid', phone_number: '+919999999999' });
      mockService.findOrCreateCustomerByFirebaseToken.mockResolvedValue({
        customerId: 'db-uuid-1', name: 'Test', phoneE164: '+919999999999',
        email: null, authProvider: 'phone', isNewUser: false,
      });
      const req = {
        headers: {
          authorization: 'Bearer valid-token',
          'x-tenant-id': '11111111-1111-4111-8111-111111111111',
        },
      };
      const result = await controller.createSession(req as never);
      expect(result.customer.id).toBe('db-uuid-1');
      expect(result.isNewUser).toBe(false);
    });

    it('throws 401 when authorization header is missing', async () => {
      const req = { headers: { 'x-tenant-id': '11111111-1111-4111-8111-111111111111' } };
      await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 when x-tenant-id header is missing', async () => {
      const req = { headers: { authorization: 'Bearer valid-token' } };
      await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 when verifyIdToken rejects', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));
      const req = {
        headers: {
          authorization: 'Bearer bad-token',
          'x-tenant-id': '11111111-1111-4111-8111-111111111111',
        },
      };
      await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd apps/api && pnpm vitest run src/modules/customer/__tests__/customer-session.controller.spec.ts
  ```
  Expected: FAIL — `CustomerSessionController is not defined`

- [ ] **Step 3: Implement CustomerSessionController**

  Create `apps/api/src/modules/customer/customer-session.controller.ts`:
  ```typescript
  import {
    Controller, Post, Patch, Req, Inject,
    UnauthorizedException, UseGuards,
  } from '@nestjs/common';
  import type { Request } from 'express';
  import type { Pool } from 'pg';
  import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
  import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
  import { FirebaseAdminProvider } from '../auth/firebase-admin.provider';
  import { CustomerAuthGuard, getCustomerCtx } from './customer-auth.guard';
  import { CustomerSessionService } from './customer-session.service';
  import { AuditAction } from '@goldsmith/audit';

  const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  @Controller('api/v1/customer')
  export class CustomerSessionController {
    constructor(
      @Inject(FirebaseAdminProvider) private readonly firebase: FirebaseAdminProvider,
      @Inject('PG_POOL')             private readonly pool: Pool,
      @Inject(CustomerSessionService) private readonly sessionService: CustomerSessionService,
    ) {}

    @SkipAuth()
    @SkipTenant()
    @Post('auth/session')
    async createSession(@Req() req: Request): Promise<{
      customer: { id: string; name: string; phoneE164: string | null; email: string | null };
      isNewUser: boolean;
      authProvider: 'phone' | 'google' | 'email_password';
    }> {
      const raw    = req.headers['authorization'];
      const shopId = typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'] : undefined;

      if (!raw) throw new UnauthorizedException({ code: 'customer.auth_missing' });
      if (!shopId) throw new UnauthorizedException({ code: 'customer.tenant_id_missing' });
      if (!UUID_SHAPE.test(shopId)) throw new UnauthorizedException({ code: 'customer.tenant_id_invalid' });

      const bearer = raw.replace(/^Bearer\s+/i, '');

      let decoded: { uid: string; phone_number?: string; email?: string; name?: string };
      try {
        decoded = await this.firebase.admin().auth().verifyIdToken(bearer, true);
      } catch {
        await this.pool.query(
          `INSERT INTO audit_events (shop_id, action, subject_type, metadata)
           VALUES ($1, $2, 'customer', $3::jsonb)
           ON CONFLICT DO NOTHING`,
          [shopId, AuditAction.CUSTOMER_AUTH_FAILED, JSON.stringify({ reason: 'token_invalid' })],
        ).catch(() => { /* fire-and-forget */ });
        throw new UnauthorizedException({ code: 'customer.token_invalid' });
      }

      const result = await this.sessionService.findOrCreateCustomerByFirebaseToken(
        this.pool, shopId, decoded,
      );

      return {
        customer: {
          id:        result.customerId,
          name:      result.name,
          phoneE164: result.phoneE164,
          email:     result.email,
        },
        isNewUser:    result.isNewUser,
        authProvider: result.authProvider,
      };
    }

    @Patch('profile/phone')
    @UseGuards(CustomerAuthGuard)
    async addPhone(@Req() req: Request): Promise<{ ok: true }> {
      const { customerId, shopId, phoneFromToken } = getCustomerCtx(req);
      if (!phoneFromToken) {
        throw new UnauthorizedException({ code: 'customer.no_phone_in_token' });
      }
      await this.pool.query(
        `UPDATE customers SET phone = $1 WHERE id = $2 AND shop_id = $3 AND deleted_at IS NULL`,
        [phoneFromToken, customerId, shopId],
      );
      return { ok: true };
    }
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd apps/api && pnpm vitest run src/modules/customer/__tests__/customer-session.controller.spec.ts
  ```
  Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/modules/customer/customer-session.controller.ts \
          apps/api/src/modules/customer/__tests__/customer-session.controller.spec.ts
  git commit -m "feat(customer): CustomerSessionController — POST auth/session + PATCH profile/phone"
  ```

---

## Task 6: Extend CustomerAuthGuard

**Files:**
- Modify: `apps/api/src/modules/customer/customer-auth.guard.ts`

**Changes:**
1. Remove the hard requirement for `phone_number` claim — OAuth tokens don't have it.
2. Extend `CustomerContext` to include `firebaseUid: string` and `phoneFromToken: string | null`.
3. New lookup order: (1) find by `firebase_uid`, (2) if not found and phone exists in token → phone lookup + atomic `firebase_uid` write (lazy migration), (3) else throw `customer.not_provisioned` (must call session endpoint first).
4. The old `findOrCreateCustomer` is replaced by `findByFirebaseUid` + `linkPhoneCustomer`.

- [ ] **Step 1: Write the failing tests**

  Create `apps/api/src/modules/customer/__tests__/customer-auth.guard.spec.ts`:
  ```typescript
  import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
  import { CustomerAuthGuard } from '../customer-auth.guard';

  const mockVerifyIdToken = jest.fn();
  const mockFirebase = { admin: () => ({ auth: () => ({ verifyIdToken: mockVerifyIdToken }) }) };

  function makePool(rows: Record<string, unknown>[][]): { query: jest.Mock; connect: jest.Mock } {
    let call = 0;
    const client = {
      query: jest.fn().mockImplementation(() => Promise.resolve({ rows: rows[call++] ?? [] })),
      release: jest.fn(),
    };
    return { connect: jest.fn().mockResolvedValue(client), query: jest.fn() } as never;
  }

  function makeCtx(headers: Record<string, string>): ExecutionContext {
    const req = { headers, customerCtx: undefined };
    return { switchToHttp: () => ({ getRequest: () => req }) } as never;
  }

  describe('CustomerAuthGuard (extended)', () => {
    let guard: CustomerAuthGuard;

    function buildGuard(pool: ReturnType<typeof makePool>): CustomerAuthGuard {
      return new CustomerAuthGuard(mockFirebase as never, pool as never);
    }

    const SHOP_ID = '11111111-1111-4111-8111-111111111111';

    beforeEach(() => { jest.clearAllMocks(); });

    it('sets customerCtx when firebase_uid found in DB', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'fb-uid', phone_number: '+91999' });
      const pool = makePool([
        [{ status: 'ACTIVE' }],              // assertActiveShop
        [],                                   // GUC
        [{ id: 'db-uuid', firebase_uid: 'fb-uid' }], // firebase_uid SELECT
      ]);
      guard = buildGuard(pool);
      const ctx = makeCtx({ authorization: 'Bearer tok', 'x-tenant-id': SHOP_ID });
      const ok = await guard.canActivate(ctx);
      expect(ok).toBe(true);
      const req = ctx.switchToHttp().getRequest() as Record<string, unknown>;
      expect((req.customerCtx as Record<string, unknown>)?.customerId).toBe('db-uuid');
    });

    it('lazy migration — links phone customer when firebase_uid lookup fails', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'fb-uid', phone_number: '+91999' });
      const pool = makePool([
        [{ status: 'ACTIVE' }],              // assertActiveShop
        [],                                   // GUC
        [],                                   // firebase_uid SELECT → not found
        [{ id: 'old-uuid' }],                // phone SELECT → found (old customer)
        [{ id: 'old-uuid' }],                // UPDATE SET firebase_uid RETURNING id
      ]);
      guard = buildGuard(pool);
      const ctx = makeCtx({ authorization: 'Bearer tok', 'x-tenant-id': SHOP_ID });
      const ok = await guard.canActivate(ctx);
      expect(ok).toBe(true);
      const req = ctx.switchToHttp().getRequest() as Record<string, unknown>;
      expect((req.customerCtx as Record<string, unknown>)?.customerId).toBe('old-uuid');
    });

    it('throws not_provisioned when firebase_uid not found and no phone in token', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'fb-uid', email: 'a@b.com' });
      const pool = makePool([
        [{ status: 'ACTIVE' }],
        [],                                   // GUC
        [],                                   // firebase_uid SELECT → not found
      ]);
      guard = buildGuard(pool);
      const ctx = makeCtx({ authorization: 'Bearer tok', 'x-tenant-id': SHOP_ID });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'customer.not_provisioned' },
      });
    });

    it('throws 401 when authorization header missing', async () => {
      guard = buildGuard(makePool([]));
      const ctx = makeCtx({ 'x-tenant-id': SHOP_ID });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd apps/api && pnpm vitest run src/modules/customer/__tests__/customer-auth.guard.spec.ts
  ```
  Expected: FAIL on the extended-logic tests (the guard currently requires `phone_number`)

- [ ] **Step 3: Rewrite CustomerAuthGuard**

  Replace the contents of `apps/api/src/modules/customer/customer-auth.guard.ts`:
  ```typescript
  import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Inject,
    ServiceUnavailableException,
    UnauthorizedException,
  } from '@nestjs/common';
  import type { Request } from 'express';
  import type { Pool } from 'pg';
  import { withShopTx } from '@goldsmith/db';
  import { FirebaseAdminProvider } from '../auth/firebase-admin.provider';

  export const DEV_MOCK_BEARER_PREFIX = 'DEV-MOCK-';
  export const DEV_MOCK_CUSTOMER_ID   = '00000000-0000-4000-8000-000000000999';
  export const CUSTOMER_SELF_REGISTRATION_ACTOR_ID = '00000000-0000-4000-8000-000000000998';
  const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  export interface CustomerContext {
    customerId:     string;
    shopId:         string;
    firebaseUid:    string;
    phoneFromToken: string | null;
  }

  export function getCustomerCtx(req: Request): CustomerContext {
    const ctx = (req as Request & { customerCtx?: CustomerContext }).customerCtx;
    if (!ctx) throw new UnauthorizedException({ code: 'customer.context_not_set' });
    return ctx;
  }

  @Injectable()
  export class CustomerAuthGuard implements CanActivate {
    constructor(
      @Inject(FirebaseAdminProvider) private readonly firebase: FirebaseAdminProvider,
      @Inject('PG_POOL')             private readonly pool: Pool,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const req    = context.switchToHttp().getRequest<Request & { customerCtx?: CustomerContext }>();
      const raw    = req.headers['authorization'];
      const shopId = this.singleHeader(req.headers['x-tenant-id']);

      if (!raw) throw new UnauthorizedException({ code: 'customer.auth_missing' });
      const bearer = raw.replace(/^Bearer\s+/i, '');
      if (!shopId) throw new UnauthorizedException({ code: 'customer.tenant_id_missing' });
      if (!UUID_SHAPE.test(shopId)) throw new UnauthorizedException({ code: 'customer.tenant_id_invalid' });

      // Development mock path
      if (bearer.startsWith(DEV_MOCK_BEARER_PREFIX)) {
        const nodeEnv = process.env['NODE_ENV'];
        if (nodeEnv !== 'development' && nodeEnv !== 'test') {
          throw new UnauthorizedException({ code: 'customer.dev_mock_not_allowed' });
        }
        await this.assertActiveShop(shopId);
        req.customerCtx = {
          customerId:     DEV_MOCK_CUSTOMER_ID,
          shopId,
          firebaseUid:    'dev-mock-firebase-uid',
          phoneFromToken: '+919999999999',
        };
        return true;
      }

      // Real Firebase ID token path — no longer requires phone_number claim
      let firebaseUid: string;
      let phoneFromToken: string | null;
      try {
        const decoded = await this.firebase.admin().auth().verifyIdToken(bearer, false);
        firebaseUid   = decoded.uid;
        phoneFromToken = (decoded['phone_number'] ?? decoded['phoneNumber'] ?? null) as string | null;
      } catch {
        throw new UnauthorizedException({ code: 'customer.token_invalid' });
      }

      await this.assertActiveShop(shopId);

      const customerId = await this.resolveCustomer(shopId, firebaseUid, phoneFromToken);
      req.customerCtx = { customerId, shopId, firebaseUid, phoneFromToken };
      return true;
    }

    private singleHeader(value: string | string[] | undefined): string | undefined {
      return typeof value === 'string' ? value : undefined;
    }

    // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- guard boundary validates x-tenant-id before customer context is set
    private async assertActiveShop(shopId: string): Promise<void> {
      const row = await this.pool.query<{ status: string }>(
        `SELECT status FROM shops WHERE id = $1 LIMIT 1`,
        [shopId],
      );
      const shop = row.rows[0];
      if (!shop) throw new UnauthorizedException({ code: 'customer.shop_not_found' });
      if (shop.status !== 'ACTIVE') throw new ServiceUnavailableException({ code: 'tenant.inactive' });
    }

    // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- guard boundary validates x-tenant-id before creating customer context
    private async resolveCustomer(
      shopId:        string,
      firebaseUid:   string,
      phoneFromToken: string | null,
    ): Promise<string> {
      return withShopTx(this.pool, shopId, async (tx) => {
        // Primary lookup: by firebase_uid (all new customers + lazy-migrated existing ones)
        const byUid = await tx.query<{ id: string }>(
          `SELECT id FROM customers
           WHERE shop_id = $1 AND firebase_uid = $2 AND deleted_at IS NULL
           LIMIT 1`,
          [shopId, firebaseUid],
        );
        if (byUid.rows[0]) return byUid.rows[0].id;

        // Lazy migration: existing phone-OTP customer with firebase_uid = NULL
        if (phoneFromToken) {
          const byPhone = await tx.query<{ id: string }>(
            `SELECT id FROM customers
             WHERE shop_id = $1 AND phone = $2 AND firebase_uid IS NULL AND deleted_at IS NULL
             LIMIT 1
             FOR UPDATE`,
            [shopId, phoneFromToken],
          );
          if (byPhone.rows[0]) {
            const updated = await tx.query<{ id: string }>(
              `UPDATE customers SET firebase_uid = $1
               WHERE id = $2
               RETURNING id`,
              [firebaseUid, byPhone.rows[0].id],
            );
            if (updated.rows[0]) return updated.rows[0].id;
          }
        }

        // Not found: OAuth user must call /auth/session first to provision record
        throw new UnauthorizedException({ code: 'customer.not_provisioned' });
      });
    }
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd apps/api && pnpm vitest run src/modules/customer/__tests__/customer-auth.guard.spec.ts
  ```
  Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/modules/customer/customer-auth.guard.ts \
          apps/api/src/modules/customer/__tests__/customer-auth.guard.spec.ts
  git commit -m "feat(customer): extend CustomerAuthGuard — firebase_uid lookup + lazy migration + OAuth support"
  ```

---

## Task 7: Wire CustomerModule

**Files:**
- Modify: `apps/api/src/modules/customer/customer.module.ts`

- [ ] **Step 1: Add CustomerSessionService and CustomerSessionController**

  Replace the contents of `apps/api/src/modules/customer/customer.module.ts`:
  ```typescript
  import { Module } from '@nestjs/common';
  import { AuthModule } from '../auth/auth.module';
  import { CrmModule } from '../crm/crm.module';
  import { CustomOrdersModule } from '../custom-orders/custom-orders.module';
  import { LoyaltyModule } from '../loyalty/loyalty.module';
  import { RateLockBookingsModule } from '../rate-lock-bookings/rate-lock-bookings.module';
  import { TryAtHomeBookingsModule } from '../try-at-home-bookings/try-at-home-bookings.module';
  import { CustomerController } from './customer.controller';
  import { PaymentController } from './payment.controller';
  import { CustomerAuthGuard } from './customer-auth.guard';
  import { CustomerSessionService } from './customer-session.service';
  import { CustomerSessionController } from './customer-session.controller';

  @Module({
    imports: [
      AuthModule,
      CrmModule,
      CustomOrdersModule,
      LoyaltyModule,
      RateLockBookingsModule,
      TryAtHomeBookingsModule,
    ],
    controllers: [CustomerController, PaymentController, CustomerSessionController],
    providers:   [CustomerAuthGuard, CustomerSessionService],
  })
  export class CustomerModule {}
  ```

- [ ] **Step 2: Run typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 new errors

- [ ] **Step 3: Run API tests**

  ```bash
  cd apps/api && pnpm test
  ```
  Expected: all tests pass

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/modules/customer/customer.module.ts
  git commit -m "feat(customer): wire CustomerSessionService + CustomerSessionController into CustomerModule"
  ```

---

## Task 8: Customer store + CustomerAuthProvider update

**Files:**
- Modify: `apps/customer-mobile/src/stores/customerSessionStore.ts`
- Modify: `apps/customer-mobile/src/providers/CustomerAuthProvider.tsx`

**Key change in CustomerAuthProvider:** After `onAuthStateChanged` fires, call `POST /api/v1/customer/auth/session` to get the DB UUID (not Firebase UID). Use a raw `axios` call (not the `api` instance) to avoid interceptor circular dependency at boot time.

- [ ] **Step 1: Update customerSessionStore.ts**

  Replace the contents of `apps/customer-mobile/src/stores/customerSessionStore.ts`:
  ```typescript
  import { create } from 'zustand';

  export interface Customer {
    id:        string;        // DB UUID (not Firebase UID)
    shopId:    string;
    name:      string;
    phoneE164: string | null; // null for OAuth users who haven't added a phone yet
    email:     string | null;
  }

  export interface CustomerSessionState {
    customer:   Customer | null;
    bearer:     string | null;
    isNewOAuth: boolean;      // true after first OAuth sign-up without phone — drives "Add phone" nudge
    setSession: (customer: Customer, bearer: string, isNewOAuth?: boolean) => void;
    clear:      () => void;
  }

  export const useCustomerSessionStore = create<CustomerSessionState>((set) => ({
    customer:   null,
    bearer:     null,
    isNewOAuth: false,
    setSession: (customer, bearer, isNewOAuth = false): void =>
      set({ customer, bearer, isNewOAuth }),
    clear: (): void => set({ customer: null, bearer: null, isNewOAuth: false }),
  }));
  ```

- [ ] **Step 2: Update CustomerAuthProvider.tsx**

  Replace the production Firebase auth path (lines 69–111) in `apps/customer-mobile/src/providers/CustomerAuthProvider.tsx`:
  ```typescript
  import React, { createContext, useContext, useEffect, useState } from 'react';
  import axios from 'axios';
  import Constants from 'expo-constants';
  import auth from '@react-native-firebase/auth';
  import { useCustomerSessionStore } from '../stores/customerSessionStore';
  import { useTenantStore } from '../stores/tenantStore';
  import { saveSecureSession, loadSecureSession, clearSecureSession } from '../lib/secure-storage';
  import {
    DEV_MOCK_BEARER_PREFIX,
    DEV_MOCK_CUSTOMER_NAME,
    DEV_MOCK_CUSTOMER_PHONE,
    buildDevMockBearer,
    buildDevMockCustomer,
  } from '../lib/dev-mock-session';
  import { identifyPostHog } from '../lib/posthog';

  interface CustomerAuthBootstrapValue { ready: boolean }
  const CustomerAuthBootstrapContext = createContext<CustomerAuthBootstrapValue>({ ready: false });
  export function useCustomerAuthBootstrap(): CustomerAuthBootstrapValue {
    return useContext(CustomerAuthBootstrapContext);
  }

  const baseURL =
    (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3001';

  interface SessionResponse {
    customer:     { id: string; name: string; phoneE164: string | null; email: string | null };
    isNewUser:    boolean;
    authProvider: 'phone' | 'google' | 'email_password';
  }

  async function callSessionEndpoint(idToken: string, shopId: string): Promise<SessionResponse> {
    const resp = await axios.post<SessionResponse>(
      `${baseURL}/api/v1/customer/auth/session`,
      {},
      {
        headers: { Authorization: `Bearer ${idToken}`, 'x-tenant-id': shopId },
        timeout: 15_000,
      },
    );
    return resp.data;
  }

  export function CustomerAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
    const setSession   = useCustomerSessionStore((s) => s.setSession);
    const clearSession = useCustomerSessionStore((s) => s.clear);
    const tenant       = useTenantStore((s) => s.tenant);
    const tenantError  = useTenantStore((s) => s.error);
    const devAuth      = Boolean(Constants.expoConfig?.extra?.['devAuth']);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      if (tenantError !== null) { setReady(true); return; }
      if (tenant === null) return;

      // ── Dev mock path ──────────────────────────────────────────────────────────
      if (devAuth) {
        let cancelled = false;
        (async (): Promise<void> => {
          try {
            const persisted = await loadSecureSession();
            if (cancelled) return;
            if (persisted?.bearer.startsWith(DEV_MOCK_BEARER_PREFIX) && persisted.shopId === tenant.id) {
              setSession(
                { id: persisted.customerId, shopId: persisted.shopId,
                  name: DEV_MOCK_CUSTOMER_NAME, phoneE164: DEV_MOCK_CUSTOMER_PHONE, email: null },
                persisted.bearer,
              );
              void identifyPostHog(DEV_MOCK_CUSTOMER_PHONE, persisted.shopId);
              return;
            }
            const bearer   = buildDevMockBearer();
            const customer = buildDevMockCustomer(tenant);
            await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
            if (cancelled) return;
            setSession({ ...customer, email: null }, bearer);
            void identifyPostHog(customer.phoneE164, customer.shopId);
          } finally { if (!cancelled) setReady(true); }
        })();
        return (): void => { cancelled = true; };
      }

      // ── Production Firebase auth path ──────────────────────────────────────────
      let bootstrapped = false;

      const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
        try {
          if (!firebaseUser) {
            const persisted = await loadSecureSession();
            if (persisted) await clearSecureSession();
            clearSession();
            return;
          }

          // Force-refresh only on first load; subsequent 401s use the api interceptor
          const idToken = await firebaseUser.getIdToken(!bootstrapped);

          // Call the session endpoint to provision/resolve the DB customer record.
          // This is the source of truth for the DB UUID — do NOT use firebaseUser.uid as customerId.
          const session = await callSessionEndpoint(idToken, tenant.id);
          const { customer: dbCustomer, isNewUser, authProvider } = session;

          await saveSecureSession({
            bearer:     idToken,
            customerId: dbCustomer.id,  // DB UUID
            shopId:     tenant.id,
          });

          const isNewOAuth = isNewUser && authProvider !== 'phone';
          setSession(
            {
              id:        dbCustomer.id,
              shopId:    tenant.id,
              name:      dbCustomer.name,
              phoneE164: dbCustomer.phoneE164,
              email:     dbCustomer.email,
            },
            idToken,
            isNewOAuth,
          );
          void identifyPostHog(dbCustomer.phoneE164 ?? dbCustomer.email ?? dbCustomer.id, tenant.id);
        } finally {
          if (!bootstrapped) { bootstrapped = true; setReady(true); }
        }
      });

      const fallback = setTimeout(() => {
        if (!bootstrapped) { bootstrapped = true; setReady(true); }
      }, 5000);

      return (): void => { unsubscribe(); clearTimeout(fallback); };
    }, [devAuth, tenant, tenantError, setSession, clearSession]);

    return (
      <CustomerAuthBootstrapContext.Provider value={{ ready }}>
        {children}
      </CustomerAuthBootstrapContext.Provider>
    );
  }
  ```

- [ ] **Step 3: Update secure-storage saveSecureSession type (if phoneE164 was hardcoded)**

  Check `apps/customer-mobile/src/lib/secure-storage.ts` — confirm `customerId` is stored as a string (no type issue with DB UUID replacing Firebase UID). If there are any type errors, fix them now.

  ```bash
  pnpm typecheck 2>&1 | grep secure-storage
  ```
  Expected: no output (no errors in secure-storage)

- [ ] **Step 4: Run typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 new errors. If `phoneE164` is referenced as non-null somewhere, update those usages to accept `string | null`.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/customer-mobile/src/stores/customerSessionStore.ts \
          apps/customer-mobile/src/providers/CustomerAuthProvider.tsx
  git commit -m "feat(customer-mobile): CustomerAuthProvider calls session endpoint; store DB UUID as customer.id"
  ```

---

## Task 9: Mobile — Google Sign-In helper + app.config.ts

**Files:**
- Create: `apps/customer-mobile/src/lib/google-sign-in.ts`
- Modify: `apps/customer-mobile/app.config.ts`
- Modify: `apps/customer-mobile/package.json`

Note: Google Sign-In helper goes in `apps/customer-mobile/src/lib/` (NOT in `@goldsmith/auth-client`). The `auth-client` package is both native and web; `@react-native-google-signin/google-signin` is native-only and would break web builds.

**Google Web Client ID (Type-3 from google-services.json):**
`528920018833-b2ua9n337u2blajt89t7f5qo5nj0d2rh.apps.googleusercontent.com`

- [ ] **Step 1: Add the npm dependency**

  In `apps/customer-mobile/package.json`, add to `dependencies`:
  ```json
  "@react-native-google-signin/google-signin": "^13.0.0",
  ```

  Then install:
  ```bash
  pnpm install
  ```

- [ ] **Step 2: Add the Expo plugin to app.config.ts**

  In `apps/customer-mobile/app.config.ts`, in the `plugins` array after `'@react-native-firebase/auth'`:
  ```typescript
  [
    '@react-native-google-signin/google-signin',
    {
      // iosUrlScheme is the reversed client ID for iOS — update when iOS build is needed.
      // Android only needs the plugin registered; webClientId is set programmatically.
    },
  ],
  ```

- [ ] **Step 3: Create google-sign-in.ts**

  Create `apps/customer-mobile/src/lib/google-sign-in.ts`:
  ```typescript
  import auth from '@react-native-firebase/auth';
  import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

  const GOOGLE_WEB_CLIENT_ID =
    '528920018833-b2ua9n337u2blajt89t7f5qo5nj0d2rh.apps.googleusercontent.com';

  // Called once at app start (before any sign-in attempt)
  export function configureGoogleSignIn(): void {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  }

  export type GoogleSignInError =
    | 'play_services_unavailable'
    | 'sign_in_cancelled'
    | 'in_progress'
    | 'unknown';

  export interface GoogleSignInResult {
    ok:    true;
  }

  export interface GoogleSignInFailure {
    ok:    false;
    error: GoogleSignInError;
  }

  export async function signInWithGoogle(): Promise<GoogleSignInResult | GoogleSignInFailure> {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) return { ok: false, error: 'unknown' };
      const credential = auth.GoogleAuthProvider.credential(data.idToken);
      await auth().signInWithCredential(credential);
      // Firebase onAuthStateChanged fires in CustomerAuthProvider — no further action here
      return { ok: true };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) return { ok: false, error: 'sign_in_cancelled' };
      if (code === statusCodes.IN_PROGRESS)       return { ok: false, error: 'in_progress' };
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, error: 'play_services_unavailable' };
      }
      return { ok: false, error: 'unknown' };
    }
  }
  ```

- [ ] **Step 4: Call configureGoogleSignIn at app entry**

  In `apps/customer-mobile/app/_layout.tsx` (or wherever the app initializes), import and call once:
  ```typescript
  import { configureGoogleSignIn } from '../src/lib/google-sign-in';
  // At the top level of the root layout, before any render:
  configureGoogleSignIn();
  ```
  
  Find the existing root layout file:
  ```bash
  ls apps/customer-mobile/app/_layout.tsx
  ```
  Add the import + call at the top (before the first component render, not inside a component body).

- [ ] **Step 5: Run typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 new errors

- [ ] **Step 6: Commit**

  ```bash
  git add apps/customer-mobile/src/lib/google-sign-in.ts \
          apps/customer-mobile/app.config.ts \
          apps/customer-mobile/package.json \
          pnpm-lock.yaml
  git commit -m "feat(customer-mobile): add @react-native-google-signin/google-signin; configureGoogleSignIn()"
  ```

---

## Task 10: welcome.tsx — three-card auth selector

**Files:**
- Modify: `apps/customer-mobile/app/(auth)/welcome.tsx`

**Design:** Three equal-weight cards stacked vertically. Existing phone OTP flow remains inline. Google card triggers `signInWithGoogle()`. Email card navigates to `/(auth)/email-auth`. Hindi-first copy, warm palette, ≥48dp touch targets.

- [ ] **Step 1: Rewrite welcome.tsx**

  Replace the contents of `apps/customer-mobile/app/(auth)/welcome.tsx`:
  ```typescript
  import React, { useEffect, useState } from 'react';
  import {
    Text, TextInput, Pressable, ActivityIndicator,
    KeyboardAvoidingView, Platform, ScrollView, View,
  } from 'react-native';
  import { router } from 'expo-router';
  import Constants from 'expo-constants';
  import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
  import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
  import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
  import { useCustomerSessionStore } from '../../src/stores/customerSessionStore';
  import { useTenantStore } from '../../src/stores/tenantStore';
  import { saveSecureSession } from '../../src/lib/secure-storage';
  import { buildDevMockBearer, buildDevMockCustomer } from '../../src/lib/dev-mock-session';
  import { signInWithGoogle } from '../../src/lib/google-sign-in';

  type Step = 'select' | 'phone' | 'otp';

  export default function Welcome(): React.ReactElement {
    const devAuth    = Boolean(Constants.expoConfig?.extra?.['devAuth']);
    const setSession = useCustomerSessionStore((s) => s.setSession);
    const customer   = useCustomerSessionStore((s) => s.customer);
    const tenant     = useTenantStore((s) => s.tenant);

    useEffect(() => {
      if (customer) router.replace('/(tabs)');
    }, [customer]);

    const [step,        setStep]        = useState<Step>('select');
    const [phoneInput,  setPhoneInput]  = useState('');
    const [otpInput,    setOtpInput]    = useState('');
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

    const onDevContinue = async (): Promise<void> => {
      if (!tenant) return;
      const bearer   = buildDevMockBearer();
      const customer = buildDevMockCustomer(tenant);
      await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
      setSession({ ...customer, email: null }, bearer);
      router.replace('/(tabs)');
    };

    const onGoogleSignIn = async (): Promise<void> => {
      setError(null);
      setLoading(true);
      try {
        const result = await signInWithGoogle();
        if (!result.ok) {
          if (result.error !== 'sign_in_cancelled') {
            setError('Google से साइन इन नहीं हो सका। पुनः प्रयास करें।');
          }
        }
        // On success, onAuthStateChanged fires in CustomerAuthProvider
      } finally {
        setLoading(false);
      }
    };

    const onSendOtp = async (): Promise<void> => {
      setError(null);
      const trimmed = phoneInput.trim();
      const e164 = /^\+/.test(trimmed) ? trimmed : `+91${trimmed.replace(/\D/g, '')}`;
      if (!/^\+\d{8,15}$/.test(e164)) {
        setError('कृपया सही मोबाइल नंबर दर्ज करें (10 अंक)');
        return;
      }
      setLoading(true);
      try {
        const result = await auth().signInWithPhoneNumber(e164);
        setConfirmation(result);
        setStep('otp');
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/too-many-requests') setError('बहुत अधिक प्रयास। कृपया कुछ देर बाद प्रयास करें।');
        else if (code === 'auth/invalid-phone-number') setError('अमान्य फ़ोन नंबर। कृपया जाँचें।');
        else setError('OTP भेजने में त्रुटि। पुनः प्रयास करें।');
      } finally {
        setLoading(false);
      }
    };

    const onVerifyOtp = async (): Promise<void> => {
      if (!confirmation) return;
      setError(null);
      const code = otpInput.trim();
      if (!/^\d{6}$/.test(code)) { setError('6 अंकों का OTP दर्ज करें'); return; }
      setLoading(true);
      try {
        await confirmation.confirm(code);
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/invalid-verification-code') setError('गलत OTP। कृपया पुनः जाँचें।');
        else if (code === 'auth/code-expired') {
          setError('OTP की समय-सीमा समाप्त। कृपया नया OTP मंगाएं।');
          setStep('phone');
          setConfirmation(null);
        } else setError('OTP सत्यापन में त्रुटि। पुनः प्रयास करें।');
      } finally {
        setLoading(false);
      }
    };

    const cardStyle = {
      backgroundColor:  colors.white,
      borderWidth:      1.5,
      borderColor:      colors.border,
      borderRadius:     radii.sm,
      paddingVertical:  spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom:     spacing.sm,
      minHeight:        56,
      justifyContent:   'center' as const,
    };

    const cardLabelStyle = {
      fontFamily:  typography.body.family,
      fontSize:    17,
      color:       colors.ink,
      fontWeight:  '600' as const,
    };

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TenantBrandHeader />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontFamily: typography.display.family, fontSize: 28, color: colors.ink, marginBottom: spacing.sm }}>
            स्वागत है
          </Text>

          {/* ── Auth method selector ──────────────────────────────────────── */}
          {step === 'select' && (
            <>
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginBottom: spacing.xl }}>
                साइन इन करने का तरीका चुनें
              </Text>

              {/* Phone OTP card */}
              <Pressable
                testID="auth-select-phone"
                onPress={() => setStep('phone')}
                style={cardStyle}
                accessibilityRole="button"
                accessibilityLabel="मोबाइल नंबर से साइन इन"
              >
                <Text style={cardLabelStyle}>📱 मोबाइल नंबर</Text>
              </Pressable>

              {/* Google Sign-In card */}
              <Pressable
                testID="auth-select-google"
                onPress={() => { void onGoogleSignIn(); }}
                disabled={loading}
                style={{ ...cardStyle, opacity: loading ? 0.6 : 1 }}
                accessibilityRole="button"
                accessibilityLabel="Google से साइन इन"
              >
                {loading
                  ? <ActivityIndicator color={colors.ink} />
                  : <Text style={cardLabelStyle}>G  Google से जारी रखें</Text>
                }
              </Pressable>

              {/* Email/Password card */}
              <Pressable
                testID="auth-select-email"
                onPress={() => router.push('/(auth)/email-auth')}
                style={cardStyle}
                accessibilityRole="button"
                accessibilityLabel="ईमेल और पासवर्ड से साइन इन"
              >
                <Text style={cardLabelStyle}>✉  ईमेल और पासवर्ड</Text>
              </Pressable>
            </>
          )}

          {/* ── Phone OTP flow ────────────────────────────────────────────── */}
          {step === 'phone' && (
            <>
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginBottom: spacing.xl }}>
                अपना मोबाइल नंबर दर्ज करें। हम एक OTP भेजेंगे।
              </Text>
              <TextInput
                testID="phone-input"
                value={phoneInput}
                onChangeText={(v) => { setPhoneInput(v); setError(null); }}
                keyboardType="phone-pad"
                placeholder="मोबाइल नंबर (10 अंक)"
                placeholderTextColor={colors.inkMute}
                maxLength={13}
                style={{
                  borderWidth: 1.5,
                  borderColor: error ? '#DC2626' : colors.border,
                  borderRadius: radii.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  fontSize: 18,
                  fontFamily: typography.body.family,
                  color: colors.ink,
                  backgroundColor: colors.white,
                  minHeight: 52,
                  marginBottom: error ? spacing.xs : spacing.lg,
                }}
                accessibilityLabel="मोबाइल नंबर"
              />
              {error ? <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginBottom: spacing.md }} accessibilityRole="alert">{error}</Text> : null}
              <Pressable
                testID="send-otp-button"
                onPress={() => { void onSendOtp(); }}
                disabled={loading}
                style={{ backgroundColor: colors.ink, borderRadius: radii.sm, paddingVertical: spacing.md, alignItems: 'center', minHeight: 52, justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
                accessibilityLabel="OTP भेजें"
                accessibilityRole="button"
              >
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={{ fontFamily: typography.body.family, fontSize: 17, color: colors.white, fontWeight: '700' }}>OTP भेजें</Text>}
              </Pressable>
              <Pressable onPress={() => { setStep('select'); setError(null); setPhoneInput(''); }} style={{ marginTop: spacing.md, alignItems: 'center' }} accessibilityRole="button">
                <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.accent }}>← वापस जाएं</Text>
              </Pressable>
            </>
          )}

          {/* ── OTP verification ──────────────────────────────────────────── */}
          {step === 'otp' && (
            <>
              <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginBottom: spacing.md }}>
                {phoneInput} पर OTP भेजा गया।
              </Text>
              <TextInput
                testID="otp-input"
                value={otpInput}
                onChangeText={(v) => { setOtpInput(v); setError(null); }}
                keyboardType="number-pad"
                placeholder="6 अंकों का OTP"
                placeholderTextColor={colors.inkMute}
                maxLength={6}
                style={{ borderWidth: 1.5, borderColor: error ? '#DC2626' : colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 22, letterSpacing: 6, fontFamily: typography.body.family, color: colors.ink, backgroundColor: colors.white, minHeight: 52, textAlign: 'center', marginBottom: error ? spacing.xs : spacing.lg }}
                accessibilityLabel="OTP"
              />
              {error ? <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginBottom: spacing.md }} accessibilityRole="alert">{error}</Text> : null}
              <Pressable testID="verify-otp-button" onPress={() => { void onVerifyOtp(); }} disabled={loading} style={{ backgroundColor: colors.ink, borderRadius: radii.sm, paddingVertical: spacing.md, alignItems: 'center', minHeight: 52, justifyContent: 'center', opacity: loading ? 0.6 : 1, marginBottom: spacing.md }} accessibilityLabel="OTP सत्यापित करें" accessibilityRole="button">
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={{ fontFamily: typography.body.family, fontSize: 17, color: colors.white, fontWeight: '700' }}>सत्यापित करें</Text>}
              </Pressable>
              <Pressable onPress={() => { setStep('phone'); setConfirmation(null); setError(null); setOtpInput(''); }} accessibilityRole="button" accessibilityLabel="नंबर बदलें">
                <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.accent, textAlign: 'center' }}>← नंबर बदलें</Text>
              </Pressable>
            </>
          )}

          {error && step === 'select' ? <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginTop: spacing.sm, textAlign: 'center' }} accessibilityRole="alert">{error}</Text> : null}

          {devAuth ? (
            <Pressable onPress={() => { void onDevContinue(); }} style={{ marginTop: spacing.xl, alignItems: 'center' }} testID="welcome-dev-continue" accessibilityRole="button">
              <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute }}>[Dev] जारी रखें बिना OTP के</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
  ```

- [ ] **Step 2: Add email-auth to _layout.tsx Stack screens**

  In `apps/customer-mobile/app/(auth)/_layout.tsx`, ensure `email-auth` has a `Stack.Screen` entry:
  ```typescript
  <Stack.Screen name="email-auth" options={{ title: 'ईमेल साइन इन', headerShown: true }} />
  ```
  
  Check if `(auth)/_layout.tsx` exists:
  ```bash
  ls apps/customer-mobile/app/(auth)/
  ```
  If `_layout.tsx` exists, add the screen. If not (no separate auth layout), `expo-router` handles it automatically — skip this step.

- [ ] **Step 3: Run typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 new errors

- [ ] **Step 4: Commit**

  ```bash
  git add apps/customer-mobile/app/\(auth\)/welcome.tsx
  git commit -m "feat(customer-mobile): welcome.tsx three-card auth selector (phone / Google / email)"
  ```

---

## Task 11: email-auth.tsx — new email/password screen

**Files:**
- Create: `apps/customer-mobile/app/(auth)/email-auth.tsx`

**Design:** Two tabs — साइन इन / खाता बनाएं. Password visibility toggle. Inline Zod validation. Hindi error strings. Forgot password sends reset email.

- [ ] **Step 1: Create email-auth.tsx**

  Create `apps/customer-mobile/app/(auth)/email-auth.tsx`:
  ```typescript
  import React, { useState } from 'react';
  import {
    Text, TextInput, Pressable, ActivityIndicator,
    KeyboardAvoidingView, Platform, ScrollView, View,
  } from 'react-native';
  import auth from '@react-native-firebase/auth';
  import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

  type Tab = 'signin' | 'signup';

  const HINDI_ERRORS: Record<string, string> = {
    'auth/invalid-credential':   'ईमेल या पासवर्ड गलत है।',
    'auth/user-not-found':       'ईमेल या पासवर्ड गलत है.',  // same — no enumeration
    'auth/wrong-password':       'ईमेल या पासवर्ड गलत है.',
    'auth/email-already-in-use': 'यह ईमेल पहले से पंजीकृत है। साइन इन करें।',
    'auth/weak-password':        'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।',
    'auth/invalid-email':        'अमान्य ईमेल पता।',
    'auth/too-many-requests':    'बहुत अधिक प्रयास। कुछ देर बाद पुनः प्रयास करें।',
  };

  function mapError(code: string): string {
    return HINDI_ERRORS[code] ?? 'एक त्रुटि हुई। पुनः प्रयास करें।';
  }

  export default function EmailAuth(): React.ReactElement {
    const [tab,          setTab]          = useState<Tab>('signin');
    const [email,        setEmail]        = useState('');
    const [password,     setPassword]     = useState('');
    const [confirmPass,  setConfirmPass]  = useState('');
    const [displayName,  setDisplayName]  = useState('');
    const [showPass,     setShowPass]     = useState(false);
    const [loading,      setLoading]      = useState(false);
    const [error,        setError]        = useState<string | null>(null);
    const [resetSent,    setResetSent]    = useState(false);

    const validate = (): string | null => {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return 'वैध ईमेल पता दर्ज करें।';
      if (password.length < 8)
        return 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।';
      if (tab === 'signup') {
        if (!displayName.trim()) return 'अपना नाम दर्ज करें।';
        if (password !== confirmPass) return 'पासवर्ड मेल नहीं खाते।';
      }
      return null;
    };

    const onSignIn = async (): Promise<void> => {
      const err = validate();
      if (err) { setError(err); return; }
      setError(null);
      setLoading(true);
      try {
        await auth().signInWithEmailAndPassword(email.trim(), password);
        // CustomerAuthProvider handles session via onAuthStateChanged
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        setError(mapError(code));
      } finally {
        setLoading(false);
      }
    };

    const onSignUp = async (): Promise<void> => {
      const err = validate();
      if (err) { setError(err); return; }
      setError(null);
      setLoading(true);
      try {
        const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
        await cred.user.updateProfile({ displayName: displayName.trim() });
        // Force token refresh so displayName is in the next token claim
        await cred.user.getIdToken(true);
        // CustomerAuthProvider handles session via onAuthStateChanged
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        setError(mapError(code));
      } finally {
        setLoading(false);
      }
    };

    const onForgotPassword = async (): Promise<void> => {
      if (!email.trim()) { setError('पासवर्ड रीसेट के लिए पहले ईमेल दर्ज करें।'); return; }
      setError(null);
      setLoading(true);
      try {
        await auth().sendPasswordResetEmail(email.trim());
        setResetSent(true);
      } catch {
        setError('पासवर्ड रीसेट ईमेल नहीं भेज पाए। पुनः प्रयास करें।');
      } finally {
        setLoading(false);
      }
    };

    const inputStyle = (hasError?: boolean) => ({
      borderWidth: 1.5,
      borderColor: hasError ? '#DC2626' : colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 16,
      fontFamily: typography.body.family,
      color: colors.ink,
      backgroundColor: colors.white,
      minHeight: 52,
      marginBottom: spacing.sm,
    });

    const primaryBtn = {
      backgroundColor: colors.ink,
      borderRadius: radii.sm,
      paddingVertical: spacing.md,
      alignItems: 'center' as const,
      minHeight: 52,
      justifyContent: 'center' as const,
      marginTop: spacing.sm,
    };

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tab switcher */}
          <View style={{ flexDirection: 'row', marginBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {(['signin', 'signup'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => { setTab(t); setError(null); setResetSent(false); }}
                style={{ flex: 1, paddingBottom: spacing.sm, borderBottomWidth: 2, borderBottomColor: tab === t ? colors.ink : 'transparent' }}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
              >
                <Text style={{ textAlign: 'center', fontFamily: typography.body.family, fontSize: 16, color: tab === t ? colors.ink : colors.inkMute, fontWeight: tab === t ? '700' : '400' }}>
                  {t === 'signin' ? 'साइन इन' : 'खाता बनाएं'}
                </Text>
              </Pressable>
            ))}
          </View>

          {resetSent ? (
            <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: '#15803D', textAlign: 'center', marginBottom: spacing.lg }} accessibilityRole="alert">
              पासवर्ड रीसेट का ईमेल भेज दिया गया। अपना इनबॉक्स जाँचें।
            </Text>
          ) : null}

          {tab === 'signup' && (
            <TextInput
              testID="displayname-input"
              value={displayName}
              onChangeText={(v) => { setDisplayName(v); setError(null); }}
              placeholder="आपका नाम"
              placeholderTextColor={colors.inkMute}
              style={inputStyle()}
              accessibilityLabel="नाम"
            />
          )}

          <TextInput
            testID="email-input"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ईमेल पता"
            placeholderTextColor={colors.inkMute}
            style={inputStyle()}
            accessibilityLabel="ईमेल"
          />

          <View style={{ position: 'relative' }}>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secureTextEntry={!showPass}
              placeholder="पासवर्ड (8+ अक्षर)"
              placeholderTextColor={colors.inkMute}
              style={inputStyle()}
              accessibilityLabel="पासवर्ड"
            />
            <Pressable
              onPress={() => setShowPass((p) => !p)}
              style={{ position: 'absolute', right: spacing.md, top: 14 }}
              accessibilityRole="button"
              accessibilityLabel={showPass ? 'पासवर्ड छुपाएं' : 'पासवर्ड दिखाएं'}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
                {showPass ? 'छुपाएं' : 'दिखाएं'}
              </Text>
            </Pressable>
          </View>

          {tab === 'signup' && (
            <TextInput
              testID="confirm-password-input"
              value={confirmPass}
              onChangeText={(v) => { setConfirmPass(v); setError(null); }}
              secureTextEntry={!showPass}
              placeholder="पासवर्ड पुनः दर्ज करें"
              placeholderTextColor={colors.inkMute}
              style={inputStyle(!!error && password !== confirmPass)}
              accessibilityLabel="पासवर्ड पुनः दर्ज करें"
            />
          )}

          {error ? (
            <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginBottom: spacing.sm }} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            testID={tab === 'signin' ? 'signin-button' : 'signup-button'}
            onPress={() => { void (tab === 'signin' ? onSignIn() : onSignUp()); }}
            disabled={loading}
            style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}
            accessibilityRole="button"
          >
            {loading ? <ActivityIndicator color={colors.white} /> : (
              <Text style={{ fontFamily: typography.body.family, fontSize: 17, color: colors.white, fontWeight: '700' }}>
                {tab === 'signin' ? 'साइन इन' : 'खाता बनाएं'}
              </Text>
            )}
          </Pressable>

          {tab === 'signin' && (
            <Pressable
              testID="forgot-password-button"
              onPress={() => { void onForgotPassword(); }}
              disabled={loading}
              style={{ marginTop: spacing.md, alignItems: 'center' }}
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.accent }}>
                पासवर्ड भूल गए?
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
  ```

- [ ] **Step 2: Run typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 new errors

- [ ] **Step 3: Commit**

  ```bash
  git add apps/customer-mobile/app/\(auth\)/email-auth.tsx
  git commit -m "feat(customer-mobile): email-auth.tsx — sign-in + create-account tabs with Hindi UX"
  ```

---

## Task 12: Customer-web — Google + Email auth

**Files:**
- Modify: `apps/customer-web/src/auth/firebase-customer.ts`
- Modify: `apps/customer-web/app/sign-in/sign-in-page-client.tsx`

The web sign-in page currently only has phone OTP. We add Google and Email/Password as additional sign-in methods. After any method succeeds, we call `POST /api/v1/customer/auth/session` to provision the DB record before routing.

The `NEXT_PUBLIC_API_BASE` env var is used for the session endpoint call (same base URL as other API calls).

- [ ] **Step 1: Extend firebase-customer.ts**

  In `apps/customer-web/src/auth/firebase-customer.ts`, add after the existing imports and `getCustomerAuth()` helper:
  ```typescript
  import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
  } from 'firebase/auth';

  export async function signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(getCustomerAuth(), provider);
  }

  export async function signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(getCustomerAuth(), email, password);
  }

  export async function createEmailAccount(
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> {
    const cred = await createUserWithEmailAndPassword(getCustomerAuth(), email, password);
    await updateProfile(cred.user, { displayName });
  }

  export async function sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(getCustomerAuth(), email);
  }
  ```

  Note: these are additional exports appended to the existing file. Existing exports are unchanged.

- [ ] **Step 2: Write the failing test for session endpoint call**

  Create `apps/customer-web/test/sign-in-session.test.ts`:
  ```typescript
  // Smoke: callCustomerSessionEndpoint constructs the right URL and headers
  import { describe, it, expect, vi } from 'vitest';

  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    customer: { id: 'db-uuid', name: 'Test', phoneE164: null, email: 'a@b.com' },
    isNewUser: true,
    authProvider: 'google',
  }) }) as typeof fetch;

  describe('callCustomerSessionEndpoint', () => {
    it('posts to /api/v1/customer/auth/session with correct headers', async () => {
      // We test indirectly via the API helper to be added to lib/api.ts
      const { callCustomerSessionEndpoint } = await import('../lib/api');
      await callCustomerSessionEndpoint('id-token-abc', 'shop-uuid-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/customer/auth/session'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer id-token-abc',
            'X-Tenant-Id': 'shop-uuid-123',
          }),
        }),
      );
    });
  });
  ```

- [ ] **Step 3: Add callCustomerSessionEndpoint to lib/api.ts**

  In `apps/customer-web/lib/api.ts`, add after the existing helper functions:
  ```typescript
  export interface CustomerSessionResponse {
    customer: { id: string; name: string; phoneE164: string | null; email: string | null };
    isNewUser:    boolean;
    authProvider: 'phone' | 'google' | 'email_password';
  }

  export async function callCustomerSessionEndpoint(
    idToken: string,
    shopId:  string,
  ): Promise<CustomerSessionResponse | null> {
    try {
      const res = await fetch(`${API_URL}/api/v1/customer/auth/session`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Tenant-Id':   shopId,
        },
        ...withTimeout(),
      });
      if (!res.ok) return null;
      return res.json() as Promise<CustomerSessionResponse>;
    } catch {
      return null;
    }
  }
  ```

- [ ] **Step 4: Run the failing test to confirm it now passes**

  ```bash
  cd apps/customer-web && pnpm vitest run test/sign-in-session.test.ts
  ```
  Expected: PASS

- [ ] **Step 5: Rewrite sign-in-page-client.tsx with three tabs**

  Replace the contents of `apps/customer-web/app/sign-in/sign-in-page-client.tsx`:
  ```typescript
  'use client';

  import React, { useEffect, useRef, useState } from 'react';
  import { useRouter } from 'next/navigation';
  import {
    getCustomerAuth,
    getCustomerIdToken,
    createInvisibleRecaptcha,
    sendOtp,
    signInWithGoogle,
    signInWithEmail,
    createEmailAccount,
    sendPasswordReset,
    type ConfirmationResult,
    type RecaptchaVerifier,
  } from '../../src/auth/firebase-customer';
  import { useTenant } from '../TenantContext';
  import { callCustomerSessionEndpoint } from '../../lib/api';

  function safeReturnTo(raw: string | null): string {
    if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) return raw;
    return '/';
  }

  interface Props { rawReturnTo: string | null }

  type AuthTab = 'phone' | 'google' | 'email';

  export function SignInPageClient({ rawReturnTo }: Props): JSX.Element {
    const router   = useRouter();
    const returnTo = safeReturnTo(rawReturnTo);
    const tenant   = useTenant();

    useEffect(() => {
      if (getCustomerAuth().currentUser) router.replace(returnTo);
    }, [router, returnTo]);

    const [tab,          setTab]          = useState<AuthTab>('phone');
    const [phone,        setPhone]        = useState('');
    const [emailVal,     setEmailVal]     = useState('');
    const [password,     setPassword]     = useState('');
    const [confirmPass,  setConfirmPass]  = useState('');
    const [displayName,  setDisplayName]  = useState('');
    const [isSignUp,     setIsSignUp]     = useState(false);
    const [code,         setCode]         = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
    const [error,        setError]        = useState<string | null>(null);
    const [busy,         setBusy]         = useState(false);
    const [resetSent,    setResetSent]    = useState(false);
    const recaptchaRef = useRef<HTMLDivElement>(null);
    const verifierRef  = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
      if (verifierRef.current !== null || recaptchaRef.current === null) return;
      verifierRef.current = createInvisibleRecaptcha(recaptchaRef.current);
      return () => { verifierRef.current?.clear?.(); verifierRef.current = null; };
    }, []);

    const afterSignIn = async (): Promise<void> => {
      if (tenant?.shopId) {
        const idToken = await getCustomerIdToken();
        if (idToken) await callCustomerSessionEndpoint(idToken, tenant.shopId);
      }
      router.replace(returnTo);
    };

    const handleGoogleSignIn = async (): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        await signInWithGoogle();
        await afterSignIn();
      } catch {
        setError('Google साइन इन विफल। पुनः प्रयास करें।');
      } finally {
        setBusy(false);
      }
    };

    const handleEmailAuth = async (): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        if (isSignUp) {
          if (password !== confirmPass) { setError('पासवर्ड मेल नहीं खाते।'); return; }
          await createEmailAccount(emailVal, password, displayName);
        } else {
          await signInWithEmail(emailVal, password);
        }
        await afterSignIn();
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        const msgs: Record<string, string> = {
          'auth/invalid-credential':   'ईमेल या पासवर्ड गलत है।',
          'auth/email-already-in-use': 'यह ईमेल पहले से पंजीकृत है।',
          'auth/weak-password':        'पासवर्ड कम से कम 8 अक्षर का होना चाहिए।',
        };
        setError(msgs[code] ?? 'एक त्रुटि हुई। पुनः प्रयास करें।');
      } finally {
        setBusy(false);
      }
    };

    const handleSend = async (): Promise<void> => {
      if (busy || !verifierRef.current) return;
      setBusy(true);
      setError(null);
      try {
        setConfirmation(await sendOtp(phone, verifierRef.current));
      } catch {
        setError('OTP नहीं भेज पाए। नंबर जाँचें या कुछ देर बाद फिर कोशिश करें।');
      } finally {
        setBusy(false);
      }
    };

    const handleConfirm = async (): Promise<void> => {
      if (busy || confirmation === null) return;
      setBusy(true);
      setError(null);
      try {
        await confirmation.confirm(code);
        await afterSignIn();
      } catch {
        setError('OTP गलत है। कृपया फिर कोशिश करें।');
      } finally {
        setBusy(false);
      }
    };

    const handleForgotPassword = async (): Promise<void> => {
      if (!emailVal) { setError('पहले ईमेल दर्ज करें।'); return; }
      setBusy(true);
      setError(null);
      try {
        await sendPasswordReset(emailVal);
        setResetSent(true);
      } catch {
        setError('रीसेट ईमेल नहीं भेज पाए।');
      } finally {
        setBusy(false);
      }
    };

    const btnCls = 'mt-4 w-full rounded-md bg-primary text-white px-4 py-3 font-semibold min-h-[48px] disabled:opacity-50';
    const inputCls = 'w-full rounded-md border border-borderSubtle px-3 py-2 min-h-[44px] text-base mt-2';

    return (
      <main className="mx-auto max-w-md px-4 py-10 md:py-14 font-prose">
        <h1 className="font-heading text-2xl text-ink mb-4">साइन इन करें</h1>

        {/* Tab switcher */}
        <div className="flex border-b border-borderSubtle mb-6" role="tablist">
          {([['phone', 'मोबाइल OTP'], ['google', 'Google'], ['email', 'ईमेल']] as const).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setError(null); setResetSent(false); setConfirmation(null); }}
              className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? 'border-primary text-ink' : 'border-transparent text-inkMute'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Phone OTP tab ──────────────────────────────────────────────── */}
        {tab === 'phone' && (
          <>
            {confirmation === null ? (
              <>
                <label htmlFor="phone" className="block text-sm font-semibold text-ink">मोबाइल नंबर</label>
                <input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone}
                  onChange={(e) => setPhone(e.target.value.trim())} className={inputCls} />
                <button type="button" onClick={() => void handleSend()}
                  disabled={busy || !/^\+?\d{10,15}$/.test(phone)} className={btnCls}>
                  {busy ? 'भेजा जा रहा है...' : 'OTP भेजें'}
                </button>
              </>
            ) : (
              <>
                <label htmlFor="otpCode" className="block text-sm font-semibold text-ink">OTP कोड</label>
                <input id="otpCode" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.trim())} className={`${inputCls} tracking-widest`} />
                <button type="button" onClick={() => void handleConfirm()}
                  disabled={busy || code.length !== 6} className={btnCls}>
                  {busy ? 'जाँचा जा रहा है...' : 'पुष्टि करें'}
                </button>
                <button type="button" onClick={() => { setConfirmation(null); setCode(''); setError(null); }}
                  disabled={busy} className="mt-3 w-full rounded-md border border-borderSubtle text-ink px-4 py-3 min-h-[48px] disabled:opacity-50">
                  नया OTP भेजें
                </button>
              </>
            )}
          </>
        )}

        {/* ── Google Sign-In tab ─────────────────────────────────────────── */}
        {tab === 'google' && (
          <div className="flex flex-col items-center py-4">
            <p className="text-sm text-inkMute mb-6">Google खाते से जारी रखें</p>
            <button type="button" onClick={() => void handleGoogleSignIn()} disabled={busy}
              className="w-full rounded-md border border-borderSubtle bg-white text-ink px-4 py-3 font-semibold min-h-[48px] flex items-center justify-center gap-3 disabled:opacity-50">
              {busy ? 'जारी है...' : <><span className="font-bold">G</span> Google से जारी रखें</>}
            </button>
          </div>
        )}

        {/* ── Email/Password tab ─────────────────────────────────────────── */}
        {tab === 'email' && (
          <>
            {resetSent ? (
              <p role="alert" className="text-sm text-green-700 mb-4">रीसेट ईमेल भेज दिया गया। इनबॉक्स जाँचें।</p>
            ) : null}

            <div className="flex gap-4 mb-4">
              <button type="button" onClick={() => { setIsSignUp(false); setError(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-semibold border ${!isSignUp ? 'bg-ink text-white border-ink' : 'border-borderSubtle text-inkMute'}`}>
                साइन इन
              </button>
              <button type="button" onClick={() => { setIsSignUp(true); setError(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-semibold border ${isSignUp ? 'bg-ink text-white border-ink' : 'border-borderSubtle text-inkMute'}`}>
                खाता बनाएं
              </button>
            </div>

            {isSignUp && (
              <>
                <label htmlFor="displayName" className="block text-sm font-semibold text-ink">नाम</label>
                <input id="displayName" type="text" placeholder="आपका नाम" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
              </>
            )}

            <label htmlFor="emailInput" className="block text-sm font-semibold text-ink mt-2">ईमेल</label>
            <input id="emailInput" type="email" autoComplete="email" placeholder="आपका ईमेल" value={emailVal}
              onChange={(e) => setEmailVal(e.target.value.trim())} className={inputCls} />

            <label htmlFor="passwordInput" className="block text-sm font-semibold text-ink mt-2">पासवर्ड</label>
            <input id="passwordInput" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="8+ अक्षर" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />

            {isSignUp && (
              <>
                <label htmlFor="confirmPass" className="block text-sm font-semibold text-ink mt-2">पासवर्ड पुनः दर्ज करें</label>
                <input id="confirmPass" type="password" autoComplete="new-password" placeholder="पासवर्ड पुनः दर्ज करें"
                  value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className={inputCls} />
              </>
            )}

            <button type="button" onClick={() => void handleEmailAuth()} disabled={busy} className={btnCls}>
              {busy ? 'जारी है...' : (isSignUp ? 'खाता बनाएं' : 'साइन इन')}
            </button>

            {!isSignUp && (
              <button type="button" onClick={() => void handleForgotPassword()} disabled={busy}
                className="mt-3 w-full text-sm text-accent underline text-center min-h-[44px] disabled:opacity-50">
                पासवर्ड भूल गए?
              </button>
            )}
          </>
        )}

        {error !== null && <p role="alert" className="mt-3 text-sm text-[#8C2A1E]">{error}</p>}
        <div ref={recaptchaRef} aria-hidden="true" />
      </main>
    );
  }
  ```

- [ ] **Step 6: Run typecheck on customer-web**

  ```bash
  cd apps/customer-web && pnpm typecheck
  ```
  Expected: 0 new errors

- [ ] **Step 7: Run web tests**

  ```bash
  cd apps/customer-web && pnpm test
  ```
  Expected: all tests pass (including the new session endpoint test)

- [ ] **Step 8: Commit**

  ```bash
  git add apps/customer-web/src/auth/firebase-customer.ts \
          apps/customer-web/app/sign-in/sign-in-page-client.tsx \
          apps/customer-web/lib/api.ts \
          apps/customer-web/test/sign-in-session.test.ts
  git commit -m "feat(customer-web): Google + email/password sign-in; session endpoint called after auth"
  ```

---

## Task 13: Gate — typecheck + lint + tests + Codex + security review

**Files:** None (gate step)

- [ ] **Step 1: Full typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 errors

- [ ] **Step 2: Full lint**

  ```bash
  pnpm lint
  ```
  Expected: 0 errors or warnings

- [ ] **Step 3: Full test suite**

  ```bash
  pnpm test:ci
  ```
  Expected: all tests pass (typecheck + lint + unit + integration + tenant-isolation + semgrep + docs:validate)

- [ ] **Step 4: Semgrep**

  ```bash
  pnpm semgrep
  ```
  Expected: 0 new findings. Check specifically: no `email` or `phone` appearing in error responses that would enable enumeration attacks.

- [ ] **Step 5: Security review**

  Run `/security-review` on the following files (Class A gate):
  - `apps/api/src/modules/customer/customer-session.service.ts`
  - `apps/api/src/modules/customer/customer-session.controller.ts`
  - `apps/api/src/modules/customer/customer-auth.guard.ts`
  - `packages/db/src/migrations/0076_customers_auth_identity.sql`
  
  Fix all P1 and P2 findings before proceeding.

- [ ] **Step 6: Codex review**

  ```bash
  codex review --base main
  ```
  Fix all P1 and P2 findings. Write marker:
  ```bash
  echo "reviewed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .codex-review-passed
  echo "reviewed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .security-review-passed
  git add .codex-review-passed .security-review-passed
  git commit -m "chore: codex + security review markers for multi-provider auth"
  ```

- [ ] **Step 7: Mobile smoke tests (mandatory before merge)**

  On device or emulator:
  - Phone OTP sign-in → still works, customer record found, no regression
  - Google Sign-In → customer record created → subsequent API call succeeds
  - Email sign-up → new customer → `isNewOAuth = true` if no phone number
  
  Document any failures as blockers — do NOT merge until smoke passes.

- [ ] **Step 8: Web smoke tests**

  In browser at `http://localhost:3000/sign-in`:
  - Phone OTP tab → OTP flow → session endpoint called → customer provisioned
  - Google tab → popup → session endpoint called → redirected to returnTo
  - Email tab → sign-up + sign-in → session endpoint called → success

- [ ] **Step 9: Regenerate agent-context JSONs**

  ```bash
  pnpm docs:context
  pnpm docs:validate
  git add docs/agent-context/
  git commit -m "chore: regenerate agent-context after multi-provider auth story"
  ```

- [ ] **Step 10: Push and open PR**

  ```bash
  git push -u origin feat/customer-multi-provider-auth
  ```
  Open PR targeting `main`. Title: "feat(customer-auth): add Google + email/password auth (Story 19.9)"

---

## Pre-PR Checklist

- [ ] `pnpm typecheck` green
- [ ] `pnpm lint` green
- [ ] `pnpm test:ci` green (tenant-isolation suite included)
- [ ] Codex review clean (`.codex-review-passed` marker written)
- [ ] Security review clean (`.security-review-passed` marker written)
- [ ] Mobile smoke: Google Sign-In → customer record created → subsequent API call succeeds
- [ ] Mobile smoke: Email sign-up → new customer → isNewOAuth flag set
- [ ] Mobile smoke: Phone OTP — no regression
- [ ] Web smoke: Google Sign-In popup → session established
- [ ] Web smoke: Email sign-in and sign-up
- [ ] Web smoke: Phone OTP — no regression
- [ ] Firebase Console: Email/Password + Google providers both show as enabled
- [ ] Migration 0076 applied to dev DB (or CI runs against fresh schema)
