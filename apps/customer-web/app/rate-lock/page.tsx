import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig, fetchPublicRates } from '@/lib/api';

export const metadata: Metadata = { title: 'दर-लॉक बुकिंग' };

export default async function RateLockPage(): Promise<JSX.Element> {
  const slug   = resolveShopSlug(headers());
  const config = slug ? await fetchTenantConfig(slug) : null;

  const rates      = await fetchPublicRates();
  const gold24kRup = rates?.GOLD_24K?.perGramRupees
    ? Math.round(Number(rates.GOLD_24K.perGramRupees))
    : null;

  const KARAT_ROWS = [
    { label: '24K', numerator: 24 },
    { label: '22K', numerator: 22 },
    { label: '20K', numerator: 20 },
    { label: '18K', numerator: 18 },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-heading text-3xl text-ink mb-2">दर-लॉक बुकिंग</h1>
      <p className="font-body text-inkMute mb-8">
        आज की सोने की दर बंद करें — कल बढ़े तो भी आज की दर पर खरीदारी करें।
      </p>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-6 mb-8">
        <p className="font-body text-sm text-amber-700 mb-3">आज की सोने की दरें</p>
        {gold24kRup !== null ? (
          <div className="grid grid-cols-2 gap-3">
            {KARAT_ROWS.map(({ label, numerator }) => (
              <div key={label} className="bg-white rounded-lg p-3 border border-amber-100">
                <p className="font-body text-xs text-inkMute mb-1">{label} सोना</p>
                <p
                  className="font-heading text-xl text-ink"
                  aria-label={`${label} सोना ₹${Math.round(gold24kRup * numerator / 24).toLocaleString('en-IN')} प्रति ग्राम`}
                >
                  ₹{Math.round(gold24kRup * numerator / 24).toLocaleString('en-IN')}/g
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-body text-amber-700">दर अभी उपलब्ध नहीं है।</p>
        )}
        {rates?.stale ? (
          <p className="font-body text-xs text-amber-600 mt-3">
            * ये दरें अंतिम उपलब्ध दरें हैं।
          </p>
        ) : null}
      </div>

      <section aria-labelledby="how-heading" className="mb-8">
        <h2 id="how-heading" className="font-heading text-xl text-ink mb-4">
          दर-लॉक कैसे करें?
        </h2>
        <ol className="space-y-3 font-body text-ink">
          {[
            'ऐप में लॉग इन करें।',
            'टोकन राशि (जमा) तय करें और Razorpay पर भुगतान करें।',
            'बुकिंग सक्रिय होते ही दर बंद हो जाती है।',
            'तय समयसीमा में इस दर पर खरीदारी करें।',
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

      <div className="rounded-xl bg-bg border border-border p-6 text-center">
        <p className="font-body text-inkMute mb-1">दर-लॉक करने के लिए</p>
        <p className="font-heading text-lg text-ink">
          {config?.appName ?? 'हमारी दुकान'} का ऐप डाउनलोड करें
        </p>
        <p className="font-body text-sm text-inkMute mt-2">
          ऐप पर लॉग इन करके सीधे Razorpay पर भुगतान करें।
        </p>
      </div>
    </div>
  );
}
