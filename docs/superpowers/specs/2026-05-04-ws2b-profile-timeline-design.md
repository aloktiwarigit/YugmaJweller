# WS-2B: Customer-Mobile Profile Timeline
**Date:** 2026-05-04  
**Class:** B (compressed ceremony)  
**Story ref:** Phase 2 — Reachability, WS-2B  
**Plan ref:** `C:\Users\alokt\.claude\plans\you-are-a-principal-distributed-alpaca.md`

---

## Problem

The customer-mobile profile screen (`app/(tabs)/profile.tsx`) shows only name, phone, LoyaltyPointsCard, delete-data, and logout. Customers have no way to see their purchase history, custom order status, rate-lock bookings, or try-at-home bookings from the app. Additionally, `app/browse/[productId].tsx` is an orphan stale artifact (canonical PDP is `[id].tsx`) that should be deleted.

---

## Scope

### In scope
- Delete `apps/customer-mobile/app/browse/[productId].tsx`
- Add 4 new `GET` endpoints to `CustomerController`: purchases, custom orders, rate-lock bookings, try-at-home bookings
- Extend `profile.tsx` with a 4-tab timeline section (खरीदारी / कस्टम ऑर्डर / दर-लॉक / ट्राई-एट-होम)
- New `src/components/timeline/` component set + `useCustomerTimeline` hooks

### Out of scope
- Reviews tab (customer-written reviews belong to WS-2E; no `getReviewsByCustomer` endpoint exists)
- Deep-link sub-routing to individual tabs (MVP: local state only)
- Push notification integration for booking status updates (WS-3B)

---

## API Layer

### New endpoints in `CustomerController` (same guard pattern as existing methods)

All endpoints use `@SkipAuth() @SkipTenant() @UseGuards(CustomerAuthGuard)`. Customer identity and `shopId` come from `getCustomerCtx(req)`. Tenant context is built via `buildSyntheticCtx`.

#### `GET /api/v1/customer/purchases`
```
Query: limit (max 50, default 20), offset (default 0)
Response: { invoices: PurchaseHistorySummary[], total: number }
Service: historyService.getPurchaseHistory(ctx, customerId, { limit, offset })
```
`HistoryService` already exists in `CrmModule` — inject it into `CustomerModule` via module import.

#### `GET /api/v1/customer/custom-orders`
```
Query: limit (max 50, default 20), offset (default 0)
Response: { orders: CustomerCustomOrderItem[], total: number }
Service: customOrdersService.getOrdersForCustomer(customerId, { limit, offset })
```
New read-only method on `CustomOrdersService`. Returns: `id`, `status`, `description`, `metalType`, `estimatedValuePaise`, `createdAt`, `updatedAt`.

#### `GET /api/v1/customer/rate-lock/bookings`
```
Query: limit (max 50, default 20), offset (default 0)
Response: { bookings: CustomerRateLockItem[], total: number }
Service: rateLockSvc.getBookingsForCustomer(customerId, { limit, offset })
```
New read-only method on `RateLockBookingsService`. Returns: `id`, `status`, `lockedRate24kPaisePerGram`, `depositAmountPaise`, `expiresAt`, `createdAt`.

#### `GET /api/v1/customer/try-at-home/bookings`
```
Query: limit (max 50, default 20), offset (default 0)
Response: { bookings: CustomerTryAtHomeItem[], total: number }
Service: taSvc.getBookingsForCustomer(customerId, { limit, offset })
```
New read-only method on `TryAtHomeBookingsService`. Returns: `id`, `status`, `productIds`, `requestedAt`, `dispatchAt`, `returnDueAt`, `notes`.

### Pagination contract
- Offset-based: `?limit=20&offset=0`, `?limit=20&offset=20`, etc.
- Response always includes `total` for "load more" button visibility decision
- Max `limit` capped at 50 server-side (Zod validation)

---

## Screen Architecture

### `app/(tabs)/profile.tsx` — updated layout

