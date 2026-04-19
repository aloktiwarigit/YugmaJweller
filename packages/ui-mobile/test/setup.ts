import { expect } from 'vitest';
import { toHaveMinTouchTarget } from '../src/matchers/toHaveMinTouchTarget';

expect.extend({ toHaveMinTouchTarget });

declare module 'vitest' {
  interface Assertion {
    toHaveMinTouchTarget(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveMinTouchTarget(): void;
  }
}
