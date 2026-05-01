import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: {
    // Use a vitest-only tsconfig override so vite's esbuild does not load
    // expo/tsconfig.base (which app/runtime tsconfig.json extends).
    tsconfigRaw: {
      compilerOptions: {
        target: 'ES2022',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    // Tests live under test/ and src/ only. We deliberately do NOT include
    // app/**/*.test.* — Expo Router treats every app/**/*.tsx as a route,
    // so colocating tests there leaks vitest/test-only deps into the bundle
    // and exposes a phantom route. A test for an app/ screen lives in
    // test/ and imports the screen relatively (see test/profile.test.tsx).
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      'react-native': fileURLToPath(new URL('./test/react-native.mock.ts', import.meta.url)),
    },
  },
});
