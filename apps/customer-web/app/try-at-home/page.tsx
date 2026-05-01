import { headers } from 'next/headers';
import { fetchTenantConfig, fetchProducts } from '@/lib/api';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'घर पर आज़माएं' };
export const revalidate = 30;

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function TryAtHomePage(): Promise<JSX.Element> {
  const slug   = resolveSlug();
  const config = slug ? await fetchTenantConfig(slug) : null;
  const shopName = config?.appName ?? 'हमारी दुकान';

  const productsData = config ? await fetchProducts(config.shopId, { limit: 6 }) : null;
  const featured = productsData?.items ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-heading text-3xl text-ink mb-2">घर पर आज़माएं</h1>
      <p className="font-body text-inkMute mb-8">
        पसंदीदा आभूषण घर पर पहनकर देखें — पसंद आए तो रखें, नहीं तो वापस करें।
      </p>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="mb-8">
        <h2 id="how-heading" className="font-heading text-xl text-ink mb-4">
          कैसे काम करता है?
        </h2>
        <ol className="space-y-3 font-body text-ink">
          {[
            `ऐप में लॉग इन करें और उत्पाद चुनें (अधिकतम 3)।`,
            `${shopName} आपके घर आभूषण भेजेगी।`,
            'पसंद आए तो रखें, नहीं तो 24-48 घंटे में वापस करें।',
            'रखे हुए उत्पाद का इनवॉइस स्वचालित बनेगा।',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 list-none">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full bg-ink text-white font-heading flex items-center justify-center text-sm"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Featured products (public preview) */}
      {featured.length > 0 ? (
        <section aria-labelledby="products-heading" className="mb-8">
          <h2 id="products-heading" className="font-heading text-xl text-ink mb-4">
            उपलब्ध उत्पाद
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {featured.map((product) => (
              <div
                key={product.id}
                className="rounded-xl bg-white border border-border p-3 text-center"
              >
                <p className="font-body text-sm text-ink font-medium truncate">{product.sku}</p>
                <p className="font-body text-xs text-inkMute">{product.metal} {product.purity}</p>
                {product.estimatedPrice ? (
                  <p className="font-heading text-sm text-ink mt-1">
                    {product.estimatedPrice.totalFormatted}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="font-body text-xs text-inkMute mt-2">
            * ऐप पर पूरी सूची देखें और चुनें।
          </p>
        </section>
      ) : null}

      {/* CTA */}
      <div className="rounded-xl bg-bg border border-border p-6 text-center">
        <p className="font-body text-inkMute mb-1">घर पर आज़माने के लिए</p>
        <p className="font-heading text-lg text-ink">{shopName} का ऐप डाउनलोड करें</p>
        <p className="font-body text-sm text-inkMute mt-2">
          ऐप पर अपने पसंदीदा आभूषण चुनें और अनुरोध करें।
        </p>
      </div>
    </div>
  );
}
