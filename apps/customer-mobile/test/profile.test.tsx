import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  customerSelfDelete: vi.fn(),
  signOut: vi.fn(),
}));

// Mock all network calls
vi.mock('../src/api/endpoints', () => ({
  getPurchases:          vi.fn().mockResolvedValue({ invoices: [], total: 0 }),
  getCustomOrders:       vi.fn().mockResolvedValue({ orders: [], total: 0 }),
  getRateLockBookings:   vi.fn().mockResolvedValue({ bookings: [], total: 0 }),
  getTryAtHomeBookings:  vi.fn().mockResolvedValue({ bookings: [], total: 0 }),
  customerSelfDelete:    mocks.customerSelfDelete,
}));

vi.mock('../src/hooks/useCustomerSession', () => ({
  useCustomerSession: vi.fn(() => ({
    customer: { id: 'c1', name: 'राज', phoneE164: '+919999999999' },
    signOut: mocks.signOut,
  })),
}));

vi.mock('../src/components/TenantBrandHeader', () => ({
  TenantBrandHeader: () => <div data-testid="tenant-brand-header" />,
}));

vi.mock('../src/components/LoyaltyPointsCard', () => ({
  LoyaltyPointsCard: () => <div data-testid="loyalty-card" />,
}));

import Profile from '../app/(tabs)/profile';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Profile screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customerSelfDelete.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });

  it('renders brand header and loyalty card', () => {
    const { getByTestId } = render(<Profile />, { wrapper });
    expect(getByTestId('tenant-brand-header')).toBeTruthy();
    expect(getByTestId('loyalty-card')).toBeTruthy();
  });

  it('renders all 5 Hindi tab labels', () => {
    const { container } = render(<Profile />, { wrapper });
    expect(container.textContent).toContain('खरीदारी');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('दर-लॉक');
    expect(container.textContent).toContain('ट्राई-एट-होम');
    expect(container.textContent).toContain('समीक्षा');
  });

  it('does not contain the string Goldsmith (white-label invariant)', () => {
    const { container } = render(<Profile />, { wrapper });
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });

  it('renders delete-data and logout buttons below the timeline', () => {
    const { getByTestId } = render(<Profile />, { wrapper });
    expect(getByTestId('profile-delete-button')).toBeTruthy();
    expect(getByTestId('profile-signout-button')).toBeTruthy();
  });

  it('requires confirmation before requesting self-deletion and signs out after success', async () => {
    const { getByTestId } = render(<Profile />, { wrapper });

    fireEvent.click(getByTestId('profile-delete-button'));
    expect(mocks.customerSelfDelete).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('profile-delete-button'));

    await waitFor(() => expect(mocks.customerSelfDelete).toHaveBeenCalledOnce());
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('keeps the customer signed in and shows an error when deletion is blocked', async () => {
    mocks.customerSelfDelete.mockRejectedValueOnce(Object.assign(new Error('blocked'), {
      code: 'crm.deletion.open_invoices',
      status: 422,
    }));
    const { container, getByTestId } = render(<Profile />, { wrapper });

    fireEvent.click(getByTestId('profile-delete-button'));
    fireEvent.click(getByTestId('profile-delete-button'));

    await waitFor(() => {
      expect(container.textContent).toContain('खुले बिल होने के कारण');
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
