'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/app/TenantContext';
import {
  getCustomerIdToken,
  onCustomerAuthChanged,
  type Unsubscribe,
} from '@/src/auth/firebase-customer';
import type { User } from '@/src/auth/firebase-customer';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from '@/lib/api';
import { posthog } from '@/app/lib/posthog';

interface WishlistButtonProps {
  productId:   string;
  productName: string;
  compact?:    boolean;
}

export function WishlistButton({ productId, productName, compact }: WishlistButtonProps) {
  const tenant  = useTenant();
  const shopId  = tenant?.shopId ?? null;

  const [user,        setUser]        = useState<User | null>(null);
  const [wishlisted,  setWishlisted]  = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [showPrompt,  setShowPrompt]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  // Subscribe to Firebase auth state — fires immediately with current user.
  useEffect(() => {
    const unsub: Unsubscribe = onCustomerAuthChanged((u) => setUser(u as User | null));
    return unsub;
  }, []);

  // When auth state or productId changes, load wishlist membership from API.
  useEffect(() => {
    if (!user || !shopId) {
      setWishlisted(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const idToken = await getCustomerIdToken();
      if (!idToken || cancelled) return;
      const items = await getWishlist(idToken, shopId);
      if (!cancelled) setWishlisted(items.some((i) => i.productId === productId));
    })();
    return () => { cancelled = true; };
  }, [user, productId, shopId]);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  }, []);

  const handleClick = useCallback(async () => {
    if (!user || !shopId) {
      setShowPrompt(true);
      return;
    }
    if (busy) return;

    const next = !wishlisted;
    setWishlisted(next); // optimistic
    setBusy(true);

    try {
      const idToken = await getCustomerIdToken();
      if (!idToken) throw new Error('no-token');

      const ok = next
        ? await addToWishlist(productId, idToken, shopId)
        : await removeFromWishlist(productId, idToken, shopId);

      if (!ok) {
        setWishlisted(!next); // rollback
        showError('इच्छा सूची में जोड़ नहीं पाए');
      } else {
        posthog.capture(next ? 'wishlist_add' : 'wishlist_remove', { productId, shopId });
      }
    } catch {
      setWishlisted(!next); // rollback
      showError('इच्छा सूची में जोड़ नहीं पाए');
    } finally {
      setBusy(false);
    }
  }, [user, shopId, busy, wishlisted, productId, showError]);

  const ariaLabel = wishlisted
    ? `${productName} को इच्छा सूची से हटाएं`
    : `${productName} को इच्छा सूची में जोड़ें`;

  return (
    <div className="relative">
      {/* Sign-in prompt */}
      {showPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="साइन इन आवश्यक"
          className="absolute bottom-full mb-2 left-0 z-20 w-72 rounded-lg border border-border bg-white shadow-lg p-4"
        >
          <p className="font-body text-sm text-ink mb-3">
            इच्छा सूची सहेजने के लिए साइन इन करें
          </p>
          <div className="flex gap-2">
            <a
              href="/sign-in"
              className="flex-1 rounded-md bg-primary px-3 py-2 font-ui text-sm text-white text-center hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              साइन इन करें
            </a>
            <button
              onClick={() => setShowPrompt(false)}
              className="rounded-md border border-border px-3 py-2 font-ui text-sm text-inkMute hover:bg-borderSubtle focus-visible:outline-2 focus-visible:outline-border"
              aria-label="बंद करें"
            >
              बंद करें
            </button>
          </div>
        </div>
      )}

      {/* Error toast */}
      {errorMsg && (
        <p role="alert" className="absolute bottom-full mb-1 left-0 z-20 rounded-md bg-error/10 border border-error px-3 py-1 font-body text-xs text-error whitespace-nowrap">
          {errorMsg}
        </p>
      )}

      {compact ? (
        <button
          onClick={handleClick}
          disabled={busy}
          className={`h-10 w-10 flex items-center justify-center rounded-full border text-lg transition-all duration-[280ms] focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${
            wishlisted
              ? 'border-accent bg-accentWash text-accent scale-110'
              : 'border-border bg-surface hover:bg-borderSubtle'
          }`}
          aria-label={ariaLabel}
          aria-pressed={wishlisted}
        >
          {wishlisted ? '♥' : '♡'}
        </button>
      ) : (
        <button
          onClick={handleClick}
          disabled={busy}
          className={`w-full rounded-md border px-6 py-3 font-ui transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${
            wishlisted
              ? 'border-accent bg-accentWash text-accent'
              : 'border-border bg-surface text-ink hover:bg-borderSubtle'
          }`}
          aria-label={ariaLabel}
          aria-pressed={wishlisted}
        >
          {wishlisted ? '♥ इच्छा सूची में है' : '♡ इच्छा सूची में जोड़ें'}
        </button>
      )}
    </div>
  );
}
