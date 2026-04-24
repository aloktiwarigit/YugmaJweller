import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve from source so `test:unit` runs without a prior build of compliance
      '@goldsmith/compliance': fileURLToPath(
        new URL('../compliance/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
  },
});
