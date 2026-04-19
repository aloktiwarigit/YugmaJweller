---
generatedBy: 'Opus main orchestrator (completing CE directly after subagent 32k cap)'
epic: 'E5'
date: '2026-04-17'
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Epic 5 is the most compliance-sensitive epic in the project. Every money-touching story calls
    packages/compliance gates (ADR-0011). The 10K weight-precision harness from Epic 1 must pass
    on every PR in this epic. Tenant-isolation + weight-precision + compliance-gate test suites
    are all mandatory CI gates for every story 5.1-5.13.
  - >
    IR-report correction #3 applied: Story 5.1 uses hardcoded 12% making-charge default. Story 5.2
    swaps to shop_settings (from Epic 2 Story 2.2). This intentional sequencing lets Epic 5 start
    parallel to Epic 2 completing.
  - >
    Every financial invariant is tested: GST 3+5 split is paise-deterministic; Section 269ST is
    hard-block at Rs 1,99,999; PAN Rule 114B is hard-block at Rs 2L without PAN/Form 60; PMLA
    cumulative warns at Rs 8L and blocks at Rs 10L with CTR auto-generation; URD RCM self-invoice
    is at 3% GST payable by jeweller; HUID is validated per hallmarked line.
---

---

## Epic 5: Shopkeeper bills a customer in 90 seconds with compliant GST + HUID + cash-cap + PAN enforcement

**Goal:** The 90-second billing loop — anchor jeweller's core daily operation. Estimate → invoice → auto GST(3+5) + HUID + PAN at Rs 2L + Section 269ST cash-cap + PMLA cumulative tracking + split payment + WhatsApp share. Works offline; syncs on reconnect. Compliance hard-blocks throughout via `packages/compliance`.

**FRs covered:** FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR55
**Phase:** Phase 0 — Sprint 4-5
**Dependencies:** Epic 1 (auth + tenant + audit + money package), Epic 3 (inventory + sync), Epic 4 (pricing + rates). Epic 2 Story 2.2 integrates in Story 5.2+.

---

### Story 5.1: Shopkeeper generates a first B2C invoice with GST 3+5 + HUID per line + hardcoded 12% making charge

**Class:** A — Touches packages/compliance (GST split + HUID validate hard-blocks) + packages/money + new billing module + RLS on invoices + audit write path.

**As a Shopkeeper (Ravi at the billing counter)**,
I want to create a simple B2C invoice for a gold chain — one line, one customer, hardcoded making charge, compliant GST split — that prints and saves to the customer record,
So that the first production invoice goes out on Day 1 of anchor launch, even before Epic 2 settings wire up.

**FRs implemented:** FR41 (estimate), FR42 (estimate → invoice), FR43 (B2C invoice with GST 3+5 + HSN 7113/7114 + HUID), FR50 (HUID capture)
**NFRs verified:** NFR-P4 (< 5s invoice gen p95), NFR-C1 (BIS/HUID), NFR-C2 (GST hardcoded), NFR-S9 (audit)
**Modules + packages touched:**
- `apps/api/src/modules/billing/*` (new — `billing.module.ts`, `billing.controller.ts`, `billing.service.ts`, `billing.repository.ts`, `invoice.state-machine.ts`)
- `packages/db/src/schema/invoices.ts` + `invoice-items.ts` + `payments.ts` (new)
- `packages/db/src/migrations/0009_billing.sql` (new — with RLS on every table)
- `packages/compliance/src/gst/split.ts` (used — `applyGstSplit`)
- `packages/compliance/src/huid/validate.ts` (used — `validateHuidPresence`)
- `packages/money/src/pricing.ts` (used — Story 4.5 `computeProductPrice`)
- `packages/shared/schemas/invoice.schema.ts` (new)
- `apps/shopkeeper/app/billing/new.tsx` + `[id].tsx` (new — single-screen revealing-sections per UX-DR13)
- `apps/shopkeeper/src/features/billing/*` (new)
- `packages/ui-mobile/business/BillingLineBuilder.tsx` + `InvoiceLineItem.tsx` (new Tier-3)

