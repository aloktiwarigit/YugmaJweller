# Current Implementation Status

Verified against current code on 2026-05-06. Machine-readable version: `docs/agent-context/current-state.json`. This file supersedes `docs/code-truth-completion-audit-2026-05-04.md`.

## Current Target

The active target is demo-ready, customer-customize, then deploy for the first paying jeweller. Do not treat full FR1-FR140 completion as the immediate target unless the task explicitly says so.

## Implemented Or Launch-Close

- Tenant isolation and RLS: `packages/db`, `packages/tenant-context`, `packages/testing/tenant-isolation`.
- Auth/RBAC/audit: `apps/api/src/modules/auth`, `packages/auth-client`, shopkeeper auth screens.
- Settings: `apps/api/src/modules/settings`, `apps/shopkeeper/app/settings`.
- Inventory/catalog/images: `apps/api/src/modules/inventory`, `apps/api/src/modules/catalog`, shopkeeper inventory routes, customer browse/PDP routes.
- Pricing/rates: `apps/api/src/modules/pricing`, `packages/integrations/rates`, `packages/money`.
- Billing/compliance: `apps/api/src/modules/billing`, `packages/compliance`, shopkeeper billing routes.
- CRM: `apps/api/src/modules/crm`, `apps/shopkeeper/app/customers`.
- Loyalty: `apps/api/src/modules/loyalty`, customer loyalty surfaces.
- Rate-lock/custom-orders/try-at-home: backend modules plus shopkeeper routes and customer-mobile surfaces.
- Platform admin basics: `apps/api/src/modules/platform-admin`, `apps/customer-web/app/admin`.

## Recently Closed Since The 2026-05-04 Audit

- Shopkeeper reachability: CRM, custom orders, try-at-home, and rate-lock are now exposed through `apps/shopkeeper/app/(tabs)/more.tsx`.
- Inventory quick actions: new product, CSV import, valuation, dead stock, and label printing are reachable from `apps/shopkeeper/app/inventory/index.tsx`.
- Customer mobile profile timeline: purchases, custom orders, rate locks, and try-at-home tabs are wired in `apps/customer-mobile/app/(tabs)/profile.tsx`.
- Customer mobile duplicate PDP route has been removed; only `apps/customer-mobile/app/browse/[id].tsx` remains.
- Auth compatibility: shopkeeper now calls `/api/v1/auth/session` and `/api/v1/auth/me`, with temporary unversioned `/auth/session` and `/auth/me` API aliases preserved for older clients.
- Shopkeeper phone login: Indian phone input is normalized before Firebase OTP requests, including pasted `+91` numbers such as `+919876543210`.
- Tenant boot: `tenant_boot_lookup` is schema-qualified and granted public schema usage so `/api/v1/tenant/boot?slug=anchor-dev` no longer resolves `shops` through a restricted search path.
- Catalog pricing: legacy object-shaped `shop_settings.making_charges_json` is normalized to the current array shape, and raw purities such as `22K`, `24K`, and `999` map to canonical rate keys such as `GOLD_22K` and `SILVER_999`.
- Reviews: review list SQL now uses the current `customers.name` schema and includes tenant-safe shop joins.
- Android pnpm builds: shopkeeper and customer-mobile Expo config now patch React Native Gradle plugin resolution for pnpm layouts; SDK 51 Android dependencies are aligned.
- Repo hygiene: generated package artifacts and native prebuild trees are ignored by lint/git, and DB/sync integration scripts are serialized to reduce local Testcontainers contention.
- Storefront addendum: customer web now includes a single-jeweller retail homepage with search/category navigation, jewellery-led hero imagery, collection merchandising, policy footer navigation, FAQ, shipping/cancellation/privacy/terms pages, buying guides, sitemap, richer listing filters, PDP sharing/EMI/related products, and structured data.
- Customer-web local boot: localhost now defaults to the `anchor-dev` shop slug when no tenant header or `NEXT_PUBLIC_SHOP_SLUG` is present, so the dev storefront no longer renders the unavailable-shop fallback while the API has tenant data.
- Customer mobile profile gaps: address book and referral entry points exist with clear pending states while backend contracts remain deferred.
- Shopkeeper Android device login: the debug build now runs from a pnpm-safe Gradle layout, uses React Navigation 6-compatible dependencies, restores `/api/v1/auth/me` sessions after reinstall/relaunch, and has Hindi tab labels without the extraneous route warning.
- Customer-mobile Android install: Expo prebuild, debug assemble, and `adb install -r` now pass from the short Windows path with the pnpm Gradle plugin fix.

## 2026-05-06 Verification Snapshot

- Passing: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:tenant-isolation`, scoped API catalog/reviews/auth tests, shopkeeper tests/typecheck/lint, customer-mobile tests/typecheck/lint/Android debug assemble+install, customer-web test/typecheck/build, DB integration tests, and sync integration tests.
- Android evidence: the shopkeeper debug APK builds from a short Windows path, installs on the connected Motorola `moto g power 5G - 2024` device as `com.goldsmith.shopkeeper.dev`, logs in with `+919876543210` / OTP `123456`, and restores the authenticated session after force-stop/relaunch.
- Browser evidence: customer-web build passes, localhost route smokes returned 200 for `/`, `/products`, `/faq`, `/shipping-policy`, and `/return-policy`, and Playwright captured styled desktop/mobile storefront screenshots plus the current Jewelsbox reference under `artifacts/playwright/`.
- Still blocked locally: full root `pnpm test:integration` is unstable in `@goldsmith/api` because of Docker/Testcontainers/Reaper and Firebase emulator setup; native Semgrep is blocked by Windows Application Control, with Docker fallback still pending.

## Partial Or Deferred

- Notifications FR107-FR112: preferences and WhatsApp deep links exist, but there is no provider-backed outbox/AiSensy/FCM notification system.
- Storefront addendum FR127-FR140: policy, FAQ, buying guide, sitemap, trust, listing, PDP, share, EMI, and structured-data surfaces exist; payment gateway, live inventory reservation, CMS management, and full SEO/marketing operations remain deferred.
- FR119 exports: GSTR CSV exists; export-any-report as branded CSV/PDF is incomplete.
- Viewing analytics FR64-FR68: view capture exists, but hot/cold dashboards and per-customer browsing history are incomplete.
- Sync/offline: protocol and scaffolding exist; push scope is limited mostly to products.
- Platform admin: tenant terminate/delete with recovery and global platform settings UI are not evidenced.
- Customer mobile: address book and referral-code entry points exist, but persisted customer address/referral APIs are still deferred.

## Verification Commands

Use a scoped command for small changes. For broad documentation or status claims:

```bash
pnpm docs:context
pnpm docs:validate
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm test:tenant-isolation
pnpm semgrep
```
