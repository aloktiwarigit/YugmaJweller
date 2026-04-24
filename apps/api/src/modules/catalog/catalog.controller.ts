import { Controller, Get, Headers } from '@nestjs/common';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';

@Controller('/api/v1/catalog')
export class CatalogController {
  // TODO Epic 7: implement full catalog with search + filters
  @Get('products')
  @SkipAuth()
  @SkipTenant()
  listPublished(@Headers('x-tenant-id') tenantId: string): { items: unknown[]; total: number; tenantId: string } {
    return { items: [], total: 0, tenantId };
  }
}
