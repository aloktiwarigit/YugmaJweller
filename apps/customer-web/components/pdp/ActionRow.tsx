'use client';

import { useState } from 'react';
import { WishlistButton } from '@/components/WishlistButton';

interface ActionRowProps {
  productId: string;
  productName: string;
  productUrl?: string;
}

export function ActionRow({ productId, productName, productUrl }: ActionRowProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = productUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: productName, url });
        return;
      } catch {
        // User cancelled native share; fall back to copy when available.
      }
    }
    if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      role="group"
      aria-label="शेयर और सहेजें"
      className="flex items-center gap-6 border-t border-borderSubtle pt-4"
    >
      <button
        type="button"
        onClick={handleShare}
        className="flex flex-col items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={copied ? 'लिंक कॉपी हो गया' : `${productName} शेयर करें`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-lg transition-colors hover:bg-borderSubtle">
          {copied ? '✓' : '↗'}
        </span>
        <span className="font-ui text-xs text-inkMute">
          {copied ? 'कॉपी हो गया' : 'शेयर करें'}
        </span>
      </button>

      <a
        href={`/rate-lock?product=${productId}`}
        className="flex flex-col items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${productName} - आज की दर लॉक करें`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-lg transition-colors hover:bg-borderSubtle">
          🔒
        </span>
        <span className="font-ui text-xs text-inkMute">दर-लॉक</span>
      </a>

      <div className="flex flex-col items-center gap-1">
        <WishlistButton productId={productId} productName={productName} compact />
        <span className="font-ui text-xs text-inkMute">इच्छा-सूची</span>
      </div>
    </div>
  );
}
