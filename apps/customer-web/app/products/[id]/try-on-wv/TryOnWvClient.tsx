'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { fetchTryOnData } from '@/lib/api';
import type { CatalogTryOnResponse } from '@/lib/api';
import { TryOnModal } from '@/components/try-on/TryOnModal';

interface Props {
  productId: string;
  shopId: string;
}

type State = 'loading' | 'ready' | 'unavailable';

/**
 * Close try-on. When hosted in the react-native-webview, post a message so the
 * native screen pops the route. When this route is opened in a plain browser
 * (it is a public Next route), there is no native host — fall back to normal
 * back-navigation so the user is never stranded on the fullscreen overlay.
 */
function closeTryOn(productId: string): void {
  const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
  if (rn) {
    rn.postMessage(JSON.stringify({ type: 'tryon-close' }));
    return;
  }
  if (window.history.length > 1) window.history.back();
  else window.location.assign(`/products/${productId}`);
}

export function TryOnWvClient({ productId, shopId }: Props) {
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<CatalogTryOnResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await fetchTryOnData(productId, shopId);
      if (cancelled) return;
      if (d && d.assetUrl) { setData(d); setState('ready'); }
      else setState('unavailable');
    })();
    return () => { cancelled = true; };
  }, [productId, shopId]);

  const handleClose = useCallback(() => {
    closeTryOn(productId);
  }, [productId]);

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
        <span className="sr-only" role="status">लोड हो रहा है…</span>
      </div>
    );
  }

  if (state === 'unavailable' || !data) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black px-8">
        <p role="alert" className="text-center font-body text-sm text-white/80">
          इस उत्पाद के लिए ट्राय-ऑन उपलब्ध नहीं है
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg bg-primary px-6 py-3 font-ui text-sm text-white"
        >
          वापस जाएं
        </button>
      </div>
    );
  }

  return <TryOnModal tryOnData={data} onClose={handleClose} />;
}
