import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTenantStore, type Tenant } from '../stores/tenantStore';
import { api } from '../api/client';

const CACHE_KEY_PREFIX = 'tenant-boot:';

type CachedEntry = { tenant: Tenant; etag: string };

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
        const tenant = res.data as Tenant;
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
