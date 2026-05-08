'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gs_wishlist';

function getWishlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveWishlist(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function WishlistButton({ productId, productName, compact }: { productId: string; productName: string; compact?: boolean }) {
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    setWishlisted(getWishlist().includes(productId));
  }, [productId]);

  const handleClick = () => {
    const current = getWishlist();
    let next: string[];
    if (current.includes(productId)) {
      next = current.filter((id) => id !== productId);
    } else {
      next = [...current, productId];
    }
    saveWishlist(next);
    setWishlisted(next.includes(productId));
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={`h-10 w-10 flex items-center justify-center rounded-full border text-lg transition-all duration-[280ms] focus-visible:outline-2 focus-visible:outline-primary ${
          wishlisted ? 'border-accent bg-accentWash text-accent scale-110' : 'border-border bg-surface hover:bg-borderSubtle'
        }`}
        aria-label={wishlisted ? `${productName} को इच्छा सूची से हटाएं` : `${productName} को इच्छा सूची में जोड़ें`}
        aria-pressed={wishlisted}
      >
        {wishlisted ? '♥' : '♡'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full rounded-md border px-6 py-3 font-ui transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
        wishlisted
          ? 'border-accent bg-accentWash text-accent'
          : 'border-border bg-surface text-ink hover:bg-borderSubtle'
      }`}
      aria-label={wishlisted ? `${productName} को इच्छा सूची से हटाएं` : `${productName} को इच्छा सूची में जोड़ें`}
      aria-pressed={wishlisted}
    >
      {wishlisted ? '♥ इच्छा सूची में है' : '♡ इच्छा सूची में जोड़ें'}
    </button>
  );
}
