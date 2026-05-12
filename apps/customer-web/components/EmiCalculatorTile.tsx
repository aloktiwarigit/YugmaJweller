import { emiRows, formatInrFromPaise } from '@/lib/storefront';

interface EmiCalculatorTileProps {
  totalPaise: number;
}

export function EmiCalculatorTile({ totalPaise }: EmiCalculatorTileProps) {
  if (totalPaise < 5_000_000) return null;

  return (
    <section aria-labelledby="emi-heading" className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="emi-heading" className="font-body text-sm font-semibold text-ink">
            EMI अनुमान
          </h2>
          <p className="mt-1 font-body text-xs leading-relaxed text-inkMute">
            यह केवल अनुमान है। अंतिम भुगतान विकल्प दुकान पर तय होंगे।
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 font-body text-xs text-primary">
          ₹50K+
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        {emiRows(totalPaise).map((row) => (
          <div key={row.months} className="rounded-md border border-border bg-bg p-3">
            <dt className="font-body text-xs text-inkMute">{row.months} महीने</dt>
            <dd className="font-body text-sm font-semibold text-ink">
              {formatInrFromPaise(row.monthlyPaise)} / माह
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
