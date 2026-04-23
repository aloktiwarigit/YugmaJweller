import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { PricingService } from './pricing.service';
import { RatesUnavailableError } from '@goldsmith/rates';

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
    perGramRupees: (Number(paise) / 100).toFixed(2),
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
   * Public endpoint — no Firebase auth required.
   * Returns per-gram rates for all 7 purities (paise as strings to avoid bigint serialisation issues).
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
}
