import { SetMetadata } from '@nestjs/common';

export const TENANT_WALKER_ROUTE = 'tenant-walker-route';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const TenantWalkerRoute = () => SetMetadata(TENANT_WALKER_ROUTE, true);
