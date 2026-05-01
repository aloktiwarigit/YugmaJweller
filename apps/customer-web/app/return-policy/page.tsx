import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { fetchTenantConfig, fetchReturnPolicy } from '@/lib/api';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function ReturnPolicyPage() {
  const slug = resolveSlug();
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  const policyText = await fetchReturnPolicy(config.shopId);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a
        href="/products"
        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
      >
        ← उत्पाद देखें
      </a>

      <h1 className="font-heading text-3xl text-ink mb-6">वापसी और आदान-प्रदान नीति</h1>

      {policyText ? (
        <div className="bg-white rounded-lg border border-border p-6">
          <p className="font-body text-base text-ink leading-relaxed whitespace-pre-wrap">{policyText}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-border p-6">
          <p className="font-body text-base text-inkMute">
            इस दुकान की वापसी नीति अभी उपलब्ध नहीं है। अधिक जानकारी के लिए दुकान पर संपर्क करें।
          </p>
        </div>
      )}
    </div>
  );
}
