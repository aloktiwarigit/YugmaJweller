# WS-2A: Shopkeeper Nav Reachability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all unreachable shopkeeper features (CRM, custom-orders, try-at-home, rate-lock, inventory sub-routes) into navigation via a new "अधिक" (More) tab and an inventory quick-actions bar, plus add a flag-gated KPI card on the home screen.

**Architecture:** Add a 6th "अधिक" tab to the existing Expo Router tabs layout. The More screen is a static menu list — no data fetching, just `router.push()` calls. Inventory sub-routes are exposed via a horizontal `ScrollView` pill bar inserted into the existing inventory index screen. Rate-lock gets three new route-wrapper files under `app/rate-lock/`. The dashboard KPI card is a separate `DashboardKpiCard` component rendered only when `EXPO_PUBLIC_DASHBOARD_KPIS=1` AND role is not `shop_staff`.

**Tech Stack:** React Native (Expo SDK 50), Expo Router v3, TanStack Query v5, `@goldsmith/ui-tokens`, `@expo/vector-icons` (Ionicons), vitest + @testing-library/react

---

## File Map

| File | Change |
|---|---|
| `apps/shopkeeper/app/(tabs)/_layout.tsx` | Modify — add `more` tab at position 5; move `settings` to position 6 |
| `apps/shopkeeper/app/(tabs)/more.tsx` | **Create** — More menu screen with 4 feature rows |
| `apps/shopkeeper/app/(tabs)/index.tsx` | Modify — add flag-gated `DashboardKpiCard` after hero |
| `apps/shopkeeper/src/components/DashboardKpiCard.tsx` | **Create** — KPI card fetching daily-summary |
| `apps/shopkeeper/app/inventory/index.tsx` | Modify — add horizontal quick-actions pill bar |
| `apps/shopkeeper/app/rate-lock/_layout.tsx` | **Create** — Stack navigator |
| `apps/shopkeeper/app/rate-lock/index.tsx` | **Create** — shopkeeper rate-lock bookings list |
| `apps/shopkeeper/app/rate-lock/[id].tsx` | **Create** — wrapper for `RateLockDetailScreen` |
| `apps/shopkeeper/test/more-screen.test.tsx` | **Create** — smoke tests for More screen |
| `apps/shopkeeper/test/inventory-quick-actions.test.tsx` | **Create** — smoke tests for pill bar |

---

## Task 1: Tab layout + More screen

**Files:**
- Modify: `apps/shopkeeper/app/(tabs)/_layout.tsx`
- Create: `apps/shopkeeper/app/(tabs)/more.tsx`
- Create: `apps/shopkeeper/test/more-screen.test.tsx`

- [ ] **Step 1: Write failing test for More screen**

Create `apps/shopkeeper/test/more-screen.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useAuthStore } from '../src/stores/authStore';

// expo-router is aliased to test/expo-router.mock.ts by vitest.config.ts — no vi.mock needed.
// TanStack Query is not used by more.tsx — no QueryClient wrapper needed.

import MoreScreen from '../app/(tabs)/more';

beforeEach(() => {
  useAuthStore.setState({
    firebaseUser: null,
    user: { id: 'u1', shopId: 's1', role: 'shop_admin', displayName: 'Owner' },
    idToken: null,
    loading: false,
  });
});

describe('(tabs)/more.tsx', () => {
  it('renders 4 menu rows for owner role', () => {
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('ग्राहक सूची');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('ट्राई-एट-होम');
    expect(container.textContent).toContain('दर-लॉक बुकिंग');
  });

  it('hides दर-लॉक बुकिंग for staff role', () => {
    useAuthStore.setState({
      firebaseUser: null,
      user: { id: 'u2', shopId: 's1', role: 'shop_staff', displayName: 'Staff' },
      idToken: null,
      loading: false,
    });
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('ग्राहक सूची');
    expect(container.textContent).not.toContain('दर-लॉक बुकिंग');
  });

  it('renders all three non-rate-lock rows for staff', () => {
    useAuthStore.setState({
      firebaseUser: null,
      user: { id: 'u2', shopId: 's1', role: 'shop_staff', displayName: 'Staff' },
      idToken: null,
      loading: false,
    });
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('ट्राई-एट-होम');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @goldsmith/shopkeeper test test/more-screen.test.tsx
```
Expected: FAIL — `Cannot find module '../app/(tabs)/more'`

