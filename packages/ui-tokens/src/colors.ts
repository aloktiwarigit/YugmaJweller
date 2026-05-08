export const colors = {
  // === Locked tokens — do not rename ===
  primary:         '#B58A3C',  // aged gold — tenant override via CSS var
  accent:          '#D4745A',  // terracotta
  bg:              '#F5EDDD',  // cream canvas
  ink:             '#1E2440',  // indigo-ink primary text
  border:          '#D9C9A8',  // default border
  error:           '#B1402B',  // dangerRust

  // === Extended palette (Direction 5 Hindi-First Editorial) ===
  primaryDeep:     '#8C6628',  // hover/pressed gold; AA on cream (#F5EDDD)
  primaryWash:     '#EFE3BE',  // selected chip bg, subtle gold tint
  accentWash:      '#F8DDD3',  // accent chip bg
  surface:         '#FFFFFF',  // cards, sheets
  surfaceElevated: '#FFFBF2',  // hero card, modal — warmer than pure white
  surfaceRecessed: '#EDE2CC',  // section dividers, filter rail bg
  inkMute:         '#4A526E',  // secondary text
  inkSoft:         '#6B7392',  // tertiary, captions
  borderSubtle:    '#E6D8B8',  // inside cream sections
  borderStrong:    '#B89F70',  // active filter, focus ring
  successJade:     '#2F7D5B',  // in-stock, HUID verified ✓
  successWash:     '#DCEEE3',  // success chip bg
  warningSaffron:  '#C68A1F',  // rate stale, low stock
  warningWash:     '#F8E9C6',  // warning chip bg
  infoSky:         '#3B5C8A',  // informational hints

  // === Semantic aliases (mobile compat — keep stable) ===
  textPrimary:     '#1E2440',
  textSecondary:   '#4A526E',
  primaryLight:    '#EFE3BE',
  white:           '#FFFFFF',
  background:      '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;

export const shadows = {
  sm: '0 1px 2px rgba(30,36,64,0.06)',
  md: '0 4px 12px rgba(30,36,64,0.08)',
  lg: '0 16px 40px rgba(30,36,64,0.12)',
} as const;

export type ShadowToken = keyof typeof shadows;
