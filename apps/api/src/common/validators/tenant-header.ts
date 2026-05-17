import { BadRequestException } from '@nestjs/common';

// RFC 4122 shape — same regex used in CustomerAuthGuard (UUID_SHAPE).
// Any client-supplied tenant identifier MUST match this before reaching SQL.
export const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidShape(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_SHAPE.test(value);
}

/**
 * Validates a client-supplied x-tenant-id header value for public/unauthenticated
 * routes (@SkipAuth() + @SkipTenant()).
 *
 * Throws BadRequestException with a stable error code when the value is missing
 * or not a UUID. Returns the validated UUID string on success.
 *
 * Use this on every public route that takes x-tenant-id; authenticated routes
 * already validate via TenantInterceptor / CustomerAuthGuard.
 */
export function assertPublicTenantHeader(
  shopId: string | undefined,
): string {
  if (!shopId) {
    throw new BadRequestException({ code: 'catalog.tenant_id_required' });
  }
  if (!UUID_SHAPE.test(shopId)) {
    throw new BadRequestException({ code: 'catalog.tenant_id_invalid' });
  }
  return shopId;
}
