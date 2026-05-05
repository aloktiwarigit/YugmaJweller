import { create } from 'zustand';
import { DEFAULT_THEME_ID, THEMES, type ThemeId, type ThemePreset } from '@goldsmith/ui-tokens';

/**
 * Theme store — backs the white-label demo prop theme switcher.
 *
 * Hydration is performed by `ThemeProvider` (reads AsyncStorage on mount and
 * calls `setThemeId`). The store is a plain in-memory cache that the
 * `useThemeTokens()` hook subscribes to so that screens re-render when the
 * theme changes — no Metro reload required.
 *
 * NOT a real per-tenant theming surface. See themes.ts for the deferral note.
 */

export interface ThemeState {
  themeId:    ThemeId;
  setThemeId: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId:    DEFAULT_THEME_ID,
  setThemeId: (id): void => set({ themeId: id }),
}));

/** Read the active preset (selector helper). */
export function useActiveThemePreset(): ThemePreset {
  const id = useThemeStore((s) => s.themeId);
  return THEMES[id];
}
