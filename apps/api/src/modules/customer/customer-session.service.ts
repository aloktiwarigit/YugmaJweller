import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withShopTx } from '@goldsmith/db';
import { AuditAction } from '@goldsmith/audit';
import { CUSTOMER_SELF_REGISTRATION_ACTOR_ID } from './customer-auth.guard';

export interface DecodedFirebaseToken {
  uid:           string;
  phone_number?: string;
  email?:        string;
  name?:         string;
}

export interface CustomerSessionResult {
  customerId:   string;
  name:         string;
  phoneE164:    string | null;
  email:        string | null;
  authProvider: 'phone' | 'google' | 'email_password';
  isNewUser:    boolean;
}

@Injectable()
export class CustomerSessionService {
  async findOrCreateCustomerByFirebaseToken(
    pool:    Pool,
    // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- session endpoint validates shopId before calling this
    shopId:  string,
    decoded: DecodedFirebaseToken,
  ): Promise<CustomerSessionResult> {
    return withShopTx(pool, shopId, async (tx) => {
      const { uid, phone_number: phone, email, name } = decoded;

      // Path 1 — existing customer with this firebase_uid
      const byUid = await tx.query<{
        id: string; name: string; phone: string | null; email: string | null; auth_provider: string;
      }>(
        `SELECT id, name, phone, email, auth_provider
         FROM customers
         WHERE shop_id = $1 AND firebase_uid = $2 AND deleted_at IS NULL
         FOR UPDATE`,
        [shopId, uid],
      );
      if (byUid.rows[0]) {
        const r = byUid.rows[0];
        return {
          customerId:   r.id,
          name:         r.name,
          phoneE164:    r.phone,
          email:        r.email,
          authProvider: r.auth_provider as CustomerSessionResult['authProvider'],
          isNewUser:    false,
        };
      }

      // Path 2 — existing phone customer (link firebase_uid)
      if (phone) {
        const byPhone = await tx.query<{ id: string; name: string; email: string | null }>(
          `SELECT id, name, email FROM customers
           WHERE shop_id = $1 AND phone = $2 AND deleted_at IS NULL
           FOR UPDATE`,
          [shopId, phone],
        );
        if (byPhone.rows[0]) {
          const r = byPhone.rows[0];
          await tx.query(
            `UPDATE customers SET firebase_uid = $1, auth_provider = 'phone' WHERE id = $2`,
            [uid, r.id],
          );
          await tx.query(
            `INSERT INTO audit_events (shop_id, action, subject_type, subject_id, metadata)
             VALUES ($1, $2, 'customer', $3, $4::jsonb)`,
            [shopId, AuditAction.CUSTOMER_AUTH_PROVIDER_LINKED, r.id,
             JSON.stringify({ provider: 'phone', firebaseUid: uid })],
          );
          return {
            customerId:   r.id,
            name:         r.name,
            phoneE164:    phone,
            email:        r.email,
            authProvider: 'phone',
            isNewUser:    false,
          };
        }
      }

      // Path 3 — existing email customer (link firebase_uid)
      if (email) {
        const byEmail = await tx.query<{ id: string; name: string; phone: string | null; auth_provider: string }>(
          `SELECT id, name, phone, auth_provider FROM customers
           WHERE shop_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL
           FOR UPDATE`,
          [shopId, email],
        );
        if (byEmail.rows[0]) {
          const r = byEmail.rows[0];
          const provider = r.auth_provider as CustomerSessionResult['authProvider'];
          await tx.query(
            `UPDATE customers SET firebase_uid = $1 WHERE id = $2`,
            [uid, r.id],
          );
          await tx.query(
            `INSERT INTO audit_events (shop_id, action, subject_type, subject_id, metadata)
             VALUES ($1, $2, 'customer', $3, $4::jsonb)`,
            [shopId, AuditAction.CUSTOMER_AUTH_PROVIDER_LINKED, r.id,
             JSON.stringify({ provider, firebaseUid: uid })],
          );
          return {
            customerId:   r.id,
            name:         r.name,
            phoneE164:    r.phone,
            email,
            authProvider: provider,
            isNewUser:    false,
          };
        }
      }

      // Path 4 — new customer
      const authProvider: CustomerSessionResult['authProvider'] =
        phone ? 'phone' : email ? 'email_password' : 'google';
      const displayName = name ?? (email ? email.split('@')[0] : (phone ? `Mobile customer ${phone.slice(-4)}` : 'Customer'));

      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO customers
           (shop_id, phone, email, name, display_name, firebase_uid, auth_provider, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (shop_id, firebase_uid) WHERE firebase_uid IS NOT NULL
         DO NOTHING
         RETURNING id`,
        [shopId, phone ?? null, email ?? null, displayName, displayName, uid, authProvider, CUSTOMER_SELF_REGISTRATION_ACTOR_ID],
      );

      if (!inserted.rows[0]) {
        // Concurrent request raced and won — caller should retry
        throw new UnauthorizedException({ code: 'customer.race_condition' });
      }

      await tx.query(
        `INSERT INTO audit_events (shop_id, action, subject_type, subject_id, metadata)
         VALUES ($1, $2, 'customer', $3, $4::jsonb)`,
        [shopId, AuditAction.CUSTOMER_SESSION_CREATED, inserted.rows[0].id,
         JSON.stringify({ provider: authProvider, isNewUser: true, firebaseUid: uid })],
      );

      return {
        customerId:   inserted.rows[0].id,
        name:         displayName,
        phoneE164:    phone ?? null,
        email:        email ?? null,
        authProvider,
        isNewUser:    true,
      };
    });
  }
}
