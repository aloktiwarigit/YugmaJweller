import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig } from '@/lib/api';

export default async function PrivacyPage() {
  const slug = resolveShopSlug(headers());
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

        <h2 className="mt-4 font-heading text-xl text-ink">वर्चुअल ट्राय-ऑन और कैमरा</h2>
        <p>
          वर्चुअल ट्राय-ऑन पूरी तरह आपके डिवाइस पर चलता है। कैमरा का दृश्य केवल आपके फ़ोन/ब्राउज़र
          में संसाधित होता है — कोई वीडियो या फ़ोटो किसी सर्वर पर नहीं भेजी जाती, सहेजी नहीं जाती,
          और कोई चेहरा-पहचान टेम्पलेट नहीं बनाया जाता।
        </p>
        <p className="text-sm text-inkMute">
          हम केवल आपकी सहमति का रिकॉर्ड रखते हैं (कोई कैमरा डेटा नहीं)। यह सुविधा DPDPA 2023 के
          अनुरूप बनाई गई है। कैमरा अनुमति आप कभी भी डिवाइस सेटिंग्स से बंद कर सकते हैं।
        </p>
      </div>
    </div>
  );
}
