import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // endpoint-walker.e2e.test.ts requires a fresh Firebase Auth emulator and must
    // run in isolation (pnpm test:e2e). When run as part of the full suite, prior
    // auth test files leave the emulator in a shared state that causes token
    // verification to fail. The test is also skipped in CI (CI=true guard in the
    // test file). Run it standalone: pnpm --filter @goldsmith/api test:e2e
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/endpoint-walker.e2e.test.ts',
    ],
  },
});
