import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/endpoints', () => ({
  getPurchases:          vi.fn(),
  getCustomOrders:       vi.fn(),
  getRateLockBookings:   vi.fn(),
  getTryAtHomeBookings:  vi.fn(),
}));

import {
  getPurchases, getCustomOrders, getRateLockBookings, getTryAtHomeBookings,
} from '../api/endpoints';
import {
  usePurchases, useCustomOrders, useRateLocks, useTryAtHomeBookings,
} from './useCustomerTimeline';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('usePurchases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns data on success', async () => {
    const payload = { invoices: [], total: 0 };
    vi.mocked(getPurchases).mockResolvedValue(payload);

    const { result } = renderHook(() => usePurchases({ limit: 20, offset: 0 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
  });

  it('surfaces error on failure', async () => {
    vi.mocked(getPurchases).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => usePurchases({ limit: 20, offset: 0 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCustomOrders', () => {
  it('calls getCustomOrders with correct params', async () => {
    vi.mocked(getCustomOrders).mockResolvedValue({ orders: [], total: 0 });

    renderHook(() => useCustomOrders({ limit: 10, offset: 20 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getCustomOrders).toHaveBeenCalledWith({ limit: 10, offset: 20 }));
  });
});

describe('useRateLocks', () => {
  it('calls getRateLockBookings', async () => {
    vi.mocked(getRateLockBookings).mockResolvedValue({ bookings: [], total: 0 });

    renderHook(() => useRateLocks({ limit: 20, offset: 0 }), { wrapper: createWrapper() });
    await waitFor(() => expect(getRateLockBookings).toHaveBeenCalled());
  });
});

describe('useTryAtHomeBookings', () => {
  it('calls getTryAtHomeBookings', async () => {
    vi.mocked(getTryAtHomeBookings).mockResolvedValue({ bookings: [], total: 0 });

    renderHook(() => useTryAtHomeBookings({ limit: 20, offset: 0 }), { wrapper: createWrapper() });
    await waitFor(() => expect(getTryAtHomeBookings).toHaveBeenCalled());
  });
});
