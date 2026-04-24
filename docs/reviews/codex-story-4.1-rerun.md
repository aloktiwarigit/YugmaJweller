OpenAI Codex v0.121.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
model: gpt-5.4
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019dbd00-e4c4-7b22-870b-73048279cdcd
--------
user
changes against 'main'
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 44dafa030cc4e7954e69f10237c6501c0db3e93e' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 264ms:
diff --git a/apps/api/package.json b/apps/api/package.json
index a00a644..5f6af23 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -19,10 +19,13 @@
     "@nestjs/common": "^10.3.0",
     "@nestjs/core": "^10.3.0",
     "@nestjs/platform-express": "^10.3.0",
+    "@nestjs/bullmq": "^10.2.0",
+    "bullmq": "^5.7.0",
     "reflect-metadata": "^0.2.0",
     "rxjs": "^7.8.0",
     "@goldsmith/audit": "workspace:*",
     "@goldsmith/db": "workspace:*",
+    "@goldsmith/rates": "workspace:*",
     "@goldsmith/shared": "workspace:*",
     "@goldsmith/tenant-context": "workspace:*",
     "@goldsmith/observability": "workspace:*",
diff --git a/apps/api/src/app.module.ts b/apps/api/src/app.module.ts
index 45a3a49..d2d4dd7 100644
--- a/apps/api/src/app.module.ts
+++ b/apps/api/src/app.module.ts
@@ -1,5 +1,6 @@
 import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
 import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
+import { BullModule } from '@nestjs/bullmq';
 import { Observable } from 'rxjs';
 import { TenantInterceptor } from '@goldsmith/tenant-context';
 import { HealthController } from './health.controller';
@@ -13,6 +14,7 @@ import { AuthModule } from './modules/auth/auth.module';
 import { TenantBootModule } from './modules/tenant-boot/tenant-boot.module';
 import { TenantLookupModule } from './modules/tenant-lookup/tenant-lookup.module';
 import { SettingsModule } from './modules/settings/settings.module';
+import { PricingModule } from './modules/pricing/pricing.module';
 import { DrizzleTenantLookup } from './drizzle-tenant-lookup';
 import { TenantAuditReporter } from './modules/tenant-boot/tenant-audit-reporter';
 
