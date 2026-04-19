---
generatedBy: 'Opus main orchestrator'
epic: 'E13 + E14'
date: '2026-04-17'
status: 'ready-for-orchestrator-consolidation'
notes:
  - >
    Epic 13 stories are per-user-value slices per IR-report correction — NOT "build notifications
    infrastructure". Story 13.1 ships foundation (AiSensy + BullMQ + DLQ + quota + audit log) alongside
    the first user-value slice (customer receives WhatsApp invoice).
  - >
    Epic 14 Story 14.1 provisions the RDS read replica that subsequent report stories consume.
---

---

## Epic 13: Customers receive WhatsApp updates at the right moments; shopkeepers receive the right push alerts

**Goal:** User-value-sliced notifications. Each story ships one notification flow end-to-end tied to its source event. Dispatcher + adapters foundation lands inside Story 13.1.

**FRs covered:** FR107, FR108, FR109, FR110, FR111, FR112
**Phase:** Phase 1 — runs continuously from Sprint 6; slices land alongside source epics

---

### Story 13.1: Customer receives WhatsApp invoice receipt within 30 seconds of billing

**Class:** B — Outbound WhatsApp invoice receipt send from BullMQ (not inbound webhook); safe notification surface.

**As a Customer (Priya right after checkout)**,
I want the invoice PDF on my WhatsApp within 30 seconds of payment — with my name in Hindi, shop branding, full GST breakdown,
So that I have proof of purchase without waiting for SMS or email.

**FRs implemented:** FR107 (first slice), FR112 (audit log per tenant)
**NFRs verified:** NFR-P12 (< 30s), NFR-I4 (per-tenant quota), NFR-I5 (retry + DLQ)
**Modules + packages touched:**
- `apps/api/src/modules/notifications/*` (new — module + service + dispatcher)
- `packages/integrations/whatsapp/aisensy-adapter.ts` (new)
- `packages/integrations/whatsapp/port.ts` (new — WhatsAppPort)
- `apps/api/src/workers/notifications-dispatch.processor.ts` (new — BullMQ consumer)
- `packages/db/src/schema/notification-events.ts` (new — audit log per-tenant; quota tracking)
- `apps/api/src/modules/notifications/quota.service.ts` (new — per-tenant daily quota per NFR-I4)
- `packages/db/src/migrations/0013_notifications.sql`

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #3 (event listener invoice.created), MUST #4 (idempotency per notification_id), MUST #5, MUST #7
**Complexity:** L (foundation + first slice)

**Acceptance Criteria:**

**Given** Epic 5 Story 5.10 has just completed invoice generation with `invoice.created` event
**When** notifications dispatcher consumes the event
**Then** BullMQ `notifications-dispatch` job enqueues with `{ type: 'invoice_receipt', invoice_id, customer_phone, tenant_id, idempotency_key }`
**And** AiSensy adapter sends template-approved WhatsApp message with PDF attachment within 30s p95
**And** `notification_events` logs `{ tenant_id, customer_id, type: 'whatsapp_invoice_receipt', status, provider_msg_id }`

**Given** AiSensy returns transient 5xx
**When** retry logic fires
**Then** exponential backoff max 3 retries; permanent failure → DLQ + Sentry alert with runbook link

**Given** a tenant exceeds daily WhatsApp quota
**When** further sends attempted
**Then** queue pauses for that tenant; shopkeeper push alert "Daily WhatsApp quota reached; upgrade plan?"

**Given** CI runs, all gates pass; contract test on AiSensyAdapter passes

**Tests required:** Unit (dispatcher, adapter, quota logic), Integration (invoice.created → WhatsApp test account), Tenant-isolation (tenant A notifications never reach tenant B), Chaos (AiSensy down → DLQ), Contract

**Definition of Done:** All AC + 10 CI gates + runbook `docs/runbooks/whatsapp-send-failure.md` + 5 review layers.

---

