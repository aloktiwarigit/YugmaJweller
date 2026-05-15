import { notFound } from 'next/navigation';
import { fetchTenantConfig } from '@/lib/api';
import { tenantShippingPolicy } from '@/lib/storefront';

const SHOP_SLUG = process.env.NEXT_PUBLIC_SHOP_SLUG ?? null;

export default async function ShippingPolicyPage() {
  if (!SHOP_SLUG) notFound();

  const config = await fetchTenantConfig(SHOP_SLUG);
  if (!config) notFound();

  const policyText = tenantShippingPolicy(config);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <a
        href="/products"
        className="mb-6 inline-block font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        उत्पाद देखें
      </a>

      <h1 className="mb-6 font-heading text-3xl text-ink">शिपिंग नीति</h1>

      <div className="rounded-lg border border-border bg-white p-6">
        {policyText ? (
          <p className="whitespace-pre-wrap font-body text-base leading-relaxed text-ink">
            {policyText}
          </p>
        ) : (
          <div className="flex flex-col gap-3 font-body text-base leading-relaxed text-ink">
            <p>
              {config.appName} की शिपिंग नीति अभी ऑनलाइन प्रकाशित नहीं है। कृपया डिलीवरी,
              पिकअप या बीमा की जानकारी के लिए दुकान से संपर्क करें।
            </p>
            <p className="text-sm text-inkMute">
              महंगे आभूषणों के लिए अंतिम डिलीवरी समय, पहचान सत्यापन और पैकेजिंग नियम दुकान
              द्वारा पुष्टि किए जाएंगे।
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
