// Family names must match the keys registered via `useFonts(...)` in
// apps/shopkeeper/app/_layout.tsx — React Native resolves fontFamily by the
// literal name, it does not combine family + weight into a file pick.
export const typography = {
  display:     { family: 'YatraOne', weight: '400' },
  headingMid:  { family: 'MuktaVaani-600', weight: '600' },
  body:        { family: 'MuktaVaani-400', weight: '400' },
  serif:       { family: 'TiroDevanagariHindi-Regular', weight: '400' },
  serifItalic: { family: 'TiroDevanagariHindi-Italic', style: 'italic' },
  latinItalic: { family: 'Fraunces-Italic', style: 'italic' },
} as const;

export type TypographyToken = keyof typeof typography;
