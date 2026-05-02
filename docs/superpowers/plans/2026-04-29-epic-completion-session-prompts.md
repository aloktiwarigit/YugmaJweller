# Goldsmith — Epic Completion: All Session Prompts
> Generated 2026-04-29 from the post-8.1b completeness audit.
> Each prompt is a self-contained brief — copy-paste into a fresh Claude session.
> Plan file with architecture rationale: `C:\Users\alokt\.claude\plans\synchronous-wandering-cat.md`

---

## Quick Reference

| Prompt | Wave | Class | Model | Worktree | Can start when |
|--------|------|-------|-------|----------|----------------|
| 1A | 1 | B | Sonnet | `C:/gs-str` | Now |
| 1B | 1 | A | Sonnet | `C:/gs-tcs` | Now |
| 1C | 1 | B | Sonnet | `C:/gs-269ss` | Now |
| 1D | 1 | C | Haiku | `C:/gs-posthog` | Now |
| 1E | 1 | C | Haiku | `C:/gs-fixes` | Now |
| 2A | 2 | B | Sonnet | `C:/gs-loyalty2` | Wave 1 merged |
| 2B | 2 | B | Sonnet | `C:/gs-reports` | Wave 1 merged |
| 2C | 2 | B | Sonnet | `C:/gs-huid2` | Wave 1 merged |
| 3A | 3 | B | Sonnet | `C:/gs-estimate` | Wave 2 merged |
| 3B | 3 | B | Sonnet | `C:/gs-analytics` | Wave 2 merged |
| 3C | 3 | A | Sonnet | `C:/gs-custom` | Wave 2 merged |
| 4A | 4 | A | Opus | `C:/gs-ratelock` | Wave 3 merged |
| 4B | 4 | B | Sonnet | `C:/gs-tryathome` | Wave 3 merged |
| 5A | 5 | B | Sonnet | `C:/gs-cust-web` | Wave 4 merged |
| 5B | 5 | B | Sonnet | `C:/gs-cust-mob` | Wave 4 merged |
| 5C | 5 | B | Sonnet | `C:/gs-browse` | 5A+5B merged |
| 5D | 5 | A | Sonnet | `C:/gs-cust-flows` | 5A+5B merged |
| 5E | 5 | B | Sonnet | `C:/gs-reviews` | 5A+5B merged |
| 6A | 6 | A | Sonnet | `C:/gs-admin` | Wave 4 merged |

**Wave merge order:**
- Wave 1: 1E → 1A → 1C → 1D → 1B
- Wave 2: 2C → 2B → 2A
- Wave 3: 3B → 3C → 3A
- Wave 4: 4B → 4A
- Wave 5 Round A: 5B → 5A
- Wave 5 Round B: 5E → 5D → 5C
- Wave 6: 6A (standalone)

**After every wave:** `pnpm typecheck && pnpm lint && pnpm test` on main must pass before the next wave starts.

**Migration pre-assignment:**
0039=1B, 0040=1E, 0041=2C, 0042=3A, 0043=3B, 0044=3C, 0045=4A, 0046=4B, 0047=5E, 0048=5B, 0049=5D, 0053-0055=6A

---

## PROMPT 1A — STR Template (PMLA Statutory Gap)

```
You are implementing the Suspicious Transaction Report (STR) template for the Goldsmith jewellery platform to close a statutory PMLA compliance gap.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6 — Class B story. If on Opus suggest /model sonnet before starting.

Ceremony class: B — compressed ceremony.
Protocol: brainstorm (quick, same session) → writing-plans → TDD implement → Codex review → runtime smoke.

Setup worktree FIRST:
  git worktree add C:/gs-str -b feat/story-compliance-str
  cd C:/gs-str && pnpm install

Context:
FR54 (PMLA compliance) requires both CTR and STR templates. CTR is implemented at
packages/compliance/src/pmla/ctr-template.ts, exposed via GET /compliance/ctr.
STR is entirely absent. Under PMLA/FIU-IND, jewellers must file STRs within 7 working
days of a suspicious transaction — no minimum threshold. Failure to file is a regulatory
violation.

You exclusively own these files (no other parallel session touches them):
- packages/compliance/src/pmla/str-template.ts (new)
- packages/compliance/src/pmla/str-template.test.ts (new)
- apps/api/src/modules/compliance/compliance-reports.controller.ts (add GET /compliance/str-template only — do not touch existing CTR methods)
- apps/shopkeeper/src/features/compliance/StrDownloadCard.tsx (new)

Do NOT touch: billing.service.ts, payment.service.ts, ctr-template.ts, any migration files.
No migration needed — STR is a report template, not a schema change.

Implement:

1. str-template.ts — buildStrDocument(input: StrInput): StrDocument and renderStrText(doc): string
   StrInput: {
     shopId, shopName, shopAddress, shopGstin, reportingOfficerName,
     suspiciousTransactionDate: Date, transactionAmountPaise: bigint,
     transactionNature: string, customerName: string, customerAddress: string,
     customerPan?: string, basisOfSuspicion: string, actionsTaken: string, reportDate: Date
   }
   renderStrText returns plain-text suitable for download/print.

2. str-template.test.ts — test buildStrDocument with complete input (all required fields
   present in output); test renderStrText contains shopName, customerName, basisOfSuspicion.

3. compliance-reports.controller.ts — add GET /compliance/str-template endpoint. Requires
   TenantContext (same auth guard as CTR endpoint). Returns blank STR template with shop
   details pre-filled from shop_settings.

4. StrDownloadCard.tsx — React Native component. Title: "संदिग्ध लेनदेन रिपोर्ट (STR)".
   Instruction: "7 कार्य दिवसों में FIU-IND को सबमिट करें". Download button calls
   GET /compliance/str-template. Mirror CtrDownloadCard.tsx exactly — same pattern.

TDD: red → green → refactor, commit each cycle.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → write .codex-review-passed

Runtime smoke: Start API, call GET /compliance/str-template with valid JWT, verify
response contains shopName field.

Non-negotiable rules:
- Hindi-first UI — STR card title and instructions in Hindi
- No FLOAT anywhere
- No cross-tenant data access
- All business logic in packages/compliance, not in the controller
```

---

## PROMPT 1B — TCS Section 206C(1D) (Statutory Gap, Class A)

```
You are implementing TCS Section 206C(1D) enforcement for the Goldsmith jewellery platform.
This is a Class A story — follow full Class A ceremony.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6. If on Opus suggest /model sonnet before starting.

Ceremony class: A — full ceremony. FRESH SESSION required for context quarantine.

Setup worktree FIRST:
  git worktree add C:/gs-tcs -b feat/story-compliance-tcs-206c
  cd C:/gs-tcs && pnpm install

Context:
TCS Section 206C(1D) of the Income Tax Act requires sellers of jewellery to collect 1%
TCS from buyers when the invoice total exceeds Rs 2,00,000 (cash or non-cash). The TCS
amount is collected as part of the invoice total and must be deposited with the government.
Currently invoices have no TCS field — a statutory liability gap. Migration 0039 is
pre-assigned to this session.

You exclusively own these files:
- packages/compliance/src/tcs/tcs-206c.ts (new)
- packages/compliance/src/tcs/tcs-206c.test.ts (new)
- apps/api/migrations/0039_tcs_on_invoices.sql (new — migration NUMBER 0039 only)
- apps/api/src/modules/billing/billing.service.ts — ADD TCS calculation block ONLY after the existing GST/HUID/269ST logic. Do not modify any existing enforcement.
- apps/api/src/db/schema/invoices.ts — ADD tcs_collected_paise column definition

Do NOT touch: payment.service.ts, compliance-reports.controller.ts, loyalty modules,
any other file. Do not use migration numbers other than 0039.

Implement:

1. packages/compliance/src/tcs/tcs-206c.ts:
   export const TCS_THRESHOLD_PAISE = 20_000_000n; // Rs 2,00,000
   export const TCS_RATE_BP = 100; // 1% in basis points
   export function computeTcs(invoiceTotalPaise: bigint): bigint {
     if (invoiceTotalPaise <= TCS_THRESHOLD_PAISE) return 0n;
     return (invoiceTotalPaise * BigInt(TCS_RATE_BP)) / 10_000n;
   }

2. tcs-206c.test.ts: below threshold → 0n; exactly at Rs 2L → 0n (exclusive threshold);
   Rs 2L + 1 paise → 1% of total; Rs 5,00,000 → Rs 5,000 (500_000n paise).

3. Migration 0039:
   ALTER TABLE invoices ADD COLUMN tcs_collected_paise BIGINT NOT NULL DEFAULT 0;

4. billing.service.ts: After computing invoice total and before INSERT, call
   computeTcs(totalPaise) and store result in tcs_collected_paise. Include in invoice
   response DTO.

5. Invoice response DTO: Add tcs_collected_paise field so the PDF service can render it.

TDD: red → green → refactor, commit each cycle.

Review gate (Class A — run both simultaneously):
  codex review --base main → .codex-review-passed
  /security-review → .security-review-passed
Both markers required before pushing.

Runtime smoke: Create a B2C invoice with total > Rs 2L via curl against running API.
Verify response.tcs_collected_paise > 0.

Non-negotiable rules:
- tcs_collected_paise MUST be BIGINT (paise), never FLOAT or DECIMAL
- TCS computed server-side only — never trust client-supplied TCS values
- computeTcs() must live in packages/compliance — not inlined in billing.service.ts
- No cross-tenant queries
```

