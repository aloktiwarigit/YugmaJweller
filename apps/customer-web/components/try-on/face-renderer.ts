import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import {
  OneEuroFilter,
  normPerMmFace,
  anchorFor,
  resolveAssetWidthNorm,
  decomposePose,
  mirrorXIfNeeded,
  DEFAULT_IPD_MM,
} from '@goldsmith/try-on-core';

// MediaPipe refined face-mesh iris centre indices (478-landmark model).
const IRIS_LEFT = 473;
const IRIS_RIGHT = 468;

// Yaw angle beyond which the far-side earring is hidden (45 degrees).
const YAW_HIDE_RAD = (45 * Math.PI) / 180;

export interface FaceSmooths {
  leftX: OneEuroFilter;
  leftY: OneEuroFilter;
  rightX: OneEuroFilter;
  rightY: OneEuroFilter;
  neckX: OneEuroFilter;
  neckY: OneEuroFilter;
  width: OneEuroFilter;
}

export function makeFaceSmooths(): FaceSmooths {
  const o = { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };
  return {
    leftX: new OneEuroFilter(o), leftY: new OneEuroFilter(o),
    rightX: new OneEuroFilter(o), rightY: new OneEuroFilter(o),
    neckX: new OneEuroFilter(o), neckY: new OneEuroFilter(o),
    width: new OneEuroFilter(o),
  };
}

export interface RenderFaceParams {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  result: FaceLandmarkerResult;
  tryOnData: CatalogTryOnResponse;
  assetImg: HTMLImageElement;
  smooths: FaceSmooths;
  timestamp: number;
}

export function renderFaceOverlay({
  ctx, canvas, result, tryOnData, assetImg, smooths, timestamp,
}: RenderFaceParams): void {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks || landmarks.length < 478) return;

  const t = timestamp / 1000; // seconds for OneEuroFilter

  // Scale: IPD from iris landmarks
  const normPerMm = normPerMmFace(landmarks[IRIS_LEFT], landmarks[IRIS_RIGHT], DEFAULT_IPD_MM);

  const { widthNorm, trueToSize } = resolveAssetWidthNorm(
    {
      dimensions: {
        lengthMm: tryOnData.lengthMm ?? undefined,
        widthMm: tryOnData.widthMm ?? undefined,
        diameterMm: tryOnData.diameterMm ?? undefined,
      },
      metal: tryOnData.metal,
      purity: tryOnData.purity,
      netWeightG: Number(tryOnData.netWeightG),
    },
    normPerMm,
    tryOnData.bodyPart,
  );

  const smoothedWidth = smooths.width.filter(widthNorm, t);
  const assetWidthPx = smoothedWidth * canvas.width;
  const assetHeightPx =
    assetImg.naturalHeight > 0
      ? assetWidthPx * (assetImg.naturalHeight / assetImg.naturalWidth)
      : assetWidthPx;

  // Pose from facial transformation matrix (column-major 16 floats)
  let rollRad = 0;
  let yawRad = 0;
  const matrices = result.facialTransformationMatrixes;
  if (matrices && matrices.length > 0 && matrices[0]?.data) {
    const pose = decomposePose(Array.from(matrices[0].data));
    rollRad = pose.rollRad;
    yawRad = pose.yawRad;
  }

  if (tryOnData.bodyPart === 'EAR') {
    // Container is CSS scaleX(-1) so the user sees a mirrored (selfie) view.
    // MediaPipe sees the raw frame; flip x with mirrorXIfNeeded before drawing.
    // User's left ear = camera's right = FACE_INDEX.rightEar (454) in raw frame.
    // User's right ear = camera's left = FACE_INDEX.leftEar (234) in raw frame.

    const hideLeft = yawRad > YAW_HIDE_RAD;
    if (!hideLeft) {
      const raw = anchorFor('EAR', landmarks, { side: 'right' });
      const ax = smooths.leftX.filter(mirrorXIfNeeded(raw.x, true), t) * canvas.width;
      const ay = smooths.leftY.filter(raw.y, t) * canvas.height;
      drawJewellery(ctx, assetImg, ax, ay, assetWidthPx, assetHeightPx, tryOnData, rollRad);
    }

    const hideRight = yawRad < -YAW_HIDE_RAD;
    if (!hideRight) {
      const raw = anchorFor('EAR', landmarks, { side: 'left' });
      const ax = smooths.rightX.filter(mirrorXIfNeeded(raw.x, true), t) * canvas.width;
      const ay = smooths.rightY.filter(raw.y, t) * canvas.height;
      drawJewellery(ctx, assetImg, ax, ay, assetWidthPx, assetHeightPx, tryOnData, rollRad);
    }
  } else if (tryOnData.bodyPart === 'NECK') {
    const raw = anchorFor('NECK', landmarks, {});
    const ax = smooths.neckX.filter(mirrorXIfNeeded(raw.x, true), t) * canvas.width;
    const ay = smooths.neckY.filter(raw.y, t) * canvas.height;
    // Necklace hangs gravity-down — no rotation with head roll
    drawJewellery(ctx, assetImg, ax, ay, assetWidthPx, assetHeightPx, tryOnData, 0);
  }

  if (!trueToSize) drawApproxBadge(ctx, canvas);
}

function drawJewellery(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  anchorPxX: number,
  anchorPxY: number,
  widthPx: number,
  heightPx: number,
  tryOnData: CatalogTryOnResponse,
  rotRad: number,
): void {
  ctx.save();
  ctx.translate(anchorPxX, anchorPxY);
  ctx.rotate(rotRad);
  ctx.drawImage(
    img,
    -tryOnData.anchorX * widthPx,
    -tryOnData.anchorY * heightPx,
    widthPx,
    heightPx,
  );
  ctx.restore();
}

function drawApproxBadge(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const padding = 8;
  ctx.fillRect(padding, canvas.height - 32, 150, 22);
  ctx.fillStyle = '#fff';
  ctx.fillText('अनुमानित आकार', padding + 6, canvas.height - 16);
  ctx.restore();
}
