const PILLARS = [
  {
    key: 'huid',
    titleHi: 'BIS/HUID प्रमाणित',
    bodyHi: 'हर गहना BIS हॉलमार्क और HUID के साथ',
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
    bodyHi: 'लाइव गोल्ड रेट पर सटीक अनुमान',
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
    bodyHi: '7 दिनों में बिना सवाल एक्सचेंज',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M5 12l4-4m0 0l-4-4m4 4H23M23 16l-4 4m0 0l4 4m-4-4H5"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'try-home',
    titleHi: 'घर पर ट्राय करें',
    bodyHi: 'पसंद करें, घर पर पहन कर देखें',
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
      className="py-12 bg-bg border-t border-borderSubtle"
    >
      <div className="max-w-6xl mx-auto px-4">
        <h2 id="promise-heading" className="font-heading text-2xl text-ink text-center mb-8">
          हमारा वादा
        </h2>

        {/* Desktop: 5 columns */}
        <div className="hidden md:grid grid-cols-5 gap-6">
          {PILLARS.map((p) => (
            <div key={p.key} className="flex flex-col items-center gap-3 text-center">
              <div className="text-primaryDeep">{p.icon}</div>
              <p className="font-ui font-semibold text-sm text-ink">{p.titleHi}</p>
              <p className="font-ui text-xs text-inkSoft leading-relaxed">{p.bodyHi}</p>
            </div>
          ))}
        </div>

        {/* Mobile: 2-col grid */}
        <div className="md:hidden grid grid-cols-2 gap-5">
          {PILLARS.map((p) => (
            <div key={p.key} className="flex flex-col items-center gap-2 text-center">
              <div className="text-primaryDeep">{p.icon}</div>
              <p className="font-ui font-semibold text-sm text-ink">{p.titleHi}</p>
              <p className="font-ui text-xs text-inkSoft leading-relaxed">{p.bodyHi}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
