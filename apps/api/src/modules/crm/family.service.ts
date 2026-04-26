import { Injectable, Inject, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { FamilyRepository } from './family.repository';
import type { FamilyMemberRow, FamilyMemberWithCustomerRow } from './family.repository';

const REVERSE: Record<string, string> = {
  SPOUSE: 'SPOUSE',
  PARENT: 'CHILD',
  CHILD: 'PARENT',
  SIBLING: 'SIBLING',
  IN_LAW: 'IN_LAW',
  OTHER: 'OTHER',
};

export interface FamilyMemberResponse {
  id: string;
  customerId: string;
  relatedCustomerId: string;
  relationship: string;
  relatedName: string;
  relatedPhone: string;
  createdAt: string;
}

export interface LinkFamilyDto {
  customerId: string;
  relatedCustomerId: string;
  relationship: string;
}

@Injectable()
export class FamilyService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly repo: FamilyRepository,
  ) {}

  async linkFamily(ctx: AuthenticatedTenantContext, dto: LinkFamilyDto): Promise<FamilyMemberResponse> {
    if (dto.customerId === dto.relatedCustomerId) {
      throw new BadRequestException({ code: 'crm.family_self_link', message: 'Cannot link a customer to themselves' });
    }

    const [aOk, bOk] = await Promise.all([
      this.repo.customerBelongsToShop(ctx.shopId, dto.customerId),
      this.repo.customerBelongsToShop(ctx.shopId, dto.relatedCustomerId),
    ]);
    if (!aOk || !bOk) {
      throw new NotFoundException({ code: 'crm.customer_not_found', message: 'One or both customers not found' });
    }

    let row: FamilyMemberRow;
    try {
      row = await this.repo.insertLinkPair({
        customerId: dto.customerId,
        relatedCustomerId: dto.relatedCustomerId,
        relationship: dto.relationship,
        reverseRelationship: REVERSE[dto.relationship] ?? 'OTHER',
        createdByUserId: ctx.userId,
      });
    } catch (err: unknown) {
      if (this.isPgUniqueViolation(err)) {
        throw new ConflictException({ code: 'crm.family_link_exists', message: 'Family link already exists' });
      }
      throw err;
    }

    void auditLog(this.pool, {
      action: AuditAction.CRM_FAMILY_LINK_ADDED,
      subjectType: 'family_member',
      subjectId: row.id,
      actorUserId: ctx.userId,
      after: { customerId: dto.customerId, relatedCustomerId: dto.relatedCustomerId, relationship: dto.relationship },
    }).catch(() => undefined);

    return this.rowToResponse(row as FamilyMemberWithCustomerRow & { related_name?: string; related_phone?: string });
  }

  async unlinkFamily(ctx: AuthenticatedTenantContext, linkId: string): Promise<void> {
    const link = await this.repo.unlinkByIdAtomic(linkId);
    if (!link) {
      throw new NotFoundException({ code: 'crm.family_link_not_found', message: 'Family link not found' });
    }

    void auditLog(this.pool, {
      action: AuditAction.CRM_FAMILY_LINK_REMOVED,
      subjectType: 'family_member',
      subjectId: linkId,
      actorUserId: ctx.userId,
      after: { customerId: link.customer_id, relatedCustomerId: link.related_customer_id },
    }).catch(() => undefined);
  }

  async getFamilyLinks(ctx: AuthenticatedTenantContext, customerId: string): Promise<FamilyMemberResponse[]> {
    const ok = await this.repo.customerBelongsToShop(ctx.shopId, customerId);
    if (!ok) throw new NotFoundException({ code: 'crm.customer_not_found', message: 'Customer not found' });
    const rows = await this.repo.getLinksByCustomer(customerId);
    return rows.map((r) => this.rowToResponse(r));
  }

  private rowToResponse(row: FamilyMemberRow & { related_name?: string; related_phone?: string }): FamilyMemberResponse {
    return {
      id: row.id,
      customerId: row.customer_id,
      relatedCustomerId: row.related_customer_id,
      relationship: row.relationship,
      relatedName: row.related_name ?? '',
      relatedPhone: row.related_phone ?? '',
      createdAt: row.created_at.toISOString(),
    };
  }

  private isPgUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505';
  }
}
