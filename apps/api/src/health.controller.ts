import { Controller, Get, SetMetadata } from '@nestjs/common';

export const SKIP_TENANT = 'skip-tenant';
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const SkipTenant = () => SetMetadata(SKIP_TENANT, true);

@Controller()
export class HealthController {
  @Get('/healthz')
  @SkipTenant()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
