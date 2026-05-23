import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { withShopTx } from '@goldsmith/db';
import { FirebaseAdminProvider } from '../auth/firebase-admin.provider';

export const DEV_MOCK_BEARER_PREFIX = 'DEV-MOCK-';
export const DEV_MOCK_CUSTOMER_ID   = '00000000-0000-4000-8000-000000000999';
export const CUSTOMER_SELF_REGISTRATION_ACTOR_ID = '00000000-0000-4000-8000-000000000998';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CustomerContext {
  customerId:     string;
  shopId:         string;
  firebaseUid:    string;
  phoneFromToken: string | null;
}

export function getCustomerCtx(req: Request): CustomerContext {
  const ctx = (req as Request & { customerCtx?: CustomerContext }).customerCtx;
  if (!ctx) throw new UnauthorizedException({ code: 'customer.context_not_set' });
  return ctx;
}

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    @Inject(FirebaseAdminProvider) private readonly firebase: FirebaseAdminProvider,
    @Inject('PG_POOL')             private readonly pool: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { customerCtx?: CustomerContext }>();
    const raw   = req.headers['authorization'];
    const shopId = this.singleHeader(req.headers['x-tenant-id']);

    if (!raw) throw new UnauthorizedException({ code: 'customer.auth_missing' });
    const bearer = raw.replace(/^Bearer\s+/i, '');
    if (!shopId) throw new UnauthorizedException({ code: 'customer.tenant_id_missing' });
    if (!UUID_SHAPE.test(shopId)) {
      throw new UnauthorizedException({ code: 'customer.tenant_id_invalid' });
    }

    // Development mock — only accepted when bearer has the well-known prefix AND
    // the runtime is explicitly a development/test environment. Allowlist (not
    // blocklist) so that staging, unset NODE_ENV, or any typo (e.g. "Production")
    // fails closed rather than open.
    if (bearer.startsWith(DEV_MOCK_BEARER_PREFIX)) {
      const nodeEnv = process.env['NODE_ENV'];
      const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';
      if (!isDevOrTest) {
        throw new UnauthorizedException({ code: 'customer.dev_mock_not_allowed' });
      }
      await this.assertActiveShop(shopId);
      req.customerCtx = {
        customerId:     DEV_MOCK_CUSTOMER_ID,
        shopId,
        firebaseUid:    'dev-mock-firebase-uid',
        phoneFromToken: '+919999999999',
      };
      return true;
    }

    // Real Firebase ID token path — no longer requires phone_number claim (OAuth support)
    let firebaseUid: string;
    let phoneFromToken: string | null;
    try {
      const decoded = await this.firebase.admin().auth().verifyIdToken(bearer, false);
      firebaseUid    = decoded.uid;
      phoneFromToken = (decoded['phone_number'] ?? decoded['phoneNumber'] ?? null) as string | null;
    } catch {
      throw new UnauthorizedException({ code: 'customer.token_invalid' });
    }

    await this.assertActiveShop(shopId);

    const customerId = await this.resolveCustomer(shopId, firebaseUid, phoneFromToken);
    req.customerCtx = { customerId, shopId, firebaseUid, phoneFromToken };
    return true;
  }

  private singleHeader(value: string | string[] | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- guard boundary validates x-tenant-id before customer context is set
  private async assertActiveShop(shopId: string): Promise<void> {
    const row = await this.pool.query<{ status: string }>(
      `SELECT status FROM shops WHERE id = $1 LIMIT 1`,
      [shopId],
    );
    const shop = row.rows[0];
    if (!shop) throw new UnauthorizedException({ code: 'customer.shop_not_found' });
    if (shop.status !== 'ACTIVE') throw new ServiceUnavailableException({ code: 'tenant.inactive' });
  }

  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- guard boundary validates x-tenant-id before creating customer context
  private async resolveCustomer(
    shopId:         string,
    firebaseUid:    string,
    phoneFromToken: string | null,
  ): Promise<string> {
    return withShopTx(this.pool, shopId, async (tx) => {
      // Primary lookup: by firebase_uid (all new customers + lazy-migrated existing ones)
      const byUid = await tx.query<{ id: string }>(
        `SELECT id FROM customers
         WHERE shop_id = $1 AND firebase_uid = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [shopId, firebaseUid],
      );
      if (byUid.rows[0]) return byUid.rows[0].id;

      // Lazy migration: existing phone-OTP customer with firebase_uid = NULL
      if (phoneFromToken) {
        const byPhone = await tx.query<{ id: string }>(
          `SELECT id FROM customers
           WHERE shop_id = $1 AND phone = $2 AND firebase_uid IS NULL AND deleted_at IS NULL
           LIMIT 1
           FOR UPDATE`,
          [shopId, phoneFromToken],
        );
        if (byPhone.rows[0]) {
          const updated = await tx.query<{ id: string }>(
            `UPDATE customers SET firebase_uid = $1
             WHERE id = $2
             RETURNING id`,
            [firebaseUid, byPhone.rows[0].id],
          );
          if (updated.rows[0]) return updated.rows[0].id;
        }
      }

      // Not found: OAuth user must call /auth/session first to provision record
      throw new UnauthorizedException({ code: 'customer.not_provisioned' });
    });
  }
}
