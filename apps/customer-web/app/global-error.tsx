'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="hi">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center font-ui">
          <h1 className="font-heading text-2xl text-error">Something went wrong</h1>
          <p className="max-w-md text-sm text-inkMute">
            We could not load this page. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-6 py-2 font-body text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
