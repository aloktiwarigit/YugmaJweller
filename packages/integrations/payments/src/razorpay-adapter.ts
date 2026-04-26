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
  // Security design:
  //   - Both sides are decoded as hex into 32-byte Buffers before comparison.
  //   - This avoids the length-oracle that string comparison creates (a 64-char
  //     hex HMAC always produces a 32-byte Buffer; any non-hex input decodes to
  //     fewer bytes, so a length mismatch reveals nothing about the secret).
  //   - crypto.timingSafeEqual ensures constant-time comparison for valid-length inputs.
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expectedBuf = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest();                            // raw 32-byte Buffer, never hex string

    // Decode the incoming hex signature to the same 32-byte representation.
    // If the signature is not valid 64-char hex, actualBuf will be shorter than 32
    // bytes and we return false — no oracle (both sides are always decoded as binary).
    const actualBuf = Buffer.from(signature ?? '', 'hex');

    if (actualBuf.length !== expectedBuf.length) return false;
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
