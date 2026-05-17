// Family names must match the keys registered via `useFonts(...)` in
// apps/shopkeeper/app/_layout.tsx — React Native resolves fontFamily by the
// literal name, it does not combine family + weight into a file pick.
//
// `display` points at TiroDevanagariHindi-Regular (not YatraOne) because the
// shipped Yatra One TTF drops Devanagari matras and reph marks on Android RN
// shaping — verified on Moto G full-device sweep 2026-05-12: "श्री राम
// ज्वैलर्स" rendered with detached ee-matra on श्री, a phantom anusvara on
// राम, and broken reph on र्स; "आपके" rendered as "आपक" (ee-matra dropped).
// Tiro Devanagari Hindi is John Hudson's Indic-shaping pair with proper
// matra positioning + reph + conjunct support and is already bundled. The
// `yatra-one` theme id and BMAD Direction-5 brand label are unaffected —
// those are theme/palette identifiers, not font references.
export const typography = {
  display:     { family: 'TiroDevanagariHindi-Regular', weight: '400' },
  headingMid:  { family: 'MuktaVaani-600', weight: '600' },
  body:        { family: 'MuktaVaani-400', weight: '400' },
  serif:       { family: 'TiroDevanagariHindi-Regular', weight: '400' },
  serifItalic: { family: 'TiroDevanagariHindi-Italic', style: 'italic' },
  latinItalic: { family: 'Fraunces-Italic', style: 'italic' },
} as const;

export type TypographyToken = keyof typeof typography;
