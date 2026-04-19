---
generatedBy: 'Opus main orchestrator (subagent batch failed on 32k cap; orchestrator completing directly)'
epic: 'E3 + E4'
date: '2026-04-17'
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Epic 3 Story 3.6 ships the complete offline-sync infrastructure (WatermelonDB schemas + /api/v1/sync/pull +
    /api/v1/sync/push + monotonic per-tenant Postgres SEQUENCE cursor + per-aggregate conflict resolution).
    Epic 7 Stories consume this same cursor for customer-side reads. This is THE pivotal infrastructure
    story of Phase 0.
  - >
    Epic 4 Story 4.1 ships the full RatesPort + IbjaAdapter + MetalsDevAdapter + LastKnownGoodCache
    fallback chain + circuit breaker. Every other pricing story consumes the port.
  - >
    All monetary values throughout Epic 3 + 4 go through packages/money (MoneyInPaise + Weight);
    the 10K weight-precision harness (ships in Epic 1 Story 1.1) must pass on any CI run that
    touches pricing or billing.
---

---

## Epic 3: Shopkeeper manages inventory with barcode scan, multi-purity, and publishes pieces that reach the customer app in under 30 seconds

**Goal:** Shopkeeper onboards anchor's 240+ physical pieces into a searchable, barcode-printable inventory with live valuation; publishes pieces for customer visibility; sync infrastructure ships so Epic 7 customer-app can consume it.

**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34
**Phase:** Phase 0 — Sprint 3-4
**Dependencies:** Epic 1 (auth + tenant context + observability baseline)

---

### Story 3.1: Shopkeeper creates a single product record with category, metal, purity, weight, stone details, and HUID

**Class:** A — Touches packages/compliance (HUID validate) + packages/audit write path + RLS migration.

**As a Shopkeeper (Ravi, anchor staff handling inventory onboarding)**,
I want to enter one product at a time with all the attributes — category, metal, purity, gross/net/stone weight, HUID — along with images,
So that the piece is searchable, priceable, and ready to publish to the customer app.

**FRs implemented:** FR25
**NFRs verified:** NFR-P3 (inventory edit screen < 1s interactive), NFR-A7 (48dp touch targets), NFR-S9 (audit on create)
**Modules + packages touched:**
- `apps/api/src/modules/inventory/inventory.module.ts` + `inventory.controller.ts` + `inventory.service.ts` + `inventory.repository.ts` (new)
- `packages/db/src/schema/products.ts` (new) + `product-images.ts` (new) + `product-categories.ts` (new)
- `packages/db/src/migrations/0003_inventory_base.sql` (new — `products`, `product_images`, `product_categories`, RLS policies)
- `packages/shared/schemas/product.schema.ts` (new — Zod schema shared with frontend)
- `packages/integrations/storage/s3-adapter.ts` (new) + `imagekit-adapter.ts` (new) + `StoragePort` (new)
- `packages/compliance/src/huid/validate.ts` (extend — `validateHuidFormat` used here for entry-time check)
- `packages/money/src/weight.ts` (used — Weight wrapper for gross/net/stone)
- `packages/audit/src/actions.ts` (extend — `INVENTORY_PRODUCT_CREATED`)
- `apps/shopkeeper/app/inventory/new.tsx` + `inventory/[id]/edit.tsx` (new)
- `apps/shopkeeper/src/features/inventory/*` (new)
- `packages/ui-mobile/atoms/ProductBadge.tsx` + `CategoryPill.tsx` (new Tier 2)
- `packages/i18n/locales/hi-IN/inventory.json` + `en-IN/inventory.json` (new)

**ADRs governing:** ADR-0002 (RLS), ADR-0003 (DECIMAL weight), ADR-0005 (TenantContext), ADR-0006 (storage adapter)
**Pattern rules honoured:** MUST #1 (shop_id + RLS), MUST #2 (DECIMAL(12,4) weight), MUST #5 (TenantContext), MUST #7 (i18n), MUST #8 (tenant-isolation test)
**Complexity:** L

**Acceptance Criteria:**

**Given** a Shop Owner authenticated via Epic 1 with OWNER or MANAGER role
**When** they open the inventory add screen
**Then** a form renders with fields: category (select from tenant-configured list), metal type (gold/silver/platinum), purity (24K/22K/20K/18K/14K for gold; 999/925 for silver), gross weight (grams), net weight, stone weight, stone details (free text), making-charge override (optional %), images (up to 6), HUID (optional for non-hallmarked)
**And** all labels render in Hindi with English tooltips
**And** weight inputs accept 4-decimal-place precision with `NUMERIC(12,4)` DB storage
**And** HUID input auto-uppercases to 6-character alphanumeric with format validator

**Given** the Shopkeeper fills in valid product data and uploads 3 images
**When** they tap "उत्पाद सहेजें" (Save Product)
**Then** images upload via pre-signed S3 URLs scoped to `tenants/<shop_id>/products/<product_id>/`
**And** images transform through ImageKit for thumb + card + detail + zoom variants
**And** `POST /api/v1/inventory/products` inserts with `shop_id` (via TenantContext; no raw param)
**And** the transaction wraps `SET LOCAL app.current_shop_id = ${ctx.shopId}`
**And** `audit_events` logs `INVENTORY_PRODUCT_CREATED` with before=null, after=product-JSON
**And** the product is visible immediately in inventory list
**And** an `inventory.product_created` domain event is emitted

