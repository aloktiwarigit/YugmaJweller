import { vi } from 'vitest';
import React from 'react';

vi.mock('expo-image', () => ({
  Image: ({ source, accessibilityLabel, ...rest }: {
    source?: { uri?: string } | string;
    accessibilityLabel?: string;
  }) => {
    const src = typeof source === 'string' ? source : source?.uri;
    return React.createElement('img', { ...rest, src, alt: accessibilityLabel });
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

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
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    __reset: (): void => store.clear(),
  };
});

// Mock @react-native-firebase/auth.
// onAuthStateChanged immediately fires with null (no user) so the production
// auth path exercises the not-signed-in branch during unit tests.
vi.mock('@react-native-firebase/auth', () => ({
  default: () => ({
    signInWithPhoneNumber: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn((cb: (user: null) => void) => {
      cb(null);
      return (): void => undefined;
    }),
    onIdTokenChanged: vi.fn((cb: (user: null) => void) => {
      cb(null);
      return (): void => undefined;
    }),
  }),
}));

// Mock expo-router — LoyaltyPointsCard uses useRouter for navigation.
vi.mock('expo-router', () => ({
  router:    { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  useLocalSearchParams: vi.fn(() => ({})),
  Redirect:  vi.fn(() => null),
  Tabs:      { Screen: vi.fn(() => null) },
}));

// Mock @react-native-async-storage/async-storage with an in-memory map.
// Defensive — no first-party code in this app uses AsyncStorage (we use SecureStore
// per the auth-token invariant), but transitive deps may require it at module load.
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});
