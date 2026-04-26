import { Injectable, Inject, ConflictException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Pool } from 'pg';
import { validatePanFormat, normalizePan } from '@goldsmith/compliance';
import { encryptColumn, serializeEnvelope } from '@goldsmith/crypto-envelope';
import type { KmsAdapter } from '@goldsmith/crypto-envelope';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { CreateCustomerDto, UpdateCustomerDto, CustomerResponse } from '@goldsmith/shared';
import { CrmRepository } from './crm.repository';
import type { CustomerRow } from './crm.repository';

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s-]/g, '');
  if (/^\+91[6-9]\d{9}$/.test(stripped)) return stripped;
  if (/^[6-9]\d{9}$/.test(stripped)) return `+91${stripped}`;
  throw new BadRequestException({ code: 'crm.invalid_phone', message: 'Valid Indian mobile required' });
}

function rowToResponse(row: CustomerRow): CustomerResponse {
  return {
    id: row.id, phone: row.phone, name: row.name, email: row.email,
    addressLine1: row.address_line1, addressLine2: row.address_line2,
    city: row.city, state: row.state, pincode: row.pincode,
    dobYear: row.dob_year, hasPan: row.pan_ciphertext !== null,
    notes: row.notes, viewingConsent: row.viewing_consent,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class CrmService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject('KMS_ADAPTER') private readonly kms: KmsAdapter,
    private readonly repo: CrmRepository,
  ) {}

  async createCustomer(ctx: AuthenticatedTenantContext, dto: CreateCustomerDto): Promise<CustomerResponse> {
    const phone = normalizePhone(dto.phone);
    let panCiphertext: Buffer | null = null;
    let panKeyId: string | null = null;
    if (dto.pan) {
      const normalizedPan = normalizePan(dto.pan);
      if (!validatePanFormat(normalizedPan)) throw new BadRequestException({ code: 'crm.invalid_pan', message: 'Invalid PAN format' });
      const keyArn = await this.getShopKekArn(ctx.shopId);
      const env = await encryptColumn(this.kms, keyArn, normalizedPan);
      panCiphertext = serializeEnvelope(env); panKeyId = keyArn;
    }
    let row: CustomerRow;
    try {
      row = await this.repo.insertCustomer({
        phone, name: dto.name, email: dto.email ?? null, addressLine1: dto.addressLine1 ?? null,
        addressLine2: dto.addressLine2 ?? null, city: dto.city ?? null, state: dto.state ?? null,
        pincode: dto.pincode ?? null, dobYear: dto.dobYear ?? null, panCiphertext, panKeyId,
        notes: dto.notes ?? null, viewingConsent: false, createdByUserId: ctx.userId,
      });
    } catch (err: unknown) {
      if (this.isPgUniqueViolation(err)) throw new ConflictException({ code: 'crm.phone_exists', message: 'Customer with this phone exists — open their profile?' });
      throw err;
    }
    void auditLog(this.pool, {
      action: AuditAction.CRM_CUSTOMER_CREATED, subjectType: 'customer', subjectId: row.id, actorUserId: ctx.userId,
      after: { phone, name: dto.name, pan_captured: panCiphertext !== null ? 'PAN_REDACTED' : null, pan_key_id: panKeyId ?? undefined },
    }).catch(() => undefined);
    return rowToResponse(row);
  }

  async listCustomers(_ctx: AuthenticatedTenantContext, q: string | undefined, limit: number, offset: number): Promise<{ customers: CustomerResponse[]; total: number }> {
    const result = await this.repo.listCustomers(q, limit, offset);
    return { customers: result.rows.map(rowToResponse), total: result.total };
  }

  async getCustomer(_ctx: AuthenticatedTenantContext, id: string): Promise<CustomerResponse> {
    const row = await this.repo.getCustomerById(id);
    if (!row) throw new NotFoundException({ code: 'crm.customer_not_found' });
    return rowToResponse(row);
  }

  async updateCustomer(ctx: AuthenticatedTenantContext, id: string, dto: UpdateCustomerDto): Promise<CustomerResponse> {
    if (ctx.role === 'shop_staff') throw new ForbiddenException({ code: 'crm.staff_cannot_edit', message: 'Staff cannot edit customer records' });
    let panCiphertext: Buffer | undefined;
    let panKeyId: string | undefined;
    if (dto.pan) {
      const normalizedPan = normalizePan(dto.pan);
      if (!validatePanFormat(normalizedPan)) throw new BadRequestException({ code: 'crm.invalid_pan', message: 'Invalid PAN format' });
      const keyArn = await this.getShopKekArn(ctx.shopId);
      const env = await encryptColumn(this.kms, keyArn, normalizedPan);
      panCiphertext = serializeEnvelope(env); panKeyId = keyArn;
    }
    const row = await this.repo.updateCustomer(id, {
      name: dto.name, email: dto.email ?? undefined, addressLine1: dto.addressLine1 ?? undefined,
      addressLine2: dto.addressLine2 ?? undefined, city: dto.city ?? undefined, state: dto.state ?? undefined,
      pincode: dto.pincode ?? undefined, dobYear: dto.dobYear ?? undefined, panCiphertext, panKeyId, notes: dto.notes ?? undefined,
    });
    if (!row) throw new NotFoundException({ code: 'crm.customer_not_found' });
    void auditLog(this.pool, {
      action: AuditAction.CRM_CUSTOMER_UPDATED, subjectType: 'customer', subjectId: id, actorUserId: ctx.userId,
      after: { fieldsUpdated: Object.keys(dto).filter(k => k !== 'pan'), panUpdated: 'pan' in dto },
    }).catch(() => undefined);
    return rowToResponse(row);
  }

  private isPgUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505';
  }

  private async getShopKekArn(shopUuid: string): Promise<string> {
    const r = await this.pool.query<{ kek_key_arn: string | null }>(`SELECT kek_key_arn FROM shops WHERE id = $1`, [shopUuid]);
    const arn = r.rows[0]?.kek_key_arn;
    if (!arn) {
      throw new Error(
        `KMS key ARN not configured for shop ${shopUuid}. ` +
        `Cannot encrypt PAN — set kek_key_arn on the shop record.`
      );
    }
    return arn;
  }
}