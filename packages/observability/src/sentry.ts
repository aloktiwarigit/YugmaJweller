import * as Sentry from '@sentry/node';
import { redactPii } from './pii-redactor';

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;
  _initialized = true;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
    beforeSend: (event) => {
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = redactPii(event.request.data);
      }
      if (event.request?.headers) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { authorization: _a, cookie: _c, 'x-tenant-id': _t, ...safeHeaders } =
          event.request.headers as Record<string, string>;
        event.request.headers = safeHeaders;
      }
      if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : {};
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = (event.breadcrumbs as Sentry.Breadcrumb[]).map((b) => {
          if (!b.data) return b;
          return { ...b, data: redactPii(b.data) as { [key: string]: unknown } };
        });
      }
      return { ...event, extra: redactPii(event.extra ?? {}) };
    },
  });
}
