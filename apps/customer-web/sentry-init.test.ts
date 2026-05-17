/**
 * Integration tests: Sentry SDK initialisation (mocked transport)
 *
 * Verifies that sentry.{client,server,edge}.config.ts call Sentry.init with
 * the expected contract — DSN, enabled flag, tracesSampleRate, environment
 * tags, and beforeSend wired to scrubSentryEvent.
 *
 * @sentry/nextjs is fully mocked so no real network/transport is exercised.
 *
 * Story 19.1 spec gap: "Integration: synthetic error route in dev mode
 * confirms Sentry SDK initialisation (mocked transport)"
 */

import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SentryInitOptions = {
  dsn?: string;
  enabled?: boolean;
  tracesSampleRate?: number;
  initialScope?: { tags?: Record<string, string> };
  beforeSend?: (event: unknown, hint?: unknown) => unknown;
  integrations?: unknown[];
};

/**
 * Reset module registry between tests so each dynamic import re-evaluates
 * the config module with whatever env vars are set at that moment.
 */
function resetModulesAndMock() {
  vi.resetModules();
  vi.mock('@sentry/nextjs', () => ({
    init: vi.fn(),
  }));
}

async function getSentryMock() {
  const sentry = await import('@sentry/nextjs');
  return sentry.init as MockedFunction<(options: SentryInitOptions) => void>;
}

// ---------------------------------------------------------------------------
// sentry.client.config.ts
// ---------------------------------------------------------------------------

describe('sentry.client.config.ts — Sentry.init contract', () => {
  beforeEach(() => {
    resetModulesAndMock();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('calls Sentry.init exactly once', async () => {
    await import('./sentry.client.config');
    const init = await getSentryMock();
    expect(init).toHaveBeenCalledOnce();
  });

  it('passes DSN from NEXT_PUBLIC_SENTRY_DSN when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://abc@sentry.io/123');
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.dsn).toBe('https://abc@sentry.io/123');
  });

  it('sets enabled: true when DSN is present', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://abc@sentry.io/123');
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.enabled).toBe(true);
  });

  it('sets enabled: false (no-op) when DSN is absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.enabled).toBe(false);
  });

  it('sets tracesSampleRate to 0.1', async () => {
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.tracesSampleRate).toBe(0.1);
  });

  it('tags runtime as "browser" in initialScope', async () => {
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.initialScope?.tags?.['runtime']).toBe('browser');
  });

  it('wires beforeSend to scrubSentryEvent (callback present)', async () => {
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(typeof opts.beforeSend).toBe('function');
  });

  it('beforeSend returns null when passed null (drop-event pass-through)', async () => {
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    // scrubSentryEvent returns null for null input — verifies the wire-up
    expect(opts.beforeSend?.(null)).toBeNull();
  });

  it('beforeSend strips phone PII from event message', async () => {
    await import('./sentry.client.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    const fakeEvent = { event_id: 'x', level: 'error', message: 'OTP 9876543210 sent' };
    const result = opts.beforeSend?.(fakeEvent) as { message?: string } | null;
    expect(result?.message).not.toMatch(/9876543210/);
    expect(result?.message).toContain('[REDACTED_PHONE]');
  });
});

// ---------------------------------------------------------------------------
// sentry.server.config.ts
// ---------------------------------------------------------------------------

describe('sentry.server.config.ts — Sentry.init contract', () => {
  beforeEach(() => {
    resetModulesAndMock();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('calls Sentry.init exactly once', async () => {
    await import('./sentry.server.config');
    const init = await getSentryMock();
    expect(init).toHaveBeenCalledOnce();
  });

  it('prefers SENTRY_DSN over NEXT_PUBLIC_SENTRY_DSN', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://server@sentry.io/456');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@sentry.io/789');
    await import('./sentry.server.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.dsn).toBe('https://server@sentry.io/456');
  });

  it('sets enabled: false when both DSN env vars absent', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    await import('./sentry.server.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.enabled).toBe(false);
  });

  it('sets tracesSampleRate to 0.1', async () => {
    await import('./sentry.server.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.tracesSampleRate).toBe(0.1);
  });

  it('tags runtime as "nodejs" in initialScope', async () => {
    await import('./sentry.server.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.initialScope?.tags?.['runtime']).toBe('nodejs');
  });

  it('wires beforeSend to scrubSentryEvent (callback present)', async () => {
    await import('./sentry.server.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(typeof opts.beforeSend).toBe('function');
  });

  it('beforeSend strips email PII from event message', async () => {
    await import('./sentry.server.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    const fakeEvent = { event_id: 'y', level: 'error', message: 'Invoice for priya@example.com' };
    const result = opts.beforeSend?.(fakeEvent) as { message?: string } | null;
    expect(result?.message).not.toMatch(/priya@example\.com/);
    expect(result?.message).toContain('[REDACTED_EMAIL]');
  });
});

// ---------------------------------------------------------------------------
// sentry.edge.config.ts
// ---------------------------------------------------------------------------

describe('sentry.edge.config.ts — Sentry.init contract', () => {
  beforeEach(() => {
    resetModulesAndMock();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('calls Sentry.init exactly once', async () => {
    await import('./sentry.edge.config');
    const init = await getSentryMock();
    expect(init).toHaveBeenCalledOnce();
  });

  it('sets enabled: true when DSN env var is present', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://edge@sentry.io/999');
    await import('./sentry.edge.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.enabled).toBe(true);
  });

  it('sets enabled: false when DSN is absent', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    await import('./sentry.edge.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.enabled).toBe(false);
  });

  it('sets tracesSampleRate to 0.05 (lower for high-frequency edge)', async () => {
    await import('./sentry.edge.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.tracesSampleRate).toBe(0.05);
  });

  it('tags runtime as "edge" in initialScope', async () => {
    await import('./sentry.edge.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(opts.initialScope?.tags?.['runtime']).toBe('edge');
  });

  it('wires beforeSend to scrubSentryEvent (callback present)', async () => {
    await import('./sentry.edge.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    expect(typeof opts.beforeSend).toBe('function');
  });

  it('beforeSend strips customer_name PII from extra data', async () => {
    await import('./sentry.edge.config');
    const init = await getSentryMock();
    const opts = init.mock.calls[0]?.[0] as SentryInitOptions;
    const fakeEvent = {
      event_id: 'z',
      level: 'error',
      message: 'Edge error',
      extra: { customer_name: 'Ramesh Kumar', order_id: 'ORD-007' },
    };
    const result = opts.beforeSend?.(fakeEvent) as {
      extra?: Record<string, unknown>;
    } | null;
    expect(result?.extra?.['customer_name']).toBe('[REDACTED]');
    expect(result?.extra?.['order_id']).toBe('ORD-007');
  });
});
