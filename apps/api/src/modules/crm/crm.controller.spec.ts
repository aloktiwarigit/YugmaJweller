import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { CustomerAuthGuard, DEV_MOCK_CUSTOMER_ID } from '../customer/customer-auth.guard';
import { CrmController, CustomerSelfDeleteBodySchema } from './crm.controller';

const SHOP = 'aaaaaaaa-bbbb-4000-8000-000000000001';

function makeController(dpdpaSvc = { requestDeletion: vi.fn() }): CrmController {
  return new CrmController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    dpdpaSvc as never,
    {} as never,
  );
}

function requestWithCustomerCtx(): Request {
  return {
    headers: {
      'x-tenant-id': SHOP,
    },
    customerCtx: { customerId: DEV_MOCK_CUSTOMER_ID, shopId: SHOP },
    body: { customerId: 'body-customer', shopId: 'body-shop' },
  } as unknown as Request;
}

describe('CrmController customer self-deletion', () => {
  it('bypasses staff auth and tenant interceptor for the customer-auth path', () => {
    const handler = CrmController.prototype.customerSelfDelete;
    expect(Reflect.getMetadata('skip-auth', handler)).toBe(true);
    expect(Reflect.getMetadata('skip-tenant', handler)).toBe(true);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(202);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(CustomerAuthGuard);
  });

  it('requests deletion for the authenticated customer and shop context only', async () => {
    const response = {
      scheduledAt: '2026-05-16T12:00:00.000Z',
      hardDeleteAt: '2026-06-15T12:00:00.000Z',
    };
    const dpdpaSvc = { requestDeletion: vi.fn(async () => response) };
    const controller = makeController(dpdpaSvc);

    await expect(controller.customerSelfDelete(requestWithCustomerCtx(), {})).resolves.toEqual(response);

    expect(dpdpaSvc.requestDeletion).toHaveBeenCalledOnce();
    const [[ctx, customerId, requestedBy]] = dpdpaSvc.requestDeletion.mock.calls as unknown as Array<[
      Record<string, unknown>,
      string,
      'customer' | 'owner',
    ]>;
    expect(customerId).toBe(DEV_MOCK_CUSTOMER_ID);
    expect(requestedBy).toBe('customer');
    expect(ctx).toMatchObject({
      authenticated: true,
      shopId: SHOP,
      userId: DEV_MOCK_CUSTOMER_ID,
      role: 'shop_staff',
      tenant: { id: SHOP, status: 'ACTIVE' },
    });
  });

  it('does not accept customerId or shopId from a request body fallback', async () => {
    const dpdpaSvc = { requestDeletion: vi.fn() };
    const controller = makeController(dpdpaSvc);
    const req = {
      headers: {},
      body: { customerId: 'body-customer', shopId: 'body-shop' },
    } as unknown as Request;

    await expect(controller.customerSelfDelete(req, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(dpdpaSvc.requestDeletion).not.toHaveBeenCalled();
  });

  it('passes the reason body through to dpdpaSvc.requestDeletion', async () => {
    const dpdpaSvc = { requestDeletion: vi.fn().mockResolvedValue({ scheduledAt: 'x', hardDeleteAt: 'y' }) };
    const controller = makeController(dpdpaSvc);

    await controller.customerSelfDelete(
      requestWithCustomerCtx(),
      { reason: 'privacy', reasonText: undefined },
    );

    expect(dpdpaSvc.requestDeletion).toHaveBeenCalledWith(
      expect.any(Object),
      DEV_MOCK_CUSTOMER_ID,
      'customer',
      { reason: 'privacy', reasonText: undefined },
    );
  });

  it('CustomerSelfDeleteBodySchema parses undefined to {} — guards .default({}) regression', () => {
    // Per Codex round 2 fix #3 + round 3 review: NestJS runs ZodValidationPipe
    // on raw `undefined` for missing body BEFORE TypeScript default parameters
    // fire. The schema's `.default({})` is load-bearing — removing it would
    // make existing no-body customer-mobile callers regress to 400.
    expect(CustomerSelfDeleteBodySchema.parse(undefined)).toEqual({});
  });

  it('accepts an empty body (reason optional, backwards-compatible)', async () => {
    const dpdpaSvc = { requestDeletion: vi.fn().mockResolvedValue({ scheduledAt: 'x', hardDeleteAt: 'y' }) };
    const controller = makeController(dpdpaSvc);

    await controller.customerSelfDelete(requestWithCustomerCtx(), {});

    expect(dpdpaSvc.requestDeletion).toHaveBeenCalledWith(
      expect.any(Object),
      DEV_MOCK_CUSTOMER_ID,
      'customer',
      {},
    );
  });
});
