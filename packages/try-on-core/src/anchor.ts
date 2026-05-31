import type { Landmark, Vec2, BodyPart } from './types';

export const FACE_INDEX = {
  chin: 152,
  foreheadTop: 10,
  leftEar: 234,
  rightEar: 454,
} as const;

export const HAND_INDEX = {
  wrist: 0,
  ringMcp: 13,
  ringPip: 14,
} as const;

export const LOBE_DROP_FRACTION = 0.06;
export const NECK_DROP_FRACTION = 0.35;

export interface AnchorOptions {
  side?: 'left' | 'right';
}

function faceHeight(lm: Landmark[]): number {
  return Math.abs(lm[FACE_INDEX.chin].y - lm[FACE_INDEX.foreheadTop].y);
}

export function anchorFor(part: BodyPart, lm: Landmark[], opts: AnchorOptions): Vec2 {
  switch (part) {
    case 'EAR': {
      const ear = opts.side === 'right' ? lm[FACE_INDEX.rightEar] : lm[FACE_INDEX.leftEar];
      return { x: ear.x, y: ear.y + LOBE_DROP_FRACTION * faceHeight(lm) };
    }
    case 'NECK': {
      const chin = lm[FACE_INDEX.chin];
      return { x: chin.x, y: chin.y + NECK_DROP_FRACTION * faceHeight(lm) };
    }
    case 'FINGER': {
      const a = lm[HAND_INDEX.ringMcp];
      const b = lm[HAND_INDEX.ringPip];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    case 'WRIST': {
      const w = lm[HAND_INDEX.wrist];
      return { x: w.x, y: w.y };
    }
  }
}