**Given** a Shopkeeper attempts to enter a non-conforming HUID like `"huid1"` (lowercase, 5-char)
**When** the form validates
**Then** inline error "HUID must be 6 uppercase alphanumeric characters" displays near the field with `aria-describedby` associated error
**And** submit is disabled until format is valid
**And** the `validateHuidFormat` function from `packages/compliance/huid/validate.ts` is the single source of truth (Semgrep enforces no duplicate HUID regex elsewhere)

**Given** a Shopkeeper enters weight values that would parse as FLOAT
**When** CI scans the PR
**Then** Semgrep rule `goldsmith/money-safety` passes — all weight arithmetic goes through `Weight.from(str).multiply(ratePerGram)` pattern
**And** no `parseFloat` on weight inputs — inputs are validated strings passed to `decimal.js`-backed `Weight` wrapper
**And** the 10K-weight-precision harness runs and passes on this PR

**Given** CI runs on this PR
**When** pipeline executes
**Then** tenant-isolation test asserts: tenant A cannot list or read tenant B's products via any inventory endpoint
**And** all 10 gates pass (typecheck, lint, unit, integration, tenant-isolation, weight-precision, Semgrep, Snyk, Trivy, Codex, axe, Lighthouse, coverage ≥80%)

**Tests required:**
- Unit: product schema validation, HUID format edge cases, Weight precision on 4-decimal input, image upload pre-signed URL generation per-tenant
- Integration: create product → DB insert → event emission → audit log; RLS blocks cross-tenant read
- Tenant-isolation: tenant A creates product 1; tenant B's user cannot GET /products/1 (404 or 403)
- E2E (Detox): Happy path — open add screen → fill form → upload 3 images → save → appears in list
- A11y: axe-core passes; TalkBack reads all field labels in Hindi

**Definition of Done:** All AC pass; CI 10 gates green; Storybook stories for new Tier-2 atoms (ProductBadge, CategoryPill) in 2 tenant themes; 5 review layers passed.

---

### Story 3.2: Shopkeeper bulk-imports inventory via CSV with template matching the product schema

**Class:** B — Inventory module CSV import endpoint on a safe product surface.

**As a Shopkeeper (Rajesh-ji during anchor onboarding)**,
I want to import 240 existing pieces from a CSV file I prepared with my accountant,
So that I don't have to hand-enter each piece through the mobile form.

**FRs implemented:** FR26
**NFRs verified:** NFR-P4 (bulk import 240 products < 2 minutes p95), NFR-S9 (per-row audit), NFR-SC4 (50K products per tenant sustainable)
**Modules + packages touched:**
- `apps/api/src/modules/inventory/inventory.bulk-import.service.ts` (new)
- `apps/api/src/modules/inventory/inventory.controller.ts` (extend — `POST /api/v1/inventory/bulk-import`)
- `apps/api/src/workers/inventory-bulk-import.processor.ts` (new — BullMQ processor)
- `packages/shared/schemas/product.schema.ts` (used — row-level validation)
- `apps/shopkeeper/app/inventory/bulk-import.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0005, ADR-0006
**Pattern rules honoured:** MUST #1, MUST #2, MUST #4 (idempotency on batch), MUST #5, MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper has a CSV with columns matching the template (`sku,category,metal,purity,gross_weight,net_weight,stone_weight,stone_details,making_charge_override,huid,image_urls`)
**When** they upload the CSV through the bulk-import screen
**Then** the client uploads to `POST /api/v1/inventory/bulk-import` with the file + `Idempotency-Key`
**And** the server enqueues a BullMQ `inventory-bulk-import` job with `{ tenantId, fileUrl, idempotencyKey }`
**And** returns HTTP 202 Accepted with job-id for progress polling

**Given** the bulk-import worker processes the CSV
**When** each row is validated against the Zod product schema
**Then** valid rows insert as products (with sync cursor bumped — see Story 3.6)
**And** invalid rows are collected in an import-error report CSV
**And** progress is polled via `GET /api/v1/inventory/bulk-import/:jobId` returning `{ total, processed, succeeded, failed }`

**Given** the Shopkeeper uploads the same CSV twice (network retry)
**When** the second upload arrives with the same `Idempotency-Key`
**Then** the server returns the cached response of the first upload; no duplicate products created

**Given** CI runs
**When** the pipeline executes
**Then** tenant-isolation test asserts bulk-imported rows are only visible to the importing tenant

**Tests required:** Unit (CSV parsing, row validation, error aggregation), Integration (full import 100-row fixture → DB + events), Tenant-isolation, E2E (upload CSV → view progress → check success count), Load (100K-row CSV import within 30 min — against read-replica staging)

**Definition of Done:** All AC + CI 10 gates + Storybook for bulk-import progress component + 5 review layers.

---

### Story 3.3: Shopkeeper prints barcode labels for physical pieces

**Class:** B — Barcode generation + print UI; no money/auth/compliance.

**As a Shopkeeper (Ravi)**,
I want to print a barcode sticker for each product that I can affix to the jewelry pouch,
So that during billing I can scan the barcode and the product loads instantly.

**FRs implemented:** FR27
**NFRs verified:** NFR-P3
**Modules + packages touched:**
- `apps/api/src/modules/inventory/barcode.service.ts` (new — generates Code 128 barcode encoding `SKU-{shop_id-prefix}-{product_id}`)
- `apps/shopkeeper/app/inventory/print-labels.tsx` (new)
- `packages/ui-mobile/atoms/BarcodeLabel.tsx` (new — print-preview component, print-ready PDF via react-native-print)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #5, MUST #8
**Complexity:** S

**Acceptance Criteria:**

**Given** a Shopkeeper has selected 1+ products in inventory list
**When** they tap "Barcode Labels Print" (Hindi: "लेबल प्रिंट करें")
**Then** a print-preview sheet renders with Code 128 barcode + SKU + product name + weight + HUID (if hallmarked) per label
**And** labels are laid out 3-up on A4 (customizable in settings later — Phase 2)
**And** tapping Print triggers system print dialog via Expo Print
**And** barcode scans correctly in Billing flow (validated in Epic 5 Story 5.1)

**Given** CI runs
**When** the pipeline executes
**Then** all gates pass including visual regression for print-preview component

**Tests required:** Unit (barcode encoding correctness), Integration (scan generated barcode → decode to correct product_id), E2E (select products → print preview renders → scan test barcode → loads correct product)

**Definition of Done:** All AC + 10 CI gates + Storybook for BarcodeLabel component + 5 review layers.

---

### Story 3.4: Shopkeeper marks a product status as in-stock, sold, reserved, on-approval, or with-karigar

**Class:** B — Product status state machine, audit-logged; safe inventory CRUD.

**As a Shop Staff (Ravi)**,
I want to change a product's status when physical reality changes (piece sent to karigar for repair, customer has it on approval),
So that inventory reflects what's actually in the safe versus out.

**FRs implemented:** FR28
**NFRs verified:** NFR-S9 (status change audit-logged)
**Modules + packages touched:**
- `packages/db/src/schema/products.ts` (extend — `status: TEXT CHECK (status IN ('IN_STOCK','SOLD','RESERVED','ON_APPROVAL','WITH_KARIGAR'))`)
- `packages/db/src/migrations/0004_product_status.sql` (new)
- `apps/api/src/modules/inventory/inventory.service.ts` (extend — `updateStatus` with state transition validation)
- `apps/api/src/modules/inventory/state-machine.ts` (new — transitions: IN_STOCK ↔ RESERVED ↔ ON_APPROVAL ↔ WITH_KARIGAR; IN_STOCK → SOLD is terminal-until-refund)
- `apps/shopkeeper/src/features/inventory/components/StatusChipGroup.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #3 (event emit), MUST #5, MUST #8
**Complexity:** S