**ADRs governing:** ADR-0002, ADR-0003, ADR-0005, ADR-0011
**Pattern rules honoured:** MUST #1, MUST #2, MUST #3 (invoice.created event), MUST #4 (idempotency), MUST #5, MUST #7, MUST #8, MUST #9 (compliance gates)
**Complexity:** XL — foundation invoice aggregate + state machine + first compliance gate integration

**Acceptance Criteria:**

**Given** a Shopkeeper opens billing with a customer selected (Epic 6 Story 6.1 prerequisite) and one product scanned (barcode from Story 3.3)
**When** they tap "Generate Invoice" with `Idempotency-Key` header
**Then** the server calls in order: `validateHuidPresence(lines)` → `applyGstSplit({ metal, making })` → `InvoiceRepository.insert` wrapped in `SET LOCAL app.current_shop_id`
**And** `audit_events` logs `INVOICE_CREATED` with full before=null / after=invoice-JSON
**And** `invoice.created` domain event emits (consumed by loyalty accrual Epic 8, inventory decrement Story 3.8, WhatsApp share Epic 13)
**And** response returns 201 with Invoice DTO and `Location: /api/v1/billing/invoices/<id>` header
**And** `Content-Type: application/problem+json` on any error (RFC 7807)

**Given** a hallmarked product line is missing HUID
**When** invoice creation is attempted
**Then** `validateHuidPresence` throws `ComplianceHardBlockError('compliance.huid_missing', { lineIndex: N })`
**And** UI renders `ComplianceInlineAlert` (UX-DR5) with warm Hindi tone: "hallmarked piece के लिए HUID ज़रूरी है"
**And** "Fix Now" CTA links back to product edit

**Given** the same Idempotency-Key is sent twice (network retry)
**When** second POST arrives
**Then** server returns cached 201 response with identical invoice-id; zero duplicate invoices created

**Given** CI runs
**When** pipeline executes
**Then** tenant-isolation + weight-precision + compliance-gate suites all pass
**And** Semgrep `goldsmith/compliance-gates-required` passes — asserts `applyGstSplit` + `validateHuidPresence` called before invoice insert

**Tests required:** Unit (invoice aggregate, GST split paise-exactness, HUID validation), Integration (invoice create → event → audit + inventory decrement), Tenant-isolation, Weight-precision (invoice totals paise-exact across 10K synthetic invoices), Compliance-gates (HUID missing → hard-block; Semgrep gate), E2E (scan → generate → 201 within 5s p95 on mid-tier Android), Load (50 concurrent invoices per tenant)

**Definition of Done:** All AC + 10 CI gates + Storybook for BillingLineBuilder + InvoiceLineItem in 2 tenant themes + runbook for invoice-generation-failure + 5 review layers.

---

### Story 5.2: Shopkeeper invoice reads making-charge defaults from `shop_settings` (integrates Epic 2 Story 2.2)

**Class:** B — Extends billing.service to read making-charge defaults from tenant-config; no new compliance gates.

**As a Shopkeeper (Rajesh-ji)**,
I want the invoice to auto-apply my configured making charge for the product category — 14% for bridal, 12% for daily-wear, 10% for wholesale — instead of the hardcoded 12%,
So that my margins are consistent and I don't have to type a percentage into every invoice.

**FRs implemented:** FR43 refinement, FR17 consumed
**NFRs verified:** NFR-P6 (settings propagate in < 30s if shopkeeper changes them mid-billing)
**Modules + packages touched:**
- `apps/api/src/modules/billing/billing.service.ts` (extend — reads from `packages/tenant-config/settings`)
- `packages/tenant-config/src/settings/*` (used — caches making-charge defaults per tenant in Redis with 60s TTL + pub/sub invalidation)

**ADRs governing:** ADR-0002, ADR-0005, ADR-0011
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #9
**Depends on:** Story 5.1 + Epic 2 Story 2.2
**Complexity:** S

**Acceptance Criteria:**

**Given** Epic 2 Story 2.2 has been merged and the Shopkeeper has set bridal=14%, daily-wear=12%, wholesale=10% in settings
**When** a bridal invoice is created
**Then** making-charge line uses 14% (not hardcoded 12%)
**And** if settings change mid-session, next invoice reflects new value within 30s (Redis pub/sub invalidates cache)

**Given** CI runs
**When** pipeline executes
**Then** all gates pass; integration test asserts settings read + invoice integration

