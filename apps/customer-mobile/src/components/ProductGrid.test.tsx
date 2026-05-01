import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { api } from '../api/client';
import { ProductGrid } from './ProductGrid';

function wrap(): React.FC<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ProductGrid', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  it('shows empty-state copy when API returns no items', async () => {
    mock.onGet('/api/v1/catalog/products').reply(200, { items: [], total: 0, tenantId: 't' });
    const Wrapper = wrap();
    const { getByTestId } = render(<ProductGrid />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(getByTestId('product-grid-empty')).toBeTruthy();
    });
  });
});
