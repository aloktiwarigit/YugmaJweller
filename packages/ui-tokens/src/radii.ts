export const radii = {
  sm:   6,
  md:   12,
  lg:   20,
  pill: 9999,
} as const;

export type RadiiToken = keyof typeof radii;
