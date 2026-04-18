---
generatedBy: 'BMAD Create Epics & Stories — Step 3'
epics: [9, 10, 11, 12]
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/adr/0004-offline-sync-protocol.md
  - _bmad-output/planning-artifacts/adr/0006-vendor-adapter-pattern.md
  - _bmad-output/planning-artifacts/adr/0011-compliance-package-hard-block-gateway.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
project_name: 'Goldsmith'
date: '2026-04-17'
status: 'complete'
collaborators: 'Amelia (dev) + Winston (architect) + Sally (UX) + Maya (design-thinking coach)'
---

# Goldsmith — Epics 9, 10, 11, 12: Story Breakdown

## Binding Pattern Rules (enforced in every story below)

1. **State-machine stories** assert transitions are guarded (invalid transitions rejected with 422), side-effects enqueued to BullMQ, and every transition appended to `audit_events`.
2. **Photo-upload stories** (Epic 11) assert S3 upload + ImageKit rendering + WhatsApp dispatch via BullMQ + idempotency check on the BullMQ job ID.
3. **Payment stories** (Epics 9 + 11) assert Razorpay webhook idempotency (ADR-0006 `idempotency.check/mark` pattern) + Razorpay adapter contract test referenced.
4. **Epic 12 stories 12.2+** reference the consent invariant: system MUST read `viewing_consent.opted_in` before ingesting or surfacing any identified viewing event. No story may start until 12.1 merges.
5. **Epic 11 completion story** integrates `packages/compliance` gates (PAN Rule 114B if deposit pull-through raises total ≥ Rs 2L) and `packages/billing` invoice path from Epic 5.
6. **Hindi-first UX copy** — every AC that touches customer-facing copy includes a representative Hindi string example.
7. **Cross-app-surface mutations** use TanStack Query `onMutate` optimistic update with `onError` rollback.

---

## Epic 9: Customer reserves a rate for 7 days with a deposit; if they come back, the locked rate is honoured

**User outcome:** Customer sees a product, taps "आज का rate lock करें", pays a Razorpay deposit, receives WhatsApp + push confirmation showing locked-rate + expiry. When they return within validity, the locked rate is honoured automatically on invoice. Shopkeeper can manually honour a post-expiry lock with audit-logged justification.

**FRs covered:** FR80, FR81, FR82, FR83
**NFRs enforced:** NFR-I3 (Razorpay webhook idempotency), NFR-S9 (override audit), NFR-P6 (state reflects ≤30s)
**ADRs governing:** ADR-0006 (vendor adapter + webhook idempotency), ADR-0004 (state-machine-governed conflict resolution: first-writer-wins on lock), ADR-0011 (compliance — if final purchase ≥ Rs 2L, PAN gate from Epic 5 applies)
**Modules touched:** `apps/api/src/modules/rate-lock/`, `packages/integrations/payments/`, `apps/customer/`, `apps/shopkeeper/`
**UX-DRs:** UX-DR5 (RateLockCard), UX-DR14 (rate-lock flow within browse-to-reserve loop)
**Phase:** Phase 1 — Sprint 7
**Dependencies:** Epic 5 (invoice reads rate-lock), Epic 7 (customer app entry point)

---

### Story 9.1: Customer books a rate-lock with a Razorpay deposit

**As a** customer browsing a product,
**I want to** lock today's gold rate by paying a refundable deposit via Razorpay,
**so that** I can return within the configured validity window and buy at the price I saw today.

**FR:** FR80, FR81
**Modules:** `apps/api/src/modules/rate-lock/` (aggregate + state-machine.ts + service + controller), `packages/integrations/payments/` (razorpay-adapter, contract-tests), `apps/customer/src/screens/RateLockScreen`
**ADRs:** ADR-0006 (webhook idempotency), ADR-0004 (first-writer-wins: second lock attempt on same product by same customer rejected with 409 while one is Active)

**Acceptance Criteria:**

**AC1 — Rate-lock initiation:**
```
Given a logged-in customer on a product detail screen showing 24K rate Rs 6,842/g
When they tap "आज का rate lock करें"
Then the app calls POST /api/v1/rate-locks with { productId, shopId, purityKey: 'GOLD_24K', idempotencyKey: <uuid> }
And the server validates the customer has no Active rate-lock for the same product+shop
And the server creates a rate_locks row with status='PENDING_PAYMENT', locked_rate_paise=<current rate>, expires_at=now()+shop.rate_lock_duration_days
And the server initiates a Razorpay order for the deposit amount (shopkeeper-configured per FR20)
And the customer app displays a Razorpay payment sheet pre-filled with the deposit amount
```

**AC2 — Deposit payment and state transition to Active:**
```
Given the Razorpay payment sheet is displayed
When the customer completes UPI/card payment
Then Razorpay fires payment.captured webhook to POST /api/v1/webhooks/razorpay
And the webhook controller verifies HMAC-SHA256 signature (ADR-0006)
And deduplicates on razorpay event ID via idempotency.check('razorpay:<event.id>')
And enqueues BullMQ job 'rate-lock.activate' with { rateLockId, paymentId, tenantId }
And the worker transitions rate_lock.status: PENDING_PAYMENT → ACTIVE (state-machine.ts guard: only from PENDING_PAYMENT)
And the transition is appended to audit_events with { action: 'RATE_LOCK_ACTIVATED', subjectId: rateLockId, metadata: { paymentId, lockedRatePaise, expiresAt } }
And the worker enqueues 'notifications.rate-lock-confirmed' job for WhatsApp + push dispatch (Epic 13 consumer)
```

**AC3 — Idempotency on duplicate webhook:**
```
Given the Razorpay webhook fires twice for the same payment.captured event (network retry scenario)
When the second webhook arrives
Then idempotency.check returns the stored result (ADR-0006 pattern)
And no second state transition is attempted
And the controller returns 200 without re-processing
```

**AC4 — State-machine guard on invalid transition:**
```
Given a rate_lock in PENDING_PAYMENT state
When the system attempts to transition directly to REDEEMED (skipping ACTIVE)
Then state-machine.ts throws InvalidTransitionError
And the attempt is logged to audit_events with outcome: 'REJECTED'
And the API returns 422 with body { error: 'rate_lock.invalid_transition', from: 'PENDING_PAYMENT', attempted: 'REDEEMED' }
```

**AC5 — Razorpay adapter contract test:**
```
Given the razorpay-adapter under packages/integrations/payments/src/razorpay-adapter.ts
When the contract test suite in contract-tests.ts runs
Then all PaymentsPort interface methods are covered: createOrder, capturePayment, verifyWebhookSignature, refund
And the mock-adapter passes the same contract assertions
And CI runs contract tests on every PR touching the payments package
```

**AC6 — Tenant isolation:**
```
Given two tenants (shop_id A and shop_id B) each with a customer
When customer of tenant A books a rate-lock
Then the rate_locks row has shop_id = A
And RLS policy prevents any query from tenant B's context from reading that row
And the tenant-isolation test suite asserts this across all rate-lock endpoints
```

**Definition of Done:**
- [ ] `rate-lock/state-machine.ts` defines states: PENDING_PAYMENT | ACTIVE | REDEEMED | EXPIRED | OVERRIDE_APPLIED; transitions table complete
- [ ] `rate-lock/aggregate.ts` encapsulates all domain logic; controller is thin
- [ ] Razorpay webhook handler deduplicates + signature-verifies + enqueues
- [ ] Contract test suite green for razorpay-adapter
- [ ] Tenant-isolation test suite green for rate-lock endpoints
- [ ] TypeScript strict; no FLOAT in weight/money columns; Semgrep clean

---

### Story 9.2: System stores locked rate and customer sees active rate-lock in profile

**As a** customer who paid a rate-lock deposit,
**I want to** see my active rate-lock clearly in my profile — with the locked rate, expiry countdown, and deposit amount —
**so that** I know exactly what I locked and when I need to return.

**FR:** FR81, FR96 (customer profile integration)
**Modules:** `apps/customer/src/screens/Profile/RateLockDetail`, `apps/api/src/modules/rate-lock/rate-lock.controller.ts` (GET /rate-locks/me), `packages/ui-mobile/components/RateLockCard`
**ADRs:** ADR-0007 (TanStack Query polling 30s for rate-lock status)

**Acceptance Criteria:**

**AC1 — Profile displays active rate-lock:**
```
Given a customer with an ACTIVE rate-lock (locked_rate_paise=684200, expires_at=7 days from now, deposit_paise=500000)
When they open their profile → "Mere Rate Locks" section
Then they see RateLockCard showing:
  - Product image + name
  - "Locked rate: ₹6,842/g (24K)" in Hindi: "Lock हुआ rate: ₹6,842/g"
  - Expiry countdown: "6 दिन 14 घंटे बचे"
  - Deposit paid: "जमा: ₹5,000"
  - Status badge: "Active" (terracotta color, per UX-DR4 ProductBadge)
```

**AC2 — Optimistic update on rate-lock creation:**
```
Given the customer just completed the Razorpay deposit payment
When the app receives the payment success callback
Then TanStack Query onMutate inserts the new rate-lock optimistically into the profile list
And if the server returns an error on confirmation poll
Then onError rolls back the optimistic entry and shows a toast: "Rate lock confirm होने में देरी हो रही है, कृपया प्रतीक्षा करें"
```

**AC3 — Polling for status freshness:**
```
Given an active rate-lock displayed in the customer profile
When 30 seconds elapse
Then TanStack Query refetchInterval fires GET /api/v1/rate-locks/me with If-None-Match ETag header
And if status unchanged, server returns 304 and no re-render occurs
And if status changed to REDEEMED or EXPIRED, card updates accordingly within 30 seconds
```

**AC4 — Expired rate-lock display:**
```
Given a rate-lock whose expires_at has passed and status was transitioned to EXPIRED by the scheduled expiry job
When the customer views their profile
Then the RateLockCard shows status "Expired" (muted color, not terracotta)
And deposit refund status is shown: "जमा वापसी की स्थिति: [pending/completed]" (refund workflow is shopkeeper/policy governed)
```

**AC5 — Shopkeeper CRM view:**
```
Given a shopkeeper viewing a customer's CRM profile
When they open the customer detail screen
Then they see the customer's active rate-locks listed under "Rate Locks" tab
And each shows: product, locked rate, expiry, deposit amount
And the shopkeeper can tap to see the rate-lock detail and use it in billing (Story 9.3)
```

**Definition of Done:**
- [ ] GET /api/v1/rate-locks/me returns all rate-locks for authenticated customer scoped to current tenant
- [ ] RateLockCard component built per UX-DR5; Storybook story in Hindi + English variants
- [ ] TanStack Query polling at 30s interval with ETag support
- [ ] Optimistic update + rollback pattern implemented (onMutate / onError)
- [ ] Axe-core + Lighthouse CI green for RateLockCard (contrast, ARIA label on countdown timer)

---

### Story 9.3: System honours locked rate when customer purchases within validity

**As a** customer returning to purchase within my rate-lock validity,
**I want** the invoice to automatically use my locked rate without any manual action,
**so that** I get exactly the price I reserved and the shopkeeper doesn't need to look up my lock.

**FR:** FR82
**Modules:** `apps/api/src/modules/billing/` (invoice service reads rate-lock), `apps/api/src/modules/rate-lock/` (ACTIVE → REDEEMED transition), `packages/compliance/` (PAN gate if total ≥ Rs 2L)
**ADRs:** ADR-0011 (compliance gate), ADR-0004 (state-machine-governed: ACTIVE → REDEEMED only from ACTIVE)

**Acceptance Criteria:**

**AC1 — Billing service detects active rate-lock:**
```
Given a shopkeeper billing a customer who has an ACTIVE rate-lock for product SKU-RING-001
When the shopkeeper adds SKU-RING-001 to an invoice for that customer
Then the billing service calls rate-lock service: findActiveRateLock({ shopId, customerId, productId })
And the service returns the rate-lock with locked_rate_paise=684200
And the invoice line-item uses locked_rate_paise instead of today's live rate
And the invoice line shows: "Rate: ₹6,842/g (Rate Lock लागू — expires [date])" with a lock icon badge
```

**AC2 — Rate-lock redeemed on invoice completion:**
```
Given an invoice that uses a rate-lock
When the shopkeeper completes the invoice (status → COMPLETED)
Then within the same DB transaction, the billing service calls rate-lock service redeemRateLock({ rateLockId, invoiceId })
And state-machine.ts transitions rate_lock.status: ACTIVE → REDEEMED
And audit_events records: { action: 'RATE_LOCK_REDEEMED', subjectId: rateLockId, metadata: { invoiceId, lockedRatePaise, marketRateAtRedemptionPaise } }
And the customer receives a push notification: "आपका rate lock redeem हो गया — Invoice #INV-2024-001 तैयार है"
```

