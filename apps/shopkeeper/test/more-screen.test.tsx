import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useAuthStore } from '../src/stores/authStore';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) =>
    React.createElement('icon', { 'data-icon': name }),
}));

import MoreScreen from '../app/(tabs)/more';

beforeEach(() => {
  useAuthStore.setState({
    firebaseUser: null,
    user: { id: 'u1', shopId: 's1', role: 'shop_admin', displayName: 'Owner' },
    idToken: null,
    loading: false,
  });
});

describe('(tabs)/more.tsx', () => {
  it('renders manager menu rows for owner role', () => {
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('ग्राहक सूची');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('ट्राई-एट-होम');
    expect(container.textContent).toContain('दर-लॉक बुकिंग');
    expect(container.textContent).toContain('सेटिंग्स');
  });

  it('hides manager workflows for staff role', () => {
    useAuthStore.setState({
      firebaseUser: null,
      user: { id: 'u2', shopId: 's1', role: 'shop_staff', displayName: 'Staff' },
      idToken: null,
      loading: false,
    });
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('स्टाफ की पहुंच बिलिंग और इन्वेंटरी तक सीमित है।');
    expect(container.textContent).not.toContain('ग्राहक सूची');
    expect(container.textContent).not.toContain('दर-लॉक बुकिंग');
  });

  it('does not render CRM/custom-order/try-at-home rows for staff', () => {
    useAuthStore.setState({
      firebaseUser: null,
      user: { id: 'u2', shopId: 's1', role: 'shop_staff', displayName: 'Staff' },
      idToken: null,
      loading: false,
    });
    const { container } = render(<MoreScreen />);
    expect(container.textContent).not.toContain('कस्टम ऑर्डर');
    expect(container.textContent).not.toContain('ट्राई-एट-होम');
  });
});
