import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTenantStore, type Tenant } from '../stores/tenantStore';
import { api } from '../api/client';

const CACHE_KEY_PREFIX = 'tenant-boot:';
const fallbackDisplayName = 'अयोध्या स्वर्णकार';

type CachedEntry = { tenant: Tenant; etag: string };
type RawTenantBoot = {
  id: string;
  slug: string;
  displayName?: string;
  display_name?: string;
  branding?: Tenant['branding'];
  config?: {
    app_name?: string;
    default_language?: 'hi-IN' | 'en-IN';
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
  };
};

function normalizeTenantBoot(raw: RawTenantBoot): Tenant {
  return {
    id: raw.id,
    slug: raw.slug,
    displayName:
      raw.displayName ?? raw.display_name ?? raw.config?.app_name ?? fallbackDisplayName,
    branding: {
      ...raw.branding,
      appName: raw.branding?.appName ?? raw.config?.app_name,
      defaultLanguage: raw.branding?.defaultLanguage ?? raw.config?.default_language,
      logoUrl: raw.branding?.logoUrl ?? raw.config?.logo_url,
      primaryColor: raw.branding?.primaryColor ?? raw.config?.primary_color,
      secondaryColor: raw.branding?.secondaryColor ?? raw.config?.secondary_color,
    },
  };
}

export function TenantProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSlug = useTenantStore((s) => s.setSlug);
  const setTenant = useTenantStore((s) => s.setTenant);
  const setError = useTenantStore((s) => s.setError);
  const setLoading = useTenantStore((s) => s.setLoading);

  useEffect(() => {
    const slug =
      (Constants.expoConfig?.extra?.['tenantSlug'] as string | undefined) ?? 'anchor-dev';
    setSlug(slug);

    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const cachedRaw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${slug}`);
        const cached = cachedRaw ? (JSON.parse(cachedRaw) as CachedEntry) : null;
        if (cached && !cancelled) {
          setTenant(cached.tenant, cached.etag);
        } else if (!cancelled) {
          setLoading(true);
        }
        const headers = cached?.etag ? { 'If-None-Match': cached.etag } : undefined;
        const res = await api.get(`/api/v1/tenant/boot?slug=${encodeURIComponent(slug)}`, {
          headers: headers as Record<string, string> | undefined,
          validateStatus: (s: number) => s === 200 || s === 304,
        });
        if (cancelled) return;
        if (res.status === 304 && cached) {
          // no-op — already in store from cache
          return;
        }
        const tenant = normalizeTenantBoot(res.data as RawTenantBoot);
        const etag = (res.headers['etag'] as string | undefined) ?? null;
        setTenant(tenant, etag);
        await AsyncStorage.setItem(
          `${CACHE_KEY_PREFIX}${slug}`,
          JSON.stringify({ tenant, etag }),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'tenant.boot_failed');
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [setSlug, setTenant, setError, setLoading]);

  return <>{children}</>;
}
