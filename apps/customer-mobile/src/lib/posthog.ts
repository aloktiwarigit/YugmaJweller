/**
 * posthog.ts — customer-mobile PostHog integration
 *
 * Responsibilities:
 *  1. initPostHog()         — call once at app boot from _layout.tsx
 *  2. identifyPostHog()     — call after sign-in with hashed phone + shopId
 *  3. captureEvent()        — thin wrapper (screens import this, not the SDK directly)
 *
 * PII rule: never pass phone, name, PAN, OTP, address in event properties.
 * Allowed: productId, shopId, path, bookingType, rating, pieceCount, depositPaise.
 *
 * PostHog is a no-op when EXPO_PUBLIC_POSTHOG_KEY is absent (CI / dev without project).
 */

import PostHog from 'posthog-react-native';
import { hashPhone } from './sentry';

let _client: PostHog | null = null;

/**
 * Call once at app boot. Idempotent — returns existing client if already initialised.
 * Returns null when EXPO_PUBLIC_POSTHOG_KEY is absent (SDK disabled).
 */
export function initPostHog(): PostHog | null {
  if (_client !== null) return _client;

  const key  = process.env['EXPO_PUBLIC_POSTHOG_KEY'];
  const host = process.env['EXPO_PUBLIC_POSTHOG_HOST'] ?? 'https://app.posthog.com';

  if (!key) return null;

  _client = new PostHog(key, { host });
  return _client;
}

/** Returns the active PostHog client, or null if not initialised. */
export function getPostHog(): PostHog | null {
  return _client;
}

/**
 * Capture an event. No-op when PostHog is not initialised.
 * Properties must not contain PII.
 */
export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | undefined>,
): void {
  _client?.capture(event, properties);
}

/**
 * Identify the current user after sign-in.
 * Uses hashed phone (first 12 hex of SHA-256) as distinct_id — never raw phone.
 * @param phoneE164 - raw phone; hashed before being sent to PostHog
 * @param shopSlug  - tenant shop identifier sent as a PostHog property (NOT a TenantContext param)
 */
export async function identifyPostHog(phoneE164: string, shopSlug: string): Promise<void> {
  if (!_client) return;
  const distinctId = await hashPhone(phoneE164);
  _client.identify(distinctId, { shopId: shopSlug });
}
