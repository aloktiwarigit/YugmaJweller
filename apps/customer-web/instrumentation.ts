/**
 * Next.js 14 instrumentation hook (App Router).
 *
 * Called once per runtime when the server starts. Used to:
 *  1. Register @sentry/nextjs for SSR error capture (required by Sentry SDK).
 *  2. Confirm Sentry auth token is present in production CI builds.
 *
 * This file is auto-detected by Next.js when placed at the app root.
 * Do NOT add it to the `pages/` directory.
 *
 * Ref: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Guard: in production builds, source-map upload requires SENTRY_AUTH_TOKEN.
  // Fail loudly here (server start) rather than silently skipping upload later.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE === 'phase-production-build' &&
    !process.env.SENTRY_AUTH_TOKEN
  ) {
    throw new Error(
      '[Sentry] SENTRY_AUTH_TOKEN required for source-map upload in production build. ' +
      'Set the SENTRY_AUTH_TOKEN secret in CI (GitHub Actions secret: SENTRY_AUTH_TOKEN).',
    );
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