**Tests required:** Unit (category-lookup logic), Integration (settings → billing flow), Tenant-isolation, Weight-precision

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 5.3: Invoice hard-blocks completion at Rs 2 lakh total without PAN or Form 60

**Class:** A — Touches packages/compliance (PAN Rule 114B hard-block) + packages/security encryptPII for PAN with KMS.

**As the Goldsmith System**,
I need to block any invoice ≥ Rs 2 lakh from saving without PAN or Form 60 captured — per Income Tax Rule 114B — so the jeweller is never liable for regulatory penalties.

**FRs implemented:** FR46
**NFRs verified:** NFR-C4 (PAN hard-block), NFR-S3 (PAN encrypted at app layer)
**Modules + packages touched:**
- `packages/compliance/src/pan/rule-114b.ts` (new — `enforcePanRequired({ totalPaise, pan, form60 })` throws if missing)
- `packages/compliance/src/pan/validate-format.ts` (new — PAN regex + checksum)
- `packages/security/src/envelope.ts` (used — `encryptPII` for PAN with tenant-scoped KMS CMK)
- `packages/db/src/schema/invoices.ts` (extend — `pan_encrypted_ciphertext BYTEA`, `form60_data JSONB` — both optional; required via enforcement)
- `apps/shopkeeper/src/features/billing/components/PanPromptSheet.tsx` (new — UX-DR11 warm-tone modal)

**ADRs governing:** ADR-0011, ADR-0003
**Pattern rules honoured:** MUST #1, MUST #5, MUST #9
**Depends on:** Story 5.1 + Epic 6 Story 6.1 (customer record can hold PAN reference)
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper building an invoice where total crosses Rs 2 lakh
**When** they tap "Generate"
**Then** `enforcePanRequired` in the service call tree throws `ComplianceHardBlockError('compliance.pan_required')`
**And** UI intercepts: PanPromptSheet slides up (bottom-sheet on mobile, center modal on web)
**And** Hindi copy: "इस bill के लिए PAN या Form 60 ज़रूरी है" + "hum aapki safety ke liye" warmth framing
**And** Shopkeeper can (a) enter valid 10-char PAN (auto-uppercase; format validated; checksum validated), OR (b) tap "Form 60 भरें" → short form

**Given** a PAN is entered matching a format
**When** server validates
**Then** PAN is encrypted via `encryptPII(shopId, pan)` producing ciphertext stored in `invoices.pan_encrypted_ciphertext`
**And** plaintext PAN is never persisted, logged, or visible in audit before/after JSON (redacted)

**Given** Form 60 is submitted with required fields (name, address, reason-for-no-PAN, estimated annual income)
**When** invoice saves
**Then** `form60_data` JSONB stored encrypted
**And** Form 60 PDF can be regenerated on demand for tax audit

**Given** CI runs
**When** pipeline executes
**Then** compliance-gate suite has a test: invoice total Rs 2L + 1 paise without PAN → must throw ComplianceHardBlockError('compliance.pan_required')

**Tests required:** Unit (PAN format + checksum, Form 60 schema, encryption), Integration (Rs 2L+ invoice without PAN blocks; with PAN succeeds; with Form 60 succeeds), Tenant-isolation (tenant A cannot decrypt tenant B PAN — per-tenant KMS CMK), E2E (fill Rs 2L invoice → PAN prompt appears → enter → invoice saves)

**Definition of Done:** All AC + 10 CI gates + Storybook PanPromptSheet + 5 review layers.

---

### Story 5.4: Invoice hard-blocks cash payment at Rs 1,99,999 per customer/day with supervisor audit-logged override

**Class:** A — Touches packages/compliance (Section 269ST cash-cap hard-block) + compliance-override supervisor audit.

**As the Goldsmith System**,
I need to block any cash payment line that would cause total cash received in a single transaction/day/event to reach or exceed Rs 2 lakh — per Income Tax Section 269ST — because the penalty (100% of amount) falls on the jeweller.

