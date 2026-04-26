import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';

// Emitted by BillingService.createInvoice after a successful issue.
// goldValuePaise is serialized as string because BigInt is not JSON-safe.
export interface InvoiceCreatedEvent {
  invoiceId:      string;
  shopId:         string;
  customerId:     string | null;     // null for walk-in
  goldValuePaise: string;            // bigint as string
  issuedAt:       string | null;
}

export interface LoyaltyAccrualJobData {
  invoiceId:      string;
  shopId:         string;
  customerId:     string;
  goldValuePaise: string;
}

export const LOYALTY_ACCRUAL_QUEUE = 'loyalty-accrual';

@Injectable()
export class LoyaltyEventListener {
  private readonly logger = new Logger(LoyaltyEventListener.name);

  constructor(
    @InjectQueue(LOYALTY_ACCRUAL_QUEUE) private readonly queue: Queue<LoyaltyAccrualJobData>,
  ) {}

  @OnEvent('invoice.created')
  async onInvoiceCreated(event: InvoiceCreatedEvent): Promise<void> {
    // Walk-in customers (B2B and B2C) skip loyalty entirely.
    if (event.customerId == null) {
      return;
    }

    // Zero-gold invoices (e.g. all-stones, all-making, all-hallmark fee) accrue no points.
    // Skip the job to save queue/worker overhead; the worker would no-op anyway.
    if (event.goldValuePaise === '0' || event.goldValuePaise === '') {
      return;
    }

    // Use invoiceId as the BullMQ job id so duplicate invoice.created events
    // (e.g. from a Bull retry of the producer) collapse to one job. Worker also
    // double-checks via Redis idempotency key for extra safety.
    await this.queue.add(
      'accrue',
      {
        invoiceId:      event.invoiceId,
        shopId:         event.shopId,
        customerId:     event.customerId,
        goldValuePaise: event.goldValuePaise,
      },
      {
        jobId: `accrue:${event.invoiceId}`,
        removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7d retention for debugging
        removeOnFail:     { age: 60 * 60 * 24 * 30 }, // 30d retention on failure
      },
    );

    this.logger.log(
      `loyalty accrual enqueued: invoiceId=${event.invoiceId} customerId=${event.customerId} shopId=${event.shopId}`,
    );
  }
}
