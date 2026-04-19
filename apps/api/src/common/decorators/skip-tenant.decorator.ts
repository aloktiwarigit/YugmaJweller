import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT = 'skip-tenant';
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const SkipTenant = () => SetMetadata(SKIP_TENANT, true);
