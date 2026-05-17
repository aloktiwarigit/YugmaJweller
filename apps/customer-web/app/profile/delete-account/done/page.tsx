// apps/customer-web/app/profile/delete-account/done/page.tsx
import React from 'react';

export default function DeleteAccountDonePage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-heading text-3xl text-ink md:text-[2.25rem]">
        आपका खाता मिटा दिया गया है
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-inkMute md:text-[15px]">
        आपकी व्यक्तिगत जानकारी हमारे सिस्टम से हटा दी गई है। 30 दिनों के बाद कोई भी अवशेष पंक्तियाँ स्थायी रूप से हटा दी जाएँगी।
        धन्यवाद।
      </p>
    </main>
  );
}