```
TenantBrandHeader        (fixed, existing)
ScrollView (nestedScrollEnabled)
  ProfileHeaderBlock     (name + phone, existing)
  LoyaltyPointsCard      (existing)
  ── divider ──
  TimelineTabBar         (4 pill tabs, horizontally scrollable)
  [active tab content]   (lazy-mounted, stays mounted after first activation)
    TimelinePurchases
    TimelineCustomOrders
    TimelineRateLocks
    TimelineTryAtHome
  ── divider ──
  DeleteDataButton       (existing, moves to bottom)
  LogoutButton           (existing)
```

**Tab state:** `const [activeTab, setActiveTab] = useState<TimelineTab>('purchases')` — local to `profile.tsx`. No URL state, no context.

**Lazy mount + stay mounted:** Each timeline component is only rendered after its tab is first activated (`hasActivated` ref per tab). Once mounted it stays mounted to preserve TanStack Query cache and avoid refetch on tab switch.

### New files

```
apps/customer-mobile/src/components/timeline/
  TimelineTabBar.tsx
  TimelinePurchases.tsx
  TimelineCustomOrders.tsx
  TimelineRateLocks.tsx
  TimelineTryAtHome.tsx
  TimelineCard.tsx           shared card shell
  TimelineEmptyState.tsx     shared empty state
  TimelineSkeleton.tsx       shared loading skeleton (3 pulsing rows)

apps/customer-mobile/src/hooks/
  useCustomerTimeline.ts     4 exported query hooks + shared fetch utility

apps/customer-mobile/src/api/endpoints.ts
  (4 new GET functions appended at bottom)
```

### Deleted
`apps/customer-mobile/app/browse/[productId].tsx`

---

## UI Components

### `TimelineTabBar`

- Horizontal `ScrollView` with `showsHorizontalScrollIndicator={false}`
- Each tab: `Pressable`, `minHeight: 48`, `paddingHorizontal: spacing.md`, `borderRadius: radii.full`
- Active: `backgroundColor: colors.primary`, `color: colors.white`
- Inactive: `backgroundColor: colors.white`, `color: colors.inkMute`, `borderWidth: 1`, `borderColor: colors.border`
- Font: `typography.body.family` (Noto Sans Devanagari)

| Tab ID | Hindi label |
|---|---|
| `purchases` | खरीदारी |
| `custom-orders` | कस्टम ऑर्डर |
| `rate-locks` | दर-लॉक |
| `try-at-home` | ट्राई-एट-होम |

### `TimelineCard`

Shared card shell, all four list components render this:

```
┌──────────────────────────────────────────────────┐
│ [StatusChip]                        [Date string] │
│ Bold title line                                   │
│ Sub-line: amount / product count / deposit        │
└──────────────────────────────────────────────────┘
```

- `minHeight: 72`, `padding: spacing.md`, `borderRadius: radii.md`
- `borderWidth: 1`, `borderColor: colors.border`
- `marginBottom: spacing.sm`
- Font: Noto Sans Devanagari throughout
- Date formatted: `dd MMM yyyy` in `hi-IN` locale via `Intl.DateTimeFormat`

### Status chip colors

| Status value | Hindi label | Background |
|---|---|---|
| `COMPLETED` / `PAID` | पूर्ण | `#2D6A4F` |
| `PENDING` / `PENDING_PAYMENT` | लंबित | `#B8860B` |
| `ACTIVE` | सक्रिय | `#1D4ED8` |
| `CANCELLED` / `EXPIRED` | रद्द / समाप्त | `#6B7280` |
| `IN_TRY_AT_HOME` | जारी है | `#7C3AED` |

Chip: `paddingHorizontal: 8`, `paddingVertical: 3`, `borderRadius: radii.pill`, `color: white`, font size 12.

### `TimelineEmptyState`

