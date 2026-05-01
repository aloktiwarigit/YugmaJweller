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

export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
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

  return (
    <button
      onClick={handleClick}
      className={`w-full rounded-md border px-6 py-3 font-body transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
        wishlisted
          ? 'border-primary bg-primary text-white'
          : 'border-primary bg-white text-primary hover:bg-primary/5'
      }`}
      aria-label={wishlisted ? `${productName} को इच्छा सूची से हटाएं` : `${productName} को इच्छा सूची में जोड़ें`}
      aria-pressed={wishlisted}
    >
      {wishlisted ? '♥ इच्छा सूची में है' : '♡ इच्छा सूची में जोड़ें'}
    </button>
  );
}
