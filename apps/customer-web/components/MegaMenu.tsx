'use client';

import { useCallback } from 'react';
import type { MegaMenuPanel, MegaMenuLink } from '@goldsmith/customer-shared';
import { STOREFRONT_BROWSE_NAV, MEGA_MENU_CONTENT } from '@goldsmith/customer-shared';

interface MegaMenuProps {
  activeKey: string | null;
  onEnter: (key: string) => void;
  onLeave: () => void;
  onClose: () => void;
}

const COLUMN_LABELS = {
  popular:     { hi: 'लोकप्रिय',    en: 'Popular'      },
  style:       { hi: 'स्टाइल',      en: 'Style'        },
  metalPurity: { hi: 'धातु व शुद्धता', en: 'Metal & Purity' },
  priceBand:   { hi: 'बजट',         en: 'Price'        },
  occasion:    { hi: 'अवसर',        en: 'Occasion'     },
};

function PanelLinks({ links }: { links: MegaMenuLink[] }) {
  return (
    <ul className="space-y-1">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className="block text-ink hover:text-primaryDeep focus-visible:outline-none focus-visible:text-primaryDeep text-sm font-ui py-0.5 transition-colors"
          >
            {link.labelHi}
            {link.labelEn && (
              <span className="ml-1 text-inkSoft text-xs font-ui">/ {link.labelEn}</span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

function MegaPanel({ panel, navKey }: { panel: MegaMenuPanel; navKey: string }) {
  const heroItem = STOREFRONT_BROWSE_NAV.find((n) => n.key === navKey);
  return (
    <div
      role="region"
      aria-label={heroItem ? `${heroItem.labelHi} नेविगेशन` : 'मेगा-मेनू'}
      className="grid grid-cols-6 gap-6 px-8 py-6"
    >
      <div>
        <p className="text-xs font-ui font-semibold text-inkMute uppercase tracking-widest mb-2">
          {COLUMN_LABELS.popular.hi}
        </p>
        <PanelLinks links={panel.popular} />
      </div>
      <div>
        <p className="text-xs font-ui font-semibold text-inkMute uppercase tracking-widest mb-2">
          {COLUMN_LABELS.style.hi}
        </p>
        <PanelLinks links={panel.style} />
      </div>
      <div>
        <p className="text-xs font-ui font-semibold text-inkMute uppercase tracking-widest mb-2">
          {COLUMN_LABELS.metalPurity.hi}
        </p>
        <PanelLinks links={panel.metalPurity} />
      </div>
      <div>
        <p className="text-xs font-ui font-semibold text-inkMute uppercase tracking-widest mb-2">
          {COLUMN_LABELS.priceBand.hi}
        </p>
        <PanelLinks links={panel.priceBand} />
      </div>
      <div>
        <p className="text-xs font-ui font-semibold text-inkMute uppercase tracking-widest mb-2">
          {COLUMN_LABELS.occasion.hi}
        </p>
        <PanelLinks links={panel.occasion} />
      </div>
      {/* Visual tile — 6th column */}
      <div className="flex flex-col justify-between">
        <div className="rounded-md bg-primaryWash border border-borderSubtle p-4 text-center flex-1 flex flex-col items-center justify-center gap-2">
          <span className="font-heading text-lg text-primaryDeep">
            {heroItem?.labelHi ?? 'Shop'}
          </span>
          <a
            href={heroItem?.href ?? '/products'}
            className="text-xs text-primaryDeep underline underline-offset-2 font-ui"
          >
            सभी देखें →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function MegaMenu({ activeKey, onEnter, onLeave, onClose }: MegaMenuProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <nav
      role="navigation"
      aria-label="मुख्य नेविगेशन"
      className="hidden md:block"
    >
      <ul className="flex items-center gap-1">
        {STOREFRONT_BROWSE_NAV.map((item) => {
          const hasPanel = item.key in MEGA_MENU_CONTENT;
          const isActive = activeKey === item.key;
          return (
            <li key={item.key} className="relative">
              <a
                href={item.href}
                aria-haspopup={hasPanel ? 'true' : undefined}
                aria-expanded={hasPanel ? isActive : undefined}
                className={[
                  'flex min-h-11 items-center px-3 py-2 text-sm font-ui font-medium transition-colors focus-visible:outline-none',
                  isActive
                    ? 'text-primaryDeep border-b-2 border-primary'
                    : 'text-ink hover:text-primaryDeep',
                ].join(' ')}
                onMouseEnter={() => hasPanel && onEnter(item.key)}
                onFocus={() => hasPanel && onEnter(item.key)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' && hasPanel) {
                    e.preventDefault();
                    // Traverse to THIS item's panel (role=region is on MegaPanel)
                    const firstLink = e.currentTarget
                      .closest('li')
                      ?.querySelector<HTMLAnchorElement>('[role="region"] a');
                    firstLink?.focus();
                  }
                  if (e.key === 'Escape') onClose();
                }}
              >
                {item.labelHi}
              </a>

              {hasPanel && isActive && (
                <div
                  className="absolute left-0 top-full z-50 mt-0 min-w-[900px] max-w-[1200px] rounded-md bg-surfaceElevated border border-borderSubtle"
                  style={{ boxShadow: '0 16px 40px rgba(30,36,64,0.12)', animation: 'mega-fade-in 180ms ease-out' }}
                  onMouseEnter={() => onEnter(item.key)}
                  onMouseLeave={onLeave}
                  onKeyDown={handleKeyDown}
                >
                  <MegaPanel panel={MEGA_MENU_CONTENT[item.key]!} navKey={item.key} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <style>{`
        @keyframes mega-fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </nav>
  );
}