### Story 13.2: Customer receives WhatsApp progress photos + push for custom orders

**Class:** B — Outbound WhatsApp + push for custom-order progress photos; safe surface.

**As a Customer (Priya tracking her bridal set)**,
I want photos at Metal Cast + Stones Set + QC stages delivered to WhatsApp + app push within 5 minutes of shopkeeper upload,
So that I feel informed without calling the shop.

**FRs implemented:** FR107 (progress photos slice), FR108 (push mirror)
**NFRs verified:** NFR-P12
**Modules + packages touched:**
- `apps/api/src/modules/notifications/notifications.service.ts` (extend — `custom_order.stage_advanced` listener)
- `packages/integrations/push/fcm-adapter.ts` (new)
- `packages/integrations/push/port.ts` (new — PushPort)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #3, MUST #4, MUST #5, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Epic 11 Story 11.4/11.5 fires `custom_order.stage_advanced` with photo attached
**When** notification dispatcher runs
**Then** WhatsApp + FCM push both fire within 30s p95 with photo + Hindi copy "Stage X पूर्ण, अगला [days] दिन में"
**And** idempotent per stage transition (one notification per stage advancement)

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation, E2E

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 13.3: Customer receives WhatsApp rate-lock confirmation + expiry reminder with push

**Class:** B — Outbound rate-lock expiry reminder; safe notification surface.

**As a Customer (Priya who locked a rate 6 days ago)**,
I want a WhatsApp + push reminder tomorrow saying "Your rate-lock expires in 24 hours",
So that I don't let the rate-lock lapse accidentally.

**FRs implemented:** FR107, FR108 (rate-lock slice)
**NFRs verified:** NFR-P12
**Modules + packages touched:**
- `apps/api/src/modules/notifications/notifications.service.ts` (extend — rate-lock events from Epic 9)
- `apps/api/src/workers/rate-lock-expiry-reminder.processor.ts` (new — BullMQ scheduled)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #3, MUST #4, MUST #5, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Epic 9 rate-lock created with 7-day validity
**When** T-24h reminder scheduled + T-0 expiry
**Then** both fire via WhatsApp + push with Hindi warmth copy

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 13.4: Customer receives WhatsApp try-at-home appointment confirmation + pre-visit push

**Class:** B — Outbound try-at-home booking confirmation; safe notification surface.

**As a Customer (Priya who booked Saturday try-at-home)**,
I want immediate WhatsApp confirmation on booking + push reminder Saturday morning,
So that I remember the appointment and the shop remembers too.

**FRs implemented:** FR107, FR108 (try-at-home slice)
**NFRs verified:** NFR-P12
**Modules + packages touched:**
- `apps/api/src/modules/notifications/notifications.service.ts` (extend — try-at-home events from Epic 10)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #3, MUST #4, MUST #5, MUST #7
**Complexity:** XS

**Acceptance Criteria:**

**Given** Epic 10 try-at-home booking confirmed
**When** confirmation fires
**Then** WhatsApp + push both deliver within 30s
**And** day-of reminder fires morning of visit

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 13.5: Customer receives WhatsApp loyalty tier upgrade celebration

**Class:** B — Outbound loyalty tier-upgrade celebration; safe notification surface.

**As a Customer (Priya promoted to Platinum)**,
I want a genuinely celebratory WhatsApp message with deep-link to in-app celebration (Epic 8 Story 8.5),
So that the tier feels earned.

**FRs implemented:** FR107 (loyalty slice)
**NFRs verified:** NFR-P12
**Modules + packages touched:**
- `apps/api/src/modules/notifications/notifications.service.ts` (extend — `loyalty.tier_upgraded` from Epic 8)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #3, MUST #4, MUST #5, MUST #7
**Complexity:** XS

**Acceptance Criteria:**

