# @goldsmith/customer-mobile

White-label customer-facing Expo app. Ships per tenant — same codebase, rebuilt with a
tenant-specific `EXPO_PUBLIC_SHOP_SLUG`, app name, package id, and (eventually) icon/splash.

## Run

```bash
pnpm install                                  # workspace root
pnpm --filter @goldsmith/customer-mobile start
```

## Env vars

### Development

| Var | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | yes | NestJS API origin — use `http://10.0.2.2:3001` on Android emulator |
| `EXPO_PUBLIC_SHOP_SLUG` | yes | Tenant slug (`anchor-dev` for local dev) |
| `EXPO_PUBLIC_DEV_AUTH` | dev-only | Set to `1` to inject a mock customer session (bypasses Firebase). Must NOT be set in production builds. |
| `EXPO_PUBLIC_APP_NAME` | optional | Override app display name (defaults to tenant displayName from boot API) |

### Production (EAS build)

| Var | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | **required** | Public HTTPS API origin (e.g. `https://api.your-shop.com`) |
| `EXPO_PUBLIC_SHOP_SLUG` | **required** | Tenant slug matching the shop's `slug` column |
| `EXPO_PUBLIC_ANDROID_PACKAGE` | **required** | Android package name (e.g. `com.your-shop.customer`) — must not end in `.dev` |
| `EXPO_PUBLIC_IOS_BUNDLE_ID` | **required** | iOS bundle ID (e.g. `com.your-shop.customer`) — must not end in `.dev` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | **required** | Firebase project ID for phone OTP |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | **required** | EAS project UUID for OTA updates |
| `GOOGLE_SERVICES_JSON` | **required** (Android) | Path to `google-services.json` EAS secret |
| `GOOGLE_SERVICES_PLIST` | **required** (iOS) | Path to `GoogleService-Info.plist` EAS secret |
| `EXPO_PUBLIC_DEV_AUTH` | must be unset | Setting this to `1` in a production build throws at config time |

Production config evaluation fails fast when `GOOGLE_SERVICES_JSON` or
`GOOGLE_SERVICES_PLIST` are missing, when either service file path points to a
`.dev` placeholder, when `EXPO_PUBLIC_API_BASE_URL` is not `https://`, or when
the API origin points to localhost.

### API env vars (affects payment handoff)

| Var | Required | Purpose |
|---|---|---|
| `API_PUBLIC_URL` | **required** in production | Public base URL of the API (e.g. `https://api.your-shop.com`). Used to build `paymentUrl` returned to the mobile app. Missing in production causes payment token endpoint to return 500. |
| `PAYMENT_TOKEN_SECRET` | **required** in production | Strong random secret (≥32 chars) for signing short-lived payment tokens. In production, must not be the default dev value or shorter than 32 chars — token generation throws on startup otherwise. |
| `RAZORPAY_KEY_ID` | **required** | Razorpay publishable key (e.g. `rzp_live_...`) displayed on the payment page. |

## Auth

**Production auth:** Firebase phone OTP. Customer signs in with their phone number, Firebase issues an ID token, which is used as the API bearer via `CustomerAuthGuard`. On sign-out, Firebase's `auth().signOut()` is called and secure storage is cleared.

**Dev-mode mock auth:** When `EXPO_PUBLIC_DEV_AUTH=1`, the provider injects a `DEV-MOCK-` bearer token without Firebase. `CustomerAuthGuard` accepts `DEV-MOCK-*` bearers only when the API's `NODE_ENV` is `development` or `test` — any other value (including `production`, unset, or typos) causes the guard to reject the token and return 401. This path is completely unavailable in production builds (throws at `app.config.ts` evaluation time).

**Stale session cleanup:** If the app was previously run with `EXPO_PUBLIC_DEV_AUTH=1` and is now restarted with dev auth disabled, any stale DEV-MOCK session is cleared from secure storage when Firebase reports no authenticated user.

**Token refresh:** `onAuthStateChanged` handles initial auth state. ID token refresh is handled by Firebase's SDK automatically; the next `getIdToken()` call always returns a fresh token.

## White-label

Goldsmith brand is NEVER visible to customers. All branding (logo, app name, colors)
loads from `GET /api/v1/tenant/boot?slug=$EXPO_PUBLIC_SHOP_SLUG` at boot and is stored
in `tenantStore`. Components consume tenant config via `useTenantStore` selectors.