**Acceptance Criteria:**

**Given** a Shopkeeper is viewing an IN_STOCK product
**When** they tap "Reserve for Customer" status chip
**Then** status transitions IN_STOCK → RESERVED with optional customer_id linked
**And** `audit_events` logs `INVENTORY_STATUS_CHANGED` with before/after
**And** `inventory.product_status_changed` event emits

**Given** a Shopkeeper attempts an invalid transition (SOLD → IN_STOCK without refund)
**When** the change is submitted
**Then** server returns 422 with `errorCode: "inventory.invalid_status_transition"`
**And** UI shows Hindi explanation: "यह बदलाव directly नहीं हो सकता; पहले refund process करें"

**Given** CI runs
**When** pipeline executes
**Then** state-machine unit tests cover all valid + invalid transitions

**Tests required:** Unit (all transitions), Integration (state change + event + audit), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 3.5: Shopkeeper publishes or unpublishes a product to the customer app

**Class:** B — Publication toggle + event bus; RLS via withTenantTx on safe product surface.

**As a Shop Owner (Rajesh-ji)**,
I want to toggle visibility of a product on the customer-facing app,
So that pieces still being photographed or under karigar work aren't visible until ready.

**FRs implemented:** FR29
**NFRs verified:** NFR-S9 (publish audit), NFR-P6 (propagates within 30s via sync cursor — verified in Story 3.6)
**Modules + packages touched:**
- `packages/db/src/schema/products.ts` (extend — `published_at TIMESTAMPTZ`, `published_by_user_id UUID`)
- `packages/db/src/migrations/0005_product_publish.sql` (new)
- `apps/api/src/modules/inventory/inventory.service.ts` (extend — `publish` + `unpublish`)
- `apps/shopkeeper/src/features/inventory/components/PublishToggle.tsx` (new)
- `apps/api/src/modules/catalog/` (new — read-only customer-facing module; stub here, full in Epic 7)

**ADRs governing:** ADR-0002, ADR-0005, ADR-0007 (polling for customer reads)
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #8
**Complexity:** S

**Acceptance Criteria:**

**Given** a Shopkeeper is viewing an unpublished product in a publishable state (images present, HUID for hallmarked items)
**When** they toggle "Publish to Customer App"
**Then** `published_at = now()`; `inventory.product_published` event emits; sync cursor bumps (Story 3.6)
**And** `audit_events` logs `INVENTORY_PRODUCT_PUBLISHED`
**And** a test customer endpoint `GET /api/v1/catalog/products` (stub from Epic 7) returns this product within 30s of publish

**Given** a product missing required publishable fields (e.g., hallmarked but no HUID)
**When** Publish toggle is tapped
**Then** server returns 422 with `errorCode: "catalog.product_missing_huid"`
**And** UI shows warmth-toned modal explaining the missing field with a "Fix Now" CTA linking to product edit

