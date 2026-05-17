/**
 * Sentry edge runtime configuration for customer-web.
 *
 * Auto-loaded by @sentry/nextjs for middleware and edge Route Handlers.
 * Edge runtime has no Node.js APIs — only Web APIs.
 *
 * Tags: runtime: 'edge' on every event so multi-runtime triage is possible.
 */

import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent, EventHint } from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/sentry-scrubber';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,

  enabled: Boolean(dsn),

  // Lower sample rate for edge functions (high frequency, lower blast radius).
  tracesSampleRate: 0.05,

  initialScope: {
    tags: {
      runtime: 'edge',
      tenant: process.env.NEXT_PUBLIC_SHOP_SLUG ?? 'unknown',
    },
  },

  beforeSend: (event: ErrorEvent, hint: EventHint): ErrorEvent | null => scrubSentryEvent(event),
});
