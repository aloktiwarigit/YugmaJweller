import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { useRouter } from 'expo-router';

vi.mock('../src/components/TenantBrandHeader', () => ({
  TenantBrandHeader: () => <div data-testid="tenant-brand-header" />,
}));

vi.mock('../src/hooks/useCustomerSession', () => ({
  useCustomerSession: vi.fn(() => ({
    customer: { id: 'c1', name: 'राज', phoneE164: '+919999999999' },
    isAuthenticated: true,
  })),
}));

import AddressBookScreen from '../app/profile/addresses';
import ReferralCodeScreen from '../app/profile/referral';

describe('customer profile flows', () => {
  const back = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      back,
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('renders address book pending state without platform branding', () => {
    const { container, getByTestId } = render(<AddressBookScreen />);

    expect(getByTestId('tenant-brand-header')).toBeTruthy();
    expect(getByTestId('address-book-backend-required')).toBeTruthy();
    expect(container.textContent).toContain('पता पुस्तिका');
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });

  it('renders referral code pending state without platform branding', () => {
    const { container, getByTestId } = render(<ReferralCodeScreen />);

    expect(getByTestId('tenant-brand-header')).toBeTruthy();
    expect(getByTestId('referral-backend-required')).toBeTruthy();
    expect(getByTestId('referral-code-placeholder').textContent).toContain('जल्द उपलब्ध');
    expect(container.textContent).not.toMatch(/Goldsmith/i);
  });

  it('back buttons return to profile navigation stack', () => {
    const { getByTestId: getAddressByTestId } = render(<AddressBookScreen />);
    fireEvent.click(getAddressByTestId('address-book-back-button'));
    expect(back).toHaveBeenCalledTimes(1);

    const { getByTestId: getReferralByTestId } = render(<ReferralCodeScreen />);
    fireEvent.click(getReferralByTestId('referral-back-button'));
    expect(back).toHaveBeenCalledTimes(2);
  });
});