- [ ] **Step 3: Create `app/(tabs)/more.tsx`**

Create `apps/shopkeeper/app/(tabs)/more.tsx`:

```tsx
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useAuthStore } from '../../src/stores/authStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuRow {
  label:    string;
  icon:     IoniconName;
  href:     string;
  ownerOnly: boolean;
}

const ROWS: MenuRow[] = [
  { label: 'ग्राहक सूची',      icon: 'people-outline',       href: '/customers',     ownerOnly: false },
  { label: 'कस्टम ऑर्डर',      icon: 'construct-outline',    href: '/custom-orders', ownerOnly: false },
  { label: 'ट्राई-एट-होम',     icon: 'home-outline',         href: '/try-at-home',   ownerOnly: false },
  { label: 'दर-लॉक बुकिंग',    icon: 'lock-closed-outline',  href: '/rate-lock',     ownerOnly: true  },
];

export default function MoreScreen(): React.ReactElement {
  const role     = useAuthStore((s) => s.user?.role);
  const isStaff  = role === 'shop_staff';
  const visibleRows = ROWS.filter((r) => !r.ownerOnly || !isStaff);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>दैनिक संचालन</Text>
      </View>
      {visibleRows.map((row) => (
        <Pressable
          key={row.href}
          testID={`more-row-${row.href.replace('/', '')}`}
          onPress={() => router.push(row.href as never)}
          style={styles.row}
        >
          <View style={styles.rowLeft}>
            <Ionicons name={row.icon} size={24} color={colors.primary} />
            <Text style={styles.rowLabel}>{row.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.inkMute} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.body.family,
    fontSize:   13,
    color:      colors.inkMute,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    minHeight:        64,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor:   colors.white,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  rowLabel: {
    fontFamily: typography.body.family,
    fontSize:   18,
    color:      colors.ink,
    marginLeft: spacing.md,
  },
});
```

Note: `@expo/vector-icons` is not in the react-native mock. Add a mock for it in the test file by adding this before the import:

```tsx
vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement('icon', { 'data-icon': name, 'data-testid': testID }),
}));
```

Add this mock to `more-screen.test.tsx` before the `MoreScreen` import.

- [ ] **Step 4: Update `app/(tabs)/_layout.tsx` — add More tab, move Settings**

In `apps/shopkeeper/app/(tabs)/_layout.tsx`, insert a new `<Tabs.Screen>` for `more` between `reports` and `settings`, and ensure `settings` is last:

```tsx
      <Tabs.Screen
        name="reports"
        options={{
          title: 'रिपोर्ट',
          href: isStaff ? null : undefined,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="bar-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'अधिक',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'सेटिंग्स',
          href: isStaff ? null : undefined,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
```

