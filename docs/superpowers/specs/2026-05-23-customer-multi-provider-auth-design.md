# Customer Multi-Provider Auth — Design Spec

**Date:** 2026-05-23  
**Story classification:** Class A (auth, customer identity schema migration, account linking)  
**Scope:** customer-mobile + customer-web + API backend  
**Status:** Approved

---

## Problem

The customer app supports only phone OTP via Firebase Auth. To increase sign-up conversion — especially for younger customers and the customer-web storefront — we need Google Sign-In and Email/Password as first-class auth methods.

**Key constraint:** Unified identity — a customer who signs up via phone OTP and later tries Google (or vice versa) must resolve to the **same customer record**. Firebase manages multi-provider accounts under one UID; our DB needs `firebase_uid` as the lookup key.

---

## Approved Approach

**Option B — Explicit session endpoint + extended guard**

- Client calls `POST /api/v1/customer/auth/session` once after Firebase sign-in (mirrors existing staff session pattern)
- Guard handles per-request token validation
- No Firebase Custom Token exchange (ADR-0016 preserved: direct Firebase ID token usage)

---

## DS-1: Database Schema — Migration 0076

**File:** `packages/db/src/migrations/0076_customers_auth_identity.sql`

```sql
ALTER TABLE customers
  ADD COLUMN firebase_uid  TEXT,
  ADD COLUMN email         TEXT,
  ADD COLUMN display_name  TEXT,
  ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'phone'
    CHECK (auth_provider IN ('phone', 'google', 'email_password'));

CREATE UNIQUE INDEX customers_shop_firebase_uid_idx
  ON customers (shop_id, firebase_uid)
  WHERE firebase_uid IS NOT NULL;

CREATE INDEX customers_shop_email_idx
  ON customers (shop_id, lower(email))
  WHERE email IS NOT NULL;
```

**Lazy migration:** `firebase_uid` is nullable. Existing phone-OTP customers get it written on their next API request via the extended guard. Zero-downtime, no backfill needed.

**RLS:** Existing `shop_id`-scoped RLS policies cover new columns automatically.

---

## DS-2: API Layer

### DS-2a: New endpoint — `POST /api/v1/customer/auth/session`

```typescript
@SkipAuth()
@SkipTenant()
@Post('auth/session')
```

- Manually calls `admin.verifyIdToken(bearerToken, checkRevoked: true)`
- Calls `CustomerSessionService.findOrCreateCustomerByFirebaseToken(shopId, decodedToken)`
- Returns: `{ customer: CustomerSessionDto, isNewUser: boolean, authProvider: 'phone' | 'google' | 'email_password' }`

### DS-2b: Unified customer lookup — `findOrCreateCustomerByFirebaseToken`

Runs in a single DB transaction with `FOR UPDATE`:

```
1. SELECT WHERE shop_id = $shopId AND firebase_uid = $uid FOR UPDATE
   → found: return (existing — happy path)

2. If decodedToken.phone_number:
   SELECT WHERE shop_id = $shopId AND phone = $phone FOR UPDATE
   → found: UPDATE SET firebase_uid, auth_provider → return (linked phone customer)

3. If decodedToken.email:
   SELECT WHERE shop_id = $shopId AND lower(email) = lower($email) FOR UPDATE
   → found: UPDATE SET firebase_uid, auth_provider → return (linked email customer)

4. None found:
   INSERT new customer (firebase_uid, email, display_name, auth_provider,
                        created_by = CUSTOMER_SELF_REGISTRATION_ACTOR_ID)
   → return (isNewUser: true)
```

Safety net: `INSERT ... ON CONFLICT (shop_id, firebase_uid) DO NOTHING` prevents duplicates on racing concurrent requests.

### DS-2c: Extended `CustomerAuthGuard`

Per-request validation. New lookup order:
1. Try `firebase_uid` from decoded token → found: return
2. If `firebase_uid = NULL` on existing record (lazy migration): fall back to phone lookup, atomically write `firebase_uid`

Backward-compatible with all in-flight sessions across the deployment.

### DS-2d: New endpoint — `PATCH /api/v1/customer/profile/phone`

