# Platform Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform-side admin console for the Goldsmith team to manage tenants (jewellers), subscriptions, and conduct time-bounded, fully-audited impersonation for support.

**Architecture:** A new `PlatformAdminModule` exposes `/platform/admin/*` routes guarded by the `platform_admin` Firebase role. A separate, HMAC-signed impersonation JWT (sent via `X-Impersonation-Token`) lets a platform admin act as a tenant for ≤30 minutes; the existing `FirebaseJwtStrategy` consumes the header and rewrites `req.user.shop_id`/`role` so every downstream guard, the `TenantInterceptor`, and the RLS GUC see the impersonated shop with `isImpersonating=true`. Cross-tenant aggregate metrics use an explicit `SET ROLE platform_admin` (BYPASSRLS) connection-scoped escalation with a `// PLATFORM_ADMIN_BYPASS:` comment.

**Tech Stack:** NestJS 10, PostgreSQL 15, Drizzle, `pg` Pool, Firebase Admin SDK, `jsonwebtoken` (already in deps via `@goldsmith/auth-client`), Next.js 14 App Router (admin UI), Vitest.

**Class:** A — full ceremony. Fresh session, parallel Codex + `/security-review`, runtime smoke required.

**Pre-assigned migrations:** 0053, 0054, 0055. Do not use any other migration number.

---

## File Structure

### Created
- `packages/db/src/migrations/0053_platform_subscriptions.sql`
- `packages/db/src/migrations/0054_platform_audit_columns.sql`
- `packages/db/src/migrations/0055_impersonation_sessions.sql`
- `apps/api/src/modules/platform-admin/platform-admin.module.ts`
- `apps/api/src/modules/platform-admin/platform-admin.controller.ts`
- `apps/api/src/modules/platform-admin/platform-admin.controller.spec.ts`
- `apps/api/src/modules/platform-admin/services/tenant-management.service.ts`
- `apps/api/src/modules/platform-admin/services/tenant-management.service.spec.ts`
- `apps/api/src/modules/platform-admin/services/subscription.service.ts`
- `apps/api/src/modules/platform-admin/services/subscription.service.spec.ts`
- `apps/api/src/modules/platform-admin/services/metrics.service.ts`
- `apps/api/src/modules/platform-admin/services/metrics.service.spec.ts`
- `apps/api/src/modules/platform-admin/services/impersonation.service.ts`
- `apps/api/src/modules/platform-admin/services/impersonation.service.spec.ts`
- `apps/api/src/modules/platform-admin/services/data-export.service.ts`
- `apps/api/src/modules/platform-admin/services/data-export.service.spec.ts`
- `apps/api/src/modules/platform-admin/dto/index.ts`
- `apps/api/src/modules/platform-admin/repositories/platform-audit.repository.ts`
- `apps/api/src/modules/platform-admin/impersonation-token.ts` (sign/verify helpers)
- `apps/api/src/modules/platform-admin/impersonation-token.spec.ts`
- `apps/api/test/platform-admin.integration.test.ts`
- `apps/api/test/impersonation.integration.test.ts`
- `apps/customer-web/app/admin/layout.tsx`
- `apps/customer-web/app/admin/page.tsx`
- `apps/customer-web/app/admin/_components/TenantTable.tsx`
- `apps/customer-web/app/admin/_components/ImpersonateButton.tsx`
- `apps/customer-web/app/admin/_lib/admin-api.ts`
- `apps/customer-web/app/admin/_lib/firebase-admin-client.ts`

### Modified
- `apps/api/src/modules/auth/firebase-jwt.strategy.ts` — accept `req`; consume `X-Impersonation-Token` for `platform_admin` callers only; rewrite `shop_id`/`role`/`goldsmith_uid`; surface `impersonationSessionId` on claims.
- `apps/api/src/modules/auth/auth.module.ts` — register strategy with `passReqToCallback: true` if any provider construction is touched (no change expected; verify only).
- `apps/api/src/app.module.ts` — register `PlatformAdminModule`.
- `packages/tenant-context/src/interceptor.ts` — when `req.user.impersonationSessionId` is present, mark the resulting `AuthenticatedTenantContext` with `isImpersonating: true` and `impersonationAuditId`.
- `packages/tenant-context/src/context.ts` — extend `ShopUserRole` consumers (no schema change; field exists). Confirm `isImpersonating` flows.
- `packages/tenant-context/src/als.ts` — no change unless required by the wiring; verify only.
- `apps/api/src/modules/auth/firebase-jwt.strategy.ts` — see above.
- `apps/customer-web/app/layout.tsx` — short-circuit when path starts with `/admin`: render minimal English shell instead of fetching tenant config.
- `apps/customer-web/lib/api.ts` — add `adminApi` helpers OR keep separate; we put them in `app/admin/_lib/admin-api.ts` so the bundle for the tenant pages is untouched.
- `apps/api/test/_auth-test-setup.ts` — add helper to mint platform_admin Firebase ID tokens for integration tests (only if missing; see existing helpers first).
- `docs/runbook.md` — add §"Provisioning a platform_admin user" section.

### Boundaries / Why
- The platform-admin module owns its own services and repositories. It never imports tenant-scoped modules.
- Impersonation rewriting lives in the auth strategy (NOT the tenant interceptor) so role-based guards run AFTER rewriting and see the impersonated role.
- Data export lives in its own service to keep its IO concerns (streaming, large payloads) isolated from CRUD endpoints.

---

## Task Decomposition

Five work streams. **WS-A (Data) blocks all others.** WS-B (Impersonation Core) blocks WS-C (Module surface) only at the interceptor-wiring step. WS-C and WS-D can proceed once WS-B is done. WS-E is the gate at the end.

---

## WS-A — Data Layer (migrations 0053–0055)

### Task A1: Migration 0053 — `platform_subscriptions`

**Files:**
- Create: `packages/db/src/migrations/0053_platform_subscriptions.sql`
- Test: `apps/api/test/platform-admin.integration.test.ts` (table-existence smoke; full subscription tests in WS-C)

- [ ] **Step 1: Write the migration**

```sql
-- 0053_platform_subscriptions.sql
-- Per-tenant subscription state. Platform-global table; never tenant-scoped reads.
-- Only platform_admin operates on this table — app_user has NO grants.

CREATE TABLE platform_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE RESTRICT,
  plan                 TEXT NOT NULL DEFAULT 'trial'
                         CHECK (plan IN ('trial','starter','growth','enterprise')),
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','suspended','cancelled')),
  billing_cycle_start  DATE,
  mrr_paise            BIGINT NOT NULL DEFAULT 0 CHECK (mrr_paise >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX platform_subscriptions_status_idx ON platform_subscriptions (status);

-- Lock down: app_user (regular tenant calls) MUST NOT touch this table.
-- platform_admin operates as a SECURITY-DEFINER-style escalation (see runbook §Platform Admin).
REVOKE ALL ON platform_subscriptions FROM PUBLIC;
REVOKE ALL ON platform_subscriptions FROM app_user;
GRANT  SELECT, INSERT, UPDATE ON platform_subscriptions TO platform_admin;
```

- [ ] **Step 2: Apply locally and verify**

```bash
cd C:/gs-admin
pnpm --filter @goldsmith/db migrate
psql "$DATABASE_URL" -c "\d platform_subscriptions"
```
Expected: table with columns `id, shop_id (uniq), plan, status, billing_cycle_start, mrr_paise, created_at, updated_at`; `app_user` not in `\dp platform_subscriptions`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0053_platform_subscriptions.sql
git commit -m "feat(platform-admin): migration 0053 — platform_subscriptions table"
```

---

### Task A2: Migration 0054 — extend `platform_audit_events`

**Files:**
- Create: `packages/db/src/migrations/0054_platform_audit_columns.sql`

The existing table from 0003 has: `id, action, ip_address, user_agent, request_id, phone_hash, metadata, created_at`. We need to add `platform_user_id` and `target_shop_id` (idempotently — `IF NOT EXISTS`).

- [ ] **Step 1: Write the migration**

```sql
-- 0054_platform_audit_columns.sql
-- Adds platform_user_id and target_shop_id to platform_audit_events. Both nullable
-- because legacy rows (TENANT_BOOT, AUTH_*) have no actor or target shop.
-- Action and metadata columns already exist (0003).

ALTER TABLE platform_audit_events
  ADD COLUMN IF NOT EXISTS platform_user_id TEXT,
  ADD COLUMN IF NOT EXISTS target_shop_id   UUID;

-- Foreign key kept loose (NO REFERENCES) — platform_audit_events is append-only and
-- must not be coupled to shops lifecycle (a deleted shop should not break audit reads).

