// apps/customer-web/app/profile/error.tsx
'use client';
import React from 'react';

export default function ProfileError({ reset }: { reset: () => void }): JSX.Element {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-heading text-2xl text-ink">त्रुटि</h1>
      <p className="mt-3 text-sm text-inkMute">
        प्रोफ़ाइल लोड नहीं हो सकी।
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md border border-borderSubtle px-6 py-2.5 font-prose text-sm text-ink hover:bg-primaryWash focus-visible:outline-2 focus-visible:outline-primary"
      >
        दोबारा कोशिश करें
      </button>
    </main>
  );
}
