import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface ViewingConsentRow {
  id: string;
  shop_id: string;
  customer_id: string;
  consent_given: boolean;
  consent_version: string;
  consented_at: Date | null;
  withdrawn_at: Date | null;
  ip_at_consent: string | null;
  user_agent_at_consent: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertConsentInput {
  customerId: string;
  consentGiven: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

export interface UpsertConsentResult {
  before: ViewingConsentRow | null;
  after: ViewingConsentRow;
}

@Injectable()
export class ConsentRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getByCustomer(customerId: string): Promise<ViewingConsentRow | null> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ViewingConsentRow>(
        `SELECT * FROM viewing_consent
         WHERE customer_id = $1
           AND shop_id = current_setting('app.current_shop_id')::uuid`,
        [customerId],
      );
      return r.rows[0] ?? null;
    });
  }

  // Atomic upsert. Sets consented_at on grant, withdrawn_at on withdraw,
  // both relative to the new row's state. Returns prior row (for audit `before`)
  // and resulting row.
  async upsertConsent(input: UpsertConsentInput): Promise<UpsertConsentResult> {
    return withTenantTx(this.pool, async (tx) => {
      const shop = `current_setting('app.current_shop_id')::uuid`;

      const prior = await tx.query<ViewingConsentRow>(
        `SELECT * FROM viewing_consent
         WHERE customer_id = $1 AND shop_id = ${shop}
         FOR UPDATE`,
        [input.customerId],
      );
      const before = prior.rows[0] ?? null;

      const consentedAt = input.consentGiven ? 'now()' : 'NULL';
      const withdrawnAt = input.consentGiven ? 'NULL' : 'now()';

      // Insert-or-update on (shop_id, customer_id) — preserves consent_version.
      // On grant: stamp consented_at, clear withdrawn_at.
      // On withdraw: stamp withdrawn_at, clear consented_at.
      const r = await tx.query<ViewingConsentRow>(
        `INSERT INTO viewing_consent
           (shop_id, customer_id, consent_given, consented_at, withdrawn_at, ip_at_consent, user_agent_at_consent)
         VALUES (${shop}, $1, $2, ${consentedAt}, ${withdrawnAt}, $3, $4)
         ON CONFLICT (shop_id, customer_id) DO UPDATE SET
           consent_given         = EXCLUDED.consent_given,
           consented_at          = EXCLUDED.consented_at,
           withdrawn_at          = EXCLUDED.withdrawn_at,
           ip_at_consent         = EXCLUDED.ip_at_consent,
           user_agent_at_consent = EXCLUDED.user_agent_at_consent,
           updated_at            = now()
         RETURNING *`,
        [input.customerId, input.consentGiven, input.ip ?? null, input.userAgent ?? null],
      );
      // Keep customers.viewing_consent boolean in sync so existing customer APIs
      // (GET /customers/:id) reflect the current consent state immediately.
      await tx.query(
        `UPDATE customers SET viewing_consent = $1 WHERE id = $2 AND shop_id = ${shop}`,
        [input.consentGiven, input.customerId],
      );
      return { before, after: r.rows[0]! };
    });
  }

  async customerExists(customerId: string): Promise<boolean> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM customers
           WHERE id = $1
             AND shop_id = current_setting('app.current_shop_id')::uuid
             AND deleted_at IS NULL
         ) AS exists`,
        [customerId],
      );
      return r.rows[0]?.exists ?? false;
    });
  }
}