**AC3 — Compliance gate on high-value redemption:**
```
Given a customer redeeming a rate-lock where the total invoice amount is ≥ Rs 2,00,000
When the shopkeeper attempts to complete the invoice
Then packages/compliance enforcePanRequired({ total, pan, form60 }) is called
And if PAN is not captured on the customer record
Then a ComplianceHardBlockError is thrown and the ComplianceBlockModal surfaces: "₹2 लाख से ज़्यादा की खरीद के लिए PAN जरूरी है"
And the shopkeeper must enter the customer's PAN before invoice completes
```

**AC4 — Rate-lock not double-redeemed:**
```
Given a rate-lock that is already in REDEEMED state
When the billing service attempts to apply it to a second invoice
Then state-machine guard returns InvalidTransitionError
And the billing service falls back to current live rate for the line item
And a warning is shown: "Rate lock already used — current market rate applied"
```

**AC5 — Expired rate-lock not applied:**
```
Given a rate-lock in EXPIRED state
When the billing service checks for active rate-lock for that customer/product
Then findActiveRateLock returns null (only ACTIVE status is returned)
And the invoice uses the current live rate
And the billing UI does not show a rate-lock badge on that line item
```

**Definition of Done:**
- [ ] Billing service integrates rate-lock lookup on line-item add; single DB round-trip (JOIN not N+1)
- [ ] ACTIVE → REDEEMED transition inside invoice-completion DB transaction (atomic)
- [ ] Compliance gate called before invoice completion for rate-lock-applied invoices
- [ ] Integration test: lock rate at T=0, advance clock, complete invoice at T+3d → asserts locked rate on invoice line
- [ ] Integration test: lock at T=0, redeem at T+3d, attempt second invoice at T+4d → asserts live rate used

---

### Story 9.4: Shopkeeper manually honours post-expiry rate-lock with audit-logged justification

**As a** shop owner or manager,
**I want to** manually honour a customer's expired rate-lock with a justified override,
**so that** I can maintain customer trust when a legitimate delay caused the expiry, while every such exception is audit-logged.

**FR:** FR83
**Modules:** `apps/api/src/modules/rate-lock/` (OVERRIDE_APPLIED state), `packages/compliance/` (override audit pattern mirroring override269ST), `apps/shopkeeper/`
**ADRs:** ADR-0006 (audit pattern), ADR-0011 (override requires role check + audit)

**Acceptance Criteria:**

**AC1 — Override UI in shopkeeper app:**
```
Given a shopkeeper viewing a customer's CRM profile with an EXPIRED rate-lock
When they tap "Override karo — rate honour karo"
Then the app presents an ActionSheet (per UX-DR23 bottom-sheet) with:
  - Locked rate: ₹6,842/g
  - Expired: 2 days ago
  - A required free-text field: "कारण बताएं (जरूरी है)" [Justification required]
  - Role check: visible only to OWNER or MANAGER role (hidden for STAFF)
```

**AC2 — Override API and state transition:**
```
Given an OWNER/MANAGER provides justification "Customer was out of town — verified"
When they confirm the override
Then the app calls POST /api/v1/rate-locks/:id/override with { justification, approverUserId }
And the server verifies role = OWNER | MANAGER (403 otherwise)
And state-machine.ts transitions rate_lock.status: EXPIRED → OVERRIDE_APPLIED
And audit_events records: { action: 'RATE_LOCK_OVERRIDE_APPLIED', subjectId: rateLockId, metadata: { justification, approverUserId, originalExpiresAt, overrideAt } }
And the override is irrevocable — no transition out of OVERRIDE_APPLIED except system archival
```

**AC3 — Overridden lock honoured in billing:**
```
Given a rate-lock in OVERRIDE_APPLIED state
When the shopkeeper bills the customer for that product
Then the billing service's findActiveRateLock also returns OVERRIDE_APPLIED locks (in addition to ACTIVE)
And the invoice line uses the locked_rate_paise
And the invoice shows: "Rate Lock (Override Applied)" badge
And OVERRIDE_APPLIED → REDEEMED transition fires on invoice completion (same as AC2 in Story 9.3)
```

**AC4 — Audit trail query:**
```
Given the platform or shop owner queries audit_events for a rate-lock
When they filter by subjectId = rateLockId
Then they see the full lifecycle: PENDING_PAYMENT → ACTIVE → EXPIRED → OVERRIDE_APPLIED → REDEEMED
And each event has timestamp, user_id, and metadata
```

**AC5 — Tenant isolation on override:**
```
Given a Manager from tenant A attempting to override a rate-lock belonging to tenant B's customer
When the override API is called
Then RLS + tenant interceptor reject with 403
And audit_events logs the failed attempt
```

**Definition of Done:**
- [ ] OVERRIDE_APPLIED state in state-machine.ts with correct guards
- [ ] Role-check middleware on override endpoint (OWNER | MANAGER only)
- [ ] Justification is non-nullable DB column; API rejects empty string
- [ ] Audit event includes before/after state + approver + justification
- [ ] Unit test: STAFF role override attempt → 403; OWNER override → 200 + state transition

---

### Story 9.5: Customer receives rate-lock confirmation and expiry reminder via WhatsApp and push

**As a** customer who booked a rate-lock,
**I want to** receive an immediate WhatsApp confirmation with the locked rate and expiry date, and a reminder 24 hours before expiry,
**so that** I don't forget to return and use my locked rate.

**FR:** FR80 (confirmation), FR107, FR108 (notification channels)
**Modules:** `apps/api/src/modules/notifications/` (BullMQ jobs), `packages/integrations/whatsapp/` (AiSensy adapter), `packages/integrations/push/` (FCM adapter), scheduler for expiry reminder
**ADRs:** ADR-0006 (AiSensy + FCM adapter contract), NFR-P12 (WhatsApp <30s dispatch), NFR-I5 (retry + DLQ)

**Acceptance Criteria:**

**AC1 — Confirmation notification on activation:**
```
Given a rate-lock transitions to ACTIVE (Story 9.1 AC2)
When the BullMQ 'notifications.rate-lock-confirmed' job processes
Then AiSensy WhatsApp adapter sends a template message to the customer's registered phone within 30 seconds
  Template content (Hindi): "नमस्ते [नाम], आपका rate lock हो गया! Rate: ₹[rate]/g | Expiry: [date] | Deposit: ₹[amount] | अब आप [expiry date] तक इसी rate पर खरीद सकते हैं।"
And FCM push notification fires simultaneously: "Rate Lock Confirmed — ₹[rate]/g until [date]"
And notifications are logged to notification_audit_log with { tenantId, customerId, channel: 'WHATSAPP', templateId, deliveryStatus }
```

**AC2 — Expiry reminder 24 hours before:**
```
Given a rate-lock in ACTIVE state with expires_at 24 hours in the future
When the scheduled job 'rate-lock.expiry-reminder' runs (every 15 minutes, checks window)
Then the job enqueues 'notifications.rate-lock-expiry-reminder' if reminder_sent_at IS NULL
And sets reminder_sent_at = now() to prevent duplicate
And AiSensy sends: "⏰ आपका rate lock कल expire हो रहा है! Rate: ₹[rate]/g | [Shop Name] में आज ही आएं।"
And FCM push: "Rate Lock Expiring Tomorrow — ₹[rate]/g"
```

**AC3 — Notification retry and DLQ:**
```
Given AiSensy returns a transient error (5xx) on notification dispatch
When the BullMQ job fails
Then BullMQ retries with exponential backoff: 2s, 4s, 8s (max 3 attempts per ADR-0006 NFR-I5)
And on permanent failure after 3 attempts, the job moves to DLQ
And Sentry captures the DLQ event with tenant_id + rateLockId + error detail
```

**AC4 — Per-tenant notification preferences respected:**
```
Given a tenant that has WhatsApp notifications disabled for rate-lock-confirm event (FR24)
When the confirmation job runs
Then the AiSensy adapter is not called
And only the FCM push is dispatched
And notification_audit_log records channel: 'PUSH_ONLY' with reason: 'TENANT_PREF_WHATSAPP_DISABLED'
```

**Definition of Done:**
- [ ] BullMQ job 'notifications.rate-lock-confirmed' and 'notifications.rate-lock-expiry-reminder' implemented
- [ ] Scheduler (cron every 15 min) queries ACTIVE rate-locks with expires_at between now() and now()+24h AND reminder_sent_at IS NULL
- [ ] AiSensy adapter template registered; contract test green
- [ ] FCM adapter dispatches correctly; contract test green
- [ ] DLQ monitored via Sentry alert; runbook link in DLQ processor comment
- [ ] Integration test: rate-lock activated → assert WhatsApp job enqueued within 1s; assert reminder enqueued at T-24h

---

## Epic 10: Customer books try-at-home; shopkeeper fulfills and tracks through the booking lifecycle

**User outcome:** Feature-flag-gated per tenant (enabled per FR21 tenant config from Epic 2 Story 2.6). Customer requests try-at-home for up to N pieces (N = shopkeeper-configured), picks a date and address. Shopkeeper approves/reschedules/dispatches. State machine tracks: Requested → Confirmed → Dispatched → Returned | Purchased. Purchased terminal state triggers Epic 5 invoice flow.

**FRs covered:** FR84, FR85
**NFRs enforced:** NFR-P6 (state reflects ≤30s), NFR-S9 (state-transition audit)
**ADRs governing:** ADR-0004 (state-machine-governed conflict resolution), ADR-0006 (adapter pattern — no direct vendor SDK in service code), ADR-0007 (TanStack Query polling)
**Modules touched:** `apps/api/src/modules/try-at-home/` (aggregate + state-machine.ts + service + controller), `apps/customer/`, `apps/shopkeeper/`
**UX-DRs:** UX-DR5 (TryAtHomeBookingCard), UX-DR14 (try-at-home entry from product detail)
**Phase:** Phase 1 — Sprint 7-8
**Dependencies:** Epic 2 (FR21 feature-flag config), Epic 5 (invoice on purchase), Epic 6 (customer record), Epic 7 (customer app entry)

---

### Story 10.1: Customer sees try-at-home option only when the tenant has the feature enabled

**As a** customer browsing a product,
**I want to** see a "घर पर try करें" option only when the jeweller has enabled try-at-home,
**so that** I'm never shown a feature that isn't available at my jeweller.

**FR:** FR84 (booking entry), FR21 (feature-flag gate), FR3 (tenant feature flags)
**Modules:** `packages/tenant-config/` (useFeature hook), `apps/customer/src/screens/ProductDetail`, `apps/api/src/modules/try-at-home/`
**ADRs:** ADR-0008 (white-label feature visibility per tenant)

**Acceptance Criteria:**

**AC1 — Feature-flag gate on customer app:**
```
Given a tenant where try_at_home_enabled = false in shop_settings (set via Epic 2 Story 2.6)
When a customer opens any product detail screen
Then the "घर पर try करें" button is NOT rendered (not hidden with display:none — not rendered at all)
And no try-at-home related API calls are made
```

**AC2 — Feature visible when enabled:**
```
Given a tenant where try_at_home_enabled = true and try_at_home_max_pieces = 3
When a customer opens a product detail screen for an in-stock item
Then the "घर पर try करें" button is rendered below the main CTA
And tapping it initiates the booking flow (Story 10.2)
```

**AC3 — Server-side gate:**
```
Given a tenant with try_at_home_enabled = false
When a POST /api/v1/try-at-home request arrives (e.g., from a modified client)
Then the server checks useFeature(shopId, 'try_at_home') via packages/tenant-config
And returns 403 with body { error: 'feature.try_at_home_disabled' }
And the attempt is logged to audit_events
```

**AC4 — Feature toggle propagates within 30 seconds:**
```
Given a shopkeeper enables try-at-home via Settings (Epic 2)
When 30 seconds elapse
Then TanStack Query refetchInterval on the customer app's feature-flag poll detects the change
And the "घर पर try करें" button appears on product detail screens without app restart
```

