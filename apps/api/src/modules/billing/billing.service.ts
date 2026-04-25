import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { computeProductPrice } from '@goldsmith/money';
import {
  validateHuidPresence,
  ComplianceHardBlockError,
} from '@goldsmith/compliance';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type {
  CreateInvoiceDtoType,
  InvoiceLineDtoType,
  InvoiceResponse,
  InvoiceItemResponse,
  PurityKey,
} from '@goldsmith/shared';
import { BillingRepository, IdempotencyKeyConflictError } from './billing.repository';
import type { InvoiceRow, InvoiceItemRow, InsertInvoiceInput } from './billing.repository';
import { generateInvoiceNumber } from './invoice-number';
import { InventoryService } from '../inventory/inventory.service';
import { PricingService } from '../pricing/pricing.service';

// Re-export so consumers can import from billing module without needing @goldsmith/compliance
export { ComplianceHardBlockError };

const IDEM_TTL_SEC = 60 * 60 * 24; // 24h

// Maps DB purity values (e.g. '22K', '999') → PurityKey (e.g. 'GOLD_22K', 'SILVER_999').
// Products are stored in the DB with short purity codes; rates are keyed by full PurityKey.
const DB_PURITY_TO_PURITY_KEY: Record<string, PurityKey> = {
  '24K':  'GOLD_24K',
  '22K':  'GOLD_22K',
  '20K':  'GOLD_20K',
  '18K':  'GOLD_18K',
  '14K':  'GOLD_14K',
  '999':  'SILVER_999',
  '925':  'SILVER_925',
  // Full PurityKey values pass through unchanged (unit-test mocks return full keys)
  'GOLD_24K':   'GOLD_24K',
  'GOLD_22K':   'GOLD_22K',
  'GOLD_20K':   'GOLD_20K',
  'GOLD_18K':   'GOLD_18K',
  'GOLD_14K':   'GOLD_14K',
  'SILVER_999': 'SILVER_999',
  'SILVER_925': 'SILVER_925',
};

function toPurityKey(raw: string | undefined): PurityKey | undefined {
  if (!raw) return undefined;
  return DB_PURITY_TO_PURITY_KEY[raw];
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length < 4) return '***';
  return `***${phone.slice(-4)}`;
}

function rowToInvoiceResponse(invoice: InvoiceRow, items: InvoiceItemRow[]): InvoiceResponse {
  return {
    id:                invoice.id,
    shopId:            invoice.shop_id,
    invoiceNumber:     invoice.invoice_number,
    invoiceType:       invoice.invoice_type as 'B2C' | 'B2B_WHOLESALE',
    customerId:        invoice.customer_id,
    customerName:      invoice.customer_name,
    customerPhone:     invoice.customer_phone,
    status:            invoice.status as 'DRAFT' | 'ISSUED' | 'VOIDED',
    subtotalPaise:     invoice.subtotal_paise.toString(),
    gstMetalPaise:     invoice.gst_metal_paise.toString(),
    gstMakingPaise:    invoice.gst_making_paise.toString(),
    totalPaise:        invoice.total_paise.toString(),
    idempotencyKey:    invoice.idempotency_key,
    issuedAt:          invoice.issued_at?.toISOString() ?? null,
    createdByUserId:   invoice.created_by_user_id,
    createdAt:         invoice.created_at.toISOString(),
    updatedAt:         invoice.updated_at.toISOString(),
    lines:             items.map(rowToInvoiceItemResponse),
  };
}

function rowToInvoiceItemResponse(it: InvoiceItemRow): InvoiceItemResponse {
  return {
    id:                 it.id,
    productId:          it.product_id,
    description:        it.description,
    hsnCode:            it.hsn_code,
    huid:               it.huid,
    metalType:          it.metal_type,
    purity:             it.purity,
    netWeightG:         it.net_weight_g,
    ratePerGramPaise:   it.rate_per_gram_paise?.toString() ?? null,
    makingChargePct:    it.making_charge_pct,
    goldValuePaise:     it.gold_value_paise.toString(),
    makingChargePaise:  it.making_charge_paise.toString(),
    stoneChargesPaise:  it.stone_charges_paise.toString(),
    hallmarkFeePaise:   it.hallmark_fee_paise.toString(),
    gstMetalPaise:      it.gst_metal_paise.toString(),
    gstMakingPaise:     it.gst_making_paise.toString(),
    lineTotalPaise:     it.line_total_paise.toString(),
    sortOrder:          it.sort_order,
  };
}

