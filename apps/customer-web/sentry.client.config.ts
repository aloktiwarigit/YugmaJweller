/**
 * Sentry client-side (browser) configuration for customer-web.
 *
 * This file is auto-loaded by @sentry/nextjs on the client bundle.
 * It is NOT imported by application code — Sentry's webpack plugin injects it.
 *
 * PII scrubbing: beforeSend strips phone numbers, emails, customer names.
 * Tenant tagging: set at page load from NEXT_PUBLIC_SHOP_SLUG (build-time baked).
 *   Per-request server-side tagging is in instrumentation.ts.
 *
 * DSN is required for error capture. In dev (DSN absent), Sentry is a no-op.
 */

import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent, EventHint } from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/sentry-scrubber';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,

  // Disable Sentry entirely when DSN is not configured (dev builds, CI tests).
  enabled: Boolean(dsn),

  // Trace 10% of requests — adjust after baseline established.
  tracesSampleRate: 0.1,

  // Release is injected at build time by withSentryConfig.
  // Sentry auto-reads SENTRY_RELEASE / VERCEL_GIT_COMMIT_SHA / similar env vars.

  // Tag every event with the tenant slug baked into this deployment.
  // For per-request server-side tagging see instrumentation.ts.
  initialScope: {
    tags: {
      runtime: 'browser',
      tenant: process.env.NEXT_PUBLIC_SHOP_SLUG ?? 'unknown',
    },
  },

  beforeSend: (event: ErrorEvent, hint: EventHint): ErrorEvent | null => scrubSentryEvent(event),

  // Do not send replays (privacy requirement — no session recording on customer surfaces).
  integrations: [],
});