**Given** CI runs
**When** pipeline executes
**Then** tenant-isolation test asserts: tenant A's published products are not visible to tenant B's customer endpoint

**Tests required:** Unit (publish guards), Integration (publish → catalog read → event → audit), Tenant-isolation, E2E (publish → verify appears in catalog within 30s)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 3.6: Shopkeeper-side publishes propagate to customer app within 30 seconds via offline-sync infrastructure

**Class:** A — Foundational sync protocol (WatermelonDB + cursor + conflict resolution) carrying customer/invoice/product mutations across tenants.

**As a Shop Owner (Rajesh-ji)**,
I want my inventory changes (publish, status update, stock movement) to reflect on the customer app within 30 seconds — even when my shop has spotty internet,
So that my customers always see accurate availability and I trust the system.

**This is THE sync infrastructure story. Epic 7 consumes this cursor for customer-side reads.**

**FRs implemented:** FR30 (30-sec sync SLA — publish side + sync protocol)
**NFRs verified:** NFR-P6 (sync lag < 30s p95), NFR-P11 (offline ops < 500ms), NFR-R8 (multi-AZ durability)
**Modules + packages touched:**
- `apps/api/src/modules/sync/*` (new — `sync.controller.ts`, `sync.service.ts`, `sync.module.ts`)
- `packages/sync/src/server/*` (new — `pull.ts`, `push.ts`, `cursor.ts`)
- `packages/sync/src/client/*` (new — `watermelon-adapter.ts`, `conflict-policies.ts`)
- `packages/sync/src/protocol.ts` (new — shared types + PullResponse / PushRequest schemas)
- `packages/db/src/schema/tenant-sync-sequences.ts` (new — per-tenant monotonic sequences)
- `packages/db/src/migrations/0006_sync_sequences.sql` (new — `CREATE SEQUENCE tenant_sync_seq_<shop_id>` via platform admin orchestration; or SINGLE seq with shop_id partition — pick SINGLE for MVP simplicity)
- `apps/shopkeeper/src/db/schema.ts` (new — WatermelonDB schema mirroring products, customers, invoices, drafts)
- `apps/shopkeeper/src/db/models/*` (new)
- `apps/shopkeeper/src/db/sync/*` (new — pull-then-push adapter)
- `apps/shopkeeper/src/providers/OfflineProvider.tsx` (new — NetInfo listener + sync status badge)
- `packages/ui-mobile/atoms/OfflineBadge.tsx` (new)

**ADRs governing:** ADR-0004 (offline sync protocol — authoritative), ADR-0002, ADR-0005, ADR-0007
**Pattern rules honoured:** MUST #1, MUST #4 (idempotency on push), MUST #5, MUST #8
**Complexity:** XL — largest story in Epic 3; ships both server + client + conflict resolution

**Acceptance Criteria:**

**Given** a Shopkeeper's app is online and authenticated
**When** they publish a product (Story 3.5)
**Then** the sync cursor advances; the server records `(tenant_id, table='products', seq=N, op='UPDATE', row_id)`
**And** on the customer app's next pull (Epic 7), this product appears within 30 seconds p95

**Given** a Shopkeeper's app is offline (airplane mode)
**When** they create a product (Story 3.1) and mark another as sold (Story 3.4)
**Then** WatermelonDB records both changes locally with `pending_sync=true`
**And** offline badge shows in header with "Working offline — 2 changes pending"
**And** local reads return correct data within 500ms

**Given** the Shopkeeper reconnects to internet
**When** NetInfo fires the reconnect event
**Then** OfflineProvider triggers sync: PULL from server using last cursor → apply diffs → PUSH local pending changes with idempotency key per batch
**And** server validates each push: if stock-movement would go negative (concurrent sale elsewhere), REJECTS with conflict record
**And** conflicts surface to Shopkeeper UX via "Review conflicts" banner
**And** successfully synced changes clear `pending_sync=false` locally

**Given** two staff on the same shop (two devices) both sell the last remaining piece while one device is offline
**When** the offline device reconnects and pushes the stock-movement
**Then** the pessimistic-lock DB transaction detects negative balance and rejects the push
**And** local UX shows "Piece already sold by [other staff] at [time]; review invoice state"

**Given** customer notes are edited concurrently on two staff devices (both online, near-simultaneous)
**When** pushes arrive
**Then** Last-Writer-Wins by server_updated_at applies; older edit is preserved in audit trail

**Given** CI runs
**When** pipeline executes
**Then** tenant-isolation test asserts: tenant A's sync PULL returns only tenant A rows (never B or C)
**And** sync protocol conformance tests pass (all ADR-0004 invariants: monotonic cursor, pessimistic stock lock, LWW notes, state-machine custom orders)
**And** chaos-recovery tests pass: internet drops mid-push; webhook delays; concurrent write conflicts

**Tests required:**
- Unit: cursor advancement, conflict resolution policies (stock/notes/settings/invoices), idempotency
- Integration: publish → PULL returns diff → apply → verify; offline create + sell + reconnect → reconcile
- Tenant-isolation: 3-tenant harness runs full sync flow with zero cross-tenant leak
- E2E (Detox): offline scenario full flow on Android emulator with airplane-mode toggle
- Chaos: push during server restart (idempotency dedupes); client kills mid-push (replay resumes)
- Load: 1000 queued local mutations sync within 60s at p95