@@ -30,7 +32,26 @@ class ConditionalTenantInterceptor implements NestInterceptor {
 }
 
 @Module({
-  imports: [AuthModule, TenantBootModule, TenantLookupModule, SettingsModule],
+  imports: [
+    BullModule.forRoot({
+      connection: (() => {
+        const u = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
+        return {
+          host: u.hostname,
+          port: Number(u.port || 6379),
+          ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
+          ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
+          ...(u.pathname && u.pathname !== '/' ? { db: Number(u.pathname.slice(1)) } : {}),
+          ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
+        };
+      })(),
+    }),
+    AuthModule,
+    TenantBootModule,
+    TenantLookupModule,
+    SettingsModule,
+    PricingModule,
+  ],
   controllers: [HealthController],
   providers: [
     HttpTenantResolver,
diff --git a/apps/api/src/modules/pricing/pricing.controller.spec.ts b/apps/api/src/modules/pricing/pricing.controller.spec.ts
new file mode 100644
index 0000000..3b4049b
--- /dev/null
+++ b/apps/api/src/modules/pricing/pricing.controller.spec.ts
@@ -0,0 +1,96 @@
+/**
+ * Story 4.1 WS-C — PricingController unit tests (RED phase)
+ * Run: pnpm --filter @goldsmith/api test
+ */
+import { describe, it, expect, vi, beforeEach } from 'vitest';
+import type { Mock } from 'vitest';
+import { Test } from '@nestjs/testing';
+import type { TestingModule } from '@nestjs/testing';
+import { HttpException } from '@nestjs/common';
+import { RatesUnavailableError } from '@goldsmith/rates';
+import { PricingController } from './pricing.controller';
+import { PricingService } from './pricing.service';
+
+// ---------------------------------------------------------------------------
+// Fixtures
+// ---------------------------------------------------------------------------
+
+const NOW = new Date('2026-04-23T10:00:00.000Z');
+
+const fakeRatesResult = {
+  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
+  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
+  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
+  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
+  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
+  SILVER_999: { perGramPaise: 9500n, fetchedAt: NOW },
+  SILVER_925: { perGramPaise: 8788n, fetchedAt: NOW },
+  stale: false,
+  source: 'ibja',
+};
+
+// ---------------------------------------------------------------------------
+// Mocks
+// ---------------------------------------------------------------------------
+
+const mockPricingService = {
+  getCurrentRates: vi.fn(),
+};
+
+// ---------------------------------------------------------------------------
+// Tests
+// ---------------------------------------------------------------------------
+
+describe('PricingController', () => {
+  let controller: PricingController;
+
+  beforeEach(async () => {
+    vi.clearAllMocks();
+
+    const module: TestingModule = await Test.createTestingModule({
+      controllers: [PricingController],
+      providers: [
+        { provide: PricingService, useValue: mockPricingService },
+      ],
+    }).compile();
+
+    controller = module.get<PricingController>(PricingController);
+  });
+
+  describe('GET /api/v1/rates/current', () => {
+    it('returns 200 with rate data (paise as strings, source, stale)', async () => {
+      (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRatesResult);
+
+      const result = await controller.getCurrent();
+
+      // perGramPaise must be serialized as strings (bigint cannot be JSON-serialized as number)
+      expect(result.GOLD_24K.perGramPaise).toBe('735000');
+      expect(result.GOLD_24K.perGramRupees).toBe('7350.00');
+      expect(result.GOLD_24K.fetchedAt).toBe(NOW.toISOString());
+      expect(result.stale).toBe(false);
+      expect(result.source).toBe('ibja');
+    });
+
+    it('returns 503 when PricingService.getCurrentRates throws RatesUnavailableError', async () => {
+      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());
+
+      await expect(controller.getCurrent()).rejects.toBeInstanceOf(HttpException);
+
+      try {
+        await controller.getCurrent();
+      } catch (err) {
+        expect(err).toBeInstanceOf(HttpException);
+        expect((err as HttpException).getStatus()).toBe(503);
+      }
+    });
+
+    it('is a public endpoint — controller metadata has SkipAuth', () => {
+      // Verify that the controller or handler has the SKIP_AUTH metadata set
+      // This is a compile-time / metadata check to ensure the endpoint is public
+      // We check the class has no guard that would require authentication
+      // The SkipAuth decorator sets 'skip-auth' metadata on the handler
+      const metadata = Reflect.getMetadata('skip-auth', controller.getCurrent);
+      expect(metadata).toBe(true);
+    });
+  });
+});
diff --git a/apps/api/src/modules/pricing/pricing.controller.ts b/apps/api/src/modules/pricing/pricing.controller.ts
new file mode 100644
index 0000000..e2df8a7
--- /dev/null
+++ b/apps/api/src/modules/pricing/pricing.controller.ts
@@ -0,0 +1,77 @@
+import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
+import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
+import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
+import { PricingService } from './pricing.service';
+import { RatesUnavailableError } from '@goldsmith/rates';
+
+// ---------------------------------------------------------------------------
+// Response shape helpers
+// ---------------------------------------------------------------------------
+
+interface PurityEntry {
+  perGramPaise: string;
+  perGramRupees: string;
+  fetchedAt: string;
+}
+
+interface CurrentRatesResponse {
+  GOLD_24K: PurityEntry;
+  GOLD_22K: PurityEntry;
+  GOLD_20K: PurityEntry;
+  GOLD_18K: PurityEntry;
+  GOLD_14K: PurityEntry;
+  SILVER_999: PurityEntry;
+  SILVER_925: PurityEntry;
+  stale: boolean;
+  source: string;
+}
+
+function toEntry(paise: bigint, fetchedAt: Date): PurityEntry {
+  return {
+    perGramPaise: paise.toString(),
+    perGramRupees: `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`,
+    fetchedAt: fetchedAt.toISOString(),
+  };
+}
+
+// ---------------------------------------------------------------------------
+// Controller
+// ---------------------------------------------------------------------------
+
+@Controller('api/v1/rates')
+export class PricingController {
+  constructor(@Inject(PricingService) private readonly pricingService: PricingService) {}
+
+  /**
+   * GET /api/v1/rates/current
+   * Public endpoint — no Firebase auth required.
+   * Returns per-gram rates for all 7 purities (paise as strings to avoid bigint serialisation issues).
+   */
+  @Get('current')
+  @SkipAuth()
+  @SkipTenant()
+  async getCurrent(): Promise<CurrentRatesResponse> {
+    try {
+      const rates = await this.pricingService.getCurrentRates();
+      return {
+        GOLD_24K: toEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt),
+        GOLD_22K: toEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt),
+        GOLD_20K: toEntry(rates.GOLD_20K.perGramPaise, rates.GOLD_20K.fetchedAt),
+        GOLD_18K: toEntry(rates.GOLD_18K.perGramPaise, rates.GOLD_18K.fetchedAt),
+        GOLD_14K: toEntry(rates.GOLD_14K.perGramPaise, rates.GOLD_14K.fetchedAt),
+        SILVER_999: toEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt),
+        SILVER_925: toEntry(rates.SILVER_925.perGramPaise, rates.SILVER_925.fetchedAt),
+        stale: rates.stale,
+        source: rates.source,
+      };
+    } catch (err) {
+      if (err instanceof RatesUnavailableError) {
+        throw new HttpException(
+          { code: 'rates.unavailable', message: 'Gold rate data is temporarily unavailable' },
+          HttpStatus.SERVICE_UNAVAILABLE,
+        );
+      }
+      throw err;
+    }
+  }
+}
diff --git a/apps/api/src/modules/pricing/pricing.module.ts b/apps/api/src/modules/pricing/pricing.module.ts
new file mode 100644
index 0000000..c538bcf
--- /dev/null
+++ b/apps/api/src/modules/pricing/pricing.module.ts
@@ -0,0 +1,120 @@
+import {
+  Module,
+  OnModuleInit,
+  OnModuleDestroy,
+  Inject,
+} from '@nestjs/common';
+import { BullModule, InjectQueue } from '@nestjs/bullmq';
+import type { Queue } from 'bullmq';
+import { Redis } from '@goldsmith/cache';
+import { AuthModule } from '../auth/auth.module';
+import { PricingService } from './pricing.service';
+import { PricingController } from './pricing.controller';
+import { RatesRefreshProcessor } from '../../workers/rates-refresh.processor';
+import {
+  FallbackChain,
+  IbjaAdapter,
+  MetalsDevAdapter,
+  CircuitBreaker,
+  LastKnownGoodCache,
+} from '@goldsmith/rates';
+
+// ---------------------------------------------------------------------------
+// IST trading hours cron patterns (UTC+5:30)
+// 09:00–17:30 IST = 03:30–12:00 UTC
+//
+// Three mutually exclusive patterns:
+//   Trading hours   — every 15 min, Mon–Fri, UTC hours 03:00–11:59 (09:00–17:59 IST)
+//   Weekend midday  — every hour at :00, Sat+Sun, UTC hours 03:00–11:59
+//   Outside hours   — every hour at :00, UTC hours 12–23 and 0–2 (daily incl. weekends)
+//
+// The patterns share no overlap:
+//   TRADING_HOURS_CRON covers hours 3–11 on weekdays only.
+//   WEEKEND_MIDDAY_CRON covers hours 3–11 on weekends only (was previously a gap — no refresh for ~8 hrs IST).
+//   OUTSIDE_HOURS_CRON covers hours 12–23 and 0–2 every day (weekday+weekend hours 3–11 are absent).
+// ---------------------------------------------------------------------------
+const TRADING_HOURS_CRON  = '*/15 3-11 * * 1-5';      // every 15 min, Mon–Fri, UTC 03:00–11:59
+const WEEKEND_MIDDAY_CRON = '0 3-11 * * 0,6';         // every hour at :00, Sat+Sun, UTC 03:00–11:59
+const OUTSIDE_HOURS_CRON  = '0 12-23,0-2 * * *';      // every hour at :00, UTC 12–23 and 0–2, daily
+
+@Module({
+  imports: [
+    AuthModule,
+    BullModule.registerQueue({ name: 'rates-refresh' }),
+  ],
+  providers: [
+    // PG Pool — reuse the one exported from AuthModule (injected by token)
+    // We use 'PG_POOL' which is provided and exported by AuthModule
+    {
+      provide: 'PRICING_REDIS',
+      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
+    },
+    {
+      provide: LastKnownGoodCache,
+      useFactory: (redis: Redis) => new LastKnownGoodCache(redis),
+      inject: ['PRICING_REDIS'],
+    },
+    {
+      provide: IbjaAdapter,
+      useFactory: () => new IbjaAdapter(),
+    },
+    {
+      provide: MetalsDevAdapter,
+      useFactory: () => new MetalsDevAdapter(),
+    },
+    {
+      provide: 'IBJA_WITH_CB',
+      useFactory: (ibja: IbjaAdapter, redis: Redis) => new CircuitBreaker(ibja, redis),
+      inject: [IbjaAdapter, 'PRICING_REDIS'],
+    },
+    {
+      provide: 'METALSDEV_WITH_CB',
+      useFactory: (metalsdev: MetalsDevAdapter, redis: Redis) => new CircuitBreaker(metalsdev, redis),
+      inject: [MetalsDevAdapter, 'PRICING_REDIS'],
+    },
+    {
+      provide: FallbackChain,
+      useFactory: (
+        ibja: CircuitBreaker,
+        metalsdev: CircuitBreaker,
+        lkg: LastKnownGoodCache,
+      ) => new FallbackChain(ibja, metalsdev, lkg, console),
+      inject: ['IBJA_WITH_CB', 'METALSDEV_WITH_CB', LastKnownGoodCache],
+    },
+    PricingService,
+    RatesRefreshProcessor,
+  ],
+  controllers: [PricingController],
+  exports: [PricingService],
+})
+export class PricingModule implements OnModuleInit, OnModuleDestroy {
+  constructor(
+    @InjectQueue('rates-refresh') private readonly queue: Queue,
+    @Inject('PRICING_REDIS') private readonly redis: Redis,
+  ) {}
+
+  async onModuleInit(): Promise<void> {
+    // Register repeatable jobs — upsert so restarts are idempotent
+    await this.queue.upsertJobScheduler(
+      'refresh-trading-hours',
+      { pattern: TRADING_HOURS_CRON },
+      { name: 'refresh' },
+    );
+
+    await this.queue.upsertJobScheduler(
+      'refresh-weekend-midday',
+      { pattern: WEEKEND_MIDDAY_CRON },
+      { name: 'refresh' },
+    );
+
+    await this.queue.upsertJobScheduler(
+      'refresh-outside-hours',
+      { pattern: OUTSIDE_HOURS_CRON },
+      { name: 'refresh' },
+    );
+  }
+
+  async onModuleDestroy(): Promise<void> {
+    await this.redis.quit();
+  }
+}
diff --git a/apps/api/src/modules/pricing/pricing.service.spec.ts b/apps/api/src/modules/pricing/pricing.service.spec.ts
new file mode 100644
index 0000000..3dfc3c7
--- /dev/null
+++ b/apps/api/src/modules/pricing/pricing.service.spec.ts
@@ -0,0 +1,186 @@
+/**
+ * Story 4.1 WS-C — PricingService unit tests (RED phase)
+ * Run: pnpm --filter @goldsmith/api test
+ */
+import { describe, it, expect, vi, beforeEach } from 'vitest';
+import type { Mock } from 'vitest';
+import type { Pool } from 'pg';
+import type { Redis } from '@goldsmith/cache';
+import { RatesUnavailableError } from '@goldsmith/rates';
+import type { PurityRates, RatesResult } from '@goldsmith/rates';
+import { AuditAction } from '@goldsmith/audit';
+import { PricingService } from './pricing.service';
+import type { FallbackChain } from '@goldsmith/rates';
+
+// ---------------------------------------------------------------------------
+// Fixtures
+// ---------------------------------------------------------------------------
+
+const NOW = new Date('2026-04-23T10:00:00.000Z');
+
+const fakePurityRates: PurityRates = {
+  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
+  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
+  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
+  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
+  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
+  SILVER_999: { perGramPaise: 9500n, fetchedAt: NOW },
+  SILVER_925: { perGramPaise: 8788n, fetchedAt: NOW },
+};
+
+const serializedRates = JSON.stringify({
+  GOLD_24K: { perGramPaise: '735000', fetchedAt: NOW.toISOString() },
+  GOLD_22K: { perGramPaise: '673750', fetchedAt: NOW.toISOString() },
+  GOLD_20K: { perGramPaise: '612500', fetchedAt: NOW.toISOString() },
+  GOLD_18K: { perGramPaise: '551250', fetchedAt: NOW.toISOString() },
+  GOLD_14K: { perGramPaise: '428750', fetchedAt: NOW.toISOString() },
+  SILVER_999: { perGramPaise: '9500', fetchedAt: NOW.toISOString() },
+  SILVER_925: { perGramPaise: '8788', fetchedAt: NOW.toISOString() },
+  stale: false,
+  source: 'ibja',
+});
+
+// ---------------------------------------------------------------------------
+// Helpers
+// ---------------------------------------------------------------------------
+
+function makePoolMock() {
+  const client = {
+    query: vi.fn()
+      .mockResolvedValue({ rows: [], rowCount: 0 }),
+    release: vi.fn(),
+  };
+  return {
+    connect: vi.fn().mockResolvedValue(client),
+    _client: client,
+  } as unknown as Pool & { _client: typeof client };
+}
+
+function makeRedisMock() {
+  return {
+    get: vi.fn(),
+    set: vi.fn().mockResolvedValue('OK'),
+    setex: vi.fn().mockResolvedValue('OK'),
+  } as unknown as Redis;
+}
+
+const fakeRatesResult: RatesResult = {
+  rates: fakePurityRates,
+  source: 'ibja',
+  stale: false,
+};
+
+function makeFallbackChainMock() {
+  return {
+    getRatesByPurity: vi.fn().mockResolvedValue(fakeRatesResult),
+    getName: vi.fn().mockReturnValue('fallback-chain'),
+  } as unknown as FallbackChain;
+}
+
+function makeService(
+  pool: Pool,
+  fallbackChain: FallbackChain,
+  redis: Redis,
+) {
+  return new PricingService(pool, fallbackChain, redis);
+}
+
+// ---------------------------------------------------------------------------
+// Tests
+// ---------------------------------------------------------------------------
+
+describe('PricingService', () => {
+  let pool: ReturnType<typeof makePoolMock>;
+  let redis: Redis & { get: Mock; set: Mock; setex: Mock };
+  let fallbackChain: FallbackChain & { getRatesByPurity: Mock };
+  let service: PricingService;
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    pool = makePoolMock();
+    redis = makeRedisMock() as Redis & { get: Mock; set: Mock; setex: Mock };
+    fallbackChain = makeFallbackChainMock() as FallbackChain & { getRatesByPurity: Mock };
+    service = makeService(pool as unknown as Pool, fallbackChain, redis);
+  });
+
+  // -------------------------------------------------------------------------
+  // refreshRates()
+  // -------------------------------------------------------------------------
+  describe('refreshRates()', () => {
+    it('inserts a snapshot row into ibja_rate_snapshots', async () => {
+      await service.refreshRates();
+
+      // pool.connect() should have been called for the insert
+      expect(pool.connect).toHaveBeenCalled();
+      // The client.query should have been called with an INSERT
+      const calls = (pool._client.query as Mock).mock.calls as Array<[string, ...unknown[]]>;
+      const insertCall = calls.find(([sql]) => typeof sql === 'string' && sql.includes('ibja_rate_snapshots'));
+      expect(insertCall).toBeDefined();
+    });
+
+    it('writes rates:current to Redis with 30-min TTL (1800s)', async () => {
+      await service.refreshRates();
+
+      expect(redis.setex).toHaveBeenCalledWith(
+        'rates:current',
+        1800,
+        expect.any(String),
+      );
+    });
+
+    it('logs PRICING_RATES_REFRESHED audit event', async () => {
+      await service.refreshRates();
+
+      // The INSERT into platform_audit_events or direct pool call must have happened
+      // We verify audit is logged by checking pool.connect was used for audit
+      const connectCalls = (pool.connect as Mock).mock.calls.length;
+      expect(connectCalls).toBeGreaterThanOrEqual(1);
+
+      // Verify the action written matches PRICING_RATES_REFRESHED
+      const clientCalls = (pool._client.query as Mock).mock.calls as Array<[string, unknown[]]>;
+      const auditCall = clientCalls.find(([sql, params]) =>
+        typeof sql === 'string' &&
+        sql.includes('platform_audit_events') &&
+        Array.isArray(params) &&
+        params.includes(AuditAction.PRICING_RATES_REFRESHED),
+      );
+      expect(auditCall).toBeDefined();
+    });
+  });
+
+  // -------------------------------------------------------------------------
+  // getCurrentRates()
+  // -------------------------------------------------------------------------
+  describe('getCurrentRates()', () => {
+    it('returns cached rates from Redis when cache hit (does NOT call FallbackChain)', async () => {
+      (redis.get as Mock).mockResolvedValue(serializedRates);
+
+      const result = await service.getCurrentRates();
+
+      expect(fallbackChain.getRatesByPurity).not.toHaveBeenCalled();
+      expect(result.GOLD_24K.perGramPaise).toBe(735000n);
+      expect(result.stale).toBe(false);
+      expect(result.source).toBe('ibja');
+    });
+
+    it('calls FallbackChain when cache miss and caches result with 15-min TTL (900s)', async () => {
+      (redis.get as Mock).mockResolvedValue(null);
+
+      await service.getCurrentRates();
+
+      expect(fallbackChain.getRatesByPurity).toHaveBeenCalledOnce();
+      expect(redis.setex).toHaveBeenCalledWith(
+        'rates:current',
+        900,
+        expect.any(String),
+      );
+    });
+
+    it('throws RatesUnavailableError when FallbackChain throws', async () => {
+      (redis.get as Mock).mockResolvedValue(null);
+      (fallbackChain.getRatesByPurity as Mock).mockRejectedValue(new RatesUnavailableError());
+
+      await expect(service.getCurrentRates()).rejects.toThrow(RatesUnavailableError);
+    });
+  });
+});
diff --git a/apps/api/src/modules/pricing/pricing.service.ts b/apps/api/src/modules/pricing/pricing.service.ts
new file mode 100644
index 0000000..e2402c9
--- /dev/null
+++ b/apps/api/src/modules/pricing/pricing.service.ts
@@ -0,0 +1,216 @@
+import { Injectable, Inject, Logger } from '@nestjs/common';
+import type { Pool } from 'pg';
+import type { Redis } from '@goldsmith/cache';
+import { FallbackChain } from '@goldsmith/rates';
+import type { PurityRates } from '@goldsmith/rates';
+import { AuditAction } from '@goldsmith/audit';
+export interface RateSnapshotRow {
+  id: string;
+  fetched_at: Date;
+  source: string;
+  gold_24k_paise: bigint;
+  gold_22k_paise: bigint;
+  gold_20k_paise: bigint;
+  gold_18k_paise: bigint;
+  gold_14k_paise: bigint;
+  silver_999_paise: bigint;
+  silver_925_paise: bigint;
+  stale: boolean;
+  created_at: Date;
+}
+
+const REDIS_KEY_CURRENT = 'rates:current';
+const TTL_CURRENT_CACHE_SEC = 900;   // 15 min — on cache miss, after FallbackChain call
+const TTL_REFRESH_SEC = 1800;        // 30 min — on explicit refreshRates()
+
+// ---------------------------------------------------------------------------
+// Serialization helpers (bigint cannot be JSON.stringify'd natively)
+// ---------------------------------------------------------------------------
+
+type PurityKey = keyof PurityRates;
+
+interface SerializedEntry {
+  perGramPaise: string;
+  fetchedAt: string;
+}
+
+interface CachedCurrentRates {
+  GOLD_24K: SerializedEntry;
+  GOLD_22K: SerializedEntry;
+  GOLD_20K: SerializedEntry;
+  GOLD_18K: SerializedEntry;
+  GOLD_14K: SerializedEntry;
+  SILVER_999: SerializedEntry;
+  SILVER_925: SerializedEntry;
+  stale: boolean;
+  source: string;
+}
+
+function serializeRates(
+  rates: PurityRates,
+  stale: boolean,
+  source: string,
+): string {
+  const keys = Object.keys(rates) as PurityKey[];
+  const out: Record<string, SerializedEntry | boolean | string> = {};
+  for (const k of keys) {
+    out[k] = {
+      perGramPaise: rates[k].perGramPaise.toString(),
+      fetchedAt: rates[k].fetchedAt.toISOString(),
+    };
+  }
+  out['stale'] = stale;
+  out['source'] = source;
+  return JSON.stringify(out);
+}
+
+function deserializeRates(raw: string): CachedCurrentRates {
+  return JSON.parse(raw) as CachedCurrentRates;
+}
+
+// ---------------------------------------------------------------------------
+// PricingService
+// ---------------------------------------------------------------------------
+
+export interface CurrentRatesResult extends PurityRates {
+  stale: boolean;
+  source: string;
+}
+
+@Injectable()
+export class PricingService {
+  private readonly logger = new Logger(PricingService.name);
+
+  constructor(
+    @Inject('PG_POOL') private readonly pool: Pool,
+    private readonly fallbackChain: FallbackChain,
+    @Inject('PRICING_REDIS') private readonly redis: Redis,
+  ) {}
+
+  // -------------------------------------------------------------------------
+  // getCurrentRates — try Redis cache first, fall back to FallbackChain
+  // -------------------------------------------------------------------------
+  async getCurrentRates(): Promise<CurrentRatesResult> {
+    const cached = await this.redis.get(REDIS_KEY_CURRENT);
+    if (cached !== null) {
+      const parsed = deserializeRates(cached);
+
+      // Guard: if any required purity key is missing (stale/incompatible schema from a
+      // previous deployment), treat as a cache miss rather than crashing with BigInt(undefined).
+      const requiredKeys = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925'] as const;
+      if (requiredKeys.some(k => !parsed[k])) {
+        this.logger.warn('Cached rates schema is stale/incompatible — evicting and falling through to FallbackChain');
+        await this.redis.del(REDIS_KEY_CURRENT);
+        // Fall through to FallbackChain below
+      } else {
+        // Re-hydrate bigints
+        const rates: CurrentRatesResult = {
+          GOLD_24K: { perGramPaise: BigInt(parsed.GOLD_24K.perGramPaise), fetchedAt: new Date(parsed.GOLD_24K.fetchedAt) },
+          GOLD_22K: { perGramPaise: BigInt(parsed.GOLD_22K.perGramPaise), fetchedAt: new Date(parsed.GOLD_22K.fetchedAt) },
+          GOLD_20K: { perGramPaise: BigInt(parsed.GOLD_20K.perGramPaise), fetchedAt: new Date(parsed.GOLD_20K.fetchedAt) },
+          GOLD_18K: { perGramPaise: BigInt(parsed.GOLD_18K.perGramPaise), fetchedAt: new Date(parsed.GOLD_18K.fetchedAt) },
+          GOLD_14K: { perGramPaise: BigInt(parsed.GOLD_14K.perGramPaise), fetchedAt: new Date(parsed.GOLD_14K.fetchedAt) },
+          SILVER_999: { perGramPaise: BigInt(parsed.SILVER_999.perGramPaise), fetchedAt: new Date(parsed.SILVER_999.fetchedAt) },
+          SILVER_925: { perGramPaise: BigInt(parsed.SILVER_925.perGramPaise), fetchedAt: new Date(parsed.SILVER_925.fetchedAt) },
+          stale: parsed.stale,
+          source: parsed.source,
+        };
+        return rates;
+      }
+    }
+
+    // Cache miss — call FallbackChain (throws RatesUnavailableError if all sources fail)
+    const liveResult = await this.fallbackChain.getRatesByPurity();
+    const { rates: liveRates, source, stale } = liveResult;
+
+    // Cache the result with 15-min TTL
+    const serialized = serializeRates(liveRates, stale, source);
+    await this.redis.setex(REDIS_KEY_CURRENT, TTL_CURRENT_CACHE_SEC, serialized);
+
+    return { ...liveRates, stale, source };
+  }
+
+  // -------------------------------------------------------------------------
+  // refreshRates — called by BullMQ worker on schedule
+  // -------------------------------------------------------------------------
+  async refreshRates(): Promise<void> {
+    const { rates, source, stale } = await this.fallbackChain.getRatesByPurity();
+
+    // 1. Write to Redis 'rates:current' with 30-min TTL
+    const serialized = serializeRates(rates, stale, source);
+    await this.redis.setex(REDIS_KEY_CURRENT, TTL_REFRESH_SEC, serialized);
+
+    // 2. Insert snapshot into ibja_rate_snapshots (platform-global table, no tenant context)
+    const now = new Date();
+    const snapshotValues = {
+      fetched_at: now,
+      source,
+      gold_24k_paise: rates.GOLD_24K.perGramPaise,
+      gold_22k_paise: rates.GOLD_22K.perGramPaise,
+      gold_20k_paise: rates.GOLD_20K.perGramPaise,
+      gold_18k_paise: rates.GOLD_18K.perGramPaise,
+      gold_14k_paise: rates.GOLD_14K.perGramPaise,
+      silver_999_paise: rates.SILVER_999.perGramPaise,
+      silver_925_paise: rates.SILVER_925.perGramPaise,
+      stale,
+    };
+    const client = await this.pool.connect();
+    try {
+      await client.query(
+        `INSERT INTO ibja_rate_snapshots
+           (fetched_at, source,
+            gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
+            silver_999_paise, silver_925_paise, stale)
+         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
+        [
+          snapshotValues.fetched_at,
+          snapshotValues.source,
+          snapshotValues.gold_24k_paise,
+          snapshotValues.gold_22k_paise,
+          snapshotValues.gold_20k_paise,
+          snapshotValues.gold_18k_paise,
+          snapshotValues.gold_14k_paise,
+          snapshotValues.silver_999_paise,
+          snapshotValues.silver_925_paise,
+          snapshotValues.stale,
+        ],
+      );
+
+      // 3. Log PRICING_RATES_REFRESHED platform audit event
+      await client.query(
+        `INSERT INTO platform_audit_events (action, metadata)
+         VALUES ($1, $2)`,
+        [
+          AuditAction.PRICING_RATES_REFRESHED,
+          JSON.stringify({ source, fetchedAt: now.toISOString() }),
+        ],
+      );
+    } finally {
+      client.release();
+    }
+
+    this.logger.log(`Rates refreshed from ${source} at ${now.toISOString()}`);
+  }
+
+  // -------------------------------------------------------------------------
+  // getRateHistory — query ibja_rate_snapshots for historical data
+  // -------------------------------------------------------------------------
+  async getRateHistory(range: '30d' | '90d' | '365d'): Promise<RateSnapshotRow[]> {
+    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
+    const client = await this.pool.connect();
+    try {
+      const result = await client.query<RateSnapshotRow>(
+        `SELECT id, fetched_at, source,
+                gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
+                silver_999_paise, silver_925_paise, stale, created_at
+           FROM ibja_rate_snapshots
+          WHERE fetched_at >= NOW() - ($1 * INTERVAL '1 day')
+          ORDER BY fetched_at DESC`,
+        [days],
+      );
+      return result.rows;
+    } finally {
+      client.release();
+    }
+  }
+}
diff --git a/apps/api/src/workers/rates-refresh.processor.ts b/apps/api/src/workers/rates-refresh.processor.ts
new file mode 100644
index 0000000..35b2b38
--- /dev/null
+++ b/apps/api/src/workers/rates-refresh.processor.ts
@@ -0,0 +1,60 @@
+import { Logger, Inject } from '@nestjs/common';
+import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
+import type { Job } from 'bullmq';
+import type { Pool } from 'pg';
+import { AuditAction } from '@goldsmith/audit';
+import { PricingService } from '../modules/pricing/pricing.service';
+
+@Processor('rates-refresh')
+export class RatesRefreshProcessor extends WorkerHost {
+  private readonly logger = new Logger(RatesRefreshProcessor.name);
+
+  constructor(
+    @Inject(PricingService) private readonly pricingService: PricingService,
+    @Inject('PG_POOL') private readonly pool: Pool,
+  ) {
+    super();
+  }
+
+  async process(job: Job): Promise<void> {
+    if (job.name === 'refresh') {
+      this.logger.log(`Processing rates-refresh job id=${job.id}`);
+      await this.pricingService.refreshRates();
+    }
+  }
+
+  @OnWorkerEvent('failed')
+  onFailed(job: Job | undefined, error: Error): void {
+    this.logger.error(
+      `rates-refresh job failed: jobId=${job?.id ?? 'unknown'} name=${job?.name ?? 'unknown'} error=${error.message}`,
+      error.stack,
+    );
+    // Persist PRICING_RATES_FALLBACK audit event to DB (best-effort, async).
+    // Wrapped in void + try/catch so an audit DB failure never masks the original job failure.
+    void (async () => {
+      try {
+        const client = await this.pool.connect();
+        try {
+          await client.query(
+            `INSERT INTO platform_audit_events (action, metadata)
+             VALUES ($1, $2)`,
+            [
+              AuditAction.PRICING_RATES_FALLBACK,
+              JSON.stringify({
+                jobId: job?.id ?? 'unknown',
+                jobName: job?.name ?? 'unknown',
+                error: error.message,
+              }),
+            ],
+          );
+        } finally {
+          client.release();
+        }
+      } catch (auditErr) {
+        this.logger.warn(
+          `Failed to persist PRICING_RATES_FALLBACK audit event: ${(auditErr as Error).message}`,
+        );
+      }
+    })();
+  }
+}
diff --git a/apps/api/test/rates-chaos.test.ts b/apps/api/test/rates-chaos.test.ts
new file mode 100644
index 0000000..a0a94db
--- /dev/null
+++ b/apps/api/test/rates-chaos.test.ts
@@ -0,0 +1,224 @@
+// apps/api/test/rates-chaos.test.ts
+//
+// Chaos tests for the rates layer — unit-level with controlled failures.
+// No Testcontainers needed: all infrastructure is replaced with in-process mocks.
+//
+// NOTE: ioredis-mock shares a global in-memory store across all instances within
+// the same Node process. Each test calls redis.flushall() to start clean.
+//
+// Covers:
+//   1. IBJA timeout → fallback to MetalsDev within budget
+//   2. Both adapters fail → LKG cache serves stale rates (when pre-populated)
+//   3. Both adapters fail → RatesUnavailableError when LKG is also empty
+//   4. Redis unavailable → PricingService degrades gracefully (typed error, no crash)
+
+import { describe, it, expect, beforeEach } from 'vitest';
+import IoredisMock from 'ioredis-mock';
+import {
+  IbjaAdapter,
+  MetalsDevAdapter,
+  FallbackChain,
+  CircuitBreaker,
+  LastKnownGoodCache,
+  RatesUnavailableError,
+  type PurityRates,
+} from '@goldsmith/rates';
+import { PricingService } from '../src/modules/pricing/pricing.service';
+import type { Pool } from 'pg';
+import type { Redis } from '@goldsmith/cache';
+import { vi } from 'vitest';
+
+// ---------------------------------------------------------------------------
+// Shared fixtures
+// ---------------------------------------------------------------------------
+
+const NOW = new Date('2026-04-23T10:00:00.000Z');
+
+const fakePurityRates: PurityRates = {
+  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
+  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
+  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
+  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
+  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
+  SILVER_999: { perGramPaise: 9500n,  fetchedAt: NOW },
+  SILVER_925: { perGramPaise: 8788n,  fetchedAt: NOW },
+};
+
+// Shared ioredis-mock instance — flush before each test for isolation
+const redis = new IoredisMock();
+
+beforeEach(async () => {
+  await redis.flushall();
+});
+
+// ---------------------------------------------------------------------------
+// Adapter subclasses for chaos scenarios
+// ---------------------------------------------------------------------------
+
+/** IBJA adapter whose _fetch() takes 5100 ms — simulates a slow/hung primary */
+class SlowIbjaAdapter extends IbjaAdapter {
+  protected override async _fetch(): Promise<PurityRates> {
+    await new Promise<void>((resolve) => setTimeout(resolve, 5_100));
+    return super._fetch();
+  }
+}
+
+/** Adapter that always rejects _fetch() with a plain Error */
+class AlwaysFailingIbjaAdapter extends IbjaAdapter {
+  protected override async _fetch(): Promise<never> {
+    throw new Error('ibja always fails');
+  }
+}
+
+/** MetalsDev-shaped adapter that always rejects */
+class AlwaysFailingMetalsDevAdapter extends MetalsDevAdapter {
+  protected override async _fetch(): Promise<never> {
+    throw new Error('metalsdev always fails');
+  }
+}
+
+// ---------------------------------------------------------------------------
+// Helper: build FallbackChain from the given adapters
+// ---------------------------------------------------------------------------
+
+function buildChain(
+  ibja: IbjaAdapter,
+  metalsdev: MetalsDevAdapter,
+): FallbackChain {
+  const lkg = new LastKnownGoodCache(redis as never);
+  const ibjaCb = new CircuitBreaker(ibja, redis as never);
+  const metalsdevCb = new CircuitBreaker(metalsdev, redis as never);
+  return new FallbackChain(ibjaCb, metalsdevCb, lkg, console);
+}
+
+function makeNullPool(): Pool {
+  const client = {
+    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
+    release: vi.fn(),
+  };
+  return { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
+}
+
+// ---------------------------------------------------------------------------
+// Chaos Test 1: IBJA times out (5s) → MetalsDev fallback within 10s
+// ---------------------------------------------------------------------------
+
+describe('Chaos: IBJA times out (5s) → MetalsDev fallback within 10s', () => {
+  // This test intentionally takes ≥5 seconds because it uses a REAL wall-clock timer —
+  // not fake timers. vi.useFakeTimers() would prevent the elapsed-time assertion
+  // (elapsedMs > 5000) from ever being true. Do NOT add fake timers to this test.
+  it('returns MetalsDev rates within 10 seconds after IBJA 5s timeout fires', async () => {
+    const chain = buildChain(new SlowIbjaAdapter(), new MetalsDevAdapter());
+
+    const start = Date.now();
+    const result = await chain.getRatesByPurity();
+    const elapsedMs = Date.now() - start;
+
+    // Total elapsed must be >= 5000ms (IBJA timeout fired at 5s)
+    expect(elapsedMs).toBeGreaterThan(5_000);
+    // But must complete before our chaos-test budget (MetalsDev stub is fast)
+    expect(elapsedMs).toBeLessThan(10_000);
+
+    // IBJA timed out → FallbackChain fell through to MetalsDev
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.source).toBe('metalsdev');
+  }, 15_000); // generous test timeout to accommodate the 5s timeout
+});
+
+// ---------------------------------------------------------------------------
+// Chaos Test 2: Both adapters fail → LKG cache serves stale rates
+// ---------------------------------------------------------------------------
+
+describe('Chaos: Both adapters fail → LKG cache', () => {
+  it('serves stale rates from LKG cache within 1 second when cache is pre-populated with stale data', async () => {
+    // Seed LKG with data that is 31 minutes old → stale=true
+    const staleDate = new Date(Date.now() - 31 * 60 * 1000);
+    const staleEntry = {
+      rates: {
+        GOLD_24K: { perGramPaise: fakePurityRates.GOLD_24K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_24K.fetchedAt.toISOString() },
+        GOLD_22K: { perGramPaise: fakePurityRates.GOLD_22K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_22K.fetchedAt.toISOString() },
+        GOLD_20K: { perGramPaise: fakePurityRates.GOLD_20K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_20K.fetchedAt.toISOString() },
+        GOLD_18K: { perGramPaise: fakePurityRates.GOLD_18K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_18K.fetchedAt.toISOString() },
+        GOLD_14K: { perGramPaise: fakePurityRates.GOLD_14K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_14K.fetchedAt.toISOString() },
+        SILVER_999: { perGramPaise: fakePurityRates.SILVER_999.perGramPaise.toString(), fetchedAt: fakePurityRates.SILVER_999.fetchedAt.toISOString() },
+        SILVER_925: { perGramPaise: fakePurityRates.SILVER_925.perGramPaise.toString(), fetchedAt: fakePurityRates.SILVER_925.fetchedAt.toISOString() },
+      },
+      storedAt: staleDate.toISOString(),
+    };
+    await redis.set('rates:last_known_good', JSON.stringify(staleEntry), 'EX', 24 * 60 * 60);
+
+    const chain = buildChain(
+      new AlwaysFailingIbjaAdapter(),
+      new AlwaysFailingMetalsDevAdapter(),
+    );
+
+    const start = Date.now();
+    const result = await chain.getRatesByPurity();
+    const elapsedMs = Date.now() - start;
+
+    // Should resolve quickly from the in-memory LKG mock
+    expect(elapsedMs).toBeLessThan(1_000);
+
+    // LKG rates match what was seeded, and stale=true because storedAt is 31 min ago
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.source).toBe('last_known_good');
+    expect(result.stale).toBe(true);
+  });
+
+  it('throws RatesUnavailableError when both adapters fail AND LKG cache is empty', async () => {
+    // redis was flushed in beforeEach — LKG is empty
+    const chain = buildChain(
+      new AlwaysFailingIbjaAdapter(),
+      new AlwaysFailingMetalsDevAdapter(),
+    );
+
+    await expect(chain.getRatesByPurity()).rejects.toBeInstanceOf(RatesUnavailableError);
+  });
+});
+
+// ---------------------------------------------------------------------------
+// Chaos Test 3: Redis unavailable → PricingService degrades gracefully
+// ---------------------------------------------------------------------------
+
+describe('Chaos: Redis unavailable → PricingService degrades gracefully', () => {
+  it('getCurrentRates() rejects with a typed Error when Redis.get() fails — no unhandled crash', async () => {
+    // Mock Redis that rejects every call
+    const brokenRedis: Redis = {
+      get: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
+      set: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
+      setex: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
+      del: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
+    } as unknown as Redis;
+
+    const pool = makeNullPool();
+    // FallbackChain mock returns valid rates so we isolate to the Redis failure path
+    const fallbackChain = {
+      getRatesByPurity: vi.fn().mockResolvedValue({ rates: fakePurityRates, source: 'ibja', stale: false }),
+      getName: vi.fn().mockReturnValue('ibja'),
+    };
+
+    const service = new PricingService(pool, fallbackChain as never, brokenRedis);
+
+    // getCurrentRates() calls redis.get — rejects with Error, not an unhandled rejection
+    await expect(service.getCurrentRates()).rejects.toBeInstanceOf(Error);
+  });
+
+  it('refreshRates() rejects with a typed Error when Redis.setex() fails — no unhandled crash', async () => {
+    const brokenRedis: Redis = {
+      get: vi.fn().mockRejectedValue(new Error('Redis down')),
+      setex: vi.fn().mockRejectedValue(new Error('Redis down')),
+      del: vi.fn().mockRejectedValue(new Error('Redis down')),
+    } as unknown as Redis;
+
+    const pool = makeNullPool();
+    const fallbackChain = {
+      getRatesByPurity: vi.fn().mockResolvedValue({ rates: fakePurityRates, source: 'ibja', stale: false }),
+      getName: vi.fn().mockReturnValue('ibja'),
+    };
+
+    const service = new PricingService(pool, fallbackChain as never, brokenRedis);
+
+    // refreshRates() calls redis.setex first — expect typed Error, not a crash
+    await expect(service.refreshRates()).rejects.toBeInstanceOf(Error);
+  });
+});
diff --git a/apps/api/test/rates-refresh.integration.test.ts b/apps/api/test/rates-refresh.integration.test.ts
new file mode 100644
index 0000000..0d05ead
--- /dev/null
+++ b/apps/api/test/rates-refresh.integration.test.ts
@@ -0,0 +1,272 @@
+// apps/api/test/rates-refresh.integration.test.ts
+//
+// Integration tests for PricingService.refreshRates() and GET /api/v1/rates/current.
+// Uses a real Postgres testcontainer + ioredis-mock.
+//
+// NOTE: ioredis-mock shares a global in-memory store across all instances within
+// the same Node process. Each test group calls redis.flushall() in beforeAll to
+// start from a clean slate.
+//
+// Tier: Class A integration test — money columns, rates persistence, platform audit.
+// Pattern: instantiate PricingService directly (no NestJS DI bootstrap).
+
+import { describe, it, expect, beforeAll, afterAll } from 'vitest';
+import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
+import { Pool } from 'pg';
+import { resolve } from 'node:path';
+import IoredisMock from 'ioredis-mock';
+import request from 'supertest';
+import { Test } from '@nestjs/testing';
+import type { INestApplication } from '@nestjs/common';
+import { Module } from '@nestjs/common';
+import { createPool, runMigrations } from '@goldsmith/db';
+import {
+  IbjaAdapter,
+  MetalsDevAdapter,
+  CircuitBreaker,
+  FallbackChain,
+  LastKnownGoodCache,
+  type PurityRates,
+} from '@goldsmith/rates';
+import { PricingService } from '../src/modules/pricing/pricing.service';
+import { PricingController } from '../src/modules/pricing/pricing.controller';
+
+// ---------------------------------------------------------------------------
+// Fixtures
+// ---------------------------------------------------------------------------
+
+// test/ is 3 levels deep from the monorepo root: apps/api/test
+const MIGRATIONS_DIR = resolve(
+  __dirname,
+  '../../../packages/db/src/migrations',
+);
+
+// A fake IbjaAdapter that always throws — used in fallback tests
+class FailingIbjaAdapter extends IbjaAdapter {
+  protected override async _fetch(): Promise<PurityRates> {
+    throw new Error('Simulated IBJA failure');
+  }
+}
+
+// ---------------------------------------------------------------------------
+// Shared Postgres testcontainer — one container for all tests in this file
+// ---------------------------------------------------------------------------
+
+let container: StartedPostgreSqlContainer;
+let pool: Pool;
+let sharedRedis: InstanceType<typeof IoredisMock>;
+
+beforeAll(async () => {
+  container = await new PostgreSqlContainer('postgres:15.6').start();
+  pool = createPool({ connectionString: container.getConnectionUri() });
+  await runMigrations(pool, MIGRATIONS_DIR);
+  // Single ioredis-mock instance shared across all helpers
+  // (ioredis-mock is process-global; using one instance makes the flush contract explicit)
+  sharedRedis = new IoredisMock();
+}, 120_000);
+
+afterAll(async () => {
+  await pool?.end();
+  await container?.stop();
+});
+
+// ---------------------------------------------------------------------------
+// Helper: build a PricingService from components using sharedRedis
+// ---------------------------------------------------------------------------
+
+function buildService(
+  ibjaOverride?: IbjaAdapter,
+): PricingService {
+  const redis = sharedRedis;
+  const lkg = new LastKnownGoodCache(redis as never);
+  const ibja = ibjaOverride ?? new IbjaAdapter();
+  const metalsdev = new MetalsDevAdapter();
+  const ibjaCb = new CircuitBreaker(ibja, redis as never);
+  const metalsdevCb = new CircuitBreaker(metalsdev, redis as never);
+  const chain = new FallbackChain(ibjaCb, metalsdevCb, lkg, console);
+  return new PricingService(pool as never, chain, redis as never);
+}
+
+// ---------------------------------------------------------------------------
+// Test 1: Full refresh cycle — happy path
+// ---------------------------------------------------------------------------
+
+describe('PricingService.refreshRates() — happy path', () => {
+  beforeAll(async () => {
+    // Clean slate: remove any rates keys left by previous test groups
+    await sharedRedis.flushall();
+    // Truncate snapshot table so rowCount assertions are exact (not cumulative across groups)
+    await pool.query('TRUNCATE ibja_rate_snapshots');
+  });
+
+  it('writes rates:current to Redis and inserts a snapshot row with source=ibja', async () => {
+    // IbjaAdapter and MetalsDevAdapter are MVP stubs (no live HTTP) — always return GOLD_24K = 735000n paise
+    const service = buildService();
+
+    await service.refreshRates();
+
+    // Verify Redis cache key
+    const cached = await sharedRedis.get('rates:current');
+    expect(cached).not.toBeNull();
+
+    const parsed = JSON.parse(cached!) as { GOLD_24K: { perGramPaise: string }; stale: boolean; source: string };
+    expect(parsed.GOLD_24K.perGramPaise).toBe('735000');
+    expect(parsed.stale).toBe(false);
+
+    // Verify snapshot row in Postgres (superuser pool — no RLS; platform-global table)
+    const rows = await pool.query<{
+      source: string;
+      gold_24k_paise: string;
+    }>(
+      `SELECT source, gold_24k_paise FROM ibja_rate_snapshots ORDER BY fetched_at DESC LIMIT 1`,
+    );
+    expect(rows.rowCount).toBe(1);
+    // IbjaAdapter served the rates — source must be 'ibja' (the winning adapter's name)
+    expect(rows.rows[0].source).toBe('ibja');
+    expect(rows.rows[0].gold_24k_paise).toBe('735000');
+  });
+});
+
+// ---------------------------------------------------------------------------
+// Test 2: Fallback chain — IBJA fails → MetalsDev serves
+// ---------------------------------------------------------------------------
+
+describe('PricingService.refreshRates() — IBJA fails, MetalsDev serves', () => {
+  beforeAll(async () => {
+    await sharedRedis.flushall();
+    // Truncate snapshot table so rowCount assertions are exact (not cumulative across groups)
+    await pool.query('TRUNCATE ibja_rate_snapshots');
+  });
+
+  it('inserts snapshot and caches valid rates when IBJA adapter throws', async () => {
+    // IbjaAdapter and MetalsDevAdapter are MVP stubs (no live HTTP) — always return GOLD_24K = 735000n paise
+    const service = buildService(new FailingIbjaAdapter());
+
+    await service.refreshRates();
+
+    // Redis should have fresh rates
+    const cached = await sharedRedis.get('rates:current');
+    expect(cached).not.toBeNull();
+
+    const parsed = JSON.parse(cached!) as { GOLD_24K: { perGramPaise: string }; source: string };
+    // MetalsDev stub also returns 735000n — both stubs have the same value
+    expect(parsed.GOLD_24K.perGramPaise).toBe('735000');
+    // IBJA failed → MetalsDev served → source must be 'metalsdev'
+    expect(parsed.source).toBe('metalsdev');
+
+    // Snapshot must exist in DB (MetalsDev served)
+    const rows = await pool.query<{ source: string; gold_24k_paise: string }>(
+      `SELECT source, gold_24k_paise FROM ibja_rate_snapshots ORDER BY fetched_at DESC LIMIT 1`,
+    );
+    expect(rows.rowCount).toBe(1);
+    expect(rows.rows[0].source).toBe('metalsdev');
+    expect(rows.rows[0].gold_24k_paise).toBe('735000');
+  });
+});
+
+// ---------------------------------------------------------------------------
+// Test 3: GET /api/v1/rates/current — reads from Redis cache
+// ---------------------------------------------------------------------------
+
+describe('GET /api/v1/rates/current — cache hit', () => {
+  let app: INestApplication;
+
+  beforeAll(async () => {
+    await sharedRedis.flushall();
+
+    // Pre-populate Redis with valid serialized rates
+    const now = new Date().toISOString();
+    const payload = JSON.stringify({
+      GOLD_24K: { perGramPaise: '735000', fetchedAt: now },
+      GOLD_22K: { perGramPaise: '673750', fetchedAt: now },
+      GOLD_20K: { perGramPaise: '612500', fetchedAt: now },
+      GOLD_18K: { perGramPaise: '551250', fetchedAt: now },
+      GOLD_14K: { perGramPaise: '428750', fetchedAt: now },
+      SILVER_999: { perGramPaise: '9500',  fetchedAt: now },
+      SILVER_925: { perGramPaise: '8788',  fetchedAt: now },
+      stale: false,
+      source: 'ibja',
+    });
+    await sharedRedis.setex('rates:current', 900, payload);
+
+    const pricingService = buildService();
+
+    @Module({
+      controllers: [PricingController],
+      providers: [
+        { provide: PricingService, useValue: pricingService },
+      ],
+    })
+    class TestPricingModule {}
+
+    const moduleRef = await Test.createTestingModule({
+      imports: [TestPricingModule],
+    }).compile();
+
+    app = moduleRef.createNestApplication();
+    await app.init();
+  }, 30_000);
+
+  afterAll(async () => {
+    await app?.close();
+  });
+
+  it('returns 200 with GOLD_24K.perGramPaise as string and stale as boolean', async () => {
+    const res = await request(app.getHttpServer())
+      .get('/api/v1/rates/current')
+      .expect(200);
+
+    expect(typeof res.body.GOLD_24K.perGramPaise).toBe('string');
+    expect(res.body.GOLD_24K.perGramPaise).toBe('735000');
+    expect(typeof res.body.stale).toBe('boolean');
+    expect(res.body.source).toBe('ibja');
+  });
+
+  it('response shape includes perGramRupees (formatted) and fetchedAt (ISO string)', async () => {
+    const res = await request(app.getHttpServer())
+      .get('/api/v1/rates/current')
+      .expect(200);
+
+    // 735000 paise = 7350 rupees
+    expect(res.body.GOLD_24K.perGramRupees).toBe('7350.00');
+    expect(res.body.GOLD_24K.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
+  });
+});
+
+// ---------------------------------------------------------------------------
+// Test 4: Circuit breaker integration — 5 failures → IBJA CB opens
+// ---------------------------------------------------------------------------
+
+describe('CircuitBreaker integration — IBJA opens after 5 failures', () => {
+  beforeAll(async () => {
+    await sharedRedis.flushall();
+  });
+
+  it('IBJA CB is OPEN in Redis after 5 consecutive failures; MetalsDev continues to serve', async () => {
+    const redis = sharedRedis;
+    const ibja = new FailingIbjaAdapter();
+    const metalsdev = new MetalsDevAdapter();
+    const ibjaCb = new CircuitBreaker(ibja, redis as never);
+    const metalsdevCb = new CircuitBreaker(metalsdev, redis as never);
+    const lkg = new LastKnownGoodCache(redis as never);
+    const chain = new FallbackChain(ibjaCb, metalsdevCb, lkg, console);
+
+    // Call FallbackChain 5 times. Each call: IBJA fails → MetalsDev serves.
+    // CircuitBreaker records a failure for IBJA on each call.
+    for (let i = 0; i < 5; i++) {
+      const result = await chain.getRatesByPurity();
+      expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+      expect(result.source).toBe('metalsdev');
+    }
+
+    // After 5 failures CircuitBreaker should have opened (threshold = 5)
+    const cbState = await redis.get('cb:ibja:state');
+    expect(cbState).toBe('OPEN');
+
+    // One more call: IBJA circuit is OPEN (cooldown=120s not elapsed),
+    // throws CircuitOpenError. FallbackChain catches it and falls to MetalsDev.
+    const result = await chain.getRatesByPurity();
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.source).toBe('metalsdev');
+  });
+});
diff --git a/packages/audit/src/audit-actions.ts b/packages/audit/src/audit-actions.ts
index 6b3be9d..bde57d6 100644
--- a/packages/audit/src/audit-actions.ts
+++ b/packages/audit/src/audit-actions.ts
@@ -23,4 +23,6 @@ export enum AuditAction {
   STAFF_ACTIVATED          = 'STAFF_ACTIVATED',
   ACCESS_DENIED            = 'ACCESS_DENIED',
   PERMISSIONS_UPDATED      = 'PERMISSIONS_UPDATED',
+  PRICING_RATES_REFRESHED  = 'PRICING_RATES_REFRESHED',
+  PRICING_RATES_FALLBACK   = 'PRICING_RATES_FALLBACK',
 }
diff --git a/packages/db/src/migrations/0015_rates_foundation.sql b/packages/db/src/migrations/0015_rates_foundation.sql
new file mode 100644
index 0000000..06bef16
--- /dev/null
+++ b/packages/db/src/migrations/0015_rates_foundation.sql
@@ -0,0 +1,20 @@
+-- ibja_rate_snapshots: platform-global gold/silver rate history (no RLS)
+CREATE TABLE ibja_rate_snapshots (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  fetched_at timestamptz NOT NULL,
+  source text NOT NULL,
+  gold_24k_paise bigint NOT NULL,
+  gold_22k_paise bigint NOT NULL,
+  gold_20k_paise bigint NOT NULL,
+  gold_18k_paise bigint NOT NULL,
+  gold_14k_paise bigint NOT NULL,
+  silver_999_paise bigint NOT NULL,
+  silver_925_paise bigint NOT NULL,
+  stale boolean NOT NULL DEFAULT false,
+  created_at timestamptz NOT NULL DEFAULT now()
+);
+
+GRANT SELECT, INSERT ON ibja_rate_snapshots TO app_user;
+
+CREATE INDEX idx_ibja_rate_snapshots_fetched_at
+  ON ibja_rate_snapshots(fetched_at DESC);
diff --git a/packages/db/src/schema/_helpers/helpers.test.ts b/packages/db/src/schema/_helpers/helpers.test.ts
index c250f19..838a1f6 100644
--- a/packages/db/src/schema/_helpers/helpers.test.ts
+++ b/packages/db/src/schema/_helpers/helpers.test.ts
@@ -2,7 +2,7 @@ import { describe, it, expect, beforeEach } from 'vitest';
 import { uuid, text } from 'drizzle-orm/pg-core';
 import { tenantScopedTable } from './tenantScopedTable';
 import { tenantSingletonTable } from './tenantSingletonTable';
-import { platformGlobalTable } from './platformGlobalTable';
+import { platformGlobalTable, platformGlobalTableWithRls } from './platformGlobalTable';
 import { tableRegistry } from './registry';
 
 beforeEach(() => tableRegistry.clear());
@@ -39,6 +39,15 @@ describe('platformGlobalTable', () => {
   });
 });
 
+describe('platformGlobalTableWithRls', () => {
+  it('registers metadata with kind=global-rls', () => {
+    platformGlobalTableWithRls('shops', { id: uuid('id').primaryKey() });
+    expect(tableRegistry.list()).toEqual([
+      { name: 'shops', kind: 'global-rls', encryptedColumns: [] },
+    ]);
+  });
+});
+
 describe('tenantSingletonTable', () => {
   it('registers metadata with kind=tenant', () => {
     tenantSingletonTable('preferences', { theme: text('theme') });
diff --git a/packages/db/src/schema/_helpers/platformGlobalTable.ts b/packages/db/src/schema/_helpers/platformGlobalTable.ts
index 5814863..86d735c 100644
--- a/packages/db/src/schema/_helpers/platformGlobalTable.ts
+++ b/packages/db/src/schema/_helpers/platformGlobalTable.ts
@@ -11,3 +11,21 @@ export function platformGlobalTable<N extends string, C extends ColumnBuilders>(
   tableRegistry.register({ name, kind: 'global', encryptedColumns: [] });
   return pgTable(name, columns);
 }
+
+/**
+ * Like platformGlobalTable but for tables that intentionally have RLS enabled
+ * for scoped DML (e.g. shops: SELECT is unrestricted / platform-global, but
+ * UPDATE is tenant-scoped so shopkeepers can only update their own row).
+ *
+ * The tenant-isolation invariant checker treats 'global-rls' as global for
+ * data-isolation purposes (no shop_id policy required) while allowing RLS to
+ * be present in the DB.
+ */
+// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
+export function platformGlobalTableWithRls<N extends string, C extends ColumnBuilders>(
+  name: N,
+  columns: C,
+) {
+  tableRegistry.register({ name, kind: 'global-rls', encryptedColumns: [] });
+  return pgTable(name, columns);
+}
diff --git a/packages/db/src/schema/_helpers/registry.ts b/packages/db/src/schema/_helpers/registry.ts
index 93cf07d..fb83512 100644
--- a/packages/db/src/schema/_helpers/registry.ts
+++ b/packages/db/src/schema/_helpers/registry.ts
@@ -1,4 +1,11 @@
-export type TableKind = 'tenant' | 'global';
+/**
+ * 'tenant'     — tenant-scoped table: RLS + FORCE RLS required, shop_id policy required
+ * 'global'     — platform-global table: must have NO RLS (unrestricted reads/writes via superuser)
+ * 'global-rls' — platform-global table that intentionally has RLS for scoped DML
+ *                (e.g. shops: SELECT unrestricted, UPDATE scoped to own shop).
+ *                Invariant checker skips the no-RLS assertion for this kind.
+ */
+export type TableKind = 'tenant' | 'global' | 'global-rls';
 export interface TableMeta {
   name: string;
   kind: TableKind;
diff --git a/packages/db/src/schema/ibja-rate-snapshots.ts b/packages/db/src/schema/ibja-rate-snapshots.ts
new file mode 100644
index 0000000..e701e45
--- /dev/null
+++ b/packages/db/src/schema/ibja-rate-snapshots.ts
@@ -0,0 +1,17 @@
+import { uuid, timestamp, text, bigint, boolean } from 'drizzle-orm/pg-core';
+import { platformGlobalTable } from './_helpers/platformGlobalTable';
+
+export const ibjaRateSnapshots = platformGlobalTable('ibja_rate_snapshots', {
+  id: uuid('id').primaryKey().defaultRandom(),
+  fetched_at: timestamp('fetched_at', { withTimezone: true }).notNull(),
+  source: text('source').notNull(),
+  gold_24k_paise: bigint('gold_24k_paise', { mode: 'bigint' }).notNull(),
+  gold_22k_paise: bigint('gold_22k_paise', { mode: 'bigint' }).notNull(),
+  gold_20k_paise: bigint('gold_20k_paise', { mode: 'bigint' }).notNull(),
+  gold_18k_paise: bigint('gold_18k_paise', { mode: 'bigint' }).notNull(),
+  gold_14k_paise: bigint('gold_14k_paise', { mode: 'bigint' }).notNull(),
+  silver_999_paise: bigint('silver_999_paise', { mode: 'bigint' }).notNull(),
+  silver_925_paise: bigint('silver_925_paise', { mode: 'bigint' }).notNull(),
+  stale: boolean('stale').notNull().default(false),
+  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
+});
diff --git a/packages/db/src/schema/index.ts b/packages/db/src/schema/index.ts
index 8cb5e7d..a118c2b 100644
--- a/packages/db/src/schema/index.ts
+++ b/packages/db/src/schema/index.ts
@@ -7,3 +7,4 @@ export * from './platform-audit-events';
 export { tableRegistry } from './_helpers/registry';
 export type { TableMeta, TableKind } from './_helpers/registry';
 export * from './role-permissions';
+export * from './ibja-rate-snapshots';
diff --git a/packages/db/src/schema/shops.ts b/packages/db/src/schema/shops.ts
index 140445e..fa17979 100644
--- a/packages/db/src/schema/shops.ts
+++ b/packages/db/src/schema/shops.ts
@@ -1,9 +1,12 @@
 import { uuid, text, timestamp, jsonb, pgEnum, integer } from 'drizzle-orm/pg-core';
-import { platformGlobalTable } from './_helpers/platformGlobalTable';
+import { platformGlobalTableWithRls } from './_helpers/platformGlobalTable';
 
 export const shopStatusEnum = pgEnum('shop_status', ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']);
 
-export const shops = platformGlobalTable('shops', {
+// shops is platform-global for SELECT (auth lookups read all shops) but has
+// RLS enabled for UPDATE so shopkeepers can only update their own shop row
+// (migration 0013). Use platformGlobalTableWithRls to register as 'global-rls'.
+export const shops = platformGlobalTableWithRls('shops', {
   id: uuid('id').primaryKey().defaultRandom(),
   slug: text('slug').notNull().unique(),
   display_name: text('display_name').notNull(),
diff --git a/packages/integrations/rates/package.json b/packages/integrations/rates/package.json
new file mode 100644
index 0000000..61472bd
--- /dev/null
+++ b/packages/integrations/rates/package.json
@@ -0,0 +1,20 @@
+{
+  "name": "@goldsmith/rates",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "scripts": {
+    "typecheck": "tsc --noEmit",
+    "lint": "eslint src",
+    "test": "vitest run"
+  },
+  "dependencies": {
+    "@goldsmith/cache": "workspace:*",
+    "ioredis": "^5.3.0"
+  },
+  "devDependencies": {
+    "vitest": "^1.4.0",
+    "ioredis-mock": "^8.9.0",
+    "typescript": "^5.4.0"
+  }
+}
diff --git a/packages/integrations/rates/src/circuit-breaker.spec.ts b/packages/integrations/rates/src/circuit-breaker.spec.ts
new file mode 100644
index 0000000..790db48
--- /dev/null
+++ b/packages/integrations/rates/src/circuit-breaker.spec.ts
@@ -0,0 +1,162 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import RedisMock from 'ioredis-mock';
+import type { Redis } from 'ioredis';
+import { CircuitBreaker } from './circuit-breaker';
+import { CircuitOpenError, RatesAdapterError } from './errors';
+import type { RatesPort, PurityRates, RatesResult } from './port';
+
+const STUB_RATES: PurityRates = {
+  GOLD_24K: { perGramPaise: 735000n, fetchedAt: new Date() },
+  GOLD_22K: { perGramPaise: 673750n, fetchedAt: new Date() },
+  GOLD_20K: { perGramPaise: 612500n, fetchedAt: new Date() },
+  GOLD_18K: { perGramPaise: 551250n, fetchedAt: new Date() },
+  GOLD_14K: { perGramPaise: 428750n, fetchedAt: new Date() },
+  SILVER_999: { perGramPaise: 9500n, fetchedAt: new Date() },
+  SILVER_925: { perGramPaise: 8788n, fetchedAt: new Date() },
+};
+
+const STUB_RESULT: RatesResult = { rates: STUB_RATES, source: 'test', stale: false };
+
+function makeAdapter(name: string, impl: () => Promise<RatesResult>): RatesPort {
+  return { getName: () => name, getRatesByPurity: impl };
+}
+
+/** Helper: trip the circuit by calling the CB with a failing adapter 5 times sequentially. */
+async function tripCircuit(cb: CircuitBreaker): Promise<void> {
+  for (let i = 0; i < 5; i++) {
+    await cb.getRatesByPurity().catch(() => {
+      /* expected */
+    });
+  }
+}
+
+/** Helper: directly set the opened_at key in Redis to a time 200s in the past so cooldown has elapsed. */
+async function backdateOpenedAt(redis: Redis, adapterName: string): Promise<void> {
+  const pastTs = Date.now() - 200_000;
+  await redis.set(`cb:${adapterName}:opened_at`, String(pastTs));
+}
+
+describe('CircuitBreaker', () => {
+  let redis: Redis;
+  let successAdapter: RatesPort;
+  let failAdapter: RatesPort;
+
+  beforeEach(async () => {
+    redis = new RedisMock() as unknown as Redis;
+    // ioredis-mock shares context across instances with the same host:port/db.
+    // Flush the shared store before each test to ensure clean state.
+    await redis.flushall();
+    successAdapter = makeAdapter('test', async () => STUB_RESULT);
+    failAdapter = makeAdapter('test', async () => {
+      throw new RatesAdapterError('test', new Error('network error'));
+    });
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it('starts in CLOSED state', async () => {
+    const cb = new CircuitBreaker(successAdapter, redis);
+    const result = await cb.getRatesByPurity();
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+  });
+
+  it('CLOSED→OPEN after 5 consecutive failures within 60s', async () => {
+    const cb = new CircuitBreaker(failAdapter, redis);
+
+    // First 5 calls should throw RatesAdapterError (pass-through)
+    for (let i = 0; i < 5; i++) {
+      await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
+    }
+
+    // 6th call: circuit is OPEN → CircuitOpenError
+    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
+  });
+
+  it('OPEN state rejects with CircuitOpenError without calling fn', async () => {
+    const cb = new CircuitBreaker(failAdapter, redis);
+
+    // Trip the circuit
+    for (let i = 0; i < 5; i++) {
+      await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
+    }
+
+    const spy = vi.spyOn(failAdapter, 'getRatesByPurity');
+    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
+    expect(spy).not.toHaveBeenCalled();
+  });
+
+  it('OPEN→HALF_OPEN after 120s cooldown', async () => {
+    const cb = new CircuitBreaker(failAdapter, redis);
+
+    // Trip the circuit
+    await tripCircuit(cb);
+
+    // Verify OPEN
+    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
+
+    // Backdate opened_at to simulate 200s elapsed (> 120s cooldown)
+    await backdateOpenedAt(redis, 'test');
+
+    // After cooldown, a HALF_OPEN probe with success adapter should succeed
+    const healedCb = new CircuitBreaker(successAdapter, redis);
+    const result = await healedCb.getRatesByPurity();
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+  });
+
+  it('HALF_OPEN: successful probe → returns to CLOSED', async () => {
+    const cb = new CircuitBreaker(failAdapter, redis);
+    await tripCircuit(cb);
+
+    // Backdate to get past cooldown
+    await backdateOpenedAt(redis, 'test');
+
+    // Use success adapter — probe succeeds → CLOSED
+    const healedCb = new CircuitBreaker(successAdapter, redis);
+    await healedCb.getRatesByPurity(); // probe (OPEN → HALF_OPEN probe → CLOSED)
+    // Another call: should be normal CLOSED (not a probe)
+    await healedCb.getRatesByPurity();
+  });
+
+  it('HALF_OPEN: failed probe → returns to OPEN', async () => {
+    const cb = new CircuitBreaker(failAdapter, redis);
+    await tripCircuit(cb);
+
+    // Backdate to get past cooldown
+    await backdateOpenedAt(redis, 'test');
+
+    // Still failing adapter — probe fails → back to OPEN
+    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
+    // Next call should be CircuitOpenError again (circuit is OPEN again, opened_at reset to now)
+    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
+  });
+
+  it("concurrent spike: multiple simultaneous failures don't double-open", async () => {
+    const cb = new CircuitBreaker(failAdapter, redis);
+
+    // Fire 10 concurrent requests; circuit opens during this batch.
+    // In JS, since getState() checks are interleaved before any failures are recorded,
+    // all 10 calls pass through to the adapter. After the 5th failure is recorded,
+    // the circuit opens. All 10 calls eventually throw RatesAdapterError (they already
+    // past the state check). But the circuit MUST be in OPEN state afterwards.
+    const results = await Promise.allSettled(
+      Array.from({ length: 10 }, () => cb.getRatesByPurity()),
+    );
+
+    // All rejections must be either RatesAdapterError or CircuitOpenError
+    const failures = results.filter(r => r.status === 'rejected');
+    expect(failures).toHaveLength(10);
+
+    const unknownErrors = failures.filter(
+      r =>
+        r.status === 'rejected' &&
+        !(r.reason instanceof RatesAdapterError) &&
+        !(r.reason instanceof CircuitOpenError),
+    );
+    expect(unknownErrors).toHaveLength(0);
+
+    // After the concurrent spike, the circuit must be OPEN (not double-opened or in bad state)
+    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
+  });
+});
diff --git a/packages/integrations/rates/src/circuit-breaker.ts b/packages/integrations/rates/src/circuit-breaker.ts
new file mode 100644
index 0000000..b12a826
--- /dev/null
+++ b/packages/integrations/rates/src/circuit-breaker.ts
@@ -0,0 +1,122 @@
+import type { Redis } from 'ioredis';
+import type { RatesPort, RatesResult } from './port';
+import { CircuitOpenError, RatesAdapterError } from './errors';
+
+const FAILURE_THRESHOLD = 5;
+const FAILURE_WINDOW_SEC = 60;
+const COOLDOWN_SEC = 120;
+
+type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
+
+export class CircuitBreaker implements RatesPort {
+  private readonly keyState: string;
+  private readonly keyFailures: string;
+  private readonly keyOpenedAt: string;
+
+  constructor(
+    private readonly adapter: RatesPort,
+    private readonly redis: Redis,
+  ) {
+    const name = adapter.getName();
+    this.keyState = `cb:${name}:state`;
+    this.keyFailures = `cb:${name}:failures`;
+    this.keyOpenedAt = `cb:${name}:opened_at`;
+  }
+
+  getName(): string {
+    return this.adapter.getName();
+  }
+
+  private async getState(): Promise<CircuitState> {
+    const raw = await this.redis.get(this.keyState);
+    if (raw === 'OPEN' || raw === 'HALF_OPEN') return raw;
+    return 'CLOSED';
+  }
+
+  private async setState(state: CircuitState): Promise<void> {
+    if (state === 'OPEN') {
+      await this.redis.set(this.keyState, state, 'EX', COOLDOWN_SEC * 4);
+    } else if (state === 'HALF_OPEN') {
+      await this.redis.set(this.keyState, state, 'EX', COOLDOWN_SEC);
+    } else {
+      // CLOSED: delete the key; missing → CLOSED in getState()
+      await this.redis.del(this.keyState);
+    }
+  }
+
+  private async resetFailures(): Promise<void> {
+    await this.redis.del(this.keyFailures);
+    await this.redis.del(this.keyOpenedAt);
+  }
+
+  private async recordFailure(): Promise<void> {
+    const count = await this.redis.incr(this.keyFailures);
+    if (count === 1) {
+      // First failure in this window — set TTL
+      await this.redis.expire(this.keyFailures, FAILURE_WINDOW_SEC);
+    }
+    if (count >= FAILURE_THRESHOLD) {
+      const alreadyOpen = await this.redis.get(this.keyState);
+      if (alreadyOpen !== 'OPEN') {
+        await this.redis.set(this.keyOpenedAt, String(Date.now()), 'NX');
+        await this.setState('OPEN');
+      }
+    }
+  }
+
+  private async checkCooldownElapsed(): Promise<boolean> {
+    const openedAt = await this.redis.get(this.keyOpenedAt);
+    if (!openedAt) return true;
+    const elapsed = (Date.now() - Number(openedAt)) / 1000;
+    return elapsed >= COOLDOWN_SEC;
+  }
+
+  async getRatesByPurity(): Promise<RatesResult> {
+    const state = await this.getState();
+
+    if (state === 'OPEN') {
+      const elapsed = await this.checkCooldownElapsed();
+      if (elapsed) {
+        await this.setState('HALF_OPEN');
+        return this.probe();
+      }
+      throw new CircuitOpenError(this.adapter.getName());
+    }
+
+    if (state === 'HALF_OPEN') {
+      return this.probe();
+    }
+
+    // CLOSED
+    return this.callAdapter();
+  }
+
+  private async probe(): Promise<RatesResult> {
+    try {
+      const result = await this.adapter.getRatesByPurity();
+      // Success → CLOSED
+      await this.setState('CLOSED');
+      await this.resetFailures();
+      return result;
+    } catch (err) {
+      // Failure → back to OPEN
+      await this.setState('OPEN');
+      await this.redis.set(this.keyOpenedAt, String(Date.now()));
+      if (err instanceof RatesAdapterError) throw err;
+      throw new RatesAdapterError(this.adapter.getName(), err);
+    }
+  }
+
+  private async callAdapter(): Promise<RatesResult> {
+    try {
+      const result = await this.adapter.getRatesByPurity();
+      // Success in CLOSED — reset failures
+      await this.redis.del(this.keyFailures);
+      return result;
+    } catch (err) {
+      await this.recordFailure();
+      if (err instanceof RatesAdapterError) throw err;
+      throw new RatesAdapterError(this.adapter.getName(), err);
+    }
+  }
+}
diff --git a/packages/integrations/rates/src/errors.ts b/packages/integrations/rates/src/errors.ts
new file mode 100644
index 0000000..cafed8b
--- /dev/null
+++ b/packages/integrations/rates/src/errors.ts
@@ -0,0 +1,21 @@
+export class RatesAdapterError extends Error {
+  constructor(public readonly adapter: string, cause?: unknown) {
+    super(`Rates adapter '${adapter}' failed`);
+    this.name = 'RatesAdapterError';
+    if (cause !== undefined) this.cause = cause;
+  }
+}
+
+export class CircuitOpenError extends Error {
+  constructor(public readonly adapter: string) {
+    super(`Circuit breaker open for adapter '${adapter}'`);
+    this.name = 'CircuitOpenError';
+  }
+}
+
+export class RatesUnavailableError extends Error {
+  constructor() {
+    super('All rate sources unavailable');
+    this.name = 'RatesUnavailableError';
+  }
+}
diff --git a/packages/integrations/rates/src/fallback-chain.spec.ts b/packages/integrations/rates/src/fallback-chain.spec.ts
new file mode 100644
index 0000000..83fcb07
--- /dev/null
+++ b/packages/integrations/rates/src/fallback-chain.spec.ts
@@ -0,0 +1,108 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest';
+import RedisMock from 'ioredis-mock';
+import type { Redis } from 'ioredis';
+import { FallbackChain } from './fallback-chain';
+import { LastKnownGoodCache } from './last-known-good-cache';
+import { RatesAdapterError, RatesUnavailableError } from './errors';
+import type { RatesPort, PurityRates, RatesResult } from './port';
+
+const STUB_RATES: PurityRates = {
+  GOLD_24K: { perGramPaise: 735000n, fetchedAt: new Date() },
+  GOLD_22K: { perGramPaise: 673750n, fetchedAt: new Date() },
+  GOLD_20K: { perGramPaise: 612500n, fetchedAt: new Date() },
+  GOLD_18K: { perGramPaise: 551250n, fetchedAt: new Date() },
+  GOLD_14K: { perGramPaise: 428750n, fetchedAt: new Date() },
+  SILVER_999: { perGramPaise: 9500n, fetchedAt: new Date() },
+  SILVER_925: { perGramPaise: 8788n, fetchedAt: new Date() },
+};
+
+function makeAdapter(name: string, impl: () => Promise<RatesResult>): RatesPort {
+  return { getName: () => name, getRatesByPurity: impl };
+}
+
+const noopLogger = {
+  log: vi.fn(),
+  warn: vi.fn(),
+  error: vi.fn(),
+};
+
+describe('FallbackChain', () => {
+  let redis: Redis;
+  let lkg: LastKnownGoodCache;
+  let primarySuccess: RatesPort;
+  let adapterFail: RatesPort;
+
+  beforeEach(async () => {
+    redis = new RedisMock() as unknown as Redis;
+    // ioredis-mock shares context across instances with the same host:port/db.
+    // Flush the shared store before each test to ensure clean state.
+    await redis.flushall();
+    lkg = new LastKnownGoodCache(redis);
+    primarySuccess = makeAdapter('ibja', async () => ({ rates: STUB_RATES, source: 'ibja', stale: false }));
+    adapterFail = makeAdapter('fail', async () => {
+      throw new RatesAdapterError('fail', new Error('network error'));
+    });
+    vi.clearAllMocks();
+  });
+
+  it('primary success: returns rates, no fallback called', async () => {
+    const secondary = makeAdapter('metalsdev', async () => {
+      throw new Error('should not be called');
+    });
+    const secondarySpy = vi.spyOn(secondary, 'getRatesByPurity');
+
+    const chain = new FallbackChain(primarySuccess, secondary, lkg, noopLogger);
+    const result = await chain.getRatesByPurity();
+
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.source).toBe('ibja');
+    expect(result.stale).toBe(false);
+    expect(secondarySpy).not.toHaveBeenCalled();
+  });
+
+  it('primary fails: secondary called, returns rates', async () => {
+    const secondarySuccess = makeAdapter('metalsdev', async () => ({ rates: STUB_RATES, source: 'metalsdev', stale: false }));
+    const secondarySpy = vi.spyOn(secondarySuccess, 'getRatesByPurity');
+
+    const chain = new FallbackChain(adapterFail, secondarySuccess, lkg, noopLogger);
+    const result = await chain.getRatesByPurity();
+
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.source).toBe('metalsdev');
+    expect(secondarySpy).toHaveBeenCalledOnce();
+  });
+
+  it('both adapters fail: LastKnownGoodCache returns stale rates with stale:true', async () => {
+    // Pre-populate the cache
+    await lkg.update(STUB_RATES);
+
+    // Use fake timers to make cache stale
+    vi.useFakeTimers();
+    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
+
+    const chain = new FallbackChain(adapterFail, adapterFail, lkg, noopLogger);
+    const result = await chain.getRatesByPurity();
+
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.source).toBe('last_known_good');
+    expect(result.stale).toBe(true);
+
+    vi.useRealTimers();
+  });
+
+  it('all sources fail: throws RatesUnavailableError', async () => {
+    // Empty cache (nothing stored)
+    const chain = new FallbackChain(adapterFail, adapterFail, lkg, noopLogger);
+    await expect(chain.getRatesByPurity()).rejects.toBeInstanceOf(RatesUnavailableError);
+  });
+
+  it('successful primary fetch: updates LastKnownGoodCache with the PurityRates (not the full result)', async () => {
+    const updateSpy = vi.spyOn(lkg, 'update');
+
+    const chain = new FallbackChain(primarySuccess, adapterFail, lkg, noopLogger);
+    await chain.getRatesByPurity();
+
+    expect(updateSpy).toHaveBeenCalledOnce();
+    expect(updateSpy).toHaveBeenCalledWith(STUB_RATES);
+  });
+});
diff --git a/packages/integrations/rates/src/fallback-chain.ts b/packages/integrations/rates/src/fallback-chain.ts
new file mode 100644
index 0000000..0de0fb2
--- /dev/null
+++ b/packages/integrations/rates/src/fallback-chain.ts
@@ -0,0 +1,62 @@
+import type { RatesPort, RatesResult } from './port';
+import { RatesUnavailableError } from './errors';
+import type { LastKnownGoodCache } from './last-known-good-cache';
+
+interface RatesLogger {
+  log(message: string): void;
+  warn(message: string): void;
+  error(message: string): void;
+}
+
+export class FallbackChain implements RatesPort {
+  constructor(
+    private readonly primary: RatesPort,
+    private readonly secondary: RatesPort,
+    private readonly lastKnownGoodCache: LastKnownGoodCache,
+    private readonly logger: RatesLogger,
+  ) {}
+
+  getName(): string {
+    return 'fallback-chain';
+  }
+
+  async getRatesByPurity(): Promise<RatesResult> {
+    // Tier 1: primary adapter
+    try {
+      const result = await this.primary.getRatesByPurity();
+      this.logger.log(`Rates served by primary (${this.primary.getName()})`);
+      // Update LKG cache on success
+      await this.lastKnownGoodCache.update(result.rates);
+      return result;
+    } catch (primaryErr) {
+      this.logger.warn(
+        `Primary adapter (${this.primary.getName()}) failed: ${String(primaryErr)}`,
+      );
+    }
+
+    // Tier 2: secondary adapter
+    try {
+      const result = await this.secondary.getRatesByPurity();
+      this.logger.log(`Rates served by secondary (${this.secondary.getName()})`);
+      await this.lastKnownGoodCache.update(result.rates);
+      return result;
+    } catch (secondaryErr) {
+      this.logger.warn(
+        `Secondary adapter (${this.secondary.getName()}) failed: ${String(secondaryErr)}`,
+      );
+    }
+
+    // Tier 3: last-known-good cache
+    const cached = await this.lastKnownGoodCache.get();
+    if (cached !== null) {
+      this.logger.warn(
+        `Rates served from last-known-good cache (stale=${String(cached.stale)})`,
+      );
+      return { rates: cached.rates, source: 'last_known_good', stale: cached.stale };
+    }
+
+    // All sources exhausted
+    this.logger.error('All rate sources unavailable');
+    throw new RatesUnavailableError();
+  }
+}
diff --git a/packages/integrations/rates/src/ibja-adapter.spec.ts b/packages/integrations/rates/src/ibja-adapter.spec.ts
new file mode 100644
index 0000000..f4a2c5c
--- /dev/null
+++ b/packages/integrations/rates/src/ibja-adapter.spec.ts
@@ -0,0 +1,36 @@
+import { describe, it, expect, vi } from 'vitest';
+import { IbjaAdapter } from './ibja-adapter';
+import { RatesAdapterError } from './errors';
+
+describe('IbjaAdapter', () => {
+  it('returns correct paise values for all purities', async () => {
+    const adapter = new IbjaAdapter();
+    const result = await adapter.getRatesByPurity();
+
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.rates.GOLD_22K.perGramPaise).toBe(673750n);
+    expect(result.rates.GOLD_20K.perGramPaise).toBe(612500n);
+    expect(result.rates.GOLD_18K.perGramPaise).toBe(551250n);
+    expect(result.rates.GOLD_14K.perGramPaise).toBe(428750n);
+    expect(result.rates.SILVER_999.perGramPaise).toBe(9500n);
+    expect(result.rates.SILVER_925.perGramPaise).toBe(8788n);
+    expect(result.rates.GOLD_24K.fetchedAt).toBeInstanceOf(Date);
+    expect(result.source).toBe('ibja');
+    expect(result.stale).toBe(false);
+  });
+
+  it('getName() returns "ibja"', () => {
+    const adapter = new IbjaAdapter();
+    expect(adapter.getName()).toBe('ibja');
+  });
+
+  it('throws RatesAdapterError on network timeout', async () => {
+    const adapter = new IbjaAdapter();
+    // Override the internal fetch to simulate a timeout
+    vi.spyOn(adapter as unknown as { _fetch: () => Promise<unknown> }, '_fetch').mockRejectedValueOnce(
+      new Error('timeout'),
+    );
+    await expect(adapter.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
+    vi.restoreAllMocks();
+  });
+});
diff --git a/packages/integrations/rates/src/ibja-adapter.ts b/packages/integrations/rates/src/ibja-adapter.ts
new file mode 100644
index 0000000..19c656c
--- /dev/null
+++ b/packages/integrations/rates/src/ibja-adapter.ts
@@ -0,0 +1,45 @@
+// STUB: replace with real IBJA scraper/API when credentials obtained
+// See: https://www.ibja.co/ for API onboarding
+// GOLD_24K ≈ ₹7,350/g → 735000 paise
+import type { RatesPort, PurityRates, RatesResult } from './port';
+import { RatesAdapterError } from './errors';
+
+export class IbjaAdapter implements RatesPort {
+  getName(): string {
+    return 'ibja';
+  }
+
+  // Overridable in tests to simulate fetch failures
+  protected async _fetch(): Promise<PurityRates> {
+    const now = new Date();
+    return {
+      GOLD_24K: { perGramPaise: 735000n, fetchedAt: now },
+      GOLD_22K: { perGramPaise: 673750n, fetchedAt: now },
+      GOLD_20K: { perGramPaise: 612500n, fetchedAt: now },
+      GOLD_18K: { perGramPaise: 551250n, fetchedAt: now },
+      GOLD_14K: { perGramPaise: 428750n, fetchedAt: now },
+      SILVER_999: { perGramPaise: 9500n, fetchedAt: now },
+      SILVER_925: { perGramPaise: 8788n, fetchedAt: now },
+    };
+  }
+
+  async getRatesByPurity(): Promise<RatesResult> {
+    const TIMEOUT_MS = 5000;
+    let timer: ReturnType<typeof setTimeout>;
+    const timeoutPromise = new Promise<never>((_, reject) => {
+      timer = setTimeout(
+        () => reject(new RatesAdapterError(this.getName(), new Error('Request timeout'))),
+        TIMEOUT_MS,
+      );
+    });
+    try {
+      const rates = await Promise.race([this._fetch(), timeoutPromise]);
+      clearTimeout(timer!);
+      return { rates, source: this.getName(), stale: false };
+    } catch (err) {
+      clearTimeout(timer!);
+      if (err instanceof RatesAdapterError) throw err;
+      throw new RatesAdapterError(this.getName(), err);
+    }
+  }
+}
diff --git a/packages/integrations/rates/src/index.ts b/packages/integrations/rates/src/index.ts
new file mode 100644
index 0000000..827967f
--- /dev/null
+++ b/packages/integrations/rates/src/index.ts
@@ -0,0 +1,8 @@
+export type { PurityRates, RatesPort, RatesResult } from './port';
+export { RatesAdapterError, CircuitOpenError, RatesUnavailableError } from './errors';
+export { IbjaAdapter } from './ibja-adapter';
+export { MetalsDevAdapter } from './metalsdev-adapter';
+export { CircuitBreaker } from './circuit-breaker';
+export { LastKnownGoodCache } from './last-known-good-cache';
+export type { CachedRates } from './last-known-good-cache';
+export { FallbackChain } from './fallback-chain';
diff --git a/packages/integrations/rates/src/last-known-good-cache.spec.ts b/packages/integrations/rates/src/last-known-good-cache.spec.ts
new file mode 100644
index 0000000..fdc1c88
--- /dev/null
+++ b/packages/integrations/rates/src/last-known-good-cache.spec.ts
@@ -0,0 +1,79 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import RedisMock from 'ioredis-mock';
+import type { Redis } from 'ioredis';
+import { LastKnownGoodCache } from './last-known-good-cache';
+import type { PurityRates } from './port';
+
+const STUB_RATES: PurityRates = {
+  GOLD_24K: { perGramPaise: 735000n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
+  GOLD_22K: { perGramPaise: 673750n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
+  GOLD_20K: { perGramPaise: 612500n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
+  GOLD_18K: { perGramPaise: 551250n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
+  GOLD_14K: { perGramPaise: 428750n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
+  SILVER_999: { perGramPaise: 9500n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
+  SILVER_925: { perGramPaise: 8788n, fetchedAt: new Date('2026-04-23T10:00:00.000Z') },
+};
+
+describe('LastKnownGoodCache', () => {
+  let redis: Redis;
+  let cache: LastKnownGoodCache;
+
+  beforeEach(async () => {
+    redis = new RedisMock() as unknown as Redis;
+    // ioredis-mock shares context across instances with the same host:port/db.
+    // Flush the shared store before each test to ensure clean state.
+    await redis.flushall();
+    cache = new LastKnownGoodCache(redis);
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it('get() returns null when cache is empty', async () => {
+    const result = await cache.get();
+    expect(result).toBeNull();
+  });
+
+  it('update() + get() round-trip returns correct PurityRates', async () => {
+    await cache.update(STUB_RATES);
+    const result = await cache.get();
+
+    expect(result).not.toBeNull();
+    expect(result!.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result!.rates.GOLD_22K.perGramPaise).toBe(673750n);
+    expect(result!.rates.GOLD_20K.perGramPaise).toBe(612500n);
+    expect(result!.rates.GOLD_18K.perGramPaise).toBe(551250n);
+    expect(result!.rates.GOLD_14K.perGramPaise).toBe(428750n);
+    expect(result!.rates.SILVER_999.perGramPaise).toBe(9500n);
+    expect(result!.rates.SILVER_925.perGramPaise).toBe(8788n);
+  });
+
+  it('stale=false when stored within 30 minutes', async () => {
+    vi.useFakeTimers();
+    vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'));
+
+    await cache.update(STUB_RATES);
+
+    // Advance by 29 minutes
+    vi.advanceTimersByTime(29 * 60 * 1000);
+
+    const result = await cache.get();
+    expect(result).not.toBeNull();
+    expect(result!.stale).toBe(false);
+  });
+
+  it('stale=true when stored more than 30 minutes ago', async () => {
+    vi.useFakeTimers();
+    vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'));
+
+    await cache.update(STUB_RATES);
+
+    // Advance by 31 minutes
+    vi.advanceTimersByTime(31 * 60 * 1000);
+
+    const result = await cache.get();
+    expect(result).not.toBeNull();
+    expect(result!.stale).toBe(true);
+  });
+});
diff --git a/packages/integrations/rates/src/last-known-good-cache.ts b/packages/integrations/rates/src/last-known-good-cache.ts
new file mode 100644
index 0000000..27a0e33
--- /dev/null
+++ b/packages/integrations/rates/src/last-known-good-cache.ts
@@ -0,0 +1,75 @@
+import type { Redis } from 'ioredis';
+import type { PurityRates } from './port';
+
+const REDIS_KEY = 'rates:last_known_good';
+const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
+
+interface StoredEntry {
+  rates: SerializedRates;
+  storedAt: string; // ISO string
+}
+
+type PurityKey = keyof PurityRates;
+
+type SerializedRates = {
+  [K in PurityKey]: { perGramPaise: string; fetchedAt: string };
+};
+
+export interface CachedRates {
+  rates: PurityRates;
+  stale: boolean;
+  storedAt: Date;
+}
+
+function serialize(rates: PurityRates): SerializedRates {
+  const keys = Object.keys(rates) as PurityKey[];
+  const result = {} as SerializedRates;
+  for (const k of keys) {
+    result[k] = {
+      perGramPaise: rates[k].perGramPaise.toString(),
+      fetchedAt: rates[k].fetchedAt.toISOString(),
+    };
+  }
+  return result;
+}
+
+function deserialize(serialized: SerializedRates): PurityRates {
+  const keys = Object.keys(serialized) as PurityKey[];
+  const result = {} as PurityRates;
+  for (const k of keys) {
+    result[k] = {
+      perGramPaise: BigInt(serialized[k].perGramPaise),
+      fetchedAt: new Date(serialized[k].fetchedAt),
+    };
+  }
+  return result;
+}
+
+export class LastKnownGoodCache {
+  constructor(private readonly redis: Redis) {}
+
+  async update(rates: PurityRates): Promise<void> {
+    const entry: StoredEntry = {
+      rates: serialize(rates),
+      storedAt: new Date().toISOString(),
+    };
+    await this.redis.set(REDIS_KEY, JSON.stringify(entry), 'EX', 24 * 60 * 60);
+  }
+
+  async get(): Promise<CachedRates | null> {
+    try {
+      const raw = await this.redis.get(REDIS_KEY);
+      if (!raw) return null;
+      const entry = JSON.parse(raw) as StoredEntry;
+      const storedAt = new Date(entry.storedAt);
+      const ageMs = Date.now() - storedAt.getTime();
+      return {
+        rates: deserialize(entry.rates),
+        stale: ageMs > STALE_THRESHOLD_MS,
+        storedAt,
+      };
+    } catch {
+      return null;
+    }
+  }
+}
diff --git a/packages/integrations/rates/src/metalsdev-adapter.spec.ts b/packages/integrations/rates/src/metalsdev-adapter.spec.ts
new file mode 100644
index 0000000..1a2d555
--- /dev/null
+++ b/packages/integrations/rates/src/metalsdev-adapter.spec.ts
@@ -0,0 +1,35 @@
+import { describe, it, expect, vi } from 'vitest';
+import { MetalsDevAdapter } from './metalsdev-adapter';
+import { RatesAdapterError } from './errors';
+
+describe('MetalsDevAdapter', () => {
+  it('returns correct paise values for all purities', async () => {
+    const adapter = new MetalsDevAdapter();
+    const result = await adapter.getRatesByPurity();
+
+    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
+    expect(result.rates.GOLD_22K.perGramPaise).toBe(673750n);
+    expect(result.rates.GOLD_20K.perGramPaise).toBe(612500n);
+    expect(result.rates.GOLD_18K.perGramPaise).toBe(551250n);
+    expect(result.rates.GOLD_14K.perGramPaise).toBe(428750n);
+    expect(result.rates.SILVER_999.perGramPaise).toBe(9500n);
+    expect(result.rates.SILVER_925.perGramPaise).toBe(8788n);
+    expect(result.rates.GOLD_24K.fetchedAt).toBeInstanceOf(Date);
+    expect(result.source).toBe('metalsdev');
+    expect(result.stale).toBe(false);
+  });
+
+  it('getName() returns "metalsdev"', () => {
+    const adapter = new MetalsDevAdapter();
+    expect(adapter.getName()).toBe('metalsdev');
+  });
+
+  it('throws RatesAdapterError on network timeout', async () => {
+    const adapter = new MetalsDevAdapter();
+    vi.spyOn(adapter as unknown as { _fetch: () => Promise<unknown> }, '_fetch').mockRejectedValueOnce(
+      new Error('timeout'),
+    );
+    await expect(adapter.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
+    vi.restoreAllMocks();
+  });
+});
diff --git a/packages/integrations/rates/src/metalsdev-adapter.ts b/packages/integrations/rates/src/metalsdev-adapter.ts
new file mode 100644
index 0000000..aa7e9ad
--- /dev/null
+++ b/packages/integrations/rates/src/metalsdev-adapter.ts
@@ -0,0 +1,45 @@
+// STUB: replace with real Metals.dev API when credentials obtained
+// See: https://metals.dev/ for API onboarding
+// GOLD_24K ≈ ₹7,350/g → 735000 paise
+import type { RatesPort, PurityRates, RatesResult } from './port';
+import { RatesAdapterError } from './errors';
+
+export class MetalsDevAdapter implements RatesPort {
+  getName(): string {
+    return 'metalsdev';
+  }
+
+  // Overridable in tests to simulate fetch failures
+  protected async _fetch(): Promise<PurityRates> {
+    const now = new Date();
+    return {
+      GOLD_24K: { perGramPaise: 735000n, fetchedAt: now },
+      GOLD_22K: { perGramPaise: 673750n, fetchedAt: now },
+      GOLD_20K: { perGramPaise: 612500n, fetchedAt: now },
+      GOLD_18K: { perGramPaise: 551250n, fetchedAt: now },
+      GOLD_14K: { perGramPaise: 428750n, fetchedAt: now },
+      SILVER_999: { perGramPaise: 9500n, fetchedAt: now },
+      SILVER_925: { perGramPaise: 8788n, fetchedAt: now },
+    };
+  }
+
+  async getRatesByPurity(): Promise<RatesResult> {
+    const TIMEOUT_MS = 5000;
+    let timer: ReturnType<typeof setTimeout>;
+    const timeoutPromise = new Promise<never>((_, reject) => {
+      timer = setTimeout(
+        () => reject(new RatesAdapterError(this.getName(), new Error('Request timeout'))),
+        TIMEOUT_MS,
+      );
+    });
+    try {
+      const rates = await Promise.race([this._fetch(), timeoutPromise]);
+      clearTimeout(timer!);
+      return { rates, source: this.getName(), stale: false };
+    } catch (err) {
+      clearTimeout(timer!);
+      if (err instanceof RatesAdapterError) throw err;
+      throw new RatesAdapterError(this.getName(), err);
+    }
+  }
+}
diff --git a/packages/integrations/rates/src/port.ts b/packages/integrations/rates/src/port.ts
new file mode 100644
index 0000000..fa961e8
--- /dev/null
+++ b/packages/integrations/rates/src/port.ts
@@ -0,0 +1,20 @@
+export interface PurityRates {
+  GOLD_24K: { perGramPaise: bigint; fetchedAt: Date };
+  GOLD_22K: { perGramPaise: bigint; fetchedAt: Date };
+  GOLD_20K: { perGramPaise: bigint; fetchedAt: Date };
+  GOLD_18K: { perGramPaise: bigint; fetchedAt: Date };
+  GOLD_14K: { perGramPaise: bigint; fetchedAt: Date };
+  SILVER_999: { perGramPaise: bigint; fetchedAt: Date };
+  SILVER_925: { perGramPaise: bigint; fetchedAt: Date };
+}
+
+export interface RatesResult {
+  rates: PurityRates;
+  source: string; // 'ibja' | 'metalsdev' | 'last_known_good'
+  stale: boolean;
+}
+
+export interface RatesPort {
+  getRatesByPurity(): Promise<RatesResult>;
+  getName(): string; // 'ibja' | 'metalsdev'
+}
diff --git a/packages/integrations/rates/tsconfig.build.json b/packages/integrations/rates/tsconfig.build.json
new file mode 100644
index 0000000..b8298fd
--- /dev/null
+++ b/packages/integrations/rates/tsconfig.build.json
@@ -0,0 +1 @@
+{ "extends": "./tsconfig.json", "compilerOptions": { "outDir": "./dist", "rootDir": "./src" }, "include": ["src/**/*"], "exclude": ["**/*.spec.ts"] }
diff --git a/packages/integrations/rates/tsconfig.json b/packages/integrations/rates/tsconfig.json
new file mode 100644
index 0000000..d1077f7
--- /dev/null
+++ b/packages/integrations/rates/tsconfig.json
@@ -0,0 +1 @@
+{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*"] }
diff --git a/packages/testing/tenant-isolation/src/schema-assertions.ts b/packages/testing/tenant-isolation/src/schema-assertions.ts
index d417354..12b8c08 100644
--- a/packages/testing/tenant-isolation/src/schema-assertions.ts
+++ b/packages/testing/tenant-isolation/src/schema-assertions.ts
@@ -51,6 +51,8 @@ export async function assertRlsInvariants(pool: Pool): Promise<AssertResult> {
       } else if (meta.kind === 'global') {
         if (relrowsecurity) fails.push(`${meta.name}: RLS enabled on platformGlobalTable (invariant 3)`);
       }
+      // 'global-rls' tables (e.g. shops) intentionally have RLS for scoped DML;
+      // no invariant check needed — the migration is authoritative for their policy.
     }
 
     const app = await c.query(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname='app_user'`);
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index b6f2a9b..df6c37d 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -67,6 +67,9 @@ importers:
       '@goldsmith/observability':
         specifier: workspace:*
         version: link:../../packages/observability
+      '@goldsmith/rates':
+        specifier: workspace:*
+        version: link:../../packages/integrations/rates
       '@goldsmith/secrets':
         specifier: workspace:*
         version: link:../../packages/secrets
@@ -79,6 +82,9 @@ importers:
       '@goldsmith/tenant-context':
         specifier: workspace:*
         version: link:../../packages/tenant-context
+      '@nestjs/bullmq':
+        specifier: ^10.2.0
+        version: 10.2.3(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)(bullmq@5.74.1)
       '@nestjs/common':
         specifier: ^10.3.0
         version: 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
@@ -91,6 +97,9 @@ importers:
       '@nestjs/platform-express':
         specifier: ^10.3.0
         version: 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)
+      bullmq:
+        specifier: ^5.7.0
+        version: 5.74.1
       firebase-admin:
         specifier: ^12.0.0
         version: 12.7.0
@@ -381,6 +390,25 @@ importers:
         specifier: ^1.4.0
         version: 1.6.1(@types/node@22.19.17)(jsdom@24.1.3)(terser@5.46.1)
 
+  packages/integrations/rates:
+    dependencies:
+      '@goldsmith/cache':
+        specifier: workspace:*
+        version: link:../../cache
+      ioredis:
+        specifier: ^5.3.0
+        version: 5.10.1
+    devDependencies:
+      ioredis-mock:
+        specifier: ^8.9.0
+        version: 8.13.1(@types/ioredis-mock@8.2.7(ioredis@5.10.1))(ioredis@5.10.1)
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+      vitest:
+        specifier: ^1.4.0
+        version: 1.6.1(@types/node@22.19.17)(jsdom@24.1.3)(terser@5.46.1)
+
   packages/observability:
     dependencies:
       '@opentelemetry/api':
@@ -2007,7 +2035,7 @@ packages:
 
   '@expo/bunyan@4.0.1':
     resolution: {integrity: sha512-+Lla7nYSiHZirgK+U/uYzsLv/X+HaJienbD5AKX1UQZHYfWaP+9uuQluRB4GrEVWF0GZ7vEVp/jzaOT9k/SQlg==}
-    engines: {node: '>=0.10.0'}
+    engines: {'0': node >=0.10.0}
 
   '@expo/cli@0.18.31':
     resolution: {integrity: sha512-v9llw9fT3Uv+TCM6Xllo54t672CuYtinEQZ2LPJ2EJsCwuTc4Cd2gXQaouuIVD21VoeGQnr5JtJuWbF97sBKzQ==}
@@ -2577,6 +2605,19 @@ packages:
   '@napi-rs/wasm-runtime@0.2.12':
     resolution: {integrity: sha512-ZVWUcfwY4E/yPitQJl481FjFo3K22D6qF0DuFH6Y/nbnE11GY5uguDxZMGXPQ8WQ0128MXQD7TnfHyK4oWoIJQ==}
 
+  '@nestjs/bull-shared@10.2.3':
+    resolution: {integrity: sha512-XcgAjNOgq6b5DVCytxhR5BKiwWo7hsusVeyE7sfFnlXRHeEtIuC2hYWBr/ZAtvL/RH0/O0tqtq0rVl972nbhJw==}
+    peerDependencies:
+      '@nestjs/common': ^8.0.0 || ^9.0.0 || ^10.0.0
+      '@nestjs/core': ^8.0.0 || ^9.0.0 || ^10.0.0
+
+  '@nestjs/bullmq@10.2.3':
+    resolution: {integrity: sha512-Lo4W5kWD61/246Y6H70RNgV73ybfRbZyKKS4CBRDaMELpxgt89O+EgYZUB4pdoNrWH16rKcaT0AoVsB/iDztKg==}
+    peerDependencies:
+      '@nestjs/common': ^8.0.0 || ^9.0.0 || ^10.0.0
+      '@nestjs/core': ^8.0.0 || ^9.0.0 || ^10.0.0
+      bullmq: ^3.0.0 || ^4.0.0 || ^5.0.0
+
   '@nestjs/common@10.4.22':
     resolution: {integrity: sha512-fxJ4v85nDHaqT1PmfNCQ37b/jcv2OojtXTaK1P2uAXhzLf9qq6WNUOFvxBrV4fhQek1EQoT1o9oj5xAZmv3NRw==}
     peerDependencies:
@@ -11394,6 +11435,20 @@ snapshots:
       '@tybys/wasm-util': 0.10.1
     optional: true
 
+  '@nestjs/bull-shared@10.2.3(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)':
+    dependencies:
+      '@nestjs/common': 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/core': 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      tslib: 2.8.1
+
+  '@nestjs/bullmq@10.2.3(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)(bullmq@5.74.1)':
+    dependencies:
+      '@nestjs/bull-shared': 10.2.3(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/core@10.4.22)
+      '@nestjs/common': 10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      '@nestjs/core': 10.4.22(@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2))(@nestjs/platform-express@10.4.22)(reflect-metadata@0.2.2)(rxjs@7.8.2)
+      bullmq: 5.74.1
+      tslib: 2.8.1
+
   '@nestjs/common@10.4.22(reflect-metadata@0.2.2)(rxjs@7.8.2)':
     dependencies:
       file-type: 20.4.1
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
index 2a628dd..901e4c3 100644
--- a/pnpm-workspace.yaml
+++ b/pnpm-workspace.yaml
@@ -2,4 +2,5 @@ packages:
   - "apps/*"
   - "packages/*"
   - "packages/testing/*"
+  - "packages/integrations/*"
   - "ops/eslint-rules/*"

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --name-only 44dafa030cc4e7954e69f10237c6501c0db3e93e' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/integrations/rates/src/fallback-chain.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/pricing/pricing.service.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/integrations/rates/src/circuit-breaker.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/workers/rates-refresh.processor.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 298ms:
apps/api/package.json
apps/api/src/app.module.ts
apps/api/src/modules/pricing/pricing.controller.spec.ts
apps/api/src/modules/pricing/pricing.controller.ts
apps/api/src/modules/pricing/pricing.module.ts
apps/api/src/modules/pricing/pricing.service.spec.ts
apps/api/src/modules/pricing/pricing.service.ts
apps/api/src/workers/rates-refresh.processor.ts
apps/api/test/rates-chaos.test.ts
apps/api/test/rates-refresh.integration.test.ts
packages/audit/src/audit-actions.ts
packages/db/src/migrations/0015_rates_foundation.sql
packages/db/src/schema/_helpers/helpers.test.ts
packages/db/src/schema/_helpers/platformGlobalTable.ts
packages/db/src/schema/_helpers/registry.ts
packages/db/src/schema/ibja-rate-snapshots.ts
packages/db/src/schema/index.ts
packages/db/src/schema/shops.ts
packages/integrations/rates/package.json
packages/integrations/rates/src/circuit-breaker.spec.ts
packages/integrations/rates/src/circuit-breaker.ts
packages/integrations/rates/src/errors.ts
packages/integrations/rates/src/fallback-chain.spec.ts
packages/integrations/rates/src/fallback-chain.ts
packages/integrations/rates/src/ibja-adapter.spec.ts
packages/integrations/rates/src/ibja-adapter.ts
packages/integrations/rates/src/index.ts
packages/integrations/rates/src/last-known-good-cache.spec.ts
packages/integrations/rates/src/last-known-good-cache.ts
packages/integrations/rates/src/metalsdev-adapter.spec.ts
packages/integrations/rates/src/metalsdev-adapter.ts
packages/integrations/rates/src/port.ts
packages/integrations/rates/tsconfig.build.json
packages/integrations/rates/tsconfig.json
packages/testing/tenant-isolation/src/schema-assertions.ts
pnpm-lock.yaml
pnpm-workspace.yaml

 succeeded in 343ms:
import type { RatesPort, RatesResult } from './port';
import { RatesUnavailableError } from './errors';
import type { LastKnownGoodCache } from './last-known-good-cache';

interface RatesLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class FallbackChain implements RatesPort {
  constructor(
    private readonly primary: RatesPort,
    private readonly secondary: RatesPort,
    private readonly lastKnownGoodCache: LastKnownGoodCache,
    private readonly logger: RatesLogger,
  ) {}

  getName(): string {
    return 'fallback-chain';
  }

  async getRatesByPurity(): Promise<RatesResult> {
    // Tier 1: primary adapter
    try {
      const result = await this.primary.getRatesByPurity();
      this.logger.log(`Rates served by primary (${this.primary.getName()})`);
      // Update LKG cache on success
      await this.lastKnownGoodCache.update(result.rates);
      return result;
    } catch (primaryErr) {
      this.logger.warn(
        `Primary adapter (${this.primary.getName()}) failed: ${String(primaryErr)}`,
      );
    }

    // Tier 2: secondary adapter
    try {
      const result = await this.secondary.getRatesByPurity();
      this.logger.log(`Rates served by secondary (${this.secondary.getName()})`);
      await this.lastKnownGoodCache.update(result.rates);
      return result;
    } catch (secondaryErr) {
      this.logger.warn(
        `Secondary adapter (${this.secondary.getName()}) failed: ${String(secondaryErr)}`,
      );
    }

    // Tier 3: last-known-good cache
    const cached = await this.lastKnownGoodCache.get();
    if (cached !== null) {
      this.logger.warn(
        `Rates served from last-known-good cache (stale=${String(cached.stale)})`,
      );
      return { rates: cached.rates, source: 'last_known_good', stale: cached.stale };
    }

    // All sources exhausted
    this.logger.error('All rate sources unavailable');
    throw new RatesUnavailableError();
  }
}

 succeeded in 327ms:
import type { Redis } from 'ioredis';
import type { RatesPort, RatesResult } from './port';
import { CircuitOpenError, RatesAdapterError } from './errors';

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_SEC = 60;
const COOLDOWN_SEC = 120;

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker implements RatesPort {
  private readonly keyState: string;
  private readonly keyFailures: string;
  private readonly keyOpenedAt: string;

  constructor(
    private readonly adapter: RatesPort,
    private readonly redis: Redis,
  ) {
    const name = adapter.getName();
    this.keyState = `cb:${name}:state`;
    this.keyFailures = `cb:${name}:failures`;
    this.keyOpenedAt = `cb:${name}:opened_at`;
  }

  getName(): string {
    return this.adapter.getName();
  }

  private async getState(): Promise<CircuitState> {
    const raw = await this.redis.get(this.keyState);
    if (raw === 'OPEN' || raw === 'HALF_OPEN') return raw;
    return 'CLOSED';
  }

  private async setState(state: CircuitState): Promise<void> {
    if (state === 'OPEN') {
      await this.redis.set(this.keyState, state, 'EX', COOLDOWN_SEC * 4);
    } else if (state === 'HALF_OPEN') {
      await this.redis.set(this.keyState, state, 'EX', COOLDOWN_SEC);
    } else {
      // CLOSED: delete the key; missing â†’ CLOSED in getState()
      await this.redis.del(this.keyState);
    }
  }

  private async resetFailures(): Promise<void> {
    await this.redis.del(this.keyFailures);
    await this.redis.del(this.keyOpenedAt);
  }

  private async recordFailure(): Promise<void> {
    const count = await this.redis.incr(this.keyFailures);
    if (count === 1) {
      // First failure in this window â€” set TTL
      await this.redis.expire(this.keyFailures, FAILURE_WINDOW_SEC);
    }
    if (count >= FAILURE_THRESHOLD) {
      const alreadyOpen = await this.redis.get(this.keyState);
      if (alreadyOpen !== 'OPEN') {
        await this.redis.set(this.keyOpenedAt, String(Date.now()), 'NX');
        await this.setState('OPEN');
      }
    }
  }

  private async checkCooldownElapsed(): Promise<boolean> {
    const openedAt = await this.redis.get(this.keyOpenedAt);
    if (!openedAt) return true;
    const elapsed = (Date.now() - Number(openedAt)) / 1000;
    return elapsed >= COOLDOWN_SEC;
  }

  async getRatesByPurity(): Promise<RatesResult> {
    const state = await this.getState();

    if (state === 'OPEN') {
      const elapsed = await this.checkCooldownElapsed();
      if (elapsed) {
        await this.setState('HALF_OPEN');
        return this.probe();
      }
      throw new CircuitOpenError(this.adapter.getName());
    }

    if (state === 'HALF_OPEN') {
      return this.probe();
    }

    // CLOSED
    return this.callAdapter();
  }

  private async probe(): Promise<RatesResult> {
    try {
      const result = await this.adapter.getRatesByPurity();
      // Success â†’ CLOSED
      await this.setState('CLOSED');
      await this.resetFailures();
      return result;
    } catch (err) {
      // Failure â†’ back to OPEN
      await this.setState('OPEN');
      await this.redis.set(this.keyOpenedAt, String(Date.now()));
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.adapter.getName(), err);
    }
  }

  private async callAdapter(): Promise<RatesResult> {
    try {
      const result = await this.adapter.getRatesByPurity();
      // Success in CLOSED â€” reset failures
      await this.redis.del(this.keyFailures);
      return result;
    } catch (err) {
      await this.recordFailure();
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.adapter.getName(), err);
    }
  }
}

 succeeded in 374ms:
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { FallbackChain } from '@goldsmith/rates';
import type { PurityRates } from '@goldsmith/rates';
import { AuditAction } from '@goldsmith/audit';
export interface RateSnapshotRow {
  id: string;
  fetched_at: Date;
  source: string;
  gold_24k_paise: bigint;
  gold_22k_paise: bigint;
  gold_20k_paise: bigint;
  gold_18k_paise: bigint;
  gold_14k_paise: bigint;
  silver_999_paise: bigint;
  silver_925_paise: bigint;
  stale: boolean;
  created_at: Date;
}

