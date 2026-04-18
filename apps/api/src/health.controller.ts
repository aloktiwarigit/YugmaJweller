import { Controller, Get } from '@nestjs/common';
import { SkipTenant } from './common/decorators/skip-tenant.decorator';
import { SkipAuth } from './common/decorators/skip-auth.decorator';

@Controller()
export class HealthController {
  @Get('/healthz')
  @SkipTenant()
  @SkipAuth()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
