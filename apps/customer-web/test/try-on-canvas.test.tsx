import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// jsdom doesn't implement HTMLMediaElement.prototype.play — stub it globally.
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

vi.mock('../components/try-on/useFaceDetector', () => ({
  useFaceDetector: () => ({ ready: false, detect: vi.fn() }),
}));
vi.mock('../components/try-on/useHandDetector', () => ({
  useHandDetector: () => ({ ready: false, detect: vi.fn() }),
}));
vi.mock('../components/try-on/face-renderer', () => ({
  makeFaceSmooths: () => ({}),
  renderFaceOverlay: vi.fn(),
}));
vi.mock('../components/try-on/hand-renderer', () => ({
  makeHandSmooths: () => ({}),
  renderHandOverlay: vi.fn(),
}));

const STREAM = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

const EAR_DATA = {
  productId: 'p1', bodyPart: 'EAR' as const,
  assetUrl: 'https://x.com/e.png', anchorX: 0.5, anchorY: 0,
  lengthMm: 20, widthMm: null, diameterMm: null,
  metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('TryOnCanvas', () => {
  it('renders a video and canvas element', async () => {
    const { TryOnCanvas } = await import('../components/try-on/TryOnCanvas');
    const { container } = render(
      <TryOnCanvas stream={STREAM} tryOnData={EAR_DATA} onDetectorReady={vi.fn()} />,
    );
    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('calls onDetectorReady when face detector becomes ready', async () => {
    // Reset modules so vi.doMock takes effect on fresh import
    vi.resetModules();
    vi.doMock('../components/try-on/useFaceDetector', () => ({
      useFaceDetector: () => ({ ready: true, detect: vi.fn() }),
    }));
    vi.doMock('../components/try-on/useHandDetector', () => ({
      useHandDetector: () => ({ ready: false, detect: vi.fn() }),
    }));
    vi.doMock('../components/try-on/face-renderer', () => ({
      makeFaceSmooths: () => ({}),
      renderFaceOverlay: vi.fn(),
    }));
    vi.doMock('../components/try-on/hand-renderer', () => ({
      makeHandSmooths: () => ({}),
      renderHandOverlay: vi.fn(),
    }));
    const onReady = vi.fn();
    const { TryOnCanvas } = await import('../components/try-on/TryOnCanvas');
    render(<TryOnCanvas stream={STREAM} tryOnData={EAR_DATA} onDetectorReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalled());
  });
});
