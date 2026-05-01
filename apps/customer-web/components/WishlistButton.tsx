'use client';
import { useState } from 'react';

export function WishlistButton({ productName }: { productName: string }) {
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-md border border-primary bg-white px-6 py-3 font-body text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
      aria-label={`${productName} को इच्छा सूची में जोड़ें`}
      aria-pressed={added}
    >
      {added ? '✓ इच्छा सूची में जोड़ा गया' : 'इच्छा सूची में जोड़ें'}
    </button>
  );
}