const REDIS_KEY_CURRENT = 'rates:current';
const TTL_CURRENT_CACHE_SEC = 900;   // 15 min â€” on cache miss, after FallbackChain call
const TTL_REFRESH_SEC = 1800;        // 30 min â€” on explicit refreshRates()

// ---------------------------------------------------------------------------
// Serialization helpers (bigint cannot be JSON.stringify'd natively)
// ---------------------------------------------------------------------------

type PurityKey = keyof PurityRates;

interface SerializedEntry {
  perGramPaise: string;
  fetchedAt: string;
}

interface CachedCurrentRates {
  GOLD_24K: SerializedEntry;
  GOLD_22K: SerializedEntry;
  GOLD_20K: SerializedEntry;
  GOLD_18K: SerializedEntry;
  GOLD_14K: SerializedEntry;
  SILVER_999: SerializedEntry;
  SILVER_925: SerializedEntry;
  stale: boolean;
  source: string;
}

function serializeRates(
  rates: PurityRates,
  stale: boolean,
  source: string,
): string {
  const keys = Object.keys(rates) as PurityKey[];
  const out: Record<string, SerializedEntry | boolean | string> = {};
  for (const k of keys) {
    out[k] = {
      perGramPaise: rates[k].perGramPaise.toString(),
      fetchedAt: rates[k].fetchedAt.toISOString(),
    };
  }
  out['stale'] = stale;
  out['source'] = source;
  return JSON.stringify(out);
}

