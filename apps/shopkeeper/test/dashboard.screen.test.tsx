import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { setLocale } from '@goldsmith/i18n';

vi.mock('expo-router', () => ({
  router: { replace: vi.fn(), push: vi.fn() },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  Redirect: (): null => null,
}));

vi.mock('../src/api/client', () => ({
  api: { get: vi.fn() },
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
  it('renders operational shortcuts when tenant loaded', () => {
    useTenantStore.setState({
      slug: 'test-shop',
      tenant: {
        id: 't1',
        slug: 'test-shop',
        displayName: 'Sona Jewellers',
        branding: {},
      },
      etag: null,
      loading: false,
      error: null,
    });

    const { container } = render(<Dashboard />);
    expect(container.textContent).toContain('Sona Jewellers');
    expect(container.textContent).toContain('नया बिल');
    expect(container.textContent).toContain('इन्वेंटरी खोजें');
    expect(container.textContent).toContain('आज');
    expect(container.textContent).toContain('स्टाफ');
    expect(container.textContent).toContain('ग्राहक');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
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
    const skeletons = getAllByTestId(/dashboard-skeleton/);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('does NOT render "Goldsmith" text on customer-facing surfaces (no platform brand leakage)', () => {
    useTenantStore.setState({
      slug: 'test-shop',
      tenant: {
        id: 't1',
        slug: 'test-shop',
        displayName: 'Sona Jewellers',
        branding: {},
      },
      etag: null,
      loading: false,
      error: null,
    });

    const { container } = render(<Dashboard />);
    expect(container.textContent).not.toMatch(/\bGoldsmith\b/);
  });
});