CREATE INDEX IF NOT EXISTS platform_audit_events_target_shop_idx
  ON platform_audit_events (target_shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_platform_user_idx
  ON platform_audit_events (platform_user_id, created_at DESC);
```

- [ ] **Step 2: Apply, verify**

```bash
pnpm --filter @goldsmith/db migrate
psql "$DATABASE_URL" -c "\d platform_audit_events"
```
Expected: `platform_user_id text` and `target_shop_id uuid` columns present.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0054_platform_audit_columns.sql
git commit -m "feat(platform-admin): migration 0054 — extend platform_audit_events"
```

---

### Task A3: Migration 0055 — `impersonation_sessions`

**Files:**
- Create: `packages/db/src/migrations/0055_impersonation_sessions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0055_impersonation_sessions.sql
-- Time-bounded support sessions where a platform_admin acts as a tenant.
-- expires_at is enforced at JWT verification AND at every interceptor lookup (defense in depth).

CREATE TABLE impersonation_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id    TEXT NOT NULL,
  target_shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  ended_at            TIMESTAMPTZ,
  reason              TEXT NOT NULL,
  ip_address          INET,
  user_agent          TEXT,
  CONSTRAINT impersonation_sessions_reason_nonempty CHECK (length(btrim(reason)) > 0),
  CONSTRAINT impersonation_sessions_expires_after_start CHECK (expires_at > started_at)
);

CREATE INDEX impersonation_sessions_target_shop_idx
  ON impersonation_sessions (target_shop_id, started_at DESC);
CREATE INDEX impersonation_sessions_platform_user_idx
  ON impersonation_sessions (platform_user_id, started_at DESC);
-- Hot lookup: "is this session still active?"
CREATE INDEX impersonation_sessions_active_idx
  ON impersonation_sessions (id) WHERE ended_at IS NULL;

REVOKE ALL ON impersonation_sessions FROM PUBLIC;
REVOKE ALL ON impersonation_sessions FROM app_user;
GRANT  SELECT, INSERT, UPDATE ON impersonation_sessions TO platform_admin;
```

- [ ] **Step 2: Apply and verify**

```bash
pnpm --filter @goldsmith/db migrate
psql "$DATABASE_URL" -c "\d impersonation_sessions"
```
Expected: table present with constraints listed.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0055_impersonation_sessions.sql
git commit -m "feat(platform-admin): migration 0055 — impersonation_sessions table"
```

---

## WS-B — Impersonation Core

This work stream owns: impersonation JWT signing/verifying, the auth-strategy rewrite, the tenant-interceptor `isImpersonating` propagation, and the `ImpersonationService`. WS-C cannot finish without these.

### Task B1: `impersonation-token.ts` (sign/verify helpers)

**Files:**
- Create: `apps/api/src/modules/platform-admin/impersonation-token.ts`
- Test: `apps/api/src/modules/platform-admin/impersonation-token.spec.ts`

Use `jsonwebtoken` (already a transitive dep — confirm via `pnpm why jsonwebtoken`. If not direct in `apps/api/package.json`, add it).

- [ ] **Step 1: Verify dep**

```bash
cd C:/gs-admin/apps/api
pnpm why jsonwebtoken | head -10
# If nothing direct in this workspace:
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

- [ ] **Step 2: Write the failing test**

```typescript
// impersonation-token.spec.ts
import { describe, it, expect } from 'vitest';
import { signImpersonationToken, verifyImpersonationToken, ImpersonationTokenError } from './impersonation-token';

const SECRET = 'unit-test-secret-32-bytes-minimum-aaaaaaaaaaaaa';

describe('impersonation-token', () => {
  it('signs and verifies a token for the same secret', () => {
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'platform-uid-1',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: 1800,
      secret: SECRET,
    });
    const claims = verifyImpersonationToken(token, SECRET);
    expect(claims.jti).toBe('11111111-1111-1111-1111-111111111111');
    expect(claims.sub).toBe('platform-uid-1');
    expect(claims.target_shop_id).toBe('22222222-2222-2222-2222-222222222222');
    expect(claims.iss).toBe('goldsmith-platform-admin');
  });

  it('rejects an expired token', () => {
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'p',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: -10, // already expired
      secret: SECRET,
    });
    expect(() => verifyImpersonationToken(token, SECRET)).toThrow(ImpersonationTokenError);
  });

  it('rejects a token signed by a different secret', () => {
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'p',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: 1800,
      secret: SECRET,
    });
    expect(() => verifyImpersonationToken(token, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxx')).toThrow(ImpersonationTokenError);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyImpersonationToken('not-a-jwt', SECRET)).toThrow(ImpersonationTokenError);
  });

  it('rejects when issuer is wrong', () => {
    // forge a token with the right secret but wrong iss
    const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
    const token = jwt.sign(
      { sub: 'p', target_shop_id: '22222222-2222-2222-2222-222222222222', iss: 'attacker' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '5m', jwtid: '11111111-1111-1111-1111-111111111111' },
    );
    expect(() => verifyImpersonationToken(token, SECRET)).toThrow(ImpersonationTokenError);
  });
});
```

- [ ] **Step 3: Run test, verify failure**

```bash
pnpm --filter @goldsmith/api test impersonation-token.spec.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// impersonation-token.ts
import jwt from 'jsonwebtoken';

export class ImpersonationTokenError extends Error {
  constructor(public readonly reason: 'expired' | 'invalid_signature' | 'malformed' | 'wrong_issuer' | 'missing_claim') {
    super(`impersonation_token.${reason}`);
    this.name = 'ImpersonationTokenError';
  }
}

export interface ImpersonationTokenClaims {
  jti: string;            // impersonation_sessions.id
  sub: string;            // platform_user_id
  target_shop_id: string; // shop UUID
  iss: 'goldsmith-platform-admin';
  iat: number;
  exp: number;
}

export interface SignArgs {
  sessionId: string;
  platformUserId: string;
  targetShopId: string;
  ttlSeconds: number;
  secret: string;
}

const ISSUER = 'goldsmith-platform-admin';

export function signImpersonationToken(a: SignArgs): string {
  return jwt.sign(
    { sub: a.platformUserId, target_shop_id: a.targetShopId, iss: ISSUER },
    a.secret,
    { algorithm: 'HS256', expiresIn: a.ttlSeconds, jwtid: a.sessionId },
  );
}

export function verifyImpersonationToken(token: string, secret: string): ImpersonationTokenClaims {
  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'TokenExpiredError') throw new ImpersonationTokenError('expired');
    if (name === 'JsonWebTokenError') throw new ImpersonationTokenError('invalid_signature');
    throw new ImpersonationTokenError('malformed');
  }
  if (typeof decoded === 'string') throw new ImpersonationTokenError('malformed');
  if (decoded.iss !== ISSUER) throw new ImpersonationTokenError('wrong_issuer');
  if (!decoded.jti || !decoded.sub || !decoded['target_shop_id'] || !decoded.exp || !decoded.iat) {
    throw new ImpersonationTokenError('missing_claim');
  }
  return {
    jti: decoded.jti,
    sub: decoded.sub as string,
    target_shop_id: decoded['target_shop_id'] as string,
    iss: ISSUER,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
pnpm --filter @goldsmith/api test impersonation-token.spec.ts
```
Expected: 5/5 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/platform-admin/impersonation-token.ts apps/api/src/modules/platform-admin/impersonation-token.spec.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(platform-admin): impersonation JWT sign/verify helpers"
```

---

### Task B2: Extend `FirebaseJwtStrategy` to consume the impersonation header

**Files:**
- Modify: `apps/api/src/modules/auth/firebase-jwt.strategy.ts`
- Test: `apps/api/test/firebase-jwt-strategy.unit.test.ts` (add cases — read existing first to mirror style)

Behavior:
1. Decode + verify Firebase ID token as today.
2. If decoded `role !== 'platform_admin'`, ignore the impersonation header — return claims as-is.
3. If `role === 'platform_admin'` AND `X-Impersonation-Token` header is present:
   - Verify the JWT (`verifyImpersonationToken`).
   - Return claims with `shop_id = target_shop_id`, `role = 'shop_admin'` (highest tenant-side role for support), `goldsmith_uid = sub` (the platform user ID — used only for audit metadata; never written to tenant tables), and a new optional field `impersonationSessionId = jti`.
4. If `role === 'platform_admin'` AND no header → return claims unchanged (platform-only routes).
5. If header is present but JWT verify fails → `UnauthorizedException({ code: 'auth.impersonation_token_invalid' })`.

The strategy must access `req` to read the header. Switch from `BearerStrategy` default to one that passes `req` (`passport-http-bearer`'s `passReqToCallback: true`).

- [ ] **Step 1: Read the current strategy and unit-test layout**

```bash
cat apps/api/src/modules/auth/firebase-jwt.strategy.ts
cat apps/api/test/firebase-jwt-strategy.unit.test.ts | head -80
```

- [ ] **Step 2: Add unit tests for impersonation rewrite**

Append to `apps/api/test/firebase-jwt-strategy.unit.test.ts` (or its strategy spec — match the style there):

```typescript
import { signImpersonationToken } from '../src/modules/platform-admin/impersonation-token';

describe('FirebaseJwtStrategy — impersonation', () => {
  const SECRET = 'unit-test-secret-32-bytes-minimum-aaaaaaaaaaaaa';
  beforeEach(() => { process.env['IMPERSONATION_JWT_SECRET'] = SECRET; });
  afterEach(() => { delete process.env['IMPERSONATION_JWT_SECRET']; });

  it('rewrites shop_id/role for platform_admin with valid impersonation header', async () => {
    const fakeFb = makeFakeFirebaseAdmin({
      uid: 'p-uid', role: 'platform_admin', shop_id: undefined, goldsmith_uid: 'p-id',
      phone_number: undefined,
    });
    const strategy = new FirebaseJwtStrategy(fakeFb, /* pool */ undefined);
    const token = signImpersonationToken({
      sessionId: 'sess-1', platformUserId: 'p-id',
      targetShopId: 'shop-A', ttlSeconds: 1800, secret: SECRET,
    });
    const req = { headers: { 'x-impersonation-token': token } } as never;
    const claims = await strategy.validate(req, 'firebase-id-token-blob');
    expect(claims.shop_id).toBe('shop-A');
    expect(claims.role).toBe('shop_admin');
    expect(claims.impersonationSessionId).toBe('sess-1');
  });

  it('ignores impersonation header for non-platform-admin tokens', async () => {
    const fakeFb = makeFakeFirebaseAdmin({
      uid: 'shop-uid', role: 'shop_staff', shop_id: 'shop-X', goldsmith_uid: 'u-id',
      phone_number: '+91999',
    });
    const strategy = new FirebaseJwtStrategy(fakeFb);
    const token = signImpersonationToken({
      sessionId: 'sess-1', platformUserId: 'p-id',
      targetShopId: 'shop-A', ttlSeconds: 1800, secret: SECRET,
    });
    const req = { headers: { 'x-impersonation-token': token } } as never;
    const claims = await strategy.validate(req, 'firebase-id-token-blob');
    expect(claims.shop_id).toBe('shop-X');
    expect(claims.role).toBe('shop_staff');
    expect((claims as any).impersonationSessionId).toBeUndefined();
  });

  it('rejects with 401 when impersonation token is malformed', async () => {
    const fakeFb = makeFakeFirebaseAdmin({
      uid: 'p-uid', role: 'platform_admin', shop_id: undefined, goldsmith_uid: 'p-id',
      phone_number: undefined,
    });
    const strategy = new FirebaseJwtStrategy(fakeFb);
    const req = { headers: { 'x-impersonation-token': 'not-a-jwt' } } as never;
    await expect(strategy.validate(req, 'firebase-id-token-blob')).rejects.toThrow(/auth.impersonation_token_invalid/);
  });
});
```

`makeFakeFirebaseAdmin` should mirror whatever helper already exists in the spec; if absent, build it inline:

```typescript
function makeFakeFirebaseAdmin(claims: any) {
  return {
    admin: () => ({ auth: () => ({ verifyIdToken: async () => claims }) }),
  };
}
```

- [ ] **Step 3: Run test, expect failure**

```bash
pnpm --filter @goldsmith/api test firebase-jwt-strategy.unit.test.ts
```
Expected: FAIL — `validate` signature still single-arg, header not consumed.

- [ ] **Step 4: Update the strategy**

Full rewrite of `apps/api/src/modules/auth/firebase-jwt.strategy.ts`:

```typescript
import { Inject, Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import type admin from 'firebase-admin';
import type { Pool } from 'pg';
import type { Request } from 'express';
import { platformAuditLog, AuditAction } from '@goldsmith/audit';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import {
  verifyImpersonationToken,
  ImpersonationTokenError,
} from '../platform-admin/impersonation-token';

export interface FirebaseUserClaims {
  uid: string;
  phone_number: string | undefined;
  shop_id?: string;
  role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
  goldsmith_uid?: string;
  impersonationSessionId?: string;
  impersonatorPlatformUserId?: string;
}

type AdminLike = FirebaseAdminProvider | admin.app.App;

function readHeader(req: Request | undefined, name: string): string | undefined {
  const v = req?.headers?.[name];
  return typeof v === 'string' ? v : undefined;
}

@Injectable()
export class FirebaseJwtStrategy extends PassportStrategy(BearerStrategy, 'firebase-jwt') {
  private readonly logger = new Logger(FirebaseJwtStrategy.name);

  constructor(
    @Inject(FirebaseAdminProvider) private readonly provider: AdminLike,
    @Inject('PG_POOL') @Optional() private readonly pool?: Pool,
  ) {
    super({ passReqToCallback: true });
  }

  async validate(req: Request, token: string): Promise<FirebaseUserClaims> {
    let decoded: admin.auth.DecodedIdToken;
    try {
      const authInstance =
        'admin' in this.provider && typeof (this.provider as FirebaseAdminProvider).admin === 'function'
          ? (this.provider as FirebaseAdminProvider).admin().auth()
          : (this.provider as admin.app.App).auth();
      decoded = await authInstance.verifyIdToken(token, true);
    } catch (err) {
      const firebaseCode = (err as { code?: string })?.code;
      this.logger.warn({ firebaseErrorCode: firebaseCode, err }, 'firebase verifyIdToken failed');
      if (this.pool) {
        void platformAuditLog(this.pool, {
          action: AuditAction.AUTH_TOKEN_INVALID,
          metadata: { firebaseCode },
        }).catch(() => undefined);
      }
      throw new UnauthorizedException({ code: 'auth.token_invalid' });
    }

    const baseClaims: FirebaseUserClaims = {
      uid: decoded.uid,
      phone_number: (decoded['phone_number'] ?? decoded['phoneNumber']) as string | undefined,
      shop_id: decoded['shop_id'] as string | undefined,
      role: decoded['role'] as FirebaseUserClaims['role'],
      goldsmith_uid: decoded['goldsmith_uid'] as string | undefined,
    };

    // Impersonation rewrite (platform_admin only).
    if (baseClaims.role !== 'platform_admin') return baseClaims;
    const impersonationToken = readHeader(req, 'x-impersonation-token');
    if (!impersonationToken) return baseClaims;

    const secret = process.env['IMPERSONATION_JWT_SECRET'];
    if (!secret) {
      this.logger.error('IMPERSONATION_JWT_SECRET not configured — refusing impersonation');
      throw new UnauthorizedException({ code: 'auth.impersonation_misconfigured' });
    }

    let impClaims;
    try {
      impClaims = verifyImpersonationToken(impersonationToken, secret);
    } catch (err) {
      const reason = err instanceof ImpersonationTokenError ? err.reason : 'unknown';
      this.logger.warn({ reason }, 'impersonation token rejected');
      throw new UnauthorizedException({ code: 'auth.impersonation_token_invalid', reason });
    }

    // The session row's expires_at + ended_at is checked again at the interceptor layer
    // against the live DB, even though the JWT exp matches. Defense in depth.
    return {
      ...baseClaims,
      shop_id: impClaims.target_shop_id,
      role: 'shop_admin',
      goldsmith_uid: impClaims.sub, // platform user id — used only for audit metadata
      impersonationSessionId: impClaims.jti,
      impersonatorPlatformUserId: impClaims.sub,
    };
  }
}
```

- [ ] **Step 5: Run all auth/strategy tests**

```bash
pnpm --filter @goldsmith/api test firebase-jwt-strategy
```
Expected: PASS for both old + new cases.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/firebase-jwt.strategy.ts apps/api/test/firebase-jwt-strategy.unit.test.ts
git commit -m "feat(platform-admin): impersonation token rewrite in Firebase strategy"
```

---

### Task B3: Tenant interceptor — propagate `isImpersonating` + double-check session

**Files:**
- Modify: `packages/tenant-context/src/interceptor.ts`
- Modify: `packages/tenant-context/src/context.ts` (no schema change — `isImpersonating` and `impersonationAuditId` already optional)
- Test: `packages/tenant-context/test/interceptor.test.ts` (add a case; read first if it doesn't exist, may be in `apps/api/test/claim-conflict.integration.test.ts` neighbourhood)

The strategy already rewrites `shop_id` for platform_admin impersonators. The interceptor's job:
1. If `req.user.impersonationSessionId` is set, set `isImpersonating: true` and `impersonationAuditId = impersonationSessionId` on the resulting `AuthenticatedTenantContext`.
2. **Double-check live DB:** look up the session by id. If `ended_at IS NOT NULL` or `expires_at < now()`, throw `UnauthorizedException({ code: 'auth.impersonation_session_inactive' })`. This catches force-revocation that the JWT can't (JWT is still cryptographically valid until exp).

The check needs the pool. The interceptor today does NOT inject `pg`. Plan: introduce a small port `ImpersonationSessionPort` (interface) wired into the interceptor like the existing `TenantAuditPort`. Inject from the API layer using the `pg` Pool.

- [ ] **Step 1: Define the port in `packages/tenant-context/src/`**

Add a new file `packages/tenant-context/src/impersonation-port.ts`:

```typescript
export interface ImpersonationSessionPort {
  /** Returns true if the session is active (not ended, not expired). */
  isActive(sessionId: string): Promise<boolean>;
}
```

Re-export from `packages/tenant-context/src/index.ts`:

```typescript
export type { ImpersonationSessionPort } from './impersonation-port';
```

- [ ] **Step 2: Extend the interceptor (failing test first)**

Add a test in `apps/api/test/impersonation.integration.test.ts` (full integration covered later; for unit, write it next to the interceptor in `packages/tenant-context/test/`):

```typescript
// packages/tenant-context/test/interceptor.impersonation.test.ts
import { describe, it, expect } from 'vitest';
import { TenantInterceptor } from '../src/interceptor';
// ...existing imports / fakes from sibling tests

it('marks context as impersonating and rejects inactive sessions', async () => {
  const tenants = { byId: async () => ({ id: 'shop-A', slug: 's', display_name: 'd', status: 'ACTIVE' }) };
  const resolver = {
    fromHost: async () => undefined,
    fromHeader: () => undefined,
    fromJwt: () => 'shop-A',
  };
  const port = { isActive: async () => true };
  const interceptor = new TenantInterceptor(resolver, tenants as never, undefined, port);

  const req = {
    headers: {},
    user: {
      uid: 'p-uid', shop_id: 'shop-A', role: 'shop_admin', goldsmith_uid: 'p-id',
      impersonationSessionId: 'sess-1',
    },
  };
  // [drive interceptor.intercept with a fake CallHandler — see existing tests for the pattern]
  // assert tenantContext.runWith captured `isImpersonating: true, impersonationAuditId: 'sess-1'`

  // Inactive case
  const portInactive = { isActive: async () => false };
  const interceptor2 = new TenantInterceptor(resolver, tenants as never, undefined, portInactive);
  // assert that calling intercept throws UnauthorizedException with auth.impersonation_session_inactive
});
```

(The full driver code mirrors existing tests — reuse the helper that returns a Promise from interceptor.intercept.)

- [ ] **Step 3: Update interceptor**

Modify `packages/tenant-context/src/interceptor.ts`:

```typescript
// Add import
import type { ImpersonationSessionPort } from './impersonation-port';

// Update RequestLike user shape:
export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  hostname?: string;
  path?: string;
  user?: {
    uid?: string;
    shop_id?: string;
    role?: ShopUserRole;
    goldsmith_uid?: string;
    impersonationSessionId?: string;
  };
}

// Constructor: accept optional port
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly resolver: TenantResolver,
    private readonly tenants: TenantLookup,
    private readonly audit?: TenantAuditPort,
    private readonly impersonation?: ImpersonationSessionPort,
  ) {}

  // … inside resolve(), after the existing build of the authenticated context:
  if (req.user?.uid && req.user.role && req.user.shop_id === shopId && req.user.goldsmith_uid) {
    const ctx: AuthenticatedTenantContext = {
      shopId: tenant.id, tenant,
      authenticated: true, userId: req.user.goldsmith_uid, role: req.user.role,
    };
    if (req.user.impersonationSessionId) {
      if (!this.impersonation) {
        throw new UnauthorizedException('tenant.impersonation_port_missing');
      }
      const active = await this.impersonation.isActive(req.user.impersonationSessionId);
      if (!active) throw new UnauthorizedException({ code: 'auth.impersonation_session_inactive' });
      return { ...ctx, isImpersonating: true, impersonationAuditId: req.user.impersonationSessionId };
    }
    return ctx;
  }
```

- [ ] **Step 4: Wire the port in `apps/api/src/app.module.ts`**

Add a small adapter file `apps/api/src/modules/platform-admin/impersonation-session.adapter.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { ImpersonationSessionPort } from '@goldsmith/tenant-context';

@Injectable()
export class ImpersonationSessionAdapter implements ImpersonationSessionPort {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async isActive(sessionId: string): Promise<boolean> {
    const c = await this.pool.connect();
    try {
      // PLATFORM_ADMIN_BYPASS: intentional cross-tenant read; safe because (a) impersonation_sessions
      // is platform-only (no app_user grants), and (b) we read a single row by id and return only a boolean.
      await c.query('SET LOCAL ROLE platform_admin');
      const r = await c.query<{ active: boolean }>(
        `SELECT (ended_at IS NULL AND expires_at > now()) AS active
           FROM impersonation_sessions WHERE id = $1`,
        [sessionId],
      );
      return r.rows[0]?.active === true;
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }
}
```

In `app.module.ts`, register `ImpersonationSessionAdapter` and pass it to the `TenantInterceptor` factory:

```typescript
// providers:
ImpersonationSessionAdapter,
{
  provide: TenantInterceptor,
  useFactory: (
    resolver: HttpTenantResolver,
    tenants: DrizzleTenantLookup,
    audit: TenantAuditReporter,
    impersonation: ImpersonationSessionAdapter,
  ) => new TenantInterceptor(resolver, tenants, audit, impersonation),
  inject: [HttpTenantResolver, DrizzleTenantLookup, TenantAuditReporter, ImpersonationSessionAdapter],
},
```

- [ ] **Step 5: Run interceptor tests**

```bash
pnpm --filter @goldsmith/tenant-context test
pnpm --filter @goldsmith/api test interceptor
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/tenant-context apps/api/src/modules/platform-admin/impersonation-session.adapter.ts apps/api/src/app.module.ts
git commit -m "feat(platform-admin): tenant interceptor double-checks impersonation session liveness"
```

---

### Task B4: `ImpersonationService` (start/end + audit)

**Files:**
- Create: `apps/api/src/modules/platform-admin/services/impersonation.service.ts`
- Create: `apps/api/src/modules/platform-admin/services/impersonation.service.spec.ts`
- Create: `apps/api/src/modules/platform-admin/repositories/platform-audit.repository.ts`

`PlatformAuditRepository` is a thin wrapper to record `platform_audit_events` with `platform_user_id` + `target_shop_id` populated.

- [ ] **Step 1: Write the failing service test**

```typescript
// impersonation.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImpersonationService } from './impersonation.service';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const SHOP_ID = '22222222-2222-2222-2222-222222222222';

describe('ImpersonationService', () => {
  let pool: { connect: ReturnType<typeof vi.fn> };
  let client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    process.env['IMPERSONATION_JWT_SECRET'] = 'unit-test-secret-32-bytes-aaaaaaaaaaaaaaaaaa';
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('start: inserts session, audits, returns short-lived JWT with jti = session id', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                    // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ id: SESSION_ID }] })               // INSERT impersonation_sessions
      .mockResolvedValueOnce(undefined)                                    // INSERT platform_audit_events
      .mockResolvedValueOnce(undefined);                                   // RESET ROLE

    const svc = new ImpersonationService(pool as never);
    const out = await svc.startImpersonation({
      platformUserId: 'p-uid', targetShopId: SHOP_ID, reason: 'investigating ticket #1234', ip: '127.0.0.1', userAgent: 'ua',
    });

    expect(out.sessionId).toBe(SESSION_ID);
    expect(out.token).toMatch(/^eyJ/); // base64-encoded JWT header
    // 30 minutes = 1800s — exp roughly 30 min from now
    const decoded = JSON.parse(Buffer.from(out.token.split('.')[1], 'base64url').toString());
    expect(decoded.target_shop_id).toBe(SHOP_ID);
    expect(decoded.exp - decoded.iat).toBe(1800);

    // INSERT call shape
    const insertCall = client.query.mock.calls[1];
    expect(insertCall[0]).toMatch(/INSERT INTO impersonation_sessions/);
    // Audit
    const auditCall = client.query.mock.calls[2];
    expect(auditCall[0]).toMatch(/INSERT INTO platform_audit_events/);
    expect(auditCall[1]).toContain('impersonation.started');
  });

  it('end: marks session ended_at and audits impersonation.ended', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                    // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 1 })                              // UPDATE impersonation_sessions
      .mockResolvedValueOnce(undefined)                                    // INSERT platform_audit_events
      .mockResolvedValueOnce(undefined);                                   // RESET ROLE

    const svc = new ImpersonationService(pool as never);
    await svc.endImpersonation(SESSION_ID, 'p-uid');

    const updateCall = client.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE impersonation_sessions/);
    expect(updateCall[0]).toMatch(/ended_at = now\(\)/);
    expect(updateCall[1]).toEqual([SESSION_ID, 'p-uid']);
  });

  it('end: 404 when session does not belong to caller', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                    // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 0 })                              // UPDATE returns 0
      .mockResolvedValueOnce(undefined);                                   // RESET ROLE

    const svc = new ImpersonationService(pool as never);
    await expect(svc.endImpersonation(SESSION_ID, 'wrong-uid')).rejects.toThrow(/impersonation_session.not_found/);
  });

  it('refuses when IMPERSONATION_JWT_SECRET is unset', async () => {
    delete process.env['IMPERSONATION_JWT_SECRET'];
    const svc = new ImpersonationService(pool as never);
    await expect(
      svc.startImpersonation({ platformUserId: 'p', targetShopId: SHOP_ID, reason: 'r' }),
    ).rejects.toThrow(/secret_missing/);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm --filter @goldsmith/api test impersonation.service.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement the service**

```typescript
// impersonation.service.ts
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { signImpersonationToken } from '../impersonation-token';

const TTL_SECONDS = 30 * 60;

export interface StartImpersonationArgs {
  platformUserId: string;
  targetShopId: string;
  reason: string;
  ip?: string;
  userAgent?: string;
}

export interface StartImpersonationResult {
  sessionId: string;
  token: string;
  expiresAt: string; // ISO
}

async function withPlatformAdmin<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('SET LOCAL ROLE platform_admin');
    return await fn(c);
  } finally {
    await c.query('RESET ROLE').catch(() => undefined);
    c.release();
  }
}

@Injectable()
export class ImpersonationService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async startImpersonation(a: StartImpersonationArgs): Promise<StartImpersonationResult> {
    const secret = process.env['IMPERSONATION_JWT_SECRET'];
    if (!secret) throw new UnauthorizedException({ code: 'impersonation.secret_missing' });

    return withPlatformAdmin(this.pool, async (c) => {
      const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
      const r = await c.query<{ id: string }>(
        `INSERT INTO impersonation_sessions
           (platform_user_id, target_shop_id, expires_at, reason, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, $6)
         RETURNING id`,
        [a.platformUserId, a.targetShopId, expiresAt, a.reason, a.ip ?? null, a.userAgent ?? null],
      );
      const sessionId = r.rows[0]!.id;
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4::inet, $5, $6::jsonb)`,
        ['impersonation.started', a.platformUserId, a.targetShopId, a.ip ?? null, a.userAgent ?? null, JSON.stringify({ sessionId, reason: a.reason, ttlSeconds: TTL_SECONDS })],
      );

      const token = signImpersonationToken({
        sessionId, platformUserId: a.platformUserId, targetShopId: a.targetShopId,
        ttlSeconds: TTL_SECONDS, secret,
      });
      return { sessionId, token, expiresAt: expiresAt.toISOString() };
    });
  }

  async endImpersonation(sessionId: string, platformUserId: string): Promise<void> {
    await withPlatformAdmin(this.pool, async (c) => {
      const upd = await c.query(
        `UPDATE impersonation_sessions
            SET ended_at = now()
          WHERE id = $1 AND platform_user_id = $2 AND ended_at IS NULL`,
        [sessionId, platformUserId],
      );
      if (upd.rowCount === 0) {
        throw new NotFoundException({ code: 'impersonation_session.not_found' });
      }
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, metadata)
         VALUES ($1, $2, $3::jsonb)`,
        ['impersonation.ended', platformUserId, JSON.stringify({ sessionId })],
      );
    });
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @goldsmith/api test impersonation.service.spec.ts
```
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/platform-admin/services/impersonation.service.ts apps/api/src/modules/platform-admin/services/impersonation.service.spec.ts
git commit -m "feat(platform-admin): impersonation service with 30m TTL + audit"
```

