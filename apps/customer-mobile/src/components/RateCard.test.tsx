import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { api } from '../api/client';
import { RateCard } from './RateCard';

function wrap(): { wrapper: React.FC<{ children: React.ReactNode }>; client: QueryClient } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

describe('RateCard', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  it('renders 22K rate from API', async () => {
    mock.onGet('/api/v1/catalog/rates').reply(200, {
      GOLD_24K: { perGramRupees: '7500.00', formattedINR: '₹7,500.00', fetchedAt: '2026-04-30T00:00:00Z' },
      GOLD_22K: { perGramRupees: '6900.00', formattedINR: '₹6,900.00', fetchedAt: '2026-04-30T00:00:00Z' },
      SILVER_999: { perGramRupees: '90.00', formattedINR: '₹90.00', fetchedAt: '2026-04-30T00:00:00Z' },
      stale: false,
      source: 'IBJA',
      refreshedAt: '2026-04-30T00:00:00Z',
    });
    const { wrapper } = wrap();
    const { getByTestId } = render(<RateCard />, { wrapper });
    await waitFor(() => {
      expect(getByTestId('rate-22k').textContent).toContain('₹6,900.00');
    });
  });

  it('renders unavailable copy on 503', async () => {
    mock.onGet('/api/v1/catalog/rates').reply(503, { code: 'rates.unavailable', stale: true });
    const { wrapper } = wrap();
    const { getByTestId } = render(<RateCard />, { wrapper });
    await waitFor(() => {
      expect(getByTestId('rate-card-error')).toBeTruthy();
    });
  });
});
