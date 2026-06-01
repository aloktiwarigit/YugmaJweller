import { describe, it, expect, vi } from 'vitest';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

function faceLandmarks(overrides: Record<number, [number, number]>) {
  const arr = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) {
    arr[Number(i)] = { x, y, z: 0 };
  }
  return arr;
}

function makeResult(lm: ReturnType<typeof faceLandmarks>): FaceLandmarkerResult {
  return {
    faceLandmarks: [lm],
    facialTransformationMatrixes: [
      { data: Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) },
    ],
    faceBlendshapes: [],
  } as unknown as FaceLandmarkerResult;
}

function makeCtx() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    font: '',
    fillStyle: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('renderFaceOverlay', () => {
  it('calls ctx.drawImage twice for EAR (both ears, zero yaw)', async () => {
    const { renderFaceOverlay, makeFaceSmooths } = await import('../components/try-on/face-renderer');
    const ctx = makeCtx();
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 100, naturalHeight: 150 } as HTMLImageElement;
    const tryOnData = {
      productId: 'p1', bodyPart: 'EAR' as const,
      assetUrl: 'https://example.com/earring.png',
      anchorX: 0.5, anchorY: 0.0,
      lengthMm: 20, widthMm: null, diameterMm: null,
      metal: 'GOLD', purity: '22K', netWeightG: '4.5000', trueToSize: true,
    };

    const lm = faceLandmarks({
      10: [0.5, 0.1], 152: [0.5, 0.9],
      234: [0.35, 0.5], 454: [0.65, 0.5],
      468: [0.6, 0.5], 473: [0.4, 0.5],
    });

    renderFaceOverlay({ ctx, canvas, result: makeResult(lm), tryOnData, assetImg, smooths: makeFaceSmooths(), timestamp: 16 });
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it('does not draw when no face detected', async () => {
    const { renderFaceOverlay, makeFaceSmooths } = await import('../components/try-on/face-renderer');
    const ctx = makeCtx();
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 100, naturalHeight: 150 } as HTMLImageElement;
    const tryOnData = {
      productId: 'p1', bodyPart: 'EAR' as const,
      assetUrl: 'https://x.com/e.png', anchorX: 0.5, anchorY: 0,
      lengthMm: 20, widthMm: null, diameterMm: null,
      metal: 'GOLD', purity: '22K', netWeightG: '4.5', trueToSize: true,
    };

    renderFaceOverlay({
      ctx, canvas,
      result: { faceLandmarks: [], facialTransformationMatrixes: [] } as unknown as FaceLandmarkerResult,
      tryOnData, assetImg, smooths: makeFaceSmooths(), timestamp: 16,
    });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('draws NECK once', async () => {
    const { renderFaceOverlay, makeFaceSmooths } = await import('../components/try-on/face-renderer');
    const ctx = makeCtx();
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 200, naturalHeight: 100 } as HTMLImageElement;
    const tryOnData = {
      productId: 'p1', bodyPart: 'NECK' as const,
      assetUrl: 'https://x.com/n.png', anchorX: 0.5, anchorY: 0.1,
      lengthMm: 45, widthMm: null, diameterMm: null,
      metal: 'GOLD', purity: '22K', netWeightG: '8.0', trueToSize: true,
    };

    const lm = faceLandmarks({
      10: [0.5, 0.1], 152: [0.5, 0.9],
      468: [0.6, 0.5], 473: [0.4, 0.5],
    });

    renderFaceOverlay({ ctx, canvas, result: makeResult(lm), tryOnData, assetImg, smooths: makeFaceSmooths(), timestamp: 16 });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });
});
