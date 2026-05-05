# WS-3A — Reports Completion (FR117 + FR119)

**Date:** 2026-05-05
**Ceremony class:** B
**Story type:** Feature completion (back-end-heavy + light shopkeeper UI)
**Migration reserved:** 0072 (`reports_pdf_exports`)
**Latest migration on main:** 0059
**Plan source:** `C:\Users\alokt\.claude\plans\you-are-a-principal-distributed-alpaca.md` § WS-3A
**Memory pointers:** `feedback_audit_pattern_pool_not_tx.md`, `feedback_tsx_inject_di.md`, `feedback_auto_accept_recommendations.md`

---

## 1. Problem

Two PRD gaps in the reports module:

- **FR117** — inventory aging report bucketed by `<30d / 30-60d / 60-90d / 90d+`. Distinct from the existing `InventoryDeadStockService`, which returns a flat list of products past `dead_stock_threshold_days` (no buckets, no in-stock items younger than threshold).
- **FR119** — CSV **and** PDF export for every report. Today only GSTR has a CSV path (sync, plus a queued worker that uploads to storage). The four JSON-only reports (`daily-summary`, `outstanding`, `customer-ltv`, `loyalty-summary`) and the new `stock-aging` report have no export path at all.

## 2. Decisions locked during brainstorming

| # | Decision | Rationale |
|---|---|---|
| D1 | **PDFKit** for PDF rendering | Pure-JS, no Chromium dep, fits Azure Container Apps consumption tier and floor-cost MVP rule (CLAUDE.md). |
| D2 | **CSV sync, PDF async** | Hybrid: CSV is small (≤ low-thousands of rows) and a CA wants it instantly; PDF rendering takes seconds and benefits from job audit + retry. |
| D3 | **Stock-aging response = `{ buckets, items }`** | One round-trip serves both the dashboard tile (buckets) and the drill-down screen (items). |
| D4 | **GSTR stays CSV-only this story** | Out of scope; existing CSV satisfies the workflow (Tally, GST portal). PDF is a binder-copy nice-to-have for a follow-up. |
| D5 | **Blob retention = 7 days, row retention = 90 days** | URL is short-lived and **re-signed on every poll** (URL TTL is whatever the storage adapter defaults to — minutes, not days). The 7-day clock is the blob's GC deadline (`created_at + interval '7 days'`). After that, `regenerate` re-renders. |
| D6 | **Polling readiness UX** | `GET /reports/exports/:id` every 2s. No notifications-module entanglement; mirrors GSTR job pattern. |
| D7 | **Stock-aging is pure age data** | No `suggestedAction` field — that lives in `InventoryDeadStockService`. UI flags the 90d+ bucket visually. |
| D8 | **Branding from `shops` columns** | `display_name`, `logo_url`, `address_json`, `gstin`, `contact_phone` already exist (migration 0006). No new branding columns. |
| D9 | **RBAC = shop_admin + shop_manager** | Matches existing `/api/v1/reports/*` routes. |
| D10 | **4 work streams** (TDD per WS) | Class B target ~2-3 hrs/story; WS-A (stock-aging) and WS-B (CSV) can run in parallel; WS-C (PDF pipeline) blocks WS-D (UI). |

## 3. Architecture

```
HTTP                                  Worker (BullMQ)
─────                                 ───────────────
GET  /reports/stock-aging  ─┐
GET  /reports/*.csv         ├─► ReportsService (sync)
POST /reports/exports       ─┘
                             │
                             ▼
                     reports_pdf_exports row (QUEUED)
                             │
                             ▼
                     reports-pdf TenantQueue
                             │
                             ▼
                  ReportsPdfProcessor.handle()
                             │
                             ├─► ReportsService.fetch<X>(params)
                             ├─► PdfRenderer.render<X>(data, branding)
                             ├─► STORAGE_PORT.uploadBuffer(key, pdf)
                             ├─► getPresignedReadUrl(key)
                             └─► UPDATE reports_pdf_exports SET status=READY...

GET  /reports/exports/:id              ◄── client polls every 2s
POST /reports/exports/:id/regenerate   ◄── re-sign or re-render
```

**Reused infrastructure** (all already on main):
- `@goldsmith/queue` — `TenantQueue`, `createTenantWorker`
- `@goldsmith/integrations-storage` — `STORAGE_PORT`, `uploadBuffer`, `getPresignedReadUrl`
- `@goldsmith/db` — `withTenantTx`
- `@goldsmith/tenant-context` — `tenantContext.runWith` for worker boundary (mirrors `gstr-export.processor.ts:38`)
- `@goldsmith/audit` — `auditLog(this.pool, {...})` per `feedback_audit_pattern_pool_not_tx.md`

