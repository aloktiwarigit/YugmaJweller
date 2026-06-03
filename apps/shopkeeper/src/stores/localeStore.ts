import { create } from 'zustand';
import { getLocale, setLocale as setI18nLocale, type Locale } from '@goldsmith/i18n';

export type AppLocale = Locale;
type LocaleSource = 'default' | 'tenant' | 'user';

export const LOCALE_OPTIONS: readonly AppLocale[] = ['hi-IN', 'en-IN'];

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'hi-IN' || value === 'en-IN';
}

export interface LocaleState {
  locale: AppLocale;
  source: LocaleSource;
  hydrated: boolean;
  setLocale: (locale: AppLocale, source?: LocaleSource) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: getLocale(),
  source: 'default',
  hydrated: false,
  setLocale: (locale, source = 'user'): void => {
    setI18nLocale(locale);
    set({ locale, source });
  },
  setHydrated: (hydrated): void => set({ hydrated }),
}));
