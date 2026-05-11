const FOOTER_COLS = [
  {
    headingHi: 'खरीदारी',
    links: [
      { labelHi: 'सोना',    href: '/products?metal=GOLD'   },
      { labelHi: 'हीरा',    href: '/products?search=diamond' },
      { labelHi: 'चाँदी',  href: '/products?metal=SILVER'  },
      { labelHi: 'नई आय',  href: '/products?sort=newest'   },
      { labelHi: 'कलेक्शन', href: '/collections'           },
    ],
  },
  {
    headingHi: 'गाइड',
    links: [
      { labelHi: 'धातु गाइड',    href: '/size-guide'     },
      { labelHi: 'HUID क्या है?', href: '/size-guide'     },
      { labelHi: 'कैरट गाइड',   href: '/size-guide'      },
      { labelHi: 'ज्वेलरी केयर', href: '/size-guide'      },
    ],
  },
  {
    headingHi: 'सेवा',
    links: [
      { labelHi: 'घर पर ट्राय', href: '/try-at-home'     },
      { labelHi: 'रेट लॉक',     href: '/rate-lock'        },
      { labelHi: 'एक्सचेंज',    href: '/return-policy'   },
      { labelHi: 'WhatsApp',     href: 'https://wa.me/'  },
    ],
  },
  {
    headingHi: 'नीतियाँ',
    links: [
      { labelHi: 'वापसी नीति',   href: '/return-policy'  },
      { labelHi: 'गोपनीयता',     href: '/return-policy'  },
      { labelHi: 'नियम व शर्तें', href: '/return-policy' },
    ],
  },
  {
    headingHi: 'संपर्क',
    links: [
      { labelHi: 'दुकान का पता', href: '/contact'         },
      { labelHi: 'WhatsApp',      href: 'https://wa.me/' },
      { labelHi: 'Email',         href: '/contact'        },
    ],
  },
];

interface FooterProps {
  shopName: string;
  bisLicense?: string;
  gstNumber?: string;
}

export function Footer({ shopName, bisLicense, gstNumber }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-surfaceRecessed border-t border-borderSubtle" aria-label="साइट फुटर">
      {/* 5-column nav */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Desktop */}
        <div className="hidden md:grid grid-cols-5 gap-8">
          {FOOTER_COLS.map((col) => (
            <div key={col.headingHi}>
              <h3 className="font-ui font-semibold text-xs text-inkSoft uppercase tracking-widest mb-4">
                {col.headingHi}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.labelHi}>
                    <a
                      href={link.href}
                      className="font-ui text-sm text-inkMute hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {link.labelHi}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mobile: collapsed accordions */}
        <div className="md:hidden flex flex-col divide-y divide-borderSubtle">
          {FOOTER_COLS.map((col) => (
            <details key={col.headingHi} className="group py-3">
              <summary className="font-ui font-semibold text-sm text-ink cursor-pointer list-none flex justify-between">
                {col.headingHi}
                <span className="group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
              </summary>
              <ul className="mt-3 flex flex-col gap-2 pl-2">
                {col.links.map((link) => (
                  <li key={link.labelHi}>
                    <a
                      href={link.href}
                      className="font-ui text-sm text-inkMute hover:text-ink"
                    >
                      {link.labelHi}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-borderSubtle">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-xs font-ui text-inkSoft">
          <span>© {year} {shopName}. सर्वाधिकार सुरक्षित।</span>
          <div className="flex flex-wrap gap-4">
            {bisLicense && <span>BIS लाइसेंस: {bisLicense}</span>}
            {gstNumber  && <span>GST: {gstNumber}</span>}
          </div>
        </div>
      </div>
    </footer>
  );
}
