# WS-3A — Reports Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship FR117 (stock-aging endpoint with `<30d / 30-60d / 60-90d / 90d+` buckets) and FR119 (CSV+PDF export for `daily-summary`, `outstanding`, `customer-ltv`, `loyalty-summary`, `stock-aging`) — sync CSV downloads + async PDFKit-rendered PDFs delivered via BullMQ + signed URL.

**Architecture:** New endpoints alongside the existing `apps/api/src/modules/reports/`. CSV is sync (controller streams `text/csv`). PDF is async: `POST /reports/exports` inserts a row in `reports_pdf_exports` (migration 0072) and enqueues a `reports-pdf` BullMQ job; the processor renders via PDFKit, uploads to `STORAGE_PORT`, and updates the row. Client polls `GET /reports/exports/:id`. Mirrors the existing `apps/api/src/workers/gstr-export.processor.ts` pattern 1:1.

**Tech Stack:** NestJS + `@nestjs/bullmq` + Drizzle/pg + `pdfkit` (new dep) + Noto Sans Devanagari TTFs + `@goldsmith/integrations-storage` + `@goldsmith/audit`. Mobile: Expo + TanStack Query.

**Spec:** `docs/superpowers/specs/2026-05-05-ws-3a-reports-completion-design.md` (commit `41753e3`)

---

## File structure

### Create (22 files)

| Path | Responsibility |
|---|---|
| `packages/db/src/migrations/0072_reports_pdf_exports.sql` | Job table + RLS + grants |
| `apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf` | Devanagari font (binary) |
| `apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf` | Devanagari bold (binary) |
| `apps/api/src/modules/reports/reports.csv.ts` | Pure CSV emitters per report |
| `apps/api/src/modules/reports/reports.csv.spec.ts` | CSV emitter unit tests |
| `apps/api/src/modules/reports/reports-export.service.ts` | Enqueue / poll / regenerate orchestration |
| `apps/api/src/modules/reports/reports-export.service.spec.ts` | Export-service unit tests |
| `apps/api/src/modules/reports/pdf/branding.ts` | Fetches `shops.{display_name, logo_url, address_json, gstin}` |
| `apps/api/src/modules/reports/pdf/header.ts` | `drawHeader(doc, branding)` |
| `apps/api/src/modules/reports/pdf/footer.ts` | `drawFooter(doc, branding, pageNum, totalPages)` |
| `apps/api/src/modules/reports/pdf/renderer.ts` | `PdfRenderer.render(reportType, data, branding) → Buffer` |
| `apps/api/src/modules/reports/pdf/renderer.spec.ts` | Buffer-shape tests for each template |
| `apps/api/src/modules/reports/pdf/templates/daily-summary.ts` | PDFKit layout |
| `apps/api/src/modules/reports/pdf/templates/outstanding.ts` | PDFKit layout |
| `apps/api/src/modules/reports/pdf/templates/customer-ltv.ts` | PDFKit layout |
| `apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts` | PDFKit layout |
| `apps/api/src/modules/reports/pdf/templates/stock-aging.ts` | PDFKit layout |
| `apps/api/src/workers/reports-pdf.processor.ts` | BullMQ processor |
| `apps/api/src/workers/reports-pdf.processor.spec.ts` | Processor unit tests |
| `apps/shopkeeper/app/reports/stock-aging.tsx` | New mobile screen |
| `apps/shopkeeper/src/features/reports/useReportExport.ts` | Polling hook for export readiness |
| `apps/shopkeeper/src/features/reports/components/ExportButtons.tsx` | Reusable CSV/PDF buttons |

### Modify (9 files)

| Path | What changes |
|---|---|
| `apps/api/package.json` | Add `pdfkit` + `@types/pdfkit` |
| `apps/api/src/modules/reports/reports.service.ts` | Add `getStockAging()` + types |
| `apps/api/src/modules/reports/reports.service.spec.ts` | Add stock-aging tests |
| `apps/api/src/modules/reports/reports.controller.ts` | Add 1 stock-aging GET + 5 `.csv` GETs + 3 `/exports*` routes |
| `apps/api/src/modules/reports/reports.module.ts` | Wire `BullModule.registerQueue('reports-pdf')`, `StorageModule`, new providers, processor |
| `packages/audit/src/audit-actions.ts` | Add `REPORT_EXPORT_REQUESTED`, `REPORT_EXPORT_REGENERATED` |
| `apps/shopkeeper/src/features/reports/useReports.ts` | Add `useStockAging` |
| `apps/shopkeeper/app/reports/_layout.tsx` | Add stock-aging route |
| `apps/shopkeeper/app/reports/daily-summary.tsx` (+ outstanding, customer-ltv, loyalty-summary, gstr-export) | Render `<ExportButtons>` |

---

## Work streams overview

| WS | Tasks | Description |
|---|---|---|
| **WS-A** | A1 – A2 | Stock-aging endpoint (FR117) |
| **WS-B** | B1 – B6 | CSV sync exports for 5 reports (FR119 CSV half) |
| **WS-C** | C1 – C13 | PDF async pipeline (migration, fonts, deps, branding, templates, service, processor, module wiring) |
| **WS-D** | D1 – D5 | Shopkeeper UI: stock-aging screen + export-button plumbing |

WS-A and WS-B are independent and can run in parallel. WS-C blocks WS-D's export buttons. TDD per task.

---

# WS-A — Stock-aging endpoint (FR117)

## Task A1: Implement `ReportsService.getStockAging`

**Files:**
- Modify: `apps/api/src/modules/reports/reports.service.ts`
- Test: `apps/api/src/modules/reports/reports.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/modules/reports/reports.service.spec.ts` (append after the last `describe` block):

```typescript
// ---------------------------------------------------------------------------
// getStockAging
// ---------------------------------------------------------------------------
describe('getStockAging', () => {
  it('aggregates products into 4 age buckets with counts and totals', async () => {
    fakeTx = {
      query: vi.fn().mockResolvedValue({
        rows: [
          // <30d
          { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K', weight_g: '5.000',
            cost_paise: '5000000', created_at: new Date(Date.now() - 10 * 86400_000), days_in_stock: 10, bucket: '<30d' },
          { id: 'p2', sku: 'R-002', metal: 'GOLD', purity: '22K', weight_g: '3.000',
            cost_paise: '3000000', created_at: new Date(Date.now() - 20 * 86400_000), days_in_stock: 20, bucket: '<30d' },
          // 30-60d
          { id: 'p3', sku: 'C-001', metal: 'SILVER', purity: '92.5', weight_g: '50.000',
            cost_paise: '500000', created_at: new Date(Date.now() - 45 * 86400_000), days_in_stock: 45, bucket: '30-60d' },
          // 60-90d
          { id: 'p4', sku: 'C-002', metal: 'GOLD', purity: '22K', weight_g: '4.000',
            cost_paise: null, created_at: new Date(Date.now() - 75 * 86400_000), days_in_stock: 75, bucket: '60-90d' },
          // 90d+
          { id: 'p5', sku: 'B-001', metal: 'GOLD', purity: '22K', weight_g: '8.000',
            cost_paise: '8000000', created_at: new Date(Date.now() - 120 * 86400_000), days_in_stock: 120, bucket: '90d+' },
        ],
      }),
    };

    const svc = makeService();
    const result = await svc.getStockAging();

    expect(result.buckets).toHaveLength(4);
    const byLabel = Object.fromEntries(result.buckets.map((b) => [b.label, b]));
    expect(byLabel['<30d']!.count).toBe(2);
    expect(byLabel['<30d']!.totalWeightMg).toBe('8000');     // (5 + 3) * 1000
    expect(byLabel['<30d']!.totalCostPaise).toBe('8000000'); // 5000000 + 3000000
    expect(byLabel['30-60d']!.count).toBe(1);
    expect(byLabel['60-90d']!.count).toBe(1);
    expect(byLabel['60-90d']!.totalCostPaise).toBe('0');     // null cost excluded
    expect(byLabel['90d+']!.count).toBe(1);
    expect(result.items).toHaveLength(5);
    expect(result.items[0]!.bucket).toBeDefined();
  });

  it('returns all 4 buckets even when some are empty', async () => {
    fakeTx = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const svc = makeService();
    const result = await svc.getStockAging();
    expect(result.buckets).toHaveLength(4);
    expect(result.buckets.every((b) => b.count === 0)).toBe(true);
    expect(result.items).toEqual([]);
  });

  it('boundary: 29d → <30d, 30d → 30-60d, 89d → 60-90d, 90d → 90d+', async () => {
    fakeTx = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { id: 'a', sku: 'A', metal: 'GOLD', purity: '22K', weight_g: '1.000',
            cost_paise: '100000', created_at: new Date(), days_in_stock: 29, bucket: '<30d' },
          { id: 'b', sku: 'B', metal: 'GOLD', purity: '22K', weight_g: '1.000',
            cost_paise: '100000', created_at: new Date(), days_in_stock: 30, bucket: '30-60d' },
          { id: 'c', sku: 'C', metal: 'GOLD', purity: '22K', weight_g: '1.000',
            cost_paise: '100000', created_at: new Date(), days_in_stock: 89, bucket: '60-90d' },
          { id: 'd', sku: 'D', metal: 'GOLD', purity: '22K', weight_g: '1.000',
            cost_paise: '100000', created_at: new Date(), days_in_stock: 90, bucket: '90d+' },
        ],
      }),
    };
    const svc = makeService();
    const result = await svc.getStockAging();
    const byLabel = Object.fromEntries(result.buckets.map((b) => [b.label, b]));
    expect(byLabel['<30d']!.count).toBe(1);
    expect(byLabel['30-60d']!.count).toBe(1);
    expect(byLabel['60-90d']!.count).toBe(1);
    expect(byLabel['90d+']!.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @goldsmith/api test reports.service.spec
```

Expected: FAIL — `svc.getStockAging is not a function`.

- [ ] **Step 3: Implement `getStockAging`**

Add to `apps/api/src/modules/reports/reports.service.ts` (append types near the other interfaces, then add the method to the class):

```typescript
// Append to interfaces block
export type StockAgingBucketLabel = '<30d' | '30-60d' | '60-90d' | '90d+';

export interface StockAgingBucket {
  label: StockAgingBucketLabel;
  count: number;
  totalWeightMg: string;
  totalCostPaise: string;
}

export interface StockAgingItem {
  id: string;
  sku: string;
  metal: string;
  purity: string;
  weightG: string;
  daysInStock: number;
  bucket: StockAgingBucketLabel;
  costPaise: string | null;
  firstListedAt: string;
}

export interface StockAgingResult {
  buckets: StockAgingBucket[];
  items: StockAgingItem[];
}

const BUCKET_ORDER: StockAgingBucketLabel[] = ['<30d', '30-60d', '60-90d', '90d+'];
```

Add the method to the `ReportsService` class (next to the others):

