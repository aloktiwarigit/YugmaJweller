import type { PublicRatesResponse } from '@/lib/api';

export function GoldRateCard({ rates }: { rates: PublicRatesResponse | null }) {
  if (!rates) {
    return (
      <div className="rounded-lg border border-border bg-white/60 p-4" aria-label="सोने की दर उपलब्ध नहीं">
        <p className="font-body text-sm text-inkMute text-center">दर अभी उपलब्ध नहीं है</p>
      </div>
    );
  }
  return (
    <div
      className="rounded-lg border border-border bg-white/80 backdrop-blur-sm p-4 shadow-sm"
      role="region"
      aria-label="आज की सोने-चाँदी की दरें"
    >
      <h2 className="font-heading text-lg text-ink mb-3">
        आज की दरें{' '}
        {rates.stale && <span className="font-body text-xs text-inkMute">(पुरानी)</span>}
      </h2>
      <div className="grid grid-cols-3 gap-3" role="list">
        {([
          { label: 'सोना 24K', rate: rates.GOLD_24K },
          { label: 'सोना 22K', rate: rates.GOLD_22K },
          { label: 'चाँदी 999', rate: rates.SILVER_999 },
        ] as const).map(({ label, rate }) => (
          <div key={label} className="flex flex-col" role="listitem">
            <span className="font-body text-xs text-inkMute">{label}</span>
            <span
              className="font-body font-semibold text-ink text-sm"
              aria-label={`${label}: ${rate.formattedINR} प्रति ग्राम`}
            >
              {rate.formattedINR}
            </span>
            <span className="font-body text-xs text-inkMute">/ग्राम</span>
          </div>
        ))}
      </div>
    </div>
  );
}
