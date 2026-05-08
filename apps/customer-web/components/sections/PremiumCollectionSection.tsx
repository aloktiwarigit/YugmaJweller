
interface PremiumCollectionSectionProps {
  enabled?: boolean;
}

const PREMIUM_TILES = [
  { key: 'bridal',     labelHi: 'ब्राइडल कलेक्शन',  href: '/products?style=BRIDAL'     },
  { key: 'diamond',    labelHi: 'हीरे की ज्वेलरी',   href: '/products?search=diamond'   },
  { key: 'statement',  labelHi: 'स्टेटमेंट पीस',    href: '/products?style=STATEMENT'  },
  { key: 'wedding',    labelHi: 'वेडिंग एडिट',       href: '/products?occasion=WEDDING' },
];

export function PremiumCollectionSection({ enabled = true }: PremiumCollectionSectionProps) {
  if (!enabled) return null;

  return (
    <section
      aria-labelledby="premium-heading"
      className="py-14"
      style={{ backgroundColor: '#1E2440' }} // ink — only dark surface on page
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Heading on dark bg uses cream text */}
        <div className="mb-8">
          <p className="font-prose italic text-xs tracking-wide mb-1" style={{ color: '#B58A3C' }}>
            प्रीमियम संग्रह / Premium Collection
          </p>
          <h2
            id="premium-heading"
            className="font-heading text-3xl"
            style={{ color: '#F5EDDD' }}
          >
            विशेष आभूषण
          </h2>
        </div>

        {/* Desktop: 4-column grid */}
        <div className="hidden md:grid grid-cols-4 gap-4">
          {PREMIUM_TILES.map((tile) => (
            <a
              key={tile.key}
              href={tile.href}
              className="group flex flex-col rounded-lg overflow-hidden border focus-visible:outline-2"
              style={{ borderColor: '#B58A3C33', aspectRatio: '3/4' }}
            >
              {/* Image placeholder on dark bg */}
              <div
                className="flex-1 flex items-center justify-center"
                style={{ backgroundColor: '#2A3054' }}
                aria-hidden="true"
              >
                <span className="font-heading text-5xl" style={{ color: '#B58A3C33' }}>✦</span>
              </div>
              <div className="px-4 py-3" style={{ backgroundColor: '#232847' }}>
                <p className="font-ui font-semibold text-sm group-hover:opacity-80 transition-opacity"
                   style={{ color: '#F5EDDD' }}>
                  {tile.labelHi}
                </p>
                <p className="font-ui text-xs mt-0.5" style={{ color: '#B58A3C' }}>
                  देखें →
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Mobile: single full-bleed image + 4 stacked link-rows */}
        <div className="md:hidden flex flex-col gap-0.5">
          <div
            className="w-full flex items-center justify-center rounded-t-lg"
            style={{ aspectRatio: '16/9', backgroundColor: '#2A3054' }}
            aria-hidden="true"
          >
            <span className="font-heading text-6xl" style={{ color: '#B58A3C33' }}>✦</span>
          </div>
          {PREMIUM_TILES.map((tile) => (
            <a
              key={tile.key}
              href={tile.href}
              className="flex items-center justify-between px-5 py-4 focus-visible:outline-2"
              style={{ backgroundColor: '#232847', borderTop: '1px solid #B58A3C22' }}
            >
              <span className="font-ui font-semibold text-sm" style={{ color: '#F5EDDD' }}>
                {tile.labelHi}
              </span>
              <span style={{ color: '#B58A3C' }}>→</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
