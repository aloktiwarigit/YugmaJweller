OpenAI Codex v0.121.0 (research preview)
--------
workdir: C:\Alok\Business Projects\Goldsmith
model: gpt-5.4
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019dc06a-b6c6-7c22-8baf-afef0c4ef0d5
--------
user
changes against 'feat/story-3.5-publish-product'
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff 5c193ee3a2a6e9ebbfd384527da7a43d6aeb9d3e' in C:\Alok\Business Projects\Goldsmith
 succeeded in 300ms:
diff --git a/apps/api/src/modules/catalog/catalog.controller.ts b/apps/api/src/modules/catalog/catalog.controller.ts
index f592aa2..75ebb5c 100644
--- a/apps/api/src/modules/catalog/catalog.controller.ts
+++ b/apps/api/src/modules/catalog/catalog.controller.ts
@@ -1,9 +1,49 @@
-import { Controller, Get, Headers } from '@nestjs/common';
+import { Controller, Get, Header, Headers, HttpException, HttpStatus, Inject } from '@nestjs/common';
 import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
 import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
+import { PricingService } from '../pricing/pricing.service';
+import { RatesUnavailableError } from '@goldsmith/rates';
+
+// ---------------------------------------------------------------------------
+// Public rates response shape (Story 4.4)
+// ---------------------------------------------------------------------------
+
+export interface PublicRateEntry {
+  perGramRupees: string;
+  formattedINR: string;
+  fetchedAt: string;
+}
+
+export interface PublicRatesResponse {
+  GOLD_24K: PublicRateEntry;
+  GOLD_22K: PublicRateEntry;
+  SILVER_999: PublicRateEntry;
+  stale: boolean;
+  source: string;
+  refreshedAt: string;
+}
+
+function toPublicEntry(paise: bigint, fetchedAt: Date): PublicRateEntry {
+  const rupees = (Number(paise) / 100).toFixed(2);
+  const formatted = new Intl.NumberFormat('en-IN', {
+    minimumFractionDigits: 2,
+    maximumFractionDigits: 2,
+  }).format(Number(paise) / 100);
+  return {
+    perGramRupees: rupees,
+    formattedINR: `₹${formatted}`,
+    fetchedAt: fetchedAt.toISOString(),
+  };
+}
+
+// ---------------------------------------------------------------------------
+// Controller
+// ---------------------------------------------------------------------------
 
 @Controller('/api/v1/catalog')
 export class CatalogController {
+  constructor(@Inject(PricingService) private readonly pricingService: PricingService) {}
+
   // TODO Epic 7: implement full catalog with search + filters
   @Get('products')
   @SkipAuth()
@@ -11,4 +51,35 @@ export class CatalogController {
   listPublished(@Headers('x-tenant-id') tenantId: string): { items: unknown[]; total: number; tenantId: string } {
     return { items: [], total: 0, tenantId };
   }
+
+  /**
+   * GET /api/v1/catalog/rates
+   * Public — no auth. Tenant-agnostic (IBJA rates are platform-global).
+   * Serves market rates only; per-tenant overrides are never applied here.
+   */
+  @Get('rates')
+  @SkipAuth()
+  @SkipTenant()
+  @Header('Cache-Control', 'public, max-age=60')
+  async getPublicRates(): Promise<PublicRatesResponse> {
+    try {
+      const rates = await this.pricingService.getCurrentRates();
+      return {
+        GOLD_24K: toPublicEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt),
+        GOLD_22K: toPublicEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt),
+        SILVER_999: toPublicEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt),
+        stale: rates.stale,
+        source: rates.source,
+        refreshedAt: rates.GOLD_24K.fetchedAt.toISOString(),
+      };
+    } catch (err) {
+      if (err instanceof RatesUnavailableError) {
+        throw new HttpException(
+          { code: 'rates.unavailable', stale: true },
+          HttpStatus.SERVICE_UNAVAILABLE,
+        );
+      }
+      throw err;
+    }
+  }
 }
diff --git a/apps/api/src/modules/catalog/catalog.module.ts b/apps/api/src/modules/catalog/catalog.module.ts
index ccfd401..92f5707 100644
--- a/apps/api/src/modules/catalog/catalog.module.ts
+++ b/apps/api/src/modules/catalog/catalog.module.ts
@@ -1,7 +1,9 @@
 import { Module } from '@nestjs/common';
+import { PricingModule } from '../pricing/pricing.module';
 import { CatalogController } from './catalog.controller';
 
 @Module({
+  imports: [PricingModule],
   controllers: [CatalogController],
 })
 export class CatalogModule {}
diff --git a/apps/shopkeeper/app/inventory/_layout.tsx b/apps/shopkeeper/app/inventory/_layout.tsx
index ccf849d..7c9611d 100644
--- a/apps/shopkeeper/app/inventory/_layout.tsx
+++ b/apps/shopkeeper/app/inventory/_layout.tsx
@@ -11,6 +11,7 @@ export default function InventoryLayout(): React.ReactElement {
         headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
       }}
     >
+      <Stack.Screen name="index" options={{ title: 'इन्वेंटरी' }} />
       <Stack.Screen name="new" options={{ title: t('inventory.title_new') }} />
       <Stack.Screen name="[id]/edit" options={{ title: t('inventory.title_edit') }} />
       <Stack.Screen name="print-labels" options={{ title: 'लेबल प्रिंट करें' }} />
diff --git a/packages/ui-mobile/src/business/index.ts b/packages/ui-mobile/src/business/index.ts
index 657f666..1ea3725 100644
--- a/packages/ui-mobile/src/business/index.ts
+++ b/packages/ui-mobile/src/business/index.ts
@@ -1,2 +1,4 @@
 export { RateHistoryChart } from './RateHistoryChart';
 export type { RateHistoryChartProps, RateHistoryPoint } from './RateHistoryChart';
