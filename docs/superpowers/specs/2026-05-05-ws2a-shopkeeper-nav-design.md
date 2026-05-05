# WS-2A: Shopkeeper Nav Reachability
**Date:** 2026-05-05  
**Class:** B (compressed ceremony)  
**Story ref:** Phase 2 — Reachability, WS-2A  
**Plan ref:** `C:\Users\alokt\.claude\plans\you-are-a-principal-distributed-alpaca.md`

---

## Problem

The shopkeeper app's bottom tab bar exposes only 5 tabs: होम / इन्वेंटरी / बिलिंग / रिपोर्ट / सेटिंग्स. Substantial built features are completely unreachable from the UI:

- `/customers` (CRM) — has routes, no nav entry
- `/custom-orders` — has routes, no nav entry
- `/try-at-home` — has routes, no nav entry
- Rate-lock — has feature screens in `src/features/rate-lock/` but no `app/rate-lock/` route files AND no nav entry
- Inventory sub-routes (bulk-import, valuation, dead-stock, print-labels) — exist under `app/inventory/` but no entry point from the list screen
- Dashboard KPIs — planned, flag-gated, no card on home screen yet

---

## Scope

### In scope
- Add "अधिक" (More) 6th tab to `app/(tabs)/_layout.tsx`
- Create `app/(tabs)/more.tsx` — menu screen with 4 feature rows
- Create `app/rate-lock/_layout.tsx`, `app/rate-lock/index.tsx`, `app/rate-lock/[id].tsx`
- Add horizontal quick-actions bar to `app/inventory/index.tsx`
- Add flag-gated `DashboardKpiCard` to `app/(tabs)/index.tsx`
- Create `src/components/DashboardKpiCard.tsx`
- Smoke tests for More screen and inventory quick-actions

### Out of scope
- Changing the existing settings tab behavior
- New API endpoints (all navigation uses existing routes)
- Dashboard KPI data fetching beyond a flag-gated card shell (data wiring is WS-3A)
- Role-based deep changes to routing (existing `href: isStaff ? null : undefined` pattern preserved for reports and settings)

---

## Navigation Architecture

### Updated tab bar (`app/(tabs)/_layout.tsx`)

6 tabs in order:

| Position | Name | Hindi | Icon | Staff visibility |
|---|---|---|---|---|
| 1 | `index` | होम | `home-outline` | visible |
| 2 | `inventory` | इन्वेंटरी | `cube-outline` | visible |
| 3 | `billing` | बिलिंग | `receipt-outline` | visible |
| 4 | `reports` | रिपोर्ट | `bar-chart-outline` | hidden (`href: isStaff ? null : undefined`) |
| 5 | `more` | अधिक | `grid-outline` | visible |
| 6 | `settings` | सेटिंग्स | `settings-outline` | hidden (`href: isStaff ? null : undefined`) |

Settings moves from position 5 to 6. The `isStaff` guard on reports and settings is unchanged.

---

## More Tab Screen (`app/(tabs)/more.tsx`)

Single-column list of feature rows, grouped under one section header.

**Section: दैनिक संचालन**

| Row | Hindi label | Ionicons icon | Destination | Staff-visible |
|---|---|---|---|---|
| 1 | ग्राहक सूची | `people-outline` | `/customers` | yes |
| 2 | कस्टम ऑर्डर | `construct-outline` | `/custom-orders` | yes |
| 3 | ट्राई-एट-होम | `home-outline` | `/try-at-home` | yes |
| 4 | दर-लॉक बुकिंग | `lock-closed-outline` | `/rate-lock` | owner only (hidden when `isStaff`) |

**Row design:**
- `minHeight: 64` — well above 48dp floor for 45-65 audience
- Layout: `{ flexDirection: 'row', alignItems: 'center' }`
- Left: Ionicons icon at 24px in `colors.primary`
- Middle: Hindi label, `fontSize: 18`, `fontFamily: typography.body.family`
- Right: `chevron-forward` at 16px in `colors.inkMute`
- `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: colors.border`
- `paddingHorizontal: spacing.lg`, `paddingVertical: spacing.md`

**Screen structure:**
```
SafeAreaView (flex: 1, bg: colors.bg)
  View (section header: "दैनिक संचालन" label)
  View (rows)
    MoreRow × 4 (rate-lock hidden for staff)
```

`MoreRow` is an internal component (not exported) — `Pressable` wrapping the row layout, `onPress` calls `router.push(destination)`.

---

## Inventory Quick-Actions Bar (`app/inventory/index.tsx`)

Horizontal `ScrollView` inserted between the `RateWidget` header and `InventorySearch`. Renders 5 pill buttons:

| Label | Destination |
|---|---|
| + नया उत्पाद | `/inventory/new` |
| CSV आयात | `/inventory/bulk-import` |
| मूल्यांकन | `/inventory/valuation` |
| डेड स्टॉक | `/inventory/dead-stock` |
| लेबल प्रिंट | `/inventory/print-labels` |

