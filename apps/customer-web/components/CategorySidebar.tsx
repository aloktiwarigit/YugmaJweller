interface CategorySidebarProps {
  selectedMetal?: string;
  baseHref: string;
}

const METAL_FILTERS = [
  { value: '',       label: 'सभी',   ariaLabel: 'सभी उत्पाद' },
  { value: 'GOLD',   label: 'सोना',  ariaLabel: 'सोने के आभूषण' },
  { value: 'SILVER', label: 'चाँदी', ariaLabel: 'चाँदी के आभूषण' },
];

export function CategorySidebar({ selectedMetal = '', baseHref }: CategorySidebarProps) {
  return (
    <nav aria-label="श्रेणी फ़िल्टर" className="flex flex-col gap-1">
      <h2 className="font-body text-xs font-semibold text-inkMute uppercase tracking-wide mb-2">
        श्रेणी
      </h2>
      {METAL_FILTERS.map(({ value, label, ariaLabel }) => {
        const href = value ? `${baseHref}?metal=${value}` : baseHref;
        const isActive = selectedMetal === value;
        return (
          <a
            key={value}
            href={href}
            className={`block rounded-md px-3 py-2 font-body text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
              isActive ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'
            }`}
            aria-label={ariaLabel}
            aria-current={isActive ? 'page' : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
