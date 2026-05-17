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

  it('renders tenant displayName once loaded (when branding.appName is unset)', () => {
    useTenantStore.setState({
      tenant: makeTenant({
        displayName: 'टेस्ट दुकान',
        branding: { primaryColor: '#000', logoUrl: undefined, appName: undefined, defaultLanguage: 'hi-IN' },
      }),
    });
    const { getByTestId } = render(<TenantBrandHeader />);
    expect(getByTestId('tenant-brand-name').textContent).toBe('टेस्ट दुकान');
  });

  it('prefers branding.appName over displayName when set (white-label override)', () => {
    useTenantStore.setState({
      tenant: makeTenant({
        displayName: 'Back-Office Shop Name',
        branding: { primaryColor: '#000', logoUrl: undefined, appName: 'दुकानदार ऐप', defaultLanguage: 'hi-IN' },
      }),
    });
    const { getByTestId } = render(<TenantBrandHeader />);
    expect(getByTestId('tenant-brand-name').textContent).toBe('दुकानदार ऐप');
  });

  it('renders a visible fallback mark when tenant logo is missing', () => {
    useTenantStore.setState({
      tenant: makeTenant({
        displayName: 'श्री राम ज्वैलर्स',
        branding: { primaryColor: '#000', logoUrl: undefined, appName: undefined, defaultLanguage: 'hi-IN' },
      }),
    });
    const { getByTestId } = render(<TenantBrandHeader />);
    expect(getByTestId('tenant-brand-fallback-mark').textContent).toBe('श्री');
  });

  it('renders an absolute tenant logo URL when provided', () => {
    useTenantStore.setState({
      tenant: makeTenant({
        displayName: 'टेस्ट दुकान',
        branding: {
          primaryColor: '#000',
          logoUrl: 'https://cdn.example/logo.png',
          appName: undefined,
          defaultLanguage: 'hi-IN',
        },
      }),
    });
    const { container } = render(<TenantBrandHeader />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/logo.png');
    expect(container.querySelector('[data-testid="tenant-brand-fallback-mark"]')).toBeNull();
  });

  it('does NOT contain the string "Goldsmith" (white-label invariant)', () => {
    useTenantStore.setState({ tenant: makeTenant({ displayName: 'टेस्ट दुकान' }) });
    const { container } = render(<TenantBrandHeader />);
    expect(container.textContent ?? '').not.toMatch(/Goldsmith/i);
  });
});