**FRs implemented:** FR47
**NFRs verified:** NFR-C3 (Section 269ST hard-block)
**Modules + packages touched:**
- `packages/compliance/src/cash-cap/section-269st.ts` (new — `enforce269ST` + `override269ST`)
- `packages/db/src/schema/pmla-aggregates.ts` (new — append-only; used for customer/day/event cash tally)
- `packages/db/src/migrations/0010_pmla_aggregates.sql`
- `apps/api/src/modules/billing/compliance-override.service.ts` (new — supervisor override flow)
- `apps/shopkeeper/src/features/billing/components/CashCapBlockModal.tsx` (new — UX-DR11 with alternative-action suggestions: UPI/card split)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** a customer has paid ₹1,50,000 cash earlier today in the same shop and is attempting to pay another ₹80,000 cash now
**When** the payment is being recorded
**Then** `enforce269ST` computes projected daily cumulative = 230,000 paise-style × 100 = Rs 2,30,000
**And** threshold Rs 1,99,999 exceeded → throws `ComplianceHardBlockError('compliance.cash_cap_exceeded', { allowedOverridePath: '...' })`
**And** UI CashCapBlockModal renders with Hindi warmth: "आज की cash limit पूरी। UPI या card से बाकी amount लें"
**And** quick-actions suggest: "UPI for ₹30,001" + "Card for rest" split

**Given** a Shop Owner (role=OWNER or MANAGER) taps "Override with Justification"
**When** they enter reason (e.g., "Wedding party; customer requires cash tomorrow, not available")
**Then** `override269ST` function is called — verifies role + creates audit entry `COMPLIANCE_OVERRIDE_269ST` with justification + approver user-id
**And** invoice saves but flagged `compliance_overrides_jsonb` contains the override metadata (for tax-audit reconstruction)

**Given** Shop Staff (role=STAFF) attempts override
**When** action is requested
**Then** 403 Forbidden with `errorCode: 'compliance.override.role_required'`

**Given** CI runs
**When** pipeline executes
**Then** compliance-gate suite has tests: exactly-1,99,999 cash = OK; 1,99,999 + 1 paise = block; override path audit-logged

**Tests required:** Unit (cash-cap edge cases, override role check, per-day aggregation with timezone), Integration (invoice flow with cash cap block + override), Tenant-isolation, Compliance-gate (all boundary conditions), E2E (over-cap invoice → block modal → UPI split → save)

**Definition of Done:** All AC + 10 CI gates + runbook for cash-cap-override incident + 5 review layers.

---

### Story 5.5: System tracks customer cumulative monthly cash and warns at Rs 8 lakh

**Class:** A — Touches packages/compliance (PMLA cumulative tracker) + pmla_aggregates table + compliance-gate suite.

**As the Goldsmith System**,
I need to track cumulative cash received per customer per calendar month and alert the shopkeeper when a customer approaches the PMLA reporting threshold (Rs 10 lakh), so CTR preparation is timely.

**FRs implemented:** FR53 (warn portion)
**NFRs verified:** NFR-C5 (PMLA), NFR-S9 (audit append-only)
**Modules + packages touched:**
- `packages/compliance/src/pmla/cumulative.ts` (new — `trackPmlaCumulative(tx, ctx, customerId, month, cashIncrementPaise)` returns threshold status)
- `packages/db/src/schema/pmla-aggregates.ts` (used — INSERT ... ON CONFLICT DO UPDATE atomic)
- `apps/api/src/workers/compliance-pmla.processor.ts` (new — BullMQ consumer of invoice.created events)
- `apps/shopkeeper/src/features/billing/components/PmlaWarningBanner.tsx` (new — shows on customer profile + billing screens)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** a customer has cumulative ₹7,95,000 cash in current month
**When** an ₹8,000 cash invoice line is recorded
**Then** `trackPmlaCumulative` runs inside invoice transaction, atomically upserts monthly aggregate
**And** returns `{ cumulativePaise: 80_300_000, threshold: 'warn' }`
**And** `pmla.cash_threshold_warning` event emits → shopkeeper push notification (Epic 13 Story 13.6) + banner on customer profile
**And** invoice saves successfully (warn, not block)

**Given** a month-boundary crossing
**When** invoice fires in new month
**Then** aggregation starts fresh for new month; prior-month aggregate frozen

**Given** CI runs
**When** pipeline executes
**Then** compliance-gate suite + tenant-isolation all pass