**Pill design:**
- `paddingHorizontal: spacing.md`, `paddingVertical: spacing.sm`
- `minHeight: 44` (secondary action bar — 44 is the iOS min; screen readers target larger text)
- `borderRadius: radii.pill`, `borderWidth: 1`, `borderColor: colors.border`
- `backgroundColor: colors.white`
- `fontSize: 14`, `fontFamily: typography.body.family`, `color: colors.ink`
- `marginRight: spacing.sm` between pills
- Horizontal ScrollView: `showsHorizontalScrollIndicator: false`, `paddingHorizontal: spacing.md`

---

## Rate-Lock Routes (`app/rate-lock/`)

Three files mirroring the `app/customers/` pattern exactly:

**`app/rate-lock/_layout.tsx`:**
```ts
import { Stack } from 'expo-router';
export default function RateLockLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: '#F5EDDD' }, headerTintColor: '#5C3D11' }} />;
}
```

**`app/rate-lock/index.tsx`:**
```ts
import { RateLockListScreen } from '../../src/features/rate-lock/RateLockListScreen';
export default RateLockListScreen;
```

**`app/rate-lock/[id].tsx`:**
```ts
import { RateLockDetailScreen } from '../../src/features/rate-lock/RateLockDetailScreen';
export default RateLockDetailScreen;
```

`CreateRateLockSheet` is a bottom sheet modal opened from within `RateLockListScreen` — no route needed.

Note: Verify `RateLockListScreen` and `RateLockDetailScreen` are exported as named exports (not default). If default exports, adjust the import accordingly.

---

## Dashboard KPI Card (Flag-gated)

### Feature flag

Environment variable: `EXPO_PUBLIC_DASHBOARD_KPIS`  
Check: `process.env['EXPO_PUBLIC_DASHBOARD_KPIS'] === '1'`

When `'1'` AND `role !== 'shop_staff'`: render `DashboardKpiCard` in `app/(tabs)/index.tsx` after the hero section.  
When unset/other, or when role is `shop_staff`: render nothing — no placeholder, no stub message.

Note: `GET /reports/daily-summary` requires `shop_admin | shop_manager` — staff would get 403. The role guard prevents the card rendering for staff entirely.

### `src/components/DashboardKpiCard.tsx`

Minimal shell for this work stream. Displays a card with:
- Card title: "आज का सारांश" (Today's summary)
- Body: 3 stat rows (sales total, invoice count, stock value) — all show `Skeleton` while loading
- Data: fetched from existing `GET /api/v1/reports/daily-summary` endpoint (already built in Epic 5)
- Error state: silent (card renders nothing on error — KPI is informational)
- `staleTime: 60_000` (1 min — summary data doesn't need real-time refresh)

Card design: `backgroundColor: colors.white`, `borderRadius: radii.md`, `borderWidth: 1`, `borderColor: colors.border`, `padding: spacing.md`, `marginTop: spacing.md`.

---

## Files Changed

| File | Change |
|---|---|
| `apps/shopkeeper/app/(tabs)/_layout.tsx` | Add `more` tab at position 5; move `settings` to position 6 |
| `apps/shopkeeper/app/(tabs)/more.tsx` | **Create** — More menu screen |
| `apps/shopkeeper/app/(tabs)/index.tsx` | Add flag-gated `DashboardKpiCard` after hero section |
| `apps/shopkeeper/app/inventory/index.tsx` | Add horizontal quick-actions bar |
| `apps/shopkeeper/app/rate-lock/_layout.tsx` | **Create** — Stack navigator |
| `apps/shopkeeper/app/rate-lock/index.tsx` | **Create** — renders `RateLockListScreen` |
| `apps/shopkeeper/app/rate-lock/[id].tsx` | **Create** — renders `RateLockDetailScreen` |
| `apps/shopkeeper/src/components/DashboardKpiCard.tsx` | **Create** — flag-gated KPI card |

---

## Testing

### Smoke tests

**`apps/shopkeeper/test/more-screen.test.tsx`** (or `src/features/more/...` per project conventions):
- Renders 4 menu rows for owner role
- Hides rate-lock row for staff role
- Each row has `testID` matching its destination
- No Goldsmith brand string in rendered output (white-label invariant doesn't apply to shopkeeper, but no brand leakage to customer surfaces is still validated)

**`apps/shopkeeper/test/inventory-quick-actions.test.tsx`**:
- Renders 5 pill buttons
- Each pill has the correct Hindi label

### Quality gate (Class B)
- `pnpm --filter @goldsmith/shopkeeper typecheck` — 0 errors
- `pnpm --filter @goldsmith/shopkeeper lint` — 0 errors  
- `pnpm --filter @goldsmith/shopkeeper test` — all tests pass

### Runtime smoke test (mandatory pre-merge)
- Boot shopkeeper dev client
- Navigate to each of the 4 "More" menu rows and confirm the screen loads
- Navigate to inventory, confirm 5 quick-action pills render
- Confirm existing tabs (होम, इन्वेंटरी, बिलिंग, रिपोर्ट, सेटिंग्स) still function

---

## Ceremony checklist (Class B)

- [ ] `/superpowers:brainstorming` ✅ (this doc)
- [ ] `/superpowers:writing-plans` → commit plan
- [ ] TDD per-commit
- [ ] `/code-review` + `/security-review` (Codex substitute gate)
- [ ] Runtime smoke test on shopkeeper before merge
- [ ] `git push`
