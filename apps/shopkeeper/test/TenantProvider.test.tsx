import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useTenantStore } from '../src/stores/tenantStore';
import asyncStorageMock from './async-storage.mock';

// Mock the axios client before importing the provider
vi.mock('../src/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../src/api/client';
import { TenantProvider } from '../src/providers/TenantProvider';

const mockTenant = {
  id: 'tenant-1',
  slug: 'anchor-dev',
  displayName: 'Anchor Jewellers',
  branding: { primaryColor: '#B8860B', defaultLanguage: 'hi-IN' as const },
};

describe('TenantProvider', () => {
  beforeEach(() => {
    useTenantStore.setState({
      slug: null,
      tenant: null,
      etag: null,
      loading: true,
      error: null,
    });
    asyncStorageMock.__reset();
    vi.clearAllMocks();
  });

  it('fetches tenant on first mount and stores in state + AsyncStorage', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      data: mockTenant,
      headers: { etag: '"v1"' },
    });

    await act(async () => {
      render(<TenantProvider>{null}</TenantProvider>);
    });

    const s = useTenantStore.getState();
    expect(s.tenant?.slug).toBe('anchor-dev');
    expect(s.etag).toBe('"v1"');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();

    // Verify persisted to AsyncStorage
    const cached = await asyncStorageMock.getItem('tenant-boot:anchor-dev');
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached!);
    expect(parsed.tenant.slug).toBe('anchor-dev');
    expect(parsed.etag).toBe('"v1"');
  });

  it('uses cached tenant immediately and skips update on 304', async () => {
    // Pre-populate cache
    await asyncStorageMock.setItem(
      'tenant-boot:anchor-dev',
      JSON.stringify({ tenant: mockTenant, etag: '"v1"' }),
    );

    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 304,
      data: null,
      headers: {},
    });

    await act(async () => {
      render(<TenantProvider>{null}</TenantProvider>);
    });

    const s = useTenantStore.getState();
    // Cached tenant should be present; 304 means no update
    expect(s.tenant?.slug).toBe('anchor-dev');
    expect(s.loading).toBe(false);
    // api.get called with If-None-Match header
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('/tenant/boot'),
      expect.objectContaining({ headers: { 'If-None-Match': '"v1"' } }),
    );
  });

  it('sets error when API call fails', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network Error'));

    await act(async () => {
      render(<TenantProvider>{null}</TenantProvider>);
    });

    const s = useTenantStore.getState();
    expect(s.error).toBe('Network Error');
    expect(s.loading).toBe(false);
  });
});
