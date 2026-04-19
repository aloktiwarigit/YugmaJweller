import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setLocale } from '@goldsmith/i18n';

vi.mock('../src/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ back: vi.fn() }),
  Stack: { Screen: (): null => null },
}));

import StaffScreen from '../app/settings/staff';
import { api } from '../src/api/client';

function renderWithQuery(ui: React.ReactElement): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  setLocale('hi-IN');
  vi.clearAllMocks();
});

describe('Staff screen', () => {
  it('shows empty state when no staff', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { staff: [] } });
    renderWithQuery(<StaffScreen />);
    await waitFor(() => {
      expect(screen.getByText('अभी तक कोई स्टाफ नहीं जोड़ा गया')).toBeTruthy();
    });
  });

  it('shows staff row with status pill', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        staff: [
          {
            id: 'u1',
            display_name: 'Amit',
            phone_last4: '3210',
            role: 'shop_staff',
            status: 'INVITED',
            invited_at: new Date().toISOString(),
            activated_at: null,
          },
        ],
      },
    });
    renderWithQuery(<StaffScreen />);
    await waitFor(() => {
      expect(screen.getByText('Amit')).toBeTruthy();
      expect(screen.getByText('आमंत्रित')).toBeTruthy();
    });
  });

  it('opens invite sheet when add button is tapped', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { staff: [] } });
    renderWithQuery(<StaffScreen />);
    await waitFor(() => screen.getByTestId('staff-add-btn'));
    fireEvent.click(screen.getByTestId('staff-add-btn'));
    expect(screen.getByText('नया स्टाफ आमंत्रित करें')).toBeTruthy();
  });

  it('submit button disabled until all fields filled', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { staff: [] } });
    renderWithQuery(<StaffScreen />);
    await waitFor(() => screen.getByTestId('staff-add-btn'));
    fireEvent.click(screen.getByTestId('staff-add-btn'));
    const submitBtn = screen.getByTestId('invite-submit-btn');
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('shows inline error on 409 response', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { staff: [] } });
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409 } });

    renderWithQuery(<StaffScreen />);
    await waitFor(() => screen.getByTestId('staff-add-btn'));
    fireEvent.click(screen.getByTestId('staff-add-btn'));

    fireEvent.change(screen.getByTestId('invite-name-input'), { target: { value: 'Amit' } });
    fireEvent.change(screen.getByTestId('invite-phone-input'), { target: { value: '9876543210' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('invite-submit-btn'));
    });

    await waitFor(() => {
      expect(screen.getByText('यह नंबर पहले से आमंत्रित या सक्रिय है')).toBeTruthy();
    });
  });
});
