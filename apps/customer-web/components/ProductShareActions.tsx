'use client';

import { useState } from 'react';

interface ProductShareActionsProps {
  productName: string;
  productUrl: string;
}

export function ProductShareActions({ productName, productUrl }: ProductShareActionsProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const message = `${productName} देखें: ${productUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;

  async function shareNative() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title: productName, text: message, url: productUrl });
    } catch {
      setCopyStatus('idle');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <section aria-labelledby="share-heading" className="rounded-lg border border-border bg-white p-4">
      <h2 id="share-heading" className="font-body text-sm font-semibold text-ink">
        शेयर करें
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border px-3 py-2 text-center font-body text-sm text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-primary"
          href={whatsappHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>
        <a
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border px-3 py-2 text-center font-body text-sm text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-primary"
          href={smsHref}
        >
          SMS
        </a>
        <button
          className="min-h-[44px] rounded-md border border-border px-3 py-2 font-body text-sm text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-primary"
          type="button"
          onClick={shareNative}
        >
          शेयर
        </button>
        <button
          className="min-h-[44px] rounded-md border border-border px-3 py-2 font-body text-sm text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-primary"
          type="button"
          onClick={copyLink}
        >
          लिंक कॉपी
        </button>
      </div>
      <p className="mt-2 min-h-[20px] font-body text-xs text-inkMute" aria-live="polite">
        {copyStatus === 'copied' ? 'लिंक कॉपी हो गया।' : null}
        {copyStatus === 'failed' ? 'लिंक कॉपी नहीं हो सका।' : null}
      </p>
    </section>
  );
}
