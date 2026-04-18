import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Enforce thresholds only on schema helpers (well-covered).
      // codegen files have partial coverage; full coverage is a TODO for a dedicated
      // codegen test suite. DB connection files (index/migrate/provider/tx) require a
      // live Postgres instance and are covered by integration tests.
      include: ['src/schema/_helpers/**/*.ts'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
    },
  },
});
