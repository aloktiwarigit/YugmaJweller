import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from '@goldsmith/ui-tokens';
import { useThemeStore } from '../stores/themeStore';

const STORAGE_KEY = 'shopkeeper.theme.selectedId';

/**
 * Persist a theme selection to AsyncStorage. Fire-and-forget; the in-memory
 * store has already been updated by the caller.
 */
export async function persistThemeId(id: ThemeId): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // best-effort persistence — the live demo still works without it.
  }
}

/**
 * Hydrates the theme store from AsyncStorage on app boot. Falls back to
 * DEFAULT_THEME_ID when nothing is persisted (or persisted value is
 * unrecognised — could happen if a preset is removed in a future build).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setThemeId = useThemeStore((s) => s.setThemeId);

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw && isThemeId(raw)) {
          setThemeId(raw);
        } else {
          setThemeId(DEFAULT_THEME_ID);
        }
      } catch {
        if (!cancelled) setThemeId(DEFAULT_THEME_ID);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [setThemeId]);

  return <>{children}</>;
}

/** Test-only export — keeps the storage key spelling in one place. */
export const __THEME_STORAGE_KEY = STORAGE_KEY;
