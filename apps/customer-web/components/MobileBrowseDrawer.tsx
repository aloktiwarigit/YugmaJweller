'use client';

import { useEffect, useRef, useState } from 'react';
import type { MegaMenuPanel } from '@goldsmith/customer-shared';
import { STOREFRONT_BROWSE_NAV, MEGA_MENU_CONTENT } from '@goldsmith/customer-shared';

interface MobileBrowseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function GroupChipShelf({ panel, label }: { panel: MegaMenuPanel; label: string }) {
  const groups: { key: keyof MegaMenuPanel; titleHi: string }[] = [
    { key: 'popular',     titleHi: 'लोकप्रिय'       },
    { key: 'style',       titleHi: 'स्टाइल'          },
    { key: 'metalPurity', titleHi: 'धातु व शुद्धता'   },
    { key: 'priceBand',   titleHi: 'बजट'             },
    { key: 'occasion',    titleHi: 'अवसर'            },
  ];

  return (
    <div className="px-4 pb-4 space-y-3">
      {groups.map(({ key, titleHi }) => (
        <div key={key}>
          <p className="text-xs font-ui font-semibold text-inkMute uppercase tracking-widest mb-1.5">
            {titleHi}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {panel[key].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex-none rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-ui text-ink whitespace-nowrap hover:bg-primaryWash hover:border-primaryDeep transition-colors"
              >
                {link.labelHi}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MobileBrowseDrawer({ isOpen, onClose }: MobileBrowseDrawerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // Focus trap + Esc close
  useEffect(() => {
    if (!isOpen) return;
    firstFocusRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40 bg-ink/40 md:hidden"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="ब्राउज़ मेनू"
        className="fixed inset-y-0 left-0 z-50 w-[280px] bg-bg shadow-2xl flex flex-col md:hidden overflow-y-auto"
        style={{ animation: 'drawer-slide-in 280ms ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-borderSubtle">
          <span className="font-heading text-lg text-ink">ब्राउज़ करें</span>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            className="p-2 rounded-sm text-inkMute hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="मेनू बंद करें"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav accordion */}
        <nav aria-label="मोबाइल नेविगेशन">
          <ul role="list">
            {STOREFRONT_BROWSE_NAV.map((item) => {
              const hasPanel = item.key in MEGA_MENU_CONTENT;
              const isExpanded = expanded === item.key;

              return (
                <li key={item.key} className="border-b border-borderSubtle">
                  {hasPanel ? (
                    <>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left font-ui font-medium text-ink"
                        onClick={() => setExpanded(isExpanded ? null : item.key)}
                      >
                        <span>{item.labelHi}</span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <GroupChipShelf
                          panel={MEGA_MENU_CONTENT[item.key]!}
                          label={item.labelHi}
                        />
                      )}
                    </>
                  ) : (
                    <a
                      href={item.href}
                      className="flex items-center px-4 py-3.5 font-ui font-medium text-ink hover:text-primaryDeep"
                      onClick={onClose}
                    >
                      {item.labelHi}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <style>{`
        @keyframes drawer-slide-in {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        .scrollbar-none { scrollbar-width: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
