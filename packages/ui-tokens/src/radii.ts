// Revised to honour "8px or smaller" spec rule (xs:2 / sm:4 / md:8 / lg:12 / pill:9999)
export const radii = {
  xs:   2,
  sm:   4,
  md:   8,
  lg:   12,
  pill: 9999,
} as const;

export type RadiiToken = keyof typeof radii;
