# WS-2B: Customer-Mobile Profile Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-tab activity timeline (Purchases / Custom Orders / Rate-Locks / Try-at-Home) to the customer-mobile profile screen, backed by 4 new read-only GET endpoints in CustomerController, and delete the orphan `browse/[productId].tsx` route.

**Architecture:** New GET endpoints are added to the existing `CustomerController` using the same `@SkipAuth() @SkipTenant() @UseGuards(CustomerAuthGuard)` pattern. Three services get new read-only `getBookingsForCustomer`/`getOrdersForCustomer` methods using `withShopTx` for RLS. The profile screen gets a tab-switcher using local `useState` with each timeline section lazy-mounted via a `hasActivated` ref map to preserve TanStack Query cache across tab switches.

**Tech Stack:** NestJS + pg + Zod (API); React Native (Expo) + NativeWind + TanStack Query v5 + axios-mock-adapter (mobile); vitest + @testing-library/react (tests)

---

## File map

### API — modified
| File | Change |
|---|---|
| `apps/api/src/modules/crm/crm.module.ts` | Add `HistoryService` to `exports` array |
| `apps/api/src/modules/custom-orders/custom-orders.service.ts` | Add `CustomerCustomOrderItem` interface + `getOrdersForCustomer()` |
| `apps/api/src/modules/custom-orders/custom-orders.service.spec.ts` | **Create** — unit tests for `getOrdersForCustomer` |
| `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts` | Add `CustomerRateLockItem` interface + `getBookingsForCustomer()` |
| `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts` | Extend with tests for `getBookingsForCustomer` |
| `apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.ts` | Add `getBookingsForCustomer()` |
| `apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.spec.ts` | **Create** — unit tests for `getBookingsForCustomer` |
| `apps/api/src/modules/customer/customer.module.ts` | Add `CrmModule` + `CustomOrdersModule` to `imports` |
| `apps/api/src/modules/customer/customer.controller.ts` | Add `PaginationQuerySchema`, inject `HistoryService`+`CustomOrdersService`, add 4 GET handlers |
| `apps/api/src/modules/customer/customer.controller.spec.ts` | Extend with tests for 4 new endpoints |

### Mobile — new + modified
| File | Change |
|---|---|
| `apps/customer-mobile/src/api/endpoints.ts` | Add 4 GET functions + 4 response interfaces |
| `apps/customer-mobile/src/api/endpoints.test.ts` | Extend with tests for new GET functions |
| `apps/customer-mobile/src/hooks/useCustomerTimeline.ts` | **Create** — 4 TanStack Query hooks |
| `apps/customer-mobile/src/hooks/useCustomerTimeline.test.tsx` | **Create** — hook tests |
| `apps/customer-mobile/src/components/timeline/TimelineCard.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineCard.test.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineEmptyState.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineEmptyState.test.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineSkeleton.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineTabBar.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineTabBar.test.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelinePurchases.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineCustomOrders.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineRateLocks.tsx` | **Create** |
| `apps/customer-mobile/src/components/timeline/TimelineTryAtHome.tsx` | **Create** |
| `apps/customer-mobile/app/(tabs)/profile.tsx` | Refactor — embed tab-switcher + timeline sections |
| `apps/customer-mobile/app/browse/[productId].tsx` | **Delete** |

---

## Task 1: CrmModule export + CustomOrdersService.getOrdersForCustomer

**Files:**
- Modify: `apps/api/src/modules/crm/crm.module.ts:67`
- Modify: `apps/api/src/modules/custom-orders/custom-orders.service.ts`
- Create: `apps/api/src/modules/custom-orders/custom-orders.service.spec.ts`

- [ ] **Step 1: Export HistoryService from CrmModule**

In `apps/api/src/modules/crm/crm.module.ts`, update the `exports` line:

```ts
// before:
exports: [CrmService, CrmSearchService, FamilyService, NotesService, OccasionsService, DpdpaDeletionService, ConsentService],
// after:
exports: [CrmService, CrmSearchService, FamilyService, HistoryService, NotesService, OccasionsService, DpdpaDeletionService, ConsentService],
```

- [ ] **Step 2: Write failing tests for `getOrdersForCustomer`**

Create `apps/api/src/modules/custom-orders/custom-orders.service.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SHOP     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER = 'cccccccc-cccc-4000-8000-000000000001';

vi.mock('@goldsmith/db', () => ({
  withShopTx: vi.fn(),
  withTenantTx: vi.fn(),
}));
vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: { CUSTOM_ORDER_CREATED: 'CUSTOM_ORDER_CREATED' },
}));
vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: { requireCurrent: vi.fn(), current: vi.fn() },
}));
vi.mock('@goldsmith/compliance', () => ({
  enforce269ss: vi.fn(),
  ComplianceHardBlockError: class {},
}));
vi.mock('@goldsmith/observability', () => ({ trackEvent: vi.fn() }));

import { withShopTx } from '@goldsmith/db';
import { CustomOrdersService } from './custom-orders.service';

function makeService() {
  return new CustomOrdersService(
    { query: vi.fn() } as never,   // PG_POOL
    { insert: vi.fn(), findById: vi.fn(), listByShop: vi.fn(),
      insertMilestone: vi.fn(), getMilestones: vi.fn(),
      updateStatus: vi.fn(), updateRazorpayOrder: vi.fn(),
      updateRazorpayPayment: vi.fn() } as never,  // CustomOrdersRepository
    { createOrder: vi.fn(), verifySignature: vi.fn() } as never, // PAYMENTS_ADAPTER
    { upload: vi.fn(), getUrl: vi.fn(), delete: vi.fn() } as never, // STORAGE_PORT
  );
}

describe('CustomOrdersService.getOrdersForCustomer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped orders and total', async () => {
    const fakeRow = {
      id: 'ord-1', status: 'IN_PROGRESS', description: 'Gold ring',
      quoted_amount_paise: 100000n, deposit_amount_paise: 20000n,
      estimated_delivery_date: null,
      created_at: new Date('2026-04-01T10:00:00.000Z'),
    };
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [fakeRow] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const result = await makeService().getOrdersForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      id: 'ord-1',
      status: 'IN_PROGRESS',
      description: 'Gold ring',
      quotedAmountPaise: '100000',
      depositAmountPaise: '20000',
      estimatedDeliveryDate: null,
      createdAt: '2026-04-01T10:00:00.000Z',
    });
  });

  it('returns empty list when customer has no orders', async () => {
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const result = await makeService().getOrdersForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.orders).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('passes shopId and customerId as WHERE clause params', async () => {
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, shopId, fn) => {
      expect(shopId).toBe(SHOP);
      return fn(mockTx as never);
    });

    await makeService().getOrdersForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    const firstCall = mockTx.query.mock.calls[0]!;
    expect(firstCall[1]).toContain(CUSTOMER);
    expect(firstCall[1]).toContain(SHOP);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test src/modules/custom-orders/custom-orders.service.spec.ts
```
Expected: FAIL — `TypeError: makeService().getOrdersForCustomer is not a function`

- [ ] **Step 4: Add `CustomerCustomOrderItem` interface + `getOrdersForCustomer` to CustomOrdersService**

At the end of the interfaces section in `apps/api/src/modules/custom-orders/custom-orders.service.ts` (after the `MilestoneResponse` interface, before `function rowToResponse`), add:

```ts
export interface CustomerCustomOrderItem {
  id:                    string;
  status:                string;
  description:           string;
  quotedAmountPaise:     string | null;
  depositAmountPaise:    string;
  estimatedDeliveryDate: string | null;
  createdAt:             string;
}
```

At the very end of the `CustomOrdersService` class body, add:

```ts
async getOrdersForCustomer(
  customerId: string,
  shopId: string,
  params: { limit: number; offset: number },
): Promise<{ orders: CustomerCustomOrderItem[]; total: number }> {
  const [data, count] = await withShopTx(this.pool, shopId, (tx) =>
    Promise.all([
      tx.query<{
        id: string; status: string; description: string;
        quoted_amount_paise: bigint | null; deposit_amount_paise: bigint;
        estimated_delivery_date: string | null; created_at: Date;
      }>(
        `SELECT id, status, description, quoted_amount_paise, deposit_amount_paise,
                estimated_delivery_date, created_at
         FROM custom_orders
         WHERE customer_id = $1 AND shop_id = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [customerId, shopId, params.limit, params.offset],
      ),
      tx.query<{ count: string }>(
        `SELECT COUNT(*) FROM custom_orders WHERE customer_id = $1 AND shop_id = $2`,
        [customerId, shopId],
      ),
    ]),
  );
  return {
    orders: data.rows.map((r) => ({
      id:                    r.id,
      status:                r.status,
      description:           r.description,
      quotedAmountPaise:     r.quoted_amount_paise?.toString() ?? null,
      depositAmountPaise:    r.deposit_amount_paise.toString(),
      estimatedDeliveryDate: r.estimated_delivery_date,
      createdAt:             r.created_at.toISOString(),
    })),
    total: Number(count.rows[0]!.count),
  };
}
```

`withShopTx` is already imported at line 10 of the file.

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test src/modules/custom-orders/custom-orders.service.spec.ts
```
Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/crm/crm.module.ts \
        apps/api/src/modules/custom-orders/custom-orders.service.ts \
        apps/api/src/modules/custom-orders/custom-orders.service.spec.ts