---

## PROMPT 1C — Section 269SS/269T Enforcement

```
You are implementing Section 269SS and 269T cash restriction enforcement for Goldsmith.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

Setup worktree FIRST:
  git worktree add C:/gs-269ss -b feat/story-compliance-269ss-269t
  cd C:/gs-269ss && pnpm install

Context:
Section 269SS: No person shall accept any loan/deposit/advance in cash ≥ Rs 20,000.
Penalty = 100% of the amount. For a jeweller this applies to cash advances for custom
orders and security deposits.
Section 269T: No person shall repay any loan/deposit in cash ≥ Rs 20,000.
Currently payment.service.ts has Section 269ST (cash transaction cap) but no 269SS/269T.
No migration is needed — these are behavioral checks. The custom orders module (Wave 3)
will be the primary enforcement point for deposits, but we build the check function now
and wire it into the payment service's advance path.

You exclusively own these files:
- packages/compliance/src/cash-restriction/section-269ss.ts (new)
- packages/compliance/src/cash-restriction/section-269ss.test.ts (new)
- apps/api/src/modules/billing/payment.service.ts — ADD 269SS guard in advance payment path ONLY. Do NOT modify the existing Section 269ST check at L267.

No migration needed. Do not create or modify any migration files.

Implement:

1. packages/compliance/src/cash-restriction/section-269ss.ts:
   export const RESTRICTION_269SS_THRESHOLD_PAISE = 2_000_000n; // Rs 20,000
   export type CashRestrictionType = 'advance' | 'deposit' | 'repayment';
   export function enforce269ss(amountPaise: bigint, type: CashRestrictionType): void {
     if (amountPaise >= RESTRICTION_269SS_THRESHOLD_PAISE) {
       throw new ComplianceHardBlockError(
         `Section 269SS: Cash ${type} of ₹${formatAmount(amountPaise)} is prohibited. ` +
         `Use account payee cheque or bank transfer.`,
         { code: 'SECTION_269SS', amountPaise: amountPaise.toString() }
       );
     }
   }
   (Use the same ComplianceHardBlockError class already used for 269ST.)

2. section-269ss.test.ts: Rs 19,999 → passes; Rs 20,000 → throws ComplianceHardBlockError
   with code SECTION_269SS; Rs 50,000 → throws; type 'repayment' Rs 20,000 → throws.

3. payment.service.ts: Find the advance payment recording path (if it exists — may be
   stubbed for custom orders). Call enforce269ss(cashAmountPaise, 'advance') before the
   DB write. If no advance path exists yet, add a clearly documented stub with comment:
   // enforce269ss wired here — see Wave 3 (feat/story-custom-orders) for deposit flow.

TDD: red → green → refactor, commit each cycle.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: POST to any advance/deposit payment endpoint with cash ≥ Rs 20,000.
Expect 422 with code SECTION_269SS.

Non-negotiable rules:
- Do NOT touch the Section 269ST check in payment.service.ts — it is at L267, leave it untouched
- All amounts in paise (bigint), never float
- enforce269ss must live in packages/compliance, not inline
```

---

## PROMPT 1D — PostHog Product Analytics Wiring

```
You are wiring PostHog product analytics into the Goldsmith jewellery platform. Class C story.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Haiku 4.5 — mechanical instrumentation. If on higher tier suggest /model haiku.

Ceremony class: C — minimal ceremony. Codex-only review.

Setup worktree FIRST:
  git worktree add C:/gs-posthog -b feat/story-posthog-wiring
  cd C:/gs-posthog && pnpm install

Context:
PostHog is entirely absent. packages/observability/ has Sentry and OTel already wired.
The PRD requires engagement instrumentation in Phase 0 — the Month-6 pivot decision
relies on DAU/WAU/MAU data. PostHog Cloud free tier (1M events/month) fits startup
economics. API key injected via env var POSTHOG_API_KEY; no-op if not set.

You exclusively own these files:
- packages/observability/src/posthog.ts (new)
- packages/observability/src/index.ts (add posthog exports)
- apps/api/src/main.ts (add initPosthog call after initOtel line)
- apps/shopkeeper/src/ (PosthogProvider + screen tracking only — do not modify feature logic)

Do NOT touch: Sentry files, OTel files, billing.service.ts, any migration files, compliance package.
No migration needed.

Implement:

1. Add to packages/observability/package.json: "posthog-node": "^4.0.0"
   Add to apps/shopkeeper/package.json: "posthog-react-native": "^3.0.0"

2. packages/observability/src/posthog.ts:
   import { PostHog } from 'posthog-node';
   let _client: PostHog | null = null;
   export function initPosthog(apiKey?: string, host?: string): void {
     if (!apiKey) return;
     _client = new PostHog(apiKey, { host: host ?? 'https://app.posthog.com' });
   }
   export function trackEvent(shopId: string, event: string, properties?: Record<string, unknown>): void {
     _client?.capture({ distinctId: shopId, event, properties });
   }
   export async function shutdownPosthog(): Promise<void> {
     await _client?.shutdown();
   }

3. apps/api/src/main.ts: add initPosthog(process.env.POSTHOG_API_KEY, process.env.POSTHOG_HOST)
   after the existing initOtel line. Add shutdownPosthog() to app lifecycle onModuleDestroy.

4. Wire trackEvent calls into these service files (import posthog, add ONE call per service,
   do not modify any business logic):
   - billing.service.ts: trackEvent(shopId, 'invoice.created', { invoice_type, total_paise }) after successful INSERT
   - catalog/publish path: trackEvent(shopId, 'product.published')
   - crm.service.ts: trackEvent(shopId, 'customer.created') after INSERT
   - loyalty event listener: trackEvent(shopId, 'loyalty.accrued', { points })
   - pricing.service.ts: trackEvent(shopId, 'rate_override.set')

5. apps/shopkeeper _layout.tsx: wrap with PosthogProvider (posthog-react-native).
   Config: EXPO_PUBLIC_POSTHOG_API_KEY. Add usePostHog().screen(routeName) in root
   navigation state listener.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Boot API with POSTHOG_API_KEY set. Create invoice. Verify event appears
in PostHog dashboard (or enable PostHog debug mode).

Non-negotiable rules:
- PostHog MUST be a no-op when POSTHOG_API_KEY is not set — never crash on missing key
- No PII in event properties (no customer names, PANs, phone numbers, addresses)
- shopId (UUID) is the PostHog distinctId in API events — never customer UUID
```

---

## PROMPT 1E — ADR Location Fix + tenant_sync_cursors RLS

```
You are doing two Class C fixes: (1) moving ADR files to the correct docs/adr/ path,
(2) adding an RLS policy to tenant_sync_cursors.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Haiku 4.5. If on higher tier suggest /model haiku.

Ceremony class: C — minimal ceremony.

Setup worktree FIRST:
  git worktree add C:/gs-fixes -b feat/story-fixes-adr-rls
  cd C:/gs-fixes && pnpm install

You exclusively own these files:
- docs/adr/ (new directory — create it)
- apps/api/migrations/0040_tenant_sync_cursors_rls.sql (new — migration NUMBER 0040 only)
- Any file referencing _bmad-output/planning-artifacts/adr/ paths (update references only)

No other files. Do not create or use any migration number other than 0040.

Task 1 — Move ADR files:
1. Create docs/adr/ directory.
2. Copy all 16 ADR markdown files from _bmad-output/planning-artifacts/adr/ to docs/adr/.
   Filenames stay the same (0001-*.md through 0016-*.md).
3. Search for any references to the old path in CLAUDE.md, README.md, any docs/ file —
   update all references to docs/adr/.
4. Commit: "docs: move ADRs from bmad-output to docs/adr per CLAUDE.md spec"

Task 2 — tenant_sync_cursors RLS:
5. Create apps/api/migrations/0040_tenant_sync_cursors_rls.sql:

   -- RLS was missing from tenant_sync_cursors. App layer scoped correctly via shop_id
   -- but no DB-level enforcement existed. This adds defence-in-depth.
   ALTER TABLE tenant_sync_cursors ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_sync_cursors_isolation ON tenant_sync_cursors
     USING (shop_id = current_setting('app.current_shop_id', TRUE)::uuid)
     WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::uuid);

6. Commit: "fix(rls): add row-level security policy to tenant_sync_cursors"

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

No runtime smoke test needed (doc move + migration — no runtime surface per CLAUDE.md
ceremony rules for doc-only/config-toggle-only changes).
```