**Tests required:** Unit (month-boundary, threshold calc, concurrent-insert atomicity), Integration (full invoice → aggregate + event + banner), Tenant-isolation, Chaos (concurrent cash invoices same customer)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 5.6: PMLA cumulative cash hard-blocks at Rs 10 lakh with CTR template auto-generation

**Class:** A — Touches packages/compliance (PMLA hard-block at Rs 10L + CTR auto-gen).

**As the Goldsmith System**,
I need to hard-block any additional cash that would cross Rs 10 lakh monthly per customer and automatically generate a pre-filled Cash Transaction Report (CTR) template for the shopkeeper to file within 15 days of month-end.

**FRs implemented:** FR53 (block), FR54 (CTR/STR template generation)
**NFRs verified:** NFR-C5 (PMLA 5-year retention)
**Modules + packages touched:**
- `packages/compliance/src/pmla/cumulative.ts` (extend — block threshold)
- `packages/compliance/src/pmla/ctr-template.ts` (new — `generateCtrTemplate(customer, month, transactions) → CtrDocument`)
- `packages/compliance/src/pmla/str-template.ts` (new — STR template available to OWNER only)
- `apps/api/src/modules/billing/compliance-reports.controller.ts` (new — `GET /api/v1/billing/compliance/ctr`)
- `apps/shopkeeper/src/features/billing/components/CtrDownloadCard.tsx` (new)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** a customer has cumulative ₹9,85,000 cash in current month
**When** a ₹20,000 cash line is recorded
**Then** `trackPmlaCumulative` throws `ComplianceHardBlockError('compliance.pmla_threshold_blocked')`
**And** invoice halts; UI shows CashCapBlockModal-style CTR-prep notice
**And** CTR template becomes downloadable from compliance reports screen

**Given** the shopkeeper (OWNER role) opens CTR template for customer
**When** they tap "Generate"
**Then** PDF + JSON output pre-fills customer PAN, name, address, month-to-date cash transactions table, jewellery shop GSTIN + BIS registration
**And** shopkeeper can (a) review + (b) download + (c) mark as filed with FIU-IND acknowledgement number

**Given** CI runs
**When** pipeline executes
**Then** compliance-gate suite tests all threshold boundaries

**Tests required:** Unit (CTR/STR generation, PDF rendering, field pre-fill correctness), Integration (10L+ invoice → block + CTR available), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + PMLA-filing runbook under `docs/runbooks/ctr-str-filing.md` + 5 review layers.

---

### Story 5.7: Shopkeeper records split payment (cash + UPI + card + net-banking + old-gold-adjust + scheme-redeem)

**Class:** A — Razorpay adapter + webhook signature verification + packages/compliance gates for cash portion (269ST).

**As a Shopkeeper (Ravi during Dhanteras)**,
I want to record multi-method payment on a single invoice — ₹1,50,000 cash + ₹80,000 UPI + old-gold ₹20,000 adjustment — with Razorpay webhook confirmation,
So that the customer walks out with one bill reflecting the real payment mix.

**FRs implemented:** FR45
**NFRs verified:** NFR-I3 (Razorpay webhook idempotency), NFR-S9 (payment audit)
**Modules + packages touched:**
- `packages/db/src/schema/payments.ts` (extend — `method TEXT`, `amount_paise`, `razorpay_payment_id`, `razorpay_order_id`, `webhook_status`)
- `packages/integrations/payments/razorpay-adapter.ts` (new — `createOrder`, `verifyWebhookSignature`, `fetchPayment`)
- `packages/integrations/payments/port.ts` (new — PaymentsPort)
- `apps/api/src/modules/billing/payment.service.ts` (new)
- `apps/api/src/modules/webhooks/razorpay.controller.ts` (new — inbound webhook; signature verify; BullMQ enqueue)
- `apps/api/src/workers/razorpay-webhook.processor.ts` (new — idempotent processor)

**ADRs governing:** ADR-0006 (adapter + webhook idempotency), ADR-0011
**Pattern rules honoured:** MUST #3, MUST #4 (idempotency), MUST #5, MUST #9
**Depends on:** Story 5.4 (Section 269ST gates cash portion)
**Complexity:** L

**Acceptance Criteria:**

