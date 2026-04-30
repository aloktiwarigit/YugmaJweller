# Product Viewing Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add product view tracking (FR64–68) so shopkeepers can see which products customers view most.

**Architecture:** Four work streams in sequence — migration → service (with consent gate + 30s session dedup) → API layer (public POST record + authenticated GET summary) → mobile analytics screen. The analytics service manages its own pool connection (no tenant interceptor on the public endpoint) via a private `withShopTx` helper that mirrors `withTenantTx` but accepts shopId explicitly.

**Tech Stack:** PostgreSQL (raw SQL migration), NestJS, `pg` Pool, TanStack Query, React Native + react-native-svg (already in `apps/shopkeeper/package.json`).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/src/migrations/0043_product_views.sql` | Create | product_views table with RLS + index |
| `apps/api/src/modules/analytics/analytics.service.ts` | Create | recordView (consent gate, 30s dedup) + getProductViewSummary |
| `apps/api/src/modules/analytics/analytics.service.spec.ts` | Create | Unit tests: 4 scenarios from spec |
| `apps/api/src/modules/analytics/analytics.module.ts` | Create | NestJS module — imports AuthModule (for PG_POOL), exports AnalyticsService |
| `apps/api/src/modules/analytics/analytics.controller.ts` | Create | GET /api/v1/analytics/products/:id/views |
| `apps/api/src/modules/catalog/catalog.controller.ts` | Modify | Add POST /api/v1/catalog/products/:id/view (public) |
| `apps/api/src/modules/catalog/catalog.module.ts` | Modify | Import AnalyticsModule |
| `apps/api/src/app.module.ts` | Modify | Import AnalyticsModule |
| `apps/shopkeeper/src/features/inventory/analytics/useProductAnalytics.ts` | Create | TanStack Query hook for analytics data |
| `apps/shopkeeper/app/inventory/[id]/analytics.tsx` | Create | ProductAnalyticsScreen |
| `apps/shopkeeper/app/inventory/_layout.tsx` | Modify | Register analytics screen in Stack |

---

## WS-A: Migration 0043

### Task 1: Write and verify the product_views migration

**Files:**
- Create: `packages/db/src/migrations/0043_product_views.sql`

- [ ] **Step 1: Write the migration**

```sql
-- packages/db/src/migrations/0043_product_views.sql
-- Story viewing-analytics: product_views event table (FR64-68).
-- Consent gate is enforced at write time by analytics.service.ts.
-- Anonymous views (customer_id IS NULL) are always allowed.

CREATE TABLE product_views (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID        NOT NULL REFERENCES shops(id),
  product_id       UUID        NOT NULL REFERENCES products(id),
  customer_id      UUID,
  session_id       UUID        NOT NULL,
  viewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER
);

ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_views FORCE ROW LEVEL SECURITY;

CREATE POLICY product_views_tenant ON product_views
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT ON product_views TO app_user;

CREATE INDEX idx_product_views_product_time
  ON product_views (product_id, viewed_at DESC);

CREATE INDEX idx_product_views_session
  ON product_views (session_id, product_id, viewed_at DESC);
```

- [ ] **Step 2: Commit**

```bash
cd C:/gs-analytics
git add packages/db/src/migrations/0043_product_views.sql
git commit -m "feat(analytics): migration 0043 — product_views table with RLS"
```

---

## WS-B: AnalyticsService + Tests

### Task 2: Write failing tests for the analytics service

**Files:**
- Create: `apps/api/src/modules/analytics/analytics.service.spec.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
// apps/api/src/modules/analytics/analytics.service.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { AnalyticsService } from './analytics.service';

const SHOP    = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const PRODUCT = 'bbbbbbbb-cccc-4000-8000-000000000002';
const SESSION = 'cccccccc-dddd-4000-8000-000000000003';
const CUSTOMER = 'dddddddd-eeee-4000-8000-000000000004';

// Mock pool client — tracks query calls so we can assert inserts/selects.
function makeMockClient() {
  const queryFn = vi.fn();
  return {
    query: queryFn,
    release: vi.fn(),
  };
}

