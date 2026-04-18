import pino from 'pino';
import { redactPii } from './pii-redactor';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  formatters: {
    log: (obj) => redactPii(obj),
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-tenant-id"]', '*.password', '*.otp'],
    censor: '[REDACTED:field]',
  },
});
