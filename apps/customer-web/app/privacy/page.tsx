import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { fetchTenantConfig } from '@/lib/api';

function resolveSlug(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function PrivacyPage() {
  const slug = resolveSlug();
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-3xl text-ink">गोपनीयता नीति</h1>
      <div className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-white p-6 font-body text-base leading-relaxed text-ink">
        <p>
          {config.appName} ग्राहक जानकारी का उपयोग खरीदारी, बुकिंग, सेवा सहायता और सहमति
          आधारित संचार के लिए करता है।
        </p>
        <p>
          फोन नंबर, पसंदीदा उत्पाद, बुकिंग विवरण और सेवा अनुरोध केवल इसी दुकान की सेवा के
          लिए उपयोग किए जाते हैं। ग्राहक अपनी जानकारी हटाने या सुधारने के लिए दुकान से
          संपर्क कर सकते हैं।
        </p>
        <p className="text-sm text-inkMute">
          मार्केटिंग संदेश केवल स्पष्ट सहमति के बाद भेजे जाने चाहिए। ट्रांजैक्शनल सूचना
          सेवा पूरी करने के लिए भेजी जा सकती है।
        </p>
      </div>
    </div>
  );
}
