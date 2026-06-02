import { describe, it, expect, vi } from 'vitest';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';

function handLandmarks(overrides: Record<number, [number, number]>) {
  const arr = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) arr[Number(i)] = { x, y, z: 0 };
  return arr;
}

function makeHandResult(lm: ReturnType<typeof handLandmarks>): HandLandmarkerResult {
  return {
    landmarks: [lm],
    worldLandmarks: [],
    handedness: [{ categories: [{ categoryName: 'Right', score: 0.9, index: 0, displayName: 'Right' }] }],
  } as unknown as HandLandmarkerResult;
}

function makeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
    rotate: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(),
    fillText: vi.fn(), font: '', fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('renderHandOverlay', () => {
  it('draws ring asset once for FINGER', async () => {
    const { renderHandOverlay, makeHandSmooths } = await import('../components/try-on/hand-renderer');
    const ctx = makeCtx();
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 80, naturalHeight: 40 } as HTMLImageElement;
    const tryOnData = {
      productId: 'p1', bodyPart: 'FINGER' as const,
      assetUrl: 'https://x.com/ring.png', anchorX: 0.5, anchorY: 0.5,
      lengthMm: null, widthMm: null, diameterMm: 16,
      metal: 'GOLD', purity: '22K', netWeightG: '3.0', trueToSize: true,
    };
    const lm = handLandmarks({ 0: [0.5, 0.8], 5: [0.4, 0.4], 9: [0.5, 0.35], 13: [0.48, 0.5], 14: [0.47, 0.4], 17: [0.6, 0.45] });

    renderHandOverlay({ ctx, canvas, result: makeHandResult(lm), tryOnData, assetImg, smooths: makeHandSmooths(), timestamp: 16 });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('draws bangle asset once for WRIST', async () => {
    const { renderHandOverlay, makeHandSmooths } = await import('../components/try-on/hand-renderer');
    const ctx = makeCtx();
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 120, naturalHeight: 60 } as HTMLImageElement;
    const tryOnData = {
      productId: 'p2', bodyPart: 'WRIST' as const,
      assetUrl: 'https://x.com/bangle.png', anchorX: 0.5, anchorY: 0.5,
      lengthMm: null, widthMm: null, diameterMm: 60,
      metal: 'GOLD', purity: '22K', netWeightG: '20.0', trueToSize: true,
    };
    const lm = handLandmarks({ 0: [0.5, 0.8], 5: [0.4, 0.4], 9: [0.5, 0.35], 13: [0.48, 0.5], 14: [0.47, 0.4], 17: [0.6, 0.45] });

    renderHandOverlay({ ctx, canvas, result: makeHandResult(lm), tryOnData, assetImg, smooths: makeHandSmooths(), timestamp: 16 });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('does not draw when no hand detected', async () => {
    const { renderHandOverlay, makeHandSmooths } = await import('../components/try-on/hand-renderer');
    const ctx = makeCtx();
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const assetImg = { naturalWidth: 80, naturalHeight: 40 } as HTMLImageElement;
    const tryOnData = {
      productId: 'p1', bodyPart: 'FINGER' as const,
      assetUrl: 'https://x.com/ring.png', anchorX: 0.5, anchorY: 0.5,
      lengthMm: null, widthMm: null, diameterMm: 16,
      metal: 'GOLD', purity: '22K', netWeightG: '3.0', trueToSize: true,
    };

    renderHandOverlay({ ctx, canvas, result: { landmarks: [], worldLandmarks: [], handedness: [] } as unknown as HandLandmarkerResult, tryOnData, assetImg, smooths: makeHandSmooths(), timestamp: 16 });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