+export { RateWidget } from './RateWidget';
+export type { RateWidgetProps, PublicRatesResponse, PublicRateEntry } from './RateWidget';
diff --git a/packages/ui-mobile/src/index.ts b/packages/ui-mobile/src/index.ts
index 7fe4896..e836511 100644
--- a/packages/ui-mobile/src/index.ts
+++ b/packages/ui-mobile/src/index.ts
@@ -28,3 +28,5 @@ export type { Code128Result } from './primitives/code128';
 
 export { RateHistoryChart } from './business/RateHistoryChart';
 export type { RateHistoryChartProps, RateHistoryPoint } from './business/RateHistoryChart';
+export { RateWidget } from './business/RateWidget';
+export type { RateWidgetProps, PublicRatesResponse, PublicRateEntry } from './business/RateWidget';
diff --git a/packages/ui-mobile/test/react-native.mock.ts b/packages/ui-mobile/test/react-native.mock.ts
index 500c436..01b344c 100644
--- a/packages/ui-mobile/test/react-native.mock.ts
+++ b/packages/ui-mobile/test/react-native.mock.ts
@@ -49,6 +49,7 @@ export const View = passthrough('view');
 export const Text = passthrough('text');
 export const Pressable = PressableMock;
 export const TextInput = TextInputMock;
