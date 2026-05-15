import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig, fetchReturnPolicy } from '@/lib/api';

export default async function ReturnPolicyPage() {
  const slug = resolveShopSlug(headers());
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
