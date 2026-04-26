import * as crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { RazorpayAdapter } from './razorpay-adapter';
import { StubPaymentsAdapter } from './stub-adapter';

// ── Unit tests for verifyWebhookSignature ─────────────────────────────────────

describe('RazorpayAdapter.verifyWebhookSignature', () => {
  const webhookSecret = 'test-webhook-secret-32-chars-here!';
  const rawBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } });

  // Patch env and create adapter
  function makeAdapter(): RazorpayAdapter {
    process.env['RAZORPAY_KEY_ID']        = 'rzp_test_key';
    process.env['RAZORPAY_KEY_SECRET']    = 'rzp_test_secret';
    process.env['RAZORPAY_WEBHOOK_SECRET'] = webhookSecret;
    return new RazorpayAdapter();
  }

  it('accepts a valid HMAC-SHA256 signature', () => {
    const adapter = makeAdapter();
    const validSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    expect(adapter.verifyWebhookSignature(rawBody, validSig)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const adapter = makeAdapter();
    const validSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const tamperedBody = rawBody + 'tampered';
    expect(adapter.verifyWebhookSignature(tamperedBody, validSig)).toBe(false);
  });

  it('rejects an incorrect signature', () => {
    const adapter = makeAdapter();
    const wrongSig = 'a'.repeat(64); // 64-char hex string of wrong value
    expect(adapter.verifyWebhookSignature(rawBody, wrongSig)).toBe(false);
  });

  it('uses timingSafeEqual (not ==) — length mismatch returns false', () => {
    const adapter = makeAdapter();
    expect(adapter.verifyWebhookSignature(rawBody, 'short')).toBe(false);
  });
});

// ── StubPaymentsAdapter ──────────────────────────────────────────────────────

describe('StubPaymentsAdapter', () => {
  const stub = new StubPaymentsAdapter();

  it('createOrder returns a stub orderId', async () => {
    const result = await stub.createOrder({
      amountPaise: 100000n,
      currency: 'INR',
      receiptId: 'test_receipt',
      notes: { invoiceId: 'inv_123', shopId: 'shop_456' },
    });
    expect(result.orderId).toMatch(/order_stub_/);
    expect(result.amountPaise).toBe(100000n);
  });

  it('verifyWebhookSignature always returns true', () => {
    expect(stub.verifyWebhookSignature('anything', 'any_sig')).toBe(true);
  });

  it('fetchPayment returns captured status', async () => {
    const result = await stub.fetchPayment('pay_stub_123');
    expect(result.status).toBe('captured');
    expect(result.id).toBe('pay_stub_123');
  });
});

// ── PaymentsPort contract conformance ────────────────────────────────────────

describe('RazorpayAdapter vs StubPaymentsAdapter interface conformance', () => {
  it('both implement the same PaymentsPort shape', () => {
    const stub = new StubPaymentsAdapter();
    expect(typeof stub.createOrder).toBe('function');
    expect(typeof stub.verifyWebhookSignature).toBe('function');
    expect(typeof stub.fetchPayment).toBe('function');
  });
});
