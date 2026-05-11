import { STOREFRONT_GIFT_PERSONAS } from '@goldsmith/customer-shared';
import { SectionHeading } from './SectionHeading';

export function GiftPersonasSection() {
  return (
    <section aria-labelledby="gift-personas-heading" className="py-10">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading
          id="gift-personas-heading"
          titleHi="किसके लिए उपहार?"
          eyebrowHi="गिफ्ट"
          eyebrowEn="Gift"
        />

        {/* Desktop: 6-column grid */}
        <div className="hidden md:grid grid-cols-6 gap-4">
          {STOREFRONT_GIFT_PERSONAS.map((persona) => (
            <a
              key={persona.key}
              href={persona.href}
              className="group relative flex flex-col rounded-lg overflow-hidden border border-borderSubtle hover:shadow-md hover:border-borderStrong transition-all focus-visible:outline-2 focus-visible:outline-primary"
              style={{ aspectRatio: '4/5' }}
            >
              {/* Lifestyle image placeholder — cream bg + Devanagari initial */}
              <div className="absolute inset-0 bg-primaryWash flex items-center justify-center" aria-hidden="true">
                <span className="font-heading text-5xl text-primary/30">
                  {persona.labelHi.slice(0, 1)}
                </span>
              </div>
              {/* Bottom-left text overlay with cream scrim */}
              <div
                className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8"
                style={{ background: 'linear-gradient(to top, rgba(245,237,221,0.92) 0%, transparent 100%)' }}
              >
                <p className="font-prose italic text-xs text-inkSoft">गिफ्ट / Gift</p>
                <p className="font-heading text-base text-ink leading-tight">{persona.labelHi}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Mobile: horizontal scroll-snap (1.4 cards visible) */}
        <div
          className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
          style={{ scrollPaddingLeft: '1rem' }}
        >
          {STOREFRONT_GIFT_PERSONAS.map((persona) => (
            <a
              key={persona.key}
              href={persona.href}
              className="snap-start shrink-0 relative flex flex-col rounded-lg overflow-hidden border border-borderSubtle focus-visible:outline-2 focus-visible:outline-primary"
              style={{ width: '56vw', aspectRatio: '4/5' }}
            >
              <div className="absolute inset-0 bg-primaryWash flex items-center justify-center" aria-hidden="true">
                <span className="font-heading text-5xl text-primary/30">
                  {persona.labelHi.slice(0, 1)}
                </span>
              </div>
              <div
                className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8"
                style={{ background: 'linear-gradient(to top, rgba(245,237,221,0.92) 0%, transparent 100%)' }}
              >
                <p className="font-prose italic text-xs text-inkSoft">गिफ्ट</p>
                <p className="font-heading text-base text-ink">{persona.labelHi}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
