import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { enforce269ss, ComplianceHardBlockError } from '@goldsmith/compliance';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { PaymentsPort } from '@goldsmith/integrations-payments';
import type { StoragePort } from '@goldsmith/integrations-storage';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import { trackEvent } from '@goldsmith/observability';
import { CustomOrdersRepository } from './custom-orders.repository';
import type { CustomOrderRow, CustomOrderMilestoneRow } from './custom-orders.repository';

export { ComplianceHardBlockError };

export interface CreateOrderDto {
  customerId?: string;
  description: string;
  designReferenceUrl?: string;
  quotedAmountPaise?: bigint;
  estimatedDeliveryDate?: string;
}

export interface CreateDepositOrderDto {
  depositAmountPaise: bigint;
  paymentMethod: 'cash' | 'razorpay';
}

export interface AddMilestoneDto {
  title: string;
  note?: string;
  photoUrl?: string;
}

export interface CustomOrderResponse {
  id:                      string;
  shopId:                  string;
  customerId:              string | null;
  description:             string;
  designReferenceUrl:      string | null;
  quotedAmountPaise:       string | null;
  depositAmountPaise:      string;
  depositPaidPaise:        string;
  razorpayOrderId:         string | null;
  status:                  string;
  estimatedDeliveryDate:   string | null;
  createdAt:               string;
}

export interface MilestoneResponse {
  id:            string;
  customOrderId: string;
  title:         string;
  note:          string | null;
  photoUrl:      string | null;
  createdAt:     string;
}

function rowToResponse(r: CustomOrderRow): CustomOrderResponse {
  return {
    id:                    r.id,
    shopId:                r.shop_id,
    customerId:            r.customer_id,
    description:           r.description,
    designReferenceUrl:    r.design_reference_url,
    quotedAmountPaise:     r.quoted_amount_paise?.toString() ?? null,
    depositAmountPaise:    r.deposit_amount_paise.toString(),
    depositPaidPaise:      r.deposit_paid_paise.toString(),
    razorpayOrderId:       r.razorpay_order_id,
    status:                r.status,
    estimatedDeliveryDate: r.estimated_delivery_date,
    createdAt:             r.created_at.toISOString(),
  };
}

function milestoneRowToResponse(r: CustomOrderMilestoneRow): MilestoneResponse {
  return {
    id:            r.id,
    customOrderId: r.custom_order_id,
    title:         r.title,
    note:          r.note,
    photoUrl:      r.photo_url,
    createdAt:     r.created_at.toISOString(),
  };
}

@Injectable()
export class CustomOrdersService {
  private readonly logger = new Logger(CustomOrdersService.name);

  constructor(
    @Inject('PG_POOL')           private readonly pool: Pool,
    @Inject(CustomOrdersRepository) private readonly repo: CustomOrdersRepository,
    @Inject('PAYMENTS_ADAPTER')  private readonly paymentsAdapter: PaymentsPort,
    @Inject(STORAGE_PORT)        private readonly storage: StoragePort,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<CustomOrderResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const row = await this.repo.insert({
      shopId:                ctx.shopId,
      customerId:            dto.customerId ?? null,
      description:           dto.description,
      designReferenceUrl:    dto.designReferenceUrl ?? null,
      quotedAmountPaise:     dto.quotedAmountPaise ?? null,
      estimatedDeliveryDate: dto.estimatedDeliveryDate ?? null,
    });
    void auditLog(this.pool, {
      action:      AuditAction.CUSTOM_ORDER_CREATED,
      subjectType: 'custom_order',
      subjectId:   row.id,
      actorUserId: ctx.userId,
      after: { description: dto.description, customerId: dto.customerId ?? null },
    }).catch(() => undefined);
    trackEvent(ctx.shopId, 'custom_order.created');
    return rowToResponse(row);
  }

  async list(params: { limit: number; offset: number }): Promise<{ orders: CustomOrderResponse[]; total: number }> {
    const { rows, total } = await this.repo.list(params);
    return { orders: rows.map(rowToResponse), total };
  }

  async getById(orderId: string): Promise<CustomOrderResponse & { milestones: MilestoneResponse[] }> {
    const order = await this.repo.findById(orderId);
    if (!order) throw new NotFoundException({ code: 'custom_order.not_found' });
    const milestones = await this.repo.listMilestones(orderId);
    return { ...rowToResponse(order), milestones: milestones.map(milestoneRowToResponse) };
  }

  async createDepositOrder(
    orderId: string,
    dto: CreateDepositOrderDto,
  ): Promise<CustomOrderResponse & { razorpayKeyId?: string }> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const order = await this.repo.findById(orderId);
    if (!order) throw new NotFoundException({ code: 'custom_order.not_found' });

    if (!['QUOTE', 'DEPOSIT_PENDING'].includes(order.status)) {
      throw new UnprocessableEntityException({ code: 'custom_order.invalid_status_for_deposit' });
    }

    if (dto.depositAmountPaise <= 0n) {
      throw new BadRequestException({ code: 'custom_order.deposit_amount_required' });
    }

    if (dto.paymentMethod === 'cash') {
      // Section 269SS: cash advance ≥ Rs 20,000 is prohibited
      enforce269ss(dto.depositAmountPaise, 'advance');

      const updated = await this.repo.updateDepositOrder(orderId, {
        depositAmountPaise: dto.depositAmountPaise,
        razorpayOrderId: null,
        status: 'DEPOSIT_PENDING',
      });
      return rowToResponse(updated);
    }

    // Razorpay: create order and return payment details
    const receiptId = `co-${orderId.slice(0, 8)}`;
    const razorpayOrder = await this.paymentsAdapter.createOrder({
      amountPaise: dto.depositAmountPaise,
      currency:    'INR',
      receiptId,
      notes: { shopId: ctx.shopId, customOrderId: orderId, type: 'custom_order_deposit' },
    });

