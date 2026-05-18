'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import StorefrontHeader from '@/components/StorefrontHeader';
import { StorefrontFooter } from '@/components/StorefrontFooter';
import { buildThemeStyle } from '@/lib/theme';
import type { TenantConfigResponse } from '@/lib/api';
import { initPostHog, posthog } from './lib/posthog';

interface Props {
  config: TenantConfigResponse | null;
  children: ReactNode;
}

export function StorefrontWrapper({ config, children }: Props) {
  const pathname       = usePathname();
  const shopId         = config?.shopId ?? null;
  const initCalledRef  = useRef(false);

  // Initialise PostHog once per mount (client-side only).
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initPostHog();
  }, []);

  // Fire page_view on every pathname change.
  useEffect(() => {
    posthog.capture('page_view', {
      path:   pathname,
      shopId: shopId ?? undefined,
    });
  }, [pathname, shopId]);

  if (!config || pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  const safeLogoUrl =
    config.logoUrl && config.logoUrl.startsWith('https://') ? config.logoUrl : null;

  return (
    <div style={buildThemeStyle(config.primaryColor)} className="bg-bg text-ink min-h-screen font-ui">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-white px-4 py-2 rounded z-50"
      >
        मुख्य सामग्री पर जाएं
      </a>
      <StorefrontHeader shopName={config.appName} logoUrl={safeLogoUrl} />
      <main id="main-content">{children}</main>
      <StorefrontFooter config={config} />
    </div>
  );
}
