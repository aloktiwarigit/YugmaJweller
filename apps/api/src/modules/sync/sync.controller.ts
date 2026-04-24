import { Body, Controller, Get, Post, Query, UnauthorizedException } from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PullResponse, PushResponse, SyncTable } from '@goldsmith/sync';
import { SyncService } from './sync.service';
import { PushRequestSchema, type PushRequestDto } from './dto/push-request.dto';

// Wire format: cursor serialized as string (bigint not JSON-safe)
type PullWire = Omit<PullResponse, 'cursor'> & { cursor: string };
type PushWire = Omit<PushResponse, 'cursor'> & { cursor: string };

const ALLOWED_TABLES = new Set<SyncTable>(['products', 'customers', 'shop_settings']);

@Controller('/api/v1/sync')
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  @Get('pull')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async pull(
    @TenantContextDec() ctx: TenantContext,
    @Query('lastCursor') lastCursor: string | undefined,
    @Query('tables') tables: string | undefined,
  ): Promise<PullWire> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });

    const parsedTables = (tables ?? 'products')
      .split(',')
      .map((t) => t.trim())
      .filter((t): t is SyncTable => ALLOWED_TABLES.has(t as SyncTable));

    const result = await this.svc.pull(ctx, {
      lastCursor: BigInt(lastCursor ?? '0'),
      tables: parsedTables.length > 0 ? parsedTables : ['products'],
    });

    return { ...result, cursor: result.cursor.toString() };
  }

  @Post('push')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async push(
    @TenantContextDec() ctx: TenantContext,
    @Body(new ZodValidationPipe(PushRequestSchema)) dto: PushRequestDto,
  ): Promise<PushWire> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const result = await this.svc.push(ctx, dto);
    return { ...result, cursor: result.cursor.toString() };
  }
}