| Tab | Icon | Hindi headline | Sub-text |
|---|---|---|---|
| purchases | 🧾 | अभी तक कोई खरीदारी नहीं | दुकान पर जाएं और अपनी पहली खरीद करें |
| custom-orders | 💍 | कोई कस्टम ऑर्डर नहीं | अपने सपनों का गहना बनवाएं |
| rate-locks | 🔒 | कोई दर-लॉक नहीं | सोने की कीमत लॉक करें, बाद में खरीदें |
| try-at-home | 🏠 | कोई ट्राई-एट-होम बुकिंग नहीं | घर पर गहने देखें और पसंद करें |

Centred layout, icon at 40px, headline 18pt bold, sub-text 14pt `colors.inkMute`.

### `TimelineSkeleton`

3 rows of `TimelineCard` shape with pulsing `Animated.Value` opacity (0.3 → 0.8 loop). No content, only placeholder geometry.

### Error state

Shared inline: `"डेटा लोड नहीं हो सका। पुनः प्रयास करें।"` + `Pressable` retry button calling `refetch()`. `colors.error` for message, `colors.border` outlined button.

### "Load more" button

Rendered at bottom of each list when `offset + items.length < total`:
- Label: `"और देखें"` (Hindi: "see more")
- `minHeight: 48`, full-width outlined button
- On press: appends next page via offset increment, merges into existing `items` array in local state

---

## Data hooks (`useCustomerTimeline.ts`)

Four named exports, each wrapping a TanStack Query `useQuery`:

```ts
export function usePurchases(opts: PaginationOpts)
export function useCustomOrders(opts: PaginationOpts)
export function useRateLocks(opts: PaginationOpts)
export function useTryAtHomeBookings(opts: PaginationOpts)
```

- `staleTime: 30_000` (30s — aligns with global sync cadence)
- `retry: 2`
- `queryKey` includes `['customer-timeline', tab, shopId, limit, offset]`
- Load-more: local `offset` state in each timeline component; on "और देखें" tap, re-query with new offset and append results

---

## Testing

### API — `customer-timeline.controller.spec.ts`
For each of the 4 endpoints:
- Happy path: returns paginated list with correct shape
- Empty: returns `{ invoices/orders/bookings: [], total: 0 }` per endpoint's key (no 404)
- Pagination: `offset=20` returns correct slice
- Cross-tenant isolation: customer JWT from shop A cannot read shop B data (expect 401/403 or empty)
- Invalid limit (> 50): returns 400

### Mobile — component unit tests (`__tests__/`)
- `TimelineTabBar`: renders 4 pills, active pill has gold background, tap switches active
- `TimelineCard`: renders status chip with correct color mapping for all 5 status values
- `TimelineEmptyState`: renders correct Hindi copy for each tab variant
- `useCustomerTimeline` hooks: mock API, assert loading → data → load-more append flow

### Smoke test (runtime gate)
1. Boot customer-mobile dev client
2. Sign in as test customer
3. Navigate to Profile tab — confirm header + loyalty card + tab bar renders
4. Tap each of the 4 tabs — confirm empty state renders, no crash
5. Confirm browsing to `browse/[id]` (canonical PDP) still works after `[productId].tsx` deletion

---

## Module wiring

- `HistoryService` lives in `CrmModule` — add `CrmModule` to `CustomerModule` imports, or export `HistoryService` from `CrmModule` and import in `CustomerModule`. Prefer export approach to avoid circular deps.
- `CustomOrdersService`, `RateLockBookingsService`, `TryAtHomeBookingsService` — already imported in `CustomerController` (rate-lock + try-at-home). Add `CustomOrdersModule` import and inject `CustomOrdersService`.
- All new `@Inject()` decorators must use value tokens, not `import type` — per project invariant.

---

## Ceremony checklist (Class B)

- [ ] `/superpowers:brainstorming` ✅ (this doc)
- [ ] `/superpowers:writing-plans` → commit plan
- [ ] TDD per-commit (red → green → refactor)
- [ ] `/code-review` + `/security-review` (Codex substitute gate, Codex near-exhausted)
- [ ] Runtime smoke test on customer-mobile before merge
- [ ] `git push`
