import React, { useEffect } from 'react';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTenantStore } from '../stores/tenantStore';
import type { Tenant } from '../stores/tenantStore';
import { getTenantBoot } from '../api/endpoints';

const TENANT_BOOT_CACHE_PREFIX = 'customer_mobile_tenant_boot_v1:';

interface CachedTenantBoot {
  tenant: Tenant;
  etag: string | null;
}

function cacheKey(slug: string): string {
  return `${TENANT_BOOT_CACHE_PREFIX}${slug}`;
}

async function loadCachedTenant(slug: string): Promise<CachedTenantBoot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTenantBoot;
    if (!parsed.tenant?.id || !parsed.tenant?.slug) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveCachedTenant(slug: string, tenant: Tenant, etag: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(slug), JSON.stringify({ tenant, etag }));
  } catch {
    // Cache persistence must never block boot.
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSlug = useTenantStore((s) => s.setSlug);
  const setTenant = useTenantStore((s) => s.setTenant);
  const setError = useTenantStore((s) => s.setError);
  const setLoading = useTenantStore((s) => s.setLoading);
  const retryNonce = useTenantStore((s) => s.retryNonce);

  useEffect(() => {
    const slug = (Constants.expoConfig?.extra?.['tenantSlug'] as string | undefined) ?? 'anchor-dev';
    setSlug(slug);
    setLoading(true);

    let cancelled = false;
    (async (): Promise<void> => {
      const cached = await loadCachedTenant(slug);
      if (cancelled) return;
      if (cached) {
        setTenant(cached.tenant, cached.etag);
      }

      try {
        const r = await getTenantBoot(slug, cached?.etag ?? undefined);
        if (cancelled) return;
        if (r.notModified) {
          if (cached) {
            setTenant(cached.tenant, cached.etag);
          } else {
            setError('tenant.cache_missing');
          }
          return;
        }
        if (!r.tenant) {
          setError('tenant.boot_failed');
          return;
        }
        setTenant(r.tenant, r.etag);
        await saveCachedTenant(slug, r.tenant, r.etag);
      } catch (e) {
        if (cancelled) return;
        if (cached) {
          setTenant(cached.tenant, cached.etag);
          return;
        }
        setError(e instanceof Error ? e.message : 'tenant.boot_failed');
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [retryNonce, setSlug, setTenant, setError, setLoading]);

  return <>{children}</>;
}
