import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: {
    // Use the vitest tsconfig which does not extend expo/tsconfig.base
    // so vite's esbuild transform does not fail on the missing expo package.
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
    globals: false,
  },
  resolve: {
    alias: {
      'react-native': fileURLToPath(new URL('./test/react-native.mock.ts', import.meta.url)),
      '@react-native-firebase/auth': fileURLToPath(
        new URL('./test/firebase-auth.mock.ts', import.meta.url),
      ),
      '@react-native-async-storage/async-storage': fileURLToPath(
        new URL('./test/async-storage.mock.ts', import.meta.url),
      ),
      'expo-constants': fileURLToPath(
        new URL('./test/expo-constants.mock.ts', import.meta.url),
      ),
      'expo-router': fileURLToPath(
        new URL('./test/expo-router.mock.ts', import.meta.url),
      ),
      '@goldsmith/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
      '@goldsmith/i18n': fileURLToPath(
        new URL('../../packages/i18n/src/index.ts', import.meta.url),
      ),
    },
  },
});
