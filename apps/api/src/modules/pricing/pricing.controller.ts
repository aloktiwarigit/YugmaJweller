import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PricingService } from './pricing.service';
import type { RateHistoryPoint } from './pricing.service';
import { RatesUnavailableError } from '@goldsmith/rates';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SetRateOverrideDtoSchema, PURITY_VALUES } from '@goldsmith/shared';
import type { SetRateOverrideDto, PurityKey } from '@goldsmith/shared';

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface PurityEntry {
  perGramPaise: string;
  perGramRupees: string;
  fetchedAt: string;
}

interface CurrentRatesResponse {
  GOLD_24K: PurityEntry;
  GOLD_22K: PurityEntry;
  GOLD_20K: PurityEntry;
  GOLD_18K: PurityEntry;
  GOLD_14K: PurityEntry;
  SILVER_999: PurityEntry;
  SILVER_925: PurityEntry;
  stale: boolean;
  source: string;
}

function toEntry(paise: bigint, fetchedAt: Date): PurityEntry {
  return {
    perGramPaise: paise.toString(),
    perGramRupees: `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`,
    fetchedAt: fetchedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('api/v1/rates')
export class PricingController {
  constructor(@Inject(PricingService) private readonly pricingService: PricingService) {}

  /**
   * GET /api/v1/rates/current
   * Public endpoint — no Firebase auth or tenant required.
   * Always returns base IBJA market rates (no per-tenant overrides applied here).
   * Per-tenant overrides are applied in billing/invoice calculations via PricingService.getCurrentRatesForTenant().
   */
  @Get('current')
  @SkipAuth()
  @SkipTenant()
  async getCurrent(): Promise<CurrentRatesResponse> {
    try {
      const rates = await this.pricingService.getCurrentRates();
      return {
        GOLD_24K: toEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt),
        GOLD_22K: toEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt),
        GOLD_20K: toEntry(rates.GOLD_20K.perGramPaise, rates.GOLD_20K.fetchedAt),
        GOLD_18K: toEntry(rates.GOLD_18K.perGramPaise, rates.GOLD_18K.fetchedAt),
        GOLD_14K: toEntry(rates.GOLD_14K.perGramPaise, rates.GOLD_14K.fetchedAt),
        SILVER_999: toEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt),
        SILVER_925: toEntry(rates.SILVER_925.perGramPaise, rates.SILVER_925.fetchedAt),
        stale: rates.stale,
        source: rates.source,
      };
    } catch (err) {
      if (err instanceof RatesUnavailableError) {
        throw new HttpException(
          { code: 'rates.unavailable', message: 'Gold rate data is temporarily unavailable' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/rates/history
   * Authenticated (any role) — last snapshot per calendar day for the requested range.
   * ibja_rate_snapshots is platform-global; no tenant context required.
   */
  @Get('history')
  @SkipTenant()
  async getRateHistory(
    @Query('range') range = '30d',
    @Query('purity') purity = 'GOLD_22K',
  ): Promise<RateHistoryPoint[]> {
    const validRanges = ['30d', '90d', '365d'];
    if (!validRanges.includes(range)) {
      throw new HttpException(
        { code: 'rates.invalid_range', message: 'range must be 30d, 90d, or 365d' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!(PURITY_VALUES as readonly string[]).includes(purity)) {
      throw new HttpException(
        { code: 'rates.invalid_purity', message: 'purity must be a valid purity key' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.pricingService.getRateHistory(
      range as '30d' | '90d' | '365d',
      purity as PurityKey,
    );
  }

  /**
   * POST /api/v1/rates/override
   * OWNER only — manually override today's gold/silver rate for a specific purity.
   */
  @Post('override')
  @HttpCode(204)
  @Roles('shop_admin')
  async setOverride(
    @TenantContextDec() ctx: TenantContext,
    @Body(new ZodValidationPipe(SetRateOverrideDtoSchema)) dto: SetRateOverrideDto,
  ): Promise<void> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    await this.pricingService.setOverride(ctx as AuthenticatedTenantContext, dto);
  }
}
