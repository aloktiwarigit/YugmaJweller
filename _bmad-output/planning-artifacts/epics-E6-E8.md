---
generatedBy: 'Opus main orchestrator'
epic: 'E6 + E8'
date: '2026-04-17'
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Epic 6 Story 6.8 ships the DPDPA deletion workflow (soft-30-day → hard, retaining legally-required
    invoice/KYC with customer notification per DPDPA §9).
  - >
    Epic 6 Story 6.9 ships FR68 consent schema foundation (viewing_consent table + API) so Epic 12
    can begin only after this lands. This is the pre-requisite for the consent-first invariant.
  - >
    Epic 8 loyalty accrual listens to invoice.created events from Epic 5 Story 5.1.
---

---

## Epic 6: Shopkeeper knows every customer — purchase history, family links, notes, occasions

**Goal:** Shopkeeper builds a rich customer record across purchases + family + notes + occasions. Enables Epic 12 walk-in context + Epic 13 reminder notifications. DPDPA deletion workflow ships here.

**FRs covered:** FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR63
**Phase:** Phase 0 — Sprint 4-5
**Dependencies:** Epic 1

---

### Story 6.1: Shopkeeper creates a customer record with phone primary key per shop

**As a Shopkeeper (Ravi at counter with walk-in customer)**,
I want to create a new customer record in 30 seconds — phone + name minimum, address + PAN + DOB optional — with validation,
So that this customer's every future interaction (billing, wishlist, reviews, rate-lock) is linked to this record.

**FRs implemented:** FR56
**NFRs verified:** NFR-S3 (PAN encrypted at app layer with tenant-scoped KMS CMK when captured), NFR-C6 (DPDPA consent schema)
**Modules + packages touched:**
- `apps/api/src/modules/crm/*` (new — customer CRUD)
- `packages/db/src/schema/customers.ts` (new — phone unique per shop_id; PAN encrypted ciphertext column)
- `packages/db/src/migrations/0011_customers.sql` (new — with RLS + unique constraint on shop_id+phone)
- `packages/security/src/envelope.ts` (used — encryptPII for PAN)
- `apps/shopkeeper/app/customer/new.tsx` + `[id]/edit.tsx` (new)
- `packages/i18n/locales/hi-IN/crm.json` (new)

**ADRs governing:** ADR-0002, ADR-0003, ADR-0005, ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5, MUST #7, MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper opens customer-new form
**When** they enter phone (+91XXXXXXXXXX) + name
**Then** validation checks unique phone per tenant (RLS-scoped uniqueness)
**And** on save, customer record inserts with optional fields blank; audit logs `CRM_CUSTOMER_CREATED`
**And** form copy in Hindi with English fallback labels

**Given** a PAN is entered (optional at creation; required only at Rs 2L billing from Story 5.3)
**When** save fires
**Then** PAN is encrypted via `encryptPII(shopId, pan)`; plaintext never persisted or logged

**Given** a phone collision within the same shop
**When** save attempts
**Then** 409 Conflict with suggestion "Customer with this phone exists — open their profile?"

**Given** CI runs, all gates pass including tenant-isolation (customer A on tenant 1 invisible to tenant 2)

**Tests required:** Unit (phone validation, PAN encryption), Integration (create + RLS enforcement), Tenant-isolation, E2E (create → appears in list)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 6.2: Shopkeeper links family members to a customer

