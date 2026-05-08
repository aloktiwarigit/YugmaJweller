'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PRICE_BANDS,
  CATALOG_STYLES,
  CATALOG_OCCASIONS,
  buildProductsHref,
  type CatalogSort,
} from '@goldsmith/customer-shared';

// ─── Label maps ──────────────────────────────────────────────────────────────

export const METAL_OPTIONS = [
  { value: '',        labelHi: 'सभी' },
  { value: 'GOLD',    labelHi: 'सोना' },
  { value: 'SILVER',  labelHi: 'चाँदी' },
  { value: 'DIAMOND', labelHi: 'हीरा' },
] as const;

export const PURITY_OPTIONS = [
  { value: '24K', labelHi: '24K सोना' },
  { value: '22K', labelHi: '22K सोना' },
  { value: '20K', labelHi: '20K सोना' },
  { value: '18K', labelHi: '18K सोना' },
  { value: '14K', labelHi: '14K सोना' },
  { value: '925', labelHi: '925 चाँदी' },
  { value: '999', labelHi: '999 चाँदी' },
] as const;

export const STYLE_LABELS_HI: Record<string, string> = {
  DAILY_WEAR:  'रोज़मर्रा',  ENGAGEMENT: 'सगाई',
  COUPLE:      'कपल',         JHUMKA:     'झुमका',
  STUDS:       'स्टड',        HOOPS:      'हूप्स',
  DROP:        'ड्रॉप',       STATEMENT:  'स्टेटमेंट',
  TEMPLE:      'मंदिर',       BRIDAL:     'ब्राइडल',
  OFFICE:      'ऑफिस',        KIDS:       'बच्चे',
};

export const OCCASION_LABELS_HI: Record<string, string> = {
  WEDDING:     'विवाह',       ENGAGEMENT: 'सगाई',
  ANNIVERSARY: 'सालगिरह',    FESTIVAL:   'त्योहार',
  DAILY:       'रोज़मर्रा',   GIFT:       'उपहार',
  OFFICE:      'ऑफिस',        PARTY:      'पार्टी',
};

