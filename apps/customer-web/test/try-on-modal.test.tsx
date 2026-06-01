import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

// Stub heavy sub-components
vi.mock('../components/try-on/ConsentSheet', () => ({
  ConsentSheet: ({ onAgree, onCancel }: { onAgree: () => void; onCancel: () => void }) => (
    <div data-testid="consent-sheet">
      <button onClick={onAgree}>सहमत हूं</button>
      <button onClick={onCancel}>रद्द करें</button>
    </div>
  ),
}));

vi.mock('../components/try-on/TryOnCanvas', () => ({
  TryOnCanvas: ({ onDetectorReady }: { onDetectorReady: () => void }) => {
    onDetectorReady();
    return <div data-testid="try-on-canvas" />;
  },
}));

const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
  configurable: true,
});

const TRY_ON_DATA = {
  productId: 'p1', bodyPart: 'EAR' as const,
  assetUrl: 'https://x.com/e.png', anchorX: 0.5, anchorY: 0,
  lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockGetUserMedia.mockRejectedValue(new Error('denied'));
});

describe('TryOnModal', () => {
  it('shows consent sheet on first open', async () => {
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    expect(screen.getByTestId('consent-sheet')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows denied state when camera permission refused', async () => {
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('सहमत हूं'));
    await waitFor(() => {
      expect(screen.getByText(/कैमरा अनुमति नहीं मिली/)).toBeInTheDocument();
    });
  });

  it('shows canvas after camera granted and detector ready', async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    mockGetUserMedia.mockResolvedValueOnce(fakeStream);
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('सहमत हूं'));
    await waitFor(() => {
      expect(screen.getByTestId('try-on-canvas')).toBeInTheDocument();
    });
  });

  it('has role=dialog and aria-modal', async () => {
    const { TryOnModal } = await import('../components/try-on/TryOnModal');
    render(<TryOnModal tryOnData={TRY_ON_DATA} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
