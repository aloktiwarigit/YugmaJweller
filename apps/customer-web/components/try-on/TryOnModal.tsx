'use client';
import React, { useState, useCallback, useEffect } from 'react';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import { ConsentSheet } from './ConsentSheet';
import { TryOnCanvas } from './TryOnCanvas';

type ModalState = 'consent' | 'requesting' | 'loading' | 'active' | 'denied';

interface TryOnModalProps {
  tryOnData: CatalogTryOnResponse;
  onClose: () => void;
}

export function TryOnModal({ tryOnData, onClose }: TryOnModalProps) {
  const [modalState, setModalState] = useState<ModalState>(() =>
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tryon-consent') === '1'
      ? 'requesting'
      : 'consent',
  );
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Esc key closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent background scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Stop camera tracks when the modal unmounts
  useEffect(() => {
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [stream]);

  const requestCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(s);
      setModalState('loading');
    } catch {
      setModalState('denied');
    }
  }, []);

  // If consent was already given this session, request camera on mount
  useEffect(() => {
    if (modalState === 'requesting') void requestCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConsent = useCallback(() => {
    sessionStorage.setItem('tryon-consent', '1');
    void requestCamera();
  }, [requestCamera]);

  const handleDetectorReady = useCallback(() => {
    setModalState('active');
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="आभूषण ट्राय करें"
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 pointer-events-none">
        <span className="font-ui text-sm text-white/70 select-none">✦ ट्राय करके देखें</span>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-xl leading-none hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white transition-colors"
          aria-label="बंद करें"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {modalState === 'consent' && (
          <ConsentSheet onAgree={handleConsent} onCancel={onClose} />
        )}

        {modalState === 'requesting' && (
          <div className="flex h-full items-center justify-center">
            <p className="font-ui text-sm text-white/70" role="status">
              कैमरा खोल रहे हैं…
            </p>
          </div>
        )}

        {(modalState === 'loading' || modalState === 'active') && stream && (
          <>
            <TryOnCanvas
              stream={stream}
              tryOnData={tryOnData}
              onDetectorReady={handleDetectorReady}
            />
            {modalState === 'loading' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60">
                <div
                  className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin"
                  aria-hidden="true"
                />
                <p className="font-ui text-sm text-white/70 mt-3" role="status">
                  तैयार हो रहे हैं…
                </p>
              </div>
            )}
          </>
        )}

        {modalState === 'denied' && (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
            <span className="text-4xl" aria-hidden="true">📷</span>
            <p className="font-body text-sm text-white/80 text-center">
              कैमरा अनुमति नहीं मिली। ब्राउज़र सेटिंग्स में कैमरा अनुमति दें और फिर से प्रयास करें।
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary px-6 py-3 font-ui text-sm text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
            >
              वापस जाएं
            </button>
          </div>
        )}
      </div>

      {/* Approximate size indicator */}
      {modalState === 'active' && !tryOnData.trueToSize && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <span className="rounded-pill bg-black/60 px-3 py-1 font-ui text-xs text-white/80">
            अनुमानित आकार — Approximate size
          </span>
        </div>
      )}
    </div>
  );
}
