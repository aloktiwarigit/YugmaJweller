import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockHandLandmarker = {
  detectForVideo: vi.fn().mockReturnValue({ landmarks: [], worldLandmarks: [], handedness: [] }),
  close: vi.fn(),
};

vi.mock('@mediapipe/tasks-vision', () => ({
  HandLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue(mockHandLandmarker),
  },
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => { vi.clearAllMocks(); });

describe('useHandDetector', () => {
  it('starts not ready when disabled', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result } = renderHook(() => useHandDetector({ enabled: false }));
    expect(result.current.ready).toBe(false);
  });

  it('becomes ready when enabled=true', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result } = renderHook(() => useHandDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('calls close on unmount', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result, unmount } = renderHook(() => useHandDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    unmount();
    expect(mockHandLandmarker.close).toHaveBeenCalled();
  });

  it('detect() delegates to HandLandmarker.detectForVideo when ready', async () => {
    const { useHandDetector } = await import('../components/try-on/useHandDetector');
    const { result } = renderHook(() => useHandDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const fakeVideo = {} as HTMLVideoElement;
    act(() => { result.current.detect(fakeVideo, 16); });
    expect(mockHandLandmarker.detectForVideo).toHaveBeenCalledWith(fakeVideo, 16);
  });
});
