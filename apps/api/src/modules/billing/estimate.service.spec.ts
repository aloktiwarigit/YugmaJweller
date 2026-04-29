/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EstimateService } from './estimate.service';

const SHOP   = 'aaaaaaaa-bbbb-4000-8000-000000000001';
const USER   = 'cccccccc-dddd-4000-8000-000000000002';
const EST_ID = 'eeeeeeee-ffff-4000-8000-000000000003';
const INV_ID = 'ffffffff-eeee-4000-8000-000000000004';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: async (pool: any, fn: (client: any) => Promise<unknown>) => fn(pool.__client),
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditAction: {
    ESTIMATE_CREATED:   'ESTIMATE_CREATED',
    ESTIMATE_CONVERTED: 'ESTIMATE_CONVERTED',
    ESTIMATE_EXPIRED:   'ESTIMATE_EXPIRED',
  },
}));

function makeEstimateRow(overrides: Partial<any> = {}): any {
  return {
    id:                       EST_ID,
    shop_id:                  SHOP,
    customer_id:              null,
    line_items:               [],
    gold_rate_paise_per_gram: 684200n,
    subtotal_paise:           1000000n,
    gst_paise:                30000n,
    total_paise:              1030000n,
    status:                   'draft',
    expires_at:               null,
    converted_invoice_id:     null,
    created_by_user_id:       USER,
    created_at:               new Date('2026-04-29T10:00:00Z'),
    ...overrides,
  };
}

function makePool(queryFn: (sql: string, params?: any[]) => Promise<{ rows: any[] }>): any {
  const client = { query: vi.fn(queryFn) };
  return { __client: client, query: vi.fn(queryFn) };
}

describe('EstimateService', () => {
  let svc: EstimateService;

  describe('createEstimate', () => {
    beforeEach(() => {
      svc = new EstimateService(
        makePool(async (sql: string) => {
          if (sql.includes('INSERT INTO estimates')) return { rows: [makeEstimateRow()] };
          return { rows: [] };
        }),
      );
    });

    it('inserts a row and returns EstimateResponse', async () => {
      const result = await svc.createEstimate({
        lineItems:            [],
        goldRatePaisePerGram: 684200n,
        subtotalPaise:        1000000n,
        gstPaise:             30000n,
        totalPaise:           1030000n,
      });
      expect(result.id).toBe(EST_ID);
      expect(result.shopId).toBe(SHOP);
      expect(result.status).toBe('draft');
      expect(result.totalPaise).toBe('1030000');
      expect(result.goldRatePaisePerGram).toBe('684200');
    });

    it('rejects zero totalPaise', async () => {
      await expect(
        svc.createEstimate({
          lineItems:            [],
          goldRatePaisePerGram: 684200n,
          subtotalPaise:        0n,
          gstPaise:             0n,
          totalPaise:           0n,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEstimate', () => {
    it('returns estimate for matching shopId', async () => {
      svc = new EstimateService(
        makePool(async (sql: string) => {
          if (sql.includes('FROM estimates')) return { rows: [makeEstimateRow()] };
          return { rows: [] };
        }),
      );
      const result = await svc.getEstimate(EST_ID, SHOP);
      expect(result.id).toBe(EST_ID);
    });

    it('throws NotFoundException when row missing', async () => {
      svc = new EstimateService(
        makePool(async () => ({ rows: [] })),
      );
      await expect(svc.getEstimate('00000000-0000-0000-0000-000000000000', SHOP)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listEstimates', () => {
    it('returns array of estimates', async () => {
      svc = new EstimateService(
        makePool(async (sql: string) => {
          if (sql.includes('FROM estimates')) return { rows: [makeEstimateRow()] };
          return { rows: [] };
        }),
      );
      const result = await svc.listEstimates(SHOP);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]!.id).toBe(EST_ID);
    });
  });

  describe('expireEstimate', () => {
    it('sets status to expired', async () => {
      svc = new EstimateService(
        makePool(async (sql: string) => {
          if (sql.includes('UPDATE estimates')) {
            return { rows: [makeEstimateRow({ status: 'expired' })] };
          }
          return { rows: [] };
        }),
      );
      const result = await svc.expireEstimate(EST_ID, SHOP);
      expect(result.status).toBe('expired');
    });

    it('throws when estimate not found or already converted', async () => {
      svc = new EstimateService(makePool(async () => ({ rows: [] })));
      await expect(svc.expireEstimate('missing-id', SHOP)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markConverted', () => {
    it('updates status to converted and sets convertedInvoiceId', async () => {
      svc = new EstimateService(
        makePool(async (sql: string) => {
          if (sql.includes('UPDATE estimates')) return { rows: [{ id: EST_ID }] };
          return { rows: [] };
        }),
      );
      await expect(svc.markConverted(EST_ID, INV_ID, SHOP)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when estimate not convertible', async () => {
      svc = new EstimateService(makePool(async () => ({ rows: [] })));
      await expect(svc.markConverted(EST_ID, INV_ID, SHOP)).rejects.toThrow(NotFoundException);
    });
  });
});