---

## PROMPT 2A — Loyalty Completion (Redemption at Checkout + Tier Auto-Upgrade)

```
You are completing the loyalty program: wire point redemption into invoice checkout and
add a BullMQ job that auto-upgrades customer tiers based on rolling-12-month purchases.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 1 must be fully merged to main and pnpm typecheck/lint/test green
before starting this session.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-loyalty2 -b feat/story-loyalty-completion
  cd C:/gs-loyalty2 && pnpm install

Context:
Loyalty accrual (Story 8.1) is on main. customer_loyalty table (migration 0038),
loyalty_transactions (append-only ledger), BullMQ accrual worker all exist.
FR71 (redemption at checkout) and FR72 (tier auto-upgrade) are missing.
LoyaltyAdjustModal exists in CRM but is NOT wired into invoice creation.
Wave 1B added TCS calculation to billing.service.ts — your changes go AFTER that block.

You exclusively own these files:
- apps/api/src/modules/loyalty/loyalty.service.ts (add redeemPoints, checkAndUpgradeTier)
- apps/api/src/modules/loyalty/loyalty.processor.ts (add tier evaluation after accrual)
- apps/api/src/modules/billing/billing.service.ts — add loyalty redemption optional param AFTER the TCS block Wave 1B added. Do not modify TCS logic.
- apps/shopkeeper/src/features/billing/ — wire LoyaltyAdjustModal into new invoice screen

No migration needed — customer_loyalty has tier and points_balance columns already.

Implement:

1. loyalty.service.ts — redeemPoints({ customerId, shopId, pointsToRedeem, invoiceId }):
   SELECT ... FOR UPDATE on customer_loyalty row.
   Check points_balance >= pointsToRedeem — throw if not.
   Deduct points_balance, INSERT 'REDEEM' row into loyalty_transactions.
   All inside withTenantTx.

2. loyalty.service.ts — checkAndUpgradeTier(customerId, shopId):
   SUM loyalty_transactions EARN rows WHERE created_at > NOW() - INTERVAL '12 months'.
   Compare against shop_settings loyalty tier thresholds (gold_threshold_paise,
   silver_threshold_paise). UPDATE customer_loyalty.tier if changed. Best-effort (don't
   let tier update block invoice creation).

3. loyalty.processor.ts — after accruing points, call checkAndUpgradeTier(). Wrap in
   try/catch — tier evaluation failure must not fail the accrual job.

4. billing.service.ts — add optional loyaltyPointsToRedeem?: number to CreateInvoiceDto.
   If present and > 0, call redeemPoints() inside the invoice creation withTenantTx.
   Convert points to currency using shop_settings.loyalty_point_value_paise (default 1
   point = 1 paise if not configured). Apply as a discount to balance_due_paise.

5. Mobile — in the new invoice form, add a "लॉयल्टी पॉइंट" button. Opens
   LoyaltyAdjustModal, returns redeemed points count. Pass to invoice creation payload.

TDD: red → green → refactor, commit each cycle.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Create invoice with loyaltyPointsToRedeem > 0. Verify invoice
balance_due_paise is reduced, loyalty_transactions has a REDEEM row,
customer_loyalty.points_balance decreased.

Non-negotiable rules:
- Redemption MUST be atomic with invoice creation (same withTenantTx)
- FOR UPDATE on loyalty row — no double-spend race condition
- Tier update is best-effort async — must not block or fail invoice creation
- All amounts in paise (bigint), never FLOAT
```

---

## PROMPT 2B — Reports Dashboard

```
You are building the Reports Dashboard for the Goldsmith shopkeeper app. The Reports tab
is currently a PlaceholderScreen. Replace it with 5 actionable reports.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 1 must be fully merged to main before starting.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-reports -b feat/story-reports-dashboard
  cd C:/gs-reports && pnpm install

Context:
apps/shopkeeper/app/(tabs)/reports.tsx is a PlaceholderScreen.
FR113–FR118 require: daily sales summary, outstanding payments, customer LTV, inventory
aging, loyalty program summary. FR55 GSTR export already exists at GET /compliance/gstr
and should be linked from the Reports tab too.
No migration needed — all reports are aggregation queries over existing tables.

You exclusively own these files:
- apps/api/src/modules/reports/ (new NestJS module — full directory)
- apps/shopkeeper/app/(tabs)/reports.tsx (replace PlaceholderScreen)
- apps/shopkeeper/src/features/reports/ (new screens/components)

Implement:

1. ReportsModule (NestJS): ReportsService + ReportsController, registered in AppModule.

2. GET /reports/daily-summary?date=YYYY-MM-DD
   Returns: { total_paise, cash_paise, upi_paise, other_paise, invoice_count,
   gold_weight_mg } aggregated from invoices + payments for that shop + date.
   Weight from invoice_items (sum weight_mg where metal_type='GOLD').

3. GET /reports/outstanding
   Returns paginated list of invoices where balance_due_paise > 0, ordered by
   invoice_date desc. Join customers for name + phone.

4. GET /reports/customer-ltv?limit=20
   SUM total_paise per customer_id from invoices, join customers for name + phone,
   ORDER BY total DESC, LIMIT 20.

5. GET /reports/loyalty-summary
   { points_issued: SUM(amount) WHERE type='EARN', points_redeemed: SUM(ABS(amount))
   WHERE type='REDEEM', members_by_tier: COUNT(*) GROUP BY tier } from loyalty tables.

6. Reports tab (reports.tsx): Replace PlaceholderScreen with a SectionList of report cards.
   Each card: Hindi title, a key metric (today's total, outstanding count, top customer
   name), "देखें" (View) button navigating to a detail screen.
   Include a "GSTR निर्यात" card linking to existing gstr-export.tsx screen.

7. Individual detail screens: DailySummaryScreen, OutstandingScreen, CustomerLtvScreen,
   LoyaltySummaryScreen — each fetches its endpoint and renders a simple list or summary.

Design: Hindi-first labels. Large text (≥ 16pt body). Summary cards, no data tables.
Touch targets ≥ 48dp. 45-65 year old shopkeeper UX.

TDD: Test ReportsService aggregate arithmetic with mocked DB queries.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Boot Metro + API. Navigate to Reports tab. Daily Summary card shows
data for today. Outstanding list shows invoices with balance > 0.

Non-negotiable rules:
- All WHERE clauses include shop_id scoping (enforced inside withTenantTx — verify)
- Weight columns read as DECIMAL/bigint — never cast to FLOAT
- No cross-tenant data in any aggregate
```

---

## PROMPT 2C — HUID Exemption Categories

```
You are adding HUID exemption categories so that Kundan, Polki, Jadau, and sub-2g
products are correctly classified as hallmark-exempt and pass the HUID validation gate.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 1 must be fully merged to main before starting.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-huid2 -b feat/story-huid-exemptions
  cd C:/gs-huid2 && pnpm install

Context:
packages/compliance/src/huid/validate-presence.ts enforces HUID on "hallmarked" products
but has no exemption concept. BIS exemptions include Kundan/Polki/Jadau (cannot be
hallmarked by nature) and items under 2g net weight. Currently any product without a
HUID value is treated as "not hallmarked." We need an explicit exemption category field.
Migration 0041 is pre-assigned to this session.

You exclusively own these files:
- apps/api/migrations/0041_huid_exemption_category.sql (new — NUMBER 0041 only)
- apps/api/src/db/schema/products.ts (add huidExemptionCategory column)
- packages/compliance/src/huid/huid-exemption.ts (new — enum + helper)
- packages/compliance/src/huid/validate-presence.ts (update to honour exemption)
- apps/shopkeeper/src/features/inventory/new.tsx (add exemption picker UI)

Do not use any migration number other than 0041.

Implement:

1. Migration 0041:
   CREATE TYPE huid_exemption_category AS ENUM ('none', 'kundan_polki_jadau', 'under_2g');
   ALTER TABLE products
     ADD COLUMN huid_exemption_category huid_exemption_category NOT NULL DEFAULT 'none';

2. packages/compliance/src/huid/huid-exemption.ts:
   export enum HuidExemptionCategory { None = 'none', KundanPolkiJadau = 'kundan_polki_jadau', Under2g = 'under_2g' }
   export function isHuidExempt(cat: HuidExemptionCategory): boolean {
     return cat !== HuidExemptionCategory.None;
   }

3. validate-presence.ts: Update validateHuidPresence() — if product.huidExemptionCategory
   is not 'none', skip the HUID check entirely. Add tests for: exempt product with no HUID
   passes; non-exempt product with no HUID still throws.

4. apps/api/src/db/schema/products.ts: Add huidExemptionCategory column using the new enum.

5. inventory/new.tsx product form: Add "HUID छूट श्रेणी" picker below the HUID field.
   Options: "लागू नहीं" (none), "कुंदन/पोलकी/जड़ाऊ", "2 ग्राम से कम".
   Show only when product category is JEWELRY (not COIN or BULLION which are always
   exempt from hallmarking).

TDD: red → green → refactor, commit each cycle.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Create a product with huid_exemption_category='kundan_polki_jadau' (no
HUID value). Create an invoice with that product. Verify invoice completes without
HUID hard-block error.

Non-negotiable rules:
- Default is 'none' — existing products without an exemption still require HUID if hallmarked (backward compatible)
- Exemption is product-level, not invoice-line-level
- isHuidExempt() must live in packages/compliance — never inline in billing.service.ts
```

