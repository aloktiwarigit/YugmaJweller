# Story 19.11 — Remove hardcoded brand colours from customer-mobile

**Class:** B — UI colour wiring, no business logic, no API changes.
**Date:** 2026-05-18

## Problem

Three high-traffic customer-mobile screens hardcode the anchor jeweller's gold palette instead of reading from the tenant theme store. This breaks the multi-tenant white-label contract: a second jeweller onboarded with a different primary colour would still see anchor gold in browse, rate-lock, and try-at-home UIs.

## Affected files

| File | Hardcodes |
|------|-----------|
| `apps/customer-mobile/app/(tabs)/browse.tsx` | `PRIMARY_DEEP = '#8C6628'`, `PRIMARY_WASH = colors.primaryLight // '#EFE3BE'` used for active filter/sort/chip state |
| `apps/customer-mobile/app/rate-lock/index.tsx` | `#B8860B` payment CTA, green success card literals |
| `apps/customer-mobile/app/try-at-home/index.tsx` | `#3B82F6` / `#EFF6FF` / `#1D4ED8` selection + confirmation state |

## Work streams

### WS-A — browse.tsx
- Remove `PRIMARY_DEEP` and `PRIMARY_WASH` module-level constants.
- Add `useTenantStore` read inside `Browse` component: `const branding = useTenantStore(s => s.tenant?.branding)`.
- Derive `primaryColor = branding?.primaryColor ?? '#B58A3C'` and `primaryWash = primaryColor + '20'`.
- Replace all 6 usages of `PRIMARY_DEEP` / `PRIMARY_WASH` in filter button, sort button, and filter chips.

### WS-B — rate-lock/index.tsx
- Pass `primaryColor` into `ConfirmationCard` as a prop (keeps the component testable in isolation).
- Replace `#B8860B` on the Razorpay payment button with `primaryColor`.
- Replace hardcoded success card greens (`#F0FDF4`, `#A7F3D0`, `#065F46`) with semantic tokens: `colors.successWash`, `colors.border` (for `#A7F3D0`), `colors.successJade`.

### WS-C — try-at-home/index.tsx
- Pass `primaryColor` + `primaryWash` into `ProductList` as props.
- Replace `#3B82F6` (checkbox border + bg) and `#EFF6FF` (row bg) in `ProductList` with `primaryColor` / `primaryWash`.
- Replace `#1D4ED8`, `#EFF6FF`, `#BFDBFE` in `ConfirmedCard` with `primaryColor` / `primaryWash`.
- `TryAtHomeScreen` reads tenant branding; passes colours down.

### WS-D — Tests + verification
- New test file: `apps/customer-mobile/test/theme-tokens.test.tsx`.
- Three test suites (one per screen).
- Each suite:
  1. Renders with `primaryColor: '#0F766E'` (emerald) in store and asserts no crash.
  2. Renders with `tenant = null` and asserts graceful fallback (no crash, renders).
  3. Asserts hardcoded gold `#8C6628` / `#EFE3BE` are absent from rendered output.
- Typecheck + lint + grep verification as DoD gate.

## Fallback strategy

`branding?.primaryColor ?? '#B58A3C'` — `colors.primary` is `'#B58A3C'` (aged gold), a safe default that preserves current visual when no tenant is loaded.

## DoD checklist

- [ ] `grep -r '#8C6628\|#EFE3BE' apps/customer-mobile/app/` → zero matches
- [ ] Tests pass with emerald `#0F766E` injected
- [ ] `pnpm --filter @goldsmith/customer-mobile typecheck` clean
- [ ] `pnpm --filter @goldsmith/customer-mobile lint` clean
- [ ] No new dependencies added
- [ ] Branch pushed to origin
