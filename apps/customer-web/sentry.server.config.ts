/**
 * Sentry server-side (Node.js) configuration for customer-web.
 *
 * Auto-loaded by @sentry/nextjs for the server bundle (SSR + Route Handlers).
 * Per-request tenant tagging happens in instrumentation.ts via AsyncLocalStorage.
 *
 * Rules honoured:
 *  - PII scrubber via beforeSend
 *  - Tenant tagged in initialScope as a fallback; overridden per-request
 *  - Source maps resolved by withSentryConfig (Sentry webpack plugin)
 *  - DSN absent → no-op (dev + CI)
 */

import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent, EventHint } from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/sentry-scrubber';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,

  enabled: Boolean(dsn),

  tracesSampleRate: 0.1,

  initialScope: {
    tags: {
      runtime: 'nodejs',
      tenant: process.env.NEXT_PUBLIC_SHOP_SLUG ?? 'unknown',
    },
  },

  beforeSend: (event: ErrorEvent, hint: EventHint): ErrorEvent | null => scrubSentryEvent(event),
});
