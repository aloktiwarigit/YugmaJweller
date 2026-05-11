import { SectionHeading } from './SectionHeading';

const EVERYDAY_TILES = [
  { key: 'daily-rings',    labelHi: 'रोज़ाना अंगूठी',  href: '/products?style=DAILY_WEAR&search=ring'    },
  { key: 'studs',          labelHi: 'टॉप्स / स्टड्स',  href: '/products?style=STUDS'                     },
  { key: 'office',         labelHi: 'ऑफिस वेयर',       href: '/products?style=OFFICE'                    },
  { key: 'chains',         labelHi: 'सादी चेन',         href: '/products?search=chain'                    },
  { key: 'silver-bangles', labelHi: 'चाँदी चूड़ी',     href: '/products?metal=SILVER&search=bangle'      },
  { key: 'kids',           labelHi: 'बच्चों के लिए',   href: '/products?style=KIDS'                      },
];

export function EverydayCollectionSection() {
  return (
    <section aria-labelledby="everyday-heading" className="py-10 bg-bg">
      <div className="max-w-6xl mx-auto px-4">
        <SectionHeading
          id="everyday-heading"
          titleHi="रोज़मर्रा की पसंद"
          eyebrowHi="एवरीडे कलेक्शन"
          eyebrowEn="Everyday Collection"
        />

        <div className="grid grid-cols-3 gap-3">
          {EVERYDAY_TILES.map((tile) => (
            <a
              key={tile.key}
              href={tile.href}
              className="group flex items-center justify-center px-4 py-5 bg-surfaceElevated border border-borderSubtle rounded-md hover:border-borderStrong hover:shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-primary text-center"
            >
              <span className="font-ui font-medium text-sm text-ink group-hover:text-primaryDeep transition-colors">
                {tile.labelHi}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
