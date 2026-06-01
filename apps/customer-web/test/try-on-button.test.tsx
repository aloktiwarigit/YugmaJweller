import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../app/TenantContext', () => ({
  useTenant: () => ({
    shopId: '00000000-0000-4000-8000-000000000001',
    appName: 'Test',
    primaryColor: '#B8860B',
    logoUrl: null,
    defaultLanguage: 'hi',
  }),
}));

const mockFetchTryOnData = vi.fn();
vi.mock('../lib/api', async () => {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...real, fetchTryOnData: mockFetchTryOnData };
});

vi.mock('../components/try-on/TryOnModal', () => ({
  TryOnModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="try-on-modal">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

const MOCK_DATA = {
  productId: 'p1', bodyPart: 'EAR', assetUrl: 'https://x.com/e.png',
  anchorX: 0.5, anchorY: 0, lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('TryOnButton', () => {
  it('renders the try-on button', async () => {
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    expect(screen.getByRole('button', { name: /ट्राय/i })).toBeInTheDocument();
  });

  it('opens the modal when try-on data is available', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(MOCK_DATA);
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /ट्राय/i }));
    await waitFor(() => {
      expect(screen.getByTestId('try-on-modal')).toBeInTheDocument();
    });
  });

  it('shows unavailable message when no try-on data', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(null);
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /ट्राय/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('closes the modal when onClose is called', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(MOCK_DATA);
    const { TryOnButton } = await import('../components/try-on/TryOnButton');
    render(<TryOnButton productId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /ट्राय/i }));
    await waitFor(() => screen.getByTestId('try-on-modal'));
    fireEvent.click(screen.getByText('close'));
    await waitFor(() => {
      expect(screen.queryByTestId('try-on-modal')).not.toBeInTheDocument();
    });
  });
});
