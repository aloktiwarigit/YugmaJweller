import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';

// Mock expo-router (no navigation in dashboard, but screens import it for type safety)
vi.mock('expo-router', () => ({
  router: { replace: vi.fn(), push: vi.fn() },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  Redirect: (): null => null,
}));

import Dashboard from '../app/(tabs)/index';
import { useTenantStore } from '../src/stores/tenantStore';

beforeEach(() => {
  setLocale('hi-IN');
  useTenantStore.setState({
    slug: null,
    tenant: null,
    etag: null,
    loading: false,
    error: null,
  });
});

describe('(tabs)/index.tsx (dashboard)', () => {
  it('renders Hindi eyebrow + headline + two CTAs when tenant loaded', () => {
    useTenantStore.setState({
      slug: 'test-shop',
      tenant: {
        id: 't1',
        slug: 'test-shop',
        displayName: 'सोना ज्वेलर्स',
        branding: {},
      },
      etag: null,
      loading: false,
      error: null,
    });

    const { getByText } = render(<Dashboard />);
    // Eyebrow
    expect(getByText('स्वागत है')).toBeTruthy();
    // Headline
    expect(getByText('आइए, अपना shop set up करें')).toBeTruthy();
    // Two CTAs
    expect(getByText('Staff जोड़ें')).toBeTruthy();
    expect(getByText('सेटिंग्स में जाएँ')).toBeTruthy();
  });

  it('renders Skeleton placeholder when tenant is null (loading state)', () => {
    useTenantStore.setState({
      slug: null,
      tenant: null,
      etag: null,
      loading: true,
      error: null,
    });

    const { getAllByTestId } = render(<Dashboard />);
    // Should render skeleton placeholders
    const skeletons = getAllByTestId(/dashboard-skeleton/);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('does NOT render "Goldsmith" text on customer-facing surfaces (no platform brand leakage)', () => {
    useTenantStore.setState({
      slug: 'test-shop',
      tenant: {
        id: 't1',
        slug: 'test-shop',
        displayName: 'सोना ज्वेलर्स',
        branding: {},
      },
      etag: null,
      loading: false,
      error: null,
    });

    const { container } = render(<Dashboard />);
    // The dashboard is the shopkeeper-facing surface — platform brand must never appear
    // The displayName shown must be the jeweller's name, not "Goldsmith"
    expect(container.textContent).not.toMatch(/\bGoldsmith\b/);
  });
});