**Given** Epic 8 Story 8.4 emits `loyalty.tier_upgraded`
**When** dispatcher fires
**Then** WhatsApp sends tier-upgrade template with deep-link to `/account/tier-upgrade` (Epic 8 Story 8.5 celebration screen)
**And** tenant-branded: shop name + tenant theme colors in message template

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 13.6: Shopkeeper receives push alerts for low stock, PMLA warnings, new inquiries, new bookings, new reviews, overdue custom-order stages

**Class:** A — Shopkeeper push on PMLA compliance threshold (touches compliance-alert event boundary).

**As a Shop Owner (Rajesh-ji)**,
I want timely push notifications for things I need to act on — low stock, PMLA warning, new customer inquiry, try-at-home booking, new review, custom-order stage overdue,
So that nothing falls through the cracks.

**FRs implemented:** FR109
**NFRs verified:** NFR-P12
**Modules + packages touched:**
- `apps/api/src/modules/notifications/shopkeeper-alerts.service.ts` (new)
- `packages/integrations/push/fcm-adapter.ts` (used — shopkeeper app device tokens)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #3, MUST #5, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** any of: low-stock threshold crossed, PMLA warn threshold crossed (Epic 5 Story 5.5), new inquiry (Epic 7 Story 7.10), try-at-home booking (Epic 10 Story 10.2), new review (Epic 7 Story 7.16), custom-order stage overdue (Epic 11)
**When** event fires
**Then** shopkeeper push with Hindi title + action CTA deep-link

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration (all 6 event types), Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 13.7: Shopkeeper broadcasts WhatsApp to filtered customer segments

**Class:** B — Broadcast WhatsApp to filtered segments with marketing opt-in respected.

**As a Shop Owner (Rajesh-ji before Dhanteras)**,
I want to send a Diwali festival offer to "all Silver+ loyalty customers" OR "all customers with last purchase > 6 months",
So that marketing is targeted, not spray-and-pray.

**FRs implemented:** FR110
**NFRs verified:** NFR-P12, NFR-I4 (quota), NFR-C6 (marketing opt-in respected)
**Modules + packages touched:**
- `apps/api/src/modules/notifications/broadcast.service.ts` (new — segment + opt-in filter)
- `apps/shopkeeper/app/marketing/broadcast.tsx` (new)
- `packages/ui-mobile/business/SegmentBuilder.tsx` (new Tier 3)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #5, MUST #7
**Depends on:** Story 13.8 (marketing-opt-in must ship first)
**Complexity:** M

**Acceptance Criteria:**

**Given** Shopkeeper builds segment "Silver+ loyalty AND opted-in-marketing"
**When** broadcast fires
**Then** only customers matching both conditions receive; audit logs broadcast details
**And** quota enforced per tenant; overflow queued

**Given** CI runs, all gates pass

**Tests required:** Unit (segment logic), Integration (segment + opt-in filter), Tenant-isolation, Chaos (quota overflow)

**Definition of Done:** All AC + 10 CI gates + Storybook SegmentBuilder + 5 review layers.

---

### Story 13.8: Customer opts in/out of marketing vs transactional notifications separately

**Class:** B — Notification preference schema for marketing vs transactional; no auth/compliance.

**As a Customer (Priya who wants invoices but not festival campaigns)**,
I want to toggle marketing and transactional separately — one-tap each,
So that I can stay informed without feeling marketed-to.

**FRs implemented:** FR111
**NFRs verified:** NFR-C6 (DPDPA dual consent)
**Modules + packages touched:**
- `packages/db/src/schema/customers.ts` (extend — `marketing_opt_in BOOLEAN`, `transactional_opt_in BOOLEAN`)
- `apps/customer/app/account/notifications.tsx` (new)
- `apps/api/src/modules/notifications/opt-in.service.ts` (new)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5, MUST #7
**Complexity:** XS

**Acceptance Criteria:**

**Given** Priya opens notification preferences
**When** she toggles marketing off
**Then** `marketing_opt_in = false`; future broadcast filters exclude her
**And** transactional (invoice receipt, rate-lock expiry) continues regardless
**And** preference change audit-logged

