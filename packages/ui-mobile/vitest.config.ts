import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      'react-native': path.join(__dirname, './test/react-native.mock.ts'),
    },
  },
});
