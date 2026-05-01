import React, { useEffect } from 'react';
import Constants from 'expo-constants';
import { useTenantStore } from '../stores/tenantStore';
import { getTenantBoot } from '../api/endpoints';

export function TenantProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSlug = useTenantStore((s) => s.setSlug);
  const setTenant = useTenantStore((s) => s.setTenant);
  const setError = useTenantStore((s) => s.setError);
  const setLoading = useTenantStore((s) => s.setLoading);

  useEffect(() => {
    const slug = (Constants.expoConfig?.extra?.['tenantSlug'] as string | undefined) ?? 'anchor-dev';
    setSlug(slug);
    setLoading(true);

    // TODO(EPIC7-S0): No AsyncStorage cache yet — boot is network-only. When ETag
    // persistence is added, the 304 path below must read from cache instead of
    // dropping the response. Tracked for follow-up before offline-capable release.
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const r = await getTenantBoot(slug);
        if (cancelled) return;
        if (r.notModified) {
          // Defensive: we never send If-None-Match yet, so this branch is
          // structurally unreachable today. Guard prevents a future ETag-cache
          // wiring from accidentally calling setTenant(null as Tenant, ...).
          setLoading(false);
          return;
        }
        setTenant(r.tenant, r.etag);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'tenant.boot_failed');
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [setSlug, setTenant, setError, setLoading]);

  return <>{children}</>;
}
