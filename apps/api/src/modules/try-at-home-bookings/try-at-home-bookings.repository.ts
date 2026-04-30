import { Injectable, Inject } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

export interface TryAtHomeBookingRow {
  id:           string;
  shop_id:      string;
  customer_id:  string;
  product_ids:  string[];
  status:       string;
  requested_at: Date;
  dispatch_at:  Date | null;
  return_due_at: Date | null;
  notes:        string | null;
}

@Injectable()
export class TryAtHomeBookingsRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async insert(params: {
    shopId:     string;
    customerId: string;
    productIds: string[];
    notes?:     string;
  }): Promise<TryAtHomeBookingRow> {
    const { rows } = await this.pool.query<TryAtHomeBookingRow>(
      `INSERT INTO try_at_home_bookings (shop_id, customer_id, product_ids, notes)
       VALUES ($1, $2, $3::uuid[], $4)
       RETURNING *`,
      [params.shopId, params.customerId, params.productIds, params.notes ?? null],
    );
    return rows[0]!;
  }

  async findById(id: string): Promise<TryAtHomeBookingRow | null> {
    const { rows } = await this.pool.query<TryAtHomeBookingRow>(
      `SELECT * FROM try_at_home_bookings WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: { limit: number; offset: number }): Promise<{ rows: TryAtHomeBookingRow[]; total: number }> {
    const [data, count] = await Promise.all([
      this.pool.query<TryAtHomeBookingRow>(
        `SELECT * FROM try_at_home_bookings ORDER BY requested_at DESC LIMIT $1 OFFSET $2`,
        [params.limit, params.offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*) FROM try_at_home_bookings`),
    ]);
    return { rows: data.rows, total: Number(count.rows[0]!.count) };
  }

  async updateStatusDispatch(
    client: PoolClient,
    id: string,
    dispatchAt: Date,
  ): Promise<TryAtHomeBookingRow> {
    const { rows } = await client.query<TryAtHomeBookingRow>(
      `UPDATE try_at_home_bookings
         SET status = 'DISPATCHED', dispatch_at = $2
       WHERE id = $1 AND status = 'REQUESTED'
       RETURNING *`,
      [id, dispatchAt],
    );
    return rows[0]!;
  }

  async updateStatusReturn(
    client: PoolClient,
    id: string,
    remainingProductIds: string[],
    newStatus: 'RETURNED' | 'CONVERTED_TO_SALE',
  ): Promise<TryAtHomeBookingRow> {
    const { rows } = await client.query<TryAtHomeBookingRow>(
      `UPDATE try_at_home_bookings
         SET status = $2, product_ids = $3::uuid[]
       WHERE id = $1 AND status = 'DISPATCHED'
       RETURNING *`,
      [id, newStatus, remainingProductIds],
    );
    return rows[0]!;
  }

  async lockForUpdate(client: PoolClient, id: string): Promise<TryAtHomeBookingRow | null> {
    const { rows } = await client.query<TryAtHomeBookingRow>(
      `SELECT * FROM try_at_home_bookings WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }

  getPool(): Pool {
    return this.pool;
  }
}
