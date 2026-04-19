import { Controller, Get, Header, Inject, NotFoundException, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { TenantBootService } from './tenant-boot.service';

@Controller('/api/v1/tenant')
export class TenantBootController {
  constructor(@Inject(TenantBootService) private readonly svc: TenantBootService) {}

  @Get('/boot')
  @SkipTenant()
  @SkipAuth()
  @Header('Cache-Control', 'max-age=86400, stale-while-revalidate=86400')
  async boot(@Query('slug') slug: string, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ id: string; display_name: string; config: Record<string, unknown> } | undefined> {
    if (typeof slug !== 'string' || !slug || slug.length > 128) throw new NotFoundException({ code: 'tenant.not_found' });
    const result = await this.svc.bootBySlug(slug, {
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? ''),
      requestId: String(req.headers['x-request-id'] ?? ''),
    });
    if (req.headers['if-none-match'] === result.etag) { res.status(304); return; }
    res.setHeader('ETag', result.etag);
    return { id: result.id, display_name: result.display_name, config: result.config };
  }
}
