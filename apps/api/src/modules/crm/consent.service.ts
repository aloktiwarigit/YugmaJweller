import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { ViewingConsentResponse, UpdateViewingConsentDto } from '@goldsmith/shared';
import { ConsentRepository } from './consent.repository';
import type { ViewingConsentRow } from './consent.repository';

const DEFAULT_CONSENT_VERSION = 'v1';

@Injectable()
export class ConsentService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly repo: ConsentRepository,
  ) {}

  async getConsent(_ctx: AuthenticatedTenantContext, customerId: string): Promise<ViewingConsentResponse> {
    const ok = await this.repo.customerExists(customerId);
    if (!ok) throw new NotFoundException({ code: 'crm.customer_not_found', message: 'Customer not found' });

    const row = await this.repo.getByCustomer(customerId);
    if (!row) {
      return {
        consentGiven:   false,
        consentVersion: DEFAULT_CONSENT_VERSION,
        consentedAt:    null,
        withdrawnAt:    null,
      };
    }
    return this.rowToResponse(row);
  }

  async updateConsent(
    ctx: AuthenticatedTenantContext,
    customerId: string,
    dto: UpdateViewingConsentDto,
    meta: { ip?: string | null; userAgent?: string | null } = {},
  ): Promise<ViewingConsentResponse> {
    const ok = await this.repo.customerExists(customerId);
    if (!ok) throw new NotFoundException({ code: 'crm.customer_not_found', message: 'Customer not found' });

    const { before, after } = await this.repo.upsertConsent({
      customerId,
      consentGiven: dto.consentGiven,
      ip:        meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    void auditLog(this.pool, {
      action: dto.consentGiven
        ? AuditAction.CRM_VIEWING_CONSENT_GRANTED
        : AuditAction.CRM_VIEWING_CONSENT_WITHDRAWN,
      subjectType: 'customer',
      subjectId:   customerId,
      actorUserId: ctx.userId,
      before: before ? { consentGiven: before.consent_given } : null,
      after:  { consentGiven: after.consent_given, consentVersion: after.consent_version },
      ip:        meta.ip ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    }).catch(() => undefined);

    return this.rowToResponse(after);
  }

  private rowToResponse(row: ViewingConsentRow): ViewingConsentResponse {
    return {
      consentGiven:   row.consent_given,
      consentVersion: row.consent_version,
      consentedAt:    row.consented_at ? row.consented_at.toISOString() : null,
      withdrawnAt:    row.withdrawn_at ? row.withdrawn_at.toISOString() : null,
    };
  }
}
