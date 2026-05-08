'use client';

import { useState } from 'react';

interface ActionRowProps {
  productId:   string;
  productName: string;
  productUrl?: string;
}

export function ActionRow({ productId, productName, productUrl }: ActionRowProps) {
  const [wishlisted, setWishlisted] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = productUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: productName, url });
        return;
      } catch {
        // user cancelled or share not supported — fall through to copy
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
      {/* Share */}
      <button
        type="button"
        onClick={handleShare}
        className="flex flex-col items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={copied ? 'लिंक कॉपी हो गया' : `${productName} शेयर करें`}
      >
        <span className="h-10 w-10 flex items-center justify-center rounded-full border border-border bg-surface text-lg hover:bg-borderSubtle transition-colors">
          {copied ? '✓' : '↗'}
        </span>
        <span className="font-ui text-xs text-inkMute">{copied ? 'कॉपी हो गया' : 'शेयर करें'}</span>
      </button>

      {/* Rate Lock */}
      <a
        href={`/rate-lock?product=${productId}`}
        className="flex flex-col items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${productName} — आज की दर लॉक करें`}
      >
        <span className="h-10 w-10 flex items-center justify-center rounded-full border border-border bg-surface text-lg hover:bg-borderSubtle transition-colors">
          🔒
        </span>
        <span className="font-ui text-xs text-inkMute">दर-लॉक</span>
      </a>

      {/* Wishlist */}
      <button
        type="button"
        onClick={() => setWishlisted(w => !w)}
        aria-pressed={wishlisted}
        aria-label={wishlisted ? `${productName} — सूची से हटाएं` : `${productName} — इच्छा-सूची में जोड़ें`}
        className="flex flex-col items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span
          className={`h-10 w-10 flex items-center justify-center rounded-full border text-lg transition-all duration-200 ${
            wishlisted
              ? 'border-accent bg-accentWash text-accent scale-110'
              : 'border-border bg-surface hover:bg-borderSubtle'
          }`}
        >
          {wishlisted ? '♥' : '♡'}
        </span>
        <span className="font-ui text-xs text-inkMute">इच्छा-सूची</span>
      </button>
    </div>
  );
}
