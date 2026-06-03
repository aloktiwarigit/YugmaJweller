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
        className="border-y border-borderSubtle bg-surfaceElevated px-4 py-3 text-center"
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
      className="border-y border-primary/20 bg-ink text-white"
    >
      <h2 id="rates-strip-heading" className="sr-only">आज की धातु दरें</h2>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center justify-between gap-4 md:w-44 md:flex-col md:items-start md:justify-center">
          <div>
            <p className="font-prose text-xs uppercase tracking-[0.16em] text-primary">आज की दर</p>
            <p className="mt-0.5 font-ui text-xs text-white/66">प्रति ग्राम</p>
          </div>
          <p className="font-ui text-xs text-white/66 md:mt-1">{ageLabel}</p>
        </div>

        <div className="grid flex-1 grid-cols-3 overflow-hidden rounded-md border border-white/10 bg-white/10">
          {cells.map(({ key, labelHi, rate }) => (
            <div key={key} className="min-w-0 border-r border-white/10 px-3 py-3 text-center last:border-r-0">
              <span className="block truncate font-ui text-xs text-white/68">{labelHi}</span>
              <span
                className="mt-1 block truncate font-ui text-base font-bold tabular-nums text-white md:text-lg"
                aria-label={`${labelHi}: ${rate.formattedINR} प्रति ग्राम`}
              >
                {rate.formattedINR}
              </span>
              {rates.stale && key === 'SILVER_999' ? (
                <span className="mt-1 block text-xs font-ui text-warningSaffron">पुरानी दर</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