---

## PROMPT 3A — Estimate → Invoice Workflow

```
You are implementing the Estimate (proforma) to Invoice conversion workflow for Goldsmith.
Currently only direct invoice creation exists; no draft/estimate step.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 2 must be fully merged to main before starting.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-estimate -b feat/story-estimate-to-invoice
  cd C:/gs-estimate && pnpm install

Context:
FR41 requires the ability to generate a price estimate (proforma) before finalising.
FR42 requires converting that estimate to a final invoice. Jewellers show an estimate
to the customer, the customer agrees, then it becomes an invoice. Estimates have no
payment or compliance enforcement — those only trigger on conversion.
billing.service.ts now has TCS (1B) and loyalty redemption (2A) — add estimate
conversion AFTER those blocks, do not modify them.
Migration 0042 is pre-assigned to this session.

You exclusively own these files:
- apps/api/migrations/0042_estimates.sql (new — NUMBER 0042 only)
- apps/api/src/modules/billing/estimate.service.ts (new)
- apps/api/src/modules/billing/billing.service.ts — add convertEstimateToInvoice() method ONLY at the end; do not touch TCS or loyalty blocks
- apps/api/src/modules/billing/billing.controller.ts — add estimate endpoints
- apps/shopkeeper/src/features/billing/estimate/ (new screens)

Do not use any migration number other than 0042.

Implement:

1. Migration 0042 — estimates table:
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   shop_id UUID NOT NULL REFERENCES shops(id),
   customer_id UUID REFERENCES customers(id),
   line_items JSONB NOT NULL DEFAULT '[]',
   gold_rate_paise_per_gram BIGINT NOT NULL,
   subtotal_paise BIGINT NOT NULL,
   gst_paise BIGINT NOT NULL DEFAULT 0,
   total_paise BIGINT NOT NULL,
   status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','converted','expired')),
   expires_at TIMESTAMPTZ,
   converted_invoice_id UUID REFERENCES invoices(id),
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   Use tenantScopedTable() — RLS on shop_id.

2. estimate.service.ts: createEstimate(), getEstimate(id, shopId), listEstimates(shopId),
   expireEstimate(id, shopId). All within withTenantTx.

3. billing.controller.ts: POST /billing/estimates, GET /billing/estimates, GET /billing/estimates/:id,
   POST /billing/estimates/:id/convert.

4. billing.service.ts: convertEstimateToInvoice(estimateId, shopId) — fetch estimate, call
   createInvoice() with pre-filled line items and snapshotted gold rate from estimate,
   mark estimate status = 'converted' + set converted_invoice_id. All in one transaction.

5. Mobile screens:
   - NewEstimateScreen: same UI as new invoice but no payment section; "अनुमान बनाएं" button
   - EstimateDetailScreen: shows estimate, "Invoice में बदलें" button, expiry countdown
   - EstimateListScreen: list of recent estimates with status chips

TDD: red → green → refactor, commit each cycle.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Create estimate → POST /billing/estimates/:id/convert → verify estimate
status='converted', invoice exists with correct totals.

Non-negotiable rules:
- Estimates do NOT trigger 269ST, PAN, PMLA, TCS, or HUID checks — only invoice conversion does
- Gold rate is snapshotted at estimate creation time (not re-fetched on conversion)
- estimates table must use tenantScopedTable() — RLS enforced
- convertEstimateToInvoice is atomic (single withTenantTx) — no partial state
```

---

## PROMPT 3B — Product Viewing Analytics (FR64–68)

```
You are implementing the product viewing analytics foundation for Goldsmith (FR64–68).
Shopkeepers need to see which products customers view most, to inform pricing and inventory.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 2 must be fully merged to main before starting.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-analytics -b feat/story-viewing-analytics
  cd C:/gs-analytics && pnpm install

Context:
The viewing_consent table (migration 0037) already exists — it captures customer consent
for analytics tracking. This session adds the actual product_views event table and the
analytics read/write APIs. The catalog API has a TODO for full implementation; add a
POST view-recording endpoint on the catalog controller.
Migration 0043 is pre-assigned to this session.

You exclusively own these files:
- apps/api/migrations/0043_product_views.sql (new — NUMBER 0043 only)
- apps/api/src/modules/analytics/ (new NestJS module)
- apps/api/src/modules/catalog/catalog.controller.ts — add POST /catalog/products/:id/view ONLY; do not modify existing catalog endpoints
- apps/shopkeeper/src/features/inventory/analytics/ (new — ProductAnalyticsScreen)

Do not use any migration number other than 0043.

Implement:

1. Migration 0043 — product_views table:
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   shop_id UUID NOT NULL,
   product_id UUID NOT NULL REFERENCES products(id),
   customer_id UUID,
   session_id UUID NOT NULL,
   viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   duration_seconds INTEGER
   Use tenantScopedTable(). RLS on shop_id.
   CREATE INDEX ON product_views (product_id, viewed_at DESC);

2. analytics.service.ts:
   - recordView({ shopId, productId, customerId?, sessionId, durationSeconds? }):
     Only insert if a viewing_consent row exists for this customer+shop (or customerId is
     null for anonymous). Rate-limit: reject if same session_id viewed same product in
     last 30 seconds.
   - getProductViewSummary({ shopId, productId, days }): COUNT views, COUNT DISTINCT
     session_id (unique viewers), AVG duration_seconds for the period.

3. catalog.controller.ts — add POST /catalog/products/:id/view (public endpoint, no auth
   required). Extract session_id from request body. Call analytics.service.recordView.
   Apply IP-based rate limiting (use existing NestJS throttler if configured, otherwise
   add a simple in-memory TTL cache guard for the same IP+product within 60 seconds).

4. GET /analytics/products/:id/views (shopkeeper auth required). Returns view summary for
   30/90/365 day periods.

5. ProductAnalyticsScreen.tsx in shopkeeper app — accessible from product detail screen
   via an "Analytics" button. Shows: total views chart (react-native-svg line chart,
   same pattern as rates/history.tsx), unique viewers count, average view duration.

TDD: Test recordView saves row; test consent gate (no consent = no row); test
getProductViewSummary arithmetic; test duplicate session_id within 30s is rejected.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: POST /catalog/products/:id/view twice with same session_id (>30s apart).
GET /analytics/products/:id/views — verify count=2.

Non-negotiable rules:
- product_views MUST be tenant-scoped (shop_id FK + RLS)
- NEVER record views if customer has no viewing_consent for this shop
- session_id is client-generated — never use it for identity, only deduplication
- POST /catalog/products/:id/view must be rate-limited
```

---

## PROMPT 3C — Custom Orders (FR73–79, Class A)