**Given** CI runs, all gates pass

**Tests required:** Unit (opt-in filter logic), Integration

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 13.9: System sends festival-campaign WhatsApp blast for Dhanteras + Akshaya Tritiya

**Class:** B — Festival-campaign scheduled blast; safe outbound surface.

**As a Shop Owner (Rajesh-ji)**,
I want a festival-campaign template scheduled for Dhanteras + Akshaya Tritiya weeks with my own copy + banner image,
So that I reach customers at peak spending moments with minimal effort.

**FRs implemented:** FR107 (festival path), ties into Epic 16 Story 16.1 load test
**NFRs verified:** NFR-P10 (10× wedding-season load sustained), NFR-P12
**Modules + packages touched:**
- `apps/shopkeeper/app/marketing/festival-campaign.tsx` (new)
- `apps/api/src/workers/festival-campaign.processor.ts` (new — scheduled BullMQ)

**ADRs governing:** ADR-0006
**Pattern rules honoured:** MUST #3, MUST #5, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** Rajesh-ji schedules a Dhanteras campaign for Nov 10 with banner + Hindi copy + segment
**When** Nov 10 fires
**Then** campaign dispatches across segment; quota enforced; audit logged
**And** load-test in Epic 16 validates 10× sustained throughput

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Load (10× peak)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 13.10: All outbound notifications logged per tenant for audit + quota tracking

**Class:** B — Notification observability + quota logging infrastructure; no compliance write path.

**As the Goldsmith Platform**,
I need every outbound notification (WhatsApp, SMS, push, email) persisted with tenant_id + type + status + provider_msg_id for audit, quota, and billing,
So that compliance + cost attribution are both accurate.

**FRs implemented:** FR112
**NFRs verified:** NFR-S9 (5y audit), NFR-I4 (quota)
**Modules + packages touched:**
- `packages/db/src/schema/notification-events.ts` (used — from Story 13.1)
- `apps/api/src/modules/notifications/observability.ts` (new — dashboard endpoints for platform admin)

**ADRs governing:** ADR-0011
**Pattern rules honoured:** MUST #1, MUST #5
**Complexity:** XS

**Acceptance Criteria:**

**Given** any notification dispatched (from any prior Epic 13 story)
**When** event persists
**Then** `notification_events` row inserts with full metadata
**And** platform admin dashboard (Epic 15) aggregates per-tenant

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

## Epic 14: Shopkeeper sees the day's numbers, ages inventory, and exports GSTR-ready data

**Goal:** Operational reports + dashboards consuming the read replica for performance. CSV + branded PDF export.

**FRs covered:** FR113, FR114, FR115, FR116, FR117, FR118, FR119
**Phase:** Phase 1 — Sprint 9
**Dependencies:** Epic 5, 6, 8

---

### Story 14.1: RDS read replica provisioned + report queries routed to replica

**Class:** B — Postgres read-replica provisioning + report routing; operational, safe surface.

**As the Goldsmith Platform**,
I need report queries executing against a dedicated read replica so primary DB isn't impacted by heavy aggregations,
So that operational DB stays fast under reporting load.

**FRs implemented:** (Infrastructure enabler — no FR directly)
**NFRs verified:** NFR-P5 (complex reports < 2s), NFR-SC6
**Modules + packages touched:**
- `infra/terraform/modules/database/read-replica.tf` (new)
- `apps/api/src/common/providers/db.provider.ts` (extend — `dbReadReplica` + routing by transaction type)
- `apps/api/src/modules/reports/*` (new — all report modules route to replica)

**ADRs governing:** ADR-0002, ADR-0012
**Pattern rules honoured:** MUST #1, MUST #5
**Complexity:** M

**Acceptance Criteria:**

**Given** Terraform apply
**When** infra deploys
**Then** RDS read replica exists in ap-south-1a different AZ; lag monitored
**And** report queries (explicitly tagged) route to replica; transactional queries stay on primary

