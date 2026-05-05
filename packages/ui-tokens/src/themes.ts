/**
 * Theme presets for the white-label demo prop.
 *
 * NOTE: This is a DEMO PROP, not the full per-tenant theming system. Real
 * per-customer white-label is build-time customization done after a customer
 * signs (different EAS build profile, different keystore, package id). For
 * the in-shop demo we just need to prove that swapping a theme is visible
 * within ~30 seconds.
 *
 * Tokens here MUST match the shape of `colors` in `./colors.ts` so an
 * override is a drop-in replacement on screens that opt in via
 * `useThemeTokens()` (shopkeeper app).
 *
 * Per-tenant runtime theming (`shop_settings.theme_json`) is deferred to
 * Phase 4 customer-customization workflow.
 */

export type ThemeColors = {
  primary:       string;
  accent:        string;
  bg:            string;
  ink:           string;
  inkMute:       string;
  border:        string;
  error:         string;
  textPrimary:   string;
  textSecondary: string;
  primaryLight:  string;
  white:         string;
  background:    string;
};

export type ThemeId = 'yatra-one' | 'banaras-maroon';

export interface ThemePreset {
  id:          ThemeId;
  displayName: string;
  colors:      ThemeColors;
}

/**
 * Default — the locked anchor theme (Direction 5 Hindi-First Editorial).
 * Mirrors the values exported from `./colors.ts`.
 */
export const YATRA_ONE: ThemePreset = {
  id:          'yatra-one',
  displayName: 'Yatra One Editorial (cream + aged gold)',
  colors: {
    primary:       '#B58A3C',
    accent:        '#D4745A',
    bg:            '#F5EDDD',
    ink:           '#1E2440',
    inkMute:       '#4A526E',
    border:        '#D9C9A8',
    error:         '#B1402B',
    textPrimary:   '#1E2440',
    textSecondary: '#4A526E',
    primaryLight:  '#EFE3BE',
    white:         '#FFFFFF',
    background:    '#FFFFFF',
  },
};

/**
 * Contrast preset — Banaras Maroon (deep maroon + brass + ivory).
 * Visually distinct from cream/gold so a 5-second toggle in a demo
 * unmistakably reads as "different brand".
 */
export const BANARAS_MAROON: ThemePreset = {
  id:          'banaras-maroon',
  displayName: 'Banaras Maroon (maroon + brass)',
  colors: {
    primary:       '#7A1F2B',  // deep maroon
    accent:        '#C8973F',  // brass
    bg:            '#F4ECE0',  // warm ivory
    ink:           '#2A1417',  // espresso for body text
    inkMute:       '#6B4F52',  // muted plum
    border:        '#D8C8B8',  // ivory border
    error:         '#9C1B1B',  // crimson
    textPrimary:   '#2A1417',
    textSecondary: '#6B4F52',
    primaryLight:  '#E8C9A6',  // brass tint
    white:         '#FFFFFF',
    background:    '#FFFFFF',
  },
};

export const THEMES: Record<ThemeId, ThemePreset> = {
  'yatra-one':      YATRA_ONE,
  'banaras-maroon': BANARAS_MAROON,
};

export const DEFAULT_THEME_ID: ThemeId = 'yatra-one';

/** Convenience: ordered list for switcher UIs. */
export const THEME_PRESETS: readonly ThemePreset[] = [YATRA_ONE, BANARAS_MAROON];

/** Type guard for AsyncStorage-loaded values. */
export function isThemeId(v: unknown): v is ThemeId {
  return v === 'yatra-one' || v === 'banaras-maroon';
}