function makePool(client: ReturnType<typeof makeMockClient>) {
  return {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as import('pg').Pool;
}

function makeService(pool: import('pg').Pool): AnalyticsService {
  return new AnalyticsService(pool);
}

// Helper: make client respond to a sequence of queries.
// Queries run in order: BEGIN, SET ROLE, SET shop_id, consent SELECT, dedup SELECT, INSERT, COMMIT.
function setupClientForInsert(
  client: ReturnType<typeof makeMockClient>,
  {
    consentRow,
    dedupRow,
  }: { consentRow?: { consent_given: boolean }; dedupRow?: { id: string } },
) {
  // q0 BEGIN, q1 SET ROLE, q2 SET shop, q3 consent query, q4 dedup query, q5 INSERT, q6 COMMIT, q7 ROLLBACK (finally)
  const queryMock = client.query as Mock;
  queryMock
    .mockResolvedValueOnce(undefined) // BEGIN
    .mockResolvedValueOnce(undefined) // SET LOCAL ROLE
    .mockResolvedValueOnce(undefined) // SET LOCAL shop_id
    .mockResolvedValueOnce({ rows: consentRow ? [consentRow] : [] }) // consent check
    .mockResolvedValueOnce({ rows: dedupRow ? [dedupRow] : [] })     // dedup check
    .mockResolvedValueOnce(undefined) // INSERT
    .mockResolvedValueOnce(undefined) // COMMIT
    .mockResolvedValue(undefined);    // POISON reset (finally)
}

function setupClientForInsertAnonymous(client: ReturnType<typeof makeMockClient>) {
  const queryMock = client.query as Mock;
  queryMock
    .mockResolvedValueOnce(undefined) // BEGIN
    .mockResolvedValueOnce(undefined) // SET LOCAL ROLE
    .mockResolvedValueOnce(undefined) // SET LOCAL shop_id
    // no consent query for anonymous
    .mockResolvedValueOnce({ rows: [] }) // dedup check
    .mockResolvedValueOnce(undefined)    // INSERT
    .mockResolvedValueOnce(undefined)    // COMMIT
    .mockResolvedValue(undefined);       // POISON reset
}

describe('AnalyticsService.recordView', () => {
  it('inserts a row when consent is given (authenticated view)', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: { consent_given: true }, dedupRow: undefined });
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeDefined();
  });

  it('does NOT insert when customer has no consent row', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: undefined }); // empty rows = no consent
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('does NOT insert when consent row exists but consent_given=false', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: { consent_given: false } });
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('does NOT insert when same session viewed same product within 30s', async () => {
    const client = makeMockClient();
    setupClientForInsert(client, { consentRow: { consent_given: true }, dedupRow: { id: SESSION } });
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, customerId: CUSTOMER, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('inserts for anonymous (null customerId) without consent check', async () => {
    const client = makeMockClient();
    setupClientForInsertAnonymous(client);
    const svc = makeService(makePool(client));

    await svc.recordView({ shopId: SHOP, productId: PRODUCT, sessionId: SESSION });

    const insertCall = (client.query as Mock).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO product_views'),
    );
    expect(insertCall).toBeDefined();
  });
});