Protected by `CustomerAuthGuard`. Body: `{ phone: string, otpCode: string }`.  
Verifies OTP, writes `phone` to customer record. Used by "Add phone" nudge for OAuth users.

### DS-2e: Audit logging

| Event | Trigger |
|-------|---------|
| `CUSTOMER_SESSION_CREATED` | Every successful session call (records `auth_provider`) |
| `CUSTOMER_AUTH_PROVIDER_LINKED` | Existing customer gains `firebase_uid` via linking (steps 2 or 3) |
| `CUSTOMER_AUTH_FAILED` | Invalid/revoked token, rate-limit hit |

---

## DS-3: Mobile (customer-mobile)

### DS-3a: New package

```json
"@react-native-google-signin/google-signin": "^13.0.0"
```

Register in `app.config.ts` plugins. Configure `webClientId` = Type-3 Web OAuth client from `google-services.json`:  
`528920018833-b2ua9n337u2blajt89t7f5qo5nj0d2rh.apps.googleusercontent.com`

### DS-3b: `@goldsmith/auth-client` additions

**`src/native/google-sign-in.ts`:**
```typescript
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const { idToken } = await GoogleSignin.signIn();
  return auth().signInWithCredential(GoogleAuthProvider.credential(idToken));
}
```

**`src/native/email-auth.ts`:**
```typescript
export const signInWithEmail = (email: string, password: string) =>
  auth().signInWithEmailAndPassword(email, password);

export const createEmailAccount = async (email: string, password: string, displayName: string) => {
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName });
  return cred;
};

export const sendPasswordReset = (email: string) =>
  auth().sendPasswordResetEmail(email);
```

### DS-3c: `app/(auth)/welcome.tsx` — three-card auth selector

Replace phone-only layout with three equal-weight cards (Hindi-first copy, warm Goldsmith palette, ≥ 48×48 dp touch targets):

```
┌─────────────────────────────────┐
│      [jeweller brand logo]      │
│                                 │
│  ┌─────────────────────────┐   │
│  │  📱 मोबाइल नंबर        │   │  existing OTP flow (inline)
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │  G  Google से जारी रखें │   │  → signInWithGoogle()
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │  ✉  ईमेल और पासवर्ड   │   │  → navigate to /(auth)/email-auth
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### DS-3d: New screen — `app/(auth)/email-auth.tsx`

Two tabs: **साइन इन** / **खाता बनाएं**

- Sign-in tab: email + password → `signInWithEmail()`
- Create-account tab: name + email + password + confirm → `createEmailAccount()`
- Password visibility toggle; inline Zod validation; Hindi error strings
- Forgot password → `sendPasswordReset()` → Hindi toast

### DS-3e: `CustomerAuthProvider` update

After `onAuthStateChanged` fires (provider-agnostic):
```
1. getIdToken(forceRefresh: false)
2. POST /api/v1/customer/auth/session  ← NEW
3. Store { customer, isNewUser, bearer } in expo-secure-store + Zustand
4. isNewUser === true → set flag for "Add phone" nudge on profile tab
```

---

## DS-4: Web (customer-web)

### DS-4a: Google Sign-In

`@goldsmith/auth-client/web` already exports `signInWithGoogle()`. Wire to a Google button on the web auth page. `onAuthStateChanged` → session endpoint → customer provisioned.

### DS-4b: Email/password form

Add to web auth page (tabs or below phone OTP):
- Sign in: `signInWithEmailAndPassword(auth, email, password)`
- Sign up: `createUserWithEmailAndPassword()` + `updateProfile()`
- Forgot password: `sendPasswordResetEmail()` → toast

### DS-4c: "Add phone" nudge

`/profile` page: if `customer.phoneE164` is null → non-blocking banner → "Verify phone number" CTA → phone OTP flow → `PATCH /api/v1/customer/profile/phone`.

---

## DS-5: Firebase Setup

### Enable providers on `goldsmith-dev`

- Email/Password provider: enable via Firebase MCP / Console
- Google Sign-In provider: enable via Firebase MCP / Console

### OAuth consent screen

- App name: `Goldsmith`
- Scopes: `openid`, `profile`, `email` only
- **White-label note:** consent screen shows `Goldsmith`; per-jeweller brand appears inside the app post-auth. Accepted limitation for multi-tenant OAuth.

### Android SHA-256 fingerprint

`google-services.json` already has SHA-1 (`6c4c45397673ee1b9767077ed228fa95e3400a13`). Add SHA-256:
```bash
firebase --project goldsmith-dev android-apps:sha:add <android-app-id> <sha256-hash>
```
SHA-256 from the same keystore as release builds (Azure Key Vault `kv-writ-prod`).

### Web authorized redirect URIs

Firebase Console → Authentication → Google → Web SDK config:
- `http://localhost:3000` (dev)
- Customer-web production domain (when deployed)

