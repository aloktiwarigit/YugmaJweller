# Story Demo-1: Reviews Moderation Screen — Work-Stream Plan
# Date: 2026-05-19 | Class B | Branch: feat/story-demo-1-reviews-moderation

## Context

**Goal:** Shopkeeper-only screen to list and moderate customer reviews. Shopkeeper can see all reviews and toggle their public visibility (approve = visible, reject = hidden).

**DB schema (already exists):**
- `product_reviews` table with `is_publicly_visible BOOLEAN DEFAULT TRUE` (migration 0070)
- `UPDATE` grant on `product_reviews` to `app_user` (migration 0059)
- RLS policy: tenant isolation via `shop_id` (migration 0047)

**No new migrations needed.** All DB-level work is within existing columns/grants.

**Backend gap:** The existing `reviews.controller.ts` only has customer-facing routes (`POST /reviews` + `GET /reviews/products/:productId`). No shopkeeper moderation endpoints exist. Need to add them.

**Mobile gap:** `apps/shopkeeper/app/reviews/` directory does not exist.

**Navigation:** Add entry to `apps/shopkeeper/app/(tabs)/more.tsx` ROWS array.

## Work Streams

### WS-A: Backend — Repository + Service
**File:** `apps/api/src/modules/reviews/reviews.repository.ts`
**File:** `apps/api/src/modules/reviews/reviews.service.ts`

Add to repository:
1. `listAllForShop(shopId: string): Promise<ModerationReviewRow[]>` — returns all reviews for shop, sorted by `created_at DESC`, with product name join.
2. `setVisibility(shopId: string, reviewId: string, visible: boolean): Promise<void>` — UPDATE `is_publicly_visible` WHERE `id=$1 AND shop_id=$2`.

`ModerationReviewRow` interface:
```ts
interface ModerationReviewRow {
  id: string;
  shop_id: string;
  product_id: string;
  product_name: string | null;
  customer_id: string | null;
  customer_first_name: string | null;
  rating: number;
  review_text: string | null;
  is_publicly_visible: boolean;
  created_at: Date;
}
```

Add to service:
1. `listModerationReviews(): Promise<ModerationReviewItem[]>` — reads shopId from tenantContext, calls repo.
2. `setReviewVisibility(reviewId: string, visible: boolean): Promise<void>` — reads shopId from tenantContext, calls repo, fires auditLog.

AuditAction: use `AuditAction.REVIEW_MODERATED` if it exists; otherwise use `AuditAction.PRODUCT_UPDATE` as fallback (grep `AuditAction` enum first).

### WS-B: Backend — Controller
**File:** `apps/api/src/modules/reviews/reviews.controller.ts`

Add two shopkeeper routes (no @SkipAuth, standard Firebase JWT auth via existing guards):

```
GET  /api/v1/reviews             @Roles('shop_admin', 'shop_manager')
PATCH /api/v1/reviews/:id/visibility  @Roles('shop_admin', 'shop_manager')
```

PATCH body schema: `{ visible: z.boolean() }`

Inject `tenantContext` via the existing `TenantContextDec` decorator pattern (grep existing controllers for the pattern). The `ReviewsController` already injects `ReviewsService`.

Security note: The `id` param must NOT be trusted across tenants — the service's `withShopTx` enforces ownership via RLS, so the cross-tenant guard is at the DB layer.

### WS-C: Mobile Screens
**Files to create:**
1. `apps/shopkeeper/app/reviews/_layout.tsx` — Stack with header style matching try-at-home pattern
2. `apps/shopkeeper/app/reviews/index.tsx` — FlatList of all reviews, tap → detail
3. `apps/shopkeeper/app/reviews/[id].tsx` — Review detail + Approve/Reject buttons

**Pattern:** Mirror `apps/shopkeeper/app/try-at-home/` screens exactly. Same header style (`#F5EDDD` bg, `#2C1810` tint, NotoSansDevanagari font).

`index.tsx` TanStack Query:
```ts
useQuery({
  queryKey: ['reviews-moderation'],
  queryFn: async () => (await api.get<ModerationReviewItem[]>('/api/v1/reviews')).data,
})
```

`ReviewCard` row: star rating (⭐ × n), review text snippet, customer first name, product name, visibility badge ("सार्वजनिक" | "छुपा हुआ"), created date in Hindi locale.

`[id].tsx` — full review detail + two Pressable buttons:
- "स्वीकृत करें" (approve) → PATCH visibility: true → invalidate `reviews-moderation`
- "अस्वीकृत करें" (reject) → PATCH visibility: false → same invalidation

Empty state on list: "अभी तक कोई समीक्षा नहीं।"

### WS-D: Navigation Wiring
**File:** `apps/shopkeeper/app/(tabs)/more.tsx`

Add to `ROWS` array:
```ts
{ label: 'समीक्षाएँ', icon: 'star-outline', href: '/reviews', managerOnly: true },
```

Place after `try-at-home` entry (owner/manager-only). No tab bar change needed — this goes in the More menu.

No Stack.Screen entry needed in root `_layout.tsx` — root Stack uses `headerShown: false` with file-based routing; the `reviews/_layout.tsx` handles its own headers.

### WS-E: Tests + Gate

**Tests required (behavior to verify):**

1. `reviews.service.spec.ts` — add tests:
   - `listModerationReviews()` calls repo with shopId from tenantContext
   - `setReviewVisibility(reviewId, true)` calls setVisibility with correct args
   - `setReviewVisibility(reviewId, false)` same

2. `reviews.repository.spec.ts` — add tests:
   - `setVisibility` updates correct row
   - `listAllForShop` returns all rows including invisible ones (unlike `listByProduct` which filters)

3. Mobile UI: no separate test file needed (render plumbing only). TypeScript strict + smoke test is sufficient.

**Review gate (Class B):**
- Per-task code review: skip (no Class A surfaces — no RLS changes, no money, no auth, just READ/UPDATE on reviews)
- Whole-branch: `pnpm typecheck` + `pnpm lint` + `pnpm test` in `apps/api`
- Security review: new endpoints exist → run `/security-review` before push
- Runtime smoke: emulator boot, navigate More → Reviews, verify list renders, tap one review, approve it, verify badge updates

## Completion checklist (code-truth audit)

- [ ] `apps/shopkeeper/app/reviews/_layout.tsx` exists
- [ ] `apps/shopkeeper/app/reviews/index.tsx` exists
- [ ] `apps/shopkeeper/app/reviews/[id].tsx` exists
- [ ] `/reviews` entry in `more.tsx` ROWS array
- [ ] `GET /api/v1/reviews` route registered in controller
- [ ] `PATCH /api/v1/reviews/:id/visibility` route registered in controller
- [ ] `listAllForShop` in repository
- [ ] `setVisibility` in repository
- [ ] Tests green: `pnpm --filter @goldsmith/api test`
- [ ] TypeScript clean: `pnpm typecheck`
