'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'gs_wishlist';

function getWishlistIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function removeFromWishlist(productId: string): string[] {
  const current = getWishlistIds();
  const next = current.filter((id) => id !== productId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export default function WishlistPage() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(getWishlistIds());
  }, []);

  const handleRemove = (productId: string) => {
    const next = removeFromWishlist(productId);
    setIds(next);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl text-ink mb-6">इच्छा सूची</h1>

      {ids.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-body text-inkMute text-lg mb-4">आपकी इच्छा सूची खाली है।</p>
          <Link
            href="/products"
            className="inline-block rounded-md bg-primary px-6 py-3 font-body text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            उत्पाद देखें
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="इच्छा सूची के उत्पाद">
          {ids.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3"
            >
              <Link
                href={`/products/${id}`}
                className="font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                उत्पाद देखें →
              </Link>
              <button
                onClick={() => handleRemove(id)}
                className="font-body text-sm text-error hover:underline focus-visible:outline-2 focus-visible:outline-error ml-4"
                aria-label="इच्छा सूची से हटाएं"
              >
                बैग से हटाएं
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