### No `google-services.json` re-download needed

Enabling providers does not invalidate the existing file. Type-1 Android + Type-3 Web OAuth client IDs are already present.

---

## DS-6: Security Model

| Concern | Mechanism |
|---------|-----------|
| Token validation — session endpoint | `verifyIdToken(token, checkRevoked: true)` |
| Token validation — per-request guard | `verifyIdToken(token, checkRevoked: false)` — aligns with ADR-0016 |
| Account linking races | Single transaction; `FOR UPDATE`; `INSERT ON CONFLICT DO NOTHING` |
| Email enumeration prevention | Generic `auth.invalid_credentials` — never expose Postgres errors |
| Password reset | Firebase `sendPasswordResetEmail()` — no backend involvement; Firebase rate-limits natively |
| Google OAuth phishing surface | Native SDK (mobile) / Firebase popup (web); server-side `verifyIdToken` |
| Audit trail | Three events logged to platform audit table (see DS-2e) |

---

## DS-7: Test Plan

### Unit tests (TDD — red before green)

- `findOrCreateCustomerByFirebaseToken`: all 4 lookup paths (uid hit / phone link / email link / new create)
- `CustomerAuthGuard` lazy migration: `firebase_uid = NULL` customer gets it written on first request
- Email/password error response: assert no email enumeration in body
- Auth provider enum: rejects unknown values

### Integration tests

- `POST /api/v1/customer/auth/session` with mock `verifyIdToken` — all 4 provisioning paths
- Tenant isolation: two shops + same Firebase UID → two separate records, no cross-contamination
- Concurrent session calls with same UID → no duplicate customers (race condition)
- Phone OTP regression: existing customers still sign in; `firebase_uid` backfilled correctly

### Smoke tests (mandatory before PR merge)

- Mobile: Google Sign-In end-to-end on device/emulator → customer record created → subsequent API call succeeds
- Mobile: Email sign-up → new customer → "Add phone" nudge on profile tab
- Mobile: Phone OTP — no regression
- Web: Google Sign-In button → flow completes → session established
- Web: Email/password sign-in and sign-up

---

## Files Changed

| File | Change |
|------|--------|
| `packages/db/src/migrations/0076_customers_auth_identity.sql` | New |
| `packages/db/src/schema/customers.ts` | +4 columns |
| `apps/api/src/modules/customer/customer-session.service.ts` | New |
| `apps/api/src/modules/customer/customer-session.controller.ts` | New |
| `apps/api/src/modules/customer/customer-auth.guard.ts` | Extend |
| `apps/api/src/modules/customer/customer.module.ts` | Wire |
| `packages/auth-client/src/native/google-sign-in.ts` | New |
| `packages/auth-client/src/native/email-auth.ts` | New |
| `packages/auth-client/src/index.ts` | Export new |
| `apps/customer-mobile/app/(auth)/welcome.tsx` | Modify |
| `apps/customer-mobile/app/(auth)/email-auth.tsx` | New |
| `apps/customer-mobile/src/providers/CustomerAuthProvider.tsx` | Modify |
| `apps/customer-mobile/app.config.ts` | +plugin |
| `apps/customer-web/src/auth/*` | Modify |
| `apps/customer-web/src/app/(auth)/*` | Add UI |
| `apps/customer-web/src/app/profile/*` | Add nudge |

---

## ADR Note

No new ADR required. This extends ADR-0016 (direct Firebase ID token usage) without changing the token validation model. `auth_provider` is a data annotation, not an architectural change. If the white-label OAuth consent screen limitation warrants an ADR, write ADR-0018 during execution.