**Definition of Done:**
- [ ] `useFeature(shopId, 'try_at_home')` from `packages/tenant-config` consumed in both customer app + API guard
- [ ] Product detail screen conditionally renders button (no dead render, no CSS hide)
- [ ] Server guard middleware on all try-at-home endpoints
- [ ] Semgrep rule enforces no hardcoded feature checks (must use useFeature hook)
- [ ] Integration test: feature OFF → button absent + API 403; feature ON → button present + API 200

---

### Story 10.2: Customer submits a try-at-home booking request

**As a** customer with try-at-home enabled at my jeweller,
**I want to** select up to N pieces, choose a preferred date and my address, and submit a booking request,
**so that** the shopkeeper can confirm and arrange home delivery for me to try.

**FR:** FR84 (full booking submission)
**Modules:** `apps/api/src/modules/try-at-home/` (aggregate create, state-machine init at REQUESTED), `apps/customer/src/screens/TryAtHomeBooking`, `apps/shopkeeper/src/screens/TryAtHomeBookings`
**ADRs:** ADR-0004 (state-machine: REQUESTED is initial state), ADR-0007 (polling — shopkeeper app sees booking within 30s)

**Acceptance Criteria:**

**AC1 — Piece selection with N-piece cap:**
```
Given a tenant with try_at_home_max_pieces = 3
When a customer initiates a try-at-home booking
Then the booking UI shows their wishlist + browsed items as selectable
And the UI disables further selection after 3 pieces are selected
And the count shows: "3 में से 3 items चुने गए — limit reached"
And the Submit button is enabled once ≥ 1 piece is selected
```

**AC2 — Date and address collection:**
```
Given the customer has selected 2 pieces
When they proceed to the date + address step
Then a date picker shows available dates (today + 7 calendar days forward)
And an address field pre-fills from the customer's profile address (if saved)
And the customer can edit the address inline
And the form validates: date is not in the past; address is ≥ 20 characters
```

**AC3 — Booking submitted and state machine initialized:**
```
Given the customer submits the booking with 2 pieces, date, and address
When POST /api/v1/try-at-home is called with { productIds, preferredDate, address, idempotencyKey }
Then the server creates a try_at_home_bookings row with status='REQUESTED'
And state-machine.ts records initial state REQUESTED with entry audit event
And the server returns 201 with bookingId
And audit_events records: { action: 'TRY_AT_HOME_REQUESTED', subjectId: bookingId, metadata: { productIds, preferredDate, address } }
```

**AC4 — Customer sees booking confirmation:**
```
Given the booking is created
When the customer returns to their profile → "Try at Home" section
Then TryAtHomeBookingCard shows:
  - Product thumbnails (up to N)
  - Status badge: "Request भेजा गया" (REQUESTED state)
  - Preferred date: "पसंदीदा तारीख: [date]"
  - "Shopkeeper confirm करेगा जल्द ही"
```

**AC5 — Shopkeeper app shows new booking within 30 seconds:**
```
Given the customer submitted a booking
When 30 seconds elapse
Then TanStack Query refetchInterval on the shopkeeper's try-at-home bookings list fires
And the new booking appears in the "नई Requests" section
And a push notification fires to the shopkeeper: "नई Try-at-Home request — [Customer name], [date]" (Epic 13 consumer)
```

**AC6 — Optimistic update on customer app:**
```
Given the customer taps Submit
When the API call is in-flight
Then TanStack Query onMutate adds the booking to the profile list with status REQUESTED optimistically
And if the API returns an error, onError removes the optimistic entry and shows: "Booking नहीं हो सकी। फिर कोशिश करें।"
```

**Definition of Done:**
- [ ] `try-at-home/state-machine.ts` defines states: REQUESTED | CONFIRMED | DISPATCHED | RETURNED | PURCHASED; REQUESTED is initial; no guard needed for creation
- [ ] `try-at-home/aggregate.ts` validates max-pieces against shop setting before insert
- [ ] TryAtHomeBookingCard in packages/ui-mobile; Storybook story
- [ ] Optimistic update + rollback on customer app
- [ ] Integration test: submit booking → assert state=REQUESTED, audit event present, shopkeeper polling detects within 30s simulation

---

### Story 10.3: Shopkeeper approves, reschedules, or dispatches a try-at-home booking

**As a** shopkeeper,
**I want to** confirm a try-at-home booking (with or without date change), mark pieces as dispatched, and have the customer notified at each step,
**so that** the booking progresses smoothly through the lifecycle and both parties have clarity.

**FR:** FR85 (state machine transitions: REQUESTED → CONFIRMED, CONFIRMED → DISPATCHED)
**Modules:** `apps/api/src/modules/try-at-home/` (state-machine transitions), `apps/shopkeeper/src/screens/TryAtHomeDetail`, BullMQ notifications jobs
**ADRs:** ADR-0004 (state-machine-governed; CONFIRMED can only follow REQUESTED; DISPATCHED can only follow CONFIRMED)

**Acceptance Criteria:**

**AC1 — Shopkeeper confirms a booking:**
```
Given a try-at-home booking in REQUESTED state visible to the shopkeeper
When the shopkeeper taps "Confirm करें"
Then POST /api/v1/try-at-home/:id/confirm is called with { confirmedDate, staffNotes? }
And state-machine transitions: REQUESTED → CONFIRMED (guard: only from REQUESTED)
And audit_events records: { action: 'TRY_AT_HOME_CONFIRMED', metadata: { confirmedDate, staffNotes } }
And BullMQ job 'notifications.try-at-home-confirmed' enqueued
And customer receives WhatsApp: "आपकी Try-at-Home booking confirm हो गई! तारीख: [confirmedDate]. [Shop Name] आपसे [time] पर आएगा।"
And customer's TryAtHomeBookingCard updates to status "Confirmed" within 30 seconds
```

**AC2 — Shopkeeper reschedules during confirmation:**
```
Given a try-at-home booking in REQUESTED state with preferredDate = Saturday
When the shopkeeper confirms but changes the date to Sunday
Then the confirmedDate differs from preferredDate
And audit_events records both original preferredDate and new confirmedDate in metadata
And WhatsApp message includes the new confirmed date (not the preferred date)
```

**AC3 — Shopkeeper dispatches pieces:**
```
Given a try-at-home booking in CONFIRMED state
When the shopkeeper taps "Dispatch करें" after physically packaging the pieces
Then POST /api/v1/try-at-home/:id/dispatch is called
And state-machine transitions: CONFIRMED → DISPATCHED
And product statuses for included productIds are updated to 'on-approval' (FR28 status from Epic 3)
And audit_events records: { action: 'TRY_AT_HOME_DISPATCHED', metadata: { productIds, dispatchedAt } }
And customer push notification: "आपके pieces रवाना हो गए! जल्द पहुंचेंगे।"
```

**AC4 — Invalid transition guard:**
```
Given a try-at-home booking in REQUESTED state
When the shopkeeper API attempts DISPATCHED transition directly (bypassing CONFIRMED)
Then state-machine.ts throws InvalidTransitionError
And the API returns 422 with { error: 'try_at_home.invalid_transition', from: 'REQUESTED', attempted: 'DISPATCHED' }
```

**AC5 — Shopkeeper can reject a booking:**
```
Given a try-at-home booking in REQUESTED state
When the shopkeeper taps "Reject करें" with a reason
Then a CANCELLED terminal state is entered (state-machine allows REQUESTED → CANCELLED)
And audit_events records rejection reason
And customer WhatsApp: "क्षमा करें, इस बार try-at-home नहीं हो सकेगा। कारण: [reason]. Shop में आकर देख सकते हैं।"
```

**Definition of Done:**
- [ ] confirm, dispatch, reject endpoints implemented with role guard (OWNER | MANAGER | STAFF can confirm/dispatch; OWNER | MANAGER can reject)
- [ ] Product status updated to 'on-approval' atomically with DISPATCHED transition
- [ ] All state transitions append to audit_events
- [ ] BullMQ notification jobs enqueued on each transition
- [ ] Integration test: full REQUESTED → CONFIRMED → DISPATCHED path; assert product status, audit events, notification jobs

---

### Story 10.4: Shopkeeper records the outcome — returned or purchased — and triggers invoice on purchase

**As a** shopkeeper,
**I want to** record whether the customer returned the pieces or purchased some/all of them,
**so that** inventory is updated, and a purchase triggers the billing flow to generate an invoice.

**FR:** FR85 (RETURNED + PURCHASED terminal states), FR84 (full lifecycle)
**Modules:** `apps/api/src/modules/try-at-home/` (terminal state transitions), `apps/api/src/modules/billing/` (invoice creation on purchase), `apps/api/src/modules/inventory/` (product status restore)
**ADRs:** ADR-0011 (compliance gates on purchase invoice), ADR-0004 (terminal states — no further transitions)

**Acceptance Criteria:**

**AC1 — All pieces returned:**
```
Given a try-at-home booking in DISPATCHED state where the customer returned all pieces
When the shopkeeper taps "Wapas aa gayi" and selects all pieces as returned
Then POST /api/v1/try-at-home/:id/return is called with { returnedProductIds: [all] }
And state-machine transitions: DISPATCHED → RETURNED
And all product statuses revert from 'on-approval' to 'in-stock'
And audit_events records: { action: 'TRY_AT_HOME_RETURNED', metadata: { returnedProductIds } }
And customer push: "हम आपसे मिले! अगली बार आपके मनपसंद pieces जरूर मिलेंगे।"
```

**AC2 — Partial return + purchase:**
```
Given a try-at-home with 3 pieces dispatched; customer purchases 1 and returns 2
When the shopkeeper taps "Purchase recorded" and selects piece 1 as purchased, pieces 2+3 as returned
Then POST /api/v1/try-at-home/:id/purchase is called with { purchasedProductIds: [p1], returnedProductIds: [p2, p3] }
And state-machine transitions: DISPATCHED → PURCHASED
And returned products revert to 'in-stock'
And purchased product transitions to 'sold'
And audit_events records both purchased and returned product IDs
```

**AC3 — Invoice creation on purchase:**
```
Given the PURCHASED transition fires
When the billing service is called with { customerId, shopId, lineItems: purchasedProductIds }
Then billing creates a draft invoice using Epic 5 invoice creation flow
And the invoice is pre-populated with product details, live rate (not a rate-lock — try-at-home uses current rate)
And if any product has an active rate-lock for this customer, it is applied (Story 9.3 logic)
And the shopkeeper sees the draft invoice to complete payment
And compliance gates (PAN, 269ST, PMLA) run on invoice completion per Epic 5
```

**AC4 — PURCHASED is terminal; no further transitions:**
```
Given a try-at-home in PURCHASED state
When any endpoint attempts a further transition
Then state-machine returns InvalidTransitionError for all events
And the API returns 422
```

**AC5 — RETURNED is terminal; products restored:**
```
Given a try-at-home in RETURNED state
When the shopkeeper views inventory
Then all returned products show status 'in-stock' (not 'on-approval')
And the try-at-home booking shows in history as "Returned" for future reference
```

**Definition of Done:**
- [ ] return and purchase endpoints implemented; terminal state guards enforced
- [ ] Product status transitions are atomic with state-machine transition (single DB transaction)
- [ ] Invoice creation triggered via billing service on PURCHASED transition
- [ ] Integration test: DISPATCHED → PURCHASED with 1 purchased / 2 returned → asserts product statuses, invoice created, audit events
- [ ] Integration test: DISPATCHED → RETURNED → assert all products in-stock; no invoice created

---

## Epic 11: Customer places a custom bridal order and follows progress with photos at 3 stages

**User outcome:** The bridal narrative journey. Customer submits design inspiration via app OR shopkeeper creates in shop → Shopkeeper quotes → Customer approves + pays deposit → 7-stage tracking (Quoted → Approved → Metal Cast → Stones Set → QC → Ready → Delivered) → progress photos at Metal Cast, Stones Set, QC auto-shared via WhatsApp → customer modification request + shopkeeper approve/reject → final invoice with deposit pull-through and 3-year immutability.

**FRs covered:** FR73, FR74, FR75, FR76, FR77, FR78, FR79
**NFRs enforced:** NFR-S9 (state-transition audit), NFR-C5 (3y retention post-completion), NFR-I3 (Razorpay webhook idempotency for deposit)
**ADRs governing:** ADR-0004 (state-machine-governed for custom orders), ADR-0006 (Razorpay adapter, AiSensy adapter, ImageKit adapter), ADR-0011 (PAN gate if final invoice ≥ Rs 2L)
**Modules touched:** `apps/api/src/modules/custom-order/` (aggregate + state-machine.ts + service + controller + photo-upload), `packages/integrations/payments/`, `packages/integrations/storage/` (S3 + ImageKit), `packages/integrations/whatsapp/`, `apps/customer/`, `apps/shopkeeper/`
**UX-DRs:** UX-DR5 (CustomOrderStageTracker, CustomerOrderTimelineView), UX-DR15 (custom order lifecycle flow)
**Phase:** Phase 1 — Sprint 7-8
**Dependencies:** Epic 5 (billing + compliance gates), Epic 6 (customer CRM), Epic 7 (customer app entry + photo viewing)