+export const ScrollView = passthrough('scrollview');
 export const StyleSheet = {
   create: <T>(s: T): T => s,
   flatten: (s: unknown): Record<string, unknown> =>
@@ -58,3 +59,27 @@ export const StyleSheet = {
   // Match the iOS/Android value so components using StyleSheet.hairlineWidth compile/run in tests
   hairlineWidth: 0.5,
 };
+
+// Minimal Animated mock — no-op animations, passthrough View for rendering
+const noopAnimation = { start: (_cb?: () => void) => {}, stop: () => {}, reset: () => {} };
+export const Animated = {
+  Value: class {
+    constructor(_v: number) {}
+    stopAnimation(_cb?: () => void) {}
+    setValue(_v: number) {}
+    addListener(_cb: (_v: { value: number }) => void): string { return ''; }
+    removeAllListeners() {}
+  },
+  View: passthrough('animated-view'),
+  timing: (_val: unknown, _config: unknown) => noopAnimation,
+  loop: (_animation: typeof noopAnimation) => noopAnimation,
+  sequence: (_animations: unknown[]) => noopAnimation,
+  parallel: (_animations: unknown[]) => noopAnimation,
+  spring: (_val: unknown, _config: unknown) => noopAnimation,
+  delay: (_ms: number) => noopAnimation,
+};
+
+export const AccessibilityInfo = {
+  isReduceMotionEnabled: () => Promise.resolve(false),
+  addEventListener: (_event: string, _handler: () => void) => ({ remove: () => {} }),
+};

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/pricing/pricing.service.ts' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/pricing/pricing.module.ts' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/ui-mobile/src/business/RateWidget.tsx' in C:\Alok\Business Projects\Goldsmith
 succeeded in 323ms:
import {
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from '@goldsmith/queue';
import { Redis } from '@goldsmith/cache';
import { AuthModule } from '../auth/auth.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { RatesRefreshProcessor } from '../../workers/rates-refresh.processor';
import {
  FallbackChain,
  IbjaAdapter,
  MetalsDevAdapter,
  CircuitBreaker,
  LastKnownGoodCache,
} from '@goldsmith/rates';

// ---------------------------------------------------------------------------
// IST trading hours cron patterns (UTC+5:30)
// Note: cron pattern '3-11' fires from 03:00 UTC (= 08:30 IST), 30 min before IBJA's
// 09:00 IST open. Pre-market fetches are harmless â€” stub/real adapter returns current rate.
//
// Three mutually exclusive patterns:
//   Trading hours   â€” every 15 min, Monâ€“Fri, UTC hours 03:00â€“11:59 (08:30â€“17:29 IST)
//   Weekend midday  â€” every hour at :00, Sat+Sun, UTC hours 03:00â€“11:59 (08:30â€“17:29 IST)
//   Outside hours   â€” every hour at :00, UTC hours 12â€“23 and 0â€“2 (daily incl. weekends)
//
// The patterns share no overlap:
//   TRADING_HOURS_CRON covers hours 3â€“11 on weekdays only.
//   WEEKEND_MIDDAY_CRON covers hours 3â€“11 on weekends only (was previously a gap â€” no refresh for ~8 hrs IST).
//   OUTSIDE_HOURS_CRON covers hours 12â€“23 and 0â€“2 every day (weekday+weekend hours 3â€“11 are absent).
// ---------------------------------------------------------------------------
const TRADING_HOURS_CRON  = '*/15 3-11 * * 1-5';      // every 15 min, Monâ€“Fri, UTC 03:00â€“11:59
const WEEKEND_MIDDAY_CRON = '0 3-11 * * 0,6';         // every hour at :00, Sat+Sun, UTC 03:00â€“11:59
const OUTSIDE_HOURS_CRON  = '0 12-23,0-2 * * *';      // every hour at :00, UTC 12â€“23 and 0â€“2, daily

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: 'rates-refresh' }),
  ],
  providers: [
    // PG Pool â€” reuse the one exported from AuthModule (injected by token)
    // We use 'PG_POOL' which is provided and exported by AuthModule
    {
      provide: 'PRICING_REDIS',
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
    {
      provide: LastKnownGoodCache,
      useFactory: (redis: Redis) => new LastKnownGoodCache(redis),
      inject: ['PRICING_REDIS'],
    },
    {
      provide: IbjaAdapter,
      useFactory: () => new IbjaAdapter(),
    },
    {
      provide: MetalsDevAdapter,
      useFactory: () => new MetalsDevAdapter(),
    },
    {
      provide: 'IBJA_WITH_CB',
      useFactory: (ibja: IbjaAdapter, redis: Redis) => new CircuitBreaker(ibja, redis),
      inject: [IbjaAdapter, 'PRICING_REDIS'],
    },
    {
      provide: 'METALSDEV_WITH_CB',
      useFactory: (metalsdev: MetalsDevAdapter, redis: Redis) => new CircuitBreaker(metalsdev, redis),
      inject: [MetalsDevAdapter, 'PRICING_REDIS'],
    },
    {
      provide: FallbackChain,
      useFactory: (
        ibja: CircuitBreaker,
        metalsdev: CircuitBreaker,
        lkg: LastKnownGoodCache,
      ) => new FallbackChain(ibja, metalsdev, lkg, console),
      inject: ['IBJA_WITH_CB', 'METALSDEV_WITH_CB', LastKnownGoodCache],
    },
    PricingService,
    RatesRefreshProcessor,
  ],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectQueue('rates-refresh') private readonly queue: Queue,
    @Inject('PRICING_REDIS') private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register repeatable jobs â€” best-effort: Redis may be transiently unavailable at boot
    try {
      await this.queue.upsertJobScheduler(
        'refresh-trading-hours',
        { pattern: TRADING_HOURS_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
      await this.queue.upsertJobScheduler(
        'refresh-weekend-midday',
        { pattern: WEEKEND_MIDDAY_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
      await this.queue.upsertJobScheduler(
        'refresh-outside-hours',
        { pattern: OUTSIDE_HOURS_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
    } catch (err) {
      new Logger(PricingModule.name).warn(`Rate refresh job schedulers could not be registered at boot â€” will retry on next restart: ${String(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

 succeeded in 328ms:
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Skeleton } from '../primitives/Skeleton';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

// ---------------------------------------------------------------------------
// Shared types (exported for usePublicRates hook + tests)
// ---------------------------------------------------------------------------

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR: string;
  fetchedAt: string;
}

export interface PublicRatesResponse {
  GOLD_24K: PublicRateEntry;
  GOLD_22K: PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale: boolean;
  source: string;
  refreshedAt: string;
}

export interface RateWidgetProps {
  variant: 'full' | 'compact' | 'ticker';
  rates: PublicRatesResponse | null;
  loading?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOT_GREEN = '#22c55e';
const DOT_YELLOW = '#f59e0b';
const DOT_RED = '#ef4444';

const METAL_LABELS: Record<'GOLD_24K' | 'GOLD_22K' | 'SILVER_999', string> = {
  GOLD_24K: '24 à¤•à¥ˆà¤°à¥‡à¤Ÿ à¤¸à¥‹à¤¨à¤¾',
  GOLD_22K: '22 à¤•à¥ˆà¤°à¥‡à¤Ÿ à¤¸à¥‹à¤¨à¤¾',
  SILVER_999: 'à¤šà¤¾à¤à¤¦à¥€ 999',
};

// ---------------------------------------------------------------------------
// Freshness helpers
// ---------------------------------------------------------------------------

type FreshnessLevel = 'fresh' | 'aging' | 'stale';

function getFreshnessLevel(refreshedAt: string, stale: boolean): FreshnessLevel {
  if (stale) return 'stale';
  const ageMin = (Date.now() - new Date(refreshedAt).getTime()) / 60000;
  if (ageMin < 30) return 'fresh';
  if (ageMin < 60) return 'aging';
  return 'stale';
}

function getFreshnessColor(level: FreshnessLevel): string {
  if (level === 'fresh') return DOT_GREEN;
  if (level === 'aging') return DOT_YELLOW;
  return DOT_RED;
}

function getFreshnessText(refreshedAt: string, stale: boolean): string {
  if (stale) return 'à¤¦à¤° à¤ªà¥à¤°à¤¾à¤¨à¥€ à¤¹à¥ˆ';
  const ageMin = Math.floor((Date.now() - new Date(refreshedAt).getTime()) / 60000);
  if (ageMin < 2) return 'à¤…à¤­à¥€ à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤¹à¥à¤†';
  return `${ageMin} à¤®à¤¿à¤¨à¤Ÿ à¤ªà¤¹à¤²à¥‡`;
}

function rupeeInt(perGramRupees: string): string {
  return Math.round(parseFloat(perGramRupees)).toLocaleString('en-IN');
}

// ---------------------------------------------------------------------------
// RateWidget
// ---------------------------------------------------------------------------

export function RateWidget({ variant, rates, loading = false, onPress }: RateWidgetProps): React.ReactElement {
  const [reduceMotion, setReduceMotion] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (variant !== 'ticker' || rates === null || reduceMotion) return;

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -600,
        duration: 12000,
        useNativeDriver: true,
      } as Parameters<typeof Animated.timing>[1]),
    );
    animation.start();
    return () => {
      translateX.setValue(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, reduceMotion, variant]);

  if (loading) {
    return (
      <View style={styles.loadingRow} testID="rate-widget-loading">
        <Skeleton height={14} width={180} />
        <View style={{ width: spacing.sm ?? 8 }} />
        <Skeleton height={14} width={80} />
      </View>
    );
  }

  // ---- full ----------------------------------------------------------------
  if (variant === 'full') {
    if (rates === null) {
      return (
        <View
          style={styles.offlineContainer}
          testID="rate-widget-offline"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.offlineText}>à¤¦à¤° à¤…à¤¸à¥à¤¥à¤¾à¤¯à¥€ à¤°à¥‚à¤ª à¤¸à¥‡ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚</Text>
        </View>
      );
    }

    const level = getFreshnessLevel(rates.refreshedAt, rates.stale);
    const dotColor = getFreshnessColor(level);
    const freshnessText = getFreshnessText(rates.refreshedAt, rates.stale);
    const metals = ['GOLD_24K', 'GOLD_22K', 'SILVER_999'] as const;

    return (
      <View style={styles.fullContainer} testID="rate-widget-full">
        {metals.map((metal) => (
          <View
            key={metal}
            style={styles.fullRow}
            testID={`rate-widget-row-${metal}`}
            accessibilityLabel={`${METAL_LABELS[metal]}: ${rates[metal].formattedINR} à¤ªà¥à¤°à¤¤à¤¿ à¤—à¥à¤°à¤¾à¤®`}
          >
            <Text style={styles.metalLabel}>{METAL_LABELS[metal]}</Text>
            <Text style={styles.rateValue}>{rates[metal].formattedINR}/g</Text>
            <View style={styles.freshnessRow}>
              <View
                style={{ ...styles.dot, backgroundColor: dotColor }}
                testID={`rate-widget-dot-${metal}`}
              />
              <Text style={styles.freshnessText}>{freshnessText}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // ---- compact -------------------------------------------------------------
  if (variant === 'compact') {
    if (rates === null) {
      return (
        <View style={styles.offlineContainer} testID="rate-widget-offline">
          <Text style={styles.offlineText}>à¤¦à¤° à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚</Text>
        </View>
      );
    }

    const level = getFreshnessLevel(rates.refreshedAt, rates.stale);
    const dotColor = getFreshnessColor(level);
    const compact22 = rupeeInt(rates.GOLD_22K.perGramRupees);
    const compact24 = rupeeInt(rates.GOLD_24K.perGramRupees);

    return (
      <Pressable
        style={styles.compactContainer}
        testID="rate-widget-compact"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`22K â‚¹${compact22} Â· 24K â‚¹${compact24} à¤ªà¥à¤°à¤¤à¤¿ à¤—à¥à¤°à¤¾à¤®`}
      >
        <Text style={styles.compactText}>
          {`22K â‚¹${compact22} Â· 24K â‚¹${compact24}`}
        </Text>
        <View style={{ ...styles.dot, backgroundColor: dotColor, marginLeft: spacing.xs ?? 6 }} />
      </Pressable>
    );
  }

  // ---- ticker ---------------------------------------------------------------
  if (rates === null) {
    return (
      <View style={{ ...styles.tickerContainer, ...styles.offlineContainer }} testID="rate-widget-offline">
        <Text style={styles.offlineText}>à¤¦à¤° à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚</Text>
      </View>
    );
  }

  const t22 = rupeeInt(rates.GOLD_22K.perGramRupees);
  const t24 = rupeeInt(rates.GOLD_24K.perGramRupees);
  const t999 = rupeeInt(rates.SILVER_999.perGramRupees);
  const tickerText = `22K â‚¹${t22}/g  â€¢  24K â‚¹${t24}/g  â€¢  999 â‚¹${t999}/g`;

  return (
    <View style={styles.tickerContainer} testID="rate-widget-ticker">
      <Animated.View
        style={reduceMotion ? undefined : { transform: [{ translateX }] }}
        testID="rate-widget-ticker-content"
      >
        <Text style={styles.tickerText}>{tickerText}</Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm ?? 8,
  },
  offlineContainer: {
    backgroundColor: colors.border ?? '#E5E7EB',
    borderRadius: 8,
    padding: spacing.sm ?? 8,
    alignItems: 'center',
  },
  offlineText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary ?? '#6B7280',
  },
  fullContainer: {
    backgroundColor: colors.white ?? '#FFFFFF',
    borderRadius: 12,
    padding: spacing.md ?? 16,
    gap: spacing.sm ?? 8,
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  metalLabel: {
    flex: 1,
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.textPrimary ?? '#1C1917',
  },
  rateValue: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.ink ?? '#1C1917',
    fontWeight: '600',
    marginRight: spacing.sm ?? 8,
  },
  freshnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  freshnessText: {
    fontFamily: typography.body.family,
    fontSize: 12,
    color: colors.textSecondary ?? '#6B7280',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm ?? 8,
    paddingVertical: spacing.xs ?? 4,
    minHeight: 44,
  },
  compactText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textPrimary ?? '#1C1917',
    fontWeight: '600',
  },
  tickerContainer: {
    overflow: 'hidden',
    height: 32,
    justifyContent: 'center',
  },
  tickerText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.textPrimary ?? '#1C1917',
  },
});

 succeeded in 392ms:
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { FallbackChain } from '@goldsmith/rates';
import type { PurityRates } from '@goldsmith/rates';
import { AuditAction } from '@goldsmith/audit';
import { withTenantTx } from '@goldsmith/db';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { Decimal } from 'decimal.js';
import type { PurityKey } from '@goldsmith/shared';

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

export interface RateHistoryPoint {
  date: string;          // 'YYYY-MM-DD'
  perGramPaise: string;  // bigint serialised as string
  perGramRupees: string; // formatted for display, e.g. "6,842.00"
  source: string;
  stale: boolean;
}

// Maps PurityKey â†’ the corresponding column name in ibja_rate_snapshots.
// No dynamic SQL â€” we always SELECT all columns and pick here.
const PURITY_TO_COLUMN = {
  GOLD_24K: 'gold_24k_paise',
  GOLD_22K: 'gold_22k_paise',
  GOLD_20K: 'gold_20k_paise',
  GOLD_18K: 'gold_18k_paise',
  GOLD_14K: 'gold_14k_paise',
  SILVER_999: 'silver_999_paise',
  SILVER_925: 'silver_925_paise',
} as const satisfies Record<PurityKey, keyof RateSnapshotRow>;

function formatRupees(paise: bigint): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(paise) / 100);
}

const REDIS_KEY_CURRENT = 'rates:current';
const TTL_CURRENT_CACHE_SEC = 900;   // 15 min â€” on cache miss, after FallbackChain call
const TTL_REFRESH_SEC = 1800;        // 30 min â€” on explicit refreshRates()

// Redis TTL cap for override cache entries (10 minutes)
const TTL_OVERRIDE_MAX_SEC = 600;

// IST is UTC+5:30
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function endOfDayIST(): Date {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCHours(23, 59, 59, 999);
  return new Date(nowIST.getTime() - IST_OFFSET_MS);
}

function overrideRedisKey(ctx: AuthenticatedTenantContext, purity: string): string {
  return `rates:override:${ctx.shopId}:${purity}`;
}

// ---------------------------------------------------------------------------
// Serialization helpers (bigint cannot be JSON.stringify'd natively)
// ---------------------------------------------------------------------------

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

export interface ActiveOverride {
  overridePaise: bigint;
  validUntil: Date;
  reason: string;
}

export interface TenantRatesResult extends CurrentRatesResult {
  overriddenPurities: PurityKey[];
}

export interface SetOverrideDto {
  purity: PurityKey;
  overrideRupees: string;
  reason: string;
  validUntilIso?: string;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly fallbackChain: FallbackChain,
    @Inject('PRICING_REDIS') private readonly redis: Redis,
  ) {}

  private evictCache(): void {
    this.redis.del(REDIS_KEY_CURRENT).catch((e: unknown) =>
      this.logger.warn(`Cache eviction failed (best-effort): ${String(e)}`),
    );
  }

  // -------------------------------------------------------------------------
  // getCurrentRates â€” try Redis cache first, fall back to FallbackChain
  // -------------------------------------------------------------------------
  async getCurrentRates(): Promise<CurrentRatesResult> {
    let cached: string | null = null;
    try {
      cached = await this.redis.get(REDIS_KEY_CURRENT);
    } catch (redisErr) {
      this.logger.warn(`Redis unavailable in getCurrentRates â€” falling through to FallbackChain: ${String(redisErr)}`);
    }
    if (cached !== null) {
      let parsed: CachedCurrentRates | null = null;
      try {
        parsed = deserializeRates(cached);
      } catch {
        // Malformed JSON â€” treat as cache miss and evict
        this.logger.warn('Cached rates entry is malformed â€” evicting and falling through to FallbackChain');
        this.evictCache();
      }

      if (parsed !== null) {
      // Guard: if any required purity key is missing (stale/incompatible schema from a
      // previous deployment), treat as a cache miss rather than crashing with BigInt(undefined).
      const requiredKeys = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925'] as const;
      if (requiredKeys.some(k => !parsed[k])) {
        this.logger.warn('Cached rates schema is stale/incompatible â€” evicting and falling through to FallbackChain');
        this.evictCache();
        // Fall through to FallbackChain below
      } else {
        // Re-hydrate bigints; treat invalid values as cache miss
        try {
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
        } catch {
          this.logger.warn('Cached rates contain invalid field values â€” evicting and falling through to FallbackChain');
          this.evictCache();
        }
      }
      } // end if (parsed !== null)
    }

    // Cache miss â€” call FallbackChain (throws RatesUnavailableError if all sources fail)
    const liveResult = await this.fallbackChain.getRatesByPurity();
    const { rates: liveRates, source, stale } = liveResult;

    // Only cache live rates â€” skip Redis write for LKG; non-fatal if Redis write fails
    if (source !== 'last_known_good') {
      try {
        const serialized = serializeRates(liveRates, stale, source);
        await this.redis.setex(REDIS_KEY_CURRENT, TTL_CURRENT_CACHE_SEC, serialized);
      } catch (redisErr) {
        this.logger.warn(`Redis write failed in getCurrentRates â€” returning live rates without caching: ${String(redisErr)}`);
      }
    }

    return { ...liveRates, stale, source };
  }

  // -------------------------------------------------------------------------
  // refreshRates â€” called by BullMQ worker on schedule
  // -------------------------------------------------------------------------
  async refreshRates(): Promise<void> {
    const { rates, source, stale } = await this.fallbackChain.getRatesByPurity();

    // Skip Redis write and snapshot insert for LKG â€” stale data would pollute cache and history
    if (source === 'last_known_good') {
      this.logger.warn(`Rates served from last_known_good cache (stale=${String(stale)}) â€” skipping Redis write and snapshot insert`);
      return;
    }

    // 1. Write to Redis 'rates:current' with 30-min TTL (live data only); non-fatal if Redis is down
    try {
      const serialized = serializeRates(rates, stale, source);
      await this.redis.setex(REDIS_KEY_CURRENT, TTL_REFRESH_SEC, serialized);
    } catch (redisErr) {
      this.logger.warn(`Redis write failed in refreshRates â€” continuing to persist snapshot: ${String(redisErr)}`);
    }

    const snapshotValues = {
      fetched_at: rates.GOLD_24K.fetchedAt,
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
      await client.query('BEGIN');
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
          JSON.stringify({ source, fetchedAt: rates.GOLD_24K.fetchedAt.toISOString() }),
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    this.logger.log(`Rates refreshed from ${source} at ${rates.GOLD_24K.fetchedAt.toISOString()}`);
  }

  // -------------------------------------------------------------------------
  // getRateHistory â€” last snapshot per calendar day for the requested range
  // -------------------------------------------------------------------------
  async getRateHistory(
    range: '30d' | '90d' | '365d',
    purity: PurityKey = 'GOLD_22K',
  ): Promise<RateHistoryPoint[]> {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const column = PURITY_TO_COLUMN[purity];

    const client = await this.pool.connect();
    try {
      // DISTINCT ON picks the last snapshot of each calendar day (ORDER DESC by fetched_at).
      // Outer ORDER BY date ASC gives chronological output.
      // Lower bound = midnight UTC today minus N days â€” ensures the first calendar
      // day is included in full regardless of what time of day the request arrives.
      const result = await client.query<RateSnapshotRow>(
        `SELECT *
           FROM (
             SELECT DISTINCT ON (date_trunc('day', fetched_at))
               fetched_at, source, stale,
               gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
               silver_999_paise, silver_925_paise
             FROM ibja_rate_snapshots
             WHERE fetched_at >= date_trunc('day', NOW()) - ($1 * INTERVAL '1 day')
             ORDER BY date_trunc('day', fetched_at) ASC, fetched_at DESC
           ) AS bucketed
           ORDER BY fetched_at ASC`,
        [days],
      );

      return result.rows.map((row) => {
        const paise = row[column] as bigint;
        return {
          date: row.fetched_at.toISOString().slice(0, 10),
          perGramPaise: paise.toString(),
          perGramRupees: formatRupees(paise),
          source: row.source,
          stale: row.stale,
        };
      });
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------------------
  // setOverride â€” shopkeeper manually overrides a purity rate for today
  // -------------------------------------------------------------------------
  async setOverride(
    ctx: AuthenticatedTenantContext,
    dto: SetOverrideDto,
  ): Promise<void> {
    const paise = BigInt(new Decimal(dto.overrideRupees).mul(100).toFixed(0));
    const validUntil = dto.validUntilIso ? new Date(dto.validUntilIso) : endOfDayIST();

    // Get current IBJA rate for before-value in audit log (best-effort; non-fatal)
    let beforePaise: string | null = null;
    try {
      const baseRates = await this.getCurrentRates();
      beforePaise = baseRates[dto.purity].perGramPaise.toString();
    } catch {
      // Non-fatal â€” audit still written, just without before value
    }

    await withTenantTx(this.pool, async (tx) => {
      await tx.query(
        `INSERT INTO shop_rate_overrides
           (shop_id, purity, override_paise, reason, set_by_user_id, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ctx.shopId, dto.purity, paise, dto.reason, ctx.userId, validUntil],
      );
      await tx.query(
        `INSERT INTO audit_events
           (shop_id, actor_user_id, action, subject_type, subject_id, before, after)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ctx.shopId,
          ctx.userId,
          AuditAction.PRICING_RATE_OVERRIDE_SET,
          'rate_override',
          dto.purity,
          beforePaise !== null ? JSON.stringify({ perGramPaise: beforePaise }) : null,
          JSON.stringify({ perGramPaise: paise.toString(), reason: dto.reason }),
        ],
      );
    });

    // Invalidate cached override for this shop+purity (best-effort)
    this.redis.del(overrideRedisKey(ctx, dto.purity)).catch((e: unknown) =>
      this.logger.warn(`Override cache eviction failed: ${String(e)}`),
    );
  }

  // -------------------------------------------------------------------------
  // getActiveOverride â€” fetch the current active override for a shop+purity
  // -------------------------------------------------------------------------
  async getActiveOverride(
    ctx: AuthenticatedTenantContext,
    purity: PurityKey,
  ): Promise<ActiveOverride | null> {
    const key = overrideRedisKey(ctx, purity);

    // Redis hit
    let cached: string | null = null;
    try {
      cached = await this.redis.get(key);
    } catch {
      // Redis unavailable â€” fall through to DB
    }
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as { overridePaise: string; validUntil: string; reason: string };
        return {
          overridePaise: BigInt(parsed.overridePaise),
          validUntil: new Date(parsed.validUntil),
          reason: parsed.reason,
        };
      } catch {
        // Malformed â€” evict and fall through
        this.redis.del(key).catch(() => undefined);
      }
    }

    // DB query through withTenantTx (RLS-enforced)
    const row = await withTenantTx(this.pool, async (tx) => {
      const result = await tx.query<{ override_paise: bigint; valid_until: Date; reason: string }>(
        `SELECT override_paise, valid_until, reason
           FROM shop_rate_overrides
          WHERE purity = $1
            AND valid_until > now()
          ORDER BY valid_from DESC
          LIMIT 1`,
        [purity],
      );
      return result.rows[0] ?? null;
    });

    if (row === null) return null;

    const override: ActiveOverride = {
      overridePaise: BigInt(row.override_paise),
      validUntil: row.valid_until,
      reason: row.reason,
    };

    // Cache result until validUntil (capped at TTL_OVERRIDE_MAX_SEC)
    const ttlSec = Math.min(
      Math.max(0, Math.floor((override.validUntil.getTime() - Date.now()) / 1000)),
      TTL_OVERRIDE_MAX_SEC,
    );
    if (ttlSec > 0) {
      this.redis
        .setex(
          key,
          ttlSec,
          JSON.stringify({
            overridePaise: override.overridePaise.toString(),
            validUntil: override.validUntil.toISOString(),
            reason: override.reason,
          }),
        )
        .catch((e: unknown) =>
          this.logger.warn(`Override cache write failed: ${String(e)}`),
        );
    }

    return override;
  }

  // -------------------------------------------------------------------------
  // getCurrentRatesForTenant â€” base rates with per-tenant overrides applied
  // -------------------------------------------------------------------------
  async getCurrentRatesForTenant(ctx: AuthenticatedTenantContext): Promise<TenantRatesResult> {
    const base = await this.getCurrentRates();
    const purities: PurityKey[] = [
      'GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925',
    ];

    const overrides = await Promise.all(
      purities.map((p) => this.getActiveOverride(ctx, p)),
    );

    const merged = { ...base };
    const overriddenPurities: PurityKey[] = [];

    purities.forEach((purity, i) => {
      const ov = overrides[i];
      if (ov !== null) {
        merged[purity] = { perGramPaise: ov.overridePaise, fetchedAt: base[purity].fetchedAt };
        overriddenPurities.push(purity);
      }
    });

    return { ...merged, overriddenPurities };
  }
}

2026-04-24T16:55:30.701614Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/test,apps/api/src -Include *catalog*test*,*pricing*test* | Select-Object -ExpandProperty FullName'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/catalog/catalog.controller.ts' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/test,apps/api/src -Include *catalog*test*,*pricing*test* | Select-Object -ExpandProperty FullName' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/src/modules/catalog | Select-Object -ExpandProperty FullName' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/test,apps/api/src -Include *catalog*test*,*pricing*test* | Select-Object -ExpandProperty FullName'` rejected: blocked by policy
 succeeded in 298ms:
import { Controller, Get, Header, Headers, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { PricingService } from '../pricing/pricing.service';
import { RatesUnavailableError } from '@goldsmith/rates';

// ---------------------------------------------------------------------------
// Public rates response shape (Story 4.4)
// ---------------------------------------------------------------------------

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR: string;
  fetchedAt: string;
}

export interface PublicRatesResponse {
  GOLD_24K: PublicRateEntry;
  GOLD_22K: PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale: boolean;
  source: string;
  refreshedAt: string;
}

function toPublicEntry(paise: bigint, fetchedAt: Date): PublicRateEntry {
  const rupees = (Number(paise) / 100).toFixed(2);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(paise) / 100);
  return {
    perGramRupees: rupees,
    formattedINR: `â‚¹${formatted}`,
    fetchedAt: fetchedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('/api/v1/catalog')
export class CatalogController {
  constructor(@Inject(PricingService) private readonly pricingService: PricingService) {}

  // TODO Epic 7: implement full catalog with search + filters
  @Get('products')
  @SkipAuth()
  @SkipTenant()
  listPublished(@Headers('x-tenant-id') tenantId: string): { items: unknown[]; total: number; tenantId: string } {
    return { items: [], total: 0, tenantId };
  }

  /**
   * GET /api/v1/catalog/rates
   * Public â€” no auth. Tenant-agnostic (IBJA rates are platform-global).
   * Serves market rates only; per-tenant overrides are never applied here.
   */
  @Get('rates')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=60')
  async getPublicRates(): Promise<PublicRatesResponse> {
    try {
      const rates = await this.pricingService.getCurrentRates();
      return {
        GOLD_24K: toPublicEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt),
        GOLD_22K: toPublicEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt),
        SILVER_999: toPublicEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt),
        stale: rates.stale,
        source: rates.source,
        refreshedAt: rates.GOLD_24K.fetchedAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof RatesUnavailableError) {
        throw new HttpException(
          { code: 'rates.unavailable', stale: true },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw err;
    }
  }
}

 succeeded in 337ms:
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\catalog\catalog.controller.spec.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\catalog\catalog.controller.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\catalog\catalog.module.ts

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/modules/catalog/catalog.controller.spec.ts' in C:\Alok\Business Projects\Goldsmith
 succeeded in 314ms:
/**
 * Story 4.4 â€” CatalogController unit + HTTP integration tests
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import request from 'supertest';
import { RatesUnavailableError } from '@goldsmith/rates';
import { CatalogController } from './catalog.controller';
import { PricingService } from '../pricing/pricing.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-24T10:00:00.000Z');

const fakeRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: NOW },
  stale: false,
  source: 'ibja',
};

const mockPricingService = {
  getCurrentRates: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CatalogController', () => {
  let controller: CatalogController;
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: PricingService, useValue: mockPricingService }],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (mockPricingService.getCurrentRates as Mock).mockResolvedValue(fakeRates);
  });

  // -------------------------------------------------------------------------
  // Unit tests â€” getPublicRates()
  // -------------------------------------------------------------------------

  describe('getPublicRates() â€” unit', () => {
    it('returns correctly shaped PublicRatesResponse', async () => {
      const result = await controller.getPublicRates();

      expect(result.GOLD_24K).toEqual({
        perGramRupees: '7350.00',
        formattedINR: 'â‚¹7,350.00',
        fetchedAt: NOW.toISOString(),
      });
      expect(result.GOLD_22K.perGramRupees).toBe('6737.50');
      expect(result.GOLD_22K.formattedINR).toMatch(/^â‚¹/);
      expect(result.SILVER_999).toEqual({
        perGramRupees: '95.00',
        formattedINR: 'â‚¹95.00',
        fetchedAt: NOW.toISOString(),
      });
      expect(result.stale).toBe(false);
      expect(result.source).toBe('ibja');
      expect(result.refreshedAt).toBe(NOW.toISOString());
    });

    it('propagates stale flag from rates service', async () => {
      (mockPricingService.getCurrentRates as Mock).mockResolvedValue({
        ...fakeRates,
        stale: true,
        source: 'last_known_good',
      });

      const result = await controller.getPublicRates();
      expect(result.stale).toBe(true);
      expect(result.source).toBe('last_known_good');
    });

    it('returns 503 with rates.unavailable + stale:true when all sources fail', async () => {
      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());

      await expect(controller.getPublicRates()).rejects.toBeInstanceOf(HttpException);

      try {
        await controller.getPublicRates();
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(503);
        expect((err as HttpException).getResponse()).toMatchObject({
          code: 'rates.unavailable',
          stale: true,
        });
      }
    });

    it('only includes GOLD_24K, GOLD_22K, SILVER_999 in response', async () => {
      const result = await controller.getPublicRates();
      expect(result).toHaveProperty('GOLD_24K');
      expect(result).toHaveProperty('GOLD_22K');
      expect(result).toHaveProperty('SILVER_999');
      expect(result).not.toHaveProperty('GOLD_18K');
      expect(result).not.toHaveProperty('GOLD_14K');
      expect(result).not.toHaveProperty('SILVER_925');
    });
  });

  // -------------------------------------------------------------------------
  // HTTP integration â€” Cache-Control header + public access
  // -------------------------------------------------------------------------

  describe('GET /api/v1/catalog/rates â€” HTTP', () => {
    it('returns 200 without an auth header (public route)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/rates')
        .expect(200);
    });

    it('returns Cache-Control: public, max-age=60 header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/rates');

      expect(res.headers['cache-control']).toBe('public, max-age=60');
    });

    it('returns 503 JSON when rates are unavailable', async () => {
      (mockPricingService.getCurrentRates as Mock).mockRejectedValue(new RatesUnavailableError());

      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/rates')
        .expect(503);

      expect(res.body).toMatchObject({ code: 'rates.unavailable', stale: true });
    });
  });
});

2026-04-24T16:55:49.708946Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/src -Filter app.module.ts | ForEach-Object { Get-Content $_.FullName }'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/src -Filter *.module.ts | Select-Object -ExpandProperty FullName' in C:\Alok\Business Projects\Goldsmith
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/src -Filter app.module.ts | ForEach-Object { Get-Content $_.FullName }' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Recurse apps/api/src -Filter app.module.ts | ForEach-Object { Get-Content $_.FullName }'` rejected: blocked by policy
 succeeded in 350ms:
C:\Alok\Business Projects\Goldsmith\apps\api\src\app.module.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\auth\auth.module.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\catalog\catalog.module.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\inventory\inventory.module.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\pricing\pricing.module.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\settings\settings.module.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\tenant-boot\tenant-boot.module.ts
C:\Alok\Business Projects\Goldsmith\apps\api\src\modules\tenant-lookup\tenant-lookup.module.ts

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content apps/api/src/app.module.ts' in C:\Alok\Business Projects\Goldsmith
 succeeded in 295ms:
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
import { InventoryModule } from './modules/inventory/inventory.module';
import { CatalogModule } from './modules/catalog/catalog.module';
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
          lazyConnect: true,
          enableReadyCheck: false,
        };
      })(),
    }),
    AuthModule,
    TenantBootModule,
    TenantLookupModule,
    SettingsModule,
    InventoryModule,
    PricingModule,
    CatalogModule,
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
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content packages/ui-mobile/src/primitives/Skeleton.tsx' in C:\Alok\Business Projects\Goldsmith
 succeeded in 277ms:
import React from 'react';
import { View } from 'react-native';
import { colors, radii } from '@goldsmith/ui-tokens';

export interface SkeletonProps {
  height?: number;
  width?: number;
  testID?: string;
}

export function Skeleton({ height = 16, width = 120, testID }: SkeletonProps): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityRole="none"
      style={{
        height,
        width,
        borderRadius: radii.sm,
        backgroundColor: colors.border,
        opacity: 0.6,
      }}
    />
  );
}

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"CatalogController|CatalogModule|createTestingModule\\(\\{[\\s\\S]*CatalogController|controllers:\\s*\\[CatalogController\\]\" -S apps packages" in C:\Alok\Business Projects\Goldsmith
 succeeded in 302ms:
apps\api\src\app.module.ts:19:import { CatalogModule } from './modules/catalog/catalog.module';
apps\api\src\app.module.ts:59:    CatalogModule,
apps\api\src\modules\catalog\catalog.module.ts:3:import { CatalogController } from './catalog.controller';
apps\api\src\modules\catalog\catalog.module.ts:7:  controllers: [CatalogController],
apps\api\src\modules\catalog\catalog.module.ts:9:export class CatalogModule {}
apps\api\src\modules\catalog\catalog.controller.ts:44:export class CatalogController {
apps\api\src\modules\catalog\catalog.controller.spec.ts:2: * Story 4.4 — CatalogController unit + HTTP integration tests
apps\api\src\modules\catalog\catalog.controller.spec.ts:12:import { CatalogController } from './catalog.controller';
apps\api\src\modules\catalog\catalog.controller.spec.ts:41:describe('CatalogController', () => {
apps\api\src\modules\catalog\catalog.controller.spec.ts:42:  let controller: CatalogController;
apps\api\src\modules\catalog\catalog.controller.spec.ts:47:      controllers: [CatalogController],
apps\api\src\modules\catalog\catalog.controller.spec.ts:51:    controller = module.get<CatalogController>(CatalogController);

2026-04-24T16:56:28.239434Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm vitest apps/api/src/modules/catalog/catalog.controller.spec.ts --run'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm vitest apps/api/src/modules/catalog/catalog.controller.spec.ts --run' in C:\Alok\Business Projects\Goldsmith
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'pnpm vitest apps/api/src/modules/catalog/catalog.controller.spec.ts --run'` rejected: blocked by policy
codex
The changes appear consistent with the existing modules and tests: the new public rates endpoint wires into PricingService correctly, the catalog module now imports the needed provider, and the UI/mobile export and test-mock updates do not reveal any discrete regressions from the diff alone.
The changes appear consistent with the existing modules and tests: the new public rates endpoint wires into PricingService correctly, the catalog module now imports the needed provider, and the UI/mobile export and test-mock updates do not reveal any discrete regressions from the diff alone.