export const SORT_OPTIONS: { value: CatalogSort; labelHi: string }[] = [
  { value: 'newest',     labelHi: 'नवीनतम' },
  { value: 'priceAsc',   labelHi: 'मूल्य: कम से अधिक' },
  { value: 'priceDesc',  labelHi: 'मूल्य: अधिक से कम' },
  { value: 'trending',   labelHi: 'लोकप्रिय' },
  { value: 'bestseller', labelHi: 'सबसे ज़्यादा बिकने वाले' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveFilters {
  metal?:       string;
  purity?:      string;
  priceMin?:    number;
  priceMax?:    number;
  inStockOnly?: boolean;
  style?:       string;
  occasion?:    string;
  sort?:        string;
  search?:      string;
}

// ─── Shared hook ─────────────────────────────────────────────────────────────

function useFilterNav(filters: ActiveFilters) {
  const router = useRouter();
  return useCallback((patch: Partial<ActiveFilters>) => {
    const next: ActiveFilters = { ...filters, ...patch };
    // Strip empty strings so URL stays clean
    Object.keys(next).forEach(k => {
      if ((next as Record<string, unknown>)[k] === '' || (next as Record<string, unknown>)[k] === undefined) {
        delete (next as Record<string, unknown>)[k];
      }
    });
    router.push(buildProductsHref({
      metal: next.metal, purity: next.purity, priceMin: next.priceMin,
      priceMax: next.priceMax, inStockOnly: next.inStockOnly, style: next.style,
      occasion: next.occasion, sort: next.sort as CatalogSort | undefined, search: next.search,
    }), { scroll: false });
  }, [filters, router]);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterSection({ title, defaultOpen = false, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <fieldset className="border-b border-borderSubtle pb-3 last:border-b-0">
      <legend className="w-full">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center justify-between py-2 font-ui text-sm font-semibold text-ink hover:text-primaryDeep focus-visible:outline-2 focus-visible:outline-primary"
          aria-expanded={open}
        >
          {title}
          <span aria-hidden="true" className="text-inkMute">{open ? '−' : '+'}</span>
        </button>
      </legend>
      {open && <div className="mt-1 flex flex-col gap-0.5">{children}</div>}
    </fieldset>
  );
}

function RadioOpt({ value, labelHi, current, onChange }: {
  value: string; labelHi: string; current: string; onChange: (v: string) => void;
}) {
  const active = current === value;
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 font-ui text-sm transition-colors hover:bg-primaryWash ${active ? 'border-l-2 border-borderStrong text-primaryDeep font-medium' : 'text-ink'}`}
    >
      <input type="radio" name="metal" value={value} checked={active}
        onChange={() => onChange(value)} className="sr-only" aria-label={labelHi} />
      {labelHi}
    </label>
  );
}

function CheckOpt({ value, labelHi, checked, onChange }: {
  value: string; labelHi: string; checked: boolean; onChange: (v: string, on: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 font-ui text-sm transition-colors hover:bg-primaryWash ${checked ? 'border-l-2 border-borderStrong text-primaryDeep font-medium' : 'text-ink'}`}
    >
      <input type="checkbox" checked={checked} onChange={e => onChange(value, e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary" aria-label={labelHi} />
      {labelHi}
    </label>
  );
}

// ─── Shared filter sections markup ────────────────────────────────────────────

function FilterSections({ filters, apply }: { filters: ActiveFilters; apply: (p: Partial<ActiveFilters>) => void }) {
  return (
    <>
      <FilterSection title="धातु" defaultOpen>
        {METAL_OPTIONS.map(m => (
          <RadioOpt key={m.value} value={m.value} labelHi={m.labelHi}
            current={filters.metal ?? ''} onChange={v => apply({ metal: v })} />
        ))}
      </FilterSection>

      <FilterSection title="शुद्धता">
        {PURITY_OPTIONS.map(p => (
          <CheckOpt key={p.value} value={p.value} labelHi={p.labelHi}
            checked={filters.purity === p.value}
            onChange={(v, on) => apply({ purity: on ? v : '' })} />
        ))}
      </FilterSection>

      <FilterSection title="मूल्य">
        {PRICE_BANDS.map(band => {
          const active = filters.priceMin === band.min;
          return (
            <button key={band.min} type="button"
              onClick={() => apply(active ? { priceMin: undefined, priceMax: undefined } : { priceMin: band.min, priceMax: band.max })}
              className={`text-left rounded px-2 py-1.5 font-ui text-sm transition-colors hover:bg-primaryWash ${active ? 'border-l-2 border-borderStrong text-primaryDeep font-medium' : 'text-ink'}`}
              aria-pressed={active}>
              {band.labelHi}
            </button>
          );
        })}
      </FilterSection>

      <FilterSection title="स्टाइल">
        {CATALOG_STYLES.map(s => (
          <CheckOpt key={s} value={s} labelHi={STYLE_LABELS_HI[s] ?? s}
            checked={filters.style === s}
            onChange={(v, on) => apply({ style: on ? v : '' })} />
        ))}
      </FilterSection>

      <FilterSection title="अवसर">
        {CATALOG_OCCASIONS.map(o => (
          <CheckOpt key={o} value={o} labelHi={OCCASION_LABELS_HI[o] ?? o}
            checked={filters.occasion === o}
            onChange={(v, on) => apply({ occasion: on ? v : '' })} />
        ))}
      </FilterSection>

      <FilterSection title="उपलब्धता">
        <CheckOpt value="inStock" labelHi="उपलब्ध उत्पाद ही दिखाएं"
          checked={!!filters.inStockOnly}
          onChange={(_, on) => apply({ inStockOnly: on || undefined })} />
      </FilterSection>
    </>
  );
}

// ─── FilterSidebar — desktop aside ───────────────────────────────────────────

export function FilterSidebar({ filters }: { filters: ActiveFilters }) {
  const router = useRouter();
  const apply = useFilterNav(filters);
  const count = [filters.metal, filters.purity, filters.priceMin !== undefined, filters.inStockOnly, filters.style, filters.occasion].filter(Boolean).length;

  const clearAll = () => router.push(buildProductsHref({ search: filters.search || undefined }), { scroll: false });

  return (
    <aside className="hidden md:block w-44 shrink-0" aria-label="फ़िल्टर साइडबार">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-ui text-sm font-semibold text-ink">फ़िल्टर</h2>
        {count > 0 && (
          <button type="button" onClick={clearAll}
            className="font-ui text-xs text-primaryDeep underline focus-visible:outline-2 focus-visible:outline-primary">
            सभी हटाएं
          </button>
        )}
      </div>
      <FilterSections filters={filters} apply={apply} />
    </aside>
  );
}

// ─── FilterControls — chips ribbon + sort + mobile sheet ─────────────────────

export function FilterControls({ filters, totalCount }: { filters: ActiveFilters; totalCount: number }) {
  const router = useRouter();
  const apply = useFilterNav(filters);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  const clearAll = () => router.push(buildProductsHref({ search: filters.search || undefined }), { scroll: false });

  const count = [filters.metal, filters.purity, filters.priceMin !== undefined, filters.inStockOnly, filters.style, filters.occasion].filter(Boolean).length;

  // Active chips
  const chips: { label: string; clear: Partial<ActiveFilters> }[] = [];
  if (filters.metal)                chips.push({ label: METAL_OPTIONS.find(m => m.value === filters.metal)?.labelHi ?? filters.metal, clear: { metal: '' } });
  if (filters.purity)               chips.push({ label: PURITY_OPTIONS.find(p => p.value === filters.purity)?.labelHi ?? filters.purity, clear: { purity: '' } });
  if (filters.priceMin !== undefined) {
    const band = PRICE_BANDS.find(b => b.min === filters.priceMin);
    chips.push({ label: band?.labelHi ?? `₹${filters.priceMin}+`, clear: { priceMin: undefined, priceMax: undefined } });
  }
  if (filters.inStockOnly) chips.push({ label: 'उपलब्ध', clear: { inStockOnly: undefined } });
  if (filters.style)       chips.push({ label: STYLE_LABELS_HI[filters.style] ?? filters.style, clear: { style: '' } });
  if (filters.occasion)    chips.push({ label: OCCASION_LABELS_HI[filters.occasion] ?? filters.occasion, clear: { occasion: '' } });

  return (
    <>
      {/* ── Active filter chips ──────────────────────────────────────── */}
      {chips.length > 0 && (
        <div role="region" aria-label="सक्रिय फ़िल्टर" className="flex flex-wrap items-center gap-2 py-2">
          <span className="font-ui text-xs text-inkMute">फ़िल्टर:</span>
          {chips.map((chip, i) => (
            <button
              key={i} type="button" onClick={() => apply(chip.clear)}
              className="inline-flex items-center gap-1 rounded-sm bg-primaryWash px-3 py-1 font-ui text-xs text-primaryDeep hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`${chip.label} फ़िल्टर हटाएं`}
            >
              {chip.label}<span aria-hidden="true"> ×</span>
            </button>
          ))}
          <button type="button" onClick={clearAll}
            className="font-ui text-xs text-inkMute underline hover:text-primaryDeep focus-visible:outline-2 focus-visible:outline-primary">
            सभी हटाएं
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {/* ── Mobile: filter + sort buttons ─────────────────────────── */}
        <div className="flex flex-1 gap-2 md:hidden" role="group" aria-label="फ़िल्टर और क्रम">
          <button type="button" onClick={() => setMobileFilterOpen(true)}
            className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 font-ui text-sm text-ink font-medium hover:bg-borderSubtle focus-visible:outline-2 focus-visible:outline-primary"
            aria-haspopup="dialog" aria-expanded={mobileFilterOpen}>
            फ़िल्टर{count > 0 ? ` (${count})` : ''}
          </button>
          <button type="button" onClick={() => setMobileSortOpen(true)}
            className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 font-ui text-sm text-ink font-medium hover:bg-borderSubtle focus-visible:outline-2 focus-visible:outline-primary"
            aria-haspopup="dialog" aria-expanded={mobileSortOpen}>
            क्रम
          </button>
        </div>

        {/* ── Desktop sort dropdown ──────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <label htmlFor="sort-select" className="font-ui text-xs text-inkMute">क्रम:</label>
          <select
            id="sort-select"
            value={filters.sort ?? 'newest'}
            onChange={e => apply({ sort: e.target.value })}
            className="rounded-md border border-border bg-surface px-3 py-2 font-ui text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.labelHi}</option>)}
          </select>
        </div>
      </div>

      {/* ── Mobile filter sheet ───────────────────────────────────────── */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="फ़िल्टर">
          <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={() => setMobileFilterOpen(false)} />
          <div className="relative z-10 max-h-[75vh] overflow-y-auto rounded-t-lg bg-surface shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-ui text-base font-semibold text-ink">फ़िल्टर</h2>
              <button type="button" onClick={() => setMobileFilterOpen(false)}
                className="text-inkMute hover:text-ink" aria-label="फ़िल्टर बंद करें">✕</button>
            </div>
            <FilterSections filters={filters} apply={p => { apply(p); }} />
            <button type="button" onClick={() => setMobileFilterOpen(false)}
              className="mt-4 w-full rounded-md bg-primary px-4 py-3 font-ui text-sm text-white font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary">
              {totalCount} उत्पाद देखें
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile sort sheet ─────────────────────────────────────────── */}
      {mobileSortOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="क्रम चुनें">
          <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={() => setMobileSortOpen(false)} />
          <div className="relative z-10 rounded-t-lg bg-surface shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-ui text-base font-semibold text-ink">क्रम चुनें</h2>
              <button type="button" onClick={() => setMobileSortOpen(false)} className="text-inkMute" aria-label="बंद करें">✕</button>
            </div>
            {SORT_OPTIONS.map(s => (
              <button key={s.value} type="button"
                onClick={() => { apply({ sort: s.value }); setMobileSortOpen(false); }}
                className={`block w-full text-left py-3 border-b border-borderSubtle font-ui text-sm last:border-b-0 ${filters.sort === s.value ? 'text-primaryDeep font-semibold' : 'text-ink'}`}
                aria-pressed={filters.sort === s.value}>
                {s.labelHi}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
