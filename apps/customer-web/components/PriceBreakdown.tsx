import type { EstimatedPrice } from '@/lib/api';

function fmt(paiseStr: string): string {
  const rupees = Number(paiseStr) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

interface PriceBreakdownProps {
  price: EstimatedPrice;
}

export function PriceBreakdown({ price }: PriceBreakdownProps) {
  const { breakdown, totalFormatted } = price;

  return (
    <section aria-label="मूल्य विवरण" className="rounded-lg border border-border bg-bg p-4 flex flex-col gap-2">
      <h3 className="font-body text-sm font-semibold text-ink">मूल्य विवरण</h3>
      <dl className="flex flex-col gap-1.5 font-body text-sm">
        <div className="flex justify-between">
          <dt className="text-inkMute">धातु मूल्य</dt>
          <dd className="text-ink font-medium">{fmt(breakdown.goldValuePaise)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-inkMute">बनाई शुल्क</dt>
          <dd className="text-ink font-medium">{fmt(breakdown.makingChargePaise)}</dd>
        </div>
        <div className="flex justify-between text-xs">
          <dt className="text-inkMute">GST धातु (3%)</dt>
          <dd className="text-ink">{fmt(breakdown.gstMetalPaise)}</dd>
        </div>
        <div className="flex justify-between text-xs">
          <dt className="text-inkMute">GST बनाई (5%)</dt>
          <dd className="text-ink">{fmt(breakdown.gstMakingPaise)}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2 mt-1">
          <dt className="font-semibold text-ink">अनुमानित कुल</dt>
          <dd className="font-semibold text-ink text-base">{totalFormatted}</dd>
        </div>
      </dl>
      <p className="font-body text-xs text-inkMute" role="note">
        * पत्थर, HUID शुल्क और अन्य आभूषण लागत अलग से लागू हो सकती हैं।
      </p>
    </section>
  );
}