**Given** a Shopkeeper building an invoice
**When** they enter split: cash ₹50,000 + UPI ₹80,000 + old-gold ₹20,000 (old-gold line from Story 5.9)
**Then** each payment line validates against its respective gate (cash → Section 269ST)
**And** UPI triggers Razorpay `createOrder` returning order_id; client displays QR / intent link
**And** customer pays → Razorpay webhook fires → signature verified → BullMQ job processes → payment status updates invoice

**Given** a Razorpay webhook arrives twice (network retry)
**When** signature verification passes twice
**Then** first webhook processes; second is deduped by `razorpay_payment_id` idempotency key
**And** no duplicate `PAYMENT_RECORDED` audit events

**Given** a UPI payment is initiated but webhook delays > 60s
**When** client polls Razorpay API directly
**Then** payment status resolves (success OR pending) — never leaves invoice in "Unknown" state

**Given** CI runs
**When** pipeline executes
**Then** all gates pass; webhook idempotency tests pass

**Tests required:** Unit (split math, Razorpay adapter, signature verify), Integration (order → webhook → audit), Contract (RazorpayAdapter conformance), Chaos (duplicate webhooks, delayed webhooks, Razorpay 5xx)

**Definition of Done:** All AC + 10 CI gates + payment-webhook-failure runbook + 5 review layers.

---

### Story 5.8: Shopkeeper generates B2B wholesale invoice with correct GST treatment and vendor GSTIN

**Class:** A — Billing B2B branch + compliance GST treatment (B2B-specific) on RLS-sensitive invoice path.

**As a Shopkeeper (Ravi)**,
I want to generate a wholesale invoice for a vendor with their GSTIN captured, different making-charge tier, and B2B GST treatment,
So that wholesale customers get tax-compliant invoices matching their input-credit claims.

**FRs implemented:** FR44
**NFRs verified:** NFR-C2
**Modules + packages touched:**
- `packages/db/src/schema/invoices.ts` (extend — `invoice_type TEXT CHECK (invoice_type IN ('B2C','B2B_WHOLESALE'))`, `buyer_gstin TEXT`, `buyer_business_name TEXT`)
- `apps/api/src/modules/billing/billing.service.ts` (extend — B2B branch)
- `apps/shopkeeper/src/features/billing/components/InvoiceTypeToggle.tsx` (new)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper toggles "Wholesale B2B" on a new invoice
**When** form reveals GSTIN input + business name
**Then** GSTIN validates (format + checksum)
**And** invoice generates with B2B GST treatment (IGST for interstate; CGST+SGST for intrastate based on buyer state code in GSTIN)
**And** making-charge defaults to wholesale tier (10% per Epic 2 Story 2.2)
**And** PDF shows buyer GSTIN + input-credit-eligible breakdown

**Given** CI runs, all gates pass

**Tests required:** Unit (GSTIN validation + state-code parsing, IGST vs CGST/SGST logic), Integration (B2B invoice creation), Tenant-isolation, Weight-precision

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 5.9: Shopkeeper records URD (old-gold) purchase with auto self-invoice under RCM 3%

**Class:** A — Touches packages/compliance (URD/RCM self-invoice 3% hard-block) + invoice state-machine.

**As a Shopkeeper (Rajesh-ji)**,
I want to buy back a customer's old gold at today's rate, auto-generate a self-invoice under Reverse Charge Mechanism, and adjust it against their new purchase,
So that URD/RCM compliance is automatic and I don't owe GST twice on the same metal.

**FRs implemented:** FR48 (URD RCM self-invoice), FR49 (old-gold adjustment)
**NFRs verified:** NFR-C2
**Modules + packages touched:**
- `packages/compliance/src/urd-rcm/self-invoice.ts` (new — `buildUrdSelfInvoice({ weight, purity, agreedRate, customer })`)
- `packages/db/src/schema/urd-purchases.ts` (new — old-gold record; links to invoice for adjustment)
- `apps/api/src/modules/billing/urd.service.ts` (new)
- `apps/shopkeeper/app/billing/urd-exchange.tsx` (new)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper records a customer's 15g of old 22K gold at ₹6,000/g
**When** they save the URD purchase
**Then** self-invoice PDF generates: `gold_value = 15 × 6000 = ₹90,000`; `gst_rcm_3pct = ₹2,700`; `net_payable_to_customer = ₹90,000 - ₹2,700 = ₹87,300`
**And** customer signs digitally or via printed form
**And** when customer buys new jewelry, old-gold value (₹87,300) applies as adjustment line in new invoice

