import { headers } from 'next/headers';
import { resolveShopSlug } from '@/lib/tenant-slug';
import { fetchTenantConfig } from '@/lib/api';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'वफ़ादारी कार्यक्रम' };

const TIER_INFO = [
  { tier: 'रजत', points: '0–499', color: '#9CA3AF', benefit: '₹500 की खरीद पर 5 अंक' },
  { tier: 'स्वर्ण', points: '500–1,999', color: '#B8860B', benefit: 'बोनस अंक + जन्मदिन उपहार' },
  { tier: 'प्लेटिनम', points: '2,000+', color: '#6366F1', benefit: 'प्राथमिकता सेवा + विशेष छूट' },
];

export default async function LoyaltyPage(): Promise<JSX.Element> {
  const slug = resolveShopSlug(headers());
  const config = slug ? await fetchTenantConfig(slug) : null;
  const shopName = config?.appName ?? 'हमारी दुकान';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-heading text-3xl text-ink mb-2">वफ़ादारी कार्यक्रम</h1>
      <p className="font-body text-inkMute mb-8">
        {shopName} पर खरीदारी करें और अंक जीतें।
      </p>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="mb-8">
        <h2 id="how-heading" className="font-heading text-xl text-ink mb-4">
          कैसे काम करता है?
        </h2>
        <ol className="space-y-3 font-body text-ink list-none">
          {[
            'हर खरीद पर सोने के मूल्य का 1% अंक के रूप में मिलता है।',
            'अंक जमा होने पर स्तर अपने आप बदलता है।',
            'अंक अगली खरीद पर छूट के रूप में उपयोग करें।',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
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

      {/* Tiers */}
      <section aria-labelledby="tiers-heading" className="mb-8">
        <h2 id="tiers-heading" className="font-heading text-xl text-ink mb-4">
          सदस्यता स्तर
        </h2>
        <div className="space-y-3">
          {TIER_INFO.map(({ tier, points, color, benefit }) => (
            <div
              key={tier}
              className="rounded-xl border border-border bg-white p-4 flex gap-4 items-center"
            >
              <div
                className="w-3 h-full rounded-full flex-shrink-0 self-stretch"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-heading text-lg" style={{ color }}>{tier}</span>
                  <span className="font-body text-sm text-inkMute">({points} अंक)</span>
                </div>
                <p className="font-body text-sm text-ink">{benefit}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA for mobile app */}
      <div className="rounded-xl bg-bg border border-border p-6 text-center">
        <p className="font-body text-inkMute mb-1">अपने अंक देखने के लिए</p>
        <p className="font-heading text-lg text-ink">
          {shopName} का ऐप डाउनलोड करें
        </p>
        <p className="font-body text-sm text-inkMute mt-2">
          ऐप पर लॉग इन करें और अपना पूरा लेन-देन इतिहास देखें।
        </p>
      </div>
    </div>
  );
}
