import {
  Controller, Post, Patch, Req, Inject,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { FirebaseAdminProvider } from '../auth/firebase-admin.provider';
import { CustomerAuthGuard, getCustomerCtx } from './customer-auth.guard';
import { CustomerSessionService } from './customer-session.service';
import { AuditAction } from '@goldsmith/audit';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/v1/customer')
export class CustomerSessionController {
  constructor(
    @Inject(FirebaseAdminProvider) private readonly firebase: FirebaseAdminProvider,
    @Inject('PG_POOL')             private readonly pool: Pool,
    @Inject(CustomerSessionService) private readonly sessionService: CustomerSessionService,
  ) {}

  @SkipAuth()
  @SkipTenant()
  @Post('auth/session')
  async createSession(@Req() req: Request): Promise<{
    customer: { id: string; name: string; phoneE164: string | null; email: string | null };
    isNewUser: boolean;
    authProvider: 'phone' | 'google' | 'email_password';
  }> {
    const raw    = req.headers['authorization'];
    const shopId = typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'] : undefined;

    if (!raw) throw new UnauthorizedException({ code: 'customer.auth_missing' });
    if (!shopId) throw new UnauthorizedException({ code: 'customer.tenant_id_missing' });
    if (!UUID_SHAPE.test(shopId)) throw new UnauthorizedException({ code: 'customer.tenant_id_invalid' });

    const bearer = raw.replace(/^Bearer\s+/i, '');

    let decoded: { uid: string; phone_number?: string; email?: string; email_verified?: boolean; name?: string };
    try {
      decoded = await this.firebase.admin().auth().verifyIdToken(bearer, true);
    } catch {
      await this.pool.query(
        `INSERT INTO audit_events (shop_id, action, subject_type, metadata)
         VALUES ($1, $2, 'customer', $3::jsonb)
         ON CONFLICT DO NOTHING`,
        [shopId, AuditAction.CUSTOMER_AUTH_FAILED, JSON.stringify({ reason: 'token_invalid' })],
      ).catch(() => { /* fire-and-forget */ });
      throw new UnauthorizedException({ code: 'customer.token_invalid' });
    }

    const result = await this.sessionService.findOrCreateCustomerByFirebaseToken(
      this.pool, shopId, decoded,
    );

    return {
      customer: {
        id:        result.customerId,
        name:      result.name,
        phoneE164: result.phoneE164,
        email:     result.email,
      },
      isNewUser:    result.isNewUser,
      authProvider: result.authProvider,
    };
  }

  @Patch('profile/phone')
  @UseGuards(CustomerAuthGuard)
  async addPhone(@Req() req: Request): Promise<{ ok: true }> {
    const { customerId, shopId, phoneFromToken } = getCustomerCtx(req);
    if (!phoneFromToken) {
      throw new UnauthorizedException({ code: 'customer.no_phone_in_token' });
    }
    await this.pool.query(
      `UPDATE customers SET phone = $1 WHERE id = $2 AND shop_id = $3 AND deleted_at IS NULL`,
      [phoneFromToken, customerId, shopId],
    );
    return { ok: true };
  }
}