```
You are implementing the Custom Orders module for Goldsmith. Class A — involves money
(deposits), Razorpay, and a multi-step lifecycle. Fresh session required.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: A — full ceremony. FRESH SESSION required (context quarantine).

PREREQUISITE: Wave 2 must be fully merged to main before starting.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-custom -b feat/story-custom-orders
  cd C:/gs-custom && pnpm install

Context:
FR73–79 require a full custom order lifecycle: customer requests design → shopkeeper
quotes → customer pays deposit → shopkeeper tracks milestones with photos → delivers →
converts to final invoice. Razorpay integration exists at apps/api/src/integrations/razorpay/
(from Story 5.7). Section 269SS enforcement (Wave 1C) exists in packages/compliance/src/
cash-restriction/ — use it for cash deposits ≥ Rs 20,000.
Migration 0044 is pre-assigned to this session.

You exclusively own these files:
- apps/api/migrations/0044_custom_orders.sql (new — NUMBER 0044 only)
- apps/api/src/modules/custom-orders/ (new NestJS module — full directory)
- apps/shopkeeper/src/features/custom-orders/ (new screens)
- apps/api/src/modules/billing/billing.service.ts — add convertCustomOrderToInvoice() at end ONLY; do not touch TCS, loyalty, or estimate methods

Do not use any migration number other than 0044.

Implement:

1. Migration 0044:
   custom_orders table: id, shop_id, customer_id, description TEXT, design_reference_url TEXT,
   quoted_amount_paise BIGINT, deposit_amount_paise BIGINT NOT NULL DEFAULT 0,
   deposit_paid_paise BIGINT NOT NULL DEFAULT 0, razorpay_order_id TEXT,
   razorpay_payment_id TEXT,
   status TEXT NOT NULL DEFAULT 'QUOTE' CHECK (status IN ('QUOTE','DEPOSIT_PENDING',
   'IN_PROGRESS','READY','DELIVERED','CANCELLED')),
   estimated_delivery_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

   custom_order_milestones table: id, custom_order_id UUID NOT NULL REFERENCES custom_orders(id),
   shop_id UUID NOT NULL, title TEXT NOT NULL, note TEXT, photo_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()

   Both tables: tenantScopedTable() — RLS on shop_id.

2. custom-orders.service.ts:
   - createOrder({ shopId, customerId, description, designReferenceUrl?, quotedAmountPaise })
   - createDepositOrder({ orderId, depositAmountPaise, paymentMethod: 'cash'|'razorpay' }):
     If cash: call enforce269ss(depositAmountPaise, 'deposit') from packages/compliance.
     If razorpay: create Razorpay order via existing integration, return order details.
   - recordCashDeposit({ orderId, amountPaise }): update deposit_paid_paise, status → IN_PROGRESS if fully paid
   - handleRazorpayWebhook({ orderId, razorpayPaymentId }): verify signature (use existing webhook verifier), update deposit_paid_paise, status → IN_PROGRESS
   - addMilestone({ orderId, shopId, title, note, photoUrl? })
   - markReady(orderId, shopId): status → READY
   - convertToInvoice(orderId, shopId): calls billing.service.ts createInvoice() with
     (quotedAmountPaise - deposit_paid_paise) as the invoice total. Status → DELIVERED.

3. custom-orders.controller.ts: POST /custom-orders, GET /custom-orders, GET /custom-orders/:id,
   POST /custom-orders/:id/deposit, POST /custom-orders/:id/milestones,
   PATCH /custom-orders/:id/ready, POST /custom-orders/:id/convert-to-invoice,
   POST /custom-orders/webhook (Razorpay)

4. Mobile screens:
   - CustomOrderListScreen: list with status chips (Hindi status labels)
   - NewCustomOrderScreen: description, design reference photo upload, quoted amount
   - CustomOrderDetailScreen: milestone timeline, deposit status, action buttons
   - AddMilestoneSheet: title, note, photo picker (uses Azure Blob via existing packages/integrations-storage)

5. billing.service.ts: convertCustomOrderToInvoice(orderId, shopId) — fetch order,
   call createInvoice() with remaining balance (quoted - deposit), mark order DELIVERED.

TDD: red → green → refactor, commit each cycle.

Review gate (Class A — run both simultaneously):
  codex review --base main → .codex-review-passed
  /security-review → .security-review-passed
Both markers required before pushing.

Runtime smoke: Create order → cash deposit (₹15,000 — below 269SS threshold) → add
milestone with note → mark ready → convert to invoice. Verify invoice total =
quoted - deposit. Try cash deposit ≥ ₹20,000 — verify 422 SECTION_269SS error.

Non-negotiable rules:
- Both tables tenant-scoped (shop_id FK + RLS via tenantScopedTable())
- Cash deposits enforce Section 269SS (packages/compliance/src/cash-restriction/)
- Razorpay webhook MUST verify signature before processing
- deposit_paid_paise is BIGINT — never FLOAT
- Photo URLs use Azure Blob Storage (packages/integrations-storage — existing adapter)
- WhatsApp milestone notifications: stub only — log "WhatsApp stub: milestone {id}" (AiSensy in Epic 13)
```

---

## PROMPT 4A — Rate-Lock Booking Flow (FR80–83, Class A)

```
You are implementing the rate-lock booking flow for Goldsmith. A customer pays a Razorpay
deposit to lock today's gold rate for a future purchase. Class A — money + Razorpay +
billing integration. Fresh session required.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Opus 4.7 — Class A with Razorpay money flow + billing.service.ts integration
+ rate-lock honor logic. Announce this on turn 1 and confirm with user.

Ceremony class: A — full ceremony. FRESH SESSION required.

PREREQUISITE: Wave 3 fully merged. billing.service.ts now has TCS (1B), loyalty (2A),
estimate conversion (3A) — your changes go AFTER all of these.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-ratelock -b feat/story-rate-lock-bookings
  cd C:/gs-ratelock && pnpm install

Context:
Settings store rate_lock_duration_hours (Story 2.5, shop_settings). Razorpay integration
exists (Story 5.7, apps/api/src/integrations/razorpay/). Missing: the booking entity,
deposit flow, and honor-on-invoice logic. Migration 0045 is pre-assigned to this session.

You exclusively own these files:
- apps/api/migrations/0045_rate_lock_bookings.sql (new — NUMBER 0045 only)
- apps/api/src/modules/rate-lock-bookings/ (new NestJS module)
- apps/api/src/modules/billing/billing.service.ts — add honorRateLockIfPresent() lookup ONLY after the estimate conversion method. Do not touch TCS, loyalty, or estimate blocks.
- apps/shopkeeper/src/features/rate-lock/ (new screens)

Do not use any migration number other than 0045.

Implement:

1. Migration 0045 — rate_lock_bookings table:
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   shop_id UUID NOT NULL, customer_id UUID NOT NULL REFERENCES customers(id),
   locked_rate_paise_per_gram BIGINT NOT NULL,
   locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   expires_at TIMESTAMPTZ NOT NULL,
   deposit_paid_paise BIGINT NOT NULL DEFAULT 0,
   razorpay_order_id TEXT, razorpay_payment_id TEXT,
   status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
     CHECK (status IN ('PENDING_PAYMENT','ACTIVE','USED','EXPIRED','CANCELLED'))
   tenantScopedTable(). CREATE INDEX ON rate_lock_bookings (customer_id, status, expires_at).

2. rate-lock-bookings.service.ts:
   - createBooking({ shopId, customerId, depositAmountPaise }):
     Fetch current rate from PricingService.getCurrentRatesForTenant(shopId).
     Fetch rate_lock_duration_hours from shop_settings.
     Create Razorpay order for deposit. Return Razorpay order + booking id.
   - handleWebhook({ bookingId, razorpayPaymentId }): Verify signature. On
     payment.captured: set status=ACTIVE, locked_rate from IBJA snapshot at booking time.
   - expireStaleBookings(): BullMQ scheduled job — UPDATE status='EXPIRED' WHERE
     expires_at < NOW() AND status='ACTIVE'.
   - honorRateLockIfPresent(customerId, shopId): Returns the locked_rate_paise_per_gram
     if an ACTIVE non-expired booking exists for this customer+shop, else null.

3. billing.service.ts: In createInvoice(), call honorRateLockIfPresent(customerId, shopId).
   If returns a locked rate, use it instead of current IBJA rate for price computation.
   Update booking status='USED' atomically within the same withTenantTx.

4. rate-lock-bookings.controller.ts: POST /rate-lock/bookings, GET /rate-lock/bookings,
   GET /rate-lock/bookings/:id, POST /rate-lock/bookings/webhook.

5. Mobile screens: RateLockListScreen (shopkeeper views active locks per customer),
   RateLockDetailScreen (locked rate, expiry countdown, status).

TDD: red → green → refactor, commit each cycle.

Review gate (Class A — run both simultaneously):
  codex review --base main → .codex-review-passed
  /security-review → .security-review-passed

Runtime smoke: Create rate-lock booking → simulate Razorpay webhook (payment.captured)
→ create invoice for that customer → verify invoice used locked rate, booking status=USED.
Try to use expired booking (set expires_at to past) — verify invoice uses current rate.

Non-negotiable rules:
- Razorpay webhook MUST verify signature (same pattern as Story 5.7)
- Rate-lock honor is atomic with invoice creation (same withTenantTx)
- Locked rate stored as BIGINT paise/gram — never FLOAT
- Expired bookings (expires_at < NOW()) must NEVER be honored — check expiry inside the transaction
- Rate-lock deposit is not a 269SS trigger (it is a commercial booking fee, not a loan/deposit in the legal sense)
```

---

## PROMPT 4B — Try-at-Home Booking Flow (FR84–85)

