import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockFaceLandmarker = {
  detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [], facialTransformationMatrixes: [] }),
  close: vi.fn(),
};

vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue(mockFaceLandmarker),
  },
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFaceDetector', () => {
  it('starts not ready when disabled', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: false }));
    expect(result.current.ready).toBe(false);
  });

  it('becomes ready when enabled=true', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('calls close on unmount', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result, unmount } = renderHook(() => useFaceDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    unmount();
    expect(mockFaceLandmarker.close).toHaveBeenCalled();
  });

  it('detect() returns null before ready', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: false }));
    expect(result.current.detect({} as HTMLVideoElement, 0)).toBeNull();
  });

  it('detect() delegates to FaceLandmarker.detectForVideo when ready', async () => {
    const { useFaceDetector } = await import('../components/try-on/useFaceDetector');
    const { result } = renderHook(() => useFaceDetector({ enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const fakeVideo = {} as HTMLVideoElement;
    act(() => { result.current.detect(fakeVideo, 16); });
    expect(mockFaceLandmarker.detectForVideo).toHaveBeenCalledWith(fakeVideo, 16);
  });
});
