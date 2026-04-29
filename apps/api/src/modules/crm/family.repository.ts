import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface FamilyMemberRow {
  id: string;
  shop_id: string;
  customer_id: string;
  related_customer_id: string;
  relationship: string;
  created_by_user_id: string;
  created_at: Date;
}

export interface FamilyMemberWithCustomerRow extends FamilyMemberRow {
  related_name: string;
  related_phone: string;
}

export interface InsertLinkPairInput {
  customerId: string;
  relatedCustomerId: string;
  relationship: string;
  reverseRelationship: string;
  createdByUserId: string;
}

export interface DeleteLinkPairInput {
  customerId: string;
  relatedCustomerId: string;
}

@Injectable()
export class FamilyRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async insertLinkPair(input: InsertLinkPairInput): Promise<FamilyMemberRow> {
    return withTenantTx(this.pool, async (tx) => {
      const shop = `current_setting('app.current_shop_id')::uuid`;
      const r = await tx.query<FamilyMemberRow>(
        `INSERT INTO family_members (shop_id, customer_id, related_customer_id, relationship, created_by_user_id)
         VALUES (${shop}, $1, $2, $3, $4) RETURNING *`,
        [input.customerId, input.relatedCustomerId, input.relationship, input.createdByUserId],
      );
      await tx.query(
        `INSERT INTO family_members (shop_id, customer_id, related_customer_id, relationship, created_by_user_id)
         VALUES (${shop}, $1, $2, $3, $4)`,
        [input.relatedCustomerId, input.customerId, input.reverseRelationship, input.createdByUserId],
      );
      return r.rows[0];
    });
  }

  async deleteLinkPair(input: DeleteLinkPairInput): Promise<void> {
    await withTenantTx(this.pool, async (tx) => {
      await tx.query(
        `DELETE FROM family_members
         WHERE shop_id = current_setting('app.current_shop_id')::uuid
           AND ((customer_id = $1 AND related_customer_id = $2)
             OR (customer_id = $2 AND related_customer_id = $1))`,
        [input.customerId, input.relatedCustomerId],
      );
    });
  }


  // Single-TX lookup + delete: prevents TOCTOU between ownership check and deletion.
  async unlinkByIdAtomic(id: string): Promise<FamilyMemberRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const shop = `current_setting('app.current_shop_id')::uuid`;
      const lookup = await tx.query<FamilyMemberRow>(
        `SELECT * FROM family_members WHERE id = $1 AND shop_id = ${shop}`,
        [id],
      );
      const link = lookup.rows[0] ?? null;
      if (!link) return null;
      await tx.query(
        `DELETE FROM family_members
         WHERE shop_id = ${shop}
           AND ((customer_id = $1 AND related_customer_id = $2)
             OR (customer_id = $2 AND related_customer_id = $1))`,
        [link.customer_id, link.related_customer_id],
      );
      return link;
    });
  }

  async getLinkById(id: string): Promise<FamilyMemberRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<FamilyMemberRow>(
        `SELECT * FROM family_members WHERE id = $1 AND shop_id = current_setting('app.current_shop_id')::uuid`,
        [id],
      );
      return r.rows[0] ?? null;
    });
  }

  async getLinksByCustomer(customerId: string): Promise<FamilyMemberWithCustomerRow[]> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<FamilyMemberWithCustomerRow>(
        `SELECT fm.*, c.name AS related_name, c.phone AS related_phone
         FROM family_members fm
         JOIN customers c ON c.id = fm.related_customer_id
           AND c.shop_id = current_setting('app.current_shop_id')::uuid
         WHERE fm.customer_id = $1
           AND fm.shop_id = current_setting('app.current_shop_id')::uuid
         ORDER BY fm.created_at`,
        [customerId],
      );
      return r.rows;
    });
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal tenant isolation check; shopId is always ctx.shopId from authenticated context
  async customerBelongsToShop(shopId: string, customerId: string): Promise<boolean> {
    const r = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1 AND shop_id = $2) AS exists`,
      [customerId, shopId],
    );
    return r.rows[0]?.exists ?? false;
  }
}
