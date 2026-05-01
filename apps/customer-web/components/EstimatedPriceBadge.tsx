interface EstimatedPriceBadgeProps {
  priceAvailable: boolean;
  totalFormatted?: string;
  compact?: boolean;
}

export function EstimatedPriceBadge({ priceAvailable, totalFormatted, compact = false }: EstimatedPriceBadgeProps) {
  if (!priceAvailable || !totalFormatted) {
    return (
      <span className="font-body text-sm text-inkMute" aria-label="मूल्य के लिए संपर्क करें">
        मूल्य के लिए संपर्क करें
      </span>
    );
  }
  if (compact) {
    return (
      <div className="flex flex-col">
        <span className="font-body font-semibold text-ink text-base">{totalFormatted}</span>
        <span className="font-body text-xs text-inkMute">अनुमानित</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-body font-semibold text-ink text-xl">{totalFormatted}</span>
      <span className="font-body text-xs text-inkMute">
        अनुमानित मूल्य
        <span
          className="ml-1 cursor-help underline decoration-dotted"
          title="पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं"
          aria-label="पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं"
        >
          (?)
        </span>
      </span>
    </div>
  );
}
