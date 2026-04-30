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
