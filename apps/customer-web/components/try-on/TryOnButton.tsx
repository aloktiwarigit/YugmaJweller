'use client';
import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { fetchTryOnData } from '@/lib/api';
import type { CatalogTryOnResponse } from '@/lib/api';
import { useTenant } from '@/app/TenantContext';

// Lazy-load TryOnModal — pulls in @mediapipe/tasks-vision (heavy dep).
// ssr: false prevents Next.js from running MediaPipe on the server.
const TryOnModal = dynamic(
  () => import('./TryOnModal').then((m) => m.TryOnModal),
  { ssr: false },
);

interface TryOnButtonProps {
  productId: string;
}

type BtnState = 'idle' | 'loading' | 'open' | 'unavailable';

export function TryOnButton({ productId }: TryOnButtonProps) {
  const tenant = useTenant();
  const shopId = tenant?.shopId ?? '';
  const [btnState, setBtnState] = useState<BtnState>('idle');
  const [tryOnData, setTryOnData] = useState<CatalogTryOnResponse | null>(null);

  const handleClick = useCallback(async () => {
    if (btnState === 'loading' || btnState === 'open') return;
    setBtnState('loading');
    const data = await fetchTryOnData(productId, shopId);
    if (!data || !data.assetUrl) {
      setBtnState('unavailable');
      return;
    }
    setTryOnData(data);
    setBtnState('open');
  }, [productId, shopId, btnState]);

  const handleClose = useCallback(() => {
    setBtnState('idle');
    setTryOnData(null);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={btnState === 'loading'}
        className="w-full rounded-md bg-primary border border-primary px-6 py-3 font-ui text-white text-center hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary transition-colors disabled:opacity-60"
        aria-label="ट्राय करके देखें — आभूषण पहनकर देखें"
      >
        {btnState === 'loading' ? 'लोड हो रहा है…' : '✦ ट्राय करके देखें'}
      </button>

      {btnState === 'unavailable' && (
        <p
          role="alert"
          className="mt-1 text-center font-ui text-xs text-inkMute"
        >
          इस उत्पाद के लिए ट्राय-ऑन उपलब्ध नहीं है
        </p>
      )}

      {btnState === 'open' && tryOnData && (
        <TryOnModal tryOnData={tryOnData} onClose={handleClose} />
      )}
    </>
  );
}