git commit -m "feat(ws-2b): export HistoryService from CrmModule; add getOrdersForCustomer"
```

---

## Task 2: RateLockBookingsService + TryAtHomeBookingsService read methods

**Files:**
- Modify: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts`
- Modify: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts`
- Modify: `apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.ts`
- Create: `apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.spec.ts`

- [ ] **Step 1: Write failing test for `RateLockBookingsService.getBookingsForCustomer`**

Add to the end of `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts`:

```ts
describe('RateLockBookingsService.getBookingsForCustomer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped bookings and total', async () => {
    const fakeRow = {
      id: 'rl-1', status: 'ACTIVE',
      locked_rate_24k_paise_per_gram: 700000n,
      deposit_amount_paise: 50000n,
      expires_at: new Date('2026-05-05T10:00:00.000Z'),
      locked_at: new Date('2026-05-04T10:00:00.000Z'),
    };
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [fakeRow] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }),
    };
    // Use the withShopTx mock already set up at the top of the file.
    // Import withShopTx at top: import { withShopTx } from '@goldsmith/db';
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    // Construct service directly — same pattern as existing tests
    const svc = new RateLockBookingsService(
      makePool() as never,
      { getCurrentRatesForTenant: vi.fn().mockResolvedValue({
          GOLD_24K: { perGramPaise: 700000n, fetchedAt: new Date() },
        }) } as never,
      { createOrder: vi.fn(), verifySignature: vi.fn() } as never,
      { set: vi.fn().mockResolvedValue('OK') } as never,
    );

    const result = await svc.getBookingsForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]).toMatchObject({
      id: 'rl-1',
      status: 'ACTIVE',
      lockedRate24kPaisePerGram: '700000',
      depositAmountPaise: '50000',
      expiresAt: '2026-05-05T10:00:00.000Z',
      lockedAt: '2026-05-04T10:00:00.000Z',
    });
  });

  it('returns empty list when customer has no bookings', async () => {
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const svc = new RateLockBookingsService(
      makePool() as never,
      { getCurrentRatesForTenant: vi.fn() } as never,
      { createOrder: vi.fn(), verifySignature: vi.fn() } as never,
      { set: vi.fn().mockResolvedValue('OK') } as never,
    );

    const result = await svc.getBookingsForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.bookings).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
```

Also add `import { withShopTx } from '@goldsmith/db';` near the top of the spec (after the other imports), and add `vi.mock('@goldsmith/db', ...)` if it is not already mocked in that file.

Check the existing spec: the mock at the top should already have `vi.mock('@goldsmith/db', ...)`. If not, add:
```ts
vi.mock('@goldsmith/db', () => ({
  withShopTx: vi.fn(),
  withTenantTx: vi.fn(),
}));
```
And add `import { withShopTx } from '@goldsmith/db';` after the `vi.mock` calls.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts
```
Expected: FAIL — `TypeError: svc.getBookingsForCustomer is not a function`

- [ ] **Step 3: Add `CustomerRateLockItem` + `getBookingsForCustomer` to RateLockBookingsService**

Add interface after the existing `ActiveLockPeek` interface in `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts`:

```ts
export interface CustomerRateLockItem {
  id:                        string;
  status:                    string;
  lockedRate24kPaisePerGram: string;
  depositAmountPaise:        string;
  expiresAt:                 string;
  lockedAt:                  string;
}
```

Add at the end of the `RateLockBookingsService` class body:

```ts
async getBookingsForCustomer(
  customerId: string,
  shopId: string,
  params: { limit: number; offset: number },
): Promise<{ bookings: CustomerRateLockItem[]; total: number }> {
  const [data, count] = await withShopTx(this.pool, shopId, (tx) =>
    Promise.all([
      tx.query<{
        id: string; status: string;
        locked_rate_24k_paise_per_gram: bigint;
        deposit_amount_paise: bigint;
        expires_at: Date; locked_at: Date;
      }>(
        `SELECT id, status, locked_rate_24k_paise_per_gram, deposit_amount_paise,
                expires_at, locked_at
         FROM rate_lock_bookings
         WHERE customer_id = $1 AND shop_id = $2
         ORDER BY locked_at DESC
         LIMIT $3 OFFSET $4`,
        [customerId, shopId, params.limit, params.offset],
      ),
      tx.query<{ count: string }>(
        `SELECT COUNT(*) FROM rate_lock_bookings
         WHERE customer_id = $1 AND shop_id = $2`,
        [customerId, shopId],
      ),
    ]),
  );
  return {
    bookings: data.rows.map((r) => ({
      id:                        r.id,
      status:                    r.status,
      lockedRate24kPaisePerGram: r.locked_rate_24k_paise_per_gram.toString(),
      depositAmountPaise:        r.deposit_amount_paise.toString(),
      expiresAt:                 r.expires_at.toISOString(),
      lockedAt:                  r.locked_at.toISOString(),
    })),
    total: Number(count.rows[0]!.count),
  };
}
```

`withShopTx` is already imported at the top of this file.

- [ ] **Step 4: Write failing tests for `TryAtHomeBookingsService.getBookingsForCustomer`**

Create `apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SHOP     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER = 'cccccccc-cccc-4000-8000-000000000001';

vi.mock('@goldsmith/db', () => ({
  withShopTx: vi.fn(),
  withTenantTx: vi.fn(),
}));
vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: { TRY_AT_HOME_REQUESTED: 'TRY_AT_HOME_REQUESTED' },
}));
vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: { requireCurrent: vi.fn() },
}));

import { withShopTx } from '@goldsmith/db';
import { TryAtHomeBookingsService } from './try-at-home-bookings.service';

function makeService() {
  return new TryAtHomeBookingsService(
    { query: vi.fn() } as never,              // PG_POOL
    { insert: vi.fn(), findById: vi.fn(),
      list: vi.fn(), lockForUpdate: vi.fn(),
      updateStatusDispatch: vi.fn(),
      updateStatusReturn: vi.fn(),
      getPool: vi.fn() } as never,             // TryAtHomeBookingsRepository
    { getProduct: vi.fn() } as never,          // InventoryService
    { createInvoice: vi.fn() } as never,       // BillingService
    { getTryAtHome: vi.fn() } as never,        // SettingsRepository
  );
}

describe('TryAtHomeBookingsService.getBookingsForCustomer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped bookings and total', async () => {
    const fakeRow = {
      id: 'tah-1', shop_id: SHOP, customer_id: CUSTOMER,
      product_ids: ['p1', 'p2'], status: 'REQUESTED',
      requested_at: new Date('2026-05-01T08:00:00.000Z'),
      dispatch_at: null, return_due_at: null, notes: 'Handle carefully',
    };
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [fakeRow] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const result = await makeService().getBookingsForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]).toMatchObject({
      id: 'tah-1',
      status: 'REQUESTED',
      productIds: ['p1', 'p2'],
      requestedAt: '2026-05-01T08:00:00.000Z',
      dispatchAt: null,
      returnDueAt: null,
      notes: 'Handle carefully',
    });
  });

  it('returns empty list when customer has no bookings', async () => {
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const result = await makeService().getBookingsForCustomer(CUSTOMER, SHOP, { limit: 20, offset: 0 });

    expect(result.bookings).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

```bash
pnpm --filter @goldsmith/api test src/modules/try-at-home-bookings/try-at-home-bookings.service.spec.ts
```
Expected: FAIL — `TypeError: makeService().getBookingsForCustomer is not a function`

- [ ] **Step 6: Add `getBookingsForCustomer` to TryAtHomeBookingsService**

At the end of the `TryAtHomeBookingsService` class in `apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.ts`, add:

```ts
async getBookingsForCustomer(
  customerId: string,
  shopId: string,
  params: { limit: number; offset: number },
): Promise<{ bookings: BookingResponse[]; total: number }> {
  const [data, count] = await withShopTx(this.pool, shopId, (tx) =>
    Promise.all([
      tx.query<TryAtHomeBookingRow>(
        `SELECT id, shop_id, customer_id, product_ids, status,
                requested_at, dispatch_at, return_due_at, notes
         FROM try_at_home_bookings
         WHERE customer_id = $1 AND shop_id = $2
         ORDER BY requested_at DESC
         LIMIT $3 OFFSET $4`,
        [customerId, shopId, params.limit, params.offset],
      ),
      tx.query<{ count: string }>(
        `SELECT COUNT(*) FROM try_at_home_bookings
         WHERE customer_id = $1 AND shop_id = $2`,
        [customerId, shopId],
      ),
    ]),
  );
  return {
    bookings: data.rows.map(rowToResponse),
    total: Number(count.rows[0]!.count),
  };
}
```

`withShopTx`, `TryAtHomeBookingRow`, and `rowToResponse` are all already defined/imported in this file.

- [ ] **Step 7: Run all three service specs together**

```bash
pnpm --filter @goldsmith/api test src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts src/modules/try-at-home-bookings/try-at-home-bookings.service.spec.ts
```
Expected: PASS (all new tests pass; pre-existing tests unaffected)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts \
        apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts \
        apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.ts \
        apps/api/src/modules/try-at-home-bookings/try-at-home-bookings.service.spec.ts
git commit -m "feat(ws-2b): add getBookingsForCustomer to RateLock + TryAtHome services"
```

---

## Task 3: CustomerModule wiring + CustomerController timeline endpoints

**Files:**
- Modify: `apps/api/src/modules/customer/customer.module.ts`
- Modify: `apps/api/src/modules/customer/customer.controller.ts`
- Modify: `apps/api/src/modules/customer/customer.controller.spec.ts`

- [ ] **Step 1: Write failing tests for the 4 new endpoints**

Add to the end of `apps/api/src/modules/customer/customer.controller.spec.ts`.

First, add new mock services at the top (alongside the existing `mockLoyaltySvc`, `mockRateLockSvc`, `mockTaSvc`):

```ts
const mockHistorySvc = {
  getPurchaseHistory: vi.fn(),
};

const mockCustomOrdersSvc = {
  getOrdersForCustomer: vi.fn(),
};
```

Update the `makeCtrl()` helper to pass the two new mocks (add them after `mockTaSvc` in the constructor call):

```ts
function makeCtrl() {
  mockPool.query.mockResolvedValue({
    rows: [{ slug: 'test-shop', display_name: 'Test Shop', status: 'ACTIVE' }],
  });
  return new CustomerController(
    mockPool as never,
    mockLoyaltySvc as never,
    mockRateLockSvc as never,
    mockTaSvc as never,
    mockHistorySvc as never,
    mockCustomOrdersSvc as never,
  );
}
```

Add the following test blocks after the existing `createTryAtHomeBooking` block:

```ts
describe('getPurchases', () => {
  it('returns purchase history from HistoryService', async () => {
    const history = { invoices: [{ invoiceId: 'inv-1', invoiceNumber: 'INV-001',
      issuedAt: '2026-04-01T10:00:00.000Z', totalPaise: '250000', status: 'PAID' }], total: 1 };
    mockHistorySvc.getPurchaseHistory.mockResolvedValue(history);

    const ctrl   = makeCtrl();
    const result = await ctrl.getPurchases(fakeReq(), { limit: 20, offset: 0 });

    expect(result).toEqual(history);
    expect(mockHistorySvc.getPurchaseHistory).toHaveBeenCalledWith(
      expect.objectContaining({ authenticated: true }),
      DEV_CUSTOMER_ID,
      { limit: 20, offset: 0 },
    );
  });
});

describe('getCustomOrders', () => {
  it('returns custom orders from CustomOrdersService', async () => {
    const orders = { orders: [{ id: 'ord-1', status: 'IN_PROGRESS', description: 'Ring',
      quotedAmountPaise: '100000', depositAmountPaise: '20000',
      estimatedDeliveryDate: null, createdAt: '2026-04-01T10:00:00.000Z' }], total: 1 };
    mockCustomOrdersSvc.getOrdersForCustomer.mockResolvedValue(orders);

    const ctrl   = makeCtrl();
    const result = await ctrl.getCustomOrders(fakeReq(), { limit: 20, offset: 0 });

    expect(result).toEqual(orders);
    expect(mockCustomOrdersSvc.getOrdersForCustomer).toHaveBeenCalledWith(
      DEV_CUSTOMER_ID, SHOP_ID, { limit: 20, offset: 0 },
    );
  });
});

describe('getRateLockBookings', () => {
  it('returns rate lock bookings from RateLockBookingsService', async () => {
    const bookings = { bookings: [{ id: 'rl-1', status: 'ACTIVE',
      lockedRate24kPaisePerGram: '700000', depositAmountPaise: '50000',
      expiresAt: '2026-05-05T10:00:00.000Z', lockedAt: '2026-05-04T10:00:00.000Z' }], total: 1 };
    mockRateLockSvc.getBookingsForCustomer.mockResolvedValue(bookings);

    const ctrl   = makeCtrl();
    const result = await ctrl.getRateLockBookings(fakeReq(), { limit: 20, offset: 0 });

    expect(result).toEqual(bookings);
    expect(mockRateLockSvc.getBookingsForCustomer).toHaveBeenCalledWith(
      DEV_CUSTOMER_ID, SHOP_ID, { limit: 20, offset: 0 },
    );
  });
});

describe('getTryAtHomeBookings', () => {
  it('returns try-at-home bookings from TryAtHomeBookingsService', async () => {
    const bookings = { bookings: [{ id: 'tah-1', shopId: SHOP_ID, customerId: DEV_CUSTOMER_ID,
      productIds: ['p1'], status: 'REQUESTED', requestedAt: '2026-05-01T08:00:00.000Z',
      dispatchAt: null, returnDueAt: null, notes: null }], total: 1 };
    mockTaSvc.getBookingsForCustomer.mockResolvedValue(bookings);

    const ctrl   = makeCtrl();
    const result = await ctrl.getTryAtHomeBookings(fakeReq(), { limit: 20, offset: 0 });

    expect(result).toEqual(bookings);
    expect(mockTaSvc.getBookingsForCustomer).toHaveBeenCalledWith(
      DEV_CUSTOMER_ID, SHOP_ID, { limit: 20, offset: 0 },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @goldsmith/api test src/modules/customer/customer.controller.spec.ts
```
Expected: FAIL — `makeCtrl` constructor arity mismatch / new methods not found

- [ ] **Step 3: Update CustomerModule to import CrmModule + CustomOrdersModule**

Replace the full `apps/api/src/modules/customer/customer.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { CustomOrdersModule } from '../custom-orders/custom-orders.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { RateLockBookingsModule } from '../rate-lock-bookings/rate-lock-bookings.module';
import { TryAtHomeBookingsModule } from '../try-at-home-bookings/try-at-home-bookings.module';
import { CustomerController } from './customer.controller';
import { CustomerAuthGuard } from './customer-auth.guard';

@Module({
  imports: [
    AuthModule,
    CrmModule,
    CustomOrdersModule,
    LoyaltyModule,
    RateLockBookingsModule,
    TryAtHomeBookingsModule,
  ],
  controllers: [CustomerController],
  providers:   [CustomerAuthGuard],
})
export class CustomerModule {}
```

- [ ] **Step 4: Add `PaginationQuerySchema` + 4 GET handlers to CustomerController**

At the top of `apps/api/src/modules/customer/customer.controller.ts`, add to the existing imports:

```ts
import { Get, Query } from '@nestjs/common';  // add Get, Query to the existing nestjs import
```
(already has `Get` from the payment page handler — just add `Query` if not already there)

Add after the existing schema definitions (after `CreateTryAtHomeSchema`):

```ts
const PaginationQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
```

Add two new imports at the top of the file:

```ts
import { HistoryService } from '../crm/history.service';
import type { PurchaseHistoryResponse } from '../crm/history.service';
import { CustomOrdersService } from '../custom-orders/custom-orders.service';
import type { CustomerCustomOrderItem } from '../custom-orders/custom-orders.service';
import type { CustomerRateLockItem } from '../rate-lock-bookings/rate-lock-bookings.service';
```

Update the constructor in `CustomerController` — add two new injections after `this.taSvc`:

```ts
constructor(
  @Inject('PG_POOL')                 private readonly pool: Pool,
  @Inject(LoyaltyService)            private readonly loyaltySvc: LoyaltyService,
  @Inject(RateLockBookingsService)   private readonly rateLockSvc: RateLockBookingsService,
  @Inject(TryAtHomeBookingsService)  private readonly taSvc: TryAtHomeBookingsService,
  @Inject(HistoryService)            private readonly historySvc: HistoryService,
  @Inject(CustomOrdersService)       private readonly customOrdersSvc: CustomOrdersService,
) {}
```

Add the 4 new GET handlers after the `// ── Try-at-Home` section and before `// ── Rate-Lock Checkout Page`:

```ts
// ── Timeline: Purchases ───────────────────────────────────────────────────────

@Get('purchases')
async getPurchases(
  @Req() req: Request,
  @Query(new ZodValidationPipe(PaginationQuerySchema)) params: PaginationQuery,
): Promise<PurchaseHistoryResponse> {
  const { customerId, shopId } = getCustomerCtx(req);
  const ctx = await this.buildSyntheticCtx(shopId, customerId);
  return tenantContext.runWith(ctx, () =>
    this.historySvc.getPurchaseHistory(ctx, customerId, params),
  );
}

// ── Timeline: Custom Orders ───────────────────────────────────────────────────

@Get('custom-orders')
async getCustomOrders(
  @Req() req: Request,
  @Query(new ZodValidationPipe(PaginationQuerySchema)) params: PaginationQuery,
): Promise<{ orders: CustomerCustomOrderItem[]; total: number }> {
  const { customerId, shopId } = getCustomerCtx(req);
  return this.customOrdersSvc.getOrdersForCustomer(customerId, shopId, params);
}

// ── Timeline: Rate-Lock Bookings ──────────────────────────────────────────────

@Get('rate-lock/bookings')
async getRateLockBookings(
  @Req() req: Request,
  @Query(new ZodValidationPipe(PaginationQuerySchema)) params: PaginationQuery,
): Promise<{ bookings: CustomerRateLockItem[]; total: number }> {
  const { customerId, shopId } = getCustomerCtx(req);
  return this.rateLockSvc.getBookingsForCustomer(customerId, shopId, params);
}

// ── Timeline: Try-at-Home Bookings ────────────────────────────────────────────

@Get('try-at-home/bookings')
async getTryAtHomeBookings(
  @Req() req: Request,
  @Query(new ZodValidationPipe(PaginationQuerySchema)) params: PaginationQuery,
): Promise<{ bookings: BookingResponse[]; total: number }> {
  const { customerId, shopId } = getCustomerCtx(req);
  return this.taSvc.getBookingsForCustomer(customerId, shopId, params);
}
```

Note: `BookingResponse` is already imported from `try-at-home-bookings.service`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @goldsmith/api test src/modules/customer/customer.controller.spec.ts
```
Expected: PASS — all existing + 4 new tests

- [ ] **Step 6: Full API typecheck**

```bash
pnpm --filter @goldsmith/api typecheck
```
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/customer/customer.module.ts \
        apps/api/src/modules/customer/customer.controller.ts \
        apps/api/src/modules/customer/customer.controller.spec.ts
git commit -m "feat(ws-2b): add 4 timeline GET endpoints to CustomerController"
```

---

## Task 4: Mobile API client GET functions

**Files:**
- Modify: `apps/customer-mobile/src/api/endpoints.ts`
- Modify: `apps/customer-mobile/src/api/endpoints.test.ts`

- [ ] **Step 1: Write failing tests for 4 new endpoint functions**

Add to the end of `apps/customer-mobile/src/api/endpoints.test.ts`:

```ts
import {
  getPurchases,
  getCustomOrders,
  getRateLockBookings,
  getTryAtHomeBookings,
} from './endpoints';

describe('customer timeline endpoints', () => {
  let mock: MockAdapter;
  beforeEach(() => { mock = new MockAdapter(api); });
  afterEach(() => mock.reset());

  it('getPurchases returns invoices list', async () => {
    const payload = {
      invoices: [{ invoiceId: 'inv-1', invoiceNumber: 'INV-001',
        issuedAt: '2026-04-01T10:00:00.000Z', totalPaise: '250000', status: 'PAID' }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/purchases').reply(200, payload);
    const result = await getPurchases({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });

  it('getCustomOrders returns orders list', async () => {
    const payload = {
      orders: [{ id: 'ord-1', status: 'IN_PROGRESS', description: 'Ring',
        quotedAmountPaise: '100000', depositAmountPaise: '20000',
        estimatedDeliveryDate: null, createdAt: '2026-04-01T10:00:00.000Z' }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/custom-orders').reply(200, payload);
    const result = await getCustomOrders({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });

  it('getRateLockBookings returns bookings list', async () => {
    const payload = {
      bookings: [{ id: 'rl-1', status: 'ACTIVE',
        lockedRate24kPaisePerGram: '700000', depositAmountPaise: '50000',
        expiresAt: '2026-05-05T10:00:00.000Z', lockedAt: '2026-05-04T10:00:00.000Z' }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/rate-lock/bookings').reply(200, payload);
    const result = await getRateLockBookings({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });

  it('getTryAtHomeBookings returns bookings list', async () => {
    const payload = {
      bookings: [{ id: 'tah-1', shopId: 'shop-1', customerId: 'cust-1',
        productIds: ['p1'], status: 'REQUESTED',
        requestedAt: '2026-05-01T08:00:00.000Z',
        dispatchAt: null, returnDueAt: null, notes: null }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/try-at-home/bookings').reply(200, payload);
    const result = await getTryAtHomeBookings({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });
});
```

Also add `afterEach` import to the top: update the `import { describe, it, expect, beforeEach }` to include `afterEach`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @goldsmith/customer-mobile test src/api/endpoints.test.ts
```
Expected: FAIL — `getPurchases is not exported`

- [ ] **Step 3: Add response interfaces + 4 GET functions to endpoints.ts**

At the end of `apps/customer-mobile/src/api/endpoints.ts`, append:

```ts
// ── Customer timeline ─────────────────────────────────────────────────────────

export interface PurchaseHistorySummary {
  invoiceId:     string;
  invoiceNumber: string;
  issuedAt:      string | null;
  totalPaise:    string;
  status:        string;
}

export interface PurchasesResponse {
  invoices: PurchaseHistorySummary[];
  total:    number;
}

export interface CustomerCustomOrderItem {
  id:                    string;
  status:                string;
  description:           string;
  quotedAmountPaise:     string | null;
  depositAmountPaise:    string;
  estimatedDeliveryDate: string | null;
  createdAt:             string;
}

export interface CustomOrdersResponse {
  orders: CustomerCustomOrderItem[];
  total:  number;
}

export interface CustomerRateLockItem {
  id:                        string;
  status:                    string;
  lockedRate24kPaisePerGram: string;
  depositAmountPaise:        string;
  expiresAt:                 string;
  lockedAt:                  string;
}

export interface RateLockBookingsResponse {
  bookings: CustomerRateLockItem[];
  total:    number;
}

export interface CustomerTryAtHomeItem {
  id:          string;
  shopId:      string;
  customerId:  string;
  productIds:  string[];
  status:      string;
  requestedAt: string;
  dispatchAt:  string | null;
  returnDueAt: string | null;
  notes:       string | null;
}

export interface TryAtHomeBookingsListResponse {
  bookings: CustomerTryAtHomeItem[];
  total:    number;
}

export async function getPurchases(
  params: { limit?: number; offset?: number } = {},
): Promise<PurchasesResponse> {
  const res = await api.get<PurchasesResponse>('/api/v1/customer/purchases', { params });
  return res.data;
}

export async function getCustomOrders(
  params: { limit?: number; offset?: number } = {},
): Promise<CustomOrdersResponse> {
  const res = await api.get<CustomOrdersResponse>('/api/v1/customer/custom-orders', { params });
  return res.data;
}

export async function getRateLockBookings(
  params: { limit?: number; offset?: number } = {},
): Promise<RateLockBookingsResponse> {
  const res = await api.get<RateLockBookingsResponse>('/api/v1/customer/rate-lock/bookings', { params });
  return res.data;
}

export async function getTryAtHomeBookings(
  params: { limit?: number; offset?: number } = {},
): Promise<TryAtHomeBookingsListResponse> {
  const res = await api.get<TryAtHomeBookingsListResponse>('/api/v1/customer/try-at-home/bookings', { params });
  return res.data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @goldsmith/customer-mobile test src/api/endpoints.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/api/endpoints.ts \
        apps/customer-mobile/src/api/endpoints.test.ts
git commit -m "feat(ws-2b): add 4 customer timeline API functions to endpoints.ts"
```

---

## Task 5: useCustomerTimeline hooks

**Files:**
- Create: `apps/customer-mobile/src/hooks/useCustomerTimeline.ts`
- Create: `apps/customer-mobile/src/hooks/useCustomerTimeline.test.tsx`

- [ ] **Step 1: Write failing tests for the hooks**

Create `apps/customer-mobile/src/hooks/useCustomerTimeline.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/endpoints', () => ({
  getPurchases:          vi.fn(),
  getCustomOrders:       vi.fn(),
  getRateLockBookings:   vi.fn(),
  getTryAtHomeBookings:  vi.fn(),
}));

