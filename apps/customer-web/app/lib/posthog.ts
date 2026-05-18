/**
 * posthog.ts — customer-web PostHog integration
 *
 * Responsibilities:
 *  1. initPostHog() — called once at app mount in StorefrontWrapper
 *  2. hashPhone()   — first-12-hex of SHA-256 for PII-safe distinct_id
 *
 * PostHog is a no-op when NEXT_PUBLIC_POSTHOG_KEY is absent (CI / dev without project).
 * PII rule: never put phone, name, PAN, OTP, or address in event properties.
 * Allowed properties: productId, shopId, path, bookingType, rating, pieceCount.
 */

import posthog from 'posthog-js';

let _initialized = false;

/**
 * Hash a raw phone number (E.164) using SHA-256, return first 12 hex chars.
 * Used as PostHog distinct_id — identifies the user without transmitting PII.
 */
export async function hashPhone(phoneE164: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(phoneE164.trim());
    const buf  = await crypto.subtle.digest('SHA-256', data);
    const hex  = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.slice(0, 12);
  } catch {
    return 'hash-unavail';
  }
}

/**
 * Call once at app mount (inside a 'use client' component).
 * Idempotent — safe to call on every render; initializes only once.
 */
export function initPostHog(): void {
  if (_initialized || typeof window === 'undefined') return;
  const key = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
  if (!key) return;
  posthog.init(key, {
    api_host:         process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://app.posthog.com',
    capture_pageview: false,  // manual page views via StorefrontWrapper
    capture_pageleave: false,
    autocapture:      false,  // explicit events only
  });
  _initialized = true;
}

export { posthog };