---

### Story 11.1: Customer submits design inspiration OR shopkeeper creates a custom order in the shop

**As a** customer wanting a custom bridal piece,
**I want to** submit design inspiration photos and requirements through the app,
**OR as a** shopkeeper,
**I want to** create a custom order on behalf of a walk-in customer,
**so that** the order is captured in the system and the quoting process can begin.

**FR:** FR73
**Modules:** `apps/api/src/modules/custom-order/` (aggregate create, state-machine init at QUOTED), `packages/integrations/storage/` (S3 pre-signed upload URL + ImageKit), `apps/customer/src/screens/CustomOrderRequest`, `apps/shopkeeper/src/screens/CustomOrderCreate`
**ADRs:** ADR-0004 (QUOTED is initial state), ADR-0006 (ImageKit adapter for design sketch photos)

**Acceptance Criteria:**

**AC1 — Customer-initiated: design inspiration upload:**
```
Given a logged-in customer on the "Custom Order" section of the customer app
When they tap "Design भेजें"
Then they can upload 1-5 design inspiration photos (JPEG/PNG/HEIC, max 10MB each)
And the app calls GET /api/v1/custom-orders/upload-url to receive pre-signed S3 URLs
And the client uploads directly to S3 with EXIF stripping (privacy — location metadata removed)
And after upload, the customer fills: description (required), metal preference, purity preference, budget range (optional)
And submits via POST /api/v1/custom-orders with { description, metalPref, purityPref, budgetPaise?, photoS3Keys[] }
```

**AC2 — Shopkeeper-initiated: in-shop custom order creation:**
```
Given a shopkeeper on the shopkeeper app
When they navigate to Custom Orders → "नया order बनाएं"
Then they can link an existing customer (search by phone/name per FR62)
And enter: description, metal, purity, estimated weight (DECIMAL(12,4) — NOT float), stone details, target delivery date, design sketch photos (optional)
And submit via the same POST /api/v1/custom-orders endpoint with { customerId, description, ... }
```

**AC3 — Custom order aggregate created in QUOTED state:**
```
Given either initiation path above
When the POST request is processed
Then a custom_orders row is created with status='QUOTED' (initial state per state-machine.ts)
And the order has shop_id FK + RLS policy (tenant-scoped)
And design_photo_s3_keys[] are stored; ImageKit CDN URLs are pre-generated for each key
And audit_events records: { action: 'CUSTOM_ORDER_CREATED', subjectId: orderId, metadata: { initiatedBy: 'CUSTOMER' | 'SHOPKEEPER', photoCount } }
And the order ID is returned to the initiator
```

**AC4 — Weight stored as DECIMAL, never FLOAT:**
```
Given a shopkeeper enters estimated weight 12.750 grams
When the record is stored
Then the DB column type is DECIMAL(12,4)
And the value is stored as 12.7500
And Semgrep rule 'goldsmith/no-float-weight' passes on all custom-order schema definitions
```

**AC5 — Tenant isolation:**
```
Given two tenants each with a custom order
When tenant B's API context queries custom orders
Then RLS + tenant interceptor ensure only tenant B's orders are returned
And tenant-isolation test suite asserts zero cross-tenant read on custom-order endpoints
```

**Definition of Done:**
- [ ] `custom-order/state-machine.ts` defines 7 states: QUOTED | APPROVED | METAL_CAST | STONES_SET | QC | READY | DELIVERED; plus CANCELLED; QUOTED is initial
- [ ] `custom-order/aggregate.ts` encapsulates all domain logic; weight stored as DECIMAL
- [ ] S3 pre-signed upload URL endpoint with EXIF-stripping enforced (sharp or similar on upload lambda)
- [ ] ImageKit CDN URLs stored alongside S3 keys
- [ ] Semgrep clean on no-float-weight rule
- [ ] Unit test: invalid weight type (float) rejected at Zod schema layer

---

### Story 11.2: Shopkeeper quotes weight, purity, stones, deposit, and delivery date; customer reviews in app

**As a** shopkeeper,
**I want to** provide a formal quote (weight, purity, stones, deposit %, estimated delivery date) for a custom order,
**so that** the customer can review the full price breakdown and decide to approve or negotiate.

**FR:** FR73 (quote completion), FR74 (first QUOTED → ready-for-approval transition)
**Modules:** `apps/api/src/modules/custom-order/` (quote-update endpoint), `packages/compliance/` (GST pre-calculation for quote), `apps/customer/src/screens/CustomOrderDetail`
**ADRs:** ADR-0011 (GST split calculation from packages/compliance even at quote stage)

**Acceptance Criteria:**

**AC1 — Shopkeeper fills quote details:**
```
Given a custom order in QUOTED state visible to the shopkeeper
When the shopkeeper opens it and fills the quote form:
  - Estimated net weight: 15.250g (DECIMAL)
  - Purity: 22K (GOLD_22K)
  - Stone details: 2× Diamonds, 0.5ct each
  - Making charges: 12% (pre-filled from shop default; editable per order)
  - Deposit required: 30% of estimated total
  - Estimated delivery: [date picker, min 7 days from today]
Then the form shows a live price preview: metal value + making + stones + GST (3% metal, 5% making) per packages/compliance applyGstSplit
And the deposit amount auto-calculates: 30% of total
```

**AC2 — Quote saved; customer notified:**
```
Given the shopkeeper submits the quote via PATCH /api/v1/custom-orders/:id/quote
When the server processes the request
Then the custom_orders record is updated with quoted_weight_grams, quoted_purity, stone_details, making_charge_pct, deposit_paise, delivery_date
And status remains QUOTED (no state transition yet; transition happens on customer approval in Story 11.3)
And audit_events records: { action: 'CUSTOM_ORDER_QUOTED', metadata: { quotedWeightGrams, quotedPurityKey, totalEstimatePaise, depositPaise } }
And BullMQ job 'notifications.custom-order-quoted' enqueued
And customer WhatsApp: "आपके custom order का quote आ गया! अनुमानित कीमत: ₹[total]. Deposit: ₹[deposit]. App में देखें और approve करें।"
And customer push notification sent simultaneously
```

**AC3 — Customer sees quote in app:**
```
Given the quote is saved
When the customer opens their custom order detail screen
Then they see:
  - Estimated weight: 15.25g | Purity: 22K
  - Price breakdown (PriceBreakdownCard component per UX-DR4):
    - Metal value: (weight × rate) = ₹[amount]
    - Making charges: 12% = ₹[amount]
    - Stone value: ₹[amount]
    - GST (3% metal + 5% making): ₹[amount]
    - Total estimate: ₹[total]
  - Deposit required: ₹[deposit] (30%)
  - Estimated delivery: [date]
  - Two CTAs: "Approve करें" | "सवाल पूछें (WhatsApp)"
```

**AC4 — Quote revision:**
```
Given a shopkeeper revises the quote before customer approval
When PATCH /api/v1/custom-orders/:id/quote is called again
Then the previous quote values are overwritten
And audit_events records both old and new values in before/after JSON
And customer receives notification of revision: "आपके custom order का quote update हुआ है। नई कीमत: ₹[total]."
```

**Definition of Done:**
- [ ] PATCH /api/v1/custom-orders/:id/quote implemented; validates that status = QUOTED
- [ ] packages/compliance applyGstSplit used for quote price preview (not inline math)
- [ ] Customer-facing quote detail screen shows PriceBreakdownCard
- [ ] Audit records before/after on quote revision
- [ ] Integration test: shopkeeper quotes → customer notification enqueued → customer screen shows breakdown

---

### Story 11.3: Customer approves the quote and pays deposit; custom order advances to Metal Cast

**As a** customer,
**I want to** approve my custom order quote and pay the deposit via Razorpay,
**so that** the shopkeeper can begin crafting my piece and the order officially starts.

**FR:** FR74 (QUOTED → APPROVED → METAL_CAST transitions), FR73 (deposit capture)
**Modules:** `apps/api/src/modules/custom-order/` (approve endpoint + state-machine), `packages/integrations/payments/` (Razorpay deposit), `apps/customer/src/screens/CustomOrderApproval`
**ADRs:** ADR-0006 (Razorpay webhook idempotency), ADR-0004 (state-machine: QUOTED → APPROVED requires customer action; APPROVED → METAL_CAST requires payment.captured)

**Acceptance Criteria:**

**AC1 — Customer approval action:**
```
Given a customer viewing their custom order quote
When they tap "Approve करें"
Then the app shows an approval confirmation sheet with the full quote summary
And a "Deposit ₹[amount] pay करें" primary CTA
And on confirm, POST /api/v1/custom-orders/:id/approve is called
And server transitions: QUOTED → APPROVED (guard: only from QUOTED; requires customer auth on the order)
And a Razorpay order is initiated for deposit_paise
And audit_events: { action: 'CUSTOM_ORDER_APPROVED', subjectId: orderId, metadata: { depositPaise, approvedByCustomerId } }
```

**AC2 — Deposit payment and METAL_CAST transition:**
```
Given the customer completes Razorpay deposit payment
When Razorpay fires payment.captured webhook
Then controller verifies signature + deduplicates on event ID (ADR-0006)
And enqueues BullMQ 'custom-order.deposit-paid' job
And worker transitions: APPROVED → METAL_CAST (guard: only from APPROVED + paymentId not null)
And deposit_payment_id stored on custom_orders record
And audit_events: { action: 'CUSTOM_ORDER_DEPOSIT_PAID', metadata: { paymentId, depositPaise } }
And 'custom-order.stage-advanced' BullMQ job enqueued for notifications
```

**AC3 — Approval ceremony fires on METAL_CAST entry (UX-DR15):**
```
Given the customer's app polls for order status (30s interval)
When status changes from APPROVED to METAL_CAST
Then the customer app triggers the approval ceremony UX:
  - Full-screen moment: anchor jeweller logo + order summary
  - Hindi text: "आपका order शुरू हो गया! ₹[deposit] जमा हो गई है।"
  - "Stage 1: धातु ढलाई शुरू, अगला update लगभग [X] दिनों में।"
  - Haptic medium + success toast
And shopkeeper app shows order in METAL_CAST state with customer name
And shopkeeper receives push: "Custom order शुरू — [Customer name]। Metal cast stage begin।"
```

**AC4 — Webhook idempotency for deposit:**
```
Given the Razorpay webhook fires twice (network retry)
When the second webhook arrives for the same payment.captured event
Then idempotency.check('razorpay:<event.id>') returns stored result
And no second state transition is attempted on the custom order
And the controller returns 200 without reprocessing
```

**AC5 — Compliance guard on deposit:**
```
Given the deposit amount is ≥ Rs 2,00,000 (e.g., a very high-value custom piece)
When the Razorpay order is initiated for deposit
Then packages/compliance enforcePanRequired is called for deposit transactions ≥ Rs 2L
And if PAN is not on file, the customer is prompted to enter PAN before payment proceeds
```

**Definition of Done:**
- [ ] approve endpoint + deposit Razorpay flow implemented
- [ ] QUOTED → APPROVED → METAL_CAST transitions with guards in state-machine.ts
- [ ] Approval ceremony UX implemented in customer app (haptic + full-screen moment)
- [ ] Webhook idempotency verified by integration test (duplicate webhook → single state transition)
- [ ] Semgrep clean; TypeScript strict; no FLOAT on weight/money

---

### Story 11.4: Shopkeeper uploads a progress photo at Metal Cast stage; customer receives WhatsApp and push

**As a** shopkeeper,
**I want to** upload a progress photo when the metal casting is complete,
**so that** the customer is reassured their piece is progressing and receives a beautiful update on WhatsApp.

**FR:** FR75 (progress photos + auto-WhatsApp + push)
**Modules:** `apps/api/src/modules/custom-order/` (photo-upload endpoint), `packages/integrations/storage/` (S3 pre-signed + ImageKit), `packages/integrations/whatsapp/` (AiSensy photo message), BullMQ
**ADRs:** ADR-0006 (AiSensy adapter; idempotency on BullMQ job: jobId = 'photo-whatsapp:<orderId>:<stageKey>:<photoIndex>')

