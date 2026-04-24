import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PricingService } from './pricing.service';
import { RatesUnavailableError } from '@goldsmith/rates';
import { TenantContextDec, tenantContext as tenantContextAls } from '@goldsmith/tenant-context';
import type { TenantContext, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SetRateOverrideDtoSchema } from '@goldsmith/shared';
import type { SetRateOverrideDto } from '@goldsmith/shared';
import type { PurityKey } from '@goldsmith/shared';

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface PurityEntry {
  perGramPaise: string;
  perGramRupees: string;
  fetchedAt: string;
  overridden?: boolean;
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
  overriddenPurities?: PurityKey[];
}

function toEntry(paise: bigint, fetchedAt: Date, overridden?: boolean): PurityEntry {
  const entry: PurityEntry = {
    perGramPaise: paise.toString(),
    perGramRupees: `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`,
    fetchedAt: fetchedAt.toISOString(),
  };
  if (overridden) entry.overridden = true;
  return entry;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('api/v1/rates')
export class PricingController {
  constructor(@Inject(PricingService) private readonly pricingService: PricingService) {}

  /**
   * GET /api/v1/rates/current
   * Public (no Firebase auth required). Tenant context optional.
   * Authenticated shopkeeper calls return override-applied rates.
   * All other callers receive base IBJA rates.
   */
  @Get('current')
  @SkipAuth()
  async getCurrent(): Promise<CurrentRatesResponse> {
    // Read optional tenant context from ALS (set by TenantInterceptor when tenant is resolved).
    // Falls back to base rates when context is absent (public consumers, minimal test modules).
    const ctx = tenantContextAls.current();
    try {
      if (ctx?.authenticated) {
        const auth = ctx as AuthenticatedTenantContext;
        const rates = await this.pricingService.getCurrentRatesForTenant(auth);
        return {
          GOLD_24K: toEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt, rates.overriddenPurities.includes('GOLD_24K')),
          GOLD_22K: toEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt, rates.overriddenPurities.includes('GOLD_22K')),
          GOLD_20K: toEntry(rates.GOLD_20K.perGramPaise, rates.GOLD_20K.fetchedAt, rates.overriddenPurities.includes('GOLD_20K')),
          GOLD_18K: toEntry(rates.GOLD_18K.perGramPaise, rates.GOLD_18K.fetchedAt, rates.overriddenPurities.includes('GOLD_18K')),
          GOLD_14K: toEntry(rates.GOLD_14K.perGramPaise, rates.GOLD_14K.fetchedAt, rates.overriddenPurities.includes('GOLD_14K')),
          SILVER_999: toEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt, rates.overriddenPurities.includes('SILVER_999')),
          SILVER_925: toEntry(rates.SILVER_925.perGramPaise, rates.SILVER_925.fetchedAt, rates.overriddenPurities.includes('SILVER_925')),
          stale: rates.stale,
          source: rates.source,
          overriddenPurities: rates.overriddenPurities,
        };
      }

      // Unauthenticated or no tenant context — base IBJA rates only
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
