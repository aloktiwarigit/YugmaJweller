export const typography = {
  display:     { family: 'YatraOne', weight: '400' },
  headingMid:  { family: 'MuktaVaani', weight: '600' },
  body:        { family: 'MuktaVaani', weight: '400' },
  serif:       { family: 'TiroDevanagariHindi', weight: '400' },
  serifItalic: { family: 'TiroDevanagariHindi', style: 'italic' },
  latinItalic: { family: 'Fraunces', style: 'italic' },
} as const;

export type TypographyToken = keyof typeof typography;
