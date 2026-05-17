import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('../src/hooks/usePublicRates', () => ({
  usePublicRates: () => ({ data: null, isLoading: false }),
}));

vi.mock('../src/features/inventory/components/InventorySearch', () => ({
  InventorySearch: () => null,
}));

vi.mock('@goldsmith/ui-mobile', () => ({
  RateWidget: () => null,
  Skeleton:   () => null,
  Toast:      () => null,
  Button:     () => null,
}));

import { InventoryListScreen } from '../src/features/inventory/screens/InventoryListScreen';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('InventoryListScreen quick-actions bar', () => {
  it('renders all 5 quick-action pill labels', () => {
    const { container } = render(<InventoryListScreen />, { wrapper });
    expect(container.textContent).toContain('+ नया उत्पाद');
    expect(container.textContent).toContain('CSV आयात');
    expect(container.textContent).toContain('मूल्यांकन');
    expect(container.textContent).toContain('डेड स्टॉक');
    expect(container.textContent).toContain('लेबल प्रिंट');
  });
});