The full `_layout.tsx` after edit:

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { colors } from '@goldsmith/ui-tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  color,
  size,
}: {
  name: IoniconName;
  color: string;
  size: number;
}): React.ReactElement {
  return <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout(): JSX.Element {
  const role = useAuthStore((s) => s.user?.role);
  const isStaff = role === 'shop_staff';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMute,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'होम',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'इन्वेंटरी',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="cube-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'बिलिंग',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'रिपोर्ट',
          href: isStaff ? null : undefined,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="bar-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'अधिक',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'सेटिंग्स',
          href: isStaff ? null : undefined,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @goldsmith/shopkeeper test test/more-screen.test.tsx
```
Expected: PASS — 3 tests

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/shopkeeper/app/\(tabs\)/_layout.tsx \
        apps/shopkeeper/app/\(tabs\)/more.tsx \
        apps/shopkeeper/test/more-screen.test.tsx
git commit -m "feat(ws-2a): add More tab with CRM/custom-orders/try-at-home/rate-lock nav"
```

---

## Task 2: Inventory quick-actions bar

**Files:**
- Modify: `apps/shopkeeper/app/inventory/index.tsx`
- Create: `apps/shopkeeper/test/inventory-quick-actions.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/shopkeeper/test/inventory-quick-actions.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('../src/hooks/usePublicRates', () => ({
  usePublicRates: () => ({ data: null, isLoading: false }),
}));

vi.mock('../src/features/inventory/components/InventorySearch', () => ({
  InventorySearch: () => null,
}));

vi.mock('@goldsmith/ui-mobile', () => ({
  RateWidget: () => null,
  Skeleton:   () => null,
  Toast:      () => null,
  Button:     () => null,
}));

import InventoryScreen from '../app/inventory/index';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('app/inventory/index.tsx quick-actions bar', () => {
  it('renders all 5 quick-action pill labels', () => {
    const { container } = render(<InventoryScreen />, { wrapper });
    expect(container.textContent).toContain('+ नया उत्पाद');
    expect(container.textContent).toContain('CSV आयात');
    expect(container.textContent).toContain('मूल्यांकन');
    expect(container.textContent).toContain('डेड स्टॉक');
    expect(container.textContent).toContain('लेबल प्रिंट');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @goldsmith/shopkeeper test test/inventory-quick-actions.test.tsx
```
Expected: FAIL — quick-action labels not in output yet

- [ ] **Step 3: Add the quick-actions bar to `app/inventory/index.tsx`**

The current file already imports `router` from `expo-router` and `api` from `../../src/api/client`. Read the current file first, then add the quick-actions bar between `rateHeader` and `searchContainer`.

The current file structure:
```
View (screen)
  View (rateHeader) — RateWidget
  View (searchContainer) — InventorySearch
```

Add a horizontal `ScrollView` between them. Full updated file:

```tsx
import React from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { RateWidget } from '@goldsmith/ui-mobile';
import { colors, spacing, radii, typography } from '@goldsmith/ui-tokens';
import { usePublicRates } from '../../src/hooks/usePublicRates';
import { InventorySearch } from '../../src/features/inventory/components/InventorySearch';

interface QuickAction {
  label: string;
  href:  string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: '+ नया उत्पाद', href: '/inventory/new'         },
  { label: 'CSV आयात',     href: '/inventory/bulk-import'  },
  { label: 'मूल्यांकन',    href: '/inventory/valuation'    },
  { label: 'डेड स्टॉक',   href: '/inventory/dead-stock'   },
  { label: 'लेबल प्रिंट',  href: '/inventory/print-labels' },
];

export default function InventoryListScreen(): React.ReactElement {
  const { data: rates, isLoading } = usePublicRates();

  return (
    <View style={styles.screen}>
      {/* Live rate compact header */}
      <View style={styles.rateHeader}>
        <RateWidget
          variant="compact"
          rates={rates ?? null}
          loading={isLoading}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/rates/history' as any)}
        />
      </View>

      {/* Quick-actions pill bar */}
      <View style={styles.quickActionsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsContent}
        >
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.href}
              testID={`quick-action-${action.href.split('/').pop()}`}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push(action.href as any)}
              style={styles.pill}
            >
              <Text style={styles.pillLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Inventory search + results */}
      <View style={styles.searchContainer}>
        <InventorySearch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onProductPress={(productId) => router.push(`/inventory/${productId}/edit` as any)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  rateHeader: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  quickActionsWrapper: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  quickActionsContent: {
    paddingHorizontal: spacing.md,
  },
  pill: {
    minHeight:         44,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radii.pill,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
    marginRight:       spacing.sm,
    justifyContent:    'center',
  },
  pillLabel: {
    fontFamily: typography.body.family,
    fontSize:   14,
    color:      colors.ink,
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.md,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/shopkeeper test test/inventory-quick-actions.test.tsx
```
Expected: PASS — 1 test

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/shopkeeper/app/inventory/index.tsx \
        apps/shopkeeper/test/inventory-quick-actions.test.tsx
git commit -m "feat(ws-2a): add inventory quick-actions pill bar"
```

---

## Task 3: Rate-lock route files

**Files:**
- Create: `apps/shopkeeper/app/rate-lock/_layout.tsx`
- Create: `apps/shopkeeper/app/rate-lock/index.tsx`
- Create: `apps/shopkeeper/app/rate-lock/[id].tsx`

No tests needed — these are thin route wrappers. Typecheck is the quality gate.

- [ ] **Step 1: Create `app/rate-lock/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function RateLockLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle:    { backgroundColor: '#F5EDDD' },
        headerTintColor: '#5C3D11',
      }}
    />
  );
}
```

- [ ] **Step 2: Create `app/rate-lock/index.tsx`**

`RateLockListScreen` requires a `customerId` prop and won't fetch when it is empty. This route shows ALL rate-lock bookings for the shop (no customer filter). Write a simple inline screen:

```tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';

