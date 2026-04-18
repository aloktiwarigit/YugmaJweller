import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Only enforce thresholds on the files that have unit tests.
      // sentry.ts / logger.ts / otel.ts are infrastructure wrappers tested via integration.
      include: ['src/pii-redactor.ts'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      exclude: ['**/dist/**', '**/*.config.*', '**/fixtures/**'],
    },
  },
});
