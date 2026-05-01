interface MetalFilterChipsProps {
  selected: string;
  baseHref: string;
  extraParams?: Record<string, string>;
}

const FILTERS = [
  { value: '',        label: 'सभी',   ariaLabel: 'सभी आभूषण' },
  { value: 'GOLD',   label: 'सोना',  ariaLabel: 'सोने के आभूषण' },
  { value: 'SILVER', label: 'चाँदी', ariaLabel: 'चाँदी के आभूषण' },
];

export function MetalFilterChips({ selected, baseHref, extraParams = {} }: MetalFilterChipsProps) {
  return (
    <div
      role="group"
      aria-label="धातु फ़िल्टर"
      className="flex gap-2 overflow-x-auto pb-1 md:hidden"
    >
      {FILTERS.map(({ value, label, ariaLabel }) => {
        const params = new URLSearchParams({ ...extraParams });
        if (value) params.set('metal', value);
        const href = `${baseHref}?${params.toString()}`;
        const isActive = selected === value;
        return (
          <a
            key={value}
            href={isActive ? baseHref : href}
            className={`shrink-0 rounded-full px-4 py-2 font-body text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary min-h-[44px] flex items-center ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-white border border-border text-ink hover:bg-border/50'
            }`}
            aria-label={ariaLabel}
            aria-pressed={isActive}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
