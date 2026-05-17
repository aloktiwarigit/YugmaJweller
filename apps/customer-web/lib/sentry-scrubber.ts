/**
 * Sentry PII scrubber for customer-web.
 *
 * Rules (per CLAUDE.md §"No PII in error payloads"):
 *  - Strip phone numbers (Indian mobile: 10-digit sequences, optionally prefixed +91)
 *  - Strip email addresses
 *  - Strip named PII fields (customer_name, name, address, otp, phone, email)
 *  - Preserve stack frames, tenant slug, URL path, request method, event metadata
 *
 * Usage: pass as Sentry `beforeSend` callback.
 */

import type { ErrorEvent } from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

// Matches Indian mobile numbers in three forms:
//   +91 9876543210  (country code with space/dash)
//   +919876543210   (country code no space)
//   9876543210      (bare 10-digit starting with 6-9)
// The three alternations are ordered longest-match first so +91 prefix
// is consumed as part of the pattern and not left as a dangling fragment.
const PHONE_RE = /(?:\+91[\s-]?[6-9]\d{9}|(?<!\d)[6-9]\d{9}(?!\d))/g;

// Basic RFC-5322-ish email pattern (sufficient for scrubbing, not validation).
// Dash is placed at the end of each character class to avoid escaping.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// PII field names whose values should be blanked unconditionally.
const PII_FIELD_NAMES = new Set([
  'name',
  'customer_name',
  'full_name',
  'first_name',
  'last_name',
  'address',
  'phone',
  'mobile',
  'email',
  'otp',
  'pan',
  'pan_number',
  'aadhaar',
]);

// ---------------------------------------------------------------------------
// String-level scrubbing
// ---------------------------------------------------------------------------

function scrubString(value: string): string {
  return value
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(EMAIL_RE, '[REDACTED_EMAIL]');
}

// ---------------------------------------------------------------------------
// Object-level scrubbing (shallow — one level of extra/contexts)
// ---------------------------------------------------------------------------

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELD_NAMES.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = scrubString(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Request body scrubbing
// ---------------------------------------------------------------------------

function scrubRequestData(data: unknown): unknown {
  if (typeof data === 'string') return scrubString(data);
  if (data && typeof data === 'object') {
    return scrubObject(data as Record<string, unknown>);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Main scrubber — used as `beforeSend` in Sentry configs
// ---------------------------------------------------------------------------

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent | null {
  if (!event) return null;

  // Scrub top-level message
  if (typeof event.message === 'string') {
    event.message = scrubString(event.message);
  }

  // Scrub exception values (the human-readable error message, not stack frames)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (typeof ex.value === 'string') {
        ex.value = scrubString(ex.value);
      }
    }
  }

  // Scrub extra data (arbitrary key-value developer context)
  if (event.extra && typeof event.extra === 'object') {
    event.extra = scrubObject(event.extra as Record<string, unknown>);
  }

  // Scrub request body data
  if (event.request) {
    event.request.data = scrubRequestData(event.request.data);
    // Scrub query string params embedded in the URL if any PII landed there
    if (typeof event.request.url === 'string') {
      event.request.url = scrubString(event.request.url);
    }
    // Remove cookies entirely — they may carry session tokens
    if (event.request.cookies) {
      // Sentry Request.cookies is Record<string, string>; blank each value
      const cookies = event.request.cookies as Record<string, string>;
      for (const key of Object.keys(cookies)) {
        cookies[key] = '[SCRUBBED]';
      }
    }
    // Remove sensitive headers (Authorization, Cookie) if present
    if (event.request.headers && typeof event.request.headers === 'object') {
      const headers = event.request.headers as Record<string, string>;
      for (const sensitiveHeader of ['authorization', 'cookie', 'x-auth-token']) {
        if (headers[sensitiveHeader]) {
          headers[sensitiveHeader] = '[SCRUBBED]';
        }
      }
    }
  }

  // Scrub breadcrumbs data
  // event.breadcrumbs.values is Breadcrumb[] | undefined per Sentry types
  const breadcrumbValues: unknown[] = (event.breadcrumbs as { values?: unknown[] } | undefined)?.values ?? [];
  if (breadcrumbValues.length > 0) {
    for (const crumb of breadcrumbValues) {
      const c = crumb as { message?: string; data?: Record<string, unknown> };
      if (typeof c.message === 'string') {
        c.message = scrubString(c.message);
      }
      if (c.data && typeof c.data === 'object') {
        c.data = scrubObject(c.data);
      }
    }
  }

  return event;
}
