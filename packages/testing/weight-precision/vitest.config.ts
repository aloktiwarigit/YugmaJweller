import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve from source so the harness runs without prior builds
      '@goldsmith/money': fileURLToPath(
        new URL('../../money/src/index.ts', import.meta.url),
      ),
      '@goldsmith/compliance': fileURLToPath(
        new URL('../../compliance/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
  },
});
