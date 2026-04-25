import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Redis } from '@goldsmith/cache';
import { Weight, MoneyInPaise } from '@goldsmith/money';
import { Decimal } from 'decimal.js';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { PurityRates } from '@goldsmith/rates';
import { InventoryRepository } from './inventory.repository';
import { PricingService } from '../pricing/pricing.service';

const PURITY_RATE_MAP: Record<string, keyof PurityRates> = {
  '24K': 'GOLD_24K', '22K': 'GOLD_22K', '20K': 'GOLD_20K',
  '18K': 'GOLD_18K', '14K': 'GOLD_14K',
  '999': 'SILVER_999', '925': 'SILVER_925',
};

const VALUATION_TTL_SEC = 300;          // 5-minute cache
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min

export interface CategoryValuation {
  category:         string;
  productCount:     number;
  totalWeightG:     string;          // "123.4500 g"
  marketValuePaise: bigint;
  formattedValue:   string;          // "₹12,34,567.00"
  primaryMetal:     string | null;   // 'GOLD' | 'SILVER' | 'PLATINUM' | null
}

export interface ValuationSummary {
  categories:          CategoryValuation[];
  grandTotalPaise:     bigint;
  grandTotalFormatted: string;
  ratesFreshAt:        Date;
  ratesStale:          boolean;
  computedAt:          Date;
}

interface CategoryAccumulator {
  count:        number;
  weight:       Weight;
  valuePaise:   bigint;
  primaryMetal: string;
}

@Injectable()
export class InventoryValuationService {
  readonly logger = new Logger(InventoryValuationService.name);

  constructor(
    private readonly repo: InventoryRepository,
    private readonly pricingService: PricingService,
    @Inject('INVENTORY_REDIS') private readonly redis: Redis,
  ) {}

  async computeValuation(ctx: AuthenticatedTenantContext): Promise<ValuationSummary> {
    const cacheKey = `valuation:${ctx.shopId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) return this.deserialize(cached);
    } catch (err) {
      this.logger.warn(`Valuation cache read failed — computing fresh: ${String(err)}`);
    }

    const [products, rates] = await Promise.all([
      this.repo.listProductsForValuation(),
      this.pricingService.getCurrentRates(),
    ]);

    const ratesFreshAt = rates.GOLD_22K.fetchedAt;
    const ratesStale = (Date.now() - ratesFreshAt.getTime()) > STALE_THRESHOLD_MS;

    const categoryMap = new Map<string, CategoryAccumulator>();

    for (const product of products) {
      const rateKey = PURITY_RATE_MAP[product.purity];
      if (!rateKey) {
        this.logger.warn(
          `Unknown purity "${product.purity}" on product ${product.id} — skipping from valuation`,
        );
        continue;
      }

      const rate = rates[rateKey];
      const weight = Weight.from(product.net_weight_g);
      const valueDecimal = weight.multiply(new Decimal(rate.perGramPaise.toString()));
      const valuePaise = BigInt(valueDecimal.toFixed(0));

      const existing = categoryMap.get(product.category_name);
      if (existing) {
        existing.count += 1;
        existing.weight = existing.weight.add(weight);
        existing.valuePaise += valuePaise;
      } else {
        categoryMap.set(product.category_name, {
          count: 1, weight, valuePaise, primaryMetal: product.metal,
        });
      }
    }

    const categories: CategoryValuation[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        productCount:     data.count,
        totalWeightG:     data.weight.toGrams(),
        marketValuePaise: data.valuePaise,
        formattedValue:   MoneyInPaise.from(data.valuePaise).toRupees(),
        primaryMetal:     data.primaryMetal,
      }))
      .sort((a, b) => (b.marketValuePaise > a.marketValuePaise ? 1 : -1));

    const grandTotalPaise = categories.reduce((sum, c) => sum + c.marketValuePaise, 0n);

    const summary: ValuationSummary = {
      categories,
      grandTotalPaise,
      grandTotalFormatted: MoneyInPaise.from(grandTotalPaise).toRupees(),
      ratesFreshAt,
      ratesStale,
      computedAt: new Date(),
    };

    try {
      await this.redis.setex(cacheKey, VALUATION_TTL_SEC, this.serialize(summary));
    } catch (err) {
      this.logger.warn(`Valuation cache write failed: ${String(err)}`);
    }

    return summary;
  }

  private serialize(s: ValuationSummary): string {
    return JSON.stringify({
      ...s,
      grandTotalPaise: s.grandTotalPaise.toString(),
      ratesFreshAt:    s.ratesFreshAt.toISOString(),
      computedAt:      s.computedAt.toISOString(),
      categories: s.categories.map((c) => ({
        ...c, marketValuePaise: c.marketValuePaise.toString(),
      })),
    });
  }

  private deserialize(raw: string): ValuationSummary {
    const p = JSON.parse(raw) as {
      categories: Array<{
        category: string; productCount: number; totalWeightG: string;
        marketValuePaise: string; formattedValue: string; primaryMetal: string | null;
      }>;
      grandTotalPaise: string; grandTotalFormatted: string;
      ratesFreshAt: string; ratesStale: boolean; computedAt: string;
    };
    return {
      ...p,
      grandTotalPaise: BigInt(p.grandTotalPaise),
      ratesFreshAt:    new Date(p.ratesFreshAt),
      computedAt:      new Date(p.computedAt),
      categories: p.categories.map((c) => ({
        ...c, marketValuePaise: BigInt(c.marketValuePaise),
      })),
    };
  }
}
