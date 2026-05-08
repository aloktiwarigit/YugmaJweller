import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Yatra_One, Mukta, Hind } from 'next/font/google';
import './globals.css';
import { fetchTenantConfig } from '@/lib/api';
import { buildThemeStyle } from '@/lib/theme';

const yatraOne = Yatra_One({
  weight: '400',
  subsets: ['devanagari', 'latin'],
  variable: '--font-heading',
  display: 'swap',
});

// Primary UI font — Devanagari + Latin body copy
const mukta = Mukta({
  weight: ['400', '500', '600', '700'],
  subsets: ['devanagari', 'latin'],
  variable: '--font-ui',
  display: 'swap',
});

// Long-form prose font (> 30 words)
const hind = Hind({
  weight: ['400', '500'],
  subsets: ['devanagari', 'latin'],
  variable: '--font-prose',
  display: 'swap',
});

function resolveSlug(): string | null {
  const headersList = headers();
  return headersList.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export async function generateMetadata(): Promise<Metadata> {
  const slug = resolveSlug();
  if (!slug) return { title: 'आभूषण' };
  const config = await fetchTenantConfig(slug);
  return {
    title: config?.appName ?? 'आभूषण',
    description: `${config?.appName ?? 'आभूषण'} — श्रेष्ठ आभूषण, विश्वसनीय सेवा`,
  };
}

const fontClasses = `${yatraOne.variable} ${mukta.variable} ${hind.variable}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = headers();
  const pathname = headersList.get('x-pathname') ?? '';

  if (pathname.startsWith('/admin')) {
    return (
      <html lang="en" className={fontClasses}>
        <body>{children}</body>
      </html>
    );
  }

  const slug = resolveSlug();

  const unavailablePage = (
    <html lang="hi" className={fontClasses}>
      <body>
        <main className="flex min-h-screen items-center justify-center bg-bg p-8">
          <p className="font-ui text-ink text-lg">यह दुकान उपलब्ध नहीं है।</p>
        </main>
      </body>
    </html>
  );

  if (!slug) return unavailablePage;

  const config = await fetchTenantConfig(slug);
  if (!config) return unavailablePage;

  const safeLogoUrl =
    config.logoUrl && config.logoUrl.startsWith('https://') ? config.logoUrl : null;

  return (
    <html
      lang={config.defaultLanguage}
      className={fontClasses}
      style={buildThemeStyle(config.primaryColor)}
    >
      <body className="bg-bg text-ink min-h-screen font-ui">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-white px-4 py-2 rounded z-50"
        >
          मुख्य सामग्री पर जाएं
        </a>
        <StorefrontHeaderPlaceholder
          shopName={config.appName}
          logoUrl={safeLogoUrl}
        />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}

// Inline minimal header — replaced by StorefrontHeader import after commit 5
function StorefrontHeaderPlaceholder({
  shopName,
  logoUrl,
}: {
  shopName: string;
  logoUrl: string | null;
}) {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        {logoUrl && (
          <img src={logoUrl} alt={`${shopName} का लोगो`} className="h-10 w-auto object-contain" />
        )}
        <span className="font-heading text-xl text-ink">{shopName}</span>
      </div>
    </header>
  );
}
