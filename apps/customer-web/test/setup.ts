// apps/customer-web/test/setup.ts
//
// Vitest setup file for customer-web UI tests.
// Runs for files matched by environmentMatchGlobs (test/**/*.test.tsx).
// Uses the /vitest entry — the package root augments Jest's matcher types,
// not Vitest's `Assertion`. Without /vitest, `tsc --noEmit` fails on
// `.toBeInTheDocument()` / `.toBeDisabled()` inside test files (the
// customer-web tsconfig includes **/*.tsx).

import '@testing-library/jest-dom/vitest';
