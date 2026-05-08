'use client';

import { useEffect, useRef, useState } from 'react';
import { WishlistButton } from '@/components/WishlistButton';

interface StickyCTABarProps {
  productId:      string;
  productName:    string;
  totalFormatted: string | undefined;
  disabled?:      boolean;
}

export function StickyCTABar({ productId, productName, totalFormatted, disabled }: StickyCTABarProps) {
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry!.intersectionRatio),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel: placed at the bottom of the hero section in the parent */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      {/* Sticky bar */}
      <div
        role="region"
        aria-label="त्वरित खरीदें"
        className={`fixed bottom-0 left-0 right-0 z-40 border-t border-borderSubtle bg-surfaceElevated shadow-md transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-hidden={!visible}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="font-ui text-xs text-inkMute truncate">{productName}</p>
            {totalFormatted && (
              <p className="font-ui text-base font-semibold tabular-nums text-ink">{totalFormatted}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <WishlistButton productId={productId} productName={productName} compact />
            {!disabled && (
              <a
                href={`/try-at-home?product=${productId}`}
                className="rounded-md bg-primary px-5 py-2.5 font-ui text-sm text-white font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity"
                aria-label={`${productName} — घर पर ट्राय करें`}
              >
                जोड़ें
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
