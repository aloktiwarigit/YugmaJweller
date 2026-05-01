import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantManagementService } from './services/tenant-management.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';
import { ImpersonationService } from './services/impersonation.service';
import { DataExportService } from './services/data-export.service';
import {
  CreateTenantDto,
  type CreateTenantDtoT,
  UpdateTenantDto,
  type UpdateTenantDtoT,
  SuspendTenantDto,
  type SuspendTenantDtoT,
  UpsertSubscriptionDto,
  type UpsertSubscriptionDtoT,
  ImpersonateDto,
  type ImpersonateDtoT,
} from './dto';

type FirebaseRequest = Request & { user?: { uid?: string } };

@Controller('platform/admin')
@Roles('platform_admin')
@SkipTenant()
export class PlatformAdminController {
  constructor(
    @Inject(TenantManagementService) private readonly tenants: TenantManagementService,
    @Inject(SubscriptionService) private readonly subs: SubscriptionService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(ImpersonationService) private readonly impersonation: ImpersonationService,
    @Inject(DataExportService) private readonly exports: DataExportService,
  ) {}

  private platformUid(req: Request): string {
    const user = (req as FirebaseRequest).user;
    if (!user?.uid) throw new UnauthorizedException({ code: 'auth.missing' });
    return user.uid;
  }

  @Post('tenants')
  @UsePipes(new ZodValidationPipe(CreateTenantDto))
  async createTenant(@Body() dto: CreateTenantDtoT, @Req() req: Request): Promise<{ id: string }> {
    return this.tenants.createShop({
      slug: dto.slug,
      displayName: dto.displayName,
      platformUserId: this.platformUid(req),
    });
  }

  @Get('tenants')
  async listTenants(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search?: string,
  ): Promise<unknown> {
    return this.tenants.listShops({
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
      search,
    });
  }

  @Post('tenants/:id')
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(UpdateTenantDto))
  async updateTenant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantDtoT,
    @Req() req: Request,
  ): Promise<void> {
    await this.tenants.updateShop({
      shopId: id,
      patch: dto,
      platformUserId: this.platformUid(req),
    });
  }

  @Post('tenants/:id/suspend')
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(SuspendTenantDto))
  async suspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SuspendTenantDtoT,
    @Req() req: Request,
  ): Promise<void> {
    await this.tenants.suspendShop(id, dto.reason, this.platformUid(req));
  }

  @Post('tenants/:id/unsuspend')
  @HttpCode(204)
  async unsuspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.tenants.unsuspendShop(id, this.platformUid(req));
  }

  @Get('tenants/:id/export')
  async export(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<unknown> {
    return this.exports.exportTenant(id, this.platformUid(req));
  }

  @Post('subscriptions')
  @UsePipes(new ZodValidationPipe(UpsertSubscriptionDto))
  async upsertSub(
    @Body() dto: UpsertSubscriptionDtoT,
    @Req() req: Request,
  ): Promise<{ id: string }> {
    return this.subs.upsertSubscription({
      ...dto,
      platformUserId: this.platformUid(req),
    });
  }

  @Get('subscriptions')
  async listSubs(): Promise<unknown> {
    return this.subs.listSubscriptions();
  }

  @Get('metrics')
  async getMetrics(): Promise<unknown> {
    return this.metrics.getMetrics();
  }

  @Post('impersonate')
  @UsePipes(new ZodValidationPipe(ImpersonateDto))
  async startImpersonation(
    @Body() dto: ImpersonateDtoT,
    @Req() req: Request,
  ): Promise<unknown> {
    const ipHeader = req.headers['x-forwarded-for'];
    const ip = typeof ipHeader === 'string' ? ipHeader.split(',')[0]?.trim() : undefined;
    return this.impersonation.startImpersonation({
      platformUserId: this.platformUid(req),
      targetShopId: dto.targetShopId,
      reason: dto.reason,
      ...(ip ? { ip } : {}),
      ...(req.headers['user-agent'] ? { userAgent: String(req.headers['user-agent']) } : {}),
    });
  }

  @Delete('impersonate/:sessionId')
  @HttpCode(204)
  async endImpersonation(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.impersonation.endImpersonation(sessionId, this.platformUid(req));
  }
}
