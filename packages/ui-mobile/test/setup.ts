import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveMinTouchTarget } from '../src/matchers/toHaveMinTouchTarget';

// Clean up DOM between tests so data-testid lookups don't find stale elements
afterEach(() => {
  cleanup();
});

expect.extend({ toHaveMinTouchTarget });

declare module 'vitest' {
  interface Assertion {
    toHaveMinTouchTarget(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveMinTouchTarget(): void;
  }
}
