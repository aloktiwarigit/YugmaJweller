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

// Mock expo-router — LoyaltyPointsCard uses useRouter for navigation.
vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
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
