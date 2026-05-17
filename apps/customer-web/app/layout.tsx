import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import { headers } from 'next/headers';
import { Yatra_One, Mukta, Hind } from 'next/font/google';
import * as Sentry from '@sentry/nextjs';
import './globals.css';
import { fetchTenantConfig } from '@/lib/api';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { TenantProvider } from './TenantContext';
import { StorefrontWrapper } from './StorefrontWrapper';

const yatraOne = Yatra_One({
  weight: '400',
  subsets: ['devanagari', 'latin'],
  variable: '--font-heading',
  display: 'swap',
});

const mukta = Mukta({
  weight: ['400', '500', '600', '700'],
  subsets: ['devanagari', 'latin'],
  variable: '--font-ui',
  display: 'swap',
});

const hind = Hind({
  weight: ['400', '500'],
  subsets: ['devanagari', 'latin'],
  variable: '--font-prose',
  display: 'swap',
});

const fontClasses = `${yatraOne.variable} ${mukta.variable} ${hind.variable}`;

export async function generateMetadata(): Promise<Metadata> {
  const slug = resolveShopSlug(headers());
  if (!slug) return { title: 'आभूषण' };
  const config = await fetchTenantConfig(slug);
  return {
    title: config?.appName ?? 'आभूषण',
    description: `${config?.appName ?? 'आभूषण'} — श्रेष्ठ आभूषण, विश्वसनीय सेवा`,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const slug   = resolveShopSlug(headers());
  const config = slug ? await fetchTenantConfig(slug) : null;
  const lang = config?.defaultLanguage ?? 'hi';

  // Tag every Sentry event for this request with the resolved tenant slug.
  // This runs server-side (RSC) and applies to all errors in this render tree.
  if (slug) {
    Sentry.setTag('tenant', slug);
  }

  return (
    <html lang={lang} className={fontClasses}>
      <body>
        <TenantProvider value={config}>
          <StorefrontWrapper config={config}>{children}</StorefrontWrapper>
        </TenantProvider>
      </body>
    </html>
  );
}
