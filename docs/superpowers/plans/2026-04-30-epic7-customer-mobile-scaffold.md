---
story: EPIC7-S0 — Customer Mobile Scaffold + Dev Auth
class: B
date: 2026-04-30
pre-flight-done: false
---

# EPIC7-S0: Customer Mobile Scaffold + Dev-Mode Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a brand-new white-label customer-facing Expo app at `apps/customer-mobile/` with tenant theme resolution, tab navigation, the Home and Profile screens stubbed against existing public APIs, and a **dev-mode mock customer session** that unblocks UI work without coupling to real customer phone OTP (which is reclassified to a separate Class A story).

**Architecture:** Sibling Expo SDK 51 app inside the existing pnpm + Turborepo workspace. Shares `@goldsmith/ui-tokens`, `@goldsmith/ui-mobile`, `@goldsmith/i18n`, `@goldsmith/auth-client`, `@goldsmith/shared` with `apps/shopkeeper`. White-label config resolved at boot via `GET /api/v1/tenant/boot?slug=$EXPO_PUBLIC_SHOP_SLUG` (the same endpoint shopkeeper uses) and stored in a Zustand `tenantStore`. Dev-mode auth (`EXPO_PUBLIC_DEV_AUTH=1`) injects a mock customer session into `customerSessionStore`, persists the bearer to `expo-secure-store` (NOT AsyncStorage), and lights up Home + Profile against existing public catalog endpoints. Without dev mode, the welcome screen shows a "Phone OTP coming soon" placeholder — real OTP lands in the follow-up Class A story.

**Tech Stack:** Expo SDK 51, expo-router 3.5, NativeWind 4 (Tailwind for RN), Zustand 4.5, TanStack Query 5, axios 1.7, expo-secure-store 13, expo-font 12, vitest 1.6, react-native-firebase 21 (only the package wiring; no actual Firebase calls in this story since auth is dev-mode-mocked).

**Font note:** The prompt asks for *Noto Sans Devanagari*; CLAUDE.md lists Noto as primary with Mukta as fallback. Mukta (`MuktaVaani-400/500/600/700`) ships in this repo and is wired into `@goldsmith/ui-tokens` and `apps/shopkeeper`. Noto Sans Devanagari is **not** in the repo. To preserve consistency with the shopkeeper app and avoid sneaking new font binaries in via this scaffold story, this plan reuses the existing Mukta family (which is the documented fallback). A separate ticket should add Noto Sans Devanagari, swap `typography.body.family`, and re-run the visual diff against both apps. **Inter is NOT used anywhere — that constraint is fully respected.**

## Resume Point (checkpoint 2026-04-30 20:30 ET)

This plan is **partially executed**. WS-A and WS-B are landed and reviewed; WS-C, WS-D, WS-E remain.

- **Branch tip:** `0150b29` (15 commits ahead of `main`)
- **Verification baseline:** typecheck 0, lint 0, **18/18** unit tests pass
- **Worktree:** `C:/gs-cust-mob` on `feat/epic7-customer-mobile-scaffold`
- **Test infra additions** (not in original plan but required to make tests run):
  - `apps/customer-mobile/test/react-native.mock.ts` — passthrough mock for RN components in jsdom (mirrors shopkeeper)
  - `apps/customer-mobile/vitest.config.ts` — `react-native` alias + esbuild tsconfig override
  - `apps/customer-mobile/.eslintrc.cjs` — CJS-config + test-mock + provider/api overrides (mirrors shopkeeper)
  - `apps/customer-mobile/test/setup.ts` — added `@react-native-async-storage/async-storage` mock (defensive)
- **Code-review fixes already applied** (do not re-do):
  - `TenantProvider` 304 path guarded; AsyncStorage tenant cache deliberately deferred (TODO comment in file)
  - `customerSelfDelete` uses `axios.isAxiosError` type guard
  - `TenantBrandHeader` logo placeholder marked `accessible={false}`
  - tsconfig extends `expo/tsconfig.base`; `@types/node` pinned to `^20.11.0`
- **Customer-session store shape is FINAL** — `setSession(c, b)` + `clear()`. WS-C only adds tests, never changes shape.

Resume by reading this plan, then dispatch the WS-C implementer subagent. WS-E will write a story-complete memory entry.

---

**Out of scope (deferred to follow-up Class A story `EPIC7-S1 — Customer Phone OTP`):**
- Real customer phone OTP via Firebase
- Migration adding `customers.firebase_uid`
- Extending `auth.service.ts` to handle the customer code path
- Implementing `DELETE /customer/me` (currently a 501 stub at `crm.controller.ts:190`)
- Push notifications (`customer_device_tokens` table, migration 0048 — was pre-assigned but not used by this story)

---

## Pre-Flight Checklist (run before WS-A first commit)

```bash
# Already done by setup: worktree at C:/gs-cust-mob on feat/epic7-customer-mobile-scaffold
cd /c/gs-cust-mob && pnpm install     # ~3 min cold
pnpm --filter @goldsmith/ui-tokens build
pnpm --filter @goldsmith/i18n build
pnpm --filter @goldsmith/auth-client build
pnpm --filter @goldsmith/shared build
pnpm --filter @goldsmith/ui-mobile build
```

Expected: all five package builds exit 0 with no diagnostics. If any fail, stop and surface — the customer app cannot be scaffolded against broken shared packages.

Manual trace (fill in before coding):
- **Tenant slug source:** `process.env.EXPO_PUBLIC_SHOP_SLUG` → `app.config.ts.extra.tenantSlug` → `Constants.expoConfig.extra.tenantSlug` → `TenantProvider` boot fetch. **Default for dev:** `anchor-dev`.
- **Bearer storage:** `expo-secure-store` under key `customer_session_v1`. NEVER `AsyncStorage`. Tested in WS-C unit test.
- **Tenant header:** axios interceptor reads `tenantStore.tenant.id`, sets `x-tenant-id`. Catalog rates endpoint is `@SkipTenant()` so this header is informational, but the recordView endpoint reads it.
- **Goldsmith brand leakage check:** No string `"Goldsmith"` (uppercase G) in any user-visible string. Internal type names (`@goldsmith/ui-tokens`) are fine — npm scope is invisible to end users.

---

## File Structure

```
apps/customer-mobile/
├── app.config.ts                       # Expo config, slug=goldsmith-customer (internal), name from tenant
├── babel.config.js                     # babel-preset-expo + nativewind/babel
├── metro.config.js                     # monorepo-aware (mirrors shopkeeper)
├── tailwind.config.js                  # NativeWind content globs + theme tokens
├── tsconfig.json                       # extends ../../tsconfig.base.json
├── vitest.config.ts                    # jsdom env for component tests
├── global.css                          # NativeWind directives
├── expo-env.d.ts                       # NativeWind types
├── .eslintrc.cjs                       # extends root
├── package.json                        # @goldsmith/customer-mobile, workspace deps
├── README.md                           # 60-line orientation
├── assets/
│   ├── brand/
│   │   └── README.md                   # placeholder; tenant logos load from CDN at runtime
│   └── fonts/                          # copied from apps/shopkeeper/assets/fonts
│       ├── YatraOne-Regular.ttf
│       ├── MuktaVaani-400.ttf
│       ├── MuktaVaani-500.ttf
│       ├── MuktaVaani-600.ttf
│       ├── MuktaVaani-700.ttf
│       ├── TiroDevanagariHindi-Regular.ttf
│       ├── TiroDevanagariHindi-Italic.ttf
│       └── Fraunces-VariableItalic.ttf
├── app/
│   ├── _layout.tsx                     # root: providers, fonts, splash, route guard
│   ├── index.tsx                       # auth-state redirect (auth or tabs)
│   ├── (auth)/
│   │   ├── _layout.tsx                 # auth stack (no tab bar)
│   │   └── welcome.tsx                 # phone-OTP placeholder + dev-bypass button
│   └── (tabs)/
│       ├── _layout.tsx                 # bottom tab navigator (Home/Browse/Wishlist/Profile)
│       ├── index.tsx                   # Home: rate card + product grid + categories
│       ├── browse.tsx                  # "जल्द आ रहा है" placeholder
│       ├── wishlist.tsx                # "जल्द आ रहा है" placeholder
│       └── profile.tsx                 # name + phone + loyalty stub + DPDPA button
├── src/
│   ├── api/
│   │   ├── client.ts                   # axios instance, bearer interceptor, x-tenant-id
│   │   └── endpoints.ts                # catalog/rates, catalog/products, customer/me delete
│   ├── providers/
│   │   ├── CustomerAuthProvider.tsx    # dev-mode session injector
│   │   └── TenantProvider.tsx          # boot tenant via /tenant/boot, ETag caching
│   ├── stores/
│   │   ├── customerSessionStore.ts     # Zustand: customer + bearer
│   │   └── tenantStore.ts              # Zustand: tenant + ETag
│   ├── hooks/
│   │   ├── useCustomerSession.ts       # selector hook (mirrors shopkeeper's useAuthStore pattern)
│   │   └── usePublicRates.ts           # TanStack Query: GET /catalog/rates
│   ├── components/
│   │   ├── TenantBrandHeader.tsx       # tenant logo + name
│   │   ├── RateCard.tsx                # gold rate display
│   │   ├── ProductCard.tsx             # 2-col grid item
│   │   ├── ProductGrid.tsx             # 2-col grid container
│   │   ├── CategoryRow.tsx             # horizontal scroll
│   │   ├── LoyaltyPointsCard.tsx       # placeholder card
│   │   └── ComingSoon.tsx              # reusable "जल्द आ रहा है"
│   └── lib/
│       ├── secure-storage.ts           # expo-secure-store wrapper (typed)
│       └── tenant-theme.ts             # tenant-config → theme tokens resolver
└── test/
    ├── setup.ts                        # vitest globals; mocks for SecureStore + Constants
    └── factories.ts                    # tenant + customer fixtures
```

