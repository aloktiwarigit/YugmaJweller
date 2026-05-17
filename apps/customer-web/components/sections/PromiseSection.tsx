import Image from 'next/image';

const PILLARS = [
  {
    key: 'huid',
    titleHi: 'BIS/HUID प्रमाणित',
    bodyHi: 'हर योग्य गहने पर हॉलमार्क और HUID भरोसा',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M14 3L5 7v7c0 5 4 9.5 9 11 5-1.5 9-6 9-11V7l-9-4z"
              stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 14l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'pricing',
    titleHi: 'पारदर्शी दाम',
    bodyHi: 'लाइव गोल्ड और सिल्वर रेट पर साफ अनुमान',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 14h10M9 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'exchange',
    titleHi: 'आसान एक्सचेंज',
    bodyHi: 'दुकान की नीति पहले से साफ दिखाई देती है',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M5 12l4-4m0 0l-4-4m4 4H23M23 16l-4 4m0 0l4 4m-4-4H5"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'try-home',
    titleHi: 'घर पर ट्राय',
    bodyHi: 'शॉर्टलिस्ट करें, घर पर पहनकर देखें',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M4 20l6-6 4 4 5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="4" y="8" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 8V6a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'whatsapp',
    titleHi: 'WhatsApp सपोर्ट',
    bodyHi: 'कोई भी सवाल, तुरंत जवाब',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M5 22l1.5-5.5A9 9 0 1014 23a8.9 8.9 0 01-5.5-1.5L5 22z"
              stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M11 11c0-.5.5-1 1-1h.5c.5 0 1 .5 1 1l1 2c0 .5-.5 1-1 1a4 4 0 01-4-4c0-.5.5-1 1-1l.5 1z"
              stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function PromiseSection() {
  return (
    <section
      aria-labelledby="promise-heading"
      className="border-t border-borderSubtle bg-bg py-12"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[0.95fr_1.05fr] md:items-center">
        <div className="relative min-h-[320px] overflow-hidden rounded-md bg-ink md:min-h-[440px]">
          <Image
            src="/demo-shop/campaign-gift-table.jpg"
            alt="Curated jewellery display tray"
            fill
            sizes="(max-width: 768px) 100vw, 520px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/72 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="font-prose text-xs uppercase tracking-[0.18em] text-primary">दुकान का वादा</p>
            <p className="mt-2 font-heading text-2xl text-white">भरोसे के साथ खरीदारी</p>
          </div>
        </div>

        <div>
          <h2 id="promise-heading" className="font-heading text-2xl text-ink md:text-3xl">
            हमारा वादा
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <div key={p.key} className="flex gap-3">
                <div className="shrink-0 text-primaryDeep">{p.icon}</div>
                <div>
                  <p className="font-ui text-sm font-semibold text-ink">{p.titleHi}</p>
                  <p className="mt-1 font-ui text-xs leading-relaxed text-inkSoft">{p.bodyHi}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