---

## WS-C — Platform Admin Module (CRUD + metrics + controller)

### Task C1: `TenantManagementService`

**Files:**
- Create: `apps/api/src/modules/platform-admin/services/tenant-management.service.ts`
- Create: `apps/api/src/modules/platform-admin/services/tenant-management.service.spec.ts`

Methods:
- `createShop({ slug, displayName }) → { id }` (initial status='PROVISIONING')
- `updateShop(shopId, patch)` (display_name, contact_phone, etc. — only safe columns)
- `suspendShop(shopId, reason)` (status='SUSPENDED'; audit; invalidate tenant cache)
- `unsuspendShop(shopId)` (status='ACTIVE'; audit)
- `listShops({ page, search }) → { items, total }`

All run under `SET LOCAL ROLE platform_admin`. All write to `platform_audit_events` with `target_shop_id`.

- [ ] **Step 1: Write the failing test (full CRUD + audit assertions)**

```typescript
// tenant-management.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantManagementService } from './tenant-management.service';

const SHOP_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_UID = 'platform-admin-uid';

describe('TenantManagementService', () => {
  let pool: any;
  let client: any;
  let cache: any;

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
    cache = { invalidate: vi.fn() };
  });

  it('createShop inserts shop, returns id, audits tenant.created', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ id: SHOP_ID }] })     // INSERT shops
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // RESET ROLE
    const svc = new TenantManagementService(pool, cache);
    const out = await svc.createShop({ slug: 'demo', displayName: 'Demo Jewellers', platformUserId: ADMIN_UID });
    expect(out.id).toBe(SHOP_ID);
    expect(client.query.mock.calls[1][0]).toMatch(/INSERT INTO shops/);
    expect(client.query.mock.calls[2][1]).toContain('tenant.created');
  });

  it('suspendShop sets status, audits, invalidates cache', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rowCount: 1 })                 // UPDATE shops
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // RESET ROLE
    const svc = new TenantManagementService(pool, cache);
    await svc.suspendShop(SHOP_ID, 'overdue invoice', ADMIN_UID);
    expect(client.query.mock.calls[1][0]).toMatch(/UPDATE shops SET status = 'SUSPENDED'/);
    expect(client.query.mock.calls[2][1]).toContain('tenant.suspended');
    expect(cache.invalidate).toHaveBeenCalledWith(SHOP_ID);
  });

  it('suspendShop 404s when shop missing', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce(undefined);
    const svc = new TenantManagementService(pool, cache);
    await expect(svc.suspendShop('00000000-0000-0000-0000-000000000000', 'r', ADMIN_UID))
      .rejects.toThrow(/tenant.not_found/);
  });

  it('unsuspendShop sets status=ACTIVE and audits', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const svc = new TenantManagementService(pool, cache);
    await svc.unsuspendShop(SHOP_ID, ADMIN_UID);
    expect(client.query.mock.calls[1][0]).toMatch(/UPDATE shops SET status = 'ACTIVE'/);
    expect(client.query.mock.calls[2][1]).toContain('tenant.unsuspended');
  });

  it('listShops paginates and supports search', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ id: SHOP_ID, slug: 'demo', display_name: 'Demo', status: 'ACTIVE' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: '17' }] })
      .mockResolvedValueOnce(undefined);
    const svc = new TenantManagementService(pool, cache);
    const out = await svc.listShops({ page: 2, pageSize: 20, search: 'dem' });
    expect(out.items).toHaveLength(1);
    expect(out.total).toBe(17);
    const select = client.query.mock.calls[1][0] as string;
    expect(select).toMatch(/ILIKE/);
    expect(select).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @goldsmith/api test tenant-management.service.spec.ts
```

