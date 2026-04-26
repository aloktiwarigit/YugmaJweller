import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface CustomerRow {
  id: string; shop_id: string; phone: string; name: string; email: string | null;
  address_line1: string | null; address_line2: string | null; city: string | null;
  state: string | null; pincode: string | null; dob_year: number | null;
  pan_ciphertext: Buffer | null; pan_key_id: string | null; notes: string | null;
  viewing_consent: boolean; created_by_user_id: string; created_at: Date; updated_at: Date;
}

export interface InsertCustomerInput {
  phone: string; name: string; email: string | null; addressLine1: string | null;
  addressLine2: string | null; city: string | null; state: string | null; pincode: string | null;
  dobYear: number | null; panCiphertext: Buffer | null; panKeyId: string | null;
  notes: string | null; viewingConsent: boolean; createdByUserId: string;
}

export interface UpdateCustomerInput {
  name?: string; email?: string | null; addressLine1?: string | null; addressLine2?: string | null;
  city?: string | null; state?: string | null; pincode?: string | null; dobYear?: number | null;
  panCiphertext?: Buffer | null; panKeyId?: string | null; notes?: string | null;
}

export interface ListCustomersResult { rows: CustomerRow[]; total: number; }

@Injectable()
export class CrmRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async insertCustomer(input: InsertCustomerInput): Promise<CustomerRow> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<CustomerRow>(
        `INSERT INTO customers (shop_id, phone, name, email, address_line1, address_line2, city, state, pincode, dob_year, pan_ciphertext, pan_key_id, notes, viewing_consent, created_by_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [input.phone, input.name, input.email, input.addressLine1, input.addressLine2, input.city, input.state, input.pincode, input.dobYear, input.panCiphertext, input.panKeyId, input.notes, input.viewingConsent, input.createdByUserId],
      );
      return r.rows[0];
    });
  }

  async listCustomers(q: string | undefined, limit: number, offset: number): Promise<ListCustomersResult> {
    return withTenantTx(this.pool, async (tx) => {
      const filter = q ? `AND (name ILIKE $3 OR phone ILIKE $3)` : '';
      const params: unknown[] = [limit, offset];
      if (q) params.push(`%${q}%`);
      const dataQ = await tx.query<CustomerRow>(`SELECT * FROM customers WHERE shop_id = current_setting('app.current_shop_id')::uuid ${filter} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params);
      const countQ = await tx.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM customers WHERE shop_id = current_setting('app.current_shop_id')::uuid ${filter}`, q ? [`%${q}%`] : []);
      return { rows: dataQ.rows, total: parseInt(countQ.rows[0].total, 10) };
    });
  }

  async getCustomerById(id: string): Promise<CustomerRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<CustomerRow>(`SELECT * FROM customers WHERE id = $1 AND shop_id = current_setting('app.current_shop_id')::uuid`, [id]);
      return r.rows[0] ?? null;
    });
  }

  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      const add = (col: string, val: unknown): void => { sets.push(`${col} = $${i++}`); params.push(val); };
      if (input.name !== undefined) add('name', input.name);
      if (input.email !== undefined) add('email', input.email);
      if (input.addressLine1 !== undefined) add('address_line1', input.addressLine1);
      if (input.addressLine2 !== undefined) add('address_line2', input.addressLine2);
      if (input.city !== undefined) add('city', input.city);
      if (input.state !== undefined) add('state', input.state);
      if (input.pincode !== undefined) add('pincode', input.pincode);
      if (input.dobYear !== undefined) add('dob_year', input.dobYear);
      if (input.panCiphertext !== undefined) add('pan_ciphertext', input.panCiphertext);
      if (input.panKeyId !== undefined) add('pan_key_id', input.panKeyId);
      if (input.notes !== undefined) add('notes', input.notes);
      if (sets.length === 0) return this.getCustomerById(id);
      sets.push(`updated_at = now()`); params.push(id);
      const r = await tx.query<CustomerRow>(`UPDATE customers SET ${sets.join(', ')} WHERE id = $${i} AND shop_id = current_setting('app.current_shop_id')::uuid RETURNING *`, params);
      return r.rows[0] ?? null;
    });
  }
}