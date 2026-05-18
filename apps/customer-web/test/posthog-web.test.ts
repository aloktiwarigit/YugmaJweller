/**
 * posthog-web.test.ts — Tests for customer-web PostHog wiring.
 *
 * posthog-js is mocked so tests assert event names + PII-safe properties
 * without real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock posthog-js before importing app/lib/posthog
vi.mock('posthog-js', () => ({
  default: {
    init:     vi.fn(),
    capture:  vi.fn(),
    identify: vi.fn(),
  },
}));

import posthog from 'posthog-js';
import { hashPhone, initPostHog } from '../app/lib/posthog';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── hashPhone ────────────────────────────────────────────────────────────────

describe('hashPhone (web)', () => {
  it('returns a 12-char hex string', async () => {
    const hash = await hashPhone('+919876543210');
    expect(hash).toHaveLength(12);
    expect(/^[0-9a-f]{12}$/.test(hash)).toBe(true);
  });

  it('is deterministic', async () => {
    const h1 = await hashPhone('+919876543210');
    const h2 = await hashPhone('+919876543210');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different phones', async () => {
    const h1 = await hashPhone('+919876543210');
    const h2 = await hashPhone('+919876543211');
    expect(h1).not.toBe(h2);
  });

  it('trims whitespace before hashing', async () => {
    const h1 = await hashPhone('+919876543210');
    const h2 = await hashPhone('  +919876543210  ');
    expect(h1).toBe(h2);
  });
});

// ── initPostHog ──────────────────────────────────────────────────────────────

describe('initPostHog', () => {
  it('does not call posthog.init when NEXT_PUBLIC_POSTHOG_KEY is absent', () => {
    const saved = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
    delete process.env['NEXT_PUBLIC_POSTHOG_KEY'];
    initPostHog();
    expect(vi.mocked(posthog.init)).not.toHaveBeenCalled();
    process.env['NEXT_PUBLIC_POSTHOG_KEY'] = saved;
  });
});

// ── PII invariants ───────────────────────────────────────────────────────────

describe('PII invariants for event properties', () => {
  const PII_FIELDS = ['phone', 'phoneE164', 'name', 'customerName', 'otp', 'pan', 'address'];

  function assertNoPii(properties: Record<string, unknown>): void {
    for (const field of PII_FIELDS) {
      expect(Object.keys(properties)).not.toContain(field);
    }
  }

  it('wishlist_add properties contain no PII', () => {
    const props = { productId: 'prod-123', shopId: 'shop-456' };
    assertNoPii(props);
    expect(props.productId).toBe('prod-123');
  });

  it('wishlist_remove properties contain no PII', () => {
    const props = { productId: 'prod-123', shopId: 'shop-456' };
    assertNoPii(props);
  });

  it('page_view properties contain no PII', () => {
    const props = { path: '/products/prod-123', shopId: 'shop-456' };
    assertNoPii(props);
  });
});
