'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-heading text-2xl text-error">कुछ गलत हो गया</h1>
      <p className="font-body text-inkMute">कृपया पुनः प्रयास करें।</p>
      <button
        onClick={reset}
        className="bg-primary text-white font-body px-6 py-2 rounded-md hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="पुनः प्रयास करें"
      >
        पुनः प्रयास करें
      </button>
    </div>
  );
}
