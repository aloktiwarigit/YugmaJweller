import { defineConfig } from 'vitest/config';

export default defineConfig({
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
