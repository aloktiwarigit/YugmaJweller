import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Yatra_One, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { fetchTenantConfig } from '@/lib/api';
import { buildThemeStyle } from '@/lib/theme';

const yatraOne = Yatra_One({
  weight: '400',
  subsets: ['devanagari', 'latin'],
  variable: '--font-heading',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  weight: ['400', '500', '600'],
  subsets: ['devanagari'],
  variable: '--font-body',
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const slug = resolveSlug();

  const unavailablePage = (
    <html lang="hi" className={`${yatraOne.variable} ${notoSansDevanagari.variable}`}>
      <body>
        <main className="flex min-h-screen items-center justify-center bg-bg p-8">
          <p className="font-body text-ink text-lg">यह दुकान उपलब्ध नहीं है।</p>
        </main>
      </body>
    </html>
  );

  if (!slug) return unavailablePage;

  const config = await fetchTenantConfig(slug);
  if (!config) return unavailablePage;

  // XSS guard: only allow https:// logo URLs
  const safeLogoUrl =
    config.logoUrl && config.logoUrl.startsWith('https://') ? config.logoUrl : null;

  return (
    <html
      lang={config.defaultLanguage}
      className={`${yatraOne.variable} ${notoSansDevanagari.variable}`}
      style={buildThemeStyle(config.primaryColor)}
    >
      <body className="bg-bg text-ink min-h-screen font-body">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-white px-4 py-2 rounded z-50"
        >
          मुख्य सामग्री पर जाएं
        </a>
        <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            {safeLogoUrl && (
              <img
                src={safeLogoUrl}
                alt={`${config.appName} का लोगो`}
                className="h-10 w-auto object-contain"
              />
            )}
            <span className="font-heading text-xl text-ink">{config.appName}</span>
          </div>
        </header>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
