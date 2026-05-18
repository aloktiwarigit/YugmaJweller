import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the Next.js `@/*` → `./*` path alias so vitest can resolve
      // component imports like `@/app/TenantContext`, `@/lib/api`, etc.
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // Default to node for server-side tests (Sentry init, etc.).
    // UI tests in test/ use the jsdom environment via environmentMatchGlobs.
    environment: 'node',
    environmentMatchGlobs: [
      // All test/ files that render React components need jsdom.
      ['test/**/*.test.tsx', 'jsdom'],
    ],
    // globals: true makes vitest inject expect/describe/it globally,
    // which is required for @testing-library/jest-dom to extend expect.
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
  },
});