**Definition of Done:** All AC + 10 CI gates + ADR-0004 conformance tests all green + Storybook for OfflineBadge + sync runbook authored under `docs/runbooks/sync-recovery.md` + 5 review layers.

---

### Story 3.7: Shopkeeper views live stock valuation at today's market rate, cost price, and selling price

**Class:** B — Valuation dashboard reads money + rates on a safe reporting surface.

**As a Shop Owner (Rajesh-ji)**,
I want to see my total inventory value right now at (a) today's gold rate, (b) my original cost, and (c) my expected selling price — broken down by category,
So that I know my shop's net worth and margin at a glance.

**FRs implemented:** FR31
**NFRs verified:** NFR-P5 (valuation report < 2s for 10K products)
**Modules + packages touched:**
- `apps/api/src/modules/inventory/inventory.valuation.service.ts` (new — uses `packages/money` + `packages/integrations/rates` from Epic 4)
- `apps/shopkeeper/src/features/inventory/components/ValuationDashboard.tsx` (new)
- `packages/ui-mobile/business/DailySummaryCard.tsx` (new Tier-3 component)

**ADRs governing:** ADR-0002, ADR-0003, ADR-0005, ADR-0006 (rates adapter)
**Pattern rules honoured:** MUST #1, MUST #2 (money), MUST #5, MUST #8
**Depends on:** Epic 4 Story 4.1 (rates adapter ready)
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper opens Valuation dashboard
**When** the server computes valuation
**Then** for each product: `market_value_paise = weight.multiply(currentRate.get(purity))` using `packages/money` wrapper
**And** totals aggregate per category: gold, diamond, silver, bridal, wholesale
**And** response renders within 2s p95 for 10K products (measured in load test)
**And** every money value displays via Indian-grouping formatter `₹ 1,24,35,000` (hi-IN locale)

**Given** IBJA rates are stale (> 30 min old)
**When** valuation renders
**Then** "Rates stale — valuation approximate" banner shows with current rate freshness timestamp

**Given** CI runs
**When** pipeline executes
**Then** weight-precision harness validates 10K synthetic transactions produce paise-exact valuation totals

**Tests required:** Unit (valuation math, category aggregation, currency formatting), Integration (with real rates adapter), Tenant-isolation, Load (10K products < 2s p95)

**Definition of Done:** All AC + 10 CI gates + Storybook ValuationDashboard + 5 review layers.

---

### Story 3.8: Shopkeeper records stock movements (purchase, sale, adjustment, transfer)

**Class:** A — Compliance PMLA 5-year immutable audit + pessimistic locking on stock ledger.

**As a Shopkeeper (Ravi)**,
I want to log every stock change with reason — new purchase from karigar, sale, physical-count adjustment, transfer-to-custom-order,
So that the audit trail supports accountant reconciliation and PMLA scrutiny.

**FRs implemented:** FR32
**NFRs verified:** NFR-S9 (every movement immutable), NFR-C5 (5-year PMLA retention)
**Modules + packages touched:**
- `packages/db/src/schema/stock-movements.ts` (new — append-only; no UPDATE/DELETE)
- `packages/db/src/migrations/0007_stock_movements.sql` (new — RLS; trigger that rejects UPDATE/DELETE)
- `apps/api/src/modules/inventory/stock-movement.service.ts` (new)
- `apps/shopkeeper/app/inventory/[id]/movements.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0004 (pessimistic lock on movements), ADR-0005
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper has inventory
**When** they record a stock movement with type=PURCHASE, reason, +N quantity, source (karigar-id or supplier-name)
**Then** `stock_movements` inserts append-only with before/after balance
**And** product stock balance updates atomically (DB transaction)
**And** domain event `inventory.stock_moved` emits with movement details
**And** PMLA audit trail intact

**Given** a Shopkeeper attempts to UPDATE or DELETE a stock movement row
**When** DB operation fires
**Then** Postgres trigger rejects with "stock movements are immutable; use compensating movement"

**Given** CI runs
**When** pipeline executes
**Then** all gates pass including tenant-isolation

**Tests required:** Unit (movement types + balance math), Integration (movement + event + audit + immutability), Tenant-isolation, Chaos (concurrent sales cannot oversell; pessimistic lock asserts)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 3.9: Shopkeeper searches and filters inventory by category, metal, purity, weight range, HUID, status, published flag

**Class:** B — Meilisearch per-tenant indexing for inventory; safe product search.

**As a Shopkeeper (Ravi during a Dhanteras rush)**,
I want to find the 22K 30-40g mangalsutra with HUID scanning in 2 seconds,
So that I can show the customer exactly what they asked for without opening every drawer.

**FRs implemented:** FR33
**NFRs verified:** NFR-P3 (< 1s interactive), NFR-SC4 (50K products per tenant)
**Modules + packages touched:**
- `packages/integrations/search/meilisearch-adapter.ts` (new — Hindi tokenizer + transliteration support)
- `apps/api/src/modules/inventory/inventory.search.service.ts` (new)
- `apps/api/src/workers/search-indexer.processor.ts` (new — BullMQ job on product writes)
- `apps/shopkeeper/src/features/inventory/components/InventorySearch.tsx` (new)
- `apps/shopkeeper/src/features/inventory/components/InventoryRow.tsx` (new Tier 3)

**ADRs governing:** ADR-0002, ADR-0005, ADR-0006 (Meilisearch adapter)
**Pattern rules honoured:** MUST #1, MUST #5, MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper has 5000 products
**When** they search "mangalsutra" or "मंगलसूत्र"
**Then** Meilisearch per-tenant index `shop_{shop_id}_products` returns matches in Hindi OR English (transliteration-tolerant)
**And** debounced 300ms; results update live
**And** filters combine: category + metal + purity + weight range + HUID prefix + status + published

**Given** a new product is created or updated
**When** the write commits
**Then** BullMQ `search-indexer` job enqueues; Meilisearch index updates within 5s

**Given** Meilisearch is unavailable
**When** search request fires
**Then** fallback to Postgres `pg_trgm + unaccent` full-text search with degraded-UX notice ("Search is slower right now")

**Given** CI runs
**When** pipeline executes
**Then** tenant-isolation asserts no cross-tenant search hits

**Tests required:** Unit (query parsing, filter combination), Integration (indexing + search), Tenant-isolation (per-tenant index), E2E (type query → debounce → results < 1s), Chaos (Meilisearch down → fallback works)

**Definition of Done:** All AC + 10 CI gates + search-down runbook + 5 review layers.

---

### Story 3.10: Shopkeeper identifies dead stock (products unsold beyond configurable threshold in days)

**Class:** B — Read-only dead-stock reporting dashboard; no compliance/auth.

**As a Shop Owner (Rajesh-ji)**,
I want a dashboard flagging pieces that haven't sold in 180 days,
So that I can plan a festive discount or send them back to karigar for redesign.

**FRs implemented:** FR34
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/api/src/modules/inventory/inventory.dead-stock.service.ts` (new — reads from read-replica per Epic 14)
- `apps/shopkeeper/src/features/inventory/components/DeadStockDashboard.tsx` (new)
- `packages/db/src/schema/shop-settings.ts` (extend — `dead_stock_threshold_days INT DEFAULT 180`)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #5
**Depends on:** Epic 2 Story 2.1 (shop_settings) for threshold config
**Complexity:** S

