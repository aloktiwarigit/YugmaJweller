import { Controller, Get, SetMetadata } from '@nestjs/common';

export const SKIP_TENANT = 'skip-tenant';
export const SkipTenant = () => SetMetadata(SKIP_TENANT, true);

@Controller()
export class HealthController {
  @Get('/healthz')
  @SkipTenant()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
