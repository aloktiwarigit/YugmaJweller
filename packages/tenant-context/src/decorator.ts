import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { tenantContext } from './als';
import type { TenantContext } from './context';

export const TenantContextDec = createParamDecorator(
  (_: unknown, _ctx: ExecutionContext): TenantContext => tenantContext.requireCurrent(),
);