**Acceptance Criteria:**

**Given** a Shopkeeper has 50 products unsold for > 180 days
**When** they open Dead Stock dashboard
**Then** table lists products with `first_listed_at`, `days_in_stock`, `weight`, `estimated_value`, `last_viewed_at`
**And** sort by days_in_stock DESC by default
**And** "Suggest Action" column shows contextual nudge (discount / karigar / repurpose)

**Given** CI runs
**When** pipeline executes
**Then** all gates pass

**Tests required:** Unit (days-since calculation, threshold config), Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

## Epic 4: Shopkeeper sets today's gold rate and sees live prices throughout the app; customer sees the same rate on home

**Goal:** Shopkeeper trusts today's gold rate (auto from IBJA with fallback) across billing + inventory valuation + customer app home; manually overrides when feed fails.

**FRs covered:** FR35, FR36, FR37, FR38, FR39, FR40
**Phase:** Phase 0 — Sprint 3
**Dependencies:** Epic 1 (auth + observability); used by Epic 3 (valuation), Epic 5 (billing), Epic 7 (customer rate widget)

---

### Story 4.1: System auto-fetches IBJA gold rates every 15 minutes with Metals.dev fallback and cached-last-known-good

**Class:** A — Foundational rates adapter + circuit breaker + fallback chain feeding all downstream pricing/invoices/compliance GST.

**As a Shop Owner (Rajesh-ji)**,
I want today's gold rate to update automatically at reasonable intervals without me refreshing anything — and if IBJA is down, the system falls back silently,
So that every invoice, valuation, and customer-facing price reflects reality.

**FRs implemented:** FR35, FR37
**NFRs verified:** NFR-P7 (15-min refresh, < 100ms Redis serve), NFR-I2 (circuit breaker + fallback chain), NFR-I5 (retry + exponential backoff)
**Modules + packages touched:**
- `packages/integrations/rates/src/port.ts` (new — `RatesPort` interface)
- `packages/integrations/rates/src/ibja-adapter.ts` (new — primary)
- `packages/integrations/rates/src/metalsdev-adapter.ts` (new — fallback)
- `packages/integrations/rates/src/fallback-chain.ts` (new — primary → fallback → cache)
- `packages/integrations/rates/src/last-known-good-cache.ts` (new — Redis-backed)
- `apps/api/src/modules/pricing/pricing.module.ts` + `pricing.service.ts` (new)
- `apps/api/src/workers/rates-refresh.processor.ts` (new — BullMQ scheduled job every 15 min)
- `packages/db/src/schema/ibja-rate-snapshots.ts` (new — platform-global, not tenant-scoped)

**ADRs governing:** ADR-0006 (adapter + fallback)
**Pattern rules honoured:** MUST #2 (money via packages/money), MUST #10 (JSDoc on public fns)
**Complexity:** L

**Acceptance Criteria:**

**Given** BullMQ scheduler fires `rates-refresh` job at 09:00 IST
**When** IbjaAdapter.getRatesByPurity() succeeds
**Then** rates persist to `ibja_rate_snapshots` table (platform-global) + Redis cache
**And** circuit-breaker state resets to CLOSED
**And** rates are available at `GET /api/v1/rates/current` returning `{ GOLD_24K: { perGramPaise, fetchedAt }, GOLD_22K: ..., GOLD_18K: ..., SILVER_999: ..., SILVER_925: ... }` in < 100ms

