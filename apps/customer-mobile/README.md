# @goldsmith/customer-mobile

White-label customer-facing Expo app. Ships per tenant — same codebase, rebuilt with a
tenant-specific `EXPO_PUBLIC_SHOP_SLUG`, app name, package id, and (eventually) icon/splash.

## Run

```bash
pnpm install                                  # workspace root
pnpm --filter @goldsmith/customer-mobile start
```

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | yes | NestJS API origin (e.g. `http://10.0.2.2:3000`) |
| `EXPO_PUBLIC_SHOP_SLUG` | yes | Tenant slug (`anchor-dev` for dev) |
| `EXPO_PUBLIC_DEV_AUTH` | dev-only | Set to `1` to inject a mock customer session at boot |
| `EXPO_PUBLIC_APP_NAME` | optional | Override app display name (defaults to tenant displayName) |

## Auth status

This branch ships the **scaffold** + a **dev-mode mock customer session** (gated by
`EXPO_PUBLIC_DEV_AUTH=1`). Real customer phone OTP via Firebase is reclassified to a
follow-up Class A story (`EPIC7-S1 — Customer Phone OTP`) because it requires a new
`customers.firebase_uid` column, a new SQL lookup function, and an extension to
`/auth/session` — all auth surface that needs Class A ceremony.

Until that story lands, the welcome screen shows a "Phone OTP coming soon" placeholder
when `EXPO_PUBLIC_DEV_AUTH` is not `1`.

## White-label

Goldsmith brand is NEVER visible to customers. All branding (logo, app name, colors)
loads from `GET /api/v1/tenant/boot?slug=$EXPO_PUBLIC_SHOP_SLUG` at boot and is stored
in `tenantStore`. Components consume tenant config via `useTenantStore` selectors.