**As a Shopkeeper (Ravi noting Priya's wedding buyer context)**,
I want to link her mother, sister, mother-in-law as family members on her profile,
So that future interactions with those family members recognize their relationship to Priya (useful for bridal custom orders).

**FRs implemented:** FR57
**NFRs verified:** NFR-S9 (link audit)
**Modules + packages touched:**
- `packages/db/src/schema/family-members.ts` (new — directed edges: customer_id → related_customer_id + relationship enum)
- `apps/api/src/modules/crm/family.service.ts` (new)
- `apps/shopkeeper/src/features/crm/components/FamilyLinker.tsx` (new)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #5, MUST #8
**Complexity:** S

**Acceptance Criteria:**

**Given** a Shopkeeper on customer profile
**When** they tap "Family Member जोड़ें" → search for another customer → select relationship (parent/spouse/child/sibling/in-law)
**Then** directed-edge record created; visible on both customer profiles
**And** Hindi relationship labels ("माँ", "पति", "बहन")

**Given** CI runs, all gates pass including tenant-isolation

**Tests required:** Unit (relationship bidirectionality), Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 6.3: Shopkeeper views a customer's full purchase history across all staff and all dates

**As a Shopkeeper (Ravi greeting a returning customer)**,
I want to see every invoice this customer has ever had with our shop — dates, amounts, items, HUIDs,
So that I can reference past purchases and personalize the conversation.

**FRs implemented:** FR58
**NFRs verified:** NFR-P5 (< 2s for 100-invoice customer history)
**Modules + packages touched:**
- `apps/api/src/modules/crm/history.service.ts` (new — read from billing module via service interface; not direct table access)
- `apps/shopkeeper/src/features/crm/components/PurchaseHistoryList.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0009 (module boundary — CRM reads Billing via service API)
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** a customer with 45 historical invoices
**When** Shopkeeper opens their profile → "Purchase History" tab
**Then** list renders chronologically; each row: date, invoice-id, total (formatted via packages/money), line count, payment method
**And** tap row → opens invoice PDF

**Given** CI runs, all gates pass

**Tests required:** Unit (pagination, sort), Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 6.4: Shopkeeper tracks customer credit balance (advance paid + outstanding dues)

**As a Shop Owner (Rajesh-ji)**,
I want a single view of every customer who owes me money OR has paid me in advance,
So that I never call the wrong customer for payment or double-charge someone who pre-paid.

**FRs implemented:** FR59
**NFRs verified:** NFR-S9
**Modules + packages touched:**
- `packages/db/src/schema/customer-balances.ts` (new — computed materialized view refreshed on invoice/payment events)
- `apps/api/src/modules/crm/balance.service.ts` (new)
- `apps/shopkeeper/src/features/crm/components/BalanceCard.tsx` (new)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** customer X has 3 invoices: ₹50K paid-in-full + ₹30K with ₹10K advance + ₹20K unpaid
**When** Shopkeeper views balance
**Then** outstanding=₹40K; advance=₹10K; clearly labeled in Hindi

**Given** CI runs, all gates pass

**Tests required:** Unit (balance math), Integration (balance updates on invoice/payment events), Tenant-isolation, Weight-precision

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 6.5: Shopkeeper adds private notes to a customer record

**As a Shopkeeper (Ravi after Priya's visit)**,
I want to write "Daughter's wedding Nov 15; MIL conservative color preference" on Priya's profile,
So that any staff member — including me 3 months from now — sees this context when Priya returns.

**FRs implemented:** FR60
**NFRs verified:** NFR-S9 (note audit)
**Modules + packages touched:**
- `packages/db/src/schema/customer-notes.ts` (new — append-style with author; soft-delete allowed)
- `apps/api/src/modules/crm/notes.service.ts` (new)
- `apps/shopkeeper/src/features/crm/components/NotesSection.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0004 (LWW conflict resolution for notes across devices)
**Pattern rules honoured:** MUST #1, MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** Ravi on customer profile
**When** he types a note + saves
**Then** note persists with author + timestamp; visible to all shop staff
**And** concurrent edits from two devices use LWW resolution per ADR-0004; older edit preserved in audit

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation, Sync (LWW on notes)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 6.6: Shopkeeper records customer occasions for reminder workflows

**As a Shop Owner (Rajesh-ji)**,
I want to note Priya's birthday on Nov 12 and her husband's anniversary on Dec 3,
So that a week before each, I get a push reminder to send a personalized WhatsApp message.

**FRs implemented:** FR61
**NFRs verified:** NFR-P12 (reminder WhatsApp dispatched within 30s of trigger)
**Modules + packages touched:**
- `packages/db/src/schema/customer-occasions.ts` (new)
- `apps/api/src/modules/crm/occasions.service.ts` (new)
- `apps/api/src/workers/occasion-reminder.processor.ts` (new — BullMQ scheduled; fires 7 days before + on-day)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #3 (event emit), MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** Shopkeeper adds birthday=Nov 12 to Priya's profile
**When** scheduled job runs Nov 5
**Then** `crm.occasion_reminder` event emits → shopkeeper push (Epic 13 Story 13.6)

**Given** CI runs, all gates pass

**Tests required:** Unit (date math, 7-day-before trigger), Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 6.7: Shopkeeper searches customers by phone/name/recent-activity with Hindi/English transliteration

**As a Shop Staff (Ravi during Dhanteras rush)**,
I want to find Anupriya Verma by typing "anu" OR "अनु" OR last-4 phone digits — in under 1 second,
So that I can pull up her record before the next customer loses patience.

**FRs implemented:** FR62
**NFRs verified:** NFR-P3 (< 1s search), NFR-P11 (offline local search)
**Modules + packages touched:**
- `packages/integrations/search/meilisearch-adapter.ts` (extend — per-tenant customer index with Hindi transliteration)
- `apps/api/src/modules/crm/search.service.ts` (new)
- `apps/shopkeeper/src/features/crm/components/CustomerSearch.tsx` (new)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #1, MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** a shop with 2000 customer records
**When** Ravi types "priya" in search
**Then** Meilisearch returns matches in Hindi OR English via transliteration mapping (300ms debounce)
**And** recent customers (last 7 days) surface as chips below input when search empty

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (index + search), Tenant-isolation (per-tenant index)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 6.8: Customer requests DPDPA-compliant deletion; shopkeeper honours within 30 days retaining legally-required records

**As a Customer (Priya changing her mind about a jeweller 2 years later)**,
I want to delete my personal data from Anchor Jewellers' app via a single request,
So that my privacy is respected per DPDPA 2023 law.

**As the Goldsmith System**,
I need to soft-delete within 30 days then hard-delete, retaining only invoices + KYC + HUID records per tax/PMLA law, with customer notification of this retention.

**FRs implemented:** FR63
**NFRs verified:** NFR-C6 (DPDPA), NFR-C5 (PMLA 5-yr retention supersedes delete for compliance records), NFR-C9 (child data — parental consent workflow)
**Modules + packages touched:**
- `apps/api/src/modules/crm/dpdpa-deletion.service.ts` (new)
- `apps/api/src/workers/dpdpa-hard-delete.processor.ts` (new — BullMQ scheduled; runs on day-30 after soft-delete)
- `packages/db/src/schema/customers.ts` (extend — `deleted_at TIMESTAMPTZ`, `hard_delete_scheduled_at TIMESTAMPTZ`)
- `apps/customer/app/account/delete.tsx` (new — customer-app deletion request UI)

**ADRs governing:** ADR-0002, ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** Priya opens customer app → Account → Delete my data
**When** she confirms with OTP (re-auth)
**Then** `DELETE /api/v1/customer/me` soft-deletes: `customers.deleted_at = now()`; PII columns redacted (name, email, address scrubbed; phone becomes hash); wishlist/view-events anonymized; schedule hard-delete in 30 days
**And** email + WhatsApp confirmation sent with 30-day grace period notice + "retained: invoices, HUID, KYC per Indian tax/PMLA law"

**Given** day 30 elapses
**When** BullMQ `dpdpa-hard-delete` fires
**Then** remaining PII columns purged; only invoice + HUID + KYC records remain with customer_id linked to a compliance-retention record
**And** audit_events preserved immutably per NFR-S9

**Given** customer changes their mind before day 30
**When** they re-auth and request restore
**Then** soft-delete reversed; PII restored from encrypted archive

**Given** CI runs, all gates pass; DPDPA-deletion runbook exists

**Tests required:** Unit (soft/hard delete logic, PII redaction), Integration (full flow + restore), Tenant-isolation, Compliance (retention of legally-required records proven)

**Definition of Done:** All AC + 10 CI gates + runbook `docs/runbooks/mass-customer-deletion-request.md` + 5 review layers.

---

### Story 6.9: Customer consent schema foundation for viewing tracking (FR68 schema only)

**As the Goldsmith System**,
I need the consent table + API endpoints ready so Epic 12 can begin tracking viewing events only with opt-in.

**FRs implemented:** FR68 (schema foundation only — full opt-in flow in Epic 12 Story 12.1)
**NFRs verified:** NFR-C6
**Modules + packages touched:**
- `packages/db/src/schema/viewing-consent.ts` (new)
- `packages/db/src/migrations/0012_viewing_consent.sql`
- `apps/api/src/modules/crm/consent.controller.ts` (new — GET/PUT /api/v1/customer/me/consent/viewing)

**ADRs governing:** ADR-0002, ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5
**Complexity:** XS

**Acceptance Criteria:**

**Given** the schema migration ships
**When** Epic 12 Story 12.1 begins
**Then** it has `viewing_consent` table + read/write API ready
**And** RLS enforces customer can only read/write their own consent record

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

## Epic 8: Customer earns and redeems loyalty points with every purchase

**Goal:** Tiered loyalty program auto-accrues points on invoice completion; customer sees tier + points + tier-progression in app; shopkeeper redeems points on invoices; tier transitions on rolling-12-month total.

**FRs covered:** FR69, FR70, FR71, FR72
**Phase:** Phase 1 — Sprint 6
**Dependencies:** Epic 5 (invoice.created event), Epic 6 (customer record), Epic 2 Story 2.4 (loyalty tier config)

---

### Story 8.1: System auto-credits loyalty points on invoice completion using shopkeeper-configured earn rate

**As a Shopkeeper (Rajesh-ji)**,
I want every invoice to auto-credit loyalty points at my configured rate (say, 1 point per ₹100 of gold value),
So that my regulars see points accumulate without me managing anything.

**FRs implemented:** FR69
**NFRs verified:** NFR-P6 (≤ 30s propagation to customer app)
**Modules + packages touched:**
- `apps/api/src/modules/loyalty/*` (new — module + service + repository + state machine)
- `packages/db/src/schema/loyalty-transactions.ts` (new — append-only ledger)
- `packages/db/src/schema/customer-loyalty.ts` (new — aggregate: points_balance, current_tier, tier_since)
- `apps/api/src/workers/loyalty-accrual.processor.ts` (new — BullMQ listener on invoice.created)

**ADRs governing:** ADR-0002, ADR-0009 (listener on billing event)
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #8
**Complexity:** M

**Acceptance Criteria:**

**Given** invoice.created event fires with gold_value_paise=6842000 and tenant earn rate=1 point per ₹100
**When** loyalty-accrual processor consumes
**Then** 684 points credit to customer; `loyalty_transactions` insert append-only; customer_loyalty aggregate increments
**And** audit logs `LOYALTY_POINTS_ACCRUED`

**Given** CI runs, all gates pass

**Tests required:** Unit (accrual math), Integration (invoice → event → accrual), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 8.2: Customer views current tier + points + progression toward next tier

**As a Customer (Priya checking her app)**,
I want to see I'm at "Gold tier, 8,420 points, 1,580 more to Platinum",
So that I know I'm close to the next benefit and I'm tempted to come back for that last purchase.

**FRs implemented:** FR70
**NFRs verified:** NFR-P1 (< 60s cold-start), NFR-A1 (WCAG AA contrast)
**Modules + packages touched:**
- `packages/ui-mobile/atoms/LoyaltyTierBadge.tsx` (new Tier 2)
- `packages/ui-web/atoms/LoyaltyTierBadge.tsx` (new)
- `apps/customer/app/(tabs)/account.tsx` (extend with loyalty card)
- `apps/web/src/app/account/loyalty/page.tsx` (new)
- `apps/api/src/modules/loyalty/loyalty.controller.ts` (extend — `GET /api/v1/customer/me/loyalty`)

**ADRs governing:** ADR-0007, ADR-0008
**Pattern rules honoured:** MUST #6 (no hex — tokens), MUST #7 (i18n)
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya at Gold tier with 8,420 points and Platinum threshold=10,000
**When** she opens loyalty card
**Then** "Gold · 8,420 अंक · Platinum तक 1,580 और" renders with progress bar at 84%
**And** Hindi labels + tier colors per tenant theme

**Given** CI runs, all gates pass including axe-core + Chromatic VR (2-tenant theme)

**Tests required:** Unit, E2E, A11y, VR

**Definition of Done:** All AC + 10 CI gates + Storybook LoyaltyTierBadge (3 tiers × 2 themes) + 5 review layers.

---

### Story 8.3: Shopkeeper redeems customer loyalty points as invoice discount line

**As a Shopkeeper (Ravi during checkout)**,
I want to apply Priya's 8,420 points as a ₹842 discount on this invoice (redemption rate: 10 points = ₹1),
So that her loyalty materializes as real savings at the counter.

**FRs implemented:** FR71
**NFRs verified:** NFR-S9 (redemption audit)
**Modules + packages touched:**
- `apps/api/src/modules/loyalty/redemption.service.ts` (new)
- `apps/api/src/modules/billing/billing.service.ts` (extend — accepts loyalty_redemption line)
- `apps/shopkeeper/src/features/billing/components/LoyaltyRedemptionSheet.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0011 (redemption passes through compliance gate if it changes totals near compliance thresholds)
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #9
**Complexity:** S

**Acceptance Criteria:**

**Given** Ravi is building Priya's invoice
**When** he taps "Redeem Points"
**Then** Sheet shows "8,420 points = ₹842 discount"; Ravi taps Apply
**And** invoice recalculates: loyalty_redemption_line = -₹842; total adjusts
**And** on save, redemption transaction insert append-only; points_balance decrements atomically

**Given** CI runs, all gates pass

**Tests required:** Unit (redemption math, atomic points debit), Integration (full invoice with redemption), Weight-precision (redemption doesn't break paise accounting), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 8.4: System auto-upgrades/downgrades customer tier based on rolling-12-month total

**As the Goldsmith System**,
I need to re-evaluate every customer's tier nightly against their rolling-12-month purchase total — upgrading them when they cross thresholds, downgrading when they drop below,
So that loyalty tiers reflect current spending, not historical peak.

**FRs implemented:** FR72
**NFRs verified:** NFR-S9 (tier transition audit)
**Modules + packages touched:**
- `apps/api/src/workers/loyalty-tier-eval.processor.ts` (new — BullMQ scheduled daily 3 AM IST)
- `apps/api/src/modules/loyalty/tier.service.ts` (new — transition logic + state machine)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5
**Complexity:** M

**Acceptance Criteria:**

**Given** a customer crossed ₹3 lakh rolling-12-month total today
**When** nightly tier-eval job runs
**Then** transition Silver → Gold; `loyalty_transactions` logs TIER_UPGRADED; customer receives WhatsApp celebration (Epic 13 Story 13.5)

**Given** a customer's rolling total dropped below Silver threshold (₹50K)
**When** eval runs
**Then** transition Gold → Silver; less-celebratory notification ("renewal window: buy within 30 days to maintain Gold")

**Given** CI runs, all gates pass

**Tests required:** Unit (rolling window, transition logic), Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 8.5: Customer celebrates tier upgrade with designed-moment animation

**As a Customer (Priya hitting Platinum)**,
I want a genuinely celebratory moment in the app — confetti, a personalised Hindi message, a badge unlock — when I upgrade,
So that the effort of reaching this tier feels acknowledged.

**FRs implemented:** UX-DR25 success-beat for tier upgrade
**NFRs verified:** NFR-A (reduced-motion respected), NFR-P1
**Modules + packages touched:**
- `packages/ui-mobile/business/TierUpgradeCelebration.tsx` (new Tier 3 designed-moment)
- `packages/ui-web/business/TierUpgradeCelebration.tsx` (new)
- `apps/customer/app/account/tier-upgrade.tsx` (new — deep-linked from WhatsApp push)

**ADRs governing:** ADR-0008 (tenant-themed celebration)
**Pattern rules honoured:** MUST #6, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Priya taps the WhatsApp "Platinum achieved" push
**When** she lands in the app
**Then** TierUpgradeCelebration fires: 400ms confetti + gold glow + Hindi copy "Platinum सदस्य बनने की बधाई" + tenant-branded
**And** prefers-reduced-motion respected: static badge appears without animation
**And** celebration fires ONCE per upgrade (idempotency via `celebrated_at` flag)

**Given** CI runs, all gates pass including Chromatic VR (2 tenant themes) + axe-core

**Tests required:** Unit (idempotency), VR, A11y

**Definition of Done:** All AC + 10 CI gates + Storybook TierUpgradeCelebration + 5 review layers.

---
