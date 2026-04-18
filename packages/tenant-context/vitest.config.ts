import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // No unit tests live in src/ for this package (integration tests are in test/).
      // Thresholds are effectively waived here; coverage is enforced via test:integration.
      thresholds: { lines: 0, statements: 0, functions: 0, branches: 0 },
      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
    },
  },
});