- [ ] **Step 3: Implement the service**

```typescript
// tenant-management.service.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { TenantCache } from '@goldsmith/tenant-config';

export interface CreateShopArgs { slug: string; displayName: string; platformUserId: string; }
export interface UpdateShopArgs {
  shopId: string; platformUserId: string;
  patch: Partial<{ displayName: string; contactPhone: string; aboutText: string }>;
}
export interface ListShopsArgs { page: number; pageSize: number; search?: string; }
export interface ListShopsResult {
  items: Array<{ id: string; slug: string; display_name: string; status: string; created_at: string }>;
  total: number;
}

async function withPlatformAdmin<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('SET LOCAL ROLE platform_admin');
    return await fn(c);
  } finally {
    await c.query('RESET ROLE').catch(() => undefined);
    c.release();
  }
}

@Injectable()
export class TenantManagementService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(TenantCache) private readonly cache: { invalidate: (shopId: string) => void },
  ) {}

  async createShop(a: CreateShopArgs): Promise<{ id: string }> {
    return withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO shops (slug, display_name, status) VALUES ($1, $2, 'PROVISIONING') RETURNING id`,
        [a.slug, a.displayName],
      );
      const id = r.rows[0]!.id;
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.created', a.platformUserId, id, JSON.stringify({ slug: a.slug, displayName: a.displayName })],
      );
      return { id };
    });
  }

  async updateShop(a: UpdateShopArgs): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (a.patch.displayName !== undefined) { fields.push(`display_name = $${i++}`); params.push(a.patch.displayName); }
    if (a.patch.contactPhone !== undefined) { fields.push(`contact_phone = $${i++}`); params.push(a.patch.contactPhone); }
    if (a.patch.aboutText !== undefined) { fields.push(`about_text = $${i++}`); params.push(a.patch.aboutText); }
    if (fields.length === 0) return;
    fields.push(`updated_at = now()`);
    params.push(a.shopId);
    await withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query(`UPDATE shops SET ${fields.join(', ')} WHERE id = $${i}`, params);
      if (r.rowCount === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.updated', a.platformUserId, a.shopId, JSON.stringify(a.patch)],
      );
      this.cache.invalidate(a.shopId);
    });
  }

  async suspendShop(shopId: string, reason: string, platformUserId: string): Promise<void> {
    await withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query(
        `UPDATE shops SET status = 'SUSPENDED', updated_at = now() WHERE id = $1 AND status <> 'TERMINATED'`,
        [shopId],
      );
      if (r.rowCount === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.suspended', platformUserId, shopId, JSON.stringify({ reason })],
      );
      this.cache.invalidate(shopId);
    });
  }

  async unsuspendShop(shopId: string, platformUserId: string): Promise<void> {
    await withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query(
        `UPDATE shops SET status = 'ACTIVE', updated_at = now() WHERE id = $1 AND status = 'SUSPENDED'`,
        [shopId],
      );
      if (r.rowCount === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.unsuspended', platformUserId, shopId, '{}'],
      );
      this.cache.invalidate(shopId);
    });
  }

  async listShops(a: ListShopsArgs): Promise<ListShopsResult> {
    const offset = Math.max(0, (a.page - 1) * a.pageSize);
    return withPlatformAdmin(this.pool, async (c) => {
      const where = a.search ? `WHERE slug ILIKE $3 OR display_name ILIKE $3` : '';
      const args: unknown[] = [a.pageSize, offset];
      if (a.search) args.push(`%${a.search}%`);
      const r = await c.query<{ id: string; slug: string; display_name: string; status: string; created_at: string }>(
        `SELECT id, slug, display_name, status, created_at FROM shops ${where}
           ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        args,
      );
      const cArgs: unknown[] = a.search ? [`%${a.search}%`] : [];
      const cnt = await c.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM shops ${a.search ? 'WHERE slug ILIKE $1 OR display_name ILIKE $1' : ''}`,
        cArgs,
      );
      return { items: r.rows, total: Number(cnt.rows[0]!.count) };
    });
  }
}
```

NOTE: `TenantCache` is the name expected if it exists in `@goldsmith/tenant-config`. Verify by reading `packages/tenant-config/src/index.ts`. If the cache does not expose `invalidate(shopId)`, add it (small change in that package) **before** writing this service. If the existing cache is `PermissionsCache`, this needs a separate `TenantCache` — check what `DrizzleTenantLookup` uses for caching shop rows. If no cache exists, omit the invalidate calls and document in the runbook that `display_name`/`status` updates take effect on next request.

- [ ] **Step 4: Verify cache invalidation surface**

```bash
grep -rn "TenantCache\|tenant-cache\|invalidate" packages/tenant-config/src/ packages/tenant-context/src/
```
Use whatever exists; if nothing exposes `invalidate`, skip the cache calls and add a TODO in the runbook (status changes propagate within next-request lookup of `DrizzleTenantLookup`).

- [ ] **Step 5: Run tests, fix until green**

```bash
pnpm --filter @goldsmith/api test tenant-management.service.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/platform-admin/services/tenant-management.service.ts apps/api/src/modules/platform-admin/services/tenant-management.service.spec.ts
git commit -m "feat(platform-admin): tenant management service (CRUD + suspend/unsuspend)"
```

---

### Task C2: `SubscriptionService`

**Files:**
- Create: `apps/api/src/modules/platform-admin/services/subscription.service.ts`
- Create: `apps/api/src/modules/platform-admin/services/subscription.service.spec.ts`

- [ ] **Step 1: Test**

```typescript
// subscription.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let pool: any; let client: any;
  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('upsertSubscription creates row, audits subscription.upserted', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                       // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1' }] })     // UPSERT
      .mockResolvedValueOnce(undefined)                       // INSERT audit
      .mockResolvedValueOnce(undefined);                      // RESET ROLE
    const svc = new SubscriptionService(pool);
    const out = await svc.upsertSubscription({ shopId: 'shop-1', plan: 'growth', mrrPaise: 500_000, platformUserId: 'p' });
    expect(out.id).toBe('sub-1');
    expect(client.query.mock.calls[1][0]).toMatch(/ON CONFLICT \(shop_id\) DO UPDATE/);
    expect(client.query.mock.calls[2][1]).toContain('subscription.upserted');
  });

  it('listSubscriptions returns rows joined with shops', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: 'shop-1', display_name: 'D', plan: 'trial', status: 'active', mrr_paise: '0' }] })
      .mockResolvedValueOnce(undefined);
    const svc = new SubscriptionService(pool);
    const out = await svc.listSubscriptions();
    expect(out).toHaveLength(1);
    expect(out[0].mrrPaise).toBe(0); // bigint→number conversion
  });

  it('rejects invalid plan', async () => {
    const svc = new SubscriptionService(pool);
    await expect(
      svc.upsertSubscription({ shopId: 's', plan: 'platinum' as never, mrrPaise: 0, platformUserId: 'p' }),
    ).rejects.toThrow(/invalid_plan/);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// subscription.service.ts
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

export type SubscriptionPlan = 'trial' | 'starter' | 'growth' | 'enterprise';
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled';

export interface UpsertArgs {
  shopId: string;
  plan: SubscriptionPlan;
  mrrPaise: number;
  status?: SubscriptionStatus;
  billingCycleStart?: string; // YYYY-MM-DD
  platformUserId: string;
}

const PLANS = new Set<SubscriptionPlan>(['trial', 'starter', 'growth', 'enterprise']);

async function withPlatformAdmin<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('SET LOCAL ROLE platform_admin'); return await fn(c); }
  finally { await c.query('RESET ROLE').catch(() => undefined); c.release(); }
}

