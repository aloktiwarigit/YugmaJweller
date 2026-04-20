import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { FirebaseUserClaims } from '../../modules/auth/firebase-jwt.strategy';

function makeExecCtx(
  required: string[] | undefined,
  userClaims?: Partial<FirebaseUserClaims>,
): { reflector: Reflector; execCtx: ExecutionContext } {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(required) } as unknown as Reflector;
  const execCtx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: userClaims }),
    }),
  } as unknown as ExecutionContext;
  return { reflector, execCtx };
}

describe('RolesGuard', () => {
  it('passes when no roles required', () => {
    const { reflector, execCtx } = makeExecCtx(undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(execCtx)).toBe(true);
  });

  it('passes when role matches', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin'], { role: 'shop_admin' });
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(execCtx)).toBe(true);
  });

  it('throws 403 when role does not match', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin'], { role: 'shop_manager' });
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(execCtx)).toThrow(ForbiddenException);
  });

  it('throws 401 when not authenticated (no user on req)', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin'], undefined);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(execCtx)).toThrow(UnauthorizedException);
  });

  it('throws 401 when user has no role claim', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin'], { uid: 'x', role: undefined });
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(execCtx)).toThrow(UnauthorizedException);
  });

  it('passes shop_manager for multi-role requirement', () => {
    const { reflector, execCtx } = makeExecCtx(['shop_admin', 'shop_manager'], { role: 'shop_manager' });
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(execCtx)).toBe(true);
  });
});
