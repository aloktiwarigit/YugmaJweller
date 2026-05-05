import { THEMES, type ThemeColors, type ThemePreset } from '@goldsmith/ui-tokens';
import { useThemeStore } from '../stores/themeStore';

/**
 * Returns the active theme's color tokens — drop-in replacement for the
 * `colors` import from `@goldsmith/ui-tokens` on screens that opt into the
 * runtime theme switcher.
 *
 * Screens that import `colors` directly are NOT theme-aware and continue to
 * render the locked Yatra One palette. That's intentional: blast radius for
 * this demo prop is contained to the surfaces we explicitly migrate.
 */
export function useThemeTokens(): ThemeColors {
  const id = useThemeStore((s) => s.themeId);
  return THEMES[id].colors;
}

/** Returns the full active preset (id + displayName + colors). */
export function useThemePreset(): ThemePreset {
  const id = useThemeStore((s) => s.themeId);
  return THEMES[id];
}
