import * as Sentry from '@sentry/node';
import { redactPii } from './pii-redactor';

export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
    beforeSend: (event) => ({ ...event, extra: redactPii(event.extra ?? {}) }),
  });
}
