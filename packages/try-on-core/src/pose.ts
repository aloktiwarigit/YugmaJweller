export interface PoseAngles {
  rollRad: number;
  pitchRad: number;
  yawRad: number;
}

export function decomposePose(m: number[]): PoseAngles {
  if (m.length !== 16) {
    throw new Error(`decomposePose expects a 16-length matrix, got ${m.length}`);
  }
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];

  const yawRad = Math.atan2(-r20, Math.hypot(r21, r22));
  const pitchRad = Math.atan2(r21, r22);
  const rollRad = Math.atan2(r10, r00);

  return { rollRad, pitchRad, yawRad };
}
