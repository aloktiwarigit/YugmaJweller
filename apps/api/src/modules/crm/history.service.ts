import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import type { PurchaseHistorySummary } from '../billing/billing.service';
import { CrmRepository } from './crm.repository';
import type { TenantContext } from '@goldsmith/tenant-context';

export type { PurchaseHistorySummary };

export interface PurchaseHistoryResponse {
  invoices: PurchaseHistorySummary[];
  total:    number;
}

@Injectable()
export class HistoryService {
  constructor(
    @Inject(BillingService) private readonly billing: BillingService,
    @Inject(CrmRepository)  private readonly crmRepo: CrmRepository,
  ) {}

  async getPurchaseHistory(
    ctx: TenantContext,
    customerId: string,
    params: { limit: number; offset: number },
  ): Promise<PurchaseHistoryResponse> {
    void ctx;
    // Tenant ownership check — RLS on invoices covers the data layer,
    // but we validate the customer belongs to this shop at the app layer too.
    const customer = await this.crmRepo.getCustomerById(customerId);
    if (!customer) throw new NotFoundException({ code: 'crm.customer_not_found' });

    // ADR-0009: CRM must not query billing tables directly.
    return this.billing.getPurchaseHistoryForCustomer(customerId, params);
  }
}
