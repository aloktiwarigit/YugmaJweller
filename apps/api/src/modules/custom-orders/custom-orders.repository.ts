import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface CustomOrderRow {
  id:                      string;
  shop_id:                 string;
  customer_id:             string | null;
  description:             string;
  design_reference_url:    string | null;
  quoted_amount_paise:     bigint | null;
  deposit_amount_paise:    bigint;
  deposit_paid_paise:      bigint;
  razorpay_order_id:       string | null;
  razorpay_payment_id:     string | null;
  status:                  string;
  estimated_delivery_date: string | null;
  created_at:              Date;
}

export interface CustomOrderMilestoneRow {
  id:              string;
  custom_order_id: string;
  shop_id:         string;
  title:           string;
  note:            string | null;
  photo_url:       string | null;
  created_at:      Date;
}

const ORDER_COLS = `
  id, shop_id, customer_id, description, design_reference_url,
  quoted_amount_paise, deposit_amount_paise, deposit_paid_paise,
  razorpay_order_id, razorpay_payment_id,
  status, estimated_delivery_date, created_at
`;

const MILESTONE_COLS = `
  id, custom_order_id, shop_id, title, note, photo_url, created_at
`;

@Injectable()
export class CustomOrdersRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async insert(input: {
    shopId: string;
    customerId: string | null;
    description: string;
    designReferenceUrl: string | null;
    quotedAmountPaise: bigint | null;
    estimatedDeliveryDate: string | null;
  }): Promise<CustomOrderRow> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<CustomOrderRow>(
        `INSERT INTO custom_orders
           (shop_id, customer_id, description, design_reference_url,
            quoted_amount_paise, estimated_delivery_date)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5)
         RETURNING ${ORDER_COLS}`,
        [
          input.customerId,
          input.description,
          input.designReferenceUrl,
          input.quotedAmountPaise,
          input.estimatedDeliveryDate,
        ],
      );
      return r.rows[0]!;
    });
  }

  async findById(orderId: string): Promise<CustomOrderRow | undefined> {
    const r = await this.pool.query<CustomOrderRow>(
      `SELECT ${ORDER_COLS} FROM custom_orders
       WHERE id = $1
         AND shop_id = current_setting('app.current_shop_id', true)::uuid`,
      [orderId],
    );
    return r.rows[0];
  }

  async list(params: { limit: number; offset: number }): Promise<{ rows: CustomOrderRow[]; total: number }> {
    const data = await this.pool.query<CustomOrderRow>(
      `SELECT ${ORDER_COLS} FROM custom_orders
       WHERE shop_id = current_setting('app.current_shop_id', true)::uuid
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [params.limit, params.offset],
    );
    const cnt = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM custom_orders
       WHERE shop_id = current_setting('app.current_shop_id', true)::uuid`,
    );
    return { rows: data.rows, total: parseInt(cnt.rows[0]?.count ?? '0', 10) };
  }

  async updateDepositOrder(
    orderId: string,
    patch: {
      depositAmountPaise: bigint;
      razorpayOrderId: string | null;
      status: string;
    },
  ): Promise<CustomOrderRow> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<CustomOrderRow>(
        `UPDATE custom_orders
         SET deposit_amount_paise = $2,
             razorpay_order_id    = $3,
             status               = $4
         WHERE id = $1
           AND shop_id = current_setting('app.current_shop_id')::uuid
         RETURNING ${ORDER_COLS}`,
        [orderId, patch.depositAmountPaise, patch.razorpayOrderId, patch.status],
      );
      return r.rows[0]!;
    });
  }

  async recordDepositPaid(
    orderId: string,
    paidPaise: bigint,
    razorpayPaymentId: string | null,
  ): Promise<CustomOrderRow> {
    return withTenantTx(this.pool, async (tx) => {
      // Lock row to prevent concurrent double-payment
      const lockRes = await tx.query<CustomOrderRow>(
        `SELECT ${ORDER_COLS} FROM custom_orders
         WHERE id = $1
           AND shop_id = current_setting('app.current_shop_id')::uuid
         FOR UPDATE`,
        [orderId],
      );
      const order = lockRes.rows[0];
      if (!order) throw new Error('custom_order.not_found');

      const newPaid  = order.deposit_paid_paise + paidPaise;
      const required = order.deposit_amount_paise;
      const newStatus = newPaid >= required ? 'IN_PROGRESS' : order.status;

      const r = await tx.query<CustomOrderRow>(
        `UPDATE custom_orders
         SET deposit_paid_paise   = $2,
             razorpay_payment_id  = COALESCE($3, razorpay_payment_id),
             status               = $4
         WHERE id = $1
           AND shop_id = current_setting('app.current_shop_id')::uuid
         RETURNING ${ORDER_COLS}`,
        [orderId, newPaid, razorpayPaymentId, newStatus],
      );
      return r.rows[0]!;
    });
  }

  async updateStatus(orderId: string, status: string): Promise<CustomOrderRow> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<CustomOrderRow>(
        `UPDATE custom_orders
         SET status = $2
         WHERE id = $1
           AND shop_id = current_setting('app.current_shop_id')::uuid
         RETURNING ${ORDER_COLS}`,
        [orderId, status],
      );
      return r.rows[0]!;
    });
  }

  async insertMilestone(input: {
    customOrderId: string;
    title: string;
    note: string | null;
    photoUrl: string | null;
  }): Promise<CustomOrderMilestoneRow> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<CustomOrderMilestoneRow>(
        `INSERT INTO custom_order_milestones
           (custom_order_id, shop_id, title, note, photo_url)
         VALUES ($1, current_setting('app.current_shop_id')::uuid, $2, $3, $4)
         RETURNING ${MILESTONE_COLS}`,
        [input.customOrderId, input.title, input.note, input.photoUrl],
      );
      return r.rows[0]!;
    });
  }

  async listMilestones(orderId: string): Promise<CustomOrderMilestoneRow[]> {
    const r = await this.pool.query<CustomOrderMilestoneRow>(
      `SELECT ${MILESTONE_COLS} FROM custom_order_milestones
       WHERE custom_order_id = $1
         AND shop_id = current_setting('app.current_shop_id', true)::uuid
       ORDER BY created_at ASC`,
      [orderId],
    );
    return r.rows;
  }
}
