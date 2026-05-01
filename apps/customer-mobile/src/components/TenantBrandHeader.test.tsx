import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TenantBrandHeader } from './TenantBrandHeader';
import { useTenantStore } from '../stores/tenantStore';
import { makeTenant } from '../../test/factories';

describe('TenantBrandHeader', () => {
  beforeEach(() => {
    useTenantStore.setState({ tenant: null, slug: null, etag: null, loading: false, error: null });
  });

  it('renders nothing while tenant is loading', () => {
    useTenantStore.setState({ loading: true });
    const { container } = render(<TenantBrandHeader />);
    expect(container.querySelector('[data-testid="tenant-brand-header"]')).toBeNull();
  });

  it('renders tenant displayName once loaded', () => {
    useTenantStore.setState({ tenant: makeTenant({ displayName: 'टेस्ट दुकान' }) });
    const { getByTestId } = render(<TenantBrandHeader />);
    expect(getByTestId('tenant-brand-name').textContent).toBe('टेस्ट दुकान');
  });

  it('does NOT contain the string "Goldsmith" (white-label invariant)', () => {
    useTenantStore.setState({ tenant: makeTenant({ displayName: 'टेस्ट दुकान' }) });
    const { container } = render(<TenantBrandHeader />);
    expect(container.textContent ?? '').not.toMatch(/Goldsmith/i);
  });
});
