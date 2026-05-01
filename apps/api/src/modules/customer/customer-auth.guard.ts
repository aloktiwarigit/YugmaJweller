import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { FirebaseAdminProvider } from '../auth/firebase-admin.provider';

export const DEV_MOCK_BEARER_PREFIX = 'DEV-MOCK-';
export const DEV_MOCK_CUSTOMER_ID   = '00000000-0000-4000-8000-000000000999';

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
    const shopId = req.headers['x-tenant-id'] as string | undefined;

    if (!raw) throw new UnauthorizedException({ code: 'customer.auth_missing' });
    const bearer = raw.replace(/^Bearer\s+/i, '');
    if (!shopId) throw new UnauthorizedException({ code: 'customer.tenant_id_missing' });

    // Development mock — only accepted when bearer has the well-known prefix
    if (bearer.startsWith(DEV_MOCK_BEARER_PREFIX)) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new UnauthorizedException({ code: 'customer.dev_mock_not_allowed_in_production' });
      }
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

    const row = await this.pool.query<{ id: string }>(
      `SELECT id FROM customers WHERE phone_e164 = $1 AND shop_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [phoneE164, shopId],
    );
    if (!row.rows[0]) throw new UnauthorizedException({ code: 'customer.not_found' });

    req.customerCtx = { customerId: row.rows[0].id, shopId };
    return true;
  }
}
