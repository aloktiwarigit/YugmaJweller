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
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      'react-native': fileURLToPath(new URL('./test/react-native.mock.ts', import.meta.url)),
    },
  },
});