`apps/shopkeeper/` is **not** modified by this plan.
`packages/*` are **not** modified by this plan.
No SQL migrations.

---

## Work Streams

### WS-A: Expo App Shell + Turborepo Wiring

**Packages:** `apps/customer-mobile/`
**Parallel with:** nothing — runs first
**Done when:** `pnpm --filter @goldsmith/customer-mobile typecheck` exits 0; `pnpm --filter @goldsmith/customer-mobile expo export --platform web --output-dir dist` produces a `dist/index.html`.

#### Task A1: Create `package.json`

**Files:**
- Create: `apps/customer-mobile/package.json`

- [ ] **Step 1: Write the file**

```json
{
  "name": "@goldsmith/customer-mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo start --dev-client --android",
    "ios": "expo start --dev-client --ios",
    "export": "expo export --platform web --output-dir dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@expo/metro-runtime": "~3.2.3",
    "@expo/vector-icons": "~14.0.0",
    "@goldsmith/auth-client": "workspace:*",
    "@goldsmith/i18n": "workspace:*",
    "@goldsmith/shared": "workspace:*",
    "@goldsmith/ui-mobile": "workspace:*",
    "@goldsmith/ui-tokens": "workspace:*",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@react-native-firebase/app": "^21.0.0",
    "@react-native-firebase/auth": "^21.0.0",
    "@react-navigation/native": "^7.2.2",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.7.0",
    "expo": "~51.0.0",
    "expo-constants": "~16.0.0",
    "expo-dev-client": "~4.0.0",
    "expo-font": "~12.0.0",
    "expo-haptics": "~13.0.1",
    "expo-router": "~3.5.0",
    "expo-secure-store": "~13.0.2",
    "expo-splash-screen": "~0.27.0",
    "expo-status-bar": "~1.12.0",
    "nativewind": "^4.0.36",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-native": "0.74.0",
    "react-native-safe-area-context": "4.10.0",
    "react-native-screens": "3.31.0",
    "react-native-svg": "^15.2.0",
    "react-native-web": "~0.19.0",
    "tailwindcss": "^3.4.4",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@testing-library/react": "^14.3.1",
    "@types/react": "~18.2.79",
    "axios-mock-adapter": "^1.22.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Install at workspace root**

Run: `cd /c/gs-cust-mob && pnpm install`
Expected: pnpm resolves all deps, prints "Done in Xs"; no peer-warning failures.

- [ ] **Step 3: Commit**

```bash
git add apps/customer-mobile/package.json
git commit -m "chore(customer-mobile): scaffold package.json"
```

#### Task A2: Create `app.config.ts`, `tsconfig.json`, `babel.config.js`, `metro.config.js`

**Files:**
- Create: `apps/customer-mobile/app.config.ts`
- Create: `apps/customer-mobile/tsconfig.json`
- Create: `apps/customer-mobile/babel.config.js`
- Create: `apps/customer-mobile/metro.config.js`
- Create: `apps/customer-mobile/expo-env.d.ts`

- [ ] **Step 1: Write `app.config.ts`**

```typescript
import type { ExpoConfig } from 'expo/config';

// White-label: appName MUST come from tenant runtime config when shipping a per-tenant build.
// EXPO_PUBLIC_APP_NAME is a build-time fallback for dev/anchor builds only.
const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'अयोध्या स्वर्णकार';

const config: ExpoConfig = {
  name: appName,
  slug: 'goldsmith-customer',
  scheme: 'goldsmithcustomer',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android'],
  plugins: [
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    'expo-dev-client',
    'expo-font',
    'expo-router',
    'expo-secure-store',
  ],
  android: {
    package: 'com.goldsmith.customer.dev',
    googleServicesFile: process.env['GOOGLE_SERVICES_FILE'] ?? './google-services.json',
  },
  ios: {
    bundleIdentifier: 'com.goldsmith.customer.dev',
    googleServicesFile: process.env['GOOGLE_SERVICES_INFO_PLIST'] ?? './GoogleService-Info.plist',
    supportsTablet: false,
  },
  extra: {
    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3000',
    tenantSlug: process.env['EXPO_PUBLIC_SHOP_SLUG'] ?? 'anchor-dev',
    devAuth: process.env['EXPO_PUBLIC_DEV_AUTH'] === '1',
    firebaseProjectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'goldsmith-dev',
    router: { origin: false },
    eas: { projectId: 'TBD-post-SOW' },
  },
  experiments: { typedRoutes: true },
};

export default config;
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-native",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["nativewind/types"],
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": [
    "app/**/*",
    "src/**/*",
    "test/**/*",
    "app.config.ts",
    "expo-env.d.ts"
  ]
}
```

- [ ] **Step 3: Write `babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

- [ ] **Step 4: Write `metro.config.js`**

