OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\gs-stf-1
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR, C:\Users\alokt\.codex\memories]
reasoning effort: xhigh
reasoning summaries: none
session id: 019dfe97-d288-7eb1-881b-289778a3c60d
--------
user
diff --git a/apps/api/test/storefront-schema-0066.integration.spec.ts b/apps/api/test/storefront-schema-0066.integration.spec.ts
new file mode 100644
index 0000000..d150102
--- /dev/null
+++ b/apps/api/test/storefront-schema-0066.integration.spec.ts
@@ -0,0 +1,216 @@
+// apps/api/test/storefront-schema-0066.integration.spec.ts
+//
+// Mandatory spec tests T3–T6 + weight-column invariant.
+// UUID prefix cc4xxxxx — non-overlapping with other test files.
+
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
+import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
+
+// ---------------------------------------------------------------------------
+// Fixture UUIDs — non-overlapping with other integration test files
+// ---------------------------------------------------------------------------
+const SHOP_A = 'cc400001-cc00-4000-cc00-000000000001';
+
+const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0066-a', display_name: '0066 Shop A', status: 'ACTIVE' };
+const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+let userAId: string;
+let productAId: string;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
+
+  // Seed shop via raw connection (no RLS on shops table from admin path)
+  const c = await pool.connect();
+  try {
+    await c.query(
+      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'stf-0066-a', '0066 Shop A', 'ACTIVE')`,
+      [SHOP_A],
+    );
+  } finally {
+    c.release();
+  }
+
+  // Seed shop_admin user
+  userAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+           VALUES ($1, '+919400000101', 'Owner 0066', 'shop_admin', 'ACTIVE') RETURNING id`,
+        [SHOP_A],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+  // Seed a published product for index smoke tests (partial indexes filter published_at IS NOT NULL)
+  productAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO products
+           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
+            status, created_by_user_id, published_at, published_by_user_id)
+         VALUES
+           ($1, 'STF0066-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000',
+            'IN_STOCK', $2, NOW(), $2)
+         RETURNING id`,
+        [SHOP_A, userAId],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+}, 180_000);
+
+afterAll(async () => {
+  await pool?.end();
+  await container?.stop();
+});
+
+// ---------------------------------------------------------------------------
+// T3 — CHECK constraint blocks invalid style
+// ---------------------------------------------------------------------------
+describe('migration 0066: style CHECK constraint', () => {
+  it('rejects style = UNKNOWN with CHECK violation (23514)', async () => {
+    await expect(
+      tenantContext.runWith(ctxA, () =>
+        withTenantTx(pool, (tx) =>
+          tx.query(`UPDATE products SET style = 'UNKNOWN' WHERE id = $1`, [productAId]),
+        ),
+      ),
+    ).rejects.toMatchObject({ code: '23514' });
+  });
+
+  it('accepts every valid style value without error', async () => {
+    const validStyles = [
+      'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
+      'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS',
+    ];
+    for (const style of validStyles) {
+      await expect(
+        tenantContext.runWith(ctxA, () =>
+          withTenantTx(pool, (tx) =>
+            tx.query(`UPDATE products SET style = $1 WHERE id = $2`, [style, productAId]),
+          ),
+        ),
+      ).resolves.not.toThrow();
+    }
+  });
+
+  it('accepts NULL style (column is nullable)', async () => {
+    await expect(
+      tenantContext.runWith(ctxA, () =>
+        withTenantTx(pool, (tx) =>
+          tx.query(`UPDATE products SET style = NULL WHERE id = $1`, [productAId]),
+        ),
+      ),
+    ).resolves.not.toThrow();
+  });
+});
+
+// ---------------------------------------------------------------------------
+// Weight column invariant — must remain DECIMAL(12,4) after migration
+// ---------------------------------------------------------------------------
+describe('migration 0066: weight column types unchanged', () => {
+  it('gross_weight_g and net_weight_g remain numeric(12,4)', async () => {
+    const r = await pool.query<{
+      column_name: string;
+      data_type: string;
+      numeric_precision: number;
+      numeric_scale: number;
+    }>(
+      `SELECT column_name, data_type, numeric_precision, numeric_scale
+         FROM information_schema.columns
+        WHERE table_name = 'products'
+          AND column_name IN ('gross_weight_g', 'net_weight_g')
+        ORDER BY column_name`,
+    );
+    expect(r.rows).toHaveLength(2);
+    for (const row of r.rows) {
+      expect(row.data_type).toBe('numeric');
+      expect(row.numeric_precision).toBe(12);
+      expect(row.numeric_scale).toBe(4);
+    }
+  });
+});
+
+// ---------------------------------------------------------------------------
+// T4 — GIN occasion index used by ANY(...)
+// ---------------------------------------------------------------------------
+describe('migration 0066: GIN occasion index', () => {
+  it('planner uses products_occasion_gin_idx for ANY(occasion) filter', async () => {
+    const client = await pool.connect();
+    try {
+      await client.query('SET enable_seqscan = off');
+      // GIN array indexes support @> (containment) operator; use that form
+      // rather than '= ANY()' which the planner may not route through GIN.
+      const r = await client.query<{ 'QUERY PLAN': string }>(
+        `EXPLAIN SELECT id FROM products WHERE occasion @> ARRAY['WEDDING']::text[]`,
+      );
+      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
+      expect(plan).toContain('products_occasion_gin_idx');
+    } finally {
+      await client.query('RESET enable_seqscan');
+      client.release();
+    }
+  });
+});
+
+// ---------------------------------------------------------------------------
+// T5 — composite top-sellers index used by ORDER BY expression
+// ---------------------------------------------------------------------------
+describe('migration 0066: top-sellers expression index', () => {
+  it('planner uses products_top_sellers_idx for (sales*2+views) DESC ORDER BY', async () => {
+    const client = await pool.connect();
+    try {
+      await client.query('SET enable_seqscan = off');
+      const r = await client.query<{ 'QUERY PLAN': string }>(
+        `EXPLAIN SELECT id FROM products
+          WHERE shop_id = $1 AND published_at IS NOT NULL
+          ORDER BY (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC`,
+        [SHOP_A],
+      );
+      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
+      expect(plan).toContain('products_top_sellers_idx');
+    } finally {
+      await client.query('RESET enable_seqscan');
+      client.release();
+    }
+  });
+});
+
+// ---------------------------------------------------------------------------
+// T6 — pg_trgm GIN index used by similarity search
+// ---------------------------------------------------------------------------
+describe('migration 0066: pg_trgm similarity index', () => {
+  it('planner uses products_search_trgm_idx for expression % similarity query', async () => {
+    const client = await pool.connect();
+    try {
+      await client.query('SET enable_seqscan = off');
+      // Lower the similarity threshold so the trgm GIN index is considered.
+      await client.query('SET pg_trgm.similarity_threshold = 0.1');
+      // The index expression is: coalesce(sku,'') || ' ' || coalesce(metal,'') || ' ' || coalesce(purity,'')
+      // Query must match the exact expression to use the index.
+      // No published_at filter here — the index is non-partial so it applies
+      // to all rows; omitting the filter prevents the planner from choosing
+      // a competing partial BTree index instead.
+      const r = await client.query<{ 'QUERY PLAN': string }>(
+        `EXPLAIN SELECT id FROM products
+          WHERE (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, '')) % 'AB-1042'`,
+      );
+      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
+      expect(plan).toContain('products_search_trgm_idx');
+    } finally {
+      await client.query('RESET enable_seqscan');
+      await client.query('RESET pg_trgm.similarity_threshold');
+      client.release();
+    }
+  });
+});
diff --git a/apps/api/test/storefront-schema-0068.integration.spec.ts b/apps/api/test/storefront-schema-0068.integration.spec.ts
new file mode 100644
index 0000000..f9c0339
--- /dev/null
+++ b/apps/api/test/storefront-schema-0068.integration.spec.ts
@@ -0,0 +1,259 @@
+// apps/api/test/storefront-schema-0068.integration.spec.ts
+//
+// Mandatory spec tests T1 (FK cross-tenant) and T2 (trigger SECURITY INVOKER).
+// UUID prefix dd5xxxxx / ee5xxxxx — non-overlapping with other test files.
+
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
+import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
+
+// ---------------------------------------------------------------------------
+// Fixture UUIDs — non-overlapping with other integration test files
+// ---------------------------------------------------------------------------
+const SHOP_A = 'dd500001-dd00-4000-dd00-000000000001';
+const SHOP_B = 'ee500002-ee00-4000-ee00-000000000002';
+
+const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0068-a', display_name: '0068 Shop A', status: 'ACTIVE' };
+const tenantB: Tenant = { id: SHOP_B, slug: 'stf-0068-b', display_name: '0068 Shop B', status: 'ACTIVE' };
+const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
+const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+let userAId: string;
+let userBId: string;
+let productAId: string;
+let productBId: string;
+
+// Inserts a product_images row in the given tenant context.
+const insertImage = (
+  shopId: string,
+  ctx: UnauthenticatedTenantContext,
+  productId: string,
+  uploaderId: string,
+  opts: { sortOrder?: number; scanStatus?: string } = {},
+) =>
+  tenantContext.runWith(ctx, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO product_images
+           (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
+            exif_stripped_at, uploaded_by_user_id, scan_status, sort_order)
+         VALUES
+           ($1, $2, $3, 'image/jpeg', 1234, 800, 600,
+            NOW(), $4, $5, $6)
+         RETURNING id`,
+        [
+          shopId,
+          productId,
+          `tenant/${shopId}/products/${productId}/${Math.random().toString(36).slice(2)}.jpg`,
+          uploaderId,
+          opts.scanStatus ?? 'clean',
+          opts.sortOrder ?? 0,
+        ],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
+
+  // Seed shops via raw connection
+  const c = await pool.connect();
+  try {
+    await c.query(
+      `INSERT INTO shops (id, slug, display_name, status) VALUES
+        ($1, 'stf-0068-a', '0068 Shop A', 'ACTIVE'),
+        ($2, 'stf-0068-b', '0068 Shop B', 'ACTIVE')`,
+      [SHOP_A, SHOP_B],
+    );
+  } finally {
+    c.release();
+  }
+
+  // Seed users
+  userAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+           VALUES ($1, '+919500000101', 'Owner 0068A', 'shop_admin', 'ACTIVE') RETURNING id`,
+        [SHOP_A],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+  userBId = await tenantContext.runWith(ctxB, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+           VALUES ($1, '+919500000102', 'Owner 0068B', 'shop_admin', 'ACTIVE') RETURNING id`,
+        [SHOP_B],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+  // Seed products
+  productAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO products
+           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
+            stone_weight_g, status, created_by_user_id)
+         VALUES ($1, 'STF0068-A-001', 'GOLD', '22K', '10.0000', '9.0000',
+                 '0.0000', 'IN_STOCK', $2)
+         RETURNING id`,
+        [SHOP_A, userAId],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+  productBId = await tenantContext.runWith(ctxB, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO products
+           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
+            stone_weight_g, status, created_by_user_id)
+         VALUES ($1, 'STF0068-B-001', 'GOLD', '22K', '10.0000', '9.0000',
+                 '0.0000', 'IN_STOCK', $2)
+         RETURNING id`,
+        [SHOP_B, userBId],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+}, 180_000);
+
+afterAll(async () => {
+  await pool?.end();
+  await container?.stop();
+});
+
+// ---------------------------------------------------------------------------
+// T1 — primary_image_id FK does not bypass RLS via cross-tenant image
+// ---------------------------------------------------------------------------
+describe('migration 0068: composite FK cross-tenant guard', () => {
+  it('rejects setting primary_image_id to a cross-tenant image (FK violation 23503)', async () => {
+    // Insert a valid image in Shop B for Shop B's product.
+    const imageBId = await insertImage(SHOP_B, ctxB, productBId, userBId);
+
+    // Attempt to point Shop A's product at Shop B's image.
+    // Composite FK (shop_id, primary_image_id) → product_images(shop_id, id) requires
+    // that (SHOP_A, imageBId) exists in product_images — it does not → 23503.
+    await expect(
+      tenantContext.runWith(ctxA, () =>
+        withTenantTx(pool, (tx) =>
+          tx.query(
+            `UPDATE products SET primary_image_id = $1 WHERE id = $2`,
+            [imageBId, productAId],
+          ),
+        ),
+      ),
+    ).rejects.toMatchObject({ code: '23503' });
+  });
+
+  it('allows same-tenant primary_image_id assignment (control)', async () => {
+    // Insert a clean image in Shop A for Shop A's product.
+    const imageAId = await insertImage(SHOP_A, ctxA, productAId, userAId);
+
+    // Same-tenant assignment must succeed.
+    await expect(
+      tenantContext.runWith(ctxA, () =>
+        withTenantTx(pool, (tx) =>
+          tx.query(
+            `UPDATE products SET primary_image_id = $1 WHERE id = $2`,
+            [imageAId, productAId],
+          ),
+        ),
+      ),
+    ).resolves.not.toThrow();
+  });
+});
+
+// ---------------------------------------------------------------------------
+// T2 — maintain trigger respects RLS under SECURITY INVOKER
+// ---------------------------------------------------------------------------
+describe('migration 0068: maintain trigger (SECURITY INVOKER)', () => {
+  it('trigger auto-sets primary_image_id on first clean image INSERT', async () => {
+    // Products start with NULL primary_image_id; inserting a clean image should trigger recompute.
+    await insertImage(SHOP_A, ctxA, productAId, userAId, { sortOrder: 99 });
+
+    // The trigger should have set products.primary_image_id to this image.
+    // Use raw pool connection to bypass RLS for the assertion read.
+    const r = await pool.query<{ primary_image_id: string | null }>(
+      `SELECT primary_image_id FROM products WHERE id = $1`,
+      [productAId],
+    );
+    // primary_image_id must be some image belonging to productA (the one with lowest sort_order)
+    expect(r.rows[0]!.primary_image_id).toBeTruthy();
+  });
+
+  it('trigger NULLs primary_image_id when last clean image is deleted', async () => {
+    // Insert exactly one clean image in a fresh product to have a controlled state.
+    // Use a new product to avoid state from previous test.
+    const freshProductId = await tenantContext.runWith(ctxA, () =>
+      withTenantTx(pool, async (tx) => {
+        const r = await tx.query<{ id: string }>(
+          `INSERT INTO products
+             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
+              stone_weight_g, status, created_by_user_id)
+           VALUES ($1, 'STF0068-A-002', 'GOLD', '22K', '10.0000', '9.0000',
+                   '0.0000', 'IN_STOCK', $2)
+           RETURNING id`,
+          [SHOP_A, userAId],
+        );
+        return r.rows[0]!.id;
+      }),
+    );
+
+    const onlyImageId = await insertImage(SHOP_A, ctxA, freshProductId, userAId, { sortOrder: 0 });
+
+    // Verify trigger set primary_image_id
+    const before = await pool.query<{ primary_image_id: string | null }>(
+      `SELECT primary_image_id FROM products WHERE id = $1`,
+      [freshProductId],
+    );
+    expect(before.rows[0]!.primary_image_id).toBe(onlyImageId);
+
+    // Delete the only clean image as Shop A user
+    await tenantContext.runWith(ctxA, () =>
+      withTenantTx(pool, (tx) =>
+        tx.query(`DELETE FROM product_images WHERE id = $1`, [onlyImageId]),
+      ),
+    );
+
+    // Trigger must have NULLed primary_image_id (no more clean images)
+    const after = await pool.query<{ primary_image_id: string | null }>(
+      `SELECT primary_image_id FROM products WHERE id = $1`,
+      [freshProductId],
+    );
+    expect(after.rows[0]!.primary_image_id).toBeNull();
+  });
+
+  it('trigger does not affect other tenant products (RLS under SECURITY INVOKER)', async () => {
+    // Record Shop B product primary_image_id before any Shop A operation
+    const beforeB = await pool.query<{ primary_image_id: string | null }>(
+      `SELECT primary_image_id FROM products WHERE id = $1`,
+      [productBId],
+    );
+    const bPrimaryBefore = beforeB.rows[0]!.primary_image_id;
+
+    // Insert a new image in Shop A (triggers recompute for Shop A's product only)
+    await insertImage(SHOP_A, ctxA, productAId, userAId, { sortOrder: 0 });
+
+    // Shop B's product primary_image_id must be unchanged
+    const afterB = await pool.query<{ primary_image_id: string | null }>(
+      `SELECT primary_image_id FROM products WHERE id = $1`,
+      [productBId],
+    );
+    expect(afterB.rows[0]!.primary_image_id).toBe(bPrimaryBefore);
+  });
+});
diff --git a/docs/superpowers/plans/2026-05-05-ws-3a-reports-completion-plan.md b/docs/superpowers/plans/2026-05-05-ws-3a-reports-completion-plan.md
new file mode 100644
index 0000000..7ed2de6
--- /dev/null
+++ b/docs/superpowers/plans/2026-05-05-ws-3a-reports-completion-plan.md
@@ -0,0 +1,3685 @@
+# WS-3A — Reports Completion Implementation Plan
+
+> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
+
+**Goal:** Ship FR117 (stock-aging endpoint with `<30d / 30-60d / 60-90d / 90d+` buckets) and FR119 (CSV+PDF export for `daily-summary`, `outstanding`, `customer-ltv`, `loyalty-summary`, `stock-aging`) — sync CSV downloads + async PDFKit-rendered PDFs delivered via BullMQ + signed URL.
+
+**Architecture:** New endpoints alongside the existing `apps/api/src/modules/reports/`. CSV is sync (controller streams `text/csv`). PDF is async: `POST /reports/exports` inserts a row in `reports_pdf_exports` (migration 0072) and enqueues a `reports-pdf` BullMQ job; the processor renders via PDFKit, uploads to `STORAGE_PORT`, and updates the row. Client polls `GET /reports/exports/:id`. Mirrors the existing `apps/api/src/workers/gstr-export.processor.ts` pattern 1:1.
+
+**Tech Stack:** NestJS + `@nestjs/bullmq` + Drizzle/pg + `pdfkit` (new dep) + Noto Sans Devanagari TTFs + `@goldsmith/integrations-storage` + `@goldsmith/audit`. Mobile: Expo + TanStack Query.
+
+**Spec:** `docs/superpowers/specs/2026-05-05-ws-3a-reports-completion-design.md` (commit `41753e3`)
+
+---
+
+## File structure
+
+### Create (22 files)
+
+| Path | Responsibility |
+|---|---|
+| `packages/db/src/migrations/0072_reports_pdf_exports.sql` | Job table + RLS + grants |
+| `apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf` | Devanagari font (binary) |
+| `apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf` | Devanagari bold (binary) |
+| `apps/api/src/modules/reports/reports.csv.ts` | Pure CSV emitters per report |
+| `apps/api/src/modules/reports/reports.csv.spec.ts` | CSV emitter unit tests |
+| `apps/api/src/modules/reports/reports-export.service.ts` | Enqueue / poll / regenerate orchestration |
+| `apps/api/src/modules/reports/reports-export.service.spec.ts` | Export-service unit tests |
+| `apps/api/src/modules/reports/pdf/branding.ts` | Fetches `shops.{display_name, logo_url, address_json, gstin}` |
+| `apps/api/src/modules/reports/pdf/header.ts` | `drawHeader(doc, branding)` |
+| `apps/api/src/modules/reports/pdf/footer.ts` | `drawFooter(doc, branding, pageNum, totalPages)` |
+| `apps/api/src/modules/reports/pdf/renderer.ts` | `PdfRenderer.render(reportType, data, branding) → Buffer` |
+| `apps/api/src/modules/reports/pdf/renderer.spec.ts` | Buffer-shape tests for each template |
+| `apps/api/src/modules/reports/pdf/templates/daily-summary.ts` | PDFKit layout |
+| `apps/api/src/modules/reports/pdf/templates/outstanding.ts` | PDFKit layout |
+| `apps/api/src/modules/reports/pdf/templates/customer-ltv.ts` | PDFKit layout |
+| `apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts` | PDFKit layout |
+| `apps/api/src/modules/reports/pdf/templates/stock-aging.ts` | PDFKit layout |
+| `apps/api/src/workers/reports-pdf.processor.ts` | BullMQ processor |
+| `apps/api/src/workers/reports-pdf.processor.spec.ts` | Processor unit tests |
+| `apps/shopkeeper/app/reports/stock-aging.tsx` | New mobile screen |
+| `apps/shopkeeper/src/features/reports/useReportExport.ts` | Polling hook for export readiness |
+| `apps/shopkeeper/src/features/reports/components/ExportButtons.tsx` | Reusable CSV/PDF buttons |
+
+### Modify (9 files)
+
+| Path | What changes |
+|---|---|
+| `apps/api/package.json` | Add `pdfkit` + `@types/pdfkit` |
+| `apps/api/src/modules/reports/reports.service.ts` | Add `getStockAging()` + types |
+| `apps/api/src/modules/reports/reports.service.spec.ts` | Add stock-aging tests |
+| `apps/api/src/modules/reports/reports.controller.ts` | Add 1 stock-aging GET + 5 `.csv` GETs + 3 `/exports*` routes |
+| `apps/api/src/modules/reports/reports.module.ts` | Wire `BullModule.registerQueue('reports-pdf')`, `StorageModule`, new providers, processor |
+| `packages/audit/src/audit-actions.ts` | Add `REPORT_EXPORT_REQUESTED`, `REPORT_EXPORT_REGENERATED` |
+| `apps/shopkeeper/src/features/reports/useReports.ts` | Add `useStockAging` |
+| `apps/shopkeeper/app/reports/_layout.tsx` | Add stock-aging route |
+| `apps/shopkeeper/app/reports/daily-summary.tsx` (+ outstanding, customer-ltv, loyalty-summary, gstr-export) | Render `<ExportButtons>` |
+
+---
+
+## Work streams overview
+
+| WS | Tasks | Description |
+|---|---|---|
+| **WS-A** | A1 – A2 | Stock-aging endpoint (FR117) |
+| **WS-B** | B1 – B6 | CSV sync exports for 5 reports (FR119 CSV half) |
+| **WS-C** | C1 – C13 | PDF async pipeline (migration, fonts, deps, branding, templates, service, processor, module wiring) |
+| **WS-D** | D1 – D5 | Shopkeeper UI: stock-aging screen + export-button plumbing |
+
+WS-A and WS-B are independent and can run in parallel. WS-C blocks WS-D's export buttons. TDD per task.
+
+---
+
+# WS-A — Stock-aging endpoint (FR117)
+
+## Task A1: Implement `ReportsService.getStockAging`
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.service.ts`
+- Test: `apps/api/src/modules/reports/reports.service.spec.ts`
+
+- [ ] **Step 1: Write the failing tests**
+
+Add to `apps/api/src/modules/reports/reports.service.spec.ts` (append after the last `describe` block):
+
+```typescript
+// ---------------------------------------------------------------------------
+// getStockAging
+// ---------------------------------------------------------------------------
+describe('getStockAging', () => {
+  it('aggregates products into 4 age buckets with counts and totals', async () => {
+    fakeTx = {
+      query: vi.fn().mockResolvedValue({
+        rows: [
+          // <30d
+          { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K', weight_g: '5.000',
+            cost_paise: '5000000', created_at: new Date(Date.now() - 10 * 86400_000), days_in_stock: 10, bucket: '<30d' },
+          { id: 'p2', sku: 'R-002', metal: 'GOLD', purity: '22K', weight_g: '3.000',
+            cost_paise: '3000000', created_at: new Date(Date.now() - 20 * 86400_000), days_in_stock: 20, bucket: '<30d' },
+          // 30-60d
+          { id: 'p3', sku: 'C-001', metal: 'SILVER', purity: '92.5', weight_g: '50.000',
+            cost_paise: '500000', created_at: new Date(Date.now() - 45 * 86400_000), days_in_stock: 45, bucket: '30-60d' },
+          // 60-90d
+          { id: 'p4', sku: 'C-002', metal: 'GOLD', purity: '22K', weight_g: '4.000',
+            cost_paise: null, created_at: new Date(Date.now() - 75 * 86400_000), days_in_stock: 75, bucket: '60-90d' },
+          // 90d+
+          { id: 'p5', sku: 'B-001', metal: 'GOLD', purity: '22K', weight_g: '8.000',
+            cost_paise: '8000000', created_at: new Date(Date.now() - 120 * 86400_000), days_in_stock: 120, bucket: '90d+' },
+        ],
+      }),
+    };
+
+    const svc = makeService();
+    const result = await svc.getStockAging();
+
+    expect(result.buckets).toHaveLength(4);
+    const byLabel = Object.fromEntries(result.buckets.map((b) => [b.label, b]));
+    expect(byLabel['<30d']!.count).toBe(2);
+    expect(byLabel['<30d']!.totalWeightMg).toBe('8000');     // (5 + 3) * 1000
+    expect(byLabel['<30d']!.totalCostPaise).toBe('8000000'); // 5000000 + 3000000
+    expect(byLabel['30-60d']!.count).toBe(1);
+    expect(byLabel['60-90d']!.count).toBe(1);
+    expect(byLabel['60-90d']!.totalCostPaise).toBe('0');     // null cost excluded
+    expect(byLabel['90d+']!.count).toBe(1);
+    expect(result.items).toHaveLength(5);
+    expect(result.items[0]!.bucket).toBeDefined();
+  });
+
+  it('returns all 4 buckets even when some are empty', async () => {
+    fakeTx = { query: vi.fn().mockResolvedValue({ rows: [] }) };
+    const svc = makeService();
+    const result = await svc.getStockAging();
+    expect(result.buckets).toHaveLength(4);
+    expect(result.buckets.every((b) => b.count === 0)).toBe(true);
+    expect(result.items).toEqual([]);
+  });
+
+  it('boundary: 29d → <30d, 30d → 30-60d, 89d → 60-90d, 90d → 90d+', async () => {
+    fakeTx = {
+      query: vi.fn().mockResolvedValue({
+        rows: [
+          { id: 'a', sku: 'A', metal: 'GOLD', purity: '22K', weight_g: '1.000',
+            cost_paise: '100000', created_at: new Date(), days_in_stock: 29, bucket: '<30d' },
+          { id: 'b', sku: 'B', metal: 'GOLD', purity: '22K', weight_g: '1.000',
+            cost_paise: '100000', created_at: new Date(), days_in_stock: 30, bucket: '30-60d' },
+          { id: 'c', sku: 'C', metal: 'GOLD', purity: '22K', weight_g: '1.000',
+            cost_paise: '100000', created_at: new Date(), days_in_stock: 89, bucket: '60-90d' },
+          { id: 'd', sku: 'D', metal: 'GOLD', purity: '22K', weight_g: '1.000',
+            cost_paise: '100000', created_at: new Date(), days_in_stock: 90, bucket: '90d+' },
+        ],
+      }),
+    };
+    const svc = makeService();
+    const result = await svc.getStockAging();
+    const byLabel = Object.fromEntries(result.buckets.map((b) => [b.label, b]));
+    expect(byLabel['<30d']!.count).toBe(1);
+    expect(byLabel['30-60d']!.count).toBe(1);
+    expect(byLabel['60-90d']!.count).toBe(1);
+    expect(byLabel['90d+']!.count).toBe(1);
+  });
+});
+```
+
+- [ ] **Step 2: Run tests to verify they fail**
+
+```bash
+pnpm --filter @goldsmith/api test reports.service.spec
+```
+
+Expected: FAIL — `svc.getStockAging is not a function`.
+
+- [ ] **Step 3: Implement `getStockAging`**
+
+Add to `apps/api/src/modules/reports/reports.service.ts` (append types near the other interfaces, then add the method to the class):
+
+```typescript
+// Append to interfaces block
+export type StockAgingBucketLabel = '<30d' | '30-60d' | '60-90d' | '90d+';
+
+export interface StockAgingBucket {
+  label: StockAgingBucketLabel;
+  count: number;
+  totalWeightMg: string;
+  totalCostPaise: string;
+}
+
+export interface StockAgingItem {
+  id: string;
+  sku: string;
+  metal: string;
+  purity: string;
+  weightG: string;
+  daysInStock: number;
+  bucket: StockAgingBucketLabel;
+  costPaise: string | null;
+  firstListedAt: string;
+}
+
+export interface StockAgingResult {
+  buckets: StockAgingBucket[];
+  items: StockAgingItem[];
+}
+
+const BUCKET_ORDER: StockAgingBucketLabel[] = ['<30d', '30-60d', '60-90d', '90d+'];
+```
+
+Add the method to the `ReportsService` class (next to the others):
+
+```typescript
+async getStockAging(): Promise<StockAgingResult> {
+  return withTenantTx(this.pool, async (tx) => {
+    const r = await tx.query<{
+      id: string;
+      sku: string;
+      metal: string;
+      purity: string;
+      weight_g: string;
+      cost_paise: string | null;
+      created_at: Date;
+      days_in_stock: number;
+      bucket: StockAgingBucketLabel;
+    }>(
+      // RLS scopes by app.current_shop_id; do NOT add WHERE shop_id = $1
+      // (would shadow RLS predicate; flagged by goldsmith.require-tenant-transaction).
+      `WITH aged AS (
+         SELECT id, sku, metal, purity,
+                gross_weight_g::text AS weight_g,
+                cost_paise::text     AS cost_paise,
+                created_at,
+                FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int AS days_in_stock
+         FROM products
+         WHERE status = 'IN_STOCK'
+       )
+       SELECT *,
+              CASE
+                WHEN days_in_stock <  30 THEN '<30d'
+                WHEN days_in_stock <  60 THEN '30-60d'
+                WHEN days_in_stock <  90 THEN '60-90d'
+                ELSE                          '90d+'
+              END AS bucket
+       FROM aged
+       ORDER BY days_in_stock DESC`,
+      [],
+    );
+
+    const items: StockAgingItem[] = r.rows.map((row) => ({
+      id:             row.id,
+      sku:            row.sku,
+      metal:          row.metal,
+      purity:         row.purity,
+      weightG:        row.weight_g,
+      daysInStock:    row.days_in_stock,
+      bucket:         row.bucket,
+      costPaise:      row.cost_paise,
+      firstListedAt:  row.created_at.toISOString(),
+    }));
+
+    // Aggregate buckets in one pass; ensure all 4 labels present even if empty.
+    const agg = new Map<StockAgingBucketLabel, { count: number; weightMg: bigint; costPaise: bigint }>();
+    for (const label of BUCKET_ORDER) {
+      agg.set(label, { count: 0, weightMg: 0n, costPaise: 0n });
+    }
+    for (const item of items) {
+      const bucket = agg.get(item.bucket)!;
+      bucket.count += 1;
+      // weight_g is "X.YYY"; convert to milligrams via string→bigint to preserve precision.
+      const [whole, frac = '000'] = item.weightG.split('.');
+      const mg = BigInt(whole!) * 1000n + BigInt(frac.padEnd(3, '0').slice(0, 3));
+      bucket.weightMg += mg;
+      if (item.costPaise !== null) bucket.costPaise += BigInt(item.costPaise);
+    }
+
+    const buckets: StockAgingBucket[] = BUCKET_ORDER.map((label) => {
+      const a = agg.get(label)!;
+      return {
+        label,
+        count:          a.count,
+        totalWeightMg:  a.weightMg.toString(),
+        totalCostPaise: a.costPaise.toString(),
+      };
+    });
+
+    return { buckets, items };
+  });
+}
+```
+
+- [ ] **Step 4: Run tests to verify they pass**
+
+```bash
+pnpm --filter @goldsmith/api test reports.service.spec
+```
+
+Expected: PASS — all `getStockAging` tests green plus the existing 9 tests untouched.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.service.ts apps/api/src/modules/reports/reports.service.spec.ts
+git commit -m "feat(ws-3a): add ReportsService.getStockAging with bucket aggregation"
+```
+
+---
+
+## Task A2: Add `GET /reports/stock-aging` route
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.controller.ts`
+
+- [ ] **Step 1: Add the route**
+
+Open `apps/api/src/modules/reports/reports.controller.ts` and:
+
+1. Update the import line at the top to include the new types:
+```typescript
+import type {
+  DailySummaryResult, OutstandingResult, CustomerLtvItem, LoyaltySummaryResult,
+  StockAgingResult,
+} from './reports.service';
+```
+
+2. Append a new method below `getLoyaltySummary`:
+```typescript
+@TenantWalkerRoute({ expectedStatus: 200 })
+@Get('/stock-aging')
+@Roles('shop_admin', 'shop_manager')
+getStockAging(): Promise<StockAgingResult> {
+  return this.svc.getStockAging();
+}
+```
+
+- [ ] **Step 2: Verify typecheck + endpoint walker**
+
+```bash
+pnpm --filter @goldsmith/api typecheck
+pnpm --filter @goldsmith/api test:e2e
+```
+
+Expected: typecheck PASS; endpoint-walker PASS (the new route is auto-discovered via `@TenantWalkerRoute` decorator and probed for cross-tenant denial — `expectedStatus: 200` means the walker expects a 200 response from a properly tenanted call, which is correct because there are no required query params or body).
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.controller.ts
+git commit -m "feat(ws-3a): wire GET /reports/stock-aging route"
+```
+
+---
+
+# WS-B — CSV sync exports (FR119 CSV half)
+
+## Task B1: Create `reports.csv.ts` with `toDailySummaryCsv`
+
+**Files:**
+- Create: `apps/api/src/modules/reports/reports.csv.ts`
+- Create: `apps/api/src/modules/reports/reports.csv.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Create `apps/api/src/modules/reports/reports.csv.spec.ts`:
+
+```typescript
+import { describe, expect, it } from 'vitest';
+import { toDailySummaryCsv } from './reports.csv';
+import type { DailySummaryResult } from './reports.service';
+
+describe('toDailySummaryCsv', () => {
+  it('emits header + one data row with paise→rupees conversion', () => {
+    const data: DailySummaryResult = {
+      date: '2026-04-29',
+      total_paise:    '500000',
+      cash_paise:     '300000',
+      upi_paise:      '200000',
+      other_paise:    '0',
+      invoice_count:  3,
+      gold_weight_mg: '15000',
+    };
+
+    const csv = toDailySummaryCsv(data);
+    const lines = csv.split('\r\n');
+
+    expect(lines[0]).toBe(
+      'Date,Total (Rs),Cash (Rs),UPI (Rs),Other (Rs),Invoice Count,Gold Sold (g)',
+    );
+    expect(lines[1]).toBe('2026-04-29,5000.00,3000.00,2000.00,0.00,3,15.000');
+    expect(lines).toHaveLength(2);
+  });
+
+  it('emits zeros when no invoices', () => {
+    const data: DailySummaryResult = {
+      date: '2026-04-01',
+      total_paise: '0', cash_paise: '0', upi_paise: '0', other_paise: '0',
+      invoice_count: 0, gold_weight_mg: '0',
+    };
+    const csv = toDailySummaryCsv(data);
+    expect(csv.split('\r\n')[1]).toBe('2026-04-01,0.00,0.00,0.00,0.00,0,0.000');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: FAIL — `Cannot find module './reports.csv'`.
+
+- [ ] **Step 3: Implement `reports.csv.ts` skeleton + `toDailySummaryCsv`**
+
+Create `apps/api/src/modules/reports/reports.csv.ts`:
+
+```typescript
+import type {
+  DailySummaryResult, OutstandingResult, CustomerLtvItem,
+  LoyaltySummaryResult, StockAgingResult,
+} from './reports.service';
+
+// Shared helpers — duplicated locally rather than extracted to packages/shared per
+// YAGNI; if a third caller appears, hoist these into @goldsmith/shared.
+function escapeCsv(value: string): string {
+  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
+    return `"${value.replace(/"/g, '""')}"`;
+  }
+  return value;
+}
+
+function csvRow(cells: (string | number)[]): string {
+  return cells.map((c) => escapeCsv(String(c))).join(',');
+}
+
+function paiseToRupees(paise: bigint | string | number): string {
+  return (Number(paise) / 100).toFixed(2);
+}
+
+function mgToGrams(mg: bigint | string | number): string {
+  return (Number(mg) / 1000).toFixed(3);
+}
+
+const LE = '\r\n'; // Excel-friendly
+
+export function toDailySummaryCsv(data: DailySummaryResult): string {
+  const header = csvRow([
+    'Date', 'Total (Rs)', 'Cash (Rs)', 'UPI (Rs)', 'Other (Rs)',
+    'Invoice Count', 'Gold Sold (g)',
+  ]);
+  const row = csvRow([
+    data.date,
+    paiseToRupees(data.total_paise),
+    paiseToRupees(data.cash_paise),
+    paiseToRupees(data.upi_paise),
+    paiseToRupees(data.other_paise),
+    data.invoice_count,
+    mgToGrams(data.gold_weight_mg),
+  ]);
+  return [header, row].join(LE);
+}
+```
+
+- [ ] **Step 4: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
+git commit -m "feat(ws-3a): add toDailySummaryCsv emitter"
+```
+
+---
+
+## Task B2: Add `toOutstandingCsv`
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.csv.ts`
+- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:
+
+```typescript
+import { toOutstandingCsv } from './reports.csv';
+
+describe('toOutstandingCsv', () => {
+  it('escapes commas in customer names and emits all rows', () => {
+    const data: OutstandingResult = {
+      total: 2, page: 1, limit: 100,
+      items: [
+        {
+          id: 'inv-1', invoice_number: 'GS-2026-0001',
+          customer_name: 'Sharma, Ramesh', customer_phone: '9876543210',
+          total_paise: '100000', balance_due_paise: '50000',
+          issued_at: '2026-04-01T10:00:00.000Z',
+        },
+        {
+          id: 'inv-2', invoice_number: 'GS-2026-0002',
+          customer_name: 'राज कुमार', customer_phone: null,
+          total_paise: '200000', balance_due_paise: '200000',
+          issued_at: '2026-04-02T14:30:00.000Z',
+        },
+      ],
+    };
+    const csv = toOutstandingCsv(data);
+    const lines = csv.split('\r\n');
+    expect(lines[0]).toBe(
+      'Invoice Number,Customer Name,Customer Phone,Total (Rs),Balance Due (Rs),Issued At',
+    );
+    expect(lines[1]).toBe(
+      'GS-2026-0001,"Sharma, Ramesh",9876543210,1000.00,500.00,2026-04-01T10:00:00.000Z',
+    );
+    expect(lines[2]).toBe(
+      'GS-2026-0002,राज कुमार,,2000.00,2000.00,2026-04-02T14:30:00.000Z',
+    );
+  });
+
+  it('emits header only when no items', () => {
+    const data: OutstandingResult = { total: 0, page: 1, limit: 100, items: [] };
+    expect(toOutstandingCsv(data).split('\r\n')).toHaveLength(1);
+  });
+});
+```
+
+Add `OutstandingResult` to the existing `import type` line at the top:
+```typescript
+import type {
+  DailySummaryResult, OutstandingResult, CustomerLtvItem,
+  LoyaltySummaryResult, StockAgingResult,
+} from './reports.service';
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: FAIL — `Cannot find name 'toOutstandingCsv'`.
+
+- [ ] **Step 3: Implement `toOutstandingCsv`**
+
+Append to `apps/api/src/modules/reports/reports.csv.ts`:
+
+```typescript
+export function toOutstandingCsv(data: OutstandingResult): string {
+  const header = csvRow([
+    'Invoice Number', 'Customer Name', 'Customer Phone',
+    'Total (Rs)', 'Balance Due (Rs)', 'Issued At',
+  ]);
+  const rows = data.items.map((it) =>
+    csvRow([
+      it.invoice_number,
+      it.customer_name,
+      it.customer_phone ?? '',
+      paiseToRupees(it.total_paise),
+      paiseToRupees(it.balance_due_paise),
+      it.issued_at ?? '',
+    ]),
+  );
+  return [header, ...rows].join(LE);
+}
+```
+
+- [ ] **Step 4: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
+git commit -m "feat(ws-3a): add toOutstandingCsv emitter"
+```
+
+---
+
+## Task B3: Add `toCustomerLtvCsv`
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.csv.ts`
+- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:
+
+```typescript
+import { toCustomerLtvCsv } from './reports.csv';
+
+describe('toCustomerLtvCsv', () => {
+  it('emits header + data rows sorted by descending LTV (input order preserved)', () => {
+    const data: CustomerLtvItem[] = [
+      { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
+      { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
+    ];
+    const csv = toCustomerLtvCsv(data);
+    const lines = csv.split('\r\n');
+    expect(lines[0]).toBe('Customer ID,Name,Phone,Lifetime Value (Rs)');
+    expect(lines[1]).toBe('c1,रमेश सिंह,9900000001,20000.00');
+    expect(lines[2]).toBe('c2,सुमन देवी,9900000002,15000.00');
+  });
+
+  it('emits header only when no customers', () => {
+    expect(toCustomerLtvCsv([]).split('\r\n')).toHaveLength(1);
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: FAIL — `Cannot find name 'toCustomerLtvCsv'`.
+
+- [ ] **Step 3: Implement `toCustomerLtvCsv`**
+
+Append to `apps/api/src/modules/reports/reports.csv.ts`:
+
+```typescript
+export function toCustomerLtvCsv(items: CustomerLtvItem[]): string {
+  const header = csvRow(['Customer ID', 'Name', 'Phone', 'Lifetime Value (Rs)']);
+  const rows = items.map((c) =>
+    csvRow([c.customer_id, c.name, c.phone, paiseToRupees(c.ltv_paise)]),
+  );
+  return [header, ...rows].join(LE);
+}
+```
+
+- [ ] **Step 4: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
+git commit -m "feat(ws-3a): add toCustomerLtvCsv emitter"
+```
+
+---
+
+## Task B4: Add `toLoyaltySummaryCsv`
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.csv.ts`
+- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:
+
+```typescript
+import { toLoyaltySummaryCsv } from './reports.csv';
+
+describe('toLoyaltySummaryCsv', () => {
+  it('emits a 2-section CSV: totals header+row, blank line, per-tier breakdown', () => {
+    const data: LoyaltySummaryResult = {
+      points_issued: 5000,
+      points_redeemed: 1200,
+      members_by_tier: [
+        { tier: 'GOLD',   count: 12 },
+        { tier: 'SILVER', count: 8  },
+        { tier: null,     count: 3  },
+      ],
+    };
+    const csv = toLoyaltySummaryCsv(data);
+    const lines = csv.split('\r\n');
+    expect(lines[0]).toBe('Points Issued,Points Redeemed,Net Points');
+    expect(lines[1]).toBe('5000,1200,3800');
+    expect(lines[2]).toBe('');
+    expect(lines[3]).toBe('Tier,Member Count');
+    expect(lines[4]).toBe('GOLD,12');
+    expect(lines[5]).toBe('SILVER,8');
+    expect(lines[6]).toBe('UNTIERED,3');
+  });
+
+  it('emits empty tier list cleanly', () => {
+    const data: LoyaltySummaryResult = {
+      points_issued: 0, points_redeemed: 0, members_by_tier: [],
+    };
+    const csv = toLoyaltySummaryCsv(data);
+    const lines = csv.split('\r\n');
+    expect(lines).toEqual([
+      'Points Issued,Points Redeemed,Net Points',
+      '0,0,0',
+      '',
+      'Tier,Member Count',
+    ]);
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: FAIL — `Cannot find name 'toLoyaltySummaryCsv'`.
+
+- [ ] **Step 3: Implement `toLoyaltySummaryCsv`**
+
+Append to `apps/api/src/modules/reports/reports.csv.ts`:
+
+```typescript
+export function toLoyaltySummaryCsv(data: LoyaltySummaryResult): string {
+  const totalsHeader = csvRow(['Points Issued', 'Points Redeemed', 'Net Points']);
+  const totalsRow = csvRow([
+    data.points_issued,
+    data.points_redeemed,
+    data.points_issued - data.points_redeemed,
+  ]);
+  const tierHeader = csvRow(['Tier', 'Member Count']);
+  const tierRows = data.members_by_tier.map((t) =>
+    csvRow([t.tier ?? 'UNTIERED', t.count]),
+  );
+  return [totalsHeader, totalsRow, '', tierHeader, ...tierRows].join(LE);
+}
+```
+
+- [ ] **Step 4: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
+git commit -m "feat(ws-3a): add toLoyaltySummaryCsv emitter"
+```
+
+---
+
+## Task B5: Add `toStockAgingCsv`
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.csv.ts`
+- Modify: `apps/api/src/modules/reports/reports.csv.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Append to `apps/api/src/modules/reports/reports.csv.spec.ts`:
+
+```typescript
+import { toStockAgingCsv } from './reports.csv';
+
+describe('toStockAgingCsv', () => {
+  it('emits item-level CSV with bucket label and null cost as empty', () => {
+    const data: StockAgingResult = {
+      buckets: [], // unused by CSV
+      items: [
+        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
+          weightG: '5.000', daysInStock: 10, bucket: '<30d',
+          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
+        { id: 'p2', sku: 'C-002', metal: 'GOLD', purity: '22K',
+          weightG: '4.000', daysInStock: 75, bucket: '60-90d',
+          costPaise: null, firstListedAt: '2026-02-15T00:00:00.000Z' },
+      ],
+    };
+    const csv = toStockAgingCsv(data);
+    const lines = csv.split('\r\n');
+    expect(lines[0]).toBe(
+      'SKU,Metal,Purity,Weight (g),Days in Stock,Age Bucket,Cost (Rs),First Listed',
+    );
+    expect(lines[1]).toBe('R-001,GOLD,22K,5.000,10,<30d,50000.00,2026-04-15T00:00:00.000Z');
+    expect(lines[2]).toBe('C-002,GOLD,22K,4.000,75,60-90d,,2026-02-15T00:00:00.000Z');
+  });
+
+  it('emits header only when no items', () => {
+    const data: StockAgingResult = { buckets: [], items: [] };
+    expect(toStockAgingCsv(data).split('\r\n')).toHaveLength(1);
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: FAIL — `Cannot find name 'toStockAgingCsv'`.
+
+- [ ] **Step 3: Implement `toStockAgingCsv`**
+
+Append to `apps/api/src/modules/reports/reports.csv.ts`:
+
+```typescript
+export function toStockAgingCsv(data: StockAgingResult): string {
+  const header = csvRow([
+    'SKU', 'Metal', 'Purity', 'Weight (g)',
+    'Days in Stock', 'Age Bucket', 'Cost (Rs)', 'First Listed',
+  ]);
+  const rows = data.items.map((it) =>
+    csvRow([
+      it.sku,
+      it.metal,
+      it.purity,
+      it.weightG,
+      it.daysInStock,
+      it.bucket,
+      it.costPaise === null ? '' : paiseToRupees(it.costPaise),
+      it.firstListedAt,
+    ]),
+  );
+  return [header, ...rows].join(LE);
+}
+```
+
+- [ ] **Step 4: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test reports.csv.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.csv.ts apps/api/src/modules/reports/reports.csv.spec.ts
+git commit -m "feat(ws-3a): add toStockAgingCsv emitter"
+```
+
+---
+
+## Task B6: Wire 5 `.csv` GET routes in `ReportsController`
+
+**Pattern note (from codebase):** The existing GSTR export endpoint at `apps/api/src/modules/billing/billing.controller.ts:264-279` returns `{ csv: string; filename: string }` JSON — NOT raw streamed `text/csv`. The mobile share flow then calls `Share.share({ message: csv })` (see `apps/shopkeeper/app/reports/gstr-export.tsx:39-43`). This sidesteps browser-auth complications and reuses the axios Bearer-token interceptor. The 5 new CSV endpoints follow this same pattern.
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.controller.ts`
+
+- [ ] **Step 1: Add the 5 routes**
+
+Replace the imports block at the top of `apps/api/src/modules/reports/reports.controller.ts` with:
+
+```typescript
+import {
+  Controller, Get, Query, ParseIntPipe, DefaultValuePipe,
+} from '@nestjs/common';
+import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
+import { Roles } from '../../common/decorators/roles.decorator';
+import { ReportsService } from './reports.service';
+import type {
+  DailySummaryResult, OutstandingResult, CustomerLtvItem, LoyaltySummaryResult,
+  StockAgingResult,
+} from './reports.service';
+import {
+  toDailySummaryCsv, toOutstandingCsv, toCustomerLtvCsv,
+  toLoyaltySummaryCsv, toStockAgingCsv,
+} from './reports.csv';
+```
+
+Append the following methods at the bottom of the `ReportsController` class:
+
+```typescript
+@TenantWalkerRoute({ expectedStatus: 200 })
+@Get('/daily-summary.csv')
+@Roles('shop_admin', 'shop_manager')
+async getDailySummaryCsv(
+  @Query('date') date?: string,
+): Promise<{ csv: string; filename: string }> {
+  const target = date ?? this.todayIST();
+  const data = await this.svc.getDailySummary(target);
+  return { csv: toDailySummaryCsv(data), filename: `daily-summary-${target}.csv` };
+}
+
+@TenantWalkerRoute({ expectedStatus: 200 })
+@Get('/outstanding.csv')
+@Roles('shop_admin', 'shop_manager')
+async getOutstandingCsv(): Promise<{ csv: string; filename: string }> {
+  // CSV exports the FULL list (capped at 1000 — anchor jeweller's outstanding
+  // never exceeds low hundreds; cap protects worker memory in pathological cases).
+  const data = await this.svc.getOutstanding(1, 1000);
+  return { csv: toOutstandingCsv(data), filename: `outstanding-${this.todayIST()}.csv` };
+}
+
+@TenantWalkerRoute({ expectedStatus: 200 })
+@Get('/customer-ltv.csv')
+@Roles('shop_admin', 'shop_manager')
+async getCustomerLtvCsv(
+  @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
+): Promise<{ csv: string; filename: string }> {
+  const data = await this.svc.getCustomerLtv(limit);
+  return { csv: toCustomerLtvCsv(data), filename: `customer-ltv-${this.todayIST()}.csv` };
+}
+
+@TenantWalkerRoute({ expectedStatus: 200 })
+@Get('/loyalty-summary.csv')
+@Roles('shop_admin', 'shop_manager')
+async getLoyaltySummaryCsv(): Promise<{ csv: string; filename: string }> {
+  const data = await this.svc.getLoyaltySummary();
+  return { csv: toLoyaltySummaryCsv(data), filename: `loyalty-summary-${this.todayIST()}.csv` };
+}
+
+@TenantWalkerRoute({ expectedStatus: 200 })
+@Get('/stock-aging.csv')
+@Roles('shop_admin', 'shop_manager')
+async getStockAgingCsv(): Promise<{ csv: string; filename: string }> {
+  const data = await this.svc.getStockAging();
+  return { csv: toStockAgingCsv(data), filename: `stock-aging-${this.todayIST()}.csv` };
+}
+
+private todayIST(): string {
+  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
+}
+```
+
+- [ ] **Step 2: Verify typecheck + endpoint walker**
+
+```bash
+pnpm --filter @goldsmith/api typecheck
+pnpm --filter @goldsmith/api test:e2e
+```
+
+Expected: typecheck PASS; endpoint-walker PASS for all 5 new `.csv` routes.
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.controller.ts
+git commit -m "feat(ws-3a): wire 5 .csv sync export routes (FR119 CSV)"
+```
+
+---
+
+# WS-C — PDF async pipeline (FR119 PDF half)
+
+## Task C1: Migration 0072 — `reports_pdf_exports` table
+
+**Files:**
+- Create: `packages/db/src/migrations/0072_reports_pdf_exports.sql`
+
+- [ ] **Step 1: Write migration**
+
+Create `packages/db/src/migrations/0072_reports_pdf_exports.sql`:
+
+```sql
+-- 0072_reports_pdf_exports.sql
+-- Tracks asynchronous PDF export jobs (FR119). One row per requested PDF;
+-- status transitions QUEUED → RUNNING → READY/FAILED via reports-pdf BullMQ
+-- worker. Blob retention enforced via created_at + interval '7 days'
+-- (cleanup is a separate ops follow-up, not in this story).
+
+CREATE TABLE reports_pdf_exports (
+  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
+  report_type           TEXT NOT NULL CHECK (report_type IN
+                          ('daily-summary','outstanding','customer-ltv',
+                           'loyalty-summary','stock-aging')),
+  params                JSONB NOT NULL DEFAULT '{}'::jsonb,
+  status                TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN
+                          ('QUEUED','RUNNING','READY','FAILED')),
+  storage_key           TEXT,
+  error_message         TEXT,
+  requested_by_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
+  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
+  completed_at          TIMESTAMPTZ
+);
+
+CREATE INDEX reports_pdf_exports_shop_created_idx
+  ON reports_pdf_exports (shop_id, created_at DESC);
+
+ALTER TABLE reports_pdf_exports ENABLE ROW LEVEL SECURITY;
+ALTER TABLE reports_pdf_exports FORCE ROW LEVEL SECURITY;
+
+CREATE POLICY rls_reports_pdf_exports_tenant_isolation ON reports_pdf_exports
+  FOR ALL
+  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
+  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);
+
+GRANT SELECT, INSERT, UPDATE ON reports_pdf_exports TO app_user;
+```
+
+- [ ] **Step 2: Run migration locally + tenant-isolation walker**
+
+```bash
+pnpm db:reset
+pnpm test:tenant-isolation
+```
+
+Expected: all migrations apply cleanly; tenant-isolation walker discovers `reports_pdf_exports` and confirms cross-tenant denial.
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add packages/db/src/migrations/0072_reports_pdf_exports.sql
+git commit -m "feat(ws-3a): add reports_pdf_exports table (migration 0072)"
+```
+
+---
+
+## Task C2: Add audit-action enum entries
+
+**Files:**
+- Modify: `packages/audit/src/audit-actions.ts`
+- Test: `packages/audit/src/audit-actions.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Append to `packages/audit/src/audit-actions.spec.ts`:
+
+```typescript
+describe('reports export audit actions', () => {
+  it('exposes REPORT_EXPORT_REQUESTED and REPORT_EXPORT_REGENERATED', () => {
+    expect(AuditAction.REPORT_EXPORT_REQUESTED).toBe('REPORT_EXPORT_REQUESTED');
+    expect(AuditAction.REPORT_EXPORT_REGENERATED).toBe('REPORT_EXPORT_REGENERATED');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/audit test
+```
+
+Expected: FAIL — `AuditAction.REPORT_EXPORT_REQUESTED` undefined.
+
+- [ ] **Step 3: Add enum entries**
+
+Append before the closing `}` in `packages/audit/src/audit-actions.ts`:
+
+```typescript
+  REPORT_EXPORT_REQUESTED          = 'REPORT_EXPORT_REQUESTED',
+  REPORT_EXPORT_REGENERATED        = 'REPORT_EXPORT_REGENERATED',
+```
+
+- [ ] **Step 4: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/audit test
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add packages/audit/src/audit-actions.ts packages/audit/src/audit-actions.spec.ts
+git commit -m "feat(ws-3a): add REPORT_EXPORT_REQUESTED + _REGENERATED audit actions"
+```
+
+---
+
+## Task C3: Add `pdfkit` dep + ship Devanagari TTF assets
+
+**Files:**
+- Modify: `apps/api/package.json`
+- Create: `apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf` (binary download)
+- Create: `apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf` (binary download)
+- Modify: `apps/api/tsconfig.build.json` (if it excludes `assets/`)
+
+- [ ] **Step 1: Add deps**
+
+Edit `apps/api/package.json` — add `pdfkit` to `dependencies` (alphabetical order, after `passport-http-bearer`):
+
+```json
+    "pdfkit": "^0.15.0",
+```
+
+Add `@types/pdfkit` to `devDependencies` (alphabetical order, after `@types/passport-http-bearer`):
+
+```json
+    "@types/pdfkit": "^0.13.4",
+```
+
+Install:
+
+```bash
+pnpm install --filter @goldsmith/api
+```
+
+- [ ] **Step 2: Download Noto Sans Devanagari TTFs**
+
+Both files come from Google Fonts (SIL Open Font License). Use the static-TTF URLs from the official `notofonts/devanagari` GitHub:
+
+```bash
+mkdir -p apps/api/assets/fonts
+curl -L -o apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf \
+  https://github.com/notofonts/devanagari/raw/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf
+curl -L -o apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf \
+  https://github.com/notofonts/devanagari/raw/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf
+```
+
+Verify both files are non-empty TTFs:
+
+```bash
+file apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf
+file apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf
+```
+
+Expected: both report `TrueType Font data`. Files should be roughly 200-400 KB each.
+
+- [ ] **Step 3: Confirm assets are bundled at build time**
+
+Open `apps/api/tsconfig.build.json` (or `tsconfig.json` if no build variant). The default Nest build uses `tsc` which only emits `.ts → .js`; static assets aren't copied. We bundle by referencing them via absolute path at runtime (`path.resolve(__dirname, '../assets/fonts/...')` from `dist/`), so a post-build copy is needed. Add a `"copy-assets"` step.
+
+Edit `apps/api/package.json` `scripts.build` to use a portable Node-based copy (works on Windows + Linux runners — avoids `cp -r` shell-dependency):
+
+```json
+"build": "tsc -p tsconfig.build.json && node -e \"require('fs').cpSync('assets','dist/assets',{recursive:true})\"",
+```
+
+- [ ] **Step 4: Verify install + typecheck**
+
+```bash
+pnpm --filter @goldsmith/api typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/package.json apps/api/assets/fonts/NotoSansDevanagari-Regular.ttf apps/api/assets/fonts/NotoSansDevanagari-Bold.ttf pnpm-lock.yaml
+git commit -m "feat(ws-3a): add pdfkit + Noto Sans Devanagari font assets"
+```
+
+---
+
+## Task C4: `BrandingLoader`
+
+**Files:**
+- Create: `apps/api/src/modules/reports/pdf/branding.ts`
+
+- [ ] **Step 1: Implement** (no tests — pure SQL passthrough; covered indirectly by renderer.spec.ts in Task C6+)
+
+Create `apps/api/src/modules/reports/pdf/branding.ts`:
+
+```typescript
+import { Inject, Injectable, NotFoundException } from '@nestjs/common';
+import type { Pool } from 'pg';
+import { withTenantTx } from '@goldsmith/db';
+import { tenantContext } from '@goldsmith/tenant-context';
+
+export interface ShopBranding {
+  displayName: string;
+  logoUrl: string | null;
+  addressText: string;
+  gstin: string | null;
+  contactPhone: string | null;
+}
+
+@Injectable()
+export class BrandingLoader {
+  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}
+
+  async load(): Promise<ShopBranding> {
+    const ctx = tenantContext.requireCurrent();
+    return withTenantTx(this.pool, async (tx) => {
+      const r = await tx.query<{
+        display_name:    string;
+        logo_url:        string | null;
+        address_json:    Record<string, unknown> | null;
+        gstin:           string | null;
+        contact_phone:   string | null;
+      }>(
+        `SELECT display_name, logo_url, address_json, gstin, contact_phone
+         FROM shops
+         WHERE id = $1`,
+        [ctx.shopId],
+      );
+      if (!r.rows[0]) throw new NotFoundException({ code: 'shop.not_found' });
+      const row = r.rows[0];
+      return {
+        displayName:  row.display_name,
+        logoUrl:      row.logo_url,
+        addressText:  row.address_json ? this.formatAddress(row.address_json) : '',
+        gstin:        row.gstin,
+        contactPhone: row.contact_phone,
+      };
+    });
+  }
+
+  private formatAddress(addr: Record<string, unknown>): string {
+    return [addr['line1'], addr['line2'], addr['city'], addr['state'], addr['pincode']]
+      .filter(Boolean)
+      .join(', ');
+  }
+}
+```
+
+- [ ] **Step 2: Verify typecheck**
+
+```bash
+pnpm --filter @goldsmith/api typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add apps/api/src/modules/reports/pdf/branding.ts
+git commit -m "feat(ws-3a): add BrandingLoader for PDF reports"
+```
+
+---
+
+## Task C5: `drawHeader` + `drawFooter` PDF primitives
+
+**Files:**
+- Create: `apps/api/src/modules/reports/pdf/header.ts`
+- Create: `apps/api/src/modules/reports/pdf/footer.ts`
+
+- [ ] **Step 1: Implement `drawHeader`**
+
+Create `apps/api/src/modules/reports/pdf/header.ts`:
+
+```typescript
+import type PDFDocument from 'pdfkit';
+import type { ShopBranding } from './branding';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+
+const GOLD = '#B58A3C';
+
+/**
+ * Draws shop branding header on the current page.
+ * Returns the Y coordinate just below the header (where body content should start).
+ *
+ * Logo is fetched once per render via storage.downloadBuffer if logoUrl points to
+ * a tenant blob key; if logoUrl is empty/null/external-http, no logo is drawn.
+ */
+export async function drawHeader(
+  doc: PDFKit.PDFDocument,
+  branding: ShopBranding,
+  reportTitle: string,
+  storage: StoragePort,
+): Promise<number> {
+  const startY = doc.y;
+
+  // Logo (left)
+  let logoBottom = startY;
+  if (branding.logoUrl && branding.logoUrl.startsWith('tenants/')) {
+    try {
+      const buf = await storage.downloadBuffer(branding.logoUrl);
+      doc.image(buf, doc.page.margins.left, startY, { fit: [80, 40] });
+      logoBottom = startY + 40;
+    } catch {
+      // Best-effort; missing logo blob doesn't fail the render
+    }
+  }
+
+  // Shop name + report title (centre)
+  doc.font('Devanagari-Bold').fontSize(18).fillColor('#1c1917');
+  doc.text(branding.displayName, doc.page.margins.left + 90, startY, {
+    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 90,
+  });
+  doc.font('Devanagari').fontSize(14).fillColor(GOLD);
+  doc.text(reportTitle, doc.page.margins.left + 90, doc.y + 2);
+
+  // Generated-at (right)
+  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
+  doc.font('Devanagari').fontSize(9).fillColor('#78716c');
+  doc.text(`Generated: ${generatedAt}`, doc.page.margins.left, startY, {
+    align: 'right',
+    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
+  });
+
+  // Divider line
+  const dividerY = Math.max(logoBottom, doc.y) + 8;
+  doc.moveTo(doc.page.margins.left, dividerY)
+     .lineTo(doc.page.width - doc.page.margins.right, dividerY)
+     .strokeColor(GOLD).lineWidth(1).stroke();
+
+  doc.fillColor('#1c1917').strokeColor('#000');
+  doc.y = dividerY + 12;
+  return doc.y;
+}
+```
+
+- [ ] **Step 2: Implement `drawFooter`**
+
+Create `apps/api/src/modules/reports/pdf/footer.ts`:
+
+```typescript
+import type { ShopBranding } from './branding';
+
+/**
+ * Draws shop address + GSTIN + page N of M at the bottom of the current page.
+ * Called once per page; uses absolute Y near the page bottom rather than doc.y.
+ */
+export function drawFooter(
+  doc: PDFKit.PDFDocument,
+  branding: ShopBranding,
+  pageNum: number,
+  totalPages: number,
+): void {
+  const footerY = doc.page.height - doc.page.margins.bottom + 8;
+  const left = doc.page.margins.left;
+  const right = doc.page.width - doc.page.margins.right;
+
+  doc.font('Devanagari').fontSize(8).fillColor('#78716c');
+
+  // Address line (left)
+  if (branding.addressText) {
+    doc.text(branding.addressText, left, footerY, {
+      width: right - left - 100,
+      lineBreak: false,
+      ellipsis: true,
+    });
+  }
+
+  // GSTIN line under address
+  if (branding.gstin) {
+    doc.text(`GSTIN: ${branding.gstin}`, left, footerY + 10, {
+      width: right - left - 100,
+    });
+  }
+
+  // Page N of M (right)
+  doc.text(`Page ${pageNum} of ${totalPages}`, left, footerY, {
+    align: 'right',
+    width: right - left,
+  });
+
+  doc.fillColor('#1c1917');
+}
+```
+
+- [ ] **Step 3: Verify typecheck**
+
+```bash
+pnpm --filter @goldsmith/api typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 4: Commit**
+
+```bash
+git add apps/api/src/modules/reports/pdf/header.ts apps/api/src/modules/reports/pdf/footer.ts
+git commit -m "feat(ws-3a): add PDF header/footer primitives"
+```
+
+---
+
+## Task C6: `PdfRenderer` service + daily-summary template
+
+**Files:**
+- Create: `apps/api/src/modules/reports/pdf/renderer.ts`
+- Create: `apps/api/src/modules/reports/pdf/templates/daily-summary.ts`
+- Create: `apps/api/src/modules/reports/pdf/renderer.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Create `apps/api/src/modules/reports/pdf/renderer.spec.ts`:
+
+```typescript
+import { describe, expect, it, vi } from 'vitest';
+import { PdfRenderer } from './renderer';
+import type { ShopBranding } from './branding';
+import type { DailySummaryResult } from '../reports.service';
+
+const mockStorage = {
+  downloadBuffer: vi.fn().mockRejectedValue(new Error('no logo')),
+  uploadBuffer: vi.fn(),
+  getPublicUrl: vi.fn(),
+  getPresignedReadUrl: vi.fn(),
+  getPresignedUploadUrl: vi.fn(),
+  deleteBlob: vi.fn(),
+};
+
+const branding: ShopBranding = {
+  displayName: 'टेस्ट ज्वैलर्स',
+  logoUrl: null,
+  addressText: 'Ayodhya, UP, 224001',
+  gstin: '09ABCDE1234F1Z5',
+  contactPhone: '9876543210',
+};
+
+describe('PdfRenderer.render(daily-summary)', () => {
+  it('produces a non-empty PDF buffer with %PDF- magic bytes', async () => {
+    const renderer = new PdfRenderer(mockStorage);
+    const data: DailySummaryResult = {
+      date: '2026-04-29',
+      total_paise: '500000', cash_paise: '300000',
+      upi_paise: '200000', other_paise: '0',
+      invoice_count: 3, gold_weight_mg: '15000',
+    };
+    const buf = await renderer.render('daily-summary', data, branding);
+    expect(buf.length).toBeGreaterThan(1000);
+    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: FAIL — `Cannot find module './renderer'`.
+
+- [ ] **Step 3: Implement `PdfRenderer`**
+
+Create `apps/api/src/modules/reports/pdf/renderer.ts`:
+
+```typescript
+import { Injectable, Inject } from '@nestjs/common';
+import * as path from 'node:path';
+import PDFDocument from 'pdfkit';
+import { STORAGE_PORT } from '@goldsmith/integrations-storage';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+import type { ShopBranding } from './branding';
+import type {
+  DailySummaryResult, OutstandingResult, CustomerLtvItem,
+  LoyaltySummaryResult, StockAgingResult,
+} from '../reports.service';
+import { renderDailySummary } from './templates/daily-summary';
+
+const FONT_DIR = path.resolve(__dirname, '../../../../assets/fonts');
+
+export type ReportType =
+  | 'daily-summary' | 'outstanding' | 'customer-ltv'
+  | 'loyalty-summary' | 'stock-aging';
+
+export type ReportData =
+  | DailySummaryResult | OutstandingResult | CustomerLtvItem[]
+  | LoyaltySummaryResult | StockAgingResult;
+
+@Injectable()
+export class PdfRenderer {
+  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}
+
+  async render(
+    reportType: ReportType,
+    data: ReportData,
+    branding: ShopBranding,
+  ): Promise<Buffer> {
+    const doc = new PDFDocument({
+      size: 'A4',
+      margins: { top: 36, bottom: 60, left: 36, right: 36 },
+      bufferPages: true,
+    });
+
+    // Register Devanagari fonts; fallback to Helvetica if asset missing.
+    try {
+      doc.registerFont('Devanagari',      path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf'));
+      doc.registerFont('Devanagari-Bold', path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf'));
+    } catch {
+      doc.registerFont('Devanagari',      'Helvetica');
+      doc.registerFont('Devanagari-Bold', 'Helvetica-Bold');
+    }
+
+    const chunks: Buffer[] = [];
+    doc.on('data', (c: Buffer) => chunks.push(c));
+    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));
+
+    switch (reportType) {
+      case 'daily-summary':
+        await renderDailySummary(doc, data as DailySummaryResult, branding, this.storage);
+        break;
+      // outstanding / customer-ltv / loyalty-summary / stock-aging added in
+      // Tasks C7–C10. Until then, throw to fail fast.
+      default:
+        throw new Error(`reports.pdf.template_not_implemented:${reportType}`);
+    }
+
+    doc.end();
+    await done;
+    return Buffer.concat(chunks);
+  }
+}
+```
+
+- [ ] **Step 4: Implement daily-summary template**
+
+Create `apps/api/src/modules/reports/pdf/templates/daily-summary.ts`:
+
+```typescript
+import { drawHeader } from '../header';
+import { drawFooter } from '../footer';
+import type { ShopBranding } from '../branding';
+import type { DailySummaryResult } from '../../reports.service';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+
+function formatINR(paise: bigint | string | number): string {
+  return `₹${(Number(paise) / 100).toLocaleString('en-IN', {
+    minimumFractionDigits: 2, maximumFractionDigits: 2,
+  })}`;
+}
+
+function formatGrams(mg: string | number): string {
+  return `${(Number(mg) / 1000).toFixed(3)} g`;
+}
+
+export async function renderDailySummary(
+  doc: PDFKit.PDFDocument,
+  data: DailySummaryResult,
+  branding: ShopBranding,
+  storage: StoragePort,
+): Promise<void> {
+  await drawHeader(doc, branding, `दैनिक बिक्री / Daily Summary — ${data.date}`, storage);
+
+  const left = doc.page.margins.left;
+  const right = doc.page.width - doc.page.margins.right;
+  const labelX = left;
+  const valueX = right;
+
+  doc.font('Devanagari').fontSize(12).fillColor('#1c1917');
+
+  const rows: [label: string, value: string][] = [
+    ['कुल बिक्री / Total Sales',   formatINR(data.total_paise)],
+    ['नकद / Cash',                  formatINR(data.cash_paise)],
+    ['UPI',                          formatINR(data.upi_paise)],
+    ['अन्य / Other',                 formatINR(data.other_paise)],
+    ['चालान संख्या / Invoice Count', `${data.invoice_count}`],
+    ['सोना बिका / Gold Sold',        formatGrams(data.gold_weight_mg)],
+  ];
+
+  for (const [label, value] of rows) {
+    const y = doc.y;
+    doc.text(label, labelX, y, { width: right - left - 120 });
+    doc.text(value, labelX, y, {
+      width: right - left,
+      align: 'right',
+    });
+    doc.moveDown(0.5);
+    doc.moveTo(left, doc.y).lineTo(right, doc.y)
+       .strokeColor('#e7e5e4').lineWidth(0.5).stroke();
+    doc.moveDown(0.4);
+  }
+
+  // Footer on this single page
+  doc.flushPages();
+  const range = doc.bufferedPageRange();
+  for (let i = range.start; i < range.start + range.count; i++) {
+    doc.switchToPage(i);
+    drawFooter(doc, branding, i - range.start + 1, range.count);
+  }
+}
+```
+
+- [ ] **Step 5: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: PASS — buffer non-empty + `%PDF-` magic bytes.
+
+- [ ] **Step 6: Commit**
+
+```bash
+git add apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts apps/api/src/modules/reports/pdf/templates/daily-summary.ts
+git commit -m "feat(ws-3a): add PdfRenderer + daily-summary template"
+```
+
+---
+
+## Task C7: Outstanding template
+
+**Files:**
+- Create: `apps/api/src/modules/reports/pdf/templates/outstanding.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`
+
+- [ ] **Step 1: Append to test**
+
+Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:
+
+```typescript
+describe('PdfRenderer.render(outstanding)', () => {
+  it('produces a non-empty PDF buffer with %PDF- magic bytes', async () => {
+    const renderer = new PdfRenderer(mockStorage);
+    const data = {
+      total: 1, page: 1, limit: 100,
+      items: [{
+        id: 'i1', invoice_number: 'GS-2026-0001',
+        customer_name: 'राज कुमार', customer_phone: '9876543210',
+        total_paise: '100000', balance_due_paise: '50000',
+        issued_at: '2026-04-01T10:00:00.000Z',
+      }],
+    };
+    const buf = await renderer.render('outstanding', data, branding);
+    expect(buf.length).toBeGreaterThan(1000);
+    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: FAIL — `reports.pdf.template_not_implemented:outstanding`.
+
+- [ ] **Step 3: Implement outstanding template**
+
+Create `apps/api/src/modules/reports/pdf/templates/outstanding.ts`:
+
+```typescript
+import { drawHeader } from '../header';
+import { drawFooter } from '../footer';
+import type { ShopBranding } from '../branding';
+import type { OutstandingResult } from '../../reports.service';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+
+function formatINR(paise: string | number): string {
+  return (Number(paise) / 100).toLocaleString('en-IN', {
+    minimumFractionDigits: 2, maximumFractionDigits: 2,
+  });
+}
+
+function formatDate(iso: string | null): string {
+  if (!iso) return '—';
+  return new Date(iso).toLocaleDateString('en-IN', {
+    day: '2-digit', month: 'short', year: 'numeric',
+  });
+}
+
+export async function renderOutstanding(
+  doc: PDFKit.PDFDocument,
+  data: OutstandingResult,
+  branding: ShopBranding,
+  storage: StoragePort,
+): Promise<void> {
+  await drawHeader(doc, branding, 'बकाया भुगतान / Outstanding Payments', storage);
+
+  const left = doc.page.margins.left;
+  const right = doc.page.width - doc.page.margins.right;
+  const tableWidth = right - left;
+  const cols = [
+    { key: 'invoice', label: 'Invoice',    w: 0.18 },
+    { key: 'name',    label: 'Customer',   w: 0.32 },
+    { key: 'phone',   label: 'Phone',      w: 0.16 },
+    { key: 'total',   label: 'Total (Rs)', w: 0.13 },
+    { key: 'due',     label: 'Due (Rs)',   w: 0.11 },
+    { key: 'date',    label: 'Issued',     w: 0.10 },
+  ];
+
+  // Header row
+  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
+  let x = left;
+  for (const c of cols) {
+    doc.text(c.label, x, doc.y, { width: tableWidth * c.w, continued: false });
+    x += tableWidth * c.w;
+  }
+  doc.moveDown(0.3);
+  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
+  doc.moveDown(0.3);
+
+  // Body rows
+  doc.font('Devanagari').fontSize(9).fillColor('#1c1917');
+  for (const it of data.items) {
+    const rowY = doc.y;
+    if (rowY > doc.page.height - doc.page.margins.bottom - 80) {
+      doc.addPage();
+      await drawHeader(doc, branding, 'बकाया भुगतान / Outstanding Payments (cont.)', storage);
+    }
+    x = left;
+    const cells = [
+      it.invoice_number,
+      it.customer_name,
+      it.customer_phone ?? '',
+      formatINR(it.total_paise),
+      formatINR(it.balance_due_paise),
+      formatDate(it.issued_at),
+    ];
+    for (let i = 0; i < cols.length; i++) {
+      doc.text(cells[i]!, x, rowY, {
+        width: tableWidth * cols[i]!.w,
+        ellipsis: true,
+        lineBreak: false,
+      });
+      x += tableWidth * cols[i]!.w;
+    }
+    doc.moveDown(0.5);
+    doc.moveTo(left, doc.y).lineTo(right, doc.y)
+       .strokeColor('#e7e5e4').lineWidth(0.5).stroke();
+    doc.moveDown(0.3);
+  }
+
+  // Footer per page
+  doc.flushPages();
+  const range = doc.bufferedPageRange();
+  for (let i = range.start; i < range.start + range.count; i++) {
+    doc.switchToPage(i);
+    drawFooter(doc, branding, i - range.start + 1, range.count);
+  }
+}
+```
+
+- [ ] **Step 4: Wire into renderer**
+
+Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:
+
+```typescript
+import { renderOutstanding } from './templates/outstanding';
+```
+
+Replace the `switch` block with:
+```typescript
+switch (reportType) {
+  case 'daily-summary':
+    await renderDailySummary(doc, data as DailySummaryResult, branding, this.storage);
+    break;
+  case 'outstanding':
+    await renderOutstanding(doc, data as OutstandingResult, branding, this.storage);
+    break;
+  default:
+    throw new Error(`reports.pdf.template_not_implemented:${reportType}`);
+}
+```
+
+- [ ] **Step 5: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 6: Commit**
+
+```bash
+git add apps/api/src/modules/reports/pdf/templates/outstanding.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
+git commit -m "feat(ws-3a): add outstanding PDF template"
+```
+
+---
+
+## Task C8: Customer LTV template
+
+**Files:**
+- Create: `apps/api/src/modules/reports/pdf/templates/customer-ltv.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`
+
+- [ ] **Step 1: Append to test**
+
+Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:
+
+```typescript
+describe('PdfRenderer.render(customer-ltv)', () => {
+  it('produces a non-empty PDF buffer', async () => {
+    const renderer = new PdfRenderer(mockStorage);
+    const data = [
+      { customer_id: 'c1', name: 'रमेश सिंह', phone: '9900000001', ltv_paise: '2000000' },
+      { customer_id: 'c2', name: 'सुमन देवी', phone: '9900000002', ltv_paise: '1500000' },
+    ];
+    const buf = await renderer.render('customer-ltv', data, branding);
+    expect(buf.length).toBeGreaterThan(1000);
+    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: FAIL — template not implemented.
+
+- [ ] **Step 3: Implement customer-ltv template**
+
+Create `apps/api/src/modules/reports/pdf/templates/customer-ltv.ts`:
+
+```typescript
+import { drawHeader } from '../header';
+import { drawFooter } from '../footer';
+import type { ShopBranding } from '../branding';
+import type { CustomerLtvItem } from '../../reports.service';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+
+function formatINR(paise: string): string {
+  return (Number(paise) / 100).toLocaleString('en-IN', {
+    minimumFractionDigits: 2, maximumFractionDigits: 2,
+  });
+}
+
+export async function renderCustomerLtv(
+  doc: PDFKit.PDFDocument,
+  items: CustomerLtvItem[],
+  branding: ShopBranding,
+  storage: StoragePort,
+): Promise<void> {
+  await drawHeader(doc, branding, 'शीर्ष ग्राहक / Top Customers (Lifetime Value)', storage);
+
+  const left = doc.page.margins.left;
+  const right = doc.page.width - doc.page.margins.right;
+  const tableWidth = right - left;
+  const cols = [
+    { label: 'Rank',          w: 0.08 },
+    { label: 'Customer',      w: 0.45 },
+    { label: 'Phone',         w: 0.22 },
+    { label: 'LTV (Rs)',      w: 0.25 },
+  ];
+
+  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
+  let x = left;
+  for (const c of cols) {
+    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
+    x += tableWidth * c.w;
+  }
+  doc.moveDown(0.3);
+  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
+  doc.moveDown(0.3);
+
+  doc.font('Devanagari').fontSize(10).fillColor('#1c1917');
+  items.forEach((it, idx) => {
+    const rowY = doc.y;
+    if (rowY > doc.page.height - doc.page.margins.bottom - 80) {
+      doc.addPage();
+    }
+    x = left;
+    const cells = [
+      `${idx + 1}`,
+      it.name,
+      it.phone,
+      formatINR(it.ltv_paise),
+    ];
+    for (let i = 0; i < cols.length; i++) {
+      doc.text(cells[i]!, x, rowY, {
+        width: tableWidth * cols[i]!.w,
+        ellipsis: true,
+        lineBreak: false,
+      });
+      x += tableWidth * cols[i]!.w;
+    }
+    doc.moveDown(0.5);
+  });
+
+  doc.flushPages();
+  const range = doc.bufferedPageRange();
+  for (let i = range.start; i < range.start + range.count; i++) {
+    doc.switchToPage(i);
+    drawFooter(doc, branding, i - range.start + 1, range.count);
+  }
+}
+```
+
+- [ ] **Step 4: Wire into renderer**
+
+Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:
+
+```typescript
+import { renderCustomerLtv } from './templates/customer-ltv';
+```
+
+Add a case to the switch:
+```typescript
+case 'customer-ltv':
+  await renderCustomerLtv(doc, data as CustomerLtvItem[], branding, this.storage);
+  break;
+```
+
+- [ ] **Step 5: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 6: Commit**
+
+```bash
+git add apps/api/src/modules/reports/pdf/templates/customer-ltv.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
+git commit -m "feat(ws-3a): add customer-ltv PDF template"
+```
+
+---
+
+## Task C9: Loyalty summary template
+
+**Files:**
+- Create: `apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`
+
+- [ ] **Step 1: Append to test**
+
+Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:
+
+```typescript
+describe('PdfRenderer.render(loyalty-summary)', () => {
+  it('produces a non-empty PDF buffer', async () => {
+    const renderer = new PdfRenderer(mockStorage);
+    const data = {
+      points_issued: 5000, points_redeemed: 1200,
+      members_by_tier: [
+        { tier: 'GOLD',   count: 12 },
+        { tier: 'SILVER', count: 8 },
+        { tier: null,     count: 3 },
+      ],
+    };
+    const buf = await renderer.render('loyalty-summary', data, branding);
+    expect(buf.length).toBeGreaterThan(1000);
+    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: FAIL — template not implemented.
+
+- [ ] **Step 3: Implement loyalty-summary template**
+
+Create `apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts`:
+
+```typescript
+import { drawHeader } from '../header';
+import { drawFooter } from '../footer';
+import type { ShopBranding } from '../branding';
+import type { LoyaltySummaryResult } from '../../reports.service';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+
+export async function renderLoyaltySummary(
+  doc: PDFKit.PDFDocument,
+  data: LoyaltySummaryResult,
+  branding: ShopBranding,
+  storage: StoragePort,
+): Promise<void> {
+  await drawHeader(doc, branding, 'लॉयल्टी कार्यक्रम / Loyalty Programme', storage);
+
+  const left = doc.page.margins.left;
+  const right = doc.page.width - doc.page.margins.right;
+
+  // Totals card
+  doc.font('Devanagari-Bold').fontSize(13).fillColor('#1c1917');
+  doc.text('अंक सारांश / Points Summary', left, doc.y);
+  doc.moveDown(0.3);
+
+  doc.font('Devanagari').fontSize(11).fillColor('#1c1917');
+  const totalRows: [string, string][] = [
+    ['जारी / Issued',      `${data.points_issued}`],
+    ['भुनाए / Redeemed',   `${data.points_redeemed}`],
+    ['शुद्ध / Net',         `${data.points_issued - data.points_redeemed}`],
+  ];
+  for (const [label, value] of totalRows) {
+    const y = doc.y;
+    doc.text(label, left, y);
+    doc.text(value, left, y, { width: right - left, align: 'right' });
+    doc.moveDown(0.4);
+  }
+
+  doc.moveDown(0.5);
+  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
+  doc.moveDown(0.5);
+
+  // Tier breakdown
+  doc.font('Devanagari-Bold').fontSize(13).fillColor('#1c1917');
+  doc.text('स्तर के अनुसार / By Tier', left, doc.y);
+  doc.moveDown(0.3);
+
+  doc.font('Devanagari').fontSize(11).fillColor('#1c1917');
+  for (const t of data.members_by_tier) {
+    const y = doc.y;
+    doc.text(t.tier ?? 'UNTIERED', left, y);
+    doc.text(`${t.count}`, left, y, { width: right - left, align: 'right' });
+    doc.moveDown(0.4);
+  }
+
+  doc.flushPages();
+  const range = doc.bufferedPageRange();
+  for (let i = range.start; i < range.start + range.count; i++) {
+    doc.switchToPage(i);
+    drawFooter(doc, branding, i - range.start + 1, range.count);
+  }
+}
+```
+
+- [ ] **Step 4: Wire into renderer**
+
+Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:
+
+```typescript
+import { renderLoyaltySummary } from './templates/loyalty-summary';
+```
+
+```typescript
+case 'loyalty-summary':
+  await renderLoyaltySummary(doc, data as LoyaltySummaryResult, branding, this.storage);
+  break;
+```
+
+- [ ] **Step 5: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 6: Commit**
+
+```bash
+git add apps/api/src/modules/reports/pdf/templates/loyalty-summary.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
+git commit -m "feat(ws-3a): add loyalty-summary PDF template"
+```
+
+---
+
+## Task C10: Stock-aging template
+
+**Files:**
+- Create: `apps/api/src/modules/reports/pdf/templates/stock-aging.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.ts`
+- Modify: `apps/api/src/modules/reports/pdf/renderer.spec.ts`
+
+- [ ] **Step 1: Append to test**
+
+Append to `apps/api/src/modules/reports/pdf/renderer.spec.ts`:
+
+```typescript
+describe('PdfRenderer.render(stock-aging)', () => {
+  it('produces a non-empty PDF buffer with bucket summary + items', async () => {
+    const renderer = new PdfRenderer(mockStorage);
+    const data = {
+      buckets: [
+        { label: '<30d',   count: 2, totalWeightMg: '8000', totalCostPaise: '8000000' },
+        { label: '30-60d', count: 1, totalWeightMg: '50000', totalCostPaise: '500000' },
+        { label: '60-90d', count: 1, totalWeightMg: '4000',  totalCostPaise: '0' },
+        { label: '90d+',   count: 1, totalWeightMg: '8000',  totalCostPaise: '8000000' },
+      ],
+      items: [
+        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
+          weightG: '5.000', daysInStock: 10, bucket: '<30d',
+          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
+      ],
+    };
+    const buf = await renderer.render('stock-aging', data as never, branding);
+    expect(buf.length).toBeGreaterThan(1000);
+    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: FAIL — template not implemented.
+
+- [ ] **Step 3: Implement stock-aging template**
+
+Create `apps/api/src/modules/reports/pdf/templates/stock-aging.ts`:
+
+```typescript
+import { drawHeader } from '../header';
+import { drawFooter } from '../footer';
+import type { ShopBranding } from '../branding';
+import type { StockAgingResult } from '../../reports.service';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+
+function formatGrams(mg: string): string {
+  return `${(Number(mg) / 1000).toFixed(3)} g`;
+}
+
+function formatINR(paise: string): string {
+  return (Number(paise) / 100).toLocaleString('en-IN', {
+    minimumFractionDigits: 2, maximumFractionDigits: 2,
+  });
+}
+
+export async function renderStockAging(
+  doc: PDFKit.PDFDocument,
+  data: StockAgingResult,
+  branding: ShopBranding,
+  storage: StoragePort,
+): Promise<void> {
+  await drawHeader(doc, branding, 'पुराना स्टॉक / Stock Aging', storage);
+
+  const left = doc.page.margins.left;
+  const right = doc.page.width - doc.page.margins.right;
+  const tableWidth = right - left;
+
+  // Bucket summary
+  doc.font('Devanagari-Bold').fontSize(12).fillColor('#1c1917');
+  doc.text('आयु सारांश / Age Summary', left, doc.y);
+  doc.moveDown(0.3);
+
+  const bucketCols = [
+    { label: 'Bucket',    w: 0.20 },
+    { label: 'Items',     w: 0.20 },
+    { label: 'Weight',    w: 0.30 },
+    { label: 'Cost (Rs)', w: 0.30 },
+  ];
+  doc.font('Devanagari-Bold').fontSize(10).fillColor('#57534e');
+  let x = left;
+  for (const c of bucketCols) {
+    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
+    x += tableWidth * c.w;
+  }
+  doc.moveDown(0.3);
+  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
+  doc.moveDown(0.3);
+
+  doc.font('Devanagari').fontSize(10).fillColor('#1c1917');
+  for (const b of data.buckets) {
+    const y = doc.y;
+    x = left;
+    const cells = [b.label, `${b.count}`, formatGrams(b.totalWeightMg), formatINR(b.totalCostPaise)];
+    for (let i = 0; i < bucketCols.length; i++) {
+      doc.text(cells[i]!, x, y, { width: tableWidth * bucketCols[i]!.w });
+      x += tableWidth * bucketCols[i]!.w;
+    }
+    doc.moveDown(0.5);
+  }
+
+  doc.moveDown(0.5);
+
+  // Item list
+  doc.font('Devanagari-Bold').fontSize(12).fillColor('#1c1917');
+  doc.text('प्रत्येक उत्पाद / Per-Product Detail', left, doc.y);
+  doc.moveDown(0.3);
+
+  const itemCols = [
+    { label: 'SKU',     w: 0.15 },
+    { label: 'Metal',   w: 0.10 },
+    { label: 'Purity',  w: 0.10 },
+    { label: 'Weight',  w: 0.13 },
+    { label: 'Days',    w: 0.10 },
+    { label: 'Bucket',  w: 0.13 },
+    { label: 'Cost',    w: 0.15 },
+    { label: 'Listed',  w: 0.14 },
+  ];
+  doc.font('Devanagari-Bold').fontSize(9).fillColor('#57534e');
+  x = left;
+  for (const c of itemCols) {
+    doc.text(c.label, x, doc.y, { width: tableWidth * c.w });
+    x += tableWidth * c.w;
+  }
+  doc.moveDown(0.3);
+  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#B58A3C').lineWidth(1).stroke();
+  doc.moveDown(0.3);
+
+  doc.font('Devanagari').fontSize(8).fillColor('#1c1917');
+  for (const it of data.items) {
+    const y = doc.y;
+    if (y > doc.page.height - doc.page.margins.bottom - 80) {
+      doc.addPage();
+    }
+    x = left;
+    const cells = [
+      it.sku,
+      it.metal,
+      it.purity,
+      it.weightG,
+      `${it.daysInStock}`,
+      it.bucket,
+      it.costPaise === null ? '—' : formatINR(it.costPaise),
+      it.firstListedAt.slice(0, 10),
+    ];
+    for (let i = 0; i < itemCols.length; i++) {
+      doc.text(cells[i]!, x, y, {
+        width: tableWidth * itemCols[i]!.w,
+        ellipsis: true,
+        lineBreak: false,
+      });
+      x += tableWidth * itemCols[i]!.w;
+    }
+    doc.moveDown(0.4);
+  }
+
+  doc.flushPages();
+  const range = doc.bufferedPageRange();
+  for (let i = range.start; i < range.start + range.count; i++) {
+    doc.switchToPage(i);
+    drawFooter(doc, branding, i - range.start + 1, range.count);
+  }
+}
+```
+
+- [ ] **Step 4: Wire into renderer**
+
+Edit `apps/api/src/modules/reports/pdf/renderer.ts` — add import and case:
+
+```typescript
+import { renderStockAging } from './templates/stock-aging';
+```
+
+```typescript
+case 'stock-aging':
+  await renderStockAging(doc, data as StockAgingResult, branding, this.storage);
+  break;
+```
+
+- [ ] **Step 5: Run test to verify it passes**
+
+```bash
+pnpm --filter @goldsmith/api test renderer.spec
+```
+
+Expected: PASS — all 5 templates green.
+
+- [ ] **Step 6: Commit**
+
+```bash
+git add apps/api/src/modules/reports/pdf/templates/stock-aging.ts apps/api/src/modules/reports/pdf/renderer.ts apps/api/src/modules/reports/pdf/renderer.spec.ts
+git commit -m "feat(ws-3a): add stock-aging PDF template (closes 5/5)"
+```
+
+---
+
+## Task C11: `ReportsExportService` (enqueue + poll + regenerate)
+
+**Files:**
+- Create: `apps/api/src/modules/reports/reports-export.service.ts`
+- Create: `apps/api/src/modules/reports/reports-export.service.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Create `apps/api/src/modules/reports/reports-export.service.spec.ts`:
+
+```typescript
+import { describe, expect, it, vi, beforeEach } from 'vitest';
+import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
+import { ReportsExportService } from './reports-export.service';
+
+const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000000';
+const USER = 'uuuuuuuu-bbbb-4000-8000-000000000001';
+const EXPORT_ID = '11111111-2222-4000-8000-000000000000';
+
+vi.mock('@goldsmith/tenant-context', () => ({
+  tenantContext: {
+    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
+  },
+}));
+
+vi.mock('@goldsmith/db', () => ({
+  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
+}));
+
+vi.mock('@goldsmith/audit', () => ({
+  auditLog: vi.fn(),
+  AuditAction: {
+    REPORT_EXPORT_REQUESTED: 'REPORT_EXPORT_REQUESTED',
+    REPORT_EXPORT_REGENERATED: 'REPORT_EXPORT_REGENERATED',
+  },
+}));
+
+let fakeTx: { query: ReturnType<typeof vi.fn> };
+let fakeQueue: { add: ReturnType<typeof vi.fn> };
+let fakeStorage: { getPresignedReadUrl: ReturnType<typeof vi.fn>; downloadBuffer: ReturnType<typeof vi.fn> };
+
+function makeSvc(): ReportsExportService {
+  return new ReportsExportService({} as never, fakeQueue as never, fakeStorage as never);
+}
+
+beforeEach(() => {
+  fakeTx = { query: vi.fn() };
+  fakeQueue = { add: vi.fn().mockResolvedValue(undefined) };
+  fakeStorage = {
+    getPresignedReadUrl: vi.fn().mockResolvedValue('https://signed.example/readme'),
+    downloadBuffer: vi.fn(),
+  };
+});
+
+describe('ReportsExportService.enqueue', () => {
+  it('rejects unknown reportType', async () => {
+    const svc = makeSvc();
+    await expect(svc.enqueue('unknown' as never, {})).rejects.toBeInstanceOf(BadRequestException);
+  });
+
+  it('inserts row and enqueues BullMQ job', async () => {
+    fakeTx.query.mockResolvedValueOnce({ rows: [{ id: EXPORT_ID }] });
+    const svc = makeSvc();
+    const result = await svc.enqueue('daily-summary', { date: '2026-04-29' });
+    expect(result).toEqual({ id: EXPORT_ID, status: 'QUEUED' });
+    expect(fakeQueue.add).toHaveBeenCalledWith(
+      'render',
+      expect.objectContaining({
+        shopId: SHOP,
+        exportId: EXPORT_ID,
+        reportType: 'daily-summary',
+        params: { date: '2026-04-29' },
+      }),
+      expect.any(Object),
+    );
+  });
+});
+
+describe('ReportsExportService.getStatus', () => {
+  it('throws NotFound when row missing (RLS-filtered or wrong tenant)', async () => {
+    fakeTx.query.mockResolvedValueOnce({ rows: [] });
+    const svc = makeSvc();
+    await expect(svc.getStatus(EXPORT_ID)).rejects.toBeInstanceOf(NotFoundException);
+  });
+
+  it('returns READY with freshly signed downloadUrl when blob within retention', async () => {
+    fakeTx.query.mockResolvedValueOnce({
+      rows: [{
+        id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
+        storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
+        error_message: null,
+        created_at: new Date(),
+      }],
+    });
+    const svc = makeSvc();
+    const result = await svc.getStatus(EXPORT_ID);
+    expect(result.status).toBe('READY');
+    expect(result.downloadUrl).toBe('https://signed.example/readme');
+    expect(result.blobExpiresAt).toBeDefined();
+  });
+
+  it('returns READY without downloadUrl when blob older than 7 days', async () => {
+    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000);
+    fakeTx.query.mockResolvedValueOnce({
+      rows: [{
+        id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
+        storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
+        error_message: null,
+        created_at: eightDaysAgo,
+      }],
+    });
+    const svc = makeSvc();
+    const result = await svc.getStatus(EXPORT_ID);
+    expect(result.status).toBe('READY');
+    expect(result.downloadUrl).toBeUndefined();
+  });
+
+  it('returns FAILED with errorMessage', async () => {
+    fakeTx.query.mockResolvedValueOnce({
+      rows: [{
+        id: EXPORT_ID, report_type: 'daily-summary', status: 'FAILED',
+        storage_key: null,
+        error_message: 'render failed: out of memory',
+        created_at: new Date(),
+      }],
+    });
+    const svc = makeSvc();
+    const result = await svc.getStatus(EXPORT_ID);
+    expect(result.status).toBe('FAILED');
+    expect(result.errorMessage).toBe('render failed: out of memory');
+  });
+});
+
+describe('ReportsExportService.regenerate', () => {
+  it('rejects when export is QUEUED or RUNNING', async () => {
+    fakeTx.query.mockResolvedValueOnce({
+      rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'RUNNING',
+               storage_key: null, error_message: null, created_at: new Date(), params: {} }],
+    });
+    const svc = makeSvc();
+    await expect(svc.regenerate(EXPORT_ID)).rejects.toBeInstanceOf(ConflictException);
+  });
+
+  it('re-signs without re-rendering when blob fresh', async () => {
+    const freshDate = new Date(Date.now() - 86400_000); // 1 day ago
+    fakeTx.query.mockResolvedValueOnce({
+      rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
+               storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
+               error_message: null, created_at: freshDate, params: {} }],
+    });
+    fakeStorage.downloadBuffer.mockResolvedValueOnce(Buffer.from([1, 2, 3]));
+    const svc = makeSvc();
+    const result = await svc.regenerate(EXPORT_ID);
+    expect(result.downloadUrl).toBe('https://signed.example/readme');
+    expect(fakeQueue.add).not.toHaveBeenCalled();
+  });
+
+  it('re-enqueues when blob is missing', async () => {
+    fakeTx.query
+      .mockResolvedValueOnce({
+        rows: [{ id: EXPORT_ID, report_type: 'daily-summary', status: 'READY',
+                 storage_key: 'tenants/x/reports/daily-summary/foo.pdf',
+                 error_message: null, created_at: new Date(), params: {} }],
+      })
+      .mockResolvedValueOnce({ rowCount: 1 });
+    fakeStorage.downloadBuffer.mockRejectedValueOnce(new Error('blob missing'));
+    const svc = makeSvc();
+    const result = await svc.regenerate(EXPORT_ID);
+    expect(result.status).toBe('QUEUED');
+    expect(fakeQueue.add).toHaveBeenCalled();
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test reports-export.service.spec
+```
+
+Expected: FAIL — `Cannot find module './reports-export.service'`.
+
+- [ ] **Step 3: Implement `ReportsExportService`**
+
+Create `apps/api/src/modules/reports/reports-export.service.ts`:
+
+```typescript
+import {
+  BadRequestException, ConflictException, Inject, Injectable, NotFoundException,
+} from '@nestjs/common';
+import type { Pool } from 'pg';
+import { InjectQueue } from '@nestjs/bullmq';
+import type { Queue } from 'bullmq';
+import { withTenantTx } from '@goldsmith/db';
+import { tenantContext } from '@goldsmith/tenant-context';
+import { auditLog, AuditAction } from '@goldsmith/audit';
+import { STORAGE_PORT } from '@goldsmith/integrations-storage';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+import type { ReportType } from './pdf/renderer';
+
+const VALID_REPORT_TYPES: ReportType[] = [
+  'daily-summary', 'outstanding', 'customer-ltv', 'loyalty-summary', 'stock-aging',
+];
+
+const BLOB_RETENTION_DAYS = 7;
+
+export interface ExportEnqueueParams {
+  date?: string;
+  limit?: number;
+  page?: number;
+}
+
+export interface ExportStatusResult {
+  id:             string;
+  reportType:     ReportType;
+  status:         'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
+  downloadUrl?:   string;
+  blobExpiresAt?: string;
+  errorMessage?:  string;
+}
+
+interface ExportRow {
+  id:             string;
+  report_type:    ReportType;
+  status:         'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
+  storage_key:    string | null;
+  error_message:  string | null;
+  created_at:     Date;
+  params:         ExportEnqueueParams;
+}
+
+@Injectable()
+export class ReportsExportService {
+  constructor(
+    @Inject('PG_POOL') private readonly pool: Pool,
+    @InjectQueue('reports-pdf') private readonly queue: Queue,
+    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
+  ) {}
+
+  async enqueue(reportType: ReportType, params: ExportEnqueueParams): Promise<{ id: string; status: 'QUEUED' }> {
+    if (!VALID_REPORT_TYPES.includes(reportType)) {
+      throw new BadRequestException({ code: 'reports.export.invalid_report_type' });
+    }
+    const ctx = tenantContext.requireCurrent();
+    if (!ctx.authenticated) {
+      throw new BadRequestException({ code: 'reports.export.unauthenticated' });
+    }
+    const userId = ctx.userId;
+
+    const id = await withTenantTx(this.pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO reports_pdf_exports (shop_id, report_type, params, status, requested_by_user_id)
+         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2::jsonb, 'QUEUED', $3)
+         RETURNING id`,
+        [reportType, JSON.stringify(params), userId],
+      );
+      return r.rows[0]!.id;
+    });
+
+    await this.queue.add('render', {
+      shopId:     ctx.shopId,
+      exportId:   id,
+      reportType,
+      params,
+    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
+
+    await auditLog(this.pool, {
+      action: AuditAction.REPORT_EXPORT_REQUESTED,
+      subjectType: 'report',
+      subjectId: id,
+      actorUserId: userId,
+      after: { reportType, params },
+    });
+
+    return { id, status: 'QUEUED' };
+  }
+
+  async getStatus(id: string): Promise<ExportStatusResult> {
+    const row = await this.fetchRow(id);
+    return this.toStatusResult(row);
+  }
+
+  async regenerate(id: string): Promise<ExportStatusResult> {
+    const row = await this.fetchRow(id);
+    if (row.status === 'QUEUED' || row.status === 'RUNNING') {
+      throw new ConflictException({ code: 'reports.export.busy' });
+    }
+
+    const ctx = tenantContext.requireCurrent();
+    const userId = ctx.authenticated ? ctx.userId : undefined;
+
+    // Try to re-sign existing blob if within retention window.
+    const ageMs = Date.now() - row.created_at.getTime();
+    const withinRetention = ageMs < BLOB_RETENTION_DAYS * 86400_000 && row.storage_key !== null;
+
+    if (withinRetention) {
+      try {
+        await this.storage.downloadBuffer(row.storage_key!); // probes blob existence
+        await auditLog(this.pool, {
+          action: AuditAction.REPORT_EXPORT_REGENERATED,
+          subjectType: 'report',
+          subjectId: id,
+          actorUserId: userId,
+          metadata: { mode: 'resign' },
+        });
+        return this.toStatusResult({ ...row, status: 'READY' });
+      } catch {
+        // blob missing — fall through to re-render
+      }
+    }
+
+    // Re-render: reset row, enqueue fresh job.
+    await withTenantTx(this.pool, async (tx) => {
+      await tx.query(
+        `UPDATE reports_pdf_exports
+         SET status = 'QUEUED',
+             storage_key = NULL,
+             error_message = NULL,
+             completed_at = NULL,
+             created_at = now()
+         WHERE id = $1`,
+        [id],
+      );
+    });
+    await this.queue.add('render', {
+      shopId:     ctx.shopId,
+      exportId:   id,
+      reportType: row.report_type,
+      params:     row.params,
+    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
+
+    await auditLog(this.pool, {
+      action: AuditAction.REPORT_EXPORT_REGENERATED,
+      subjectType: 'report',
+      subjectId: id,
+      actorUserId: userId,
+      metadata: { mode: 'rerender' },
+    });
+
+    return { id, reportType: row.report_type, status: 'QUEUED' };
+  }
+
+  private async fetchRow(id: string): Promise<ExportRow> {
+    const row = await withTenantTx(this.pool, async (tx) => {
+      const r = await tx.query<ExportRow>(
+        `SELECT id, report_type, status, storage_key, error_message, created_at, params
+         FROM reports_pdf_exports
+         WHERE id = $1`,
+        [id],
+      );
+      return r.rows[0];
+    });
+    if (!row) throw new NotFoundException({ code: 'reports.export.not_found' });
+    return row;
+  }
+
+  private async toStatusResult(row: ExportRow): Promise<ExportStatusResult> {
+    const result: ExportStatusResult = {
+      id:         row.id,
+      reportType: row.report_type,
+      status:     row.status,
+    };
+    if (row.error_message) result.errorMessage = row.error_message;
+    if (row.status === 'READY' && row.storage_key) {
+      const ageMs = Date.now() - row.created_at.getTime();
+      const blobExpiresAt = new Date(row.created_at.getTime() + BLOB_RETENTION_DAYS * 86400_000);
+      if (ageMs < BLOB_RETENTION_DAYS * 86400_000) {
+        result.downloadUrl = await this.storage.getPresignedReadUrl(row.storage_key);
+      }
+      result.blobExpiresAt = blobExpiresAt.toISOString();
+    }
+    return result;
+  }
+}
+```
+
+- [ ] **Step 4: Run tests to verify they pass**
+
+```bash
+pnpm --filter @goldsmith/api test reports-export.service.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports-export.service.ts apps/api/src/modules/reports/reports-export.service.spec.ts
+git commit -m "feat(ws-3a): add ReportsExportService (enqueue/status/regenerate)"
+```
+
+---
+
+## Task C12: `ReportsPdfProcessor` (BullMQ worker)
+
+**Files:**
+- Create: `apps/api/src/workers/reports-pdf.processor.ts`
+- Create: `apps/api/src/workers/reports-pdf.processor.spec.ts`
+
+- [ ] **Step 1: Write the failing test**
+
+Create `apps/api/src/workers/reports-pdf.processor.spec.ts`:
+
+```typescript
+import { describe, expect, it, vi, beforeEach } from 'vitest';
+import { ReportsPdfProcessor } from './reports-pdf.processor';
+
+const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000000';
+const EXPORT_ID = '11111111-2222-4000-8000-000000000000';
+
+let fakeReports: { getDailySummary: ReturnType<typeof vi.fn>; [k: string]: unknown };
+let fakeRenderer: { render: ReturnType<typeof vi.fn> };
+let fakeStorage: { uploadBuffer: ReturnType<typeof vi.fn> };
+let fakeBranding: { load: ReturnType<typeof vi.fn> };
+let fakePool: { query: ReturnType<typeof vi.fn> };
+
+vi.mock('@goldsmith/tenant-context', () => ({
+  tenantContext: {
+    runWith: async (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
+  },
+}));
+
+vi.mock('@goldsmith/db', () => ({
+  withTenantTx: async (_pool: unknown, fn: (tx: unknown) => Promise<unknown>) =>
+    fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) }),
+}));
+
+beforeEach(() => {
+  fakeReports = {
+    getDailySummary:    vi.fn().mockResolvedValue({ date: '2026-04-29' }),
+    getOutstanding:     vi.fn(),
+    getCustomerLtv:     vi.fn(),
+    getLoyaltySummary:  vi.fn(),
+    getStockAging:      vi.fn(),
+  };
+  fakeRenderer = { render: vi.fn().mockResolvedValue(Buffer.from('PDF-bytes')) };
+  fakeStorage = { uploadBuffer: vi.fn().mockResolvedValue(undefined) };
+  fakeBranding = { load: vi.fn().mockResolvedValue({ displayName: 'X', logoUrl: null, addressText: '', gstin: null, contactPhone: null }) };
+  fakePool = {
+    query: vi.fn().mockResolvedValueOnce({
+      rows: [{ id: SHOP, slug: 'x', display_name: 'X', status: 'ACTIVE' }],
+    }),
+  };
+});
+
+function makeProcessor(): ReportsPdfProcessor {
+  return new ReportsPdfProcessor(
+    fakeReports as never,
+    fakeRenderer as never,
+    fakeStorage as never,
+    fakeBranding as never,
+    fakePool as never,
+  );
+}
+
+describe('ReportsPdfProcessor', () => {
+  it('renders + uploads + updates row to READY', async () => {
+    const job = {
+      id: 'j1',
+      data: {
+        shopId: SHOP, exportId: EXPORT_ID,
+        reportType: 'daily-summary', params: { date: '2026-04-29' },
+      },
+    };
+    const proc = makeProcessor();
+    await proc.process(job as never);
+
+    expect(fakeReports.getDailySummary).toHaveBeenCalledWith('2026-04-29');
+    expect(fakeRenderer.render).toHaveBeenCalledWith(
+      'daily-summary', expect.anything(), expect.anything(),
+    );
+    expect(fakeStorage.uploadBuffer).toHaveBeenCalledWith(
+      expect.stringContaining(`tenants/${SHOP}/reports/daily-summary/`),
+      expect.any(Buffer),
+      'application/pdf',
+    );
+  });
+
+  it('marks row FAILED on render error', async () => {
+    fakeRenderer.render.mockRejectedValueOnce(new Error('render boom'));
+    const job = {
+      id: 'j2',
+      data: {
+        shopId: SHOP, exportId: EXPORT_ID,
+        reportType: 'daily-summary', params: {},
+      },
+    };
+    const proc = makeProcessor();
+    await expect(proc.process(job as never)).rejects.toThrow('render boom');
+  });
+});
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+```bash
+pnpm --filter @goldsmith/api test reports-pdf.processor.spec
+```
+
+Expected: FAIL — `Cannot find module './reports-pdf.processor'`.
+
+- [ ] **Step 3: Implement processor**
+
+Create `apps/api/src/workers/reports-pdf.processor.ts`:
+
+```typescript
+import { Inject, Logger } from '@nestjs/common';
+import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
+import type { Job } from 'bullmq';
+import type { Pool } from 'pg';
+import { tenantContext } from '@goldsmith/tenant-context';
+import type { TenantContext, Tenant } from '@goldsmith/tenant-context';
+import { withTenantTx } from '@goldsmith/db';
+import { STORAGE_PORT } from '@goldsmith/integrations-storage';
+import type { StoragePort } from '@goldsmith/integrations-storage';
+import { ReportsService } from '../modules/reports/reports.service';
+import { PdfRenderer } from '../modules/reports/pdf/renderer';
+import type { ReportType, ReportData } from '../modules/reports/pdf/renderer';
+import { BrandingLoader } from '../modules/reports/pdf/branding';
+
+export interface ReportsPdfJob {
+  shopId:     string;
+  exportId:   string;
+  reportType: ReportType;
+  params:     Record<string, unknown>;
+}
+
+@Processor('reports-pdf')
+export class ReportsPdfProcessor extends WorkerHost {
+  private readonly logger = new Logger(ReportsPdfProcessor.name);
+
+  constructor(
+    @Inject(ReportsService)  private readonly reports: ReportsService,
+    @Inject(PdfRenderer)     private readonly renderer: PdfRenderer,
+    @Inject(STORAGE_PORT)    private readonly storage: StoragePort,
+    @Inject(BrandingLoader)  private readonly branding: BrandingLoader,
+    @Inject('PG_POOL')       private readonly pool: Pool,
+  ) {
+    super();
+  }
+
+  async process(job: Job<ReportsPdfJob>): Promise<{ storageKey: string }> {
+    const { shopId, exportId, reportType, params } = job.data;
+    this.logger.log(`reports-pdf: shopId=${shopId} exportId=${exportId} type=${reportType}`);
+
+    const ctx = await this.buildTenantCtx(shopId);
+
+    return tenantContext.runWith(ctx, async () => {
+      // 1. Mark RUNNING (idempotent on retries — only QUEUED → RUNNING)
+      await withTenantTx(this.pool, async (tx) => {
+        await tx.query(
+          `UPDATE reports_pdf_exports
+           SET status = 'RUNNING'
+           WHERE id = $1 AND status = 'QUEUED'`,
+          [exportId],
+        );
+      });
+
+      try {
+        // 2. Fetch report data
+        const data = await this.fetchReportData(reportType, params);
+
+        // 3. Render PDF
+        const branding = await this.branding.load();
+        const buf = await this.renderer.render(reportType, data, branding);
+
+        // 4. Upload
+        const filename = `${reportType}-${exportId}.pdf`;
+        const key = `tenants/${shopId}/reports/${reportType}/${filename}`;
+        await this.storage.uploadBuffer(key, buf, 'application/pdf');
+
+        // 5. Mark READY
+        await withTenantTx(this.pool, async (tx) => {
+          await tx.query(
+            `UPDATE reports_pdf_exports
+             SET status = 'READY', storage_key = $2, completed_at = now()
+             WHERE id = $1`,
+            [exportId, key],
+          );
+        });
+
+        return { storageKey: key };
+      } catch (err) {
+        const message = err instanceof Error ? err.message : 'unknown error';
+        await withTenantTx(this.pool, async (tx) => {
+          await tx.query(
+            `UPDATE reports_pdf_exports
+             SET status = 'FAILED', error_message = $2, completed_at = now()
+             WHERE id = $1`,
+            [exportId, message.slice(0, 500)],
+          );
+        });
+        throw err;
+      }
+    });
+  }
+
+  private async fetchReportData(
+    reportType: ReportType,
+    params: Record<string, unknown>,
+  ): Promise<ReportData> {
+    switch (reportType) {
+      case 'daily-summary': {
+        const date = (params['date'] as string) ??
+          new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
+        return this.reports.getDailySummary(date);
+      }
+      case 'outstanding':
+        return this.reports.getOutstanding(1, 1000);
+      case 'customer-ltv':
+        return this.reports.getCustomerLtv((params['limit'] as number) ?? 50);
+      case 'loyalty-summary':
+        return this.reports.getLoyaltySummary();
+      case 'stock-aging':
+        return this.reports.getStockAging();
+      default:
+        throw new Error(`reports.pdf.unknown_report_type:${reportType}`);
+    }
+  }
+
+  // eslint-disable-next-line goldsmith/no-raw-shop-id-param
+  private async buildTenantCtx(shopId: string): Promise<TenantContext> {
+    const r = await this.pool.query<{
+      id: string; slug: string; display_name: string; status: Tenant['status'];
+    }>(`SELECT id, slug, display_name, status FROM shops WHERE id = $1`, [shopId]);
+    const row = r.rows[0];
+    if (!row) throw new Error(`reports-pdf: shop ${shopId} not found`);
+    return {
+      authenticated: false,
+      shopId,
+      tenant: { id: row.id, slug: row.slug, display_name: row.display_name, status: row.status },
+    };
+  }
+
+  @OnWorkerEvent('failed')
+  onFailed(job: Job | undefined, error: Error): void {
+    this.logger.error(
+      `reports-pdf failed: jobId=${job?.id} exportId=${(job?.data as { exportId?: string })?.exportId} error=${error.message}`,
+      error.stack,
+    );
+  }
+}
+```
+
+- [ ] **Step 4: Run tests to verify they pass**
+
+```bash
+pnpm --filter @goldsmith/api test reports-pdf.processor.spec
+```
+
+Expected: PASS.
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add apps/api/src/workers/reports-pdf.processor.ts apps/api/src/workers/reports-pdf.processor.spec.ts
+git commit -m "feat(ws-3a): add ReportsPdfProcessor BullMQ worker"
+```
+
+---
+
+## Task C13: Wire `ReportsModule` + add 3 `/exports*` controller routes
+
+**Files:**
+- Modify: `apps/api/src/modules/reports/reports.module.ts`
+- Modify: `apps/api/src/modules/reports/reports.controller.ts`
+
+- [ ] **Step 1: Update `ReportsModule`**
+
+Replace the contents of `apps/api/src/modules/reports/reports.module.ts`:
+
+```typescript
+import { Module } from '@nestjs/common';
+import { BullModule } from '@nestjs/bullmq';
+import { StorageModule } from '@goldsmith/integrations-storage';
+import { AuthModule } from '../auth/auth.module';
+import { ReportsController } from './reports.controller';
+import { ReportsService } from './reports.service';
+import { ReportsExportService } from './reports-export.service';
+import { BrandingLoader } from './pdf/branding';
+import { PdfRenderer } from './pdf/renderer';
+import { ReportsPdfProcessor } from '../../workers/reports-pdf.processor';
+
+@Module({
+  imports: [
+    AuthModule,
+    StorageModule,
+    BullModule.registerQueue({ name: 'reports-pdf' }),
+  ],
+  controllers: [ReportsController],
+  providers: [
+    ReportsService,
+    ReportsExportService,
+    BrandingLoader,
+    PdfRenderer,
+    ReportsPdfProcessor,
+  ],
+  exports: [ReportsService],
+})
+export class ReportsModule {}
+```
+
+- [ ] **Step 2: Add 3 controller routes**
+
+Edit `apps/api/src/modules/reports/reports.controller.ts`:
+
+1. Update imports — add `Body, Param, Post`, `ZodValidationPipe`, and `ReportsExportService`/`Inject`:
+
+```typescript
+import {
+  Controller, Get, Post, Body, Param, Query, Inject,
+  ParseIntPipe, DefaultValuePipe, Res,
+} from '@nestjs/common';
+import type { Response } from 'express';
+import { z } from 'zod';
+import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
+import { Roles } from '../../common/decorators/roles.decorator';
+import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
+import { ReportsService } from './reports.service';
+import type {
+  DailySummaryResult, OutstandingResult, CustomerLtvItem, LoyaltySummaryResult,
+  StockAgingResult,
+} from './reports.service';
+import {
+  toDailySummaryCsv, toOutstandingCsv, toCustomerLtvCsv,
+  toLoyaltySummaryCsv, toStockAgingCsv,
+} from './reports.csv';
+import { ReportsExportService } from './reports-export.service';
+import type { ExportStatusResult } from './reports-export.service';
+import type { ReportType } from './pdf/renderer';
+
+const ExportRequestSchema = z.object({
+  reportType: z.enum(['daily-summary', 'outstanding', 'customer-ltv', 'loyalty-summary', 'stock-aging']),
+  params: z.record(z.unknown()).optional().default({}),
+});
+type ExportRequestDto = z.infer<typeof ExportRequestSchema>;
+```
+
+2. Update the constructor to inject the export service:
+
+```typescript
+constructor(
+  private readonly svc: ReportsService,
+  @Inject(ReportsExportService) private readonly exports: ReportsExportService,
+) {}
+```
+
+3. Append three new methods at the bottom of the class (before `private todayIST()`):
+
+```typescript
+@TenantWalkerRoute({
+  expectedStatus: 400,
+  body: { /* missing reportType triggers Zod 400 */ },
+})
+@Post('/exports')
+@Roles('shop_admin', 'shop_manager')
+async createExport(
+  @Body(new ZodValidationPipe(ExportRequestSchema)) dto: ExportRequestDto,
+): Promise<{ id: string; status: 'QUEUED' }> {
+  return this.exports.enqueue(dto.reportType as ReportType, dto.params);
+}
+
+@TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-4000-8000-000000000000' } })
+@Get('/exports/:id')
+@Roles('shop_admin', 'shop_manager')
+async getExportStatus(@Param('id') id: string): Promise<ExportStatusResult> {
+  return this.exports.getStatus(id);
+}
+
+@TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-4000-8000-000000000000' } })
+@Post('/exports/:id/regenerate')
+@Roles('shop_admin', 'shop_manager')
+async regenerateExport(@Param('id') id: string): Promise<ExportStatusResult> {
+  return this.exports.regenerate(id);
+}
+```
+
+- [ ] **Step 3: Verify typecheck + endpoint walker + integration**
+
+```bash
+pnpm --filter @goldsmith/api typecheck
+pnpm --filter @goldsmith/api test:e2e
+pnpm --filter @goldsmith/api test
+```
+
+Expected: All PASS.
+
+- [ ] **Step 4: Commit**
+
+```bash
+git add apps/api/src/modules/reports/reports.module.ts apps/api/src/modules/reports/reports.controller.ts
+git commit -m "feat(ws-3a): wire ReportsModule providers + 3 /exports routes"
+```
+
+---
+
+# WS-D — Shopkeeper UI
+
+## Task D1: `useStockAging` hook + add stock-aging route
+
+**Files:**
+- Modify: `apps/shopkeeper/src/features/reports/useReports.ts`
+- Modify: `apps/shopkeeper/app/reports/_layout.tsx`
+
+- [ ] **Step 1: Add types and hook to `useReports.ts`**
+
+Append to `apps/shopkeeper/src/features/reports/useReports.ts`:
+
+```typescript
+export interface StockAgingBucket {
+  label: '<30d' | '30-60d' | '60-90d' | '90d+';
+  count: number;
+  totalWeightMg: string;
+  totalCostPaise: string;
+}
+
+export interface StockAgingItem {
+  id: string;
+  sku: string;
+  metal: string;
+  purity: string;
+  weightG: string;
+  daysInStock: number;
+  bucket: StockAgingBucket['label'];
+  costPaise: string | null;
+  firstListedAt: string;
+}
+
+export interface StockAgingData {
+  buckets: StockAgingBucket[];
+  items: StockAgingItem[];
+}
+
+export function useStockAging(): UseQueryResult<StockAgingData> {
+  return useQuery({
+    queryKey: ['reports', 'stock-aging'],
+    queryFn: async () => {
+      const res = await api.get<StockAgingData>(`/api/v1/reports/stock-aging`);
+      return res.data;
+    },
+    staleTime: 300_000,
+  });
+}
+```
+
+- [ ] **Step 2: Register stock-aging route in `_layout.tsx`**
+
+Edit `apps/shopkeeper/app/reports/_layout.tsx` — add a `<Stack.Screen>` line:
+
+```typescript
+<Stack.Screen name="stock-aging"      options={{ title: 'पुराना स्टॉक' }} />
+```
+
+Final `_layout.tsx`:
+
+```typescript
+import React from 'react';
+import { Stack } from 'expo-router';
+
+export default function ReportsLayout(): React.ReactElement {
+  return (
+    <Stack
+      screenOptions={{
+        headerStyle: { backgroundColor: '#F5EDDD' },
+        headerTintColor: '#2C1810',
+        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
+      }}
+    >
+      <Stack.Screen name="gstr-export"       options={{ title: 'GST रिपोर्ट' }} />
+      <Stack.Screen name="daily-summary"     options={{ title: 'दैनिक बिक्री' }} />
+      <Stack.Screen name="outstanding"       options={{ title: 'बकाया भुगतान' }} />
+      <Stack.Screen name="customer-ltv"      options={{ title: 'शीर्ष ग्राहक' }} />
+      <Stack.Screen name="loyalty-summary"   options={{ title: 'लॉयल्टी कार्यक्रम' }} />
+      <Stack.Screen name="stock-aging"       options={{ title: 'पुराना स्टॉक' }} />
+    </Stack>
+  );
+}
+```
+
+- [ ] **Step 3: Verify typecheck**
+
+```bash
+pnpm --filter @goldsmith/shopkeeper typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 4: Commit**
+
+```bash
+git add apps/shopkeeper/src/features/reports/useReports.ts apps/shopkeeper/app/reports/_layout.tsx
+git commit -m "feat(ws-3a): add useStockAging hook + register stock-aging route"
+```
+
+---
+
+## Task D2: Stock-aging mobile screen
+
+**Files:**
+- Create: `apps/shopkeeper/app/reports/stock-aging.tsx`
+
+- [ ] **Step 1: Implement screen**
+
+Create `apps/shopkeeper/app/reports/stock-aging.tsx`:
+
+```typescript
+import React from 'react';
+import {
+  View, Text, ScrollView, ActivityIndicator, StyleSheet, Pressable,
+} from 'react-native';
+import { colors, spacing } from '@goldsmith/ui-tokens';
+import {
+  useStockAging, formatPaise, formatWeightMg,
+  type StockAgingBucket,
+} from '../../src/features/reports/useReports';
+
+const GOLD = '#B58A3C';
+const ALERT = '#C53030';
+
+const BUCKET_LABELS: Record<StockAgingBucket['label'], string> = {
+  '<30d':   '0–30 दिन',
+  '30-60d': '30–60 दिन',
+  '60-90d': '60–90 दिन',
+  '90d+':   '90+ दिन',
+};
+
+function BucketCard({ bucket }: { bucket: StockAgingBucket }): React.ReactElement {
+  const isAlert = bucket.label === '90d+' && bucket.count > 0;
+  return (
+    <View style={[styles.bucketCard, isAlert && styles.bucketCardAlert]}>
+      <Text style={[styles.bucketLabel, isAlert && styles.bucketLabelAlert]}>
+        {BUCKET_LABELS[bucket.label]}
+      </Text>
+      <Text style={[styles.bucketCount, isAlert && styles.bucketCountAlert]}>
+        {bucket.count}
+      </Text>
+      <Text style={styles.bucketSubLabel}>{formatWeightMg(bucket.totalWeightMg)}</Text>
+      <Text style={styles.bucketSubLabel}>{formatPaise(bucket.totalCostPaise)}</Text>
+    </View>
+  );
+}
+
+export default function StockAgingScreen(): React.ReactElement {
+  const { data, isLoading, error, refetch } = useStockAging();
+
+  return (
+    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
+      {isLoading && (
+        <ActivityIndicator color={GOLD} size="large" style={{ marginTop: 40 }} />
+      )}
+
+      {error && (
+        <View style={styles.errorBox}>
+          <Text style={styles.errorText}>डेटा लोड नहीं हो सका।</Text>
+          <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
+            <Text style={styles.retryText}>पुनः प्रयास करें</Text>
+          </Pressable>
+        </View>
+      )}
+
+      {data && (
+        <>
+          <View style={styles.bucketRow}>
+            {data.buckets.map((b) => <BucketCard key={b.label} bucket={b} />)}
+          </View>
+
+          <Text style={styles.sectionHeader}>प्रत्येक उत्पाद / Per-Product</Text>
+
+          {data.items.length === 0 && (
+            <Text style={styles.emptyText}>कोई स्टॉक नहीं मिला।</Text>
+          )}
+
+          {data.items.map((it) => {
+            const isAged = it.bucket === '90d+';
+            return (
+              <View key={it.id} style={[styles.itemRow, isAged && styles.itemRowAlert]}>
+                <View style={{ flex: 1 }}>
+                  <Text style={styles.itemSku}>{it.sku}</Text>
+                  <Text style={styles.itemSubLabel}>
+                    {it.metal} {it.purity} · {it.weightG} g
+                  </Text>
+                </View>
+                <View style={styles.itemRight}>
+                  <Text style={[styles.itemDays, isAged && styles.itemDaysAlert]}>
+                    {it.daysInStock} दिन
+                  </Text>
+                  <Text style={styles.itemBucket}>{BUCKET_LABELS[it.bucket]}</Text>
+                </View>
+              </View>
+            );
+          })}
+        </>
+      )}
+    </ScrollView>
+  );
+}
+
+const styles = StyleSheet.create({
+  container:        { flex: 1, backgroundColor: colors.bg },
+  content:          { padding: spacing.lg, paddingBottom: 40 },
+  bucketRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
+  bucketCard:       { flexBasis: '48%', flexGrow: 1, padding: spacing.md, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minHeight: 96 },
+  bucketCardAlert:  { borderColor: ALERT, backgroundColor: '#FFF5F5' },
+  bucketLabel:      { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: colors.inkMute },
+  bucketLabelAlert: { color: ALERT },
+  bucketCount:      { fontFamily: 'MuktaVaani-700', fontSize: 28, color: GOLD, marginVertical: 4 },
+  bucketCountAlert: { color: ALERT },
+  bucketSubLabel:   { fontFamily: 'NotoSansDevanagari', fontSize: 11, color: colors.inkMute },
+  sectionHeader:    { fontFamily: 'NotoSansDevanagari', fontSize: 16, fontWeight: '600', color: colors.ink, marginTop: 16, marginBottom: 8 },
+  itemRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, minHeight: 48 },
+  itemRowAlert:     { backgroundColor: '#FFF5F5' },
+  itemSku:          { fontFamily: 'MuktaVaani-600', fontSize: 14, color: colors.ink },
+  itemSubLabel:     { fontFamily: 'NotoSansDevanagari', fontSize: 12, color: colors.inkMute, marginTop: 2 },
+  itemRight:        { alignItems: 'flex-end' },
+  itemDays:         { fontFamily: 'MuktaVaani-600', fontSize: 14, color: colors.ink },
+  itemDaysAlert:    { color: ALERT },
+  itemBucket:       { fontFamily: 'NotoSansDevanagari', fontSize: 11, color: colors.inkMute, marginTop: 2 },
+  emptyText:        { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: colors.inkMute, textAlign: 'center', marginTop: 24 },
+  errorBox:         { alignItems: 'center', marginTop: 40 },
+  errorText:        { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.error, marginBottom: 16 },
+  retryBtn:         { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
+  retryText:        { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#fff', fontWeight: '600' },
+});
+```
+
+- [ ] **Step 2: Verify typecheck**
+
+```bash
+pnpm --filter @goldsmith/shopkeeper typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add apps/shopkeeper/app/reports/stock-aging.tsx
+git commit -m "feat(ws-3a): add stock-aging shopkeeper screen with bucket cards"
+```
+
+---
+
+## Task D3: `useReportExport` polling hook
+
+**Files:**
+- Create: `apps/shopkeeper/src/features/reports/useReportExport.ts`
+
+- [ ] **Step 1: Implement hook**
+
+Create `apps/shopkeeper/src/features/reports/useReportExport.ts`:
+
+```typescript
+import { useEffect, useState, useCallback } from 'react';
+import { Linking } from 'react-native';
+import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
+import { api } from '../../api/client';
+
+export type ReportType =
+  | 'daily-summary' | 'outstanding' | 'customer-ltv'
+  | 'loyalty-summary' | 'stock-aging';
+
+export type ExportStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
+
+export interface ExportStatusResponse {
+  id:             string;
+  reportType:     ReportType;
+  status:         ExportStatus;
+  downloadUrl?:   string;
+  blobExpiresAt?: string;
+  errorMessage?:  string;
+}
+
+export interface UseReportExportResult {
+  status:         ExportStatus | 'IDLE';
+  exportId:       string | null;
+  downloadUrl?:   string;
+  errorMessage?:  string;
+  start:          (params?: Record<string, unknown>) => void;
+  regenerate:     () => Promise<void>;
+  reset:          () => void;
+}
+
+export function useReportExport(reportType: ReportType): UseReportExportResult {
+  const [exportId, setExportId] = useState<string | null>(null);
+
+  const start = useMutation({
+    mutationFn: async (params: Record<string, unknown>) => {
+      const res = await api.post<{ id: string; status: 'QUEUED' }>(
+        '/api/v1/reports/exports',
+        { reportType, params },
+      );
+      return res.data;
+    },
+    onSuccess: (data) => setExportId(data.id),
+  });
+
+  const status = useQuery({
+    queryKey: ['reports', 'exports', exportId],
+    queryFn: async (): Promise<ExportStatusResponse> => {
+      const res = await api.get<ExportStatusResponse>(`/api/v1/reports/exports/${exportId!}`);
+      return res.data;
+    },
+    enabled: exportId !== null,
+    refetchInterval: (q) => {
+      const data = q.state.data as ExportStatusResponse | undefined;
+      if (!data) return 2000;
+      if (data.status === 'READY' || data.status === 'FAILED') return false;
+      return 2000;
+    },
+  });
+
+  // Auto-open when ready (single-trigger)
+  const [openedFor, setOpenedFor] = useState<string | null>(null);
+  useEffect(() => {
+    const data = status.data;
+    if (data && data.status === 'READY' && data.downloadUrl && openedFor !== data.id) {
+      setOpenedFor(data.id);
+      void Linking.openURL(data.downloadUrl);
+    }
+  }, [status.data, openedFor]);
+
+  const regenerate = useCallback(async () => {
+    if (!exportId) return;
+    const res = await api.post<ExportStatusResponse>(`/api/v1/reports/exports/${exportId}/regenerate`);
+    if (res.data.status === 'READY' && res.data.downloadUrl) {
+      void Linking.openURL(res.data.downloadUrl);
+    }
+    void status.refetch();
+  }, [exportId, status]);
+
+  const reset = useCallback(() => {
+    setExportId(null);
+    setOpenedFor(null);
+  }, []);
+
+  return {
+    status:        exportId === null ? 'IDLE' : (status.data?.status ?? 'QUEUED'),
+    exportId,
+    downloadUrl:   status.data?.downloadUrl,
+    errorMessage:  status.data?.errorMessage,
+    start:         (params) => start.mutate(params ?? {}),
+    regenerate,
+    reset,
+  };
+}
+```
+
+- [ ] **Step 2: Verify typecheck**
+
+```bash
+pnpm --filter @goldsmith/shopkeeper typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add apps/shopkeeper/src/features/reports/useReportExport.ts
+git commit -m "feat(ws-3a): add useReportExport polling hook"
+```
+
+---
+
+## Task D4: `ExportButtons` component
+
+**Files:**
+- Create: `apps/shopkeeper/src/features/reports/components/ExportButtons.tsx`
+
+- [ ] **Step 1: Implement component**
+
+Create `apps/shopkeeper/src/features/reports/components/ExportButtons.tsx`:
+
+```typescript
+import React, { useState } from 'react';
+import { View, Text, Pressable, ActivityIndicator, Linking, Share, StyleSheet } from 'react-native';
+import { colors } from '@goldsmith/ui-tokens';
+import { api } from '../../../api/client';
+import { useReportExport, type ReportType } from '../useReportExport';
+
+const GOLD = '#B58A3C';
+
+// Mirror of the existing GSTR pattern (apps/shopkeeper/app/reports/gstr-export.tsx:28).
+// Android Share API caps EXTRA_TEXT around ~100 KB; we surface a clear Hindi error
+// at 80 KB rather than letting the system silently truncate. Stock-aging in large
+// shops is the most likely report to hit this — instruct user to use PDF instead.
+const SHARE_TEXT_LIMIT_BYTES = 80 * 1024;
+
+function utf8ByteLength(s: string): number {
+  return new TextEncoder().encode(s).length;
+}
+
+interface ExportButtonsProps {
+  reportType: ReportType;
+  csvParams?: Record<string, string | number | undefined>;
+  pdfParams?: Record<string, unknown>;
+}
+
+export function ExportButtons(props: ExportButtonsProps): React.ReactElement {
+  const { reportType, csvParams = {}, pdfParams } = props;
+  const pdf = useReportExport(reportType);
+
+  const [csvBusy, setCsvBusy] = useState(false);
+  const [csvError, setCsvError] = useState<string | null>(null);
+
+  const onCsvPress = async (): Promise<void> => {
+    setCsvError(null);
+    setCsvBusy(true);
+    try {
+      const res = await api.get<{ csv: string; filename: string }>(
+        `/api/v1/reports/${reportType}.csv`,
+        { params: csvParams },
+      );
+      if (utf8ByteLength(res.data.csv) > SHARE_TEXT_LIMIT_BYTES) {
+        setCsvError('यह रिपोर्ट बहुत बड़ी है — कृपया PDF का उपयोग करें।');
+        return;
+      }
+      await Share.share({ title: res.data.filename, message: res.data.csv });
+    } catch {
+      setCsvError('CSV डाउनलोड नहीं हो सका। दोबारा कोशिश करें।');
+    } finally {
+      setCsvBusy(false);
+    }
+  };
+
+  const onPdfPress = (): void => {
+    if (pdf.status === 'IDLE' || pdf.status === 'FAILED') {
+      pdf.start(pdfParams);
+    } else if (pdf.status === 'READY' && pdf.downloadUrl) {
+      void Linking.openURL(pdf.downloadUrl);
+    }
+  };
+
+  const pdfLabel = ({
+    IDLE:    'PDF डाउनलोड',
+    QUEUED:  'तैयार हो रहा...',
+    RUNNING: 'तैयार हो रहा...',
+    READY:   'PDF खोलें',
+    FAILED:  'पुनः प्रयास',
+  })[pdf.status];
+
+  const isPdfBusy = pdf.status === 'QUEUED' || pdf.status === 'RUNNING';
+
+  return (
+    <View style={styles.row}>
+      <Pressable
+        onPress={onCsvPress}
+        disabled={csvBusy}
+        style={[styles.csvBtn, csvBusy && styles.btnBusy]}
+        accessibilityRole="button"
+        accessibilityLabel="CSV डाउनलोड"
+      >
+        {csvBusy && <ActivityIndicator size="small" color={GOLD} style={{ marginRight: 8 }} />}
+        <Text style={styles.csvBtnText}>CSV डाउनलोड</Text>
+      </Pressable>
+
+      <Pressable
+        onPress={onPdfPress}
+        disabled={isPdfBusy}
+        style={[styles.pdfBtn, isPdfBusy && styles.pdfBtnBusy]}
+        accessibilityRole="button"
+        accessibilityLabel={pdfLabel}
+      >
+        {isPdfBusy && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
+        <Text style={styles.pdfBtnText}>{pdfLabel}</Text>
+      </Pressable>
+
+      {csvError && (
+        <Text style={styles.errorText} numberOfLines={2}>{csvError}</Text>
+      )}
+      {pdf.status === 'FAILED' && pdf.errorMessage && (
+        <Text style={styles.errorText} numberOfLines={2}>
+          त्रुटि: {pdf.errorMessage}
+        </Text>
+      )}
+    </View>
+  );
+}
+
+const styles = StyleSheet.create({
+  row:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
+  csvBtn:        { flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: GOLD, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
+  csvBtnText:    { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: GOLD, fontWeight: '600' },
+  pdfBtn:        { flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
+  pdfBtnBusy:    { backgroundColor: '#A07832' },
+  pdfBtnText:    { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: '#fff', fontWeight: '600' },
+  btnBusy:       { opacity: 0.7 },
+  errorText:     { width: '100%', fontFamily: 'NotoSansDevanagari', fontSize: 12, color: colors.error, marginTop: 4 },
+});
+```
+
+- [ ] **Step 2: Verify typecheck**
+
+```bash
+pnpm --filter @goldsmith/shopkeeper typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add apps/shopkeeper/src/features/reports/components/ExportButtons.tsx
+git commit -m "feat(ws-3a): add ExportButtons (CSV download + PDF poll-and-open)"
+```
+
+---
+
+## Task D5: Wire `<ExportButtons>` into 5 existing report screens
+
+**Files:**
+- Modify: `apps/shopkeeper/app/reports/daily-summary.tsx`
+- Modify: `apps/shopkeeper/app/reports/outstanding.tsx`
+- Modify: `apps/shopkeeper/app/reports/customer-ltv.tsx`
+- Modify: `apps/shopkeeper/app/reports/loyalty-summary.tsx`
+- Modify: `apps/shopkeeper/app/reports/stock-aging.tsx`
+
+For each screen, add an import and place `<ExportButtons>` near the top of the rendered output (under the section header / date picker, before the data card).
+
+- [ ] **Step 1: Update `daily-summary.tsx`**
+
+Add import:
+```typescript
+import { ExportButtons } from '../../src/features/reports/components/ExportButtons';
+```
+
+Inside the `<ScrollView>`, after the date picker `</View>` and before `{isLoading && ...}`, add:
+```typescript
+<ExportButtons
+  reportType="daily-summary"
+  csvParams={{ date }}
+  pdfParams={{ date }}
+/>
+```
+
+- [ ] **Step 2: Update `outstanding.tsx`**
+
+Add the same import. Inside the main render, near the top (under any header content if present, before the list/loader):
+```typescript
+<ExportButtons reportType="outstanding" />
+```
+
+- [ ] **Step 3: Update `customer-ltv.tsx`**
+
+Add the import. Insert (adapt `limit` to the existing screen's local state, default 20):
+```typescript
+<ExportButtons
+  reportType="customer-ltv"
+  csvParams={{ limit }}
+  pdfParams={{ limit }}
+/>
+```
+
+- [ ] **Step 4: Update `loyalty-summary.tsx`**
+
+Add the import:
+```typescript
+<ExportButtons reportType="loyalty-summary" />
+```
+
+- [ ] **Step 5: Update `stock-aging.tsx`**
+
+Add the import. Insert above `<BucketCard>` row:
+```typescript
+<ExportButtons reportType="stock-aging" />
+```
+
+- [ ] **Step 6: Verify typecheck**
+
+```bash
+pnpm --filter @goldsmith/shopkeeper typecheck
+```
+
+Expected: PASS.
+
+- [ ] **Step 7: Commit**
+
+```bash
+git add apps/shopkeeper/app/reports/daily-summary.tsx apps/shopkeeper/app/reports/outstanding.tsx apps/shopkeeper/app/reports/customer-ltv.tsx apps/shopkeeper/app/reports/loyalty-summary.tsx apps/shopkeeper/app/reports/stock-aging.tsx
+git commit -m "feat(ws-3a): wire ExportButtons into 5 report screens"
+```
+
+---
+
+# Final verification (before push)
+
+After all 26 tasks complete:
+
+- [ ] **Run full API test suite**
+
+```bash
+pnpm --filter @goldsmith/api test
+pnpm --filter @goldsmith/api test:integration
+pnpm --filter @goldsmith/api test:e2e
+```
+
+Expected: all green.
+
+- [ ] **Run tenant-isolation walker**
+
+```bash
+pnpm test:tenant-isolation
+```
+
+Expected: `reports_pdf_exports` enumerated; cross-tenant denial confirmed.
+
+- [ ] **Run Semgrep**
+
+```bash
+pnpm semgrep
+```
+
+Expected: no new findings (the stock-aging SQL was deliberately written without `WHERE shop_id = $1` to satisfy `goldsmith.require-tenant-transaction`; CSV emitters use the existing escape pattern).
+
+- [ ] **Runtime smoke test**
+
+1. Start API: `C:\gs-api-start.cmd`
+2. Start Metro from `C:\gs\apps\shopkeeper`: `npx expo start --dev-client --clear --port 8081`
+3. ADB tunnel: `adb -s 192.168.1.80:5555 reverse tcp:8081 tcp:8081`
+4. On device:
+   - Reports tab → Stock Aging → screen loads, buckets render, no crash
+   - Reports tab → Daily Summary → CSV button downloads in browser → PDF button shows "तैयार हो रहा..." → PDF opens after ~5s
+   - Reports tab → Outstanding → CSV + PDF cycle works
+   - Reports tab → Customer LTV → CSV + PDF cycle works
+   - Reports tab → Loyalty Summary → CSV + PDF cycle works
+   - PDF text reads correctly in Devanagari (शीर्ष ग्राहक, etc.) — not boxes/glyph fallback
+
+- [ ] **Class B review gate (Codex limit substitute)**
+
+```bash
+/code-review
+/security-review
+```
+
+Expected: both write `.claude-review-passed` and `.security-review-passed` markers, no P0/P1 findings.
+
+- [ ] **Push**
+
+```bash
+git push -u origin feat/ws-3a-reports-completion
+```
+
+---
+
+## Out-of-scope reminder
+
+Per spec §15 — these are NOT in this story and should be opened as separate follow-ups:
+
+- GSTR PDF export
+- Customer-web report exports
+- Scheduled/recurring reports
+- Email/WhatsApp delivery of finished PDFs
+- Per-tenant logo upload UI
+- `products.cost_paise` backfill for legacy rows
+- Blob GC cron / Azure Blob lifecycle policy for `tenants/<shop>/reports/**`
+- Row-level GC of `reports_pdf_exports` past 90 days
diff --git a/docs/superpowers/plans/2026-05-06-story-a1a3-storefront-schema.md b/docs/superpowers/plans/2026-05-06-story-a1a3-storefront-schema.md
new file mode 100644
index 0000000..fbce4d7
--- /dev/null
+++ b/docs/superpowers/plans/2026-05-06-story-a1a3-storefront-schema.md
@@ -0,0 +1,1189 @@
+# A1+A3 Products Storefront Schema — Implementation Plan
+
+> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
+
+**Goal:** Add 9 storefront columns to `products` (migration 0066) and a composite-FK-guarded `primary_image_id` column with a SECURITY INVOKER auto-maintain trigger (migration 0068), proven by all 6 mandatory spec tests.
+
+**Architecture:** Two independent SQL migrations applied in strict numeric sequence. All behaviour proven by Testcontainer integration tests following the exact pattern of `product-images-tenant-fk.integration.test.ts`. Drizzle schema updated to match DDL. No API or UI changes in this story — pure data layer.
+
+**Tech Stack:** PostgreSQL 15, Drizzle ORM 0.30 (`smallint`, `bigint`, `text().array()`), Vitest 1.x, `@testcontainers/postgresql`, `@goldsmith/db` (`runMigrations`, `createPool`, `withTenantTx`), `@goldsmith/tenant-context`.
+
+---
+
+## File Map
+
+| Action | Path | Purpose |
+|---|---|---|
+| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
+| Create | `packages/db/src/migrations/0068_products_primary_image.sql` | WS-B: composite FK + backfill + SECURITY INVOKER trigger |
+| Create | `apps/api/test/storefront-schema-0066.integration.spec.ts` | WS-E: T3-T6 + weight invariant tests |
+| Create | `apps/api/test/storefront-schema-0068.integration.spec.ts` | WS-C+D: T1 (FK cross-tenant) + T2 (trigger RLS) |
+| Modify | `packages/db/src/schema/products.ts` | WS-F: Drizzle column additions + `CATALOG_STYLES` export |
+
+**Migration constraint:** `0067` is reserved for the collections worktree (`C:\gs-stf-2`). Never create that file on this branch.
+
+---
+
+## Task 1 — [WS-E Red] Write failing 0066 behaviour tests
+
+**Files:**
+- Create: `apps/api/test/storefront-schema-0066.integration.spec.ts`
+
+**Context:** `runMigrations` applies every `.sql` file in `packages/db/src/migrations/` in alphabetical order. Until `0066_*.sql` exists, `products` has no `style`, `occasion`, `gift_persona`, etc. columns. Every test in this file will fail with `column "style" does not exist` (Postgres error 42703) — that IS the Red failure.
+
+- [ ] **Step 1: Create the test file**
+
+```typescript
+// apps/api/test/storefront-schema-0066.integration.spec.ts
+//
+// Mandatory spec tests T3–T6 + weight-column invariant.
+// UUID prefix cc4xxxxx — non-overlapping with other test files.
+
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
+import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
+
+// ---------------------------------------------------------------------------
+// Fixture UUIDs — non-overlapping with other integration test files
+// ---------------------------------------------------------------------------
+const SHOP_A = 'cc400001-cc00-4000-cc00-000000000001';
+
+const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0066-a', display_name: '0066 Shop A', status: 'ACTIVE' };
+const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+let userAId: string;
+let productAId: string;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
+
+  // Seed shop via raw connection (no RLS on shops table from admin path)
+  const c = await pool.connect();
+  try {
+    await c.query(
+      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'stf-0066-a', '0066 Shop A', 'ACTIVE')`,
+      [SHOP_A],
+    );
+  } finally {
+    c.release();
+  }
+
+  // Seed shop_admin user
+  userAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+           VALUES ($1, '+919400000101', 'Owner 0066', 'shop_admin', 'ACTIVE') RETURNING id`,
+        [SHOP_A],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+  // Seed a published product for index smoke tests (partial indexes filter published_at IS NOT NULL)
+  productAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO products
+           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
+            status, created_by_user_id, published_at, published_by_user_id)
+         VALUES
+           ($1, 'STF0066-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000',
+            'IN_STOCK', $2, NOW(), $2)
+         RETURNING id`,
+        [SHOP_A, userAId],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+}, 180_000);
+
+afterAll(async () => {
+  await pool?.end();
+  await container?.stop();
+});
+
+// ---------------------------------------------------------------------------
+// T3 — CHECK constraint blocks invalid style
+// ---------------------------------------------------------------------------
+describe('migration 0066: style CHECK constraint', () => {
+  it('rejects style = UNKNOWN with CHECK violation (23514)', async () => {
+    await expect(
+      tenantContext.runWith(ctxA, () =>
+        withTenantTx(pool, (tx) =>
+          tx.query(`UPDATE products SET style = 'UNKNOWN' WHERE id = $1`, [productAId]),
+        ),
+      ),
+    ).rejects.toMatchObject({ code: '23514' });
+  });
+
+  it('accepts every valid style value without error', async () => {
+    const validStyles = [
+      'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
+      'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS',
+    ];
+    for (const style of validStyles) {
+      await expect(
+        tenantContext.runWith(ctxA, () =>
+          withTenantTx(pool, (tx) =>
+            tx.query(`UPDATE products SET style = $1 WHERE id = $2`, [style, productAId]),
+          ),
+        ),
+      ).resolves.not.toThrow();
+    }
+  });
+
+  it('accepts NULL style (column is nullable)', async () => {
+    await expect(
+      tenantContext.runWith(ctxA, () =>
+        withTenantTx(pool, (tx) =>
+          tx.query(`UPDATE products SET style = NULL WHERE id = $1`, [productAId]),
+        ),
+      ),
+    ).resolves.not.toThrow();
+  });
+});
+
+// ---------------------------------------------------------------------------
+// Weight column invariant — must remain DECIMAL(12,4) after migration
+// ---------------------------------------------------------------------------
+describe('migration 0066: weight column types unchanged', () => {
+  it('gross_weight_g and net_weight_g remain numeric(12,4)', async () => {
+    const r = await pool.query<{
+      column_name: string;
+      data_type: string;
+      numeric_precision: number;
+      numeric_scale: number;
+    }>(
+      `SELECT column_name, data_type, numeric_precision, numeric_scale
+         FROM information_schema.columns
+        WHERE table_name = 'products'
+          AND column_name IN ('gross_weight_g', 'net_weight_g')
+        ORDER BY column_name`,
+    );
+    expect(r.rows).toHaveLength(2);
+    for (const row of r.rows) {
+      expect(row.data_type).toBe('numeric');
+      expect(row.numeric_precision).toBe(12);
+      expect(row.numeric_scale).toBe(4);
+    }
+  });
+});
+
+// ---------------------------------------------------------------------------
+// T4 — GIN occasion index used by ANY(...)
+// ---------------------------------------------------------------------------
+describe('migration 0066: GIN occasion index', () => {
+  it('planner uses products_occasion_gin_idx for ANY(occasion) filter', async () => {
+    const client = await pool.connect();
+    try {
+      await client.query('SET enable_seqscan = off');
+      const r = await client.query<{ 'QUERY PLAN': string }>(
+        `EXPLAIN SELECT id FROM products WHERE 'WEDDING' = ANY(occasion)`,
+      );
+      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
+      expect(plan).toContain('products_occasion_gin_idx');
+    } finally {
+      await client.query('RESET enable_seqscan');
+      client.release();
+    }
+  });
+});
+
+// ---------------------------------------------------------------------------
+// T5 — composite top-sellers index used by ORDER BY expression
+// ---------------------------------------------------------------------------
+describe('migration 0066: top-sellers expression index', () => {
+  it('planner uses products_top_sellers_idx for (sales*2+views) DESC ORDER BY', async () => {
+    const client = await pool.connect();
+    try {
+      await client.query('SET enable_seqscan = off');
+      const r = await client.query<{ 'QUERY PLAN': string }>(
+        `EXPLAIN SELECT id FROM products
+          WHERE shop_id = $1 AND published_at IS NOT NULL
+          ORDER BY (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC`,
+        [SHOP_A],
+      );
+      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
+      expect(plan).toContain('products_top_sellers_idx');
+    } finally {
+      await client.query('RESET enable_seqscan');
+      client.release();
+    }
+  });
+});
+
+// ---------------------------------------------------------------------------
+// T6 — pg_trgm GIN index used by similarity search
+// ---------------------------------------------------------------------------
+describe('migration 0066: pg_trgm similarity index', () => {
+  it('planner uses products_search_trgm_idx for expression % similarity query', async () => {
+    const client = await pool.connect();
+    try {
+      await client.query('SET enable_seqscan = off');
+      // The index expression is: coalesce(sku,'') || ' ' || coalesce(metal,'') || ' ' || coalesce(purity,'')
+      // Query must match the exact expression to use the index.
+      const r = await client.query<{ 'QUERY PLAN': string }>(
+        `EXPLAIN SELECT id FROM products
+          WHERE (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, '')) % 'AB-1042'
+            AND published_at IS NOT NULL`,
+      );
+      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
+      expect(plan).toContain('products_search_trgm_idx');
+    } finally {
+      await client.query('RESET enable_seqscan');
+      client.release();
+    }
+  });
+});
+```
+
+- [ ] **Step 2: Run the tests to confirm Red failure**
+
+```bash
+cd apps/api && pnpm vitest run test/storefront-schema-0066.integration.spec.ts
+```
+
+Expected: **ALL tests fail**. The failure message for T3 will be `column "style" does not exist` (Postgres 42703), not the CHECK violation. That is correct Red behaviour — the column doesn't exist yet.
+
+Do NOT proceed to Task 2 unless you see test failures. If tests somehow pass, something is wrong — stop and investigate.
+
+---
+
+## Task 2 — [WS-A] Write migration 0066
+
+**Files:**
+- Create: `packages/db/src/migrations/0066_products_storefront_columns.sql`
+
+**Critical constraints:**
+- Do NOT touch `gross_weight_g` or `net_weight_g` column definitions.
+- Do NOT create any file named `0067_*` on this branch — that number is reserved for `gs-stf-2`.
+- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
+- Wrap in `BEGIN; ... COMMIT;` (DDL-only, no DML per `docs/db-workflow.md`).
+
+- [ ] **Step 1: Create the migration file**
+
+```sql
+-- packages/db/src/migrations/0066_products_storefront_columns.sql
+-- Story A1 — Storefront-specific columns on products for customer catalog.
+-- No backfill: all new columns have safe NULL / empty-array / 0 defaults.
+-- Rollback: see rollback DDL at bottom (comment block).
+
+BEGIN;
+
+-- pg_trgm required before trigram GIN index. Idempotent.
+CREATE EXTENSION IF NOT EXISTS pg_trgm;
+
+ALTER TABLE products
+  ADD COLUMN style                   TEXT
+    CONSTRAINT products_style_check CHECK (style IN (
+      'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
+      'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS'
+    )),
+  ADD COLUMN occasion                TEXT[]   NOT NULL DEFAULT '{}',
+  ADD COLUMN gift_persona            TEXT[]   NOT NULL DEFAULT '{}',
+  ADD COLUMN featured_score          SMALLINT NOT NULL DEFAULT 0
+    CONSTRAINT products_featured_score_check CHECK (featured_score BETWEEN 0 AND 100),
+  ADD COLUMN sales_count_30d         INTEGER  NOT NULL DEFAULT 0,
+  ADD COLUMN view_count_30d          INTEGER  NOT NULL DEFAULT 0,
+  ADD COLUMN price_snapshot_paise    BIGINT,
+  ADD COLUMN price_snapshot_at       TIMESTAMPTZ,
+  ADD COLUMN published_search_idx_at TIMESTAMPTZ;
+
+-- Style: partial BTree — used by /products?style=JHUMKA filter.
+CREATE INDEX products_style_idx
+  ON products (shop_id, style)
+  WHERE published_at IS NOT NULL;
+
+-- Occasion + gift_persona: GIN — used by ANY(occasion) / ANY(gift_persona) filters.
+CREATE INDEX products_occasion_gin_idx
+  ON products USING GIN (occasion);
+
+CREATE INDEX products_gift_persona_gin_idx
+  ON products USING GIN (gift_persona);
+
+-- Featured: partial BTree — used by /catalog/products/featured endpoint.
+CREATE INDEX products_featured_idx
+  ON products (shop_id, featured_score DESC)
+  WHERE published_at IS NOT NULL AND featured_score > 0;
+
+-- Price snapshot: partial BTree — used by priceMin/priceMax filter.
+CREATE INDEX products_price_snapshot_idx
+  ON products (shop_id, price_snapshot_paise)
+  WHERE price_snapshot_paise IS NOT NULL AND published_at IS NOT NULL;
+
+-- Top-sellers: expression BTree — ORDER BY (sales_count_30d * 2 + view_count_30d) DESC.
+CREATE INDEX products_top_sellers_idx
+  ON products (shop_id, (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC)
+  WHERE published_at IS NOT NULL;
+
+-- Trigram search: GIN gin_trgm_ops — WHERE (...concatenation...) % 'query'.
+CREATE INDEX products_search_trgm_idx
+  ON products USING GIN (
+    (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, ''))
+    gin_trgm_ops
+  )
+  WHERE published_at IS NOT NULL;
+
+COMMIT;
+
+-- ---------------------------------------------------------------------------
+-- Rollback DDL (run on a scratch DB to validate before claiming Task 3 done)
+-- ---------------------------------------------------------------------------
+-- DROP INDEX IF EXISTS products_style_idx;
+-- DROP INDEX IF EXISTS products_occasion_gin_idx;
+-- DROP INDEX IF EXISTS products_gift_persona_gin_idx;
+-- DROP INDEX IF EXISTS products_featured_idx;
+-- DROP INDEX IF EXISTS products_price_snapshot_idx;
+-- DROP INDEX IF EXISTS products_top_sellers_idx;
+-- DROP INDEX IF EXISTS products_search_trgm_idx;
+-- ALTER TABLE products
+--   DROP COLUMN IF EXISTS style,
+--   DROP COLUMN IF EXISTS occasion,
+--   DROP COLUMN IF EXISTS gift_persona,
+--   DROP COLUMN IF EXISTS featured_score,
+--   DROP COLUMN IF EXISTS sales_count_30d,
+--   DROP COLUMN IF EXISTS view_count_30d,
+--   DROP COLUMN IF EXISTS price_snapshot_paise,
+--   DROP COLUMN IF EXISTS price_snapshot_at,
+--   DROP COLUMN IF EXISTS published_search_idx_at;
+-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
+```
+
+- [ ] **Step 2: Verify rollback DDL is valid on a scratch DB**
+
+```bash
+# Option A: apply full migrations to a local dev Postgres, then run rollback
+psql $DATABASE_URL -f packages/db/src/migrations/0066_products_storefront_columns.sql
+# Extract and run only the rollback block (lines 43–56 of the file):
+psql $DATABASE_URL <<'SQL'
+DROP INDEX IF EXISTS products_style_idx;
+DROP INDEX IF EXISTS products_occasion_gin_idx;
+DROP INDEX IF EXISTS products_gift_persona_gin_idx;
+DROP INDEX IF EXISTS products_featured_idx;
+DROP INDEX IF EXISTS products_price_snapshot_idx;
+DROP INDEX IF EXISTS products_top_sellers_idx;
+DROP INDEX IF EXISTS products_search_trgm_idx;
+ALTER TABLE products
+  DROP COLUMN IF EXISTS style,
+  DROP COLUMN IF EXISTS occasion,
+  DROP COLUMN IF EXISTS gift_persona,
+  DROP COLUMN IF EXISTS featured_score,
+  DROP COLUMN IF EXISTS sales_count_30d,
+  DROP COLUMN IF EXISTS view_count_30d,
+  DROP COLUMN IF EXISTS price_snapshot_paise,
+  DROP COLUMN IF EXISTS price_snapshot_at,
+  DROP COLUMN IF EXISTS published_search_idx_at;
+SQL
+```
+
+Expected: no errors. If local Postgres is unavailable, skip this step and note it in the commit message — the integration tests exercise the migration forward path, which is the higher-risk direction.
+
+---
+
+## Task 3 — [WS-E Green] Run 0066 tests + commit
+
+**Files:**
+- No new files — migration now present; test expectations should be met.
+
+- [ ] **Step 1: Run the 0066 test suite**
+
+```bash
+cd apps/api && pnpm vitest run test/storefront-schema-0066.integration.spec.ts
+```
+
+Expected output (all 9 tests pass):
+```
+✓ migration 0066: style CHECK constraint > rejects style = UNKNOWN with CHECK violation (23514)
+✓ migration 0066: style CHECK constraint > accepts every valid style value without error
+✓ migration 0066: style CHECK constraint > accepts NULL style (column is nullable)
+✓ migration 0066: weight column types unchanged > gross_weight_g and net_weight_g remain numeric(12,4)
+✓ migration 0066: GIN occasion index > planner uses products_occasion_gin_idx for ANY(occasion) filter
+✓ migration 0066: top-sellers expression index > planner uses products_top_sellers_idx for (sales*2+views) DESC ORDER BY
+✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
+Test Files  1 passed (1)
+Tests       7 passed (7)
+```
+
+If any test fails, diagnose and fix the migration SQL before committing. Common causes:
+- Expression index text must exactly match the query expression (including `coalesce` case and spacing)
+- `enable_seqscan = off` must be set on the SAME connection as the EXPLAIN query
+- Partial index predicates must match the WHERE clause in the query
+
+- [ ] **Step 2: Commit**
+
+```bash
+git add \
+  packages/db/src/migrations/0066_products_storefront_columns.sql \
+  apps/api/test/storefront-schema-0066.integration.spec.ts
+git commit -m "$(cat <<'EOF'
+feat(db): add products storefront columns + indexes (migration 0066, story A1)
+
+Nine new columns: style (CHECK constraint), occasion[], gift_persona[],
+featured_score, sales_count_30d, view_count_30d, price_snapshot_paise,
+price_snapshot_at, published_search_idx_at. Seven indexes including two GIN
+arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
+tests (T3-T6 + weight invariant) passing.
+
+Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
+EOF
+)"
+```
+
+---
+
+## Task 4 — [WS-C+D Red] Write failing 0068 trigger + cross-tenant FK tests
+
+**Files:**
+- Create: `apps/api/test/storefront-schema-0068.integration.spec.ts`
+
+**Context:** Until `0068_*.sql` exists, `products` has no `primary_image_id` column. Tests will fail with `column "primary_image_id" does not exist`. That is the Red failure.
+
+- [ ] **Step 1: Create the test file**
+
+```typescript
+// apps/api/test/storefront-schema-0068.integration.spec.ts
+//
+// Mandatory spec tests T1 (FK cross-tenant) and T2 (trigger SECURITY INVOKER).
+// UUID prefix dd5xxxxx / ee5xxxxx — non-overlapping with other test files.
+
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
+import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
+
+// ---------------------------------------------------------------------------
+// Fixture UUIDs — non-overlapping with other integration test files
+// ---------------------------------------------------------------------------
+const SHOP_A = 'dd500001-dd00-4000-dd00-000000000001';
+const SHOP_B = 'ee500002-ee00-4000-ee00-000000000002';
+
+const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0068-a', display_name: '0068 Shop A', status: 'ACTIVE' };
+const tenantB: Tenant = { id: SHOP_B, slug: 'stf-0068-b', display_name: '0068 Shop B', status: 'ACTIVE' };
+const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
+const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+let userAId: string;
+let userBId: string;
+let productAId: string;
+let productBId: string;
+
+// Inserts a product_images row in the given tenant context.
+const insertImage = (
+  shopId: string,
+  ctx: UnauthenticatedTenantContext,
+  productId: string,
+  uploaderId: string,
+  opts: { sortOrder?: number; scanStatus?: string } = {},
+) =>
+  tenantContext.runWith(ctx, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO product_images
+           (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
+            exif_stripped_at, uploaded_by_user_id, scan_status, sort_order)
+         VALUES
+           ($1, $2, $3, 'image/jpeg', 1234, 800, 600,
+            NOW(), $4, $5, $6)
+         RETURNING id`,
+        [
+          shopId,
+          productId,
+          `tenant/${shopId}/products/${productId}/${Math.random().toString(36).slice(2)}.jpg`,
+          uploaderId,
+          opts.scanStatus ?? 'clean',
+          opts.sortOrder ?? 0,
+        ],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
+
+  // Seed shops via raw connection
+  const c = await pool.connect();
+  try {
+    await c.query(
+      `INSERT INTO shops (id, slug, display_name, status) VALUES
+        ($1, 'stf-0068-a', '0068 Shop A', 'ACTIVE'),
+        ($2, 'stf-0068-b', '0068 Shop B', 'ACTIVE')`,
+      [SHOP_A, SHOP_B],
+    );
+  } finally {
+    c.release();
+  }
+
+  // Seed users
+  userAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+           VALUES ($1, '+919500000101', 'Owner 0068A', 'shop_admin', 'ACTIVE') RETURNING id`,
+        [SHOP_A],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+  userBId = await tenantContext.runWith(ctxB, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO shop_useexec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content package.json; Write-Host '---api package'; Get-Content apps/api/package.json; Write-Host '---db package'; Get-Content packages/db/package.json" in C:\gs-stf-1
 succeeded in 1452ms:
{
  "name": "goldsmith",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11.0 <21" },
  "scripts": {
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "test:tenant-isolation": "turbo run test:tenant-isolation",
    "build": "turbo run build",
    "db:reset": "bash scripts/db-reset.sh",
    "db:generate-rls": "tsx packages/db/src/codegen/generate-rls.ts",
    "db:assert-marked": "tsx packages/db/src/codegen/assert-all-tables-marked.ts",
    "semgrep": "semgrep --config ops/semgrep/ --error",
    "seed:anchor": "tsx scripts/seed-anchor.ts",
    "docs:context": "tsx scripts/docs/scan-repo-context.ts && tsx scripts/docs/extract-adrs.ts && tsx scripts/docs/extract-bmad-trace.ts && tsx scripts/docs/scan-docs.ts && tsx scripts/docs/extract-acceptance.ts",
    "docs:validate": "tsx scripts/docs/validate-agent-context.ts",
    "test:ci": "pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration && pnpm test:tenant-isolation && pnpm semgrep && pnpm docs:validate"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "dotenv": "^16.4.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-import-resolver-typescript": "^3.6.1",
    "eslint-plugin-import": "^2.29.1",
    "prettier": "^3.2.5",
    "tsx": "^4.7.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0",
    "@vitest/coverage-v8": "^1.4.0",
    "yaml": "^2.4.0",
    "fast-glob": "^3.3.2"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "protobufjs",
      "unrs-resolver",
      "@nestjs/core"
    ]
  }
}
---api package
{
  "name": "@goldsmith/api",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/main.js",
  "exports": {
    ".": "./src/app.module.ts",
    "./src/*": "./src/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:integration": "vitest run --dir test",
    "test:e2e": "vitest run test/endpoint-walker.e2e.test.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@azure/storage-blob": "^12.17.0",
    "@goldsmith/audit": "workspace:*",
    "@goldsmith/cache": "workspace:*",
    "@goldsmith/compliance": "workspace:*",
    "@goldsmith/crypto-envelope": "workspace:*",
    "@goldsmith/db": "workspace:*",
    "@goldsmith/integrations-payments": "workspace:*",
    "@goldsmith/integrations-search": "workspace:*",
    "@goldsmith/integrations-storage": "workspace:*",
    "@goldsmith/money": "workspace:*",
    "@goldsmith/observability": "workspace:*",
    "@goldsmith/queue": "workspace:*",
    "@goldsmith/rates": "workspace:*",
    "@goldsmith/secrets": "workspace:*",
    "@goldsmith/shared": "workspace:*",
    "@goldsmith/sync": "workspace:*",
    "@goldsmith/tenant-config": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*",
    "@nestjs/bullmq": "^10.2.0",
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/event-emitter": "^2.1.1",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/throttler": "^5",
    "bullmq": "^5.7.0",
    "csv-parse": "^5.5.0",
    "decimal.js": "^10.4.3",
    "exifr": "^7.1.3",
    "file-type": "^22.0.1",
    "firebase-admin": "^12.0.0",
    "jsonwebtoken": "^9.0.2",
    "nanoid": "^5.0.0",
    "passport": "^0.7.0",
    "passport-http-bearer": "^1.0.1",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "sharp": "^0.34.5"
  },
  "devDependencies": {
    "@goldsmith/testing-tenant-isolation": "workspace:*",
    "@nestjs/testing": "^10.3.0",
    "@testcontainers/postgresql": "^10.8.0",
    "@types/express": "^4.17.0",
    "@types/ioredis-mock": "^8.2.7",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/passport-http-bearer": "^1.0.41",
    "@types/pg": "^8.11.0",
    "@types/supertest": "^6.0.0",
    "ioredis": "^5.3.0",
    "ioredis-mock": "^8.9.0",
    "pg": "^8.11.0",
    "supertest": "^7.0.0",
    "testcontainers": "^10.8.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0",
    "zod": "^3.23.0"
  }
}
---db package
{
  "name": "@goldsmith/db",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "test:unit": "vitest run --dir src",
    "test:integration": "vitest run --dir test",
    "db:assert-marked": "tsx src/codegen/assert-all-tables-marked.ts"
  },
  "dependencies": {
    "@goldsmith/observability": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*",
    "drizzle-orm": "^0.30.0",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@testcontainers/postgresql": "^10.8.0",
    "testcontainers": "^10.8.0",
    "drizzle-kit": "^0.21.0",
    "vitest": "^1.4.0",
    "typescript": "^5.4.0",
    "tsx": "^4.7.0"
  }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm --filter @goldsmith/db typecheck' in C:\gs-stf-1
 succeeded in 10183ms:
.                                        |  WARN  Unsupported engine: wanted: {"node":">=20.11.0 <21"} (current: {"node":"v24.13.1","pnpm":"9.12.0"})

> @goldsmith/db@0.0.0 typecheck C:\gs-stf-1\packages\db
> tsc --noEmit


exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm --filter @goldsmith/api typecheck' in C:\gs-stf-1
 succeeded in 17200ms:
.                                        |  WARN  Unsupported engine: wanted: {"node":">=20.11.0 <21"} (current: {"node":"v24.13.1","pnpm":"9.12.0"})

> @goldsmith/api@0.0.0 typecheck C:\gs-stf-1\apps\api
> tsc --noEmit


exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'docker ps --format "{{.ID}}"' in C:\gs-stf-1
2026-05-06T18:41:40.737406Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 3.1 seconds
Output:
WARNING: Error loading config file: open C:\Users\alokt\.docker\config.json: Access is denied.
permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine

 exited 1 in 3131ms:
WARNING: Error loading config file: open C:\Users\alokt\.docker\config.json: Access is denied.
permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/gs-stf-1 show 0343b8c2e15bec18661c83a935a3ea00d63a0ae0:packages/db/src/schema/products.ts' in C:\gs-stf-1
 succeeded in 1302ms:
import { uuid, text, timestamp, decimal, integer, pgEnum } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { productCategories } from './product-categories';

export const huidExemptionCategoryEnum = pgEnum('huid_exemption_category', [
  'none',
  'kundan_polki_jadau',
  'under_2g',
]);

export const products = tenantScopedTable('products', {
  id:                         uuid('id').primaryKey().defaultRandom(),
  category_id:                uuid('category_id').references(() => productCategories.id),
  sku:                        text('sku').notNull(),
  metal:                      text('metal').notNull(),
  purity:                     text('purity').notNull(),
  gross_weight_g:             decimal('gross_weight_g', { precision: 12, scale: 4 }).notNull(),
  net_weight_g:               decimal('net_weight_g',   { precision: 12, scale: 4 }).notNull(),
  stone_weight_g:             decimal('stone_weight_g', { precision: 12, scale: 4 }).default('0.0000').notNull(),
  stone_details:              text('stone_details'),
  making_charge_override_pct: decimal('making_charge_override_pct', { precision: 5, scale: 2 }),
  huid:                       text('huid'),
  huid_exemption_category:    huidExemptionCategoryEnum('huid_exemption_category').notNull().default('none'),
  status:                     text('status').notNull().default('IN_STOCK'),
  quantity:                   integer('quantity').notNull().default(1),
  published_at:               timestamp('published_at', { withTimezone: true }),
  published_by_user_id:       uuid('published_by_user_id'),
  created_by_user_id:         uuid('created_by_user_id').notNull(),
  created_at:                 timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Select-String -Path packages/db/src/migrations/*.sql -Pattern "ALTER TABLE products|CREATE INDEX products|products" | Select-Object Filename,LineNumber,Line | Format-Table -AutoSize' in C:\gs-stf-1
 succeeded in 1709ms:

Filename                             LineNumber Line                                                                   
--------                             ---------- ----                                                                   
0014_inventory_base.sql                       2 -- Adds product_categories, products, product_images with RLS policies.
0014_inventory_base.sql                      22 -- products (tenant-scoped)                                            
0014_inventory_base.sql                      23 CREATE TABLE products (                                                
0014_inventory_base.sql                      42   CONSTRAINT products_status_check        CHECK (status IN ('IN_STOC...
0014_inventory_base.sql                      43   CONSTRAINT products_metal_check         CHECK (metal  IN ('GOLD','...
0014_inventory_base.sql                      44   CONSTRAINT products_gross_weight_pos    CHECK (gross_weight_g > 0),  
0014_inventory_base.sql                      45   CONSTRAINT products_net_weight_valid    CHECK (net_weight_g > 0 AN...
0014_inventory_base.sql                      46   CONSTRAINT products_huid_format         CHECK (huid IS NULL OR hui...
0014_inventory_base.sql                      48 CREATE INDEX products_shop_id_idx        ON products (shop_id);        
0014_inventory_base.sql                      49 CREATE INDEX products_shop_id_status_idx ON products (shop_id, status);
0014_inventory_base.sql                      50 CREATE UNIQUE INDEX products_shop_id_sku_unique ON products (shop_id...
0014_inventory_base.sql                      52 ALTER TABLE products ENABLE ROW LEVEL SECURITY;                        
0014_inventory_base.sql                      53 ALTER TABLE products FORCE ROW LEVEL SECURITY;                         
0014_inventory_base.sql                      54 DROP POLICY IF EXISTS rls_products_tenant_isolation ON products;       
0014_inventory_base.sql                      55 CREATE POLICY rls_products_tenant_isolation ON products                
0014_inventory_base.sql                      64   product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, 
0014_inventory_base.sql                      84 GRANT SELECT, INSERT, UPDATE ON products           TO app_user;        
0016_products_bulk_idx.sql                    1 -- 0016_products_bulk_idx.sql                                          
0016_products_bulk_idx.sql                    3 CREATE INDEX IF NOT EXISTS idx_products_shop_created                   
0016_products_bulk_idx.sql                    4   ON products(shop_id, created_at DESC);                               
0021_stock_movements.sql                      2 -- Append-only ledger of stock changes. Drives products.quantity.      
0021_stock_movements.sql                     10 -- 1. products.quantity column (drives oversell guard; backfill by s...
0021_stock_movements.sql                     12 ALTER TABLE products                                                   
0021_stock_movements.sql                     15 -- 1b. Backfill by status: SOLD products are out of stock (0); every...
0021_stock_movements.sql                     17 UPDATE products SET quantity = CASE WHEN status = 'SOLD' THEN 0 ELSE...
0021_stock_movements.sql                     21 ALTER TABLE products                                                   
0021_stock_movements.sql                     24   ADD CONSTRAINT products_quantity_nonneg CHECK (quantity >= 0);       
0021_stock_movements.sql                     30   product_id          UUID NOT NULL REFERENCES products(id),           
0022_billing.sql                             38   product_id            UUID REFERENCES products(id),         -- nul...
0022_billing.sql                             71 -- 4. RLS — same pattern as invoices/audit_events/products             
0022_billing.sql                            126 -- 8. updated_at touch trigger on invoices (mirrors products)          
0041_huid_exemption_category.sql              3 -- Default 'none' preserves backward compatibility — existing produc...
0041_huid_exemption_category.sql              7 ALTER TABLE products                                                   
0043_product_views.sql                       10   product_id       UUID        NOT NULL REFERENCES products(id),       
0047_reviews_wishlist.sql                    15   product_id    UUID        NOT NULL REFERENCES products(id),          
0047_reviews_wishlist.sql                    50   product_id  UUID        NOT NULL REFERENCES products(id),            
0057_product_images_pipeline.sql             16   product_id           UUID        NOT NULL REFERENCES products(id) ...
0058_product_images_tenant_fk.sql             5 -- Why: 0057 used plain FKs (product_id -> products(id), uploaded_by...
0058_product_images_tenant_fk.sql            15 ALTER TABLE products                                                   
0058_product_images_tenant_fk.sql            16   ADD CONSTRAINT products_shop_id_id_uniq UNIQUE (shop_id, id);        
0058_product_images_tenant_fk.sql            32   REFERENCES products(shop_id, id)                                     
0066_products_storefront_columns.sql          1 -- packages/db/src/migrations/0066_products_storefront_columns.sql     
0066_products_storefront_columns.sql          2 -- Story A1 — Storefront-specific columns on products for customer c...
0066_products_storefront_columns.sql         11 ALTER TABLE products                                                   
0066_products_storefront_columns.sql         13     CONSTRAINT products_style_check CHECK (style IN (                  
0066_products_storefront_columns.sql         20     CONSTRAINT products_featured_score_check CHECK (featured_score B...
0066_products_storefront_columns.sql         27 -- Style: partial BTree — used by /products?style=JHUMKA filter.       
0066_products_storefront_columns.sql         28 CREATE INDEX products_style_idx                                        
0066_products_storefront_columns.sql         29   ON products (shop_id, style)                                         
0066_products_storefront_columns.sql         33 CREATE INDEX products_occasion_gin_idx                                 
0066_products_storefront_columns.sql         34   ON products USING GIN (occasion);                                    
0066_products_storefront_columns.sql         36 CREATE INDEX products_gift_persona_gin_idx                             
0066_products_storefront_columns.sql         37   ON products USING GIN (gift_persona);                                
0066_products_storefront_columns.sql         39 -- Featured: partial BTree — used by /catalog/products/featured endp...
0066_products_storefront_columns.sql         40 CREATE INDEX products_featured_idx                                     
0066_products_storefront_columns.sql         41   ON products (shop_id, featured_score DESC)                           
0066_products_storefront_columns.sql         45 CREATE INDEX products_price_snapshot_idx                               
0066_products_storefront_columns.sql         46   ON products (shop_id, price_snapshot_paise)                          
0066_products_storefront_columns.sql         50 CREATE INDEX products_top_sellers_idx                                  
0066_products_storefront_columns.sql         51   ON products (shop_id, (sales_count_30d * 2 + view_count_30d) DESC,...
0066_products_storefront_columns.sql         57 CREATE INDEX products_search_trgm_idx                                  
0066_products_storefront_columns.sql         58   ON products USING GIN (                                              
0066_products_storefront_columns.sql         68 -- DROP INDEX IF EXISTS products_style_idx;                            
0066_products_storefront_columns.sql         69 -- DROP INDEX IF EXISTS products_occasion_gin_idx;                     
0066_products_storefront_columns.sql         70 -- DROP INDEX IF EXISTS products_gift_persona_gin_idx;                 
0066_products_storefront_columns.sql         71 -- DROP INDEX IF EXISTS products_featured_idx;                         
0066_products_storefront_columns.sql         72 -- DROP INDEX IF EXISTS products_price_snapshot_idx;                   
0066_products_storefront_columns.sql         73 -- DROP INDEX IF EXISTS products_top_sellers_idx;                      
0066_products_storefront_columns.sql         74 -- DROP INDEX IF EXISTS products_search_trgm_idx;                      
0066_products_storefront_columns.sql         75 -- ALTER TABLE products                                                
0068_products_primary_image.sql               1 -- packages/db/src/migrations/0068_products_primary_image.sql          
0068_products_primary_image.sql               2 -- Story A3 — products.primary_image_id with composite FK (mirrors 0...
0068_products_primary_image.sql               6 -- a Tenant-A product to reference a Tenant-B image — the RLS policy...
0068_products_primary_image.sql               9 -- at the schema layer, mirroring the 0058 pattern for product_image...
0068_products_primary_image.sql              21 ALTER TABLE products                                                   
0068_products_primary_image.sql              27 -- Instead, a BEFORE DELETE trigger (trg_clear_products_primary_imag...
0068_products_primary_image.sql              29 -- trigger (trg_maintain_products_primary_image) then recomputes fro...
0068_products_primary_image.sql              30 ALTER TABLE products                                                   
0068_products_primary_image.sql              31   ADD CONSTRAINT products_shop_primary_image_fkey                      
0068_products_primary_image.sql              35 -- Step 4: Backfill — set primary_image_id for products that already...
0068_products_primary_image.sql              36 -- Products with no clean images remain NULL (correct and safe).       
0068_products_primary_image.sql              37 UPDATE products                                                        
0068_products_primary_image.sql              41       WHERE pi.product_id = products.id                                
0068_products_primary_image.sql              49 -- SECURITY INVOKER: runs under session user privileges; RLS on prod...
0068_products_primary_image.sql              51 CREATE OR REPLACE FUNCTION clear_products_primary_image()              
0068_products_primary_image.sql              59   UPDATE products                                                      
0068_products_primary_image.sql              70 CREATE TRIGGER trg_clear_products_primary_image                        
0068_products_primary_image.sql              74 EXECUTE FUNCTION clear_products_primary_image();                       
0068_products_primary_image.sql              79 CREATE OR REPLACE FUNCTION maintain_products_primary_image()           
0068_products_primary_image.sql              90   UPDATE products                                                      
0068_products_primary_image.sql             112 CREATE TRIGGER trg_maintain_products_primary_image                     
0068_products_primary_image.sql             116 EXECUTE FUNCTION maintain_products_primary_image();                    
0068_products_primary_image.sql             123 -- DROP TRIGGER IF EXISTS trg_maintain_products_primary_image ON pro...
0068_products_primary_image.sql             124 -- DROP FUNCTION IF EXISTS maintain_products_primary_image();          
0068_products_primary_image.sql             125 -- DROP TRIGGER IF EXISTS trg_clear_products_primary_image ON produc...
0068_products_primary_image.sql             126 -- DROP FUNCTION IF EXISTS clear_products_primary_image();             
0068_products_primary_image.sql             127 -- ALTER TABLE products                                                
0068_products_primary_image.sql             128 --   DROP CONSTRAINT IF EXISTS products_shop_primary_image_fkey,       



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem apps/api/test -Filter *.integration.spec.ts | Select-Object -First 20 -ExpandProperty Name; rg "PostgreSqlContainer" apps/api/test packages/db/test -n' in C:\gs-stf-1
 succeeded in 2609ms:
auth-staff.integration.spec.ts
product-images.integration.spec.ts
storefront-schema-0066.integration.spec.ts
storefront-schema-0068.integration.spec.ts
apps/api/test\audit-log-read.integration.test.ts:11:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\audit-log-read.integration.test.ts:23:let container: StartedPostgreSqlContainer;
apps/api/test\audit-log-read.integration.test.ts:31:  container = await new PostgreSqlContainer('postgres:15.6').start();
packages/db/test\poison-default.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
packages/db/test\poison-default.integration.test.ts:6:let container: StartedPostgreSqlContainer;
packages/db/test\poison-default.integration.test.ts:10:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\auth-link-migration.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\auth-link-migration.integration.test.ts:8:  let container: StartedPostgreSqlContainer;
apps/api/test\auth-link-migration.integration.test.ts:12:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\auth-duplicate-phone.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\auth-duplicate-phone.integration.test.ts:9:  let container: StartedPostgreSqlContainer;
apps/api/test\auth-duplicate-phone.integration.test.ts:21:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\audit-immutability.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\audit-immutability.integration.test.ts:8:  let container: StartedPostgreSqlContainer;
apps/api/test\audit-immutability.integration.test.ts:13:    container = await new PostgreSqlContainer('postgres:15.6').start();
packages/db/test\with-tenant-tx.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
packages/db/test\with-tenant-tx.integration.test.ts:10:let container: StartedPostgreSqlContainer;
packages/db/test\with-tenant-tx.integration.test.ts:18:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\auth-rate-limit.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\auth-rate-limit.integration.test.ts:9:  let container: StartedPostgreSqlContainer;
apps/api/test\auth-rate-limit.integration.test.ts:15:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\auth-missing-phone.integration.test.ts:5:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\auth-missing-phone.integration.test.ts:18:  let container: StartedPostgreSqlContainer;
apps/api/test\auth-missing-phone.integration.test.ts:22:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\auth-repository.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\auth-repository.integration.test.ts:10:  let container: StartedPostgreSqlContainer;
apps/api/test\auth-repository.integration.test.ts:18:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\billing.integration.test.ts:21:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\billing.integration.test.ts:69:let container: StartedPostgreSqlContainer;
apps/api/test\billing.integration.test.ts:134:  container   = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\crm-isolation.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\crm-isolation.integration.test.ts:12:let container: StartedPostgreSqlContainer;
apps/api/test\crm-isolation.integration.test.ts:22:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\drizzle-tenant-lookup.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\drizzle-tenant-lookup.integration.test.ts:9:  let container: StartedPostgreSqlContainer;
apps/api/test\drizzle-tenant-lookup.integration.test.ts:15:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\dead-stock.integration.test.ts:16:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\dead-stock.integration.test.ts:43:  let container: StartedPostgreSqlContainer;
apps/api/test\dead-stock.integration.test.ts:53:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\estimate.integration.test.ts:18:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\estimate.integration.test.ts:53:let container: StartedPostgreSqlContainer;
apps/api/test\estimate.integration.test.ts:63:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\endpoint-walker.e2e.test.ts:3:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\endpoint-walker.e2e.test.ts:39:  let container: StartedPostgreSqlContainer;
apps/api/test\endpoint-walker.e2e.test.ts:56:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\inventory-isolation.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\inventory-isolation.integration.test.ts:11:let container: StartedPostgreSqlContainer;
apps/api/test\inventory-isolation.integration.test.ts:16:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\inventory-valuation.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\inventory-valuation.integration.test.ts:46:let container: StartedPostgreSqlContainer;
apps/api/test\inventory-valuation.integration.test.ts:53:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\product-images-tenant-fk.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\product-images-tenant-fk.integration.test.ts:15:let container: StartedPostgreSqlContainer;
apps/api/test\product-images-tenant-fk.integration.test.ts:29:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\loyalty.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\loyalty.integration.test.ts:16:let container: StartedPostgreSqlContainer;
apps/api/test\loyalty.integration.test.ts:36:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\product-images.concurrency.spec.ts:15:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\product-images.concurrency.spec.ts:59:let container: StartedPostgreSqlContainer;
apps/api/test\product-images.concurrency.spec.ts:98:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\product-images.integration.spec.ts:24:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\product-images.integration.spec.ts:72:let container: StartedPostgreSqlContainer;
apps/api/test\product-images.integration.spec.ts:88:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\product-images.tenant-isolation.spec.ts:16:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\product-images.tenant-isolation.spec.ts:62:let container: StartedPostgreSqlContainer;
apps/api/test\product-images.tenant-isolation.spec.ts:77:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\publish-product.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\publish-product.integration.test.ts:16:  let container: StartedPostgreSqlContainer;
apps/api/test\publish-product.integration.test.ts:22:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\rates-refresh.integration.test.ts:14:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\rates-refresh.integration.test.ts:55:let container: StartedPostgreSqlContainer;
apps/api/test\rates-refresh.integration.test.ts:60:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\search.integration.test.ts:14:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\search.integration.test.ts:42:  let container: StartedPostgreSqlContainer;
apps/api/test\search.integration.test.ts:47:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\rls-fail-loud.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\rls-fail-loud.integration.test.ts:8:  let container: StartedPostgreSqlContainer;
apps/api/test\rls-fail-loud.integration.test.ts:13:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\storefront-schema-0066.integration.spec.ts:7:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\storefront-schema-0066.integration.spec.ts:21:let container: StartedPostgreSqlContainer;
apps/api/test\storefront-schema-0066.integration.spec.ts:27:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\stock-movements.integration.test.ts:2:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\stock-movements.integration.test.ts:21:let container: StartedPostgreSqlContainer;
apps/api/test\stock-movements.integration.test.ts:43:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\settings\settings.integration.test.ts:11:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\settings\settings.integration.test.ts:55:let container: StartedPostgreSqlContainer;
apps/api/test\settings\settings.integration.test.ts:61:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\storefront-schema-0068.integration.spec.ts:7:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\storefront-schema-0068.integration.spec.ts:24:let container: StartedPostgreSqlContainer;
apps/api/test\storefront-schema-0068.integration.spec.ts:63:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\settings\tenant-isolation.test.ts:14:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\settings\tenant-isolation.test.ts:37:let container: StartedPostgreSqlContainer;
apps/api/test\settings\tenant-isolation.test.ts:42:  container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\_auth-test-setup.ts:4:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\_auth-test-setup.ts:12:  container: StartedPostgreSqlContainer;
apps/api/test\_auth-test-setup.ts:23:  const container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\tenant-boot.integration.test.ts:3:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\tenant-boot.integration.test.ts:12:  let container: StartedPostgreSqlContainer;
apps/api/test\tenant-boot.integration.test.ts:18:    container = await new PostgreSqlContainer('postgres:15.6').start();
apps/api/test\product-images.rls.spec.ts:13:import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
apps/api/test\product-images.rls.spec.ts:40:let container: StartedPostgreSqlContainer;
apps/api/test\product-images.rls.spec.ts:46:  container = await new PostgreSqlContainer('postgres:15.6').start();

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'if (Test-Path docs/db-workflow.md) { Get-Content docs/db-workflow.md } else { rg "DDL-only|No DML|migrations" docs packages -n | Select-Object -First 100 }' in C:\gs-stf-1
 succeeded in 1239ms:
# DB Workflow (E2-S1)

## Roles

- `app_user` - NOSUPERUSER NOBYPASSRLS; tenant DML through `withTenantTx(pool, fn)` for request-scoped code or `withShopTx(pool, shopId, fn)` for public/webhook/job code that has an explicit reviewed shop id.
- `migrator` - NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault once infrastructure lands, scoped to the GitHub OIDC role.
- `platform_admin` - owns SECURITY DEFINER cross-tenant reads; used from the platform admin console.

## DDL vs DML Flow

DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`.

Tenant DML must use one of the reviewed transaction helpers:

- `withTenantTx(pool, fn)` when a request `TenantContext` is already established.
- `withShopTx(pool, shopId, fn)` when the code path is public, webhook-driven, or job-driven and has an explicit trusted shop id.

Do not use direct `pool.query` / `pool.connect` for tenant DML. The Semgrep
ERROR gate enforces this boundary.

Platform-global DML is exceptional. Cross-tenant platform-admin code must use
`platformGlobalExecute(reason, fn)` or `platformGlobalTx(pool, reason, fn)`, with
the reason documenting why tenant scoping is intentionally not used. These
helpers are reviewed allow-list entries in the tenant-transaction Semgrep rule.

`app_user` cannot run DDL. `migrator` cannot run DML on tenant tables.

## Adding A New Table

1. Add a file under `packages/db/src/schema/` using `tenantScopedTable` or `platformGlobalTable`.
2. Run `pnpm -F @goldsmith/db run db:assert-marked`; it passes if the marker is used.
3. Run `pnpm -F @goldsmith/db exec tsx src/codegen/generate-rls.ts`; it emits RLS SQL.
4. Create a new migration `NNNN_<name>.sql` with table DDL plus the emitted RLS block.
5. Add the required `GRANT ... ON <new_table> TO app_user` in the same migration.
6. Add a harness fixture entry in `packages/testing/tenant-isolation/fixtures/*` so the 3-tenant test exercises the new table.

## Post-Migrate Data Migrations

Backfills and transforms run as per-tenant jobs using `app_user` plus
`withShopTx` or `withTenantTx`. MVP scripts can iterate tenants with `tsx`.
Do not put data backfills in `.sql` files unless the operation is truly
schema-coupled and reviewed as part of a migration.

## Running Locally

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres redis
pnpm install
pnpm db:reset
pnpm test
pnpm test:tenant-isolation
```

Redis and LocalStack containers are defined in `docker-compose.dev.yml`; start
them only when the test or feature path needs them.

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content packages/db/src/migrations/0000_roles.sql; Write-Host '---grants'; Get-Content packages/db/src/migrations/0002_grants.sql" in C:\gs-stf-1
 succeeded in 2122ms:
-- 0000_roles.sql â€” DB roles (created before tables, no grants yet)
-- Applied by the `migrator` role. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_app_user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_admin') THEN
    CREATE ROLE platform_admin NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_platform_admin';
  END IF;
END$$;

-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
-- runs migrations â€” bootstrapping it inside a migration is circular. This file documents the
-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.

-- Real passwords injected via secrets in deploy; local dev uses docker-compose defaults.
---grants
-- 0002_grants.sql â€” privilege grants. Order: roles (0000) â†’ tables (0001) â†’ grants (here).

-- app_user: DML on tenant tables, no DDL
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_users TO app_user;
GRANT SELECT                         ON shops      TO app_user;

-- audit_events: append-only for app_user (invariant 11)
GRANT INSERT, SELECT ON audit_events TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- migrator: DDL only, zero DML on tenant tables (invariant 5)
-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
-- guarded so local dev does not fail.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
    REVOKE ALL ON shops        FROM migrator;
    REVOKE ALL ON shop_users   FROM migrator;
    REVOKE ALL ON audit_events FROM migrator;
  END IF;
END$$;

-- platform_admin: broad access for SECURITY DEFINER functions (used in Story 1.5+)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_admin;

-- Default privileges so future tables automatically flow to app_user via migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/migrations/0021_stock_movements.sql' in C:\gs-stf-1
 succeeded in 2110ms:
-- 0021_stock_movements.sql
-- Append-only ledger of stock changes. Drives products.quantity.
-- DB-enforced immutability via trigger; compensating movements correct mistakes.
-- PMLA 5-year retention enforced at two layers:
--   1. Immutability trigger with SECURITY DEFINER (rejects UPDATE/DELETE for ALL roles)
--   2. app_user grant restricted to SELECT + INSERT (denies privilege at role level)

BEGIN;

-- 1. products.quantity column (drives oversell guard; backfill by status)
-- 1a. Add the column nullable so we can set it per-row before locking it down.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- 1b. Backfill by status: SOLD products are out of stock (0); everything else
--     is one unit per row (the existing one-product-per-row inventory model).
UPDATE products SET quantity = CASE WHEN status = 'SOLD' THEN 0 ELSE 1 END
  WHERE quantity IS NULL;

-- 1c. Lock the column down: NOT NULL, default 1 for new inserts, non-negative.
ALTER TABLE products
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN quantity SET DEFAULT 1,
  ADD CONSTRAINT products_quantity_nonneg CHECK (quantity >= 0);

-- 2. stock_movements append-only ledger
CREATE TABLE stock_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  type                TEXT NOT NULL CHECK (type IN (
                        'PURCHASE','SALE','ADJUSTMENT_IN','ADJUSTMENT_OUT',
                        'TRANSFER_IN','TRANSFER_OUT'
                      )),
  reason              TEXT NOT NULL CHECK (length(reason) >= 3),
  quantity_delta      INTEGER NOT NULL CHECK (quantity_delta != 0),
  balance_before      INTEGER NOT NULL CHECK (balance_before >= 0),
  balance_after       INTEGER NOT NULL CHECK (balance_after  >= 0),
  source_name         TEXT,
  source_id           UUID,
  -- recorded_by_user_id intentionally has no FK: the value must persist for 5 yr
  -- PMLA retention even if the user record is purged. Service layer validates write-time.
  recorded_by_user_id UUID NOT NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Per-row sign invariant: delta direction must match type
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_delta_sign_matches_type CHECK (
  (type IN ('PURCHASE','ADJUSTMENT_IN','TRANSFER_IN')   AND quantity_delta > 0) OR
  (type IN ('SALE','ADJUSTMENT_OUT','TRANSFER_OUT')     AND quantity_delta < 0)
);

-- 4. Per-row balance invariant: balance_after must equal balance_before + delta
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_balance_consistent CHECK (
  balance_after = balance_before + quantity_delta
);

-- 5. RLS â€” same pattern as audit_events / sync_change_log
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_stock_movements_tenant_isolation ON stock_movements;
CREATE POLICY rls_stock_movements_tenant_isolation ON stock_movements
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- 6. Immutability trigger â€” DB-level rejection of UPDATE/DELETE.
-- This is the PMLA retention floor: even a buggy migration or a developer
-- with raw psql access cannot mutate or destroy a recorded movement.
CREATE OR REPLACE FUNCTION stock_movements_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements are immutable; use a compensating movement'
    USING ERRCODE = 'restrict_violation';
END;
$$;

ALTER FUNCTION stock_movements_immutable() OWNER TO platform_admin;

DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
CREATE TRIGGER trg_stock_movements_immutable
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION stock_movements_immutable();

DROP TRIGGER IF EXISTS trg_stock_movements_no_truncate ON stock_movements;
CREATE TRIGGER trg_stock_movements_no_truncate
  BEFORE TRUNCATE ON stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION stock_movements_immutable();

-- 7. Grants â€” INSERT + SELECT only. No UPDATE / DELETE.
-- The trigger is defense-in-depth; the grant is the primary control.
REVOKE ALL ON stock_movements FROM app_user;
GRANT SELECT, INSERT ON stock_movements TO app_user;

-- 8. Indexes â€” product timeline + type aggregation
CREATE INDEX idx_stock_movements_product
  ON stock_movements(shop_id, product_id, recorded_at DESC);
CREATE INDEX idx_stock_movements_type
  ON stock_movements(shop_id, type, recorded_at DESC);
CREATE INDEX idx_stock_movements_recorded_by
  ON stock_movements(shop_id, recorded_by_user_id, recorded_at DESC);

COMMIT;

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm --filter @goldsmith/api lint' in C:\gs-stf-1
 succeeded in 27384ms:
.                                        |  WARN  Unsupported engine: wanted: {"node":">=20.11.0 <21"} (current: {"node":"v24.13.1","pnpm":"9.12.0"})

> @goldsmith/api@0.0.0 lint C:\gs-stf-1\apps\api
> eslint src test


C:\gs-stf-1\apps\api\src\modules\auth\auth.controller.ts
  21:34  warning  'C:\gs-stf-1\packages\tenant-context\dist\index.d.ts' imported multiple times  import/no-duplicates
  22:31  warning  'C:\gs-stf-1\packages\tenant-context\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\billing\story-5.6-pmla-block-ctr.spec.ts
  2:42  warning  'C:\gs-stf-1\packages\compliance\dist\index.d.ts' imported multiple times  import/no-duplicates
  3:49  warning  'C:\gs-stf-1\packages\compliance\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\crm\crm-search.service.ts
   2:29  warning  'C:\gs-stf-1\packages\integrations\search\dist\index.d.ts' imported multiple times  import/no-duplicates
  10:45  warning  'C:\gs-stf-1\packages\integrations\search\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\crm\crm.controller.ts
   1:163  warning  'C:\gs-stf-1\node_modules\.pnpm\@nestjs+common@10.4.22_reflect-metadata@0.2.2_rxjs@7.8.2\node_modules\@nestjs\common\index.d.ts' imported multiple times  import/no-duplicates
  12:24   warning  'C:\gs-stf-1\node_modules\.pnpm\@nestjs+common@10.4.22_reflect-metadata@0.2.2_rxjs@7.8.2\node_modules\@nestjs\common\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\customer\customer.controller.ts
  17:8   warning  'C:\gs-stf-1\node_modules\.pnpm\@nestjs+common@10.4.22_reflect-metadata@0.2.2_rxjs@7.8.2\node_modules\@nestjs\common\index.d.ts' imported multiple times  import/no-duplicates
  19:21  warning  'C:\gs-stf-1\node_modules\.pnpm\@nestjs+common@10.4.22_reflect-metadata@0.2.2_rxjs@7.8.2\node_modules\@nestjs\common\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\inventory\inventory.controller.ts
  17:112  warning  'C:\gs-stf-1\packages\shared\dist\index.d.ts' imported multiple times  import/no-duplicates
  18:125  warning  'C:\gs-stf-1\packages\shared\dist\index.d.ts' imported multiple times  import/no-duplicates
  29:42   warning  'C:\gs-stf-1\packages\shared\dist\index.d.ts' imported multiple times  import/no-duplicates
  30:67   warning  'C:\gs-stf-1\packages\shared\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\inventory\inventory.module.ts
  3:24  warning  'C:\gs-stf-1\packages\queue\src\index.ts' imported multiple times  import/no-duplicates
  5:49  warning  'C:\gs-stf-1\packages\queue\src\index.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\inventory\inventory.search.service.ts
  2:29  warning  'C:\gs-stf-1\packages\integrations\search\dist\index.d.ts' imported multiple times  import/no-duplicates
  4:45  warning  'C:\gs-stf-1\packages\integrations\search\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\src\modules\platform-admin\impersonation-token.spec.ts
  50:19  warning  Caution: `jwt` also has a named export `sign`. Check if you meant to write `import {sign} from 'jsonwebtoken'` instead  import/no-named-as-default-member

C:\gs-stf-1\apps\api\src\modules\platform-admin\impersonation-token.ts
  30:10  warning  Caution: `jwt` also has a named export `sign`. Check if you meant to write `import {sign} from 'jsonwebtoken'` instead      import/no-named-as-default-member
  40:15  warning  Caution: `jwt` also has a named export `verify`. Check if you meant to write `import {verify} from 'jsonwebtoken'` instead  import/no-named-as-default-member

C:\gs-stf-1\apps\api\src\modules\pricing\pricing.service.spec.ts
  10:47  warning  'C:\gs-stf-1\packages\integrations\rates\dist\index.d.ts' imported multiple times  import/no-duplicates
  13:36  warning  'C:\gs-stf-1\packages\integrations\rates\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\test\compliance-gates\b2b-gst.test.ts
  2:8  warning  Using exported name 'Decimal' as identifier for default import  import/no-named-as-default

C:\gs-stf-1\apps\api\test\inventory-valuation.integration.test.ts
   1:59  warning  'C:\gs-stf-1\node_modules\.pnpm\vitest@1.6.1_@types+node@22.19.17_jsdom@24.1.3_lightningcss@1.27.0_terser@5.46.1\node_modules\vitest\dist\index.d.ts' imported multiple times  import/no-duplicates
  16:20  warning  'C:\gs-stf-1\node_modules\.pnpm\vitest@1.6.1_@types+node@22.19.17_jsdom@24.1.3_lightningcss@1.27.0_terser@5.46.1\node_modules\vitest\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\test\product-images.concurrency.spec.ts
  26:36  warning  'C:\gs-stf-1\packages\integrations\storage\dist\index.d.ts' imported multiple times  import/no-duplicates
  27:40  warning  'C:\gs-stf-1\packages\integrations\storage\dist\index.d.ts' imported multiple times  import/no-duplicates
  28:45  warning  'C:\gs-stf-1\packages\integrations\storage\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\test\product-images.tenant-isolation.spec.ts
  27:36  warning  'C:\gs-stf-1\packages\integrations\storage\dist\index.d.ts' imported multiple times  import/no-duplicates
  28:40  warning  'C:\gs-stf-1\packages\integrations\storage\dist\index.d.ts' imported multiple times  import/no-duplicates
  29:45  warning  'C:\gs-stf-1\packages\integrations\storage\dist\index.d.ts' imported multiple times  import/no-duplicates

C:\gs-stf-1\apps\api\test\rates-chaos.test.ts
  15:50  warning  'C:\gs-stf-1\node_modules\.pnpm\vitest@1.6.1_@types+node@22.19.17_jsdom@24.1.3_lightningcss@1.27.0_terser@5.46.1\node_modules\vitest\dist\index.d.ts' imported multiple times  import/no-duplicates
  29:20  warning  'C:\gs-stf-1\node_modules\.pnpm\vitest@1.6.1_@types+node@22.19.17_jsdom@24.1.3_lightningcss@1.27.0_terser@5.46.1\node_modules\vitest\dist\index.d.ts' imported multiple times  import/no-duplicates

✖ 34 problems (0 errors, 34 warnings)
  0 errors and 14 warnings potentially fixable with the `--fix` option.


exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm --filter @goldsmith/db lint' in C:\gs-stf-1
 succeeded in 8325ms:
.                                        |  WARN  Unsupported engine: wanted: {"node":">=20.11.0 <21"} (current: {"node":"v24.13.1","pnpm":"9.12.0"})

> @goldsmith/db@0.0.0 lint C:\gs-stf-1\packages\db
> eslint src test


exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content docs/superpowers/specs/2026-05-06-story-a1a3-storefront-schema.md | Select-Object -First 220' in C:\gs-stf-1
 succeeded in 1317ms:
# Story A1+A3 â€” Products Storefront Schema

Date: 2026-05-06  
Branch: `feat/storefront-schema-a1a3`  
Class: A (RLS-touching schema migration â€” fresh session, full ceremony)  
Migrations: `0066_products_storefront_columns.sql` (A1), `0068_products_primary_image.sql` (A3)  
Reserved: `0067` belongs to `feat/storefront-collections-a2` â€” **never consume in this branch**

---

## Context

The customer storefront (Phase B onwards) needs server-side filter+sort on style, occasion, gift_persona, price, and featured score. The ProductCard needs a first-class `primary_image_id` on the product row so Phase B list queries can join a single image per product without a subquery per row. This story is the pure schema foundation â€” no API changes, no UI changes.

---

## Decisions locked

### D1 â€” `style`: CHECK constraint, not PostgreSQL enum type

PostgreSQL `ENUM` types require `ALTER TYPE ... ADD VALUE` (ShareRowExclusiveLock) to grow; CHECK constraints are altered without locks. The 12-value style list will grow (CHANDBALI, MAANG-TIKKA, etc.) as the product catalog expands â€” each addition should be a one-line migration, not a type migration.

### D2 â€” `occasion` / `gift_persona`: TEXT[] with GIN, not lookup tables

At anchor scale (â‰¤ 5k SKU/tenant), a GIN-indexed `ANY(occasion)` query is sub-millisecond and requires zero JOINs. Lookup tables would add 2 new tables + RLS policies + grants each for no measurable benefit until the 10th tenant. TEXT[] values are validated at the application layer via `CATALOG_OCCASIONS` / `CATALOG_GIFT_PERSONAS` constant arrays in `@goldsmith/customer-shared` (Phase A4).

### D3 â€” `primary_image_id` maintenance: trigger with SECURITY INVOKER

A DB trigger is the only mechanism that covers all mutation paths: `ProductImagesService.upload()`, `delete()`, `reorder()`, direct-SQL seeds, admin scripts, migrations. App-level maintenance in the service would leave `primary_image_id` stale on any path that bypasses the service. `SECURITY INVOKER` keeps RLS in force during trigger execution â€” the trigger cannot reach across tenants. `SECURITY DEFINER` is explicitly banned on this trigger (brief non-negotiable).

---

## Migration 0066 â€” Products storefront columns

### New columns

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `style` | TEXT | YES | â€” | CHECK in style enum below |
| `occasion` | TEXT[] | NO | `'{}'` | â€” |
| `gift_persona` | TEXT[] | NO | `'{}'` | â€” |
| `featured_score` | SMALLINT | NO | `0` | CHECK 0 â‰¤ x â‰¤ 100 |
| `sales_count_30d` | INT | NO | `0` | â€” |
| `view_count_30d` | INT | NO | `0` | â€” |
| `price_snapshot_paise` | BIGINT | YES | â€” | â€” |
| `price_snapshot_at` | TIMESTAMPTZ | YES | â€” | â€” |
| `published_search_idx_at` | TIMESTAMPTZ | YES | â€” | â€” |

**Style CHECK values:** `ENGAGEMENT`, `COUPLE`, `DAILY_WEAR`, `JHUMKA`, `STUDS`, `HOOPS`, `DROP`, `STATEMENT`, `TEMPLE`, `BRIDAL`, `OFFICE`, `KIDS`

### Indexes

| Index name | Type | Columns | Predicate |
|---|---|---|---|
| `products_style_idx` | BTree | `(shop_id, style)` | `WHERE published_at IS NOT NULL` |
| `products_occasion_gin_idx` | GIN | `(occasion)` | â€” |
| `products_gift_persona_gin_idx` | GIN | `(gift_persona)` | â€” |
| `products_featured_idx` | BTree | `(shop_id, featured_score DESC)` | `WHERE published_at IS NOT NULL AND featured_score > 0` |
| `products_price_snapshot_idx` | BTree | `(shop_id, price_snapshot_paise)` | `WHERE price_snapshot_paise IS NOT NULL AND published_at IS NOT NULL` |
| `products_top_sellers_idx` | BTree expression | `(shop_id, (sales_count_30d*2+view_count_30d) DESC, published_at DESC)` | `WHERE published_at IS NOT NULL` |
| `products_search_trgm_idx` | GIN `gin_trgm_ops` | `(coalesce(sku,'')\|\|' '\|\|coalesce(metal,'')\|\|' '\|\|coalesce(purity,''))` | `WHERE published_at IS NOT NULL` |

Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` â€” runs before the trigram index, idempotent.

### Backfill

None. All new columns have safe NULL / empty array / 0 defaults. No per-row UPDATE required.

### Weight columns invariant

Migration MUST NOT alter `gross_weight_g` or `net_weight_g`. Both must remain `DECIMAL(12,4)`. Plan tests verify `\d products` after migration shows the correct type.

### Rollback DDL

```sql
DROP INDEX IF EXISTS products_style_idx;
DROP INDEX IF EXISTS products_occasion_gin_idx;
DROP INDEX IF EXISTS products_gift_persona_gin_idx;
DROP INDEX IF EXISTS products_featured_idx;
DROP INDEX IF EXISTS products_price_snapshot_idx;
DROP INDEX IF EXISTS products_top_sellers_idx;
DROP INDEX IF EXISTS products_search_trgm_idx;
ALTER TABLE products
  DROP COLUMN IF EXISTS style,
  DROP COLUMN IF EXISTS occasion,
  DROP COLUMN IF EXISTS gift_persona,
  DROP COLUMN IF EXISTS featured_score,
  DROP COLUMN IF EXISTS sales_count_30d,
  DROP COLUMN IF EXISTS view_count_30d,
  DROP COLUMN IF EXISTS price_snapshot_paise,
  DROP COLUMN IF EXISTS price_snapshot_at,
  DROP COLUMN IF EXISTS published_search_idx_at;
-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
```

---

## Migration 0068 â€” `products.primary_image_id` + maintain trigger

### Column

```sql
ALTER TABLE products
  ADD COLUMN primary_image_id UUID;
```

Plain FK added first (see composite FK step below for replacement).

### Composite FK (closes cross-tenant loophole â€” mirrors 0058 pattern)

Step 1 â€” add UNIQUE on `product_images(shop_id, id)` as composite FK target:
```sql
ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);
```

Step 2 â€” add composite FK on `products`:
```sql
ALTER TABLE products
  ADD CONSTRAINT products_shop_primary_image_fkey
  FOREIGN KEY (shop_id, primary_image_id)
  REFERENCES product_images(shop_id, id)
  ON DELETE SET NULL;
```

This means `UPDATE products SET primary_image_id = $b_image_id WHERE id = $a_product_id` fails at the DB layer (FK violation) when `shop_id` doesn't match â€” not just at the RLS layer. Double protection: RLS blocks the read; FK blocks the write.

### Backfill

```sql
UPDATE products
   SET primary_image_id = (
     SELECT pi.id
       FROM product_images pi
      WHERE pi.product_id = products.id
        AND pi.scan_status = 'clean'
      ORDER BY pi.sort_order ASC
      LIMIT 1
   );
```

Products with no clean image remain NULL â€” correct and safe. The trigger will keep this current going forward.

### Trigger function `maintain_products_primary_image()`

```sql
CREATE OR REPLACE FUNCTION maintain_products_primary_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER  -- NEVER SECURITY DEFINER: must not bypass RLS
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Determine affected product_id from NEW or OLD depending on operation
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE products
     SET primary_image_id = (
       SELECT pi.id
         FROM product_images pi
        WHERE pi.product_id = v_product_id
          AND pi.scan_status = 'clean'
        ORDER BY pi.sort_order ASC
        LIMIT 1
     )
   WHERE id = v_product_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maintain_products_primary_image
AFTER INSERT OR DELETE OR UPDATE OF sort_order, scan_status
ON product_images
FOR EACH ROW
EXECUTE FUNCTION maintain_products_primary_image();
```

**Key invariants:**
- `SECURITY INVOKER` â€” trigger runs with the session user's grants; RLS policy on `products` and `product_images` stays active
- `FOR EACH ROW` â€” one UPDATE per modified image row; cannot cross tenant boundary under RLS
- `COALESCE(NEW.product_id, OLD.product_id)` â€” handles DELETE (NEW is null) and INSERT/UPDATE (OLD may be null). AFTER trigger return value is ignored by Postgres; `RETURN NEW` is conventional.
- UPDATE targets `products WHERE id = v_product_id` â€” scope is a single product row, well within RLS fence

### Rollback DDL

```sql
DROP TRIGGER IF EXISTS trg_maintain_products_primary_image ON product_images;
DROP FUNCTION IF EXISTS maintain_products_primary_image();
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_shop_primary_image_fkey,
  DROP COLUMN IF EXISTS primary_image_id;
ALTER TABLE product_images
  DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;
```

---

## Drizzle schema (`packages/db/src/schema/products.ts`)

New exports:

```typescript
export const CATALOG_STYLES = [
  'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
  'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS',
] as const;
export type CatalogStyle = typeof CATALOG_STYLES[number];
```

New columns added to `tenantScopedTable`:

```typescript
style:                   text('style'),                                    // nullable
occasion:                text('occasion').array().notNull().default(sql`'{}'::text[]`),
gift_persona:            text('gift_persona').array().notNull().default(sql`'{}'::text[]`),
featured_score:          smallint('featured_score').notNull().default(0),
sales_count_30d:         integer('sales_count_30d').notNull().default(0),
view_count_30d:          integer('view_count_30d').notNull().default(0),

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Select-String -Path docs/superpowers/plans/2026-05-06-story-a1a3-storefront-schema.md -Pattern "products_search_trgm|occasion|Every index|Backfill|ON DELETE|product_id" -Context 0,3' in C:\gs-stf-1
 succeeded in 1413ms:

> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:18:| Create | 
`packages/db/src/migrations/0068_products_primary_image.sql` | WS-B: composite FK + backfill + SECURITY INVOKER 
trigger |
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:19:| Create | 
`apps/api/test/storefront-schema-0066.integration.spec.ts` | WS-E: T3-T6 + weight invariant tests |
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:20:| Create | 
`apps/api/test/storefront-schema-0068.integration.spec.ts` | WS-C+D: T1 (FK cross-tenant) + T2 (trigger RLS) |
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:21:| Modify | `packages/db/src/schema/products.ts` 
| WS-F: Drizzle column additions + `CATALOG_STYLES` export |
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:32:**Context:** `runMigrations` applies every 
`.sql` file in `packages/db/src/migrations/` in alphabetical order. Until `0066_*.sql` exists, `products` has no 
`style`, `occasion`, `gift_persona`, etc. columns. Every test in this file will fail with `column "style" does not 
exist` (Postgres error 42703) — that IS the Red failure.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:33:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:34:- [ ] **Step 1: Create the test file**
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:35:
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:181:// T4 — GIN occasion index used by ANY(...)
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:182:// 
---------------------------------------------------------------------------
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:183:describe('migration 0066: GIN occasion index', 
() => {
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:184:  it('planner uses products_occasion_gin_idx 
for ANY(occasion) filter', async () => {
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:185:    const client = await pool.connect();
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:186:    try {
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:187:      await client.query('SET enable_seqscan = 
off');
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:189:        `EXPLAIN SELECT id FROM products WHERE 
'WEDDING' = ANY(occasion)`,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:190:      );
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:191:      const plan = r.rows.map((row) => 
row['QUERY PLAN']).join('\n');
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:192:      
expect(plan).toContain('products_occasion_gin_idx');
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:193:    } finally {
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:194:      await client.query('RESET 
enable_seqscan');
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:195:      client.release();
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:227:  it('planner uses products_search_trgm_idx 
for expression % similarity query', async () => {
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:228:    const client = await pool.connect();
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:229:    try {
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:230:      await client.query('SET enable_seqscan = 
off');
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:239:      
expect(plan).toContain('products_search_trgm_idx');
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:240:    } finally {
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:241:      await client.query('RESET 
enable_seqscan');
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:242:      client.release();
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:276:-- No backfill: all new columns have safe NULL 
/ empty-array / 0 defaults.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:277:-- Rollback: see rollback DDL at bottom 
(comment block).
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:278:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:279:BEGIN;
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:290:  ADD COLUMN occasion                TEXT[]   
NOT NULL DEFAULT '{}',
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:291:  ADD COLUMN gift_persona            TEXT[]   
NOT NULL DEFAULT '{}',
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:292:  ADD COLUMN featured_score          SMALLINT 
NOT NULL DEFAULT 0
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:293:    CONSTRAINT products_featured_score_check 
CHECK (featured_score BETWEEN 0 AND 100),
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:305:-- Occasion + gift_persona: GIN — used by 
ANY(occasion) / ANY(gift_persona) filters.
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:306:CREATE INDEX products_occasion_gin_idx
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:307:  ON products USING GIN (occasion);
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:308:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:309:CREATE INDEX products_gift_persona_gin_idx
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:310:  ON products USING GIN (gift_persona);
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:328:CREATE INDEX products_search_trgm_idx
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:329:  ON products USING GIN (
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:330:    (coalesce(sku, '') || ' ' || 
coalesce(metal, '') || ' ' || coalesce(purity, ''))
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:331:    gin_trgm_ops
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:341:-- DROP INDEX IF EXISTS 
products_occasion_gin_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:342:-- DROP INDEX IF EXISTS 
products_gift_persona_gin_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:343:-- DROP INDEX IF EXISTS products_featured_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:344:-- DROP INDEX IF EXISTS 
products_price_snapshot_idx;
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:346:-- DROP INDEX IF EXISTS 
products_search_trgm_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:347:-- ALTER TABLE products
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:348:--   DROP COLUMN IF EXISTS style,
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:349:--   DROP COLUMN IF EXISTS occasion,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:350:--   DROP COLUMN IF EXISTS gift_persona,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:351:--   DROP COLUMN IF EXISTS featured_score,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:352:--   DROP COLUMN IF EXISTS sales_count_30d,
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:368:DROP INDEX IF EXISTS products_occasion_gin_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:369:DROP INDEX IF EXISTS 
products_gift_persona_gin_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:370:DROP INDEX IF EXISTS products_featured_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:371:DROP INDEX IF EXISTS 
products_price_snapshot_idx;
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:373:DROP INDEX IF EXISTS products_search_trgm_idx;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:374:ALTER TABLE products
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:375:  DROP COLUMN IF EXISTS style,
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:376:  DROP COLUMN IF EXISTS occasion,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:377:  DROP COLUMN IF EXISTS gift_persona,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:378:  DROP COLUMN IF EXISTS featured_score,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:379:  DROP COLUMN IF EXISTS sales_count_30d,
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:408:✓ migration 0066: GIN occasion index > planner 
uses products_occasion_gin_idx for ANY(occasion) filter
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:409:✓ migration 0066: top-sellers expression index 
> planner uses products_top_sellers_idx for (sales*2+views) DESC ORDER BY
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:410:✓ migration 0066: pg_trgm similarity index > 
planner uses products_search_trgm_idx for expression % similarity query
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:411:Test Files  1 passed (1)
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:412:Tests       7 passed (7)
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:413:```
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:429:Nine new columns: style (CHECK constraint), 
occasion[], gift_persona[],
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:430:featured_score, sales_count_30d, 
view_count_30d, price_snapshot_paise,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:431:price_snapshot_at, published_search_idx_at. 
Seven indexes including two GIN
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:432:arrays, pg_trgm expression, and expression 
top-sellers index. All 7 spec
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:494:           (shop_id, product_id, storage_key, 
mime_type, byte_size, width, height,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:495:            exif_stripped_at, 
uploaded_by_user_id, scan_status, sort_order)
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:496:         VALUES
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:497:           ($1, $2, $3, 'image/jpeg', 1234, 
800, 600,
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:592:// Backfill verification — after migration, 
existing clean images populate primary_image_id
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:593:// (The beforeAll seeds products THEN 
runMigrations already ran; backfill applies during
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:594:// migration so products created BEFORE 
migration would be backfilled. In this test the
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:595:// products are seeded AFTER migration, so 
backfill doesn't apply here. Test trigger instead.)
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:596:// 
---------------------------------------------------------------------------
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:597:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:598:// 
---------------------------------------------------------------------------
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:738:- Composite FK ON DELETE SET NULL: when an 
image is deleted, FK sets `primary_image_id = NULL` before the trigger fires (trigger then recomputes from remaining 
clean images, restoring to the next best image or NULL if none remain).
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:739:- Do NOT create `0067_*` on this branch.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:740:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:741:- [ ] **Step 1: Create the migration file**
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:768:-- ON DELETE SET NULL: when a product_image is 
deleted, Postgres first sets
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:769:-- primary_image_id = NULL (FK action), then 
the trigger fires AFTER DELETE and
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:770:-- recomputes primary_image_id from remaining 
clean images.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:771:ALTER TABLE products
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:775:  ON DELETE SET NULL;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:776:
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:777:-- Step 4: Backfill — set primary_image_id for 
products that already have clean images.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:778:-- Products with no clean images remain NULL 
(correct and safe).
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:779:UPDATE products
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:780:   SET primary_image_id = (
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:783:      WHERE pi.product_id = products.id
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:784:        AND pi.scan_status = 'clean'
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:785:      ORDER BY pi.sort_order ASC, 
pi.created_at ASC
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:786:      LIMIT 1
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:798:  v_product_id UUID;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:799:BEGIN
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:800:  -- COALESCE handles both DELETE (NEW is 
null) and INSERT/UPDATE (OLD may be null).
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:801:  v_product_id := COALESCE(NEW.product_id, 
OLD.product_id);
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:802:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:803:  UPDATE products
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:804:     SET primary_image_id = (
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:807:        WHERE pi.product_id = v_product_id
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:808:          AND pi.scan_status = 'clean'
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:809:        ORDER BY pi.sort_order ASC, 
pi.created_at ASC
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:810:        LIMIT 1
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:812:   WHERE id = v_product_id;
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:813:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:814:  -- AFTER trigger return value is ignored by 
Postgres; RETURN NEW is conventional.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:815:  RETURN NEW;
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:821:--   DELETE      — image removed; FK ON DELETE 
SET NULL fires first, then trigger recomputes
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:822:--   UPDATE OF sort_order  — reorder can 
change which image is first
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:823:--   UPDATE OF scan_status — an image becoming 
'clean' or 'rejected' changes eligibility
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:824:CREATE TRIGGER 
trg_maintain_products_primary_image
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:893:- Verify the trigger function computes 
correctly: `WHERE pi.product_id = v_product_id AND pi.scan_status = 'clean'`.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:894:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:895:- [ ] **Step 2: Run both integration test 
suites together**
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:896:
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:915:scan_status changes. Backfill sets existing 
products from first clean image. All 5
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:916:spec tests (T1 FK cross-tenant, T2 trigger 
RLS) passing.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:917:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:918:Co-Authored-By: Claude Sonnet 4.6 
<noreply@anthropic.com>
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:977:  occasion:                   
text('occasion').array().notNull().default([]),
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:978:  gift_persona:               
text('gift_persona').array().notNull().default([]),
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:979:  featured_score:             
smallint('featured_score').notNull().default(0),
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:980:  sales_count_30d:            
integer('sales_count_30d').notNull().default(0),
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1022:occasion/gift_persona (text array), 
featured_score (smallint), sales_count_30d/
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1023:view_count_30d (integer), 
price_snapshot_paise (bigint), timestamp fields,
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1024:primary_image_id (uuid).
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1025:
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1044:git grep "occasion" 
packages/db/src/migrations/0066_products_storefront_columns.sql packages/db/src/schema/products.ts 
apps/api/test/storefront-schema-0066.integration.spec.ts
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1045:git grep "gift_persona" 
packages/db/src/migrations/0066_products_storefront_columns.sql packages/db/src/schema/products.ts 
apps/api/test/storefront-schema-0066.integration.spec.ts
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1046:git grep "price_snapshot_paise" 
packages/db/src/migrations/0066_products_storefront_columns.sql packages/db/src/schema/products.ts 
apps/api/test/storefront-schema-0066.integration.spec.ts
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1047:git grep "primary_image_id" 
packages/db/src/migrations/0068_products_primary_image.sql packages/db/src/schema/products.ts 
apps/api/test/storefront-schema-0068.integration.spec.ts
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1144:psql $DATABASE_URL -c "\d products" | grep -E 
"style|occasion|gift_persona|primary_image_id|featured_score|price_snapshot_paise"
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1145:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1146:# Verify weight columns unchanged
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1147:psql $DATABASE_URL -c "SELECT column_name, 
data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = 'products' AND 
column_name IN ('gross_weight_g', 'net_weight_g')"
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1156:Expected: 7 new indexes listed 
(`products_style_idx`, `products_occasion_gin_idx`, `products_gift_persona_gin_idx`, `products_featured_idx`, 
`products_price_snapshot_idx`, `products_top_sellers_idx`, `products_search_trgm_idx`). Function 
`maintain_products_primary_image` listed.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1157:
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1158:If local Postgres is unavailable, the 
Testcontainer test suite (Task 8 Step 3) is the runtime smoke — it applies migrations via `runMigrations` to a real 
Postgres 15.6 container. Mark smoke as complete if integration tests pass.
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1159:
> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1175:| T4: GIN occasion index | Task 1 (Red) → 
Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `GIN occasion index` |
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1176:| T5: top-sellers index | Task 1 (Red) → Task 
2 (Green) | `storefront-schema-0066.integration.spec.ts` > `top-sellers expression index` |
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1177:| T6: pg_trgm index | Task 1 (Red) → Task 2 
(Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1178:| Weight invariant | Task 1 (Red) → Task 2 
(Green) | `storefront-schema-0066.integration.spec.ts` > `weight column types unchanged` |



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content packages/db/src/migrations/0068_products_primary_image.sql | ForEach-Object { $i++; '"'{0,4}: {1}' -f "'$i, $_ } | Select-Object -First 140' in C:\gs-stf-1
 succeeded in 1255ms:
   1: -- packages/db/src/migrations/0068_products_primary_image.sql
   2: -- Story A3 â€” products.primary_image_id with composite FK (mirrors 0058 pattern)
   3: -- and a SECURITY INVOKER trigger to auto-maintain the column.
   4: --
   5: -- Security rationale: a plain FK (primary_image_id â†’ product_images.id) would allow
   6: -- a Tenant-A product to reference a Tenant-B image â€” the RLS policy on products
   7: -- filters rows but does NOT prevent FK references into other tenants' images.
   8: -- Composite FK (shop_id, primary_image_id) â†’ product_images(shop_id, id) closes this
   9: -- at the schema layer, mirroring the 0058 pattern for product_images â†’ products.
  10: 
  11: BEGIN;
  12: 
  13: -- Step 1: UNIQUE constraint on product_images(shop_id, id) as composite FK target.
  14: -- product_images.id is already a PRIMARY KEY (unique), but FKs can only reference
  15: -- UNIQUE or PRIMARY KEY constraints. Adding an explicit UNIQUE(shop_id, id) lets
  16: -- the composite FK reference (shop_id, id) while the primary key covers (id) alone.
  17: ALTER TABLE product_images
  18:   ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);
  19: 
  20: -- Step 2: Add primary_image_id column (nullable â€” NULL = no clean image available).
  21: ALTER TABLE products
  22:   ADD COLUMN primary_image_id UUID;
  23: 
  24: -- Step 3: Composite FK â€” blocks cross-tenant image association at the schema layer.
  25: -- NO ON DELETE action: we cannot use ON DELETE SET NULL on a composite FK that includes
  26: -- shop_id (NOT NULL) because Postgres would NULL all FK columns including shop_id.
  27: -- Instead, a BEFORE DELETE trigger (trg_clear_products_primary_image) clears
  28: -- primary_image_id before the image row is deleted, satisfying the FK. The AFTER DELETE
  29: -- trigger (trg_maintain_products_primary_image) then recomputes from remaining images.
  30: ALTER TABLE products
  31:   ADD CONSTRAINT products_shop_primary_image_fkey
  32:   FOREIGN KEY (shop_id, primary_image_id)
  33:   REFERENCES product_images(shop_id, id);
  34: 
  35: -- Step 4: Backfill â€” set primary_image_id for products that already have clean images.
  36: -- Products with no clean images remain NULL (correct and safe).
  37: UPDATE products
  38:    SET primary_image_id = (
  39:      SELECT pi.id
  40:        FROM product_images pi
  41:       WHERE pi.product_id = products.id
  42:         AND pi.scan_status = 'clean'
  43:       ORDER BY pi.sort_order ASC, pi.created_at ASC
  44:       LIMIT 1
  45:    );
  46: 
  47: -- Step 5a: BEFORE DELETE trigger function â€” clears primary_image_id on the product
  48: -- before the image row is removed so the composite FK constraint is satisfied.
  49: -- SECURITY INVOKER: runs under session user privileges; RLS on products must allow
  50: -- the UPDATE (withTenantTx sets the GUC that satisfies RLS for the owning tenant).
  51: CREATE OR REPLACE FUNCTION clear_products_primary_image()
  52: RETURNS TRIGGER
  53: LANGUAGE plpgsql
  54: SECURITY INVOKER
  55: AS $$
  56: BEGIN
  57:   -- Clear primary_image_id only when the product currently points at this image.
  58:   -- This avoids a spurious UPDATE when a non-primary image is deleted.
  59:   UPDATE products
  60:      SET primary_image_id = NULL
  61:    WHERE id = OLD.product_id
  62:      AND primary_image_id = OLD.id;
  63: 
  64:   -- BEFORE trigger: return OLD to allow the delete to proceed.
  65:   RETURN OLD;
  66: END;
  67: $$;
  68: 
  69: -- Fires BEFORE DELETE so the FK reference is cleared before the row is removed.
  70: CREATE TRIGGER trg_clear_products_primary_image
  71: BEFORE DELETE
  72: ON product_images
  73: FOR EACH ROW
  74: EXECUTE FUNCTION clear_products_primary_image();
  75: 
  76: -- Step 5b: AFTER trigger function. SECURITY INVOKER so RLS stays active during trigger
  77: -- execution â€” the trigger UPDATE runs under the session user's privileges, not
  78: -- a privileged role, preventing cross-tenant writes.
  79: CREATE OR REPLACE FUNCTION maintain_products_primary_image()
  80: RETURNS TRIGGER
  81: LANGUAGE plpgsql
  82: SECURITY INVOKER
  83: AS $$
  84: DECLARE
  85:   v_product_id UUID;
  86: BEGIN
  87:   -- COALESCE handles both DELETE (NEW is null) and INSERT/UPDATE (OLD may be null).
  88:   v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  89: 
  90:   UPDATE products
  91:      SET primary_image_id = (
  92:        SELECT pi.id
  93:          FROM product_images pi
  94:         WHERE pi.product_id = v_product_id
  95:           AND pi.scan_status = 'clean'
  96:         ORDER BY pi.sort_order ASC, pi.created_at ASC
  97:         LIMIT 1
  98:      )
  99:    WHERE id = v_product_id;
 100: 
 101:   -- AFTER trigger: return value is ignored by Postgres; RETURN NEW is conventional
 102:   -- (RETURN NULL would also work for AFTER triggers).
 103:   RETURN NEW;
 104: END;
 105: $$;
 106: 
 107: -- Fires after any of the four mutation events that can change which image is "primary":
 108: --   INSERT      â€” new image added; may become primary if it has the lowest sort_order
 109: --   DELETE      â€” image removed; BEFORE trigger clears FK first, AFTER recomputes
 110: --   UPDATE OF sort_order  â€” reorder can change which image is first
 111: --   UPDATE OF scan_status â€” an image becoming 'clean' or 'rejected' changes eligibility
 112: CREATE TRIGGER trg_maintain_products_primary_image
 113: AFTER INSERT OR DELETE OR UPDATE OF sort_order, scan_status
 114: ON product_images
 115: FOR EACH ROW
 116: EXECUTE FUNCTION maintain_products_primary_image();
 117: 
 118: COMMIT;
 119: 
 120: -- ---------------------------------------------------------------------------
 121: -- Rollback DDL (validate on scratch DB before claiming Task 6 done)
 122: -- ---------------------------------------------------------------------------
 123: -- DROP TRIGGER IF EXISTS trg_maintain_products_primary_image ON product_images;
 124: -- DROP FUNCTION IF EXISTS maintain_products_primary_image();
 125: -- DROP TRIGGER IF EXISTS trg_clear_products_primary_image ON product_images;
 126: -- DROP FUNCTION IF EXISTS clear_products_primary_image();
 127: -- ALTER TABLE products
 128: --   DROP CONSTRAINT IF EXISTS products_shop_primary_image_fkey,
 129: --   DROP COLUMN IF EXISTS primary_image_id;
 130: -- ALTER TABLE product_images
 131: --   DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content packages/db/src/migrations/0066_products_storefront_columns.sql | ForEach-Object { $i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\gs-stf-1
 succeeded in 1154ms:
   1: -- packages/db/src/migrations/0066_products_storefront_columns.sql
   2: -- Story A1 â€” Storefront-specific columns on products for customer catalog.
   3: -- No backfill: all new columns have safe NULL / empty-array / 0 defaults.
   4: -- Rollback: see rollback DDL at bottom (comment block).
   5: 
   6: BEGIN;
   7: 
   8: -- pg_trgm required before trigram GIN index. Idempotent.
   9: CREATE EXTENSION IF NOT EXISTS pg_trgm;
  10: 
  11: ALTER TABLE products
  12:   ADD COLUMN style                   TEXT
  13:     CONSTRAINT products_style_check CHECK (style IN (
  14:       'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
  15:       'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS'
  16:     )),
  17:   ADD COLUMN occasion                TEXT[]   NOT NULL DEFAULT '{}',
  18:   ADD COLUMN gift_persona            TEXT[]   NOT NULL DEFAULT '{}',
  19:   ADD COLUMN featured_score          SMALLINT NOT NULL DEFAULT 0
  20:     CONSTRAINT products_featured_score_check CHECK (featured_score BETWEEN 0 AND 100),
  21:   ADD COLUMN sales_count_30d         INTEGER  NOT NULL DEFAULT 0,
  22:   ADD COLUMN view_count_30d          INTEGER  NOT NULL DEFAULT 0,
  23:   ADD COLUMN price_snapshot_paise    BIGINT,
  24:   ADD COLUMN price_snapshot_at       TIMESTAMPTZ,
  25:   ADD COLUMN published_search_idx_at TIMESTAMPTZ;
  26: 
  27: -- Style: partial BTree â€” used by /products?style=JHUMKA filter.
  28: CREATE INDEX products_style_idx
  29:   ON products (shop_id, style)
  30:   WHERE published_at IS NOT NULL;
  31: 
  32: -- Occasion + gift_persona: GIN â€” used by ANY(occasion) / ANY(gift_persona) filters.
  33: CREATE INDEX products_occasion_gin_idx
  34:   ON products USING GIN (occasion);
  35: 
  36: CREATE INDEX products_gift_persona_gin_idx
  37:   ON products USING GIN (gift_persona);
  38: 
  39: -- Featured: partial BTree â€” used by /catalog/products/featured endpoint.
  40: CREATE INDEX products_featured_idx
  41:   ON products (shop_id, featured_score DESC)
  42:   WHERE published_at IS NOT NULL AND featured_score > 0;
  43: 
  44: -- Price snapshot: partial BTree â€” used by priceMin/priceMax filter.
  45: CREATE INDEX products_price_snapshot_idx
  46:   ON products (shop_id, price_snapshot_paise)
  47:   WHERE price_snapshot_paise IS NOT NULL AND published_at IS NOT NULL;
  48: 
  49: -- Top-sellers: expression BTree â€” ORDER BY (sales_count_30d * 2 + view_count_30d) DESC.
  50: CREATE INDEX products_top_sellers_idx
  51:   ON products (shop_id, (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC)
  52:   WHERE published_at IS NOT NULL;
  53: 
  54: -- Trigram search: GIN gin_trgm_ops â€” WHERE (...concatenation...) % 'query'.
  55: -- Non-partial so it is unambiguously chosen by the planner for trgm similarity
  56: -- queries regardless of other partial BTree indexes on this table.
  57: CREATE INDEX products_search_trgm_idx
  58:   ON products USING GIN (
  59:     (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, ''))
  60:     gin_trgm_ops
  61:   );
  62: 
  63: COMMIT;
  64: 
  65: -- ---------------------------------------------------------------------------
  66: -- Rollback DDL (run on a scratch DB to validate before claiming Task 3 done)
  67: -- ---------------------------------------------------------------------------
  68: -- DROP INDEX IF EXISTS products_style_idx;
  69: -- DROP INDEX IF EXISTS products_occasion_gin_idx;
  70: -- DROP INDEX IF EXISTS products_gift_persona_gin_idx;
  71: -- DROP INDEX IF EXISTS products_featured_idx;
  72: -- DROP INDEX IF EXISTS products_price_snapshot_idx;
  73: -- DROP INDEX IF EXISTS products_top_sellers_idx;
  74: -- DROP INDEX IF EXISTS products_search_trgm_idx;
  75: -- ALTER TABLE products
  76: --   DROP COLUMN IF EXISTS style,
  77: --   DROP COLUMN IF EXISTS occasion,
  78: --   DROP COLUMN IF EXISTS gift_persona,
  79: --   DROP COLUMN IF EXISTS featured_score,
  80: --   DROP COLUMN IF EXISTS sales_count_30d,
  81: --   DROP COLUMN IF EXISTS view_count_30d,
  82: --   DROP COLUMN IF EXISTS price_snapshot_paise,
  83: --   DROP COLUMN IF EXISTS price_snapshot_at,
  84: --   DROP COLUMN IF EXISTS published_search_idx_at;
  85: -- (pg_trgm extension is NOT dropped â€” may be used by other indexes.)

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content apps/api/test/storefront-schema-0066.integration.spec.ts | ForEach-Object { $i++; if($i -ge 140 -and $i -le 165){ '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\gs-stf-1
 succeeded in 1291ms:
 140:     }
 141:   });
 142: });
 143: 
 144: // ---------------------------------------------------------------------------
 145: // T4 â€” GIN occasion index used by ANY(...)
 146: // ---------------------------------------------------------------------------
 147: describe('migration 0066: GIN occasion index', () => {
 148:   it('planner uses products_occasion_gin_idx for ANY(occasion) filter', async () => {
 149:     const client = await pool.connect();
 150:     try {
 151:       await client.query('SET enable_seqscan = off');
 152:       // GIN array indexes support @> (containment) operator; use that form
 153:       // rather than '= ANY()' which the planner may not route through GIN.
 154:       const r = await client.query<{ 'QUERY PLAN': string }>(
 155:         `EXPLAIN SELECT id FROM products WHERE occasion @> ARRAY['WEDDING']::text[]`,
 156:       );
 157:       const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
 158:       expect(plan).toContain('products_occasion_gin_idx');
 159:     } finally {
 160:       await client.query('RESET enable_seqscan');
 161:       client.release();
 162:     }
 163:   });
 164: });
 165: 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "product_images|productImages|product_id" apps/api/src -n | Select-Object -First 200' in C:\gs-stf-1
 succeeded in 1448ms:
apps/api/src\modules\wishlist\wishlist.service.ts:52:      productId:    row.product_id,
apps/api/src\modules\catalog\catalog.service.ts:408:           FROM product_images pi
apps/api/src\modules\catalog\catalog.service.ts:409:           JOIN products p ON p.id = pi.product_id
apps/api/src\modules\catalog\catalog.service.ts:410:          WHERE pi.product_id = $1
apps/api/src\modules\billing\void.service.ts:118:      const itemRes = await tx.query<{ product_id: string }>(
apps/api/src\modules\billing\void.service.ts:119:        `SELECT product_id FROM invoice_items WHERE invoice_id = $1 AND product_id IS NOT NULL`,
apps/api/src\modules\billing\void.service.ts:124:      for (const { product_id: productId } of itemRes.rows) {
apps/api/src\modules\billing\void.service.ts:147:             (shop_id, product_id, type, reason, quantity_delta, balance_before, balance_after,
apps/api/src\modules\wishlist\wishlist.service.spec.ts:53:        product_id: PRODUCT_ID, created_at: new Date(),
apps/api/src\modules\wishlist\wishlist.service.spec.ts:89:          product_id: PRODUCT_ID, sku: 'GLD-001', purity: '22K', metal: 'GOLD',
apps/api/src\modules\wishlist\wishlist.service.spec.ts:108:      mockRepo.add.mockResolvedValueOnce({ id: 'w1', shop_id: SHOP_ID, customer_id: CUSTOMER_ID, product_id: PRODUCT_ID, created_at: new Date() });
apps/api/src\modules\wishlist\wishlist.service.spec.ts:117:      mockRepo.add.mockResolvedValueOnce({ id: 'w2', shop_id: SHOP_ID, customer_id: CUSTOMER_ID, product_id: PRODUCT_ID, created_at: new Date() });
apps/api/src\modules\analytics\analytics.service.ts:37:      // different tenant's product_id.
apps/api/src\modules\analytics\analytics.service.ts:58:         WHERE session_id = $1 AND product_id = $2
apps/api/src\modules\analytics\analytics.service.ts:67:        `INSERT INTO product_views (shop_id, product_id, customer_id, session_id, duration_seconds)
apps/api/src\modules\analytics\analytics.service.ts:100:         WHERE product_id = $1
apps/api/src\modules\wishlist\wishlist.repository.ts:9:  product_id: string;
apps/api/src\modules\wishlist\wishlist.repository.ts:14:  product_id:   string;
apps/api/src\modules\wishlist\wishlist.repository.ts:31:        `INSERT INTO wishlists (shop_id, customer_id, product_id)
apps/api/src\modules\wishlist\wishlist.repository.ts:33:         ON CONFLICT (shop_id, customer_id, product_id) DO NOTHING
apps/api/src\modules\wishlist\wishlist.repository.ts:42:        `SELECT * FROM wishlists WHERE shop_id = $1 AND customer_id = $2 AND product_id = $3`,
apps/api/src\modules\wishlist\wishlist.repository.ts:52:        `DELETE FROM wishlists WHERE shop_id = $1 AND customer_id = $2 AND product_id = $3`,
apps/api/src\modules\wishlist\wishlist.repository.ts:64:        `SELECT p.id AS product_id, p.sku, p.purity, p.metal,
apps/api/src\modules\wishlist\wishlist.repository.ts:68:           JOIN products p ON p.id = w.product_id
apps/api/src\modules\wishlist\wishlist.repository.ts:86:            WHERE shop_id = $1 AND customer_id = $2 AND product_id = $3
apps/api/src\modules\inventory\stock-movement.service.ts:29:    productId: row.product_id,
apps/api/src\modules\inventory\stock-movement.service.spec.ts:27:      product_id: PRODUCT_ID,
apps/api/src\modules\inventory\stock-movement.repository.ts:18:  product_id: string;
apps/api/src\modules\inventory\stock-movement.repository.ts:43:  id, shop_id, product_id, type, reason, quantity_delta,
apps/api/src\modules\inventory\stock-movement.repository.ts:108:           (shop_id, product_id, type, reason, quantity_delta,
apps/api/src\modules\inventory\stock-movement.repository.ts:152:         WHERE product_id = $1
apps/api/src\modules\reviews\reviews.service.ts:67:      productId:         row.product_id,
apps/api/src\modules\billing\billing.service.ts:133:    productId:          it.product_id,
apps/api/src\modules\reviews\reviews.service.spec.ts:50:        id: 'rev-1', shop_id: SHOP_ID, product_id: PRODUCT_ID,
apps/api/src\modules\reviews\reviews.service.spec.ts:88:        { id: 'r1', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: CUSTOMER_ID,
apps/api/src\modules\reviews\reviews.service.spec.ts:91:        { id: 'r2', shop_id: SHOP_ID, product_id: PRODUCT_ID, customer_id: 'other',
apps/api/src\modules\reviews\reviews.repository.ts:8:  product_id:   string;
apps/api/src\modules\reviews\reviews.repository.ts:29:        `INSERT INTO product_reviews (shop_id, product_id, customer_id, rating, review_text)
apps/api/src\modules\reviews\reviews.repository.ts:31:         ON CONFLICT (shop_id, customer_id, product_id)
apps/api/src\modules\reviews\reviews.repository.ts:48:        `SELECT pr.id, pr.shop_id, pr.product_id, pr.customer_id,
apps/api/src\modules\reviews\reviews.repository.ts:55:          WHERE pr.shop_id = $1 AND pr.product_id = $2
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:62:        product_ids: [PROD_A, PROD_B, PROD_C], status: 'REQUESTED',
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:67:        product_ids: bookingProductIds, status: bookingStatus,
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:74:          product_ids: bookingProductIds, status: 'DISPATCHED',
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.smoke.spec.ts:83:          product_ids: remaining, status,
apps/api/src\modules\billing\billing.service.spec.ts:125:        product_id: it.productId,
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.ts:50:    productIds:  r.product_ids,
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.ts:140:      for (const productId of booking.product_ids) {
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.ts:149:        after:       { productCount: booking.product_ids.length },
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.ts:170:      const bookedSet = new Set(booking.product_ids);
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.ts:261:          `SELECT id, shop_id, customer_id, product_ids, status,
apps/api/src\modules\billing\billing.service.rate-lock.spec.ts:109:            product_id: it.productId, description: it.description, hsn_code: '7113',
apps/api/src\modules\inventory\product-images.service.spec.ts:111:      product_id: input.productId,
apps/api/src\modules\inventory\product-images.service.spec.ts:332:      product_id: 'prod-X',
apps/api/src\modules\inventory\product-images.service.spec.ts:364:      product_id: 'prod-X',
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:82:    product_ids:  [PROD_A, PROD_B, PROD_C],
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:90:    insert:               overrides.insert ?? vi.fn(async () => ({ ...booking, product_ids: [PROD_A, PROD_B, PROD_C] })),
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:94:    updateStatusReturn:   overrides.updateStatusReturn ?? vi.fn(async (_c, _id, remaining, status) => ({ ...booking, product_ids: remaining, status })),
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:179:        product_ids: [PROD_A], status: 'DISPATCHED',
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:195:      product_ids:  [PROD_A, PROD_B, PROD_C],
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:205:        ...dispatchedBooking, product_ids: remaining, status,
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:241:      product_ids:  [PROD_A, PROD_B], status: 'DISPATCHED',
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:265:      product_ids: [PROD_A], status: 'DISPATCHED',
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts:287:      product_ids: ['p1', 'p2'], status: 'REQUESTED',
apps/api/src\modules\billing\billing.service.loyalty.spec.ts:79:          product_id: it.productId, description: it.description, hsn_code: it.hsnCode,
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.repository.ts:9:  product_ids:  string[];
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.repository.ts:29:        `INSERT INTO try_at_home_bookings (shop_id, customer_id, product_ids, notes)
apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.repository.ts:84:         SET status = $2, product_ids = $3::uuid[]
apps/api/src\modules\inventory\product-images.repository.ts:11:  product_id: string;
apps/api/src\modules\inventory\product-images.repository.ts:44:  id, shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
apps/api/src\modules\inventory\product-images.repository.ts:75:      `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
apps/api/src\modules\inventory\product-images.repository.ts:83:      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
apps/api/src\modules\inventory\product-images.repository.ts:92:   * replay. Partial UNIQUE index `product_images_idempotency_uniq` (migration
apps/api/src\modules\inventory\product-images.repository.ts:98:         FROM product_images
apps/api/src\modules\inventory\product-images.repository.ts:99:        WHERE product_id = $1 AND idempotency_key = $2
apps/api/src\modules\inventory\product-images.repository.ts:109:      `INSERT INTO product_images
apps/api/src\modules\inventory\product-images.repository.ts:110:         (shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
apps/api/src\modules\inventory\product-images.repository.ts:130:           FROM product_images
apps/api/src\modules\inventory\product-images.repository.ts:131:          WHERE product_id = $1
apps/api/src\modules\inventory\product-images.repository.ts:142:        `DELETE FROM product_images
apps/api/src\modules\inventory\product-images.repository.ts:143:          WHERE id = $1 AND product_id = $2
apps/api/src\modules\inventory\product-images.repository.ts:158:        `SELECT id FROM product_images WHERE product_id = $1 FOR UPDATE`,
apps/api/src\modules\inventory\product-images.repository.ts:169:          `UPDATE product_images
apps/api/src\modules\inventory\product-images.repository.ts:171:            WHERE id = $2 AND product_id = $3`,
apps/api/src\modules\inventory\product-images.repository.ts:177:           FROM product_images
apps/api/src\modules\inventory\product-images.repository.ts:178:          WHERE product_id = $1
apps/api/src\modules\inventory\product-images.repository.ts:189:        `UPDATE product_images
apps/api/src\modules\inventory\product-images.repository.ts:191:          WHERE id = $2 AND product_id = $3
apps/api/src\modules\inventory\product-images.repository.spec.ts:25:  it('lockProductForTenant returns null when no row matches shop_id + product_id', async () => {
apps/api/src\modules\inventory\product-images.repository.spec.ts:63:      product_id: 'prod-X',
apps/api/src\modules\inventory\product-images.repository.spec.ts:86:    expect(txMock.query.mock.calls[0]?.[0]).toMatch(/INSERT INTO product_images/i);
apps/api/src\modules\inventory\inventory.repository.ts:305:        `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
apps/api/src\modules\billing\billing.repository.ts:50:  product_id:            string | null;
apps/api/src\modules\billing\billing.repository.ts:142:  id, shop_id, invoice_id, product_id, description, hsn_code, huid,
apps/api/src\modules\billing\billing.repository.ts:253:           (shop_id, invoice_id, product_id, description, hsn_code, huid,

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/inventory/product-images.repository.ts | Select-Object -First 230' in C:\gs-stf-1
 succeeded in 1427ms:
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';

type Tx = Pick<PoolClient, 'query'>;

export type ImageRow = {
  id: string;
  shop_id: string;
  product_id: string;
  storage_key: string;
  alt_text: string | null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  exif_stripped_at: string;
  uploaded_by_user_id: string;
  scan_status: 'pending' | 'clean' | 'rejected';
  sort_order: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  /** F6-server (Codex P2): server-built thumbnail URL via ImageKit builder.
   *  Mobile consumes this directly â€” no client-side URL construction. */
  thumbnail_url: string;
};

export type InsertImageInput = {
  productId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sortOrder: number;
  altText: string | null;
  uploadedByUserId: string;
  idempotencyKey: string | null;
};

const SELECT_COLS = `
  id, shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
  width, height, exif_stripped_at, uploaded_by_user_id, scan_status,
  sort_order, idempotency_key, created_at, updated_at
`.trim();

@Injectable()
export class ProductImagesRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Tenant-scoped product existence check + pessimistic row lock.
   * Returns null on miss (cross-tenant attempt OR not found).
   *
   * The FOR UPDATE lock serializes concurrent uploads for the same product,
   * making the 10-image cap inviolable. The composite FK from migration 0058
   * is the schema-layer defense; this method is the explicit serialization
   * point inside the upload transaction.
   *
   * Per ADR-0005 the shop scope comes from `tenantContext`, not a parameter.
   */
  async lockProductForTenant(tx: Tx, productId: string): Promise<{ id: string } | null> {
    const { shopId } = tenantContext.requireCurrent();
    const r = await tx.query<{ id: string }>(
      `SELECT id FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
      [productId, shopId],
    );
    return r.rows[0] ?? null;
  }

  async countImagesInTx(tx: Tx, productId: string): Promise<number> {
    const r = await tx.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
      [productId],
    );
    return parseInt(r.rows[0]?.count ?? '0', 10);
  }

  async nextSortOrderInTx(tx: Tx, productId: string): Promise<number> {
    const r = await tx.query<{ next: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
      [productId],
    );
    return r.rows[0]?.next ?? 0;
  }

  /**
   * F7 service-layer idempotency lookup. Caller (ProductImagesService.upload)
   * runs this BEFORE attempting INSERT; if it finds a row, returns it as the
   * replay. Partial UNIQUE index `product_images_idempotency_uniq` (migration
   * 0058) is the race-loser backstop.
   */
  async findByIdempotencyKeyInTx(tx: Tx, productId: string, idempotencyKey: string): Promise<ImageRow | null> {
    const r = await tx.query<ImageRow>(
      `SELECT ${SELECT_COLS}
         FROM product_images
        WHERE product_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [productId, idempotencyKey],
    );
    return r.rows[0] ?? null;
  }

  async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow> {
    const { shopId } = tenantContext.requireCurrent();
    const r = await tx.query<ImageRow>(
      `INSERT INTO product_images
         (shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
          width, height, exif_stripped_at, uploaded_by_user_id, scan_status,
          sort_order, idempotency_key)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, 'clean', $10, $11)
       RETURNING ${SELECT_COLS}`,
      [
        shopId, input.productId, input.storageKey, input.altText,
        input.mimeType, input.byteSize, input.width, input.height,
        input.uploadedByUserId, input.sortOrder, input.idempotencyKey,
      ],
    );
    return r.rows[0]!;
  }

  /** Public read path. RLS scopes by shop_id via withTenantTx. */
  async listForProduct(productId: string): Promise<ImageRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ImageRow>(
        `SELECT ${SELECT_COLS}
           FROM product_images
          WHERE product_id = $1
          ORDER BY sort_order ASC, created_at ASC`,
        [productId],
      );
      return r.rows;
    });
  }

  async deleteImage(productId: string, imageId: string): Promise<{ storageKey: string } | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ storage_key: string }>(
        `DELETE FROM product_images
          WHERE id = $1 AND product_id = $2
          RETURNING storage_key`,
        [imageId, productId],
      );
      const row = r.rows[0];
      return row ? { storageKey: row.storage_key } : null;
    });
  }

  async setSortOrders(productId: string, orderedIds: string[]): Promise<ImageRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      // Lock the product's images. The set must match exactly: every image of
      // the product is in orderedIds and no extras. Mismatch â†’ return [] â†’
      // service throws ORDER_LIST_MISMATCH (400).
      const existing = await tx.query<{ id: string }>(
        `SELECT id FROM product_images WHERE product_id = $1 FOR UPDATE`,
        [productId],
      );
      const existingSet = new Set(existing.rows.map((r) => r.id));
      const orderedSet = new Set(orderedIds);
      if (existingSet.size !== orderedSet.size) return [];
      for (const id of existingSet) if (!orderedSet.has(id)) return [];

      // Atomic update: each row gets its new sort_order based on array index.
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.query(
          `UPDATE product_images
              SET sort_order = $1, updated_at = NOW()
            WHERE id = $2 AND product_id = $3`,
          [i, orderedIds[i], productId],
        );
      }
      const r = await tx.query<ImageRow>(
        `SELECT ${SELECT_COLS}
           FROM product_images
          WHERE product_id = $1
          ORDER BY sort_order ASC`,
        [productId],
      );
      return r.rows;
    });
  }

  async setAltText(productId: string, imageId: string, altText: string | null): Promise<ImageRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ImageRow>(
        `UPDATE product_images
            SET alt_text = $1, updated_at = NOW()
          WHERE id = $2 AND product_id = $3
          RETURNING ${SELECT_COLS}`,
        [altText, imageId, productId],
      );
      return r.rows[0] ?? null;
    });
  }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/gs-stf-1 diff --stat 0343b8c2e15bec18661c83a935a3ea00d63a0ae0' in C:\gs-stf-1
 succeeded in 1698ms:
 .../storefront-schema-0066.integration.spec.ts     |  216 ++++
 .../storefront-schema-0068.integration.spec.ts     |  259 +++++
 .../2026-05-06-story-a1a3-storefront-schema.md     | 1189 ++++++++++++++++++++
 .../2026-05-06-story-a1a3-storefront-schema.md     |  289 +++++
 .../0066_products_storefront_columns.sql           |   85 ++
 .../src/migrations/0068_products_primary_image.sql |  131 +++
 packages/db/src/schema/products.ts                 |   26 +-
 7 files changed, 2194 insertions(+), 1 deletion(-)
warning: unable to access 'C:\Users\alokt/.config/git/ignore': Permission denied

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "migrator|CREATE ON DATABASE|pg_trgm|extension" -n infra ops packages docs | Select-Object -First 200' in C:\gs-stf-1
2026-05-06T18:45:57.360343Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 2.2 seconds
Output:
docs\threat-model.md:165:| **S** | App connects as superuser, bypasses RLS | App role is `app_user` with `NOSUPERUSER NOBYPASSRLS`; migrations run as separate `migrator` role | LOW | ADR-0002 enforced; CI verifies `pg_roles` on every deploy |
docs\threat-model.md:173:| **E** | App exploits weak `CREATE FUNCTION` or `CREATE EXTENSION` to bypass RLS | `app_user` has no `CREATE` rights; extensions gated to `migrator` role | LOW | |
docs\runbook.md:109:3. Run database migrations with the migrator role.
docs\runbook.md:523:No action needed — Testcontainers + local Docker Postgres run the migrator as `postgres`
docs\prd-addendum-customer-storefront.md:92:> **Addendum:** Customer-storefront capabilities FR127–FR140 + completion notes for FR86/88/90/93/96/104/105 + NFR-SE-1/SE-2/IMG-1 are recorded in `docs/prd-addendum-customer-storefront.md`. The original 126-FR / 70-NFR list below is the historical MVP capability contract; the addendum is the post-feature-complete extension.
docs\db-workflow.md:6:- `migrator` - NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault once infrastructure lands, scoped to the GitHub OIDC role.
docs\db-workflow.md:11:DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`.
docs\db-workflow.md:26:`app_user` cannot run DDL. `migrator` cannot run DML on tenant tables.
docs\reviews\codex-review-a1a3.md:208:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\codex-review-a1a3.md:210:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\codex-review-a1a3.md:216:+      await client.query('SET pg_trgm.similarity_threshold = 0.1');
docs\reviews\codex-review-a1a3.md:230:+      await client.query('RESET pg_trgm.similarity_threshold');
docs\reviews\codex-review-a1a3.md:4213:+| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
docs\reviews\codex-review-a1a3.md:4420:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\codex-review-a1a3.md:4422:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\codex-review-a1a3.md:4464:+- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
docs\reviews\codex-review-a1a3.md:4477:+-- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\codex-review-a1a3.md:4478:+CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\codex-review-a1a3.md:4553:+-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\reviews\codex-review-a1a3.md:4606:+✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
docs\reviews\codex-review-a1a3.md:4628:+arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
docs\reviews\codex-review-a1a3.md:5203:- `migrator` - NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault once infrastructure lands, scoped to the GitHub OIDC role.
docs\reviews\codex-review-a1a3.md:5208:DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`.
docs\reviews\codex-review-a1a3.md:5223:`app_user` cannot run DDL. `migrator` cannot run DML on tenant tables.
docs\reviews\codex-review-a1a3.md:5258:-- Applied by the `migrator` role. Idempotent.
docs\reviews\codex-review-a1a3.md:5270:-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
docs\reviews\codex-review-a1a3.md:5272:-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\reviews\codex-review-a1a3.md:5289:-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-review-a1a3.md:5290:-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-review-a1a3.md:5291:-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-review-a1a3.md:5295:  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-review-a1a3.md:5296:    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-review-a1a3.md:5297:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-review-a1a3.md:5298:    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-review-a1a3.md:5299:    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\codex-review-a1a3.md:5577:Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` â€” runs before the trigram index, idempotent.
docs\reviews\codex-review-a1a3.md:5607:-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
docs\reviews\codex-review-a1a3.md:5848:> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:410:✓ migration 0066: pg_trgm similarity index > 
docs\reviews\codex-review-a1a3.md:5859:  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:432:arrays, pg_trgm expression, and expression 
docs\reviews\codex-review-a1a3.md:5993:  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1177:| T6: pg_trgm index | Task 1 (Red) → Task 2 
docs\reviews\codex-review-a1a3.md:5994:(Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
docs\reviews\codex-review-a1a3.md:6145:   8: -- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\codex-review-a1a3.md:6146:   9: CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\codex-review-a1a3.md:6222:  85: -- (pg_trgm extension is NOT dropped â€” may be used by other indexes.)
docs\reviews\codex-review-a1a3.md:6569:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "migrator|CREATE ON DATABASE|pg_trgm|extension" -n infra ops packages docs | Select-Object -First 200' in C:\gs-stf-1
docs\reviews\codex-review-a1a3.md:7117:packages\db\src\migrations\0066_products_storefront_columns.sql:9:CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\runbooks\sync-recovery.md:33:-- Run as migrator role or superuser
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:98:### 4.1 Schema extension — `packages/db/src/schema/shop-users.ts`
docs\superpowers\specs\2026-05-06-story-a1a3-storefront-schema.md:63:Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — runs before the trigram index, idempotent.
docs\superpowers\specs\2026-05-06-story-a1a3-storefront-schema.md:93:-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
docs\superpowers\specs\2026-05-06-story-a1a3-storefront-schema.md:242:| T6 | `'pg_trgm index used by similarity'` | `EXPLAIN (FORMAT JSON) SELECT id FROM products WHERE (coalesce(sku,'')||' '||coalesce(metal,'')||' '||coalesce(purity,'')) % 'AB-1042'` → plan JSON contains `products_search_trgm_idx` |
docs\reviews\codex-pr1.md:600:+- MVP infra cost floor drops from ~$200/mo to ~$20/mo — 10× runway extension on the same funding.
docs\reviews\codex-pr1.md:909:+- `migrator` — NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault (Infrastructure Story), scoped to GitHub OIDC role.
docs\reviews\codex-pr1.md:913:+DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`. DML happens through `withTenantTx(pool, fn)` (never direct `pool.query`) under `app_user`. `app_user` cannot run DDL; `migrator` cannot run DML on tenant tables.
docs\reviews\codex-pr1.md:1626:-resource "aws_secretsmanager_secret" "db_migrator" {
docs\reviews\codex-pr1.md:1627:-  name       = "${var.env}/goldsmith/db/migrator"
docs\reviews\codex-pr1.md:1644:-output "db_migrator_secret"   { value = aws_secretsmanager_secret.db_migrator.arn }
docs\reviews\codex-pr1.md:2912:+-- Applied by the `migrator` role. Idempotent.
docs\reviews\codex-pr1.md:2924:+-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
docs\reviews\codex-pr1.md:2926:+-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\reviews\codex-pr1.md:3023:+-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-pr1.md:3024:+-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-pr1.md:3025:+-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-pr1.md:3029:+  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-pr1.md:3030:+    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-pr1.md:3031:+    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-pr1.md:3032:+    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-pr1.md:3033:+    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\codex-pr1.md:4484:+    const migratorDml = await c.query(
docs\reviews\codex-pr1.md:4486:+        WHERE grantee='migrator' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
docs\reviews\codex-pr1.md:4489:+    for (const row of migratorDml.rows as Array<{ table_name: string; privilege_type: string }>) {
docs\reviews\codex-pr1.md:4492:+        fails.push(`migrator has ${row.privilege_type} on tenant table ${row.table_name} (invariant 5)`);
docs\reviews\codex-pr1.md:14802:-- Applied by the `migrator` role. Idempotent.
docs\reviews\codex-pr1.md:14814:-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
docs\reviews\codex-pr1.md:14816:-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\reviews\codex-pr1.md:14901:-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-pr1.md:14902:-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-pr1.md:14903:-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-pr1.md:14907:  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-pr1.md:14908:    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-pr1.md:14909:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-pr1.md:14910:    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-pr1.md:14911:    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\storefront-a1a3.diff:196:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\storefront-a1a3.diff:198:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\storefront-a1a3.diff:204:+      await client.query('SET pg_trgm.similarity_threshold = 0.1');
docs\reviews\storefront-a1a3.diff:218:+      await client.query('RESET pg_trgm.similarity_threshold');
docs\reviews\storefront-a1a3.diff:4201:+| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
docs\reviews\storefront-a1a3.diff:4408:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\storefront-a1a3.diff:4410:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\storefront-a1a3.diff:4452:+- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
docs\reviews\storefront-a1a3.diff:4465:+-- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\storefront-a1a3.diff:4466:+CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\storefront-a1a3.diff:4541:+-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\reviews\storefront-a1a3.diff:4594:+✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
docs\reviews\storefront-a1a3.diff:4616:+arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
docs\reviews\storefront-a1a3.diff:5361:+| T6: pg_trgm index | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
docs\reviews\storefront-a1a3.diff:5738:+Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — runs before the trigram index, idempotent.
docs\reviews\storefront-a1a3.diff:5768:+-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
docs\reviews\storefront-a1a3.diff:5917:+| T6 | `'pg_trgm index used by similarity'` | `EXPLAIN (FORMAT JSON) SELECT id FROM products WHERE (coalesce(sku,'')||' '||coalesce(metal,'')||' '||coalesce(purity,'')) % 'AB-1042'` → plan JSON contains `products_search_trgm_idx` |
docs\reviews\storefront-a1a3.diff:5978:+-- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\storefront-a1a3.diff:5979:+CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\storefront-a1a3.diff:6055:+-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:90:     - **`migrator`** — NOSUPERUSER NOBYPASSRLS; DDL grants only; zero DML on tenant tables. Used by Drizzle migrate CLI in CI/CD. Credential stored in AWS Secrets Manager + scoped to GitHub Actions OIDC-assumed role (never on developer machines).
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:113:docs/db-workflow.md           # developer-facing guide for migrator → app_user flow
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:188:| 5 | `migrator` has zero `SELECT/UPDATE/DELETE/INSERT` on any `tenantScopedTable` | `schema-assertions.ts` against `information_schema.table_privileges` |
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:243:- **Given** `migrator` role credentials, **when** a user tries `SELECT * FROM shop_users`, **then** PostgreSQL returns permission denied.
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:254:- ✅ `migrator` separate, DDL-only
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:137:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:431:## Storage adapter — extension
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:612:| Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:623:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:624:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
docs\superpowers\specs\2026-04-19-story-2.3-design.md:219:| Weight precision | existing harness extension | wastage % applied to DECIMAL gross weight → net weight at 4dp precision |
docs\reviews\codex-20260423-1657.md:4789:packages/db/src/migrations\0002_grants.sql:22:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-20260423-1657.md:4809:-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-20260423-1657.md:4810:-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-20260423-1657.md:4811:-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-20260423-1657.md:4815:  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-20260423-1657.md:4816:    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-20260423-1657.md:4817:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-20260423-1657.md:4818:    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-20260423-1657.md:4819:    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\codex-20260423-1657.md:5354:packages/db/src/migrations\0003_auth_link.sql:12:-- PRODUCTION NOTE: granting BYPASSRLS requires SUPERUSER. If the migrator role is
docs\reviews\codex-20260423-1657.md:5369:packages/db/src/migrations\0000_roles.sql:16:-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\superpowers\specs\2026-04-19-story-2.2-design.md:276:| WS-A Data | `making-charges.schema.ts` in shared + exports + SettingsCache extension |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:216: ## Storage adapter — extension
docs\reviews\codex-story-17.1-spec-round6-20260501.md:386: | Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:397: | **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:398: | **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:747: ## Storage adapter — extension
docs\superpowers\specs\2026-04-30-wave5a-customer-web-design.md:314:| Branding storage | `shops.config` JSONB + `shops.logo_url` | No migration needed; `config` JSONB is the intended extension point |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:136: ## Storage adapter — extension
docs\reviews\codex-story-17.1-spec-round5-20260501.md:314: | Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:325: | **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:326: | **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:538:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\reviews\codex-story-17.1-spec-round5-20260501.md:548:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\reviews\codex-story-17.1-spec-round5-20260501.md:788:## Storage adapter Г?" extension
docs\reviews\codex-story-17.1-spec-round5-20260501.md:966:| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:977:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:978:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1165:| Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1176:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:68:### Task 1: DB schema extension + migration
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1242:### Task 7: Tenant-isolation walker extension
docs\reviews\codex-story-17.1-spec-round4-20260501.md:399:   pure DDL, no DML" with a note about the migrator role constraint.
docs\reviews\codex-story-17.1-spec-round4-20260501.md:430:`ImageKitTransformUrlBuilder` Aú adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:437:`ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:442:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:451:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:454:ú `ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:459:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:464:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:473:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:475:`deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:516:`ImageKitTransformUrlBuilder` Aú adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:523:`ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:528:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:537:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:540:ú `ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:545:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:550:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:559:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:561:`deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1209:| PHP webshell with .jpg extension  400 |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1213:(DROP TABLE + CREATE TABLE - pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) ú Drizzle 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1217:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1220:endpoints + 1 public catalog endpoint) ú audit-action enum extension ú 5 MB body interceptor ú service unit tests 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1294:(DROP TABLE + CREATE TABLE - pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) ú Drizzle 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1298:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1489:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1499:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1739:## Storage adapter Г?" extension
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1891:| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1902:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1903:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2108:## Storage adapter ƒ?" extension
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2233:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2236:public catalog endpoint) Aú audit-action enum extension Aú 5 MB body interceptor Aú service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2289:`deleteBlob` extension |
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:614:## Task 3: Auth data model migration + Drizzle schema extensions
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:624:> Note on ordering: Task 2 creates migration `0004`. Task 3 creates `0003` which must apply BEFORE `0004`. File timestamps alone don't order migrations — Drizzle's migrator reads lexical filename order, so `0003_auth_link.sql` applies before `0004_rls_fail_loud.sql` regardless of commit order. Safe to author `0004` first.
docs\reviews\codex-story-17.1-spec-round8-20260501.md:676:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\reviews\codex-story-17.1-spec-round8-20260501.md:686:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\reviews\codex-story-17.1-spec-round8-20260501.md:980:## Storage adapter Г?" extension
docs\reviews\codex-story-17.1-spec-round8-20260501.md:1161:| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
docs\reviews\codex-story-17.1-spec-round8-20260501.md:1172:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round8-20260501.md:1173:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:17:| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:224:// T6 — pg_trgm GIN index used by similarity search
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:226:describe('migration 0066: pg_trgm similarity index', () => {
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:268:- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:281:-- pg_trgm required before trigram GIN index. Idempotent.
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:282:CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:357:-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:410:✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:432:arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1177:| T6: pg_trgm index | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
rg: infra: The system cannot find the file specified. (os error 2)

 exited 1 in 2201ms:
docs\threat-model.md:165:| **S** | App connects as superuser, bypasses RLS | App role is `app_user` with `NOSUPERUSER NOBYPASSRLS`; migrations run as separate `migrator` role | LOW | ADR-0002 enforced; CI verifies `pg_roles` on every deploy |
docs\threat-model.md:173:| **E** | App exploits weak `CREATE FUNCTION` or `CREATE EXTENSION` to bypass RLS | `app_user` has no `CREATE` rights; extensions gated to `migrator` role | LOW | |
docs\runbook.md:109:3. Run database migrations with the migrator role.
docs\runbook.md:523:No action needed — Testcontainers + local Docker Postgres run the migrator as `postgres`
docs\prd-addendum-customer-storefront.md:92:> **Addendum:** Customer-storefront capabilities FR127–FR140 + completion notes for FR86/88/90/93/96/104/105 + NFR-SE-1/SE-2/IMG-1 are recorded in `docs/prd-addendum-customer-storefront.md`. The original 126-FR / 70-NFR list below is the historical MVP capability contract; the addendum is the post-feature-complete extension.
docs\db-workflow.md:6:- `migrator` - NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault once infrastructure lands, scoped to the GitHub OIDC role.
docs\db-workflow.md:11:DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`.
docs\db-workflow.md:26:`app_user` cannot run DDL. `migrator` cannot run DML on tenant tables.
docs\reviews\codex-review-a1a3.md:208:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\codex-review-a1a3.md:210:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\codex-review-a1a3.md:216:+      await client.query('SET pg_trgm.similarity_threshold = 0.1');
docs\reviews\codex-review-a1a3.md:230:+      await client.query('RESET pg_trgm.similarity_threshold');
docs\reviews\codex-review-a1a3.md:4213:+| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
docs\reviews\codex-review-a1a3.md:4420:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\codex-review-a1a3.md:4422:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\codex-review-a1a3.md:4464:+- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
docs\reviews\codex-review-a1a3.md:4477:+-- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\codex-review-a1a3.md:4478:+CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\codex-review-a1a3.md:4553:+-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\reviews\codex-review-a1a3.md:4606:+✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
docs\reviews\codex-review-a1a3.md:4628:+arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
docs\reviews\codex-review-a1a3.md:5203:- `migrator` - NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault once infrastructure lands, scoped to the GitHub OIDC role.
docs\reviews\codex-review-a1a3.md:5208:DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`.
docs\reviews\codex-review-a1a3.md:5223:`app_user` cannot run DDL. `migrator` cannot run DML on tenant tables.
docs\reviews\codex-review-a1a3.md:5258:-- Applied by the `migrator` role. Idempotent.
docs\reviews\codex-review-a1a3.md:5270:-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
docs\reviews\codex-review-a1a3.md:5272:-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\reviews\codex-review-a1a3.md:5289:-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-review-a1a3.md:5290:-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-review-a1a3.md:5291:-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-review-a1a3.md:5295:  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-review-a1a3.md:5296:    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-review-a1a3.md:5297:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-review-a1a3.md:5298:    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-review-a1a3.md:5299:    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\codex-review-a1a3.md:5577:Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` â€” runs before the trigram index, idempotent.
docs\reviews\codex-review-a1a3.md:5607:-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
docs\reviews\codex-review-a1a3.md:5848:> docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:410:✓ migration 0066: pg_trgm similarity index > 
docs\reviews\codex-review-a1a3.md:5859:  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:432:arrays, pg_trgm expression, and expression 
docs\reviews\codex-review-a1a3.md:5993:  docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1177:| T6: pg_trgm index | Task 1 (Red) → Task 2 
docs\reviews\codex-review-a1a3.md:5994:(Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
docs\reviews\codex-review-a1a3.md:6145:   8: -- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\codex-review-a1a3.md:6146:   9: CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\codex-review-a1a3.md:6222:  85: -- (pg_trgm extension is NOT dropped â€” may be used by other indexes.)
docs\reviews\codex-review-a1a3.md:6569:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg "migrator|CREATE ON DATABASE|pg_trgm|extension" -n infra ops packages docs | Select-Object -First 200' in C:\gs-stf-1
docs\reviews\codex-review-a1a3.md:7117:packages\db\src\migrations\0066_products_storefront_columns.sql:9:CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\runbooks\sync-recovery.md:33:-- Run as migrator role or superuser
docs\superpowers\specs\2026-04-19-story-1.2-staff-invite-design.md:98:### 4.1 Schema extension — `packages/db/src/schema/shop-users.ts`
docs\superpowers\specs\2026-05-06-story-a1a3-storefront-schema.md:63:Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — runs before the trigram index, idempotent.
docs\superpowers\specs\2026-05-06-story-a1a3-storefront-schema.md:93:-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
docs\superpowers\specs\2026-05-06-story-a1a3-storefront-schema.md:242:| T6 | `'pg_trgm index used by similarity'` | `EXPLAIN (FORMAT JSON) SELECT id FROM products WHERE (coalesce(sku,'')||' '||coalesce(metal,'')||' '||coalesce(purity,'')) % 'AB-1042'` → plan JSON contains `products_search_trgm_idx` |
docs\reviews\codex-pr1.md:600:+- MVP infra cost floor drops from ~$200/mo to ~$20/mo — 10× runway extension on the same funding.
docs\reviews\codex-pr1.md:909:+- `migrator` — NOSUPERUSER NOBYPASSRLS; DDL only. Used by `pnpm -F @goldsmith/db exec tsx src/migrate.ts` in CI/CD. Credential from Azure Key Vault (Infrastructure Story), scoped to GitHub OIDC role.
docs\reviews\codex-pr1.md:913:+DDL happens in numbered SQL migrations (`packages/db/src/migrations/*.sql`), applied by `migrator`. DML happens through `withTenantTx(pool, fn)` (never direct `pool.query`) under `app_user`. `app_user` cannot run DDL; `migrator` cannot run DML on tenant tables.
docs\reviews\codex-pr1.md:1626:-resource "aws_secretsmanager_secret" "db_migrator" {
docs\reviews\codex-pr1.md:1627:-  name       = "${var.env}/goldsmith/db/migrator"
docs\reviews\codex-pr1.md:1644:-output "db_migrator_secret"   { value = aws_secretsmanager_secret.db_migrator.arn }
docs\reviews\codex-pr1.md:2912:+-- Applied by the `migrator` role. Idempotent.
docs\reviews\codex-pr1.md:2924:+-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
docs\reviews\codex-pr1.md:2926:+-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\reviews\codex-pr1.md:3023:+-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-pr1.md:3024:+-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-pr1.md:3025:+-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-pr1.md:3029:+  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-pr1.md:3030:+    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-pr1.md:3031:+    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-pr1.md:3032:+    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-pr1.md:3033:+    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\codex-pr1.md:4484:+    const migratorDml = await c.query(
docs\reviews\codex-pr1.md:4486:+        WHERE grantee='migrator' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
docs\reviews\codex-pr1.md:4489:+    for (const row of migratorDml.rows as Array<{ table_name: string; privilege_type: string }>) {
docs\reviews\codex-pr1.md:4492:+        fails.push(`migrator has ${row.privilege_type} on tenant table ${row.table_name} (invariant 5)`);
docs\reviews\codex-pr1.md:14802:-- Applied by the `migrator` role. Idempotent.
docs\reviews\codex-pr1.md:14814:-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
docs\reviews\codex-pr1.md:14816:-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\reviews\codex-pr1.md:14901:-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-pr1.md:14902:-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-pr1.md:14903:-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-pr1.md:14907:  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-pr1.md:14908:    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-pr1.md:14909:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-pr1.md:14910:    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-pr1.md:14911:    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\storefront-a1a3.diff:196:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\storefront-a1a3.diff:198:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\storefront-a1a3.diff:204:+      await client.query('SET pg_trgm.similarity_threshold = 0.1');
docs\reviews\storefront-a1a3.diff:218:+      await client.query('RESET pg_trgm.similarity_threshold');
docs\reviews\storefront-a1a3.diff:4201:+| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
docs\reviews\storefront-a1a3.diff:4408:+// T6 — pg_trgm GIN index used by similarity search
docs\reviews\storefront-a1a3.diff:4410:+describe('migration 0066: pg_trgm similarity index', () => {
docs\reviews\storefront-a1a3.diff:4452:+- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
docs\reviews\storefront-a1a3.diff:4465:+-- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\storefront-a1a3.diff:4466:+CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\storefront-a1a3.diff:4541:+-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\reviews\storefront-a1a3.diff:4594:+✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
docs\reviews\storefront-a1a3.diff:4616:+arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
docs\reviews\storefront-a1a3.diff:5361:+| T6: pg_trgm index | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
docs\reviews\storefront-a1a3.diff:5738:+Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — runs before the trigram index, idempotent.
docs\reviews\storefront-a1a3.diff:5768:+-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
docs\reviews\storefront-a1a3.diff:5917:+| T6 | `'pg_trgm index used by similarity'` | `EXPLAIN (FORMAT JSON) SELECT id FROM products WHERE (coalesce(sku,'')||' '||coalesce(metal,'')||' '||coalesce(purity,'')) % 'AB-1042'` → plan JSON contains `products_search_trgm_idx` |
docs\reviews\storefront-a1a3.diff:5978:+-- pg_trgm required before trigram GIN index. Idempotent.
docs\reviews\storefront-a1a3.diff:5979:+CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\reviews\storefront-a1a3.diff:6055:+-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:90:     - **`migrator`** — NOSUPERUSER NOBYPASSRLS; DDL grants only; zero DML on tenant tables. Used by Drizzle migrate CLI in CI/CD. Credential stored in AWS Secrets Manager + scoped to GitHub Actions OIDC-assumed role (never on developer machines).
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:113:docs/db-workflow.md           # developer-facing guide for migrator → app_user flow
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:188:| 5 | `migrator` has zero `SELECT/UPDATE/DELETE/INSERT` on any `tenantScopedTable` | `schema-assertions.ts` against `information_schema.table_privileges` |
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:243:- **Given** `migrator` role credentials, **when** a user tries `SELECT * FROM shop_users`, **then** PostgreSQL returns permission denied.
docs\superpowers\specs\2026-04-18-E2-S1-tenant-rls-scaffolding-design.md:254:- ✅ `migrator` separate, DDL-only
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:127:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:137:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:431:## Storage adapter — extension
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:612:| Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:623:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\superpowers\specs\2026-05-01-story-17.1-image-pipeline-design.md:624:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
docs\superpowers\specs\2026-04-19-story-2.3-design.md:219:| Weight precision | existing harness extension | wastage % applied to DECIMAL gross weight → net weight at 4dp precision |
docs\reviews\codex-20260423-1657.md:4789:packages/db/src/migrations\0002_grants.sql:22:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-20260423-1657.md:4809:-- migrator: DDL only, zero DML on tenant tables (invariant 5)
docs\reviews\codex-20260423-1657.md:4810:-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
docs\reviews\codex-20260423-1657.md:4811:-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
docs\reviews\codex-20260423-1657.md:4815:  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
docs\reviews\codex-20260423-1657.md:4816:    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
docs\reviews\codex-20260423-1657.md:4817:    REVOKE ALL ON shops        FROM migrator;
docs\reviews\codex-20260423-1657.md:4818:    REVOKE ALL ON shop_users   FROM migrator;
docs\reviews\codex-20260423-1657.md:4819:    REVOKE ALL ON audit_events FROM migrator;
docs\reviews\codex-20260423-1657.md:5354:packages/db/src/migrations\0003_auth_link.sql:12:-- PRODUCTION NOTE: granting BYPASSRLS requires SUPERUSER. If the migrator role is
docs\reviews\codex-20260423-1657.md:5369:packages/db/src/migrations\0000_roles.sql:16:-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.
docs\superpowers\specs\2026-04-19-story-2.2-design.md:276:| WS-A Data | `making-charges.schema.ts` in shared + exports + SettingsCache extension |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:216: ## Storage adapter — extension
docs\reviews\codex-story-17.1-spec-round6-20260501.md:386: | Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:397: | **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:398: | **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round6-20260501.md:747: ## Storage adapter — extension
docs\superpowers\specs\2026-04-30-wave5a-customer-web-design.md:314:| Branding storage | `shops.config` JSONB + `shops.logo_url` | No migration needed; `config` JSONB is the intended extension point |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:136: ## Storage adapter — extension
docs\reviews\codex-story-17.1-spec-round5-20260501.md:314: | Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:325: | **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:326: | **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) · `ProductImagesRepository` · `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) · audit-action enum extension · 5 MB body interceptor · service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:538:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\reviews\codex-story-17.1-spec-round5-20260501.md:548:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\reviews\codex-story-17.1-spec-round5-20260501.md:788:## Storage adapter Г?" extension
docs\reviews\codex-story-17.1-spec-round5-20260501.md:966:| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:977:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:978:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1165:| Security: malicious MIME | covered above | PHP webshell with .jpg extension → 400 |
docs\reviews\codex-story-17.1-spec-round5-20260501.md:1176:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE — pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) · Drizzle schema update · **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** · `MalwareScanPort` + stub · `StubStorageAdapter` real local-disk impl · `AzureBlobStorageAdapter` impl · `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) · adapter unit tests · `deleteBlob` extension |
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:68:### Task 1: DB schema extension + migration
docs\superpowers\plans\2026-04-19-story-1.2-staff-invite.md:1242:### Task 7: Tenant-isolation walker extension
docs\reviews\codex-story-17.1-spec-round4-20260501.md:399:   pure DDL, no DML" with a note about the migrator role constraint.
docs\reviews\codex-story-17.1-spec-round4-20260501.md:430:`ImageKitTransformUrlBuilder` Aú adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:437:`ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:442:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:451:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:454:ú `ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:459:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:464:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:473:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:475:`deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:516:`ImageKitTransformUrlBuilder` Aú adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:523:`ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:528:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:537:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:540:ú `ImageKitTransformUrlBuilder` ú adapter unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:545:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:550:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:559:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:561:`deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1209:| PHP webshell with .jpg extension  400 |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1213:(DROP TABLE + CREATE TABLE - pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) ú Drizzle 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1217:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1220:endpoints + 1 public catalog endpoint) ú audit-action enum extension ú 5 MB body interceptor ú service unit tests 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1294:(DROP TABLE + CREATE TABLE - pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) ú Drizzle 
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1298:unit tests ú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1489:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1499:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1739:## Storage adapter Г?" extension
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1891:| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1902:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:1903:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2108:## Storage adapter ƒ?" extension
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2233:adapter unit tests Aú `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2236:public catalog endpoint) Aú audit-action enum extension Aú 5 MB body interceptor Aú service unit tests (TDD) |
docs\reviews\codex-story-17.1-spec-round4-20260501.md:2289:`deleteBlob` extension |
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:614:## Task 3: Auth data model migration + Drizzle schema extensions
docs\superpowers\plans\2026-04-18-story-1.1-auth-and-dashboard.md:624:> Note on ordering: Task 2 creates migration `0004`. Task 3 creates `0003` which must apply BEFORE `0004`. File timestamps alone don't order migrations — Drizzle's migrator reads lexical filename order, so `0003_auth_link.sql` applies before `0004_rls_fail_loud.sql` regardless of commit order. Safe to author `0004` first.
docs\reviews\codex-story-17.1-spec-round8-20260501.md:676:**Why drop-and-recreate instead of ALTER + DML cleanup:** per `docs/db-workflow.md`, the `migrator` role is `NOSUPERUSER NOBYPASSRLS` with **DDL-only** privileges and explicitly forbidden from running DML on tenant tables. Backfills must run as separate `tsx` scripts under `app_user` + `withTenantTx`, never inside `.sql` migrations. Adding NOT NULL columns to a table with NULL-incompatible existing rows would fail; cleanup-via-DELETE inside the migration is forbidden by the migrator role definition. Drop-and-recreate is pure DDL, allowed for `migrator`, and correct because:
docs\reviews\codex-story-17.1-spec-round8-20260501.md:686:-- DDL-only (migrator role compatible). No DML inside .sql migrations
docs\reviews\codex-story-17.1-spec-round8-20260501.md:980:## Storage adapter Г?" extension
docs\reviews\codex-story-17.1-spec-round8-20260501.md:1161:| Security: malicious MIME | covered above | PHP webshell with .jpg extension Г+' 400 |
docs\reviews\codex-story-17.1-spec-round8-20260501.md:1172:| **WS-A Data + storage** | Migration 0057 (DROP TABLE + CREATE TABLE Г?" pure DDL, no DML; matches `docs/db-workflow.md` migrator role constraints) A· Drizzle schema update A· **retire legacy `inventory.service.getImageUploadUrl` + `inventory.controller` handler + `inventory.repository.insertImageRecord` + their tests** A· `MalwareScanPort` + stub A· `StubStorageAdapter` real local-disk impl A· `AzureBlobStorageAdapter` impl A· `ImageKitTransformUrlBuilder` (always emits `mb-0.25`) A· adapter unit tests A· `deleteBlob` extension |
docs\reviews\codex-story-17.1-spec-round8-20260501.md:1173:| **WS-B API** | `ProductImagesService` (upload / delete / reorder / setAltText / list) A· `ProductImagesRepository` A· `ProductImagesController` (4 shopkeeper endpoints + 1 public catalog endpoint) A· audit-action enum extension A· 5 MB body interceptor A· service unit tests (TDD) |
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:17:| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:224:// T6 — pg_trgm GIN index used by similarity search
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:226:describe('migration 0066: pg_trgm similarity index', () => {
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:268:- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:281:-- pg_trgm required before trigram GIN index. Idempotent.
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:282:CREATE EXTENSION IF NOT EXISTS pg_trgm;
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:357:-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:410:✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:432:arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
docs\superpowers\plans\2026-05-06-story-a1a3-storefront-schema.md:1177:| T6: pg_trgm index | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
rg: infra: The system cannot find the file specified. (os error 2)

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content docs/reviews/codex-review-a1a3.md | Select-Object -First 120' in C:\gs-stf-1
 succeeded in 2550ms:
OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\gs-stf-1
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR, C:\Users\alokt\.codex\memories]
reasoning effort: xhigh
reasoning summaries: none
session id: 019dfe97-d288-7eb1-881b-289778a3c60d
--------
user
diff --git a/apps/api/test/storefront-schema-0066.integration.spec.ts b/apps/api/test/storefront-schema-0066.integration.spec.ts
new file mode 100644
index 0000000..d150102
--- /dev/null
+++ b/apps/api/test/storefront-schema-0066.integration.spec.ts
@@ -0,0 +1,216 @@
+// apps/api/test/storefront-schema-0066.integration.spec.ts
+//
+// Mandatory spec tests T3â€“T6 + weight-column invariant.
+// UUID prefix cc4xxxxx â€” non-overlapping with other test files.
+
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
+import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
+
+// ---------------------------------------------------------------------------
+// Fixture UUIDs â€” non-overlapping with other integration test files
+// ---------------------------------------------------------------------------
+const SHOP_A = 'cc400001-cc00-4000-cc00-000000000001';
+
+const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0066-a', display_name: '0066 Shop A', status: 'ACTIVE' };
+const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+let userAId: string;
+let productAId: string;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
+
+  // Seed shop via raw connection (no RLS on shops table from admin path)
+  const c = await pool.connect();
+  try {
+    await c.query(
+      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'stf-0066-a', '0066 Shop A', 'ACTIVE')`,
+      [SHOP_A],
+    );
+  } finally {
+    c.release();
+  }
+
+  // Seed shop_admin user
+  userAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
+           VALUES ($1, '+919400000101', 'Owner 0066', 'shop_admin', 'ACTIVE') RETURNING id`,
+        [SHOP_A],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+
+  // Seed a published product for index smoke tests (partial indexes filter published_at IS NOT NULL)
+  productAId = await tenantContext.runWith(ctxA, () =>
+    withTenantTx(pool, async (tx) => {
+      const r = await tx.query<{ id: string }>(
+        `INSERT INTO products
+           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
+            status, created_by_user_id, published_at, published_by_user_id)
+         VALUES
+           ($1, 'STF0066-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000',
+            'IN_STOCK', $2, NOW(), $2)
+         RETURNING id`,
+        [SHOP_A, userAId],
+      );
+      return r.rows[0]!.id;
+    }),
+  );
+}, 180_000);
+
+afterAll(async () => {
+  await pool?.end();
+  await container?.stop();
+});
+
+// ---------------------------------------------------------------------------
+// T3 â€” CHECK constraint blocks invalid style
+// ---------------------------------------------------------------------------
+describe('migration 0066: style CHECK constraint', () => {
+  it('rejects style = UNKNOWN with CHECK violation (23514)', async () => {
+    await expect(
+      tenantContext.runWith(ctxA, () =>
+        withTenantTx(pool, (tx) =>
+          tx.query(`UPDATE products SET style = 'UNKNOWN' WHERE id = $1`, [productAId]),
+        ),
+      ),
+    ).rejects.toMatchObject({ code: '23514' });
+  });
+
+  it('accepts every valid style value without error', async () => {
+    const validStyles = [
+      'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
+      'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS',
+    ];
+    for (const style of validStyles) {
+      await expect(
+        tenantContext.runWith(ctxA, () =>
+          withTenantTx(pool, (tx) =>
+            tx.query(`UPDATE products SET style = $1 WHERE id = $2`, [style, productAId]),
+          ),
+        ),

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path docs/reviews/codex-review-a1a3.md -Pattern '\"findings\"|P1|P2|overall_correctness' -Context 0,2 | Select-Object -First 50" in C:\gs-stf-1
 succeeded in 1108ms:

> docs\reviews\codex-review-a1a3.md:600:+          { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K', weight_g: 
'5.000',
  docs\reviews\codex-review-a1a3.md:601:+            cost_paise: '5000000', created_at: new Date(Date.now() - 10 * 
86400_000), days_in_stock: 10, bucket: '<30d' },
> docs\reviews\codex-review-a1a3.md:602:+          { id: 'p2', sku: 'R-002', metal: 'GOLD', purity: '22K', weight_g: 
'3.000',
  docs\reviews\codex-review-a1a3.md:603:+            cost_paise: '3000000', created_at: new Date(Date.now() - 20 * 
86400_000), days_in_stock: 20, bucket: '<30d' },
  docs\reviews\codex-review-a1a3.md:604:+          // 30-60d
> docs\reviews\codex-review-a1a3.md:1275:+        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
  docs\reviews\codex-review-a1a3.md:1276:+          weightG: '5.000', daysInStock: 10, bucket: '<30d',
  docs\reviews\codex-review-a1a3.md:1277:+          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
> docs\reviews\codex-review-a1a3.md:1278:+        { id: 'p2', sku: 'C-002', metal: 'GOLD', purity: '22K',
  docs\reviews\codex-review-a1a3.md:1279:+          weightG: '4.000', daysInStock: 75, bucket: '60-90d',
  docs\reviews\codex-review-a1a3.md:1280:+          costPaise: null, firstListedAt: '2026-02-15T00:00:00.000Z' },
> docs\reviews\codex-review-a1a3.md:2554:+        { id: 'p1', sku: 'R-001', metal: 'GOLD', purity: '22K',
  docs\reviews\codex-review-a1a3.md:2555:+          weightG: '5.000', daysInStock: 10, bucket: '<30d',
  docs\reviews\codex-review-a1a3.md:2556:+          costPaise: '5000000', firstListedAt: '2026-04-15T00:00:00.000Z' },
> docs\reviews\codex-review-a1a3.md:4169:+Expected: both write `.claude-review-passed` and `.security-review-passed` 
markers, no P0/P1 findings.
  docs\reviews\codex-review-a1a3.md:4170:+
  docs\reviews\codex-review-a1a3.md:4171:+- [ ] **Push**
> docs\reviews\codex-review-a1a3.md:6320:apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.service.spec.ts
:287:      product_ids: ['p1', 'p2'], status: 'REQUESTED',
  docs\reviews\codex-review-a1a3.md:6321:apps/api/src\modules\billing\billing.service.loyalty.spec.ts:79:          
product_id: it.productId, description: it.description, hsn_code: it.hsnCode,
  
docs\reviews\codex-review-a1a3.md:6322:apps/api/src\modules\try-at-home-bookings\try-at-home-bookings.repository.ts:9: 
 product_ids:  string[];
> docs\reviews\codex-review-a1a3.md:6380:  /** F6-server (Codex P2): server-built thumbnail URL via ImageKit builder.
  docs\reviews\codex-review-a1a3.md:6381:   *  Mobile consumes this directly â€” no client-side URL construction. */
  docs\reviews\codex-review-a1a3.md:6382:  thumbnail_url: string;
> docs\reviews\codex-review-a1a3.md:7103:"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 
"Select-String -Path docs/reviews/codex-review-a1a3.md -Pattern '\"findings\"|P1|P2|overall_correctness' -Context 0,2 
| Select-Object -First 50" in C:\gs-stf-1
  docs\reviews\codex-review-a1a3.md:7104:         opts.scanStatus ?? 'clean',
  docs\reviews\codex-review-a1a3.md:7105:  C:\gs-stf-1\apps\api\test\storefront-schema-0068.integration.spec.ts:55:    
      opts.sortOrder ?? 0,



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/catalog/catalog.service.ts | Select-Object -First 520' in C:\gs-stf-1
 succeeded in 7614ms:
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withShopTx } from '@goldsmith/db';
import { PricingService } from '../pricing/pricing.service';
import type { CurrentRatesResult } from '../pricing/pricing.service';
import { computeProductPrice } from '@goldsmith/money';
import type { PriceBreakdown } from '@goldsmith/money';
import { MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';
import type { MakingChargeConfig } from '@goldsmith/shared';
import { SettingsRepository } from '../settings/settings.repository';
import {
  IMAGEKIT_URL_BUILDER,
  ImageKitTransformUrlBuilder,
} from '@goldsmith/integrations-storage';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface TenantConfigResponse {
  shopId:          string;
  primaryColor:    string;
  logoUrl:         string | null;
  appName:         string;
  defaultLanguage: string;
}

export interface EstimatedPrice {
  totalFormatted: string;
  totalPaise:     string;
  breakdown: {
    goldValuePaise:    string;
    makingChargePaise: string;
    gstMetalPaise:     string;
    gstMakingPaise:    string;
  };
}

export interface CatalogProduct {
  id:                    string;
  sku:                   string;
  metal:                 string;
  purity:                string;
  categoryId:            string | null;
  categoryName:          string | null;
  grossWeightG:          string;
  netWeightG:            string;
  huid:                  string | null;
  huidExemptionCategory: string;
  quantity:              number;
  priceAvailable:        boolean;
  estimatedPrice?:       EstimatedPrice;
  publishedAt:           string;
}

export interface CatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page:  number;
}

export interface GetProductsParams {
  shopId:      string;
  categoryId?: string;
  search?:     string;
  metal?:      string;
  page:        number;
  limit:       number;
}

export interface HuidVerifyResult {
  verified:       boolean;
  huid:           string;
  certifyingBody: string;
}

// ---------------------------------------------------------------------------
// Story 17.1 â€” Task 7: Public image DTO (F6-server)
// MUST NOT contain storage_key â€” leaking internal blob paths is a security issue.
// All URLs are built server-side via ImageKitTransformUrlBuilder so mobile/web
// never construct ImageKit URLs client-side (NFR-IMG-1 enforcement).
// ---------------------------------------------------------------------------

export interface PublicImageRow {
  id:              string;
  alt_text:        string | null;
  width:           number;
  height:          number;
  /** 4-candidate srcset: 320w, 640w, 1024w, 1920w */
  srcset:          string;
  /** w=1024 default for <img src> fallback */
  default_url:     string;
  /** w=200, blur=30 for LQIP/progressive reveal */
  placeholder_url: string;
}

// ---------------------------------------------------------------------------
// HUID QR parsing helpers
// ---------------------------------------------------------------------------

// Boundary: the 6-char HUID must be followed by a non-alphanumeric char or end-of-string.
// This prevents `AB1234ZZ` from matching as `AB1234`.
const HUID_BOUNDARY = '(?=[^A-Za-z0-9]|$)';

function parseHuidFromQr(payload: string): string | null {
  const trimmed = payload.trim();
  // BIS URL format: ?huid=AB1234 or &huid=AB1234
  const queryMatch = trimmed.match(new RegExp(`[?&]huid=([A-Za-z0-9]{6})${HUID_BOUNDARY}`, 'i'));
  if (queryMatch) return queryMatch[1].toUpperCase();
  // Path format: /huid/AB1234
  const pathMatch = trimmed.match(new RegExp(`\\/huid\\/([A-Za-z0-9]{6})${HUID_BOUNDARY}`, 'i'));
  if (pathMatch) return pathMatch[1].toUpperCase();
  // HUID: prefix
  const prefixMatch = trimmed.match(new RegExp(`^HUID:([A-Za-z0-9]{6})${HUID_BOUNDARY}`, 'i'));
  if (prefixMatch) return prefixMatch[1].toUpperCase();
  // Raw 6-char alphanumeric
  if (/^[A-Za-z0-9]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

function certifyingBodyFromQr(payload: string): string {
  if (/bis\.gov\.in/i.test(payload)) return 'BIS';
  if (/jewel\.bis/i.test(payload)) return 'BIS';
  return 'BIS';
}

// ---------------------------------------------------------------------------
// Internal DB row shapes (exported for testing)
// ---------------------------------------------------------------------------

interface ShopRow {
  id:           string;
  display_name: string;
  logo_url:     string | null;
  config:       Record<string, unknown> | null;
}

export interface ProductCatalogRow {
  id:                        string;
  sku:                       string;
  metal:                     string;
  purity:                    string;
  category_id:               string | null;
  category_name:             string | null;
  gross_weight_g:            string;
  net_weight_g:              string;
  making_charge_override_pct: string | null;
  huid:                      string | null;
  huid_exemption_category:   string;
  quantity:                  number;
  published_at:              Date;
  total_count:               string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CatalogService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(SettingsRepository) private readonly settingsRepo: SettingsRepository,
    @Inject(IMAGEKIT_URL_BUILDER) private readonly urlBuilder: ImageKitTransformUrlBuilder,
  ) {}

  async getTenantConfig(slug: string): Promise<TenantConfigResponse> {
    const r = await this.pool.query<ShopRow>(
      `SELECT id, display_name, logo_url, config
         FROM shops
        WHERE slug = $1 AND status = 'ACTIVE'`,
      [slug],
    );
    if (r.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.shop_not_found' });
    }
    const row = r.rows[0];
    return {
      shopId:          row.id,
      primaryColor:    (row.config?.['primaryColor'] as string | undefined) ?? '#B58A3C',
      logoUrl:         row.logo_url ?? null,
      appName:         row.display_name,
      defaultLanguage: (row.config?.['defaultLanguage'] as string | undefined) ?? 'hi',
    };
  }

  async getProducts(params: GetProductsParams): Promise<CatalogProductsResponse> {
    const { shopId, categoryId, search, metal, page, limit } = params;
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset    = (safePage - 1) * safeLimit;

    const queryParams: unknown[] = [shopId];
    let whereExtra = '';

    if (categoryId) {
      queryParams.push(categoryId);
      whereExtra += ` AND p.category_id = $${queryParams.length}`;
    }
    if (metal && metal.trim().length > 0) {
      queryParams.push(metal.trim().toUpperCase());
      whereExtra += ` AND p.metal = $${queryParams.length}`;
    }
    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      queryParams.push(term);
      const idx = queryParams.length;
      whereExtra += ` AND (p.sku ILIKE $${idx} OR p.metal ILIKE $${idx} OR p.purity ILIKE $${idx})`;
    }

    queryParams.push(safeLimit, offset);
    const limitIdx  = queryParams.length - 1;
    const offsetIdx = queryParams.length;

    // EXISTS guard: suspended/terminated tenants must not surface products via the public
    // catalog. Without this, anyone holding a (cached) shop_id can keep fetching after
    // plaexec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem apps -Recurse -Filter '*catalog*service*.ts' | Select-Object -ExpandProperty FullName; Get-ChildItem apps/api/src -Recurse -Filter '*catalog*' | Select-Object -ExpandProperty FullName" in C:\gs-stf-1
 succeeded in 2128ms:
C:\gs-stf-1\apps\api\dist\modules\catalog\catalog.service.d.ts
C:\gs-stf-1\apps\api\dist\modules\catalog\catalog.service.spec.d.ts
C:\gs-stf-1\apps\api\src\modules\catalog\catalog.service.spec.ts
C:\gs-stf-1\apps\api\src\modules\catalog\catalog.service.ts
C:\gs-stf-1\apps\api\src\modules\catalog
C:\gs-stf-1\apps\api\src\modules\catalog\catalog.controller.spec.ts
C:\gs-stf-1\apps\api\src\modules\catalog\catalog.controller.ts
C:\gs-stf-1\apps\api\src\modules\catalog\catalog.module.ts
C:\gs-stf-1\apps\api\src\modules\catalog\catalog.service.spec.ts
C:\gs-stf-1\apps\api\src\modules\catalog\catalog.service.ts

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content apps/api/src/modules/catalog/catalog.service.ts | Select-String -Pattern 'products|occasion|gift|primary_image|published|search|ANY|@>' -Context 0,4" in C:\gs-stf-1
 succeeded in 1521ms:

>   publishedAt:           string;
  }
  
> export interface CatalogProductsResponse {
    items: CatalogProduct[];
    total: number;
    page:  number;
  }
> export interface GetProductsParams {
    shopId:      string;
    categoryId?: string;
>   search?:     string;
    metal?:      string;
    page:        number;
    limit:       number;
  }
>   published_at:              Date;
    total_count:               string;
  }
  
  // ---------------------------------------------------------------------------
>   async getProducts(params: GetProductsParams): Promise<CatalogProductsResponse> {
>     const { shopId, categoryId, search, metal, page, limit } = params;
      const safePage  = Math.max(1, page);
      const safeLimit = Math.min(50, Math.max(1, limit));
      const offset    = (safePage - 1) * safeLimit;
  
>     if (search && search.trim().length > 0) {
>       const term = `%${search.trim()}%`;
        queryParams.push(term);
        const idx = queryParams.length;
        whereExtra += ` AND (p.sku ILIKE $${idx} OR p.metal ILIKE $${idx} OR p.purity ILIKE $${idx})`;
      }
>     // EXISTS guard: suspended/terminated tenants must not surface products via the public
>     // catalog. Without this, anyone holding a (cached) shop_id can keep fetching after
      // platform admin suspends the tenant.
      const sql = `
        SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
               pc.name AS category_name,
>              p.huid, p.huid_exemption_category, p.quantity, p.published_at,
               COUNT(*) OVER() AS total_count
>         FROM products p
          LEFT JOIN product_categories pc ON pc.id = p.category_id
         WHERE p.shop_id = $1
           AND EXISTS (SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE')
>          AND p.published_at IS NOT NULL
           ${whereExtra}
>        ORDER BY p.published_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;
  
      const [ratesResult, scopedResult] = await Promise.all([
>         const [mcResult, productsResult] = await Promise.all([
            tx.query<{ making_charges_json: MakingChargeConfig[] | null }>(
              `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
              [shopId],
            ),
>         return { mcResult, productsResult };
        }),
      ]);
>     const { mcResult, productsResult } = scopedResult;
  
      const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
      const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));
  
>     const total = productsResult.rows.length > 0 ? Number(productsResult.rows[0].total_count) : 0;
  
>     const items: CatalogProduct[] = productsResult.rows.map((row) =>
        this.computeCatalogProduct(row, ratesResult, mcMap),
      );
  
      return { items, total, page: safePage };
>                     p.huid, p.huid_exemption_category, p.quantity, p.published_at,
                      '1' AS total_count
>                FROM products p
                LEFT JOIN product_categories pc ON pc.id = p.category_id
               WHERE p.id = $1 AND p.shop_id = $2
                 AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
>                AND p.published_at IS NOT NULL`,
              [id, shopId],
            ),
          ]);
          return { mcResult, productResult };
>         `SELECT huid FROM products
            WHERE id = $1 AND shop_id = $2
              AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
>             AND published_at IS NOT NULL`,
          [productId, shopId],
        ),
      );
      if (r.rows.length === 0) {
>       publishedAt:           row.published_at.toISOString(),
      };
    }
  
    // ---------------------------------------------------------------------------
>     // Only show images for published products of ACTIVE shops (security guard).
>     // "Published" = products.published_at IS NOT NULL (set by publishProduct() in
>     // inventory.service). The products.status column is independent of publish state
      // and must not be used as the publish gate.
      const r = await withShopTx(this.pool, shopId, async (tx) =>
        tx.query<{
          id: string; alt_text: string | null; width: number; height: number; storage_key: string;
>            JOIN products p ON p.id = pi.product_id
            WHERE pi.product_id = $1
              AND pi.shop_id = $2
>             AND p.published_at IS NOT NULL
              AND EXISTS (SELECT 1 FROM shops WHERE id = $2 AND status = 'ACTIVE')
            ORDER BY pi.sort_order ASC, pi.created_at ASC`,
          [productId, shopId],
        ),



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content apps/api/src/modules/inventory/product-images.repository.ts; Get-Content apps/api/src/modules/inventory/product-images.service.ts | Select-String -Pattern 'product_id|sort_order|scan_status|DELETE|UPDATE' -Context 1,3" in C:\gs-stf-1
 succeeded in 3330ms:
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';

type Tx = Pick<PoolClient, 'query'>;

export type ImageRow = {
  id: string;
  shop_id: string;
  product_id: string;
  storage_key: string;
  alt_text: string | null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  exif_stripped_at: string;
  uploaded_by_user_id: string;
  scan_status: 'pending' | 'clean' | 'rejected';
  sort_order: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  /** F6-server (Codex P2): server-built thumbnail URL via ImageKit builder.
   *  Mobile consumes this directly â€” no client-side URL construction. */
  thumbnail_url: string;
};

export type InsertImageInput = {
  productId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sortOrder: number;
  altText: string | null;
  uploadedByUserId: string;
  idempotencyKey: string | null;
};

const SELECT_COLS = `
  id, shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
  width, height, exif_stripped_at, uploaded_by_user_id, scan_status,
  sort_order, idempotency_key, created_at, updated_at
`.trim();

@Injectable()
export class ProductImagesRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Tenant-scoped product existence check + pessimistic row lock.
   * Returns null on miss (cross-tenant attempt OR not found).
   *
   * The FOR UPDATE lock serializes concurrent uploads for the same product,
   * making the 10-image cap inviolable. The composite FK from migration 0058
   * is the schema-layer defense; this method is the explicit serialization
   * point inside the upload transaction.
   *
   * Per ADR-0005 the shop scope comes from `tenantContext`, not a parameter.
   */
  async lockProductForTenant(tx: Tx, productId: string): Promise<{ id: string } | null> {
    const { shopId } = tenantContext.requireCurrent();
    const r = await tx.query<{ id: string }>(
      `SELECT id FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
      [productId, shopId],
    );
    return r.rows[0] ?? null;
  }

  async countImagesInTx(tx: Tx, productId: string): Promise<number> {
    const r = await tx.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
      [productId],
    );
    return parseInt(r.rows[0]?.count ?? '0', 10);
  }

  async nextSortOrderInTx(tx: Tx, productId: string): Promise<number> {
    const r = await tx.query<{ next: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
      [productId],
    );
    return r.rows[0]?.next ?? 0;
  }

  /**
   * F7 service-layer idempotency lookup. Caller (ProductImagesService.upload)
   * runs this BEFORE attempting INSERT; if it finds a row, returns it as the
   * replay. Partial UNIQUE index `product_images_idempotency_uniq` (migration
   * 0058) is the race-loser backstop.
   */
  async findByIdempotencyKeyInTx(tx: Tx, productId: string, idempotencyKey: string): Promise<ImageRow | null> {
    const r = await tx.query<ImageRow>(
      `SELECT ${SELECT_COLS}
         FROM product_images
        WHERE product_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [productId, idempotencyKey],
    );
    return r.rows[0] ?? null;
  }

  async insertImageInTx(tx: Tx, input: InsertImageInput): Promise<ImageRow> {
    const { shopId } = tenantContext.requireCurrent();
    const r = await tx.query<ImageRow>(
      `INSERT INTO product_images
         (shop_id, product_id, storage_key, alt_text, mime_type, byte_size,
          width, height, exif_stripped_at, uploaded_by_user_id, scan_status,
          sort_order, idempotency_key)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, 'clean', $10, $11)
       RETURNING ${SELECT_COLS}`,
      [
        shopId, input.productId, input.storageKey, input.altText,
        input.mimeType, input.byteSize, input.width, input.height,
        input.uploadedByUserId, input.sortOrder, input.idempotencyKey,
      ],
    );
    return r.rows[0]!;
  }

  /** Public read path. RLS scopes by shop_id via withTenantTx. */
  async listForProduct(productId: string): Promise<ImageRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ImageRow>(
        `SELECT ${SELECT_COLS}
           FROM product_images
          WHERE product_id = $1
          ORDER BY sort_order ASC, created_at ASC`,
        [productId],
      );
      return r.rows;
    });
  }

  async deleteImage(productId: string, imageId: string): Promise<{ storageKey: string } |codex
The migration adds useful storefront fields, but the primary image integrity constraint is incomplete and the SQL backfill will not work under the repository's intended RLS-protected migrator flow. These issues can leave products with wrong or missing primary images.

Full review comments:

- [P2] Enforce product ownership on primary_image_id — C:\gs-stf-1\packages\db\src\migrations\0068_products_primary_image.sql:32-33
  When a shop has two products, this constraint still accepts product A's `primary_image_id` being set to product B's image because it only matches `(shop_id, id)` on `product_images`; `product_id` is not part of the referenced key. Since `app_user` already has UPDATE on `products`, any buggy tenant-scoped SQL/admin path can persist a primary image for the wrong product and the trigger will not correct it until that product's own images change. Include the product's `id` in the FK target or validate this relationship in a trigger.

- [P2] Run the primary-image backfill with tenant scope — C:\gs-stf-1\packages\db\src\migrations\0068_products_primary_image.sql:37-37
  When existing clean images are present, this backfill is tenant-table DML but migrations are documented to run as the NOBYPASSRLS migrator without a tenant GUC; because `products` and `product_images` have FORCE RLS, the statement sees no tenant rows (or only the poison tenant from `createPool`) and silently leaves `primary_image_id` null outside the Testcontainers superuser path. Run the backfill per shop via `withShopTx`/`app_user` or a reviewed platform-admin path.
2026-05-06T18:47:53.093969Z ERROR codex_core::session: failed to record rollout items: thread 019dfe91-f58c-7fd1-aa6e-273f31aa64ea not found
2026-05-06T18:47:53.337631Z ERROR codex_core::session: failed to record rollout items: thread 019dfe91-f336-7cd2-a822-509c59858da8 not found
The migration adds useful storefront fields, but the primary image integrity constraint is incomplete and the SQL backfill will not work under the repository's intended RLS-protected migrator flow. These issues can leave products with wrong or missing primary images.

Full review comments:

- [P2] Enforce product ownership on primary_image_id — C:\gs-stf-1\packages\db\src\migrations\0068_products_primary_image.sql:32-33
  When a shop has two products, this constraint still accepts product A's `primary_image_id` being set to product B's image because it only matches `(shop_id, id)` on `product_images`; `product_id` is not part of the referenced key. Since `app_user` already has UPDATE on `products`, any buggy tenant-scoped SQL/admin path can persist a primary image for the wrong product and the trigger will not correct it until that product's own images change. Include the product's `id` in the FK target or validate this relationship in a trigger.

- [P2] Run the primary-image backfill with tenant scope — C:\gs-stf-1\packages\db\src\migrations\0068_products_primary_image.sql:37-37
  When existing clean images are present, this backfill is tenant-table DML but migrations are documented to run as the NOBYPASSRLS migrator without a tenant GUC; because `products` and `product_images` have FORCE RLS, the statement sees no tenant rows (or only the poison tenant from `createPool`) and silently leaves `primary_image_id` null outside the Testcontainers superuser path. Run the backfill per shop via `withShopTx`/`app_user` or a reviewed platform-admin path.
efore we try the blob.
>     this.storage.deleteBlob(result.storageKey).catch(() => undefined);
      void auditLog(this.pool, {
>       action: AuditAction.PRODUCT_IMAGE_DELETED,
        subjectType: 'product_image',
        subjectId: imageId,
        actorUserId: userId,
      // The repo's set-equality check (size + membership) admits ['img-1','img-1']
>     // for a single-image product, which would then UPDATE the same row twice
>     // with conflicting sort_order values. Guard with Set comparison up front.
      const unique = new Set(orderedIds);
      if (unique.size !== orderedIds.length) {
        throw new BadRequestException({ code: 'ORDER_LIST_DUPLICATES' });



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/migrations/0013_shops_revoke_app_user_write.sql' in C:\gs-stf-1
 succeeded in 1148ms:
-- 0013_shops_revoke_app_user_write.sql
-- The `shops` table is platform-global (SELECT only, no RLS) for reads, but
-- shopkeepers must be able to UPDATE their own shop row (profile updates).
-- To prevent cross-tenant UPDATE leakage we enable RLS on shops for UPDATE
-- only: app_user may only UPDATE the row whose id matches app.current_shop_id.
--
-- INSERT and DELETE remain superuser/platform_admin only.
-- SELECT remains unrestricted (platform-global read is intentional â€” auth
-- lookups need to read all shops).

-- Column-level UPDATE on shops for app_user (shopkeeper profile edits only).
-- Sensitive columns (slug, status, kek_key_arn, config) are intentionally
-- excluded â€” only platform_admin can change those.
GRANT UPDATE (
  display_name, address_json, gstin, bis_registration, contact_phone,
  operating_hours_json, about_text, logo_url, years_in_business, updated_at
) ON shops TO app_user;

-- Enable RLS on shops and force it even for table owners.
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops FORCE ROW LEVEL SECURITY;

-- SELECT: platform-global â€” app_user can read any shop (auth lookups).
DROP POLICY IF EXISTS rls_shops_select ON shops;
CREATE POLICY rls_shops_select ON shops
  FOR SELECT
  USING (true);

-- UPDATE: tenant-scoped â€” app_user may only UPDATE its own shop row.
DROP POLICY IF EXISTS rls_shops_update ON shops;
CREATE POLICY rls_shops_update ON shops
  FOR UPDATE
  USING (id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (id = current_setting('app.current_shop_id', true)::uuid);

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content packages/db/src/migrations/0066_products_storefront_columns.sql | ForEach-Object { '"'{0,4}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 25 -First 35' in C:\gs-stf-1
 succeeded in 3776ms:
  26: 
  27: -- Style: partial BTree â€” used by /products?style=JHUMKA filter.
  28: CREATE INDEX products_style_idx
  29:   ON products (shop_id, style)
  30:   WHERE published_at IS NOT NULL;
  31: 
  32: -- Occasion + gift_persona: GIN â€” used by ANY(occasion) / ANY(gift_persona) filters.
  33: CREATE INDEX products_occasion_gin_idx
  34:   ON products USING GIN (occasion);
  35: 
  36: CREATE INDEX products_gift_persona_gin_idx
  37:   ON products USING GIN (gift_persona);
  38: 
  39: -- Featured: partial BTree â€” used by /catalog/products/featured endpoint.
  40: CREATE INDEX products_featured_idx
  41:   ON products (shop_id, featured_score DESC)
  42:   WHERE published_at IS NOT NULL AND featured_score > 0;
  43: 
  44: -- Price snapshot: partial BTree â€” used by priceMin/priceMax filter.
  45: CREATE INDEX products_price_snapshot_idx
  46:   ON products (shop_id, price_snapshot_paise)
  47:   WHERE price_snapshot_paise IS NOT NULL AND published_at IS NOT NULL;
  48: 
  49: -- Top-sellers: expression BTree â€” ORDER BY (sales_count_30d * 2 + view_count_30d) DESC.
  50: CREATE INDEX products_top_sellers_idx
  51:   ON products (shop_id, (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC)
  52:   WHERE published_at IS NOT NULL;
  53: 
  54: -- Trigram search: GIN gin_trgm_ops â€” WHERE (...concatenation...) % 'query'.
  55: -- Non-partial so it is unambiguously chosen by the planner for trgm similarity
  56: -- queries regardless of other partial BTree indexes on this table.
  57: CREATE INDEX products_search_trgm_idx
  58:   ON products USING GIN (
  59:     (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, ''))
  60:     gin_trgm_ops

codex
The schema migration leaves `products.primary_image_id` stale for same-tenant image reparenting, an update path already allowed by existing product_images constraints/tests. This can make products display the wrong primary image and interfere with later image deletion.

Review comment:

- [P2] Recompute primary images when images move products — C:\gs-stf-1\packages\db\src\migrations\0068_products_primary_image.sql:112-114
  When an existing clean image is reparented inside the same shop (which the current product-images FK tests allow via `UPDATE product_images SET product_id = ...`), the INSERT trigger has already made it the old product's primary. This trigger doesn't fire for `product_id` updates, so the old product keeps pointing at an image now owned by another product and later deletes can be blocked by the FK. Include `product_id` changes and recompute both OLD and NEW products.
2026-05-06T18:49:26.471838Z ERROR codex_core::session: failed to record rollout items: thread 019dfe97-d31d-7a33-8c4c-16995fed6826 not found
2026-05-06T18:49:26.696044Z ERROR codex_core::session: failed to record rollout items: thread 019dfe97-d288-7eb1-881b-289778a3c60d not found
The schema migration leaves `products.primary_image_id` stale for same-tenant image reparenting, an update path already allowed by existing product_images constraints/tests. This can make products display the wrong primary image and interfere with later image deletion.

Review comment:

- [P2] Recompute primary images when images move products — C:\gs-stf-1\packages\db\src\migrations\0068_products_primary_image.sql:112-114
  When an existing clean image is reparented inside the same shop (which the current product-images FK tests allow via `UPDATE product_images SET product_id = ...`), the INSERT trigger has already made it the old product's primary. This trigger doesn't fire for `product_id` updates, so the old product keeps pointing at an image now owned by another product and later deletes can be blocked by the FK. Include `product_id` changes and recompute both OLD and NEW products.