**Acceptance Criteria:**

**AC1 — Photo upload flow:**
```
Given a shopkeeper on a custom order in METAL_CAST state
When they tap "Photo upload करें"
Then the shopkeeper app calls GET /api/v1/custom-orders/:id/upload-url?stage=METAL_CAST
And the server returns a pre-signed S3 URL valid for 15 minutes
And the client uploads the photo directly to S3 (tenant-prefixed path: s3://<bucket>/tenants/<shopId>/custom-orders/<orderId>/METAL_CAST/<uuid>.jpg)
And after upload, POST /api/v1/custom-orders/:id/photos with { s3Key, stageKey: 'METAL_CAST', caption?: string }
```

**AC2 — Photo stored + ImageKit URL generated:**
```
Given the photo is uploaded to S3
When the POST /api/v1/custom-orders/:id/photos endpoint processes the request
Then a custom_order_photos row is created: { orderId, stageKey: 'METAL_CAST', s3Key, imagekitUrl, uploadedAt, uploadedByUserId }
And the imagekitUrl is the ImageKit CDN-transformed URL (thumb + card + full variants pre-generated)
And audit_events: { action: 'CUSTOM_ORDER_PHOTO_UPLOADED', metadata: { stageKey, s3Key, uploadedByUserId } }
```

**AC3 — WhatsApp photo message dispatch with idempotency:**
```
Given the photo is stored
When BullMQ job 'custom-order.photo-whatsapp' is enqueued with jobId = 'photo-whatsapp:<orderId>:METAL_CAST:<photoIndex>'
Then the AiSensy adapter sends a WhatsApp image message to the customer:
  Image: the progress photo (sent as media message via WhatsApp API)
  Caption: "आपका [Custom Order #X] — धातु ढलाई complete हो गई! [Shop Name]"
And if AiSensy fails transiently, BullMQ retries with exponential backoff (max 3)
And on permanent failure, DLQ captures the job + Sentry alert fires
And if the job runs twice (BullMQ at-least-once), the idempotency check on jobId prevents double dispatch
```

**AC4 — Push notification alongside WhatsApp:**
```
Given the WhatsApp job processes
When the notification batch runs
Then FCM push is dispatched simultaneously: "Custom order update — Metal Cast complete! देखें।"
And notification_audit_log records both channels, deliveryStatus, templateId
```

**AC5 — Customer sees photo in app:**
```
Given the photo is uploaded and stored
When the customer opens their CustomOrderTimelineView (polling 30s)
Then the METAL_CAST stage row in the timeline shows:
  - Stage badge: "Stage 1: धातु ढलाई" (METAL_CAST) — completed color (terracotta)
  - Photo thumbnail tappable → full-screen ImageKit CDN image
  - Upload timestamp: "3 घंटे पहले"
And no Goldsmith brand is visible anywhere — only the anchor jeweller's brand (white-label)
```

**Definition of Done:**
- [ ] Photo upload endpoint: pre-signed URL generation + POST photo metadata
- [ ] ImageKit adapter generates multi-size URLs on upload (via ImageKit upload API, not on-the-fly transforms only)
- [ ] BullMQ job with idempotency jobId prevents double WhatsApp dispatch
- [ ] Customer timeline view renders uploaded photos per stage
- [ ] Integration test: upload photo → assert custom_order_photos row, BullMQ job enqueued, imagekitUrl present

---

### Story 11.5: State machine advances through Metal Cast → Stones Set → QC → Ready with photo side-effects at each stage

**As a** shopkeeper,
**I want to** advance the custom order through each production stage with a single tap (and optional photo upload),
**so that** the customer is kept informed and every transition is audit-logged.

**FR:** FR74 (middle transitions), FR75 (photo at each stage)
**Modules:** `apps/api/src/modules/custom-order/` (advance-stage endpoint, state-machine transitions), BullMQ notification jobs
**ADRs:** ADR-0004 (state-machine: each transition has a guard — previous state must be correct; transitions are METAL_CAST → STONES_SET → QC → READY)

**Acceptance Criteria:**

**AC1 — Stage advance endpoint:**
```
Given a custom order in METAL_CAST state
When the shopkeeper taps "अगले stage पर जाएं" and POST /api/v1/custom-orders/:id/advance-stage is called with { toState: 'STONES_SET', idempotencyKey: <uuid> }
Then state-machine.ts validates the transition: METAL_CAST → STONES_SET is valid
And transitions the state atomically
And audit_events records: { action: 'CUSTOM_ORDER_STAGE_ADVANCED', metadata: { fromState: 'METAL_CAST', toState: 'STONES_SET', advancedByUserId, advancedAt } }
And BullMQ 'custom-order.stage-notification' job enqueued with { orderId, fromState, toState }
```

**AC2 — Guarded transitions — invalid paths rejected:**
```
Given a custom order in METAL_CAST state
When the advance-stage endpoint is called with { toState: 'QC' } (skipping STONES_SET)
Then state-machine.ts throws InvalidTransitionError
And the API returns 422: { error: 'custom_order.invalid_transition', from: 'METAL_CAST', attempted: 'QC', validNext: ['STONES_SET'] }
And no audit event is written
```

**AC3 — Photo upload encouraged but not mandatory at stage advance:**
```
Given the shopkeeper advances from METAL_CAST to STONES_SET
When they choose to upload a photo (optional)
Then the photo upload flow from Story 11.4 AC1-AC3 applies with stageKey: 'STONES_SET'
And if no photo is uploaded, the stage advance still completes
And the customer notification mentions the stage advance but not a photo: "आपका order आगे बढ़ा! पत्थर जड़ाई शुरू।"
```

**AC4 — Customer notification per stage advance:**
```
Given each of METAL_CAST → STONES_SET, STONES_SET → QC, QC → READY transitions
When the BullMQ stage-notification job processes
Then the customer receives:
  - WhatsApp (if photo uploaded): photo message per Story 11.4 AC3
  - WhatsApp (no photo): text template: "Stage [N] complete: [Hindi stage name]. अगला step: [Hindi next stage name]. Delivery date: [date]."
  - Push: "[Custom Order] — [Stage name] complete!"
And Hindi stage names mapping: METAL_CAST='धातु ढलाई', STONES_SET='पत्थर जड़ाई', QC='Quality Check', READY='तैयार है!'
```

**AC5 — READY state triggers customer "come pick up" notification:**
```
Given a custom order transitions to READY
When the BullMQ stage-notification job for READY processes
Then customer WhatsApp: "खुशखबरी! आपका [Custom Order] तैयार है। [Shop Name] में आकर ले जाएं। 🎉"
And shopkeeper push: "Custom order READY — [Customer name]. Invoice generate करने के लिए तैयार।"
And the customer's CustomOrderTimelineView shows READY badge with all 3 completed stage photos visible
```

**AC6 — Idempotency on stage advance:**
```
Given the shopkeeper taps "advance" twice quickly (double-tap or network retry) with the same idempotencyKey
When both requests arrive
Then the first processes and transitions state
And the second returns 200 with the current state (idempotent response from server idempotency store)
And no double state transition occurs
```

**Definition of Done:**
- [ ] advance-stage endpoint with state-machine guard for each valid transition
- [ ] Idempotency key required on advance-stage (rejected without one)
- [ ] BullMQ stage-notification job dispatches WhatsApp + push per stage
- [ ] Hindi stage name i18n mapping in notification templates
- [ ] Integration test: full METAL_CAST → STONES_SET → QC → READY path; assert state, audit events, notification jobs at each step
- [ ] Invalid transition test: METAL_CAST → QC → assert 422

---

### Story 11.6: Customer views stage progress, delivery estimate, and photos in the app

**As a** customer with an active custom order,
**I want to** see a visual timeline of my order's progress, including stage photos,
**so that** I can follow my piece's journey and share updates with family.

**FR:** FR76
**Modules:** `apps/customer/src/screens/CustomOrderDetail` (CustomerOrderTimelineView component), `apps/api/src/modules/custom-order/` (GET /custom-orders/:id), ImageKit CDN
**ADRs:** ADR-0007 (TanStack Query polling 30s for stage updates), ADR-0008 (white-label — only anchor brand visible)

**Acceptance Criteria:**

**AC1 — Timeline view renders all 7 stages:**
```
Given a customer's custom order currently in QC stage
When they open the CustomOrderDetail screen
Then CustomerOrderTimelineView renders a vertical timeline with 7 stages:
  1. Quoted (completed — grey)
  2. Approved (completed — grey)
  3. Metal Cast (completed — terracotta with photo thumbnail if uploaded)
  4. Stones Set (completed — terracotta with photo thumbnail)
  5. QC (in-progress — animated pulse, terracotta border)
  6. Ready (upcoming — muted)
  7. Delivered (upcoming — muted)
And each completed stage shows: stage name in Hindi + completion date + photo thumbnail (if uploaded)
And the in-progress stage shows: "अभी यहाँ है" indicator
```

**AC2 — Photo full-screen view:**
```
Given a completed stage with an uploaded photo
When the customer taps the photo thumbnail
Then a full-screen image viewer opens showing the ImageKit CDN full-size image
And pinch-to-zoom is supported (React Native Image Zoom)
And a "Share करें" button allows sharing the image + order context via WhatsApp
And the share text: "मेरा [Custom Order] — [Stage name] हो गया! [Shop Name]"
```

**AC3 — Delivery estimate displayed:**
```
Given a custom order with delivery_date stored
When the customer views the detail screen
Then: "अनुमानित delivery: [date]" is shown prominently above the timeline
And if the order is in READY state: "तैयार है! Shop में आकर ले जाएं।" replaces the delivery estimate
```

**AC4 — Polling for live updates:**
```
Given the customer has the detail screen open
When the shopkeeper advances the stage in the background
Within 30 seconds
Then TanStack Query refetchInterval fires and the timeline updates to show the new stage
And if the stage photo was just uploaded, the thumbnail appears without page reload
```

**AC5 — White-label enforcement:**
```
Given the customer app is themed for the anchor jeweller
When the custom order detail screen renders
Then no "Goldsmith", "Powered by Goldsmith", or platform logo appears anywhere on the screen
And Semgrep 'goldsmith/no-platform-brand-leak' check passes on all customer app screens
```

**AC6 — Accessibility:**
```
Given the CustomerOrderTimelineView
When rendered
Then each stage has an ARIA label: "Stage [N] of 7: [stage name] — [status]"
And photos have alt text: "[Stage name] progress photo for custom order #[id]"
And the timeline is navigable by keyboard/screen reader (web version)
And axe-core reports 0 violations
```

**Definition of Done:**
- [ ] CustomerOrderTimelineView component built; Storybook story with all 7 stages in various states
- [ ] GET /api/v1/custom-orders/:id returns stages array with photo URLs (ImageKit CDN)
- [ ] TanStack Query polling at 30s
- [ ] Full-screen image viewer with pinch-to-zoom and share
- [ ] Semgrep brand-leak check passes
- [ ] Axe-core 0 violations on timeline component

---

### Story 11.7: Customer requests a modification; shopkeeper approves or rejects with notes

**As a** customer whose custom order is in progress,
**I want to** request a modification (e.g., change stone size or add engraving),
**so that** I can adjust my order before it's too late, with the shopkeeper's decision recorded.

**FR:** FR77
**Modules:** `apps/api/src/modules/custom-order/` (modification-request sub-aggregate), `apps/customer/src/screens/ModificationRequest`, `apps/shopkeeper/src/screens/ModificationReview`
**ADRs:** ADR-0004 (state can roll back: e.g., STONES_SET → METAL_CAST on accepted rework; logged as override transition)

**Acceptance Criteria:**

**AC1 — Customer submits modification request:**
```
Given a customer with a custom order in any pre-DELIVERED state
When they tap "बदलाव request करें" on the detail screen
Then a modification request form appears with:
  - Description field: "क्या बदलना है?" (required, min 20 chars)
  - Photo upload (optional: 1-3 reference photos)
And POST /api/v1/custom-orders/:id/modification-requests creates a modification_requests record with status='PENDING'
And shopkeeper receives push notification: "Custom order modification request — [Customer name]. App में देखें।"
```