```javascript
// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 5: Write `expo-env.d.ts`**

```typescript
/// <reference types="nativewind/types" />
```

- [ ] **Step 6: Run typecheck**

Run: `cd /c/gs-cust-mob && pnpm --filter @goldsmith/customer-mobile typecheck`
Expected: exits 0 with no errors. (No source files yet, so this only validates config.)

- [ ] **Step 7: Commit**

```bash
git add apps/customer-mobile/app.config.ts apps/customer-mobile/tsconfig.json apps/customer-mobile/babel.config.js apps/customer-mobile/metro.config.js apps/customer-mobile/expo-env.d.ts
git commit -m "chore(customer-mobile): expo + nativewind + tsconfig wiring"
```

#### Task A3: NativeWind Tailwind config + global.css

**Files:**
- Create: `apps/customer-mobile/tailwind.config.js`
- Create: `apps/customer-mobile/global.css`
- Create: `apps/customer-mobile/.eslintrc.cjs`

- [ ] **Step 1: Write `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Direction 05 — Hindi-First Editorial palette (mirrors @goldsmith/ui-tokens)
        bg: '#F5EDDD',
        ink: '#1E2440',
        'ink-mute': '#4A526E',
        border: '#D9C9A8',
        white: '#FFFFFF',
        primary: '#B58A3C',
        accent: '#D4745A',
        error: '#B1402B',
      },
      fontFamily: {
        display: ['YatraOne'],
        body: ['MuktaVaani-400'],
        'body-medium': ['MuktaVaani-500'],
        'body-semibold': ['MuktaVaani-600'],
        'body-bold': ['MuktaVaani-700'],
        serif: ['TiroDevanagariHindi-Regular'],
        'serif-italic': ['TiroDevanagariHindi-Italic'],
        latin: ['Fraunces-Italic'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Write `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Write `.eslintrc.cjs`**

```javascript
module.exports = {
  root: false,
  extends: ['../../.eslintrc.cjs'],
  ignorePatterns: ['dist/**', 'node_modules/**', '.expo/**'],
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/customer-mobile/tailwind.config.js apps/customer-mobile/global.css apps/customer-mobile/.eslintrc.cjs
git commit -m "chore(customer-mobile): nativewind + eslint config"
```

#### Task A4: Copy Hindi fonts from shopkeeper

**Files:**
- Create: `apps/customer-mobile/assets/fonts/*` (8 .ttf files)
- Create: `apps/customer-mobile/assets/brand/README.md`

- [ ] **Step 1: Copy fonts**

Run:
```bash
mkdir -p /c/gs-cust-mob/apps/customer-mobile/assets/fonts
mkdir -p /c/gs-cust-mob/apps/customer-mobile/assets/brand
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/YatraOne-Regular.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/MuktaVaani-400.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/MuktaVaani-500.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/MuktaVaani-600.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/MuktaVaani-700.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/TiroDevanagariHindi-Regular.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/TiroDevanagariHindi-Italic.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
cp /c/gs-cust-mob/apps/shopkeeper/assets/fonts/Fraunces-VariableItalic.ttf /c/gs-cust-mob/apps/customer-mobile/assets/fonts/
```

Expected: 8 files now exist under `apps/customer-mobile/assets/fonts/`. Verify with `ls /c/gs-cust-mob/apps/customer-mobile/assets/fonts | wc -l` returning `8`.

- [ ] **Step 2: Write `assets/brand/README.md`**

```markdown
# Brand assets

Tenant-specific logos and splash artwork are NOT committed here. They load at runtime from
the per-tenant CDN URL returned by `GET /api/v1/tenant/boot?slug=<tenant>` in `branding.logoUrl`.

A future EAS build profile will inject a tenant-specific app icon + splash via the
`expo-build-properties` plugin and the `--config` flag at build time. Until then, dev
builds use the default Expo splash.
```

- [ ] **Step 3: Commit**

```bash
git add apps/customer-mobile/assets/
git commit -m "chore(customer-mobile): copy Devanagari fonts from shopkeeper"
```

#### Task A5: Bare app shell (root layout, index, vitest)

**Files:**
- Create: `apps/customer-mobile/app/_layout.tsx`
- Create: `apps/customer-mobile/app/index.tsx`
- Create: `apps/customer-mobile/vitest.config.ts`
- Create: `apps/customer-mobile/test/setup.ts`
- Create: `apps/customer-mobile/test/factories.ts`
- Create: `apps/customer-mobile/test/smoke.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

`apps/customer-mobile/test/smoke.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

describe('app shell smoke', () => {
  it('renders a hello marker', () => {
    function Hello(): React.ReactElement {
      return <span data-testid="hello">customer-mobile-ok</span>;
    }
    const { getByTestId } = render(<Hello />);
    expect(getByTestId('hello').textContent).toBe('customer-mobile-ok');
  });
});
```

- [ ] **Step 2: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 3: Write `test/setup.ts`**

```typescript
import { vi } from 'vitest';

// Mock expo-constants — every test gets the dev defaults.
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: 'http://localhost:3000',
        tenantSlug: 'anchor-dev',
        devAuth: false,
      },
    },
  },
}));

// Mock expo-secure-store with an in-memory map.
vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: vi.fn(async (k: string) => {
      store.delete(k);
    }),
    __reset: (): void => store.clear(),
  };
});

// Mock @react-native-firebase/auth — we don't call Firebase in scaffold tests.
vi.mock('@react-native-firebase/auth', () => ({
  default: () => ({
    signInWithPhoneNumber: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => undefined),
  }),
}));
```

- [ ] **Step 4: Write `test/factories.ts`**

```typescript
import type { Tenant } from '../src/stores/tenantStore';
import type { Customer } from '../src/stores/customerSessionStore';

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'anchor-dev',
    displayName: 'अयोध्या स्वर्णकार',
    branding: {
      primaryColor: '#8C2A1E',
      logoUrl: undefined,
      appName: 'अयोध्या स्वर्णकार',
      defaultLanguage: 'hi-IN',
    },
    ...overrides,
  };
}

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    shopId: '00000000-0000-4000-8000-000000000001',
    name: 'देव-मोड ग्राहक',
    phoneE164: '+919999999999',
    ...overrides,
  };
}
```

- [ ] **Step 5: Run the smoke test (red, then minimal green)**

Run: `cd /c/gs-cust-mob && pnpm --filter @goldsmith/customer-mobile test`
Expected: 1 test passes (file already self-contained — green on first run is fine for a smoke test). If it fails, fix the test setup before continuing.

- [ ] **Step 6: Write minimal `app/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import '../global.css';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout(): JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    YatraOne: require('../assets/fonts/YatraOne-Regular.ttf'),
    'MuktaVaani-400': require('../assets/fonts/MuktaVaani-400.ttf'),
    'MuktaVaani-500': require('../assets/fonts/MuktaVaani-500.ttf'),
    'MuktaVaani-600': require('../assets/fonts/MuktaVaani-600.ttf'),
    'MuktaVaani-700': require('../assets/fonts/MuktaVaani-700.ttf'),
    'TiroDevanagariHindi-Regular': require('../assets/fonts/TiroDevanagariHindi-Regular.ttf'),
    'TiroDevanagariHindi-Italic': require('../assets/fonts/TiroDevanagariHindi-Italic.ttf'),
    'Fraunces-Italic': require('../assets/fonts/Fraunces-VariableItalic.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.bg },
            headerShown: false,
          }}
        />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Write minimal `app/index.tsx`**

```typescript
import { Redirect } from 'expo-router';

export default function Index(): JSX.Element {
  // Wired up in WS-C: redirect to /(auth)/welcome or /(tabs) based on session state.
  return <Redirect href="/(auth)/welcome" />;
}
```

- [ ] **Step 8: Run typecheck**

Run: `pnpm --filter @goldsmith/customer-mobile typecheck`
Expected: exits 0. If `expo-router` types complain about missing routes, that's resolved when WS-C creates `(auth)/welcome.tsx`. Skip typecheck on this commit if so; commit anyway and resolve in WS-C.

- [ ] **Step 9: Commit**

```bash
git add apps/customer-mobile/app apps/customer-mobile/vitest.config.ts apps/customer-mobile/test
git commit -m "feat(customer-mobile): app shell + vitest harness"
```

#### Task A6: README

**Files:**
- Create: `apps/customer-mobile/README.md`

- [ ] **Step 1: Write README**

```markdown
# @goldsmith/customer-mobile

White-label customer-facing Expo app. Ships per tenant — same codebase, rebuilt with a
tenant-specific `EXPO_PUBLIC_SHOP_SLUG`, app name, package id, and (eventually) icon/splash.

## Run

```bash
pnpm install                                  # workspace root
pnpm --filter @goldsmith/customer-mobile start
```

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | yes | NestJS API origin (e.g. `http://10.0.2.2:3000`) |
| `EXPO_PUBLIC_SHOP_SLUG` | yes | Tenant slug (`anchor-dev` for dev) |
| `EXPO_PUBLIC_DEV_AUTH` | dev-only | Set to `1` to inject a mock customer session at boot |
| `EXPO_PUBLIC_APP_NAME` | optional | Override app display name (defaults to tenant displayName) |

## Auth status

This branch ships the **scaffold** + a **dev-mode mock customer session** (gated by
`EXPO_PUBLIC_DEV_AUTH=1`). Real customer phone OTP via Firebase is reclassified to a
follow-up Class A story (`EPIC7-S1 — Customer Phone OTP`) because it requires a new
`customers.firebase_uid` column, a new SQL lookup function, and an extension to
`/auth/session` — all auth surface that needs Class A ceremony.

Until that story lands, the welcome screen shows a "Phone OTP coming soon" placeholder
when `EXPO_PUBLIC_DEV_AUTH` is not `1`.

## White-label

Goldsmith brand is NEVER visible to customers. All branding (logo, app name, colors)
loads from `GET /api/v1/tenant/boot?slug=$EXPO_PUBLIC_SHOP_SLUG` at boot and is stored
in `tenantStore`. Components consume tenant config via `useTenantStore` selectors.
```

- [ ] **Step 2: Commit**

```bash
git add apps/customer-mobile/README.md
git commit -m "docs(customer-mobile): README"
```

**Commit message summary for WS-A:** `chore(customer-mobile): scaffold app shell` (across A1–A6)

---

### WS-B: Tenant Resolution + Branded Header

**Packages:** `apps/customer-mobile/`
**Depends on:** WS-A complete
**Done when:** `tenantStore` set/loading/error states transition correctly under unit test; `TenantProvider` boots tenant from `/api/v1/tenant/boot`; `TenantBrandHeader` renders tenant name + logo placeholder; ETag cache fall-through works when API returns 304.

#### Task B1: `tenantStore.ts` (TDD)

**Files:**
- Create: `apps/customer-mobile/src/stores/tenantStore.ts`
- Create: `apps/customer-mobile/src/stores/tenantStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useTenantStore } from './tenantStore';
import { makeTenant } from '../../test/factories';

describe('tenantStore', () => {
  beforeEach(() => {
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: true, error: null });
  });

  it('starts in loading state with no tenant', () => {
    const s = useTenantStore.getState();
    expect(s.tenant).toBeNull();
    expect(s.loading).toBe(true);
  });

  it('setTenant clears loading and stores etag', () => {
    const t = makeTenant();
    useTenantStore.getState().setTenant(t, '"v1"');
    const s = useTenantStore.getState();
    expect(s.tenant).toEqual(t);
    expect(s.etag).toBe('"v1"');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('setError clears loading and stores message', () => {
    useTenantStore.getState().setError('boom');
    const s = useTenantStore.getState();
    expect(s.error).toBe('boom');
    expect(s.loading).toBe(false);
  });

  it('setSlug updates only slug', () => {
    useTenantStore.getState().setSlug('new-slug');
    expect(useTenantStore.getState().slug).toBe('new-slug');
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- tenantStore`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tenantStore.ts`**

```typescript
import { create } from 'zustand';

export interface TenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  appName?: string;
  defaultLanguage?: 'hi-IN' | 'en-IN';
}

export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  branding: TenantBranding;
}

export interface TenantState {
  slug: string | null;
  tenant: Tenant | null;
  etag: string | null;
  loading: boolean;
  error: string | null;
  setSlug: (s: string | null) => void;
  setTenant: (t: Tenant | null, etag: string | null) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  slug: null,
  tenant: null,
  etag: null,
  loading: true,
  error: null,
  setSlug: (s): void => set({ slug: s }),
  setTenant: (t, etag): void => set({ tenant: t, etag, loading: false, error: null }),
  setLoading: (b): void => set({ loading: b }),
  setError: (e): void => set({ error: e, loading: false }),
}));
```

- [ ] **Step 4: Run test (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- tenantStore`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/stores/tenantStore.ts apps/customer-mobile/src/stores/tenantStore.test.ts
git commit -m "feat(customer-mobile): tenantStore"
```

#### Task B2: `api/client.ts`

**Files:**
- Create: `apps/customer-mobile/src/api/client.ts`
- Create: `apps/customer-mobile/src/api/client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './client';
import { useTenantStore } from '../stores/tenantStore';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { makeTenant, makeCustomer } from '../../test/factories';

describe('api client', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: false, error: null });
    useCustomerSessionStore.setState({ customer: null, bearer: null });
  });

  it('attaches x-tenant-id when tenant resolved', async () => {
    useTenantStore.setState({ tenant: makeTenant() });
    mock.onGet('/api/v1/whatever').reply((cfg) => {
      expect(cfg.headers?.['x-tenant-id']).toBe(makeTenant().id);
      return [200, {}];
    });
    await api.get('/api/v1/whatever');
  });

  it('attaches Authorization when bearer set', async () => {
    useCustomerSessionStore.setState({
      customer: makeCustomer(),
      bearer: 'mock-token-abc',
    });
    mock.onGet('/api/v1/whatever').reply((cfg) => {
      expect(cfg.headers?.['Authorization']).toBe('Bearer mock-token-abc');
      return [200, {}];
    });
    await api.get('/api/v1/whatever');
  });

  it('omits Authorization when no bearer', async () => {
    mock.onGet('/api/v1/whatever').reply((cfg) => {
      expect(cfg.headers?.['Authorization']).toBeUndefined();
      return [200, {}];
    });
    await api.get('/api/v1/whatever');
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- client`
Expected: FAIL — `client` and `customerSessionStore` not found.

- [ ] **Step 3: Implement `client.ts`**

```typescript
import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';

const baseURL =
  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3000';

export const api: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tenant = useTenantStore.getState().tenant;
  if (tenant) {
    config.headers.set('x-tenant-id', tenant.id);
  }
  const bearer = useCustomerSessionStore.getState().bearer;
  if (bearer) {
    config.headers.set('Authorization', `Bearer ${bearer}`);
  }
  return config;
});
```

(Note: `customerSessionStore` does not exist yet. The test will continue to fail for that import. We create it in WS-C/Task C2 — see Step 4.)

- [ ] **Step 4: Pre-create a stub `customerSessionStore.ts` so client.ts compiles**

`apps/customer-mobile/src/stores/customerSessionStore.ts`:

```typescript
import { create } from 'zustand';

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phoneE164: string;
}

export interface CustomerSessionState {
  customer: Customer | null;
  bearer: string | null;
  setSession: (customer: Customer, bearer: string) => void;
  clear: () => void;
}

export const useCustomerSessionStore = create<CustomerSessionState>((set) => ({
  customer: null,
  bearer: null,
  setSession: (customer, bearer): void => set({ customer, bearer }),
  clear: (): void => set({ customer: null, bearer: null }),
}));
```

This is the final shape. WS-C will add tests against it; we just need the type/store live for client.ts to compile.

- [ ] **Step 5: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- client`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/customer-mobile/src/api/client.ts apps/customer-mobile/src/api/client.test.ts apps/customer-mobile/src/stores/customerSessionStore.ts
git commit -m "feat(customer-mobile): api client + customerSessionStore stub"
```

#### Task B3: `endpoints.ts` (tenant boot, catalog rates, catalog products, customer-self-delete)

**Files:**
- Create: `apps/customer-mobile/src/api/endpoints.ts`
- Create: `apps/customer-mobile/src/api/endpoints.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './client';
import {
  getTenantBoot,
  getPublicRates,
  listPublicProducts,
  customerSelfDelete,
} from './endpoints';

describe('endpoints', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  it('getTenantBoot returns 200 payload', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(200, {
      id: 'tid', slug: 'anchor-dev', displayName: 'Test Shop', branding: {},
    }, { etag: '"v1"' });
    const r = await getTenantBoot('anchor-dev');
    expect(r.tenant.slug).toBe('anchor-dev');
    expect(r.etag).toBe('"v1"');
    expect(r.notModified).toBe(false);
  });

  it('getTenantBoot handles 304', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(304);
    const r = await getTenantBoot('anchor-dev', '"v1"');
    expect(r.notModified).toBe(true);
    expect(r.etag).toBe('"v1"');
  });

  it('getPublicRates returns rates', async () => {
    mock.onGet('/api/v1/catalog/rates').reply(200, {
      GOLD_24K: { perGramRupees: '7500.00', formattedINR: '₹7,500.00', fetchedAt: '2026-04-30T00:00:00Z' },
      GOLD_22K: { perGramRupees: '6900.00', formattedINR: '₹6,900.00', fetchedAt: '2026-04-30T00:00:00Z' },
      SILVER_999: { perGramRupees: '90.00', formattedINR: '₹90.00', fetchedAt: '2026-04-30T00:00:00Z' },
      stale: false,
      source: 'IBJA',
      refreshedAt: '2026-04-30T00:00:00Z',
    });
    const r = await getPublicRates();
    expect(r.GOLD_24K.formattedINR).toBe('₹7,500.00');
  });

  it('listPublicProducts returns items array', async () => {
    mock.onGet('/api/v1/catalog/products').reply(200, { items: [], total: 0, tenantId: 'tid' });
    const r = await listPublicProducts({ limit: 6 });
    expect(r.items).toEqual([]);
  });

  it('customerSelfDelete maps 501 NotImplemented to typed error', async () => {
    mock.onDelete('/api/v1/customer/me').reply(501, { code: 'deletion.customer_app_not_yet_available' });
    await expect(customerSelfDelete()).rejects.toMatchObject({
      code: 'deletion.customer_app_not_yet_available',
    });
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- endpoints`
Expected: FAIL — endpoints module not found.

- [ ] **Step 3: Implement `endpoints.ts`**

```typescript
import { api } from './client';
import type { Tenant } from '../stores/tenantStore';

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

export interface PublicProduct {
  id: string;
  name: string;
  // The catalog/products endpoint currently returns an empty array (Epic 7 stub on the API side)
  // — additional fields will land when the catalog story ships.
}

export interface PublicProductsResponse {
  items: PublicProduct[];
  total: number;
}

export interface TypedApiError extends Error {
  code: string;
  status?: number;
}

export async function getTenantBoot(
  slug: string,
  etag?: string,
): Promise<{ tenant: Tenant; etag: string | null; notModified: boolean }> {
  const res = await api.get<Tenant>(`/api/v1/tenant/boot`, {
    params: { slug },
    headers: etag ? { 'If-None-Match': etag } : undefined,
    validateStatus: (s: number) => s === 200 || s === 304,
  });
  if (res.status === 304) {
    return { tenant: null as unknown as Tenant, etag: etag ?? null, notModified: true };
  }
  return {
    tenant: res.data,
    etag: (res.headers['etag'] as string | undefined) ?? null,
    notModified: false,
  };
}

export async function getPublicRates(): Promise<PublicRatesResponse> {
  const res = await api.get<PublicRatesResponse>('/api/v1/catalog/rates');
  return res.data;
}

export async function listPublicProducts(opts: { limit?: number } = {}): Promise<PublicProductsResponse> {
  const res = await api.get<PublicProductsResponse>('/api/v1/catalog/products', {
    params: opts.limit ? { limit: opts.limit } : undefined,
  });
  return res.data;
}

export async function customerSelfDelete(): Promise<void> {
  try {
    await api.delete('/api/v1/customer/me');
  } catch (e) {
    const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code ?? 'unknown';
    const status = (e as { response?: { status?: number } }).response?.status;
    const err: TypedApiError = Object.assign(new Error(code), { code, status });
    throw err;
  }
}
```

- [ ] **Step 4: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- endpoints`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/api/endpoints.ts apps/customer-mobile/src/api/endpoints.test.ts
git commit -m "feat(customer-mobile): endpoint clients (tenant/rates/products/self-delete)"
```

#### Task B4: `TenantProvider.tsx`

**Files:**
- Create: `apps/customer-mobile/src/providers/TenantProvider.tsx`
- Create: `apps/customer-mobile/src/providers/TenantProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { api } from '../api/client';
import { useTenantStore } from '../stores/tenantStore';
import { TenantProvider } from './TenantProvider';
import { makeTenant } from '../../test/factories';

describe('TenantProvider', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: true, error: null });
  });

  it('boots tenant from /tenant/boot and stores it', async () => {
    const t = makeTenant();
    mock.onGet('/api/v1/tenant/boot').reply(200, t, { etag: '"v1"' });

    render(<TenantProvider><span>x</span></TenantProvider>);

    await waitFor(() => {
      expect(useTenantStore.getState().tenant?.id).toBe(t.id);
    });
    expect(useTenantStore.getState().etag).toBe('"v1"');
    expect(useTenantStore.getState().loading).toBe(false);
  });

  it('sets error state on network failure', async () => {
    mock.onGet('/api/v1/tenant/boot').networkError();
    render(<TenantProvider><span>x</span></TenantProvider>);
    await waitFor(() => {
      expect(useTenantStore.getState().error).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- TenantProvider`
Expected: FAIL.

- [ ] **Step 3: Implement `TenantProvider.tsx`**

```typescript
import { useEffect } from 'react';
import Constants from 'expo-constants';
import { useTenantStore } from '../stores/tenantStore';
import { getTenantBoot } from '../api/endpoints';

export function TenantProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSlug = useTenantStore((s) => s.setSlug);
  const setTenant = useTenantStore((s) => s.setTenant);
  const setError = useTenantStore((s) => s.setError);
  const setLoading = useTenantStore((s) => s.setLoading);

  useEffect(() => {
    const slug = (Constants.expoConfig?.extra?.['tenantSlug'] as string | undefined) ?? 'anchor-dev';
    setSlug(slug);
    setLoading(true);

    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const r = await getTenantBoot(slug);
        if (cancelled) return;
        setTenant(r.tenant, r.etag);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'tenant.boot_failed');
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [setSlug, setTenant, setError, setLoading]);

  return <>{children}</>;
}
```

- [ ] **Step 4: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- TenantProvider`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/providers/TenantProvider.tsx apps/customer-mobile/src/providers/TenantProvider.test.tsx
git commit -m "feat(customer-mobile): TenantProvider boots tenant config"
```

#### Task B5: `TenantBrandHeader.tsx`

**Files:**
- Create: `apps/customer-mobile/src/components/TenantBrandHeader.tsx`
- Create: `apps/customer-mobile/src/components/TenantBrandHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TenantBrandHeader } from './TenantBrandHeader';
import { useTenantStore } from '../stores/tenantStore';
import { makeTenant } from '../../test/factories';

describe('TenantBrandHeader', () => {
  beforeEach(() => {
    useTenantStore.setState({ tenant: null, slug: null, etag: null, loading: false, error: null });
  });

  it('renders nothing while tenant is loading', () => {
    useTenantStore.setState({ loading: true });
    const { container } = render(<TenantBrandHeader />);
    expect(container.querySelector('[testID="tenant-brand-header"]')).toBeNull();
  });

  it('renders tenant displayName once loaded', () => {
    useTenantStore.setState({ tenant: makeTenant({ displayName: 'टेस्ट दुकान' }) });
    const { getByTestId } = render(<TenantBrandHeader />);
    expect(getByTestId('tenant-brand-name').textContent).toBe('टेस्ट दुकान');
  });

  it('does NOT contain the string "Goldsmith" (white-label invariant)', () => {
    useTenantStore.setState({ tenant: makeTenant({ displayName: 'टेस्ट दुकान' }) });
    const { container } = render(<TenantBrandHeader />);
    expect(container.textContent ?? '').not.toMatch(/Goldsmith/i);
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- TenantBrandHeader`
Expected: FAIL.

- [ ] **Step 3: Implement `TenantBrandHeader.tsx`**

```typescript
import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../stores/tenantStore';

export function TenantBrandHeader(): React.ReactElement | null {
  const tenant = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);

  if (loading || !tenant) return null;

  const logoUrl = tenant.branding.logoUrl;

  return (
    <View
      testID="tenant-brand-header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.bg,
      }}
    >
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: 40, height: 40, borderRadius: 8, marginRight: spacing.sm }}
          accessibilityLabel={tenant.displayName}
        />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: colors.border,
            marginRight: spacing.sm,
          }}
        />
      )}
      <Text
        testID="tenant-brand-name"
        style={{
          fontFamily: typography.display.family,
          fontSize: 20,
          color: colors.ink,
        }}
      >
        {tenant.displayName}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- TenantBrandHeader`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/components/TenantBrandHeader.tsx apps/customer-mobile/src/components/TenantBrandHeader.test.tsx
git commit -m "feat(customer-mobile): TenantBrandHeader component (white-label invariant tested)"
```

**Commit message summary for WS-B:** `feat(customer-mobile): tenant resolution + branded header`

---

### WS-C: Dev-Mode Customer Session

**Packages:** `apps/customer-mobile/`
**Depends on:** WS-A complete (the stub `customerSessionStore` from B2 is already in place)
**Parallel with:** WS-D (after WS-B)
**Done when:** `customerSessionStore` set/clear behavior tested; `secure-storage.ts` round-trips with mocked SecureStore; `useCustomerSession` selector hook works; `CustomerAuthProvider` injects mock when `EXPO_PUBLIC_DEV_AUTH=1`, otherwise leaves session null; `(auth)/welcome.tsx` shows phone-OTP-coming-soon copy when DEV_AUTH off and a "Continue (Dev)" button when on; `app/index.tsx` redirects based on session state.

#### Task C1: `secure-storage.ts` (TDD)

**Files:**
- Create: `apps/customer-mobile/src/lib/secure-storage.ts`
- Create: `apps/customer-mobile/src/lib/secure-storage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { saveSecureSession, loadSecureSession, clearSecureSession, SECURE_KEY } from './secure-storage';

describe('secure-storage', () => {
  beforeEach(() => {
    (SecureStore as unknown as { __reset: () => void }).__reset();
    vi.clearAllMocks();
  });

  it('round-trips a session', async () => {
    await saveSecureSession({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
    const loaded = await loadSecureSession();
    expect(loaded).toEqual({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
  });

  it('returns null when nothing stored', async () => {
    expect(await loadSecureSession()).toBeNull();
  });

  it('clears the session', async () => {
    await saveSecureSession({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
    await clearSecureSession();
    expect(await loadSecureSession()).toBeNull();
  });

  it('uses the documented key (no AsyncStorage drift)', async () => {
    await saveSecureSession({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_KEY, expect.any(String));
    expect(SECURE_KEY).toBe('customer_session_v1');
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- secure-storage`
Expected: FAIL.

- [ ] **Step 3: Implement `secure-storage.ts`**

```typescript
import * as SecureStore from 'expo-secure-store';

export const SECURE_KEY = 'customer_session_v1';

export interface PersistedSession {
  bearer: string;
  customerId: string;
  shopId: string;
}

export async function saveSecureSession(s: PersistedSession): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(s));
}

export async function loadSecureSession(): Promise<PersistedSession | null> {
  const raw = await SecureStore.getItemAsync(SECURE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

export async function clearSecureSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY);
}
```

- [ ] **Step 4: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- secure-storage`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/lib/secure-storage.ts apps/customer-mobile/src/lib/secure-storage.test.ts
git commit -m "feat(customer-mobile): expo-secure-store wrapper"
```

#### Task C2: `customerSessionStore` tests

**Files:**
- Create: `apps/customer-mobile/src/stores/customerSessionStore.test.ts`

(`customerSessionStore.ts` already exists from Task B2 — we just add tests now.)

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCustomerSessionStore } from './customerSessionStore';
import { makeCustomer } from '../../test/factories';

describe('customerSessionStore', () => {
  beforeEach(() => {
    useCustomerSessionStore.setState({ customer: null, bearer: null });
  });

  it('starts empty', () => {
    const s = useCustomerSessionStore.getState();
    expect(s.customer).toBeNull();
    expect(s.bearer).toBeNull();
  });

  it('setSession stores both fields', () => {
    const c = makeCustomer();
    useCustomerSessionStore.getState().setSession(c, 'tok-1');
    const s = useCustomerSessionStore.getState();
    expect(s.customer).toEqual(c);
    expect(s.bearer).toBe('tok-1');
  });

  it('clear wipes both', () => {
    const c = makeCustomer();
    useCustomerSessionStore.getState().setSession(c, 'tok-1');
    useCustomerSessionStore.getState().clear();
    const s = useCustomerSessionStore.getState();
    expect(s.customer).toBeNull();
    expect(s.bearer).toBeNull();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @goldsmith/customer-mobile test -- customerSessionStore`
Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/customer-mobile/src/stores/customerSessionStore.test.ts
git commit -m "test(customer-mobile): customerSessionStore"
```

#### Task C3: `useCustomerSession` hook

**Files:**
- Create: `apps/customer-mobile/src/hooks/useCustomerSession.ts`
- Create: `apps/customer-mobile/src/hooks/useCustomerSession.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useCustomerSession } from './useCustomerSession';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { makeCustomer } from '../../test/factories';

describe('useCustomerSession', () => {
  beforeEach(() => {
    useCustomerSessionStore.setState({ customer: null, bearer: null });
  });

  it('reports unauthenticated when store is empty', () => {
    const { result } = renderHook(() => useCustomerSession());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.customer).toBeNull();
  });

  it('reports authenticated when store has a customer + bearer', () => {
    const c = makeCustomer();
    act(() => {
      useCustomerSessionStore.getState().setSession(c, 'tok');
    });
    const { result } = renderHook(() => useCustomerSession());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.customer).toEqual(c);
  });

  it('signOut clears store', () => {
    act(() => {
      useCustomerSessionStore.getState().setSession(makeCustomer(), 'tok');
    });
    const { result } = renderHook(() => useCustomerSession());
    act(() => {
      void result.current.signOut();
    });
    expect(useCustomerSessionStore.getState().customer).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- useCustomerSession`
Expected: FAIL.

- [ ] **Step 3: Implement `useCustomerSession.ts`**

```typescript
import { useCustomerSessionStore, type Customer } from '../stores/customerSessionStore';
import { clearSecureSession } from '../lib/secure-storage';

export interface UseCustomerSessionReturn {
  customer: Customer | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

export function useCustomerSession(): UseCustomerSessionReturn {
  const customer = useCustomerSessionStore((s) => s.customer);
  const bearer = useCustomerSessionStore((s) => s.bearer);
  const clear = useCustomerSessionStore((s) => s.clear);

  const signOut = async (): Promise<void> => {
    await clearSecureSession();
    clear();
  };

  return {
    customer,
    isAuthenticated: customer !== null && bearer !== null,
    signOut,
  };
}
```

- [ ] **Step 4: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- useCustomerSession`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/hooks/useCustomerSession.ts apps/customer-mobile/src/hooks/useCustomerSession.test.tsx
git commit -m "feat(customer-mobile): useCustomerSession hook"
```

#### Task C4: `CustomerAuthProvider` (dev-mode mock injector)

**Files:**
- Create: `apps/customer-mobile/src/providers/CustomerAuthProvider.tsx`
- Create: `apps/customer-mobile/src/providers/CustomerAuthProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { CustomerAuthProvider } from './CustomerAuthProvider';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';
import { makeTenant } from '../../test/factories';
import * as SecureStore from 'expo-secure-store';

function renderWithDevAuth(devAuth: boolean): ReturnType<typeof render> {
  vi.doMock('expo-constants', () => ({
    default: { expoConfig: { extra: { devAuth } } },
  }));
  return render(<CustomerAuthProvider><span>x</span></CustomerAuthProvider>);
}

describe('CustomerAuthProvider', () => {
  beforeEach(() => {
    useCustomerSessionStore.setState({ customer: null, bearer: null });
    useTenantStore.setState({ tenant: makeTenant(), slug: 'anchor-dev', etag: null, loading: false, error: null });
    (SecureStore as unknown as { __reset: () => void }).__reset();
    vi.resetModules();
  });

  it('does NOT inject a session when devAuth is false', async () => {
    const { CustomerAuthProvider: Comp } = await import('./CustomerAuthProvider');
    vi.doMock('expo-constants', () => ({
      default: { expoConfig: { extra: { devAuth: false } } },
    }));
    render(<Comp><span>x</span></Comp>);
    // Allow effect to flush
    await new Promise((r) => setTimeout(r, 50));
    expect(useCustomerSessionStore.getState().customer).toBeNull();
  });

  it('injects a mock session when devAuth=1 AND tenant resolved', async () => {
    vi.resetModules();
    vi.doMock('expo-constants', () => ({
      default: { expoConfig: { extra: { devAuth: true } } },
    }));
    const { CustomerAuthProvider: Comp } = await import('./CustomerAuthProvider');
    render(<Comp><span>x</span></Comp>);
    await waitFor(() => {
      expect(useCustomerSessionStore.getState().customer).not.toBeNull();
    });
    const s = useCustomerSessionStore.getState();
    expect(s.bearer).toMatch(/^DEV-MOCK-/);
    expect(s.customer?.shopId).toBe(makeTenant().id);
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- CustomerAuthProvider`
Expected: FAIL.

- [ ] **Step 3: Implement `CustomerAuthProvider.tsx`**

```typescript
import { useEffect } from 'react';
import Constants from 'expo-constants';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';
import { saveSecureSession, loadSecureSession } from '../lib/secure-storage';

const DEV_MOCK_BEARER_PREFIX = 'DEV-MOCK-';
const DEV_MOCK_CUSTOMER_ID = '00000000-0000-4000-8000-000000000999';

export function CustomerAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSession = useCustomerSessionStore((s) => s.setSession);
  const tenant = useTenantStore((s) => s.tenant);
  const devAuth = Boolean(Constants.expoConfig?.extra?.['devAuth']);

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      // 1. Try to rehydrate from SecureStore (would only be set after a previous dev-mode boot
      //    OR after real customer auth ships in EPIC7-S1).
      const persisted = await loadSecureSession();
      if (cancelled) return;
      if (persisted && tenant && persisted.shopId === tenant.id) {
        setSession(
          { id: persisted.customerId, shopId: persisted.shopId, name: 'देव-मोड ग्राहक', phoneE164: '+919999999999' },
          persisted.bearer,
        );
        return;
      }

      // 2. Dev-mode mock — only fires when EXPO_PUBLIC_DEV_AUTH=1 AND tenant is resolved.
      if (devAuth && tenant) {
        const bearer = `${DEV_MOCK_BEARER_PREFIX}${Date.now()}`;
        const customer = {
          id: DEV_MOCK_CUSTOMER_ID,
          shopId: tenant.id,
          name: 'देव-मोड ग्राहक',
          phoneE164: '+919999999999',
        };
        await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
        if (cancelled) return;
        setSession(customer, bearer);
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [devAuth, tenant, setSession]);

  return <>{children}</>;
}
```

- [ ] **Step 4: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- CustomerAuthProvider`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/providers/CustomerAuthProvider.tsx apps/customer-mobile/src/providers/CustomerAuthProvider.test.tsx
git commit -m "feat(customer-mobile): CustomerAuthProvider with dev-mode mock injection"
```

#### Task C5: Auth gate routes — `app/(auth)/_layout.tsx`, `(auth)/welcome.tsx`, update `app/index.tsx`, wire providers in root layout

**Files:**
- Create: `apps/customer-mobile/app/(auth)/_layout.tsx`
- Create: `apps/customer-mobile/app/(auth)/welcome.tsx`
- Modify: `apps/customer-mobile/app/index.tsx`
- Modify: `apps/customer-mobile/app/_layout.tsx` (wrap with TenantProvider + CustomerAuthProvider)

- [ ] **Step 1: Write `app/(auth)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout(): JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Write `app/(auth)/welcome.tsx`**

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Button } from '@goldsmith/ui-mobile';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSessionStore } from '../../src/stores/customerSessionStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { saveSecureSession } from '../../src/lib/secure-storage';

export default function Welcome(): React.ReactElement {
  const devAuth = Boolean(Constants.expoConfig?.extra?.['devAuth']);
  const setSession = useCustomerSessionStore((s) => s.setSession);
  const tenant = useTenantStore((s) => s.tenant);

  const onDevContinue = async (): Promise<void> => {
    if (!tenant) return;
    const bearer = `DEV-MOCK-${Date.now()}`;
    const customer = {
      id: '00000000-0000-4000-8000-000000000999',
      shopId: tenant.id,
      name: 'देव-मोड ग्राहक',
      phoneE164: '+919999999999',
    };
    await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
    setSession(customer, bearer);
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 28,
            color: colors.ink,
            marginBottom: spacing.sm,
          }}
        >
          स्वागत है
        </Text>
        <Text
          style={{
            fontFamily: typography.serif.family,
            fontSize: 16,
            color: colors.inkMute,
            marginBottom: spacing.xl,
          }}
        >
          फ़ोन OTP लॉगिन जल्द आ रहा है। (Phone OTP login coming soon.)
        </Text>

        {devAuth ? (
          <Button
            label="जारी रखें (Dev)"
            variant="primary"
            onPress={onDevContinue}
            testID="welcome-dev-continue"
          />
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Update `app/index.tsx`**

```typescript
import { Redirect } from 'expo-router';
import { useCustomerSession } from '../src/hooks/useCustomerSession';

export default function Index(): JSX.Element {
  const { isAuthenticated } = useCustomerSession();
  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/welcome" />;
}
```

- [ ] **Step 4: Update `app/_layout.tsx` to wrap providers**

```typescript
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import { TenantProvider } from '../src/providers/TenantProvider';
import { CustomerAuthProvider } from '../src/providers/CustomerAuthProvider';
import '../global.css';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout(): JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    YatraOne: require('../assets/fonts/YatraOne-Regular.ttf'),
    'MuktaVaani-400': require('../assets/fonts/MuktaVaani-400.ttf'),
    'MuktaVaani-500': require('../assets/fonts/MuktaVaani-500.ttf'),
    'MuktaVaani-600': require('../assets/fonts/MuktaVaani-600.ttf'),
    'MuktaVaani-700': require('../assets/fonts/MuktaVaani-700.ttf'),
    'TiroDevanagariHindi-Regular': require('../assets/fonts/TiroDevanagariHindi-Regular.ttf'),
    'TiroDevanagariHindi-Italic': require('../assets/fonts/TiroDevanagariHindi-Italic.ttf'),
    'Fraunces-Italic': require('../assets/fonts/Fraunces-VariableItalic.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <TenantProvider>
          <CustomerAuthProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: colors.bg },
                headerShown: false,
              }}
            />
          </CustomerAuthProvider>
        </TenantProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm --filter @goldsmith/customer-mobile typecheck && pnpm --filter @goldsmith/customer-mobile test`
Expected: typecheck 0; all tests passing (~17 by now).

- [ ] **Step 6: Commit**

```bash
git add apps/customer-mobile/app
git commit -m "feat(customer-mobile): auth route group + provider wiring"
```

**Commit message summary for WS-C:** `feat(customer-mobile): dev-mode mock customer session`

---

### WS-D: Home + Profile Screens

**Packages:** `apps/customer-mobile/`
**Depends on:** WS-B + WS-C complete
**Done when:** Home renders rate card (live or stub), product grid (empty-state messaging), category row; Browse + Wishlist render placeholder; Profile renders name/phone, loyalty stub, DPDPA delete button that hits `/customer/me` and gracefully shows the 501 message; tab bar works; all components have a render test.

#### Task D1: `usePublicRates` hook + `RateCard.tsx`

**Files:**
- Create: `apps/customer-mobile/src/hooks/usePublicRates.ts`
- Create: `apps/customer-mobile/src/components/RateCard.tsx`
- Create: `apps/customer-mobile/src/components/RateCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { api } from '../api/client';
import { RateCard } from './RateCard';

function wrap(): { wrapper: React.FC<{ children: React.ReactNode }>; client: QueryClient } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

describe('RateCard', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  it('renders 22K rate from API', async () => {
    mock.onGet('/api/v1/catalog/rates').reply(200, {
      GOLD_24K: { perGramRupees: '7500.00', formattedINR: '₹7,500.00', fetchedAt: '2026-04-30T00:00:00Z' },
      GOLD_22K: { perGramRupees: '6900.00', formattedINR: '₹6,900.00', fetchedAt: '2026-04-30T00:00:00Z' },
      SILVER_999: { perGramRupees: '90.00', formattedINR: '₹90.00', fetchedAt: '2026-04-30T00:00:00Z' },
      stale: false,
      source: 'IBJA',
      refreshedAt: '2026-04-30T00:00:00Z',
    });
    const { wrapper } = wrap();
    const { getByTestId } = render(<RateCard />, { wrapper });
    await waitFor(() => {
      expect(getByTestId('rate-22k').textContent).toContain('₹6,900.00');
    });
  });

  it('renders unavailable copy on 503', async () => {
    mock.onGet('/api/v1/catalog/rates').reply(503, { code: 'rates.unavailable', stale: true });
    const { wrapper } = wrap();
    const { getByTestId } = render(<RateCard />, { wrapper });
    await waitFor(() => {
      expect(getByTestId('rate-card-error')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- RateCard`
Expected: FAIL.

- [ ] **Step 3: Implement `usePublicRates.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { getPublicRates, type PublicRatesResponse } from '../api/endpoints';

export function usePublicRates(): {
  data: PublicRatesResponse | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['public-rates'],
    queryFn: getPublicRates,
    staleTime: 60_000,
    retry: false,
  });
  return { data: q.data, isLoading: q.isLoading, isError: q.isError };
}
```

- [ ] **Step 4: Implement `RateCard.tsx`**

```typescript
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { usePublicRates } from '../hooks/usePublicRates';

export function RateCard(): React.ReactElement {
  const { data, isLoading, isError } = usePublicRates();

  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: typography.headingMid.family,
          fontSize: 16,
          color: colors.ink,
          marginBottom: spacing.sm,
        }}
      >
        आज की दर / Today's rate
      </Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : isError || !data ? (
        <Text testID="rate-card-error" style={{ color: colors.inkMute, fontFamily: typography.body.family }}>
          दर अभी उपलब्ध नहीं है
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.inkMute, fontSize: 12 }}>22K</Text>
            <Text testID="rate-22k" style={{ fontFamily: typography.display.family, fontSize: 18, color: colors.ink }}>
              {data.GOLD_22K.formattedINR}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.inkMute, fontSize: 12 }}>24K</Text>
            <Text testID="rate-24k" style={{ fontFamily: typography.display.family, fontSize: 18, color: colors.ink }}>
              {data.GOLD_24K.formattedINR}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.inkMute, fontSize: 12 }}>चांदी 999</Text>
            <Text testID="rate-silver" style={{ fontFamily: typography.display.family, fontSize: 18, color: colors.ink }}>
              {data.SILVER_999.formattedINR}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 5: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- RateCard`
Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/customer-mobile/src/hooks/usePublicRates.ts apps/customer-mobile/src/components/RateCard.tsx apps/customer-mobile/src/components/RateCard.test.tsx
git commit -m "feat(customer-mobile): RateCard + usePublicRates"
```

#### Task D2: `ProductCard.tsx`, `ProductGrid.tsx`, `CategoryRow.tsx`, `LoyaltyPointsCard.tsx`, `ComingSoon.tsx`

**Files:**
- Create: `apps/customer-mobile/src/components/ProductCard.tsx`
- Create: `apps/customer-mobile/src/components/ProductGrid.tsx`
- Create: `apps/customer-mobile/src/components/ProductGrid.test.tsx`
- Create: `apps/customer-mobile/src/components/CategoryRow.tsx`
- Create: `apps/customer-mobile/src/components/LoyaltyPointsCard.tsx`
- Create: `apps/customer-mobile/src/components/ComingSoon.tsx`
- Create: `apps/customer-mobile/src/components/ComingSoon.test.tsx`

- [ ] **Step 1: Write the failing tests**

`ProductGrid.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { api } from '../api/client';
import { ProductGrid } from './ProductGrid';

function wrap(): React.FC<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ProductGrid', () => {
  let mock: MockAdapter;

  beforeEach(() => { mock = new MockAdapter(api); });

  it('shows empty-state copy when API returns no items', async () => {
    mock.onGet('/api/v1/catalog/products').reply(200, { items: [], total: 0, tenantId: 't' });
    const Wrapper = wrap();
    const { getByTestId } = render(<ProductGrid />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(getByTestId('product-grid-empty')).toBeTruthy();
    });
  });
});
```

`ComingSoon.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ComingSoon } from './ComingSoon';

describe('ComingSoon', () => {
  it('renders the Hindi placeholder', () => {
    const { getByText } = render(<ComingSoon />);
    expect(getByText('जल्द आ रहा है')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- ProductGrid ComingSoon`
Expected: FAIL.

- [ ] **Step 3: Implement components**

`ComingSoon.tsx`:

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

export function ComingSoon(): React.ReactElement {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
      <Text
        style={{
          fontFamily: typography.display.family,
          fontSize: 22,
          color: colors.ink,
          marginBottom: spacing.xs,
        }}
      >
        जल्द आ रहा है
      </Text>
      <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
        Coming soon
      </Text>
    </View>
  );
}
```

`ProductCard.tsx`:

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import type { PublicProduct } from '../api/endpoints';

export function ProductCard({ product }: { product: PublicProduct }): React.ReactElement {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        flex: 1,
      }}
    >
      <View
        style={{
          aspectRatio: 1,
          backgroundColor: colors.border,
          borderRadius: radii.sm,
          marginBottom: spacing.xs,
        }}
      />
      <Text
        numberOfLines={2}
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink }}
      >
        {product.name}
      </Text>
    </View>
  );
}
```

`ProductGrid.tsx`:

```typescript
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { listPublicProducts } from '../api/endpoints';
import { ProductCard } from './ProductCard';

export function ProductGrid(): React.ReactElement {
  const q = useQuery({
    queryKey: ['public-products', 6],
    queryFn: () => listPublicProducts({ limit: 6 }),
    retry: false,
  });

  if (q.isLoading) return <ActivityIndicator style={{ marginVertical: spacing.lg }} />;

  if (!q.data || q.data.items.length === 0) {
    return (
      <View
        testID="product-grid-empty"
        style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, alignItems: 'center' }}
      >
        <Text style={{ fontFamily: typography.serif.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}>
          अभी कोई उत्पाद उपलब्ध नहीं है। दुकानदार जल्द जोड़ेंगे।
        </Text>
      </View>
    );
  }

  // 2-col grid using flex-wrap
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
      }}
    >
      {q.data.items.map((p) => (
        <View key={p.id} style={{ width: '48%' }}>
          <ProductCard product={p} />
        </View>
      ))}
    </View>
  );
}
```

`CategoryRow.tsx`:

```typescript
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

const STATIC_CATEGORIES = ['सोना', 'हीरा', 'चांदी', 'दुल्हन', 'थोक'] as const;

export function CategoryRow(): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}
    >
      {STATIC_CATEGORIES.map((c) => (
        <View
          key={c}
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>{c}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
```

`LoyaltyPointsCard.tsx`:

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

export function LoyaltyPointsCard(): React.ReactElement {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontFamily: typography.headingMid.family, fontSize: 16, color: colors.ink }}>
        वफ़ादारी अंक
      </Text>
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 13,
          color: colors.inkMute,
          marginTop: spacing.xs,
        }}
      >
        फ़ोन OTP लॉगिन के बाद उपलब्ध। (Available after phone OTP login.)
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- ProductGrid ComingSoon`
Expected: passing.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-mobile/src/components
git commit -m "feat(customer-mobile): home + profile presentation components"
```

#### Task D3: Tabs layout + Home screen

**Files:**
- Create: `apps/customer-mobile/app/(tabs)/_layout.tsx`
- Create: `apps/customer-mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Write `app/(tabs)/_layout.tsx`**

```typescript
import { Tabs, Redirect } from 'expo-router';
import { colors } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';

export default function TabsLayout(): JSX.Element {
  const { isAuthenticated } = useCustomerSession();
  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMute,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, height: 60 },
        tabBarLabelStyle: { fontSize: 12 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'मुख्य' }} />
      <Tabs.Screen name="browse" options={{ title: 'उत्पाद' }} />
      <Tabs.Screen name="wishlist" options={{ title: 'पसंदीदा' }} />
      <Tabs.Screen name="profile" options={{ title: 'प्रोफ़ाइल' }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Write `app/(tabs)/index.tsx`**

```typescript
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { RateCard } from '../../src/components/RateCard';
import { CategoryRow } from '../../src/components/CategoryRow';
import { ProductGrid } from '../../src/components/ProductGrid';

export default function Home(): React.ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <RateCard />
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 18,
            color: colors.ink,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
          }}
        >
          श्रेणियाँ
        </Text>
        <CategoryRow />
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 18,
            color: colors.ink,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
          }}
        >
          चुनिंदा उत्पाद
        </Text>
        <ProductGrid />
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @goldsmith/customer-mobile typecheck`
Expected: 0.

- [ ] **Step 4: Commit**

```bash
git add apps/customer-mobile/app/\(tabs\)/_layout.tsx apps/customer-mobile/app/\(tabs\)/index.tsx
git commit -m "feat(customer-mobile): tabs layout + Home screen"
```

#### Task D4: Browse, Wishlist, Profile screens

**Files:**
- Create: `apps/customer-mobile/app/(tabs)/browse.tsx`
- Create: `apps/customer-mobile/app/(tabs)/wishlist.tsx`
- Create: `apps/customer-mobile/app/(tabs)/profile.tsx`
- Create: `apps/customer-mobile/app/(tabs)/profile.test.tsx`

- [ ] **Step 1: Write `browse.tsx`**

```typescript
import React from 'react';
import { View } from 'react-native';
import { colors } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { ComingSoon } from '../../src/components/ComingSoon';

export default function Browse(): React.ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ComingSoon />
    </View>
  );
}
```

- [ ] **Step 2: Write `wishlist.tsx`**

```typescript
import React from 'react';
import { View } from 'react-native';
import { colors } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { ComingSoon } from '../../src/components/ComingSoon';

export default function Wishlist(): React.ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ComingSoon />
    </View>
  );
}
```

- [ ] **Step 3: Write the failing profile test**

`profile.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { api } from '../../src/api/client';
import { useCustomerSessionStore } from '../../src/stores/customerSessionStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { makeCustomer, makeTenant } from '../../test/factories';
import Profile from './profile';

describe('Profile', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useTenantStore.setState({ tenant: makeTenant(), slug: 'anchor-dev', etag: null, loading: false, error: null });
    useCustomerSessionStore.setState({ customer: makeCustomer({ name: 'राम कुमार' }), bearer: 'tok' });
  });

  it('renders customer name and phone', () => {
    const { getByText } = render(<Profile />);
    expect(getByText('राम कुमार')).toBeTruthy();
  });

  it('DPDPA delete button shows the 501 not-yet-available message', async () => {
    mock.onDelete('/api/v1/customer/me').reply(501, { code: 'deletion.customer_app_not_yet_available' });
    const { getByTestId, findByTestId } = render(<Profile />);
    fireEvent.click(getByTestId('profile-delete-button'));
    const banner = await findByTestId('profile-delete-result');
    expect(banner.textContent).toMatch(/जल्द|coming/i);
  });
});
```

- [ ] **Step 4: Run test (red)**

Run: `pnpm --filter @goldsmith/customer-mobile test -- profile`
Expected: FAIL.

- [ ] **Step 5: Implement `profile.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { LoyaltyPointsCard } from '../../src/components/LoyaltyPointsCard';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { customerSelfDelete } from '../../src/api/endpoints';

export default function Profile(): React.ReactElement {
  const { customer, signOut } = useCustomerSession();
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onDelete = async (): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    setResultMsg(null);
    try {
      await customerSelfDelete();
      setResultMsg('अनुरोध स्वीकार हुआ');
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      if (code === 'deletion.customer_app_not_yet_available') {
        setResultMsg('जल्द आ रहा है। (coming soon)');
      } else {
        setResultMsg('अभी संभव नहीं है। बाद में पुनः प्रयास करें।');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <Text style={{ fontFamily: typography.display.family, fontSize: 22, color: colors.ink }}>
          {customer?.name ?? '-'}
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginTop: spacing.xs }}>
          {customer?.phoneE164 ?? ''}
        </Text>
      </View>

      <LoyaltyPointsCard />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Pressable
          testID="profile-delete-button"
          onPress={onDelete}
          disabled={deleting}
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: typography.body.family,
              fontSize: 16,
              color: '#8C2A1E',
              textAlign: 'center',
            }}
          >
            डेटा हटाएं (Delete my data)
          </Text>
        </Pressable>

        {resultMsg !== null ? (
          <View
            testID="profile-delete-result"
            style={{
              marginTop: spacing.sm,
              padding: spacing.sm,
              backgroundColor: colors.bg,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>{resultMsg}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Pressable
          testID="profile-signout-button"
          onPress={() => { void signOut(); }}
          style={{
            paddingVertical: spacing.md,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.inkMute, textAlign: 'center' }}>
            लॉग आउट
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Run tests (green)**

Run: `pnpm --filter @goldsmith/customer-mobile test`
Expected: all green (~22+ tests).

- [ ] **Step 7: Commit**

```bash
git add apps/customer-mobile/app/\(tabs\)
git commit -m "feat(customer-mobile): browse + wishlist placeholders + profile"
```

**Commit message summary for WS-D:** `feat(customer-mobile): home + profile screens`

---

### WS-E: Quality Gate

**Depends on:** WS-A + WS-B + WS-C + WS-D all complete
**Done when:** typecheck/lint/tests all green at workspace root; `codex review --base main` exits 0; `.codex-review-passed` written; runtime smoke checklist completed; branch pushed.

#### Task E1: Workspace-wide quality checks

- [ ] **Step 1: Run typecheck across workspace**

Run: `cd /c/gs-cust-mob && pnpm typecheck`
Expected: 0.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: 0. Common Windows quirk: ESLint resolution may fail if a workspace package needs `pnpm build` first — re-run pre-flight builds (see top of plan) and try again.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: all packages green; the new `@goldsmith/customer-mobile` package contributes ~22 tests.

- [ ] **Step 4: Verify SecureStore-not-AsyncStorage invariant**

Run: `grep -rn "AsyncStorage" /c/gs-cust-mob/apps/customer-mobile/src /c/gs-cust-mob/apps/customer-mobile/app`
Expected: zero matches. (AsyncStorage in `package.json` is fine — it's a transitive dep of Firebase. The check is for *first-party* usage in our auth path.)

- [ ] **Step 5: Verify white-label invariant**

Run: `grep -rn "Goldsmith" /c/gs-cust-mob/apps/customer-mobile/app /c/gs-cust-mob/apps/customer-mobile/src 2>/dev/null | grep -v "@goldsmith/"`
Expected: zero matches. The `@goldsmith/*` workspace imports are internal package scope; not user-visible.

#### Task E2: Codex review

- [ ] **Step 1: Run codex**

Run: `cd /c/gs-cust-mob && codex review --base main`
Expected: review completes; either passes outright or returns findings.

- [ ] **Step 2: Address any P1/P2 findings**

Apply targeted fixes per finding. Re-run codex until clean. Reclassify to A and HOLD if codex flags an auth/RLS/money concern that the plan didn't anticipate.

- [ ] **Step 3: Write the marker**

```bash
echo "passed at $(date -u +%FT%TZ)" > /c/gs-cust-mob/.codex-review-passed
git add .codex-review-passed
git commit -m "chore: codex review passed — feat/epic7-customer-mobile-scaffold"
```

#### Task E3: Runtime smoke

For Class B, runtime smoke is mandatory before push (per CLAUDE.md non-negotiable floor).

- [ ] **Step 1: Web export smoke (fastest path on Windows)**

Run: `cd /c/gs-cust-mob && pnpm --filter @goldsmith/customer-mobile export`
Expected: `apps/customer-mobile/dist/index.html` is created; no Metro errors. Open the index.html in a browser, check that the welcome screen renders and (with `EXPO_PUBLIC_DEV_AUTH=1` rebuild) the dev-continue button takes the user to the tab bar with the rate card visible.

- [ ] **Step 2 (optional, time-permitting): Android device smoke from short-path build copy**

Per the project CLAUDE.md "Android smoke test — known Windows issues" section: the worktree path `C:\Alok\Business Projects\Goldsmith\.worktrees\<branch>` exceeds Windows MAX_PATH for the customer-mobile build artifacts. If exercising on Android device:

```
xcopy /E /I "C:\gs-cust-mob" C:\gscm
# In C:\gscm\.npmrc only (NEVER in the real worktree):
echo public-hoist-pattern[]=* >> C:\gscm\.npmrc
cd C:\gscm
echo y | pnpm install
EXPO_PUBLIC_DEV_AUTH=1 EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 pnpm --filter @goldsmith/customer-mobile android
```

This step is best-effort; web smoke + unit tests cover the golden path. The Class B floor is satisfied with a successful web export + verified UI flow.

- [ ] **Step 3: Manual smoke checklist (web)**

Verify in the browser tab opened from `dist/index.html`:
- Welcome screen renders with tenant name from boot fetch
- "Phone OTP coming soon" copy visible when `EXPO_PUBLIC_DEV_AUTH` not set
- With dev mode rebuild: pressing "जारी रखें (Dev)" routes to tabs
- Home shows rate card (live or "अभी उपलब्ध नहीं" on API failure)
- Empty product grid shows the Hindi empty-state message
- Categories scroll horizontally
- Profile shows mock customer name + phone, loyalty card stub
- Pressing "डेटा हटाएं" shows the "जल्द आ रहा है" copy (since `/customer/me` returns 501)
- Pressing "लॉग आउट" returns to welcome screen
- No occurrence of the word "Goldsmith" anywhere in the rendered DOM

#### Task E4: Push

- [ ] **Step 1: Final status check**

Run: `git -C /c/gs-cust-mob status && git -C /c/gs-cust-mob log --oneline main..HEAD`
Expected: working tree clean; ~10–14 commits ahead of main.

- [ ] **Step 2: Push branch**

```bash
git -C /c/gs-cust-mob push -u origin feat/epic7-customer-mobile-scaffold
```

Expected: branch published; CI starts.

- [ ] **Step 3: Update MEMORY.md**

Add an entry to `C:\Users\alokt\.claude\projects\C--Alok-Business-Projects-Goldsmith\memory\` describing what landed AND the deferred Class A follow-up.

**Commit message summary for WS-E:** `chore: codex review + runtime smoke for customer-mobile scaffold`

---

## Acceptance Criteria Traceability

| AC | Source | Work Stream | Test Coverage |
|----|--------|-------------|---------------|
| AC-1: New Expo app at `apps/customer-mobile/` builds | prompt §1 | WS-A | `pnpm --filter @goldsmith/customer-mobile export` produces dist |
| AC-2: NativeWind + Devanagari fonts wired | prompt §1, CLAUDE.md design | WS-A T3, T4 | font preload in `_layout.tsx`; tailwind config |
| AC-3: Tenant theme resolved on launch via boot endpoint | prompt §2 | WS-B | `TenantProvider.test.tsx` |
| AC-4: White-label invariant — no Goldsmith brand visible | prompt §2 + CLAUDE.md | WS-B + WS-E | `TenantBrandHeader.test.tsx`, grep gate in WS-E T1 step 5 |
| AC-5: Auth flow scaffolded; dev-mode session works | prompt §3 (modified per Path 1) | WS-C | `CustomerAuthProvider.test.tsx` + `useCustomerSession.test.tsx` |
| AC-6: Bearer token in SecureStore (never AsyncStorage) | prompt + CLAUDE.md | WS-C T1 + WS-E T1 step 4 | `secure-storage.test.ts` + grep gate |
| AC-7: Home screen — rates, products grid, categories | prompt §4 | WS-D T1, T2, T3 | `RateCard.test.tsx`, `ProductGrid.test.tsx` |
| AC-8: Tab navigation with 4 tabs | prompt §5 | WS-D T3, T4 | tabs `_layout.tsx` |
| AC-9: Profile — name/phone, loyalty stub, DPDPA delete button | prompt §6 | WS-D T4 | `profile.test.tsx` |
| AC-10: Migration 0048 NOT created (push deferred) | reclassification call | (none) | confirmed in commit log |

---

## Reclassification Gate

> **Reminder:** if mid-execution we discover a new auth path, money/RLS column, compliance gate, or any migration touching SECURITY DEFINER — **STOP**. This branch is intentionally scoped to AVOID those surfaces. Real customer auth, customer push tokens, and customer-side compliance flows are deferred to follow-up Class A stories. Adding any of them mid-stream means: new fresh session, new plan, new ceremony.

## Follow-up stories surfaced by this plan

These should be filed in the BMAD epic-7 tracker before this branch merges:

1. **EPIC7-S1 — Customer Phone OTP (Class A).** Migration 0048 (or next-available) adds `customers.firebase_uid TEXT` + unique partial index. New SQL function `customer_lookup_by_phone_and_shop`. Extend `auth.service.ts` with a customer fallback path that requires `x-tenant-id` header (since customer phones aren't globally unique across tenants). New `RolesGuard` carve-out for customer-role tokens. Implement `DELETE /customer/me` (currently 501 stub at `crm.controller.ts:190`). 5–7 work streams, full Codex + security review.
2. **EPIC7-S2 — Customer Wishlist (Class B).** Wave 5E in MEMORY says this exists; this plan stubs the route.
3. **EPIC7-S3 — Customer Push Notifications (Class B).** Reclaim the pre-assigned migration `0048` for `customer_device_tokens` table. FCM token registration, NestJS endpoint to upsert tokens, BullMQ job for delivery.