import {
  getPurchases, getCustomOrders, getRateLockBookings, getTryAtHomeBookings,
} from '../api/endpoints';
import {
  usePurchases, useCustomOrders, useRateLocks, useTryAtHomeBookings,
} from './useCustomerTimeline';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('usePurchases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns data on success', async () => {
    const payload = { invoices: [], total: 0 };
    vi.mocked(getPurchases).mockResolvedValue(payload);

    const { result } = renderHook(() => usePurchases({ limit: 20, offset: 0 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
  });

  it('surfaces error on failure', async () => {
    vi.mocked(getPurchases).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => usePurchases({ limit: 20, offset: 0 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCustomOrders', () => {
  it('calls getCustomOrders with correct params', async () => {
    vi.mocked(getCustomOrders).mockResolvedValue({ orders: [], total: 0 });

    renderHook(() => useCustomOrders({ limit: 10, offset: 20 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getCustomOrders).toHaveBeenCalledWith({ limit: 10, offset: 20 }));
  });
});

describe('useRateLocks', () => {
  it('calls getRateLockBookings', async () => {
    vi.mocked(getRateLockBookings).mockResolvedValue({ bookings: [], total: 0 });

    renderHook(() => useRateLocks({ limit: 20, offset: 0 }), { wrapper: createWrapper() });
    await waitFor(() => expect(getRateLockBookings).toHaveBeenCalled());
  });
});

describe('useTryAtHomeBookings', () => {
  it('calls getTryAtHomeBookings', async () => {
    vi.mocked(getTryAtHomeBookings).mockResolvedValue({ bookings: [], total: 0 });

    renderHook(() => useTryAtHomeBookings({ limit: 20, offset: 0 }), { wrapper: createWrapper() });
    await waitFor(() => expect(getTryAtHomeBookings).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @goldsmith/customer-mobile test src/hooks/useCustomerTimeline.test.tsx
```
Expected: FAIL — `Cannot find module './useCustomerTimeline'`

- [ ] **Step 3: Create `useCustomerTimeline.ts`**

Create `apps/customer-mobile/src/hooks/useCustomerTimeline.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import {
  getPurchases,
  getCustomOrders,
  getRateLockBookings,
  getTryAtHomeBookings,
} from '../api/endpoints';
import type {
  PurchasesResponse,
  CustomOrdersResponse,
  RateLockBookingsResponse,
  TryAtHomeBookingsListResponse,
} from '../api/endpoints';

interface PaginationOpts {
  limit:  number;
  offset: number;
}

export function usePurchases(opts: PaginationOpts) {
  return useQuery<PurchasesResponse>({
    queryKey:  ['customer-timeline', 'purchases', opts.limit, opts.offset],
    queryFn:   () => getPurchases(opts),
    staleTime: 30_000,
    retry:     2,
  });
}

export function useCustomOrders(opts: PaginationOpts) {
  return useQuery<CustomOrdersResponse>({
    queryKey:  ['customer-timeline', 'custom-orders', opts.limit, opts.offset],
    queryFn:   () => getCustomOrders(opts),
    staleTime: 30_000,
    retry:     2,
  });
}

export function useRateLocks(opts: PaginationOpts) {
  return useQuery<RateLockBookingsResponse>({
    queryKey:  ['customer-timeline', 'rate-locks', opts.limit, opts.offset],
    queryFn:   () => getRateLockBookings(opts),
    staleTime: 30_000,
    retry:     2,
  });
}

export function useTryAtHomeBookings(opts: PaginationOpts) {
  return useQuery<TryAtHomeBookingsListResponse>({
    queryKey:  ['customer-timeline', 'try-at-home', opts.limit, opts.offset],
    queryFn:   () => getTryAtHomeBookings(opts),
    staleTime: 30_000,
    retry:     2,
  });
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
pnpm --filter @goldsmith/customer-mobile test src/hooks/useCustomerTimeline.test.tsx
```
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/hooks/useCustomerTimeline.ts \
        apps/customer-mobile/src/hooks/useCustomerTimeline.test.tsx
git commit -m "feat(ws-2b): add useCustomerTimeline query hooks"
```

---

## Task 6: Timeline shared components (TimelineCard, TimelineEmptyState, TimelineSkeleton)

**Files:**
- Create: `apps/customer-mobile/src/components/timeline/TimelineCard.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineCard.test.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineEmptyState.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineEmptyState.test.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineSkeleton.tsx`

- [ ] **Step 1: Write failing tests for TimelineCard and TimelineEmptyState**

Create `apps/customer-mobile/src/components/timeline/TimelineCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TimelineCard } from './TimelineCard';

describe('TimelineCard', () => {
  it('renders title and sub-line', () => {
    const { getByTestId } = render(
      <TimelineCard
        status="COMPLETED"
        title="INV-001"
        subLine="₹2,500"
        date="01 May 2026"
      />,
    );
    expect(getByTestId('timeline-card-title').textContent).toBe('INV-001');
    expect(getByTestId('timeline-card-subline').textContent).toBe('₹2,500');
  });

  it('status chip shows correct Hindi label for COMPLETED', () => {
    const { getByTestId } = render(
      <TimelineCard status="COMPLETED" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('पूर्ण');
  });

  it('status chip shows correct Hindi label for PENDING_PAYMENT', () => {
    const { getByTestId } = render(
      <TimelineCard status="PENDING_PAYMENT" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('लंबित');
  });

  it('status chip shows correct Hindi label for ACTIVE', () => {
    const { getByTestId } = render(
      <TimelineCard status="ACTIVE" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('सक्रिय');
  });

  it('status chip shows correct Hindi label for CANCELLED', () => {
    const { getByTestId } = render(
      <TimelineCard status="CANCELLED" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('रद्द');
  });

  it('status chip shows correct Hindi label for IN_TRY_AT_HOME', () => {
    const { getByTestId } = render(
      <TimelineCard status="IN_TRY_AT_HOME" title="X" subLine="Y" date="01 May 2026" />,
    );
    expect(getByTestId('timeline-card-status').textContent).toBe('जारी है');
  });

  it('does not contain the string Goldsmith (white-label invariant)', () => {
    const { container } = render(
      <TimelineCard status="COMPLETED" title="Test" subLine="Test" date="01 May 2026" />,
    );
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });
});
```

Create `apps/customer-mobile/src/components/timeline/TimelineEmptyState.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TimelineEmptyState } from './TimelineEmptyState';

describe('TimelineEmptyState', () => {
  it('renders purchases empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="purchases" />);
    expect(container.textContent).toContain('अभी तक कोई खरीदारी नहीं');
    expect(container.textContent).toContain('दुकान पर जाएं');
  });

  it('renders custom-orders empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="custom-orders" />);
    expect(container.textContent).toContain('कोई कस्टम ऑर्डर नहीं');
  });

  it('renders rate-locks empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="rate-locks" />);
    expect(container.textContent).toContain('कोई दर-लॉक नहीं');
  });

  it('renders try-at-home empty state in Hindi', () => {
    const { container } = render(<TimelineEmptyState tab="try-at-home" />);
    expect(container.textContent).toContain('कोई ट्राई-एट-होम बुकिंग नहीं');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter @goldsmith/customer-mobile test src/components/timeline/TimelineCard.test.tsx src/components/timeline/TimelineEmptyState.test.tsx
```
Expected: FAIL — modules not found

- [ ] **Step 3: Create TimelineCard.tsx**

Create `apps/customer-mobile/src/components/timeline/TimelineCard.tsx`:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  COMPLETED:       { label: 'पूर्ण',     bg: '#2D6A4F' },
  PAID:            { label: 'पूर्ण',     bg: '#2D6A4F' },
  DELIVERED:       { label: 'पूर्ण',     bg: '#2D6A4F' },
  PENDING:         { label: 'लंबित',     bg: '#B8860B' },
  PENDING_PAYMENT: { label: 'लंबित',     bg: '#B8860B' },
  DEPOSIT_PENDING: { label: 'लंबित',     bg: '#B8860B' },
  ACTIVE:          { label: 'सक्रिय',    bg: '#1D4ED8' },
  IN_PROGRESS:     { label: 'जारी',      bg: '#1D4ED8' },
  REQUESTED:       { label: 'जारी',      bg: '#1D4ED8' },
  READY:           { label: 'तैयार',     bg: '#1D4ED8' },
  CANCELLED:       { label: 'रद्द',      bg: '#6B7280' },
  EXPIRED:         { label: 'समाप्त',    bg: '#6B7280' },
  USED:            { label: 'उपयोग हुआ', bg: '#6B7280' },
  IN_TRY_AT_HOME:  { label: 'जारी है',   bg: '#7C3AED' },
  DISPATCHED:      { label: 'भेजा गया',  bg: '#7C3AED' },
};

interface TimelineCardProps {
  status:  string;
  title:   string;
  subLine: string;
  date:    string;
}

export function TimelineCard({ status, title, subLine, date }: TimelineCardProps): React.ReactElement {
  const chip = STATUS_CONFIG[status] ?? { label: status, bg: '#6B7280' };
  return (
    <View
      style={{
        minHeight:       72,
        padding:         spacing.md,
        borderRadius:    radii.md,
        borderWidth:     1,
        borderColor:     colors.border,
        marginBottom:    spacing.sm,
        backgroundColor: colors.white,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <View
          testID="timeline-card-status"
          style={{
            backgroundColor:   chip.bg,
            paddingHorizontal: 8,
            paddingVertical:   3,
            borderRadius:      radii.pill,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 12, fontFamily: typography.body.family }}>
            {chip.label}
          </Text>
        </View>
        <Text style={{ color: colors.inkMute, fontSize: 12, fontFamily: typography.body.family }}>
          {date}
        </Text>
      </View>
      <Text
        testID="timeline-card-title"
        style={{
          fontFamily: typography.display.family,
          fontSize:   16,
          color:      colors.ink,
          marginBottom: spacing.xs,
        }}
      >
        {title}
      </Text>
      <Text
        testID="timeline-card-subline"
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}
      >
        {subLine}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Create TimelineEmptyState.tsx**

Create `apps/customer-mobile/src/components/timeline/TimelineEmptyState.tsx`:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

type TimelineTab = 'purchases' | 'custom-orders' | 'rate-locks' | 'try-at-home';

const EMPTY_COPY: Record<TimelineTab, { icon: string; headline: string; subtext: string }> = {
  'purchases':    { icon: '🧾', headline: 'अभी तक कोई खरीदारी नहीं', subtext: 'दुकान पर जाएं और अपनी पहली खरीद करें' },
  'custom-orders':{ icon: '💍', headline: 'कोई कस्टम ऑर्डर नहीं',    subtext: 'अपने सपनों का गहना बनवाएं' },
  'rate-locks':   { icon: '🔒', headline: 'कोई दर-लॉक नहीं',          subtext: 'सोने की कीमत लॉक करें, बाद में खरीदें' },
  'try-at-home':  { icon: '🏠', headline: 'कोई ट्राई-एट-होम बुकिंग नहीं', subtext: 'घर पर गहने देखें और पसंद करें' },
};

interface TimelineEmptyStateProps {
  tab: TimelineTab;
}

export function TimelineEmptyState({ tab }: TimelineEmptyStateProps): React.ReactElement {
  const { icon, headline, subtext } = EMPTY_COPY[tab];
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl ?? 32, paddingHorizontal: spacing.lg }}>
      <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{icon}</Text>
      <Text
        style={{
          fontFamily:   typography.display.family,
          fontSize:     18,
          fontWeight:   'bold',
          color:        colors.ink,
          textAlign:    'center',
          marginBottom: spacing.xs,
        }}
      >
        {headline}
      </Text>
      <Text
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}
      >
        {subtext}
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: Create TimelineSkeleton.tsx**

Create `apps/customer-mobile/src/components/timeline/TimelineSkeleton.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { colors, spacing, radii } from '@goldsmith/ui-tokens';

function SkeletonRow(): React.ReactElement {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        opacity,
        minHeight:       72,
        padding:         spacing.md,
        borderRadius:    radii.md,
        borderWidth:     1,
        borderColor:     colors.border,
        marginBottom:    spacing.sm,
        backgroundColor: colors.primaryLight,
      }}
    />
  );
}

export function TimelineSkeleton(): React.ReactElement {
  return (
    <View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter @goldsmith/customer-mobile test src/components/timeline/TimelineCard.test.tsx src/components/timeline/TimelineEmptyState.test.tsx
```
Expected: PASS — 7 + 4 = 11 tests

- [ ] **Step 7: Commit**

```bash
git add apps/customer-mobile/src/components/timeline/TimelineCard.tsx \
        apps/customer-mobile/src/components/timeline/TimelineCard.test.tsx \
        apps/customer-mobile/src/components/timeline/TimelineEmptyState.tsx \
        apps/customer-mobile/src/components/timeline/TimelineEmptyState.test.tsx \
        apps/customer-mobile/src/components/timeline/TimelineSkeleton.tsx
git commit -m "feat(ws-2b): add TimelineCard, TimelineEmptyState, TimelineSkeleton components"
```

---

## Task 7: TimelineTabBar + 4 content components

**Files:**
- Create: `apps/customer-mobile/src/components/timeline/TimelineTabBar.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineTabBar.test.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelinePurchases.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineCustomOrders.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineRateLocks.tsx`
- Create: `apps/customer-mobile/src/components/timeline/TimelineTryAtHome.tsx`

- [ ] **Step 1: Write failing test for TimelineTabBar**

Create `apps/customer-mobile/src/components/timeline/TimelineTabBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { TimelineTabBar } from './TimelineTabBar';

describe('TimelineTabBar', () => {
  it('renders all 4 Hindi tab labels', () => {
    const { container } = render(
      <TimelineTabBar activeTab="purchases" onTabChange={vi.fn()} />,
    );
    expect(container.textContent).toContain('खरीदारी');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('दर-लॉक');
    expect(container.textContent).toContain('ट्राई-एट-होम');
  });

  it('active tab has testID timeline-tab-active', () => {
    const { getByTestId } = render(
      <TimelineTabBar activeTab="rate-locks" onTabChange={vi.fn()} />,
    );
    expect(getByTestId('timeline-tab-active').textContent).toBe('दर-लॉक');
  });

  it('calls onTabChange with correct tab id when tapped', () => {
    const onTabChange = vi.fn();
    const { getByTestId } = render(
      <TimelineTabBar activeTab="purchases" onTabChange={onTabChange} />,
    );
    fireEvent.click(getByTestId('timeline-tab-custom-orders'));
    expect(onTabChange).toHaveBeenCalledWith('custom-orders');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @goldsmith/customer-mobile test src/components/timeline/TimelineTabBar.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create TimelineTabBar.tsx**

Create `apps/customer-mobile/src/components/timeline/TimelineTabBar.tsx`:

```tsx
import React from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

export type TimelineTab = 'purchases' | 'custom-orders' | 'rate-locks' | 'try-at-home';

const TABS: { id: TimelineTab; label: string }[] = [
  { id: 'purchases',    label: 'खरीदारी' },
  { id: 'custom-orders',label: 'कस्टम ऑर्डर' },
  { id: 'rate-locks',   label: 'दर-लॉक' },
  { id: 'try-at-home',  label: 'ट्राई-एट-होम' },
];

interface TimelineTabBarProps {
  activeTab:   TimelineTab;
  onTabChange: (tab: TimelineTab) => void;
}

export function TimelineTabBar({ activeTab, onTabChange }: TimelineTabBarProps): React.ReactElement {
  return (
    <View style={{ paddingVertical: spacing.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              testID={isActive ? 'timeline-tab-active' : `timeline-tab-${tab.id}`}
              onPress={() => onTabChange(tab.id)}
              style={{
                minHeight:         48,
                paddingHorizontal: spacing.md,
                paddingVertical:   spacing.sm,
                borderRadius:      radii.pill,
                justifyContent:    'center',
                backgroundColor:   isActive ? colors.primary : colors.white,
                borderWidth:       isActive ? 0 : 1,
                borderColor:       colors.border,
              }}
            >
              <Text
                style={{
                  fontFamily: typography.body.family,
                  fontSize:   14,
                  color:      isActive ? colors.white : colors.inkMute,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/customer-mobile test src/components/timeline/TimelineTabBar.test.tsx
```
Expected: PASS — 3 tests

- [ ] **Step 5: Create the 4 content components**

Create `apps/customer-mobile/src/components/timeline/TimelinePurchases.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TimelineCard } from './TimelineCard';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSkeleton } from './TimelineSkeleton';
import { usePurchases } from '../../hooks/useCustomerTimeline';

const PAGE = 20;

export function TimelinePurchases(): React.ReactElement {
  const [offset, setOffset] = useState(0);
  const [allItems, setAllItems] = useState<ReturnType<typeof usePurchases>['data'] extends { invoices: infer T } ? T : never[]>([]);
  const { data, isLoading, isError, refetch } = usePurchases({ limit: PAGE, offset });

  React.useEffect(() => {
    if (data?.invoices) {
      setAllItems((prev) => offset === 0 ? data.invoices : [...prev, ...data.invoices]);
    }
  }, [data, offset]);

  if (isLoading && allItems.length === 0) return <TimelineSkeleton />;
  if (isError) return (
    <View style={{ padding: spacing.lg, alignItems: 'center' }}>
      <Text style={{ fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm }}>
        डेटा लोड नहीं हो सका। पुनः प्रयास करें।
      </Text>
      <Pressable onPress={() => { void refetch(); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>पुनः प्रयास</Text>
      </Pressable>
    </View>
  );
  if (!isLoading && allItems.length === 0) return <TimelineEmptyState tab="purchases" />;

  const total = data?.total ?? allItems.length;
  const hasMore = offset + allItems.length < total;

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: spacing.lg }}>
      {allItems.map((inv) => (
        <TimelineCard
          key={inv.invoiceId}
          status={inv.status}
          title={inv.invoiceNumber}
          subLine={`₹${Math.round(Number(inv.totalPaise) / 100).toLocaleString('en-IN')}`}
          date={inv.issuedAt ? new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(inv.issuedAt)) : '—'}
        />
      ))}
      {hasMore && (
        <Pressable
          onPress={() => setOffset((o) => o + PAGE)}
          disabled={isLoading}
          style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>और देखें</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
```

Create `apps/customer-mobile/src/components/timeline/TimelineCustomOrders.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TimelineCard } from './TimelineCard';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useCustomOrders } from '../../hooks/useCustomerTimeline';
import type { CustomerCustomOrderItem } from '../../api/endpoints';

const PAGE = 20;

export function TimelineCustomOrders(): React.ReactElement {
  const [offset, setOffset]     = useState(0);
  const [allItems, setAllItems] = useState<CustomerCustomOrderItem[]>([]);
  const { data, isLoading, isError, refetch } = useCustomOrders({ limit: PAGE, offset });

  React.useEffect(() => {
    if (data?.orders) {
      setAllItems((prev) => offset === 0 ? data.orders : [...prev, ...data.orders]);
    }
  }, [data, offset]);

  if (isLoading && allItems.length === 0) return <TimelineSkeleton />;
  if (isError) return (
    <View style={{ padding: spacing.lg, alignItems: 'center' }}>
      <Text style={{ fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm }}>
        डेटा लोड नहीं हो सका। पुनः प्रयास करें।
      </Text>
      <Pressable onPress={() => { void refetch(); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>पुनः प्रयास</Text>
      </Pressable>
    </View>
  );
  if (!isLoading && allItems.length === 0) return <TimelineEmptyState tab="custom-orders" />;

  const total  = data?.total ?? allItems.length;
  const hasMore = offset + allItems.length < total;

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: spacing.lg }}>
      {allItems.map((order) => (
        <TimelineCard
          key={order.id}
          status={order.status}
          title={order.description.length > 40 ? order.description.slice(0, 40) + '…' : order.description}
          subLine={order.quotedAmountPaise
            ? `₹${Math.round(Number(order.quotedAmountPaise) / 100).toLocaleString('en-IN')}`
            : 'कोटेशन लंबित'}
          date={new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.createdAt))}
        />
      ))}
      {hasMore && (
        <Pressable
          onPress={() => setOffset((o) => o + PAGE)}
          disabled={isLoading}
          style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>और देखें</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
```

Create `apps/customer-mobile/src/components/timeline/TimelineRateLocks.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TimelineCard } from './TimelineCard';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useRateLocks } from '../../hooks/useCustomerTimeline';
import type { CustomerRateLockItem } from '../../api/endpoints';

const PAGE = 20;

export function TimelineRateLocks(): React.ReactElement {
  const [offset, setOffset]     = useState(0);
  const [allItems, setAllItems] = useState<CustomerRateLockItem[]>([]);
  const { data, isLoading, isError, refetch } = useRateLocks({ limit: PAGE, offset });

  React.useEffect(() => {
    if (data?.bookings) {
      setAllItems((prev) => offset === 0 ? data.bookings : [...prev, ...data.bookings]);
    }
  }, [data, offset]);

  if (isLoading && allItems.length === 0) return <TimelineSkeleton />;
  if (isError) return (
    <View style={{ padding: spacing.lg, alignItems: 'center' }}>
      <Text style={{ fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm }}>
        डेटा लोड नहीं हो सका। पुनः प्रयास करें।
      </Text>
      <Pressable onPress={() => { void refetch(); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>पुनः प्रयास</Text>
      </Pressable>
    </View>
  );
  if (!isLoading && allItems.length === 0) return <TimelineEmptyState tab="rate-locks" />;

  const total   = data?.total ?? allItems.length;
  const hasMore = offset + allItems.length < total;

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: spacing.lg }}>
      {allItems.map((booking) => (
        <TimelineCard
          key={booking.id}
          status={booking.status}
          title={`₹${Math.round(Number(booking.lockedRate24kPaisePerGram) / 100).toLocaleString('en-IN')}/g`}
          subLine={`जमा: ₹${Math.round(Number(booking.depositAmountPaise) / 100).toLocaleString('en-IN')}`}
          date={new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(booking.lockedAt))}
        />
      ))}
      {hasMore && (
        <Pressable
          onPress={() => setOffset((o) => o + PAGE)}
          disabled={isLoading}
          style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>और देखें</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
```

Create `apps/customer-mobile/src/components/timeline/TimelineTryAtHome.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TimelineCard } from './TimelineCard';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useTryAtHomeBookings } from '../../hooks/useCustomerTimeline';
import type { CustomerTryAtHomeItem } from '../../api/endpoints';

const PAGE = 20;

export function TimelineTryAtHome(): React.ReactElement {
  const [offset, setOffset]     = useState(0);
  const [allItems, setAllItems] = useState<CustomerTryAtHomeItem[]>([]);
  const { data, isLoading, isError, refetch } = useTryAtHomeBookings({ limit: PAGE, offset });

  React.useEffect(() => {
    if (data?.bookings) {
      setAllItems((prev) => offset === 0 ? data.bookings : [...prev, ...data.bookings]);
    }
  }, [data, offset]);

  if (isLoading && allItems.length === 0) return <TimelineSkeleton />;
  if (isError) return (
    <View style={{ padding: spacing.lg, alignItems: 'center' }}>
      <Text style={{ fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm }}>
        डेटा लोड नहीं हो सका। पुनः प्रयास करें।
      </Text>
      <Pressable onPress={() => { void refetch(); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>पुनः प्रयास</Text>
      </Pressable>
    </View>
  );
  if (!isLoading && allItems.length === 0) return <TimelineEmptyState tab="try-at-home" />;

  const total   = data?.total ?? allItems.length;
  const hasMore = offset + allItems.length < total;

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: spacing.lg }}>
      {allItems.map((booking) => (
        <TimelineCard
          key={booking.id}
          status={booking.status}
          title={`${booking.productIds.length} वस्तु${booking.productIds.length > 1 ? 'एं' : ''}`}
          subLine={booking.notes ?? ''}
          date={new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(booking.requestedAt))}
        />
      ))}
      {hasMore && (
        <Pressable
          onPress={() => setOffset((o) => o + PAGE)}
          disabled={isLoading}
          style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>और देखें</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 6: Run all component tests together**

```bash
pnpm --filter @goldsmith/customer-mobile test src/components/timeline/
```
Expected: PASS — 14 tests (7 TimelineCard + 4 EmptyState + 3 TabBar)

- [ ] **Step 7: Commit**

```bash
git add apps/customer-mobile/src/components/timeline/
git commit -m "feat(ws-2b): add TimelineTabBar + 4 content components"
```

---

## Task 8: Profile screen refactor + orphan delete + typecheck

**Files:**
- Modify: `apps/customer-mobile/app/(tabs)/profile.tsx`
- Delete: `apps/customer-mobile/app/browse/[productId].tsx`
- Create: `apps/customer-mobile/test/profile.test.tsx` (smoke test)

- [ ] **Step 1: Delete the orphan file**

```bash
git rm apps/customer-mobile/app/browse/\[productId\].tsx
```

- [ ] **Step 2: Write profile screen smoke test**

Create `apps/customer-mobile/test/profile.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all network calls
vi.mock('../src/api/endpoints', () => ({
  getPurchases:          vi.fn().mockResolvedValue({ invoices: [], total: 0 }),
  getCustomOrders:       vi.fn().mockResolvedValue({ orders: [], total: 0 }),
  getRateLockBookings:   vi.fn().mockResolvedValue({ bookings: [], total: 0 }),
  getTryAtHomeBookings:  vi.fn().mockResolvedValue({ bookings: [], total: 0 }),
  customerSelfDelete:    vi.fn(),
}));

vi.mock('../src/hooks/useCustomerSession', () => ({
  useCustomerSession: vi.fn(() => ({
    customer: { id: 'c1', name: 'राज', phoneE164: '+919999999999' },
    signOut: vi.fn(),
  })),
}));

vi.mock('../src/components/TenantBrandHeader', () => ({
  TenantBrandHeader: () => <div data-testid="tenant-brand-header" />,
}));

vi.mock('../src/components/LoyaltyPointsCard', () => ({
  LoyaltyPointsCard: () => <div data-testid="loyalty-card" />,
}));

import Profile from '../app/(tabs)/profile';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Profile screen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders brand header and loyalty card', () => {
    const { getByTestId } = render(<Profile />, { wrapper });
    expect(getByTestId('tenant-brand-header')).toBeTruthy();
    expect(getByTestId('loyalty-card')).toBeTruthy();
  });

  it('renders all 4 Hindi tab labels', () => {
    const { container } = render(<Profile />, { wrapper });
    expect(container.textContent).toContain('खरीदारी');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('दर-लॉक');
    expect(container.textContent).toContain('ट्राई-एट-होम');
  });

  it('does not contain the string Goldsmith (white-label invariant)', () => {
    const { container } = render(<Profile />, { wrapper });
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });

  it('renders delete-data and logout buttons below the timeline', () => {
    const { getByTestId } = render(<Profile />, { wrapper });
    expect(getByTestId('profile-delete-button')).toBeTruthy();
    expect(getByTestId('profile-signout-button')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/customer-mobile test test/profile.test.tsx
```
Expected: FAIL — profile doesn't render tab bar yet

- [ ] **Step 4: Refactor profile.tsx**

Replace `apps/customer-mobile/app/(tabs)/profile.tsx` entirely with:

```tsx
import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { LoyaltyPointsCard } from '../../src/components/LoyaltyPointsCard';
import { TimelineTabBar } from '../../src/components/timeline/TimelineTabBar';
import { TimelinePurchases } from '../../src/components/timeline/TimelinePurchases';
import { TimelineCustomOrders } from '../../src/components/timeline/TimelineCustomOrders';
import { TimelineRateLocks } from '../../src/components/timeline/TimelineRateLocks';
import { TimelineTryAtHome } from '../../src/components/timeline/TimelineTryAtHome';
import type { TimelineTab } from '../../src/components/timeline/TimelineTabBar';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { customerSelfDelete } from '../../src/api/endpoints';

export default function Profile(): React.ReactElement {
  const { customer, signOut } = useCustomerSession();
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [activeTab, setActiveTab] = useState<TimelineTab>('purchases');

  // Lazy-mount: each tab renders only after first activation, then stays mounted.
  const activated = useRef<Set<TimelineTab>>(new Set(['purchases']));
  const handleTabChange = (tab: TimelineTab): void => {
    activated.current.add(tab);
    setActiveTab(tab);
  };

  const onDelete = async (): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    setResultMsg(null);
    try {
      await customerSelfDelete();
      setResultMsg('अनुरोध स्वीकार हुआ');
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      if (code === 'deletion.customer_app_not_yet_available') {
        setResultMsg('जल्द आ रहा है। (coming soon)');
      } else {
        setResultMsg('अभी संभव नहीं है। बाद में पुनः प्रयास करें।');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView nestedScrollEnabled>
        {/* ── Profile header ── */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontFamily: typography.display.family, fontSize: 22, color: colors.ink }}>
            {customer?.name ?? '-'}
          </Text>
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginTop: spacing.xs }}>
            {customer?.phoneE164 ?? ''}
          </Text>
        </View>

        <LoyaltyPointsCard />

        {/* ── Timeline ── */}
        <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TimelineTabBar activeTab={activeTab} onTabChange={handleTabChange} />
          <View style={{ minHeight: 200 }}>
            {activated.current.has('purchases') && (
              <View style={{ display: activeTab === 'purchases' ? 'flex' : 'none' }}>
                <TimelinePurchases />
              </View>
            )}
            {activated.current.has('custom-orders') && (
              <View style={{ display: activeTab === 'custom-orders' ? 'flex' : 'none' }}>
                <TimelineCustomOrders />
              </View>
            )}
            {activated.current.has('rate-locks') && (
              <View style={{ display: activeTab === 'rate-locks' ? 'flex' : 'none' }}>
                <TimelineRateLocks />
              </View>
            )}
            {activated.current.has('try-at-home') && (
              <View style={{ display: activeTab === 'try-at-home' ? 'flex' : 'none' }}>
                <TimelineTryAtHome />
              </View>
            )}
          </View>
        </View>

        {/* ── Account actions ── */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Pressable
              testID="profile-delete-button"
              onPress={() => { void onDelete(); }}
              disabled={deleting}
              style={{
                backgroundColor: colors.white,
                borderRadius:    radii.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderWidth:     1,
                borderColor:     colors.border,
                minHeight:       48,
                justifyContent:  'center',
                opacity:         deleting ? 0.5 : 1,
              }}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: '#8C2A1E', textAlign: 'center' }}>
                डेटा हटाएं (Delete my data)
              </Text>
            </Pressable>
            {resultMsg !== null && (
              <View
                testID="profile-delete-result"
                style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.bg, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>{resultMsg}</Text>
              </View>
            )}
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Pressable
              testID="profile-signout-button"
              onPress={() => { void signOut(); }}
              style={{ paddingVertical: spacing.md, minHeight: 48, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: typography.body.family, color: colors.inkMute, textAlign: 'center' }}>
                लॉग आउट
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 5: Run profile test to verify it passes**

```bash
pnpm --filter @goldsmith/customer-mobile test test/profile.test.tsx
```
Expected: PASS — 4 tests

- [ ] **Step 6: Run all mobile tests**

```bash
pnpm --filter @goldsmith/customer-mobile test
```
Expected: PASS — all tests including new ones

- [ ] **Step 7: Run all API tests**

```bash
pnpm --filter @goldsmith/api test
```
Expected: PASS

- [ ] **Step 8: Full typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors across all packages

- [ ] **Step 9: Commit**

```bash
git add apps/customer-mobile/app/\(tabs\)/profile.tsx \
        apps/customer-mobile/test/profile.test.tsx
git commit -m "feat(ws-2b): refactor profile screen with 4-tab timeline; delete orphan [productId].tsx"
```

---

## Self-review notes

**Spec coverage:**
- ✅ Delete `[productId].tsx` — Task 8 Step 1
- ✅ 4 GET endpoints in CustomerController — Task 3
- ✅ CrmModule exports HistoryService — Task 1
- ✅ CustomOrdersService.getOrdersForCustomer — Task 1
- ✅ RateLockBookingsService.getBookingsForCustomer — Task 2
- ✅ TryAtHomeBookingsService.getBookingsForCustomer — Task 2
- ✅ 4 mobile API functions — Task 4
- ✅ useCustomerTimeline hooks — Task 5
- ✅ TimelineCard with status chip colors — Task 6
- ✅ TimelineEmptyState with Hindi copy — Task 6
- ✅ TimelineSkeleton — Task 6
- ✅ TimelineTabBar with 4 Hindi pills — Task 7
- ✅ 4 content components (Purchases / CustomOrders / RateLocks / TryAtHome) — Task 7
- ✅ profile.tsx refactor with lazy-mount ref pattern — Task 8
- ✅ Offset pagination + "और देखें" button — Task 7 content components
- ✅ `staleTime: 30_000` on all hooks — Task 5

**Token names verified against `packages/ui-tokens/src/colors.ts`:**
- `colors.primary` (#B58A3C), `colors.ink`, `colors.inkMute`, `colors.border`, `colors.error`, `colors.white`, `colors.bg`, `colors.primaryLight`

**Token names verified against `packages/ui-tokens/src/radii.ts`:**
- `radii.sm`, `radii.md`, `radii.lg`, `radii.pill`

**Type consistency:** `CustomerCustomOrderItem` defined in service and re-exported in endpoints.ts as a new `CustomerCustomOrderItem` interface with matching fields. `CustomerRateLockItem` same pattern. `BookingResponse` reused from existing try-at-home service.

**No Codex required** for Class B — `/code-review` + `/security-review` + CI are the review gate. Run before `git push`.
