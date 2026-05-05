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
  it('renders 4 menu rows for owner role', () => {
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('ग्राहक सूची');
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('ट्राई-एट-होम');
    expect(container.textContent).toContain('दर-लॉक बुकिंग');
  });

  it('hides दर-लॉक बुकिंग for staff role', () => {
    useAuthStore.setState({
      firebaseUser: null,
      user: { id: 'u2', shopId: 's1', role: 'shop_staff', displayName: 'Staff' },
      idToken: null,
      loading: false,
    });
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('ग्राहक सूची');
    expect(container.textContent).not.toContain('दर-लॉक बुकिंग');
  });

  it('renders all three non-rate-lock rows for staff', () => {
    useAuthStore.setState({
      firebaseUser: null,
      user: { id: 'u2', shopId: 's1', role: 'shop_staff', displayName: 'Staff' },
      idToken: null,
      loading: false,
    });
    const { container } = render(<MoreScreen />);
    expect(container.textContent).toContain('कस्टम ऑर्डर');
    expect(container.textContent).toContain('ट्राई-एट-होम');
  });
});
