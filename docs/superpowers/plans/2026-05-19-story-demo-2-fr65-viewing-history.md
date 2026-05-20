# Story Demo-2: FR65 Customer Viewing-History Tile — Work-Stream Plan
# Date: 2026-05-19 | Class B (with one Class A subsurface) | Branch: feat/story-demo-2-fr65-viewing-history

## Context

**Goal:** On the shopkeeper customer detail screen, show a tile listing the last ~10 products this specific customer has viewed. This is the FR65 "salesperson walks in and sees what they've been browsing" feature.

**DB schema (already exists):**
- `product_views` table with `shop_id, product_id, customer_id, session_id, viewed_at, duration_seconds` (migration ~0043 from Wave 3B)
- RLS policy on `product_views` via `shop_id`
- Viewing consent gate in `viewing_consent` table (migration 0069 or similar)

**Backend gap:** `analytics.service.ts` has `recordView()` and `getProductViewSummary()` (per-product), but no `getCustomerViewHistory()` (per-customer). Need to add the method + a new controller endpoint.

**Class A subsurface:** The new `GET /analytics/customers/:customerId/views` endpoint is a new API endpoint that must include a cross-tenant ownership check (verify customer belongs to the requesting shopkeeper's shop before returning data). Gate as Class A: ownership assertion required in both service and tests.

**Mobile gap:** `CustomerViewingHistoryCard` component does not exist. Must be created and wired into `apps/shopkeeper/app/customers/[id].tsx` after `PurchaseHistoryList` (line ~152).

**No new migrations needed.** Uses existing `product_views` and `products` tables.

## Work Streams

### WS-A: Backend — Analytics Service
**File:** `apps/api/src/modules/analytics/analytics.service.ts`

Add method `getCustomerViewHistory`:

```ts
interface CustomerViewItem {
  productId: string;
  productName: string;
  primaryImageUrl: string | null;
  viewedAt: string; // ISO
  durationSeconds: number | null;
}

async getCustomerViewHistory(params: {
  shopId: string;
  customerId: string;
  limit: number;
}): Promise<CustomerViewItem[]>
```

**Implementation:**
1. Validate shopId and customerId are valid UUIDs (same UUID_RE pattern used elsewhere).
2. **Cross-tenant ownership check:** Verify the customer exists AND belongs to this shop:
   ```sql
   SELECT id FROM customers WHERE id = $1 AND shop_id = $2 LIMIT 1
   ```
   If 0 rows → return `[]` (do NOT throw — avoids enumeration). Log to audit if needed.
3. Query most-recent N product views for this customer, with product name join:
   ```sql
   SELECT pv.product_id, p.name AS product_name, p.primary_image_url,
          pv.viewed_at, pv.duration_seconds
     FROM product_views pv
     JOIN products p ON p.id = pv.product_id AND p.shop_id = pv.shop_id
    WHERE pv.shop_id = $1 AND pv.customer_id = $2
    ORDER BY pv.viewed_at DESC
    LIMIT $3
   ```
   Use `withShopTx` (existing pattern in this service).
4. Map rows to `CustomerViewItem[]`.

### WS-B: Backend — Analytics Controller
**File:** `apps/api/src/modules/analytics/analytics.controller.ts`

Add endpoint:
```
GET /api/v1/analytics/customers/:customerId/views
@Roles('shop_admin', 'shop_manager')
```

Parse `limit` from query with default 10, max 20. Pass shopId from authenticated tenant context.

Pattern: follow existing `getProductViews` handler in the same file. Use `@TenantContextDec()` for shopId, `@Param('customerId', ParseUUIDPipe)` for customerId.

**Do NOT** add `@SkipAuth()` — this is a shopkeeper-only authenticated route.

### WS-C: Mobile Component
**File:** `apps/shopkeeper/src/features/crm/components/CustomerViewingHistoryCard.tsx`

Props:
```ts
interface Props {
  customerId: string;
}
```

TanStack Query:
```ts
useQuery({
  queryKey: ['customer-viewing-history', customerId],
  queryFn: async () =>
    (await api.get<CustomerViewItem[]>(
      `/api/v1/analytics/customers/${customerId}/views?limit=10`,
    )).data,
  enabled: !!customerId,
})
```

**Render (populated state):**
- Section title: "हाल में देखे गए" in NotoSansDevanagari_700Bold
- Horizontal scroll or vertical list of up to 10 items
- Each item: product thumbnail (fallback to jewel emoji icon if no image) + product name + relative time ("2 दिन पहले" format using `toLocaleDateString('hi-IN')`)
- Minimum row height 48dp, tap target ≥ 48×48dp

**Empty state** (required — likely common on fresh demo tenant):
```
<Ionicons name="eye-off-outline" size={32} color="#BDBDBD" />
<Text>अभी तक कोई व्यू नहीं</Text>
<Text style={subtext}>जब ग्राहक उत्पाद देखेंगे, वे यहाँ दिखेंगे।</Text>
```

**Style:** Match `LoyaltyCard` tone — `#FFFDF7` card background, `#5C3D11` heading, `#888` muted text, NotoSansDevanagari font family, 12px border-radius card, elevation 2.

### WS-D: Integration — customers/[id].tsx
**File:** `apps/shopkeeper/app/customers/[id].tsx`

1. Import `CustomerViewingHistoryCard` at top.
2. After `<View style={styles.section}><PurchaseHistoryList customerId={customerId} /></View>`, add:
   ```tsx
   <View style={styles.section}>
     <CustomerViewingHistoryCard customerId={customerId} />
   </View>
   ```
3. No other changes to this file.

**Verify current line numbers** before editing — the plan references line ~152 from the audit but file may have shifted. Grep for `PurchaseHistoryList` mount point in current code.

### WS-E: Tests + Gate

**Tests required:**

1. `analytics.service.spec.ts` — add tests for `getCustomerViewHistory`:
   - Returns empty array for unknown customer (cross-tenant safe)
   - Returns empty array when customer belongs to different shop (ownership check)
   - Returns last N products sorted by viewed_at DESC for valid customer
   - Respects limit parameter

2. `analytics.controller.ts` — type inference test (TypeScript strict check covers the type contract; no additional unit test needed for the controller handler unless the service test mocking is complex).

**Review gate (Class B with Class A subsurface):**
- The new endpoint is a Class A surface (new API route + cross-tenant ownership check) → per-task review IS required for WS-A + WS-B
- Pure mobile component (WS-C + WS-D) is Class B plumbing → no per-task review
- Whole-branch: `pnpm typecheck` + `pnpm lint` + `pnpm --filter @goldsmith/api test`
- Security review: new endpoint exists → run `/security-review` before push
- Runtime smoke: emulator boot, open customer detail, verify `CustomerViewingHistoryCard` renders (empty state OR populated). Test empty state with fresh customer.

## Completion checklist (code-truth audit)

- [ ] `getCustomerViewHistory` method in `analytics.service.ts`
- [ ] `GET /api/v1/analytics/customers/:customerId/views` route registered in controller
- [ ] Customer ownership check present in service (grep for `customers WHERE id`)
- [ ] `CustomerViewingHistoryCard.tsx` exists at `apps/shopkeeper/src/features/crm/components/`
- [ ] `CustomerViewingHistoryCard` imported and mounted in `customers/[id].tsx` after `PurchaseHistoryList`
- [ ] Tests green for `getCustomerViewHistory` (cross-tenant ownership case covered)
- [ ] TypeScript clean: `pnpm typecheck`
- [ ] Empty state renders when no views (verified by smoke or component inspection)