```
You are implementing the Try-at-Home booking flow for Goldsmith. A customer books selected
pieces to try at home before purchasing.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony. No money movement in the booking itself.

PREREQUISITE: Wave 3 fully merged.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-tryathome -b feat/story-try-at-home-bookings
  cd C:/gs-tryathome && pnpm install

Context:
Try-at-home toggle + piece count limit exist in settings (Story 2.6, shop_settings).
Missing: the booking entity and the dispatch/return lifecycle. Conversion to invoice
uses the existing createInvoice() path — no billing.service.ts changes needed here.
Migration 0046 is pre-assigned to this session.

You exclusively own these files:
- apps/api/migrations/0046_try_at_home_bookings.sql (new — NUMBER 0046 only)
- apps/api/src/modules/try-at-home-bookings/ (new NestJS module)
- apps/shopkeeper/src/features/try-at-home/ (new screens)

Do NOT touch billing.service.ts or any other existing file.
Do not use any migration number other than 0046.

Implement:

1. Migration 0046 — try_at_home_bookings table:
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   shop_id UUID NOT NULL, customer_id UUID NOT NULL REFERENCES customers(id),
   product_ids UUID[] NOT NULL DEFAULT '{}',
   status TEXT NOT NULL DEFAULT 'REQUESTED'
     CHECK (status IN ('REQUESTED','DISPATCHED','RETURNED','CONVERTED_TO_SALE','EXPIRED')),
   requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   dispatch_at TIMESTAMPTZ, return_due_at TIMESTAMPTZ, notes TEXT
   tenantScopedTable().

2. try-at-home-bookings.service.ts:
   - createBooking({ shopId, customerId, productIds, notes? }):
     Fetch try_at_home_max_pieces from shop_settings. Reject if productIds.length > max.
     Verify each product is PUBLISHED and AVAILABLE (not IN_TRY_AT_HOME or SOLD).
   - dispatchBooking(bookingId, shopId): status → DISPATCHED. For each productId, call
     existing PATCH /products/:id/status to move to IN_TRY_AT_HOME state (use the
     existing state machine — do not bypass it).
   - recordReturn({ bookingId, returnedProductIds, keptProductIds }): Move returned
     products back to AVAILABLE. Create invoice for kept products using existing
     POST /billing/invoices endpoint (call internally). Status → CONVERTED_TO_SALE.
     Mark remaining product_ids as RETURNED.

3. try-at-home-bookings.controller.ts: POST /try-at-home/bookings, GET /try-at-home/bookings,
   GET /try-at-home/bookings/:id, PATCH /try-at-home/bookings/:id/dispatch,
   POST /try-at-home/bookings/:id/record-return.

4. Mobile screens:
   - TryAtHomeListScreen: list with status chips
   - NewTryAtHomeBookingScreen: customer picker + product multi-select (up to max limit)
   - TryAtHomeDetailScreen: dispatched items list, "वापसी दर्ज करें" (Record Return) button,
     ReturnSheet for marking kept vs returned items

TDD: Test piece count limit enforcement; test dispatchBooking sets product status;
test recordReturn creates invoice for kept pieces.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Create booking (3 pieces) → dispatch → record return (1 kept, 2 returned).
Verify invoice created for 1 piece, 2 products back to AVAILABLE status.

Non-negotiable rules:
- table is tenant-scoped (shop_id FK + RLS via tenantScopedTable())
- Piece count limit enforced server-side — mobile validation is UI convenience only
- Dispatched products use the existing product state machine (PATCH /products/:id/status) — do not write to products table directly
```

---

## PROMPT 5A — Customer Web App Scaffold + Catalog API

```
You are scaffolding the customer-facing web application for Goldsmith and completing the
catalog API. First session of Epic 7.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 4 fully merged.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-cust-web -b feat/epic7-customer-web-scaffold
  cd C:/gs-cust-web && pnpm install

Context:
apps/customer-web/ does not exist. apps/api/src/modules/catalog/catalog.controller.ts
has a TODO comment for full implementation. The customer web app is a Next.js 14 App
Router application showing a white-label branded storefront — ZERO Goldsmith branding
visible to customers. Tech stack per CLAUDE.md: Next.js 14+, Tailwind CSS, shadcn/ui,
21st.dev for premium components, Noto Sans Devanagari for Indic text.

You exclusively own:
- apps/customer-web/ (create from scratch — Next.js 14 App Router)
- apps/api/src/modules/catalog/catalog.service.ts (complete implementation)
- apps/api/src/modules/catalog/catalog.controller.ts (wire product listing + detail + tenant-config endpoints)

Implement:

1. Scaffold apps/customer-web as a Next.js 14 App Router app. Add to Turborepo:
   - Tailwind CSS + shadcn/ui initialised
   - Import @goldsmith/ui-tokens for CSS variable theme
   - Font: Noto Sans Devanagari (next/font/google) as primary, not Inter or Space Grotesk
   - Add to turbo.json and root package.json workspaces

2. White-label theme resolution: GET /catalog/tenant-config endpoint (add to catalog
   controller) — resolves tenant from X-Shop-Slug header or subdomain, returns
   { primaryColor, logoUrl, appName, defaultLanguage }. Next.js layout reads this at
   request time (server component) and injects as CSS variables + metadata.

3. Catalog API — catalog.service.ts:
   - getProducts({ shopId, category?, search?, page, limit }): returns published products
     with computeProductPrice() applied at current gold rate (from PricingService).
     Include huid field, making_charges, wastage, categories.
   - getProduct(id, shopId): full product detail with computed price.

4. catalog.controller.ts: wire GET /catalog/products, GET /catalog/products/:id,
   GET /catalog/tenant-config. All public (no auth required — customer browsing).
   Rate-limit with NestJS throttler.

5. Customer web pages:
   - app/page.tsx (homepage): Hero with shop name + tagline, live gold rate card (from
     GET /catalog/rates), featured products grid (6 items, server component).
   - app/products/page.tsx: Category filter sidebar, product grid (12/page), search input.
   - app/products/[id]/page.tsx: Product image, Hindi name, HUID badge (if present),
     computed price, "इच्छा सूची में जोड़ें" button (stub — stub onClick shows toast).

Design: Hindi-first. Direction 05 — Yatra One for headings, Noto Sans Devanagari for
body, cream palette #F5EDDD background. Warm, trust-heavy aesthetic. Reference
_bmad-output/planning-artifacts/ux-design.md for direction. WCAG 2.1 AA throughout.
No cold Western tech aesthetics.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: pnpm dev in apps/customer-web. Browse to product listing. Verify products
show with Hindi labels, Noto Sans Devanagari font, computed prices. Check Lighthouse
a11y score ≥ 90.

Non-negotiable rules:
- ZERO Goldsmith platform branding visible on customer surfaces
- White-label theme applied via CSS variables from tenant config
- Noto Sans Devanagari — do not default to Inter or Space Grotesk
- All catalog queries scoped to the requesting tenant's shop_id
- computeProductPrice() used for all price display — never expose raw DB fields
```

---

## PROMPT 5B — Customer Mobile App Scaffold + Auth

```
You are scaffolding the customer-facing mobile application for Goldsmith and implementing
customer phone OTP authentication.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony. Customer auth reuses existing Firebase Auth +
NestJS JWT strategy pattern exactly — no new auth infrastructure.

PREREQUISITE: Wave 4 fully merged.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-cust-mob -b feat/epic7-customer-mobile-scaffold
  cd C:/gs-cust-mob && pnpm install

Context:
apps/customer-mobile/ does not exist. apps/shopkeeper/ has the complete Firebase OTP
auth pattern — follow it exactly. Customer auth uses the same Firebase project + NestJS
/auth/session endpoint (already supports customer role). The customer app is a white-label
Expo RN app. Migration 0048 is pre-assigned if any customer-side schema additions are
needed (e.g., device_tokens for push).

Windows build constraint (from CLAUDE.md): If paths exceed 260 chars during Android
build, copy to C:/gscm and build from there with public-hoist-pattern[]=* in that
copy's .npmrc only — never add to real repo .npmrc.

You exclusively own:
- apps/customer-mobile/ (create from scratch — Expo SDK 50+, NativeWind)
- apps/api/migrations/0048_customer_device_tokens.sql (if push tokens needed — NUMBER 0048 only)

Implement:

1. Scaffold apps/customer-mobile as Expo SDK 50+ app with NativeWind + Expo Router.
   Add to Turborepo workspace. Font: Noto Sans Devanagari (expo-font), not Inter.

2. White-label: tenant theme resolved on app launch via GET /catalog/tenant-config
   (shopSlug from deep link or env var EXPO_PUBLIC_SHOP_SLUG). Store in React Context.
   Apply primary_color, logo_url, app_name throughout — Goldsmith brand NEVER visible.

3. Auth flow (copy pattern from apps/shopkeeper/src/features/auth/):
   - PhoneScreen → Firebase signInWithPhoneNumber → OtpScreen → confirm() → POST /auth/session
   - Session stored in SecureStore under key 'customer_session'
   - useCustomerSession() hook — same pattern as shopkeeper's useSession()
   - On token expiry, call POST /auth/refresh

4. Home screen (post-auth): Live gold rate card (GET /catalog/rates), featured products
   2-column grid (GET /catalog/products?limit=6), categories horizontal scroll row.

5. Tab navigation: Home | Browse | Wishlist (placeholder) | Profile.

6. Profile screen: Customer name + phone, loyalty points card (GET /loyalty/balance/:customerId),
   "डेटा हटाएं" DPDPA button (POST /crm/customers/:id/request-deletion).

7. Migration 0048 (only if FCM device tokens need storing):
   customer_device_tokens: id, customer_id, shop_id, fcm_token, created_at
   tenantScopedTable().

Design: Hindi-first. Direction 05 theme. Customer audience: 25-45 millennial + pilgrim
tourist + wedding shopper — premium visual quality, rival Tanishq/CaratLane.
Touch targets ≥ 44pt iOS / ≥ 48dp Android.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Boot Metro from C:/gscm (short path) if needed. OTP auth flow on device.
Home screen shows products. White-label theme applies (test with a mock tenant config).

Non-negotiable rules:
- ZERO Goldsmith branding visible to customer
- useCustomerSession() must mirror shopkeeper's session pattern exactly
- Auth token stored in SecureStore — never AsyncStorage
- Noto Sans Devanagari — do not default to Inter
```

