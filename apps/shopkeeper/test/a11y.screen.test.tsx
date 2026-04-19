// Accessibility test harness — runs axe-core against the DOM-shim render output
// (see test/react-native.mock.ts). This covers structural a11y (roles, labels,
// contrast resolved via inline styles). Real RN native a11y (TalkBack focus order,
// dynamic font scaling) is validated manually + in the Maestro e2e job.
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { setLocale } from '@goldsmith/i18n';

// Reuse existing mocks from Task 19
vi.mock('@goldsmith/auth-client', () => ({
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue(null),
  auth: (): unknown => ({}),
}));
vi.mock('expo-router', () => ({
  router: { replace: vi.fn(), push: vi.fn() },
  useRouter: (): unknown => ({ replace: vi.fn(), push: vi.fn() }),
  Redirect: (): null => null,
}));

import Phone from '../app/(auth)/phone';
import Dashboard from '../app/(tabs)/index';
import { useTenantStore } from '../src/stores/tenantStore';

beforeEach(() => {
  setLocale('hi-IN');
  useTenantStore.setState({
    slug: 'anchor-dev',
    tenant: {
      id: 't1',
      slug: 'anchor-dev',
      displayName: 'अयोध्या स्वर्णकार',
      branding: { primaryColor: '#B58A3C' },
    },
    etag: null,
    loading: false,
    error: null,
  });
});

async function expectNoA11yViolations(el: Element): Promise<void> {
  const results = await axe.run(el, {
    runOnly: ['wcag2a', 'wcag2aa'],
    // The DOM shim uses <pressable>, <view>, <text>, <input>. Real axe rules
    // target standard HTML tags, so some rules will be irrelevant here.
    // We treat critical + serious violations as failures.
  });
  const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  if (severe.length > 0) {
    // eslint-disable-next-line no-console -- diagnostic output on failure @why
    console.error('a11y violations:', JSON.stringify(severe, null, 2));
  }
  expect(severe).toHaveLength(0);
}

describe('axe-core a11y — shopkeeper screens (DOM-shim subset)', () => {
  it('phone screen has zero critical/serious WCAG 2.1 AA violations', async () => {
    const { container } = render(<Phone />);
    await expectNoA11yViolations(container);
  });
  it('dashboard screen has zero critical/serious WCAG 2.1 AA violations', async () => {
    const { container } = render(<Dashboard />);
    await expectNoA11yViolations(container);
  });
});
