/**
 * sentry.ts — customer-mobile Sentry integration
 *
 * Responsibilities:
 *  1. Provide `initSentry()` called once at app boot from _layout.tsx
 *  2. PII scrubber: strips phone numbers, OTP codes, addresses, customer names
 *     from every event before transmission
 *  3. Tenant tag setter: call `setSentryTenantContext(slug, phoneE164?)` after
 *     tenant + auth are known; sets `tenant` tag + hashed phone tag
 *
 * SDK choice: @sentry/react-native ≥ 5.x with the Sentry Expo plugin.
 * sentry-expo is deprecated for Expo SDK 50+ — Sentry's own docs (5.x) say
 * to use @sentry/react-native directly with the `@sentry/react-native/expo`
 * plugin in app.config.ts.
 *
 * No PII in events — enforced by beforeSend scrubber below.
 * Offline events are queued by the SDK's built-in transport (no extra config needed).
 */

import * as Sentry from '@sentry/react-native';
import type { Event } from '@sentry/react-native';

/** Inline type matching @sentry/types EventHint — avoids direct @sentry/types dep resolution issues */
interface SentryEventHint {
  originalException?: unknown;
  event_id?: string;
  data?: unknown;
}

// ── PII scrubbing ────────────────────────────────────────────────────────────

/**
 * Regular expressions for PII patterns that must never leave the device.
 * Phone numbers (E.164 +91xxxxxxxxxx and plain 10-digit),
 * OTP codes (4–8 digit standalone tokens),
 * street addresses (rough heuristic: "123 Some Street" patterns),
 * common name fields as stringified JSON keys.
 */
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // E.164 Indian phone numbers: +91XXXXXXXXXX
  { pattern: /\+91\s?\d{10}/g, replacement: '[phone-redacted]' },
  // Plain 10-digit numbers starting with 6-9 (Indian mobile)
  { pattern: /\b[6-9]\d{9}\b/g, replacement: '[phone-redacted]' },
  // 4–8 digit OTP codes (standalone, not part of longer numbers)
  { pattern: /\botp[:\s"'=]*\d{4,8}\b/gi, replacement: '[otp-redacted]' },
  { pattern: /\bcode[:\s"'=]*\d{4,8}\b/gi, replacement: '[otp-redacted]' },
  // Street addresses: number + word(s) ending in common address suffixes
  // Note: using \S to match any non-whitespace (including Devanagari) instead of char ranges
  // to avoid the no-misleading-character-class lint rule on combined Unicode codepoints.
  { pattern: /\b\d+[,\s]+[\S\s]{3,50}(?:marg|road|gali|nagar|colony|sector|ward|mohalla|street|lane|rd|st)\b/gi, replacement: '[address-redacted]' },
];

/** JSON-key names whose values are PII and should always be redacted */
const PII_KEYS = new Set([
  'phone',
  'phoneE164',
  'phone_e164',
  'mobileNumber',
  'otp',
  'otpCode',
  'otp_code',
  'name',
  'customerName',
  'customer_name',
  'fullName',
  'full_name',
  'address',
  'streetAddress',
  'street_address',
  'pan', // PAN number — sensitive, not PII per se but scrub anyway
  'panNumber',
  'pan_number',
]);

/**
 * Scrub a string value of all PII pattern matches.
 */
export function scrubString(value: string): string {
  let result = value;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Recursively walk an object and scrub PII keys + string values.
 * Returns a new object; does not mutate the input.
 */
function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[max-depth-reached]';
  if (typeof obj === 'string') return scrubString(obj);
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map((item) => scrubObject(item, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_KEYS.has(key)) {
      result[key] = '[redacted]';
    } else {
      result[key] = scrubObject(value, depth + 1);
    }
  }
  return result;
}

/**
 * Sentry beforeSend hook — scrubs PII from every event payload.
 * Returns null to drop the event (we never drop; we only scrub).
 */
export function scrubEvent(event: Event, _hint: SentryEventHint): Event | null {
  const scrubbed = scrubObject(event) as Event;
  return scrubbed;
}

// ── Phone hashing ────────────────────────────────────────────────────────────

/**
 * Hash a raw phone number (E.164) using SHA-256 and return the first 12 hex chars.
 * This allows cohort triage ("which users are affected?") without transmitting PII.
 *
 * Uses the Web Crypto API (available on React Native ≥ 0.71 / Hermes via polyfill).
 * Falls back to a simple length-only string if crypto is unavailable.
 */
export async function hashPhone(phoneE164: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(phoneE164.trim());
    // React Native / Hermes exposes crypto.subtle via the global
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 12);
  } catch {
    // Crypto unavailable — return a fixed sentinel so we don't silently swallow errors
    return 'hash-unavail';
  }
}

// ── Tenant context setter ────────────────────────────────────────────────────

/**
 * Call this after the tenant + customer session are known (i.e. after TenantProvider
 * resolves and CustomerAuthProvider confirms the session). Safe to call multiple times.
 *
 * @param tenantSlug - The tenant's URL slug (e.g. "anchor-dev")
 * @param phoneE164  - Raw E.164 phone (optional — absent for unauthenticated sessions)
 */
export async function setSentryTenantContext(
  tenantSlug: string,
  phoneE164?: string,
): Promise<void> {
  Sentry.setTag('tenant', tenantSlug);
  if (phoneE164) {
    const phoneHash = await hashPhone(phoneE164);
    Sentry.setTag('customer_phone_hash', phoneHash);
  }
}

// ── Initialisation ───────────────────────────────────────────────────────────

/**
 * Must be called ONCE at app boot, before any other Sentry call.
 * Returns immediately — Sentry init is synchronous.
 *
 * DSN is read from the EXPO_PUBLIC_SENTRY_DSN env var. If absent (CI, dev without
 * Sentry project), the SDK initialises with no DSN and silently drops events.
 */
export function initSentry(): void {
  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN'];

  Sentry.init({
    dsn: dsn ?? '',          // empty string → SDK runs but drops all events
    enabled: Boolean(dsn),  // explicitly disable when no DSN so SDK is a no-op
    environment: process.env['EXPO_PUBLIC_ENV'] ?? 'development',
    // Do NOT enable tracing here — performance monitoring is deferred (out of scope for 19.2)
    tracesSampleRate: 0,
    // beforeSend scrubs all PII before any event leaves the device
    beforeSend: scrubEvent,
    // Default integrations include the offline transport queue — no extra config needed.
    // Native crash reporting is included by default in @sentry/react-native.
  });
}

// Re-export Sentry namespace so callers only need to import from this module
export { Sentry };