---

## PROMPT 5C — Customer Browse + Product Detail + HUID QR Scan

```
You are building the product browse and detail experience for the Goldsmith customer app
(both mobile and web), including HUID QR verification for customer trust.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 5 Round A (5A + 5B) fully merged.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-browse -b feat/epic7-browse-huid-qr
  cd C:/gs-browse && pnpm install

Context:
5A built the Next.js customer web scaffold with basic product listing + detail pages.
5B built the Expo customer mobile scaffold with home screen. This session adds:
- Full browse/filter/search experience (both web + mobile)
- Rich product detail page with all pricing, HUID info, making charges breakdown
- HUID QR scan feature: customer scans the BIS hallmark QR on the physical piece to
  verify it matches the product record (uses the Surepass HUID verification API wrapper
  from packages/integrations or adds a simple verify endpoint).
No new migrations needed — uses existing products + catalog API.

You exclusively own:
- apps/customer-web/app/products/ (update existing pages from 5A — no new routes)
- apps/customer-web/src/components/browse/ (new browse components)
- apps/customer-mobile/app/browse/ (new browse screens)
- apps/api/src/modules/catalog/catalog.controller.ts — add GET /catalog/products/:id/verify-huid ONLY

Implement:

1. Web — enhanced product listing (app/products/page.tsx):
   Category filter: horizontal chip row (mobile) / sidebar (desktop). Price range slider.
   Metal type filter (gold/diamond/silver). Hindi labels for all filters.
   Search input with debounce calling GET /catalog/products?search=.
   Infinite scroll or pagination (Show More button — simpler for senior UX).

2. Web — enhanced product detail (app/products/[id]/page.tsx):
   Full price breakdown: metal value + making charges + wastage + GST (3%+5%) = total.
   HUID badge with "BIS प्रमाणित" label if HUID present. Hallmark category.
   Image gallery (if multiple images). "कोशिश घर पर" try-at-home button (links to
   booking flow if shop has try-at-home enabled). "दर-लॉक बुकिंग" rate-lock button.

3. Mobile — BrowseScreen (app/browse/index.tsx):
   Category tabs. Product grid. Search bar. Filters bottom sheet.

4. Mobile — ProductDetailScreen (app/browse/[id].tsx):
   Same content as web detail. HUID QR Scan button (opens camera via expo-camera).
   On scan: POST /catalog/products/:id/verify-huid with the QR payload.

5. API — GET /catalog/products/:id/verify-huid:
   Accepts the scanned QR content (BIS hallmark QR encodes HUID + certifying body).
   Extracts HUID from QR payload. Compares against products.huid in DB.
   Returns { verified: boolean, huid: string, certifyingBody: string }.
   Surepass API call is optional (stub with a comment if API key not configured).

TDD: Test verify-huid endpoint: matching HUID → verified=true; mismatched → verified=false.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Open customer web. Filter by category. View product detail. Check price
breakdown is correct. On mobile, scan a HUID QR from any BIS-hallmarked piece to test
the verification flow.

Non-negotiable rules:
- All price display uses computeProductPrice() — never raw DB fields
- HUID QR verification does not require customer to be logged in (public endpoint)
- Hindi labels throughout — not translated English
- WCAG 2.1 AA on web — keyboard navigation for all filter controls
```

---

## PROMPT 5D — Customer-Side Flows (Loyalty Display + Rate-Lock + Try-at-Home Booking)

```
You are implementing the customer-side booking and loyalty flows for the Goldsmith customer
app — loyalty tier display, rate-lock booking, and try-at-home request.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: A — involves Razorpay payment from customer side and token money flows.
FRESH SESSION required.

PREREQUISITE: Wave 5 Round A (5A + 5B) fully merged. Rate-lock bookings (4A) and
try-at-home bookings (4B) are on main — all backend APIs exist.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-cust-flows -b feat/epic7-customer-flows
  cd C:/gs-cust-flows && pnpm install

Context:
Backend APIs for rate-lock (POST /rate-lock/bookings, webhook) and try-at-home
(POST /try-at-home/bookings) exist from Wave 4. Loyalty balance (GET /loyalty/balance/:id)
exists from Story 8.1. This session wires the customer-facing UI for all three flows.
Migration 0049 pre-assigned if any customer-facing schema additions needed.

You exclusively own:
- apps/customer-mobile/app/loyalty/ (new loyalty screens)
- apps/customer-mobile/app/rate-lock/ (new rate-lock screens)
- apps/customer-mobile/app/try-at-home/ (new try-at-home screens)
- apps/customer-web/app/loyalty/ (new loyalty page)
- apps/customer-web/app/rate-lock/ (new rate-lock page)
- apps/customer-web/app/try-at-home/ (new try-at-home page)

Implement:

1. Loyalty — mobile LoyaltyScreen (app/loyalty/index.tsx):
   Points balance, current tier badge, progress bar to next tier, recent transactions list.
   Uses GET /loyalty/balance/:customerId (auth required).
   LoyaltyCard component from Story 8.1a already exists in shopkeeper — adapt for customer.

2. Loyalty — web /loyalty page: Same info, server component for SSR, polished card design.

3. Rate-lock booking — mobile RateLockScreen (app/rate-lock/index.tsx):
   Shows current gold rate. "दर-लॉक करें" button. Confirms deposit amount. Opens
   Razorpay checkout (use @razorpay/razorpay-react-native or WebView with Razorpay URL).
   On payment success: POST /rate-lock/bookings with Razorpay payment details.
   Shows confirmation with locked rate + expiry date.

4. Rate-lock booking — web /rate-lock page: Same flow using Razorpay.js for web.

5. Try-at-home — mobile TryAtHomeScreen (app/try-at-home/index.tsx):
   Browse available products (those with shop's try-at-home enabled).
   Select up to max_pieces (from GET /catalog/tenant-config). Submit request.
   POST /try-at-home/bookings. Shows confirmation with expected dispatch timeline.

6. Try-at-home — web /try-at-home page: Same flow.

TDD: Test Razorpay success callback triggers POST /rate-lock/bookings correctly.
Test try-at-home piece count limit enforced on mobile before API call.

Review gate (Class A — run both simultaneously):
  codex review --base main → .codex-review-passed
  /security-review → .security-review-passed

Runtime smoke: Customer logs in → opens rate-lock flow → completes Razorpay test
payment → verify booking created with status ACTIVE. Open try-at-home → select pieces →
submit → verify booking in shopkeeper's try-at-home list.

Non-negotiable rules:
- Razorpay payment captured server-side via webhook — never trust client payment confirmation
- Loyalty balance shows after auth only (never anonymous)
- All amounts display in formatted rupees — never show raw paise to customers
- Hindi UI throughout — no English defaults
```

---

## PROMPT 5E — Reviews + Wishlist + Size Guides + Policy Display