    const updated = await this.repo.updateDepositOrder(orderId, {
      depositAmountPaise: dto.depositAmountPaise,
      razorpayOrderId:    razorpayOrder.orderId,
      status:             'DEPOSIT_PENDING',
    });

    return {
      ...rowToResponse(updated),
      razorpayKeyId: process.env['RAZORPAY_KEY_ID'],
    };
  }

  async recordCashDeposit(orderId: string, amountPaise: bigint): Promise<CustomOrderResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const order = await this.repo.findById(orderId);
    if (!order) throw new NotFoundException({ code: 'custom_order.not_found' });

    if (order.status !== 'DEPOSIT_PENDING') {
      throw new UnprocessableEntityException({ code: 'custom_order.not_awaiting_deposit' });
    }

    // Section 269SS: cash advance ≥ Rs 20,000 prohibited
    enforce269ss(amountPaise, 'advance');

    const updated = await this.repo.recordDepositPaid(orderId, amountPaise, null);
    void auditLog(this.pool, {
      action:      AuditAction.CUSTOM_ORDER_DEPOSIT_PAID,
      subjectType: 'custom_order',
      subjectId:   orderId,
      actorUserId: ctx.userId,
      after: {
        amountPaise:       amountPaise.toString(),
        depositPaidPaise:  updated.deposit_paid_paise.toString(),
        newStatus:         updated.status,
      },
    }).catch(() => undefined);
    return rowToResponse(updated);
  }

  // Signature verification is done in the controller before this is called.
  // shopIdHint comes from Razorpay order notes (set by OUR server at order creation).
  async handleRazorpayWebhook(
    orderId: string,
    razorpayPaymentId: string,
    shopIdHint: string,
  ): Promise<void> {
    const payment = await this.paymentsAdapter.fetchPayment(razorpayPaymentId);

    // nosemgrep: goldsmith.require-tenant-transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // nosemgrep: goldsmith.no-raw-shop-id-param
      await client.query(`SET LOCAL app.current_shop_id = '${shopIdHint}'`);

      // Lock and verify shop ownership before any DML
      const res = await client.query<{ id: string; shop_id: string; deposit_paid_paise: bigint; deposit_amount_paise: bigint; status: string }>(
        `SELECT id, shop_id, deposit_paid_paise, deposit_amount_paise, status
         FROM custom_orders
         WHERE id = $1
           AND shop_id = $2
         FOR UPDATE`,
        [orderId, shopIdHint],
      );
      const order = res.rows[0];
      if (!order) {
        await client.query('ROLLBACK');
        this.logger.warn({ orderId, shopIdHint }, 'Custom order webhook: order not found or shop mismatch');
        return;
      }

      const newPaid   = order.deposit_paid_paise + payment.amountPaise;
      const newStatus = newPaid >= order.deposit_amount_paise ? 'IN_PROGRESS' : order.status;

      await client.query(
        `UPDATE custom_orders
         SET deposit_paid_paise  = $2,
             razorpay_payment_id = $3,
             status              = $4
         WHERE id = $1`,
        [orderId, newPaid, razorpayPaymentId, newStatus],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    this.logger.log({ orderId, razorpayPaymentId }, 'Custom order deposit webhook processed');
  }

  async addMilestone(orderId: string, dto: AddMilestoneDto): Promise<MilestoneResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const order = await this.repo.findById(orderId);
    if (!order) throw new NotFoundException({ code: 'custom_order.not_found' });

    if (!['IN_PROGRESS', 'READY'].includes(order.status)) {
      throw new UnprocessableEntityException({ code: 'custom_order.must_be_in_progress_for_milestone' });
    }

    const milestone = await this.repo.insertMilestone({
      customOrderId: orderId,
      title:         dto.title,
      note:          dto.note ?? null,
      photoUrl:      dto.photoUrl ?? null,
    });

    // WhatsApp stub — AiSensy integration deferred to Epic 13
    this.logger.log(`WhatsApp stub: milestone ${milestone.id}`);

    void auditLog(this.pool, {
      action:      AuditAction.CUSTOM_ORDER_MILESTONE_ADDED,
      subjectType: 'custom_order_milestone',
      subjectId:   milestone.id,
      actorUserId: ctx.userId,
      after: { orderId, title: dto.title },
    }).catch(() => undefined);
    return milestoneRowToResponse(milestone);
  }

  async markReady(orderId: string): Promise<CustomOrderResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const order = await this.repo.findById(orderId);
    if (!order) throw new NotFoundException({ code: 'custom_order.not_found' });

    if (order.status !== 'IN_PROGRESS') {
      throw new UnprocessableEntityException({ code: 'custom_order.must_be_in_progress_to_mark_ready' });
    }

    const updated = await this.repo.updateStatus(orderId, 'READY');
    void auditLog(this.pool, {
      action:      AuditAction.CUSTOM_ORDER_MARKED_READY,
      subjectType: 'custom_order',
      subjectId:   orderId,
      actorUserId: ctx.userId,
    }).catch(() => undefined);
    // WhatsApp stub
    this.logger.log(`WhatsApp stub: order ${orderId} marked READY`);
    return rowToResponse(updated);
  }

  async getPresignedUploadUrl(orderId: string, filename: string): Promise<{ uploadUrl: string; key: string }> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const order = await this.repo.findById(orderId);
    if (!order) throw new NotFoundException({ code: 'custom_order.not_found' });

    const key = `custom-orders/${ctx.shopId}/${orderId}/${Date.now()}-${filename}`;
    const uploadUrl = await this.storage.getPresignedUploadUrl(key, 'image/jpeg');
    return { uploadUrl, key };
  }
}