**Given** CI runs, all gates pass

**Tests required:** Unit (URD RCM math paise-exact), Integration (URD + adjustment on new invoice), Weight-precision, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 5.10: Shopkeeper shares invoice as PDF via WhatsApp / SMS / email

**Class:** B — Billing invoice-pdf + share service + WhatsApp integration; non-compliance invoice output.

**As a Shopkeeper (Ravi)**,
I want to tap one button to send the invoice on WhatsApp right after the customer pays — with the designed-moment celebration (haptic + toast + PDF-slide-to-WhatsApp animation),
So that the customer leaves with the bill already in their chat.

**FRs implemented:** FR51
**NFRs verified:** NFR-P12 (WhatsApp send < 30s)
**Modules + packages touched:**
- `apps/api/src/modules/billing/invoice-pdf.service.ts` (new — invoice PDF renderer with tenant branding; WeasyPrint or Puppeteer)
- `apps/api/src/modules/billing/share.service.ts` (new — triggers notification dispatcher from Epic 13)
- `packages/integrations/whatsapp/aisensy-adapter.ts` (used — stub here; full in Epic 13 Story 13.1)
- `apps/shopkeeper/src/features/billing/components/InvoiceShareCelebration.tsx` (new — UX-DR12 designed moment)

**ADRs governing:** ADR-0006, ADR-0008 (white-label — PDF uses tenant logo + colors)
**Pattern rules honoured:** MUST #3, MUST #6 (tenant branding via tokens), MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** an invoice has just been generated
**When** Shopkeeper taps "WhatsApp भेजें"
**Then** InvoiceShareCelebration fires: haptic medium + 3s toast "Bhej diya" + animated PDF-slide-to-WhatsApp card
**And** PDF renders with tenant logo + colors + shop address + invoice details + HUID per line + GST breakdown
**And** PDF uploads to S3 `tenants/<shop_id>/invoices/<invoice_id>.pdf` with pre-signed 7-day URL
**And** WhatsApp message sent via AiSensy with PDF attachment + templated greeting in Hindi

**Given** CI runs, all gates pass

**Tests required:** Unit (PDF rendering per-tenant theme), Integration (generate → share → AiSensy queued), E2E (tap share → celebration fires → PDF in WhatsApp test account)

**Definition of Done:** All AC + 10 CI gates + Storybook InvoiceShareCelebration + 5 review layers.

---

### Story 5.11: Shopkeeper voids or modifies invoice within 24-hour window (owner-only); after window, credit-note flow only

**Class:** A — Invoice state-machine (ISSUED → VOIDED) + audit compensating events for inventory/loyalty/PMLA.

**As a Shop Owner (Rajesh-ji)**,
I want to correct a mistake on an invoice I made this morning — before it's too late — but after the window, force me through credit-note flow so audit trail stays clean.

**FRs implemented:** FR52
**NFRs verified:** NFR-S9 (void + credit-note audit)
**Modules + packages touched:**
- `packages/db/src/schema/invoices.ts` (extend — `voided_at TIMESTAMPTZ`, `voided_by_user_id UUID`, `void_reason TEXT`)
- `packages/db/src/schema/credit-notes.ts` (new — for post-window corrections)
- `apps/api/src/modules/billing/void.service.ts` (new)
- `apps/api/src/modules/billing/invoice.state-machine.ts` (extend — transitions: DRAFT → ISSUED → (VOIDED if within 24h) → (CREDIT_NOTED if after))
- `apps/shopkeeper/src/features/billing/components/VoidInvoiceSheet.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0011
**Pattern rules honoured:** MUST #1, MUST #3, MUST #5, MUST #9
**Complexity:** M

**Acceptance Criteria:**

**Given** an invoice issued < 24 hours ago and Shop Owner role
**When** Owner taps "Void Invoice" with reason
**Then** state transitions ISSUED → VOIDED; inventory decrement rolls back; loyalty accrual reverses; audit logs BEFORE/AFTER; new event `invoice.voided`

**Given** an invoice issued > 24 hours ago
**When** any user taps "Correct Invoice"
**Then** redirected to credit-note flow — a new credit-note document is issued; original invoice remains in audit trail intact

**Given** Staff (non-owner) attempts void
**When** action fires
**Then** 403 with `errorCode: 'billing.void.role_required'`

**Given** CI runs, all gates pass

**Tests required:** Unit (state-machine transitions, 24h window calc, role check), Integration (void + compensating effects on inventory + loyalty + PMLA aggregate), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 5.12: Shopkeeper exports transaction data as GSTR-1 and GSTR-3B CSV

**Class:** B — GSTR-1/3B CSV export reads compliance-gated data without introducing new hard-blocks.

**As a Shopkeeper's Accountant (consuming exports monthly)**,
I need GSTR-1 and GSTR-3B-compatible CSVs covering the month's transactions so I can upload to the GST portal without manual re-keying.

**FRs implemented:** FR55 (CSV MVP; JSON Phase 2 deferred)
**NFRs verified:** NFR-P5 (export < 2s for a month of 500 invoices/day × 30 = 15K invoices)
**Modules + packages touched:**
- `apps/api/src/modules/billing/gstr-export.service.ts` (new — maps invoice rows to GSTR-1 and GSTR-3B schemas)
- `apps/api/src/workers/gstr-export.processor.ts` (new — BullMQ async for large exports)
- `apps/shopkeeper/app/reports/gstr-export.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0005
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5
**Complexity:** M

