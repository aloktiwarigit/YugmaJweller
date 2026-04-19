import { SetMetadata } from '@nestjs/common';

// String key matches apps/api/src/common/decorators/tenant-walker-route.decorator.ts.
// Using a string (not Symbol) so the value survives serialization and module boundaries.
export const TENANT_WALKER_ROUTE = 'tenant-walker-route';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const TenantWalkerRoute = () => SetMetadata(TENANT_WALKER_ROUTE, true);
