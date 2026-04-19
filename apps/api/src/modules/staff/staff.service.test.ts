import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { StaffService } from './staff.service';
import type { StaffRepository } from './staff.repository';

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  AuditAction: { STAFF_INVITED: 'STAFF_INVITED' },
}));

const mockRepo = {
  insertInvited: vi.fn(),
  findAllByShop: vi.fn(),
  refreshInvited: vi.fn(),
} as unknown as StaffRepository;

const POOL = {} as never;

const TENANT = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  slug: 'shop-a',
  display_name: 'Rajesh Jewellers',
  status: 'ACTIVE' as const,
};
const OWNER_CTX = {
  shopId: TENANT.id,
  tenant: TENANT,
  authenticated: true as const,
  userId: 'owner-uuid',
  role: 'shop_admin' as const,
};
const MGMT_CTX = {
  shopId: TENANT.id,
  tenant: TENANT,
  authenticated: true as const,
  userId: 'mgr-uuid',
  role: 'shop_manager' as const,
};

describe('StaffService.invite', () => {
  let svc: StaffService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = new StaffService(mockRepo, POOL);
  });

  it('returns staff row + share text on happy path', async () => {
    const stubRow = {
      id: 'new-uuid',
      phone: '+919876543210',
      display_name: 'Amit',
      role: 'shop_staff' as const,
      status: 'INVITED' as const,
      invited_by_user_id: 'owner-uuid',
      invited_at: new Date().toISOString(),
      activated_at: null,
    };
    vi.mocked(mockRepo.insertInvited).mockResolvedValue(stubRow);

    const result = await svc.invite(
      { phone: '+919876543210', display_name: 'Amit', role: 'shop_staff' },
      OWNER_CTX,
    );

    expect(result.staff.id).toBe('new-uuid');
    expect(result.staff.status).toBe('INVITED');
    expect(result.share.text).toContain('Rajesh Jewellers');
    expect(result.share.text).toContain('Amit');
    expect(result.share.text).toContain('Staff');
  });

  it('throws ForbiddenException if caller is not shop_admin', async () => {
    await expect(
      svc.invite({ phone: '+919876543210', display_name: 'Amit', role: 'shop_staff' }, MGMT_CTX),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockRepo.insertInvited).not.toHaveBeenCalled();
  });

  it('does not write phone to share text', async () => {
    const stubRow = {
      id: 'new-uuid',
      phone: '+919876543210',
      display_name: 'Amit',
      role: 'shop_manager' as const,
      status: 'INVITED' as const,
      invited_by_user_id: 'owner-uuid',
      invited_at: new Date().toISOString(),
      activated_at: null,
    };
    vi.mocked(mockRepo.insertInvited).mockResolvedValue(stubRow);

    const result = await svc.invite(
      { phone: '+919876543210', display_name: 'Amit', role: 'shop_manager' },
      OWNER_CTX,
    );
    expect(result.share.text).not.toContain('+919876543210');
    expect(result.share.text).toContain('Manager');
  });

  it('propagates ConflictException from repo unchanged', async () => {
    vi.mocked(mockRepo.insertInvited).mockRejectedValue(
      new ConflictException('staff.already_exists'),
    );

    await expect(
      svc.invite({ phone: '+919876543210', display_name: 'X', role: 'shop_staff' }, OWNER_CTX),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('StaffService.list', () => {
  it('returns all staff rows', async () => {
    const rows = [
      {
        id: 'u1',
        display_name: 'Amit',
        phone_last4: '3210',
        role: 'shop_staff' as const,
        status: 'ACTIVE' as const,
        invited_at: null,
        activated_at: null,
      },
    ];
    vi.mocked(mockRepo.findAllByShop).mockResolvedValue(rows);
    const svc = new StaffService(mockRepo, POOL);
    const result = await svc.list(OWNER_CTX);
    expect(result.staff).toHaveLength(1);
    expect(result.staff[0]!.phone_last4).toBe('3210');
  });
});
