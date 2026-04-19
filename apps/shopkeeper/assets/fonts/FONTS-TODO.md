# Font delivery — Direction 5 typography

The Expo shopkeeper app bundles four font families per spec §5 + ADR-0016.
**Before the first Dev Client build, place the following files here:**

- `YatraOne-Regular.ttf` — Google Fonts → Yatra One (display; Devanagari)
- `MuktaVaani-400.ttf` — Indian Type Foundry → Mukta Vaani 400
- `MuktaVaani-500.ttf` — Indian Type Foundry → Mukta Vaani 500
- `MuktaVaani-600.ttf` — Indian Type Foundry → Mukta Vaani 600
- `MuktaVaani-700.ttf` — Indian Type Foundry → Mukta Vaani 700
- `TiroDevanagariHindi-Regular.ttf` — Google Fonts → Tiro Devanagari Hindi Regular
- `TiroDevanagariHindi-Italic.ttf` — Google Fonts → Tiro Devanagari Hindi Italic
- `Fraunces-VariableItalic.ttf` — Google Fonts → Fraunces Variable (italic axis)

All fonts are SIL Open Font License. Bundle them via `expo-font` (NOT Google Fonts CDN — see spec invariant 24).

Empty `.ttf` placeholders are committed here as markers until the real files land.
Font loading code in `app/_layout.tsx` is scaffolded but commented until files are populated —
re-enable the `useFonts` call once the real `.ttf` files are in place.
