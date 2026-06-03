interface HuidBadgeProps {
  huid: string | null;
  exemptionCategory: string | null;
}

export function HuidBadge({ huid, exemptionCategory }: HuidBadgeProps) {
  if (huid) {
    return (
      <span
        className="inline-flex max-w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-body text-primary border border-primary/30"
        aria-label={`हॉलमार्क प्रमाणित — HUID: ${huid}`}
      >
        <span className="shrink-0">हॉलमार्क ✓</span> <span className="truncate font-mono">{huid}</span>
      </span>
    );
  }
  if (exemptionCategory === 'kundan_polki_jadau') {
    return (
      <span className="inline-flex items-center rounded-full bg-border px-2 py-0.5 text-xs font-body text-inkMute">
        कुंदन/पोलकी (HUID छूट)
      </span>
    );
  }
  if (exemptionCategory === 'under_2g') {
    return (
      <span className="inline-flex items-center rounded-full bg-border px-2 py-0.5 text-xs font-body text-inkMute">
        2ग्राम से कम (HUID छूट)
      </span>
    );
  }
  return null;
}
