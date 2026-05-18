'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/app/TenantContext';
import {
  getCustomerIdToken,
  onCustomerAuthChanged,
  type Unsubscribe,
} from '@/src/auth/firebase-customer';
import type { User } from '@/src/auth/firebase-customer';
import { getWishlist, removeFromWishlist, type WishlistItemResponse } from '@/lib/api';
import { purityLabel, metalLabel } from '@/lib/theme';

type LoadState = 'init' | 'loading' | 'done' | 'error';

export default function WishlistPage() {
  const tenant = useTenant();
  const shopId = tenant?.shopId ?? null;

  const [user,      setUser]      = useState<User | null>(null);
  const [items,     setItems]     = useState<WishlistItemResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('init');

  // Track auth state
  useEffect(() => {
    const unsub: Unsubscribe = onCustomerAuthChanged((u) => setUser(u as User | null));
    return unsub;
  }, []);

  // Load wishlist when signed in
  useEffect(() => {
    if (!user || !shopId) {
      setItems([]);
      setLoadState('init');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    (async () => {
      try {
        const idToken = await getCustomerIdToken();
        if (!idToken || cancelled) return;
        const result = await getWishlist(idToken, shopId);
        if (!cancelled) {
          setItems(result);
          setLoadState('done');
        }
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [user, shopId]);

  const handleRemove = useCallback(async (productId: string) => {
    if (!shopId) return;
    const idToken = await getCustomerIdToken();
    if (!idToken) return;
    const ok = await removeFromWishlist(productId, idToken, shopId);
    if (ok) setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, [shopId]);

  // Unauthenticated state
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-heading text-3xl text-ink mb-6">इच्छा सूची</h1>
        <div className="rounded-lg border border-border bg-white p-8 text-center">
          <p className="font-body text-inkMute text-lg mb-4">
            इच्छा सूची सहेजने के लिए साइन इन करें
          </p>
          <a
            href="/sign-in"
            className="inline-block rounded-md bg-primary px-6 py-3 font-body text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            साइन इन करें
          </a>
        </div>
      </div>
    );
  }

  // Loading state
  if (loadState === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-heading text-3xl text-ink mb-6">इच्छा सूची</h1>
        <p className="font-body text-inkMute" aria-live="polite">लोड हो रहा है…</p>
      </div>
    );
  }

  // Error state
  if (loadState === 'error') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-heading text-3xl text-ink mb-6">इच्छा सूची</h1>
        <p className="font-body text-error" role="alert">
          इच्छा सूची लोड नहीं हो पाई — कृपया पृष्ठ ताज़ा करें।
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl text-ink mb-6">इच्छा सूची</h1>

      {items.length === 0 ? (
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
          {items.map((item) => {
            const label    = purityLabel(item.purity, item.metal);
            const material = metalLabel(item.metal);
            return (
              <li
                key={item.productId}
                className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3 gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-ink truncate">
                    {label} — {material}
                  </p>
                  <p className="font-body text-xs text-inkMute">{item.sku}</p>
                  {item.huid && (
                    <p className="font-body text-xs text-inkMute">HUID: {item.huid}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Link
                    href={`/products/${item.productId}`}
                    className="font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    देखें →
                  </Link>
                  <button
                    onClick={() => handleRemove(item.productId)}
                    className="font-body text-sm text-error hover:underline focus-visible:outline-2 focus-visible:outline-error"
                    aria-label={`${label} को इच्छा सूची से हटाएं`}
                  >
                    हटाएं
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