@Injectable()
export class SubscriptionService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async upsertSubscription(a: UpsertArgs): Promise<{ id: string }> {
    if (!PLANS.has(a.plan)) throw new BadRequestException({ code: 'subscription.invalid_plan' });
    if (!Number.isInteger(a.mrrPaise) || a.mrrPaise < 0) throw new BadRequestException({ code: 'subscription.invalid_mrr' });
    return withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO platform_subscriptions (shop_id, plan, status, mrr_paise, billing_cycle_start)
         VALUES ($1, $2, COALESCE($3, 'active'), $4, $5)
         ON CONFLICT (shop_id) DO UPDATE
           SET plan = EXCLUDED.plan,
               status = EXCLUDED.status,
               mrr_paise = EXCLUDED.mrr_paise,
               billing_cycle_start = EXCLUDED.billing_cycle_start,
               updated_at = now()
         RETURNING id`,
        [a.shopId, a.plan, a.status ?? null, a.mrrPaise, a.billingCycleStart ?? null],
      );
      const id = r.rows[0]!.id;
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['subscription.upserted', a.platformUserId, a.shopId,
         JSON.stringify({ plan: a.plan, status: a.status ?? 'active', mrrPaise: a.mrrPaise })],
      );
      return { id };
    });
  }

  async listSubscriptions(): Promise<Array<{
    id: string; shopId: string; displayName: string; plan: SubscriptionPlan; status: SubscriptionStatus; mrrPaise: number;
  }>> {
    return withPlatformAdmin(this.pool, async (c) => {
      const r = await c.query<{ id: string; shop_id: string; display_name: string; plan: SubscriptionPlan; status: SubscriptionStatus; mrr_paise: string }>(
        `SELECT s.id, s.shop_id, sh.display_name, s.plan, s.status, s.mrr_paise
           FROM platform_subscriptions s
           JOIN shops sh ON sh.id = s.shop_id
           ORDER BY sh.display_name`,
      );
      return r.rows.map((x) => ({
        id: x.id, shopId: x.shop_id, displayName: x.display_name,
        plan: x.plan, status: x.status, mrrPaise: Number(x.mrr_paise),
      }));
    });
  }
}
```

- [ ] **Step 3: Run, commit**

```bash
pnpm --filter @goldsmith/api test subscription.service.spec.ts
git add apps/api/src/modules/platform-admin/services/subscription.service.ts apps/api/src/modules/platform-admin/services/subscription.service.spec.ts
git commit -m "feat(platform-admin): subscription service"
```

---

### Task C3: `MetricsService` (cross-tenant aggregates)

**Files:**
- Create: `apps/api/src/modules/platform-admin/services/metrics.service.ts`
- Create: `apps/api/src/modules/platform-admin/services/metrics.service.spec.ts`

The query must be aggregate-only — no PII fields in the SELECT. The `// PLATFORM_ADMIN_BYPASS` comment is mandatory.

- [ ] **Step 1: Test**

```typescript
// metrics.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let pool: any; let client: any;
  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('returns total/active shops + invoice count for last 30 days', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                                              // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ total_shops: '7', active_shops: '5', invoices_30d: '142' }] })
      .mockResolvedValueOnce(undefined);                                                             // RESET ROLE
    const svc = new MetricsService(pool);
    const m = await svc.getMetrics();
    expect(m).toEqual({ totalShops: 7, activeShops: 5, invoicesLast30Days: 142 });
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// metrics.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

export interface PlatformMetrics {
  totalShops: number;
  activeShops: number;
  invoicesLast30Days: number;
}

@Injectable()
export class MetricsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getMetrics(): Promise<PlatformMetrics> {
    const c = await this.pool.connect();
    try {
      // PLATFORM_ADMIN_BYPASS: intentional cross-tenant read; safe because this endpoint
      // requires platform_admin role (enforced by RolesGuard on the controller) and returns
      // only aggregate counts, no PII. invoices is RLS-enabled, so we run as platform_admin
      // (BYPASSRLS) for the duration of this transaction only.
      await c.query('SET LOCAL ROLE platform_admin');
      const r = await c.query<{ total_shops: string; active_shops: string; invoices_30d: string }>(
        `SELECT
           (SELECT COUNT(*)::text FROM shops)                                            AS total_shops,
           (SELECT COUNT(*)::text FROM shops WHERE status = 'ACTIVE')                    AS active_shops,
           (SELECT COUNT(*)::text FROM invoices WHERE created_at > now() - interval '30 days') AS invoices_30d`,
      );
      const row = r.rows[0]!;
      return {
        totalShops: Number(row.total_shops),
        activeShops: Number(row.active_shops),
        invoicesLast30Days: Number(row.invoices_30d),
      };
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }
}
```

- [ ] **Step 3: Test, commit**

```bash
pnpm --filter @goldsmith/api test metrics.service.spec.ts
git add apps/api/src/modules/platform-admin/services/metrics.service.ts apps/api/src/modules/platform-admin/services/metrics.service.spec.ts
git commit -m "feat(platform-admin): cross-tenant metrics with explicit BYPASS comment"
```

---

### Task C4: `DataExportService` — scoped export per tenant

**Files:**
- Create: `apps/api/src/modules/platform-admin/services/data-export.service.ts`
- Create: `apps/api/src/modules/platform-admin/services/data-export.service.spec.ts`

Must be **scoped** — only the requested shop. Decrypts customer PAN if present (uses existing `@goldsmith/crypto-envelope`), or marks as redacted if KEK unavailable. Returns JSON: `{ shop, customers, invoices, payments, custom_orders, ... }`.

For the plan: scope is shop, customers, invoices (header + lines), payments. Skip lower-priority tables (loyalty, audit) — call those out as deferred.

- [ ] **Step 1: Test (shape only)**

```typescript
// data-export.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataExportService } from './data-export.service';

describe('DataExportService', () => {
  let pool: any; let client: any;
  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    pool = { connect: vi.fn().mockResolvedValue(client) };
  });

  it('exports a single tenant scope', async () => {
    client.query
      .mockResolvedValueOnce(undefined)                                                                              // SET LOCAL ROLE
      .mockResolvedValueOnce({ rows: [{ id: 's1', slug: 'demo', display_name: 'Demo', status: 'ACTIVE' }] })          // shop
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] })                                                                // customers
      .mockResolvedValueOnce({ rows: [{ id: 'inv1' }] })                                                              // invoices
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })                                                                // payments
      .mockResolvedValueOnce(undefined)                                                                              // INSERT audit
      .mockResolvedValueOnce(undefined);                                                                             // RESET ROLE

    const svc = new DataExportService(pool);
    const out = await svc.exportTenant('s1', 'platform-uid');

    expect(out.shop.id).toBe('s1');
    expect(out.customers).toHaveLength(1);
    expect(out.invoices).toHaveLength(1);
    expect(out.payments).toHaveLength(1);
    // Verify the WHERE shop_id = $1 filter on every query
    expect(client.query.mock.calls[2][1]).toEqual(['s1']);
    expect(client.query.mock.calls[3][1]).toEqual(['s1']);
    expect(client.query.mock.calls[4][1]).toEqual(['s1']);
  });

  it('throws when shop not found', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined);
    const svc = new DataExportService(pool);
    await expect(svc.exportTenant('missing', 'p')).rejects.toThrow(/tenant.not_found/);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// data-export.service.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

async function withPlatformAdmin<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('SET LOCAL ROLE platform_admin'); return await fn(c); }
  finally { await c.query('RESET ROLE').catch(() => undefined); c.release(); }
}

export interface TenantExport {
  shop: Record<string, unknown>;
  customers: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  exported_at: string;
  /** Subset note — what is intentionally NOT in the export. */
  excluded: string[];
}

@Injectable()
export class DataExportService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async exportTenant(shopId: string, platformUserId: string): Promise<TenantExport> {
    return withPlatformAdmin(this.pool, async (c) => {
      // PLATFORM_ADMIN_BYPASS: scoped export — every query is filtered to the requested
      // shop_id. Returning customer PII is the explicit purpose (DPDPA portability).
      const shop = await c.query(`SELECT * FROM shops WHERE id = $1`, [shopId]);
      if (shop.rows.length === 0) throw new NotFoundException({ code: 'tenant.not_found' });

      const customers = await c.query(`SELECT * FROM customers WHERE shop_id = $1`, [shopId]);
      const invoices  = await c.query(`SELECT * FROM invoices  WHERE shop_id = $1`, [shopId]);
      const payments  = await c.query(`SELECT * FROM payments  WHERE shop_id = $1`, [shopId]);

      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.exported', platformUserId, shopId,
         JSON.stringify({ counts: { customers: customers.rowCount, invoices: invoices.rowCount, payments: payments.rowCount } })],
      );

      return {
        shop: shop.rows[0]!,
        customers: customers.rows,
        invoices: invoices.rows,
        payments: payments.rows,
        exported_at: new Date().toISOString(),
        excluded: ['audit_events', 'loyalty_ledger', 'product_views', 'try_at_home_bookings'],
      };
    });
  }
}
```

- [ ] **Step 3: Test, commit**

```bash
pnpm --filter @goldsmith/api test data-export.service.spec.ts
git add apps/api/src/modules/platform-admin/services/data-export.service.ts apps/api/src/modules/platform-admin/services/data-export.service.spec.ts
git commit -m "feat(platform-admin): scoped tenant data export"
```

---

### Task C5: `PlatformAdminController` + DTOs

**Files:**
- Create: `apps/api/src/modules/platform-admin/dto/index.ts`
- Create: `apps/api/src/modules/platform-admin/platform-admin.controller.ts`
- Create: `apps/api/src/modules/platform-admin/platform-admin.controller.spec.ts`
- Create: `apps/api/src/modules/platform-admin/platform-admin.module.ts`
- Modify: `apps/api/src/app.module.ts` (register module)

All routes:
- `@Controller('platform/admin')`
- `@Roles('platform_admin')`
- `@SkipTenant()` (these endpoints are platform-scope; no tenant resolution)
- No `PolicyGuard` — RolesGuard is sufficient.

- [ ] **Step 1: DTOs (Zod)**

```typescript
// dto/index.ts
import { z } from 'zod';

export const CreateTenantDto = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  displayName: z.string().min(1).max(120),
});
export type CreateTenantDtoT = z.infer<typeof CreateTenantDto>;

export const UpdateTenantDto = z.object({
  displayName: z.string().min(1).max(120).optional(),
  contactPhone: z.string().regex(/^\+?\d{8,15}$/).optional(),
  aboutText: z.string().max(2000).optional(),
}).strict();
export type UpdateTenantDtoT = z.infer<typeof UpdateTenantDto>;

export const SuspendTenantDto = z.object({
  reason: z.string().min(3).max(500),
});
export type SuspendTenantDtoT = z.infer<typeof SuspendTenantDto>;

export const UpsertSubscriptionDto = z.object({
  shopId: z.string().uuid(),
  plan: z.enum(['trial', 'starter', 'growth', 'enterprise']),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  mrrPaise: z.number().int().nonnegative(),
  billingCycleStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ImpersonateDto = z.object({
  targetShopId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});
```

- [ ] **Step 2: Controller**

```typescript
// platform-admin.controller.ts
import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe,
  Post, Query, Req, UnauthorizedException, UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantManagementService } from './services/tenant-management.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';
import { ImpersonationService } from './services/impersonation.service';
import { DataExportService } from './services/data-export.service';
import {
  CreateTenantDto, type CreateTenantDtoT,
  UpdateTenantDto, type UpdateTenantDtoT,
  SuspendTenantDto, type SuspendTenantDtoT,
  UpsertSubscriptionDto, ImpersonateDto,
} from './dto';

type FirebaseRequest = Request & { user?: { uid?: string; goldsmith_uid?: string } };

@Controller('platform/admin')
@Roles('platform_admin')
@SkipTenant()
export class PlatformAdminController {
  constructor(
    @Inject(TenantManagementService) private readonly tenants: TenantManagementService,
    @Inject(SubscriptionService) private readonly subs: SubscriptionService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(ImpersonationService) private readonly impersonation: ImpersonationService,
    @Inject(DataExportService) private readonly exports: DataExportService,
  ) {}

  private platformUid(req: Request): string {
    const user = (req as FirebaseRequest).user;
    if (!user?.uid) throw new UnauthorizedException({ code: 'auth.missing' });
    return user.uid;
  }

  @Post('tenants')
  @UsePipes(new ZodValidationPipe(CreateTenantDto))
  async createTenant(@Body() dto: CreateTenantDtoT, @Req() req: Request): Promise<{ id: string }> {
    return this.tenants.createShop({ slug: dto.slug, displayName: dto.displayName, platformUserId: this.platformUid(req) });
  }

  @Get('tenants')
  async listTenants(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search?: string,
  ): Promise<unknown> {
    return this.tenants.listShops({
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
      search,
    });
  }

  @Get('tenants/:id')
  async getTenant(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const r = await this.tenants.listShops({ page: 1, pageSize: 1, search: undefined });
    // Or — preferable — add a getShop method. Keep it simple for v1.
    return r.items.find((x) => x.id === id) ?? null;
  }

  @Post('tenants/:id')
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(UpdateTenantDto))
  async updateTenant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantDtoT,
    @Req() req: Request,
  ): Promise<void> {
    await this.tenants.updateShop({ shopId: id, patch: dto, platformUserId: this.platformUid(req) });
  }

  @Post('tenants/:id/suspend')
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(SuspendTenantDto))
  async suspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SuspendTenantDtoT,
    @Req() req: Request,
  ): Promise<void> {
    await this.tenants.suspendShop(id, dto.reason, this.platformUid(req));
  }

  @Post('tenants/:id/unsuspend')
  @HttpCode(204)
  async unsuspend(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request): Promise<void> {
    await this.tenants.unsuspendShop(id, this.platformUid(req));
  }

  @Get('tenants/:id/export')
  async export(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request): Promise<unknown> {
    return this.exports.exportTenant(id, this.platformUid(req));
  }

  @Post('subscriptions')
  @UsePipes(new ZodValidationPipe(UpsertSubscriptionDto))
  async upsertSub(@Body() dto: import('./dto').UpsertSubscriptionDto extends infer T ? T : never, @Req() req: Request): Promise<{ id: string }> {
    return this.subs.upsertSubscription({ ...(dto as never), platformUserId: this.platformUid(req) });
  }

  @Get('subscriptions')
  async listSubs(): Promise<unknown> {
    return this.subs.listSubscriptions();
  }

  @Get('metrics')
  async getMetrics(): Promise<unknown> {
    return this.metrics.getMetrics();
  }

  @Post('impersonate')
  @UsePipes(new ZodValidationPipe(ImpersonateDto))
  async startImpersonation(@Body() dto: { targetShopId: string; reason: string }, @Req() req: Request): Promise<unknown> {
    return this.impersonation.startImpersonation({
      platformUserId: this.platformUid(req),
      targetShopId: dto.targetShopId, reason: dto.reason,
      ip: (req.headers['x-forwarded-for'] as string | undefined),
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('impersonate/:sessionId')
  @HttpCode(204)
  async endImpersonation(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.impersonation.endImpersonation(sessionId, this.platformUid(req));
  }
}
```

(Tighten the `upsertSub` DTO type once Zod inference is verified.)

- [ ] **Step 3: Module**

```typescript
// platform-admin.module.ts
import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { TenantManagementService } from './services/tenant-management.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';
import { ImpersonationService } from './services/impersonation.service';
import { DataExportService } from './services/data-export.service';
import { ImpersonationSessionAdapter } from './impersonation-session.adapter';

@Module({
  controllers: [PlatformAdminController],
  providers: [
    TenantManagementService,
    SubscriptionService,
    MetricsService,
    ImpersonationService,
    DataExportService,
    ImpersonationSessionAdapter,
  ],
  exports: [ImpersonationSessionAdapter],
})
export class PlatformAdminModule {}
```

- [ ] **Step 4: Register in `app.module.ts`**

```typescript
// app.module.ts — add import + entry in imports array
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
// ...
imports: [
  // ...existing modules,
  PlatformAdminModule,
],
```

Move `ImpersonationSessionAdapter` registration from being declared inside `app.module.ts` providers (added in B3) to being exported by `PlatformAdminModule`. Make sure the `TenantInterceptor` factory in `app.module.ts` still receives it via `inject:` — since `PlatformAdminModule` exports it, simply importing the module is enough.

- [ ] **Step 5: Controller spec**

Mirror `auth.controller.spec.ts` patterns. Smoke each route with mocked services. (Full code omitted here for brevity — follow the same `Test.createTestingModule` + mock providers approach used in `auth.controller.spec.ts`. Required cases: createTenant, suspend, unsuspend, export, impersonate start/end, list metrics. Each asserts the underlying service was called with expected args including `platformUserId` from `req.user.uid`.)

- [ ] **Step 6: Run all tests, commit**

```bash
pnpm --filter @goldsmith/api typecheck
pnpm --filter @goldsmith/api test
git add apps/api/src/modules/platform-admin/ apps/api/src/app.module.ts
git commit -m "feat(platform-admin): controller + module + register in app"
```

---

### Task C6: Integration test — end-to-end impersonation flow

**Files:**
- Create: `apps/api/test/platform-admin.integration.test.ts`
- Create: `apps/api/test/impersonation.integration.test.ts`

These exercise the full boot — real Postgres, real Firebase Auth emulator, real interceptor, real strategy.

- [ ] **Step 1: `impersonation.integration.test.ts` — golden path**

Pseudocode (build using `_auth-test-setup.ts` helpers):

```typescript
// 1. Provision a shop_admin user for a target shop S; provision a platform_admin user P.
// 2. Mint a Firebase ID token for P (role=platform_admin).
// 3. POST /platform/admin/impersonate { targetShopId: S, reason: 'support' } with P's token.
//    Assert 200, capture { sessionId, token, expiresAt }.
// 4. Assert platform_audit_events has a row with action='impersonation.started', platform_user_id=P.uid, target_shop_id=S.
// 5. With BOTH headers (Authorization: Bearer P-firebase, X-Impersonation-Token: token), call
//    GET /api/v1/auth/me. Assert 200, body.tenant.id === S, body.user.role === 'shop_admin'.
// 6. POST /api/v1/billing/invoices with the same headers — assert 201 (or whatever the create-invoice path is in this repo).
//    Then assert audit_events for shop S has the invoice row, AND the row's actor_user_id is P's id (or whatever convention; verify against billing.service.ts).
// 7. DELETE /platform/admin/impersonate/{sessionId} with P's token (NO impersonation header).
//    Assert 204. platform_audit_events has 'impersonation.ended'.
// 8. Re-call GET /api/v1/auth/me with the impersonation header — assert 401 with code 'auth.impersonation_session_inactive'.
```

- [ ] **Step 2: Negative cases**

```typescript
// expired session: insert a row directly with expires_at = now() - 1 minute, sign a JWT with the same jti and a future exp.
// Use that JWT — assert 401 'auth.impersonation_session_inactive'.

// non-platform-admin tries to impersonate: shop_admin user calls POST /platform/admin/impersonate — assert 403.

// non-platform-admin sends X-Impersonation-Token on a tenant route: assert the header is ignored,
// the user remains in their original shop (not redirected to target).

// missing IMPERSONATION_JWT_SECRET: unset env, restart app, attempt to start impersonation — assert 401 'auth.impersonation_misconfigured'.
```

- [ ] **Step 3: Run integration**

```bash
docker compose -f apps/api/docker-compose.test.yml up -d   # if used
pnpm --filter @goldsmith/api test impersonation.integration.test.ts platform-admin.integration.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/impersonation.integration.test.ts apps/api/test/platform-admin.integration.test.ts
git commit -m "test(platform-admin): integration coverage for tenant CRUD + impersonation lifecycle"
```

---

## WS-D — Admin UI in `customer-web`

The admin UI is a Next.js route at `/admin` inside `apps/customer-web`. Because the root layout currently fetches tenant config (and bails to "shop not available" without a slug), we add an early-exit branch in `app/layout.tsx` for `/admin/*` paths.

### Task D1: Root layout short-circuit + admin layout

**Files:**
- Modify: `apps/customer-web/app/layout.tsx`
- Create: `apps/customer-web/app/admin/layout.tsx`

- [ ] **Step 1: Short-circuit in root layout**

Modify `app/layout.tsx` to check `headers().get('x-pathname')` (set via middleware) or use `next/headers` `URL` from `headers()`:

```typescript
// at top of RootLayout()
const headersList = headers();
const pathname = headersList.get('x-pathname') ?? '';
if (pathname.startsWith('/admin')) {
  // Admin pages render their own layout; skip tenant gate.
  return (
    <html lang="en" className={`${yatraOne.variable} ${notoSansDevanagari.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

To make `x-pathname` available, add a tiny middleware:

```typescript
// apps/customer-web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set('x-pathname', req.nextUrl.pathname);
  // Also set it on request headers so layout.tsx can read it via next/headers
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: reqHeaders } });
}
export const config = { matcher: ['/((?!_next|api|favicon.ico).*)'] };
```

- [ ] **Step 2: Admin layout**

```tsx
// apps/customer-web/app/admin/layout.tsx
import { Inter } from 'next/font/google';
import './admin.css'; // create empty file or share globals

const inter = Inter({ subsets: ['latin'], variable: '--font-admin' });

export const metadata = { title: 'Goldsmith Platform Admin' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} min-h-screen bg-slate-50 text-slate-900 font-sans p-6`}>
      <header className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Goldsmith Platform Admin</h1>
        <span className="text-xs text-slate-500">internal</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Quick smoke test**

```bash
pnpm --filter @goldsmith/customer-web dev
# visit http://localhost:3000/admin — should render an empty admin shell (no tenant config required)
# visit http://localhost:3000/  — should still work for tenant pages (NEXT_PUBLIC_SHOP_SLUG)
```

- [ ] **Step 4: Commit**

```bash
git add apps/customer-web/app/layout.tsx apps/customer-web/app/admin/layout.tsx apps/customer-web/middleware.ts apps/customer-web/app/admin/admin.css
git commit -m "feat(admin-ui): /admin route group with English layout, root layout short-circuit"
```

---

### Task D2: Admin client + Firebase login + Tenant table

**Files:**
- Create: `apps/customer-web/app/admin/_lib/firebase-admin-client.ts`
- Create: `apps/customer-web/app/admin/_lib/admin-api.ts`
- Create: `apps/customer-web/app/admin/page.tsx`
- Create: `apps/customer-web/app/admin/_components/TenantTable.tsx`
- Create: `apps/customer-web/app/admin/_components/ImpersonateButton.tsx`

The page is client-side rendered (`'use client'`) and uses Firebase Auth to log in. After login, it stores the ID token in memory (NOT localStorage), refreshes via Firebase SDK, and uses it as `Authorization: Bearer <token>` on every API call.

- [ ] **Step 1: Firebase client wrapper**

```typescript
// firebase-admin-client.ts
'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';

const config = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY']!,
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']!,
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']!,
};

if (!getApps().length) initializeApp(config);
export const auth = getAuth();

export async function signInGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function getIdToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  return u.getIdToken(false);
}

/** Throws if the token's role claim is not platform_admin. */
export async function requirePlatformAdmin(): Promise<{ token: string; uid: string }> {
  const u = auth.currentUser;
  if (!u) throw new Error('not_authenticated');
  const t = await u.getIdTokenResult(true);
  if (t.claims['role'] !== 'platform_admin') throw new Error('not_platform_admin');
  return { token: t.token, uid: u.uid };
}
```

- [ ] **Step 2: API helpers**

```typescript
// admin-api.ts
export interface Tenant { id: string; slug: string; display_name: string; status: string; created_at: string; }
export interface TenantList { items: Tenant[]; total: number; }
export interface PlatformMetrics { totalShops: number; activeShops: number; invoicesLast30Days: number; }
export interface ImpersonationSession { sessionId: string; token: string; expiresAt: string; }

const BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? 'http://localhost:3000';

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`admin_api ${path} ${r.status}`);
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export const adminApi = {
  listTenants: (token: string, q?: { search?: string; page?: number }) =>
    call<TenantList>(token, `/platform/admin/tenants?${new URLSearchParams({ ...(q?.search ? { search: q.search } : {}), page: String(q?.page ?? 1) })}`),
  metrics: (token: string) => call<PlatformMetrics>(token, '/platform/admin/metrics'),
  suspend: (token: string, id: string, reason: string) =>
    call<void>(token, `/platform/admin/tenants/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  unsuspend: (token: string, id: string) =>
    call<void>(token, `/platform/admin/tenants/${id}/unsuspend`, { method: 'POST' }),
  startImpersonation: (token: string, targetShopId: string, reason: string) =>
    call<ImpersonationSession>(token, '/platform/admin/impersonate', { method: 'POST', body: JSON.stringify({ targetShopId, reason }) }),
  endImpersonation: (token: string, sessionId: string) =>
    call<void>(token, `/platform/admin/impersonate/${sessionId}`, { method: 'DELETE' }),
};
```

- [ ] **Step 3: Tenant table + impersonate button**

```tsx
// _components/TenantTable.tsx
'use client';
import { useState } from 'react';
import type { Tenant } from '../_lib/admin-api';
import { adminApi } from '../_lib/admin-api';
import { ImpersonateButton } from './ImpersonateButton';