function idemKey(shopUuid: string, key: string): string {
  return `invoice:idempotency:${shopUuid}:${key}`;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(BillingRepository) private readonly repo: BillingRepository,
    @Inject(InventoryService)  private readonly inventory: InventoryService,
    @Inject(PricingService)    private readonly pricing: PricingService,
    @Inject('BILLING_REDIS')   private readonly redis: Redis,
    @Inject('PG_POOL')         private readonly pool: Pool,
  ) {}

  async createInvoice(
    dto: CreateInvoiceDtoType,
    idempotencyKey: string,
  ): Promise<InvoiceResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException({ code: 'invoice.idempotency_key_required' });
    }

    // 1. Redis idempotency check (best-effort cache; DB UNIQUE is the safety net)
    try {
      const cached = await this.redis.get(idemKey(ctx.shopId, idempotencyKey));
      if (cached !== null) {
        try {
          return JSON.parse(cached) as InvoiceResponse;
        } catch {
          this.logger.warn('Cached invoice JSON malformed; evicting and recomputing');
          this.redis.del(idemKey(ctx.shopId, idempotencyKey)).catch(() => undefined);
        }
      }
    } catch (e) {
      this.logger.warn(`Redis unavailable on idempotency check: ${String(e)}`);
    }

    // 2. Resolve product rows (server-authoritative — productHuidOnRecord drives the gate)
    type ResolvedProduct = {
      id: string;
      metal: string;
      purity: string;
      net_weight_g: string;
      huid: string | null;
      status: string;
    } | null;

    const resolvedProducts: ResolvedProduct[] = await Promise.all(
      dto.lines.map(async (line) => {
        if (!line.productId) return null;
        try {
          const p = await this.inventory.getProductRowForBilling(line.productId);
          return p;
        } catch (e) {
          if (e instanceof NotFoundException) return null;
          throw e;
        }
      }),
    );

    dto.lines.forEach((line, i) => {
      if (line.productId && resolvedProducts[i] === null) {
        throw new BadRequestException({
          code: 'invoice.product_not_found',
          lineIndex: i,
          productId: line.productId,
        });
      }
    });

    // 2b. Status guard: only IN_STOCK products can be invoiced.
    // SOLD/RESERVED/ON_APPROVAL/WITH_KARIGAR are rejected before rate fetch.
    const BILLABLE_STATUSES: string[] = ['IN_STOCK'];
    dto.lines.forEach((line, i) => {
      const product = resolvedProducts[i];
      if (!product) return; // manual line — no status to check
      if (!BILLABLE_STATUSES.includes(product.status)) {
        throw new BadRequestException({
          code: 'invoice.product_not_billable',
          lineIndex: i,
          productId: line.productId,
          status: product.status,
        });
      }
    });

    // 3. Compliance hard-block — uses PRODUCT's HUID, not the request's
    validateHuidPresence(
      dto.lines.map((line, i) => ({
        lineIndex: i,
        huid: line.huid ?? null,
        productHuidOnRecord: resolvedProducts[i]?.huid ?? null,
      })),
    );

    // 4. Fetch live tenant rates (with override applied)
    const rates = await this.pricing.getCurrentRatesForTenant(ctx);

    // 5. Compute each line server-side. Client price fields are ignored
    //    (the Zod schema does not even accept them on input).
    type Line = {
      input: InvoiceLineDtoType;
      product: ResolvedProduct;
      computed: ReturnType<typeof computeProductPrice>;
      ratePerGramPaise: bigint;
    };

    const lines: Line[] = dto.lines.map((input, i) => {
      const product = resolvedProducts[i];
      // For product-backed lines, purity and weight come from the DB record (server-authoritative).
      // A client cannot change them by passing different values in the request.
      // For manual lines (no productId), the request values are the only source.
      const purity    = product ? toPurityKey(product.purity) : toPurityKey(input.purity ?? '');
      const netWeightG = product ? product.net_weight_g : (input.netWeightG ?? null);

      if (!purity || !(purity in rates)) {
        throw new BadRequestException({
          code: 'invoice.purity_required',
          lineIndex: i,
        });
      }
      if (!netWeightG) {
        throw new BadRequestException({
          code: 'invoice.weight_required',
          lineIndex: i,
        });
      }

      const ratePerGramPaise = (rates as unknown as Record<string, { perGramPaise: bigint }>)[purity].perGramPaise;

      const computed = computeProductPrice({
        netWeightG,
        ratePerGramPaise,
        makingChargePct:   input.makingChargePct,
        stoneChargesPaise: BigInt(input.stoneChargesPaise),
        hallmarkFeePaise:  BigInt(input.hallmarkFeePaise),
      });

      return { input, product, computed, ratePerGramPaise };
    });

    // 6. Roll up invoice totals from per-line numbers (integer-exact)
    // Per-line totals are summed to invoice-level aggregates.
    // Invariant: totalPaise === subtotalPaise + gstMetalPaise + gstMakingPaise (verified by integration test).
    let subtotalPaise   = 0n;
    let gstMetalPaise   = 0n;
    let gstMakingPaise  = 0n;
    let totalPaise      = 0n;

    for (const { computed } of lines) {
      subtotalPaise   += computed.goldValuePaise + computed.makingChargePaise + computed.stoneChargesPaise + computed.hallmarkFeePaise;
      gstMetalPaise   += computed.gstMetalPaise;
      gstMakingPaise  += computed.gstMakingPaise;
      totalPaise      += computed.totalPaise;
    }

    // 7. Generate invoice number
    const invoiceNumber = generateInvoiceNumber(ctx.shopId);

    // 8. Persist invoice + items (atomic). On idempotency conflict, fetch & return existing.
    let result: { invoice: InvoiceRow; items: InvoiceItemRow[] };
    try {
      const insertInput: InsertInvoiceInput = {
        invoiceNumber,
        invoiceType:    'B2C',
        customerId:     null,
        customerName:   dto.customerName,
        customerPhone:  dto.customerPhone ?? null,
        status:         'ISSUED',
        subtotalPaise,
        gstMetalPaise,
        gstMakingPaise,
        totalPaise,
        idempotencyKey,
        issuedAt:       new Date(),
        createdByUserId: ctx.userId,
        items: lines.map(({ input, product, computed, ratePerGramPaise }, i) => ({
          productId:           input.productId ?? null,
          description:         input.description,
          hsnCode:             '7113',
          // For product-backed lines, use the DB's stored HUID (what BIS certified).
          // For manual lines, use the request HUID.
          huid:                product?.huid ?? input.huid ?? null,
          // For product-backed lines: persist what was actually billed (from DB).
          // For manual lines: persist the request values (no DB product to reference).
          metalType:           product ? (product.metal ?? null)       : (input.metalType ?? null),
          purity:              product ? (product.purity ?? null)       : (input.purity ?? null),
          netWeightG:          product ? (product.net_weight_g ?? null) : (input.netWeightG ?? null),
          ratePerGramPaise,
          makingChargePct:     input.makingChargePct,
          goldValuePaise:      computed.goldValuePaise,
          makingChargePaise:   computed.makingChargePaise,
          stoneChargesPaise:   computed.stoneChargesPaise,
          hallmarkFeePaise:    computed.hallmarkFeePaise,
          gstMetalPaise:       computed.gstMetalPaise,
          gstMakingPaise:      computed.gstMakingPaise,
          lineTotalPaise:      computed.totalPaise,
          sortOrder:           i,
        })),
      };

      result = await this.repo.insertInvoice(insertInput);
    } catch (err) {
      if (err instanceof IdempotencyKeyConflictError) {
        const existing = await this.repo.getInvoiceByIdempotencyKey(idempotencyKey);
        if (existing) {
          // Defence-in-depth: RLS already scoped this read to ctx.shopId, but verify
          // service-layer too. A misconfigured RLS policy must not leak cross-tenant invoices.
          if (existing.invoice.shop_id !== ctx.shopId) {
            throw new BadRequestException({ code: 'invoice.idempotency_key_conflict' });
          }
          const resp = rowToInvoiceResponse(existing.invoice, existing.items);
          this.cacheResponse(ctx.shopId, idempotencyKey, resp);
          return resp;
        }
      }
      if (err instanceof Error && err.message.startsWith('invoice.insufficient_quantity:')) {
        const productId = err.message.split(':')[1];
        throw new UnprocessableEntityException({
          code: 'invoice.insufficient_quantity',
          productId,
        });
      }
      throw err;
    }

    // 9. Audit — phone masked; PAN never collected on B2C path
    const maskedPhone = maskPhone(dto.customerPhone ?? null);
    void auditLog(this.pool, {
      action: AuditAction.INVOICE_CREATED,
      subjectType: 'invoice',
      subjectId: result.invoice.id,
      actorUserId: ctx.userId,
      after: {
        invoice_number: result.invoice.invoice_number,
        customer_name:  result.invoice.customer_name,
        customer_phone_masked: maskedPhone,
        line_count:     result.items.length,
        total_paise:    result.invoice.total_paise.toString(),
      },
    }).catch(() => undefined);
    void auditLog(this.pool, {
      action: AuditAction.INVOICE_ISSUED,
      subjectType: 'invoice',
      subjectId: result.invoice.id,
      actorUserId: ctx.userId,
      after: {
        invoice_number: result.invoice.invoice_number,
        issued_at:      result.invoice.issued_at?.toISOString() ?? null,
      },
    }).catch(() => undefined);

    // 10. Build response and cache for idempotent replay
    const resp = rowToInvoiceResponse(result.invoice, result.items);
    this.cacheResponse(ctx.shopId, idempotencyKey, resp);
    return resp;
  }

  async getInvoice(id: string): Promise<InvoiceResponse> {
    const found = await this.repo.getInvoice(id);
    if (!found) throw new NotFoundException({ code: 'invoice.not_found' });
    return rowToInvoiceResponse(found.invoice, found.items);
  }

  async listInvoices(page = 1, pageSize = 20): Promise<InvoiceResponse[]> {
    const limit  = Math.min(Math.max(pageSize, 1), 100);
    const offset = (Math.max(page, 1) - 1) * limit;
    const rows   = await this.repo.listInvoices(limit, offset);
    // List view returns headers only — empty `lines` array; clients call GET /:id for detail.
    return rows.map((invoice) => rowToInvoiceResponse(invoice, []));
  }

  private cacheResponse(shopUuid: string, key: string, resp: InvoiceResponse): void {
    this.redis
      .setex(idemKey(shopUuid, key), IDEM_TTL_SEC, JSON.stringify(resp))
      .catch((e: unknown) => this.logger.warn(`Idempotency cache write failed: ${String(e)}`));
  }
}
