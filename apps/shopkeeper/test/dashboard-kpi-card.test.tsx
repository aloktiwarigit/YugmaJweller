import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@goldsmith/ui-mobile', () => ({
  Skeleton:   ({ testID }: { testID?: string }) =>
    React.createElement('skeleton', { 'data-testid': testID }),
  Button:     () => null,
  Toast:      () => null,
  RateWidget: () => null,
}));

import { api } from '../src/api/client';
import { DashboardKpiCard } from '../src/components/DashboardKpiCard';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('DashboardKpiCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders total_paise formatted as rupees and invoice_count on success', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        date:          '2026-05-05',
        total_paise:   '250000',
        cash_paise:    '100000',
        invoice_count: 3,
      },
    });

    const { container } = render(<DashboardKpiCard />, { wrapper });
    await waitFor(() => {
      expect(container.textContent).toContain('2,500');
    });
    expect(container.textContent).toContain('3');
  });

  it('renders null on API error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('server error'));

    const { container } = render(<DashboardKpiCard />, { wrapper });
    await waitFor(() => {
      // On error, component returns null — container only has the wrapper div
      expect(container.querySelector('[data-testid="kpi-sales-value"]')).toBeNull();
    });
  });
});