```typescript
async getStockAging(): Promise<StockAgingResult> {
  return withTenantTx(this.pool, async (tx) => {
    const r = await tx.query<{
      id: string;
      sku: string;
      metal: string;
      purity: string;
      weight_g: string;
      cost_paise: string | null;
      created_at: Date;
      days_in_stock: number;
      bucket: StockAgingBucketLabel;
    }>(
      // RLS scopes by app.current_shop_id; do NOT add WHERE shop_id = $1
      // (would shadow RLS predicate; flagged by goldsmith.require-tenant-transaction).
      `WITH aged AS (
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
       ORDER BY days_in_stock DESC`,
      [],
    );

    const items: StockAgingItem[] = r.rows.map((row) => ({
      id:             row.id,
      sku:            row.sku,
      metal:          row.metal,
      purity:         row.purity,
      weightG:        row.weight_g,
      daysInStock:    row.days_in_stock,
      bucket:         row.bucket,
      costPaise:      row.cost_paise,
      firstListedAt:  row.created_at.toISOString(),
    }));

    // Aggregate buckets in one pass; ensure all 4 labels present even if empty.
    const agg = new Map<StockAgingBucketLabel, { count: number; weightMg: bigint; costPaise: bigint }>();
    for (const label of BUCKET_ORDER) {
      agg.set(label, { count: 0, weightMg: 0n, costPaise: 0n });
    }
    for (const item of items) {
      const bucket = agg.get(item.bucket)!;
      bucket.count += 1;
      // weight_g is "X.YYY"; convert to milligrams via string→bigint to preserve precision.
      const [whole, frac = '000'] = item.weightG.split('.');
      const mg = BigInt(whole!) * 1000n + BigInt(frac.padEnd(3, '0').slice(0, 3));
      bucket.weightMg += mg;
      if (item.costPaise !== null) bucket.costPaise += BigInt(item.costPaise);
    }

    const buckets: StockAgingBucket[] = BUCKET_ORDER.map((label) => {
      const a = agg.get(label)!;
      return {
        label,
        count:          a.count,
        totalWeightMg:  a.weightMg.toString(),
        totalCostPaise: a.costPaise.toString(),
      };
    });

    return { buckets, items };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @goldsmith/api test reports.service.spec
```

Expected: PASS — all `getStockAging` tests green plus the existing 9 tests untouched.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/reports.service.ts apps/api/src/modules/reports/reports.service.spec.ts
git commit -m "feat(ws-3a): add ReportsService.getStockAging with bucket aggregation"
```

---

## Task A2: Add `GET /reports/stock-aging` route

**Files:**
- Modify: `apps/api/src/modules/reports/reports.controller.ts`

- [ ] **Step 1: Add the route**

Open `apps/api/src/modules/reports/reports.controller.ts` and:

1. Update the import line at the top to include the new types:
```typescript
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem, LoyaltySummaryResult,
  StockAgingResult,
} from './reports.service';
```

2. Append a new method below `getLoyaltySummary`:
```typescript
@TenantWalkerRoute({ expectedStatus: 200 })
@Get('/stock-aging')
@Roles('shop_admin', 'shop_manager')
getStockAging(): Promise<StockAgingResult> {
  return this.svc.getStockAging();
}
```

- [ ] **Step 2: Verify typecheck + endpoint walker**

```bash
pnpm --filter @goldsmith/api typecheck
pnpm --filter @goldsmith/api test:e2e
```

Expected: typecheck PASS; endpoint-walker PASS (the new route is auto-discovered via `@TenantWalkerRoute` decorator and probed for cross-tenant denial — `expectedStatus: 200` means the walker expects a 200 response from a properly tenanted call, which is correct because there are no required query params or body).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/reports/reports.controller.ts
git commit -m "feat(ws-3a): wire GET /reports/stock-aging route"
```

---

# WS-B — CSV sync exports (FR119 CSV half)

## Task B1: Create `reports.csv.ts` with `toDailySummaryCsv`

**Files:**
- Create: `apps/api/src/modules/reports/reports.csv.ts`
- Create: `apps/api/src/modules/reports/reports.csv.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/reports/reports.csv.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { toDailySummaryCsv } from './reports.csv';
import type { DailySummaryResult } from './reports.service';

describe('toDailySummaryCsv', () => {
  it('emits header + one data row with paise→rupees conversion', () => {
    const data: DailySummaryResult = {
      date: '2026-04-29',
      total_paise:    '500000',
      cash_paise:     '300000',
      upi_paise:      '200000',
      other_paise:    '0',
      invoice_count:  3,
      gold_weight_mg: '15000',
    };

    const csv = toDailySummaryCsv(data);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe(
      'Date,Total (Rs),Cash (Rs),UPI (Rs),Other (Rs),Invoice Count,Gold Sold (g)',
    );
    expect(lines[1]).toBe('2026-04-29,5000.00,3000.00,2000.00,0.00,3,15.000');
    expect(lines).toHaveLength(2);
  });

  it('emits zeros when no invoices', () => {
    const data: DailySummaryResult = {
      date: '2026-04-01',
      total_paise: '0', cash_paise: '0', upi_paise: '0', other_paise: '0',
      invoice_count: 0, gold_weight_mg: '0',
    };
    const csv = toDailySummaryCsv(data);
    expect(csv.split('\r\n')[1]).toBe('2026-04-01,0.00,0.00,0.00,0.00,0,0.000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: FAIL — `Cannot find module './reports.csv'`.

- [ ] **Step 3: Implement `reports.csv.ts` skeleton + `toDailySummaryCsv`**

Create `apps/api/src/modules/reports/reports.csv.ts`:

```typescript
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem,
  LoyaltySummaryResult, StockAgingResult,
} from './reports.service';

// Shared helpers — duplicated locally rather than extracted to packages/shared per
// YAGNI; if a third caller appears, hoist these into @goldsmith/shared.
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map((c) => escapeCsv(String(c))).join(',');
}

function paiseToRupees(paise: bigint | string | number): string {
  return (Number(paise) / 100).toFixed(2);
}

function mgToGrams(mg: bigint | string | number): string {
  return (Number(mg) / 1000).toFixed(3);
}

const LE = '\r\n'; // Excel-friendly

export function toDailySummaryCsv(data: DailySummaryResult): string {
  const header = csvRow([
    'Date', 'Total (Rs)', 'Cash (Rs)', 'UPI (Rs)', 'Other (Rs)',
    'Invoice Count', 'Gold Sold (g)',
  ]);
  const row = csvRow([
    data.date,
    paiseToRupees(data.total_paise),
    paiseToRupees(data.cash_paise),
    paiseToRupees(data.upi_paise),
    paiseToRupees(data.other_paise),
    data.invoice_count,
    mgToGrams(data.gold_weight_mg),
  ]);
  return [header, row].join(LE);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
git commit -m "feat(ws-3a): add toDailySummaryCsv emitter"
```

---

## Task B2: Add `toOutstandingCsv`

**Files:**
- Modify: `apps/api/src/modules/reports/reports.csv.ts`
- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:

```typescript
import { toOutstandingCsv } from './reports.csv';

describe('toOutstandingCsv', () => {
  it('escapes commas in customer names and emits all rows', () => {
    const data: OutstandingResult = {
      total: 2, page: 1, limit: 100,
      items: [
        {
          id: 'inv-1', invoice_number: 'GS-2026-0001',
          customer_name: 'Sharma, Ramesh', customer_phone: '9876543210',
          total_paise: '100000', balance_due_paise: '50000',
          issued_at: '2026-04-01T10:00:00.000Z',
        },
        {
          id: 'inv-2', invoice_number: 'GS-2026-0002',
          customer_name: 'राज कुमार', customer_phone: null,
          total_paise: '200000', balance_due_paise: '200000',
          issued_at: '2026-04-02T14:30:00.000Z',
        },
      ],
    };
    const csv = toOutstandingCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'Invoice Number,Customer Name,Customer Phone,Total (Rs),Balance Due (Rs),Issued At',
    );
    expect(lines[1]).toBe(
      'GS-2026-0001,"Sharma, Ramesh",9876543210,1000.00,500.00,2026-04-01T10:00:00.000Z',
    );
    expect(lines[2]).toBe(
      'GS-2026-0002,राज कुमार,,2000.00,2000.00,2026-04-02T14:30:00.000Z',
    );
  });

  it('emits header only when no items', () => {
    const data: OutstandingResult = { total: 0, page: 1, limit: 100, items: [] };
    expect(toOutstandingCsv(data).split('\r\n')).toHaveLength(1);
  });
});
```

Add `OutstandingResult` to the existing `import type` line at the top:
```typescript
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem,
  LoyaltySummaryResult, StockAgingResult,
} from './reports.service';
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: FAIL — `Cannot find name 'toOutstandingCsv'`.

- [ ] **Step 3: Implement `toOutstandingCsv`**

Append to `apps/api/src/modules/reports/reports.csv.ts`:

```typescript
export function toOutstandingCsv(data: OutstandingResult): string {
  const header = csvRow([
    'Invoice Number', 'Customer Name', 'Customer Phone',
    'Total (Rs)', 'Balance Due (Rs)', 'Issued At',
  ]);
  const rows = data.items.map((it) =>
    csvRow([
      it.invoice_number,
      it.customer_name,
      it.customer_phone ?? '',
      paiseToRupees(it.total_paise),
      paiseToRupees(it.balance_due_paise),
      it.issued_at ?? '',
    ]),
  );
  return [header, ...rows].join(LE);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
git commit -m "feat(ws-3a): add toOutstandingCsv emitter"
```

---

## Task B3: Add `toCustomerLtvCsv`

**Files:**
- Modify: `apps/api/src/modules/reports/reports.csv.ts`
- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:

```typescript
import { toCustomerLtvCsv } from './reports.csv';

describe('toCustomerLtvCsv', () => {
  it('emits header + data rows sorted by descending LTV (input order preserved)', () => {
    const data: CustomerLtvItem[] = [
      { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
      { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
    ];
    const csv = toCustomerLtvCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Customer ID,Name,Phone,Lifetime Value (Rs)');
    expect(lines[1]).toBe('c1,रमेश सिंह,9900000001,20000.00');
    expect(lines[2]).toBe('c2,सुमन देवी,9900000002,15000.00');
  });

  it('emits header only when no customers', () => {
    expect(toCustomerLtvCsv([]).split('\r\n')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: FAIL — `Cannot find name 'toCustomerLtvCsv'`.

- [ ] **Step 3: Implement `toCustomerLtvCsv`**

Append to `apps/api/src/modules/reports/reports.csv.ts`:

```typescript
export function toCustomerLtvCsv(items: CustomerLtvItem[]): string {
  const header = csvRow(['Customer ID', 'Name', 'Phone', 'Lifetime Value (Rs)']);
  const rows = items.map((c) =>
    csvRow([c.customer_id, c.name, c.phone, paiseToRupees(c.ltv_paise)]),
  );
  return [header, ...rows].join(LE);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
git commit -m "feat(ws-3a): add toCustomerLtvCsv emitter"
```

---

## Task B4: Add `toLoyaltySummaryCsv`

**Files:**
- Modify: `apps/api/src/modules/reports/reports.csv.ts`
- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:

```typescript
import { toLoyaltySummaryCsv } from './reports.csv';

describe('toLoyaltySummaryCsv', () => {
  it('emits a 2-section CSV: totals header+row, blank line, per-tier breakdown', () => {
    const data: LoyaltySummaryResult = {
      points_issued: 5000,
      points_redeemed: 1200,
      members_by_tier: [
        { tier: 'GOLD',   count: 12 },
        { tier: 'SILVER', count: 8  },
        { tier: null,     count: 3  },
      ],
    };
    const csv = toLoyaltySummaryCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Points Issued,Points Redeemed,Net Points');
    expect(lines[1]).toBe('5000,1200,3800');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('Tier,Member Count');
    expect(lines[4]).toBe('GOLD,12');
    expect(lines[5]).toBe('SILVER,8');
    expect(lines[6]).toBe('UNTIERED,3');
  });

  it('emits empty tier list cleanly', () => {
    const data: LoyaltySummaryResult = {
      points_issued: 0, points_redeemed: 0, members_by_tier: [],
    };
    const csv = toLoyaltySummaryCsv(data);
    const lines = csv.split('\r\n');
    expect(lines).toEqual([
      'Points Issued,Points Redeemed,Net Points',
      '0,0,0',
      '',
      'Tier,Member Count',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: FAIL — `Cannot find name 'toLoyaltySummaryCsv'`.

- [ ] **Step 3: Implement `toLoyaltySummaryCsv`**

Append to `apps/api/src/modules/reports/reports.csv.ts`:

```typescript
export function toLoyaltySummaryCsv(data: LoyaltySummaryResult): string {
  const totalsHeader = csvRow(['Points Issued', 'Points Redeemed', 'Net Points']);
  const totalsRow = csvRow([
    data.points_issued,
    data.points_redeemed,
    data.points_issued - data.points_redeemed,
  ]);
  const tierHeader = csvRow(['Tier', 'Member Count']);
  const tierRows = data.members_by_tier.map((t) =>
    csvRow([t.tier ?? 'UNTIERED', t.count]),
  );
  return [totalsHeader, totalsRow, '', tierHeader, ...tierRows].join(LE);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
git commit -m "feat(ws-3a): add toLoyaltySummaryCsv emitter"
```

---

## Task B5: Add `toStockAgingCsv`

**Files:**
- Modify: `apps/api/src/modules/reports/reports.csv.ts`
- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:

```typescript
import { toStockAgingCsv } from './reports.csv';

describe('toStockAgingCsv', () => {
  it('emits item-level CSV with bucket label and null cost as empty', () => {
    const data: StockAgingResult = {
      buckets: [], // unused by CSV
      items: [
        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
          weightG: '5.000', daysInStock: 10, bucket: '<30d',
          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
        { id: 'p2', sku: 'C-002', metal: 'GOLD', purity: '22K',
          weightG: '4.000', daysInStock: 75, bucket: '60-90d',
          costPaise: null, firstListedAt: '2026-02-15T00:00:00.000Z' },
      ],
    };
    const csv = toStockAgingCsv(data);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'SKU,Metal,Purity,Weight (g),Days in Stock,Age Bucket,Cost (Rs),First Listed',
    );
    expect(lines[1]).toBe('R-001,GOLD,22K,5.000,10,<30d,50000.00,2026-04-15T00:00:00.000Z');
    expect(lines[2]).toBe('C-002,GOLD,22K,4.000,75,60-90d,,2026-02-15T00:00:00.000Z');
  });

  it('emits header only when no items', () => {
    const data: StockAgingResult = { buckets: [], items: [] };
    expect(toStockAgingCsv(data).split('\r\n')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: FAIL — `Cannot find name 'toStockAgingCsv'`.

- [ ] **Step 3: Implement `toStockAgingCsv`**

Append to `apps/api/src/modules/reports/reports.csv.ts`:

```typescript
export function toStockAgingCsv(data: StockAgingResult): string {
  const header = csvRow([
    'SKU', 'Metal', 'Purity', 'Weight (g)',
    'Days in Stock', 'Age Bucket', 'Cost (Rs)', 'First Listed',
  ]);
  const rows = data.items.map((it) =>
    csvRow([
      it.sku,
      it.metal,
      it.purity,
      it.weightG,
      it.daysInStock,
      it.bucket,
      it.costPaise === null ? '' : paiseToRupees(it.costPaise),
      it.firstListedAt,
    ]),
  );
  return [header, ...rows].join(LE);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test reports.csv.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
git commit -m "feat(ws-3a): add toStockAgingCsv emitter"
```

---

## Task B6: Wire 5 `.csv` GET routes in `ReportsController`

**Pattern note (from codebase):** The existing GSTR export endpoint at `apps/api/src/modules/billing/billing.controller.ts:264-279` returns `{ csv: string; filename: string }` JSON — NOT raw streamed `text/csv`. The mobile share flow then calls `Share.share({ message: csv })` (see `apps/shopkeeper/app/reports/gstr-export.tsx:39-43`). This sidesteps browser-auth complications and reuses the axios Bearer-token interceptor. The 5 new CSV endpoints follow this same pattern.

**Files:**
- Modify: `apps/api/src/modules/reports/reports.controller.ts`

- [ ] **Step 1: Add the 5 routes**

Replace the imports block at the top of `apps/api/src/modules/reports/reports.controller.ts` with:

```typescript
import {
  Controller, Get, Query, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem, LoyaltySummaryResult,
  StockAgingResult,
} from './reports.service';
import {
  toDailySummaryCsv, toOutstandingCsv, toCustomerLtvCsv,
  toLoyaltySummaryCsv, toStockAgingCsv,
} from './reports.csv';
```

Append the following methods at the bottom of the `ReportsController` class:

```typescript
@TenantWalkerRoute({ expectedStatus: 200 })
@Get('/daily-summary.csv')
@Roles('shop_admin', 'shop_manager')
async getDailySummaryCsv(
  @Query('date') date?: string,
): Promise<{ csv: string; filename: string }> {
  const target = date ?? this.todayIST();
  const data = await this.svc.getDailySummary(target);
  return { csv: toDailySummaryCsv(data), filename: `daily-summary-${target}.csv` };
}

@TenantWalkerRoute({ expectedStatus: 200 })
@Get('/outstanding.csv')
@Roles('shop_admin', 'shop_manager')
async getOutstandingCsv(): Promise<{ csv: string; filename: string }> {
  // CSV exports the FULL list (capped at 1000 — anchor jeweller's outstanding
  // never exceeds low hundreds; cap protects worker memory in pathological cases).
  const data = await this.svc.getOutstanding(1, 1000);
  return { csv: toOutstandingCsv(data), filename: `outstanding-${this.todayIST()}.csv` };
}

@TenantWalkerRoute({ expectedStatus: 200 })
@Get('/customer-ltv.csv')
@Roles('shop_admin', 'shop_manager')
async getCustomerLtvCsv(
  @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
): Promise<{ csv: string; filename: string }> {
  const data = await this.svc.getCustomerLtv(limit);
  return { csv: toCustomerLtvCsv(data), filename: `customer-ltv-${this.todayIST()}.csv` };
}

@TenantWalkerRoute({ expectedStatus: 200 })
@Get('/loyalty-summary.csv')
@Roles('shop_admin', 'shop_manager')
async getLoyaltySummaryCsv(): Promise<{ csv: string; filename: string }> {
  const data = await this.svc.getLoyaltySummary();
  return { csv: toLoyaltySummaryCsv(data), filename: `loyalty-summary-${this.todayIST()}.csv` };
}

@TenantWalkerRoute({ expectedStatus: 200 })
@Get('/stock-aging.csv')
@Roles('shop_admin', 'shop_manager')
async getStockAgingCsv(): Promise<{ csv: string; filename: string }> {
  const data = await this.svc.getStockAging();
  return { csv: toStockAgingCsv(data), filename: `stock-aging-${this.todayIST()}.csv` };
}

private todayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Verify typecheck + endpoint walker**

```bash
pnpm --filter @goldsmith/api typecheck
pnpm --filter @goldsmith/api test:e2e
```

Expected: typecheck PASS; endpoint-walker PASS for all 5 new `.csv` routes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/reports/reports.controller.ts
git commit -m "feat(ws-3a): wire 5 .csv sync export routes (FR119 CSV)"
```

---

# WS-C — PDF async pipeline (FR119 PDF half)

## Task C1: Migration 0072 — `reports_pdf_exports` table

**Files:**
- Create: `packages/db/src/migrations/0072_reports_pdf_exports.sql`

- [ ] **Step 1: Write migration**

Create `packages/db/src/migrations/0072_reports_pdf_exports.sql`:

```sql
-- 0072_reports_pdf_exports.sql
-- Tracks asynchronous PDF export jobs (FR119). One row per requested PDF;
-- status transitions QUEUED → RUNNING → READY/FAILED via reports-pdf BullMQ
-- worker. Blob retention enforced via created_at + interval '7 days'
-- (cleanup is a separate ops follow-up, not in this story).

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

CREATE POLICY rls_reports_pdf_exports_tenant_isolation ON reports_pdf_exports
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON reports_pdf_exports TO app_user;
```

- [ ] **Step 2: Run migration locally + tenant-isolation walker**

```bash
pnpm db:reset
pnpm test:tenant-isolation
```

Expected: all migrations apply cleanly; tenant-isolation walker discovers `reports_pdf_exports` and confirms cross-tenant denial.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0072_reports_pdf_exports.sql
git commit -m "feat(ws-3a): add reports_pdf_exports table (migration 0072)"
```

---

## Task C2: Add audit-action enum entries

**Files:**
- Modify: `packages/audit/src/audit-actions.ts`
- Test: `packages/audit/src/audit-actions.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/audit/src/audit-actions.spec.ts`:

```typescript
describe('reports export audit actions', () => {
  it('exposes REPORT_EXPORT_REQUESTED and REPORT_EXPORT_REGENERATED', () => {
    expect(AuditAction.REPORT_EXPORT_REQUESTED).toBe('REPORT_EXPORT_REQUESTED');
    expect(AuditAction.REPORT_EXPORT_REGENERATED).toBe('REPORT_EXPORT_REGENERATED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/audit test
```

Expected: FAIL — `AuditAction.REPORT_EXPORT_REQUESTED` undefined.

- [ ] **Step 3: Add enum entries**

Append before the closing `}` in `packages/audit/src/audit-actions.ts`:

```typescript
  REPORT_EXPORT_REQUESTED          = 'REPORT_EXPORT_REQUESTED',
  REPORT_EXPORT_REGENERATED        = 'REPORT_EXPORT_REGENERATED',
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/audit test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit/src/audit-actions.ts packages/audit/src/audit-actions.spec.ts
git commit -m "feat(ws-3a): add REPORT_EXPORT_REQUESTED + _REGENERATED audit actions"
```

---

## Task C3: Add `pdfkit` dep + ship Devanagari TTF assets

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf` (binary download)
- Create: `apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf` (binary download)
- Modify: `apps/api/tsconfig.build.json` (if it excludes `assets/`)

- [ ] **Step 1: Add deps**

Edit `apps/api/package.json` — add `pdfkit` to `dependencies` (alphabetical order, after `passport-http-bearer`):

```json
    "pdfkit": "^0.15.0",
```

Add `@types/pdfkit` to `devDependencies` (alphabetical order, after `@types/passport-http-bearer`):

```json
    "@types/pdfkit": "^0.13.4",
```

Install:

```bash
pnpm install --filter @goldsmith/api
```

- [ ] **Step 2: Download Noto Sans Devanagari TTFs**

Both files come from Google Fonts (SIL Open Font License). Use the static-TTF URLs from the official `notofonts/devanagari` GitHub:

```bash
mkdir -p apps/api/assets/fonts
curl -L -o apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf \
  https://github.com/notofonts/devanagari/raw/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf
curl -L -o apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf \
  https://github.com/notofonts/devanagari/raw/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf
```

Verify both files are non-empty TTFs:

```bash
file apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf
file apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf
```

Expected: both report `TrueType Font data`. Files should be roughly 200-400 KB each.

- [ ] **Step 3: Confirm assets are bundled at build time**

Open `apps/api/tsconfig.build.json` (or `tsconfig.json` if no build variant). The default Nest build uses `tsc` which only emits `.ts → .js`; static assets aren't copied. We bundle by referencing them via absolute path at runtime (`path.resolve(__dirname, '../assets/fonts/...')` from `dist/`), so a post-build copy is needed. Add a `"copy-assets"` step.

Edit `apps/api/package.json` `scripts.build` to use a portable Node-based copy (works on Windows + Linux runners — avoids `cp -r` shell-dependency):

```json
"build": "tsc -p tsconfig.build.json && node -e \"require('fs').cpSync('assets','dist/assets',{recursive:true})\"",
```

- [ ] **Step 4: Verify install + typecheck**

```bash
pnpm --filter @goldsmith/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf pnpm-lock.yaml
git commit -m "feat(ws-3a): add pdfkit + Noto Sans Devanagari font assets"
```

---

## Task C4: `BrandingLoader`

**Files:**
- Create: `apps/api/src/modules/reports/pdf/branding.ts`

- [ ] **Step 1: Implement** (no tests — pure SQL passthrough; covered indirectly by renderer.spec.ts in Task C6+)

Create `apps/api/src/modules/reports/pdf/branding.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';

export interface ShopBranding {
  displayName: string;
  logoUrl: string | null;
  addressText: string;
  gstin: string | null;
  contactPhone: string | null;
}

@Injectable()
export class BrandingLoader {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async load(): Promise<ShopBranding> {
    const ctx = tenantContext.requireCurrent();
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{
        display_name:    string;
        logo_url:        string | null;
        address_json:    Record<string, unknown> | null;
        gstin:           string | null;
        contact_phone:   string | null;
      }>(
        `SELECT display_name, logo_url, address_json, gstin, contact_phone
         FROM shops
         WHERE id = $1`,
        [ctx.shopId],
      );
      if (!r.rows[0]) throw new NotFoundException({ code: 'shop.not_found' });
      const row = r.rows[0];
      return {
        displayName:  row.display_name,
        logoUrl:      row.logo_url,
        addressText:  row.address_json ? this.formatAddress(row.address_json) : '',
        gstin:        row.gstin,
        contactPhone: row.contact_phone,
      };
    });
  }

  private formatAddress(addr: Record<string, unknown>): string {
    return [addr['line1'], addr['line2'], addr['city'], addr['state'], addr['pincode']]
      .filter(Boolean)
      .join(', ');
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @goldsmith/api typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/reports/pdf/branding.ts
git commit -m "feat(ws-3a): add BrandingLoader for PDF reports"
```

---

## Task C5: `drawHeader` + `drawFooter` PDF primitives

**Files:**
- Create: `apps/api/src/modules/reports/pdf/header.ts`
- Create: `apps/api/src/modules/reports/pdf/footer.ts`

- [ ] **Step 1: Implement `drawHeader`**

Create `apps/api/src/modules/reports/pdf/header.ts`:

```typescript
import type PDFDocument from 'pdfkit';
import type { ShopBranding } from './branding';
import type { StoragePort } from '@goldsmith/integrations-storage';

const GOLD = '#B58A3C';

/**
 * Draws shop branding header on the current page.
 * Returns the Y coordinate just below the header (where body content should start).
 *
 * Logo is fetched once per render via storage.downloadBuffer if logoUrl points to
 * a tenant blob key; if logoUrl is empty/null/external-http, no logo is drawn.
 */
export async function drawHeader(
  doc: PDFKit.PDFDocument,
  branding: ShopBranding,
  reportTitle: string,
  storage: StoragePort,
): Promise<number> {
  const startY = doc.y;

  // Logo (left)
  let logoBottom = startY;
  if (branding.logoUrl && branding.logoUrl.startsWith('tenants/')) {
    try {
      const buf = await storage.downloadBuffer(branding.logoUrl);
      doc.image(buf, doc.page.margins.left, startY, { fit: [80, 40] });
      logoBottom = startY + 40;
    } catch {
      // Best-effort; missing logo blob doesn't fail the render
    }
  }

  // Shop name + report title (centre)
  doc.font('Devanagari-Bold').fontSize(18).fillColor('#1c1917');
  doc.text(branding.displayName, doc.page.margins.left + 90, startY, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 90,
  });
  doc.font('Devanagari').fontSize(14).fillColor(GOLD);
  doc.text(reportTitle, doc.page.margins.left + 90, doc.y + 2);

  // Generated-at (right)
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  doc.font('Devanagari').fontSize(9).fillColor('#78716c');
  doc.text(`Generated: ${generatedAt}`, doc.page.margins.left, startY, {
    align: 'right',
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
  });

  // Divider line
  const dividerY = Math.max(logoBottom, doc.y) + 8;
  doc.moveTo(doc.page.margins.left, dividerY)
     .lineTo(doc.page.width - doc.page.margins.right, dividerY)
     .strokeColor(GOLD).lineWidth(1).stroke();

  doc.fillColor('#1c1917').strokeColor('#000');
  doc.y = dividerY + 12;
  return doc.y;
}
```

- [ ] **Step 2: Implement `drawFooter`**

Create `apps/api/src/modules/reports/pdf/footer.ts`:

```typescript
import type { ShopBranding } from './branding';

/**
 * Draws shop address + GSTIN + page N of M at the bottom of the current page.
 * Called once per page; uses absolute Y near the page bottom rather than doc.y.
 */
export function drawFooter(
  doc: PDFKit.PDFDocument,
  branding: ShopBranding,
  pageNum: number,
  totalPages: number,
): void {
  const footerY = doc.page.height - doc.page.margins.bottom + 8;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.font('Devanagari').fontSize(8).fillColor('#78716c');

  // Address line (left)
  if (branding.addressText) {
    doc.text(branding.addressText, left, footerY, {
      width: right - left - 100,
      lineBreak: false,
      ellipsis: true,
    });
  }

  // GSTIN line under address
  if (branding.gstin) {
    doc.text(`GSTIN: ${branding.gstin}`, left, footerY + 10, {
      width: right - left - 100,
    });
  }

  // Page N of M (right)
  doc.text(`Page ${pageNum} of ${totalPages}`, left, footerY, {
    align: 'right',
    width: right - left,
  });

  doc.fillColor('#1c1917');
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter @goldsmith/api typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/reports/pdf/header.ts apps/api/src/modules/reports/pdf/footer.ts
git commit -m "feat(ws-3a): add PDF header/footer primitives"
```

---

## Task C6: `PdfRenderer` service + daily-summary template

**Files:**
- Create: `apps/api/src/modules/reports/pdf/renderer.ts`
- Create: `apps/api/src/modules/reports/pdf/templates/daily-summary.ts`
- Create: `apps/api/src/modules/reports/pdf/renderer.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/reports/pdf/renderer.spec.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { PdfRenderer } from './renderer';
import type { ShopBranding } from './branding';
import type { DailySummaryResult } from '../reports.service';

const mockStorage = {
  downloadBuffer: vi.fn().mockRejectedValue(new Error('no logo')),
  uploadBuffer: vi.fn(),
  getPublicUrl: vi.fn(),
  getPresignedReadUrl: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  deleteBlob: vi.fn(),
};

const branding: ShopBranding = {
  displayName: 'टेस्ट ज्वैलर्स',
  logoUrl: null,
  addressText: 'Ayodhya, UP, 224001',
  gstin: '09ABCDE1234F1Z5',
  contactPhone: '9876543210',
};

describe('PdfRenderer.render(daily-summary)', () => {
  it('produces a non-empty PDF buffer with %PDF- magic bytes', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data: DailySummaryResult = {
      date: '2026-04-29',
      total_paise: '500000', cash_paise: '300000',
      upi_paise: '200000', other_paise: '0',
      invoice_count: 3, gold_weight_mg: '15000',
    };
    const buf = await renderer.render('daily-summary', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: FAIL — `Cannot find module './renderer'`.

- [ ] **Step 3: Implement `PdfRenderer`**

Create `apps/api/src/modules/reports/pdf/renderer.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';
import type { ShopBranding } from './branding';
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem,
  LoyaltySummaryResult, StockAgingResult,
} from '../reports.service';
import { renderDailySummary } from './templates/daily-summary';

const FONT_DIR = path.resolve(__dirname, '../../../../assets/fonts');

export type ReportType =
  | 'daily-summary' | 'outstanding' | 'customer-ltv'
  | 'loyalty-summary' | 'stock-aging';

export type ReportData =
  | DailySummaryResult | OutstandingResult | CustomerLtvItem[]
  | LoyaltySummaryResult | StockAgingResult;

@Injectable()
export class PdfRenderer {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  async render(
    reportType: ReportType,
    data: ReportData,
    branding: ShopBranding,
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 60, left: 36, right: 36 },
      bufferPages: true,
    });

    // Register Devanagari fonts; fallback to Helvetica if asset missing.
    try {
      doc.registerFont('Devanagari',      path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf'));
      doc.registerFont('Devanagari-Bold', path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf'));
    } catch {
      doc.registerFont('Devanagari',      'Helvetica');
      doc.registerFont('Devanagari-Bold', 'Helvetica-Bold');
    }

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));

    switch (reportType) {
      case 'daily-summary':
        await renderDailySummary(doc, data as DailySummaryResult, branding, this.storage);
        break;
      // outstanding / customer-ltv / loyalty-summary / stock-aging added in
      // Tasks C7–C10. Until then, throw to fail fast.
      default:
        throw new Error(`reports.pdf.template_not_implemented:${reportType}`);
    }

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }
}
```

- [ ] **Step 4: Implement daily-summary template**

Create `apps/api/src/modules/reports/pdf/templates/daily-summary.ts`:

```typescript
import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { DailySummaryResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatINR(paise: bigint | string | number): string {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function formatGrams(mg: string | number): string {
  return `${(Number(mg) / 1000).toFixed(3)} g`;
}

export async function renderDailySummary(
  doc: PDFKit.PDFDocument,
  data: DailySummaryResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, `दैनिक बिक्री / Daily Summary — ${data.date}`, storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const labelX = left;
  const valueX = right;

  doc.font('Devanagari').fontSize(12).fillColor('#1c1917');

  const rows: [label: string, value: string][] = [
    ['कुल बिक्री / Total Sales',   formatINR(data.total_paise)],
    ['नकद / Cash',                  formatINR(data.cash_paise)],
    ['UPI',                          formatINR(data.upi_paise)],
    ['अन्य / Other',                 formatINR(data.other_paise)],
    ['चालान संख्या / Invoice Count', `${data.invoice_count}`],
    ['सोना बिका / Gold Sold',        formatGrams(data.gold_weight_mg)],
  ];

  for (const [label, value] of rows) {
    const y = doc.y;
    doc.text(label, labelX, y, { width: right - left - 120 });
    doc.text(value, labelX, y, {
      width: right - left,
      align: 'right',
    });
    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(right, doc.y)
       .strokeColor('#e7e5e4').lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  }

  // Footer on this single page
  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: PASS — buffer non-empty + `%PDF-` magic bytes.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts apps/api/src/modules/reports/pdf/templates/daily-summary.ts
git commit -m "feat(ws-3a): add PdfRenderer + daily-summary template"
```

---

## Task C7: Outstanding template

**Files:**
- Create: `apps/api/src/modules/reports/pdf/templates/outstanding.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`

- [ ] **Step 1: Append to test**

Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:

```typescript
describe('PdfRenderer.render(outstanding)', () => {
  it('produces a non-empty PDF buffer with %PDF- magic bytes', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data = {
      total: 1, page: 1, limit: 100,
      items: [{
        id: 'i1', invoice_number: 'GS-2026-0001',
        customer_name: 'राज कुमार', customer_phone: '9876543210',
        total_paise: '100000', balance_due_paise: '50000',
        issued_at: '2026-04-01T10:00:00.000Z',
      }],
    };
    const buf = await renderer.render('outstanding', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: FAIL — `reports.pdf.template_not_implemented:outstanding`.

- [ ] **Step 3: Implement outstanding template**

Create `apps/api/src/modules/reports/pdf/templates/outstanding.ts`:

```typescript
import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { OutstandingResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatINR(paise: string | number): string {
  return (Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export async function renderOutstanding(
  doc: PDFKit.PDFDocument,
  data: OutstandingResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'बकाया भुगतान / Outstanding Payments', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const cols = [
    { key: 'invoice', label: 'Invoice',    w: 0.18 },
    { key: 'name',    label: 'Customer',   w: 0.32 },
    { key: 'phone',   label: 'Phone',      w: 0.16 },
    { key: 'total',   label: 'Total (Rs)', w: 0.13 },
    { key: 'due',     label: 'Due (Rs)',   w: 0.11 },
    { key: 'date',    label: 'Issued',     w: 0.10 },
  ];

  // Header row
  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
  let x = left;
  for (const c of cols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w, continued: false });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  // Body rows
  doc.font('Devanagari').fontSize(9).fillColor('#1c1917');
  for (const it of data.items) {
    const rowY = doc.y;
    if (rowY > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      await drawHeader(doc, branding, 'बकाया भुगतान / Outstanding Payments (cont.)', storage);
    }
    x = left;
    const cells = [
      it.invoice_number,
      it.customer_name,
      it.customer_phone ?? '',
      formatINR(it.total_paise),
      formatINR(it.balance_due_paise),
      formatDate(it.issued_at),
    ];
    for (let i = 0; i < cols.length; i++) {
      doc.text(cells[i]!, x, rowY, {
        width: tableWidth * cols[i]!.w,
        ellipsis: true,
        lineBreak: false,
      });
      x += tableWidth * cols[i]!.w;
    }
    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(right, doc.y)
       .strokeColor('#e7e5e4').lineWidth(0.5).stroke();
    doc.moveDown(0.3);
  }

  // Footer per page
  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
```

- [ ] **Step 4: Wire into renderer**

Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:

```typescript
import { renderOutstanding } from './templates/outstanding';
```

Replace the `switch` block with:
```typescript
switch (reportType) {
  case 'daily-summary':
    await renderDailySummary(doc, data as DailySummaryResult, branding, this.storage);
    break;
  case 'outstanding':
    await renderOutstanding(doc, data as OutstandingResult, branding, this.storage);
    break;
  default:
    throw new Error(`reports.pdf.template_not_implemented:${reportType}`);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/reports/pdf/templates/outstanding.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
git commit -m "feat(ws-3a): add outstanding PDF template"
```

---

## Task C8: Customer LTV template

**Files:**
- Create: `apps/api/src/modules/reports/pdf/templates/customer-ltv.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`

- [ ] **Step 1: Append to test**

Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:

```typescript
describe('PdfRenderer.render(customer-ltv)', () => {
  it('produces a non-empty PDF buffer', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data = [
      { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
      { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
    ];
    const buf = await renderer.render('customer-ltv', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: FAIL — template not implemented.

- [ ] **Step 3: Implement customer-ltv template**

Create `apps/api/src/modules/reports/pdf/templates/customer-ltv.ts`:

```typescript
import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { CustomerLtvItem } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatINR(paise: string): string {
  return (Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export async function renderCustomerLtv(
  doc: PDFKit.PDFDocument,
  items: CustomerLtvItem[],
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'शीर्ष ग्राहक / Top Customers (Lifetime Value)', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const cols = [
    { label: 'Rank',          w: 0.08 },
    { label: 'Customer',      w: 0.45 },
    { label: 'Phone',         w: 0.22 },
    { label: 'LTV (Rs)',      w: 0.25 },
  ];

  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
  let x = left;
  for (const c of cols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(10).fillColor('#1c1917');
  items.forEach((it, idx) => {
    const rowY = doc.y;
    if (rowY > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
    }
    x = left;
    const cells = [
      `${idx + 1}`,
      it.name,
      it.phone,
      formatINR(it.ltv_paise),
    ];
    for (let i = 0; i < cols.length; i++) {
      doc.text(cells[i]!, x, rowY, {
        width: tableWidth * cols[i]!.w,
        ellipsis: true,
        lineBreak: false,
      });
      x += tableWidth * cols[i]!.w;
    }
    doc.moveDown(0.5);
  });

  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
```

- [ ] **Step 4: Wire into renderer**

Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:

```typescript
import { renderCustomerLtv } from './templates/customer-ltv';
```

Add a case to the switch:
```typescript
case 'customer-ltv':
  await renderCustomerLtv(doc, data as CustomerLtvItem[], branding, this.storage);
  break;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/reports/pdf/templates/customer-ltv.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
git commit -m "feat(ws-3a): add customer-ltv PDF template"
```

---

## Task C9: Loyalty summary template

**Files:**
- Create: `apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`

- [ ] **Step 1: Append to test**

Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:

```typescript
describe('PdfRenderer.render(loyalty-summary)', () => {
  it('produces a non-empty PDF buffer', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data = {
      points_issued: 5000, points_redeemed: 1200,
      members_by_tier: [
        { tier: 'GOLD',   count: 12 },
        { tier: 'SILVER', count: 8 },
        { tier: null,     count: 3 },
      ],
    };
    const buf = await renderer.render('loyalty-summary', data, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: FAIL — template not implemented.

- [ ] **Step 3: Implement loyalty-summary template**

Create `apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts`:

```typescript
import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { LoyaltySummaryResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

export async function renderLoyaltySummary(
  doc: PDFKit.PDFDocument,
  data: LoyaltySummaryResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'लॉयल्टी कार्यक्रम / Loyalty Programme', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  // Totals card
  doc.font('Devanagari-Bold').fontSize(13).fillColor('#1c1917');
  doc.text('अंक सारांश / Points Summary', left, doc.y);
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(11).fillColor('#1c1917');
  const totalRows: [string, string][] = [
    ['जारी / Issued',      `${data.points_issued}`],
    ['भुनाए / Redeemed',   `${data.points_redeemed}`],
    ['शुद्ध / Net',         `${data.points_issued - data.points_redeemed}`],
  ];
  for (const [label, value] of totalRows) {
    const y = doc.y;
    doc.text(label, left, y);
    doc.text(value, left, y, { width: right - left, align: 'right' });
    doc.moveDown(0.4);
  }

  doc.moveDown(0.5);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.5);

  // Tier breakdown
  doc.font('Devanagari-Bold').fontSize(13).fillColor('#1c1917');
  doc.text('स्तर के अनुसार / By Tier', left, doc.y);
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(11).fillColor('#1c1917');
  for (const t of data.members_by_tier) {
    const y = doc.y;
    doc.text(t.tier ?? 'UNTIERED', left, y);
    doc.text(`${t.count}`, left, y, { width: right - left, align: 'right' });
    doc.moveDown(0.4);
  }

  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
```

- [ ] **Step 4: Wire into renderer**

Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:

```typescript
import { renderLoyaltySummary } from './templates/loyalty-summary';
```

```typescript
case 'loyalty-summary':
  await renderLoyaltySummary(doc, data as LoyaltySummaryResult, branding, this.storage);
  break;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
git commit -m "feat(ws-3a): add loyalty-summary PDF template"
```

---

## Task C10: Stock-aging template

**Files:**
- Create: `apps/api/src/modules/reports/pdf/templates/stock-aging.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`

- [ ] **Step 1: Append to test**

Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:

```typescript
describe('PdfRenderer.render(stock-aging)', () => {
  it('produces a non-empty PDF buffer with bucket summary + items', async () => {
    const renderer = new PdfRenderer(mockStorage);
    const data = {
      buckets: [
        { label: '<30d',   count: 2, totalWeightMg: '8000', totalCostPaise: '8000000' },
        { label: '30-60d', count: 1, totalWeightMg: '50000', totalCostPaise: '500000' },
        { label: '60-90d', count: 1, totalWeightMg: '4000',  totalCostPaise: '0' },
        { label: '90d+',   count: 1, totalWeightMg: '8000',  totalCostPaise: '8000000' },
      ],
      items: [
        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
          weightG: '5.000', daysInStock: 10, bucket: '<30d',
          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
      ],
    };
    const buf = await renderer.render('stock-aging', data as never, branding);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: FAIL — template not implemented.

- [ ] **Step 3: Implement stock-aging template**

Create `apps/api/src/modules/reports/pdf/templates/stock-aging.ts`:

```typescript
import { drawHeader } from '../header';
import { drawFooter } from '../footer';
import type { ShopBranding } from '../branding';
import type { StockAgingResult } from '../../reports.service';
import type { StoragePort } from '@goldsmith/integrations-storage';

function formatGrams(mg: string): string {
  return `${(Number(mg) / 1000).toFixed(3)} g`;
}

function formatINR(paise: string): string {
  return (Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export async function renderStockAging(
  doc: PDFKit.PDFDocument,
  data: StockAgingResult,
  branding: ShopBranding,
  storage: StoragePort,
): Promise<void> {
  await drawHeader(doc, branding, 'पुराना स्टॉक / Stock Aging', storage);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;

  // Bucket summary
  doc.font('Devanagari-Bold').fontSize(12).fillColor('#1c1917');
  doc.text('आयु सारांश / Age Summary', left, doc.y);
  doc.moveDown(0.3);

  const bucketCols = [
    { label: 'Bucket',    w: 0.20 },
    { label: 'Items',     w: 0.20 },
    { label: 'Weight',    w: 0.30 },
    { label: 'Cost (Rs)', w: 0.30 },
  ];
  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
  let x = left;
  for (const c of bucketCols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(10).fillColor('#1c1917');
  for (const b of data.buckets) {
    const y = doc.y;
    x = left;
    const cells = [b.label, `${b.count}`, formatGrams(b.totalWeightMg), formatINR(b.totalCostPaise)];
    for (let i = 0; i < bucketCols.length; i++) {
      doc.text(cells[i]!, x, y, { width: tableWidth * bucketCols[i]!.w });
      x += tableWidth * bucketCols[i]!.w;
    }
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);

  // Item list
  doc.font('Devanagari-Bold').fontSize(12).fillColor('#1c1917');
  doc.text('प्रत्येक उत्पाद / Per-Product Detail', left, doc.y);
  doc.moveDown(0.3);

  const itemCols = [
    { label: 'SKU',     w: 0.15 },
    { label: 'Metal',   w: 0.10 },
    { label: 'Purity',  w: 0.10 },
    { label: 'Weight',  w: 0.13 },
    { label: 'Days',    w: 0.10 },
    { label: 'Bucket',  w: 0.13 },
    { label: 'Cost',    w: 0.15 },
    { label: 'Listed',  w: 0.14 },
  ];
  doc.font('Devanagari-Bold').fontSize(9).fillColor('#57534e');
  x = left;
  for (const c of itemCols) {
    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
    x += tableWidth * c.w;
  }
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
  doc.moveDown(0.3);

  doc.font('Devanagari').fontSize(8).fillColor('#1c1917');
  for (const it of data.items) {
    const y = doc.y;
    if (y > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
    }
    x = left;
    const cells = [
      it.sku,
      it.metal,
      it.purity,
      it.weightG,
      `${it.daysInStock}`,
      it.bucket,
      it.costPaise === null ? '—' : formatINR(it.costPaise),
      it.firstListedAt.slice(0, 10),
    ];
    for (let i = 0; i < itemCols.length; i++) {
      doc.text(cells[i]!, x, y, {
        width: tableWidth * itemCols[i]!.w,
        ellipsis: true,
        lineBreak: false,
      });
      x += tableWidth * itemCols[i]!.w;
    }
    doc.moveDown(0.4);
  }

  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, branding, i - range.start + 1, range.count);
  }
}
```

- [ ] **Step 4: Wire into renderer**

Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:

```typescript
import { renderStockAging } from './templates/stock-aging';
```

```typescript
case 'stock-aging':
  await renderStockAging(doc, data as StockAgingResult, branding, this.storage);
  break;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/api test renderer.spec
```

Expected: PASS — all 5 templates green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/reports/pdf/templates/stock-aging.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
git commit -m "feat(ws-3a): add stock-aging PDF template (closes 5/5)"
```

---

## Task C11: `ReportsExportService` (enqueue + poll + regenerate)

**Files:**
- Create: `apps/api/src/modules/reports/reports-export.service.ts`
- Create: `apps/api/src/modules/reports/reports-export.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/reports/reports-export.service.spec.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReportsExportService } from './reports-export.service';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000000';
const USER = 'uuuuuuuu-bbbb-4000-8000-000000000001';
const EXPORT_ID = '11111111-2222-4000-8000-000000000000';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: {
    REPORT_EXPORT_REQUESTED: 'REPORT_EXPORT_REQUESTED',
    REPORT_EXPORT_REGENERATED: 'REPORT_EXPORT_REGENERATED',
  },
}));

let fakeTx: { query: ReturnType<typeof vi.fn> };
let fakeQueue: { add: ReturnType<typeof vi.fn> };
let fakeStorage: { getPresignedReadUrl: ReturnType<typeof vi.fn>; downloadBuffer: ReturnType<typeof vi.fn> };

function makeSvc(): ReportsExportService {
  return new ReportsExportService({} as never, fakeQueue as never, fakeStorage as never);
}

beforeEach(() => {
  fakeTx = { query: vi.fn() };
  fakeQueue = { add: vi.fn().mockResolvedValue(undefined) };
  fakeStorage = {
    getPresignedReadUrl: vi.fn().mockResolvedValue('https://signed.example/readme'),
    downloadBuffer: vi.fn(),
  };
});

describe('ReportsExportService.enqueue', () => {
  it('rejects unknown reportType', async () => {
    const svc = makeSvc();
    await expect(svc.enqueue('unknown' as never, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('inserts row and enqueues BullMQ job', async () => {
    fakeTx.query.mockResolvedValueOnce({ rows: [{ id: EXPORT_ID }] });
    const svc = makeSvc();
    const result = await svc.enqueue('daily-summary', { date: '2026-04-29' });
    expect(result).toEqual({ id: EXPORT_ID, status: 'QUEUED' });
    expect(fakeQueue.add).toHaveBeenCalledWith(
      'render',
      expect.objectContaining({
        shopId: SHOP,
        exportId: EXPORT_ID,
        reportType: 'daily-summary',
        params: { date: '2026-04-29' },
      }),
      expect.any(Object),
    );
  });
});

describe('ReportsExportService.getStatus', () => {
  it('throws NotFound when row missing (RLS-filtered or wrong tenant)', async () => {
    fakeTx.query.mockResolvedValueOnce({ rows: [] });
    const svc = makeSvc();
    await expect(svc.getStatus(EXPORT_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns READY with freshly signed downloadUrl when blob within retention', async () => {
    fakeTx.query.mockResolvedValueOnce({
      rows: [{
        id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
        storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
        error_message: null,
        created_at: new Date(),
      }],
    });
    const svc = makeSvc();
    const result = await svc.getStatus(EXPORT_ID);
    expect(result.status).toBe('READY');
    expect(result.downloadUrl).toBe('https://signed.example/readme');
    expect(result.blobExpiresAt).toBeDefined();
  });

  it('returns READY without downloadUrl when blob older than 7 days', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000);
    fakeTx.query.mockResolvedValueOnce({
      rows: [{
        id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
        storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
        error_message: null,
        created_at: eightDaysAgo,
      }],
    });
    const svc = makeSvc();
    const result = await svc.getStatus(EXPORT_ID);
    expect(result.status).toBe('READY');
    expect(result.downloadUrl).toBeUndefined();
  });

  it('returns FAILED with errorMessage', async () => {
    fakeTx.query.mockResolvedValueOnce({
      rows: [{
        id: EXPORT_ID, report_type: 'daily-summary', status: 'FAILED',
        storage_key: null,
        error_message: 'render failed: out of memory',
        created_at: new Date(),
      }],
    });
    const svc = makeSvc();
    const result = await svc.getStatus(EXPORT_ID);
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('render failed: out of memory');
  });
});

describe('ReportsExportService.regenerate', () => {
  it('rejects when export is QUEUED or RUNNING', async () => {
    fakeTx.query.mockResolvedValueOnce({
      rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'RUNNING',
               storage_key: null, error_message: null, created_at: new Date(), params: {} }],
    });
    const svc = makeSvc();
    await expect(svc.regenerate(EXPORT_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('re-signs without re-rendering when blob fresh', async () => {
    const freshDate = new Date(Date.now() - 86400_000); // 1 day ago
    fakeTx.query.mockResolvedValueOnce({
      rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
               storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
               error_message: null, created_at: freshDate, params: {} }],
    });
    fakeStorage.downloadBuffer.mockResolvedValueOnce(Buffer.from([1, 2, 3]));
    const svc = makeSvc();
    const result = await svc.regenerate(EXPORT_ID);
    expect(result.downloadUrl).toBe('https://signed.example/readme');
    expect(fakeQueue.add).not.toHaveBeenCalled();
  });

  it('re-enqueues when blob is missing', async () => {
    fakeTx.query
      .mockResolvedValueOnce({
        rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
                 storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
                 error_message: null, created_at: new Date(), params: {} }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    fakeStorage.downloadBuffer.mockRejectedValueOnce(new Error('blob missing'));
    const svc = makeSvc();
    const result = await svc.regenerate(EXPORT_ID);
    expect(result.status).toBe('QUEUED');
    expect(fakeQueue.add).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test reports-export.service.spec
```

Expected: FAIL — `Cannot find module './reports-export.service'`.

- [ ] **Step 3: Implement `ReportsExportService`**

Create `apps/api/src/modules/reports/reports-export.service.ts`:

```typescript
import {
  BadRequestException, ConflictException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';
import type { ReportType } from './pdf/renderer';

const VALID_REPORT_TYPES: ReportType[] = [
  'daily-summary', 'outstanding', 'customer-ltv', 'loyalty-summary', 'stock-aging',
];

const BLOB_RETENTION_DAYS = 7;

export interface ExportEnqueueParams {
  date?: string;
  limit?: number;
  page?: number;
}

export interface ExportStatusResult {
  id:             string;
  reportType:     ReportType;
  status:         'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
  downloadUrl?:   string;
  blobExpiresAt?: string;
  errorMessage?:  string;
}

interface ExportRow {
  id:             string;
  report_type:    ReportType;
  status:         'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
  storage_key:    string | null;
  error_message:  string | null;
  created_at:     Date;
  params:         ExportEnqueueParams;
}

@Injectable()
export class ReportsExportService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @InjectQueue('reports-pdf') private readonly queue: Queue,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async enqueue(reportType: ReportType, params: ExportEnqueueParams): Promise<{ id: string; status: 'QUEUED' }> {
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      throw new BadRequestException({ code: 'reports.export.invalid_report_type' });
    }
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) {
      throw new BadRequestException({ code: 'reports.export.unauthenticated' });
    }
    const userId = ctx.userId;

    const id = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO reports_pdf_exports (shop_id, report_type, params, status, requested_by_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2::jsonb, 'QUEUED', $3)
         RETURNING id`,
        [reportType, JSON.stringify(params), userId],
      );
      return r.rows[0]!.id;
    });

    await this.queue.add('render', {
      shopId:     ctx.shopId,
      exportId:   id,
      reportType,
      params,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    await auditLog(this.pool, {
      action: AuditAction.REPORT_EXPORT_REQUESTED,
      subjectType: 'report',
      subjectId: id,
      actorUserId: userId,
      after: { reportType, params },
    });

    return { id, status: 'QUEUED' };
  }

  async getStatus(id: string): Promise<ExportStatusResult> {
    const row = await this.fetchRow(id);
    return this.toStatusResult(row);
  }

  async regenerate(id: string): Promise<ExportStatusResult> {
    const row = await this.fetchRow(id);
    if (row.status === 'QUEUED' || row.status === 'RUNNING') {
      throw new ConflictException({ code: 'reports.export.busy' });
    }

    const ctx = tenantContext.requireCurrent();
    const userId = ctx.authenticated ? ctx.userId : undefined;

    // Try to re-sign existing blob if within retention window.
    const ageMs = Date.now() - row.created_at.getTime();
    const withinRetention = ageMs < BLOB_RETENTION_DAYS * 86400_000 && row.storage_key !== null;

    if (withinRetention) {
      try {
        await this.storage.downloadBuffer(row.storage_key!); // probes blob existence
        await auditLog(this.pool, {
          action: AuditAction.REPORT_EXPORT_REGENERATED,
          subjectType: 'report',
          subjectId: id,
          actorUserId: userId,
          metadata: { mode: 'resign' },
        });
        return this.toStatusResult({ ...row, status: 'READY' });
      } catch {
        // blob missing — fall through to re-render
      }
    }

    // Re-render: reset row, enqueue fresh job.
    await withTenantTx(this.pool, async (tx) => {
      await tx.query(
        `UPDATE reports_pdf_exports
         SET status = 'QUEUED',
             storage_key = NULL,
             error_message = NULL,
             completed_at = NULL,
             created_at = now()
         WHERE id = $1`,
        [id],
      );
    });
    await this.queue.add('render', {
      shopId:     ctx.shopId,
      exportId:   id,
      reportType: row.report_type,
      params:     row.params,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    await auditLog(this.pool, {
      action: AuditAction.REPORT_EXPORT_REGENERATED,
      subjectType: 'report',
      subjectId: id,
      actorUserId: userId,
      metadata: { mode: 'rerender' },
    });

    return { id, reportType: row.report_type, status: 'QUEUED' };
  }

  private async fetchRow(id: string): Promise<ExportRow> {
    const row = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ExportRow>(
        `SELECT id, report_type, status, storage_key, error_message, created_at, params
         FROM reports_pdf_exports
         WHERE id = $1`,
        [id],
      );
      return r.rows[0];
    });
    if (!row) throw new NotFoundException({ code: 'reports.export.not_found' });
    return row;
  }

  private async toStatusResult(row: ExportRow): Promise<ExportStatusResult> {
    const result: ExportStatusResult = {
      id:         row.id,
      reportType: row.report_type,
      status:     row.status,
    };
    if (row.error_message) result.errorMessage = row.error_message;
    if (row.status === 'READY' && row.storage_key) {
      const ageMs = Date.now() - row.created_at.getTime();
      const blobExpiresAt = new Date(row.created_at.getTime() + BLOB_RETENTION_DAYS * 86400_000);
      if (ageMs < BLOB_RETENTION_DAYS * 86400_000) {
        result.downloadUrl = await this.storage.getPresignedReadUrl(row.storage_key);
      }
      result.blobExpiresAt = blobExpiresAt.toISOString();
    }
    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @goldsmith/api test reports-export.service.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/reports-export.service.ts apps/api/src/modules/reports/reports-export.service.spec.ts
git commit -m "feat(ws-3a): add ReportsExportService (enqueue/status/regenerate)"
```

---

## Task C12: `ReportsPdfProcessor` (BullMQ worker)

**Files:**
- Create: `apps/api/src/workers/reports-pdf.processor.ts`
- Create: `apps/api/src/workers/reports-pdf.processor.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/workers/reports-pdf.processor.spec.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReportsPdfProcessor } from './reports-pdf.processor';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000000';
const EXPORT_ID = '11111111-2222-4000-8000-000000000000';

let fakeReports: { getDailySummary: ReturnType<typeof vi.fn>; [k: string]: unknown };
let fakeRenderer: { render: ReturnType<typeof vi.fn> };
let fakeStorage: { uploadBuffer: ReturnType<typeof vi.fn> };
let fakeBranding: { load: ReturnType<typeof vi.fn> };
let fakePool: { query: ReturnType<typeof vi.fn> };

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    runWith: async (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) }),
}));

beforeEach(() => {
  fakeReports = {
    getDailySummary:    vi.fn().mockResolvedValue({ date: '2026-04-29' }),
    getOutstanding:     vi.fn(),
    getCustomerLtv:     vi.fn(),
    getLoyaltySummary:  vi.fn(),
    getStockAging:      vi.fn(),
  };
  fakeRenderer = { render: vi.fn().mockResolvedValue(Buffer.from('PDF-bytes')) };
  fakeStorage = { uploadBuffer: vi.fn().mockResolvedValue(undefined) };
  fakeBranding = { load: vi.fn().mockResolvedValue({ displayName: 'X', logoUrl: null, addressText: '', gstin: null, contactPhone: null }) };
  fakePool = {
    query: vi.fn().mockResolvedValueOnce({
      rows: [{ id: SHOP, slug: 'x', display_name: 'X', status: 'ACTIVE' }],
    }),
  };
});

function makeProcessor(): ReportsPdfProcessor {
  return new ReportsPdfProcessor(
    fakeReports as never,
    fakeRenderer as never,
    fakeStorage as never,
    fakeBranding as never,
    fakePool as never,
  );
}

describe('ReportsPdfProcessor', () => {
  it('renders + uploads + updates row to READY', async () => {
    const job = {
      id: 'j1',
      data: {
        shopId: SHOP, exportId: EXPORT_ID,
        reportType: 'daily-summary', params: { date: '2026-04-29' },
      },
    };
    const proc = makeProcessor();
    await proc.process(job as never);

    expect(fakeReports.getDailySummary).toHaveBeenCalledWith('2026-04-29');
    expect(fakeRenderer.render).toHaveBeenCalledWith(
      'daily-summary', expect.anything(), expect.anything(),
    );
    expect(fakeStorage.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining(`tenants/${SHOP}/reports/daily-summary/`),
      expect.any(Buffer),
      'application/pdf',
    );
  });

  it('marks row FAILED on render error', async () => {
    fakeRenderer.render.mockRejectedValueOnce(new Error('render boom'));
    const job = {
      id: 'j2',
      data: {
        shopId: SHOP, exportId: EXPORT_ID,
        reportType: 'daily-summary', params: {},
      },
    };
    const proc = makeProcessor();
    await expect(proc.process(job as never)).rejects.toThrow('render boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/api test reports-pdf.processor.spec
```

Expected: FAIL — `Cannot find module './reports-pdf.processor'`.

- [ ] **Step 3: Implement processor**

Create `apps/api/src/workers/reports-pdf.processor.ts`:

```typescript
import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import type { TenantContext, Tenant } from '@goldsmith/tenant-context';
import { withTenantTx } from '@goldsmith/db';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';
import { ReportsService } from '../modules/reports/reports.service';
import { PdfRenderer } from '../modules/reports/pdf/renderer';
import type { ReportType, ReportData } from '../modules/reports/pdf/renderer';
import { BrandingLoader } from '../modules/reports/pdf/branding';

export interface ReportsPdfJob {
  shopId:     string;
  exportId:   string;
  reportType: ReportType;
  params:     Record<string, unknown>;
}

@Processor('reports-pdf')
export class ReportsPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsPdfProcessor.name);

  constructor(
    @Inject(ReportsService)  private readonly reports: ReportsService,
    @Inject(PdfRenderer)     private readonly renderer: PdfRenderer,
    @Inject(STORAGE_PORT)    private readonly storage: StoragePort,
    @Inject(BrandingLoader)  private readonly branding: BrandingLoader,
    @Inject('PG_POOL')       private readonly pool: Pool,
  ) {
    super();
  }

  async process(job: Job<ReportsPdfJob>): Promise<{ storageKey: string }> {
    const { shopId, exportId, reportType, params } = job.data;
    this.logger.log(`reports-pdf: shopId=${shopId} exportId=${exportId} type=${reportType}`);

    const ctx = await this.buildTenantCtx(shopId);

    return tenantContext.runWith(ctx, async () => {
      // 1. Mark RUNNING (idempotent on retries — only QUEUED → RUNNING)
      await withTenantTx(this.pool, async (tx) => {
        await tx.query(
          `UPDATE reports_pdf_exports
           SET status = 'RUNNING'
           WHERE id = $1 AND status = 'QUEUED'`,
          [exportId],
        );
      });

      try {
        // 2. Fetch report data
        const data = await this.fetchReportData(reportType, params);

        // 3. Render PDF
        const branding = await this.branding.load();
        const buf = await this.renderer.render(reportType, data, branding);

        // 4. Upload
        const filename = `${reportType}-${exportId}.pdf`;
        const key = `tenants/${shopId}/reports/${reportType}/${filename}`;
        await this.storage.uploadBuffer(key, buf, 'application/pdf');

        // 5. Mark READY
        await withTenantTx(this.pool, async (tx) => {
          await tx.query(
            `UPDATE reports_pdf_exports
             SET status = 'READY', storage_key = $2, completed_at = now()
             WHERE id = $1`,
            [exportId, key],
          );
        });

        return { storageKey: key };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        await withTenantTx(this.pool, async (tx) => {
          await tx.query(
            `UPDATE reports_pdf_exports
             SET status = 'FAILED', error_message = $2, completed_at = now()
             WHERE id = $1`,
            [exportId, message.slice(0, 500)],
          );
        });
        throw err;
      }
    });
  }

  private async fetchReportData(
    reportType: ReportType,
    params: Record<string, unknown>,
  ): Promise<ReportData> {
    switch (reportType) {
      case 'daily-summary': {
        const date = (params['date'] as string) ??
          new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return this.reports.getDailySummary(date);
      }
      case 'outstanding':
        return this.reports.getOutstanding(1, 1000);
      case 'customer-ltv':
        return this.reports.getCustomerLtv((params['limit'] as number) ?? 50);
      case 'loyalty-summary':
        return this.reports.getLoyaltySummary();
      case 'stock-aging':
        return this.reports.getStockAging();
      default:
        throw new Error(`reports.pdf.unknown_report_type:${reportType}`);
    }
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param
  private async buildTenantCtx(shopId: string): Promise<TenantContext> {
    const r = await this.pool.query<{
      id: string; slug: string; display_name: string; status: Tenant['status'];
    }>(`SELECT id, slug, display_name, status FROM shops WHERE id = $1`, [shopId]);
    const row = r.rows[0];
    if (!row) throw new Error(`reports-pdf: shop ${shopId} not found`);
    return {
      authenticated: false,
      shopId,
      tenant: { id: row.id, slug: row.slug, display_name: row.display_name, status: row.status },
    };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `reports-pdf failed: jobId=${job?.id} exportId=${(job?.data as { exportId?: string })?.exportId} error=${error.message}`,
      error.stack,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @goldsmith/api test reports-pdf.processor.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workers/reports-pdf.processor.ts apps/api/src/workers/reports-pdf.processor.spec.ts
git commit -m "feat(ws-3a): add ReportsPdfProcessor BullMQ worker"
```

---

## Task C13: Wire `ReportsModule` + add 3 `/exports*` controller routes

**Files:**
- Modify: `apps/api/src/modules/reports/reports.module.ts`
- Modify: `apps/api/src/modules/reports/reports.controller.ts`

- [ ] **Step 1: Update `ReportsModule`**

Replace the contents of `apps/api/src/modules/reports/reports.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from '@goldsmith/integrations-storage';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { BrandingLoader } from './pdf/branding';
import { PdfRenderer } from './pdf/renderer';
import { ReportsPdfProcessor } from '../../workers/reports-pdf.processor';

@Module({
  imports: [
    AuthModule,
    StorageModule,
    BullModule.registerQueue({ name: 'reports-pdf' }),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsExportService,
    BrandingLoader,
    PdfRenderer,
    ReportsPdfProcessor,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
```

- [ ] **Step 2: Add 3 controller routes**

Edit `apps/api/src/modules/reports/reports.controller.ts`:

1. Update imports — add `Body, Param, Post`, `ZodValidationPipe`, and `ReportsExportService`/`Inject`:

```typescript
import {
  Controller, Get, Post, Body, Param, Query, Inject,
  ParseIntPipe, DefaultValuePipe, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem, LoyaltySummaryResult,
  StockAgingResult,
} from './reports.service';
import {
  toDailySummaryCsv, toOutstandingCsv, toCustomerLtvCsv,
  toLoyaltySummaryCsv, toStockAgingCsv,
} from './reports.csv';
import { ReportsExportService } from './reports-export.service';
import type { ExportStatusResult } from './reports-export.service';
import type { ReportType } from './pdf/renderer';

const ExportRequestSchema = z.object({
  reportType: z.enum(['daily-summary', 'outstanding', 'customer-ltv', 'loyalty-summary', 'stock-aging']),
  params: z.record(z.unknown()).optional().default({}),
});
type ExportRequestDto = z.infer<typeof ExportRequestSchema>;
```

2. Update the constructor to inject the export service:

```typescript
constructor(
  private readonly svc: ReportsService,
  @Inject(ReportsExportService) private readonly exports: ReportsExportService,
) {}
```

3. Append three new methods at the bottom of the class (before `private todayIST()`):

```typescript
@TenantWalkerRoute({
  expectedStatus: 400,
  body: { /* missing reportType triggers Zod 400 */ },
})
@Post('/exports')
@Roles('shop_admin', 'shop_manager')
async createExport(
  @Body(new ZodValidationPipe(ExportRequestSchema)) dto: ExportRequestDto,
): Promise<{ id: string; status: 'QUEUED' }> {
  return this.exports.enqueue(dto.reportType as ReportType, dto.params);
}

@TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-4000-8000-000000000000' } })
@Get('/exports/:id')
@Roles('shop_admin', 'shop_manager')
async getExportStatus(@Param('id') id: string): Promise<ExportStatusResult> {
  return this.exports.getStatus(id);
}

@TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-4000-8000-000000000000' } })
@Post('/exports/:id/regenerate')
@Roles('shop_admin', 'shop_manager')
async regenerateExport(@Param('id') id: string): Promise<ExportStatusResult> {
  return this.exports.regenerate(id);
}
```

- [ ] **Step 3: Verify typecheck + endpoint walker + integration**

```bash
pnpm --filter @goldsmith/api typecheck
pnpm --filter @goldsmith/api test:e2e
pnpm --filter @goldsmith/api test
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/reports/reports.module.ts apps/api/src/modules/reports/reports.controller.ts
git commit -m "feat(ws-3a): wire ReportsModule providers + 3 /exports routes"
```

---

# WS-D — Shopkeeper UI

## Task D1: `useStockAging` hook + add stock-aging route

**Files:**
- Modify: `apps/shopkeeper/src/features/reports/useReports.ts`
- Modify: `apps/shopkeeper/app/reports/_layout.tsx`

- [ ] **Step 1: Add types and hook to `useReports.ts`**

Append to `apps/shopkeeper/src/features/reports/useReports.ts`:

```typescript
export interface StockAgingBucket {
  label: '<30d' | '30-60d' | '60-90d' | '90d+';
  count: number;
  totalWeightMg: string;
  totalCostPaise: string;
}

export interface StockAgingItem {
  id: string;
  sku: string;
  metal: string;
  purity: string;
  weightG: string;
  daysInStock: number;
  bucket: StockAgingBucket['label'];
  costPaise: string | null;
  firstListedAt: string;
}

export interface StockAgingData {
  buckets: StockAgingBucket[];
  items: StockAgingItem[];
}

export function useStockAging(): UseQueryResult<StockAgingData> {
  return useQuery({
    queryKey: ['reports', 'stock-aging'],
    queryFn: async () => {
      const res = await api.get<StockAgingData>(`/api/v1/reports/stock-aging`);
      return res.data;
    },
    staleTime: 300_000,
  });
}
```

- [ ] **Step 2: Register stock-aging route in `_layout.tsx`**

Edit `apps/shopkeeper/app/reports/_layout.tsx` — add a `<Stack.Screen>` line:

```typescript
<Stack.Screen name="stock-aging"      options={{ title: 'पुराना स्टॉक' }} />
```

Final `_layout.tsx`:

```typescript
import React from 'react';
import { Stack } from 'expo-router';

export default function ReportsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="gstr-export"       options={{ title: 'GST रिपोर्ट' }} />
      <Stack.Screen name="daily-summary"     options={{ title: 'दैनिक बिक्री' }} />
      <Stack.Screen name="outstanding"       options={{ title: 'बकाया भुगतान' }} />
      <Stack.Screen name="customer-ltv"      options={{ title: 'शीर्ष ग्राहक' }} />
      <Stack.Screen name="loyalty-summary"   options={{ title: 'लॉयल्टी कार्यक्रम' }} />
      <Stack.Screen name="stock-aging"       options={{ title: 'पुराना स्टॉक' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/shopkeeper/src/features/reports/useReports.ts apps/shopkeeper/app/reports/_layout.tsx
git commit -m "feat(ws-3a): add useStockAging hook + register stock-aging route"
```

---

## Task D2: Stock-aging mobile screen

**Files:**
- Create: `apps/shopkeeper/app/reports/stock-aging.tsx`

- [ ] **Step 1: Implement screen**

Create `apps/shopkeeper/app/reports/stock-aging.tsx`:

```typescript
import React from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet, Pressable,
} from 'react-native';
import { colors, spacing } from '@goldsmith/ui-tokens';
import {
  useStockAging, formatPaise, formatWeightMg,
  type StockAgingBucket,
} from '../../src/features/reports/useReports';

const GOLD = '#B58A3C';
const ALERT = '#C53030';

const BUCKET_LABELS: Record<StockAgingBucket['label'], string> = {
  '<30d':   '0–30 दिन',
  '30-60d': '30–60 दिन',
  '60-90d': '60–90 दिन',
  '90d+':   '90+ दिन',
};

function BucketCard({ bucket }: { bucket: StockAgingBucket }): React.ReactElement {
  const isAlert = bucket.label === '90d+' && bucket.count > 0;
  return (
    <View style={[styles.bucketCard, isAlert && styles.bucketCardAlert]}>
      <Text style={[styles.bucketLabel, isAlert && styles.bucketLabelAlert]}>
        {BUCKET_LABELS[bucket.label]}
      </Text>
      <Text style={[styles.bucketCount, isAlert && styles.bucketCountAlert]}>
        {bucket.count}
      </Text>
      <Text style={styles.bucketSubLabel}>{formatWeightMg(bucket.totalWeightMg)}</Text>
      <Text style={styles.bucketSubLabel}>{formatPaise(bucket.totalCostPaise)}</Text>
    </View>
  );
}

export default function StockAgingScreen(): React.ReactElement {
  const { data, isLoading, error, refetch } = useStockAging();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isLoading && (
        <ActivityIndicator color={GOLD} size="large" style={{ marginTop: 40 }} />
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>डेटा लोड नहीं हो सका।</Text>
          <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>पुनः प्रयास करें</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <>
          <View style={styles.bucketRow}>
            {data.buckets.map((b) => <BucketCard key={b.label} bucket={b} />)}
          </View>

          <Text style={styles.sectionHeader}>प्रत्येक उत्पाद / Per-Product</Text>

          {data.items.length === 0 && (
            <Text style={styles.emptyText}>कोई स्टॉक नहीं मिला।</Text>
          )}

          {data.items.map((it) => {
            const isAged = it.bucket === '90d+';
            return (
              <View key={it.id} style={[styles.itemRow, isAged && styles.itemRowAlert]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemSku}>{it.sku}</Text>
                  <Text style={styles.itemSubLabel}>
                    {it.metal} {it.purity} · {it.weightG} g
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={[styles.itemDays, isAged && styles.itemDaysAlert]}>
                    {it.daysInStock} दिन
                  </Text>
                  <Text style={styles.itemBucket}>{BUCKET_LABELS[it.bucket]}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg },
  content:          { padding: spacing.lg, paddingBottom: 40 },
  bucketRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  bucketCard:       { flexBasis: '48%', flexGrow: 1, padding: spacing.md, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minHeight: 96 },
  bucketCardAlert:  { borderColor: ALERT, backgroundColor: '#FFF5F5' },
  bucketLabel:      { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: colors.inkMute },
  bucketLabelAlert: { color: ALERT },
  bucketCount:      { fontFamily: 'MuktaVaani-700', fontSize: 28, color: GOLD, marginVertical: 4 },
  bucketCountAlert: { color: ALERT },
  bucketSubLabel:   { fontFamily: 'NotoSansDevanagari', fontSize: 11, color: colors.inkMute },
  sectionHeader:    { fontFamily: 'NotoSansDevanagari', fontSize: 16, fontWeight: '600', color: colors.ink, marginTop: 16, marginBottom: 8 },
  itemRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, minHeight: 48 },
  itemRowAlert:     { backgroundColor: '#FFF5F5' },
  itemSku:          { fontFamily: 'MuktaVaani-600', fontSize: 14, color: colors.ink },
  itemSubLabel:     { fontFamily: 'NotoSansDevanagari', fontSize: 12, color: colors.inkMute, marginTop: 2 },
  itemRight:        { alignItems: 'flex-end' },
  itemDays:         { fontFamily: 'MuktaVaani-600', fontSize: 14, color: colors.ink },
  itemDaysAlert:    { color: ALERT },
  itemBucket:       { fontFamily: 'NotoSansDevanagari', fontSize: 11, color: colors.inkMute, marginTop: 2 },
  emptyText:        { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: colors.inkMute, textAlign: 'center', marginTop: 24 },
  errorBox:         { alignItems: 'center', marginTop: 40 },
  errorText:        { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.error, marginBottom: 16 },
  retryBtn:         { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  retryText:        { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/shopkeeper/app/reports/stock-aging.tsx
git commit -m "feat(ws-3a): add stock-aging shopkeeper screen with bucket cards"
```

---

## Task D3: `useReportExport` polling hook

**Files:**
- Create: `apps/shopkeeper/src/features/reports/useReportExport.ts`

- [ ] **Step 1: Implement hook**

Create `apps/shopkeeper/src/features/reports/useReportExport.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import { Linking } from 'react-native';
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { api } from '../../api/client';

export type ReportType =
  | 'daily-summary' | 'outstanding' | 'customer-ltv'
  | 'loyalty-summary' | 'stock-aging';

export type ExportStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';

export interface ExportStatusResponse {
  id:             string;
  reportType:     ReportType;
  status:         ExportStatus;
  downloadUrl?:   string;
  blobExpiresAt?: string;
  errorMessage?:  string;
}

export interface UseReportExportResult {
  status:         ExportStatus | 'IDLE';
  exportId:       string | null;
  downloadUrl?:   string;
  errorMessage?:  string;
  start:          (params?: Record<string, unknown>) => void;
  regenerate:     () => Promise<void>;
  reset:          () => void;
}

export function useReportExport(reportType: ReportType): UseReportExportResult {
  const [exportId, setExportId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const res = await api.post<{ id: string; status: 'QUEUED' }>(
        '/api/v1/reports/exports',
        { reportType, params },
      );
      return res.data;
    },
    onSuccess: (data) => setExportId(data.id),
  });

  const status = useQuery({
    queryKey: ['reports', 'exports', exportId],
    queryFn: async (): Promise<ExportStatusResponse> => {
      const res = await api.get<ExportStatusResponse>(`/api/v1/reports/exports/${exportId!}`);
      return res.data;
    },
    enabled: exportId !== null,
    refetchInterval: (q) => {
      const data = q.state.data as ExportStatusResponse | undefined;
      if (!data) return 2000;
      if (data.status === 'READY' || data.status === 'FAILED') return false;
      return 2000;
    },
  });

  // Auto-open when ready (single-trigger)
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  useEffect(() => {
    const data = status.data;
    if (data && data.status === 'READY' && data.downloadUrl && openedFor !== data.id) {
      setOpenedFor(data.id);
      void Linking.openURL(data.downloadUrl);
    }
  }, [status.data, openedFor]);

  const regenerate = useCallback(async () => {
    if (!exportId) return;
    const res = await api.post<ExportStatusResponse>(`/api/v1/reports/exports/${exportId}/regenerate`);
    if (res.data.status === 'READY' && res.data.downloadUrl) {
      void Linking.openURL(res.data.downloadUrl);
    }
    void status.refetch();
  }, [exportId, status]);

  const reset = useCallback(() => {
    setExportId(null);
    setOpenedFor(null);
  }, []);

  return {
    status:        exportId === null ? 'IDLE' : (status.data?.status ?? 'QUEUED'),
    exportId,
    downloadUrl:   status.data?.downloadUrl,
    errorMessage:  status.data?.errorMessage,
    start:         (params) => start.mutate(params ?? {}),
    regenerate,
    reset,
  };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/shopkeeper/src/features/reports/useReportExport.ts
git commit -m "feat(ws-3a): add useReportExport polling hook"
```

---

## Task D4: `ExportButtons` component

**Files:**
- Create: `apps/shopkeeper/src/features/reports/components/ExportButtons.tsx`

- [ ] **Step 1: Implement component**

Create `apps/shopkeeper/src/features/reports/components/ExportButtons.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking, Share, StyleSheet } from 'react-native';
import { colors } from '@goldsmith/ui-tokens';
import { api } from '../../../api/client';
import { useReportExport, type ReportType } from '../useReportExport';

const GOLD = '#B58A3C';

// Mirror of the existing GSTR pattern (apps/shopkeeper/app/reports/gstr-export.tsx:28).
// Android Share API caps EXTRA_TEXT around ~100 KB; we surface a clear Hindi error
// at 80 KB rather than letting the system silently truncate. Stock-aging in large
// shops is the most likely report to hit this — instruct user to use PDF instead.
const SHARE_TEXT_LIMIT_BYTES = 80 * 1024;

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

interface ExportButtonsProps {
  reportType: ReportType;
  csvParams?: Record<string, string | number | undefined>;
  pdfParams?: Record<string, unknown>;
}

export function ExportButtons(props: ExportButtonsProps): React.ReactElement {
  const { reportType, csvParams = {}, pdfParams } = props;
  const pdf = useReportExport(reportType);

  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const onCsvPress = async (): Promise<void> => {
    setCsvError(null);
    setCsvBusy(true);
    try {
      const res = await api.get<{ csv: string; filename: string }>(
        `/api/v1/reports/${reportType}.csv`,
        { params: csvParams },
      );
      if (utf8ByteLength(res.data.csv) > SHARE_TEXT_LIMIT_BYTES) {
        setCsvError('यह रिपोर्ट बहुत बड़ी है — कृपया PDF का उपयोग करें।');
        return;
      }
      await Share.share({ title: res.data.filename, message: res.data.csv });
    } catch {
      setCsvError('CSV डाउनलोड नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      setCsvBusy(false);
    }
  };

  const onPdfPress = (): void => {
    if (pdf.status === 'IDLE' || pdf.status === 'FAILED') {
      pdf.start(pdfParams);
    } else if (pdf.status === 'READY' && pdf.downloadUrl) {
      void Linking.openURL(pdf.downloadUrl);
    }
  };

  const pdfLabel = ({
    IDLE:    'PDF डाउनलोड',
    QUEUED:  'तैयार हो रहा...',
    RUNNING: 'तैयार हो रहा...',
    READY:   'PDF खोलें',
    FAILED:  'पुनः प्रयास',
  })[pdf.status];

  const isPdfBusy = pdf.status === 'QUEUED' || pdf.status === 'RUNNING';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onCsvPress}
        disabled={csvBusy}
        style={[styles.csvBtn, csvBusy && styles.btnBusy]}
        accessibilityRole="button"
        accessibilityLabel="CSV डाउनलोड"
      >
        {csvBusy && <ActivityIndicator size="small" color={GOLD} style={{ marginRight: 8 }} />}
        <Text style={styles.csvBtnText}>CSV डाउनलोड</Text>
      </Pressable>

      <Pressable
        onPress={onPdfPress}
        disabled={isPdfBusy}
        style={[styles.pdfBtn, isPdfBusy && styles.pdfBtnBusy]}
        accessibilityRole="button"
        accessibilityLabel={pdfLabel}
      >
        {isPdfBusy && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
        <Text style={styles.pdfBtnText}>{pdfLabel}</Text>
      </Pressable>

      {csvError && (
        <Text style={styles.errorText} numberOfLines={2}>{csvError}</Text>
      )}
      {pdf.status === 'FAILED' && pdf.errorMessage && (
        <Text style={styles.errorText} numberOfLines={2}>
          त्रुटि: {pdf.errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  csvBtn:        { flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: GOLD, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  csvBtnText:    { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: GOLD, fontWeight: '600' },
  pdfBtn:        { flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  pdfBtnBusy:    { backgroundColor: '#A07832' },
  pdfBtnText:    { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: '#fff', fontWeight: '600' },
  btnBusy:       { opacity: 0.7 },
  errorText:     { width: '100%', fontFamily: 'NotoSansDevanagari', fontSize: 12, color: colors.error, marginTop: 4 },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/shopkeeper/src/features/reports/components/ExportButtons.tsx
git commit -m "feat(ws-3a): add ExportButtons (CSV download + PDF poll-and-open)"
```

---

## Task D5: Wire `<ExportButtons>` into 5 existing report screens

**Files:**
- Modify: `apps/shopkeeper/app/reports/daily-summary.tsx`
- Modify: `apps/shopkeeper/app/reports/outstanding.tsx`
- Modify: `apps/shopkeeper/app/reports/customer-ltv.tsx`
- Modify: `apps/shopkeeper/app/reports/loyalty-summary.tsx`
- Modify: `apps/shopkeeper/app/reports/stock-aging.tsx`

For each screen, add an import and place `<ExportButtons>` near the top of the rendered output (under the section header / date picker, before the data card).

- [ ] **Step 1: Update `daily-summary.tsx`**

Add import:
```typescript
import { ExportButtons } from '../../src/features/reports/components/ExportButtons';
```

Inside the `<ScrollView>`, after the date picker `</View>` and before `{isLoading && ...}`, add:
```typescript
<ExportButtons
  reportType="daily-summary"
  csvParams={{ date }}
  pdfParams={{ date }}
/>
```

- [ ] **Step 2: Update `outstanding.tsx`**

Add the same import. Inside the main render, near the top (under any header content if present, before the list/loader):
```typescript
<ExportButtons reportType="outstanding" />
```

- [ ] **Step 3: Update `customer-ltv.tsx`**

Add the import. Insert (adapt `limit` to the existing screen's local state, default 20):
```typescript
<ExportButtons
  reportType="customer-ltv"
  csvParams={{ limit }}
  pdfParams={{ limit }}
/>
```

- [ ] **Step 4: Update `loyalty-summary.tsx`**

Add the import:
```typescript
<ExportButtons reportType="loyalty-summary" />
```

- [ ] **Step 5: Update `stock-aging.tsx`**

Add the import. Insert above `<BucketCard>` row:
```typescript
<ExportButtons reportType="stock-aging" />
```

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/shopkeeper/app/reports/daily-summary.tsx apps/shopkeeper/app/reports/outstanding.tsx apps/shopkeeper/app/reports/customer-ltv.tsx apps/shopkeeper/app/reports/loyalty-summary.tsx apps/shopkeeper/app/reports/stock-aging.tsx
git commit -m "feat(ws-3a): wire ExportButtons into 5 report screens"
```

---

# Final verification (before push)

After all 26 tasks complete:

- [ ] **Run full API test suite**

```bash
pnpm --filter @goldsmith/api test
pnpm --filter @goldsmith/api test:integration
pnpm --filter @goldsmith/api test:e2e
```

Expected: all green.

- [ ] **Run tenant-isolation walker**

```bash
pnpm test:tenant-isolation
```

Expected: `reports_pdf_exports` enumerated; cross-tenant denial confirmed.

- [ ] **Run Semgrep**

```bash
pnpm semgrep
```

Expected: no new findings (the stock-aging SQL was deliberately written without `WHERE shop_id = $1` to satisfy `goldsmith.require-tenant-transaction`; CSV emitters use the existing escape pattern).

- [ ] **Runtime smoke test**

1. Start API: `C:\gs-api-start.cmd`
2. Start Metro from `C:\gs\apps\shopkeeper`: `npx expo start --dev-client --clear --port 8081`
3. ADB tunnel: `adb -s 192.168.1.80:5555 reverse tcp:8081 tcp:8081`
4. On device:
   - Reports tab → Stock Aging → screen loads, buckets render, no crash
   - Reports tab → Daily Summary → CSV button downloads in browser → PDF button shows "तैयार हो रहा..." → PDF opens after ~5s
   - Reports tab → Outstanding → CSV + PDF cycle works
   - Reports tab → Customer LTV → CSV + PDF cycle works
   - Reports tab → Loyalty Summary → CSV + PDF cycle works
   - PDF text reads correctly in Devanagari (शीर्ष ग्राहक, etc.) — not boxes/glyph fallback

- [ ] **Class B review gate (Codex limit substitute)**

```bash
/code-review
/security-review
```

Expected: both write `.claude-review-passed` and `.security-review-passed` markers, no P0/P1 findings.

- [ ] **Push**

```bash
git push -u origin feat/ws-3a-reports-completion
```

---

## Out-of-scope reminder

Per spec §15 — these are NOT in this story and should be opened as separate follow-ups:

- GSTR PDF export
- Customer-web report exports
- Scheduled/recurring reports
- Email/WhatsApp delivery of finished PDFs
- Per-tenant logo upload UI
- `products.cost_paise` backfill for legacy rows
- Blob GC cron / Azure Blob lifecycle policy for `tenants/<shop>/reports/**`
- Row-level GC of `reports_pdf_exports` past 90 days
