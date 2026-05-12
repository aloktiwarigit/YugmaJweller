import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { fetchTenantConfig } from '@/lib/api';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function TermsPage() {
  const slug = resolveSlug();
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-3xl text-ink">उपयोग की शर्तें</h1>
      <div className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-white p-6 font-body text-base leading-relaxed text-ink">
        <p>
          इस वेबसाइट पर दिखाए गए उत्पाद, मूल्य और उपलब्धता {config.appName} की दुकान से
          अंतिम पुष्टि के अधीन हैं।
        </p>
        <p>
          धातु दर, वजन, मेकिंग चार्ज, कर और उपलब्धता बदल सकते हैं। बुकिंग, दर-लॉक, घर पर
          ट्राई और कस्टम ऑर्डर पर दुकान की प्रकाशित नीति लागू होगी।
        </p>
        <p className="text-sm text-inkMute">
          ग्राहक को बिल, HUID, शुद्धता और सेवा नियम खरीदारी से पहले जांच लेने चाहिए।
        </p>
      </div>
    </div>
  );
}