**Acceptance Criteria:**

**Given** a Shopkeeper selects month=Oct 2026
**When** they request GSTR-1 export
**Then** BullMQ job runs against read replica; CSV generates with columns matching GSTR-1 portal template (B2B + B2C-L + B2C-S + Exports + Amendments)
**And** PDF + CSV delivered via WhatsApp + email link after job completes (< 2 min)

**Given** CI runs, all gates pass

**Tests required:** Unit (GSTR-1 + GSTR-3B row mapping, month boundary), Integration (export end-to-end for fixture month)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 5.13: Anchor jeweller completes first real invoice within 48 hours of onboarding (end-to-end integration)

**Class:** A — E2E integration story covering every Epic 5 compliance gate + payment + offline sync + audit trail.

**As the Anchor Jeweller (Rajesh-ji, Day 1 of shop operations on the app)**,
I want to complete my first real customer invoice on the app — not a demo — within 48 hours of the platform team's onboarding visit,
So that I abandon the paper daybook and the app becomes my operational system of record.

**FRs implemented:** All Epic 5 FRs integrated
**NFRs verified:** NFR-P4 (90-second p95 billing loop end-to-end), NFR-P11 (offline < 500ms), NFR-R1 (99.5% uptime)
**Modules + packages touched:** All Epic 5 modules; integration-only story
**ADRs governing:** All billing-related ADRs
**Pattern rules honoured:** All 10 MUSTs
**Complexity:** L (integration)

**Acceptance Criteria:**

**Given** the anchor jeweller is onboarded (tenant provisioned, staff invited, inventory loaded, settings configured)
**When** a real customer walks in for a bridal set purchase
**Then** Shopkeeper (Ravi) scans customer, scans barcode, auto-price renders with live IBJA rate, HUID validated, PAN captured (Rs 3L+ invoice), split payment (cash within cap + UPI), invoice generates, WhatsApp shared, customer leaves with bill in < 90 seconds p95
**And** invoice syncs to cloud; customer record updated; loyalty points accrued; inventory decremented; PMLA aggregate updated; audit trail complete

**Given** the anchor shop's internet drops mid-transaction
**When** invoice is drafted locally via WatermelonDB
**Then** invoice queued for sync; reconnect reconciles; zero data loss

**Given** CI runs
**When** pipeline executes
**Then** E2E integration test "Anchor first invoice" passes — full flow against sandboxed Razorpay + real Postgres + synthetic customer + IBJA sandbox

**Tests required:** E2E (full 90-second flow on Android mid-tier device against staging env), Load (50 concurrent invoices per tenant mimicking Dhanteras), Chaos (internet drop mid-flow; Razorpay webhook delay; IBJA stale)

**Definition of Done:** Anchor signs off on production launch; all 10 CI gates green for the Epic 5 merge train; all 5 review layers passed; runbook for "first-48-hours anchor support" authored under `docs/runbooks/anchor-launch-week-1.md`.

---