interface RateLockBooking {
  id:                        string;
  customerId:                string;
  lockedRate24kPaisePerGram: string;
  lockedAt:                  string;
  expiresAt:                 string;
  depositAmountPaise:        string;
  status:                    string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'भुगतान लंबित',
  ACTIVE:          'सक्रिय',
  USED:            'उपयोग किया',
  EXPIRED:         'समाप्त',
  CANCELLED:       'रद्द',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#D97706',
  ACTIVE:          '#059669',
  USED:            '#6B7280',
  EXPIRED:         '#DC2626',
  CANCELLED:       '#9CA3AF',
};

function formatRate(paisePerGram: string): string {
  return `₹${Math.round(Number(paisePerGram) / 100).toLocaleString('en-IN')}/g`;
}

export default function RateLockIndexScreen(): React.ReactElement {
  const { data: bookings = [], isLoading, isError, refetch } = useQuery<RateLockBooking[]>({
    queryKey:  ['rate-lock-bookings-shop'],
    queryFn:   () => api.get<RateLockBooking[]>('/api/v1/rate-lock/bookings').then((r) => r.data),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>जानकारी लोड नहीं हो सकी।</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryBtnText}>पुनः प्रयास</Text>
        </Pressable>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>कोई दर-लॉक बुकिंग नहीं है।</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {bookings.map((b) => (
        <Pressable
          key={b.id}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push(`/rate-lock/${b.id}` as any)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[b.status] ?? '#6B7280' }]}>
              <Text style={styles.statusChipText}>{STATUS_LABELS[b.status] ?? b.status}</Text>
            </View>
            <Text style={styles.rateText}>{formatRate(b.lockedRate24kPaisePerGram)}</Text>
          </View>
          <Text style={styles.depositText}>
            जमा: ₹{Math.round(Number(b.depositAmountPaise) / 100).toLocaleString('en-IN')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: colors.bg },
  content:         { padding: spacing.md },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText:       { fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm, fontSize: 16 },
  emptyText:       { fontFamily: typography.body.family, color: colors.inkMute, fontSize: 16 },
  retryBtn:        { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  retryBtnText:    { fontFamily: typography.body.family, color: colors.ink, fontSize: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    minHeight:       72,
  },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  statusChip:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  statusChipText:  { fontFamily: typography.body.family, color: colors.white, fontSize: 12 },
  rateText:        { fontFamily: typography.display.family, fontSize: 16, color: colors.ink },
  depositText:     { fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute },
});
```

- [ ] **Step 3: Create `app/rate-lock/[id].tsx`**

`RateLockDetailScreen` is a named export that takes `bookingId` and `onCreateInvoice`. Extract `id` from route params.

First add `useLocalSearchParams` export to `apps/shopkeeper/test/expo-router.mock.ts` (needed for typecheck to work with Expo Router types — the mock file does not need to be changed for runtime correctness but having the export prevents import errors in tests that import this route):

Check whether `useLocalSearchParams` is already exported from the mock. If not, the route file must NOT be imported in tests (it's tested only via typecheck). The file uses `expo-router` directly which is handled by the production Expo bundler, not the test mock.

Create `apps/shopkeeper/app/rate-lock/[id].tsx`:

```tsx
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { router } from 'expo-router';
import { RateLockDetailScreen } from '../../src/features/rate-lock/RateLockDetailScreen';

export default function RateLockDetailRoute(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <RateLockDetailScreen
      bookingId={id ?? ''}
      onCreateInvoice={(customerId) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(`/billing?customerId=${customerId}` as any)
      }
    />
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```
Expected: 0 errors. If `useLocalSearchParams` causes a type error because it's missing from the expo-router mock, add `export function useLocalSearchParams<T extends Record<string, string>>(): T { return {} as T; }` to `apps/shopkeeper/test/expo-router.mock.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/shopkeeper/app/rate-lock/
git commit -m "feat(ws-2a): add rate-lock route files (index + detail + layout)"
```

---

## Task 4: DashboardKpiCard + home screen flag gate

**Files:**
- Create: `apps/shopkeeper/src/components/DashboardKpiCard.tsx`
- Modify: `apps/shopkeeper/app/(tabs)/index.tsx`

- [ ] **Step 1: Write failing test for DashboardKpiCard**

Add to a new test file `apps/shopkeeper/test/dashboard-kpi-card.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@goldsmith/ui-mobile', () => ({
  Skeleton: ({ testID }: { testID?: string }) =>
    React.createElement('skeleton', { 'data-testid': testID }),
  Button:   () => null,
  Toast:    () => null,
  RateWidget: () => null,
}));

