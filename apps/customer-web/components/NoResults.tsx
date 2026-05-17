import {
  buildProductsHref,
  RING_SVG,
  EARRING_SVG,
  BANGLE_SVG,
  NECKLACE_SVG,
  PENDANT_SVG,
  SILVER_SVG,
} from '@goldsmith/customer-shared';
import type { ActiveFilters } from './FilterPanel';

interface NoResultsProps {
  filters: ActiveFilters;
  whatsappNumber?: string;
}

const CURATED_CATEGORIES: Array<{ svg: string; labelHi: string; sublabelHi: string; href: string }> = [
  { svg: RING_SVG,     labelHi: 'सोना',       sublabelHi: 'सम्पूर्ण संग्रह', href: '/products?metal=GOLD' },
  { svg: SILVER_SVG,   labelHi: 'चाँदी',       sublabelHi: 'सम्पूर्ण संग्रह', href: '/products?metal=SILVER' },
  { svg: EARRING_SVG,  labelHi: '22K विशेष',   sublabelHi: 'शुद्धता',         href: '/products?purity=GOLD_22K' },
  { svg: NECKLACE_SVG, labelHi: 'लोकप्रिय',    sublabelHi: 'सबसे ज़्यादा बिकने वाले', href: '/products?sort=trending' },
];

function getSuggestions(filters: ActiveFilters): Array<{ labelHi: string; href: string }> {
  const suggestions: Array<{ labelHi: string; href: string }> = [];

  if (filters.purity) {
    const PURITY_ORDER = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_925', 'SILVER_999'] as const;
    const idx = PURITY_ORDER.indexOf(filters.purity as (typeof PURITY_ORDER)[number]);
    if (idx > 0) {
      const adj = PURITY_ORDER[idx - 1]!;
      suggestions.push({ labelHi: `${adj.replace('GOLD_', '').replace('SILVER_', '')} देखें`, href: buildProductsHref({ ...filters, purity: adj }) });
    }
    if (idx < PURITY_ORDER.length - 1) {
      const adj2 = PURITY_ORDER[idx + 1]!;
      suggestions.push({ labelHi: `${adj2.replace('GOLD_', '').replace('SILVER_', '')} देखें`, href: buildProductsHref({ ...filters, purity: adj2 }) });
    }
    suggestions.push({ labelHi: 'सभी शुद्धता', href: buildProductsHref({ ...filters, purity: undefined }) });
  } else if (filters.metal) {
    suggestions.push({ labelHi: 'सभी धातु', href: buildProductsHref({ search: filters.search }) });
  } else if (filters.style) {
    suggestions.push({ labelHi: 'स्टाइल हटाएं', href: buildProductsHref({ ...filters, style: undefined }) });
  } else if (filters.search) {
    suggestions.push({ labelHi: 'खोज शब्द हटाएं', href: buildProductsHref({ ...filters, search: undefined }) });
  }

  return suggestions.slice(0, 3);
}

export function NoResults({ filters, whatsappNumber }: NoResultsProps) {
  const suggestions = getSuggestions(filters);
  const waMessage = filters.search
    ? `नमस्ते, मैं "${filters.search}" जैसा आभूषण खोज रहा/रही हूँ। क्या उपलब्ध है?`
    : 'नमस्ते, मुझे कुछ आभूषण देखने हैं।';
  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`
    : null;

  const headline = filters.search
    ? `"${filters.search}" पर अभी कुछ नहीं`
    : 'इस फ़िल्टर में अभी कुछ नहीं';

  return (
    <div role="status" aria-live="polite" className="py-10 md:py-14">
      {/* ── Decorative illustration trio ──────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-6 md:gap-10 mb-8 opacity-55"
        aria-hidden="true"
      >
        {[RING_SVG, PENDANT_SVG, BANGLE_SVG].map((svg, i) => (
          <img
            key={i}
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
            alt=""
            className={`h-16 md:h-20 ${i === 1 ? '-translate-y-2 md:-translate-y-3' : ''}`}
          />
        ))}
      </div>

      {/* ── Editorial copy ────────────────────────────────────────────────── */}
      <div className="text-center mb-10 px-4">
        <p className="font-prose text-[11px] uppercase tracking-[0.28em] text-inkMute mb-3">
          सूचना
        </p>
        <h2 className="font-heading text-2xl md:text-[1.875rem] leading-tight text-ink">
          {headline}
        </h2>
        <p className="font-prose text-sm md:text-[15px] text-inkMute mt-3 max-w-md mx-auto leading-relaxed">
          हमारी प्रसिद्ध श्रेणियों से शुरू करें — सभी BIS हॉलमार्क और HUID सत्यापित।
        </p>
      </div>

      {/* ── Curated category cards ────────────────────────────────────────── */}
      <div
        className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 px-4 mb-10"
        aria-label="व्यवस्थित श्रेणियाँ"
      >
        {CURATED_CATEGORIES.map(({ svg, labelHi, sublabelHi, href }) => (
          <a
            key={labelHi}
            href={href}
            className="group flex flex-col items-center text-center gap-2 p-4 rounded-md border border-borderSubtle bg-surface hover:border-primary hover:-translate-y-0.5 hover:shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="h-20 flex items-center justify-center">
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
                alt=""
                aria-hidden="true"
                className="h-full transition-transform group-hover:scale-105"
              />
            </div>
            <div className="mt-1">
              <p className="font-heading text-base text-ink leading-tight">{labelHi}</p>
              <p className="font-prose text-[11px] text-inkMute mt-0.5 tracking-wide">{sublabelHi}</p>
            </div>
          </a>
        ))}
      </div>

      {/* ── Adjacent-filter suggestion chips (when filters are active) ────── */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-4 mb-7" aria-label="मिलते-जुलते फ़िल्टर">
          <span className="font-prose text-xs uppercase tracking-[0.2em] text-inkMute self-center mr-1">
            या आज़माएँ
          </span>
          {suggestions.map((s, i) => (
            <a
              key={i}
              href={s.href}
              className="inline-flex items-center rounded-pill border border-border bg-bg px-4 py-1.5 font-ui text-sm text-ink hover:bg-primaryWash hover:border-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              {s.labelHi}
            </a>
          ))}
        </div>
      )}

      {/* ── Tertiary actions ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
        <a
          href="/products"
          className="font-ui text-sm text-primaryDeep underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          सभी फ़िल्टर हटाएं
        </a>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-pill border border-successJade bg-successWash px-5 py-2 font-ui text-sm text-successJade hover:bg-successJade/15 transition-colors focus-visible:outline-2 focus-visible:outline-successJade"
          >
            <span aria-hidden="true">💬</span>
            दुकान से व्यक्तिगत सहायता
          </a>
        )}
      </div>
    </div>
  );
}
