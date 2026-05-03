import {
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { withShopTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { BillingService } from '../billing/billing.service';
import { InventoryService } from '../inventory/inventory.service';
import { SettingsRepository } from '../settings/settings.repository';
import { TryAtHomeBookingsRepository } from './try-at-home-bookings.repository';
import type { TryAtHomeBookingRow } from './try-at-home-bookings.repository';

export interface CreateBookingDto {
  customerId: string;
  productIds: string[];
  notes?:     string;
}

export interface RecordReturnDto {
  returnedProductIds: string[];
  keptProductIds:     string[];
  // Required when keptProductIds.length > 0 so billing can create an invoice
  keptCustomerName?:  string;
  keptCustomerPhone?: string;
}

export interface BookingResponse {
  id:           string;
  shopId:       string;
  customerId:   string;
  productIds:   string[];
  status:       string;
  requestedAt:  string;
  dispatchAt:   string | null;
  returnDueAt:  string | null;
  notes:        string | null;
}

function rowToResponse(r: TryAtHomeBookingRow): BookingResponse {
  return {
    id:          r.id,
    shopId:      r.shop_id,
    customerId:  r.customer_id,
    productIds:  r.product_ids,
    status:      r.status,
    requestedAt: r.requested_at.toISOString(),
    dispatchAt:  r.dispatch_at?.toISOString() ?? null,
    returnDueAt: r.return_due_at?.toISOString() ?? null,
    notes:       r.notes,
  };
}

@Injectable()
export class TryAtHomeBookingsService {
  constructor(
    @Inject('PG_POOL')                      private readonly pool: Pool,
    @Inject(TryAtHomeBookingsRepository)    private readonly repo: TryAtHomeBookingsRepository,
    @Inject(InventoryService)               private readonly inventory: InventoryService,
    @Inject(BillingService)                 private readonly billing: BillingService,
    @Inject(SettingsRepository)             private readonly settings: SettingsRepository,
  ) {}

  async createBooking(dto: CreateBookingDto): Promise<BookingResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    const config = await this.settings.getTryAtHome();
    if (!config.enabled) {
      throw new UnprocessableEntityException({ code: 'try_at_home.feature_disabled' });
    }

    const maxPieces = config.maxPieces ?? 3;
    if (dto.productIds.length === 0) {
      throw new BadRequestException({ code: 'try_at_home.no_products_selected' });
    }
    if (dto.productIds.length > maxPieces) {
      throw new UnprocessableEntityException({
        code:    'try_at_home.piece_limit_exceeded',
        message: `Maximum ${maxPieces} pieces allowed; received ${dto.productIds.length}`,
        limit:   maxPieces,
      });
    }

    // Verify each product is IN_STOCK (AVAILABLE) — piece limit enforced server-side
    for (const productId of dto.productIds) {
      const product = await this.inventory.getProduct(productId);
      if (!product) {
        throw new NotFoundException({ code: 'try_at_home.product_not_found', productId });
      }
      if (product.status !== 'IN_STOCK') {
        throw new UnprocessableEntityException({
          code:      'try_at_home.product_not_available',
          productId,
          status:    product.status,
        });
      }
    }

    const row = await this.repo.insert({
      shopId:     ctx.shopId,
      customerId: dto.customerId,
      productIds: dto.productIds,
      notes:      dto.notes,
    });

    void auditLog(this.pool, {
      action:      AuditAction.TRY_AT_HOME_BOOKING_CREATED,
      subjectType: 'try_at_home_booking',
      subjectId:   row.id,
      actorUserId: ctx.userId,
      after:       { customerId: dto.customerId, productCount: dto.productIds.length },
    }).catch(() => undefined);

    return rowToResponse(row);
  }

  async dispatchBooking(bookingId: string): Promise<BookingResponse> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const { booking, updated } = await withShopTx(this.pool, ctx.shopId, async (client) => {
      const booking = await this.repo.lockForUpdate(client, bookingId);
      if (!booking) throw new NotFoundException({ code: 'try_at_home.booking_not_found' });
      if (booking.status !== 'REQUESTED') {
        throw new UnprocessableEntityException({ code: 'try_at_home.booking_not_in_requested_state' });
      }

      const updated = await this.repo.updateStatusDispatch(client, bookingId, new Date());
      if (!updated) {
        throw new UnprocessableEntityException({ code: 'try_at_home.booking_dispatch_conflict' });
      }

      return { booking, updated };
    });

      // Transition products to IN_TRY_AT_HOME via state machine (outside tx — each has its own audit)
      for (const productId of booking.product_ids) {
        await this.inventory.updateStatus(productId, { status: 'IN_TRY_AT_HOME' });
      }

      void auditLog(this.pool, {
        action:      AuditAction.TRY_AT_HOME_BOOKING_DISPATCHED,
        subjectType: 'try_at_home_booking',
        subjectId:   bookingId,
        actorUserId: ctx.userId,
        after:       { productCount: booking.product_ids.length },
      }).catch(() => undefined);

      return rowToResponse(updated);
  }

  async recordReturn(bookingId: string, dto: RecordReturnDto): Promise<BookingResponse & { invoiceId?: string }> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    const allIds = [...dto.returnedProductIds, ...dto.keptProductIds];
    if (allIds.length === 0) {
      throw new BadRequestException({ code: 'try_at_home.no_products_specified' });
    }

    const { booking, updated, newStatus } = await withShopTx(this.pool, ctx.shopId, async (client) => {
      const booking = await this.repo.lockForUpdate(client, bookingId);
      if (!booking) throw new NotFoundException({ code: 'try_at_home.booking_not_found' });
      if (booking.status !== 'DISPATCHED') {
        throw new UnprocessableEntityException({ code: 'try_at_home.booking_not_dispatched' });
      }

      const bookedSet = new Set(booking.product_ids);
      for (const id of allIds) {
        if (!bookedSet.has(id)) {
          throw new BadRequestException({
            code:      'try_at_home.product_not_in_booking',
            productId: id,
          });
        }
      }

      const newStatus = dto.keptProductIds.length > 0 ? 'CONVERTED_TO_SALE' : 'RETURNED';
      const updated = await this.repo.updateStatusReturn(
        client,
        bookingId,
        dto.keptProductIds,
        newStatus,
      );

      return { booking, updated, newStatus };
    });

      // Revert returned products to IN_STOCK via state machine
      for (const productId of dto.returnedProductIds) {
        await this.inventory.updateStatus(productId, { status: 'IN_STOCK' });
      }

      // Create invoice for kept products
      let invoiceId: string | undefined;
      if (dto.keptProductIds.length > 0) {
        if (!dto.keptCustomerName) {
          throw new BadRequestException({ code: 'try_at_home.customer_name_required_for_kept_items' });
        }
        const lines = await Promise.all(dto.keptProductIds.map(async (productId) => {
          const product = await this.inventory.getProduct(productId);
          return {
            productId,
            description:       `${product.metal} ${product.purity} - ${product.sku}`,
            stoneChargesPaise: '0',
            hallmarkFeePaise:  '0',
          };
        }));

        const invoice = await this.billing.createInvoice(
          {
            customerId:    booking.customer_id,
            customerName:  dto.keptCustomerName,
            customerPhone: dto.keptCustomerPhone,
            lines,
            invoiceType:   'B2C',
          },
          `tah-return-${bookingId}`,
        );
        invoiceId = invoice.id;
      }

      void auditLog(this.pool, {
        action:      AuditAction.TRY_AT_HOME_BOOKING_RETURN_RECORDED,
        subjectType: 'try_at_home_booking',
        subjectId:   bookingId,
        actorUserId: ctx.userId,
        after: {
          returnedCount:  dto.returnedProductIds.length,
          keptCount:      dto.keptProductIds.length,
          newStatus,
          invoiceId: invoiceId ?? null,
        },
      }).catch(() => undefined);

      return { ...rowToResponse(updated), invoiceId };
  }

  async list(params: { limit: number; offset: number }): Promise<{ bookings: BookingResponse[]; total: number }> {
    const { rows, total } = await this.repo.list(params);
    return { bookings: rows.map(rowToResponse), total };
  }

  async getById(bookingId: string): Promise<BookingResponse> {
    const booking = await this.repo.findById(bookingId);
    if (!booking) throw new NotFoundException({ code: 'try_at_home.booking_not_found' });
    return rowToResponse(booking);
  }
}
