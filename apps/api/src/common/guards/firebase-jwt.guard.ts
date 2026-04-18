import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SKIP_AUTH } from '../decorators/skip-auth.decorator';

@Injectable()
export class FirebaseJwtGuard extends AuthGuard('firebase-jwt') {
  constructor(private readonly reflector: Reflector) { super(); }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  override canActivate(ctx: ExecutionContext) {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH, [ctx.getHandler(), ctx.getClass()]);
    if (skip) return true;
    return super.canActivate(ctx);
  }
}