```
You are implementing product reviews, wishlist, size guides, and policy display for the
Goldsmith customer-facing app (web + mobile).

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: B — compressed ceremony.

PREREQUISITE: Wave 5 Round A (5A + 5B) fully merged.

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-reviews -b feat/epic7-reviews-wishlist
  cd C:/gs-reviews && pnpm install

Context:
FR100–106 require: product reviews (FR100-102), size guides (FR103-104), wishlist
(FR105), return/exchange policy display (FR106). Migration 0047 pre-assigned.

You exclusively own:
- apps/api/migrations/0047_reviews_wishlist.sql (new — NUMBER 0047 only)
- apps/api/src/modules/reviews/ (new NestJS module)
- apps/api/src/modules/wishlist/ (new NestJS module)
- apps/customer-web/app/products/ (add reviews section, wishlist button to existing pages)
- apps/customer-mobile/app/browse/ (add reviews + wishlist to product detail)

Do not use any migration number other than 0047.

Implement:

1. Migration 0047:
   product_reviews table: id, shop_id, product_id UUID REFERENCES products(id),
   customer_id UUID REFERENCES customers(id), rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
   review_text TEXT, created_at TIMESTAMPTZ DEFAULT NOW().
   tenantScopedTable(). CREATE INDEX ON product_reviews (product_id).

   wishlists table: id, shop_id, customer_id UUID REFERENCES customers(id),
   product_id UUID REFERENCES products(id), created_at TIMESTAMPTZ DEFAULT NOW().
   UNIQUE (shop_id, customer_id, product_id). tenantScopedTable().

2. reviews.service.ts: createReview({ shopId, productId, customerId, rating, reviewText }),
   listReviews({ shopId, productId }): returns reviews with customer first name (not full name
   — privacy), average rating.

3. wishlist.service.ts: addToWishlist({ shopId, customerId, productId }),
   removeFromWishlist({ shopId, customerId, productId }),
   listWishlist({ shopId, customerId }).

4. API routes: POST /reviews, GET /products/:id/reviews (public — no auth for reading),
   POST /wishlist, DELETE /wishlist/:productId, GET /wishlist (auth required).

5. Web — product detail page: Add star rating display + review count. Review submission
   form (auth required). Wishlist heart button (toggle, auth required).

6. Mobile — product detail: Same review section + wishlist toggle.

7. Wishlist tab (app/wishlist/ on mobile, /wishlist on web): List of wishlisted products
   with current computed prices. "बैग से हटाएं" remove button.

8. Size guides: Static content per category stored as MDX/JSON in apps/customer-web/content/
   size-guides/. Categories: rings (Indian sizes 1–30), bangles (diameter in mm), chains
   (length in inches). Render at /size-guide/[category] on web, SizeGuideScreen on mobile.

9. Policy display: GET /catalog/return-policy (add to catalog controller) — reads from
   shop_settings.return_policy_text. Render on web at /return-policy, mobile at PolicyScreen.

TDD: Test createReview saves; test listReviews returns correct average; test wishlist
toggle (add/remove/re-add); test policy endpoint returns shop-specific text.

Before pushing:
  pnpm typecheck && pnpm lint && pnpm test
  codex review --base main → .codex-review-passed

Runtime smoke: Submit a review for a product. Check review appears on product detail page
with correct star rating. Add product to wishlist. Navigate to wishlist tab — product appears.
View size guide for rings.

Non-negotiable rules:
- Reviews and wishlists are tenant-scoped (shop_id FK + RLS)
- Review display shows customer first name only (never full name or phone)
- Wishlist requires auth — anonymous wishlist not supported in MVP
- Size guides are static content — never fetched from DB
- Return policy display reads from shop_settings (shopkeeper-configurable) — never hardcoded
```

---

## PROMPT 6A — Platform Admin Console (FR120–126, Class A)

```
You are implementing the Platform Admin Console for Goldsmith. This allows the platform
team to manage jeweller tenants, subscriptions, and provide support access.
Class A — cross-tenant + impersonation = highest security risk. Fresh session required.

Read first (in order):
1. C:\Alok\Business Projects\Goldsmith\CLAUDE.md
2. C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\MEMORY.md

Model tier: Sonnet 4.6.

Ceremony class: A — full ceremony. FRESH SESSION required.

PREREQUISITE: Wave 4 merged. Can run in parallel with Wave 5 (it is a separate surface).

Setup worktree FIRST:
  git -C "C:\Alok\Business Projects\Goldsmith" pull
  git worktree add C:/gs-admin -b feat/story-platform-admin-console
  cd C:/gs-admin && pnpm install

Context:
No platform admin controller exists today. tenant-boot/ handles tenant lookup only.
FR120–126: tenant CRUD (create/update/suspend), subscription management, impersonation
(platform admin acts as a tenant for support debugging), cross-tenant metrics,
data portability/export. Migrations 0053–0055 are pre-assigned to this session.

You exclusively own:
- apps/api/migrations/0053_platform_subscriptions.sql (NUMBER 0053)
- apps/api/migrations/0054_platform_audit_update.sql (NUMBER 0054)
- apps/api/migrations/0055_impersonation_sessions.sql (NUMBER 0055)
- apps/api/src/modules/platform-admin/ (new NestJS module — full directory)
- apps/api/src/auth/ — extend existing guards to add platform_admin role + impersonation JWT claim (read all existing guard files before touching any)

Do not use any migration number other than 0053, 0054, 0055.

Implement:

1. Migration 0053 — platform_subscriptions:
   id, shop_id UUID REFERENCES shops(id) UNIQUE, plan TEXT NOT NULL DEFAULT 'trial'
   CHECK (plan IN ('trial','starter','growth','enterprise')),
   status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
   billing_cycle_start DATE, mrr_paise BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()

2. Migration 0054 — ensure platform_audit_events table has: platform_user_id TEXT,
   target_shop_id UUID, action TEXT, metadata JSONB, created_at TIMESTAMPTZ.
   (May already exist — check before ALTER; add missing columns only.)

3. Migration 0055 — impersonation_sessions:
   id UUID PRIMARY KEY, platform_user_id TEXT NOT NULL, target_shop_id UUID NOT NULL REFERENCES shops(id),
   started_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
   ended_at TIMESTAMPTZ, reason TEXT NOT NULL

4. PlatformAdminModule: separate NestJS module loaded only when role='platform_admin'.

5. TenantManagementService: createShop(), updateShop(), suspendShop(shopId, reason),
   unsuspendShop(shopId), listShops({ page, search }). All write to platform_audit_events.

6. SubscriptionService: upsertSubscription(shopId, plan, mrrPaise), listSubscriptions().

7. MetricsService: getMetrics() — total shops, active shops, invoices created in last 30
   days (cross-tenant aggregate — use raw pool query with explicit comment explaining
   the intentional RLS bypass and why it is safe).

8. ImpersonationService:
   - startImpersonation({ platformUserId, targetShopId, reason }):
     Creates impersonation_sessions row with expires_at = NOW() + 30 minutes.
     Returns a short-lived JWT with impersonating_shop_id claim.
     Logs to platform_audit_events: action='impersonation.started'.
   - endImpersonation(sessionId, platformUserId): Sets ended_at, logs 'impersonation.ended'.
   - The NestJS TenantContextInterceptor: detect impersonating_shop_id claim in JWT.
     If present, SET LOCAL app.current_shop_id = impersonating_shop_id (instead of the
     platform user's own shop). Verify the impersonation session is active and not expired.

9. PlatformAdminController: All routes under /platform/admin/* require platform_admin role.
   POST /platform/admin/tenants, GET /platform/admin/tenants, PATCH /platform/admin/tenants/:id,
   POST /platform/admin/tenants/:id/suspend, POST /platform/admin/tenants/:id/unsuspend,
   GET /platform/admin/metrics, POST /platform/admin/impersonate, DELETE /platform/admin/impersonate/:sessionId.

10. Minimal admin UI: Add /admin route to customer-web (protected by platform_admin JWT).
    Simple table of tenants with status badges. Suspend/unsuspend buttons. Impersonate button.
    (Or as a standalone Next.js page in apps/customer-web/app/admin/ with its own layout.)

TDD: Test suspendShop writes to platform_audit_events; test impersonation JWT changes GUC;
test expired impersonation session is rejected; test metrics query returns cross-tenant counts.

Review gate (Class A — run both simultaneously):
  codex review --base main → .codex-review-passed
  /security-review → .security-review-passed
Both markers required before pushing.

Runtime smoke: Create new tenant via POST /platform/admin/tenants. Start impersonation.
Create an invoice as that tenant. Verify platform_audit_events has impersonation.started +
invoice.created (with impersonated shop context). End impersonation. Verify impersonation.ended
logged. Try to use expired impersonation session — verify 401.

Non-negotiable rules:
- platform_admin role is NEVER grantable via the shopkeeper invite flow — separate
  provisioning path only (manual DB seeding for now, documented in runbook)
- Impersonation is time-bounded (30 min max) + fully audited — no silent perpetual access
- Cross-tenant queries in MetricsService MUST have a comment explaining the intentional
  bypass: // PLATFORM_ADMIN_BYPASS: intentional cross-tenant read; safe because this
  // endpoint requires platform_admin role and returns only aggregate counts, no PII.
- Data portability export (GET /platform/admin/tenants/:id/export) must return ALL customer
  PII for that tenant only — scoped export, not cross-tenant
- All platform admin actions logged to platform_audit_events (not per-tenant audit_events)
```

---

## After All Waves: Final Verification

Once all waves are merged and main is green:

```bash
# Full health check
pnpm typecheck && pnpm lint && pnpm test

# FR coverage spot-check — verify the 3 statutory gaps are closed
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/v1/compliance/str-template
# → should return STR template with shop details

# Verify TCS on large invoice
# Create B2C invoice > Rs 2L via API, check tcs_collected_paise > 0

# Verify 269SS blocks cash advance ≥ Rs 20,000
# POST to cash advance endpoint with amount 20000+ rupees, expect 422

# Run Lighthouse on customer web homepage
npx lighthouse http://localhost:3001 --output json --only-categories=accessibility,performance

# Run axe-core a11y suite
pnpm test --filter=@goldsmith/shopkeeper -- --testPathPattern=a11y

# Verify PostHog receives events
# Create invoice with POSTHOG_API_KEY set, check PostHog dashboard
```
