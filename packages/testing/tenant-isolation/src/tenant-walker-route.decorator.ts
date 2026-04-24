import { SetMetadata } from '@nestjs/common';
import type { SeededTenantToken } from './endpoint-walker';

// String key must match apps/api/src/common/decorators/tenant-walker-route.decorator.ts.
export const TENANT_WALKER_ROUTE = 'tenant-walker-route';

export interface TenantWalkerRouteOptions {
  /** HTTP success status to assert. Defaults to 200. */
  expectedStatus?: number;
  /** Request body for mutation methods. */
  body?: Record<string, unknown>;
  /**
   * Concrete substitutions for path parameter segments.
   * e.g. { role: 'shop_manager' } turns /roles/:role/permissions into /roles/shop_manager/permissions
   */
  pathParams?: Record<string, string>;
  /**
   * Optional extra verification against the response body.
   * Return a failure reason string when isolation is violated, or null on pass.
   */
  verify?: (body: unknown, tenant: SeededTenantToken) => string | null;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const TenantWalkerRoute = (opts: TenantWalkerRouteOptions = {}) =>
  SetMetadata(TENANT_WALKER_ROUTE, opts);
