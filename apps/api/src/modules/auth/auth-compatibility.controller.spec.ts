import { describe, expect, it, vi } from 'vitest';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod, UnauthorizedException } from '@nestjs/common';
import type { Tenant } from '@goldsmith/tenant-context';
import { AuthCompatibilityController } from './auth-compatibility.controller';

const tenant: Tenant = {
  id: 'shop-1',
  slug: 'demo',
  display_name: 'Demo Shop',
  status: 'ACTIVE',
};

describe('AuthCompatibilityController', () => {
  it('registers only the unversioned auth compatibility prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthCompatibilityController)).toBe('/auth');
    expect(Reflect.getMetadata(PATH_METADATA, AuthCompatibilityController.prototype.session)).toBe('/session');
    expect(Reflect.getMetadata(METHOD_METADATA, AuthCompatibilityController.prototype.session)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, AuthCompatibilityController.prototype.me)).toBe('/me');
    expect(Reflect.getMetadata(METHOD_METADATA, AuthCompatibilityController.prototype.me)).toBe(RequestMethod.GET);
  });

  it('delegates /auth/session to AuthService.session', async () => {
    const svc = { session: vi.fn().mockResolvedValue({ ok: true }) };
    const controller = new AuthCompatibilityController(svc as never);
    const req = {
      user: { uid: 'firebase-uid', phone_number: '+919876543210' },
      headers: { 'user-agent': 'vitest', 'x-request-id': 'req-1' },
    };

    const result = await controller.session(req as never, '127.0.0.1');

    expect(result).toEqual({ ok: true });
    expect(svc.session).toHaveBeenCalledWith({
      uid: 'firebase-uid',
      phoneE164: '+919876543210',
      ip: '127.0.0.1',
      userAgent: 'vitest',
      requestId: 'req-1',
    });
  });

  it('returns /auth/me from the tenant context shape used by /api/v1/auth/me', () => {
    const controller = new AuthCompatibilityController({ session: vi.fn() } as never);

    const result = controller.me({
      authenticated: true,
      shopId: tenant.id,
      tenant,
      userId: 'user-1',
      role: 'shop_admin',
    });

    expect(result).toEqual({
      user: { id: 'user-1', role: 'shop_admin' },
      tenant: { id: 'shop-1', slug: 'demo', display_name: 'Demo Shop' },
    });
  });

  it('rejects /auth/me without an authenticated tenant context', () => {
    const controller = new AuthCompatibilityController({ session: vi.fn() } as never);
    expect(() => controller.me({ authenticated: false, shopId: tenant.id, tenant })).toThrow(UnauthorizedException);
  });
});
