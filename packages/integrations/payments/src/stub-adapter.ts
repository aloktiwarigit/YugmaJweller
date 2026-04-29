import type { PaymentsPort } from './port';

// Local-dev stub — never contacts Razorpay.
// Set PAYMENTS_ADAPTER=stub (default) to use this in development.
export class StubPaymentsAdapter implements PaymentsPort {
  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    return true;
  }

  async createOrder(params: {
    amountPaise: bigint;
    currency: 'INR';
    receiptId: string;
    notes: Record<string, string>;
  }): Promise<{ orderId: string; amountPaise: bigint }> {
    const orderId = `order_stub_${Date.now()}_${params.receiptId}`;
    return { orderId, amountPaise: params.amountPaise };
  }

  async fetchPayment(razorpayPaymentId: string): Promise<{
    id: string;
    status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
    amountPaise: bigint;
  }> {
    return {
      id:          razorpayPaymentId,
      status:      'captured',
      amountPaise: 0n,
    };
  }
}