**AC2 — Shopkeeper reviews and rejects:**
```
Given a pending modification request visible to the shopkeeper
When the shopkeeper taps "Reject करें" with a reason
Then PATCH /api/v1/custom-orders/:id/modification-requests/:mrId with { decision: 'REJECTED', rejectionNote: string }
And modification_request.status → REJECTED
And audit_events records: { action: 'MODIFICATION_REQUEST_REJECTED', metadata: { rejectionNote, reviewedByUserId } }
And customer WhatsApp: "आपकी modification request स्वीकार नहीं हो सकी। कारण: [note]. कोई सवाल? WhatsApp करें।"
And custom order state remains unchanged
```

**AC3 — Shopkeeper accepts modification (no stage rollback needed):**
```
Given a modification request that does not require rework (e.g., add engraving — possible at current stage)
When the shopkeeper accepts with note "Engraving added — no stage change needed"
Then modification_request.status → ACCEPTED
And audit_events records acceptance
And custom order state remains at current stage
And customer WhatsApp: "आपकी modification request मंजूर हो गई! [Note]. Delivery date: [date]."
```

**AC4 — Shopkeeper accepts modification requiring stage rollback:**
```
Given a modification request requiring rework (e.g., customer wants different stones — order is in STONES_SET)
When the shopkeeper accepts and selects "Roll back to Metal Cast for rework"
Then PATCH includes { decision: 'ACCEPTED', rollbackToState: 'METAL_CAST' }
And state-machine executes STONES_SET → METAL_CAST transition (override transition — only available via modification-accept path)
And audit_events records: { action: 'CUSTOM_ORDER_STAGE_ROLLBACK', metadata: { fromState: 'STONES_SET', toState: 'METAL_CAST', reason: 'modification_accepted', modificationRequestId } }
And customer WhatsApp: "आपका change मंजूर हो गया! धातु ढलाई से फिर शुरू होगा। नई delivery date: [revised date]."
```

**AC5 — Modification request log visible on timeline:**
```
Given a custom order with modification requests (accepted or rejected)
When the customer or shopkeeper views the order
Then the timeline shows modification events as annotated markers between stage nodes
And each marker shows: "Modification requested", "Modification accepted/rejected", with timestamp and notes
```

**Definition of Done:**
- [ ] modification_requests table with orderId FK, status, description, photo_s3_keys[], decision, rejection_note, reviewed_by, timestamps
- [ ] Rollback transition guarded — only accessible via modification-accept API, not direct advance-stage
- [ ] Rollback appended to audit_events as a distinct action type
- [ ] Integration test: STONES_SET state → modification request → rollback to METAL_CAST → assert state + audit event
- [ ] Integration test: rejection → assert state unchanged + customer notification enqueued

---

### Story 11.8: Shopkeeper converts the completed custom order to a final invoice with deposit pull-through

**As a** shopkeeper,
**I want to** generate the final invoice for a completed custom order with the deposit pre-applied,
**so that** the customer pays only the outstanding balance and all financial records are complete and immutable.

**FR:** FR78 (final invoice + deposit pull-through), FR74 (READY → DELIVERED), FR79 (3-year immutability post-completion)
**Modules:** `apps/api/src/modules/custom-order/` (complete-order endpoint, READY → DELIVERED), `apps/api/src/modules/billing/` (invoice creation with deposit line), `packages/compliance/` (PAN Rule 114B if final total ≥ Rs 2L), `packages/compliance/` (Section 269ST on cash balance payment)
**ADRs:** ADR-0011 (compliance gates), ADR-0004 (READY → DELIVERED terminal, data immutable post-completion)

**Acceptance Criteria:**

**AC1 — Final invoice pre-populated with actual values:**
```
Given a custom order in READY state with: actual_weight=15.5g, purity=22K, making_pct=12%, deposit_paid=₹45,000
When the shopkeeper taps "Final invoice generate करें"
Then the billing service creates a draft invoice with:
  - Line item: Custom Order #[id] — 15.5g 22K Gold
  - Metal value: (15.5 × current_22K_rate_paise) in paise, DECIMAL-accurate
  - Making charges: 12% of metal value
  - Stone value (if any)
  - GST: packages/compliance applyGstSplit({ metalPaise, makingPaise })
  - Sub-total: [sum]
  - Deposit adjustment: -₹45,000 (pre-applied as a line item)
  - Balance payable: [sub-total - deposit]
```

**AC2 — Compliance gates on final invoice:**
```
Given the final invoice total (before deposit deduction) is ≥ Rs 2,00,000
When the shopkeeper attempts to complete the invoice
Then packages/compliance enforcePanRequired({ total, pan, form60 }) is called
And if PAN is not on file for the customer, ComplianceBlockModal fires: "₹2 लाख से ज़्यादा के custom order के लिए PAN जरूरी है"
And separately, if the balance payable is paid by cash, enforce269ST is called for the cash portion
```

**AC3 — READY → DELIVERED on invoice completion:**
```
Given the shopkeeper completes payment collection and the invoice status → COMPLETED
When the billing service calls custom-order service completeOrder({ orderId, invoiceId })
Then state-machine transitions: READY → DELIVERED (guard: only from READY; invoiceId must be present)
And audit_events: { action: 'CUSTOM_ORDER_DELIVERED', metadata: { invoiceId, finalWeightGrams, finalTotalPaise, depositPullThroughPaise } }
And customer WhatsApp: "🎉 आपका [Custom Order] deliver हो गया! Invoice #[id] तैयार है। [Shop Name] की ओर से बधाई!"
And customer push: "Custom Order Delivered — Invoice ready"
```

**AC4 — Custom order data becomes immutable post-DELIVERED:**
```
Given a custom order in DELIVERED state
When any PATCH or state-advance attempt is made on the order record
Then the API returns 403: { error: 'custom_order.immutable_after_delivery' }
And a DB-level constraint (or application-level check) prevents writes to the custom_orders row
And the record's immutable_from timestamp is set to now() on DELIVERED transition
And the 3-year retention is enforced: custom_orders records with DELIVERED status are excluded from DPDPA deletion workflows (NFR-C5 exemption for legally-required records)
```

**AC5 — Deposit reconciliation in accounting:**
```
Given the deposit was paid via Razorpay (tracked on custom_orders.deposit_payment_id)
When the final invoice is generated
Then the deposit is represented as a line item "Advance deposit (Razorpay #[paymentId]): -₹[amount]"
And the invoice's payment_method_breakdown correctly shows: deposit_paise pre-paid + balance collected today
And GSTR-1 export includes the invoice with correct GST amounts
```

**Definition of Done:**
- [ ] completeOrder endpoint: validates READY state, creates invoice, triggers READY → DELIVERED in same transaction
- [ ] Deposit pull-through as negative line item on invoice
- [ ] Compliance gates (PAN + 269ST) called before invoice completion
- [ ] Immutability enforced: DELIVERED orders cannot be patched (application + DB CHECK or trigger)
- [ ] 3-year retention annotation on the table (retention policy documentation + audit)
- [ ] Integration test: full custom order lifecycle → DELIVERED → attempt edit → assert 403
- [ ] Integration test: final total ≥ Rs 2L → assert PAN gate fires before invoice completion

---

## Epic 12: Customer opts into seeing recognition; when they walk into the shop, staff know their wishlist and recent views

