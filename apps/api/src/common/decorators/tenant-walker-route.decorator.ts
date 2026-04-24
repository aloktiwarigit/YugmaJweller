import { SetMetadata } from '@nestjs/common';

export const TENANT_WALKER_ROUTE = 'tenant-walker-route';

export interface TenantWalkerRouteOptions {
  expectedStatus?: number;
  body?: Record<string, unknown>;
  pathParams?: Record<string, string>;
  verify?: (body: unknown, tenant: { id: string; slug: string; token: string }) => string | null;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const TenantWalkerRoute = (opts: TenantWalkerRouteOptions = {}) =>
  SetMetadata(TENANT_WALKER_ROUTE, opts);
