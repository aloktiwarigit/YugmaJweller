import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { api } from '../../src/api/client';
import { useCustomerSessionStore } from '../../src/stores/customerSessionStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { makeCustomer, makeTenant } from '../../test/factories';
import Profile from './profile';

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
    const { getByText } = render(<Profile />);
    expect(getByText('राम कुमार')).toBeTruthy();
  });

  it('DPDPA delete button shows the 501 not-yet-available message', async () => {
    mock.onDelete('/api/v1/customer/me').reply(501, {
      code: 'deletion.customer_app_not_yet_available',
    });
    const { getByTestId, findByTestId } = render(<Profile />);
    fireEvent.click(getByTestId('profile-delete-button'));
    const banner = await findByTestId('profile-delete-result');
    expect(banner.textContent).toMatch(/जल्द|coming/i);
  });
});
