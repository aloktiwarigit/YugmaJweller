/** Normalized landmark from MediaPipe: x,y in [0,1] of the image, z relative depth. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** A 2D point in normalized image space [0,1]. */
export interface Vec2 {
  x: number;
  y: number;
}

export type BodyPart = 'EAR' | 'NECK' | 'FINGER' | 'WRIST';

/** Which physical dimension drives on-screen size for a given body part. */
export interface DimensionsMm {
  lengthMm?: number;
  widthMm?: number;
  diameterMm?: number;
}

/** Output of the fit pipeline for one rendered frame, in normalized image space. */
export interface FitResult {
  /** Where the asset anchor point should land, normalized [0,1]. */
  anchor: Vec2;
  /** On-screen width of the asset in normalized image units. */
  widthNorm: number;
  /** In-plane rotation in radians (head roll / finger axis). */
  rotationRad: number;
  /** True when size came from real mm dimensions; false = weight-derived estimate. */
  trueToSize: boolean;
}
