import { TRUST_PILLARS } from '@/lib/storefront';

export function TrustPillarStrip() {
  return (
    <section
      aria-label="भरोसे की जानकारी"
      className="grid gap-3 rounded-lg border border-border bg-white p-4 shadow-sm sm:grid-cols-3"
    >
      {TRUST_PILLARS.map((pillar) => (
        <div key={pillar.title} className="flex min-h-[72px] flex-col justify-center gap-1">
          <p className="font-body text-sm font-semibold text-ink">{pillar.title}</p>
          <p className="font-body text-xs leading-relaxed text-inkMute">{pillar.description}</p>
        </div>
      ))}
    </section>
  );
}
