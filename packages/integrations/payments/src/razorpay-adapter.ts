import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import type { PaymentsPort } from './port';
import { PaymentsAdapterError } from './errors';

export class RazorpayAdapter implements PaymentsPort {
  private readonly client: Razorpay;
  private readonly webhookSecret: string;

  constructor() {
    const keyId     = process.env['RAZORPAY_KEY_ID'];
    const keySecret = process.env['RAZORPAY_KEY_SECRET'];
    this.webhookSecret = process.env['RAZORPAY_WEBHOOK_SECRET'] ?? '';

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
    }
    if (!this.webhookSecret) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET must be set');
    }

    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  // HMAC-SHA256 over the raw request body.
  // crypto.timingSafeEqual prevents timing-oracle attacks on the signature comparison.
  // Both buffers are derived from hex-encoded HMAC output → always 32 bytes; equal length guaranteed.
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expectedHex = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Normalize to same encoding before timingSafeEqual to avoid length mismatch rejection
    // being exploitable as an oracle (attacker learns whether their sig is even valid hex).
    const expectedBuf = Buffer.from(expectedHex, 'utf8');
    const actualBuf   = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  async createOrder(params: {
    amountPaise: bigint;
    currency: 'INR';
    receiptId: string;
    notes: Record<string, string>;
  }): Promise<{ orderId: string; amountPaise: bigint }> {
    try {
      const order = await this.client.orders.create({
        amount:   Number(params.amountPaise),
        currency: params.currency,
        receipt:  params.receiptId,
        notes:    params.notes,
      });
      return {
        orderId:    order.id,
        amountPaise: BigInt(order.amount),
      };
    } catch (err) {
      throw new PaymentsAdapterError('razorpay', err instanceof Error ? err : new Error(String(err)));
    }
  }

  async fetchPayment(razorpayPaymentId: string): Promise<{
    id: string;
    status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
    amountPaise: bigint;
  }> {
    try {
      const payment = await this.client.payments.fetch(razorpayPaymentId);
      return {
        id:          payment.id,
        status:      payment.status as 'created' | 'authorized' | 'captured' | 'refunded' | 'failed',
        amountPaise: BigInt(payment.amount),
      };
    } catch (err) {
      throw new PaymentsAdapterError('razorpay', err instanceof Error ? err : new Error(String(err)));
    }
  }
}
