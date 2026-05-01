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
    // API returns flat snake_case `{ id, display_name, config: { primary_color, app_name, ... } }`;
    // getTenantBoot adapts it to the mobile `Tenant` shape before storing.
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      {
        id: t.id,
        display_name: t.displayName,
        config: {
          app_name: t.branding.appName,
          default_language: t.branding.defaultLanguage,
          primary_color: t.branding.primaryColor,
        },
      },
      { etag: '"v1"' },
    );

    render(<TenantProvider><span>x</span></TenantProvider>);

    await waitFor(() => {
      expect(useTenantStore.getState().tenant?.id).toBe(t.id);
    });
    expect(useTenantStore.getState().tenant?.displayName).toBe(t.displayName);
    expect(useTenantStore.getState().tenant?.branding.appName).toBe(t.branding.appName);
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
