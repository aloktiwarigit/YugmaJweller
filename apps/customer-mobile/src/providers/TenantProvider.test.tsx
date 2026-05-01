import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { api } from '../api/client';
import { useTenantStore } from '../stores/tenantStore';
import { TenantProvider } from './TenantProvider';
import { makeTenant } from '../../test/factories';

describe('TenantProvider', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: true, error: null });
  });

  it('boots tenant from /tenant/boot and stores it', async () => {
    const t = makeTenant();
    // API returns snake_case `{ id, display_name, config }`; getTenantBoot
    // adapts it to the mobile `Tenant` shape before storing.
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      { id: t.id, display_name: t.displayName, config: { branding: t.branding } },
      { etag: '"v1"' },
    );

    render(<TenantProvider><span>x</span></TenantProvider>);

    await waitFor(() => {
      expect(useTenantStore.getState().tenant?.id).toBe(t.id);
    });
    expect(useTenantStore.getState().tenant?.displayName).toBe(t.displayName);
    expect(useTenantStore.getState().etag).toBe('"v1"');
    expect(useTenantStore.getState().loading).toBe(false);
  });

  it('sets error state on network failure', async () => {
    mock.onGet('/api/v1/tenant/boot').networkError();
    render(<TenantProvider><span>x</span></TenantProvider>);
    await waitFor(() => {
      expect(useTenantStore.getState().error).toBeTruthy();
    });
  });
});
