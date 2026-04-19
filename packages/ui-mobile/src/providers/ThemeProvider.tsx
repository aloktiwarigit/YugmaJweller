import React, { createContext, useContext } from 'react';
import { colors as defaultColors } from '@goldsmith/ui-tokens';

export interface Theme {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  appName?: string;
}

const DefaultTheme: Theme = {
  primaryColor: defaultColors.primary,
  secondaryColor: defaultColors.accent,
};

const ThemeContext = createContext<Theme>(DefaultTheme);

export function ThemeProvider({
  theme,
  children,
}: {
  theme?: Partial<Theme>;
  children: React.ReactNode;
}): React.ReactElement {
  const merged: Theme = { ...DefaultTheme, ...(theme ?? {}) };
  return <ThemeContext.Provider value={merged}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
