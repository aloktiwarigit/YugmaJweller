export const colors = {
  // ── Core palette ─────────────────────────────────────────────────────────
  primary:         '#B58A3C',  // aged gold — tenant override anchor
  primaryDeep:     '#8C6628',  // hover/pressed gold; text on cream (AA contrast)
  primaryWash:     '#EFE3BE',  // selected chip bg, subtle gold tint
  accent:          '#D4745A',  // terracotta — sale, new-arrival, MAX 1/fold
  accentWash:      '#F8DDD3',  // accent chip bg
  bg:              '#F5EDDD',  // cream canvas
  surface:         '#FFFFFF',  // cards, sheets
  surfaceElevated: '#FFFBF2',  // hero card, modal — warmer than pure white
  surfaceRecessed: '#EDE2CC',  // section dividers, filter rail bg
  ink:             '#1E2440',  // indigo-ink primary text
  inkMute:         '#4A526E',  // secondary text
  inkSoft:         '#6B7392',  // tertiary, captions
  border:          '#D9C9A8',  // default
  borderSubtle:    '#E6D8B8',  // inside cream sections
  borderStrong:    '#B89F70',  // active filter, focus ring
  successJade:     '#2F7D5B',  // in-stock, HUID verified ✓
  successWash:     '#DCEEE3',  // success chip bg
  warningSaffron:  '#C68A1F',  // rate stale, low stock
  warningWash:     '#F8E9C6',  // warning chip bg
  error:           '#B1402B',  // danger rust
  // ── Legacy aliases (backward compat) ─────────────────────────────────────
  textPrimary:   '#1E2440',
  textSecondary: '#4A526E',
  primaryLight:  '#EFE3BE',   // same as primaryWash
  white:         '#FFFFFF',
  background:    '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
