# Direction 5 typography — bundled

Fonts downloaded from Google Fonts via the `gwfh.mranftl.com` helper API (post-PR-1.1b). All eight `.ttf` files are committed to this directory and loaded at boot via `expo-font` in `apps/shopkeeper/app/_layout.tsx`.

- `YatraOne-Regular.ttf` — Yatra One (display; Devanagari) — SIL Open Font License
- `MuktaVaani-{400,500,600,700}.ttf` — Mukta Vaani (body) — SIL Open Font License
- `TiroDevanagariHindi-{Regular,Italic}.ttf` — Tiro Devanagari Hindi (serif) — SIL Open Font License
- `Fraunces-VariableItalic.ttf` — Fraunces (Latin display italic, sparingly) — SIL Open Font License

## Updating fonts

If a family needs refreshing (e.g., Google Fonts ships a new version):

```bash
# Hit the gwfh API, pick the variant, curl the .ttf URL:
curl -s "https://gwfh.mranftl.com/api/fonts/<slug>" | jq '.variants[] | {id, ttf}'
# Then curl the ttf URL into this directory with the existing filename.
```

Keep filenames stable — they're referenced by `useFonts` in `app/_layout.tsx`.