## 4. Data model — migration 0072

```sql
CREATE TABLE reports_pdf_exports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  report_type           TEXT NOT NULL CHECK (report_type IN
                          ('daily-summary','outstanding','customer-ltv',
                           'loyalty-summary','stock-aging')),
  params                JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN
                          ('QUEUED','RUNNING','READY','FAILED')),
  storage_key           TEXT,
  error_message         TEXT,
  requested_by_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX reports_pdf_exports_shop_created_idx
  ON reports_pdf_exports (shop_id, created_at DESC);

ALTER TABLE reports_pdf_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_pdf_exports FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_reports_pdf_exports_tenant ON reports_pdf_exports
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON reports_pdf_exports TO app_user;
```

CSV exports do **not** insert a row — they are sync streams and leave no audit beyond `auditLog`.

## 5. API surface

All under `/api/v1/reports`. Roles: `shop_admin`, `shop_manager`.

| Method | Path | Purpose |
|---|---|---|
| **GET** | `/stock-aging` | FR117 — `{ buckets, items }` JSON |
| GET | `/daily-summary.csv?date=YYYY-MM-DD` | sync CSV |
| GET | `/outstanding.csv` | sync CSV (full list, no pagination on CSV) |
| GET | `/customer-ltv.csv?limit=N` | sync CSV |
| GET | `/loyalty-summary.csv` | sync CSV |
| GET | `/stock-aging.csv` | sync CSV (items array) |
| **POST** | `/exports` | body `{reportType, params}` → `{id, status:'QUEUED'}` |
| **GET** | `/exports/:id` | `{id, reportType, status, downloadUrl?, expiresAt?, errorMessage?}` |
| **POST** | `/exports/:id/regenerate` | re-sign or re-render |

CSV responses use `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename="<report>-<date>.csv"`.

## 6. Stock-aging contract (FR117)

```typescript
interface StockAgingBucket {
  label: '<30d' | '30-60d' | '60-90d' | '90d+';
  count: number;
  totalWeightMg: string;   // bigint-as-text
  totalCostPaise: string;  // bigint-as-text; null products excluded from sum
}

interface StockAgingItem {
  id: string;
  sku: string;
  metal: 'GOLD' | 'SILVER' | 'PLATINUM' | string;
  purity: string;
  weightG: string;
  daysInStock: number;
  bucket: StockAgingBucket['label'];
  costPaise: string | null;
  firstListedAt: string;  // ISO
}

interface StockAgingResult {
  buckets: StockAgingBucket[];
  items: StockAgingItem[];
}
```

**SQL outline** (run inside `withTenantTx` so RLS scopes by `app.current_shop_id`; do **not** add an explicit `shop_id = $1` filter — that would shadow the RLS predicate and is the anti-pattern flagged by `goldsmith.require-tenant-transaction` semgrep):
```sql
WITH aged AS (
  SELECT id, sku, metal, purity,
         gross_weight_g::text AS weight_g,
         cost_paise::text     AS cost_paise,
         created_at,
         FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int AS days_in_stock
  FROM products
  WHERE status = 'IN_STOCK'
)
SELECT *,
       CASE
         WHEN days_in_stock <  30 THEN '<30d'
         WHEN days_in_stock <  60 THEN '30-60d'
         WHEN days_in_stock <  90 THEN '60-90d'
         ELSE                          '90d+'
       END AS bucket
FROM aged
ORDER BY days_in_stock DESC;
```