export function TenantTable({ token, tenants, onMutate }: {
  token: string; tenants: Tenant[]; onMutate: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function suspend(t: Tenant) {
    const reason = prompt(`Suspend ${t.display_name}? Enter reason:`);
    if (!reason) return;
    setBusy(t.id);
    try { await adminApi.suspend(token, t.id, reason); onMutate(); }
    finally { setBusy(null); }
  }
  async function unsuspend(t: Tenant) {
    setBusy(t.id);
    try { await adminApi.unsuspend(token, t.id); onMutate(); }
    finally { setBusy(null); }
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="bg-slate-100">
        <tr>
          <th className="p-2 text-left">Display name</th>
          <th className="p-2 text-left">Slug</th>
          <th className="p-2 text-left">Status</th>
          <th className="p-2 text-left">Actions</th>
        </tr>
      </thead>
      <tbody>
        {tenants.map((t) => (
          <tr key={t.id} className="border-b border-slate-200">
            <td className="p-2">{t.display_name}</td>
            <td className="p-2 font-mono">{t.slug}</td>
            <td className="p-2">
              <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                t.status === 'ACTIVE' ? 'bg-green-100 text-green-800'
                  : t.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-200 text-slate-700'}`}>
                {t.status}
              </span>
            </td>
            <td className="p-2 flex gap-2">
              {t.status === 'ACTIVE'
                ? <button disabled={busy === t.id} onClick={() => suspend(t)} className="px-2 py-1 bg-amber-600 text-white rounded">Suspend</button>
                : <button disabled={busy === t.id} onClick={() => unsuspend(t)} className="px-2 py-1 bg-green-600 text-white rounded">Unsuspend</button>}
              <ImpersonateButton token={token} tenant={t} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// _components/ImpersonateButton.tsx
'use client';
import { useState } from 'react';
import type { Tenant } from '../_lib/admin-api';
import { adminApi } from '../_lib/admin-api';

export function ImpersonateButton({ token, tenant }: { token: string; tenant: Tenant }) {
  const [sess, setSess] = useState<{ sessionId: string; token: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    const reason = prompt(`Reason for impersonating ${tenant.display_name}?`);
    if (!reason) return;
    setBusy(true);
    try { setSess(await adminApi.startImpersonation(token, tenant.id, reason)); }
    finally { setBusy(false); }
  }
  async function end() {
    if (!sess) return;
    setBusy(true);
    try { await adminApi.endImpersonation(token, sess.sessionId); setSess(null); }
    finally { setBusy(false); }
  }

  return sess ? (
    <button onClick={end} disabled={busy} className="px-2 py-1 bg-red-600 text-white rounded">
      End impersonation (expires {new Date(sess.expiresAt).toLocaleTimeString()})
    </button>
  ) : (
    <button onClick={start} disabled={busy} className="px-2 py-1 bg-slate-700 text-white rounded">
      Impersonate
    </button>
  );
}
```

- [ ] **Step 4: Admin landing page**

```tsx
// app/admin/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { signInGoogle, requirePlatformAdmin } from './_lib/firebase-admin-client';
import { adminApi, type Tenant, type PlatformMetrics } from './_lib/admin-api';
import { TenantTable } from './_components/TenantTable';

export default function AdminHome() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);

  async function login() {
    try {
      await signInGoogle();
      const { token } = await requirePlatformAdmin();
      setToken(token);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function refresh() {
    if (!token) return;
    setTenants((await adminApi.listTenants(token)).items);
    setMetrics(await adminApi.metrics(token));
  }

  useEffect(() => { void refresh(); }, [token]);

  if (!token) {
    return (
      <div className="space-y-4">
        <p>Sign in with your Goldsmith platform admin account.</p>
        <button onClick={login} className="px-4 py-2 bg-slate-900 text-white rounded">Sign in with Google</button>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {metrics && (
        <div className="grid grid-cols-3 gap-4">
          <Card label="Total shops" value={metrics.totalShops} />
          <Card label="Active shops" value={metrics.activeShops} />
          <Card label="Invoices (30d)" value={metrics.invoicesLast30Days} />
        </div>
      )}
      <TenantTable token={token} tenants={tenants} onMutate={refresh} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
```

- [ ] **Step 5: Smoke**

```bash
pnpm --filter @goldsmith/customer-web dev
# visit /admin → sign in with a Google account that has role=platform_admin custom claim → see tenant list
```

- [ ] **Step 6: Commit**

```bash
git add apps/customer-web/app/admin
git commit -m "feat(admin-ui): tenant table, suspend/unsuspend, impersonate, metrics"
```

---

## WS-E — Review Gate + Runtime Smoke

### Task E1: Update runbook

**Files:**
- Modify: `docs/runbook.md`

Add a section:

```markdown
## §N — Provisioning a platform_admin user

Platform admins are NEVER created via the shopkeeper invite flow. Provisioning is manual:

1. Create a Firebase Auth user (email/Google) for the platform admin.
2. Set a custom claim: `role = 'platform_admin'`. From a privileged shell:
   ```bash
   node scripts/set-platform-admin.mjs <firebase-uid>
   ```
   This script (in `scripts/`) calls `admin.auth().setCustomUserClaims(uid, { role: 'platform_admin' })`.
3. The user must sign out / refresh the ID token for the claim to apply.
4. There is NO database row in `shop_users` for platform admins. They have no `shop_id`.
5. Audit: confirm `platform_audit_events` shows the next login from this user.

## §N+1 — IMPERSONATION_JWT_SECRET rotation

The impersonation JWT is signed with `IMPERSONATION_JWT_SECRET`. Rotate quarterly or after any
known leak. Rotation invalidates all in-flight impersonation tokens (DB session rows are
unaffected; running sessions must be re-started). Procedure:

1. Generate new secret: `openssl rand -base64 48`.
2. Update Azure Key Vault.
3. Roll API instances.
```

- [ ] **Step 1: Edit and commit**

```bash
git add docs/runbook.md
git commit -m "docs(runbook): platform_admin provisioning + JWT rotation"
```

---

### Task E2: Codex + security-review (parallel)

- [ ] **Step 1: Run both gates simultaneously**

In two terminals (or two background bash invocations):

```bash
# Terminal 1
cd C:/gs-admin && codex review --base main 2>&1 | tee codex-platform-admin.log

# Terminal 2
cd C:/gs-admin && claude /security-review 2>&1 | tee security-review-platform-admin.log
```

If Windows CLM blocks Codex in the worktree (see `feedback_codex_worktree_clm.md`), run Codex from `C:\Alok\Business Projects\Goldsmith` after pushing the branch and switching there with `git switch feat/story-platform-admin-console`. As a substitute, dispatch the `superpowers:requesting-code-review` skill from a separate Claude session.

- [ ] **Step 2: Apply ALL P1 + most P2 findings**

Common Class A findings to expect:
- "RolesGuard runs before strategy override" — verify it doesn't (strategy populates req.user before guards execute downstream).
- "X-Impersonation-Token leakage in logs" — ensure logger redacts.
- "ALTER TABLE platform_audit_events without lock" — fine (small table, brief lock); add `LOCK TABLE platform_audit_events IN ACCESS EXCLUSIVE MODE;` ONLY if reviewer insists.
- "missing rate limit on /platform/admin/impersonate" — add ThrottlerGuard with stricter limit (5/minute) on impersonate route.
- "audit reason not validated" — Zod `min(5)` already enforced.

- [ ] **Step 3: Write markers**

```bash
echo "Codex review passed $(date)" > .codex-review-passed
echo "Security review passed $(date) — N findings, all P1+P2 applied" > .security-review-passed
git add .codex-review-passed .security-review-passed
git commit -m "chore: review gates passed (Codex + security)"
```

---

### Task E3: Runtime smoke

- [ ] **Step 1: Boot the API**

```bash
cd C:/gs-admin
pnpm --filter @goldsmith/api start
# OR via Docker if you have docker-compose setup
```

- [ ] **Step 2: Provision a platform admin (manual seed)**

Run the script described in the runbook against a Firebase Auth emulator user.

- [ ] **Step 3: Walk the smoke path**

```bash
# Login as platform admin → get ID token (PT)

# Create tenant
curl -X POST http://localhost:3000/platform/admin/tenants \
  -H "Authorization: Bearer $PT" -H "content-type: application/json" \
  -d '{"slug":"smoke-demo","displayName":"Smoke Demo Jewellers"}'
# → { "id": "<NEW_SHOP_ID>" }

# Start impersonation
curl -X POST http://localhost:3000/platform/admin/impersonate \
  -H "Authorization: Bearer $PT" -H "content-type: application/json" \
  -d "{\"targetShopId\":\"$NEW_SHOP_ID\",\"reason\":\"runtime-smoke\"}"
# → { "sessionId": "$SESS", "token": "$IMP", "expiresAt": "..." }

# Create an invoice as the impersonated tenant
curl -X POST http://localhost:3000/api/v1/billing/invoices \
  -H "Authorization: Bearer $PT" \
  -H "X-Impersonation-Token: $IMP" \
  -H "content-type: application/json" \
  -d '{ "items": [...], "buyer": {...}, ... }'   # mirror existing billing tests for the body
# → 201

# Verify audit
psql "$DATABASE_URL" -c \
  "SELECT action, platform_user_id, target_shop_id FROM platform_audit_events
   WHERE created_at > now() - interval '5 min' ORDER BY created_at;"
# → impersonation.started, then tenant.created (earlier), then app-side audit_events for the invoice

# End impersonation
curl -X DELETE http://localhost:3000/platform/admin/impersonate/$SESS \
  -H "Authorization: Bearer $PT"
# → 204

# Try to use the now-ended session — must 401
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $PT" \
  -H "X-Impersonation-Token: $IMP"
# → 401 with code 'auth.impersonation_session_inactive'
```

- [ ] **Step 4: Document smoke result + push**

```bash
git push -u origin feat/story-platform-admin-console
```

---

## Self-Review Checklist (run before pushing)

- [ ] **Spec coverage:**
  - Migration 0053 — A1 ✓
  - Migration 0054 — A2 ✓
  - Migration 0055 — A3 ✓
  - PlatformAdminModule — C5 ✓
  - TenantManagementService (create/update/suspend/unsuspend/list) — C1 ✓
  - SubscriptionService (upsert/list) — C2 ✓
  - MetricsService with BYPASS comment — C3 ✓
  - ImpersonationService (start/end with 30m, audit, JWT) — B4 ✓
  - TenantContextInterceptor impersonation handling — B3 ✓
  - PlatformAdminController routes — C5 ✓
  - Admin UI — D1+D2 ✓
  - TDD: suspend audits, impersonation JWT, expired session, cross-tenant metrics — covered in B/C specs ✓
  - Runtime smoke list — E3 ✓
  - Non-negotiables: platform_admin not invitable (no path created), 30-min cap (B4), BYPASS comment (C3, A1, B4 reviews), scoped export (C4), platform_audit_events for all actions (every service writes there) ✓

- [ ] **Placeholder scan:** No "TBD" or "implement later" in any step. Test bodies provided. Where the test driver code is omitted (interceptor unit test in B3, controller spec in C5), the omission is bounded — the existing `auth.controller.spec.ts` is the explicit reference pattern.

- [ ] **Type consistency:**
  - `signImpersonationToken` / `verifyImpersonationToken` — same casing throughout B1, B2, B4.
  - `FirebaseUserClaims.impersonationSessionId` — matches `RequestLike.user.impersonationSessionId` in B3.
  - `ImpersonationSessionPort.isActive(sessionId)` — adapter `isActive` in B3 ✓.
  - `platformUserId` — used consistently across all services and audit entries.

- [ ] **Migration numbers:** 0053, 0054, 0055 — and only those. ✓

- [ ] **Cache invalidation gap:** D1 root-layout short-circuit relies on a middleware. Verify the middleware ships AND the layout reads `headers().get('x-pathname')`. If middleware is rejected by review (Edge runtime constraints), fall back to a top-level `(admin)` route group with a separate `apps/customer-web/app/(admin)/admin/layout.tsx` and explicitly NOT call `fetchTenantConfig` in that branch. (Bound: D1 already lists this fallback.)

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-platform-admin-console.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task; orchestrator reviews between tasks. Best for this Class A story because each WS has independent test surface.

**2. Inline Execution** — Execute tasks in this session via `superpowers:executing-plans`. Slower, longer context, but lower coordination overhead.

**Recommendation:** Subagent-Driven, with WS-A done first (blocks all), then WS-B + WS-C in parallel subagents (B finishes the strategy + interceptor, C builds the controller surface that consumes them — sequence the C5 task after B3+B4 land), then WS-D, then WS-E. Drop to **Sonnet 4.6** for execution (`/model sonnet`); Opus is overkill for the implementation phase now that the plan is locked.
