import { useEffect, type ReactElement, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAppLocale, useLocaleStore, type AppLocale } from '../stores/localeStore';
import { useTenantStore } from '../stores/tenantStore';

const STORAGE_KEY = 'shopkeeper.locale';

export async function updateAppLocale(locale: AppLocale): Promise<void> {
  useLocaleStore.getState().setLocale(locale, 'user');
  await AsyncStorage.setItem(STORAGE_KEY, locale);
}

export function LocaleProvider({ children }: { children: ReactNode }): ReactElement {
  const tenantDefault = useTenantStore((s) => s.tenant?.branding.defaultLanguage);
  const source = useLocaleStore((s) => s.source);
  const hydrated = useLocaleStore((s) => s.hydrated);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const setHydrated = useLocaleStore((s) => s.setHydrated);

  useEffect(() => {
    let cancelled = false;

    (async (): Promise<void> => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isAppLocale(stored)) {
          setLocale(stored, 'user');
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [setHydrated, setLocale]);

  useEffect(() => {
    if (!hydrated || source === 'user' || !isAppLocale(tenantDefault)) return;
    setLocale(tenantDefault, 'tenant');
  }, [hydrated, setLocale, source, tenantDefault]);

  return <>{children}</>;
}
