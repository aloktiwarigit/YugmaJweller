// apps/customer-mobile/test/delete-account.test.tsx
//
// Story 19.7 — customer-self delete-account screen.
// Mirrors the test pattern of test/profile.test.tsx (vi.hoisted mocks +
// fireEvent.click/change + waitFor). Uses @testing-library/react with the
// jsdom + react-native.mock.ts shim (NOT @testing-library/react-native).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  customerSelfDelete: vi.fn(),
  signOut: vi.fn(),
  routerReplace: vi.fn(),
  routerBack: vi.fn(),
}));

vi.mock('../src/api/endpoints', () => ({ customerSelfDelete: mocks.customerSelfDelete }));
vi.mock('../src/hooks/useCustomerSession', () => ({
  useCustomerSession: () => ({ customer: { name: 'Priya', phoneE164: '+919876543210' }, signOut: mocks.signOut }),
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mocks.routerReplace, back: mocks.routerBack }),
  Stack:     { Screen: () => null },
}));
vi.mock('../src/components/TenantBrandHeader', () => ({
  TenantBrandHeader: () => <div data-testid="tenant-brand-header" />,
}));

import DeleteAccountScreen from '../app/profile/delete-account';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.customerSelfDelete.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue(undefined);
});

describe('DeleteAccountScreen', () => {
  it('renders Hindi heading and the four reason options', () => {
    const { getByText } = render(<DeleteAccountScreen />);
    expect(getByText('क्या आप वाक़ई अपना खाता हटाना चाहते हैं?')).toBeTruthy();
    expect(getByText('मुझे ज़रूरत नहीं')).toBeTruthy();
    expect(getByText('गोपनीयता की चिंता')).toBeTruthy();
    expect(getByText('दूसरे जौहरी से खरीद रहा')).toBeTruthy();
    expect(getByText('अन्य')).toBeTruthy();
  });

  it('keeps submit disabled until both reason picked and confirmation phrase matches', async () => {
    const { getByTestId, getByText } = render(<DeleteAccountScreen />);
    const submit = getByTestId('delete-account-submit');

    // Initially disabled — button has disabled attribute
    expect(submit.hasAttribute('disabled')).toBe(true);

    // Pick reason — still disabled without phrase
    fireEvent.click(getByText('गोपनीयता की चिंता'));
    expect(submit.hasAttribute('disabled')).toBe(true);

    // Wrong phrase — still disabled
    fireEvent.change(getByTestId('delete-account-confirm-input'), { target: { value: 'मेरा डेटा' } });
    expect(submit.hasAttribute('disabled')).toBe(true);

    // Exact phrase — enabled
    fireEvent.change(getByTestId('delete-account-confirm-input'), { target: { value: 'मेरा डेटा मिटाएँ' } });
    expect(submit.hasAttribute('disabled')).toBe(false);
  });

  it('on submit, calls customerSelfDelete with reason then signOut', async () => {
    const { getByTestId, getByText } = render(<DeleteAccountScreen />);

    fireEvent.click(getByText('मुझे ज़रूरत नहीं'));
    fireEvent.change(getByTestId('delete-account-confirm-input'), { target: { value: 'मेरा डेटा मिटाएँ' } });
    fireEvent.click(getByTestId('delete-account-submit'));

    await waitFor(() => expect(mocks.customerSelfDelete).toHaveBeenCalledOnce());
    expect(mocks.customerSelfDelete).toHaveBeenCalledWith({ reason: 'no-need', reasonText: undefined });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('reveals a free-text input when "अन्य" is picked', () => {
    const { getByTestId, getByText, queryByTestId } = render(<DeleteAccountScreen />);

    expect(queryByTestId('delete-account-reason-text')).toBeNull();
    fireEvent.click(getByText('अन्य'));
    expect(getByTestId('delete-account-reason-text')).toBeTruthy();
  });

  it('shows a Hindi error when the API returns crm.deletion.try_at_home_in_flight', async () => {
    mocks.customerSelfDelete.mockRejectedValueOnce(Object.assign(new Error('blocked'), {
      code: 'crm.deletion.try_at_home_in_flight', status: 422,
    }));

    const { getByTestId, getByText } = render(<DeleteAccountScreen />);
    fireEvent.click(getByText('मुझे ज़रूरत नहीं'));
    fireEvent.change(getByTestId('delete-account-confirm-input'), { target: { value: 'मेरा डेटा मिटाएँ' } });
    fireEvent.click(getByTestId('delete-account-submit'));

    await waitFor(() => {
      expect(getByText(/घर पर ट्राय का सामान/)).toBeTruthy();
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
