import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import {
  OneEuroFilter,
  normPerMmHand,
  anchorFor,
  resolveAssetWidthNorm,
  mirrorXIfNeeded,
  HAND_INDEX,
} from '@goldsmith/try-on-core';

// Ring-finger proximal segment (MCP→PIP) assumed length in mm.
const RING_SEGMENT_MM = 20;
// Metacarpal span (index MCP to pinky MCP) assumed in mm.
const METACARPAL_MM = 70;

export interface HandSmooths {
  x: OneEuroFilter;
  y: OneEuroFilter;
  width: OneEuroFilter;
  rotation: OneEuroFilter;
}

export function makeHandSmooths(): HandSmooths {
  const o = { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };
  return {
    x: new OneEuroFilter(o),
    y: new OneEuroFilter(o),
    width: new OneEuroFilter(o),
    rotation: new OneEuroFilter(o),
  };
}

export interface RenderHandParams {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  result: HandLandmarkerResult;
  tryOnData: CatalogTryOnResponse;
  assetImg: HTMLImageElement;
  smooths: HandSmooths;
  timestamp: number;
}

export function renderHandOverlay({
  ctx, canvas, result, tryOnData, assetImg, smooths, timestamp,
}: RenderHandParams): void {
  const landmarks = result.landmarks[0];
  if (!landmarks || landmarks.length < 21) return;

  const t = timestamp / 1000;

  if (tryOnData.bodyPart === 'FINGER') {
    const mcp = landmarks[HAND_INDEX.ringMcp]; // index 13
    const pip = landmarks[HAND_INDEX.ringPip]; // index 14

    const normPerMm = normPerMmHand(mcp, pip, RING_SEGMENT_MM);
    const { widthNorm, trueToSize } = resolveAssetWidthNorm(
      {
        dimensions: {
          diameterMm: tryOnData.diameterMm ?? undefined,
          widthMm: tryOnData.widthMm ?? undefined,
          lengthMm: tryOnData.lengthMm ?? undefined,
        },
        metal: tryOnData.metal,
        purity: tryOnData.purity,
        netWeightG: Number(tryOnData.netWeightG),
      },
      normPerMm,
      'FINGER',
    );

    const anchorRaw = anchorFor('FINGER', landmarks, {});
    const fingerRotRaw = Math.atan2(pip.y - mcp.y, pip.x - mcp.x);
    const rotRad = fingerRotRaw + Math.PI / 2;

    const sw = smooths.width.filter(widthNorm, t);
    const ax = smooths.x.filter(mirrorXIfNeeded(anchorRaw.x, true), t) * canvas.width;
    const ay = smooths.y.filter(anchorRaw.y, t) * canvas.height;
    const sr = smooths.rotation.filter(rotRad, t);
    const assetWidthPx = sw * canvas.width;
    const assetHeightPx =
      assetImg.naturalHeight > 0
        ? assetWidthPx * (assetImg.naturalHeight / assetImg.naturalWidth)
        : assetWidthPx;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(sr);
    ctx.drawImage(
      assetImg,
      -tryOnData.anchorX * assetWidthPx,
      -tryOnData.anchorY * assetHeightPx,
      assetWidthPx,
      assetHeightPx,
    );
    ctx.restore();

    if (!trueToSize) drawApproxBadge(ctx, canvas);

  } else if (tryOnData.bodyPart === 'WRIST') {
    const normPerMm = normPerMmHand(landmarks[5], landmarks[17], METACARPAL_MM);
    const { widthNorm, trueToSize } = resolveAssetWidthNorm(
      {
        dimensions: {
          diameterMm: tryOnData.diameterMm ?? undefined,
          widthMm: tryOnData.widthMm ?? undefined,
          lengthMm: tryOnData.lengthMm ?? undefined,
        },
        metal: tryOnData.metal,
        purity: tryOnData.purity,
        netWeightG: Number(tryOnData.netWeightG),
      },
      normPerMm,
      'WRIST',
    );

    const anchorRaw = anchorFor('WRIST', landmarks, {});
    const midMcp = landmarks[9];
    const wristRotRaw = Math.atan2(midMcp.y - anchorRaw.y, midMcp.x - anchorRaw.x);
    const rotRad = wristRotRaw + Math.PI / 2;

    const sw = smooths.width.filter(widthNorm, t);
    const ax = smooths.x.filter(mirrorXIfNeeded(anchorRaw.x, true), t) * canvas.width;
    const ay = smooths.y.filter(anchorRaw.y, t) * canvas.height;
    const sr = smooths.rotation.filter(rotRad, t);
    const assetWidthPx = sw * canvas.width;
    const assetHeightPx =
      assetImg.naturalHeight > 0
        ? assetWidthPx * (assetImg.naturalHeight / assetImg.naturalWidth)
        : assetWidthPx;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(sr);
    ctx.drawImage(
      assetImg,
      -tryOnData.anchorX * assetWidthPx,
      -tryOnData.anchorY * assetHeightPx,
      assetWidthPx,
      assetHeightPx,
    );
    ctx.restore();

    if (!trueToSize) drawApproxBadge(ctx, canvas);
  }
}

function drawApproxBadge(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(8, canvas.height - 32, 150, 22);
  ctx.fillStyle = '#fff';
  ctx.fillText('अनुमानित आकार', 14, canvas.height - 16);
  ctx.restore();
}