**Given** CI runs, all gates pass

**Tests required:** Unit (routing logic), Integration (with Testcontainers primary + replica setup), Load (NFR-P5 report < 2s under concurrent load)

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 14.2: Shopkeeper views daily sales summary (invoices, value, GST collected, payment-method mix, exchanges)

**Class:** B — Daily sales summary read via replica; no new compliance logic.

**As a Shop Owner (Rajesh-ji at end of Dhanteras day)**,
I want one screen showing today's: total invoices, total value, total GST collected, payment split (cash/UPI/card/exchange), custom-order starts,
So that I close the day with clarity.

**FRs implemented:** FR113
**NFRs verified:** NFR-P5, NFR-A7 (senior-friendly typography)
**Modules + packages touched:**
- `apps/api/src/modules/reports/daily-sales.service.ts` (new)
- `apps/shopkeeper/app/(tabs)/index.tsx` (extend — EOD summary module)
- `packages/ui-mobile/business/DailySummaryCard.tsx` (new Tier 3)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5, MUST #7
**Complexity:** S

**Acceptance Criteria:**

**Given** Rajesh-ji opens daily summary
**When** query runs against read replica
**Then** shows in Hindi: total invoices, total value (packages/money formatted), GST collected (metal+making split), payment mix bar chart, top 3 customers by amount
**And** renders < 2s p95

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation, Weight-precision (totals paise-exact)

**Definition of Done:** All AC + 10 CI gates + Storybook DailySummaryCard + 5 review layers.

---

### Story 14.3: Shopkeeper views stock valuation report at market rate, cost price, and selling price

**Class:** B — Stock valuation via replica reusing Epic 3 logic; safe read-only surface.

**As a Shop Owner (Rajesh-ji)**,
I want to see total inventory value at (a) today's rate, (b) my cost, (c) expected selling — by category,
So that I know my shop's net worth and margin.

**FRs implemented:** FR114
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- Reuses Epic 3 Story 3.7 valuation logic + wraps with read-replica routing + PDF export

**ADRs governing:** ADR-0002, ADR-0003
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** Rajesh-ji taps "Valuation Report"
**When** query runs
**Then** categorized breakdown renders with 3-column market/cost/selling values
**And** "Export CSV" + "Export PDF" buttons (Story 14.8)

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Weight-precision

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 14.4: Shopkeeper views outstanding-payment report (customers with credit balance or overdue dues)

**Class:** B — Outstanding-payment balance reports via replica; no compliance logic.

**As a Shop Owner (Rajesh-ji)**,
I want a sorted list of customers who owe me money — amount + days outstanding + last-contact,
So that I know who to call today.

**FRs implemented:** FR115
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/api/src/modules/reports/outstanding.service.ts` (new — reads customer balances from Epic 6 Story 6.4)
- `apps/shopkeeper/app/reports/outstanding.tsx` (new)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5
**Complexity:** S

**Acceptance Criteria:**

**Given** 30 customers with outstanding balances
**When** Rajesh-ji opens report
**Then** sorted by days-outstanding DESC; tap-to-WhatsApp CTA per row
**And** total outstanding rupees shown at top

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation, Weight-precision

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 14.5: Shopkeeper views customer analytics (top customers by LTV, new customer rate, repeat rate)

**Class:** B — Customer analytics (LTV / repeat rate) via replica; safe reporting.

**As a Shop Owner (Rajesh-ji)**,
I want to see who my top 10 customers are by lifetime value, how many new customers I'm adding monthly, and what my repeat-purchase rate is,
So that I understand my customer economics.

**FRs implemented:** FR116
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/api/src/modules/reports/customer-analytics.service.ts` (new)
- `apps/shopkeeper/app/reports/customer-analytics.tsx` (new)

