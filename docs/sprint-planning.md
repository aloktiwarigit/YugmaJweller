# Sprint Planning — Deferred Follow-ups

## Story 8.1 Deferred Work Streams

These two work streams were explicitly deferred from the 8.1 loyalty accrual merge (Class C scope).

### 8.1a — LoyaltyCard mobile component (WS-F)
**Class:** C  
**Branch:** implement fresh off main  
**Spec:** Display a customer's current loyalty tier, points balance, and next-tier threshold. Sourced from `GET /api/v1/loyalty/balance/:customerId`. Uses existing LoyaltyTierForm token values for tier thresholds.  
**AC:** Hindi labels; renders in customer profile screen; shows tier badge + points count + progress bar to next tier.

### 8.1b — Loyalty accrual end-to-end integration test (WS-G)
**Class:** C  
**Branch:** implement fresh off main  
**Spec:** Full round-trip: create invoice → invoice.created event fires → BullMQ loyalty-accrual worker picks up → `loyalty_ledger` row inserted → `GET /api/v1/loyalty/balance/:customerId` reflects correct points.  
**Approach:** Use existing Firebase emulator + Postgres test fixtures. Verify idempotency: replaying the same invoiceId must not double-accrue.

---

## Story 3.7 - Live Stock Valuation Dashboard (MERGED)

**Status:** Integrated into `main` by the Codex merge train and present in `origin/main`. PR #32 was closed as stale after the merge-train work superseded the dirty feature branch.

**Stacks on:** Story 3.6 sync infrastructure.
**Class:** B
**Migration:** none (pure service + UI)
**Gate:** merged, covered by valuation unit/integration tests and current `main` CI.

**What's implemented:**
- `InventoryValuationService` — purity→rate map, DECIMAL arithmetic, Redis 5-min TTL cache
- `GET /api/v1/inventory/valuation` — shop_admin|shop_manager, bigints as strings
- `DailySummaryCard` — metal-tinted border (gold/silver/platinum)
- `valuation.tsx` screen — stale banner, skeleton cards, grand total footer

**Action required:** none for merge. Future work is ordinary product hardening and route/navigation polish.
