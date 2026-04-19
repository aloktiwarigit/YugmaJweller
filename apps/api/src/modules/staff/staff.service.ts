import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { StaffRepository } from './staff.repository';
import type { InviteStaffDto, InviteRole } from './dto/invite-staff.dto';
import type { InviteResponseDto, StaffListItemDto } from './dto/staff-list-item.dto';

@Injectable()
export class StaffService {
  constructor(
    @Inject(StaffRepository) private readonly repo: StaffRepository,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async invite(dto: InviteStaffDto, ctx: AuthenticatedTenantContext): Promise<InviteResponseDto> {
    if (ctx.role !== 'shop_admin') {
      throw new ForbiddenException({ code: 'auth.forbidden' });
    }

    const row = await tenantContext.runWith(ctx, () =>
      this.repo.insertInvited({
        phone: dto.phone,
        displayName: dto.display_name,
        role: dto.role,
        invitedByUserId: ctx.userId,
      }),
    );

    await tenantContext.runWith(ctx, () =>
      auditLog(this.pool, {
        action: AuditAction.STAFF_INVITED,
        subjectType: 'shop_user',
        subjectId: row.id,
        actorUserId: ctx.userId,
        before: null,
        after: { role: row.role, status: row.status, display_name: row.display_name },
      }),
    );

    return {
      staff: {
        id: row.id,
        phone: row.phone,
        display_name: row.display_name,
        role: row.role as InviteRole,
        status: 'INVITED',
        invited_at: row.invited_at,
      },
      share: {
        text: buildShareText(ctx.tenant.display_name, row.display_name, row.role as InviteRole),
      },
    };
  }

  async list(ctx: AuthenticatedTenantContext): Promise<{ staff: StaffListItemDto[] }> {
    const staff = await tenantContext.runWith(ctx, () => this.repo.findAllByShop());
    return { staff };
  }
}

function buildShareText(tenantName: string, staffName: string, role: InviteRole): string {
  const roleLabel = role === 'shop_manager' ? 'Manager' : 'Staff';
  return `${tenantName} में ${staffName} को ${roleLabel} के रूप में आमंत्रित किया गया है। Shopkeeper app download करें।`;
}