function deserializeRates(raw: string): CachedCurrentRates {
  return JSON.parse(raw) as CachedCurrentRates;
}

// ---------------------------------------------------------------------------
// PricingService
// ---------------------------------------------------------------------------

export interface CurrentRatesResult extends PurityRates {
  stale: boolean;
  source: string;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly fallbackChain: FallbackChain,
    @Inject('PRICING_REDIS') private readonly redis: Redis,
  ) {}

  // -------------------------------------------------------------------------
  // getCurrentRates â€” try Redis cache first, fall back to FallbackChain
  // -------------------------------------------------------------------------
  async getCurrentRates(): Promise<CurrentRatesResult> {
    const cached = await this.redis.get(REDIS_KEY_CURRENT);
    if (cached !== null) {
      const parsed = deserializeRates(cached);

      // Guard: if any required purity key is missing (stale/incompatible schema from a
      // previous deployment), treat as a cache miss rather than crashing with BigInt(undefined).
      const requiredKeys = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925'] as const;
      if (requiredKeys.some(k => !parsed[k])) {
        this.logger.warn('Cached rates schema is stale/incompatible â€” evicting and falling through to FallbackChain');
        await this.redis.del(REDIS_KEY_CURRENT);
        // Fall through to FallbackChain below
      } else {
        // Re-hydrate bigints
        const rates: CurrentRatesResult = {
          GOLD_24K: { perGramPaise: BigInt(parsed.GOLD_24K.perGramPaise), fetchedAt: new Date(parsed.GOLD_24K.fetchedAt) },
          GOLD_22K: { perGramPaise: BigInt(parsed.GOLD_22K.perGramPaise), fetchedAt: new Date(parsed.GOLD_22K.fetchedAt) },
          GOLD_20K: { perGramPaise: BigInt(parsed.GOLD_20K.perGramPaise), fetchedAt: new Date(parsed.GOLD_20K.fetchedAt) },
          GOLD_18K: { perGramPaise: BigInt(parsed.GOLD_18K.perGramPaise), fetchedAt: new Date(parsed.GOLD_18K.fetchedAt) },
          GOLD_14K: { perGramPaise: BigInt(parsed.GOLD_14K.perGramPaise), fetchedAt: new Date(parsed.GOLD_14K.fetchedAt) },
          SILVER_999: { perGramPaise: BigInt(parsed.SILVER_999.perGramPaise), fetchedAt: new Date(parsed.SILVER_999.fetchedAt) },
          SILVER_925: { perGramPaise: BigInt(parsed.SILVER_925.perGramPaise), fetchedAt: new Date(parsed.SILVER_925.fetchedAt) },
          stale: parsed.stale,
          source: parsed.source,
        };
        return rates;
      }
    }

    // Cache miss â€” call FallbackChain (throws RatesUnavailableError if all sources fail)
    const liveResult = await this.fallbackChain.getRatesByPurity();
    const { rates: liveRates, source, stale } = liveResult;

    // Cache the result with 15-min TTL
    const serialized = serializeRates(liveRates, stale, source);
    await this.redis.setex(REDIS_KEY_CURRENT, TTL_CURRENT_CACHE_SEC, serialized);

    return { ...liveRates, stale, source };
  }

  // -------------------------------------------------------------------------
  // refreshRates â€” called by BullMQ worker on schedule
  // -------------------------------------------------------------------------
  async refreshRates(): Promise<void> {
    const { rates, source, stale } = await this.fallbackChain.getRatesByPurity();

    // 1. Write to Redis 'rates:current' with 30-min TTL
    const serialized = serializeRates(rates, stale, source);
    await this.redis.setex(REDIS_KEY_CURRENT, TTL_REFRESH_SEC, serialized);

    // 2. Insert snapshot into ibja_rate_snapshots (platform-global table, no tenant context)
    const now = new Date();
    const snapshotValues = {
      fetched_at: now,
      source,
      gold_24k_paise: rates.GOLD_24K.perGramPaise,
      gold_22k_paise: rates.GOLD_22K.perGramPaise,
      gold_20k_paise: rates.GOLD_20K.perGramPaise,
      gold_18k_paise: rates.GOLD_18K.perGramPaise,
      gold_14k_paise: rates.GOLD_14K.perGramPaise,
      silver_999_paise: rates.SILVER_999.perGramPaise,
      silver_925_paise: rates.SILVER_925.perGramPaise,
      stale,
    };
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO ibja_rate_snapshots
           (fetched_at, source,
            gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
            silver_999_paise, silver_925_paise, stale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          snapshotValues.fetched_at,
          snapshotValues.source,
          snapshotValues.gold_24k_paise,
          snapshotValues.gold_22k_paise,
          snapshotValues.gold_20k_paise,
          snapshotValues.gold_18k_paise,
          snapshotValues.gold_14k_paise,
          snapshotValues.silver_999_paise,
          snapshotValues.silver_925_paise,
          snapshotValues.stale,
        ],
      );

      // 3. Log PRICING_RATES_REFRESHED platform audit event
      await client.query(
        `INSERT INTO platform_audit_events (action, metadata)
         VALUES ($1, $2)`,
        [
          AuditAction.PRICING_RATES_REFRESHED,
          JSON.stringify({ source, fetchedAt: now.toISOString() }),
        ],
      );
    } finally {
      client.release();
    }

    this.logger.log(`Rates refreshed from ${source} at ${now.toISOString()}`);
  }

  // -------------------------------------------------------------------------
  // getRateHistory â€” query ibja_rate_snapshots for historical data
  // -------------------------------------------------------------------------
  async getRateHistory(range: '30d' | '90d' | '365d'): Promise<RateSnapshotRow[]> {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const client = await this.pool.connect();
    try {
      const result = await client.query<RateSnapshotRow>(
        `SELECT id, fetched_at, source,
                gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
                silver_999_paise, silver_925_paise, stale, created_at
           FROM ibja_rate_snapshots
          WHERE fetched_at >= NOW() - ($1 * INTERVAL '1 day')
          ORDER BY fetched_at DESC`,
        [days],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
}

 succeeded in 386ms:
import { Logger, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import { AuditAction } from '@goldsmith/audit';
import { PricingService } from '../modules/pricing/pricing.service';

@Processor('rates-refresh')
export class RatesRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(RatesRefreshProcessor.name);

  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'refresh') {
      this.logger.log(`Processing rates-refresh job id=${job.id}`);
      await this.pricingService.refreshRates();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `rates-refresh job failed: jobId=${job?.id ?? 'unknown'} name=${job?.name ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
    // Persist PRICING_RATES_FALLBACK audit event to DB (best-effort, async).
    // Wrapped in void + try/catch so an audit DB failure never masks the original job failure.
    void (async () => {
      try {
        const client = await this.pool.connect();
        try {
          await client.query(
            `INSERT INTO platform_audit_events (action, metadata)
             VALUES ($1, $2)`,
            [
              AuditAction.PRICING_RATES_FALLBACK,
              JSON.stringify({
                jobId: job?.id ?? 'unknown',
                jobName: job?.name ?? 'unknown',
                error: error.message,
              }),
            ],
          );
        } finally {
          client.release();
        }
      } catch (auditErr) {
        this.logger.warn(
          `Failed to persist PRICING_RATES_FALLBACK audit event: ${(auditErr as Error).message}`,
        );
      }
    })();
  }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/migrations/0015_rates_foundation.sql' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/schema/ibja-rate-snapshots.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/schema/shops.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/schema/_helpers/platformGlobalTable.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/schema/_helpers/registry.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 298ms:
import { uuid, timestamp, text, bigint, boolean } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

export const ibjaRateSnapshots = platformGlobalTable('ibja_rate_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  fetched_at: timestamp('fetched_at', { withTimezone: true }).notNull(),
  source: text('source').notNull(),
  gold_24k_paise: bigint('gold_24k_paise', { mode: 'bigint' }).notNull(),
  gold_22k_paise: bigint('gold_22k_paise', { mode: 'bigint' }).notNull(),
  gold_20k_paise: bigint('gold_20k_paise', { mode: 'bigint' }).notNull(),
  gold_18k_paise: bigint('gold_18k_paise', { mode: 'bigint' }).notNull(),
  gold_14k_paise: bigint('gold_14k_paise', { mode: 'bigint' }).notNull(),
  silver_999_paise: bigint('silver_999_paise', { mode: 'bigint' }).notNull(),
  silver_925_paise: bigint('silver_925_paise', { mode: 'bigint' }).notNull(),
  stale: boolean('stale').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

 succeeded in 299ms:
-- ibja_rate_snapshots: platform-global gold/silver rate history (no RLS)
CREATE TABLE ibja_rate_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at timestamptz NOT NULL,
  source text NOT NULL,
  gold_24k_paise bigint NOT NULL,
  gold_22k_paise bigint NOT NULL,
  gold_20k_paise bigint NOT NULL,
  gold_18k_paise bigint NOT NULL,
  gold_14k_paise bigint NOT NULL,
  silver_999_paise bigint NOT NULL,
  silver_925_paise bigint NOT NULL,
  stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON ibja_rate_snapshots TO app_user;

CREATE INDEX idx_ibja_rate_snapshots_fetched_at
  ON ibja_rate_snapshots(fetched_at DESC);

 succeeded in 284ms:
/**
 * 'tenant'     â€” tenant-scoped table: RLS + FORCE RLS required, shop_id policy required
 * 'global'     â€” platform-global table: must have NO RLS (unrestricted reads/writes via superuser)
 * 'global-rls' â€” platform-global table that intentionally has RLS for scoped DML
 *                (e.g. shops: SELECT unrestricted, UPDATE scoped to own shop).
 *                Invariant checker skips the no-RLS assertion for this kind.
 */
export type TableKind = 'tenant' | 'global' | 'global-rls';
export interface TableMeta {
  name: string;
  kind: TableKind;
  encryptedColumns: string[];
}

class TableRegistry {
  private readonly byName = new Map<string, TableMeta>();
  register(meta: TableMeta): void {
    if (this.byName.has(meta.name)) {
      throw new Error(`Table "${meta.name}" registered twice â€” use a unique name.`);
    }
    this.byName.set(meta.name, meta);
  }
  list(): TableMeta[] { return [...this.byName.values()]; }
  get(name: string): TableMeta | undefined { return this.byName.get(name); }
  clear(): void { this.byName.clear(); }
}

export const tableRegistry = new TableRegistry();

 succeeded in 299ms:
import { uuid, text, timestamp, jsonb, pgEnum, integer } from 'drizzle-orm/pg-core';
import { platformGlobalTableWithRls } from './_helpers/platformGlobalTable';

export const shopStatusEnum = pgEnum('shop_status', ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']);

// shops is platform-global for SELECT (auth lookups read all shops) but has
// RLS enabled for UPDATE so shopkeepers can only update their own shop row
// (migration 0013). Use platformGlobalTableWithRls to register as 'global-rls'.
export const shops = platformGlobalTableWithRls('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  display_name: text('display_name').notNull(),
  status: shopStatusEnum('status').notNull().default('PROVISIONING'),
  kek_key_arn: text('kek_key_arn'),
  config: jsonb('config').notNull().default({}),
  address_json: jsonb('address_json'),
  gstin: text('gstin'),
  bis_registration: text('bis_registration'),
  contact_phone: text('contact_phone'),
  operating_hours_json: jsonb('operating_hours_json'),
  about_text: text('about_text'),
  logo_url: text('logo_url'),
  years_in_business: integer('years_in_business'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

 succeeded in 311ms:
import { pgTable, type PgColumnBuilderBase } from 'drizzle-orm/pg-core';
import { tableRegistry } from './registry';

type ColumnBuilders = Record<string, PgColumnBuilderBase>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function platformGlobalTable<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
) {
  tableRegistry.register({ name, kind: 'global', encryptedColumns: [] });
  return pgTable(name, columns);
}

/**
 * Like platformGlobalTable but for tables that intentionally have RLS enabled
 * for scoped DML (e.g. shops: SELECT is unrestricted / platform-global, but
 * UPDATE is tenant-scoped so shopkeepers can only update their own row).
 *
 * The tenant-isolation invariant checker treats 'global-rls' as global for
 * data-isolation purposes (no shop_id policy required) while allowing RLS to
 * be present in the DB.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function platformGlobalTableWithRls<N extends string, C extends ColumnBuilders>(
  name: N,
  columns: C,
) {
  tableRegistry.register({ name, kind: 'global-rls', encryptedColumns: [] });
  return pgTable(name, columns);
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/test/rates-refresh.integration.test.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/test/rates-chaos.test.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/integrations/rates/src/errors.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/audit/src/audit-actions.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 293ms:
export class RatesAdapterError extends Error {
  constructor(public readonly adapter: string, cause?: unknown) {
    super(`Rates adapter '${adapter}' failed`);
    this.name = 'RatesAdapterError';
    if (cause !== undefined) this.cause = cause;
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly adapter: string) {
    super(`Circuit breaker open for adapter '${adapter}'`);
    this.name = 'CircuitOpenError';
  }
}

export class RatesUnavailableError extends Error {
  constructor() {
    super('All rate sources unavailable');
    this.name = 'RatesUnavailableError';
  }
}

 succeeded in 323ms:
// apps/api/test/rates-refresh.integration.test.ts
//
// Integration tests for PricingService.refreshRates() and GET /api/v1/rates/current.
// Uses a real Postgres testcontainer + ioredis-mock.
//
// NOTE: ioredis-mock shares a global in-memory store across all instances within
// the same Node process. Each test group calls redis.flushall() in beforeAll to
// start from a clean slate.
//
// Tier: Class A integration test â€” money columns, rates persistence, platform audit.
// Pattern: instantiate PricingService directly (no NestJS DI bootstrap).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import IoredisMock from 'ioredis-mock';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { createPool, runMigrations } from '@goldsmith/db';
import {
  IbjaAdapter,
  MetalsDevAdapter,
  CircuitBreaker,
  FallbackChain,
  LastKnownGoodCache,
  type PurityRates,
} from '@goldsmith/rates';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { PricingController } from '../src/modules/pricing/pricing.controller';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// test/ is 3 levels deep from the monorepo root: apps/api/test
const MIGRATIONS_DIR = resolve(
  __dirname,
  '../../../packages/db/src/migrations',
);

// A fake IbjaAdapter that always throws â€” used in fallback tests
class FailingIbjaAdapter extends IbjaAdapter {
  protected override async _fetch(): Promise<PurityRates> {
    throw new Error('Simulated IBJA failure');
  }
}

// ---------------------------------------------------------------------------
// Shared Postgres testcontainer â€” one container for all tests in this file
// ---------------------------------------------------------------------------

let container: StartedPostgreSqlContainer;
let pool: Pool;
let sharedRedis: InstanceType<typeof IoredisMock>;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, MIGRATIONS_DIR);
  // Single ioredis-mock instance shared across all helpers
  // (ioredis-mock is process-global; using one instance makes the flush contract explicit)
  sharedRedis = new IoredisMock();
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// Helper: build a PricingService from components using sharedRedis
// ---------------------------------------------------------------------------

function buildService(
  ibjaOverride?: IbjaAdapter,
): PricingService {
  const redis = sharedRedis;
  const lkg = new LastKnownGoodCache(redis as never);
  const ibja = ibjaOverride ?? new IbjaAdapter();
  const metalsdev = new MetalsDevAdapter();
  const ibjaCb = new CircuitBreaker(ibja, redis as never);
  const metalsdevCb = new CircuitBreaker(metalsdev, redis as never);
  const chain = new FallbackChain(ibjaCb, metalsdevCb, lkg, console);
  return new PricingService(pool as never, chain, redis as never);
}

// ---------------------------------------------------------------------------
// Test 1: Full refresh cycle â€” happy path
// ---------------------------------------------------------------------------

describe('PricingService.refreshRates() â€” happy path', () => {
  beforeAll(async () => {
    // Clean slate: remove any rates keys left by previous test groups
    await sharedRedis.flushall();
    // Truncate snapshot table so rowCount assertions are exact (not cumulative across groups)
    await pool.query('TRUNCATE ibja_rate_snapshots');
  });

  it('writes rates:current to Redis and inserts a snapshot row with source=ibja', async () => {
    // IbjaAdapter and MetalsDevAdapter are MVP stubs (no live HTTP) â€” always return GOLD_24K = 735000n paise
    const service = buildService();

    await service.refreshRates();

    // Verify Redis cache key
    const cached = await sharedRedis.get('rates:current');
    expect(cached).not.toBeNull();

    const parsed = JSON.parse(cached!) as { GOLD_24K: { perGramPaise: string }; stale: boolean; source: string };
    expect(parsed.GOLD_24K.perGramPaise).toBe('735000');
    expect(parsed.stale).toBe(false);

    // Verify snapshot row in Postgres (superuser pool â€” no RLS; platform-global table)
    const rows = await pool.query<{
      source: string;
      gold_24k_paise: string;
    }>(
      `SELECT source, gold_24k_paise FROM ibja_rate_snapshots ORDER BY fetched_at DESC LIMIT 1`,
    );
    expect(rows.rowCount).toBe(1);
    // IbjaAdapter served the rates â€” source must be 'ibja' (the winning adapter's name)
    expect(rows.rows[0].source).toBe('ibja');
    expect(rows.rows[0].gold_24k_paise).toBe('735000');
  });
});

// ---------------------------------------------------------------------------
// Test 2: Fallback chain â€” IBJA fails â†’ MetalsDev serves
// ---------------------------------------------------------------------------

describe('PricingService.refreshRates() â€” IBJA fails, MetalsDev serves', () => {
  beforeAll(async () => {
    await sharedRedis.flushall();
    // Truncate snapshot table so rowCount assertions are exact (not cumulative across groups)
    await pool.query('TRUNCATE ibja_rate_snapshots');
  });

  it('inserts snapshot and caches valid rates when IBJA adapter throws', async () => {
    // IbjaAdapter and MetalsDevAdapter are MVP stubs (no live HTTP) â€” always return GOLD_24K = 735000n paise
    const service = buildService(new FailingIbjaAdapter());

    await service.refreshRates();

    // Redis should have fresh rates
    const cached = await sharedRedis.get('rates:current');
    expect(cached).not.toBeNull();

    const parsed = JSON.parse(cached!) as { GOLD_24K: { perGramPaise: string }; source: string };
    // MetalsDev stub also returns 735000n â€” both stubs have the same value
    expect(parsed.GOLD_24K.perGramPaise).toBe('735000');
    // IBJA failed â†’ MetalsDev served â†’ source must be 'metalsdev'
    expect(parsed.source).toBe('metalsdev');

    // Snapshot must exist in DB (MetalsDev served)
    const rows = await pool.query<{ source: string; gold_24k_paise: string }>(
      `SELECT source, gold_24k_paise FROM ibja_rate_snapshots ORDER BY fetched_at DESC LIMIT 1`,
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].source).toBe('metalsdev');
    expect(rows.rows[0].gold_24k_paise).toBe('735000');
  });
});

// ---------------------------------------------------------------------------
// Test 3: GET /api/v1/rates/current â€” reads from Redis cache
// ---------------------------------------------------------------------------

describe('GET /api/v1/rates/current â€” cache hit', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await sharedRedis.flushall();

    // Pre-populate Redis with valid serialized rates
    const now = new Date().toISOString();
    const payload = JSON.stringify({
      GOLD_24K: { perGramPaise: '735000', fetchedAt: now },
      GOLD_22K: { perGramPaise: '673750', fetchedAt: now },
      GOLD_20K: { perGramPaise: '612500', fetchedAt: now },
      GOLD_18K: { perGramPaise: '551250', fetchedAt: now },
      GOLD_14K: { perGramPaise: '428750', fetchedAt: now },
      SILVER_999: { perGramPaise: '9500',  fetchedAt: now },
      SILVER_925: { perGramPaise: '8788',  fetchedAt: now },
      stale: false,
      source: 'ibja',
    });
    await sharedRedis.setex('rates:current', 900, payload);

    const pricingService = buildService();

    @Module({
      controllers: [PricingController],
      providers: [
        { provide: PricingService, useValue: pricingService },
      ],
    })
    class TestPricingModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestPricingModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns 200 with GOLD_24K.perGramPaise as string and stale as boolean', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rates/current')
      .expect(200);

    expect(typeof res.body.GOLD_24K.perGramPaise).toBe('string');
    expect(res.body.GOLD_24K.perGramPaise).toBe('735000');
    expect(typeof res.body.stale).toBe('boolean');
    expect(res.body.source).toBe('ibja');
  });

  it('response shape includes perGramRupees (formatted) and fetchedAt (ISO string)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rates/current')
      .expect(200);

    // 735000 paise = 7350 rupees
    expect(res.body.GOLD_24K.perGramRupees).toBe('7350.00');
    expect(res.body.GOLD_24K.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Circuit breaker integration â€” 5 failures â†’ IBJA CB opens
// ---------------------------------------------------------------------------

describe('CircuitBreaker integration â€” IBJA opens after 5 failures', () => {
  beforeAll(async () => {
    await sharedRedis.flushall();
  });

  it('IBJA CB is OPEN in Redis after 5 consecutive failures; MetalsDev continues to serve', async () => {
    const redis = sharedRedis;
    const ibja = new FailingIbjaAdapter();
    const metalsdev = new MetalsDevAdapter();
    const ibjaCb = new CircuitBreaker(ibja, redis as never);
    const metalsdevCb = new CircuitBreaker(metalsdev, redis as never);
    const lkg = new LastKnownGoodCache(redis as never);
    const chain = new FallbackChain(ibjaCb, metalsdevCb, lkg, console);

    // Call FallbackChain 5 times. Each call: IBJA fails â†’ MetalsDev serves.
    // CircuitBreaker records a failure for IBJA on each call.
    for (let i = 0; i < 5; i++) {
      const result = await chain.getRatesByPurity();
      expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
      expect(result.source).toBe('metalsdev');
    }

    // After 5 failures CircuitBreaker should have opened (threshold = 5)
    const cbState = await redis.get('cb:ibja:state');
    expect(cbState).toBe('OPEN');

    // One more call: IBJA circuit is OPEN (cooldown=120s not elapsed),
    // throws CircuitOpenError. FallbackChain catches it and falls to MetalsDev.
    const result = await chain.getRatesByPurity();
    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(result.source).toBe('metalsdev');
  });
});

 succeeded in 299ms:
export enum AuditAction {
  AUTH_VERIFY_SUCCESS      = 'AUTH_VERIFY_SUCCESS',
  AUTH_VERIFY_FAILURE      = 'AUTH_VERIFY_FAILURE',
  AUTH_VERIFY_LOCKED       = 'AUTH_VERIFY_LOCKED',
  AUTH_VERIFY_REJECTED     = 'AUTH_VERIFY_REJECTED',
  AUTH_USER_PROVISIONED    = 'AUTH_USER_PROVISIONED',
  AUTH_UID_MISMATCH        = 'AUTH_UID_MISMATCH',
  AUTH_TOKEN_INVALID       = 'AUTH_TOKEN_INVALID',
  AUTH_LOGOUT_ALL          = 'AUTH_LOGOUT_ALL',
  TENANT_CLAIM_CONFLICT    = 'TENANT_CLAIM_CONFLICT',
  TENANT_BOOT              = 'TENANT_BOOT',
  SETTINGS_PROFILE_UPDATED           = 'SETTINGS_PROFILE_UPDATED',
  SETTINGS_MAKING_CHARGES_UPDATED    = 'SETTINGS_MAKING_CHARGES_UPDATED',
  SETTINGS_WASTAGE_UPDATED           = 'SETTINGS_WASTAGE_UPDATED',
  SETTINGS_RATE_LOCK_UPDATED         = 'SETTINGS_RATE_LOCK_UPDATED',
  SETTINGS_LOYALTY_UPDATED           = 'SETTINGS_LOYALTY_UPDATED',
  SETTINGS_TRY_AT_HOME_UPDATED       = 'SETTINGS_TRY_AT_HOME_UPDATED',
  SETTINGS_CUSTOM_ORDER_POLICY_UPDATED = 'SETTINGS_CUSTOM_ORDER_POLICY_UPDATED',
  SETTINGS_RETURN_POLICY_UPDATED     = 'SETTINGS_RETURN_POLICY_UPDATED',
  SETTINGS_NOTIFICATION_PREFS_UPDATED = 'SETTINGS_NOTIFICATION_PREFS_UPDATED',
  STAFF_INVITED            = 'STAFF_INVITED',
  STAFF_REVOKED            = 'STAFF_REVOKED',
  STAFF_ACTIVATED          = 'STAFF_ACTIVATED',
  ACCESS_DENIED            = 'ACCESS_DENIED',
  PERMISSIONS_UPDATED      = 'PERMISSIONS_UPDATED',
  PRICING_RATES_REFRESHED  = 'PRICING_RATES_REFRESHED',
  PRICING_RATES_FALLBACK   = 'PRICING_RATES_FALLBACK',
}

 succeeded in 351ms:
// apps/api/test/rates-chaos.test.ts
//
// Chaos tests for the rates layer â€” unit-level with controlled failures.
// No Testcontainers needed: all infrastructure is replaced with in-process mocks.
//
// NOTE: ioredis-mock shares a global in-memory store across all instances within
// the same Node process. Each test calls redis.flushall() to start clean.
//
// Covers:
//   1. IBJA timeout â†’ fallback to MetalsDev within budget
//   2. Both adapters fail â†’ LKG cache serves stale rates (when pre-populated)
//   3. Both adapters fail â†’ RatesUnavailableError when LKG is also empty
//   4. Redis unavailable â†’ PricingService degrades gracefully (typed error, no crash)

import { describe, it, expect, beforeEach } from 'vitest';
import IoredisMock from 'ioredis-mock';
import {
  IbjaAdapter,
  MetalsDevAdapter,
  FallbackChain,
  CircuitBreaker,
  LastKnownGoodCache,
  RatesUnavailableError,
  type PurityRates,
} from '@goldsmith/rates';
import { PricingService } from '../src/modules/pricing/pricing.service';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-23T10:00:00.000Z');

const fakePurityRates: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n,  fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n,  fetchedAt: NOW },
};

// Shared ioredis-mock instance â€” flush before each test for isolation
const redis = new IoredisMock();

beforeEach(async () => {
  await redis.flushall();
});

// ---------------------------------------------------------------------------
// Adapter subclasses for chaos scenarios
// ---------------------------------------------------------------------------

/** IBJA adapter whose _fetch() takes 5100 ms â€” simulates a slow/hung primary */
class SlowIbjaAdapter extends IbjaAdapter {
  protected override async _fetch(): Promise<PurityRates> {
    await new Promise<void>((resolve) => setTimeout(resolve, 5_100));
    return super._fetch();
  }
}

/** Adapter that always rejects _fetch() with a plain Error */
class AlwaysFailingIbjaAdapter extends IbjaAdapter {
  protected override async _fetch(): Promise<never> {
    throw new Error('ibja always fails');
  }
}

/** MetalsDev-shaped adapter that always rejects */
class AlwaysFailingMetalsDevAdapter extends MetalsDevAdapter {
  protected override async _fetch(): Promise<never> {
    throw new Error('metalsdev always fails');
  }
}

// ---------------------------------------------------------------------------
// Helper: build FallbackChain from the given adapters
// ---------------------------------------------------------------------------

function buildChain(
  ibja: IbjaAdapter,
  metalsdev: MetalsDevAdapter,
): FallbackChain {
  const lkg = new LastKnownGoodCache(redis as never);
  const ibjaCb = new CircuitBreaker(ibja, redis as never);
  const metalsdevCb = new CircuitBreaker(metalsdev, redis as never);
  return new FallbackChain(ibjaCb, metalsdevCb, lkg, console);
}

function makeNullPool(): Pool {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
}

// ---------------------------------------------------------------------------
// Chaos Test 1: IBJA times out (5s) â†’ MetalsDev fallback within 10s
// ---------------------------------------------------------------------------

describe('Chaos: IBJA times out (5s) â†’ MetalsDev fallback within 10s', () => {
  // This test intentionally takes â‰¥5 seconds because it uses a REAL wall-clock timer â€”
  // not fake timers. vi.useFakeTimers() would prevent the elapsed-time assertion
  // (elapsedMs > 5000) from ever being true. Do NOT add fake timers to this test.
  it('returns MetalsDev rates within 10 seconds after IBJA 5s timeout fires', async () => {
    const chain = buildChain(new SlowIbjaAdapter(), new MetalsDevAdapter());

    const start = Date.now();
    const result = await chain.getRatesByPurity();
    const elapsedMs = Date.now() - start;

    // Total elapsed must be >= 5000ms (IBJA timeout fired at 5s)
    expect(elapsedMs).toBeGreaterThan(5_000);
    // But must complete before our chaos-test budget (MetalsDev stub is fast)
    expect(elapsedMs).toBeLessThan(10_000);

    // IBJA timed out â†’ FallbackChain fell through to MetalsDev
    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(result.source).toBe('metalsdev');
  }, 15_000); // generous test timeout to accommodate the 5s timeout
});

// ---------------------------------------------------------------------------
// Chaos Test 2: Both adapters fail â†’ LKG cache serves stale rates
// ---------------------------------------------------------------------------

describe('Chaos: Both adapters fail â†’ LKG cache', () => {
  it('serves stale rates from LKG cache within 1 second when cache is pre-populated with stale data', async () => {
    // Seed LKG with data that is 31 minutes old â†’ stale=true
    const staleDate = new Date(Date.now() - 31 * 60 * 1000);
    const staleEntry = {
      rates: {
        GOLD_24K: { perGramPaise: fakePurityRates.GOLD_24K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_24K.fetchedAt.toISOString() },
        GOLD_22K: { perGramPaise: fakePurityRates.GOLD_22K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_22K.fetchedAt.toISOString() },
        GOLD_20K: { perGramPaise: fakePurityRates.GOLD_20K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_20K.fetchedAt.toISOString() },
        GOLD_18K: { perGramPaise: fakePurityRates.GOLD_18K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_18K.fetchedAt.toISOString() },
        GOLD_14K: { perGramPaise: fakePurityRates.GOLD_14K.perGramPaise.toString(), fetchedAt: fakePurityRates.GOLD_14K.fetchedAt.toISOString() },
        SILVER_999: { perGramPaise: fakePurityRates.SILVER_999.perGramPaise.toString(), fetchedAt: fakePurityRates.SILVER_999.fetchedAt.toISOString() },
        SILVER_925: { perGramPaise: fakePurityRates.SILVER_925.perGramPaise.toString(), fetchedAt: fakePurityRates.SILVER_925.fetchedAt.toISOString() },
      },
      storedAt: staleDate.toISOString(),
    };
    await redis.set('rates:last_known_good', JSON.stringify(staleEntry), 'EX', 24 * 60 * 60);

    const chain = buildChain(
      new AlwaysFailingIbjaAdapter(),
      new AlwaysFailingMetalsDevAdapter(),
    );

    const start = Date.now();
    const result = await chain.getRatesByPurity();
    const elapsedMs = Date.now() - start;

    // Should resolve quickly from the in-memory LKG mock
    expect(elapsedMs).toBeLessThan(1_000);

    // LKG rates match what was seeded, and stale=true because storedAt is 31 min ago
    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
    expect(result.source).toBe('last_known_good');
    expect(result.stale).toBe(true);
  });

  it('throws RatesUnavailableError when both adapters fail AND LKG cache is empty', async () => {
    // redis was flushed in beforeEach â€” LKG is empty
    const chain = buildChain(
      new AlwaysFailingIbjaAdapter(),
      new AlwaysFailingMetalsDevAdapter(),
    );

    await expect(chain.getRatesByPurity()).rejects.toBeInstanceOf(RatesUnavailableError);
  });
});

// ---------------------------------------------------------------------------
// Chaos Test 3: Redis unavailable â†’ PricingService degrades gracefully
// ---------------------------------------------------------------------------

describe('Chaos: Redis unavailable â†’ PricingService degrades gracefully', () => {
  it('getCurrentRates() rejects with a typed Error when Redis.get() fails â€” no unhandled crash', async () => {
    // Mock Redis that rejects every call
    const brokenRedis: Redis = {
      get: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
      set: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
      setex: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
      del: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
    } as unknown as Redis;

    const pool = makeNullPool();
    // FallbackChain mock returns valid rates so we isolate to the Redis failure path
    const fallbackChain = {
      getRatesByPurity: vi.fn().mockResolvedValue({ rates: fakePurityRates, source: 'ibja', stale: false }),
      getName: vi.fn().mockReturnValue('ibja'),
    };

    const service = new PricingService(pool, fallbackChain as never, brokenRedis);

    // getCurrentRates() calls redis.get â€” rejects with Error, not an unhandled rejection
    await expect(service.getCurrentRates()).rejects.toBeInstanceOf(Error);
  });

  it('refreshRates() rejects with a typed Error when Redis.setex() fails â€” no unhandled crash', async () => {
    const brokenRedis: Redis = {
      get: vi.fn().mockRejectedValue(new Error('Redis down')),
      setex: vi.fn().mockRejectedValue(new Error('Redis down')),
      del: vi.fn().mockRejectedValue(new Error('Redis down')),
    } as unknown as Redis;

    const pool = makeNullPool();
    const fallbackChain = {
      getRatesByPurity: vi.fn().mockResolvedValue({ rates: fakePurityRates, source: 'ibja', stale: false }),
      getName: vi.fn().mockReturnValue('ibja'),
    };

    const service = new PricingService(pool, fallbackChain as never, brokenRedis);

    // refreshRates() calls redis.setex first â€” expect typed Error, not a crash
    await expect(service.refreshRates()).rejects.toBeInstanceOf(Error);
  });
});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/integrations/rates/package.json' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 202ms:
{
  "name": "@goldsmith/rates",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@goldsmith/cache": "workspace:*",
    "ioredis": "^5.3.0"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "ioredis-mock": "^8.9.0",
    "typescript": "^5.4.0"
  }
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/db/src/schema | Select-String -Pattern 'platform_audit_events|audit'" in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 380ms:

packages\db\src\schema\audit-events.ts:4:export const auditEvents = tenantScopedTable('audit_events', {
packages\db\src\schema\index.ts:4:export * from './audit-events';
packages\db\src\schema\index.ts:6:export * from './platform-audit-events';
packages\db\src\schema\platform-audit-events.ts:4:export const platformAuditEvents = 
platformGlobalTable('platform_audit_events', {



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/schema/platform-audit-events.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 295ms:
import { uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { platformGlobalTable } from './_helpers/platformGlobalTable';

export const platformAuditEvents = platformGlobalTable('platform_audit_events', {
  id:         uuid('id').primaryKey().defaultRandom(),
  action:     text('action').notNull(),
  ip_address: text('ip_address'),              // Drizzle's INET support is partial â€” text is safe
  user_agent: text('user_agent'),
  request_id: text('request_id'),
  phone_hash: text('phone_hash'),
  metadata:   jsonb('metadata').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse packages/cache | Select-String -Pattern 'export .*Redis|class Redis|from ''ioredis'''" in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 602ms:

packages\cache\dist\index.d.ts:2:export { default as Redis } from 'ioredis';
packages\cache\dist\tenant-scoped-cache.d.ts:1:import type Redis from 'ioredis';
packages\cache\src\index.ts:2:export { default as Redis } from 'ioredis';
packages\cache\src\tenant-scoped-cache.ts:1:import type Redis from 'ioredis';



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/pricing/pricing.service.spec.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 290ms:
/**
 * Story 4.1 WS-C â€” PricingService unit tests (RED phase)
 * Run: pnpm --filter @goldsmith/api test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { RatesUnavailableError } from '@goldsmith/rates';
import type { PurityRates, RatesResult } from '@goldsmith/rates';
import { AuditAction } from '@goldsmith/audit';
import { PricingService } from './pricing.service';
import type { FallbackChain } from '@goldsmith/rates';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-23T10:00:00.000Z');

const fakePurityRates: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: NOW },
};

const serializedRates = JSON.stringify({
  GOLD_24K: { perGramPaise: '735000', fetchedAt: NOW.toISOString() },
  GOLD_22K: { perGramPaise: '673750', fetchedAt: NOW.toISOString() },
  GOLD_20K: { perGramPaise: '612500', fetchedAt: NOW.toISOString() },
  GOLD_18K: { perGramPaise: '551250', fetchedAt: NOW.toISOString() },
  GOLD_14K: { perGramPaise: '428750', fetchedAt: NOW.toISOString() },
  SILVER_999: { perGramPaise: '9500', fetchedAt: NOW.toISOString() },
  SILVER_925: { perGramPaise: '8788', fetchedAt: NOW.toISOString() },
  stale: false,
  source: 'ibja',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePoolMock() {
  const client = {
    query: vi.fn()
      .mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(client),
    _client: client,
  } as unknown as Pool & { _client: typeof client };
}

function makeRedisMock() {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
  } as unknown as Redis;
}

const fakeRatesResult: RatesResult = {
  rates: fakePurityRates,
  source: 'ibja',
  stale: false,
};

function makeFallbackChainMock() {
  return {
    getRatesByPurity: vi.fn().mockResolvedValue(fakeRatesResult),
    getName: vi.fn().mockReturnValue('fallback-chain'),
  } as unknown as FallbackChain;
}

function makeService(
  pool: Pool,
  fallbackChain: FallbackChain,
  redis: Redis,
) {
  return new PricingService(pool, fallbackChain, redis);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PricingService', () => {
  let pool: ReturnType<typeof makePoolMock>;
  let redis: Redis & { get: Mock; set: Mock; setex: Mock };
  let fallbackChain: FallbackChain & { getRatesByPurity: Mock };
  let service: PricingService;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = makePoolMock();
    redis = makeRedisMock() as Redis & { get: Mock; set: Mock; setex: Mock };
    fallbackChain = makeFallbackChainMock() as FallbackChain & { getRatesByPurity: Mock };
    service = makeService(pool as unknown as Pool, fallbackChain, redis);
  });

  // -------------------------------------------------------------------------
  // refreshRates()
  // -------------------------------------------------------------------------
  describe('refreshRates()', () => {
    it('inserts a snapshot row into ibja_rate_snapshots', async () => {
      await service.refreshRates();

      // pool.connect() should have been called for the insert
      expect(pool.connect).toHaveBeenCalled();
      // The client.query should have been called with an INSERT
      const calls = (pool._client.query as Mock).mock.calls as Array<[string, ...unknown[]]>;
      const insertCall = calls.find(([sql]) => typeof sql === 'string' && sql.includes('ibja_rate_snapshots'));
      expect(insertCall).toBeDefined();
    });

    it('writes rates:current to Redis with 30-min TTL (1800s)', async () => {
      await service.refreshRates();

      expect(redis.setex).toHaveBeenCalledWith(
        'rates:current',
        1800,
        expect.any(String),
      );
    });

    it('logs PRICING_RATES_REFRESHED audit event', async () => {
      await service.refreshRates();

      // The INSERT into platform_audit_events or direct pool call must have happened
      // We verify audit is logged by checking pool.connect was used for audit
      const connectCalls = (pool.connect as Mock).mock.calls.length;
      expect(connectCalls).toBeGreaterThanOrEqual(1);

      // Verify the action written matches PRICING_RATES_REFRESHED
      const clientCalls = (pool._client.query as Mock).mock.calls as Array<[string, unknown[]]>;
      const auditCall = clientCalls.find(([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes('platform_audit_events') &&
        Array.isArray(params) &&
        params.includes(AuditAction.PRICING_RATES_REFRESHED),
      );
      expect(auditCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentRates()
  // -------------------------------------------------------------------------
  describe('getCurrentRates()', () => {
    it('returns cached rates from Redis when cache hit (does NOT call FallbackChain)', async () => {
      (redis.get as Mock).mockResolvedValue(serializedRates);

      const result = await service.getCurrentRates();

      expect(fallbackChain.getRatesByPurity).not.toHaveBeenCalled();
      expect(result.GOLD_24K.perGramPaise).toBe(735000n);
      expect(result.stale).toBe(false);
      expect(result.source).toBe('ibja');
    });

    it('calls FallbackChain when cache miss and caches result with 15-min TTL (900s)', async () => {
      (redis.get as Mock).mockResolvedValue(null);

      await service.getCurrentRates();

      expect(fallbackChain.getRatesByPurity).toHaveBeenCalledOnce();
      expect(redis.setex).toHaveBeenCalledWith(
        'rates:current',
        900,
        expect.any(String),
      );
    });

    it('throws RatesUnavailableError when FallbackChain throws', async () => {
      (redis.get as Mock).mockResolvedValue(null);
      (fallbackChain.getRatesByPurity as Mock).mockRejectedValue(new RatesUnavailableError());

      await expect(service.getCurrentRates()).rejects.toThrow(RatesUnavailableError);
    });
  });
});

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/app.module.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 239ms:
import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { Observable } from 'rxjs';
import { TenantInterceptor } from '@goldsmith/tenant-context';
import { HealthController } from './health.controller';
import { SKIP_TENANT } from './common/decorators/skip-tenant.decorator';
import { HttpTenantResolver } from './tenant-resolver';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { FirebaseJwtGuard } from './common/guards/firebase-jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PolicyGuard } from './modules/auth/guards/policy.guard';
import { AuthModule } from './modules/auth/auth.module';
import { TenantBootModule } from './modules/tenant-boot/tenant-boot.module';
import { TenantLookupModule } from './modules/tenant-lookup/tenant-lookup.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { DrizzleTenantLookup } from './drizzle-tenant-lookup';
import { TenantAuditReporter } from './modules/tenant-boot/tenant-audit-reporter';

@Injectable()
class ConditionalTenantInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly inner: TenantInterceptor,
  ) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT, [ctx.getHandler(), ctx.getClass()]);
    if (skip) return next.handle();
    return this.inner.intercept(ctx, next);
  }
}

@Module({
  imports: [
    BullModule.forRoot({
      connection: (() => {
        const u = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
        return {
          host: u.hostname,
          port: Number(u.port || 6379),
          ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
          ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
          ...(u.pathname && u.pathname !== '/' ? { db: Number(u.pathname.slice(1)) } : {}),
          ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
        };
      })(),
    }),
    AuthModule,
    TenantBootModule,
    TenantLookupModule,
    SettingsModule,
    PricingModule,
  ],
  controllers: [HealthController],
  providers: [
    HttpTenantResolver,
    {
      provide: TenantInterceptor,
      useFactory: (resolver: HttpTenantResolver, tenants: DrizzleTenantLookup, audit: TenantAuditReporter) =>
        new TenantInterceptor(resolver, tenants, audit),
      inject: [HttpTenantResolver, DrizzleTenantLookup, TenantAuditReporter],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new FirebaseJwtGuard(reflector),
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new RolesGuard(reflector),
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useExisting: PolicyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector, inner: TenantInterceptor) =>
        new ConditionalTenantInterceptor(reflector, inner),
      inject: [Reflector, TenantInterceptor],
    },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/package.json' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 310ms:
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
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/bullmq": "^10.2.0",
    "bullmq": "^5.7.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "@goldsmith/audit": "workspace:*",
    "@goldsmith/db": "workspace:*",
    "@goldsmith/rates": "workspace:*",
    "@goldsmith/shared": "workspace:*",
    "@goldsmith/tenant-context": "workspace:*",
    "@goldsmith/observability": "workspace:*",
    "@goldsmith/secrets": "workspace:*",
    "@goldsmith/tenant-config": "workspace:*",
    "@goldsmith/cache": "workspace:*",
    "@azure/storage-blob": "^12.17.0",
    "firebase-admin": "^12.0.0",
    "@nestjs/passport": "^10.0.0",
    "passport": "^0.7.0",
    "passport-http-bearer": "^1.0.1"
  },
  "devDependencies": {
    "@goldsmith/testing-tenant-isolation": "workspace:*",
    "@nestjs/testing": "^10.3.0",
    "@testcontainers/postgresql": "^10.8.0",
    "@types/express": "^4.17.0",
    "@types/pg": "^8.11.0",
    "@types/supertest": "^6.0.0",
    "pg": "^8.11.0",
    "supertest": "^7.0.0",
    "testcontainers": "^10.8.0",
    "vitest": "^1.4.0",
    "typescript": "^5.4.0",
    "@types/passport-http-bearer": "^1.0.41"
  }
}

2026-04-24T01:02:19.836104Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content apps/api/src/modules/pricing/pricing.service.ts | ForEach-Object { $i++; '"'{0,4}: {1}' -f "'$i, $_ }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content apps/api/src/modules/pricing/pricing.service.ts | ForEach-Object { $i++; '"'{0,4}: {1}' -f "'$i, $_ }' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content apps/api/src/modules/pricing/pricing.service.ts | ForEach-Object { $i++; '"'{0,4}: {1}' -f "'$i, $_ }'` rejected: blocked by policy
2026-04-24T01:02:26.652183Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$lines = Get-Content '"'apps/api/src/modules/pricing/pricing.service.ts'; for ("'$i=0; $i -lt $lines.Length; $i++) { Write-Output ((($i+1).ToString().PadLeft(4)) + '"': ' + "'$lines[$i]) }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$lines = Get-Content '"'apps/api/src/modules/pricing/pricing.service.ts'; for ("'$i=0; $i -lt $lines.Length; $i++) { Write-Output ((($i+1).ToString().PadLeft(4)) + '"': ' + "'$lines[$i]) }' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$lines = Get-Content '"'apps/api/src/modules/pricing/pricing.service.ts'; for ("'$i=0; $i -lt $lines.Length; $i++) { Write-Output ((($i+1).ToString().PadLeft(4)) + '"': ' + "'$lines[$i]) }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'apps/api/src/modules/pricing/pricing.service.ts' -Pattern 'const now = new Date\\(\\)|fetched_at: now|JSON.parse\\(raw\\)|deserializeRates\\(cached\\)'" in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 1020ms:

apps\api\src\modules\pricing\pricing.service.ts:68:  return JSON.parse(raw) as CachedCurrentRates;
apps\api\src\modules\pricing\pricing.service.ts:96:      const parsed = deserializeRates(cached);
apps\api\src\modules\pricing\pricing.service.ts:144:    const now = new Date();
apps\api\src\modules\pricing\pricing.service.ts:146:      fetched_at: now,



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/db/src/schema/index.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 252ms:
export * from './shops';
export * from './shop-settings';
export * from './shop-users';
export * from './audit-events';
export * from './auth-rate-limits';
export * from './platform-audit-events';
export { tableRegistry } from './_helpers/registry';
export type { TableMeta, TableKind } from './_helpers/registry';
export * from './role-permissions';
export * from './ibja-rate-snapshots';

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/common/guards/roles.guard.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/auth/guards/policy.guard.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse apps/api/src | Select-String -Pattern 'SKIP_AUTH|skip-auth|SkipAuth'" in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/common/guards/firebase-jwt.guard.ts' in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 578ms:
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '@goldsmith/tenant-context';
import { PermissionsCache } from '@goldsmith/tenant-config';
import { PERMISSION_KEY } from '../../../common/decorators/permission.decorator';
import { PermissionsRepository } from '../permissions.repository';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsCache: PermissionsCache,
    private readonly permissionsRepo: PermissionsRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredKey = this.reflector.get<string | undefined>(PERMISSION_KEY, ctx.getHandler());
    if (!requiredKey) return true;

    const tc = tenantContext.current();
    if (!tc?.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (tc.role === 'shop_admin') return true;

    let perms = await this.permissionsCache.getPermissions(tc.shopId, tc.role);
    if (!perms) {
      perms = await this.permissionsRepo.getPermissions(tc.shopId, tc.role);
      await this.permissionsCache.setPermissions(tc.shopId, tc.role, perms);
    }

    if (!(perms[requiredKey] ?? false)) {
      throw new ForbiddenException({ errorCode: 'auth.permission_denied', permissionKey: requiredKey });
    }
    return true;
  }
}

 succeeded in 493ms:
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SKIP_AUTH } from '../decorators/skip-auth.decorator';

