'use client';

import { useState, useCallback } from 'react';
import { STOREFRONT_CATEGORY_TILES } from '@goldsmith/customer-shared';
import MegaMenu from './MegaMenu';
import MobileBrowseDrawer from './MobileBrowseDrawer';

interface StorefrontHeaderProps {
  shopName: string;
  logoUrl: string | null;
}

export default function StorefrontHeader({ shopName, logoUrl }: StorefrontHeaderProps) {
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);

  const handleMenuEnter  = useCallback((key: string) => setActiveMenuKey(key), []);
  const handleMenuLeave  = useCallback(() => setActiveMenuKey(null), []);
  const handleMenuClose  = useCallback(() => setActiveMenuKey(null), []);
  const handleDrawerOpen  = useCallback(() => setDrawerOpen(true), []);
  const handleDrawerClose = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      {/* Primary header bar */}
      <header
        className="sticky top-0 z-40 bg-surface/90 backdrop-blur-sm border-b border-borderSubtle"
        onMouseLeave={handleMenuLeave}
      >
        {/* Main row */}
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 h-14">
          {/* Mobile: hamburger */}
          <button
            type="button"
            aria-label="मेनू खोलें"
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            className="md:hidden p-2 -ml-2 text-inkMute hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            onClick={handleDrawerOpen}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Logo / shop name */}
          <a href="/" className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={`${shopName} का लोगो`}
                className="h-9 w-auto object-contain"
              />
            )}
            <span className="font-heading text-lg text-ink leading-none">{shopName}</span>
          </a>

          {/* Desktop mega-menu nav */}
          <div className="hidden md:flex flex-1 justify-center">
            <MegaMenu
              activeKey={activeMenuKey}
              onEnter={handleMenuEnter}
              onLeave={handleMenuLeave}
              onClose={handleMenuClose}
            />
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1">
            <a
              href="/wishlist"
              className="p-2 text-inkMute hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              aria-label="पसंदीदा सूची"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 17s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 17 8c0 4.5-7 9-7 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href="/profile"
              className="p-2 text-inkMute hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              aria-label="प्रोफाइल"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </a>
          </div>
        </div>

        {/* Mobile persistent chip rail — below main row */}
        <div className="md:hidden border-t border-borderSubtle bg-bg">
          <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
            <button
              type="button"
              onClick={handleDrawerOpen}
              className="flex-none rounded-pill border border-borderStrong bg-primaryWash px-3 py-1.5 text-sm font-ui font-semibold text-primaryDeep whitespace-nowrap"
              aria-label="सभी कैटेगरी"
            >
              सभी
            </button>
            {STOREFRONT_CATEGORY_TILES.map((tile) => (
              <a
                key={tile.key}
                href={tile.href}
                className="flex-none rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-ui text-ink whitespace-nowrap hover:bg-primaryWash hover:border-primary transition-colors"
              >
                {tile.labelHi}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileBrowseDrawer isOpen={drawerOpen} onClose={handleDrawerClose} />

      <style>{`
        .scrollbar-none { scrollbar-width: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