**ADRs governing:** ADR-0002, ADR-0009 (reads via CRM + Billing service APIs)
**Pattern rules honoured:** MUST #1, MUST #2, MUST #5
**Complexity:** M

**Acceptance Criteria:**

**Given** shop with 500 customers + 2000 invoices
**When** Rajesh-ji opens customer analytics
**Then** top 10 by LTV, monthly new-customer trend, repeat-purchase % (last 12 months)
**And** renders < 2s p95

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 14.6: Shopkeeper views inventory aging with dead-stock flag

**Class:** B — Inventory-aging dead-stock report; read-only, no compliance/money.

**As a Shop Owner (Rajesh-ji)**,
I want to see pieces that haven't sold in 90+ days flagged prominently with suggested actions (discount/karigar/repurpose),
So that capital isn't locked in dead stock.

**FRs implemented:** FR117
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/api/src/modules/reports/inventory-aging.service.ts` (new — extends Epic 3 Story 3.10)

**ADRs governing:** ADR-0002
**Pattern rules honoured:** MUST #1, MUST #5
**Complexity:** XS

**Acceptance Criteria:**

**Given** shop with 500 products
**When** aging report opens
**Then** pieces grouped by age buckets (0-30 / 31-90 / 91-180 / 181+ days)
**And** dead-stock flag per shop-configured threshold

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 14.7: Shopkeeper views loyalty program summary (members per tier, points accrued/redeemed)

**Class:** B — Loyalty-program summary operational report; safe surface.

**As a Shop Owner (Rajesh-ji)**,
I want to see my loyalty program health — members per tier, total points outstanding, redemption rate,
So that I know if the program is driving behavior.

**FRs implemented:** FR118
**NFRs verified:** NFR-P5
**Modules + packages touched:**
- `apps/api/src/modules/reports/loyalty-summary.service.ts` (new — reads Epic 8)

**ADRs governing:** ADR-0002, ADR-0009
**Pattern rules honoured:** MUST #1, MUST #5
**Complexity:** XS

**Acceptance Criteria:**

**Given** shop with 300 loyalty members
**When** summary opens
**Then** per-tier counts, total outstanding points, monthly redemption trend
**And** renders < 2s p95

**Given** CI runs, all gates pass

**Tests required:** Unit, Integration, Tenant-isolation

**Definition of Done:** All AC + 10 CI gates + 5 review layers.

---

### Story 14.8: Shopkeeper exports any report as CSV + branded PDF with shop logo

**Class:** B — CSV + tenant-branded PDF export UI; no auth/money/compliance.

**As a Shopkeeper's Accountant (receiving monthly reports)**,
I need CSV + branded PDF for every report — PDF uses tenant's logo + colors, CSV is spreadsheet-ready,
So that I can email directly to my CA.

**FRs implemented:** FR119; also reuses GSTR-1/3B CSV from Epic 5 Story 5.12
**NFRs verified:** NFR-P5 (export async for large reports), NFR-I6 (CSV format spec)
**Modules + packages touched:**
- `apps/api/src/modules/reports/export.service.ts` (new)
- `apps/api/src/workers/report-export.processor.ts` (new — BullMQ for async large exports)
- `packages/ui-mobile/business/ReportExportSheet.tsx` (new)

**ADRs governing:** ADR-0008 (PDF uses tenant branding)
**Pattern rules honoured:** MUST #1, MUST #5, MUST #6, MUST #7
**Complexity:** M

**Acceptance Criteria:**

**Given** any report screen
**When** Rajesh-ji taps "Export PDF"
**Then** tenant-branded PDF generates (logo + colors + shop address); delivery via WhatsApp/email link
**And** CSV export similarly; large exports go async with progress polling

**Given** CI runs, all gates pass including Chromatic VR for PDF template per tenant

**Tests required:** Unit (PDF template correctness), Integration, Tenant-isolation, VR

**Definition of Done:** All AC + 10 CI gates + Storybook ReportExportSheet + 5 review layers.

---
