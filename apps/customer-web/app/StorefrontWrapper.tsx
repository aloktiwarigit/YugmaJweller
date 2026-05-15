'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import StorefrontHeader from '@/components/StorefrontHeader';
import { StorefrontFooter } from '@/components/StorefrontFooter';
import { buildThemeStyle } from '@/lib/theme';
import type { TenantConfigResponse } from '@/lib/api';

interface Props {
  config: TenantConfigResponse | null;
  children: ReactNode;
}

// Conditionally wraps children with the jeweller's storefront chrome (header + footer + theme).
// Admin routes bypass the storefront wrapper entirely — they use the admin layout instead.
export function StorefrontWrapper({ config, children }: Props) {
  const pathname = usePathname();

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
