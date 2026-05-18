// apps/customer-web/app/profile/error.tsx
'use client';
import React from 'react';

export default function ProfileError(): JSX.Element {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-heading text-2xl text-ink">त्रुटि</h1>
      <p className="mt-3 text-sm text-inkMute">
        प्रोफ़ाइल लोड नहीं हो सकी। कृपया पेज रिफ्रेश करें।
      </p>
    </main>
  );
}
