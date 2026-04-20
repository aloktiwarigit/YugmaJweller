import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PolicyGuard } from './policy.guard';
import { tenantContext } from '@goldsmith/tenant-context';
import type { PermissionsCache } from '@goldsmith/tenant-config';
import type { PermissionsRepository } from '../permissions.repository';

function mockCtx(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass:   () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(key: string | undefined): Reflector {
  return { get: vi.fn().mockReturnValue(key) } as unknown as Reflector;
}

const shopId = 'shop-uuid-1';

describe('PolicyGuard', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('passes when no @Permission decorator is present', async () => {
    vi.spyOn(tenantContext, 'current').mockReturnValue({
      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
    });
    const guard = new PolicyGuard(
      makeReflector(undefined),
      { getPermissions: vi.fn(), setPermissions: vi.fn(), invalidate: vi.fn() } as unknown as PermissionsCache,
      { getPermissions: vi.fn() } as unknown as PermissionsRepository,
    );
    expect(await guard.canActivate(mockCtx())).toBe(true);
  });

  it('throws UnauthorizedException when tenant context is not authenticated', async () => {
    vi.spyOn(tenantContext, 'current').mockReturnValue(null as never);
    const guard = new PolicyGuard(
      makeReflector('billing.void'),
      { getPermissions: vi.fn(), setPermissions: vi.fn(), invalidate: vi.fn() } as unknown as PermissionsCache,
      { getPermissions: vi.fn() } as unknown as PermissionsRepository,
    );
    await expect(guard.canActivate(mockCtx())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('shop_admin bypasses — no cache or DB lookup', async () => {
    const getCachePerm = vi.fn();
    vi.spyOn(tenantContext, 'current').mockReturnValue({
      authenticated: true, shopId, role: 'shop_admin', tenant: {} as never, userId: 'u1',
    });
    const guard = new PolicyGuard(
      makeReflector('billing.void'),
      { getPermissions: getCachePerm, setPermissions: vi.fn(), invalidate: vi.fn() } as unknown as PermissionsCache,
      { getPermissions: vi.fn() } as unknown as PermissionsRepository,
    );
    expect(await guard.canActivate(mockCtx())).toBe(true);
    expect(getCachePerm).not.toHaveBeenCalled();
  });

  it('cache hit — allowed — returns true without DB call', async () => {
    vi.spyOn(tenantContext, 'current').mockReturnValue({
      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
    });
    const getDbPerm = vi.fn();
    const guard = new PolicyGuard(
      makeReflector('billing.create'),
      {
        getPermissions: vi.fn().mockResolvedValue({ 'billing.create': true }),
        setPermissions: vi.fn(), invalidate: vi.fn(),
      } as unknown as PermissionsCache,
      { getPermissions: getDbPerm } as unknown as PermissionsRepository,
    );
    expect(await guard.canActivate(mockCtx())).toBe(true);
    expect(getDbPerm).not.toHaveBeenCalled();
  });

  it('cache hit — denied — throws ForbiddenException with errorCode', async () => {
    vi.spyOn(tenantContext, 'current').mockReturnValue({
      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
    });
    const guard = new PolicyGuard(
      makeReflector('billing.void'),
      {
        getPermissions: vi.fn().mockResolvedValue({ 'billing.void': false }),
        setPermissions: vi.fn(), invalidate: vi.fn(),
      } as unknown as PermissionsCache,
      { getPermissions: vi.fn() } as unknown as PermissionsRepository,
    );
    await expect(guard.canActivate(mockCtx())).rejects.toThrow(ForbiddenException);
  });

  it('cache miss — DB fallback — populates cache — returns correct result', async () => {
    vi.spyOn(tenantContext, 'current').mockReturnValue({
      authenticated: true, shopId, role: 'shop_manager', tenant: {} as never, userId: 'u1',
    });
    const setCache = vi.fn();
    const guard = new PolicyGuard(
      makeReflector('reports.view'),
      {
        getPermissions: vi.fn().mockResolvedValue(null),
        setPermissions: setCache,
        invalidate: vi.fn(),
      } as unknown as PermissionsCache,
      { getPermissions: vi.fn().mockResolvedValue({ 'reports.view': true }) } as unknown as PermissionsRepository,
    );
    expect(await guard.canActivate(mockCtx())).toBe(true);
    expect(setCache).toHaveBeenCalledWith(shopId, 'shop_manager', { 'reports.view': true });
  });

  it('unknown permission key — deny by default', async () => {
    vi.spyOn(tenantContext, 'current').mockReturnValue({
      authenticated: true, shopId, role: 'shop_staff', tenant: {} as never, userId: 'u1',
    });
    const guard = new PolicyGuard(
      makeReflector('unknown.key'),
      {
        getPermissions: vi.fn().mockResolvedValue({ 'billing.create': true }),
        setPermissions: vi.fn(), invalidate: vi.fn(),
      } as unknown as PermissionsCache,
      { getPermissions: vi.fn() } as unknown as PermissionsRepository,
    );
    await expect(guard.canActivate(mockCtx())).rejects.toThrow(ForbiddenException);
  });
});