**User outcome (Innovation #1):** Customer opts into viewing-tracking at signup (DPDPA-compliant default-on with one-tap opt-out). Logged-in product views and anonymous session views are tracked. Shopkeeper sees per-product analytics (hot/cold items). Shopkeeper sees per-customer browsing history in CRM. When a customer walks in (beacon / loyalty QR scan / name lookup), the shopkeeper app shows a CustomerContextCard at the top of screen within 3 seconds, showing recent wishlist items and browsing — framed as "recent activity", not "tracked".

**FR sequencing (IR-report correction #5 — BINDING):**
- Story 12.1 (FR68: consent flow + retroactive anonymization) SHIPS FIRST and must merge before any other story in this epic begins.
- Stories 12.2–12.6 (FR64–67, UX-DR16 walk-in card) CANNOT start until Story 12.1 has merged to main.

**FRs covered:** FR68 (consent — SHIPS FIRST), FR64, FR65, FR66, FR67
**NFRs enforced:** NFR-C6 (DPDPA consent flow), NFR-S9 (analytics-view audit), NFR-S3 (PII handling)
**ADRs governing:** ADR-0002 (RLS on viewing_events; customer_id nullable for anonymized records), ADR-0005 (tenant context on all analytics), ADR-0011 (compliance — consent is a hard-block gate before ingestion)
**Modules touched:** `apps/api/src/modules/viewing-analytics/` (consent, event ingestion, aggregation), `apps/customer/`, `apps/shopkeeper/`
**UX-DRs:** UX-DR5 (CustomerContextCard), UX-DR16 (walk-in peripheral context flow), UX-DR27 (viewing-analytics surface with non-surveillance framing)
**Phase:** Phase 1 — Sprint 8-9
**Dependencies:** Epic 6 (customer record + consent schema foundation), Epic 7 (customer browse events as source)

---

### Story 12.1: Customer opts into viewing tracking at signup; opt-out retroactively anonymizes all past events [GATING STORY]

**GATING STORY — Stories 12.2 through 12.6 CANNOT begin until this story has merged to main branch and all ACs are verified green.**

**Rationale:** DPDPA Section 7 requires informed consent before any personal data is processed for purposes beyond the primary service. Viewing analytics (FR64–67) constitutes secondary-purpose processing. If tracking begins before consent is verifiable, the platform is in violation. This ordering is non-negotiable.

**As a** customer signing up for the jeweller's app,
**I want to** be clearly informed about viewing tracking and opt in or out with one tap,
**so that** I have control over my data and the jeweller respects my privacy choice.

**FR:** FR68, NFR-C6 (DPDPA consent), NFR-S9 (consent audit)
**Modules:** `apps/api/src/modules/viewing-analytics/` (viewing_consent table, consent service), `packages/compliance/` (DPDPA consent gate — consent check before any FR64 event ingestion), BullMQ (retroactive anonymization job), `apps/customer/src/screens/SignUp/ConsentStep`
**ADRs:** ADR-0002 (viewing_events.customer_id is nullable — anonymized records have NULL customer_id), ADR-0011 (consent is a hard-block gate in the event ingestion pipeline)

**Acceptance Criteria:**

**AC1 — Consent prompt at signup:**
```
Given a new customer completing phone OTP signup
When they reach the final signup step
Then the app shows a consent screen BEFORE the home screen is accessible:
  Title (Hindi): "आपकी पसंद, आपका control"
  Body (Hindi): "जब आप हमारे products देखते हैं, हम आपकी पसंद याद रखते हैं ताकि shop में आपको बेहतर सेवा मिले। आप कभी भी बंद कर सकते हैं।"
  Primary CTA: "हाँ, याद रखें" (opt-in, default highlighted)
  Secondary CTA: "नहीं, अभी नहीं" (opt-out)
  Link: "और जानें" → privacy notice (plain Hindi language, not legalese)
And the customer MUST make a choice — the screen cannot be dismissed without tapping one CTA
```

**AC2 — Consent recorded with full audit trail:**
```
Given the customer taps "हाँ, याद रखें" or "नहीं, अभी नहीं"
When the choice is submitted via POST /api/v1/viewing-analytics/consent with { optedIn: true|false }
Then a viewing_consent record is upserted: { shop_id, customer_id, opted_in, consented_at, consent_version: '2026-04-17' }
And audit_events records: { action: 'VIEWING_CONSENT_RECORDED', subjectId: customerId, metadata: { optedIn, consentVersion, ipAddress?, userAgent? } }
And the response is 200 before the home screen is shown
```

**AC3 — One-tap opt-out always available from profile:**
```
Given a customer who previously opted in
When they navigate to Profile → Privacy → "Viewing tracking"
Then they see: "आपने viewing tracking चालू रखा है" with a toggle switch
And toggling it OFF sends POST /api/v1/viewing-analytics/consent { optedIn: false }
And viewing_consent.opted_in is set to false
And audit_events records the opt-out event
```

**AC4 — Retroactive anonymization on opt-out:**
```
Given a customer has opted out (opted_in set to false)
When the consent service processes the opt-out
Then BullMQ job 'viewing-analytics.retroactive-anonymize' is enqueued with { customerId, shopId }
And the job runs a batch UPDATE: SET customer_id = NULL WHERE customer_id = :customerId AND shop_id = :shopId on viewing_events table
And the job runs in batches of 1000 rows to avoid lock contention
And on completion, audit_events records: { action: 'VIEWING_EVENTS_ANONYMIZED', subjectId: customerId, metadata: { rowsAnonymized: N } }
And the customer_id column on the anonymized rows becomes NULL (session_id retained for anonymous analytics per FR65)
And if the job fails transiently, BullMQ retries with exponential backoff; on permanent failure, DLQ + Sentry alert
```

**AC5 — Consent check is a hard-block gate for FR64 event ingestion (enforced in Story 12.2):**
```
Given the viewing-analytics event ingestion pipeline (to be built in Story 12.2)
When any logged-in product view event is processed
Then the pipeline MUST call consentService.isConsentGiven({ shopId, customerId }) BEFORE writing a viewing_event with customer_id
And if opted_in = false, the event is written with customer_id = NULL (anonymous) regardless of whether the customer is logged in
And this contract is asserted by an integration test that verifies: opt-out customer browsing → viewing_events have NULL customer_id
```

**AC6 — DPDPA privacy notice accessible:**
```
Given the "और जानें" link on the consent screen
When tapped
Then a modal or sheet opens showing the privacy notice in plain Hindi (≤ 300 words, no legalese)
Including: what is tracked, how it is used, how to opt out, data retention period
And the notice version matches consent_version stored on the consent record
```

**AC7 — Existing customers (pre-feature-launch) default to opted-in with notification:**
```
Given existing customers whose accounts predate Story 12.1 deployment
When the migration runs
Then viewing_consent rows are inserted with opted_in = true for all existing customers
And a WhatsApp notification is sent (AiSensy, per NFR-I4 per-tenant quota): "हमने आपकी app में एक नई privacy setting जोड़ी है। आप Profile में जाकर change कर सकते हैं।"
And the migration is idempotent (re-running does not create duplicate consent rows)
```

**Definition of Done:**
- [ ] viewing_consent table: { id, shop_id FK, customer_id FK, opted_in BOOLEAN, consented_at, consent_version, updated_at } with RLS
- [ ] POST /api/v1/viewing-analytics/consent — creates/updates consent record + audit event
- [ ] Consent screen implemented in customer app signup flow; cannot be skipped
- [ ] BullMQ retroactive-anonymize job: batch UPDATE viewing_events SET customer_id = NULL; DLQ monitored
- [ ] Privacy notice content in Hindi committed to i18n files
- [ ] Migration script for existing customers with idempotency check
- [ ] Integration test: opt-out → retroactive job runs → assert viewing_events.customer_id = NULL for that customer
- [ ] GATING GATE: Stories 12.2–12.6 blocked in sprint board until this story's PR is merged

---

### Story 12.2: System tracks logged-in product views when the customer has consented

**BLOCKED until Story 12.1 merges. This story references the consent invariant as a hard gate.**

**As a** shopkeeper,
**I want** the system to record when a logged-in, consented customer views a product,
**so that** I can understand their preferences and surface them at the right moment.

**FR:** FR64
**Modules:** `apps/api/src/modules/viewing-analytics/` (event ingestion service, viewing_events table), PostHog consumer (Mumbai self-hosted), `apps/customer/` (view event emission)
**ADRs:** ADR-0002 (viewing_events has shop_id RLS; customer_id nullable), ADR-0005 (tenant context on every analytics write)
**Consent invariant:** Ingestion pipeline reads viewing_consent.opted_in BEFORE writing customer_id. If opted_in = false, customer_id is set to NULL.

**Acceptance Criteria:**

**AC1 — Consent check is the first step in ingestion:**
```
Given a logged-in customer views a product detail screen
When the customer app emits POST /api/v1/viewing-analytics/events with { productId, durationSeconds, sessionId }
Then the server calls consentService.isConsentGiven({ shopId, customerId }) FIRST
And if opted_in = true: viewing_event written with customer_id = <customerId>, session_id = <sessionId>, product_id, shop_id, viewed_at, duration_seconds
And if opted_in = false: viewing_event written with customer_id = NULL, session_id = <sessionId> (anonymous — falls into FR65 path)
And audit_events does NOT log individual viewing events (too high volume; PostHog handles this)
```

**AC2 — Event schema and tenant isolation:**
```
Given a viewing event is written
When the viewing_events table receives the row
Then it contains: { id, shop_id (FK, NOT NULL), product_id (FK), customer_id (nullable FK), session_id, viewed_at TIMESTAMPTZ, duration_seconds INTEGER, source: 'CUSTOMER_APP' | 'CUSTOMER_WEB' }
And RLS policy rls_viewing_events_tenant_isolation ensures only shop_id-scoped queries succeed
And tenant-isolation test asserts zero cross-tenant read on viewing_events
```

**AC3 — Client-side event throttling:**
```
Given a customer rapidly scrolling through a product grid
When products flash by in < 2 seconds
Then the client does NOT emit an event for views < 2 seconds duration
And only views ≥ 2 seconds trigger the POST /api/v1/viewing-analytics/events call
And the debounce is implemented client-side (no server-side rate-limit needed for valid events)
```

**AC4 — PostHog event forwarding (Mumbai self-hosted):**
```
Given a viewing event is written to the viewing_events table
When the ingestion service completes the DB write
Then it also pushes the event to the PostHog self-hosted instance (ap-south-1 Mumbai) via the PostHog Node SDK
With properties: { shop_id, product_id, duration_seconds, has_customer_id: boolean (not the actual ID — for funnel analytics) }
And no PII (customer_id) is sent to PostHog — only anonymized aggregate properties
```

**AC5 — Optimistic UI: no waiting for server acknowledgment:**
```
Given the customer views a product
When the app emits the view event
Then the event is fire-and-forget from the customer's perspective (no UI blocking)
And network failure on the event POST is silently swallowed (no toast, no retry UI)
And failed events are not retried (low-value data loss is acceptable; BullMQ retry not used here)
```

**Definition of Done:**
- [ ] viewing_events table with RLS; customer_id nullable
- [ ] POST /api/v1/viewing-analytics/events: consent check first; write event; push to PostHog (no PII)
- [ ] Client throttle: ≥ 2s view duration before emit
- [ ] Tenant-isolation test: cross-tenant event read → 0 rows
- [ ] Integration test: opted-in customer view → viewing_events.customer_id = customerId; opted-out customer view → customer_id = NULL

---

### Story 12.3: System tracks anonymous product views by session ID

**BLOCKED until Story 12.1 merges.**

**As a** shopkeeper,
**I want** the system to track product views from anonymous (not-logged-in) visitors,
**so that** I can understand which products attract attention even before a customer signs up.

**FR:** FR65
**Modules:** `apps/api/src/modules/viewing-analytics/` (same event ingestion service; anonymous path), `apps/customer/` (session_id generation + persistence)
**Note:** No consent requirement for anonymous tracking per DPDPA — no personal data is collected; session_id is device-local and not linked to identity.

**Acceptance Criteria:**

**AC1 — Session ID generation and persistence:**
```
Given a visitor opens the customer app without logging in
When the app starts
Then a session_id UUID is generated client-side (if not already present in AsyncStorage)
And the session_id is persisted in AsyncStorage for the duration of the app install (not reset on app restart)
And the session_id is included in all viewing event requests as { sessionId: <uuid>, customerId: null }
```

**AC2 — Anonymous event recorded without consent check:**
```
Given an anonymous visitor (not logged in) views a product for ≥ 2 seconds
When POST /api/v1/viewing-analytics/events is called with { productId, durationSeconds, sessionId, customerId: null }
Then the server does NOT check viewing_consent (no consent needed for anonymous data)
And viewing_event is written: { shop_id, product_id, customer_id: NULL, session_id, viewed_at, duration_seconds }
```

**AC3 — Session-to-customer linkage on login:**
```
Given an anonymous visitor with session_id S1 viewed 3 products
When they sign up / log in
Then POST /api/v1/viewing-analytics/link-session is called with { sessionId: 'S1', customerId: 'C1' }
And the server checks viewing_consent for C1
And if opted_in = true: UPDATE viewing_events SET customer_id = 'C1' WHERE session_id = 'S1' AND customer_id IS NULL AND shop_id = <shopId>
And if opted_in = false: no update — session events remain anonymous
And the app continues to use S1 as session_id post-login (for continuity)
```

**AC4 — Privacy compliance for anonymous tracking:**
```
Given the privacy notice (Story 12.1 AC6)
When anonymous tracking is active
Then the privacy notice mentions: "बिना login के भी हम केवल आपके device की session ID से product views note करते हैं — कोई personal information नहीं।"
And no IP address, no device fingerprint beyond session_id is stored
```

**Definition of Done:**
- [ ] Session ID generated + persisted in AsyncStorage; sent on all view event requests
- [ ] Anonymous path in event ingestion: no consent check; customer_id always NULL
- [ ] link-session endpoint: consent-gated customer_id backfill
- [ ] Integration test: anonymous views → customer_id NULL; login + opted-in → backfill to customer_id; login + opted-out → remain NULL

---

### Story 12.4: Shopkeeper views per-product analytics — hot items, cold items, views, unique viewers

**BLOCKED until Story 12.1 merges.**

**As a** shopkeeper,
**I want to** see which products are getting the most views and which are being ignored,
**so that** I can make better decisions about what to promote, reprice, or retire.

**FR:** FR66
**Modules:** `apps/api/src/modules/viewing-analytics/` (aggregation service + scheduled aggregation job), `apps/shopkeeper/src/screens/Analytics/ProductAnalytics`, `packages/ui-web` (analytics dashboard — admin/shopkeeper web)
**ADRs:** ADR-0007 (TanStack Query polling — analytics not real-time; refreshes every 60s)

**Acceptance Criteria:**

**AC1 — Scheduled aggregation job:**
```
Given viewing_events accumulate throughout the day
When the BullMQ cron job 'viewing-analytics.aggregate' runs every 15 minutes
Then it computes per-product aggregates for each tenant:
  - total_views_7d, total_views_30d
  - unique_session_count_7d (COUNT DISTINCT session_id)
  - unique_customer_count_7d (COUNT DISTINCT customer_id WHERE customer_id IS NOT NULL)
  - avg_view_duration_seconds_7d
And upserts into product_analytics_aggregates table: { shop_id, product_id, computed_at, total_views_7d, unique_sessions_7d, unique_customers_7d, avg_duration_7d }
And the job uses per-tenant BullMQ partition keys to prevent noisy-neighbour
```

**AC2 — Hot/cold product dashboard:**
```
Given the shopkeeper navigates to Analytics → Product Views
When the screen loads
Then they see:
  - "Hot items" section: top 5 products by total_views_7d (sorted desc)
  - "Cold items" section: bottom 5 published products by total_views_7d (published but ≤ 2 views in 7d)
  - Each product shows: thumbnail, name, total views (7d), unique viewers (7d), average view duration
  - Time window toggle: "7 दिन" | "30 दिन"
And the data is served from product_analytics_aggregates (pre-computed; not a live query on viewing_events)
```

**AC3 — Non-surveillance framing in UI copy (UX-DR27):**
```
Given the analytics dashboard
When the shopkeeper views per-product stats
Then all copy uses interest framing:
  - "People interested" not "People tracked"
  - "Views in 7 days" not "Times spied on"
  - "Popular items" not "Most watched"
And the dashboard header reads: "Products जो customers को पसंद आ रहे हैं"
```

**AC4 — Tenant isolation on analytics:**
```
Given two tenants each with product analytics
When the shopkeeper of tenant A queries product analytics
Then GET /api/v1/viewing-analytics/products returns only tenant A's aggregates
And RLS on product_analytics_aggregates enforces shop_id isolation
```

**AC5 — Polling and staleness indicator:**
```
Given the shopkeeper has the analytics screen open
When the TanStack Query refetchInterval fires (60s)
Then the aggregates refresh (last computed: "15 मिनट पहले" shown as freshness indicator, per UX-DR27)
And the screen does not flash or fully reload — only changed values animate (numeric count-up)
```

**Definition of Done:**
- [ ] product_analytics_aggregates table with RLS
- [ ] BullMQ cron aggregation job with per-tenant partition keys
- [ ] GET /api/v1/viewing-analytics/products endpoint serving pre-aggregated data
- [ ] Product analytics screen in shopkeeper app with hot/cold sections
- [ ] Non-surveillance copy in all UI strings (reviewed by UX per UX-DR27)
- [ ] Integration test: inject 100 viewing_events → run aggregation job → assert hot/cold product list correct

---

### Story 12.5: Shopkeeper views per-customer browsing history in the CRM profile

**BLOCKED until Story 12.1 merges.**

**As a** shopkeeper,
**I want to** see which products a consented customer has recently browsed, in their CRM profile,
**so that** I can have an informed conversation when they call or visit and suggest relevant pieces.

**FR:** FR67
**Modules:** `apps/api/src/modules/viewing-analytics/` (per-customer history endpoint), `apps/shopkeeper/src/screens/CustomerProfile/RecentActivity`, `apps/api/src/modules/crm/` (customer profile aggregation)
**Consent invariant:** API reads viewing_consent.opted_in before returning data; if opted_in = false, returns empty array with { consentStatus: 'opted_out' } in response.

**Acceptance Criteria:**

**AC1 — Recent activity tab on customer CRM profile:**
```
Given a shopkeeper viewing a customer's CRM profile
When they open the "Recent Activity" tab (not "Tracking History" — surveillance-avoidance per UX-DR27)
Then the tab is visible only if the customer has opted in (viewing_consent.opted_in = true)
And if opted out: the tab shows: "इस customer ने viewing tracking बंद किया है — no data available"
And no viewing events are shown regardless of what is in the DB
```

**AC2 — Browsing history display for consented customers:**
```
Given a customer with opted_in = true who has viewed 8 products in the last 30 days
When the shopkeeper opens the "Recent Activity" tab
Then GET /api/v1/viewing-analytics/customers/:customerId/history returns:
  [ { productId, productName, category, thumbnailUrl, lastViewedAt, viewCount_30d } ] sorted by lastViewedAt desc, limit 20
And the tab renders a scrollable list of product cards with:
  - Product thumbnail + name + category
  - "आखिरी बार देखा: [relative time]" ("2 दिन पहले")
  - View count: "3 बार" (in the last 30 days)
```

**AC3 — Server-side consent check (defense-in-depth):**
```
Given a shopkeeper calls GET /api/v1/viewing-analytics/customers/:customerId/history
When the server processes the request
Then it checks viewing_consent.opted_in for that customer BEFORE querying viewing_events
And if opted_in = false: returns 200 with { data: [], consentStatus: 'opted_out' }
And if opted_in = true: returns the history data
And this check is in addition to the client-side tab visibility check (defense-in-depth)
```

**AC4 — Framing and copy (surveillance-avoidance):**
```
Given the Recent Activity tab
When a shopkeeper is viewing it
Then the section header reads: "हाल की रुचि" (Recent Interest) — never "Tracking" or "Surveillance"
And a subtle note at the bottom: "यह data customer की permission से है"
And no timestamps are shown to the millisecond (relative time only: "2 दिन पहले", "1 हफ्ते पहले")
```

**AC5 — Wishlist surfaced alongside browsing history:**
```
Given a customer's CRM profile
When the "Recent Activity" tab is open
Then wishlisted items are shown at the top of the list with a "♡ Wishlist में है" badge
And browsed-but-not-wishlisted items follow in descending time order
```

**Definition of Done:**
- [ ] GET /api/v1/viewing-analytics/customers/:customerId/history: consent check first; RLS enforced; returns product details joined
- [ ] "Recent Activity" tab in shopkeeper CRM profile; tab conditionally rendered based on consent status
- [ ] Non-surveillance copy in all UI strings
- [ ] Server-side consent check independent of client-side visibility
- [ ] Integration test: opted-in customer → history returned; opted-out customer → empty data + consentStatus flag

---

### Story 12.6: When a customer walks into the shop, staff sees CustomerContextCard within 3 seconds

**BLOCKED until Story 12.1 merges.**

**As a** shop staff member,
**I want to** see a brief, non-intrusive card showing a walk-in customer's recent wishlist and browsing when I look them up or scan their QR,
**so that** I can greet them by context ("aap jo mangalsutra dekh rahi thin — abhi shop mein hai") without them feeling watched.

**FR:** FR67 (walk-in context), FR66 (viewing data as source), FR64 (consented events)
**UX-DRs:** UX-DR16 (walk-in peripheral context flow — 3s target), UX-DR5 (CustomerContextCard component — non-modal, top-of-screen)
**Consent invariant:** CustomerContextCard only renders if viewing_consent.opted_in = true for the customer. If opted_out or no consent record: card does not render.

**Acceptance Criteria:**

**AC1 — Walk-in trigger: loyalty QR scan or name lookup:**
```
Given a staff member on the shopkeeper app main screen
When they scan a customer's loyalty QR code (displayed in customer app profile)
OR when they type a customer name/phone in the quick-search (≥ 3 chars, debounced 300ms)
Then the app calls GET /api/v1/crm/customers/:id/context (or GET /api/v1/crm/customers?q=<query>)
And the response includes: { customerId, name, tier, wishlistItems: [...], recentlyViewed: [...], openRateLocks: [...], occasions: [...], consentStatus: 'opted_in' | 'opted_out' }
```

**AC2 — CustomerContextCard renders within 3 seconds (UX-DR16):**
```
Given the context API response is received
When the response arrives with consentStatus = 'opted_in'
Then the CustomerContextCard renders at the TOP of the shopkeeper app screen (non-modal — it does not block interaction)
And the total time from QR scan / first search keystroke to card-visible is ≤ 3 seconds (p95) as measured by PostHog timing event
And the card shows:
  - Customer name + loyalty tier badge (LoyaltyTierBadge per UX-DR4)
  - "हाल की रुचि": top 3 recently viewed/wishlisted products (thumbnails + names)
  - Open rate locks count (if any): "1 active rate lock"
  - Upcoming occasion (if any): "Anniversary: 12 मई"
And the card is dismissible with a swipe-down gesture (does not require explicit close tap)
```

**AC3 — Consent gate: no card for opted-out customers:**
```
Given the context API response arrives for a customer with consentStatus = 'opted_out'
When the shopkeeper app processes the response
Then the CustomerContextCard does NOT render
And optionally a minimal card shows: customer name + tier only (no browsing data)
And no browsing/wishlist data is shown regardless of what is in the DB
```

**AC4 — Peripheral design — no modal, no interruption (UX-DR16):**
```
Given the CustomerContextCard is rendered
When a staff member is mid-interaction with another customer or screen
Then the card slides in from the top (not a modal, not a bottom sheet)
And it does not take focus away from the current screen interaction
And it auto-dismisses after 60 seconds if not interacted with
And the staff member can tap "Customer profile खोलें" to navigate to full CRM profile
```

**AC5 — 3-second performance target assertion:**
```
Given the walk-in flow
When a QR scan occurs on a device with mid-tier Android (Xiaomi Redmi Note class, 4G LTE)
Then the context API call completes in ≤ 1.5 seconds (p95) as the API serves from Redis-cached per-customer context
And the UI renders within 500ms of API response
And total end-to-end latency ≤ 3 seconds (PostHog custom event: 'walk_in_context_rendered')
And the context API response is Redis-cached with 5-minute TTL per (shopId, customerId) pair
And cache is invalidated on new view event, new wishlist add, or rate-lock status change
```

**AC6 — Privacy framing in the card (surveillance-avoidance):**
```
Given the CustomerContextCard displays browsing data
When the staff member reads it
Then the section is labeled: "हाल की रुचि" (not "Recently tracked", not "Browsing history")
And product items show: product name + category (not view count, not exact timestamp)
And a discreet footer: "इनकी permission से" (With their permission) in 11pt muted color
And there is no mention of "tracked", "monitored", "surveillance", "analytics" anywhere on the card
```

**AC7 — Walk-in trigger does not require consent to identify customer:**
```
Given the customer states their name or phone at the counter
When staff searches and finds the customer
Then the search itself (name/phone lookup) does not require viewing consent
And only the "हाल की रुचि" section of the card is consent-gated
And name, tier, rate-locks, occasions are shown regardless of consent status (they are not viewing analytics data)
```

**Definition of Done:**
- [ ] GET /api/v1/crm/customers/:id/context endpoint: aggregates name + tier + wishlist + viewing-history (consent-gated) + rate-locks + occasions; Redis-cached 5min
- [ ] CustomerContextCard component: Storybook story with opted-in variant + opted-out variant + empty state
- [ ] Card renders at top of shopkeeper app; non-modal; swipe-to-dismiss; auto-dismiss 60s
- [ ] Performance test: context API ≤ 1.5s p95 on warm cache; card renders ≤ 500ms after response
- [ ] PostHog timing event 'walk_in_context_rendered' emitted with latency measurement
- [ ] Non-surveillance copy reviewed and signed off per UX-DR27
- [ ] Integration test: opted-in customer QR scan → card with browsing data; opted-out → card without browsing data

---

## FR Coverage Verification (Epics 9–12)

| FR | Story | Verified |
|----|-------|---------|
| FR80 | 9.1 | ✅ |
| FR81 | 9.2 | ✅ |
| FR82 | 9.3 | ✅ |
| FR83 | 9.4 | ✅ |
| FR84 | 10.1, 10.2 | ✅ |
| FR85 | 10.3, 10.4 | ✅ |
| FR73 | 11.1, 11.2 | ✅ |
| FR74 | 11.3, 11.5, 11.8 | ✅ |
| FR75 | 11.4, 11.5 | ✅ |
| FR76 | 11.6 | ✅ |
| FR77 | 11.7 | ✅ |
| FR78 | 11.8 | ✅ |
| FR79 | 11.8 | ✅ |
| FR68 | 12.1 (GATING) | ✅ |
| FR64 | 12.2 | ✅ |
| FR65 | 12.3 | ✅ |
| FR66 | 12.4 | ✅ |
| FR67 | 12.5, 12.6 | ✅ |

**Total FRs covered:** 19 FRs across Epics 9–12. All FRs listed in epics.md for these four epics are accounted for.

---

## Story Count Summary

| Epic | Stories | Notes |
|------|---------|-------|
| Epic 9 | 5 | 9.1–9.5 |
| Epic 10 | 4 | 10.1–10.4 |
| Epic 11 | 8 | 11.1–11.8 |
| Epic 12 | 6 | 12.1 (gating) + 12.2–12.6 (blocked until 12.1 merges) |
| **Total** | **23** | |

---

## Binding Pattern Compliance Checklist

| Rule | Verified in Stories |
|------|-------------------|
| State-machine transitions guarded + side-effects enqueued + audit-logged | 9.1, 9.3, 9.4, 10.3, 10.4, 11.3, 11.5, 11.7, 11.8 |
| Photo upload = S3 + ImageKit + WhatsApp BullMQ + idempotency | 11.4, 11.5 |
| Razorpay webhook idempotency AC + adapter contract test | 9.1, 11.3 |
| Epic 12 stories 12.2+ reference consent invariant | 12.2, 12.3, 12.5, 12.6 (explicit AC) |
| Epic 11 completion integrates packages/compliance + Epic 5 billing | 11.8 |
| Hindi-first UX copy in ACs | All customer-facing stories |
| Optimistic update + rollback (TanStack Query onMutate) | 9.2, 10.2 |

---

## Open Ambiguities

1. **Rate-lock deposit refund policy (Story 9.2 AC4):** The PRD does not specify whether deposits are automatically refunded on expiry or refunded only at shopkeeper discretion. The `deposit refund status` UI in Story 9.2 acknowledges this as policy-governed. Resolution required from anchor SOW before the refund flow is built.

2. **Try-at-home piece-count cap enforcement (Story 10.2 AC1):** The spec says N = shopkeeper-configured. Story 10.2 enforces N at the API level (validated against shop_settings at request time). If the shopkeeper reduces N after a booking is made, existing bookings are not retroactively affected (grandfathered at booking-time cap). This interpretation should be confirmed.

3. **Custom order modification rollback to arbitrary stage (Story 11.7 AC4):** The current implementation allows rollback to METAL_CAST from STONES_SET. Should the shopkeeper be able to roll back further (e.g., from QC → APPROVED)? The current model restricts to one-stage rollback. This constraint should be validated with anchor jeweller workflow during discovery.

4. **Walk-in beacon detection (Story 12.6 AC1):** The flow currently supports QR scan + name/phone lookup as walk-in triggers. BLE beacon detection is referenced in the UX spec (UX-DR16) but requires hardware (BLE beacons in shop) and raises additional DPDPA questions (proximity tracking). Story 12.6 defers beacon to Phase 2; MVP is QR + search only. Confirm with anchor jeweller.

5. **Anonymous session_id retention period (Story 12.3):** How long should anonymous session_id-linked viewing events be retained? The PRD specifies 3-year retention for legally-required records (FR79) but does not specify anonymous analytics retention. Recommended: 90-day rolling window for anonymous events (sufficient for analytics, minimal PII risk). Confirm before implementation.
