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
import { FirebaseAdminProvider } from '../auth/firebase-admin.provider';

export const DEV_MOCK_BEARER_PREFIX = 'DEV-MOCK-';
export const DEV_MOCK_CUSTOMER_ID   = '00000000-0000-4000-8000-000000000999';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CustomerContext {
  customerId: string;
  shopId:     string;
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
      req.customerCtx = { customerId: DEV_MOCK_CUSTOMER_ID, shopId };
      return true;
    }

    // Real Firebase ID token path
    let phoneE164: string;
    try {
      const decoded = await this.firebase.admin().auth().verifyIdToken(bearer, true);
      const phone = (decoded['phone_number'] ?? decoded['phoneNumber']) as string | undefined;
      if (!phone) throw new UnauthorizedException({ code: 'customer.phone_not_in_token' });
      phoneE164 = phone;
    } catch (err) {
      if ((err as { code?: string })?.code === 'customer.phone_not_in_token') throw err;
      throw new UnauthorizedException({ code: 'customer.token_invalid' });
    }

    await this.assertActiveShop(shopId);

    // customers.phone stores E.164 format (same format Firebase phone_number claim uses)
    const row = await this.pool.query<{ id: string }>(
      `SELECT id FROM customers WHERE phone = $1 AND shop_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [phoneE164, shopId],
    );
    if (!row.rows[0]) throw new UnauthorizedException({ code: 'customer.not_found' });

    req.customerCtx = { customerId: row.rows[0].id, shopId };
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
}
