import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockFetchTryOnData = vi.fn();
vi.mock('../lib/api', async () => {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...real, fetchTryOnData: mockFetchTryOnData };
});

vi.mock('../components/try-on/TryOnModal', () => ({
  TryOnModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="try-on-modal"><button onClick={onClose}>close</button></div>
  ),
}));

const DATA = {
  productId: 'p1', bodyPart: 'EAR', assetUrl: 'https://x.com/e.png',
  anchorX: 0.5, anchorY: 0, lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('TryOnWvClient', () => {
  it('mounts the modal when try-on data is available', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(DATA);
    const { TryOnWvClient } = await import('../app/products/[id]/try-on-wv/TryOnWvClient');
    render(<TryOnWvClient productId="p1" shopId="shop-1" />);
    await waitFor(() => expect(screen.getByTestId('try-on-modal')).toBeInTheDocument());
  });

  it('shows an error state when no try-on data', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(null);
    const { TryOnWvClient } = await import('../app/products/[id]/try-on-wv/TryOnWvClient');
    render(<TryOnWvClient productId="p1" shopId="shop-1" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('posts a close message to the native WebView on close', async () => {
    mockFetchTryOnData.mockResolvedValueOnce(DATA);
    const postMessage = vi.fn();
    (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView = { postMessage };
    const { TryOnWvClient } = await import('../app/products/[id]/try-on-wv/TryOnWvClient');
    render(<TryOnWvClient productId="p1" shopId="shop-1" />);
    await waitFor(() => screen.getByTestId('try-on-modal'));
    screen.getByText('close').click();
    expect(postMessage).toHaveBeenCalledWith(expect.stringContaining('tryon-close'));
  });
});
