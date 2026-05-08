import type { PublicRatesResponse } from '@goldsmith/customer-shared';

interface RetailRateStripProps {
  rates: PublicRatesResponse | null;
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function RetailRateStrip({ rates }: RetailRateStripProps) {
  if (!rates) {
    return (
      <section
        aria-labelledby="rates-strip-heading"
        className="bg-surfaceElevated border-y border-borderSubtle py-4 px-4 text-center"
      >
        <span className="font-ui text-sm text-inkSoft">
          आज की दर के लिए{' '}
          <a
            href="/contact"
            className="text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            दुकान से संपर्क करें
          </a>
        </span>
      </section>
    );
  }

  const ago = minutesAgo(rates.refreshedAt);
  const ageLabel = ago <= 1 ? 'अभी अपडेट' : `${ago} मिनट पहले`;

  const cells = [
    { key: 'GOLD_24K',   labelHi: 'सोना 24K',   rate: rates.GOLD_24K },
    { key: 'GOLD_22K',   labelHi: 'सोना 22K',   rate: rates.GOLD_22K },
    { key: 'SILVER_999', labelHi: 'चाँदी 999',  rate: rates.SILVER_999 },
  ] as const;

  return (
    <section
      role="region"
      aria-labelledby="rates-strip-heading"
      aria-live="polite"
      className="bg-surfaceElevated border-y border-borderSubtle"
    >
      <h2 id="rates-strip-heading" className="sr-only">आज की धातु दरें</h2>
      <div className="max-w-6xl mx-auto flex items-center divide-x divide-borderSubtle overflow-x-auto">
        {cells.map(({ key, labelHi, rate }) => (
          <div key={key} className="flex flex-col items-center px-8 py-4 min-w-[120px] flex-1">
            <span className="font-ui text-xs text-inkSoft mb-0.5">{labelHi}</span>
            <span
              className="font-ui font-bold text-lg text-ink tabular-nums"
              aria-label={`${labelHi}: ${rate.formattedINR} प्रति ग्राम`}
            >
              {rate.formattedINR}
            </span>
            <span className="font-ui text-xs text-inkSoft">प्रति ग्राम</span>
          </div>
        ))}
        <div className="flex flex-col items-center px-8 py-4 min-w-[140px] flex-1">
          <span className="font-ui text-xs text-inkSoft mb-0.5">{ageLabel}</span>
          <span className="font-ui text-xs text-inkSoft text-center">प्रति ग्राम</span>
          {rates.stale && (
            <span className="mt-1 text-xs font-ui text-warningSaffron">पुरानी दर</span>
          )}
        </div>
      </div>
    </section>
  );
}
