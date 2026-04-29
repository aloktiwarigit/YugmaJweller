export interface PaymentsPort {
  createOrder(params: {
    amountPaise: bigint;
    currency: 'INR';
    receiptId: string;
    notes: Record<string, string>;
  }): Promise<{ orderId: string; amountPaise: bigint }>;

  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  fetchPayment(razorpayPaymentId: string): Promise<{
    id: string;
    status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
    amountPaise: bigint;
  }>;
}
