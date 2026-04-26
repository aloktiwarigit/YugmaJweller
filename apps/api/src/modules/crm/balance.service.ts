import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Pool, PoolClient } from 'pg';
import type { TenantContext } from '@goldsmith/tenant-context';
import { CrmRepository } from './crm.repository';

export interface InvoiceEventPayload {
  shopId:     string;
  customerId: string | null;
  invoiceId:  string;
}

// Paise are returned as strings — bigint does not serialize over JSON,
// and the mobile parses the string before formatting (matches BillingService convention).
export interface CustomerBalance {
  customerId:       string;
  outstandingPaise: string;
  advancePaise:     string;
  lastUpdatedAt:    string;
}

interface BalanceRow {
  id:                string;
  shop_id:           string;
  customer_id:       string;
  outstanding_paise: bigint;
  advance_paise:     bigint;
  last_updated_at:   Date;
}

// Runs fn inside a tenant-scoped transaction without relying on AsyncLocalStorage.
// Needed for event-handler paths that execute outside of HTTP request context;
// the TenantContext is passed explicitly rather than recovered from ALS.
async function withShopTx<T>(pool: Pool, ctx: TenantContext, fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_user');
    await client.query(`SET LOCAL app.current_shop_id = '${ctx.shopId}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @Inject('PG_POOL')         private readonly pool: Pool,
    @Inject(CrmRepository)     private readonly crmRepo: CrmRepository,
  ) {}

  async getBalance(
    ctx: TenantContext,
    customerId: string,
  ): Promise<CustomerBalance> {
    const customer = await this.crmRepo.getCustomerById(customerId);
    if (!customer) throw new NotFoundException({ code: 'crm.customer_not_found' });

    const row = await withShopTx(this.pool, ctx, async (tx) => {
      const r = await tx.query<BalanceRow>(
        `SELECT id, shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at
         FROM customer_balances WHERE customer_id = $1`,
        [customerId],
      );
      return r.rows[0] ?? null;
    });

    if (!row) {
      return { customerId, outstandingPaise: '0', advancePaise: '0', lastUpdatedAt: new Date().toISOString() };
    }
    return {
      customerId:       row.customer_id,
      outstandingPaise: BigInt(row.outstanding_paise).toString(),
      advancePaise:     BigInt(row.advance_paise).toString(),
      lastUpdatedAt:    row.last_updated_at.toISOString(),
    };
  }

  // Recomputes balance from invoices + payments for the given customer.
  // Uses SELECT FOR UPDATE on the balance row to prevent concurrent recalculation races.
  async recalculateBalance(
    ctx: TenantContext,
    customerId: string,
  ): Promise<void> {
    await withShopTx(this.pool, ctx, async (tx) => {
      // Lock the balance row (if it exists) to serialize concurrent recalculations.
      await tx.query(
        `SELECT id FROM customer_balances WHERE customer_id = $1 FOR UPDATE`,
        [customerId],
      );

      // Sum ISSUED invoices only — DRAFT is not yet committed, VOIDED is reversed.
      const invoicedR = await tx.query<{ total_invoiced: bigint }>(
        `SELECT COALESCE(SUM(total_paise), 0)::bigint AS total_invoiced
         FROM invoices
         WHERE customer_id = $1
           AND status = 'ISSUED'`,
        [customerId],
      );

      // Sum payments on ISSUED invoices only.
      const paidR = await tx.query<{ total_paid: bigint }>(
        `SELECT COALESCE(SUM(p.amount_paise), 0)::bigint AS total_paid
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         WHERE i.customer_id = $1
           AND i.status = 'ISSUED'`,
        [customerId],
      );

      const totalInvoiced = BigInt(invoicedR.rows[0]?.total_invoiced ?? 0);
      const totalPaid     = BigInt(paidR.rows[0]?.total_paid ?? 0);

      const outstanding = totalInvoiced > totalPaid ? totalInvoiced - totalPaid : 0n;
      const advance     = totalPaid > totalInvoiced ? totalPaid - totalInvoiced : 0n;

      await tx.query(
        `INSERT INTO customer_balances
           (shop_id, customer_id, outstanding_paise, advance_paise, last_updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (shop_id, customer_id)
         DO UPDATE SET
           outstanding_paise = EXCLUDED.outstanding_paise,
           advance_paise     = EXCLUDED.advance_paise,
           last_updated_at   = EXCLUDED.last_updated_at`,
        [ctx.shopId, customerId, outstanding, advance],
      );
    });
  }

  @OnEvent('invoice.created')
  @OnEvent('invoice.voided')
  @OnEvent('invoice.fully_paid')
  async handleInvoiceEvent(payload: InvoiceEventPayload): Promise<void> {
    if (!payload.customerId) return; // walk-in sale — no named customer to update

    const ctx: TenantContext = {
      authenticated: false as const,
      shopId: payload.shopId,
      tenant: { id: payload.shopId, slug: '', display_name: '', status: 'ACTIVE' as const },
    };
    try {
      await this.recalculateBalance(ctx, payload.customerId);
    } catch (err: unknown) {
      // Non-blocking: balance recalculation failure must not crash the invoicing flow.
      this.logger.warn(
        `Balance recalculation failed customer=${payload.customerId}: ${String(err)}`,
      );
    }
  }
}
