import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig } from '@/lib/api';
import { tenantCancellationPolicy } from '@/lib/storefront';

export default async function CancellationPolicyPage() {
  const slug = resolveShopSlug(headers());
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  const policyText = tenantCancellationPolicy(config);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <a
        href="/products"
        className="mb-6 inline-block font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        उत्पाद देखें
      </a>

      <h1 className="mb-6 font-heading text-3xl text-ink">कैंसिलेशन नीति</h1>

      <div className="rounded-lg border border-border bg-white p-6">
        {policyText ? (
          <p className="whitespace-pre-wrap font-body text-base leading-relaxed text-ink">
            {policyText}
          </p>
        ) : (
          <div className="flex flex-col gap-3 font-body text-base leading-relaxed text-ink">
            <p>
              {config.appName} की कैंसिलेशन नीति अभी ऑनलाइन प्रकाशित नहीं है। ऑर्डर बदलने,
              बुकिंग रद्द करने या जमा राशि से जुड़ी जानकारी के लिए दुकान से संपर्क करें।
            </p>
            <p className="text-sm text-inkMute">
              कस्टम ऑर्डर, दर-लॉक और घर पर ट्राई बुकिंग के नियम अलग हो सकते हैं।
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
