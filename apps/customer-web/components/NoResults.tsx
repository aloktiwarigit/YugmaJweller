import { buildProductsHref } from '@goldsmith/customer-shared';
import type { ActiveFilters } from './FilterPanel';

interface NoResultsProps {
  filters: ActiveFilters;
  whatsappNumber?: string;
}

function getSuggestions(filters: ActiveFilters): Array<{ labelHi: string; href: string }> {
  const suggestions: Array<{ labelHi: string; href: string }> = [];

  if (filters.purity) {
    // suggest adjacent purities
    const PURITY_ORDER = ['24K', '22K', '20K', '18K', '14K', '925', '999'] as const;
    const idx = PURITY_ORDER.indexOf(filters.purity as (typeof PURITY_ORDER)[number]);
    if (idx > 0) {
      const adj = PURITY_ORDER[idx - 1]!;
      suggestions.push({ labelHi: `${adj} देखें`, href: buildProductsHref({ ...filters, purity: adj }) });
    }
    if (idx < PURITY_ORDER.length - 1) {
      const adj2 = PURITY_ORDER[idx + 1]!;
      suggestions.push({ labelHi: `${adj2} देखें`, href: buildProductsHref({ ...filters, purity: adj2 }) });
    }
    suggestions.push({ labelHi: 'सभी शुद्धता देखें', href: buildProductsHref({ ...filters, purity: undefined }) });
  } else if (filters.metal) {
    suggestions.push({ labelHi: 'सभी धातु देखें', href: buildProductsHref({ search: filters.search }) });
    suggestions.push({ labelHi: 'सभी उत्पाद', href: '/products' });
  } else if (filters.style) {
    suggestions.push({ labelHi: 'स्टाइल फ़िल्टर हटाएं', href: buildProductsHref({ ...filters, style: undefined }) });
    suggestions.push({ labelHi: 'सभी उत्पाद', href: '/products' });
  } else {
    suggestions.push({ labelHi: 'सभी उत्पाद देखें', href: '/products' });
    suggestions.push({ labelHi: 'सोने के आभूषण', href: buildProductsHref({ metal: 'GOLD' }) });
    suggestions.push({ labelHi: 'चाँदी के आभूषण', href: buildProductsHref({ metal: 'SILVER' }) });
  }

  return suggestions.slice(0, 3);
}

export function NoResults({ filters, whatsappNumber }: NoResultsProps) {
  const suggestions = getSuggestions(filters);
  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('नमस्ते, मुझे कुछ आभूषण देखने हैं।')}`
    : '#';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-6 py-16 px-4 text-center"
    >
      <div
        className="h-20 w-20 rounded-full bg-surfaceRecessed flex items-center justify-center text-3xl"
        aria-hidden="true"
      >
        🔍
      </div>
      <div>
        <p className="font-ui text-lg font-semibold text-ink">कोई उत्पाद नहीं मिला</p>
        <p className="font-ui text-sm text-inkMute mt-1">
          इस फ़िल्टर से मेल खाने वाले उत्पाद उपलब्ध नहीं हैं।
        </p>
      </div>

      {/* Adjacent suggestions */}
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s, i) => (
          <a
            key={i}
            href={s.href}
            className="rounded-pill border border-border bg-surface px-4 py-2 font-ui text-sm text-ink hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
          >
            {s.labelHi}
          </a>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <a
          href="/products"
          className="font-ui text-sm text-primaryDeep underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          सभी फ़िल्टर हटाएं
        </a>
        {whatsappNumber && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-successJade bg-successWash px-4 py-2 font-ui text-sm text-successJade hover:bg-successJade/20 focus-visible:outline-2 focus-visible:outline-successJade"
          >
            <span aria-hidden="true">💬</span>
            दुकान से पूछें
          </a>
        )}
      </div>
    </div>
  );
}