describe('AnalyticsService.getProductViewSummary', () => {
  it('returns parsed aggregates for the requested period', async () => {
    const client = makeMockClient();
    const queryMock = client.query as Mock;
    queryMock
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET LOCAL ROLE
      .mockResolvedValueOnce(undefined) // SET LOCAL shop_id
      .mockResolvedValueOnce({
        rows: [{ total_views: '42', unique_viewers: '17', avg_duration_seconds: '12.5' }],
      })                                // aggregate SELECT
      .mockResolvedValueOnce(undefined) // COMMIT
      .mockResolvedValue(undefined);    // POISON reset

    const svc = makeService(makePool(client));
    const result = await svc.getProductViewSummary({ shopId: SHOP, productId: PRODUCT, days: 30 });

    expect(result).toEqual({ totalViews: 42, uniqueViewers: 17, avgDurationSeconds: 12.5 });
  });

  it('returns null avgDurationSeconds when no durations recorded', async () => {
    const client = makeMockClient();
    const queryMock = client.query as Mock;
    queryMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [{ total_views: '0', unique_viewers: '0', avg_duration_seconds: null }],
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(undefined);

    const svc = makeService(makePool(client));
    const result = await svc.getProductViewSummary({ shopId: SHOP, productId: PRODUCT, days: 90 });

    expect(result.avgDurationSeconds).toBeNull();
    expect(result.totalViews).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail with "cannot find module"**

```bash
cd C:/gs-analytics
pnpm --filter @goldsmith/api test apps/api/src/modules/analytics/analytics.service.spec.ts 2>&1 | tail -15
```

Expected: FAIL — module `./analytics.service` not found.

### Task 3: Implement AnalyticsService

**Files:**
- Create: `apps/api/src/modules/analytics/analytics.service.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// apps/api/src/modules/analytics/analytics.service.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { POISON_UUID } from '@goldsmith/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RecordViewParams {
  shopId: string;
  productId: string;
  customerId?: string;
  sessionId: string;
  durationSeconds?: number;
}

export interface ViewSummary {
  totalViews: number;
  uniqueViewers: number;
  avgDurationSeconds: number | null;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async recordView(params: RecordViewParams): Promise<void> {
    if (!UUID_RE.test(params.shopId) || !UUID_RE.test(params.productId) || !UUID_RE.test(params.sessionId)) {
      return; // silently ignore malformed IDs — this is a fire-and-forget event
    }
    if (params.customerId !== undefined && !UUID_RE.test(params.customerId)) {
      return;
    }

    await this.withShopTx(params.shopId, async (tx) => {
      // Consent gate: skip check for anonymous (null customerId)
      if (params.customerId !== undefined) {
        const consent = await tx.query<{ consent_given: boolean }>(
          // nosemgrep: goldsmith.require-tenant-transaction
          `SELECT consent_given FROM viewing_consent
           WHERE shop_id = $1 AND customer_id = $2`,
          [params.shopId, params.customerId],
        );
        if (!consent.rows[0]?.consent_given) return;
      }

      // 30-second session dedup — same session_id + product in last 30s = skip
      const recent = await tx.query<{ id: string }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT id FROM product_views
         WHERE session_id = $1 AND product_id = $2
           AND viewed_at > NOW() - INTERVAL '30 seconds'
         LIMIT 1`,
        [params.sessionId, params.productId],
      );
      if (recent.rows.length > 0) return;

      await tx.query(
        // nosemgrep: goldsmith.require-tenant-transaction
        `INSERT INTO product_views (shop_id, product_id, customer_id, session_id, duration_seconds)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          params.shopId,
          params.productId,
          params.customerId ?? null,
          params.sessionId,
          params.durationSeconds ?? null,
        ],
      );
    });
  }

  async getProductViewSummary(params: {
    shopId: string;
    productId: string;
    days: 30 | 90 | 365;
  }): Promise<ViewSummary> {
    return this.withShopTx(params.shopId, async (tx) => {
      const r = await tx.query<{
        total_views: string;
        unique_viewers: string;
        avg_duration_seconds: string | null;
      }>(
        // nosemgrep: goldsmith.require-tenant-transaction
        `SELECT
           COUNT(*)::text                    AS total_views,
           COUNT(DISTINCT session_id)::text  AS unique_viewers,
           AVG(duration_seconds)::text       AS avg_duration_seconds
         FROM product_views
         WHERE product_id = $1
           AND viewed_at > NOW() - INTERVAL '1 day' * $2`,
        [params.productId, params.days],
      );
      const row = r.rows[0]!;
      return {
        totalViews:         parseInt(row.total_views, 10),
        uniqueViewers:      parseInt(row.unique_viewers, 10),
        avgDurationSeconds: row.avg_duration_seconds !== null ? parseFloat(row.avg_duration_seconds) : null,
      };
    });
  }

  private async withShopTx<T>(shopId: string, fn: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_user');
      await client.query(`SET LOCAL app.current_shop_id = '${shopId}'`);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      await client.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
      client.release();
    }
  }
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
cd C:/gs-analytics
pnpm --filter @goldsmith/api test apps/api/src/modules/analytics/analytics.service.spec.ts 2>&1 | tail -20
```

Expected: 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd C:/gs-analytics
git add apps/api/src/modules/analytics/analytics.service.ts \
        apps/api/src/modules/analytics/analytics.service.spec.ts
git commit -m "feat(analytics): AnalyticsService — recordView with consent gate + 30s dedup, getProductViewSummary"
```

---

## WS-C: API Layer

### Task 4: Create AnalyticsModule + AnalyticsController

**Files:**
- Create: `apps/api/src/modules/analytics/analytics.module.ts`
- Create: `apps/api/src/modules/analytics/analytics.controller.ts`

- [ ] **Step 1: Write analytics.module.ts**

```typescript
// apps/api/src/modules/analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
```

- [ ] **Step 2: Write analytics.controller.ts**

```typescript
// apps/api/src/modules/analytics/analytics.controller.ts
import { Controller, Get, Param, ParseUUIDPipe, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import type { ViewSummary } from './analytics.service';

export interface MultiPeriodViewSummary {
  '30d': ViewSummary;
  '90d': ViewSummary;
  '365d': ViewSummary;
}

@Controller('/api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('products/:id/views')
  @Roles('shop_admin', 'shop_manager')
  async getProductViews(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @TenantContextDec() ctx: TenantContext,
  ): Promise<MultiPeriodViewSummary> {
    if (!ctx.authenticated) {
      throw new Error('auth.not_authenticated');
    }
    const shopId = ctx.shopId;

    const [d30, d90, d365] = await Promise.all([
      this.svc.getProductViewSummary({ shopId, productId, days: 30 }),
      this.svc.getProductViewSummary({ shopId, productId, days: 90 }),
      this.svc.getProductViewSummary({ shopId, productId, days: 365 }),
    ]);

    return { '30d': d30, '90d': d90, '365d': d365 };
  }
}
```

- [ ] **Step 3: Wire into app.module.ts**

Add import at the top of `apps/api/src/app.module.ts`:
```typescript
import { AnalyticsModule } from './modules/analytics/analytics.module';
```

Add `AnalyticsModule` to the imports array (after `ReportsModule`):
```typescript
    ReportsModule,
    AnalyticsModule,
```

- [ ] **Step 4: Verify typecheck passes**

```bash
cd C:/gs-analytics
pnpm --filter @goldsmith/api typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
cd C:/gs-analytics
git add apps/api/src/modules/analytics/analytics.module.ts \
        apps/api/src/modules/analytics/analytics.controller.ts \
        apps/api/src/app.module.ts
git commit -m "feat(analytics): AnalyticsModule + GET /analytics/products/:id/views"
```

### Task 5: Add POST /catalog/products/:id/view to CatalogController

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.controller.ts`
- Modify: `apps/api/src/modules/catalog/catalog.module.ts`

- [ ] **Step 1: Update catalog.module.ts to import AnalyticsModule**

Replace the content of `apps/api/src/modules/catalog/catalog.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [PricingModule, AnalyticsModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
```

- [ ] **Step 2: Update catalog.controller.ts — add the POST /view endpoint**

Add these imports to the top of `apps/api/src/modules/catalog/catalog.controller.ts`:
```typescript
import { Controller, Get, Post, Header, Headers, HttpCode, HttpException, HttpStatus, Inject, Ip, Param, ParseUUIDPipe, Body } from '@nestjs/common';
```

Add `AnalyticsService` import after the existing imports:
```typescript
import { AnalyticsService } from '../analytics/analytics.service';
```

Update the constructor to inject `AnalyticsService`:
```typescript
  private readonly viewRateCache = new Map<string, true>();

  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
  ) {}
```

Add the POST endpoint at the end of the class (before the closing `}`):
```typescript
  /**
   * POST /api/v1/catalog/products/:id/view
   * Public — no auth. Records a product view event for the owning shop.
   * Rate-limited: same IP+product blocked for 60s (in-memory Map).
   * Consent gate enforced in AnalyticsService (no insert if customer has no consent row).
   */
  @Post('products/:id/view')
  @HttpCode(204)
  @SkipAuth()
  @SkipTenant()
  async recordProductView(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
    @Ip() ip: string,
    @Body() body: { sessionId?: string; customerId?: string; durationSeconds?: number },
  ): Promise<void> {
    if (!shopId || !body.sessionId) return;

    // IP-level rate limit: same IP + product → max 1 event per 60s
    const rateCacheKey = `${ip}:${productId}`;
    if (this.viewRateCache.has(rateCacheKey)) return;
    this.viewRateCache.set(rateCacheKey, true);
    setTimeout(() => this.viewRateCache.delete(rateCacheKey), 60_000);

    await this.analyticsService.recordView({
      shopId,
      productId,
      customerId: body.customerId,
      sessionId: body.sessionId,
      durationSeconds: body.durationSeconds,
    });
  }
```

- [ ] **Step 3: Verify typecheck**

```bash
cd C:/gs-analytics
pnpm --filter @goldsmith/api typecheck 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 4: Run full API test suite**

```bash
cd C:/gs-analytics
pnpm --filter @goldsmith/api test 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/gs-analytics
git add apps/api/src/modules/catalog/catalog.controller.ts \
        apps/api/src/modules/catalog/catalog.module.ts
git commit -m "feat(analytics): POST /catalog/products/:id/view — public view recorder with IP rate limit"
```

---

## WS-D: Mobile Analytics Screen

### Task 6: useProductAnalytics hook

**Files:**
- Create: `apps/shopkeeper/src/features/inventory/analytics/useProductAnalytics.ts`

- [ ] **Step 1: Write the hook**

```typescript
// apps/shopkeeper/src/features/inventory/analytics/useProductAnalytics.ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../../../api/client';

export interface ViewSummary {
  totalViews: number;
  uniqueViewers: number;
  avgDurationSeconds: number | null;
}

export interface MultiPeriodViewSummary {
  '30d': ViewSummary;
  '90d': ViewSummary;
  '365d': ViewSummary;
}

export function useProductAnalytics(productId: string): UseQueryResult<MultiPeriodViewSummary> {
  return useQuery({
    queryKey: ['analytics', 'product-views', productId],
    queryFn: async () => {
      const res = await api.get<MultiPeriodViewSummary>(
        `/api/v1/analytics/products/${productId}/views`,
      );
      return res.data;
    },
    staleTime: 5 * 60_000, // 5 minutes — analytics data is not live
    enabled: !!productId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/gs-analytics
git add apps/shopkeeper/src/features/inventory/analytics/useProductAnalytics.ts
git commit -m "feat(analytics): useProductAnalytics TanStack Query hook"
```

### Task 7: ProductAnalyticsScreen

**Files:**
- Create: `apps/shopkeeper/app/inventory/[id]/analytics.tsx`
- Modify: `apps/shopkeeper/app/inventory/_layout.tsx`

- [ ] **Step 1: Write the analytics screen**

```typescript
// apps/shopkeeper/app/inventory/[id]/analytics.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Svg, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { colors, spacing, typography, radii } from '@goldsmith/ui-tokens';
import { useProductAnalytics } from '../../../src/features/inventory/analytics/useProductAnalytics';
import type { ViewSummary } from '../../../src/features/inventory/analytics/useProductAnalytics';

type Period = '30d' | '90d' | '365d';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '30d', label: '30 दिन' },
  { key: '90d', label: '90 दिन' },
  { key: '365d', label: '365 दिन' },
];

const CHART_HEIGHT = 180;
const PAD = { top: 20, right: 16, bottom: 36, left: 8 };
const DEFAULT_WIDTH = 320;

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TrendChart({
  data,
  loading,
}: {
  data: MultiPeriodChartPoint[];
  loading: boolean;
}): React.ReactElement {
  const [svgWidth, setSvgWidth] = useState(DEFAULT_WIDTH);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSvgWidth(w);
  }, []);

  if (loading) {
    return (
      <View style={styles.chartPlaceholder} testID="analytics-chart-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (data.length === 0) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.emptyText}>डेटा उपलब्ध नहीं</Text>
      </View>
    );
  }

  const chartW = svgWidth - PAD.left - PAD.right;
  const chartH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const values = data.map((d) => d.totalViews);
  const minV = Math.min(...values);
  const maxV = Math.max(...values) || 1;
  const range = maxV - minV || 1;

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: PAD.top + (1 - (d.totalViews - minV) / range) * chartH,
    label: d.label,
    totalViews: d.totalViews,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View onLayout={onLayout} style={styles.chartWrapper} testID="analytics-chart-svg-container">
      <Svg width={svgWidth} height={CHART_HEIGHT} testID="analytics-chart-svg">
        <Polyline points={polyline} fill="none" stroke={colors.primary} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.primary} testID={`analytics-chart-point-${i}`} />
        ))}
        {points.map((p, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={p.x}
            y={CHART_HEIGHT - 4}
            fill={colors.textSecondary ?? '#888'}
            fontSize={10}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            fontFamily={typography.body.family}
          >
            {p.label}
          </SvgText>
        ))}
        {points.map((p, i) => (
          <SvgText
            key={`val-${i}`}
            x={p.x}
            y={p.y - 8}
            fill={colors.primary ?? '#8B6914'}
            fontSize={10}
            textAnchor="middle"
            fontFamily={typography.body.family}
          >
            {p.totalViews}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

interface MultiPeriodChartPoint {
  label: string;
  totalViews: number;
}

function formatDuration(secs: number | null): string {
  if (secs === null) return '—';
  if (secs < 60) return `${Math.round(secs)} से.`;
  return `${Math.round(secs / 60)} मि.`;
}

export default function ProductAnalyticsScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>('30d');
  const { data, isLoading, error } = useProductAnalytics(id ?? '');

  const chartData: MultiPeriodChartPoint[] = data
    ? PERIOD_OPTIONS.map((p) => ({ label: p.label, totalViews: data[p.key].totalViews }))
    : [];

  const summary: ViewSummary | undefined = data?.[period];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>देखने का विश्लेषण</Text>

      {error ? (
        <Text style={styles.errorText}>लोड नहीं हो सका</Text>
      ) : null}

      {/* Trend chart across all 3 periods */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionLabel}>तीनों अवधि में कुल देखना</Text>
        <TrendChart data={chartData} loading={isLoading} />
      </View>

      {/* Period selector */}
      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {PERIOD_OPTIONS.map((opt) => {
          const active = period === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setPeriod(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Stats for selected period */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : summary ? (
        <View style={styles.statsRow}>
          <StatCard label="कुल बार देखा" value={String(summary.totalViews)} />
          <StatCard label="अनूठे दर्शक" value={String(summary.uniqueViewers)} />
          <StatCard label="औसत समय" value={formatDuration(summary.avgDurationSeconds)} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl ?? 32 },
  heading: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontFamily: 'NotoSansDevanagari_400Regular',
    textAlign: 'center',
    padding: spacing.md,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md ?? 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.sm ?? 8,
  },
  sectionLabel: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs ?? 4,
  },
  chartWrapper: { backgroundColor: colors.white },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.xs ?? 4,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: radii.sm ?? 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  segmentText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
  },
  segmentTextActive: { color: colors.primary, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm ?? 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md ?? 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs ?? 4,
  },
});
```

- [ ] **Step 2: Register analytics screen in inventory layout**

In `apps/shopkeeper/app/inventory/_layout.tsx`, add a `<Stack.Screen>` entry after the existing ones:
```typescript
      <Stack.Screen name="[id]/analytics" options={{ title: 'देखने का विश्लेषण' }} />
```

Full updated file:
```typescript
import React from 'react';
import { Stack } from 'expo-router';
import { t } from '@goldsmith/i18n';

export default function InventoryLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'इन्वेंटरी' }} />
      <Stack.Screen name="new" options={{ title: t('inventory.title_new') }} />
      <Stack.Screen name="[id]/edit" options={{ title: t('inventory.title_edit') }} />
      <Stack.Screen name="print-labels" options={{ title: 'लेबल प्रिंट करें' }} />
      <Stack.Screen name="[id]/analytics" options={{ title: 'देखने का विश्लेषण' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Typecheck the shopkeeper app**

```bash
cd C:/gs-analytics
pnpm --filter @goldsmith/shopkeeper typecheck 2>&1 | tail -15
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd C:/gs-analytics
git add apps/shopkeeper/src/features/inventory/analytics/useProductAnalytics.ts \
        apps/shopkeeper/app/inventory/[id]/analytics.tsx \
        apps/shopkeeper/app/inventory/_layout.tsx
git commit -m "feat(analytics): ProductAnalyticsScreen with trend chart + period stats (FR64-68)"
```

---

## Final Gate

### Task 8: Full typecheck + lint + test

- [ ] **Step 1: Run full checks**

```bash
cd C:/gs-analytics
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -30
```

Expected: 0 typecheck errors, 0 lint errors, all tests pass.

- [ ] **Step 2: Codex review**

```bash
cd C:/gs-analytics
codex review --base main 2>&1 | tail -40
```

Fix any P1/P2 findings before proceeding. Write the passed marker:
```bash
echo "passed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .codex-review-passed
git add .codex-review-passed
git commit -m "chore: codex review passed for viewing-analytics"
```

- [ ] **Step 3: Runtime smoke test**

Start the API in one terminal:
```bash
cd C:/gs-analytics && pnpm --filter @goldsmith/api start:dev
```

In another terminal — fire two POST views with the same sessionId but >30s apart:
```bash
# First view
curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:3000/api/v1/catalog/products/<PRODUCT_UUID>/view \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <SHOP_UUID>" \
  -d '{"sessionId":"<SESSION_UUID>","durationSeconds":15}'
# Expected: 204

# Wait 35 seconds, then second view
sleep 35
curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:3000/api/v1/catalog/products/<PRODUCT_UUID>/view \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <SHOP_UUID>" \
  -d '{"sessionId":"<SESSION_UUID>","durationSeconds":10}'
# Expected: 204

# GET summary — must show totalViews=2 for 365d
curl -s \
  http://localhost:3000/api/v1/analytics/products/<PRODUCT_UUID>/views \
  -H "Authorization: Bearer <SHOPKEEPER_TOKEN>" \
  -H "x-tenant-id: <SHOP_UUID>" | python -m json.tool
# Expected: 365d.totalViews = 2
```

- [ ] **Step 4: git push**

```bash
cd C:/gs-analytics
git push -u origin feat/story-viewing-analytics
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - FR64 product_views table → WS-A migration 0043 ✓
  - FR65 recordView consent gate → WS-B Task 3 ✓
  - FR65 30s session dedup → WS-B Task 3 ✓
  - FR66 POST /catalog/products/:id/view public + IP rate limit → WS-C Task 5 ✓
  - FR67 GET /analytics/products/:id/views (shopkeeper auth) → WS-C Task 4 ✓
  - FR68 ProductAnalyticsScreen chart + stats → WS-D Task 7 ✓
  - Multi-period summary (30d/90d/365d) → Task 4 controller + Task 7 screen ✓
  - anonymous view (null customerId) → Task 3 recordView + Task 2 test ✓

- [x] **No placeholders** — every step has complete code or exact commands.

- [x] **Type consistency**
  - `ViewSummary` defined in `analytics.service.ts`, re-exported as interface in controller.
  - `MultiPeriodViewSummary` used identically in controller and hook.
  - `RecordViewParams` from service used in catalog controller call.

- [x] **Non-negotiables**
  - `product_views` has `shop_id FK + RLS` ✓
  - Anonymous views allowed, logged without consent check ✓
  - Consent required for identified customer views ✓
  - session_id used only for dedup, not identity ✓
  - POST endpoint IP-rate-limited ✓
  - Migration number is exactly 0043 ✓