**Given** IBJA returns 5xx for 5 consecutive attempts within 60s
**When** circuit breaker opens
**Then** next fetch calls MetalsDevAdapter instead
**And** if MetalsDev also fails, LastKnownGoodCache returns stale rates with `stale: true` flag

**Given** CI runs
**When** pipeline executes
**Then** contract tests pass for every adapter (mock + real sandbox)

**Tests required:** Unit (each adapter shape, fallback chain order, circuit breaker state transitions), Integration (full refresh with Testcontainers Postgres + Redis), Contract (RatesPort conformance per adapter), Chaos (IBJA timeouts, malformed responses, Metals.dev also down → cache serves)

**Definition of Done:** All AC + 10 CI gates + rates-outage runbook + 5 review layers.

---

### Story 4.2: Shopkeeper manually overrides today's gold rate when IBJA feed is unavailable or disputed

**Class:** B — Shop-scoped rate override with audit log; safe setting.

**As a Shop Owner (Rajesh-ji)**,
I want to set today's 22K rate manually to ₹6,842 when my trusted source differs from IBJA,
So that my pricing is always honest and no customer argues with a stale number.

**FRs implemented:** FR36
**NFRs verified:** NFR-S9 (override audit-logged with reason)
**Modules + packages touched:**
- `packages/db/src/schema/shop-rate-overrides.ts` (new — tenant-scoped; overrides are shop-specific)
- `packages/db/src/migrations/0008_rate_overrides.sql`
- `apps/api/src/modules/pricing/pricing.service.ts` (extend — `setOverride`; applied per-tenant at read time)
- `apps/shopkeeper/app/rates/override.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #8
**Complexity:** S

**Acceptance Criteria:**

**Given** a Shop Owner sees IBJA 22K = ₹6,820 but believes the correct rate is ₹6,842
**When** they enter override value + reason "IBJA stale this morning"
**Then** `shop_rate_overrides` row inserts with valid-until (end-of-day default)
**And** `audit_events` logs `PRICING_RATE_OVERRIDE_SET` with before/after/reason
**And** all subsequent pricing reads for this shop use override until validity expires

**Given** CI runs
**When** pipeline executes
**Then** tenant-isolation asserts tenant A override does not affect tenant B rates

**Tests required:** Unit (override application logic), Integration (override + read + audit), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 4.3: Shopkeeper views historical gold rate chart for 30/90/365 days

**Class:** C — Read-only rate history chart; no behavior change.

**As a Shop Owner (Rajesh-ji)**,
I want to look at the last 90 days of gold rate history before advising a customer on rate-lock timing,
So that I give credible advice backed by real data.

**FRs implemented:** FR38
**NFRs verified:** NFR-P5 (chart renders < 2s)
**Modules + packages touched:**
- `apps/api/src/modules/pricing/pricing.service.ts` (extend — `getHistory(range)`)
- `apps/shopkeeper/app/rates/history.tsx` (new)
- `packages/ui-mobile/business/RateHistoryChart.tsx` (new — uses Victory Native or Recharts)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #2, MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** the `ibja_rate_snapshots` table has 365 days of data
**When** a Shopkeeper selects "90 Days · 22K"
**Then** chart renders line graph with date X-axis + rate Y-axis + today's rate marked
**And** hover/tap reveals daily value
**And** Hindi labels ("पिछले 90 दिन · 22K")

**Given** CI runs
**When** pipeline executes
**Then** all gates pass

**Tests required:** Unit (range bucketing, rate aggregation), Integration, A11y (chart has text alternative + ARIA live region for selected value)

**Definition of Done:** All AC + 10 CI gates + Storybook RateHistoryChart + 5 review layers.

---

### Story 4.4: Customer app home screen displays today's live gold rate

**Class:** B — Public customer-app rate-widget endpoint; safe customer-facing display.

**As a Customer (Priya browsing at 9pm before wedding shopping)**,
I want to see today's 22K and 24K rate on the home screen the moment I open the app,
So that I know whether to buy today or wait for tomorrow.

**FRs implemented:** FR39
**NFRs verified:** NFR-P1 (home cold-start < 60s p95 on 4G), NFR-P8 (first-load JS ≤ 250KB)
**Modules + packages touched:**
- `packages/ui-mobile/atoms/RateWidget.tsx` (new — 3 variants: full / compact / ticker)
- `packages/ui-web/atoms/RateWidget.tsx` (new — web version)
- `apps/customer/app/(tabs)/index.tsx` (new — customer home; full integration in Epic 7)
- `apps/web/src/app/page.tsx` (new — customer web home; full integration in Epic 7)
- `apps/api/src/modules/catalog/catalog.controller.ts` (extend — `GET /api/v1/catalog/rates` public read)

**ADRs governing:** ADR-0006, ADR-0007 (polling), ADR-0008 (white-label theming)
**Pattern rules honoured:** MUST #2, MUST #6 (no hex in customer app — tokens only), MUST #7 (i18n), MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** a Customer opens the app or web
**When** the home screen mounts
**Then** RateWidget fetches from `/api/v1/catalog/rates` with tenant inferred from host or X-Tenant-Id
**And** displays 22K + 24K + silver 999 per gram with freshness timestamp
**And** polling refreshes every 60s (medium-hot per ADR-0007)
**And** rate > 30 min old triggers "Updated X ago" with yellow freshness dot

**Given** the rates feed is offline
**When** the widget fetches
**Then** shows cached last-known-good with "Rates temporarily offline — showing last confirmed" message

**Given** CI runs
**When** pipeline executes
**Then** Semgrep `no-hex-in-customer-app` passes; axe-core passes; Lighthouse CI score ≥ 90

**Tests required:** Unit (3 variants render correctly), Integration (with rates adapter), E2E (open app → rate visible within 60s p95 on 4G throttled), A11y (ARIA live region for rate updates)

**Definition of Done:** All AC + 10 CI gates + Storybook RateWidget (3 variants × 2 tenant themes) + Chromatic VR + 5 review layers.

---

### Story 4.5: System auto-calculates product price from the canonical formula (weight × rate + making + stones + GST 3+5 + hallmark fee)

**Class:** A — packages/money pricing formula + packages/compliance GST split + weight-precision harness validation.

**As the Billing System**,
I need to compute product price deterministically from a single source of truth — `packages/money` + `packages/compliance/gst` — so every invoice, PDP, and valuation uses the same math,
So that paise-level precision is guaranteed across 10,000+ transactions.

**FRs implemented:** FR40
**NFRs verified:** NFR-C2 (GST 3+5 hardcoded), weight-precision harness must pass
**Modules + packages touched:**
- `packages/money/src/pricing.ts` (new — `computeProductPrice({ weight, rate, makingChargePct, stoneCharges, hallmarkFee }) → PriceBreakdown`)
- `packages/compliance/src/gst/split.ts` (new — `applyGstSplit({ metalPaise, makingPaise })` pure)
- `packages/compliance/src/gst/rates.ts` (new — `GST_METAL_RATE_BP = 300`, `GST_MAKING_RATE_BP = 500`)
- `packages/testing/weight-precision/src/harness.ts` (extend — real pricing formula now validated)

**ADRs governing:** ADR-0003, ADR-0011
**Pattern rules honoured:** MUST #2, MUST #9 (compliance gates for money), MUST #10
**Complexity:** M

**Acceptance Criteria:**

**Given** a product with net_weight=10.0000g, making_charge_pct=12%, stone_charges=₹5,000, hallmark_fee=₹45, at 22K rate ₹6,842/g
**When** `computeProductPrice` runs
**Then** gold_value = 10.0000 × ₹6,842 = ₹68,420 (paise-exact: 6842000)
**And** making_charge = 12% × ₹68,420 = ₹8,210.40 → paise 821040 (floor)
**And** gst_metal = 3% × ₹68,420 = ₹2,052.60 → paise 205260 (floor)
**And** gst_making = 5% × ₹8,210.40 = ₹410.52 → paise 41052 (floor)
**And** total_paise = 6842000 + 821040 + 500000 + 205260 + 41052 + 4500 = 8413852 → ₹84,138.52

**Given** the 10K-weight-precision harness runs
**When** all 10,000 synthetic transactions compute via `computeProductPrice`
**Then** every total matches golden reference (decimal.js high-precision) to paise exact
**And** zero FLOAT arithmetic anywhere in the call tree (Semgrep validates)

**Given** CI runs
**When** pipeline executes
**Then** weight-precision harness passes; Semgrep money-safety passes

**Tests required:** Unit (each pricing component, edge cases: zero weight, zero making, high-value, small-value), 10K harness, Property-based (weight, rate, making permutations)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 4.6: Shopkeeper sees a RateUpdateToast when their manual override saves or an IBJA refresh completes

**Class:** C — Designed-moment rate-update toast animation; UI-only, no business logic.

**As a Shopkeeper (Ravi)**,
I want a subtle, 1-second confirmation toast when the rate changes — "आज का भाव अद्यतन" — so I know my tap landed,
So that I never wonder whether my override stuck.

**FRs implemented:** FR36 (UX piece), UX-DR9 (RateUpdateToast designed moment)
**NFRs verified:** NFR-A5 (200% zoom tolerant), NFR-A8 (form success announced to screen readers)
**Modules + packages touched:**
- `packages/ui-mobile/business/RateUpdateToast.tsx` (new — Tier 3 designed-moment component; 1-sec subtle animation, gold flash, haptic light)
- Integrates with Story 4.2 override flow + BullMQ rates-refresh completion

**ADRs governing:** ADR-0007
**Pattern rules honoured:** MUST #6, MUST #7
**Complexity:** XS

**Acceptance Criteria:**

**Given** a Shopkeeper saves a manual rate override
**When** the server acknowledges with HTTP 200
**Then** RateUpdateToast fires: gold flash 150ms, Hindi text "आज का भाव अद्यतन हो गया", dismiss 2s, light haptic
**And** `prefers-reduced-motion` respected: 0 animation, static appearance
**And** ARIA live region announces "Rate updated" in active locale

**Given** CI runs
**When** pipeline executes
**Then** Storybook VR + axe-core passes

**Tests required:** Unit (animation timing, reduced-motion fallback), Storybook (2 tenant themes × hi-IN + en-IN), A11y

**Definition of Done:** All AC + 10 CI gates + Storybook stories + 5 review layers.

---
