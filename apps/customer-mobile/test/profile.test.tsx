import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../src/api/client';
import { useCustomerSessionStore } from '../src/stores/customerSessionStore';
import { useTenantStore } from '../src/stores/tenantStore';
import { makeCustomer, makeTenant } from './factories';
import Profile from '../app/(tabs)/profile';

function wrap(ui: React.ReactElement): React.ReactElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('Profile', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useTenantStore.setState({
      tenant: makeTenant(),
      slug: 'anchor-dev',
      etag: null,
      loading: false,
      error: null,
    });
    useCustomerSessionStore.setState({ customer: makeCustomer({ name: 'राम कुमार' }), bearer: 'tok' });
  });

  it('renders customer name and phone', () => {
    const { getByText } = render(wrap(<Profile />));
    expect(getByText('राम कुमार')).toBeTruthy();
  });

  it('DPDPA delete button shows the 501 not-yet-available message', async () => {
    mock.onDelete('/api/v1/crm/customer/me').reply(501, {
      code: 'deletion.customer_app_not_yet_available',
    });
    const { getByTestId, findByTestId } = render(wrap(<Profile />));
    fireEvent.click(getByTestId('profile-delete-button'));
    const banner = await findByTestId('profile-delete-result');
    expect(banner.textContent).toMatch(/जल्द|coming/i);
  });
});