import { api } from '../src/api/client';
import { DashboardKpiCard } from '../src/components/DashboardKpiCard';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('DashboardKpiCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders total_paise and invoice_count on success', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        date:          '2026-05-05',
        total_paise:   '250000',
        cash_paise:    '100000',
        invoice_count: 3,
      },
    });

    const { container } = render(<DashboardKpiCard />, { wrapper });
    await waitFor(() => {
      expect(container.textContent).toContain('₹2,500');
    });
    expect(container.textContent).toContain('3');
  });

  it('renders nothing on API error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('server error'));

    const { container } = render(<DashboardKpiCard />, { wrapper });
    await waitFor(() => {
      // Loading skeleton resolves to nothing on error
      expect(container.textContent?.trim()).toBe('');
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @goldsmith/shopkeeper test test/dashboard-kpi-card.test.tsx
```
Expected: FAIL — `Cannot find module '../src/components/DashboardKpiCard'`

- [ ] **Step 3: Create `src/components/DashboardKpiCard.tsx`**

Create `apps/shopkeeper/src/components/DashboardKpiCard.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@goldsmith/ui-mobile';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { api } from '../api/client';

interface DailySummary {
  date:          string;
  total_paise:   string;
  cash_paise:    string;
  invoice_count: number;
}

export function DashboardKpiCard(): React.ReactElement | null {
  const { data, isLoading, isError } = useQuery<DailySummary>({
    queryKey:  ['reports', 'daily-summary', 'today'],
    queryFn:   () => api.get<DailySummary>('/api/v1/reports/daily-summary').then((r) => r.data),
    staleTime: 60_000,
  });

  // Render nothing on error — KPI is informational
  if (isError) return null;

  const totalRupees = data
    ? Math.round(Number(data.total_paise) / 100).toLocaleString('en-IN')
    : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>आज का सारांश</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>बिक्री</Text>
          {isLoading || totalRupees === null ? (
            <Skeleton height={24} width={80} testID="kpi-sales-skeleton" />
          ) : (
            <Text style={styles.statValue} testID="kpi-sales-value">₹{totalRupees}</Text>
          )}
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>बिल</Text>
          {isLoading || data === undefined ? (
            <Skeleton height={24} width={40} testID="kpi-invoices-skeleton" />
          ) : (
            <Text style={styles.statValue} testID="kpi-invoices-value">{data.invoice_count}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginTop:       spacing.md,
  },
  title: {
    fontFamily:    typography.body.family,
    fontSize:      13,
    color:         colors.inkMute,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  stat: {
    marginRight: spacing.xl,
  },
  statLabel: {
    fontFamily: typography.body.family,
    fontSize:   14,
    color:      colors.inkMute,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: typography.display.family,
    fontSize:   22,
    color:      colors.ink,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @goldsmith/shopkeeper test test/dashboard-kpi-card.test.tsx
```
Expected: PASS — 2 tests

- [ ] **Step 5: Add flag-gated KpiCard to `app/(tabs)/index.tsx`**

Read the current `app/(tabs)/index.tsx`. It ends with the stub toast block. Add the import and the flag-gated card after the hero `<View>` and before the stub toast.

At the top of the file, add two imports:

```ts
import { useAuthStore } from '../../src/stores/authStore';
import { DashboardKpiCard } from '../../src/components/DashboardKpiCard';
```

Inside `DashboardScreen`, add role check after `const loading`:

```ts
const role = useAuthStore((s) => s.user?.role);
const showKpis = process.env['EXPO_PUBLIC_DASHBOARD_KPIS'] === '1' && role !== 'shop_staff';
```

After the closing `</View>` of the hero section (the one that contains eyebrow + headline + subcopy + buttons), add:

```tsx
{showKpis && <DashboardKpiCard />}
```

The hero section is inside the `!isLoading` branch — place the KPI card immediately after the outer hero `<View>`:

```tsx
      {isLoading ? (
        <View>
          {/* existing skeleton rows... */}
        </View>
      ) : (
        <View>
          {/* existing eyebrow, headline, subcopy, buttons... */}
        </View>
      )}

      {/* Flag-gated KPI card — only for admin/manager when flag is on */}
      {showKpis && <DashboardKpiCard />}
```

Wrap `DashboardKpiCard` with a `QueryClientProvider` only if one isn't already provided higher up. Check `app/_layout.tsx` to confirm whether `QueryClientProvider` wraps the whole app. If it does, no wrapper needed here.

- [ ] **Step 6: Verify dashboard test still passes**

```bash
pnpm --filter @goldsmith/shopkeeper test test/dashboard.screen.test.tsx test/dashboard-kpi-card.test.tsx
```
Expected: PASS — existing 3 dashboard tests + 2 new KPI card tests

- [ ] **Step 7: Full test suite**

```bash
pnpm --filter @goldsmith/shopkeeper test
```
Expected: all tests pass

- [ ] **Step 8: Final typecheck**

```bash
pnpm --filter @goldsmith/shopkeeper typecheck
```
Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add apps/shopkeeper/src/components/DashboardKpiCard.tsx \
        apps/shopkeeper/app/\(tabs\)/index.tsx \
        apps/shopkeeper/test/dashboard-kpi-card.test.tsx
git commit -m "feat(ws-2a): add flag-gated DashboardKpiCard to home screen"
```

---

## Self-Review

**Spec coverage:**
- ✅ Add "अधिक" tab at position 5 — Task 1
- ✅ Settings moves to position 6 — Task 1
- ✅ More screen: 4 rows with 64dp min-height — Task 1
- ✅ Rate-lock row hidden for staff — Task 1
- ✅ Inventory quick-actions bar (5 pills, 44dp min-height) — Task 2
- ✅ Rate-lock `_layout.tsx`, `index.tsx`, `[id].tsx` — Task 3
- ✅ DashboardKpiCard (EXPO_PUBLIC_DASHBOARD_KPIS + role guard) — Task 4
- ✅ Tests: More screen (3), inventory (1), KPI card (2) — Tasks 1/2/4
- ✅ Typecheck at every commit

**Placeholder scan:** None. All code blocks are complete.

**Type consistency:**
- `DashboardKpiCard` is a named export (`export function DashboardKpiCard`), imported with `{ DashboardKpiCard }` in `index.tsx` — consistent.
- `RateLockDetailScreen` is a named export, used as `<RateLockDetailScreen bookingId={id ?? ''} ...>` — consistent with its Props interface.
- `DailySummary.invoice_count` is `number` in the interface and the test mock sends `3` (number) — consistent.

**Note on QueryClientProvider:** Before implementing Task 4 Step 5, verify whether `app/_layout.tsx` already wraps the app in a `QueryClientProvider`. If so, no wrapper is needed for `DashboardKpiCard` usage in `index.tsx`. If not, wrap `DashboardKpiCard` render in a local provider or add to `_layout.tsx`.
