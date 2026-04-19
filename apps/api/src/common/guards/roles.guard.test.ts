import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';

const tenant: Tenant = { id: 'shop-1', slug: 'a', display_name: 'A', status: 'ACTIVE' };

function makeCtx(role: string) {
  return {
    shopId: tenant.id, tenant,
    authenticated: true as const, userId: 'u1', role,
  } as AuthenticatedTenantContext;
}

function makeExecCtx(required: string[] | undefined) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(required) } as unknown as Reflector;
  const execCtx = {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { reflector, execCtx };
}

describe('RolesGuard', () => {
  it('passes when no roles required', () => {
    const { reflector, execCtx } = makeExecCtx(undefined);
    const guard = new RolesGuard(reflector);
    expect(tenantContext.runWith(makeCtx('shop_manager'), () => guard.canActivate(execCtx))).toBe(true);
  });

  it('passes when role matches', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin']);
    const guard = new RolesGuard(reflector);
    expect(tenantContext.runWith(makeCtx('shop_admin'), () => guard.canActivate(execCtx))).toBe(true);
  });

  it('throws 403 when role does not match', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin']);
    const guard = new RolesGuard(reflector);
    expect(() =>
      tenantContext.runWith(makeCtx('shop_manager'), () => guard.canActivate(execCtx)),
    ).toThrow(ForbiddenException);
  });

  it('throws 401 when not authenticated', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(execCtx)).toThrow(UnauthorizedException);
  });

  it('passes shop_manager for read role', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin', 'shop_manager']);
    const guard = new RolesGuard(reflector);
    expect(tenantContext.runWith(makeCtx('shop_manager'), () => guard.canActivate(execCtx))).toBe(true);
  });
});
