import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
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
    },
  },
});
