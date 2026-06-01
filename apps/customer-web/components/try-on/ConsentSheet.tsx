'use client';
import React from 'react';

interface ConsentSheetProps {
  onAgree: () => void;
  onCancel: () => void;
}

export function ConsentSheet({ onAgree, onCancel }: ConsentSheetProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="कैमरा अनुमति सहमति"
      className="flex flex-col items-center justify-center h-full p-8 bg-black"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 flex flex-col gap-5">
        {/* Icon */}
        <div className="flex justify-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-3xl"
            aria-hidden="true"
          >
            💍
          </span>
        </div>

        {/* Hindi-first heading */}
        <div className="text-center">
          <h2 className="font-heading text-xl text-white">ट्राय करके देखें</h2>
          <p className="font-ui text-xs text-white/50 mt-0.5">Try On — Virtual Jewellery</p>
        </div>

        {/* Consent body */}
        <div className="flex flex-col gap-2">
          <p className="font-body text-sm text-white/80 text-center">
            आभूषण पहनकर देखने के लिए हम आपका कैमरा उपयोग करेंगे।
          </p>

          {/* Privacy assurances */}
          <ul className="flex flex-col gap-1.5 mt-1" aria-label="गोपनीयता जानकारी">
            {[
              { hi: 'पूरी तरह डिवाइस पर', en: 'Fully on-device' },
              { hi: 'कोई वीडियो सर्वर पर नहीं जाता', en: 'No video sent to any server' },
              { hi: 'कोई फ़ोटो सेव नहीं होती', en: 'No photo stored' },
            ].map(({ hi, en }) => (
              <li key={hi} className="flex items-start gap-2">
                <span className="text-primary mt-0.5" aria-hidden="true">✓</span>
                <span className="font-body text-sm text-white/80">
                  {hi}
                  <span className="block text-xs text-white/40">{en}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-1">
          <button
            type="button"
            onClick={onAgree}
            className="w-full rounded-lg bg-primary px-4 py-3 font-ui text-sm text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
            aria-label="सहमत हूं — कैमरा खोलें"
          >
            सहमत हूं — कैमरा खोलें
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-white/20 px-4 py-3 font-ui text-sm text-white/70 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/50 transition-colors"
            aria-label="रद्द करें"
          >
            रद्द करें
          </button>
        </div>

        {/* Legal note */}
        <p className="font-body text-xs text-white/30 text-center">
          DPDPA 2023 अनुपालन अनुसार। केवल इस सत्र के लिए।
        </p>
      </div>
    </div>
  );
}