Buckets aggregated in TS (single pass over `items`); avoids a second SQL query and keeps SQL simple. `cost_paise` may be NULL for legacy products (Story 3.1 added it but didn't backfill); aggregation skips nulls.

## 7. PDF rendering

- **Module location:** `apps/api/src/modules/reports/pdf/`
  - `renderer.ts` — exposes `PdfRenderer.render(reportType, data, branding) → Promise<Buffer>`
  - `templates/daily-summary.ts`, `outstanding.ts`, `customer-ltv.ts`, `loyalty-summary.ts`, `stock-aging.ts`
  - `branding.ts` — loads `shops.{display_name, logo_url, address_json, gstin, contact_phone}`
  - `header.ts`, `footer.ts` — shared layout primitives
- **Font:** Noto Sans Devanagari TTF committed at `packages/ui-tokens/fonts/NotoSansDevanagari-Regular.ttf` (and `-Bold.ttf`); registered via `doc.registerFont('Devanagari', ...)`. If not already in repo for RN, WS-C ships it.
- **Layout pattern:**
  - Header (every page): logo (40pt height; downloaded once per job, cached in closure) + display_name (Devanagari Bold 18pt) + report title (Devanagari 14pt) + generated_at (10pt right-aligned)
  - Body: PDFKit tables drawn with `text()` + `moveTo/lineTo`. Column widths fixed per template.
  - Footer (every page): `address_json.line1`, `address_json.line2`, `GSTIN: <gstin>`, `Page N of M` right-aligned.
- **Logo fetch:** if `logo_url` is a tenant blob key (starts with `tenants/`), use `STORAGE_PORT.downloadBuffer`; else the PDF skips the logo (no external HTTP fetch from the worker — keeps the worker network-egress-bounded).

## 8. CSV emission

- **File:** `apps/api/src/modules/reports/reports.csv.ts`
- One pure function per report: `toDailySummaryCsv(data) → string`, etc.
- Reuses `escapeCsv` + `csvRow` shape from `gstr-export.service.ts:43-52`. **YAGNI:** duplicate locally for now; only extract to `packages/shared` if a third caller appears.
- CSVs use `\r\n` line endings (matches GSTR export precedent for Excel compatibility) and a header row.

## 9. Worker

- **File:** `apps/api/src/workers/reports-pdf.processor.ts`
- Mirrors `gstr-export.processor.ts` 1:1:
  - `@Processor('reports-pdf')` + `extends WorkerHost`
  - Constructor injects `ReportsService`, `PdfRenderer`, `STORAGE_PORT`, `'PG_POOL'`, `BrandingLoader`
  - **Tenant boundary:** builds `TenantContext` from `job.data.shopId` + a `shops` lookup, then `tenantContext.runWith(ctx, ...)` wraps the service call. Same `eslint-disable goldsmith/no-raw-shop-id-param` comment, with the same justification copied from the GSTR processor.
  - **Status transitions** in `withTenantTx`:
    1. `UPDATE reports_pdf_exports SET status='RUNNING' WHERE id = $1 AND status = 'QUEUED'` (idempotent — if already RUNNING/READY, skip)
    2. fetch + render + upload
    3. `UPDATE ... SET status='READY', storage_key=$2, completed_at=now()`
    4. on error: `UPDATE ... SET status='FAILED', error_message=$2, completed_at=now()`
  - **Idempotency:** if the row is already `READY` on entry, the worker no-ops (BullMQ retry + at-least-once delivery safety).
- **Bull queue name:** `reports-pdf`. Registered in `ReportsModule` via `BullModule.registerQueue({ name: 'reports-pdf' })` and processor in worker entry `apps/api/src/workers.ts` (verify exact bootstrap during impl).

## 10. Polling + regenerate

- `GET /reports/exports/:id` returns:
  ```typescript
  {
    id, reportType, status,
    downloadUrl?: string,    // freshly signed if status===READY and blob still within retention
    blobExpiresAt?: string,  // created_at + interval '7 days' as ISO; null if blob unreachable
    errorMessage?: string,
  }
  ```
  Re-signs on every GET when `status===READY` and `now() < created_at + interval '7 days'` so the URL is fresh. If `now() >= created_at + interval '7 days'`, `downloadUrl` is omitted and the client should call `regenerate`.
- `POST /reports/exports/:id/regenerate`:
  - if blob is still within the 7-day window → just re-sign (returns `{downloadUrl, blobExpiresAt}` immediately)
  - else → enqueue a fresh worker job against the same row (resets `status='QUEUED'`, clears `storage_key`, `error_message`, `completed_at`; bumps `created_at` so the new 7-day clock starts)
- **Blob GC** is out of scope this story — Azure Blob lifecycle policy or a separate ops cron job will prune `tenants/<shop>/reports/**` blobs older than 7 days. Documented as a follow-up.

## 11. Audit

Every export operation calls `auditLog(this.pool, { action, subjectType: 'report', subjectId: id, actorUserId, after })`:

- `REPORT_EXPORT_REQUESTED` on POST `/exports`
- `REPORT_EXPORT_REGENERATED` on POST `/exports/:id/regenerate`
- (Sync CSV downloads don't audit — high volume, low value, matches existing `/api/v1/reports/*` JSON pattern.)

The exact `AuditAction` enum slot is verified during impl; if absent, WS-C adds the entries to `packages/audit/src/types.ts`.

## 12. Error handling

| Surface | Failure | Response |
|---|---|---|
| Validation | `date` not `YYYY-MM-DD`, unknown `reportType`, etc. | `400` with `{ code: 'reports.<x>.invalid_<y>' }` (matches `reports.service.ts:53`) |
| Worker | render or upload throws | row `→ FAILED`, `error_message` set, BullMQ retries N=3 with backoff, then `OnWorkerEvent('failed')` logs |
| Polling | export not found (cross-tenant attempt) | `404` (RLS filters it out) |
| Regenerate | row in `QUEUED`/`RUNNING` | `409` `{ code: 'reports.export.busy' }` |
| Regenerate | blob 404 | re-render path; row reset to `QUEUED` |

## 13. Testing

- **WS-A unit:** stock-aging boundary cases (29d, 30d, 89d, 90d), empty store, mixed metals, products with NULL `cost_paise`, products with multiple statuses
- **WS-B unit:** CSV emission for each of 5 reports — header row, special-character escaping, empty result, large numerics (paise as bigint)
- **WS-C integration:** queue → processor → row transitions; failure path with retry; idempotent retry on already-READY row; regenerate happy + blob-missing paths
- **WS-C tenant isolation:** `pnpm test:tenant-isolation` walker hits `reports_pdf_exports` (RLS denial)
- **WS-D UI:** export-button states (idle → queued → polling → ready → download-triggered); regenerate from ready row; error toast on FAILED
- **PDF renderer:** snapshot-style buffer-length test (PDF binary diffs are noisy; assert non-empty + magic header `%PDF-`); template smoke for each report type

## 14. Work streams

| WS | Description | Key files |
|---|---|---|
| **WS-A — Stock-aging endpoint** | `getStockAging()` in `reports.service.ts`; new GET route in `reports.controller.ts`; unit tests | `apps/api/src/modules/reports/reports.service.ts`, `reports.controller.ts`, `reports.service.spec.ts` |
| **WS-B — CSV sync exports** | `reports.csv.ts` with 5 emitters; 5 GET `.csv` routes; tests | `apps/api/src/modules/reports/reports.csv.ts`, `reports.controller.ts`, `reports.csv.spec.ts` |
| **WS-C — PDF async pipeline** | Migration 0072; `reports-export.service.ts` (enqueue + polling + regenerate); `reports-pdf.processor.ts`; PDFKit renderer + 5 templates + branding loader + Devanagari font asset; controller routes for `/exports*` | `packages/db/src/migrations/0072_reports_pdf_exports.sql`, `apps/api/src/modules/reports/reports-export.service.ts`, `apps/api/src/workers/reports-pdf.processor.ts`, `apps/api/src/modules/reports/pdf/**`, `apps/api/src/modules/reports/reports.controller.ts`, `reports.module.ts`, `apps/api/src/workers.ts` (registration) |
| **WS-D — Shopkeeper UI** | New `app/reports/stock-aging.tsx`; export buttons (CSV/PDF) on the 5 existing report screens; polling hook `useReportExport(exportId)`; regenerate sheet | `apps/shopkeeper/app/reports/stock-aging.tsx`, `apps/shopkeeper/app/reports/{daily-summary,outstanding,customer-ltv,loyalty-summary}.tsx`, `apps/shopkeeper/src/hooks/useReportExport.ts`, `apps/shopkeeper/app/reports/_layout.tsx` |

WS-A and WS-B run in parallel. WS-C blocks WS-D. TDD inside each WS (red → green → refactor). No fresh sessions required (Class B; same-session default).

## 15. Out of scope (explicit non-goals)

- GSTR PDF export
- Customer-web report exports (admin console only currently has tenant-overview reports — separate epic)
- Scheduled/recurring reports (cron-driven daily emails)
- Email/WhatsApp delivery of finished PDFs
- Per-tenant logo upload UI (uses whatever is already in `shops.logo_url`; if null, branding falls back to text-only header)
- Backfilling `products.cost_paise` for legacy rows (stock-aging tolerates nulls)
- Blob GC cron / Azure Blob lifecycle policy for `tenants/<shop>/reports/**` (follow-up ops story; 7-day retention is documented but not enforced this story — manageable by hand for the anchor jeweller, formalised at scale)
- Row-level GC of `reports_pdf_exports` past 90 days (same follow-up; table volume is bounded — at ~10 exports/day/shop × 90d = 900 rows/shop, no urgency)

## 16. Review gate (Class B)

Per CLAUDE.md ceremony tiering:

1. TDD per work stream
2. **Codex limit window — substitute gate:** `/code-review` + `/security-review` + CI pass
3. Runtime smoke: shopkeeper app boots, stock-aging screen renders, CSV download succeeds, PDF queue → ready cycle succeeds (Metro on Moto G via `C:\gs-api-start.cmd`)
4. `git push`
5. Codex round when limit resets — fold any P1/P2 fixes into a follow-up commit, then merge

## 17. Migration ordering

Migration `0072_reports_pdf_exports.sql` is reserved by the architecture plan even though `0060–0071` are unused. Honouring the plan slot — landing as `0072` keeps the plan's reserved range coherent and lets the gap reflect future-reserved batches. **Action:** WS-C ships the file as `0072_reports_pdf_exports.sql`; do not renumber.
