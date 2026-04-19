import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Clean up DOM between tests
afterEach(() => {
  cleanup();
});