@Injectable()
export class FirebaseJwtGuard extends AuthGuard('firebase-jwt') {
  constructor(private readonly reflector: Reflector) { super(); }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  override canActivate(ctx: ExecutionContext) {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH, [ctx.getHandler(), ctx.getClass()]);
    if (skip) return true;
    return super.canActivate(ctx);
  }
}

 succeeded in 620ms:
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { ShopUserRole } from '@goldsmith/tenant-context';
import type { FirebaseUserClaims } from '../../modules/auth/firebase-jwt.strategy';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ShopUserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    // Read role from req.user (populated by FirebaseJwtGuard which runs before this guard
    // in the APP_GUARD chain). tenantContext is set later by APP_INTERCEPTOR and is NOT
    // available at guard time â€” do NOT read from tenantContext here.
    const req = ctx.switchToHttp().getRequest<Request & { user?: FirebaseUserClaims }>();
    const role = req.user?.role as ShopUserRole | undefined;
    if (!role) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!required.includes(role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    return true;
  }
}

 succeeded in 1002ms:

apps\api\src\health.controller.ts:3:import { SkipAuth } from './common/decorators/skip-auth.decorator';
apps\api\src\health.controller.ts:9:  @SkipAuth()
apps\api\src\common\decorators\skip-auth.decorator.ts:3:export const SKIP_AUTH = 'skip-auth';
apps\api\src\common\decorators\skip-auth.decorator.ts:5:export const SkipAuth = () => SetMetadata(SKIP_AUTH, true);
apps\api\src\common\guards\firebase-jwt.guard.ts:4:import { SKIP_AUTH } from '../decorators/skip-auth.decorator';
apps\api\src\common\guards\firebase-jwt.guard.ts:12:    const skip = 
this.reflector.getAllAndOverride<boolean>(SKIP_AUTH, [ctx.getHandler(), ctx.getClass()]);
apps\api\src\modules\auth\auth.controller.ts:52:  // nosemgrep: goldsmith.skip-tenant-requires-skip-auth -- global 
FirebaseJwtGuard enforces auth; only tenant resolution is deferred until phone→shop lookup inside the handler
apps\api\src\modules\pricing\pricing.controller.spec.ts:87:    it('is a public endpoint — controller metadata has 
SkipAuth', () => {
apps\api\src\modules\pricing\pricing.controller.spec.ts:88:      // Verify that the controller or handler has the 
SKIP_AUTH metadata set
apps\api\src\modules\pricing\pricing.controller.spec.ts:91:      // The SkipAuth decorator sets 'skip-auth' metadata 
on the handler
apps\api\src\modules\pricing\pricing.controller.spec.ts:92:      const metadata = Reflect.getMetadata('skip-auth', 
controller.getCurrent);
apps\api\src\modules\pricing\pricing.controller.ts:2:import { SkipAuth } from 
'../../common/decorators/skip-auth.decorator';
apps\api\src\modules\pricing\pricing.controller.ts:51:  @SkipAuth()
apps\api\src\modules\tenant-boot\tenant-boot.controller.ts:4:import { SkipAuth } from 
'../../common/decorators/skip-auth.decorator';
apps\api\src\modules\tenant-boot\tenant-boot.controller.ts:13:  @SkipAuth()



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'apps/api/src/modules/pricing/pricing.module.ts' -Pattern 'TRADING_HOURS_CRON|WEEKEND_MIDDAY_CRON|OUTSIDE_HOURS_CRON'" in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 389ms:

apps\api\src\modules\pricing\pricing.module.ts:32://   TRADING_HOURS_CRON covers hours 3–11 on weekdays only.
apps\api\src\modules\pricing\pricing.module.ts:33://   WEEKEND_MIDDAY_CRON covers hours 3–11 on weekends only (was 
previously a gap — no refresh for ~8 hrs IST).
apps\api\src\modules\pricing\pricing.module.ts:34://   OUTSIDE_HOURS_CRON covers hours 12–23 and 0–2 every day 
(weekday+weekend hours 3–11 are absent).
apps\api\src\modules\pricing\pricing.module.ts:36:const TRADING_HOURS_CRON  = '*/15 3-11 * * 1-5';      // every 15 
min, Mon–Fri, UTC 03:00–11:59
apps\api\src\modules\pricing\pricing.module.ts:37:const WEEKEND_MIDDAY_CRON = '0 3-11 * * 0,6';         // every hour 
at :00, Sat+Sun, UTC 03:00–11:59
apps\api\src\modules\pricing\pricing.module.ts:38:const OUTSIDE_HOURS_CRON  = '0 12-23,0-2 * * *';      // every hour 
at :00, UTC 12–23 and 0–2, daily
apps\api\src\modules\pricing\pricing.module.ts:100:      { pattern: TRADING_HOURS_CRON },
apps\api\src\modules\pricing\pricing.module.ts:106:      { pattern: WEEKEND_MIDDAY_CRON },
apps\api\src\modules\pricing\pricing.module.ts:112:      { pattern: OUTSIDE_HOURS_CRON },



exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path 'packages/integrations/rates/src/circuit-breaker.ts' -Pattern \"set\\(this.keyOpenedAt, String\\(Date.now\\(\\)\\), 'NX'\\)|setState\\('OPEN'\\)|checkCooldownElapsed|resetFailures\\(\\)\"" in C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation
 succeeded in 6529ms:

packages\integrations\rates\src\circuit-breaker.ts:47:  private async resetFailures(): Promise<void> {
packages\integrations\rates\src\circuit-breaker.ts:61:        await this.redis.set(this.keyOpenedAt, 
String(Date.now()), 'NX');
packages\integrations\rates\src\circuit-breaker.ts:62:        await this.setState('OPEN');
packages\integrations\rates\src\circuit-breaker.ts:67:  private async checkCooldownElapsed(): Promise<boolean> {
packages\integrations\rates\src\circuit-breaker.ts:78:      const elapsed = await this.checkCooldownElapsed();
packages\integrations\rates\src\circuit-breaker.ts:99:      await this.resetFailures();
packages\integrations\rates\src\circuit-breaker.ts:103:      await this.setState('OPEN');



codex
The rates foundation mostly hangs together, but it introduces two correctness issues: persisted snapshot timestamps can be wrong during fallback, and the circuit breaker can skip its cooldown after reopening. Both affect core resiliency/data-integrity behavior, so the patch should not be considered correct as-is.

Full review comments:

- [P2] Preserve upstream fetch timestamp in persisted snapshots — C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation\apps\api\src\modules\pricing\pricing.service.ts:144-146
  When `FallbackChain` returns cached or otherwise delayed data, this code overwrites the source timestamp with `new Date()` before persisting the snapshot. That makes stale rates look freshly fetched in `ibja_rate_snapshots` (and in the audit metadata written below), so any consumer of `getRateHistory()` or freshness checks will see incorrect history whenever the system falls back to last-known-good data.

- [P2] Refresh the circuit open timestamp on every OPEN transition — C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation\packages\integrations\rates\src\circuit-breaker.ts:61-62
  `keyOpenedAt` is stored with `NX` and never expires, so once that key survives a previous open cycle, later transitions to `OPEN` keep the old timestamp. In that state, `checkCooldownElapsed()` can immediately consider the cooldown elapsed and move to `HALF_OPEN` on the very next call, which defeats the intended 120-second backoff after repeated adapter failures.
The rates foundation mostly hangs together, but it introduces two correctness issues: persisted snapshot timestamps can be wrong during fallback, and the circuit breaker can skip its cooldown after reopening. Both affect core resiliency/data-integrity behavior, so the patch should not be considered correct as-is.

Full review comments:

- [P2] Preserve upstream fetch timestamp in persisted snapshots — C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation\apps\api\src\modules\pricing\pricing.service.ts:144-146
  When `FallbackChain` returns cached or otherwise delayed data, this code overwrites the source timestamp with `new Date()` before persisting the snapshot. That makes stale rates look freshly fetched in `ibja_rate_snapshots` (and in the audit metadata written below), so any consumer of `getRateHistory()` or freshness checks will see incorrect history whenever the system falls back to last-known-good data.

- [P2] Refresh the circuit open timestamp on every OPEN transition — C:\Alok\Business Projects\Goldsmith\.worktrees\feat-story-4.1-gold-rates-foundation\packages\integrations\rates\src\circuit-breaker.ts:61-62
  `keyOpenedAt` is stored with `NX` and never expires, so once that key survives a previous open cycle, later transitions to `OPEN` keep the old timestamp. In that state, `checkCooldownElapsed()` can immediately consider the cooldown elapsed and move to `HALF_OPEN` on the very next call, which defeats the intended 120-second backoff after repeated adapter failures.
