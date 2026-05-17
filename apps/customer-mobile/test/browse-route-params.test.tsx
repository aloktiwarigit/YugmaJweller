import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { getCatalogProducts } from '../src/api/endpoints';

vi.mock('../src/components/TenantBrandHeader', () => ({
  TenantBrandHeader: () => <div data-testid="tenant-brand-header" />,
}));

vi.mock('../src/components/FilterSheet', () => ({
  FilterSheet: () => null,
  SortModal:   () => null,
}));

vi.mock('../src/api/endpoints', () => ({
  getCatalogProducts: vi.fn(),
}));

import Browse from '../app/(tabs)/browse';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Browse route params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCatalogProducts).mockResolvedValue({ items: [], total: 0, page: 1 });
  });

  it('applies category link query params to the catalog request', async () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({
      style:       'BRIDAL',
      search:      'necklace',
      inStockOnly: 'true',
      sort:        'priceDesc',
      page:        '2',
    });

    render(<Browse />, { wrapper });

    await waitFor(() => {
      expect(getCatalogProducts).toHaveBeenCalledWith(expect.objectContaining({
        style:       'BRIDAL',
        search:      'necklace',
        inStockOnly: true,
        sort:        'priceDesc',
        page:        2,
        limit:       12,
      }));
    });
  });

  it('maps gift-persona links to usable mobile filters', async () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({ giftPersona: 'BRIDE' });

    render(<Browse />, { wrapper });

    await waitFor(() => {
      expect(getCatalogProducts).toHaveBeenCalledWith(expect.objectContaining({
        style: 'BRIDAL',
      }));
    });
  });
});
